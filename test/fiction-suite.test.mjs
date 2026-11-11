import test from 'node:test';
import assert from 'node:assert/strict';
import {
    FICTION_SUITE_TEMPLATES,
    parseTemplateText,
    matchTemplates,
    inspectContent,
    extractTemplateHints,
} from '../lib/fiction-suite.js';

const specs = FICTION_SUITE_TEMPLATES.map((t) => ({ ...t, sections: [...t.fallbackSections] }));

test('fiction-suite: 模板标题解析去掉占位符，保留可对照章节', () => {
    const t = parseTemplateText('# 世界观设定 · [世界名]\n\n## 基本设定\n## 力量 / 等级体系\n## 核心规则\n', {
        ...FICTION_SUITE_TEMPLATES[0],
    });
    assert.equal(t.id, 'world-building');
    assert.ok(t.sections.includes('世界观设定'), '去掉 · 占位符后保留标题');
    assert.ok(t.sections.includes('基本设定'));
    assert.ok(t.sections.includes('力量 / 等级体系'));
    assert.ok(t.sections.includes('核心规则'));
});

test('fiction-suite: 设定圣经内容命中 world-building 模板，不被大纲抢走', () => {
    const text = `# 世界观设定 · 星海\n\n## 基本设定\n- 时代：星海纪元\n## 力量 / 等级体系\n| 等级 |\n## 核心规则\n- 规则\n## 关键地点\n| 地点 |\n## 特殊设定补充\n- 星图\n`;
    const r = inspectContent(text, specs, 40);
    assert.equal(r.best.templateId, 'world-building');
    assert.equal(r.best.role, 'setting');
    assert.equal(r.best.score, 100);
    assert.deepEqual(r.best.missing, []);
});

test('fiction-suite: 分卷规划与人物卡各自命中角色', () => {
    const volume = `# 卷级章节规划 · 第1卷\n## 本卷核心目标\n## 章节分解表\n## 高潮节点\n## 新角色 / 新地点\n## 伏笔规划\n`;
    const v = inspectContent(volume, specs, 40);
    assert.equal(v.best.templateId, 'volume-plan');
    assert.equal(v.best.role, 'outline');

    const character = `# 人物卡\n## 基础信息\n- 年龄\n## 外貌描述\n### 头部\n## 性格设定\n- 关键词\n`;
    const c = inspectContent(character, specs, 40);
    assert.equal(c.best.templateId, 'character-card');
    assert.equal(c.best.role, 'characters');
});

test('fiction-suite: 普通正文不硬套模板，返回 null 候选', () => {
    const prose = `雪落了一夜。她把刀横在膝上，听着码头方向的橹声。\n\n那盏风灯在雾里晃，晃到第三次的时候，她站了起来。`;
    const r = inspectContent(prose, specs, 40);
    assert.equal(r.best, null);
    assert.equal(r.matches.length, 0);
});

test('fiction-suite: 只从显式标签抽预填字段，不猜正文', () => {
    const hints = extractTemplateHints('书名：《星海试炼》\n题材：都市\n预计章节数：120\n单章字数：2500-3500\n');
    assert.equal(hints.bookTitle, '星海试炼');
    assert.equal(hints.genre, '都市');
    assert.equal(hints.plannedChapters, '120');
    assert.equal(hints.chapterChars, '2500-3500');
    assert.deepEqual(extractTemplateHints('这是一段正文，没有标签。'), {});
});


test('fiction-suite: 旧稿同义标题（核心承诺/金手指与系统规则）只在标题行认，不扫正文', () => {
    const text = '# 设定圣经\n## 核心承诺\n## 金手指与系统规则\n正文里提到高潮与开头，但这不是标题。\n';
    const r = inspectContent(text, specs, 40);
    assert.equal(r.best, null, '两个同义标题不足以升格为强匹配');
    const setting = r.matches.find((m) => m.templateId === 'world-building');
    assert.ok(setting.score > 0 && setting.score < 40);
    assert.ok(setting.hits.includes('核心规则'));
});

test('fiction-suite: 标题相似度按命中章节比例计分', () => {
    const partial = '# 世界观设定\n## 基本设定\n## 关键地点\n';
    const matches = matchTemplates(partial, specs);
    const setting = matches.find((m) => m.templateId === 'world-building');
    assert.ok(setting.score > 0 && setting.score < 100, '只命中部分章节时分数在 0~100 之间');
    assert.ok(setting.missing.length > 0);
});
