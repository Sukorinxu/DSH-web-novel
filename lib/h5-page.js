// lib/h5-page.js — H5 网页版面板（单文件、零依赖、PC 宽屏优先）。
//
// 设计参照：起点中文网书籍详情页（www.qidian.com/book/1048871606/，通过公开页面结构分析）
//   · 顶栏导航 → 面包屑 → 书籍头部（封面/书名/作者+更新时间/状态标签/数据/操作按钮）
//   · 主体两栏：左「简介 / 最新章节 / 目录预览 / 书评数据」，右「月票·推荐票 / 作者 /
//     版权 / 同类推荐」——本页面把右侧换成「作品数据 / 双轨状态 / 其他书」。
//   · 阅读页：顶栏 + 居中正文（约 800px）+ 底部工具栏（字号/背景/目录/上下章）。
// 不引任何外部资源（离线可用、加载快），数据走同一套 REST + fence 头。
import { PLATFORM_IDS } from './store.js';

const PLATFORM_NAMES = { qidian: '起点', fanqie: '番茄', jjwxc: '晋江', qimao: '七猫', feilu: '飞卢' };
const STAGE_NAMES = {
    topic: '立意', setting: '设定', character: '人物', outline: '大纲', volume: '分卷',
    chapter: '细纲', writing: '正文', revision: '修订', done: '完稿', drafting: '正文',
};

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function platformOptions(selected) {
    const rows = [{ id: '', name: '未设置（回落插件默认）' }]
        .concat(PLATFORM_IDS.map((id) => ({ id, name: `${PLATFORM_NAMES[id] ?? id}（${id}）` })));
    return rows.map((r) => `<option value="${escapeHtml(r.id)}"${r.id === (selected ?? '') ? ' selected' : ''}>${escapeHtml(r.name)}</option>`).join('');
}

/**
 * @param {{ basePath?: string }} [opts]
 * @returns {string} 完整 HTML 文档
 */
export function renderH5Page({ basePath = '/api/novel-forge' } = {}) {
    const base = JSON.stringify(String(basePath || '/api/novel-forge'));
    const platforms = platformOptions('');
    return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>锻炉 · 作品详情</title>
<style>
  :root{
    --bg:#f5f6f7; --plate:#fff; --ink:#1a1a1a; --ink2:#5a5a5a; --ink3:#999; --line:#e6e6e6; --line2:#ddd;
    --accent:#d5342f; --accent2:#b52a26; --accent-soft:#fdeeed; --ok:#2f8f4e; --err:#c0392b;
    --radius:10px; --shadow:0 1px 3px rgba(0,0,0,.04); --top-h:48px;
    --reader-font:"Noto Serif SC","Source Han Serif SC","Songti SC",SimSun,serif;
    --ui-font:-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
    --fs:20px; --lh:2; --reader-bg:#fbfaf7; --reader-ink:#2f2f2f;
  }
  [data-reader-theme="green"]{--reader-bg:#e8f0e2;--reader-ink:#283025}
  [data-reader-theme="night"]{--reader-bg:#141618;--reader-ink:#b8b3aa}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:var(--bg);color:var(--ink);font-family:var(--ui-font);-webkit-text-size-adjust:100%}
  a{color:inherit;text-decoration:none}
  button,input,select,textarea{font-family:inherit;color:inherit}
  .top{position:sticky;top:0;z-index:40;background:#1f1f1f;color:#d9d9d9;height:var(--top-h)}
  .top .in{max-width:1200px;margin:0 auto;height:100%;display:flex;align-items:center;gap:22px;padding:0 18px}
  .top .logo{display:flex;align-items:center;gap:8px;color:#fff;font-weight:700;font-size:16px;flex:none}
  .top .logo b{display:inline-flex;width:26px;height:26px;border-radius:7px;background:var(--accent);color:#fff;align-items:center;justify-content:center;font-size:14px}
  .top nav{display:flex;gap:18px;font-size:13px;min-width:0;overflow:hidden}
  .top nav a,.top nav button{background:none;border:0;color:#c9c9c9;font-size:13px;cursor:pointer;padding:0;white-space:nowrap}
  .top nav a:hover,.top nav button:hover,.top nav .on{color:#fff}
  .top .right{margin-left:auto;display:flex;align-items:center;gap:10px;flex:none}
  .top .right .chip{background:#333;color:#d9d9d9;border-radius:999px;font-size:11px;padding:4px 9px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .top .right .btn-mini{border:1px solid #444;background:#2a2a2a;color:#ddd;border-radius:6px;font-size:12px;padding:5px 9px;cursor:pointer}
  .crumb{max-width:1200px;margin:0 auto;padding:12px 18px 0;font-size:12px;color:var(--ink3)}
  .crumb a{color:var(--ink2)}
  .wrap{max-width:1200px;margin:0 auto;padding:12px 18px 40px}
  .cols{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:18px;align-items:start}
  .card{background:var(--plate);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow)}
  .card+.card{margin-top:14px}
  .card .hd{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line)}
  .card .hd h3{margin:0;font-size:15px;font-weight:600}
  .card .hd .more{margin-left:auto;font-size:12px;color:var(--ink3);cursor:pointer;background:none;border:0}
  .card .bd{padding:16px}
  /* 书籍头部 */
  .bookhead{display:flex;gap:22px;padding:20px}
  .cover{width:126px;height:168px;flex:none;border-radius:6px;position:relative;overflow:hidden;color:#fff;
    box-shadow:0 4px 14px rgba(0,0,0,.18);display:flex;flex-direction:column;justify-content:flex-end;padding:12px;background:linear-gradient(150deg,#c0392b,#7b241c)}
  .cover .ct{font-size:20px;font-weight:800;line-height:1.25;text-shadow:0 1px 3px rgba(0,0,0,.35);word-break:break-word;max-height:96px;overflow:hidden}
  .cover .cs{font-size:11px;opacity:.85;margin-top:6px;letter-spacing:.1em}
  .bookhead .info{min-width:0;flex:1 1 auto}
  .bookhead h1{margin:0 0 10px;font-size:26px;line-height:1.25;font-weight:700;word-break:break-word}
  .bookhead .meta{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:13px;color:var(--ink2);margin-bottom:10px}
  .bookhead .meta .k{color:var(--ink3)}
  .tags{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 12px}
  .tag{font-size:12px;color:var(--ink2);border:1px solid var(--line2);border-radius:4px;padding:2px 7px;background:#fafafa}
  .tag.hot{color:var(--accent);border-color:#f0c9c6;background:var(--accent-soft)}
  .statsline{display:flex;flex-wrap:wrap;gap:22px;font-size:13px;color:var(--ink2);margin:6px 0 14px}
  .statsline b{font-size:20px;color:var(--ink);font-weight:700;margin-right:4px;font-variant-numeric:tabular-nums}
  .actions{display:flex;flex-wrap:wrap;gap:10px}
  .btn{border:1px solid var(--line2);background:#fff;border-radius:6px;padding:9px 18px;font-size:14px;cursor:pointer;min-height:38px;display:inline-flex;align-items:center;justify-content:center;gap:6px}
  .btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
  .btn.primary:hover{background:var(--accent2)}
  .btn.ghost{border-color:transparent;background:transparent;color:var(--ink2)}
  .btn.sm{padding:5px 10px;font-size:12px;min-height:30px}
  .btn[disabled]{opacity:.45;cursor:not-allowed}
  /* 作品信息 tabs */
  .tabs{display:flex;gap:26px;padding:0 20px;border-bottom:1px solid var(--line);font-size:15px}
  .tabs button{background:none;border:0;padding:14px 0;color:var(--ink2);cursor:pointer;position:relative}
  .tabs button.on{color:var(--accent);font-weight:600}
  .tabs button.on:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:var(--accent)}
  .sec-title{font-size:16px;font-weight:600;margin:0 0 12px;display:flex;align-items:center;gap:8px}
  .sec-title:before{content:"";width:3px;height:15px;background:var(--accent);border-radius:2px}
  .intro{font-size:14px;line-height:1.9;color:var(--ink2);white-space:pre-wrap;word-break:break-word}
  .intro.clamp{max-height:190px;overflow:hidden;position:relative}
  .intro.clamp:after{content:"";position:absolute;left:0;right:0;bottom:0;height:60px;background:linear-gradient(transparent,var(--plate))}
  .readmore{margin-top:10px;font-size:13px;color:var(--accent);cursor:pointer;background:none;border:0;padding:0}
  /* 章节列表 */
  .chapter-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 26px}
  .chapter-grid a{display:block;padding:8px 0;border-bottom:1px dashed var(--line);font-size:13px;color:var(--ink2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .chapter-grid a:hover{color:var(--accent)}
  .chapter-grid a .no{color:var(--ink3);margin-right:6px;font-variant-numeric:tabular-nums}
  .latest-list a{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px dashed var(--line);font-size:13px}
  .latest-list a .t{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink2)}
  .latest-list a .d{flex:none;color:var(--ink3);font-size:12px}
  .latest-list a:hover .t{color:var(--accent)}
  /* 右侧 */
  .aside .card .bd{padding:14px 16px}
  .kv{display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:7px 0;border-bottom:1px dashed var(--line)}
  .kv:last-child{border-bottom:0}
  .kv .k{color:var(--ink3);flex:none}
  .kv .v{color:var(--ink2);text-align:right;word-break:break-word;min-width:0}
  .aside .booklist{display:flex;flex-direction:column;gap:10px}
  .aside .booklist .row{display:flex;gap:10px;align-items:center;cursor:pointer}
  .aside .booklist .mini{width:38px;height:50px;border-radius:3px;background:linear-gradient(160deg,#d9d9d9,#a8a8a8);flex:none;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700}
  .aside .booklist .bt{font-size:13px;color:var(--ink);line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .aside .booklist .bs{font-size:11px;color:var(--ink3);margin-top:2px}
  .notice{background:var(--accent-soft);border:1px solid #f1cfcc;border-radius:8px;padding:10px 12px;font-size:12px;color:#8a2b26;line-height:1.7}
  /* 目录页 */
  .catalog-head{display:flex;align-items:flex-end;gap:16px;padding:16px;border-bottom:1px solid var(--line)}
  .catalog-head h2{margin:0;font-size:20px}
  .catalog-head .sub{font-size:12px;color:var(--ink3)}
  .catalog-head .right{margin-left:auto;display:flex;gap:10px;align-items:center}
  .searchbox{width:220px;padding:8px 10px;border:1px solid var(--line2);border-radius:6px;font-size:13px;background:#fafafa}
  .vol{margin-top:18px}
  .vol h4{margin:0 0 8px;font-size:15px;font-weight:600;padding:0 2px}
  .vol .chapters{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0 22px}
  .vol .chapters a{display:flex;gap:6px;padding:7px 0;border-bottom:1px dashed var(--line);font-size:13px;color:var(--ink2);min-width:0}
  .vol .chapters a .t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .vol .chapters a .no{color:var(--ink3);flex:none;font-variant-numeric:tabular-nums}
  .vol .chapters a:hover{color:var(--accent)}
  .empty{text-align:center;color:var(--ink3);font-size:13px;padding:50px 0}
  /* 书架页 */
  .shelf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
  .shelf-item{display:flex;gap:14px;padding:16px;cursor:pointer}
  .shelf-item .mini-cover{width:68px;height:92px;border-radius:4px;background:linear-gradient(150deg,#c0392b,#7b241c);color:#fff;display:flex;align-items:flex-end;padding:8px;font-weight:700;font-size:14px;line-height:1.25;overflow:hidden}
  .shelf-item .bt{font-size:16px;font-weight:600;margin:2px 0 6px}
  .shelf-item .bs{font-size:12px;color:var(--ink3);line-height:1.7}
  /* 阅读页 */
  .reader{position:fixed;inset:0;z-index:60;background:var(--reader-bg);color:var(--reader-ink);display:flex;flex-direction:column}
  .reader[hidden]{display:none}
  .reader .rbar{height:52px;flex:none;display:flex;align-items:center;gap:12px;padding:0 18px;background:rgba(255,255,255,.9);color:#333;border-bottom:1px solid #e8e8e8;backdrop-filter:blur(8px)}
  .reader .rbar .t{flex:1 1 auto;min-width:0;text-align:center;font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .reader .rbar button{border:1px solid #ddd;background:#fff;color:#333;border-radius:6px;padding:5px 10px;font-size:13px;cursor:pointer;flex:none}
  .reader .rbody{flex:1 1 auto;overflow-y:auto;padding:42px 20px 100px;-webkit-overflow-scrolling:touch}
  .reader .page{max-width:800px;margin:0 auto;font-family:var(--reader-font);font-size:var(--fs);line-height:var(--lh);letter-spacing:.2px;text-align:justify}
  .reader .page h1{font-size:26px;line-height:1.5;text-align:center;margin:0 0 10px;font-weight:700}
  .reader .page .rsub{text-align:center;font-size:13px;color:#999;margin-bottom:34px}
  .reader .page p{margin:0 0 1.05em;text-indent:0}
  .reader .rbar2{position:fixed;left:0;right:0;bottom:0;z-index:61;display:flex;align-items:center;gap:10px;padding:10px 18px calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.94);border-top:1px solid #e8e8e8;backdrop-filter:blur(8px);color:#333}
  .reader .rbar2 .pos{flex:1 1 auto;text-align:center;font-size:12px;color:#888;font-variant-numeric:tabular-nums}
  .reader .rbar2 button{border:1px solid #ddd;background:#fff;color:#333;border-radius:6px;padding:7px 14px;font-size:13px;cursor:pointer}
  .reader .rbar2 button.primary{background:var(--accent);border-color:var(--accent);color:#fff}
  .reader .rbar2 button[disabled]{opacity:.4;cursor:not-allowed}
  .fsbtn{font-family:var(--reader-font);font-weight:700}
  /* 设置页 */
  .settings-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:18px;align-items:start}
  .field{margin-top:16px}
  .field:first-child{margin-top:0}
  .field label{display:block;font-size:13px;font-weight:600;color:var(--ink2);margin-bottom:6px}
  .field .hint{font-size:12px;color:var(--ink3);line-height:1.7;margin-top:6px}
  .input,textarea.input,select.input{width:100%;padding:10px 12px;border:1px solid var(--line2);border-radius:6px;background:#fafafa;font-size:14px}
  textarea.input{resize:vertical;line-height:1.7}
  .seg{display:flex;gap:8px;flex-wrap:wrap}
  .seg button{flex:1 1 0;min-width:80px;border:1px solid var(--line2);background:#fff;border-radius:6px;padding:9px 8px;font-size:13px;cursor:pointer}
  .seg button.on{border-color:var(--accent);color:var(--accent);background:var(--accent-soft);font-weight:600}
  .toast{position:fixed;left:50%;bottom:34px;transform:translateX(-50%);background:#1f1f1f;color:#fff;font-size:13px;padding:10px 16px;border-radius:8px;z-index:90;max-width:86vw;box-shadow:0 6px 22px rgba(0,0,0,.25)}
  .errbar{position:fixed;top:calc(var(--top-h) + 10px);left:50%;transform:translateX(-50%);background:#fdecea;border:1px solid #f3c2bd;color:#a1261c;font-size:13px;padding:9px 14px;border-radius:8px;z-index:89;max-width:88vw}
  .loading{color:var(--ink3);font-size:13px;padding:40px 0;text-align:center}
  @media (max-width:980px){
    .cols,.settings-grid{grid-template-columns:1fr}
    .aside{order:2}
    .bookhead{flex-direction:column;align-items:center;text-align:center}
    .bookhead .meta{justify-content:center}
    .bookhead .tags,.actions{justify-content:center}
    .chapter-grid,.vol .chapters{grid-template-columns:1fr 1fr}
    .top nav{display:none}
    .top .right .chip{max-width:130px}
  }
  @media (max-width:560px){
    .wrap{padding:10px 10px 30px}
    .bookhead{padding:16px 14px}
    .bookhead h1{font-size:22px}
    .chapter-grid,.vol .chapters{grid-template-columns:1fr}
    .statsline{gap:12px}
    .statsline b{font-size:17px}
    .cover{width:104px;height:140px}
    .searchbox{width:130px}
    .reader .rbar{padding:0 10px;gap:8px}
    .reader .rbody{padding:26px 16px 96px}
    .reader .page{font-size:18px}
    .reader .rbar2{padding:8px 10px calc(8px + env(safe-area-inset-bottom));gap:8px}
  }
  @media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>
</head>
<body>
<header class="top">
  <div class="in">
    <a class="logo" href="javascript:;" id="homeLink"><b>炉</b>锻炉 · H5</a>
    <nav>
      <button data-nav="home" class="on">作品详情</button>
      <button data-nav="catalog">目录</button>
      <button data-nav="settings">设置</button>
    </nav>
    <div class="right">
      <span class="chip" id="sessionChip" hidden></span>
      <button class="btn-mini" id="classicBtn" title="切回经典 React 面板">经典面板</button>
    </div>
  </div>
</header>
<div class="crumb" id="crumb"></div>
<div id="err"></div>
<main class="wrap" id="main"><div class="loading">加载中…</div></main>

<div class="reader" id="reader" hidden>
  <div class="rbar">
    <button id="rBack">← 详情</button>
    <div class="t" id="rTitle">正文</div>
    <button class="fsbtn" id="rFsDown">A−</button>
    <button class="fsbtn" id="rFsUp">A＋</button>
    <button id="rTheme">背景</button>
  </div>
  <div class="rbody" id="rBody"><div class="page" id="rPage"></div></div>
  <div class="rbar2">
    <button id="rCatalog">目录</button>
    <button id="rPrev">上一章</button>
    <div class="pos" id="rPos">—</div>
    <button id="rNext" class="primary">下一章</button>
  </div>
</div>
<div id="toast"></div>

<script>
(function(){
  'use strict';
  var API = ${base};
  var HDR = { 'x-dsh-novel-forge': '1', 'content-type': 'application/json' };
  var qs = new URLSearchParams(location.search);
  var state = {
    session: qs.get('session') || '',
    book: qs.get('book') || '',
    page: 'home',
    books: [], detail: null, elements: null, chapters: [],
    filter: '', expanded: false,
    openNo: null, openTitle: '', openText: '',
    fs: Number(ls('nf-h5-fs') || 20),
    lh: Number(ls('nf-h5-lh') || 2),
    theme: ls('nf-h5-rtheme') || 'paper'
  };

  function ls(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lset(k, v){ try { localStorage.setItem(k, v); } catch (e) { /* 隐私模式忽略 */ } }
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function fmt(n){ return Number(n || 0).toLocaleString('zh-CN'); }
  function wan(n){ n = Number(n || 0); return n >= 10000 ? (n / 10000).toFixed(2).replace(/\\.?0+$/, '') + ' 万' : fmt(n); }
  function dateStr(iso){ if (!iso) return '—'; var d = new Date(iso); if (isNaN(d.getTime())) return '—'; return d.toLocaleDateString('zh-CN'); }
  function api(path, opts){
    opts = opts || {};
    return fetch(API + path, { method: opts.method || 'GET', headers: HDR, body: opts.body }).then(function(r){
      return r.json().then(function(j){
        if (!j || j.ok !== true) throw new Error((j && j.error && j.error.message) || ('HTTP ' + r.status));
        return j.value;
      });
    });
  }
  function withSession(path){
    if (!state.session) return path;
    return path + (path.indexOf('?') >= 0 ? '&' : '?') + 'session=' + encodeURIComponent(state.session);
  }
  function err(msg){
    var el = $('err');
    el.innerHTML = msg ? '<div class="errbar" role="alert">' + esc(msg) + '</div>' : '';
    if (msg) setTimeout(function(){ if (el.textContent === msg) el.innerHTML = ''; }, 6000);
  }
  function toast(msg){
    var el = $('toast');
    el.innerHTML = '<div class="toast" role="status">' + esc(msg) + '</div>';
    setTimeout(function(){ el.innerHTML = ''; }, 2600);
  }
  function stageName(s){ return STAGE_NAMES_STATIC[s] || s || '—'; }
  var STAGE_NAMES_STATIC = ${JSON.stringify(STAGE_NAMES)};

  // ── 数据加载 ─────────────────────────────────────────────────────────
  function loadBooks(){
    return api(withSession('/projects')).then(function(list){
      state.books = Array.isArray(list) ? list : [];
      render();
    }).catch(function(e){ err('书目加载失败：' + e.message); render(); });
  }
  function loadBook(){
    if (!state.book) { return loadBooks(); }
    return Promise.all([
      api(withSession('/projects/' + encodeURIComponent(state.book))),
      api(withSession('/projects/' + encodeURIComponent(state.book) + '/chapters')).catch(function(){ return []; }),
      api(withSession('/projects/' + encodeURIComponent(state.book) + '/elements')).catch(function(){ return null; })
    ]).then(function(res){
      state.detail = res[0]; state.chapters = Array.isArray(res[1]) ? res[1] : []; state.elements = res[2] || null;
      if (state.detail && state.detail.title) document.title = state.detail.title + ' · 锻炉 H5';
      render();
    }).catch(function(e){ err('书加载失败：' + e.message); render(); });
  }
  function totalChars(){ var n = 0; for (var i = 0; i < state.chapters.length; i++) n += Number(state.chapters[i].chars || 0); return n; }
  function detail(){ return state.detail || {}; }
  function fusion(){ return (state.detail && state.detail.fusion) || {}; }
  function charView(){ return (state.detail && state.detail.charView) || {}; }
  function elems(){ return state.elements || {}; }
  function latestNo(){ return Number(fusion().latestChapter || (state.chapters.length ? state.chapters[state.chapters.length - 1].no : 0)); }
  function latestRec(){ var n = latestNo(); for (var i = 0; i < state.chapters.length; i++) if (Number(state.chapters[i].no) === n) return state.chapters[i]; return null; }
  function chapterByNo(no){ for (var i = 0; i < state.chapters.length; i++) if (Number(state.chapters[i].no) === Number(no)) return state.chapters[i]; return null; }
  function sortedChapters(){ return state.chapters.slice().sort(function(a, b){ return Number(a.no) - Number(b.no); }); }
  function chapterRow(c){
    var done = Number(c.no) <= Number(ls('nf-h5-last:' + state.book) || 0);
    return '<a href="javascript:;" data-ch="' + esc(c.no) + '" class="' + (done ? 'done' : '') + '"><span class="no">第' + esc(c.no) + '章</span><span class="t">' + esc(c.title || '未命名') + '</span></a>';
  }

  // ── 页面渲染 ─────────────────────────────────────────────────────────
  function render(){
    var main = $('main');
    if (state.page === 'catalog') renderCatalog(main);
    else if (state.page === 'settings') renderSettings(main);
    else if (state.page === 'shelf' || !state.book) renderShelf(main);
    else renderBook(main);
    navOn();
    $('sessionChip').hidden = !state.session;
    $('sessionChip').textContent = state.session ? ('会话 ' + String(state.session).slice(0, 6)) : '';
    $('crumb').innerHTML = state.book && state.detail
      ? '<a href="javascript:;" id="crumbHome">首页</a> <span>/</span> <span>' + esc(detail().title || state.book) + '</span>'
      : '<a href="javascript:;" id="crumbHome">首页</a> <span>/</span> <span>' + (state.page === 'shelf' ? '我的书架' : '全部作品') + '</span>';
    var ch = $('crumbHome'); if (ch) ch.onclick = function(){ goShelf(); };
  }
  function navOn(){
    var navs = document.querySelectorAll('.top nav button[data-nav]');
    for (var i = 0; i < navs.length; i++){
      var k = navs[i].getAttribute('data-nav');
      navs[i].className = (k === 'home' && (state.page === 'home' || state.page === 'shelf')) || k === state.page ? 'on' : '';
    }
  }
  function setPage(p){ state.page = p; render(); window.scrollTo(0, 0); }
  function goShelf(){ state.book = ''; state.detail = null; state.chapters = []; state.elements = null; setPage('shelf'); }

  function coverOf(title, genre){
    var t = String(title || '书');
    var palettes = [['#c0392b','#7b241c'], ['#2c3e50','#1a252f'], ['#8e44ad','#4a235a'], ['#16a085','#0e6655'], ['#d35400','#873600'], ['#2980b9','#1a5276']];
    var seed = 0; for (var i = 0; i < t.length; i++) seed = (seed + t.charCodeAt(i)) % palettes.length;
    var p = palettes[seed];
    return '<div class="cover" style="background:linear-gradient(150deg,' + p[0] + ',' + p[1] + ')"><div class="ct">' + esc(t.slice(0, 12)) + '</div><div class="cs">' + esc(String(genre || '锻炉作品').slice(0, 12)) + '</div></div>';
  }

  function renderShelf(main){
    var html = '<div style="display:flex;align-items:flex-end;gap:14px;margin:8px 0 18px"><h2 style="margin:0;font-size:22px">全部作品</h2><span style="color:var(--ink3);font-size:13px">' + state.books.length + ' 本</span></div>';
    if (!state.books.length) html += '<div class="card"><div class="empty">还没有书——先在 DSH 面板里创建，或用「经典面板」接入旧稿。</div></div>';
    else {
      html += '<div class="shelf-grid">';
      state.books.forEach(function(b){
        html += '<div class="card shelf-item" data-book="' + esc(b.id) + '"><div class="mini-cover">' + esc(String(b.title || b.id).slice(0, 10)) + '</div><div style="min-width:0"><div class="bt">' + esc(b.title || b.id) + '</div><div class="bs">' + esc(b.genre || '未定题材') + ' · ' + esc(stageName(b.stage)) + '<br>' + (b.chapters ? (b.chapters + ' 章') : '') + '</div></div></div>';
      });
      html += '</div>';
    }
    main.innerHTML = html;
    Array.prototype.forEach.call(main.querySelectorAll('[data-book]'), function(el){
      el.onclick = function(){ openBook(el.getAttribute('data-book')); };
    });
  }

  function renderBook(main){
    var d = detail(), fu = fusion(), last = latestRec(), lno = latestNo();
    var title = d.title || state.book;
    var chapters = sortedChapters();
    var latest = chapters.slice(-6).reverse();
    var preview = chapters.slice(0, 24);
    var intro = d.logline || (d.intro || '');
    if (!intro && elems().meta) intro = elems().meta.logline || '';
    if (!intro) intro = '（还没有一句话立意——到「设置」补一句，写前简报与诊断都会用。）';
    var html = '<div class="cols"><div class="maincol">';

    // 书籍头部
    html += '<div class="card"><div class="bookhead">' + coverOf(title, d.genre) +
      '<div class="info"><h1>' + esc(title) + '</h1>' +
      '<div class="meta"><span>阶段：<b style="color:var(--ink)">' + esc(stageName(d.stage)) + '</b></span>' +
      '<span>最近更新：' + esc(last ? dateStr(last.updatedAt || d.updatedAt) : dateStr(d.updatedAt)) + '</span>' +
      '<span>章节：' + fmt(fu.chapterCount || chapters.length) + '</span></div>' +
      '<div class="tags"><span class="tag hot">' + esc(fu.layout === 'fiction-suite' ? 'H5 · fiction-suite' : 'H5 · 经典布局') + '</span>' +
      '<span class="tag">' + esc(d.genre || '未定题材') + '</span>' +
      '<span class="tag">' + esc(fu.versioning === 'git' ? 'git 版本' : '多版本') + '</span>' +
      (fu.platformName ? '<span class="tag">' + esc(fu.platformName) + '</span>' : '<span class="tag">未设平台</span>') +
      '<span class="tag">' + esc(charView().charMin || 2000) + '–' + esc(charView().charMax || 4000) + ' 字/章</span></div>' +
      '<div class="statsline"><span><b>' + wan(totalChars()) + '</b>总字数</span>' +
      '<span><b>' + fmt(chapters.length) + '</b>章</span>' +
      '<span><b>' + fmt((elems().foreshadows || []).length) + '</b>伏笔</span>' +
      '<span><b>' + fmt(elems().worldbookCount || 0) + '</b>世界书</span></div>' +
      '<div class="actions"><button class="btn primary" id="readBtn">' + (lno ? '继续阅读 · 第' + lno + '章' : '开始阅读') + '</button>' +
      '<button class="btn" id="catalogBtn">查看目录</button>' +
      '<button class="btn" id="settingsBtn">作品设置</button>' +
      '<button class="btn ghost" id="classicBtn2">经典面板</button></div>' +
      '</div></div>' +
      '<div class="tabs"><button class="on">作品信息</button><button id="tabCatalog">目录</button><button id="tabSettings">设置</button></div>' +
      '</div>';

    // 简介
    html += '<div class="card"><div class="bd"><h3 class="sec-title">作品简介</h3>' +
      '<div class="intro' + (state.expanded ? '' : ' clamp') + '" id="intro">' + esc(intro) + '</div>' +
      '<button class="readmore" id="moreBtn">' + (state.expanded ? '收起' : '展开全部') + '</button></div></div>';

    // 最新章节
    html += '<div class="card"><div class="hd"><h3>最新章节</h3><button class="more" id="allLatest">查看全部 ›</button></div><div class="bd latest-list">';
    latest.forEach(function(c){ html += '<a href="javascript:;" data-ch="' + esc(c.no) + '"><span class="t">第' + esc(c.no) + '章 ' + esc(c.title || '') + '</span><span class="d">' + esc(dateStr(c.updatedAt)) + '</span></a>'; });
    if (!latest.length) html += '<div class="empty" style="padding:20px 0">还没有正文章节</div>';
    html += '</div></div>';

    // 目录预览
    html += '<div class="card"><div class="hd"><h3>目录 · 共 ' + fmt(chapters.length) + ' 章</h3><button class="more" id="allCatalog">完整目录 ›</button></div><div class="bd"><div class="chapter-grid">';
    preview.forEach(function(c){ html += chapterRow(c); });
    if (!preview.length) html += '<div class="empty" style="grid-column:1/-1;padding:20px 0">还没有章节</div>';
    html += '</div></div></div>';

    // 作品数据（体检/双轨）
    var debt = elems().qualityDebt;
    html += '<div class="card"><div class="hd"><h3>作品状态</h3><span style="margin-left:auto;font-size:12px;color:var(--ink3)">只读</span></div><div class="bd" style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px">' +
      kv('布局', fu.layout || '—') + kv('版本策略', fu.versioning === 'git' ? 'git（正文单文件覆盖）' : (fu.versioning || '—')) +
      kv('.git', fu.hasGit ? '已就绪' : '未初始化（缺历史护栏）') + kv('平台口径', fu.platformName || '未设置') +
      kv('字数口径', (charView().charMin || '?') + '–' + (charView().charMax || '?') + ' 字/章') + kv('伏笔在册', String((elems().foreshadows || []).length) + ' 条') +
      '</div></div>';

    html += '</div><aside class="aside">';
    // 右侧：作品数据卡
    html += '<div class="card"><div class="hd"><h3>本书数据</h3></div><div class="bd">' +
      kv('总字数', wan(totalChars())) + kv('已写章', fmt(chapters.length)) + kv('最新章', lno ? ('第' + lno + '章') : '—') +
      kv('世界书', String(elems().worldbookCount || 0) + ' 条') + kv('人物卡', String((elems().characters || []).length) + ' 张') +
      (debt ? kv('质量债', 'hard ' + (debt.hard || 0) + ' / major ' + (debt.major || 0) + ' / minor ' + (debt.minor || 0)) : '') +
      '</div></div>';
    // 右侧：快捷入口
    html += '<div class="card"><div class="hd"><h3>快捷入口</h3></div><div class="bd" style="display:flex;flex-direction:column;gap:10px">' +
      '<button class="btn primary" id="sideRead">继续阅读</button>' +
      '<button class="btn" id="sideSettings">作品设置</button>' +
      '<button class="btn" id="sideClassic">切到经典面板</button>' +
      '</div></div>';
    // 右侧：其他书
    if (state.books.length > 1 || !state.books.length) {
      html += '<div class="card"><div class="hd"><h3>其他作品</h3></div><div class="bd"><div class="booklist">';
      state.books.filter(function(b){ return b.id !== state.book; }).slice(0, 6).forEach(function(b){
        html += '<div class="row" data-book="' + esc(b.id) + '"><div class="mini">' + esc(String(b.title || b.id).slice(0, 1)) + '</div><div style="min-width:0"><div class="bt">' + esc(b.title || b.id) + '</div><div class="bs">' + esc(b.genre || '未定题材') + ' · ' + esc(stageName(b.stage)) + '</div></div></div>';
      });
      if (state.books.length <= 1) html += '<div style="font-size:12px;color:var(--ink3)">只有这一本书。</div>';
      html += '</div></div></div>';
    }
    // 右侧：提示
    html += '<div class="card"><div class="bd"><div class="notice">H5 版为独立渲染：工作台/目录/阅读/设置都走同一套 REST 门禁；<b>布局与版本策略是进程级配置</b>，改它要重启宿主。</div></div></div>';
    html += '</aside></div>';

    main.innerHTML = html;
    bindBook(main);
  }

  function kv(k, v){ return '<div class="kv"><span class="k">' + esc(k) + '</span><span class="v">' + esc(v) + '</span></div>'; }

  function bindBook(main){
    var on = function(id, fn){ var el = $(id); if (el) el.onclick = fn; };
    on('readBtn', function(){ if (latestNo()) openReader(latestNo()); else openFirst(); });
    on('catalogBtn', function(){ setPage('catalog'); });
    on('settingsBtn', function(){ setPage('settings'); });
    on('classicBtn2', classic);
    on('sideRead', function(){ if (latestNo()) openReader(latestNo()); });
    on('sideSettings', function(){ setPage('settings'); });
    on('sideClassic', classic);
    on('moreBtn', function(){ state.expanded = !state.expanded; render(); });
    on('allLatest', function(){ setPage('catalog'); });
    on('allCatalog', function(){ setPage('catalog'); });
    var tabc = $('tabCatalog'); if (tabc) tabc.onclick = function(){ setPage('catalog'); };
    var tabs = $('tabSettings'); if (tabs) tabs.onclick = function(){ setPage('settings'); };
    Array.prototype.forEach.call(main.querySelectorAll('[data-ch]'), function(el){
      el.onclick = function(){ openReader(Number(el.getAttribute('data-ch'))); };
    });
    Array.prototype.forEach.call(main.querySelectorAll('[data-book]'), function(el){
      el.onclick = function(){ openBook(el.getAttribute('data-book')); };
    });
  }

  function openFirst(){ if (state.chapters.length) openReader(Number(sortedChapters()[0].no)); else err('还没有章节'); }

  function renderCatalog(main){
    if (!state.book){ renderShelf(main); return; }
    var d = detail(), chapters = sortedChapters();
    var q = state.filter.trim();
    var rows = chapters.filter(function(c){
      if (!q) return true;
      var s = String(c.no) + ' ' + (c.title || '') + ' ' + (c.summary || '');
      return s.toLowerCase().indexOf(q.toLowerCase()) >= 0;
    });
    var html = '<div class="card"><div class="catalog-head"><div><h2>目录</h2><div class="sub">共 ' + chapters.length + ' 章 · ' + fmt(totalChars()) + ' 字 · 最近更新 ' + esc(dateStr(d.updatedAt)) + '</div></div>' +
      '<div class="right"><input class="searchbox" id="q" placeholder="搜索章号 / 标题 / 摘要" value="' + esc(state.filter) + '"></div></div><div class="bd">';
    if (!rows.length) html += '<div class="empty">没有匹配的章节</div>';
    else {
      // 每 50 章合成一卷展示（项目本身没有卷信息）
      var size = 50;
      for (var start = 0; start < rows.length; start += size){
        var group = rows.slice(start, start + size);
        var from = group[0].no, to = group[group.length - 1].no;
        html += '<div class="vol"><h4>第 ' + from + ' — ' + to + ' 章</h4><div class="chapters">';
        group.forEach(function(c){ html += '<a href="javascript:;" data-ch="' + esc(c.no) + '"><span class="no">' + esc(c.no) + '</span><span class="t">' + esc(c.title || '未命名') + '</span></a>'; });
        html += '</div></div>';
      }
    }
    html += '</div></div>';
    main.innerHTML = html;
    var input = $('q');
    input.oninput = function(e){ state.filter = e.target.value; renderCatalog(main); var el = $('q'); if (el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); } };
    Array.prototype.forEach.call(main.querySelectorAll('[data-ch]'), function(el){
      el.onclick = function(){ openReader(Number(el.getAttribute('data-ch'))); };
    });
  }

  function renderSettings(main){
    if (!state.book){
      main.innerHTML = '<div class="card"><div class="empty">先从书架选一本书，再改它的设置。</div></div>';
      return;
    }
    var d = detail(), fu = fusion(), cv = charView();
    var html = '<div class="cols"><div class="maincol">' +
      '<div class="card"><div class="hd"><h3>本书设置</h3></div><div class="bd">' +
      '<div class="field"><label>每章字数区间</label><input class="input" id="sChars" value="' + esc(cv.charLimits || '') + '" placeholder="如 2500-3500；留空=清除，回落平台/插件口径"><div class="hint">生效口径 ' + esc(String(cv.charMin || '?')) + '–' + esc(String(cv.charMax || '?')) + ' 字（' + esc(cv.charSource === 'custom' ? '本书自定义' : cv.charSource === 'platform' ? '平台口径' : '插件默认') + '）</div></div>' +
      '<div class="field"><label>投放平台</label><select class="input" id="sPlatform">' + ${JSON.stringify(platforms)} + '</select></div>' +
      '<div class="field"><label>一句话立意（logline，≤120 字）</label><textarea class="input" id="sLogline" rows="3" maxlength="120" placeholder="主角、欲望、阻力、代价…">' + esc(d.logline || '') + '</textarea><div class="hint">写进每次写章的上下文包与黄金三章诊断；留空则不注入。</div></div>' +
      '<div class="field" style="display:flex;gap:10px;align-items:center;margin-top:20px"><button class="btn primary" id="saveSet">保存本书设置</button><button class="btn" id="goCatalog">去目录</button></div>' +
      '</div></div>' +
      '<div class="card"><div class="hd"><h3>阅读设置</h3></div><div class="bd">' +
      '<div class="field"><label>字号 <b id="fsVal">' + state.fs + '</b>px</label><input type="range" class="input" id="fsRange" min="16" max="28" step="1" value="' + state.fs + '"></div>' +
      '<div class="field"><label>行高 <b id="lhVal">' + state.lh.toFixed(1) + '</b></label><input type="range" class="input" id="lhRange" min="1.6" max="2.4" step="0.1" value="' + state.lh + '"></div>' +
      '<div class="field"><label>阅读背景</label><div class="seg" id="themeSeg"><button data-t="paper">纸白</button><button data-t="green">护眼</button><button data-t="night">夜间</button></div></div>' +
      '<div class="hint" style="margin-top:10px">设置本机保存（localStorage），跨会话保留。</div>' +
      '</div></div>' +
      '</div><aside class="aside"><div class="card"><div class="hd"><h3>作品状态</h3></div><div class="bd">' +
      kv('布局', fu.layout || '—') + kv('版本策略', fu.versioning || '—') + kv('.git', fu.hasGit ? '已就绪' : '未初始化') +
      kv('平台', fu.platformName || '未设置') + kv('章节', String(fu.chapterCount || state.chapters.length)) +
      kv('最近更新', dateStr(d.updatedAt)) +
      '</div></div><div class="card"><div class="bd"><div class="notice">布局 / 版本策略是<b>进程级插件配置</b>（forge|fiction-suite、versions|git），改动需要编辑 profile 并重启 DSH web；这里只读展示。</div></div></div></aside></div>';
    main.innerHTML = html;
    var sel = $('sPlatform'); if (sel) sel.value = fu.platform || '';
    $('saveSet').onclick = saveSettings;
    $('goCatalog').onclick = function(){ setPage('catalog'); };
    bindReadPrefs();
  }

  function bindReadPrefs(){
    var fs = $('fsRange'); if (fs) fs.oninput = function(e){ state.fs = Number(e.target.value); $('fsVal').textContent = state.fs; lset('nf-h5-fs', state.fs); applyReaderStyle(); };
    var lh = $('lhRange'); if (lh) lh.oninput = function(e){ state.lh = Number(e.target.value); $('lhVal').textContent = state.lh.toFixed(1); lset('nf-h5-lh', state.lh); applyReaderStyle(); };
    var seg = $('themeSeg');
    if (seg) Array.prototype.forEach.call(seg.querySelectorAll('button'), function(b){
      b.className = b.getAttribute('data-t') === state.theme ? 'on' : '';
      b.onclick = function(){ state.theme = b.getAttribute('data-t'); lset('nf-h5-rtheme', state.theme); applyReaderStyle(); bindReadPrefs(); };
    });
  }

  function saveSettings(){
    var chars = $('sChars').value.trim(), platform = $('sPlatform').value, logline = $('sLogline').value.trim();
    var btn = $('saveSet'); btn.disabled = true; btn.textContent = '保存中…';
    api('/projects/' + encodeURIComponent(state.book) + '/settings', {
      method: 'POST', body: JSON.stringify({ chars: chars, platform: platform, logline: logline })
    }).then(function(v){
      if (state.detail){
        state.detail.logline = v.logline || '';
        state.detail.platform = v.platform || '';
        state.detail.fusion = Object.assign({}, state.detail.fusion, { platform: v.platform || '', platformName: v.platformName || '' });
        state.detail.charView = { charMin: v.charMin, charMax: v.charMax, charSource: v.charSource };
        if (v.charLimits) state.detail.charView.charLimits = v.charLimits;
      }
      toast('已保存 ✓');
      render();
    }).catch(function(e){
      btn.disabled = false; btn.textContent = '保存本书设置';
      err('保存失败：' + e.message);
    });
  }

  // ── 阅读器 ───────────────────────────────────────────────────────────
  function applyReaderStyle(){
    document.documentElement.style.setProperty('--fs', state.fs + 'px');
    document.documentElement.style.setProperty('--lh', String(state.lh));
    document.body.setAttribute('data-reader-theme', state.theme === 'paper' ? '' : state.theme);
  }
  function openReader(no){
    if (!state.book) return;
    var rec = chapterByNo(no);
    state.openNo = Number(no);
    state.openTitle = rec ? (rec.title || '') : '';
    $('reader').hidden = false;
    $('rTitle').textContent = '第' + no + '章   ' + (state.openTitle || '');
    $('rPage').innerHTML = '<div class="loading">正文加载中…</div>';
    if (rec) lset('nf-h5-last:' + state.book, String(no));
    api(withSession('/projects/' + encodeURIComponent(state.book) + '/chapters/' + no)).then(function(text){
      state.openText = String(text || '');
      renderReaderBody();
      var pos = ls('nf-h5-scroll:' + state.book + ':' + no);
      if (pos) $('rBody').scrollTop = Number(pos);
      updateReaderPos();
    }).catch(function(e){
      $('rPage').innerHTML = '<div class="empty">正文加载失败：' + esc(e.message) + '</div>';
    });
    applyReaderStyle();
  }
  function renderReaderBody(){
    var text = state.openText || '';
    var paras = text.split(/\\n\\s*\\n/).map(function(p){ return p.trim(); }).filter(Boolean);
    var page = $('rPage');
    page.innerHTML = '';
    var h = document.createElement('h1'); h.textContent = '第' + state.openNo + '章 ' + (state.openTitle || ''); page.appendChild(h);
    var sub = document.createElement('div'); sub.className = 'rsub'; sub.textContent = (state.detail && state.detail.title) || ''; page.appendChild(sub);
    if (!paras.length){ page.innerHTML += '<div class="empty">（这一章还没有正文）</div>'; return; }
    paras.forEach(function(p){ var el = document.createElement('p'); el.textContent = p; page.appendChild(el); });
  }
  function updateReaderPos(){
    var arr = sortedChapters(), idx = -1;
    for (var i = 0; i < arr.length; i++) if (Number(arr[i].no) === Number(state.openNo)) idx = i;
    $('rPos').textContent = idx >= 0 ? ('第 ' + arr[idx].no + ' / ' + (arr.length ? arr[arr.length - 1].no : '?') + ' 章') : '—';
    $('rPrev').disabled = idx <= 0;
    $('rNext').disabled = idx < 0 || idx >= arr.length - 1;
    $('rPrev').onclick = function(){ if (idx > 0) closeReaderThen(arr[idx - 1].no); };
    $('rNext').onclick = function(){ if (idx >= 0 && idx < arr.length - 1) closeReaderThen(arr[idx + 1].no); };
  }
  function closeReader(savePos){
    if (savePos !== false && state.openNo != null && state.book) lset('nf-h5-scroll:' + state.book + ':' + state.openNo, String($('rBody').scrollTop));
    $('reader').hidden = true;
  }
  function closeReaderThen(no){ closeReader(); openReader(no); }

  // ── 事件 ─────────────────────────────────────────────────────────────
  function classic(){
    if (window.parent && window.parent !== window) {
      try { window.parent.postMessage({ type: 'nf-h5-classic' }, '*'); } catch (e) {}
    }
    toast('已请求切回经典面板');
  }
  function openBook(id){
    state.book = id; state.detail = null; state.elements = null; state.chapters = []; state.expanded = false;
    try { var u = new URL(location.href); u.searchParams.set('book', id); history.replaceState(null, '', u.toString()); } catch (e) {}
    setPage('home'); loadBook();
  }
  $('homeLink').onclick = function(){ goShelf(); };
  Array.prototype.forEach.call(document.querySelectorAll('.top nav button[data-nav]'), function(b){
    b.onclick = function(){
      var k = b.getAttribute('data-nav');
      if (k === 'home') { if (state.book) setPage('home'); else goShelf(); }
      else setPage(k);
    };
  });
  $('classicBtn').onclick = classic;
  $('rBack').onclick = function(){ closeReader(); };
  $('rFsUp').onclick = function(){ state.fs = Math.min(28, state.fs + 1); lset('nf-h5-fs', state.fs); applyReaderStyle(); };
  $('rFsDown').onclick = function(){ state.fs = Math.max(16, state.fs - 1); lset('nf-h5-fs', state.fs); applyReaderStyle(); };
  $('rTheme').onclick = function(){
    state.theme = state.theme === 'paper' ? 'green' : state.theme === 'green' ? 'night' : 'paper';
    lset('nf-h5-rtheme', state.theme); applyReaderStyle(); toast(state.theme === 'paper' ? '纸白背景' : state.theme === 'green' ? '护眼背景' : '夜间背景');
  };
  $('rCatalog').onclick = function(){ closeReader(); setPage('catalog'); };
  $('rBody').addEventListener('scroll', function(){
    if (state.openNo != null && state.book) lset('nf-h5-scroll:' + state.book + ':' + state.openNo, String($('rBody').scrollTop));
  }, { passive: true });
  document.addEventListener('keydown', function(e){
    if (e.key !== 'Escape') return;
    if (!$('reader').hidden) closeReader();
  });
  window.addEventListener('message', function(e){
    if (e.data && e.data.type === 'nf-panel-mode') { /* 宿主切模式后本页卸载，无需处理 */ }
  });

  // 启动
  applyReaderStyle();
  if (state.book) loadBook(); else goShelf();
})();
</script>
</body>
</html>`;
}
