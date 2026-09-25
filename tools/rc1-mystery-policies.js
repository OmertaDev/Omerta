// Release actor tooling only. The caller supplies the actor's authorized public
// PlayerCommand projection; the canonical dispatcher still validates authority.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const copy = (value) => structuredClone(value);
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const investigations = Object.freeze(['mystery.start', 'mystery.discover', 'mystery.complete', 'mystery.choice', 'discovery.start', 'discovery.act']);
const other = Object.freeze(['knowledge.share', 'knowledge.revoke', 'recipe.craft', 'item.salvage', 'world.execute', 'situation.act',
  ...['create', 'publish', 'approve', 'execute', 'leave', 'cancel', 'expire', 'join', 'commit', 'contribute', 'withdraw'].map((action) => `operation.${action}`)]);
export const MYSTERY_POLICY_CONTRACT = Object.freeze({ version: 1,
  sourceReview: 'src/player-commands.js commandsFor/dispatch and src/coordination/operations.js projected actions',
  investigation: investigations, other,
  classification: 'Direct mystery/discovery commands count as investigation. Knowledge share/revoke are separately recorded propagation/access management. Crafting, world, situation and operation commands are not reclassified from hidden prerequisites.',
  denominator: 'Fresh COMPLETED PlayerCommand selections only; excludes reads, waits, denials, exact replays and all legacy actions.',
  high: 'Among fresh choices with both investigation and other issued alternatives, choose floor(7*n/10) investigation choices at every prefix n. Exactly 70% requires a completed multiple of ten; partial blocks use the lower integer. Single-class choices are forced and reported separately.',
  low: 'At every fresh-completion prefix n, investigation <= floor(n/20). If the next investigation exceeds this cap, choose an issued other command or wait. Waits never increase the denominator.',
  waiting: 'A policy cap wait is deliberate abstention, not a dead world. Missing commands do not establish global reachability; other canonical authorities and future expiry/recovery remain unassessed.',
  restart: 'Checkpoint before dispatch and after settlement. Persist the exact pending execution identity. A replay received before a recorded fresh settlement leaves an unresolved completion and requires journal/receipt reconciliation outside this helper.',
  scope: 'Selection component only; no 90-day, worker, resource, contention, legacy-action, late-entry or full-archetype qualification.' });

export function classifyMysteryCommand(type) {
  if (investigations.includes(type)) return 'investigation';
  if (other.includes(type)) return 'other';
  throw Error(`Unreviewed AVAILABLE PlayerCommand type: ${type}`);
}

const emptyCounters = () => ({ observations: 0, eligibleObservations: 0, mixedEligibilityObservations: 0,
  commandDecisions: 0, investigationPreferences: 0, otherPreferences: 0,
  forcedInvestigationDecisions: 0, forcedOtherDecisions: 0, noAvailableWaits: 0, deliberateCapWaits: 0,
  freshCompletions: 0, freshInvestigation: 0, freshOther: 0,
  freshMixedChoices: 0, freshMixedInvestigation: 0, freshForcedInvestigation: 0, freshForcedOther: 0,
  denials: 0, replays: 0, unresolvedReplayCompletions: 0 });
function validateState(state, config) {
  assert.equal(state.version, MYSTERY_POLICY_CONTRACT.version);
  assert.deepEqual(state.configuration, config, 'Checkpoint belongs to another seed, actor or policy');
  assert.deepEqual(Object.keys(state.counters).sort(), Object.keys(emptyCounters()).sort());
  for (const value of Object.values(state.counters)) assert(integer(value), 'Invalid policy counter');
  const c = state.counters;
  assert.equal(c.freshCompletions, c.freshInvestigation + c.freshOther);
  assert.equal(c.freshInvestigation, c.freshMixedInvestigation + c.freshForcedInvestigation);
  assert.equal(c.freshCompletions, c.freshMixedChoices + c.freshForcedInvestigation + c.freshForcedOther);
  assert.equal(c.commandDecisions, c.freshCompletions + c.denials + c.replays + Number(!!state.pending));
  assert.equal(c.replays, c.unresolvedReplayCompletions);
  assert.equal(c.observations, c.commandDecisions + c.noAvailableWaits + c.deliberateCapWaits);
  assert.equal(c.commandDecisions, c.investigationPreferences + c.otherPreferences + c.forcedInvestigationDecisions + c.forcedOtherDecisions);
  assert.equal(new Set(state.settledExecutionIds).size, state.settledExecutionIds.length);
  assert.equal(state.settledExecutionIds.length, c.freshCompletions + c.denials + c.replays);
  assert.equal(Object.values(state.completedByType).reduce((sum, n) => { assert(integer(n)); return sum + n; }, 0), c.freshCompletions);
  for (const type of Object.keys(state.completedByType)) classifyMysteryCommand(type);
  if (config.scenarioId === 'low_mystery_participation') assert(c.freshInvestigation <= Math.floor(c.freshCompletions / 20));
  else assert.equal(c.freshMixedInvestigation, Math.floor(c.freshMixedChoices * 7 / 10));
  if (state.pending) {
    assert.equal(state.pending.kind, 'command');
    assert.equal(state.pending.category, classifyMysteryCommand(state.pending.command.commandType));
    assert(!state.settledExecutionIds.includes(state.pending.command.executionIdentity.executionId));
  }
}

export function createMysteryPolicy(options) {
  assert.deepEqual(Object.keys(options).sort(), ['accountId', 'scenarioId', 'seed']);
  const config = copy(options);
  assert(['high_mystery_participation', 'low_mystery_participation'].includes(config.scenarioId));
  assert(typeof config.accountId === 'string' && config.accountId.length > 0);
  assert(typeof config.seed === 'string' && config.seed.length > 0);
  let state = { version: 1, configuration: config, counters: emptyCounters(), completedByType: {}, settledExecutionIds: [], pending: null };
  return {
    choose(view, { logicalAt }) {
      assert(integer(logicalAt), 'Use the runner logical clock');
      assert.equal(view.player?.id, config.accountId, 'Projection belongs to another actor');
      assert.equal(view.commandSchemaVersion, 1); assert(Array.isArray(view.commands));
      // Retry the persisted identity; never consume another choice after a lost response.
      if (state.pending) return copy(state.pending);
      assert.equal(state.counters.unresolvedReplayCompletions, 0, 'Resolve replay/commit evidence before further policy choices');
      const seen = new Set(), candidates = [];
      for (const command of view.commands) {
        if (command.availability !== 'AVAILABLE') continue;
        if (!/^[a-f0-9]{64}$/.test(command.commandId || '')
          || !new RegExp(`^[a-f0-9]{64}\\.${command.commandId}$`).test(command.executionIdentity?.executionId || '')) continue;
        if (!Number.isFinite(Date.parse(command.expiresAt)) || Date.parse(command.expiresAt) <= logicalAt) continue;
        const id = command.executionIdentity.executionId;
        assert(!seen.has(id), 'Duplicate issued command identity'); seen.add(id);
        if (state.settledExecutionIds.includes(id)) continue;
        candidates.push({ command, category: classifyMysteryCommand(command.commandType) });
      }
      const investigation = candidates.filter((c) => c.category === 'investigation');
      const alternatives = candidates.filter((c) => c.category === 'other');
      const counters = state.counters, mixed = investigation.length > 0 && alternatives.length > 0;
      counters.observations++;
      if (candidates.length) counters.eligibleObservations++;
      if (mixed) counters.mixedEligibilityObservations++;
      const counts = { investigation: investigation.length, other: alternatives.length };
      if (!candidates.length) {
        counters.noAvailableWaits++;
        return { kind: 'wait', reason: 'no_fresh_issued_available_command', candidates: counts,
          classification: 'Projection-local wait; global reachability and other canonical authorities unassessed' };
      }
      let category, basis;
      if (config.scenarioId === 'low_mystery_participation') {
        const room = counters.freshInvestigation + 1 <= Math.floor((counters.freshCompletions + 1) / 20);
        if (investigation.length && room) category = 'investigation';
        else if (alternatives.length) category = 'other';
        else {
          counters.deliberateCapWaits++;
          return { kind: 'wait', reason: 'investigation_prefix_cap', candidates: counts,
            classification: 'Deliberate policy abstention; caller may use other canonical progress. Not a dead-world finding.' };
        }
        basis = mixed ? 'preference' : 'forced';
      } else if (mixed) {
        category = Math.floor((counters.freshMixedChoices + 1) * 7 / 10) > Math.floor(counters.freshMixedChoices * 7 / 10)
          ? 'investigation' : 'other';
        basis = 'preference';
      } else { category = investigation.length ? 'investigation' : 'other'; basis = 'forced'; }
      const ranked = (category === 'investigation' ? investigation : alternatives).sort((a, b) =>
        hash([config, counters.commandDecisions, a.command.commandId]).localeCompare(hash([config, counters.commandDecisions, b.command.commandId])));
      const selected = ranked[0].command;
      counters.commandDecisions++;
      counters[basis === 'preference' ? `${category}Preferences` : category === 'investigation' ? 'forcedInvestigationDecisions' : 'forcedOtherDecisions']++;
      state.pending = { kind: 'command', category, basis, mixed, candidates: counts,
        command: { commandId: selected.commandId, commandType: selected.commandType,
          executionIdentity: copy(selected.executionIdentity), parameters: copy(selected.parameters || {}) } };
      validateState(state, config); return copy(state.pending);
    },
    settle(result) {
      assert(state.pending, 'No command awaiting settlement');
      assert.equal(result.executionId, state.pending.command.executionIdentity.executionId);
      assert(['COMPLETED', 'DENIED'].includes(result.status), 'Unknown outcome must remain pending');
      if (result.status === 'COMPLETED') assert.equal(typeof result.replayed, 'boolean');
      const { command, category, mixed } = state.pending, c = state.counters;
      if (result.status === 'DENIED') c.denials++;
      else if (result.replayed) { c.replays++; c.unresolvedReplayCompletions++; }
      else {
        c.freshCompletions++; c[category === 'investigation' ? 'freshInvestigation' : 'freshOther']++;
        if (mixed) { c.freshMixedChoices++; if (category === 'investigation') c.freshMixedInvestigation++; }
        else c[category === 'investigation' ? 'freshForcedInvestigation' : 'freshForcedOther']++;
        state.completedByType[command.commandType] = (state.completedByType[command.commandType] || 0) + 1;
      }
      state.settledExecutionIds.push(command.executionIdentity.executionId); state.pending = null;
      validateState(state, config); return this.summary();
    },
    checkpoint() { validateState(state, config); const payload = copy(state); return { payload, sha256: hash(payload) }; },
    restore(checkpoint) {
      assert.equal(checkpoint.sha256, hash(checkpoint.payload), 'Policy checkpoint checksum mismatch');
      validateState(checkpoint.payload, config); state = copy(checkpoint.payload); return this;
    },
    summary() {
      validateState(state, config);
      const c = state.counters;
      return { configuration: copy(config), ...copy(c), completedByType: copy(state.completedByType),
        actualInvestigationFraction: c.freshCompletions ? c.freshInvestigation / c.freshCompletions : null,
        highMixedFraction: c.freshMixedChoices ? c.freshMixedInvestigation / c.freshMixedChoices : null,
        highIncompleteBlockChoices: c.freshMixedChoices % 10,
        denominator: MYSTERY_POLICY_CONTRACT.denominator, matrixQualifying: false };
    },
  };
}
