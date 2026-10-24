process.env.RATE_LIMIT = 'off';
process.env.INVITE_MODE = 'off';
process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.JWT_SECRET = 'economy-invariant-hardening-local-test-secret';

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildServer } from './server-fixture.js';
import { runLedgerInvariants } from '../src/invariants.js';

const app = await buildServer();
const pool = app.pool;

const check = async (name) => (await runLedgerInvariants(pool, { alert: false })).checks
  .find((entry) => entry.name === name);

try {
  const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest' });
  assert.equal(guest.statusCode, 200);
  const token = guest.json().token;
  const created = await app.inject({
    method: 'POST', url: '/v1/character',
    headers: { authorization: `Bearer ${token}` }, payload: { name: 'Invariant Proof' },
  });
  assert.equal(created.statusCode, 200);
  const characterId = created.json().id;

  assert.equal((await check('character cash')).ok, true, 'fixture begins with exact cash conservation');

  // A whole-dollar unledgered mutation must be loud. This is the smallest representable cash unit,
  // not floating-point dust, so accepting it leaves a real conservation mismatch silent.
  await pool.query('UPDATE characters SET cash=cash+1 WHERE id=$1', [characterId]);
  const dollarDrift = await check('character cash');
  assert.equal(dollarDrift.drift, 1);
  assert.equal(dollarDrift.ok, false, 'a one-dollar conservation drift fails the invariant');
  await pool.query('UPDATE characters SET cash = cash - 1 WHERE id=$1', [characterId]);

  // Vocabulary prefixes are explicit namespaces. `heist:` is open; the exact `heal` entry must not
  // bless either a byte-prefix lookalike or an undeclared colon child.
  const validId = crypto.randomUUID();
  const lookalikeId = crypto.randomUUID();
  const undeclaredChildId = crypto.randomUUID();
  const respecId = crypto.randomUUID();
  const skillRespecId = crypto.randomUUID();
  const unexpectedRespecId = crypto.randomUUID();
  await pool.query(
    `INSERT INTO transactions (id,currency,amount,reason) VALUES
       ($1,'cash',0,'heist:crew:proof'),($2,'cash',0,'healing-faucet'),($3,'cash',0,'heal:unexpected'),
       ($4,'omr',0,'respec'),($5,'omr',0,'respec:skills'),($6,'omr',0,'respec:unexpected')`,
    [validId, lookalikeId, undeclaredChildId, respecId, skillRespecId, unexpectedRespecId],
  );
  const vocabulary = await check('reason vocabulary');
  assert.equal(vocabulary.ok, false, 'a non-namespace prefix lookalike fails the vocabulary check');
  assert.deepEqual([...vocabulary.unknown].sort(), ['cash:heal:unexpected', 'cash:healing-faucet', 'omr:respec:unexpected']);
  await pool.query('DELETE FROM transactions WHERE id IN ($1,$2,$3,$4,$5,$6)',
    [validId, lookalikeId, undeclaredChildId, respecId, skillRespecId, unexpectedRespecId]);

  assert.equal((await check('character cash')).ok, true, 'cash conservation recovers after the probe');
  assert.equal((await check('reason vocabulary')).ok, true, 'vocabulary recovers after the probe');
  console.log('✅ economy invariant hardening passed — unit drift is exact and reason prefixes are namespace-bound');
} finally {
  await app.close();
}
