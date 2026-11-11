// ⚠️ 自动生成，请勿直接编辑 —— 改 src/client/ 后跑 npm run build。
// 源码：src/client/index.js（+ forge-tab.js / session-watch.js / panel.js / views/*）
// 本产物是经典脚本：dsh 的 client-modules 按 CJS factory 执行它。
// 构建器：build-client.mjs（无 esbuild 环境的等价构建；契约与官方构建一致）
window.__ModuleLoader__.load({
	id: "dsh-web-novel",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __export = (target, all) => {
			for (var name in all) __defProp(target, name, { get: all[name], enumerable: true });
		};
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") {
				for (let key of __getOwnPropNames(from))
					if (!__hasOwnProp.call(to, key) && key !== except)
						__defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
			}
			return to;
		};
		var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
		var __cache = Object.create(null);
		var __factories = Object.create(null);
		function __m(key) {
			if (__cache[key] !== undefined) return __cache[key];
			if (key.slice(0, 5) === "@ext:") {
				var ext = require(key.slice(5));
				__cache[key] = ext;
				return ext;
			}
			var f = __factories[key];
			if (typeof f !== "function") throw new Error("[dsh-web-novel] 模块缺失: " + key);
			var moduleExports = {};
			__cache[key] = moduleExports;
			var produced = f(__m, moduleExports);
			if (produced !== undefined) {
				moduleExports = produced;
				__cache[key] = produced;
			}
			return moduleExports;
		}

		// ── src/client/forge-tab.js ──
		__factories["src/client/forge-tab.js"] = function (__m, __exports) {
// src/client/forge-tab.js — 右侧栏 tab 的「三步契约」（0.5.0 起入口回到右侧栏）。
//
// 官方契约（见 @deepseek-ai/dsh-client-ui-sidebar-right 的 lib/types/client/）：
//   ① `ctx.sidebarRightTabs.register(definition)` —— **声明**有这么一种 tab；
//   ② `ctx.slots.register({ name: 'sidebar.right.pane.tab', key: <definition.id> }, Panel)`
//      —— 给这种 tab 提供内容（key 用 definition 的 `id`，不是 `kind`）；
//   ③ `ctx.sidebarRight.openTab(<definition.kind>)` —— **真正把它放上屏幕**。
//
// 最坑的一点：只做①②、没人调③时，**一格都不会多，也不报任何错**。
// register 的语义是「声明」，不是「放上去」——这正是「右侧栏 tab 死活不出现」
// 的第一大误判来源（会被误认成 bundle 没加载 / 缓存问题）。
//
// 为什么第③步要「延迟 + 重试」：`openTab` 在 seat **挂载前**调用会直接抛错
// （引擎有意设计：没有 session 可操作时宁可报错，也不静默写进没人画的面）。
// 而右侧栏若处于折叠态，seat 可能迟迟不挂载 —— 所以窗口给到 30 秒。
/** 本实现在 tab 系统里的身份：`definition.id`，也是内容 seat 的 key。 */
const TAB_ID = 'dsh-web-novel';

/** tab 类型判别符：`openTab` 用它点名（语义与 id 不同，别混）。 */
const TAB_KIND = 'dsh-web-novel';

/**
 * ① 类型定义（纯静态：认领什么地址、叫什么、guide 里给不给入口胶囊）。
 * 不给 `patterns` ⇒ **page type**：由 kind 打开，不认领地址。
 */
function tabDefinition() {
	return {
		id: TAB_ID,
		kind: TAB_KIND,
		priority: 'extension',
		title: () => '📚 造神',
		// guide 是「右侧栏常驻页」里的入口胶囊 —— 跨会话都在，
		// 自动打开失败 / 被用户关掉时，这是手动通道（保底入口）。
		guide: [{
			order: 90,
			title: () => '造神',
			description: () => '本会话的小说项目：章节 / 账本 / 世界书',
		}],
	};
}

/**
 * 注册①②步。返回 disposer（交给 ctx.effect 的返回值语义）。
 * @param {object} ctx cordis 客户端上下文
 * @param {Function} Panel tab 内容组件
 */
function registerForgeTab(ctx, Panel) {
	ctx.effect(() => ctx.sidebarRightTabs.register(tabDefinition()),
		'dsh-web-novel: 右侧栏 tab 类型');
	// `slots.inject(name, cb)`：等这个 seat 可用再注册（官方 documentpreview 同款写法）
	ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
		name: 'sidebar.right.pane.tab',
		key: TAB_ID,
		// inject 工厂是面板 props 的唯一来源：**sessionId 只有这里能拿到**，
		// 面板靠它把项目列表按会话过滤（「项目跟会话走」）。
		inject: (sessionId) => ({ sessionId }),
	}, Panel)), 'dsh-web-novel: 右侧栏 tab 内容');
}

/**
 * ③ 打开 tab —— 必须延迟 + 重试，见文件头。
 * @param {object} ctx
 * @param {object} [opts]
 * @param {Function} [opts.timer] 注入的 setTimeout（测试用）
 * @param {number} [opts.maxTries] 重试上限（250ms × 120 ≈ 30s）
 * @param {Function} [opts.log]
 * @returns {Function} 立刻尝试一次并链式重试；返回 true 表示这次开成了
 */
function openForgeTab(ctx, opts = {}) {
	const timer = opts.timer ?? setTimeout;
	const log = opts.log ?? console;
	const maxTries = opts.maxTries ?? 120;
	let tries = 0;
	let opened = false;
	let disposed = false;

	const attempt = () => {
		if (disposed || opened) return true;
		try {
			ctx.sidebarRight.openTab(TAB_KIND);
			opened = true;
			log.info('[dsh-web-novel] 已打开右侧栏 tab（造神）');
			return true;
		} catch (error) {
			tries += 1;
			if (tries < maxTries) {
				timer(attempt, 250);
			} else {
				log.warn('[dsh-web-novel] 自动打开右侧栏 tab 失败，可从右侧栏 guide 页手动进入', error);
			}
			return false;
		}
	};

	timer(attempt, 400);          // 首次延迟：给 seat 挂载留时间
	return () => { disposed = true; };
}

			return { "TAB_ID": TAB_ID, "TAB_KIND": TAB_KIND, "tabDefinition": tabDefinition, "registerForgeTab": registerForgeTab, "openForgeTab": openForgeTab };
		};

		// ── src/client/session-watch.js ──
		__factories["src/client/session-watch.js"] = function (__m, __exports) {
// src/client/session-watch.js — 「按会话发现项目并打开 tab」的调度层。
//
// ⚠️ 现状（0.13.x）：造神已改为右侧栏**常驻独立 tab**，apply() 不再调用本模块的
// startForgeAutoOpen —— 目前只有 __internals 与测试引用它。保留它是为了「将来若要
// 收回按会话门控」时有一条现成可用的通道；在此之前，别把它当成线上入口。
//
// 产品语义（若重新启用）：
//   · 入口放**右侧栏**（不再是左侧栏 DOM 注入）；
//   · 只在会话里真的有了小说项目时才把它放上屏幕 —— 没写过小说的会话不打扰；
//   · 项目 = **本会话**的项目，会话里创建了几本就几本（按会话过滤，见 lib/store.js 的 sessions）。
//
// 怎么判断「本会话有项目」：服务端 REST `GET /projects?session=<id>` 只回本会话的书。
// 客户端拿当前会话 id 的唯一正道是 `ctx.sessions.list`（ObservableSnapshot<SessionListState>，
// 其中 `current: SessionId`）—— 这条比从 URL 或 DOM 里抠 id 稳得多。
//
// 为什么还要轮询：书是**会话里的 AI 调工具**创建的，客户端不会收到通知。
// 会话切换时查一次 + 未打开时每 8 秒轻量轮询一次，直到该会话的项目出现为止；
// 一旦为某个会话打开过就不再重复（关掉是用户的自由，不跟用户抢）。
const { apiFetch } = __m("src/client/api.js");
const { openForgeTab } = __m("src/client/forge-tab.js");

/** 轮询间隔：只查「本会话有没有项目」，请求极小。 */
const POLL_INTERVAL_MS = 8000;

/**
 * 读当前会话 id。
 *
 * `ctx.sessions.list` 是 ObservableSnapshot，真机形态是 `getSnapshot()` + `subscribe()`；
 * 这里对三种可能形态都做兜底（getSnapshot / snapshot() / 裸对象），任一形态变了都不至于瞎。
 * @returns {string|null}
 */
function currentSessionId(ctx) {
	const face = ctx?.sessions?.list;
	if (!face) return null;
	let snapshot = null;
	try {
		if (typeof face.getSnapshot === 'function') snapshot = face.getSnapshot();
		else if (typeof face.snapshot === 'function') snapshot = face.snapshot();
		else snapshot = face;
	} catch {
		return null;
	}
	const id = snapshot?.current;
	return typeof id === 'string' && id !== '' ? id : null;
}

/**
 * 订阅会话切换（拿不到订阅面时退化成空实现 —— 后面还有轮询兜底）。
 * @returns {Function} 取消订阅
 */
function onSessionChange(ctx, listener) {
	const face = ctx?.sessions?.list;
	if (!face || typeof face.subscribe !== 'function') return () => {};
	try {
		const off = face.subscribe(() => listener(currentSessionId(ctx)));
		return typeof off === 'function' ? off : () => {};
	} catch {
		return () => {};
	}
}

/**
 * 启动「有项目才显示」调度。
 * @param {object} ctx cordis 客户端上下文
 * @param {object} [opts]
 * @param {Function} [opts.fetchProjects] 取本会话项目（默认 REST）
 * @param {number}   [opts.intervalMs]
 * @param {Function} [opts.setTimer]
 * @param {Function} [opts.clearTimer]
 * @param {Function} [opts.openTab] 打开 tab 的策略（默认延迟重试版）
 * @param {object}   [opts.log]
 * @returns {Function} stop
 */
function startForgeAutoOpen(ctx, opts = {}) {
	const intervalMs = opts.intervalMs ?? POLL_INTERVAL_MS;
	const setTimer = opts.setTimer ?? setTimeout;
	const clearTimer = opts.clearTimer ?? clearTimeout;
	const log = opts.log ?? console;
	const fetchProjects = opts.fetchProjects
		?? ((sessionId) => apiFetch(`/projects?session=${encodeURIComponent(sessionId)}`));
	const openTab = opts.openTab ?? ((c) => openForgeTab(c, { timer: setTimer, log }));

	/** 已经自动打开过的会话 —— 不重复打扰（用户手动关掉后也不强行再开）。 */
	const opened = new Set();
	let stopped = false;
	let inflight = false;
	let timerId = null;

	const check = async () => {
		if (stopped || inflight) return;
		const sessionId = currentSessionId(ctx);
		if (sessionId === null || opened.has(sessionId)) return;
		inflight = true;
		try {
			const books = await fetchProjects(sessionId);
			if (!stopped && !opened.has(sessionId) && Array.isArray(books) && books.length > 0) {
				opened.add(sessionId);
				log.info(`[dsh-web-novel] 本会话有 ${books.length} 个项目 → 打开右侧栏 tab`);
				openTab(ctx);
			}
		} catch {
			// 服务端还没起来 / 面板未挂载 / 会话刚切走：都不是错，下一轮再说
		} finally {
			inflight = false;
		}
	};

	const schedule = () => {
		if (stopped) return;
		timerId = setTimer(() => { void check(); schedule(); }, intervalMs);
	};

	const off = onSessionChange(ctx, () => { void check(); });
	void check();          // 冷启动先查一次
	schedule();

	return () => {
		stopped = true;
		try { off(); } catch { /* 订阅面已拆 */ }
		if (timerId !== null) clearTimer(timerId);
	};
}

			return { "POLL_INTERVAL_MS": POLL_INTERVAL_MS, "currentSessionId": currentSessionId, "onSessionChange": onSessionChange, "startForgeAutoOpen": startForgeAutoOpen };
		};

		// ── src/client/api.js ──
		__factories["src/client/api.js"] = function (__m, __exports) {
// src/client/api.js — 与服务端半（lib/server-api.js）通话的唯一出口。
//
// 契约：所有响应都是 `{ ok: true, value } | { ok: false, error: { code, message } }`；
// `ok:false` 直接抛错，让调用方统一走 try/catch，不用每次判空。
// 每个请求都带 fence header —— 服务端拿它当跨站调用门禁（缺失即 403）。

/** REST 基础路径，与 lib/server-api.js 的挂载点必须一致。 */
const API_BASE = '/api/dsh-web-novel';

/** 服务端门禁头：值不重要，存在即可。 */
const FENCE = 'x-dsh-web-novel';

/** 单请求超时（毫秒）：卡死的请求 12 秒后必须变成可见错误，不许永远「加载中」。 */
const FETCH_TIMEOUT_MS = 12_000;

// ── 会话归属：在唯一一个出口收口，不逐处补参数 ─────────────────────────────
// 「书跟会话走」要求每个按书定位的请求都带上会话 id（服务端 locateBook 靠它在多根
// 同名书里挑对用户看到的那份拷贝）。此前只有列表/详情带了，章节目录/阅读器/听书/
// 保存/提案/导出/删除全都按根排序定位——书卡显示 A 拷贝（105 章）、点进去读到的是
// B 拷贝（103 章），删除还会删错那本（2026-10-19 真机实锤）。
// 逐处补参数的做法已经被证明会漏：漏一处就是漏一路，新加端点还会再漏。
// 所以这里在 apiFetch 内部按**书作用域路径**统一附加——未来新增 /projects/… 端点
// 自动就在护栏内，不需要任何人记得补。
let sessionProvider = () => null;

/** 注入会话 id 来源（panel 装配时调用；不注入 = 一律不带，行为回旧版）。 */
function setSessionProvider(fn) {
	sessionProvider = typeof fn === 'function' ? fn : (() => null);
}

/**
 * 是否属于「按某一本书定位」的路径。
 * 裸 `/projects`（列表）由调用方自己控范围（sessionScope 决定带不带 session），不在此列；
 * `LITERAL_ACTIONS` 是挂在 /projects 下的**动作段**而非书目名——服务端按字面量匹配它们，
 * 给它们附加 session 既没意义也会让 URL 断言变得含混。**新增这类字面量段时必须登记到这里。**
 */
const LITERAL_ACTIONS = ['/projects/claim'];

function isBookScopedPath(path) {
	if (LITERAL_ACTIONS.some((lit) => path === lit || path.startsWith(`${lit}/`))) return false;
	return path.startsWith('/projects/') || path.startsWith('/worldbook/');
}

function withSession(path) {
	if (!isBookScopedPath(path) || /[?&]session=/.test(path)) return path;
	const sid = sessionProvider();
	if (typeof sid !== 'string' || sid === '') return path;
	const sep = path.includes('?') ? '&' : '?';
	return `${path}${sep}session=${encodeURIComponent(sid)}`;
}

/**
 * 调一次 REST 端点，返回 `value`；失败抛 Error。
 * @param {string} path 相对 API_BASE 的路径，如 `/projects/书/export`
 * @param {object} [init] fetch 的第二参（method / body 等）；`timeoutMs` 可覆盖超时
 */
async function apiFetch(path, init) {
	const finalPath = withSession(path);
	const timeoutMs = init?.timeoutMs ?? FETCH_TIMEOUT_MS;
	const ac = typeof AbortController === 'function' && timeoutMs > 0 ? new AbortController() : null;
	const timer = ac ? setTimeout(() => ac.abort(), timeoutMs) : null;
	let response;
	try {
		response = await fetch(`${API_BASE}${finalPath}`, {
			...init,
			signal: init?.signal ?? ac?.signal,
			headers: { ...(init?.headers ?? {}), [FENCE]: '1', 'content-type': 'application/json' },
		});
	} catch (error) {
		// 超时、断网、调用方自己中止在这里「长相一样」（都是 fetch reject），分开说人话：
		const aborted = error?.name === 'AbortError';
		if (aborted) {
			// 只有当我们**自己**那个超时 controller 触发时才叫「请求超时」；
			// 调用方自带 signal 中止的（不用超时），不该误报成超时。
			throw new Error(ac && !init?.signal
				? `请求超时：${path}（${Math.round(timeoutMs / 1000)} 秒无响应，服务可能没起或被浏览器扩展/代理拦截）`
				: `请求已中止：${path}（信号取消）`);
		}
		throw new Error(`网络错误：${String(error?.message ?? error)}`);
	} finally {
		if (timer) clearTimeout(timer);
	}
	let payload;
	try {
		payload = await response.json();
	} catch {
		// 典型场景：dsh 重启后旧页面的请求被 401 成 text/plain，或代理回了 HTML
		throw new Error(`响应不是 JSON（HTTP ${response.status}）—— 页面可能过期，硬刷新（Cmd+Shift+R）后再试`);
	}
	if (!payload.ok) {
		// code 必须挂在 Error 上一起抛：调用方要按错误族分流（409 GATE_REJECTED 是
		// 「内容没过门禁」，给二次确认；500 IO_FAILURE 是服务故障，只报错不给重试按钮）。
		// 只抛 message 的话，分流就得靠正则匹配中文文案——那正是会静默漂移的写法。
		const gateError = new Error(payload.error?.message ?? `HTTP ${response.status}`);
		gateError.code = payload.error?.code ?? '';
		gateError.status = response.status;
		throw gateError;
	}
	return payload.value;
}

			return { "API_BASE": API_BASE, "FENCE": FENCE, "FETCH_TIMEOUT_MS": FETCH_TIMEOUT_MS, "setSessionProvider": setSessionProvider, "apiFetch": apiFetch };
		};

		// ── src/client/panel.js ──
		__factories["src/client/panel.js"] = function (__m, __exports) {
// src/client/panel.js — 右侧栏「造神」面板：控制器装配（状态 + 共享 ctx + 子控制器接线）+ React 组件。
//
// 与 0.4.x 的差别：那时候是一个**自建 root 的全屏抽屉**（position:fixed + display 切换），
// 0.5.0 起交给**右侧栏 slot 框架**渲染 —— 我们只返回 element，不再自己 createRoot，
// 于是「点一次没反应 / 再点一次整屏空白」（createRoot 取错包）那类事故从根上消失。
//
// 分工：
//   views/*              纯渲染，只读 state
//   controllers/*        业务域（projects / chapters / proposals / lore / events），读写共享 ctx
//   panel.js             装配：建 state/ctx/守卫、接线子控制器、返回对外 API
//   forge-tab.js         把它挂进右侧栏（三步契约）
//
// 交互仍走 `data-action` + 容器级**原生** click 代理 —— 宿主环境里 React 合成事件
// 不可靠（这也是全篇不写 onClick 的原因）；面板容器是 slot 框架画的 DOM，
// 在上面 addEventListener 完全正常。
//
// 「项目跟会话走」：所有列表/创建/认领请求都带 sessionId（来自 slot inject 工厂）。
const { h, Component, useState, useRef, useEffect } = __m("src/client/react.js");
const { initialState } = __m("src/client/state.js");
const { apiFetch, setSessionProvider } = __m("src/client/api.js");
const { createTtsPlayer, resolveSynth } = __m("src/client/tts.js");
const { rootStyle, bodyStyle, headerStyle, brandMarkStyle, titleStyle, subtitleStyle, chip, space, color, font, weight } = __m("src/client/styles.js");
const { ProjectListView } = __m("src/client/views/project-list.js");
const { ProjectDetailView } = __m("src/client/views/project-detail.js");
const { LorebookView } = __m("src/client/views/lorebook.js");
const { SettingsView } = __m("src/client/views/settings.js");
// 面板根属性 + 交互态样式表（:hover/:active 只能靠样式表，内联压不过它们）
const { PANEL_ATTR, ensureStyles } = __m("src/client/css.js");
// 业务域子控制器：各自只依赖共享 ctx（state/notify/seq/player + 晚绑定的跨域动作）
const { createChaptersController } = __m("src/client/controllers/chapters.js");
const { createLoreController } = __m("src/client/controllers/lore.js");
const { createProposalsController } = __m("src/client/controllers/proposals.js");
const { createProjectsController } = __m("src/client/controllers/projects.js");
const { createEventsController } = __m("src/client/controllers/events.js");


/**
 * 渲染错误边界：某个视图抛错时只把这块换成报错文案，
 * 而不是让整棵 slot 树卸载（用户看到的是「面板空白」）。
 */
const ForgeBoundary = typeof Component === 'function'
	? class extends Component {
		constructor(props) { super(props); this.state = { error: null }; }
		static getDerivedStateFromError(error) { return { error }; }
		componentDidCatch(error) { console.error('[dsh-web-novel] 面板渲染失败：', error); }
		render() {
			if (this.state.error) {
				return h('div', { style: { padding: '16px', color: color.danger, fontSize: '12.5px', lineHeight: 1.7, whiteSpace: 'pre-wrap' } },
					'面板渲染失败：' + String(this.state.error?.message ?? this.state.error));
			}
			return this.props.children;
		}
	}
	: null;

/**
 * 建一个面板控制器。
 *
 * 状态放闭包对象、改完手动 notify()（与 0.4.x 一致）：这样 headless 测试
 * 可以构造 controller 直接驱动断言，不必渲染 React。
 *
 * 域拆分见 controllers/*：本函数只负责建 state/守卫/播放器，把各域动作装进共享 ctx
 * 再接线。跨域调用（如 openProject→loadProposals）走 ctx 晚绑定，因此各域之间没有
 * 模块级循环 import。
 *
 * @param {object} [opts]
 * @param {string|null} [opts.sessionId] 当前会话（slot inject 工厂给的）
 * @param {Function} [opts.onChange] 需要重渲染时的回调
 */
function createForgeController({ sessionId = null, resolveSessionId = null, onChange = () => {}, openSession = null } = {}) {
	const state = initialState();
	state.sessionId = sessionId ?? null;

	const notify = () => {
		try { onChange(); } catch (error) { console.error('[dsh-web-novel] 面板重渲染失败：', error); }
	};

	/** 会话 id 校正：slot inject 的标识可能与真 agent 会话 id 不同源（0.13.2 真机实锤：
	 *  session-watch 用 sessions 服务的 id 能探到书，slot 的 id 过滤却是空、
	 *  服务端 agents.get(slot id) 也找不到父会话）。sessions 服务的「当前会话」
	 *  是已被证实能对上的来源 —— 发请求前对齐一次，过滤 / parent 锚定 / 认领 / 创建
	 *  就都落在真 id 上。 */
	const syncSession = () => {
		if (typeof resolveSessionId !== 'function') return;
		try {
			const id = resolveSessionId();
			if (typeof id === 'string' && id !== '' && id !== state.sessionId) state.sessionId = id;
		} catch { /* sessions 面不可得：留在 slot inject 的 id 上 */ }
	};

	/**
	 * 显式给某个路径带会话（目前只有列表要用：?session= 与 scope=all 是二选一的关系，
	 * 由 sessionScope 开关决定，不能交给自动附加）。
	 * 按书定位的请求（/projects/:id/…、/worldbook/:book）由 api.js 的 apiFetch **自动**附加
	 * ——那才是「项目跟会话走」的真收口，逐处补参数一定会漏（2026-10-19 就是这么分家的）。
	 */
	const withSession = (path) => {
		syncSession();
		if (!state.sessionId) return path;
		const sep = path.includes('?') ? '&' : '?';
		return `${path}${sep}session=${encodeURIComponent(state.sessionId)}`;
	};
	// 把会话 id 的来源交给 api.js（它只负责附加，不关心 id 怎么解析——解析纪律仍在这里）。
	setSessionProvider(() => { syncSession(); return state.sessionId; });

	// ── 陈旧响应守卫（请求序号）──
	// openProject / loadChapter 都是「await 完成后写 state」：快速连续切换时，
	// 慢响应后到会把新状态覆盖成旧内容（编辑器显示别章正文；此时点保存，
	// saveChapter 会把 A 章内容 POST 到现行 chapterNo —— 写错章）。每次发起
	// 切换自增序号，响应落地前比对，过期即弃。放共享对象里由各域共写共读。
	const seq = { open: 0, chapter: 0 };

	// ── 章节听书（0.6.0）──
	// 播放器先建好；onChange 把播放状态写进 state 再触发重渲染。
	// synth 可能为 null（无语音引擎的环境）：playFrom 会抛可读错误，面板转成提示。
	const player = createTtsPlayer({
		synth: resolveSynth(),
		loadChapter: (no) => apiFetch(`/projects/${encodeURIComponent(state.selected)}/chapters/${no}`),
		hasChapter: (no) => state.chapterList.some((c) => c.no === no),
		// 连播/空章跳过都要"下一个存在的章"，不是 currentNo+1 —— 章号有缺口不能早停
		//（chapterList 服务端已按 no 升序排）
		nextChapterAfter: (no) => {
			const n = state.chapterList.find((c) => c.no > no);
			return n ? n.no : null;
		},
		onChange: (playback) => { state.playback = playback; notify(); },
	});

	// 共享上下文：各子控制器往这里挂自己的动作；跨域调用（如 openProject 要拉提案）
	// 在装配完成后才发生，晚绑定天然解环。
	// openSession = 宿主客户端导航面（index.js 递进来的 props，可为 null）。
	const ctx = { state, notify, syncSession, withSession, seq, player, openSession };
	Object.assign(ctx, createChaptersController(ctx));
	Object.assign(ctx, createLoreController(ctx));
	Object.assign(ctx, createProposalsController(ctx));
	Object.assign(ctx, createProjectsController(ctx));
	Object.assign(ctx, createEventsController(ctx));

	let started = false;
	/** 首次挂载后拉数据（幂等）。 */
	const start = () => {
		if (started) return;
		started = true;
		void ctx.refreshProjects();
	};

	/** 会话切换：换 id 并重新拉列表（面板是按会话的账本）。 */
	const setSession = (next) => {
		const id = next ?? null;
		if (state.sessionId === id) return;
		state.sessionId = id;
		// 序号作废（CodeBuddy 审计 2026-10-09 L2）：切换瞬间在途的 loadChapter/
		// openProject 响应若仍算「有效」，会把旧会话旧书的正文写进 draft/baseline。
		seq.open += 1; seq.chapter += 1;
		player.stop();
		state.selected = null; state.detail = null; state.view = 'projects'; state.chapterList = [];
		state.rename = null; state.listDeleteId = null; state.clone = null;
		state.sessionScope = 'session';
		state.loreDeleteId = null; state.filter = '';
		started = true;
		notify();
		void ctx.refreshProjects();
	};

	return {
		state, notify, attach: ctx.attach, detach: ctx.detach, start, setSession,
		refreshProjects: ctx.refreshProjects, handleAction: ctx.handleAction, syncSession,
		loadProposals: ctx.loadProposals, refreshProposalsIfIdle: ctx.refreshProposalsIfIdle,
		stopPlayback: () => player.stop(),
	};
}

/**
 * 头部副题：面板现在在哪一层、手上是什么。
 * 这行字是「我在哪」的唯一提示，别省。
 */
function panelSubtitle(s) {
	if (s.view === 'detail') {
		const title = s.detail?.title || s.selected || '这本书';
		const n = (s.chapterList ?? []).length;
		return n > 0 ? `${title} · 已写 ${n} 章` : title;
	}
	if (s.view === 'lorebook') return `${s.selected || '默认'} · 世界书`;
	if (s.view === 'settings') return '设置 · 本书 / H5';
	const total = (s.projects ?? []).length;
	if (s.loading && total === 0) return '载入中…';
	const unclaimed = (s.unclaimed ?? []).length;
	return `${total} 本书` + (unclaimed > 0 ? ` · ${unclaimed} 本待认领` : '');
}

/**
 * H5 内嵌页地址：书/会话可缺省（H5 自己展示书架）。
 * 不用 URLSearchParams：测试的 headless 沙箱只提供最小 DOM，没有这个全局对象。
 */
function panelH5Src(s) {
	const parts = ['embed=1'];
	if (s.selected) parts.push(`book=${encodeURIComponent(s.selected)}`);
	if (s.sessionId) parts.push(`session=${encodeURIComponent(s.sessionId)}`);
	return `/api/dsh-web-novel/h5?${parts.join('&')}`;
}

/**
 * 右侧栏面板组件（slot 框架渲染它）。
 * props.sessionId 由 forge-tab.js 的 inject 工厂注入；props.resolveSessionId 由
 * index.js 的包装闭包注入（读 sessions 服务的当前会话 —— 0.13.2 起 slot 标识
 * 与真 agent 会话 id 被证实可能不同源，发请求前以 resolver 对齐为准）。
 */
function ForgePanel(props) {
	const sessionId = props?.sessionId ?? null;
	const resolveSessionId = props?.resolveSessionId ?? null;
	const [, forceTick] = useState(0);
	const controllerRef = useRef(null);
	const nodeRef = useRef(null);

	if (controllerRef.current === null) {
		controllerRef.current = createForgeController({
			sessionId,
			resolveSessionId,
			onChange: () => forceTick((n) => n + 1),
		});
	}
	const controller = controllerRef.current;

	// 会话切换（同一个面板实例被复用到别的会话）
	useEffect(() => { controller.setSession(sessionId); }, [sessionId]);

	// 挂载：注入交互态样式表 + 绑事件代理 + 首次拉数据；卸载：停播 + 解绑
	//（面板被宿主拆掉时朗读必须跟着停 —— 否则 tab 关了还在出声）
	useEffect(() => {
		// 只注入、不回收：样式表是**全局单例**（宿主会反复装配，必须查到就收养）。
		// 放在挂载里而不是 apply()：面板没渲染时不该往宿主页面塞样式。
		ensureStyles();
		const node = nodeRef.current;
		if (node) controller.attach(node);
		controller.start();
		// 页面重新可见/窗口聚焦 → 重拉提案队列（写作会话可能刚提交了新提案）
		const reloadIfIdle = () => controller.refreshProposalsIfIdle();
		document.addEventListener('visibilitychange', reloadIfIdle);
		window.addEventListener('focus', reloadIfIdle);
		return () => {
			controller.stopPlayback(); controller.detach();
			document.removeEventListener('visibilitychange', reloadIfIdle);
			window.removeEventListener('focus', reloadIfIdle);
		};
	}, []);

	const s = controller.state;

	// 经典 React 面板已下线：右侧栏始终渲染 H5（用户 2026-11-10 定：入口全部删掉，默认 H5）。
	{
		return h('div', {
			[PANEL_ATTR]: '1',
			ref: nodeRef,
			'data-nf-panel-mode': 'h5',
			style: { height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', background: color.surface1 },
		},
			h('div', {
				style: {
					flex: 'none', display: 'flex', alignItems: 'center', gap: space.sm,
					padding: '5px 8px', borderBottom: `1px solid ${color.border1}`, background: color.surface2,
				},
			},
				h('span', { style: { fontWeight: weight.semibold, fontSize: font.small, flex: 'none' } }, '📚 造神 · H5'),
				h('span', {
					style: {
						flex: '1 1 auto', minWidth: 0, fontSize: font.caption, color: color.text3,
						overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
					},
				}, s.detail?.title || s.selected || '作品详情'),
				h('button', {
					'data-action': 'h5-refresh',
					'data-nf-btn': '1', 'data-variant': 'secondary',
					title: '刷新 H5',
					style: { flex: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '11px', lineHeight: 1, padding: '4px 7px', borderRadius: '6px' },
				}, '↻'),
				h('a', {
					href: panelH5Src(s), target: '_blank', rel: 'noreferrer noopener',
					title: '在浏览器新窗口打开（宽屏阅读）',
					style: { flex: 'none', fontSize: font.caption, color: color.text2, textDecoration: 'none', padding: '3px 5px' },
				}, '↗'),
			),
			h('iframe', {
				key: `panel-h5-${s.selected ?? ''}-${s.sessionId ?? ''}-${s.h5RefreshKey ?? 0}`,
				src: panelH5Src(s),
				title: 'H5 网页版面板',
				style: { flex: '1 1 auto', width: '100%', minHeight: 0, border: 0, background: '#f5f6f7' },
			}),
		);
	}

	const view = h('div', {
		[PANEL_ATTR]: '1',
		ref: nodeRef,
		style: rootStyle,
	},
		// 品牌条：图标块 + 标题（含版本）+ 副题 + 会话范围
		h('div', { style: headerStyle },
			h('div', { style: brandMarkStyle }, '📚'),
			h('div', { style: { flex: '1 1 auto', minWidth: 0 } },
				h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm } },
					h('span', { style: titleStyle }, '造神'),
					h('span', { style: chip() }, 'v' + (window.__DSH_WEB_NOVEL_VERSION__ || '?')),
				),
				h('div', { style: subtitleStyle }, panelSubtitle(s)),
			),
			s.sessionId
				? h('button', {
					'data-action': 'toggle-scope',
					title: '书单范围：本会话 ⇄ 全部项目（多会话各写各的书，只看本会话会漏掉别的会话建的书）',
					style: { ...chip({ tone: s.sessionScope === 'all' ? 'neutral' : 'accent' }), alignSelf: 'flex-start', cursor: 'pointer' },
				}, s.sessionScope === 'all' ? '全部项目' : '本会话')
				: h('span', {
					style: { ...chip({ tone: 'neutral' }), alignSelf: 'flex-start' },
				}, '全部项目'),
			// 形态切换：H5 是默认展示，经典面板是手动入口（1.9）
			h('button', {
				'data-action': 'panel-mode-h5',
				'data-nf-btn': '1', 'data-variant': 'secondary',
				title: 'H5 网页版（移动优先阅读/工作台，独立渲染不拖面板）',
				'aria-label': '切换到 H5 网页版',
				style: {
					flex: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px',
					lineHeight: 1, padding: '5px 8px', borderRadius: '8px',
				},
			}, 'H5版'),
			// 设置入口常驻在头部：详情页/世界书页都够不到列表页那个按钮，
			// 用户想看一眼「面板到底能做什么」时不该先退回列表
			h('button', {
				'data-action': 'goto-settings',
				// 走按钮皮肤：底/描边/字色交给 css.js，这样它有悬停与按下反馈
				'data-nf-btn': '1', 'data-variant': 'secondary',
				title: '设置 · 能力清单',
				'aria-label': '设置 · 能力清单',
				style: {
					flex: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px',
					lineHeight: 1, padding: '5px 7px', borderRadius: '8px',
				},
			}, '⚙'),
		),
		h('div', { style: bodyStyle },
			s.view === 'projects' ? h(ProjectListView, { state: s }) : null,
			s.view === 'detail' ? h(ProjectDetailView, { state: s }) : null,
			s.view === 'lorebook' ? h(LorebookView, { state: s }) : null,
			s.view === 'settings' ? h(SettingsView, { state: s }) : null,
		),
	);

	return ForgeBoundary ? h(ForgeBoundary, null, view) : view;
}
			return { "PANEL_ATTR": PANEL_ATTR, "createForgeController": createForgeController, "ForgePanel": ForgePanel };
		};

		// ── src/client/react.js ──
		__factories["src/client/react.js"] = function (__m, __exports) {
// src/client/react.js — 从宿主模块表取 React 的**唯一出口**。
//
// 为什么要有这个文件（两次真机事故的教训）：
//
// ① **`createRoot` 不在 `react` 里，在 `react-dom/client` 里。**
//    0.4.x 的全屏抽屉自己建 root，写成 `react.createRoot(node)` → 真机 TypeError，
//    表现是「第 1 次点击没反应（容器停在 display:none）、第 2 次点击整屏空白」，
//    极具迷惑性。0.5.0 起面板改由**右侧栏 slot 框架**渲染（我们只返回 element，
//    不自己 createRoot），这条坑随之消失；但历史写在这里，换回自建 root 时别重踩。
// ② 宿主播种的模块表（官方 CHUNK_EXTERNALS / PLATFORM_MODULES）只有：
//    react · react/jsx-runtime · react-dom · react-dom/client · cordis
//    · @deepseek-ai/dsh-client-ui-slots · @deepseek-ai/dsh-client-ui-primitives
//    —— 别 import 表外的东西，构建时会被打进包里、运行时拿不到真正的宿主实例。
//
// 所以：**凡是要 React 的东西，一律走本模块。**
const reactNamespace = __m("@ext:react");

/** 从命名空间取函数：兼容 CJS 直出与 ESM 命名空间包装两种形态。 */
function pickFunction(namespace, name) {
	if (!namespace) return undefined;
	if (typeof namespace[name] === 'function') return namespace[name];
	const wrapped = namespace.default;
	if (wrapped && typeof wrapped[name] === 'function') return wrapped[name];
	return undefined;
}

/** 从命名空间取值（非函数）。 */
function pickValue(namespace, name) {
	if (!namespace) return undefined;
	if (namespace[name] !== undefined) return namespace[name];
	const wrapped = namespace.default;
	return wrapped ? wrapped[name] : undefined;
}

/** React.createElement —— 全插件统一的 h()。 */
const createElement = pickFunction(reactNamespace, 'createElement');
/** 同 h（别名，读起来顺一点）。 */
const h = createElement;
const Fragment = pickValue(reactNamespace, 'Fragment');
const Component = pickValue(reactNamespace, 'Component');

// hooks：面板是 slot 组件，靠这几个驱动重渲染。
const useState = pickFunction(reactNamespace, 'useState');
const useRef = pickFunction(reactNamespace, 'useRef');
const useEffect = pickFunction(reactNamespace, 'useEffect');
const useCallback = pickFunction(reactNamespace, 'useCallback');
const useMemo = pickFunction(reactNamespace, 'useMemo');

/**
 * 诊断「宿主到底给了什么」——出问题时把这份快照贴出来，省掉两轮猜。
 * @returns {{ok:boolean, missing:string[], hasReactNs:boolean, reactKeys:string[]}}
 */
function diagnoseRenderer() {
	const missing = [];
	if (typeof createElement !== 'function') missing.push('react.createElement');
	for (const [name, fn] of [['useState', useState], ['useRef', useRef], ['useEffect', useEffect]]) {
		if (typeof fn !== 'function') missing.push('react.' + name);
	}
	let reactKeys = [];
	try { reactKeys = Object.keys(reactNamespace ?? {}).slice(0, 16); } catch { reactKeys = []; }
	return {
		ok: missing.length === 0,
		missing,
		hasReactNs: reactNamespace !== undefined && reactNamespace !== null,
		reactKeys,
	};
}

			return { "createElement": createElement, "h": h, "Fragment": Fragment, "Component": Component, "useState": useState, "useRef": useRef, "useEffect": useEffect, "useCallback": useCallback, "useMemo": useMemo, "diagnoseRenderer": diagnoseRenderer };
		};

		// ── src/client/state.js ──
		__factories["src/client/state.js"] = function (__m, __exports) {
// src/client/state.js — 抽屉的全部可变状态。
//
// 为什么不用 React state：宿主环境下 React 合成事件不可靠，交互统一走
// `data-action` + 原生 click 代理；因此状态放在闭包对象里，改完手动 render()。
// 好处是 headless 测试可以构造 state 直接断言，不必驱动 React。

/** 一次性的世界书表单（避免同一坨字面量在 5 处重复）。 */
function emptyLoreForm() {
	return {
		mode: 'none', // 'none' | 'new' | 'edit'
		id: '', name: '', content: '', keywords: '',
		alwaysActive: false, enabled: true, priority: '50', bookId: '',
	};
}

/** 抽屉初始状态。 */
function initialState() {
	return {
		// 会话身份（slot inject 工厂注入）—— 列表/创建/认领都按它过滤
		sessionId: null,
		// 视图路由
		view: 'projects', // 'projects' | 'detail' | 'lorebook' | 'settings'
		selected: null,
		// 项目列表
		// sessionFallback：会话过滤为空但全量有书 → 回落显示全部（宿主 slot 会话标识
		// 与工具写入的 session id 可能不同源，0.13.2 真机实锤）。null = 未触发过回落。
		projects: [], sessionFallback: null, unclaimed: [], loading: true, error: '', notice: '',
		creating: false, busy: false, title: '', genre: '',
		// titleReset：书名输入是非受控的（defaultValue + key），创建成功清空后 bump 重置
		titleReset: 0,
		// 每章字数区间（用户 2026-10-20 要求「面板能设字数」）：
		// newChars = 建书表单里的选填值（"2500-3500"，空＝不设）；
		// charsValue = 详情卡编辑框的当前值（保存时读它）。**undefined ≠ ''**：
		// undefined = 还没从服务端详情拿到（或压根没编辑过），保存时必须按「原样」处理；
		// '' = 用户明确清空 / 点了「清除自定义」。混为一谈会把「什么都没点」当成
		// 「清除」，服务端随即删掉 charLimits——用户自定义区间被静默抹掉。
		// charsSaving = 保存在途；charsError = 服务端 400 的原文（必须可见，
		// 不许把「区间写错了」吞成「没保存」）。
		newChars: '', charsValue: undefined, charsSaving: false, charsError: '',
		// 列表筛选（>8 本才显示输入框）：按书名/目录名/题材做客户端子串匹配
		filter: '',
		// 列表内联改名 / 删除：rename = {id, value} | null；listDeleteId = 待确认删除的书 id | null
		// listDeleting：删除请求在途的**独立**标记。不能拿 listDeleteId 塞 'busy' 当哨兵——
		// 确认行的渲染条件是 `listDeleteId === p.name`，哨兵会让整行卸载（闪一下）且
		// 「删除中…」分支永远不可达。
		// clone = {id, value} | null：克隆为模板的输入行（value 是新书目录名）
		rename: null, renaming: false, listDeleteId: null, listDeleting: false, clone: null, cloning: false,
		// 项目详情
		detail: null, chapterNo: 1, writing: false,
		draft: '', draftVersion: 0,
		// 旁路引擎动作（0.13.0）：'polish' | 'proofread' | null。
		// 两者都是**长任务**（服务端可能重试到几分钟），所以单独一个忙标记，
		// 而不是复用 writing —— 否则「写章中」和「润色中」会互相把按钮按死。
		revising: null,
		// 全书体检（GET /continuity，纯函数零 token）：null = 没查过
		continuity: null, continuityLoading: false, continuityError: '',
		// 创作驾驶舱（GET /dashboard，只读聚合）：打开详情自动拉，手动可刷新
		dashboard: null, dashboardLoading: false, dashboardError: '',
		// 黄金三章诊断（GET /diagnose，同为纯函数零 token）：null = 没查过
		diagnosis: null, diagnosisLoading: false, diagnosisError: '',
		// 批量起草（D2）：表单值 + 忙标记 + 结果
		batchFrom: 1, batchCount: 3, batchConcurrency: 1, batchForce: false,
		batchBusy: false, batchResult: null,
		// 小说基本要素（基本信息标签：档案/大纲/角色卡/设定/账本时间线）
		elements: null, elementsLoading: false,
		// 详情页两个标签：'info'（基本信息）| 'chapters'（章节听书）
		detailTab: 'info',
		chapterList: [], chapterListLoading: false,
		playback: { status: 'idle', currentNo: null },
		// 阅读器（0.13.1）：点目录行的 📖 展开正文。{ no, title, text, loading } | null
		// 与播放互相独立——可以一边听一边看。
		reader: null,
		// 宽屏阅读/编辑浮层（FUSION 1.7）：{ no, title, text, loading, editing, draft, saving, error } | null
		// 右栏窄，长章阅读/改稿走宿主页面宽度的浮层；读与写是同一份数据（读态 → 点「编辑」）。
		readerOverlay: null,
		// 面板形态（1.9）：'h5'（默认，右侧栏直接渲染 H5 网页版）| 'react'（经典面板，手动入口）。
		// 用户 2026-11-09 定：H5 是默认展示，原有 React 窗口降级为手动入口。
		// localStorage 持久化；测试/无 DOM 环境读不到就回默认 'h5'。
		panelMode: (() => {
			try { return localStorage.getItem('nf-panel-mode') === 'react' ? 'react' : 'h5'; } catch { return 'h5'; }
		})(),
		// H5 内嵌页刷新计数：换 key 强制 iframe 重载（不直接操作 iframe DOM）
		h5RefreshKey: 0,
		// H5 网页版浮层（兼容旧入口）：{ book, key } | null
		h5Overlay: null,
		// 设置页（本书设置：字数区间 / 平台 / logline）：保存中 / 成功提示 / 服务端错误原文
		settingsSaving: false, settingsOk: '', settingsError: '',
		// 双轨状态卡（FUSION 1.7）：GET /projects/:id/fusion —— 布局/版本策略/.git/进度。
		// 打不开时置 error 但绝不阻塞面板其它区域（状态卡只是信息）。
		fusionStatus: null, fusionLoading: false, fusionError: '',
		// 提案队列（0.7.0）：模型提的修订稿，pending 时等用户点「应用」才生成新版本。
		// 工具面没有 apply（见 lib/proposals.js）——「批准钥匙」在面板这一侧。
		proposals: [], proposalsLoading: false,
		proposalsError: null, // 提案队列加载失败——必须可见，不得伪装成「没有待批」（2026-09-23 真机教训）
		sessionScope: 'session', // 书单范围：'session'=只看本会话名下的书（默认）；'all'=全部书（多会话工作流必需）
		// 多会话各自的书写给不同会话——只认本会话时别的书完全不可见（空列表才回落全量，
		// 名下有任何一本书就不回落），用户在写作会话里永远够不到其他会话建的书。
		// 提案全文展开（👁 查看）：{ id, loading, data, error } | null
		proposalDetail: null,
		// 正在处理的提案 id（应用/丢弃中，按钮禁用以防重复点）；null = 空闲
		proposalBusy: null,
		// 应用提案时服务端跑出的内容门禁提示：{ok, blocking[], warnings[]} | null。
		// 应用是用户主权（不拦），但「这版改出了死人复活/隐藏人物泄底」必须当场看见，
		// 不能等下一次写章才在别的章节冒出来。
		gateNotice: null,
		// 世界书
		loreEntries: [], loreForm: emptyLoreForm(), loreBusy: false,
		// loreDeleteId：待确认删除的世界书条目 id（字符串，与 dataset.id 同形）| null
		loreDeleteId: null,
		// 导出 / 删除
		exporting: false, deleteState: null,
		// 撤销栈与基线（保存判定依据）
		undoStack: [], baseline: '', draftModified: false,
		// 未保存离开确认：null | {kind:'back'} | {kind:'chapter', no:number}
		discardPending: null,
		// 面板保存被门禁拦下时的原文（409 GATE_REJECTED）。非空 = 编辑区显示
		// 「仍要保存（跳过内容门禁·记审计）」二次确认——门禁不许静默绕过，也不许
		// 只报一句「保存失败」把人堵死。换章/换书/保存成功后复位。
		saveBlocked: '',
		// 会话疲劳横幅「复制交接摘要」的已复制反馈（换书/重新打开详情时复位）
		copiedHandoff: false,
		// 会话疲劳横幅「开新会话并归档」的两段确认（第一击 arm、第二击才发；换书复位）
		rotatePending: false,
	};
}

			return { "emptyLoreForm": emptyLoreForm, "initialState": initialState };
		};

		// ── src/client/tts.js ──
		__factories["src/client/tts.js"] = function (__m, __exports) {
// src/client/tts.js — 章节听书（Web Speech API 封装）。
//
// 为什么自己排队，不一把梭丢给 speechSynthesis：
//   ① 一章正文动辄几千字，Chrome 对超长 utterance 有「读十几秒就停」的老毛病，
//      必须切成短块逐个 speak（读完一块 onend 接下一块）；
//   ② 连播（第 N 章读完自动读第 N+1 章）要跨异步请求 —— 取正文是 await，
//      等待期间用户可能点了停止，所以用「代际计数」作废一切迟到回调，
//      防「停了又活过来」。
//
// 全部依赖注入（synth / loadChapter / hasChapter）：headless 测试直接喂替身，
// 不碰真机 Web Speech。

/**
 * 把正文切成朗读块：先按段落，超长段再按句末标点断开，最后合并到 limit 内。
 * 块与块之间由 utterance.onend 衔接，浏览器自己换气，不用插入停顿。
 * @param {string} text 章节正文
 * @param {number} [limit] 单块字符上限（默认 180，太长触发 Chrome 的停止 bug）
 * @returns {string[]}
 */
function chunkText(text, limit = 180) {
	const paragraphs = String(text ?? '')
		.split(/\n+/)
		.map((p) => p.trim())
		.filter(Boolean);
	const pieces = [];
	for (const p of paragraphs) {
		if (p.length <= limit) { pieces.push(p); continue; }
		// 句末标点后断开（中英文标点都照顾到）
		for (const s of p.split(/(?<=[。！？；!?;.])\s*/)) {
			const t = s.trim();
			if (!t) continue;
			// L16 修复：无句读的超长段按字数硬切——整段塞给 TTS 引擎会被拒或整块吞掉
			if (t.length <= limit) { pieces.push(t); continue; }
			for (let i = 0; i < t.length; i += limit) pieces.push(t.slice(i, i + limit));
		}
	}
	const chunks = [];
	let buf = '';
	for (const s of pieces) {
		if (buf && buf.length + s.length > limit) { chunks.push(buf); buf = s; }
		else buf = buf ? buf + s : s;
	}
	if (buf) chunks.push(buf);
	return chunks;
}

/** 取宿主的 speechSynthesis；没有就返回 null（面板给出可读提示，不炸）。 */
function resolveSynth() {
	if (typeof globalThis !== 'undefined' && globalThis.speechSynthesis) return globalThis.speechSynthesis;
	if (typeof window !== 'undefined' && window.speechSynthesis) return window.speechSynthesis;
	return null;
}

/**
 * 朗读对象的默认工厂。
 *
 * ⚠️ 真机 Web Speech 的 `speechSynthesis.speak()` 只收 **`SpeechSynthesisUtterance` 实例**，
 * 传普通对象会直接 `TypeError`（The provided value is not of type 'SpeechSynthesisUtterance'）。
 * 所以有真实构造器时**必须用它 new**，而不是手搓 `{text,...}` 对象糊过去。
 * node/headless 没有该构造器，此时退回普通对象（仅供测试替身按自己的契约决定是否放行）。
 * @returns {(text: string) => any} 造朗读对象的函数
 */
function defaultUtteranceFactory() {
	const Ctor =
		(typeof globalThis !== 'undefined' && globalThis.SpeechSynthesisUtterance) ||
		(typeof window !== 'undefined' && window.SpeechSynthesisUtterance) ||
		null;
	if (typeof Ctor === 'function') {
		return (text) => {
			const u = new Ctor();
			u.text = String(text); u.lang = 'zh-CN'; u.rate = 1;
			return u;
		};
	}
	// 无 SpeechSynthesisUtterance 的宿主（node/headless）：退回普通对象
	return (text) => ({ text: String(text), lang: 'zh-CN', rate: 1 });
}

/**
 * 建一个听书播放器。
 *
 * 状态机：idle → playing →（pause）→ paused →（resume）→ playing → … → idle。
 * `onChange({ status, currentNo })` 在每次状态变化时回调，驱动面板重渲染。
 *
 * @param {object} deps
 * @param {object|null} deps.synth SpeechSynthesis（或同形替身）：speak/cancel/pause/resume
 * @param {(no: number) => Promise<string>} deps.loadChapter 取某章正文（缺失/失败按空串处理）
 * @param {(no: number) => boolean} deps.hasChapter 目录里有没有这一章（连播的兜底边界，给了 nextChapterAfter 时不用）
 * @param {(no: number) => number|null} [deps.nextChapterAfter] 目录里第一个编号**大于** no 的章；没有返回 null。
 *   连播/空章跳过都按它找下一章 —— 否则章号有缺口（如只有 1、3）会在缺口处早停。
 * @param {(text: string) => any} [deps.makeUtterance] 造朗读对象的工厂，默认 defaultUtteranceFactory()
 *   （真机必须产 SpeechSynthesisUtterance 实例，见 factory 注释）
 * @param {({status: string, currentNo: number|null}) => void} [deps.onChange]
 * @param {number} [deps.chunkLimit] 朗读块字符上限
 */
function createTtsPlayer({ synth, loadChapter, hasChapter, nextChapterAfter,
	makeUtterance = defaultUtteranceFactory(), onChange = () => {}, chunkLimit = 180 }) {
	let status = 'idle';        // 'idle' | 'playing' | 'paused'
	let currentNo = null;
	let generation = 0;         // stop() / 新一次 playFrom 各 +1；旧代际的 onend 一律作废
	let queue = [];
	let idx = 0;
	let speaking = false;       // 有没有一块utterance正挂在引擎上（L15：暂停时机补偿用）

	// 连播要找"目录里下一章"，而不是无脑 currentNo+1 —— 章号有缺口不能卡在缺口处。
	const getNext = nextChapterAfter ?? ((no) => (hasChapter(no + 1) ? no + 1 : null));

	const emit = () => {
		try { onChange({ status, currentNo }); } catch { /* 渲染层自己兜 */ }
	};

	const finish = (gen) => {
		if (gen !== generation) return;
		status = 'idle'; currentNo = null; queue = []; idx = 0;
		emit();
	};

	const speakNext = (gen) => {
		if (gen !== generation) return;
		// L15 修复：暂停态不开新块——「取文窗口期按下暂停」时正文随后回来，
		// 不该无视 paused 状态直接开腔（恢复播放由 resume() 统一踢一脚）
		if (status === 'paused') return;
		if (idx >= queue.length) {
			// 本章读完 → 连播下一章（按目录找第一个编号更大的章）；目录尽头自动收工
			const next = getNext(currentNo);
			if (next != null) { void startChapter(next, gen); }
			else finish(gen);
			return;
		}
		const text = queue[idx++];
		// 真机必须用 SpeechSynthesisUtterance 实例（见 defaultUtteranceFactory 注释）
		const u = makeUtterance(text);
		speaking = true;
		u.onend = () => { speaking = false; speakNext(gen); };
		u.onerror = () => { speaking = false; speakNext(gen); };
		// 引擎对某一块同步抛错不能把链卡死在 playing —— 跳过继续（异常引擎最终会收工）
		try { synth.speak(u); }
		catch { speaking = false; speakNext(gen); }
	};

	const startChapter = async (no, gen) => {
		if (gen !== generation) return;
		currentNo = no;
		emit();
		let text = '';
		try { text = await loadChapter(no); } catch { text = ''; }
		if (gen !== generation) return;             // 取文期间被 stop / 换播
		if (!String(text ?? '').trim()) {
			// 空章（没写或取不到）：跳到目录里下一章，别让连播卡死
			const next = getNext(no);
			if (next != null) { await startChapter(next, gen); }
			else finish(gen);
			return;
		}
		queue = chunkText(text, chunkLimit);
		idx = 0;
		speakNext(gen);
	};

	/** 从第 no 章开始播（会打断当前播放）。没有语音引擎时抛可读错误。 */
	const playFrom = (no) => {
		if (!synth) throw new Error('当前环境不支持语音朗读（缺少 speechSynthesis）');
		generation += 1;
		const gen = generation;
		try { synth.cancel(); } catch { /* 有的实现没实现 cancel */ }
		status = 'playing';
		emit();
		return startChapter(no, gen);
	};

	const pause = () => {
		if (status !== 'playing') return;
		try { synth.pause(); } catch { /* 同上 */ }
		status = 'paused';
		emit();
	};

	const resume = () => {
		if (status !== 'paused') return;
		try { synth.resume(); } catch { /* 同上 */ }
		status = 'playing';
		emit();
		// L15 修复：暂停落在「取文窗口」时引擎里根本没有块，synth.resume() 是空操作
		// ——恢复时若没有在播的块，由这里把队列踢起来，否则永远停在假暂停
		if (!speaking) speakNext(generation);
	};

	const stop = () => {
		generation += 1;
		try { synth?.cancel(); } catch { /* 同上 */ }
		status = 'idle'; currentNo = null; queue = []; idx = 0;
		emit();
	};

	return {
		playFrom, pause, resume, stop,
		get status() { return status; },
		get currentNo() { return currentNo; },
	};
}

			return { "chunkText": chunkText, "resolveSynth": resolveSynth, "defaultUtteranceFactory": defaultUtteranceFactory, "createTtsPlayer": createTtsPlayer };
		};

		// ── src/client/styles.js ──
		__factories["src/client/styles.js"] = function (__m, __exports) {
// src/client/styles.js — 面板的设计系统（唯一颜色/尺度来源）。
//
// 分三层，视图层只用第 ③ 层：
//   ① color  语义色（全部是**宿主真实存在**的 --dsw-alias-* 变量）
//   ② space / radius / font / weight / shadow  尺度
//   ③ card / btn / chip / field / meter / …  组件样式（函数式，按变体取）
//
// ⚠️ token 名不能凭感觉写（0.13.0 修正的一处真 bug）：
//   旧版用了 `--dsw-alias-accent-strong` / `accent-soft` / `label-danger` / `bg-primary`
//   四个名字 —— **宿主 token 表里根本没有它们**（只有 accent/danger 出现在
//   `interactive-bg-hover-accent` 这类交互态里）。于是每个 `var(...)` 都落到回退值上，
//   面板**永远按深色背景渲染**：在浅色主题里是一块深色糊字，这就是「太难看」的根因之一。
//   真实名字以 `dsh-client-ui-theme` 的导出为准（bg-layer-1/2/3、bg-overlay、
//   border-l1..l4、label-primary/secondary/tertiary/dimmed、link、state-*-primary、
//   button-primary-fill、label-primary-foreground、interactive-bg-hover）。
//   改这里的任何变量名之前，先去那个包里 grep 一遍。
//
// ⚠️⚠️ **名字存在 ≠ 用法正确**（0.13.1 修正的第二类事故，比上面更隐蔽）：
//   光核名字够不着下面这两种错——它们不报错、不错位，只是**难看**：
//     · `bg-overlay` 是**遮罩(scrim)色**（深色 #61666b 的中亮灰），
//       拿去当"输入框/胶囊底" → 深色主题里搜索框和所有胶囊糊成亮块；
//     · `label-dimmed` 是**表面**色（浅 #e1e5ee / 深 #43454a），
//       拿去当"最弱文字" → 两个主题里都等于看不见。
//   核名前先问一句：**这个 token 在宿主里是给什么用的？**
//   拿不准就用 `mix()` 按前景色自己染（见下），它是主题无关的。
//
// ⚠️ 回退值必须**双主题可用**（宿主没定义变量时也不能瞎）：
//   文字用 `inherit` / 半透明灰，边框与底色用 `rgba(128,128,128,α)`（浅底深底都看得见），
//   语义色用中调（#4d6bfe / #e08c00 / #e5484d / #2f9e44）。**不要写死 #1a1a1a 这类深色**。
//
// 另：不引入 CSS 文件、不引入新包。**几何**用内联样式对象；**外观与交互态**（hover /
// active / focus）由 `src/client/css.js` 生成一张样式表注入 —— 内联样式的优先级高于任何
// `:hover` 规则，外观留在内联里就永远做不出按下反馈。

/** 取宿主 token，带双主题可用的回退值。 */
const V = (name, fallback) => `var(--dsw-alias-${name}, ${fallback})`;

/**
 * 按宿主前景色染一层底：`color-mix(in srgb, var(--label-primary) N%, transparent)`。
 *
 * 为什么需要它（0.13.1 修的第二类 token 事故）：宿主的调色板是**平的**——
 * 浅色主题下 `bg-layer-1/2/3` 全是 `#fff`，想要「卡片里再嵌一层」的层次，
 * 光靠 layer token 取不出来。而 `label-primary` 在两套主题里正好是**反色**
 * （浅色 ≈ 近黑 `#0f1115`，深色 ≈ 近白 `#f9fafb`），
 * 于是「混 N% 前景色」在浅色下越混越灰、深色下越混越亮——**一套写法两个主题都成立**。
 */
const mix = (name, pct) => `color-mix(in srgb, ${V(name, 'currentColor')} ${pct}%, transparent)`;

// ── ① 语义色 ────────────────────────────────────────────────────────────────

const color = {
	// 文字：四级（主/次/弱/更弱）；回退用 inherit（跟着宿主主题走）
	text: V('label-primary', 'inherit'),
	text2: V('label-secondary', 'rgba(128,128,128,.95)'),
	text3: V('label-tertiary', 'rgba(128,128,128,.82)'),
	// ⚠️ 这里曾写 `label-dimmed` —— 名字存在，但**它是"表面"色不是文字色**：
	//    浅色下 #e1e5ee、深色下 #43454a，两个主题里当文字都等于看不见。
	//    真正的"最弱文字"是 `label-caption`。
	textDim: V('label-caption', 'rgba(128,128,128,.7)'),

	// 表面：卡片/面板沿用宿主 layer 层（与 dsh 其它界面一致）；
	// 「卡片里再嵌一层」（输入框、胶囊、进度槽、版本徽标）走 mix() 染色。
	// ⚠️ 这里曾用 `bg-overlay` 当内嵌底 —— 名字存在，但它是**遮罩(scrim)色**，
	//    深色下是 #61666b 的中亮灰：搜索框与所有胶囊在深色主题里糊成一片亮块，
	//    这正是「选了黑色主题配色不好看」的主因之一。
	base: V('bg-base', 'rgba(128,128,128,.02)'),
	surface1: V('bg-layer-1', 'rgba(128,128,128,.04)'),
	surface2: V('bg-layer-2', 'rgba(128,128,128,.07)'),
	surface3: V('bg-layer-3', 'rgba(128,128,128,.10)'),
	inset: mix('label-primary', 9),
	insetStrong: mix('label-primary', 15),
	hover: V('interactive-bg-hover', 'rgba(128,128,128,.12)'),
	/** 按下态（给 `:active` 用）。宿主有专门 token，比"hover 再深一档"更准。 */
	pressed: V('interactive-bg-active', 'rgba(128,128,128,.18)'),

	// 描边：四级。宿主值是半透明黑/白（#0000001f / #ffffff29），天然双主题
	border1: V('border-l1', 'rgba(128,128,128,.12)'),
	border2: V('border-l2', 'rgba(128,128,128,.18)'),
	border3: V('border-l3', 'rgba(128,128,128,.26)'),
	border4: V('border-l4', 'rgba(128,128,128,.34)'),

	// 语义：强调 / 成功 / 警告 / 危险
	// ⚠️ 强调色 = 品牌暖金（呼应「造神」意象），**自创、不跟随宿主 link 蓝**，
	// 让面板有独立产品感。金是中亮度色，单一金值无法两主题同时过 4.5:1
	//（浅色要暗金、深色要亮金）→ 前景金走主题变量：css.js 在面板根注入
	// --nf-accent（浅 #a86200 / 深 #f3a62a），这里只给带回退值的引用（回退=浅色档）；
	// 纯填充装饰另有 brand 系常量，不受主题切换影响。
	accent: 'var(--nf-accent, #a86200)',
	ok: V('state-success-primary', '#2f9e44'),
	warn: V('state-warn-primary', '#e08c00'),
	danger: V('state-error-primary', '#e5484d'),
	/** 品牌金（主按钮 / 强调色条的单一事实来源，索引：`brand` 主色）。 */
	brand: '#e0890f',       // 主金（中调，深浅主题都醒目）
	brandTop: '#f3a62a',    // rest 渐变顶端（更亮一档）
	brandBright: '#f6b042', // :hover
	brandDeep: '#c9740a',   // :active
	/** 压在品牌金上的文字（深暖黑）。白字压金在浅深两主题都 <4.5:1（金色中亮度，
	 *  与主题无关）；深字压三态金底 5.1–8.8:1 全过——与品牌金配对的是深字，不是白字。 */
	onGold: '#231303',

	// 字体族（宿主变量 + 本地回退）
	mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

/**
 * 半透明染色（软底 / 软描边）。用 color-mix 从语义色派生，**自动跟随主题**，
 * 不必为浅色深色各写一套 rgba。宿主 token 缺失时 color-mix 里的回退值仍生效。
 */
const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

/**
 * 主题感知的层级阴影（商业感的真正来源；之前「不用阴影」是面板发平的主因）。
 * 用 CSS 变量表达：浅色一套、深色一套，由 `css.js` 注入并随宿主主题切换。
 * 这里只给**带回退值**的引用——即使 css.js 没注入，卡片也有一层干净的低调阴影。
 * 浅色回退刻意「上亮下暗」：顶边一道 0.7α 白高光 + 柔和投影，是 Linear/Notion 同款。
 */
const ELEV1 = 'var(--nf-elev-1, 0 1px 2px rgba(15,17,21,.05), 0 2px 8px rgba(15,17,21,.06))';
const ELEV2 = 'var(--nf-elev-2, 0 2px 6px rgba(15,17,21,.08), 0 8px 20px rgba(15,17,21,.08))';

// ── ② 尺度 ──────────────────────────────────────────────────────────────────

/** 间距刻度：只用这几个数，不要在视图里随手写 5px / 7px / 9px。 */
const space = { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, xxl: 20 };
/** 圆角刻度。 */
const radius = { sm: 8, md: 10, lg: 14, pill: 999 };
/** 字号刻度。 */
const font = { caption: 11, small: 12, body: 13, lead: 14, title: 15, hero: 18 };
const weight = { normal: 400, medium: 500, semibold: 600, bold: 700 };

/** 面板根容器（宿主右侧栏的滚动区）。 */
const rootStyle = {
	boxSizing: 'border-box', height: '100%', minHeight: 0,
	display: 'flex', flexDirection: 'column',
	color: color.text, fontSize: font.body, lineHeight: 1.6,
	background: 'transparent',
};

/** 内容滚动区（头部固定、内容滚动）。 */
const bodyStyle = {
	flex: '1 1 auto', minHeight: 0, overflowY: 'auto',
	display: 'flex', flexDirection: 'column', gap: space.lg,
	padding: `${space.lg}px ${space.lg}px ${space.xxl}px`,
};

// ── ③ 组件样式 ──────────────────────────────────────────────────────────────

/** 面板头部：品牌块 + 标题/副题 + 右侧 chip 组。 */
const headerStyle = {
	display: 'flex', alignItems: 'center', gap: space.md,
	padding: `${space.lg}px ${space.lg}px`,
	flex: '0 0 auto',
	borderBottom: `1px solid ${color.border2}`,
};

/** 头部品牌图标块（28×28 圆角方块，渐变底 + 微高光）。字色走 onGold：
 *  深色主题下底是亮金 #f3a62a，白图标只剩 ≈2:1，深字两主题都 ≥3:1（图形线）。 */
const brandMarkStyle = {
	flex: 'none', width: '28px', height: '28px', borderRadius: radius.md,
	display: 'flex', alignItems: 'center', justifyContent: 'center',
	fontSize: '15px',
	background: `linear-gradient(135deg, ${tint(color.accent, 22)}, ${color.accent})`,
	color: color.onGold, boxShadow: ELEV1,
};

/** 头部标题（一行：标题 + 版本 chip）。 */
const titleStyle = { fontWeight: weight.bold, fontSize: font.title, letterSpacing: '.2px' };
/** 头部副题（当前书名 / 会话范围）。 */
const subtitleStyle = { color: color.text3, fontSize: font.caption, marginTop: '1px' };

/** 版本 chip。 */
const badgeStyle = {
	flex: 'none', padding: '1px 7px', borderRadius: radius.pill,
	background: color.inset, color: color.text2,
	fontSize: font.caption, fontFamily: color.mono, lineHeight: '16px',
};

/**
 * 卡片。`tone` 决定描边与底色，`pad` 覆盖内边距。
 * 带一层低调的层级阴影（ELEV1，浅/深两套由 css.js 注入 --nf-elev-*，这里只给
 * 带回退值的引用）——旧版「不用阴影」已随层级化改版废止。
 */
const card = ({ tone = 'plain', pad = space.lg } = {}) => {
	const tones = {
		plain: { border: color.border2, background: color.surface1 },
		inset: { border: color.border2, background: color.inset },
		accent: { border: tint(color.accent, 30), background: tint(color.accent, 8) },
		warn: { border: tint(color.warn, 34), background: tint(color.warn, 10) },
		danger: { border: tint(color.danger, 30), background: tint(color.danger, 8) },
		ok: { border: tint(color.ok, 30), background: tint(color.ok, 8) },
	};
	const t = tones[tone] ?? tones.plain;
	return {
		flex: 'none', boxSizing: 'border-box',
		border: `1px solid ${t.border}`, background: t.background,
		borderRadius: radius.lg, padding: `${pad}px`,
		boxShadow: ELEV1,
	};
};

/**
 * 按钮**几何**（尺寸/内边距/字体/圆角）。
 *
 * ⚠️ 外观（底色/描边/字色）**故意不在这里**，一律由 `src/client/css.js` 的外观表驱动：
 * 内联样式的优先级**高于任何 `:hover` / `:active` 选择器规则** —— 外观一旦写死在内联里，
 * 按钮就永远不会有悬停与按下反馈。0.13.1 修的正是这个（刷新 / 导入本地书点了没反应）。
 */
const btnLayout = ({ size = 'md' } = {}) => ({
	flex: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px',
	justifyContent: 'center', fontFamily: 'inherit', fontWeight: weight.medium,
	cursor: 'pointer', borderRadius: radius.md, boxSizing: 'border-box',
	fontSize: size === 'sm' ? font.caption : font.small,
	padding: size === 'sm' ? '2px 7px' : '4px 10px',
	lineHeight: size === 'sm' ? '16px' : '18px',
	whiteSpace: 'nowrap',
	// 底/描边/字色**故意留空**：由 css.js 按 data-variant 给（含 hover/active）。
	// 这里若写死，内联优先级会压掉所有交互态。
});

/** 尺寸快照（供预览/直用；键与 `data-size` 同值）。 */
const btnSizes = { sm: btnLayout({ size: 'sm' }), md: btnLayout({ size: 'md' }) };

/**
 * 按钮**外观**表：每个变体给 rest / hover / active 三态。
 * `css.js` 把它编译成 `[data-nf-btn][data-variant="…"]:hover{…}` 这类规则。
 * primary 的三态直接用宿主成套 token（fill / hover / dimmed），不自创。
 */
const btnSkin = {
	primary: {
		rest: {
			background: `linear-gradient(180deg, ${color.brandTop}, ${color.brand})`,
			color: color.onGold, borderColor: 'transparent', boxShadow: ELEV1,
		},
		hover: { background: color.brandBright, color: color.onGold, boxShadow: ELEV2 },
		active: { background: color.brandDeep, color: color.onGold },
	},
	secondary: {
		rest: { background: color.inset, color: color.text, borderColor: color.border2 },
		hover: { background: color.hover, borderColor: color.border3 },
		active: { background: color.pressed, borderColor: color.border4 },
	},
	ghost: {
		rest: { background: 'transparent', color: color.text2, borderColor: 'transparent' },
		hover: { background: color.hover, color: color.text },
		active: { background: color.pressed, color: color.text },
	},
	accent: {
		rest: { background: tint(color.accent, 10), color: color.accent, borderColor: tint(color.accent, 40) },
		hover: { background: tint(color.accent, 18), borderColor: tint(color.accent, 60) },
		active: { background: tint(color.accent, 26), borderColor: tint(color.accent, 70) },
	},
	danger: {
		rest: { background: tint(color.danger, 10), color: color.danger, borderColor: tint(color.danger, 40) },
		hover: { background: tint(color.danger, 18), borderColor: tint(color.danger, 60) },
		active: { background: tint(color.danger, 26), borderColor: tint(color.danger, 70) },
	},
};

const BTN_VARIANTS = ['primary', 'secondary', 'ghost', 'accent', 'danger'];

/**
 * 兼容旧调用：几何 + rest 外观的**静态快照**（没有交互态）。
 * 只在「不是按钮」或非浏览器上下文里用；界面上一律走 `ui.js` 的 `Btn`。
 */
const btn = ({ variant = 'secondary', size = 'md' } = {}) => ({
	...btnLayout({ size }),
	...(btnSkin[variant] ?? btnSkin.secondary).rest,
});

/** 小胶囊标签。tone: neutral | accent | ok | warn | danger | ink。 */
const chip = ({ tone = 'neutral' } = {}) => {
	const tones = {
		neutral: { background: color.inset, color: color.text3 },
		accent: { background: tint(color.accent, 14), color: color.accent },
		ok: { background: tint(color.ok, 14), color: color.ok },
		warn: { background: tint(color.warn, 16), color: color.warn },
		danger: { background: tint(color.danger, 14), color: color.danger },
		ink: { background: color.text, color: color.base },
	};
	const t = tones[tone] ?? tones.neutral;
	return {
		flex: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px',
		padding: '0 6px', borderRadius: radius.pill, fontSize: font.caption,
		lineHeight: '16px', whiteSpace: 'nowrap', ...t,
	};
};

/** 输入框 / 文本域 / 下拉（同一套外框）。 */
const field = ({ mono = false } = {}) => ({
	boxSizing: 'border-box', width: '100%',
	padding: '5px 8px', borderRadius: radius.md,
	border: `1px solid ${color.border3}`, background: color.inset,
	color: color.text, fontFamily: mono ? color.mono : 'inherit',
	fontSize: font.small, lineHeight: 1.6, outline: 'none',
});

const inputStyle = field();

/** 稿纸区（本章正文编辑）：字号与行高按读稿调，不是按聊天框调。 */
const manuscriptStyle = {
	...field({ mono: false }),
	minHeight: '200px', resize: 'vertical',
	fontSize: font.lead, lineHeight: 1.95, letterSpacing: '.3px',
};

// ── 阅读排版（宽屏阅读浮层 / 阅读卡）─────────────────────────────────────
// 中文正文的阅读体验和 UI 文案不同：字号更大、行距更松、段首缩进 2em、
// 两端对齐；正文用衬线字体栈（宿主是 sans UI 字体，长文读起来偏挤）。
// 字体栈只列**系统自带**中文字体，不引外部字体（插件零依赖、离线可用）。
const readingFontFamily =
	'"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", "STSong", "SimSun", serif';
const readingBodyStyle = {
	fontFamily: readingFontFamily,
	fontSize: font.lead + 2,
	lineHeight: 2.0,
	letterSpacing: '.3px',
	color: color.text,
	textAlign: 'justify',
	wordBreak: 'break-word',
};
const readingParaStyle = {
	textIndent: '2em',
	margin: `0 0 ${space.md + 2}px`,
};

// ── 宽屏阅读/编辑浮层 ────────────────────────────────────────────────────
// 右侧栏只有 ~360px，读长章是酷刑；浮层用宿主页面宽度，正文 max-width 760px
// 保证每行 30–40 字（中文阅读舒适区）。
const overlayBackdropStyle = {
	position: 'fixed', inset: 0, zIndex: 60,
	background: 'rgba(15, 17, 21, .42)',
	display: 'flex', alignItems: 'center', justifyContent: 'center',
	padding: `${space.lg}px`,
};
const overlayPanelStyle = {
	display: 'flex', flexDirection: 'column',
	width: 'min(920px, 94vw)', maxHeight: '92vh',
	borderRadius: radius.lg,
	background: V('bg-base', '#ffffff'),
	border: `1px solid ${color.border2}`,
	boxShadow: ELEV2,
	overflow: 'hidden',
};
const overlayHeaderStyle = {
	display: 'flex', alignItems: 'center', gap: space.sm, flexWrap: 'wrap',
	padding: `${space.md}px ${space.lg}px`,
	borderBottom: `1px solid ${color.border1}`,
	background: color.surface1,
};
const overlayBodyStyle = {
	flex: '1 1 auto', minHeight: 0, overflowY: 'auto',
	padding: `${space.xl}px ${space.xxl + 8}px`,
};
const overlayBodyInnerStyle = {
	maxWidth: '760px', margin: '0 auto', ...readingBodyStyle,
};

/** 进度/占比条（体检通过率、字数等）。 */
const meterTrackStyle = {
	flex: '1 1 auto', height: '4px', borderRadius: radius.pill,
	background: color.inset, overflow: 'hidden', minWidth: '40px',
};
const meterFillStyle = (pct, tone = 'accent') => ({
	height: '100%', borderRadius: radius.pill,
	width: `${Math.max(0, Math.min(100, pct))}%`,
	background: tone === 'ok' ? color.ok : tone === 'warn' ? color.warn : tone === 'danger' ? color.danger : color.accent,
});

/** 键值行（设置/档案用）。 */
const rowStyle = { display: 'flex', alignItems: 'flex-start', gap: space.md, flex: 'none' };
const kStyle = {
	flex: 'none', minWidth: '58px', fontFamily: color.mono, fontSize: font.caption,
	color: color.text3, paddingTop: '2px',
};
const vStyle = { flex: 'auto', minWidth: 0, wordBreak: 'break-word', fontSize: font.small };

/** 提示与状态文案。 */
const hintStyle = { color: color.text3, fontSize: font.small };
const errStyle = {
	flex: 'auto', minWidth: 0, color: color.danger, fontSize: font.small,
	wordBreak: 'break-word', lineHeight: 1.6,
};
const okStyle = { color: color.ok, fontSize: font.small };
/** 警告类状态文案（门禁提示等）：比红字轻、比绿字认真。 */
const warnStyle = {
	flex: 'auto', minWidth: 0, color: color.warn, fontSize: font.small,
	wordBreak: 'break-word', lineHeight: 1.6,
};

/**
 * 空态：图标 + 一句主文案 + 可选的次文案/动作。
 * 视图里直接 `emptyState({ icon, title, hint, action })`，别再现写灰字。
 */
const emptyStateStyle = {
	display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space.sm,
	padding: `${space.xl}px ${space.lg}px`, textAlign: 'center',
	border: `1px dashed ${color.border2}`, borderRadius: radius.lg,
	background: color.surface1,
};
const emptyIconStyle = { fontSize: '20px', lineHeight: 1, opacity: .85 };
const emptyTitleStyle = { fontSize: font.small, color: color.text2 };

/** 底部说明。 */
const footerStyle = {
	margin: 0, color: color.textDim, fontSize: font.caption,
	flex: 'none', lineHeight: 1.7,
};

/**
 * 仪表盘数字卡（详情/体检页的「章节 / 伏笔 / 硬伤」这类指标）。
 * 大号等宽数字 + 弱标签，扫读时先看数——典型的商业后台观感。
 */
const statTileStyle = {
	display: 'flex', flexDirection: 'column', gap: '1px',
	padding: `${space.md}px ${space.md}px`, borderRadius: radius.lg,
	background: color.surface1, border: `1px solid ${color.border2}`,
	boxShadow: ELEV1, minWidth: '66px', flex: '1 1 0',
};
const statTileNum = {
	fontWeight: weight.bold, fontSize: font.hero, lineHeight: 1.1,
	fontVariantNumeric: 'tabular-nums', letterSpacing: '.3px', color: color.text,
};
const statTileLabel = { fontSize: font.caption, color: color.text3, lineHeight: 1.4 };

/** 元素列表容器（统一竖向节奏）。 */
const stackStyle = (gap = space.sm) => ({ display: 'flex', flexDirection: 'column', gap: `${gap}px` });
/** 横向按钮/胶囊行。 */
const rowWrapStyle = (gap = space.sm) => ({
	display: 'flex', alignItems: 'center', gap: `${gap}px`, flexWrap: 'wrap',
});
/** 撑开剩余空间（把后面的东西推到右边）。 */
const spacerStyle = { flex: '1 1 auto', minWidth: 0 };

// ── 兼容别名（0.12 之前的导出名，视图正在逐个迁移；新代码别再用）────────────
const itemCardStyle = card();
const miniBtnStyle = btn({ size: 'sm' });
const dangerBtnStyle = btn({ variant: 'danger' });
const primaryBtnStyle = btn({ variant: 'primary' });
const accentBtnStyle = btn({ variant: 'accent' });
const emptyStyle = { color: color.text3 };

			return { "color": color, "tint": tint, "space": space, "radius": radius, "font": font, "weight": weight, "rootStyle": rootStyle, "bodyStyle": bodyStyle, "headerStyle": headerStyle, "brandMarkStyle": brandMarkStyle, "titleStyle": titleStyle, "subtitleStyle": subtitleStyle, "badgeStyle": badgeStyle, "card": card, "btnLayout": btnLayout, "btnSizes": btnSizes, "btnSkin": btnSkin, "BTN_VARIANTS": BTN_VARIANTS, "btn": btn, "chip": chip, "field": field, "inputStyle": inputStyle, "manuscriptStyle": manuscriptStyle, "readingFontFamily": readingFontFamily, "readingBodyStyle": readingBodyStyle, "readingParaStyle": readingParaStyle, "overlayBackdropStyle": overlayBackdropStyle, "overlayPanelStyle": overlayPanelStyle, "overlayHeaderStyle": overlayHeaderStyle, "overlayBodyStyle": overlayBodyStyle, "overlayBodyInnerStyle": overlayBodyInnerStyle, "meterTrackStyle": meterTrackStyle, "meterFillStyle": meterFillStyle, "rowStyle": rowStyle, "kStyle": kStyle, "vStyle": vStyle, "hintStyle": hintStyle, "errStyle": errStyle, "okStyle": okStyle, "warnStyle": warnStyle, "emptyStateStyle": emptyStateStyle, "emptyIconStyle": emptyIconStyle, "emptyTitleStyle": emptyTitleStyle, "footerStyle": footerStyle, "statTileStyle": statTileStyle, "statTileNum": statTileNum, "statTileLabel": statTileLabel, "stackStyle": stackStyle, "rowWrapStyle": rowWrapStyle, "spacerStyle": spacerStyle, "itemCardStyle": itemCardStyle, "miniBtnStyle": miniBtnStyle, "dangerBtnStyle": dangerBtnStyle, "primaryBtnStyle": primaryBtnStyle, "accentBtnStyle": accentBtnStyle, "emptyStyle": emptyStyle };
		};

		// ── src/client/views/project-list.js ──
		__factories["src/client/views/project-list.js"] = function (__m, __exports) {
// src/client/views/project-list.js — 项目列表（首屏）。
//
// 纯渲染：只读 state，不改。所有交互靠 `data-action` / `data-field`，
// 由 panel.js 的原生事件代理统一接住（宿主里 React 合成事件不可靠）。
//
// 「项目跟会话走」：这里的列表已经是**本会话**的书（服务端按 session 过滤过）。
// 0.5.0 之前建的书没有会话戳，会落在 state.unclaimed 里 —— 底部给一条认领通道，
// 免得老书从此看不见。
//
// 版面（自上而下）：创建 → 反馈 → 书卡列表 → 未归属 → 脚注。
// 一张书卡要在一屏内回答三件事：**这书到哪一步了**（九阶段轨道）、
// **攒了多少料**（章/账本/伏笔/角色）、**能对它做什么**（世界书/改名/删除）。
const { h } = __m("src/client/react.js");
const { color, space, font, weight, hintStyle, footerStyle, inputStyle, stackStyle, card, tint } = __m("src/client/styles.js");
const { Card, Btn, Chip, Stat, StageRail, Empty, Section, Feedback, TAP } = __m("src/client/ui.js");
const { genreLabel } = __m("src/client/genre.js");

/**
 * 列表筛选的匹配规则（导出以便直测）：书名 / 目录名 / 显示题材 的子串匹配。
 * 查询词也做一次同样的小写化，中英混着敲都能命中。
 */
function projectMatches(p, query) {
	const q = String(query ?? '').trim().toLowerCase();
	if (!q) return true;
	return [p.title, p.name, p.genre ? genreLabel(p.genre) : '']
		.some((v) => String(v ?? '').toLowerCase().includes(q));
}

/** 列表项里的一颗统计。fields 缺失（老书/解析失败）就不显示，不显示 0 之外的空壳。 */
function statsOf(p) {
	const fh = p.foreshadows ?? {};
	const stats = [];
	if (p.chapters !== null && p.chapters !== undefined) stats.push(Stat({ icon: '📄', value: p.chapters, unit: '章' }));
	if (p.facts) stats.push(Stat({ icon: '🧾', value: p.facts, unit: '台账' }));
	if (fh.total) {
		// 未回收数量是**要动作**的信号：超期用警告色，普通未回收用中性色
		stats.push(Stat({
			icon: '🪡', value: `${fh.open}/${fh.total}`, unit: '伏笔',
			tone: fh.overdue > 0 ? 'warn' : 'neutral',
		}));
	}
	if (p.castCount) stats.push(Stat({ icon: '👥', value: p.castCount, unit: '角色' }));
	return stats;
}

function ProjectListView({ state: s }) {
	const creating = s.creating;
	// 列表筛选：书少时是噪音，>8 本才亮出来（客户端子串匹配，无服务端参与）
	const filtering = s.projects.length > 8;
	const query = s.filter ?? '';
	const shown = filtering ? s.projects.filter((p) => projectMatches(p, query)) : s.projects;
	return h('div', { style: stackStyle(space.lg) },

		// ── 创建 ──
		Card({ tone: 'inset', pad: space.md },
			h('div', { style: { display: 'flex', gap: space.sm } },
				h('input', {
					// 非受控（defaultValue + key）：每键只进 state 不重渲染；
					// 创建成功后 panel bump titleReset，key 变化即清空输入框。
					key: `title-${s.titleReset ?? 0}`,
					'data-field': 'title', defaultValue: s.title, placeholder: '新书书名…',
					'aria-label': '新书书名',
					style: { ...inputStyle, flex: '1 1 auto' },
				}),
				Btn({ variant: 'primary', action: 'create', disabled: creating }, creating ? '创建中…' : '创建'),
			),
			// 开书时收集每章字数（用户 2026-10-20）：选填。留空＝不设，写章按平台口径
			// 或插件默认放行；设了就以它为准，之后建的所有章的门禁都照它判。
			h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm, marginTop: space.sm } },
				h('input', {
					key: `chars-${s.titleReset ?? 0}`,
					'data-field': 'new-chars', defaultValue: s.newChars ?? '',
					placeholder: '每章字数（选填，如 2500-3500）',
					'aria-label': '新书每章字数区间',
					style: { ...inputStyle, flex: '1 1 auto', maxWidth: '220px' },
				}),
				h('span', { style: { ...hintStyle, fontSize: font.caption } },
					'不设则按投放平台/插件默认口径'),
			),
			h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm, marginTop: space.sm } },
				Btn({ variant: 'ghost', size: 'sm', action: 'refresh-projects' }, '↻ 刷新'),
				Btn({ variant: 'ghost', size: 'sm', action: 'import-file' }, '⇪ 导入本地'),
			),
		),

		s.error ? Feedback({ tone: 'err' }, s.error) : null,
		s.notice ? Feedback({ tone: 'ok' }, s.notice) : null,
		// 会话过滤空、回落显示全部时的说明（0.13.2：宿主 slot 会话标识与书写入的 id 不同源）
		s.sessionFallback === true
			? h('div', { style: { ...hintStyle, fontSize: font.caption, marginBottom: space.sm } },
				`本会话名下暂时没有匹配到书，先显示全部 ${s.projects.length} 本 —— 书都能正常打开；新建的书会归属到本会话。`)
			: null,

		// ── 列表 ──
		s.loading
			? h('div', { style: hintStyle }, '加载中…')
			: s.projects.length === 0
				? Empty({
					icon: '📚',
					title: '本会话还没有项目',
					hint: '输入书名创建一个；或在会话里让 AI 调 novel_project init —— 书建好后会自动出现在这里。',
				})
				: h('div', { style: stackStyle(space.md) },
					filtering
						? h('div', { style: stackStyle(space.xs) },
							h('input', {
								'data-field': 'project-filter', value: s.filter ?? '',
								placeholder: '筛选：书名 / 题材…',
								'aria-label': '筛选书目',
								style: inputStyle,
							}),
							h('div', { style: { ...hintStyle, fontSize: font.caption } },
								`${shown.length}/${s.projects.length} 本`),
						)
						: null,
					shown.length === 0
						? Empty({ icon: '·', title: '没有匹配的书', hint: '换个关键词，或清空筛选框。' })
						: null,
					...shown.map((p) => h('div', {
						key: p.name,
						style: { ...card(), padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
					},
						h('div', { style: { display: 'flex', minWidth: 0 } },
							// 书脊：一条 3px 竖条，扫一眼就知道卡片边界在哪
							h('div', { style: { flex: 'none', width: '3px', background: color.accent, opacity: 0.75 } }),
							h('div', { style: { flex: '1 1 auto', minWidth: 0, padding: `${space.lg}px` } },
								// 标题行：整块可点（button 才能进 Tab 序 / 被读屏读到 / 回车触发）
								// `...TAP` 给它悬停/按下反馈 —— 交互态只能来自 css.js
								h('button', {
									...TAP,
									'data-action': 'open', 'data-id': p.name,
									style: {
										display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
										// 热区只向上/左/右扩：底部若也负边距，会把下面的标签行
										// 拉上来贴住按钮的 hover 高亮背景（0.13.1 用户实测重叠）。
										padding: `${space.xs}px ${space.sm}px 0`, margin: `-${space.xs}px -${space.sm}px 0`,
										borderRadius: '8px',
										border: 'none', font: 'inherit', color: 'inherit',
									},
								},
									h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm } },
										h('span', {
											style: {
												fontWeight: weight.semibold, fontSize: font.lead,
												overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
											},
										}, p.title || p.name),
										p.style?.built ? Chip({ tone: 'ok' }, '有基线') : null,
										// 方向4：同名书在多工作区根下有多份——面板显示的是 cwd 那份，别让用户
										// 以为「只有一本」。点开/改名/删除都只作用于当前显示的这一份。
										p.duplicates > 0
											? Chip({ tone: 'warn' }, `同名书另有 ${p.duplicates} 份`)
											: null,
									),
								),
								h('div', { style: { display: 'flex', gap: space.xs, marginTop: space.xs } },
									p.genre ? Chip({}, genreLabel(p.genre)) : null,
									p.maxChapter ? Chip({}, `写到第 ${p.maxChapter} 章`) : null,
								),

								h('div', { style: { marginTop: space.md } }, StageRail({ stage: p.stage })),

								statsOf(p).length > 0
									? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: `${space.xs}px ${space.lg}px`, marginTop: space.md } }, ...statsOf(p))
									: null,

								h('div', { style: { display: 'flex', alignItems: 'center', gap: space.xs, marginTop: space.md } },
									Btn({ variant: 'ghost', size: 'sm', action: 'goto-lorebook', id: p.name }, '📖 世界书'),
									Btn({ variant: 'ghost', size: 'sm', action: 'rename-open', id: p.name }, '✎ 改名'),
									Btn({ variant: 'ghost', size: 'sm', action: 'clone-open', id: p.name }, '⧉ 克隆'),
									h('span', { style: { flex: '1 1 auto' } }),
									Btn({ variant: 'danger', size: 'sm', action: 'list-delete', id: p.name }, '删除'),
								),

								// 列表内联改名（目录名=id 不动，只改标题）
								s.rename && s.rename.id === p.name
									? h('div', { style: { display: 'flex', gap: space.sm, marginTop: space.sm } },
										h('input', {
											'data-field': 'rename-value', value: s.rename.value,
											placeholder: '新书名…', 'aria-label': '新书名',
											style: { ...inputStyle, flex: '1 1 auto' },
										}),
										Btn({ variant: 'primary', action: 'rename-confirm', disabled: s.renaming },
											s.renaming ? '保存中…' : '确定'),
										Btn({ action: 'rename-cancel' }, '取消'),
									)
									: null,

								// 克隆为模板（老书连章节带资产复制成新书；目录名是稳定身份，必填）
								s.clone && s.clone.id === p.name
									? h('div', { style: { display: 'flex', gap: space.sm, marginTop: space.sm } },
										h('input', {
											'data-field': 'clone-value', value: s.clone.value,
											placeholder: '新书目录名（如：示例书-模板）', 'aria-label': '新书目录名',
											style: { ...inputStyle, flex: '1 1 auto' },
										}),
										Btn({ variant: 'primary', action: 'clone-confirm', disabled: s.cloning },
											s.cloning ? '克隆中…' : '克隆'),
										Btn({ action: 'clone-cancel' }, '取消'),
									)
									: null,

								// 删除二次确认（误触可取消）
								s.listDeleteId === p.name
									? h('div', {
										style: {
											display: 'flex', alignItems: 'center', gap: space.sm,
											marginTop: space.sm, padding: `${space.sm}px ${space.md}px`,
											borderRadius: '8px', background: tint(color.danger, 10),
										},
									},
										h('span', { style: { fontSize: font.small, color: color.danger } }, '删除这本书？'),
										h('span', { style: { flex: '1 1 auto' } }),
										Btn({
											variant: 'danger', action: 'list-delete', id: p.name,
											disabled: s.listDeleting,
										}, s.listDeleting ? '删除中…' : '确认删除'),
										Btn({ action: 'list-delete-cancel', disabled: s.listDeleting }, '取消'),
									)
									: null,
							),
						),
					)),
				),

		// ── 未归属的旧书（0.5.0 之前的书没有会话戳）──
		s.unclaimed && s.unclaimed.length > 0
			? Card({ tone: 'inset', pad: space.md },
				Section({
					icon: '📦', title: `未归属的书（${s.unclaimed.length}）`,
					right: Btn({ size: 'sm', action: 'claim' }, '全部认领'),
				},
					h('div', { style: { ...hintStyle, fontSize: font.caption } },
						'这些书建在会话归属功能之前。认领后归本会话，之后才会出现在上面的列表里。'),
					h('div', { style: stackStyle(space.xs) },
						...s.unclaimed.map((p) => h('div', {
							key: p.name,
							style: { display: 'flex', alignItems: 'center', gap: space.sm },
						},
							h('span', {
								style: {
									flex: '1 1 auto', minWidth: 0, fontSize: font.small,
									overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
								},
							}, p.title || p.name),
							Btn({ variant: 'ghost', size: 'sm', action: 'claim', id: p.name, disabled: s.busy }, '认领'),
						)),
					),
				),
			)
			: null,

		h('p', { style: footerStyle },
			'列表只显示本会话创建或参与过的项目；写作、门禁、审计都在会话里由 novel_* 工具驱动。'),
	);
}

			return { "projectMatches": projectMatches, "ProjectListView": ProjectListView };
		};

		// ── src/client/ui.js ──
		__factories["src/client/ui.js"] = function (__m, __exports) {
// src/client/ui.js — 面板的 UI 原语层（视图只跟它打交道，不直接拼 style 对象）。
//
// 为什么要有这一层：6 个视图如果各自 `h('div', { style: {...} })` 拼样式，
// 同一件事（一个统计胶囊、一个空态、一段九阶段轨道）就会被写出 6 个略微不同的版本，
// 改一次颜色要翻 6 个文件——0.12 之前的「哪里都不一样」就是这么来的。
//
// 约定：
//   · 这些都是**纯函数**，直接调用，不注册成 React 组件 ——
//     面板的视图本来就是「普通函数 + props 对象」这种直接调用风格（见 panel.js），
//     保持同一种调用形态，headless 预览也才不用真 React 就能序列化出 HTML。
//   · 交互一律靠 `data-action`（宿主里 React 合成事件不可靠），所以按钮只接受
//     `action`/`id`/`field`，不接 onClick。
const { h } = __m("src/client/react.js");
const { color, space, radius, font, weight, tint, card, btnLayout, chip, meterTrackStyle, meterFillStyle, emptyStateStyle, emptyIconStyle, emptyTitleStyle, hintStyle, stackStyle, errStyle, okStyle, statTileStyle, statTileNum, statTileLabel } = __m("src/client/styles.js");
const { PHASES, phaseIndex } = __m("lib/phases.js");

/**
 * 可点区域的标记。**它的交互态在 `css.js` 里**（`[data-nf-tap]:hover` / `:active`）——
 * 内联样式压不过 `:hover`，所以「有反馈」这件事只能靠标记 + 样式表。
 * 视图里写成 `...TAP`，别手打属性名（打错就是静默没反馈）。
 */
const TAP = { 'data-nf-tap': '1' };

/** 卡片。`tone`: plain | inset | accent | warn | danger | ok。 */
function Card({ tone = 'plain', pad } = {}, ...children) {
	return h('div', { style: pad === undefined ? card({ tone }) : card({ tone, pad }) }, ...children);
}

/** 区块标题行：左侧强调色条 + 标题 +（可选）右侧内容。 */
function Section({ icon = '', title, right = null } = {}, ...children) {
	return h('div', { style: stackStyle(space.sm) },
		h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm } },
			h('span', {
				style: {
					fontWeight: weight.semibold, fontSize: font.small, color: color.text,
					borderLeft: `3px solid ${tint(color.accent, 45)}`,
					paddingLeft: space.sm, lineHeight: 1.4,
				},
			}, icon ? `${icon} ${title}` : title),
			right ? h('span', { style: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: space.xs } }, right) : null,
		),
		...children,
	);
}

/**
 * 按钮。`action` 会写进 data-action（事件代理的落点）；
 * `id` 写进 data-id；`field` 用于表单类控件。
 *
 * ⚠️ 这里**只给几何**（`btnLayout`）：底色/描边/字色由 `css.js` 按 `data-variant` 给，
 * 因为内联样式优先级高于 `:hover` / `:active` —— 外观留在内联里按钮就永远没有按下反馈。
 */
function Btn(props = {}, ...label) {
	const { variant = 'secondary', size = 'md', action, id, disabled = false, title, block = false } = props;
	// 无障碍名：camelCase 与 kebab-case 两种写法都收 —— 只认一种时，另一种会被白名单
	// 静默吞掉（图标按钮对读屏器不可名），失效方式与 dataset.no 事故同族：不报错、看不出来。
	const aria = props.ariaLabel ?? props['aria-label'];
	const style = { ...btnLayout({ size }) };
	if (block) style.width = '100%';
	return h('button', {
		'data-nf-btn': '1',
		'data-variant': variant,
		'data-size': size,
		...(action ? { 'data-action': action } : {}),
		...(id === undefined || id === null ? {} : { 'data-id': String(id) }),
		...(disabled ? { disabled: true } : {}),
		...(title ? { title } : {}),
		// M17 修复：aria-label 此前被参数白名单丢掉——纯图标按钮（▶⏸⏹）对读屏器不可名
		...(aria ? { 'aria-label': aria } : {}),
		style,
	}, ...label);
}

/** 胶囊标签。`tone`: neutral | accent | ok | warn | danger | ink。 */
function Chip({ tone = 'neutral' } = {}, ...children) {
	return h('span', { style: chip({ tone }) }, ...children);
}

/**
 * 异步反馈条（成功 notice / 失败 error）。
 * 带 `role`：status（polite）/ alert——异步出现的文字对读屏用户本来完全不可见，
 * 有了它才会被播报。各视图的 s.error / s.notice 一律走这里，别再裸拼 errStyle。
 */
function Feedback({ tone = 'ok' } = {}, ...children) {
	const isErr = tone === 'err';
	return h('div', {
		role: isErr ? 'alert' : 'status',
		style: isErr ? errStyle : okStyle,
	}, ...children);
}

/**
 * 统计块（项目卡的「12 章」「34 台账」这种）。
 * 数字加重、单位弱化，扫读时先看数。
 */
function Stat({ icon = '', value, unit = '', tone = 'neutral' } = {}) {
	const toneColor = tone === 'warn' ? color.warn : tone === 'danger' ? color.danger
		: tone === 'ok' ? color.ok : tone === 'accent' ? color.accent : color.text2;
	return h('span', {
		style: {
			display: 'inline-flex', alignItems: 'baseline', gap: '2px',
			fontSize: font.caption, color: color.text3, whiteSpace: 'nowrap',
			// 数字等宽：统计行里「12 章 / 34 台账 / 128 伏笔」横向对比时个位对齐，不跳宽
			fontVariantNumeric: 'tabular-nums',
		},
	},
		icon ? h('span', { style: { fontSize: '10px' } }, icon) : null,
		h('span', { style: { fontWeight: weight.semibold, fontSize: font.small, color: toneColor } }, String(value)),
		unit ? h('span', null, unit) : null,
	);
}

/**
 * 仪表盘数字卡（详情/体检页的「章节 / 伏笔 / 硬伤」指标）。
 * 大号等宽数字 + 弱标签，扫读时先看数——典型的商业后台观感。
 * @param {object} p { value, label, tone }  tone: neutral|accent|ok|warn|danger
 */
function StatTile({ value, label = '', tone = 'neutral', icon = '', size = 'md' } = {}) {
	const c = tone === 'warn' ? color.warn
		: tone === 'danger' ? color.danger
		: tone === 'ok' ? color.ok
		: tone === 'accent' ? color.accent
		: color.text;
	const compact = size === 'sm';
	const numStyle = compact ? { ...statTileNum, fontSize: font.lead } : statTileNum;
	const boxStyle = compact
		? { ...statTileStyle, padding: `${space.sm}px ${space.sm}px`, minWidth: '58px' }
		: statTileStyle;
	return h('div', { style: boxStyle },
		icon ? h('div', { style: { fontSize: '11px', lineHeight: 1, marginBottom: '2px', opacity: .82 } }, icon) : null,
		h('div', { style: { ...numStyle, color: c } }, String(value)),
		label ? h('div', { style: statTileLabel }, label) : null,
	);
}

/**
 * 九阶段轨道：9 段小条，已过阶段实心、当前阶段着色加粗、未来阶段只留描边。
 * 阶段链是单一定义（lib/phases.js），这里只负责画——不要在视图里另抄一份阶段名。
 * @param {object} p { stage }  novel.stage（九阶段 id 或旧五阶段别名）
 */
function StageRail({ stage } = {}) {
	const idx = phaseIndex(stage);
	const current = idx >= 0 ? PHASES[idx] : null;
	return h('div', { style: stackStyle(space.xs) },
		h('div', {
			style: { display: 'flex', gap: '2px', alignItems: 'center' },
			title: current ? `当前阶段：${current.label}（${current.entry}）` : '阶段未标记',
		},
			PHASES.map((p, i) => h('span', {
				key: p.id,
				'aria-hidden': 'true', // 纯装饰；可读名称在 title 与下方 Chip 上
				style: {
					flex: '1 1 0', height: '3px', borderRadius: radius.pill,
					// 已过段用半透 accent、当前段全亮 + 外环——3px 小条上「现在到哪了」
					// 靠色差说话，不能只靠那圈 1.5px 的环（0.13.2 审查：同色根本分不出）。
					background: i < idx ? tint(color.accent, 42)
						: i === idx ? color.accent : color.border2,
					opacity: i === idx ? 1 : i < idx ? 0.9 : 1,
					boxShadow: i === idx ? `0 0 0 1.5px ${tint(color.accent, 30)}` : 'none',
				},
			})),
		),
		h('div', { style: { display: 'flex', alignItems: 'center', gap: space.xs } },
			Chip({ tone: 'accent' }, current ? current.label : '未标阶段'),
			current ? h('span', { style: { ...hintStyle, fontSize: font.caption } },
				`${idx + 1}/${PHASES.length}`) : null,
		),
	);
}

/** 占比条。 */
function Meter({ pct, tone = 'accent' } = {}) {
	return h('div', { style: meterTrackStyle }, h('div', { style: meterFillStyle(pct, tone) }));
}

/** 空态：图标 + 主文案 +（可选）次文案 +（可选）动作行。 */
function Empty({ icon = '·', title, hint = null, action = null } = {}) {
	return h('div', { style: emptyStateStyle },
		h('span', { style: emptyIconStyle }, icon),
		h('div', { style: emptyTitleStyle }, title),
		hint ? h('div', { style: { ...hintStyle, fontSize: font.caption, lineHeight: 1.7 } }, hint) : null,
		action ? h('div', { style: { display: 'flex', gap: space.sm, marginTop: space.xs } }, ...action) : null,
	);
}

/** 键值行（档案/设置）。 */
function KV({ k } = {}, ...children) {
	return h('div', { style: { display: 'flex', gap: space.md, alignItems: 'flex-start' } },
		h('span', {
			style: {
				flex: 'none', minWidth: '52px', fontFamily: color.mono,
				fontSize: font.caption, color: color.text3, paddingTop: '2px',
			},
		}, k),
		h('span', { style: { flex: '1 1 auto', minWidth: 0, fontSize: font.small, wordBreak: 'break-word' } }, ...children),
	);
}

/** 可折叠区块（原生 <details>，不吃 React 事件，不需要事件代理）。 */
function Fold({ title, open = false, tone = 'plain' } = {}, ...children) {
	const c = card({ tone, pad: space.md });
	return h('details', { style: c, open },
		h('summary', {
			style: {
				cursor: 'pointer', fontSize: font.small, color: color.text2,
				fontWeight: weight.medium, listStylePosition: 'inside',
			},
		}, title),
		h('div', { style: { marginTop: space.sm } }, ...children),
	);
}

/** 等宽小段（文件名、id、路由这类）。 */
function Mono(_props = {}, ...children) {
	return h('span', { style: { fontFamily: color.mono, fontSize: font.caption, color: color.text3 } }, ...children);
}

			return { "TAP": TAP, "Card": Card, "Section": Section, "Btn": Btn, "Chip": Chip, "Feedback": Feedback, "Stat": Stat, "StatTile": StatTile, "StageRail": StageRail, "Meter": Meter, "Empty": Empty, "KV": KV, "Fold": Fold, "Mono": Mono };
		};

		// ── lib/phases.js ──
		__factories["lib/phases.js"] = function (__m, __exports) {
// lib/phases.js — 九阶段状态机（纯函数，零 token）。
//
// 为什么要有它：旧版 `lib/gate.js` 只有五个阶段（planning/outline/drafting/
// revising/done），门禁只查得到一件事——「这一章的细纲批了没」。于是
// 「设定没定就想写大纲」「大纲没过就想写正文」「第一章还没写就想宣布完稿」
// 全都拦不住。这里把鱼的九阶段链搬过来，每一阶段带**入场条件**（纯函数判定）
// 与 **PhaseReport**（passed / errorCount / warningCount），阶段推进可审计、可回退。
//
// 兼容：旧书的 `novel.stage` 是 planning/outline/drafting/revising/done，
// 通过 LEGACY_STAGE 别名映射进新链，判定与展示都认——用户盘上的老数据零迁移成本。

/** 九阶段：id 即 novel.stage 的取值。order 用于「只前进」比较。 */
const PHASES = [
    { id: 'topic', label: '立意', order: 0, entry: '一句话故事（logline）已定' },
    { id: 'setting', label: '设定', order: 1, entry: '世界书有条目或已写故事承诺书' },
    { id: 'character', label: '人物', order: 2, entry: '至少一张人物卡' },
    { id: 'outline', label: '大纲', order: 3, entry: '全书大纲已保存' },
    { id: 'volume', label: '分卷', order: 4, entry: '大纲含卷/幕/部结构' },
    { id: 'chapter', label: '细纲', order: 5, entry: '至少一章细纲已批准' },
    { id: 'writing', label: '正文', order: 6, entry: '至少一章正文已保存' },
    { id: 'revision', label: '修订', order: 7, entry: '至少一章正文，且全书一致性无硬伤' },
    { id: 'done', label: '完稿', order: 8, entry: '所有已批细纲都有正文' },
];

const PHASE_IDS = PHASES.map((p) => p.id);

/** 阶段状态（鱼的四态 + locked）。 */
const PHASE_STATUS = ['locked', 'in_progress', 'review', 'approved', 'skipped'];

/** 旧五阶段 → 新九阶段别名。老书 stage 落在这些键上照常工作。 */
const LEGACY_STAGE = {
    planning: 'topic',
    outline: 'outline',
    drafting: 'writing',
    revising: 'revision',
    done: 'done',
};

/** 旧名专属展示标签（旧值直接展示时给一个不变的中文，避免面板文字跳动）。 */
const LEGACY_STAGE_LABEL = {
    planning: '规划', outline: '大纲', drafting: '正文', revising: '修订', done: '完结',
};

/**
 * 归一化阶段名：接受九阶段 id 或旧的五阶段别名。
 * @returns {string|null} 九阶段 id；无法识别返回 null
 */
function canonicalPhase(stage) {
    if (typeof stage !== 'string' || stage === '') return null;
    if (PHASE_IDS.includes(stage)) return stage;
    return LEGACY_STAGE[stage] ?? null;
}

/** 阶段序号；无法识别返回 -1。 */
function phaseIndex(stage) {
    const id = canonicalPhase(stage);
    return id === null ? -1 : PHASES.find((p) => p.id === id).order;
}

/** 阶段中文标签（认九阶段 id 与旧别名）。 */
function phaseLabel(stage) {
    const id = canonicalPhase(stage);
    if (id !== null) return PHASES.find((p) => p.id === id).label;
    return LEGACY_STAGE_LABEL[stage] ?? stage ?? '—';
}

function phaseMeta(stage) {
    const id = canonicalPhase(stage);
    return id === null ? null : PHASES.find((p) => p.id === id);
}

/**
 * 每阶段的**入场条件**：纯函数，由事实快照 facts 判定。
 * 用 test 而不是读盘——IO 走 lib/phase-io.js 的 loadPhaseFacts。
 */
const REQUIREMENTS = {
    topic: [
        { label: '一句话故事（logline）为空——先把「这本书讲什么」写出来', test: (f) => String(f.logline ?? '').trim() !== '' },
    ],
    setting: [
        { label: '世界书为空且无故事承诺书——设定先于大纲', test: (f) => (f.worldbookCount ?? 0) >= 1 || f.hasPromise === true },
    ],
    character: [
        { label: '还没有人物卡——novel_character save 至少建一张', test: (f) => (f.castCount ?? 0) >= 1 },
    ],
    outline: [
        { label: '全书大纲未保存——novel_outline save_book', test: (f) => f.hasBookOutline === true },
    ],
    volume: [
        {
            label: '大纲里没有卷/幕/部结构——长篇先分卷再铺细纲。被接受的写法：'
                + '「## 第一卷《卷名》第 1–30 章」「## 卷一」「## 第三卷《卷名》第 71 章起」（开区间），'
                + '或一个含「分卷结构」的小标题',
            test: (f) => f.hasVolumePlan === true,
        },
    ],
    chapter: [
        { label: '没有已批准的细纲——novel_outline save_chapter + approve', test: (f) => (f.approvedOutlineCount ?? 0) >= 1 },
    ],
    writing: [
        { label: '还没有已保存的正文——novel_write_chapter', test: (f) => (f.savedChapterCount ?? 0) >= 1 },
    ],
    revision: [
        { label: '还没有可修订的正文', test: (f) => (f.savedChapterCount ?? 0) >= 1 },
        { label: '全书一致性存在硬伤——先 novel_project check 修完再宣布进入修订', test: (f) => (f.continuityErrors ?? 0) === 0 },
    ],
    done: [
        { label: '还没有已批细纲', test: (f) => (f.approvedOutlineCount ?? 0) >= 1 },
        { label: '尚有已批细纲没有正文——完稿前补齐', test: (f) => f.allApprovedWritten === true },
    ],
};

/** 某阶段的入场条件是否满足（纯函数）。 */
function checkPhaseEntry(phaseId, facts = {}) {
    const id = canonicalPhase(phaseId);
    if (id === null) throw new Error(`未知阶段：${phaseId}（可用：${PHASE_IDS.join(' / ')}）`);
    const missing = [];
    for (const req of REQUIREMENTS[id] ?? []) {
        let ok = false;
        try { ok = req.test(facts) === true; } catch { ok = false; }
        if (!ok) missing.push(req.label);
    }
    return { phase: id, ok: missing.length === 0, missing };
}

/**
 * 由 phases 记录推当前阶段：取「已被显式标记过」的最靠后阶段。
 * 仅用于展示/对账；`novel.stage` 才是权威字段。
 */
function deriveStage(novel) {
    const rec = novel?.phases ?? {};
    let best = -1;
    for (const id of PHASE_IDS) {
        const s = rec[id]?.status;
        if (s === undefined || s === 'locked') continue;
        best = Math.max(best, phaseIndex(id));
    }
    if (best < 0) return canonicalPhase(novel?.stage) ?? PHASE_IDS[0];
    return PHASES[best].id;
}

/**
 * 记一笔阶段记录（自动推进用，不查入场条件）。
 * 已 approved 的阶段不被降级回 in_progress（避免重复触碰把状态打回去）。
 */
function touchPhase(novel, stage, status = 'in_progress', extra = {}) {
    const id = canonicalPhase(stage);
    if (novel === null || novel === undefined || id === null) return novel;
    novel.phases = novel.phases ?? {};
    const cur = novel.phases[id] ?? null;
    if (cur?.status === 'approved' && status === 'in_progress') return novel;
    novel.phases[id] = { ...(cur ?? {}), status, at: new Date().toISOString(), ...extra };
    return novel;
}

/** 造一份 PhaseReport（鱼的口径：passed / errorCount / warningCount）。 */
function phaseReport({ phase, status = 'approved', errorCount = 0, warningCount = 0, notes = [] } = {}) {
    const id = canonicalPhase(phase);
    return {
        phase: id ?? phase,
        status,
        passed: errorCount === 0,
        errorCount,
        warningCount,
        notes: Array.isArray(notes) ? notes : [String(notes)],
        at: new Date().toISOString(),
    };
}

/**
 * 显式进入某阶段：查入场条件，通过（或 force）则落 novel.stage + phases 记录。
 * 不抛错（与 resetStage 不同）——返回 {ok:false, missing} 交由调用方决定怎么告知。
 * `report` 交由调用方传入（例如 revision 阶段带上一致性校验数字）。
 */
function enterPhase(novel, stage, { force = false, facts = {}, report = null, actor = 'agent' } = {}) {
    const id = canonicalPhase(stage);
    if (id === null) throw new Error(`未知阶段：${stage}（可用：${PHASE_IDS.join(' / ')}；兼容旧名：${Object.keys(LEGACY_STAGE).join(' / ')}）`);
    if (novel === null || novel === undefined) throw new Error('书目不存在');
    const chk = checkPhaseEntry(id, facts);
    if (!chk.ok && !force) {
        return {
            ok: false, phase: id, label: phaseLabel(id), forced: false, missing: chk.missing,
            reason: `阶段「${phaseLabel(id)}」入场条件未满足：\n${chk.missing.map((m) => `- ${m}`).join('\n')}`,
        };
    }
    const idx = phaseIndex(id);
    novel.stage = id;
    novel.phases = novel.phases ?? {};
    // 越过的前置阶段记 skipped（可审计的「跳阶段」），已完成的不动
    for (const p of PHASES) {
        if (p.order >= idx) break;
        if (novel.phases[p.id] === undefined) novel.phases[p.id] = { status: 'skipped', at: new Date().toISOString(), report: null };
    }
    const rep = report ?? phaseReport({
        phase: id, status: chk.ok ? 'approved' : 'in_progress',
        errorCount: chk.ok ? 0 : chk.missing.length,
        notes: chk.ok ? [] : [`force 放行：${chk.missing.join('；')}`],
    });
    novel.phases[id] = { status: 'approved', at: rep.at, report: rep, actor: chk.ok ? actor : 'user' };
    return { ok: true, phase: id, label: phaseLabel(id), forced: !chk.ok, missing: chk.missing, report: rep };
}

/**
 * 阶段看板：每阶段的现状 + 入场条件检查 + 最近一次 PhaseReport。
 * @returns {Array<{phase,label,order,status,current,entryOk,missing,report,at}>}
 */
function phaseBoard(novel, facts = {}) {
    const current = canonicalPhase(novel?.stage) ?? PHASE_IDS[0];
    return PHASES.map((p) => {
        const rec = novel?.phases?.[p.id] ?? null;
        const chk = checkPhaseEntry(p.id, facts);
        const isCurrent = p.id === current;
        const status = rec?.status ?? (isCurrent ? 'in_progress' : 'locked');
        return {
            phase: p.id, label: p.label, order: p.order,
            status, current: isCurrent,
            entryOk: chk.ok, missing: chk.missing,
            report: rec?.report ?? null, at: rec?.at ?? null,
        };
    });
}

const STATUS_MARK = { approved: '✓', in_progress: '●', review: '◐', skipped: '↷', locked: '○' };

/** 阶段看板 → 终端文本（novel_project phase 的 render）。 */
function renderPhaseBoard(board, { current } = {}) {
    const lines = board.map((p) => {
        const mark = STATUS_MARK[p.status] ?? '○';
        const head = `${mark} ${p.label.padEnd(4, '　')} ${p.status}${p.current ? '  ←当前' : ''}`;
        const miss = p.missing.length > 0 && (p.current || p.order <= (board.find((b) => b.current)?.order ?? 0) + 1)
            ? `\n    缺：${p.missing.join('；')}`
            : '';
        return head + miss;
    });
    return `阶段进度（当前 ${current ?? '—'}）\n${lines.join('\n')}`;
}

			return { "PHASES": PHASES, "PHASE_IDS": PHASE_IDS, "PHASE_STATUS": PHASE_STATUS, "LEGACY_STAGE": LEGACY_STAGE, "LEGACY_STAGE_LABEL": LEGACY_STAGE_LABEL, "canonicalPhase": canonicalPhase, "phaseIndex": phaseIndex, "phaseLabel": phaseLabel, "phaseMeta": phaseMeta, "checkPhaseEntry": checkPhaseEntry, "deriveStage": deriveStage, "touchPhase": touchPhase, "phaseReport": phaseReport, "enterPhase": enterPhase, "phaseBoard": phaseBoard, "renderPhaseBoard": renderPhaseBoard };
		};

		// ── src/client/genre.js ──
		__factories["src/client/genre.js"] = function (__m, __exports) {
// src/client/genre.js — 题材显示名归一。
//
// 为什么存在：面板创建表单早期把题材默认值写死成英文 'fantasy'（还没有题材输入框），
// 一批书的数据里存的是英文小写。工具侧建书默认是「未分类」，模型给的通常是中文。
// 这里在**显示层**做一次归一：常见英文题材映射成中文，其余原样透传——
// 不改用户数据，映射表外的值（比如自造的复合题材）不受影响。

const MAP = {
	fantasy: '奇幻',
	xuanhuan: '玄幻',
	xianxia: '仙侠',
	xiuzhen: '修真',
	wuxia: '武侠',
	scifi: '科幻',
	sciencefiction: '科幻',
	romance: '言情',
	mystery: '悬疑',
	suspense: '悬疑',
	thriller: '惊悚',
	horror: '恐怖',
	urban: '都市',
	city: '都市',
	game: '游戏',
	esports: '电竞',
	history: '历史',
	military: '军事',
	comedy: '喜剧',
	drama: '剧情',
	sliceoflife: '日常',
};

/**
 * 题材显示名。空值返回 ''（调用方用真值判断决定要不要渲染 chip）；
 * 命中映射表（忽略大小写/连字符/空格）给中文，否则原样返回。
 */
function genreLabel(genre) {
	const raw = String(genre ?? '').trim();
	if (!raw) return '';
	const key = raw.toLowerCase().replace(/[^a-z]/g, '');
	return MAP[key] ?? raw;
}

			return { "genreLabel": genreLabel };
		};

		// ── src/client/views/project-detail.js ──
		__factories["src/client/views/project-detail.js"] = function (__m, __exports) {
// src/client/views/project-detail.js — 项目详情：两个标签（基本信息 / 章节听书）。
//
// 这个页面承担三件事，顺序就是版面顺序：
//   ① **看**：要素总览（档案/大纲/角色卡/设定/时间线）——书攒了什么（views/overview.js）
//   ② **查**：全书体检（GET /continuity，纯函数零 token）——哪儿对不上
//   ③ **改**：提案队列 + 本章编辑 + 润色/校对 + 批量起草
//
// 能力边界（0.13.2 起如实呈现，别再写「需要模型参与」糊过去）：
//   · 润色 / 校对 → 服务端有真端点（D1 旁路引擎），产物是**提案**，点应用才生效
//   · 批量起草 → 服务端有真端点（D2），并发生成、串行提交，每章仍过同一套门禁
//   · 写章 → 复用 D2 端点单章跑（from=当前章、count=1），同一条门禁链直接落盘
//   · 结构诊断 / 全书体检 → 服务端纯函数端点，零 token，面板直出结果
//   · 导入、带 continuity/voice/platform/censor 参数的 novel_audit → 仍在会话里调
const { h } = __m("src/client/react.js");
const { color, space, font, weight, hintStyle, okStyle, errStyle, warnStyle, inputStyle, manuscriptStyle, stackStyle, tint, rowWrapStyle } = __m("src/client/styles.js");
const { Card, Btn, Chip, StatTile, Fold, Mono, Feedback } = __m("src/client/ui.js");
const { phaseLabel } = __m("lib/phases.js");
const { ChapterListView } = __m("src/client/views/chapters.js");
const { ProjectOverviewView } = __m("src/client/views/overview.js");
const { ReaderOverlay } = __m("src/client/views/reader-overlay.js");

/** 分段控件（替代并排两个描边按钮：当前项一眼看得出）。 */
function Segmented({ tab }) {
	const item = (value, label) => {
		const active = tab === value;
		return h('button', {
			'data-action': 'detail-tab', 'data-tab': value,
			// 四态（常态 / 悬停 / 按下 / 选中）全部由 css.js 的 [data-nf-seg] 规则管：
			// 「选中」是状态不是伪类，用 data-active 表达，CSS 才能一次排好优先级
			//（底色若内联，选中项一悬停就会丢掉"选中"的样子）。
			'data-nf-seg': '1', 'data-active': active ? '1' : '0',
			style: {
				flex: '1 1 0', padding: `${space.xs + 1}px ${space.xs}px`,
				border: 'none', borderRadius: '7px', cursor: 'pointer',
				fontFamily: 'inherit', fontSize: font.caption,
				fontWeight: active ? weight.semibold : weight.normal,
				// 5 个标签在窄栏里不能贴死：由内边距与换行控制密度
				minWidth: 0, whiteSpace: 'nowrap',
			},
		}, label);
	};
	return h('div', {
		style: {
			display: 'flex', gap: '2px', padding: '2px',
			borderRadius: '9px', background: color.inset, flexWrap: 'wrap',
		},
	},
		item('info', '概览'),
		item('chapters', '章节'),
		item('health', '体检'),
		item('proposals', '提案'),
		item('edit', '编辑'),
	);
}

/** 会话疲劳横幅（0.15.1）：服务端按当前会话聚合的首稿趋势——退化时提醒换会话。
 *  唯一按钮「创建新会话并交接」（用户钦定 2026-10-08）：单击即建新会话（服务端有归档
 *  能力就建+归档一起做），交接摘要自动进剪贴板、文本常驻横幅可手动复制。探测不到就不做假按钮。 */
function SessionFatigueBanner({ session, copied }) {
	if (!session?.warn) return null;
	// 分级（0.18.0 判据全 soft；体量护栏 1.0.5 起 hard）：hard = 继续写大概率整轮 400，
	// 用 danger 色和「体量判死」标题——它不是质量建议，不能再长得像一般提醒。
	const hard = session.level === 'hard';
	const est = session.contextEst;
	return h('div', {
		style: {
			border: `1px solid ${tint(hard ? color.danger : color.warn, 34)}`, borderRadius: '9px',
			padding: `${space.sm}px ${space.md}px`, background: tint(hard ? color.danger : color.warn, 10),
		},
	},
		h('div', { style: { display: 'flex', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' } },
			h('span', { style: { fontWeight: weight.semibold, color: hard ? color.danger : undefined } },
				hard ? '🛑 上下文体量将满' : '⚠ 会话疲劳'),
			h('span', { style: hintStyle },
				`本会话已写 ${session.chapters} 章 · 首稿均长 ${session.firstAvg} 字`
				// 口径必须写出来：首稿＝门禁驳回前的初稿，不是成稿字数（0.18.0——旧文案只写
				// 「全书基线」，读者把 1459 当成"放行了短章"，实际那是被顶回来之前的初稿）
				+ '（首稿＝门禁驳回前的初稿，非成稿'
				+ (session.bookFirstAvg > 0 ? ` · 其它会话首稿均值 ${session.bookFirstAvg} 字` : '')
				+ '）'),
		),
		// 体量估算（保守下限）常驻可见：先有数字再谈建议——和「自批占比」同一可见性思路
		est ? h('div', { style: { ...hintStyle, marginTop: space.xs } },
			`上下文体量预估 ${est.estTokens} tokens（${est.turns} 次写章 · 草稿 ${est.draftChars} 字，简报包等未全计）`
			+ ` ≈ ${est.pct}% / ${est.budgetTokens} 预算`) : null,
		// 会话归属兜底口径（1.0.5）：面板 id 与记账不同源时数字来自唯一会话，必须自报家门
		session.scopeNote ? h('div', { style: { ...hintStyle, marginTop: space.xs } }, `ℹ ${session.scopeNote}`) : null,
		h('div', { style: { ...hintStyle, marginTop: space.xs } },
			hard
				? '继续写大概率整轮 400（CONTEXT_WINDOW_EXCEEDED），报错发生在模型侧、工具救不回来。'
				: '对话历史堆积会稀释输出质量。'),
		h('div', { style: { ...hintStyle, marginTop: space.xs } },
			'书的状态全在盘上——换会话零损失。'),
		h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm, marginTop: space.sm } },
			// 唯一按钮（用户钦定 2026-10-08）：能建就建（服务端有归档能力就建+归档一起做）；
			// 交接摘要自动进剪贴板，摘要文本同时常驻下方——剪贴板失败也有手动路。
			session.canCreate ? Btn({ action: 'session-create', variant: 'secondary', size: 'sm' },
				copied ? '✓ 已创建——摘要已复制，可手动粘贴' : '创建新会话并交接') : null,
		),
		session.canCreate && session.handoff ? h('div', {
			style: {
				...hintStyle, marginTop: space.sm, whiteSpace: 'pre-wrap',
				maxHeight: '7em', overflowY: 'auto', userSelect: 'text',
			},
		}, session.handoff) : null,
	);
}

/** 体检结果里的一条问题。 */
function issueRow(issue, i, total) {
	const isErr = issue.severity === 'error';
	return h('div', {
		key: i,
		style: {
			display: 'flex', gap: space.sm, alignItems: 'flex-start',
			paddingTop: space.sm,
			marginTop: i === 0 ? 0 : space.sm,
			borderTop: i === 0 ? 'none' : `1px solid ${color.border1}`,
		},
	},
		h('span', { style: { flex: 'none', fontSize: font.small, color: isErr ? color.danger : color.warn } },
			isErr ? '✗' : '⚠'),
		h('div', { style: { flex: '1 1 auto', minWidth: 0 } },
			h('div', { style: { fontSize: font.small, lineHeight: 1.65 } }, issue.message ?? ''),
			h('div', { style: { marginTop: '2px', display: 'flex', gap: space.sm, flexWrap: 'wrap' } },
				Chip({ tone: isErr ? 'danger' : 'warn' }, issue.where ?? ''),
				Mono({}, issue.code ?? ''),
				total > 12 && i === 11 ? Chip({}, `…另有 ${total - 12} 条`) : null,			),
		),
	);
}

/** 批量起草的每条结果。 */
function batchRow(r, i) {
	const ok = r.ok === true;
	return h('div', {
		key: i,
		style: { display: 'flex', alignItems: 'flex-start', gap: space.sm, fontSize: font.small, padding: '2px 0' },
	},
		h('span', { style: { flex: 'none', color: ok ? color.ok : color.danger } }, ok ? '✓' : '✗'),
		h('span', { style: { flex: 'none', color: color.text3, minWidth: '52px' } }, `第 ${r.chapter} 章`),
		h('span', { style: { flex: '1 1 auto', minWidth: 0, wordBreak: 'break-word', color: ok ? color.text2 : color.danger } },
			ok
				? `${r.title ?? ''} ${r.chars ? `${r.chars} 字` : ''} v${r.version ?? 1}${r.noai?.level ? ` · 去AI味 ${r.noai.level}` : ''}`
				: (r.reason ?? r.contentGate?.reason ?? '未通过门禁')),
	);
}

function ProjectDetailView({ state: s }) {
	const chapters = s.chapterList ?? [];
	const maxWritten = chapters.reduce((m, c) => Math.max(m, c.no ?? 0), 0);
	const nextNo = maxWritten + 1;
	// 陈旧提案（superseded）也要列出来：apply 被陈旧守卫拒下时，错误文案让用户
	// 「请丢弃后基于最新版重提」，而面板此前只渲染 pending——用户在界面上根本看不到
	// 这条提案，丢弃按钮也就不存在，提示指向一个不存在的动作（流程死锁）。
	// 陈旧提案只给「丢弃」，不给「应用」（它已不可能生效，点了只会再撞一次守卫）。
	const pendingProposals = (s.proposals || []).filter((p) => p.status === 'pending' || p.status === 'superseded');
	const pendingCount = pendingProposals.filter((p) => p.status === 'pending').length;
	const revising = s.revising ?? null;

	// ── 创作驾驶舱（GET /dashboard · 只读聚合，零 token）──
	const dash = s.dashboard;
	const review = dash?.platformReview;
	const readinessMeta = {
		blocked: { label: '受阻', tone: 'danger', card: 'danger' },
		attention: { label: '需处理', tone: 'warn', card: 'warn' },
		ready: { label: '可推进', tone: 'ok', card: 'plain' },
	}[dash?.readiness ?? 'ready'];
	const dashboardBlock = Card({ tone: readinessMeta.card },
		h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' } },
			h('span', { style: { fontWeight: weight.semibold, fontSize: font.small } }, '🎛 创作驾驶舱'),
			dash ? Chip({ tone: readinessMeta.tone }, readinessMeta.label) : null,
			h('span', { style: { flex: '1 1 auto' } }),
			Btn({
				size: 'sm', variant: dash ? 'ghost' : 'secondary', action: 'refresh-dashboard',
				disabled: s.dashboardLoading,
			}, s.dashboardLoading ? '汇总中…' : dash ? '↻ 刷新' : '汇总'),
		),
		s.dashboardLoading && !dash
			? h('div', { style: { ...hintStyle, marginTop: space.sm } }, '正在聚合进度、体检、大纲、提案与平台口径……')
			: s.dashboardError
				? h('div', { style: { ...errStyle, fontSize: font.small, marginTop: space.sm, lineHeight: 1.7 } },
					`⚠️ 驾驶舱加载失败：${s.dashboardError}——先点重试；它失败不影响保存和写作。`)
				: !dash
					? h('div', { style: { ...hintStyle, fontSize: font.caption, marginTop: space.sm, lineHeight: 1.7 } },
						'把已有信号折叠成一个判断：现在该继续写、改体检、收大纲欠账，还是处理提案。')
					: h('div', { style: { marginTop: space.md } },
						h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: space.sm, marginBottom: space.sm } },
							StatTile({ value: dash.progress.chapterCount, label: '已写章' }),
							StatTile({ value: dash.progress.nextChapter, label: '下一章', tone: 'accent' }),
							StatTile({ value: dash.quality.errors, label: '硬伤', tone: dash.quality.errors > 0 ? 'danger' : 'ok' }),
							StatTile({ value: dash.quality.warnings, label: '警告', tone: dash.quality.warnings > 0 ? 'warn' : 'neutral' }),
							StatTile({ value: dash.outline.overdue, label: '欠账候选', tone: dash.outline.overdue > 0 ? 'warn' : 'neutral' }),
							StatTile({ value: dash.proposals.pending, label: '待批提案', tone: dash.proposals.pending > 0 ? 'warn' : 'neutral' }),
						),
						h('div', { style: { display: 'flex', flexDirection: 'column', gap: space.xs } },
							...(dash.actions ?? []).map((a, i) => h('div', {
								key: i,
								style: {
									display: 'flex', gap: space.sm, alignItems: 'flex-start',
									padding: `${space.xs}px 0`, borderTop: i === 0 ? 'none' : `1px solid ${color.border1}`,
								},
							},
								h('span', {
									style: {
										flex: 'none', fontSize: font.small,
										color: a.level === 'danger' ? color.danger : a.level === 'warn' ? color.warn : a.level === 'ok' ? color.ok : color.text3,
									},
								}, a.level === 'danger' ? '✗' : a.level === 'warn' ? '⚠' : a.level === 'ok' ? '✓' : '·'),
								h('span', { style: { flex: '1 1 auto', fontSize: font.small, lineHeight: 1.7 } }, a.text),
							))),
						h('div', { style: { ...hintStyle, fontSize: font.caption, marginTop: space.sm } },
							`平台口径：${dash.platform.charMin ?? '?'}–${dash.platform.charMax ?? '?'} 字（${dash.charSourceLabel ?? '默认'}）`)),
		review?.available
			? h('div', { style: { marginTop: space.sm, paddingTop: space.sm, borderTop: `1px solid ${color.border1}` } },
				h('div', { style: { display: 'flex', gap: space.sm, flexWrap: 'wrap', alignItems: 'baseline' } },
					h('span', { style: { fontWeight: weight.semibold, fontSize: font.small } }, '平台审稿抽样'),
					h('span', { style: { ...hintStyle, fontSize: font.caption } },
						`${review.name} · 前 3 + 最近 12 · ${review.scanned} 章 · 平均分 ${review.avgScore} · 硬伤 ${review.errors} · 警告 ${review.warnings}`)),
				review.topIssues?.length > 0
					? h('div', { style: { display: 'flex', flexDirection: 'column', gap: space.xs, marginTop: space.sm } },
						review.topIssues.map((item, i) => h('div', {
							key: `${item.chapter}-${item.key}-${i}`,
							style: {
								paddingLeft: space.sm,
								borderLeft: `2px solid ${item.level === 'error' ? color.danger : color.warn}`,
								fontSize: font.caption, lineHeight: 1.7,
							},
						},
							h('div', { style: { color: item.level === 'error' ? color.danger : color.warn } },
								`第 ${item.chapter} 章 · ${item.label}：${item.value}${item.target ? `（目标 ${item.target}）` : ''}`),
							item.advice ? h('div', { style: { color: color.text3 } }, item.advice) : null,
							Number.isInteger(item.chapter) && item.chapter > 0
								? h('div', { style: { marginTop: space.xs } },
									Btn({
										size: 'sm', variant: 'ghost', action: 'review-open-chapter', id: item.chapter,
										title: `打开第 ${item.chapter} 章编辑`,
										ariaLabel: `打开第 ${item.chapter} 章编辑`,
									}, `打开第 ${item.chapter} 章`),
								)
								: null,
						)))
					: h('div', { style: { ...hintStyle, fontSize: font.caption, marginTop: space.xs } }, '抽样没有命中平台硬伤或警告。'))
			: null,
	);

	// ── 面包屑 + 快捷动作（FUSION 1.7）──
	const crumb = h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm, minWidth: 0, flexWrap: 'wrap' } },
		Btn({ variant: 'ghost', size: 'sm', action: 'back' }, '← 返回'),
		h('span', {
			style: {
				fontWeight: weight.semibold, fontSize: font.lead, minWidth: 0,
				overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 auto',
			},
		}, s.detail?.title || s.selected || ''),
		s.detail?.stage ? Chip({ tone: 'accent' }, phaseLabel(s.detail.stage)) : null,
		Btn({ variant: 'ghost', size: 'sm', action: 'quick-continue', title: '复制「继续写下一章」的会话指令（不占对话）' }, '🪶 继续写'),
		Btn({ variant: 'ghost', size: 'sm', action: 'quick-audit', title: '复制定稿审计命令（fiction-suite Python 脚本）' }, '🧪 定稿审计'),
	);

	// ── 双轨状态卡（FUSION 1.7：布局 / 版本策略 / git 仓库）──
	// 数据随详情回包（GET /projects/:id 的 fusion 字段）——不额外发请求、失败也不会
	// 让卡片变成错误块：面板打不开详情时本来就没有书可写，状态卡只是信息。
	const fs = s.detail?.fusion ?? null;
	const fusionBlock = Card({ tone: 'plain' },
		h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' } },
			h('span', { style: { fontWeight: weight.semibold, fontSize: font.small } }, '🔀 双轨与落盘'),
			fs ? h('span', { style: { ...hintStyle, fontSize: font.caption } }, `${(fs.chars ?? 0).toLocaleString()} 字`) : null,
		),
		!fs
			? h('div', { style: { ...hintStyle, fontSize: font.caption, marginTop: space.sm } },
				'布局与版本策略由插件配置决定（切换需重启 DSH web）。')
			: h('div', null,
				h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm } },
					Chip({ tone: fs.layout === 'fiction-suite' ? 'accent' : 'neutral' },
						fs.layout === 'fiction-suite' ? '布局 · fiction-suite' : '布局 · forge'),
					Chip({ tone: fs.versioning === 'git' ? 'accent' : 'neutral' },
						fs.versioning === 'git' ? '版本 · git 覆盖' : '版本 · vK 副本'),
					Chip({ tone: fs.hasGit ? 'ok' : 'warn' }, fs.hasGit ? '.git 已就绪' : '.git 缺失（覆盖写无历史）'),
					Chip({ tone: 'neutral' }, `已写 ${fs.chapterCount ?? 0} 章`),
					Chip({ tone: 'neutral' }, `下一章 ${fs.nextChapter ?? 1}`),
					fs.platformName ? Chip({ tone: 'neutral' }, fs.platformName) : null,
				),
				h('div', { style: { ...hintStyle, fontSize: font.caption, marginTop: space.xs, lineHeight: 1.7 } },
					fs.versioning === 'git'
						? 'git 模式：同一章正文只有一份文件（原地覆盖），历史交给书目录的 git——每章定稿/每次台账变更单独 commit；缺 .git 时写章回执会给警告。'
						: 'vK 模式：同章每写一次追加一个版本文件，旧版永不覆盖。'),
			),
	);

	// ── 全书体检（GET /continuity · 服务端纯函数，零 token）──
	const cont = s.continuity;
	const continuityBlock = Card({ tone: cont && cont.ok === false ? 'danger' : 'plain' },
		h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm } },
			h('span', { style: { fontWeight: weight.semibold, fontSize: font.small } }, '🩺 全书体检'),
			cont
				? Chip({ tone: cont.ok ? 'ok' : 'danger' },
					cont.ok ? '未发现硬伤' : `${cont.stats?.errors ?? 0} 处硬伤`)
				: null,
			h('span', { style: { flex: '1 1 auto' } }),
			Btn({
				size: 'sm', variant: cont ? 'ghost' : 'secondary', action: 'continuity',
				disabled: s.continuityLoading,
			}, s.continuityLoading ? '体检中…' : cont ? '↻ 重跑' : '开始体检'),
		),

		s.continuityLoading
			? h('div', { style: { ...hintStyle, marginTop: space.sm } }, '正在核对账本、伏笔、时间线与文件……')
			: !cont
				? h('div', { style: { ...hintStyle, fontSize: font.caption, marginTop: space.sm, lineHeight: 1.7 } },
					'查的是「死人复活 / 账本前后矛盾 / 伏笔超期未收 / 章号断档 / 人物卡缺失」这类机器判得出来的硬伤 —— 全部是纯本地计算，不花 token。')
				: h('div', { style: { marginTop: space.md } },
					h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: space.sm, marginBottom: cont.issues?.length ? space.sm : 0 } },
						StatTile({ value: cont.stats?.chapters ?? 0, label: '章节', tone: 'accent' }),
						StatTile({ value: cont.stats?.facts ?? 0, label: '台账' }),
						StatTile({ value: cont.stats?.foreshadows ?? 0, label: '伏笔' }),
						StatTile({ value: cont.stats?.deaths ?? 0, label: '死亡实体' }),
						StatTile({ value: cont.stats?.errors ?? 0, label: '硬伤', tone: (cont.stats?.errors ?? 0) > 0 ? 'danger' : 'ok' }),
						StatTile({ value: cont.stats?.warnings ?? 0, label: '警告', tone: (cont.stats?.warnings ?? 0) > 0 ? 'warn' : 'neutral' }),
					),
					cont.issues?.length > 0
						? h('div', null,
							...cont.issues.slice(0, 12).map((it, i) => issueRow(it, i, cont.issues.length)),
							// 截断的其余条目可展开：只给计数不给出口，等于让人干瞪眼
							cont.issues.length > 12
								? Fold({ title: `展开其余 ${cont.issues.length - 12} 条` },
									...cont.issues.slice(12).map((it, i) => issueRow(it, i + 12, cont.issues.length)))
								: null,
						)
						: h('div', { style: { ...okStyle, fontSize: font.small } },
							'账本、伏笔、时间线、文件都对得上。'),
				),

		s.continuityError
			? Feedback({ tone: 'err' }, s.continuityError)
			: null,
	);

	// ── 黄金三章诊断（GET /diagnose · 与 novel_diagnose 同一纯函数，零 token）──
	const diag = s.diagnosis;
	const diagnosisBlock = Card({ tone: 'plain' },
		h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm } },
			h('span', { style: { fontWeight: weight.semibold, fontSize: font.small } }, '📐 黄金三章诊断'),
			h('span', { style: { flex: '1 1 auto' } }),
			Btn({
				size: 'sm', variant: diag ? 'ghost' : 'secondary', action: 'diagnose',
				disabled: s.diagnosisLoading,
			}, s.diagnosisLoading ? '诊断中…' : diag ? '↻ 重跑' : '开始诊断'),
		),
		s.diagnosisLoading
			? h('div', { style: { ...hintStyle, marginTop: space.sm } }, '正在按词表给前三章打分……')
			: !diag
				? h('div', { style: { ...hintStyle, fontSize: font.caption, marginTop: space.sm, lineHeight: 1.7 } },
					'对前三章做确定性打分：钩子强度 / 开场质量 / 冲突密度 / 信息灌输度（0-100）。纯词表算法，零 token —— 与会话里调 novel_diagnose 是同一个函数。')
				: h('div', { style: { marginTop: space.md } },
					h('div', { style: { ...okStyle, fontSize: font.small, marginBottom: space.sm } }, diag.overall),
					h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: `${space.xs}px ${space.lg}px`, marginBottom: space.sm } },
						...(diag.perChapter ?? []).map((c) => h('div', {
							key: c.chapter,
							style: { fontSize: font.caption, color: color.text3, lineHeight: 1.9 },
						}, `第 ${c.chapter} 章《${c.title}》`,
						h('div', { style: { fontFamily: color.mono, fontSize: font.caption } },
							`钩子 ${c.hook} · 开场 ${c.opening} · 冲突 ${c.conflict} · 灌输 ${c.infodump}`)))),
					(diag.issues ?? []).length > 0
						? h('div', { style: { display: 'flex', flexDirection: 'column', gap: `${space.xs}px` } },
							...(diag.issues ?? []).slice(0, 8).map((it, i) => h('div', {
								key: i, style: { ...hintStyle, fontSize: font.caption },
							}, `· ${it}`)))
						: null,
				),
		s.diagnosisError
			? Feedback({ tone: 'err' }, s.diagnosisError)
			: null,
	);

	// ── 提案队列（用户主权动作：工具面刻意没有 apply）──
	const proposalsBlock = Card({ tone: pendingCount > 0 ? 'warn' : 'plain' },
		h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm } },
			h('span', { style: { fontWeight: weight.semibold, fontSize: font.small } }, '📝 待批准提案'),
			pendingCount > 0 ? Chip({ tone: 'warn' }, String(pendingCount)) : null,
h('span', { style: { flex: '1 1 auto' } }),
			// 常驻刷新：队列只在开书/应用动作时加载——写作会话新建提案后，挂着面板的
			// 用户需要明示入口（焦点自动重拉是兜底）；加载中/动作中不显示避免歧义
			!s.proposalsLoading && !s.proposalBusy
				? Btn({ variant: 'secondary', size: 'sm', action: 'reload-proposals', title: '重拉提案队列' }, '刷新')
				: null,
			s.proposalBusy ? h('span', { style: { ...hintStyle, fontSize: font.caption } }, '处理中…') : null,
		),
		s.proposalsLoading
			? h('div', { style: { ...hintStyle, fontSize: font.caption, marginTop: space.sm } }, '加载中…')
			: s.proposalsError
				? h('div', { style: { display: 'flex', flexDirection: 'column', gap: space.xs, marginTop: space.sm } },
					h('div', { style: { ...hintStyle, fontSize: font.caption, color: color.danger, lineHeight: 1.7 } },
						`⚠️ 提案队列加载失败：${s.proposalsError}——这**不是**「没有待批」，点重试再拉一次。`),
					Btn({ variant: 'secondary', action: 'reload-proposals' }, '重试'))
				: pendingProposals.length === 0
				? h('div', { style: { ...hintStyle, fontSize: font.caption, marginTop: space.sm, lineHeight: 1.7 } },
					'没有待批的修订。模型改稿（含面板上的润色/校对）都先落到这里，由你点「应用」才生成新版本。')
				: h('div', { style: stackStyle(space.xs) },
					...pendingProposals.map((p) => {
						const busy = s.proposalBusy === p.id;
						const open = s.proposalDetail?.id === p.id;
						const stale = p.status === 'superseded';
						const when = p.createdAt ? String(p.createdAt).slice(5, 16).replace('T', ' ') : '';
						// 「是什么」一句话：模型附的 reason 最能说明白改了什么；
						// 没写 reason 就给正文摘要；文件丢了要明说（建议丢弃）。
						const what = p.missing
							? '⚠️ 提案文件缺失（索引还在、文件被删）——建议直接丢弃'
							: stale
								? '⏳ 已陈旧：它基于的正文版本已被后来的写章/润色顶掉了，应用会把正文改回旧版——丢弃后请让模型基于最新版重提'
								: (p.reason || p.preview || '（模型未附说明——点「查看」读全文再决定）');
						const detail = s.proposalDetail;
						return h('div', {
							key: p.id,
							style: {
								display: 'flex', flexDirection: 'column', gap: space.xs,
								padding: `${space.sm}px ${space.md}px`,
								borderRadius: '8px', background: color.surface2,
							},
						},
							// 行 1：哪一章 + 章标题 + 何时提的 + 三个动作
							h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' } },
								h('span', { style: { flex: '1 1 auto', minWidth: 0, fontSize: font.small, fontWeight: weight.semibold } },
									`第 ${p.chapter} 章${p.title ? ' · ' + p.title : ''}`,
									h('span', { style: { ...hintStyle, fontSize: font.caption, marginLeft: space.sm, fontWeight: weight.normal } },
										`${p.id}${when ? ' · ' + when : ''}`)),
								Btn({ size: 'sm', action: 'proposal-view', id: p.id }, open ? '收起' : '👁 查看'),
								// 陈旧提案没有「应用」：点了只会再撞一次陈旧守卫（且把索引又写一遍）
								stale
									? Chip({ tone: 'warn' }, '已陈旧')
									: Btn({ size: 'sm', variant: 'primary', action: 'proposal-apply', id: p.id, disabled: busy },
										busy ? '…' : '应用'),
								Btn({ size: 'sm', variant: 'danger', action: 'proposal-discard', id: p.id, disabled: busy }, '丢弃'),
							),
							// 行 2：提案要干嘛（一句话说明 / 摘要）
							h('div', { style: { ...hintStyle, fontSize: font.caption, lineHeight: 1.7 } }, what),
							// 行 3：展开的全文（应用前可通读修订稿）
							open && (detail.loading
								? h('div', { style: { ...hintStyle, fontSize: font.caption } }, '加载全文中…')
								: detail.error
									? h('div', { style: { ...errStyle, fontSize: font.caption } }, detail.error)
									: h('div', {
										style: {
											maxHeight: '260px', overflowY: 'auto', whiteSpace: 'pre-wrap',
											fontSize: font.caption, lineHeight: 1.8, color: color.text2,
											padding: space.sm, borderRadius: '6px', background: color.surface1,
										},
									}, detail.data?.content ?? '（提案内容为空）')),
						);
					}),
				),
	);

	// ── 本章编辑 ──
	const chapterOptions = Array.from({ length: Math.max(1, (s.detail?.chapters ? Object.keys(s.detail.chapters).length : 0) + 1) }, (_, i) => i + 1);
	const editBlock = Card({ tone: 'plain' },
		// 头部：章节切换 + 写章 + 保存（原「✍️ 本章」常驻条并入，随稿纸一起放在待批准提案下方）
		h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' } },
			h('span', { style: { fontWeight: weight.semibold, fontSize: font.small } }, '✍️ 本章'),
			h('select', {
				'data-field': 'chapterNo', value: String(s.chapterNo),
				'aria-label': '切换到第几章',
				style: { ...inputStyle, width: 'auto', padding: '3px 6px' },
			}, chapterOptions.map((no) => h('option', { key: no, value: String(no) }, `第 ${no} 章`))),
			Btn({ size: 'sm', variant: 'ghost', action: 'write', disabled: s.batchBusy },
				s.batchBusy ? '写作中…' : '🪶 写章'),
			h('span', { style: { flex: '1 1 auto' } }),
			Btn({ size: 'sm', variant: 'primary', action: 'save' }, '💾 保存'),
		),
		h('div', { style: { ...hintStyle, fontSize: font.caption, marginTop: space.xs, lineHeight: 1.6 } },
			s.chapterNo > maxWritten ? '这一章还没落盘 —— 点「写章」直接过门禁链落盘' : '写章 = 生成新版本（旧稿保留）；润色 / 校对产物是提案'),

		// 保存被门禁拦下：原文必须摆出来（判定逐条可执行），并给一次显式放行。
		// 面板保存与 novel_write_chapter 共用同一套判定，这里不是新规则，是那条规则的可见面。
		s.saveBlocked ? h('div', { style: { marginTop: space.sm } },
			Feedback({ tone: 'err' }, s.saveBlocked),
			h('div', { style: { ...rowWrapStyle(space.xs), marginTop: space.xs } },
				Btn({ size: 'sm', variant: 'secondary', action: 'save-force' }, '仍要保存（跳过内容门禁·记审计）'),
				h('span', { style: { ...hintStyle, fontSize: font.caption } },
					'字数不足、账本冲突这类硬判定，「仍要保存」也顶不开'),
			),
		) : null,

		// 润色 / 校对走真端点，产物是提案（点「应用」才生效）
		h('div', { style: { ...rowWrapStyle(space.xs), marginTop: space.md } },
			Btn({ size: 'sm', variant: 'accent', action: 'polish', disabled: revising !== null || s.chapterNo > maxWritten },
				revising === 'polish' ? '润色中…' : '✨ 润色'),
			Btn({ size: 'sm', variant: 'secondary', action: 'proofread', disabled: revising !== null || s.chapterNo > maxWritten },
				revising === 'proofread' ? '校对中…' : '🔍 校对'),
			h('span', { style: { ...hintStyle, fontSize: font.caption } },
				'产物是提案（在「待批准提案」里点「应用」才生成新版本）'),
		),

		s.error ? Feedback({ tone: 'err' }, s.error) : null,
		s.notice ? Feedback({ tone: 'ok' }, s.notice) : null,

		// 应用提案后的门禁提示：服务端已把这版正文过了一遍内容门禁（lib/proposals.js），
		// 应用是用户主权（不拦），但「改出了死人复活 / 隐藏人物泄底」必须当场看见。
		s.gateNotice ? h('div', {
			role: 'alert',
			style: { ...stackStyle(space.xs), marginTop: space.sm, gap: space.xs },
		},
			h('div', { style: warnStyle },
				`⚠ 刚应用的第 ${s.gateNotice.chapter} 章 v${s.gateNotice.version} 有门禁提示：`),
			...(s.gateNotice.blocking ?? []).map((m, i) =>
				h('div', { key: `gb${i}`, style: errStyle }, `✗ ${m}`)),
			...(s.gateNotice.warnings ?? []).map((m, i) =>
				h('div', { key: `gw${i}`, style: warnStyle }, `· ${m}`)),
		) : null,

		// 未保存离开确认：返回 / 换章前有改动时，先问一句
		s.discardPending
			? h('div', {
				style: {
					display: 'flex', alignItems: 'center', gap: space.sm,
					marginTop: space.md, padding: `${space.sm}px ${space.md}px`,
					borderRadius: '8px', background: tint(color.warn, 12),
					border: `1px solid ${tint(color.warn, 30)}`,
				},
			},
				h('span', { style: { flex: '1 1 auto', fontSize: font.small, color: color.warn } }, '本章有未保存的改动'),
				Btn({ size: 'sm', variant: 'danger', action: 'discard-confirm' }, '丢弃改动'),
				Btn({ size: 'sm', action: 'discard-cancel' }, '取消'),
			)
			: null,

		// 稿纸区（key 带版本号，刷新章节时强制重建以吸收新的 defaultValue）
		h('textarea', {
			'data-field': 'draft', key: `draft-${s.draftVersion}`,
			defaultValue: s.draft, placeholder: '本章正文…',
			'aria-label': '本章正文', rows: 9,
			style: { ...manuscriptStyle, marginTop: space.md, display: 'block' },
		}),

		h('div', { style: { display: 'flex', alignItems: 'center', gap: space.xs, marginTop: space.sm, flexWrap: 'wrap' } },
			Btn({ size: 'sm', variant: 'ghost', action: 'refresh' }, '↻ 刷新'),
			Btn({ size: 'sm', variant: 'ghost', action: 'export', disabled: s.exporting },
				s.exporting ? '导出中…' : '⇩ 导出'),
			Btn({ size: 'sm', variant: 'ghost', action: 'goto-lorebook', id: s.selected }, '📖 世界书'),
			h('span', { style: { flex: '1 1 auto' } }),
			s.deleteState === 'confirm'
				? Btn({ size: 'sm', action: 'delete-cancel' }, '取消删除')
				: null,
			// 'busy'（请求在途）也必须有自己的样子：只判 'confirm' 会让按钮在 await
			// 窗口里退回「删除」，看着像确认被吞掉。控制器已忽略重复点击，这里补视觉。
			Btn({ size: 'sm', variant: 'danger', action: 'delete', disabled: s.deleteState === 'busy' },
				s.deleteState === 'busy' ? '删除中…' : s.deleteState === 'confirm' ? '确认删除这本书？' : '删除'),
		),

		// 能力边界（0.13.2 起如实呈现）：写章/诊断/体检面板直做；导入与全量审计仍在会话
		h('div', { style: { ...hintStyle, fontSize: font.caption, marginTop: space.md, lineHeight: 1.7 } },
			'写章（走门禁链落盘）、黄金三章诊断、全书体检都已在面板直做。仍需会话的：',
			h('code', {
				style: {
					fontFamily: color.mono,
					background: color.surface2, borderRadius: '4px', padding: '0 4px',
				},
			}, 'novel_import'),
			'（导书）、带一致性/平台审稿/敏感自查参数的 ',
			h('code', {
				style: {
					fontFamily: color.mono,
					background: color.surface2, borderRadius: '4px', padding: '0 4px',
				},
			}, 'novel_audit'),
			'（结果进审计流，面板的机审子集已在「全书体检」覆盖）。'),
	);

	// ── 批量起草（D2：并发生成、串行提交，每章仍过同一套门禁）──
	const batch = s.batchResult;
	const batchBlock = Fold({
		title: `⚡ 批量起草（从第 ${s.batchFrom ?? nextNo} 章起 ${s.batchCount ?? 3} 章）`,
	},
		h('div', { style: { ...hintStyle, fontSize: font.caption, lineHeight: 1.7, marginBottom: space.md } },
			'并发生成、串行提交：每一章照样过机审、内容门禁、账本、契约指标，',
			'单章被拦下不影响其它章。没有细纲或细纲未批准的章会直接被挡（可勾选强制）。'),
		h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' } },
			// label 包住控件：点文字即聚焦输入框，读屏也能念出字段名
			h('label', { style: { display: 'flex', alignItems: 'center', gap: space.xs, fontSize: font.small, color: color.text3 } },
				'起始章',
				h('input', {
					'data-field': 'batch-from', type: 'number', min: 1,
					value: String(s.batchFrom ?? nextNo),
					style: { ...inputStyle, width: '64px' },
				})),
			h('label', { style: { display: 'flex', alignItems: 'center', gap: space.xs, fontSize: font.small, color: color.text3 } },
				'数量',
				h('input', {
					'data-field': 'batch-count', type: 'number', min: 1, max: 20,
					value: String(s.batchCount ?? 3),
					style: { ...inputStyle, width: '64px' },
				})),
			h('label', { style: { display: 'flex', alignItems: 'center', gap: space.xs, fontSize: font.small, color: color.text3 } },
				'并发',
				h('select', {
					'data-field': 'batch-concurrency', value: String(s.batchConcurrency ?? 1),
					style: { ...inputStyle, width: 'auto', padding: '3px 6px' },
				}, [1, 2, 3, 4].map((n) => h('option', { key: n, value: String(n) }, String(n))))),
		),
		h('label', { style: { display: 'flex', alignItems: 'center', gap: space.xs, fontSize: font.caption, color: color.text3, marginTop: space.sm } },
			h('input', {
				'data-field': 'batch-force', type: 'checkbox',
				defaultChecked: s.batchForce === true,
			}),
			'强制：跳过「细纲未批准 / 熔断计数」两道（内容门禁不跳）'),
		h('div', { style: { marginTop: space.md, display: 'flex', gap: space.sm, flexWrap: 'wrap', alignItems: 'center' } },
			Btn({ variant: 'primary', action: 'draft-batch', disabled: s.batchBusy },
				s.batchBusy ? '起草中…（可能几分钟）' : '开始批量起草'),
			(() => {
				const ck = s.detail?.batchCheckpoint;
				if (!ck || ck.status === 'done' || s.batchBusy) return null;
				return Btn({ variant: 'ghost', action: 'draft-batch-resume' },
					`继续上次批量（第${ck.from}–${Number(ck.from) + Number(ck.count) - 1} 章，已落 ${Array.isArray(ck.completed) ? ck.completed.length : 0}）`);
			})(),
		),

		batch
			? h('div', { style: { marginTop: space.lg } },
				h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: space.sm, marginBottom: space.sm } },
					StatTile({ value: batch.stats?.committed ?? 0, label: '落盘', tone: 'ok' }),
					StatTile({ value: batch.stats?.failed ?? 0, label: '被拦', tone: (batch.stats?.failed ?? 0) > 0 ? 'danger' : 'neutral' }),
					StatTile({ value: batch.concurrency ?? 1, label: '并发' }),
				),
				...(batch.warnings ?? []).map((w, i) => h('div', { key: i, style: { ...hintStyle, fontSize: font.caption } }, `· ${w}`)),
				h('div', { style: { marginTop: space.sm } }, ...(batch.results ?? []).map(batchRow)),
			)
			: null,
	);

	// ── 每章字数（用户 2026-10-20 要求面板能设）──
	// 显示的是服务端算好的 charView（生效区间 + 出处）：优先级「本书自定义 > 平台口径 >
	// 插件默认」只有一份实现在 lib/store.js，面板不重算——两处算出不同数字就是本轮的病。
	const charView = s.detail?.charView ?? null;
	const customChars = charView?.charLimits ?? '';
	const charsBusy = s.charsSaving === true;
	const charLimitsBlock = Card({ tone: s.charsError ? 'danger' : 'plain' },
		h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' } },
			h('span', { style: { fontWeight: weight.semibold, fontSize: font.small } }, '✒️ 每章字数'),
			charView
				? Chip({ tone: charView.charSource === 'custom' ? 'ok' : 'accent' },
					`${charView.charMin}–${charView.charMax} 字`)
				: null,
			charView
				? h('span', { style: { ...hintStyle, fontSize: font.caption } },
					`出处：${charView.charSource === 'custom' ? '本书自定义'
						: charView.charSource === 'platform' ? '投放平台口径' : '插件默认'}`)
				: null,
		),
		h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm, marginTop: space.sm } },
			h('input', {
				// key 带当前值与书名：换书/保存成功后重挂，输入框照实回显盘上的值
				key: `chars-${s.selected ?? ''}-${customChars}`,
				'data-field': 'chars-value', defaultValue: customChars,
				placeholder: '如 2500-3500；留空＝跟随平台/默认',
				'aria-label': '本书每章字数区间',
				style: { ...inputStyle, flex: '1 1 auto', maxWidth: '220px' },
			}),
			Btn({ variant: 'primary', size: 'sm', action: 'save-chars', disabled: charsBusy }, charsBusy ? '保存中…' : '保存'),
			customChars !== ''
				? Btn({ variant: 'ghost', size: 'sm', action: 'clear-chars', disabled: charsBusy }, '清除自定义')
				: null,
		),
		h('div', { style: { ...hintStyle, fontSize: font.caption, marginTop: space.xs } },
			'设了它，写章门禁、写前简报、细纲容量、提案与润色的上下限、novel_audit 全按这个区间判——只改一处，六条链一起变。'),
		s.charsError ? h('div', { style: { ...errStyle, fontSize: font.small, marginTop: space.xs } }, s.charsError) : null,
	);

	// ── 标签页内容（FUSION 1.7：从「一屏全堆」改成 5 段，找东西不用滚到底）──
	// 注意别在这里套 Section 标题：卡片自己已经带标题了，套一层会得到
	// 「✍️ 本章 / ✍️ 本章编辑」这种双标题。
	const tab = s.detailTab ?? 'info';
	const infoView = h('div', { style: stackStyle(space.lg) },
		dashboardBlock,
		ProjectOverviewView({ state: s }),
		fusionBlock,
		charLimitsBlock,
	);
	const healthView = h('div', { style: stackStyle(space.lg) },
		continuityBlock,
		diagnosisBlock,
	);
	const proposalsView = h('div', { style: stackStyle(space.lg) },
		proposalsBlock,
	);
	const editView = h('div', { style: stackStyle(space.lg) },
		editBlock,
		batchBlock,
	);
	const bodyByTab = {
		info: infoView,
		health: healthView,
		proposals: proposalsView,
		edit: editView,
	};

	return h('div', { style: stackStyle(space.lg) },
		crumb,
		SessionFatigueBanner({ session: s.detail?.session, copied: s.copiedHandoff === true, rotatePending: s.rotatePending === true }),
		Segmented({ tab }),
		tab === 'chapters' ? ChapterListView({ state: s }) : (bodyByTab[tab] ?? infoView),
		// 宽屏阅读/编辑浮层：position:fixed，挂在面板根里也能覆盖整个宿主页面
		ReaderOverlay({ state: s }),
	);
}

			return { "ProjectDetailView": ProjectDetailView };
		};

		// ── src/client/views/chapters.js ──
		__factories["src/client/views/chapters.js"] = function (__m, __exports) {
// src/client/views/chapters.js — 「章节听书」标签：目录 + 语音连播。
//
// 纯渲染：只读 state（chapterList / playback），交互全走 data-action，
// 由 panel.js 的原生点击代理接住。播放边界（连播到哪章为止）由
// hasChapter 依据 chapterList 决定 —— 目录就是播放清单。
//
// 版面：置顶一条播放条（正在读哪章、暂停/继续/停止），下面是目录。
// 目录行的信息优先级：**播放态 > 章号/标题 > 字数 > 播放钮**。
const { h } = __m("src/client/react.js");
const { color, space, font, weight, hintStyle, tint, stackStyle } = __m("src/client/styles.js");
const { Card, Btn, Chip, Empty, Stat, Feedback } = __m("src/client/ui.js");

function ChapterListView({ state: s }) {
	const pb = s.playback ?? { status: 'idle', currentNo: null };

	if (s.chapterListLoading) return h('div', { style: hintStyle }, '章节目录加载中…');

	if (!s.chapterList.length) {
		return Empty({
			icon: '🎧',
			title: '这本书还没有章节',
			hint: '在会话里让 AI 调 novel_write_chapter 开写，写完这里就会出现目录，可以朗读与连播。',
			action: [Btn({ size: 'sm', action: 'back' }, '← 返回基本信息')],
		});
	}

	const firstNo = s.chapterList[0].no;
	const playing = pb.status === 'playing';
	const paused = pb.status === 'paused';
	const startNo = pb.currentNo ?? firstNo;
	const totalChars = s.chapterList.reduce((sum, c) => sum + (c.chars ?? 0), 0);

	// ── 播放条 ──
	const controls = Card({ tone: playing || paused ? 'accent' : 'plain', pad: space.md },
		h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm } },
			!playing && !paused
				? Btn({ variant: 'primary', size: 'sm', action: 'play-from', id: startNo }, `▶ 从第 ${startNo} 章开始听`)
				: playing
					? Btn({ variant: 'primary', size: 'sm', action: 'playback-pause' }, '⏸ 暂停')
					: Btn({ variant: 'primary', size: 'sm', action: 'playback-resume' }, '▶ 继续'),
			Btn({ variant: 'ghost', size: 'sm', action: 'playback-stop', disabled: !playing && !paused }, '⏹ 停止'),
			h('span', { style: { flex: '1 1 auto' } }),
			Stat({ icon: '📄', value: s.chapterList.length, unit: '章' }),
			Stat({ icon: '·', value: totalChars.toLocaleString(), unit: '字' }),
		),
		h('div', {
			role: 'status', // 「正在读第几章」是异步变化，读屏要能听到
			style: { ...hintStyle, fontSize: font.caption, marginTop: space.sm } },
			playing || paused
				? `正在读：第 ${pb.currentNo} 章${paused ? '（已暂停）' : ''}`
				: '读完一章自动接下一章；章号有缺口会跳到下一个存在的章。'),
	);

	// ── 阅读卡（点行内 📖 展开）：正文可滚动，顺手能切朗读 ──
	// 位置在**对应章节行的正下方**（下面 rows 的 flatMap 里插入），不是固定在列表顶上——
	// 点哪章的 📖 就展开在哪章下面，长目录里不用回头找。可以一边听一边看：reader 与 playback 互不干扰。
	// 外面套 display:contents 的 keyed 容器：React 混排列表里给阅读卡一个稳定 key，且不引入额外布局层。
	const reader = s.reader ? h('div', { key: 'reader', style: { display: 'contents' } },
		Card({ tone: 'accent', pad: space.md },
		h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm } },
			h('span', {
				style: { flex: '1 1 auto', minWidth: 0, fontWeight: weight.semibold, fontSize: font.small },
			}, `📖 第 ${s.reader.no} 章 · ${s.reader.title}`),
			Btn({ variant: 'secondary', size: 'sm', action: 'reader-wide', id: s.reader.no, title: `宽屏阅读第 ${s.reader.no} 章`, ariaLabel: `宽屏阅读第 ${s.reader.no} 章` }, '⤢ 宽屏'),
			Btn({ variant: 'secondary', size: 'sm', action: 'play-from', id: s.reader.no, title: `从第 ${s.reader.no} 章开始听` }, '▶ 朗读本章'),
			Btn({ variant: 'ghost', size: 'sm', action: 'close-reader', title: '收起阅读器', ariaLabel: '收起阅读器' }, '✕'),
		),
		h('div', {
			style: {
				marginTop: space.sm,
				maxHeight: '420px', overflowY: 'auto',
				// 阅读卡是窄栏里的长文：字号按读稿调（12px 太小），行距放宽
				fontSize: font.lead, lineHeight: 1.95, letterSpacing: '.2px',
				whiteSpace: 'pre-wrap', color: color.text,
			},
		}, s.reader.loading ? '正文加载中…' : (s.reader.text || '（本章正文为空）')),
	)) : null;

	// ── 目录 ──
	const rows = s.chapterList.flatMap((c) => {
		const isCurrent = pb.currentNo === c.no && (playing || paused);
		const row = h('div', {
			key: c.no,
			style: {
				display: 'flex', alignItems: 'center', gap: space.sm,
				padding: `${space.sm}px ${space.md}px`,
				borderRadius: '8px',
				background: isCurrent ? tint(color.accent, 10) : color.surface1,
				border: `1px solid ${isCurrent ? tint(color.accent, 32) : color.border2}`,
				// 长书目（几百章）跳过视口外的行不渲染内容——窄栏里滑目录不再整页卡
				contentVisibility: 'auto', containIntrinsicSize: 'auto 44px',
			},
		},
			h('span', {
				style: {
					flex: 'none', width: '30px', fontFamily: color.mono,
					fontSize: font.caption, color: isCurrent ? color.accent : color.textDim,
					fontWeight: isCurrent ? weight.bold : weight.normal,
				},
			}, String(c.no)),
			h('span', {
				style: {
					flex: '1 1 auto', minWidth: 0, fontSize: font.small,
					fontWeight: isCurrent ? weight.semibold : weight.normal,
					overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
				},
			}, c.title || `第 ${c.no} 章`),
			isCurrent && playing ? Chip({ tone: 'accent' }, '♪ 播报中') : null,
			c.version > 1 ? Chip({}, `v${c.version}`) : null,
			h('span', { style: { ...hintStyle, fontSize: font.caption, whiteSpace: 'nowrap' } }, `${c.chars ?? 0} 字`),
			Btn({ variant: 'ghost', size: 'sm', action: 'read-chapter', id: c.no, title: `阅读第 ${c.no} 章`, ariaLabel: `阅读第 ${c.no} 章` }, '📖'),
			Btn({ variant: 'ghost', size: 'sm', action: 'reader-wide', id: c.no, title: `宽屏阅读第 ${c.no} 章`, ariaLabel: `宽屏阅读第 ${c.no} 章` }, '⤢'),
			Btn({ variant: 'ghost', size: 'sm', action: 'play-from', id: c.no, title: `从第 ${c.no} 章开始听`, ariaLabel: `从第 ${c.no} 章开始听` }, '▶'),
		);
		// 阅读卡插在命中的那一行后面（flatMap 展平，其余行保持原序）
		return s.reader?.no === c.no ? [row, reader] : [row];
	});

	return h('div', { style: stackStyle(space.md) },
		controls,
		s.error ? Feedback({ tone: 'err' }, s.error) : null,
		h('div', { style: stackStyle(space.xs) }, ...rows),
	);
}

			return { "ChapterListView": ChapterListView };
		};

		// ── src/client/views/overview.js ──
		__factories["src/client/views/overview.js"] = function (__m, __exports) {
// src/client/views/overview.js — 「基本信息」标签：把一本书的全部沉淀摊开看。
//
// 档案 → 大纲 → 角色卡 → 设定 → 时间线（账本）→ 伏笔。
// 数据来自 GET /projects/:id/elements 一次聚合；要素缺失是常态（书是 AI 在会话里
// 一点点写出来的），每个区块给**空态引导**而不是报错——空态文案本身就是使用说明。
//
// 版面取舍：这些内容天然是「长列表 + 大段文本」，所以一律用原生 <details> 折叠
// （点开才占视线、不吃 React 事件、不需要事件代理）。时间线改成**左侧竖轴**：
// 账本的价值在「按章推进」，平铺成一串灰字就看不出这件事了。
const { h } = __m("src/client/react.js");
const { color, space, font, weight, hintStyle, tint, stackStyle } = __m("src/client/styles.js");
const { Card, Chip, StatTile, Fold, Empty, Section, Mono, KV, Btn } = __m("src/client/ui.js");
const { genreLabel } = __m("src/client/genre.js");

const preStyle = {
	margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
	fontSize: font.small, lineHeight: 1.8,
};

/** 一条账本事实（竖轴右侧的一行）。 */
function factLine(f) {
	return h('div', {
		style: {
			display: 'flex', alignItems: 'baseline', gap: space.xs,
			fontSize: font.small, padding: '1px 0',
		},
	},
		h('span', { style: { color: color.text2, fontWeight: weight.medium } }, f.entity ?? '？'),
		h('span', { style: { color: color.textDim, fontSize: font.caption } }, f.key ?? '？'),
		h('span', { style: { color: color.textDim, fontSize: font.caption } }, '→'),
		h('span', { style: { flex: '1 1 auto', minWidth: 0, wordBreak: 'break-word' } }, f.value ?? '？'),
	);
}

function ProjectOverviewView({ state: s }) {
	const el = s.elements;
	if (s.elementsLoading) return h('div', { style: hintStyle }, '要素加载中…');
	if (!el) {
		return Empty({
			icon: '📂',
			title: '要素没读出来',
			hint: '可能这本书刚建、还没有任何沉淀文件。点上方「刷新」重试一次。',
		});
	}

	const meta = el.meta ?? {};
	const facts = Array.isArray(el.facts) ? el.facts : [];
	const foreshadows = Array.isArray(el.foreshadows) ? el.foreshadows : [];
	const chars = Array.isArray(el.characters) ? el.characters : [];
	const castNames = (meta.cast ?? []).map((c) => (typeof c === 'string' ? c : c?.name)).filter(Boolean);
	const outlineCount = el.outline?.chapterOutlines?.length ?? 0;
	const writtenMax = (s.chapterList ?? []).reduce((m, c) => Math.max(m, c.no ?? 0), 0);

	// ── 档案 ──
	// 日期用 Intl 管道（toLocaleDateString 即 ECMA-402），不手切字符串——
	// 时区/位数交给标准库；解析失败（老数据脏值）回退 '—'，不往界面上漏 "Invalid Date"。
	const fmtDate = (iso) => {
		if (!iso) return '—';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '—';
		return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
	};
	const profile = Card({ tone: 'plain' },
		h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' } },
			h('span', { style: { fontWeight: weight.semibold, fontSize: font.lead } }, meta.title || s.selected),
			meta.genre ? Chip({ tone: 'neutral' }, genreLabel(meta.genre)) : null,
			meta.stage ? Chip({ tone: 'accent' }, String(meta.stage)) : null,
		),
		h('div', { style: { ...stackStyle(space.xs), marginTop: space.md } },
			KV({ k: '创建' }, fmtDate(meta.createdAt)),
			KV({ k: '更新' }, fmtDate(meta.updatedAt)),
			KV({ k: '角色' }, castNames.length ? castNames.join('、') : '—'),
		),
		meta.logline
			? h('div', {
				style: {
					marginTop: space.md, padding: `${space.sm}px ${space.md}px`,
					borderLeft: `2px solid ${tint(color.accent, 55)}`, borderRadius: '0 6px 6px 0',
					background: tint(color.accent, 6),
					fontSize: font.small, color: color.text2, lineHeight: 1.7,
				},
			}, meta.logline)
			: null,
	);

	// ── 沉淀统计：一眼看清「这本书攒了什么」──
	const tiles = Card({ tone: 'inset', pad: space.md },
		h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: `${space.sm}px ${space.sm}px` } },
			StatTile({ icon: '🗺', value: el.outline?.full ? '有' : '无', label: '大纲', tone: el.outline?.full ? 'ok' : 'warn', size: 'sm' }),
			StatTile({ icon: '📑', value: outlineCount, label: '细纲', size: 'sm' }),
			StatTile({ icon: '👤', value: chars.length, label: '角色卡', size: 'sm' }),
			StatTile({ icon: '📖', value: el.worldbookCount ?? 0, label: '世界书', size: 'sm' }),
			StatTile({ icon: '🔤', value: el.glossaryCount ?? 0, label: '术语', size: 'sm' }),
			StatTile({ icon: '🧾', value: facts.length, label: '台账', size: 'sm' }),
			StatTile({ icon: '🪡', value: foreshadows.length, label: '伏笔', size: 'sm' }),
		),
	);

	// ── 大纲 ──
	const outlineBlock = el.outline?.full
		? Fold({ title: '📖 全书大纲', open: false },
			h('div', { style: preStyle }, el.outline.full))
		: Empty({ icon: '🗺', title: '还没有全书大纲', hint: '在会话里让 AI 调 novel_outline 生成，生成后这里会显示全文。' });

	// ── 角色卡 ──
	const castBlock = chars.length > 0
		? h('div', { style: stackStyle(space.xs) },
			...chars.map((c) => Fold({ title: `👤 ${c.name}` }, h('div', { style: preStyle }, c.text || '（空卡）'))))
		: Empty({
			icon: '👥', title: '还没有角色卡',
			hint: '在会话里让 AI 调 novel_cast 生成。'
				+ (castNames.length ? `已登记但无卡的角色：${castNames.join('、')}` : ''),
		});

	// ── 设定 ──
	// 顶部「沉淀统计」已含世界书/术语的计数，这里不再重复数字，改做**入口**：
	// 有沉淀就给一句状态 + 跳世界书的常驻按钮，无沉淀就给空态引导——避免中段显空、节奏匀称。
	const settingHas = (el.worldbookCount ?? 0) + (el.glossaryCount ?? 0) > 0;
	const settingBlock = settingHas
		? Card({ tone: 'inset', pad: space.md },
			h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' } },
				h('span', { style: { ...hintStyle, fontSize: font.small, flex: '1 1 240px', minWidth: 0 } },
					`已沉淀 ${el.worldbookCount ?? 0} 条世界书 · ${el.glossaryCount ?? 0} 条术语。设定越细，写章越不容易崩人物与地名。`),
				Btn({ variant: 'ghost', size: 'sm', action: 'goto-lorebook', id: s.selected }, '📖 去世界书'),
			))
		: Empty({ icon: '🧭', title: '设定还是空的', hint: '在会话里让 AI 调 novel_world 沉淀世界观；也可以在「世界书」里手动加。' });

	// ── 时间线（账本事实按章分组，竖轴样式）──
	const byChapter = new Map();
	for (const f of facts) {
		const no = f.chapter ?? 0;
		if (!byChapter.has(no)) byChapter.set(no, []);
		byChapter.get(no).push(f);
	}
	const chaptersSorted = [...byChapter.keys()].sort((a, b) => a - b);
	const timelineBlock = chaptersSorted.length > 0
		? Fold({ title: `🕰 事实时间线（${facts.length} 条 / ${chaptersSorted.length} 章）`, open: facts.length <= 24 },
			h('div', { style: stackStyle(0) },
				...chaptersSorted.map((no, gi) => h('div', {
					key: no,
					style: {
						display: 'flex', gap: space.md, minWidth: 0,
						// 时间线一开可能上百章的账；视口外的分组不渲染内容
						contentVisibility: 'auto', containIntrinsicSize: 'auto 96px',
					},
				},
					// 左：竖轴（圆点 + 连线；最后一节不画线）
					h('div', {
						style: {
							flex: 'none', width: '10px', display: 'flex', flexDirection: 'column',
							alignItems: 'center', paddingTop: '5px',
						},
					},
						h('span', {
							style: {
								width: '6px', height: '6px', borderRadius: '50%',
								background: no === 0 ? color.textDim : color.accent, flex: 'none',
							},
						}),
						gi < chaptersSorted.length - 1
							? h('span', { style: { flex: '1 1 auto', width: '1px', background: color.border2, minHeight: '8px' } })
							: null,
					),
					// 右：章标签 + 该章全部事实
					h('div', { style: { flex: '1 1 auto', minWidth: 0, paddingBottom: space.md } },
						h('div', { style: { fontSize: font.caption, color: color.text3, marginBottom: '2px' } },
							no > 0 ? `第 ${no} 章` : '未定章'),
						...(byChapter.get(no) ?? []).map((f, i) => h('div', { key: i }, factLine(f))),
					),
				)),
			))
		: Empty({
			icon: '⏳', title: '账本还是空的',
			hint: '开始写章后，novel_write_chapter 会自动把状态变化记进时间线（谁在哪章变成了什么）。',
		});

	// ── 伏笔 ──
	const foreshadowBlock = foreshadows.length > 0
		? Fold({ title: `🪡 伏笔（${foreshadows.length} 个）` },
			h('div', { style: stackStyle(space.sm) },
				...foreshadows.map((f, i) => {
					const paid = Number.isInteger(f.payoffChapter);
					const overdue = !paid && Number.isInteger(f.plan) && writtenMax > f.plan;
					return h('div', {
						key: i,
						style: {
							display: 'flex', flexDirection: 'column', gap: '2px',
							paddingBottom: space.sm,
							borderBottom: i < foreshadows.length - 1 ? `1px solid ${color.border1}` : 'none',
						},
					},
						h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' } },
							Mono({}, f.id ?? '？'),
							Chip({ tone: paid ? 'ok' : overdue ? 'warn' : 'neutral' },
								paid ? `已回收·第 ${f.payoffChapter} 章`
									: overdue ? `超期·计划第 ${f.plan} 章` : `未回收·计划第 ${f.plan ?? '？'} 章`),
							h('span', { style: { ...hintStyle, fontSize: font.caption } }, `第 ${f.chapter ?? '？'} 章埋`),
						),
						f.setup ? h('div', { style: { ...preStyle, fontSize: font.caption, color: color.text2 } }, f.setup) : null,
					);
				}),
			))
		: null;

	return h('div', { style: stackStyle(space.xl) },
		Section({ icon: '📚', title: '档案' }, profile, tiles),
		Section({ icon: '🗺', title: '大纲' }, outlineBlock),
		Section({ icon: '👥', title: '角色卡' }, castBlock),
		Section({ icon: '🧭', title: '设定' }, settingBlock),
		Section({ icon: '⏳', title: '时间线 · 账本' }, timelineBlock),
		foreshadowBlock ? Section({ icon: '🪡', title: '伏笔' }, foreshadowBlock) : null,
	);
}

			return { "ProjectOverviewView": ProjectOverviewView };
		};

		// ── src/client/views/reader-overlay.js ──
		__factories["src/client/views/reader-overlay.js"] = function (__m, __exports) {
// src/client/views/reader-overlay.js — 宽屏阅读/编辑浮层（FUSION 1.7）。
//
// 为什么需要它：右侧栏只有 ~360px，中文长章在窄栏里读是酷刑、改是折磨。
// 浮层用宿主页面宽度（panel width min(920px, 94vw)），正文 760px 限宽——
// 每行 30–40 字，是中文长文阅读的舒适区。
//
// 读与写是同一份数据：读态要「编辑」才切到 textarea；保存走既有
// POST /projects/:id/chapters/:no（与面板编辑器同一条 API、同一套门禁）。
// 浮层不取代面板编辑器，只是把「读/改」这一件事放到宽屏里做。
const { h } = __m("src/client/react.js");
const { color, space, font, weight, hintStyle, errStyle, manuscriptStyle, readingParaStyle, overlayBackdropStyle, overlayPanelStyle, overlayHeaderStyle, overlayBodyStyle, overlayBodyInnerStyle } = __m("src/client/styles.js");
const { Btn, Chip, Feedback } = __m("src/client/ui.js");

/** 正文按空行切段（保留段内换行），空段丢弃。 */
function splitParagraphs(text) {
	return String(text ?? '')
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter((p) => p !== '');
}

function ReaderOverlay({ state: s }) {
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

			return { "ReaderOverlay": ReaderOverlay };
		};

		// ── src/client/views/lorebook.js ──
		__factories["src/client/views/lorebook.js"] = function (__m, __exports) {
// src/client/views/lorebook.js — 世界书（设定注入）管理。
//
// 条目字段与 node 半侧 lib/worldbook-io.js 对齐：
// always_active（常驻注入）/ priority（优先级）/ keywords（触发关键词）/ enabled（启用）。
//
// 这一页的读者关心的是「**什么会被注入进上下文**」，所以每条都把它会在
// 正文里被什么词触发、优先级多高、当前开没开，明明白白摆在卡面上。
const { h } = __m("src/client/react.js");
// id 比较走单一入口（字符串化）——'W1' 绝不能 Number 强转
const { sameEntryId } = __m("lib/store.js");
const { color, space, font, weight, hintStyle, inputStyle, stackStyle, card } = __m("src/client/styles.js");
const { Card, Btn, Chip, Empty, Mono, Feedback } = __m("src/client/ui.js");

function LorebookView({ state: s }) {
	const editing = s.loreForm.mode !== 'none';
	const on = s.loreEntries.filter((e) => e.enabled).length;

	return h('div', { style: stackStyle(space.lg) },

		h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm } },
			Btn({ variant: 'ghost', size: 'sm', action: 'back-from-lore' }, '← 返回'),
			h('span', { style: { fontWeight: weight.semibold, fontSize: font.lead } }, '世界书'),
			h('span', { style: { ...hintStyle, fontSize: font.caption } }, `${on}/${s.loreEntries.length} 条启用`),
			h('span', { style: { flex: '1 1 auto' } }),
			Btn({ size: 'sm', variant: 'primary', action: 'lore-new' }, '＋ 新建'),
		),

		s.error ? Feedback({ tone: 'err' }, s.error) : null,
		s.notice ? Feedback({ tone: 'ok' }, s.notice) : null,

		// 新建 / 编辑表单
		editing
			? Card({ tone: 'accent', pad: space.md },
				h('div', { style: { fontWeight: weight.semibold, fontSize: font.small, marginBottom: space.sm } },
					s.loreForm.mode === 'new' ? '新建条目' : '编辑条目'),
				h('div', { style: stackStyle(space.sm) },
					h('input', { 'data-field': 'lore-name', defaultValue: s.loreForm.name, placeholder: '条目名称（如：城西乱葬岗）', 'aria-label': '条目名称', style: inputStyle }),
					h('input', { 'data-field': 'lore-keywords', defaultValue: s.loreForm.keywords, placeholder: '触发关键词，逗号分隔（如：乱葬岗,红泥）', 'aria-label': '触发关键词', style: inputStyle }),
					h('textarea', {
						'data-field': 'lore-content', defaultValue: s.loreForm.content,
						placeholder: '注入内容：这段设定会原样进上下文，写清事实而不是氛围词。',
						'aria-label': '注入内容', rows: 4,
						style: { ...inputStyle, lineHeight: 1.8, resize: 'vertical' },
					}),
					h('div', { style: { display: 'flex', alignItems: 'center', gap: space.lg, flexWrap: 'wrap' } },
						h('label', { style: { display: 'flex', alignItems: 'center', gap: space.xs, fontSize: font.small, color: color.text2 } },
							h('input', { 'data-field': 'lore-always', type: 'checkbox', defaultChecked: s.loreForm.alwaysActive }),
							'常驻注入'),
						h('label', { style: { display: 'flex', alignItems: 'center', gap: space.xs, fontSize: font.small, color: color.text2 } },
							'优先级',
							h('input', {
								'data-field': 'lore-priority', type: 'number',
								defaultValue: s.loreForm.priority,
								style: { ...inputStyle, width: '64px' },
							})),
					),
					h('div', { style: { display: 'flex', gap: space.sm } },
						Btn({ variant: 'primary', action: 'lore-save', disabled: s.loreBusy }, s.loreBusy ? '保存中…' : '保存'),
						Btn({ action: 'lore-cancel' }, '取消'),
					),
				),
			)
			: null,

		// 条目列表
		s.loreEntries.length === 0
			? Empty({
				icon: '📖',
				title: '还没有世界书条目',
				hint: '世界书是「按关键词自动注入」的设定库：写到的词一出现，对应设定就会进上下文，不必每次重复交代。',
			})
			: h('div', { style: stackStyle(space.sm) },
				...s.loreEntries.map((entry) => h('div', {
					key: entry.id,
					style: { ...card({ pad: space.md }), opacity: entry.enabled ? 1 : 0.62 },
				},
					h('div', { style: { display: 'flex', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' } },
						h('span', {
							style: {
								fontWeight: weight.semibold, fontSize: font.small,
								overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
							},
						}, entry.name),
						entry.always_active ? Chip({ tone: 'accent' }, '常驻') : null,
						!entry.enabled ? Chip({ tone: 'danger' }, '已停用') : null,
						h('span', { style: { flex: '1 1 auto' } }),
						Mono({}, `P${entry.priority}`),
					),
					entry.keywords?.length
						? h('div', { style: { display: 'flex', gap: space.xs, flexWrap: 'wrap', marginTop: space.sm } },
							...entry.keywords.map((k, i) => Chip({ key: i }, k)))
						: h('div', { style: { ...hintStyle, fontSize: font.caption, marginTop: space.xs } },
							entry.always_active ? '无关键词 —— 靠「常驻」注入' : '无关键词 —— 不会被触发，等于没注入'),
					entry.content
						? h('div', {
							style: {
								...hintStyle, fontSize: font.caption, marginTop: space.sm, lineHeight: 1.7,
								display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
							},
						}, entry.content)
						: null,
					h('div', { style: { display: 'flex', gap: space.xs, marginTop: space.sm, flexWrap: 'wrap', alignItems: 'center' } },
						Btn({ size: 'sm', variant: 'ghost', action: 'lore-edit', id: entry.id }, '编辑'),
						Btn({ size: 'sm', variant: 'ghost', action: 'lore-toggle', id: entry.id },
							entry.enabled ? '停用' : '启用'),
						h('span', { style: { flex: '1 1 auto' } }),
						// 删除两步确认：第一次点只点亮确认行（控制器 lore-delete 分支），
						// 误触可取消——条目一删关键词/优先级/内容全没了，不能一键即走。
						sameEntryId(s.loreDeleteId, entry.id)
							? h('span', { style: { display: 'flex', alignItems: 'center', gap: space.xs } },
								Btn({ size: 'sm', action: 'lore-delete-cancel' }, '取消删除'),
								Btn({ size: 'sm', variant: 'danger', action: 'lore-delete', id: entry.id, disabled: s.loreBusy },
									s.loreBusy ? '删除中…' : '确认删除这条设定？'))
							: Btn({ size: 'sm', variant: 'danger', action: 'lore-delete', id: entry.id }, '删除'),
					),
				)),
			),

		h('p', { style: { ...hintStyle, fontSize: font.caption, margin: 0, lineHeight: 1.7 } },
			'关键词命中的条目 + 常驻条目会一起进上下文；同一轮内容里优先级高的在前。'),
	);
}

			return { "LorebookView": LorebookView };
		};

		// ── lib/store.js ──
		__factories["lib/store.js"] = function (__m, __exports) {
// lib/store.js — 书目数据布局与机器状态（纯函数 + 路径表）。
// 机器状态一律 JSON（AGENTS.md 不变量 6）；人类/模型文档一律 Markdown。

const { chapterFileName, sanitizeTitle, nextSuffixedId } = __m("lib/versioning.js");
const { activeLayout } = __m("lib/layout.js");

/** 书内相对路径表（POSIX，工作区相对）。
 *
 * 人类可读文档的目录/文件名由 lib/layout.js 的布局档案决定（forge / fiction-suite）；
 * 机器状态（novel.json / 账本 / 设定 JSON / .novel）**两种布局完全一致**——切布局
 * 不会动账本与索引，只会换文档落点。 */
function pathsFor(book) {
    const b = book;
    const L = activeLayout();
    // 正文目录名单一真相：chapterFile 与 repair 的孤儿扫描共用它。
    // 各处再拼一次字面量，目录改名时写入与扫描会分家——扫描扫不到东西会报「零孤儿」，
    // 那是假清白，比报错更糟。
    const chaptersDir = `${b}/${L.chaptersDir}`;
    return {
        // 书名随路径表走（assertBookName 保证不含 /，可从 meta 反解）——io 装配层
        // 手上只有 p 没有 book 时（continuity-io 等）用它做路径收口，不必层层加参。
        bookName: b,
        meta: `${b}/novel.json`,
        bookOutline: `${b}/${L.bookOutline}`,
        outlineDir: `${b}/${L.chapterOutlineDir}`,
        chapterOutline: (n) => `${b}/${L.chapterOutlineDir}/${L.chapterOutlineName(n)}`,
        character: (name) => `${b}/${L.charactersDir}/${sanitizeTitle(name)}.md`,
        charactersDir: `${b}/${L.charactersDir}`,
        worldbook: `${b}/设定/世界书.json`,
        glossary: `${b}/设定/术语表.json`,
        promise: `${b}/${L.promise}`,
        sceneContracts: `${b}/设定/场景契约.json`,
        voices: `${b}/设定/语言基因.json`,
        facts: `${b}/账本/facts.json`,
        foreshadows: `${b}/账本/伏笔.json`,
        // 认知账本（谁知道什么/不知道什么）：append-only 行日志，视图是派生物
        cognition: `${b}/账本/cognition.json`,
        // 关系账本（人物/组织间的关系状态线）：append-only 行日志，与 facts 同构（v1.4.0 主线1）。
        // 内容门禁的关系矛盾闸、全书深扫的关系维度都读它；路径收口与 facts 同一份（pathsFor）。
        relations: `${b}/账本/relations.json`,
        // 弧线账本（人物维度值随章推进：成长/信任度/嫌疑度…）：append-only 行日志（v1.4.0 主线1）。
        // 弧线停滞诊断走 lib/arcs.js（纯函数），落 major 质量债；放在 账本/ 与 facts 同源。
        arcs: `${b}/账本/arcs.json`,
        audit: `${b}/.novel/audit.jsonl`,
        styleBaseline: `${b}/.novel/style-baseline.json`,
        // G1 检索索引（派生物：删了重跑即得，绝不参与一致性判定）
        indexDb: `${b}/.novel/index.db`,
        proposalsDir: `${b}/.novel/proposals`,
        proposal: (id) => `${b}/.novel/proposals/${id}.json`,
        // 批量起草断点检查点（机器状态：中断后 resume 用）
        batchCheckpoint: `${b}/.novel/batch-checkpoint.json`,
        // 写前简报的依据指纹记录（机器状态：章号 → 简报生成时的依据哈希）。
        // 写章提交时拿它核对「简报是否已过期」——见 lib/basis.js。
        basis: `${b}/.novel/basis.json`,
        // 章节文件名格式统一走 versioning.chapterFileName（与 parseChapterFileName/nextVersion 同源）
        chaptersDir,
        chapterFile: (n, title, v) => `${chaptersDir}/${chapterFileName(n, title, v)}`,
    };
}

/**
 * `novel.json` 的数据格式版本锚点（方向3）。
 *
 * 为什么要有它：此前每次加字段/改语义都是「临时补丁」（如 worldbook id 回填），
 * 盘上数据到底是哪一版、还差哪些结构，没人能判定。落一个版本号后，「这本旧书需要升级」
 * 成为可判定的事实；升级逻辑集中在 migrateNovel（幂等、失败不阻断写作）。
 *
 * 维护约定：改了 novel.json 的结构（新增必需容器字段 / 字段语义变更）就 +1，
 * 并在 migrateNovel 里补对应的补结构分支。纯加可选字段不算。
 */
const SCHEMA_VERSION = 1;

/**
 * 书目稳定 id（方向4）：书目录名会被改名/被多根同名拷贝撞车，`book` 只是**定位用的
 * 目录名**，不是身份。落一个稳定 id 后，「同名书的哪一份」才有可靠判据。
 * 刻意不 import node:crypto——本模块会被打进浏览器 bundle（panel 与宿主共用会话判据）。
 */
function newBookId(now = Date.now()) {
    return `nb_${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * novel.json 数据格式迁移（**纯函数**，幂等）。旧书读到时自动补齐结构锚点。
 *
 * 语义（重要）：
 *   - 只**补结构**、不改内容：缺失的容器字段补空壳，旧书补稳定 id。
 *   - 版本缺失 → 视为 v0；已是当前 → 只补缺的字段；**高于当前 → 一律不动**
 *     （用户可能装过更新的插件，本地降级不得把数据改坏）。
 *   - 幂等：对已迁移的书再跑一次返回 changed:false。
 *
 * @returns {{ novel, from:number, to:number, changed:boolean, notes:string[] }}
 */
function migrateNovel(novel) {
    const notes = [];
    if (novel === null || typeof novel !== 'object') return { novel, from: 0, to: 0, changed: false, notes };
    const from = Number.isInteger(novel.schemaVersion) ? novel.schemaVersion : 0;
    if (from > SCHEMA_VERSION) {
        notes.push(`本书数据版本 v${from} 高于本插件支持的 v${SCHEMA_VERSION}——可能装过更新的插件，不做降级迁移`);
        return { novel, from, to: from, changed: false, notes };
    }
    let changed = false;
    const ensureObj = (key, label) => {
        if (novel[key] === null || typeof novel[key] !== 'object' || Array.isArray(novel[key])) {
            novel[key] = {}; changed = true; notes.push(label);
        }
    };
    if (typeof novel.id !== 'string' || novel.id === '') { novel.id = newBookId(); changed = true; notes.push('补稳定 id'); }
    if (!Array.isArray(novel.sessions)) { novel.sessions = []; changed = true; notes.push('补会话归属集'); }
    if (!Array.isArray(novel.cast)) { novel.cast = []; changed = true; notes.push('补人物名册'); }
    if (!Array.isArray(novel.proposals)) { novel.proposals = []; changed = true; notes.push('补提案索引'); }
    ensureObj('chapters', '补章节索引');
    ensureObj('gateFailures', '补熔断计数');
    ensureObj('approvals', '补审批表');
    // 克隆书曾落成 approvals:{}，approve 读 approvals.outline 会 TypeError——旧书一并补上
    if (novel.approvals.outline === null || typeof novel.approvals.outline !== 'object' || Array.isArray(novel.approvals.outline)) {
        novel.approvals.outline = {}; changed = true; notes.push('补细纲审批对象（缺它 approve 会报错）');
    }
    if (from < SCHEMA_VERSION) { changed = true; notes.push(`数据格式 v${from} → v${SCHEMA_VERSION}`); }
    novel.schemaVersion = SCHEMA_VERSION;
    return { novel, from, to: SCHEMA_VERSION, changed, notes };
}

/**
 * 新书机器状态。session 传了就把创建会话记进归属集（面板按会话过滤列表）。
 * platform / charLimits 是**开书时收集**的字数口径（用户 2026-10-20）：
 * 两者都是可选——不给就不落字段，行为与旧版一字不差（判定回落到插件配置）。
 */
function defaultNovel({
    title, genre, logline = '', now = new Date().toISOString(), session = null,
    platform = '', charLimits = null,
}) {
    return {
        id: newBookId(),
        // 数据格式版本锚点：新书直接落当前版本，旧书由 migrateNovel 在读到时补齐
        schemaVersion: SCHEMA_VERSION,
        title,
        genre,
        logline,
        sessions: session ? [session] : [],
        ...(platform === '' ? {} : { platform }),
        ...(charLimits === null || charLimits === undefined ? {} : { charLimits: { min: charLimits.min, max: charLimits.max } }),
        // 九阶段状态机（lib/phases.js）的当前阶段；phases 记每阶段状态与 PhaseReport。
        stage: 'topic',
        phases: {},
        createdAt: now,
        updatedAt: now,
        approvals: { outline: {} },
        chapters: {},
        cast: [],
        proposals: [],
        // 熔断计数器（lib/circuit-breaker.js）：章号 → 连续驳回次数。
        gateFailures: {},
        // 细纲契约段策略：新建的书默认 strict——save_chapter 缺「## 本章必写场景」段
        // （或有段无条目）直接驳回。存量旧书无此字段＝warn（不拒稿但留痕提示补段），
        // 老写法的自由文本细纲不受冲击（lib/tools/outline-tool.js save_chapter 消费）。
        outlineContract: 'strict',
    };
}

/**
 * 字数口径的**唯一真相表**（T1 + 用户 2026-10-20 追加自定义档）。
 *
 * 生效优先级：本书自定义（`novel.charLimits`）> 平台口径（`novel.platform`）> 插件配置。
 * 三档全都拿不到时才是「未设置」——沿用调用方 config，默认行为一字不变。
 *
 * 为什么数字必须只写在这里：此前番茄 1500–3000 / 起点 2000–4000 在 `platform-review.js`
 * 的判定里各抄了一份字面量，`store.js` 又抄了第三份——「审稿口径」与「写作门禁口径」
 * 一旦漂移，就回到本轮要消灭的那个病：同一章在两处得到相反结论。现在 platform-review
 * 反向 import 本表，字面量全仓只剩这一处。
 *
 * 平台 id 集合同理单点：PLATFORM_IDS 直接从 PLATFORM_PROFILES 键派生（曾吃过三处
 * 声明的亏——platform-review 的审稿表键集与这张档案表靠人肉对齐，分家时
 * project-tool 的准入放行、审稿函数却炸「未知平台」，或反之）。platform-review
 * 侧另有模块加载时的键集对账（缺谁加载即抛，npm test 立刻红）。
 */
const PLATFORM_PROFILES = {
    qidian: { id: 'qidian', name: '起点', minChapterChars: 2000, maxChapterChars: 4000, landing: '' },
    fanqie: { id: 'fanqie', name: '番茄', minChapterChars: 1500, maxChapterChars: 3000, landing: '2800–2990' },
    // 晋江：订阅制按千字计费，全勤基准档 3000 字/日、月度底线「每章不少于 3000」——下限是硬的
    // （字数即收入，短章是读者实亏与高频差评源）；上限 6000，手机端长章同样掉追读，宁拆章。
    jjwxc: { id: 'jjwxc', name: '晋江', minChapterChars: 3000, maxChapterChars: 6000, landing: '' },
    // 七猫：免费流（广告分成），完读率/阅读时长导向同番茄；日更 4000 惯例常拆两章 → 单章 2000–3500
    //（作家助手硬底线是单章 >500，但那只是能发的下限，不是能留住人的下限）。
    qimao: { id: 'qimao', name: '七猫', minChapterChars: 2000, maxChapterChars: 3500, landing: '' },
    // 飞卢：单章区间是两段式——上架前 1500–2000、上架后 2500–5050（2026-06 前后公开规则；
    // VIP 章不满 1000 字不计费、不计入全勤；日更保底 4000、全勤 6000）。单一档案装不下两段，
    // 这里取包络 1500–5050：写作门禁按包络放行，细口径由 reviewFeilu 的字数项分带给 advice
    // （两带间隙 2001–2499 单独 warn，不冒充合格）。
    feilu: { id: 'feilu', name: '飞卢', minChapterChars: 1500, maxChapterChars: 5050, landing: '' },
};

/** 平台 id 集合 = 档案表键派生（唯一声明点；见上方注释）。 */
const PLATFORM_IDS = Object.keys(PLATFORM_PROFILES);

/** 自定义字数区间的合理边界（防手滑填 20 或 200000 把门禁变成摆设/死闸）。 */
const CHAR_LIMITS_MIN = 100;
const CHAR_LIMITS_MAX = 20000;

/**
 * 平台字段解析（纯函数）：'' = 未设置；合法 id 归一为小写；**非法 → null**
 * （调用方自己决定是报错还是忽略——写入口报错，读入口按未设置处理）。
 */
function parsePlatform(value) {
    if (value === undefined || value === null) return '';
    const s = String(value).trim().toLowerCase();
    if (s === '') return '';
    return PLATFORM_IDS.includes(s) ? s : null;
}

/** 书上的平台（纯读）。手工改坏的 novel.json 不 throw——非法值一律按未设置处理。 */
function platformOf(novel) {
    const p = parsePlatform(novel?.platform);
    return p === null ? '' : p;
}

/**
 * 自定义每章字数区间的解析（纯函数，**写入面用它**）：
 * @returns {{ ok:true, limits:{min,max}|null } | { ok:false, error:string }}
 *  - 两值都不给（undefined/null/空串）→ `limits: null`＝清除自定义，回落到平台/插件档。
 *  - 只给一头、非整数、越界、min>max → ok:false（写入口必须响亮报错，不能静默半套）。
 */
function parseCharLimits(rawMin, rawMax) {
    const blank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
    const minBlank = blank(rawMin);
    const maxBlank = blank(rawMax);
    if (minBlank && maxBlank) return { ok: true, limits: null };
    if (minBlank !== maxBlank) {
        return { ok: false, error: '自定义字数区间必须**同时**给下限与上限（只给一个等于没说）；要清除设置就两个都留空。' };
    }
    const min = Number(rawMin);
    const max = Number(rawMax);
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
        return { ok: false, error: `字数区间必须是整数（收到 ${rawMin} / ${rawMax}）。` };
    }
    if (min < CHAR_LIMITS_MIN || max > CHAR_LIMITS_MAX) {
        return { ok: false, error: `字数区间要在 ${CHAR_LIMITS_MIN}–${CHAR_LIMITS_MAX} 之间（收到 ${min}–${max}）。` };
    }
    if (min > max) return { ok: false, error: `下限不能大于上限（${min} > ${max}）。` };
    return { ok: true, limits: { min, max } };
}

/**
 * 「2500-3500」这类**区间文本**的解析（工具面与 REST 面共用一份，防两处语法漂移）。
 * 分隔符接受 - – — ~ 、/ 逗号 斜杠 **与空白**（空格/制表/全角空格）；一个数也不给
 * → 清除（limits:null）。只给一个数（"2500"、"2500-"）一律报错：半套区间比没有区间更危险。
 * 返回值三分：`limits` 为对象＝设置；`null`＝清除；`undefined`＝**缺省（没提供）**——调用方
 * 自行决定语义（工具面「不动」，REST 写端点按不变量 #11 响亮报错）。
 */
function parseCharsSpec(value) {
    if (value === undefined || value === null) return { ok: true, limits: undefined };
    const s = String(value).trim();
    if (s === '') return { ok: true, limits: null };
    const parts = s.split(/[-–—~、,，/]|\s+/).filter((x) => x !== '');
    if (parts.length !== 2) {
        return { ok: false, error: `字数区间要写成「下限-上限」两个数（如 2500-3500），收到「${s.slice(0, 40)}」。要清除就传空串。` };
    }
    return parseCharLimits(parts[0], parts[1]);
}

/**
 * 读书上的自定义区间（纯读，**判定链用它**）。手工改坏/半套的 novel.json 不 throw：
 * 任何不完整的自定义档一律按「没有自定义」处理，回落平台/插件档——门禁宁可回到
 * 已知可用的口径，也不要拿一个残缺区间去放行 0 字或拒掉一切。
 */
function charLimitsOf(novel) {
    const raw = novel?.charLimits;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const parsed = parseCharLimits(raw.min, raw.max);
    return parsed.ok ? parsed.limits : null;
}

/**
 * config → **本书当前平台的字数区间**。未设置平台时连对象都原样返回（同一个引用），
 * 「默认行为一字不变」是结构性保证而不是巧合。
 * 需要「含自定义档」的完整判据请用 `effectiveCharConfig`。
 */
function charConfigForPlatform(config, platform) {
    if (!PLATFORM_IDS.includes(platform)) return config;
    const prof = PLATFORM_PROFILES[platform];
    return { ...config, minChapterChars: prof.minChapterChars, maxChapterChars: prof.maxChapterChars };
}

/**
 * 本书**真正生效**的字数口径（判定链唯一入口）：自定义 > 平台 > 插件配置。
 * 三级都没动过时原样返回传入的 config 引用（默认行为的结构性保证）。
 * 返回 `{ config, source }`，source ∈ 'custom' | 'platform' | 'config'——
 * 回执与面板要告诉用户「这个数是哪儿来的」，只给数字不算说清楚。
 */
function effectiveCharConfig(config, novel) {
    const custom = charLimitsOf(novel);
    if (custom !== null) {
        return { config: { ...config, minChapterChars: custom.min, maxChapterChars: custom.max }, source: 'custom' };
    }
    const platform = platformOf(novel);
    // 平台档的换算只有 charConfigForPlatform 一份实现，这里只做「有没有平台」的分派
    // ——判定链若各自拼一遍 min/max，就又是「两处数字不一样」的老病。
    return platform === ''
        ? { config, source: 'config' }
        : { config: charConfigForPlatform(config, platform), source: 'platform' };
}

/** 生效口径的一句话出处（面板与工具回执共用）。 */
function charConfigSourceLabel(source, novel) {
    if (source === 'custom') return '本书自定义';
    if (source === 'platform') {
        const prof = PLATFORM_PROFILES[platformOf(novel)];
        return prof === undefined ? '平台口径' : `${prof.name}平台口径`;
    }
    return '本插件配置（默认）';
}

/**
 * 工具/REST 输出用的字数口径视图（纯函数）。
 * **undefined 的键一律不进对象**——宿主对工具输出做 lossless JSON 严格校验，
 * 多一个 null/undefined 字段就整次调用被拒（S1 事故的同一类）。
 * 所以这里返回的是「有自定义才带 charLimits，其余三键恒在」的形状，调用方直接展开。
 */
function charLimitsView(config, novel) {
    const custom = charLimitsOf(novel);
    const { config: eff, source } = effectiveCharConfig(config, novel);
    return {
        ...(custom === null ? {} : { charLimits: `${custom.min}-${custom.max}` }),
        charMin: eff.minChapterChars,
        charMax: eff.maxChapterChars,
        charSource: source,
    };
}

/** 平台字数口径的文案单一真相：novel_outline / novel_write_chapter 的描述共用它，防两处漂移。 */
function platformLimitsText() {
    return PLATFORM_IDS.map((id) => {
        const p = PLATFORM_PROFILES[id];
        return `${p.name} ${p.minChapterChars}–${p.maxChapterChars}`
            + (p.landing === '' ? '' : `（建议落点 ${p.landing}，别贴 ${p.maxChapterChars} 顶线）`);
    }).join('、');
}

/**
 * 「本书生效口径是怎么算出来的」这条说明的唯一写法（工具回执与面板共用）。
 * @param config 插件配置（第三档兜底）
 * @param novel  本书（读 charLimits / platform；也接受已经改好的对象）
 */
function charLimitsNote(config, novel) {
    const { config: eff, source } = effectiveCharConfig(config, novel);
    const target = Math.round((eff.minChapterChars + eff.maxChapterChars) / 2);
    const where = charConfigSourceLabel(source, novel);
    const head = `本书每章字数按${where}判定：${eff.minChapterChars}–${eff.maxChapterChars} 字（目标约 ${target} 字）。`;
    if (source === 'custom') {
        return head + '想改回来：novel_project action=chars（两个数都传空即清除，回落到平台/插件口径）。';
    }
    if (source === 'platform') {
        return head + `想自定义：novel_project action=chars 传 chars: "2500-3500"（自定义优先于平台口径）。`;
    }
    return head + '本书既没设平台也没设自定义区间；要按平台走用 novel_project action=platform，要自己定用 action=chars。';
}

/** 平台设置的落点提示（novel_project action=platform 的回执文案）。 */
function platformNote(platform) {
    if (platform === '') {
        return '本书未设置平台——写作门禁按本插件配置的字数口径（默认 2000–5000、目标 3500 字左右），novel_audit 不显式传 platform 就不跑平台审稿。';
    }
    const p = PLATFORM_PROFILES[platform];
    return `本书平台＝${p.name}：写章门禁 ${p.minChapterChars}–${p.maxChapterChars} 字`
        + (p.landing === '' ? '' : `（建议落点 ${p.landing}）`)
        + `，novel_audit 不显式传 platform 时默认跑${p.name}审稿。`
        + '本书若另设了自定义字数区间，以区间为准（action=chars 可清除）。';
}

/**
 * 会话归属：这本书是否属于某会话。
 *
 * 列表按会话过滤（「项目跟会话走」）的**唯一判据**，所以放在这里当纯函数，
 * 服务端 REST 与面板共用一份实现。`sessions` 缺失/为空 = 未归属（旧版建的书），
 * 不属于任何会话 —— 由面板的「认领」通道补录。
 */
function bookInSession(novel, sessionId) {
    if (typeof sessionId !== 'string' || sessionId === '') return false;
    return (novel?.sessions ?? []).includes(sessionId);
}

/** 是否未归属（任何会话都看不到，等认领）。 */
function isUnclaimed(novel) {
    return (novel?.sessions ?? []).length === 0;
}

/**
 * 把会话补录进书的归属集。
 * @returns {boolean} 是否真的改了（已存在或 sessionId 为空 → false）
 */
function addBookSession(novel, sessionId) {
    if (typeof sessionId !== 'string' || sessionId === '') return false;
    if (!Array.isArray(novel.sessions)) novel.sessions = [];
    if (novel.sessions.includes(sessionId)) return false;
    novel.sessions.push(sessionId);
    return true;
}

/** 章节 index 记录（novel.json.chapters[n]）。files 保留近 20 个版本文件名。
 *  gate 传入时落盘契约指标（覆盖率/偏离度/漏写场景/命中禁项，带时间戳）——趋势可查。 */
function chapterRecord(prev, { title, version, file, chars, summary, gate }) {
    const base = prev ?? { title, versions: [], files: [] };
    return {
        title,
        versions: [...new Set([...(base.versions ?? []), version])].sort((a, b) => a - b),
        files: [...(base.files ?? []), { version, file }].slice(-20),
        latest: version,
        path: file,
        chars,
        // summary 缺省补 ''：REST 面板存章不传 summary（undefined 混进 novel_project
        // status/repair 的输出会让宿主 lossless JSON 拒收整次调用——真机已复现）；
        // 工具写的章在面板再存一版时，旧 summary 也不能被 REST 路径抹掉
        summary: summary ?? base.summary ?? '',
        ...(gate === undefined || gate === null ? (base.gate === undefined ? {} : { gate: base.gate }) : { gate }),
        updatedAt: new Date().toISOString(),
    };
}

/** 从章节记录解析「当前正文」的工作区相对路径（rec.path 优先，回退 files 末条）。
 *  0.13.1 事故：server-api 曾读不存在的 rec.file 还另拼一层 bookId/正文/ → 阅读器恒空。
 *  schema 只认 path / files[].file，两者都已含书目前缀，直接交给 fsio.readText。
 *
 *  路径收口（CodeBuddy 审计 2026-10-09）：novel.json 是数据文件，rec.path 可能被手工
 *  改坏或外来导入污染——REST 面按它 readText **全文回传**，不收口 = 工作区内任意读。
 *  传 bookId 时强制「以 ${bookId}/ 开头 + 无空段/./.. 段」，不合式返回 null（调用方按
 *  缺文件处理）。纯函数，不碰 io。 */
function containedBookPath(bookId, rel) {
    if (typeof bookId !== 'string' || bookId === '') return null;
    if (typeof rel !== 'string' || rel === '') return null;
    const parts = rel.split('/');
    if (parts.length < 2 || parts[0] !== bookId) return null;
    if (parts.some((seg) => seg === '' || seg === '.' || seg === '..')) return null;
    return rel;
}

function chapterRelPath(rec, bookId) {
    const rel = rec?.path ?? (rec?.files ?? []).at(-1)?.file ?? null;
    return bookId === undefined ? rel : containedBookPath(bookId, rel);
}

/** 事实账本 / 伏笔台账为空时的初始形态。 */
const emptyFacts = [];
const emptyForeshadows = [];

/**
 * 世界书条目 id 的**单一生成入口**。工具（novel_worldbook add）、REST 面板
 * （POST /worldbook）与导入都必须走它，保证 id 方案一致（`W` 前缀自增）。
 *
 * 曾有两条并行方案（工具 `W1`、REST 用 Math.max 数字自增），对已有字符串 id 求
 * 数值会得 NaN → 落盘成 `"id": null`（真机可复现）。统一到 `W` 前缀后这类事故从根上消失。
 */
function nextWorldEntryId(entries) {
    return nextSuffixedId((Array.isArray(entries) ? entries : []).map((e) => e?.id), 'W');
}

/**
 * 世界书条目 id 的**单一比较入口**。契约是字符串（工具默认 `'W1'`），但历史数据里
 * 可能混有数字（旧 REST 面板建过），一律按字符串比较。
 *
 * ⚠️ 严禁调用方自行 `Number(id)` 强转：`Number('W1')` = NaN，比较恒假 → 面板
 * 「编辑 / 启用·停用」对工具生成的条目**静默失效**（点了没反应，真机已复现）。
 * 任一值为 null/undefined 时返回 false（find 语义：空 id 不匹配任何条目）。
 */
function sameEntryId(a, b) {
    if (a === undefined || a === null || b === undefined || b === null) return false;
    return String(a) === String(b);
}

/**
 * 世界书条目校验。priority（0-100，默认 50）决定预算不足时的注入顺序。
 *
 * ⚠️ 触发词缺失时的**兜底**不在这里做（那要读盘上的 cast/账本/术语表，属 io）——
 * 由调用方（novel_worldbook add/update）先 `deriveEntryKeywords` 抽词、抽不到再转
 * `always:true`，两条路都带可见 warning。本函数保留抛错分支只服务一类对象：
 * REST 面板与导入等**没有兜底通道**的调用方（它们必须给出词或显式常驻）。
 */
function normalizeWorldEntry({ id, keywords = [], content, always = false, priority = 50 }, existing = []) {
    if (typeof content !== 'string' || content.trim() === '') throw new Error('世界书条目 content 不能为空');
    if (!Array.isArray(keywords) || (keywords.length === 0 && !always)) {
        throw new Error('世界书条目需要至少一个关键词，或 always:true 常驻注入');
    }
    const eid = id ?? nextWorldEntryId(existing);
    if (existing.some((e) => sameEntryId(e.id, eid))) throw new Error(`世界书条目 id 重复：${eid}`);
    const prio = Number.isInteger(priority) ? Math.max(0, Math.min(100, priority)) : 50;
    return { id: eid, keywords: keywords.map(String), content: content.trim(), always: Boolean(always), priority: prio };
}

/**
 * 从条目内容里挑**本书已知实体名**当触发词（纯函数，零 io）。
 *
 * 为什么要有它：真机首发会话第一条红色报错就是「世界书条目需要至少一个关键词」——
 * 开书阶段要固化的天然是「题材定位/主线/金手指」这类全书级设定，本来就没有触发词，
 * 而 `always` 是个可选布尔，模型得先想到它（常驻 systemPrompt 只带过一句「或 always」）。
 * 按本项目的老规矩：凡是靠模型自觉的约束都会失效，所以这一步由代码补位。
 *
 * 只从**候选名池**里挑（cast ∪ 账本实体 ∪ 术语表 ∪ 已有条目关键词），不凭空造词：
 * 自己拼 2-4gram 会把「的/了」这类噪声送进触发词，命中面失控。
 * 命中内容的最长者优先（「顾氏集团」比「顾氏」更该当词）。
 * @returns string[]（最多 limit 个；一个都没有 → 调用方转 always:true）
 */
function deriveEntryKeywords(content, names = [], { limit = 5 } = {}) {
    const text = String(content ?? '');
    const seen = new Set();
    const hits = [];
    for (const raw of names) {
        const name = typeof raw === 'string' ? raw.trim() : '';
        // 单字名不当触发词：命中面太宽（「雨」「门」会把无关章节全捞进上下文）
        if (name.length < 2 || seen.has(name)) continue;
        seen.add(name);
        if (text.includes(name)) hits.push(name);
    }
    hits.sort((a, b) => b.length - a.length || a.localeCompare(b));
    return hits.slice(0, Math.max(1, limit));
}

/**
 * 世界书触发词的**兜底决议**（纯函数，add/update 共用）：
 * 给了词或显式常驻 → 原样通过；否则先按内容抽本书已知实体名，抽不到转 `always:true`。
 * 两条兜底路都必须带 warning（UI 失败/降级必须可见，禁止静默）。
 * @returns { keywords, always, warning }  warning 为空串表示没走兜底
 */
function resolveWorldTrigger({ keywords = [], always = false, content = '', names = [] } = {}) {
    const list = Array.isArray(keywords) ? keywords.filter((k) => typeof k === 'string' && k.trim() !== '') : [];
    if (always === true || list.length > 0) return { keywords: list, always: always === true, warning: '' };
    const derived = deriveEntryKeywords(content, names);
    if (derived.length > 0) {
        return { keywords: derived, always: false, warning: `未给触发词，已按内容自动取词：${derived.join('、')}（不合适请 novel_worldbook update 改）` };
    }
    return {
        keywords: [],
        always: true,
        warning: '未给触发词，且内容里没有本书已知实体名（人物/术语/账本实体）可当触发词——已按 always:true 常驻注入。常驻条目每章都进上下文、吃预算，建议补触发词。',
    };
}

			return { "pathsFor": pathsFor, "SCHEMA_VERSION": SCHEMA_VERSION, "newBookId": newBookId, "migrateNovel": migrateNovel, "defaultNovel": defaultNovel, "PLATFORM_PROFILES": PLATFORM_PROFILES, "PLATFORM_IDS": PLATFORM_IDS, "CHAR_LIMITS_MIN": CHAR_LIMITS_MIN, "CHAR_LIMITS_MAX": CHAR_LIMITS_MAX, "parsePlatform": parsePlatform, "platformOf": platformOf, "parseCharLimits": parseCharLimits, "parseCharsSpec": parseCharsSpec, "charLimitsOf": charLimitsOf, "charConfigForPlatform": charConfigForPlatform, "effectiveCharConfig": effectiveCharConfig, "charConfigSourceLabel": charConfigSourceLabel, "charLimitsView": charLimitsView, "platformLimitsText": platformLimitsText, "charLimitsNote": charLimitsNote, "platformNote": platformNote, "bookInSession": bookInSession, "isUnclaimed": isUnclaimed, "addBookSession": addBookSession, "chapterRecord": chapterRecord, "containedBookPath": containedBookPath, "chapterRelPath": chapterRelPath, "emptyFacts": emptyFacts, "emptyForeshadows": emptyForeshadows, "nextWorldEntryId": nextWorldEntryId, "sameEntryId": sameEntryId, "normalizeWorldEntry": normalizeWorldEntry, "deriveEntryKeywords": deriveEntryKeywords, "resolveWorldTrigger": resolveWorldTrigger };
		};

		// ── lib/versioning.js ──
		__factories["lib/versioning.js"] = function (__m, __exports) {
// lib/versioning.js — 章节文件版本化（纯函数 + 布局/版本策略）。
//
// 两种布局、两种版本策略（见 lib/layout.js）：
//   · forge + versions（插件默认）：`正文/第N章-<标题>-v<k>.md`，续写只认 k 最大者；
//     改稿永远新增版本，不覆盖。
//   · forge + git：`正文/第N章-<标题>.md`，单文件原地覆盖，历史由书目录 git 承担。
//   · fiction-suite + versions：`06-正文/第001章 <章名>-v<k>.md`。
//   · fiction-suite + git：`06-正文/第001章 <章名>.md`（技能落盘规范）。
//
// 解析器同时认四种名字——导入/克隆/repair 读旧书文件时不受当前布局限制。

const { activeLayout, versioningMode, pad3 } = __m("lib/layout.js");

const ILLEGAL = /[\\/:*?"<>|\s]+/g;

/** 标题清洗：去非法文件名字符，空则回退「无题」。 */
function sanitizeTitle(title) {
    const t = String(title ?? '').trim().replace(ILLEGAL, '-').replace(/^-+|-+$/g, '');
    return (t || '无题').slice(0, 40);
}

/** 当前布局下的章节文件名（版本号在 git 策略下不出现在文件名里）。 */
function chapterFileName(n, title, v) {
    const t = sanitizeTitle(title);
    const mode = versioningMode();
    if (activeLayout().chapterNaming === 'fiction-suite') {
        const base = `第${pad3(n)}章 ${t}`;
        return mode === 'git' ? `${base}.md` : `${base}-v${v}.md`;
    }
    const base = `第${n}章-${t}`;
    return mode === 'git' ? `${base}.md` : `${base}-v${v}.md`;
}

// 四种历史/现行命名。顺序重要：带 -vK 的先匹配，避免被「标题里恰好有 -vN」截胡。
const FS_VERSIONED = /^第(\d+)章 (.+)-v(\d+)\.md$/;
const FS_PLAIN = /^第(\d+)章 (.+)\.md$/;
const FORGE_VERSIONED = /^第(\d+)章-(.+)-v(\d+)\.md$/;
const FORGE_PLAIN = /^第(\d+)章-(.+)\.md$/;

/** 解析章节文件名（四种命名都认）；不合式返回 null。plain 形式按 v=1 记。
 *  「第1章-v2.md」这类**残缺的版本文件名**不算 plain（否则会被当成标题 "v2" 的正文，
 *  让 nextVersion 把无效名当成 v1 参与计数——真机有历史脏文件正是这个形状）。 */
function parseChapterFileName(name) {
    const raw = String(name ?? '');
    let m = FS_VERSIONED.exec(raw) ?? FORGE_VERSIONED.exec(raw);
    if (m !== null) return { n: Number(m[1]), title: m[2], v: Number(m[3]) };
    m = FS_PLAIN.exec(raw) ?? FORGE_PLAIN.exec(raw);
    if (m !== null) {
        if (/(?:^|-)v\d+$/.test(m[2])) return null;
        return { n: Number(m[1]), title: m[2], v: 1 };
    }
    return null;
}

/** 同章下一版本号（标题可变，版本按章号取最大）。
 *
 *  · versions 策略：从磁盘/索引里的文件名求 max+1（唯一入口：write_chapter /
 *    propose apply / 面板保存都走这里）。
 *  · git 策略：文件名不带版本，改从索引里的逻辑版本 `latest` 推（调用方传 prev.latest）。
 *    磁盘上已有该章文件但索引缺失时至少从 1 起算，不让覆盖写成「v0」。
 *
 * @param {string[]} existingNames 索引里该章的版本文件名（可含非本章名字，按章号过滤）
 * @param {number} n 章号
 * @param {{latest?: number, mode?: 'versions'|'git'}} [options]
 */
function nextVersion(existingNames, n, options = {}) {
    const mode = options.mode ?? versioningMode();
    if (mode === 'git') {
        const latest = Number.isInteger(options.latest) && options.latest > 0 ? options.latest : 0;
        const onDisk = (existingNames ?? []).some((name) => {
            const p = parseChapterFileName(name);
            return p !== null && p.n === n;
        });
        return Math.max(latest, onDisk ? 1 : 0) + 1;
    }
    let max = 0;
    for (const name of existingNames ?? []) {
        const p = parseChapterFileName(name);
        if (p !== null && p.n === n && p.v > max) max = p.v;
    }
    return max + 1;
}

/** 自动 id：取现有 id 中 `${prefix}\d+` 的最大编号 + 1（gap 安全，防手工删条目后的碰撞覆盖）。 */
function nextSuffixedId(ids, prefix, startAt = 1) {
    const re = new RegExp(`^${prefix}(\\d+)$`);
    let max = 0;
    for (const id of ids ?? []) {
        const m = re.exec(String(id));
        if (m !== null) max = Math.max(max, Number(m[1]));
    }
    return `${prefix}${Math.max(startAt, max + 1)}`;
}

			return { "sanitizeTitle": sanitizeTitle, "chapterFileName": chapterFileName, "parseChapterFileName": parseChapterFileName, "nextVersion": nextVersion, "nextSuffixedId": nextSuffixedId };
		};

		// ── lib/layout.js ──
		__factories["lib/layout.js"] = function (__m, __exports) {
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
const LAYOUT_IDS = ['forge', 'fiction-suite'];

/** 合法版本策略取值（'auto' 表示按布局推导）。 */
const VERSIONING_MODES = ['auto', 'versions', 'git'];

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
function pad3(n) {
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
function configureLayout({ layout = 'forge', versioning = 'auto' } = {}) {
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
function resetLayout() {
    state.profile = 'forge';
    state.requested = 'auto';
    state.resolved = 'versions';
}

/** 当前生效的布局档案（冻结副本，调用方不要改）。 */
function activeLayout() {
    return PROFILES[state.profile];
}

/** 当前生效的版本策略：'versions' | 'git'。 */
function versioningMode() {
    return state.resolved;
}

/** 工具描述用的人话版本策略说明（装配期求值一次，随工具 schema 固定）。 */
function versioningPolicyText() {
    return state.resolved === 'git'
        ? 'git 策略：同一章正文单文件原地覆盖（历史交给书目录 git，禁止手工 -vN 副本/备份目录）'
        : 'versions 策略：同章追加 vK 新文件，旧版永不覆盖';
}

/** 当前配置快照（诊断/日志用）。 */
function layoutSnapshot() {
    return { profile: state.profile, versioning: state.requested, resolved: state.resolved };
}

			return { "LAYOUT_IDS": LAYOUT_IDS, "VERSIONING_MODES": VERSIONING_MODES, "pad3": pad3, "configureLayout": configureLayout, "resetLayout": resetLayout, "activeLayout": activeLayout, "versioningMode": versioningMode, "versioningPolicyText": versioningPolicyText, "layoutSnapshot": layoutSnapshot };
		};

		// ── src/client/views/settings.js ──
		__factories["src/client/views/settings.js"] = function (__m, __exports) {
// src/client/views/settings.js — 设置页（1.8）：本书设置可改 + H5 网页版入口 + 能力清单。
//
// 为什么重写：旧页只是**只读**「能力清单」，用户问「能不能在面板里改设置」时答案是「不能」。
// 现在两件事都能在这里做：
//   ① 本书设置（每章字数区间 / 投放平台 / 作品简介）→ POST /projects/:id/settings
//      （与工具面 novel_project chars/platform、以及 H5 设置页同一个端点，一份真相）；
//   ② H5 网页版（阅读/工作台）入口 —— 面板卡顿时换独立渲染的 H5 页面。
// 注意：布局（forge/fiction-suite）与版本策略是**进程级插件配置**，改了要重启宿主，
// 这里只读展示、不给假开关。
const { h } = __m("src/client/react.js");
const { color, space, font, weight, footerStyle, stackStyle, hintStyle, errStyle, okStyle, inputStyle } = __m("src/client/styles.js");
const { Card, Btn, Chip, KV, Section, Feedback } = __m("src/client/ui.js");

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

function SettingsView({ state: s = {} } = {}) {
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

			return { "SettingsView": SettingsView };
		};

		// ── src/client/css.js ──
		__factories["src/client/css.js"] = function (__m, __exports) {
// src/client/css.js — 交互态样式表（面板里**唯一**能表达 :hover / :active 的地方）。
//
// 为什么必须有这个文件（0.13.1 的真故障）：
//   面板的样式基本都是 React 内联样式对象，而**内联样式的优先级高于任何选择器规则** ——
//   包括 `:hover` / `:active`。所以 0.13.0 之前所有按钮都没有悬停与按下反馈：
//   「↻ 刷新」「⇪ 导入本地」点下去毫无动静；配上当时偏灰的静态配色，
//   用户的第一反应就是「这些按钮是坏的」。
//
// 分工（别再揉在一起）：
//   · styles.js  → 颜色/尺度/几何（内联样式对象）
//   · css.js     → 交互态与"必须被选择器命中的外观"（一张注入的 <style>）
//   按钮的**静态外观**也放这里：底/描边/字色若留在内联里，`:hover` 永远压不过它。
//
// 约定：
//   · 颜色一律从 `styles.js` 的表里取（btnSkin / color），**不在这里另抄一份色值**。
//   · 选择器一律以面板根起头，绝不外溢到宿主的其它界面。
//   · DOM 单例：宿主会反复装配插件，查到已有 <style> 就收养，不重复插。
//   · 深色专属微调用 `:where(body[data-ds-dark-theme])` 降权重（见文件末尾说明）。

const { color, space, radius, font, tint, btnSkin, BTN_VARIANTS } = __m("src/client/styles.js");

/**
 * 面板根属性。**唯一定义处**（面板组件与样式表都以它为准）。
 * 改这个名字等于换掉整套样式的生效范围，两处会同时跟上。
 */
const PANEL_ATTR = 'data-dsh-web-novel-panel';

/** 注入的 <style> 元素 id（单例键）。 */
const STYLE_ID = 'dsh-web-novel-css';

const ROOT = `[${PANEL_ATTR}]`;

/** 宿主深色主题的开关：主题包就是这么切的（`body[data-ds-dark-theme]`）。 */
const DARK = ':where(body[data-ds-dark-theme])';

/** React style 对象 → CSS 声明串（camelCase → kebab-case）。 */
function decl(style) {
	return Object.entries(style)
		.filter(([, v]) => v !== undefined && v !== null && v !== '')
		.map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${v}`)
		.join(';');
}

/** 拼一条规则（选择器列表 + 声明串）。 */
const rule = (sel, style) => `${sel}{${decl(style)}}`;

/** 按钮三态：每个变体一条 rest + :hover + :active。 */
function buttonRules() {
	const out = [];
	for (const variant of BTN_VARIANTS) {
		const skin = btnSkin[variant];
		if (!skin) continue;
		const sel = `${ROOT} [data-nf-btn][data-variant="${variant}"]`;
		out.push(rule(sel, skin.rest));
		out.push(rule(`${sel}:hover:not(:disabled)`, skin.hover));
		out.push(rule(`${sel}:active:not(:disabled)`, {
			...skin.active,
			// "按下"的物理感：下沉 1px + 内阴影。**不改几何尺寸**，所以按钮不会跳。
			transform: 'translateY(1px)',
			boxShadow: 'inset 0 1px 3px rgba(0,0,0,.16)',
		}));
	}
	return out;
}

/** 组装整张样式表。纯函数，便于单测与预览复用。 */
function buildCss() {
	return [
		`/* dsh-web-novel 面板交互态（由 src/client/css.js 生成，勿手改）*/`,

		// ── 面板级主题变量（浅/深两套；styles.js 只给带浅色回退值的 var() 引用）──
		// 变量注在**面板根**上——不能注 :root/body：样式表每条规则必须锁在面板根内
		//（「面板根限定」护栏会拦）。深色与浅色同特异性（DARK 是 :where() 权重 0），
		// 靠后声明压过浅色；面板内所有 var() 引用照常继承，回退值兜 headless/未注入场景。
		// --nf-accent：前景金（文字/chip/焦点环/品牌块）。金是中亮度色，单一金值无法
		// 两主题同时过 4.5:1（浅色要暗金、深色要亮金）→ 分两档：
		// 浅 #a86200（白底 ≈4.7:1）/ 深 #f3a62a（暗底 ≈8.6:1）。
		rule(`${ROOT}`, {
			'--nf-elev-1': '0 1px 2px rgba(15,17,21,.05), 0 2px 8px rgba(15,17,21,.06)',
			'--nf-elev-2': '0 2px 6px rgba(15,17,21,.08), 0 8px 20px rgba(15,17,21,.08)',
			'--nf-accent': '#a86200',
		}),
		rule(`${DARK} ${ROOT}`, {
			'--nf-elev-1': '0 1px 2px rgba(0,0,0,.35), 0 2px 10px rgba(0,0,0,.28)',
			'--nf-elev-2': '0 2px 8px rgba(0,0,0,.40), 0 10px 24px rgba(0,0,0,.32)',
			'--nf-accent': '#f3a62a',
		}),

		// ── 按钮基座：三态的前提是"外观由 CSS 说了算" ──
		rule(`${ROOT} [data-nf-btn]`, {
			borderWidth: '1px', borderStyle: 'solid', borderColor: 'transparent',
			background: 'transparent', color: color.text,
			transition: 'background-color .13s ease, border-color .13s ease, color .13s ease, box-shadow .13s ease, transform .06s ease',
			WebkitTapHighlightColor: 'transparent',
			touchAction: 'manipulation', // 消除移动端双击缩放延迟
		}),
		// 焦点环给**所有**可点元素，不只 [data-nf-btn]：分段控件（详情页 tab）、
		// 书卡标题按钮（TAP）、头部 ⚙ 都是裸 <button>——没有这条，键盘用户
		// 在面板最高频的入口上是「聚焦了但看不见」。
		rule(`${ROOT} button:focus-visible, ${ROOT} summary:focus-visible`, {
			outline: `2px solid ${color.accent}`, outlineOffset: '1px',
		}),
		rule(`${ROOT} [data-nf-btn]:disabled`, { opacity: '.45', cursor: 'default' }),
		...buttonRules(),

		// ── 可点区域（卡片 / 目录行 / 分段控件 / 标题块）──
		// 这些元素的**底色来自内联 card()**，内联优先级更高 → hover/active 必须 `!important`
		// 才压得过。只压这两个伪类，常态外观一概不动。
		rule(`${ROOT} [data-nf-tap]`, {
			transition: 'background-color .13s ease, border-color .13s ease, box-shadow .13s ease, transform .06s ease',
			touchAction: 'manipulation',
		}),
		rule(`${ROOT} [data-nf-tap]:hover`, {
			background: `${color.hover} !important`,
			borderColor: `${color.border3} !important`,
			boxShadow: 'var(--nf-elev-2) !important',
			transform: 'translateY(-1px)',
		}),
		rule(`${ROOT} [data-nf-tap]:active`, {
			background: `${color.pressed} !important`,
			boxShadow: 'var(--nf-elev-1) !important',
			transform: 'translateY(1px)',
		}),

		// ── 分段控件（📋 基本信息 / 🎧 章节听书）──
		// 「选中」是**状态**不是伪类，所以用 `data-active` 表达，让 CSS 一次管好
		// rest / hover / active / selected 四态。四态都写在样式表里才不会互相打架
		//（之前底色与字色内联，选中项一悬停就会丢掉"选中"的样子）。
		rule(`${ROOT} [data-nf-seg]`, {
			background: 'transparent', color: color.text3, boxShadow: 'none',
			touchAction: 'manipulation',
		}),
		rule(`${ROOT} [data-nf-seg]:hover:not([data-active="1"])`, { background: color.hover }),
		rule(`${ROOT} [data-nf-seg]:active:not([data-active="1"])`, {
			background: color.pressed, transform: 'translateY(1px)',
		}),
		rule(`${ROOT} [data-nf-seg][data-active="1"]`, {
			background: color.surface3, color: color.text,
			boxShadow: `inset 0 0 0 1px ${color.border2}`,
		}),

		// ── 输入：聚焦要看得见（宿主右侧栏里全是输入框，没焦点环很难用）──
		rule(`${ROOT} input:focus, ${ROOT} textarea:focus, ${ROOT} select:focus`, {
			borderColor: `${color.accent} !important`,
			boxShadow: `0 0 0 2px ${tint(color.accent, 22)} !important`,
			outline: 'none',
		}),
		rule(`${ROOT} input, ${ROOT} textarea, ${ROOT} select`, {
			transition: 'border-color .13s ease, box-shadow .13s ease',
		}),
		rule(`${ROOT} ::placeholder`, { color: color.textDim }),

		// ── 折叠标题（原生 <details>，不吃事件代理）──
		rule(`${ROOT} summary:hover`, { color: `${color.text} !important` }),
		rule(`${ROOT} summary:focus-visible`, {
			outline: `2px solid ${color.accent}`, outlineOffset: '2px', borderRadius: `${radius.sm}px`,
		}),

		// ── 标题字重与行距（右侧栏窄，标题太轻会糊）──
		// ⚠️ 裸 <button> 的 UA 默认灰底（ButtonFace）会透出来 —— 书卡标题按钮走 TAP
		// 不走 Btn，0.13.1 里书名底下那条"灰色横条"就是它（用户看作"与下方重叠"）。
		// 这里统一抹掉 UA 外观；真按钮（[data-nf-btn] / [data-nf-seg]）的规则
		// 权重更高，不受影响。
		rule(`${ROOT} button`, { font: 'inherit', background: 'transparent', border: 'none' }),

		// ── 深色专属微调 ──
		// 用 `:where()` 把选择器权重降到 0，**否则会压过上面的 `:active` 内阴影**
		// （`body[data-x] [y]` 比 `[y]:active` 权重更高）。这类"降权重"是深色补丁的通用手法。
		rule(`${DARK} ${ROOT} [data-nf-tap]`, {
			boxShadow: 'var(--nf-elev-1), inset 0 1px 0 rgba(255,255,255,.05)',
		}),
		rule(`${DARK} ${ROOT} [data-nf-btn][data-variant="secondary"]`, {
			background: 'rgba(255,255,255,.05)',
			borderColor: 'rgba(255,255,255,.10)',
		}),
		rule(`${DARK} ${ROOT} [data-nf-btn][data-variant="secondary"]:hover:not(:disabled)`, {
			background: 'rgba(255,255,255,.10)',
			borderColor: 'rgba(255,255,255,.18)',
		}),

		`/* ── 尺度备查（改间距只动 styles.js，这里仅声明面板不引入外边距抖动）── */
${ROOT} *{box-sizing:border-box}
${ROOT} :where(h1,h2,h3,p){margin:0}
${ROOT} [data-nf-gap]{gap:${space.sm}px}
/* 窄栏里长单词/长路径不撑破布局 */
${ROOT} :where(span,div,p,code){overflow-wrap:anywhere}`,

		// ── 动效弱化（系统开了「减少动态效果」时）──
		// 位移与过渡都停：悬停抬升与按下下沉一并归零，反馈只剩内阴影/底色，信息不丢、不晃。
		// 收成单行：静态自检要求每条含 `{` 的行都带面板根限定，@media 独占一行会破例。
		`@media (prefers-reduced-motion: reduce){${ROOT} [data-nf-btn],${ROOT} [data-nf-tap],${ROOT} [data-nf-seg],${ROOT} input,${ROOT} textarea,${ROOT} select{transition:none}${ROOT} [data-nf-btn]:active:not(:disabled),${ROOT} [data-nf-tap]:hover,${ROOT} [data-nf-tap]:active,${ROOT} [data-nf-seg]:active:not([data-active="1"]){transform:none}}`,
	].join('\n');
}

/**
 * 注入样式表（**DOM 单例**）。
 *
 * 反复装配是宿主的常态（切会话/重挂载都会再走一次 apply），
 * 所以这里必须先查后插：查到就收养，绝不插第二份。
 * 拿不到 document / head 时返回 null（headless 测试与非浏览器环境），不抛错。
 *
 * @param {Document} [doc] 便于测试注入假 document
 * @returns {HTMLElement|null} 样式元素
 */
function ensureStyles(doc = globalThis.document) {
	if (!doc) return null;
	let existing = null;
	try {
		existing = doc.getElementById ? doc.getElementById(STYLE_ID) : null;
		if (!existing && doc.querySelector) existing = doc.querySelector(`#${STYLE_ID}`);
	} catch { existing = null; }
	// 已存在但内容变了（热更新/版本升级）→ 就地更新，不新增节点
	if (existing) {
		const css = buildCss();
		if (existing.textContent !== css) existing.textContent = css;
		return existing;
	}
	let el = null;
	try { el = doc.createElement('style'); } catch { return null; }
	if (!el) return null;
	try {
		el.id = STYLE_ID;
		el.textContent = buildCss();
	} catch { /* 假 DOM 可能只读，忽略 */ }
	const host = doc.head ?? doc.body ?? null;
	if (!host || typeof host.appendChild !== 'function') return null;
	try { host.appendChild(el); } catch { return null; }
	return el;
}

			return { "PANEL_ATTR": PANEL_ATTR, "STYLE_ID": STYLE_ID, "buildCss": buildCss, "ensureStyles": ensureStyles };
		};

		// ── src/client/controllers/chapters.js ──
		__factories["src/client/controllers/chapters.js"] = function (__m, __exports) {
// src/client/controllers/chapters.js — 章正文域：读章 / 存章 / 导出 txt。
// 从 panel.js 的 createForgeController 按域拆出，只依赖共享 ctx（state/notify/seq），
// 不反向依赖其它域。陈旧响应守卫用 ctx.seq.chapter（章级请求序号）。
const { apiFetch } = __m("src/client/api.js");

function createChaptersController(ctx) {
	const { state, notify, seq } = ctx;

	const loadChapter = async (no) => {
		if (!state.selected) return;
		const mine = ++seq.chapter;
		state.chapterNo = no; state.discardPending = null; state.saveBlocked = ''; notify();
		try {
			const text = await apiFetch(`/projects/${encodeURIComponent(state.selected)}/chapters/${no}`);
			if (mine !== seq.chapter) return; // 期间已切章/切书：丢弃陈旧正文
			state.baseline = text ?? ''; state.draft = text ?? ''; state.draftVersion++;
			state.draftModified = false; state.undoStack = [];
		} catch {
			if (mine !== seq.chapter) return; // 陈旧失败的报错也不许覆盖新章
			// 读不到正文不能静默——给一句人话，别让用户以为这一章是空的
			state.baseline = ''; state.draft = ''; state.draftVersion++;
			state.error = `读取第 ${no} 章失败（刷新或检查服务）`;
			console.warn('[dsh-web-novel] 读取章节失败', state.error);
		}
		notify();
	};

	const saveChapter = async ({ force = false } = {}) => {
		if (!state.selected) return;
		// M13 修复：await 期间用户可能已切书/切章/继续打字——保存完成后先核对
		// 「还是这本书的这一章、编辑器正文也还是存出去的那份」，再标记干净
		const bookId = state.selected;
		const no = state.chapterNo;
		const snapshot = state.draft;
		try {
			await apiFetch(`/projects/${encodeURIComponent(bookId)}/chapters/${no}`, {
				// title 不再送占位值：服务端缺省时沿用索引里的原标题（旧实现每次 POST
				// 都写「第 N 章」，存一次就把真标题抹掉一次）。
				method: 'POST', body: JSON.stringify({ text: snapshot, ...(force ? { force: true } : {}) }),
			});
			if (state.selected === bookId && state.chapterNo === no && state.draft === snapshot) {
				state.saveBlocked = '';
				state.notice = `已保存：第 ${no} 章`;
				state.baseline = snapshot; state.draftModified = false; state.undoStack = [];
			} else {
				state.notice = `已保存：第 ${no} 章——但编辑器已切走或继续改动，当前改动仍未保存`;
			}
		} catch (error) {
			if (state.selected !== bookId || state.chapterNo !== no) return;   // 陈旧失败的报错也不许覆盖新章
			if (error?.code === 'GATE_REJECTED') {
				// 门禁拦下 ≠ 服务故障：原文摆出来（判定逐条可执行），再给「仍要保存」
				// 二次确认。字数线这类硬判定 force 也顶不开——服务端会再回 409，
				// 文案自会说明还差多少，不靠这里猜。
				state.saveBlocked = String(error?.message ?? error);
				state.error = '';
			} else { state.error = String(error?.message ?? error); }
		}
		notify();
	};

	const exportProject = async () => {
		if (!state.selected) return;
		state.exporting = true; notify();
		try {
			const result = await apiFetch(`/projects/${encodeURIComponent(state.selected)}/export`, { method: 'POST', body: JSON.stringify({ format: 'txt' }) });
			const blob = new Blob(['\uFEFF' + result.content], { type: 'text/plain;charset=utf-8' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url; a.download = result.fileName;
			document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
			state.notice = `已导出：${result.fileName}`;
		} catch (error) { state.error = String(error?.message ?? error); }
		finally { state.exporting = false; notify(); }
	};

	return { loadChapter, saveChapter, exportProject };
}
			return { "createChaptersController": createChaptersController };
		};

		// ── src/client/controllers/lore.js ──
		__factories["src/client/controllers/lore.js"] = function (__m, __exports) {
// src/client/controllers/lore.js — 世界书面板域：列 / 存 / 删 / 启用停用。
// 从 panel.js 的 createForgeController 按域拆出；只依赖共享 ctx（state/notify）。
const { apiFetch } = __m("src/client/api.js");
const { sameEntryId } = __m("lib/store.js");
const { emptyLoreForm } = __m("src/client/state.js");

function createLoreController(ctx) {
	const { state, notify } = ctx;

	const loadLoreEntries = async (bookId) => {
		try { state.loreEntries = await apiFetch(`/worldbook/${encodeURIComponent(bookId)}`); }
		catch { state.loreEntries = []; }
		notify();
	};

	const saveLoreEntry = async () => {
		const f = state.loreForm;
		if (!f.name.trim()) { state.error = '条目名称不能为空'; notify(); return; }
		state.loreBusy = true; notify();
		try {
			const bookId = state.selected || f.bookId || 'default';
			const body = JSON.stringify({
				name: f.name, content: f.content, keywords: f.keywords,
				always_active: f.alwaysActive, enabled: f.enabled, priority: Number(f.priority),
			});
			if (f.mode === 'new') await apiFetch(`/worldbook/${encodeURIComponent(bookId)}`, { method: 'POST', body });
			else if (f.mode === 'edit') await apiFetch(`/worldbook/${encodeURIComponent(bookId)}/${f.id}`, { method: 'PUT', body });
			state.loreForm = emptyLoreForm();
			await loadLoreEntries(bookId);
		} catch (error) { state.error = String(error?.message ?? error); }
		finally { state.loreBusy = false; notify(); }
	};

	const deleteLoreEntry = async (entryId) => {
		const bookId = state.selected || 'default';
		try { await apiFetch(`/worldbook/${encodeURIComponent(bookId)}/${entryId}`, { method: 'DELETE' }); await loadLoreEntries(bookId); }
		catch (error) { state.error = String(error?.message ?? error); notify(); }
	};

	const toggleLoreEntry = async (entryId) => {
		const bookId = state.selected || 'default';
		// 条目 id 是字符串（工具默认 W1/W2）——严禁 Number 强转（'W1'→NaN 永不命中，
		// 「启用/停用」对工具生成的条目会静默失效：点了没反应）。一律按字符串比较。
		const entry = state.loreEntries.find((e) => sameEntryId(e.id, entryId));
		if (!entry) { state.error = `找不到要切换的世界书条目（id "${entryId ?? ''}"）`; notify(); return; }
		try {
			await apiFetch(`/worldbook/${encodeURIComponent(bookId)}/${entryId}`, { method: 'PUT', body: JSON.stringify({ enabled: !entry.enabled }) });
			await loadLoreEntries(bookId);
		} catch (error) { state.error = String(error?.message ?? error); notify(); }
	};

	return { loadLoreEntries, saveLoreEntry, deleteLoreEntry, toggleLoreEntry };
}
			return { "createLoreController": createLoreController };
		};

		// ── src/client/controllers/proposals.js ──
		__factories["src/client/controllers/proposals.js"] = function (__m, __exports) {
// src/client/controllers/proposals.js — 提案队列域：拉取 / 应用 / 丢弃 / 展开全文。
// 从 panel.js 的 createForgeController 按域拆出；应用后要刷目录与正文，
// 因此经 ctx 晚绑定调用 ctx.loadChapterList / ctx.loadChapter（不直接 import，解环）。
const { apiFetch } = __m("src/client/api.js");

function createProposalsController(ctx) {
	const { state, notify, seq } = ctx;

	/** 拉提案队列（待批准的修订稿）。 */
	const loadProposals = async (id) => {
		const bookId = id || state.selected;
		if (!bookId) return;
		const mine = seq.open;
		state.proposalsLoading = true; state.proposalsError = null; notify();
		try {
			const value = await apiFetch(`/projects/${encodeURIComponent(bookId)}/proposals`);
			if (mine !== seq.open) return; // 期间已切书：丢弃陈旧提案队列
			state.proposals = Array.isArray(value?.proposals) ? value.proposals : [];
		} catch (error) {
			// 加载失败 ≠ 没有待批：必须留痕可辨（2026-09-23 真机教训——失败曾被静默
			// 渲染成「没有待批的修订」，用户盯着空列表误以为提案被吞了几天）
			if (mine === seq.open) { state.proposals = []; state.proposalsError = String(error?.message ?? error); }
		}
		finally { if (mine === seq.open) { state.proposalsLoading = false; notify(); } }
	};

	/** 应用提案：生成新版本（旧版保留），审计 actor 记 'user'。 */
	const applyProposalAction = async (proposalId) => {
		if (!state.selected || !proposalId) return;
		// 跨书竞态守卫（CodeBuddy 审计 2026-10-09）：应用请求可能很慢，期间用户切书，
		// 迟到的写回会把 A 书的 notice/gateNotice/编辑器状态挂到 B 书头上。
		const bookId = state.selected;
		state.proposalBusy = proposalId; state.error = ''; notify();
		try {
			const value = await apiFetch(`/projects/${encodeURIComponent(bookId)}/proposals/${encodeURIComponent(proposalId)}/apply`, { method: 'POST' });
			if (state.selected !== bookId) return; // 已切书：结果作废，不污染新书状态
			state.notice = `已应用提案 ${proposalId}：第${value.chapter}章 v${value.version}（旧版保留）`;
			// 服务端已把这版正文过了一遍内容门禁（lib/proposals.js）：应用是用户主权不拦，
			// 但「改出了死人复活/隐藏人物泄底」必须当场看见。gate 为 null = 门禁输入读不到，跳过。
			const gate = value.gate;
			state.gateNotice = gate && ((gate.blocking?.length ?? 0) > 0 || (gate.warnings?.length ?? 0) > 0)
				? { chapter: value.chapter, version: value.version, ...gate }
				: null;
			if (state.gateNotice) {
				const bits = [...(state.gateNotice.blocking ?? []), ...(state.gateNotice.warnings ?? [])];
				state.notice += ` ⚠ 门禁提示 ${bits.length} 条（详见下方）`;
			}
			await Promise.all([loadProposals(bookId), ctx.loadChapterList(bookId)]);
			if (state.selected !== bookId) return;
			// 提示与正文必须对齐：应用的是第 N 章，编辑器却停在第一章，会出现
			// 「本章编辑」区挂着第 N 章的提示、下面却是第 1 章的怪相。故把编辑器切到被改的那一章：
			//   · 正开着该章 → 重新载入取新版本（旧分支行为不变）；
			//   · 别的章有未保存草稿 → 不静默丢弃，挂起交给视图的「丢弃改动 / 取消」；
			//   · 否则直接切过去。
			const targetChapter = Number(value.chapter);
			if (!Number.isFinite(targetChapter) || targetChapter <= 0) {
				// 服务端没回章号 = 拿不到目标章，别猜（Number(undefined)=NaN 会切到幽灵章）
				state.notice += '；未拿到被改的章号，编辑器未切换';
				console.warn('[dsh-web-novel] 应用提案返回的 chapter 非法：', value.chapter);
			} else if (state.chapterNo === targetChapter) {
				await ctx.loadChapter(targetChapter);
			} else if (state.draftModified) {
				state.discardPending = { kind: 'chapter', no: targetChapter };
				state.notice += `；第 ${state.chapterNo} 章有未保存改动，确认后切到第 ${targetChapter} 章`;
			} else {
				await ctx.loadChapter(targetChapter);
				state.notice += `；已切到第 ${targetChapter} 章`;
			}
		} catch (error) { if (state.selected === bookId) state.error = String(error?.message ?? error); }
		finally { state.proposalBusy = null; notify(); }
	};

	/** 丢弃提案：正文不动，提案转 discarded（同样只从面板触发）。 */
	const discardProposalAction = async (proposalId) => {
		if (!state.selected || !proposalId) return;
		state.proposalBusy = proposalId; state.error = ''; notify();
		try {
			await apiFetch(`/projects/${encodeURIComponent(state.selected)}/proposals/${encodeURIComponent(proposalId)}/discard`, { method: 'POST' });
			state.notice = `已丢弃提案 ${proposalId}`;
			if (state.proposalDetail?.id === proposalId) state.proposalDetail = null;
			await loadProposals(state.selected);
		} catch (error) { state.error = String(error?.message ?? error); }
		finally { state.proposalBusy = null; notify(); }
	};

	/** 展开/收起单条提案全文——应用前让人看清楚到底改了什么。
	 *  0.13.1 之前提案卡只有「第 N 章」三个字，看不出提案要干嘛（仙尊实测反馈）。 */
	const toggleProposalDetail = async (proposalId) => {
		if (!state.selected) return;
		if (!proposalId) {
			state.error = '拿不到提案号（查看钮上应有 data-id）';
			notify();
			return;
		}
		// 再点一次收起
		if (state.proposalDetail?.id === proposalId && !state.proposalDetail.loading) {
			state.proposalDetail = null; notify();
			return;
		}
		state.proposalDetail = { id: proposalId, loading: true, data: null, error: '' }; notify();
		try {
			const value = await apiFetch(`/projects/${encodeURIComponent(state.selected)}/proposals/${encodeURIComponent(proposalId)}`);
			if (state.proposalDetail?.id !== proposalId) return; // 期间已点别条/换书：丢弃陈旧响应
			state.proposalDetail = { id: proposalId, loading: false, data: value, error: '' };
		} catch (error) {
			if (state.proposalDetail?.id !== proposalId) return;
			state.proposalDetail = { id: proposalId, loading: false, data: null, error: String(error?.message ?? error) };
		} finally { notify(); }
	};

	/** 页面重新可见/聚焦时的提案重拉：写作会话随时可能提交新提案，而队列只在
	 *  开书/应用动作时加载——挂着面板的用户看到的永远是打开那一刻的快照
	 *  （真机 10-04 实锤：写作会话新建 P45/P48/P49，用户面板停在旧空态）。
	 *  只在详情态且无在途动作时执行；loadProposals 同步置 proposalsLoading，
	 *  visibilitychange+focus 连发也不会双拉。 */
	const refreshProposalsIfIdle = () => {
		if (state.view !== 'detail' || !state.selected) return;
		if (state.proposalsLoading || state.proposalBusy) return;
		loadProposals(state.selected);
	};

	return { loadProposals, applyProposalAction, discardProposalAction, toggleProposalDetail, refreshProposalsIfIdle };
}
			return { "createProposalsController": createProposalsController };
		};

		// ── src/client/controllers/projects.js ──
		__factories["src/client/controllers/projects.js"] = function (__m, __exports) {
// src/client/controllers/projects.js — 项目域：列表/详情加载、创建认领改名克隆删除、
// 旁路引擎（润色/校对）、全书体检、黄金三章诊断、批量起草。
// 从 panel.js 的 createForgeController 按域拆出。跨域动作（章正文、提案、目录）经 ctx
// 晚绑定调用，避免模块间循环 import。
const { apiFetch } = __m("src/client/api.js");

function createProjectsController(ctx) {
	const { state, notify, syncSession, withSession, seq, player } = ctx;

	/** 拉小说基本要素（基本信息标签的展示数据）；缺失要素是常态，失败置空即可。 */
	const loadElements = async (id) => {
		const bookId = id || state.selected;
		if (!bookId) return;
		const mine = seq.open;
		state.elementsLoading = true; notify();
		try {
			const elements = await apiFetch(`/projects/${encodeURIComponent(bookId)}/elements`);
			if (mine !== seq.open) return; // 期间已切书：丢弃陈旧要素
			state.elements = elements;
		} catch { if (mine === seq.open) state.elements = null; }
		finally { if (mine === seq.open) { state.elementsLoading = false; notify(); } }
	};

	/** 拉章节目录（听书列表 + 连播边界）。 */
	const loadChapterList = async (id) => {
		const bookId = id || state.selected;
		if (!bookId) return;
		const mine = seq.open;
		state.chapterListLoading = true; notify();
		try {
			const list = await apiFetch(`/projects/${encodeURIComponent(bookId)}/chapters`);
			if (mine !== seq.open) return; // 期间已切书：丢弃陈旧目录
			state.chapterList = list;
		} catch { if (mine === seq.open) state.chapterList = []; }
		finally { if (mine === seq.open) { state.chapterListLoading = false; notify(); } }
	};

	const refreshProjects = async () => {
		syncSession();
		state.loading = true; state.error = ''; notify();
		// 探针日志：用户卡「加载中」时，console 里有没有这行 + 后面有没有收尾，直接分诊
		console.info('[dsh-web-novel] GET /projects' + (state.sessionId ? `?session=${state.sessionId}` : '（无会话）'));
		try {
			// scope='all' 时不带 session 参数——多会话工作流里别的会话建的书也要能看（头部 chip 可切换）
			const scopedUrl = state.sessionId && state.sessionScope !== 'all' ? withSession('/projects') : '/projects';
			state.projects = await apiFetch(scopedUrl);
			// 回落：会话过滤为空但全量有书 → 显示全部。宿主 slot inject 给的会话
			// 标识与工具写入 novel.json 的 session id 可能不同源（0.13.2 真机实锤：
			// session-watch 用 sessions 服务的 id 能探到书、slot 的 id 过滤却是空），
			// 与其让用户对着「还没有项目」发呆，不如摊开全部书让他点开。
			if (state.projects.length === 0 && state.sessionId) {
				state.projects = await apiFetch('/projects');
				state.sessionFallback = state.projects.length > 0;
			} else {
				state.sessionFallback = false;
			}
		} catch (error) {
			state.error = String(error?.message ?? error);
			console.warn('[dsh-web-novel] 项目列表加载失败：', state.error);
		} finally {
			state.loading = false; notify();
		}
		// 未归属的旧书（0.5.0 之前建的没有会话戳）：单独拿一份，给个认领入口
		try {
			state.unclaimed = state.sessionId ? await apiFetch('/projects?scope=unclaimed') : [];
		} catch { state.unclaimed = []; }
		notify();
	};

	const claimProject = async (id) => {
		if (!state.sessionId) { state.error = '未能识别当前会话，无法认领'; notify(); return; }
		state.busy = true; notify();
		try {
			await apiFetch('/projects/claim', {
				method: 'POST',
				body: JSON.stringify({ session: state.sessionId, ids: id ? [id] : undefined }),
			});
			state.notice = id ? `已认领：${id}` : '已把未归属的书认领到本会话';
			await refreshProjects();
		} catch (error) { state.error = String(error?.message ?? error); }
		finally { state.busy = false; notify(); }
	};

	/** 改名：只改 novel.json.title（目录名=id 是稳定身份，不挪），改完刷新列表并同步正在看的书。 */
	const renameProject = async () => {
		const r = state.rename;
		if (!r || !r.id) return;
		const title = String(r.value ?? '').trim();
		if (!title) { state.error = '书名不能为空'; notify(); return; }
		state.renaming = true; state.error = ''; notify();
		try {
			await apiFetch(`/projects/${encodeURIComponent(r.id)}/rename`, {
				method: 'POST', body: JSON.stringify({ title }),
			});
			state.notice = `已改名：${title}`;
			state.rename = null;
			await refreshProjects();
			if (state.selected === r.id) await ctx.openProject(r.id); // 详情页正开着这本书，回头刷标题
		} catch (error) { state.error = String(error?.message ?? error); }
		finally { state.renaming = false; notify(); }
	};

	/** 克隆为模板：老书连章节带资产复制成新书（REST 走 lib/clone.js 共享核心）。
	 *  新书目录名必填（是稳定身份，同书名规则）；成功后刷新列表，新书带会话戳直接出现。 */
	const cloneProject = async () => {
		const c = state.clone;
		if (!c || !c.id) return;
		const newBook = String(c.value ?? '').trim();
		if (!newBook) { state.error = '新书目名不能为空'; notify(); return; }
		state.cloning = true; state.error = ''; notify();
		try {
			const v = await apiFetch(`/projects/${encodeURIComponent(c.id)}/clone`, {
				method: 'POST', body: JSON.stringify({ newBook, title: newBook, session: state.sessionId ?? undefined }),
			});
			state.notice = v?.next ?? `已克隆：${c.id} → ${newBook}`;
			state.clone = null;
			await refreshProjects();
		} catch (error) { state.error = String(error?.message ?? error); }
		finally { state.cloning = false; notify(); }
	};

	/** 列表删除：软删（服务端清 novel.json 标记非书）。 */
	const deleteListProject = async (id) => {
		// 用独立的 listDeleting，而不是往 listDeleteId 里塞 'busy'：
		// 确认行按 `listDeleteId === p.name` 渲染，哨兵会让整行在请求期间消失（闪烁），
		// 并把视图里「删除中…」的禁用分支变成死代码。
		if (state.listDeleting) return;
		state.listDeleting = true; notify();
		try {
			await apiFetch(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
			state.notice = `已删除：${id}`;
			if (state.selected === id) { state.selected = null; state.detail = null; state.chapterList = []; }
			state.listDeleteId = null;
			await refreshProjects();
		} catch (error) { state.error = String(error?.message ?? error); }
		finally { state.listDeleting = false; notify(); }
	};

	const openProject = async (id) => {
		const myOpen = ++seq.open;
		// 换书必然换章内容：使所有在途 loadChapter 的响应作废（它们的 seq 已过期）
		const myChapter = ++seq.chapter;
		state.selected = id; state.view = 'detail'; state.detail = null; state.chapterNo = 1;
		state.draft = ''; state.error = ''; state.detailTab = 'info';
		state.elements = null; state.discardPending = null; state.rename = null; state.listDeleteId = null; state.clone = null;
		// 字数卡与报错都属于「上一本书」：不清就会把 A 书的 400 挂在 B 书头上。
		// charsValue 清成 **undefined**（不是 ''）：'' 是「用户明确清除」，此处只是
		// 「新书的值还没拿到」，两者语义不同（见 state.js 注释与 saveBookChars 兜底）。
		state.charsValue = undefined; state.charsError = ''; state.charsSaving = false;
		// deleteState 属于「上一本书的删除确认」：漏清会让 B 书的「删除」单击直接生效
		//（两步确认跨书泄漏）。gateNotice/listDeleting 同理，都是上一本书的残留。
		state.deleteState = null; state.gateNotice = null; state.saveBlocked = ''; state.listDeleting = false;
		state.proposals = []; state.proposalsError = null; state.proposalBusy = null; state.proposalDetail = null; // 展开的全文也属于上一本书
		state.copiedHandoff = false; // 交接摘要的「已复制」反馈同样属于上一本书
		state.rotatePending = false; // 轮换的两段确认同样属于上一本书
		// 换书：体检结果与批量结果都属于「上一本书」，必须清掉（否则会把 A 书的红字
		// 挂在 B 书头上——这类串台比不显示更糟）
		state.continuity = null; state.continuityError = ''; state.batchResult = null; state.revising = null;
		state.dashboard = null; state.dashboardError = '';
		state.diagnosis = null; state.diagnosisError = '';
		state.reader = null; // 阅读器也属于「上一本书」
		state.readerOverlay = null; // 宽屏浮层同样属于「上一本书」
		state.fusionStatus = null; state.fusionError = ''; state.fusionLoading = false;
		player.stop();
		notify();
		// detail 与 第 1 章正文并行拉；elements/chapters 由以下并行加载
		try {
			const [detail, text] = await Promise.all([
				apiFetch(withSession(`/projects/${encodeURIComponent(id)}`)),
				apiFetch(`/projects/${encodeURIComponent(id)}/chapters/1`).catch(() => ''),
			]);
			if (myOpen !== seq.open) return; // 期间已打开别的书：整体作废
			state.detail = detail;
			// 双轨状态随详情一起回来（布局/版本策略/.git/进度）——零额外请求
			state.fusionStatus = detail?.fusion ?? null;
			// 字数输入框用服务端现值初始化（盘上的真值，不是空串）。此前恒为 ''：
			// 输入框靠 defaultValue 显示着「2500-3500」，state 里却记着空——用户没碰
			// 输入框直接点「保存」，就把自定义区间清掉了（静默破坏，无报错无提示）。
			// charView 缺失（详情拉失败/旧版回包）时留 undefined，由 saveBookChars 兜底。
			state.charsValue = detail?.charView ? (detail.charView.charLimits ?? '') : undefined;
			// 章正文只在「期间没有更晚的 loadChapter 抢先」时才写——否则会把第 1 章
			// 内容盖到用户刚点的章上（章号与正文错位）
			if (myChapter === seq.chapter) {
				state.baseline = text ?? ''; state.draft = text ?? '';
				state.draftVersion++; state.draftModified = false; state.undoStack = [];
			}
		} catch (error) { if (myOpen === seq.open) state.error = String(error?.message ?? error); }
		if (myOpen !== seq.open) return; // 失败路径同样不再追拉旧书的目录/要素/提案
		notify();
		await Promise.all([loadChapterList(id), loadElements(id), ctx.loadProposals(id), loadDashboard(id)]);
		if (myOpen !== seq.open) return; // 期间已切书：定位逻辑作废，避免把 A 书的章号盖到 B 书
		// 默认定位到最新已落盘章（而非第 1 章）：打开书通常是要「接着写」
		const maxNo = (state.chapterList ?? []).reduce((m, c) => Math.max(m, c.no ?? 0), 0);
		if (maxNo > 1 && state.chapterNo === 1) await ctx.loadChapter(maxNo);
		notify();
	};

	const createProject = async () => {
		if (!state.title.trim()) { state.error = '请先输入书名'; notify(); return; }
		state.creating = true; state.error = ''; notify();
		try {
			await apiFetch('/projects', {
				method: 'POST',
				// 创建即打会话戳：面板按会话过滤时它才会出现在本会话里
				// 题材：面板没有题材输入框，留空就不传（服务端默认「未分类」），
				// 别再学早期把 'fantasy' 写死在默认值里（书卡上全是英文 chip 的来历）。
				// chars：开书时收集的每章字数（用户 2026-10-20）——留空＝不设，
				// 服务端会回落到平台口径/插件默认；写错了服务端回 400，原样摆在 error 上。
				body: JSON.stringify({
					title: state.title.trim(),
					genre: state.genre.trim() || undefined,
					session: state.sessionId ?? undefined,
					...(state.newChars.trim() ? { chars: state.newChars.trim() } : {}),
				}),
			});
			state.title = ''; state.newChars = ''; state.titleReset = (state.titleReset ?? 0) + 1; await refreshProjects();
		} catch (error) { state.error = String(error?.message ?? error); }
		finally { state.creating = false; notify(); }
	};

	/**
	 * 设置/清除本书每章字数区间（详情卡「本章字数」）。
	 * 落库的是 novel.json.charLimits——面板、模型工具、批量起草之后读到的是同一个值，
	 * 这里只负责把新值写进去并**就地刷新显示**（不整页重拉：重拉会冲掉用户的编辑现场）。
	 * @param {string|null} spec 「2500-3500」；null/'' = 清除自定义
	 */
	const saveBookChars = async (specArg) => {
		const bookId = state.selected;
		if (!bookId) { state.charsError = '先打开一本书再设置字数'; notify(); return; }
		// undefined = 输入框从未被编辑过（详情也没拿到 charView）——按服务端现值原样保存，
		// 绝不退化成「清空」：空串会让服务端删掉 charLimits，等于用户什么都没点就丢了
		// 自定义区间。只有显式的 ''（清除按钮 / 手动清空输入框）才真的清除。
		const spec = specArg === undefined ? (state.detail?.charView?.charLimits ?? '') : specArg;
		state.charsSaving = true; state.charsError = ''; notify();
		try {
			// 路径不用手工带 session：/projects/:id/… 属书作用域，apiFetch 自动附加
			const value = await apiFetch(`/projects/${encodeURIComponent(bookId)}/chars`, {
				method: 'POST',
				body: JSON.stringify({ chars: spec ?? '' }),
			});
			// charView 是服务端算好的「生效区间 + 出处」，直接用回包刷新这张卡
			if (state.detail) state.detail = { ...state.detail, charView: value };
			// 保存后把 state 同步成服务端真值：输入框靠 key 重挂显示新值，state 若还留着
			// 旧字符串，下一次「保存」会把它当成新改动又写一遍（甚至把刚清掉的写回去）。
			state.charsValue = value?.charLimits ?? '';
			state.notice = value?.charLimits
				? `本章字数已设为 ${value.charMin}–${value.charMax}（出处：${charsSourceText(value.charSource)}）`
				: `已清除自定义——回到 ${value?.charMin ?? '?'}–${value?.charMax ?? '?'} 字（${charsSourceText(value?.charSource)}）`;
		} catch (error) {
			// 校验失败（半套区间、越界、倒挂）是请求的问题：原文摆出来，不许吞成「保存失败」
			state.charsError = String(error?.message ?? error);
		} finally {
			state.charsSaving = false; notify();
		}
	};

	/** charSource（'custom'|'platform'|'config'）→ 人话。与 lib/store.js 的措辞保持一致。 */
	const charsSourceText = (source) => (source === 'custom' ? '本书自定义'
		: source === 'platform' ? '投放平台口径' : '插件默认');

	/**
	 * 本书设置（1.8）：字数区间 / 投放平台 / logline 一次提交。
	 * 服务端 POST /projects/:id/settings 三字段都可选、只传要改的；任一项不合法整单拒绝。
	 * chars 的 undefined / '' 语义与 saveBookChars 同一纪律：undefined=不动，''=清除。
	 */
	const saveBookSettings = async ({ chars, platform, logline } = {}) => {
		const bookId = state.selected;
		if (!bookId) { state.settingsError = '先打开一本书再改设置'; notify(); return; }
		const body = {};
		if (chars !== undefined) body.chars = chars;
		if (platform !== undefined) body.platform = platform;
		if (logline !== undefined) body.logline = logline;
		state.settingsSaving = true; state.settingsError = ''; state.settingsOk = ''; notify();
		try {
			const value = await apiFetch(`/projects/${encodeURIComponent(bookId)}/settings`, {
				method: 'POST',
				body: JSON.stringify(body),
			});
			// 设置页与概览共用 state.detail：回包是服务端算好的真值，直接刷新对应字段
			if (state.detail) {
				state.detail = {
					...state.detail,
					logline: value.logline ?? '',
					charView: {
						charMin: value.charMin, charMax: value.charMax, charSource: value.charSource,
						...(value.charLimits ? { charLimits: value.charLimits } : {}),
					},
					fusion: { ...(state.detail.fusion ?? {}), platform: value.platform ?? '', platformName: value.platformName ?? '' },
				};
			}
			// 概览页的字数卡也吃这份 state（保存后返回详情不再显示旧值）
			state.charsValue = value.charLimits ?? '';
			state.settingsOk = '已保存 ✓';
		} catch (error) {
			state.settingsError = String(error?.message ?? error);
		} finally {
			state.settingsSaving = false; notify();
		}
	};

	const deleteProject = async () => {
		if (!state.selected) return;
		state.deleteState = 'busy'; notify();
		try {
			await apiFetch(`/projects/${encodeURIComponent(state.selected)}`, { method: 'DELETE' });
			player.stop();
			state.selected = null; state.view = 'projects'; state.detail = null; state.chapterList = [];
			await refreshProjects();
		} catch (error) {
			state.error = String(error?.message ?? error);
			state.deleteState = 'confirm'; // L17：失败退回确认态，不在按钮上闪一下又消失
		}
		notify();
	};

	/** 真正返回项目列表。 */
	const goBack = async () => {
		player.stop(); state.view = 'projects'; state.selected = null; state.detail = null;
		state.discardPending = null; state.draftModified = false; state.rename = null; state.listDeleteId = null; state.clone = null;
		state.deleteState = null; state.gateNotice = null; state.saveBlocked = '';
		await refreshProjects();
	};

	/** 全书体检：死人复活 / 账本矛盾 / 伏笔超期 / 章号断档 / 人物卡缺失。零 token。 */
	const loadContinuity = async () => {
		if (!state.selected) return;
		const mine = seq.open;
		state.continuityLoading = true; state.continuityError = ''; notify();
		try {
			const result = await apiFetch(`/projects/${encodeURIComponent(state.selected)}/continuity`);
			if (mine !== seq.open) return; // 期间已切书：丢弃陈旧体检（M12）
			state.continuity = result;
		} catch (error) {
			if (mine !== seq.open) return;
			state.continuity = null;
			state.continuityError = String(error?.message ?? error);
		} finally { if (mine === seq.open) { state.continuityLoading = false; notify(); } }
	};

	/** 创作驾驶舱：把进度/体检/大纲/提案/口径折成同一块“下一步”。失败可见，不装作健康。 */
	const loadDashboard = async (id) => {
		const bookId = id || state.selected;
		if (!bookId) return;
		const mine = seq.open;
		state.dashboardLoading = true; state.dashboardError = ''; notify();
		try {
			const result = await apiFetch(`/projects/${encodeURIComponent(bookId)}/dashboard`);
			if (mine !== seq.open) return;
			state.dashboard = result;
		} catch (error) {
			if (mine !== seq.open) return;
			state.dashboard = null;
			state.dashboardError = String(error?.message ?? error);
		} finally {
			if (mine === seq.open) { state.dashboardLoading = false; notify(); }
		}
	};

	/** 黄金三章诊断：钩子/开场/冲突/灌输四维数字。与 novel_diagnose 同一纯函数，零 token。 */
	const loadDiagnosis = async () => {
		if (!state.selected || state.diagnosisLoading) return;
		const mine = seq.open;
		state.diagnosisLoading = true; state.diagnosisError = ''; notify();
		try {
			const result = await apiFetch(`/projects/${encodeURIComponent(state.selected)}/diagnose`);
			if (mine !== seq.open) return; // 期间已切书：丢弃陈旧诊断（M12）
			state.diagnosis = result;
		} catch (error) {
			if (mine !== seq.open) return;
			state.diagnosis = null;
			state.diagnosisError = String(error?.message ?? error);
		} finally { if (mine === seq.open) { state.diagnosisLoading = false; notify(); } }
	};

	// ── 旁路引擎动作（0.13.0 · 融合第五批 D1）────────────────────────────────
	//
	// 润色/校对走服务端的 /polish 与 /proofread：**引擎在服务端**（插件已拿到 ctx.llm），
	// 所以面板侧不需要任何 key。两条纪律：
	//   ① 产物是**提案** —— 面板只发起、只提示「去哪里批准」，绝不直接落正文；
	//   ② 超时要放宽：服务端通道超时 180s 且默认重试 2 次，用通用的 12s 会把
	//      正常的长任务一律误报成「请求超时」。
	const REVISION_TIMEOUT_MS = 600_000;

	/** 把服务端的语义化错误码翻成人话（503/409/422/499 各有各的处置办法）。 */
	const revisionErrorText = (error, mode) => {
		const raw = String(error?.message ?? error);
		const what = mode === 'proofread' ? '校对' : '润色';
		if (/ENGINE_UNAVAILABLE|引擎未就绪/.test(raw)) return `${what}需要模型服务：本进程还没有可用的模型路由，先在会话里正常对话一次再试。`;
		if (/NO_ROUTE/.test(raw)) return `${what}通道没有可用路由：检查插件配置里的 engine.channels.${mode}。`;
		if (/GUARD_BLOCKED|守卫/.test(raw)) return `${what}结果被守卫拦下（改动过大或与原文偏离太多），已丢弃——正文没动。`;
		if (/ABORTED/.test(raw)) return `${what}被中止。`;
		return raw;
	};

	const runRevision = async (mode) => {
		if (!state.selected || state.revising) return;
		// 跨书竞态守卫（CodeBuddy 审计 2026-10-09）：润色/校对请求最长可等数分钟，
		// 期间切书后迟到的写回会把 A 书的 notice / 提案队列挂到 B 书头上。
		const bookId = state.selected;
		const chapterNo = state.chapterNo;
		state.revising = mode; state.error = ''; state.notice = ''; notify();
		try {
			const value = await apiFetch(
				`/projects/${encodeURIComponent(bookId)}/chapters/${chapterNo}/${mode}`,
				{
					method: 'POST', timeoutMs: REVISION_TIMEOUT_MS,
					// session = 面板锚定的会话 id：服务端拿它找活的父 agent 起子代理
					// （SubagentStartRequest.parent 必填，缺了宿主直接炸进程——0.13.2 事故）。
					body: JSON.stringify({ session: state.sessionId ?? undefined }),
				},
			);
			if (state.selected !== bookId) return; // 已切书：结果作废
			const what = mode === 'proofread' ? '校对' : '润色';
			const delta = Number(value?.deltaChars ?? 0);
			state.notice = `${what}完成：提案 ${value.proposalId}（${value.chars} 字，改动 ${delta >= 0 ? '+' : ''}${delta}）—— 到「待批准提案」里点应用才生效`;
			await ctx.loadProposals(bookId);
		} catch (error) { if (state.selected === bookId) state.error = revisionErrorText(error, mode); }
		finally { state.revising = null; notify(); }
	};

	// ── 批量起草（D2）──
	//
	// 服务端是**并发生成 + 串行提交**：每章照样过机审/内容门禁/账本/契约指标，
	// 单章被拦不影响其余章。所以失败不是异常，是结果的一部分——摊给用户看，不吞。
	/** 单章写章（0.13.2）：复用批量起草端点——from=当前编辑章、count=1。
	 *  与会话里 novel_write_chapter 同一条 commitChapter 门禁链，直接落盘（版本化，旧稿保留）。
	 *  被拦（细纲缺失/机审不过/熔断）不算异常——结果摊在批量结果区看。 */
	const writeSingleChapter = async () => {
		if (!state.selected || state.batchBusy) return;
		const no = state.chapterNo || 1;
		// 借用批量表单的值通道（表单会同步显示为单章，所见即所跑）
		state.batchFrom = String(no);
		state.batchCount = '1';
		state.batchConcurrency = '1';
		await runBatch();
	};

	const runBatch = async (opts = {}) => {
		if (!state.selected || state.batchBusy) return;
		// 跨书竞态守卫（CodeBuddy 审计 2026-10-09）：批量最长 15 分钟，期间切书后
		// 迟到的写回会把 A 书的结果/notice 挂到 B 书详情页。表单值也在发起时快照——
		// await 之后重读会拿到用户此刻改的值（M15 重载判断就错位了）。
		const bookId = state.selected;
		const batchFrom = Number(state.batchFrom) || 1;
		const batchCount = Number(state.batchCount) || 1;
		state.batchBusy = true; state.error = ''; state.notice = ''; state.batchResult = null; notify();
		try {
			state.batchResult = await apiFetch(`/projects/${encodeURIComponent(bookId)}/draft-batch`, {
				method: 'POST',
				timeoutMs: 900_000,
				body: JSON.stringify({
					from: batchFrom,
					count: batchCount,
					concurrency: Number(state.batchConcurrency) || 1,
					force: state.batchForce === true,
					session: state.sessionId ?? undefined,
					// 断点续跑：参数由服务端从 .novel/batch-checkpoint.json 恢复
					...(opts.resume === true ? { resume: true } : {}),
				}),
			});
			if (state.selected !== bookId) return; // 已切书：结果作废，不污染新书状态
			const st = state.batchResult?.stats ?? {};
			state.notice = `${state.batchResult?.resumed === true ? '断点续跑：' : ''}批量起草完成：落盘 ${st.committed ?? 0} 章，被拦 ${st.failed ?? 0} 章`;
			// 检查点状态同步：全落盘 → done（「继续上次批量」按钮退场），有被拦 → partial
			if (state.detail?.batchCheckpoint) {
				state.detail = { ...state.detail, batchCheckpoint: { ...state.detail.batchCheckpoint, status: (st.failed ?? 0) === 0 ? 'done' : 'partial' } };
			}
			// 新章会改变账本与提案队列；同时体检结果作废（它按章算的）
			await Promise.all([loadChapterList(bookId), ctx.loadProposals(bookId)]);
			if (state.selected !== bookId) return;
			state.continuity = null;
			state.diagnosis = null; // 批量可能覆盖前三章（force 时），诊断同样作废
			// M15 修复：正被编辑的章若在本次批量范围内（且真的落了盘），重拉正文——
			// 否则编辑器里还是旧稿，用户一点「保存」就把旧内容盖回成新版本
			if ((st.committed ?? 0) > 0
				&& state.chapterNo >= batchFrom && state.chapterNo < batchFrom + batchCount) {
				await ctx.loadChapter(state.chapterNo);
				state.notice += `；第 ${state.chapterNo} 章已在编辑器里重载为最新版本`;
			}
		} catch (error) {
			if (state.selected === bookId) {
				const raw = String(error?.message ?? error);
				state.error = /ENGINE_UNAVAILABLE|引擎未就绪/.test(raw)
					? '批量起草需要模型服务：本进程还没有可用的模型路由。'
					: raw;
			}
		} finally { state.batchBusy = false; notify(); }
	};

	// 会话疲劳「创建新会话并交接」（全自动版，用户钦定 2026-10-10）：
	// 交接摘要由服务端直接 prompt 进新会话（点开即写，不手动粘贴）；
	// 归档走 deferArchive——先跳进新会话再补归档，躲开「归档当前会话 → 宿主 clearMain
	// 把人踢回『选择工作区』首页」的竞态（真机实证 2026-10-10）。
	const createSession = async () => {
		if (!state.sessionId) { state.error = '缺会话 id（面板未挂在会话上）——无法创建新会话'; notify(); return; }
		const oldSessionId = state.sessionId;
		const handoff = state.detail?.session?.handoff ?? '';
		const canJump = typeof ctx.openSession === 'function';
		state.busy = true; notify();
		try {
			const value = await apiFetch('/session/create', {
				method: 'POST',
				// book：服务端据此把新会话 cwd 落到书的工作区根 + 顺手认领（面板跳进即见书）；
				// handoff：服务端 prompt 进新会话（能跳才直发——不能跳时用户还得靠剪贴板，
				// 但直发不冲突：queue 模式下消息就在新会话里等着，粘贴只是多一条）；
				// deferArchive：能跳就延迟归档（先跳后归档，躲开 clearMain 竞态）。
				body: JSON.stringify({
					session: oldSessionId,
					// 必须是**目录名**（bookId）：服务端 locateBook / 认领认的都是它。
					// detail.id 是 novel.json 的内部 id（nb_…），用它传等于书定位与认领双失效。
					book: state.detail?.bookId ?? state.selected ?? state.detail?.id ?? '',
					bookTitle: state.detail?.title ?? '',
					...(handoff ? { handoff } : {}),
					...(canJump ? { deferArchive: true } : {}),
				}),
			});
			// 剪贴板兜底保留：prompt 直发失败时（promptError）用户仍能手动粘贴
			if (handoff && !value.prompted && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
				navigator.clipboard.writeText(handoff).then(() => { state.copiedHandoff = true; notify(); }).catch(() => { /* 剪贴板不可用时交接摘要仍在横幅可手复制 */ });
			}
			const archive = canJump
				? '' // 跳转后补归档，结果到那时才知道
				: (value.archived
					? '旧会话已归档'
					: (value.archiveError ? `旧会话归档失败：${value.archiveError}` : '旧会话可在会话列表手动归档'));
			const registered = value.accounted === true || value.inserted;
			const place = registered
				? (value.inserted ? '已插到原会话旁边' : '已登记进工作区列表')
				: (value.insertError || value.attachError
					? `，但登记到工作区列表失败：${value.insertError ?? value.attachError}`
					: '，且未登记进工作区列表（宿主未暴露工作区面）——到会话列表按名字找');
			const named = value.title ?? (value.renamed ? '（已创建，名未取得）' : '（未命名）');
			const claim = value.claimed ? '，已认领这本书' : (value.claimError ? `，认领失败：${value.claimError}` : '');
			const delivery = value.prompted
				? '交接摘要已自动发进新会话——它正在开写'
				: (value.promptError ? `摘要直发失败（${value.promptError}），已复制到剪贴板——打开新会话粘贴即续写` : '打开它粘贴交接摘要即续写');
			state.notice = value.createdSessionId
				? `新会话「${named}」已创建${value.workspaceMatched ? '，落在原会话的工作区' : ''}${claim}${place}${value.accounted === false ? '；侧栏暂未登记（可刷新页面或到全部会话找）' : ''}——${delivery}${archive ? `；${archive}` : ''}`
				: '新会话已创建但未取得 id——请到会话列表查看';
			// 先 notify 渲染反馈再延迟跳转：openSession 一调用面板就卸载了，
			// 同步赋 notice 来不及渲染——用户看到「没反应」（真机 2026-10-09）。
			if (value.createdSessionId && canJump) {
				notify();
				const newId = value.createdSessionId;
				const archiveOld = () => apiFetch('/session/archive', { method: 'POST', body: JSON.stringify({ session: oldSessionId }) })
					.catch((error) => console.warn('[dsh-web-novel] 旧会话延迟归档失败（可在会话列表手动归档）：', error?.message ?? error));
				// 归档时机不猜时间猜状态（CodeBuddy 审查 2026-10-10）：openSession 同步返回、
				// 异步完成导航——固定 60ms 在慢渲染下会「归档先到、main 还是旧会话」，
				// clearMain 照样踢人。轮询 syncSession（读宿主 sessions.list 的 current）
				// 等 main 真的切到新会话再归档，上限 ~4s；openSession 抛错则立即归档
				//（退化为旧行为：被踢到首页也能从列表进新会话）。面板卸载不影响归档
				// fetch（模块级请求）；超时也归档——旧会话总要收掉，用户在首页找得到新会话。
				let tries = 0;
				const waitMainThenArchive = () => {
					try { ctx.syncSession(); } catch { /* 会话面缺失：按超时路径走 */ }
					if (state.sessionId === newId || tries >= 40) { archiveOld(); return; }
					tries += 1;
					setTimeout(waitMainThenArchive, 100);
				};
				setTimeout(() => {
					try {
						ctx.openSession(newId);
						waitMainThenArchive();
					} catch { archiveOld(); }
				}, 60);
			}
		} catch (error) { state.error = String(error?.message ?? error); }
		finally { state.busy = false; notify(); }
	};
	// 会话疲劳一键轮换（真发请求在第二击，armed 判定在 events 控制器）：
	// POST /session/rotate 由服务端探测宿主能力——探测不到返回 501，错误原文直接给面板。
	const rotateSession = async () => {
		if (!state.sessionId) { state.error = '缺会话 id（面板未挂在会话上）——无法轮换'; notify(); return; }
		state.busy = true; notify();
		try {
			const value = await apiFetch('/session/rotate', {
				method: 'POST', body: JSON.stringify({ session: state.sessionId }),
			});
			state.rotatePending = false;
			state.notice = value.archived
				? '已开新会话并归档旧会话——到会话列表打开新会话，点「复制交接摘要」粘一句即可续写'
				: `新会话已创建，但旧会话归档失败${value.archiveError ? `：${value.archiveError}` : ''}——可在会话列表手动归档`;
		} catch (error) { state.error = String(error?.message ?? error); }
		finally { state.busy = false; notify(); }
	};
	return {
		loadElements, loadChapterList, refreshProjects, claimProject, renameProject, cloneProject,
		deleteListProject, openProject, createProject, deleteProject, goBack, rotateSession, createSession,
		loadContinuity, loadDiagnosis, loadDashboard, runRevision, writeSingleChapter, runBatch, saveBookChars, saveBookSettings,
	};
}

			return { "createProjectsController": createProjectsController };
		};

		// ── src/client/controllers/events.js ──
		__factories["src/client/controllers/events.js"] = function (__m, __exports) {
// src/client/controllers/events.js — 动作分发（handleAction）+ 原生事件代理。
// 从 panel.js 的 createForgeController 拆出：视图发 `data-action`，这里统一路由到各域动作。
// 跨域动作经 ctx 晚绑定调用（装配完成后回填），因此拆分不引入模块循环 import。
const { apiFetch } = __m("src/client/api.js");
const { sameEntryId } = __m("lib/store.js");
const { emptyLoreForm } = __m("src/client/state.js");

function createEventsController(ctx) {
	const { state, notify, syncSession, player } = ctx;

	/** 需要模型参与的动作：面板只给引导，真动作在会话里。 */
	const needsModel = (msg) => { state.error = msg; notify(); };

	/** 有未保存改动时，把「离开意图」挂起，由视图里的 丢弃改动/取消 二选一。 */
	const intentLeave = (pending) => {
		if (state.draftModified) { state.discardPending = pending; notify(); return false; }
		return true;
	};

	/** 复制文本到剪贴板（宽屏快捷动作用）；不可用时给可行动提示，不静默。 */
	const copyText = (text, okMessage) => {
		const clipboard = typeof navigator !== 'undefined' ? navigator?.clipboard : undefined;
		if (typeof clipboard?.writeText !== 'function') {
			state.error = '剪贴板不可用（非安全上下文）——请手动选中文本复制';
			notify();
			return;
		}
		clipboard.writeText(text)
			.then(() => { state.notice = okMessage; notify(); })
			.catch((error) => { state.error = `复制失败：${error?.message ?? error}`; notify(); });
	};

	/** 详情页宽屏浮层的统一态更新（浮层关闭后迟到的响应不许再写回）。 */
	const updateOverlay = (no, patch) => {
		if (state.readerOverlay?.no !== no) return false;
		state.readerOverlay = { ...state.readerOverlay, ...patch };
		return true;
	};

	const handleAction = async (action, target) => {
		syncSession();   // 所有带会话戳的动作（润色/校对/写章/认领/创建）先对齐真会话 id
		state.error = ''; state.notice = '';
		switch (action) {
			case 'reload-proposals': state.proposalsError = null; await ctx.loadProposals(state.selected); break;
			case 'refresh-dashboard': await ctx.loadDashboard(state.selected); break;
			case 'refresh-projects': await ctx.refreshProjects(); break;
			case 'toggle-scope':
				if (!state.sessionId) break; // 无会话标识时本来就是全量，无可切换
				state.sessionScope = state.sessionScope === 'all' ? 'session' : 'all';
				await ctx.refreshProjects();
				break;
			case 'create': await ctx.createProject(); break;
			case 'open': await ctx.openProject(target.dataset.id); break;
			case 'rename-open': {
				const id = target.dataset.id;
				const p = state.projects.find((x) => x.name === id) || state.unclaimed.find((x) => x.name === id);
				state.rename = { id, value: p?.title || p?.name || '' };
				state.listDeleteId = null; notify(); break;
			}
			case 'rename-confirm': await ctx.renameProject(); break;
			case 'rename-cancel': state.rename = null; notify(); break;
			// 克隆为模板：与改名同款内联表单（clone = {id, value}）。互斥——开一个关另一个
			case 'clone-open': {
				const id = target.dataset.id;
				if (!id) { state.error = '拿不到要克隆的书（按钮上应有 data-id）'; notify(); break; }
				state.clone = { id, value: '' };
				state.rename = null; state.listDeleteId = null; notify(); break;
			}
			case 'clone-confirm': await ctx.cloneProject(); break;
			case 'clone-cancel': state.clone = null; notify(); break;
			case 'list-delete':
				if (state.listDeleteId === target.dataset.id) await ctx.deleteListProject(target.dataset.id);
				else { state.listDeleteId = target.dataset.id; state.rename = null; notify(); }
				break;
			case 'list-delete-cancel': state.listDeleteId = null; notify(); break;
			case 'back':
				if (!intentLeave({ kind: 'back' })) break;
				await ctx.goBack(); break;
			case 'claim': await ctx.claimProject(target.dataset.id || null); break;
			// 详情页标签（FUSION 1.7 起 5 个）：概览 / 章节 / 体检 / 提案 / 编辑
			case 'detail-tab': {
				const tab = ['info', 'chapters', 'health', 'proposals', 'edit'].includes(target.dataset.tab)
					? target.dataset.tab : 'info';
				if (state.detailTab !== tab) state.detailTab = tab;
				if (tab === 'chapters') await ctx.loadChapterList();
				if (tab === 'edit' && state.selected && state.chapterNo) await ctx.loadChapter(state.chapterNo);
				notify(); break;
			}
			case 'play-from': {
				state.detailTab = 'chapters';
				// 章号走 data-id（视图是 `Btn({ id: c.no })`，Btn 把 id 写成 data-id）。
				// ⚠️ 曾经这里读的是 `dataset.no` —— 而全项目**没有任何地方写过 data-no**，
				// 于是 Number(undefined) = NaN 一路传进播放器：synth.cancel → status=playing
				// → loadChapter(NaN) 取不到正文 → nextChapterAfter(NaN) 也找不到下一章 → finish 回 idle。
				// 前后两次 emit 把状态**还原成原样**，界面于是"点了毫无反应"——
				// 整列「▶」和顶部「从第 N 章开始听」全是死的（0.13.0 真实故障）。
				const no = Number(target.dataset.id);
				if (!Number.isFinite(no) || no <= 0) {
					state.error = `拿不到要播的章号（播放钮上应有 data-id，实际是 "${target.dataset.id ?? ''}"）`;
					notify();
					break;
				}
				try { await player.playFrom(no); }
				catch (error) { state.error = String(error?.message ?? error); notify(); }
				break;
			}
			case 'read-chapter': {
				// 阅读器：取单章正文展开在目录上方。与播放互相独立（可以边听边看）。
				// 章号同样只认 data-id —— 理由见 play-from 里的注释（字段名对不上＝点了没反应）。
				state.detailTab = 'chapters';
				const no = Number(target.dataset.id);
				if (!Number.isFinite(no) || no <= 0) {
					state.error = `拿不到要读的章号（阅读钮上应有 data-id，实际是 "${target.dataset.id ?? ''}"）`;
					notify();
					break;
				}
				const meta = state.chapterList.find((c) => c.no === no);
				state.reader = { no, title: meta?.title ?? `第 ${no} 章`, text: '', loading: true };
				notify();
				try {
					const text = await apiFetch(`/projects/${encodeURIComponent(state.selected)}/chapters/${no}`);
					// 请求期间用户可能已点了另一章的 📖 —— 只更新仍是同一章的 reader
					if (state.reader?.no === no) {
						state.reader = { no, title: meta?.title ?? `第 ${no} 章`, text: String(text ?? ''), loading: false };
					}
				} catch (error) {
					if (state.reader?.no === no) state.reader = null;
					state.error = `读不出第 ${no} 章正文：${String(error?.message ?? error)}`;
				}
				notify();
				break;
			}
				case 'review-open-chapter': {
					// 平台审稿抽样不是终审，只是把“去哪改”落到动作面：打开命中章。
					// 未保存草稿沿用统一确认，绝不直接覆盖编辑现场。
					const no = Number(target.dataset.id);
					if (!Number.isFinite(no) || no <= 0) {
						state.error = `拿不到要打开的章号（审稿条目上应有 data-id，实际是 "${target.dataset.id ?? ''}"）`;
						notify();
						break;
					}
					state.detailTab = 'info';
					if (no === state.chapterNo) break;
					if (!intentLeave({ kind: 'chapter', no })) break;
					await ctx.loadChapter(no);
					break;
				}
			case 'close-reader': state.reader = null; notify(); break;
			// ── 宽屏阅读/编辑浮层（FUSION 1.7）：右栏窄，长章放到宿主页面宽度里读/改 ──
			case 'reader-wide': {
				const no = Number(target.dataset.id);
				if (!Number.isFinite(no) || no <= 0) {
					state.error = `拿不到要宽屏阅读的章号（按钮上应有 data-id，实际是 "${target.dataset.id ?? ''}"）`;
					notify();
					break;
				}
				const meta = state.chapterList.find((c) => c.no === no);
				state.readerOverlay = {
					no, title: meta?.title ?? `第 ${no} 章`, text: '', draft: '', draftVersion: 0,
					loading: true, editing: false, saving: false, error: '',
				};
				notify();
				try {
					const text = await apiFetch(`/projects/${encodeURIComponent(state.selected)}/chapters/${no}`);
					if (updateOverlay(no, { text: String(text ?? ''), draft: String(text ?? ''), loading: false })) notify();
				} catch (error) {
					// 失败不许留半开浮层；报错原文给出来
					if (state.readerOverlay?.no === no) state.readerOverlay = null;
					state.error = `读不出第 ${no} 章正文：${String(error?.message ?? error)}`;
					notify();
				}
				break;
			}
			case 'reader-close': state.readerOverlay = null; notify(); break;
			case 'reader-edit': {
				if (!state.readerOverlay || state.readerOverlay.loading) break;
				state.readerOverlay = {
					...state.readerOverlay,
					editing: true,
					draft: state.readerOverlay.text,
					draftVersion: (state.readerOverlay.draftVersion ?? 0) + 1,
					error: '',
				};
				notify();
				break;
			}
			case 'reader-cancel-edit': {
				if (!state.readerOverlay) break;
				state.readerOverlay = { ...state.readerOverlay, editing: false, draft: state.readerOverlay.text, error: '' };
				notify();
				break;
			}
			case 'reader-save': {
				const ov = state.readerOverlay;
				if (!ov || !state.selected || ov.editing !== true) break;
				const bookId = state.selected;
				const no = ov.no;
				const text = String(ov.draft ?? '');
				state.readerOverlay = { ...ov, saving: true, error: '' };
				notify();
				try {
					await apiFetch(`/projects/${encodeURIComponent(bookId)}/chapters/${no}`, {
						method: 'POST', body: JSON.stringify({ text }),
					});
					if (updateOverlay(no, { saving: false, editing: false, text, draft: text, error: '' })) {
						state.notice = `已保存：第 ${no} 章${state.chapterNo === no ? '（面板编辑器同步需刷新）' : ''}`;
					}
				} catch (error) {
					// 门禁拦下与其它失败都摆在浮层里：原文在 textarea，用户不需要关掉重找
					updateOverlay(no, { saving: false, error: String(error?.message ?? error) });
				}
				notify();
				break;
			}
			// 快捷动作：复制「继续写下一章」的会话指令 / 定稿审计命令（剪贴板，不占对话）
			case 'quick-continue': {
				const chapters = Object.keys(state.detail?.chapters ?? {}).map(Number).filter((n) => Number.isFinite(n));
				const latest = chapters.length > 0 ? Math.max(...chapters) : 0;
				const next = latest + 1;
				const title = state.detail?.title || state.selected || '这本书';
				copyText(
					`继续写《${title}》第 ${next} 章：先 novel_outline save_chapter（第${next}章，含「## 本章必写场景」与「## 本章禁止偏离项」契约段）→ novel_outline approve → novel_briefing chapter=${next} → 按简报写正文 → novel_write_chapter 落盘。一次只写一章，写完停下汇报。`,
					`已复制「继续写第 ${next} 章」的指令——粘贴到会话输入框即可`,
				);
				break;
			}
			case 'quick-audit': {
				const no = state.chapterNo;
				const rec = state.detail?.chapters?.[String(no)];
				const file = (rec && typeof rec === 'object' && rec.file) ? rec.file : '';
				const rel = file ? `${state.selected}/${file}` : `${state.selected}/06-正文/第${String(no).padStart(3, '0')}章*.md`;
				copyText(
					`python "$HOME/.dsh/skills/fiction-suite/scripts/novel_audit.py" --file "${rel}" --kind 定稿`,
					`已复制第 ${no} 章定稿审计命令（在会话里让 AI 用 shell 跑，或在终端粘贴）`,
				);
				break;
			}
			case 'refresh-fusion': break;
			case 'playback-pause': player.pause(); notify(); break;
			case 'playback-resume': player.resume(); notify(); break;
			case 'playback-stop': player.stop(); notify(); break;
			case 'goto-lorebook':
				state.view = 'lorebook'; state.selected = target.dataset.id || state.selected;
				await ctx.loadLoreEntries(state.selected || 'default'); break;
			case 'back-from-lore':
			case 'back-from-settings': state.view = state.selected ? 'detail' : 'projects'; notify(); break;
			case 'goto-settings': state.view = 'settings'; state.settingsOk = ''; state.settingsError = ''; notify(); break;
	// H5 网页版浮层（1.8）：iframe 独立渲染，开/关/刷新都只动 state.h5Overlay
	case 'h5-open': state.panelMode = 'h5'; persistPanelMode('h5'); notify(); break;
	case 'h5-refresh': state.h5RefreshKey = (state.h5RefreshKey ?? 0) + 1; notify(); break;
	// H5 已是唯一形态：经典面板里遗留的「打开 H5」按钮等价于刷新 H5 内嵌页。
	case 'panel-mode-h5': state.h5RefreshKey = (state.h5RefreshKey ?? 0) + 1; notify(); break;
	case 'h5-close': state.h5Overlay = null; notify(); break;
	case 'h5-reload':
		if (state.h5Overlay) {
			state.h5Overlay = { ...state.h5Overlay, key: Date.now() };
			notify();
		}
		break;
	// 设置页保存：本书字数区间 / 平台 / logline 一次提交（服务端单端点、任一不合法整单拒绝）
	case 'settings-save': {
		if (!state.selected) { state.settingsError = '先打开一本书再改设置'; notify(); break; }
		const read = (name) => {
			const node = bound?.querySelector?.(`[data-field="${name}"]`);
			return node ? String(node.value ?? '') : '';
		};
		await ctx.saveBookSettings({
			chars: read('settings-chars').trim(),
			platform: read('settings-platform').trim(),
			logline: read('settings-logline').trim(),
		});
		break;
	}
			case 'write': await ctx.writeSingleChapter(); break;
			case 'polish': await ctx.runRevision('polish'); break;
			case 'proofread': await ctx.runRevision('proofread'); break;
			case 'continuity': await ctx.loadContinuity(); break;
			case 'draft-batch': await ctx.runBatch(); break;
			case 'draft-batch-resume': await ctx.runBatch({ resume: true }); break;
			case 'diagnose': await ctx.loadDiagnosis(); break;
			case 'import-demo': case 'import-file': needsModel('请在会话中调用 novel_import 导入'); break;
			case 'save': state.saveBlocked = ''; await ctx.saveChapter(); break;
			// 本书每章字数区间（用户 2026-10-20）：保存读编辑框当前值；
			// 「跟随平台/插件默认」= 清除自定义（送空串），两条都是显式一键。
			case 'save-chars': await ctx.saveBookChars(state.charsValue); break;
			case 'clear-chars': state.charsValue = ''; await ctx.saveBookChars(''); break;
			// 门禁拦下后的二次确认：只有这一条路径带 force（内容门禁类判定可放行，
			// 字数/账本/熔断服务端仍硬拦）——不做默认放行，也不许静默跳过。
			case 'save-force': await ctx.saveChapter({ force: true }); break;
			// M14 修复：刷新会重拉当前章、覆盖编辑器——有未保存改动时走同一套
			// 「确认丢弃」流程（与切章一致），不再静默把草稿冲掉
			case 'refresh':
				if (state.selected && state.chapterNo) {
					if (state.draftModified) { state.discardPending = { kind: 'chapter', no: state.chapterNo }; notify(); }
					else await ctx.loadChapter(state.chapterNo);
				}
				break;
			// 提案：应用 / 丢弃都是**用户主权动作**（工具面刻意不提供，见 lib/proposals.js）
			case 'proposal-view': await ctx.toggleProposalDetail(target.dataset.id); break;
			case 'proposal-apply': await ctx.applyProposalAction(target.dataset.id); break;
			case 'proposal-discard': await ctx.discardProposalAction(target.dataset.id); break;
			case 'export': await ctx.exportProject(); break;
			case 'delete':
				if (state.deleteState === 'busy') break; // L17：删除进行中，重复点无效
				if (state.deleteState === 'confirm') await ctx.deleteProject();
				else { state.deleteState = 'confirm'; notify(); }
				break;
			case 'delete-cancel': state.deleteState = null; notify(); break;
			// 未保存改动：确认丢弃后才真正离开 / 换章；取消则留在原地
			case 'discard-confirm': {
				const pending = state.discardPending;
				state.discardPending = null; state.draftModified = false;
				if (pending?.kind === 'back') await ctx.goBack();
				else if (pending?.kind === 'chapter') await ctx.loadChapter(pending.no);
				else notify();
				break;
			}
			case 'discard-cancel': state.discardPending = null; notify(); break;
		case 'copy-handoff': {
			// 会话疲劳横幅的交接摘要：复制到剪贴板，用户去 shell 新建会话粘贴即可续写。
			// 剪贴板要安全上下文（localhost 满足）；不可用时给可行动提示，不静默。
			// ⚠ navigator 必须先过 typeof：headless（vm 测试环境）里它是未声明标识符，
			// 可选链只防 null/undefined，不防未声明——直接 navigator?.clipboard 会 ReferenceError。
			const handoff = state.detail?.session?.handoff;
			if (!handoff) break;
			const clipboard = typeof navigator !== 'undefined' ? navigator?.clipboard : undefined;
			if (typeof clipboard?.writeText !== 'function') {
				state.error = '剪贴板不可用（非安全上下文）——请在详情里手动选中交接摘要复制';
				notify();
				break;
			}
			clipboard.writeText(handoff)
				.then(() => { state.copiedHandoff = true; notify(); })
				.catch((error) => { state.error = `复制失败：${error?.message ?? error}`; notify(); });
			break;
		}
			case 'session-create':
				// 创建新会话并交接（服务端 sessions.create；非破坏性，单击即发）
				await ctx.createSession();
				break;
			case 'session-rotate': {
				// 两段确认：归档的是「正在看面板的这个会话」，第一击 arm 防手滑，第二击才发。
				if (!state.rotatePending) { state.rotatePending = true; notify(); break; }
				state.rotatePending = false;
				await ctx.rotateSession();
				break;
			}
			case 'lore-new': state.loreForm = { ...emptyLoreForm(), mode: 'new' }; state.loreDeleteId = null; notify(); break;
			case 'lore-edit': {
				// id 字符串比较（理由同 toggleLoreEntry）：Number('W1')=NaN 会让「编辑」
				// 对工具生成的条目静默失效（点了没反应）。
				const entry = state.loreEntries.find((x) => sameEntryId(x.id, target.dataset.id));
				if (entry) {
					state.loreForm = {
						mode: 'edit', id: String(entry.id), name: entry.name, content: entry.content,
						keywords: (entry.keywords || []).join(','), alwaysActive: entry.always_active,
						enabled: entry.enabled, priority: String(entry.priority), bookId: entry.book_id || '',
					};
					state.loreDeleteId = null;
					notify();
				} else if (target.dataset.id !== undefined) {
					// 拿不到条目不许静默：报出来，别让「点了没反应」再发生
					state.error = `找不到要编辑的世界书条目（id "${target.dataset.id}"）`;
					notify();
				}
				break;
			}
			case 'lore-save': await ctx.saveLoreEntry(); break;
			case 'lore-cancel': state.loreForm = emptyLoreForm(); notify(); break;
			case 'lore-toggle': await ctx.toggleLoreEntry(target.dataset.id); break;
			// 删除两步确认（与列表页删书同款）：第一次点只点亮确认行，再点才真删——
			// 世界书条目删了就没了（关键词、优先级、内容全在一条里），误触不可逆。
			case 'lore-delete':
				if (sameEntryId(state.loreDeleteId, target.dataset.id)) {
					state.loreDeleteId = null;
					await ctx.deleteLoreEntry(target.dataset.id);
				} else { state.loreDeleteId = target.dataset.id; notify(); }
				break;
			case 'lore-delete-cancel': state.loreDeleteId = null; notify(); break;
			default:
				// 视图发了控制器不认的动作名 = 「按钮点了没反应」的静默病根（AGENTS.md 第三次学费）。
				// 本项目不许可静默失败：报错可见 + 控制台留痕，client.test.mjs 的「动作契约对账」
				// 用例据此把「视图发出但控制器没有对应 case」判成红灯。
				state.error = `未处理的动作：${action}（界面按钮与控制器动作名不符，请报告）`;
				console.warn('[dsh-web-novel] unknown action:', action);
				notify();
				break;
		}
	};

	// ── 原生事件代理（React 合成事件在宿主环境失效，故走容器级监听） ──
	const onClick = (e) => {
		const actionEl = e.target?.closest?.('[data-action]');
		if (actionEl) { e.preventDefault(); e.stopPropagation(); void handleAction(actionEl.dataset.action, actionEl); }
	};
	const onInput = (e) => {
		const field = e.target?.dataset?.field;
		// 书名输入是非受控的（defaultValue）：每键只记值不重渲染——
		// 「创建中…」那一下的 notify 由 create 自己负责（每键全列表重渲染白烧）。
		if (field === 'title') { state.title = e.target.value; }
		// 字数区间是自由文本（"2500-3500"）：边输不边报错，提交时才由服务端判（同 batch 表单的纪律）
		else if (field === 'new-chars') { state.newChars = e.target.value; }
		else if (field === 'chars-value') { state.charsValue = e.target.value; }
		else if (field === 'project-filter') { state.filter = e.target.value; notify(); }
		else if (field === 'draft') { state.draft = e.target.value; state.draftModified = e.target.value !== state.baseline; }
		// 宽屏浮层的编辑区：受控值只更新不重渲染（textarea 是 defaultValue 非受控）
		else if (field === 'reader-draft') { if (state.readerOverlay) state.readerOverlay = { ...state.readerOverlay, draft: e.target.value }; }
		else if (field === 'rename-value') { if (state.rename) state.rename.value = e.target.value; }
		else if (field === 'clone-value') { if (state.clone) state.clone.value = e.target.value; }
		else if (field === 'chapterNo') {
			const no = Number(e.target.value);
			// 只收正整数（CodeBuddy 审计 2026-10-09 L1）：'1.5' 这类非整数此前会放行，
			// 服务端 400 兜底但编辑器已经先切过去了。注意 '2e3'（=2000）仍是整数、
			// 此处照样放行——穷举写法不值当，不存在的章号由服务端 404 兜底。
			if (Number.isInteger(no) && no >= 1) {
				// 有未保存草稿时换章会丢内容——先确认再切
				if (state.draftModified) { state.discardPending = { kind: 'chapter', no }; notify(); }
				else void ctx.loadChapter(no);
			}
		}
		else if (field === 'lore-name') state.loreForm.name = e.target.value;
		else if (field === 'lore-keywords') state.loreForm.keywords = e.target.value;
		else if (field === 'lore-content') state.loreForm.content = e.target.value;
		else if (field === 'lore-priority') state.loreForm.priority = e.target.value;
		// 批量起草表单：留成受控值，但只在提交时才校验（边输边报错太吵）
		else if (field === 'batch-from') state.batchFrom = e.target.value;
		else if (field === 'batch-count') state.batchCount = e.target.value;
		else if (field === 'batch-concurrency') state.batchConcurrency = e.target.value;
		else if (field === 'batch-force') state.batchForce = e.target.checked === true;
	};
	const onChangeEvent = (e) => {
		const field = e.target?.dataset?.field;
		if (field === 'lore-always') state.loreForm.alwaysActive = e.target.checked;
		else if (field === 'batch-concurrency') state.batchConcurrency = e.target.value;
		else if (field === 'batch-force') state.batchForce = e.target.checked === true;
	};
	/** 浮层 Escape：H5 优先（最上层），其次宽屏阅读/编辑浮层。 */
	const onKeyDown = (e) => {
		if (e?.key !== 'Escape') return;
		if (state.h5Overlay) {
			e.preventDefault?.();
			state.h5Overlay = null;
			notify();
			return;
		}
		if (state.readerOverlay) {
			e.preventDefault?.();
			state.readerOverlay = null;
			notify();
		}
	};

	let bound = null;
	/** 面板形态持久化：读不到 localStorage（隐私模式/测试）就静默跳过，不影响切换。 */
	const persistPanelMode = (mode) => {
		try { localStorage.setItem('nf-panel-mode', mode); } catch { /* 忽略 */ }
	};
	const attach = (node) => {
		if (!node || bound === node) return;
		detach();
		bound = node;
		node.addEventListener('click', onClick);
		node.addEventListener('input', onInput);
		node.addEventListener('change', onChangeEvent);
		node.addEventListener('keydown', onKeyDown);
	};
	const detach = () => {
		if (!bound) return;
		try {
			bound.removeEventListener('click', onClick);
			bound.removeEventListener('input', onInput);
			bound.removeEventListener('change', onChangeEvent);
			bound.removeEventListener('keydown', onKeyDown);
			bound.removeEventListener('keydown', onKeyDown);
		} catch { /* 节点已被框架拆掉 */ }
		bound = null;
	};

	return { handleAction, attach, detach };
}

			return { "createEventsController": createEventsController };
		};

		// ── src/client/views/h5-overlay.js ──
		__factories["src/client/views/h5-overlay.js"] = function (__m, __exports) {
// src/client/views/h5-overlay.js — H5 网页版浮层（1.8）。
//
// 为什么要有 H5：右侧栏 React 面板在长列表/宽屏浮层下重渲染有卡顿感；
// H5 版是**零依赖单文件网页**（lib/h5-page.js，宿主 Route GET /h5 直接吐出 HTML），
// 放 iframe 里跑：样式/脚本与宿主 React 树彻底隔离，滚动、字体、主题都按 H5 自己设计。
// 数据不走任何新通道：页面内 fetch 仍带 fence 头打 /api/dsh-web-novel/*（复用它既有的门禁与权限）。
//
// 分工：浮层只负责「壳」（标题 / 刷新 / 新窗口 / 关闭），H5 页面自己管内部导航。
const { h } = __m("src/client/react.js");
const { space, color, font, weight, hintStyle, overlayBackdropStyle, overlayPanelStyle, overlayHeaderStyle } = __m("src/client/styles.js");
const { Btn, Chip } = __m("src/client/ui.js");

/** iframe 地址：书/会话可缺省（缺省时 H5 自己展示书架）。
 *  不用 URLSearchParams：测试的 headless 沙箱只提供最小 DOM，没有这个全局对象。 */
function h5Src(state) {
	const ov = state.h5Overlay ?? {};
	const parts = ['embed=1'];
	if (ov.book) parts.push(`book=${encodeURIComponent(ov.book)}`);
	if (state.sessionId) parts.push(`session=${encodeURIComponent(state.sessionId)}`);
	return `/api/dsh-web-novel/h5?${parts.join('&')}`;
}

function H5Overlay({ state: s }) {
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

			return { "H5Overlay": H5Overlay };
		};

		// ── src/client/index.js（入口，内联在 factory 作用域，导出表走 CJS 装配）──
// src/client/index.js — 浏览器半（client bundle）入口。
//
// ⚠️ 本文件不直接发布：`npm run build` 会把它与全部依赖打包成
//   lib/client.js（经典脚本 + __ModuleLoader__ factory）
// dsh 只加载 package.json 的 exports["./client"]，也就是那个**构建产物**；
// 源码本身是 ESM，dsh 看不懂也不会去读。所以改完源码必须跑 build，再重启 dsh。
//
// 0.13.x 入口路线（仙尊 2026-09-13 定，0.13.6 现状）：**右侧栏常驻独立 tab**。
//   · 会话里有没有项目都放上屏幕（空会话由 project-list.js 给引导空态）；
//   · 项目跟会话走 —— 列表按会话过滤（sessionId 来自 slot inject 工厂）。
//
// 契约（被 test/client.test.mjs 与 dsh 双向依赖）：
//   exports.inject  cordis 服务注入声明
//   exports.apply   插件装配函数，dsh 在物化后调用一次
const { registerForgeTab, openForgeTab, tabDefinition, TAB_ID, TAB_KIND } = __m("src/client/forge-tab.js");
const { startForgeAutoOpen, currentSessionId } = __m("src/client/session-watch.js");
const { ForgePanel, createForgeController } = __m("src/client/panel.js");
const { chunkText, createTtsPlayer, resolveSynth } = __m("src/client/tts.js");
const { apiFetch, FETCH_TIMEOUT_MS } = __m("src/client/api.js");
const { buildCss, ensureStyles, PANEL_ATTR, STYLE_ID } = __m("src/client/css.js");
// 纯渲染原语：测试直测 role 契约（Feedback）与列表筛选（projectMatches / ProjectListView）。
// Btn / ChapterListView 也在此列：aria-label 这类「参数被白名单静默吞掉」的缺陷
// 只有渲染结果能证明（控制器测不到视图真正写出去的 props）。
const { Feedback, Btn } = __m("src/client/ui.js");
const { ProjectListView, projectMatches } = __m("src/client/views/project-list.js");
const { ChapterListView } = __m("src/client/views/chapters.js");
const { LorebookView } = __m("src/client/views/lorebook.js");
const { ProjectDetailView } = __m("src/client/views/project-detail.js");
const { ProjectOverviewView } = __m("src/client/views/overview.js");
const { SettingsView } = __m("src/client/views/settings.js");
const { H5Overlay } = __m("src/client/views/h5-overlay.js");

// 版本号：必须与 package.json 的 version 一致。
// build-client.mjs 会把它与 package.json 对账，不一致直接构建失败（防发行漂移）。
const PLUGIN_VERSION = "1.16.0";

// 供视图头部徽标读取 —— 让视图层不必反向 import 入口（避免循环依赖）。
window.__DSH_WEB_NOVEL_VERSION__ = PLUGIN_VERSION;

/**
 * cordis 服务注入（浏览器侧）：
 *   slots            内容 seat（右栏 pane.tab）
 *   sidebarRightTabs tab 类型注册表（三步契约的第一步）
 *   sidebarRight     导航面（三步契约的第三步 openTab）
 *   sessions         会话列表与当前选择（判断「这是哪个会话」）
 */
const inject = ['slots', 'sidebarRightTabs', 'sidebarRight', 'sessions'];

/**
 * 插件装配。
 * @param {object} ctx cordis 上下文
 */
function apply(ctx) {
	// 分诊日志：**没有这一行**就说明 apply 压根没被调用 ——
	// 问题在加载链路（没构建 / 没重启 dsh），而不在本文件。
	console.info('[dsh-web-novel] client apply v' + PLUGIN_VERSION + ' — 注册右侧栏 tab');

	// ① 类型 + ② 内容 seat（forge-tab.js 的 registerForgeTab）
	// 包装一层：把 sessions 服务的「当前会话」读取器递给面板 —— slot inject 的
	// 会话标识与真 agent 会话 id 被证实可能不同源（0.13.2），面板发请求前以它对齐。
	try {
		registerForgeTab(ctx, (props) => ForgePanel({
			...props,
			resolveSessionId: () => currentSessionId(ctx),
			// 宿主客户端导航面（dsh-client-ui-workspace，宿主 UI 插件同款用法）：
			// 「创建新会话并交接」成功后直接跳进新会话，不落在「选择工作区」空白页。
			// 面不存在（旧宿主/服务未装载）时为 null，面板退化为提示手动打开。
			openSession: (id) => ctx.uiWorkspace?.openSession?.(id),
		}));
	} catch (error) {
		console.error('[dsh-web-novel] 右侧栏 tab 注册失败（可从右侧栏 guide 页手动进入）', error);
	}

	// ③ 打开：造神是右侧栏**常驻独立 tab** —— 会话里有没有项目都打开。
	//    之前 0.5.0 一度收进「本会话有项目才开」的门控，真机没项目（或 API 没命中）
	//    时右侧栏就没了那个独立「造神」，用户要的是"右侧栏 · 单独的"。
	//    面板内部仍按会话语义过滤项目列表，空会话给引导空态（见 project-list.js），
	//    所以无条件打开不会露丑。延迟重试由 openForgeTab 自己兜（seat 未挂载会抛）。
	//
	//    issue #8 的诉求是「别在我关掉后每次加载都自动弹开」→ autoOpenPanel 配置
	//    （缺省 true，行为不变）。配置经只读 /panel-config 取：fetch 失败 / 超时 /
	//    服务不可达 / 响应缺字段一律按 true 兜底——自动打开是锦上添花，不该被
	//    服务可用性绑架。tab 注册（①②）永远无条件，「关掉只是关掉这一次」。
	//    localStorage 记「用户关过」的方案否决：插件重载时 tab seat 卸载与手动
	//    关闭无法区分，每次升级后自动打开会静默失效。
	try {
		let openedByAuto = null;
		let disposed = false;
		if (typeof ctx.effect === 'function') {
			// disposer 现在注册、fetch 完成后异步补位。unload 早于 fetch 完成时，
			// cleanup 置 disposed 让 gate 回调直接退出——否则 2 秒窗口内卸载仍会在
			// fetch 返回后拉起 tab 和那条最长 30s 的重试链。
			ctx.effect(() => () => {
				disposed = true;
				if (typeof openedByAuto === 'function') openedByAuto();
			},
				'dsh-web-novel: 自动打开造神 tab');
		}
		const gate = (typeof fetch === 'function')
			? apiFetch('/panel-config', { timeoutMs: 2000 }).then(
				(cfg) => cfg?.autoOpenPanel !== false,
				() => true)
			: Promise.resolve(true);
		gate.then((shouldOpen) => {
			if (disposed || !shouldOpen || openedByAuto) return;
			try {
				// openForgeTab 返回 disposer（内部最多重试 120×250ms ≈ 30s），
				// 由上方 effect 登记的清理函数在卸载时调用。
				openedByAuto = openForgeTab(ctx);
			} catch (error) {
				console.warn('[dsh-web-novel] 独立打开右侧栏 tab 失败，可从右侧栏 guide 页手动进入（"造神"）', error);
			}
		}, () => {});
	} catch (error) {
		console.warn('[dsh-web-novel] 独立打开右侧栏 tab 失败，可从右侧栏 guide 页手动进入（"造神"）', error);
	}

	// 保底开关：自动打开失败时，控制台敲一行即可打开；
	// 也给冒烟测试一个不依赖 DOM/时序的入口。
	if (typeof window !== 'undefined') {
		window.__novelForge = {
			version: PLUGIN_VERSION,
			kind: TAB_KIND,
			open: () => openForgeTab(ctx, { maxTries: 1 }),
		};
	}
}


/**
 * headless 门禁的抓手：把纯逻辑暴露给 test/client.test.mjs。
 *
 * 面板组件本身要 React 才渲染得出来（node 里没有），但**控制器是纯闭包**：
 * 会话过滤打什么请求、创建时带不带 session、认领发什么 body —— 这些都能直测。
 * 不给这个出口，测试就只能退回 `code.includes(...)` 那种幻觉绿。
 */
const __internals = {
	TAB_ID, TAB_KIND, tabDefinition, openForgeTab,
	currentSessionId, startForgeAutoOpen, ForgePanel, createForgeController,
	chunkText, createTtsPlayer, resolveSynth,
	apiFetch, FETCH_TIMEOUT_MS,
	// 交互态样式表：测试要能验证「三态规则齐不齐」「注入是不是单例」
	buildCss, ensureStyles, PANEL_ATTR, STYLE_ID,
	// 视图原语：Feedback 的 role 契约、列表筛选的匹配与渲染
	projectMatches, ProjectListView, Feedback,
	// Btn（无障碍名是否真落到 props）与章节目录视图（图标按钮的 aria-label 端到端）
	Btn, ChapterListView,
	// 世界书视图：测试要拿它真实渲染出的 data-id（字符串 id 'W1'）驱动控制器
	LorebookView,
	// 其余视图导出：动作契约对账用例要渲染它们、收集真实 data-action（视图↔控制器一致性）
	ProjectDetailView, ProjectOverviewView, SettingsView, H5Overlay,
};


		var index_exports = {};
		__export(index_exports, { inject: () => inject, apply: () => apply, PLUGIN_VERSION: () => PLUGIN_VERSION, __internals: () => __internals });
		module.exports = __toCommonJS(index_exports);

		return module.exports;
	}
});
