import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { nativeEndpoint, nativeFixture } from './syndicatedloans-native-fixture.js';
const valid = 'postgres://pilot_runner@127.0.0.1:35439/syndicated_loan_native_123456789abc';
const base = { SYNDICATED_LOAN_NATIVE_DATABASE_URL: valid };
const cases = [
  ['explicit native', [], base, []], ['extra argument', ['--postgres', '--memory'], base, []],
  ['CLI import', ['--postgres'], base, ['--import', 'node:assert']], ['CLI require', ['--postgres'], base, ['--require', 'node:assert']],
  ...['DATABASE_URL', 'NODE_OPTIONS', 'NODE_PATH', 'PGHOST', 'PGOPTIONS', 'pghost', 'TEST_DATABASE_URL', 'FOREIGN_TEST_DATABASE_URL',
    'SYNDICATED_LOAN_NATIVE_ADMIN_DATABASE_URL', 'test_database_url'].map(key => [key, ['--postgres'], { ...base, [key]: 'refused' }, []]),
  ...['http://127.0.0.1:35439/syndicated_loan_native_123456789abc',
    'postgres://pilot_runner@localhost:35439/syndicated_loan_native_123456789abc',
    'postgres://pilot_runner:secret@127.0.0.1:35439/syndicated_loan_native_123456789abc',
    'postgres://postgres@127.0.0.1:35439/syndicated_loan_native_123456789abc',
    'postgres://pilot_runner@127.0.0.1:5432/syndicated_loan_native_123456789abc',
    'postgres://pilot_runner@127.0.0.1:35439/not_owned',
    valid + 'd', valid + '?sslmode=disable', valid + '#changed'].map(url => ['URL refusal', ['--postgres'], { ...base, SYNDICATED_LOAN_NATIVE_DATABASE_URL: url }, []])
];
for (const [, argv, env, execArgv] of cases) assert.throws(() => nativeEndpoint(argv, env, execArgv));
assert.equal(nativeEndpoint(['--postgres'], base, []).local, true);
assert.equal(nativeEndpoint(['--postgres'], { ...base, SYNDICATED_LOAN_NATIVE_DATABASE_URL: valid.replace('35439', '35449') }, []).local, true);
assert.equal(nativeEndpoint(['--postgres'], { CI: 'true', SYNDICATED_LOAN_NATIVE_DATABASE_URL: valid.replace('pilot_runner@127.0.0.1:35439', 'postgres:pgcheck@127.0.0.1:5432') }, []).ci, true);

// Constructor denial exists only in this negative-control process. Positive
// payloads import the actual untouched pg driver in a fresh bare Node process.
const originalClient = pg.Client, argv = [...process.argv], old = process.env.SYNDICATED_LOAN_NATIVE_DATABASE_URL;
let constructorAttempts = 0;
pg.Client = class { constructor() { constructorAttempts++; throw Error('Unexpected PG constructor in refusal control'); } };
try {
  process.argv.splice(2, Infinity, '--postgres');
  for (const url of [valid.replace('35439', '35438'), valid.replace('/syndicated_loan_native_', '/unowned_'), valid + '?options=changed']) {
    process.env.SYNDICATED_LOAN_NATIVE_DATABASE_URL = url; await assert.rejects(nativeFixture());
  }
  process.env.SYNDICATED_LOAN_NATIVE_DATABASE_URL = valid;
  for (const key of ['TEST_DATABASE_URL', 'FOREIGN_TEST_DATABASE_URL', 'SYNDICATED_LOAN_NATIVE_ADMIN_DATABASE_URL', 'test_database_url', 'pghost']) {
    const previous = process.env[key]; process.env[key] = 'refused';
    try { await assert.rejects(nativeFixture(), /unrelated database target|ambient PG refused/); }
    finally { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; }
  }
  assert.equal(constructorAttempts, 0);
} finally {
  pg.Client = originalClient; process.argv.splice(0, Infinity, ...argv);
  if (old === undefined) delete process.env.SYNDICATED_LOAN_NATIVE_DATABASE_URL; else process.env.SYNDICATED_LOAN_NATIVE_DATABASE_URL = old;
}
const env = { ...process.env }; delete env.DATABASE_URL; delete env.NODE_OPTIONS; delete env.NODE_PATH;
for (const key of Object.keys(env)) if (/^PG[A-Z_]/i.test(key) || /DATABASE_URL$/i.test(key)) delete env[key];
for (const file of ['syndicatedloans-native', 'syndicatedloans-native-recovery', 'syndicatedloans-native-expiry', 'syndicatedloans-native-estate']) {
  const child = spawnSync(process.execPath, ['test/' + file + '.js', '--postgres'], { env: { ...env,
    SYNDICATED_LOAN_NATIVE_DATABASE_URL: 'http://127.0.0.1:35439/refused', SYNDICATED_LOAN_NATIVE_ESTATE: 'borrower-open' },
  encoding: 'utf8', timeout: 10000 });
  assert.notEqual(child.status, 0); assert.equal(child.signal, null); assert.match(child.stderr, /protocol refused before connect/);
  assert(!/ECONNREFUSED|\[db\]/.test(child.stdout + child.stderr));
}
console.log('PASS N22 pure admission: ' + cases.length + ' endpoint/argv/env refusals, three parse-only authorities, eight actual fixture refusals with PG constructors denied/zero attempts and four genuine entry refusals before DB boot; no native positive');
