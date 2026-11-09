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

import { activeLayout, versioningMode, pad3 } from './layout.js';

const ILLEGAL = /[\\/:*?"<>|\s]+/g;

/** 标题清洗：去非法文件名字符，空则回退「无题」。 */
export function sanitizeTitle(title) {
    const t = String(title ?? '').trim().replace(ILLEGAL, '-').replace(/^-+|-+$/g, '');
    return (t || '无题').slice(0, 40);
}

/** 当前布局下的章节文件名（版本号在 git 策略下不出现在文件名里）。 */
export function chapterFileName(n, title, v) {
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
export function parseChapterFileName(name) {
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
export function nextVersion(existingNames, n, options = {}) {
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
export function nextSuffixedId(ids, prefix, startAt = 1) {
    const re = new RegExp(`^${prefix}(\\d+)$`);
    let max = 0;
    for (const id of ids ?? []) {
        const m = re.exec(String(id));
        if (m !== null) max = Math.max(max, Number(m[1]));
    }
    return `${prefix}${Math.max(startAt, max + 1)}`;
}
