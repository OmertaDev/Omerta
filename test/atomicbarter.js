import assert from 'node:assert/strict';
assert(!process.env.DATABASE_URL, 'Refuse ambient database endpoint');
const native = process.argv.includes('--postgres');
if (native) {
  const url = new URL(process.env.ATOMIC_BARTER_TEST_DATABASE_URL);
  assert(['postgres:','postgresql:'].includes(url.protocol)); assert.equal(url.hostname,'127.0.0.1');
  const local=['35439','35449'].includes(url.port)&&url.username==='pilot_runner'&&!url.password;
  const ci=url.port==='5432'&&url.username==='postgres'&&url.password==='pgcheck';
  assert(local||ci);assert(!url.search&&!url.hash);
  assert.match(url.pathname,/^\/atomic_barter_test_[a-z0-9_]+$/);
  const { default: pg } = await import('pg'), pre = new pg.Client({ connectionString: url.href });
  await pre.connect(); try { await pre.query('BEGIN READ ONLY'); assert.match((await pre.query('SHOW server_version')).rows[0].server_version,local?/^18\.4\b/:/^(?:16\b|18\.4\b)/);
    assert.equal((await pre.query('SELECT current_user AS role')).rows[0].role,local?'pilot_runner':'postgres');
    assert.equal((await pre.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0); await pre.query('ROLLBACK'); } finally { await pre.end(); }
  process.env.DATABASE_URL = url.href;
}
const { makeDb } = await import('../src/db.js'), I = await import('../src/items.js'), B = await import('../src/atomicbarter.js');
const Q = await import('../src/itemdurability.js'), G = await import('../src/game.js'), { runEstate } = await import('../src/social/estate.js');
const { collectAtomicBarterIssues } = await import('../src/atomicbarterinvariants.js');
const { runLedgerInvariants } = await import('../src/invariants.js');
const pool = await makeDb(), tx = fn => I.withItemTransaction(pool,fn), act = (p,a,b,k) => B.atomicBarterAction(pool,p.account,a,b,k);
let serial = 0;
async function player() {
  const p = { account: 'barter-account-' + ++serial, id: 'barter-character-' + serial };
  await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,$2,$1)',[p.account,'test']);
  await pool.query("INSERT INTO characters(id,account_id,name,season,loc) VALUES($1,$2,$1,1,'foundry')",[p.id,p.account]);
  await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)',[p.account]);
  return p;
}
const tool = async p => (await tx(c => I.createItem(c,{scope:'account',id:p.account},B.ATOMIC_BARTER.templateId,'imported','barter-fixture-tool-' + ++serial))).id;
async function pair() { const a=await player(),b=await player(); return { a,b,x:await tool(a),y:await tool(b) }; }
const body = f => ({ counterpartyCharacter:f.b.id,offeredItemId:f.x,requestedItemId:f.y,expiresInSeconds:600 });
const accept = offer => ({ offerId:offer.offerId,consent:true });
const items = async f => (await pool.query('SELECT * FROM item_instances WHERE id IN ($1,$2) ORDER BY id',[f.x,f.y])).rows;
const books = async () => ({ transactions:(await pool.query('SELECT * FROM transactions ORDER BY id')).rows, stacks:(await pool.query('SELECT * FROM item_stacks ORDER BY owner_scope,owner_id,template_id,quality')).rows });
async function originals(f) { const r=await items(f); assert.equal(r.find(x=>x.id===f.x).owner_id,f.a.account);assert.equal(r.find(x=>x.id===f.y).owner_id,f.b.account); }
try {
  const f=await pair(),foreign=await player(),before=await items(f),beforeBooks=await books();
  const offer=await act(f.a,'create',body(f),'offer'); await originals(f);
  await assert.rejects(B.atomicBarterCommand(pool,f.a.account,'create',body(f),'unbranded'),/active withItemTransaction/);
  assert.deepEqual(await act(f.a,'create',body(f),'offer'),offer);
  await assert.rejects(act(f.a,'create',{...body(f),expiresInSeconds:601},'offer'),/request_conflict/);
  await assert.rejects(act(f.b,'accept',{offerId:offer.offerId,consent:false},'no-consent'),/terms/);
  await assert.rejects(act(foreign,'accept',accept(offer),'foreign'),/offer/);
  assert.deepEqual((await B.ownAtomicBarterBoard(pool,foreign.account)).offers,[]);
  await assert.rejects(act(f.a,'accept',accept(offer),'maker-accept'),/taker/);
  assert.deepEqual(await B.atomicBarterCounterparts(pool,f.a.id),[f.b.id]);
  const result=await act(f.b,'accept',accept(offer),'accept');
  assert.equal(result.state,'completed'); assert.deepEqual(await act(f.b,'accept',accept(offer),'accept'),result);
  await assert.rejects(act(f.b,'accept',accept(offer),'another-key'),/original_party/);
  const after=await items(f); assert.equal(after.find(x=>x.id===f.x).owner_id,f.b.account);assert.equal(after.find(x=>x.id===f.y).owner_id,f.a.account);
  for(const old of before){const now=after.find(x=>x.id===old.id);for(const key of Object.keys(old).filter(k=>!['owner_id','updated_at'].includes(k)))assert.deepEqual(now[key],old[key],key+' immutable');}
  assert.deepEqual(await books(),beforeBooks); assert.deepEqual(await Q.collectItemConditionIssues(pool),[]);
  assert.deepEqual(await collectAtomicBarterIssues(pool),[]);
  const witness=(await pool.query("SELECT id,to_owner_id FROM item_events WHERE item_id=$1 AND event_kind='transferred'",[f.x])).rows[0];
  await pool.query('UPDATE item_events SET to_owner_id=$2 WHERE id=$1',[witness.id,foreign.account]);
  assert((await collectAtomicBarterIssues(pool)).some(row=>row.reason==='transfer_witness'));
  await pool.query('UPDATE item_events SET to_owner_id=$2 WHERE id=$1',[witness.id,witness.to_owner_id]);
  const inactive=await pair();await pool.query("UPDATE accounts SET status='suspended' WHERE id=$1",[inactive.a.account]);
  await assert.rejects(act(inactive.a,'create',body(inactive),'inactive'),/account/);
  await pool.query("UPDATE accounts SET status='active' WHERE id=$1",[inactive.a.account]);
  const broken=await pair(),creation=(await pool.query("SELECT id FROM item_events WHERE item_id=$1 AND event_kind='created'",[broken.x])).rows[0];
  // Explicit refusal-only corrupted-condition fixture; this is not a qualified wear source.
  await pool.query('INSERT INTO item_durability_states(item_id,creation_event,remaining,revision) VALUES($1,$2,0,1)',[broken.x,creation.id]);
  await assert.rejects(act(broken.a,'create',body(broken),'broken'),/broken/);
  await pool.query('DELETE FROM item_durability_states WHERE item_id=$1',[broken.x]);
  const unsupported=await pair();await tx(c=>I.escrowItem(c,{scope:'account',id:unsupported.a.account},'fixture-op',unsupported.x,'fixture custody','barter-escrow-negative','used_in_operation'));
  await assert.rejects(act(unsupported.a,'create',body(unsupported),'escrowed'),/item_custody/);
  await tx(c=>I.releaseEscrow(c,'fixture-op',{scope:'account',id:unsupported.a.account},unsupported.x,'fixture return','barter-return-negative'));
  const late=await pair(),lateOffer=await act(late.a,'create',body(late),'late-offer'),lateBefore=await items(late);
  const snapshotEvents=(await pool.query('SELECT id FROM item_events ORDER BY id')).rows;
  await assert.rejects(tx(async c=>{const query=c.query.bind(c);let injected=false;c.query=async(sql,args)=>{if(!injected && sql.includes('SET owner_scope=') && args?.[0]===late.y){injected=true;throw Error('second barter leg fault');}return query(sql,args);};try{try{await B.atomicBarterCommand(c,late.b.account,'accept',accept(lateOffer),'caught-second-leg');}catch{}}finally{c.query=query;}}),/second barter leg fault/);
  assert.deepEqual(await items(late),lateBefore); assert.deepEqual((await pool.query('SELECT id FROM item_events ORDER BY id')).rows,snapshotEvents);
  assert.equal((await pool.query('SELECT receipt FROM atomic_barter_requests WHERE account_id=$1 AND request_key=$2',[late.b.account,'caught-second-leg'])).rows.length,0);
  await assert.rejects(tx(async c=>{await B.atomicBarterCommand(c,late.b.account,'accept',accept(lateOffer),'late-fault');throw Error('late root fault');}),/late root fault/);
  assert.deepEqual(await items(late),lateBefore);
  await act(late.a,'cancel',{offerId:lateOffer.offerId},'cancel'); await originals(late);
  const drift=await pair(),driftOffer=await act(drift.a,'create',body(drift),'drift-offer');
  await tx(c=>I.transferItem(c,{scope:'account',id:drift.a.account},{scope:'account',id:foreign.account},drift.x,'barter fixture legitimate separate transfer','drift-transfer'));
  await assert.rejects(act(drift.b,'accept',accept(driftOffer),'drift-accept'),/item_custody/);
  assert.equal((await items(drift)).find(x=>x.id===drift.y).owner_id,drift.b.account);
  const cap=await pair();const caps=[];for(let n=0;n<3;n++)caps.push(await act(cap.a,'create',body(cap),'cap-'+n));
  await assert.rejects(act(cap.a,'create',body(cap),'cap-over'),/active_limit/);await act(cap.a,'cancel',{offerId:caps[0].offerId},'cap-close');
  const death=await pair(),deathOffer=await act(death.a,'create',body(death),'death-offer');
  await assert.rejects(tx(c=>B.voidAtomicBartersAtDeath(c,{id:death.a.id,account_id:death.a.account})),/death_required/);
  await G.withTwoCharacters(pool,foreign.account,death.a.id,async(_observer,victim,c,h)=>{
    await runEstate(c,h,victim,'atomic barter fixture death');
    assert.equal((await c.query('SELECT state FROM atomic_barter_offers WHERE id=$1',[deathOffer.offerId])).rows[0].state,'party_dead');
    assert.equal((await B.voidAtomicBartersAtDeath(c,victim)).retired,0,'Actual estate already retired the original consent');
  },{meet:false});
  assert.deepEqual(await act(death.a,'create',body(death),'death-offer'),deathOffer);
  await assert.rejects(act(death.b,'accept',accept(deathOffer),'dead-accept'),/original_party/);
  assert.equal((await pool.query('SELECT state FROM atomic_barter_offers WHERE id=$1',[deathOffer.offerId])).rows[0].state,'party_dead');
  assert.equal((await tx(c=>B.voidAtomicBartersAtDeath(c,{id:death.a.id,account_id:death.a.account}))).retired,0);
  assert.deepEqual(await collectAtomicBarterIssues(pool),[]);
  if(native){
    const race=await pair(),raceOffer=await act(race.a,'create',body(race),'race-offer');
    const results=await Promise.all([act(race.b,'accept',accept(raceOffer),'same-key'),act(race.b,'accept',accept(raceOffer),'same-key')]);assert.deepEqual(results[0],results[1]);
    assert.equal((await pool.query("SELECT id FROM item_events WHERE item_id IN ($1,$2) AND event_kind='transferred'",[race.x,race.y])).rows.length,2);
    const expiry=await pair(),expiryOffer=await act(expiry.a,'create',body(expiry),'expiry-offer');
    await pool.query('UPDATE atomic_barter_offers SET expires_at=$2 WHERE id=$1',[expiryOffer.offerId,new Date(Date.now()+1800)]);
    const holder=await pool.connect();await holder.query('BEGIN');await holder.query('SELECT id FROM item_instances WHERE id=$1 FOR UPDATE',[expiry.x]);
    const attempt=act(expiry.b,'accept',accept(expiryOffer),'wait-expiry'),rejected=assert.rejects(attempt,/expired/);
    let waiting=false;const waitDeadline=Date.now()+3000;
    while(Date.now()<waitDeadline){if((await pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT id,template_id,owner_scope%' LIMIT 1")).rows.length){waiting=true;break;}await new Promise(r=>setTimeout(r,10));}
    assert(waiting,'Actual barter canonical item lock wait must be witnessed');
    assert.equal((await pool.query("SELECT id FROM item_events WHERE item_id IN ($1,$2) AND event_kind='transferred'",[expiry.x,expiry.y])).rows.length,0);
    await new Promise(r=>setTimeout(r,2200));await holder.query('COMMIT');holder.release();await rejected;await originals(expiry);
    const compete=await pair(),one=await act(compete.a,'create',body(compete),'one'),two=await act(compete.a,'create',body(compete),'two');
    const contenders=await Promise.allSettled([act(compete.b,'accept',accept(one),'one-accept'),act(compete.b,'accept',accept(two),'two-accept')]);
    assert.equal(contenders.filter(r=>r.status==='fulfilled').length,1);assert.equal(contenders.filter(r=>r.status==='rejected').length,1);
    assert.match(contenders.find(r=>r.status==='rejected').reason.message,/item_custody/);
  }
  assert.deepEqual(await collectAtomicBarterIssues(pool),[]);
  const global=await runLedgerInvariants(pool,{alert:false});assert.deepEqual(global.checks.filter(row=>!row.ok).map(row=>row.name),[]);
  console.log('atomicbarter '+(native?'native18.4':'memory')+' PASS: canonical healthy precision UID swap, immutable identities/condition/no cash or stack effects, fixed original parties/private offers, exact replay/body conflicts/caps, caught second-leg and late rollback, actual estate sameTX leaf/noheir; native samekey and item-wait expiry. Shared registration/estate hook remains coordinator-owned.');
} finally { await pool.end(); }
