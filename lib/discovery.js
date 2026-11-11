// lib/discovery.js — 工作区「已有项目」识别（纯函数，零 io）。
//
// 产品目标（用户 2026-11-11）：插件第一次进入工作区时，不应要求用户先按插件的
// novel.json 标准建书；应该先读 AGENTS.md / MEMORY.md / README.md，认出「这是一个
// 网文/小说项目」，再把已有的 md/txt 按 设定 / 圣经 / 细纲 / 正文 / 人物 / 大纲
// 归类，映射到插件的五个内容槽位，展示出来让用户一键接入。
//
// 这里只做可测试的判断：文件角色、项目类型、置信度、映射表。真正的目录遍历与
// 文件读取在 lib/server-routes/discover.js（走 ctx.fs / fsio，遵守容器防护）。
//
// 设计原则：宁可多展示、少断言。置信度只是排序/提示，不是硬门禁；用户永远能看到
// 原始路径和「未分类」文件，不会被插件偷偷丢掉内容。

export const DISCOVERY_ROLES = [
    { id: 'chapters', label: '正文', target: '06-正文', dirs: ['正文', '章节', 'chapters', 'manuscript'], rank: 50 },
    { id: 'chapterOutline', label: '细纲', target: '04-细纲', dirs: ['细纲', '章节细纲', 'outline'], rank: 40 },
    { id: 'outline', label: '大纲', target: '03-分卷大纲', dirs: ['大纲', '分卷大纲', '全书大纲', 'outline', 'plot'], rank: 30 },
    { id: 'setting', label: '设定 / 圣经', target: '02-设定圣经', dirs: ['设定', '设定集', '世界观', '圣经', 'bible', 'lore', 'setting', 'settings'], rank: 20 },
    { id: 'characters', label: '人物卡', target: '05-角色语言指纹', dirs: ['人物', '人物卡', '角色', '人物设定', 'characters', 'cast'], rank: 10 },
];

export const DISCOVERY_EXT = /\.(md|markdown|txt)$/i;
export const DISCOVERY_IMAGE_EXT = /\.(jpg|jpeg|png|webp)$/i;

const SKIP_SEGMENTS = new Set([
    'node_modules', '.git', '.svn', '.hg', '__pycache__', '.venv', 'venv',
    '_archive', 'archive', 'backups', 'backup', '导出', 'export', '.novel',
    '.idea', '.vscode', 'dist', 'build', 'coverage',
]);

const CHAPTER_RE = /(^|[\\/])第\s*[0-9零〇一二三四五六七八九十百千万两]+\s*[章回节]/i;
const TITLE_RE = /第\s*([0-9零〇一二三四五六七八九十百千万两]+)\s*[章回节]\s*(.*)$/;

const NOVEL_MARKERS = [
    '小说', '网文', '长篇', '连载', '章节', '正文', '细纲', '大纲', '人物卡',
    '世界观', '设定', '故事', '创作', 'novel', 'chapter', 'manuscript', 'outline',
];

/** 归一化工作区相对路径：统一 /，去掉 ./ 与首尾斜杠；不是纯函数边界也不改大小写。 */
export function normalizeRelPath(p) {
    return String(p ?? '')
        .replace(/\\/g, '/')
        .split('/')
        .filter((s) => s !== '' && s !== '.')
        .join('/');
}

/** 路径是否落在应跳过的目录（归档/依赖/构建产物）里。 */
export function shouldSkipRelPath(rel) {
    return normalizeRelPath(rel).split('/').some((seg) => SKIP_SEGMENTS.has(seg.toLowerCase()));
}

/** 是否可识别的文本文档（md/markdown/txt）。 */
export function isDiscoveryTextFile(name) {
    return DISCOVERY_EXT.test(String(name ?? ''));
}

export function isDiscoveryImageFile(name) {
    return DISCOVERY_IMAGE_EXT.test(String(name ?? ''));
}

function baseName(p) {
    const s = normalizeRelPath(p);
    return s.includes('/') ? s.slice(s.lastIndexOf('/') + 1) : s;
}

function stemLower(p) {
    return baseName(p).replace(/\.[^.]+$/, '').toLowerCase();
}

const GENERIC_BOOK_NAMES = /^(?:_?deepseek[_-]?workspace|workspace|正文|章节|小说|项目|未命名|untitled|book|novel)$/i;

/**
 * 从启动文件里读「书名 / 作品简介」等元信息。
 * 只认显式标签或书名号，不拿正文第一段猜书名。
 * @param {Array<{name:string,text:string}>} bootstrap
 * @returns {{bookTitle:string, synopsis:string}}
 */
export function parseBootstrapMeta(bootstrap = []) {
    const text = bootstrap.map((b) => String(b.text ?? '')).join('\n');
    const lines = text.split(/\r?\n/).map((l) => l.trim());
    let bookTitle = '';
    let synopsis = '';
    const mark = /[《]([^》\n]{1,80})[》]/.exec(text);
    if (mark) bookTitle = mark[1].trim();
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (line === '') continue;
        const clean = line.replace(/^[-*]\s+/, '');
        const tm = /^(?:书名|书目名|作品名|项目名|书目|标题)\s*[:：]\s*(.+)$/.exec(clean);
        if (tm && bookTitle === '') { bookTitle = tm[1].replace(/[《》]/g, '').trim(); continue; }
        const sm = /^(?:作品简介|简介|一句话立意|一句话故事|立意|logline)\s*[:：]\s*(.*)$/i.exec(clean);
        if (sm && synopsis === '') {
            const parts = [sm[1].trim()];
            for (let j = i + 1; j < lines.length; j += 1) {
                const next = lines[j];
                if (next === '' || /^#{1,6}\s/.test(next) || /^(?:书名|作品名|项目名|书目|标题|每章字数|字数区间|章节字数)\s*[:：]/.test(next)) break;
                parts.push(next);
            }
            synopsis = parts.join('\n').trim();
        }
    }
    if (synopsis.length > 500) synopsis = synopsis.slice(0, 500);
    return { bookTitle, synopsis };
}

/**
 * 识别封面候选：优先书名/项目名同名图片，其次 600X800、封面、cover。
 * @param {string[]} images 工作区相对路径
 * @param {{bookTitle?:string, projectName?:string}} names
 * @returns {string|null}
 */
export function pickCover(images = [], { bookTitle = '', projectName = '' } = {}) {
    if (!images.length) return null;
    const list = images.filter((p) => isDiscoveryImageFile(p)).map((p) => ({ path: p, stem: stemLower(p) }));
    const exact = [bookTitle, projectName, '600x800', '600-800', '600_800', '封面', 'cover']
        .map((x) => String(x ?? '').toLowerCase().trim()).filter(Boolean);
    for (const name of exact) {
        const hit = list.find((x) => x.stem === name);
        if (hit) return hit.path;
    }
    for (const name of exact) {
        const hit = list.find((x) => x.stem.startsWith(name) || x.stem.includes(name));
        if (hit) return hit.path;
    }
    const size = list.find((x) => x.stem.includes('600') && x.stem.includes('800'));
    return size ? size.path : null;
}

/** 取文件主名（去扩展名），统一 /。 */
export function fileStem(rel) {
    const p = normalizeRelPath(rel);
    const base = p.includes('/') ? p.slice(p.lastIndexOf('/') + 1) : p;
    return base.replace(DISCOVERY_EXT, '');
}

/** 路径是否包含某个目录名（整段匹配或包含，兼容「02-设定圣经」）。 */
function hasDir(rel, names) {
    const segs = normalizeRelPath(rel).split('/').map((s) => s.toLowerCase());
    return names.some((name) => segs.some((seg) => seg === name || seg.includes(name)));
}

/** 解析「第N章 标题」→ {n,title}；不是章节名返回 null。 */
export function chapterMetaFromName(rel) {
    const stem = fileStem(rel);
    const m = TITLE_RE.exec(stem);
    if (m === null) return null;
    const raw = m[1];
    let n = 0;
    if (/^\d+$/.test(raw)) n = Number(raw);
    else n = chineseNumber(raw);
    if (!Number.isInteger(n) || n <= 0) return null;
    return { n, title: (m[2] || '').trim() || `第${n}章` };
}

/** 中文数字（章节规模）；无法解析返回 0。 */
export function chineseNumber(text) {
    const s = String(text ?? '');
    if (/^\d+$/.test(s)) return Number(s);
    const digits = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    const units = { 十: 10, 百: 100, 千: 1000 };
    let total = 0; let section = 0; let digit = 0;
    for (const ch of s) {
        if (Object.hasOwn(digits, ch)) { digit = digits[ch]; continue; }
        if (Object.hasOwn(units, ch)) { section += (digit || 1) * units[ch]; digit = 0; continue; }
        if (ch === '万') { total += (section + digit) * 10000; section = 0; digit = 0; continue; }
        return 0;
    }
    return total + section + digit;
}

/**
 * 单文件角色判定。
 * 返回 {role, label, target, title, chapter?} 或 null（非文本/不归类）。
 */
export function classifyProjectFile(rel) {
    const p = normalizeRelPath(rel);
    if (!isDiscoveryTextFile(p)) return null;
    const stem = fileStem(p);
    const chapter = chapterMetaFromName(p);
    // 细纲优先于大纲/正文：路径或文件名带「细纲」就是章节细纲。
    if (/细纲/.test(p)) {
        return { role: 'chapterOutline', label: '细纲', target: '04-细纲', title: stem, ...(chapter ? { chapter } : {}) };
    }
    if (hasDir(p, ['正文', '章节', 'chapters', 'manuscript']) || chapter !== null) {
        return { role: 'chapters', label: '正文', target: '06-正文', title: stem, ...(chapter ? { chapter } : {}) };
    }
    if (hasDir(p, ['大纲', '分卷大纲', '全书大纲', 'outline', 'plot']) || /大纲/.test(stem)) {
        return { role: 'outline', label: '大纲', target: '03-分卷大纲', title: stem };
    }
    if (hasDir(p, ['设定', '设定集', '世界观', '圣经', 'bible', 'lore', 'setting', 'settings']) || /设定|世界观|圣经|bible|lore/i.test(stem)) {
        return { role: 'setting', label: '设定 / 圣经', target: '02-设定圣经', title: stem };
    }
    if (hasDir(p, ['人物', '人物卡', '角色', '人物设定', 'characters', 'cast']) || /人物|角色|人设|characters?/i.test(stem)) {
        return { role: 'characters', label: '人物卡', target: '05-角色语言指纹', title: stem };
    }
    return { role: 'notes', label: '其他文档', target: '', title: stem };
}

/** 从启动文件（AGENTS.md / MEMORY.md / README.md）里提「项目类型」标签。 */
export function detectTags(text) {
    const lower = String(text ?? '').toLowerCase();
    const tags = [];
    for (const marker of NOVEL_MARKERS) {
        if (lower.includes(marker.toLowerCase())) tags.push(marker);
    }
    return [...new Set(tags)];
}

/**
 * 项目判定。bootstrap 是 { name, text }[]；files 是相对路径[]。
 * @returns {{kind:'book'|'novel'|'unknown', confidence:number, tags:string[], signals:string[]}}
 */
export function classifyProject({ name = '', bootstrap = [], files = [], existingBook = false } = {}) {
    if (existingBook) return { kind: 'book', confidence: 100, tags: ['造神书'], signals: ['novel.json'] };
    const text = bootstrap.map((b) => `${b.name}\n${b.text ?? ''}`).join('\n');
    const tags = detectTags(`${name}\n${text}`);
    const roles = new Set(files.map((f) => classifyProjectFile(f)?.role).filter((r) => r && r !== 'notes'));
    const signals = [];
    let score = 0;
    if (tags.length > 0) { score += Math.min(6, tags.length * 2); signals.push('启动文件含：' + tags.slice(0, 6).join('、')); }
    if (roles.size >= 2) { score += 4; signals.push(`识别到 ${roles.size} 类内容（${[...roles].map((r) => DISCOVERY_ROLES.find((d) => d.id === r)?.label ?? r).join('、')}）`); }
    if (roles.has('chapters')) { score += 3; signals.push('有正文章节文件'); }
    if (bootstrap.length > 0) { score += 1; signals.push('有 AGENTS/MEMORY/README 启动文件'); }
    if (/[《》]/.test(name)) { score += 1; signals.push('目录名带书名号'); }
    // 只靠启动文件里出现「小说」这类词不算项目：开发文档、插件仓库、README 都会命中。
    // 硬判据是**内容文件结构**：至少两类槽位，或有正文 + 项目标注，或一类槽位 + 明确网文标签。
    const tagged = tags.includes('小说') || tags.includes('网文');
    const isNovel = roles.size >= 2
        || (roles.has('chapters') && (tagged || bootstrap.length > 0))
        || (roles.size >= 1 && tagged);
    const kind = isNovel ? 'novel' : 'unknown';
    return { kind, confidence: Math.min(95, score * 12), tags, signals };
}

/**
 * 汇总项目画像 + 五槽位映射。
 * @param {object} args
 * @param {string} args.name 目录名
 * @param {string} args.path 工作区相对路径（'' 表示根自身）
 * @param {Array<{name,text}>} args.bootstrap
 * @param {string[]} args.files 工作区相对路径
 * @returns {object}
 */
export function buildProjectProfile({ name = '', path = '', bootstrap = [], files = [], covers = [], existingBook = false } = {}) {
    const cls = classifyProject({ name, bootstrap, files, existingBook });
    const meta = parseBootstrapMeta(bootstrap);
    const bookTitle = displayTitle(name, bootstrap);
    const synopsis = (meta.synopsis || projectSummary(bootstrap.map((b) => b.text).join('\n'))).slice(0, 500);
    const cover = pickCover(covers, { bookTitle: preferredBookName(name, bootstrap), projectName: name });
    const byRole = new Map();
    const notes = [];
    for (const rel of files) {
        if (!isDiscoveryTextFile(rel)) continue;
        if (shouldSkipRelPath(rel)) continue;
        const c = classifyProjectFile(rel);
        if (c === null) continue;
        if (c.role === 'notes') { notes.push({ path: rel, title: c.title }); continue; }
        if (!byRole.has(c.role)) byRole.set(c.role, []);
        byRole.get(c.role).push({ path: rel, title: c.title, chapter: c.chapter ?? null });
    }
    for (const list of byRole.values()) {
        list.sort((a, b) => {
            const an = a.chapter?.n ?? Number.MAX_SAFE_INTEGER;
            const bn = b.chapter?.n ?? Number.MAX_SAFE_INTEGER;
            if (an !== bn) return an - bn;
            return a.path.localeCompare(b.path, 'zh-CN', { numeric: true });
        });
    }
    const mapping = DISCOVERY_ROLES.map((role) => ({
        role: role.id,
        label: role.label,
        target: role.target,
        count: (byRole.get(role.id) ?? []).length,
        files: (byRole.get(role.id) ?? []).slice(0, 40),
    })).filter((m) => m.count > 0);
    const chapterFiles = byRole.get('chapters') ?? [];
    const chapterNos = chapterFiles.map((f) => f.chapter?.n).filter((n) => Number.isInteger(n));
    const outlineFiles = byRole.get('chapterOutline') ?? [];
    const sourceDir = commonDir(chapterFiles.map((f) => f.path));
    const outlineDir = commonDir(outlineFiles.map((f) => f.path));
    return {
        name,
        path,
        bookTitle,
        synopsis,
        cover: cover === null ? null : { path: cover },
        kind: cls.kind,
        confidence: cls.confidence,
        tags: cls.tags,
        signals: cls.signals,
        bootstrap: bootstrap.map((b) => ({ name: b.name, chars: String(b.text ?? '').length })),
        files: { total: files.length, text: files.filter((f) => isDiscoveryTextFile(f)).length, notes: notes.length, notesSample: notes.slice(0, 20) },
        roles: mapping,
        stats: {
            chapters: chapterFiles.length,
            chapterOutline: outlineFiles.length,
            firstChapter: chapterNos.length > 0 ? Math.min(...chapterNos) : 0,
            lastChapter: chapterNos.length > 0 ? Math.max(...chapterNos) : 0,
            outline: (byRole.get('outline') ?? []).length,
            setting: (byRole.get('setting') ?? []).length,
            characters: (byRole.get('characters') ?? []).length,
        },
        adopt: {
            source: sourceDir || (path === '' ? '.' : path),
            /** 兼容旧字段：接入动作现在用 source（已经下钻到正文目录）。 */
            sourceDir: sourceDir || (path === '' ? '.' : path),
            outlines: outlineDir,
            book: preferredBookName(name, bootstrap),
            title: displayTitle(name, bootstrap),
            logline: synopsis,
            cover,
            chapters: chapterFiles.length,
            outlinesCount: outlineFiles.length,
        },
    };
}

/** 一组文件路径的公共父目录；空数组返回 ''。 */
export function commonDir(paths) {
    const dirs = (paths ?? []).map((p) => {
        const s = normalizeRelPath(p);
        return s.includes('/') ? s.slice(0, s.lastIndexOf('/')) : '';
    }).filter((d, i, arr) => arr.indexOf(d) === i);
    if (dirs.length === 0) return '';
    if (dirs.length === 1) return dirs[0];
    const split = dirs.map((d) => d.split('/'));
    const first = split[0];
    const common = [];
    for (let i = 0; i < first.length; i += 1) {
        const seg = first[i];
        if (split.every((parts) => parts[i] === seg)) common.push(seg);
        else break;
    }
    return common.join('/');
}

/** 目录名/启动文件 → 建议书目名：书名号内 > 显式书名标签 > 可读项目名；识别不到用「暂未命名」。 */
export function preferredBookName(name, bootstrap = []) {
    const meta = parseBootstrapMeta(bootstrap);
    const s = String(name ?? '');
    const mark = /[《]([^》]+)[》]/.exec(s);
    const raw = (meta.bookTitle || (mark ? mark[1] : '') || s
        .replace(/[《》]/g, '')
        .replace(/[（(].*?[)）]/g, '')
        .replace(/(?:作品|小说|项目)$/u, ''))
        .trim();
    if (raw === '' || GENERIC_BOOK_NAMES.test(raw)) return '暂未命名';
    return raw;
}

/** 目录名 → 展示标题（优先书名号/启动文件里的书名；未识别用《暂未命名》占位）。 */
export function displayTitle(name, bootstrap = []) {
    const title = preferredBookName(name, bootstrap);
    return title === '暂未命名' ? '《暂未命名》' : title;
}

/** 从启动文件内容里找一句项目定位（用于卡片副标题）；找不到返回 ''。 */
export function projectSummary(text, maxLen = 160) {
    const src = String(text ?? '');
    const lines = src.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const pick = lines.find((l) => /一句话|立意|简介|项目|题材|类型|logline|genre/i.test(l) && l.length > 6)
        ?? lines.find((l) => !/^#/.test(l) && l.length >= 12 && !/^[-*]/.test(l))
        ?? '';
    return String(pick).replace(/^[-*]\s*/, '').slice(0, maxLen);
}
