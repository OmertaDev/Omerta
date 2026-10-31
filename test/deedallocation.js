import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import { DEED_ALLOCATION, DEED_BUILDINGS, buildingAtlas, ensureDeedBuildings } from '../src/deedbuildings.js';
import { deedSupply } from '../src/deeds.js';

const districts = ['docks', 'neon', 'foundry', 'brick', 'canal', 'cathedral'];
for (const [kind, expected] of Object.entries(DEED_ALLOCATION))
  assert.equal(DEED_BUILDINGS.filter(lot => lot.issuanceKind === kind).length, expected);
assert.deepEqual(districts.map(district => DEED_BUILDINGS.filter(lot => lot.district === district && lot.issuanceKind === 'gameplay').length),
  [167, 167, 167, 167, 166, 166]);
assert.deepEqual(districts.map(district => DEED_BUILDINGS.filter(lot => lot.district === district && lot.issuanceKind === 'partnership').length),
  [84, 84, 83, 83, 83, 83]);
for (const district of districts) {
  const lots = DEED_BUILDINGS.filter(lot => lot.district === district);
  assert.equal(lots[0].issuanceKind, 'gameplay');
  assert.equal(lots.at(-1).issuanceKind, 'partnership');
  const order = { gameplay: 0, paid: 1, partnership: 2 };
  assert(lots.every((lot, index) => !index || order[lots[index - 1].issuanceKind] <= order[lot.issuanceKind]));
}

const mem = newDb();
mem.public.none(`CREATE TABLE street_deed_supply(id INT PRIMARY KEY,issued INT);
  INSERT INTO street_deed_supply VALUES(1,501);
  CREATE TABLE street_deeds(account_id TEXT PRIMARY KEY,name TEXT UNIQUE,district TEXT,building_id TEXT UNIQUE,
    claimed_at TIMESTAMPTZ DEFAULT now(),onchain_token_id TEXT,home_authority_token TEXT);
  CREATE TABLE street_deed_building_assignments(building_id TEXT PRIMARY KEY,street_name TEXT UNIQUE)`);
const { Pool } = mem.adapters.createPg();
const pool = new Pool();
try {
  const issued = [...DEED_BUILDINGS.filter(lot => lot.issuanceKind === 'partnership'),
    DEED_BUILDINGS.find(lot => lot.id === 'cathedral-0001')];
  for (const lot of issued) {
    await pool.query(`INSERT INTO street_deeds(account_id,name,district,building_id,home_authority_token)
      VALUES($1,$2,$3,$4,$5)`, [lot.id, `Existing ${lot.id}`, lot.district, lot.id, `authority-${lot.id}`]);
    await pool.query('INSERT INTO street_deed_building_assignments VALUES($1,$2)', [lot.id, `Existing ${lot.id}`]);
  }
  const before = (await pool.query('SELECT * FROM street_deeds ORDER BY building_id')).rows;
  assert.equal(await ensureDeedBuildings(pool), 0, 'existing permanent identities need no reassignment');
  assert.deepEqual((await pool.query('SELECT * FROM street_deeds ORDER BY building_id')).rows, before,
    'classification preserves ownership, home authority and identity history');
  const expected = { maximum: 2500, issued: 501, remaining: 1999,
    gameplay: { maximum: 1000, issued: 1, remaining: 999 },
    paid: { maximum: 1000, issued: 0, remaining: 1000 },
    partnership: { maximum: 500, issued: 500, remaining: 0 } };
  assert.deepEqual(await deedSupply(pool), expected);
  const atlas = await buildingAtlas(pool);
  assert.equal(atlas.buildings.filter(lot => lot.claimed).length, 501);
  assert.equal(atlas.buildings.find(lot => lot.id === 'cathedral-0001').issuanceKind, 'gameplay');
  await pool.query("UPDATE street_deeds SET account_id='onchain:public',onchain_token_id='1' WHERE building_id='cathedral-0001'");
  await pool.query("DELETE FROM street_deeds WHERE building_id='docks-0417'");
  assert.deepEqual(await deedSupply(pool), expected, 'extraction and deletion never return allocation slots');
  assert.equal(await ensureDeedBuildings(pool), 0, 'restart preserves the durable assignment ledger');
  console.log('deedallocation: PASS (1,000/1,000/500, existing 501 identities, history and irreversible supply)');
} finally { await pool.end(); }
