import crypto from 'node:crypto';
import { GameError } from './game.js';
import * as Depot from './depot.js';
import { latestPolicy, policyLive, policyTermsMatch } from './operatingpolicy.js';
import { latestSupplyContract } from './supplycontracts.js';

const fail = (code, message) => { throw new GameError(code, message); };
const keys = (body, allowed) => {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !allowed.includes(key)))
    fail('operator_terms', 'Provide only the documented operator fields.');
};
async function lockDepot(ch, id, client) {
  return (await client.query('SELECT * FROM business_depots WHERE id=$1 AND owner_character=$2 FOR UPDATE', [id, ch.id])).rows[0];
}
function eligible(ch, depot, policy, operator = null) {
  if (!ch.alive || !ch.account_id || ch.is_npc || !depot || depot.status !== 'open')
    fail('operator_owner', 'An operator requires its original living business owner.');
  if (!policyLive(policy) || !policyTermsMatch(policy, depot)
      || (operator && (!operator.enabled || operator.owner_account !== ch.account_id
        || operator.policy_id !== policy.id || Number(operator.policy_revision) !== Number(policy.revision))))
    fail('operator_policy', 'Enroll the current unexpired policy and unchanged business terms.');
}

export async function setCompanyOperator(ch, body, client) {
  keys(body, ['depotId', 'policyId', 'expectedRevision', 'enabled']);
  if (typeof body.depotId !== 'string' || typeof body.policyId !== 'string'
      || typeof body.enabled !== 'boolean' || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0 || body.expectedRevision >= Number.MAX_SAFE_INTEGER)
    fail('operator_terms', 'Specify depotId, policyId, enabled and the current operator revision.');
  const depot = await lockDepot(ch, body.depotId, client);
  const policy = await latestPolicy(client, body.depotId, true);
  const previous = (await client.query('SELECT * FROM company_operators WHERE depot_id=$1 FOR UPDATE', [body.depotId])).rows[0];
  if (Number(previous?.revision || 0) !== body.expectedRevision) fail('operator_revision', 'Refresh the operator revision.');
  if (!ch.alive || !depot || depot.status !== 'open' || (previous && previous.owner_account !== ch.account_id))
    fail('operator_owner', 'Only the original living business owner can enroll this operator.');
  if (body.enabled) {
    eligible(ch, depot, policy);
    if (policy.id !== body.policyId || (!policy.allow_receive && !policy.allow_restock))
      fail('operator_policy', 'Select the current policy with an authorized operator duty.');
  } else if (previous?.policy_id !== body.policyId) fail('operator_policy', 'Disable the enrolled policy.');
  const revision = body.expectedRevision + 1;
  if (previous) await client.query('UPDATE company_operators SET policy_id=$2,policy_revision=$3,enabled=$4,revision=$5,next_run_at=clock_timestamp() WHERE depot_id=$1',
    [body.depotId, body.policyId, body.enabled ? policy.revision : previous.policy_revision, body.enabled, revision]);
  else await client.query('INSERT INTO company_operators (depot_id,owner_character,owner_account,policy_id,policy_revision,enabled,revision) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [body.depotId, ch.id, ch.account_id, body.policyId, policy.revision, body.enabled, revision]);
  return { ok: true, depotId: body.depotId, enabled: body.enabled, revision };
}

// Caller owns a transaction and the character lock (G.withCharacter). The receipt
// is checked before current eligibility, so retries never acquire fresh authority.
export async function runCompanyOperator(ch, request, client, h) {
  if (typeof request === 'string') {
    const row = (await client.query('SELECT depot_id FROM company_operators WHERE owner_character=$1', [ch.id])).rows[0];
    request = { requestKey: request, depotId: row?.depot_id };
  }
  keys(request, ['requestKey', 'depotId']);
  if (typeof request.requestKey !== 'string' || !/^[A-Za-z0-9:_-]{1,128}$/.test(request.requestKey)
      || typeof request.depotId !== 'string' || request.depotId.length > 128)
    fail('operator_terms', 'Provide a bounded requestKey and depotId.');
  const digest = crypto.createHash('sha256').update(JSON.stringify([ch.account_id, ch.id, request.depotId])).digest('hex');
  const replay = async () => {
    const receipt = (await client.query('SELECT * FROM company_operator_receipts WHERE owner_account=$1 AND request_key=$2', [ch.account_id, request.requestKey])).rows[0];
    if (!receipt) return null;
    if (receipt.body_hash !== digest) fail('operator_replay', 'That request key belongs to another operator request.');
    return receipt.result;
  };
  const saved = await replay();
  if (saved) return saved;
  const depot = await lockDepot(ch, request.depotId, client);
  const policy = await latestPolicy(client, request.depotId, true);
  // Acquire the existing cadence dependency before taking the fresh authority clock.
  await latestSupplyContract(client, request.depotId, true);
  const operator = (await client.query('SELECT * FROM company_operators WHERE depot_id=$1 FOR UPDATE', [request.depotId])).rows[0];
  const raced = await replay();
  if (raced) return raced;
  if (!operator || operator.owner_character !== ch.id) fail('operator_owner', 'No enrolled operator for this owner.');
  eligible(ch, depot, policy, operator);
  if (new Date(operator.next_run_at).getTime() > Date.now()) fail('operator_wait', 'The next operator cycle is not due.');
  const delivery = policy.allow_receive ? (await client.query("SELECT id FROM market_listings WHERE depot_id=$1 AND kind='order' AND filled_qty>0 ORDER BY id LIMIT 1", [depot.id])).rows[0] : null;
  let action, canonical;
  if (delivery) {
    action = 'receive';
    canonical = await Depot.receiveDepot(ch, depot.id, delivery.id, client, { automated: true, policyId: policy.id });
  } else {
    if (!policy.allow_restock) fail('operator_idle', 'No authorized delivery is ready.');
    action = 'restock';
    canonical = await Depot.restockDepot(ch, depot.id, client, h, { automated: true, policyId: policy.id });
  }
  const result = { ok: true, depotId: depot.id, policyId: policy.id, policyRevision: Number(policy.revision),
    operatorRevision: Number(operator.revision), requestKey: request.requestKey, action, result: canonical };
  await client.query('INSERT INTO company_operator_receipts (owner_account,request_key,owner_character,depot_id,body_hash,result) VALUES ($1,$2,$3,$4,$5,$6)',
    [ch.account_id, request.requestKey, ch.id, depot.id, digest, JSON.stringify(result)]);
  await client.query("UPDATE company_operators SET next_run_at=clock_timestamp()+interval '60 seconds' WHERE depot_id=$1", [depot.id]);
  return result;
}

export async function companyOperatorBoard(client, account) {
  return (await client.query('SELECT depot_id,owner_character,policy_id,policy_revision,enabled,revision,next_run_at FROM company_operators WHERE owner_account=$1 ORDER BY depot_id LIMIT 100', [account])).rows;
}
export async function dueCompanyOperators(client, limit = 25) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('Bound operator candidate limit to 1–100.');
  return (await client.query("SELECT o.depot_id,o.owner_account,o.owner_character,o.revision,o.policy_revision,o.next_run_at FROM company_operators o JOIN characters c ON c.id=o.owner_character JOIN business_depots d ON d.id=o.depot_id JOIN business_operating_policies p ON p.id=o.policy_id WHERE o.enabled AND c.alive AND c.account_id=o.owner_account AND d.status='open' AND p.enabled AND p.expires_at>clock_timestamp() AND o.next_run_at<=clock_timestamp() ORDER BY o.next_run_at,o.depot_id LIMIT $1", [limit])).rows;
}
