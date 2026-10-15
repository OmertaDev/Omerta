import assert from 'node:assert/strict';
import {decisionReplayFixture as originalReplayFixture} from './decisionreplay-fixture.js';
import {dependencyMapFixture as originalMapFixture} from './economicdependencymap-fixture.js';
import {DECISION_DEPENDENCY_CONTRACTS,DECISION_DEPENDENCY_SCHEMAS} from '../src/decision-dependency-contracts.js';
async function actual(f){
 const r=await f.app.inject({method:'GET',url:'/openapi.json'});assert.equal(r.statusCode,200,r.body);const api=r.json();
 for(const[key,contract]of Object.entries(DECISION_DEPENDENCY_CONTRACTS)){const[method,url]=key.split(' ');assert(f.app.hasRoute({method,url}));const op=api.paths[url.replace(/:([A-Za-z]+)/g,'{$1}')][method.toLowerCase()];assert(op);assert(op.security?.length);assert.deepEqual(op.responses['200'].content['application/json'].schema,contract.responseSchema);assert.equal(op.requestBody,undefined);assert(!op.parameters.some(p=>p.in==='header'&&p.name.toLowerCase()==='idempotency-key'));}
 for(const[name,schema]of Object.entries(DECISION_DEPENDENCY_SCHEMAS))assert.deepEqual(api.components.schemas[name],schema);
 return f;
}
export async function decisionReplayFixture(){const f=await actual(await originalReplayFixture());return{...f,read:(p,suffix,agent=false)=>f.app.inject({method:'GET',url:'/v1/agent/decision-replay'+suffix,headers:p?{authorization:'Bearer '+(agent?p.agent:p.token)}:{}})};}
export async function dependencyMapFixture(){const f=await actual(await originalMapFixture());return{...f,read:(p,id=f.depotId,suffix='',agent=false)=>f.app.inject({method:'GET',url:'/v1/company/dependency-map/'+id+suffix,headers:p?{authorization:'Bearer '+(agent?p.agent:p.token)}:{}})};}
