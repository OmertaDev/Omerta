// Discoverability and orchestration only: all effects and replay receipts belong
// to the existing domain services. Stored boards are expiring suggestions, never authority.
import crypto from 'node:crypto';
import { GameError } from './game.js';
import { dbCaps } from './db.js';
import { canonicalBytes } from './content/canonical.js';
import { createWorldKernel } from './world-kernel.js';
import { createWorldKernelQuery } from './world-kernel-query.js';
import { createWorldProjection } from './world-projection.js';
import { createCoordinationKnowledge } from './coordination/knowledge.js';
import { createCoordinationService } from './coordination/runtime.js';
import { createFamilyOperations } from './coordination/operations.js';
import { createCraftingContext, craftWorldGraphRecipe, salvageCar } from './crafting.js';
import { createMysteryContext, startMystery, discoverNode, completeNode, commitChoice } from './mysteries.js';
import { withItemRead, withItemTransaction } from './items.js';
import { COMMAND_LIMIT, playerOpportunities } from './player-opportunities.js';

const hash = (value) => crypto.createHash('sha256').update(canonicalBytes(value)).digest('hex');
const fail = (code = 'command_unavailable') => { throw new GameError(code, 'Refresh your commands before trying again.'); };
const identifier = (value) => typeof value === 'string' && /^[\x21-\x7e]{1,160}$/.test(value);
const ref = (type, id) => ({ type, id });
const title = (value) => String(value || '').replace(/[_:.-]+/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
const LIFETIME_MS = 10 * 60 * 1000;
const memoryExecutions = new Set();
const boardExecutions = new WeakMap();
// Domain services may return an identical result when they win or replay their
// own mutation guard. Serialize fresh submissions against the existing issued
// board so only the winner reports a new execution. Never wait while occupying
// a connection needed by a domain transaction; callers retry the same identity.
async function withIssuedBoard(pool, boardId, accountId, action) {
  if (!dbCaps.skipLocked) {
    if (memoryExecutions.has(boardId)) fail('contention');
    memoryExecutions.add(boardId);
    try { return await action(); } finally { memoryExecutions.delete(boardId); }
  }
  // A board lock and a domain transaction require separate connections. Bound
  // admission before awaiting a connection so distinct boards cannot fill the
  // pool with lock holders all waiting for their own domain connection.
  const capacity = Math.floor((pool.options?.max ?? 20) / 2);
  const running = boardExecutions.get(pool) || 0;
  if (running >= capacity) fail('contention');
  boardExecutions.set(pool, running + 1);
  let client;
  let discard = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const row = (await client.query('SELECT id FROM player_command_boards WHERE id=$1 AND account_id=$2 FOR UPDATE NOWAIT',
      [boardId, accountId])).rows[0];
    if (!row) fail();
    return await action();
  } catch (error) {
    if (['55P03', '40P01', '40001'].includes(error?.code)) fail('contention');
    throw error;
  } finally {
    // This boundary changes no data. Failure to release its lock must not turn a
    // known committed domain action into a request for a different retry key.
    if (client) {
      try { await client.query('ROLLBACK'); } catch { discard = true; }
      client.release(discard);
    }
    boardExecutions.set(pool, (boardExecutions.get(pool) || 1) - 1);
  }
}
const BLOCKERS = Object.freeze({ location: 'Travel to the required district.', materials: 'Gather the required materials.',
  cash: 'You need more cash.', item: 'Obtain the required equipment.', level: 'Build your reputation.',
  skill: 'Learn the required skill.', scarcity: 'This recipe is currently at its production limit.',
  family_authority: 'This requires current Family leadership and an eligible Crew.',
  operation_requirements: 'Review the operation roles and readiness.', vehicle: 'This vehicle is committed elsewhere.' });

function commandsFor(board) {
  const commands = [];
  const add = (type, subject, label, parameters, available, missing = [], extra = {}) => {
    parameters = Object.fromEntries(Object.entries(parameters).filter(([, value]) => value !== undefined));
    const blockers = missing.map((code) => Object.hasOwn(BLOCKERS, code)
      ? { kind: 'known', code, description: BLOCKERS[code] }
      : { kind: 'undiscovered', code: 'undiscovered_requirement', description: 'Keep investigating.' });
    const command = { commandId: hash(['omerta-command-v1', type, subject, parameters]), commandType: type, subject,
      target: subject, label, description: extra.description || label, parameters,
      availability: available ? 'AVAILABLE' : blockers.some((entry) => entry.kind === 'undiscovered') ? 'LOCKED' : 'BLOCKED',
      requirements: blockers.filter((entry) => entry.kind === 'known'), blockers, costs: [], committedResources: [], requiredKnowledge: [], requiredItems: [],
      requiredRoles: [], requiredParticipants: [], authorization: { revalidatedOnExecution: true },
      risk: [], expiresAt: null, executionIdentity: null,
      confirmation: { required: false, message: null },
      resultContract: { schemaVersion: 1, currentAuthorizedProjection: true, exactRetry: true }, ...extra };
    commands.push(command);
  };
  for (const entry of board.cases?.catalog || []) {
    add('mystery.start', ref('mystery', entry.graphId), `Open case: ${entry.title}`, { graphId: entry.graphId }, entry.canStart,
      [], entry.started ? { availability: entry.status === 'active' ? 'IN_PROGRESS' : 'COMPLETED' } : {});
  }
  const mystery = board.cases?.selected;
  for (const node of mystery?.nodes || []) {
    if (['completed', 'excluded', 'failed'].includes(node.status)
      || mystery.actions.some((action) => action.nodeId === node.id)) continue;
    add('mystery.inspect', ref('mystery', mystery.graph.id), `Review: ${node.title || 'case note'}`,
      { graphId: mystery.graph.id, nodeId: node.id }, false, node.blockedBy?.length ? node.blockedBy : ['undiscovered_requirement'],
      { description: node.description || 'Review the evidence available to you.' });
  }
  for (const action of mystery?.actions || []) {
    if (!['discover', 'complete', 'choice'].includes(action.kind)) continue;
    const node = mystery.nodes.find((entry) => entry.id === action.nodeId);
    const option = node?.options?.find((entry) => entry.id === action.optionId);
    add(`mystery.${action.kind}`, ref('mystery', mystery.graph.id), action.kind === 'discover' ? 'Investigate lead'
      : action.kind === 'choice' ? `Choose: ${option?.title || title(action.optionId)}` : `Complete: ${node?.title || 'case step'}`,
    { graphId: mystery.graph.id, nodeId: action.nodeId, ...(action.optionId ? { optionId: action.optionId } : {}),
      ...(action.interactionId ? { interactionId: action.interactionId } : {}) }, true, [],
    action.kind === 'choice' ? { confirmation: { required: true, message: 'This choice permanently changes your story branch.' },
      risk: [{ kind: 'irreversible', description: 'This story choice cannot be undone.' }] } : {});
  }
  for (const graph of board.discovery.graphs) {
    if (!board.discovery.instances.some((entry) => entry.graphId === graph.id && !entry.historical))
      add('discovery.start', ref('discovery', graph.id), `Investigate: ${graph.title}`,
        { graphId: graph.id, expectedContentHash: graph.contentHash }, true);
  }
  for (const instance of board.discovery.instances) {
    for (const action of instance.actions) add('discovery.act', ref('discovery', instance.id), action.label,
      { instanceId: instance.id, actionId: action.id, expectedRevision: instance.revision }, true);
  }
  if (board.knowledgeSharingEnabled) for (const claim of board.knowledge.claims.filter((entry) => entry.owned).slice(0, 20)) {
    for (const kind of ['crew', 'family']) {
      const group = board[kind];
      if (!group) continue;
      add('knowledge.share', ref('clue', claim.id), `Share ${title(claim.proposition)} with ${group.name}`,
        { claimId: claim.id, kind, groupId: group.id, expectedAclRevision: claim.aclRevision }, true, [],
        { target: ref(kind, group.id), confirmation: { required: true, message: `Make this evidence available to your current ${kind}?` } });
    }
    for (const grant of claim.grants) add('knowledge.revoke', ref('clue', claim.id), `Stop sharing with ${grant.label}`,
      { claimId: claim.id, grantId: grant.id, expectedAclRevision: claim.aclRevision }, true, [],
      { confirmation: { required: true, message: 'Remove this grant of access to your evidence?' } });
  }
  for (const recipe of board.recipes) add('recipe.craft', ref('recipe', recipe.id), `Craft: ${recipe.title || title(recipe.id)}`,
    { recipeId: recipe.id }, recipe.canAttempt === true, recipe.missing || ['undiscovered_requirement'], {
      costs: [...(recipe.consumes || []), ...(recipe.cashCost ? [{ kind: 'cash', quantity: recipe.cashCost }] : [])],
      requiredItems: (recipe.consumes || []).filter((entry) => entry.templateId?.startsWith('item:')),
    });
  for (const car of board.vehicles) {
    const missing = [...(board.player.character.locationId === 'foundry' ? [] : ['location']),
      ...(car.committed ? ['vehicle'] : [])];
    add('item.salvage', ref('item', car.id), 'Strip a wreck for materials', { carId: car.id }, !missing.length, missing,
      { costs: [{ kind: 'vehicle', id: car.id, quantity: 1 }], confirmation: { required: true, message: 'This consumes the vehicle.' } });
  }
  for (const object of board.worldObjects) for (const action of object.actions || [])
    add('world.execute', ref('world_object', object.id), title(action.actionId),
      { objectId: object.id, actionId: action.actionId, itemId: action.itemId, expectedRevision: action.expectedRevision },
      action.canAttempt === true, action.missing || [], { target: ref('territory', object.locationId) });
  for (const situation of board.situations || []) for (const action of situation.actions || [])
    add('situation.act', ref('situation', situation.id), action.label,
      { situationId: situation.id, actionId: action.id, expectedRevision: situation.revision },
      action.canAttempt === true, action.missing || [], {
        description: action.description || situation.description,
        expiresAt: situation.expiresAt,
        requiredRoles: action.requiredRoles || [],
        ...(action.confirmation ? { confirmation: action.confirmation } : {}),
      });
  for (const definition of board.operations.catalog) add('operation.create', ref('operation', definition.id), `Organize: ${definition.title}`,
    { definitionId: definition.id }, definition.canCreate === true, definition.missing || [], { requiredRoles: definition.roles || [] });
  const operation = board.operations.selected;
  if (operation) {
    const terminal = ['completed', 'failed', 'canceled', 'expired'].includes(operation.status);
    const extras = { committedResources: operation.roles.flatMap((role) => (role.requirements || [])
      .filter((entry) => ['promised', 'fulfilled'].includes(entry.state)).map(({ id, kind, quantity, state }) => ({ id, kind, quantity, state }))),
    requiredParticipants: operation.roles.map(({ id, title, filled }) => ({ id, title, filled })) };
    const act = (action, label) => add(`operation.${action.action}`, ref('operation', operation.id), label || title(action.action),
      { operationId: operation.id, ...action.input }, action.canAttempt, action.missing || [], {
        ...extras, ...(terminal ? { availability: operation.status === 'expired' ? 'EXPIRED' : 'COMPLETED' } : {}),
        ...(['execute', 'cancel'].includes(action.action) ? { confirmation: { required: true,
          message: action.action === 'execute' ? 'Resolve this operation and its committed resources?' : 'Cancel this operation?' } } : {}),
      });
    for (const action of operation.actions) act(action);
    for (const role of operation.roles) {
      for (const action of role.actions || []) act(action, `Join as ${role.title}`);
      for (const requirement of role.requirements || []) for (const action of requirement.actions || [])
        act(action, `${title(action.action)}: ${title(requirement.templateId || requirement.kind)}`);
    }
  }
  // Selected operations/cases stay actionable even with a larger discovery catalog.
  commands.sort((a, b) => Number(b.subject.id === operation?.id) - Number(a.subject.id === operation?.id)
    || Number(b.subject.id === mystery?.graph.id) - Number(a.subject.id === mystery?.graph.id)
    || Number(b.availability === 'AVAILABLE') - Number(a.availability === 'AVAILABLE') || a.commandId.localeCompare(b.commandId));
  return { commands: commands.slice(0, COMMAND_LIMIT), commandsTruncated: commands.length > COMMAND_LIMIT };
}

// Compare only current authorized facts; timestamps of the read are not state revisions.
const fingerprint = (board) => hash(JSON.parse(JSON.stringify(board, (key, value) => key === 'asOf' ? undefined : value)));
const diff = (before, after, key = 'id') => after.filter((entry) => !before.some((old) => old[key] === entry[key] && hash(old) === hash(entry)));

export function createPlayerCommandEngine({ pool, content, enabled = false, knowledgeEnabled = false, sharingEnabled = false,
  operationsEnabled = enabled, discoveryEnabled = enabled, accountIds = [], director = null }) {
  const policy = { enabled, knowledgeEnabled, sharingEnabled, accountIds };
  const kernel = createWorldKernel({ pool, registry: content.registry, objects: content.objects, ...policy });
  const knowledge = createCoordinationKnowledge(policy);
  const query = createWorldKernelQuery({ pool, knowledge, registry: content.registry });
  const crafting = createCraftingContext({ registry: content.registry, knowledgeEnabled, sharingEnabled, accountIds, worldDefinitions: kernel.definitions });
  const family = createFamilyOperations({ pool, registry: content.registry, kernel, definitions: content.operations,
    prerequisitesEnabled: content.progression === true, ...policy, enabled: operationsEnabled });
  const discovery = createCoordinationService({ pool, registry: content.coordinationRegistry,
    prerequisitesEnabled: content.progression === true, ...policy, enabled: discoveryEnabled });
  const projection = createWorldProjection({ pool, query, kernel, knowledge, familyOperations: family, crafting,
    recipeIds: content.recipeIds, director, mysteries: content.progression ? { registry: content.registry, graphIds: content.mysteryGraphIds,
      knowledgeEnabled, sharingEnabled, accountIds, worldDefinitions: kernel.definitions } : null });
  const admit = async (accountId, expectedCharacterId = null) => {
    if (!enabled || !identifier(accountId) || (accountIds.length && !accountIds.includes(accountId))) fail();
    const account = (await pool.query('SELECT status FROM accounts WHERE id=$1', [accountId])).rows[0];
    const actor = (await pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2', [accountId])).rows;
    if (account?.status !== 'active' || actor.length !== 1 || (expectedCharacterId && actor[0].id !== expectedCharacterId)) fail();
    return actor[0].id;
  };
  async function read(accountId, options) {
    await admit(accountId);
    const board = await projection.snapshot(accountId, options);
    const discoveries = discoveryEnabled ? await discovery.catalog(accountId) : { graphs: [], instances: [] };
    // Existing owner index bounds this by the current character; no city-wide item scan.
    const vehicles = await withItemRead(pool, async (client) => (await client.query(`SELECT id,listed,pledged,minted_onchain,race_limit,pink_slip
      FROM cars WHERE character_id=$1 AND model_id='junker' ORDER BY id LIMIT 21`, [board.player.character.id])).rows);
    // Discovery has its own short authority snapshots. Never combine two
    // character generations if succession crossed these bounded reads.
    await admit(accountId, board.player.character.id);
    return { ...board, knowledgeSharingEnabled: sharingEnabled && knowledgeEnabled,
      discovery: { graphs: discoveries.graphs, instances: discoveries.instances },
      vehicles: vehicles.slice(0, 20).map((car) => ({ id: car.id, committed: !!(car.listed || car.pledged || car.minted_onchain || car.race_limit !== null || car.pink_slip) })),
      vehiclesTruncated: vehicles.length > 20 };
  }
  async function snapshot(accountId, options = {}) {
    const board = await read(accountId, options), draft = commandsFor(board);
    const stateHash = fingerprint(board), expiresAt = new Date((Math.floor(Date.now() / LIFETIME_MS) + 1) * LIFETIME_MS).toISOString();
    const boardId = hash(['omerta-command-board-v1', accountId, board.player.character.id, stateHash, expiresAt, options]);
    await pool.query(`INSERT INTO player_command_boards(id,account_id,character_id,state_hash,options_json,commands_json,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING`,
    [boardId, accountId, board.player.character.id, stateHash, JSON.stringify(options), JSON.stringify(draft.commands), expiresAt]);
    const commands = draft.commands.map((command) => ({ ...command,
      expiresAt: command.expiresAt && new Date(command.expiresAt).getTime() < new Date(expiresAt).getTime() ? command.expiresAt : expiresAt,
      executionIdentity: command.availability === 'AVAILABLE' ? { executionId: `${boardId}.${command.commandId}` } : null }));
    return { ...board, commandSchemaVersion: 1, commands, commandsTruncated: draft.commandsTruncated, ...playerOpportunities(board, commands) };
  }
  const domainKey = (executionId) => `player-command:${hash(executionId)}`;
  async function receipt(accountId, command, key, characterId) {
    if (command.commandType === 'situation.act') return director ? director.receipt(accountId, key, characterId) : null;
    if (command.commandType.startsWith('discovery.') || command.commandType.startsWith('knowledge.')) return (await pool.query(
      'SELECT response_json FROM coordination_commands WHERE account_id=$1 AND command_key=$2', [accountId, key])).rows[0]?.response_json ?? null;
    const receiptKey = command.commandType.startsWith('operation.') ? `family-operation:${hash([accountId, key])}`
      : command.commandType === 'world.execute' ? `world:${hash([accountId, key])}` : key;
    return (await pool.query('SELECT result_json FROM item_mutation_guards WHERE idempotency_key=$1', [receiptKey])).rows[0]?.result_json ?? null;
  }
  async function dispatch(accountId, characterId, command, key) {
    const p = command.parameters, type = command.commandType;
    if (type === 'situation.act') {
      if (!director) fail();
      return director.command(accountId, p.situationId, p.actionId, { expectedRevision: p.expectedRevision }, key, characterId);
    }
    if (type === 'discovery.start') return discovery.create(accountId, p.graphId, { expectedContentHash: p.expectedContentHash }, key, characterId);
    if (type === 'discovery.act') return discovery.act(accountId, p.instanceId, { actionId: p.actionId, expectedRevision: p.expectedRevision }, key, characterId);
    if (type === 'knowledge.share') return discovery.shareKnowledgeWithGroup(accountId, p.claimId,
      { kind: p.kind, groupId: p.groupId, expectedAclRevision: p.expectedAclRevision }, key, characterId);
    if (type === 'knowledge.revoke') return discovery.revokeKnowledge(accountId, p.claimId,
      { grantId: p.grantId, expectedAclRevision: p.expectedAclRevision }, key, characterId);
    if (type === 'operation.create') return family.create(accountId, { definitionId: p.definitionId }, key, characterId);
    if (type.startsWith('operation.')) {
      const { operationId, ...input } = p;
      return family.command(accountId, operationId, type.slice('operation.'.length), input, key, characterId);
    }
    if (type === 'world.execute') return kernel.execute(accountId, p, key, characterId);
    return withItemTransaction(pool, async (client) => {
      if (type === 'recipe.craft') return craftWorldGraphRecipe(client, { accountId, expectedCharacterId: characterId }, p.recipeId, key, crafting);
      if (type === 'item.salvage') return salvageCar(client, { accountId, expectedCharacterId: characterId }, p.carId, 'recipe:car_salvage_basic', key, crafting);
      const context = createMysteryContext({ registry: content.registry, accountId, knowledgeEnabled, sharingEnabled, accountIds,
        worldDefinitions: kernel.definitions, prerequisitesEnabled: true, operationOutcomesEnabled: true });
      const owner = { scope: 'character', id: characterId }, options = { idempotencyKey: key,
        ...(p.interactionId ? { interactionId: p.interactionId } : {}) };
      if (type === 'mystery.start') return startMystery(client, context, owner, p.graphId, content.registry.byPackage.get(p.graphId).version, key);
      if (type === 'mystery.choice') return commitChoice(client, context, owner, p.graphId, p.nodeId, p.optionId, options);
      if (type === 'mystery.discover') return discoverNode(client, context, owner, p.graphId, p.nodeId, options);
      if (type === 'mystery.complete') return completeNode(client, context, owner, p.graphId, p.nodeId, options);
      fail();
    });
  }
  async function execute(accountId, input, key) {
    if (!input || ![Object.prototype, null].includes(Object.getPrototypeOf(input))
      || Object.keys(input).sort().join(',') !== 'confirmed,executionId' || typeof input.confirmed !== 'boolean'
      || typeof input.executionId !== 'string' || !/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(input.executionId)
      || key !== input.executionId) fail('bad_command_request');
    const [boardId, commandId] = input.executionId.split('.');
    const issued = (await pool.query('SELECT * FROM player_command_boards WHERE id=$1 AND account_id=$2', [boardId, accountId])).rows[0];
    if (!issued) fail();
    await admit(accountId, issued.character_id);
    const command = JSON.parse(issued.commands_json).find((entry) => entry.commandId === commandId);
    if (!command || command.availability !== 'AVAILABLE') fail();
    if (command.confirmation.required && !input.confirmed) fail('command_confirmation_required');
    const options = JSON.parse(issued.options_json), actionKey = domainKey(input.executionId);
    let raw = await receipt(accountId, command, actionKey, issued.character_id), replayed = raw !== null, before = null;
    if (!replayed) await withIssuedBoard(pool, boardId, accountId, async () => {
      raw = await receipt(accountId, command, actionKey, issued.character_id); replayed = raw !== null;
      if (replayed) return;
      if (new Date(issued.expires_at).getTime() <= Date.now()) fail('command_expired');
      if (command.expiresAt && new Date(command.expiresAt).getTime() <= Date.now()) fail('command_expired');
      before = await read(accountId, options);
      if (fingerprint(before) !== issued.state_hash) {
        // A concurrent attempt may have committed while this read was in flight.
        raw = await receipt(accountId, command, actionKey, issued.character_id); replayed = raw !== null;
        if (!replayed) fail('command_stale');
      }
      if (!replayed) raw = await dispatch(accountId, issued.character_id, command, actionKey);
    });
    // Domain COMMIT already happened. A failed read must never invite a new key.
    const outcome = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const nextOptions = { ...options,
      ...(command.commandType === 'mystery.start' ? { mysteryGraphId: command.parameters.graphId } : {}),
      ...(['operation.create', 'situation.act'].includes(command.commandType) && outcome?.operationId ? { operationId: outcome.operationId } : {}) };
    let next = null;
    try { next = await snapshot(accountId, nextOptions); } catch { /* exact retry reconciles the existing domain receipt */ }
    const priorCommands = before ? commandsFor(before).commands : [];
    const priorOpportunities = before ? playerOpportunities(before, priorCommands).opportunities : [];
    const feedback = { immediateResult: { status: 'COMPLETED', label: command.label }, refreshRequired: !next,
      worldChanges: next && before ? diff(before.worldObjects, next.worldObjects) : [],
      inventoryChanges: next && before ? [...diff(before.inventory.items, next.inventory.items),
        ...diff(before.inventory.resources, next.inventory.resources, 'templateId'),
        ...before.inventory.items.filter((entry) => !next.inventory.items.some((current) => current.id === entry.id))
          .map((entry) => ({ kind: 'no_longer_held', id: entry.id })),
        ...before.vehicles.filter((entry) => !next.vehicles.some((current) => current.id === entry.id))
          .map((entry) => ({ kind: 'no_longer_held', id: entry.id }))] : [],
      knowledgeChanges: next && before ? diff(before.knowledge.claims, next.knowledge.claims) : [],
      relationshipChanges: next && before && hash([before.crew, before.family]) !== hash([next.crew, next.family])
        ? [{ crew: next.crew, family: next.family }] : [],
      operationChanges: next && before ? diff(before.operations.instances, next.operations.instances) : [],
      ...(director ? { situationChanges: next && before ? diff(before.situations || [], next.situations || []) : [] } : {}),
      mysteryProgression: next && before ? [...diff(before.cases?.catalog || [], next.cases?.catalog || [], 'graphId'),
        ...diff(before.cases?.selected?.nodes || [], next.cases?.selected?.nodes || [])] : [],
      newOpportunities: next && before ? next.opportunities.filter((entry) => !priorOpportunities.some((old) => old.opportunityId === entry.opportunityId)) : [],
      removedOpportunities: next && before ? priorOpportunities.filter((entry) => !next.opportunities.some((current) => current.opportunityId === entry.opportunityId))
        .map((entry) => ({ opportunityId: entry.opportunityId })) : [] };
    const result = { ...(outcome?.operationId ? { operationId: outcome.operationId } : {}),
      ...(outcome?.instance?.id ? { instanceId: outcome.instance.id } : {}) };
    return { schemaVersion: 1, executionId: input.executionId, status: 'COMPLETED', replayed, result, feedback, projection: next };
  }
  return Object.freeze({ snapshot, execute });
}
