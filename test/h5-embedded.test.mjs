import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { renderH5Page } from '../lib/h5-page.js';

test('H5 内嵌脚本可被 JS 引擎解析（防模板转义回归）', () => {
    const html = renderH5Page({});
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    assert.equal(scripts.length, 1, 'H5 应该只有一个内嵌脚本');
    assert.doesNotThrow(() => new vm.Script(scripts[0], { filename: 'h5-inline.js' }));
});

test('H5 工作台默认页与关键入口存在', () => {
    const html = renderH5Page({});
    assert.match(html, /工作台/);
    assert.match(html, /data-wb-rename/);
    assert.match(html, /data-wb-del/);
    assert.match(html, /作品简介（500 字以内）/);
    assert.match(html, /如 2000-5000/);
});
