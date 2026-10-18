// Read-only original capital, canonical equipment-loss and immutable ACK oracle.
import { mutualStable as stable, mutualHash as hash, coveragePoolSource, coveragePolicyOfferSource, coverageMutualLossSource } from './coverage-mutual-sources.js';
const requireThat = (yes, reason) => { if (!yes) throw Error(reason); };
const same = (a, b, reason) => requireThat(stable(a) === stable(b), reason);
const numeric = v => Number.isSafeInteger(Number(v)) && Number(v) >= 0;

export async function coverageMutualAccounting(c) {
  const pools = (await c.query('SELECT * FROM coverage_mutual_pools ORDER BY id')).rows;
  const positions = (await c.query('SELECT * FROM coverage_mutual_positions ORDER BY pool_id,original_character')).rows;
  const enrollments = (await c.query('SELECT * FROM coverage_mutual_enrollments ORDER BY policy_id')).rows;
  const claims = (await c.query('SELECT * FROM coverage_mutual_claims ORDER BY policy_id')).rows;
  const requests = (await c.query('SELECT * FROM coverage_mutual_requests ORDER BY account_id,request_key')).rows;
  const journals = (await c.query("SELECT id,character_id,account_id,currency,amount,reason,counterparty FROM transactions WHERE reason LIKE 'coverage_mutual:%' ORDER BY id")).rows;
  const issues = [], bound = new Set();
  const { coverageMutualTerms, coverageMutualView } = await import('./coverage-mutual.js');
  const journal = (txId, character, account, amount, reason, poolId) => {
    const tx = journals.find(t => t.id === txId);
    requireThat(tx && !bound.has(txId) && tx.character_id === character && tx.account_id === account && tx.currency === 'cash'
      && Number(tx.amount) === amount && tx.reason === reason && tx.counterparty === poolId, 'mutual_journal_source'); bound.add(txId);
  };
  for (const p of pools) try {
    requireThat(p.source_hash === hash(coveragePoolSource(p)), 'mutual_pool_source');
    requireThat(p.creator_account !== p.partner_account && p.creator_character !== p.partner_character && p.creator_policy !== p.partner_policy, 'mutual_self_pool');
    requireThat(Number.isSafeInteger(Number(p.contribution_cash)) && Number(p.contribution_cash) >= 1 && Number(p.contribution_cash) <= 1000
      && Number.isSafeInteger(Number(p.deductible_cash)) && Number(p.deductible_cash) >= 1 && Number(p.deductible_cash) <= Number(p.contribution_cash), 'mutual_terms');
    requireThat(['offered', 'active', 'closed'].includes(p.state), 'mutual_state');
    const accounts = [p.creator_account, p.partner_account], originals = [p.creator_character, p.partner_character];
    const people = (await c.query('SELECT id,account_id,is_npc FROM characters WHERE id IN ($1,$2)', originals)).rows;
    for (let i = 0; i < 2; i++) requireThat(people.find(r => r.id === originals[i])?.account_id === accounts[i] && !people.find(r => r.id === originals[i]).is_npc, 'mutual_original');
    const own = positions.filter(r => r.pool_id === p.id), enrolled = enrollments.filter(r => r.pool_id === p.id), paid = claims.filter(r => r.pool_id === p.id);
    requireThat(own.length === (p.activated_at ? 2 : 1) && enrolled.length === (p.activated_at ? 2 : 0) && paid.length <= 2, 'mutual_bounds');
    const source = [];
    for (const [index, policyId] of [p.creator_policy, p.partner_policy].entries()) {
      const offer = await coveragePolicyOfferSource(c, policyId, accounts[index], originals[index]); source.push(offer.source);
      if (p.activated_at) {
        const e = enrolled.find(r => r.policy_id === policyId);
        requireThat(e && e.member_account === accounts[index] && e.member_character === originals[index]
          && e.source_hash === hash(e.source) && +new Date(e.enrolled_at) === +new Date(p.activated_at), 'mutual_enrollment');
        same(e.source, offer.source, 'mutual_enrollment_source');
      }
    }
    same(source, p.policy_sources, 'mutual_policy_source');
    requireThat(+new Date(p.offer_expires_at) === Math.min(+new Date(p.created_at) + 300000, ...source.map(x => +new Date(x.offerExpiresAt))), 'mutual_offer_time');
    const open = requests.filter(r => r.action === 'open' && r.account_id === p.creator_account && r.receipt.pool?.id === p.id);
    requireThat(open.length === 1 && open[0].identity.creatorPolicyId === p.creator_policy && open[0].identity.partnerPolicyId === p.partner_policy
      && open[0].identity.partnerCharacterId === p.partner_character && open[0].identity.contributionCash === Number(p.contribution_cash)
      && open[0].identity.deductibleCash === Number(p.deductible_cash) && open[0].receipt.pool.sourceHash === p.source_hash, 'mutual_open_ack');
    same(open[0].receipt, { pool: coverageMutualView({ ...p, state: 'offered', reserve_cash: p.contribution_cash, paid_cash: 0, refunded_cash: 0, activated_at: null, closed_at: null, close_reason: null }) }, 'mutual_open_receipt');
    if (p.activated_at) {
      const joined = requests.filter(r => r.action === 'join' && r.account_id === p.partner_account && r.identity.poolId === p.id);
      requireThat(joined.length === 1 && joined[0].identity.consent === true && joined[0].identity.sourceHash === p.source_hash
        && joined[0].identity.contributionCash === Number(p.contribution_cash) && joined[0].identity.deductibleCash === Number(p.deductible_cash)
        && joined[0].receipt.pool.state === 'active' && joined[0].receipt.pool.sourceHash === p.source_hash, 'mutual_join_ack');
      same(joined[0].receipt, { pool: coverageMutualView({ ...p, state: 'active', reserve_cash: 2 * Number(p.contribution_cash), paid_cash: 0, refunded_cash: 0, closed_at: null, close_reason: null }) }, 'mutual_join_receipt');
      requireThat(+new Date(p.activated_at) >= +new Date(p.created_at) && +new Date(p.activated_at) < +new Date(p.offer_expires_at), 'mutual_activation_time');
    } else requireThat(p.state !== 'active' && paid.length === 0, 'mutual_unfunded_authority');
    for (const position of own) {
      const at = originals.indexOf(position.original_character);
      requireThat(at >= 0 && position.original_account === accounts[at] && Number(position.contribution_cash) === Number(p.contribution_cash), 'mutual_position');
      journal(position.contribution_id, originals[at], accounts[at], -Number(position.contribution_cash), 'coverage_mutual:contribute', p.id);
      requireThat(numeric(position.refunded_cash) && Number(position.refunded_cash) <= Number(position.contribution_cash), 'mutual_refund_bound');
      if (p.state !== 'closed') requireThat(position.state === 'funded' && Number(position.refunded_cash) === 0 && !position.refund_id, 'mutual_live_position');
      else {
        requireThat(position.state === 'released', 'mutual_released_position');
        if (Number(position.refunded_cash)) journal(position.refund_id, originals[at], accounts[at], Number(position.refunded_cash), 'coverage_mutual:refund', p.id);
        else requireThat(!position.refund_id, 'mutual_zero_refund');
      }
    }
    for (const claim of paid) {
      const e = enrolled.find(r => r.policy_id === claim.policy_id); requireThat(e, 'mutual_claim_enrollment');
      const loss = await coverageMutualLossSource(c, p, e);
      requireThat(loss && loss.payout > 0 && claim.member_account === e.member_account && claim.member_character === e.member_character
        && Number(claim.payout_cash) === loss.payout && Number(claim.gross_payout_cash) === loss.source.grossPayoutCash
        && Number(claim.premium_cash) === loss.source.premiumCash && Number(claim.deductible_cash) === Number(p.deductible_cash)
        && claim.repair_id === loss.source.repairId && claim.wear_event_id === loss.source.wearEventId
        && claim.canonical_payout_id === loss.source.grossPayoutId && claim.source_hash === loss.hash, 'mutual_claim_source');
      same(claim.source, loss.source, 'mutual_claim_history');
      requireThat(+new Date(claim.created_at) >= +new Date(p.activated_at)
        && (!p.closed_at || +new Date(claim.created_at) <= +new Date(p.closed_at)), 'mutual_claim_time');
      journal(claim.payout_id, claim.member_character, claim.member_account, Number(claim.payout_cash), 'coverage_mutual:payout', p.id);
      const ack = requests.some(r => r.action === 'claim' && r.account_id === claim.member_account && r.identity.poolId === p.id
        && r.identity.policyId === claim.policy_id && r.receipt.claim?.payoutCash === Number(claim.payout_cash));
      requireThat(ack || p.closure?.settled?.some(r => r.policyId === claim.policy_id && r.payoutCash === Number(claim.payout_cash)), 'mutual_claim_ack');
    }
    const capital = own.reduce((n, r) => n + Number(r.contribution_cash), 0), benefit = paid.reduce((n, r) => n + Number(r.payout_cash), 0), refunded = own.reduce((n, r) => n + Number(r.refunded_cash), 0);
    requireThat([p.contributed_cash, p.reserve_cash, p.paid_cash, p.refunded_cash].every(numeric) && Number(p.contributed_cash) === capital
      && Number(p.paid_cash) === benefit && Number(p.refunded_cash) === refunded && capital === Number(p.reserve_cash) + benefit + refunded
      && benefit <= own.length * Number(p.contribution_cash), 'mutual_reserve_conservation');
    if (p.state === 'closed') {
      requireThat(Number(p.reserve_cash) === 0 && p.closure && p.closed_at && ['creator_cancelled', 'risk_resolved', 'member_death'].includes(p.close_reason), 'mutual_closure');
      const { hash: closeHash, ...closeSource } = p.closure;
      requireThat(closeHash === hash(closeSource) && closeSource.kind === 'coverage-mutual-close-v1' && closeSource.poolId === p.id
        && closeSource.reason === p.close_reason && +new Date(closeSource.closedAt) === +new Date(p.closed_at)
        && closeSource.reserveBeforeRefund === refunded && +new Date(p.closed_at) >= +new Date(p.activated_at || p.created_at)
        && (p.activated_at ? p.close_reason !== 'creator_cancelled' : p.close_reason !== 'risk_resolved'), 'mutual_closure_source');
      requireThat(Array.isArray(closeSource.settled) && closeSource.settled.length === paid.length
        && new Set(closeSource.settled.map(x => x.policyId)).size === paid.length, 'mutual_closure_settlements');
      for (const result of closeSource.settled) {
        const row = paid.find(x => x.policy_id === result.policyId); requireThat(row, 'mutual_closure_settlement');
        same(result, { policyId: row.policy_id, payoutCash: Number(row.payout_cash), grossPayoutCash: Number(row.gross_payout_cash),
          premiumCash: Number(row.premium_cash), deductibleCash: Number(row.deductible_cash), ...(result.alreadyPaid === true ? { alreadyPaid: true } : {}) }, 'mutual_closure_settlement');
      }
      same(closeSource.refunds, own.map(r => ({ originalCharacter: r.original_character, originalAccount: r.original_account,
        amount: Number(r.refunded_cash), refundId: r.refund_id ?? null })), 'mutual_refund_history');
      for (const [index, position] of own.entries()) requireThat(Number(position.refunded_cash) === (own.length === 1 ? refunded : Math.floor(refunded / 2) + (index === 0 ? refunded % 2 : 0)), 'mutual_refund_split');
      const closed = requests.filter(r => ['close', 'estate_close'].includes(r.action) && r.identity.poolId === p.id && r.receipt.closureHash === closeHash);
      requireThat(closed.length === 1 && closed[0].receipt.closed === true && closed[0].receipt.reason === p.close_reason, 'mutual_close_ack');
      same(closed[0].receipt, { poolId: p.id, closed: true, settled: closeSource.settled, refunds: closeSource.refunds, reason: p.close_reason, closureHash: closeHash }, 'mutual_close_ack');
      if (p.close_reason === 'member_death') requireThat(closed[0].action === 'estate_close' && originals.includes(closed[0].identity.victimCharacter)
        && closed[0].request_key === 'estate:' + p.id + ':' + closed[0].identity.victimCharacter
        && accounts[originals.indexOf(closed[0].identity.victimCharacter)] === closed[0].account_id, 'mutual_estate_ack');
      else requireThat(closed[0].action === 'close' && accounts.includes(closed[0].account_id), 'mutual_close_original');
      same(closed[0].identity, p.close_reason === 'member_death'
        ? { poolId: p.id, victimCharacter: closed[0].identity.victimCharacter, sourceHash: p.source_hash }
        : { poolId: p.id, sourceHash: p.source_hash, consent: true }, 'mutual_close_identity');
    } else requireThat(!p.closed_at && !p.close_reason && !p.closure, 'mutual_open_closure');
  } catch (error) { issues.push({ id: p.id, reason: error.reason || error.message || 'mutual_history' }); }
  for (const r of requests) try {
    requireThat(r.request_hash === hash([r.action, r.identity]), 'mutual_request_hash');
    const poolId = r.action === 'open' ? r.receipt.pool?.id : r.identity.poolId, p = pools.find(x => x.id === poolId);
    requireThat(p && [p.creator_account, p.partner_account].includes(r.account_id), 'mutual_request_original');
    if (r.action !== 'estate_close') {
      same(coverageMutualTerms(r.action, r.identity), r.identity, 'mutual_request_terms');
      requireThat(!r.request_key.startsWith('estate:'), 'mutual_reserved_key');
      if (r.action === 'claim') {
        const paid = claims.find(x => x.policy_id === r.identity.policyId && x.pool_id === p.id && x.member_account === r.account_id);
        requireThat(paid && r.identity.sourceHash === p.source_hash, 'mutual_claim_ack_source');
        same(r.receipt, { poolId: p.id, claim: { policyId: paid.policy_id, payoutCash: Number(paid.payout_cash), grossPayoutCash: Number(paid.gross_payout_cash), premiumCash: Number(paid.premium_cash), deductibleCash: Number(paid.deductible_cash), ...(r.receipt.claim?.alreadyPaid === true ? { alreadyPaid: true } : {}) } }, 'mutual_claim_receipt');
      }
    }
  } catch (error) { issues.push({ reason: error.reason || error.message, requestKey: r.request_key }); }
  for (const r of positions) if (!pools.some(p => p.id === r.pool_id)) issues.push({ reason: 'mutual_orphan_position' });
  for (const r of enrollments) if (!pools.some(p => p.id === r.pool_id)) issues.push({ reason: 'mutual_orphan_enrollment' });
  for (const r of claims) if (!enrollments.some(e => e.policy_id === r.policy_id && e.pool_id === r.pool_id)) issues.push({ reason: 'mutual_orphan_claim' });
  for (const t of journals) if (!bound.has(t.id)) issues.push({ reason: 'mutual_unbound_journal', transactionId: t.id });
  const funded = positions.filter(r => r.state === 'funded');
  if (new Set(funded.map(r => r.original_character)).size !== funded.length) issues.push({ reason: 'mutual_funded_position_limit' });
  const reserve = pools.reduce((n, r) => n + Number(r.reserve_cash), 0), ledgerDelta = journals.reduce((n, r) => n + Number(r.amount), 0);
  if (!Number.isSafeInteger(reserve) || !Number.isSafeInteger(ledgerDelta) || reserve + ledgerDelta !== 0) issues.push({ reason: 'mutual_global_conservation' });
  return { reserve, ledgerDelta, issues };
}
