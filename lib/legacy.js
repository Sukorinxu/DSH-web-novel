// lib/legacy.js — 旧稿（插件安装前的工作区）识别与接入计划（纯函数，零 io）。
//
// 背景：插件只认「书目录里有 novel.json」的书；用户在此之前用别的流程写的
// `正文/第N章 标题.md`、`细纲/` 不会自动出现在面板。这里把「旧稿目录长什么样、
// 哪些文件算章节、章号有没有洞、哪些是 AI 初稿变体」做成可测试的纯逻辑，
// 由 novel_import 的 scan / adopt 两个动作负责 io 与落盘。
//
// 约定：
//   · 只认「第N章」开头的正文文件名（阿拉伯数字或中文数字），md/markdown/txt；
//   · 同一章号有多个文件时优先非草稿（文件名带 AI初稿 的算草稿），仍多份则取第一个
//     并在 duplicates 里报告——绝不静默丢掉别的版本；
//   · 旧稿目录只读，接入时写到新书目录（由工具层负责）。

const CHAPTER_EXT = /\.(md|markdown|txt)$/i;
const CN_NUM = /^[零〇一二三四五六七八九十百千万两]+$/;

const CN_DIGIT = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const CN_UNIT = { 十: 10, 百: 100, 千: 1000 };

/**
 * 中文数字 → 整数（只覆盖章节号规模：一 ~ 九千九百九十九）。
 * @returns {number|null}
 */
export function chineseNumeral(text) {
    const s = String(text ?? '').trim();
    if (s === '') return null;
    if (/^\d+$/.test(s)) return Number(s);
    if (!CN_NUM.test(s)) return null;
    let total = 0;
    let section = 0;
    let digit = 0;
    for (const ch of s) {
        if (Object.hasOwn(CN_DIGIT, ch)) { digit = CN_DIGIT[ch]; continue; }
        if (Object.hasOwn(CN_UNIT, ch)) { section += (digit === 0 ? 1 : digit) * CN_UNIT[ch]; digit = 0; continue; }
        if (ch === '万') { total += (section + digit) * 10000; section = 0; digit = 0; continue; }
        return null;
    }
    const value = total + section + digit;
    return Number.isInteger(value) && value > 0 ? value : null;
}

/** 去掉扩展名（保留原名其余部分）。 */
export function stripChapterExt(name) {
    const raw = String(name ?? '');
    const m = CHAPTER_EXT.exec(raw);
    return m === null ? raw : raw.slice(0, -m[0].length);
}

/**
 * 旧稿正文文件名 → { n, title, draft }；不是章节文件返回 null。
 * 认：`第12章 标题.md`、`第十二章 标题.txt`、`第012章 标题.md`，
 * 标题里带 `_AI初稿`/`（AI初稿）` 的标 draft（同章有定稿时优先定稿）。
 */
export function parseLegacyChapterFile(name) {
    const raw = String(name ?? '').trim();
    if (!CHAPTER_EXT.test(raw)) return null;
    const stem = stripChapterExt(raw);
    const m = /^第\s*([0-9]+|[零〇一二三四五六七八九十百千万两]+)\s*章\s*(.*)$/.exec(stem);
    if (m === null) return null;
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : chineseNumeral(m[1]);
    if (!Number.isInteger(n) || n < 1) return null;
    let rest = m[2].trim();
    const draft = /AI\s*初稿/i.test(rest);
    // 草稿后缀不是标题的一部分：`群演_AI初稿` → `群演`
    rest = rest
        .replace(/[_\-—–（(]\s*AI\s*初稿\s*[)）]?\s*$/i, '')
        .replace(/^[-_.、:：\s]+/, '')
        .trim();
    return { n, title: rest || `第${n}章`, draft };
}

/**
 * 细纲文件名 → 章号（`第27章细纲（AI草稿）.md` → 27）。
 * 「新第1章细纲」不认：那是重排后的新编号，套到旧章号上会错位，由调用方原样保留/跳过。
 * @returns {{n:number, title:string}|null}
 */
export function parseLegacyOutlineFile(name) {
    const raw = String(name ?? '').trim();
    if (!CHAPTER_EXT.test(raw)) return null;
    const stem = stripChapterExt(raw);
    if (/^新/.test(stem)) return null;
    const m = /第\s*([0-9]+|[零〇一二三四五六七八九十百千万两]+)\s*章/.exec(stem);
    if (m === null) return null;
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : chineseNumeral(m[1]);
    if (!Number.isInteger(n) || n < 1) return null;
    return { n, title: stem };
}

/**
 * 把一组文件名整理成接入计划。
 * @returns {{chapters: Array<{n:number,title:string,file:string,draft:boolean,variants:number}>,
 *            duplicates: Array<{n:number,files:string[]}>,
 *            gaps: number[], ignored: string[]}}
 */
export function planLegacyChapters(names) {
    const byN = new Map();
    const ignored = [];
    for (const name of names ?? []) {
        const parsed = parseLegacyChapterFile(name);
        if (parsed === null) { ignored.push(String(name)); continue; }
        if (!byN.has(parsed.n)) byN.set(parsed.n, []);
        byN.get(parsed.n).push({ ...parsed, file: String(name) });
    }
    const chapters = [];
    const duplicates = [];
    for (const [n, entries] of [...byN.entries()].sort((a, b) => a[0] - b[0])) {
        const chosen = entries.find((e) => !e.draft) ?? entries[0];
        chapters.push({ n, title: chosen.title, file: chosen.file, draft: chosen.draft, variants: entries.length });
        if (entries.length > 1) duplicates.push({ n, files: entries.map((e) => e.file) });
    }
    const present = new Set(chapters.map((c) => c.n));
    const max = chapters.length === 0 ? 0 : chapters[chapters.length - 1].n;
    const gaps = [];
    for (let i = 1; i <= max; i += 1) if (!present.has(i)) gaps.push(i);
    return { chapters, duplicates, gaps, ignored };
}

/** 旧稿正文目录里值得尝试的「正文目录名」（含番茄版等变体）。 */
export const CHAPTER_DIR_NAMES = ['正文', '正文_番茄版', '某茄版', '章节', 'chapters'];

/**
 * 从目录条目里挑「最像正文」的子目录：先精确「正文」，再以「正文」开头的变体。
 * @param {string[]} dirNames
 * @returns {string|null}
 */
export function pickChapterDir(dirNames) {
    const names = (dirNames ?? []).map(String);
    for (const exact of CHAPTER_DIR_NAMES) if (names.includes(exact)) return exact;
    return names.find((name) => /^正文/.test(name)) ?? null;
}

/** 从目录条目里挑「最像细纲」的子目录。 */
export function pickOutlineDir(dirNames) {
    const names = (dirNames ?? []).map(String);
    for (const exact of ['细纲', '章节细纲', '大纲/细纲']) if (names.includes(exact)) return exact;
    return names.find((name) => /细纲/.test(name)) ?? null;
}
