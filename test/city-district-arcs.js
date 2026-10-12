// Real HTTP authority proof; --postgres requires an explicitly owned loopback fixture.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { DISTRICT_STORY_ARCS } from '../src/content/district-story-arcs.js';
import { CITY_QUEST_PRESENTATIONS } from '../src/content/city-quest-presentation.js';
import { DISTRICTS, skillOf } from '../src/rules.js';

const postgres = process.argv.includes('--postgres');
let admin, namespace, app, createdSchema = false;
const nativeEndpoint = address => {
  assert.equal(typeof address, 'string', 'An explicit district-arcs disposable native test URL is required.');
  const endpoint = new URL(address);
  assert(!endpoint.search && !endpoint.hash, 'Fixture URLs cannot override driver host or connection options');
  assert(['postgres:', 'postgresql:'].includes(endpoint.protocol));
  assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname), 'Native fixture requires loopback.');
  assert(/^\/(?:omerta_query|omerta_check|city_district_arcs_[a-z0-9_]+)$/.test(endpoint.pathname), 'Use a named test database.');
  return endpoint;
};
assert.equal(nativeEndpoint('postgresql://127.0.0.1/omerta_query').pathname, '/omerta_query');
for (const address of [undefined, 'https://127.0.0.1/omerta_query', 'postgresql://production.invalid/omerta_query',
  'postgresql://127.0.0.1/postgres', 'postgresql://127.0.0.1/live_database']) assert.throws(() => nativeEndpoint(address));
for (const key of ['JWT_SECRET', 'MOD_KEY', 'MARKET_SEED']) process.env[key] = crypto.randomBytes(32).toString('hex');
process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.RATE_LIMIT = 'off';
process.env.INVITE_MODE = 'off';
process.env.POPULATION_OFF = 'on';
process.env.CORE_PROGRESSION = 'off';

try {
  if (postgres) {
    const endpoint = nativeEndpoint(process.env.CITY_DISTRICT_ARCS_TEST_DATABASE_URL);
    const { Pool } = await import('pg');
    admin = new Pool({ connectionString: endpoint.toString() });
    namespace = 'city_district_arcs_' + crypto.randomBytes(8).toString('hex');
    assert(/^city_district_arcs_[a-f0-9]{16}$/.test(namespace));
    await admin.query(`CREATE SCHEMA ${namespace}`);
    createdSchema = true;
    endpoint.searchParams.set('options', `-c search_path=${namespace}`);
    process.env.DATABASE_URL = endpoint.toString();
  } else assert(!process.env.DATABASE_URL, 'Memory proof requires disposable pg-mem.');
  const { buildServer } = await import('../src/server.js');
  app = await buildServer();
  if (postgres) {
    const provenance = (await app.pool.query('SELECT current_schema() AS schema,version() AS version')).rows[0];
    assert.equal(provenance.schema, namespace, 'The application must use the owned native schema.');
    assert.match(provenance.version, /^PostgreSQL /);
  }
  const call = (actor, method, url, body, key = crypto.randomUUID()) => app.inject({ method, url,
    ...(body !== undefined ? { payload: body } : {}),
    headers: { ...(actor?.headers || {}), ...(method === 'POST' ? { 'idempotency-key': key } : {}) } });
  const success = async request => {
    const response = await request; assert.equal(response.statusCode, 200, response.body); return response.json();
  };
  const actor = async name => {
    const guest = await success(call(null, 'POST', '/v1/auth/guest', { birthDate: '1990-01-01' }));
    const account = app.jwt.verify(guest.token).sub, headers = { authorization: 'Bearer ' + guest.token };
    await success(call({ headers }, 'POST', '/v1/character', { name }));
    const row = (await app.pool.query('SELECT id,generation FROM characters WHERE account_id=$1 AND alive', [account])).rows[0];
    await app.pool.query('UPDATE characters SET respect=10000,last_accrued_at=$2 WHERE id=$1',
      [row.id, new Date(Date.now() + 86400000)]);
    return { ...row, account, headers };
  };
  const witness = await actor('District Witness'), outsider = await actor('District Outsider');
  const root = graphId => '/v1/worldgraph/mysteries/' + encodeURIComponent(graphId);
  const board = (owner, graphId) => success(call(owner, 'GET', root(graphId)));
  const setDistrict = (owner, district) => app.pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [owner.id, district]);
  const money = async owner => ({
    character: (await app.pool.query('SELECT cash,bank,heat,ammo,respect FROM characters WHERE id=$1', [owner.id])).rows[0],
    account: (await app.pool.query('SELECT omr FROM account_persistent WHERE account_id=$1', [owner.account])).rows[0],
    ledger: Number((await app.pool.query('SELECT COUNT(*) n FROM transactions WHERE character_id=$1 OR account_id=$2',
      [owner.id, owner.account])).rows[0].n),
  });
  const kept = async (owner, templateId) => (await app.pool.query(
    'SELECT id,template_id,owner_scope,owner_id FROM item_instances WHERE template_id=$1 AND owner_scope=$2 AND owner_id=$3',
    [templateId, 'character', owner.id])).rows;
  const denied = async request => {
    const response = await request; assert(response.statusCode >= 400, response.body); return response.json();
  };
  const spec = (await app.inject({ url: '/openapi.json' })).json();
  const schemas = Object.fromEntries(Object.entries(spec.components.schemas).filter(([name]) => name.startsWith('WorldGraph')));
  const validator = new Ajv({ strict: false, allErrors: true });
  addFormats(validator);
  const validateCatalogue = validator.compile({ $ref: '#/components/schemas/WorldGraphMysteryDiscovery', components: { schemas } });
  const validateBoard = validator.compile({ $ref: '#/components/schemas/WorldGraphMysteryBoard', components: { schemas } });
  const catalogue = await success(call(witness, 'GET', '/v1/worldgraph/mysteries'));
  assert(validateCatalogue(catalogue), JSON.stringify(validateCatalogue.errors));
  const city = catalogue.mysteries.filter(entry => entry.cityQuest);
  assert.equal(city.length, 7);
  assert.equal(CITY_QUEST_PRESENTATIONS.length, 7);
  assert.deepEqual(DISTRICT_STORY_ARCS.map(story => story.presentation.districtId).sort(), DISTRICTS.map(district => district.id).sort());
  assert.equal(new Set(city.flatMap(entry => entry.actions.map(action => action.id))).size, city.length,
    'Simultaneous City quest offers have distinct issued action IDs.');
  const neighborhood = city.find(entry => entry.graphId === 'neighborhood-initiation');
  assert.equal(Object.hasOwn(neighborhood, 'districtId'), false, 'The original introduction remains available in every district.');
  assert.deepEqual(neighborhood.actions, [{ id: 'start', label: 'Accept the quest', method: 'POST',
    path: '/v1/worldgraph/mysteries/neighborhood-initiation/start', body: {}, available: true, blockedBy: [] }]);
  await success(call(witness, 'POST', neighborhood.actions[0].path, neighborhood.actions[0].body));
  const neighborhoodBoard = await board(witness, neighborhood.graphId);
  const originalChoice = neighborhoodBoard.nodes.find(node => node.type === 'choice');
  assert.deepEqual(originalChoice.uiActions.map(action => action.id), ['choose:listen', 'choose:ask']);
  assert.equal(neighborhoodBoard.uiActions.find(action => action.path.endsWith('/cancel')).id, 'cancel');

  for (const story of DISTRICT_STORY_ARCS) {
    assert(Object.isFrozen(story.package) && Object.isFrozen(story.package.nodes));
    assert(skillOf(story.skillId), 'Specialist requirements refer to the existing skill tree.');
    const entry = city.find(candidate => candidate.graphId === story.package.id);
    assert.equal(entry.districtId, story.presentation.districtId);
    assert.equal(entry.actions[0].id, encodeURIComponent(entry.graphId) + ':start');
    assert.equal(entry.actions[0].label, 'Begin ' + entry.title);
    const intro = story.package.nodes.find(node => node.id.endsWith('-introduction'));
    const choice = story.package.nodes.find(node => node.type === 'choice');
    const report = story.package.nodes.find(node => node.id.endsWith('-report'));
    const template = story.package.nodes.find(node => node.type === 'item_template');
    assert.equal(template.metadata.inert, true); assert.equal(template.metadata.tradeable, false); assert.equal(template.metadata.exportEligible, false);
    const expert = await actor('Expert ' + entry.districtId);
    for (const [owner, approach] of [[witness, 'witness'], [expert, 'specialist']]) {
      const before = await money(owner);
      await success(call(owner, 'POST', entry.actions[0].path, entry.actions[0].body));
      let current = await board(owner, entry.graphId);
      assert(validateBoard(current), JSON.stringify(validateBoard.errors));
      assert(!current.nodes.some(node => ['discovered', 'hidden'].includes(story.package.nodes.find(definition => definition.id === node.id)?.visibility)),
        'Neither undiscovered branch, evidence, report, nor hidden keepsake leaks through the initial board.');
      assert(current.nodes.every(node => node.districtId === entry.districtId && typeof node.venueId === 'string'));
      await denied(call(owner, 'POST', root(entry.graphId) + '/nodes/' + encodeURIComponent(report.id) + '/complete',
        { interactionId: entry.graphId + ':report' }));
      assert.equal((await kept(owner, template.id)).length, 0, 'Guessing the terminal step grants no keepsake.');
      await setDistrict(owner, entry.districtId === 'docks' ? 'neon' : 'docks');
      const wrongDistrict = await denied(call(owner, 'POST', root(entry.graphId) + '/nodes/' + encodeURIComponent(intro.id) + '/complete',
        { interactionId: entry.graphId + ':meet' }));
      assert.equal(wrongDistrict.error, 'location');
      await denied(call(owner, 'POST', root(entry.graphId) + '/nodes/' + encodeURIComponent(intro.id) + '/complete',
        { interactionId: entry.graphId + ':meet', district: entry.districtId, characterId: owner.id }));
      await setDistrict(owner, entry.districtId);
      current = await board(owner, entry.graphId);
      const introduction = current.nodes.find(node => node.id === intro.id).uiActions[0];
      assert.notEqual(introduction.label, 'Complete this step');
      await success(call(owner, 'POST', introduction.path, introduction.body));
      current = await board(owner, entry.graphId);
      const choiceAction = current.nodes.find(node => node.id === choice.id).uiActions.find(action => action.body.optionId === approach);
      assert(choiceAction.available); assert(choiceAction.id.startsWith(encodeURIComponent(entry.graphId) + ':choose:' + choice.id + ':'));
      await success(call(owner, 'POST', choiceAction.path, choiceAction.body));
      const other = approach === 'witness' ? 'specialist' : 'witness';
      const permanent = await denied(call(owner, 'POST', choiceAction.path, { ...choiceAction.body, optionId: other }));
      assert.equal(permanent.error, 'choice_committed');
      const activeId = story.package.nodes.find(node => node.id.endsWith('-' + approach)).id;
      const excludedId = story.package.nodes.find(node => node.id.endsWith('-' + other)).id;
      current = await board(owner, entry.graphId);
      assert(!current.nodes.some(node => node.id === excludedId), 'The undiscovered excluded branch stays private.');
      assert.equal((await app.pool.query(`SELECT n.state FROM mystery_node_state n
        JOIN mystery_instances i ON i.id=n.instance_id
        WHERE n.node_id=$1 AND i.owner_scope='character' AND i.owner_id=$2 AND i.graph_id=$3`,
      [excludedId, owner.id, entry.graphId])).rows[0].state, 'excluded');
      await denied(call(owner, 'POST', root(entry.graphId) + '/nodes/' + encodeURIComponent(excludedId) + '/complete',
        { interactionId: entry.graphId + ':' + other }));
      const branch = current.nodes.find(node => node.id === activeId);
      if (approach === 'specialist') {
        assert.equal(branch.uiActions[0].available, false);
        const missingSkill = await denied(call(owner, 'POST', branch.uiActions[0].path, branch.uiActions[0].body));
        assert.equal(missingSkill.error, 'skill');
        await success(call(owner, 'POST', '/v1/skills/' + story.skillId, {}));
        current = await board(owner, entry.graphId);
      }
      const contribution = current.nodes.find(node => node.id === activeId).uiActions[0];
      assert(contribution.available); assert.notEqual(contribution.label, 'Complete this step');
      await success(call(owner, 'POST', contribution.path, contribution.body));
      current = await board(owner, entry.graphId);
      const explore = current.uiActions.find(action => action.path === root(entry.graphId) + '/explore');
      assert(explore?.available); assert.equal(explore.venueId, 'stories');
      await success(call(owner, 'POST', explore.path, explore.body));
      current = await board(owner, entry.graphId);
      const finish = current.nodes.find(node => node.id === report.id).uiActions[0];
      assert(finish.available); assert.equal(finish.label, 'Publish your corrected account');
      const key = crypto.randomUUID(), result = await call(owner, 'POST', finish.path, finish.body, key);
      assert.equal(result.statusCode, 200, result.body);
      const replay = await call(owner, 'POST', finish.path, finish.body, key);
      assert.equal(replay.statusCode, 200, replay.body); assert.deepEqual(replay.json(), result.json());
      assert.equal(replay.headers['x-idempotent-replay'], 'true');
      await denied(call(owner, 'POST', finish.path, finish.body));
      const awarded = await kept(owner, template.id);
      assert.equal(awarded.length, 1, 'The completed branch issues exactly one character-owned keepsake across retries.');
      await denied(call(owner, 'POST', '/v1/worldgraph/items/' + encodeURIComponent(awarded[0].id) + '/assign-current-character', {}));
      current = await board(owner, entry.graphId);
      assert.equal(current.status, 'completed');
      assert(validateBoard(current), JSON.stringify(validateBoard.errors));
      assert.deepEqual(await money(owner), before, 'District story actions and learned-skill checks create no currency, heat, ammo or respect changes.');
      const inventory = await success(call(owner, 'GET', '/v1/worldgraph/inventory'));
      const keepsake = inventory.currentCharacterItems.find(item => item.id === awarded[0].id);
      assert(keepsake); assert.deepEqual(keepsake.actions, []);
    }
    const privateBefore = (await app.pool.query('SELECT status FROM mystery_instances WHERE owner_scope=$1 AND owner_id=$2 AND graph_id=$3',
      ['character', witness.id, entry.graphId])).rows[0];
    await denied(call(outsider, 'GET', root(entry.graphId)));
    const witnessInstance = (await app.pool.query('SELECT id FROM mystery_instances WHERE owner_scope=$1 AND owner_id=$2 AND graph_id=$3',
      ['character', witness.id, entry.graphId])).rows[0];
    await denied(call(outsider, 'POST', root(entry.graphId) + '/cancel', { instanceId: witnessInstance.id }));
    await denied(call(outsider, 'POST', root(entry.graphId) + '/start', { owner: { scope: 'character', id: witness.id } }));
    assert.deepEqual((await app.pool.query('SELECT status FROM mystery_instances WHERE id=$1', [witnessInstance.id])).rows[0], privateBefore);
  }
  await app.pool.query('UPDATE characters SET alive=false WHERE id=$1', [witness.id]);
  const replacementId = crypto.randomUUID();
  await app.pool.query(`INSERT INTO characters(id,account_id,name,season,generation,loc,respect,cash,last_accrued_at)
    VALUES($1,$2,'District Replacement',1,$3,'docks',10000,0,$4)`,
  [replacementId, witness.account, Number(witness.generation) + 1, new Date(Date.now() + 86400000)]);
  const replacement = await success(call(witness, 'GET', '/v1/worldgraph/mysteries'));
  assert(replacement.mysteries.filter(entry => entry.cityQuest && entry.districtId).every(entry => !entry.started));
  assert.equal(replacement.historicalInstances.filter(entry => entry.graphId.startsWith('district-')).length, 6);
  assert((await success(call(witness, 'GET', '/v1/worldgraph/inventory'))).currentCharacterItems.every(item => !item.templateId.startsWith('item:district_')),
    'The new living character receives no predecessor keepsake or quest progress.');
  console.log('city-district-arcs PASS: six actual districts, both permanent branches, native HTTP owner/location/learned-skill authority, hidden-node privacy, unique inert character keepsakes, unchanged currencies, exact replay and preserved Neighborhood action IDs' +
    (postgres ? '; owned-schema PostgreSQL' : '; disposable pg-mem'));
} finally {
  if (app) await app.close();
  if (admin) {
    if (createdSchema) {
      assert(/^city_district_arcs_[a-f0-9]{16}$/.test(namespace));
      const ownership = (await admin.query('SELECT nspowner=current_user::regrole AS mine FROM pg_namespace WHERE nspname=$1', [namespace])).rows[0];
      assert.equal(ownership?.mine, true, 'Drop only this connection\'s generated fixture schema.');
      await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
    }
    await admin.end();
  }
}
