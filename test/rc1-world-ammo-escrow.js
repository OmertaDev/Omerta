import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WORLD_RESOURCE_TABLES, reconcileWorldResources } from '../tools/rc1-world-resource-observer.js';
import { reconcilePressureResources } from '../tools/rc1-resource-pressure-journal.js';
import { verifyArtifactIndex, sourceIdentity, canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { exactSum, negate } from '../tools/rc1-resource-journal.js';

const empty = () => ({ format: 1, tables: Object.fromEntries(WORLD_RESOURCE_TABLES.map(table => [table, []])) });
const before = empty();
before.tables.characters = ['seller', 'buyer', 'other'].map(id => ({ id, account_id: `account-${id}`, alive: true, cash: '1000', bank: '0', ammo: 25, cb: 0 }));
before.tables.street_tax = [{ id: 1, pool: '0', fund: '0' }];
const listed = structuredClone(before); listed.tables.characters[0].ammo = 15;
listed.tables.listings = [{ id: 'lot', seller_character: 'seller', item_kind: 'ammo', item_id: 'ammo', qty: 10, unit_price: '20', created_at: '2026-09-20T12:00:00.000Z' }];
const bought = structuredClone(listed); bought.tables.listings = []; bought.tables.characters[1].ammo = 35;
bought.tables.characters[0].cash = '1196'; bought.tables.characters[1].cash = '800'; bought.tables.street_tax[0].pool = '2';
bought.tables.transactions = [
  { id: 'buy', character_id: 'buyer', account_id: null, currency: 'cash', amount: '-200', reason: 'exchange:buy', counterparty: 'seller' },
  { id: 'sale', character_id: 'seller', account_id: null, currency: 'cash', amount: '196', reason: 'exchange:sale', counterparty: 'buyer' },
];
for (const [name, a, b, kind] of [['list', before, listed, 'ammo-list'], ['buy', listed, bought, 'ammo-buy'], ['cancel', listed, before, 'ammo-cancel']]) {
  const result = reconcileWorldResources(a, b); assert.equal(result.status, 'PASS_SCOPED_PARITY', name);
  assert.equal(result.ammoEscrow.movements.length, 1); assert.equal(result.ammoEscrow.movements[0].kind, kind);
  assert.equal(result.checks.filter(row => row.kind === 'personal-and-owned-ammo-escrow').length, 3);
}
assert.equal(reconcileWorldResources(bought, bought).ammoEscrow.movements.length, 0, 'Exact replay is no-value');
const tinyListed = structuredClone(listed); tinyListed.tables.listings[0].qty = 1; tinyListed.tables.listings[0].unit_price = '1'; tinyListed.tables.characters[0].ammo = 24;
const tinyBought = structuredClone(bought); tinyBought.tables.characters[0].ammo = 24; tinyBought.tables.characters[1].ammo = 26;
tinyBought.tables.characters[0].cash = '1000'; tinyBought.tables.characters[1].cash = '999'; tinyBought.tables.street_tax[0].pool = '1';
tinyBought.tables.transactions[0].amount = '-1'; tinyBought.tables.transactions[1].amount = '0';
assert.equal(reconcileWorldResources(tinyListed, tinyBought).ammoEscrow.movements[0].sink, '0', 'Tiny lot never debits seller');
const controls = [];
function reject(name, a, b, mutate) {
  const input = { before: structuredClone(a), after: structuredClone(b) }; mutate(input);
  let error; try { reconcileWorldResources(input.before, input.after); } catch (caught) { error = caught.message; }
  assert(error, `${name} escaped shared observer`); controls.push({ name, rejected: true }); return { name, ...input, rejection: error };
}
reject('balanced-wrong-owner-ammo', listed, bought, input => { input.after.tables.characters[1].ammo--; input.after.tables.characters[2].ammo++; });
reject('wrong-buyer-counterparty', listed, bought, input => { input.after.tables.transactions[0].counterparty = 'other'; });
reject('wrong-seller-counterparty', listed, bought, input => { input.after.tables.transactions[1].counterparty = 'other'; });
reject('duplicate-buy-id', listed, bought, input => { input.after.tables.transactions.push(structuredClone(input.after.tables.transactions[0])); });
reject('duplicate-buy-new-id', listed, bought, input => { input.after.tables.transactions.push({ ...input.after.tables.transactions[0], id: 'duplicate-buy' }); });
reject('duplicate-sale-new-id', listed, bought, input => { input.after.tables.transactions.push({ ...input.after.tables.transactions[1], id: 'duplicate-sale' }); });
reject('stale-receipts', listed, bought, input => { input.before.tables.transactions = structuredClone(input.after.tables.transactions); });
reject('same-receipts-for-two-lots', listed, bought, input => { input.before.tables.listings.push({ ...input.before.tables.listings[0], id: 'another-lot' }); });
reject('missing-sale-receipt', listed, bought, input => { input.after.tables.transactions.pop(); });
reject('rewritten-old-receipt', bought, bought, input => { input.after.tables.transactions[0].amount = '-199'; });
reject('receipt-without-consumed-lot', before, bought, input => { input.before.tables.listings = []; });
reject('retained-lot-owner-rewrite', listed, listed, input => { input.after.tables.listings[0].seller_character = 'other'; });
reject('listed-to-foreign-escrow-balanced', before, listed, input => { input.after.tables.listings[0].seller_character = 'other'; });
reject('cancel-to-foreign-owner', listed, before, input => { input.after.tables.characters[0].ammo = 15; input.after.tables.characters[2].ammo = 35; });
reject('tax-destination-missing', listed, bought, input => { input.after.tables.street_tax[0].pool = '0'; });
reject('unknown-escrow-owner', before, listed, input => { input.after.tables.listings[0].seller_character = 'absent'; });
const otherListing = structuredClone(before); otherListing.tables.listings.push({ id: 'outside', seller_character: 'seller', item_kind: 'item', item_id: 'unsupported', qty: 1, unit_price: '1' });
assert(reconcileWorldResources(before, otherListing).unsupported.some(row => row.table === 'listings'), 'Other escrow must stay unsupported');
const unrelated = structuredClone(before); unrelated.tables.season_records.push({ season: 1 });
assert(reconcileWorldResources(before, unrelated).unsupported.some(row => row.table === 'season_records'), 'Unrelated gaps cannot disappear');

const evidence = process.argv.find(value => value.startsWith('--evidence='))?.slice(11);
if (evidence) {
  const pureControls = structuredClone(controls);
  const directory = path.resolve(evidence), currentSource = await sourceIdentity();
  const run = JSON.parse(await fs.readFile(path.join(directory, 'run.json'), 'utf8')); await verifyArtifactIndex(directory, run);
  assert.deepEqual(run.source, currentSource, 'Native proof must use exact clean checked source'); assert.equal(run.status, 'PASS_SCOPED');
  assert.equal(run.result.sharedObserverEscrowLimitations, 0, 'Legacy catch cannot conceal shared observer rejection');
  const native = { boundaries: 0, movements: {}, unsupported: {}, controls: [] }; let buyInput, listInput, cancelInput;
  for (const artifact of run.artifacts.filter(row => /^resource-\d+\.json$/.test(row.path))) {
    const input = JSON.parse(await fs.readFile(path.join(directory, artifact.path), 'utf8'));
    const journal = reconcileWorldResources(input.before, input.after, { identity: { label: input.label }, includeRestrictedChanges: true });
    assert.equal(journal.beforeHash, input.shared.beforeHash); assert.equal(journal.afterHash, input.shared.afterHash);
    reconcilePressureResources(input.before, input.after, { command: input.command }); // Independent exact HTTP/response binding.
    native.boundaries++;
    for (const movement of journal.ammoEscrow.movements) {
      native.movements[movement.kind] = (native.movements[movement.kind] || 0) + 1;
      if (movement.kind === 'ammo-buy') buyInput = input;
      if (movement.kind === 'ammo-list') listInput = input;
      if (movement.kind === 'ammo-cancel') cancelInput = input;
    }
    for (const row of journal.unsupported) { const key = `${row.kind}:${row.reason || row.table || ''}`; native.unsupported[key] = (native.unsupported[key] || 0) + 1; }
  }
  assert(buyInput && listInput && cancelInput, 'Each native pressure probe must execute list, buy and cancel');
  const buyer = buyInput.command.actorId, seller = buyInput.before.tables.listings.find(row => buyInput.command.path === `/v1/exchange/${row.id}/buy`).seller_character;
  const third = buyInput.before.tables.characters.find(row => ![buyer, seller].includes(row.id)).id;
  const fresh = input => input.after.tables.transactions.filter(row => !input.before.tables.transactions.some(prior => prior.id === row.id));
  native.controls.push(reject('native-balanced-wrong-owner', buyInput.before, buyInput.after, input => {
    const from = input.after.tables.characters.find(row => row.id === buyer), to = input.after.tables.characters.find(row => row.id === third);
    from.ammo = exactSum([from.ammo, '-1']); to.ammo = exactSum([to.ammo, '1']);
  }));
  native.controls.push(reject('native-duplicate-fresh-buy', buyInput.before, buyInput.after, input => {
    input.after.tables.transactions.push({ ...fresh(input).find(row => row.reason === 'exchange:buy'), id: 'counterfactual-duplicate-buy' });
  }));
  native.controls.push(reject('native-stale-receipt-reuse', buyInput.before, buyInput.after, input => {
    input.before.tables.transactions.push(...structuredClone(fresh(input).filter(row => ['exchange:buy', 'exchange:sale'].includes(row.reason))));
  }));
  native.controls.push(reject('native-wrong-counterparty', buyInput.before, buyInput.after, input => { fresh(input).find(row => row.reason === 'exchange:sale').counterparty = third; }));
  native.controls.push(reject('native-list-wrong-owner', listInput.before, listInput.after, input => {
    const lot = input.after.tables.listings.find(row => !input.before.tables.listings.some(prior => prior.id === row.id));
    lot.seller_character = input.after.tables.characters.find(row => row.id !== lot.seller_character).id;
  }));
  native.controls.push(reject('native-cancel-wrong-owner', cancelInput.before, cancelInput.after, input => {
    const lot = input.before.tables.listings.find(row => !input.after.tables.listings.some(next => next.id === row.id));
    const from = input.after.tables.characters.find(row => row.id === lot.seller_character), to = input.after.tables.characters.find(row => row.id !== from.id);
    from.ammo = exactSum([from.ammo, negate(lot.qty)]); to.ammo = exactSum([to.ammo, lot.qty]);
  }));
  const terminal = JSON.parse(await fs.readFile(path.join(directory, 'terminal-native-corruption.json'), 'utf8'));
  assert.throws(() => reconcileWorldResources(terminal.before, terminal.after), /Unexplained ammo/);
  native.controls.push({ name: 'actual-native-terminal-balanced-wrong-owner', before: terminal.before, after: terminal.after, rejected: true });
  const report = { status: 'PASS_SCOPED', source: currentSource, scenario: run.result.scenario, nativeRunSha256: sha256(await fs.readFile(path.join(directory, 'run.json'))),
    pureControls, native, qualifyingFullResourcePass: false,
    exclusions: ['HTTP/response binding supplied separately by focused pressure journal; shared observer has no durable request identity',
      'Non-ammo escrow, death/retirement and ambiguous compound trades, broader creation/destruction taxonomy', 'Actual concurrent market transactions, full resource matrix, deployment and external backing'] };
  const output = path.resolve(process.env.RC1_AMMO_OBSERVER_OUTPUT || `${directory}-shared-ammo-verification.json`);
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, source: currentSource.revision, scenario: report.scenario,
    boundaries: native.boundaries, movements: native.movements, nativeControls: native.controls.length, unsupported: native.unsupported,
    report: output, reportCanonicalSha256: sha256(canonicalJson(report)), qualifyingFullResourcePass: false }));
} else console.log(JSON.stringify({ status: 'PASS_SCOPED', pureCorruptionControls: controls.length, qualifiers: ['Synthetic inputs only; native invocation requires --evidence=<fresh pressure run>'], qualifyingFullResourcePass: false }));
