// Situations schedule existing domain actions. Only World Kernel events settle
// their consequences; the Director has no inventory or physical-world writer.
import { performance } from 'node:perf_hooks';
import { GameError } from '../game.js';
import { withItemTransaction, assertItemRead, registerItemTransactionUndo } from '../items.js';
import { createWorldKernel } from '../world-kernel.js';
import { createFamilyOperations } from '../coordination/operations.js';
import { createCoordinationService } from '../coordination/runtime.js';
import { coordinationGraphs } from '../coordination/graph.js';
import { createCoordinationKnowledge, assertKnowledgeSnapshot, snapshotRequirementMatches } from '../coordination/knowledge.js';
import { createMysteryContext, startMystery } from '../mysteries.js';
import { verifyDirectorDefinition } from './definitions.js';
import { observeDirectorWorld } from './pressures.js';
import { DIRECTOR_LIMITS, directorHash, predicatesMatch, situationEligible, selectDirectorCandidates } from './selection.js';
import { admitDefinitions, directorReceipt, changeSituation, changeCampaign, startSituation } from './storage.js';

export const DIRECTOR_MODES = Object.freeze(['DIRECTOR_DISABLED', 'INTERNAL_SIMULATION', 'SHADOW_MODE', 'LIMITED_COHORT', 'LIVE']);
const fail = (code = 'director_unavailable') => { throw new GameError(code, 'This development is unavailable. Refresh your view.'); };
const identity = (s) => typeof s === 'string' && /^[\x21-\x7e]{1,160}$/.test(s);
const parse = (v) => typeof v === 'string' ? JSON.parse(v) : v;

export function createLivingWorldDirector({ pool, content, definitions, mode = 'DIRECTOR_DISABLED', accountIds = [],
  clock = Date.now, limits = DIRECTOR_LIMITS } = {}) {
  if (!pool || !content || !definitions || !DIRECTOR_MODES.includes(mode) || !Array.isArray(accountIds)
    || accountIds.some((id) => !identity(id)) || (mode === 'LIMITED_COHORT' && !accountIds.length)
    || [...definitions.situations, ...definitions.campaigns].some((d) => !verifyDirectorDefinition(d))) fail('bad_director_configuration');
  // Limits can only be tightened by internal simulations/operators.
  limits = Object.freeze(Object.fromEntries(Object.entries(DIRECTOR_LIMITS).map(([key, max]) => {
    const n = limits[key] ?? max;
    if (!Number.isSafeInteger(n) || n < 1 || n > max) fail('bad_director_configuration');
    return [key, n];
  })));
  const exposed = mode === 'LIVE' || mode === 'LIMITED_COHORT';
  const allowed = (accountId) => exposed && identity(accountId) && (!accountIds.length || accountIds.includes(accountId));
  const policy = { enabled: true, knowledgeEnabled: true, sharingEnabled: true, accountIds };
  const kernel = createWorldKernel({ pool, registry: content.registry, objects: content.objects, ...policy });
  const knowledge = createCoordinationKnowledge(policy);
  const family = createFamilyOperations({ pool, registry: content.registry, kernel, definitions: content.operations,
    prerequisitesEnabled: true, ...policy });
  const discovery = createCoordinationService({ pool, registry: content.coordinationRegistry, prerequisitesEnabled: true, ...policy });
  const worldContent = { ...content, objects: kernel.definitions };
  const byId = new Map(definitions.situations.map((d) => [d.id, d]));
  const campaignById = new Map(definitions.campaigns.map((d) => [d.id, d]));
  const metrics = { activeSituations: 0, activeCampaigns: 0, generated: 0, resolved: 0, expired: 0,
    recovered: 0, errors: 0, selections: 0, selectionLatencyMs: 0, evaluationLatencyMs: 0, eventBacklog: 0 };
  const started = performance.now();
  const definitionFor = (row) => {
    const d = byId.get(row.definition_id);
    if (!d || d.version !== Number(row.definition_version) || d.contentHash !== row.definition_hash) fail('director_definition_changed');
    return d;
  };
  const campaignFor = (row) => {
    const d = campaignById.get(row.definition_id);
    if (!d || d.version !== Number(row.definition_version) || d.contentHash !== row.definition_hash) fail('director_definition_changed');
    return d;
  };

  async function actor(client, accountId, expectedCharacterId, lock = false) {
    if (!allowed(accountId)) fail();
    const rows = lock
      ? (await client.query('SELECT id,account_id,alive,loc FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2 FOR UPDATE', [accountId])).rows
      : (await client.query('SELECT id,account_id,alive,loc FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2', [accountId])).rows;
    if (rows.length !== 1 || (expectedCharacterId && rows[0].id !== expectedCharacterId)) fail();
    const account = lock
      ? (await client.query('SELECT status FROM accounts WHERE id=$1 FOR SHARE', [accountId])).rows[0]
      : (await client.query('SELECT status FROM accounts WHERE id=$1', [accountId])).rows[0];
    if (account?.status !== 'active') fail();
    const family = lock ? (await client.query('SELECT gang_id,role FROM gang_members WHERE character_id=$1 FOR SHARE', [rows[0].id])).rows[0]
      : (await client.query('SELECT gang_id,role FROM gang_members WHERE character_id=$1', [rows[0].id])).rows[0];
    const crew = lock ? (await client.query('SELECT crew_id FROM crew_members WHERE account_id=$1 FOR SHARE', [accountId])).rows[0]
      : (await client.query('SELECT crew_id FROM crew_members WHERE account_id=$1', [accountId])).rows[0];
    return { ch: rows[0], accountId, familyId: family?.gang_id ?? null, role: family?.role ?? null, crewId: crew?.crew_id ?? null };
  }
  function audienceMatches(audience, a, situation, hasKnowledge) {
    if (audience.knowledge && !hasKnowledge(audience.knowledge)) return false;
    if (audience.kind === 'controller_family') return !!a.familyId && a.familyId === situation.controller_family_id;
    if (audience.kind === 'rival_family') return !!a.familyId && !!situation.controller_family_id && a.familyId !== situation.controller_family_id;
    if (audience.kind === 'crew') return !!a.crewId;
    return audience.kind === 'public' || audience.kind === 'informed';
  }
  async function planSnapshot(client, accountId, { expectedCharacterId = null, asOf = clock() } = {}) {
    assertItemRead(client);
    if (!allowed(accountId)) return { groups: [], render: async () => [] };
    const a = await actor(client, accountId, expectedCharacterId);
    // A global active bound makes this query fixed-size even at high population.
    const rows = (await client.query(`SELECT * FROM director_situations WHERE terminal=false
      ORDER BY created_at DESC,id LIMIT 33`)).rows;
    if (rows.length > limits.active) fail('director_capacity');
    const located = rows.filter((row) => kernel.definitions.find((d) => d.id === row.object_id)?.locationId === a.ch.loc
      || (!!a.familyId && row.controller_family_id === a.familyId));
    const requirements = located.flatMap((row) => definitionFor(row).audiences.flatMap((audience) => audience.knowledge ? [audience.knowledge] : []));
    return { groups: [{ accountId, characterId: a.ch.id, requirements }], render: async (snapshot, { operations = null } = {}) => {
      assertKnowledgeSnapshot(client, snapshot, accountId);
      const hasKnowledge = (requirement) => snapshotRequirementMatches(client, snapshot,
        { accountId, characterId: a.ch.id, requirement, sharingEnabled: true });
      const cards = [];
      for (const row of located) {
        if (new Date(row.expires_at).getTime() <= asOf) continue;
        const d = definitionFor(row);
        const policy = d.concurrencyPolicy;
        if (cards.length >= Math.min(limits.player, policy.perPlayer, a.crewId ? policy.perCrew : policy.perPlayer,
          a.familyId ? policy.perFamily : policy.perPlayer)) continue;
        const audienceIds = new Set(d.audiences.filter((audience) => audienceMatches(audience, a, row, hasKnowledge)).map((audience) => audience.id));
        const signals = d.initialSignals.filter((signal) => audienceIds.has(signal.audienceId));
        if (!signals.length) continue;
        const actionIds = new Set(signals.flatMap((signal) => signal.commandAdapterIds));
        const actions = d.commandAdapters.filter((adapter) => actionIds.has(adapter.id) && audienceIds.has(adapter.audienceId)).map((adapter) => {
          const operation = adapter.commandType === 'operation.create' && operations
            ? operations.catalog.find((entry) => entry.id === adapter.targetId) : null;
          const canAttempt = adapter.commandType !== 'operation.create'
            || (operations ? operation?.canCreate === true : !!a.crewId && ['boss', 'underboss'].includes(a.role));
          return { id: adapter.id, label: adapter.label || adapter.id.replace(/[-_:]+/g, ' '),
            description: signals.find((signal) => signal.commandAdapterIds.includes(adapter.id))?.description || '', canAttempt,
            requiredRoles: operation?.roles || [], missing: canAttempt ? [] : operation?.missing || ['undiscovered_requirement'],
            confirmation: { required: adapter.commandType === 'operation.create',
              message: adapter.commandType === 'operation.create' ? 'Organize this response with your Family?' : null } };
        });
        cards.push({ id: row.id, title: signals[0].title, description: signals[0].description,
          objective: signals[0].description, status: row.state, revision: Number(row.revision), expiresAt: new Date(row.expires_at).toISOString(),
          knownFacts: signals.map((signal) => signal.description), helpers: a.crewId ? ['Your Crew', ...(a.familyId ? ['Your Family'] : [])] : [], actions });
      }
      // Audience demands are capped on the authoritative view as well as selection.
      return cards.slice(0, Math.min(limits.player, a.crewId ? limits.crew : limits.player,
        a.familyId ? limits.family : limits.player));
    } };
  }

  async function validateAction(client, accountId, situationId, actionId, expectedRevision, expectedCharacterId) {
    const a = await actor(client, accountId, expectedCharacterId, true);
    const row = (await client.query('SELECT * FROM director_situations WHERE id=$1 FOR SHARE', [situationId])).rows[0];
    if (!row || row.terminal || Number(row.revision) !== expectedRevision || new Date(row.expires_at).getTime() <= clock()) fail();
    const d = definitionFor(row), adapter = d.commandAdapters.find((entry) => entry.id === actionId);
    const audience = d.audiences.find((entry) => entry.id === adapter?.audienceId);
    const world = kernel.definitions.find((entry) => entry.id === row.object_id);
    if (!adapter || !audience || !world || (a.ch.loc !== world.locationId && a.familyId !== row.controller_family_id)) fail();
    const canonical = (await client.query('SELECT revision,definition_hash FROM world_kernel_objects WHERE id=$1 FOR SHARE', [row.object_id])).rows[0];
    if (!canonical || Number(canonical.revision) !== Number(row.starting_world_revision)
      || canonical.definition_hash !== world.contentHash) fail();
    const ctx = await knowledge.context(client, { accountId, character: a.ch, lock: true });
    const known = !audience.knowledge || (await knowledge.matchesRequirements(client, ctx, [audience.knowledge]))[0];
    if (!audienceMatches(audience, a, row, () => known)) fail();
    if (adapter.commandType === 'operation.create' && (!a.crewId || !['boss', 'underboss'].includes(a.role))) fail();
    return { adapter, row, a };
  }

  async function domainReceipt(client, intent) {
    const raw = intent.command_type === 'operation.create'
      ? (await client.query('SELECT result_json FROM item_mutation_guards WHERE idempotency_key=$1',
        [`family-operation:${directorHash([intent.account_id, intent.command_key])}`])).rows[0]?.result_json
      : intent.command_type === 'mystery.start'
      ? (await client.query('SELECT result_json FROM item_mutation_guards WHERE idempotency_key=$1', [intent.command_key])).rows[0]?.result_json
      : (await client.query('SELECT response_json FROM coordination_commands WHERE account_id=$1 AND command_key=$2',
        [intent.account_id, intent.command_key])).rows[0]?.response_json;
    if (raw === undefined || raw === null) return null;
    const value = parse(raw);
    return intent.command_type === 'operation.create' ? { operationId: value.operationId }
      : { instance: { id: value.instance?.id || value.id } };
  }
  async function receipt(accountId, key, expectedCharacterId = null) {
    return withItemTransaction(pool, async (client) => {
      const a = await actor(client, accountId, expectedCharacterId, true);
      const intent = (await client.query('SELECT * FROM director_action_intents WHERE account_id=$1 AND command_key=$2', [accountId, key])).rows[0];
      if (!intent) return null;
      if (intent.character_id !== a.ch.id) fail();
      // Minimal reconciliation identity only; never replay a cached private view.
      return domainReceipt(client, intent);
    });
  }
  async function command(accountId, situationId, actionId, value, key, expectedCharacterId = null) {
    if (![accountId, situationId, actionId, key].every(identity) || !value
      || Object.keys(value).join(',') !== 'expectedRevision' || !Number.isSafeInteger(value.expectedRevision)) fail('bad_director_request');
    const intent = await withItemTransaction(pool, async (client) => {
      const a = await actor(client, accountId, expectedCharacterId, true);
      const prior = (await client.query('SELECT * FROM director_action_intents WHERE account_id=$1 AND command_key=$2', [accountId, key])).rows[0];
      if (prior) {
        if (prior.character_id !== a.ch.id || prior.situation_id !== situationId || prior.action_id !== actionId
          || Number(prior.expected_revision) !== value.expectedRevision) fail();
        if (await domainReceipt(client, prior)) return prior;
      }
      const { adapter } = await validateAction(client, accountId, situationId, actionId, value.expectedRevision, a.ch.id);
      if (!['operation.create', 'discovery.start', 'mystery.start'].includes(adapter.commandType)) fail('director_adapter_unavailable');
      if (prior) return prior;
      const row = { account_id: accountId, command_key: key, character_id: a.ch.id, situation_id: situationId,
        action_id: actionId, command_type: adapter.commandType, target_id: adapter.targetId, expected_revision: value.expectedRevision };
      await client.query(`INSERT INTO director_action_intents(account_id,command_key,character_id,situation_id,action_id,
        command_type,target_id,expected_revision,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [accountId, key, a.ch.id, situationId, actionId, adapter.commandType, adapter.targetId, value.expectedRevision, new Date(clock())]);
      registerItemTransactionUndo(client, () => client.query('DELETE FROM director_action_intents WHERE account_id=$1 AND command_key=$2', [accountId, key]));
      return row;
    });
    const committed = await receipt(accountId, key, intent.character_id);
    if (committed) return committed;
    const admission = (client) => validateAction(client, accountId, situationId, actionId, value.expectedRevision, intent.character_id);
    if (intent.command_type === 'operation.create')
      return family.create(accountId, { definitionId: intent.target_id }, key, intent.character_id, admission);
    if (intent.command_type === 'mystery.start') return withItemTransaction(pool, async (client) => {
      await admission(client);
      const context = createMysteryContext({ registry: content.registry, accountId, knowledgeEnabled: true,
        sharingEnabled: true, accountIds, worldDefinitions: kernel.definitions, prerequisitesEnabled: true, operationOutcomesEnabled: true });
      const result = await startMystery(client, context, { scope: 'character', id: intent.character_id }, intent.target_id,
        content.registry.byPackage.get(intent.target_id).version, key);
      return { instance: { id: result.instance?.id || result.id } };
    });
    const graph = coordinationGraphs(content.coordinationRegistry).find((g) => g.id === intent.target_id);
    if (!graph) fail();
    const result = await discovery.create(accountId, graph.id, { expectedContentHash: graph.contentHash }, key, intent.character_id, admission);
    return { instance: { id: result.instance?.id || result.id } };
  }

  async function tick() {
    if (mode === 'DIRECTOR_DISABLED' || mode === 'INTERNAL_SIMULATION') return { mode, skipped: true };
    const began = performance.now(), at = clock();
    if (!Number.isSafeInteger(at) || at < 0) fail('bad_director_clock');
    const tickId = directorHash(['director-v1', mode, Math.floor(at / (limits.tickSeconds * 1000))]);
    try {
      const result = await withItemTransaction(pool, async (client) => {
        const oldClock = (await client.query("SELECT * FROM director_clock WHERE id='global' FOR UPDATE")).rows[0];
        if (!oldClock) {
          await client.query("INSERT INTO director_clock(id,evaluated_at) VALUES('global',$1) ON CONFLICT(id) DO NOTHING", [new Date(0)]);
          registerItemTransactionUndo(client, () => client.query("DELETE FROM director_clock WHERE id='global'"));
        }
        await client.query("SELECT id FROM director_clock WHERE id='global' FOR UPDATE");
        const prior = (await client.query('SELECT result_json FROM director_receipts WHERE execution_id=$1', [tickId])).rows[0];
        if (prior) return { ...parse(prior.result_json), replayed: true };
        const last = (await client.query("SELECT evaluated_at FROM director_clock WHERE id='global'")).rows[0];
        if (at < new Date(last.evaluated_at).getTime()) fail('director_clock_regression');
        if (exposed) await admitDefinitions(client, definitions);
        // Pin each physical object through lifecycle/branch commit. Without this
        // lock an operation could settle between fact and event reads, making a
        // valid campaign branch look impossible under the earlier facts.
        for (const objectId of [...new Set(definitions.situations.map((d) => d.objectId))].sort())
          await client.query('SELECT id FROM world_kernel_objects WHERE id=$1 FOR SHARE', [objectId]);
        const facts = await observeDirectorWorld(client, worldContent, definitions.situations.map((d) => d.objectId), at);
        const factByObject = new Map(facts.map((f) => [f.objectId, f]));
        let active = (await client.query('SELECT * FROM director_situations WHERE terminal=false ORDER BY created_at,id LIMIT 33')).rows;
        let campaigns = (await client.query("SELECT * FROM director_campaigns WHERE status='active' ORDER BY created_at,id LIMIT 33")).rows;
        if (active.length > limits.active || campaigns.length > limits.campaigns) fail('director_capacity');
        const transitions = [];
        if (exposed) for (const row of active) {
          const d = definitionFor(row), f = factByObject.get(row.object_id);
          const events = (await client.query(`SELECT id,action_id,prior_state,next_state,revision,occurred_at FROM world_kernel_events
            WHERE object_id=$1 AND revision>$2 ORDER BY revision LIMIT 33`, [row.object_id, row.starting_world_revision])).rows;
          let resolution = null, event = null;
          for (const candidate of d.possibleResolutions) {
            if (!candidate.from.includes(row.state)) continue;
            const consequence = d.consequenceContracts.find((c) => c.id === candidate.consequenceId);
            const matched = events.find((e) => new Date(e.occurred_at).getTime() < new Date(row.expires_at).getTime()
              && e.action_id === consequence.actionId && e.prior_state === consequence.fromState && e.next_state === consequence.toState);
            if (matched) { resolution = candidate; event = matched; break; }
          }
          if (events.length > 32 && !resolution) fail('director_history_gap');
          if (resolution) {
            await changeSituation(client, row, resolution.to, true, resolution.id, event.id, 'resolution', at);
            transitions.push({ id: row.id, kind: 'resolution', outcome: resolution.id });
          } else if (!f || f.season !== Number(row.season) || (!f.controllerFamilyId && row.controller_family_id)) {
            await changeSituation(client, row, d.recoveryPolicy.to, true, 'recovery', null, 'recovery', at);
            transitions.push({ id: row.id, kind: 'recovery' });
          } else if (at >= new Date(row.expires_at).getTime()) {
            await changeSituation(client, row, d.expiryPolicy.to, true, 'expiry', null, 'expiry', at);
            transitions.push({ id: row.id, kind: 'expiry' });
          } else {
            const escalation = d.possibleEscalations.find((e) => e.from === row.state
              && at - new Date(row.updated_at).getTime() >= e.afterSeconds * 1000 && predicatesMatch(e.when, f));
            if (escalation) {
              await changeSituation(client, row, escalation.to, false, null, null, 'escalation', at);
              transitions.push({ id: row.id, kind: 'escalation' });
            }
          }
        }
        const candidates = [];
        if (exposed) {
          active = (await client.query('SELECT * FROM director_situations WHERE terminal=false ORDER BY created_at,id LIMIT 33')).rows;
          for (let campaign of campaigns) {
            const d = campaignFor(campaign), f = factByObject.get(campaign.object_id);
            const current = (await client.query('SELECT * FROM director_situations WHERE campaign_id=$1 AND node_id=$2', [campaign.id, campaign.node_id])).rows[0];
            const deadline = new Date(campaign.expires_at).getTime(), expired = at >= deadline;
            if (current?.terminal) {
              const node = d.nodes.find((n) => n.id === campaign.node_id);
              const witness = current.world_event_id ? (await client.query(
                'SELECT revision,next_state,action_id,family_id,occurred_at FROM world_kernel_events WHERE id=$1', [current.world_event_id])).rows[0] : null;
              const timely = witness && new Date(witness.occurred_at).getTime() < deadline;
              // A worker outage changes observation time, never the timestamp of
              // a committed consequence. Settle timely work before abandonment.
              if (node.terminal && timely && !['expiry', 'recovery'].includes(current.outcome)) {
                await changeCampaign(client, campaign, campaign.node_id, 'completed', at); continue;
              }
              const branch = timely && d.branches.find((b) => b.from === campaign.node_id && b.outcome === current.outcome && f && predicatesMatch(b.when, f));
              if (!branch || expired) {
                // Several legitimate operations can finish between evaluations.
                // Catch up ONLY facts proved by the referenced canonical events;
                // never pretend today's stock/population existed in the past.
                const historicalFacts = timely && f ? { ...f, worldState: witness.next_state,
                  worldRevision: Number(witness.revision), controllerFamilyId: witness.family_id,
                  priorWorldAction: witness.action_id, priorOutcome: witness.next_state } : null;
                const canonicalOnly = (rules) => rules.every((rule) => ['worldState', 'worldRevision', 'controllerFamilyId',
                  'priorWorldAction', 'priorOutcome'].includes(rule.fact));
                let caughtUp = false;
                if (historicalFacts) for (const edge of d.branches.filter((b) => b.from === campaign.node_id && b.outcome === current.outcome)) {
                  const node = d.nodes.find((n) => n.id === edge.to), target = byId.get(node.situationId);
                  if (target.objectId !== campaign.object_id || !canonicalOnly(edge.when)
                    || !canonicalOnly([...target.eligibility, ...target.requiredWorldFacts, ...target.excludedWorldFacts])
                    || !predicatesMatch(edge.when, historicalFacts) || !predicatesMatch(target.eligibility, historicalFacts)
                    || !predicatesMatch(target.requiredWorldFacts, historicalFacts)
                    || target.excludedWorldFacts.some((rule) => predicatesMatch([rule], historicalFacts))) continue;
                  const subsequent = (await client.query(`SELECT id,action_id,prior_state,next_state,revision,occurred_at FROM world_kernel_events
                    WHERE object_id=$1 AND revision>$2 ORDER BY revision LIMIT 33`, [campaign.object_id, witness.revision])).rows;
                  if (subsequent.length > 32) fail('director_history_gap');
                  const following = subsequent.filter((event) => new Date(event.occurred_at).getTime() < Math.min(deadline,
                    new Date(witness.occurred_at).getTime() + target.expiryPolicy.afterSeconds * 1000));
                  const resolution = target.possibleResolutions.find((r) => r.from.includes(target.initialState)
                    && following.some((event) => {
                      const effect = target.consequenceContracts.find((c) => c.id === r.consequenceId);
                      return event.action_id === effect.actionId && event.prior_state === effect.fromState && event.next_state === effect.toState;
                    }));
                  if (!resolution) continue;
                  const effect = target.consequenceContracts.find((c) => c.id === resolution.consequenceId);
                  const event = following.find((e) => e.action_id === effect.actionId && e.prior_state === effect.fromState && e.next_state === effect.toState);
                  campaign = await changeCampaign(client, campaign, node.id, 'active', at);
                  const created = await startSituation(client, { definition: target, facts: historicalFacts,
                    campaignDefinition: d, campaignId: campaign.id, nodeId: node.id }, at, tickId);
                  const observed = (await client.query('SELECT * FROM director_situations WHERE id=$1', [created.situationId])).rows[0];
                  await changeSituation(client, observed, resolution.to, true, resolution.id, event.id, 'observed_resolution', at);
                  if (node.terminal) await changeCampaign(client, campaign, node.id, 'completed', at);
                  transitions.push({ id: created.situationId, kind: 'observed_resolution', outcome: resolution.id });
                  caughtUp = true; break;
                }
                if (!caughtUp && (expired || ['expiry', 'recovery'].includes(current.outcome)))
                  // Preserve the eligible next node when an outage consumed its
                  // campaign window, so ordinary recovery can resume the actual
                  // aftermath instead of retrying an obsolete opening state.
                  await changeCampaign(client, campaign, branch ? branch.to : campaign.node_id, 'abandoned', at);
                // A currently ineligible, unresolved branch waits until its finite
                // campaign deadline. It is not silently declared impossible.
                continue;
              }
              campaign = await changeCampaign(client, campaign, branch.to, 'active', at);
            }
            if (expired) {
              await changeCampaign(client, campaign, campaign.node_id, 'abandoned', at); continue;
            }
            if (!current || current.terminal) {
              const node = d.nodes.find((n) => n.id === campaign.node_id);
              candidates.push({ definition: byId.get(node.situationId), facts: f, campaignDefinition: d,
                campaignId: campaign.id, nodeId: node.id });
            }
          }
        }
        const currentCampaigns = exposed ? (await client.query("SELECT * FROM director_campaigns WHERE status='active' ORDER BY created_at,id LIMIT 33")).rows : campaigns;
        for (const campaign of definitions.campaigns) {
          let node = campaign.nodes.find((n) => n.id === campaign.entryNode), d = byId.get(node.situationId);
          const f = factByObject.get(d.objectId);
          if (currentCampaigns.some((c) => c.object_id === d.objectId) || currentCampaigns.length >= limits.campaigns
            || currentCampaigns.filter((c) => c.definition_id === campaign.id).length >= campaign.maxActive) continue;
          const priorCampaigns = (await client.query(`SELECT id,node_id,created_at,updated_at,status FROM director_campaigns
            WHERE definition_id=$1 AND object_id=$2 AND created_at >= $3 ORDER BY created_at DESC LIMIT 129`,
          [campaign.id, d.objectId, new Date(at - campaign.cooldownPolicy.repetitionWindowSeconds * 1000)])).rows;
          if (priorCampaigns.length > 128) fail('director_history_limit');
          const lastCampaign = (await client.query(`SELECT id,node_id,created_at,updated_at,status FROM director_campaigns
            WHERE definition_id=$1 AND object_id=$2 ORDER BY created_at DESC,id LIMIT 1`, [campaign.id, d.objectId])).rows[0];
          if (priorCampaigns.length >= campaign.cooldownPolicy.maximumPerWindow
            || (lastCampaign && at - new Date(lastCampaign.created_at).getTime() < campaign.cooldownPolicy.seconds * 1000)
            || (lastCampaign?.status !== 'active' && lastCampaign && at - new Date(lastCampaign.updated_at).getTime() < campaign.cooldownPolicy.quietSeconds * 1000)) continue;
          // Recovery preserves the physical outcome: a failed restoration resumes
          // its eligible aftermath, never rewinds a captured/protected route.
          let recoveryOf = null;
          if (lastCampaign?.status === 'abandoned' && f && !situationEligible(d, f)) {
            const resume = campaign.nodes.find((n) => n.id === lastCampaign.node_id && situationEligible(byId.get(n.situationId), f));
            if (resume) { node = resume; d = byId.get(node.situationId); recoveryOf = lastCampaign.id; }
          }
          candidates.push({ definition: d, facts: f, campaignDefinition: campaign, nodeId: node.id, recoveryOf });
        }
        // Aggregate-free bounded history: saturating fails closed, never silently
        // drops older cooldown evidence to allow more generation.
        const window = Math.max(...definitions.situations.map((d) => d.cooldownPolicy.repetitionWindowSeconds), 86400);
        const history = (await client.query('SELECT * FROM director_situations WHERE created_at >= $1 ORDER BY created_at DESC,id LIMIT 2049',
          [new Date(at - window * 1000)])).rows;
        if (history.length > 2048) fail('director_history_limit');
        const selectionBegan = performance.now();
        const selection = selectDirectorCandidates(candidates, active, history, at, limits);
        const selected = [];
        for (const candidate of selection.selected) {
          if (!candidate.campaignId && (currentCampaigns.length + selected.filter((s) => s.newCampaign).length >= limits.campaigns
            || currentCampaigns.filter((c) => c.definition_id === candidate.campaignDefinition.id).length
              + selected.filter((s) => s.newCampaign && s.campaignDefinitionId === candidate.campaignDefinition.id).length >= candidate.campaignDefinition.maxActive)) continue;
          if (exposed) selected.push({ ...await startSituation(client, candidate, at, tickId), newCampaign: !candidate.campaignId,
            campaignDefinitionId: candidate.campaignDefinition.id });
          else selected.push({ definitionId: candidate.definition.id, objectId: candidate.facts.objectId,
            newCampaign: !candidate.campaignId, campaignDefinitionId: candidate.campaignDefinition.id });
        }
        await client.query(`INSERT INTO director_selections(id,mode,evaluated_at,facts_json,candidates_json,selected_json)
          VALUES($1,$2,$3,$4,$5,$6)`, [tickId, mode, new Date(at), JSON.stringify(facts), JSON.stringify({
          eligible: selection.eligible, rejected: selection.rejected, truncated: selection.truncated }), JSON.stringify(selected)]);
        registerItemTransactionUndo(client, () => client.query('DELETE FROM director_selections WHERE id=$1', [tickId]));
        await client.query("UPDATE director_clock SET evaluated_at=$1 WHERE id='global'", [new Date(at)]);
        registerItemTransactionUndo(client, () => client.query("UPDATE director_clock SET evaluated_at=$1 WHERE id='global'", [last.evaluated_at]));
        metrics.selectionLatencyMs = performance.now() - selectionBegan;
        return directorReceipt(client, tickId, 'evaluation', tickId,
          { mode, selected, transitions, eligible: selection.eligible, rejected: selection.rejected.length, replayed: false }, at);
      });
      if (!result.replayed) {
        metrics.selections++;
        metrics.generated += exposed ? result.selected.length : 0;
        for (const t of result.transitions) {
          if (t.kind === 'resolution') metrics.resolved++;
          if (t.kind === 'observed_resolution') { metrics.generated++; metrics.resolved++; }
          if (t.kind === 'expiry') metrics.expired++;
          if (t.kind === 'recovery') metrics.recovered++;
        }
      }
      const active = (await pool.query('SELECT id FROM director_situations WHERE terminal=false LIMIT 33')).rows;
      const campaigns = (await pool.query("SELECT id FROM director_campaigns WHERE status='active' LIMIT 33")).rows;
      metrics.activeSituations = active.length; metrics.activeCampaigns = campaigns.length;
      metrics.eventBacklog = Math.max(0, result.eligible - result.selected.length);
      return result;
    } catch (error) { metrics.errors++; throw error; }
    finally { metrics.evaluationLatencyMs = performance.now() - began; }
  }
  return Object.freeze({ mode, definitions, enabledFor: allowed, tick, planSnapshot, command, receipt,
    metrics: () => {
      const hours = Math.max(1, performance.now() - started) / 3600000;
      return Object.freeze({ ...metrics, generationRatePerHour: metrics.generated / hours,
        resolutionRatePerHour: metrics.resolved / hours, expiryRatePerHour: metrics.expired / hours,
        recoveryRatePerHour: metrics.recovered / hours });
    } });
}
