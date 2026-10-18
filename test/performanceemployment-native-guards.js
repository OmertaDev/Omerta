import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { nativeEndpoint } from './performanceemployment-native-fixture.js';
const url = 'postgres://pilot_runner@127.0.0.1:35439/performance_employment_test_012345abcdef';
const base = { PERFORMANCE_EMPLOYMENT_TEST_DATABASE_URL: url }, failures = [];
const reject = (label, argv, env) => { assert.throws(() => nativeEndpoint(argv, env)); failures.push(label); };
for (const argv of [[], ['--pg'], ['--postgres', '--extra'], ['--postgres', '--postgres']]) reject('CLI ' + argv.join(' '), argv, base);
for (const [field, value] of [['DATABASE_URL', url], ['NODE_OPTIONS', '--trace-warnings'], ['NODE_PATH', '.'], ['PGHOST', '127.0.0.1'], ['PGPORT', '35439']]) reject(field, ['--postgres'], { ...base, [field]: value });
for (const endpoint of ['http://127.0.0.1:35439/performance_employment_test_012345abcdef', url.replace('127.0.0.1', 'localhost'), url.replace('127.0.0.1', '0.0.0.0'),
  url.replace('35439', '5432'), url.replace('pilot_runner', 'postgres'), url.replace('pilot_runner@', 'pilot_runner:secret@'),
  url.replace('performance_employment_test_012345abcdef', 'postgres'), url.replace('012345abcdef', 'wrong'), url + '?options=anything', url + '#ignored']) {
  reject('endpoint ' + endpoint, ['--postgres'], { PERFORMANCE_EMPLOYMENT_TEST_DATABASE_URL: endpoint });
}
// Valid parser shapes are not database admission or positive native results.
assert.equal(nativeEndpoint(['--postgres'], base).local, true);
assert.equal(nativeEndpoint(['--postgres'], { PERFORMANCE_EMPLOYMENT_TEST_DATABASE_URL: url.replace('35439', '35449') }).local, true);
const directory = path.dirname(fileURLToPath(import.meta.url)), env = { ...process.env, ...base };
delete env.DATABASE_URL; delete env.NODE_OPTIONS; delete env.NODE_PATH; for (const key of Object.keys(env)) if (/^PG[A-Z_]/.test(key)) delete env[key];
for (const file of ['performanceemployment-native.js', 'performanceemployment-native-recovery.js', 'performanceemployment-native-expiry.js']) {
  const result = spawnSync(process.execPath, [path.join(directory, file)], { env, encoding: 'utf8', timeout: 15000 });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /exact --postgres required before connect/); assert(!result.stdout.includes('[db]'));
}
console.log('PASS N26 native-only preparation: ' + failures.length + ' pure endpoint/ambient/CLI refusals and three actual entry guards; zero PG imports/connections in these negative paths, no positive native claim');
