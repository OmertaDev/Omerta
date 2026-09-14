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
