// lib/harvest.js — 会话采风：把「当前会话」交给模型提炼成书的设定。
//
// 产品形态（用户 2026-11-11）：读当前会话、消耗 token、自己建新书或扩充旧书。
// 这里只做三件事：
//   ① 从 Session.deriveMessages() 里抽取 user/assistant 文本（有界，默认最近 12000 字）；
//   ② 一次模型调用（engine 通道 harvest）要求输出严格 JSON；
//   ③ 把 JSON 经过白名单校验后落库：新书 init 一套 / 旧书只增不覆盖。
// 不生成正文、不写会话、不改账本——提取的是「设定与大纲」，写章仍走既有门禁。
//
// 纯函数与 io 分离：extractTranscript / buildHarvestPrompt / parseHarvestJson /
// normalizeHarvest 可在 node --test 直测；落库只在 applyHarvest。

import { tmpdir } from 'node:os';
import {
    defaultNovel, pathsFor, normalizeWorldEntry, deriveEntryKeywords,
} from './store.js';
import { upsertTerm } from './glossary.js';
import { requireBook, saveBook, audit } from './tools/common.js';

export const HARVEST_CHANNEL = 'harvest';
export const HARVEST_MAX_TOKENS = 0;
export const HARVEST_TIMEOUT_MS = 300000;
// 结构化输出 schema：DSH 0.2.x 的 subagent 支持 outputSchema，子代理必须调用内置
// structured_output 工具提交结果——比「提示词求它输出 JSON」可靠（真机实测模型会
// 写成英文推理/散文，parse 必炸）。字段保持宽松，落库前仍走 normalizeHarvest 白名单。
export const HARVEST_OUTPUT_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'genre', 'logline', 'promise', 'characters', 'worldbook', 'glossary', 'outline'],
    properties: {
        title: { type: 'string' },
        genre: { type: 'string' },
        logline: { type: 'string' },
        promise: { type: 'string' },
        characters: {
            type: 'array',
            items: {
                type: 'object', additionalProperties: false, required: ['name', 'card'],
                properties: { name: { type: 'string' }, card: { type: 'string' } },
            },
        },
        worldbook: {
            type: 'array',
            items: {
                type: 'object', additionalProperties: false,
                required: ['title', 'keywords', 'content', 'always'],
                properties: {
                    title: { type: 'string' },
                    keywords: { type: 'array', items: { type: 'string' } },
                    content: { type: 'string' },
                    always: { type: 'boolean' },
                },
            },
        },
        glossary: {
            type: 'array',
            items: {
                type: 'object', additionalProperties: false, required: ['term', 'definition'],
                properties: { term: { type: 'string' }, definition: { type: 'string' } },
            },
        },
        outline: { type: 'string' },
    },
};
export const DEFAULT_TRANSCRIPT_CHARS = 12000;
export const MIN_TRANSCRIPT_CHARS = 400;
export const MAX_TRANSCRIPT_CHARS = 40000;
export const MIN_TRANSCRIPT_MESSAGES = 1;

/** 单条消息 content（string / 文本块数组）→ 纯文本；工具调用等非文本块丢弃。 */
export function textOfContent(content) {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    const parts = [];
    for (const block of content) {
        if (typeof block === 'string') { parts.push(block); continue; }
        if (!block || typeof block !== 'object') continue;
        if (block.type === 'text' && typeof block.text === 'string') parts.push(block.text);
    }
    return parts.join('\n');
}

/**
 * 会话消息 → 有界文本记录。只保留 user/assistant 文本；从最新往回取，
 * 保证「最近发生的事」优先进入模型（早期寒暄最没有提取价值）。
 * @returns {{text, chars, totalChars, messages, kept}}
 */
export function extractTranscript(messages, { maxChars = DEFAULT_TRANSCRIPT_CHARS } = {}) {
    const cap = Math.max(MIN_TRANSCRIPT_CHARS, Math.min(MAX_TRANSCRIPT_CHARS, Number(maxChars) || DEFAULT_TRANSCRIPT_CHARS));
    const rows = [];
    let totalChars = 0;
    for (const m of Array.isArray(messages) ? messages : []) {
        const role = String(m?.role ?? '');
        if (role !== 'user' && role !== 'assistant') continue;
        const text = textOfContent(m?.content).trim();
        if (text === '') continue;
        totalChars += text.length;
        rows.push({ role, text });
    }
    const selected = [];
    let used = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        const block = `【${row.role === 'user' ? '用户' : '助手'}】${row.text}`;
        const remaining = cap - used;
        if (block.length <= remaining) {
            selected.unshift(block);
            used += block.length + 2;
            continue;
        }
        // 最近的一条就超预算：截它尾部（最新内容优先）；更早的超预算块：
        // 能塞多少塞多少，然后停——不要因为一条超长助手消息把整个会话丢成 0 字。
        if (remaining > 80) selected.unshift(block.slice(-remaining));
        break;
    }
    const text = selected.join('\n\n');
    return {
        text,
        chars: text.length,
        totalChars,
        messages: rows.length,
        kept: selected.length,
        // 裁剪掉最早一部分时给调用方一个明确标记（提示词里也会说明）。
        truncated: selected.length < rows.length,
    };
}

export function transcriptFromSession(session, opts = {}) {
    const derive = session?.deriveMessages;
    if (typeof derive !== 'function') {
        throw Object.assign(new Error('拿不到会话消息：当前上下文没有 session.deriveMessages()'), { code: 'NO_SESSION_MESSAGES' });
    }
    let messages;
    try { messages = derive.call(session); } catch (error) {
        throw Object.assign(new Error(`读取会话消息失败：${String(error?.message ?? error)}`), { code: 'SESSION_READ_FAILED' });
    }
    const out = extractTranscript(messages, opts);
    if (out.chars < MIN_TRANSCRIPT_CHARS || out.kept < MIN_TRANSCRIPT_MESSAGES) {
        throw Object.assign(new Error(`会话内容太少（${out.chars} 字 / ${out.kept} 条消息）——先在会话里聊出人物、世界观或剧情，再回来提取`), { code: 'TRANSCRIPT_TOO_SHORT' });
    }
    return out;
}

export const HARVEST_SYSTEM = [
    '你是长篇小说设定整理器。任务：从给定的会话记录里抽取可以落库的故事设定。',
    '硬要求：',
    '1. 只输出一个 JSON 对象，不要 Markdown 代码围栏、不要解释、不要前后缀。',
    '2. **必须是完整可解析的 JSON**：禁止用 `...` 省略任何字段或数组；空数组写 []；所有键和字符串用双引号；不要写注释。',
    '3. 只提取会话里明确出现或可靠推断的信息；不确定就省略，绝不编造。',
    '4. 世界书条目 content 写「是什么 + 为什么 + 对故事的影响」，不要只写名词解释。',
    '5. 人物卡的 card 用 Markdown，包含外在底色 / 隐性欲望 / 与主角关系；不要写正文。',
    '6. outline 是全书大纲（Markdown），按卷/阶段写，不要写成章节正文。',
    '7. 输出总长度控制在 8000 字以内；重复内容合并。',
].join('\n');

function listNames(items, key) {
    return (Array.isArray(items) ? items : []).map((x) => String(x?.[key] ?? '').trim()).filter(Boolean);
}

/**
 * 提示词：mode=new 允许给 title/genre/logline/promise；mode=enrich 只输出增量。
 * existing 只放「名字/标题/术语」这类去重用的轻量索引，不放全文（省 token）。
 */
export function buildHarvestPrompt({ mode = 'new', transcript, book, existing = null, maxChars = DEFAULT_TRANSCRIPT_CHARS }) {
    const enrich = mode === 'enrich';
    const lines = [];
    lines.push(`【模式】${enrich ? '扩充已有书（只输出新增信息，不要重复已有条目）' : '从零建立新书（输出完整的一套设定）'}`);
    lines.push(`【目标书目】${book}`);
    if (enrich && existing) {
        lines.push(`【已有角色】${existing.cast.length ? existing.cast.join('、') : '（无）'}`);
        lines.push(`【已有世界书】${existing.worldbook.length ? existing.worldbook.join('、') : '（无）'}`);
        lines.push(`【已有术语】${existing.glossary.length ? existing.glossary.join('、') : '（无）'}`);
        lines.push(`【已有大纲字数】${existing.outlineChars}`);
    }
    lines.push('');
    lines.push('【输出 JSON 结构】（以下字段说明只是格式指引，不要照抄文字，也不要用 ... 省略）');
    lines.push(JSON.stringify({
        title: '书名',
        genre: '题材',
        logline: '作品简介',
        promise: '故事承诺书',
        characters: [{ name: '人物名', card: '人物卡 Markdown' }],
        worldbook: [{ title: '条目名', keywords: ['触发词'], content: '设定内容', always: false }],
        glossary: [{ term: '专有名词', definition: '定义' }],
        outline: '全书大纲 Markdown',
    }, null, 2));
    lines.push('');
    lines.push(`【会话记录】（有界截取：最近 ${maxChars} 字${transcript.truncated ? '，更早内容已截断' : ''}）`);
    lines.push(transcript.text);
    return lines.join('\n');
}

/** 去掉代码围栏/前后噪音，解析第一个 JSON 对象。 */
export function parseHarvestJson(raw) {
    const text = String(raw ?? '').trim();
    if (text === '') throw Object.assign(new Error('模型返回为空'), { code: 'EMPTY_OUTPUT' });
    const unfenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const start = unfenced.indexOf('{');
    const end = unfenced.lastIndexOf('}');
    if (start < 0 || end <= start) throw Object.assign(new Error('模型输出里找不到 JSON 对象'), { code: 'INVALID_OUTPUT' });
    let data;
    try { data = JSON.parse(unfenced.slice(start, end + 1)); }
    catch (error) { throw Object.assign(new Error(`模型输出的 JSON 解析失败：${String(error?.message ?? error)}`), { code: 'INVALID_OUTPUT' }); }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        throw Object.assign(new Error('模型输出不是 JSON 对象'), { code: 'INVALID_OUTPUT' });
    }
    return data;
}

const clip = (value, max) => String(value ?? '').trim().slice(0, max);

/**
 * 白名单校验 + 上限裁剪。返回 discarded（被丢掉/合并的条数）供审计，
 * 绝不把模型给的任意字段直接写进文件。
 */
export function normalizeHarvest(raw, { mode = 'new' } = {}) {
    const data = raw && typeof raw === 'object' ? raw : {};
    const warnings = [];
    const discarded = { characters: 0, worldbook: 0, glossary: 0 };
    const characters = [];
    for (const c of Array.isArray(data.characters) ? data.characters : []) {
        const name = clip(c?.name, 40);
        const card = clip(c?.card, 4000);
        if (name === '' || card === '' || /[\\/]/.test(name) || name.startsWith('.')) { discarded.characters++; continue; }
        if (characters.some((x) => x.name === name)) continue;
        characters.push({ name, card });
        if (characters.length >= 12) break;
    }
    const worldbook = [];
    for (const e of Array.isArray(data.worldbook) ? data.worldbook : []) {
        const content = clip(e?.content, 1500);
        if (content === '') { discarded.worldbook++; continue; }
        const keywords = (Array.isArray(e?.keywords) ? e.keywords : []).map((k) => clip(k, 30)).filter(Boolean).slice(0, 8);
        const title = clip(e?.title, 60);
        if (worldbook.some((x) => x.content === content)) continue;
        worldbook.push({ title, keywords, content, always: Boolean(e?.always) });
        if (worldbook.length >= 20) break;
    }
    const glossary = [];
    for (const t of Array.isArray(data.glossary) ? data.glossary : []) {
        const term = clip(t?.term, 40);
        const definition = clip(t?.definition, 300);
        if (term === '' || definition === '') { discarded.glossary++; continue; }
        if (glossary.some((x) => x.term === term)) continue;
        glossary.push({ term, definition });
        if (glossary.length >= 30) break;
    }
    const outline = clip(data.outline, 30000);
    if (String(data.outline ?? '').length > 30000) warnings.push('大纲超过 30000 字，已截断');
    const normalized = {
        title: clip(data.title, 80),
        genre: clip(data.genre, 40),
        logline: clip(data.logline, 500),
        promise: clip(data.promise, 2000),
        characters, worldbook, glossary, outline,
    };
    if (mode === 'new' && normalized.title === '') warnings.push('模型没有给出书名，将使用书目名');
    return { data: normalized, warnings, discarded };
}

/** 当前书的去重索引（轻量，只给名字/标题，不塞全文）。 */
export async function readExistingIndex(io, p) {
    const novel = (await io.readJson(p.meta)) ?? {};
    const worldbook = (await io.readJson(p.worldbook)) ?? [];
    const glossary = (await io.readJson(p.glossary)) ?? [];
    const outline = (await io.readText(p.bookOutline)) ?? '';
    return {
        cast: Array.isArray(novel.cast) ? novel.cast : [],
        worldbook: (Array.isArray(worldbook) ? worldbook : []).map((e) => String(e?.keywords?.[0] ?? e?.id ?? '')).filter(Boolean),
        glossary: (Array.isArray(glossary) ? glossary : []).map((t) => String(t?.term ?? '')).filter(Boolean),
        outlineChars: outline.length,
    };
}

function countsOf(data) {
    return {
        characters: data.characters.length,
        worldbook: data.worldbook.length,
        glossary: data.glossary.length,
        outlineChars: data.outline.length,
        promise: data.promise.length > 0,
    };
}

/**
 * 落库。new：不存在才建；enrich：只增不覆盖（overwrite/appendOutline 显式开关）。
 * @returns {{created, counts, warnings}}
 */
export async function applyHarvest(io, book, data, { mode = 'new', sessionId = null, overwrite = false, appendOutline = false } = {}) {
    const p = pathsFor(book);
    const warnings = [];
    if (mode === 'new') {
        const exists = await io.readJson(p.meta).catch(() => null);
        if (exists !== null) {
            throw Object.assign(new Error(`书目「${book}」已存在——要补充旧书请用 mode=enrich`), { code: 'BOOK_EXISTS' });
        }
        const novel = defaultNovel({
            title: data.title || book,
            genre: data.genre || '未定题材',
            logline: data.logline,
            session: sessionId,
        });
        await io.writeJson(p.meta, novel, 'create');
        if (data.promise) await io.writeText(p.promise, `${data.promise}\n`, 'auto');
        if (data.outline) await io.writeText(p.bookOutline, `${data.outline}\n`, 'auto');
        for (const c of data.characters) {
            await io.writeText(p.character(c.name), `${c.card.trim()}\n`, 'auto');
            novel.cast.push(c.name);
        }
        if (data.worldbook.length) {
            const entries = [];
            for (const e of data.worldbook) {
                let keywords = e.keywords;
                if (keywords.length === 0) keywords = deriveEntryKeywords(e.content, novel.cast);
                const always = e.always || keywords.length === 0;
                entries.push(normalizeWorldEntry({ keywords, content: e.content, always }, entries));
            }
            await io.writeJson(p.worldbook, entries);
        }
        if (data.glossary.length) {
            let terms = [];
            for (const t of data.glossary) terms = upsertTerm(terms, t);
            await io.writeJson(p.glossary, terms);
        }
        await saveBook(io, p, novel);
        await audit(io, p, 'session-harvest/new', {
            session: sessionId ?? undefined, ...countsOf(data),
        });
        return { created: true, counts: countsOf(data), warnings };
    }

    // —— enrich：只增不覆盖 ——
    const { novel } = await requireBook(io, book);
    let changed = false;
    let addedCharacters = 0;
    for (const c of data.characters) {
        const exists = novel.cast.includes(c.name);
        if (exists && !overwrite) continue;
        await io.writeText(p.character(c.name), `${c.card.trim()}\n`, 'auto');
        if (!exists) novel.cast.push(c.name);
        addedCharacters++;
        changed = true;
    }
    let addedWorld = 0;
    if (data.worldbook.length) {
        const entries = (await io.readJson(p.worldbook)) ?? [];
        const before = entries.length;
        for (const e of data.worldbook) {
            if (!overwrite && entries.some((x) => String(x?.content ?? '').trim() === e.content)) continue;
            let keywords = e.keywords;
            if (keywords.length === 0) keywords = deriveEntryKeywords(e.content, [...novel.cast, ...entries.map((x) => String(x?.keywords?.[0] ?? '')).filter(Boolean)]);
            const always = e.always || keywords.length === 0;
            try { entries.push(normalizeWorldEntry({ keywords, content: e.content, always }, entries)); }
            catch (error) { warnings.push(`世界书条目跳过：${String(error?.message ?? error)}`); }
        }
        if (entries.length !== before) { await io.writeJson(p.worldbook, entries); addedWorld = entries.length - before; changed = true; }
    }
    let addedTerms = 0;
    let termsChanged = false;
    if (data.glossary.length) {
        let terms = (await io.readJson(p.glossary)) ?? [];
        const before = terms.length;
        for (const t of data.glossary) {
            const exists = terms.some((x) => x?.term === t.term);
            if (exists && !overwrite) continue;
            terms = upsertTerm(terms, t);
            termsChanged = true;
        }
        if (termsChanged) {
            await io.writeJson(p.glossary, terms);
            addedTerms = Math.max(0, terms.length - before);
            changed = true;
        }
    }
    let outlineWritten = false;
    if (data.outline) {
        const existing = (await io.readText(p.bookOutline)) ?? '';
        if (existing.trim() === '') { await io.writeText(p.bookOutline, `${data.outline}\n`, 'auto'); outlineWritten = true; changed = true; }
        else if (appendOutline) {
            await io.writeText(p.bookOutline, `${existing.replace(/\s+$/, '')}\n\n---\n\n## 会话采风追加\n\n${data.outline}\n`, 'replace');
            outlineWritten = true; changed = true;
        } else warnings.push('已有全书大纲，本次提取的大纲未写入（需要追加请传 appendOutline:true）');
    }
    let promiseWritten = false;
    if (data.promise) {
        const existing = (await io.readText(p.promise)) ?? '';
        if (existing.trim() === '' || overwrite) {
            await io.writeText(p.promise, `${data.promise}\n`, overwrite ? 'replace' : 'auto');
            promiseWritten = true; changed = true;
        } else warnings.push('已有故事承诺书，未覆盖（需要覆盖请传 overwrite:true）');
    }
    if (data.logline && (!novel.logline || overwrite)) { novel.logline = data.logline; changed = true; }
    if (changed) await saveBook(io, p, novel);
    await audit(io, p, 'session-harvest/enrich', {
        session: sessionId ?? undefined, characters: addedCharacters, worldbook: addedWorld,
        glossary: addedTerms, outline: outlineWritten, promise: promiseWritten,
    });
    return {
        created: false,
        counts: { characters: addedCharacters, worldbook: addedWorld, glossary: addedTerms, outlineChars: outlineWritten ? data.outline.length : 0, promise: promiseWritten },
        warnings,
    };
}

function usageSummary(usage) {
    if (!usage || typeof usage !== 'object') return { input: 0, output: 0, total: 0 };
    const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
    const input = num(usage.inputTokens ?? usage.input_tokens ?? usage.promptTokens ?? usage.prompt_tokens);
    const output = num(usage.outputTokens ?? usage.output_tokens ?? usage.completionTokens ?? usage.completion_tokens);
    const total = num(usage.totalTokens ?? usage.total_tokens) || input + output;
    return { input, output, total };
}

/**
 * 一次完整采风：会话文本 → 模型 → 解析 → 落库/预览。
 * @param {object} args.engine 已装配的 D1 引擎
 * @param {object} args.io fsio
 * @param {object} args.session live Session（有 deriveMessages）
 * @param {string} args.book
 * @param {'new'|'enrich'} args.mode
 * @param {boolean} [args.dryRun]
 */
export async function runHarvest({ engine, io, session, sessionId, book, mode = 'new', maxChars = DEFAULT_TRANSCRIPT_CHARS, dryRun = false, overwrite = false, appendOutline = false, llm = null, route = null }) {
    if (!engine) throw Object.assign(new Error('模型引擎不可用（本环境没有可用的模型服务）'), { code: 'ENGINE_UNAVAILABLE' });
    const transcript = transcriptFromSession(session, { maxChars });
    let existing = null;
    if (mode === 'enrich') {
        const p = pathsFor(book);
        const novel = await io.readJson(p.meta).catch(() => null);
        if (novel === null) throw Object.assign(new Error(`书目「${book}」不存在——要新建请用 mode=new`), { code: 'BOOK_NOT_FOUND' });
        existing = await readExistingIndex(io, p);
    }
    const prompt = buildHarvestPrompt({ mode, transcript, book, existing, maxChars });
    const result = await engine.run(HARVEST_CHANNEL, {
        system: HARVEST_SYSTEM,
        prompt,
        maxTokens: HARVEST_MAX_TOKENS,
        timeoutMs: HARVEST_TIMEOUT_MS,
        outputSchema: HARVEST_OUTPUT_SCHEMA,
        // 结构化子代理会在临时目录里跑：它继承完整工具集，万一模型乱用工具，
        // 也不会在用户工作区里造书/改稿。
        cwd: tmpdir(),
        ...(llm ? { llm } : {}),
        ...(route ? { route } : {}),
        ...(sessionId ? { sessionId, sessionIds: [sessionId] } : {}),
    });
    if (!result?.ok) {
        const e = result?.error ?? {};
        throw Object.assign(new Error(`模型调用失败（${e.code ?? 'ENGINE_FAILURE'}）：${e.message ?? '未知错误'}`), {
            code: e.code ?? 'ENGINE_FAILURE', advice: e.advice ?? '',
        });
    }
    let parsed;
    try {
        parsed = normalizeHarvest(parseHarvestJson(result.text), { mode });
    } catch (error) {
        error.message = `${error.message}（模型输出开头：${JSON.stringify(String(result.text ?? '').slice(0, 240))}）`;
        throw error;
    }
    const counts = countsOf(parsed.data);
    const usage = usageSummary(result.usage);
    const routeView = result.route && typeof result.route === 'object'
        ? { provider: String(result.route.provider ?? ''), model: String(result.route.model ?? ''), source: String(result.route.source ?? '') }
        : { provider: '', model: '', source: '' };
    const base = {
        mode, book, sessionId: sessionId ?? null,
        transcriptChars: transcript.chars, messageCount: transcript.kept, truncated: transcript.truncated,
        usage, route: routeView,
        preview: parsed.data,
        warnings: parsed.warnings,
        discarded: parsed.discarded,
    };
    if (dryRun) return { ...base, dryRun: true, created: false, counts };
    const applied = await applyHarvest(io, book, parsed.data, { mode, sessionId, overwrite, appendOutline });
    return { ...base, dryRun: false, created: applied.created, counts: applied.counts, warnings: [...parsed.warnings, ...applied.warnings] };
}
