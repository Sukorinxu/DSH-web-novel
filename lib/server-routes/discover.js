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

import { buildProjectProfile, shouldSkipRelPath, isDiscoveryTextFile, isDiscoveryImageFile, projectSummary, DISCOVERY_ROLES } from '../discovery.js';
import { FICTION_SUITE_TEMPLATES, parseTemplateText, inspectContent } from '../fiction-suite.js';
import { homedir } from 'node:os';
import { join } from 'node:path';

const MAX_DEPTH = 4;
const MAX_FILES = 400;
const BOOTSTRAP_MAX_CHARS = 8000;
const CACHE_TTL_MS = 30_000;
const BOOTSTRAP_NAMES = ['agents.md', 'agent.md', 'memory.md', 'readme.md', 'readme.zh.md', 'project.md', 'claude.md'];

const cache = new Map(); // root -> { ts, value }
const skillCache = new Map(); // skill dir -> { ts, specs, loaded }
const CONTENT_PROBE_MAX = 120;
const CONTENT_PROBE_CHARS = 4000;

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

/**
 * 读本机 fiction-suite 的模板文件，得到「标题结构 → 五槽位」对照表。
 * 只读 skill 安装目录（工作区之外的基础设施，走 ctx.fs，不碰书稿）；
 * skill 未安装/读取失败时用内置 fallback 结构，扫描不因此失败。
 */
async function loadFictionSuiteSpecs(api) {
    const dir = process.env.FICTION_SUITE_DIR || join(homedir(), '.dsh', 'skills', 'fiction-suite');
    const cached = skillCache.get(dir);
    if (cached && Date.now() - cached.ts < 5 * 60_000) return cached.value;
    let io = null;
    try { io = api.makeFsio(dir); } catch { /* 下面全部走 fallback */ }
    let loaded = 0;
    const specs = [];
    for (const base of FICTION_SUITE_TEMPLATES) {
        const text = io === null ? '' : await safeText(io, base.file, 20_000);
        if (text.trim() !== '') { specs.push(parseTemplateText(text, base)); loaded += 1; }
        else specs.push({ ...base, sections: [...(base.fallbackSections ?? [])] });
    }
    const value = { dir, loaded, specs };
    skillCache.set(dir, { ts: Date.now(), value });
    return value;
}

/** 读有界内容并对照模板；返回每文件的最佳可分配匹配。 */
const CONTENT_PRIORITY = /(?:设定|圣经|世界观|大纲|细纲|人物|角色|语言指纹|outline|setting|world|character|bible|layout)/i;

/** 先读「像设定/大纲/人物卡」的文件，读正文前 120 个——避免 100 章正文把设定圣经挤出探测窗口。 */
function rankProbeFiles(files) {
    return [...files].sort((a, b) => {
        const score = (p) => (CONTENT_PRIORITY.test(p) ? 100 : 0) + (/[\\/](?:0?2-设定|设定|设定圣经)[\\/]/i.test(p) ? 20 : 0);
        return score(b) - score(a) || a.localeCompare(b);
    });
}

async function probeProjectContent(io, files, specs) {
    const out = [];
    for (const rel of rankProbeFiles(files).slice(0, CONTENT_PROBE_MAX)) {
        const text = await safeText(io, rel, CONTENT_PROBE_CHARS);
        if (text.trim() === '') continue;
        const inspected = inspectContent(text, specs, 40);
        if (inspected.best === null && inspected.matches.length === 0) continue;
        out.push({ path: rel, ...inspected });
    }
    return out;
}

/** 把内容匹配并回项目画像：补五槽位、记录相似内容、抽取可预填字段。 */
function applyContentMatches(profile, probes) {
    profile.similar = [];
    profile.hints = profile.hints ?? {};
    for (const probe of probes) {
        const best = probe.best;
        // 内容对照里保留「弱匹配」：只要命中模板章节就展示，不强行升格为可分配槽位。
        const shown = best ?? (probe.matches ?? []).find((m) => m.assignable !== false) ?? null;
        if (shown !== null) {
            profile.similar.push({
                file: probe.path,
                role: shown.role,
                roleLabel: DISCOVERY_ROLES.find((r) => r.id === shown.role)?.label ?? shown.role,
                template: shown.templateId,
                templateLabel: shown.label,
                score: shown.score,
                hits: shown.hits,
                missing: shown.missing,
                weak: best === null,
            });
        }
        if (best !== null) {
            let entry = profile.roles.find((r) => r.role === best.role);
            if (entry === undefined) {
                const meta = DISCOVERY_ROLES.find((r) => r.id === best.role);
                entry = { role: best.role, label: meta?.label ?? best.role, target: meta?.target ?? '', count: 0, files: [] };
                profile.roles.push(entry);
            }
            if (!entry.files.some((f) => f.path === probe.path)) {
                entry.files.push({ path: probe.path, title: probe.path.split('/').pop().replace(/\.[^.]+$/, ''), chapter: null, contentMatched: true });
                entry.count += 1;
                if (best.role === 'chapterOutline') profile.stats.chapterOutline += 1;
                else if (best.role === 'outline') profile.stats.outline += 1;
                else if (best.role === 'setting') profile.stats.setting += 1;
                else if (best.role === 'characters') profile.stats.characters += 1;
            }
        }
        for (const [key, value] of Object.entries(probe.hints ?? {})) {
            if (profile.hints[key] === undefined && value !== '') profile.hints[key] = value;
        }
    }
    profile.similar.sort((a, b) => b.score - a.score || a.file.localeCompare(b.file));
    profile.similar = profile.similar.slice(0, 8);
    if (profile.hints.bookTitle) {
        const title = String(profile.hints.bookTitle).replace(/[《》]/g, '').trim();
        if (title !== '') { profile.bookTitle = title; profile.adopt.title = title; profile.adopt.book = title; }
    }
    if (profile.hints.genre) profile.adopt.genre = profile.hints.genre;
    return profile;
}

/** 递归收集文本文件（工作区相对路径），跳过归档/依赖/构建目录。 */
async function collectFiles(io, rel, depth, out, images = []) {
    if (depth < 0 || out.length >= MAX_FILES) return;
    const entries = await safeEntries(io, rel);
    for (const entry of entries) {
        if (out.length >= MAX_FILES) return;
        const child = joinRel(rel, entry.name);
        if (shouldSkipRelPath(child)) continue;
        if (entry.type === 'directory') await collectFiles(io, child, depth - 1, out, images);
        else if (entry.type === 'file') {
            if (isDiscoveryTextFile(entry.name)) out.push(child);
            else if (isDiscoveryImageFile(entry.name) && images.length < 80) images.push(child);
        }
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

async function scanProject(io, root, rel, name, fsSpecs) {
    const entries = await safeEntries(io, rel);
    if (entries.length === 0) return null;
    const files = [];
    const images = [];
    await collectFiles(io, rel, MAX_DEPTH, files, images);
    const bootstrap = await readBootstrap(io, rel, entries);
    const novelRel = entries.some((e) => e.type === 'file' && e.name === 'novel.json')
        ? 'novel.json'
        : (files.find((f) => f === 'novel.json' || f.endsWith('/novel.json')) ?? null);
    let existingBook = false;
    if (novelRel !== null) {
        const novelText = await safeText(io, novelRel, 4000);
        try {
            const parsed = JSON.parse(novelText);
            existingBook = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0;
        } catch { /* 空/坏 novel.json 是删除后的墓碑，不是书 */ }
    }
    // 没有文本文件、也没有启动文件：不是可展示项目（不把纯代码/空目录塞满工作台）。
    if (!existingBook && files.length === 0 && bootstrap.length === 0) return null;
    const profile = buildProjectProfile({ name, path: rel, bootstrap, files, covers: images, existingBook });
    const probes = await probeProjectContent(io, files, fsSpecs?.specs ?? []);
    applyContentMatches(profile, probes);
    // 纯代码/空目录/插件仓库不占工作台：未知类型且没有任何内容槽位的不展示。
    if (profile.kind === 'unknown' && profile.roles.length === 0) return null;
    // 封面缩略图：只读取 <= 1.2MB 的图片并内联为 data URL；大图只保留路径，不拖慢列表。
    if (profile.cover && profile.cover.path) {
        try {
            const bytes = await io.readBytes(profile.cover.path, 1_200_000);
            if (bytes !== null && bytes.length <= 1_200_000) {
                const ext = String(profile.cover.path).split('.').pop().toLowerCase();
                const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
                profile.cover.dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
            }
        } catch { /* 封面读失败不影响项目卡片 */ }
    }
    return {
        ...profile,
        root,
        id: `${root}\u0000${rel}`,
        summary: profile.synopsis || projectSummary(bootstrap.map((b) => b.text).join('\n')),
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
    const fsSpecs = await loadFictionSuiteSpecs(api);
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
                const self = await scanProject(io, r, '', basename(r), fsSpecs);
                if (self !== null) local.push(self);
            }
            for (const entry of rootEntries) {
                if (entry.type !== 'directory') continue;
                if (shouldSkipRelPath(entry.name)) continue;
                const p = await scanProject(io, r, entry.name, entry.name, fsSpecs);
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
    return { roots, projects: kept, scannedAt: new Date().toISOString(), warnings,
        fictionSuite: { dir: fsSpecs.dir, loaded: fsSpecs.loaded, templates: fsSpecs.specs.length } };
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
