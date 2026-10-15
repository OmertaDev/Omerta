// Reader-facing copy stays current while technical route and artifact identifiers remain intact.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(path, 'utf8');
const home = read('public/index.html');
const wiki = read('public/wiki.html');
const markdown = read('docs/WIKI.md');
const sections = vm.runInNewContext(wiki.slice(wiki.indexOf('const R ='), wiki.indexOf('const GROUP_ORDER')) + '\nSECTIONS;');
const plain = (s) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
const retired = /\b(?:Agent Turn v\d|Sixth Chair v\d|Paths v\d|Grill v\d|The v\d\s+(?:Press Room|Material Exchange|apprenticeship)|V1 accepts|modified (?:OHM|Olympus)-style|committing halves|(?:always get your|Your) full principal)\b/i;

for (const section of sections) {
  assert(!retired.test(plain(section.title + ' ' + section.html)), `Retired copy in Codex: ${section.id}`);
}
assert(!retired.test(plain(home)), 'Landing copy contains a retired release claim');
assert(!retired.test(markdown), 'Markdown Codex contains a retired release claim');
for (const id of ['canonical-market', 'coordination', 'worldgraph']) {
  const section = sections.find((s) => s.id === id);
  assert(section, `Missing ${id} entry`);
  const summary = section.html.match(/^<p>(.*?)<\/p>/s)[1];
  assert(home.includes(summary) && markdown.includes(summary), `${id} status differs between site and Codex`);
}
// Current market copy binds to the fixed manager/Hook source, independently of legacy game levers.
const manager = read('omerta-contracts/src/market-v2/core/OmertaPoolManagerV2.sol');
const hook = read('omerta-contracts/src/market-v2/OmertaHookV2.sol');
const fee = manager.match(/uint16 public constant TRADE_FEE_BPS = (\d+);/);
const surge = hook.match(/uint16 public constant MAX_SURGE_BPS = (\d+);/);
assert(fee && surge, 'Current fixed market fee constants must remain discoverable');
const basePercent = Number(fee[1]) / 100, surgePercent = Number(surge[1]) / 100;
const currentMarket = sections.find(section => section.id === 'canonical-market');
const fixedPolicy = sections.find(section => section.id === 'committee-tax');
assert(fixedPolicy, 'Existing fixed-policy anchor must remain available');
const surfaces = [home.match(/<h3>The Canonical Market<\/h3>([\s\S]*?)<\/article>/)[1],
  currentMarket.html, markdown.slice(markdown.indexOf('### The Canonical Market'), markdown.indexOf('**Currencies:**')),
  read('public/defi.html').match(/<p>The current source configures([\s\S]*?)<\/p>/)[0],
  read('public/fee-flows.html').match(/<div class="scenario-notice"><b>This is an illustrative scenario([\s\S]*?)<\/div>/)[0]];
for (const surface of surfaces.map(plain)) {
  assert(surface.includes(`fixed ${basePercent}% base`) && surface.includes('buys and sells'), 'Both trade directions must disclose the manager fee');
  assert(surface.includes(`${surgePercent}%`), 'Sell-pressure cap must match Hook source');
  assert(surface.includes('2%') && surface.includes('1%'), 'Developer and other allocation shares must be disclosed');
  assert(surface.includes('planned genesis pool') && surface.includes('0.3%'), 'LP/opening terms must be scoped to the planned genesis pool');
  assert(/opening buy charges and caps (?:are )?disabled/.test(surface), 'Genesis opening restrictions remain off');
  assert(/no Committee or Safe fee-change queue|cannot become an executable Committee or Safe fee-change proposal/.test(surface), 'No mutable fee-governance process may be advertised');
  assert(!/9% base|1\.6% RWA|2\.4% community|0[–-]1% surge|48.hours|10% hook-tax/.test(surface), 'Superseded fee policy must not appear in current policy sections');
  assert(surface.includes('inactive'), 'Source policy must not imply production activation');
}
assert(!/queues an exact configuration|waits at least 48 hours/.test(plain(fixedPolicy.html)), 'The preserved policy anchor cannot promise a fee-change queue');
const ids = new Set(sections.map((s) => s.id));
assert.equal(ids.size, sections.length, 'Codex section IDs must be unique');
for (const [, id] of home.matchAll(/href="\/wiki#([^"?]+)"/g)) {
  assert(ids.has(id), `Landing links to missing Codex entry: ${id}`);
}
const rules = read('src/rules.tail.js');
assert.match(rules, /OMR_LOOT_IDLE:\s*0\.50,\s*OMR_LOOT_COMMITTED:\s*0\.20/);
assert.match(rules, /UNSTAKE_CD_MS:\s*6\*3600\*1000/);
for (const source of [home, markdown, sections.find((s) => s.id === 'economy').html]) {
  assert.match(plain(source), /50%.*20%/s, 'Staking must disclose both loss rates');
  assert.match(plain(source), /(?:six|6).{0,25}hours?/i, 'Staking must disclose the unbonding delay');
}
for (const file of ['public/index.html', 'public/wiki.html', 'public/defi.html', 'public/fee-flows.html']) {
  for (const [, attributes, script] of read(file).matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/application\/ld\+json/.test(attributes)) JSON.parse(script);
    else if (!/\bsrc=|type="module"/.test(attributes)) new vm.Script(script, { filename: file });
  }
}
console.log('Current copy: shared system status, Codex links, staking rules, release labels and inline scripts passed.');
