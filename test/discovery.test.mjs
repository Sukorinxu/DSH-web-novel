// lib/discovery.js 的纯逻辑测试：文件角色、项目判定、五槽位映射。
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    classifyProjectFile, classifyProject, buildProjectProfile, preferredBookName,
    displayTitle, projectSummary, chapterMetaFromName, chineseNumber,
} from '../lib/discovery.js';

test('中文数字与章节名解析', () => {
    assert.equal(chineseNumber('十二'), 12);
    assert.equal(chineseNumber('一百零八'), 108);
    assert.equal(chineseNumber('3'), 3);
    assert.deepEqual(chapterMetaFromName('正文/第12章 雨夜.md'), { n: 12, title: '雨夜' });
    assert.deepEqual(chapterMetaFromName('第003章 试炼.txt'), { n: 3, title: '试炼' });
    assert.deepEqual(chapterMetaFromName('第12章.md'), { n: 12, title: '第12章' });
});

test('文件角色：细纲优先于正文/大纲，设定与人物互不误判', () => {
    assert.equal(classifyProjectFile('正文/第1章 开端.md').role, 'chapters');
    assert.equal(classifyProjectFile('细纲/第1章细纲.md').role, 'chapterOutline');
    assert.equal(classifyProjectFile('04-细纲/第1章 细纲.md').role, 'chapterOutline');
    assert.equal(classifyProjectFile('03-分卷大纲/第一卷.md').role, 'outline');
    assert.equal(classifyProjectFile('02-设定圣经/世界观.md').role, 'setting');
    assert.equal(classifyProjectFile('05-角色语言指纹/主角.md').role, 'characters');
    assert.equal(classifyProjectFile('README.md').role, 'notes');
    assert.equal(classifyProjectFile('封面.png'), null);
});

test('项目判定：AGENTS.md 标注网文 + 多角色文件 → novel', () => {
    const bootstrap = [{ name: 'AGENTS.md', text: '项目类型：网文\n本书是一部长篇连载小说，讲一个关于复仇的故事。' }];
    const files = ['正文/第1章 开局.md', '正文/第2章 追踪.md', '细纲/第1章细纲.md', '设定/世界规则.md'];
    const cls = classifyProject({ name: '《长夜》', bootstrap, files });
    assert.equal(cls.kind, 'novel');
    assert.ok(cls.confidence >= 70);
    assert.ok(cls.tags.includes('网文'));
    assert.ok(cls.signals.some((s) => s.includes('正文')));
    const unknown = classifyProject({ name: 'scripts', bootstrap: [], files: ['index.js', 'README.md'] });
    assert.equal(unknown.kind, 'unknown');
});

test('项目画像：五槽位计数、章节范围、未分类文件都保留', () => {
    const profile = buildProjectProfile({
        name: '《长夜》',
        path: '《长夜》',
        bootstrap: [{ name: 'MEMORY.md', text: '这是一个网文项目，当前写到第二卷。' }],
        files: [
            '《长夜》/正文/第1章 开局.md',
            '《长夜》/正文/第3章 追踪.md',
            '《长夜》/细纲/第1章细纲.md',
            '《长夜》/大纲/第一卷.md',
            '《长夜》/设定/世界规则.md',
            '《长夜》/人物/主角.md',
            '《长夜》/素材/灵感.txt',
            '《长夜》/封面.png',
        ],
    });
    assert.equal(profile.kind, 'novel');
    assert.equal(profile.stats.chapters, 2);
    assert.equal(profile.stats.firstChapter, 1);
    assert.equal(profile.stats.lastChapter, 3);
    assert.equal(profile.stats.chapterOutline, 1);
    assert.equal(profile.stats.outline, 1);
    assert.equal(profile.stats.setting, 1);
    assert.equal(profile.stats.characters, 1);
    assert.equal(profile.files.notes, 1);
    assert.equal(profile.roles.find((r) => r.role === 'chapters').count, 2);
    assert.equal(profile.roles.find((r) => r.role === 'chapters').target, '06-正文');
    assert.equal(profile.adopt.source, '《长夜》/正文');
    assert.equal(profile.adopt.book, '长夜');
    assert.equal(profile.adopt.chapters, 2);
    assert.equal(profile.adopt.outlinesCount, 1);
});

test('目录名清洗：书名号/括号尾巴/空名', () => {
    assert.equal(preferredBookName('《长夜》（连载版）'), '长夜');
    assert.equal(displayTitle('《长夜》（连载版）'), '长夜');
    assert.equal(preferredBookName(''), '未命名项目');
});

test('启动文件摘要：优先取「一句话/立意/简介」行', () => {
    const text = '# 项目\n\n一句话立意：一个失忆的修表匠找回家族真相。\n\n其他正文';
    assert.equal(projectSummary(text), '一句话立意：一个失忆的修表匠找回家族真相。');
    assert.equal(projectSummary(''), '');
});
