import assert from 'node:assert/strict';
import { customerVaultFixture } from './customervaults-fixture.js';
import { canonicalDatabaseSnapshot } from '../tools/rc1-native-proof.js';
import { runEstate } from '../src/social/estate.js';
assert(process.argv.includes('--postgres'),'Native locks/rollback/deadlines require real PostgreSQL');
const f=await customerVaultFixture(),{pool,V,runtime,owner,customers,stranger}=f;
const action=(p,a,b,k)=>runtime.action(p.account,a,b,k),pause=ms=>new Promise(r=>setTimeout(r,ms));
const snapshot=async()=>{const {capturedAt,...stored}=await canonicalDatabaseSnapshot(pool);return stored;};
const wait=async predicate=>{const until=Date.now()+5000;do{if(await predicate())return;await pause(25);}while(Date.now()<until);throw Error('Expected real native row wait not observed');};
const waiting=async(fragment)=>Number((await pool.query("SELECT COUNT(*) AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE $1",['%'+fragment+'%'])).rows[0].n)>0;
try{
  const service=(await action(owner,'open',{depotId:f.depotId,feeCash:100,lifetimeSeconds:3600,consent:true},'native-open')).service,b={serviceId:service.id,sourceHash:service.sourceHash,principal:10000,maxFeeCash:100,consent:true};
  const customerBefore=await f.cash(customers[0]),ownerBefore=await f.cash(owner);
  const same=await Promise.all([action(customers[0],'deposit',b,'native-same'),action(customers[0],'deposit',b,'native-same')]);assert.equal(same[0].position.id,same[1].position.id);assert.equal((await pool.query('SELECT id FROM customer_vault_positions')).rows.length,1);assert.equal(await f.cash(customers[0]),customerBefore-10100);assert.equal(await f.cash(owner),ownerBefore+100);await f.books();
  const p=same[0].position;const withdrawn=await Promise.all([action(customers[0],'withdraw',{positionId:p.id,sourceHash:p.sourceHash,consent:true},'native-withdraw'),action(customers[0],'withdraw',{positionId:p.id,sourceHash:p.sourceHash,consent:true},'native-withdraw')]);assert.equal(withdrawn[0].position.releaseCredit,withdrawn[1].position.releaseCredit);assert.equal(await f.cash(customers[0]),customerBefore-100);await f.books();
  // Ordinary disposable fixture constraint simulates a final receipt-store failure, not player authority or an exploit.
  await pool.query("ALTER TABLE customer_vault_requests ADD CONSTRAINT negative_vault_receipt CHECK (receipt->>'ok'<>'true') NOT VALID");
  const receiptBlock=await pool.connect();await receiptBlock.query('BEGIN');await receiptBlock.query('SELECT id FROM customer_vault_services WHERE id=$1 FOR UPDATE',[service.id]);
  const lateFault=action(customers[1],'deposit',b,'native-late-fault').then(value=>({value}),error=>({error}));await wait(()=>waiting('customer_vault_services WHERE id='));const beforeFault=await snapshot();await receiptBlock.query('ROLLBACK');receiptBlock.release();assert((await lateFault).error);assert.deepEqual(await snapshot(),beforeFault,'All custody-transaction stored rows/sequences roll back after principal+fee+position writes; snapshot follows genuine precommitted G phase-one settlement');await pool.query('ALTER TABLE customer_vault_requests DROP CONSTRAINT negative_vault_receipt');
  // Deposit wins the original character locks. A death preflight that discovered no position must reject its changed counterpart set and retry whole.
  const blocker=await pool.connect();await blocker.query('BEGIN');await blocker.query('SELECT id FROM customer_vault_services WHERE id=$1 FOR UPDATE',[service.id]);
  const deposit=action(customers[1],'deposit',b,'native-before-death');await wait(()=>waiting('customer_vault_services WHERE id='));
  const death=f.pair(stranger,customers[1],(_a,v,c,h)=>runEstate(c,h,v,'vault source-set race')).then(value=>({value}),error=>({error}));await wait(()=>waiting('FROM characters WHERE id='));await blocker.query('ROLLBACK');blocker.release();await deposit;const refused=await death;assert(refused.error,'Changed preactor set must refuse instead of acquiring late operator lock');assert.match(String(refused.error.code),/contention/);assert.equal((await pool.query('SELECT alive FROM characters WHERE id=$1',[customers[1].id])).rows[0].alive,true);assert.equal((await V.customerVaultAccounting(pool)).reserve,10000);
  await f.pair(stranger,customers[1],(_a,v,c,h)=>runEstate(c,h,v,'vault whole fresh retry'));assert.equal((await V.customerVaultAccounting(pool)).reserve,0);await f.books();
  // Genuine minimum60-second expiry. Begin a real bounded depot-row wait shortly before expiry; fresh read after lock must refuse.
  await action(owner,'close',{serviceId:service.id,sourceHash:service.sourceHash,consent:true},'native-close');
  const short=(await action(owner,'open',{depotId:f.depotId,feeCash:100,lifetimeSeconds:60,consent:true},'native-short')).service,deadline=+new Date(short.expiresAt),elapsedStart=Date.now();
  while(Date.now()<deadline-5000)await pause(Math.min(1000,deadline-5000-Date.now()));
  const depotLock=await pool.connect();await depotLock.query('BEGIN');await depotLock.query('SELECT id FROM business_depots WHERE id=$1 FOR UPDATE',[f.depotId]);
  const expired=action(customers[2],'deposit',{...b,serviceId:short.id,sourceHash:short.sourceHash},'native-expired').then(value=>({value}),error=>({error}));await wait(()=>waiting('business_depots WHERE id='));assert(Date.now()<deadline,'Genuine native row wait begins before deadline');
  const beforeExpiry=await snapshot();while(Date.now()<=deadline+25)await pause(Math.min(100,deadline+26-Date.now()));await depotLock.query('ROLLBACK');depotLock.release();const no=await expired;assert(no.error);assert.deepEqual(await snapshot(),beforeExpiry,'No custody transaction effect after expired source; existing G phase-one settlement was already committed before wait snapshot');assert.equal((await V.customerVaultAccounting(pool)).reserve,0);await f.books();
  console.log('Customer vault native18.4 concurrency/rollback/proposed-estate race/fresh post-lock expiry PASS; genuine elapsedMs='+String(Date.now()-elapsedStart)+'. No runtime timeout changes or manual death/status/time overrides.');
}finally{await f.close();}
