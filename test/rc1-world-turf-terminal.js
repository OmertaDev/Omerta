import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLD_RESOURCE_TABLES, reconcileWorldResources, verifyResourceTableChanges } from '../tools/rc1-world-resource-observer.js';
import { exactSum, negate } from '../tools/rc1-resource-journal.js';
import { omrRequestHash } from '../tools/rc1-omr-journal.js';
import { sourceIdentity, verifyArtifactIndex } from '../tools/rc1-native-proof.js';

export function verifyTurfTerminalBoundary(input, expected = null) {
  if (input.operations) {
    assert(Array.isArray(input.durable));
    assert.equal(new Set(input.durable.map(row => JSON.stringify([row.account_id, row.key]))).size, input.durable.length, 'Duplicate durable request key');
    for (const op of input.operations.filter(row => row.result.status === 200)) {
      const saved = input.durable.filter(row => row.account_id === op.accountId && row.key === op.key);
      assert.equal(saved.length, 1, 'Missing canonical claim request'); assert.equal(saved[0].status, 200);
      assert.equal(saved[0].body_hash, omrRequestHash({ method: op.method, url: op.path, payload: op.body }));
      assert.deepEqual(JSON.parse(saved[0].response), op.result.body);
    }
  }
  const journal = reconcileWorldResources(input.before, input.after, { includeRestrictedChanges: true });
  if (journal.turfTerminal.movements.length) {
    assert(input.workerJobs.some(row => row.label === 'turf contest sweep' && row.status === 'RETURNED' && row.result?.resolved === 1), 'Missing original successful turf worker authority');
    for (const movement of journal.turfTerminal.movements) for (const authority of movement.authority) {
      const receipt = input.after.tables.transactions.find(row => row.id === authority.id); assert.equal(Date.parse(receipt.at), input.logicalAt, 'Settlement differs from observed original callback time');
    }
  }
  if (expected !== null) { assert.equal(journal.turfTerminal.movements.length, expected, 'Expected terminal custody attribution missing');
    assert.equal(journal.unsupported.length, 0, `Scoped terminal still unsupported: ${JSON.stringify(journal.unsupported)}`); }
  return journal;
}
export function turfTerminalCorruptions(input) {
  const journal = verifyTurfTerminalBoundary(input), expected = journal.turfTerminal.movements.length; assert(expected > 1);
  const loser = journal.turfTerminal.movements.find(row => !row.won), winner = journal.turfTerminal.movements.find(row => row.won);
  const fresh = value => value.after.tables.transactions.filter(row => !value.before.tables.transactions.some(old => old.id === row.id));
  const refund = value => fresh(value).find(row => row.reason === 'turf:claim:refund' && row.counterparty === loser.familyId);
  const burn = value => fresh(value).find(row => row.reason === 'turf:claim:burn' && row.counterparty === loser.familyId);
  const mutations = [
    ['missing-refund', value => { const row = refund(value); value.after.tables.transactions = value.after.tables.transactions.filter(item => item.id !== row.id); }],
    ['missing-burn', value => { const row = burn(value); value.after.tables.transactions = value.after.tables.transactions.filter(item => item.id !== row.id); }],
    ['duplicate-refund', value => value.after.tables.transactions.push({ ...refund(value), id: 'duplicate-refund' })],
    ['duplicate-burn', value => value.after.tables.transactions.push({ ...burn(value), id: 'duplicate-burn' })],
    ['stale-refund', value => value.before.tables.transactions.push(structuredClone(refund(value)))],
    ['stale-burn', value => value.before.tables.transactions.push(structuredClone(burn(value)))],
    ['wrong-Family-counterparty', value => { refund(value).counterparty = winner.familyId; }],
    ['wrong-personal-owner', value => { refund(value).character_id = value.after.tables.characters[0].id; }],
    ['balanced-wrong-Family-credit', value => {
      const source = value.after.tables.gangs.find(row => row.id === loser.familyId), target = value.after.tables.gangs.find(row => row.id === winner.familyId);
      source.treasury = exactSum([source.treasury, negate(loser.refunded)]); target.treasury = exactSum([target.treasury, loser.refunded]);
    }],
    ['balanced-wrong-refund-rounding', value => {
      refund(value).amount = exactSum([refund(value).amount, '1']); burn(value).amount = exactSum([burn(value).amount, '1']);
      const family = value.after.tables.gangs.find(row => row.id === loser.familyId); family.treasury = exactSum([family.treasury, '1']);
    }],
    ['missing-refund-custody', value => { const family = value.after.tables.gangs.find(row => row.id === loser.familyId); family.treasury = exactSum([family.treasury, negate(loser.refunded)]); }],
    ['retained-escrow', value => { value.after.tables.district_bids.push(structuredClone(value.before.tables.district_bids[0])); }],
    ['duplicate-owner-escrow', value => { value.before.tables.district_bids.push(structuredClone(value.before.tables.district_bids[0])); }],
    ['wrong-winner', value => { value.after.tables.districts.find(row => row.id === winner.districtId).holder_gang = loser.familyId; }],
    ['wrong-garrison', value => { const d = value.after.tables.districts.find(row => row.id === winner.districtId); d.garrison = exactSum([d.garrison, '1']); }],
    ['retained-deadline', value => { value.after.tables.districts.find(row => row.id === winner.districtId).contest_until = value.before.tables.districts.find(row => row.id === winner.districtId).contest_until; }],
    ['early-settlement', value => { const deadline = Date.parse(value.before.tables.districts.find(row => row.id === winner.districtId).contest_until); for (const row of fresh(value)) row.at = new Date(deadline - 1).toISOString(); }],
    ['missing-original-worker', value => { value.workerJobs = []; }],
    ['wrong-original-worker-result', value => { value.workerJobs = [{ label: 'turf contest sweep', status: 'RETURNED', result: { resolved: 0 } }]; }],
    ['wrong-observed-time', value => { value.logicalAt++; }],
  ];
  return mutations.map(([name, mutate]) => { const corrupt = structuredClone(input); mutate(corrupt); let rejection;
    try { verifyTurfTerminalBoundary(corrupt, expected); } catch (error) { rejection = error.message; }
    assert(rejection, `${name} escaped`); return { name, input: corrupt, rejection }; });
}
if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const at = '2026-09-20T13:00:00.000Z', before = { format: 1, tables: Object.fromEntries(WORLD_RESOURCE_TABLES.map(table => [table, []])) };
  before.tables.characters = ['a', 'b', 'c'].map(id => ({ id, account_id: id, alive: true, cash: '500', bank: '0', ammo: 25, cb: 0 }));
  before.tables.account_persistent = ['a', 'b', 'c'].map(account_id => ({ account_id, omr: '0', staked: '0', unbonding: '0' }));
  before.tables.gangs = ['A', 'B', 'C'].map(id => ({ id, treasury: '100000', ammo_bank: 0, omr_reserve: '0', charter: null }));
  before.tables.districts = [{ id: 'cathedral', holder_gang: 'A', garrison: '50000', contest_until: '2026-09-20T12:30:00.000Z', npc_holder: null, watch_hour: 12, seized_at: '2026-09-20T12:00:00.000Z' }];
  before.tables.district_bids = ['A', 'B', 'C'].map((gang_id, i) => ({ gang_id, district_id: 'cathedral', amount: String(50001 + 10000 * i), at: '2026-09-20T12:00:00.000Z' }));
  function settled(prior) {
    const after = structuredClone(prior), ordered = [...prior.tables.district_bids].sort((a, b) => Number(b.amount) - Number(a.amount) || (a.gang_id === prior.tables.districts[0].holder_gang ? -1 : 1));
    const winner = ordered[0], d = after.tables.districts[0]; after.tables.district_bids = [];
    if (d.holder_gang !== winner.gang_id) Object.assign(d, { seized_at: at, watch_hour: null, npc_holder: null });
    Object.assign(d, { holder_gang: winner.gang_id, garrison: String(Math.max(Number(d.garrison), Number(winner.amount))), contest_until: null });
    for (const bid of prior.tables.district_bids) {
      const refund = bid.gang_id === winner.gang_id ? 0 : Math.floor(Number(bid.amount) / 2), burn = Number(bid.amount) - refund;
      if (refund) { const family = after.tables.gangs.find(row => row.id === bid.gang_id); family.treasury = exactSum([family.treasury, String(refund)]);
        after.tables.transactions.push({ id: `refund-${bid.gang_id}`, character_id: null, account_id: null, currency: 'cash', amount: String(refund), reason: 'turf:claim:refund', counterparty: bid.gang_id, at }); }
      after.tables.transactions.push({ id: `burn-${bid.gang_id}`, character_id: null, account_id: null, currency: 'cash', amount: String(-burn), reason: 'turf:claim:burn', counterparty: bid.gang_id, at });
    }
    return { before: prior, after, logicalAt: Date.parse(at), workerJobs: [{ label: 'turf contest sweep', status: 'RETURNED', result: { resolved: 1 } }] };
  }
  const input = settled(before); verifyTurfTerminalBoundary(input, 3); const controls = turfTerminalCorruptions(input);
  const replay = { ...input, before: input.after, workerJobs: [{ label: 'turf contest sweep', status: 'RETURNED', result: { resolved: 0 } }] };
  verifyTurfTerminalBoundary(replay, 0);
  const tie = structuredClone(before); tie.tables.district_bids[0].amount = '70001'; assert(verifyTurfTerminalBoundary(settled(tie), 3).turfTerminal.movements.find(row => row.won).familyId === 'A');
  const charter = structuredClone(input); charter.before.tables.gangs[0].charter = 'fixers';
  const unknown = reconcileWorldResources(charter.before, charter.after, { includeRestrictedChanges: true }); assert(unknown.unsupported.some(row => row.kind === 'turf-terminal-compound')); verifyResourceTableChanges(charter.before, charter.after, unknown.restrictedChanges);
  const extra = structuredClone(input); extra.after.tables.districts[0].future_custody = '1';
  assert(reconcileWorldResources(extra.before, extra.after).unsupported.some(row => row.table === 'districts'), 'New district fields must remain visible');
  const directory = process.argv.find(value => value.startsWith('--evidence='))?.slice(11);
  if (directory) {
    const run = JSON.parse(await fs.readFile(path.join(directory, 'run.json'), 'utf8')); await verifyArtifactIndex(directory, run); assert.deepEqual(run.source, await sourceIdentity()); assert.equal(run.status, 'PASS_SCOPED');
    let boundaries = 0, terminals = 0, nativeControls = 0; const unsupported = {};
    for (const artifact of run.artifacts.filter(row => /^turf-terminal-input-\d+\.json$/.test(row.path))) {
      const value = JSON.parse(await fs.readFile(path.join(directory, artifact.path), 'utf8')), journal = verifyTurfTerminalBoundary(value); boundaries++;
      if (journal.turfTerminal.movements.length) { verifyTurfTerminalBoundary(value, 3); terminals++; }
      for (const row of journal.unsupported) { const key = `${row.kind}:${row.table || row.reason || ''}`; unsupported[key] = (unsupported[key] || 0) + 1; }
    }
    for (const artifact of run.artifacts.filter(row => /^turf-terminal-control-\d+\.json$/.test(row.path))) {
      const value = JSON.parse(await fs.readFile(path.join(directory, artifact.path), 'utf8')); assert.throws(() => verifyTurfTerminalBoundary(value.input, 3)); nativeControls++;
    }
    console.log(JSON.stringify({ status: 'PASS_SCOPED', source: run.source.revision, boundaries, terminals, nativeControls, pureControls: controls.length, unsupported, fullResourceCoverage: false }));
  } else console.log(JSON.stringify({ status: 'PASS_PURE_CONTROLS', controls: controls.length, fullResourceCoverage: false }));
}
