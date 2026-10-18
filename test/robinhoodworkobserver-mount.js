import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { createRobinhoodWorkObserver } from '../src/robinhoodworkobserver.js';
import { registerRobinhoodWorkObservations } from '../src/routes/robinhoodworkobservations.js';

for(const name of Object.keys(process.env))assert(!/DATABASE_URL$|^PG|^RC1|^P2_TEST|^ENTERPRISE_NATIVE_/i.test(name),'Reject ambient backend/native selector '+name);
assert.deepEqual(process.argv.slice(2),[]);
const originalFetch=globalThis.fetch;let networkAttempts=0,queries=0,checks=0,closedApps=0;
globalThis.fetch=async()=>{networkAttempts++;throw Error('No network permitted in Robinhood module assembly');};
const inputs=[undefined,'{','{}',JSON.stringify({chainId:'8453',address:'0x'+'5'.repeat(40),creationTransactionHash:'0x'+'3'.repeat(64),rpcUrl:'https://unpaid-fixture.invalid/'})];
try{
 for(const text of inputs){
  let config;try{config=JSON.parse(text??'null');}catch{config=null;}
  const observer=createRobinhoodWorkObserver(config),app=Fastify({logger:false});
  const auth=async(req,reply)=>{if(req.headers.authorization!=='Bearer public-fixture')return reply.code(401).send({error:'auth'});req.user={sub:'account_fixture'};};
  registerRobinhoodWorkObservations(app,{auth,pool:{async query(){queries++;throw Error('Unavailable observer cannot query canonical source');}},observer});
  try{
   await app.ready();assert.equal(networkAttempts,0,'No startup RPC');
   for(const[url,error]of[['/v1/company/external-work/robinhood-observation','robinhood_work_observation_unavailable'],['/v1/company/external-work/robinhood-outcome','robinhood_work_outcome_unavailable']]){
    const unauthenticated=await app.inject({method:'POST',url,payload:{}});assert.equal(unauthenticated.statusCode,401);checks++;
    const response=await app.inject({method:'POST',url,payload:{},headers:{authorization:'Bearer public-fixture'}});assert.equal(response.statusCode,503,response.body);
    const value=response.json();assert.equal(value.error,error);assert.equal(value.observationOnly,true);assert.equal(value.financialActivation,false);assert.equal(value.executableWorkGrant,false);assert(!response.body.includes('unpaid-fixture'));checks++;
   }
  }finally{await app.close();closedApps++;}
 }
 assert.equal(checks,16);assert.equal(closedApps,4);assert.equal(networkAttempts,0);assert.equal(queries,0);
 console.log('robinhoodworkobserver-mount PASS',JSON.stringify({phase:'DIRECT_NEW_MODULE_ASSEMBLY_DEFAULT_CLOSED_NOT_SHARED_SERVER_MOUNT',checks,closedApps,networkAttempts,queries,actualDatabase:false,realTransactions:0,financialActivation:false,executableWorkGrant:false}));
}finally{globalThis.fetch=originalFetch;}
