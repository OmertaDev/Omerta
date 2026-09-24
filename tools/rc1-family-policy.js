// Public-view Family membership/leadership workload; no private world model.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const clone = (value) => structuredClone(value);
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const id = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value);
const scenarios = ['family_monopoly', 'fragmented_families'];
export const FAMILY_POLICY_CONTRACT = Object.freeze({ version: 1,
  authority: 'Verified bearer subject, own /v1/session and /v1/me; public /v1/gangs, own public /v1/gangs/:id and /v1/rules. No hidden inventory, membership or observer input.',
  constraints: 'Reviewed canonical createGang: level5, cash25000; joinGang cap20, no join level/cash gate. Join is immediate: no Family request/approval queue. Boss promotes, boss/underboss kicks, departure may transfer leadership.',
  entry: 'Monopoly policy prefers the largest public player Family; fragmented policy prefers the smallest below20% of its declared25-person cohort. A full denial blocks another attempt at that observed count until the public count falls. Absence of a candidate is not a global no-progression claim.',
  phases: 'Recorded found/enter/concentrate/tribute/promote/leave/progress phases. Optional targetFamilyId is an intended public target, never hidden eligibility. Founding gates only on public quoted cost; canonical level/uniqueness checks remain authoritative.',
  replay: 'Persist complete pending request before dispatch, retain it on lost response, verify known replay hash, retain unknown completed replay with exact decision and block new choices.',
  resourceScope: 'Initial concentration is relative to a finite declared cohort. Only exercised cash/treasury distribution is qualified; no claim to a finite global maximum or all13 resource extremes.',
  exclusions: 'Alliances, war, operations, roster posts, officer kicks, paid reserves/gear/territory, full25-active long-term work,90day/225-run matrix.' });
export function planFamilyFixture(scenario, population = 25) {
  assert(scenarios.includes(scenario)); assert([25, 100, 250, 500, 1000].includes(population));
  const members = population === 25 ? 23 : Math.floor(population * .9);
  const familyCount = Math.max(10, Math.ceil(members / 20));
  const sizes = scenario === 'family_monopoly' ? [Math.min(20, Math.floor(population * .8))]
    : Array.from({ length: familyCount }, (_, index) => Math.floor(members / familyCount) + Number(index < members % familyCount));
  let cursor = 0;
  const groups = sizes.map((size) => { const members = Array.from({ length: size }, () => cursor++); return { founder: members[0], members }; });
  return { scenario, population, groups, outsiders: Array.from({ length: population - cursor }, () => cursor++),
    founderLevel: 75, formationLevelMinimum: 5, canonicalMaximumMembers: 20,
    realizedLargestFamilyFraction: Math.max(...sizes) / population,
    legalConstraint: scenario === 'family_monopoly' && population > 25
      ? 'Canonical joinGang caps one Family at20 members;80% of this larger cohort cannot join one Family. Use that maximum legal position and retain all outsiders.' : null,
    initialization: 'Ordinary guest/character entries. Only listed founder respect is initialized to level75 before baseline; an actual ordinary check-in funds each actual25000 formation. All memberships and cash concentration use canonical routes.' };
}
const blank = () => ({ observations: 0, choices: 0, waits: 0, fresh: 0, denials: 0, knownReplays: 0, unresolvedReplays: 0, crimeWins: 0 });
function validate(s, c) {
  assert.equal(s.version, 1); assert.deepEqual(s.configuration, c);
  assert.deepEqual(Object.keys(s.counters).sort(), Object.keys(blank()).sort());
  for (const n of Object.values(s.counters)) assert(Number.isSafeInteger(n) && n >= 0);
  const n = s.counters;
  assert.equal(n.observations, n.choices + n.waits);
  assert.equal(n.choices, n.fresh + n.denials + n.unresolvedReplays + Number(!!s.pending));
  assert.equal(s.settled.length, n.fresh + n.denials + n.unresolvedReplays);
  assert.equal(new Set(s.settled).size, s.settled.length); assert.equal(s.unresolved.length, n.unresolvedReplays);
  for (const entry of s.unresolved) { assert(s.settled.includes(entry.decision.request.idempotencyKey)); assert.equal(entry.responseSha256, hash(entry.response)); }
  assert.equal(Object.values(s.completedByType).reduce((a, b) => a + b, 0), n.fresh);
}
export function createFamilyPolicy(configuration) {
  assert.deepEqual(Object.keys(configuration).sort(), ['accountId', 'population', 'scenario', 'seed']);
  assert(id(configuration.accountId)); assert(typeof configuration.seed === 'string' && configuration.seed.length > 0);
  assert(scenarios.includes(configuration.scenario)); assert([25, 100, 250, 500, 1000].includes(configuration.population));
  configuration = clone(configuration);
  let state = { version: 1, configuration, characterId: null, counters: blank(), pending: null,
    settled: [], receipts: [], unresolved: [], blockedFull: {}, completedByType: {} };
  return {
    choose(view, { logicalAt, phase = 'enter', targetFamilyId = null }) {
      assert(Number.isSafeInteger(logicalAt) && logicalAt >= 0);
      assert(['found', 'enter', 'concentrate', 'tribute', 'promote', 'leave', 'progress'].includes(phase));
      assert.equal(view.accountId, configuration.accountId, 'Foreign account context');
      const own = view.me?.character;
      assert(view.session?.authed === true && own && view.session.character?.id === own.id, 'Foreign own-character view');
      assert(id(own.id)); assert(Array.isArray(view.directory?.gangs)); assert(view.rules?.family);
      assert(state.characterId === null || state.characterId === own.id, 'Replacement character requires explicit cursor');
      if (state.pending) return clone(state.pending);
      assert.equal(state.counters.unresolvedReplays, 0, 'Unresolved completed replay');
      state.characterId = own.id; state.counters.observations++;
      const wait = (reason, retryAfterSeconds = null) => { state.counters.waits++; validate(state, configuration);
        return { kind: 'wait', phase, reason, retryAfterSeconds, scope: 'This implemented social choice only; other progression is unassessed.' }; };
      let type, path, body, observedFamilyMembers = null;
      const seeded = (a, b) => hash([configuration, state.counters.choices, a.id]).localeCompare(hash([configuration, state.counters.choices, b.id]));
      if (phase === 'enter') {
        if (own.gang) return wait('already-member');
        const rows = view.directory.gangs.filter((g) => {
          assert(id(g.id) && Number.isSafeInteger(g.members) && g.members >= 0, 'Invalid public Family');
          return !g.npc && (!targetFamilyId || targetFamilyId === g.id)
            && !(state.blockedFull[g.id] !== undefined && g.members >= state.blockedFull[g.id])
            && (configuration.scenario !== 'fragmented_families' || g.members < Math.floor(configuration.population * 0.2));
        });
        rows.sort((a, b) => (configuration.scenario === 'family_monopoly' ? b.members - a.members : a.members - b.members) || seeded(a, b));
        if (!rows.length) return wait(targetFamilyId ? 'target-not-currently-publicly-selectable' : 'no-implemented-entry-candidate');
        const target = rows[0]; type = 'family.enter'; path = '/v1/gangs/' + target.id + '/join'; body = {}; observedFamilyMembers = target.members;
      } else if (phase === 'found') {
        if (own.gang) return wait('already-member');
        assert(Number.isSafeInteger(view.rules.family.foundCost) && view.rules.family.foundCost > 0);
        if (own.cash < view.rules.family.foundCost) return wait('formation-cash');
        const stamp = hash([configuration, 'formation']);
        body = { name: 'RC1 Family ' + stamp.slice(0, 8), tag: stamp.slice(0, 4).toUpperCase() };
        if (view.directory.gangs.some((g) => g.name === body.name || g.tag === body.tag)) return wait('public-name-taken');
        type = 'family.found'; path = '/v1/gangs';
      } else if (['concentrate', 'tribute'].includes(phase)) {
        if (!own.gang) return wait('not-a-member');
        const minimum = view.rules.family.tributeMin; assert(Number.isSafeInteger(minimum) && minimum > 0);
        if (own.cash < minimum) return wait('tribute-cash');
        type = 'family.tribute'; path = '/v1/gangs/tribute'; body = { amount: phase === 'concentrate' ? Math.floor(own.cash) : minimum };
      } else if (phase === 'promote') {
        if (!own.gang || own.gang.role !== 'boss') return wait('not-the-boss');
        const family = view.family?.gang; assert(family?.id === own.gang.id && Array.isArray(family.members), 'Wrong public own-Family roster');
        if (family.members.some((m) => m.role === 'underboss')) return wait('underboss-already-seated');
        const members = family.members.filter((m) => { assert(id(m.id)); return m.id !== own.id && ['soldier', 'capo'].includes(m.role); });
        members.sort(seeded); if (!members.length) return wait('no-public-promotable-member');
        type = 'family.promote'; path = '/v1/gangs/promote'; body = { characterId: members[0].id, role: 'underboss' };
      } else if (phase === 'leave') {
        if (!own.gang) return wait('not-a-member'); type = 'family.leave'; path = '/v1/gangs/leave'; body = {};
      } else {
        if (own.jailSeconds > 0) return wait('original-detention', own.jailSeconds);
        assert(Array.isArray(view.rules.crimes)); assert(view.rules.crimeApproaches.some((a) => a.id === 'quiet' && a.heat === 0));
        const unlocked = view.rules.crimes.filter((crime) => { assert(id(crime.id) && crime.nerve > 0); return crime.lvl <= own.level; });
        const eligible = unlocked.filter((crime) => crime.nerve <= own.nerve); eligible.sort((a, b) => a.nerve - b.nerve || seeded(a, b));
        if (!eligible.length) { const rate = view.rules.pacing?.nerveRegenPerMin; assert(rate > 0);
          return wait('ordinary-nerve-regeneration', unlocked.length ? Math.max(1, Math.ceil((Math.min(...unlocked.map((c) => c.nerve)) - own.nerve) * 60 / rate)) : null); }
        type = 'family.progress'; path = '/v1/crimes/' + eligible[0].id; body = { approach: 'quiet' };
      }
      const request = { method: 'POST', path, body };
      request.idempotencyKey = 'rc1-family-' + hash([configuration, state.counters.choices, own.id, request]);
      state.pending = { kind: 'command', type, phase, characterId: own.id, logicalAt, observedFamilyMembers, request };
      state.counters.choices++; validate(state, configuration); return clone(state.pending);
    },
    settle({ idempotencyKey, status, replayed, response }) {
      assert(['COMPLETED', 'DENIED'].includes(status)); assert.equal(typeof replayed, 'boolean');
      const known = state.receipts.find((entry) => entry.idempotencyKey === idempotencyKey);
      if (known) { assert(replayed && known.status === status && known.responseSha256 === hash(response), 'Conflicting replay receipt');
        state.counters.knownReplays++; return this.summary(); }
      assert(state.pending && idempotencyKey === state.pending.request.idempotencyKey, 'Unexpected Family completion identity');
      const choice = state.pending, c = state.counters;
      if (status === 'COMPLETED' && !replayed) {
        assert.equal(response?.ok, true);
        if (response.character) assert.equal(response.character.id, choice.characterId, 'Foreign response character');
        if (choice.type === 'family.found') assert(id(response.gangId));
        if (choice.type === 'family.enter') assert.equal('/v1/gangs/' + response.gangId + '/join', choice.request.path);
        if (choice.type === 'family.tribute') { assert.equal(response.amount, choice.request.body.amount); assert.equal(response.currency, 'cash'); }
        if (choice.type === 'family.promote') { assert.equal(response.op, 'promote'); assert.equal(response.role, choice.request.body.role); }
        if (choice.type === 'family.leave') assert.equal(typeof response.dissolved, 'boolean');
        if (choice.type === 'family.progress') { assert.equal(response.approach, 'quiet'); assert.equal(typeof response.success, 'boolean'); if (response.success) c.crimeWins++; }
        c.fresh++; state.completedByType[choice.type] = (state.completedByType[choice.type] || 0) + 1;
      } else if (status === 'DENIED') {
        c.denials++;
        if (choice.type === 'family.enter' && response.error === 'full') state.blockedFull[choice.request.path.split('/')[3]] = choice.observedFamilyMembers;
      } else { c.unresolvedReplays++; state.unresolved.push({ decision: clone(choice), response: clone(response), responseSha256: hash(response) }); }
      if (!replayed || status === 'DENIED') state.receipts.push({ idempotencyKey, status, responseSha256: hash(response) });
      state.settled.push(idempotencyKey); state.pending = null; validate(state, configuration); return this.summary();
    },
    checkpoint() { validate(state, configuration); const payload = clone(state); return { payload, sha256: hash(payload) }; },
    restore(checkpoint) { assert.equal(checkpoint.sha256, hash(checkpoint.payload), 'Checkpoint checksum mismatch'); validate(checkpoint.payload, configuration); state = clone(checkpoint.payload); return this; },
    summary() { validate(state, configuration); return { ...clone(state.counters), completedByType: clone(state.completedByType), blockedFull: clone(state.blockedFull), matrixQualifying: false }; },
  };
}
