// Component route/auth boundaries; full registered positive journey has a separate fixture.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
assert(!process.env.DATABASE_URL,'No ambient endpoint');
const {makeDb}=await import('../src/db.js'),{register}=await import('../src/routes/equipmentrecovery.js');
const pool=await makeDb(),app=Fastify();
try{
  await app.register(jwt,{secret:'equipment-recovery-component-fixture-only'});
  app.setErrorHandler((e,req,reply)=>reply.code(e.statusCode||400).send({error:e.code||'error',message:e.message}));
  register(app,{pool,auth:req=>req.jwtVerify()});
  const call=(agent,method,url,payload)=>app.inject({method,url,payload,headers:{...(agent===null?{}:{authorization:'Bearer '+app.jwt.sign({sub:'recovery-boundary',agent})}),'idempotency-key':'exact-request'}});
  assert.equal((await call(null,'GET','/v1/equipment-recovery?businessId=business&itemId=item')).statusCode,401);
  const terms={businessId:'business',itemId:'item',originalCharacterId:'original',sourceHash:'0'.repeat(64),consent:true};
  for(const agent of [false,true]){
    assert.equal((await call(agent,'GET','/v1/equipment-recovery?businessId=business&itemId=item&owner=foreign')).json().error,'equipment_recovery_terms');
    assert.equal((await call(agent,'POST','/v1/equipment-recovery',{...terms,outputQuantity:10})).json().error,'equipment_recovery_terms');
    const result=await call(agent,'POST','/v1/equipment-recovery',terms);assert.equal(result.statusCode,400);assert.equal(result.json().error,'no_character');
    assert.equal((await call(agent,'POST','/v1/equipment-recovery?override=true',terms)).statusCode,400);
  }
  assert.equal((await pool.query('SELECT * FROM equipment_recovery_requests')).rows.length,0);
  assert.equal((await pool.query('SELECT * FROM item_events')).rows.length,0);
  console.log('PASS N14 component JWT parity/closed query+body/no caller mint params/genuine actor refusal; full registered journey separately verified.');
}finally{await app.close();await pool.end();}
