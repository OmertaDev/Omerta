process.env.JWT_SECRET = 'isolated-company-runner-regression-secret';
process.env.MOD_KEY = 'isolated-company-runner-mod';
process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.DEPOT_PILOT = 'on';
process.env.POPULATION_OFF = 'on';
process.env.RESOURCE_ECONOMY = 'off';
process.env.RATE_LIMIT = 'off';
const native = process.argv.includes('--postgres');
if (native) {
  const url = new URL(process.env.COMPANY_OPERATOR_RUNNER_TEST_DATABASE_URL || '');
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !/^\/company_operator_runner_test_[a-z0-9_]+$/.test(url.pathname)) throw Error('Explicit owned runner database required');
  process.env.DATABASE_URL = url.href;
  const { default: pg } = await import('pg');
  const probe = new pg.Client({ connectionString: url.href });
  await probe.connect();
  try { if (Number((await probe.query("SELECT COUNT(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')")).rows[0].n)) throw Error('Runner database must be empty'); }
  finally { await probe.end(); }
} else delete process.env.DATABASE_URL;
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import * as G from '../src/game.js';
import { runCompanyOperators } from '../src/companyoperatorrunner.js';
import { runLedgerInvariants } from '../src/invariants.js';

const app = await buildServer();
const call = async (method, url, token, payload, expected = 200) => {
  const r = await app.inject({ method, url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });
  assert.equal(r.statusCode, expected, r.body); return r.json();
};
try {
  const actors = [];
  for (const [i, funded] of [[0, false], [1, true]]) {
    const token = (await call('POST', '/v1/auth/guest')).token;
    await call('POST', '/v1/character', token, { name: `Company Runner Owner ${i}` });
    const ch = (await call('GET', '/v1/me', token)).character;
    const account = (await app.pool.query('SELECT account_id FROM characters WHERE id=$1', [ch.id])).rows[0].account_id;
    await app.pool.query('UPDATE characters SET cash=20000,bank=0 WHERE id=$1', [ch.id]);
    await G.ledger(app.pool, { characterId: ch.id, currency: 'cash', amount: 20000 - ch.cash - ch.bank, reason: 'pilot:capital' });
    const depotId = (await call('POST', '/v1/depot', token, { salePrice: 2000, bidPrice: 500, targetStock: 4, reorderAt: 0, restockBudget: 3000 })).id;
    if (funded) await call('POST', `/v1/depot/${depotId}/fund`, token, { amount: 6000 });
    const policy = (await call('POST', `/v1/depot/${depotId}/policy`, token, { expectedRevision: 0, enabled: true,
      allowRestock: true, allowReceive: true, businessPriority: true, maxSpend: 2020, reserveCash: 1500, expiresInSeconds: 3600 })).policy;
    const enrollment = { depotId, policyId: policy.id, expectedRevision: 0, enabled: true };
    const agent = app.jwt.sign({ sub: account, agent: true });
    assert.equal((await call('POST', '/v1/company/operator', agent, enrollment, 400)).error, 'owner_authority');
    await call('POST', '/v1/company/operator', token, enrollment);
    await call('POST', '/v1/company/operator/run', agent, { depotId, requestKey: 'invalid-fields', outsideAuthority: true }, 400);
    await call('GET', '/v1/company/operator', null, undefined, 401);
    await app.pool.query('UPDATE company_operators SET next_run_at=$2 WHERE depot_id=$1', [depotId, new Date(`200${i}-01-01T00:00:00Z`)]);
    actors.push({ token, agent, account, depotId });
  }
  const idle = await runCompanyOperators(app.pool, 1);
  assert.equal(idle.results[0].depotId, actors[0].depotId);
  assert.equal(idle.results[0].skipped, 'operator_idle');
  assert.equal(Number((await app.pool.query('SELECT COUNT(*) AS n FROM company_operator_receipts WHERE owner_account=$1', [actors[0].account])).rows[0].n), 0);
  const active = await runCompanyOperators(app.pool, 1);
  assert.equal(active.results[0].depotId, actors[1].depotId, 'an idle oldest actor cannot starve the next funded business');
  assert.equal(active.results[0].action, 'restock');
  assert.equal(Number((await app.pool.query('SELECT treasury FROM business_depots WHERE id=$1', [actors[1].depotId])).rows[0].treasury), 3980);
  const receipt = (await app.pool.query('SELECT request_key,result FROM company_operator_receipts WHERE owner_account=$1', [actors[1].account])).rows[0];
  const replay = await call('POST', '/v1/company/operator/run', actors[1].agent, { depotId: actors[1].depotId, requestKey: receipt.request_key });
  assert.equal(replay.action, 'restock');
  assert.equal(Number((await app.pool.query('SELECT treasury FROM business_depots WHERE id=$1', [actors[1].depotId])).rows[0].treasury), 3980);
  await call('POST', '/v1/company/operator/run', actors[0].agent, { depotId: actors[1].depotId, requestKey: receipt.request_key }, 400);
  assert.equal((await runLedgerInvariants(app.pool, { alert: false })).ok, true);
  console.log('company operator runner PASS: actual JWT owner/agent boundaries, canonical funding, idle fairness, once-only worker execution, replay, foreign denial and full ledger conservation');
} finally { await app.close(); }
