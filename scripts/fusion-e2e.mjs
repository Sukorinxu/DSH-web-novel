#!/usr/bin/env node
// scripts/fusion-e2e.mjs — 融合版端到端冒烟（不装宿主也能跑）：
// 用 mcp-standalone 的独立装配通道（同一份工具层）在临时工作区走一遍
// init → 大纲 → 细纲批准 → 简报 → 写章 → 同章改稿，验证 fiction-suite 布局 + git
// 版本策略真的落盘正确（06-正文/第001章 章名.md；改稿原地覆盖、不产生 vK 副本）。
//
// 用法：node scripts/fusion-e2e.mjs
// 退出码 0 = 全链路通过；1 = 断言失败（打印实际值与差异）。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.NOVEL_FORGE_LAYOUT = 'fiction-suite';
process.env.NOVEL_FORGE_VERSIONING = 'git';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'novel-forge-fusion-e2e-'));
const BOOK = '融合测试书';
let failed = 0;
const check = (label, ok, detail = '') => {
    if (ok) {
        console.log(`✔ ${label}`);
    } else {
        failed += 1;
        console.error(`✖ ${label}${detail === '' ? '' : ` — ${detail}`}`);
    }
};

try {
    const { buildStandaloneTools } = await import('../lib/mcp-standalone.js');
    const { tools, call } = await buildStandaloneTools(root);
    console.log(`工具数：${tools.length}（期望 23）`);
    check('23 个 novel_* 工具装配', tools.length === 23, `实际 ${tools.length}`);

    const init = await call('novel_project', {
        action: 'init', book: BOOK, genre: '玄幻',
        logline: '废柴少年在山村捡到一枚会说话的铜钱。',
        chars: '200-4000', platform: 'qidian',
    });
    check('init 成功', init?.book === BOOK || init?.title !== undefined, JSON.stringify(init).slice(0, 200));

    await call('novel_project', { action: 'promise', book: BOOK, promise: '本书承诺：每章必有微兑现，绝不让主角无理由降智。' });
    await call('novel_character', { action: 'save', book: BOOK, name: '林照', card: '山村少年，嘴硬心软。' });
    await call('novel_outline', {
        action: 'save_book', book: BOOK,
        outline: '## 第一卷 山村铜钱\n\n- 第1章：铜钱开口，林照被卷入是非。\n- 第2章：第一次打脸。',
    });

    const outline = [
        '# 第1章 铜钱开口（融合测试细纲）',
        '',
        '## 本章必写场景',
        '',
        '- 溪水刚没过脚踝：林照在溪边捡到一枚会说话的铜钱。（拍：弯腰去捡）（拍：铜钱骂人）（拍：他吓得把铜钱扔进水里又捞回来）',
        '- 债主赵三带着两个帮手堵在村口老槐树下：回村路上被债主堵住。（拍：债主伸手要钱）（拍：林照把铜钱攥紧）',
        '',
        '## 本章禁止偏离项',
        '',
        '- 不得让林照主动使用金手指',
    ].join('\n');
    await call('novel_outline', { action: 'save_chapter', book: BOOK, chapter: 1, outline });
    await call('novel_outline', { action: 'approve', book: BOOK, chapter: 1 });

    const brief = await call('novel_briefing', { book: BOOK, chapter: 1 });
    check('简报拿到字数目标段', Array.isArray(brief.sections) && brief.sections.some((s) => s.name === '本章字数目标'));

    const chapterText = [
        '溪水刚没过脚踝，林照就看见那枚铜钱躺在卵石缝里，绿锈像一层干了的血。他弯腰去捡，指腹刚碰到方孔，铜钱忽然骂了一句极脏的粗话。',
        '',
        '他手一抖，铜钱滚进水里，又被他慌忙捞回来。攥在掌心的东西冰凉，还在喋喋不休，像村口那个输光了钱的赌鬼。',
        '',
        '回村的土路被雨泡得发软。债主赵三带着两个帮手堵在村口老槐树下，伸手就要钱。林照把铜钱攥得更紧，指甲掐进掌心。',
        '',
        '「没钱。」他说，声音干得厉害。赵三盯着他攥着东西的那只手，笑了一下。',
        '',
        '铜钱在他掌心里突然安静下来，安静得像在等他自己开口。林照没有松手，他低头看了看自己的拳头。',
        '',
        '回村路上被债主堵住的时候，谁也没想到一个废物敢问出这种话：这世上有会说话的铜钱吗？',
    ].join('\n');

    const first = await call('novel_write_chapter', {
        book: BOOK, chapter: 1, title: '铜钱开口', content: chapterText,
        summary: '林照溪边捡到会骂人的铜钱，回村被债主堵住。',
        facts_updates: '林照|持有|会说话的铜钱',
    });
    const firstPath = String(first.path ?? '');
    check('首次落盘在 06-正文', firstPath.startsWith(`${BOOK}/06-正文/`), firstPath);
    check('文件名为 第001章 章名.md（无 vK）', /\/第001章 铜钱开口\.md$/.test(firstPath), firstPath);
    check('书内文件真实存在', fs.existsSync(path.join(root, firstPath)));

    const chapterTwo = `${chapterText}\n\n他把铜钱举到赵三眼前，铜钱果然又骂了一句。赵三的脸一下白了，退了两步。`;
    const second = await call('novel_write_chapter', {
        book: BOOK, chapter: 1, title: '铜钱开口', content: chapterTwo,
        summary: '林照当众让铜钱开口，吓退债主。',
    });
    check('改稿后仍是同一个正文路径（git 覆盖）', String(second.path) === firstPath, `${second.path} vs ${firstPath}`);
    check('版本号逻辑递增到 2', Number(second.version) === 2, String(second.version));
    const bodyFiles = fs.readdirSync(path.join(root, BOOK, '06-正文'));
    check('正文目录只有一份章文件（无 -v2 副本）', bodyFiles.length === 1, JSON.stringify(bodyFiles));

    const meta = JSON.parse(fs.readFileSync(path.join(root, BOOK, 'novel.json'), 'utf8'));
    check('novel.json 索引 latest=2', meta.chapters['1'].latest === 2, String(meta.chapters['1'].latest));
    check('细纲落 04-细纲/第001章.md', fs.existsSync(path.join(root, BOOK, '04-细纲/第001章.md')));
    check('人物卡落 05-角色语言指纹/林照.md', fs.existsSync(path.join(root, BOOK, '05-角色语言指纹/林照.md')));
    check('承诺书落 02-设定圣经/故事承诺书.md', fs.existsSync(path.join(root, BOOK, '02-设定圣经/故事承诺书.md')));
    check('机器状态仍在书根（novel.json / 账本/facts.json）',
        fs.existsSync(path.join(root, BOOK, 'novel.json')) && fs.existsSync(path.join(root, BOOK, '账本/facts.json')));

    // ── 旧稿接入：scan 发现 + adopt 按原章号接入（源目录只读） ──────────────
    const legacyRoot = path.join(root, '旧稿工作区');
    fs.mkdirSync(path.join(legacyRoot, '正文'), { recursive: true });
    fs.mkdirSync(path.join(legacyRoot, '细纲'), { recursive: true });
    fs.writeFileSync(path.join(legacyRoot, '正文', '第1章 群演的我.md'), '第1章正文：群演的第一天，手机里冒出个顶流群。\n');
    fs.writeFileSync(path.join(legacyRoot, '正文', '第2章 二次试镜_AI初稿.txt'), '第2章 AI 初稿：第二次试镜，台词只错了一个字。\n');
    fs.writeFileSync(path.join(legacyRoot, '正文', '第3章 顶流来敲门.md'), '第3章正文：有人敲门，门外站着两个顶流。\n');
    fs.writeFileSync(path.join(legacyRoot, '细纲', '第1章细纲.md'), '# 第1章细纲\n- 场景：群演现场\n');
    fs.writeFileSync(path.join(legacyRoot, '细纲', '新第1章细纲（重排版）.md'), '# 重排细纲（不应接入）\n');

    const scan = await call('novel_import', { action: 'scan', source: '旧稿工作区' });
    const scanned = (scan.candidates ?? []).find((c) => c.source === '旧稿工作区/正文');
    check('scan 发现旧稿工作区（source=旧稿工作区/正文）', scanned !== undefined && scanned.chapters === 3, JSON.stringify(scan.candidates ?? []));
    check('scan 报告的细纲目录正确', scanned?.outlineDir === '旧稿工作区/细纲', String(scanned?.outlineDir));

    const dry = await call('novel_import', { action: 'adopt', book: '旧稿接入书', source: '旧稿工作区', dry_run: true });
    check('adopt dry_run 报告 3 章且不落盘', dry.chapters === 3 && dry.dryRun === true && !fs.existsSync(path.join(root, '旧稿接入书/novel.json')), JSON.stringify(dry));
    const adopted = await call('novel_import', { action: 'adopt', book: '旧稿接入书', title: '旧稿接入书', genre: '都市', source: '旧稿工作区' });
    check('adopt 接入 3 章', adopted.chapters === 3 && adopted.chars > 0, JSON.stringify(adopted));
    check('章节按原章号落 06-正文（含去草稿后缀）',
        fs.existsSync(path.join(root, '旧稿接入书/06-正文/第001章 群演的我.md'))
        && fs.existsSync(path.join(root, '旧稿接入书/06-正文/第002章 二次试镜.md'))
        && fs.existsSync(path.join(root, '旧稿接入书/06-正文/第003章 顶流来敲门.md')),
        JSON.stringify(fs.existsSync(path.join(root, '旧稿接入书/06-正文')) ? fs.readdirSync(path.join(root, '旧稿接入书/06-正文')) : []));
    check('adopt 复制旧细纲到 04-细纲', fs.existsSync(path.join(root, '旧稿接入书/04-细纲/第001章.md')));
    check('重排「新第N章细纲」未被误接', !fs.existsSync(path.join(root, '旧稿接入书/04-细纲/第002章.md')));
    const adoptedMeta = JSON.parse(fs.readFileSync(path.join(root, '旧稿接入书/novel.json'), 'utf8'));
    check('adopt 后 novel.json 索引 3 章且 latest=1', Object.keys(adoptedMeta.chapters).length === 3 && adoptedMeta.chapters['2'].latest === 1, JSON.stringify(adoptedMeta.chapters['2'] ?? {}));
    check('源旧稿目录只读（文件仍在原处）', fs.existsSync(path.join(legacyRoot, '正文', '第1章 群演的我.md')));

    // 旧稿接入后的索引回填：章节摘要（写前简报的「前情提要」依赖它）
    const sums = await call('novel_project', {
        action: 'summaries', book: '旧稿接入书',
        summaries: '1|群演第一天，手机里冒出顶流群\n2|二次试镜只错了一个字\n99|不存在的章',
    });
    check('summaries 回填 2 章并跳过缺章', sums.summariesUpdated?.length === 2 && sums.summariesSkipped?.length === 1, JSON.stringify(sums));
    const metaWithSums = JSON.parse(fs.readFileSync(path.join(root, '旧稿接入书/novel.json'), 'utf8'));
    check('摘要写进 novel.json 章节索引', metaWithSums.chapters['1']?.summary === '群演第一天，手机里冒出顶流群'
        && (metaWithSums.chapters['3']?.summary ?? '') === '', JSON.stringify(metaWithSums.chapters));

    // 布局切换不改机器状态：切回 forge 后再建一本书，文档目录应回到 正文/ 大纲/
    const { configureLayout } = await import('../lib/layout.js');
    configureLayout({ layout: 'forge', versioning: 'versions' });
    await call('novel_project', { action: 'init', book: 'Forge兼容书', genre: '都市', logline: '测试布局切换。' });
    await call('novel_outline', { action: 'save_book', book: 'Forge兼容书', outline: '# 大纲' });
    check('切回 forge 后大纲落 大纲/全书大纲.md', fs.existsSync(path.join(root, 'Forge兼容书/大纲/全书大纲.md')));
} catch (error) {
    failed += 1;
    console.error('✖ 链路异常：', error?.stack ?? error);
} finally {
    fs.rmSync(root, { recursive: true, force: true });
    console.log(failed === 0 ? '\n全部通过。' : `\n失败 ${failed} 项。`);
    process.exit(failed === 0 ? 0 : 1);
}
