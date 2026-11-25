#!/usr/bin/env node
/* ============================================================
   jncybr.com — Recipe builder

   Turns the Markdown files in /_recipes into static pages under
   /recipes/. No dependencies; needs Node 18+.

     node scripts/build-recipes.mjs            build
     node scripts/build-recipes.mjs --drafts   also include draft: true

   Generated (do not hand-edit — they are rewritten every build):
     /recipes/index.html
     /recipes/<category>/index.html
     /recipes/<category>/<slug>/index.html

   Hand-written (safe to edit):
     /recipes/recipes.css, /recipes/recipes.js

   See /_recipes/README.md for the recipe file format.
   ============================================================ */

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, '_recipes');
const OUT_DIR = join(ROOT, 'recipes');
const SITE_URL = 'https://jncybr.com';
const AUTHOR = 'Jon Wyatt';
const INCLUDE_DRAFTS = process.argv.includes('--drafts');
const AFFILIATE_DISCLOSURE = 'This page contains affiliate links. As an Amazon Associate I earn from qualifying purchases.';

const CATEGORIES = [
    { slug: 'breakfast', name: 'Breakfast', blurb: 'Slow weekend mornings and quick weekday starts.' },
    { slug: 'lunch',     name: 'Lunch',     blurb: 'Midday meals that pack well and keep you going.' },
    { slug: 'dinner',    name: 'Dinner',    blurb: 'Weeknight staples, plus a few for when there’s time.' },
    { slug: 'snacks',    name: 'Snacks',    blurb: 'Dips, small bites, and things to graze on.' },
    { slug: 'desserts',  name: 'Desserts',  blurb: 'Something sweet to finish.' },
];
const CATEGORY = Object.fromEntries(CATEGORIES.map(c => [c.slug, c]));

const ICON_ATTRS = 'viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const ICONS = {
    // Sunrise
    breakfast: `<svg ${ICON_ATTRS}><path d="M8 32h32M15 38h18M16 32a8 8 0 0 1 16 0M24 21v-4M16.2 24.2l-2.8-2.8M31.8 24.2l2.8-2.8M13.7 28.2l-3.8-1.3M34.3 28.2l3.8-1.3"/></svg>`,
    // Bowl with a leaf
    lunch: `<svg ${ICON_ATTRS}><path d="M8 24h32a16 13 0 0 1-32 0z"/><path d="M19 40h10"/><path d="M24 20c0-6 4-10 10-11 0 6-4 10-10 11z"/><path d="M24 20c-1-3-3.5-5.5-8-6.5"/></svg>`,
    // Fork, plate, knife
    dinner: `<svg ${ICON_ATTRS}><path d="M8 10v7a3 3 0 0 0 6 0v-7M11 10v7M11 20v18"/><circle cx="24.5" cy="24" r="8.5"/><circle cx="24.5" cy="24" r="4.5"/><path d="M40 38V10c-3 2-4.5 7-4.5 12H40"/></svg>`,
    // Cheese wedge
    snacks: `<svg ${ICON_ATTRS}><path d="M8 26 34 14l6 12v10H8z"/><path d="M8 26h32"/><circle cx="16" cy="31" r="2"/><circle cx="27" cy="30.5" r="1.5"/><circle cx="34" cy="33" r="1.2"/><circle cx="29" cy="21" r="1.5"/></svg>`,
    // Cupcake
    desserts: `<svg ${ICON_ATTRS}><path d="M14 26l3 14h14l3-14"/><path d="M20 26l1 14M28 26l-1 14"/><path d="M12 26c0-5 4-8 8-8 1-4 3-6 4-6s3 2 4 6c4 0 8 3 8 8z"/><circle cx="24" cy="8.5" r="2"/></svg>`,
};
const CLOCK_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6.25"/><path d="M8 4.75V8l2.25 1.5"/></svg>';
const SEARCH_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.75"/><path d="m10.5 10.5 3 3"/></svg>';
const PRINT_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 6V2.5h7V6M4.5 11.5H3A1.5 1.5 0 0 1 1.5 10V7.5A1.5 1.5 0 0 1 3 6h10a1.5 1.5 0 0 1 1.5 1.5V10a1.5 1.5 0 0 1-1.5 1.5h-1.5"/><path d="M4.5 9.5h7v4h-7z"/></svg>';
const SUN_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9"/></svg>';
const ARROW_DOWN_ICON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.5v11M3.5 9 8 13.5 12.5 9"/></svg>';

/* ------------------------------------------------------------
   Text helpers
   ------------------------------------------------------------ */

function esc(s) {
    return String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const BR = '\u0000';

/**
 * Minimal inline Markdown on already-escaped text: `code`, [links](url), **bold**, *italic*.
 * Links with an affiliate tag (…?tag=…) are marked rel="sponsored" and open in a new tab.
 */
function inline(s) {
    return s
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, url) => {
            if (!/^(https?:\/\/|\/|#|mailto:)/.test(url)) return text;
            const sponsored = /^https?:\/\//.test(url) && /[?&](amp;)?tag=/.test(url);
            return sponsored
                ? `<a href="${url}" rel="sponsored nofollow noopener" target="_blank">${text}</a>`
                : `<a href="${url}">${text}</a>`;
        })
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
        .replaceAll(BR, '<br>');
}

const md = raw => inline(esc(raw));

function stripMd(s) {
    return String(s)
        .replaceAll(BR, ' ')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1');
}

const slugify = s => stripMd(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** "*Some caption*" → "Some caption"; anything else → null. */
const italicOnly = s => {
    const m = s.match(/^\*([^*].*?)\*$/) || s.match(/^_([^_].*?)_$/);
    return m ? m[1] : null;
};

/* ------------------------------------------------------------
   Block-level Markdown
   headings (### – ######), paragraphs, bullet/numbered lists,
   pipe tables, images, > quotes
   ------------------------------------------------------------ */

const LIST_ITEM = /^(?:([-*+])|(\d+)[.)])\s+(.*)$/;
const BLOCK_START = /^(#{1,6}\s|!\[|>|\||(?:[-*+]|\d+[.)])\s)/;

function parseBlocks(lines) {
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
        const t = lines[i].trim();
        let m;
        if (!t) { i++; continue; }

        if ((m = t.match(/^(#{3,6})\s+(.+?)\s*#*$/))) {
            blocks.push({ type: 'heading', level: m[1].length, text: m[2] });
            i++;
            continue;
        }

        if ((m = t.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/))) {
            blocks.push({ type: 'image', alt: m[1], src: m[2], caption: null });
            i++;
            continue;
        }

        if (t.startsWith('>')) {
            const quoted = [];
            while (i < lines.length && lines[i].trim().startsWith('>')) quoted.push(lines[i++].trim().replace(/^>\s?/, ''));
            blocks.push({ type: 'quote', blocks: parseBlocks(quoted) });
            continue;
        }

        if (t.startsWith('|')) {
            const rows = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++].trim());
            blocks.push(parseTable(rows));
            continue;
        }

        if ((m = t.match(LIST_ITEM))) {
            const ordered = Boolean(m[2]);
            const items = [];
            while (i < lines.length) {
                const line = lines[i].trim();
                if (!line) {
                    // A blank line only ends the list if the next thing isn't another item of the same kind.
                    let j = i;
                    while (j < lines.length && !lines[j].trim()) j++;
                    const next = j < lines.length && lines[j].trim().match(LIST_ITEM);
                    if (next && Boolean(next[2]) === ordered) { i = j; continue; }
                    break;
                }
                const im = line.match(LIST_ITEM);
                if (im) {
                    if (Boolean(im[2]) !== ordered) break;
                    items.push({ num: im[2] ? Number(im[2]) : null, text: im[3] });
                    i++;
                    continue;
                }
                if (BLOCK_START.test(line)) break;
                items[items.length - 1].text += ' ' + line;
                i++;
            }
            blocks.push({ type: 'list', ordered, items });
            continue;
        }

        const para = [];
        while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i].trim())) {
            const raw = lines[i++];
            para.push(/ {2,}$/.test(raw) ? raw.trim() + BR : raw.trim());
        }
        blocks.push({ type: 'para', text: para.join(' ').replace(new RegExp(BR + ' ', 'g'), BR) });
    }

    // Attach "*italic*" paragraphs that follow an image as its caption.
    for (let k = 0; k < blocks.length - 1; k++) {
        const caption = blocks[k].type === 'image' && blocks[k + 1].type === 'para' ? italicOnly(blocks[k + 1].text) : null;
        if (caption) {
            blocks[k].caption = caption;
            blocks.splice(k + 1, 1);
        }
    }
    return blocks;
}

function parseTable(rows) {
    const cells = row => row.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    const isSep = row => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(row);
    const head = cells(rows[0]);
    const align = rows[1] && isSep(rows[1])
        ? cells(rows[1]).map(c => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : null))
        : [];
    const body = rows.slice(rows[1] && isSep(rows[1]) ? 2 : 1).map(cells);
    return { type: 'table', head, align, rows: body };
}

/* ------------------------------------------------------------
   Images
   ------------------------------------------------------------ */

/** Pixel size of a local JPEG, PNG or SVG (for width/height attributes), or null. */
function imageSize(src) {
    if (!src.startsWith('/')) return null;
    const file = join(ROOT, src.split(/[?#]/)[0]);
    if (!existsSync(file)) return null;
    const buf = readFileSync(file);
    if (buf[0] === 0xff && buf[1] === 0xd8) {
        let o = 2;
        while (o < buf.length - 8) {
            if (buf[o] !== 0xff) { o++; continue; }
            const marker = buf[o + 1];
            if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xff) { o += marker === 0xff ? 1 : 2; continue; }
            if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
                return { w: buf.readUInt16BE(o + 7), h: buf.readUInt16BE(o + 5) };
            }
            o += 2 + buf.readUInt16BE(o + 2);
        }
        return null;
    }
    if (buf.subarray(1, 4).toString() === 'PNG') return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (file.endsWith('.svg')) {
        const vb = buf.toString('utf8').match(/viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/);
        if (vb) return { w: Math.round(+vb[1]), h: Math.round(+vb[2]) };
    }
    return null;
}

function figure({ src, alt, caption }, extraClass = '') {
    const size = imageSize(src);
    const dims = size ? ` width="${size.w}" height="${size.h}"` : '';
    const shape = size ? (size.h > size.w * 1.05 ? ' figure--portrait' : size.w > size.h * 2 ? ' figure--wide' : '') : '';
    return `<figure class="figure${shape}${extraClass ? ' ' + extraClass : ''}"><img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async"${dims}>${caption ? `<figcaption>${md(caption)}</figcaption>` : ''}</figure>`;
}

/* ------------------------------------------------------------
   Rendering blocks
   ------------------------------------------------------------ */

function renderTable(b) {
    const al = i => (b.align[i] ? ` style="text-align:${b.align[i]}"` : '');
    // Empty trailing columns in the header row (e.g. "| Cooling rack |  |") are fine; keep cell counts aligned.
    const width = b.head.length;
    const row = r => Array.from({ length: width }, (_, i) => r[i] ?? '');
    return `<div class="table-wrap"><table class="rtable">
                        <thead><tr>${b.head.map((h, i) => `<th scope="col"${al(i)}>${md(h)}</th>`).join('')}</tr></thead>
                        <tbody>${b.rows.map(r => `<tr>${row(r).map((c, i) => (i === 0 ? `<th scope="row"${al(i)}>${md(c)}</th>` : `<td${al(i)}>${md(c)}</td>`)).join('')}</tr>`).join('')}</tbody>
                    </table></div>`;
}

/** Long-form prose: notes, reference sections, intro. */
function renderProse(blocks) {
    const out = [];
    blocks.forEach((b, k) => {
        const prev = blocks[k - 1];
        switch (b.type) {
            case 'heading': out.push(`<h${b.level} class="prose-h${b.level}">${md(b.text)}</h${b.level}>`); break;
            case 'para': {
                const meta = prev?.type === 'heading' ? italicOnly(b.text) : null;
                out.push(meta ? `<p class="subhead-meta">${md(meta)}</p>` : `<p>${md(b.text)}</p>`);
                break;
            }
            case 'list': {
                const tag = b.ordered ? 'ol' : 'ul';
                const start = b.ordered && b.items[0].num > 1 ? ` start="${b.items[0].num}"` : '';
                out.push(`<${tag}${start}>${b.items.map(it => `<li>${md(it.text)}</li>`).join('')}</${tag}>`);
                break;
            }
            case 'table': out.push(renderTable(b)); break;
            case 'image': out.push(figure(b)); break;
            case 'quote': out.push(`<aside class="callout">${renderProse(b.blocks)}</aside>`); break;
        }
    });
    return out.join('\n                    ');
}

/**
 * The method: lists become tappable steps; everything else renders as prose.
 * With #### headings present, ### is a stage ("Day 1") and #### a component ("1. Roast the potatoes").
 * Without them, ### is a component.
 * Steps take the number written in the Markdown, so "1." restarts and "4." continues.
 */
function renderMethod(blocks) {
    const hasSub = blocks.some(b => b.type === 'heading' && b.level >= 4);
    const out = [];
    const sections = []; // for the JSON-LD HowToSection list
    let stage = null;
    let section = null;
    let stepNo = 0;
    let index = 0;

    const openSection = name => {
        section = { name, steps: [] };
        sections.push(section);
    };

    blocks.forEach((b, k) => {
        const prev = blocks[k - 1];
        if (b.type === 'heading') {
            const isStage = hasSub && b.level === 3;
            if (isStage) {
                stage = stripMd(b.text);
                out.push(`<h3 class="method-stage" id="${slugify(b.text)}">${md(b.text)}</h3>`);
            } else {
                const m = b.text.match(/^(\d+)[.)]\s+(.+)$/);
                const label = m ? `<span class="method-group__num">${m[1]}</span>${md(m[2])}` : md(b.text);
                const cls = hasSub ? 'method-group method-group--titled' : 'method-group';
                const id = m ? ` id="step-${m[1]}"` : '';
                out.push(`<h${hasSub ? 4 : 3} class="${cls}"${id}>${label}</h${hasSub ? 4 : 3}>`);
                const name = m ? `step ${m[1]}: ${stripMd(m[2])}` : stripMd(b.text);
                openSection(stage ? `${stage}, ${name}` : name.replace(/^step/, 'Step'));
            }
            return;
        }
        if (b.type === 'list') {
            if (!section) openSection(null);
            const items = b.items.map(it => {
                stepNo = it.num ?? stepNo + 1;
                index++;
                section.steps.push(stripMd(it.text));
                return `<li class="step" value="${stepNo}"><button type="button" class="step__num" aria-pressed="false" aria-label="Mark step ${stepNo}${section.name ? ` of ${esc(section.name)}` : ''} done"><span>${stepNo}</span></button><div class="step__text">${md(it.text)}</div></li>`;
            });
            out.push(`<ol class="steps">
                        ${items.join('\n                        ')}
                    </ol>`);
            return;
        }
        if (b.type === 'para') {
            const meta = prev?.type === 'heading' ? italicOnly(b.text) : null;
            out.push(meta ? `<p class="subhead-meta">${CLOCK_ICON}${md(meta)}</p>` : `<p class="method-text">${md(b.text)}</p>`);
            return;
        }
        out.push(renderProse([b]));
    });

    return { html: out.join('\n                    '), sections: sections.filter(s => s.steps.length), stepCount: index };
}

/** Sidebar list: bullets are tickable ingredients, ### splits groups, plain text becomes a small note. */
function parseIngredients(blocks) {
    const groups = [];
    const notes = [];
    let group = null;
    for (const b of blocks) {
        if (b.type === 'heading') { group = { title: b.text, items: [], notes: [] }; groups.push(group); continue; }
        if (b.type === 'list') {
            if (!group) { group = { title: null, items: [], notes: [] }; groups.push(group); }
            group.items.push(...b.items.map(it => it.text));
            continue;
        }
        if (b.type === 'para') (group ? group.notes : notes).push(b.text);
    }
    return { groups: groups.filter(g => g.items.length || g.notes.length), notes };
}

/* ------------------------------------------------------------
   Quantities (for the servings scaler)
   ------------------------------------------------------------ */

const FRACTIONS = { '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4, '⅕': 1 / 5, '⅖': 2 / 5, '⅗': 3 / 5, '⅘': 4 / 5, '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8 };
const FRAC_CHARS = Object.keys(FRACTIONS).join('');
const NUM_SRC = `(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?(?:\\s?[${FRAC_CHARS}])?|[${FRAC_CHARS}])`;
const LEADING_QTY = new RegExp(`^(${NUM_SRC})(?:\\s*(?:-|–|—|to)\\s*(${NUM_SRC}))?(?=\\s|\\(|[A-Za-z]|$)`);
const UNICODE_NUM = new RegExp(`^(\\d+(?:\\.\\d+)?)?\\s?([${FRAC_CHARS}])$`);
// Weights/volumes inside parentheses, e.g. "(113g)" or "(8 oz)". "(15-oz)" can sizes are left alone.
const SUB_QTY = /(^|[^\d.\/\-–])(\d+(?:\.\d+)?)(\s?)(kg|g|ml|mL|l|L|oz|lbs|lb)(?![A-Za-z])/g;

function parseNum(s) {
    s = s.trim();
    let m;
    if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/))) return +m[1] + m[2] / m[3];
    if ((m = s.match(/^(\d+)\/(\d+)$/))) return m[1] / m[2];
    if ((m = s.match(UNICODE_NUM))) return (m[1] ? +m[1] : 0) + FRACTIONS[m[2]];
    return parseFloat(s);
}

// Keep in sync with formatAmount() in /recipes/recipes.js
const NICE = [[0, ''], [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'], [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'], [1, '']];
function formatAmount(n) {
    if (n >= 20) return String(Math.round(n));
    let whole = Math.floor(n);
    const frac = n - whole;
    let best = NICE[0];
    let bestDiff = Infinity;
    for (const f of NICE) {
        const d = Math.abs(frac - f[0]);
        if (d < bestDiff) { best = f; bestDiff = d; }
    }
    // Snap to a kitchen fraction when it's within 10% (or a hair) of the real amount.
    if (bestDiff > Math.max(0.03, n * 0.1)) return String(+n.toFixed(n < 1 ? 2 : 1));
    if (best[0] === 1) { whole += 1; best = NICE[0]; }
    if (!whole && !best[1]) return String(+n.toFixed(2));
    return (whole ? String(whole) : '') + best[1];
}

const round6 = n => +n.toFixed(6);

function renderIngredient(raw) {
    let qtyHtml = '';
    let rest = raw;
    const m = raw.match(LEADING_QTY);
    if (m) {
        const a = parseNum(m[1]);
        const b = m[2] ? parseNum(m[2]) : null;
        if (Number.isFinite(a) && a > 0 && (b === null || Number.isFinite(b))) {
            const text = b === null ? formatAmount(a) : `${formatAmount(a)}–${formatAmount(b)}`;
            const max = b === null ? '' : ` data-qty-max="${round6(b)}"`;
            qtyHtml = `<span class="qty" data-qty="${round6(a)}"${max}>${text}</span>`;
            rest = raw.slice(m[0].length);
        }
    }
    const html = esc(rest).replace(/\(([^()]*)\)/g, (_, inner) =>
        '(' + inner.replace(SUB_QTY, (__, pre, n, sp, unit) =>
            `${pre}<span class="qty qty--sub" data-qty="${n}" data-unit="${unit}">${n}</span>${sp}${unit}`) + ')');
    return qtyHtml + inline(html);
}

/* ------------------------------------------------------------
   Times
   ------------------------------------------------------------ */

const DURATION_TOKEN = '(\\d+(?:\\.\\d+)?)\\s*(days|day|d|hours|hour|hrs|hr|h|minutes|minute|mins|min|m)(?![a-z])';

/**
 * "45 min", "1 hr 15 min", "1h15m", "75" → minutes, shown in a tidy form.
 * Anything with extra words ("About 11 hr, over 2 days") keeps its wording,
 * but the leading duration still feeds the search-engine markup.
 */
function timeField(value) {
    if (!value) return null;
    const raw = String(value).trim();
    const s = raw.toLowerCase().replace(new RegExp(`(\\d*)\\s?([${FRAC_CHARS}])`, 'g'), (_, w, f) => String((+w || 0) + FRACTIONS[f]));
    if (/^\d+(\.\d+)?$/.test(s)) return { minutes: Math.round(+s), text: formatDuration(Math.round(+s)) };
    const lead = s.match(new RegExp(`^(about|around|approx\\.?|~)?\\s*((?:${DURATION_TOKEN}\\s*(?:and\\s+|,\\s*|\\+\\s*)?)+)`));
    if (!lead) return { minutes: null, text: raw };
    let minutes = 0;
    for (const t of lead[2].matchAll(new RegExp(DURATION_TOKEN, 'g'))) {
        minutes += +t[1] * (t[2].startsWith('d') ? 1440 : t[2].startsWith('h') ? 60 : 1);
    }
    minutes = Math.round(minutes);
    const exact = !lead[1] && !s.slice(lead[0].length).trim() && !/[,+]\s*$|and\s*$/.test(lead[2].trim());
    return { minutes, text: exact ? formatDuration(minutes) : raw };
}

function formatDuration(min) {
    const d = Math.floor(min / 1440);
    const h = Math.floor((min % 1440) / 60);
    const m = min % 60;
    const parts = [];
    if (d) parts.push(`${d} ${d === 1 ? 'day' : 'days'}`);
    if (h) parts.push(`${h} hr`);
    if (m || !parts.length) parts.push(`${m} min`);
    return parts.join(' ');
}

function isoDuration(min) {
    const d = Math.floor(min / 1440);
    const h = Math.floor((min % 1440) / 60);
    const m = min % 60;
    return `P${d ? d + 'D' : ''}T${h ? h + 'H' : ''}${m || (!d && !h) ? m + 'M' : ''}`;
}

/* ------------------------------------------------------------
   Parsing a recipe file
   ------------------------------------------------------------ */

function parseFrontMatter(text) {
    const m = text.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/);
    if (!m) return null;
    const data = {};
    for (const line of m[1].split(/\r?\n/)) {
        if (!line.trim() || line.trim().startsWith('#')) continue;
        const i = line.indexOf(':');
        if (i < 0) continue;
        const key = line.slice(0, i).trim().toLowerCase().replace(/_/g, '-');
        data[key] = line.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    }
    return { data, body: m[2] };
}

function splitSections(body) {
    const sections = [];
    let current = { title: null, lines: [] };
    for (const line of body.split(/\r?\n/)) {
        const h = line.match(/^##\s+(.+?)\s*#*\s*$/);
        if (h) {
            sections.push(current);
            current = { title: h[1].trim(), lines: [] };
        } else {
            current.lines.push(line);
        }
    }
    sections.push(current);
    return sections;
}

const INGREDIENT_TITLES = ['ingredients', 'shopping list'];
const STEP_TITLES = ['steps', 'method', 'instructions', 'directions'];
const NOTE_TITLES = /^(notes?|tips?|cook'?s notes?)$/i;
const yes = v => /^(true|yes|on)$/i.test(v || '');
const no = v => /^(false|no|off)$/i.test(v || '');

function loadRecipe(file, errors, warnings) {
    const slug = file.replace(/\.md$/, '');
    const where = `_recipes/${file}`;
    const parsed = parseFrontMatter(readFileSync(join(SRC_DIR, file), 'utf8'));
    if (!parsed) { errors.push(`${where}: missing front matter (the --- block at the top)`); return null; }
    const { data, body } = parsed;

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.push(`${where}: file name must be lowercase-words-with-dashes.md`);
    if (!data.title) errors.push(`${where}: missing "title"`);
    const category = (data.category || '').toLowerCase();
    if (!CATEGORY[category]) errors.push(`${where}: "category" must be one of ${CATEGORIES.map(c => c.slug).join(', ')} (got "${data.category || ''}")`);
    if (!data.description) warnings.push(`${where}: no "description" — cards and search results look better with one`);

    let date = data.date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        if (date) warnings.push(`${where}: "date" should look like 2026-11-24; using the file date instead`);
        else warnings.push(`${where}: no "date"; using the file date`);
        date = statSync(join(SRC_DIR, file)).mtime.toISOString().slice(0, 10);
    }

    const checkImage = src => {
        if (src.startsWith('/') && !existsSync(join(ROOT, src.split(/[?#]/)[0]))) warnings.push(`${where}: image ${src} doesn't exist yet`);
    };
    if (data.image) checkImage(data.image);

    // Sections keep their order: anything before the ingredients/method is reference material
    // that leads into the recipe; anything after follows the method.
    const sections = splitSections(body);
    const intro = sections.shift();
    let ingredients = { groups: [], notes: [] };
    let ingredientsTitle = 'Ingredients';
    let method = null;
    const before = [];
    const after = [];
    for (const s of sections) {
        const t = s.title.toLowerCase();
        const blocks = parseBlocks(s.lines);
        blocks.filter(b => b.type === 'image').forEach(b => checkImage(b.src));
        if (INGREDIENT_TITLES.includes(t)) {
            ingredients = parseIngredients(blocks);
            ingredientsTitle = s.title;
        } else if (STEP_TITLES.includes(t)) {
            method = renderMethod(blocks);
            method.images = blocks.filter(b => b.type === 'image').map(b => b.src);
        } else {
            const entry = { title: s.title, id: slugify(s.title), html: renderProse(blocks), note: NOTE_TITLES.test(s.title), images: blocks.filter(b => b.type === 'image').map(b => b.src) };
            (method || ingredients.groups.length ? after : before).push(entry);
        }
    }
    if (!ingredients.groups.length) warnings.push(`${where}: no "## Ingredients" list found`);
    if (!method?.stepCount) warnings.push(`${where}: no "## Steps" list found`);

    const prep = timeField(data.prep);
    const active = timeField(data.active);
    const cook = timeField(data.cook);
    const rest = timeField(data.rest);
    let total = timeField(data.total);
    const parts = [prep, cook, rest].filter(Boolean);
    if (!total && parts.length > 1 && parts.every(p => p.minutes !== null)) {
        const minutes = parts.reduce((sum, p) => sum + p.minutes, 0);
        total = { minutes, text: formatDuration(minutes) };
    }

    // What the servings scaler counts: "servings: 4", or the number in "yield: 18 cookies".
    let scale = null;
    const servingsNum = parseFloat(data.servings);
    const yieldMatch = (data.yield || '').match(/^(\d+)\s+(.+)$/);
    if (no(data.scale)) scale = null;
    else if (servingsNum > 0) scale = { base: servingsNum, unit: 'servings', unitOne: 'serving' };
    else if (yieldMatch) scale = { base: +yieldMatch[1], unit: yieldMatch[2], unitOne: yieldMatch[2].replace(/s$/, '') };

    const tags = (data.tags || '').split(',').map(t => t.trim()).filter(Boolean);
    const title = data.title || slug;
    const description = data.description || '';
    const ingredientText = ingredients.groups.flatMap(g => g.items.map(stripMd));

    return {
        slug, file, title, description, category, date, tags, scale,
        draft: yes(data.draft),
        affiliate: yes(data.affiliate),
        cuisine: data.cuisine || '',
        image: data.image || '',
        imageAlt: data['image-alt'] || title,
        imagePosition: data['image-position'] || '',
        servings: data.servings || '',
        yield: data.yield || '',
        oven: data.oven || '',
        prep, active, cook, rest, total,
        introHtml: renderProse(parseBlocks(intro.lines)),
        ingredients, ingredientsTitle, method, before, after, ingredientText,
        bodyImages: [...before, ...after].flatMap(s => s.images).concat(method?.images || []),
        url: `/recipes/${category}/${slug}/`,
        searchText: [title, description, CATEGORY[category]?.name, data.cuisine, ...tags, ...ingredientText].filter(Boolean).join(' ').toLowerCase().replace(/\s+/g, ' '),
    };
}

/* ------------------------------------------------------------
   Templates
   ------------------------------------------------------------ */

function assetVersion(file) {
    return createHash('sha1').update(readFileSync(join(OUT_DIR, file))).digest('hex').slice(0, 8);
}
const CSS_VERSION = assetVersion('recipes.css');
const JS_VERSION = assetVersion('recipes.js');

const formatDate = iso => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const absUrl = path => (/^https?:\/\//.test(path) ? path : SITE_URL + path);
const imgPos = r => (r.imagePosition ? ` style="object-position: ${esc(r.imagePosition)}"` : '');

function layout({ title, description, path, bodyClass = '', ogType = 'website', image = '', jsonLd = null, content }) {
    const metaImage = image ? `
    <meta property="og:image" content="${esc(absUrl(image))}">
    <meta name="twitter:card" content="summary_large_image">` : `
    <meta name="twitter:card" content="summary">`;
    const ld = jsonLd ? `
    <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : '';
    return `<!DOCTYPE html>
<!-- Generated by scripts/build-recipes.mjs from /_recipes. Edit the Markdown, not this file. -->
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    <link rel="canonical" href="${SITE_URL}${path}">
    <meta property="og:type" content="${ogType}">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:url" content="${SITE_URL}${path}">
    <meta property="og:site_name" content="jncybr">${metaImage}
    <meta name="theme-color" content="#0a0a12">
    <link rel="stylesheet" href="/styles.css">
    <link rel="stylesheet" href="/recipes/recipes.css?v=${CSS_VERSION}">
    <script src="/recipes/recipes.js?v=${JS_VERSION}" defer></script>${ld}
</head>
<body class="recipes${bodyClass ? ' ' + bodyClass : ''}">
    <div class="ambient-glow"></div>

    <div class="page-container">
${content}
    </div>

    <footer class="site-footer">
        <p class="site-footer__text">&copy; ${new Date().getFullYear()} ${AUTHOR} &middot; <a href="/">Home</a> &middot; <a href="/recipes/">Recipes</a> &middot; <a href="/side-projects/">Projects</a> &middot; <a href="https://github.com/joncwyatt">GitHub</a></p>
    </footer>
</body>
</html>
`;
}

function breadcrumb(items) {
    const parts = items.map(([label, href]) => href ? `<a href="${href}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`);
    return `        <nav class="breadcrumb" aria-label="Breadcrumb">
            ${parts.join('\n            <span class="sep">/</span>\n            ')}
        </nav>`;
}

function art(category, extraClass = '') {
    return `<div class="art cat--${category}${extraClass ? ' ' + extraClass : ''}">${ICONS[category]}</div>`;
}

function cardMeta(r) {
    const time = r.total || r.cook || r.prep || r.active;
    const bits = [];
    if (time) bits.push(`<span>${CLOCK_ICON}${esc(time.text)}</span>`);
    if (r.servings) bits.push(`<span>Serves ${esc(r.servings)}</span>`);
    else if (r.yield) bits.push(`<span>Makes ${esc(r.yield)}</span>`);
    return bits.length ? `<p class="recipe-card__meta">${bits.join('')}</p>` : '';
}

function card(r, { featured = false } = {}) {
    const cat = CATEGORY[r.category];
    const media = r.image
        ? `<img src="${esc(r.image)}" alt="" loading="lazy" decoding="async"${imgPos(r)}>`
        : art(r.category);
    return `
                <a href="${r.url}" class="recipe-card cat--${r.category}${featured ? ' recipe-card--featured' : ''}" data-search="${esc(r.searchText)}">
                    <div class="recipe-card__media">${media}${featured ? '<span class="recipe-card__badge">Latest</span>' : ''}</div>
                    <div class="recipe-card__body">
                        <p class="recipe-card__cat">${cat.name}</p>
                        <h3 class="recipe-card__title">${esc(r.title)}</h3>
                        ${r.description ? `<p class="recipe-card__desc">${esc(r.description)}</p>` : ''}
                        ${cardMeta(r)}
                    </div>
                </a>`;
}

function categoryNav(recipes, active) {
    const pills = [
        `<a href="/recipes/" class="cat-pill cat-pill--all"${active === null ? ' aria-current="page"' : ''}>All<span class="cat-pill__count">${recipes.length}</span></a>`,
        ...CATEGORIES.map(c => {
            const n = recipes.filter(r => r.category === c.slug).length;
            return `<a href="/recipes/${c.slug}/" class="cat-pill cat--${c.slug}"${active === c.slug ? ' aria-current="page"' : ''}>${c.name}<span class="cat-pill__count">${n}</span></a>`;
        }),
    ];
    return `<nav class="cat-nav" aria-label="Recipe categories">
                ${pills.join('\n                ')}
            </nav>`;
}

function listingPage({ recipes, list, active, path, title, metaTitle, description, label, tagline, emptyCategory }) {
    const hasAny = list.length > 0;
    const search = hasAny ? `
            <div class="recipe-search" data-search-box hidden>
                ${SEARCH_ICON}
                <input type="search" placeholder="${active ? `Search ${esc(CATEGORY[active].name.toLowerCase())}` : 'Search recipes or ingredients'}" aria-label="Search recipes" autocomplete="off" spellcheck="false">
                <kbd>/</kbd>
            </div>` : '';
    const cards = list.map((r, i) => card(r, { featured: !active && i === 0 })).join('');
    const latest = list[0]?.date;
    const meta = hasAny
        ? `${plural(list.length, 'recipe', 'recipes')} &middot; Updated ${formatDate(latest)}`
        : '';

    const grid = hasAny ? `
        <section class="recipe-grid" aria-label="Recipes">${cards}
        </section>
        <p class="recipe-empty" data-empty hidden>No recipes match &ldquo;<span data-q></span>&rdquo;. Try an ingredient, like <em>lemon</em> or <em>chocolate</em>.</p>` : `
        <div class="recipe-empty-state">
            ${art(emptyCategory || 'dinner', 'art--small')}
            <p>Nothing here yet. Check back soon.</p>
        </div>`;

    const content = `${breadcrumb(active ? [['jncybr', '/'], ['Recipes', '/recipes/'], [CATEGORY[active].name]] : [['jncybr', '/'], ['Recipes']])}

        <header class="recipes-hero">
            <p class="recipes-hero__label">${label}</p>
            <h1 class="recipes-hero__title">${esc(title)}</h1>
            <p class="recipes-hero__tagline">${tagline}</p>
            ${meta ? `<p class="recipes-hero__meta">${meta}</p>` : ''}
        </header>

        <div class="recipes-toolbar">
            ${categoryNav(recipes, active)}${search}
        </div>
${grid}`;

    return layout({ title: metaTitle, description, path, bodyClass: active ? `cat--${active}` : '', content });
}

function recipePage(r, recipes) {
    const cat = CATEGORY[r.category];

    const facts = [
        r.prep && ['Prep', r.prep.text],
        r.active && ['Active', r.active.text],
        r.cook && ['Cook', r.cook.text],
        r.rest && ['Rest', r.rest.text],
        r.total && ['Total', r.total.text],
        r.servings && ['Serves', r.servings],
        r.yield && ['Makes', r.yield],
        r.oven && ['Oven', r.oven],
    ].filter(Boolean);
    const factsHtml = facts.length ? `
                    <dl class="recipe-facts">
                        ${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('\n                        ')}
                    </dl>` : '';

    const jump = r.before.length ? `
                        <a href="#recipe" class="chip-btn chip-btn--accent">${ARROW_DOWN_ICON}Jump to recipe</a>` : '';
    const disclosure = r.affiliate ? `
                    <p class="recipe-disclosure">${AFFILIATE_DISCLOSURE}</p>` : '';

    const photo = r.image ? (() => {
        const size = imageSize(r.image);
        const dims = size ? ` width="${size.w}" height="${size.h}"` : '';
        return `
                <figure class="recipe-header__photo">
                    <img src="${esc(r.image)}" alt="${esc(r.imageAlt)}" decoding="async" fetchpriority="high"${dims}${imgPos(r)}>
                </figure>`;
    })() : '';

    const header = `
            <header class="recipe-header${r.image ? ' recipe-header--split' : ''}">
                <div class="recipe-header__text">
                    <a href="/recipes/${r.category}/" class="recipe-header__cat">${cat.name}</a>
                    <h1 class="recipe-title">${esc(r.title)}</h1>
                    ${r.description ? `<p class="recipe-lead">${esc(r.description)}</p>` : ''}${factsHtml}
                    <div class="recipe-actions">${jump}
                        <button type="button" class="chip-btn" data-action="print">${PRINT_ICON}Print</button>
                        <button type="button" class="chip-btn" data-action="wake" aria-pressed="false" hidden>${SUN_ICON}Keep screen on</button>
                        <time class="recipe-date" datetime="${r.date}">${formatDate(r.date)}</time>
                    </div>${disclosure}
                </div>${photo}
            </header>`;

    const intro = r.introHtml ? `

            <div class="recipe-intro prose">
                    ${r.introHtml}
            </div>` : '';

    // "On this page" for long recipes
    const tocItems = [
        ...r.before.map(s => [s.title, s.id]),
        ['Recipe', 'recipe'],
        ...r.after.map(s => [s.title, s.id]),
    ];
    const toc = r.before.length + r.after.length >= 3 ? `

            <nav class="recipe-toc" aria-label="On this page">
                <p class="recipe-toc__label">On this page</p>
                <ol>${tocItems.map(([t, id]) => `<li><a href="#${id}">${md(t)}</a></li>`).join('')}</ol>
            </nav>` : '';

    const section = (s, cls) => `
                <section class="${cls}${s.note ? ' recipe-section--note' : ' recipe-section--aux'}" id="${s.id}" aria-labelledby="${s.id}-title">
                    <h2 id="${s.id}-title" class="recipe-section__title">${md(s.title)}</h2>
                    <div class="prose">
                    ${s.html}
                    </div>
                </section>`;

    const before = r.before.length ? `

            <div class="recipe-article">${r.before.map(s => section(s, 'recipe-section')).join('')}
            </div>` : '';

    const scaler = r.scale ? `
                        <div class="servings" data-servings-control data-base="${r.scale.base}" data-unit="${esc(r.scale.unit)}" data-unit-one="${esc(r.scale.unitOne)}" hidden>
                            <button type="button" class="servings__btn" data-step="-1" aria-label="Fewer">&minus;</button>
                            <output class="servings__value" aria-live="polite"><strong data-servings>${r.scale.base}</strong> <span data-servings-unit>${esc(r.scale.base === 1 ? r.scale.unitOne : r.scale.unit)}</span></output>
                            <button type="button" class="servings__btn" data-step="1" aria-label="More">+</button>
                        </div>` : '';
    const scaleNote = r.scale ? `
                    <p class="scale-note" data-scale-note hidden>Scaled <span data-factor></span> &middot; <button type="button" data-scale-reset>Reset</button></p>` : '';

    let ingIndex = 0;
    const ingNotes = r.ingredients.notes.map(n => `
                    <p class="ing-note">${md(n)}</p>`).join('');
    const ingredients = r.ingredients.groups.map(g => `
                    <div class="ing-group">
                        ${g.title ? `<h3 class="ing-group__title">${md(g.title)}</h3>` : ''}
                        <ul class="ing-list">
                            ${g.items.map(item => `<li class="ing"><label><input type="checkbox" class="ing__check" data-i="${ingIndex++}"><span class="ing__text">${renderIngredient(item)}</span></label></li>`).join('\n                            ')}
                        </ul>${g.notes.map(n => `
                        <p class="ing-note">${md(n)}</p>`).join('')}
                    </div>`).join('');

    const after = r.after.map(s => section(s, 'recipe-section recipe-section--after')).join('');

    const tags = r.tags.length ? `
                    <ul class="recipe-tags" aria-label="Tags">
                        ${r.tags.map(t => `<li>${esc(t)}</li>`).join('')}
                    </ul>` : '';

    const others = recipes.filter(o => o !== r);
    const more = [...others.filter(o => o.category === r.category), ...others.filter(o => o.category !== r.category)].slice(0, 3);
    const moreHtml = more.length ? `

        <section class="recipe-more" aria-labelledby="more-title">
            <div class="recipe-more__head">
                <h2 id="more-title" class="recipe-section-title">More to cook</h2>
                <a href="/recipes/${r.category}/" class="recipe-more__link">All ${cat.name.toLowerCase()} &rarr;</a>
            </div>
            <div class="recipe-grid">${more.map(o => card(o)).join('')}
            </div>
        </section>` : '';

    const content = `${breadcrumb([['jncybr', '/'], ['Recipes', '/recipes/'], [cat.name, `/recipes/${r.category}/`], [r.title]])}

        <article class="recipe" data-recipe="${r.slug}">${header}${intro}${toc}${before}

            <div class="recipe-body" id="recipe">
                <aside class="ingredients" aria-labelledby="ingredients-title">
                    <div class="ingredients__head">
                        <h2 id="ingredients-title" class="recipe-section-title">${md(r.ingredientsTitle)}</h2>${scaler}
                    </div>${scaleNote}${ingNotes}${ingredients}
                </aside>

                <div class="method">
                    <section aria-labelledby="method-title">
                        <h2 id="method-title" class="recipe-section-title">Method</h2>
                    ${r.method?.html || ''}
                    </section>${after}${tags}
                </div>
            </div>
        </article>${moreHtml}`;

    const methodSections = r.method?.sections || [];
    const titled = methodSections.some(s => s.name);
    const images = [r.image, ...r.bodyImages].filter(src => src && /\.(jpe?g|png|webp)$/i.test(src)).map(absUrl);
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: r.title,
        description: r.description || undefined,
        image: images.length ? [...new Set(images)] : undefined,
        author: { '@type': 'Person', name: AUTHOR, url: SITE_URL },
        datePublished: r.date,
        recipeCategory: cat.name,
        recipeCuisine: r.cuisine || undefined,
        keywords: r.tags.length ? r.tags.join(', ') : undefined,
        recipeYield: [r.servings && `${r.servings} servings`, r.yield].filter(Boolean),
        prepTime: (r.prep || r.active)?.minutes != null ? isoDuration((r.prep || r.active).minutes) : undefined,
        cookTime: r.cook?.minutes != null ? isoDuration(r.cook.minutes) : undefined,
        totalTime: r.total?.minutes != null ? isoDuration(r.total.minutes) : undefined,
        recipeIngredient: r.ingredientText,
        recipeInstructions: titled
            ? methodSections.map(s => ({
                '@type': 'HowToSection',
                name: s.name || undefined,
                itemListElement: s.steps.map(text => ({ '@type': 'HowToStep', text })),
            }))
            : methodSections.flatMap(s => s.steps.map(text => ({ '@type': 'HowToStep', text }))),
    };

    return layout({
        title: `${r.title} — Recipes — ${AUTHOR}`,
        description: r.description || `${r.title}, a ${cat.name.toLowerCase()} recipe from ${AUTHOR}.`,
        path: r.url,
        bodyClass: `cat--${r.category}`,
        ogType: 'article',
        image: r.image,
        jsonLd,
        content,
    });
}

/* ------------------------------------------------------------
   Build
   ------------------------------------------------------------ */

function write(relPath, html) {
    const full = join(OUT_DIR, relPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, html);
}

function main() {
    if (!existsSync(SRC_DIR)) mkdirSync(SRC_DIR);
    const files = readdirSync(SRC_DIR)
        .filter(f => f.endsWith('.md') && !f.startsWith('_') && f.toLowerCase() !== 'readme.md')
        .sort();

    const errors = [];
    const warnings = [];
    const all = files.map(f => loadRecipe(f, errors, warnings)).filter(Boolean);
    const recipes = all
        .filter(r => INCLUDE_DRAFTS || !r.draft)
        .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

    const seen = new Map();
    for (const r of recipes) {
        if (seen.has(r.slug)) errors.push(`Two recipes share the slug "${r.slug}"`);
        seen.set(r.slug, r);
    }

    warnings.forEach(w => console.warn(`  ! ${w}`));
    if (errors.length) {
        errors.forEach(e => console.error(`  ✗ ${e}`));
        console.error(`\nBuild failed: ${plural(errors.length, 'error', 'errors')}. Nothing was written.`);
        process.exit(1);
    }

    // Category folders are fully generated, so clear them to drop renamed/deleted recipes.
    for (const c of CATEGORIES) rmSync(join(OUT_DIR, c.slug), { recursive: true, force: true });

    write('index.html', listingPage({
        recipes,
        list: recipes,
        active: null,
        path: '/recipes/',
        title: 'Recipes',
        metaTitle: `Recipes — ${AUTHOR}`,
        description: `Breakfast, lunch, dinner, snacks, and desserts: recipes ${AUTHOR} cooks at home.`,
        label: 'From the kitchen',
        tagline: 'The things I actually cook at home, written down so you can make them too. Breakfast through dessert.',
    }));

    for (const c of CATEGORIES) {
        const list = recipes.filter(r => r.category === c.slug);
        write(`${c.slug}/index.html`, listingPage({
            recipes,
            list,
            active: c.slug,
            path: `/recipes/${c.slug}/`,
            title: c.name,
            metaTitle: `${c.name} Recipes — ${AUTHOR}`,
            description: `${c.name} recipes from ${AUTHOR}. ${c.blurb}`,
            label: 'Recipes',
            tagline: esc(c.blurb),
            emptyCategory: c.slug,
        }));
    }

    for (const r of recipes) write(`${r.category}/${r.slug}/index.html`, recipePage(r, recipes));

    const drafts = all.filter(r => r.draft).length;
    const draftNote = drafts ? ` (${plural(drafts, 'draft', 'drafts')} ${INCLUDE_DRAFTS ? 'included' : 'skipped — use --drafts to preview'})` : '';
    console.log(`Built ${plural(recipes.length, 'recipe', 'recipes')} across ${CATEGORIES.length} categories${draftNote}.`);
}

main();
