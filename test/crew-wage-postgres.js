// Native PostgreSQL proof for the legacy crew wage-clock repair and its accrual boundary.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const endpoint = new URL(process.env.CREW_WAGE_TEST_DATABASE_URL || 'about:blank');
assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
  && endpoint.pathname.startsWith('/crew_wage_'), 'Use an isolated loopback crew_wage_* database');
process.env.DATABASE_URL = endpoint.href;
process.env.NODE_ENV = 'test';

const { accrue } = await import('../src/accrual.js');
const { makeDb, migrateCrewWageClocks } = await import('../src/db.js');
const { DRUGS, crewCold, crewWageOwed } = await import('../src/rules.js');

const pool = await makeDb();
const id = `crew-wage-${randomUUID()}`;
const stampAt = new Date();
try {
  await pool.query(
    `INSERT INTO characters
       (id,account_id,name,season,crew,crew_paid_at,crew_sale_credit_ms,last_accrued_at)
     VALUES ($1,$2,'Legacy Clockless Crew',1,2,NULL,59000,$3)`,
    [id, `account-${id}`, new Date(+stampAt - 86400000)]);

  const client = await pool.connect();
  try {
    const first = await migrateCrewWageClocks(client, stampAt);
    assert.equal(first.stamped, 1);
    const second = await migrateCrewWageClocks(client, new Date(+stampAt + 30000));
    assert.equal(second.stamped, 0, 'repeat repair cannot advance an existing clock');
  } finally { client.release(); }

  const ch = (await pool.query('SELECT * FROM characters WHERE id=$1', [id])).rows[0];
  assert.equal(+new Date(ch.crew_paid_at), +stampAt, 'repair starts liability now, never retroactively');
  assert.equal(Number(ch.crew_sale_credit_ms), 0, 'pre-clock fractional work is discarded');
  const settleAt = new Date(+stampAt + 60000);
  assert.equal(crewCold(ch, settleAt), false);
  assert.equal(crewWageOwed(ch, settleAt), 40, 'two hands owe exactly one minute after repair');
  const stash = [{ drug_id: DRUGS[0].id, qty: 10, quality: 1 }];
  accrue(ch, null, { preview: true, stash }, settleAt);
  assert.equal(ch._crewSale?.units, 2,
    'an old last-accrued timestamp cannot award work from before the repaired clock');
  assert.equal(stash[0].qty, 8);
} finally {
  await pool.query('DELETE FROM characters WHERE id=$1', [id]).catch(() => {});
  await pool.end();
}

console.log('Native crew wage migration: fresh clock, idempotent replay, and pre-clock accrual bound passed.');
