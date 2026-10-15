import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { fixture } from './merchantreturns-fixture.js';
import { register } from '../src/routes/merchantreturns.js';
import { MERCHANT_RETURN_CONTRACTS,MERCHANT_RETURN_SCHEMAS } from '../src/merchantreturns-contracts.js';
import Ajv from 'ajv';import addFormats from 'ajv-formats';
const f=await fixture(),app=Fastify(),ajv=new Ajv({strict:false,allErrors:true});addFormats(ajv);for(const[name,schema]of Object.entries(MERCHANT_RETURN_SCHEMAS))ajv.addSchema(schema,'#/components/schemas/'+name);const validate=name=>ajv.getSchema('#/components/schemas/'+name);
await app.register(jwt,{secret:'merchant-return-component-fixture-only'});app.setErrorHandler((e,_q,r)=>r.code(e.statusCode||400).send({error:e.code||'internal',message:e.message}));
const auth=async req=>{await req.jwtVerify();const a=(await f.pool.query('SELECT status,token_version FROM accounts WHERE id=$1',[req.user.sub])).rows[0];if(!a||a.status!=='active'||Number(a.token_version)!==Number(req.user.tv??0))throw Object.assign(Error('auth'),{statusCode:401});};
register(app,{pool:f.pool,auth,assertLifecycle:f.assertLifecycle});const token=(account,agent=false)=>app.jwt.sign({sub:account,agent,tv:0}),call=(account,action,body,key,agent=false)=>app.inject({method:action==='board'?'GET':'POST',url:'/v1/items/merchant-returns'+(action==='board'?'':'/'+action),headers:account?{authorization:'Bearer '+token(account,agent),...(key?{'idempotency-key':key}:{})}:{},payload:body});
try{
 const sale=await f.sell();assert.equal((await call(null,'board')).statusCode,401);assert.equal((await call('seller','offer',sale.offerBody)).statusCode,400);const offer=await call('seller','offer',sale.offerBody,'api-offer',true);assert.equal(offer.statusCode,200,offer.body);const right=offer.json();assert(validate('MerchantReturnOfferReceipt')(right));
 const before=await f.state();assert.equal((await call('other','accept',f.ref(right),'api-foreign')).statusCode,400);assert.deepEqual(await f.state(),before);assert.equal((await app.inject({method:'GET',url:'/v1/items/merchant-returns?extra=1',headers:{authorization:'Bearer '+token('seller')}})).statusCode,400);
 const accepted=await call('buyer','accept',f.ref(right),'api-accept',true);assert.equal(accepted.statusCode,200,accepted.body);assert(validate('MerchantReturnAcceptanceReceipt')(accepted.json()));assert.equal((await call('seller','cancel',f.ref(right),'api-revoke')).statusCode,400);
 const returned=await call('buyer','return',f.ref(right),'api-return',true);assert.equal(returned.statusCode,200,returned.body);assert(validate('MerchantReturnPaidReceipt')(returned.json()));const done=await f.state();assert.deepEqual((await call('buyer','return',f.ref(right),'api-return',true)).json(),returned.json());assert.deepEqual(await f.state(),done);const board=(await call('other','board')).json();assert.deepEqual(board,{rights:[]});await f.books();
 for(const [key,c]of Object.entries(MERCHANT_RETURN_CONTRACTS)){if(key.startsWith('POST')){const check=ajv.compile(c.requestSchema),body=key.endsWith('/offer')?sale.offerBody:f.ref(right);assert(check(body));assert(!check({...body,extra:true}));assert(!check({...body,consent:false}));assert.equal(c.requestParameters[0].required,true);}assert(c.responseSchema.$ref);}
 console.log('Merchant return registrar '+(f.native?'native18.4':'memory')+' COMPONENT PASS: authenticated JWT human/agent exact funds+UID effect, foreign/privacy/closed DTO/query/key/irreversible acceptance and exact replay. Actual shared server/globalbooks/private estate not composed.');
}finally{await app.close();await f.pool.end();}
