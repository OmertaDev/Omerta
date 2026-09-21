import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { WORLD_RESOURCE_TABLES, reconcileWorldResources } from '../tools/rc1-world-resource-observer.js';
import { verifyArtifactIndex, sourceIdentity, sha256 } from '../tools/rc1-native-proof.js';
import { exactSum, negate } from '../tools/rc1-resource-journal.js';
import { dayOf, CONSTANTS } from '../src/rules.js';
const at = '2026-09-20T12:00:00.000Z', today = dayOf(Date.parse(at));
const before = { format: 1, tables: Object.fromEntries(WORLD_RESOURCE_TABLES.map(table => [table, []])) };
before.tables.characters = ['one', 'two'].map(id => ({ id, account_id: `account-${id}`, alive: true, cash: '5000', bank: '100', ammo: 25, cb: 0,
  respect: '0', streak: 0, checkin_day: 0, bank_intransit: '0', bank_intransit_at: null, safe_until: null }));
before.tables.account_persistent = ['one', 'two'].map(id => ({ account_id: `account-${id}`, checkins_lifetime: 0, omr: '0', staked: '0', unbonding: '0' }));
before.tables.street_tax = [{ id: 1, pool: '17', fund: '0' }];
before.tables.exchange_pool = [{ id: 1, balance: '23', lifetime_funded: '23', lifetime_paid: '0' }];
const receipt = (id, currency, amount, reason) => ({ id, character_id: 'one', account_id: null, counterparty: null, currency, amount, reason, at });
const checkin = structuredClone(before); Object.assign(checkin.tables.characters[0], { cash: '5350', streak: 1, checkin_day: today });
checkin.tables.account_persistent[0].checkins_lifetime = 1; checkin.tables.transactions = [receipt('checkin', 'cash', '350', 'checkin')];
const ammo = structuredClone(before); Object.assign(ammo.tables.characters[0], { cash: '3000', ammo: 75 });
ammo.tables.transactions = [receipt('cost', 'cash', '-2000', 'ammo:buy'), receipt('rounds', 'ammo', '50', 'ammo:buy')];
const bank = structuredClone(before); Object.assign(bank.tables.characters[0], { cash: '4500', bank: '600', bank_intransit: '500', bank_intransit_at: at });
bank.tables.transactions = [receipt('deposit', 'cash', '0', 'bank:deposit:500')];
for (const [name, state] of [['checkin', checkin], ['armory-ammo', ammo], ['bank-deposit', bank]]) {
  const journal = reconcileWorldResources(before, state); assert.equal(journal.status, 'PASS_SCOPED_PARITY');
  assert.equal(journal.pressureCash.movements[0].kind, name); assert.equal(reconcileWorldResources(state, state).pressureCash.movements.length, 0);
}
const lapseBefore = structuredClone(before), lapseAfter = structuredClone(checkin);
lapseBefore.tables.characters[0].streak = 6; lapseBefore.tables.characters[0].checkin_day = today - 3;
Object.assign(lapseAfter.tables.characters[0], { streak: 3, cash: '5550' }); lapseAfter.tables.transactions[0].amount = '550';
assert.equal(reconcileWorldResources(lapseBefore, lapseAfter).pressureCash.movements[0].cashCreated, '550');
const continuingBefore = structuredClone(before), continuingAfter = structuredClone(checkin);
continuingBefore.tables.characters[0].streak = 7; continuingBefore.tables.characters[0].checkin_day = today - 1;
Object.assign(continuingAfter.tables.characters[0], { streak: 8, cash: '5950' }); continuingAfter.tables.transactions[0].amount = '950';
assert.equal(reconcileWorldResources(continuingBefore, continuingAfter).pressureCash.movements[0].cashCreated, '950');
const clearBefore = structuredClone(before); clearBefore.tables.characters[0].bank_intransit = '100';
clearBefore.tables.characters[0].bank_intransit_at = new Date(Date.parse(at) - CONSTANTS.BANK_CLEAR_MS).toISOString();
assert.equal(reconcileWorldResources(clearBefore, bank).pressureCash.movements[0].clearedPriorTransit, true);
const joinBefore = structuredClone(clearBefore), joinAfter = structuredClone(bank);
joinBefore.tables.characters[0].bank_intransit_at = new Date(Date.parse(at) - CONSTANTS.BANK_CLEAR_MS + 1).toISOString();
joinAfter.tables.characters[0].bank_intransit = '600';
assert.equal(reconcileWorldResources(joinBefore, joinAfter).pressureCash.movements[0].clearedPriorTransit, false);
const controls = [];
function reject(name, a, b, mutate) {
  const input = { before: structuredClone(a), after: structuredClone(b) }; mutate?.(input);
  let rejection; try { reconcileWorldResources(input.before, input.after); } catch (error) { rejection = error.message; }
  assert(rejection, `${name} escaped`); const result = { name, ...input, rejection }; controls.push({ name, rejected: true }); return result;
}
reject('checkin-overpay-balanced-with-receipt', before, checkin, input => { input.after.tables.transactions[0].amount = '351'; input.after.tables.characters[0].cash = '5351'; });
reject('checkin-wrong-owner', before, checkin, input => { input.after.tables.transactions[0].character_id = 'two'; });
reject('checkin-missing-latch', before, checkin, input => { input.after.tables.characters[0].checkin_day = 0; });
reject('checkin-wrong-account-counter', before, checkin, input => { input.after.tables.account_persistent[0].checkins_lifetime = 0; input.after.tables.account_persistent[1].checkins_lifetime = 1; });
reject('checkin-duplicate-new-id', before, checkin, input => { input.after.tables.transactions.push({ ...input.after.tables.transactions[0], id: 'another' }); });
reject('checkin-stale-day', before, checkin, input => { input.before.tables.characters[0].checkin_day = today; });
reject('checkin-stale-receipt', before, checkin, input => { input.before.tables.transactions = structuredClone(input.after.tables.transactions); });
reject('armory-wrong-price-balanced', before, ammo, input => { input.after.tables.transactions[0].amount = '-1999'; input.after.tables.characters[0].cash = '3001'; });
reject('armory-wrong-quantity-balanced', before, ammo, input => { input.after.tables.transactions[1].amount = '51'; input.after.tables.characters[0].ammo = 76; });
reject('armory-missing-cash-reciprocal', before, ammo, input => { input.after.tables.transactions.shift(); });
reject('armory-missing-ammo-reciprocal', before, ammo, input => { input.after.tables.transactions.pop(); });
reject('armory-wrong-owner-rounds', before, ammo, input => { input.after.tables.transactions[1].character_id = 'two'; });
reject('armory-missing-delivery', before, ammo, input => { input.after.tables.characters[0].ammo = 25; });
reject('armory-duplicate-pair', before, ammo, input => { input.after.tables.transactions.push(...input.after.tables.transactions.map(row => ({ ...row, id: `duplicate-${row.id}` }))); });
reject('armory-stale-pair', before, ammo, input => { input.before.tables.transactions = structuredClone(input.after.tables.transactions); });
reject('bank-wrong-marker-amount', before, bank, input => { input.after.tables.transactions[0].reason = 'bank:deposit:501'; });
reject('bank-nonzero-mint-receipt', before, bank, input => { input.after.tables.transactions[0].amount = '1'; });
reject('bank-wrong-owner', before, bank, input => { input.after.tables.transactions[0].character_id = 'two'; });
reject('bank-missing-bank-credit', before, bank, input => { input.after.tables.characters[0].bank = '100'; });
reject('bank-missing-cash-debit', before, bank, input => { input.after.tables.characters[0].cash = '5000'; });
reject('bank-missing-transit', before, bank, input => { input.after.tables.characters[0].bank_intransit = '0'; });
reject('bank-duplicate-receipt', before, bank, input => { input.after.tables.transactions.push({ ...input.after.tables.transactions[0], id: 'duplicate' }); });
reject('bank-stale-receipt', before, bank, input => { input.before.tables.transactions = structuredClone(input.after.tables.transactions); });
reject('pool-diversion', before, ammo, input => { input.after.tables.exchange_pool[0].balance = '2023'; input.after.tables.exchange_pool[0].lifetime_funded = '2023'; });
reject('tax-diversion', before, checkin, input => { input.after.tables.street_tax[0].pool = '18'; });
const unknown = structuredClone(before); unknown.tables.transactions = [receipt('unclassified', 'cash', '0', 'bank:withdraw:500')];
assert(reconcileWorldResources(before, unknown).unsupported.some(row => row.reason === 'bank:withdraw:500'));

function bindCommand(input, movement) {
  const command = input.command; assert(command && command.status === 200 && !command.replayed && command.method === 'POST');
  assert.equal(command.actorId, movement.characterId, 'Receipt owner differs from actual authorized actor');
  if (movement.kind === 'checkin') {
    assert.equal(command.path, '/v1/checkin'); assert.equal(String(command.response.pay), movement.cashCreated); assert.equal(command.response.streak, movement.streak);
  } else if (movement.kind === 'armory-ammo') {
    assert.equal(command.path, '/v1/armory/ammo'); assert.equal(command.response.cost, 2000); assert.equal(command.response.rolled, 50);
  } else {
    assert.equal(command.path, '/v1/bank/deposit'); assert.equal(String(Math.floor(Number(command.body.amount))), movement.amount, 'Deposit differs from requested floored amount');
    assert.equal(String(command.response.banked), movement.amount); assert.equal(command.response.clearSeconds, Math.ceil(CONSTANTS.BANK_CLEAR_MS / 1000));
  }
}
const evidence = process.argv.find(value => value.startsWith('--evidence='))?.slice(11);
if (evidence) {
  const pureControls = structuredClone(controls), source = await sourceIdentity(), directory = path.resolve(evidence);
  const run = JSON.parse(await fs.readFile(path.join(directory, 'run.json'), 'utf8')); await verifyArtifactIndex(directory, run);
  assert.deepEqual(run.source, source); assert.equal(run.status, 'PASS_SCOPED'); assert.equal(run.result.sharedObserverEscrowLimitations, 0);
  let boundaries = 0; const movements = {}, retained = new Map(), unsupported = {}, nativeControls = [];
  for (const artifact of run.artifacts.filter(row => /^resource-\d+\.json$/.test(row.path))) {
    const input = JSON.parse(await fs.readFile(path.join(directory, artifact.path), 'utf8'));
    const result = reconcileWorldResources(input.before, input.after, { identity: { label: input.label } }); boundaries++;
    for (const movement of result.pressureCash.movements) { bindCommand(input, movement); retained.set(movement.kind, input); movements[movement.kind] = (movements[movement.kind] || 0) + 1; }
    for (const row of result.unsupported) { const key = `${row.kind}:${row.reason || row.table || ''}`; unsupported[key] = (unsupported[key] || 0) + 1; }
  }
  assert.equal(movements.checkin, 3); assert.equal(movements['armory-ammo'], run.result.scenario === 'resource_scarcity' ? 1 : 9);
  assert.equal(movements['bank-deposit'] || 0, run.result.scenario === 'resource_scarcity' ? 0 : 3);
  const fresh = input => input.after.tables.transactions.filter(row => !input.before.tables.transactions.some(old => old.id === row.id));
  for (const [kind, input] of retained) {
    const owner = input.command.actorId, other = input.before.tables.characters.find(row => row.id !== owner).id;
    nativeControls.push(reject(`native-${kind}-wrong-owner`, input.before, input.after, value => { fresh(value).find(row => kind === 'checkin' ? row.reason === 'checkin' : kind === 'armory-ammo' ? row.reason === 'ammo:buy' : row.reason.startsWith('bank:deposit:')).character_id = other; }));
    nativeControls.push(reject(`native-${kind}-duplicate`, input.before, input.after, value => { const row = fresh(value).find(row => kind === 'checkin' ? row.reason === 'checkin' : kind === 'armory-ammo' ? row.reason === 'ammo:buy' : row.reason.startsWith('bank:deposit:')); value.after.tables.transactions.push({ ...row, id: `duplicate-${kind}` }); }));
    nativeControls.push(reject(`native-${kind}-stale`, input.before, input.after, value => { value.before.tables.transactions.push(...structuredClone(fresh(value))); }));
    const wrongCommand = structuredClone(input); wrongCommand.command.actorId = other;
    const movement = reconcileWorldResources(input.before, input.after).pressureCash.movements.find(row => row.kind === kind);
    assert.throws(() => bindCommand(wrongCommand, movement)); nativeControls.push({ name: `native-${kind}-wrong-authorized-actor`, input: wrongCommand, rejected: true });
  }
  const checkedIn = retained.get('checkin');
  nativeControls.push(reject('native-checkin-balanced-overpay', checkedIn.before, checkedIn.after, value => {
    const row = fresh(value).find(row => row.reason === 'checkin'); row.amount = exactSum([row.amount, '1']);
    const owner = value.after.tables.characters.find(ch => ch.id === row.character_id); owner.cash = exactSum([owner.cash, '1']);
  }));
  const armed = retained.get('armory-ammo');
  nativeControls.push(reject('native-armory-missing-reciprocal', armed.before, armed.after, value => { const row = fresh(value).find(row => row.currency === 'ammo' && row.reason === 'ammo:buy'); value.after.tables.transactions = value.after.tables.transactions.filter(item => item.id !== row.id); }));
  if (retained.has('bank-deposit')) {
    const deposited = retained.get('bank-deposit'), movement = reconcileWorldResources(deposited.before, deposited.after).pressureCash.movements[0];
    nativeControls.push(reject('native-bank-missing-reciprocal', deposited.before, deposited.after, value => {
      const owner = value.after.tables.characters.find(ch => ch.id === deposited.command.actorId); owner.bank = exactSum([owner.bank, negate(movement.amount)]);
    }));
    const wrong = structuredClone(deposited); wrong.command.body.amount++;
    assert.throws(() => bindCommand(wrong, movement)); nativeControls.push({ name: 'native-bank-wrong-requested-amount', input: wrong, rejected: true });
  }
  const report = { status: 'PASS_SCOPED', source, scenario: run.result.scenario, nativeRunSha256: sha256(await fs.readFile(path.join(directory, 'run.json'))),
    boundaries, movements, unsupported, pureControls, nativeControls, qualifyingFullResourcePass: false,
    limits: ['Shared classifier has no durable HTTP request identity; this verifier separately binds retained native commands', 'Other cash taxonomy, bank withdrawal/interest authorization, natural progression and broader resource gaps remain open', 'No concurrent actor schedule, full matrix, deployment or external backing claim'] };
  const output = path.resolve(process.env.RC1_PRESSURE_CASH_OUTPUT || `${directory}-pressure-cash-verification.json`);
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ status: report.status, source: source.revision, scenario: report.scenario, boundaries, movements, unsupported,
    pureControls: pureControls.length, nativeControls: nativeControls.length, output, qualifyingFullResourcePass: false }));
} else console.log(JSON.stringify({ status: 'PASS_SCOPED', pureControls: controls.length, native: false, qualifyingFullResourcePass: false }));
