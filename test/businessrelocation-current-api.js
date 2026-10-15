// Actual registered server smoke in the off-repository prototype only.
import assert from 'node:assert/strict';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {BUSINESS_RELOCATION_CONTRACTS, BUSINESS_RELOCATION_SCHEMAS} from '../src/businessrelocation-contracts.js';
assert(!process.env.DATABASE_URL,'Reject ambient database endpoints');
assert(!process.argv.includes('--postgres'),'Native campaign is not authorized by this memory fixture.');
Object.assign(process.env,{RATE_LIMIT:'off',INVITE_MODE:'off',SOCIAL_VERIFY_MODE:'off',DEPOT_PILOT:'on',JWT_SECRET:'relocation-component-synthetic-fixture-only-secret',MARKET_SEED:'relocation-component-synthetic-seed-a1b2c3',MOD_KEY:'relocation-component-synthetic-moderator',LEGAL_OPERATOR_NAME:'CI Test Operator',LEGAL_POSTAL_ADDRESS:'123 Fixture Street, Test City',PRIVACY_CONTACT_EMAIL:'privacy@example.test',DMCA_AGENT_NAME:'CI Test Agent',DMCA_AGENT_EMAIL:'copyright@example.test',DMCA_AGENT_ADDRESS:'123 Fixture Street, Test City',DMCA_AGENT_PHONE:'+1 202 555 0100',DMCA_AGENT_REGISTERED:'true',PAYMENT_REFUND_POLICY:'Test fixture policy; not a production policy.'});
const {buildServer}=await import('./server-fixture.js');
const app=await buildServer();let key=0;
const call=(method,url,body,token)=>app.inject({method,url,payload:body,headers:{...(token?{authorization:'Bearer '+token}:{}),'idempotency-key':'relocation-memory-'+(++key)}});
try{
 const ajv=new Ajv({strict:false,allErrors:true});addFormats(ajv);
 const validators=Object.fromEntries(Object.entries(BUSINESS_RELOCATION_CONTRACTS).map(([k,v])=>[k,ajv.compile({...v.responseSchema,components:{schemas:BUSINESS_RELOCATION_SCHEMAS}})]));
 const advertised=(await app.inject({method:'GET',url:'/openapi.json'})).json();
 for(const [k,v]of Object.entries(BUSINESS_RELOCATION_CONTRACTS)){const [method,url]=k.split(' '),actual=advertised.paths[url]?.[method.toLowerCase()];assert(actual,k);assert.deepEqual(actual.responses['200'].content['application/json'].schema,v.responseSchema);if(v.requestParameters)for(const q of v.requestParameters)assert(actual.parameters.some(p=>p.name===q.name&&p.required===true),k);}
 assert.equal((await call('GET','/v1/business/relocations')).statusCode,401);
 const guest=await call('POST','/v1/auth/guest');assert.equal(guest.statusCode,200,guest.body);const token=guest.json().token;
 const created=await call('POST','/v1/character',{name:'Relocation Fixture'},token);assert.equal(created.statusCode,200,created.body);
 const agent=await call('POST','/v1/auth/agent-key',undefined,token);assert.equal(agent.statusCode,200,agent.body);
 for(const credential of [token,agent.json().token]){
  const board=await call('GET','/v1/business/relocations',undefined,credential);assert.equal(board.statusCode,200,board.body);assert.deepEqual(board.json().plans,[]);assert(validators['GET /v1/business/relocations'](board.json()));assert(!validators['GET /v1/business/relocations']({...board.json(),source_snapshot:{private:true}}));assert.equal(board.json().available,false);
  const refusal=await call('POST','/v1/business/relocations/quote',{businessId:'not-a-grant',destination:'docks'},credential);assert.equal(refusal.statusCode,400,refusal.body);assert.equal(refusal.json().error,'business_relocation');
 }
 assert.equal((await app.pool.query('SELECT * FROM business_relocation_plans')).rows.length,0);
 assert.equal((await app.pool.query('SELECT * FROM business_relocation_requests')).rows.length,0);
 const create=ajv.compile(BUSINESS_RELOCATION_CONTRACTS['POST /v1/business/relocations/create'].requestSchema),terms={businessId:'actual-source-id',destination:'docks',sourceHash:'a'.repeat(64),durationSeconds:60};assert(create(terms));for(const bad of [{...terms,extra:true},{...terms,durationSeconds:59},{...terms,durationSeconds:601},{...terms,durationSeconds:'60'},{...terms,sourceHash:'unverified'}])assert(!create(bad));
 console.log('PASS actual registered closed five-route contracts/header/auth/DTO and boundary negative controls. No positive relocated stock claimed.');
 console.log('PASS actual server first import/registered normal human+agent authentication/private empty board; canonical fresh relocation deliberately unavailable on memory. No positive gameplay/native/OpenAPI qualification.');
}finally{await app.close();}
