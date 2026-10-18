import assert from 'node:assert/strict';
import { managementFixture } from './managementteams-fixture.js';
import * as P from '../src/protectioncontracts.js';
import * as Defense from '../src/social/defense.js';
import * as I from '../src/items.js';

assert(!process.argv.includes('--postgres'), 'This verifies fail-closed API behavior only. Paid canonical effects require the separate native proof.');
const f = await managementFixture();
try {
  assert.equal(await P.protectionContractReady(), false);
  const base = '/v1/company/protection-contracts';
  assert.equal((await f.call(null, 'GET', base)).code, 401);
  assert.deepEqual((await f.call(f.owner, 'GET', base)).body.contracts, []);
  assert.deepEqual((await f.call(f.owner, 'GET', base, undefined, 'agent-board', true)).body.contracts, []);
  assert.equal((await f.call(f.owner, 'GET', base + '?authority=owner')).code, 400);
  const body = { campaignId: 'source', campaignSourceHash: 'a'.repeat(64), priceCash: 10000,
    lifetimeSeconds: 60, service: 'canonical_nonexclusive_single_save', consent: true };
  for (const agent of [false, true]) {
    const unavailable = await f.call(f.owner, 'POST', base + '/fund', body, 'same-native-required', agent);
    assert.equal(unavailable.code, 400, 'Existing GameError transport status is preserved');
    assert.equal(unavailable.body.error, 'protection_contract_unavailable');
    assert.equal((await f.call(f.owner, 'POST', base + '/fund', { ...body, guard: f.partner.id }, 'foreign-target', agent)).code, 400);
  }
  assert.equal(Number((await f.app.pool.query('SELECT COUNT(*) n FROM protection_contracts')).rows[0].n), 0);
  await I.withItemTransaction(f.app.pool, async c => {
    await P.finalizeProtectionContract(c, { contract: { state: 'activated', paidCash: 10000 } });
    await assert.rejects(() => Defense.consumeProtectionGuard(c, { guard: f.partner.id, price: 10000 }), /guard_fresh_source/);
  });
  assert.equal(Number((await f.app.pool.query('SELECT COUNT(*) n FROM protection_contract_requests')).rows[0].n), 0);
  console.log('PASS fail-closed memory API, authenticated human/agent parity, no caller target/authority, no fake proof or purchase. No paid native claim.');
} finally { await f.close(); }
