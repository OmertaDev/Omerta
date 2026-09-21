// Sealed stakes use only this actor's treasury, own receipt and public district projection.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const copy = (v) => structuredClone(v), hash = (v) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const TURF_POLICY_CONTRACT = Object.freeze({ version: 1,
  authority: 'Verified account, own session/me, public /v1/districts and own /v1/notifications. No other Family treasury or hidden bid input.',
  choice: 'Sealed total is max(public floor, own available treasury times declared commitment basis points plus deterministic seed jitter0..96), capped by own treasury. Incumbent may defend. Canonical refusal remains authoritative.',
  waiting: 'Only own contest_resolved notification plus public holder can establish outcome. Elapsed public contest timer alone is not escrow settlement.',
  privacy: 'Public district view exposes participation count but no stakes. Public Family treasury endpoints may permit inference; this is policy-input isolation, not absolute secrecy.',
  exclusions: ['Three-way war declaration (one war_with counterpart)', 'other Family objectives', 'adaptive rival-balance inference', 'full war archetype', '90-day/25-actor/three-seed matrix'] });
function validate(s, c) {
  assert.equal(s.version, 1); assert.deepEqual(s.configuration, c);
  for (const k of ['choices', 'fresh', 'denied', 'replays', 'waits']) assert(Number.isSafeInteger(s[k]) && s[k] >= 0);
  assert.equal(s.choices, s.fresh + s.denied + s.unresolved.length + Number(!!s.pending));
  assert.equal(s.receipts.length, s.fresh + s.denied); assert.equal(new Set(s.receipts.map((r) => r.key)).size, s.receipts.length);
}
export function createTurfPolicy(configuration) {
  assert.deepEqual(Object.keys(configuration).sort(), ['accountId', 'commitBps', 'seed']);
  assert(typeof configuration.accountId === 'string' && configuration.accountId); assert(typeof configuration.seed === 'string' && configuration.seed);
  assert(Number.isSafeInteger(configuration.commitBps) && configuration.commitBps > 0 && configuration.commitBps <= 10000);
  configuration = copy(configuration);
  let state = { version: 1, configuration, characterId: null, familyId: null, pending: null, commitment: null, outcome: null,
    choices: 0, fresh: 0, denied: 0, replays: 0, waits: 0, receipts: [], unresolved: [] };
  return {
    choose(view, { districtId, logicalAt }) {
      assert(Number.isSafeInteger(logicalAt) && logicalAt >= 0); assert(/^[a-z-]+$/.test(districtId));
      assert(Object.keys(view).every((k) => ['accountId', 'session', 'me', 'districts', 'notifications'].includes(k)), 'Unapproved policy input');
      assert.equal(view.accountId, configuration.accountId); const own = view.me?.character;
      assert(view.session?.authed === true && own?.id === view.session.character?.id, 'Wrong actor view');
      assert(!state.characterId || state.characterId === own.id, 'Replacement requires explicit cursor');
      assert(!state.familyId || state.familyId === own.gang?.id, 'Changed Family requires explicit cursor');
      if (state.pending) return copy(state.pending); assert.equal(state.unresolved.length, 0, 'Unresolved completed replay');
      const wait = (reason) => { state.waits++; return { kind: 'wait', reason, districtId, scope: 'This turf commitment only' }; };
      if (!own.gang || !['boss', 'underboss'].includes(own.gang.role)) return wait('not-family-officer');
      state.characterId = own.id; state.familyId = own.gang.id;
      const district = view.districts?.districts?.find((d) => d.id === districtId); if (!district) return wait('district-not-public');
      if (state.outcome) return { kind: 'outcome', ...copy(state.outcome) };
      if (state.commitment) {
        assert.equal(state.commitment.districtId, districtId);
        const terminal = view.notifications?.notifications?.find((n) => n.type === 'contest_resolved' && n.payload.district === districtId);
        if (terminal) {
          const r = terminal.payload; assert.equal(r.staked, state.commitment.amount); assert.equal(typeof r.won, 'boolean');
          assert(Number.isSafeInteger(r.back) && r.back >= 0 && r.back <= r.staked);
          assert.equal(district.holder?.gangId === own.gang.id, r.won, 'Public holder and own outcome disagree');
          state.outcome = { districtId, won: r.won, staked: r.staked, refunded: r.back, notificationId: terminal.id };
          return { kind: 'outcome', ...copy(state.outcome) };
        }
        return wait(logicalAt < state.commitment.deadline ? 'original-contest-window' : 'await-canonical-settlement');
      }
      if (!district.holder) return wait('no-current-player-holder');
      assert(Number.isSafeInteger(district.claimFloor) && district.claimFloor > 0);
      const budget = own.gang.treasury; assert(Number.isSafeInteger(budget) && budget >= 0);
      if (budget < district.claimFloor) return wait('insufficient-own-treasury');
      const jitter = parseInt(hash([configuration, districtId]).slice(0, 8), 16) % 97;
      const amount = Math.min(budget, Math.max(district.claimFloor, Math.floor(budget * configuration.commitBps / 10000) + jitter));
      const request = { method: 'POST', path: '/v1/districts/' + districtId + '/claim', body: { amount } };
      request.idempotencyKey = 'rc1-turf-' + hash([configuration, state.choices, own.id, request]);
      state.pending = { kind: 'command', districtId, characterId: own.id, familyId: own.gang.id, logicalAt,
        expectedDefending: district.holder.gangId === own.gang.id, request }; state.choices++; validate(state, configuration); return copy(state.pending);
    },
    settle({ idempotencyKey, status, replayed, response }) {
      assert(['COMPLETED', 'DENIED'].includes(status)); assert.equal(typeof replayed, 'boolean');
      const prior = state.receipts.find((r) => r.key === idempotencyKey);
      if (prior) { assert(replayed && prior.status === status && prior.hash === hash(response), 'Conflicting replay'); state.replays++; return this.summary(); }
      assert(state.pending?.request.idempotencyKey === idempotencyKey, 'Wrong completion'); const p = state.pending;
      if (status === 'COMPLETED' && replayed) state.unresolved.push({ decision: copy(p), response: copy(response) });
      else {
        if (status === 'COMPLETED') {
          assert(response.ok && response.district === p.districtId && response.staked === p.request.body.amount);
          assert.equal(response.added, response.staked); assert.equal(response.defending, p.expectedDefending);
          assert(Number.isSafeInteger(response.resolvesSeconds) && response.resolvesSeconds > 0);
          assert(Number.isSafeInteger(response.lossBps) && response.lossBps >= 0 && response.lossBps < 10000);
          state.commitment = { districtId: p.districtId, amount: response.staked, lossBps: response.lossBps,
            deadline: p.logicalAt + response.resolvesSeconds * 1000 }; state.fresh++;
        } else { assert(typeof response.error === 'string'); state.denied++; }
        state.receipts.push({ key: idempotencyKey, status, hash: hash(response) });
      }
      state.pending = null; validate(state, configuration); return this.summary();
    },
    checkpoint() { validate(state, configuration); const payload = copy(state); return { payload, sha256: hash(payload) }; },
    restore(checkpoint) { assert.equal(checkpoint.sha256, hash(checkpoint.payload), 'Checkpoint checksum mismatch'); validate(checkpoint.payload, configuration); state = copy(checkpoint.payload); return this; },
    summary() { validate(state, configuration); return { choices: state.choices, fresh: state.fresh, denied: state.denied, replays: state.replays,
      waits: state.waits, unresolved: state.unresolved.length, commitment: copy(state.commitment), outcome: copy(state.outcome), matrixQualifying: false }; },
  };
}
