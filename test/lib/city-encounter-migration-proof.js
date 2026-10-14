import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { migrateCityEncounterCatalogue } from '../../src/city-encounter-migration.js';

// These independent literal expectations deliberately do not import the runtime
// scenario list: changing an admission predicate must change its native proof.
const original = ['docks-patrol','neon-patrol','foundry-patrol','brick-patrol','canal-patrol','cathedral-patrol'];
const mastery = ['docks-mastery-v1','neon-mastery-v1','foundry-mastery-v1','brick-mastery-v1','canal-mastery-v1','cathedral-mastery-v1'];
const predicate = ids => `CHECK (scenario_id IN (${ids.map(id => "'" + id + "'").join(',')}))`;
const gate = 'city_encounters_scenario_id_check';
const migrationError = error => error.code === 'city_encounter_catalogue_migration_invalid';

export async function proveEncounterCatalogueMigration({ pool, fixtureSchema }) {
  assert.match(fixtureSchema, /^city_encounters_[a-f0-9]{16}$/, 'The caller must own its explicit native fixture.');
  const client = await pool.connect();
  const namespace = 'city_encounter_migration_' + crypto.randomBytes(8).toString('hex');
  let ownsSchema = false, previousPath;
  try {
    const source = (await client.query('SELECT current_schema() AS schema,version() AS version')).rows[0];
    assert.equal(source.schema, fixtureSchema); assert.match(source.version, /^PostgreSQL /, 'No pg-mem migration qualification.');
    previousPath = (await client.query('SHOW search_path')).rows[0].search_path;
    await client.query('CREATE SCHEMA ' + namespace); ownsSchema = true;
    const ownership = (await client.query(`SELECT nspname,pg_get_userbyid(nspowner)=current_user AS owned
      FROM pg_namespace WHERE nspname=$1`, [namespace])).rows;
    assert.deepEqual(ownership, [{ nspname: namespace, owned: true }]);
    await client.query("SELECT set_config('search_path',$1,false)", [namespace]);
    assert.equal((await client.query('SELECT current_schema() AS schema')).rows[0].schema, namespace);
    await client.query(`CREATE TABLE city_encounters (id TEXT PRIMARY KEY,scenario_id TEXT NOT NULL,witness TEXT NOT NULL,
      CONSTRAINT ${gate} ${predicate(original)})`);
    for (const id of original) await client.query('INSERT INTO city_encounters VALUES ($1,$1,$2)', [id, 'original:' + id]);
    const rows = async () => (await client.query('SELECT id,scenario_id,witness FROM city_encounters ORDER BY id')).rows;
    const definition = async () => (await client.query(`SELECT contype::text AS type,convalidated AS validated,
      pg_get_constraintdef(oid,true) AS definition FROM pg_constraint
      WHERE conrelid='city_encounters'::regclass AND conname=$1`, [gate])).rows;
    const refused = async id => assert.rejects(client.query('INSERT INTO city_encounters VALUES ($1,$2,$3)',
      ['refused:' + id, id, 'must not persist']), error => error.code === '23514');
    const originalRows = await rows(), oldDefinition = await definition();
    assert.equal(oldDefinition.length, 1); assert.equal(oldDefinition[0].validated, true);
    for (const id of mastery) await refused(id);
    assert.deepEqual(await migrateCityEncounterCatalogue(client), { compatibility: 'postgres', verified: true, replaced: 1 });
    const currentDefinition = await definition();
    assert.equal(currentDefinition.length, 1); assert.equal(currentDefinition[0].validated, true);
    assert.notDeepEqual(currentDefinition, oldDefinition, 'The native installed predicate actually changed.');
    assert.deepEqual(await rows(), originalRows, 'All six existing scenario rows survive migration unchanged.');
    for (const id of mastery) await client.query('INSERT INTO city_encounters VALUES ($1,$1,$2)', [id, 'mastery:' + id]);
    const admittedRows = await rows(); assert.equal(admittedRows.length, 12);
    await refused('docks-mastery-v2'); await refused('invented-patrol');
    assert.deepEqual(await migrateCityEncounterCatalogue(client), { compatibility: 'postgres', verified: true, replaced: 0 });
    assert.deepEqual(await definition(), currentDefinition); assert.deepEqual(await rows(), admittedRows);

    const replace = async (check, validated = true) => {
      await client.query('DELETE FROM city_encounters WHERE scenario_id=ANY($1::text[])', [mastery]);
      await client.query('ALTER TABLE city_encounters DROP CONSTRAINT IF EXISTS ' + gate);
      if (check) await client.query('ALTER TABLE city_encounters ADD CONSTRAINT ' + gate + ' ' + check + (validated ? '' : ' NOT VALID'));
    };
    const rejectUnchanged = async message => {
      const before = await definition(), data = await rows();
      await assert.rejects(migrateCityEncounterCatalogue(client), migrationError, message);
      assert.deepEqual(await definition(), before, message + ': predicate is not repaired or replaced.');
      assert.deepEqual(await rows(), data, message + ': existing rows remain untouched.');
    };
    await replace(null); await rejectUnchanged('Missing named predicate fails closed');
    for (const check of [predicate(original), predicate([...original, ...mastery])]) {
      await replace(check, false); await rejectUnchanged('An unvalidated known predicate fails closed');
      assert.equal((await definition())[0].validated, false);
    }
    for (const check of ['CHECK (true)', predicate([...original, ...mastery, 'unreviewed-scenario'])]) {
      await replace(check); await rejectUnchanged('An unknown validated predicate fails closed');
    }

    await replace(predicate(original));
    let observedValidatedChange = false;
    const interruption = new Error('Controlled interruption after the real encounter catalogue DDL');
    const fault = { query: async (...args) => {
      const result = await client.query(...args);
      if (args[0] === 'ALTER TABLE city_encounters VALIDATE CONSTRAINT ' + gate) {
        assert.deepEqual(await definition(), currentDefinition, 'The replacement is real and validated inside the open transaction.');
        assert.deepEqual(await rows(), originalRows);
        observedValidatedChange = true; throw interruption;
      }
      return result;
    } };
    await assert.rejects(migrateCityEncounterCatalogue(fault), error => error === interruption);
    assert(observedValidatedChange, 'The injected failure occurred after actual DDL, not before mutation.');
    assert.deepEqual(await definition(), oldDefinition, 'Rollback restores the exact old validated admission predicate.');
    assert.deepEqual(await rows(), originalRows, 'Late DDL rollback preserves all original rows.');
    for (const id of mastery) await refused(id);
    assert.deepEqual(await migrateCityEncounterCatalogue(client), { compatibility: 'postgres', verified: true, replaced: 1 });
    assert.deepEqual(await definition(), currentDefinition);
    for (const id of mastery) await client.query('INSERT INTO city_encounters VALUES ($1,$1,$2)', [id, 'mastery:' + id]);
    assert.deepEqual(await rows(), admittedRows, 'Retry admits exactly the reviewed additions and preserves old rows.');
    assert.deepEqual(await migrateCityEncounterCatalogue(client), { compatibility: 'postgres', verified: true, replaced: 0 });
    await refused('docks-mastery-v2');
    console.log('Encounter catalogue native migration: old→new, twelve real admissions, restart, missing/unvalidated/unknown refusal, observed post-DDL rollback and retry passed');
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    try {
      if (previousPath !== undefined) await client.query("SELECT set_config('search_path',$1,false)", [previousPath]);
      if (ownsSchema) await client.query('DROP SCHEMA ' + namespace + ' CASCADE');
    } finally { client.release(); }
  }
}
