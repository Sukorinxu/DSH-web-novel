// 会话采风纯逻辑 + 落库（假 io）单测。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    extractTranscript, parseHarvestJson, normalizeHarvest,
    buildHarvestPrompt, applyHarvest, DEFAULT_TRANSCRIPT_CHARS,
} from '../lib/harvest.js';
import { configureLayout } from '../lib/layout.js';
import { pathsFor } from '../lib/store.js';

function memIo() {
    const files = new Map();
    return {
        sessionId: 'sess-test',
        files,
        async readText(p) { return files.has(p) ? files.get(p) : null; },
        async writeText(p, v) { files.set(p, String(v)); return { written: true, version: 'v1' }; },
        async readJson(p) { const t = files.get(p); return t === undefined ? null : JSON.parse(t); },
        async writeJson(p, v, mode) {
            if (mode === 'create' && files.has(p)) throw Object.assign(new Error('exists'), { code: 'ALREADY_EXISTS' });
            files.set(p, JSON.stringify(v)); return { written: true, version: 'v1' };
        },
        async appendLine(p, line) { files.set(p, (files.get(p) ?? '') + String(line) + '\n'); },
    };
}

test('extractTranscript：只取 user/assistant、从最近往回裁剪、保留文本块', () => {
    const messages = [
        { role: 'system', content: 'sys' },
        { role: 'user', content: '第一句'.repeat(200) },
        { role: 'assistant', content: [{ type: 'text', text: '第二句' }, { type: 'tool-call', name: 'x' }] },
        { role: 'tool', content: '工具结果不应进来' },
        { role: 'user', content: [{ type: 'text', text: '第三句' }] },
    ];
    const all = extractTranscript(messages, { maxChars: 40000 });
    assert.match(all.text, /第一句/);
    assert.match(all.text, /第二句/);
    assert.match(all.text, /第三句/);
    assert.doesNotMatch(all.text, /工具结果/);
    assert.doesNotMatch(all.text, /【system】/);
    const bounded = extractTranscript(messages, { maxChars: 400 });
    assert.ok(bounded.chars <= 400);
    assert.ok(bounded.kept < all.kept || bounded.truncated === false, '裁剪后消息条数应减少或本就不多');
    assert.ok(bounded.truncated || bounded.kept === all.kept);
    assert.ok(all.totalChars > 0);
    assert.equal(DEFAULT_TRANSCRIPT_CHARS, 12000);
});

test('parseHarvestJson：容忍 ```json 围栏与前后解释', () => {
    const obj = parseHarvestJson('好的，结果如下：\n```json\n{"title":"夜航","characters":[]}\n```\n以上。');
    assert.equal(obj.title, '夜航');
    assert.throws(() => parseHarvestJson('没有 JSON'), /找不到 JSON/);
    assert.throws(() => parseHarvestJson('{坏 json}'), /解析失败/);
});

test('normalizeHarvest：白名单 + 上限 + 丢弃非法条目', () => {
    const { data, warnings, discarded } = normalizeHarvest({
        title: 'x'.repeat(200),
        characters: [
            { name: '沈砚', card: '### 外在\n冷静' },
            { name: '../逃逸', card: 'bad' },
            { name: '沈砚', card: '重复' },
            { name: '', card: '无名' },
        ],
        worldbook: [
            { keywords: ['城港'], content: '雾气中的港口城市' },
            { keywords: [], content: '' },
        ],
        glossary: [{ term: '长夜行', definition: '一场没有回头的航行' }, { term: '', definition: 'x' }],
        outline: '## 卷一\n开端',
        ignored: '不该出现',
    }, { mode: 'new' });
    assert.equal(data.title.length, 80);
    assert.deepEqual(data.characters.map((c) => c.name), ['沈砚']);
    assert.equal(data.worldbook.length, 1);
    assert.equal(data.glossary.length, 1);
    assert.equal(data.outline, '## 卷一\n开端');
    assert.equal(data.ignored, undefined, '未知字段不得进入落库数据');
    assert.ok(discarded.characters >= 2);
    assert.ok(discarded.worldbook >= 1);
    assert.ok(discarded.glossary >= 1);
    assert.ok(Array.isArray(warnings));
});

test('buildHarvestPrompt：带模式/目标/会话文本，enrich 带已有索引', () => {
    const transcript = { text: '【用户】沈砚是个守灯人', chars: 12, truncated: false };
    const newPrompt = buildHarvestPrompt({ mode: 'new', transcript, book: '长夜行' });
    assert.match(newPrompt, /从零建立新书/);
    assert.match(newPrompt, /长夜行/);
    assert.match(newPrompt, /沈砚是个守灯人/);
    const enrichPrompt = buildHarvestPrompt({ mode: 'enrich', transcript, book: '长夜行', existing: {
        cast: ['沈砚'], worldbook: ['城港'], glossary: ['长夜行'], outlineChars: 1200,
    } });
    assert.match(enrichPrompt, /只输出新增信息/);
    assert.match(enrichPrompt, /已有角色.*沈砚/);
});

test('applyHarvest(new)：建 novel.json + 人物/世界书/术语/大纲/承诺书', async () => {
    configureLayout({ layout: 'forge', versioning: 'auto' });
    const io = memIo();
    const result = await applyHarvest(io, '夜航书', {
        title: '夜航', genre: '悬疑', logline: '一句话',
        promise: '承诺', outline: '## 大纲',
        characters: [{ name: '沈砚', card: '### 外在\n守灯人' }],
        worldbook: [{ title: '城港', keywords: ['城港'], content: '雾里的港口', always: false }],
        glossary: [{ term: '长夜行', definition: '航行' }],
    }, { mode: 'new', sessionId: 'sess-test' });
    assert.equal(result.created, true);
    const p = pathsFor('夜航书');
    const novel = await io.readJson(p.meta);
    assert.equal(novel.title, '夜航');
    assert.deepEqual(novel.sessions, ['sess-test']);
    assert.ok(novel.cast.includes('沈砚'));
    assert.match(await io.readText(p.character('沈砚')), /守灯人/);
    assert.equal((await io.readJson(p.worldbook))[0].content, '雾里的港口');
    assert.equal((await io.readJson(p.glossary))[0].term, '长夜行');
    assert.equal(await io.readText(p.promise), '承诺\n');
    assert.equal(await io.readText(p.bookOutline), '## 大纲\n');
    assert.ok(await io.readText(p.audit));
});

test('applyHarvest(enrich)：默认只增不覆盖、重复条目跳过；overwrite 才更新', async () => {
    configureLayout({ layout: 'forge', versioning: 'auto' });
    const io = memIo();
    await applyHarvest(io, '旧书', {
        title: '旧书', genre: '悬疑', logline: '', promise: '',
        outline: '', characters: [{ name: '沈砚', card: '旧卡' }],
        worldbook: [{ title: '城港', keywords: ['城港'], content: '旧设定', always: false }],
        glossary: [{ term: '长夜行', definition: '旧定义' }],
    }, { mode: 'new', sessionId: 'sess-test' });
    const p = pathsFor('旧书');
    const enriched = await applyHarvest(io, '旧书', {
        title: '', genre: '', logline: '新立意', promise: '新承诺', outline: '',
        characters: [{ name: '沈砚', card: '新卡' }, { name: '陆师傅', card: '守灯人' }],
        worldbook: [{ title: '城港', keywords: ['城港'], content: '旧设定', always: false }, { title: '铜钥匙', keywords: ['钥匙'], content: '生锈的铜钥匙', always: false }],
        glossary: [{ term: '长夜行', definition: '新定义' }, { term: '灯芯', definition: '湿的' }],
    }, { mode: 'enrich', sessionId: 'sess-test' });
    assert.equal(enriched.created, false);
    assert.equal(enriched.counts.characters, 1, '已有沈砚默认跳过，只新增陆师傅');
    assert.match(await io.readText(p.character('沈砚')), /旧卡/);
    assert.match(await io.readText(p.character('陆师傅')), /守灯人/);
    const wb = await io.readJson(p.worldbook);
    assert.equal(wb.length, 2, '重复内容的世界书条目必须跳过');
    const terms = await io.readJson(p.glossary);
    assert.equal(terms.length, 2);
    assert.equal(terms.find((t) => t.term === '长夜行').definition, '旧定义', '默认不覆盖术语');
    assert.equal(await io.readText(p.promise), '新承诺\n', '已有空承诺书时补写');
    assert.equal((await io.readJson(p.meta)).logline, '新立意', '空 logline 可补');
    // overwrite：覆盖同名人物/术语
    await applyHarvest(io, '旧书', {
        title: '', genre: '', logline: '', promise: '覆盖承诺', outline: '',
        characters: [{ name: '沈砚', card: '覆盖卡' }],
        worldbook: [], glossary: [{ term: '长夜行', definition: '覆盖定义' }],
    }, { mode: 'enrich', sessionId: 'sess-test', overwrite: true });
    assert.match(await io.readText(p.character('沈砚')), /覆盖卡/);
    assert.equal((await io.readJson(p.glossary)).find((t) => t.term === '长夜行').definition, '覆盖定义');
    assert.equal(await io.readText(p.promise), '覆盖承诺\n');
});
