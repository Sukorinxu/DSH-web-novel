// src/client/views/h5-overlay.js — H5 网页版浮层（1.8）。
//
// 为什么要有 H5：右侧栏 React 面板在长列表/宽屏浮层下重渲染有卡顿感；
// H5 版是**零依赖单文件网页**（lib/h5-page.js，宿主 Route GET /h5 直接吐出 HTML），
// 放 iframe 里跑：样式/脚本与宿主 React 树彻底隔离，滚动、字体、主题都按 H5 自己设计。
// 数据不走任何新通道：页面内 fetch 仍带 fence 头打 /api/novel-forge/*（复用它既有的门禁与权限）。
//
// 分工：浮层只负责「壳」（标题 / 刷新 / 新窗口 / 关闭），H5 页面自己管内部导航。
import { h } from '../react.js';
import {
	space, color, font, weight, hintStyle,
	overlayBackdropStyle, overlayPanelStyle, overlayHeaderStyle,
} from '../styles.js';
import { Btn, Chip } from '../ui.js';

/** iframe 地址：书/会话可缺省（缺省时 H5 自己展示书架）。
 *  不用 URLSearchParams：测试的 headless 沙箱只提供最小 DOM，没有这个全局对象。 */
function h5Src(state) {
	const ov = state.h5Overlay ?? {};
	const parts = ['embed=1'];
	if (ov.book) parts.push(`book=${encodeURIComponent(ov.book)}`);
	if (state.sessionId) parts.push(`session=${encodeURIComponent(state.sessionId)}`);
	return `/api/novel-forge/h5?${parts.join('&')}`;
}

export function H5Overlay({ state: s }) {
	const ov = s.h5Overlay;
	if (!ov) return null;
	const src = h5Src(s);
	return h('div', {
		'data-nf-overlay': '1',
		role: 'dialog',
		'aria-modal': 'true',
		'aria-label': 'H5 网页版面',
		style: overlayBackdropStyle,
	},
		h('div', {
			style: {
				...overlayPanelStyle,
				// H5 是移动优先版式：给一个接近手机的窄面板，宽屏下也不摊成桌面页
				width: 'min(560px, 96vw)',
				height: 'min(94vh, 1000px)',
				padding: 0,
				display: 'flex',
				flexDirection: 'column',
				overflow: 'hidden',
			},
		},
			h('div', { style: { ...overlayHeaderStyle, flex: 'none', gap: space.sm } },
				h('span', { style: { fontWeight: weight.semibold, fontSize: font.lead, flex: 'none' } }, 'H5 阅读版'),
				h('span', {
					style: {
						...hintStyle, fontSize: font.small, minWidth: 0, flex: '1 1 auto',
						overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
					},
				}, ov.book ? String(ov.book) : '全部书目'),
				Chip({ tone: 'neutral' }, '移动优先'),
				Btn({ size: 'sm', variant: 'ghost', action: 'h5-reload', ariaLabel: '刷新 H5' }, '↻'),
				h('a', {
					href: src,
					target: '_blank',
					rel: 'noreferrer noopener',
					title: '在浏览器新窗口打开（宽屏阅读）',
					style: {
						fontSize: font.small, color: color.text2, textDecoration: 'none',
						padding: '4px 6px', borderRadius: 6, flex: 'none',
					},
				}, '新窗口 ↗'),
				Btn({ size: 'sm', variant: 'ghost', action: 'h5-close', ariaLabel: '关闭 H5 阅读版' }, '✕'),
			),
			h('iframe', {
				key: `h5-${ov.key ?? 0}`,
				src,
				title: 'H5 网页版面板',
				style: {
					flex: '1 1 auto',
					width: '100%',
					minHeight: 0,
					border: '0',
					background: '#faf7f2',
				},
			}),
			h('div', {
				style: {
					flex: 'none', padding: `${space.xs}px ${space.md}px`,
					borderTop: `1px solid ${color.border1}`, ...hintStyle, fontSize: font.caption,
				},
			}, 'Esc 关闭 · 数据与面板同源（同一套 REST + 门禁）· 设置改动即时生效'),
		),
	);
}
