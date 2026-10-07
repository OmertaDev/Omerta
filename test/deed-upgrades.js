import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import { allocateEpoch, brokerBoard } from '../src/brokers.js';
import { upgradeWeights } from '../src/deed-upgrades.js';
import { DEED_UPGRADES, dayOf } from '../src/rules.js';
import { runLedgerInvariants } from '../src/invariants.js';
let admin, database;
if (process.argv.includes('--postgres')) {
 const { Pool } = await import('pg');
 const endpoint = new URL(process.env.DEED_TEST_DATABASE_URL || '');
 assert(['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname),'isolated loopback database only');
 admin = new Pool({connectionString:endpoint.toString()});
 database = 'deed_review_' + (await import('node:crypto')).randomBytes(8).toString('hex');
 await admin.query('CREATE DATABASE '+database);
 endpoint.pathname='/'+database;process.env.DATABASE_URL=endpoint.toString();
 process.env.JWT_SECRET='isolated-deed-test-secret';process.env.MOD_KEY='isolated-deed-test-mod-key';process.env.MARKET_SEED='isolated-deed-test-market-seed';process.env.INVITE_MODE='off';process.env.SOCIAL_VERIFY_MODE='off';process.env.RATE_LIMIT='off';process.env.POPULATION_OFF='on';
}
const app = await buildServer(); const pool = app.pool;
const call = async (method,url,token,body) => { const r=await app.inject({method,url,headers:token?{authorization:'Bearer '+token}:{},payload:body}); return {code:r.statusCode,...r.json()}; };
const token=(await call('POST','/v1/auth/guest')).token;
await call('POST','/v1/character',token,{name:'Upgrade Keeper'});
const ch=(await call('GET','/v1/me',token)).character;
const aid=(await pool.query('SELECT account_id FROM characters WHERE id=$1',[ch.id])).rows[0].account_id;
await pool.query('UPDATE account_persistent SET omr=20000 WHERE account_id=$1',[aid]);
await call('POST','/v1/deeds/claim',token,{name:'Reward Street',district:'neon'});
const deed=(await pool.query('SELECT name FROM street_deeds WHERE account_id=$1',[aid])).rows[0];
assert(deed, 'fixture district must create a deed');
const today=dayOf();
await pool.query("INSERT INTO activity_log (account_id,day,tag,n) VALUES ($1,$2,'crime',200),($1,$2,'jump',20),($1,$2,'heist',5)",[aid,today]);
let r=await call('POST','/v1/deeds/upgrade',token,{deedName:deed.name,expectedLevel:0});
assert.equal(r.error,'not_enough_renown');
for(let i=0;i<125;i++) await pool.query("INSERT INTO street_deed_history (account_id,kind,detail) VALUES ($1,'claim','earned milestone')",[aid]);
const shelfBefore=Number((await pool.query('SELECT balance FROM desk_inventory WHERE id=1')).rows[0]?.balance || 0);
const recycleBefore=Number((await pool.query("SELECT COALESCE(SUM(amount),0) AS n FROM transactions WHERE currency='omr' AND reason='desk:recycle'")).rows[0].n);
const old=await allocateEpoch(pool,{endDay:today});
const oldWeight=Number((await pool.query('SELECT weight FROM broker_weights WHERE epoch_id=$1 AND account_id=$2',[old.epochId,aid])).rows[0].weight);
if (admin) {
 const requests = await Promise.all(Array.from({length:8}, () => call('POST','/v1/deeds/upgrade',token,{deedName:deed.name,expectedLevel:0})));
 assert.equal(requests.filter(r=>r.code===200).length,1,'only one simultaneous payment succeeds');
 assert(requests.filter(r=>r.code!==200).every(r=>r.error==='stale_upgrade'),'all retries stop before paying next tier');
 assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM deed_upgrades WHERE deed_name=$1',[deed.name])).rows[0].n),1);
}
for(const t of DEED_UPGRADES.filter(t => !admin || t.level>1)){
 r=await call('POST','/v1/deeds/upgrade',token,{deedName:deed.name,expectedLevel:t.level-1});assert.equal(r.code,200,JSON.stringify(r));assert.equal(r.bonusBps,t.bonusBps);assert.equal(r.effectiveFromDay,today+1);
 const retry=await call('POST','/v1/deeds/upgrade',token,{deedName:deed.name,expectedLevel:t.level-1});assert.equal(retry.error,'stale_upgrade');
}
assert.equal(Number((await pool.query('SELECT omr FROM account_persistent WHERE account_id=$1',[aid])).rows[0].omr),20000-DEED_UPGRADES.reduce((s,t)=>s+t.costOmr,0));
const totalCost=DEED_UPGRADES.reduce((sum,t)=>sum+t.costOmr,0);
assert.equal(Number((await pool.query('SELECT balance FROM desk_inventory WHERE id=1')).rows[0].balance)-shelfBefore,totalCost,'all sink value recycled to desk');
const ledger=(await pool.query("SELECT amount FROM transactions WHERE account_id=$1 AND currency='omr' AND reason='deed:upgrade'",[aid])).rows;
assert.deepEqual(ledger.map(r=>-Number(r.amount)).sort((a,b)=>a-b),DEED_UPGRADES.map(t=>t.costOmr),'each upgrade has exact ledger debit');
assert.equal(Number((await pool.query("SELECT COALESCE(SUM(amount),0) AS n FROM transactions WHERE currency='omr' AND reason='desk:recycle'")).rows[0].n)-recycleBefore,totalCost,'paired desk recycling ledger reconciles');
assert.equal((await upgradeWeights(pool,today)).get(aid),0,'no retroactive epoch bonus');
assert.equal((await upgradeWeights(pool,today+1)).get(aid),2500,'max future weight bonus');
assert.equal(Number((await pool.query('SELECT weight FROM broker_weights WHERE epoch_id=$1 AND account_id=$2',[old.epochId,aid])).rows[0].weight),oldWeight,'published weights remain frozen');
assert.equal((await call('GET','/v1/deeds',token)).upgrades.next,null);
await pool.query('UPDATE street_deeds SET onchain_token_id=$2, extracted_by_account=$1,onchain_owner=$3 WHERE account_id=$1',[aid,'123','0xbuyer']);
assert.equal((await call('POST','/v1/deeds/upgrade',token,{deedName:deed.name,expectedLevel:4})).error,'not_deed_owner','stale extractor cannot spend on sold NFT');
assert.equal((await upgradeWeights(pool,today+1)).has(aid),false,'bonus does not remain with seller');
const buyer=(await call('POST','/v1/auth/guest')).token;
await call('POST','/v1/character',buyer,{name:'Reward Buyer'});
const buyerCh=(await call('GET','/v1/me',buyer)).character;
const buyerAid=(await pool.query('SELECT account_id FROM characters WHERE id=$1',[buyerCh.id])).rows[0].account_id;
await pool.query('UPDATE account_persistent SET wallet_address=$2 WHERE account_id=$1',[buyerAid,'0xBUYER']);
assert.equal((await upgradeWeights(pool,today+1)).get(buyerAid),2500,'permanent bonus follows observed owner linked wallet');
await pool.query('UPDATE street_deeds SET ownership_since_day=$2 WHERE name=$1',[deed.name,today+2]);
assert.equal((await upgradeWeights(pool,today+1)).get(buyerAid),0,'acquisition cannot boost pre-acquisition epoch');
assert.equal((await upgradeWeights(pool,today+2)).get(buyerAid),2500,'acquisition qualifies future epoch');
await pool.query('UPDATE account_persistent SET reward_wallet_since_day=$2 WHERE account_id=$1',[buyerAid,today+3]);
assert.equal((await upgradeWeights(pool,today+2)).get(buyerAid),0,'rotated wallet cannot boost pre-link epoch');
assert.equal((await upgradeWeights(pool,today+3)).get(buyerAid),2500,'new linked owner qualifies future epoch');
for(const n of [2,10,100]){
 const funding=100; const baseline=funding/n; const upgraded=funding*1.25/(n-1+1.25); const others=funding/(n-1+1.25);
 assert(upgraded>baseline);assert(upgraded/baseline<1.25);assert(Math.abs(upgraded+(n-1)*others-funding)<1e-10,'upgrade adds no funding');
}
const inv=await runLedgerInvariants(pool,{alert:false});assert(inv.checks.find(c=>/vocabulary/i.test(c.name)).ok,'upgrade reason recognized');
await app.close();if(admin){ await pool.end(); await admin.query('DROP DATABASE '+database);await admin.end(); }console.log('deed upgrades: PASS (sequential costs, stale guard, milestones, future-only bonus, ownership transfer, fixed pool)');
