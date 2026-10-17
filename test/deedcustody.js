// Fast state/identity/projection checks. Real transaction rollback and ordering are
// exercised separately against PostgreSQL, not claimed from pg-mem.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newDb } from 'pg-mem';
import {
  createCharacterDeedLifeHash, ensureCharacterDeedLife, recordCharacterDeedDeath, recordTrackedCharacterDeedDeath,
  backfillCharacterDeedEstates, CHARACTER_DEED_ESTATE_DELAY_MS,
  resolveCharacterDeedBeneficiary, bindCharacterDeedAccount,
  recordCharacterDeedEquipment, listCharacterDeedOutbox,
  confirmCharacterDeedDeath, requestCharacterDeedExit, cancelCharacterDeedExit,
  characterDeedStatus, CHARACTER_DEED_EXIT_NOTICE_MS,
} from '../src/deedcustody.js';

const schema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const migration = schema.match(/-- Character-life deed custody\.[\s\S]*?-- End character-life deed custody\./)?.[0];
assert(migration);
const db = newDb();
db.public.none(`CREATE TABLE characters(id TEXT PRIMARY KEY,account_id TEXT,generation INT,alive BOOLEAN);
  CREATE TABLE dynasty_tokens(token_id TEXT PRIMARY KEY,account_id TEXT);`);
db.public.none(migration);
const adapter = db.adapters.createPg(), pool = new adapter.Pool();
db.public.none('CREATE TABLE keeper_transactions(job_key TEXT PRIMARY KEY,status TEXT)');
const priorEnabled = process.env.CHARACTER_DEED_CUSTODY_ENABLED;
process.env.CHARACTER_DEED_CUSTODY_ENABLED = 'true';
const txHash = '0x' + '11'.repeat(32);
const event = n => ({ finalized: true, txHash, ref: `${txHash}:${n}`, blockNumber: n, logIndex: 0, blockTimestamp: 1_700_000_000 + n });
const address = n => `0x${String(n).padStart(40, '0')}`;
async function seed(id, account = id, generation = 1) {
  await pool.query('INSERT INTO characters(id,account_id,generation,alive) VALUES ($1,$2,$3,true)', [id, account, generation]);
  return ensureCharacterDeedLife(pool, id);
}
async function die(victim, killer = null, heir = null) {
  if (!heir && killer) {
    const row = (await pool.query('SELECT account_id,generation FROM characters WHERE id=$1', [victim])).rows[0];
    heir = `${victim}-heir`;
    if (!(await pool.query('SELECT id FROM characters WHERE id=$1', [heir])).rows.length) await seed(heir, row.account_id, Number(row.generation) + 1);
  }
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [victim]);
  return recordCharacterDeedDeath(pool, { victimCharacterId: victim, killerCharacterId: killer, heirCharacterId: heir });
}
try {
  await pool.query("INSERT INTO characters VALUES ('untracked','unused-account',1,false)");
  assert.equal((await recordTrackedCharacterDeedDeath(pool,{victimCharacterId:'untracked'})).untracked,true);
  assert.equal((await pool.query('SELECT next_death_sequence FROM character_deed_state')).rows[0].next_death_sequence,1,
    'Untracked deaths consume no future keeper gas or sequence ordinal');
  const a = await seed('a1', 'account-a'), b = await seed('b1', 'account-b'), c = await seed('c1', 'account-c');
  assert.notEqual(createCharacterDeedLifeHash(), createCharacterDeedLifeHash(), 'new lives receive opaque independent identifiers');
  assert.equal((await ensureCharacterDeedLife(pool, 'a1')).life_hash, a.life_hash, 'repeated lookup retains the persisted opaque identifier');
  for (const [i, life] of [a,b,c].entries())
    await bindCharacterDeedAccount(pool, { lifeHash: life.life_hash, address: address(i + 1), dynastyTokenId: null, ...event(i + 1) });
  await assert.rejects(() => bindCharacterDeedAccount(pool, { lifeHash: a.life_hash, address: address(9), ...event(4) }), { code: 'custody_binding' });
  await pool.query("INSERT INTO dynasty_tokens(token_id,account_id) VALUES ('12','account-c')");
  await assert.rejects(() => bindCharacterDeedAccount(pool, { lifeHash: a.life_hash, address: address(1), dynastyTokenId: '12', ...event(4) }), { code: 'custody_binding' });
  await assert.rejects(() => recordCharacterDeedEquipment(pool, { tokenId: '77', lifeHash: a.life_hash, ...event(5), finalized: false }), { code: 'custody_receipt' });
  await recordCharacterDeedEquipment(pool, { tokenId: '77', lifeHash: a.life_hash, ...event(5) });
  const started = await requestCharacterDeedExit(pool, 'account-a', { tokenId: '77' });
  assert.equal(new Date(started.availableAt) - new Date(started.requestedAt), CHARACTER_DEED_EXIT_NOTICE_MS);
  assert.equal(started.benefitsActive, false);
  const repeated = await requestCharacterDeedExit(pool, 'account-a', { tokenId: '77' });
  assert.equal(+repeated.availableAt, +started.availableAt, 'retry does not reset the notice');
  await assert.rejects(() => requestCharacterDeedExit(pool, 'account-a', { tokenId: '77', userNonce: 0,
    userIssuedAt: Math.floor(Date.now()/1000), userDeadline: Math.floor(Date.now()/1000)+60, userSignature: '0x1234' }), { code: 'custody_consent' });
  const available = new Date(Date.now() - 10_000);
  await pool.query('UPDATE character_deed_exits SET available_at=$1 WHERE life_id=$2', [available, 'a1']);
  const now = Math.floor(Date.now()/1000);
  const consent = await requestCharacterDeedExit(pool, 'account-a', { tokenId: '77', userNonce: 0,
    userIssuedAt: now, userDeadline: now+60, userSignature: '0x1234' });
  assert.equal(+consent.availableAt, +available);
  assert(consent.consentStored, 'storage is not signature verification; keeper verifies before release');
  await die('a1', 'b1');
  assert.equal((await pool.query("SELECT status FROM character_deed_exits WHERE life_id='a1'")).rows[0].status, 'cancelled');
  assert.equal((await die('a1', 'b1')).recorded, false, 'duplicate true death has one outbox row');
  await assert.rejects(() => die('a1', 'c1'), { code: 'custody_death_conflict' });
  delete process.env.CHARACTER_DEED_CUSTODY_ENABLED;
  await seed('b1-heir','account-b',2);
  await pool.query("UPDATE characters SET alive=false WHERE id='b1'");
  await recordTrackedCharacterDeedDeath(pool,{victimCharacterId:'b1',killerCharacterId:'c1',heirCharacterId:'b1-heir'});
  process.env.CHARACTER_DEED_CUSTODY_ENABLED = 'true';
  assert.equal((await pool.query("SELECT status FROM character_deed_lives WHERE life_id='b1'")).rows[0].status,'dead',
    'A tracked pending-incoming killer remains mortal even when custody activation is switched off');
  assert.equal((await resolveCharacterDeedBeneficiary(pool, a.life_hash)).lifeId, 'c1', 'unsettled A -> B -> C loot follows exact lives');
  const heir = await seed('a2', 'account-a', 2);
  assert.notEqual(heir.life_hash, a.life_hash, 'a bloodline heir receives another independently generated life identifier');
  assert.equal((await characterDeedStatus(pool, 'account-a')).equipment.length, 0, 'heir does not inherit historical equipment');
  assert.equal((await resolveCharacterDeedBeneficiary(pool, 'a1')).lifeId, 'c1');
  await assert.rejects(() => recordCharacterDeedDeath(pool, { victimCharacterId: 'c1' }), { code: 'custody_death' });
  const pending = await listCharacterDeedOutbox(pool);
  assert.deepEqual(pending.map(r => [r.lifeId,r.killerLifeId,r.deathSequence]), [['a1','b1','1'],['b1','c1','2']]);
  await assert.rejects(() => confirmCharacterDeedDeath(pool, { lifeHash: b.life_hash, deathSequence: '2', ...event(10) }), { code: 'custody_order' });
  await confirmCharacterDeedDeath(pool, { lifeHash: a.life_hash, deathSequence: '1', ...event(9) });
  assert.equal((await confirmCharacterDeedDeath(pool, { lifeHash: a.life_hash, deathSequence: '1', ...event(9) })).duplicate, true);
  await confirmCharacterDeedDeath(pool, { lifeHash: b.life_hash, deathSequence: '2', ...event(10) });
  await recordCharacterDeedEquipment(pool, { tokenId: '77', lifeHash: c.life_hash, ...event(11) });
  const firstAt = (await pool.query("SELECT equipped_at FROM character_deed_equipment WHERE deed_token_id='77'")).rows[0].equipped_at;
  assert.equal((await recordCharacterDeedEquipment(pool, { tokenId: '77', lifeHash: b.life_hash, ...event(8) })).stale, true);
  await recordCharacterDeedEquipment(pool, { tokenId: '77', lifeHash: c.life_hash, ...event(12) });
  assert.equal(+(await pool.query("SELECT equipped_at FROM character_deed_equipment WHERE deed_token_id='77'")).rows[0].equipped_at, +firstAt, 'same-life replay never restarts accrual');
  await requestCharacterDeedExit(pool, 'account-c', { tokenId: '77' });
  await pool.query("UPDATE character_deed_exits SET status='releasing' WHERE life_id='c1' AND deed_token_id='77'");
  await assert.rejects(() => requestCharacterDeedExit(pool, 'account-c', { tokenId: '77' }), {code:'custody_exit_finalizing'});
  await assert.rejects(() => cancelCharacterDeedExit(pool, 'account-c', { tokenId: '77' }), {code:'custody_exit_finalizing'});
  assert.equal((await characterDeedStatus(pool, 'account-c')).exits[0].status, 'releasing');
  await pool.query("UPDATE character_deed_exits SET status='pending' WHERE life_id='c1' AND deed_token_id='77'");
  assert.equal((await cancelCharacterDeedExit(pool, 'account-c', { tokenId: '77' })).cancelled, 1);
  await recordCharacterDeedEquipment(pool, { tokenId: '77', lifeHash: null, ...event(13) });
  assert.equal((await characterDeedStatus(pool, 'account-c')).equipment.length, 0);
  const d = await seed('d1', 'account-d');
  await seed('wrong-heir', 'another-account', 2);
  await pool.query("UPDATE characters SET alive=false WHERE id='d1'");
  await assert.rejects(() => recordCharacterDeedDeath(pool, {victimCharacterId:'d1',heirCharacterId:'wrong-heir'}), {code:'custody_heir'});
  await seed('d2', 'account-d', 2);
  await die('d1', null, 'd2');
  const estate = (await listCharacterDeedOutbox(pool))[0];
  assert.equal(estate.disposition, 'estate_inheritance');
  assert.equal(estate.killerLifeId, null);
  assert.equal(estate.successorLifeId, 'd2', 'exact new heir is the immutable estate successor');
  const early = await resolveCharacterDeedBeneficiary(pool, 'd1');
  assert.equal(early.disposition, 'estate_waiting');
  assert.equal(early.chainReleaseKnown, false);
  const releaseAt = Math.ceil((new Date((await pool.query("SELECT closed_at FROM character_deed_lives WHERE life_id='d1'")).rows[0].closed_at).getTime()
    + CHARACTER_DEED_ESTATE_DELAY_MS + 60_000) / 1000);
  await assert.rejects(() => confirmCharacterDeedDeath(pool, {lifeHash:d.life_hash,deathSequence:'3',...event(15)}), {code:'custody_receipt'});
  await confirmCharacterDeedDeath(pool, {lifeHash:d.life_hash,deathSequence:'3',chainReleaseAt:releaseAt,...event(15)});
  assert.equal((await resolveCharacterDeedBeneficiary(pool,'d1',{now:releaseAt*1000-1})).disposition,'estate_waiting');
  assert.equal((await resolveCharacterDeedBeneficiary(pool,'d1',{now:releaseAt*1000})).lifeId,'d2');
  await die('d2','c1');
  await seed('d3','account-d',3);
  assert.equal((await resolveCharacterDeedBeneficiary(pool,'d1',{now:releaseAt*1000})).lifeId,'c1',
    'heir killed during delay passes inheritance through that historical life, never the new generation');
  assert.equal((await characterDeedStatus(pool,'account-d')).equipment.length,0,'estate time alone never activates physical equipment');
  assert.equal((await pool.query('SELECT next_death_sequence FROM character_deed_state')).rows[0].next_death_sequence,5);

  // Historical holds must resolve generation+1 even after that heir has died and generation+2 exists.
  const legacy = await seed('legacy1','legacy-account',1);
  await pool.query("UPDATE characters SET alive=false WHERE id='legacy1'");
  await pool.query("UPDATE character_deed_lives SET status='dead',death_sequence=5,closure_reason='estate_escrow',closed_at=now() WHERE life_id='legacy1'");
  await pool.query("INSERT INTO character_deed_deaths(life_id,death_sequence,status) VALUES ('legacy1',5,'policy_pending')");
  await pool.query('UPDATE character_deed_state SET next_death_sequence=6 WHERE id=1');
  assert.equal((await backfillCharacterDeedEstates(pool)).blocked[0].reason,'missing_exact_heir');
  await seed('legacy2','legacy-account',2);
  await die('legacy2','c1');
  await seed('legacy3','legacy-account',3);
  assert.equal((await backfillCharacterDeedEstates(pool)).converted,1);
  const linked = (await pool.query("SELECT successor_life_id FROM character_deed_lives WHERE life_id='legacy1'")).rows[0];
  assert.equal(linked.successor_life_id,'legacy2');
  assert.notEqual(linked.successor_life_id,'legacy3');
  assert.equal((await backfillCharacterDeedEstates(pool)).converted,0,'backfill is idempotent');
  assert.equal((await listCharacterDeedOutbox(pool)).find(row=>row.lifeHash===legacy.life_hash).successorLifeId,'legacy2');
  await seed('estate-chain1','estate-chain',1);
  await seed('estate-chain2','estate-chain',2);
  await die('estate-chain1',null,'estate-chain2');
  await seed('estate-chain3','estate-chain',3);
  await die('estate-chain2',null,'estate-chain3');
  const firstRelease = Date.now()+CHARACTER_DEED_ESTATE_DELAY_MS+1000, secondRelease=firstRelease+1000;
  await pool.query('UPDATE character_deed_lives SET chain_release_at=$2 WHERE life_id=$1',['estate-chain1',new Date(firstRelease)]);
  await pool.query('UPDATE character_deed_lives SET chain_release_at=$2 WHERE life_id=$1',['estate-chain2',new Date(secondRelease)]);
  const waitingSecond = await resolveCharacterDeedBeneficiary(pool,'estate-chain1',{now:firstRelease});
  assert.equal(waitingSecond.lifeId,'estate-chain2','mature first estate stops at the next immature estate edge');
  assert.equal(waitingSecond.disposition,'estate_waiting');
  assert.equal((await resolveCharacterDeedBeneficiary(pool,'estate-chain1',{now:secondRelease})).lifeId,'estate-chain3');
  console.log('deedcustody: PASS (life identity, ordered kill/estate successors, exact-generation backfill, estate delay, heir death cascade, finality, exit notice/consent, projection replay)');
} finally { await pool.end(); if (priorEnabled == null) delete process.env.CHARACTER_DEED_CUSTODY_ENABLED; else process.env.CHARACTER_DEED_CUSTODY_ENABLED = priorEnabled; }
