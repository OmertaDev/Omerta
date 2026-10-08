import crypto from 'node:crypto';
import { GameError } from './game.js';

export async function latestPolicy(client, depotId, lock = false) {
  return (await client.query(`SELECT * FROM business_operating_policies WHERE depot_id=$1 ORDER BY revision DESC LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [depotId])).rows[0] || null;
}
export const policyLive = (policy) => !!policy?.enabled && new Date(policy.expires_at).getTime() > Date.now();
export function policyTermsMatch(policy, depot) {
  return ['bid_price', 'target_stock', 'reorder_at', 'restock_budget'].every((field) =>
    Number(depot[field]) === Number(policy[field === 'restock_budget' ? 'order_budget' : field]));
}
export function policyView(policy) {
  if (!policy) return null;
  return { id: policy.id, revision: Number(policy.revision), enabled: policyLive(policy),
    allowRestock: policy.allow_restock, allowReceive: policy.allow_receive, businessPriority: policy.business_priority,
    maxSpend: Number(policy.max_spend), spent: Number(policy.spent), remainingSpend: Number(policy.max_spend) - Number(policy.spent),
    reserveCash: Number(policy.reserve_cash), expiresAt: new Date(policy.expires_at).toISOString() };
}
export async function requirePolicy(client, depot, policyId, duty) {
  const policy = await latestPolicy(client, depot.id, true);
  if (!policyLive(policy) || policy.id !== policyId || !policy[duty === 'restock' ? 'allow_restock' : 'allow_receive'])
    throw new GameError('operating_policy', 'This duty requires the current, unexpired owner authorization.');
  if (duty === 'restock' && !policyTermsMatch(policy, depot))
    throw new GameError('policy_terms_changed', 'Owner terms changed; authorize a new policy before automated procurement.');
  return policy;
}
export async function setOperatingPolicy(ch, depotId, body, client) {
  const depot = (await client.query("SELECT * FROM business_depots WHERE id=$1 AND owner_character=$2 AND status='open' FOR UPDATE", [depotId, ch.id])).rows[0];
  if (!depot) throw new GameError('not_yours', 'No open business of yours.');
  const previous = await latestPolicy(client, depotId, true);
  if (body?.expectedRevision !== Number(previous?.revision || 0)) throw new GameError('policy_revision', 'Refresh the current policy revision before changing authority.');
  if (!['enabled', 'allowRestock', 'allowReceive', 'businessPriority'].every((key) => typeof body[key] === 'boolean')
      || !Number.isSafeInteger(body.maxSpend) || body.maxSpend < 0 || body.maxSpend > 100000000
      || !Number.isSafeInteger(body.reserveCash) || body.reserveCash < 1000 || body.reserveCash > 100000000
      || !Number.isSafeInteger(body.expiresInSeconds) || body.expiresInSeconds < 60 || body.expiresInSeconds > 604800)
    throw new GameError('policy_terms', 'Provide explicit boolean duties, bounded spending, a reserve of at least $1,000 and a 1-minute–7-day expiry.');
  const id = crypto.randomUUID(), revision = Number(previous?.revision || 0) + 1;
  if (previous) await client.query('UPDATE business_operating_policies SET enabled=false WHERE id=$1', [previous.id]);
  await client.query('INSERT INTO business_operating_policies (id,depot_id,revision,enabled,allow_restock,allow_receive,business_priority,max_spend,reserve_cash,bid_price,target_stock,reorder_at,order_budget,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
    [id, depotId, revision, body.enabled, body.allowRestock, body.allowReceive, body.businessPriority,
      body.maxSpend, body.reserveCash, depot.bid_price, depot.target_stock, depot.reorder_at, depot.restock_budget,
      new Date(Date.now() + body.expiresInSeconds * 1000)]);
  return { ok: true, policy: policyView(await latestPolicy(client, depotId)) };
}
export async function guardDelegatedControl(client, id, agentCredential) {
  if (agentCredential && await latestPolicy(client, id)) throw new GameError('owner_authority', 'Operating-policy limits and capital controls require the owner session, not its agent key.');
}
export async function recordExternalCost(ch, depotId, body, client) {
  const depot = (await client.query("SELECT id FROM business_depots WHERE id=$1 AND owner_character=$2 AND status='open' FOR UPDATE", [depotId, ch.id])).rows[0];
  if (!depot) throw new GameError('not_yours', 'No open business of yours.');
  if (!Number.isSafeInteger(body?.usdMicros) || body.usdMicros < 1 || body.usdMicros > 100000000000
      || !['inference', 'hosting', 'other'].includes(body.category)) throw new GameError('external_cost', 'Record bounded USD micro-units and category inference, hosting or other.');
  const id = crypto.randomUUID();
  await client.query('INSERT INTO business_external_costs (id,depot_id,usd_micros,category) VALUES ($1,$2,$3,$4)', [id, depotId, body.usdMicros, body.category]);
  return { ok: true, id, gameCashDebited: 0 };
}
