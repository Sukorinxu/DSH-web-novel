// lib/server-routes/harvest.js — 会话采风（H5 入口）。
//
// GET  /sessions         当前进程里在册的 live 会话（id/标题/cwd/创建时间），供 H5 选择
// POST /sessions/harvest { sessionId, mode, book, workspace?, dryRun?, maxChars?, overwrite?, appendOutline? }
//
// 与工具 novel_harvest 共用 lib/harvest.js 的核心；这里只负责「从 REST 找会话、
// 找书/工作区、装配 fsio」——对话通道里这些由 exec.agent.session 直接给出。
import { runHarvest, DEFAULT_TRANSCRIPT_CHARS, MIN_TRANSCRIPT_CHARS, MAX_TRANSCRIPT_CHARS } from '../harvest.js';
import { assertBookName } from '../fsio.js';

function errorStatus(code) {
    if (code === 'BOOK_EXISTS') return 409;
    if (code === 'BOOK_NOT_FOUND' || code === 'SESSION_NOT_FOUND') return 404;
    if (code === 'ENGINE_UNAVAILABLE') return 503;
    if (code === 'WORKSPACE_FORBIDDEN') return 403;
    return 400;
}

function publicResult(result) {
    const preview = result.preview ?? {};
    return {
        book: result.book,
        mode: result.mode,
        sessionId: result.sessionId,
        transcriptChars: result.transcriptChars,
        messageCount: result.messageCount,
        truncated: result.truncated,
        dryRun: result.dryRun,
        created: result.created,
        counts: result.counts,
        usage: result.usage,
        route: result.route,
        warnings: result.warnings,
        discarded: result.discarded,
        preview: {
            title: preview.title ?? '',
            genre: preview.genre ?? '',
            logline: preview.logline ?? '',
            characters: (preview.characters ?? []).map((c) => c.name),
            worldbook: (preview.worldbook ?? []).map((e) => e.title || String(e.content ?? '').slice(0, 40)),
            glossary: (preview.glossary ?? []).map((g) => g.term),
            outlineChars: preview.outline ? preview.outline.length : 0,
        },
    };
}

export async function handle(req, res, segments, api) {
    // GET /sessions — H5 会话选择器
    if (req.method === 'GET' && segments[0] === 'sessions' && segments.length === 1) {
        let store = null;
        try { store = api.getSessionStore(); } catch { store = null; }
        if (!store || typeof store.list !== 'function') {
            api.fail(res, 501, 'SESSION_STORE_UNAVAILABLE', '宿主没有提供 live sessions（dsh-session 未装载或已裁剪），无法读取当前会话');
            return true;
        }
        let list = [];
        try { list = store.list() ?? []; } catch (error) {
            api.fail(res, 500, 'SESSION_STORE_FAILED', `读取 live sessions 失败：${String(error?.message ?? error)}`);
            return true;
        }
        const rows = list.slice(-30).map((s) => {
            const header = s?.header ?? {};
            return {
                id: String(header.id ?? s?.id ?? ''),
                title: String(header.title ?? ''),
                cwd: String(header.cwd ?? ''),
                createdAt: String(header.createdAt ?? ''),
                updatedAt: String(header.updatedAt ?? ''),
            };
        }).filter((row) => row.id !== '');
        api.writeJson(res, 200, { ok: true, value: { sessions: rows } });
        return true;
    }

    // POST /sessions/harvest — 读一个 live 会话并建书/扩写
    if (req.method === 'POST' && segments[0] === 'sessions' && segments[1] === 'harvest' && segments.length === 2) {
        let body;
        try { body = await api.readJsonBody(req); } catch (error) {
            api.fail(res, 400, 'INVALID_BODY', String(error?.message ?? error));
            return true;
        }
        const mode = body?.mode === 'enrich' ? 'enrich' : 'new';
        let book;
        try { book = assertBookName(String(body?.book ?? '')); } catch (error) {
            api.fail(res, 400, 'INVALID_FIELD', String(error?.message ?? error));
            return true;
        }
        let store = null;
        try { store = api.getSessionStore(); } catch { store = null; }
        if (!store || typeof store.get !== 'function') {
            api.fail(res, 501, 'SESSION_STORE_UNAVAILABLE', '宿主没有提供 live sessions，无法读取会话（请在真实会话里用 novel_harvest 工具）');
            return true;
        }
        let sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
        if (sessionId === '') {
            let list = [];
            try { list = store.list() ?? []; } catch { list = []; }
            const last = list[list.length - 1];
            sessionId = String(last?.header?.id ?? last?.id ?? '');
        }
        if (sessionId === '') {
            api.fail(res, 404, 'SESSION_NOT_FOUND', '当前没有在册会话：请先在对话里说几句话再回来');
            return true;
        }
        const session = store.get(sessionId);
        if (!session || typeof session.deriveMessages !== 'function') {
            api.fail(res, 404, 'SESSION_NOT_FOUND', `会话不在册：${sessionId}（store 只保留运行中的 live 会话；请用对话里的 novel_harvest）`);
            return true;
        }

        const maxChars = Number.isInteger(body?.maxChars)
            ? Math.max(MIN_TRANSCRIPT_CHARS, Math.min(MAX_TRANSCRIPT_CHARS, body.maxChars))
            : DEFAULT_TRANSCRIPT_CHARS;
        let io;
        try {
            if (mode === 'enrich') {
                const found = await api.locateBook(book, { session: '' });
                if (!found) { api.fail(res, 404, 'BOOK_NOT_FOUND', `书目不存在：${book}`); return true; }
                io = found.fsio;
            } else {
                const roots = api.collectRoots();
                const explicit = typeof body?.workspace === 'string' ? body.workspace : '';
                let root = roots[0] ?? '';
                if (explicit !== '') {
                    if (!roots.includes(explicit)) { api.fail(res, 403, 'WORKSPACE_FORBIDDEN', 'workspace 不在受控扫描根内'); return true; }
                    root = explicit;
                }
                if (root === '') { api.fail(res, 500, 'NO_WORKSPACE', '没有可用的工作区根'); return true; }
                io = api.makeFsio(root);
                const exists = await io.readJson(`${book}/novel.json`).catch(() => null);
                if (exists !== null) { api.fail(res, 409, 'BOOK_EXISTS', `书目已存在：${book}（扩写请用 mode=enrich）`); return true; }
            }
            // 审计/归属按读到的会话记（REST 侧没有 exec.sessionId，手工补）。
            io.sessionId = sessionId;
            const result = await runHarvest({
                engine: api.engine,
                io,
                session,
                sessionId,
                book,
                mode,
                maxChars,
                dryRun: body?.dryRun === true,
                overwrite: body?.overwrite === true,
                appendOutline: body?.appendOutline === true,
            });
            api.writeJson(res, 200, { ok: true, value: publicResult(result) });
        } catch (error) {
            const code = typeof error?.code === 'string' ? error.code : 'HARVEST_FAILED';
            const advice = error?.advice ? `（${error.advice}）` : '';
            api.fail(res, errorStatus(code), code, `${String(error?.message ?? error)}${advice}`);
        }
        return true;
    }
    return false;
}
