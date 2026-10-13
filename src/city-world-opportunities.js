// Private publication and native mystery composition for actual resident relationships.
import crypto from 'node:crypto';
import { GameError } from './game.js';
import { skillOf } from './rules.js';
import { withItemRead, withItemTransaction } from './items.js';
import { canonicalBytes } from './content/canonical.js';
import { loadAndValidatePhase1WorldGraph } from './content/phase1-validation.js';
import { CITY_WORLD_OPPORTUNITIES } from './content/city-world-opportunities.js';
import { createMysteryContext, mysteryBoard, mysteryNpcStartAdmission, mysteryDefinitionHash, startMystery, completeNode,
  commitChoice, exploreMystery, cancelMystery } from './mysteries.js';
import { createCityNpcAuthority, cityRecurringWindow, validateCityOpportunityBody,
  CITY_WORLD_OPPORTUNITY_NPC_LIMIT, CITY_NPC_FAVOR_TIERS } from './city-world-opportunities-contract.js';

const fail = (code, message) => { throw new GameError(code, message); };
const viewerOf = row => ({ characterId: row.id, generation: Number(row.generation), district: row.loc });
const npcOf = row => ({ id: row.id, generation: Number(row.generation), name: row.name, district: row.loc });
const recordOf = id => CITY_WORLD_OPPORTUNITIES.find(record => record.package.id === id);
const closed = status => ['completed', 'failed', 'canceled'].includes(status);
const block = (code, message) => ({ code, message });
function blockerOf(value) {
  const code = value.code || value.adapter || 'requirement';
  const messages = {
    heat: `Keep heat at or below ${value.maximum}.`, npc_favor: `Earn ${value.minimum} favor with this resident first.`,
    npc_present: 'Meet a current resident in this district.', skill: `Learn ${skillOf(value.required)?.name || 'the required skill'} before taking this approach.`,
    location: 'Return to the case\'s district.', recurring_window: 'This account is available in another part of the server day.',
    item_ownership: 'Bring the required inventory item.', owns_item: 'Bring the required inventory item.',
    graph_dependency: 'Complete the earlier lead first.', evidence: 'Gather the earlier evidence first.',
    requires: 'Complete the earlier lead first.', requires_any: 'Complete one of the earlier approaches first.',
    excluded: 'This permanent branch is closed.',
  };
  return block(String(code), messages[code] || 'Follow the available earlier lead first.');
}
const freshnessOf = (viewer, npc) => ({ ...viewer, npcCharacterId: npc.id, npcGeneration: npc.generation });
const rootPath = (npcId, reference) => '/v1/city/opportunities/' + encodeURIComponent(npcId) + '/' + reference;
function issued(id, label, path, body, blockedBy = [], consequence = '') {
  return { id, label, method: 'POST', path, body, available: blockedBy.length === 0, blockedBy, ...(consequence ? { consequence } : {}) };
}
function receiptKey(accountId, key) {
  if (typeof key !== 'string' || !/^[\x21-\x7e]{1,128}$/.test(key)) fail('idempotency_required', 'Supply an Idempotency-Key.');
  return 'city:opportunity:v1:' + crypto.createHash('sha256').update(canonicalBytes([accountId, key])).digest('hex');
}
function referenceOf(viewer, npc, graphId, version, definitionHash) {
  return crypto.createHash('sha256').update(canonicalBytes([viewer.characterId, viewer.generation,
    npc.id, npc.generation, graphId, Number(version), definitionHash])).digest('hex');
}
async function currentActor(client, accountId) {
  const row = (await client.query(`SELECT id,account_id,name,generation,loc,alive,heat,is_npc FROM characters
    WHERE account_id=$1 AND alive ORDER BY created_at DESC,id LIMIT 1`, [accountId])).rows[0];
  if (!row || row.is_npc) fail('no_character', 'Create a living character first.');
  return row;
}
async function targetActor(client, accountId, targetId) {
  const row = (await client.query('SELECT id,account_id,name,generation,loc,alive,is_npc FROM characters WHERE id=$1', [targetId])).rows[0];
  if (!row || !row.is_npc || row.account_id === accountId) fail('city_npc_unavailable', 'That neighborhood contact is unavailable.');
  return row;
}
async function favorOf(client, viewer, npc) {
  const row = (await client.query(`SELECT favor FROM city_npc_favors WHERE owner_character_id=$1
    AND owner_generation=$2 AND npc_character_id=$3 AND npc_generation=$4`,
  [viewer.characterId, viewer.generation, npc.id, npc.generation])).rows[0];
  const favor = Number(row?.favor || 0);
  return { favor, tier: CITY_NPC_FAVOR_TIERS[favor] };
}
function resultOf(action, native) {
  const result = { ok: true, action, instanceId: native.instanceId };
  if (native.node?.id) {
    if (action === 'explore') result.discovered = [native.node.id];
    else result.nodeId = native.node.id;
  }
  if (native.choice?.id) result.choiceId = native.choice.id;
  for (const [kind, field] of [['heat_raise', 'heat'], ['npc_favor_award', 'favor']]) {
    const effects = (native.worldEffects || []).filter(effect => effect.kind === kind);
    if (effects.length) result[field] = { before: effects[0].before, after: effects.at(-1).after };
  }
  return result;
}

export function createCityWorldOpportunities({ pool, registry = null, now = () => Date.now() } = {}) {
  if (!pool || typeof now !== 'function') throw new TypeError('Opportunity services require a pool and server clock.');
  const content = registry || loadAndValidatePhase1WorldGraph().registry;
  const pins = new Map(CITY_WORLD_OPPORTUNITIES.map(record => [record.package.id, mysteryDefinitionHash(content, record.package.id)]));
  const at = () => { const value = Number(now()); if (!Number.isFinite(value)) throw new TypeError('Invalid server clock.'); return value; };
  const context = (client, accountId, freshness, time) => createMysteryContext({ registry: content, accountId, now: time,
    prerequisitesEnabled: true, npcAuthority: createCityNpcAuthority(client, { accountId, ...freshness }) });
  const reference = (viewer, npc, record) => referenceOf(viewer, npc, record.package.id, record.package.version, pins.get(record.package.id));
  function selected(viewer, npc, graphRef) {
    const record = CITY_WORLD_OPPORTUNITIES.find(entry => reference(viewer, npc, entry) === graphRef);
    if (!record) fail('city_opportunity_unavailable', 'Refresh the current resident\'s opportunities.');
    return record;
  }
  function admitted(record, viewer, relationship, time) {
    if (record.districtId && record.districtId !== viewer.district) fail('city_opportunity_unavailable', 'This account belongs to another district.');
    if (record.secret && relationship.favor < 3) fail('city_opportunity_unavailable', 'There is no known opportunity here.');
    const blockedBy = [];
    const minimum = record.package.nodes[0].conditions?.find(condition => condition.adapter === 'npc_favor')?.minimum || 0;
    if (relationship.favor < minimum) blockedBy.push(blockerOf({ adapter: 'npc_favor', minimum }));
    if (record.window && !cityRecurringWindow(time, record.window).open) blockedBy.push(blockerOf({ adapter: 'recurring_window' }));
    return blockedBy;
  }
  async function index(accountId) {
    const time = at();
    return withItemRead(pool, async client => {
      const owner = await currentActor(client, accountId), viewer = viewerOf(owner);
      const residents = (await client.query(`SELECT id,name,generation,loc FROM characters
        WHERE alive AND is_npc AND loc=$1 AND account_id<>$2 ORDER BY id LIMIT $3`,
      [viewer.district, accountId, CITY_WORLD_OPPORTUNITY_NPC_LIMIT])).rows;
      const instances = (await client.query(`SELECT graph_id,graph_version,status,npc_character_id,npc_generation,owner_generation
        FROM mystery_instances WHERE owner_scope='character' AND owner_id=$1`, [owner.id])).rows;
      const npcs = [], opportunities = [];
      for (const row of residents) {
        const npc = npcOf(row), relationship = await favorOf(client, viewer, npc);
        const ctx = context(client, accountId, freshnessOf(viewer, npc), time);
        npcs.push({ ...npc, ...relationship });
        for (const record of CITY_WORLD_OPPORTUNITIES) {
          if ((record.districtId && record.districtId !== viewer.district) || (record.secret && relationship.favor < 3)) continue;
          const instance = instances.find(value => value.graph_id === record.package.id && Number(value.graph_version) === record.package.version);
          const blockedBy = instance ? admitted(record, viewer, relationship, time)
            : (await mysteryNpcStartAdmission(client, ctx, { scope: 'character', id: owner.id }, record.package.id)).blockedBy.map(blockerOf);
          if (instance && (instance.npc_character_id !== npc.id || Number(instance.npc_generation) !== npc.generation
            || Number(instance.owner_generation) !== viewer.generation)) blockedBy.push(block('city_npc_binding_changed', 'This case belongs to a different contact or character life.'));
          else if (instance && closed(instance.status)) blockedBy.push(block('case_closed', 'This case is complete or closed.'));
          opportunities.push({ npcId: npc.id, graphRef: reference(viewer, npc, record), title: record.presentation.title,
            description: record.presentation.description, district: record.districtId || viewer.district,
            event: record.event, available: blockedBy.length === 0, blockedBy });
        }
      }
      return { viewer, serverTime: new Date(time).toISOString(), npcs, opportunities };
    });
  }
  async function detail(accountId, npcId, graphRef) {
    const time = at();
    return withItemRead(pool, async client => {
      const owner = await currentActor(client, accountId), viewer = viewerOf(owner);
      const target = await targetActor(client, accountId, npcId), npc = npcOf(target);
      if (!target.alive || target.loc !== viewer.district) fail('city_npc_unavailable', 'That resident has left this neighborhood.');
      const record = selected(viewer, npc, graphRef), relationship = await favorOf(client, viewer, npc);
      admitted(record, viewer, relationship, time);
      const freshness = freshnessOf(viewer, npc), ctx = context(client, accountId, freshness, time);
      const instance = (await client.query(`SELECT id FROM mystery_instances WHERE owner_scope='character'
        AND owner_id=$1 AND graph_id=$2 AND graph_version=$3`, [owner.id, record.package.id, record.package.version])).rows[0];
      const initialBlocks = instance ? [] : (await mysteryNpcStartAdmission(client, ctx,
        { scope: 'character', id: owner.id }, record.package.id)).blockedBy.map(blockerOf);
      const board = instance ? await mysteryBoard(client, ctx,
        { scope: 'character', id: owner.id }, record.package.id)
        : { status: 'not_started', nodes: [], actions: [], explorationAvailable: false };
      const base = rootPath(npc.id, graphRef), actionId = suffix => graphRef + ':' + suffix;
      const started = !!board.instanceId, active = board.status === 'active', actions = [];
      if (!started) actions.push(issued(actionId('start'), 'Begin ' + record.presentation.title, base + '/start', freshness, initialBlocks));
      if (active) {
        actions.push(issued(actionId('explore'), 'Investigate a new lead', base + '/explore', freshness,
          board.explorationAvailable ? [] : [block('no_new_lead', 'Follow the visible account before investigating another lead.')]));
        actions.push(issued(actionId('cancel'), 'Abandon this case', base + '/cancel', { ...freshness, instanceId: board.instanceId }, [], 'This closes the case and returns any held items to their original owner.'));
      }
      const nodes = board.nodes.map(projected => {
        const definition = content.nodes.get(projected.id);
        const input = definition.conditions?.find(condition => condition.adapter === 'explicit_interaction');
        const interactionId = input?.interactionId ?? input?.id ?? input?.value;
        const blockedBy = projected.blockedBy.filter(value => value.adapter !== 'explicit_interaction').map(blockerOf);
        const available = (board.actions || []).filter(value => value.nodeId === projected.id && value.kind !== 'discover');
        const body = { ...freshness, ...(interactionId ? { interactionId } : {}) }, nodeActions = [];
        if (active && !['completed', 'excluded', 'failed'].includes(projected.status)) {
          if (['mystery_step', 'world_gate'].includes(projected.type)) nodeActions.push(issued(actionId('complete:' + projected.id),
            record.actionLabels[projected.id] || projected.title, base + '/nodes/' + encodeURIComponent(projected.id) + '/complete', body,
            available.some(value => value.kind === 'complete') ? [] : blockedBy.length ? blockedBy : [block('step_unavailable', 'Follow the earlier lead first.')],
            definition.effects?.some(effect => effect.adapter === 'item_consume') ? 'This uses the required inventory item.' : ''));
          if (projected.type === 'choice') for (const option of projected.options || []) nodeActions.push(issued(actionId('choice:' + projected.id + ':' + option.id),
            option.title, base + '/choices/' + encodeURIComponent(projected.id), { ...body, optionId: option.id },
            available.some(value => value.kind === 'choice' && value.optionId === option.id) ? [] : blockedBy.length ? blockedBy : [block('choice_unavailable', 'This branch is no longer available.')],
            'This permanent choice can change favor, later accounts and heat.'));
        }
        return { id: projected.id, type: projected.type, title: projected.title,
          ...(projected.description !== undefined ? { description: projected.description } : {}),
          ...(projected.dialogue !== undefined ? { dialogue: npc.name + ': ' + projected.dialogue } : {}),
          status: projected.status, available: nodeActions.some(value => value.available), blockedBy, actions: nodeActions };
      });
      return { viewer, serverTime: new Date(time).toISOString(), npc, relationship,
        graph: { id: graphRef, title: record.presentation.title, version: record.package.version, status: board.status,
          ...(started ? { instanceId: board.instanceId } : {}), started }, nodes, actions };
    });
  }
  async function act(accountId, npcId, graphRef, action, body, key, nodeId = null) {
    validateCityOpportunityBody(action, body);
    if (body.npcCharacterId !== npcId) fail('city_npc_binding_changed', 'Use the issued resident reference.');
    const time = at(), idempotencyKey = receiptKey(accountId, key);
    return withItemTransaction(pool, async client => {
      if (action === 'cancel') {
        const instance = (await client.query(`SELECT id,owner_scope,owner_id,authority_account_id,graph_id,graph_version,
          definition_hash,owner_generation,npc_character_id,npc_generation FROM mystery_instances WHERE id=$1`, [body.instanceId])).rows[0];
        if (!instance || instance.authority_account_id !== accountId || instance.owner_scope !== 'character'
          || instance.owner_id !== body.characterId || Number(instance.owner_generation) !== body.generation
          || instance.npc_character_id !== body.npcCharacterId || Number(instance.npc_generation) !== body.npcGeneration
          || referenceOf({ characterId: instance.owner_id, generation: Number(instance.owner_generation) },
            { id: instance.npc_character_id, generation: Number(instance.npc_generation) }, instance.graph_id,
            instance.graph_version, instance.definition_hash) !== graphRef) fail('city_opportunity_unavailable', 'That owned historical case is unavailable.');
        const native = await cancelMystery(client, createMysteryContext({ registry: content, accountId, now: time }),
          { scope: 'character', id: instance.owner_id }, instance.graph_id, instance.id, { idempotencyKey });
        return resultOf(action, native);
      }
      const owner = await currentActor(client, accountId);
      if (owner.id !== body.characterId) fail('city_opportunity_identity_changed', 'Your character changed. Refresh the resident.');
      await targetActor(client, accountId, npcId);
      // Request IDs are freshness preconditions. The native callback rechecks the canonical pair
      // after its receipt guard, so a known receipt can be recovered without another stale grant.
      const viewer = { characterId: owner.id, generation: body.generation, district: body.district };
      const npc = { id: npcId, generation: body.npcGeneration }, record = selected(viewer, npc, graphRef);
      const relationship = await favorOf(client, viewer, npc);
      admitted(record, viewer, relationship, time);
      const ctx = context(client, accountId, freshnessOf(viewer, npc), time), ownerRoot = { scope: 'character', id: owner.id };
      let native;
      if (action === 'start') native = await startMystery(client, ctx, ownerRoot, record.package.id, record.package.version, idempotencyKey);
      else if (action === 'explore') native = await exploreMystery(client, ctx, ownerRoot, record.package.id, { idempotencyKey });
      else if (action === 'complete') native = await completeNode(client, ctx, ownerRoot, record.package.id, nodeId,
        { idempotencyKey, ...(body.interactionId ? { interactionId: body.interactionId } : {}) });
      else if (action === 'choice') native = await commitChoice(client, ctx, ownerRoot, record.package.id, nodeId, body.optionId,
        { idempotencyKey, ...(body.interactionId ? { interactionId: body.interactionId } : {}) });
      else fail('bad_city_opportunity', 'Use an issued opportunity action.');
      return resultOf(action, native);
    });
  }
  return Object.freeze({ index, detail, act, registry: content });
}
