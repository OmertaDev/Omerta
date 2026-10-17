import {ensureComponentDDL} from './lib/company-middle-five-fixture-schema.js';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
assert(!process.env.DATABASE_URL,'No ambient database endpoint');
assert(!process.argv.includes('--postgres'),'No native lease or reviewed canonical relocation leaf.');
const {makeDb}=await import('../src/db.js'),I=await import('../src/items.js'),R=await import('../src/businessrelocation.js');
const good={businessId:'existing-depot',destination:'foundry',sourceHash:'a'.repeat(64),durationSeconds:60};
assert.deepEqual(R.businessRelocationTerms('create',good),good);
for(const body of [{...good,extra:true},{...good,businessId:'bad identity'},{...good,destination:'invented'},{...good,durationSeconds:59},{...good,durationSeconds:601},{...good,durationSeconds:'60'},{...good,sourceHash:'unknown'}])assert.throws(()=>R.businessRelocationTerms('create',body));
for(const action of ['unknown','deposit','return','travel'])assert.throws(()=>R.businessRelocationTerms(action,good));
assert.deepEqual(R.businessRelocationAvailability(),{available:false,effect:'same_depot_settled_stock_paid_travel'});
const pool=await makeDb();
try{
 await ensureComponentDDL(pool,fs.readFileSync(new URL('../docs/business-relocation-proposal.sql',import.meta.url),'utf8'),['business_relocation_plans','business_relocation_requests']);
 const ch={id:'original-owner',account_id:'owner-account',alive:true,is_npc:false};
 const before=async()=>({requests:(await pool.query('SELECT * FROM business_relocation_requests')).rows,plans:(await pool.query('SELECT * FROM business_relocation_plans')).rows,transactions:(await pool.query('SELECT * FROM transactions')).rows});
 const initial=await before();
 await assert.rejects(R.runBusinessRelocation(pool,ch.account_id,'create',good,'fresh',{agent:false}),e=>e.code==='business_relocation'&&e.message==='transactional_backend_required');
 assert.deepEqual(await before(),initial);
 await assert.rejects(I.withItemTransaction(pool,c=>R.voidBusinessRelocationsInEstate(c,ch.id,{})),e=>e.code==='estate_scope');
 assert.deepEqual(await before(),initial);
 // Explicit historical protocol fixture only; no fabricated relocation, cash,
 // travel, cargo or source-admission success is inferred from this response.
 const stable=value=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
 const hash=value=>crypto.createHash('sha256').update(stable(value)).digest('hex');
 const receipt={ok:true,planId:'historical',state:'cancelled',revision:2};
 await pool.query('INSERT INTO business_relocation_requests(account_id,key_hash,body_hash,run_id) VALUES($1,$2,$3,$4)',[ch.account_id,hash([ch.account_id,'old']),hash({action:'create',terms:good}),'old-run']);
 await assert.rejects(R.runBusinessRelocation(pool,ch.account_id,'create',good,'old',{agent:false}),e=>e.code==='business_relocation_in_progress');
 await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES('owner-account','relocation-boundary','owner-account')");
 await pool.query("INSERT INTO characters(id,account_id,name,season,alive,loc) VALUES('original-owner','owner-account','Relocation Original',1,false,'foundry')");
 const historical={ok:true,planId:'past-cancelled-plan',state:'cancelled',revision:2};
 await pool.query('UPDATE business_relocation_requests SET receipt=$1,account_ref=$2,actor_ref=$3',[historical,ch.account_id,ch.id]);
 assert.deepEqual(await R.runBusinessRelocation(pool,ch.account_id,'create',good,'old',{agent:true}),historical);
 await assert.rejects(R.runBusinessRelocation(pool,ch.account_id,'create',{...good,durationSeconds:61},'old',{agent:false}),e=>e.code==='business_relocation');
 await assert.rejects(R.runBusinessRelocation(pool,'foreign-account','create',good,'old',{agent:false}),e=>e.code==='business_relocation'&&e.message==='transactional_backend_required');
 await pool.query('DELETE FROM business_relocation_requests');
 assert.deepEqual((await I.withItemRead(pool,c=>R.businessRelocationBoard(c,ch.account_id))).plans,[]);
 console.log('Business relocation terms, private empty board, pending conflict and missing canonical leaf fail-closed PASS; no positive canonical relocation claim.');
}finally{await pool.end();}




