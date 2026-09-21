// Bounded Law workload, selected only from ordinary own-character and public rules views.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const clone = (value) => structuredClone(value);
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const identifier = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value);
export const LAW_POLICY_CONTRACT = Object.freeze({ version: 1, scenarioId: 'law_pressure',
  authority: 'Verified bearer account, ordinary /v1/session, /v1/me and /v1/law; public /v1/rules crimes, crimeApproaches and pacing. No database observer input.',
  pressure: 'Cheapest eligible nerve-cost crime with public loud heat; seed ranks ties. At own heat>=95 pause300 seconds unless already indicted. Neither nerve nor heat nor exposure is granted or pinned.',
  phases: 'Caller records pressure, plea, trial, await-sweep or recover. Ordinary plea/trial requires own public indictment. Recover uses a public zero-heat quiet crime after original jail expiry. A wait proves only the implemented branch, never absence of other legal progression.',
  identity: 'Checkpoint the complete pending method/path/body/key before dispatch. Missing response reuses exact identity. Retain unknown replay decision/receipt and block new choices; known exact receipt replays add no fresh completion.',
  exclusions: 'Bribes, retainer, jury, envelope, informants, witness protection, paid cooling, family perks, replacement characters, all Law branches and full90day/matrix qualification.' });
const counters = () => ({ observations: 0, choices: 0, waits: 0, fresh: 0, denials: 0, knownReplays: 0,
  unresolvedReplays: 0, crimeWins: 0, crimeFailures: 0, pleaded: 0, convicted: 0, acquitted: 0, forfeited: 0 });
function validate(state, configuration) {
  assert.equal(state.version, 1); assert.deepEqual(state.configuration, configuration);
  assert.deepEqual(Object.keys(state.counters).sort(), Object.keys(counters()).sort());
  for (const n of Object.values(state.counters)) assert(Number.isSafeInteger(n) && n >= 0);
  const c = state.counters;
  assert.equal(c.observations, c.choices + c.waits);
  assert.equal(c.choices, c.fresh + c.denials + c.unresolvedReplays + Number(!!state.pending));
  assert.equal(state.settled.length, c.fresh + c.denials + c.unresolvedReplays);
  assert.equal(new Set(state.settled).size, state.settled.length);
  assert.equal(state.unresolved.length, c.unresolvedReplays);
  for (const entry of state.unresolved) {
    assert(state.settled.includes(entry.decision.request.idempotencyKey));
    assert.equal(entry.responseSha256, hash(entry.response));
  }
  assert.equal(Object.values(state.completedByType).reduce((sum, n) => sum + n, 0), c.fresh);
}
export function createLawPolicy(configuration) {
  assert.deepEqual(Object.keys(configuration).sort(), ['accountId', 'seed']);
  assert(identifier(configuration.accountId)); assert(typeof configuration.seed === 'string' && configuration.seed.length > 0);
  configuration = clone(configuration);
  let state = { version: 1, configuration, characterId: null, counters: counters(), pending: null,
    settled: [], receipts: [], unresolved: [], completedByType: {}, observedStages: [], maxHeat: 0, maxExposure: 0 };
  return {
    choose(view, { logicalAt, phase = 'pressure' }) {
      assert(Number.isSafeInteger(logicalAt) && logicalAt >= 0);
      assert(['pressure', 'plea', 'trial', 'await-sweep', 'recover'].includes(phase));
      assert.equal(view.accountId, configuration.accountId, 'Foreign account context');
      const own = view.me?.character, law = view.law;
      assert(view.session?.authed === true && own && view.session.character?.id === own.id, 'Foreign own-character view');
      assert(identifier(own.id)); assert(law && typeof law.indicted === 'boolean');
      for (const n of [own.nerve, own.level, own.heat, own.jailSeconds, law.exposure]) assert(Number.isFinite(n) && n >= 0);
      assert(Array.isArray(view.rules?.crimes) && Array.isArray(view.rules?.crimeApproaches));
      assert(state.characterId === null || state.characterId === own.id, 'Replacement character needs a separate explicit cursor');
      if (state.pending) return clone(state.pending);
      assert.equal(state.counters.unresolvedReplays, 0, 'Unresolved completion after replay');
      state.characterId = own.id; state.counters.observations++;
      state.maxHeat = Math.max(state.maxHeat, own.heat); state.maxExposure = Math.max(state.maxExposure, law.exposure);
      if (!state.observedStages.includes(law.stage)) state.observedStages.push(law.stage);
      const wait = (reason, seconds = null) => { state.counters.waits++; validate(state, configuration);
        return { kind: 'wait', phase, reason, retryAfterSeconds: seconds,
          scope: 'Implemented branch only; other ordinary progression remains unassessed.' }; };
      if (own.jailSeconds > 0) return wait('original-detention', own.jailSeconds);
      if (phase === 'await-sweep') return law.indicted
        ? wait('canonical-grace-and-worker-sweep', Math.max(1, law.graceSeconds || 300)) : wait('no-issued-indictment');
      let type, path, body;
      if (['plea', 'trial'].includes(phase)) {
        if (!law.indicted) return wait('no-issued-indictment');
        if (phase === 'plea') assert(law.plea && law.plea.jailSeconds > 0 && law.plea.forfeitRate > 0, 'Missing public plea quote');
        type = 'law.' + phase; path = '/v1/law/' + phase; body = {};
      } else {
        if (phase === 'recover' && law.indicted) return wait('unresolved-indictment');
        if (phase === 'pressure' && own.heat >= 95 && !law.indicted) return wait('sustained-heat-observation-window', 300);
        const approachId = phase === 'pressure' ? 'loud' : 'quiet';
        const approach = view.rules.crimeApproaches.find((entry) => entry.id === approachId);
        assert(approach && (phase === 'pressure' ? approach.heat > 0 : approach.heat === 0), 'Missing public crime approach');
        const unlocked = view.rules.crimes.filter((crime) => {
          assert(identifier(crime.id) && Number.isSafeInteger(crime.nerve) && crime.nerve > 0 && crime.lvl >= 1, 'Invalid public crime');
          return crime.lvl <= own.level;
        });
        const eligible = unlocked.filter((crime) => crime.nerve <= own.nerve);
        if (!eligible.length) {
          const regen = view.rules.pacing?.nerveRegenPerMin;
          assert(Number.isFinite(regen) && regen > 0, 'Missing public nerve regeneration rate');
          return wait('nerve-regeneration', unlocked.length ? Math.max(1, Math.ceil((Math.min(...unlocked.map((c) => c.nerve)) - own.nerve) * 60 / regen)) : null);
        }
        eligible.sort((a, b) => a.nerve - b.nerve || hash([configuration, state.counters.choices, a.id]).localeCompare(hash([configuration, state.counters.choices, b.id])));
        type = phase === 'pressure' ? 'law.pressure-crime' : 'law.recovery-crime';
        path = '/v1/crimes/' + eligible[0].id; body = { approach: approachId };
      }
      const request = { method: 'POST', path, body };
      request.idempotencyKey = 'rc1-law-' + hash([configuration, state.counters.choices, own.id, request]);
      state.pending = { kind: 'command', type, phase, characterId: own.id, logicalAt, request };
      state.counters.choices++; validate(state, configuration); return clone(state.pending);
    },
    settle({ idempotencyKey, status, replayed, response }) {
      assert(['COMPLETED', 'DENIED'].includes(status)); assert.equal(typeof replayed, 'boolean');
      const known = state.receipts.find((entry) => entry.idempotencyKey === idempotencyKey);
      if (known) {
        assert(replayed && known.status === status && known.responseSha256 === hash(response), 'Conflicting replay receipt');
        state.counters.knownReplays++; return this.summary();
      }
      assert(state.pending && idempotencyKey === state.pending.request.idempotencyKey, 'Unexpected Law completion identity');
      const decision = state.pending, c = state.counters;
      if (status === 'COMPLETED' && !replayed) {
        assert.equal(response?.ok, true);
        if (response.character) assert.equal(response.character.id, decision.characterId, 'Foreign response character');
        if (decision.type.endsWith('-crime')) {
          assert.equal(response.approach, decision.request.body.approach); assert.equal(typeof response.success, 'boolean');
          c[response.success ? 'crimeWins' : 'crimeFailures']++;
        } else {
          assert(Number.isSafeInteger(response.forfeited) && response.forfeited >= 0);
          assert(Number.isSafeInteger(response.jailSeconds) && response.jailSeconds >= 0);
          if (decision.type === 'law.plea') { assert(response.jailSeconds > 0); c.pleaded++; }
          else { assert.equal(typeof response.convicted, 'boolean'); c[response.convicted ? 'convicted' : 'acquitted']++; }
          c.forfeited += response.forfeited;
        }
        c.fresh++; state.completedByType[decision.type] = (state.completedByType[decision.type] || 0) + 1;
      } else if (status === 'DENIED') c.denials++;
      else { c.unresolvedReplays++; state.unresolved.push({ decision: clone(decision), response: clone(response), responseSha256: hash(response) }); }
      if (!replayed || status === 'DENIED') state.receipts.push({ idempotencyKey, status, responseSha256: hash(response) });
      state.settled.push(idempotencyKey); state.pending = null; validate(state, configuration); return this.summary();
    },
    checkpoint() { validate(state, configuration); const payload = clone(state); return { payload, sha256: hash(payload) }; },
    restore(checkpoint) { assert.equal(checkpoint.sha256, hash(checkpoint.payload), 'Checkpoint checksum mismatch');
      validate(checkpoint.payload, configuration); state = clone(checkpoint.payload); return this; },
    summary() { validate(state, configuration); return { ...clone(state.counters), completedByType: clone(state.completedByType),
      observedStages: clone(state.observedStages), maxHeat: state.maxHeat, maxExposure: state.maxExposure, matrixQualifying: false }; },
  };
}
