import crypto from 'node:crypto';
import { ledger } from './game.js';
import { assertItemTransaction, registerItemTransactionUndo, poisonItemTransaction } from './items.js';
import { COVERAGE_MUTUAL, coverageMutualDDL } from './coverage-mutual-contracts.js';
import { mutualStable as stable, mutualHash as hash, mutualFailure as fail, coveragePoolSource,
  coveragePolicyOfferSource, coverageMutualLossSource } from './coverage-mutual-sources.js';
export { COVERAGE_MUTUAL, coverageMutualDDL };

const id = v => { if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(v)) fail('identity'); return v; };
const keyOf = v => { if (typeof v !== 'string' || !v.length || v.length > 200 || v.startsWith('estate:')) fail('request_key'); return v; };
const whole = (v, min, max) => { if (!Number.isSafeInteger(v) || v < min || v > max) fail('terms'); return v; };
const clock = async c => +new Date((await c.query('SELECT clock_timestamp() AS at')).rows[0].at);
const closed = (b, names) => { if (!b || Array.isArray(b) || Object.keys(b).sort().join(',') !== names) fail('terms'); };

export function coverageMutualTerms(action, b) {
  if (action === 'open') {
    closed(b, 'consent,contributionCash,creatorPolicyId,deductibleCash,partnerCharacterId,partnerPolicyId');
    const t = { partnerCharacterId: id(b.partnerCharacterId), creatorPolicyId: id(b.creatorPolicyId), partnerPolicyId: id(b.partnerPolicyId),
      contributionCash: whole(b.contributionCash, 1, 1000), deductibleCash: whole(b.deductibleCash, 1, b.contributionCash), consent: b.consent };
    if (t.creatorPolicyId === t.partnerPolicyId || t.consent !== true) fail('terms'); return t;
  }
  const names = { join: 'consent,contributionCash,deductibleCash,poolId,sourceHash', claim: 'consent,policyId,poolId,sourceHash', close: 'consent,poolId,sourceHash' };
  if (!Object.hasOwn(names, action)) fail('action'); closed(b, names[action]);
  if (b.consent !== true || typeof b.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(b.sourceHash)) fail('terms');
  return { poolId: id(b.poolId), sourceHash: b.sourceHash, consent: true,
    ...(action === 'join' ? { contributionCash: whole(b.contributionCash, 1, 1000), deductibleCash: whole(b.deductibleCash, 1, b.contributionCash) } : {}),
    ...(action === 'claim' ? { policyId: id(b.policyId) } : {}) };
}

async function replay(c, account, action, terms, key) {
  const r = (await c.query('SELECT * FROM coverage_mutual_requests WHERE account_id=$1 AND request_key=$2', [account, key])).rows[0];
  if (!r) return null;
  if (r.action !== action || r.request_hash !== hash([action, terms]) || stable(r.identity) !== stable(terms)) fail('request_conflict');
  return { ...r.receipt, replayed: true };
}
async function save(c, account, action, terms, key, receipt) {
  registerItemTransactionUndo(c, () => c.query('DELETE FROM coverage_mutual_requests WHERE account_id=$1 AND request_key=$2', [account, key]));
  await c.query('INSERT INTO coverage_mutual_requests(account_id,request_key,action,identity,request_hash,receipt) VALUES($1,$2,$3,$4,$5,$6)',
    [account, key, action, terms, hash([action, terms]), receipt]); return receipt;
}
async function actor(c, account) {
  const rows = (await c.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2', [id(account)])).rows;
  if (rows.length !== 1) fail('original_actor'); return rows[0].id;
}
async function lockOriginals(c, characters, recovery = false) {
  const ids = [...new Set(characters.map(id))].sort(); if (ids.length < 1 || ids.length > 2) fail('original_limit');
  const rows = [];
  for (const original of ids) {
    const r = (await c.query('SELECT id,account_id,alive,is_npc,cash FROM characters WHERE id=$1 FOR UPDATE', [original])).rows[0];
    if (!r || !r.alive || r.is_npc) fail('original_actor'); rows.push(r);
  }
  for (const account of [...new Set(rows.map(r => r.account_id))].sort()) {
    const a = (await c.query('SELECT id,status FROM accounts WHERE id=$1 FOR UPDATE', [account])).rows[0];
    if (!a || (!recovery && a.status !== 'active')) fail('original_actor');
  }
  if (!recovery) for (const r of rows) if (await actor(c, r.account_id) !== r.id) fail('original_actor');
  return rows;
}
async function money(c, ch, amount, reason, poolId) {
  const old = (await c.query('SELECT cash,account_id,alive FROM characters WHERE id=$1', [ch.id])).rows[0];
  const next = Number(old?.cash) + amount;
  if (!old?.alive || old.account_id !== ch.account_id || !Number.isSafeInteger(next) || next < 0) fail('capital');
  registerItemTransactionUndo(c, () => c.query('UPDATE characters SET cash=$2 WHERE id=$1', [ch.id, old.cash]));
  const tx = await ledger(c, { characterId: ch.id, accountId: ch.account_id, currency: 'cash', amount, reason, counterparty: poolId },
    { beforeInsert: txId => registerItemTransactionUndo(c, () => c.query('DELETE FROM transactions WHERE id=$1', [txId])) });
  await c.query('UPDATE characters SET cash=$2 WHERE id=$1', [ch.id, next]); return tx;
}
async function rememberPool(c, p) {
  registerItemTransactionUndo(c, () => c.query('UPDATE coverage_mutual_pools SET state=$2,activated_at=$3,closed_at=$4,close_reason=$5,contributed_cash=$6,reserve_cash=$7,paid_cash=$8,refunded_cash=$9,closure=$10 WHERE id=$1',
    [p.id, p.state, p.activated_at, p.closed_at, p.close_reason, p.contributed_cash, p.reserve_cash, p.paid_cash, p.refunded_cash, p.closure]));
}
async function pool(c, poolId) {
  const p = (await c.query('SELECT * FROM coverage_mutual_pools WHERE id=$1 FOR UPDATE', [id(poolId)])).rows[0];
  if (!p || p.source_hash !== hash(coveragePoolSource(p))) fail('pool_source'); return p;
}
async function positions(c, p) { return (await c.query('SELECT * FROM coverage_mutual_positions WHERE pool_id=$1 ORDER BY original_character', [p.id])).rows; }
async function capacity(c, original) {
  if ((await c.query("SELECT pool_id FROM coverage_mutual_positions WHERE original_character=$1 AND state='funded'", [original])).rows.length) fail('funded_position_limit');
}
async function addPosition(c, p, ch) {
  await capacity(c, ch.id);
  const tx = await money(c, ch, -Number(p.contribution_cash), 'coverage_mutual:contribute', p.id);
  registerItemTransactionUndo(c, () => c.query('DELETE FROM coverage_mutual_positions WHERE pool_id=$1 AND original_character=$2', [p.id, ch.id]));
  await c.query("INSERT INTO coverage_mutual_positions(pool_id,original_account,original_character,contribution_cash,contribution_id,state,refunded_cash) VALUES($1,$2,$3,$4,$5,'funded',0)",
    [p.id, ch.account_id, ch.id, p.contribution_cash, tx]);
}
async function policyLocks(c, p) { for (const policyId of [p.creator_policy, p.partner_policy].sort()) await c.query('SELECT id FROM equipment_insurance_policies WHERE id=$1 FOR UPDATE', [policyId]); }
async function offeredSources(c, p, at) {
  const pairs = [[p.creator_policy, p.creator_account, p.creator_character], [p.partner_policy, p.partner_account, p.partner_character]];
  const found = [];
  for (const [policyId, account, ch] of pairs) found.push(await coveragePolicyOfferSource(c, policyId, account, ch, at));
  if (p.policy_sources && stable(found.map(x => x.source)) !== stable(p.policy_sources)) fail('policy_source_changed');
  return found;
}
async function books(c) {
  const { coverageMutualAccounting } = await import('./coverage-mutual-invariants.js');
  const result = await coverageMutualAccounting(c);
  if (result.issues.length) throw Object.assign(new Error('mutual_history', { cause: result.issues }), { code: 'coverage_mutual', reason: 'mutual_history' });
}
export function coverageMutualView(p) { return { id: p.id, state: p.state, sourceHash: p.source_hash, creatorCharacterId: p.creator_character,
  partnerCharacterId: p.partner_character, creatorPolicyId: p.creator_policy, partnerPolicyId: p.partner_policy,
  contributionCash: Number(p.contribution_cash), deductibleCash: Number(p.deductible_cash), maximumBenefitCashPerMember: Number(p.contribution_cash),
  reserveCash: Number(p.reserve_cash), paidCash: Number(p.paid_cash), refundedCash: Number(p.refunded_cash),
  offerExpiresAt: new Date(p.offer_expires_at).toISOString(), activatedAt: p.activated_at ? new Date(p.activated_at).toISOString() : null,
  closedAt: p.closed_at ? new Date(p.closed_at).toISOString() : null, closeReason: p.close_reason ?? null, product: COVERAGE_MUTUAL.product }; }

async function perform(c, account, action, body, key, execute) {
  assertItemTransaction(c);
  try {
    id(account); keyOf(key); const terms = coverageMutualTerms(action, body), old = await replay(c, account, action, terms, key); if (old) return old;
    const result = await execute(terms); if (result.replayed) return result.receipt;
    const receipt = await save(c, account, action, terms, key, result.receipt);
    await books(c);
    if (result.check) await result.check();
    return receipt;
  } catch (error) { poisonItemTransaction(c, error); throw error; }
}

export async function openCoverageMutual(c, account, body, key) {
  return perform(c, account, 'open', body, key, async t => {
    const own = await actor(c, account); if (own === t.partnerCharacterId) fail('self_pool');
    const actors = await lockOriginals(c, [own, t.partnerCharacterId]), creator = actors.find(r => r.id === own), partner = actors.find(r => r.id === t.partnerCharacterId);
    if (creator.account_id !== account || creator.account_id === partner.account_id) fail('self_pool');
    const old = await replay(c, account, 'open', t, key); if (old) return { receipt: old, replayed: true };
    await capacity(c, own);
    const p = { id: crypto.randomUUID(), creator_account: account, creator_character: own, partner_account: partner.account_id, partner_character: partner.id,
      creator_policy: t.creatorPolicyId, partner_policy: t.partnerPolicyId, contribution_cash: t.contributionCash, deductible_cash: t.deductibleCash };
    await policyLocks(c, p); const now = await clock(c), sources = await offeredSources(c, p, now);
    p.policy_sources = sources.map(x => x.source); p.created_at = new Date(now);
    p.offer_expires_at = new Date(Math.min(now + COVERAGE_MUTUAL.invitationSeconds * 1000, ...sources.map(x => +new Date(x.policy.offer_expires_at))));
    p.source_hash = hash(coveragePoolSource(p)); p.state = 'offered'; p.reserve_cash = t.contributionCash; p.paid_cash = 0; p.refunded_cash = 0;
    registerItemTransactionUndo(c, () => c.query('DELETE FROM coverage_mutual_pools WHERE id=$1', [p.id]));
    await c.query("INSERT INTO coverage_mutual_pools(id,creator_account,creator_character,partner_account,partner_character,contribution_cash,deductible_cash,creator_policy,partner_policy,policy_sources,source_hash,state,created_at,offer_expires_at,contributed_cash,reserve_cash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'offered',$12,$13,$6,$6)",
      [p.id, account, own, partner.account_id, partner.id, t.contributionCash, t.deductibleCash, p.creator_policy, p.partner_policy, JSON.stringify(p.policy_sources), p.source_hash, p.created_at, p.offer_expires_at]);
    await addPosition(c, p, creator);
    return { receipt: { pool: coverageMutualView(p) }, check: async () => { if (await clock(c) >= +p.offer_expires_at) fail('invitation_expired'); await offeredSources(c, p, await clock(c)); } };
  });
}

async function actionPool(c, account, t, recovery = false) {
  const hint = (await c.query('SELECT creator_character,partner_character,creator_account,partner_account FROM coverage_mutual_pools WHERE id=$1', [t.poolId])).rows[0];
  if (!hint || ![hint.creator_account, hint.partner_account].includes(account)) fail('pool_private');
  const actors = await lockOriginals(c, [hint.creator_character, hint.partner_character], recovery), p = await pool(c, t.poolId);
  if (p.source_hash !== t.sourceHash || actors.find(r => r.id === p.creator_character)?.account_id !== p.creator_account
    || actors.find(r => r.id === p.partner_character)?.account_id !== p.partner_account) fail('pool_source');
  await policyLocks(c, p); return { p, actors };
}
export async function joinCoverageMutual(c, account, body, key) {
  return perform(c, account, 'join', body, key, async t => {
    const { p, actors } = await actionPool(c, account, t);
    const old = await replay(c, account, 'join', t, key); if (old) return { receipt: old, replayed: true };
    if (p.state !== 'offered' || p.partner_account !== account || Number(p.contribution_cash) !== t.contributionCash || Number(p.deductible_cash) !== t.deductibleCash) fail('join_consent');
    const now = await clock(c); if (now >= +new Date(p.offer_expires_at)) fail('invitation_expired');
    const source = await offeredSources(c, p, now);
    await addPosition(c, p, actors.find(r => r.id === p.partner_character));
    await rememberPool(c, p);
    for (const [index, [policyId, memberAccount, memberCharacter]] of [[p.creator_policy, p.creator_account, p.creator_character], [p.partner_policy, p.partner_account, p.partner_character]].entries()) {
      if ((await c.query('SELECT policy_id FROM coverage_mutual_enrollments WHERE policy_id=$1', [policyId])).rows.length) fail('policy_already_enrolled');
      registerItemTransactionUndo(c, () => c.query('DELETE FROM coverage_mutual_enrollments WHERE policy_id=$1', [policyId]));
      await c.query('INSERT INTO coverage_mutual_enrollments(policy_id,pool_id,member_account,member_character,source,source_hash,enrolled_at) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [policyId, p.id, memberAccount, memberCharacter, source[index].source, source[index].hash, new Date(now)]);
    }
    await c.query("UPDATE coverage_mutual_pools SET state='active',activated_at=$2,contributed_cash=$3,reserve_cash=$3 WHERE id=$1", [p.id, new Date(now), 2 * Number(p.contribution_cash)]);
    const updated = await pool(c, p.id);
    return { receipt: { pool: coverageMutualView(updated) }, check: async () => { const fresh = await clock(c); if (fresh >= +new Date(p.offer_expires_at)) fail('invitation_expired'); await offeredSources(c, p, fresh); } };
  });
}

async function payClaim(c, p, enrollment, actors) {
  const existing = (await c.query('SELECT * FROM coverage_mutual_claims WHERE policy_id=$1', [enrollment.policy_id])).rows[0];
  if (existing) return { policyId: existing.policy_id, payoutCash: Number(existing.payout_cash), grossPayoutCash: Number(existing.gross_payout_cash),
    premiumCash: Number(existing.premium_cash), deductibleCash: Number(existing.deductible_cash), alreadyPaid: true };
  const loss = await coverageMutualLossSource(c, p, enrollment);
  if (!loss || loss.payout <= 0) return null;
  if (p.state !== 'active' || Number(p.reserve_cash) < loss.payout) fail('mutual_reserve');
  const member = actors.find(r => r.id === enrollment.member_character && r.account_id === enrollment.member_account); if (!member) fail('original_actor');
  const payoutId = await money(c, member, loss.payout, 'coverage_mutual:payout', p.id), now = await clock(c);
  registerItemTransactionUndo(c, () => c.query('DELETE FROM coverage_mutual_claims WHERE policy_id=$1', [enrollment.policy_id]));
  await c.query('INSERT INTO coverage_mutual_claims(policy_id,pool_id,repair_id,wear_event_id,canonical_payout_id,member_account,member_character,gross_payout_cash,premium_cash,deductible_cash,payout_cash,payout_id,source,source_hash,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',
    [enrollment.policy_id, p.id, loss.claim.repair_id, loss.claim.wear_event_id, loss.claim.payout_id, member.account_id, member.id,
      loss.source.grossPayoutCash, loss.source.premiumCash, p.deductible_cash, loss.payout, payoutId, loss.source, loss.hash, new Date(now)]);
  await rememberPool(c, p); await c.query('UPDATE coverage_mutual_pools SET reserve_cash=$2,paid_cash=$3 WHERE id=$1', [p.id, Number(p.reserve_cash) - loss.payout, Number(p.paid_cash) + loss.payout]);
  return { policyId: enrollment.policy_id, payoutCash: loss.payout, grossPayoutCash: loss.source.grossPayoutCash, premiumCash: loss.source.premiumCash, deductibleCash: Number(p.deductible_cash) };
}
export async function claimCoverageMutual(c, account, body, key) {
  return perform(c, account, 'claim', body, key, async t => {
    const { p, actors } = await actionPool(c, account, t);
    const old = await replay(c, account, 'claim', t, key); if (old) return { receipt: old, replayed: true };
    if (p.state !== 'active') fail('pool_state');
    const enrolled = (await c.query('SELECT * FROM coverage_mutual_enrollments WHERE policy_id=$1 AND pool_id=$2', [t.policyId, p.id])).rows[0];
    if (!enrolled || enrolled.member_account !== account) fail('member_policy');
    const paid = await payClaim(c, p, enrolled, actors); if (!paid) fail('no_net_loss');
    return { receipt: { poolId: p.id, claim: paid } };
  });
}

async function finishPool(c, p, actors, reason) {
  if (!['offered', 'active'].includes(p.state)) fail('pool_state');
  const enrolled = (await c.query('SELECT * FROM coverage_mutual_enrollments WHERE pool_id=$1 ORDER BY policy_id', [p.id])).rows;
  if (p.state === 'active' && enrolled.length !== 2) fail('enrollment_history');
  const settled = [];
  for (const e of enrolled) {
    const loss = await coverageMutualLossSource(c, p, e);
    const policy = (await c.query('SELECT * FROM equipment_insurance_policies WHERE id=$1', [e.policy_id])).rows[0];
    if (reason !== 'member_death' && !['claimed', 'closed'].includes(policy.state)) {
      const end = policy.state === 'offered' ? policy.offer_expires_at : policy.expires_at;
      if (!end || +new Date(end) > await clock(c)) fail('live_underwriting_obligation');
    }
    if (loss?.payout > 0) { const paid = await payClaim(c, await pool(c, p.id), e, actors); if (paid) settled.push(paid); }
  }
  const current = await pool(c, p.id), held = await positions(c, current);
  if (held.length !== (p.state === 'offered' ? 1 : 2)) fail('position_history');
  const reserve = Number(current.reserve_cash), refunds = [];
  for (const [index, position] of held.entries()) {
    const amount = held.length === 1 ? reserve : Math.floor(reserve / 2) + (index === 0 ? reserve % 2 : 0);
    const original = actors.find(r => r.id === position.original_character && r.account_id === position.original_account); if (!original) fail('original_actor');
    const refundId = amount ? await money(c, original, amount, 'coverage_mutual:refund', p.id) : null;
    registerItemTransactionUndo(c, () => c.query('UPDATE coverage_mutual_positions SET state=$3,refunded_cash=$4,refund_id=$5 WHERE pool_id=$1 AND original_character=$2',
      [p.id, original.id, position.state, position.refunded_cash, position.refund_id]));
    await c.query("UPDATE coverage_mutual_positions SET state='released',refunded_cash=$3,refund_id=$4 WHERE pool_id=$1 AND original_character=$2", [p.id, original.id, amount, refundId]);
    refunds.push({ originalCharacter: original.id, originalAccount: original.account_id, amount, refundId });
  }
  const now = new Date(await clock(c)), closure = { kind: 'coverage-mutual-close-v1', poolId: p.id, reason, closedAt: now.toISOString(),
    reserveBeforeRefund: reserve, settled, refunds };
  await rememberPool(c, current);
  await c.query("UPDATE coverage_mutual_pools SET state='closed',reserve_cash=0,refunded_cash=$2,closed_at=$3,close_reason=$4,closure=$5 WHERE id=$1", [p.id, Number(current.refunded_cash) + reserve, now, reason, { ...closure, hash: hash(closure) }]);
  return { poolId: p.id, closed: true, settled, refunds, reason, closureHash: hash(closure) };
}
export async function closeCoverageMutual(c, account, body, key) {
  return perform(c, account, 'close', body, key, async t => {
    const hint = (await c.query('SELECT * FROM coverage_mutual_pools WHERE id=$1', [t.poolId])).rows[0];
    if (!hint || ![hint.creator_account, hint.partner_account].includes(account)) fail('pool_private');
    // An unconsenting or retired invitee cannot strand the sole funded creator.
    if (hint.state === 'offered') {
      if (account !== hint.creator_account) fail('creator_recovery');
      const actors = await lockOriginals(c, [hint.creator_character]), p = await pool(c, t.poolId);
      if (p.source_hash !== t.sourceHash || actors[0].account_id !== account) fail('pool_source');
      const old = await replay(c, account, 'close', t, key); if (old) return { receipt: old, replayed: true };
      return { receipt: await finishPool(c, p, actors, 'creator_cancelled') };
    }
    const { p, actors } = await actionPool(c, account, t), old = await replay(c, account, 'close', t, key); if (old) return { receipt: old, replayed: true };
    return { receipt: await finishPool(c, p, actors, 'risk_resolved') };
  });
}

export async function coverageMutualBoard(c, account) {
  id(account); const rows = (await c.query('SELECT * FROM coverage_mutual_pools WHERE creator_account=$1 OR partner_account=$1 ORDER BY created_at DESC,id LIMIT 50', [account])).rows;
  return { pools: rows.map(coverageMutualView), product: COVERAGE_MUTUAL.product };
}

export async function coverageMutualDeathCounterparts(c, characterId) {
  const rows = (await c.query("SELECT * FROM coverage_mutual_positions WHERE original_character=$1 AND state='funded'", [id(characterId)])).rows;
  if (rows.length > 1) fail('funded_position_limit'); const result = new Set();
  for (const position of rows) {
    const p = (await c.query('SELECT * FROM coverage_mutual_pools WHERE id=$1', [position.pool_id])).rows[0];
    if (!p || p.source_hash !== hash(coveragePoolSource(p)) || ![p.creator_character, p.partner_character].includes(characterId)) fail('pool_source');
    if (p.state === 'active') { for (const other of [p.creator_character, p.partner_character]) if (other !== characterId) result.add(other); }
    else if (p.state !== 'offered' || p.creator_character !== characterId) fail('position_history');
  }
  if (result.size > 1) fail('counterpart_limit'); return [...result];
}

export async function recoverCoverageMutualsAtEstateStart(c, victim, h, { killerCh } = {}) {
  assertItemTransaction(c);
  try {
    const { assertEstateResolutionScope } = await import('./social/estate.js');
    const { assertEquipmentRentalDeathScope } = await import('./equipmentrentals.js');
    await assertEstateResolutionScope(c, victim.id, h?.estateResolutionScope);
    const scope = await assertEquipmentRentalDeathScope(c, victim.id, h?.rentalDeathScope);
    const rows = (await c.query("SELECT * FROM coverage_mutual_positions WHERE original_character=$1 AND state='funded'", [victim.id])).rows;
    if (rows.length > 1) fail('funded_position_limit');
    for (const position of rows) {
      const p = await pool(c, position.pool_id), chars = p.state === 'offered' ? [p.creator_character] : [p.creator_character, p.partner_character];
      for (const original of chars) if (!scope.ids.has(original)) fail('estate_prelock');
      const actors = await lockOriginals(c, chars, true), before = new Map(actors.map(r => [r.id, Number(r.cash)]));
      await policyLocks(c, p); const closed = await finishPool(c, p, actors, 'member_death');
      await save(c, victim.account_id, 'estate_close', { poolId: p.id, victimCharacter: victim.id, sourceHash: p.source_hash }, 'estate:' + p.id + ':' + victim.id, closed);
      for (const object of new Set([victim, h.actorCh, killerCh].filter(Boolean))) if (before.has(object.id)) {
        const now = Number((await c.query('SELECT cash FROM characters WHERE id=$1', [object.id])).rows[0].cash), delta = now - before.get(object.id), old = Number(object.cash);
        registerItemTransactionUndo(c, () => { object.cash = old; }); object.cash = old + delta;
      }
    }
    await books(c);
  } catch (error) { poisonItemTransaction(c, error); throw error; }
}
