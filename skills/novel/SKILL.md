---
name: novel
description: 小说锻炉机械流程 + fiction-suite 方法论路由。触发词：写小说、写网文、开书、新书、续写、下一章、细纲、大纲、世界观、人物卡、去AI味、台账、定稿、交稿。novel_* 工具链、门禁、账本、版本化按本插件执行；创作方法论、阈值、去AI味词表、台账规范、平台口径一律以 fiction-suite 技能为准——先 skill 加载它，再按它的场景路由表读 references，禁止凭记忆。
---

# 小说锻炉 × fiction-suite 适配器

本技能只写两件事：**把创作方法论路由到 fiction-suite**，以及**fiction-suite 布局下插件机械流程的接驳点**。
briefing→write、一次一章、提案制、熔断、零前置说明这些硬纪律由插件常驻 systemPrompt 强制，此处不重复。

## 一、定位与加载顺序

| 层 | 来源 | 管什么 |
|---|---|---|
| 机械引擎 | 本插件 + 本技能 | novel_* 工具、门禁、账本、索引、版本化、双轨审计的**操作顺序** |
| 方法论 | `fiction-suite` 技能 | 选题/赛道/大纲/细纲/节奏/去 AI 味/语言指纹/台账/平台口径/**全部阈值** |

1. 动笔前先 `skill` 加载 `fiction-suite`（以及本技能 `novel`，若目录未展开）。
2. 打开它的「三、场景路由」表，按当前任务读对应 `references/*.md`；阈值只认 `spec-quality-gates.md`，台账只认 `spec-ledger.md`，去 AI 味只认 `spec-de-ai.md`。
3. 技能不在目录里 → 明说「fiction-suite 未安装」，不要凭记忆编方法论；机械流程照常。
4. 冲突裁决：**阈值/口径以 fiction-suite 规范为准，落盘行为以插件门禁为准**——门禁拦下的稿子不能靠规范解释放行。

## 二、唯一工具顺序（不要跳步）

**开书**：`novel_project init`（先问每章字数/平台）→ `novel_project promise` 写故事承诺书 → `novel_worldbook add` / `novel_character save`（含 voice 语言基因卡）→ `novel_outline save_book` 全书大纲 → `novel_project phase` 看下一阶段入场条件。

**每章**：

1. `novel_outline save_chapter`（含「## 本章必写场景」「## 本章禁止偏离项」）→ `novel_outline approve`
2. `novel_scene save`（多人物/有反转要藏时；隐藏人物名不得进正文）
3. `novel_briefing` 拿上下文包（本章字数目标、细纲、人物、账本、伏笔、认知边界）
4. **动笔前检查**（fiction-suite 口径）：读 `01-节奏块规划`、`02-设定圣经/`、上一章结尾与对应 reference；番茄向先跑 `viral_novel_audit.py --kind hitrate`（方案/细纲），命中率不达标先改细纲，不硬写
5. 成稿 → `novel_write_chapter`（门禁/机审/内容门禁/细纲契约一次过）
6. 落账：`novel_ledger`（境界/位置/持有/伏笔/认知）、`novel_relation`（人物之间）、`novel_arc`（单人物维度），三者别混
7. 审计：`novel_noai_scan` + `novel_audit`（平台/敏感）拿确定性数字；收尾纯文字汇报，**到此停**

**续写**：`novel_project status` → `novel_briefing` → 循环上节；回溯用摘录不整章读——跨章回顾用 `novel_search` 的章号+摘录、`novel_ledger status_at/timeline` 的时点值，不要整章 `read` 正文。

## 三、目录契约（fiction-suite 布局，本发行版默认）

书 = 工作区里的一个目录；人类文档与机器状态分开：

| 内容 | fiction-suite 布局 | forge 兼容布局 |
|---|---|---|
| 正文 | `06-正文/第001章 章名.md` | `正文/第N章-标题-vK.md` |
| 单章细纲 | `04-细纲/第001章.md`（一章一文件） | `大纲/细纲/第N章.md` |
| 全书大纲 | `03-分卷大纲/全书大纲.md` | `大纲/全书大纲.md` |
| 人物卡/语言指纹 | `05-角色语言指纹/<角色名>.md` | `人物/<角色名>.md` |
| 故事承诺书 | `02-设定圣经/故事承诺书.md` | `设定/故事承诺书.md` |
| 导出 | `导出/` | 同左 |

- **机器状态**（两种布局都在书根，**禁止用 write/edit 手改**）：`novel.json`、`账本/facts.json`、`账本/伏笔.json`、`设定/*.json`、`.novel/`（审计/提案/索引/断点）。手改会被 repair 对账覆盖或绕过门禁与版本守卫。
- 路径一律以**工具返回值**为准，不要自己拼（拼错或混进控制字符必 file not found）。
- 细纲「一章一文件」是对 fiction-suite「第1-10章.md 分组」的有意偏离：插件契约覆盖率按单章机读，分组文件读不了。写进说明时如实告知用户。
- 布局由插件配置 `layout` 决定；一个工作区同时只用一种。切换布局后旧书索引仍指向旧文件、新旧章会分家，**没有自动迁移**。

## 四、双轨门禁（两把尺，并列汇报、不互相换算）

| 轨 | 何时 | 谁判 | 产物 |
|---|---|---|---|
| 写章轨 | 每章落盘前 | 插件机审 + 内容门禁 + 细纲契约 | 工具回执里的确定性数字 / 拒绝原因 |
| 定稿轨 | 定稿、交稿、发布前 | fiction-suite Python 脚本 | 脚本 stdout + 退出码，原样进交付 |

定稿轨命令（用户级技能默认在 `$HOME/.dsh/skills/fiction-suite/scripts/`；技能装到别处时以 `skill` 工具返回的 base directory 为准。`$HOME` 在 pwsh 与 bash 里都能展开，命令行可用 `tool-pwsh` 直接跑）：

```bash
# 通用定稿：字数/段落/对话/AI味/钩子/台账增量（--kind 只收「草稿」或「定稿」）
python "$HOME/.dsh/skills/fiction-suite/scripts/novel_audit.py" --file "06-正文/第001章 章名.md" --kind 定稿
# 番茄向单章评分：爽点/温度/钩子/台账
python "$HOME/.dsh/skills/fiction-suite/scripts/viral_novel_audit.py" --file "06-正文/第001章 章名.md" --kind chapter
# 对话专项：正文台词必须用中文弯引号，否则报「未检测到对话」
python "$HOME/.dsh/skills/fiction-suite/scripts/dialogue_audit.py" --file "06-正文/第001章 章名.md"
# 起点向量化质检（可选）
python "$HOME/.dsh/skills/fiction-suite/scripts/check_chapter.py" "06-正文/第001章 章名.md"
```

- **必须引用实测输出**：关键 stdout 与退出码写进交付，禁止手写「已通过」替代；脚本不可用时标注「未实测」并降级人工核对，不宣称通过。
- 退出码：0 通过；1 需处理（硬门禁或参数提醒，看输出区分）；2 参数/解析错误。非 0 先读输出再判断，硬门禁未过必须改后重跑。
- 两轨数字口径不同：**并列汇报，不换算、不互相替代**；不同脚本之间也不可直接比较（见 fiction-suite 质检规范）。
- 写章轨数字（`novel_audit` / `novel_noai_scan`）同样是证据；`novel_polish submit` 的 `review_quotes` 必须逐字在原文找到。

## 五、节奏与交付纪律（只列接驳点）

- 一次只写一章，写完停；「写一本小说」不等于一口气跑完全书。批量起草只在用户明确要求时建议，连环悬念章不并行。
- 写章回执即交付：正文已落盘、面板可见，**禁止 present**、不自拼路径。
- 改稿自己动笔走 `novel_write_chapter`；要用户批准的修订走 `novel_propose`（提完就停，应用是用户主权动作）。
- 同章被连续驳回 3 次 = 熔断：不要换措辞硬压，回去改细纲（save_chapter + approve）或场景契约，改完计数自动清零。
- **工具回合零前置说明**：要产出长文本的回合，开头直接调工具、不写前置说明；解释留到落盘后的汇报。
- 正文引号一律国标弯引号“”‘’，禁直角引号「」『』。

## 六、git 纪律（git 版本策略下）

- 版本由 git 承担：同一章正文**只有一份文件**，改稿原地覆盖，历史在 commit 里。
- **每章定稿、每次台账变更单独 commit**；提交信息写「改了什么 + 为什么」，不要 `update` 这类空话。
- 提交前先 `git status`，不盲 `git add -A`；中文路径先 `git config --global core.quotepath false`。
- **禁止** `.bak`、`备份/`、`第N章-旧.md`、手工 `-v2` 副本——git 已经是备份；里程碑才打 tag。
- 写章回执提示「本书目录没有 .git」时，先按用户意愿 `git init` 并提交基线，再继续写。

## 七、交付前自检

- [ ] 已加载 fiction-suite，并读了本次场景对应的 reference（不是凭记忆）
- [ ] 交付里写的是工具返回的真实路径（布局、章号、章名命名正确）
- [ ] 三个账本按类落账（事实/关系/弧线），没有手改 `.json`
- [ ] 定稿轨脚本已跑，stdout 与退出码原样附上（或明确标注「未实测」）
- [ ] 一次只写一章，收尾已停、未调 present
- [ ] 本轮改动已 commit（或已告知用户未提交）
