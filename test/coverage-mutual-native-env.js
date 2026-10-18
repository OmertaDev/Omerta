import assert from 'node:assert/strict';

export function coverageMutualNativeEndpoint(value, { integration = false } = {}) {
  const u = new URL(value);
  const local = u.port === '35449' && u.username === 'pilot_runner' && !u.password;
  const ci = u.port === '5432' && u.username === 'postgres' && u.password === 'pgcheck';
  assert(['postgres:', 'postgresql:'].includes(u.protocol) && u.hostname === '127.0.0.1' && !u.search && !u.hash && (local || ci));
  assert.match(u.pathname, integration ? /^\/coverage_mutual_integration_test_[a-f0-9]{12}$/ : /^\/coverage_mutual_test_[a-f0-9]{12}$/);
  return { u, local };
}
// Validate the disposable endpoint before importing modules that read DATABASE_URL.
export async function prepareCoverageMutualDatabase({ integration = false } = {}) {
  assert(!process.env.DATABASE_URL, 'Mutual proofs refuse ambient database endpoints');
  assert(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--postgres'), 'Closed proof arguments');
  const native = process.argv[2] === '--postgres'; if (!native) return false;
  const name = integration ? 'COVERAGE_MUTUAL_INTEGRATION_TEST_DATABASE_URL' : 'COVERAGE_MUTUAL_TEST_DATABASE_URL';
  const { u, local } = coverageMutualNativeEndpoint(process.env[name], { integration });
  const { default: pg } = await import('pg'), c = new pg.Client({ connectionString: u.href }); await c.connect();
  try {
    await c.query('BEGIN READ ONLY');
    const backend = (await c.query("SELECT current_user AS role,current_database() AS database,current_setting('server_version') AS version,current_setting('data_directory') AS directory")).rows[0];
    assert.equal(backend.role, u.username); assert.equal(backend.database, u.pathname.slice(1));
    assert.match(backend.version, local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
    if (local) assert.equal(backend.directory.replaceAll('\\', '/').toLowerCase(), 'c:/users/jorge/appdata/local/temp/omerta-employment-pg184-proof');
    assert.equal((await c.query("SELECT COUNT(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','S','v','m','f')")).rows[0].n, 0);
    await c.query('ROLLBACK');
  } finally { await c.end(); }
  process.env.DATABASE_URL = u.href; return true;
}
