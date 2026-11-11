// lib/layout.js — 书内目录布局与章节版本策略的**唯一开关**（纯配置，无 io）。
//
// 背景（融合改造）：插件默认布局（forge）把人类可读文档放在 `正文/大纲/人物/`；
// 用户自己的 fiction-suite 技能另有落盘规范（`06-正文/第001章 章名.md`、
// `04-细纲/`、`03-分卷大纲/`、`05-角色语言指纹/`）。两者只差**人类文档**的目录与
// 文件名——机器状态（novel.json / 账本/ / 设定/*.json / .novel/）两种布局完全一致，
// 因此切换布局不会动任何账本与索引。
//
// 版本策略（versioning）：
//   · 'versions'（forge 默认）：正文按 `第N章-标题-vK.md` 追加版本，旧版永不覆盖；
//   · 'git'（fiction-suite 默认）：正文单文件原地覆盖，历史交给书目录的 git 仓库，
//     符合技能「版本由 git 承担、禁止目录复制式备份」的纪律；
//   · 'auto'：按 layout 自动选（forge→versions，fiction-suite→git）。
//
// 状态是**进程级单例**：apply() 装配期调一次 configureLayout；工具、REST 面板、
// 批量起草看到的是同一套路径。测试可用 resetLayout() 复位。

/** 合法布局 id。 */
export const LAYOUT_IDS = ['forge', 'fiction-suite'];

/** 合法版本策略取值（'auto' 表示按布局推导）。 */
export const VERSIONING_MODES = ['auto', 'versions', 'git'];

/**
 * 布局档案表。字段含义：
 *   · chaptersDir       正文目录（书目录内相对路径段）
 *   · chapterNaming     章节文件名风格：'forge' = `第N章-标题[-vK].md`；
 *                       'fiction-suite' = `第001章 章名[-vK].md`（三位补零 + 空格）
 *   · chapterOutlineDir 细纲目录
 *   · chapterOutlineName 细纲文件名（按章号）
 *   · bookOutline       全书大綱文件
 *   · charactersDir     人物卡目录
 *   · promise           故事承诺书（人类文档）
 */
const PROFILES = {
    forge: {
        id: 'forge',
        chaptersDir: '正文',
        chapterNaming: 'forge',
        chapterOutlineDir: '大纲/细纲',
        chapterOutlineName: (n) => `第${n}章.md`,
        bookOutline: '大纲/全书大纲.md',
        charactersDir: '人物',
        promise: '设定/故事承诺书.md',
    },
    'fiction-suite': {
        id: 'fiction-suite',
        chaptersDir: '06-正文',
        chapterNaming: 'fiction-suite',
        // 细纲保持「一章一文件」：插件的契约覆盖率是按单章细纲算的，分组文件
        // （04-细纲/第1-10章.md）机读不了；文件名与正文同用三位补零。
        chapterOutlineDir: '04-细纲',
        chapterOutlineName: (n) => `第${pad3(n)}章.md`,
        bookOutline: '03-分卷大纲/全书大纲.md',
        charactersDir: '05-角色语言指纹',
        promise: '02-设定圣经/故事承诺书.md',
    },
};

/** 三位补零章号（fiction-suite 命名用；≥1000 章按自然位数）。 */
export function pad3(n) {
    const num = Number(n);
    if (!Number.isInteger(num) || num < 0) throw new Error(`章号不合法：${JSON.stringify(n)}`);
    return String(num).padStart(3, '0');
}

/** 进程级当前配置（apply 装配期写入）。 */
const state = {
    profile: 'forge',
    /** 用户原样配置的值（含 'auto'）。 */
    requested: 'auto',
    /** 解析后的实际策略：'versions' | 'git'。 */
    resolved: 'versions',
};

/**
 * 配置布局与版本策略（幂等；apply / MCP 启动 / 测试用）。
 * @param {{layout?: string, versioning?: string}} options
 * @returns {{profile: string, versioning: string, resolved: string}}
 */
export function configureLayout({ layout = 'forge', versioning = 'auto' } = {}) {
    if (!LAYOUT_IDS.includes(layout)) {
        throw new Error(`dsh-web-novel: layout 必须是 ${LAYOUT_IDS.join(' / ')}（当前 ${JSON.stringify(layout)}）`);
    }
    if (!VERSIONING_MODES.includes(versioning)) {
        throw new Error(`dsh-web-novel: versioning 必须是 ${VERSIONING_MODES.join(' / ')}（当前 ${JSON.stringify(versioning)}）`);
    }
    state.profile = layout;
    state.requested = versioning;
    state.resolved = versioning === 'auto'
        ? (layout === 'fiction-suite' ? 'git' : 'versions')
        : versioning;
    return layoutSnapshot();
}

/** 复位到插件默认（forge + versions）；测试隔离用。 */
export function resetLayout() {
    state.profile = 'forge';
    state.requested = 'auto';
    state.resolved = 'versions';
}

/** 当前生效的布局档案（冻结副本，调用方不要改）。 */
export function activeLayout() {
    return PROFILES[state.profile];
}

/** 当前生效的版本策略：'versions' | 'git'。 */
export function versioningMode() {
    return state.resolved;
}

/** 工具描述用的人话版本策略说明（装配期求值一次，随工具 schema 固定）。 */
export function versioningPolicyText() {
    return state.resolved === 'git'
        ? 'git 策略：同一章正文单文件原地覆盖（历史交给书目录 git，禁止手工 -vN 副本/备份目录）'
        : 'versions 策略：同章追加 vK 新文件，旧版永不覆盖';
}

/** 当前配置快照（诊断/日志用）。 */
export function layoutSnapshot() {
    return { profile: state.profile, versioning: state.requested, resolved: state.resolved };
}
