import assert from 'node:assert/strict';import {fixture} from './productionbooking-fixture.js';
const f=await fixture(true),{app,pool,terms,ref,accept,books}=f;let n=0;
const tokens=Object.fromEntries(['maker','customer','other'].map(a=>[a,{human:app.jwt.sign({sub:a,tv:0}),agent:app.jwt.sign({sub:a,tv:0,agent:true})}]));
const call=(a,path,body,key='http-booking-'+(++n),agent=false)=>app.inject({method:body===undefined?'GET':'POST',url:'/v1/company/production-bookings'+path,payload:body,headers:{...(a?{authorization:'Bearer '+tokens[a][agent?'agent':'human']}:{}),'idempotency-key':key}});
const ok=async(...args)=>{const r=await call(...args);assert.equal(r.statusCode,200,r.body);return r.json();};
try{
  assert.equal((await call(null,'')).statusCode,401);assert.equal((await call('maker','?hidden=1')).statusCode,400);
  for(const injection of [{...terms(),customerAccount:'other'},{...terms(),skipQuality:true},{...terms(),consent:false}])assert.equal((await call('maker','/offer',injection)).statusCode,400);
  const offered=await ok('maker','/offer',terms(),'human-maker-offer');assert.equal((await call('other','/accept',accept(offered))).statusCode,400);
  assert.deepEqual((await ok('other','')).offers,[]);const booked=await ok('customer','/accept',accept(offered),'agent-customer-accept',true);assert.equal(booked.booking.state,'active');
  const before=Number((await pool.query("SELECT cash FROM characters WHERE id='maker-actor'")).rows[0].cash);
  assert.equal((await call('maker','/complete',{...ref(offered),agentCredential:false})).statusCode,400);
  const complete=await ok('maker','/complete',ref(offered),'agent-actual-production',true);assert.equal(complete.paidFee,100);assert.equal(complete.paidBonusCash,10);
  assert.equal(Number((await pool.query("SELECT cash FROM characters WHERE id='maker-actor'")).rows[0].cash),before+110);
  const replay=await ok('maker','/complete',ref(offered),'agent-actual-production');assert.deepEqual(replay,complete,'The HTTP idempotency cache returns the original exact response');
  for(const a of ['maker','customer']){const raw=JSON.stringify(await ok(a,'',undefined,undefined,true));for(const secret of ['source_pin','source_json','makerAccount','customerAccount','grant_expires_at','settlement'])assert(!raw.includes(secret));}
  const count=await books();console.log('Production booking actual registered human+agent JWT authority, default canonical agent production, closed terms/credential injection/privacy/replay and actual customer UID+fee+bonus PASS; '+count+' global checks PASS.');
}finally{await app.close();}
