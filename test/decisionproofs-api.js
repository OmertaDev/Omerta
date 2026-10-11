process.env.RATE_LIMIT = 'off';
process.env.JWT_SECRET = 'decision-proof-local-test-secret-only';
process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.MOD_KEY = 'decision-proof-local-test-mod';
const postgres = process.argv.includes('--postgres');
if (postgres) {
  const url = new URL(process.env.DECISION_TEST_DATABASE_URL || 'http://missing');
  if (url.protocol !== 'postgresql:' || url.hostname !== '127.0.0.1' || !url.pathname.startsWith('/decision_proofs_'))
    throw new Error('Use an isolated local decision_proofs_ PostgreSQL database.');
  process.env.DATABASE_URL = url.href;
  process.env.MARKET_SEED = 'decision-proof-local-test-seed';
}
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { resourceTransaction, lockResourceTreasury } from '../src/resourcebook.js';
const app = await buildServer();
let sequence = 0;
const call = async (method, url, token, body, idempotencyKey = `decision-proof-${++sequence}`) => {
  const response = await app.inject({ method, url, payload: body,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'idempotency-key': idempotencyKey } });
  return { code: response.statusCode, body: response.json() };
};
const player = async name => {
  const owner = (await call('POST', '/v1/auth/guest')).body.token;
  const token = (await call('POST', '/v1/auth/agent-key', owner)).body.token;
  assert.equal((await call('POST', '/v1/character', token, { name })).code, 200);
  const ch = (await call('GET', '/v1/me', token)).body.character;
  const accountId = (await app.pool.query('SELECT account_id FROM characters WHERE id=$1', [ch.id])).rows[0].account_id;
  await resourceTransaction(app.pool, client => lockResourceTreasury(client, accountId));
  await app.pool.query('UPDATE characters SET lc_crime=1 WHERE id=$1', [ch.id]);
  return { token, owner, ch, accountId };
};
const seed = async (id, p, turn, action, purpose = { kind: 'game_decision', turnId: turn.turnId }) => {
  await app.pool.query('INSERT INTO resource_calls(id,account_id,request_key,request_hash,provider_id,config,max_output_tokens,cap_usd_micros,policy_revision,purpose,status,simulated,output) VALUES($1,$2,$1,$3,$4,$5,10,100,1,$6,$7,true,$8)',
    [id, p.accountId, 'test-hash', 'test-provider', {}, purpose, 'succeeded', JSON.stringify({ actionId: action.id })]);
};
const receipt = async id => (await app.pool.query('SELECT decision_execution_receipt FROM resource_calls WHERE id=$1', [id])).rows[0].decision_execution_receipt;
try {
  const p = await player('Decision Proof Player'), foreign = await player('Foreign Decision Player');
  const turn = (await call('GET', '/v1/agent/turn', p.token)).body;
  const action = turn.actions.find(a => a.id === 'reward:onboard:ob_crime');
  assert(action, 'fixture exposes a deterministic canonical reward');
  const body = { turnId: turn.turnId, actionId: action.id, decisionCallId: 'proof-valid' };
  await seed('proof-valid', p, turn, action);
  await seed('proof-foreign', foreign, turn, action);
  await seed('proof-wrong-domain', p, turn, action, { kind: 'paid_market_analysis', jobId: 'private-job' });
  const cashBefore = Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [p.ch.id])).rows[0].cash);
  assert.equal((await call('POST', '/v1/agent/act', undefined, body)).code, 401);
  for (const decisionCallId of ['proof-foreign', 'proof-wrong-domain', 'proof-missing']) {
    const rejected = await call('POST', '/v1/agent/act', p.token, { ...body, decisionCallId });
    assert.equal(rejected.body.error, 'decision_call');
    assert.equal(Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [p.ch.id])).rows[0].cash), cashBefore,
      'invalid association rejects before native action execution');
  }
  if (postgres) {
    await app.pool.query("CREATE FUNCTION decision_proof_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.decision_execution_receipt IS NOT NULL THEN RAISE EXCEPTION 'decision receipt fixture failure'; END IF; RETURN NEW; END $$");
    await app.pool.query('CREATE TRIGGER decision_proof_fail BEFORE UPDATE ON resource_calls FOR EACH ROW EXECUTE FUNCTION decision_proof_fail()');
    const failed = await call('POST', '/v1/agent/act', p.token, body);
    assert.equal(failed.code, 500, 'receipt write failure reaches the real transaction rollback');
    assert.equal(Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [p.ch.id])).rows[0].cash), cashBefore);
    assert.equal(await receipt('proof-valid'), null, 'receipt and reward roll back together');
    await app.pool.query('DROP TRIGGER decision_proof_fail ON resource_calls');
    await app.pool.query('DROP FUNCTION decision_proof_fail()');
  }
  const key = 'decision-proof-success';
  const success = await call('POST', '/v1/agent/act', p.token, body, key);
  assert.equal(success.code, 200, JSON.stringify(success.body));
  assert.equal(success.body.decisionProof.executionRecorded, true);
  assert.equal(success.body.decisionProof.simulated, true);
  assert.equal(success.body.decisionProof.reasoningVerified, false);
  assert.equal(success.body.decisionProof.monetaryProof, false);
  assert.equal(success.body.decisionProof.causalEffect, null);
  const recorded = await receipt('proof-valid');
  assert.equal(recorded.characterId, p.ch.id);
  assert.equal(recorded.actionId, action.id);
  assert.match(recorded.resultDigest, /^[a-f0-9]{64}$/);
  assert.equal(Object.keys(recorded).length, 8);
  assert(!JSON.stringify(success.body.decisionProof).includes('resultDigest'));
  assert(!JSON.stringify(success.body.decisionProof).includes('private-job'));
  assert.deepEqual(await call('POST', '/v1/agent/act', p.token, body, key), success, 'exact transport retry preserves receipt and reward');
  const after = Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [p.ch.id])).rows[0].cash);
  assert(after > cashBefore, 'canonical action actually executed');
  const replay = await call('POST', '/v1/agent/act', p.token, body);
  assert.equal(replay.code, 409, 'fresh-key stale command cannot execute twice');
  assert.equal(Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [p.ch.id])).rows[0].cash), after);
  assert.deepEqual(await receipt('proof-valid'), recorded);
  const foreignReceipt = await receipt('proof-foreign');
  assert.equal(foreignReceipt, null, 'foreign compute records remain unchanged');
  if (postgres) {
    const racing = await player('Decision Race Player');
    const raceTurn = (await call('GET', '/v1/agent/turn', racing.token)).body;
    const raceAction = raceTurn.actions.find(a => a.id === 'reward:onboard:ob_crime');
    await seed('proof-race', racing, raceTurn, raceAction);
    const raceBody = { turnId: raceTurn.turnId, actionId: raceAction.id, decisionCallId: 'proof-race' };
    const raced = await Promise.all([
      call('POST', '/v1/agent/act', racing.token, raceBody, 'decision-race-agent'),
      call('POST', '/v1/agent/act', racing.owner, raceBody, 'decision-race-human'),
    ]);
    assert.equal(raced.filter(r => r.code === 200).length, 1, 'competing human/agent commands execute only once');
    assert.equal(raced.filter(r => r.code === 409).length, 1, 'losing command sees the native stale-turn boundary');
    assert.equal((await receipt('proof-race')).id, raced.find(r => r.code === 200).body.decisionProof.id);
  }
  console.log(`decision proofs API: auth, ownership, domain, native execution, exact retry, stale replay and privacy passed${postgres ? '; real receipt-write rollback passed' : ''}`);
} finally { await app.close(); }
