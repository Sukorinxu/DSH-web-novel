// lib/server-routes/h5.js — H5 网页版面板外壳（GET /h5）。
//
// 为什么单独一条路由：右侧栏 React 面板重渲染在长列表/宽屏浮层下有卡顿感，
// 用户要一个「整体按 H5 网页设计」的入口。H5 页面是**零依赖单文件**（lib/h5-page.js），
// 放 iframe 里跑，数据仍走同一套 REST + fence 头（安全模型不变）。
//
// 安全边界：/h5 只返回**静态外壳**，本身不含任何书稿数据；因此它豁免 fence header
// （浏览器 iframe 导航无法带自定义头），但仍受 Host/Origin 本机白名单约束；
// 所有数据请求（/projects 等）照旧必须带 fence。这与「REST 数据面必须带 fence」不冲突。
import { renderH5Page } from '../h5-page.js';

/** GET /h5 → 完整 HTML 文档。 */
export function handle(req, res, segments) {
    if (!(req.method === 'GET' && segments.length === 1 && segments[0] === 'h5')) return false;
    const html = renderH5Page({ basePath: '/api/novel-forge' });
    res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        // 不设 X-Frame-Options：DSH 右侧栏 / 聊天链接预览用 <iframe> 嵌 H5，且常以
        // localhost 与 127.0.0.1 两种源互相嵌入——SAMEORIGIN 会让其中一种直接白屏。
        // H5 外壳不含书稿数据；数据面（/projects 等）仍强制 fence + Host/Origin 白名单，
        // 「允许被嵌」不等于「允许取数据」。
        'referrer-policy': 'no-referrer',
    });
    res.end(html);
    return true;
}
