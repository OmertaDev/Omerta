// Actual registered server smoke in the off-repository prototype only.
import assert from 'node:assert/strict';
assert(!process.env.DATABASE_URL,'Reject ambient database endpoints');
assert(!process.argv.includes('--postgres'),'Native campaign is not authorized by this memory fixture.');
Object.assign(process.env,{RATE_LIMIT:'off',INVITE_MODE:'off',SOCIAL_VERIFY_MODE:'off',DEPOT_PILOT:'on',JWT_SECRET:'relocation-component-synthetic-fixture-only-secret',MARKET_SEED:'relocation-component-synthetic-seed-a1b2c3',MOD_KEY:'relocation-component-synthetic-moderator',LEGAL_OPERATOR_NAME:'CI Test Operator',LEGAL_POSTAL_ADDRESS:'123 Fixture Street, Test City',PRIVACY_CONTACT_EMAIL:'privacy@example.test',DMCA_AGENT_NAME:'CI Test Agent',DMCA_AGENT_EMAIL:'copyright@example.test',DMCA_AGENT_ADDRESS:'123 Fixture Street, Test City',DMCA_AGENT_PHONE:'+1 202 555 0100',DMCA_AGENT_REGISTERED:'true',PAYMENT_REFUND_POLICY:'Test fixture policy; not a production policy.'});
const {buildServer}=await import('./server-fixture.js');
const app=await buildServer();let key=0;
const call=(method,url,body,token)=>app.inject({method,url,payload:body,headers:{...(token?{authorization:'Bearer '+token}:{}),'idempotency-key':'relocation-memory-'+(++key)}});
try{
 assert.equal((await call('GET','/v1/business/relocations')).statusCode,401);
 const guest=await call('POST','/v1/auth/guest');assert.equal(guest.statusCode,200,guest.body);const token=guest.json().token;
 const created=await call('POST','/v1/character',{name:'Relocation Fixture'},token);assert.equal(created.statusCode,200,created.body);
 const agent=await call('POST','/v1/auth/agent-key',undefined,token);assert.equal(agent.statusCode,200,agent.body);
 for(const credential of [token,agent.json().token]){
  const board=await call('GET','/v1/business/relocations',undefined,credential);assert.equal(board.statusCode,200,board.body);assert.deepEqual(board.json().plans,[]);assert.equal(board.json().available,false);
  const refusal=await call('POST','/v1/business/relocations/quote',{businessId:'not-a-grant',destination:'docks'},credential);assert.equal(refusal.statusCode,400,refusal.body);assert.equal(refusal.json().error,'business_relocation');
 }
 assert.equal((await app.pool.query('SELECT * FROM business_relocation_plans')).rows.length,0);
 assert.equal((await app.pool.query('SELECT * FROM business_relocation_requests')).rows.length,0);
 console.log('PASS actual server first import/registered normal human+agent authentication/private empty board; canonical fresh relocation deliberately unavailable on memory. No positive gameplay/native/OpenAPI qualification.');
}finally{await app.close();}
