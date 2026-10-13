// makeDb calls this only under its existing boot advisory lock, before stamping the schema.
// Compare PostgreSQL's own deparser for two closed known revisions, rather than accepting a
// name-only constraint or normalizing away an unknown custody condition.
const CHECKS = Object.freeze([
  { name: 'item_instance_state',
    acceptsPrevious: true },
  { name: 'item_instance_escrow_owner',
    acceptsPrevious: true },
  { name: 'item_instance_storage_legacy', acceptsPrevious: false, acceptsMissing: true },
]);
function invalid(detail) {
  const error = new Error(`Home custody migration refused: ${detail}`);
  error.code = 'city_home_storage_migration_invalid';
  return error;
}
// Keep every admitted DDL branch literal so the shared SQL scanner can classify it.
async function installKnown(q, name) {
  if (name === 'item_instance_state') {
    await q.query('ALTER TABLE item_instances DROP CONSTRAINT item_instance_state');
    await q.query("ALTER TABLE item_instances ADD CONSTRAINT item_instance_state CHECK (state IN ('active','escrowed','consumed','stored')) NOT VALID");
    await q.query('ALTER TABLE item_instances VALIDATE CONSTRAINT item_instance_state');
  } else if (name === 'item_instance_escrow_owner') {
    await q.query('ALTER TABLE item_instances DROP CONSTRAINT item_instance_escrow_owner');
    await q.query("ALTER TABLE item_instances ADD CONSTRAINT item_instance_escrow_owner CHECK ((state='active' AND owner_scope IN ('character','account')) OR (state='escrowed' AND owner_scope='operation') OR (state='stored' AND owner_scope='account') OR state='consumed') NOT VALID");
    await q.query('ALTER TABLE item_instances VALIDATE CONSTRAINT item_instance_escrow_owner');
  } else if (name === 'item_instance_storage_legacy') {
    await q.query("ALTER TABLE item_instances ADD CONSTRAINT item_instance_storage_legacy CHECK (state<>'stored' OR definition_hash IS NULL) NOT VALID");
    await q.query('ALTER TABLE item_instances VALIDATE CONSTRAINT item_instance_storage_legacy');
  } else throw invalid('unknown installation');
}
export async function migrateCityHomeStorage(q, { compatibility = 'postgres' } = {}) {
  if (compatibility === 'pg-mem') return Object.freeze({ compatibility, verified: false, replaced: 0 });
  if (compatibility !== 'postgres') throw invalid('unknown compatibility mode');
  await q.query('BEGIN');
  try {
    await q.query('LOCK TABLE item_instances IN ACCESS EXCLUSIVE MODE');
    await q.query(`CREATE TEMP TABLE city_home_storage_reference (
      state TEXT, owner_scope TEXT, definition_hash TEXT,
      CONSTRAINT item_instance_state_old CHECK (state IN ('active','escrowed','consumed')),
      CONSTRAINT item_instance_state_current CHECK (state IN ('active','escrowed','consumed','stored')),
      CONSTRAINT item_instance_escrow_owner_old CHECK ((state='active' AND owner_scope IN ('character','account')) OR (state='escrowed' AND owner_scope='operation') OR state='consumed'),
      CONSTRAINT item_instance_escrow_owner_current CHECK ((state='active' AND owner_scope IN ('character','account')) OR (state='escrowed' AND owner_scope='operation') OR (state='stored' AND owner_scope='account') OR state='consumed'),
      CONSTRAINT item_instance_storage_legacy_current CHECK (state<>'stored' OR definition_hash IS NULL)
    ) ON COMMIT DROP`);
    const definitions = (await q.query(`SELECT conname, pg_get_constraintdef(oid,true) AS definition
      FROM pg_constraint WHERE conrelid='pg_temp.city_home_storage_reference'::regclass`)).rows;
    const expected = new Map(definitions.map(row => [row.conname, row.definition]));
    let replaced = 0;
    for (const spec of CHECKS) {
      const rows = (await q.query(`SELECT contype::text,convalidated,pg_get_constraintdef(oid,true) AS definition
        FROM pg_constraint WHERE conrelid='item_instances'::regclass AND conname=$1`, [spec.name])).rows;
      const row = rows[0], target = expected.get(`${spec.name}_current`);
      // The reviewed predecessor has no storage predicate. Only install that absent
      // predicate after both custody predicates above have passed their closed checks.
      // An existing predicate is never dropped or implicitly trusted by schema replay.
      if (!rows.length && spec.acceptsMissing && target) {
        await installKnown(q, spec.name);
        replaced++;
        continue;
      }
      if (rows.length !== 1 || row.contype !== 'c' || row.convalidated !== true || !target) {
        throw invalid(`missing, unvalidated or wrong-type ${spec.name}`);
      }
      if (row.definition === target) continue;
      if (!spec.acceptsPrevious || row.definition !== expected.get(`${spec.name}_old`)) throw invalid(`unknown ${spec.name}`);
      await installKnown(q, spec.name);
      const installed = (await q.query(`SELECT convalidated,pg_get_constraintdef(oid,true) AS definition
        FROM pg_constraint WHERE conrelid='item_instances'::regclass AND conname=$1`, [spec.name])).rows;
      if (installed.length !== 1 || installed[0].convalidated !== true || installed[0].definition !== target) {
        throw invalid(`failed validation ${spec.name}`);
      }
      replaced++;
    }
    await q.query('COMMIT');
    return Object.freeze({ compatibility, verified: true, replaced });
  } catch (error) {
    await q.query('ROLLBACK').catch(() => {});
    throw error;
  }
}
