# 小说锻炉 × fiction-suite 融合说明（FUSION）

> 面向本改造发行版的用户与维护者。插件本体仍以 README 为准；本文只讲「融合改造」这一层：
> 为什么改、配置怎么选、目录怎么对应、双轨审计怎么跑、存量书怎么办、怎么回滚。

## 1. 定位

- **引擎与方法论分离**：dsh-novel-forge 继续当机械引擎——23 个 `novel_*` 工具、九阶段门禁、
  事实/关系/弧线账本、提案制、右侧栏「锻炉」面板；用户的 `fiction-suite` 技能当方法论——
  选题、赛道、大纲、细纲、节奏、去 AI 味、语言指纹、台账规范、平台口径与**全部阈值**。
- **书稿目录跟 fiction-suite 走，机器状态保留插件格式**：正文/细纲/大纲/人物卡/承诺书按
  fiction-suite 的落盘规范命名；`novel.json`、`账本/`、`设定/*.json`、`.novel/` 仍是插件
  的机器状态，位置与格式都不变。
- **门禁双轨**：写章用插件机审拦截（代码强制、零 token）；定稿/交稿用 fiction-suite 的
  Python 脚本出评分与门禁结论（实测输出 + 退出码）。两把尺并列汇报，不互相换算。
- **不做的事**：不自动把旧书从 forge 布局迁到 fiction-suite 布局；不替代 fiction-suite
  的拆书/漫剧/改编链（那些链仍直接用该技能，插件只管小说正文工程）。

## 2. 配置项

插件配置在 `cordis.patch.yml`（或宿主 profile 的对应 patch）里。两个新键：

| 配置 | 取值 | 插件源码默认 | 本仓库发行配置 | 含义 |
|---|---|---|---|---|
| `layout` | `forge` / `fiction-suite` | `forge` | `fiction-suite` | 书内**人类文档**的目录与命名（正文/细纲/大纲/人物卡/承诺书） |
| `versioning` | `auto` / `versions` / `git` | `auto` | `auto` | 章节版本策略；`auto` 按布局推导 |

**默认值为什么这样定**：插件源码默认 `layout: forge`，任何普通安装升级后原有书籍路径不变、
零破坏；本仓库是「融合发行版」，在自己的 `cordis.patch.yml` 里显式写
`layout: fiction-suite` + `versioning: auto`，于是新书默认按 fiction-suite 布局落盘。

`versioning` 的解析：

| 配置 | forge 布局 | fiction-suite 布局 | 行为 |
|---|---|---|---|
| `auto` | `versions` | `git` | 按布局自动选 |
| `versions` | `versions` | `versions` | 正文按 `-vK` 追加，旧版永不覆盖 |
| `git` | `git` | `git` | 同一章正文只有一份文件，原地覆盖，历史交给书目录 git |

- `versions` 下章节文件名：forge = `正文/第N章-标题-vK.md`；fiction-suite = `06-正文/第001章 章名-vK.md`。
- `git` 下不带 `-vK`：forge = `正文/第N章-标题.md`；fiction-suite = `06-正文/第001章 章名.md`。
- **git 策略的前提是书目录本身在 git 下**：没有 `.git` 时写章回执会警告「覆盖式改稿没有历史
  兜底」。插件不会替你 commit——每章定稿/每次台账变更的 commit 由会话 agent 执行。
- 配置是**进程级**的：`apply()` 装配时调用一次，工具、面板、批量起草共用同一份。改配置必须
  重启 DSH web 才生效；**一个工作区同时只用一种布局**。非法取值在装配期 fail-fast。

## 3. 目录映射表

### 3.1 人类文档（`layout` 决定）

| 内容 | `forge`（插件原生） | `fiction-suite`（融合发行版默认） | 写入工具 |
|---|---|---|---|
| 章正文 | `正文/第N章-标题[-vK].md` | `06-正文/第001章 章名.md` | `novel_write_chapter` |
| 单章细纲 | `大纲/细纲/第N章.md` | `04-细纲/第001章.md`（一章一文件） | `novel_outline save_chapter` |
| 全书大纲 | `大纲/全书大纲.md` | `03-分卷大纲/全书大纲.md` | `novel_outline save_book` |
| 人物卡 / 语言指纹 | `人物/<角色名>.md` | `05-角色语言指纹/<角色名>.md` | `novel_character save` |
| 故事承诺书 | `设定/故事承诺书.md` | `02-设定圣经/故事承诺书.md` | `novel_project promise` |
| 导出稿 | `导出/` | `导出/`（不变） | `novel_export` |

> **有意偏离**：fiction-suite 的 `write-file-layout.md` 里细纲是 `04-细纲/第1-10章.md` 的分组
> 文件；插件要求「一章一文件」（`04-细纲/第001章.md`），因为细纲契约覆盖率按单章机读，分组
> 文件读不了。其余目录名与该规范一致；`03-分卷大纲/` 下的分卷文件仍按技能习惯由用户/agent
> 另存，插件只负责 `全书大纲.md`。

### 3.2 机器状态（两种布局完全相同，都在书根）

| 路径 | 内容 | 纪律 |
|---|---|---|
| `novel.json` | 九阶段/批准记录/章节索引/cast/提案索引/熔断计数 | **禁止 write/edit 手改** |
| `账本/facts.json` | 事实账本（境界/位置/持有…） | 走 `novel_ledger` |
| `账本/伏笔.json` | 伏笔台账（埋设/回收/改期） | 走 `novel_ledger` |
| `账本/` 其余分册 | 关系/弧线等账本行日志 | 走 `novel_relation` / `novel_arc` |
| `设定/*.json` | 世界书/术语表/场景契约/语言基因 | 走对应工具 |
| `.novel/` | `audit.jsonl`、`proposals/`、`index.db`、`batch-checkpoint.json` | 派生/审计面，不手改 |

手改上述文件会绕过门禁与版本守卫；索引与磁盘不一致时用 `novel_project repair` 对账
（它只清理失效引用、撤销无细纲批准、清检索残留，**不搬文件、不迁移布局**）。

## 4. 双轨审计口径

| 轨 | 触发点 | 执行者 | 证据 |
|---|---|---|---|
| 写章轨 | 每章落盘前（含面板保存/REST 写入） | 插件代码：机审、内容门禁、细纲契约、账本冲突 | 工具回执里的确定性数字与拒绝原因 |
| 定稿轨 | 定稿、交稿、发布前 | fiction-suite 的 Python 脚本（`tool-pwsh` 跑） | 脚本 stdout + 退出码，原样进交付 |

定稿轨命令（脚本默认在 `$HOME/.dsh/skills/fiction-suite/scripts/`；装到别处时以 `skill`
工具返回的 base directory 为准）：

```bash
# 通用定稿：字数/段落/对话/AI味/钩子/台账增量（--kind 只接受「草稿」或「定稿」）
python "$HOME/.dsh/skills/fiction-suite/scripts/novel_audit.py" --file "06-正文/第001章 章名.md" --kind 定稿
# 番茄向单章评分：爽点节点/情绪温度/章末钩子/台账
python "$HOME/.dsh/skills/fiction-suite/scripts/viral_novel_audit.py" --file "06-正文/第001章 章名.md" --kind chapter
# 对话专项：话轮分布/角色画像/雷同矩阵（正文台词须用中文弯引号）
python "$HOME/.dsh/skills/fiction-suite/scripts/dialogue_audit.py" --file "06-正文/第001章 章名.md"
# 起点向量化质检（可选）
python "$HOME/.dsh/skills/fiction-suite/scripts/check_chapter.py" "06-正文/第001章 章名.md"
```

退出码约定：`0` 通过；`1` 存在需处理项（可能是硬门禁未过，也可能只是参数提醒，**看输出区分**）；
`2` 参数错误或输入无法解析。非 0 先读输出：确属硬门禁未过必须修正后重跑，**禁止把未过门禁的
内容当成品交付**。

**交付纪律**：

1. 必须贴**脚本实际 stdout（或关键段）与退出码**，禁止手写「已通过/无问题」替代。
2. 脚本不可用（本机无 Python 3.8+）时标注「未实测」，只做人工核对，**不宣称通过**。
3. 两轨数字口径不同（插件机审与 fiction-suite 脚本的子维度/权重都不同），**并列汇报、不换算**；
   同一份稿子的前后对比也必须用同一个脚本，见 `spec-quality-gates.md` 的「跨脚本数值不可直接比较」。
4. 阈值只引用、不复制：一切阈值/评分门禁以 fiction-suite 的 `spec-quality-gates.md` 为准；
   写章字数以 `novel_briefing` 的「本章字数目标」段为准（本书自定义 > 平台口径 > 插件默认）。

示例交付段（结构，不写死数字）：

```text
文件：06-正文/第001章 章名.md（工具返回路径）
写章轨：novel_audit / novel_noai_scan / 细纲契约覆盖率——照抄工具回执数字
定稿轨：$ python "$HOME/.dsh/skills/fiction-suite/scripts/novel_audit.py" --file "..." --kind 定稿
        （stdout 摘要…）
        exit code: 1（存在需处理项：…）
未覆盖：…（如未跑平台专项、未做人工通读）
```

## 5. 存量书迁移

**前提事实**（先读再动手）：

- 插件**没有**自动的 forge→fiction-suite 迁移；`novel_project repair` 只做索引-磁盘
  对账，不搬文件、不改名。
- 布局是进程级配置：切布局后，旧书索引里的 `rel` 仍指向旧路径，而新写的章会落到新布局路径
  → **新旧章分家**。因此禁止「不迁移就直接在旧书上写新章」。
- 机器状态（`novel.json`/账本/设定 JSON）与布局无关，本身不会坏；坏的是人类文档的路径一致性。

### 路线 A（推荐给已有连载）：继续用 forge 布局

1. 配置改回 `layout: forge`（`versioning` 可保持 `auto`→versions，或显式 `versions`），重启 DSH web。
2. 旧书目录一个字不动；所有工具/面板按原路径读写。
3. 需要双轨审计时，直接把 `--file` 指向 `正文/第N章-标题-vK.md`（取当前最高版本）跑同一批
   Python 脚本即可；脚本只读文件，不关心布局。
4. 代价：没有 fiction-suite 的目录结构；但存量书继续写、不迁移，风险最低。

### 路线 B（推荐给新书/准备重开的书）：用 `novel_import` 重建进 fiction-suite 布局

1. **先留档**：旧书目录在 git 下就确认无杂物后 `git add` + `git commit`；不在 git 下就整体移到工作区外
   备份（不要在工作区里建 `备份/`、`.bak`、`-旧.md`）。
2. 先对旧书跑 `novel_project repair`（只对账、不搬文件）；再把正文按章号顺序**合并成一个 `.md`/`.txt`**（每章保留 `第N章 标题` 标题行；`versions` 书取每章最高 `vK`）。合并文件放工作区 `tmp/`，用完删除。
3. 先跑 `novel_import action=preview`（给 `book`/`file`）核对切分结果：章数、每章标题、字数；
   切分不对就调整合并文件的标题行，别硬导入。
4. `novel_import action=import` 创建新书：正文按当前 `layout: fiction-suite` 落到
   `06-正文/第001章 章名.md`，`novel.json` 与检索索引同步重建。
5. 跑 `novel_import action=backfill`（可 `approve:true`）为导入章回补粗纲，让旧章回到门禁体系；
   续写新章再正常 `novel_outline save_chapter` + `approve`。
6. 补机器状态：导入**只重建正文与章节索引**，账本/伏笔/世界书/人物卡/大纲不在导入范围内。
   按旧书内容用 `novel_ledger`、`novel_relation`、`novel_arc`、`novel_worldbook`、
   `novel_character`、`novel_outline save_book` 重新登记（或至少补到能支撑下一章）。
7. 校验：`novel_project status` 看阶段/章节；`novel_project check` 跑全书一致性；面板阅读器
   逐章抽读；确认无路径缺失后再开写。
8. 旧书目录：保留为只读档案（建议移出工作区或保留在 git 历史），**不要在旧目录上再写章**。

## 6. 取舍与限制

- **git 覆盖模式没有 vN 文件**：同一章正文永远只有一份；找旧版靠 `git log` / `git show`，
  目录里不会出现 `-v2.md`。书目录不在 git 下时，覆盖式改稿没有历史兜底（写章回执会警告）。
- **插件不自动 commit**：git 纪律由会话 agent 执行（每章定稿/每次台账变更单独 commit）；
  插件只负责把「没有 .git」这件事说出来。
- **面板与工具仍读 `novel.json` 索引**：`layout` 只改变人类文档路径，不改变索引格式；切换配置
  后必须重启，且旧书存在路径分家风险（见第 5 节）。
- **一个工作区一种布局**：不能按书切布局；同一 DSH 进程内所有书共用当前配置。
- **Python 是可选但必需的前提**：定稿轨要求本机 Python 3.8+（脚本全用标准库）；没有 Python
  就标注「未实测」，插件机审与工具链不受影响。
- **阈值不在本插件里**：想改门禁线请改 fiction-suite 的规范/脚本；想改机械门禁（字数区间、
  引号策略、熔断等）请改插件配置。
- **不在插件范围内**：拆书、漫剧/短剧审核、小说转剧本/分镜——继续按 fiction-suite 的路由
  直接跑，不走 `novel_*` 工具。

## 7. 验证清单

- [ ] 重启 DSH web 后，新建一本书（`novel_project init`）→ 写章落盘路径是
      `06-正文/第001章 章名.md`，且同章改稿**覆盖同一文件**、目录里没有 `-vK` 副本。
- [ ] 细纲落在 `04-细纲/第001章.md`；全书大纲 `03-分卷大纲/全书大纲.md`；人物卡
      `05-角色语言指纹/<角色名>.md`；承诺书 `02-设定圣经/故事承诺书.md`。
- [ ] 书根仍只有一套机器状态：`novel.json`、`账本/`、`设定/*.json`、`.novel/`；面板阅读/体检/
      提案审批正常。
- [ ] `novel_project status` 有输出；`novel_project check` 无索引缺失；`novel_search query`
      能命中旧章。
- [ ] 会话里模型先说「加载 fiction-suite」，再按场景路由读 reference；问它阈值来源时应指向
      `spec-quality-gates.md`。
- [ ] 定稿时 `tool-pwsh` 能跑 `novel_audit.py --kind 定稿`，交付里带 stdout 与退出码。
- [ ] 写章回执在书目录无 `.git` 时出现警告；`git init` + 首章 commit 后消失。
- [ ] 切回 `layout: forge` 并重启，旧书仍能读、写章回到 `正文/…-vK.md`。

## 8. 回滚

1. 改回 `layout: forge`、`versioning: versions`（或 `auto`），重启 DSH web。
2. 已有书：继续按 forge 路径读写（原文件未被动过）；**在 fiction-suite 布局下已写入的新章不会
   被自动搬回 forge 路径**——它们仍在 `06-正文/`，需要手工移动或留在 git 分支/提交里。
3. 建议回滚前先 commit 当前状态，用 `git diff` 看清「配置回滚」与「文件位置」两件事分开处理。
4. 卸载插件不会删除任何书稿；书目录可整体拷走，用 Obsidian/Git 直接读。
