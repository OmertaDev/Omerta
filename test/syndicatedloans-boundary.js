import assert from 'node:assert/strict';
import {syndicatedLoanFixture} from './syndicatedloans-fixture.js';

const f=await syndicatedLoanFixture();
try{
 let called=false;
 const counterfeit={prelockOriginals(){called=true;},persistOriginals(){called=true;},execute(){called=true;}};
 const runtime=f.S.createSyndicatedLoanRuntime({pool:f.pool,capability:counterfeit});
 assert.equal(await runtime.ready(),true,'The integrated ordinary roots enable execution; supplied callbacks grant no authority.');
 const before=await f.state(),audit=await f.audit();
 for(const action of ['propose','fund','take','repay','cancel']){
  await assert.rejects(runtime.action('borrower',action,{},'invalid-body-'+action),e=>e.code==='syndicated_loan'&&e.message==='terms');
  assert.equal(called,false);
  assert.deepEqual(await f.state(),before);
 }
 const input=f.S.syndicatedLoanTerms('propose',{
  lenderCharacters:[f.players.lenderA.id,f.players.lenderB.id].sort(),principalPerLender:5000,
  rateBps:1000,termHours:1,expiresInSeconds:600,consent:true,
 });
 const key='forged-boundary-root',token=Object.freeze({capability:counterfeit});
 for(const invoke of [
  c=>f.G.assertSyndicatedLoanActionScope(c,'borrower','propose',input,key,token),
  c=>f.R.prelockSyndicatedLoanActors(c,'borrower','propose',input,key,token),
  c=>f.S.executeSyndicatedLoanAction(c,'borrower','propose',input,key,token),
 ]){
  await assert.rejects(f.I.withItemTransaction(f.pool,invoke),e=>e.code==='syndicated_loan'&&e.message==='canonical_root');
  assert.equal(called,false,'A fabricated capability never supplies canonical actor, persistence or execution helpers.');
  assert.deepEqual(await f.state(),before);
  f.compareAudit(audit,await f.audit());
 }
 console.log('N22 integrated boundary PASS: genuine roots ready, five closed action bodies and three fabricated root/actor/execution tokens refused without callback, row or observed sequence effects.');
}finally{await f.close();}
