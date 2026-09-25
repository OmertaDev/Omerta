// Bounded resource pressure selectors. Database diagnostics are never policy inputs.
import assert from 'node:assert/strict';
import { canonicalJson, sha256 } from './rc1-native-proof.js';
const clone = value => structuredClone(value);
const hash = value => sha256(canonicalJson(value));
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value);
export const RESOURCE_PRESSURE_CONTRACT = Object.freeze({ version: 1,
  authority: 'Verified bearer subject, own session/me, public rules and public exchange only. Hidden diagnostics never select actions.',
  scarcity: 'Ordinary-entry scarcity proxy: cash500/ammo25/bank0/cb0/omr0/respect0. Not the minimum reachable supply across all resources.',
  abundance: 'Ordinary entry with initialization-only level75 respect fixture, then canonical first check-in26250 cash and paid2000-for50 ammo conversions. No invented global maximum.',
  contention: 'Finite player ammo escrow; public listing selection can become stale. Admission and all receipts remain canonical.',
  exclusions: 'Full resource extremes, global maximum/minimum, all13 resources, long-term and225-cell matrix.' });
export function planResourcePressure(scenario) {
  assert(['resource_scarcity', 'resource_abundance'].includes(scenario));
  return { scenario, population: 3, initial: { cash: 500, bank: 0, ammo: 25, cb: 0, omr: 0, respect: 0 },
    progressionFixtureLevel: scenario === 'resource_abundance' ? 75 : null,
    canonicalFirstCheckin: scenario === 'resource_abundance' ? 26250 : 350,
    expectedCashAfterFirstCheckin: scenario === 'resource_abundance' ? 26750 : 850,
    lot: { qty: 25, unitPrice: 20 }, ammoPurchase: { cash: 2000, ammo: 50 },
    maximumCrimeAttempts: 40, minimumLogicalMinutes: 15, maximumLogicalMinutes: 60,
    scope: RESOURCE_PRESSURE_CONTRACT.exclusions };
}
const counters = () => ({ observations: 0, choices: 0, waits: 0, fresh: 0, denied: 0, knownReplays: 0, unresolvedReplays: 0 });
function validate(s, c) {
  assert.equal(s.version, 1); assert.deepEqual(s.configuration, c);
  assert.deepEqual(Object.keys(s.counters).sort(), Object.keys(counters()).sort());
  for (const n of Object.values(s.counters)) assert(Number.isSafeInteger(n) && n >= 0);
  assert.equal(s.counters.observations, s.counters.choices + s.counters.waits);
  assert.equal(s.counters.choices, s.counters.fresh + s.counters.denied + s.counters.unresolvedReplays + Number(!!s.pending));
  assert.equal(s.receipts.length, s.counters.fresh + s.counters.denied);
  assert.equal(new Set(s.receipts.map(r => r.idempotencyKey)).size, s.receipts.length);
  assert.equal(s.unresolved.length, s.counters.unresolvedReplays);
  assert.equal(Object.values(s.completedByType).reduce((a, b) => a + b, 0), s.counters.fresh);
  assert.equal(new Set(s.ownedListings).size, s.ownedListings.length);
}
export function createResourcePressurePolicy(configuration) {
  assert.deepEqual(Object.keys(configuration).sort(), ['accountId', 'scenario', 'seed']);
  assert(identifier(configuration.accountId)); assert(typeof configuration.seed === 'string' && configuration.seed.length);
  const plan = planResourcePressure(configuration.scenario); configuration = clone(configuration);
  let state = { version: 1, configuration, characterId: null, pending: null, counters: counters(), receipts: [], unresolved: [], ownedListings: [], completedByType: {} };
  return {
    choose(view, { logicalAt, phase }) {
      assert(Number.isSafeInteger(logicalAt) && logicalAt >= 0);
      assert(['checkin', 'replenish-ammo', 'list', 'take', 'cancel', 'hoard', 'progress'].includes(phase));
      assert.equal(view.accountId, configuration.accountId, 'Foreign account context');
      const own = view.me?.character;
      assert(view.session?.authed === true && own && view.session.character?.id === own.id, 'Foreign own-character view');
      assert(identifier(own.id)); assert(Array.isArray(view.exchange?.listings) && Array.isArray(view.rules?.crimes));
      assert(state.characterId === null || state.characterId === own.id, 'Replacement requires explicit new policy cursor');
      if (state.pending) return clone(state.pending);
      assert.equal(state.counters.unresolvedReplays, 0, 'Unresolved completed replay');
      state.characterId = own.id; state.counters.observations++;
      const wait = reason => { state.counters.waits++; validate(state, configuration); return { kind: 'wait', phase, reason, scope: 'Implemented pressure choice only' }; };
      let path, body = {}, method = 'POST', type = phase;
      const seen = new Set();
      for (const row of view.exchange.listings) { assert(identifier(row.id) && !seen.has(row.id), 'Duplicate/invalid public lot identity'); seen.add(row.id); }
      if (phase === 'checkin') {
        if (own.checkin?.done) return wait('daily-checkin-already-used');
        assert(own.checkin && Number.isSafeInteger(own.checkin.pay)); path = '/v1/checkin';
      } else if (phase === 'replenish-ammo') {
        if (own.cash < plan.ammoPurchase.cash) return wait('armory-cash'); path = '/v1/armory/ammo';
      } else if (phase === 'list') {
        if (own.ammo < plan.lot.qty) return wait('ammo-stock');
        path = '/v1/exchange/list'; body = { kind: 'ammo', qty: plan.lot.qty, unitPrice: plan.lot.unitPrice };
      } else if (phase === 'take') {
        const candidates = view.exchange.listings.filter(r => r.kind === 'ammo' && r.seller !== own.name && !state.ownedListings.includes(r.id)
          && Number.isSafeInteger(r.qty) && r.qty > 0 && Number.isSafeInteger(r.unitPrice) && r.unitPrice > 0 && Number.isSafeInteger(r.qty * r.unitPrice) && r.qty * r.unitPrice <= own.cash);
        candidates.sort((a, b) => a.qty * a.unitPrice - b.qty * b.unitPrice || hash([configuration.seed, a.id]).localeCompare(hash([configuration.seed, b.id])));
        if (!candidates.length) return wait('no-affordable-public-ammo-lot'); path = '/v1/exchange/' + candidates[0].id + '/buy';
      } else if (phase === 'cancel') {
        const lot = view.exchange.listings.find(r => state.ownedListings.includes(r.id));
        if (!lot) return wait('no-receipt-linked-own-lot'); path = '/v1/exchange/' + lot.id; method = 'DELETE';
      } else if (phase === 'hoard') {
        const amount = Math.floor(own.cash); if (amount < 1) return wait('no-pocket-cash');
        path = '/v1/bank/deposit'; body = { amount };
      } else {
        if (own.jailSeconds > 0) return wait('original-jail');
        const pick = view.rules.crimes.find(r => r.id === 'pick'); assert(pick && pick.lvl === 1 && pick.nerve === 2);
        if (own.level < pick.lvl || own.nerve < pick.nerve) return wait('crime-nerve');
        path = '/v1/crimes/pick'; body = { approach: 'quiet' };
      }
      const key = 'pressure-' + hash([configuration, own.id, state.counters.choices, phase]).slice(0, 32);
      state.counters.choices++;
      state.pending = { kind: 'command', characterId: own.id, logicalAt, phase, type,
        request: { authority: 'legacy-http', method, path, body, idempotencyKey: key } };
      validate(state, configuration); return clone(state.pending);
    },
    settle({ idempotencyKey, status, replayed, response }) {
      assert(['COMPLETED', 'DENIED'].includes(status)); assert.equal(typeof replayed, 'boolean');
      const known = state.receipts.find(r => r.idempotencyKey === idempotencyKey);
      if (known) { assert(replayed && known.status === status && known.responseSha256 === hash(response), 'Conflicting replay receipt'); state.counters.knownReplays++; return this.summary(); }
      assert(state.pending?.request.idempotencyKey === idempotencyKey, 'Unexpected completion identity');
      const choice = state.pending;
      if (status === 'COMPLETED' && !replayed) {
        assert.equal(response.ok, true);
        if (choice.phase === 'list') { assert(identifier(response.listingId)); assert.equal(response.kind, 'ammo'); assert.equal(response.qty, plan.lot.qty); state.ownedListings.push(response.listingId); }
        if (choice.phase === 'cancel') { assert.equal(response.exchange, 'pulled'); assert.equal(response.kind, 'ammo'); }
        if (choice.phase === 'take') { assert.equal(response.exchange, 'bought'); assert.equal(response.kind, 'ammo'); }
        if (choice.phase === 'replenish-ammo') { assert.equal(response.rolled, 50); assert.equal(response.cost, 2000); }
        state.counters.fresh++; state.completedByType[choice.type] = (state.completedByType[choice.type] || 0) + 1;
      } else if (status === 'DENIED') state.counters.denied++;
      else { state.counters.unresolvedReplays++; state.unresolved.push({ decision: clone(choice), response: clone(response) }); }
      if (!replayed || status === 'DENIED') state.receipts.push({ idempotencyKey, status, responseSha256: hash(response) });
      state.pending = null; validate(state, configuration); return this.summary();
    },
    checkpoint() { validate(state, configuration); const payload = clone(state); return { payload, sha256: hash(payload) }; },
    restore(value) { assert.equal(value.sha256, hash(value.payload), 'Checkpoint checksum mismatch'); validate(value.payload, configuration); state = clone(value.payload); return this; },
    summary() { validate(state, configuration); return { ...clone(state.counters), completedByType: clone(state.completedByType), matrixQualifying: false }; }
  };
}
