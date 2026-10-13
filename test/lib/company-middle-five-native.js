import assert from 'node:assert/strict';
import pg from 'pg';
const prefixes = new Set(['worker_training_test_', 'employment_organization_test_', 'business_partnership_test_', 'company_governance_test_', 'company_acquisition_test_', 'depot_acquisition_runtime_test_', 'company_middle_five_test_']);
export function middleFiveNativeEndpoint(value, prefix) {
  assert(prefixes.has(prefix), 'Unknown middle-five fixture');
  const u = new URL(value);
  assert(['postgres:', 'postgresql:'].includes(u.protocol));
  assert.equal(u.hostname, '127.0.0.1');
  assert(!u.search && !u.hash);
  assert(new RegExp('^/' + prefix + '[a-f0-9]{12}$').test(u.pathname), 'Only a fresh named fixture database');
  const local = u.port === '35449' && u.username === 'pilot_runner' && !u.password;
  const ci = u.port === '5432' && u.username === 'postgres' && u.password === 'pgcheck';
  assert(local || ci, 'Only the explicitly owned local or CI service');
  return { u, local };
}
export async function assertFreshMiddleFiveNative(value, prefix) {
  const { u, local } = middleFiveNativeEndpoint(value, prefix);
  const client = new pg.Client({ connectionString: u.href });
  await client.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const version = (await client.query('SHOW server_version')).rows[0].server_version;
    assert.match(version, local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
    assert.equal((await client.query('SELECT current_user')).rows[0].current_user, local ? 'pilot_runner' : 'postgres');
    assert.equal((await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0);
    await client.query('ROLLBACK');
    return { endpoint: u.href, version };
  } finally { await client.end(); }
}
