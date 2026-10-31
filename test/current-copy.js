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
const constant = (source, name) => {
  const value = source.match(new RegExp(`uint16 (?:public|private) constant ${name} = (\\d+);`));
  assert(value, `Current fixed ${name} must remain discoverable`);
  return Number(value[1]);
};
const baseBps = constant(manager, 'BASE_FEE_BPS');
const rewardsBps = constant(manager, 'REWARDS_BPS');
const totalBps = constant(manager, 'TRADE_FEE_BPS');
const surgeBps = constant(hook, 'MAX_SURGE_BPS');
assert.equal(totalBps, baseBps + rewardsBps, 'Manager total separates base and holder rewards');
assert.equal(constant(hook, 'BASE_SELL_BPS'), baseBps);
assert.equal(constant(hook, 'REWARDS_BPS'), rewardsBps);
assert.equal(constant(manager, 'MAX_HOOK_FEE_BPS'), surgeBps);
assert.equal(constant(hook, 'MAX_HOOK_BPS'), totalBps + surgeBps);
const allocation = (name) => {
  const value = manager.match(new RegExp(`uint256 ${name} = base \\* (\\d+) / BASE_FEE_BPS;`));
  assert(value, `Missing fixed ${name} allocation`);
  return Number(value[1]);
};
const developerBps = allocation('developer'), rwaBps = allocation('rwa'), communityBps = allocation('community');
const polBps = baseBps - developerBps - rwaBps - communityBps;
assert.deepEqual([baseBps, rewardsBps, totalBps, surgeBps], [350, 50, 400, 50], 'Approved trading policy');
assert.deepEqual([developerBps, rwaBps, communityBps, polBps], [127, 51, 76, 96], 'Approved proportional base split');
assert.match(manager, /owed\[currency\]\[3\] \+= base - developer - rwa - community;/, 'POL receives base rounding remainder');
const basePercent = baseBps / 100, rewardsPercent = rewardsBps / 100;
const totalPercent = totalBps / 100, surgePercent = surgeBps / 100, maximumPercent = (totalBps + surgeBps) / 100;
const feeFlows = read('public/fee-flows.html');
const currentMarket = sections.find(section => section.id === 'canonical-market');
const fixedPolicy = sections.find(section => section.id === 'committee-tax');
assert(fixedPolicy, 'Existing fixed-policy anchor must remain available');
const surfaces = [home.match(/<h3>The Canonical Market<\/h3>([\s\S]*?)<\/article>/)[1],
  currentMarket.html, markdown.slice(markdown.indexOf('### The Canonical Market'), markdown.indexOf('#### Genesis auction')),
  read('public/defi.html').match(/<p>The current source configures([\s\S]*?)<\/p>/)[0],
  feeFlows.match(/<div class="scenario-notice"><b>This is an illustrative scenario([\s\S]*?)<\/div>/)[0]];
for (const surface of surfaces.map(plain)) {
  assert(surface.includes(`fixed ${basePercent}% base`) && surface.includes('buys and sells'), 'Both trade directions must disclose the manager fee');
  assert(surface.includes(`separate ${rewardsPercent}% allocation`) || surface.includes(`separate ${rewardsPercent}% allocation`.replace('separate', 'Separate')), 'Holder rewards must be separate from the base');
  assert(surface.includes('WBTC holder rewards') && surface.includes(`ordinary protocol charge ${totalPercent}%`), 'Ordinary trading cost includes funded holder rewards');
  assert(surface.includes(`capped at ${surgePercent}%`) || surface.includes(`at most ${surgePercent}%`), 'Sell-pressure cap must match Hook source');
  assert(surface.includes(`maximum protocol charge of ${maximumPercent}%`), 'Maximum includes base, holder rewards and surge');
  assert(surface.includes('LP fees and network gas are additional'), 'LP fees and gas are outside the protocol charge');
  for (const [bps, label] of [[developerBps, 'developer'], [rwaBps, 'RWA'], [communityBps, 'community'], [polBps, '(?:POL|protocol-owned liquidity)']]) {
    const percent = String(bps / 100).replace('.', '\\.');
    assert(new RegExp(`${percent}% (?:to (?:the )?)?${label}`, 'i').test(surface), `Missing ${bps}-bps ${label} allocation`);
  }
  assert(surface.includes('planned genesis pool') && surface.includes('0.3%'), 'LP/opening terms must be scoped to the planned genesis pool');
  assert(/opening buy charges and caps (?:are )?disabled/.test(surface), 'Genesis opening restrictions remain off');
  assert(/no Committee or Safe fee-change queue|cannot become an executable Committee or Safe fee-change proposal/.test(surface), 'No mutable fee-governance process may be advertised');
  assert(!/fixed [45]% base|(?:^|\s)2% (?:to the )?developer|9% base|1\.6% RWA|2\.4% community|0[–-]1% surge|48.hours|10% hook-tax/.test(surface), 'Superseded fee policy must not appear in current policy sections');
  assert(surface.includes('inactive'), 'Source policy must not imply production activation');
}
assert(!/queues an exact configuration|waits at least 48 hours/.test(plain(fixedPolicy.html)), 'The preserved policy anchor cannot promise a fee-change queue');
assert(plain(fixedPolicy.html).includes(`ordinary protocol charge ${totalPercent}%`) && plain(fixedPolicy.html).includes('time-weighted eligible wallet and backed game balances'), 'Fixed policy must explain funded holder periods');
// The editor's ordinary-fee defaults use exact shares of the complete 400-bps allocation.
const scenarioSources = JSON.parse(JSON.stringify(vm.runInNewContext(feeFlows.slice(feeFlows.indexOf('const LIVE ='), feeFlows.indexOf('/* Destination catalogue')) + '\nLIVE;')));
const scenarioTax = scenarioSources.find(source => source.id === 'tax');
assert(scenarioTax.name.includes(`${totalPercent}% of settled fee leg`));
assert.deepEqual(scenarioTax.splits.map(split => [split.dest, split.bps]), [
  ['operations', developerBps * 10_000 / totalBps], ['treasury', rwaBps * 10_000 / totalBps],
  ['community', communityBps * 10_000 / totalBps], ['pol', polBps * 10_000 / totalBps],
  ['wbtc-rewards', rewardsBps * 10_000 / totalBps],
]);
assert.equal(scenarioTax.splits.reduce((sum, split) => sum + split.bps, 0), 10_000);
// Existing scenario versions must show the updated baseline; current user edits remain recoverable.
const scenarioLoad = feeFlows.slice(feeFlows.indexOf('const SEED_VERSION ='), feeFlows.indexOf('/* ── theme ── */'));
const restoreScenario = saved => JSON.parse(JSON.stringify(vm.runInNewContext(scenarioLoad + '\n({model, staleLocal, hasLocalEdits, seed: SEED_VERSION});', {
  LIVE: scenarioSources, structuredClone, localStorage: { getItem: () => JSON.stringify(saved) },
})));
const staleScenario = restoreScenario({ _seedVersion: 7, model: [{ id: 'tax', name: 'Previous saved scenario', splits: [] }] });
assert(staleScenario.staleLocal && !staleScenario.hasLocalEdits, 'Changed defaults must flag older saved scenarios');
assert.deepEqual(staleScenario.model.find(source => source.id === 'tax'), scenarioTax);
const editedScenario = [{ id: 'tax', name: 'My local scenario', splits: [] }];
assert.deepEqual(restoreScenario({ _seedVersion: staleScenario.seed, model: editedScenario }).model, editedScenario, 'Current local edits must survive reload');
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
