import assert from 'node:assert/strict';
import { buildServer } from './server-fixture.js';

const app = await buildServer();
const call = async (method, url, token, payload) => {
  const response = await app.inject({ method, url, payload,
    headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { status: response.statusCode, body: response.json() };
};
async function player(name) {
  const auth = await call('POST', '/v1/auth/guest');
  assert.equal(auth.status, 200);
  const token = auth.body.token;
  const created = await call('POST', '/v1/character', token, { name });
  assert.equal(created.status, 200);
  const me = await call('GET', '/v1/me', token);
  const characterId = me.body.character.id;
  await app.pool.query("UPDATE characters SET respect=1000000,loc='cathedral',energy=100,cash=100000 WHERE id=$1", [characterId]);
  const accountId = (await app.pool.query('SELECT account_id FROM characters WHERE id=$1', [characterId])).rows[0].account_id;
  return { token, characterId, accountId };
}
try {
  assert.equal((await call('GET', '/v1/deeds/discovery')).status, 401);
  assert.equal((await call('POST', '/v1/deeds/investigate', null, { buildingId: 'cathedral-0001' })).status, 401);
  const a = await player('Deed Finder'), b = await player('Deed Rival');
  const target = 'cathedral-0001';
  let board = await call('GET', '/v1/deeds/discovery', a.token);
  assert.equal(board.status, 200);
  assert.equal(board.body.config.primaryClaimsPerAccount, 1);
  assert.equal(board.body.currentDistrict, 'cathedral');
  assert.equal(board.body.buildings.length, 416, 'the normal discovery board is district-bounded');
  assert.equal(board.body.primaryClaimed, false);
  assert(board.body.buildings.some(building => building.id === target && building.canInvestigate));
  assert.equal((await call('GET', '/v1/deeds/discovery?district=invalid', a.token)).status, 400);
  let result = await call('POST', '/v1/deeds/claim', a.token, { name: 'Free House', district: 'cathedral' });
  assert.equal(result.status, 400, 'old unrestricted claim bodies cannot issue a new property');
  result = await call('POST', '/v1/deeds/investigate', a.token, { buildingId: 'neon-0001', actionId: 'inspect-site' });
  assert.equal(result.body.error, 'location');
  result = await call('POST', '/v1/deeds/investigate', a.token,
    { buildingId: target, actionId: 'inspect-site', steps: 4, qualified: true, questCompleted: true });
  assert.equal(result.status, 200);
  assert.equal(result.body.steps, 1, 'client completion flags cannot grant eligibility');
  assert.equal(result.body.qualified, false);
  assert.equal(result.body.energySpent, 5);
  result = await call('POST', '/v1/deeds/investigate', a.token, { buildingId: target });
  assert.equal(result.body.error, 'deed_action', 'blank legacy investigate requests do not advance objectives');
  result = await call('POST', '/v1/deeds/investigate', a.token, { buildingId: target, actionId: 'inspect-site' });
  assert.equal(result.body.error, 'deed_action', 'replaying a finished objective cannot advance the next');
  result = await call('POST', '/v1/deeds/investigate', a.token, { buildingId: target, actionId: 'secure-title' });
  assert.equal(result.body.error, 'deed_action', 'future objective cannot skip prerequisite evidence');
  result = await call('POST', '/v1/deeds/investigate', a.token, { buildingId: target, actionId: 'verify-registry' });
  assert.equal(result.body.error, 'location', 'registry evidence requires its actual district');
  for (let step = 2; step <= 4; ++step) {
    board = await call('GET', '/v1/deeds/discovery?district=cathedral', a.token);
    const objective = board.body.buildings.find(building => building.id === target).objective;
    assert.equal((await call('POST', `/v1/travel/${objective.requiredDistrict}`, a.token)).status, 200);
    result = await call('POST', '/v1/deeds/investigate', a.token,
      { buildingId: target, actionId: objective.actionId });
    assert.equal(result.status, 200);
    assert.equal(result.body.steps, step);
  }
  assert(result.body.qualified);
  result = await call('POST', '/v1/deeds/claim', b.token,
    { name: 'Stolen Entitlement', buildingId: target, accountId: a.accountId, qualified: true });
  assert.equal(result.body.error, 'deed_not_discovered', 'a rival cannot reuse another account discovery');
  board = await call('GET', '/v1/deeds', a.token);
  assert.equal(board.body.canClaim, true);
  result = await call('POST', '/v1/deeds/claim', a.token, { name: 'Earned House', buildingId: target });
  assert.equal(result.status, 200);
  assert.equal(result.body.building.id, target);
  assert.equal(result.body.district, 'cathedral');
  board = await call('GET', '/v1/deeds/discovery', a.token);
  assert.equal(board.body.primaryClaimed, true);
  assert(board.body.buildings.every(building => !building.canClaim && !building.canInvestigate));
  await app.pool.query("UPDATE street_deeds SET account_id='onchain:api-proof' WHERE account_id=$1", [a.accountId]);
  result = await call('POST', '/v1/deeds/investigate', a.token, { buildingId: 'cathedral-0002' });
  assert.equal(result.body.error, 'deed_primary_claimed', 'extraction cannot reset primary eligibility');
  const foreign = await call('GET', '/v1/deeds/discovery?district=neon', b.token);
  assert.equal(foreign.status, 200);
  assert(foreign.body.buildings.every(building => !building.canClaim && !building.canInvestigate),
    'browsing another district does not authorize remote actions');
  assert.equal((await app.pool.query('SELECT COUNT(*)::int n FROM street_deed_primary_claims')).rows[0].n, 1);
  console.log('deeddiscovery-api: PASS (authenticated playable discovery/claim, exact buildings, forged flags, cross-account and lifetime gates)');
} finally { await app.close(); }
