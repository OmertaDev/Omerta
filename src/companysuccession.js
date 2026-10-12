import crypto from 'node:crypto';
import { GameError } from './game.js';
import { openDepot, DEPOT } from './depot.js';

// Explicit new-generation consent and a NEW funded front. The estate's closed
// depots, destroyed wealth, debts, custody, licences and credentials stay historical.
// Caller holds canonical living-character/account-persistent locks. The accounts
// row is the same mutex used by setAgentCompany, before company profile/assets.
export const COMPANY_SUCCESSION_DEPOT = Object.freeze({ salePrice: 2000, bidPrice: 500, targetStock: 4, reorderAt: 0, restockBudget: 3000 });
const fail = (reason) => { const error = new GameError('company_succession', `Company succession refused: ${reason}.`); error.reason = reason; throw error; };
const id = value => { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail('terms'); return value; };
function terms(body) {
  if (!body || Object.keys(body).sort().join(',') !== 'consent,expectedCompanyRevision,maxOpeningCash,predecessorCharacterId'
      || body.consent !== true || body.maxOpeningCash !== 5000
      || !Number.isSafeInteger(body.expectedCompanyRevision) || body.expectedCompanyRevision < 1 || body.expectedCompanyRevision > 2147483646) fail('terms');
  return { expectedCompanyRevision: body.expectedCompanyRevision, predecessorCharacterId: id(body.predecessorCharacterId), maxOpeningCash: 5000, consent: true };
}
async function verifiedPremises(client, profile) {
  if (profile.premises_kind === 'estate') {
    const estate = (await client.query('SELECT tier FROM estates WHERE account_id=$1', [profile.account_id])).rows[0];
    if (profile.premises_key !== profile.account_id || !Number.isSafeInteger(estate?.tier) || estate.tier < 1) fail('premises');
    return { kind: 'estate', verified: true, tier: estate.tier };
  }
  if (profile.premises_kind === 'street') {
    const deed = (await client.query('SELECT name_lc,district,onchain_token_id FROM street_deeds WHERE account_id=$1', [profile.account_id])).rows[0];
    if (!deed || deed.onchain_token_id !== null || deed.name_lc !== profile.premises_key || deed.district !== profile.premises_district) fail('premises');
    return { kind: 'street', verified: true, district: deed.district };
  }
  fail('premises');
}
export async function resumeCompany(ch, body, requestKey, client, h) {
  if (!ch?.alive || ch.is_npc) fail('actor');
  const account = id(ch.account_id), input = terms(body);
  if (typeof requestKey !== 'string' || requestKey.length < 1 || requestKey.length > 200) fail('terms');
  const owner = (await client.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE', [account])).rows[0];
  if (!owner) fail('actor');
  const prior = (await client.query('SELECT request_terms,receipt FROM company_succession_receipts WHERE account_id=$1 AND request_key=$2', [account, requestKey])).rows[0];
  // Original account may replay from any later living generation. Never charge,
  // inspect current cash, or rediscover the original peer/front for a stored receipt.
  if (prior) {
    if (JSON.stringify(terms(prior.request_terms)) !== JSON.stringify(input)) fail('request_conflict');
    return { ...prior.receipt, replayed: true };
  }
  if (process.env.DEPOT_PILOT !== 'on') fail('disabled');
  const profile = (await client.query('SELECT * FROM agent_company_profiles WHERE account_id=$1 FOR UPDATE', [account])).rows[0];
  if (!profile || profile.revision !== input.expectedCompanyRevision) fail('revision');
  const premises = await verifiedPremises(client, profile);
  const predecessor = (await client.query('SELECT id,account_id,alive,is_npc,generation FROM characters WHERE id=$1', [input.predecessorCharacterId])).rows[0];
  if (!predecessor || predecessor.alive !== false || predecessor.is_npc || predecessor.account_id !== account
      || !Number.isSafeInteger(ch.generation) || ch.generation < 2 || ch.generation !== predecessor.generation + 1) fail('predecessor');
  const old = (await client.query('SELECT id,status,treasury,stock,stock_cost FROM business_depots WHERE owner_character=$1', [predecessor.id])).rows;
  if (!old.length || old.some(depot => depot.status !== 'closed' || Number(depot.treasury) !== 0 || Number(depot.stock) !== 0 || Number(depot.stock_cost) !== 0)) fail('estate');
  let estateHistory = false;
  for (const depot of old) {
    if ((await client.query("SELECT id FROM business_depot_journal WHERE depot_id=$1 AND reason='death' LIMIT 1", [depot.id])).rows.length) estateHistory = true;
  }
  if (!estateHistory) fail('estate');
  if ((await client.query('SELECT id FROM company_succession_receipts WHERE successor_character=$1', [ch.id])).rows.length) fail('already_succeeded');
  const balance = Number(ch.cash);
  if (!Number.isFinite(balance) || balance < 5000 || balance > Number.MAX_SAFE_INTEGER || DEPOT.openingCost !== input.maxOpeningCash) fail('cash');
  const revision = input.expectedCompanyRevision + 1;
  const changed = await client.query('UPDATE agent_company_profiles SET revision=$2,updated_at=clock_timestamp() WHERE account_id=$1 AND revision=$3', [account, revision, input.expectedCompanyRevision]);
  if (changed.rowCount !== 1) fail('revision');
  // Canonical opening supplies the sole $5,000 sink and native empty depot journal.
  const depot = await openDepot(ch, COMPANY_SUCCESSION_DEPOT, client, h);
  const receiptId = crypto.randomUUID();
  const receipt = { ok: true, succession: { id: receiptId, accountId: account, predecessorCharacterId: predecessor.id,
    successorCharacterId: ch.id, successorGeneration: ch.generation, companyRevision: revision, depotId: depot.id, openingCash: 5000 },
  company: { accountId: account, revision, name: profile.name, published: profile.published, premises }, depot };
  await client.query(`INSERT INTO company_succession_receipts(id,account_id,request_key,request_terms,predecessor_character,successor_character,successor_generation,company_revision,depot_id,opening_cash,receipt)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [receiptId, account, requestKey, input, predecessor.id, ch.id, ch.generation, revision, depot.id, 5000, receipt]);
  return receipt;
}
export async function companySuccessionBoard(client, accountId) {
  return (await client.query('SELECT receipt FROM company_succession_receipts WHERE account_id=$1 ORDER BY created_at,id LIMIT 100', [id(accountId)])).rows.map(row => row.receipt);
}
