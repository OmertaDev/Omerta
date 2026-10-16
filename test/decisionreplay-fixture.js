import assert from 'node:assert/strict';
export async function decisionReplayFixture(){
 assert(!process.env.DATABASE_URL,'No ambient endpoint');
 Object.assign(process.env,{LEGAL_PROFILE_DEFER:'on',RESOURCE_ECONOMY:'off'});
 if(process.argv.includes('--postgres')){
  const u=new URL(process.env.DECISION_REPLAY_TEST_DATABASE_URL);assert(['postgres:','postgresql:'].includes(u.protocol));assert.equal(u.hostname,'127.0.0.1');assert(!u.search&&!u.hash);assert.match(u.pathname,/^\/economic_intelligence_test_decision_replay_[a-f0-9]{12}$/);
  const local=['35439','35449'].includes(u.port)&&u.username==='pilot_runner'&&!u.password,ci=u.port==='5432'&&u.username==='postgres'&&u.password==='pgcheck';assert(local||ci);process.env.ECONOMIC_INTELLIGENCE_TEST_DATABASE_URL=u.href;
 }
 const{intelligenceFixture}=await import('./economicintelligence-fixture.js'),f=await intelligenceFixture();
 const{default:Fastify}=await import('fastify'),{register}=await import('../src/routes/decisionreplay.js');
 const api=Fastify();api.setErrorHandler((e,_r,reply)=>reply.code(e.statusCode||400).send({error:e.code||'internal',message:e.message}));
 const auth=async req=>{let p;try{p=f.app.jwt.verify(String(req.headers.authorization||'').replace(/^Bearer /,''));}catch{throw Object.assign(Error('auth'),{statusCode:401});}const a=(await f.app.pool.query('SELECT status,token_version FROM accounts WHERE id=$1',[p.sub])).rows[0];if(!a||a.status!=='active'||Number(a.token_version)!==Number(p.tv??0))throw Object.assign(Error('auth'),{statusCode:401});req.user=p;};
 register(api,{pool:f.app.pool,auth});
 const read=(p,path,agent=false)=>api.inject({method:'GET',url:'/v1/agent/decision-replay'+path,headers:p?{authorization:'Bearer '+(agent?p.agent:p.token)}:{}});
 return{...f,api,read,close:async()=>{await api.close();await f.close();}};
}
