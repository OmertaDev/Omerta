import assert from 'node:assert/strict';
import {fixture} from './manufacturinglicenses-integration-fixture.js';
const f=await fixture(),{app,pool,A,player,materials,published,action,ref,call,ok,books}=f;
const acq='/v1/company/acquisitions';
async function purchaser(){const p=await player();await ok(p,'POST','/v1/depot/'+p.business+'/close',{});return p;}
const quote=(p,b)=>call(p,'POST',acq+'/quote',{depotId:p.business,buyerCharacter:b.id});
async function sell(s,b){const q=await ok(s,'POST',acq+'/quote',{depotId:s.business,buyerCharacter:b.id}),offer=await ok(s,'POST',acq,{depotId:s.business,buyerCharacter:b.id,price:10000,sourceHash:q.sourceHash,expiresInSeconds:600,consent:true});await ok(b,'POST',acq+'/'+offer.acquisition.id+'/accept',{consent:true,maxPrice:10000,termsHash:offer.acquisition.termsHash});return ok(s,'POST',acq+'/'+offer.acquisition.id+'/execute',{termsHash:offer.acquisition.termsHash});}
try{
 const owner=await player(),buyer=await player(),nextOwner=await purchaser(),nextBuyer=await purchaser(),offered=await published(owner,buyer);await materials(buyer);
 assert.equal((await quote(owner,nextOwner)).json().message,'manufacturing_license_obligation');assert.equal((await quote(buyer,nextBuyer)).statusCode,200,'Named unsolicited offer grants no rights over target business');
 await action(buyer,'accept',{...ref(offered),businessId:buyer.business,consent:true},'acquisition-license-consent');assert.equal((await quote(buyer,nextBuyer)).json().message,'manufacturing_license_obligation');const paid=await action(buyer,'run',ref(offered),'acquisition-paid-run');assert.equal(paid.royaltyPaid,25);assert.equal((await quote(owner,nextOwner)).json().message,'manufacturing_license_obligation');
 await action(buyer,'cancel',ref(offered),'original-release');const history=(await pool.query('SELECT * FROM manufacturing_licenses ORDER BY id')).rows,receipts=(await pool.query('SELECT * FROM manufacturing_license_requests ORDER BY account_id,request_key')).rows,legs=(await pool.query("SELECT * FROM transactions WHERE reason IN ('manufacturing_license:pay','manufacturing_license:receive') ORDER BY id")).rows;
 const result=await sell(owner,nextOwner);assert.equal(result.acquisition.ownershipTransferred,true);await sell(buyer,nextBuyer);assert.deepEqual((await pool.query('SELECT * FROM manufacturing_licenses ORDER BY id')).rows,history);assert.deepEqual((await pool.query('SELECT * FROM manufacturing_license_requests ORDER BY account_id,request_key')).rows,receipts);assert.deepEqual((await pool.query("SELECT * FROM transactions WHERE reason IN ('manufacturing_license:pay','manufacturing_license:receive') ORDER BY id")).rows,legs);assert.deepEqual(await action(buyer,'run',ref(offered),'acquisition-paid-run'),paid);assert.deepEqual(await A.collectManufacturingLicenseIssues(pool),[],'Both business titles may change without rewriting historical originals');
 assert.equal((await call(nextBuyer,'POST',f.base+'/run',ref(offered))).statusCode,400,'Depot purchase never inherits original license consent');assert.equal((await call(buyer,'POST',f.base+'/run',ref(offered))).statusCode,400);
 nextOwner.business=owner.business;await ok(nextOwner,'POST','/v1/depot/'+owner.business+'/fund',{amount:1000});const other=await purchaser(),terms={depotId:owner.business,steps:[{kind:'configure',config:{salePrice:1100,bidPrice:500,targetStock:2,reorderAt:0,restockBudget:2000}}],maxWithdrawalCash:0,reserveCash:1000};await ok(nextOwner,'POST','/v1/company/restructuring/quote',terms);
 for(const column of ['licensor_business','licensee_business']){const table='unknown_manufacturing_'+column;await pool.query('CREATE TABLE '+table+'(id TEXT PRIMARY KEY,'+column+' TEXT)');assert.equal((await quote(nextOwner,other)).json().message,'unsupported_schema');assert.equal((await call(nextOwner,'POST','/v1/company/restructuring/quote',terms)).json().message,'unsupported_schema');await pool.query('DROP TABLE '+table);}
 await books();console.log('N15 OFFREPO canonical F15/F16 relationship memory PASS: original licensor/accepted licensee live obligations, unsolicited target no veto, actual25 royalty/cancel/two paid title transfers, immutable source/paid ACK history, no inherited authority, unknown exact-column sources closed in both readers.');
}finally{await app.close();}




