import assert from 'node:assert/strict';
import { commandDatabase, addPlayer, postgres } from './lib/player-command-support.js';
import { resourceTransaction, lockResourceTreasury, moveResourceMoney, setResourcePolicy, resourceAccounting } from '../src/resourcebook.js';
import { runResourceCompute, reconcileResourceCompute, createResourceRound, commitResourceBid,
  revealResourceBid, settleResourceRound, sweepResourceCompute } from '../src/resourcecompute.js';
import { computeBidCommitment } from '../src/resourceauction.js';
import { ResourceProviderError } from '../src/resourceproviders.js';

process.env.RESOURCE_ECONOMY = 'on'; process.env.RESOURCE_COMPUTE_ENABLED = 'on';
process.env.RESOURCE_PAYMENTS_MODE = 'test'; process.env.RESOURCE_COMPUTE_DAILY_SLOTS = '10';
const db = await commandDatabase('resourcecompute'); const { pool } = db;
const entry = { id: 'metered', model: 'fixture', maxInputTokens: 4096, maxOutputTokens: 256, storeResponses: true };
let sends = 0; let behavior = 'success';
const adapter = {
  providerCatalog: () => [entry], quoteCompute: () => 100,
  async executeCompute(_, options) {
    sends++;
    if (behavior === 'ambiguous') throw new ResourceProviderError('timeout', 'Unknown billing', { ambiguous: true, providerRequestId: `resp_unknown_${options.requestId}` });
    if (behavior === 'rejected') throw new ResourceProviderError('rejected', 'No billing', { ambiguous: false });
    return { output: '{"actionId":"a"}', costUsdMicros: 60, providerRequestId: `resp_${options.requestId}` };
  },
  async fetchComputeReceipt(_, options) {
    assert.equal(options.providerRequestId, `resp_unknown_${options.requestId}`);
    return { output: 'recovered', costUsdMicros: 40, providerRequestId: options.providerRequestId };
  },
};
const policy = (patch = {}) => ({ expectedRevision: 0, enabled: true, providers: ['metered'], maxPerCallUsdMicros: 1000,
  maxPerDayUsdMicros: 10000, minimumReserveUsdMicros: 0, allowStoredResponses: true, expiresInSeconds: 3600, ...patch });
const terms = requestId => ({ requestId, providerId: 'metered', maxOutputTokens: 256, prompt: 'Select a game action', purpose: { kind: 'reasoning' } });
async function actor(id, patch = {}) {
  await addPlayer(pool, id, `Compute ${id}`);
  await resourceTransaction(pool, async client => {
    await lockResourceTreasury(client, id);
    await moveResourceMoney(client, id, 10000, 0, 'capital', `fixture:${id}`);
  });
  await setResourcePolicy(pool, id, policy(patch));
}
const balance = async id => resourceAccounting(pool, id);
const run = (id, body) => runResourceCompute(pool, id, body, { adapter });
try {
  await actor('regular');
  const first = await run('regular', terms('first'));
  assert.equal(first.call.status, 'succeeded'); assert.equal(first.call.costUsdMicros, 60);
  assert.equal(first.call.simulated, true);
  assert.equal((await balance('regular')).availableUsdMicros, 9940);
  assert.equal((await balance('regular')).reservedUsdMicros, 0);
  assert.equal((await balance('regular')).ledgerDriftUsdMicros, 0);
  assert.deepEqual(await run('regular', terms('first')), first);
  assert.equal(sends, 1);
  await assert.rejects(() => run('regular', { ...terms('first'), prompt: 'changed' }), e => e.code === 'resource_conflict');
  behavior = 'ambiguous';
  const uncertain = await run('regular', terms('unknown'));
  assert.equal(uncertain.call.status, 'unknown');
  assert.equal((await balance('regular')).reservedUsdMicros, 100);
  const sentUnknown = sends;
  await run('regular', terms('unknown')); assert.equal(sends, sentUnknown);
  process.env.RESOURCE_ECONOMY = 'off';
  await setResourceDisabledPolicy();
  const recovered = await reconcileResourceCompute(pool, 'regular', uncertain.call.id, 'unused', { adapter });
  assert.equal(recovered.call.status, 'succeeded'); assert.equal(recovered.call.costUsdMicros, 40);
  assert.equal((await balance('regular')).availableUsdMicros, 9900);
  assert.equal((await balance('regular')).reservedUsdMicros, 0);
  assert.equal(sends, sentUnknown, 'recovery reads a receipt and never resends inference');
  await assert.rejects(() => run('regular', terms('off')), e => e.code === 'resource_disabled');
  process.env.RESOURCE_ECONOMY = 'on';
  await setResourcePolicy(pool, 'regular', policy({ expectedRevision: 1, enabled: true }));
  behavior = 'rejected';
  await actor('daily', { maxPerDayUsdMicros: 100 });
  const rejected = await run('daily', terms('rejected'));
  assert.equal(rejected.call.status, 'failed');
  assert.equal((await balance('daily')).availableUsdMicros, 10000);
  assert.equal((await balance('daily')).reservedUsdMicros, 0);
  await assert.rejects(() => run('daily', terms('refund-cannot-reset')), e => e.code === 'resource_budget');
  await setResourcePolicy(pool, 'daily', policy({ expectedRevision: 1, maxPerDayUsdMicros: 100 }));
  await assert.rejects(() => run('daily', terms('revision-cannot-reset')), e => e.code === 'resource_budget');
  await actor('reserve', { minimumReserveUsdMicros: 9950 });
  await assert.rejects(() => run('reserve', terms('minimum')), e => e.code === 'resource_budget');
  await actor('frozen');
  await pool.query('UPDATE resource_treasuries SET frozen=true WHERE account_id=$1', ['frozen']);
  await assert.rejects(() => run('frozen', terms('frozen')), e => e.code === 'resource_frozen');
  assert.equal((await balance('frozen')).availableUsdMicros, 10000);
  await actor('revoked'); behavior = 'ambiguous';
  const reserved = await run('revoked', terms('reservation'));
  // Simulate a process exit after committed reserve, before its sending marker.
  await pool.query("UPDATE resource_calls SET status='reserved' WHERE id=$1", [reserved.call.id]);
  await setResourcePolicy(pool, 'revoked', policy({ expectedRevision: 1, enabled: false }));
  const prior = sends;
  const revoked = await run('revoked', terms('reservation'));
  assert.equal(revoked.call.status, 'failed'); assert.equal(revoked.call.errorCode, 'authorization_changed');
  assert.equal(sends, prior); assert.equal((await balance('revoked')).reservedUsdMicros, 0);
  if (postgres) {
    behavior = 'success'; await actor('concurrent');
    const prior = sends;
    const replies = await Promise.all([run('concurrent', terms('parallel')), run('concurrent', terms('parallel'))]);
    assert.equal(sends, prior + 1);
    assert(replies.every(reply => reply.call.id === replies[0].call.id));
    assert.equal((await balance('concurrent')).availableUsdMicros, 9940);
  }
  behavior = 'success';
  for (const id of ['auction-a', 'auction-b', 'auction-c', 'auction-unrevealed']) await actor(id);
  const round = (await createResourceRound(pool, { providerId: 'metered', maxOutputTokens: 256,
    capacity: 2, reserveUsdMicros: 100, commitSeconds: 60, revealSeconds: 60 }, { adapter })).round;
  const bids = [['auction-a', 300], ['auction-b', 200], ['auction-c', 150], ['auction-unrevealed', 400]];
  const nonce = 'abcdef0123456789'.repeat(4);
  const commitments = new Map();
  for (const [accountId, bidUsdMicros] of bids) {
    const body = { maximumUsdMicros: 500, commitment: computeBidCommitment({ roundId: round.id, accountId, bidUsdMicros, nonce }) };
    const committed = await commitResourceBid(pool, accountId, round.id, body);
    commitments.set(accountId, committed);
    assert.deepEqual(await commitResourceBid(pool, accountId, round.id, body), committed);
    assert.equal((await balance(accountId)).reservedUsdMicros, 500);
  }
  await assert.rejects(() => revealResourceBid(pool, 'auction-a', round.id, { bidUsdMicros: 300, nonce }), e => e.code === 'resource_phase');
  await pool.query('UPDATE resource_rounds SET commit_until=$2,reveal_until=$3 WHERE id=$1', [round.id, new Date(Date.now() - 1000), new Date(Date.now() + 60000)]);
  await assert.rejects(() => revealResourceBid(pool, 'auction-a', round.id, { bidUsdMicros: 301, nonce }), e => e.code === 'resource_bid');
  for (const [accountId, bidUsdMicros] of bids.slice(0, 3)) await revealResourceBid(pool, accountId, round.id, { bidUsdMicros, nonce });
  await pool.query('UPDATE resource_rounds SET reveal_until=$2 WHERE id=$1', [round.id, new Date(Date.now() - 1000)]);
  const cleared = await settleResourceRound(pool, round.id, { adapter });
  assert.equal(cleared.settlement.clearingUsdMicros, 200);
  assert.deepEqual(cleared.settlement.winners.map(w => w.accountId), ['auction-a', 'auction-b']);
  assert.equal(cleared.settlement.losers.length, 2);
  assert.deepEqual(await settleResourceRound(pool, round.id, { adapter }), cleared);
  assert.equal((await balance('auction-c')).availableUsdMicros, 10000);
  assert.equal((await balance('auction-unrevealed')).reservedUsdMicros, 0);
  const credit = (await pool.query('SELECT * FROM resource_credits WHERE account_id=$1', ['auction-a'])).rows[0];
  assert.equal((await balance('auction-a')).reservedUsdMicros, 200);
  const consumed = await run('auction-a', { ...terms('won-slot'), creditId: credit.id });
  assert.equal(consumed.call.costUsdMicros, 200);
  assert.equal(consumed.call.providerCostUsdMicros, 60);
  assert.equal((await balance('auction-a')).reservedUsdMicros, 0);
  assert.equal((await balance('auction-a')).availableUsdMicros, 9800);
  await assert.rejects(() => run('auction-a', { ...terms('reuse-slot'), creditId: credit.id }), e => e.code === 'resource_credit');
  await pool.query('UPDATE resource_credits SET expires_at=$2 WHERE account_id=$1', ['auction-b', new Date(Date.now() - 1000)]);
  await sweepResourceCompute(pool);
  assert.equal((await balance('auction-b')).availableUsdMicros, 10000);
  assert.equal((await balance('auction-b')).reservedUsdMicros, 0);
  for (const [id] of bids) assert.equal((await balance(id)).ledgerDriftUsdMicros, 0);
  await actor('stale');
  const staleRound = (await createResourceRound(pool, { providerId: 'metered', maxOutputTokens: 256,
    capacity: 1, reserveUsdMicros: 100, commitSeconds: 60, revealSeconds: 60 }, { adapter })).round;
  await commitResourceBid(pool, 'stale', staleRound.id, { maximumUsdMicros: 200,
    commitment: computeBidCommitment({ roundId: staleRound.id, accountId: 'stale', bidUsdMicros: 200, nonce }) });
  await pool.query('UPDATE resource_rounds SET commit_until=$2,reveal_until=$3 WHERE id=$1', [staleRound.id, new Date(Date.now() - 1000), new Date(Date.now() + 60000)]);
  await revealResourceBid(pool, 'stale', staleRound.id, { bidUsdMicros: 200, nonce });
  await pool.query('UPDATE resource_rounds SET reveal_until=$2 WHERE id=$1', [staleRound.id, new Date(Date.now() - 1000)]);
  const stale = await settleResourceRound(pool, staleRound.id, { adapter: { ...adapter, providerCatalog: () => [{ ...entry, model: 'different' }] } });
  assert.equal(stale.settlement.winners.length, 0);
  assert.equal((await balance('stale')).availableUsdMicros, 10000);
  assert.equal((await balance('stale')).reservedUsdMicros, 0);
  await actor('boundary');
  await resourceTransaction(pool, async client => {
    await lockResourceTreasury(client, 'boundary');
    await moveResourceMoney(client, 'boundary', 1000000000000 - 10000, 0, 'capital', 'boundary:capital');
    await moveResourceMoney(client, 'boundary', -100, 100, 'compute_reserve', 'boundary:reserve');
  });
  await assert.rejects(() => resourceTransaction(pool, async client => {
    await lockResourceTreasury(client, 'boundary');
    await moveResourceMoney(client, 'boundary', 100, 0, 'capital', 'boundary:overflow');
  }), e => e.code === 'resource_terms');
  assert.equal((await balance('boundary')).availableUsdMicros, 1000000000000 - 100);
  await resourceTransaction(pool, async client => {
    await lockResourceTreasury(client, 'boundary');
    await moveResourceMoney(client, 'boundary', 100, -100, 'compute_refund', 'boundary:refund');
  });
  assert.equal((await balance('boundary')).availableUsdMicros, 1000000000000);
  assert.equal((await balance('boundary')).reservedUsdMicros, 0);
  assert.equal((await balance('boundary')).ledgerDriftUsdMicros, 0);
  console.log(`resourcecompute: reservations, authority, unknown recovery, auctions and credits passed${postgres ? ' (PostgreSQL concurrency)' : ''}`);
} finally { await db.cleanup(pool); }

async function setResourceDisabledPolicy() {
  await pool.query('UPDATE resource_compute_policies SET enabled=false WHERE account_id=$1', ['regular']);
}
