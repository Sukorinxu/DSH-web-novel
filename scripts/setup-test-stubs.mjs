#!/usr/bin/env node
// scripts/setup-test-stubs.mjs — 本地测试用的宿主 SDK 最小垫片安装/卸载。
//
// 背景：单元测试里有几处**刻意要用宿主真定义**的地方（Config 默认值、defineTool
// 参数归一、validateJsonSchemaValue 输出契约）。本机 DSH 的 SDK 在 app.asar 里，
// 无法 npm run setup-dev 的 symlink 方式接入；`test/stubs/@deepseek-ai/` 提供了
// 两个最小垫片（schemastery / dsh-tools），只在**跑测试时**挂进 node_modules。
//
// ⚠️ 生产运行时不要挂：插件包被 profile 以 link: 方式引用（node_modules 直指本仓库），
// 插件自己的 node_modules 会**优先于**宿主解析——垫片留在里面等于用替身跑真机。
// 所以测试完跑 `--remove` 卸掉；node_modules/ 本身在 .gitignore 里，垫片源码在
// test/stubs/ 入库（不进发行面：package.json 的 files 不含 test/）。
//
// 用法：
//   node scripts/setup-test-stubs.mjs           # 挂载（幂等，已存在则跳过）
//   node scripts/setup-test-stubs.mjs --remove  # 卸载

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'test', 'stubs', '@deepseek-ai');
const targetDir = path.join(root, 'node_modules', '@deepseek-ai');
const remove = process.argv.includes('--remove');

const packages = fs.existsSync(sourceDir)
    ? fs.readdirSync(sourceDir).filter((name) => fs.statSync(path.join(sourceDir, name)).isDirectory())
    : [];

if (remove) {
    for (const name of packages) {
        const link = path.join(targetDir, name);
        if (fs.existsSync(link) || fs.lstatSync(link, { throwIfNoEntry: false }) !== undefined) {
            fs.rmSync(link, { recursive: true, force: true });
            console.log(`removed node_modules/@deepseek-ai/${name}`);
        }
    }
    if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length === 0) {
        fs.rmdirSync(targetDir);
        const parent = path.join(root, 'node_modules');
        if (fs.existsSync(parent) && fs.readdirSync(parent).length === 0) fs.rmdirSync(parent);
    }
    console.log('测试垫片已卸载（生产运行时保持干净）。');
    process.exit(0);
}

if (packages.length === 0) {
    console.error(`找不到测试垫片：${sourceDir}`);
    process.exit(1);
}
fs.mkdirSync(targetDir, { recursive: true });
for (const name of packages) {
    const src = path.join(sourceDir, name);
    const dest = path.join(targetDir, name);
    const exists = fs.lstatSync(dest, { throwIfNoEntry: false }) !== undefined;
    if (exists) {
        console.log(`已存在：node_modules/@deepseek-ai/${name}（跳过）`);
        continue;
    }
    // Windows 用 junction（不需要管理员权限）；其它平台用 dir 符号链接。
    fs.symlinkSync(src, dest, process.platform === 'win32' ? 'junction' : 'dir');
    console.log(`linked node_modules/@deepseek-ai/${name} → ${src}`);
}
console.log('测试垫片已挂载：node test/<file>.test.mjs 可直跑（沙箱里 node --test 的 spawn 会被拒）。');
