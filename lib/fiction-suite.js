// lib/fiction-suite.js — fiction-suite 模板对照（纯函数，零 io）。
//
// 工作区扫描不靠文件名硬猜：把项目里 md/txt 的标题结构与 fiction-suite 的
// assets/*.md 模板对照，命中「基本设定 / 力量体系 / 基本信息 / 章节分解表 …」
// 的文本才认为是同类内容，再填进工作台「相似内容」并补五槽位。
//
// 本文件只做文本结构解析/打分；读 skill 文件由 server-routes/discover.js 走 ctx.fs。

/**
 * fiction-suite 认可的五类模板。file 相对 skill 根目录。
 * fallbackSections 是 skill 不在本机时的最低可用结构（与真实模板保持同义）。
 */
export const FICTION_SUITE_TEMPLATES = [
    {
        id: 'world-building', role: 'setting', label: '设定圣经模板',
        file: 'assets/world-building-template.md',
        fallbackSections: ['基本设定', '力量 / 等级体系', '核心规则', '关键地点', '特殊设定补充'],
        assignable: true,
    },
    {
        id: 'outline', role: 'outline', label: '全书大纲模板',
        file: 'assets/outline-template.md',
        fallbackSections: ['基本信息', '力量 / 等级体系', '主线走向', '关键转折点', '爽点总谱'],
        assignable: true,
    },
    {
        id: 'volume-plan', role: 'outline', label: '分卷规划模板',
        file: 'assets/volume-plan-template.md',
        fallbackSections: ['本卷核心目标', '章节分解表', '高潮节点', '新角色 / 新地点', '伏笔规划'],
        assignable: true,
    },
    {
        id: 'character-card', role: 'characters', label: '人物卡模板',
        file: 'assets/character-card-template.md',
        fallbackSections: ['基础信息', '外貌描述', '性格设定'],
        assignable: true,
    },
    {
        id: 'chapter', role: 'chapterOutline', label: '章节模板',
        file: 'assets/chapter-template.md',
        fallbackSections: ['开头', '发展', '高潮', '收尾'],
        assignable: true,
    },
    {
        id: 'file-layout', role: 'notes', label: '目录契约',
        file: 'references/write-file-layout.md',
        fallbackSections: ['正文', '细纲', '分卷大纲', '设定圣经', '角色语言指纹'],
        assignable: false,
    },
];

/** 标题归一化：去掉模板占位符、编号、尾部冒号，用于跨文件对照。 */
export function normalizeHeading(raw) {
    return String(raw ?? '')
        .replace(/^#{1,6}\s*/, '')
        .replace(/\[[^\]]*\]/g, '')
        .replace(/[（(][^）)]*[)）]/g, '')
        .replace(/[·•].*$/, '')
        .replace(/[：:]\s*$/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** 从 Markdown 模板抽章节标题；标题行之外的表格/占位符不算。 */
export function parseTemplateText(text, meta = {}) {
    const headings = String(text ?? '').split(/\r?\n/)
        .map((line) => /^#{1,4}\s+.+$/.test(line.trim()) ? normalizeHeading(line) : '')
        .filter(Boolean);
    const sections = [...new Set(headings)];
    return { ...meta, sections: sections.length ? sections : [...(meta.fallbackSections ?? [])] };
}

function includesHeading(text, heading) {
    const h = normalizeHeading(heading);
    if (h === '') return false;
    const t = String(text ?? '').replace(/\s+/g, ' ');
    return t.includes(h);
}

/**
 * 一段文本对一组模板打分。
 * @returns {Array<{templateId,role,label,score,hits,missing,assignable}>} 按分数降序
 */
export function matchTemplates(text, specs = []) {
    const src = String(text ?? '');
    const out = [];
    for (const spec of specs) {
        const sections = [...new Set((spec.sections ?? []).map(normalizeHeading).filter(Boolean))];
        if (!sections.length) continue;
        const hits = sections.filter((s) => includesHeading(src, s));
        const missing = sections.filter((s) => !hits.includes(s));
        out.push({
            templateId: spec.id,
            role: spec.role,
            label: spec.label,
            score: Math.round((hits.length / sections.length) * 100),
            hits,
            missing,
            assignable: spec.assignable !== false,
        });
    }
    return out.sort((a, b) => b.score - a.score || a.templateId.localeCompare(b.templateId));
}

const HINT_LABELS = [
    ['bookTitle', /(?:书名|作品名|标题)\s*[:：]\s*(.+)/],
    ['genre', /(?:题材|类型|genre)\s*[:：]\s*(.+)/i],
    ['worldName', /(?:世界名|世界观名)\s*[:：]\s*(.+)/],
    ['plannedChapters', /(?:预计章节数|计划章节数|总章节数)\s*[:：]\s*(\d+)/],
    ['chapterChars', /(?:单章字数|每章字数)\s*[:：]\s*([0-9０-９~～\-–—\s]+)/],
];

/** 从大纲/设定模板片段里抽可预填字段（只认显式标签，不猜）。 */
export function extractTemplateHints(text) {
    const out = {};
    const lines = String(text ?? '').split(/\r?\n/);
    for (const line of lines) {
        for (const [key, re] of HINT_LABELS) {
            if (out[key] !== undefined) continue;
            const m = re.exec(line.trim());
            if (m) out[key] = String(m[1]).trim().replace(/[《》]/g, '').trim();
        }
    }
    if (out.bookTitle === '') delete out.bookTitle;
    return out;
}

/**
 * 读一段内容 → 最佳可分配模板 + 相似内容摘要。
 * @param {string} text
 * @param {Array} specs
 * @param {number} threshold 默认可分配最低分；低于它只保留为弱匹配
 */
export function inspectContent(text, specs, threshold = 40) {
    const matches = matchTemplates(text, specs);
    const best = matches.find((m) => m.assignable && m.score >= threshold) ?? null;
    return {
        best,
        matches: matches.filter((m) => m.score > 0).slice(0, 3),
        hints: extractTemplateHints(text),
    };
}

/** 内容角色 → 五槽位标签（供 server 路由补映射；与 discovery 的 role label 一致）。 */
export const CONTENT_ROLE_LABELS = {
    setting: '设定 / 圣经',
    outline: '大纲',
    characters: '人物卡',
    chapterOutline: '细纲',
};
