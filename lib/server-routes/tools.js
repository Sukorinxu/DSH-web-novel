// lib/server-routes/tools.js — 全工具 REST 桥接（H5 成为完整控制台的关键件）。
//
// 为什么需要它：H5 要「所有功能都能用」，而写章/细纲/账本/人物/伏笔/体检/导入等能力
// 原本只存在于 23 个 novel_* 工具里（MCP/对话通道）。这里把同一份工具装配（buildStandaloneTools）
// 复用到服务端：GET /tools 暴露工具清单+输入 schema，POST /rpc 执行任意 novel_* 工具。
// 不是第二套实现：工具本体、门禁、账本、版本策略全部复用。
//
// 安全：fence（派发层统一）+ Host/Origin 本机白名单；workspace 参数只接受扫描根白名单内的路径。
import { buildStandaloneTools, toInputSchema } from '../mcp-standalone.js';

/** root+配置指纹 → Promise<bridge>（装配一次，进程内复用；工具注册表是只读的）。 */
const bridgeCache = new Map();

function configOverrides(api) {
    const c = api.config ?? {};
    const out = {};
    for (const key of ['layout', 'versioning', 'minChapterChars', 'maxChapterChars', 'contextBudgetChars', 'scanTopK', 'repetitionWindow', 'noaiCrossWindow', 'pacing']) {
        if (c[key] !== undefined) out[key] = c[key];
    }
    out.skipPresetDeploy = true;
    return out;
}

function bridgeFor(root, api) {
    const key = root;
    let p = bridgeCache.get(key);
    if (p === undefined) {
        p = buildStandaloneTools(root, configOverrides(api)).catch((error) => {
            bridgeCache.delete(key);
            throw error;
        });
        bridgeCache.set(key, p);
    }
    return p;
}

/** 取调用目标工作区根：显式 workspace（必须命中扫描根）→ args 里的书定位到的根 → 首个扫描根。 */
async function resolveRoot(api, body, req) {
    const roots = api.collectRoots();
    const explicit = typeof body?.workspace === 'string' ? body.workspace : '';
    if (explicit !== '') {
        if (!roots.includes(explicit)) throw Object.assign(new Error('workspace 不在受控扫描根内'), { code: 'WORKSPACE_FORBIDDEN', status: 403 });
        return explicit;
    }
    const args = body?.args ?? {};
    const candidate = args.book ?? args.bookId ?? args.title ?? args.name ?? '';
    if (typeof candidate === 'string' && candidate !== '') {
        try {
            const found = await api.locateBook(candidate, { session: api.requestSession(req, body) });
            if (found?.root) return found.root;
        } catch { /* 书不存在（如 init 新书）→ 回退首个根 */ }
    }
    if (roots.length === 0) throw Object.assign(new Error('没有可用的工作区根'), { code: 'NO_WORKSPACE', status: 500 });
    return roots[0];
}

export async function handle(req, res, segments, api) {
    // GET /tools — 工具清单 + 输入 schema（H5 动态表单用）
    if (req.method === 'GET' && segments[0] === 'tools' && segments.length === 1) {
        try {
            const root = await resolveRoot(api, null, req);
            const bridge = await bridgeFor(root, api);
            const value = bridge.tools.map((t) => ({
                name: t.name,
                description: t.description ?? '',
                inputSchema: toInputSchema(t.parameters ?? {}),
            }));
            api.writeJson(res, 200, { ok: true, value: { root, tools: value } });
        } catch (error) {
            api.fail(res, error.status ?? 500, error.code ?? 'IO_FAILURE', String(error.message ?? error));
        }
        return true;
    }
    // GET /workspaces — 扫描根（H5 创建新书时选落点）
    if (req.method === 'GET' && segments[0] === 'workspaces' && segments.length === 1) {
        try {
            const roots = api.collectRoots();
            api.writeJson(res, 200, { ok: true, value: { roots, current: roots[0] ?? null } });
        } catch (error) {
            api.fail(res, 500, 'IO_FAILURE', String(error));
        }
        return true;
    }
    // POST /rpc — 执行一个 novel_* 工具：{ tool, args, workspace? }
    if (req.method === 'POST' && segments[0] === 'rpc' && segments.length === 1) {
        let body;
        try {
            body = await api.readJsonBody(req);
        } catch (error) {
            api.fail(res, 400, 'INVALID_BODY', String(error?.message ?? error));
            return true;
        }
        const toolName = typeof body?.tool === 'string' ? body.tool : '';
        const args = body?.args && typeof body.args === 'object' && !Array.isArray(body.args) ? body.args : {};
        if (toolName === '') { api.fail(res, 400, 'INVALID_FIELD', 'tool 必填'); return true; }
        try {
            const root = await resolveRoot(api, body, req);
            const bridge = await bridgeFor(root, api);
            if (!bridge.tools.some((t) => t.name === toolName)) {
                api.fail(res, 400, 'UNKNOWN_TOOL', `未知工具：${toolName}`);
                return true;
            }
            const value = await bridge.call(toolName, args);
            api.writeJson(res, 200, { ok: true, value });
        } catch (error) {
            const status = typeof error?.status === 'number' ? error.status : 400;
            api.fail(res, status, error?.code ?? 'TOOL_FAILED', String(error?.message ?? error));
        }
        return true;
    }
    return false;
}
