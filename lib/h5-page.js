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
<title>造神 · 作品详情</title>
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
  /* 功能页（人物 / 世界书 / 伏笔 / 体检） */
  .entry-list{display:flex;flex-direction:column;gap:10px}
  .entry{background:var(--plate);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
  .entry .et{font-size:14px;font-weight:600;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .entry .eb{margin-top:6px;font-size:13px;line-height:1.85;color:var(--ink2);white-space:pre-wrap;word-break:break-word;max-height:200px;overflow:auto}
  .tag2{font-size:11px;color:var(--ink3);border:1px solid var(--line2);border-radius:4px;padding:1px 6px;font-weight:400}
  .issue{display:flex;gap:10px;padding:9px 0;border-bottom:1px dashed var(--line);font-size:13px;line-height:1.7}
  .issue:last-child{border-bottom:0}
  .issue .sev{flex:none;font-weight:700;width:16px}
  .issue.err .sev{color:var(--err)}
  .issue.warn .sev{color:#b8860b}
  .issue .where{color:var(--ink3);flex:none}
  .issue .msg{color:var(--ink2);min-width:0;word-break:break-word}
  /* 阅读器增强 */
  .reader .rprog{position:absolute;left:0;top:0;height:2px;width:0;background:var(--accent);z-index:72;transition:width .1s linear}
  .reader .page[data-font="sans"]{font-family:var(--ui-font)}
  .reader .page[data-width="narrow"]{max-width:620px}
  .reader .page[data-width="wide"]{max-width:960px}
  .rset{position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:78;width:min(520px,92vw);background:#fff;color:#222;border:1px solid #e3e3e3;border-radius:12px;box-shadow:0 12px 34px rgba(0,0,0,.22);padding:16px}
  .rset[hidden]{display:none}
  .rset .row{margin-bottom:13px}
  .rset .row:last-child{margin-bottom:0}
  .rset label{display:flex;justify-content:space-between;font-size:13px;font-weight:600;color:#444;margin-bottom:5px}
  .rset .seg{display:flex;gap:8px}
  .rset .seg button{flex:1;border:1px solid #ddd;background:#fff;border-radius:6px;padding:7px 6px;font-size:13px;cursor:pointer;color:#333}
  .rset .seg button.on{border-color:var(--accent);color:var(--accent);background:var(--accent-soft)}
  .rend{margin-top:34px;padding-top:18px;border-top:1px dashed #ddd;text-align:center;color:#999;font-size:13px}
  .rend .rend-actions{display:flex;gap:10px;justify-content:center;margin-top:12px;flex-wrap:wrap}
  .rend .rend-actions button{border:1px solid #ddd;background:#fff;border-radius:6px;padding:7px 12px;font-size:13px;cursor:pointer;color:#555}
  /* 工具台 */
  .tools-grid{display:grid;grid-template-columns:280px minmax(0,1fr);gap:16px;align-items:start}
  .toolcat-title{font-size:12px;font-weight:700;color:var(--ink3);letter-spacing:.08em;margin:14px 0 6px}
  .toolcat-title:first-child{margin-top:0}
  .toolrow{display:block;width:100%;text-align:left;border:1px solid var(--line);background:#fafafa;border-radius:8px;padding:8px 10px;margin-bottom:6px;cursor:pointer;font-family:inherit}
  .toolrow b{display:block;font-size:13px;color:var(--ink)}
  .toolrow span{display:block;font-size:11px;color:var(--ink3);line-height:1.5;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .toolrow:hover{border-color:var(--accent);background:var(--accent-soft)}
  .result{white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.7;background:#fafafa;border:1px solid var(--line);border-radius:8px;padding:12px;max-height:520px;overflow:auto;margin:0;font-family:ui-monospace,Consolas,monospace}
  @media (max-width:980px){.tools-grid{grid-template-columns:1fr}}
  /* ---- 控件对齐基线（1.13）：按钮/输入框统一盒模型、行高、垂直居中 ---- */
  .btn,.input,textarea.input,select.input,.searchbox,.seg button,.toolrow{box-sizing:border-box}
  .btn{height:36px;padding:0 16px;line-height:1;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;vertical-align:middle}
  .btn.sm{height:30px;padding:0 10px}
  .actions{align-items:center;row-gap:10px}
  .input,select.input{height:38px;padding:0 10px;line-height:38px}
  select.input{padding-right:8px}
  textarea.input{height:auto;min-height:80px;line-height:1.7;padding:9px 10px}
  .searchbox{height:34px;padding:0 10px;line-height:34px}
  .seg{display:flex;gap:8px;align-items:stretch}
  .seg button{height:34px;padding:0 10px;display:inline-flex;align-items:center;justify-content:center}
  .field{display:block;margin-top:14px}
  .field label{display:block;min-height:18px;line-height:18px;margin-bottom:6px}
  .inline-row{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-top:14px}
  .inline-row > .field{flex:1 1 240px;margin-top:0}
  .catalog-head{align-items:center}
  .catalog-head .right{display:flex;align-items:center;gap:8px;flex:none}
  .top .in{gap:20px}
  .top nav{display:flex;align-items:center;gap:16px;height:100%;overflow-x:auto;scrollbar-width:none}
  .top nav::-webkit-scrollbar{display:none}
  .top nav button{height:100%;display:inline-flex;align-items:center;padding:0}
  .toolcat-title{margin:14px 0 6px}
  .toolrow{margin-bottom:6px}
  .filepick{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:10px}
  .filepick input[type="file"]{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
  .filepick label.btn{cursor:pointer}
  .reader .rbar button,.reader .rbar2 button{height:32px;padding:0 10px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;line-height:1}
  .reader .rbar2 button{padding:0 14px}
  @media (max-width:1180px){.top .in{gap:12px}.top nav{gap:12px}}
  @media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>
</head>
<body>
<header class="top">
  <div class="in">
    <a class="logo" href="javascript:;" id="homeLink"><b>神</b>造神 · H5</a>
    <nav>
      <button data-nav="shelf">书架</button>
      <button data-nav="home" class="on">作品详情</button>
      <button data-nav="catalog">目录</button>
      <button data-nav="characters">人物</button>
      <button data-nav="worldbook">世界书</button>
      <button data-nav="foreshadows">伏笔</button>
      <button data-nav="health">体检</button>
      <button data-nav="tools">工具</button>
      <button data-nav="settings">设置</button>
    </nav>
    <div class="right">
      <span class="chip" id="sessionChip" hidden></span>
    </div>
  </div>
</header>
<div class="crumb" id="crumb"></div>
<div id="err"></div>
<main class="wrap" id="main"><div class="loading">加载中…</div></main>

<div class="reader" id="reader" hidden>
  <div class="rprog" id="rProg"></div>
  <div class="rbar">
    <button id="rBack">← 详情</button>
    <div class="t" id="rTitle">正文</div>
    <button class="fsbtn" id="rSetup">Aa</button>
    <button class="fsbtn" id="rFsDown">A−</button>
    <button class="fsbtn" id="rFsUp">A＋</button>
    <button id="rTheme">背景</button>
  </div>
  <div class="rset" id="rSet" hidden></div>
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
    books: [], detail: null, elements: null, chapters: [], worldbook: null, health: null,
    tools: null, toolName: '', toolResult: null, toolBusy: false, roots: [], workspace: '', toolFilter: '',
    importMode: 'scan', scan: null, importPreview: null, createMsg: '',
    filter: '', expanded: false,
    openNo: null, openTitle: '', openText: '',
    fs: Number(ls('nf-h5-fs') || 20),
    lh: Number(ls('nf-h5-lh') || 2),
    font: ls('nf-h5-font') || 'serif',
    width: ls('nf-h5-width') || 'normal',
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
      if (state.detail && state.detail.title) document.title = state.detail.title + ' · 造神 H5';
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
    else if (state.page === 'characters') renderCharacters(main);
    else if (state.page === 'worldbook') renderWorldbook(main);
    else if (state.page === 'foreshadows') renderForeshadows(main);
    else if (state.page === 'health') renderHealth(main);
    else if (state.page === 'tools') renderTools(main);
    else if (state.page === 'tool') renderToolRunner(main);
    else if (state.page === 'create') renderCreate(main);
    else if (state.page === 'import') renderImport(main);
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
    // 书内功能（详情/目录/人物/世界书/伏笔/体检/设置）在没有选中书时不可用 → 直接隐藏；
    // 书架与工具台不依赖当前书，始终可见。
    var bookScoped = { home: 1, catalog: 1, characters: 1, worldbook: 1, foreshadows: 1, health: 1, settings: 1 };
    for (var i = 0; i < navs.length; i++){
      var k = navs[i].getAttribute('data-nav');
      if (!state.book && bookScoped[k]) { navs[i].style.display = 'none'; continue; }
      navs[i].style.display = '';
      navs[i].className = (k === 'home' && (state.page === 'home' || state.page === 'shelf')) || k === state.page ? 'on' : '';
    }
  }
  function setPage(p){ state.page = p; render(); window.scrollTo(0, 0); }
  function goShelf(){ state.book = ''; state.detail = null; state.chapters = []; state.elements = null; state.worldbook = null; state.health = null; setPage('shelf'); }

  function coverOf(title, genre){
    var t = String(title || '书');
    var palettes = [['#c0392b','#7b241c'], ['#2c3e50','#1a252f'], ['#8e44ad','#4a235a'], ['#16a085','#0e6655'], ['#d35400','#873600'], ['#2980b9','#1a5276']];
    var seed = 0; for (var i = 0; i < t.length; i++) seed = (seed + t.charCodeAt(i)) % palettes.length;
    var p = palettes[seed];
    return '<div class="cover" style="background:linear-gradient(150deg,' + p[0] + ',' + p[1] + ')"><div class="ct">' + esc(t.slice(0, 12)) + '</div><div class="cs">' + esc(String(genre || '造神作品').slice(0, 12)) + '</div></div>';
  }

  function renderShelf(main){
    var html = '<div style="display:flex;align-items:flex-end;gap:14px;margin:8px 0 14px;flex-wrap:wrap"><h2 style="margin:0;font-size:22px">全部作品</h2><span style="color:var(--ink3);font-size:13px">' + state.books.length + ' 本</span>' +
      '<span style="margin-left:auto;display:flex;gap:8px"><button class="btn primary" id="newBookBtn">＋ 新建书</button>' +
      '<button class="btn" id="importBtn">接入旧稿 / 导入</button></span></div>';
    if (!state.books.length) html += '<div class="card"><div class="empty">还没有书。<br>点上方「＋ 新建书」从零开书，或「接入旧稿 / 导入」把已有正文接进来。</div></div>';
    else {
      html += '<div class="shelf-grid">';
      state.books.forEach(function(b){
        html += '<div class="card shelf-item" data-book="' + esc(b.id) + '"><div class="mini-cover">' + esc(String(b.title || b.id).slice(0, 10)) + '</div><div style="min-width:0"><div class="bt">' + esc(b.title || b.id) + '</div><div class="bs">' + esc(b.genre || '未定题材') + ' · ' + esc(stageName(b.stage)) + '<br>' + (b.chapters ? (b.chapters + ' 章') : '') + '</div></div></div>';
      });
      html += '</div>';
    }
    main.innerHTML = html;
    var nb = $('newBookBtn'); if (nb) nb.onclick = function(){ state.createMsg = ''; setPage('create'); };
    var ib = $('importBtn'); if (ib) ib.onclick = function(){ state.scan = null; state.importPreview = null; setPage('import'); };
    Array.prototype.forEach.call(main.querySelectorAll('[data-book]'), function(el){
      el.onclick = function(){ openBook(el.getAttribute('data-book')); };
    });
  }

  // ── 新建书 / 接入旧稿 / 文本导入（H5 独立入口） ─────
  function rpcCall(tool, args, needWs){
    var body = { tool: tool, args: args };
    if (needWs && state.workspace) body.workspace = state.workspace;
    return api(withSession('/rpc'), { method: 'POST', body: JSON.stringify(body) });
  }
  function wsSelectHtml(id, hint){
    if (!state.roots.length) return '';
    return '<div class="field"><label>落点工作区</label><select class="input" id="' + id + '">' +
      state.roots.map(function(r){ return '<option value="' + esc(r) + '"' + (r === state.workspace ? ' selected' : '') + '>' + esc(r) + '</option>'; }).join('') +
      '</select><div class="hint">' + esc(hint || '新书目录建在这个工作区根下。') + '</div></div>';
  }
  function syncWs(id){ var el = $(id); if (el && el.value) state.workspace = el.value; }
  function fieldHtml(id, label, placeholder, value, required, textarea, rows){
    var lab = '<label>' + esc(label) + (required ? ' <b style="color:var(--err)">*</b>' : '') + '</label>';
    if (textarea) return '<div class="field">' + lab + '<textarea class="input" id="' + id + '" rows="' + (rows || 5) + '" placeholder="' + esc(placeholder || '') + '">' + esc(value || '') + '</textarea></div>';
    return '<div class="field">' + lab + '<input class="input" id="' + id + '" value="' + esc(value || '') + '" placeholder="' + esc(placeholder || '') + '"></div>';
  }
  function platformSelectHtml(id){
    var rows = [['', '未设置'], ['qidian', '起点'], ['fanqie', '番茄'], ['jjwxc', '晋江'], ['qimao', '七猫'], ['feilu', '飞卢']];
    return '<div class="field"><label>投放平台</label><select class="input" id="' + id + '">' +
      rows.map(function(r){ return '<option value="' + r[0] + '">' + esc(r[1]) + '</option>'; }).join('') + '</select></div>';
  }
  function readVal(id){ var el = $(id); return el ? String(el.value || '').trim() : ''; }

  function renderCreate(main){
    var html = '<div class="card"><div class="catalog-head"><div><h2>新建书</h2><div class="sub">创建 novel.json 工程；设定/人物/大纲等随后写。</div></div>' +
      '<div class="right"><button class="btn" data-goto="home">← 返回书架</button></div></div><div class="bd">' +
      fieldHtml('cBook', '书目名（目录名）', '如 长夜余火', '', true) +
      fieldHtml('cTitle', '书名（默认同书目名）', '读者看到的书名', '') +
      fieldHtml('cGenre', '题材', '玄幻 / 悬疑 / 都市…', '') +
      fieldHtml('cLogline', '一句话立意', '主角、欲望、阻力、代价…', '', false, true, 2) +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' + fieldHtml('cChars', '每章字数区间', '如 2500-3500（可留空）', '') + platformSelectHtml('cPlatform') + '</div>' +
      wsSelectHtml('cWorkspace') +
      '<div class="field" style="display:flex;gap:10px;align-items:center;margin-top:18px"><button class="btn primary" id="doCreate">创建新书</button><span class="hint" id="createState"></span></div>' +
      '</div></div>';
    main.innerHTML = html;
    bindGoto(main);
    var btn = $('doCreate');
    btn.onclick = function(){
      var book = readVal('cBook');
      if (!book) { err('书目名必填'); return; }
      syncWs('cWorkspace');
      var args = { action: 'init', book: book };
      var title = readVal('cTitle'), genre = readVal('cGenre'), logline = readVal('cLogline'), chars = readVal('cChars'), platform = readVal('cPlatform');
      if (title) args.title = title;
      if (genre) args.genre = genre;
      if (logline) args.logline = logline;
      if (chars) args.chars = chars;
      if (platform) args.platform = platform;
      btn.disabled = true; btn.textContent = '创建中…';
      rpcCall('novel_project', args, true).then(function(v){
        toast('新书已创建');
        state.page = 'shelf';
        return loadBooks().then(function(){ openBook(v.book || v.title || book); });
      }).catch(function(e){
        btn.disabled = false; btn.textContent = '创建新书';
        err('创建失败：' + e.message);
        if ($('createState')) $('createState').textContent = e.message;
      });
    };
  }

  function renderImport(main){
    var mode = state.importMode;
    var tabs = '<div class="seg" style="max-width:420px;margin-bottom:6px">' +
      [['scan', '扫描旧稿接入'], ['dir', '导入文件夹'], ['text', '粘贴正文导入'], ['file', '文件导入']].map(function(t){
        return '<button data-im="' + t[0] + '" class="' + (mode === t[0] ? 'on' : '') + '">' + t[1] + '</button>';
      }).join('') + '</div>';
    var body = '';
    if (mode === 'scan') body = importScanHtml();
    else if (mode === 'dir') body = importDirHtml();
    else if (mode === 'text') body = importTextHtml();
    else body = importFileHtml();
    main.innerHTML = '<div class="card"><div class="catalog-head"><div><h2>接入旧稿 / 导入</h2><div class="sub">旧稿工作区只读接入（按原章号），或把纯文本切分成新书。</div></div>' +
      '<div class="right"><button class="btn" data-goto="home">← 返回书架</button></div></div><div class="bd">' + tabs + body + '</div></div>';
    bindGoto(main);
    Array.prototype.forEach.call(main.querySelectorAll('[data-im]'), function(b){
      b.onclick = function(){ state.importMode = b.getAttribute('data-im'); renderImport(main); };
    });
    bindImport(mode, main);
  }
  function importScanHtml(){
    var html = '<div class="hint" style="margin:10px 0">扫描工作区里「第N章」命名的旧稿目录（只读，不改原目录）。可填一个上层目录范围。</div>' +
      '<div class="inline-row"><div class="field" style="flex:1 1 260px">' + fieldHtml('scanSource', '扫描起点（工作区相对，可留空）', '如 《书名》 或 _DeepSeek_workspace', '') + '</div>' +
      '<button class="btn primary" id="doScan">扫描</button></div>' +
      wsSelectHtml('scanWs', '扫描根 = 这个工作区根。') + '<div id="scanResult" style="margin-top:12px">';
    if (state.scan && Array.isArray(state.scan.candidates)) {
      if (!state.scan.candidates.length) html += '<div class="empty" style="padding:20px 0">' + esc(state.scan.next || '没发现旧稿目录') + '</div>';
      else {
        html += '<div class="hint" style="margin-bottom:8px">发现 ' + state.scan.candidates.length + ' 个旧稿工作区（共 ' + (state.scan.chapters || 0) + ' 章）：</div><div class="entry-list">';
        state.scan.candidates.forEach(function(c, i){
          html += '<div class="entry"><div class="et">' + esc(c.source) + '<span class="tag2">' + c.chapters + ' 章</span><span class="tag2">第' + c.firstChapter + '–' + c.latestChapter + '章</span>' + (c.hasOutlines ? '<span class="tag2">含细纲</span>' : '') + '</div>' +
            '<div class="eb" style="max-height:80px">' + esc((c.samples || []).join(' / ')) + '</div>' +
            '<div style="margin-top:8px"><button class="btn primary" data-adopt="' + i + '">接入这本</button></div></div>';
        });
        html += '</div>';
      }
    }
    html += '</div>';
    return html;
  }
  function importDirHtml(){
    var d = state.dirImport;
    var html = '<div class="hint" style="margin:10px 0">选择本地文件夹（可含子目录；只读 .md / .txt，按文件名自然排序自动生成「第N章 标题」）。选完直接预览、确认书目名后导入。</div>' +
      '<div class="filepick"><input type="file" id="dirInput" webkitdirectory multiple accept=".md,.txt,.markdown"><label class="btn primary" for="dirInput">📁 选择文件夹…</label><span class="hint" id="dirPickInfo">' +
      (d ? ('已读取 ' + d.count + ' 个文件（跳过 ' + d.skipped + ' 个非文本文件）') : '未选择') + '</span></div>' +
      '<div id="dirPreview">' + (d ? dirPreviewHtml(d) : '') + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:6px">' + fieldHtml('dBook', '书目名', '新目录名', '', true) + fieldHtml('dTitle', '书名', '默认同书目名', '') + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' + fieldHtml('dGenre', '题材', '玄幻/悬疑…', '') + platformSelectHtml('dPlatform') + '</div>' +
      fieldHtml('dChars', '每章字数区间', '如 2500-3500（可留空）', '') +
      wsSelectHtml('dWs') +
      '<div class="inline-row"><button class="btn primary" id="doImportDir" disabled>导入并建书</button><span class="hint" id="dirState">先选择文件夹</span></div>';
    return html;
  }
  function dirPreviewHtml(d){
    return '<div class="card" style="margin-top:12px"><div class="bd">' +
      '<div class="kv"><span class="k">文件</span><span class="v">' + d.count + ' 个（跳过 ' + d.skipped + ' 个非 .md/.txt）</span></div>' +
      '<div class="kv"><span class="k">章节</span><span class="v">' + d.chapters + ' 章</span></div>' +
      '<div class="kv"><span class="k">总字数</span><span class="v">' + d.chars + ' 字</span></div>' +
      '<div class="kv"><span class="k">首章</span><span class="v">' + esc(d.first) + '</span></div>' +
      '<div class="kv"><span class="k">末章</span><span class="v">' + esc(d.last) + '</span></div>' +
      (d.names.length ? '<div class="hint" style="margin-top:8px">文件示例：' + esc(d.names.slice(0, 6).join('、')) + (d.names.length > 6 ? ' …' : '') + '</div>' : '') +
      '</div></div>';
  }
  // 从文件名提取章节号 / 标题（兼容 第12章 xxx.md、012-xxx.md、12.x.md、第一章 xxx、纯文件名）
  function cnNumber(text){
    var map = { '零': 0, '〇': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '百': 100 };
    if (/^\\d+$/.test(text)) return Number(text);
    var total = 0, section = 0;
    for (var i = 0; i < text.length; i++){
      var ch = text.charAt(i), v = map[ch];
      if (v === undefined) return 0;
      if (v === 100) { section = (section || 1) * 100; total += section; section = 0; }
      else if (v === 10) { section = (section || 1) * 10; total += section; section = 0; }
      else section = section * 10 + v;
    }
    return total + section;
  }
  function chapterMetaFromName(name){
    var base = String(name).split(String.fromCharCode(92)).join('/').split('/').pop();
    var dot = base.lastIndexOf('.');
    if (dot > 0) base = base.slice(0, dot);
    var m = base.match(/第\\s*(\\d{1,4})\\s*[章回节]/);
    if (!m) m = base.match(/^(\\d{1,4})(?:[\\s._\\-、]+|$)/);
    var no = m ? Number(m[1]) : 0;
    if (!no) {
      var cn = base.match(/^第([一二三四五六七八九十百零〇两]{1,6})[章回节]/);
      if (cn) no = cnNumber(cn[1]);
    }
    var title = base.replace(/^第\\s*\\d{1,4}\\s*[章回节][:：\\s._\\-]*/, '')
      .replace(/^第[一二三四五六七八九十百零〇两]{1,6}[章回节][:：\\s._\\-]*/, '')
      .replace(/^\\d{1,4}[\\s._\\-、:：]*/, '').trim();
    return { no: no, title: title || base };
  }
  function readFolderFiles(files){
    var picked = [], skipped = 0;
    var skippedDir = ['node_modules', '_archive', 'backups', '.git'];
    Array.prototype.forEach.call(files, function(f){
      var name = f.name || '';
      var rel = f.webkitRelativePath || name;
      var parts = rel.split('/');
      var hidden = parts.some(function(p){ return p.charAt(0) === '.' || skippedDir.indexOf(p) >= 0; });
      if (hidden || !/^(?:.*)\\.(md|txt|markdown)$/i.test(name)) { skipped++; return; }
      picked.push(f);
    });
    return Promise.all(picked.map(function(f){
      return f.text().then(function(text){ return { path: f.webkitRelativePath || f.name, name: f.name, text: String(text || '') }; });
    })).then(function(rows){
      rows = rows.filter(function(r){ return r.text.trim() !== ''; });
      if (!rows.length) throw new Error('文件夹里没有可导入的 .md/.txt 正文');
      // 先按文件名里的章节号排序（无号的排最后、按路径自然序），再按顺序补号，
      // 这样 013-夜行 / 第12章 / 14.md 混排也能按 12,13,14 落章。
      var entries = rows.map(function(r){
        var meta = chapterMetaFromName(r.name);
        var pre = /^(序章|楔子|引子|前言)/.test(meta.title);
        return { r: r, meta: meta, rank: pre ? -1 : (meta.no > 0 ? meta.no : 1e9) };
      });
      entries.sort(function(a, b){
        if (a.rank !== b.rank) return a.rank - b.rank;
        return a.r.path.localeCompare(b.r.path, 'zh-CN', { numeric: true, sensitivity: 'base' });
      });
      var no = 0, parts = [], total = 0, names = [], assigned = [];
      entries.forEach(function(e){
        var meta = e.meta, r = e.r;
        // 有章节号就沿用（12,13,14）；无号/序章取上一章 +1；号重复或回退则顺延。
        var chNo = e.rank < 0 || meta.no <= 0 ? no + 1 : (meta.no > no ? meta.no : no + 1);
        no = chNo;
        assigned.push({ no: chNo, title: meta.title });
        parts.push('第' + no + '章 ' + meta.title + '\\n\\n' + r.text.trim());
        total += r.text.replace(/\\s/g, '').length;
        names.push(r.path);
      });
      return {
        count: rows.length, skipped: skipped, chapters: assigned.length, chars: total, names: names,
        first: '第' + assigned[0].no + '章 ' + assigned[0].title,
        last: '第' + assigned[assigned.length - 1].no + '章 ' + assigned[assigned.length - 1].title,
        content: parts.join('\\n\\n'),
      };
    });
  }
  function bindDirImport(main){
    var input = $('dirInput');
    var btn = $('doImportDir');
    if (!input || !btn) return;
    input.onchange = function(e){
      var files = e.target.files;
      if (!files || !files.length) return;
      var info = $('dirPickInfo'); if (info) info.textContent = '读取中…';
      readFolderFiles(files).then(function(result){
        state.dirImport = result;
        renderImport(main);
        if ($('dirState')) $('dirState').textContent = '已就绪：' + result.chapters + ' 章 / ' + result.chars + ' 字';
      }).catch(function(err2){ err(err2.message); if (info) info.textContent = '读取失败：' + err2.message; });
    };
    if (state.dirImport) btn.disabled = false;
    btn.onclick = function(){
      var d = state.dirImport; if (!d) { err('先选择文件夹'); return; }
      var book = readVal('dBook'); if (!book) { err('书目名必填'); return; }
      var args = { action: 'import', book: book, content: d.content };
      var title = readVal('dTitle'), genre = readVal('dGenre'), platform = readVal('dPlatform'), chars = readVal('dChars');
      if (title) args.title = title; if (genre) args.genre = genre; if (platform) args.platform = platform; if (chars) args.chars = chars;
      syncWs('dWs');
      btn.disabled = true; btn.textContent = '导入中…';
      rpcCall('novel_import', args, true).then(function(v){
        toast('已导入：' + (v.book || book));
        state.page = 'shelf';
        return loadBooks().then(function(){ openBook(v.book || book); });
      }).catch(function(e){ btn.disabled = false; btn.textContent = '导入并建书'; err('导入失败：' + e.message); });
    };
  }
  function importTextHtml(){
    return '<div class="hint" style="margin:10px 0">粘贴全文（按「第N章」规则切分），先预览再导入。</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' + fieldHtml('iBook', '书目名', '新目录名', '', true) + fieldHtml('iTitle', '书名', '默认同书目名', '') + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' + fieldHtml('iGenre', '题材', '玄幻/悬疑…', '') + platformSelectHtml('iPlatform') + '</div>' +
      fieldHtml('iContent', '正文全文', '粘贴全文…', '', false, true, 10) + wsSelectHtml('iWs') +
      '<div class="field" style="display:flex;gap:10px;align-items:center;margin-top:14px"><button class="btn" id="doPreviewText">预览切分</button><button class="btn primary" id="doImportText">导入并建书</button><span class="hint" id="importState"></span></div><div id="importPreviewOut" style="margin-top:12px"></div>';
  }
  function importFileHtml(){
    return '<div class="hint" style="margin:10px 0">工作区内文件路径（.md/.txt/.docx），按「第N章」规则切分导入。</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' + fieldHtml('iFile', '文件路径（工作区相对）', '如 旧稿.md', '', true) + fieldHtml('iBook2', '书目名', '新目录名', '', true) + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' + fieldHtml('iTitle2', '书名', '默认同书目名', '') + platformSelectHtml('iPlatform2') + '</div>' +
      wsSelectHtml('iWs2') +
      '<div class="field" style="display:flex;gap:10px;align-items:center;margin-top:14px"><button class="btn primary" id="doImportFile">导入并建书</button><span class="hint" id="importState2"></span></div><div id="importPreviewOut2" style="margin-top:12px"></div>';
  }
  function bindImport(mode, main){
    if (mode === 'scan') {
      var scan = $('doScan'); if (!scan) return;
      scan.onclick = function(){
        syncWs('scanWs');
        scan.disabled = true; scan.textContent = '扫描中…';
        rpcCall('novel_import', { action: 'scan', source: readVal('scanSource') || undefined }, true).then(function(v){
          state.scan = v; renderImport(main);
        }).catch(function(e){ scan.disabled = false; scan.textContent = '扫描'; err('扫描失败：' + e.message); });
      };
      Array.prototype.forEach.call(main.querySelectorAll('[data-adopt]'), function(b){
        b.onclick = function(){
          var c = (state.scan.candidates || [])[Number(b.getAttribute('data-adopt'))]; if (!c) return;
          var book = c.path || c.source;
          var defaultName = book.split(String.fromCharCode(92)).join('-').split('/').join('-');
          var input = window.prompt('新书目名（目录名）', defaultName);
          if (!input) return;
          var title = window.prompt('书名', input) || input;
          syncWs('scanWs');
          b.disabled = true; b.textContent = '接入中…';
          rpcCall('novel_import', { action: 'adopt', source: c.source, book: input, title: title }, true).then(function(v){
            toast('已接入：' + (v.book || input));
            state.page = 'shelf';
            return loadBooks().then(function(){ openBook(v.book || input); });
          }).catch(function(e){ b.disabled = false; b.textContent = '接入这本'; err('接入失败：' + e.message); });
        };
      });
    } else if (mode === 'dir') {
      bindDirImport(main);
    } else if (mode === 'text') {
      var pv = $('doPreviewText'), im = $('doImportText');
      var collect = function(){
        var args = { book: readVal('iBook'), content: readVal('iContent') };
        if (!args.book) throw new Error('书目名必填');
        if (!args.content) throw new Error('正文不能为空');
        var title = readVal('iTitle'), genre = readVal('iGenre'), platform = readVal('iPlatform');
        if (title) args.title = title; if (genre) args.genre = genre; if (platform) args.platform = platform;
        syncWs('iWs');
        return args;
      };
      var run = function(action, btn, outEl, okText){
        try { var args = collect(); } catch (e) { err(e.message); return; }
        args.action = action;
        btn.disabled = true; btn.textContent = '处理中…';
        rpcCall('novel_import', args, true).then(function(v){
          if (action === 'preview') {
            $(outEl).innerHTML = '<div class="card"><div class="bd"><pre class="result">' + esc(JSON.stringify(v, null, 2)) + '</pre></div></div>';
            btn.disabled = false; btn.textContent = '预览切分';
          } else {
            toast(okText + '：' + (v.book || args.book));
            state.page = 'shelf';
            return loadBooks().then(function(){ openBook(v.book || args.book); });
          }
        }).catch(function(e){ btn.disabled = false; btn.textContent = action === 'preview' ? '预览切分' : '导入并建书'; err('导入失败：' + e.message); });
      };
      if (pv) pv.onclick = function(){ run('preview', pv, 'importPreviewOut'); };
      if (im) im.onclick = function(){ run('import', im, 'importPreviewOut', '已导入'); };
    } else {
      var imf = $('doImportFile');
      if (!imf) return;
      imf.onclick = function(){
        var args = { action: 'import', book: readVal('iBook2'), file: readVal('iFile') };
        if (!args.book) { err('书目名必填'); return; }
        if (!args.file) { err('文件路径必填'); return; }
        var title = readVal('iTitle2'), platform = readVal('iPlatform2');
        if (title) args.title = title; if (platform) args.platform = platform;
        syncWs('iWs2');
        imf.disabled = true; imf.textContent = '导入中…';
        rpcCall('novel_import', args, true).then(function(v){
          toast('已导入：' + (v.book || args.book));
          state.page = 'shelf';
          return loadBooks().then(function(){ openBook(v.book || args.book); });
        }).catch(function(e){ imf.disabled = false; imf.textContent = '导入并建书'; err('导入失败：' + e.message); });
      };
    }
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
      '<button class="btn" id="settingsBtn">作品设置</button></div>' +
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
      '<button class="btn" data-goto="characters">人物卡</button>' +
      '<button class="btn" data-goto="worldbook">世界书</button>' +
      '<button class="btn" data-goto="foreshadows">伏笔台账</button>' +
      '<button class="btn" data-goto="health">全书体检</button>' +
      '<button class="btn" data-goto="tools">工具台（全部功能）</button>' +
      '<button class="btn" id="sideSettings">作品设置</button>' +
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
    on('sideRead', function(){ if (latestNo()) openReader(latestNo()); });
    on('sideSettings', function(){ setPage('settings'); });
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
    bindGoto(main);
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

  // ── 人物 / 世界书 / 伏笔 / 体检（功能入口落地） ─────────────────────
  function subHead(title, sub, extra){
    return '<div class="card"><div class="catalog-head"><div><h2>' + esc(title) + '</h2><div class="sub">' + esc(sub) + '</div></div>' +
      '<div class="right">' + (extra || '') + '<button class="btn" data-goto="home">返回详情</button></div></div><div class="bd">';
  }
  function bindGoto(main){
    Array.prototype.forEach.call(main.querySelectorAll('[data-goto]'), function(el){
      el.onclick = function(){ setPage(el.getAttribute('data-goto')); };
    });
  }
  function renderCharacters(main){
    if (!state.book){ renderShelf(main); return; }
    var list = (elems().characters || []);
    var html = subHead('人物卡', (list.length ? list.length + ' 张' : '暂无') + ' · 写章时按出场人物注入上下文') + '<div class="entry-list">';
    if (!list.length) html += '<div class="empty">还没有人物卡——到「工具台」用 novel_character save 建档。</div>';
    list.forEach(function(c){
      html += '<div class="entry"><div class="et">' + esc(c.name || '未命名') + '</div><div class="eb">' + esc(c.text || '（空卡）') + '</div></div>';
    });
    html += '</div></div></div>';
    main.innerHTML = html; bindGoto(main);
  }
  function renderWorldbook(main){
    if (!state.book){ renderShelf(main); return; }
    if (state.worldbook === null){
      main.innerHTML = '<div class="card"><div class="loading">世界书加载中…</div></div>';
      api(withSession('/worldbook/' + encodeURIComponent(state.book))).then(function(list){
        state.worldbook = Array.isArray(list) ? list : (list && typeof list === 'object' ? (list.entries || []) : []);
        renderWorldbook(main);
      }).catch(function(e){ state.worldbook = []; err('世界书加载失败：' + e.message); renderWorldbook(main); });
      return;
    }
    var list = state.worldbook;
    var html = subHead('世界书', (list.length ? list.length + ' 条' : '暂无') + ' · 关键词触发的设定注入') + '<div class="entry-list">';
    if (!list.length) html += '<div class="empty">还没有世界书条目——到「工具台」用 novel_worldbook 添加。</div>';
    list.forEach(function(w){
      var kw = Array.isArray(w.keywords) ? w.keywords : (typeof w.keywords === 'string' ? w.keywords.split(/[,，、\\s]+/).filter(Boolean) : []);
      html += '<div class="entry"><div class="et">' + esc(w.name || w.id || '条目') +
        (w.always_active || w.always ? '<span class="tag2">常驻</span>' : '') +
        (w.priority !== undefined ? '<span class="tag2">优先级 ' + esc(w.priority) + '</span>' : '') +
        (w.enabled === false ? '<span class="tag2" style="color:var(--err)">已停用</span>' : '') + '</div>' +
        (kw.length ? '<div style="margin-top:4px">' + kw.slice(0, 12).map(function(k){ return '<span class="tag2" style="margin-right:4px">' + esc(k) + '</span>'; }).join('') + '</div>' : '') +
        '<div class="eb">' + esc(w.content || '') + '</div></div>';
    });
    html += '</div></div></div>';
    main.innerHTML = html; bindGoto(main);
  }
  function renderForeshadows(main){
    if (!state.book){ renderShelf(main); return; }
    var list = (elems().foreshadows || []);
    var open = list.filter(function(f){ return f && f.status !== 'paid' && f.status !== 'resolved' && f.status !== '已回收'; }).length;
    var html = subHead('伏笔台账', (open ? open + ' 条在册' : '暂无') + ' · 简报会提醒超期未回收') + '<div class="entry-list">';
    if (!list.length) html += '<div class="empty">还没有伏笔。</div>';
    list.forEach(function(f){
      var title = f.setup || f.text || f.content || f.title || f.desc || '（未命名伏笔）';
      var status = f.status || (f.paid ? '已回收' : '在册');
      var plan = f.plan || f.payoffChapter || f.planChapter;
      var chapter = f.chapter || f.setupChapter;
      html += '<div class="entry"><div class="et"><span class="tag2">' + esc(f.id || '伏笔') + '</span>' +
        '<span class="tag2">' + esc(status) + '</span>' +
        (chapter !== undefined ? '<span class="tag2">埋设 第' + esc(chapter) + '章</span>' : '') +
        (plan !== undefined ? '<span class="tag2">预计 第' + esc(plan) + '章</span>' : '<span class="tag2">无回收计划</span>') + '</div>' +
        '<div class="eb">' + esc(title) + '</div></div>';
    });
    html += '</div></div></div>';
    main.innerHTML = html; bindGoto(main);
  }
  function renderHealth(main){
    if (!state.book){ renderShelf(main); return; }
    if (state.health === null){
      main.innerHTML = '<div class="card"><div class="loading">体检中…</div></div>';
      api(withSession('/projects/' + encodeURIComponent(state.book) + '/continuity')).then(function(v){
        state.health = v || {}; renderHealth(main);
      }).catch(function(e){ state.health = { error: e.message }; renderHealth(main); });
      return;
    }
    var h = state.health || {};
    var st = h.stats || {};
    var issues = Array.isArray(h.issues) ? h.issues : [];
    var errs = issues.filter(function(i){ return i.severity === 'error'; }).length;
    var warns = issues.length - errs;
    var html = subHead('全书体检', '一致性 / 账本 / 伏笔 / 章号（零 token）',
      '<button class="btn" id="runHealth">↻ 重跑</button>') +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">' +
      '<div class="kv" style="display:block;border:1px solid var(--line);border-radius:8px;padding:10px"><div style="font-size:20px;font-weight:700">' + (h.ok === false ? '✗' : '✓') + '</div><div style="font-size:12px;color:var(--ink3)">总体</div></div>' +
      '<div class="kv" style="display:block;border:1px solid var(--line);border-radius:8px;padding:10px"><div style="font-size:20px;font-weight:700;color:var(--err)">' + errs + '</div><div style="font-size:12px;color:var(--ink3)">硬伤</div></div>' +
      '<div class="kv" style="display:block;border:1px solid var(--line);border-radius:8px;padding:10px"><div style="font-size:20px;font-weight:700;color:#b8860b">' + warns + '</div><div style="font-size:12px;color:var(--ink3)">警告</div></div>' +
      '<div class="kv" style="display:block;border:1px solid var(--line);border-radius:8px;padding:10px"><div style="font-size:20px;font-weight:700">' + (st.chapters ?? '—') + '</div><div style="font-size:12px;color:var(--ink3)">章数</div></div>' +
      '</div>';
    if (h.error) html += '<div class="notice">' + esc(h.error) + '</div>';
    if (!issues.length) html += '<div class="empty">没有发现问题 ✓</div>';
    else html += '<div>' + issues.map(function(i){
      var sev = i.severity === 'error' ? 'err' : 'warn';
      return '<div class="issue ' + sev + '"><span class="sev">' + (sev === 'err' ? '✗' : '⚠') + '</span><span class="where">' + esc(i.where || '') + '</span><span class="msg">' + esc(i.message || '') + '</span></div>';
    }).join('') + '</div>';
    html += '</div></div>';
    main.innerHTML = html;
    bindGoto(main);
    var run = $('runHealth'); if (run) run.onclick = function(){ state.health = null; renderHealth(main); };
  }

  // ── 工具台：23 个 novel_* 工具的全部能力（写章/细纲/账本/导入/提案…） ──
  var TOOL_GROUPS = [
    ['项目', ['novel_project', 'novel_import', 'novel_clone_project', 'novel_export', 'novel_glossary']],
    ['大纲与场景', ['novel_outline', 'novel_scene']],
    ['角色与设定', ['novel_character', 'novel_worldbook']],
    ['写作与修订', ['novel_briefing', 'novel_write_chapter', 'novel_propose', 'novel_polish', 'novel_audit', 'novel_noai_scan', 'novel_style']],
    ['账本与追踪', ['novel_ledger', 'novel_relation', 'novel_arc', 'novel_quality']],
    ['资料与诊断', ['novel_search', 'novel_library', 'novel_diagnose']],
  ];
  var LONG_FIELDS = ['content', 'outline', 'text', 'markdown', 'command', 'review_quotes', 'facts_updates',
    'cognition_updates', 'updates', 'scene', 'card', 'voice', 'promise', 'payload', 'definition', 'description', 'args'];
  function toolCategory(name) {
    for (var i = 0; i < TOOL_GROUPS.length; i++) if (TOOL_GROUPS[i][1].indexOf(name) >= 0) return TOOL_GROUPS[i][0];
    return '其他';
  }
  function loadTools(main){
    if (state.tools !== null && state.page === 'tools') { renderTools(main); return; }
    main.innerHTML = '<div class="card"><div class="loading">武器库加载中…</div></div>';
    api(withSession('/tools')).then(function(v){
      state.tools = Array.isArray(v.tools) ? v.tools : [];
      state.workspace = v.root || state.workspace;
      renderTools(main);
    }).catch(function(e){ err('工具清单加载失败：' + e.message); main.innerHTML = '<div class="card"><div class="empty">工具清单加载失败：' + esc(e.message) + '</div></div>'; });
  }
  function renderTools(main){
    if (state.tools === null) { loadTools(main); return; }
    var q = state.toolFilter.trim().toLowerCase();
    var list = state.tools.filter(function(t){
      if (!q) return true;
      return (t.name + ' ' + (t.description || '')).toLowerCase().indexOf(q) >= 0;
    });
    var byCat = {};
    list.forEach(function(t){ var c = toolCategory(t.name); (byCat[c] = byCat[c] || []).push(t); });
    var html = '<div class="card"><div class="catalog-head"><div><h2>工具台</h2><div class="sub">共 ' + state.tools.length + ' 个 novel_* 工具 · 与对话/MCP 通道同一套门禁与账本</div></div>' +
      '<div class="right"><input class="searchbox" id="toolQ" placeholder="搜工具名/说明" value="' + esc(state.toolFilter) + '"></div></div><div class="bd"><div class="tools-grid"><div class="toolcol" id="toolcol">';
    var order = TOOL_GROUPS.map(function(g){ return g[0]; }).concat(['其他']);
    order.forEach(function(cat){
      var arr = byCat[cat]; if (!arr || !arr.length) return;
      html += '<div class="toolcat-title">' + esc(cat) + '</div>';
      arr.forEach(function(t){
        html += '<button class="toolrow" data-tool="' + esc(t.name) + '"><b>' + esc(t.name.replace(/^novel_/, '')) + '</b><span>' + esc((t.description || '').slice(0, 42)) + '</span></button>';
      });
    });
    html += '</div><div id="toolResult">' + (state.toolResult ? renderResultHtml(state.toolResult) : '<div class="card"><div class="empty" style="padding:30px 0">左侧选一个工具 → 右侧填参数运行。<br>常用：写作 / 项目 / 大纲 / 账本 / 设定。</div></div>') + '</div></div></div></div>';
    main.innerHTML = html;
    var qel = $('toolQ');
    if (qel) qel.oninput = function(e){ state.toolFilter = e.target.value; renderTools(main); var el = $('toolQ'); if (el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); } };
    Array.prototype.forEach.call(main.querySelectorAll('[data-tool]'), function(b){
      b.onclick = function(){ state.toolName = b.getAttribute('data-tool'); state.toolResult = null; setPage('tool'); };
    });
  }
  function renderResultHtml(v){
    var text = JSON.stringify(v, null, 2);
    return '<div class="card"><div class="hd"><h3>运行结果</h3><span style="margin-left:auto;font-size:12px;color:var(--ink3)">JSON</span></div><div class="bd"><pre class="result">' + esc(text) + '</pre></div></div>';
  }
  function renderToolRunner(main){
    if (state.tools === null) { loadTools(main); return; }
    var tool = null;
    for (var i = 0; i < state.tools.length; i++) if (state.tools[i].name === state.toolName) tool = state.tools[i];
    if (!tool) { setPage('tools'); return; }
    var schema = tool.inputSchema || { properties: {}, required: [] };
    var props = schema.properties || {};
    var required = Array.isArray(schema.required) ? schema.required : [];
    var html = '<div class="card"><div class="catalog-head"><div><h2>' + esc(tool.name) + '</h2><div class="sub">' + esc(tool.description || '') + '</div></div>' +
      '<div class="right"><button class="btn" data-goto="tools">← 工具列表</button></div></div><div class="bd">';
    if (state.roots.length) {
      html += '<div class="field"><label>落点工作区（创建/导入/克隆类工具用）</label><select class="input" id="wsSelect">' +
        state.roots.map(function(r){ return '<option value="' + esc(r) + '"' + (r === state.workspace ? ' selected' : '') + '>' + esc(r) + '</option>'; }).join('') +
        '</select><div class="hint">只对 novel_project init / novel_import / novel_clone_project 生效；其他工具按参数里的书自动定位工作区。</div></div>';
    }
    Object.keys(props).forEach(function(key){
      var p = props[key] || {};
      var long = LONG_FIELDS.indexOf(key) >= 0 || p.type === 'object' || p.type === 'array';
      var id = 'ta_' + key;
      var val = '';
      if (key === 'book' && state.book) val = state.book;
      else if (p.default !== undefined) val = String(p.default);
      var label = '<label>' + esc(key) + (required.indexOf(key) >= 0 ? ' <b style="color:var(--err)">*</b>' : '') + '</label>';
      var hint = p.description ? '<div class="hint">' + esc(String(p.description).slice(0, 200)) + '</div>' : '';
      if (p.enum && Array.isArray(p.enum)) {
        html += '<div class="field">' + label + '<select class="input" id="' + id + '"><option value="">（不填）</option>' +
          p.enum.map(function(e){ return '<option value="' + esc(e) + '"' + (String(e) === val ? ' selected' : '') + '>' + esc(e) + '</option>'; }).join('') + '</select>' + hint + '</div>';
      } else if (p.type === 'boolean') {
        html += '<div class="field"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="' + id + '"> ' + esc(key) + (required.indexOf(key) >= 0 ? ' <b style="color:var(--err)">*</b>' : '') + '</label>' + hint + '</div>';
      } else if (p.type === 'number' || p.type === 'integer') {
        html += '<div class="field">' + label + '<input class="input" type="number" id="' + id + '" value="' + esc(val) + '">' + hint + '</div>';
      } else if (long) {
        html += '<div class="field">' + label + '<textarea class="input" id="' + id + '" rows="' + (key === 'content' ? 14 : 6) + '" placeholder="' + esc(p.type === 'object' || p.type === 'array' ? 'JSON 文本（如 {"a":1} / [1,2]）' : '多行文本') + '">' + esc(val) + '</textarea>' + hint + '</div>';
      } else {
        html += '<div class="field">' + label + '<input class="input" id="' + id + '" value="' + esc(val) + '">' + hint + '</div>';
      }
    });
    html += '<div class="field" style="display:flex;gap:10px;align-items:center;margin-top:18px"><button class="btn primary" id="runTool">▶ 运行 ' + esc(tool.name) + '</button>' +
      '<button class="btn" id="resetTool">清空</button><span class="hint" id="toolState"></span></div>' +
      '<div class="hint" style="margin-top:10px">落点工作区：' + esc(state.workspace || '（自动）') + '；写操作与写章工具同样过机审/账本/版本门禁。</div></div></div>';
    html += '<div id="toolOut">' + (state.toolResult ? renderResultHtml(state.toolResult) : '') + '</div>';
    main.innerHTML = html;
    bindGoto(main);
    $('runTool').onclick = function(){ runTool(tool); };
    $('resetTool').onclick = function(){ state.toolResult = null; renderToolRunner(main); };
  }
  function runTool(tool){
    var schema = tool.inputSchema || { properties: {} };
    var props = schema.properties || {};
    var args = {};
    Object.keys(props).forEach(function(key){
      var el = $('ta_' + key); if (!el) return;
      var p = props[key] || {};
      if (p.type === 'boolean') { if (el.checked) args[key] = true; return; }
      var raw = String(el.value ?? '').trim();
      if (raw === '') return;
      if (p.type === 'number' || p.type === 'integer') {
        var num = Number(raw);
        if (isNaN(num)) throw new Error('参数 ' + key + ' 不是合法数字');
        args[key] = num;
      } else if (p.type === 'object' || p.type === 'array') {
        try { args[key] = JSON.parse(raw); } catch (e) { throw new Error('参数 ' + key + ' 不是合法 JSON：' + e.message); }
      } else args[key] = raw;
    });
    var btn = $('runTool'); btn.disabled = true; btn.textContent = '运行中…';
    if ($('toolState')) $('toolState').textContent = '执行中，写章可能要几十秒…';
    var wsEl = $('wsSelect');
    var needsWs = tool.name === 'novel_import' || tool.name === 'novel_clone_project'
      || (tool.name === 'novel_project' && (args.action === 'init' || args.action === 'import'));
    if (wsEl && needsWs) state.workspace = wsEl.value;
    var body = { tool: tool.name, args: args };
    if (needsWs && state.workspace) body.workspace = state.workspace;
    api(withSession('/rpc'), { method: 'POST', body: JSON.stringify(body) }).then(function(value){
      state.toolResult = value;
      toast(tool.name + ' 执行完成');
      // 写类工具跑完后刷新当前书的详情/章节（工具与 H5 共用同一份数据）
      if (state.book && /^novel_(write_chapter|outline|ledger|character|worldbook|scene|project|import|clone|propose)/.test(tool.name)) {
        if (/^novel_(character|worldbook)/.test(tool.name)) { state.worldbook = null; }
        if (/^novel_project/.test(tool.name)) { state.health = null; }
        loadBook().catch(function(){ /* loadBook 已自处理错误 */ });
      }
      renderToolRunner($('main'));
    }).catch(function(e){
      btn.disabled = false; btn.textContent = '▶ 运行 ' + tool.name;
      if ($('toolState')) $('toolState').textContent = '';
      err('执行失败：' + e.message);
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
      '<div class="field"><label>字体</label><div class="seg" id="fontSeg"><button data-f="serif">宋体</button><button data-f="sans">黑体</button></div></div>' +
      '<div class="field"><label>页宽</label><div class="seg" id="widthSeg"><button data-w="narrow">窄</button><button data-w="normal">适中</button><button data-w="wide">宽</button></div></div>' +
      '<div class="field"><label>阅读背景</label><div class="seg" id="themeSeg"><button data-t="paper">纸白</button><button data-t="green">护眼</button><button data-t="night">夜间</button></div></div>' +
      '<div class="hint" style="margin-top:10px">设置本机保存（localStorage），跨会话保留；阅读页内 Aa 也能调。</div>' +
      '</div></div>' +
      '<div class="card"><div class="hd"><h3>功能入口</h3></div><div class="bd"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
      '<button class="btn" data-goto="characters">人物卡</button><button class="btn" data-goto="worldbook">世界书</button>' +
      '<button class="btn" data-goto="foreshadows">伏笔台账</button><button class="btn" data-goto="health">全书体检</button>' +
      '<button class="btn" data-goto="catalog">目录</button><button class="btn" data-goto="home">作品详情</button>' +
      '<button class="btn" data-goto="tools">工具台（全部功能）</button>' +
      '<button class="btn" id="openStandalone">独立窗口 ↗</button>' +
      '</div><div class="hint" style="margin-top:10px">H5 与工具台共用同一套 REST 门禁；写章走工具台的 novel_write_chapter。</div></div></div>' +
      '</div><aside class="aside"><div class="card"><div class="hd"><h3>作品状态</h3></div><div class="bd">' +
      kv('布局', fu.layout || '—') + kv('版本策略', fu.versioning || '—') + kv('.git', fu.hasGit ? '已就绪' : '未初始化') +
      kv('平台', fu.platformName || '未设置') + kv('章节', String(fu.chapterCount || state.chapters.length)) +
      kv('最近更新', dateStr(d.updatedAt)) +
      '</div></div><div class="card"><div class="bd"><div class="notice">布局 / 版本策略是<b>进程级插件配置</b>（forge|fiction-suite、versions|git），改动需要编辑 profile 并重启 DSH web；这里只读展示。</div></div></div></aside></div>';
    main.innerHTML = html;
    var sel = $('sPlatform'); if (sel) sel.value = fu.platform || '';
    $('saveSet').onclick = saveSettings;
    $('goCatalog').onclick = function(){ setPage('catalog'); };
    var bs = $('openStandalone'); if (bs) bs.onclick = function(){ window.open(location.href, '_blank'); };
    bindGoto(main);
    bindReadPrefs();
  }

  function bindReadPrefs(){
    var fs = $('fsRange'); if (fs) fs.oninput = function(e){ state.fs = Number(e.target.value); $('fsVal').textContent = state.fs; lset('nf-h5-fs', state.fs); applyReaderStyle(); };
    var lh = $('lhRange'); if (lh) lh.oninput = function(e){ state.lh = Number(e.target.value); $('lhVal').textContent = state.lh.toFixed(1); lset('nf-h5-lh', state.lh); applyReaderStyle(); };
    var themeSeg = $('themeSeg');
    if (themeSeg) Array.prototype.forEach.call(themeSeg.querySelectorAll('button'), function(b){
      b.className = b.getAttribute('data-t') === state.theme ? 'on' : '';
      b.onclick = function(){ state.theme = b.getAttribute('data-t'); lset('nf-h5-rtheme', state.theme); applyReaderStyle(); bindReadPrefs(); };
    });
    var fontSeg = $('fontSeg');
    if (fontSeg) Array.prototype.forEach.call(fontSeg.querySelectorAll('button'), function(b){
      b.className = b.getAttribute('data-f') === state.font ? 'on' : '';
      b.onclick = function(){ state.font = b.getAttribute('data-f'); lset('nf-h5-font', state.font); applyReaderStyle(); bindReadPrefs(); };
    });
    var widthSeg = $('widthSeg');
    if (widthSeg) Array.prototype.forEach.call(widthSeg.querySelectorAll('button'), function(b){
      b.className = b.getAttribute('data-w') === state.width ? 'on' : '';
      b.onclick = function(){ state.width = b.getAttribute('data-w'); lset('nf-h5-width', state.width); applyReaderStyle(); bindReadPrefs(); };
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
    var page = $('rPage');
    if (page){
      page.setAttribute('data-font', state.font === 'sans' ? 'sans' : 'serif');
      page.setAttribute('data-width', state.width === 'narrow' ? 'narrow' : state.width === 'wide' ? 'wide' : 'normal');
    }
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
    updateReaderProgress();
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
    // 章末卡片（对应起点阅读页的「本章完 / 求推荐票」位：这里换成插件可用的动作）
    var rec = chapterByNo(state.openNo);
    var end = document.createElement('div'); end.className = 'rend';
    var chars = rec ? Number(rec.chars || 0) : String(text).replace(/\\s/g, '').length;
    var line = document.createElement('div');
    line.textContent = '— 本章完 —　' + chars + ' 字' + (rec && rec.updatedAt ? ' · ' + dateStr(rec.updatedAt) : '');
    end.appendChild(line);
    var acts = document.createElement('div'); acts.className = 'rend-actions';
    [['copyContinue', '复制续写指令'], ['markRead', '标记已读'], ['toCatalog', '返回目录']].forEach(function(a){
      var b = document.createElement('button'); b.textContent = a[1]; b.setAttribute('data-rend', a[0]); acts.appendChild(b);
    });
    end.appendChild(acts);
    page.appendChild(end);
    var btnContinue = end.querySelector('[data-rend="copyContinue"]');
    if (btnContinue) btnContinue.onclick = function(){
      var cmd = '继续写《' + ((state.detail && state.detail.title) || state.book) + '》下一章（当前第 ' + state.openNo + ' 章已读）。' +
        '步骤：novel_outline align → save_chapter 写本章细纲（含「## 本章必写场景」）→ novel_outline approve → novel_briefing → novel_write_chapter。' +
        '先读简报，按风格基线与伏笔计划写；一次只写这一章。';
      var done = function(){ toast('续写指令已复制'); };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(cmd).then(done, function(){ fallbackCopy(cmd); }); }
        else fallbackCopy(cmd);
      } catch (e) { fallbackCopy(cmd); }
    };
    var btnMark = end.querySelector('[data-rend="markRead"]');
    if (btnMark) btnMark.onclick = function(){ lset('nf-h5-last:' + state.book, String(state.openNo)); toast('已标记为读到第 ' + state.openNo + ' 章'); };
    var btnCat = end.querySelector('[data-rend="toCatalog"]');
    if (btnCat) btnCat.onclick = function(){ closeReader(); setPage('catalog'); };
  }
  function fallbackCopy(text){
    var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('续写指令已复制'); } catch (e) { toast('复制失败，请手动选择：' + text.slice(0, 30)); }
    document.body.removeChild(ta);
  }
  function renderReaderSettings(){
    var box = $('rSet');
    if (!box) return;
    var fonts = [['serif', '宋体'], ['sans', '黑体']];
    var widths = [['narrow', '窄'], ['normal', '适中'], ['wide', '宽']];
    var themes = [['paper', '纸白'], ['green', '护眼'], ['night', '夜间']];
    box.innerHTML = '<div class="row"><label><span>字号</span><b id="rsetFs">' + state.fs + 'px</b></label>' +
      '<input type="range" min="16" max="28" step="1" value="' + state.fs + '" id="rsetFsRange" style="width:100%"></div>' +
      '<div class="row"><label><span>行高</span><b id="rsetLh">' + state.lh.toFixed(1) + '</b></label>' +
      '<input type="range" min="1.6" max="2.4" step="0.1" value="' + state.lh + '" id="rsetLhRange" style="width:100%"></div>' +
      '<div class="row"><label>字体</label><div class="seg" id="rsetFont">' +
      fonts.map(function(f){ return '<button data-f="' + f[0] + '" class="' + (state.font === f[0] ? 'on' : '') + '">' + f[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="row"><label>页宽</label><div class="seg" id="rsetWidth">' +
      widths.map(function(w){ return '<button data-w="' + w[0] + '" class="' + (state.width === w[0] ? 'on' : '') + '">' + w[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="row"><label>背景</label><div class="seg" id="rsetTheme">' +
      themes.map(function(t){ return '<button data-t="' + t[0] + '" class="' + (state.theme === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="row" style="text-align:right"><button id="rsetClose" style="border:1px solid #ddd;background:#fff;border-radius:6px;padding:6px 12px;cursor:pointer">完成</button></div>';
    var fsRange = $('rsetFsRange');
    if (fsRange) fsRange.oninput = function(e){ state.fs = Number(e.target.value); lset('nf-h5-fs', state.fs); $('rsetFs').textContent = state.fs + 'px'; applyReaderStyle(); };
    var lhRange = $('rsetLhRange');
    if (lhRange) lhRange.oninput = function(e){ state.lh = Number(e.target.value); lset('nf-h5-lh', state.lh); $('rsetLh').textContent = state.lh.toFixed(1); applyReaderStyle(); };
    var bindSeg = function(id, attr, key, apply){
      var seg = $(id); if (!seg) return;
      Array.prototype.forEach.call(seg.querySelectorAll('button'), function(b){
        b.onclick = function(){
          state[key] = b.getAttribute(attr); lset('nf-h5-' + (key === 'theme' ? 'rtheme' : key), state[key]);
          applyReaderStyle(); renderReaderSettings();
        };
      });
    };
    bindSeg('rsetFont', 'data-f', 'font');
    bindSeg('rsetWidth', 'data-w', 'width');
    bindSeg('rsetTheme', 'data-t', 'theme');
    var close = $('rsetClose'); if (close) close.onclick = function(){ $('rSet').hidden = true; };
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
    $('rSet').hidden = true;
  }
  function closeReaderThen(no){ closeReader(); openReader(no); }
  function updateReaderProgress(){
    var body = $('rBody'), bar = $('rProg');
    if (!body || !bar) return;
    var max = body.scrollHeight - body.clientHeight;
    var pct = max > 0 ? Math.min(100, Math.max(0, (body.scrollTop / max) * 100)) : 0;
    bar.style.width = pct.toFixed(1) + '%';
  }
  function readerStep(delta){
    var arr = sortedChapters(), idx = -1;
    for (var i = 0; i < arr.length; i++) if (Number(arr[i].no) === Number(state.openNo)) idx = i;
    var next = idx + delta;
    if (next >= 0 && next < arr.length) closeReaderThen(arr[next].no);
  }

  // ── 事件 ─────────────────────────────────────────────────────────────
  function openBook(id){
    state.book = id; state.detail = null; state.elements = null; state.chapters = []; state.expanded = false;
    state.worldbook = null; state.health = null;
    try { var u = new URL(location.href); u.searchParams.set('book', id); history.replaceState(null, '', u.toString()); } catch (e) {}
    setPage('home'); loadBook();
  }
  $('homeLink').onclick = function(){ goShelf(); };
  Array.prototype.forEach.call(document.querySelectorAll('.top nav button[data-nav]'), function(b){
    b.onclick = function(){
      var k = b.getAttribute('data-nav');
      if (k === 'shelf') { goShelf(); return; }
      if (k === 'home') { if (state.book) setPage('home'); else goShelf(); }
      else setPage(k);
    };
  });
  $('rBack').onclick = function(){ closeReader(); };
  $('rFsUp').onclick = function(){ state.fs = Math.min(28, state.fs + 1); lset('nf-h5-fs', state.fs); applyReaderStyle(); };
  $('rFsDown').onclick = function(){ state.fs = Math.max(16, state.fs - 1); lset('nf-h5-fs', state.fs); applyReaderStyle(); };
  $('rTheme').onclick = function(){
    state.theme = state.theme === 'paper' ? 'green' : state.theme === 'green' ? 'night' : 'paper';
    lset('nf-h5-rtheme', state.theme); applyReaderStyle(); toast(state.theme === 'paper' ? '纸白背景' : state.theme === 'green' ? '护眼背景' : '夜间背景');
  };
  $('rCatalog').onclick = function(){ closeReader(); setPage('catalog'); };
  $('rSetup').onclick = function(){
    renderReaderSettings();
    var box = $('rSet');
    box.hidden = !box.hidden;
  };
  $('rBody').addEventListener('scroll', function(){
    updateReaderProgress();
    if (state.openNo != null && state.book) lset('nf-h5-scroll:' + state.book + ':' + state.openNo, String($('rBody').scrollTop));
  }, { passive: true });
  // 点击正文左右 22% 区域翻章（起点阅读页同款；选中文字时不翻，避免误触）
  $('rBody').addEventListener('click', function(e){
    if (window.getSelection && String(window.getSelection()) !== '') return;
    if (e.target && e.target.closest && e.target.closest('button')) return;
    var rect = $('rBody').getBoundingClientRect();
    var x = e.clientX - rect.left;
    if (x < rect.width * 0.22) readerStep(-1);
    else if (x > rect.width * 0.78) readerStep(1);
  });
  document.addEventListener('keydown', function(e){
    if (!$('reader').hidden){
      if (e.key === 'Escape') { closeReader(); return; }
      if (e.key === 'ArrowLeft') { readerStep(-1); return; }
      if (e.key === 'ArrowRight') { readerStep(1); return; }
    } else if (e.key === 'Escape' && state.page !== 'home' && state.page !== 'shelf') {
      setPage('home');
    }
  });
  window.addEventListener('message', function(e){
    if (e.data && e.data.type === 'nf-panel-mode') { /* 宿主切模式后本页卸载，无需处理 */ }
  });

  // 启动
  applyReaderStyle();
  api(withSession('/workspaces')).then(function(v){
    state.roots = Array.isArray(v.roots) ? v.roots : [];
    // 默认落点：跳过 DSH profile 自身目录（书稿工作区一般不在 .dsh/profiles 下）
    state.workspace = state.roots.filter(function(r){
      var s = String(r);
      var bs = String.fromCharCode(92);
      return s.indexOf('.dsh' + bs + 'profiles') < 0 && s.indexOf('.dsh/profiles') < 0;
    })[0] || state.roots[0] || '';
  }).catch(function(){ /* 工作区探测失败不阻断页面 */ });
  if (state.book) loadBook(); else goShelf();
})();
</script>
</body>
</html>`;
}
