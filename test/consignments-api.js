import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { CONSIGNMENT_CONTRACTS as contracts, CONSIGNMENT_SCHEMAS as schemas } from '../src/consignment-contracts.js';
import assert from 'node:assert/strict';
import { fixture } from './lib/consignments-fixture.js';
const f=await fixture(true),{app,pool,native,tool,terms,ref,state}=f;
// Exercise the canonical registrar and authentication closure.
const tokens=Object.fromEntries(['owner','host','buyer','other'].map(account=>[account,{human:app.jwt.sign({sub:account,tv:0}),agent:app.jwt.sign({sub:account,tv:0,agent:true})}]));
let serial=0;const call=(account,path,body,key='http-'+(++serial),agent=false)=>app.inject({method:body===undefined?'GET':'POST',url:'/v1/consignments'+path,payload:body,headers:{...(account?{authorization:'Bearer '+tokens[account][agent?'agent':'human']}:{}),'idempotency-key':key}});
const ajv=new Ajv({strict:false,allErrors:true});addFormats(ajv);const validators=Object.fromEntries(Object.entries(contracts).map(([key,c])=>[key,ajv.compile({...c.responseSchema,components:{schemas}})]));
const ok=async(...args)=>{const r=await call(...args);assert.equal(r.statusCode,200,r.body);const method=args[2]===undefined?'GET':'POST',path=('/v1/consignments'+args[1]).split('?')[0],validate=validators[method+' '+path];assert(validate,method+' '+path);assert(validate(r.json()),JSON.stringify(validate.errors));return r.json();};
const pending=async(account,body,key,onResponse=()=>{})=>{const original=JSON.stringify(body);for(let n=0;n<10;n++){assert.equal(JSON.stringify(body),original);const response=await call(account,'/buy',body,key,true);onResponse(response);if(response.statusCode===200)return response.json();if(response.statusCode!==409||response.json().error!=='in_progress')assert.equal(response.statusCode,200,response.body);assert.equal(String(response.headers['retry-after']),'1');assert(n<9);await new Promise(r=>setTimeout(r,1000));}throw Error('pending receipt attempt budget');};
try{
assert.equal((await call(null,'')).statusCode,401);
const item=await tool(),offer=await ok('owner','/create',terms(item),'api-offer',true);
assert.equal((await call('other','/accept',ref(offer))).statusCode,400);await ok('host','/accept',ref(offer),'api-host',true);
const publicBoard=await ok('other','');assert.equal(publicBoard.rows.find(r=>r.consignmentId===offer.consignmentId).pickupDistrict,'foundry');assert(!JSON.stringify(publicBoard).includes(item));assert(!JSON.stringify(publicBoard).includes('owner-actor'));
assert.equal((await call('other','?unknown=1')).statusCode,400);
const frozen=Object.freeze(ref(offer));let duplicate;
if(native){
  const before=await state(),blocker=await pool.connect();let first,second;
  try{await blocker.query('BEGIN');await blocker.query('SELECT id FROM characters WHERE id=$1 FOR UPDATE',['buyer-actor']);first=call('buyer','/buy',frozen,'api-sale',true).then(response=>({response}),error=>({error}));
    let waiting=false;for(let n=0;n<80;n++){if((await pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query='SELECT * FROM characters WHERE id=$1 FOR UPDATE'")).rows.length){waiting=true;break;}await new Promise(r=>setTimeout(r,25));}assert(waiting);
    const response=await call('buyer','/buy',frozen,'api-sale',true);assert.equal(response.statusCode,409,response.body);assert.equal(response.json().error,'in_progress');assert.equal(String(response.headers['retry-after']),'1');assert.deepEqual(await state(),before);
    let observed=false;second=pending('buyer',frozen,'api-sale',r=>{if(r.statusCode===409&&r.json().error==='in_progress')observed=true;}).then(value=>({value}),error=>({error}));for(let n=0;n<80&&!observed;n++)await new Promise(r=>setTimeout(r,25));assert(observed);await blocker.query('COMMIT');
  }finally{await blocker.query('ROLLBACK');blocker.release();}
  duplicate=await Promise.all([first.then(({response,error})=>{if(error)throw error;assert.equal(response.statusCode,200,response.body);return response.json();}),second.then(({value,error})=>{if(error)throw error;return value;})]);console.log('Native actual HTTP409 in_progress Retry-After1 before any sale effect; exact original-key retry');
}else{duplicate=[await pending('buyer',frozen,'api-sale'),await pending('buyer',frozen,'api-sale')];}
assert.deepEqual(duplicate[0],duplicate[1]);assert.equal((await pool.query("SELECT id FROM transactions WHERE counterparty=$1 AND reason IN ('consignment:purchase','consignment:proceeds','consignment:host_fee')",[offer.consignmentId])).rows.length,3);
let calls=0;await assert.rejects(pending('buyer',{...frozen,sourceHash:'0'.repeat(64)},'api-sale',()=>calls++),e=>e.code==='ERR_ASSERTION'&&e.actual===422);assert.equal(calls,1);
await pool.query("UPDATE accounts SET token_version=1 WHERE id='other'");assert.equal((await call('other','')).statusCode,401);await pool.query("UPDATE accounts SET status='banned' WHERE id='owner'");assert.equal((await call('owner','')).statusCode,403);
console.log(`consignments registered API ${native?'native':'memory'} PASS: signed human/agent JWT, auth/revocation, owner+host consent, actual canonical UID/cash sale, private/public DTO, exact same-key receipt and one sale, changedbody422 never retried. Canonical registrar/auth and closed response DTOs pass; shared estate and final release checks remain pending.`);
}finally{await app.close();}
