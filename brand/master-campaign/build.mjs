import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { cards, generatedImagePrompts, lanes } from './campaign-data.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..');
const svgRoot = join(here, 'svg');
const pngRoot = join(here, 'png');
const sheetRoot = join(here, 'contact-sheets');
const docsRoot = join(here, 'docs');
const sourceArtRoot = join(here, 'source-art');
const fontFile = join(repo, 'public', 'art', 'display.woff2');
const buildDate = '2026-09-07';

const C = {
  ink: '#08090a', panel: '#111315', panel2: '#181a1d', line: '#4c4541',
  paper: '#f2eadb', paper2: '#d0c6b6', muted: '#a79d8f', gold: '#cba65c',
  gold2: '#e3c47d', cyan: '#6eafc8', blood: '#ca625b', green: '#72aa86', amber: '#d8944e',
};

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[ch]));
}

function csv(value) {
  const string = String(value ?? '');
  return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
}

function wrap(value, max) {
  const words = String(value).trim().split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function textLines(items, {
  x, y, size, step = size * 1.05, fill = C.paper, family = 'body',
  weight = 400, spacing = 0, anchor = 'start',
}) {
  const fontFamily = family === 'display'
    ? 'Omerta Display, Arial Narrow, sans-serif'
    : family === 'mono' ? 'Consolas, Menlo, monospace' : 'Georgia, serif';
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${fill}" font-family="${fontFamily}" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}">${items.map((line, index) => `<tspan x="${x}" dy="${index ? step : 0}">${esc(line)}</tspan>`).join('')}</text>`;
}

function smallText(x, y, value, {
  size = 20, fill = C.paper2, family = 'body', weight = 400, spacing = 0, anchor = 'start',
} = {}) {
  return textLines([value], { x, y, size, fill, family, weight, spacing, anchor });
}

function statusTone(status) {
  if (status.startsWith('IN BUILD')) return { accent: C.amber, wash: '#402a16' };
  if (status.includes('DORMANT')) return { accent: C.blood, wash: '#411c1a' };
  if (status.includes('GATED') || status.includes('CONDITIONAL')) return { accent: C.gold, wash: '#3a2c13' };
  if (status.startsWith('BUILT')) return { accent: C.cyan, wash: '#17303a' };
  return { accent: C.green, wash: '#173122' };
}

function pill(x, y, value, accent, maxWidth = 430) {
  const width = Math.min(maxWidth, Math.max(150, value.length * 12.8 + 48));
  return `<g><rect x="${x}" y="${y}" width="${width}" height="46" rx="23" fill="${C.ink}" fill-opacity=".82" stroke="${accent}" stroke-width="2"/><circle cx="${x + 22}" cy="${y + 23}" r="5" fill="${accent}"/>${smallText(x + 38, y + 30, value, { size: 17, fill: C.paper, family: 'mono', weight: 700, spacing: .7 })}</g>`;
}

function brand(x = 58, y = 54, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M0 22 C1 -3 14 -18 37 -18 C60 -18 73 -3 74 22 Z" fill="${C.gold}"/><ellipse cx="37" cy="22" rx="58" ry="10" fill="${C.gold}"/><rect x="0" y="11" width="74" height="8" fill="${C.ink}"/><text x="92" y="27" fill="${C.gold2}" font-family="Georgia, serif" font-size="34" letter-spacing="8">OMERTÀ</text></g>`;
}

function cardSvg(card, lane, artHref, fontHref) {
  const tone = statusTone(card.status);
  const longestTitleLine = Math.max(...card.title.map((line) => line.length));
  const titleSize = Math.max(50, Math.min(73, Math.floor(900 / (longestTitleLine * .63))));
  const bodyLines = wrap(card.body, 57).slice(0, 4);
  const factY = [842, 942, 1042];
  const factBlocks = card.facts.map((fact, index) => {
    const lines = wrap(fact, 52).slice(0, 2);
    return `<g><rect x="58" y="${factY[index]}" width="964" height="82" rx="6" fill="${C.panel}" fill-opacity=".90" stroke="${C.line}"/><rect x="58" y="${factY[index]}" width="7" height="82" rx="3" fill="${index === 1 ? C.cyan : tone.accent}"/><text x="88" y="${factY[index] + 31}" fill="${tone.accent}" font-family="Consolas, Menlo, monospace" font-size="17" font-weight="700">0${index + 1}</text>${textLines(lines, { x: 132, y: factY[index] + (lines.length > 1 ? 27 : 50), size: 22, step: 27, fill: C.paper, family: 'body' })}</g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <style>@font-face{font-family:'Omerta Display';src:url('${fontHref}') format('woff2');font-weight:600}</style>
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.ink}" stop-opacity=".72"/><stop offset=".34" stop-color="${C.ink}" stop-opacity=".54"/><stop offset=".57" stop-color="${C.ink}" stop-opacity=".86"/><stop offset="1" stop-color="${C.ink}" stop-opacity="1"/></linearGradient>
    <radialGradient id="glow" cx="82%" cy="15%" r="76%"><stop offset="0" stop-color="${tone.accent}" stop-opacity=".17"/><stop offset="1" stop-color="${C.ink}" stop-opacity="0"/></radialGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".74" numOctaves="2" seed="${Number(card.slug.slice(0, 2)) + 12}"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .09"/></feComponentTransfer></filter>
    <clipPath id="clip"><rect width="1080" height="1350"/></clipPath>
  </defs>
  <rect width="1080" height="1350" fill="${C.ink}"/>
  <image href="${artHref}" width="1080" height="780" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip)"/>
  <rect width="1080" height="1350" fill="url(#shade)"/>
  <rect width="1080" height="1350" fill="url(#glow)"/>
  <rect width="1080" height="1350" filter="url(#grain)" opacity=".30"/>
  <rect x="28" y="28" width="1024" height="1294" fill="none" stroke="${tone.accent}" stroke-opacity=".30"/>
  ${brand()}
  ${smallText(1020, 80, `${lane.short} · ${card.slug.slice(0, 2)}/12`, { size: 17, fill: C.paper2, family: 'mono', weight: 700, spacing: 1, anchor: 'end' })}
  ${pill(58, 132, card.status, tone.accent)}
  ${smallText(58, 228, card.eyebrow, { size: 18, fill: tone.accent, family: 'mono', weight: 700, spacing: 3 })}
  ${textLines(card.title, { x: 58, y: 310, size: titleSize, step: titleSize * .93, fill: C.paper, family: 'display', weight: 600, spacing: .8 })}
  <rect x="58" y="${card.title.length > 1 ? 474 : 400}" width="170" height="4" fill="${tone.accent}"/>
  ${textLines(bodyLines, { x: 58, y: card.title.length > 1 ? 534 : 460, size: 29, step: 38, fill: C.paper2, family: 'body' })}
  <rect x="58" y="798" width="964" height="2" fill="${C.line}"/>
  ${factBlocks}
  ${smallText(58, 1190, 'SOURCE / CLAIM BASIS', { size: 14, fill: tone.accent, family: 'mono', weight: 700, spacing: 2 })}
  ${smallText(58, 1218, card.source, { size: 17, fill: C.muted, family: 'mono' })}
  <rect x="58" y="1252" width="964" height="2" fill="${C.line}"/>
  ${smallText(58, 1291, 'OMERTA.FUN', { size: 18, fill: C.gold2, family: 'mono', weight: 700, spacing: 2 })}
  ${smallText(1022, 1291, card.id.toUpperCase(), { size: 14, fill: C.muted, family: 'mono', anchor: 'end' })}
  </svg>`;
}

function mimeFor(path) {
  const ext = extname(path).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

async function dataUri(path) {
  return `data:${mimeFor(path)};base64,${(await readFile(path)).toString('base64')}`;
}

async function renderSvg(svg, destination, width) {
  const rendered = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { fontFiles: [fontFile], loadSystemFonts: true, defaultFontFamily: 'Georgia' },
  }).render().asPng();
  await writeFile(destination, rendered);
}

function validate() {
  const issues = [];
  if (lanes.length !== 9) issues.push(`Expected 9 lanes, found ${lanes.length}.`);
  if (cards.length !== 108) issues.push(`Expected 108 cards, found ${cards.length}.`);
  const ids = new Set();
  for (const card of cards) {
    if (ids.has(card.id)) issues.push(`Duplicate id: ${card.id}`);
    ids.add(card.id);
    if (card.post.length > 280) issues.push(`${card.id} is ${card.post.length} X characters.`);
    if (card.facts.length !== 3) issues.push(`${card.id} does not have exactly three facts.`);
  }
  for (const lane of lanes) {
    const count = cards.filter((card) => card.lane === lane.id).length;
    if (count !== 12) issues.push(`${lane.id} has ${count} cards.`);
  }
  if (issues.length) throw new Error(`Campaign validation failed:\n${issues.join('\n')}`);
}

function laneSheetSvg(lane, laneCards, imageUris) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1460" viewBox="0 0 1440 1460"><rect width="1440" height="1460" fill="${C.ink}"/><rect x="24" y="24" width="1392" height="1412" fill="none" stroke="${C.gold}" stroke-opacity=".25"/>${brand(42, 44, .75)}${smallText(1394, 70, lane.title, { size: 22, fill: C.gold2, family: 'mono', weight: 700, anchor: 'end', spacing: 1.2 })}${smallText(1394, 104, lane.description, { size: 17, fill: C.paper2, family: 'body', anchor: 'end' })}${laneCards.map((card, index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    return `<image href="${imageUris[index]}" x="${35 + col * 350}" y="${150 + row * 424}" width="320" height="400"/>`;
  }).join('')}</svg>`;
}

function masterSheetSvg(laneSheetUris) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1600" viewBox="0 0 1500 1600"><rect width="1500" height="1600" fill="${C.ink}"/><rect x="26" y="26" width="1448" height="1548" fill="none" stroke="${C.gold}" stroke-opacity=".3"/>${brand(50, 48, .8)}${smallText(1450, 69, 'THE COMPLETE MARKETING SYSTEM', { size: 23, fill: C.gold2, family: 'mono', weight: 700, anchor: 'end', spacing: 1.4 })}${smallText(1450, 104, '108 CARDS · 9 SERIES · ONE SOURCE OF TRUTH', { size: 17, fill: C.paper2, family: 'mono', anchor: 'end' })}${laneSheetUris.map((uri, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    return `<image href="${uri}" x="${50 + col * 475}" y="${165 + row * 470}" width="450" height="456"/>`;
  }).join('')}</svg>`;
}

function overviewSvg(artHref, fontHref) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <style>@font-face{font-family:'Omerta Display';src:url('${fontHref}') format('woff2');font-weight:600}</style>
  <defs><linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.ink}" stop-opacity=".12"/><stop offset=".38" stop-color="${C.ink}" stop-opacity=".70"/><stop offset="1" stop-color="${C.ink}" stop-opacity=".98"/></linearGradient><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2"/><feComponentTransfer><feFuncA type="table" tableValues="0 .08"/></feComponentTransfer></filter></defs>
  <rect width="1920" height="1080" fill="${C.ink}"/><image href="${artHref}" width="1920" height="1080" preserveAspectRatio="xMidYMid slice"/><rect width="1920" height="1080" fill="url(#shade)"/><rect width="1920" height="1080" filter="url(#grain)" opacity=".22"/><rect x="34" y="34" width="1852" height="1012" fill="none" stroke="${C.gold}" stroke-opacity=".32"/>
  ${brand(64, 58, .9)}${smallText(64, 164, 'THE COMPLETE GAME · TOKEN · AGENT CAMPAIGN', { size: 18, fill: C.gold2, family: 'mono', weight: 700, spacing: 2.4 })}${textLines(['EVERY ANGLE.', 'ONE CITY.'], { x: 64, y: 244, size: 80, step: 73, fill: C.paper, family: 'display', weight: 600 })}${textLines(['108 source-tagged campaign cards for the', 'street, the economy, the stories and the machine.'], { x: 64, y: 448, size: 28, step: 38, fill: C.paper2, family: 'body' })}${pill(64, 614, 'LIVE SYSTEMS', C.green, 260)}${pill(64, 674, 'BUILT / GATED RAILS', C.cyan, 310)}${pill(64, 734, 'WORLD GRAPH · IN BUILD', C.amber, 340)}${smallText(64, 850, 'NO EARNINGS PROMISES · NO TOKEN-PRICE CLAIMS', { size: 17, fill: C.blood, family: 'mono', weight: 700, spacing: .8 })}${smallText(64, 946, 'OMERTA.FUN', { size: 27, fill: C.gold2, family: 'mono', weight: 700, spacing: 2 })}
  <g transform="translate(802 154)">${lanes.map((lane, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = col * 350;
    const y = row * 265;
    const accent = index === 8 ? C.amber : index === 6 ? C.cyan : C.gold;
    const desc = wrap(lane.description, 31).slice(0, 3);
    return `<g transform="translate(${x} ${y})"><rect width="320" height="232" rx="7" fill="${C.panel}" fill-opacity=".91" stroke="${accent}" stroke-opacity=".55"/><rect width="320" height="6" rx="3" fill="${accent}"/>${smallText(22, 43, `${String(index + 1).padStart(2, '0')} / 09`, { size: 14, fill: accent, family: 'mono', weight: 700, spacing: 1.4 })}${textLines(wrap(lane.title, 21).slice(0, 2), { x: 22, y: 83, size: 23, step: 27, fill: C.paper, family: 'display', weight: 600 })}${textLines(desc, { x: 22, y: 153, size: 17, step: 24, fill: C.paper2, family: 'body' })}</g>`;
  }).join('')}</g>
  </svg>`;
}

function relativeAsset(path) {
  return relative(here, path).replaceAll('\\', '/');
}

function sourceArtName(repoRelativePath) {
  return repoRelativePath.replaceAll('\\', '/').replaceAll('/', '--').replace(/[^a-zA-Z0-9._-]/g, '-');
}

function buildXCopy() {
  const blocks = [`# OMERTÀ — X Copy Bank`, '', `Generated ${buildDate}. Every post is 280 characters or fewer. Pair each post with the listed image.`, '', '> Publishing gate: re-check every status tag against production immediately before posting. IN BUILD is not LIVE. BUILT / DORMANT is not an open withdrawal rail.', ''];
  for (const lane of lanes) {
    blocks.push(`## ${lane.title}`, '', lane.description, '');
    const laneCards = cards.filter((card) => card.lane === lane.id);
    for (const card of laneCards) {
      blocks.push(`### ${card.slug.slice(0, 2)} — ${card.title.join(' ')}`, '', `**Status:** ${card.status}  `, `**Source:** ${card.source}  `, `**Image:** [${card.id}.png](../png/${lane.id}/${card.id}.png)`, '', card.post, '', `Character count: ${card.post.length}`, '');
    }
  }
  return `${blocks.join('\n')}\n`;
}

function buildMatrixMarkdown() {
  const rows = ['# OMERTÀ — Master Campaign Matrix', '', '| ID | Series | Angle | Status | Source | Asset |', '|---|---|---|---|---|---|'];
  for (const card of cards) {
    const lane = lanes.find((item) => item.id === card.lane);
    rows.push(`| ${card.id} | ${lane.title} | ${card.title.join(' ')} | ${card.status} | ${card.source.replaceAll('|', '\\|')} | [PNG](../png/${card.lane}/${card.id}.png) |`);
  }
  return `${rows.join('\n')}\n`;
}

function buildCalendar() {
  const start = new Date('2026-09-08T12:00:00-04:00');
  const ordered = [];
  for (let cardNumber = 0; cardNumber < 12; cardNumber += 1) {
    for (let laneNumber = 0; laneNumber < lanes.length; laneNumber += 1) {
      ordered.push(cards.find((card) => card.lane === lanes[laneNumber].id && Number(card.slug.slice(0, 2)) === cardNumber + 1));
    }
  }
  const records = ordered.map((card, index) => {
    const date = new Date(start);
    let remaining = index;
    while (remaining > 0) {
      date.setDate(date.getDate() + 1);
      if (date.getDay() !== 0) remaining -= 1;
    }
    const dateValue = date.toISOString().slice(0, 10);
    const lane = lanes.find((item) => item.id === card.lane);
    return { sequence: index + 1, date: dateValue, time: index % 2 ? '19:45 ET' : '12:15 ET', id: card.id, series: lane.title, status: card.status, post: card.post, asset: `png/${card.lane}/${card.id}.png` };
  });
  const header = ['sequence', 'date', 'time', 'id', 'series', 'status', 'post', 'asset'];
  return [header.join(','), ...records.map((record) => header.map((key) => csv(record[key])).join(','))].join('\n') + '\n';
}

function buildPublishingPlan() {
  return `# OMERTÀ — X Publishing Plan

This pack contains 108 posts: one source-tagged post for every campaign card. The default calendar starts September 8, 2026 and publishes Monday–Saturday, alternating 12:15 PM and 7:45 PM Eastern. Treat those times as an initial test, not a universal truth.

## Launch rhythm

- Rotate across all nine series before returning to the next card in a series. This keeps the feed from reading like nine consecutive token posts or twelve consecutive feature dumps.
- Use the PNG as the primary attachment. Use the 16:9 overview as the pinned campaign introduction.
- Keep the source/status language on the graphic intact. It is part of the claim, not production metadata.
- Re-check production state before every post. If a feature changed, update the single record in campaign-data.mjs and rebuild the pack.
- For IN BUILD posts, lead with the vision and explicitly keep “IN BUILD” in the copy. Do not imply a launch date that the engineering plan does not provide.

## Editorial guardrails

- Never promise income, yield, token appreciation, liquidity, or an extraction date.
- Say that the production extraction rail is dormant until its audit and launch gates clear.
- Keep the one-way Cash Window precise: $OMR can be burned for game cash only while the funded till can honor it; game cash cannot be converted to $OMR.
- Describe RWA, bond, BANK, POL, oracle, and withdrawal systems by their displayed lifecycle/status. “Built” is not the same as “live.”
- Authored cases and workshop keepsakes are gameplay-inert and do not pay cash or $OMR.
- Agent marketing must plainly disclose that the recruiter is an AI. No spam, sockpuppets, earnings promises, or undisclosed astroturfing.

## Measurement loop

Track each post by series, hook, status, impressions, profile visits, site clicks, qualified signups, retained players, replies, saves, and follows. After 18 posts, compare hooks within the same series; after 54, retire weak framings and preserve the underlying feature coverage. Qualified recruiting—not raw reach—is the meaningful downstream metric.

The exact post order is in PUBLISHING-CALENDAR.csv. The full copy bank is in X-COPY.md.
`;
}

function buildGallery({ imageRoot = 'png', extension = 'png', sheetRoot = 'contact-sheets' } = {}) {
  const sections = lanes.map((lane) => {
    const items = cards.filter((card) => card.lane === lane.id).map((card) => `<article class="card"><img loading="lazy" src="${imageRoot}/${card.lane}/${card.id}.${extension}" alt="${esc(card.title.join(' '))}"><div class="meta"><span class="status">${esc(card.status)}</span><h3>${esc(card.title.join(' '))}</h3><p>${esc(card.post)}</p><small>${esc(card.source)}</small></div></article>`).join('');
    return `<section><header><p>${esc(lane.short)}</p><h2>${esc(lane.title)}</h2><div>${esc(lane.description)}</div></header><div class="grid">${items}</div></section>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OMERTÀ Complete Marketing Campaign</title><style>:root{color-scheme:dark;--ink:#08090a;--panel:#141517;--paper:#f2eadb;--muted:#aaa094;--gold:#d0ac62;--line:#403b39}*{box-sizing:border-box}body{margin:0;background:var(--ink);color:var(--paper);font-family:Georgia,serif}main{max-width:1460px;margin:auto;padding:32px 20px 100px}.hero{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(280px,.6fr);gap:28px;align-items:end;border-bottom:1px solid var(--line);padding:36px 0 48px}.hero img{width:100%;border:1px solid var(--line)}h1,h2,h3{font-family:Impact,'Arial Narrow',sans-serif;letter-spacing:.04em;text-transform:uppercase}.hero h1{font-size:clamp(2.4rem,7vw,6rem);line-height:.9;margin:.2em 0}.hero p,section header div{color:var(--muted);font-size:1.05rem;line-height:1.55}section{padding-top:70px}section header{max-width:760px;margin-bottom:24px}section header p,.status{font-family:Consolas,monospace;color:var(--gold);letter-spacing:.12em;font-size:.75rem}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:22px}.card{background:var(--panel);border:1px solid var(--line)}.card img{display:block;width:100%;height:auto}.meta{padding:16px}.meta h3{font-size:1.25rem;margin:.5rem 0}.meta p{color:#d4ccbf;line-height:1.5;font-size:.92rem}.meta small{color:var(--muted);font-family:Consolas,monospace}@media(max-width:1000px){.grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:720px){main{padding-left:12px;padding-right:12px}.hero{grid-template-columns:1fr}.grid{grid-template-columns:repeat(2,1fr);gap:10px}.meta{padding:11px}.meta p{font-size:.83rem}.meta h3{font-size:1rem}}@media(max-width:420px){.grid{grid-template-columns:1fr}}</style></head><body><main><div class="hero"><div><p>OMERTÀ / COMPLETE CAMPAIGN</p><h1>Every angle.<br>One city.</h1><p>108 graphics across the game, its economies, authored stories, autonomous players, and the production systems currently in build. Every claim carries a status and source.</p></div><img src="${sheetRoot}/00-master-contact-sheet.${extension}" alt="All nine campaign series"></div>${sections}</main></body></html>`;
}

validate();
await rm(svgRoot, { recursive: true, force: true });
await rm(pngRoot, { recursive: true, force: true });
await rm(sheetRoot, { recursive: true, force: true });
await rm(docsRoot, { recursive: true, force: true });
await rm(sourceArtRoot, { recursive: true, force: true });
for (const path of [svgRoot, pngRoot, sheetRoot, docsRoot, sourceArtRoot]) await mkdir(path, { recursive: true });

await copyFile(fontFile, join(sourceArtRoot, 'display.woff2'));
for (const art of new Set(cards.map((card) => card.art))) {
  await copyFile(resolve(repo, art), join(sourceArtRoot, sourceArtName(art)));
}

const manifestCards = [];
for (const lane of lanes) {
  const laneSvgDir = join(svgRoot, lane.id);
  const lanePngDir = join(pngRoot, lane.id);
  await mkdir(laneSvgDir, { recursive: true });
  await mkdir(lanePngDir, { recursive: true });
  const laneCards = cards.filter((card) => card.lane === lane.id);
  for (const card of laneCards) {
    const artPath = join(sourceArtRoot, sourceArtName(card.art));
    const sourcePath = join(laneSvgDir, `${card.id}.svg`);
    const pngPath = join(lanePngDir, `${card.id}.png`);
    const artHref = relative(dirname(sourcePath), artPath).replaceAll('\\', '/');
    const fontHref = relative(dirname(sourcePath), join(sourceArtRoot, 'display.woff2')).replaceAll('\\', '/');
    const sourceSvg = cardSvg(card, lane, artHref, fontHref);
    await writeFile(sourcePath, sourceSvg);
    const renderSvgSource = sourceSvg.replace(`href="${artHref}"`, `href="${await dataUri(artPath)}"`);
    await renderSvg(renderSvgSource, pngPath, 1080);
    manifestCards.push({ ...card, png: relativeAsset(pngPath), svg: relativeAsset(sourcePath), xCharacterCount: card.post.length });
  }
}

const laneSheetUris = [];
for (const lane of lanes) {
  const laneCards = cards.filter((card) => card.lane === lane.id);
  const imageUris = [];
  for (const card of laneCards) imageUris.push(await dataUri(join(pngRoot, lane.id, `${card.id}.png`)));
  const sheetSvg = laneSheetSvg(lane, laneCards, imageUris);
  const sheetPng = join(sheetRoot, `${lane.id}-contact-sheet.png`);
  await renderSvg(sheetSvg, sheetPng, 1440);
  laneSheetUris.push(await dataUri(sheetPng));
}

await renderSvg(masterSheetSvg(laneSheetUris), join(sheetRoot, '00-master-contact-sheet.png'), 1500);

const overviewArt = join(here, 'art', 'living-city-system-map.png');
const overviewSourcePath = join(svgRoot, '00-master-overview-16x9.svg');
const overviewSourceArt = join(sourceArtRoot, sourceArtName(relative(repo, overviewArt)));
const overviewArtHref = relative(dirname(overviewSourcePath), overviewSourceArt).replaceAll('\\', '/');
const overviewFontHref = relative(dirname(overviewSourcePath), join(sourceArtRoot, 'display.woff2')).replaceAll('\\', '/');
const overviewSource = overviewSvg(overviewArtHref, overviewFontHref);
await writeFile(overviewSourcePath, overviewSource);
await renderSvg(overviewSource.replace(`href="${overviewArtHref}"`, `href="${await dataUri(overviewSourceArt)}"`), join(pngRoot, '00-master-overview-16x9.png'), 1920);

await writeFile(join(docsRoot, 'X-COPY.md'), buildXCopy());
await writeFile(join(docsRoot, 'CAMPAIGN-MATRIX.md'), buildMatrixMarkdown());
await writeFile(join(docsRoot, 'CAMPAIGN-MATRIX.csv'), ['id,lane,status,eyebrow,title,body,fact_1,fact_2,fact_3,x_copy,x_characters,source,art,png', ...manifestCards.map((card) => [card.id, card.lane, card.status, card.eyebrow, card.title.join(' '), card.body, ...card.facts, card.post, card.xCharacterCount, card.source, card.art, card.png].map(csv).join(','))].join('\n') + '\n');
await writeFile(join(docsRoot, 'PUBLISHING-PLAN.md'), buildPublishingPlan());
await writeFile(join(docsRoot, 'PUBLISHING-CALENDAR.csv'), buildCalendar());
await writeFile(join(here, 'gallery.html'), buildGallery());
await writeFile(join(here, 'gallery-phone.html'), buildGallery({ imageRoot: 'cards', extension: 'jpg', sheetRoot: 'contact-sheets' }));
await writeFile(join(here, 'manifest.json'), `${JSON.stringify({ schemaVersion: 1, buildDate, counts: { lanes: lanes.length, cards: cards.length }, lanes, generatedImagePrompts, cards: manifestCards }, null, 2)}\n`);

for (const image of ['production-economy-foundry.png', 'content-desk-evidence-room.png', 'living-city-system-map.png']) {
  await copyFile(join(here, 'art', image), join(pngRoot, `editorial-${image}`));
}

console.log(JSON.stringify({
  cards: cards.length,
  lanes: lanes.length,
  pngCards: manifestCards.length,
  xCopyCharacters: { min: Math.min(...cards.map((card) => card.post.length)), max: Math.max(...cards.map((card) => card.post.length)) },
  outputs: { pngRoot, svgRoot, sheetRoot, docsRoot, gallery: join(here, 'gallery.html') },
}, null, 2));
