import assert from 'node:assert/strict';
import { makeDb } from '../src/db.js';
import { loadOwned, withCharacter } from '../src/game.js';
import { accrue } from '../src/accrual.js';
import { deedBoard, collectCorner } from '../src/deeds.js';
import { RACKETS, PACING } from '../src/rules.js';

const pool = await makeDb();
try {
  const now = Date.now(), accountId = 'deed-boundary-account', id = 'deed-boundary-life';
  await pool.query('INSERT INTO account_persistent(account_id) VALUES ($1)', [accountId]);
  await pool.query(`INSERT INTO characters(id,account_id,name,season,loc,respect)
    VALUES ($1,$2,'Boundary Betty',1,'neon',$3)`, [id, accountId, PACING.LEVEL_DIVISOR * 23 ** 2]);
  await pool.query(`INSERT INTO street_deeds(account_id,name,name_lc,district,corner_at,home_authority_token)
    VALUES ($1,'Boundary House','boundary house','neon',$2,'boundary-authority')`, [accountId, new Date(now - 86400000)]);
  const character = async () => (await pool.query('SELECT * FROM characters WHERE id=$1', [id])).rows[0];
  const acct = (await pool.query('SELECT * FROM account_persistent WHERE account_id=$1', [accountId])).rows[0];
  const lowOwned = await loadOwned(pool, await character());
  assert.deepEqual(lowOwned.deedPerk, []);
  assert.equal(lowOwned.deedSeat, false);
  const lowBoard = await deedBoard(await character(), pool);
  assert.equal(lowBoard.corner.owed, 0, 'pre-25 ownership cannot bank corner income');
  assert.equal(lowBoard.corner.perkActive, false);
  assert.equal(lowBoard.corner.seatActive, false);
  assert.equal(lowBoard.corner.cornerMinLvl, 25);
  await assert.rejects(withCharacter(pool, accountId, (ch, client, h) => collectCorner(ch, client, h)),
    error => error.code === 'rookie');
  assert.equal((await pool.query('SELECT COUNT(*) n FROM street_deed_benefit_eligibility')).rows[0].n, 0);
  await pool.query('UPDATE characters SET respect=$2 WHERE id=$1', [id, PACING.LEVEL_DIVISOR * 24 ** 2]);
  assert.equal((await deedBoard(await character(), pool)).corner.owed, 0,
    'first eligible read excludes the entire pre-25 ownership interval');
  assert.equal((await pool.query('SELECT COUNT(*) n FROM street_deed_benefit_eligibility')).rows[0].n, 0,
    'read-only boards never initialize benefit clocks');
  await withCharacter(pool, accountId, async () => ({ ok: true }));
  assert.equal((await pool.query('SELECT COUNT(*) n FROM street_deed_benefit_eligibility')).rows[0].n, 1,
    'successful character persistence records the life eligibility clock');
  await pool.query('UPDATE street_deed_benefit_eligibility SET eligible_at=$2 WHERE character_id=$1',
    [id, new Date(now - 7200000)]);
  const actualCharacter = await character();
  for (const scenario of [
    { district: 'neon', offlineMs: 3600000, activeMs: 60000, resource: 'cash' },
    { district: 'cathedral', offlineMs: 30000, activeMs: 15000, resource: 'nerve' },
  ]) {
    const activeFrom = new Date(now - scenario.activeMs);
    await pool.query('UPDATE street_deeds SET district=$2,corner_at=$3 WHERE account_id=$1',
      [accountId, scenario.district, activeFrom]);
    const owned = await loadOwned(pool, actualCharacter);
    assert.equal(+owned.deedActiveFrom, +activeFrom,
      're-import/control transition bounds the passive window after life eligibility');
    const base = { ...actualCharacter, cash: 0, nerve: 0, energy: 0, health: 100,
      last_accrued_at: new Date(now - scenario.offlineMs) };
    const actual = structuredClone(base), full = structuredClone(base);
    const context = { rackets: [RACKETS[0].id], deedHeld: owned.deedPerk };
    accrue(actual, acct, { ...context, deedActiveFrom: owned.deedActiveFrom }, new Date(now));
    accrue(full, acct, context, new Date(now));
    assert(actual[scenario.resource] < full[scenario.resource],
      `${scenario.district} cannot retroactively boost the entire offline interval`);
    const family = structuredClone(base), familyAndDeed = structuredClone(base);
    accrue(family, acct, { rackets: context.rackets, held: [scenario.district] }, new Date(now));
    accrue(familyAndDeed, acct, { ...context, held: [scenario.district], deedActiveFrom: activeFrom }, new Date(now));
    assert.equal(familyAndDeed[scenario.resource], family[scenario.resource], 'family and deed district perks never stack');
  }
  console.log('deed-benefit-boundaries: PASS (level 25, no banked rewards, life and re-import clocks, family parity)');
} finally { await pool.end(); }
