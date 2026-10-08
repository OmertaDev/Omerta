import crypto from 'node:crypto';
import * as Providers from './resourceproviders.js';
import { dbCaps } from './db.js';
import { computeBidCommitment, clearComputeAuction } from './resourceauction.js';
import { resourceTransaction, lockResourceTreasury, lockResourceTreasuries, moveResourceMoney,
  authorizeResourceSpend, resourceInt, resourceKey, resourceIntake, resourceEnabled, resourceError, resourceMode } from './resourcebook.js';

const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const digest = value => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const currentEntry = (adapter, id) => {
  const entry = adapter.providerCatalog().find(row => row.id === id);
  if (!entry) throw resourceError('provider', 'No configured compute capability by that identifier.');
  return entry;
};
const callView = row => ({ id: row.id, status: row.status, providerId: row.provider_id,
  output: row.status === 'succeeded' ? row.output : null, costUsdMicros: row.cost_usd_micros === null ? null : Number(row.cost_usd_micros),
  providerCostUsdMicros: row.provider_cost_usd_micros === null ? null : Number(row.provider_cost_usd_micros),
  purpose: row.purpose, simulated: row.simulated, errorCode: row.error_code || null });
export const resourceComputeCatalog = () => Providers.providerCatalog();

function requestTerms(body) {
  resourceKey(body?.requestId);
  if (typeof body.providerId !== 'string' || body.providerId.length > 128 || typeof body.prompt !== 'string'
      || !body.prompt.trim() || Buffer.byteLength(body.prompt) > 100000)
    throw resourceError('terms', 'Supply a bounded prompt and configured provider.');
  resourceInt(body.maxOutputTokens, 'output tokens', 1, 100000);
  const purpose = body.purpose || { kind: 'reasoning' };
  if (!purpose || Array.isArray(purpose) || typeof purpose.kind !== 'string'
      || JSON.stringify(purpose).length > 2048 || !['reasoning', 'game_decision', 'paid_market_analysis'].includes(purpose.kind))
    throw resourceError('purpose', 'Use an explicit, bounded reasoning purpose.');
  if (body.creditId !== undefined) resourceKey(body.creditId);
  return { requestId: body.requestId, providerId: body.providerId, prompt: body.prompt,
    maxOutputTokens: body.maxOutputTokens, purpose, creditId: body.creditId || null };
}

async function releaseCall(client, row, errorCode) {
  const cap = Number(row.cap_usd_micros);
  await moveResourceMoney(client, row.account_id, cap, -cap, 'compute_refund', `call:${row.id}:refund`);
  if (row.credit_id) await client.query("UPDATE resource_credits SET status='refunded' WHERE id=$1", [row.credit_id]);
  await client.query("UPDATE resource_calls SET status='failed',error_code=$2,cost_usd_micros=0,provider_cost_usd_micros=0,settled_at=now() WHERE id=$1", [row.id, errorCode]);
}
async function finishCall(pool, accountId, id, receipt) {
  return resourceTransaction(pool, async client => {
    await lockResourceTreasury(client, accountId);
    const row = (await client.query('SELECT * FROM resource_calls WHERE id=$1 AND account_id=$2 FOR UPDATE', [id, accountId])).rows[0];
    if (row.status === 'succeeded') return row;
    if (!['sending', 'unknown'].includes(row.status)) throw resourceError('state', 'The inference is not awaiting a receipt.');
    const cap = Number(row.cap_usd_micros), expense = resourceInt(receipt.costUsdMicros, 'provider expense', 0, cap);
    if (typeof receipt.output !== 'string' || Buffer.byteLength(receipt.output) > 1048576 || typeof receipt.providerRequestId !== 'string')
      throw resourceError('receipt', 'Provider receipt requires reconciliation.');
    const charged = row.credit_id ? cap : expense;
    await moveResourceMoney(client, accountId, cap - charged, -cap, 'compute_settle', `call:${id}:settle`);
    if (row.credit_id) await client.query("UPDATE resource_credits SET status='consumed' WHERE id=$1", [row.credit_id]);
    await client.query("UPDATE resource_calls SET status='succeeded',output=$2,provider_request_id=$3,cost_usd_micros=$4,provider_cost_usd_micros=$5,settled_at=now(),error_code=NULL WHERE id=$1",
      [id, receipt.output, receipt.providerRequestId, charged, expense]);
    return (await client.query('SELECT * FROM resource_calls WHERE id=$1', [id])).rows[0];
  });
}

export async function runResourceCompute(pool, accountId, body, { adapter = Providers, beforeReserve = null } = {}) {
  const terms = requestTerms(body), requestHash = digest(terms);
  const existing = (await pool.query('SELECT * FROM resource_calls WHERE account_id=$1 AND request_key=$2', [accountId, terms.requestId])).rows[0];
  if (existing && existing.request_hash !== requestHash) throw resourceError('conflict', 'This inference identifier already has different terms.');
  if (existing && existing.status !== 'reserved') return { resourceAction: 'compute', call: callView(existing) };
  resourceIntake();
  if (process.env.RESOURCE_COMPUTE_ENABLED !== 'on') throw resourceError('compute_disabled', 'External inference is disabled.');
  if (adapter === Providers && resourceMode() !== 'live') throw resourceError('test_funding', 'Test balances cannot purchase real inference.');
  const entry = currentEntry(adapter, terms.providerId);
  if (Buffer.byteLength(terms.prompt) + 1024 > entry.maxInputTokens)
    throw resourceError('prompt', 'The conservative input bound exceeds this capability.');
  const quote = resourceInt(adapter.quoteCompute(entry, { inputTokens: entry.maxInputTokens, maxOutputTokens: terms.maxOutputTokens }), 'maximum inference cost');
  let row = await resourceTransaction(pool, async client => {
    await lockResourceTreasury(client, accountId);
    const old = (await client.query('SELECT * FROM resource_calls WHERE account_id=$1 AND request_key=$2 FOR UPDATE', [accountId, terms.requestId])).rows[0];
    if (old) {
      if (old.request_hash !== requestHash) throw resourceError('conflict', 'This inference identifier already has different terms.');
      return old;
    }
    if (beforeReserve) await beforeReserve(client);
    let credit = null, cap = quote;
    if (terms.creditId) {
      credit = (await client.query("SELECT * FROM resource_credits WHERE id=$1 AND account_id=$2 AND status='unused' FOR UPDATE", [terms.creditId, accountId])).rows[0];
      if (!credit || credit.provider_id !== entry.id || new Date(credit.expires_at).getTime() <= Date.now()
          || digest(credit.config) !== digest(entry) || Number(credit.max_output_tokens) !== terms.maxOutputTokens || quote > Number(credit.price_usd_micros))
        throw resourceError('credit', 'No current, funded compute slot with these exact limits.');
      cap = Number(credit.price_usd_micros);
    } else {
      const scarce = (process.env.RESOURCE_SCARCE_PROVIDER_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
      if (scarce.includes(entry.id)) throw resourceError('slot', 'This capability requires a won compute slot.');
    }
    const policy = await authorizeResourceSpend(client, accountId, { providerId: entry.id, amountUsdMicros: cap,
      storedResponses: entry.storeResponses, held: !!credit });
    const id = crypto.randomUUID();
    if (credit) {
      await moveResourceMoney(client, accountId, 0, 0, 'credit_authority', `call:${id}:authority`, cap);
      await client.query("UPDATE resource_credits SET status='reserved' WHERE id=$1", [credit.id]);
    } else await moveResourceMoney(client, accountId, -cap, cap, 'compute_reserve', `call:${id}:reserve`);
    await client.query('INSERT INTO resource_calls(id,account_id,request_key,request_hash,provider_id,config,max_output_tokens,cap_usd_micros,policy_revision,purpose,credit_id,simulated) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      [id, accountId, terms.requestId, requestHash, entry.id, entry, terms.maxOutputTokens, cap, policy.revision, terms.purpose, credit?.id || null, adapter !== Providers]);
    return (await client.query('SELECT * FROM resource_calls WHERE id=$1', [id])).rows[0];
  });
  // A committed sending marker precedes network I/O. Concurrent/restarted callers
  // observe it; they never resend an inference whose billing outcome is unknown.
  const dispatch = await resourceTransaction(pool, async client => {
    const treasury = await lockResourceTreasury(client, accountId);
    row = (await client.query('SELECT * FROM resource_calls WHERE id=$1 FOR UPDATE', [row.id])).rows[0];
    if (row.status !== 'reserved') return false;
    const policy = (await client.query('SELECT * FROM resource_compute_policies WHERE account_id=$1 FOR UPDATE', [accountId])).rows[0];
    if (!resourceEnabled() || treasury.frozen || !policy?.enabled || policy.revision !== row.policy_revision
        || new Date(policy.expires_at).getTime() <= Date.now() || !policy.providers.includes(entry.id)
        || entry.storeResponses && !policy.allow_stored_responses || digest(currentEntry(adapter, entry.id)) !== digest(row.config)) {
      await releaseCall(client, row, 'authorization_changed');
      return false;
    }
    await client.query("UPDATE resource_calls SET status='sending',sent_at=now() WHERE id=$1", [row.id]);
    return true;
  });
  if (dispatch) {
    let receipt;
    try {
      receipt = await adapter.executeCompute(row.config, { prompt: terms.prompt, maxOutputTokens: terms.maxOutputTokens, requestId: row.id });
      row = await finishCall(pool, accountId, row.id, receipt);
    } catch (error) {
      row = await resourceTransaction(pool, async client => {
        await lockResourceTreasury(client, accountId);
        const current = (await client.query('SELECT * FROM resource_calls WHERE id=$1 FOR UPDATE', [row.id])).rows[0];
        if (current.status !== 'sending') return current;
        // Only explicit pre-dispatch/provider rejection proves zero cost. A DB
        // settlement failure after a response also stays reserved for recovery.
        if (error instanceof Providers.ResourceProviderError && error.ambiguous === false)
          await releaseCall(client, current, error.code);
        else await client.query("UPDATE resource_calls SET status='unknown',error_code=$2,provider_request_id=$3 WHERE id=$1", [row.id,
          typeof error.code === 'string' ? error.code.slice(0, 80) : 'ambiguous', receipt?.providerRequestId || error.providerRequestId || null]);
        return (await client.query('SELECT * FROM resource_calls WHERE id=$1', [row.id])).rows[0];
      });
    }
  } else row = (await pool.query('SELECT * FROM resource_calls WHERE id=$1', [row.id])).rows[0];
  return { resourceAction: 'compute', call: callView(row) };
}

export async function reconcileResourceCompute(pool, accountId, id, providerRequestId, { adapter = Providers } = {}) {
  const row = (await pool.query('SELECT * FROM resource_calls WHERE id=$1 AND account_id=$2', [id, accountId])).rows[0];
  if (!row) throw resourceError('call', 'No inference of yours by that identifier.');
  if (row.status === 'succeeded') return { resourceAction: 'compute', call: callView(row) };
  if (!['unknown', 'sending'].includes(row.status) || !row.config.storeResponses)
    throw resourceError('recovery', 'No retained provider response can settle this reservation.');
  const receipt = await adapter.fetchComputeReceipt(row.config, { providerRequestId: row.provider_request_id || providerRequestId,
    requestId: row.id, maxOutputTokens: Number(row.max_output_tokens) });
  const settled = await finishCall(pool, accountId, id, receipt);
  return { resourceAction: 'compute', call: callView(settled) };
}
export async function resourceComputeState(pool, accountId) {
  const calls = (await pool.query('SELECT * FROM resource_calls WHERE account_id=$1 ORDER BY created_at DESC LIMIT 100', [accountId])).rows.map(callView);
  const credits = (await pool.query('SELECT id,provider_id,max_output_tokens,price_usd_micros,status,expires_at FROM resource_credits WHERE account_id=$1 ORDER BY expires_at LIMIT 100', [accountId])).rows;
  return { calls, credits, measurement: 'Four-turn results are observational game-cash changes, not causal improvement or external USD profit.' };
}

export async function createResourceRound(pool, body, { adapter = Providers } = {}) {
  resourceIntake();
  const entry = currentEntry(adapter, body?.providerId);
  const capacity = resourceInt(body.capacity, 'capacity', 1, 100);
  const maximum = resourceInt(Number(process.env.RESOURCE_COMPUTE_DAILY_SLOTS || 0), 'configured daily capacity', 1, 1000);
  resourceInt(body.maxOutputTokens, 'output tokens', 1, entry.maxOutputTokens);
  const quote = adapter.quoteCompute(entry, { inputTokens: entry.maxInputTokens, maxOutputTokens: body.maxOutputTokens });
  const reserve = resourceInt(body.reserveUsdMicros, 'reserve price', Math.max(1, quote));
  resourceInt(body.commitSeconds, 'commit window', 60, 86400); resourceInt(body.revealSeconds, 'reveal window', 60, 86400);
  return resourceTransaction(pool, async client => {
    // The same allocator lock spans the empty-set case on native PostgreSQL.
    if (dbCaps.skipLocked) await client.query('SELECT pg_advisory_xact_lock(846113029)');
    const day = new Date(); day.setUTCHours(0, 0, 0, 0);
    const rounds = (await client.query('SELECT capacity FROM resource_rounds WHERE created_at >= $1', [day])).rows;
    if (rounds.reduce((n, row) => n + Number(row.capacity), 0) + capacity > maximum)
      throw resourceError('capacity', 'All configured daily compute slots have been allocated.');
    const id = crypto.randomUUID(), commitUntil = new Date(Date.now() + body.commitSeconds * 1000), revealUntil = new Date(commitUntil.getTime() + body.revealSeconds * 1000);
    await client.query('INSERT INTO resource_rounds(id,provider_id,config,max_output_tokens,capacity,reserve_usd_micros,commit_until,reveal_until) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, entry.id, entry, body.maxOutputTokens, capacity, reserve, commitUntil, revealUntil]);
    return { resourceAction: 'auction_round', round: (await client.query('SELECT * FROM resource_rounds WHERE id=$1', [id])).rows[0] };
  });
}
export async function commitResourceBid(pool, accountId, roundId, body) {
  resourceIntake(); resourceInt(body?.maximumUsdMicros, 'maximum bid');
  if (typeof body.commitment !== 'string' || !/^[a-f0-9]{64}$/.test(body.commitment)) throw resourceError('bid', 'Supply a sealed SHA256 bid commitment.');
  return resourceTransaction(pool, async client => {
    const round = (await client.query('SELECT * FROM resource_rounds WHERE id=$1 FOR UPDATE', [roundId])).rows[0];
    if (!round || round.status !== 'open' || Date.now() >= new Date(round.commit_until).getTime()) throw resourceError('phase', 'The commitment window is closed.');
    await lockResourceTreasury(client, accountId);
    const previous = (await client.query('SELECT * FROM resource_bids WHERE round_id=$1 AND account_id=$2 FOR UPDATE', [roundId, accountId])).rows[0];
    if (previous) {
      if (previous.commitment !== body.commitment || Number(previous.maximum_usd_micros) !== body.maximumUsdMicros)
        throw resourceError('conflict', 'This round already has different sealed terms of yours.');
      return { resourceAction: 'auction_bid', bidId: previous.id, status: previous.status };
    }
    const bidCount = (await client.query('SELECT COUNT(*) AS count FROM resource_bids WHERE round_id=$1', [roundId])).rows[0];
    if (Number(bidCount.count) >= 1000) throw resourceError('capacity', 'This round has reached its funded bidder limit.');
    const policy = await authorizeResourceSpend(client, accountId, { providerId: round.provider_id, amountUsdMicros: body.maximumUsdMicros,
      storedResponses: round.config.storeResponses });
    const id = crypto.randomUUID();
    await moveResourceMoney(client, accountId, -body.maximumUsdMicros, body.maximumUsdMicros, 'auction_reserve', `bid:${id}:reserve`);
    await client.query('INSERT INTO resource_bids(id,round_id,account_id,commitment,maximum_usd_micros,policy_revision) VALUES($1,$2,$3,$4,$5,$6)',
      [id, roundId, accountId, body.commitment, body.maximumUsdMicros, policy.revision]);
    return { resourceAction: 'auction_bid', bidId: id, status: 'sealed' };
  });
}
export async function revealResourceBid(pool, accountId, roundId, body) {
  return resourceTransaction(pool, async client => {
    const round = (await client.query('SELECT * FROM resource_rounds WHERE id=$1 FOR UPDATE', [roundId])).rows[0];
    if (!round || round.status !== 'open' || Date.now() < new Date(round.commit_until).getTime() || Date.now() >= new Date(round.reveal_until).getTime())
      throw resourceError('phase', 'The reveal window is not open.');
    const bid = (await client.query('SELECT * FROM resource_bids WHERE round_id=$1 AND account_id=$2 FOR UPDATE', [roundId, accountId])).rows[0];
    if (!bid || body.bidUsdMicros > Number(bid.maximum_usd_micros)
        || computeBidCommitment({ roundId, accountId, bidUsdMicros: body.bidUsdMicros, nonce: body.nonce }) !== bid.commitment)
      throw resourceError('bid', 'This reveal does not match your funded commitment.');
    if (bid.status === 'revealed' && Number(bid.bid_usd_micros) !== body.bidUsdMicros) throw resourceError('conflict', 'The revealed bid is immutable.');
    await client.query("UPDATE resource_bids SET status='revealed',bid_usd_micros=$2 WHERE id=$1", [bid.id, body.bidUsdMicros]);
    return { resourceAction: 'auction_reveal', bidId: bid.id, status: 'revealed' };
  });
}
export async function settleResourceRound(pool, roundId, { adapter = Providers } = {}) {
  return resourceTransaction(pool, async client => {
    const round = (await client.query('SELECT * FROM resource_rounds WHERE id=$1 FOR UPDATE', [roundId])).rows[0];
    if (!round) throw resourceError('round', 'No compute round by that identifier.');
    if (round.status === 'settled') return { resourceAction: 'auction_settlement', settlement: round.settlement };
    if (Date.now() < new Date(round.reveal_until).getTime()) throw resourceError('phase', 'The reveal window has not closed.');
    const bids = (await client.query('SELECT * FROM resource_bids WHERE round_id=$1', [roundId])).rows;
    await lockResourceTreasuries(client, bids.map(bid => bid.account_id));
    let fresh = false;
    try { fresh = digest(currentEntry(adapter, round.provider_id)) === digest(round.config); } catch { /* Refund stale capacity. */ }
    const eligible = [];
    for (const bid of bids) {
      const treasury = (await client.query('SELECT frozen FROM resource_treasuries WHERE account_id=$1', [bid.account_id])).rows[0];
      const policy = (await client.query('SELECT * FROM resource_compute_policies WHERE account_id=$1', [bid.account_id])).rows[0];
      if (fresh && !treasury.frozen && bid.status === 'revealed' && policy?.enabled && policy.revision === bid.policy_revision
          && new Date(policy.expires_at).getTime() > Date.now() && policy.providers.includes(round.provider_id))
        eligible.push({ accountId: bid.account_id, bidId: bid.id, bidUsdMicros: Number(bid.bid_usd_micros) });
    }
    const settlement = clearComputeAuction({ capacity: Number(round.capacity), reserveUsdMicros: Number(round.reserve_usd_micros), bids: eligible });
    for (const bid of bids) {
      const won = settlement.winners.find(winner => winner.bidId === bid.id), price = won?.priceUsdMicros || 0;
      const refund = Number(bid.maximum_usd_micros) - price;
      await moveResourceMoney(client, bid.account_id, refund, -refund, 'auction_release', `bid:${bid.id}:release`);
      await client.query('UPDATE resource_bids SET status=$2 WHERE id=$1', [bid.id, won ? 'won' : 'lost']);
      if (won) await client.query('INSERT INTO resource_credits(id,account_id,bid_id,provider_id,config,max_output_tokens,price_usd_micros,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [crypto.randomUUID(), bid.account_id, bid.id, round.provider_id, round.config, round.max_output_tokens, price, new Date(Date.now() + 86400000)]);
    }
    settlement.losers = bids.filter(bid => !settlement.winners.some(winner => winner.bidId === bid.id)).map(bid => bid.id);
    await client.query("UPDATE resource_rounds SET status='settled',settlement=$2 WHERE id=$1", [roundId, settlement]);
    return { resourceAction: 'auction_settlement', settlement };
  });
}
export async function resourceAuctionBoard(pool, accountId = null) {
  const rounds = (await pool.query('SELECT id,provider_id,max_output_tokens,capacity,reserve_usd_micros,commit_until,reveal_until,status,settlement FROM resource_rounds ORDER BY created_at DESC LIMIT 100')).rows;
  const ownBids = accountId ? (await pool.query('SELECT id,round_id,maximum_usd_micros,bid_usd_micros,status FROM resource_bids WHERE account_id=$1 ORDER BY created_at DESC LIMIT 100', [accountId])).rows : [];
  return { rounds, ownBids };
}
export async function sweepResourceCompute(pool) {
  const cutoff = new Date(Date.now() - 10 * 60000);
  const abandoned = (await pool.query("SELECT id,account_id FROM resource_calls WHERE status='reserved' AND created_at<=$1 ORDER BY created_at LIMIT 100", [cutoff])).rows;
  for (const call of abandoned) await resourceTransaction(pool, async client => {
    await lockResourceTreasury(client, call.account_id);
    const row = (await client.query("SELECT * FROM resource_calls WHERE id=$1 AND status='reserved' AND created_at<=$2 FOR UPDATE", [call.id, cutoff])).rows[0];
    if (row) await releaseCall(client, row, 'dispatch_expired');
  });
  const due = (await pool.query("SELECT id FROM resource_rounds WHERE status='open' AND reveal_until <= now() ORDER BY reveal_until LIMIT 25")).rows;
  for (const round of due) await settleResourceRound(pool, round.id);
  const credits = (await pool.query("SELECT id,account_id FROM resource_credits WHERE status='unused' AND expires_at<=now() ORDER BY expires_at LIMIT 100")).rows;
  for (const credit of credits) await resourceTransaction(pool, async client => {
    await lockResourceTreasury(client, credit.account_id);
    const row = (await client.query("SELECT * FROM resource_credits WHERE id=$1 AND status='unused' AND expires_at<=now() FOR UPDATE", [credit.id])).rows[0];
    if (!row) return;
    const price = Number(row.price_usd_micros);
    await moveResourceMoney(client, row.account_id, price, -price, 'credit_refund', `credit:${row.id}:expiry`);
    await client.query("UPDATE resource_credits SET status='refunded' WHERE id=$1", [row.id]);
  });
  return { rounds: due.length, credits: credits.length, abandonedCalls: abandoned.length };
}
