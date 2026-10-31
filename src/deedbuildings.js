// Permanent property atlas. These are distinct residential/commercial lots, separate from the
// shared 960x640 neighborhood scene and its public service venues. Never derive identity from
// owner, living character, street renown or the current city population.
export const DEED_BUILDING_TOTAL = 2500;
export const DEED_ALLOCATION = Object.freeze({ gameplay: 1000, paid: 1000, partnership: 500 });
const GAMEPLAY_LOTS = [167, 167, 167, 167, 166, 166];
const PARTNERSHIP_LOTS = [84, 84, 83, 83, 83, 83];
const TILE = 400, COLUMNS = 21, PITCH = 16;
const DISTRICT_LOTS = Object.freeze([
  { id: 'docks', name: 'The Docks', count: 417, column: 0, row: 0, kinds: ['row_house', 'warehouse', 'apartment_building'] },
  { id: 'neon', name: 'Neon Mile', count: 417, column: 1, row: 0, kinds: ['apartment_building', 'shop_house', 'row_house'] },
  { id: 'foundry', name: 'The Foundry', count: 417, column: 2, row: 0, kinds: ['row_house', 'workshop', 'apartment_building'] },
  { id: 'brick', name: 'Brick Yards', count: 417, column: 0, row: 1, kinds: ['row_house', 'apartment_building', 'shop_house'] },
  { id: 'canal', name: 'Canal Row', count: 416, column: 1, row: 1, kinds: ['row_house', 'shop_house', 'warehouse'] },
  { id: 'cathedral', name: 'Cathedral Hill', count: 416, column: 2, row: 1, kinds: ['row_house', 'apartment_building', 'shop_house'] },
]);

export const DEED_BUILDINGS = Object.freeze(DISTRICT_LOTS.flatMap((district, districtIndex) =>
  Array.from({ length: district.count }, (_, index) => Object.freeze({
    id: `${district.id}-${String(index + 1).padStart(4, '0')}`,
    district: district.id, number: index + 1, kind: district.kinds[index % district.kinds.length],
    issuanceKind: index < GAMEPLAY_LOTS[districtIndex] ? 'gameplay'
      : index >= district.count - PARTNERSHIP_LOTS[districtIndex] ? 'partnership' : 'paid',
    x: district.column * TILE + 32 + (index % COLUMNS) * PITCH,
    y: district.row * TILE + 48 + Math.floor(index / COLUMNS) * PITCH,
    width: 10, height: 9,
  }))));
const BY_ID = new Map(DEED_BUILDINGS.map((building) => [building.id, building]));

export function deedBuildingById(id) {
  const building = BY_ID.get(String(id || ''));
  return building ? { ...building } : null;
}

export function buildingForDeed(row) {
  const building = row?.building_id ? BY_ID.get(row.building_id) : null;
  return building && (!row.district || building.district === row.district) ? { ...building } : null;
}

function assignExisting(rows, ledger) {
  const used = new Set(), byName = new Map();
  for (const assignment of ledger) {
    if (!BY_ID.has(assignment.building_id) || used.has(assignment.building_id) || byName.has(assignment.street_name))
      throw new Error('Invalid permanent deed building assignment');
    used.add(assignment.building_id);
    byName.set(assignment.street_name, assignment.building_id);
  }
  for (const row of rows) {
    if (row.building_id == null) continue;
    if (!buildingForDeed(row) || (used.has(row.building_id) && byName.get(row.name) !== row.building_id))
      throw new Error('Invalid or duplicate permanent deed building');
    used.add(row.building_id);
  }
  const assignments = [];
  for (const row of rows) {
    const recordedId = byName.get(row.name);
    if (recordedId && row.building_id != null && recordedId !== row.building_id)
      throw new Error('A street cannot change its permanent building');
    const building = recordedId ? BY_ID.get(recordedId) : row.building_id ? BY_ID.get(row.building_id)
      : DEED_BUILDINGS.find((lot) => lot.district === row.district && !used.has(lot.id));
    if (!building) throw new Error(`No unassigned deed buildings remain in ${row.district}`);
    if (building.district !== row.district) throw new Error('A street cannot change its permanent building district');
    used.add(building.id);
    if (!recordedId || row.building_id == null)
      assignments.push({ name: row.name, id: building.id, record: !recordedId, update: row.building_id == null });
  }
  return { assignments, used };
}

// Call at boot after schema migration. The caller owns a transaction; the same issuance singleton
// serializes legacy backfill and new claims. Name is immutable and survives account-row rekeying.
export async function ensureDeedBuildings(client) {
  await client.query('SELECT issued FROM street_deed_supply WHERE id=1 FOR UPDATE');
  const rows = (await client.query(
    'SELECT name, district, building_id FROM street_deeds ORDER BY claimed_at, name')).rows;
  const ledger = (await client.query('SELECT building_id, street_name FROM street_deed_building_assignments')).rows;
  const { assignments } = assignExisting(rows, ledger);
  for (const assignment of assignments) {
    if (assignment.record) await client.query(
      'INSERT INTO street_deed_building_assignments (building_id,street_name) VALUES ($1,$2)', [assignment.id, assignment.name]);
    if (assignment.update) await client.query(
      'UPDATE street_deeds SET building_id=$2 WHERE name=$1 AND building_id IS NULL', [assignment.name, assignment.id]);
  }
  return assignments.length;
}

// Called only while the claim transaction holds the lifetime issuance lock.
export async function nextDeedBuilding(client, district) {
  await ensureDeedBuildings(client);
  const used = new Set((await client.query('SELECT building_id FROM street_deed_building_assignments')).rows
    .map((row) => row.building_id));
  const building = DEED_BUILDINGS.find((lot) => lot.district === district && !used.has(lot.id));
  return building ? { ...building } : null;
}

export async function reserveDeedBuilding(client, district, name, buildingId = null) {
  let building;
  if (buildingId != null) {
    await ensureDeedBuildings(client);
    building = deedBuildingById(buildingId);
    if (!building || building.district !== district) return null;
    if ((await client.query('SELECT 1 FROM street_deed_building_assignments WHERE building_id=$1', [building.id])).rowCount)
      return null;
  } else building = await nextDeedBuilding(client, district);
  if (building) await client.query(
    'INSERT INTO street_deed_building_assignments (building_id,street_name) VALUES ($1,$2)', [building.id, name]);
  return building;
}

export async function buildingAtlas(client, { district } = {}) {
  if (district != null && !DISTRICT_LOTS.some((item) => item.id === district))
    throw new Error('Unknown property-atlas district');
  const rows = (await client.query('SELECT name, district, building_id, onchain_token_id FROM street_deeds')).rows;
  const claimed = new Map(rows.filter((row) => buildingForDeed(row)).map((row) => [row.building_id, row]));
  const ledger = new Map((await client.query('SELECT building_id, street_name FROM street_deed_building_assignments')).rows
    .map((row) => [row.building_id, row.street_name]));
  const districts = DISTRICT_LOTS.filter((item) => !district || item.id === district);
  return {
    width: TILE * 3, height: TILE * 2, total: DEED_BUILDING_TOTAL,
    districts: districts.map((item) => ({ id: item.id, name: item.name, capacity: item.count,
      x: item.column * TILE, y: item.row * TILE, width: TILE, height: TILE })),
    buildings: DEED_BUILDINGS.filter((building) => !district || building.district === district).map((building) => {
      const deed = claimed.get(building.id);
      return { ...building, claimed: ledger.has(building.id), street: deed?.name || ledger.get(building.id) || null,
        tokenId: deed?.onchain_token_id || null };
    }),
  };
}
