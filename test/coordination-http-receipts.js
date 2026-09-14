// Local callback-boundary regression: an older response must not change a replacement
// HTTP reservation. The domain command journal remains authoritative and value-neutral.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildServer } from '../src/server.js';

assert(!process.env.DATABASE_URL, 'receipt regression uses only pg-mem');
process.env.COORDINATION_ENGINE = 'on';
const app = await buildServer();
const account = 'coord-http-reservation';
const originalQuery = app.pool.query;
try {
  await app.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [account]);
  await app.pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [account]);
  await app.pool.query('INSERT INTO characters(id,account_id,name,season) VALUES($1,$2,$3,1)', [`${account}-ch`, account, 'Receipt Reader']);
  const token = app.jwt.sign({ sub: account, tv: 0 });
  const catalog = await app.inject({ method: 'GET', url: '/v1/coordination', headers: { authorization: `Bearer ${token}` } });
  const graph = catalog.json().graphs.find((row) => row.id === 'omerta.coordination.dead-letter');
  assert(graph);
  for (const scenario of ['replaced-before-success', 'replaced-before-failure', 'already-finalized']) {
    const key = crypto.randomUUID(), url = `/v1/coordination/${graph.id}/instances`;
    const body = { expectedContentHash: scenario === 'replaced-before-failure' ? 'a'.repeat(64) : graph.contentHash };
    const originalHash = crypto.createHash('sha256').update(`POST\n${url}\n${JSON.stringify(body)}`).digest('hex');
    const replacementHash = scenario === 'already-finalized' ? originalHash : 'b'.repeat(64);
    const replacementStatus = scenario === 'already-finalized' ? 201 : 0;
    const replacementResponse = JSON.stringify({ marker: scenario });
    let intercepted = false;
    app.pool.query = async function (sql, args) {
      const boundary = scenario === 'replaced-before-failure'
        ? String(sql).startsWith('DELETE FROM idempotency')
        : String(sql).startsWith('UPDATE idempotency SET status');
      if (!intercepted && boundary && args?.[1] === key) {
        intercepted = true;
        // Model the reservation state produced by another callback before this
        // delayed callback reaches SQL. No second gameplay action is executed.
        await originalQuery.call(this, 'UPDATE idempotency SET body_hash=$3,status=$4,response=$5 WHERE account_id=$1 AND key=$2',
          [account, key, replacementHash, replacementStatus, replacementResponse]);
      }
      return originalQuery.call(this, sql, args);
    };
    let result;
    try {
      result = await app.inject({ method: 'POST', url, payload: body,
        headers: { authorization: `Bearer ${token}`, 'idempotency-key': key } });
    } finally { app.pool.query = originalQuery; }
    assert(intercepted, scenario);
    assert.equal(result.statusCode, scenario === 'replaced-before-failure' ? 409 : 200, result.body);
    const reservation = (await app.pool.query('SELECT body_hash,status,response FROM idempotency WHERE account_id=$1 AND key=$2', [account, key])).rows[0];
    assert.deepEqual(reservation, { body_hash: replacementHash, status: replacementStatus, response: replacementResponse },
      `Delayed callback must preserve the ${scenario} reservation`);
  }
  assert.equal(Number((await app.pool.query('SELECT count(*) AS n FROM coordination_instances')).rows[0].n), 1);
  assert.equal(Number((await app.pool.query('SELECT count(*) AS n FROM transactions')).rows[0].n), 0);
  console.log('coordination HTTP receipts: delayed success/failure cannot overwrite or delete a replacement reservation; first finalized receipt wins');
} finally {
  app.pool.query = originalQuery;
  await app.close();
  delete process.env.COORDINATION_ENGINE;
}
