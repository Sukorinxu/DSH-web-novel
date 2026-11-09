// test/legacy.test.mjs — 旧稿识别/接入计划（纯函数，无 io）。
//
// 覆盖：中文数字章号、草稿识别与同章去重、章号缺口、细纲映射（旧编号认、新编号不认）、
// 正文目录挑选。io 部分由 novel_import 的 scan/adopt 动作与 scripts/fusion-e2e.mjs 覆盖。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    chineseNumeral, parseLegacyChapterFile, parseLegacyOutlineFile,
    planLegacyChapters, pickChapterDir, pickOutlineDir, stripChapterExt,
} from '../lib/legacy.js';

test('chineseNumeral：章节号规模的中文数字', () => {
    assert.equal(chineseNumeral('一'), 1);
    assert.equal(chineseNumeral('十'), 10);
    assert.equal(chineseNumeral('十一'), 11);
    assert.equal(chineseNumeral('二十'), 20);
    assert.equal(chineseNumeral('二十三'), 23);
    assert.equal(chineseNumeral('一百'), 100);
    assert.equal(chineseNumeral('一百零八'), 108);
    assert.equal(chineseNumeral('一百一十'), 110);
    assert.equal(chineseNumeral('两'), 2);
    assert.equal(chineseNumeral('12'), 12);
    assert.equal(chineseNumeral('零'), null);
    assert.equal(chineseNumeral('abc'), null);
    assert.equal(chineseNumeral(''), null);
});

test('parseLegacyChapterFile：阿拉伯/中文章号、分隔符、草稿标记', () => {
    assert.deepEqual(parseLegacyChapterFile('第12章 塞壬的歌声.md'), { n: 12, title: '塞壬的歌声', draft: false });
    assert.deepEqual(parseLegacyChapterFile('第012章 标题.txt'), { n: 12, title: '标题', draft: false });
    assert.deepEqual(parseLegacyChapterFile('第十二章 标题.md'), { n: 12, title: '标题', draft: false });
    assert.deepEqual(parseLegacyChapterFile('第1章 群演的我，手机里冒出个顶流群_AI初稿.txt'), { n: 1, title: '群演的我，手机里冒出个顶流群', draft: true });
    assert.deepEqual(parseLegacyChapterFile('第3章 余华：只要能过稿，怎么都行！.md'), { n: 3, title: '余华：只要能过稿，怎么都行！', draft: false });
    // 不是正文文件
    assert.equal(parseLegacyChapterFile('新第1章细纲.md'), null);
    assert.equal(parseLegacyChapterFile('README.md'), null);
    assert.equal(parseLegacyChapterFile('第1章.doc'), null);
});

test('parseLegacyChapterFile 会把「第1章细纲」当章节——接入只传正文目录，所以不会被误收', () => {
    // 记录这个已知边界：文件名前缀规则本身分不出「细纲」；adopt 的 chapterDir 只指向正文目录。
    assert.deepEqual(parseLegacyChapterFile('第1章细纲.md'), { n: 1, title: '细纲', draft: false });
});

test('stripChapterExt 只去正文扩展名', () => {
    assert.equal(stripChapterExt('第1章 a.md'), '第1章 a');
    assert.equal(stripChapterExt('第1章 a.markdown'), '第1章 a');
    assert.equal(stripChapterExt('第1章 a.txt'), '第1章 a');
    assert.equal(stripChapterExt('第1章 a.doc'), '第1章 a.doc');
});

test('planLegacyChapters：同章优先定稿、报告重复、章号缺口、忽略非章节', () => {
    const plan = planLegacyChapters([
        '第2章 二.md',
        '第1章 一_AI初稿.txt',
        '第1章 一.md',
        '第5章 五.md',
        'README.md',
        '第3章细纲.md',   // 会被当章节（已知边界），这里证明它确实进了 chapters
        '封面.png',
    ]);
    assert.deepEqual(plan.chapters.map((c) => c.n), [1, 2, 3, 5]);
    assert.equal(plan.chapters[0].file, '第1章 一.md');       // 非草稿优先
    assert.equal(plan.chapters[0].draft, false);
    assert.equal(plan.chapters[0].variants, 2);
    assert.deepEqual(plan.duplicates, [{ n: 1, files: ['第1章 一_AI初稿.txt', '第1章 一.md'] }]);
    assert.deepEqual(plan.gaps, [4]);
    assert.deepEqual(plan.ignored, ['README.md', '封面.png']);
});

test('planLegacyChapters：只有草稿时保留草稿并标记', () => {
    const plan = planLegacyChapters(['第2章 二_AI初稿.md', '第1章 一.md']);
    assert.equal(plan.chapters[1].draft, true);
    assert.equal(plan.chapters[1].title, '二');
});

test('parseLegacyOutlineFile：旧章号细纲认，重排后的「新第N章」不认', () => {
    assert.deepEqual(parseLegacyOutlineFile('第27章细纲（AI草稿·已被作者细纲取代）.md'), { n: 27, title: '第27章细纲（AI草稿·已被作者细纲取代）' });
    assert.deepEqual(parseLegacyOutlineFile('第5章细纲.md'), { n: 5, title: '第5章细纲' });
    assert.equal(parseLegacyOutlineFile('新第1章细纲（番茄版重构·供审核）.md'), null);
    assert.equal(parseLegacyOutlineFile('人物表.md'), null);
});

test('pickChapterDir / pickOutlineDir：精确名优先，再认变体', () => {
    assert.equal(pickChapterDir(['细纲', '正文', '正文_番茄版']), '正文');
    assert.equal(pickChapterDir(['正文_番茄版', '其他']), '正文_番茄版');
    assert.equal(pickChapterDir(['其他']), null);
    assert.equal(pickOutlineDir(['正文', '细纲']), '细纲');
    assert.equal(pickOutlineDir(['正文']), null);
});
