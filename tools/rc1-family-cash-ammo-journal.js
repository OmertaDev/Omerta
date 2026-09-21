// Read-only, exact Family cash/ammo custody. OMR belongs to a separate journal.
import assert from 'node:assert/strict';
import { exactSum, negate, equation, sha256 } from './rc1-resource-journal.js';
const value = (v) => exactSum([v]);
const positive = (v) => /^\d/.test(value(v)) && value(v) !== '0';
const negative = (v) => value(v).startsWith('-');
const sorted = (rows, key = (r) => r.id) => [...rows].sort((a, b) => key(a).localeCompare(key(b)));
const copy = (v) => JSON.parse(JSON.stringify(v));
export const FAMILY_CASH_AMMO_CONTRACT = Object.freeze({ version: 1,
  supported: ['formation cash sink', 'personal cash tribute to exact Family treasury', 'canonical car-melt personal ammo and Family cash/ammo creation', 'zero-value membership/leadership changes', 'Family dissolution cash/ammo destruction'],
  authoredConstants: { formationCash: '25000', tributeMinimum: '100', titheCashPerRound: '30', titheFraction: '1/4' },
  absentInterfaces: ['No generic personal Family treasury withdrawal', 'No personal Family ammo-bank deposit/withdrawal endpoint'],
  unsupported: ['OMR and reserve recycling', 'war spoils/declaration', 'turf and escrow', 'contracts', 'territory/other Family income or spending', 'full resource taxonomy'],
  authority: 'Complete committed snapshots plus actual canonical operation outcomes. Receipt identifiers are append-only; relevant lineage, sign, amount, source membership/car and both owner endpoints are checked. Identical receipt amounts do not establish PostgreSQL commit order.' });

export function normalizeFamilyCustodySnapshot(input) {
  const source = input.tables || input;
  const rows = (name, alias) => {
    const data = source[name] ?? source[alias]; assert(Array.isArray(data), 'Missing complete snapshot table: ' + name);
    return data.map((row) => typeof row === 'string' ? JSON.parse(row) : copy(row));
  };
  const result = {
    characters: rows('characters').map((r) => ({ id: r.id, account_id: r.account_id, cash: value(r.cash), bank: value(r.bank), ammo: value(r.ammo) })),
    families: rows('gangs', 'families').map((r) => ({ id: r.id, treasury: value(r.treasury), ammo_bank: value(r.ammo_bank) })),
    members: rows('gang_members', 'members').map((r) => ({ gang_id: r.gang_id, character_id: r.character_id, role: r.role })),
    cars: rows('cars').map((r) => ({ id: r.id, character_id: r.character_id, model_id: r.model_id, trim_id: r.trim_id ?? null, dmg: value(r.dmg ?? 0) })),
    transactions: rows('transactions').map((r) => ({ id: r.id, character_id: r.character_id ?? null, account_id: r.account_id ?? null,
      currency: r.currency, amount: value(r.amount), reason: r.reason, counterparty: r.counterparty ?? null })),
  };
  for (const [name, data] of Object.entries(result)) {
    const key = name === 'members' ? (r) => r.gang_id + '/' + r.character_id : (r) => r.id;
    assert(data.every((r) => typeof key(r) === 'string')); assert.equal(new Set(data.map(key)).size, data.length, 'Duplicate authoritative row: ' + name);
    result[name] = sorted(data, key);
  }
  assert.equal(new Set(result.members.map((m) => m.character_id)).size, result.members.length, 'Character belongs to multiple Families');
  for (const row of [...result.characters, ...result.families]) for (const [key, n] of Object.entries(row))
    if (['cash', 'bank', 'ammo', 'treasury', 'ammo_bank'].includes(key)) assert(!negative(n), 'Negative resource bucket');
  return result;
}

export async function snapshotFamilyCashAmmo(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const data = {};
    for (const [name, sql] of Object.entries({
      characters: 'SELECT id,account_id,cash::text,bank::text,ammo FROM characters ORDER BY id',
      families: 'SELECT id,treasury::text,ammo_bank FROM gangs ORDER BY id',
      members: 'SELECT gang_id,character_id,role FROM gang_members ORDER BY gang_id,character_id',
      cars: 'SELECT id,character_id,model_id,trim_id,dmg FROM cars ORDER BY id',
      transactions: 'SELECT id,character_id,account_id,currency,amount::text,reason,counterparty FROM transactions ORDER BY id',
    })) data[name] = (await client.query(sql)).rows;
    const boundary = (await client.query('SELECT pg_current_snapshot()::text AS snapshot,clock_timestamp() AS captured_at')).rows[0];
    await client.query('COMMIT'); return { ...normalizeFamilyCustodySnapshot(data), boundary: copy(boundary) };
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}

export function reconcileFamilyCashAmmo(beforeInput, afterInput, { operations = [], familyIds = null } = {}) {
  const before = normalizeFamilyCustodySnapshot(beforeInput), after = normalizeFamilyCustodySnapshot(afterInput);
  const priorReceipts = new Map(before.transactions.map((r) => [r.id, r])), finalReceipts = new Map(after.transactions.map((r) => [r.id, r]));
  for (const [id, row] of priorReceipts) assert.deepEqual(finalReceipts.get(id), row, 'Historical receipt mutated/deleted: ' + id);
  const receipts = after.transactions.filter((r) => !priorReceipts.has(r.id));
  const families = new Set(familyIds || [...before.families, ...after.families].map((r) => r.id));
  for (const id of families) assert([...before.families, ...after.families].some((r) => r.id === id), 'Unobserved Family scope: ' + id);
  const fresh = operations.filter((op) => op.result?.status === 200 && op.result.replayed === false);
  assert.equal(new Set(fresh.map((o) => o.accountId + '/' + o.idempotencyKey)).size, fresh.length, 'Duplicate fresh execution identity');
  for (const op of fresh) {
    assert(op.method === 'POST' && op.idempotencyKey && op.result.body?.ok === true, 'Incomplete canonical mutation outcome');
    const owner = [...before.characters, ...after.characters].find((ch) => ch.id === op.characterId);
    assert(owner && owner.account_id === op.accountId, 'Canonical operation owner mismatch');
  }
  const used = new Set(), flows = [], checks = [], unsupported = [];
  const authority = (op, rows, extra = []) => [{ table: 'canonical-http-outcomes', accountId: op.accountId,
    characterId: op.characterId, idempotencyKey: op.idempotencyKey, path: op.path, responseSha256: sha256(op.result.body) },
  ...rows.map((r) => ({ table: 'transactions', id: r.id, reason: r.reason })), ...extra];
  const claim = (predicate, description) => {
    const rows = receipts.filter((r) => !used.has(r.id) && predicate(r));
    assert.equal(rows.length, 1, 'Missing/ambiguous authoritative receipt: ' + description);
    used.add(rows[0].id); return rows[0];
  };
  const membership = (op) => {
    const candidates = new Set([...before.members, ...after.members].filter((m) => m.character_id === op.characterId).map((m) => m.gang_id));
    for (const transition of fresh.filter((v) => v.characterId === op.characterId)) {
      if (transition.path === '/v1/gangs') candidates.add(transition.result.body.gangId);
      if (/^\/v1\/gangs\/[^/]+\/join$/.test(transition.path)) {
        assert.equal(transition.path.split('/')[3], transition.result.body.gangId, 'Canonical join target mismatch');
        candidates.add(transition.result.body.gangId);
      }
    }
    assert.equal(candidates.size, 1, 'Missing/ambiguous membership lineage; require finer committed boundaries');
    return [...candidates][0];
  };
  const familyFlow = (resource, familyId, kind, amount, op, rows, extra = []) => {
    assert(positive(amount), 'Nonpositive classified Family movement');
    flows.push({ resource, familyId, kind, amount: value(amount), authority: authority(op, rows, extra) });
  };
  for (const op of fresh) {
    const response = op.result.body;
    if (op.path === '/v1/gangs') {
      const familyId = response.gangId; if (!families.has(familyId)) continue;
      assert(!before.families.some((f) => f.id === familyId) && after.families.some((f) => f.id === familyId), 'Formation must create observed Family');
      assert(after.members.some((m) => m.gang_id === familyId && m.character_id === op.characterId && m.role === 'boss'), 'Formation boss lineage mismatch');
      const receipt = claim((r) => r.currency === 'cash' && r.reason === 'gang:found' && r.character_id === op.characterId
        && r.counterparty === null && r.account_id === null && r.amount === negate(FAMILY_CASH_AMMO_CONTRACT.authoredConstants.formationCash), 'formation');
      flows.push({ resource: 'cash', familyId, kind: 'formation-sink', owner: op.characterId,
        amount: negate(receipt.amount), authority: authority(op, [receipt], [{ table: 'gang_members', familyId, characterId: op.characterId }]) });
    } else if (op.path === '/v1/gangs/tribute') {
      const familyId = membership(op); if (!families.has(familyId)) continue;
      assert.equal(response.currency, 'cash'); assert(/^\d+$/.test(value(response.amount)) && BigInt(value(response.amount)) >= 100n);
      if (op.body?.amount !== undefined) assert.equal(value(op.body.amount), value(response.amount), 'Tribute request/response mismatch');
      const receipt = claim((r) => r.currency === 'cash' && r.reason === 'gang:tribute' && r.character_id === op.characterId
        && r.account_id === null && r.counterparty === familyId && r.amount === negate(value(response.amount)), 'tribute owner/Family pair');
      familyFlow('cash', familyId, 'transfer-in', response.amount, op, [receipt], [{ table: 'gang_members', familyId, characterId: op.characterId }]);
    } else if (/^\/v1\/garage\/[^/]+\/melt$/.test(op.path)) {
      const familyId = membership(op); if (!families.has(familyId)) continue;
      const carId = op.path.split('/')[3], car = before.cars.find((c) => c.id === carId);
      assert(car && car.character_id === op.characterId && !after.cars.some((c) => c.id === carId), 'Melt car ownership/destruction mismatch');
      assert(positive(response.rounds) && positive(response.tithe), 'This Family journal requires nonzero melt outputs');
      assert(/^\d+$/.test(value(response.rounds)) && /^\d+$/.test(value(response.tithe)));
      assert.equal((BigInt(value(response.rounds)) + BigInt(value(response.tithe))) / 4n, BigInt(value(response.tithe)), 'Authored melt tithe fraction mismatch');
      const personal = claim((r) => r.currency === 'ammo' && r.reason === 'melt' && r.character_id === op.characterId
        && r.account_id === null && r.counterparty === null && r.amount === value(response.rounds), 'personal melt output');
      const tithe = claim((r) => r.currency === 'ammo' && r.reason === 'melt:tithe' && r.character_id === null
        && r.account_id === null && r.counterparty === familyId && r.amount === value(response.tithe), 'Family ammo tithe');
      assert(/^\d+$/.test(tithe.amount), 'Ammo tithe must be integer');
      const cashAmount = (BigInt(tithe.amount) * BigInt(FAMILY_CASH_AMMO_CONTRACT.authoredConstants.titheCashPerRound)).toString();
      const cash = claim((r) => r.currency === 'cash' && r.reason === 'melt:tithe' && r.character_id === null
        && r.account_id === null && r.counterparty === familyId && r.amount === cashAmount, 'Family cash tithe');
      const endpoint = [{ table: 'cars', id: carId, characterId: op.characterId, disposition: 'removed' }];
      familyFlow('ammo', familyId, 'created', tithe.amount, op, [tithe, personal], endpoint);
      familyFlow('cash', familyId, 'created', cash.amount, op, [cash, tithe], endpoint);
      flows.push({ resource: 'ammo', familyId, kind: 'personal-created', owner: op.characterId, amount: personal.amount, authority: authority(op, [personal], endpoint) });
    } else if (op.path === '/v1/gangs/leave' && response.dissolved === true) {
      const familyId = membership(op); if (!families.has(familyId)) continue;
      assert(!after.families.some((f) => f.id === familyId) && !after.members.some((m) => m.gang_id === familyId), 'Dissolution retained Family custody');
      for (const resource of ['cash', 'ammo']) {
        const rows = receipts.filter((r) => !used.has(r.id) && r.currency === resource && r.reason === 'gang:dissolved' && r.counterparty === familyId);
        assert(rows.length <= 1, 'Duplicate Family disposal receipt');
        if (rows.length) {
          const r = rows[0]; assert(r.character_id === null && r.account_id === null && negative(r.amount), 'Invalid dissolution receipt ownership/sign');
          used.add(r.id); familyFlow(resource, familyId, 'destroyed', negate(r.amount), op, [r]);
        }
      }
    }
  }
  for (const r of receipts) if (families.has(r.counterparty) && ['cash', 'ammo'].includes(r.currency) && !used.has(r.id)) {
    assert(!['gang:tribute', 'melt:tithe', 'gang:dissolved'].includes(r.reason), 'Orphan supported Family receipt: ' + r.id);
    unsupported.push({ familyId: r.counterparty, resource: r.currency, receiptId: r.id, reason: r.reason });
  }
  for (const familyId of [...families].sort()) {
    const prior = before.families.find((f) => f.id === familyId), final = after.families.find((f) => f.id === familyId);
    if (!prior) assert(fresh.some((op) => op.path === '/v1/gangs' && op.result.body.gangId === familyId), 'Unreceipted Family creation');
    if (!final) assert(fresh.some((op) => op.path === '/v1/gangs/leave' && op.result.body.dissolved && before.members.some((m) => m.character_id === op.characterId && m.gang_id === familyId)), 'Unreceipted Family deletion');
    for (const [resource, field] of [['cash', 'treasury'], ['ammo', 'ammo_bank']]) {
      const owned = flows.filter((f) => f.familyId === familyId && f.resource === resource);
      if (unsupported.some((r) => r.familyId === familyId && r.resource === resource)) {
        checks.push({ owner: familyId, resource, status: 'UNSUPPORTED', before: prior?.[field] || '0', after: final?.[field] || '0' }); continue;
      }
      checks.push({ status: 'PASS', ...equation({ resource, owner: familyId, before: prior?.[field] || '0', after: final?.[field] || '0',
        created: exactSum(owned.filter((f) => f.kind === 'created').map((f) => f.amount)),
        destroyed: exactSum(owned.filter((f) => f.kind === 'destroyed').map((f) => f.amount)),
        transferredIn: exactSum(owned.filter((f) => f.kind === 'transfer-in').map((f) => f.amount)),
        authority: owned.length ? owned.flatMap((f) => f.authority) : [{ rule: 'No classified cash/ammo movement; metadata/membership alone cannot change custody' }] }) });
    }
  }
  // Complete personal endpoints: exact ledger parity, not semantic classification of unrelated receipts.
  const personalChecks = [];
  for (const prior of before.characters) {
    const final = after.characters.find((c) => c.id === prior.id); assert(final, 'Character deletion is outside this Family journal');
    for (const resource of ['cash', 'ammo']) {
      const rows = receipts.filter((r) => r.character_id === prior.id && r.currency === resource);
      const oldValue = resource === 'cash' ? exactSum([prior.cash, prior.bank]) : prior.ammo;
      const newValue = resource === 'cash' ? exactSum([final.cash, final.bank]) : final.ammo;
      const drift = exactSum([newValue, negate(oldValue), negate(exactSum(rows.map((r) => r.amount)))]);
      assert.equal(drift, '0', 'Personal endpoint ledger mismatch: ' + prior.id + '/' + resource);
      personalChecks.push({ owner: prior.id, resource, before: oldValue, after: newValue, ledgerDelta: exactSum(rows.map((r) => r.amount)), drift,
        receiptIds: rows.map((r) => r.id), scope: 'Endpoint parity; unrelated personal receipt semantics are not Family custody classification' });
    }
  }
  assert.equal(after.characters.length, before.characters.length, 'Character birth is outside this Family journal boundary');
  return { version: 1, status: unsupported.length ? 'PARTIAL_UNSUPPORTED' : 'PASS_SCOPED', familyIds: [...families].sort(),
    beforeSha256: sha256(before), afterSha256: sha256(after), flows, checks, personalChecks, unsupported,
    membershipChanged: sha256(before.members) !== sha256(after.members),
    outsideScopeReceiptIds: receipts.filter((r) => !used.has(r.id)).map((r) => r.id), qualifyingFullResourcePass: false };
}
