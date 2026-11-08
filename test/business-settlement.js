// Regression coverage for income parity and historical casino ownership settlement.
import assert from 'node:assert/strict';
delete process.env.DATABASE_URL;
process.env.RATE_LIMIT = 'off';
process.env.MOD_KEY = 'business-settlement-test-mod';
process.env.BUSINESS_RAID_P = '0';
process.env.BUSINESS_TAKEOVER_P = '1';
const { buildServer } = await import('./server-fixture.js');
const { casinoRakebackClaim } = await import('../src/casinorakeback.js');
const { takeoverBusiness } = await import('../src/business.js');
const { withTwoCharacters } = await import('../src/game.js');
const { retireResident } = await import('../src/population.js');
const { fire } = await import('../src/social/combat.js');
const app = await buildServer();
const pool = app.pool;
const call = async (method, url, player, body, extraHeaders = {}) => {
  const response = await app.inject({ method, url, payload: body,
    headers: { ...(player ? { authorization: `Bearer ${player.token}` } : {}), ...extraHeaders } });
  assert.equal(response.statusCode, 200, `${method} ${url}: ${response.body}`);
  return response.json();
};
let names = 0;
const player = async () => {
  const { token } = await call('POST', '/v1/auth/guest');
  const p = { token, accountId: app.jwt.verify(token).sub };
  await call('POST', '/v1/character', p, { name: `Settlement ${++names}` });
  p.id = (await call('GET', '/v1/me', p)).character.id;
  await pool.query("UPDATE characters SET respect=100000000,cash=500000000,path='ledger',loc='docks' WHERE id=$1", [p.id]);
  return p;
};
const reset = async () => {
  await pool.query('DELETE FROM businesses');
  await pool.query("UPDATE den_volume SET total=0,profit=1000000000,distributed=0,jackpot=0,rake_index='0',rake_checkpoint_volume=NULL,rake_legacy_owners=0 WHERE id=1");
};
const volume = async (n) => pool.query('UPDATE den_volume SET total=total+$1 WHERE id=1', [n]);
const casino = async (p) => (await call('POST', '/v1/business/casino/buy', p)).id;
const collect = async (p) => (await call('POST', '/v1/business/collect', p)).rakeback || 0;
const tycoon = async (p) => Number((await pool.query('SELECT tycoon_earned FROM account_persistent WHERE account_id=$1', [p.accountId])).rows[0].tycoon_earned);
const cases = [];
try {
  const a = await player(), b = await player(), c = await player();
  // Same earning period, different settlement verbs: cash and persistent progression agree.
  const aFront = (await call('POST', '/v1/business/laundromat/buy', a)).id;
  const bFront = (await call('POST', '/v1/business/laundromat/buy', b)).id;
  await pool.query("UPDATE businesses SET last_collect_at=now()-interval '48 hours',upkeep_at=now()");
  const aTycoon = await tycoon(a), bTycoon = await tycoon(b);
  const normal = await call('POST', '/v1/business/collect', a);
  const upgraded = await call('POST', `/v1/business/${bFront}/upgrade`, b);
  assert.equal(normal.collected, 316800);
  assert.equal(upgraded.collected, normal.collected);
  assert.equal((await tycoon(a)) - aTycoon, normal.collected);
  assert.equal((await tycoon(b)) - bTycoon, normal.collected);
  assert.equal((await pool.query('SELECT scrutiny FROM businesses WHERE id=$1', [aFront])).rows[0].scrutiny,
    (await pool.query('SELECT scrutiny FROM businesses WHERE id=$1', [bFront])).rows[0].scrutiny,
    'path bonus does not create extra operating scrutiny');
  cases.push('Ledger collect/upgrade preserve identical income, Tycoon credit and raw-income scrutiny');

  await reset();
  await casino(a);
  await volume(1000000);
  await casino(b);
  assert.equal(await collect(a), 10000, 'new owner cannot dilute earned solo volume');
  assert.equal(await collect(b), 0, 'new owner cannot claim earlier volume');
  await volume(1000000);
  assert.equal(await collect(a), 5000);
  const aCasino = (await pool.query("SELECT id FROM businesses WHERE character_id=$1 AND kind='casino'", [a.id])).rows[0].id;
  await call('DELETE', `/v1/business/${aCasino}`, a);
  assert.equal(await collect(b), 5000, 'departing owner cannot enlarge the survivor\'s historical split');
  assert.equal(await collect(b), 0, 'retry has no duplicate claim');
  cases.push('arrival preserves solo earnings; shutter preserves shared earnings; duplicate collect pays zero');

  await reset();
  await casino(a); await casino(b); await casino(c);
  let paid = 0;
  for (let i = 0; i < 6; i++) {
    await volume(100);
    paid += await collect(a);
  }
  assert.equal(paid, 2, 'exact thirds survive frequent collection without rounding loss');
  assert.equal(await collect(b), 2); assert.equal(await collect(c), 2);
  cases.push('rational thirds and frequent collection retain fractional entitlements exactly');

  await reset();
  await casino(a);
  await volume(1000000);
  await pool.query('UPDATE den_volume SET profit=0 WHERE id=1');
  assert.equal(await collect(a), 0, 'unfunded entitlement waits');
  await casino(b);
  await pool.query('UPDATE den_volume SET profit=1000000000 WHERE id=1');
  assert.equal(await collect(a), 10000, 'funding delay plus new owners cannot rewrite entitlement');
  cases.push('profit cap defers claims without losing historical entitlement');

  await reset();
  await pool.query("INSERT INTO businesses (id,character_id,kind,rake_cursor) VALUES ('legacy-a',$1,'casino',0),('legacy-b',$2,'casino',500000)", [a.id,b.id]);
  await volume(1000000);
  const cc = await casino(c); // first checkpoint must snapshot TWO legacy owners, before inserting C
  assert.equal(await collect(a), 5000); assert.equal(await collect(b), 2500); assert.equal(await collect(c), 0);
  await call('DELETE', `/v1/business/${cc}`, c);
  cases.push('legacy volume cursors snapshot once before the first new owner');

  await reset();
  const target = await casino(a); await casino(b); await volume(1000000);
  const transferred = await withTwoCharacters(pool, c.accountId, a.id,
    (actor, victim, client, h) => takeoverBusiness(actor, victim, target, client, h), { requireKnown:false });
  assert.equal(transferred.won, true);
  assert.equal(await collect(c), 0, 'takeover forfeits prior owner income, never transfers it');
  assert.equal(await collect(b), 5000, 'other owner keeps its earlier half');
  await volume(1000000);
  assert.equal(await collect(c), 5000); assert.equal(await collect(b), 5000);
  cases.push('hostile takeover starts the new owner at the current index');

  await reset();
  await casino(a); await casino(b); await volume(1000000);
  await call('POST', '/v1/mod/kill', null, { characterId:a.id }, { 'x-mod-key':process.env.MOD_KEY });
  assert.equal(await collect(b), 5000, 'death does not reassign historical share');
  await volume(1000000); assert.equal(await collect(b), 10000);
  cases.push('estate deletion checkpoints the dead owner before survivor-only future earnings');

  await reset();
  const victim = await player(), killer = await player();
  await casino(victim); await casino(b); await volume(1000000);
  await pool.query("UPDATE characters SET respect=1000,muscle=1,loc='docks',safe_until=NULL,hosp_until=NULL,jail_until=NULL WHERE id=$1",[victim.id]);
  await pool.query("UPDATE characters SET gun='lastresort',ammo=1000000,energy=200,shoot_cd_until=NULL WHERE id=$1",[killer.id]);
  await pool.query("INSERT INTO searches (hunter,target,started_at) VALUES ($1,$2,now()-interval '24 hours')",[killer.id,victim.id]);
  const shot = await withTwoCharacters(pool,killer.accountId,victim.id,
    (actor,mark,client,h) => fire(actor,mark,client,h,1000000),{requireKnown:false});
  assert.equal(shot.kill,true);
  assert.equal(shot.empireLoot?.kind,'casino');
  assert.equal(await collect(killer),0,'sacking forfeits old owner history');
  assert.equal(await collect(b),5000,'sacking preserves other owners history');
  await volume(1000000);
  assert.equal(await collect(killer),5000); assert.equal(await collect(b),5000);
  cases.push('player fire-kill sacking resets the seized casino at the historical index');

  await reset();
  // A resident's retirement uses a different deletion path than death.
  const npc = await player();
  await pool.query('UPDATE characters SET is_npc=true WHERE id=$1', [npc.id]);
  await pool.query('UPDATE account_persistent SET npc_flag=true WHERE account_id=$1', [npc.accountId]);
  await casino(npc); await casino(b); await volume(1000000);
  const client = await pool.connect();
  try { await client.query('BEGIN'); await retireResident(client,npc.id); await client.query('COMMIT'); }
  catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  assert.equal(await collect(b),5000);
  cases.push('resident retirement also preserves surviving owners\' historical split');

  // A pure boundary check for a reduced rational cursor and an empty legacy cohort.
  assert.deepEqual(casinoRakebackClaim({ rake_index_cursor:'2/3' }, { index:'8/3',legacyOwners:0 }), { amount:2,paidCursor:'8/3' });
  console.log(JSON.stringify({ passed:true,cases },null,2));
} finally { await app.close(); }
