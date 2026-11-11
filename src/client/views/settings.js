// src/client/views/settings.js — 设置页（1.8）：本书设置可改 + H5 网页版入口 + 能力清单。
//
// 为什么重写：旧页只是**只读**「能力清单」，用户问「能不能在面板里改设置」时答案是「不能」。
// 现在两件事都能在这里做：
//   ① 本书设置（每章字数区间 / 投放平台 / 作品简介）→ POST /projects/:id/settings
//      （与工具面 novel_project chars/platform、以及 H5 设置页同一个端点，一份真相）；
//   ② H5 网页版（阅读/工作台）入口 —— 面板卡顿时换独立渲染的 H5 页面。
// 注意：布局（forge/fiction-suite）与版本策略是**进程级插件配置**，改了要重启宿主，
// 这里只读展示、不给假开关。
import { h } from '../react.js';
import {
	color, space, font, weight, footerStyle, stackStyle, hintStyle, errStyle, okStyle, inputStyle,
} from '../styles.js';
import { Card, Btn, Chip, KV, Section, Feedback } from '../ui.js';

/** 平台选项：与 lib/store.js 的 PLATFORM_IDS 对齐（空串=未设置）。 */
const PLATFORMS = [
	{ id: '', name: '未设置（回落插件默认 2000–5000）' },
	{ id: 'qidian', name: '起点（2000–4000）' },
	{ id: 'fanqie', name: '番茄（1500–3000，建议落点 2800–2990）' },
	{ id: 'jjwxc', name: '晋江（3000–6000）' },
	{ id: 'qimao', name: '七猫（2000–3500）' },
	{ id: 'feilu', name: '飞卢（1500–5050）' },
];

/** 能力行：左侧打勾/点，右侧一句话人话。 */
function cap(can, text) {
	return h('div', { style: { display: 'flex', gap: space.sm, alignItems: 'flex-start', fontSize: font.small } },
		h('span', { style: { flex: 'none', color: can ? color.ok : color.textDim, width: '12px' } }, can ? '✓' : '·'),
		h('span', { style: { flex: '1 1 auto', minWidth: 0, color: can ? color.text2 : color.text3, lineHeight: 1.7 } }, text),
	);
}

function fieldLabel(text, hint) {
	return h('div', { style: { display: 'flex', alignItems: 'baseline', gap: space.sm } },
		h('span', { style: { fontSize: font.small, fontWeight: weight.semibold, color: color.text2 } }, text),
		hint ? h('span', { style: { ...hintStyle, fontSize: font.caption } }, hint) : null,
	);
}

export function SettingsView({ state: s = {} } = {}) {
	const bookId = s.selected ?? '';
	const hasBook = bookId !== '';
	const charView = s.detail?.charView;
	const fusion = s.detail?.fusion;
	const saving = s.settingsSaving === true;

	return h('div', { style: stackStyle(space.lg) },

		h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm } },
			Btn({ variant: 'ghost', size: 'sm', action: 'back-from-settings' }, '← 返回'),
			h('span', { style: { fontWeight: weight.semibold, fontSize: font.lead } }, '⚙ 设置'),
			h('span', { style: { flex: '1 1 auto' } }),
			Chip({}, 'v' + (window.__DSH_WEB_NOVEL_VERSION__ || '?')),
		),

		// ── 本书设置（可改） ─────────────────────────────────────────────
		Card({ tone: 'plain' },
			Section({ icon: '📖', title: hasBook ? `本书设置 · ${bookId}` : '本书设置' },
				hasBook
					? h('div', { style: stackStyle(space.md) },
						// 字数区间：空串=清除自定义，回落平台/插件口径；服务端一次性校验
						h('div', { style: stackStyle(space.xs) },
							fieldLabel('每章字数区间', `生效 ${charView?.charMin ?? '?'}–${charView?.charMax ?? '?'}（${charView?.charSource === 'custom' ? '本书自定义' : charView?.charSource === 'platform' ? '平台口径' : '插件默认'}）`),
							h('input', {
								'data-field': 'settings-chars',
								type: 'text',
								defaultValue: charView?.charLimits ?? '',
								placeholder: '如 2500-3500；留空=清除自定义',
								style: { ...inputStyle, width: '100%', boxSizing: 'border-box' },
							}),
							h('div', { style: { ...hintStyle, fontSize: font.caption } },
								'改这里等于改写章门禁/简报/细纲/审计的字数口径；番茄建议 2800–2990，别贴顶线。'),
						),
						// 平台：决定默认字数口径与机审口味
						h('div', { style: stackStyle(space.xs) },
							fieldLabel('投放平台', fusion?.platformName ? `当前：${fusion.platformName}` : '未设置'),
							h('select', {
								'data-field': 'settings-platform',
								defaultValue: fusion?.platform ?? '',
								style: { ...inputStyle, width: '100%', boxSizing: 'border-box', padding: '5px 6px' },
							}, PLATFORMS.map((p) => h('option', { key: p.id, value: p.id }, p.name))),
						),
						// 作品简介：写前简报与黄金三章诊断都会用
						h('div', { style: stackStyle(space.xs) },
							fieldLabel('作品简介', '进简报与诊断，≤500 字'),
							h('textarea', {
								'data-field': 'settings-logline',
								defaultValue: s.detail?.logline ?? '',
								rows: 3,
								maxLength: 500,
								placeholder: '例：穿越群演靠平行宇宙顶流群拿能力，一路写歌、拿权柄、拍出第一部长片。',
								style: { ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.7 },
							}),
						),
						h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' } },
							Btn({ variant: 'primary', size: 'sm', action: 'settings-save', disabled: saving }, saving ? '保存中…' : '保存本书设置'),
							Btn({ variant: 'ghost', size: 'sm', action: 'panel-mode-h5' }, '在 H5 里改'),
							s.settingsOk ? h('span', { style: okStyle }, s.settingsOk) : null,
						),
						s.settingsError ? Feedback({ tone: 'err' }, s.settingsError) : null,
						h('div', { style: { ...hintStyle, fontSize: font.caption } },
							'布局 / 版本策略是进程级插件配置（forge|fiction-suite、versions|git），改它需要编辑 profile 配置并重启 DSH web——这里只读展示，不给假开关。'),
					)
					: h('div', { style: stackStyle(space.sm) },
						h('div', { style: hintStyle }, '当前没有选中书。先在「书目」里打开一本，再回来改它的字数/平台/立意。'),
						Btn({ variant: 'secondary', size: 'sm', action: 'back-from-settings' }, '去书目'),
					),
			),
		),

		// ── H5 网页版（独立渲染，卡顿时的退路） ──────────────────────────
		Card({ tone: 'plain' },
			Section({ icon: '📱', title: 'H5 网页版' },
				h('div', { style: stackStyle(space.sm) },
					h('div', { style: { ...hintStyle, lineHeight: 1.7 } },
						'整体按 H5 网页设计：移动优先、纸/护眼/夜三主题、宋体 18px/2.0、段首缩进两端对齐；',
						'工作台 / 目录 / 阅读 / 设置四块。它跑在 iframe 里，样式与滚动和面板 React 树隔离——',
						'长列表卡顿时是更轻的退路。数据仍走同一套 REST + fence 门禁，不是第二份真相。'),
					h('div', { style: { display: 'flex', gap: space.sm, flexWrap: 'wrap' } },
						Btn({ variant: 'accent', size: 'sm', action: 'panel-mode-h5' }, '打开 H5 网页版'),
						hasBook ? Btn({ variant: 'secondary', size: 'sm', action: 'panel-mode-h5' }, `H5 阅读《${String(bookId).slice(0, 12)}》`) : null,
					),
				),
			),
		),

		// ── 已装配 / 能力边界 ────────────────────────────────────────────
		Card({ tone: 'plain' },
			Section({ icon: '🧩', title: '已装配' },
				h('div', { style: stackStyle(space.sm) },
					KV({ k: 'tools' }, '全部 novel_* 工具已注册'),
					KV({ k: '通道' }, '宿主工具面 + MCP 双通道 + REST 数据面（面板/H5 共用）'),
					KV({ k: '硬约束' }, '账本 / 门禁 / 机审 / 提案制——判定权在代码，不在模型'),
					KV({ k: '旁路引擎' }, '润色 / 校对 / 打标 / 起草四通道（不占主对话、不写会话记录）'),
					KV({ k: '检索' }, 'node:sqlite + FTS5 + 中文二元切分（纯本地）'),
				),
			),
		),
		Card({ tone: 'plain' },
			Section({ icon: '🛠', title: '这个面板能直接做' },
				h('div', { style: stackStyle(space.xs) },
					cap(true, '读章、改稿、存稿、导出、删除、改名、认领旧书'),
					cap(true, '一键润色 / 校对 —— 走旁路引擎，产物是提案，点「应用」才生效'),
					cap(true, '批量起草 —— 并发生成、串行提交，每章照样过全部门禁'),
					cap(true, '全书体检 —— 死人复活 / 账本矛盾 / 伏笔超期 / 章号断档（零 token）'),
					cap(true, '批准或丢弃模型提的修订；管理世界书；章节朗读连播'),
					cap(true, '克隆为模板；改本书字数区间 / 平台 / 作品简介'),
					cap(true, 'H5 网页版阅读与工作台（独立渲染）'),
				),
				h('div', { style: { marginTop: space.lg } },
					Section({ icon: '💬', title: '只能回会话里做' },
						h('div', { style: stackStyle(space.xs) },
							cap(false, '写章（novel_write_chapter）——面板「写单章」可落盘单章；拼全书上下文的完整写作流仍在会话'),
							cap(false, '去AI味评分 / 平台审稿 / 润色分析 —— 重蒸馏仍在会话工具'),
							cap(false, '生成大纲、角色卡、细纲、设定（novel_outline / character / worldbook 的生成侧）'),
							cap(false, '导入既有文稿（novel_import）、书库「饲料」对标分析（novel_library）'),
						),
					),
				),
			),
		),

		h('p', { style: footerStyle },
			'在会话里调用 novel_* 工具驱动写作；本面板只负责「确定性那部分」——',
			'凡是需要模型参与的动作，都会在审计里留下 actor 记录。'),
	);
}
