// Server-authoritative primary issuance; no browser flag or atlas click awards property.
import assert from 'node:assert/strict';
import { buildServer } from './server-fixture.js';
import { withCharacter } from '../src/game.js';
import { claimDeed } from '../src/deeds.js';
import { DEED_BUILDINGS } from '../src/deedbuildings.js';
import { DEED_DISCOVERY, discoveryBoard, investigateDeed, deedInvestigationRoute } from '../src/deeddiscovery.js';
import { PACING } from '../src/rules.js';

const app = await buildServer();
const pool = app.pool;
const respect = (DEED_DISCOVERY.minimumLevel - 1) ** 2 * PACING.LEVEL_DIVISOR;
async function player(name) {
  const auth = await app.inject({ method: 'POST', url: '/v1/auth/guest' });
  const token = auth.json().token;
  await app.inject({ method: 'POST', url: '/v1/character',
    headers: { authorization: `Bearer ${token}` }, payload: { name } });
  const row = (await pool.query('SELECT * FROM characters WHERE name=$1 AND alive', [name])).rows[0];
  return { ...row, token };
}
const act = (actor, fn) => withCharacter(pool, actor.account_id, fn);
const investigate = (actor, buildingId, extra = {}) => act(actor,
  (ch, client, h) => investigateDeed(ch, { buildingId, actionId: 'inspect-site', ...extra }, client, h));
const claim = (actor, buildingId, name) => act(actor,
  (ch, client, h) => claimDeed(ch, { buildingId, name }, client, h));
const read = async actor => discoveryBoard(pool,
  (await pool.query('SELECT * FROM characters WHERE account_id=$1 AND alive', [actor.account_id])).rows[0]);
const travel = async (actor, district) => {
  const response = await app.inject({ method: 'POST', url: `/v1/travel/${district}`,
    headers: { authorization: `Bearer ${actor.token}` } });
  assert.equal(response.statusCode, 200, response.body);
};
try {
  const a = await player('Deed Explorer'), b = await player('Deed Rival');
  const building = DEED_BUILDINGS.find(lot => lot.district === 'docks');
  const other = DEED_BUILDINGS.find(lot => lot.district === 'neon');
  assert.equal(DEED_BUILDINGS.length, 2500);
  for (const property of DEED_BUILDINGS) {
    const route = deedInvestigationRoute(property);
    assert.equal(route.length, 4);
    assert.equal(new Set(route.map(step => step.actionId)).size, 4);
    assert.equal(new Set(route.map(step => step.requiredDistrict)).size, 3);
    assert.equal(route.at(-1).requiredDistrict, property.district);
  }
  const fresh = await read(a);
  await assert.rejects(discoveryBoard(pool, a, { district: 'nowhere' }), error => error.code === 'district');
  assert.equal(fresh.reason, 'level');
  assert.equal(fresh.primaryClaimed, false);
  assert(fresh.buildings.every(lot => !lot.canClaim && !lot.canInvestigate));
  assert.equal((await pool.query('SELECT COUNT(*) n FROM street_deed_discoveries')).rows[0].n, 0,
    'read-only discovery board creates no progress');
  await assert.rejects(investigate(a, building.id), error => error.code === 'level');
  await pool.query('UPDATE characters SET respect=$2,loc=$3,energy=100,cash=100000 WHERE account_id=$1',
    [a.account_id, respect, 'docks']);
  await pool.query('UPDATE characters SET respect=$2,loc=$3,energy=100 WHERE account_id=$1',
    [b.account_id, respect, 'docks']);
  await assert.rejects(claim(a, building.id, 'Unearned House'), error => error.code === 'deed_not_discovered');
  await assert.rejects(act(a, (ch, client, h) => claimDeed(ch,
    { name: 'Old Free Claim', district: 'docks', discovered: true, questComplete: true }, client, h)),
  error => error.code === 'building', 'legacy name-and-district body cannot bypass discovery');
  await assert.rejects(investigate(a, 'docks-9999'), error => error.code === 'building');
  await assert.rejects(investigate(a, other.id), error => error.code === 'location');
  await pool.query('UPDATE characters SET energy=4 WHERE account_id=$1', [a.account_id]);
  await assert.rejects(investigate(a, building.id), error => error.code === 'energy');
  await pool.query('UPDATE characters SET energy=100 WHERE account_id=$1', [a.account_id]);
  for (const [column, code] of [['jail_until', 'jailed'], ['hosp_until', 'hosp_self'], ['safe_until', 'safe'], ['witpro_until', 'witpro']]) {
    await pool.query(`UPDATE characters SET ${column}=$2 WHERE account_id=$1`,
      [a.account_id, new Date(Date.now() + 60_000)]);
    await assert.rejects(investigate(a, building.id), error => error.code === code);
    await pool.query(`UPDATE characters SET ${column}=NULL WHERE account_id=$1`, [a.account_id]);
  }
  await assert.rejects(investigate(a, building.id, { actionId: undefined }), error => error.code === 'deed_action',
    'the old blank investigate body no longer advances property progress');
  await assert.rejects(investigate(a, building.id, { actionId: 'secure-title' }), error => error.code === 'deed_action');
  const first = await investigate(a, building.id, { steps: 4, qualified: true, questComplete: true });
  assert.equal(first.steps, 1, 'client completion flags cannot advance more than one server step');
  assert.equal(first.qualified, false);
  assert.equal(first.energySpent, 5);
  assert.equal((await pool.query('SELECT COUNT(*) n FROM street_deed_building_assignments')).rows[0].n, 0,
    'investigation does not reserve the global building');
  await assert.rejects(investigate(a, building.id), error => error.code === 'deed_action',
    'repeating the first click cannot advance the next objective');
  await assert.rejects(investigate(a, building.id, { actionId: 'verify-registry' }), error => error.code === 'location',
    'a correct action in the wrong district cannot produce registry evidence');
  await assert.rejects(claim(a, building.id, 'Early House'), error => error.code === 'deed_not_discovered');
  const route = deedInvestigationRoute(building);
  for (let index = 1; index < route.length; index++) {
    await travel(a, route[index].requiredDistrict);
    const outsideBoard = await read(a);
    assert.equal(outsideBoard.activeInvestigations.find(row => row.id === building.id).objective.actionId, route[index].actionId,
      'the active property case follows the player to its next district');
    const result = await investigate(a, building.id, { actionId: route[index].actionId });
    assert.equal(result.steps, index + 1);
    assert.equal(result.qualified, index === route.length - 1);
  }
  const proof = (await pool.query('SELECT * FROM street_deed_discoveries WHERE account_id=$1', [a.account_id])).rows[0];
  assert.equal(proof.policy_version, 2);
  const evidence = JSON.parse(proof.objective_evidence);
  assert.deepEqual(evidence.map(entry => entry.actionId), route.map(step => step.actionId));
  assert(evidence.every(entry => entry.buildingId === building.id && entry.characterId === a.id));
  await pool.query(`INSERT INTO street_deed_discoveries (account_id,building_id,steps,qualified_at)
    VALUES ($1,$2,3,now())`, [b.account_id, building.id]);
  let legacy = (await read(b)).buildings.find(row => row.id === building.id);
  assert.equal(legacy.steps, 0);
  assert.equal(legacy.legacyReset, true);
  assert.equal(legacy.qualified, false, 'an unclaimed old three-click completion grants no current title');
  await assert.rejects(claim(b, building.id, 'Old Proof House'), error => error.code === 'deed_not_discovered');
  const restarted = await investigate(b, building.id);
  assert.equal(restarted.legacyReset, true);
  assert.equal(restarted.steps, 1);
  assert.equal(JSON.parse((await pool.query('SELECT objective_evidence FROM street_deed_discoveries WHERE account_id=$1',
    [b.account_id])).rows[0].objective_evidence).length, 1);
  await pool.query(`UPDATE street_deed_discoveries SET steps=4,qualified_at=now(),objective_evidence='[]'
    WHERE account_id=$1`, [b.account_id]);
  legacy = (await read(b)).buildings.find(row => row.id === building.id);
  assert.equal(legacy.qualified, false, 'a completion counter without evidence is fail-closed');
  await assert.rejects(claim(b, building.id, 'Empty Proof House'), error => error.code === 'deed_not_discovered');
  const ready = await read(a);
  assert.equal(ready.buildings.find(lot => lot.id === building.id).canClaim, true);
  assert.equal(ready.buildings.find(lot => lot.id === building.id).canInvestigate, false);
  await assert.rejects(claim(a, DEED_BUILDINGS[1].id, 'Wrong House'), error => error.code === 'deed_not_discovered',
    'completion is bound to the investigated building');
  await assert.rejects(investigate(a, building.id), error => error.code === 'deed_discovered');
  const won = await claim(a, building.id, 'Discovered House');
  assert.equal(won.building.id, building.id);
  assert.equal((await pool.query('SELECT issued FROM street_deed_supply')).rows[0].issued, 1);
  const receipt = (await pool.query('SELECT * FROM street_deed_primary_claims WHERE account_id=$1', [a.account_id])).rows[0];
  assert.equal(receipt.building_id, building.id);
  assert.equal(receipt.source, 'exploration');
  assert.equal((await read(a)).primaryClaimed, true);
  await assert.rejects(investigate(b, building.id), error => error.code === 'deed_building_claimed');
  await pool.query('DELETE FROM street_deeds WHERE account_id=$1', [a.account_id]);
  await assert.rejects(claim(a, DEED_BUILDINGS[1].id, 'Another House'), error => error.code === 'deed_primary_claimed',
    'selling, extracting or removing a deed never refreshes primary eligibility');
  await assert.rejects(investigate(a, DEED_BUILDINGS[1].id), error => error.code === 'deed_primary_claimed');
  assert.equal((await pool.query('SELECT issued FROM street_deed_supply')).rows[0].issued, 1);
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [a.id]);
  await assert.rejects(investigateDeed({ ...a, alive: false }, { buildingId: DEED_BUILDINGS[1].id }, pool),
    error => error.code === 'no_character');
  await pool.query('UPDATE characters SET is_npc=true WHERE id=$1', [b.id]);
  await assert.rejects(investigateDeed({ ...b, alive: true }, { buildingId: DEED_BUILDINGS[1].id }, pool),
    error => error.code === 'no_character');
  console.log('deeddiscovery: PASS (four distinct objectives, real district travel, action and evidence binding, legacy progress reset, actor gates, lifetime issuance)');
} finally { await app.close(); }
