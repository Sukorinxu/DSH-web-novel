#!/usr/bin/env node
// scripts/build-fusion-patch.mjs — 生成 FUSION 版的 cordis.patch.yml。
//
// 为什么生成而不是手写：dsh 0.2+ 的 agent 预设是 **bundle patch 里的
// `@deepseek-ai/dsh-agent-preset` 声明行**（$DSH_HOME/.agent-presets/ 旧目录已无人读取，
// 见 editing-cordis-compositions 技能）。插件包的 cordis.patch.yml 是唯一能给 profile
// 插入预设行的位置，而预设的插件清单与 `lib/preset/dsh-web-novel/agent.cordis.yml`
// （legacy 宿主的部署源）必须同源——两份手抄必然漂移，所以这里由 agent.cordis.yml
// + preset.yml 机械生成，`node test/fusion-layout.test.mjs` 里有漂移护栏。
//
// 用法：
//   node scripts/build-fusion-patch.mjs          # 写入 cordis.patch.yml
//   node scripts/build-fusion-patch.mjs --check  # 只校验，不一致退出码 1
//
// 纯 Node 标准库；YAML 只用「按行加缩进」这一种可证明等价的操作（block scalar
// 的相对缩进不变），不引 YAML 依赖。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const presetDir = path.join(root, 'lib', 'preset', 'dsh-web-novel');
const outPath = path.join(root, 'cordis.patch.yml');

/** 极简 frontmatter 式 key: value 解析（预设元数据只有这两三个标量字段）。 */
function parsePresetMeta(raw) {
    const meta = {};
    for (const line of String(raw).split(/\r?\n/)) {
        const m = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line.trim());
        if (m) meta[m[1]] = m[2].trim();
    }
    return meta;
}

/** 把 entry list 原文按行整体加缩进（空行保持空行；block scalar 相对缩进不变）。 */
function indentBlock(text, spaces) {
    const pad = ' '.repeat(spaces);
    return text
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => (line.trim() === '' ? '' : pad + line))
        .join('\n');
}

/** 生成 cordis.patch.yml 全文（纯函数，测试用它做漂移校验）。 */
export function renderPatch() {
    const agent = fs.readFileSync(path.join(presetDir, 'agent.cordis.yml'), 'utf8').replace(/\r\n/g, '\n').trimEnd();
    const meta = parsePresetMeta(fs.readFileSync(path.join(presetDir, 'preset.yml'), 'utf8'));
    const name = meta.name ?? '小说锻炉';
    const description = meta.description ?? '机械引擎 × fiction-suite 方法论';
    const order = Number.isInteger(Number(meta.order)) ? Number(meta.order) : 5;

    return `# dsh-web-novel bundle patch（FUSION 版：机械引擎 × fiction-suite 方法论）。
#
# 本文件由 scripts/build-fusion-patch.mjs 生成，不要手改——
# 预设插件清单的唯一源是 lib/preset/dsh-web-novel/agent.cordis.yml，
# 显示名/描述/顺序的唯一源是 lib/preset/dsh-web-novel/preset.yml。
# 改完跑：node scripts/build-fusion-patch.mjs
#
# 两张行：
#   ① dsh-web-novel —— 插件本体（23 个 novel_* 工具 + 右侧栏面板 + novel 技能注册）；
#   ② preset-dsh-web-novel —— agent 预设声明（dsh 0.2+ 只认 bundle patch 声明；
#      $DSH_HOME/.agent-presets/ 旧目录已无人读取，preset-deploy 仅服务老宿主）。
- insert:
    - id: 'dsh-web-novel'
      name: 'dsh-web-novel'
      config:
        # 与 lib/index.js Config 默认值保持一致（起点标准 2000–4000）。
        # ⚠️ patch 里显式给的值会覆盖 schema default——0.13.1 曾在这里留了旧值
        # 500/12000，导致「字数标准升级」在真机上从未生效。
        # contextBudgetChars 9000（>默认 6000）：FUSION 下世界书/人物卡/账本/伏笔
        # 同时在场，6000 会把「全书大纲」和「原著锚段」挤出预算（真机实测）；
        # 提到 9000 让长篇续写时的对齐材料进得来。
        minChapterChars: 2000
        maxChapterChars: 5000
        contextBudgetChars: 9000
        scanTopK: 8
        repetitionWindow: 10
        # FUSION：人类文档走 fiction-suite 技能落盘规范
        # （06-正文/第001章 章名.md、04-细纲/、03-分卷大纲/、05-角色语言指纹/），
        # versioning: auto 在此布局下解析为 git（正文单文件覆盖、历史交给书目录 git）。
        # 想回插件原生布局：layout: forge（auto → versions，vK 副本永不覆盖）。
        layout: fiction-suite
        versioning: auto
        # 0.2+ 宿主用下面的 preset 声明；legacy 部署目录已无人读取，别写死文件。
        skipPresetDeploy: true

    # ── agent 预设声明（插件清单逐行取自 agent.cordis.yml，机械缩进不漂移） ──
    - id: 'preset-dsh-web-novel'
      name: '@deepseek-ai/dsh-agent-preset'
      config:
        id: 'dsh-web-novel'
        name: "${name}"
        description: "${description}"
        order: ${order}
        plugins:
${indentBlock(agent, 10)}
`;
}

/** 磁盘上的 patch 是否与生成结果一致（测试/--check 用）。 */
export function patchIsCurrent() {
    try {
        return fs.readFileSync(outPath, 'utf8') === renderPatch();
    } catch {
        return false;
    }
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const check = process.argv.includes('--check');
    const text = renderPatch();
    if (check) {
        const current = (() => { try { return fs.readFileSync(outPath, 'utf8'); } catch { return ''; } })();
        if (current !== text) {
            console.error('✗ cordis.patch.yml 与 agent.cordis.yml/preset.yml 不同步：跑 node scripts/build-fusion-patch.mjs');
            process.exit(1);
        }
        console.log('✓ cordis.patch.yml 已同步');
    } else {
        fs.writeFileSync(outPath, text, 'utf8');
        console.log(`✓ 已生成 ${path.relative(root, outPath)}（${text.split('\n').length} 行）`);
    }
}
