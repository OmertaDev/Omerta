// Scoped trust-boundary regressions for the disabled-by-default Director.
import assert from 'node:assert/strict';
import { dockFixture, key, ids } from './lib/director-support.js';
import { postgres } from './lib/player-command-support.js';
import { withItemRead } from '../src/items.js';
import { createCoordinationKnowledge } from '../src/coordination/knowledge.js';
import { leaveGang } from '../src/social.js';
import { leaveCrew } from '../src/crew.js';
import { createLivingWorldDirector } from '../src/director/runtime.js';
import { createDockWarDefinitions } from '../src/director/dock-war.js';

const f = await dockFixture('director_security');
let at = Date.now();
const definitions = createDockWarDefinitions(f.content);
const make = (options = {}) => createLivingWorldDirector({ pool: f.pool, content: f.content, definitions,
  mode: 'LIVE', clock: () => at, ...options });
const knowledge = createCoordinationKnowledge({ enabled: true, knowledgeEnabled: true, sharingEnabled: true });
const cards = (director, account) => withItemRead(f.pool, async (client) => {
  const plan = await director.planSnapshot(client, account, { asOf: at });
  const snapshot = await knowledge.readSnapshot(client, { viewer: { accountId: account }, groups: plan.groups });
  return plan.render(snapshot);
});
const count = async (table) => Number((await f.pool.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);
const unavailable = (work) => assert.rejects(work, { code: 'director_unavailable' });

try {
  await f.establish();
  const disabled = make({ mode: 'DIRECTOR_DISABLED' });
  assert.equal((await disabled.tick()).skipped, true);
  assert.equal(await count('director_situations'), 0);
  const beforeWorld = (await f.pool.query('SELECT * FROM world_kernel_objects')).rows;
  const shadow = make({ mode: 'SHADOW_MODE' });
  assert.equal((await shadow.tick()).selected.length, 1);
  assert.equal(await count('director_situations'), 0);
  assert.deepEqual((await f.pool.query('SELECT * FROM world_kernel_objects')).rows, beforeWorld);
  assert.deepEqual(await cards(shadow, f.actors.aBoss), []);
  at += 1;
  let director = make();
  const concurrent = await Promise.all([director.tick(), make().tick()]);
  assert.equal(concurrent.filter((result) => !result.replayed).length, 1, 'duplicate workers share one durable evaluation');
  assert.equal(await count('director_situations'), 1); assert.equal(await count('director_campaigns'), 1);
  const situation = (await f.pool.query('SELECT * FROM director_situations')).rows[0];
  director = make();
  assert.equal((await director.tick()).replayed, true, 'worker restart reuses the exact evaluation receipt');
  assert.deepEqual(await cards(director, f.actors.outsider), [], 'an uninformed player outside a Crew cannot enumerate hidden situations');
  await unavailable(() => director.command(f.actors.outsider, situation.id, 'protect', { expectedRevision: 1 }, key()));
  await unavailable(() => director.command(f.actors.aBoss, 'forged-situation', 'protect', { expectedRevision: 1 }, key()));
  await unavailable(() => director.command(f.actors.aBoss, situation.id, 'forged-action', { expectedRevision: 1 }, key()));
  await unavailable(() => director.command(f.actors.aBoss, situation.id, 'protect', { expectedRevision: 0 }, key()));
  await unavailable(() => director.command(f.actors.aBoss, situation.id, 'protect', { expectedRevision: 1 }, key(), 'retired-character'));
  const controllerCards = await cards(director, f.actors.aBoss);
  assert(controllerCards[0].actions.some((action) => action.id === 'protect'));
  const rivalCards = await cards(director, f.actors.bBoss);
  assert(!rivalCards[0].actions.some((action) => action.id === 'intercept'), 'rival membership does not convey route knowledge');
  const wireView = JSON.stringify(controllerCards);
  for (const secret of ['pressureInputs', 'definition_hash', 'definitionId', 'weight', 'consequenceContracts', 'selectionLatencyMs'])
    assert(!wireView.includes(secret), `player signal leaks Director internals: ${secret}`);

  const owned = (await f.knowledge.knowledgeBoard(f.actors.aBoss)).claims.find((claim) => claim.proposition === 'shipment.route');
  const target = (await f.knowledge.knowledgeTargets(f.actors.aBoss, { characterName: f.names.bBoss })).targets.find((entry) => entry.kind === 'account');
  assert(target);
  const original = (await f.knowledge.knowledgeGet(f.actors.aBoss, owned.id)).claim;
  await f.knowledge.shareKnowledge(f.actors.aBoss, owned.id, { targetId: target.id, expectedAclRevision: original.aclRevision }, key());
  assert((await cards(director, f.actors.bBoss))[0].actions.some((action) => action.id === 'intercept'));
  const shared = (await f.knowledge.knowledgeGet(f.actors.aBoss, owned.id)).claim;
  const grant = shared.grants.find((entry) => entry.kind === 'account' && entry.label === f.names.bBoss); assert(grant);
  await f.knowledge.revokeKnowledge(f.actors.aBoss, owned.id, { grantId: grant.id, expectedAclRevision: shared.aclRevision }, key());
  assert(!(await cards(director, f.actors.bBoss))[0].actions.some((action) => action.id === 'intercept'));
  await unavailable(() => director.command(f.actors.bBoss, situation.id, 'intercept', { expectedRevision: 1 }, key()));
  assert.equal(await count('world_operations'), 0, 'revocation rejects stale opportunity without creating an operation');

  await f.social(f.actors.aBoss, (ch, client, h) => leaveGang(ch, client, h));
  assert(!(await cards(director, f.actors.aBoss))[0].actions.some((action) => action.id === 'protect'));
  await unavailable(() => director.command(f.actors.aBoss, situation.id, 'protect', { expectedRevision: 1 }, key()));
  await f.social(f.actors.aBoss, (ch, client, h) => leaveCrew(ch, client, h));
  assert.deepEqual(await cards(director, f.actors.aBoss), [], 'Crew departure removes the remaining private rumor signal');
  await unavailable(() => director.command(f.actors.aBoss, situation.id, 'investigate', { expectedRevision: 1 }, key()));
  const cohort = make({ mode: 'LIMITED_COHORT', accountIds: [f.actors.aRunner] });
  assert.deepEqual(await cards(cohort, f.actors.bBoss), []);
  await unavailable(() => cohort.command(f.actors.bBoss, situation.id, 'investigate', { expectedRevision: 1 }, key()));

  assert.throws(() => make({ definitions: structuredClone(definitions) }), { code: 'bad_director_configuration' },
    'JSON carrying a plausible version and hash is not an admitted immutable definition');
  const pin = (await f.pool.query('SELECT * FROM director_definitions LIMIT 1')).rows[0];
  await f.pool.query('UPDATE director_definitions SET definition_json=$1 WHERE kind=$2 AND definition_id=$3 AND version=$4',
    ['{}', pin.kind, pin.definition_id, pin.version]);
  at += 300000;
  await assert.rejects(() => director.tick(), { code: 'director_definition_changed' });
  assert.equal(await count('director_situations'), 1);
  await f.pool.query('UPDATE director_definitions SET definition_json=$1 WHERE kind=$2 AND definition_id=$3 AND version=$4',
    [pin.definition_json, pin.kind, pin.definition_id, pin.version]);
  at = new Date(situation.expires_at).getTime() + 1;
  assert.deepEqual(await cards(director, f.actors.bBoss), [], 'expired situations disappear before worker cleanup');
  await unavailable(() => director.command(f.actors.bBoss, situation.id, 'investigate', { expectedRevision: 1 }, key()));
  await director.tick();
  const expired = (await f.pool.query('SELECT terminal,outcome FROM director_situations WHERE id=$1', [situation.id])).rows[0];
  assert.equal(expired.terminal, true); assert.equal(expired.outcome, 'expiry');
  assert.equal(await count('world_operations'), 0);
  assert.deepEqual((await f.pool.query('SELECT * FROM world_kernel_objects')).rows, beforeWorld,
    'selection, expiry, restart, denials and tamper rejection never mutate canonical resources or world state');
  for (const value of Object.values(director.metrics())) assert.equal(typeof value, 'number', 'metrics contain no actor identities');
  console.log('Director security: enumeration, ACL revocation, membership, forged/stale actions, duplicate workers, restart, expiry and definition tamper passed');
} finally { await f.cleanup(); }

if (postgres) {
  // Force a physical operation between the scheduler's canonical fact sample
  // and its later event query. The shared object lock must defer that mutation
  // until this evaluation commits; the next tick must retain the right branch.
  const race = await dockFixture('director_security_race');
  let releaseRead, reachedRead;
  const release = new Promise((resolve) => { releaseRead = resolve; });
  const reached = new Promise((resolve) => { reachedRead = resolve; });
  let armed = false, used = false, raceAt = Date.now();
  const barrierPool = { query: (...args) => race.pool.query(...args), async connect() {
    const client = await race.pool.connect();
    return { release: (...args) => client.release(...args), async query(sql, parameters) {
      if (armed && !used && sql.includes('FROM world_kernel_events') && sql.includes('WHERE object_id=$1 AND revision>$2')) {
        used = true; reachedRead(); await release;
      }
      return client.query(sql, parameters);
    } };
  } };
  try {
    await race.establish();
    const prepared = await race.prepare(ids.protectOperation);
    const director = createLivingWorldDirector({ pool: barrierPool, content: race.content,
      definitions: createDockWarDefinitions(race.content), mode: 'LIVE', clock: () => raceAt });
    await director.tick();
    armed = true; raceAt += 300000;
    const evaluating = director.tick();
    await Promise.race([reached, evaluating.then(() => assert.fail('the canonical event observation barrier was not reached'))]);
    const executeKey = key();
    const resolving = prepared.command('organizer', 'execute', {}, executeKey)
      .then((result) => ({ result }), (error) => ({ error }));
    const duringSample = await Promise.race([resolving, new Promise((resolve) => setTimeout(() => resolve(null), 1500))]);
    releaseRead();
    await evaluating;
    const resolved = await resolving;
    assert(!duringSample?.result, 'the scheduler protects the fact/event sample from a concurrent physical mutation');
    if (resolved.error) {
      assert(['contention', '55P03', '40P01', '40001'].includes(resolved.error.code),
        `unexpected concurrent operation rejection: ${resolved.error.code}`);
      await prepared.command('organizer', 'execute', {}, executeKey);
    }
    const stale = (await race.pool.query('SELECT id,revision FROM director_situations WHERE terminal=false')).rows[0];
    const operationCount = Number((await race.pool.query('SELECT count(*) AS n FROM world_operations')).rows[0].n);
    await unavailable(() => director.command(race.actors.aBoss, stale.id, 'protect',
      { expectedRevision: Number(stale.revision) }, key()));
    assert.equal(Number((await race.pool.query('SELECT count(*) AS n FROM world_operations')).rows[0].n), operationCount,
      'a stale situation cannot create another operation after the physical outcome and before the next tick');
    raceAt += 300000;
    await director.tick();
    const campaign = (await race.pool.query('SELECT status,node_id FROM director_campaigns')).rows[0];
    assert.deepEqual(campaign, { status: 'active', node_id: 'protected' },
      'a real resolution after the sample advances to its matching aftermath instead of abandoning the campaign');
    console.log('Director security: native canonical fact/event race preserves the campaign outcome branch');
  } finally { releaseRead(); await race.cleanup(); }
}
