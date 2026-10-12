import crypto from 'node:crypto';
import { GameError } from './game.js';

export const COMMERCIAL_PREMISES = Object.freeze({ slots:2, tenantLeases:2, maxRent:100000, maxTermSeconds:86400 });
const fail = reason => { const error = new GameError('commercial_premises', reason); error.reason=reason; throw error; };
const id = value => { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail('terms'); return value; };
const whole = (value,min,max) => { if (!Number.isSafeInteger(value) || value<min || value>max) fail('terms'); return value; };
const person = ch => { if (!ch?.alive || ch.is_npc || !ch.account_id) fail('party'); id(ch.id); id(ch.account_id); };
const clock = async client => +new Date((await client.query('SELECT clock_timestamp() AS at')).rows[0].at);
const canonical = value => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))));
const exact = (body,fields) => { if (!body || Array.isArray(body) || typeof body!=='object' || Object.keys(body).sort().join(',')!==fields) fail('terms'); };
export function premisesOfferTerms(body) {
  exact(body,'depotId,durationSeconds,expectedCompanyRevision,expectedRevision,offerExpiresAt,published,rentCash,slots');
  if (typeof body.published!=='boolean' || typeof body.offerExpiresAt!=='string' || !Number.isFinite(Date.parse(body.offerExpiresAt))
      || new Date(body.offerExpiresAt).toISOString()!==body.offerExpiresAt) fail('terms');
  return { expectedRevision:whole(body.expectedRevision,0,2147483646), expectedCompanyRevision:whole(body.expectedCompanyRevision,1,2147483647),
    depotId:body.depotId===null ? null : id(body.depotId), slots:whole(body.slots,1,2), rentCash:whole(body.rentCash,1,COMMERCIAL_PREMISES.maxRent),
    durationSeconds:whole(body.durationSeconds,60,COMMERCIAL_PREMISES.maxTermSeconds), offerExpiresAt:body.offerExpiresAt,published:body.published };
}
function leaseTerms(offerId,body) {
  exact(body,'consent,expectedRevision,maxRentCash,slot');
  if (body.consent!==true) fail('terms');
  return { offerId:id(offerId), expectedRevision:whole(body.expectedRevision,1,2147483647), slot:whole(body.slot,1,2),
    maxRentCash:whole(body.maxRentCash,1,COMMERCIAL_PREMISES.maxRent),consent:true };
}
async function accounts(client,values) {
  for (const account of [...new Set(values)].sort()) {
    if (!(await client.query('SELECT id FROM accounts WHERE id=$1 FOR UPDATE',[id(account)])).rows[0]) fail('party');
  }
}
async function replay(accountId,action,key,terms,client) {
  if (typeof key!=='string' || !key.length || key.length>200) fail('request_key');
  const row = (await client.query('SELECT terms,receipt FROM commercial_premises_requests WHERE account_id=$1 AND action=$2 AND request_key=$3',[id(accountId),action,key])).rows[0];
  if (!row) return null;
  if (canonical(row.terms)!==canonical(terms)) fail('request_conflict');
  return { ...row.receipt,replayed:true };
}
async function save(ch,action,key,terms,result,client) {
  await client.query('INSERT INTO commercial_premises_requests(account_id,action,request_key,terms,receipt) VALUES($1,$2,$3,$4,$5)',[ch.account_id,action,key,terms,result]);
  return result;
}
async function backing(client,profile,lock) {
  const suffix=lock ? ' FOR UPDATE' : '';
  if (profile?.premises_kind==='estate') {
    const estate=(await client.query(`SELECT tier FROM estates WHERE account_id=$1${suffix}`,[profile.account_id])).rows[0];
    if (profile.premises_key!==profile.account_id || !Number.isSafeInteger(estate?.tier) || estate.tier<1) return null;
    return { kind:'estate',key:profile.account_id,district:null,tier:estate.tier };
  }
  if (profile?.premises_kind==='street') {
    const deed=(await client.query(`SELECT name_lc,district,onchain_token_id FROM street_deeds WHERE account_id=$1${suffix}`,[profile.account_id])).rows[0];
    if (!deed || deed.onchain_token_id!==null || deed.name_lc!==profile.premises_key || deed.district!==profile.premises_district) return null;
    return { kind:'street',key:deed.name_lc,district:deed.district,tier:null };
  }
  return null;
}
const same = (row,b,depot) => b && row.premises_kind===b.kind && row.premises_key===b.key && row.premises_district===b.district
  && (!row.depot_id || (depot?.id===row.depot_id && depot.status==='open' && depot.owner_character===row.landlord_character));

// Canonical callers own sorted living-character/account_persistent locks. We
// additionally share setAgentCompany's accounts mutex. Leaves: optional depot ->
// sorted profiles -> estate/deed backing -> offer -> leases. No peer discovery.
async function context(client,accountId,depotId,participants=[],lock=true) {
  let depot=null;
  if (depotId) depot=(await client.query(`SELECT * FROM business_depots WHERE id=$1${lock?' FOR UPDATE':''}`,[depotId])).rows[0];
  const profiles={};
  for (const account of [...new Set([accountId,...participants])].sort()) {
    profiles[account]=(await client.query(`SELECT * FROM agent_company_profiles WHERE account_id=$1${lock?' FOR UPDATE':''}`,[account])).rows[0];
  }
  const profile=profiles[accountId], premises=await backing(client,profile,lock);
  return { depot,profile,premises,profiles };
}
const offerView=(row,ctx,available=null) => ({ id:row.id,revision:row.revision,state:row.state,slots:row.slots,
  rentCash:Number(row.rent_cash),durationSeconds:row.duration_seconds,offerExpiresAt:new Date(row.expires_at).toISOString(),
  premises:{ kind:row.premises_kind,verified:Boolean(same(row,ctx.premises,ctx.depot)),
    ...(row.premises_kind==='street'?{ district:row.premises_district }:{}) },
  businessDistrict:row.depot_id ? ctx.depot?.district || null : null,gameCashOnly:true,
  ...(available===null?{}:{ availableSlots:available }) });
const leaseView=(row,ch) => ({ id:row.id,offerId:row.offer_id,slot:row.slot,state:row.state,revision:row.revision,
  landlordCharacterId:row.landlord_character,tenantCharacterId:row.tenant_character,rentCash:Number(row.rent_cash),
  startsAt:new Date(row.starts_at).toISOString(),expiresAt:new Date(row.expires_at).toISOString(),
  role:row.landlord_account===ch.account_id?'landlord':'tenant',
  premises:{ kind:row.premises_kind,...(row.premises_kind==='street'?{ district:row.premises_district }:{}) },
  gameCashOnly:true,refundCash:0 });
async function expire(client,offerId,now) {
  await client.query("UPDATE commercial_premises_leases SET state='expired',revision=revision+1 WHERE offer_id=$1 AND state='active' AND expires_at<=$2",[offerId,new Date(now)]);
}
export async function offerPremises(ch,body,key,client) {
  const terms=premisesOfferTerms(body); await accounts(client,[ch.account_id]);
  const prior=await replay(ch.account_id,'offer',key,terms,client); if (prior) return prior;
  person(ch); if (process.env.DEPOT_PILOT!=='on') fail('disabled');
  const ctx=await context(client,ch.account_id,terms.depotId);
  if (!ctx.premises || ctx.profile.revision!==terms.expectedCompanyRevision
      || (terms.depotId && (!ctx.depot || ctx.depot.owner_character!==ch.id || ctx.depot.status!=='open'))) fail('premises');
  const old=(await client.query('SELECT * FROM commercial_premises_offers WHERE landlord_account=$1 FOR UPDATE',[ch.account_id])).rows[0];
  if ((old?.revision||0)!==terms.expectedRevision) fail('revision');
  const now=await clock(client), end=Date.parse(terms.offerExpiresAt);
  if (end-now<60000 || end-now>86400000) fail('expiry');
  const offerId=old?.id || crypto.randomUUID();
  if (old) {
    await expire(client,old.id,now);
    const occupied=(await client.query("SELECT * FROM commercial_premises_leases WHERE offer_id=$1 AND state='active' ORDER BY slot FOR UPDATE",[old.id])).rows;
    const continued=old.landlord_character===ch.id && old.depot_id===terms.depotId && same(old,ctx.premises,ctx.depot);
    if (occupied.length && old.landlord_character===ch.id && old.depot_id!==terms.depotId) {
      const oldDepot=old.depot_id ? (await client.query('SELECT id,status,owner_character FROM business_depots WHERE id=$1',[old.depot_id])).rows[0] : null;
      if (same(old,ctx.premises,oldDepot)) fail('paid_occupancy');
    }
    if (continued && occupied.some(lease=>lease.slot>terms.slots)) fail('occupied');
    if (!continued) await client.query("UPDATE commercial_premises_leases SET state='invalidated',revision=revision+1 WHERE offer_id=$1 AND state='active'",[old.id]);
    const updated=await client.query(`UPDATE commercial_premises_offers SET landlord_character=$2,revision=$3,company_revision=$4,
      depot_id=$5,premises_kind=$6,premises_key=$7,premises_district=$8,slots=$9,rent_cash=$10,duration_seconds=$11,
      published=$12,expires_at=$13,state='offered' WHERE id=$1 AND revision=$14`,
    [offerId,ch.id,old.revision+1,ctx.profile.revision,terms.depotId,ctx.premises.kind,ctx.premises.key,ctx.premises.district,terms.slots,terms.rentCash,terms.durationSeconds,terms.published,terms.offerExpiresAt,terms.expectedRevision]);
    if (updated.rowCount!==1) fail('revision');
  } else {
    await client.query(`INSERT INTO commercial_premises_offers(id,landlord_account,landlord_character,revision,company_revision,
      depot_id,premises_kind,premises_key,premises_district,slots,rent_cash,duration_seconds,published,expires_at)
      VALUES($1,$2,$3,1,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [offerId,ch.account_id,ch.id,ctx.profile.revision,terms.depotId,ctx.premises.kind,ctx.premises.key,ctx.premises.district,terms.slots,terms.rentCash,terms.durationSeconds,terms.published,terms.offerExpiresAt]);
  }
  const row=(await client.query('SELECT * FROM commercial_premises_offers WHERE id=$1',[offerId])).rows[0];
  return save(ch,'offer',key,terms,{ ok:true,offer:offerView(row,ctx) },client);
}
async function lockedOffer(client,offerId,participants=[]) {
  const hint=(await client.query('SELECT landlord_account,depot_id FROM commercial_premises_offers WHERE id=$1',[id(offerId)])).rows[0];
  if (!hint) fail('offer');
  const ctx=await context(client,hint.landlord_account,hint.depot_id,participants);
  const offer=(await client.query('SELECT * FROM commercial_premises_offers WHERE id=$1 FOR UPDATE',[offerId])).rows[0];
  if (!offer || offer.landlord_account!==hint.landlord_account || offer.depot_id!==hint.depot_id) fail('changed');
  return { ...ctx,offer };
}
async function transfer(ch,landlord,rent,client,h,leaseId) {
  const left=Number(ch.cash)-rent, right=Number(landlord.cash)+rent;
  if (!Number.isFinite(left) || left<0 || !Number.isFinite(right) || right>Number.MAX_SAFE_INTEGER) fail('cash');
  await h.ledger(client,{ characterId:ch.id,currency:'cash',amount:-rent,reason:'commercial_premises:rent:pay',counterparty:leaseId });
  await h.ledger(client,{ characterId:landlord.id,currency:'cash',amount:rent,reason:'commercial_premises:rent:receive',counterparty:leaseId });
  ch.cash=left; landlord.cash=right;
}
export async function leasePremises(ch,landlord,offerId,body,key,client,h) {
  const terms=leaseTerms(offerId,body); await accounts(client,[ch.account_id,landlord.account_id]);
  const prior=await replay(ch.account_id,'lease',key,terms,client); if (prior) return prior;
  person(ch); person(landlord);
  if (process.env.DEPOT_PILOT!=='on') fail('disabled');
  if (ch.account_id===landlord.account_id) fail('self');
  const ctx=await lockedOffer(client,offerId,[ch.account_id]), row=ctx.offer;
  const now=await clock(client);
  if (row.landlord_character!==landlord.id || row.landlord_account!==landlord.account_id || row.state!=='offered'
      || row.revision!==terms.expectedRevision || row.expires_at<=new Date(now) || !same(row,ctx.premises,ctx.depot)
      || !ctx.profiles[ch.account_id] || terms.slot>row.slots || Number(row.rent_cash)>terms.maxRentCash) fail('offer');
  await expire(client,row.id,now);
  const occupied=(await client.query("SELECT id FROM commercial_premises_leases WHERE offer_id=$1 AND slot=$2 AND state='active' FOR UPDATE",[row.id,terms.slot])).rows;
  if (occupied.length) fail('occupied');
  const tenant=(await client.query("SELECT id FROM commercial_premises_leases WHERE tenant_account=$1 AND state='active' AND expires_at>$2",[ch.account_id,new Date(now)])).rows;
  if (tenant.length>=COMMERCIAL_PREMISES.tenantLeases) fail('tenant_limit');
  const leaseId=crypto.randomUUID(), end=new Date(now+row.duration_seconds*1000);
  await transfer(ch,landlord,Number(row.rent_cash),client,h,leaseId);
  await client.query(`INSERT INTO commercial_premises_leases(id,offer_id,slot,landlord_character,landlord_account,tenant_character,tenant_account,
    offer_revision,depot_id,premises_kind,premises_key,premises_district,rent_cash,starts_at,expires_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
  [leaseId,row.id,terms.slot,landlord.id,landlord.account_id,ch.id,ch.account_id,row.revision,row.depot_id,row.premises_kind,row.premises_key,row.premises_district,row.rent_cash,new Date(now),end]);
  const lease=(await client.query('SELECT * FROM commercial_premises_leases WHERE id=$1',[leaseId])).rows[0];
  return save(ch,'lease',key,terms,{ ok:true,lease:leaseView(lease,ch) },client);
}
async function lockedLease(client,leaseId) {
  const hint=(await client.query('SELECT offer_id FROM commercial_premises_leases WHERE id=$1',[id(leaseId)])).rows[0];
  if (!hint) fail('lease');
  const ctx=await lockedOffer(client,hint.offer_id);
  const lease=(await client.query('SELECT * FROM commercial_premises_leases WHERE id=$1 FOR UPDATE',[leaseId])).rows[0];
  if (!lease || lease.offer_id!==ctx.offer.id) fail('changed');
  return { ...ctx,lease };
}
export async function cancelPremisesOffer(ch,offerId,body,key,client) {
  exact(body,'expectedRevision'); const terms={ offerId:id(offerId),expectedRevision:whole(body.expectedRevision,1,2147483647) };
  await accounts(client,[ch.account_id]); const prior=await replay(ch.account_id,'cancel_offer',key,terms,client); if (prior) return prior;
  person(ch); const ctx=await lockedOffer(client,offerId), row=ctx.offer;
  if (row.landlord_account!==ch.account_id || row.landlord_character!==ch.id) fail('owner');
  if (row.revision!==terms.expectedRevision) fail('revision');
  const updated=await client.query("UPDATE commercial_premises_offers SET state='cancelled',published=false,revision=revision+1 WHERE id=$1 AND revision=$2",[row.id,terms.expectedRevision]);
  if (updated.rowCount!==1) fail('revision');
  return save(ch,'cancel_offer',key,terms,{ ok:true,offerId:row.id,revision:row.revision+1 },client);
}
export async function cancelPremisesLease(ch,leaseId,body,key,client) {
  exact(body,'expectedRevision'); const terms={ leaseId:id(leaseId),expectedRevision:whole(body.expectedRevision,1,2147483647) };
  await accounts(client,[ch.account_id]); const prior=await replay(ch.account_id,'cancel_lease',key,terms,client); if (prior) return prior;
  person(ch); const ctx=await lockedLease(client,leaseId), row=ctx.lease, now=await clock(client);
  const landlord=row.landlord_character===ch.id && row.landlord_account===ch.account_id;
  const tenant=row.tenant_character===ch.id && row.tenant_account===ch.account_id;
  if (!landlord && !tenant) fail('party');
  if (row.revision!==terms.expectedRevision) fail('revision');
  const original=(await client.query('SELECT id,account_id,alive FROM characters WHERE id=$1',[row.tenant_character])).rows[0];
  if (landlord && row.state==='active' && +new Date(row.expires_at)>now && original?.alive && same(row,ctx.premises,ctx.depot)) fail('paid_occupancy');
  const updated=await client.query("UPDATE commercial_premises_leases SET state='cancelled',revision=revision+1 WHERE id=$1 AND revision=$2",[row.id,terms.expectedRevision]);
  if (updated.rowCount!==1) fail('revision');
  return save(ch,'cancel_lease',key,terms,{ ok:true,leaseId:row.id,revision:row.revision+1,refundCash:0 },client);
}
export async function commercialPremisesAccess(client,ch,leaseId) {
  // Read authorization. A gameplay mutation consuming this occupancy must hold
  // the canonical landlord/tenant pair locks and call assertPremisesOccupancy.
  person(ch);
  const row=(await client.query('SELECT * FROM commercial_premises_leases WHERE id=$1',[id(leaseId)])).rows[0];
  if (!row || ![row.landlord_account,row.tenant_account].includes(ch.account_id)) fail('party');
  const actor=row.landlord_account===ch.account_id ? row.landlord_character : row.tenant_character;
  if (actor!==ch.id) fail('party');
  const ctx=await context(client,row.landlord_account,row.depot_id,[],false), now=await clock(client);
  const people=(await client.query('SELECT id,account_id,alive FROM characters WHERE id IN ($1,$2)',[row.landlord_character,row.tenant_character])).rows;
  if (row.state!=='active' || +new Date(row.expires_at)<=now || !same(row,ctx.premises,ctx.depot)
      || !people.find(p=>p.id===row.landlord_character && p.account_id===row.landlord_account && p.alive)
      || !people.find(p=>p.id===row.tenant_character && p.account_id===row.tenant_account && p.alive)) fail('access_expired');
  return { ok:true,lease:leaseView(row,ch),premisesKey:row.premises_key,businessDistrict:ctx.depot?.district||null };
}
export async function assertPremisesOccupancy(ch,landlord,leaseId,client) {
  person(ch); person(landlord); await accounts(client,[ch.account_id,landlord.account_id]);
  const ctx=await lockedLease(client,leaseId), row=ctx.lease, now=await clock(client);
  if (row.tenant_character!==ch.id || row.tenant_account!==ch.account_id || row.landlord_character!==landlord.id
      || row.landlord_account!==landlord.account_id || row.state!=='active' || +new Date(row.expires_at)<=now
      || !same(row,ctx.premises,ctx.depot)) fail('access_expired');
  return { leaseId:row.id,offerId:row.offer_id,slot:row.slot,premisesKind:row.premises_kind,premisesKey:row.premises_key,
    district:row.premises_district,businessDistrict:ctx.depot?.district||null };
}
export async function ownPremisesBoard(client,ch) {
  person(ch);
  const offers=(await client.query('SELECT * FROM commercial_premises_offers WHERE landlord_account=$1',[ch.account_id])).rows;
  const leases=(await client.query('SELECT * FROM commercial_premises_leases WHERE landlord_account=$1 OR tenant_account=$1 ORDER BY starts_at DESC,id LIMIT 100',[ch.account_id])).rows;
  const views=[];
  for (const row of offers) views.push({ ...offerView(row,await context(client,row.landlord_account,row.depot_id,[],false)),published:row.published,premisesKey:row.premises_key });
  return { ok:true,offers:views,leases:leases.map(row=>leaseView(row,ch)),limit:100 };
}
export async function publicPremisesOffers(client) {
  const rows=(await client.query(`SELECT o.* FROM commercial_premises_offers o
    JOIN agent_company_profiles p ON p.account_id=o.landlord_account JOIN characters c ON c.id=o.landlord_character
    WHERE o.published AND p.published AND o.state='offered' AND o.expires_at>clock_timestamp() AND c.alive
    AND c.account_id=o.landlord_account ORDER BY o.expires_at,o.id LIMIT 50`)).rows;
  const offers=[], now=await clock(client);
  for (const row of rows) {
    const ctx=await context(client,row.landlord_account,row.depot_id,[],false);
    if (!ctx.profile?.published || !same(row,ctx.premises,ctx.depot)) continue;
    const active=(await client.query("SELECT slot FROM commercial_premises_leases WHERE offer_id=$1 AND state='active' AND expires_at>$2",[row.id,new Date(now)])).rows;
    const available=[1,2].filter(slot=>slot<=row.slots && !active.some(lease=>lease.slot===slot));
    if (available.length) offers.push({ ...offerView(row,ctx,available),companyName:ctx.profile.name });
  }
  return { ok:true,offers,limit:50 };
}
export async function replayPremisesLease(accountId,offerId,body,key,client) {
  return replay(accountId,'lease',key,leaseTerms(offerId,body),client);
}
// Called by canonical estate under original character/account locks. Paid rent
// is already landlord pocket cash and follows its existing estate disposition.
export async function voidCommercialPremisesAtDeath(client,victim) {
  const offers=(await client.query("SELECT id FROM commercial_premises_offers WHERE landlord_character=$1 AND state<>'invalidated' ORDER BY id FOR UPDATE",[victim.id])).rows;
  for (const row of offers) await client.query("UPDATE commercial_premises_offers SET state='invalidated',published=false,revision=revision+1 WHERE id=$1 AND state<>'invalidated'",[row.id]);
  const leases=(await client.query("SELECT id,landlord_character FROM commercial_premises_leases WHERE (landlord_character=$1 OR tenant_character=$1) AND state='active' ORDER BY offer_id,slot FOR UPDATE",[victim.id])).rows;
  for (const row of leases) await client.query('UPDATE commercial_premises_leases SET state=$2,revision=revision+1 WHERE id=$1',[row.id,row.landlord_character===victim.id?'landlord_dead':'tenant_dead']);
  return { closedOffers:offers.length,closedLeases:leases.length,refundCash:0 };
}
