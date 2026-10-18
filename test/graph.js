// THE GRAPH PLANE test (the 54th suite) — guards tools/graph.js, the project's work-and-knowledge
// graph (see GRAPH.md).
//
// The failure mode this file exists to prevent is the one that has bitten twice in a row now: a
// coverage tool that silently extracts nothing, passes every invariant vacuously, and gets read as
// proof. `test/client.js` shipped green while missing a third of the client's request bodies;
// `tools/mobile.js` shipped with a dead MIN_TAP constant and an i18n-fragile selector that would
// have walked zero screens in another locale. So every assertion here is either a NON-TRIVIALITY
// floor (the extractor really found the things we know are there) or a MECHANISM check on a
// synthetic graph (the query really fires when the condition it looks for is true).
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import {ENTERPRISE_STRUCTURAL_CHECKS,ENTERPRISE_HELPER_PROFILES,extractEnterpriseHelperReconciliations} from '../tools/enterprise-graph-helpers.js';
import {COMMERCE_STRUCTURAL_CHECKS} from '../tools/commerce-graph-helpers.js';
import {assertCommerceOwnedSource} from '../tools/commerce-source-compatibility.js';
import {FINAL_SERVICES_COMMERCE_SOURCE_BINDING,hasFinalServicesCommerceSource,assertFinalServicesCommerceSourceTransfer} from '../tools/finalservices-commerce-source-compatibility.js';
import {FINAL_SERVICES_STRUCTURAL_CHECKS,FINAL_SERVICES_HELPER_PROFILES,extractFinalServicesHelperReconciliations} from '../tools/final-services-graph-helpers.js';
import {
  build,
  extractCommercialHelperReconciliations,
  extractNextFiveMetadataChecks,
  extractAutonomyHelperReconciliations,
  extractAutonomyObservationChecks,
  checkGraph,
  QUERIES,
  census,
  NODE_TYPES,
  EDGE_TYPES,
  isMainModule,
  normalizeText,
  extractIntelHelperReconciliations,
  extractEmploymentHelperReconciliations,
} from '../tools/graph.js';

// The graph is a developer-facing CLI as well as an importable module. Pin the two Windows failure
// modes explicitly: CRLF must not change the parser's language, and a drive-letter argv path must
// still be recognized as the entry module.
assert.equal(normalizeText('one\r\ntwo\rthree\n'), 'one\ntwo\nthree\n');
const graphPath = fileURLToPath(new URL('../tools/graph.js', import.meta.url));
assert(isMainModule(new URL('../tools/graph.js', import.meta.url).href, graphPath));
assert(!isMainModule(import.meta.url, graphPath));

// Full actual S150 raw admission remains separate from the frozen Commerce295 history proof.
const FINAL_SERVICES_COMMERCE_GRAPH_TARGET=Object.freeze({"predecessor":"da5bc87ca9e8e1fefd1e434bbf4dd52b1cf35988","files":152,"keysetSHA256":"e53603700ecf409cc837061a2f5c18bb0994f953edb3fba0b0f3e4d1e0c6d749","graph":{"file":"test/graph.js","mode":"100644","blob":"1ea4bc49b727e5f143cdff2e85e95588fcbc19f8","sha256":"7e7bf97bafc75dcd91e69afc8e3e26e648b5b1b924f67bbab76686a6c5048faf","bytes":60004},"event":{"file":"src/eventmarkets.js","mode":"100644","blob":"ddc5c8fbc38084a732d8a44b1542cd99c5d5778d","sha256":"94ca7d9a06043c262519d6f4684c09056f05c1035d2f9896db3e68b436aa8816","bytes":44555}});
function assertFinalServicesCommerceGraphSources(readRaw){
 const target=FINAL_SERVICES_COMMERCE_GRAPH_TARGET,binding=FINAL_SERVICES_COMMERCE_SOURCE_BINDING;
 assert.equal(binding.predecessorRevision,target.predecessor,'Only the genuine frozen Commerce target');
 const files=Object.keys(binding.records).sort();assert.equal(files.length,target.files);assert.equal(crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex'),target.keysetSHA256,'Complete unchanged S150 source scope');
 const proofs=new Map();for(const file of files){assert(hasFinalServicesCommerceSource(file));const proof=assertFinalServicesCommerceSourceTransfer(file,readRaw(file));assert.equal(proof.phase,'EXACT_FINAL_SERVICES_OVER_COMMERCE_SOURCE_ONLY');assert.equal(proof.sourceOnly,true);assert.equal(proof.nativeAdmission,false);assert.equal(proof.sourceRevision,binding.sourceRevision);assert.equal(proof.predecessorRevision,target.predecessor);proofs.set(file,proof);}
 for(const pin of[target.graph,target.event]){const proof=proofs.get(pin.file),record=binding.records[pin.file];assert(proof);assert.equal(record.baselineMode,pin.mode);assert.equal(record.baselineBlob,pin.blob);assert.equal(record.baselineSha256,pin.sha256);assert.equal(Buffer.byteLength(proof.baselineText),pin.bytes);assert.equal(crypto.createHash('sha256').update(proof.baselineText).digest('hex'),pin.sha256,'Complete genuine Commerce baseline bytes');assert.equal(crypto.createHash('sha1').update('blob '+Buffer.byteLength(proof.baselineText)+'\0').update(proof.baselineText).digest('hex'),pin.blob,'Complete genuine Commerce Git blob');}
 return true;
}
function reviewedFinalServicesCommerceEventHistory(profile,input){
 const target=FINAL_SERVICES_COMMERCE_GRAPH_TARGET;assert.equal(profile.file,target.event.file);assert(hasFinalServicesCommerceSource(profile.file));
 const proof=assertFinalServicesCommerceSourceTransfer(profile.file,input);assert.equal(proof.phase,'EXACT_FINAL_SERVICES_OVER_COMMERCE_SOURCE_ONLY');assert.equal(proof.sourceOnly,true);assert.equal(proof.nativeAdmission,false);assert.equal(proof.predecessorRevision,target.predecessor);assert.equal(proof.sourceRevision,FINAL_SERVICES_COMMERCE_SOURCE_BINDING.sourceRevision);
 assert.equal(crypto.createHash('sha256').update(proof.baselineText).digest('hex'),target.event.sha256);assert.equal(crypto.createHash('sha1').update('blob '+Buffer.byteLength(proof.baselineText)+'\0').update(proof.baselineText).digest('hex'),target.event.blob);
 return reviewedCommerceEventHistory(profile,proof.baselineText);
}
assertFinalServicesCommerceGraphSources(file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'));
const g = build();
const c = census(g);

// ── the graph is not empty ───────────────────────────────────────────────────────────────────────
// Floors, not exact counts: this repo grows every session and a guard that nags on unrelated work
// gets deleted. But each floor is far enough above zero that a broken extractor cannot clear it.
assert(c.byNode.Module >= 90, `expected ~100 modules, extracted ${c.byNode.Module}`);
assert(c.byNode.Suite >= 50, `expected ~53 suites, extracted ${c.byNode.Suite}`);
assert(c.byNode.Lever >= 500, `expected 500+ levers from the rules tail, extracted ${c.byNode.Lever}`);
assert(c.byNode.Reason >= 200, `expected 200+ ledger reasons, extracted ${c.byNode.Reason}`);
assert(c.byNode.Check >= 20, `expected 21 invariant checks, extracted ${c.byNode.Check}`);
assert(c.byNode.Pattern >= 50, `expected 50+ named precedents cited in src, extracted ${c.byNode.Pattern}`);
for (const t of ['DEFINES', 'READS', 'PINS', 'EMITS', 'RECONCILES', 'COVERS', 'CITES', 'MENTIONS']) {
  assert(c.byEdge[t] > 0, `no ${t} edges — that extractor is dead`);
}
console.log(`✓ census: ${c.nodes} nodes / ${c.edges} edges across ${NODE_TYPES.length} node and ${EDGE_TYPES.length} edge types`);

// ── the graph's own write invariants (paper §Appendix) ───────────────────────────────────────────
const inv = checkGraph(g);
assert(inv.ok, `graph invariants failed:\n  ${inv.problems.join('\n  ')}`);
// Only the genuinely computed-term checks may reconcile no literal reason. If another appears,
// the term extractor has regressed and the coverage query below has quietly gone blind.
// `desk inventory backed` joins them for a different and honest reason: it reconciles a bucket
// against its OWN books (balance vs lifetime_in − lifetime_sold) and names no ledger reason at all.
// Its sibling `desk inventory ledgered` is the one that reconciles desk:recycle, and the parser can
// read that one — which is why the literal lives in its SQL.
assert.deepEqual(inv.mute.sort(), [
  'agent acquisition budget accounting',
  'atomic barter canonical two-item bindings',
  // Consent/provenance checks introduce no money bucket; canonical cash/GIN
  // custody remains independently reconciled by the corresponding ledger checks.
  'business relocation history',
  'buyer cooperative settlement provenance',
  'character cash',
  'company bank portfolio authority and lifetime budget',
  'company middle five source bindings',
  'company succession bindings',
  'company workflow provenance',
  'cross docking canonical source and handoff history',
  'delivery finance bindings',
  'desk inventory backed',
  'equipment collateral canonical loan and custody history',
  'equipment recovery consumed UID and material history',
  'equipment rental physical title',
  'family operation capital',
  'family operation custody',
  'family operation history',
  'franchise royalty conservation',
  'franchise royalty provenance',
  'freight metadata history bindings',
  'logistics coverage bindings',
  'merchant loyalty original purchase bindings',
  'mobile shop canonical source/history',
  'physical equipment condition provenance',
  'player funded event history',
  'production booking canonical history',
  'production slot canonical reservation history',
  'protection contracts canonical history',
  'reason vocabulary',
  'sale attribution completed sale and consent bindings',
  'service subscription repair bindings',
  'shopping basket canonical sale bindings',
  'strategy laboratory canonical observations',
  'strategy league bindings',
  'strategy license bindings',
  'syndicated loan canonical facility provenance',
  'warehouse journal ownership',
  'worker training canonical source',
  'workshop floor source and allocation history',
  'world graph object transitions',
  'world graph salvage car audit',
  'world graph stack conservation',
  'world graph unique custody and provenance',
],
  `unexpected checks reconcile no reason — the SQL term parser missed a shape: ${inv.mute.join(', ')}`);
for (const [check, reasons] of [
  ['buyer cooperative cash custody', ['buyer_cooperative:fund', 'buyer_cooperative:refund', 'market:order', 'market:list', 'market:refund', 'buyer_cooperative:death_cash', 'buyer_cooperative:loot_cash']],
  ['buyer cooperative GIN custody', ['buyer_cooperative:claim', 'buyer_cooperative:death_gin']],
]) for (const reason of reasons) assert(g.edges.some(edge => edge.type === 'RECONCILES' && edge.from === 'Check:' + check && edge.to === 'Reason:' + reason), 'cooperative currency graph coverage lost: ' + check + ' / ' + reason);
const NON_CURRENCY_WORLD_GRAPH_CHECKS = new Map([
  ...ENTERPRISE_STRUCTURAL_CHECKS.map(p => [p.check, p.why]),
  ...COMMERCE_STRUCTURAL_CHECKS.map(p => [p.check, p.why]),
  ...FINAL_SERVICES_STRUCTURAL_CHECKS.map(p => [p.check, p.why]),
  ['atomic barter canonical two-item bindings', 'original-party exact two physical-item transfer and replay witnesses; no cash'],
  ['cross docking canonical source and handoff history', 'original courier/hub/item/handoff receipt bindings; canonical courier fees reconcile separately'],
  ['production slot canonical reservation history', 'original commission/profile/window/production receipt bindings; canonical commission fees reconcile separately'],
  ['freight metadata history bindings', 'original manifest/consent/completion receipt identities; canonical cash and GIN remain independently reconciled'],
  ['equipment rental physical title', 'exact physical custody/title and original paid lease bindings'],
  ['service subscription repair bindings', 'original consent, actual repair and exact cycle payment bindings'],
  ['strategy laboratory canonical observations', 'recorded canonical observation amounts, sources and exposure; no payout or currency custody'],
  ['strategy league bindings', 'original-account cohort consent, private rules/licenses and shared prospective outcome bindings'],
  ['warehouse journal ownership', 'warehouse lease/depot/tenant journal ownership'],
  ['family operation custody', 'Family promise, actual contribution, and escrow conservation'],
  ['family operation history', 'Family operation revision and replay receipt authority'],
  ['world graph object transitions', 'world object history and consumed-item receipt authority'],
  ['world graph salvage car audit', 'authoritative noncurrency salvage sink'],
  ['world graph stack conservation', 'custody conservation'],
  ['world graph unique custody and provenance', 'unique custody/provenance'],
]);
for (const [name, taxonomy] of NON_CURRENCY_WORLD_GRAPH_CHECKS) {
  assert(g.nodes.has(`Check:${name}`), `${taxonomy} check disappeared from the invariant graph`);
  assert.equal(g.edges.some((edge) => (
    edge.type === 'RECONCILES' && edge.from === `Check:${name}`
  )), false, `${taxonomy} SQL must not be misclassified as a transaction currency/reason term`);
}
// These two issue-count checks validate canonical metadata, not another cash
// bucket. Keep both their read-only scope and the real parent cash edges explicit.
for (const [file, name] of [
  ['crossdocking.js', 'collectCrossDockIssues'],
  ['productionslots.js', 'collectProductionSlotIssues'],
]) {
  const source = fs.readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');
  const collector = source.split('\n').find(line => line.startsWith('export async function ' + name + '(c){'));
  assert(collector, 'Canonical source-only collector disappeared: ' + name);
  assert.doesNotMatch(collector, /\b(?:FROM|INTO|UPDATE)\s+(?:transactions|resource_ledger|resource_treasuries)\b/i,
    'A monetary collector requires real graph reconciliation, not the provenance taxonomy');
  assert.doesNotMatch(collector, /\b(?:INSERT|UPDATE|DELETE)\s/i, 'History collection must remain read-only');
}
for (const [name, prefix] of [
  ['multi-hop courier reserved fees', 'multi_hop_courier'],
  ['commissioned crafting reserved fee', 'commissioned_crafting'],
]) for (const suffix of ['reserve', 'fee', 'refund']) {
  assert(g.edges.some(edge => edge.type === 'RECONCILES'
    && edge.from === 'Check:' + name && edge.to === 'Reason:' + prefix + ':' + suffix),
  'Canonical cash reconciliation lost: ' + name + '/' + suffix);
}
// Enterprise provenance remains closed to reviewed whole helper bytes and the
// exact issue-only push; imported royalty arithmetic must have real reason edges.
const enterpriseInvariant=fs.readFileSync(new URL('../src/invariants.js',import.meta.url),'utf8').replace(/\r\n?/g,'\n');
for(const p of ENTERPRISE_STRUCTURAL_CHECKS){
  const helper=fs.readFileSync(new URL('../'+p.file,import.meta.url),'utf8').replace(/\r\n?/g,'\n');
  assert.equal(crypto.createHash('sha256').update(helper).digest('hex'),p.sha256,'Reviewed structural helper changed: '+p.file);
  assert.equal(enterpriseInvariant.split('\n').filter(line=>line.trim()===p.push).length,1,'Provenance check gained unknown arithmetic or lost its binding');
}
const enterpriseMoneyProfile=ENTERPRISE_HELPER_PROFILES[0];
assert.equal(ENTERPRISE_HELPER_PROFILES.length,1);assert.equal(ENTERPRISE_STRUCTURAL_CHECKS.length,4);
const enterpriseMoney=fs.readFileSync(new URL('../'+enterpriseMoneyProfile.file,import.meta.url),'utf8').replace(/\r\n?/g,'\n');
const royaltyTerms=extractEnterpriseHelperReconciliations(enterpriseInvariant,{[enterpriseMoneyProfile.file]:enterpriseMoney});
assert.deepEqual(royaltyTerms.map(t=>t.reason),['manufacturing_license:pay','manufacturing_license:receive']);
assert(royaltyTerms.every(t=>t.check===enterpriseMoneyProfile.check&&t.sourceSha256===enterpriseMoneyProfile.sha256&&t.line>0&&t.bindingLine>0));
assert.deepEqual(extractEnterpriseHelperReconciliations(enterpriseInvariant.replaceAll('\n','\r\n'),{[enterpriseMoneyProfile.file]:enterpriseMoney.replaceAll('\n','\r\n')}),royaltyTerms);
for(const reason of royaltyTerms.map(t=>t.reason))assert(g.edges.some(e=>e.type==='RECONCILES'&&e.from==='Check:'+enterpriseMoneyProfile.check&&e.to==='Reason:'+reason),'Real royalty reason coverage lost: '+reason);
for(const bad of[enterpriseMoney+' ',enterpriseMoney.replace('royaltyNet=receivedCash-paidCash','royaltyNet=0'),enterpriseMoney.replace("leg.currency!=='cash'","leg.currency!=='gin'")])assert.deepEqual(extractEnterpriseHelperReconciliations(enterpriseInvariant,{[enterpriseMoneyProfile.file]:bad}),[]);
for(const literal of[enterpriseMoneyProfile.import,enterpriseMoneyProfile.call,enterpriseMoneyProfile.push])for(const bad of[enterpriseInvariant.replace(literal,''),enterpriseInvariant+'\n'+literal])assert.deepEqual(extractEnterpriseHelperReconciliations(bad,{[enterpriseMoneyProfile.file]:enterpriseMoney}),[]);
assert.deepEqual(extractEnterpriseHelperReconciliations(enterpriseInvariant,{[enterpriseMoneyProfile.file]:enterpriseMoney,'src/unknown.js':enterpriseMoney}),[]);
assert(!inv.mute.includes(enterpriseMoneyProfile.check),'Actual royalty accounting must never be classified as mute provenance');
// TEST-only historical evidence: the production graph keeps current raw sources.
// S150 first validates all actual current bytes; this separate one-context witness
// reaches the frozen C4f profile from actual Commerce F without changing either pin.
const COMMERCE_EVENT_HISTORY_WITNESS=Object.freeze({"file":"src/eventmarkets.js","currentSource":"29598e24bf93813541730aaafb5a556066f7d637","currentSha256":"94ca7d9a06043c262519d6f4684c09056f05c1035d2f9896db3e68b436aa8816","currentBlob":"ddc5c8fbc38084a732d8a44b1542cd99c5d5778d","profileRevision":"4f5fde87c29453a71f027fae5f694f44e8677b3d","profileSha256":"c154f5fc04bb20adf223b7201d66282a37b5580b05d841ecb244de633eeefe9a","profileBlob":"0c04bd5df7fbde44cab4a18c37f25c59ce02fb02","contextLines":3,"current":"    if(r.state!=='active'||!((account===r.vendor_account&&ch.id===r.vendor_character)||(account===r.pickup_account&&ch.id===r.pickup_character)))fail('original_provider');await signedVendor(c,r);await signedVenue(c,r);await suspend(c,r);\n   }else if(action==='join'){\n    if(r.state!=='active'||[r.host_account,r.vendor_account,r.source_json.pickup.accountId].includes(account)||ch.loc!==r.district)fail('participant');await signedVendor(c,r);await signedVenue(c,r);const m=await A(),a=await m.eventMarketAttributionReference(c,input.attributionId,input.attributionHash),slot=r.source_json.campaigns.find(x=>x.campaignId===a.campaignId&&x.campaignHash===a.campaignHash);if(!slot||a.buyer.accountId!==account||a.buyer.characterId!==ch.id)fail('attribution_source');const s=await live(c,r,slot.campaignId);const rows=(await c.query(\"SELECT * FROM event_market_participants WHERE event_id=$1 AND state IN ('joined','visited','completed') ORDER BY id LIMIT 4\",[r.id])).rows;if(rows.length>=Number(r.slots)||rows.some(x=>x.campaign_id===slot.campaignId))fail('slot_capacity');if((await c.query('SELECT id FROM event_market_participants WHERE event_id=$1 AND buyer_account=$2 LIMIT 1',[r.id,account])).rows.length)fail('participation_immutable');if((await c.query(\"SELECT id FROM event_market_participants WHERE buyer_account=$1 AND state IN ('joined','visited') LIMIT 1\",[account])).rows.length)fail('participant_capacity');\n    // Stock stays canonical N11 inventory. Lock shop before listing, matching canonical mobile admission; never mint extra visits.\n    const shop=(await c.query('SELECT listing_id,remaining_quantity,status FROM mobile_shops WHERE id=$1 FOR UPDATE',[r.shop_id])).rows[0],listing=(await c.query('SELECT qty,status FROM market_listings WHERE id=$1 FOR UPDATE',[r.source_json.listingId])).rows[0];if(!shop||shop.status!=='active'||shop.listing_id!==r.source_json.listingId||listing?.status!=='live'||Number(listing.qty)!==Number(shop.remaining_quantity)||Number(shop.remaining_quantity)<rows.filter(x=>x.state==='joined').length+1)fail('stock_capacity');\n    const at=await clock(c);p={id:crypto.randomUUID(),event_id:r.id,buyer_account:account,buyer_character:ch.id,attribution_id:input.attributionId,attribution_hash:input.attributionHash,campaign_id:slot.campaignId,campaign_hash:slot.campaignHash,item_id:slot.itemId,state:'joined',created_at:at,visit_json:null,completion_json:null,reward_journal:null,reward_cash:0};p.source_hash=participantHash(r,p);registerItemTransactionUndo(c,()=>c.query('DELETE FROM event_market_participants WHERE id=$1',[p.id]));await c.query('INSERT INTO event_market_participants(id,event_id,buyer_account,buyer_character,attribution_id,attribution_hash,campaign_id,campaign_hash,item_id,source_hash,state,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[p.id,r.id,account,ch.id,p.attribution_id,p.attribution_hash,p.campaign_id,p.campaign_hash,p.item_id,p.source_hash,p.state,at]);\n   }else if(action==='cancel'||action==='expire'){\n    if(ch.id!==r.host_character||account!==r.host_account||!['offered','active','suspended'].includes(r.state))fail('original_host');const expired=+await clock(c)>=+new Date(r.expires_at),pending=(await c.query(\"SELECT id FROM event_market_participants WHERE event_id=$1 AND state IN ('joined','visited') LIMIT 1\",[r.id])).rows.length;if(action==='expire'&&!expired)fail('not_expired');if(action==='cancel'&&pending&&!expired&&r.state!=='suspended'){const originals=(await c.query('SELECT id,alive FROM characters WHERE id IN ($1,$2)',[r.vendor_character,r.source_json.pickup.characterId])).rows;if(originals.length!==2||originals.every(x=>x.alive))fail('reserved_participants');}extra.refundedCash=await refund(c,r,ch,expired?'expired':'closed');\n","baseline":"    if(r.state!=='active'||!((account===r.vendor_account&&ch.id===r.vendor_character)||(account===r.pickup_account&&ch.id===r.pickup_character)))fail('original_provider');await signedVendor(c,r);await signedVenue(c,r);await suspend(c,r);\n   }else if(action==='join'){\n    if(r.state!=='active'||[r.host_account,r.vendor_account,r.source_json.pickup.accountId].includes(account)||ch.loc!==r.district)fail('participant');await signedVendor(c,r);await signedVenue(c,r);const m=await A(),a=await m.eventMarketAttributionReference(c,input.attributionId,input.attributionHash),slot=r.source_json.campaigns.find(x=>x.campaignId===a.campaignId&&x.campaignHash===a.campaignHash);if(!slot||a.buyer.accountId!==account||a.buyer.characterId!==ch.id)fail('attribution_source');const s=await live(c,r,slot.campaignId);const rows=(await c.query(\"SELECT * FROM event_market_participants WHERE event_id=$1 AND state IN ('joined','visited','completed') ORDER BY id LIMIT 4\",[r.id])).rows;if(rows.length>=Number(r.slots)||rows.some(x=>x.campaign_id===slot.campaignId))fail('slot_capacity');if((await c.query('SELECT id FROM event_market_participants WHERE event_id=$1 AND buyer_account=$2 LIMIT 1',[r.id,account])).rows.length)fail('participation_immutable');if((await c.query(\"SELECT id FROM event_market_participants WHERE buyer_account=$1 AND state IN ('joined','visited') LIMIT 1\",[account])).rows.length)fail('participant_capacity');\n    // Stock stays canonical N11 inventory. Lock its exact metadata/listing after event, never mint extra visits.\n    const listing=(await c.query('SELECT qty,status FROM market_listings WHERE id=$1 FOR UPDATE',[r.source_json.listingId])).rows[0],shop=(await c.query('SELECT listing_id,remaining_quantity,status FROM mobile_shops WHERE id=$1 FOR UPDATE',[r.shop_id])).rows[0];if(!shop||shop.status!=='active'||shop.listing_id!==r.source_json.listingId||listing?.status!=='live'||Number(listing.qty)!==Number(shop.remaining_quantity)||Number(shop.remaining_quantity)<rows.filter(x=>x.state==='joined').length+1)fail('stock_capacity');\n    const at=await clock(c);p={id:crypto.randomUUID(),event_id:r.id,buyer_account:account,buyer_character:ch.id,attribution_id:input.attributionId,attribution_hash:input.attributionHash,campaign_id:slot.campaignId,campaign_hash:slot.campaignHash,item_id:slot.itemId,state:'joined',created_at:at,visit_json:null,completion_json:null,reward_journal:null,reward_cash:0};p.source_hash=participantHash(r,p);registerItemTransactionUndo(c,()=>c.query('DELETE FROM event_market_participants WHERE id=$1',[p.id]));await c.query('INSERT INTO event_market_participants(id,event_id,buyer_account,buyer_character,attribution_id,attribution_hash,campaign_id,campaign_hash,item_id,source_hash,state,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[p.id,r.id,account,ch.id,p.attribution_id,p.attribution_hash,p.campaign_id,p.campaign_hash,p.item_id,p.source_hash,p.state,at]);\n   }else if(action==='cancel'||action==='expire'){\n    if(ch.id!==r.host_character||account!==r.host_account||!['offered','active','suspended'].includes(r.state))fail('original_host');const expired=+await clock(c)>=+new Date(r.expires_at),pending=(await c.query(\"SELECT id FROM event_market_participants WHERE event_id=$1 AND state IN ('joined','visited') LIMIT 1\",[r.id])).rows.length;if(action==='expire'&&!expired)fail('not_expired');if(action==='cancel'&&pending&&!expired&&r.state!=='suspended'){const originals=(await c.query('SELECT id,alive FROM characters WHERE id IN ($1,$2)',[r.vendor_character,r.source_json.pickup.characterId])).rows;if(originals.length!==2||originals.every(x=>x.alive))fail('reserved_participants');}extra.refundedCash=await refund(c,r,ch,expired?'expired':'closed');\n"});
function reviewedCommerceEventHistory(profile,input){
 const witness=COMMERCE_EVENT_HISTORY_WITNESS;
 assert.equal(profile.file,witness.file,'Only the reviewed event history path');
 assert.equal(profile.revision,witness.profileRevision,'Exact historical profile revision');
 assert.equal(profile.sha256,witness.profileSha256,'Exact historical whole source SHA');
 assert.equal(profile.blob,witness.profileBlob,'Exact historical whole Git blob');
 const proof=assertCommerceOwnedSource(witness.file,input);
 assert.equal(proof.sourceRevision,witness.currentSource,'Exact immutable Commerce owned-source witness');
 assert.equal(proof.phase,"exact Commerce source compatibility only; no native, migration, financial, release or deployment clearance");
 const current=input.replaceAll('\r\n','\n');
 const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
 const blob=text=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(text)+'\0').update(text).digest('hex');
 assert.equal(hash(current),witness.currentSha256,'Whole actual Commerce event source');
 assert.equal(blob(current),witness.currentBlob,'Whole actual Commerce event blob');
 assert.equal(current.split(witness.current).length,2,'Complete unique historical context');
 const baseline=current.replace(witness.current,()=>witness.baseline);
 assert.equal(hash(baseline),profile.sha256,'Complete frozen event history source');
 assert.equal(blob(baseline),profile.blob,'Complete frozen event history blob');
 return baseline;
}
// Original Commerce histories are source-bound; their real cash reserves and
// delegated consignment payments may not disappear behind a mute classification.
assert.equal(COMMERCE_STRUCTURAL_CHECKS.length,4);
for(const p of COMMERCE_STRUCTURAL_CHECKS){
  const rawHelper=fs.readFileSync(new URL('../'+p.file,import.meta.url),'utf8');
  const helper=p.file===COMMERCE_EVENT_HISTORY_WITNESS.file?reviewedFinalServicesCommerceEventHistory(p,rawHelper):rawHelper.replace(/\r\n?/g,'\n');
  assert.equal(crypto.createHash('sha256').update(helper).digest('hex'),p.sha256,'Reviewed Commerce history changed: '+p.file);
  assert.equal(enterpriseInvariant.split('\n').filter(line=>line.trim()===p.push).length,1,'Unknown Commerce history arithmetic/binding');
}
// These adversarial reads never change the production graph or current Commerce
// assertions below. Current-byte mutations must refuse before historical inversion.
const commerceEventProfile=COMMERCE_STRUCTURAL_CHECKS.find(p=>p.file===COMMERCE_EVENT_HISTORY_WITNESS.file);
const commerceEventInput=fs.readFileSync(new URL('../'+COMMERCE_EVENT_HISTORY_WITNESS.file,import.meta.url),'utf8');
const commerceEventLF=commerceEventInput.replaceAll('\r\n','\n');
const commerceEventHistory=reviewedCommerceEventHistory(commerceEventProfile,commerceEventInput);
assert.equal(reviewedCommerceEventHistory(commerceEventProfile,commerceEventLF.replaceAll('\n','\r\n')),commerceEventHistory);
assert(commerceEventLF.includes("'event_market:reserve'"),'Actual reserve accounting anchor required');
for(const bad of[
 commerceEventLF+'\n// unknown current source\n',
 '\ufeff'+commerceEventLF,commerceEventLF+'\0',
 commerceEventLF.replace('\n','\r'),commerceEventLF.replace('\n','\r\n'),
 commerceEventLF.replace("'event_market:reserve'","'event_market:unknown'"),
 commerceEventLF.replace(COMMERCE_EVENT_HISTORY_WITNESS.current,''),
 commerceEventLF.replace(COMMERCE_EVENT_HISTORY_WITNESS.current,()=>COMMERCE_EVENT_HISTORY_WITNESS.current+'\n'+COMMERCE_EVENT_HISTORY_WITNESS.current),
 commerceEventHistory,Buffer.from(commerceEventLF),null
])assert.throws(()=>reviewedCommerceEventHistory(commerceEventProfile,bad),'Unknown, altered accounting, context or historical raw input must refuse');
for(const changed of[
 {...commerceEventProfile,file:'src/unknown.js'},
 {...commerceEventProfile,revision:'0'.repeat(40)},
 {...commerceEventProfile,sha256:'0'.repeat(64)},
 {...commerceEventProfile,blob:'0'.repeat(40)}
])assert.throws(()=>reviewedCommerceEventHistory(changed,commerceEventInput),'Unknown historical profile must refuse');
for(const [check,prefix,suffixes]of[
 ['sale attribution merchant cash reserve','sale_attribution',['reserve','commission','refund']],
 ['player funded event reserves','event_market',['reserve','reward','refund']],
 ['consignment sale books','consignment',['purchase','proceeds','host_fee']],
])for(const suffix of suffixes)assert(g.edges.some(e=>e.type==='RECONCILES'&&e.from==='Check:'+check&&e.to==='Reason:'+prefix+':'+suffix),'Commerce cash coverage lost: '+check+'/'+suffix);
for(const[check,prefix]of[['multi-hop courier custody and fee source','multi_hop_courier'],['commissioned crafting canonical sources','commissioned_crafting']])for(const suffix of['reserve','fee','refund'])assert(g.edges.some(e=>e.type==='RECONCILES'&&e.from==='Check:'+check&&e.to==='Reason:'+prefix+':'+suffix),'Reviewed canonical cash/source helper lost: '+check+'/'+suffix);
// Final-service histories retain genuine cash edges and complete closed-source witnesses.
assert.equal(FINAL_SERVICES_STRUCTURAL_CHECKS.length,4);
for(const p of FINAL_SERVICES_STRUCTURAL_CHECKS){
 const helper=fs.readFileSync(new URL('../'+p.file,import.meta.url),'utf8').replace(/\r\n?/g,'\n');
 assert.equal(crypto.createHash('sha256').update(helper).digest('hex'),p.sha256,'Reviewed final-service history changed');
 assert.equal(enterpriseInvariant.split('\n').filter(line=>line.trim()===p.push).length,1,'Unknown final-service history arithmetic/binding');
}
assert.equal(FINAL_SERVICES_HELPER_PROFILES.length,5);
for(const p of FINAL_SERVICES_HELPER_PROFILES){
 const helper=fs.readFileSync(new URL('../'+p.file,import.meta.url),'utf8'),terms=extractFinalServicesHelperReconciliations(enterpriseInvariant,{[p.file]:helper}).filter(t=>t.check===p.check);
 assert.deepEqual(terms.map(t=>t.reason),p.terms.map(t=>t[0]),'Current final-service accounting witnesses lost');
 for(const reason of p.terms.map(t=>t[0]))assert(g.edges.some(e=>e.type==='RECONCILES'&&e.from==='Check:'+p.check&&e.to==='Reason:'+reason),'Final-service cash edge lost: '+p.check+'/'+reason);
}
for(const[check,prefix,suffixes]of[
 ['production booking reserved bonus','production_booking',['bonus_reserve','bonus','bonus_refund']],
 ['protection contracts reserved cash','protection',['reserve','release','refund']],
 ['loan escrow','loan',['offer','take','refund','death','loot']],
])for(const suffix of suffixes)assert(g.edges.some(e=>e.type==='RECONCILES'&&e.from==='Check:'+check&&e.to==='Reason:'+prefix+':'+suffix),'Dedicated original cash edge lost: '+check+'/'+suffix);
// Ownership checks structural journal references; warehouse cash still needs its
// separate literal ledger reconciliation, which must not join the mute list.
const warehouseAudit = fs.readFileSync(new URL('../src/invariants.js', import.meta.url), 'utf8');
assert.match(warehouseAudit, /push\('warehouse journal ownership', depotJournal\.filter\(j => j\.lease_id \? !warehouseLeases\.some\(l =>\s*l\.id === j\.lease_id && l\.depot_id === j\.depot_id && l\.tenant_character === j\.customer_character\)/);
assert(g.edges.some((edge) => edge.type === 'RECONCILES'
  && edge.from === 'Check:warehouse rent ledger' && edge.to === 'Reason:warehouse:rent'),
  'warehouse rent must retain monetary ledger reconciliation');
// This imported helper reconciles cash with grouped SQL and BigInt, beyond the
// lexical term parser. Keep that currency blind spot explicit, separately from
// the noncurrency checks, and pin its real ledger vocabulary and equation.
assert(g.nodes.has('Check:family operation capital'));
assert.equal(g.edges.some((edge) => edge.type === 'RECONCILES' && edge.from === 'Check:family operation capital'), false);
const familyCapitalAudit = fs.readFileSync(new URL('../src/coordination/operation-invariants.js', import.meta.url), 'utf8');
assert.match(familyCapitalAudit, /FROM transactions WHERE reason LIKE 'coordination:capital:%'/);
assert.match(familyCapitalAudit, /row\.currency !== 'cash'/);
assert.match(familyCapitalAudit, /\['deposit', 'refund', 'spend', 'forfeit'\]\.includes\(reason\)/);
assert.match(familyCapitalAudit, /BigInt\(row\.amount\)/);
assert.match(familyCapitalAudit, /heldCash\.reduce\(\(sum, r\) => sum \+ BigInt\(r\.amount\), 0n\) !== \(balances\.get\(operation\.id\) \|\| 0n\)/);
const invariantSource = fs.readFileSync(new URL('../src/invariants.js', import.meta.url), 'utf8');
// Prize-free cohorts bind identities, private consent and a shared observation;
// their structural fault count is not a currency bucket or ledger reason.
const leagueAudit = fs.readFileSync(new URL('../src/strategyleagueinvariants.js', import.meta.url), 'utf8');
assert.doesNotMatch(leagueAudit, /\b(?:FROM|INTO|UPDATE)\s+(?:transactions|resource_ledger|resource_treasuries)\b/i,
  'The league binding helper must not silently become monetary accounting');
assert(g.edges.some(edge => edge.type === 'RECONCILES'
  && edge.from === 'Check:logistics coverage escrow' && edge.to === 'Reason:coverage:%'),
  'Funded coverage must reconcile actual escrow against its cash ledger');

assert(g.edges.some(edge => edge.type === 'RECONCILES'
  && edge.from === 'Check:strategy license transfers' && edge.to === 'Reason:strategy:%'),
  'Strategy licenses must reconcile their actual paired game-cash ledger');

// An advance is metadata over canonical loan escrow, not another cash bucket.
// Pin the real debt/receipt checks and retain the underlying monetary edge.
assert.match(invariantSource, /const financeRequests = .*SELECT \* FROM delivery_loan_requests/);
assert.match(invariantSource, /loan\.borrower_character !== request\.supplier_character/);
assert.match(invariantSource, /repayment\.paid !== owed \|\| repayment\.vig !== loanVig\(owed\)/);
assert.match(invariantSource, /push\('delivery finance bindings', financeFaults, 0, 0\)/);
assert(g.edges.some(edge => edge.type === 'RECONCILES'
  && edge.from === 'Check:loan escrow' && edge.to === 'Reason:loan:offer'));
const intelHelperSource = fs.readFileSync(new URL('../src/intelforecastinvariants.js', import.meta.url), 'utf8');
const employmentHelperSource = fs.readFileSync(new URL('../src/gameemploymentinvariants.js', import.meta.url), 'utf8');
const employmentTerms = extractEmploymentHelperReconciliations(invariantSource, employmentHelperSource);
assert.deepEqual(employmentTerms.map(term => [term.check, term.reason]), [
  ['game employment escrow', 'employment:%'], ['game employment escrow', 'death:employment:%'],
  ['game employment escrow', 'employment:estate:loot:%'], ['game employment loot ledger', 'employment:estate:loot:%'],
]);
assert.deepEqual(extractEmploymentHelperReconciliations(normalizeText(invariantSource).replaceAll('\n', '\r\n'),
  normalizeText(employmentHelperSource).replaceAll('\n', '\r\n')), employmentTerms);
for (const term of employmentTerms) {
  const edge = g.edges.find(edge => edge.type === 'RECONCILES'
    && edge.from === `Check:${term.check}` && edge.to === `Reason:${term.reason}`);
  assert(edge, 'imported employment cash terms must have actual helper provenance');
  assert.equal(edge.prov.file, 'src/gameemploymentinvariants.js');
  assert(edge.prov.hash && edge.prov.binding.hash);
}
assert(!g.edges.some(edge => edge.type === 'RECONCILES'
  && edge.from === 'Check:game employment loot ledger' && edge.to === 'Reason:employment:%'));
for (const source of [
  invariantSource.replace(/import \{ employmentCashInvariant \} from [^;]+;/, ''),
  invariantSource.replace('await employmentCashInvariant(pool)', 'await unrelatedAccounting(pool)'),
  invariantSource.replace('await employmentCashInvariant(pool)', 'await employmentCashInvariant(null)'),
]) assert.deepEqual(extractEmploymentHelperReconciliations(source, employmentHelperSource), []);
for (const helper of [
  employmentHelperSource.replace("currency='cash'", "currency='rep'"),
  employmentHelperSource.replace("reason LIKE 'employment:%'", "reason = 'employment:reserve'"),
  employmentHelperSource.replace('AND character_id IS NOT NULL', 'AND character_id IS NULL'),
  employmentHelperSource.replace('expected = -transfers + death + loot', 'expected = -transfers + death'),
  employmentHelperSource.replace('lootedCash:bookLoot', 'lootedCash:unrelated'),
  employmentHelperSource.replace('lootDelta:bookLoot+loot', 'lootDelta:bookLoot'),
  employmentHelperSource.replace('export async function employmentCashInvariant', 'export async function unrelatedAccounting'),
  employmentHelperSource.replace('SUM(looted_cash)', 'SUM(cash)'),
  employmentHelperSource.replace(/  const death = [^\r\n]+/, ''),
  normalizeText(employmentHelperSource).replace(/  const loot = [^\n]+/, '$&\n$&'),
]) assert.deepEqual(extractEmploymentHelperReconciliations(invariantSource, helper), []);
assert.deepEqual(extractEmploymentHelperReconciliations(
  invariantSource.replace('employment.actual, employment.expected', 'employment.actual, unrelated.expected'),
  employmentHelperSource).map(term => term.check), ['game employment loot ledger']);
assert.deepEqual(extractEmploymentHelperReconciliations(
  invariantSource.replace('employment.lootedCash - employment.lootDelta', 'employment.lootedCash + employment.lootDelta'),
  employmentHelperSource).map(term => term.check), ['game employment escrow', 'game employment escrow', 'game employment escrow']);
const intelTerms = extractIntelHelperReconciliations(invariantSource, intelHelperSource);
assert.deepEqual(intelTerms.map(term => [term.check, term.reason]), [
  ['intel forecast escrow', 'intel_job:%'], ['intel forecast receipts', 'intel_job:%'],
]);
for (const term of intelTerms) {
  const edge = g.edges.find(edge => edge.type === 'RECONCILES'
    && edge.from === `Check:${term.check}` && edge.to === `Reason:${term.reason}`);
  assert(edge, 'actual imported Intel cash accounting must reconcile its SQL prefix');
  assert.equal(edge.prov.file, 'src/intelforecastinvariants.js');
  assert(edge.prov.hash && edge.prov.binding.hash, 'helper and call binding need whole-source provenance');
}
for (const source of [
  invariantSource.replace(/import \{ intelForecastAccounting \} from [^;]+;/, ''),
  invariantSource.replace('await intelForecastAccounting(pool)', 'await unrelatedAccounting(pool)'),
]) assert.deepEqual(extractIntelHelperReconciliations(source, intelHelperSource), []);
assert.deepEqual(extractIntelHelperReconciliations(invariantSource,
  intelHelperSource.replace("reason LIKE 'intel_job:%'", "reason = 'intel_job:post'")), []);
assert.deepEqual(extractIntelHelperReconciliations(invariantSource,
  intelHelperSource.replace("currency='cash'", "currency='rep'")), []);
assert.deepEqual(extractIntelHelperReconciliations(invariantSource,
  intelHelperSource.replace('return { escrow, expected, invalid }', 'return { unrelated }')), []);
assert.deepEqual(extractIntelHelperReconciliations(invariantSource,
  intelHelperSource.replace('export async function intelForecastAccounting', 'export async function unrelatedAccounting')), []);
assert.deepEqual(extractIntelHelperReconciliations(
  invariantSource.replace('intelForecasts.escrow, intelForecasts.expected', 'intelForecasts.unrelated, intelForecasts.expected'),
  intelHelperSource).map(term => term.check), ['intel forecast receipts']);
assert.deepEqual(extractIntelHelperReconciliations(
  invariantSource.replace('intelForecasts.invalid', 'unrelated.invalid'), intelHelperSource).map(term => term.check),
['intel forecast escrow']);
// Franchise royalties move cash inside depot journals, not transaction reasons.
// Keep this finite monetary classification separate from noncurrency checks.
for (const name of ['franchise royalty conservation', 'franchise royalty provenance']) {
  assert(g.nodes.has(`Check:${name}`));
  assert.equal(g.edges.some(edge => edge.type === 'RECONCILES' && edge.from === `Check:${name}`), false);
}
assert.match(invariantSource, /const depotCash = \(reason\) => depotJournal\.filter\(\(entry\) => entry\.reason === reason\)\.reduce\(\(n, entry\) => n \+ Number\(entry\.cash_delta\), 0\)/);
assert.match(invariantSource, /push\('franchise royalty conservation', -depotCash\('royalty_expense'\), depotCash\('royalty_income'\), 0\)/);
assert.match(invariantSource, /pair\.length !== 2 \|\| !debit \|\| !credit \|\| !sale \|\| sale\.reason !== 'sale'/);
assert.match(invariantSource, /debit\.depot_id !== license\.operator_depot_id \|\| credit\.depot_id !== license\.recipient_depot_id/);
assert.match(invariantSource, /Number\(debit\.cash_delta\) !== -Number\(credit\.cash_delta\)/);
assert.match(invariantSource, /push\('franchise royalty provenance', royaltyFaults, 0, 0\)/);
for (const reason of ['deposit', 'refund', 'spend', 'forfeit']) {
  assert(invariantSource.includes(`'coordination:capital:${reason}'`), `Family capital vocabulary lost ${reason}`);
}
assert(g.unparsed.some((entry) => entry.file === 'src/coordination/capital.js'
  && entry.kind === 'interpolated-reason' && entry.text === 'coordination:capital:${reason}'),
'dynamic Family capital ledger reasons must remain visible as an extractor limitation');

// Imported commercial checks reconcile money as well as original-source provenance.
const commercialHelpers = Object.fromEntries(['src/company-commercial-invariants.js','src/equipmentinsurance.js','src/territoryeconomics.js']
  .map(file => [file, fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8')]));
const commercialExpected = [
 ['company restructuring canonical receipt books','market:refund'],['company restructuring canonical receipt books','depot:withdraw'],
 ['commercial original source histories','market:refund'],
 ...['equipment_insurance:reserve','equipment_insurance:premium_pay','equipment_insurance:premium_receive','equipment_insurance:claim','equipment_insurance:refund','equipment_insurance:burn','death:equipment_insurance'].map(reason => ['equipment insurance original loss bindings',reason]),
 ['territory economics source and tribute bindings','depot:withdraw'],['territory economics source and tribute bindings','gang:tribute'],
];
const commercialTerms = extractCommercialHelperReconciliations(invariantSource, commercialHelpers);
assert.deepEqual(commercialTerms.map(term => [term.check,term.reason]), commercialExpected);
assert.deepEqual(extractCommercialHelperReconciliations(normalizeText(invariantSource).replaceAll('\n','\r\n'),
 Object.fromEntries(Object.entries(commercialHelpers).map(([file,text])=>[file,normalizeText(text).replaceAll('\n','\r\n')]))),commercialTerms);
for (const term of commercialTerms) {
 const edge=g.edges.find(edge=>edge.type==='RECONCILES'&&edge.from==='Check:'+term.check&&edge.to==='Reason:'+term.reason);
 assert(edge,'Actual commercial helper money must have a real graph edge');assert.equal(edge.prov.file,term.file);
 assert(edge.prov.hash&&edge.prov.binding.hash);assert.equal(edge.prov.binding.file,'src/invariants.js');
}
const commercialControls = [
  {
    "check": "company restructuring canonical receipt books",
    "file": "src/company-commercial-invariants.js",
    "fn": "collectCompanyRestructuringIssues",
    "variable": "restructuringIssues",
    "import": "import { collectCompanyRestructuringIssues, collectCommercialHistoryIssues } from './company-commercial-invariants.js';",
    "anchors": [
      "const issues=[],rows=",
      "Number(j.amount)!==amount",
      "j.character_id!==(cancel?null:p.original_character)",
      "Number(returned[0].cash_delta)!==refund"
    ],
    "reason": "market:refund"
  },
  {
    "check": "commercial original source histories",
    "file": "src/company-commercial-invariants.js",
    "fn": "collectCommercialHistoryIssues",
    "variable": "commercialHistoryIssues",
    "import": "import { collectCompanyRestructuringIssues, collectCommercialHistoryIssues } from './company-commercial-invariants.js';",
    "anchors": [
      "tx.reason!=='market:refund'",
      "tx.counterparty!==p.depot_id",
      "Number(tx.amount)!==amount",
      "Number(backing.cash_delta)!==-Number(q.quantity)*Number(q.unitPrice)"
    ],
    "reason": "market:refund"
  },
  {
    "check": "equipment insurance original loss bindings",
    "file": "src/equipmentinsurance.js",
    "fn": "collectEquipmentInsuranceIssues",
    "variable": "equipmentInsuranceIssues",
    "import": "import { collectEquipmentInsuranceIssues } from './equipmentinsurance.js';",
    "anchors": [
      "Number(p.maximum_cash)!==Number(p.escrow_cash)+Number(p.paid_cash)+Number(p.refunded_cash)+Number(p.burned_cash)",
      "t.currency==='cash'&&Number(t.amount)===amount",
      "t?.character_id===ch&&t.account_id===account",
      "Math.min(fee,Number(p.maximum_cash))"
    ],
    "reason": "equipment_insurance:reserve"
  },
  {
    "check": "territory economics source and tribute bindings",
    "file": "src/territoryeconomics.js",
    "fn": "collectTerritoryEconomicsIssues",
    "variable": "territoryIssues",
    "import": "import { collectTerritoryEconomicsIssues } from './territoryeconomics.js';",
    "anchors": [
      "a.character_id!==p.original_character",
      "Number(a.amount)!==Number(pay.amount_cash)",
      "Number(b.amount)!==-Number(pay.amount_cash)",
      "observed+=Number(j.cash_delta)+Number(j.cost_delta)",
      "observed-=Number(j.expense)"
    ],
    "reason": "depot:withdraw"
  }
];
let commercialNegativeControls=0;
const alter=(text,literal)=>{assert(text.includes(literal),'Mutation target must exist: '+literal);const changed=text.replace(literal,literal+'__changed');assert.notEqual(changed,text);return changed;};
for (const spec of commercialControls) {
 const absent=(inv,helpers)=>{assert.equal(extractCommercialHelperReconciliations(inv,helpers).some(term=>term.check===spec.check),false);commercialNegativeControls++;};
 absent(alter(invariantSource,spec.import),commercialHelpers);
 absent(alter(invariantSource,'await '+spec.fn+'(pool)'),commercialHelpers);
 absent(alter(invariantSource,spec.variable+'.length'),commercialHelpers);
 absent(alter(invariantSource,"push('"+spec.check+"'"),commercialHelpers);
 const call='const '+spec.variable+' = await '+spec.fn+'(pool);';
 absent(invariantSource.replace(call,call+'\n'+call),commercialHelpers);
 for(const literal of ["'"+spec.reason+"'",...spec.anchors]) absent(invariantSource,{...commercialHelpers,[spec.file]:alter(commercialHelpers[spec.file],literal)});
 absent(invariantSource,{...commercialHelpers,[spec.file]:commercialHelpers[spec.file]+'\n// unknown helper shape'});
 absent(invariantSource,{...commercialHelpers,[spec.file]:undefined});
}
console.log('✓ imported commercial accounting:12 actual monetary reason edges, LF/CRLF, '+commercialNegativeControls+' causal unknown/import/call/result/amount/reason/party controls');


// V imported paired cash must not become a mute; observation provenance has no ledger effect.
const autonomyHelpers = Object.fromEntries(['src/economicintelligence.js','src/strategylaboratories.js'].map(file=>[file,fs.readFileSync(new URL('../'+file,import.meta.url),'utf8')]));
const autonomyTerms = extractAutonomyHelperReconciliations(invariantSource,autonomyHelpers);
assert.deepEqual(autonomyTerms.map(t=>[t.check,t.reason]),[["economic intelligence paired provenance","economic_intelligence:pay"],["economic intelligence paired provenance","economic_intelligence:receive"]]);
assert.deepEqual(extractAutonomyObservationChecks(invariantSource,autonomyHelpers),['strategy laboratory canonical observations']);
assert.deepEqual(extractAutonomyHelperReconciliations(normalizeText(invariantSource).replaceAll('\n','\r\n'),Object.fromEntries(Object.entries(autonomyHelpers).map(([f,s])=>[f,normalizeText(s).replaceAll('\n','\r\n')]))),autonomyTerms);
for(const term of autonomyTerms){
 assert(!inv.mute.includes(term.check));
 assert(g.edges.some(e=>e.type==='RECONCILES'&&e.from==='Check:'+term.check&&e.to==='Reason:'+term.reason&&e.prov.file===term.file&&e.prov.binding.file==='src/invariants.js'));
}
let autonomyNegativeControls=0;
const autonomySpecs=[{"check":"economic intelligence paired provenance","file":"src/economicintelligence.js","fn":"economicIntelligenceTransferBooks","variable":"intelligenceBooks","import":"import { economicIntelligenceTransferBooks } from './economicintelligence.js';","call":"const intelligenceBooks = await economicIntelligenceTransferBooks(pool);","binding":"push('economic intelligence paired provenance', intelligenceBooks.status === 'reconciled' ? 0 : 1, 0, 0, { source: intelligenceBooks });","sha256":"6d93a9c38e7543fad2158a2939c832be21c043d4b5a6f7a0b7a61a5ab7a5571e","reasons":["economic_intelligence:pay","economic_intelligence:receive"]},{"check":"strategy laboratory canonical observations","file":"src/strategylaboratories.js","fn":"collectStrategyLaboratoryIssues","variable":"labIssues","import":"import { collectStrategyLaboratoryIssues } from './strategylaboratories.js';","call":"const labIssues = await collectStrategyLaboratoryIssues(pool);","binding":"push('strategy laboratory canonical observations', labIssues.length, 0, 0, { issues: labIssues });","sha256":"ab05631dfd519202317e099171449901add64b0ed83310b1a499eba2a60f61b9","reasons":[]}];
for(const spec of autonomySpecs){
 const absent=(source,helpers)=>{assert.equal(extractAutonomyHelperReconciliations(source,helpers).some(t=>t.check===spec.check),false);assert.equal(extractAutonomyObservationChecks(source,helpers).includes(spec.check),false);autonomyNegativeControls++;};
 for(const literal of [spec.import,spec.call,spec.binding]){
  assert(invariantSource.includes(literal));
  absent(invariantSource.replace(literal,literal+' /* changed */'),autonomyHelpers);
  absent(invariantSource.replace(literal,''),autonomyHelpers);
  absent(invariantSource.replace(literal,literal+'\n'+literal),autonomyHelpers);
 }
 absent(invariantSource,{...autonomyHelpers,[spec.file]:undefined});
 absent(invariantSource,{...autonomyHelpers,[spec.file]:autonomyHelpers[spec.file]+'\n// unknown shape'});
 const source=autonomyHelpers[spec.file];
 const anchors=spec.reasons.length?["-Number(p.price)","Number(p.price),'economic_intelligence:receive'","j.character_id!==character","j.currency!=='cash'","Number(j.amount)!==amount","j.reason!==reason","j.counterparty!==p.id","ids.has(journal)","ids.size!==legs.length","status:'unknown'","publication.terms_hash!==publicationHash(publication)","p.buyer_account===p.seller_account"]:["digest(l.terms)!==l.terms_hash","digest(frame)!==a.baseline.hash","a.baseline.ids.includes(sourceId)","r.depot_id!==l.business_id","customer.account_id===l.original_account","net+=Number(r.cash_delta)+Number(r.cost_delta)","net-=Number(r.expense)","net!==Number(view.observedProfitCash)","cost!==Number(l.observed_cost)","!view.noGuaranteedIncome","reason:'unbound_source'"];
 for(const literal of anchors){assert(source.includes(literal),literal);absent(invariantSource,{...autonomyHelpers,[spec.file]:source.replace(literal,literal+' /* altered */')});}
}
console.log('✓ autonomy graph: 2 actual intelligence monetary terms; source-bound observation provenance; '+autonomyNegativeControls+' causal refusals');


// These exact source-bound classifiers cannot supply fictitious cash edges.
const nextFiveMetadataHelpers=Object.fromEntries(["src/atomicbarterinvariants.js","src/freight-history.js"].map(file=>[file,fs.readFileSync(new URL('../'+file,import.meta.url),'utf8')]));
const nextFiveMetadataSpecs=[{"check":"atomic barter canonical two-item bindings","file":"src/atomicbarterinvariants.js","import":"import { collectAtomicBarterIssues } from './atomicbarterinvariants.js';","call":"const barterIssues = await collectAtomicBarterIssues(pool);","binding":"push('atomic barter canonical two-item bindings', barterIssues.length, 0, 0, { issues: barterIssues });","anchors":["request.account_ref !== request.account_id","request.actor_ref !==","guard.mutation_kind !== 'transfer_item'","guard.owner_id !== from","legs.length !== 1","legs[0].item_id !== itemId","legs[0].template_id !== 'item:precision_lock_tool'","legs[0].from_owner_id !== from","legs[0].to_owner_id !== to","!used.has(row.idempotency_key)"],"sha256":"9b85aa69ac3841f569957f60f9965964cdda8f22bab81b8f04bfe95ec218b18c"},{"check":"freight metadata history bindings","file":"src/freight-history.js","import":"import { collectFreightHistoryIssues } from './freight-history.js';","call":"const freightIssues = await collectFreightHistoryIssues(pool);","binding":"push('freight metadata history bindings', freightIssues.length, 0, 0, { issues: freightIssues });","anchors":["hash(m)!==b.manifest_hash","e[0].buyerAccount!==b.buyer_a_account","e[1].buyerCharacter!==b.buyer_b_character","e.reduce((n,v)=>n+v.quantity,0)!==m.quantity","a.manifest_hash===b.manifest_hash","accepts.length!==2","r.manifestHash!==b.manifest_hash","h.commitmentId!==e[i].commitmentId","h.receipt?.earned+h.receipt?.take!==h.receipt?.gross","r.earned!==r.handoffs.reduce((n,h)=>n+h.receipt.earned,0)"],"sha256":"48193e9c4c999bc8ab076fc2d4871d3e1fe88b0b4fb761dcdf7d9dec64538643"}];
assert.deepEqual(extractNextFiveMetadataChecks(invariantSource,nextFiveMetadataHelpers),["atomic barter canonical two-item bindings","freight metadata history bindings"]);
assert.deepEqual(extractNextFiveMetadataChecks(normalizeText(invariantSource).replaceAll('\n','\r\n'),Object.fromEntries(Object.entries(nextFiveMetadataHelpers).map(([f,s])=>[f,normalizeText(s).replaceAll('\n','\r\n')]))),["atomic barter canonical two-item bindings","freight metadata history bindings"]);
let nextFiveMetadataNegatives=0;
for(const spec of nextFiveMetadataSpecs){
 const absent=(inv,helpers)=>{assert(!extractNextFiveMetadataChecks(inv,helpers).includes(spec.check));nextFiveMetadataNegatives++;};
 assert(inv.mute.includes(spec.check));assert(!g.edges.some(e=>e.type==='RECONCILES'&&e.from==='Check:'+spec.check));
 for(const literal of [spec.import,spec.call,spec.binding]){assert(invariantSource.includes(literal));for(const value of ['',literal+' /* altered */',literal+'\n'+literal])absent(invariantSource.replace(literal,()=>value),nextFiveMetadataHelpers);}
 absent(invariantSource.replace(spec.call,'').replace(spec.binding,()=>spec.binding+'\n'+spec.call),nextFiveMetadataHelpers);
 absent(invariantSource.replace(spec.import,'').replace(spec.call,()=>spec.call+'\n'+spec.import),nextFiveMetadataHelpers);
 absent(invariantSource,{...nextFiveMetadataHelpers,[spec.file]:undefined});
 absent(invariantSource,{...nextFiveMetadataHelpers,[spec.file]:nextFiveMetadataHelpers[spec.file]+'\n// unknown source shape'});
 for(const literal of spec.anchors){assert(nextFiveMetadataHelpers[spec.file].includes(literal),literal);absent(invariantSource,{...nextFiveMetadataHelpers,[spec.file]:nextFiveMetadataHelpers[spec.file].replace(literal,()=>literal+'__altered')});}
}
assert.deepEqual(extractNextFiveMetadataChecks(invariantSource,{unknown:'unknown helper'}),[]);nextFiveMetadataNegatives++;
console.log('✓ first-five exact metadata classification:2 physical/history checks; LF/CRLF; '+nextFiveMetadataNegatives+' import/call/result/order/duplicate/party/title/source/unknown causal refusals; no invented cash edges');

console.log('✓ write invariants: provenance, authoring run, content hash, named rubrics, no dangling edges');

// ── extraction really found the things we know are in the tree ───────────────────────────────────
// Named specifically, because a floor can be cleared by garbage. These are facts about this repo.
const has = (k) => g.nodes.has(k);
assert(has('Lever:CASH_LOOT_RATE'), 'the P1.1 loot rate is a lever in the rules tail');
assert(has('Reason:whack:loot'), 'whack:loot is a ledger reason');
assert(has('Check:ring poker escrow'), 'the ring poker escrow check was extracted');
assert(has('Module:src/invariants.js') && has('Suite:test/ring.js'), 'modules and suites resolve');

// CITES is the query CLAUDE.md exists to serve by hand. The whack:loot precedent is invoked from
// three separate modules; if the pattern extractor breaks, this is what notices.
const whack = g.edges.filter((e) => e.type === 'CITES' && e.to === 'Pattern:whack:loot precedent');
assert(whack.length >= 3, `expected the whack:loot precedent cited from 3+ sites, got ${whack.length}`);
assert(new Set(whack.map((e) => e.from)).size >= 3, 'and from 3+ distinct modules');
console.log(`✓ precedent lookup: "whack:loot precedent" resolves to ${whack.length} sites in ${new Set(whack.map((e) => e.from)).size} modules`);

// ── the coverage query fires (mechanism, on a synthetic graph) ───────────────────────────────────
// Against the real tree this returns 0 — every NULL-character cash reason is inside some check's
// terms. A zero that means "correct" and a zero that means "broken" look identical, so the mechanism
// is exercised directly: a NULL-character cash reason that no check covers MUST be reported, and the
// three exemptions (character-scoped, non-cash, covered-by-prefix) MUST each suppress it.
{
  const fake = {
    nodes: new Map([['Reason:x', {}]]),
    edges: [
      { type: 'EMITS', to: 'Reason:hole', currency: 'cash', scoped: false, prov: { file: 'f', line: 1 } },
      { type: 'EMITS', to: 'Reason:scoped', currency: 'cash', scoped: true, prov: { file: 'f', line: 2 } },
      { type: 'EMITS', to: 'Reason:omr:thing', currency: 'omr', scoped: false, prov: { file: 'f', line: 3 } },
      { type: 'EMITS', to: 'Reason:pre:fixed', currency: 'cash', scoped: false, prov: { file: 'f', line: 4 } },
      { type: 'RECONCILES', to: 'Reason:pre:%' },
    ],
    unparsed: [],
  };
  const out = QUERIES['unreconciled-reasons'](fake);
  assert.equal(out.length, 1, `the query should report exactly the one real hole, got ${out.length}: ${out}`);
  assert(out[0].startsWith('hole'), `it should be the unscoped uncovered cash reason, got ${out[0]}`);
}
// And on the real tree it is clean — asserted so a regression that opens a §10.4 blind spot fails CI.
assert.equal(QUERIES['unreconciled-reasons'](g).length, 0,
  'a NULL-character cash reason is written that no invariant check accounts for — see GRAPH.md');
console.log('✓ reason coverage: mechanism fires on a synthetic hole; the real tree is clean');

// ── the honesty rule: unparsed input is counted, never silently dropped ──────────────────────────
// Two shapes are genuinely unresolvable statically (interpolated reasons, runtime currencies). They
// are allowed but must stay bounded and must stay VISIBLE — a growing blind spot has to be seen.
const kinds = new Set(g.unparsed.map((u) => u.kind));
assert(kinds.has('interpolated-reason'), 'interpolated reasons must be counted, not silently skipped');
assert(g.unparsed.length < c.byEdge.EMITS * 0.25,
  `${g.unparsed.length} unparsed vs ${c.byEdge.EMITS} parsed — extraction has gone too lossy to trust`);
assert.equal(QUERIES.unparsed(g).length, g.unparsed.length, 'every unparsed construct is reportable');
console.log(`✓ honesty rule: ${g.unparsed.length} unresolvable constructs counted and listed (${[...kinds].join(', ')})`);

// ── the lever trace answers the paper's tracing question for one number ──────────────────────────
const trace = QUERIES.lever(g, 'CASH_LOOT_RATE');
assert(trace.some((l) => l.includes('rules.tail.js')), 'the trace names where the lever is declared');
assert(trace.some((l) => l.startsWith('read by') && l.includes('src/')), 'and which modules read it');
assert(trace.some((l) => l.startsWith('decided in') && l.includes('.md')), 'and which documents decided it');
console.log('✓ lever trace: declaration, readers, pins and deciding documents resolve for a real lever');

// ── open-findings: it reports, and it must never quietly stop reporting ──────────────────────────
// GRAPH.md §5 increment 2. Three registers — SIGN-OFF.md (founder decisions), BALANCE.md (economy
// sign-off) and SPEC.md (technical debt) — share the D1–D15 id namespace, so `D1` names three
// unrelated things and a bare mention cannot be attributed. The query therefore REPORTS: it prints
// each row's own state with outside evidence beside it, and flags the collision. These assertions
// pin the parts that would make it useless if they broke silently.
{
  const claims = [...g.nodes.values()].filter((n) => n.type === 'Claim');
  const rows = claims.filter((n) => n.register !== 'AUDIT');
  // per-register FIRST, so a broken parser names the register it lost rather than only the total
  for (const reg of ['SIGN-OFF', 'BALANCE', 'SPEC']) {
    assert(rows.some((n) => n.register === reg), `no rows extracted from ${reg} — a register that `
      + 'stops parsing silently drops every decision it holds');
  }
  assert(rows.length >= 30, `only ${rows.length} register rows extracted — with a broken register `
    + 'parser this query reports an empty sheet, which reads exactly like a clean one');

  // The collision is the whole reason this reports rather than concludes. If it stopped being
  // detected the query would start attributing one register's evidence to another's decision.
  assert(rows.some((n) => n.ambiguous), 'the shared D1–D15 namespace is no longer detected as '
    + 'ambiguous — evidence would now be attributed to whichever register parsed first');

  const out = QUERIES['open-findings'](g);
  const text = out.join('\n');
  assert(/AMBIGUOUS/.test(text), 'the query must SAY when an id is carried by more than one register');
  assert(/COVERAGE, not a census/.test(text), 'the audit-corpus figure must be stated as coverage — '
    + 'read as a census it is a count of findings nobody can check');
  assert(g.auditCoverage.reports > g.auditCoverage.withMarker,
    `coverage claims ${g.auditCoverage.withMarker} of ${g.auditCoverage.reports} reports carry a `
    + 'marker; if every report matched, the scan would be a census and the caveat would be false');

  // The sheet's own answer table is the authority on whether a decision is closed. A word scan over
  // row bodies read 12 of 15 as resolved — "it is already built that way" inside an argument FOR an
  // option is not a closure — so the answer must come from the table or not at all.
  const sheet = rows.filter((n) => n.register === 'SIGN-OFF');
  assert(sheet.length >= 10 && sheet.every((n) => n.answer),
    'every sheet row must resolve to an answer in SIGN-OFF.md\'s own answer table; a row with no '
    + 'entry is genuinely unanswered and the query says so');
  console.log(`✓ open-findings: ${rows.length} register rows across three D-namespace registers, `
    + `${rows.filter((n) => n.ambiguous).length} flagged ambiguous, audit coverage stated as `
    + `${g.auditCoverage.withMarker} of ${g.auditCoverage.reports} reports`);
}

// Exercise the actual executable boundary. This caught the silent-success regression where direct
// commands returned status 0 but printed nothing on Windows because the entry-point guard was false.
{
  const cli = spawnSync(process.execPath, [graphPath, 'query', 'open-findings'], {
    cwd: path.dirname(path.dirname(graphPath)),
    encoding: 'utf8',
  });
  assert.equal(cli.status, 0, `graph CLI failed: ${cli.stderr}`);
  assert(cli.stdout.includes('# open-findings'), 'graph CLI printed no open-findings query header');
  assert(cli.stdout.includes('SIGN-OFF.md'), 'graph CLI silently lost the founder decision register');
  console.log('✓ CLI boundary: direct queries execute and CRLF registers parse on this host');
}

console.log('✅ THE GRAPH PLANE test passed — the work-and-knowledge graph builds from the tree with '
  + `${c.nodes} nodes and ${c.edges} edges, every node carries provenance + an authoring run + a content hash, `
  + 'every invariant check names what it reconciles, precedent lookup resolves a named pattern to its call sites, '
  + 'the §10.4 coverage query fires on a synthetic hole and reports the real tree clean, the lever trace answers '
  + "the paper's tracing question end to end, and everything the extractor cannot read is counted and listed "
  + 'rather than skipped in silence');
