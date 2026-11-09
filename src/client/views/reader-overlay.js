// src/client/views/reader-overlay.js — 宽屏阅读/编辑浮层（FUSION 1.7）。
//
// 为什么需要它：右侧栏只有 ~360px，中文长章在窄栏里读是酷刑、改是折磨。
// 浮层用宿主页面宽度（panel width min(920px, 94vw)），正文 760px 限宽——
// 每行 30–40 字，是中文长文阅读的舒适区。
//
// 读与写是同一份数据：读态要「编辑」才切到 textarea；保存走既有
// POST /projects/:id/chapters/:no（与面板编辑器同一条 API、同一套门禁）。
// 浮层不取代面板编辑器，只是把「读/改」这一件事放到宽屏里做。
import { h } from '../react.js';
import {
	color, space, font, weight, hintStyle, errStyle,
	manuscriptStyle, readingParaStyle,
	overlayBackdropStyle, overlayPanelStyle, overlayHeaderStyle, overlayBodyStyle, overlayBodyInnerStyle,
} from '../styles.js';
import { Btn, Chip, Feedback } from '../ui.js';

/** 正文按空行切段（保留段内换行），空段丢弃。 */
function splitParagraphs(text) {
	return String(text ?? '')
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter((p) => p !== '');
}

export function ReaderOverlay({ state: s }) {
	const ov = s.readerOverlay;
	if (!ov) return null;
	const busy = ov.loading === true || ov.saving === true;
	const title = ov.title ? String(ov.title) : '';
	const paras = splitParagraphs(ov.text);

	const body = ov.loading
		? h('div', { style: { ...hintStyle, padding: space.xl } }, '取正文中…')
		: ov.error
			? h('div', { style: { padding: space.lg } }, Feedback({ tone: 'err' }, ov.error))
			: ov.editing
				? h('textarea', {
					'data-field': 'reader-draft',
					key: `reader-draft-${ov.no}-${ov.draftVersion ?? 0}`,
					defaultValue: ov.draft ?? '',
					'aria-label': `第 ${ov.no} 章正文（宽屏编辑）`,
					style: { ...manuscriptStyle, minHeight: '52vh', width: '100%', boxSizing: 'border-box' },
				})
				: h('div', { style: overlayBodyInnerStyle },
					paras.length === 0
						? h('div', { style: hintStyle }, ov.text ? '（这一章只有空白）' : '（这一章还没有正文）')
						: paras.map((para, i) => h('p', { key: i, style: readingParaStyle }, para)));

	return h('div', {
		'data-nf-overlay': '1',
		role: 'dialog',
		'aria-modal': 'true',
		'aria-label': `第 ${ov.no} 章 ${ov.editing ? '编辑' : '阅读'}`,
		style: overlayBackdropStyle,
	},
		h('div', { style: overlayPanelStyle },
			h('div', { style: overlayHeaderStyle },
				h('span', { style: { fontWeight: weight.semibold, fontSize: font.lead, flex: 'none' } },
					`第 ${ov.no} 章`),
				title
					? h('span', {
						style: {
							...hintStyle, fontSize: font.small, minWidth: 0, flex: '1 1 auto',
							overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
						},
					}, title)
					: h('span', { style: { flex: '1 1 auto' } }),
				Chip({ tone: 'neutral' }, `${String(ov.text ?? '').replace(/\s/g, '').length} 字`),
				ov.editing
					? Btn({ size: 'sm', variant: 'primary', action: 'reader-save', disabled: busy }, ov.saving ? '保存中…' : '💾 保存')
					: Btn({ size: 'sm', variant: 'ghost', action: 'reader-edit', disabled: busy }, '✎ 编辑'),
				ov.editing
					? Btn({ size: 'sm', variant: 'secondary', action: 'reader-cancel-edit', disabled: busy }, '取消编辑')
					: null,
				Btn({ size: 'sm', variant: 'ghost', action: 'reader-close', ariaLabel: '关闭宽屏阅读' }, '✕'),
			),
			h('div', { style: ov.editing ? { ...overlayBodyStyle, padding: space.lg } : overlayBodyStyle }, body),
			ov.editing
				? h('div', {
					style: {
						display: 'flex', gap: space.sm, alignItems: 'center', flexWrap: 'wrap',
						padding: `${space.sm}px ${space.lg}px`, borderTop: `1px solid ${color.border1}`,
					},
				},
					h('span', { style: { ...hintStyle, fontSize: font.caption } },
						'保存走与面板编辑器同一条 API：过机审/内容门禁/账本，被拦时原文会摆出来'),
					h('span', { style: { flex: '1 1 auto' } }),
					Btn({ size: 'sm', variant: 'secondary', action: 'reader-close' }, '直接关闭（不保存）'),
				)
				: h('div', {
					style: {
						display: 'flex', alignItems: 'center', gap: space.sm,
						padding: `${space.sm}px ${space.lg}px`, borderTop: `1px solid ${color.border1}`,
					},
				},
					h('span', { style: { ...hintStyle, fontSize: font.caption } },
						'宽屏阅读 · Esc 关闭 · 点「编辑」可改这一章（保存仍过门禁）'),
					h('span', { style: { flex: '1 1 auto' } }),
					Btn({ size: 'sm', variant: 'ghost', action: 'reader-close' }, '关闭'),
				),
		),
	);
}
