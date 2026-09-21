import assert from 'node:assert/strict';
import { createTurfPolicy } from '../tools/rc1-turf-policy.js';
import { reconcileTurfCustody } from '../tools/rc1-turf-custody.js';
const c = { accountId: 'aa', seed: 'rc1-alpha', commitBps: 7000 }, options = { districtId: 'cathedral', logicalAt: 1000 };
const view = () => ({ accountId: 'aa', session: { authed: true, character: { id: 'a' } }, me: { character: { id: 'a', gang: { id: 'fa', role: 'boss', treasury: 100000 } } },
  districts: { districts: [{ id: 'cathedral', holder: { gangId: 'fa' }, claimFloor: 45000, contest: null }] }, notifications: { notifications: [] } });
const p = createTurfPolicy(c), decision = p.choose(view(), options), response = { ok: true, district: 'cathedral', staked: decision.request.body.amount,
  added: decision.request.body.amount, defending: true, resolvesSeconds: 1800, lossBps: 5000 };
const restored = createTurfPolicy(c).restore(p.checkpoint()); assert.deepEqual(restored.choose(view(), options), decision);
p.settle({ idempotencyKey: decision.request.idempotencyKey, status: 'COMPLETED', replayed: false, response });
assert.equal(p.choose(view(), options).reason, 'original-contest-window');
assert.equal(p.choose(view(), { ...options, logicalAt: 1801000 }).reason, 'await-canonical-settlement');
p.settle({ idempotencyKey: decision.request.idempotencyKey, status: 'COMPLETED', replayed: true, response }); assert.equal(p.summary().fresh, 1);
const won = view(); won.notifications.notifications.push({ id: 'n', type: 'contest_resolved', payload: { district: 'cathedral', staked: response.staked, won: true, back: 0 } });
assert.equal(p.choose(won, options).kind, 'outcome');
const badView = view(); badView.observer = {}; assert.throws(() => createTurfPolicy(c).choose(badView, options));
const poor = view(); poor.me.character.gang.treasury = 1; assert.equal(createTurfPolicy(c).choose(poor, options).reason, 'insufficient-own-treasury');
const officer = view(); officer.me.character.gang.role = 'soldier'; assert.equal(createTurfPolicy(c).choose(officer, options).reason, 'not-family-officer');
restored.settle({ idempotencyKey: decision.request.idempotencyKey, status: 'COMPLETED', replayed: true, response });
assert.throws(() => restored.choose(view(), options), /Unresolved/);
const bad = p.checkpoint(); bad.payload.choices++; assert.throws(() => createTurfPolicy(c).restore(bad), /checksum/);
assert.deepEqual(createTurfPolicy(c).choose(view(), options), decision);

const copy = (v) => structuredClone(v), family = () => ({ characters: ['a', 'b', 'c'].map((id) => ({ id, account_id: id + id, cash: '500', bank: '0', ammo: '25' })),
  families: ['fa', 'fb', 'fc'].map((id) => ({ id, treasury: '100000', ammo_bank: '0' })),
  members: ['a', 'b', 'c'].map((id) => ({ gang_id: 'f' + id, character_id: id, role: 'boss' })), cars: [], transactions: [] });
const before = { family: family(), districts: [{ id: 'cathedral', holder_gang: 'fa', garrison: 30000, contest_until: null }],
  bids: [], charters: ['fa', 'fb', 'fc'].map((id) => ({ id, charter: null })) };
const staked = copy(before), ops = [];
for (const [i, id] of ['a', 'b', 'c'].entries()) {
  const amount = 50001 + i * 10000; staked.family.families[i].treasury = String(100000 - amount);
  staked.bids.push({ district_id: 'cathedral', gang_id: 'f' + id, amount: String(amount) });
  staked.family.transactions.push({ id: 'claim-' + id, currency: 'cash', amount: '-' + amount, reason: 'turf:claim', counterparty: 'f' + id, character_id: null, account_id: null });
  ops.push({ accountId: id + id, characterId: id, method: 'POST', path: '/v1/districts/cathedral/claim', key: 'k' + id, body: { amount },
    result: { status: 200, replayed: false, body: { ok: true, district: 'cathedral', staked: amount, added: amount, lossBps: 5000, defending: i === 0 } } });
}
staked.districts[0].contest_until = '2026-09-20T12:30:00.000Z';
assert.equal(reconcileTurfCustody(before, staked, { districtId: 'cathedral', operations: ops }).checks.length, 6);
const after = copy(staked); after.bids = []; after.districts[0] = { id: 'cathedral', holder_gang: 'fc', garrison: 70001, contest_until: null };
for (const [i, id] of ['a', 'b', 'c'].entries()) {
  const stake = 50001 + i * 10000, refund = i === 2 ? 0 : Math.floor(stake / 2);
  if (refund) { after.family.families[i].treasury = String(Number(after.family.families[i].treasury) + refund);
    after.family.transactions.push({ id: 'refund-' + id, currency: 'cash', amount: String(refund), reason: 'turf:claim:refund', counterparty: 'f' + id, character_id: null, account_id: null }); }
  after.family.transactions.push({ id: 'burn-' + id, currency: 'cash', amount: '-' + (stake - refund), reason: 'turf:claim:burn', counterparty: 'f' + id, character_id: null, account_id: null });
}
const authority = { districtId: 'cathedral', workerJobs: [{ label: 'turf contest sweep', status: 'RETURNED', result: { resolved: 1 } }] };
assert(reconcileTurfCustody(staked, after, authority).settled);
// On an equal highest stake, the incumbent wins even when another Family sorts first.
const tied = copy(staked); tied.districts[0].holder_gang = 'fc'; tied.bids[0].amount = '70001';
tied.family.families[0].treasury = '29999'; tied.family.transactions.find((r) => r.id === 'claim-a').amount = '-70001';
const tieFinal = copy(tied); tieFinal.bids = []; tieFinal.districts[0] = { id: 'cathedral', holder_gang: 'fc', garrison: 70001, contest_until: null };
for (const bid of tied.bids) {
  const refund = bid.gang_id === 'fc' ? 0 : Math.floor(Number(bid.amount) / 2), f = tieFinal.family.families.find((v) => v.id === bid.gang_id);
  if (refund) { f.treasury = String(Number(f.treasury) + refund); tieFinal.family.transactions.push({ id: 'tie-refund-' + f.id,
    currency: 'cash', amount: String(refund), reason: 'turf:claim:refund', counterparty: f.id, character_id: null, account_id: null }); }
  tieFinal.family.transactions.push({ id: 'tie-burn-' + f.id, currency: 'cash', amount: '-' + (Number(bid.amount) - refund),
    reason: 'turf:claim:burn', counterparty: f.id, character_id: null, account_id: null });
}
assert(reconcileTurfCustody(tied, tieFinal, authority).settled);
assert.equal(reconcileTurfCustody(after, after, { districtId: 'cathedral' }).flows.length, 0);
let controls = 0;
const corrupt = (change) => { const altered = copy(after); change(altered); assert.throws(() => reconcileTurfCustody(staked, altered, authority)); controls++; };
corrupt((s) => s.family.transactions.find((r) => r.id === 'refund-a').counterparty = 'fb');
corrupt((s) => s.family.transactions = s.family.transactions.filter((r) => r.id !== 'burn-c'));
corrupt((s) => s.family.transactions.push({ ...s.family.transactions.find((r) => r.id === 'burn-c'), id: 'duplicate' }));
corrupt((s) => s.districts[0].holder_gang = 'fa');
corrupt((s) => s.districts[0].garrison = 70000);
corrupt((s) => s.bids = copy(staked.bids));
corrupt((s) => s.family.families[0].treasury = String(Number(s.family.families[0].treasury) + 1));
corrupt((s) => s.charters[0].charter = 'fixers');
assert.throws(() => reconcileTurfCustody(staked, after, { districtId: 'cathedral' })); controls++;
assert.throws(() => reconcileTurfCustody(before, staked, { districtId: 'cathedral', operations: [...ops, ops[0]] })); controls++;
console.log('PASS: public own-budget turf policy, pending/settlement/replay controls and ' + controls + ' exact escrow corruption controls');
