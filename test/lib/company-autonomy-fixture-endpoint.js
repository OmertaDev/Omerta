import assert from 'node:assert/strict';
const prefixes = new Set(['management_team_test_', 'funded_external_work_test_']);
export function autonomyFixtureEndpoint(value, prefix) {
  assert(prefixes.has(prefix), 'Unknown autonomy fixture');
  const u = new URL(value);
  assert(['postgres:', 'postgresql:'].includes(u.protocol));
  assert.equal(u.hostname, '127.0.0.1');
  assert(!u.search && !u.hash);
  assert(new RegExp('^/' + prefix + '[a-f0-9]{12}$').test(u.pathname), 'Only a fresh named fixture database');
  const local = u.port === '35449' && u.username === 'pilot_runner' && !u.password;
  const ci = u.port === '5432' && u.username === 'postgres' && u.password === 'pgcheck';
  assert(local || ci, 'Only the explicitly owned local or CI fixture service');
  return { u, local };
}
