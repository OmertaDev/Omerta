// Administrative negative/history collector fixtures only; never a completed move.
import assert from 'node:assert/strict';
assert(!process.env.DATABASE_URL&&!process.env.NODE_OPTIONS);
const {makeDb}=await import('../src/db.js'),{collectBusinessRelocationIssues}=await import('../src/businessrelocationhistory.js');
const pool=await makeDb();
try{
 const tables=['business_relocation_plans','business_relocation_requests','business_depot_journal','business_depots','transactions','character_cargo','characters','accounts'];
 const snapshot=async()=>Object.fromEntries(await Promise.all(tables.map(async t=>[t,(await pool.query('SELECT * FROM '+t)).rows])));
 let reads=0;const c={query:async(sql,args)=>{assert(/^SELECT\b/.test(sql),'Read-only history collector');reads++;return pool.query(sql,args);}};
 let before=await snapshot();assert.deepEqual(await collectBusinessRelocationIssues(c),[]);assert.deepEqual(await snapshot(),before);
 await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES('negative-history','fixture','negative-history')");
 await pool.query("INSERT INTO characters(id,account_id,name,season,cash,bank,loc) VALUES('negative-history-original','negative-history','Negative History',1,0,0,'foundry')");
 await pool.query("INSERT INTO business_depots(id,owner_character,district,sale_price,bid_price,reorder_at,target_stock,restock_budget) VALUES('negative-history-depot','negative-history-original','foundry',2000,500,0,0,0)");
 await pool.query("INSERT INTO business_relocation_plans(id,depot_id,account_id,original_character,destination,source_hash,source_snapshot,expires_at,revision,state) VALUES('negative-plan','negative-history-depot','negative-history','negative-history-original','docks',$1,$2,clock_timestamp()+interval '60 seconds',1,'ready')",['a'.repeat(64),{notAnAuthoritativeSource:true}]);
 before=await snapshot();assert.deepEqual(await collectBusinessRelocationIssues(c),[{planId:'negative-plan',reason:'source'}]);assert.deepEqual(await snapshot(),before);assert(reads>0);
 console.log('PASS SELECT-only collector/no row repair; explicit malformed-source negative fixture detected. No relocation/gameplay/accounting-positive claim.');
}finally{await pool.end();}
