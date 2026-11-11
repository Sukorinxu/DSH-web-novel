#!/usr/bin/env node
// scripts/shoot-h5.mjs — 生成 README「界面一览」用的 H5 实机截图。
//
// 无外部依赖：Node ≥ 22 自带 WebSocket；启动本机 Edge/Chrome 的 headless CDP，
// 打开 GET /h5?book=<示例书>，按导航点击后 `Page.captureScreenshot`。
//
// 用法（需要能启动浏览器的权限；Windows 沙箱里要 danger-full-access）：
//   node scripts/shoot-h5.mjs <h5-url> <out-dir> [browser-exe]
// 示例：
//   node scripts/shoot-h5.mjs "http://127.0.0.1:10153/api/dsh-web-novel/h5?book=示例·长夜行" assets/screenshots-h5
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const h5Url = process.argv[2];
const outDir = path.resolve(process.argv[3] || 'assets/screenshots-h5');
const browser = process.argv[4] || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
if (!h5Url) { console.error('usage: node scripts/shoot-h5.mjs <h5-url> <out-dir> [browser-exe]'); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });

const port = 9333;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nf-h5-shots-'));
const child = spawn(browser, [
  '--headless=new', `--remote-debugging-port=${port}`, '--remote-allow-origins=*',
  `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu',
  '--hide-scrollbars', '--force-device-scale-factor=1', 'about:blank',
], { stdio: 'ignore', windowsHide: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitVersion() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) });
      if (r.ok) return;
    } catch { /* retry */ }
    await sleep(200);
  }
  throw new Error('CDP endpoint not ready');
}
async function pageTarget() {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  if (page) return page;
  const created = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  return created;
}

let nextId = 1;
const pending = new Map();
let ws;
function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
function waitOpen() {
  return new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
}

async function main() {
  await waitVersion();
  const target = await pageTarget();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    }
  });
  await waitOpen();
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 860, deviceScaleFactor: 1, mobile: false,
  });

  const go = async (url, expr) => {
    await send('Page.navigate', { url });
    await sleep(2200);
    if (expr) { await send('Runtime.evaluate', { expression: expr }); await sleep(900); }
  };
  const shot = async (name) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    fs.writeFileSync(path.join(outDir, name), Buffer.from(data, 'base64'));
    console.log('saved', name);
  };

  const detail = h5Url;
  await go(detail);
  await shot('01-detail.png');
  await go(detail, "document.querySelector('[data-nav=\"catalog\"]').click()");
  await shot('02-catalog.png');
  await go(detail, "document.querySelector('#readBtn').click()");
  await sleep(1200);
  await shot('03-reader.png');
  await go(detail, "document.querySelector('[data-nav=\"tools\"]').click()");
  await shot('04-tools.png');
  await go(detail, "document.querySelector('[data-nav=\"settings\"]').click()");
  await shot('05-settings.png');
}

try {
  await main();
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  try { child.kill(); } catch { /* ignore */ }
  await sleep(300);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}
