// Exact, narrow unchartered district contest escrow observer. Never a policy input.
import assert from 'node:assert/strict';
import { snapshotFamilyCashAmmo, normalizeFamilyCustodySnapshot } from './rc1-family-cash-ammo-journal.js';
import { exactSum, negate, equation, sha256 } from './rc1-resource-journal.js';
const value = (v) => exactSum([v]), rows = (v) => v.map((r) => typeof r === 'string' ? JSON.parse(r) : structuredClone(r));
export async function snapshotTurfCustody(pool) {
  // The harness stops between canonical mutations/callbacks; no overlapping writes during this read.
  const family = await snapshotFamilyCashAmmo(pool);
  return { family,
    districts: (await pool.query('SELECT id,holder_gang,garrison,contest_until FROM districts ORDER BY id')).rows,
    bids: (await pool.query('SELECT district_id,gang_id,amount::text,at FROM district_bids ORDER BY district_id,gang_id')).rows,
    charters: (await pool.query('SELECT id,charter FROM gangs ORDER BY id')).rows };
}
export function reconcileTurfCustody(before, after, { districtId, operations = [], workerJobs = [] }) {
  const a = normalizeFamilyCustodySnapshot(before.family), b = normalizeFamilyCustodySnapshot(after.family);
  const prior = rows(before.bids).filter((r) => r.district_id === districtId), final = rows(after.bids).filter((r) => r.district_id === districtId);
  for (const input of [prior, final]) assert.equal(new Set(input.map((r) => r.gang_id)).size, input.length, 'Duplicate owner escrow');
  const da = before.districts.find((d) => d.id === districtId), db = after.districts.find((d) => d.id === districtId); assert(da && db);
  const oldReceipts = new Map(a.transactions.map((r) => [r.id, r]));
  for (const old of a.transactions) assert.deepEqual(b.transactions.find((r) => r.id === old.id), old, 'Historical receipt changed');
  const receipts = b.transactions.filter((r) => !oldReceipts.has(r.id)), used = new Set(), flows = [];
  const families = [...new Set([...prior, ...final].map((r) => r.gang_id))].sort();
  for (const f of families) for (const snapshot of [before, after]) assert(snapshot.charters.find((r) => r.id === f)?.charter === null, 'Only observed unchartered scope');
  const claim = (familyId, reason, amount) => {
    const matching = receipts.filter((r) => !used.has(r.id) && r.counterparty === familyId && r.currency === 'cash' && r.reason === reason
      && r.character_id === null && r.account_id === null && r.amount === value(amount));
    assert.equal(matching.length, 1, 'Missing/ambiguous turf receipt: ' + reason); used.add(matching[0].id); return matching[0].id;
  };
  const fresh = operations.filter((o) => o.result.status === 200 && o.result.replayed === false);
  assert.equal(new Set(fresh.map((o) => o.accountId + '/' + o.key)).size, fresh.length, 'Duplicate fresh execution');
  for (const op of fresh) {
    assert.equal(op.path, '/v1/districts/' + districtId + '/claim'); assert.equal(op.method, 'POST');
    const actor = a.characters.find((c) => c.id === op.characterId); assert.equal(actor?.account_id, op.accountId);
    const member = a.members.find((m) => m.character_id === op.characterId); assert(member && ['boss', 'underboss'].includes(member.role));
    const next = final.find((r) => r.gang_id === member.gang_id), old = prior.find((r) => r.gang_id === member.gang_id);
    assert(next); const delta = exactSum([next.amount, negate(old?.amount || '0')]), r = op.result.body;
    assert.equal(r.ok, true); assert.equal(value(r.staked), value(next.amount)); assert.equal(value(op.body.amount), value(next.amount)); assert.equal(value(r.added), delta);
    assert.equal(r.lossBps, 5000); assert.equal(r.defending, da.holder_gang === member.gang_id); assert.equal(r.district, districtId);
    const receiptId = claim(member.gang_id, 'turf:claim', negate(delta));
    flows.push({ kind: 'escrow-in', familyId: member.gang_id, amount: delta, receiptId, commandKey: op.key });
  }
  const settled = prior.length > 0 && final.length === 0;
  if (settled) {
    assert.equal(fresh.length, 0, 'Combined settlement/new contest requires finer boundaries');
    assert(workerJobs.some((j) => j.label === 'turf contest sweep' && j.status === 'RETURNED' && j.result?.resolved === 1), 'No original worker settlement authority');
    assert.equal(db.contest_until, null);
    const ordered = [...prior].sort((x, y) => BigInt(value(x.amount)) === BigInt(value(y.amount))
      ? x.gang_id === da.holder_gang ? -1 : y.gang_id === da.holder_gang ? 1 : x.gang_id.localeCompare(y.gang_id)
      : BigInt(value(x.amount)) > BigInt(value(y.amount)) ? -1 : 1);
    const winner = ordered[0]; assert.equal(db.holder_gang, winner.gang_id, 'Wrong scarce-object winner');
    const oldGarrison = BigInt(value(da.garrison)), winAmount = BigInt(value(winner.amount));
    assert.equal(value(db.garrison), String(oldGarrison > winAmount ? oldGarrison : winAmount), 'Wrong resulting garrison');
    for (const bid of prior) {
      assert(b.families.some((f) => f.id === bid.gang_id), 'Dissolved bidder is outside bounded scope');
      const amount = BigInt(value(bid.amount)), refund = bid.gang_id === winner.gang_id ? 0n : amount * 5000n / 10000n;
      if (refund) flows.push({ kind: 'escrow-refund', familyId: bid.gang_id, amount: String(refund), receiptId: claim(bid.gang_id, 'turf:claim:refund', String(refund)) });
      const burn = amount - refund;
      flows.push({ kind: 'escrow-burn', familyId: bid.gang_id, amount: String(burn), receiptId: claim(bid.gang_id, 'turf:claim:burn', '-' + burn), winner: bid.gang_id === winner.gang_id });
    }
  }
  for (const r of receipts) if (['turf:claim', 'turf:claim:refund', 'turf:claim:burn'].includes(r.reason)) assert(used.has(r.id), 'Orphan turf receipt');
  const checks = [];
  for (const familyId of families) {
    const fa = a.families.find((f) => f.id === familyId), fb = b.families.find((f) => f.id === familyId); assert(fa && fb);
    const owned = flows.filter((f) => f.familyId === familyId), amount = (kind) => exactSum(owned.filter((f) => f.kind === kind).map((f) => f.amount));
    const authority = owned.length ? owned : [{ kind: 'no-turf-movement' }];
    checks.push(equation({ resource: 'family-cash', owner: familyId, before: fa.treasury, after: fb.treasury,
      transferredOut: amount('escrow-in'), transferredIn: amount('escrow-refund'), authority }));
    checks.push(equation({ resource: 'district-cash-escrow', owner: familyId, before: prior.find((r) => r.gang_id === familyId)?.amount || '0',
      after: final.find((r) => r.gang_id === familyId)?.amount || '0', transferredIn: amount('escrow-in'), transferredOut: amount('escrow-refund'),
      destroyed: amount('escrow-burn'), authority }));
  }
  return { status: 'PASS_SCOPED', beforeSha256: sha256(before), afterSha256: sha256(after), districtId, settled, flows, checks,
    exclusions: ['OMR', 'war', 'other districts', 'other Family treasury flows', 'dissolved bidders', 'charter modifiers', 'full resource taxonomy'] };
}
