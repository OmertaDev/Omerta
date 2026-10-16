import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture} from './performanceemployment-fixture.js';

assert(!process.argv.includes('--postgres'),'This bounded history integration case is memory only; native title/relocation qualification is separate.');
assert(!process.env.DATABASE_URL,'Refuse ambient database endpoints');
Object.assign(process.env,{CHAIN_ENABLED:'off',RESOURCE_ECONOMY:'off'});
const f=await fixture();
const R=await import('../src/depotacquisitionruntime.js'),A=await import('../src/companyacquisitions.js');
const {withAcquisitionCharacters}=await import('../src/company-middle-five-runtime.js');
const B=await import('../src/businessrelocation.js');
const service=A.companyAcquisitions(R.canonicalDepotAcquisitionRuntime);
const pair=(first,second,fn)=>withAcquisitionCharacters(f.pool,first,second,fn);
const seller='employer',buyer='other',sellerId=f.players.employer.id,buyerId=f.players.other.id;
const quote=()=>pair(seller,buyerId,(s,b,c)=>service.quote(s,b,f.depot.id,c));
const guard=()=>f.I.withItemTransaction(f.pool,c=>R.assertDepotFeatureObligations(c,f.depot.id));
const history=()=>f.P.inspectPerformanceEmploymentDepotHistory(f.pool,f.depot.id);
async function readOnly(fn){const before=await f.state(),r=await fn();assert.deepEqual(await f.state(),before,'History and receipt reads do not change any of the twelve canonical fixture tables');return r;}
async function corrupt(sql,args,restore,restoreArgs,reason){
 await f.pool.query(sql,args);
 try{
  const inspected=await readOnly(history);assert(inspected.issues.some(x=>x.reason===reason),JSON.stringify(inspected));
  assert.deepEqual(inspected.activeContracts,[],'Corrupt rows never become an authority or valid active-contract claim');
  await assert.rejects(guard(),e=>e.code==='depot_acquisition_runtime'&&e.message==='performance_employment_history_changed');
 }finally{await f.pool.query(restore,restoreArgs);}
 assert.deepEqual((await readOnly(history)).issues,[]);
}
try{
 const empty=await readOnly(()=>f.P.inspectPerformanceEmploymentDepotHistory(f.pool,'no-such-depot'));
 assert.deepEqual(empty,{issues:[],activeContracts:[],contracts:[],contractCount:0,historyVersion:'performance_employment_v1',executionAuthority:false});
 const job=await f.create(),funded=await f.fund(job,{key:'history-fund'});
 const active=await readOnly(history);assert.deepEqual(active.issues,[]);assert.deepEqual(active.activeContracts,[job.employmentId]);assert.equal(active.contracts[0].reservedBonusCash,100);assert.equal(active.contracts[0].paidBonusCash,0);
 await assert.rejects(guard(),e=>e.code==='depot_acquisition_runtime'&&e.message==='performance_employment_obligation');
 await assert.rejects(quote(),e=>e.code==='depot_acquisition_runtime'&&e.message==='performance_employment_obligation');
 const com=await f.commitment(),accepted=await f.accept(job,com,'worker','history-accept');
 assert.deepEqual((await readOnly(history)).issues,[],'Genuine accepted, unpaid assignments have source evidence without invented paid fields');
 await f.deliver(com,1);assert.deepEqual((await readOnly(history)).issues,[],'A genuine partial fill validates while the original bonus is still reserved');await f.deliver(com,3);
 const beforeClaim=await f.balance('worker'),paid=await f.claim(job,com,'worker','history-claim');
 assert.equal(await f.balance('worker'),beforeClaim+150);assert.equal(paid.wageCash,100);assert.equal(paid.performanceBonus.bonusCash,50);
 const stillOpen=await readOnly(history);assert.deepEqual(stillOpen.issues,[]);assert.deepEqual(stillOpen.activeContracts,[job.employmentId]);assert.equal(stillOpen.contracts[0].paidBonusCash,50);
 const beforeClose=await f.balance('employer'),closed=await f.single('employer',(ch,c,h)=>f.E.closeEmployment(ch,job.employmentId,'history-close',c,h));
 assert.equal(closed.refundedCash,100);assert.equal(closed.performanceBonus.refundedBonusCash,50);assert.equal(await f.balance('employer'),beforeClose+150);
 const second=await f.create({slots:1}),secondFund=await f.fund(second,{bonusCash:75,key:'history-unused-fund'});
 assert.equal(secondFund.reservedBonusCash,75);
 const unusedClose=await f.single('employer',(ch,c,h)=>f.E.closeEmployment(ch,second.employmentId,'history-unused-close',c,h));
 assert.equal(unusedClose.refundedCash,100);assert.equal(unusedClose.performanceBonus.refundedBonusCash,75);
 const terminal=await readOnly(history);assert.deepEqual(terminal.issues,[]);assert.deepEqual(terminal.activeContracts,[]);assert.equal(terminal.contractCount,2);assert.equal(terminal.contracts.reduce((n,c)=>n+c.paidBonusCash,0),50);assert.equal(terminal.contracts.reduce((n,c)=>n+c.refundedBonusCash,0),125);
 await guard();
 const request=(await f.pool.query('SELECT * FROM performance_employment_requests WHERE employment_id=$1',[job.employmentId])).rows[0];
 await corrupt('UPDATE performance_employment_requests SET receipt=$2 WHERE employment_id=$1',[job.employmentId,{...request.receipt,wagesUnchanged:false}],'UPDATE performance_employment_requests SET receipt=$2 WHERE employment_id=$1',[job.employmentId,request.receipt],'history_funding_ack');
 await corrupt('UPDATE performance_employment_requests SET account_id=$2 WHERE employment_id=$1',[job.employmentId,'other'],'UPDATE performance_employment_requests SET account_id=$2 WHERE employment_id=$1',[job.employmentId,request.account_id],'history_funding_ack');
 const contract=(await f.pool.query('SELECT * FROM performance_employment_contracts WHERE employment_id=$1',[job.employmentId])).rows[0];
 await corrupt('UPDATE performance_employment_contracts SET source_json=$2 WHERE employment_id=$1',[job.employmentId,{...contract.source_json,minimumUnits:3}],'UPDATE performance_employment_contracts SET source_json=$2 WHERE employment_id=$1',[job.employmentId,contract.source_json],'source_changed');
 const assignment=(await f.pool.query('SELECT * FROM performance_employment_assignments WHERE assignment_id=$1',[accepted.assignmentId])).rows[0];
 await corrupt('UPDATE performance_employment_assignments SET claim_json=$2 WHERE assignment_id=$1',[accepted.assignmentId,{...assignment.claim_json,bonusCash:51}],'UPDATE performance_employment_assignments SET claim_json=$2 WHERE assignment_id=$1',[accepted.assignmentId,assignment.claim_json],'claim_source');
 const wage=(await f.pool.query('SELECT * FROM transactions WHERE id=$1',[assignment.wage_transaction])).rows[0];
 await corrupt('UPDATE transactions SET amount=$2 WHERE id=$1',[wage.id,Number(wage.amount)+1],'UPDATE transactions SET amount=$2 WHERE id=$1',[wage.id,wage.amount],'journal');
 // F15 is exercised through the existing sorted-lock registrar and genuine
 // price/acceptance/paired journals. Original F12 reserve/assignments survive.
 await f.single('employer',(ch,c)=>f.D.receiveDepot(ch,f.depot.id,f.order.id,c));
 const q=await quote(),offer=await pair(seller,buyerId,(s,b,c)=>service.offer(s,b,{depotId:f.depot.id,buyerCharacter:buyerId,price:10000,sourceHash:q.sourceHash,expiresInSeconds:600,consent:true},'history-sale-offer',c));
 const acquisition=offer.acquisition;
 await pair(buyer,sellerId,(b,s,c)=>service.accept(b,s,acquisition.id,{consent:true,maxPrice:10000,termsHash:acquisition.termsHash},'history-sale-accept',c));
 const cashSeller=await f.balance('employer'),cashBuyer=await f.balance('other');
 const sale=await pair(seller,buyerId,(s,b,c,h)=>service.execute(s,b,acquisition.id,{termsHash:acquisition.termsHash},'history-sale-execute',c,h));
 assert.equal(sale.acquisition.state,'executed');assert.equal(await f.balance('employer'),cashSeller+10000);assert.equal(await f.balance('other'),cashBuyer-10000);
 assert.equal((await f.pool.query('SELECT owner_character FROM business_depots WHERE id=$1',[f.depot.id])).rows[0].owner_character,buyerId);
 assert.deepEqual(await readOnly(history),terminal,'Lawful paid title transfer does not rebind original source/ACK/wages/bonus/refund history');
 assert.deepEqual(await readOnly(()=>f.P.replayPerformanceEmployment(f.pool,'employer',{employmentId:job.employmentId,minimumUnits:4,bonusCash:50,consent:true},'history-fund')),funded);
 const replay=await readOnly(()=>f.E.replayEmploymentRequest('worker','claim',{employmentId:job.employmentId,commitmentId:com.id},'history-claim',f.pool));
 assert.equal(replay.replayed,true);assert.deepEqual(replay.performanceBonus,paid.performanceBonus);
 const wrongOwner=await readOnly(()=>f.P.replayPerformanceEmployment(f.pool,'other',{employmentId:job.employmentId,minimumUnits:4,bonusCash:50,consent:true},'history-fund'));assert.equal(wrongOwner,null,'The new title owner inherits no original funding receipt authority');
 // Positive F16 relocation needs its unchanged transactional backend. These
 // source assertions cover only the new typed relation and oracle guard; the
 // real memory facade still refuses, with no compatibility/backend alias.
 const relocation=fs.readFileSync(new URL('../src/depotrelocationruntime.js',import.meta.url),'utf8');
 assert.equal(R.DEPOT_ACQUISITION_REFERENCES.length,49);assert.equal(R.DEPOT_ACQUISITION_REFERENCES.filter(x=>x==='performance_employment_contracts:depot_id').length,1);
 assert.equal(relocation.match(/"performance_employment_contracts:depot_id"/g)?.length,1);assert(relocation.includes('inspectPerformanceEmploymentDepotHistory(c,d.id)'));assert(relocation.includes("if(performance.activeContracts.length)fail('performance_employment_obligation')"));
 await assert.rejects(B.quoteBusinessRelocation(f.pool,buyer,{businessId:f.depot.id,destination:'docks'},{agent:false}),e=>e.code==='business_relocation'&&e.message==='transactional_backend_required');
 assert.equal((await f.P.performanceEmploymentInvariant(f.pool)).ok,true);
 console.log('Performance employment depot history memory PASS: actual funded F12/two bought-gin fills/wage+bonus/refunds, five corruption controls, read-only original ACK/source/journals, real 10000 paid F15 title transfer and account-scoped old receipts. F16 typed guard/source and unchanged backend refusal only; no positive relocation/native claim.');
}finally{await f.pool.end();}
