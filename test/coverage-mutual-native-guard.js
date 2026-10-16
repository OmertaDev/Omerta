import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { coverageMutualNativeEndpoint } from './coverage-mutual-native-env.js';
assert(!process.env.DATABASE_URL && process.argv.length === 2);
let refused = 0;
for (const integration of [false, true]) {
  const database = integration ? 'coverage_mutual_integration_test_0123456789ab' : 'coverage_mutual_test_0123456789ab';
  for (const endpoint of ['postgresql://pilot_runner@127.0.0.1:35449/', 'postgresql://postgres:pgcheck@127.0.0.1:5432/'])
    assert.equal(coverageMutualNativeEndpoint(endpoint + database, { integration }).u.pathname, '/' + database);
  const valid = 'postgresql://pilot_runner@127.0.0.1:35449/' + database;
  const bad = [undefined, '', valid.replace('postgresql:', 'https:'), valid.replace('127.0.0.1', 'localhost'), valid.replace('127.0.0.1', 'example.com'),
    valid.replace('35449', '5432'), valid.replace('pilot_runner@', 'pilot_runner:unexpected@'), valid.replace('pilot_runner@', 'postgres@'),
    valid.replace(database, 'postgres'), valid.replace(database, database + '_extra'), valid.replace('0123456789ab', '0123456789a'), valid + '?sslmode=disable', valid + '#fragment'];
  for (const value of bad) { assert.throws(() => coverageMutualNativeEndpoint(value, { integration })); refused++; }
}
for (const [file, args, patch] of [['core', ['--unknown'], {}], ['integration', ['--unknown'], {}], ['core', [], { DATABASE_URL: 'postgresql://external.invalid/prohibited' }],
  ['integration', [], { DATABASE_URL: 'postgresql://external.invalid/prohibited' }], ['core', ['--postgres'], { COVERAGE_MUTUAL_TEST_DATABASE_URL: 'postgresql://external.invalid/prohibited' }]]) {
  const env = { ...process.env, ...patch }; if (!Object.hasOwn(patch, 'DATABASE_URL')) delete env.DATABASE_URL;
  const r = spawnSync(process.execPath, ['test/coverage-mutual-' + file + '.js', ...args], { env, encoding: 'utf8', timeout: 10000 });
  assert.equal(r.status, 1, String(r.error || r.stderr)); assert(!r.stdout.includes('[db]'), 'Refusal precedes any game database construction'); refused++;
}
console.log('Coverage mutual native guards PASS: four pure owned endpoint contexts and ' + refused + ' refused endpoint/CLI/ambient configurations before game DB construction; no PostgreSQL connection attempted.');
