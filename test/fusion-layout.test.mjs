// test/fusion-layout.test.mjs — 融合改造：布局档案与版本策略（纯函数，无 io）。
//
// 覆盖：
//   ① 默认 forge 布局 + versions 策略的路径/文件名/版本号与改造前逐字一致（回归护栏）；
//   ② fiction-suite 布局的文档落点（06-正文/04-细纲/03-分卷大纲/05-角色语言指纹/02-设定圣经）；
//   ③ auto 解析：forge→versions、fiction-suite→git；
//   ④ git 策略：文件名不带 vK、nextVersion 按索引 latest 推进；
//   ⑤ 四种历史命名的解析兼容 + 残缺版本名不被当 plain；
//   ⑥ 非法配置 fail-fast；resetLayout 隔离。

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { configureLayout, resetLayout, activeLayout, versioningMode, layoutSnapshot, pad3 } from '../lib/layout.js';
import { chapterFileName, parseChapterFileName, nextVersion, sanitizeTitle } from '../lib/versioning.js';
import { pathsFor } from '../lib/store.js';
import { renderPatch, patchIsCurrent } from '../scripts/build-fusion-patch.mjs';

beforeEach(() => resetLayout());
afterEach(() => resetLayout());

test('默认（forge + auto）：路径与文件名与改造前一致', () => {
    configureLayout({});
    assert.equal(layoutSnapshot().profile, 'forge');
    assert.equal(versioningMode(), 'versions');
    const p = pathsFor('我的书');
    assert.equal(p.chaptersDir, '我的书/正文');
    assert.equal(p.bookOutline, '我的书/大纲/全书大纲.md');
    assert.equal(p.outlineDir, '我的书/大纲/细纲');
    assert.equal(p.chapterOutline(3), '我的书/大纲/细纲/第3章.md');
    assert.equal(p.character('林默'), '我的书/人物/林默.md');
    assert.equal(p.charactersDir, '我的书/人物');
    assert.equal(p.promise, '我的书/设定/故事承诺书.md');
    assert.equal(p.facts, '我的书/账本/facts.json');
    assert.equal(chapterFileName(3, '雨夜来客', 2), '第3章-雨夜来客-v2.md');
    assert.equal(p.chapterFile(3, '雨夜来客', 2), '我的书/正文/第3章-雨夜来客-v2.md');
    assert.equal(nextVersion(['第3章-雨夜来客-v1.md', '第3章-雨夜-v2.md'], 3), 3);
});

test('fiction-suite + auto：文档落点按技能规范，版本策略解析为 git', () => {
    configureLayout({ layout: 'fiction-suite' });
    assert.equal(versioningMode(), 'git');
    const p = pathsFor('我的书');
    assert.equal(p.chaptersDir, '我的书/06-正文');
    assert.equal(p.bookOutline, '我的书/03-分卷大纲/全书大纲.md');
    assert.equal(p.outlineDir, '我的书/04-细纲');
    assert.equal(p.chapterOutline(7), '我的书/04-细纲/第007章.md');
    assert.equal(p.character('林默'), '我的书/05-角色语言指纹/林默.md');
    assert.equal(p.charactersDir, '我的书/05-角色语言指纹');
    assert.equal(p.promise, '我的书/02-设定圣经/故事承诺书.md');
    // 机器状态不随布局变化
    assert.equal(p.meta, '我的书/novel.json');
    assert.equal(p.facts, '我的书/账本/facts.json');
    assert.equal(p.worldbook, '我的书/设定/世界书.json');
    assert.equal(p.audit, '我的书/.novel/audit.jsonl');
});

test('fiction-suite + git：正文单文件、三位补零、无 vK 后缀', () => {
    configureLayout({ layout: 'fiction-suite', versioning: 'git' });
    const name = chapterFileName(7, '雨夜来客', 3);
    assert.equal(name, '第007章 雨夜来客.md');
    assert.equal(pathsFor('我的书').chapterFile(7, '雨夜来客', 3), '我的书/06-正文/第007章 雨夜来客.md');
    // 标题清洗对空格也生效（文件名里不出现连串空白）
    assert.equal(chapterFileName(7, '雨夜  来客', 1), '第007章 雨夜-来客.md');
    assert.equal(pad3(7), '007');
    assert.equal(pad3(1200), '1200');
});

test('git 策略：nextVersion 按索引 latest 推进（不靠文件名）', () => {
    configureLayout({ layout: 'fiction-suite', versioning: 'git' });
    assert.equal(nextVersion([], 5), 1);
    assert.equal(nextVersion([], 5, { latest: 1 }), 2);
    assert.equal(nextVersion([], 5, { latest: 7 }), 8);
    // 磁盘上已有同名文件但索引缺记录：至少从 1 起算，不写 v0
    assert.equal(nextVersion(['第005章 雨夜.md'], 5), 2);
});

test('versions 策略在 fiction-suite 布局下仍可显式启用（vK 追加）', () => {
    configureLayout({ layout: 'fiction-suite', versioning: 'versions' });
    assert.equal(versioningMode(), 'versions');
    assert.equal(chapterFileName(7, '雨夜来客', 2), '第007章 雨夜来客-v2.md');
    assert.equal(nextVersion(['第007章 雨夜来客-v1.md', '第007章 雨夜来客-v2.md'], 7), 3);
});

test('解析兼容四种历史命名（forge/git/fs/versions）', () => {
    assert.deepEqual(parseChapterFileName('第3章-雨夜来客-v2.md'), { n: 3, title: '雨夜来客', v: 2 });
    assert.deepEqual(parseChapterFileName('第3章-雨夜来客.md'), { n: 3, title: '雨夜来客', v: 1 });
    assert.deepEqual(parseChapterFileName('第007章 雨夜来客-v2.md'), { n: 7, title: '雨夜来客', v: 2 });
    assert.deepEqual(parseChapterFileName('第007章 雨夜来客.md'), { n: 7, title: '雨夜来客', v: 1 });
    // 残缺的版本名不算 plain（不能被当成标题 v2 的正文参与版本计数）
    assert.equal(parseChapterFileName('第3章-v2.md'), null);
    assert.equal(parseChapterFileName('随手记.md'), null);
});

test('非法配置 fail-fast，resetLayout 复位', () => {
    assert.throws(() => configureLayout({ layout: 'nope' }), /layout 必须是/);
    assert.throws(() => configureLayout({ versioning: 'svn' }), /versioning 必须是/);
    configureLayout({ layout: 'fiction-suite' });
    resetLayout();
    assert.equal(activeLayout().id, 'forge');
    assert.equal(versioningMode(), 'versions');
});

test('sanitizeTitle 回归：标题清洗规则未变', () => {
    assert.equal(sanitizeTitle('雨夜 来客?'), '雨夜-来客');
    assert.equal(sanitizeTitle(''), '无题');
});

test('cordis.patch.yml 与预设源同步（bundle patch 生成器漂移护栏）', () => {
    // dsh 0.2+ 只认 bundle patch 里的 preset 声明；agent.cordis.yml 是 legacy 部署源。
    // 两者由 scripts/build-fusion-patch.mjs 机械同步，这里钉住「改了源没重生成」。
    assert.equal(patchIsCurrent(), true, '跑 node scripts/build-fusion-patch.mjs 重新生成 cordis.patch.yml');
    const text = renderPatch();
    assert.match(text, /preset-dsh-web-novel/);
    assert.match(text, /layout: fiction-suite/);
    assert.match(text, /versioning: auto/);
    // 预设声明必须包含工具清单（persona + 技能目录/skill 工具 + fs 检索 + ask_user + pwsh）
    for (const id of ['persona', 'skill-filesystem', 'tool-skill', 'tool-fs', 'tool-fs-search', 'tool-pwsh', 'tool-ask-user']) {
        assert.ok(text.includes(`- id: ${id}`), `预设缺插件行：${id}`);
    }
});
