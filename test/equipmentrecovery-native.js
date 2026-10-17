import assert from 'node:assert/strict';
import crypto from 'node:crypto';

export async function equipmentRecoveryNativeBackend() {
  assert.deepEqual(process.argv.slice(2), ['--postgres'], 'Explicit native invocation only');
  assert(!process.env.DATABASE_URL, 'Reject an ambient database endpoint');
  assert(!process.env.NODE_OPTIONS && !process.env.NODE_PATH, 'Reject preloads and module overrides');
  assert(!Object.keys(process.env).some(key => /^PG[A-Z_]/.test(key) && process.env[key]), 'Reject ambient PostgreSQL overrides');
  const url = new URL(process.env.EQUIPMENT_RECOVERY_NATIVE_TEST_DATABASE_URL);
  assert(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.hostname, '127.0.0.1');
  assert(!url.search && !url.hash);
  assert.match(url.pathname, /^\/equipment_recovery_native_test_[a-f0-9]{12}$/);
  const local = ['35439', '35449'].includes(url.port) && url.username === 'pilot_runner' && !url.password;
  const ci = url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck';
  assert(local || ci, 'Only the exact owned local or CI backend is permitted');
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: url.href });
  let version;
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const row = (await client.query(`SELECT current_user AS role,current_database() AS database,
      pg_get_userbyid(datdba) AS owner,current_setting('server_version') AS version
      FROM pg_database WHERE datname=current_database()`)).rows[0];
    assert.equal(row.role, url.username);
    assert.equal(row.owner, url.username);
    assert.equal(row.database, url.pathname.slice(1));
    assert.match(row.version, local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
    version = row.version;
    if (local) {
      const datadir = (await client.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\', '/').toLowerCase();
      assert.equal(datadir, url.port === '35439'
        ? 'c:/users/jorge/appdata/local/temp/omerta-economy-oct15-pg184'
        : 'c:/users/jorge/appdata/local/temp/omerta-employment-pg184-proof');
    }
    assert.equal((await client.query(`SELECT COUNT(*)::int AS n FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p','S','v','m','f')`)).rows[0].n, 0,
    'Require a fresh owned namespace including sequences and views');
    await client.query('ROLLBACK');
  } finally { await client.end(); }
  process.env.DATABASE_URL = url.href;
  return { native: true, version };
}

const backend=await equipmentRecoveryNativeBackend();
const {runEquipmentRecoveryScenario}=await import('./equipmentrecovery-integration-fixture.js');
await runEquipmentRecoveryScenario({native:true});
console.log('Native equipment recovery backend '+backend.version);
