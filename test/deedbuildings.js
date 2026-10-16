import assert from 'node:assert/strict';
import { newDb } from 'pg-mem';
import { DEED_BUILDINGS, buildingAtlas, buildingForDeed, ensureDeedBuildings,
  nextDeedBuilding, reserveDeedBuilding } from '../src/deedbuildings.js';

assert.equal(DEED_BUILDINGS.length, 2500);
assert.equal(new Set(DEED_BUILDINGS.map((building) => building.id)).size, 2500);
assert.equal(new Set(DEED_BUILDINGS.map((building) => `${building.x},${building.y}`)).size, 2500,
  'every deed has a distinct physical footprint on the property atlas');
assert(DEED_BUILDINGS.every((building) => building.width > 0 && building.height > 0
  && building.x + building.width <= 1200 && building.y + building.height <= 800));
const mem = newDb();
mem.public.none(`
  CREATE TABLE street_deed_supply (id INT PRIMARY KEY,issued INT);
  INSERT INTO street_deed_supply VALUES (1,3);
  CREATE TABLE street_deeds (account_id TEXT PRIMARY KEY, name TEXT UNIQUE, district TEXT,
    building_id TEXT UNIQUE, claimed_at TIMESTAMPTZ, onchain_token_id TEXT);
  CREATE TABLE street_deed_building_assignments (building_id TEXT PRIMARY KEY,street_name TEXT UNIQUE);
  INSERT INTO street_deeds VALUES
    ('first','Alpha','cathedral',NULL,'2026-01-01',NULL),
    ('second','Beta','cathedral',NULL,'2026-01-01',NULL),
    ('third','Dock Road','docks',NULL,'2026-01-02','123');
`);
const { Pool } = mem.adapters.createPg();
const pool = new Pool();
try {
  assert.equal(await ensureDeedBuildings(pool), 3, 'legacy streets receive durable building identities');
  assert.equal(await ensureDeedBuildings(pool), 0, 'boot replay does not reshuffle buildings');
  let row = (await pool.query("SELECT * FROM street_deeds WHERE name='Alpha'")).rows[0];
  assert.equal(buildingForDeed(row).id, 'cathedral-0001', 'same-date legacy order is deterministic by immutable name');
  const building = buildingForDeed(row);
  await pool.query("UPDATE street_deeds SET account_id='onchain:999',onchain_token_id='999' WHERE name='Alpha'");
  row = (await pool.query("SELECT * FROM street_deeds WHERE name='Alpha'")).rows[0];
  assert.deepEqual(buildingForDeed(row), building, 'extraction and secondary ownership cannot change the building');
  const atlas = await buildingAtlas(pool, { district: 'cathedral' });
  assert.equal(atlas.buildings.length, 416);
  assert.equal(atlas.buildings.find((item) => item.id === building.id).tokenId, '999');
  assert.equal(atlas.buildings.find((item) => item.id === building.id).street, 'Alpha');
  await pool.query("DELETE FROM street_deeds WHERE name='Beta'");
  assert.equal((await nextDeedBuilding(pool, 'cathedral')).id, 'cathedral-0003', 'deleted rows never release an assigned property');
  assert.equal((await buildingAtlas(pool)).buildings.find((item) => item.id === 'cathedral-0002').claimed, true);
  assert.equal((await reserveDeedBuilding(pool, 'cathedral', 'Gamma')).id, 'cathedral-0003');
  assert.equal((await reserveDeedBuilding(pool, 'brick', 'Discovered House', 'brick-0011')).id, 'brick-0011',
    'a discovered property reserves its exact footprint rather than the first free district lot');
  assert.equal((await nextDeedBuilding(pool, 'brick')).id, 'brick-0001', 'other available properties remain unreserved');
  assert.equal(await reserveDeedBuilding(pool, 'brick', 'Duplicate House', 'brick-0011'), null,
    'an assigned physical building cannot be issued under another street name');
  assert.equal(await reserveDeedBuilding(pool, 'neon', 'Wrong District', 'brick-0012'), null,
    'an explicit building cannot be moved to another district');
  const remainingNeon = DEED_BUILDINGS.filter((item) => item.district === 'neon');
  for (const lot of remainingNeon) await pool.query(
    'INSERT INTO street_deed_building_assignments VALUES ($1,$2)', [lot.id, `Neon ${lot.number}`]);
  assert.equal(await nextDeedBuilding(pool, 'neon'), null, 'a full district cannot issue overlapping properties');
  assert(await nextDeedBuilding(pool, 'brick'), 'other districts retain their unassigned buildings');
  await pool.query("UPDATE street_deeds SET district='neon' WHERE name='Alpha'");
  await assert.rejects(ensureDeedBuildings(pool), /Invalid or duplicate permanent deed building/,
    'migration refuses to silently move an established building into another district');
  console.log('Deed buildings: 2,500 unique footprints, stable backfill, ownership, deleted-row reservation and district capacity passed.');
} finally { await pool.end(); }
