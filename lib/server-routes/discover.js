// lib/server-routes/discover.js — 工作区发现（H5「工作台」的数据面）。
//
// GET /discover[?root=<扫描根>&refresh=1]
//   扫描受控工作区根下的项目目录：读 AGENTS.md / MEMORY.md / README.md 等启动文件，
//   识别网文/小说项目，把已有 md/txt 按 正文/细纲/大纲/设定/人物 归类，并给出
//   到插件五槽位的映射。只读，不落盘、不改用户原目录。
//
// 目录遍历全部走 api.makeFsio(root)（ctx.fs / 服务端 fsio），遵守容器防护；
// 不直接用 node:fs 读工作区内容。扫描有界：深度 3、每项目最多 400 个文本文件、
// 启动文件只读前 8KB，避免大工作区把 H5 卡住。

import { buildProjectProfile, shouldSkipRelPath, isDiscoveryTextFile, projectSummary } from '../discovery.js';

const MAX_DEPTH = 4;
const MAX_FILES = 400;
const BOOTSTRAP_MAX_CHARS = 8000;
const CACHE_TTL_MS = 30_000;
const BOOTSTRAP_NAMES = ['agents.md', 'agent.md', 'memory.md', 'readme.md', 'readme.zh.md', 'project.md', 'claude.md'];

const cache = new Map(); // root -> { ts, value }

function basename(p) {
    const s = String(p ?? '').replace(/[\\/]+$/, '');
    return s.includes('/') ? s.slice(s.lastIndexOf('/') + 1) : (s.includes('\\') ? s.slice(s.lastIndexOf('\\') + 1) : s);
}

function joinRel(a, b) {
    return a === '' ? b : `${a}/${b}`;
}

async function safeEntries(io, rel) {
    try { return await io.listEntries(rel === '' ? '.' : rel); } catch { return []; }
}

async function safeText(io, rel, limit = BOOTSTRAP_MAX_CHARS) {
    try {
        const info = await io.stat(rel);
        if ((info?.info?.size ?? 0) > 2_000_000) return '';
        const text = await io.readText(rel);
        return typeof text === 'string' ? text.slice(0, limit) : '';
    } catch { return ''; }
}

/** 递归收集文本文件（工作区相对路径），跳过归档/依赖/构建目录。 */
async function collectFiles(io, rel, depth, out) {
    if (depth < 0 || out.length >= MAX_FILES) return;
    const entries = await safeEntries(io, rel);
    for (const entry of entries) {
        if (out.length >= MAX_FILES) return;
        const child = joinRel(rel, entry.name);
        if (shouldSkipRelPath(child)) continue;
        if (entry.type === 'directory') await collectFiles(io, child, depth - 1, out);
        else if (entry.type === 'file' && isDiscoveryTextFile(entry.name)) out.push(child);
    }
}

async function readBootstrap(io, rel, entries) {
    const out = [];
    for (const entry of entries) {
        if (entry.type !== 'file') continue;
        if (!BOOTSTRAP_NAMES.includes(String(entry.name).toLowerCase())) continue;
        const text = await safeText(io, joinRel(rel, entry.name));
        if (text.trim() !== '') out.push({ name: entry.name, text });
    }
    return out;
}

async function scanProject(io, root, rel, name) {
    const entries = await safeEntries(io, rel);
    if (entries.length === 0) return null;
    const files = [];
    await collectFiles(io, rel, MAX_DEPTH, files);
    const bootstrap = await readBootstrap(io, rel, entries);
    const existingBook = entries.some((e) => e.type === 'file' && e.name === 'novel.json')
        || files.some((f) => f === 'novel.json' || f.endsWith('/novel.json'));
    // 没有文本文件、也没有启动文件：不是可展示项目（不把纯代码/空目录塞满工作台）。
    if (!existingBook && files.length === 0 && bootstrap.length === 0) return null;
    const profile = buildProjectProfile({ name, path: rel, bootstrap, files, existingBook });
    // 纯代码/空目录/插件仓库不占工作台：未知类型且没有任何内容槽位的不展示。
    if (profile.kind === 'unknown' && profile.roles.length === 0) return null;
    return {
        ...profile,
        root,
        id: `${root}\u0000${rel}`,
        summary: projectSummary(bootstrap.map((b) => b.text).join('\n')),
    };
}

function projectSignature(p) {
    const stats = p.stats || {};
    const chapterRole = (p.roles || []).find((r) => r.role === 'chapters');
    const files = chapterRole?.files || [];
    const first = files[0]?.path ? files[0].path.split('/').pop() : '';
    const last = files.length ? String(files[files.length - 1]?.path || '').split('/').pop() : '';
    return [stats.chapters, stats.firstChapter, stats.lastChapter, stats.chapterOutline, stats.setting, first, last].join('|');
}

export async function discoverProjects(api, { root = '', refresh = false } = {}) {
    const roots = api.collectRoots();
    const selected = root !== '' ? roots.filter((r) => r === root) : roots;
    if (selected.length === 0) {
        return { roots, projects: [], scannedAt: new Date().toISOString(), warnings: ['没有可扫描的工作区根'] };
    }
    const projects = [];
    const warnings = [];
    const now = Date.now();
    for (const r of selected) {
        const hit = cache.get(r);
        if (!refresh && hit !== undefined && now - hit.ts < CACHE_TTL_MS) {
            projects.push(...hit.value.projects);
            warnings.push(...hit.value.warnings);
            continue;
        }
        try {
            const io = api.makeFsio(r);
            const local = [];
            // 根自身也可能是项目（用户直接在项目目录里打开 DSH）；只有根上确实有
            // AGENTS/MEMORY/README 才认，否则会把整个工作区（含多个书目录）收成一张卡。
            const rootEntries = await safeEntries(io, '');
            const rootBootstrap = await readBootstrap(io, '', rootEntries);
            if (rootBootstrap.length > 0) {
                const self = await scanProject(io, r, '', basename(r));
                if (self !== null) local.push(self);
            }
            for (const entry of rootEntries) {
                if (entry.type !== 'directory') continue;
                if (shouldSkipRelPath(entry.name)) continue;
                const p = await scanProject(io, r, entry.name, entry.name);
                if (p !== null) local.push(p);
            }
            cache.set(r, { ts: now, value: { projects: local, warnings: [] } });
            projects.push(...local);
        } catch (error) {
            warnings.push(`扫描 ${r} 失败：${String(error?.message ?? error)}`);
        }
    }
    // 去掉重复 id（根自身与一级目录不会重复，但防御性去重）
    const seen = new Set();
    const unique = [];
    for (const p of projects) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        unique.push(p);
    }
    unique.sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name, 'zh-CN'));
    // 同内容副本（例如书目录与它下面的 _DeepSeek_workspace 各扫到一份）只留一张卡，
    // 其余名字挂在 duplicates 上——不让用户以为工作区里有两本书。
    const bySig = new Map();
    const kept = [];
    for (const p of unique) {
        const sig = projectSignature(p);
        const seen = bySig.get(sig);
        if (seen === undefined) { p.duplicates = []; bySig.set(sig, p); kept.push(p); }
        else seen.duplicates.push(p.name);
    }
    return { roots, projects: kept, scannedAt: new Date().toISOString(), warnings };
}

export async function handle(req, res, segments, api) {
    // GET /discover — 工作台自动发现
    if (req.method === 'GET' && segments[0] === 'discover' && segments.length === 1) {
        try {
            const query = new URL(req.url, 'http://localhost').searchParams;
            const root = String(query.get('root') ?? '').trim();
            const refresh = query.get('refresh') === '1' || query.get('refresh') === 'true';
            const value = await discoverProjects(api, { root, refresh });
            api.writeJson(res, 200, { ok: true, value });
        } catch (error) {
            api.fail(res, 500, 'DISCOVER_FAILED', `扫描工作区失败：${String(error?.message ?? error)}`);
        }
        return true;
    }
    return false;
}
