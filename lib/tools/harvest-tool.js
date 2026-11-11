// lib/tools/harvest-tool.js — novel_harvest：把当前会话提炼成书（新书 / 扩写旧书）。
//
// 与工具链其它入口共用落库路径（fsio/store/审计），只在「信息从哪来」上有一次
// 模型调用：读当前会话 → 严格 JSON → 白名单落库。不写正文，不碰账本。
import { defineTool } from './define-tool.js';
import { textBlock } from './common.js';
import { assertBookName, createFsio, sessionCwd, sessionIdOf } from '../fsio.js';
import {
    runHarvest, DEFAULT_TRANSCRIPT_CHARS, MIN_TRANSCRIPT_CHARS, MAX_TRANSCRIPT_CHARS,
    HARVEST_CHANNEL,
} from '../harvest.js';

export function defineHarvestTool(ctx, config, { engine } = {}) {
    return defineTool({
        name: 'novel_harvest',
        description: '会话采风：读取**当前会话**的对话文本，调用一次模型（消耗 token）提炼人物/世界书/术语/大纲，'
            + '直接建立新书或扩充已有书。只写设定与大纲，不生成正文；新书不覆盖同名书，扩写默认只增不覆盖。'
            + '建议先以 dryRun:true 看提取结果，再正式落库（两次都会消耗 token）。',
        parameters: {
            mode: { type: 'string', required: true, enum: ['new', 'enrich'], description: 'new=从会话建立新书；enrich=把会话里的新增信息补进已有书。' },
            book: { type: 'string', required: true, description: '书目名：mode=new 时是新书目录名；mode=enrich 时是已有书目名。' },
            dryRun: { type: 'boolean', description: 'true=只提取并返回预览，不落库（仍会消耗一次模型调用）。默认 false。' },
            maxChars: { type: 'integer', description: `读取最近多少字的会话文本（${MIN_TRANSCRIPT_CHARS}–${MAX_TRANSCRIPT_CHARS}，默认 ${DEFAULT_TRANSCRIPT_CHARS}）。` },
            overwrite: { type: 'boolean', description: 'enrich 时是否覆盖同名人物卡/世界书/术语/承诺书；默认 false（只增不覆盖）。' },
            appendOutline: { type: 'boolean', description: 'enrich 时已有全书大纲，是否把本次大纲追加到末尾；默认 false（跳过并给 warning）。' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    book: { type: 'string', required: true },
                    mode: { type: 'string', required: true },
                    sessionId: { type: 'string', required: true },
                    transcriptChars: { type: 'integer', required: true },
                    messageCount: { type: 'integer', required: true },
                    truncated: { type: 'boolean', required: true },
                    dryRun: { type: 'boolean', required: true },
                    created: { type: 'boolean', required: true },
                    counts: { type: 'object', additionalProperties: false, required: true, properties: {
                        characters: { type: 'integer', required: true },
                        worldbook: { type: 'integer', required: true },
                        glossary: { type: 'integer', required: true },
                        outlineChars: { type: 'integer', required: true },
                        promise: { type: 'boolean', required: true },
                    } },
                    usage: { type: 'object', additionalProperties: false, required: true, properties: {
                        input: { type: 'integer', required: true },
                        output: { type: 'integer', required: true },
                        total: { type: 'integer', required: true },
                    } },
                    route: { type: 'object', additionalProperties: false, required: true, properties: {
                        provider: { type: 'string', required: true },
                        model: { type: 'string', required: true },
                        source: { type: 'string', required: true },
                    } },
                    warnings: { type: 'array', required: true, items: { type: 'string' } },
                    discarded: { type: 'object', additionalProperties: false, required: true, properties: {
                        characters: { type: 'integer', required: true },
                        worldbook: { type: 'integer', required: true },
                        glossary: { type: 'integer', required: true },
                    } },
                    preview: { type: 'object', additionalProperties: false, required: true, properties: {
                        title: { type: 'string', required: true },
                        genre: { type: 'string', required: true },
                        logline: { type: 'string', required: true },
                        characters: { type: 'array', required: true, items: { type: 'string' } },
                        worldbook: { type: 'array', required: true, items: { type: 'string' } },
                        glossary: { type: 'array', required: true, items: { type: 'string' } },
                        outlineChars: { type: 'integer', required: true },
                    } },
                },
            },
        },
        async execute(args, exec) {
            const mode = args.mode === 'enrich' ? 'enrich' : 'new';
            const book = assertBookName(args.book);
            const session = exec?.agent?.session;
            if (!session || typeof session.deriveMessages !== 'function') {
                throw new Error('novel_harvest 必须在真实会话里调用（拿不到当前会话消息）；H5 请用「会话采集」页');
            }
            const cwd = sessionCwd(exec);
            const io = createFsio(ctx, exec, cwd);
            const sessionId = sessionIdOf(exec) ?? '';
            // 优先走「当前 agent 作用域的直连 llm」：插件根 ctx 拿不到 llm 服务（web profile
            // 的 llm 在 agent 作用域），但 exec.agent.ctx 里能解析到；走直连就不必开子代理，
            // 不会有子代理「自己乱调工具」的副作用，也拿得到真实 token 用量。
            const agent = exec?.agent ?? null;
            const agentCtx = agent?.ctx ?? null;
            let llm = null;
            try {
                llm = agentCtx?.llm ?? (agentCtx && typeof agentCtx.get === 'function' ? agentCtx.get('llm') : null);
            } catch { llm = null; }
            let route = null;
            try {
                const selected = agent?.model?.current?.();
                if (selected && typeof selected.provider === 'string' && typeof selected.model === 'string') {
                    route = { provider: selected.provider, model: selected.model, source: 'agent' };
                }
            } catch { route = null; }
            const result = await runHarvest({
                engine, io, session, sessionId, book, mode,
                maxChars: args.maxChars,
                dryRun: args.dryRun === true,
                overwrite: args.overwrite === true,
                appendOutline: args.appendOutline === true,
                llm, route,
            });
            const preview = result.preview;
            return {
                book: result.book,
                mode: result.mode,
                sessionId: result.sessionId ?? '',
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
                    title: preview.title,
                    genre: preview.genre,
                    logline: preview.logline,
                    characters: preview.characters.map((c) => c.name),
                    worldbook: preview.worldbook.map((e) => e.title || e.content.slice(0, 40)),
                    glossary: preview.glossary.map((g) => g.term),
                    outlineChars: preview.outline.length,
                },
            };
        },
        render: (_args, v) => textBlock(v.dryRun
            ? `会话采风（预览，未落库）\n· 会话 ${v.messageCount} 条 / ${v.transcriptChars} 字${v.truncated ? '（更早部分已截断）' : ''}\n`
                + `· 提取：角色 ${v.counts.characters} / 世界书 ${v.counts.worldbook} / 术语 ${v.counts.glossary} / 大纲 ${v.counts.outlineChars} 字\n`
                + `· token：输入 ${v.usage.input} / 输出 ${v.usage.output}（通道 ${HARVEST_CHANNEL}，模型 ${v.route.model || '默认'}）\n`
                + (v.warnings.length ? `· 提示：${v.warnings.join('；')}\n` : '')
                + '确认无误后同样参数去掉 dryRun 再跑一次即可落库。'
            : `${v.created ? '已从会话建立新书' : '已从会话扩充旧书'}「${v.book}」\n`
                + `· 新增：角色 ${v.counts.characters} / 世界书 ${v.counts.worldbook} / 术语 ${v.counts.glossary} / 大纲 ${v.counts.outlineChars} 字 / 承诺书 ${v.counts.promise ? '有' : '无'}\n`
                + `· 读取会话 ${v.messageCount} 条 / ${v.transcriptChars} 字；token 输入 ${v.usage.input} / 输出 ${v.usage.output}\n`
                + (v.warnings.length ? `· 提示：${v.warnings.join('；')}` : '')),
    });
}
