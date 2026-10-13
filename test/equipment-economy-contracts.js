import assert from 'node:assert/strict';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { EQUIPMENT_ECONOMY_SCHEMAS as schemas, EQUIPMENT_ECONOMY_CONTRACTS as contracts } from '../src/equipment-economy-contracts.js';
import { negotiationFixture } from './commercialnegotiation-fixture.js';
import * as I from '../src/items.js';
import * as Q from '../src/itemdurability.js';
assert(!process.env.DATABASE_URL, 'No ambient endpoint');
const ajv = new Ajv({ strict: false, allErrors: true }); addFormats(ajv);
const compile = schema => ajv.compile({ ...schema, components: { schemas } });
const responses = Object.fromEntries(Object.entries(contracts).map(([route, spec]) => [route, compile(spec.responseSchema)]));
const bodies = Object.fromEntries(Object.entries(contracts).filter(([,spec]) => spec.requestSchema).map(([route,spec]) => [route,compile(spec.requestSchema)]));
const f = await negotiationFixture(), app = f.app, witnessed = new Set(), receipts = [];
const actualSpec=(await app.inject({method:'GET',url:'/openapi.json'})).json();
for(const[key,contract]of Object.entries(contracts)){const[method,route]=key.split(' '),op=actualSpec.paths[route.replace(/:([A-Za-z]+)/g,'{$1}')][method.toLowerCase()];assert.equal(op.operationId,contract.operationId);assert.deepEqual(op.security,[{bearerAuth:[]}]);assert.deepEqual(op.responses[200].content['application/json'].schema,contract.responseSchema);if(contract.requestSchema)assert.deepEqual(op.requestBody.content['application/json'].schema,contract.requestSchema);}

const routeFor = (method,url) => Object.keys(contracts).find(route => new RegExp('^' + route.replace(/:[A-Za-z]+/g,'[^/]+') + '$').test(method + ' ' + url));
let serial = 0;
const call = async (p,method,url,body,key='dto-'+(++serial)) => {
  const route=routeFor(method,url); if(route && body!==undefined) assert(bodies[route]?.(body), route+': '+JSON.stringify(bodies[route]?.errors));
  const result=await f.call(p,method,url,body,key);
  if(route && result.code===200){assert(responses[route](result.body),route+': '+JSON.stringify(responses[route].errors));witnessed.add(route);receipts.push({route,body:result.body});}
  return result;
};
const ok=async(...args)=>{const r=await call(...args);assert.equal(r.code,200,JSON.stringify(r.body));return r.body;};
try {
  assert.equal(Object.keys(contracts).length,21);
  for(const route of Object.keys(contracts)){
    const [method,url]=route.split(' ');assert(app.hasRoute({method,url}),route+' must be actually registered');
    if(method==='POST'){assert(contracts[route].requestParameters.some(p=>p.in==='header'&&p.name==='Idempotency-Key'&&p.required));
      assert(!bodies[route]({externalOwnerAuthority:true}));}
    assert.equal((await f.call(null,method,url.replace(':id','unavailable'),{})).code,401,route+' requires actual auth');
  }
  const buyer=f.buyer, supplier=f.supplier, owner={scope:'account',id:buyer.account}, payer={scope:'account',id:supplier.account},tx=fn=>I.withItemTransaction(app.pool,fn);
  const rentalTool=await tx(c=>I.createItem(c,owner,Q.ITEM_DURABILITY.templateId,'imported','dto-rental-item'));
  const rentalTerms={itemId:rentalTool.id,rentCash:100,depositCash:250,durationSeconds:60,offerSeconds:60,published:true};
  const offer=await ok(buyer,'POST','/v1/equipment/rentals/offers',rentalTerms,'dto-rent-offer');
  await ok(buyer,'GET','/v1/equipment/rentals');await ok(supplier,'GET','/v1/equipment/rentals');
  const acceptance=await ok(supplier,'POST','/v1/equipment/rentals/accept',{offerId:offer.offerId,maxRentCash:100,maxDepositCash:250,consent:true},'dto-rent-accept');
  await ok(supplier,'GET','/v1/equipment/rentals');
  await ok(supplier,'POST','/v1/equipment/rentals/end',{leaseId:acceptance.leaseId},'dto-rent-end');
  const cancelOffer=await ok(buyer,'POST','/v1/equipment/rentals/offers',rentalTerms);
  await ok(buyer,'POST','/v1/equipment/rentals/offers/cancel',{offerId:cancelOffer.offerId});
  const maintenance={depotId:f.depotId,enabled:true,expectedRevision:0,expiresInSeconds:3600,feeCash:75};
  await ok(buyer,'POST','/v1/company/maintenance',maintenance,'dto-maint-offer');
  await app.pool.query('DELETE FROM idempotency WHERE account_id=$1 AND key=$2',[buyer.account,'dto-maint-offer']);
  assert.equal((await ok(buyer,'POST','/v1/company/maintenance',maintenance,'dto-maint-offer')).replayed,true);
  await ok(buyer,'GET','/v1/company/maintenance');await ok(supplier,'GET','/v1/company/maintenance/offers');
  const tool=await tx(c=>I.createItem(c,payer,Q.ITEM_DURABILITY.templateId,'imported','dto-maint-item'));
  await tx(c=>I.grantStack(c,payer,'mat:scrap_steel',2,'standard','explicit DTO fixture','dto-maint-material'));
  // Existing canonical wear leaf fixture: this test qualifies DTOs, not the Mystery gameplay hook.
  await app.pool.query("INSERT INTO mystery_instances(id,owner_scope,owner_id,authority_account_id,graph_id,graph_version) VALUES('dto-wear','account',$1,$1,'belladonna-demo',1)",[supplier.account]);
  await tx(c=>I.withItemMutation(c,payer,'mystery_action','dto-wear-root',{itemAuthority:{operations:['dto-wear'],destinations:[payer]}},async mutation=>{
    await I.escrowItem(c,payer,'dto-wear',tool.id,'mystery belladonna-demo escrow',mutation,'used_in_mystery');
    await c.query("INSERT INTO mystery_node_state(instance_id,node_id,state,discovered_at,completed_at) VALUES('dto-wear','mystery:belladonna-lock','completed',now(),now())");
    const worn=await Q.recordEquipmentUse(c,{instanceId:'dto-wear',nodeId:'mystery:belladonna-lock',itemId:tool.id,mutation});
    await I.releaseEscrow(c,'dto-wear',payer,tool.id,'canonical fixture wear release',mutation);
    return worn;
  }));
  await ok(supplier,'POST','/v1/company/maintenance/repair',{expectedRevision:1,itemId:tool.id,offerId:f.depotId});
  const subscriptionTerms={expectedOfferRevision:1,expiresInSeconds:3600,feeCeiling:100,intervalSeconds:300,itemId:tool.id,maxCycles:2,offerId:f.depotId};
  const subscription=await ok(supplier,'POST','/v1/company/service-subscriptions',subscriptionTerms,'dto-subscription');
  await ok(supplier,'GET','/v1/company/service-subscriptions');
  await app.pool.query('DELETE FROM idempotency WHERE account_id=$1 AND key=$2',[supplier.account,'dto-subscription']);
  assert.equal((await ok(supplier,'POST','/v1/company/service-subscriptions',subscriptionTerms,'dto-subscription')).replayed,true);
  await ok(supplier,'POST','/v1/company/service-subscriptions/'+subscription.subscriptionId+'/close',{});
  await ok(supplier,'GET','/v1/company/service-subscriptions');
  const terms={qty:2,unitPrice:100,maxProcurementCash:1000,deadlineSeconds:1800};
  const negotiation=await ok(buyer,'POST','/v1/company/negotiations',{orderId:f.orderId,supplierCharacter:supplier.id,expiresInSeconds:600,terms});
  await ok(supplier,'POST','/v1/company/negotiations/'+negotiation.negotiation.id+'/act',{action:'counter',expectedRevision:1,terms:{...terms,qty:1}});
  const board=await ok(buyer,'GET','/v1/company/negotiations');
  await ok(buyer,'POST','/v1/company/negotiations/'+negotiation.negotiation.id+'/act',{action:'accept',expectedRevision:2,termsHash:board.negotiations[0].termsHash});
  await ok(buyer,'POST','/v1/company/negotiations/'+negotiation.negotiation.id+'/expire',{});
  const market=await f.trade(), auction=await ok(market.buyer,'POST','/v1/company/auctions',{depotId:market.depotId,orderId:market.orderId,quantity:2,offersSeconds:5,awardSeconds:60},'dto-auction');
  await ok(market.buyer,'GET','/v1/company/auctions');
  const bid=await ok(market.supplier,'POST','/v1/company/auctions/bid',{auctionId:auction.auctionId,quoteHash:auction.quoteHash,deadlineSeconds:120,maxProcurementCash:1000,consent:true});
  await ok(market.supplier,'GET','/v1/company/auctions');
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,+new Date(auction.closesAt)-Date.now())+50));
  await ok(market.buyer,'GET','/v1/company/auctions');
  const awardBody={auctionId:auction.auctionId,expectedWinningBidId:bid.bidId};
  await ok(market.buyer,'POST','/v1/company/auctions/award',awardBody,'dto-award');
  await app.pool.query('DELETE FROM idempotency WHERE account_id=$1 AND key=$2',[market.buyer.account,'dto-award']);
  const replay=await ok(market.buyer,'POST','/v1/company/auctions/award',awardBody,'dto-award');assert(!Object.hasOwn(replay,'character'));
  const cancelledMarket=await f.trade(), cancellable=await ok(cancelledMarket.buyer,'POST','/v1/company/auctions',{depotId:cancelledMarket.depotId,orderId:cancelledMarket.orderId,quantity:2,offersSeconds:5,awardSeconds:60});
  await ok(cancelledMarket.buyer,'POST','/v1/company/auctions/cancel',{auctionId:cancellable.auctionId});
  for(const {route,body} of receipts){if(Array.isArray(body)){if(body.length)assert(!responses[route]([{...body[0],externalOwnerAuthority:true}]));}
    else assert(!responses[route]({...body,externalOwnerAuthority:true}),route+' must reject unknown receipt authority');}
  assert.equal(witnessed.size,21,JSON.stringify(Object.keys(contracts).filter(route=>!witnessed.has(route))));
  const rental=compile({$ref:'#/components/schemas/EquipmentRentalAcceptReceipt'});
  assert(!rental({...acceptance,rentDebit:'forged-partial'}));
  const delivery=compile({$ref:'#/components/schemas/ContractAuctionAwardReceipt'});
  assert(!delivery({...replay,delivery:{...replay.delivery,cryptoBacking:true}}));
  assert(!delivery({...replay,fulfillment:'delivered'}));
  console.log('Equipment economy contracts PASS: 21 actual registered authenticated routes, closed requests/history/receipts, actual replay variants, sealed bid projections and canonical award delivery; component memory contract proof only.');
} finally { await f.close(); }
