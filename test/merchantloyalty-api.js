import assert from 'node:assert/strict';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { fixture } from './merchantloyalty-fixture.js';
import { registerMerchantLoyalty } from '../src/merchantloyalty-api.js';
import { MERCHANT_LOYALTY_SCHEMAS,MERCHANT_LOYALTY_CONTRACTS } from '../src/merchantloyalty-contracts.js';
const f=await fixture(),app=Fastify(),ajv=new Ajv({strict:false,allErrors:true});addFormats(ajv);for(const[name,schema]of Object.entries(MERCHANT_LOYALTY_SCHEMAS))ajv.addSchema(schema,'#/components/schemas/'+name);
await app.register(jwt,{secret:'merchant-loyalty-component-jwt-only'});app.setErrorHandler((e,_q,r)=>r.code(e.statusCode||400).send({error:e.code||'internal',message:e.message}));
const auth=async req=>{await req.jwtVerify();const a=(await f.pool.query('SELECT status,token_version FROM accounts WHERE id=$1',[req.user.sub])).rows[0];if(!a||a.status!=='active'||Number(a.token_version)!==Number(req.user.tv??0))throw Object.assign(Error('auth'),{statusCode:401});};registerMerchantLoyalty(app,{pool:f.pool,auth});
const call=(a,action,body,key,agent=false,query='')=>app.inject({method:action==='board'?'GET':'POST',url:'/v1/items/merchant-loyalty'+(action==='board'?'':'/'+action)+query,headers:a?{authorization:'Bearer '+app.jwt.sign({sub:a,tv:0,agent}),...(key?{'idempotency-key':key}:{})}:{},payload:body});
const receipt=(r,name)=>{assert.equal(r.statusCode,200,r.body);const b=r.json(),validate=ajv.getSchema('#/components/schemas/'+name);assert(validate(b),JSON.stringify(validate.errors));assert(!validate({...b,unknown:true}));return b;};
try{
  const prior=[await f.ordinary(),await f.ordinary()],next=await f.listing();assert.equal((await call(null,'board')).statusCode,401);assert.equal((await call('owner','create',f.programTerms)).statusCode,400);
  const p=receipt(await call('owner','create',f.programTerms,'api-program',true),'MerchantLoyaltyProgramReceipt'),qb=f.quoteBody(p,next,prior),q=receipt(await call('buyer','quote',qb,'api-quote',true),'MerchantLoyaltyQuoteReceipt');
  const unchanged=await f.state();assert.equal((await call('other','buy',f.buyBody(q),'api-foreign')).statusCode,400);assert.equal((await call('buyer','buy',{...f.buyBody(q),buyerPaid:1},'api-forged')).statusCode,400);assert.equal((await call('buyer','board',null,null,false,'?extra=1')).statusCode,400);assert.deepEqual(await f.state(),unchanged);
  const paid=receipt(await call('buyer','buy',f.buyBody(q),'api-buy',true),'MerchantLoyaltyPurchaseReceipt');assert.equal(paid.sale.paid,91);assert.equal(paid.sale.hostFee,10);const done=await f.state();assert.deepEqual((await call('buyer','buy',f.buyBody(q),'api-buy',true)).json(),paid);assert.deepEqual(await f.state(),done);
  const publicBoard=receipt(await call('other','board',null,null,false,'?sellerAccountId=owner'),'MerchantLoyaltyBoard');assert.equal(publicBoard.programs.length,1);assert.deepEqual(publicBoard.quotes,[]);assert(!JSON.stringify(publicBoard).includes(prior[0].itemId));assert(!JSON.stringify(publicBoard).includes('buyer-actor'));assert(!JSON.stringify(publicBoard).includes('qualification'));
  const own=receipt(await call('buyer','board'),'MerchantLoyaltyBoard');assert.equal(own.quotes.length,1);
  receipt(await call('owner','close',{programId:p.programId,programSourceHash:p.programSourceHash,consent:true},'api-close'),'MerchantLoyaltyProgramReceipt');
  await f.pool.query("UPDATE accounts SET token_version=token_version+1 WHERE id='buyer'");assert.equal((await call('buyer','board')).statusCode,401);
  for(const [key,c]of Object.entries(MERCHANT_LOYALTY_CONTRACTS)){assert(c.responseSchema.$ref);if(key.startsWith('POST')){const body=key.endsWith('/create')?f.programTerms:key.endsWith('/close')?{programId:p.programId,programSourceHash:p.programSourceHash,consent:true}:key.endsWith('/quote')?qb:f.buyBody(q),check=ajv.compile(c.requestSchema);assert(check(body));assert(!check({...body,extra:true}));assert(!check({...body,consent:false}));assert(c.requestParameters[0].required);}}
  console.log('Merchant loyalty actual JWT human/agent registrar COMPONENT PASS: exact paid repeat discount/UID/host fee, scoped board privacy, complete closed request/response contracts, token revocation, missing key/auth/forged amount/query/foreign scope refusals and exact ACK. Shared server/gateway integration remains coordinator-owned.');
}finally{await app.close();await f.pool.end();}
