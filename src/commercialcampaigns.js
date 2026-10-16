import crypto from 'node:crypto';
import * as G from './game.js';
import { dbCaps } from './db.js';
import { assertItemTransaction, itemTransactionIdentity, poisonItemTransaction,
  registerItemTransactionUndo, withItemRead, withItemTransaction } from './items.js';
import { INTEL_FORECAST } from './intelforecasts.js';
import { COMMERCIAL_CAMPAIGNS, commercialCampaignTerms } from './commercialcampaigns-contracts.js';

export const COMMERCIAL_CAMPAIGN_REVISION = 'commercial_campaign_v1';
const completions = new WeakMap();
const roleColumns = Object.freeze([
  ['owner', 'owner_account', 'owner_character'], ['scout', 'scout_account', 'scout_character'],
  ['manufacturer', 'manufacturer_account', 'manufacturer_character'], ['guard', 'guard_account', 'guard_character'],
  ['first_carrier', 'first_carrier_account', 'first_carrier_character'],
  ['second_carrier', 'second_carrier_account', 'second_carrier_character'],
]);
const fail = reason => { throw new G.GameError('commercial_campaign', reason); };
const stable = value => JSON.stringify(value, (_, entry) => entry && typeof entry === 'object' && !Array.isArray(entry)
  ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : entry);
const hash = value => crypto.createHash('sha256').update(stable(value)).digest('hex');
const id = value => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail('identity');
  return value;
};
const keyHash = (account, key) => {
  if (typeof key !== 'string' || !/^[!-~]{1,128}$/.test(key)) fail('identity');
  return hash(['commercial-campaign-request', id(account), key]);
};
const clock = async c => new Date((await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed);
const rolesOf = row => Object.fromEntries(roleColumns.map(([role, account, character]) =>
  [role, { account: row[account], character: row[character] }]));
const sourceHash = row => hash(['commercial-campaign-v1', row.id, row.partnership_id, row.relationship_hash,
  Number(row.team_revision), row.business_id, rolesOf(row), row.source_json,
  new Date(row.created_at).toISOString(), new Date(row.expires_at).toISOString()]);
const view = row => ({ campaignId: row.id, sourceHash: row.source_hash, partnershipId: row.partnership_id,
  businessId: row.business_id, state: row.state, stage: row.stage,
  terms: row.source_json.terms,
  roles: roleColumns.map(([role, account, character]) => ({ role, accountId: row[account], originalCharacterId: row[character] })),
  expiresAt: new Date(row.expires_at).toISOString(), executionAuthority: false,
  guardEvidence: COMMERCIAL_CAMPAIGNS.guardEvidence, stageFeesFundedSeparately: true, gameCashOnly: true });

function terms(action, body) {
  try { return commercialCampaignTerms(action, body); } catch (error) {
    if (error instanceof TypeError) fail('terms');
    throw error;
  }
}
async function current(c, account) {
  const rows = (await c.query('SELECT * FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2', [id(account)])).rows;
  if (rows.length !== 1 || rows[0].is_npc
    || (await c.query('SELECT status FROM accounts WHERE id=$1', [account])).rows[0]?.status !== 'active') fail('original_actor');
  return rows[0];
}
async function team(c, account, partnershipId, requestedHash, requestedRevision) {
  const relationship = (await c.query('SELECT * FROM business_partnerships WHERE id=$1', [id(partnershipId)])).rows[0];
  const management = (await c.query('SELECT * FROM management_teams WHERE partnership_id=$1', [partnershipId])).rows[0];
  if (!relationship || !management || relationship.owner_account !== account || relationship.state !== 'active'
    || management.retired || !management.operator_opted || !management.planner_opted
    || management.relationship_hash !== relationship.terms_hash || relationship.terms_hash !== requestedHash
    || Number(management.revision) !== requestedRevision || +await clock(c) >= +new Date(relationship.expires_at)) fail('team_source');
  const owner = await current(c, relationship.owner_account), scout = await current(c, relationship.partner_account);
  const depot = (await c.query('SELECT owner_character,status FROM business_depots WHERE id=$1', [relationship.depot_id])).rows[0];
  if (owner.id !== relationship.owner_character || scout.id !== relationship.partner_character
    || owner.id === scout.id || owner.account_id === scout.account_id
    || depot?.owner_character !== owner.id || depot.status !== 'open') fail('team_originals');
  return { relationship, management, owner, scout };
}
async function resolveCreate(c, account, body) {
  const source = await team(c, account, body.partnershipId, body.relationshipHash, body.teamRevision);
  const manufacturer = await current(c, body.manufacturerAccountId), guard = await current(c, body.guardAccountId);
  const first = await current(c, body.firstCarrierAccountId), second = await current(c, body.secondCarrierAccountId);
  const business = (await c.query('SELECT owner_character,status FROM business_depots WHERE id=$1', [body.businessId])).rows[0];
  if (business?.status !== 'open' || business.owner_character !== manufacturer.id) fail('manufacturer_business');
  const roles = { owner: source.owner, scout: source.scout, manufacturer, guard, first_carrier: first, second_carrier: second };
  if (new Set(Object.values(roles).map(row => row.account_id)).size !== 6
    || new Set(Object.values(roles).map(row => row.id)).size !== 6) fail('distinct_originals');
  return { ...source, roles };
}
async function immutable(c, campaignId, expectedHash, lock = true) {
  const row = (await c.query('SELECT * FROM commercial_campaigns WHERE id=$1' + (lock ? ' FOR UPDATE' : ''), [id(campaignId)])).rows[0];
  if (!row || row.source_hash !== expectedHash || sourceHash(row) !== expectedHash) fail('source');
  const original = terms('create', row.source_json?.terms);
  if (original.partnershipId !== row.partnership_id || original.relationshipHash !== row.relationship_hash
    || original.teamRevision !== Number(row.team_revision) || original.businessId !== row.business_id
    || original.manufacturerAccountId !== row.manufacturer_account || original.guardAccountId !== row.guard_account
    || original.firstCarrierAccountId !== row.first_carrier_account || original.secondCarrierAccountId !== row.second_carrier_account
    || stable(row.source_json.roles) !== stable(rolesOf(row))) fail('source');
  return row;
}
async function live(c, row, expiredReason = 'expired') {
  if (+await clock(c) >= +new Date(row.expires_at)) fail(expiredReason);
  const source = await resolveCreate(c, row.owner_account, terms('create', row.source_json.terms));
  for (const [role, original] of Object.entries(rolesOf(row))) {
    if (source.roles[role].id !== original.character || source.roles[role].account_id !== original.account) fail('original_changed');
  }
}
async function replay(c, account, action, body, key) {
  const row = (await c.query('SELECT body_hash,receipt FROM commercial_campaign_requests WHERE account_id=$1 AND key_hash=$2',
    [id(account), keyHash(account, key)])).rows[0];
  if (!row) return null;
  if (row.body_hash !== hash([action, body])) fail('request_conflict');
  return row.receipt;
}
async function remember(c, actor, action, body, key, row, receipt, sourceProof = null) {
  assertItemTransaction(c);
  const kh = keyHash(actor.account_id, key), bh = hash([action, body]);
  registerItemTransactionUndo(c, () => c.query('DELETE FROM commercial_campaign_requests WHERE account_id=$1 AND key_hash=$2', [actor.account_id, kh]));
  await c.query('INSERT INTO commercial_campaign_requests(account_id,key_hash,action,body_hash,original_character,campaign_id,receipt,acknowledged_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [actor.account_id, kh, action, bh, actor.id, row.id, receipt, await clock(c)]);
  completions.set(receipt, { client: c, transaction: itemTransactionIdentity(c), account: actor.account_id,
    actor: actor.id, action, bodyHash: bh, keyHash: kh, campaignId: row.id,
    sourceHash: row.source_hash, state: row.state, stage: row.stage, sourceProof, receiptHash: hash(receipt) });
  return receipt;
}
async function saveCampaign(c, row, state, stage = row.stage, closure = null) {
  registerItemTransactionUndo(c, () => c.query('UPDATE commercial_campaigns SET state=$2,stage=$3,activated_at=$4,closed_at=$5,closure_reason=$6,closure_original=$7 WHERE id=$1',
    [row.id, row.state, row.stage, row.activated_at, row.closed_at, row.closure_reason, row.closure_original]));
  const now = await clock(c), activatedAt = row.activated_at || (state === 'active' ? now : null);
  const closedAt = ['completed', 'cancelled', 'expired', 'suspended'].includes(state) ? now : null;
  if (closedAt && (!closure || !['owner_cancel', 'provider_withdraw', 'source_expiry', 'original_dead', 'estate_scope', 'completed'].includes(closure.reason)
    || !roleColumns.some(([, , character]) => row[character] === closure.original))) fail('closure_source');
  if ((await c.query('UPDATE commercial_campaigns SET state=$2,stage=$3,activated_at=$4,closed_at=$5,closure_reason=$6,closure_original=$7 WHERE id=$1 AND state=$8',
    [row.id, state, stage, activatedAt, closedAt, closure?.reason || null, closure?.original || null, row.state])).rowCount !== 1) fail('source_changed');
  return { ...row, state, stage, activated_at: activatedAt, closed_at: closedAt,
    closure_reason: closure?.reason || null, closure_original: closure?.original || null };
}
async function saveRole(c, before, state, kh = before.consent_key_hash, th = before.consent_terms_hash, at = before.consented_at) {
  registerItemTransactionUndo(c, () => c.query('UPDATE commercial_campaign_roles SET state=$3,consent_key_hash=$4,consent_terms_hash=$5,consented_at=$6 WHERE campaign_id=$1 AND role=$2',
    [before.campaign_id, before.role, before.state, before.consent_key_hash, before.consent_terms_hash, before.consented_at]));
  if ((await c.query('UPDATE commercial_campaign_roles SET state=$3,consent_key_hash=$4,consent_terms_hash=$5,consented_at=$6 WHERE campaign_id=$1 AND role=$2 AND state=$7',
    [before.campaign_id, before.role, state, kh, th, at, before.state])).rowCount !== 1) fail('source_changed');
}
async function roleRows(c, row) {
  const roles = (await c.query('SELECT * FROM commercial_campaign_roles WHERE campaign_id=$1 ORDER BY account_id FOR UPDATE', [row.id])).rows;
  if (roles.length !== 6) fail('role_source');
  for (const [role, account, character] of roleColumns) {
    const found = roles.find(candidate => candidate.role === role);
    if (found?.account_id !== row[account] || found.original_character !== row[character]) fail('role_source');
  }
  return roles;
}
async function consentWitness(c, row, role) {
  if (!role.consent_key_hash) fail('consent_source');
  const saved = (await c.query('SELECT * FROM commercial_campaign_requests WHERE account_id=$1 AND key_hash=$2',
    [role.account_id, role.consent_key_hash])).rows[0];
  const expectedAction = role.role === 'owner' ? 'create' : 'consent';
  const body = expectedAction === 'create' ? row.source_json.terms : { campaignId: row.id, sourceHash: row.source_hash, consent: true };
  if (!saved || saved.action !== expectedAction || saved.original_character !== role.original_character || saved.campaign_id !== row.id
    || saved.body_hash !== hash([expectedAction, body]) || role.consent_terms_hash !== row.source_hash
    || saved.receipt?.campaign?.sourceHash !== row.source_hash || saved.receipt?.consentedRole !== role.role) fail('consent_source');
  const state = saved.receipt.campaign.state;
  if ((expectedAction === 'create' && state !== 'offered') || !['offered', 'active'].includes(state)
    || stable(saved.receipt) !== stable({ ok: true, campaign: view({ ...row, state, stage: 'scout' }), consentedRole: role.role })) fail('consent_receipt');
}

export async function commercialCampaignTeamHint(c, account, body) {
  const normalized = terms('create', body), source = await resolveCreate(c, id(account), normalized);
  return { ownerOriginal: source.owner.id, scoutOriginal: source.scout.id };
}

// Only a fresh private campaign result reaches this finalizer. Game calls it
// after actual character/account ACKs; the canonical Items-only sources call it
// after both their own source ACK and the campaign ACK in the same transaction.
export async function finalizeCommercialCampaignCharacter(c, result) {
  const proof = result && typeof result === 'object' ? completions.get(result) : null;
  if (!proof) return;
  try {
    assertItemTransaction(c);
    if (proof.client !== c || proof.transaction !== itemTransactionIdentity(c)) fail('completion_scope');
    const saved = (await c.query('SELECT * FROM commercial_campaign_requests WHERE account_id=$1 AND key_hash=$2', [proof.account, proof.keyHash])).rows[0];
    if (!saved || saved.body_hash !== proof.bodyHash || saved.original_character !== proof.actor
      || saved.campaign_id !== proof.campaignId || hash(saved.receipt) !== proof.receiptHash) fail('completion_ack');
    if ((await current(c, proof.account)).id !== proof.actor) fail('completion_original');
    const row = await immutable(c, proof.campaignId, proof.sourceHash);
    if (row.state !== proof.state || row.stage !== proof.stage) fail('completion_state');
    const roles = await roleRows(c, row);
    for (const role of roles.filter(value => value.consent_key_hash)) await consentWitness(c, row, role);
    if (['create', 'consent'].includes(proof.action) || proof.sourceProof) {
      await live(c, row, 'expired_after_ack');
      if (+await clock(c) >= +new Date(row.expires_at)) fail('expired_after_ack');
    }
    if (row.state === 'active' && roles.some(role => role.state !== 'active')) fail('active_roles');
    if (['completed', 'cancelled', 'expired', 'suspended'].includes(row.state) && roles.some(role => role.state !== 'retired')) fail('retired_roles');
    if (proof.sourceProof) {
      if (proof.sourceProof.family === 'scout') await verifyScoutProof(c, row, proof.sourceProof);
      else if (proof.sourceProof.family === 'commission') await verifyCommissionProof(c, row, proof.sourceProof);
      else if (proof.sourceProof.family === 'guard') await verifyGuardProof(c, row, proof.sourceProof);
      else if (proof.sourceProof.family === 'courier') await verifyCourierProof(c, row, proof.sourceProof);
      else fail('completion_source');
    }
  } catch (error) {
    poisonItemTransaction(c, error);
    throw error;
  } finally { completions.delete(result); }
}

export async function commercialCampaignBoard(c, account, after = '') {
  id(account);
  if (after !== '') id(after);
  const rows = (await c.query('SELECT c.* FROM commercial_campaigns c JOIN commercial_campaign_roles r ON r.campaign_id=c.id WHERE r.account_id=$1 AND c.id>$2 ORDER BY c.id LIMIT 20', [account, after])).rows;
  const campaigns = [];
  for (const row of rows) campaigns.push(await recoveryView(c, row, account));
  return { campaigns, next: rows.length === 20 ? rows.at(-1).id : null,
    executionAuthority: false, guardEvidence: COMMERCIAL_CAMPAIGNS.guardEvidence, gameCashOnly: true };
}

async function recoveryView(c, row, account) {
  const own = (await c.query('SELECT role,original_character,consent_key_hash FROM commercial_campaign_roles WHERE campaign_id=$1 AND account_id=$2', [row.id, account])).rows[0];
  const original = own && (await c.query('SELECT alive,account_id FROM characters WHERE id=$1', [own.original_character])).rows[0];
  const activeOriginal = original?.alive && original.account_id === account;
  const open = ['offered', 'active'].includes(row.state);
  const retireActions = open && activeOriginal ? (own.role === 'owner' ? ['cancel'] : own.consent_key_hash ? ['withdraw'] : []) : [];
  let blockedReason = !activeOriginal ? 'original_replaced' : !open ? 'terminal_metadata'
    : +await clock(c) >= +new Date(row.expires_at) ? 'campaign_expired' : null;
  const stages = (await c.query('SELECT * FROM commercial_campaign_stages WHERE campaign_id=$1 ORDER BY kind', [row.id])).rows;
  const stage = stages.find(entry => entry.kind === row.stage);
  if (!blockedReason && stage?.commission_id) {
    const source = (await c.query('SELECT status FROM commissioned_crafting_contracts WHERE id=$1', [stage.commission_id])).rows[0];
    if (!source || source.status !== stage.state) blockedReason = source?.status === 'completed'
      ? 'canonical_source_completed_independently' : 'canonical_source_changed';
  }
  if (!blockedReason && stage?.courier_network_id) {
    const source = (await c.query('SELECT status FROM multi_hop_couriers WHERE id=$1', [stage.courier_network_id])).rows[0];
    if (!source || courierStates[source.status] !== stage.state) blockedReason = source?.status === 'completed'
      ? 'canonical_source_completed_independently' : 'canonical_source_changed';
  }
  if (!blockedReason && stage?.scout_job_id) {
    const source = (await c.query('SELECT status FROM intel_forecast_jobs WHERE id=$1', [stage.scout_job_id])).rows[0];
    if (!source || source.status !== 'open') blockedReason = 'canonical_source_changed';
  }
  if (!blockedReason && !await commercialCampaignReady()) blockedReason = 'native_source_graph_unavailable';
  if (!blockedReason && row.state === 'active' && ['scout', 'guard'].includes(row.stage)
    && +new Date(row.expires_at) - +await clock(c) < 61000) blockedReason = 'canonical_window_insufficient';
  return { ...view(row), supportedStage: open ? row.stage : null, blockedReason, retireActions,
    recovery: 'Retiring campaign metadata does not refund, cancel or alter independent canonical source obligations.',
    stages: stages.map(entry => ({ kind: entry.kind, state: entry.state,
      sourceId: entry.scout_job_id || entry.commission_id || entry.courier_network_id || null,
      outputItemId: entry.output_item_id || null })) };
}

export async function replayCommercialCampaignRequest(pool, account, action, body, key) {
  const normalized = terms(action, body);
  return withItemRead(pool, c => replay(c, account, action, normalized, key));
}

async function create(c, actor, body, key) {
  const resolved = await resolveCreate(c, actor.account_id, body);
  if (actor.id !== resolved.owner.id) fail('original_actor');
  await releaseStaleMembership(c, actor.account_id, null, false);
  const previous = (await c.query("SELECT * FROM commercial_campaigns WHERE owner_account=$1 AND state IN ('offered','active') ORDER BY id LIMIT 2 FOR UPDATE", [actor.account_id])).rows;
  if (previous.length > 1) fail('owner_census');
  for (const old of previous) if (!await retireIfStale(c, old, old.owner_character, actor.account_id)) fail('owner_capacity');
  const now = await clock(c), expiresAt = new Date(+now + body.lifetimeSeconds * 1000);
  if (+expiresAt > +new Date(resolved.relationship.expires_at)) fail('team_deadline');
  const row = { id: crypto.randomUUID(), partnership_id: body.partnershipId, relationship_hash: body.relationshipHash,
    team_revision: body.teamRevision, business_id: body.businessId, state: 'offered', stage: 'scout',
    created_at: now, expires_at: expiresAt, activated_at: null, closed_at: null };
  for (const [role, account, character] of roleColumns) {
    row[account] = resolved.roles[role].account_id;
    row[character] = resolved.roles[role].id;
  }
  row.source_json = { terms: body, roles: rolesOf(row) };
  row.source_hash = sourceHash(row);
  const columns = ['id', 'partnership_id', 'relationship_hash', 'team_revision', 'business_id',
    ...roleColumns.flatMap(([, account, character]) => [account, character]),
    'source_hash', 'source_json', 'state', 'stage', 'created_at', 'expires_at'];
  registerItemTransactionUndo(c, () => c.query('DELETE FROM commercial_campaigns WHERE id=$1', [row.id]));
  await c.query(`INSERT INTO commercial_campaigns(${columns.join(',')}) VALUES(${columns.map((_, i) => '$' + (i + 1)).join(',')})`, columns.map(column => row[column]));
  for (const [role, account, character] of roleColumns) {
    registerItemTransactionUndo(c, () => c.query('DELETE FROM commercial_campaign_roles WHERE campaign_id=$1 AND role=$2', [row.id, role]));
    await c.query("INSERT INTO commercial_campaign_roles(campaign_id,role,account_id,original_character,state) VALUES($1,$2,$3,$4,'invited')", [row.id, role, row[account], row[character]]);
  }
  for (const kind of COMMERCIAL_CAMPAIGNS.stages) {
    registerItemTransactionUndo(c, () => c.query('DELETE FROM commercial_campaign_stages WHERE campaign_id=$1 AND kind=$2', [row.id, kind]));
    await c.query("INSERT INTO commercial_campaign_stages(campaign_id,kind,state,proof_json) VALUES($1,$2,'pending',$3)", [row.id, kind, {}]);
  }
  const receipt = { ok: true, campaign: view(row), consentedRole: 'owner' };
  await remember(c, actor, 'create', body, key, row, receipt);
  const owner = (await roleRows(c, row)).find(role => role.role === 'owner');
  await saveRole(c, owner, 'consented', keyHash(actor.account_id, key), row.source_hash, now);
  return receipt;
}

async function retire(c, row, state, reason, original) {
  const roles = await roleRows(c, row);
  for (const role of roles) if (role.state !== 'retired') await saveRole(c, role, 'retired');
  const stages = (await c.query('SELECT kind,state FROM commercial_campaign_stages WHERE campaign_id=$1 ORDER BY kind FOR UPDATE', [row.id])).rows;
  if (stages.length !== 4) fail('stage_source');
  for (const stage of stages) if (!['completed', 'retired'].includes(stage.state)) {
    registerItemTransactionUndo(c, () => c.query('UPDATE commercial_campaign_stages SET state=$3 WHERE campaign_id=$1 AND kind=$2', [row.id, stage.kind, stage.state]));
    await c.query("UPDATE commercial_campaign_stages SET state='retired' WHERE campaign_id=$1 AND kind=$2", [row.id, stage.kind]);
  }
  return saveCampaign(c, row, state, row.stage, { reason, original });
}

async function retireIfStale(c, hint, original, account) {
  const row = await immutable(c, hint.id, hint.source_hash);
  if (!['offered', 'active'].includes(row.state)
    || !Object.values(rolesOf(row)).some(role => role.character === original && role.account === account)) fail('membership_source');
  const person = (await c.query('SELECT id,account_id,alive FROM characters WHERE id=$1', [original])).rows[0];
  if (!person || person.account_id !== account) fail('membership_original');
  if (+await clock(c) >= +new Date(row.expires_at)) {
    await retire(c, row, 'expired', 'source_expiry', original);
    return true;
  }
  // This is a bounded read of this one indexed campaign's six fixed originals,
  // not a new character/account lock or an arbitrary death-actor root.
  for (const prior of Object.values(rolesOf(row))) {
    const person = (await c.query('SELECT id,account_id,alive FROM characters WHERE id=$1', [prior.character])).rows[0];
    if (!person || person.account_id !== prior.account) fail('membership_original');
    if (person.alive === false) {
      await retire(c, row, 'suspended', 'original_dead', prior.character);
      return true;
    }
  }
  return false;
}

async function releaseStaleMembership(c, account, allowedCampaign = null, rejectLive = true) {
  const rows = (await c.query("SELECT campaign_id,original_character FROM commercial_campaign_roles WHERE account_id=$1 AND state='active' ORDER BY campaign_id LIMIT 2 FOR UPDATE", [account])).rows;
  if (rows.length > 1) fail('membership_census');
  for (const membership of rows) {
    if (membership.campaign_id === allowedCampaign) continue;
    const old = (await c.query('SELECT * FROM commercial_campaigns WHERE id=$1', [membership.campaign_id])).rows[0];
    if (!old || old.state !== 'active') fail('membership_source');
    if (!await retireIfStale(c, old, membership.original_character, account) && rejectLive) fail('active_capacity');
  }
}

// All peer/campaign/role locks have already been acquired before this one
// nonblocking manufacturer-business lock. Unsupported adapters fail before SQL.
async function activationBusiness(c,row) {
  if (!dbCaps.skipLocked) fail('activation_nonblocking_backend_required');
  const business=(await c.query('SELECT id,owner_character,status FROM business_depots WHERE id=$1 FOR UPDATE NOWAIT',[row.business_id])).rows[0];
  if (!business||business.status!=='open'||business.owner_character!==row.manufacturer_character) fail('manufacturer_business');
  await live(c,row);
  // The native row lock remains held through role/campaign and actual Game ACKs.
  // SQLSTATE55P03 is propagated; only the outer real rollback may map contention.
}

async function metadata(c, actor, action, body, key) {
  const row = await immutable(c, body.campaignId, body.sourceHash), roles = await roleRows(c, row);
  const own = roles.find(role => role.account_id === actor.account_id && role.original_character === actor.id);
  if (!own) fail('original_actor');
  if (!['offered', 'active'].includes(row.state)) fail('closed');
  if (action === 'consent') {
    if (row.state !== 'offered' || own.state !== 'invited') fail('already_consented');
    await live(c, row);
    const activate = roles.every(role => role.role === own.role || role.state === 'consented');
    const next = { ...row, state: activate ? 'active' : row.state };
    const receipt = { ok: true, campaign: view(next), consentedRole: own.role };
    await remember(c, actor, action, body, key, next, receipt);
    await saveRole(c, own, 'consented', keyHash(actor.account_id, key), row.source_hash, await clock(c));
    if (activate) {
      const signed = await roleRows(c, row);
      for (const role of signed) await consentWitness(c, row, role);
      for (const role of signed) await releaseStaleMembership(c, role.account_id, row.id);
      await activationBusiness(c,row);
      // Account order is fixed. Native partial unique indexes serialize active
      // membership without introducing extra character or account actor roots.
      for (const role of signed) await saveRole(c, role, 'active');
      await saveCampaign(c, row, 'active');
    }
    return receipt;
  }
  let state;
  if (action === 'cancel') {
    if (own.role !== 'owner') fail('owner');
    state = 'cancelled';
  } else if (action === 'withdraw') {
    if (own.role === 'owner' || !own.consent_key_hash) fail('signed_provider');
    await consentWitness(c, row, own);
    state = 'suspended';
  } else if (action === 'expire') {
    if (+await clock(c) < +new Date(row.expires_at)) fail('not_expired');
    state = 'expired';
  } else fail('action');
  const next = await retire(c, row, state,
    action === 'cancel' ? 'owner_cancel' : action === 'withdraw' ? 'provider_withdraw' : 'source_expiry', actor.id);
  return remember(c, actor, action, body, key, next, { ok: true, campaign: view(next), retiredMetadataOnly: true });
}

// Canonical source stage execution is composed separately. This narrowly scoped
// entry point is intentionally unregistered until the complete source graph is wired.
export async function commercialCampaignMetadataAction(pool, account, action, body, key) {
  id(account);
  keyHash(account, key);
  if (!['create', 'consent', 'withdraw', 'cancel', 'expire'].includes(action)) fail('action');
  const normalized = terms(action, body);
  if (G.commercialCampaignCompletionRevision !== COMMERCIAL_CAMPAIGN_REVISION) {
    throw Object.assign(new G.GameError('commercial_campaign_unavailable', 'Canonical campaign completion hooks required.'), { statusCode: 503 });
  }
  const old = await withItemRead(pool, c => replay(c, account, action, normalized, key));
  if (old) return old;
  const execute = async (actor, c) => {
    assertItemTransaction(c);
    try {
      const replayed = await replay(c, account, action, normalized, key);
      if (replayed) return replayed;
      if (actor.account_id !== account || (await current(c, account)).id !== actor.id) fail('original_actor');
      return action === 'create' ? await create(c, actor, normalized, key) : await metadata(c, actor, action, normalized, key);
    } catch (error) {
      poisonItemTransaction(c, error);
      if (error.code === '23505' && ['commercial_campaign_owner_capacity', 'commercial_campaign_original_capacity'].includes(error.constraint)) fail('active_capacity');
      throw error;
    }
  };
  const result = action === 'create'
    ? await G.withTwoCharacters(pool, account, (await withItemRead(pool, c => commercialCampaignTeamHint(c, account, normalized))).scoutOriginal,
      (actor, _scout, c) => execute(actor, c), { meet: false })
    : await G.withCharacter(pool, account, (actor, c) => execute(actor, c));
  const { character, ...receipt } = result;
  return receipt;
}

const stageColumns = Object.freeze(['state', 'scout_job_id', 'commission_id', 'output_item_id',
  'courier_network_id', 'guard_payer_journal', 'guard_payee_journal', 'guard_until', 'proof_json', 'started_at', 'completed_at']);
async function stageRow(c, row, kind) {
  const found = (await c.query('SELECT * FROM commercial_campaign_stages WHERE campaign_id=$1 AND kind=$2 FOR UPDATE', [row.id, kind])).rows[0];
  if (!found || !COMMERCIAL_CAMPAIGNS.stages.includes(kind)) fail('stage_source');
  return found;
}
async function saveStage(c, before, changes) {
  const next = { ...before, ...changes }, sql = 'UPDATE commercial_campaign_stages SET '
    + stageColumns.map((column, index) => column + '=$' + (index + 3)).join(',') + ' WHERE campaign_id=$1 AND kind=$2';
  registerItemTransactionUndo(c, () => c.query(sql, [before.campaign_id, before.kind, ...stageColumns.map(column => before[column])]));
  if ((await c.query(sql, [before.campaign_id, before.kind, ...stageColumns.map(column => next[column])])).rowCount !== 1) fail('stage_changed');
  return next;
}
async function activeStage(c, actor, body, kind, allowedRoles, allowedStates) {
  const row = await immutable(c, body.campaignId, body.sourceHash);
  if (row.state !== 'active' || row.stage !== kind) fail('stage_order');
  const roles = await roleRows(c, row), own = roles.find(role => role.account_id === actor.account_id && role.original_character === actor.id);
  if (!own || !allowedRoles.includes(own.role)) fail('stage_original');
  if (roles.some(role => role.state !== 'active')) fail('active_roles');
  for (const role of roles) await consentWitness(c, row, role);
  await live(c, row);
  const stage = await stageRow(c, row, kind);
  if (!allowedStates.includes(stage.state)) fail('stage_state');
  return { row, stage, terms: terms('create', row.source_json.terms) };
}
const scoutSource = job => ({
  jobId: job.id, buyerOriginal: job.buyer_character, reporterOriginal: job.reporter_character,
  requestKey: job.request_key, districtId: job.district_id, minimumStock: Number(job.minimum_stock), feeCash: Number(job.fee_cash),
  priceBlock: Number(job.price_block), createdAt: new Date(job.created_at).toISOString(), targetAt: new Date(job.target_at).toISOString(),
});
const scoutReport = job => ({ predictsAvailable: job.predicts_available,
  reportedAt: job.reported_at ? new Date(job.reported_at).toISOString() : null, observation: job.observation });
async function scoutLegs(c, row, job, phase) {
  const legs = (await c.query("SELECT id,character_id,currency,amount,reason,counterparty,account_id FROM transactions WHERE counterparty=$1 AND reason IN ('intel_job:post','intel_job:pay','intel_job:refund') ORDER BY id", [job.id])).rows;
  const reserve = legs.filter(leg => leg.reason === 'intel_job:post'), paid = legs.filter(leg => leg.reason === 'intel_job:pay');
  if (legs.length !== (phase === 'fund' ? 1 : 2) || reserve.length !== 1 || paid.length !== (phase === 'fund' ? 0 : 1)
    || reserve[0].character_id !== row.owner_character || Number(reserve[0].amount) !== -Number(job.fee_cash)
    || paid.some(leg => leg.character_id !== row.scout_character || Number(leg.amount) !== Number(job.fee_cash))
    || legs.some(leg => leg.currency !== 'cash' || leg.account_id != null || leg.counterparty !== job.id)) fail('scout_journals');
  return legs.map(leg => ({ id: leg.id, originalCharacter: leg.character_id, currency: leg.currency,
    amount: Number(leg.amount), reason: leg.reason, counterparty: leg.counterparty }));
}
async function verifyScoutProof(c, row, proof) {
  if (!['fund', 'report'].includes(proof.phase) || proof.ownerOriginal !== row.owner_character || proof.scoutOriginal !== row.scout_character) fail('scout_completion_source');
  const job = (await c.query('SELECT * FROM intel_forecast_jobs WHERE id=$1', [proof.jobId])).rows[0];
  const source = row.source_json.terms;
  if (!job || hash(scoutSource(job)) !== proof.jobHash || job.buyer_character !== row.owner_character
    || job.reporter_character !== row.scout_character || Number(job.fee_cash) !== source.scoutFeeCash
    || job.district_id !== source.origin || Number(job.minimum_stock) !== source.minimumStock
    || new Date(job.target_at).toISOString() !== source.scoutTargetAt
    || job.request_key !== 'commercial:' + row.id + ':scout'
    || job.status !== (proof.phase === 'fund' ? 'open' : 'reported')
    || hash(await scoutLegs(c, row, job, proof.phase)) !== proof.ledgerHash) fail('scout_completion_source');
  if (proof.phase === 'report' && (hash(scoutReport(job)) !== proof.reportHash
    || typeof job.predicts_available !== 'boolean' || !job.observation
    || new Date(job.reported_at).toISOString() !== job.observation.observedAt
    || +new Date(job.reported_at) > +new Date(job.target_at) - INTEL_FORECAST.reportLeadMs)) fail('scout_report_source');
  for (const [original, account, expected] of [[row.owner_character, row.owner_account, proof.ownerCash],
    [row.scout_character, row.scout_account, proof.scoutCash]]) {
    const actor = (await c.query('SELECT id,account_id,alive,cash FROM characters WHERE id=$1', [original])).rows[0];
    if (!actor?.alive || actor.account_id !== account || Number(actor.cash) !== expected
      || !Number.isSafeInteger(expected) || (await current(c, account)).id !== original) fail('scout_account_ack');
  }
}
async function runScout(pool, account, action, body, key) {
  const hint = await withItemRead(pool, async c => {
    const row = await immutable(c, body.campaignId, body.sourceHash, false);
    if ((action === 'scout-fund' ? row.owner_account : row.scout_account) !== account) fail('stage_original');
    return { ownerOriginal: row.owner_character, scoutOriginal: row.scout_character };
  });
  const target = action === 'scout-fund' ? hint.scoutOriginal : hint.ownerOriginal;
  // These are exactly the existing forecast route's two originals and default
  // co-location gate. The caller supplies neither helpers nor actor callbacks.
  const result = await G.withTwoCharacters(pool, account, target, async (actor, other, c, h) => {
    try {
      const old = await replay(c, account, action, body, key);
      if (old) return old;
      const { row, stage, terms: original } = await activeStage(c, actor, body, 'scout',
        action === 'scout-fund' ? ['owner'] : ['scout'], action === 'scout-fund' ? ['pending'] : ['funded']);
      const owner = actor.id === row.owner_character ? actor : other, scout = actor.id === row.scout_character ? actor : other;
      if (owner.id !== row.owner_character || scout.id !== row.scout_character || owner.account_id !== row.owner_account || scout.account_id !== row.scout_account) fail('scout_originals');
      const Intel = await import('./intelforecastjobs.js');
      let canonical;
      if (action === 'scout-fund') {
        if (+new Date(row.expires_at) - +await clock(c) < 61000) fail('commission_window');
        if ((await c.query('SELECT id FROM intel_forecast_jobs WHERE buyer_character=$1 AND request_key=$2', [owner.id, 'commercial:' + row.id + ':scout'])).rows.length) fail('scout_request_conflict');
        canonical = await Intel.createIntelForecastJob(owner, scout, { districtId: original.origin,
          minimumStock: original.minimumStock, feeCash: original.scoutFeeCash, targetAt: original.scoutTargetAt },
        'commercial:' + row.id + ':scout', c, h);
      } else {
        const prior = (await c.query('SELECT * FROM intel_forecast_jobs WHERE id=$1', [stage.scout_job_id])).rows[0];
        if (!prior || prior.status !== 'open' || prior.buyer_character !== owner.id || prior.reporter_character !== scout.id
          || hash(scoutSource(prior)) !== stage.proof_json.sourceHash) fail('scout_source');
        canonical = await Intel.submitIntelForecastJob(scout, owner, prior.id, { predictsAvailable: body.predictsAvailable }, c, h);
      }
      const job = (await c.query('SELECT * FROM intel_forecast_jobs WHERE id=$1', [canonical.job.id])).rows[0];
      const phase = action === 'scout-fund' ? 'fund' : 'report', journals = await scoutLegs(c, row, job, phase);
      const proof = Object.freeze({ family: 'scout', phase, jobId: job.id, jobHash: hash(scoutSource(job)),
        reportHash: phase === 'report' ? hash(scoutReport(job)) : null, ledgerHash: hash(journals),
        ownerOriginal: owner.id, scoutOriginal: scout.id, ownerCash: Number(owner.cash), scoutCash: Number(scout.cash) });
      const now = await clock(c);
      await saveStage(c, stage, { state: phase === 'fund' ? 'funded' : 'completed', scout_job_id: job.id,
        started_at: stage.started_at || now, completed_at: phase === 'report' ? now : null,
        proof_json: { source: scoutSource(job), sourceHash: proof.jobHash, journals,
          report: phase === 'report' ? scoutReport(job) : null } });
      const next = phase === 'report' ? await saveCampaign(c, row, 'active', 'manufacture') : row;
      return remember(c, actor, action, body, key, next, { ok: true, campaign: view(next),
        source: { kind: 'scout', sourceId: job.id, state: phase === 'fund' ? 'funded' : 'completed',
          feeCash: Number(job.fee_cash), paidFeeCash: phase === 'report' ? Number(job.fee_cash) : 0,
          targetAt: new Date(job.target_at).toISOString(), reportedAt: job.reported_at ? new Date(job.reported_at).toISOString() : null,
          predictsAvailable: phase === 'report' ? job.predicts_available : null,
          observedStock: phase === 'report' ? Number(job.observation.stock) : null } }, proof);
    } catch (error) { poisonItemTransaction(c, error); throw error; }
  });
  const { character, ...receipt } = result;
  return receipt;
}

async function verifyCommissionProof(c, row, proof) {
  const Commission = await import('./commissionedcrafting.js');
  const actual = await Commission.consumeCommercialCommission(c, proof.canonical);
  const original = row.source_json.terms, stage = await stageRow(c, row, 'manufacture');
  if (actual.family !== 'commission' || actual.phase !== proof.phase || actual.sourceHash !== stage.proof_json.sourceHash
    || actual.source.id !== stage.commission_id || actual.source.businessId !== row.business_id
    || actual.source.customerAccount !== row.owner_account || actual.source.customerCharacter !== row.owner_character
    || actual.source.makerAccount !== row.manufacturer_account || actual.source.makerCharacter !== row.manufacturer_character
    || actual.source.feeCash !== original.manufacturingFeeCash || hash(actual) !== proof.actualHash
    || hash(stage.proof_json.source) !== hash(actual.source) || hash(stage.proof_json.journals) !== hash(actual.journals)
    || stage.state !== ({ fund: 'funded', accept: 'accepted', complete: 'completed' })[actual.phase]
    || (actual.phase === 'complete' && (stage.output_item_id !== actual.outputItemId || row.stage !== 'guard'))) fail('commission_completion_source');
}
async function runManufacture(pool, account, action, body, key, context) {
  return withItemTransaction(pool, async c => {
    try {
      const old = await replay(c, account, action, body, key);
      if (old) return old;
      const actor = await current(c, account), phase = action.slice('manufacture-'.length);
      const { row, stage, terms: original } = await activeStage(c, actor, body, 'manufacture',
        phase === 'fund' ? ['owner'] : ['manufacturer'], [({ fund: 'pending', accept: 'funded', complete: 'accepted' })[phase]]);
      const Commission = await import('./commissionedcrafting.js');
      const canonicalKey = 'commercial:' + row.id + ':manufacture:' + phase;
      if ((await c.query('SELECT key_hash FROM commissioned_crafting_requests WHERE account_id=$1 AND key_hash=$2',
        [account, hash([account, canonicalKey])])).rows.length) fail('commission_request_conflict');
      let canonical;
      if (phase === 'fund') {
        const seconds = Math.floor((+new Date(row.expires_at) - +await clock(c)) / 1000);
        if (seconds < 60) fail('commission_window');
        canonical = await Commission.fundCommission(c, account, { businessId: row.business_id,
          feeCash: original.manufacturingFeeCash, lifetimeSeconds: seconds, consent: true }, canonicalKey);
      } else {
        const prior = (await c.query('SELECT * FROM commissioned_crafting_contracts WHERE id=$1', [stage.commission_id])).rows[0];
        if (!prior || prior.source_hash !== stage.proof_json.sourceHash
          || prior.customer_character !== row.owner_character || prior.maker_character !== row.manufacturer_character
          || prior.customer_account !== row.owner_account || prior.maker_account !== row.manufacturer_account
          || prior.business_id !== row.business_id || Number(prior.fee_total) !== original.manufacturingFeeCash) fail('commission_source');
        const sourceTerms = { commissionId: prior.id, sourceHash: prior.source_hash, consent: true };
        canonical = phase === 'accept' ? await Commission.acceptCommission(c, account, sourceTerms, canonicalKey)
          : await Commission.completeCommission(c, account, sourceTerms, canonicalKey, context);
      }
      const source = (await c.query('SELECT * FROM commissioned_crafting_contracts WHERE id=$1', [canonical.commissionId])).rows[0];
      // Read the actual canonical source now; its private brand is consumed only
      // after this campaign request has also been durably acknowledged.
      const actual = await Commission.inspectCommercialCommission(c, canonical);
      const now = await clock(c);
      await saveStage(c, stage, { state: source.status, commission_id: source.id,
        output_item_id: actual.outputItemId, started_at: stage.started_at || now,
        completed_at: phase === 'complete' ? now : null,
        proof_json: { source: actual.source, sourceHash: actual.sourceHash, journals: actual.journals,
          production: actual.settlement?.production || null, settlement: actual.settlement } });
      const next = phase === 'complete' ? await saveCampaign(c, row, 'active', 'guard') : row;
      const receipt = await remember(c, actor, action, body, key, next, { ok: true, campaign: view(next),
        source: { kind: 'manufacture', sourceId: source.id, sourceHash: source.source_hash, state: source.status,
          recipeId: canonical.recipeId, feeCash: Number(source.fee_total), paidFeeCash: Number(source.fee_paid),
          outputItemId: actual.outputItemId } }, { family: 'commission', phase, canonical, actualHash: hash(actual) });
      await finalizeCommercialCampaignCharacter(c, receipt);
      return receipt;
    } catch (error) { poisonItemTransaction(c, error); throw error; }
  });
}
async function verifyGuardProof(c, row, proof) {
  const Defense = await import('./social/defense.js');
  const actual = await Defense.consumeCommercialGuard(c, proof.canonical), stage = await stageRow(c, row, 'guard');
  if (hash(actual) !== proof.actualHash || actual.payer !== row.owner_character || actual.payerAccount !== row.owner_account
    || actual.guard !== row.guard_character || actual.guardAccount !== row.guard_account
    || actual.price !== row.source_json.terms.guardPriceCash || actual.evidence !== COMMERCIAL_CAMPAIGNS.guardEvidence
    || stage.state !== 'completed' || stage.guard_payer_journal !== actual.payerJournal
    || stage.guard_payee_journal !== actual.guardJournal || new Date(stage.guard_until).toISOString() !== actual.until
    || hash(stage.proof_json) !== hash(actual) || row.stage !== 'courier') fail('guard_completion_source');
}
async function runGuard(pool, account, action, body, key) {
  const target = await withItemRead(pool, async c => {
    const row = await immutable(c, body.campaignId, body.sourceHash, false);
    if (row.owner_account !== account) fail('stage_original');
    return row.guard_character;
  });
  const result = await G.withTwoCharacters(pool, account, target, async (owner, guard, c, h) => {
    try {
      const old = await replay(c, account, action, body, key);
      if (old) return old;
      const { row, stage, terms: original } = await activeStage(c, owner, body, 'guard', ['owner'], ['pending']);
      if (owner.id !== row.owner_character || guard.id !== row.guard_character || guard.account_id !== row.guard_account
        || Number(guard.guard_price) !== original.guardPriceCash) fail('guard_original_terms');
      const manufacture = await stageRow(c, row, 'manufacture');
      if (manufacture.state !== 'completed' || !manufacture.output_item_id) fail('manufacture_prerequisite');
      if (+new Date(row.expires_at) - +await clock(c) < 61000) fail('courier_window');
      const Defense = await import('./social/defense.js');
      const canonical = await Defense.hireBodyguard(owner, guard, c, h);
      const actual = Defense.inspectCommercialGuard(c, canonical), now = await clock(c);
      await saveStage(c, stage, { state: 'completed', guard_payer_journal: actual.payerJournal,
        guard_payee_journal: actual.guardJournal, guard_until: actual.until,
        proof_json: actual, started_at: now, completed_at: now });
      const next = await saveCampaign(c, row, 'active', 'courier');
      return remember(c, owner, action, body, key, next, { ok: true, campaign: view(next),
        source: { kind: 'guard', state: 'completed', evidence: actual.evidence, priceCash: actual.price,
          paidGuardCash: actual.net, canonicalFeeCash: actual.fee, streetTaxCash: actual.tax, until: actual.until,
          payerJournal: actual.payerJournal, guardJournal: actual.guardJournal } },
      { family: 'guard', canonical, actualHash: hash(actual) });
    } catch (error) { poisonItemTransaction(c, error); throw error; }
  }, { requireKnown: true });
  const { character, ...receipt } = result;
  return receipt;
}
const courierStates = Object.freeze({ offered: 'prepared', ready: 'prepared', first_leg: 'funded', second_leg: 'accepted', completed: 'completed' });
const courierRoles = Object.freeze({ publish: ['owner'], consent: ['first_carrier', 'second_carrier'],
  dispatch: ['owner'], travel: ['first_carrier', 'second_carrier'], handoff: ['first_carrier'], arrive: ['second_carrier'] });
const courierAllowed = Object.freeze({ publish: ['pending'], consent: ['prepared'], dispatch: ['prepared'],
  travel: ['funded', 'accepted'], handoff: ['funded'], arrive: ['accepted'] });
async function courierTerms(c, account, action, body, locked, canonicalTerms = null) {
  const phase = action.slice('courier-'.length);
  if (!Object.hasOwn(courierRoles, phase)) fail('courier_action');
  const actor = await current(c, account);
  let row, stage;
  if (locked) ({ row, stage } = await activeStage(c, actor, body, 'courier', courierRoles[phase], courierAllowed[phase]));
  else {
    row = await immutable(c, body.campaignId, body.sourceHash, false);
    stage = (await c.query("SELECT * FROM commercial_campaign_stages WHERE campaign_id=$1 AND kind='courier'", [row.id])).rows[0];
    const own = Object.entries(rolesOf(row)).find(([, role]) => role.account === account && role.character === actor.id)?.[0];
    if (row.state !== 'active' || row.stage !== 'courier' || !courierRoles[phase].includes(own)
      || !stage || !courierAllowed[phase].includes(stage.state)) fail('stage_order');
  }
  const original = row.source_json.terms;
  const manufacture = (await c.query("SELECT state,output_item_id FROM commercial_campaign_stages WHERE campaign_id=$1 AND kind='manufacture'", [row.id])).rows[0];
  const guard = (await c.query("SELECT state,guard_until,proof_json FROM commercial_campaign_stages WHERE campaign_id=$1 AND kind='guard'", [row.id])).rows[0];
  if (manufacture?.state !== 'completed' || !manufacture.output_item_id || guard?.state !== 'completed'
    || guard.proof_json.evidence !== COMMERCIAL_CAMPAIGNS.guardEvidence || +await clock(c) >= +new Date(guard.guard_until)) fail('courier_prerequisite');
  let derived;
  if (phase === 'publish') {
    const remaining = Math.floor((+new Date(row.expires_at) - +await clock(c)) / 1000);
    // Leave one genuine second for acquiring the canonical source transaction.
    // The locked recheck still refuses any deadline extension.
    const seconds = canonicalTerms?.expiresInSeconds ?? remaining - 1;
    if (!Number.isSafeInteger(seconds) || seconds < 60 || seconds > remaining || seconds > COMMERCIAL_CAMPAIGNS.maximumSeconds) fail('courier_window');
    derived = { itemId: manufacture.output_item_id, firstCarrier: row.first_carrier_account,
      secondCarrier: row.second_carrier_account, origin: original.origin, handoff: original.handoff,
      destination: original.destination, firstFee: original.firstFeeCash, secondFee: original.secondFeeCash,
      expiresInSeconds: seconds, consent: true };
  } else {
    const network = (await c.query('SELECT * FROM multi_hop_couriers WHERE id=$1', [stage.courier_network_id])).rows[0];
    if (!network || network.source_hash !== stage.proof_json.sourceHash || network.item_id !== manufacture.output_item_id
      || network.owner_account !== row.owner_account || network.owner_character !== row.owner_character
      || network.first_account !== row.first_carrier_account || network.first_character !== row.first_carrier_character
      || network.second_account !== row.second_carrier_account || network.second_character !== row.second_carrier_character
      || network.origin !== original.origin || network.handoff !== original.handoff || network.destination !== original.destination
      || Number(network.first_fee) !== original.firstFeeCash || Number(network.second_fee) !== original.secondFeeCash
      || +new Date(network.expires_at) > +new Date(row.expires_at)
      || courierStates[network.status] !== stage.state) fail('courier_source');
    derived = { networkId: network.id, sourceHash: network.source_hash, consent: true };
  }
  return locked ? { action: phase, ...derived } : derived;
}
// Only the fixed N06 ingress consumes these closed terms. No actor list, helper,
// request receipt, item override or authority envelope is accepted here.
export async function commercialCourierTerms(c, account, action, body) {
  return courierTerms(c, id(account), action, terms(action, body), false);
}
export async function prepareCommercialCourier(c, account, action, body, canonicalTerms) {
  assertItemTransaction(c);
  return courierTerms(c, id(account), action, terms(action, body), true, canonicalTerms);
}
export async function replayCommercialCourierSource(c, account, action, body, key, canonicalTerms, canonicalReceipt) {
  assertItemTransaction(c);
  const phase = action.slice('courier-'.length), normalized = terms(action, body);
  if (!Object.hasOwn(courierRoles, phase)) fail('courier_action');
  const acknowledged = await replay(c, id(account), action, normalized, key);
  if (!acknowledged) fail('courier_historical_source');
  const saved = (await c.query('SELECT * FROM commercial_campaign_requests WHERE account_id=$1 AND key_hash=$2', [account, keyHash(account, key)])).rows[0];
  const actor = await current(c, account), campaign = await immutable(c, normalized.campaignId, normalized.sourceHash);
  const canonicalKey = 'commercial:' + campaign.id + ':courier:' + phase + ':' + account;
  const actual = (await c.query('SELECT * FROM multi_hop_courier_requests WHERE account_id=$1 AND request_key=$2', [account, canonicalKey])).rows[0];
  const stage = await stageRow(c, campaign, 'courier');
  const network = (await c.query('SELECT * FROM multi_hop_couriers WHERE id=$1', [stage.courier_network_id])).rows[0];
  if (!saved || saved.action !== action || saved.original_character !== actor.id || saved.campaign_id !== campaign.id
    || !actual || actual.original_character !== actor.id || actual.body_hash !== hash(canonicalTerms)
    || canonicalTerms.action !== phase || hash(actual.receipt) !== hash(canonicalReceipt)
    || actual.network_id !== network?.id || canonicalReceipt.networkId !== network.id
    || canonicalReceipt.sourceHash !== stage.proof_json.sourceHash || network.source_hash !== canonicalReceipt.sourceHash
    || canonicalReceipt.itemId !== stage.output_item_id) fail('courier_replay_binding');
  const status = canonicalReceipt.status, delivered = status === 'completed';
  const firstTravel = phase === 'handoff' || phase === 'arrive' || (phase === 'travel') ? network.first_travel : null;
  const secondTravel = phase === 'arrive' || (phase === 'travel' && actor.id === network.second_character) ? network.second_travel : null;
  const expectedSource = { kind: 'courier', sourceId: network.id, sourceHash: network.source_hash,
    state: status, itemId: network.item_id, firstConsent: canonicalReceipt.firstConsent,
    secondConsent: canonicalReceipt.secondConsent, reservedCash: status === 'first_leg' ? Number(network.first_fee) + Number(network.second_fee)
      : status === 'second_leg' ? Number(network.second_fee) : 0,
    paidFirstCash: ['second_leg', 'completed'].includes(status) ? Number(network.first_fee) : 0,
    paidSecondCash: delivered ? Number(network.second_fee) : 0, firstTravel, secondTravel };
  const expected = { ok: true, campaign: view({ ...campaign, state: delivered ? 'completed' : 'active', stage: delivered ? 'complete' : 'courier' }), source: expectedSource };
  if (hash(acknowledged) !== hash(expected)) fail('courier_replay_binding');
  return acknowledged;
}
export async function recordCommercialCourier(c, canonical) {
  assertItemTransaction(c);
  const Courier = await import('./multihopcourier.js');
  const actual = await Courier.inspectCommercialCourier(c, canonical), intent = actual.intent;
  const body = terms(intent.action, intent.body), actor = await current(c, actual.account);
  const phase = intent.action.slice('courier-'.length);
  const { row, stage } = await activeStage(c, actor, body, 'courier', courierRoles[phase], courierAllowed[phase]);
  const manufactured = await stageRow(c, row, 'manufacture'), original = row.source_json.terms;
  if (actual.actor !== actor.id || actual.source.itemId !== manufactured.output_item_id
    || actual.source.owner !== row.owner_character || actual.source.ownerAccount !== row.owner_account
    || actual.source.first !== row.first_carrier_character || actual.source.firstAccount !== row.first_carrier_account
    || actual.source.second !== row.second_carrier_character || actual.source.secondAccount !== row.second_carrier_account
    || actual.source.origin !== original.origin || actual.source.handoff !== original.handoff || actual.source.destination !== original.destination
    || actual.source.firstFee !== original.firstFeeCash || actual.source.secondFee !== original.secondFeeCash
    || actual.canonicalTerms.action !== phase || !courierStates[actual.status]
    || (phase !== 'publish' && stage.courier_network_id !== actual.source.id)
    || +new Date(actual.source.expiresAt) > +new Date(row.expires_at)) fail('courier_completion_source');
  const now = await clock(c), completed = actual.status === 'completed';
  await saveStage(c, stage, { state: courierStates[actual.status], courier_network_id: actual.source.id,
    output_item_id: actual.source.itemId, started_at: stage.started_at || now, completed_at: completed ? now : null,
    proof_json: { source: actual.source, sourceHash: actual.sourceHash, journals: actual.journals,
      firstTravel: actual.firstTravel, secondTravel: actual.secondTravel,
      firstConsent: actual.firstConsent, secondConsent: actual.secondConsent,
      reservedCash: actual.reservedCash, earnedFirst: actual.earnedFirst, earnedSecond: actual.earnedSecond } });
  let next = row;
  if (completed) {
    next = await saveCampaign(c, row, 'active', 'complete');
    next = await retire(c, next, 'completed', 'completed', actor.id);
  }
  return remember(c, actor, intent.action, body, intent.key, next, { ok: true, campaign: view(next),
    source: { kind: 'courier', sourceId: actual.source.id, sourceHash: actual.sourceHash,
      state: actual.status, itemId: actual.source.itemId, firstConsent: actual.firstConsent,
      secondConsent: actual.secondConsent, reservedCash: actual.reservedCash,
      paidFirstCash: actual.earnedFirst, paidSecondCash: actual.earnedSecond,
      firstTravel: actual.firstTravel, secondTravel: actual.secondTravel } },
  { family: 'courier', canonical, actualHash: hash(actual) });
}
async function verifyCourierProof(c, row, proof) {
  const Courier = await import('./multihopcourier.js');
  const actual = await Courier.consumeCommercialCourier(c, proof.canonical), stage = await stageRow(c, row, 'courier');
  if (hash(actual) !== proof.actualHash || stage.courier_network_id !== actual.source.id
    || stage.proof_json.sourceHash !== actual.sourceHash || hash(stage.proof_json.source) !== hash(actual.source)
    || hash(stage.proof_json.journals) !== hash(actual.journals) || stage.output_item_id !== actual.source.itemId
    || stage.state !== courierStates[actual.status]
    || (actual.status === 'completed' && (row.state !== 'completed' || row.stage !== 'complete'))) fail('courier_final_ack');
}
async function runCourier(pool, account, action, body, key) {
  return (await import('./multihopcourier.js')).multiHopCommercialCampaignAction(pool, account, action, body, key);
}
const paidHandlers = Object.freeze({ 'scout-fund': runScout, 'scout-report': runScout,
  'manufacture-fund': runManufacture, 'manufacture-accept': runManufacture, 'manufacture-complete': runManufacture,
  'guard-hire': runGuard, 'courier-publish': runCourier, 'courier-consent': runCourier,
  'courier-dispatch': runCourier, 'courier-travel': runCourier, 'courier-handoff': runCourier, 'courier-arrive': runCourier });
export async function commercialCampaignReady() {
  if (!dbCaps.skipLocked || G.commercialCampaignCompletionRevision !== COMMERCIAL_CAMPAIGN_REVISION
    || Object.keys(paidHandlers).length !== 12) return false;
  const commission = await import('./commissionedcrafting.js'), courier = await import('./multihopcourier.js');
  const defense = await import('./social/defense.js');
  return commission.commercialCampaignCompletionRevision === COMMERCIAL_CAMPAIGN_REVISION
    && courier.commercialCampaignCompletionRevision === COMMERCIAL_CAMPAIGN_REVISION
    && defense.commercialCampaignCompletionRevision === COMMERCIAL_CAMPAIGN_REVISION;
}
export async function commercialCampaignAction(pool, account, action, body, key, context = { agentCredential: false }) {
  id(account);
  keyHash(account, key);
  const normalized = terms(action, body);
  const recovery = ['cancel', 'withdraw', 'expire'].includes(action);
  if (!recovery && !await commercialCampaignReady()) {
    throw Object.assign(new G.GameError('commercial_campaign_unavailable', 'Complete canonical native source graph required.'), { statusCode: 503 });
  }
  if (['create', 'consent', 'cancel', 'withdraw', 'expire'].includes(action)) return commercialCampaignMetadataAction(pool, account, action, normalized, key);
  const old = await withItemRead(pool, c => replay(c, account, action, normalized, key));
  if (old) return old;
  const handler = paidHandlers[action];
  if (!handler) fail('action');
  return handler(pool, account, action, normalized, key, context);
}

export async function recoverCommercialCampaignAtEstateStart(c, original, rentalScope, estateScope) {
  assertItemTransaction(c);
  try {
    const estate = await (await import('./social/estate.js')).assertEstateResolutionScope(c, original, estateScope);
    const locked = await (await import('./equipmentrentals.js')).assertEquipmentRentalDeathScope(c, original, rentalScope);
    const victim = (await c.query('SELECT id,account_id,alive FROM characters WHERE id=$1', [id(original)])).rows[0];
    if (!victim?.alive || victim.account_id !== estate.accountId || !locked.ids.has(original)) fail('estate_scope');
    const memberships = (await c.query("SELECT campaign_id FROM commercial_campaign_roles WHERE account_id=$1 AND original_character=$2 AND state='active' ORDER BY campaign_id LIMIT 2", [victim.account_id, original])).rows;
    const offered = (await c.query("SELECT id FROM commercial_campaigns WHERE owner_account=$1 AND owner_character=$2 AND state='offered' ORDER BY id LIMIT 2", [victim.account_id, original])).rows;
    if (memberships.length > 1 || offered.length > 1) fail('estate_census');
    const ids = [...new Set([...memberships.map(row => row.campaign_id), ...offered.map(row => row.id)])].sort();
    if (ids.length > 2) fail('estate_census');
    const retired = [];
    for (const campaignId of ids) {
      const hint = (await c.query('SELECT * FROM commercial_campaigns WHERE id=$1', [campaignId])).rows[0];
      if (!hint) fail('estate_source');
      const row = await immutable(c, hint.id, hint.source_hash);
      if (!Object.values(rolesOf(row)).some(role => role.account === victim.account_id && role.character === original)) fail('estate_original');
      if (!['offered', 'active'].includes(row.state)) fail('estate_source');
      const result = await retire(c, row, 'suspended', 'estate_scope', original);
      retired.push({ campaignId: result.id, sourceHash: result.source_hash, metadataOnly: true });
    }
    return retired;
  } catch (error) {
    poisonItemTransaction(c, error);
    throw error;
  }
}
