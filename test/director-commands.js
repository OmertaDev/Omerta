// The Director adapter participates in the existing authenticated projection,
// command boards and domain receipts. Runtime/lifecycle tests live separately.
import assert from 'node:assert/strict';
import { createFurnaceLedger } from '../src/content/furnace-ledger.js';
import { createPlayerCommandEngine } from '../src/player-commands.js';
import { createCoordinationService } from '../src/coordination/runtime.js';
import { coordinationGraphs } from '../src/coordination/graph.js';
import { assertKnowledgeSnapshot } from '../src/coordination/knowledge.js';
import { commandDatabase, addPlayer, characterId, findCommand, executeIssued, postgres } from './lib/player-command-support.js';

const database = await commandDatabase('director_commands'), pool = database.pool;
const content = { ...createFurnaceLedger(), progression: true };
const actor = 'situation-command-owner', stranger = 'situation-command-outsider';
const discovery = createCoordinationService({ pool, registry: content.coordinationRegistry,
  enabled: true, knowledgeEnabled: true, sharingEnabled: true, prerequisitesEnabled: true });
const graph = coordinationGraphs(content.coordinationRegistry)[0];
const state = { revision: 1, expiresAt: new Date(Date.now() + 120000).toISOString(), visible: true };
let dispatches = 0, planned = 0;
const director = {
  async planSnapshot(client, accountId, { expectedCharacterId, asOf }) {
    assert.equal(expectedCharacterId, characterId(accountId));
    assert(Number.isFinite(asOf));
    planned++;
    return { groups: [], async render(snapshot) {
      assertKnowledgeSnapshot(client, snapshot, accountId);
      if (accountId !== actor || !state.visible) return [];
      return [{ id: 'situation-docks', title: 'A shipment is overdue', description: 'Find out what stopped the cargo.',
        objective: 'Investigate the missing shipment.', revision: state.revision, expiresAt: state.expiresAt,
        status: 'active', knownFacts: ['Dock workers have stopped loading.'], helpers: ['Your Crew'],
        actions: [{ id: 'investigate', label: 'Investigate the shipment', canAttempt: true,
          confirmation: { required: true, message: 'Open an investigation?' },
          // Neither implementation hints nor substituted inputs belong in commands.
          definitionId: 'internal-definition', parameters: { accountId: stranger } }] }];
    } };
  },
  async receipt(accountId, key, expectedCharacterId) {
    assert.equal(expectedCharacterId, characterId(accountId));
    return (await pool.query('SELECT response_json FROM coordination_commands WHERE account_id=$1 AND command_key=$2',
      [accountId, key])).rows[0]?.response_json ?? null;
  },
  async command(accountId, situationId, actionId, input, key, expectedCharacterId) {
    assert.equal(accountId, actor); assert.equal(situationId, 'situation-docks'); assert.equal(actionId, 'investigate');
    assert.deepEqual(input, { expectedRevision: state.revision });
    assert.equal(expectedCharacterId, characterId(actor)); assert.match(key, /^player-command:[a-f0-9]{64}$/);
    dispatches++;
    const result = await discovery.create(accountId, graph.id, { expectedContentHash: graph.contentHash }, key, expectedCharacterId);
    state.revision++;
    return result;
  },
};
const engine = (adapter = director) => createPlayerCommandEngine({ pool, content, director: adapter,
  enabled: true, knowledgeEnabled: true, sharingEnabled: true });
try {
  await addPlayer(pool, actor); await addPlayer(pool, stranger);
  const disabled = await engine(null).snapshot(actor);
  assert(!Object.hasOwn(disabled, 'situations'));
  assert(!disabled.commands.some((command) => command.commandType === 'situation.act'));
  const service = engine(), initial = await service.snapshot(actor);
  const move = findCommand(initial, 'situation.act');
  assert.deepEqual(move.parameters, { situationId: 'situation-docks', actionId: 'investigate' });
  assert(!Object.hasOwn(initial.situations[0], 'revision'), 'Director freshness metadata remains server-side');
  assert(!JSON.stringify(initial.situations).includes('internal-definition'));
  assert(!JSON.stringify(initial.situations).includes(stranger));
  assert.equal(move.subject.type, 'situation');
  assert(new Date(move.expiresAt).getTime() <= new Date(state.expiresAt).getTime());
  assert(initial.opportunities.some((entry) => entry.kind === 'world_event' && entry.commandIds.includes(move.commandId)));
  assert((await service.snapshot(stranger)).situations.length === 0);
  await assert.rejects(() => executeIssued(service, stranger, move), { code: 'command_unavailable' });
  await assert.rejects(() => executeIssued(service, actor, move, false), { code: 'command_confirmation_required' });
  const forged = `${'0'.repeat(64)}.${move.commandId}`;
  await assert.rejects(() => service.execute(actor, { executionId: forged, confirmed: true }, forged), { code: 'command_unavailable' });
  await assert.rejects(() => service.execute(actor, { executionId: move.executionIdentity.executionId,
    confirmed: true, situationId: 'forged' }, move.executionIdentity.executionId), { code: 'bad_command_request' });
  assert.equal(dispatches, 0);

  state.visible = false;
  await assert.rejects(() => executeIssued(service, actor, move), { code: 'command_stale' });
  state.visible = true; state.revision++;
  await assert.rejects(() => executeIssued(service, actor, move), { code: 'command_stale' });
  assert.equal(dispatches, 0);
  const current = findCommand(await service.snapshot(actor), 'situation.act');
  const attempts = await Promise.allSettled(Array.from({ length: postgres ? 6 : 1 }, () => executeIssued(engine(), actor, current)));
  const successes = attempts.filter((entry) => entry.status === 'fulfilled');
  assert(successes.length > 0);
  assert.equal(successes.filter((entry) => !entry.value.replayed).length, 1);
  const result = successes.find((entry) => !entry.value.replayed).value;
  assert.equal(result.status, 'COMPLETED'); assert(result.result.instanceId);
  assert.equal(dispatches, 1); assert.equal(result.feedback.situationChanges.length, 0,
    'A revision-only change is not an additional player-visible consequence');
  assert(!JSON.stringify(result.result).includes('internal-definition'));
  const restarted = await executeIssued(engine(), actor, current);
  assert.equal(restarted.replayed, true); assert.equal(dispatches, 1);
  assert.deepEqual(restarted.result, result.result);
  assert.equal(Number((await pool.query('SELECT count(*) AS n FROM coordination_commands WHERE account_id=$1', [actor])).rows[0].n), 1);

  state.expiresAt = new Date(Date.now() - 1).toISOString();
  const expired = findCommand(await service.snapshot(actor), 'situation.act');
  await assert.rejects(() => executeIssued(service, actor, expired), { code: 'command_expired' });
  assert.equal((await executeIssued(service, actor, current)).replayed, true, 'expiry never destroys the committed domain receipt');
  await pool.query("UPDATE accounts SET status='suspended' WHERE id=$1", [actor]);
  await assert.rejects(() => executeIssued(service, actor, current), { code: 'command_unavailable' });
  await pool.query("UPDATE accounts SET status='active' WHERE id=$1", [actor]);
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [characterId(actor)]);
  await pool.query("INSERT INTO characters(id,account_id,name,season,loc) VALUES('director-command-heir',$1,'Heir',1,'docks')", [actor]);
  await assert.rejects(() => executeIssued(service, actor, current), { code: 'command_unavailable' });
  assert.equal(dispatches, 1); assert(planned > 0);
  console.log('director-commands: shared knowledge snapshot, authorized cards, opaque issuance, delegated discovery, stale/forged/expired denial, durable replay and succession PASS');
} finally { await database.cleanup(pool); }
