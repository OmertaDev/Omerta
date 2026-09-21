// Scoped release workload actor: public reads only; the HTTP server owns combat.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const copy = (value) => structuredClone(value);
const nonviolentTypes = Object.freeze(['mystery.start', 'mystery.discover', 'mystery.complete', 'mystery.choice',
  'discovery.start', 'discovery.act', 'knowledge.share', 'knowledge.revoke', 'recipe.craft', 'item.salvage']);
export const AGGRESSION_POLICY_CONTRACT = Object.freeze({ version: 1, scenarioId: 'high_aggression',
  conflict: 'Only standard street jump is implemented. The complete conflict inventory and unsupported authorities remain explicit in the guide.',
  inputs: 'Authorized /v1/commands, /v1/me, /v1/streets and /v1/rivals responses. No target stats, accounts, diagnostics or hidden protections.',
  publicRuleConstants: { energy: 25, ammo: 5, minimumHealth: 20, intent: 'standard',
    source: 'Published source src/rules.tail.js M3.JUMP_*; native test checks these constants against the canonical definitions.' },
  eligibility: 'Publicly plausible same-district targets only. Hidden protection/crew gates and changed state remain canonical revalidation; only admitted fresh completions enter the denominator.',
  quota: 'For n fresh completed choices whose observed candidates included conflict and nonconflict, conflict=floor(7*n/10). Exactly 70% at complete multiples of ten; incomplete blocks round down. Single-class choices are forced and reported separately.',
  denominator: 'Fresh completed selections from the implemented jump, heal and reviewed nonviolent PlayerCommand scope; reads, waits, denials and replays excluded.',
  nonviolentTypes,
  unknownCommands: 'Generic situation, world and operation commands are unclassified and excluded; their role in conflict cannot be inferred from a generic type.',
  recovery: 'When choosing the other class, an affordable publicly quoted heal takes priority. This preserves the class quota. Original hospital expiry remains authoritative.',
  replay: 'Persist pending request before HTTP dispatch and state after settlement. Never replace a pending idempotency key after a lost response. A replay without a recorded fresh settlement is unresolved and blocks further choices.',
  qualification: 'No all-conflict, whole-game, replacement-character, 90-day, worker, resource, matrix or production qualification.' });

const emptyCounters = () => ({ observations: 0, choices: 0, noCandidateWaits: 0, fresh: 0, freshConflict: 0,
  mixedFresh: 0, mixedConflict: 0, forcedConflict: 0, forcedOther: 0,
  conflictPreferenceAttempts: 0, otherPreferenceAttempts: 0, forcedConflictAttempts: 0, forcedOtherAttempts: 0,
  denials: 0, unresolvedReplays: 0, wins: 0, losses: 0, heals: 0, retaliationAttempts: 0, retaliationCompletions: 0 });
function validate(state, configuration) {
  assert.equal(state.version, 1); assert.deepEqual(state.configuration, configuration);
  assert.deepEqual(Object.keys(state.counters).sort(), Object.keys(emptyCounters()).sort());
  for (const n of Object.values(state.counters)) assert(Number.isSafeInteger(n) && n >= 0);
  const c = state.counters;
  assert.equal(c.observations, c.choices + c.noCandidateWaits);
  assert.equal(c.choices, c.fresh + c.denials + c.unresolvedReplays + Number(!!state.pending));
  assert.equal(c.choices, c.conflictPreferenceAttempts + c.otherPreferenceAttempts + c.forcedConflictAttempts + c.forcedOtherAttempts);
  assert.equal(c.fresh, c.mixedFresh + c.forcedConflict + c.forcedOther);
  assert.equal(c.freshConflict, c.mixedConflict + c.forcedConflict);
  assert.equal(c.mixedConflict, Math.floor(c.mixedFresh * 7 / 10));
  assert.equal(c.wins + c.losses, c.freshConflict);
  assert.equal(state.settled.length, c.fresh + c.denials + c.unresolvedReplays);
  assert.equal(new Set(state.settled).size, state.settled.length);
  assert(c.retaliationCompletions <= c.retaliationAttempts);
  assert(c.heals <= c.fresh - c.freshConflict);
  assert.equal(Object.values(state.completedByType).reduce((sum, value) => {
    assert(Number.isSafeInteger(value) && value >= 0); return sum + value;
  }, 0), c.fresh);
}

export function createAggressionPolicy(configuration) {
  assert.deepEqual(Object.keys(configuration).sort(), ['accountId', 'seed']);
  assert(typeof configuration.accountId === 'string' && configuration.accountId.length > 0);
  assert(typeof configuration.seed === 'string' && configuration.seed.length > 0);
  configuration = copy(configuration);
  let state = { version: 1, configuration, counters: emptyCounters(), settled: [], completedByType: {}, pending: null };
  return {
    choose(view, { logicalAt }) {
      assert(Number.isSafeInteger(logicalAt) && logicalAt >= 0);
      const board = view.commands, own = view.me?.character;
      assert.equal(board?.player?.id, configuration.accountId, 'Foreign command projection');
      assert.equal(board.commandSchemaVersion, 1); assert(Array.isArray(board.commands));
      assert(own && own.id === board.player.character?.id, 'Foreign own-character projection');
      assert(Array.isArray(view.streets?.streets)); assert(Array.isArray(view.rivals?.rivals));
      if (state.pending) return copy(state.pending);
      assert.equal(state.counters.unresolvedReplays, 0, 'Unresolved fresh completion after replay');
      const candidates = [], unclassifiedTypes = new Set(), seen = new Set();
      for (const command of board.commands) {
        if (command.availability !== 'AVAILABLE') continue;
        const id = command.executionIdentity?.executionId;
        if (!/^[a-f0-9]{64}$/.test(command.commandId || '') || !new RegExp(`^[a-f0-9]{64}\\.${command.commandId}$`).test(id || '')
          || !Number.isFinite(Date.parse(command.expiresAt)) || Date.parse(command.expiresAt) <= logicalAt) continue;
        assert(!seen.has(id), 'Duplicate issued command'); seen.add(id);
        if (state.settled.includes(id)) continue;
        if (!nonviolentTypes.includes(command.commandType)) { unclassifiedTypes.add(command.commandType); continue; }
        candidates.push({ category: 'other', type: command.commandType, stableId: command.commandId,
          request: { authority: 'player-command', method: 'POST', path: '/v1/commands/execute',
            body: { executionId: id, confirmed: true }, idempotencyKey: id }, parameters: copy(command.parameters || {}) });
      }
      if (Number.isFinite(own.healCost) && own.healCost > 0 && own.cash >= own.healCost && own.health < 100)
        candidates.push({ category: 'other', type: 'legacy.heal', stableId: 'heal',
          request: { authority: 'legacy-http', method: 'POST', path: '/v1/heal', body: {} } });
      const ready = own.health >= 20 && own.energy >= 25 && own.ammo >= 5
        && own.jailSeconds === 0 && own.hospSeconds === 0 && own.safeSeconds === 0 && own.law?.witproSeconds === 0;
      const rivalIds = new Set(view.rivals.rivals.map((rival) => rival.street?.id).filter(Boolean));
      if (ready) for (const target of view.streets.streets) {
        assert(typeof target.id === 'string' && /^[a-zA-Z0-9_-]+$/.test(target.id), 'Invalid public street identity');
        if (target.id === own.id || target.loc !== own.loc || target.jailed !== false || target.hospitalized !== false
          || (own.gang?.tag && target.gangTag === own.gang.tag)) continue;
        const stableId = `jump:${target.id}`; assert(!seen.has(stableId), 'Duplicate street target'); seen.add(stableId);
        candidates.push({ category: 'conflict', type: 'legacy.jump', stableId, retaliation: rivalIds.has(target.id),
          request: { authority: 'legacy-http', method: 'POST', path: `/v1/streets/${target.id}/jump`, body: { intent: 'standard' } } });
      }
      const c = state.counters, conflict = candidates.filter((choice) => choice.category === 'conflict');
      const other = candidates.filter((choice) => choice.category === 'other');
      const mixed = conflict.length > 0 && other.length > 0;
      c.observations++;
      const observedCandidates = { conflict: conflict.length, other: other.length, unclassifiedTypes: [...unclassifiedTypes].sort() };
      if (!candidates.length) {
        c.noCandidateWaits++;
        return { kind: 'wait', observedCandidates, classification: 'No implemented publicly plausible candidate; other authorities and future recovery are unassessed. Not a dead-world finding.' };
      }
      const category = mixed ? Math.floor((c.mixedFresh + 1) * 7 / 10) > Math.floor(c.mixedFresh * 7 / 10) ? 'conflict' : 'other'
        : conflict.length ? 'conflict' : 'other';
      const eligible = category === 'conflict' ? conflict : other;
      eligible.sort((a, b) => Number(b.type === 'legacy.heal') - Number(a.type === 'legacy.heal')
        || Number(!!b.retaliation) - Number(!!a.retaliation)
        || hash([configuration, c.choices, a.stableId]).localeCompare(hash([configuration, c.choices, b.stableId])));
      const selected = copy(eligible[0]);
      selected.request.idempotencyKey ||= `rc1-aggression-${hash([configuration, c.choices, selected.request])}`;
      c.choices++; c[mixed ? category === 'conflict' ? 'conflictPreferenceAttempts' : 'otherPreferenceAttempts'
        : category === 'conflict' ? 'forcedConflictAttempts' : 'forcedOtherAttempts']++;
      if (selected.retaliation) c.retaliationAttempts++;
      state.pending = { kind: 'command', category, mixed, observedCandidates, ...selected };
      validate(state, configuration); return copy(state.pending);
    },
    settle({ idempotencyKey, status, replayed, response }) {
      assert(state.pending); assert.equal(idempotencyKey, state.pending.request.idempotencyKey);
      assert(['COMPLETED', 'DENIED'].includes(status));
      if (status === 'COMPLETED') assert.equal(typeof replayed, 'boolean');
      const choice = state.pending, c = state.counters;
      if (status === 'COMPLETED' && !replayed) {
        if (choice.type === 'legacy.jump') { assert.equal(response?.ok, true); assert.equal(typeof response.win, 'boolean'); }
        else if (choice.type === 'legacy.heal') assert(response?.ok === true && response.healed > 0 && response.health === 100);
        else assert.equal(response?.status, 'COMPLETED');
      }
      if (status === 'DENIED') c.denials++;
      else if (replayed) c.unresolvedReplays++;
      else {
        c.fresh++;
        if (choice.category === 'conflict') { c.freshConflict++; c[response.win ? 'wins' : 'losses']++; }
        if (choice.mixed) { c.mixedFresh++; if (choice.category === 'conflict') c.mixedConflict++; }
        else c[choice.category === 'conflict' ? 'forcedConflict' : 'forcedOther']++;
        if (choice.type === 'legacy.heal') c.heals++;
        if (choice.retaliation) c.retaliationCompletions++;
        state.completedByType[choice.type] = (state.completedByType[choice.type] || 0) + 1;
      }
      state.settled.push(idempotencyKey); state.pending = null; validate(state, configuration); return this.summary();
    },
    checkpoint() { validate(state, configuration); const payload = copy(state); return { payload, sha256: hash(payload) }; },
    restore(checkpoint) {
      assert.equal(checkpoint.sha256, hash(checkpoint.payload), 'Checkpoint checksum mismatch');
      validate(checkpoint.payload, configuration); state = copy(checkpoint.payload); return this;
    },
    summary() {
      validate(state, configuration); const c = state.counters;
      return { configuration: copy(configuration), ...copy(c), completedByType: copy(state.completedByType),
        actualConflictFraction: c.fresh ? c.freshConflict / c.fresh : null,
        mixedConflictFraction: c.mixedFresh ? c.mixedConflict / c.mixedFresh : null,
        incompleteBlockChoices: c.mixedFresh % 10, matrixQualifying: false };
    },
  };
}
