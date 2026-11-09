// lib/h5-page.js — 锻炉 H5 阅读台（单文件页面）。
//
// 设计约束（与需求逐条对应）：
//   - 零外部依赖：CSS / JS 全部内联，无 CDN、无字体文件、无构建步骤；
//   - 右侧栏 iframe 友好：移动优先，≤520px 底部 tab，>860px 左侧 nav 且阅读层
//     可两栏（左目录 / 右正文）；页面也允许直接浏览器打开；
//   - 中文排版：正文 18px 起、行高 2.0、段首缩进 2em、两端对齐、行宽 42em；
//   - 三套主题（paper / eye / night）+ 字号 / 行高，localStorage 记忆（nf-h5- 前缀）；
//   - 正文一律 textContent / createTextNode；API 错误文案同样 textContent，绝不拼接 innerHTML；
//   - 错误只走顶部可关闭 toast / 页面内错误卡，加载态用 skeleton，无 alert / confirm。
//
// 导出一个纯函数：renderH5Page({ basePath }) => 完整 HTML 字符串。
// 不在模块加载期触碰 DOM / localStorage，方便服务端与测试直接 import。

export function renderH5Page({ basePath = '/api/novel-forge' } = {}) {
    const rawBase = typeof basePath === 'string' && basePath.trim() !== '' ? basePath.trim() : '/api/novel-forge';
    // 注入到内联脚本里的 JSON 字面量：转义 < 防 </script> 提前闭合，转义行分隔符保安全。
    const baseJson = JSON.stringify(rawBase)
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');

    const html = String.raw`<!doctype html>
<html lang="zh-CN" data-theme="paper">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="referrer" content="same-origin">
<meta name="color-scheme" content="light dark">
<title>锻炉 · 阅读台</title>
<script>
(function () {
    try {
        var d = document.documentElement;
        var t = localStorage.getItem('nf-h5-theme');
        if (t === 'eye' || t === 'night') d.setAttribute('data-theme', t);
        var fs = Number(localStorage.getItem('nf-h5-font'));
        if (fs >= 15 && fs <= 22) d.style.setProperty('--prose-size', fs + 'px');
        var lh = Number(localStorage.getItem('nf-h5-line'));
        if (lh >= 1.7 && lh <= 2.2) d.style.setProperty('--prose-line', String(lh));
    } catch (e) { /* localStorage 不可用时用默认排版 */ }
})();
</script>
<style>
/* ============================================================
   主题变量：paper / eye / night
   ============================================================ */
:root {
    --font: "Noto Serif SC", "Source Han Serif SC", "Songti SC", SimSun, serif;
    --bg: #faf7f2;
    --fg: #2b2722;
    --muted: #7a7165;
    --card: #fffdf9;
    --border: #e6dfd3;
    --accent: #b4552d;
    --accent-fg: #fffaf4;
    --accent-soft: #f3e3d9;
    --accent-border: #e3c1ae;
    --chip: #f2ebe0;
    --hover: #f3ede4;
    --sk: #eee7dc;
    --danger: #a63b31;
    --danger-soft: #f9e9e5;
    --danger-border: #e8bdb5;
    --ok: #4d6b3f;
    --ok-soft: #e8f0e1;
    --ok-border: #c6d8b9;
    --warn: #8a6420;
    --warn-soft: #f6edda;
    --warn-border: #e3cfa5;
    --shadow: 0 1px 2px rgba(43, 39, 34, .04), 0 8px 22px rgba(43, 39, 34, .045);
    --prose-size: 18px;
    --prose-line: 2;
    color-scheme: light;
}
html[data-theme="eye"] {
    --bg: #e9f0e3;
    --fg: #283025;
    --muted: #66705e;
    --card: #f4f8ef;
    --border: #d4deca;
    --accent: #3f6b45;
    --accent-fg: #f7fbf3;
    --accent-soft: #dcead4;
    --accent-border: #b9d0ae;
    --chip: #dfe9d7;
    --hover: #e1ebda;
    --sk: #dce6d4;
    --danger: #90382f;
    --danger-soft: #f4e4e0;
    --danger-border: #ddb9b1;
    --ok: #426b39;
    --ok-soft: #dcebd3;
    --ok-border: #b7d1a8;
    --warn: #7d5a1e;
    --warn-soft: #f0e7d1;
    --warn-border: #d8c69c;
    --shadow: 0 1px 2px rgba(40, 48, 37, .04), 0 8px 22px rgba(40, 48, 37, .05);
    color-scheme: light;
}
html[data-theme="night"] {
    --bg: #15171a;
    --fg: #c9c4bb;
    --muted: #8e897f;
    --card: #1d2024;
    --border: #30343a;
    --accent: #d9a441;
    --accent-fg: #1b1305;
    --accent-soft: #332a1c;
    --accent-border: #5a4928;
    --chip: #26292e;
    --hover: #23262b;
    --sk: #26292e;
    --danger: #e0806f;
    --danger-soft: #2d1e1b;
    --danger-border: #553029;
    --ok: #9fbd8d;
    --ok-soft: #202920;
    --ok-border: #3a4d34;
    --warn: #d2ab60;
    --warn-soft: #2c2517;
    --warn-border: #4f4226;
    --shadow: 0 1px 2px rgba(0, 0, 0, .25), 0 10px 28px rgba(0, 0, 0, .22);
    color-scheme: dark;
}

/* ============================================================
   基础与排版
   ============================================================ */
* { box-sizing: border-box; }
html {
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
    background: var(--bg);
}
body {
    margin: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: var(--font);
    font-size: 15px;
    line-height: 1.55;
    letter-spacing: .2px;
    min-height: 100vh;
    transition: background-color .16s ease, color .16s ease;
}
body.reader-open { overflow: hidden; }
button, input, select, textarea { font: inherit; color: inherit; }
button { font-family: var(--font); }
[hidden] { display: none !important; }
:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}
::selection { background: var(--accent-soft); color: var(--fg); }
* { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }

.visually-hidden {
    position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
.skip-link {
    position: absolute; left: -999px; top: 8px; z-index: 300;
    padding: 8px 12px; border-radius: 9px; background: var(--accent); color: var(--accent-fg);
    text-decoration: none;
}
.skip-link:focus { left: 8px; }

/* ============================================================
   顶栏
   ============================================================ */
.topbar {
    position: sticky; top: 0; z-index: 30;
    display: flex; align-items: center; gap: 6px;
    min-height: 58px;
    padding: 6px 10px;
    padding-top: calc(6px + env(safe-area-inset-top));
    background: var(--bg);
    border-bottom: 1px solid var(--border);
}
.back-btn { flex: none; }
.brand-btn {
    flex: 1 1 auto; min-width: 0; min-height: 44px;
    display: flex; align-items: center; gap: 9px;
    padding: 3px 4px; border: 0; border-radius: 12px;
    background: transparent; color: var(--fg); text-align: left; cursor: pointer;
    transition: background-color .14s ease;
}
.brand-btn:hover { background: var(--hover); }
.brand-mark {
    flex: none; width: 34px; height: 34px; border-radius: 10px;
    display: grid; place-items: center;
    background: var(--accent-soft); color: var(--accent);
    border: 1px solid var(--accent-border);
    font-size: 17px; font-weight: 600;
}
.topbar-text { min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
.book-title {
    font-size: 15.5px; font-weight: 600; letter-spacing: .3px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.book-sub {
    margin-top: 1px; font-size: 11px; color: var(--muted);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.stage-chip {
    flex: none; display: inline-flex; align-items: center;
    min-height: 24px; padding: 3px 9px; border-radius: 999px;
    border: 1px solid var(--border); background: var(--chip); color: var(--muted);
    font-size: 11px; line-height: 1; white-space: nowrap;
}
.icon-btn {
    flex: none; width: 44px; height: 44px;
    display: grid; place-items: center;
    border: 1px solid transparent; border-radius: 12px;
    background: transparent; color: var(--muted);
    font-size: 18px; line-height: 1; cursor: pointer;
    transition: background-color .14s ease, color .14s ease, border-color .14s ease;
    -webkit-tap-highlight-color: transparent;
}
.icon-btn:hover { background: var(--hover); color: var(--fg); }
.icon-btn:active { transform: translateY(1px); }
.back-btn { font-size: 20px; }

/* ============================================================
   主区域 / 视图
   ============================================================ */
.app-main {
    max-width: 760px;
    margin: 0 auto;
    padding: 16px 14px calc(88px + env(safe-area-inset-bottom));
}
.view { animation: view-in .16s ease-out; }
@keyframes view-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.view-title { margin: 0; font-size: 23px; font-weight: 600; letter-spacing: .5px; }
.view-sub { margin: 4px 0 0; font-size: 12px; color: var(--muted); }
.toc-title-line { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.toc-count { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }

/* ============================================================
   卡片 / 按钮 / 徽标
   ============================================================ */
.card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: var(--shadow);
    padding: 16px;
}
.btn {
    display: inline-flex; align-items: center; justify-content: center;
    min-height: 44px; padding: 0 16px;
    border: 1px solid var(--border); border-radius: 12px;
    background: var(--card); color: var(--fg);
    font-size: 14px; line-height: 1.2; letter-spacing: .3px;
    text-decoration: none; cursor: pointer;
    transition: background-color .14s ease, border-color .14s ease, color .14s ease, transform .12s ease;
    -webkit-tap-highlight-color: transparent;
}
.btn:hover { background: var(--hover); }
.btn:active { transform: translateY(1px); }
.btn:disabled { opacity: .45; cursor: default; transform: none; }
.btn.primary {
    background: var(--accent); border-color: var(--accent); color: var(--accent-fg); font-weight: 600;
}
.btn.primary:hover { filter: brightness(1.04); background: var(--accent); }
.btn.ghost { background: transparent; }
.btn.small { min-height: 40px; padding: 0 12px; font-size: 13px; }
.badge {
    display: inline-flex; align-items: center;
    padding: 2px 8px; border-radius: 999px;
    background: var(--accent-soft); color: var(--accent);
    border: 1px solid transparent;
    font-size: 11.5px; line-height: 1.6; white-space: nowrap;
}
.badge.ok { background: var(--ok-soft); color: var(--ok); border-color: var(--ok-border); }
.badge.warn { background: var(--warn-soft); color: var(--warn); border-color: var(--warn-border); }
.badge.danger { background: var(--danger-soft); color: var(--danger); border-color: var(--danger-border); }
.pill {
    display: inline-flex; align-items: center;
    padding: 3px 9px; border-radius: 999px;
    background: var(--chip); color: var(--muted);
    border: 1px solid var(--border);
    font-size: 11px; line-height: 1.5; white-space: nowrap;
}

/* ============================================================
   书架
   ============================================================ */
.shelf-head {
    display: flex; align-items: flex-end; justify-content: space-between; gap: 12px;
    margin-bottom: 14px;
}
.book-list { display: flex; flex-direction: column; gap: 10px; }
.book-card {
    display: flex; align-items: center; gap: 14px; width: 100%;
    min-height: 86px; padding: 14px; text-align: left;
    border: 1px solid var(--border); border-radius: 16px;
    background: var(--card); color: var(--fg);
    box-shadow: var(--shadow); cursor: pointer;
    transition: transform .16s ease, border-color .16s ease, background-color .16s ease;
    -webkit-tap-highlight-color: transparent;
}
.book-card:hover { border-color: var(--accent-border); }
.book-card:active { transform: scale(.995); }
.book-cover {
    flex: none; width: 48px; height: 64px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    background: var(--accent-soft); color: var(--accent);
    border: 1px solid var(--accent-border);
    font-size: 22px; font-weight: 600; line-height: 1;
}
.book-main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.book-title {
    font-size: 16px; font-weight: 600; line-height: 1.4;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.book-meta {
    display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
    margin-top: 4px; font-size: 12px; color: var(--muted);
}
.book-sub {
    margin-top: 5px; font-size: 12px; color: var(--muted);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.book-arrow { flex: none; color: var(--muted); font-size: 19px; padding-right: 2px; }

/* ============================================================
   工作台
   ============================================================ */
.hero { position: relative; overflow: hidden; padding: 18px; }
.hero::before {
    content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
    background: var(--accent); border-radius: 16px 0 0 16px;
}
.eyebrow {
    font-size: 10.5px; letter-spacing: .18em; color: var(--muted);
    text-transform: none;
}
.hero-next {
    display: flex; align-items: center; gap: 9px; flex-wrap: wrap;
    margin-top: 6px;
}
.hero-no { font-size: 27px; font-weight: 600; letter-spacing: .5px; line-height: 1.25; }
.hero-sub {
    margin-top: 8px; font-size: 12.5px; color: var(--muted);
    font-variant-numeric: tabular-nums;
}
.hero-summary {
    margin: 12px 0 0; font-size: 14px; line-height: 1.75; color: var(--fg);
    display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
}
.hero-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 15px; }
.hero-actions .btn.primary { flex: 0 1 auto; }

.stats-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
    margin: 12px 0;
}
.stat-card {
    padding: 13px 14px;
    border: 1px solid var(--border); border-radius: 16px;
    background: var(--card); box-shadow: var(--shadow);
}
.stat-label { font-size: 12px; color: var(--muted); }
.stat-value {
    margin-top: 5px;
    font-size: 23px; font-weight: 600; line-height: 1.25; letter-spacing: .4px;
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
}
.stat-sub { margin-top: 3px; font-size: 11.5px; color: var(--muted); line-height: 1.45; }

.section-head { margin-bottom: 4px; }
.section-title { margin: 0; font-size: 15.5px; font-weight: 600; letter-spacing: .3px; }
.section-desc { margin: 3px 0 0; font-size: 11.5px; color: var(--muted); line-height: 1.55; }
.kv-row {
    display: flex; align-items: flex-start; justify-content: space-between; gap: 18px;
    padding: 11px 0; border-bottom: 1px dashed var(--border);
    font-size: 13.5px;
}
.kv-row:last-child { border-bottom: 0; padding-bottom: 0; }
.kv-key { flex: none; color: var(--muted); padding-top: 1px; }
.kv-val {
    min-width: 0; display: flex; flex-direction: column; align-items: flex-end;
    text-align: right; overflow-wrap: anywhere;
}
.kv-main { font-variant-numeric: tabular-nums; }
.kv-note { margin-top: 3px; font-size: 11px; line-height: 1.5; color: var(--muted); }

.promise { padding: 0 16px; margin-top: 12px; }
.promise-summary {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    min-height: 50px; cursor: pointer; list-style: none;
    font-size: 14.5px; font-weight: 600; letter-spacing: .3px;
}
.promise-summary::-webkit-details-marker { display: none; }
.promise .chev { color: var(--muted); font-size: 15px; transition: transform .16s ease; }
.promise[open] .chev { transform: rotate(180deg); }
.promise-text {
    margin: 0 0 14px; font-size: 14px; line-height: 1.85; color: var(--fg);
    white-space: pre-wrap; overflow-wrap: anywhere;
}
.promise .btn { margin-bottom: 14px; }

/* ============================================================
   目录
   ============================================================ */
.toc-head { display: flex; flex-direction: column; gap: 12px; margin-bottom: 13px; }
.search-wrap { display: block; position: relative; }
.search-input {
    width: 100%; min-height: 44px; padding: 0 14px;
    border: 1px solid var(--border); border-radius: 12px;
    background: var(--card); color: var(--fg);
    font-size: 14px; letter-spacing: .2px;
    outline: none;
    transition: border-color .14s ease, box-shadow .14s ease;
}
.search-input::placeholder { color: var(--muted); opacity: .8; }
.search-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.toc-list {
    background: var(--card); border: 1px solid var(--border); border-radius: 16px;
    overflow: hidden; box-shadow: var(--shadow);
}
.toc-row {
    display: flex; align-items: flex-start; gap: 11px; width: 100%;
    min-height: 58px; padding: 12px 13px; text-align: left;
    border: 0; border-bottom: 1px solid var(--border); border-radius: 0;
    background: transparent; color: var(--fg); cursor: pointer;
    transition: background-color .13s ease, color .13s ease;
    -webkit-tap-highlight-color: transparent;
}
.toc-row:last-child { border-bottom: 0; }
.toc-row:hover { background: var(--hover); }
.toc-row.is-read:not(.is-current) { color: var(--muted); }
.toc-row.is-current { background: var(--accent-soft); }
.toc-no {
    flex: none; width: 2.5em; padding-top: 2px;
    text-align: right; font-size: 12px; color: var(--muted);
    font-variant-numeric: tabular-nums;
}
.toc-row.is-current .toc-no { color: var(--accent); }
.toc-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.toc-title {
    font-size: 14.5px; font-weight: 600; line-height: 1.45;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.toc-sum {
    font-size: 12.5px; color: var(--muted); line-height: 1.5;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.toc-meta {
    flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
    font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums;
    padding-top: 1px;
}
.toc-flag { color: var(--accent); font-size: 10.5px; white-space: nowrap; }
.toc-filter-empty {
    padding: 26px 16px; text-align: center; color: var(--muted); font-size: 13px;
}

/* ============================================================
   设置
   ============================================================ */
.settings-card { margin-bottom: 12px; }
.field { display: flex; flex-direction: column; gap: 6px; margin-top: 13px; }
.field-label { font-size: 13px; font-weight: 600; letter-spacing: .2px; }
.field-hint { font-size: 11.5px; color: var(--muted); line-height: 1.55; }
.input, .select, .textarea {
    width: 100%; min-height: 44px; padding: 10px 12px;
    border: 1px solid var(--border); border-radius: 12px;
    background: var(--bg); color: var(--fg);
    font-size: 14px; line-height: 1.55; letter-spacing: .2px;
    outline: none;
    transition: border-color .14s ease, box-shadow .14s ease;
}
.textarea { min-height: 92px; resize: vertical; }
.input:focus, .select:focus, .textarea:focus {
    border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft);
}
.input::placeholder, .textarea::placeholder { color: var(--muted); opacity: .8; }
.form-actions { display: flex; flex-wrap: wrap; gap: 9px; margin-top: 16px; }
.form-note { margin: 12px 0 0; font-size: 11.5px; color: var(--muted); line-height: 1.6; }
.range-row { display: flex; align-items: center; gap: 12px; }
.range {
    flex: 1; min-height: 40px; accent-color: var(--accent);
    background: transparent; cursor: pointer;
}
.range-val {
    flex: none; width: 3.6em; text-align: right;
    font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums;
}
.theme-options { display: flex; flex-wrap: wrap; gap: 8px; }
.theme-opt {
    flex: 1 1 88px; min-width: 88px; min-height: 68px;
    display: flex; flex-direction: column; align-items: stretch; justify-content: center; gap: 7px;
    padding: 9px 10px; text-align: left;
    border: 1px solid var(--border); border-radius: 13px;
    background: var(--card); color: var(--fg);
    font-size: 12px; cursor: pointer;
    transition: border-color .14s ease, box-shadow .14s ease, background-color .14s ease;
}
.theme-opt:hover { background: var(--hover); }
.theme-opt.is-active { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-soft); }
.theme-swatch {
    display: flex; align-items: center; justify-content: center;
    height: 22px; border-radius: 6px; border: 1px solid var(--border);
    font-size: 11px; letter-spacing: .5px;
}
.sw-paper { background: #faf7f2; color: #2b2722; }
.sw-eye { background: #e9f0e3; color: #283025; }
.sw-night { background: #15171a; color: #c9c4bb; }
.theme-name { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.about-list { margin: 10px 0 0; padding-left: 19px; color: var(--muted); font-size: 12.5px; line-height: 1.85; }
.about-list li + li { margin-top: 5px; }
.about-list strong { color: var(--fg); font-weight: 600; }
.about-mono { overflow-wrap: anywhere; }

/* ============================================================
   Toast / 骨架 / 错误 / 空态
   ============================================================ */
.toast-host {
    position: fixed; top: calc(12px + env(safe-area-inset-top)); left: 50%;
    transform: translateX(-50%);
    z-index: 120;
    width: min(440px, calc(100vw - 20px));
    display: flex; flex-direction: column; gap: 8px;
    pointer-events: none;
}
.toast {
    pointer-events: auto;
    display: flex; align-items: flex-start; gap: 8px;
    padding: 10px 8px 10px 13px;
    border: 1px solid var(--border); border-radius: 13px;
    background: var(--card); color: var(--fg);
    box-shadow: 0 10px 30px rgba(0, 0, 0, .16);
    font-size: 13px; line-height: 1.55;
    animation: toast-in .16s ease-out;
}
@keyframes toast-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
.toast.error { border-color: var(--danger-border); background: var(--danger-soft); }
.toast.success { border-color: var(--ok-border); }
.toast-msg { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.toast-x {
    flex: none; width: 40px; height: 40px; margin: -6px -4px -6px 0;
    border: 0; border-radius: 10px; background: transparent;
    color: var(--muted); font-size: 19px; line-height: 1; cursor: pointer;
}
.toast-x:hover { background: var(--hover); color: var(--fg); }

.sk {
    border-radius: 12px; background: var(--sk);
    animation: sk-pulse 1.4s ease-in-out infinite;
}
@keyframes sk-pulse {
    0%, 100% { opacity: .55; }
    50% { opacity: 1; }
}
.sk-hero { height: 168px; border-radius: 16px; margin-bottom: 12px; }
.sk-stat { height: 84px; border-radius: 16px; }
.sk-card { height: 210px; border-radius: 16px; margin-top: 12px; }
.sk-line { height: 12px; margin: 13px 0; }
.sk-toc-no { flex: none; width: 2.5em; height: 14px; margin-top: 2px; border-radius: 5px; }
.sk-line.short { width: 42%; }
.sk-line.mid { width: 68%; }
.sk-line.long { width: 88%; }
.reader-sk { height: 15px; margin: 20px 0; border-radius: 7px; }
.reader-sk-wrap { padding: 6px 0; }

.error-card { border-color: var(--danger-border); background: var(--danger-soft); }
.error-title { margin: 0; font-size: 15px; font-weight: 600; color: var(--danger); letter-spacing: .2px; }
.error-code { margin-top: 4px; font-size: 10.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.error-msg {
    margin: 8px 0 13px; font-size: 13px; line-height: 1.7; color: var(--fg);
    white-space: pre-wrap; overflow-wrap: anywhere;
}
.error-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.empty-state { padding: 34px 20px; text-align: center; color: var(--muted); }
.empty-title { margin: 0 0 7px; font-size: 16px; font-weight: 600; color: var(--fg); }
.empty-text { max-width: 30em; margin: 0 auto 15px; font-size: 13px; line-height: 1.7; }
.toc-empty { padding: 0; }

/* ============================================================
   阅读层（全屏 sheet）
   ============================================================ */
.reader {
    position: fixed; inset: 0; z-index: 80;
    display: flex; flex-direction: column;
    background: var(--bg); color: var(--fg);
    opacity: 0; transform: translateY(8px);
    transition: opacity .16s ease, transform .16s ease;
}
.reader.is-open { opacity: 1; transform: none; }
.reader:focus { outline: none; }
.reader-bar {
    display: flex; align-items: center; flex-wrap: wrap; gap: 4px;
    padding: 6px 8px;
    padding-top: calc(6px + env(safe-area-inset-top));
    min-height: 56px;
    background: var(--card);
    border-bottom: 1px solid var(--border);
}
.reader-heading { flex: 1 1 150px; min-width: 0; display: flex; flex-direction: column; padding: 2px 4px; }
.reader-title {
    font-size: 14.5px; font-weight: 600; line-height: 1.35; letter-spacing: .2px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.reader-meta {
    margin-top: 2px; font-size: 10.5px; color: var(--muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.reader-tools { display: flex; align-items: center; gap: 1px; flex: none; }
.tool-btn {
    min-width: 44px; height: 44px; padding: 0 8px;
    display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid transparent; border-radius: 11px;
    background: transparent; color: var(--fg);
    font-size: 12.5px; letter-spacing: .2px; cursor: pointer;
    transition: background-color .14s ease;
    -webkit-tap-highlight-color: transparent;
}
.tool-btn:hover { background: var(--hover); }
.font-readout {
    min-width: 2.1em; text-align: center;
    font-size: 10.5px; color: var(--muted); font-variant-numeric: tabular-nums;
}
.reader-shell { flex: 1; min-height: 0; display: flex; }
.reader-toc {
    display: none; flex: 0 0 252px; overflow-y: auto;
    padding: 10px; border-right: 1px solid var(--border);
    background: var(--card); overscroll-behavior: contain;
}
.reader-toc-title {
    padding: 7px 8px 10px; font-size: 10.5px; letter-spacing: .14em; color: var(--muted);
}
.reader-toc-item {
    display: block; width: 100%; min-height: 40px; padding: 9px 10px;
    text-align: left; border: 0; border-radius: 10px;
    background: transparent; color: var(--fg);
    font-size: 12.5px; line-height: 1.5; cursor: pointer;
    transition: background-color .13s ease, color .13s ease;
}
.reader-toc-item:hover { background: var(--hover); }
.reader-toc-item.is-current { background: var(--accent-soft); color: var(--accent); }
.reader-toc-empty { padding: 8px; font-size: 12px; color: var(--muted); }
.reader-scroll {
    flex: 1; min-width: 0; overflow-y: auto;
    overscroll-behavior: contain; -webkit-overflow-scrolling: touch;
    scroll-behavior: auto;
}
.reader-pad { padding: 24px 18px 48px; }
.reader-foot {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: 7px 10px;
    padding-bottom: calc(7px + env(safe-area-inset-bottom));
    background: var(--card); border-top: 1px solid var(--border);
}
.reader-nav { min-width: 92px; }
.reader-pos {
    flex: 1; text-align: center;
    font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums;
}

/* ============================================================
   正文排版
   ============================================================ */
.prose {
    max-width: 42em;
    margin: 0 auto;
    font-family: "Noto Serif SC", "Source Han Serif SC", "Songti SC", SimSun, serif;
    font-size: var(--prose-size, 18px);
    line-height: var(--prose-line, 2);
    letter-spacing: .3px;
    color: var(--fg);
    text-align: justify;
    text-justify: inter-ideograph;
    text-wrap: pretty;
    hanging-punctuation: allow-end;
    overflow-wrap: break-word;
}
.prose p {
    margin: 0 0 1em;
    text-indent: 2em;
    text-align: justify;
    text-wrap: pretty;
    orphans: 2;
    widows: 2;
}
.prose p:last-child { margin-bottom: 0; }
.prose .scene-break {
    margin: 1.7em 0;
    text-indent: 0;
    text-align: center;
    color: var(--muted);
    letter-spacing: .55em;
    font-size: .92em;
}
.prose h2 {
    margin: 1.5em 0 .75em;
    text-indent: 0;
    font-size: 1.12em;
    line-height: 1.65;
    font-weight: 600;
    letter-spacing: .6px;
    text-align: left;
}
.prose h2:first-child { margin-top: 0; }
.prose br { line-height: inherit; }
.reader-state { padding: 40px 6px; text-align: center; }
.reader-state-title { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
.reader-state-text {
    max-width: 30em; margin: 0 auto 15px;
    font-size: 13px; line-height: 1.75; color: var(--muted);
    white-space: pre-wrap; overflow-wrap: anywhere;
}
.reader-state .btn { min-width: 92px; }
.reader-empty { padding: 50px 0; text-align: center; color: var(--muted); font-size: 14px; }

/* ============================================================
   底部 tab / 宽屏左侧 nav
   ============================================================ */
.tabbar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 32;
    display: flex; justify-content: space-around; gap: 4px;
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
    background: var(--bg);
    border-top: 1px solid var(--border);
}
.tab {
    flex: 1 1 0; max-width: 170px; min-height: 52px; padding: 4px 8px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    border: 1px solid transparent; border-radius: 12px;
    background: transparent; color: var(--muted);
    font-size: 11.5px; letter-spacing: .2px; cursor: pointer;
    transition: background-color .14s ease, color .14s ease;
    -webkit-tap-highlight-color: transparent;
}
.tab .tab-ic { font-size: 18px; line-height: 1; }
.tab.is-active { color: var(--accent); background: var(--accent-soft); }
.tab.is-disabled { opacity: .45; }
.tab:hover { color: var(--fg); }
.tab.is-active:hover { color: var(--accent); }

/* ============================================================
   响应式：521px+ / 861px+
   ============================================================ */
@media (min-width: 521px) {
    .topbar { padding-left: 14px; padding-right: 14px; }
    .app-main { padding: 22px 22px calc(96px + env(safe-area-inset-bottom)); }
    .stats-grid { gap: 12px; }
    .card { padding: 18px; }
    .reader-pad { padding: 32px 30px 60px; }
}
@media (min-width: 861px) {
    .app-main {
        max-width: 820px; margin: 0 auto 0 208px;
        padding: 28px 34px 80px;
    }
    .tabbar {
        top: 58px; bottom: 0; left: 0; right: auto; width: 208px;
        flex-direction: column; justify-content: flex-start;
        padding: 16px 12px; gap: 5px;
        border-top: 0; border-right: 1px solid var(--border);
    }
    .tab {
        flex: 0 0 auto; max-width: none; width: 100%; min-height: 46px;
        flex-direction: row; justify-content: flex-start; gap: 10px;
        padding: 0 14px; font-size: 13.5px;
    }
    .reader-toc { display: block; }
    .reader-pad { padding: 40px 52px 72px; }
    .reader-nav { min-width: 120px; }
}
@media (max-width: 430px) {
    .reader-tools {
        order: 3; width: 100%; justify-content: flex-end;
        margin-top: 3px; padding-top: 3px;
        border-top: 1px dashed var(--border);
    }
    .reader-heading { flex-basis: 120px; }
    .hero-no { font-size: 24px; }
    .stat-value { font-size: 21px; }
}
@media (max-width: 360px) {
    .brand-mark { display: none; }
    .book-cover { width: 42px; height: 58px; font-size: 19px; }
    .book-title { font-size: 15px; }
    .tab { font-size: 11px; }
}

/* ============================================================
   无障碍：减少动效
   ============================================================ */
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: .001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: .001ms !important;
        scroll-behavior: auto !important;
    }
}
</style>
</head>
<body>
<a class="skip-link" href="#main">跳到主内容</a>
<div class="toast-host" id="toastHost" aria-live="polite" aria-atomic="false"></div>

<header class="topbar" id="topbar">
    <button class="icon-btn back-btn" id="backBtn" type="button" data-action="back-shelf" aria-label="返回书架" title="返回书架" hidden>←</button>
    <button class="brand-btn" id="brandBtn" type="button" data-action="back-shelf" title="返回书架">
        <span class="brand-mark" aria-hidden="true">炉</span>
        <span class="topbar-text">
            <span class="book-title" id="bookTitle">锻炉书架</span>
            <span class="book-sub" id="bookSub">选一本在读的书，继续</span>
        </span>
    </button>
    <span class="stage-chip" id="stageChip" hidden></span>
    <button class="icon-btn" type="button" data-action="open-settings" aria-label="设置" title="设置">⚙</button>
</header>

<main id="main" class="app-main">
    <section id="view-shelf" class="view" aria-label="书架">
        <div class="shelf-head">
            <div>
                <h1 class="view-title">书架</h1>
                <p class="view-sub" id="shelfHint">选择一本书开始</p>
            </div>
            <button class="icon-btn" type="button" data-action="retry-books" aria-label="刷新书架" title="刷新书架">↻</button>
        </div>
        <div id="shelfBody"></div>
    </section>

    <section id="view-workbench" class="view" aria-label="工作台" hidden>
        <div id="workbenchBody"></div>
    </section>

    <section id="view-toc" class="view" aria-label="目录" hidden>
        <div class="toc-head">
            <div class="toc-title-line">
                <h1 class="view-title">目录</h1>
                <span class="toc-count" id="tocCount"></span>
            </div>
            <label class="search-wrap">
                <span class="visually-hidden">搜索章节</span>
                <input class="search-input" id="tocSearch" type="search" placeholder="搜章号 / 标题 / 摘要" autocomplete="off" spellcheck="false">
            </label>
        </div>
        <div id="tocBody"></div>
    </section>

    <section id="view-settings" class="view" aria-label="设置" hidden>
        <div class="toc-title-line">
            <h1 class="view-title">设置</h1>
        </div>
        <div id="settingsBody"></div>
    </section>
</main>

<nav class="tabbar" id="tabbar" aria-label="主导航">
    <button class="tab" type="button" data-action="goto-workbench" data-tab="workbench">
        <span class="tab-ic" aria-hidden="true">▤</span><span>工作台</span>
    </button>
    <button class="tab" type="button" data-action="goto-toc" data-tab="toc">
        <span class="tab-ic" aria-hidden="true">☰</span><span>目录</span>
    </button>
    <button class="tab" type="button" data-action="goto-settings" data-tab="settings">
        <span class="tab-ic" aria-hidden="true">⚙</span><span>设置</span>
    </button>
</nav>

<section id="reader" class="reader" role="dialog" aria-modal="true" aria-label="阅读" tabindex="-1" hidden>
    <header class="reader-bar">
        <button class="icon-btn" type="button" id="readerClose" data-action="close-reader" aria-label="关闭阅读" title="关闭阅读">←</button>
        <div class="reader-heading">
            <span class="reader-title" id="readerTitle">阅读</span>
            <span class="reader-meta" id="readerMeta"></span>
        </div>
        <div class="reader-tools">
            <button class="tool-btn" type="button" data-action="font-dec" aria-label="减小字号" title="减小字号">A−</button>
            <span class="font-readout" id="fontReadout">18</span>
            <button class="tool-btn" type="button" data-action="font-inc" aria-label="增大字号" title="增大字号">A+</button>
            <button class="icon-btn" type="button" id="themeBtn" data-action="theme-cycle" aria-label="切换主题" title="切换主题">◐</button>
        </div>
    </header>
    <div class="reader-shell">
        <aside class="reader-toc" id="readerToc" aria-label="阅读目录"></aside>
        <div class="reader-scroll" id="readerScroll" data-chapter="0">
            <div class="reader-pad">
                <article class="prose" id="readerBody"></article>
            </div>
        </div>
    </div>
    <footer class="reader-foot">
        <button class="btn ghost reader-nav" type="button" id="prevBtn" data-action="prev-chapter">上一章</button>
        <span class="reader-pos" id="readerPos">第 — / — 章</span>
        <button class="btn ghost reader-nav" type="button" id="nextBtn" data-action="next-chapter">下一章</button>
    </footer>
</section>

<script>
(function () {
    'use strict';

    var API_BASE = __NF_API_BASE__;
    var FENCE = 'x-dsh-novel-forge';
    var PREFIX = 'nf-h5-';
    var PLATFORM_NAMES = { qidian: '起点', fanqie: '番茄', jjwxc: '晋江', qimao: '七猫', feilu: '飞卢' };
    var STAGE_NAMES = {
        topic: '立意', setting: '设定', character: '人物', outline: '大纲', volume: '分卷',
        chapter: '细纲', writing: '正文', revision: '修订', done: '完稿',
        planning: '规划', drafting: '正文', revising: '修订'
    };
    var THEME_NAMES = { paper: '纸白', eye: '护眼', night: '夜间' };

    var params = new URLSearchParams(location.search);
    var SID = String(params.get('session') || '').trim();
    var initialBook = String(params.get('book') || '').trim();

    var state = {
        view: 'shelf',
        book: initialBook,
        detail: null,
        detailError: null,
        chapters: null,
        chaptersError: null,
        books: null,
        booksError: null,
        tocQuery: '',
        lastChapter: 0,
        settings: { saving: false },
        reader: { open: false, no: 0, loading: false, error: null, restoring: false, opener: null }
    };
    var loadToken = 0;
    var readerToken = 0;
    var scrollSaveTimer = null;

    /* ------------------------------------------------------------
       基础工具
       ------------------------------------------------------------ */
    function $(id) { return document.getElementById(id); }
    function num(v, d) { var n = Number(v); return isFinite(n) ? n : d; }
    function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
    function isTheme(t) { return t === 'paper' || t === 'eye' || t === 'night'; }
    function themeName(t) { return THEME_NAMES[t] || '纸白'; }
    function lsGet(k, d) {
        try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; }
    }
    function lsSet(k, v) {
        try { localStorage.setItem(k, String(v)); } catch (e) { /* 隐私模式写不进就用默认值 */ }
    }
    function mk(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined && text !== null) n.textContent = String(text);
        return n;
    }
    function clear(n) {
        while (n && n.firstChild) n.removeChild(n.firstChild);
    }
    function enc(v) { return encodeURIComponent(String(v == null ? '' : v)); }
    function firstChar(s) {
        var arr = Array.from(String(s == null ? '' : s).trim());
        return arr.length ? arr[0] : '书';
    }
    function fmtInt(n) {
        var x = Math.round(Number(n) || 0);
        return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    function fmtWords(n) {
        var x = Math.max(0, Number(n) || 0);
        if (x >= 10000) {
            var w = x / 10000;
            return (w >= 100 ? String(Math.round(w)) : w.toFixed(1).replace(/\.0$/, '')) + ' 万';
        }
        return fmtInt(x);
    }
    function fmtDate(s) {
        if (!s) return '';
        var d = new Date(s);
        if (isNaN(d.getTime())) return '';
        return (d.getMonth() + 1) + '月' + d.getDate() + '日';
    }
    function stageName(stage) {
        if (!stage) return '';
        return STAGE_NAMES[stage] || String(stage);
    }

    /* ------------------------------------------------------------
       API（全部请求带 fence；session 统一拼在 query）
       ------------------------------------------------------------ */
    function api(path, options) {
        options = options || {};
        var url = API_BASE + path;
        if (SID) url += (url.indexOf('?') === -1 ? '?' : '&') + 'session=' + encodeURIComponent(SID);
        var init = {
            method: options.method || 'GET',
            headers: { 'x-dsh-novel-forge': '1' },
            cache: 'no-store'
        };
        if (options.body !== undefined) {
            init.headers['content-type'] = 'application/json';
            init.body = JSON.stringify(options.body);
        }
        return fetch(url, init).catch(function (err) {
            var e = new Error('无法连接锻炉服务：' + (err && err.message ? err.message : '网络错误'));
            e.code = 'NETWORK';
            throw e;
        }).then(function (res) {
            return res.json().catch(function () { return null; }).then(function (data) {
                if (!res.ok || !data || data.ok !== true) {
                    var msg = data && data.error && data.error.message
                        ? String(data.error.message)
                        : ('请求失败（HTTP ' + res.status + '）');
                    var e = new Error(msg);
                    e.code = (data && data.error && data.error.code) || ('HTTP_' + res.status);
                    e.status = res.status;
                    if (data && data.error && data.error.advice) e.advice = String(data.error.advice);
                    throw e;
                }
                return data.value;
            });
        });
    }

    /* ------------------------------------------------------------
       阅读偏好
       ------------------------------------------------------------ */
    var prefs = {
        theme: (function () { var t = lsGet(PREFIX + 'theme', 'paper'); return isTheme(t) ? t : 'paper'; })(),
        fontSize: clamp(Math.round(num(lsGet(PREFIX + 'font', '18'), 18)), 15, 22),
        lineHeight: clamp(Math.round(num(lsGet(PREFIX + 'line', '2'), 2) * 10) / 10, 1.7, 2.2)
    };

    function applyPrefs() {
        var root = document.documentElement;
        root.setAttribute('data-theme', prefs.theme);
        root.style.setProperty('--prose-size', prefs.fontSize + 'px');
        root.style.setProperty('--prose-line', String(prefs.lineHeight));

        var readout = $('fontReadout');
        if (readout) readout.textContent = String(prefs.fontSize);
        var fontRange = $('fontRange');
        if (fontRange && Number(fontRange.value) !== prefs.fontSize) fontRange.value = String(prefs.fontSize);
        var fontOut = $('fontOut');
        if (fontOut) fontOut.textContent = prefs.fontSize + 'px';
        var lineRange = $('lineRange');
        if (lineRange && Math.abs(Number(lineRange.value) - prefs.lineHeight) > 0.001) lineRange.value = String(prefs.lineHeight);
        var lineOut = $('lineOut');
        if (lineOut) lineOut.textContent = prefs.lineHeight.toFixed(1);

        var themeBtn = $('themeBtn');
        if (themeBtn) {
            themeBtn.setAttribute('aria-label', '切换主题（当前' + themeName(prefs.theme) + '）');
            themeBtn.setAttribute('title', '切换主题（当前' + themeName(prefs.theme) + '）');
        }
        var opts = document.querySelectorAll('[data-theme-option]');
        for (var i = 0; i < opts.length; i++) {
            var active = opts[i].getAttribute('data-theme-option') === prefs.theme;
            opts[i].classList.toggle('is-active', active);
            opts[i].setAttribute('aria-pressed', active ? 'true' : 'false');
            var current = opts[i].querySelector('.theme-current');
            if (current) current.textContent = active ? '当前' : '';
        }
    }
    function setTheme(t) {
        if (!isTheme(t)) return;
        prefs.theme = t;
        lsSet(PREFIX + 'theme', t);
        applyPrefs();
    }
    function cycleTheme() {
        var order = ['paper', 'eye', 'night'];
        setTheme(order[(order.indexOf(prefs.theme) + 1) % order.length]);
    }
    function setFontSize(v) {
        prefs.fontSize = clamp(Math.round(num(v, 18)), 15, 22);
        lsSet(PREFIX + 'font', String(prefs.fontSize));
        applyPrefs();
    }
    function setLineHeight(v) {
        prefs.lineHeight = clamp(Math.round(num(v, 2) * 10) / 10, 1.7, 2.2);
        lsSet(PREFIX + 'line', prefs.lineHeight.toFixed(1));
        applyPrefs();
    }
    function resetReading() {
        prefs.theme = 'paper';
        prefs.fontSize = 18;
        prefs.lineHeight = 2;
        lsSet(PREFIX + 'theme', 'paper');
        lsSet(PREFIX + 'font', '18');
        lsSet(PREFIX + 'line', '2.0');
        applyPrefs();
        showToast('阅读偏好已恢复默认：纸白 · 18px · 行高 2.0', 'success');
    }

    /* ------------------------------------------------------------
       Toast
       ------------------------------------------------------------ */
    function showToast(message, kind, timeout) {
        var host = $('toastHost');
        if (!host) return;
        while (host.children.length >= 3) host.removeChild(host.firstChild);
        var box = mk('div', 'toast' + (kind ? ' ' + kind : ''));
        box.setAttribute('role', kind === 'error' ? 'alert' : 'status');
        var msg = mk('span', 'toast-msg', message);
        var x = mk('button', 'toast-x', '×');
        x.type = 'button';
        x.setAttribute('aria-label', '关闭提示');
        var timer = null;
        function remove() {
            if (timer) { clearTimeout(timer); timer = null; }
            if (box.parentNode) box.parentNode.removeChild(box);
        }
        x.addEventListener('click', remove);
        box.appendChild(msg);
        box.appendChild(x);
        host.appendChild(box);
        timer = setTimeout(remove, timeout || (kind === 'error' ? 8000 : 4200));
    }

    /* ------------------------------------------------------------
       URL / 顶栏 / 导航
       ------------------------------------------------------------ */
    function syncUrl() {
        try {
            var u = new URL(location.href);
            if (state.book) u.searchParams.set('book', state.book);
            else u.searchParams.delete('book');
            if (SID) u.searchParams.set('session', SID);
            else u.searchParams.delete('session');
            history.replaceState(null, '', u.pathname + u.search + u.hash);
        } catch (e) { /* 非 http 环境或历史不可用时保持当前地址 */ }
    }

    function updateTopbar() {
        var title = $('bookTitle');
        var sub = $('bookSub');
        var chip = $('stageChip');
        var back = $('backBtn');
        if (!title || !sub || !chip) return;

        if (!state.book) {
            title.textContent = '锻炉书架';
            sub.textContent = '选一本在读的书，继续';
            chip.hidden = true;
            chip.textContent = '';
            if (back) back.hidden = true;
            document.title = '锻炉书架';
            return;
        }
        if (back) back.hidden = false;
        var d = state.detail;
        if (!d) {
            title.textContent = state.book;
            sub.textContent = state.detailError ? '详情加载失败' : '正在读取…';
            chip.hidden = true;
            chip.textContent = '';
            document.title = state.book + ' · 锻炉';
            return;
        }
        var meta = d.meta || {};
        title.textContent = meta.title || state.book;
        var bits = [];
        if (meta.genre) bits.push(meta.genre);
        var count = chapterCountOf(d, state.chapters);
        bits.push(count > 0 ? '已写 ' + count + ' 章' : '尚未开写');
        sub.textContent = bits.join(' · ');
        var stage = meta.stage ? stageName(meta.stage) : '';
        if (stage) {
            chip.hidden = false;
            chip.textContent = stage;
        } else {
            chip.hidden = true;
            chip.textContent = '';
        }
        document.title = (meta.title || state.book) + ' · 锻炉';
    }

    function updateTabs() {
        var hasBook = !!state.book;
        var tabs = document.querySelectorAll('.tab');
        for (var i = 0; i < tabs.length; i++) {
            var tab = tabs[i];
            var name = tab.getAttribute('data-tab');
            var active = state.view === name;
            tab.classList.toggle('is-active', active);
            if (active) tab.setAttribute('aria-current', 'page');
            else tab.removeAttribute('aria-current');
            var needsBook = name === 'workbench' || name === 'toc';
            if (needsBook && !hasBook) {
                tab.classList.add('is-disabled');
                tab.setAttribute('aria-disabled', 'true');
            } else {
                tab.classList.remove('is-disabled');
                tab.removeAttribute('aria-disabled');
            }
        }
    }

    function showView(name) {
        var names = ['shelf', 'workbench', 'toc', 'settings'];
        for (var i = 0; i < names.length; i++) {
            var view = $('view-' + names[i]);
            if (view) view.hidden = names[i] !== name;
        }
    }

    function switchTab(tab) {
        if ((tab === 'workbench' || tab === 'toc') && !state.book) {
            showToast('先在书架选择一本书', 'info');
            return;
        }
        state.view = tab;
        showView(tab);
        updateTabs();
        if (tab === 'workbench') renderWorkbench();
        else if (tab === 'toc') renderToc();
        else if (tab === 'settings') renderSettings();
        try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
    }

    function goShelf() {
        closeReader(true);
        state.book = '';
        state.detail = null;
        state.detailError = null;
        state.chapters = null;
        state.chaptersError = null;
        state.lastChapter = 0;
        state.tocQuery = '';
        var search = $('tocSearch');
        if (search) search.value = '';
        state.view = 'shelf';
        syncUrl();
        updateTopbar();
        showView('shelf');
        updateTabs();
        if (state.books === null) loadBooks();
        else renderShelf();
        try { window.scrollTo(0, 0); } catch (e) { /* ignore */ }
    }

    function openBook(id) {
        id = String(id || '').trim();
        if (!id) return;
        closeReader(true);
        state.book = id;
        state.detail = null;
        state.detailError = null;
        state.chapters = null;
        state.chaptersError = null;
        state.lastChapter = readLastChapter(id);
        state.tocQuery = '';
        var search = $('tocSearch');
        if (search) search.value = '';
        state.settings.saving = false;
        syncUrl();
        updateTopbar();
        state.view = 'workbench';
        showView('workbench');
        updateTabs();
        loadBookData();
    }

    /* ------------------------------------------------------------
       书架
       ------------------------------------------------------------ */
    function loadBooks() {
        state.books = null;
        state.booksError = null;
        renderShelf();
        api('/projects').then(function (list) {
            state.books = Array.isArray(list) ? list : [];
            renderShelf();
            updateTopbar();
        }).catch(function (err) {
            state.booksError = err;
            renderShelf();
        });
    }

    function renderShelf() {
        var body = $('shelfBody');
        var hint = $('shelfHint');
        if (!body) return;
        clear(body);
        if (hint) {
            if (!SID) hint.textContent = '未带 session 参数——显示全部书';
            else if (state.books === null) hint.textContent = '正在读取本会话书架…';
            else hint.textContent = '本会话 · ' + state.books.length + ' 本';
        }
        if (state.booksError) {
            body.appendChild(errorCard('书架加载失败', state.booksError, 'retry-books'));
            return;
        }
        if (state.books === null) {
            body.appendChild(skeletonShelf());
            return;
        }
        if (!state.books.length) {
            body.appendChild(emptyState(
                '书架还是空的',
                '这个会话名下还没有书。可以先用 novel_project init 建一本，或检查 URL 里的 session 是否对应当前会话。',
                'retry-books',
                '重新扫描'
            ));
            return;
        }
        var list = mk('div', 'book-list');
        for (var i = 0; i < state.books.length; i++) {
            var b = state.books[i] || {};
            var id = b.name || b.id || b.bookId || '';
            if (!id) continue;
            list.appendChild(bookCard(b, id));
        }
        body.appendChild(list);
    }

    function bookCard(b, id) {
        var card = mk('button', 'book-card');
        card.type = 'button';
        card.setAttribute('data-action', 'select-book');
        card.setAttribute('data-id', id);

        var cover = mk('span', 'book-cover', firstChar(b.title || id));
        cover.setAttribute('aria-hidden', 'true');

        var main = mk('span', 'book-main');
        main.appendChild(mk('span', 'book-title', b.title || id));
        var meta = mk('span', 'book-meta');
        meta.appendChild(mk('span', '', b.genre || '未分类'));
        var stage = b.stageLabel || stageName(b.stage);
        if (stage) meta.appendChild(mk('span', '', '· ' + stage));
        var n = Number(b.chapters);
        meta.appendChild(mk('span', '', isFinite(n) && n > 0 ? '· 已写 ' + n + ' 章' : '· 尚未开写'));
        main.appendChild(meta);

        var fs = b.foreshadows;
        if (fs && Number(fs.open) > 0) {
            main.appendChild(mk('span', 'book-sub', '未回收伏笔 ' + fs.open + ' 个'));
        } else if (b.logline) {
            main.appendChild(mk('span', 'book-sub', String(b.logline)));
        }

        card.appendChild(cover);
        card.appendChild(main);
        card.appendChild(mk('span', 'book-arrow', '›'));
        return card;
    }

    function skeletonShelf() {
        var wrap = mk('div', 'book-list');
        for (var i = 0; i < 3; i++) {
            var card = mk('div', 'book-card');
            card.style.cursor = 'default';
            var cover = mk('div', 'sk');
            cover.style.flex = 'none';
            cover.style.width = '48px';
            cover.style.height = '64px';
            cover.style.borderRadius = '9px';
            var main = mk('div', 'book-main');
            main.appendChild(mk('div', 'sk sk-line mid'));
            main.appendChild(mk('div', 'sk sk-line short'));
            card.appendChild(cover);
            card.appendChild(main);
            wrap.appendChild(card);
        }
        return wrap;
    }

    /* ------------------------------------------------------------
       书详情 / 工作台
       ------------------------------------------------------------ */
    function loadBookData() {
        var id = state.book;
        if (!id) return;
        var token = ++loadToken;
        state.detail = null;
        state.detailError = null;
        state.chapters = null;
        state.chaptersError = null;
        state.lastChapter = readLastChapter(id);
        updateTopbar();
        renderWorkbench();
        renderToc();
        renderSettings();

        loadDetail(id).then(function (raw) {
            if (token !== loadToken || state.book !== id) return;
            state.detail = normalizeDetail(raw);
            state.detailError = null;
            updateTopbar();
            renderWorkbench();
            renderSettings();
            if (state.reader.open) renderReaderToc();
        }).catch(function (err) {
            if (token !== loadToken || state.book !== id) return;
            state.detail = null;
            state.detailError = err;
            updateTopbar();
            renderWorkbench();
            renderSettings();
        });

        api('/projects/' + enc(id) + '/chapters').then(function (list) {
            if (token !== loadToken || state.book !== id) return;
            state.chapters = normalizeChapters(list);
            state.chaptersError = null;
            renderToc();
            renderWorkbench();
            renderReaderToc();
            updateTopbar();
        }).catch(function (err) {
            if (token !== loadToken || state.book !== id) return;
            state.chapters = [];
            state.chaptersError = err;
            renderToc();
            renderWorkbench();
            updateTopbar();
        });
    }

    function loadDetail(id) {
        return api('/projects/' + enc(id)).then(function (raw) {
            var v = raw && typeof raw === 'object' ? raw : {};
            if (!needsElements(v)) return v;
            return api('/projects/' + enc(id) + '/elements').then(function (elv) {
                return mergeDetail(v, elv && typeof elv === 'object' ? elv : {});
            }).catch(function () { return v; });
        });
    }
    function needsElements(v) {
        return !v.meta || !v.outline || !Array.isArray(v.facts)
            || !Array.isArray(v.foreshadows) || typeof v.worldbookCount !== 'number';
    }
    function mergeDetail(v, elv) {
        var out = {};
        var k;
        for (k in elv) if (Object.prototype.hasOwnProperty.call(elv, k)) out[k] = elv[k];
        for (k in v) if (Object.prototype.hasOwnProperty.call(v, k)) out[k] = v[k];
        if (!v.meta && elv.meta) out.meta = elv.meta;
        if (!v.outline && elv.outline) out.outline = elv.outline;
        if (!Array.isArray(v.facts) && Array.isArray(elv.facts)) out.facts = elv.facts;
        if (!Array.isArray(v.foreshadows) && Array.isArray(elv.foreshadows)) out.foreshadows = elv.foreshadows;
        if (!Array.isArray(v.characters) && Array.isArray(elv.characters)) out.characters = elv.characters;
        if (typeof v.worldbookCount !== 'number' && typeof elv.worldbookCount === 'number') out.worldbookCount = elv.worldbookCount;
        if (typeof v.glossaryCount !== 'number' && typeof elv.glossaryCount === 'number') out.glossaryCount = elv.glossaryCount;
        return out;
    }
    function normalizeDetail(v) {
        v = v && typeof v === 'object' ? v : {};
        var meta = v.meta && typeof v.meta === 'object' ? v.meta : {};
        var title = meta.title || v.title || v.bookId || state.book;
        return {
            raw: v,
            meta: {
                title: title,
                genre: meta.genre || v.genre || '',
                logline: typeof meta.logline === 'string' ? meta.logline : (typeof v.logline === 'string' ? v.logline : ''),
                stage: meta.stage || v.stage || '',
                cast: Array.isArray(meta.cast) ? meta.cast : (Array.isArray(v.cast) ? v.cast : [])
            },
            fusion: v.fusion && typeof v.fusion === 'object' ? v.fusion : {},
            charView: v.charView && typeof v.charView === 'object' ? v.charView : null,
            settings: v.settings && typeof v.settings === 'object' ? v.settings : null,
            outline: v.outline || null,
            characters: Array.isArray(v.characters) ? v.characters : [],
            facts: Array.isArray(v.facts) ? v.facts : [],
            foreshadows: Array.isArray(v.foreshadows) ? v.foreshadows : [],
            worldbookCount: typeof v.worldbookCount === 'number' ? v.worldbookCount : (Array.isArray(v.worldbook) ? v.worldbook.length : 0),
            glossaryCount: typeof v.glossaryCount === 'number' ? v.glossaryCount : 0
        };
    }

    function renderWorkbench() {
        var root = $('workbenchBody');
        if (!root) return;
        clear(root);
        if (state.detailError) {
            var errCard = errorCard('工作台数据加载失败', state.detailError, 'retry-detail');
            var actions = errCard.querySelector('.error-actions');
            if (actions) {
                var back = mk('button', 'btn ghost', '返回书架');
                back.type = 'button';
                back.setAttribute('data-action', 'back-shelf');
                actions.appendChild(back);
            }
            root.appendChild(errCard);
            return;
        }
        var d = state.detail;
        if (!d) {
            root.appendChild(workbenchSkeleton());
            return;
        }
        var chapters = Array.isArray(state.chapters) ? state.chapters : [];
        var latest = chapters.length ? chapters[chapters.length - 1] : null;
        var count = chapterCountOf(d, chapters);
        var nextNo = Number(d.fusion && d.fusion.nextChapter);
        if (!isFinite(nextNo) || nextNo < 1) {
            nextNo = (latest ? latest.no : (Number(d.fusion && d.fusion.latestChapter) || 0)) + 1;
        }

        var hero = mk('section', 'card hero');
        hero.appendChild(mk('div', 'eyebrow', '继续写'));
        var nextLine = mk('div', 'hero-next');
        nextLine.appendChild(mk('span', 'hero-no', '第 ' + nextNo + ' 章'));
        nextLine.appendChild(mk('span', 'pill', '下一章'));
        hero.appendChild(nextLine);

        if (latest) {
            var sub = mk('div', 'hero-sub');
            var label = '最近 · 第 ' + latest.no + ' 章';
            if (latest.title) label += '「' + latest.title + '」';
            label += ' · ' + fmtInt(latest.chars) + ' 字';
            sub.textContent = label;
            hero.appendChild(sub);
            hero.appendChild(mk('p', 'hero-summary', latest.summary || '这一章还没有摘要。'));
        } else if (state.chaptersError) {
            hero.appendChild(mk('p', 'hero-summary', '章节目录加载失败，工作台统计可能不完整。'));
        } else if (state.chapters === null) {
            hero.appendChild(mk('p', 'hero-summary', '正在读取章节…'));
        } else {
            hero.appendChild(mk('p', 'hero-summary', '还没有章节记录。下一步：在聊天里完成细纲批准后写第 1 章。'));
        }

        var heroActions = mk('div', 'hero-actions');
        var readBtn = mk('button', 'btn primary', latest ? '读第 ' + latest.no + ' 章' : '还没有正文');
        readBtn.type = 'button';
        readBtn.setAttribute('data-action', 'read-latest');
        if (!latest) readBtn.disabled = true;
        heroActions.appendChild(readBtn);
        var tocBtn = mk('button', 'btn', '回到目录');
        tocBtn.type = 'button';
        tocBtn.setAttribute('data-action', 'goto-toc');
        heroActions.appendChild(tocBtn);
        hero.appendChild(heroActions);
        root.appendChild(hero);

        var total = totalCharsOf(d, chapters);
        var fsList = Array.isArray(d.foreshadows) ? d.foreshadows : [];
        var openFs = countOpenForeshadows(fsList);
        var stats = mk('div', 'stats-grid');
        stats.appendChild(statCard('已写章数', fmtInt(count), '章'));
        stats.appendChild(statCard('总字数', fmtWords(total), total >= 10000 ? fmtInt(total) + ' 字' : '按章节索引累计'));
        stats.appendChild(statCard('伏笔数', fmtInt(fsList.length), fsList.length ? '未回收 ' + openFs + ' 个' : '还没有伏笔记录'));
        stats.appendChild(statCard('世界书', fmtInt(d.worldbookCount || 0), '条设定'));
        root.appendChild(stats);

        if (state.chaptersError) {
            root.appendChild(errorCard('章节目录加载失败', state.chaptersError, 'retry-chapters'));
        }

        var fusion = mk('section', 'card');
        var fh = mk('div', 'section-head');
        fh.appendChild(mk('h2', 'section-title', '双轨与落盘'));
        fh.appendChild(mk('p', 'section-desc', '进程级配置；改动后需重启 DSH Web 生效。'));
        fusion.appendChild(fh);
        var f = d.fusion || {};
        fusion.appendChild(kvRow('数据布局', layoutValue(f.layout)));
        fusion.appendChild(kvRow('版本策略', versionValue(f.versioning)));
        fusion.appendChild(kvRow('书目录 .git', gitValue(f.hasGit, f.versioning)));
        fusion.appendChild(kvRow('投放平台', platformValue(d)));
        fusion.appendChild(kvRow('每章字数', charsValue(d)));
        root.appendChild(fusion);

        var det = mk('details', 'card promise');
        var summary = mk('summary', 'promise-summary');
        summary.appendChild(mk('span', '', '故事承诺'));
        summary.appendChild(mk('span', 'chev', '⌄'));
        det.appendChild(summary);
        var ptext = d.meta && d.meta.logline ? String(d.meta.logline).trim() : '';
        if (ptext) {
            det.appendChild(mk('p', 'promise-text', ptext));
        } else {
            det.appendChild(mk('p', 'promise-text', '还没有写「一句话故事」。补上后，每次写章都会随上下文包注入。'));
            var go = mk('button', 'btn', '去设置补');
            go.type = 'button';
            go.setAttribute('data-action', 'goto-settings');
            det.appendChild(go);
        }
        root.appendChild(det);
    }

    function workbenchSkeleton() {
        var wrap = mk('div', '');
        wrap.appendChild(mk('div', 'sk sk-hero'));
        var stats = mk('div', 'stats-grid');
        for (var i = 0; i < 4; i++) stats.appendChild(mk('div', 'sk sk-stat'));
        wrap.appendChild(stats);
        wrap.appendChild(mk('div', 'sk sk-card'));
        return wrap;
    }

    function statCard(label, value, sub) {
        var card = mk('div', 'stat-card');
        card.appendChild(mk('div', 'stat-label', label));
        card.appendChild(mk('div', 'stat-value', value));
        card.appendChild(mk('div', 'stat-sub', sub));
        return card;
    }
    function kvRow(label, value) {
        var row = mk('div', 'kv-row');
        row.appendChild(mk('span', 'kv-key', label));
        row.appendChild(value);
        return row;
    }
    function stackedValue(main, note) {
        var span = mk('span', 'kv-val');
        var line = mk('span', 'kv-main');
        if (main && main.nodeType) line.appendChild(main);
        else line.textContent = main == null ? '—' : String(main);
        span.appendChild(line);
        if (note) span.appendChild(mk('span', 'kv-note', note));
        return span;
    }
    function layoutValue(layout) {
        if (layout === 'fiction-suite') return stackedValue(mk('span', 'badge', 'fiction-suite'), '06-正文 / 04-细纲 / 05-角色语言指纹');
        if (layout === 'forge') return stackedValue(mk('span', 'badge', 'forge'), '正文 / 大纲 / 人物');
        return stackedValue(layout || '—', '');
    }
    function versionValue(mode) {
        var v = String(mode || '').toLowerCase();
        if (v === 'git') return stackedValue(mk('span', 'badge', 'git'), '正文单文件原地覆盖，历史交给书目录 git');
        if (v === 'versions') return stackedValue(mk('span', 'badge', 'versions'), '每章追加 vN 版本，旧版不覆盖');
        if (v === 'auto') return stackedValue(mk('span', 'badge', 'auto'), 'forge → versions / fiction-suite → git');
        return stackedValue(v || '—', '');
    }
    function gitValue(hasGit, mode) {
        if (hasGit) return stackedValue(mk('span', 'badge ok', '已就绪'), '书目录里检测到 .git');
        var note = String(mode || '').toLowerCase() === 'git' ? 'git 策略下建议在书目录初始化仓库' : 'versions 策略不依赖 git';
        return stackedValue(mk('span', 'badge warn', '未初始化'), note);
    }
    function platformOf(d) {
        var p = '';
        if (d && d.fusion && typeof d.fusion.platform === 'string' && d.fusion.platform) p = d.fusion.platform;
        else if (d && d.settings && typeof d.settings.platform === 'string' && d.settings.platform) p = d.settings.platform;
        else if (d && d.raw && typeof d.raw.platform === 'string' && d.raw.platform) p = d.raw.platform;
        else if (!d) {
            var c = localSettings();
            if (c && typeof c.platform === 'string' && c.platform) p = c.platform;
        }
        p = String(p || '').trim().toLowerCase();
        return PLATFORM_NAMES[p] ? p : '';
    }
    function platformNameOf(d, p) {
        if (d && d.fusion && typeof d.fusion.platformName === 'string' && d.fusion.platformName) return d.fusion.platformName;
        if (d && d.settings && typeof d.settings.platformName === 'string' && d.settings.platformName) return d.settings.platformName;
        var c = localSettings();
        if (c && c.platformName) return String(c.platformName);
        return PLATFORM_NAMES[p] || p;
    }
    function platformValue(d) {
        var p = platformOf(d);
        if (!p) return stackedValue('未设置', '按插件默认字数口径');
        return stackedValue(platformNameOf(d, p) + '（' + p + '）', '决定默认字数口径与平台审稿');
    }
    function sourceLabel(source) {
        if (source === 'custom') return '本书自定义';
        if (source === 'platform') return '平台口径';
        if (source === 'config') return '插件默认';
        return '';
    }
    function customCharsSpec(d) {
        if (!d) return '';
        if (d.settings && typeof d.settings.chars === 'string' && d.settings.chars.trim() !== '') return d.settings.chars.trim();
        if (d.charView && typeof d.charView.charLimits === 'string' && d.charView.charLimits.trim() !== '') return d.charView.charLimits.trim();
        if (d.raw && typeof d.raw.chars === 'string' && /\d/.test(d.raw.chars)) return d.raw.chars.trim();
        if (d.fusion && typeof d.fusion.chars === 'string' && d.fusion.chars.trim() !== '') return d.fusion.chars.trim();
        var hasInfo = !!(d.settings || d.charView || (d.fusion && d.fusion.chars !== undefined));
        if (!hasInfo) {
            var c = localSettings();
            if (c && typeof c.chars === 'string') return c.chars.trim();
        }
        return '';
    }
    function charsInfo(d) {
        var spec = customCharsSpec(d);
        if (spec) return { value: spec + ' 字', note: '本书自定义（优先于平台）' };
        var cv = d && d.charView;
        if (cv && isFinite(Number(cv.charMin)) && isFinite(Number(cv.charMax))) {
            return {
                value: fmtInt(cv.charMin) + '–' + fmtInt(cv.charMax) + ' 字',
                note: sourceLabel(cv.charSource)
            };
        }
        var st = d && d.settings;
        if (st && isFinite(Number(st.charMin)) && isFinite(Number(st.charMax))) {
            return {
                value: fmtInt(st.charMin) + '–' + fmtInt(st.charMax) + ' 字',
                note: st.chars ? '本书自定义' : (st.platformName ? String(st.platformName) + '平台口径' : '当前生效')
            };
        }
        var f = d && d.fusion;
        if (f && typeof f.chars === 'string' && f.chars.trim() !== '') {
            return { value: f.chars.trim() + ' 字', note: '书目设置' };
        }
        var c = localSettings();
        if (c && typeof c.chars === 'string' && c.chars.trim() !== '') {
            return { value: c.chars.trim() + ' 字', note: '本机记忆' };
        }
        return { value: '未设置', note: '使用插件默认区间' };
    }
    function charsValue(d) {
        var info = charsInfo(d);
        return stackedValue(info.value, info.note);
    }

    function chapterCountOf(d, chapters) {
        var n = d && d.fusion ? Number(d.fusion.chapterCount) : NaN;
        if (isFinite(n) && n >= 0) return n;
        return Array.isArray(chapters) ? chapters.length : 0;
    }
    function totalCharsOf(d, chapters) {
        var n = d && d.fusion ? Number(d.fusion.chars) : NaN;
        if (isFinite(n) && n >= 0) return n;
        var sum = 0;
        if (Array.isArray(chapters)) {
            for (var i = 0; i < chapters.length; i++) sum += Number(chapters[i].chars) || 0;
        }
        return sum;
    }
    function countOpenForeshadows(list) {
        var c = 0;
        for (var i = 0; i < list.length; i++) {
            var f = list[i];
            if (f && (f.payoffChapter === null || f.payoffChapter === undefined)) c++;
        }
        return c;
    }

    function normalizeChapters(list) {
        if (!Array.isArray(list)) return [];
        var out = [];
        for (var i = 0; i < list.length; i++) {
            var x = list[i];
            if (!x) continue;
            var no = Number(x.no);
            if (!isFinite(no) || no < 1) continue;
            var latest = Number(x.latest !== undefined ? x.latest : x.version);
            out.push({
                no: no,
                title: x.title ? String(x.title) : '',
                latest: isFinite(latest) ? latest : 0,
                chars: isFinite(Number(x.chars)) ? Number(x.chars) : 0,
                summary: x.summary ? String(x.summary) : '',
                updatedAt: x.updatedAt ? String(x.updatedAt) : ''
            });
        }
        out.sort(function (a, b) { return a.no - b.no; });
        return out;
    }
    function chapterByNo(no) {
        if (!Array.isArray(state.chapters)) return null;
        var n = Number(no);
        for (var i = 0; i < state.chapters.length; i++) {
            if (state.chapters[i].no === n) return state.chapters[i];
        }
        return null;
    }
    function chapterIndex(no) {
        if (!Array.isArray(state.chapters)) return -1;
        var n = Number(no);
        for (var i = 0; i < state.chapters.length; i++) {
            if (state.chapters[i].no === n) return i;
        }
        return -1;
    }
    function readLastChapter(book) {
        if (!book) return 0;
        var n = parseInt(lsGet(PREFIX + 'last-chapter:' + book, '0'), 10);
        return isFinite(n) && n > 0 ? n : 0;
    }

    /* ------------------------------------------------------------
       目录
       ------------------------------------------------------------ */
    function renderToc() {
        var body = $('tocBody');
        if (!body) return;
        clear(body);
        var countEl = $('tocCount');
        if (state.chaptersError) {
            if (countEl) countEl.textContent = '';
            body.appendChild(errorCard('章节目录加载失败', state.chaptersError, 'retry-chapters'));
            return;
        }
        if (state.chapters === null) {
            if (countEl) countEl.textContent = '读取中…';
            body.appendChild(tocSkeleton());
            return;
        }
        if (!state.chapters.length) {
            if (countEl) countEl.textContent = '共 0 章';
            body.appendChild(emptyState('还没有章节', '写完第一章并落盘后，目录会出现在这里。', 'goto-workbench', '回工作台'));
            return;
        }
        var wrap = mk('div', 'toc-list');
        for (var i = 0; i < state.chapters.length; i++) wrap.appendChild(tocRow(state.chapters[i]));
        body.appendChild(wrap);
        var filterEmpty = mk('div', 'toc-filter-empty', '没有匹配的章节');
        filterEmpty.id = 'tocFilterEmpty';
        filterEmpty.hidden = true;
        body.appendChild(filterEmpty);
        applyTocFilter();
    }

    function tocRow(c) {
        var row = mk('button', 'toc-row');
        row.type = 'button';
        row.setAttribute('data-action', 'open-chapter');
        row.setAttribute('data-no', String(c.no));
        row.setAttribute('data-search', ('第' + c.no + '章 ' + c.title + ' ' + c.summary).toLowerCase());
        row.appendChild(mk('span', 'toc-no', String(c.no)));

        var main = mk('span', 'toc-main');
        var title = '第 ' + c.no + ' 章';
        if (c.title) title += '　' + c.title;
        main.appendChild(mk('span', 'toc-title', title));
        main.appendChild(mk('span', 'toc-sum', c.summary || '暂无摘要'));
        row.appendChild(main);

        var meta = mk('span', 'toc-meta');
        meta.appendChild(mk('span', '', fmtInt(c.chars) + ' 字'));
        var flag = mk('span', 'toc-flag', '');
        meta.appendChild(flag);
        row.appendChild(meta);

        var current = c.no === state.lastChapter;
        if (current) {
            row.classList.add('is-current');
            row.setAttribute('aria-current', 'true');
            flag.textContent = '上次读到';
        } else if (state.lastChapter && c.no < state.lastChapter) {
            row.classList.add('is-read');
        }
        return row;
    }

    function applyTocFilter() {
        var q = String(state.tocQuery || '').trim().toLowerCase();
        var rows = document.querySelectorAll('#tocBody .toc-row');
        var visible = 0;
        for (var i = 0; i < rows.length; i++) {
            var search = rows[i].getAttribute('data-search') || '';
            var hit = !q || search.indexOf(q) !== -1;
            rows[i].hidden = !hit;
            if (hit) visible++;
        }
        var countEl = $('tocCount');
        var total = state.chapters ? state.chapters.length : 0;
        if (countEl) {
            if (state.chapters === null) countEl.textContent = '读取中…';
            else if (!total) countEl.textContent = '共 0 章';
            else countEl.textContent = q ? ('显示 ' + visible + ' / ' + total + ' 章') : ('共 ' + total + ' 章');
        }
        var emptyEl = $('tocFilterEmpty');
        if (emptyEl) emptyEl.hidden = !(q && visible === 0 && total > 0);
    }

    function refreshTocCurrent() {
        var rows = document.querySelectorAll('#tocBody .toc-row');
        for (var i = 0; i < rows.length; i++) {
            var no = Number(rows[i].getAttribute('data-no'));
            var current = no === state.lastChapter;
            rows[i].classList.toggle('is-current', current);
            rows[i].classList.toggle('is-read', !current && state.lastChapter > 0 && no < state.lastChapter);
            if (current) rows[i].setAttribute('aria-current', 'true');
            else rows[i].removeAttribute('aria-current');
            var flag = rows[i].querySelector('.toc-flag');
            if (flag) flag.textContent = current ? '上次读到' : '';
        }
        renderReaderToc();
    }

    function tocSkeleton() {
        var wrap = mk('div', 'toc-list');
        for (var i = 0; i < 6; i++) {
            var row = mk('div', 'toc-row');
            row.style.cursor = 'default';
            var noSk = mk('div', 'sk sk-toc-no', '');
            row.appendChild(noSk);
            var main = mk('div', 'toc-main');
            main.appendChild(mk('div', 'sk sk-line mid'));
            main.appendChild(mk('div', 'sk sk-line short'));
            row.appendChild(main);
            wrap.appendChild(row);
        }
        return wrap;
    }

    /* ------------------------------------------------------------
       设置
       ------------------------------------------------------------ */
    function localSettings() {
        if (!state.book) return null;
        var raw = lsGet(PREFIX + 'settings:' + state.book, '');
        if (!raw) return null;
        try {
            var obj = JSON.parse(raw);
            return obj && typeof obj === 'object' ? obj : null;
        } catch (e) { return null; }
    }

    function renderSettings() {
        var root = $('settingsBody');
        if (!root) return;
        clear(root);
        var book = settingsBookCard();
        if (book) root.appendChild(book);
        root.appendChild(settingsReadingCard());
        root.appendChild(settingsAboutCard());
        applyPrefs();
    }

    function settingsBookCard() {
        var card = mk('section', 'card settings-card');
        card.appendChild(mk('h2', 'section-title', '本书'));
        if (!state.book) {
            card.appendChild(mk('p', 'section-desc', '先从书架选择一本书，才能设置本书的字数区间、平台与故事承诺。'));
            var toShelf = mk('button', 'btn', '去书架');
            toShelf.type = 'button';
            toShelf.setAttribute('data-action', 'back-shelf');
            card.appendChild(toShelf);
            return card;
        }
        if (state.detailError) {
            var err = errorCard('本书设置加载失败', state.detailError, 'retry-detail');
            err.classList.remove('card');
            err.style.padding = '0';
            err.style.border = '0';
            err.style.background = 'transparent';
            err.style.boxShadow = 'none';
            card.appendChild(err);
            return card;
        }
        if (!state.detail) {
            card.appendChild(mk('p', 'section-desc', '正在读取书目设置…'));
            card.appendChild(mk('div', 'sk sk-line long'));
            card.appendChild(mk('div', 'sk sk-line mid'));
            card.appendChild(mk('div', 'sk sk-line short'));
            return card;
        }
        var d = state.detail;
        var spec = customCharsSpec(d);
        var info = charsInfo(d);
        var platform = platformOf(d);

        var chars = mk('input', 'input');
        chars.type = 'text';
        chars.id = 'charsInput';
        chars.placeholder = '2500-3500';
        chars.value = spec;
        chars.autocomplete = 'off';
        chars.spellcheck = false;
        chars.setAttribute('inputmode', 'text');
        card.appendChild(field('每章字数区间', chars, '当前生效：' + info.value + '（' + info.note + '）。留空 = 清除自定义，回落到平台 / 插件口径。'));

        var select = mk('select', 'select');
        select.id = 'platformSelect';
        var options = [
            ['', '未设置'],
            ['qidian', '起点 qidian'],
            ['fanqie', '番茄 fanqie'],
            ['jjwxc', '晋江 jjwxc'],
            ['qimao', '七猫 qimao'],
            ['feilu', '飞卢 feilu']
        ];
        for (var i = 0; i < options.length; i++) {
            var opt = mk('option', '', options[i][1]);
            opt.value = options[i][0];
            select.appendChild(opt);
        }
        select.value = platform || '';
        card.appendChild(field('投放平台', select, '平台决定默认字数口径与 novel_audit 的默认平台审稿。'));

        var logline = mk('textarea', 'textarea');
        logline.id = 'loglineInput';
        logline.rows = 3;
        logline.placeholder = '一句话故事：主角、欲望、阻力、代价…';
        logline.value = (d.meta && d.meta.logline) || '';
        card.appendChild(field('一句话故事（logline）', logline, '写进每次写章的上下文包；留空则不注入。'));

        var actions = mk('div', 'form-actions');
        var save = mk('button', 'btn primary', state.settings.saving ? '保存中…' : '保存设置');
        save.type = 'button';
        save.id = 'saveSettingsBtn';
        save.setAttribute('data-action', 'save-settings');
        if (state.settings.saving) save.disabled = true;
        actions.appendChild(save);
        card.appendChild(actions);
        card.appendChild(mk('p', 'form-note', '保存后，写章门禁、细纲字数目标、简报与平台审稿都会按新口径走。'));
        return card;
    }

    function field(labelText, control, hintText) {
        var wrap = mk('div', 'field');
        var label = mk('label', 'field-label', labelText);
        if (control.id) label.setAttribute('for', control.id);
        wrap.appendChild(label);
        wrap.appendChild(control);
        if (hintText) wrap.appendChild(mk('span', 'field-hint', hintText));
        return wrap;
    }

    function settingsReadingCard() {
        var card = mk('section', 'card settings-card');
        card.appendChild(mk('h2', 'section-title', '阅读'));
        card.appendChild(mk('p', 'section-desc', '即时生效，并保存在本机浏览器（localStorage，前缀 nf-h5-）。'));

        var fontRow = mk('div', 'range-row');
        var font = mk('input', 'range');
        font.type = 'range';
        font.id = 'fontRange';
        font.min = '15';
        font.max = '22';
        font.step = '1';
        font.value = String(prefs.fontSize);
        font.setAttribute('aria-label', '正文字号');
        fontRow.appendChild(font);
        var fontOut = mk('span', 'range-val', prefs.fontSize + 'px');
        fontOut.id = 'fontOut';
        fontRow.appendChild(fontOut);
        card.appendChild(field('正文字号', fontRow, '15–22 px'));

        var lineRow = mk('div', 'range-row');
        var line = mk('input', 'range');
        line.type = 'range';
        line.id = 'lineRange';
        line.min = '1.7';
        line.max = '2.2';
        line.step = '0.1';
        line.value = prefs.lineHeight.toFixed(1);
        line.setAttribute('aria-label', '正文行高');
        lineRow.appendChild(line);
        var lineOut = mk('span', 'range-val', prefs.lineHeight.toFixed(1));
        lineOut.id = 'lineOut';
        lineRow.appendChild(lineOut);
        card.appendChild(field('正文行高', lineRow, '1.7–2.2 倍'));

        var themeLabel = mk('div', 'field-label', '主题');
        themeLabel.style.marginTop = '13px';
        card.appendChild(themeLabel);
        var themeOptions = mk('div', 'theme-options');
        var themes = [
            ['paper', '纸白'],
            ['eye', '护眼'],
            ['night', '夜间']
        ];
        for (var i = 0; i < themes.length; i++) {
            var id = themes[i][0];
            var btn = mk('button', 'theme-opt' + (prefs.theme === id ? ' is-active' : ''));
            btn.type = 'button';
            btn.setAttribute('data-action', 'set-theme');
            btn.setAttribute('data-theme', id);
            btn.setAttribute('data-theme-option', id);
            btn.setAttribute('aria-pressed', prefs.theme === id ? 'true' : 'false');
            var sw = mk('span', 'theme-swatch sw-' + id, 'Aa');
            btn.appendChild(sw);
            var nameRow = mk('span', 'theme-name');
            nameRow.appendChild(mk('span', '', themes[i][1]));
            nameRow.appendChild(mk('span', 'theme-current', prefs.theme === id ? '当前' : ''));
            btn.appendChild(nameRow);
            themeOptions.appendChild(btn);
        }
        card.appendChild(themeOptions);

        var reset = mk('button', 'btn ghost', '恢复默认阅读偏好');
        reset.type = 'button';
        reset.setAttribute('data-action', 'reset-reading');
        var resetWrap = mk('div', 'form-actions');
        resetWrap.appendChild(reset);
        card.appendChild(resetWrap);
        return card;
    }

    function settingsAboutCard() {
        var card = mk('section', 'card settings-card');
        card.appendChild(mk('h2', 'section-title', '关于'));
        var list = mk('ul', 'about-list');
        var items = [
            '纯单文件 H5：CSS / JS 全部内联，无 CDN、无外部字体、无 npm 依赖、无构建步骤。',
            '数据走锻炉同一条 REST 门禁：所有请求带 x-dsh-novel-forge: 1；会话来自 URL 的 ?session=，书来自 ?book=。',
            '当前端点前缀：' + API_BASE,
            '布局（forge / fiction-suite）与版本策略（versions / git）在插件装配期确定，切换后需重启 DSH Web 生效。',
            '阅读偏好（主题 / 字号 / 行高）与上次读到第几章只存在本机 localStorage，键前缀 nf-h5-。'
        ];
        for (var i = 0; i < items.length; i++) list.appendChild(mk('li', i === 2 ? 'about-mono' : '', items[i]));
        card.appendChild(list);
        return card;
    }

    function setSaveButtonState(saving) {
        var btn = $('saveSettingsBtn');
        if (!btn) return;
        btn.disabled = !!saving;
        btn.textContent = saving ? '保存中…' : '保存设置';
    }

    function saveSettings() {
        if (!state.book || state.settings.saving) return;
        var charsEl = $('charsInput');
        if (!charsEl) return;
        var chars = String(charsEl.value || '').trim();
        var platformEl = $('platformSelect');
        var platform = platformEl ? String(platformEl.value || '') : '';
        var logEl = $('loglineInput');
        var logline = logEl ? String(logEl.value || '').trim() : '';

        if (chars !== '') {
            var parts = chars.split(/[-–—~、,，/\s]+/).filter(function (x) { return x !== ''; });
            if (parts.length !== 2 || !/^\d+$/.test(parts[0]) || !/^\d+$/.test(parts[1])) {
                showToast('字数区间要写成「下限-上限」，例如 2500-3500；留空表示清除。', 'error');
                charsEl.focus();
                return;
            }
            if (Number(parts[0]) > Number(parts[1])) {
                showToast('字数区间的下限不能大于上限。', 'error');
                charsEl.focus();
                return;
            }
        }

        var id = state.book;
        state.settings.saving = true;
        setSaveButtonState(true);
        var body = { chars: chars, platform: platform, logline: logline };
        api('/projects/' + enc(id) + '/settings', { method: 'POST', body: body }).then(function (val) {
            if (state.book !== id) return;
            state.settings.saving = false;
            setSaveButtonState(false);
            var out = val && typeof val === 'object' ? val : {};
            var cache = {
                chars: typeof out.chars === 'string' ? out.chars : chars,
                platform: typeof out.platform === 'string' ? out.platform : platform,
                platformName: typeof out.platformName === 'string' ? out.platformName : '',
                logline: typeof out.logline === 'string' ? out.logline : logline
            };
            lsSet(PREFIX + 'settings:' + id, JSON.stringify(cache));
            showToast('设置已保存', 'success');
            refreshDetail();
        }).catch(function (err) {
            if (state.book !== id) return;
            state.settings.saving = false;
            setSaveButtonState(false);
            if (err && (err.status === 404 || err.status === 405)) {
                api('/projects/' + enc(id) + '/chars', { method: 'POST', body: { chars: chars } }).then(function () {
                    if (state.book !== id) return;
                    var cache = { chars: chars, platform: platform, platformName: '', logline: logline };
                    lsSet(PREFIX + 'settings:' + id, JSON.stringify(cache));
                    showToast('字数区间已保存；平台与故事承诺需要新版 /settings 端点。', 'info', 7000);
                    refreshDetail();
                }).catch(function (err2) {
                    showToast('保存失败：' + (err2 && err2.message ? err2.message : '未知错误'), 'error');
                });
                return;
            }
            showToast('保存失败：' + (err && err.message ? err.message : '未知错误'), 'error');
        });
    }

    function refreshDetail() {
        var id = state.book;
        if (!id) return;
        loadDetail(id).then(function (raw) {
            if (state.book !== id) return;
            state.detail = normalizeDetail(raw);
            state.detailError = null;
            updateTopbar();
            renderWorkbench();
            renderSettings();
        }).catch(function (err) {
            showToast('已保存，但详情刷新失败：' + (err && err.message ? err.message : '未知错误'), 'error');
        });
    }

    /* ------------------------------------------------------------
       阅读层
       ------------------------------------------------------------ */
    function renderReaderToc() {
        var host = $('readerToc');
        if (!host) return;
        clear(host);
        if (!state.book) return;
        var total = Array.isArray(state.chapters) ? state.chapters.length : 0;
        host.appendChild(mk('div', 'reader-toc-title', '目录 · ' + total + ' 章'));
        if (!total) {
            host.appendChild(mk('div', 'reader-toc-empty', '暂无章节目录'));
            return;
        }
        var frag = document.createDocumentFragment();
        for (var i = 0; i < state.chapters.length; i++) {
            var c = state.chapters[i];
            var item = mk('button', 'reader-toc-item');
            item.type = 'button';
            item.setAttribute('data-action', 'open-chapter');
            item.setAttribute('data-no', String(c.no));
            item.textContent = '第 ' + c.no + ' 章' + (c.title ? ' · ' + c.title : '');
            if (c.no === state.reader.no) item.classList.add('is-current');
            frag.appendChild(item);
        }
        host.appendChild(frag);
    }

    function openReader(no) {
        if (!state.book || !Array.isArray(state.chapters) || !state.chapters.length) {
            showToast('还没有可读的章节', 'info');
            return;
        }
        var chap = chapterByNo(no) || state.chapters[0];
        state.reader.open = true;
        state.reader.opener = document.activeElement;
        var reader = $('reader');
        if (!reader) return;
        reader.hidden = false;
        document.body.classList.add('reader-open');
        requestAnimationFrame(function () { reader.classList.add('is-open'); });
        renderReaderToc();
        loadChapter(chap.no, { restore: true });
        setTimeout(function () {
            try { reader.focus(); } catch (e) { /* ignore */ }
        }, 30);
    }

    function closeReader(silent) {
        if (!state.reader.open) return;
        saveScroll();
        readerToken++;
        state.reader.open = false;
        state.reader.loading = false;
        state.reader.error = null;
        state.reader.restoring = false;
        var reader = $('reader');
        if (reader) {
            reader.classList.remove('is-open');
            reader.hidden = true;
        }
        document.body.classList.remove('reader-open');
        if (!silent) {
            refreshTocCurrent();
            var opener = state.reader.opener;
            if (opener && typeof opener.focus === 'function') {
                try { opener.focus(); } catch (e) { /* ignore */ }
            }
        }
        state.reader.opener = null;
    }

    function openChapterTarget(no) {
        var n = Number(no);
        if (!isFinite(n) || n < 1) return;
        if (state.reader.open) loadChapter(n, { restore: true });
        else openReader(n);
    }

    function navChapter(delta) {
        if (!state.reader.open || !Array.isArray(state.chapters)) return;
        var idx = chapterIndex(state.reader.no);
        if (idx < 0) return;
        var next = state.chapters[idx + delta];
        if (next) loadChapter(next.no, { restore: true });
    }

    function setReaderHeader(chap) {
        var titleEl = $('readerTitle');
        var metaEl = $('readerMeta');
        if (!titleEl) return;
        var label = '第 ' + chap.no + ' 章';
        var t = String(chap.title || '').trim();
        if (t && !/^第\s*\d+\s*章/.test(t)) label += ' · ' + t;
        titleEl.textContent = label;
        if (metaEl) {
            var meta = fmtInt(chap.chars) + ' 字';
            if (chap.updatedAt) {
                var date = fmtDate(chap.updatedAt);
                if (date) meta += ' · ' + date;
            }
            metaEl.textContent = meta;
        }
    }

    function updateReaderFooter() {
        if (!Array.isArray(state.chapters)) return;
        var chap = chapterByNo(state.reader.no);
        var idx = chapterIndex(state.reader.no);
        var pos = $('readerPos');
        if (pos) pos.textContent = chap
            ? ('第 ' + chap.no + ' / ' + state.chapters.length + ' 章')
            : ('第 — / ' + state.chapters.length + ' 章');
        var prev = $('prevBtn');
        var next = $('nextBtn');
        if (prev) prev.disabled = idx <= 0;
        if (next) next.disabled = idx < 0 || idx >= state.chapters.length - 1;
    }

    function showReaderSkeleton() {
        var body = $('readerBody');
        if (!body) return;
        clear(body);
        var wrap = mk('div', 'reader-sk-wrap');
        var widths = ['92%', '86%', '90%', '72%', '95%', '88%', '64%'];
        for (var i = 0; i < widths.length; i++) {
            var line = mk('div', 'sk reader-sk');
            line.style.width = widths[i];
            wrap.appendChild(line);
        }
        body.appendChild(wrap);
    }

    function showReaderError(err) {
        var body = $('readerBody');
        if (!body) return;
        clear(body);
        var box = mk('div', 'reader-state');
        box.appendChild(mk('div', 'reader-state-title', '正文加载失败'));
        box.appendChild(mk('p', 'reader-state-text', err && err.message ? err.message : '未知错误'));
        if (err && err.code) box.appendChild(mk('div', 'error-code', '错误码 ' + err.code));
        var retry = mk('button', 'btn', '重试');
        retry.type = 'button';
        retry.setAttribute('data-action', 'retry-chapter');
        box.appendChild(retry);
        body.appendChild(box);
    }

    function renderProse(text) {
        var body = $('readerBody');
        if (!body) return;
        clear(body);
        var src = typeof text === 'string' ? text : '';
        src = src.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '').trim();
        if (!src) {
            body.appendChild(mk('div', 'reader-empty', '本章正文为空。'));
            return;
        }
        var blocks = src.split(/\n{2,}/);
        var frag = document.createDocumentFragment();
        for (var i = 0; i < blocks.length; i++) {
            var block = blocks[i].replace(/^\n+|\n+$/g, '');
            if (!block) continue;
            if (/^(\*\s*){3,}$/.test(block) || /^(-\s*){3,}$/.test(block) || /^(_\s*){3,}$/.test(block)) {
                frag.appendChild(mk('div', 'scene-break', '· · ·'));
                continue;
            }
            var hm = /^(#{1,6})\s+(.+)$/.exec(block);
            if (hm && block.indexOf('\n') === -1) {
                frag.appendChild(mk('h2', '', hm[2]));
                continue;
            }
            var p = mk('p', '');
            var lines = block.split('\n');
            for (var j = 0; j < lines.length; j++) {
                if (j > 0) p.appendChild(document.createElement('br'));
                p.appendChild(document.createTextNode(lines[j]));
            }
            frag.appendChild(p);
        }
        if (!frag.childNodes.length) {
            body.appendChild(mk('div', 'reader-empty', '本章正文为空。'));
            return;
        }
        body.appendChild(frag);
    }

    function saveScroll() {
        if (!state.reader.open || !state.book || !state.reader.no) return;
        var el = $('readerScroll');
        if (!el) return;
        var key = PREFIX + 'scroll:' + state.book + ':' + state.reader.no;
        lsSet(key, String(Math.max(0, Math.round(el.scrollTop))));
    }

    function restoreScroll(no) {
        var el = $('readerScroll');
        if (!el) { state.reader.restoring = false; return; }
        var saved = parseInt(lsGet(PREFIX + 'scroll:' + state.book + ':' + no, '0'), 10);
        if (!isFinite(saved) || saved <= 0) {
            state.reader.restoring = false;
            return;
        }
        state.reader.restoring = true;
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                try { el.scrollTop = saved; } catch (e) { /* ignore */ }
                setTimeout(function () { state.reader.restoring = false; }, 120);
            });
        });
    }

    function loadChapter(no, opts) {
        opts = opts || {};
        if (!state.book) return;
        var chap = chapterByNo(no);
        if (!chap) {
            showToast('章节不存在', 'error');
            return;
        }
        if (state.reader.no && state.reader.no !== chap.no) saveScroll();
        var token = ++readerToken;
        state.reader.no = chap.no;
        state.reader.loading = true;
        state.reader.error = null;
        state.reader.restoring = true;
        var scroll = $('readerScroll');
        if (scroll) {
            scroll.setAttribute('data-chapter', String(chap.no));
            try { scroll.scrollTop = 0; } catch (e) { /* ignore */ }
        }
        setReaderHeader(chap);
        updateReaderFooter();
        renderReaderToc();
        showReaderSkeleton();

        state.lastChapter = chap.no;
        lsSet(PREFIX + 'last-chapter:' + state.book, String(chap.no));
        refreshTocCurrent();

        api('/projects/' + enc(state.book) + '/chapters/' + chap.no).then(function (text) {
            if (token !== readerToken || !state.reader.open) return;
            state.reader.loading = false;
            renderProse(typeof text === 'string' ? text : '');
            var metaEl = $('readerMeta');
            if (metaEl) {
                var meta = fmtInt(chap.chars) + ' 字';
                if (chap.updatedAt) {
                    var date = fmtDate(chap.updatedAt);
                    if (date) meta += ' · ' + date;
                }
                metaEl.textContent = meta;
            }
            if (opts.restore === false) {
                state.reader.restoring = false;
            } else {
                restoreScroll(chap.no);
            }
            updateReaderFooter();
        }).catch(function (err) {
            if (token !== readerToken || !state.reader.open) return;
            state.reader.loading = false;
            state.reader.error = err;
            state.reader.restoring = false;
            showReaderError(err);
        });
    }

    /* ------------------------------------------------------------
       通用状态块
       ------------------------------------------------------------ */
    function errorCard(title, err, action, label) {
        var card = mk('section', 'card error-card');
        card.appendChild(mk('h2', 'error-title', title));
        if (err && err.code) card.appendChild(mk('div', 'error-code', '错误码 ' + err.code));
        card.appendChild(mk('p', 'error-msg', err && err.message ? err.message : '未知错误'));
        if (err && err.advice) card.appendChild(mk('p', 'error-msg', err.advice));
        if (action) {
            var actions = mk('div', 'error-actions');
            var btn = mk('button', 'btn', label || '重试');
            btn.type = 'button';
            btn.setAttribute('data-action', action);
            actions.appendChild(btn);
            card.appendChild(actions);
        }
        return card;
    }

    function emptyState(title, text, action, label) {
        var box = mk('div', 'empty-state');
        box.appendChild(mk('h2', 'empty-title', title));
        box.appendChild(mk('p', 'empty-text', text));
        if (action) {
            var btn = mk('button', 'btn', label || '重试');
            btn.type = 'button';
            btn.setAttribute('data-action', action);
            box.appendChild(btn);
        }
        return box;
    }

    /* ------------------------------------------------------------
       重试
       ------------------------------------------------------------ */
    function reloadChapters() {
        var id = state.book;
        if (!id) return;
        state.chapters = null;
        state.chaptersError = null;
        renderToc();
        renderWorkbench();
        api('/projects/' + enc(id) + '/chapters').then(function (list) {
            if (state.book !== id) return;
            state.chapters = normalizeChapters(list);
            state.chaptersError = null;
            renderToc();
            renderWorkbench();
            renderReaderToc();
            updateTopbar();
        }).catch(function (err) {
            if (state.book !== id) return;
            state.chapters = [];
            state.chaptersError = err;
            renderToc();
            renderWorkbench();
            updateTopbar();
        });
    }

    /* ------------------------------------------------------------
       事件
       ------------------------------------------------------------ */
    document.addEventListener('click', function (e) {
        var target = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
        if (!target) return;
        var action = target.getAttribute('data-action');
        switch (action) {
            case 'back-shelf': goShelf(); break;
            case 'select-book': openBook(target.getAttribute('data-id')); break;
            case 'open-chapter': openChapterTarget(target.getAttribute('data-no')); break;
            case 'read-latest':
                if (state.chapters && state.chapters.length) openReader(state.chapters[state.chapters.length - 1].no);
                break;
            case 'goto-workbench': switchTab('workbench'); break;
            case 'goto-toc': switchTab('toc'); break;
            case 'goto-settings': switchTab('settings'); break;
            case 'open-settings': switchTab('settings'); break;
            case 'close-reader': closeReader(false); break;
            case 'prev-chapter': navChapter(-1); break;
            case 'next-chapter': navChapter(1); break;
            case 'font-inc': setFontSize(prefs.fontSize + 1); break;
            case 'font-dec': setFontSize(prefs.fontSize - 1); break;
            case 'theme-cycle': cycleTheme(); break;
            case 'set-theme': setTheme(target.getAttribute('data-theme')); break;
            case 'save-settings': saveSettings(); break;
            case 'retry-books': loadBooks(); break;
            case 'retry-detail': loadBookData(); break;
            case 'retry-chapters': reloadChapters(); break;
            case 'retry-chapter':
                if (state.reader.no) loadChapter(state.reader.no, { restore: true });
                break;
            case 'reset-reading': resetReading(); break;
            default: break;
        }
    });

    document.addEventListener('input', function (e) {
        var t = e.target;
        if (!t || !t.id) return;
        if (t.id === 'fontRange') setFontSize(t.value);
        else if (t.id === 'lineRange') setLineHeight(t.value);
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && state.reader.open) {
            e.preventDefault();
            closeReader(false);
        }
    });

    var tocSearch = $('tocSearch');
    if (tocSearch) {
        tocSearch.addEventListener('input', function () {
            state.tocQuery = this.value;
            applyTocFilter();
        });
    }

    var readerScroll = $('readerScroll');
    if (readerScroll) {
        readerScroll.addEventListener('scroll', function () {
            if (!state.reader.open || state.reader.loading || state.reader.restoring) return;
            if (scrollSaveTimer) return;
            scrollSaveTimer = setTimeout(function () {
                scrollSaveTimer = null;
                saveScroll();
            }, 220);
        }, { passive: true });
    }

    window.addEventListener('pagehide', saveScroll);
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) saveScroll();
    });

    /* ------------------------------------------------------------
       启动
       ------------------------------------------------------------ */
    function boot() {
        applyPrefs();
        if (initialBook) {
            state.view = 'workbench';
            state.lastChapter = readLastChapter(initialBook);
            showView('workbench');
            updateTabs();
            updateTopbar();
            loadBookData();
        } else {
            state.view = 'shelf';
            showView('shelf');
            updateTabs();
            updateTopbar();
            loadBooks();
        }
    }

    boot();
})();
</script>
</body>
</html>`;

    return html.split('__NF_API_BASE__').join(baseJson);
}
