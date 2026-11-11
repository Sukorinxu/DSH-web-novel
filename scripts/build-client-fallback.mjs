#!/usr/bin/env node
// scripts/build-client-fallback.mjs — 零依赖替代构建器（本机没有 esbuild 时用）。
//
// 背景：官方构建 `npm run build`（scripts/build-client.mjs）依赖 esbuild；某些环境
// （离线/无法装包）拿不到 esbuild。客户端源码本身是**无 JSX、无动态 import、无循环依赖**
// 的纯 ESM，因此这里用一个最小 ESM→CJS factory 转译器产出与官方构建**行为等价**的
// lib/client.js（同样的 __ModuleLoader__ 外壳、同样的导出表、同样的 generated 头）。
//
// 与官方构建的差异（仅实现细节，契约不变）：
//   · 没有 tree-shaking / 变量重命名：产物比 esbuild 大，但语义一致；
//   · 不做 ESM 实况绑定（live bindings）——本插件源码无循环依赖，按拓扑序求值即可。
//
// 守卫与官方构建一致：源码 PLUGIN_VERSION 必须等于 package.json version；
// 产物必须含 generated 头、__ModuleLoader__.load、id、CJS 导出表。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const entryRel = 'src/client/index.js';
const outRel = 'lib/client.js';
const ENTRY_ABS = path.join(root, entryRel);

// ── 守卫：版本号单一来源（与 build-client.mjs 相同）──
const entrySrc = fs.readFileSync(ENTRY_ABS, 'utf8');
const versionMatch = entrySrc.match(/PLUGIN_VERSION\s*=\s*['"]([^'"]+)['"]/);
if (!versionMatch) {
    console.error(`✗ ${entryRel} 里找不到 PLUGIN_VERSION 字面量（构建需要一个可校验的版本号）`);
    process.exit(1);
}
if (versionMatch[1] !== pkg.version) {
    console.error(`✗ 版本漂移：${entryRel} 是 ${versionMatch[1]}，package.json 是 ${pkg.version}`);
    process.exit(1);
}

const keyFor = (abs) => path.relative(root, abs).split(path.sep).join('/');
const isRelative = (spec) => spec.startsWith('.');

/** 把一条 import 子句转成 CJS 取用代码。 */
function renderImport(importerAbs, { clause, spec }) {
    const target = isRelative(spec) ? keyFor(path.resolve(path.dirname(importerAbs), spec)) : `@ext:${spec}`;
    const ref = `__m(${JSON.stringify(target)})`;
    const rendered = [];
    if (clause === null) return `${ref};`;
    let rest = clause.trim();
    // default + named 混合：`Foo, { bar }`
    const mixed = /^([A-Za-z_$][\w$]*)\s*,\s*\{([\s\S]*)\}$/.exec(rest);
    if (mixed) {
        rendered.push(`const ${mixed[1]} = ${ref}.default;`);
        rest = `{${mixed[2]}}`;
    }
    if (/^\*\s+as\s+/.test(rest)) {
        const ns = /^\*\s+as\s+([A-Za-z_$][\w$]*)$/.exec(rest);
        if (!ns) throw new Error(`不支持的 namespace import 形态：${clause}（${importerAbs}）`);
        rendered.push(`const ${ns[1]} = ${ref};`);
    } else if (/^\{/.test(rest)) {
        const list = rest.replace(/^\{|\}$/g, '');
        const parts = list.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
            const m = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(s);
            if (!m) throw new Error(`不支持的 named import 形态：${s}（${importerAbs}）`);
            return m[2] ? `${m[1]}: ${m[2]}` : m[1];
        });
        rendered.push(`const { ${parts.join(', ')} } = ${ref};`);
    } else if (/^[A-Za-z_$][\w$]*$/.test(rest)) {
        rendered.push(`const ${rest} = ${ref}.default;`);
    } else {
        throw new Error(`不支持的 import 子句：${clause}（${importerAbs}）`);
    }
    return rendered.join('\n');
}

/** 解析一个模块：剥 import/export、收集导出表。 */
function parseModule(abs) {
    let text = fs.readFileSync(abs, 'utf8');
    const isEntry = abs === ENTRY_ABS;
    const imports = [];
    // 1) `import ... from '...'`（含跨行）
    text = text.replace(/^import\s+([\s\S]*?)\s*from\s*['"]([^'"]+)['"]\s*;?/gm, (m, clause, spec) => {
        imports.push({ clause: clause.trim(), spec });
        return '\u0000NF_IMPORT\u0000;';
    });
    // 2) 副作用 import
    text = text.replace(/^import\s*['"]([^'"]+)['"]\s*;?/gm, (m, spec) => {
        imports.push({ clause: null, spec });
        return '\u0000NF_IMPORT\u0000;';
    });
    let importIdx = 0;
    text = text.replace(/\u0000NF_IMPORT\u0000;/g, () => renderImport(abs, imports[importIdx++]));

    // 3) 导出：先处理 `export { a, b as c };`
    const exportsList = [];
    text = text.replace(/^export\s*\{([^}]*)\}\s*;?\s*$/gm, (m, list) => {
        for (const part of list.split(',')) {
            const raw = part.trim();
            if (raw === '') continue;
            const m2 = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(raw);
            if (!m2) throw new Error(`不支持的 re-export 形态：${raw}（${abs}）`);
            exportsList.push({ local: m2[1], exported: m2[2] ?? m2[1] });
        }
        return '';
    });
    // 4) 导出声明：export [async] function / const / let / var / class NAME
    text = text.replace(/^export\s+(async\s+function|function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm, (m, kind, name) => {
        exportsList.push({ local: name, exported: name });
        return `${kind} ${name}`;
    });
    if (/^\s*export\s/m.test(text)) throw new Error(`残留 export 语法（${abs}）：\n${text.split('\n').filter((l) => /^\s*export\s/.test(l)).join('\n')}`);
    if (/^\s*import\s/m.test(text)) throw new Error(`残留 import 语法（${abs}）`);

    // 入口的 PLUGIN_VERSION 转成双引号字面量（冒烟测试按 "1.6.1" 形态校验产物）
    if (isEntry) text = text.replace(/(PLUGIN_VERSION\s*=\s*)'([^']*)'/, '$1"$2"');
    return {
        abs,
        key: keyFor(abs),
        isEntry,
        body: text,
        exports: exportsList,
        deps: imports.filter((im) => isRelative(im.spec)).map((im) => path.resolve(path.dirname(abs), im.spec)),
    };
}

// ── 模块图（深度优先，保持稳定顺序）──
const modules = new Map();
function walk(abs) {
    const key = keyFor(abs);
    if (modules.has(key)) return;
    const parsed = parseModule(abs);
    modules.set(key, parsed);
    for (const dep of parsed.deps) {
        if (!fs.existsSync(dep)) throw new Error(`找不到模块：${keyFor(dep)}（被 ${key} 引用）`);
        walk(dep);
    }
}
walk(ENTRY_ABS);

// ── 产物 ──
const banner = `// ⚠️ 自动生成，请勿直接编辑 —— 改 src/client/ 后跑 npm run build。
// 源码：src/client/index.js（+ forge-tab.js / session-watch.js / panel.js / views/*）
// 本产物是经典脚本：dsh 的 client-modules 按 CJS factory 执行它。
// 构建器：${path.basename(process.argv[1] ?? 'build-client-fallback.mjs')}（无 esbuild 环境的等价构建；契约与官方构建一致）
window.__ModuleLoader__.load({
	id: ${JSON.stringify(pkg.name)},
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
`;

const chunks = [banner];
for (const mod of modules.values()) {
    if (mod.isEntry) continue;
    const exportFields = mod.exports.map((e) => `${JSON.stringify(e.exported)}: ${e.local}`).join(', ');
    chunks.push(`\n		// ── ${mod.key} ──
		__factories[${JSON.stringify(mod.key)}] = function (__m, __exports) {
${mod.body}
			return { ${exportFields} };
		};
`);
}

const entry = modules.get(keyFor(ENTRY_ABS));
const entryExportFields = entry.exports.map((e) => `${e.exported}: () => ${e.local}`).join(', ');
chunks.push(`\n		// ── ${entry.key}（入口，内联在 factory 作用域，导出表走 CJS 装配）──
${entry.body}

		var index_exports = {};
		__export(index_exports, { ${entryExportFields} });
		module.exports = __toCommonJS(index_exports);
`);

chunks.push(`
		return module.exports;
	}
});
`);

const out = chunks.join('');
fs.writeFileSync(path.join(root, outRel), out, 'utf8');
const size = fs.statSync(path.join(root, outRel)).size;
console.log(`✓ ${outRel} 已生成（fallback builder）— v${pkg.version}，${(size / 1024).toFixed(1)} KB，${modules.size} 个模块`);
