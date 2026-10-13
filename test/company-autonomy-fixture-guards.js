import assert from 'node:assert/strict';
import { autonomyFixtureEndpoint } from './lib/company-autonomy-fixture-endpoint.js';
for (const prefix of ['management_team_test_', 'funded_external_work_test_']) {
  const local = 'postgresql://pilot_runner@127.0.0.1:35449/' + prefix + '123456abcdef';
  const ci = 'postgresql://postgres:pgcheck@127.0.0.1:5432/' + prefix + '123456abcdef';
  assert.equal(autonomyFixtureEndpoint(local, prefix).local, true);
  assert.equal(autonomyFixtureEndpoint(ci, prefix).local, false);
  for (const value of [local.replace('127.0.0.1', 'remote.example'), local.replace('35449', '5432'), local.replace('pilot_runner', 'postgres'), local.replace('pilot_runner@', 'pilot_runner:secret@'), local.replace('123456abcdef', 'production'), local + '?sslmode=require', local + '#scope', ci.replace('pgcheck', 'wrong'), ci.replace('5432', '35449')])
    assert.throws(() => autonomyFixtureEndpoint(value, prefix));
  assert.throws(() => autonomyFixtureEndpoint(local, 'unknown_fixture_'));
}
console.log('Autonomy fixture guards PASS: four approved fixture endpoints, eighteen wrong endpoint/namespace/credential refusals, unknown-prefix refusal; no connections.');
