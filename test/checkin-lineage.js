// A check-in is a once-per-account/day faucet. Death creates a fresh character row, so the claim
// day and streak must follow the account or an heir can immediately replay cash, energy, and the
// lifetime referral counter. This regression exercises both a current account claim and the lazy
// migration bridge for characters that checked in before the account columns existed.
import assert from 'node:assert/strict';

// Default to pg-mem, with an explicit disposable loopback PostgreSQL opt-in for
// row-lock, uniqueness, and check-in/death race verification.
const lineageDatabaseUrl = process.env.CHECKIN_LINEAGE_TEST_DATABASE_URL || '';
if (lineageDatabaseUrl) {
  const endpoint = new URL(lineageDatabaseUrl);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname),
    'Only disposable loopback PostgreSQL is allowed');
  assert(endpoint.port && endpoint.port !== '5432',
    'Use a disposable PostgreSQL server on an explicit nondefault port');
  assert(/^\/checkin_lineage_test(?:_[a-z0-9]+)?$/.test(endpoint.pathname),
    'Use a database named checkin_lineage_test');
}
process.env.DATABASE_URL = lineageDatabaseUrl;
process.env.RATE_LIMIT = 'off';
process.env.JWT_SECRET = 'checkin-lineage-test-secret';
process.env.MOD_KEY = 'checkin-lineage-mod-key';

const realNow = Date.now;
Date.now = () => Date.parse('2026-10-21T12:00:00Z');

const { buildServer } = await import('./server-fixture.js');
const { dayOf } = await import('../src/rules.js');
const { checkinQuoteOf } = await import('../src/game.js');
const app = await buildServer();
const pool = app.pool;
const today = dayOf();

const call = async (method, url, { token, body, mod = false } = {}) => {
  const res = await app.inject({ method, url, payload: body, headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(mod ? { 'x-mod-key': process.env.MOD_KEY } : {}),
  } });
  return { code: res.statusCode, body: res.json() };
};
const create = async (name) => {
  const auth = await call('POST', '/v1/auth/guest');
  assert.equal(auth.code, 200);
  const token = auth.body.token;
  assert.equal((await call('POST', '/v1/character', { token, body: { name } })).code, 200);
  const character = (await call('GET', '/v1/me', { token })).body.character;
  const accountId = (await pool.query('SELECT account_id FROM characters WHERE id=$1', [character.id])).rows[0].account_id;
  return { token, id: character.id, accountId };
};
const kill = async (id) => {
  const result = await call('POST', '/v1/mod/kill', { mod: true, body: { characterId: id, reason: 'lineage-test' } });
  assert.equal(result.code, 200, JSON.stringify(result.body));
  return result.body.heirId;
};
const accountCheckin = async (accountId) => (await pool.query(
  'SELECT checkins_lifetime, checkin_day, checkin_streak FROM account_persistent WHERE account_id=$1',
  [accountId])).rows[0];
const checkinLedgerCount = async (accountId) => Number((await pool.query(
  `SELECT COUNT(*) n FROM transactions t JOIN characters c ON c.id=t.character_id
    WHERE c.account_id=$1 AND t.reason='checkin'`, [accountId])).rows[0].n);
const checkinLatchCount = async (accountId) => Number((await pool.query(
  `SELECT COUNT(*) n FROM account_daily_claims
    WHERE account_id=$1 AND day=$2 AND scope='checkin' AND claim_id='claim'`,
  [accountId, today])).rows[0].n);

try {
  assert.equal(checkinQuoteOf({ respect: 0, checkin_day: 0, streak: 0 },
    { checkin_day: today + 1, checkin_streak: 4 }, today).done, true,
  'a future persisted account day is fail-closed under clock skew');
  const player = await create('Lineage Lock');
  await pool.query('UPDATE characters SET respect=1000, energy=0 WHERE id=$1', [player.id]);
  const quote = (await call('GET', '/v1/me', { token: player.token })).body.character.checkin;
  assert.equal(quote.done, false);
  const claimed = await call('POST', '/v1/checkin', { token: player.token });
  assert.equal(claimed.code, 200, JSON.stringify(claimed.body));
  assert.equal(claimed.body.pay, quote.pay, 'the mutation pays its player-facing quote');
  assert.equal(claimed.body.energyGained, 20);

  let account = await accountCheckin(player.accountId);
  assert.equal(Number(account.checkins_lifetime), 1);
  assert.equal(Number(account.checkin_day), today);
  assert.equal(Number(account.checkin_streak), 1);
  assert.equal(await checkinLedgerCount(player.accountId), 1);
  assert.equal(await checkinLatchCount(player.accountId), 1);

  const firstHeir = await kill(player.id);
  let heirView = (await call('GET', '/v1/me', { token: player.token })).body.character;
  assert.equal(heirView.id, firstHeir);
  assert.equal(heirView.checkin.done, true, 'the heir sees the account claim as already used');
  assert.equal(heirView.streak, 1, 'the account streak follows the bloodline');

  await pool.query('UPDATE characters SET cash=777, energy=0 WHERE id=$1', [firstHeir]);
  const replay = await call('POST', '/v1/checkin', { token: player.token });
  assert.equal(replay.code, 400);
  assert.equal(replay.body.error, 'done');
  let heir = (await pool.query('SELECT cash, energy FROM characters WHERE id=$1', [firstHeir])).rows[0];
  assert.equal(Number(heir.cash), 777, 'replay mints no cash');
  assert.equal(Number(heir.energy), 0, 'replay grants no energy');
  assert.equal(Number((await accountCheckin(player.accountId)).checkins_lifetime), 1,
    'replay cannot accelerate the account referral counter');
  assert.equal(await checkinLedgerCount(player.accountId), 1, 'one account/day produces one faucet row');

  const secondHeir = await kill(firstHeir);
  assert.equal((await call('POST', '/v1/checkin', { token: player.token })).body.error, 'done',
    'repeated same-day succession cannot reopen the claim');
  assert.equal(Number((await accountCheckin(player.accountId)).checkins_lifetime), 1);
  assert.equal(await checkinLedgerCount(player.accountId), 1);
  assert.equal(await checkinLatchCount(player.accountId), 1);
  assert.notEqual(secondHeir, firstHeir);

  // pg-mem deliberately supports local/CI gameplay but does not serialize SELECT FOR UPDATE. The
  // account/day unique latch must therefore be the actual boundary, not an assumption about row
  // locks. Twenty parallel presses yield one success, one ledger credit, and one lifetime advance.
  const concurrent = await create('Parallel Lock');
  await pool.query('UPDATE characters SET respect=1000, energy=0 WHERE id=$1', [concurrent.id]);
  const burst = await Promise.all(Array.from({ length: 20 }, () =>
    call('POST', '/v1/checkin', { token: concurrent.token })));
  assert.equal(burst.filter((r) => r.code === 200).length, 1, 'only one parallel check-in is paid');
  assert.equal(burst.filter((r) => r.body.error === 'done').length, 19);
  assert.equal(await checkinLedgerCount(concurrent.accountId), 1);
  assert.equal(await checkinLatchCount(concurrent.accountId), 1);
  assert.equal(Number((await accountCheckin(concurrent.accountId)).checkins_lifetime), 1);

  // Exercise both possible orderings of death and claim. Whether the request lands on the old
  // street or its heir, the account/day right remains singular and the next heir press is refused.
  for (let i = 0; i < 8; i++) {
    const racing = await create(`Race Lock ${i}`);
    await pool.query('UPDATE characters SET respect=1000, energy=0 WHERE id=$1', [racing.id]);
    const pair = await Promise.all([
      call('POST', '/v1/checkin', { token: racing.token }),
      call('POST', '/v1/mod/kill', { mod: true, body: { characterId: racing.id, reason: 'race-test' } }),
    ]);
    assert.equal(pair[1].code, 200, JSON.stringify(pair[1].body));
    const retry = await call('POST', '/v1/checkin', { token: racing.token });
    const paid = pair.filter((r) => r.code === 200 && r.body?.pay != null).length
      + (retry.code === 200 ? 1 : 0);
    assert.equal(paid, 1, `death/check-in race ${i} pays exactly once`);
    assert.equal(await checkinLedgerCount(racing.accountId), 1);
    assert.equal(await checkinLatchCount(racing.accountId), 1);
    assert.equal(Number((await accountCheckin(racing.accountId)).checkins_lifetime), 1);
  }

  // Existing installations begin with account checkin_day=0. Estate sync must preserve the living
  // character's legacy claim if death happens before that player next touches /v1/checkin.
  const legacy = await create('Legacy Lock');
  await pool.query('UPDATE characters SET checkin_day=$2, streak=6 WHERE id=$1', [legacy.id, today]);
  assert.equal(Number((await accountCheckin(legacy.accountId)).checkin_day), 0);
  const legacyHeir = await kill(legacy.id);
  account = await accountCheckin(legacy.accountId);
  assert.equal(Number(account.checkin_day), today);
  assert.equal(Number(account.checkin_streak), 6);
  heirView = (await call('GET', '/v1/me', { token: legacy.token })).body.character;
  assert.equal(heirView.id, legacyHeir);
  assert.equal(heirView.checkin.done, true);
  assert.equal(heirView.streak, 6);
  assert.equal((await call('POST', '/v1/checkin', { token: legacy.token })).body.error, 'done');
  assert.equal(Number((await accountCheckin(legacy.accountId)).checkins_lifetime), 0,
    'legacy synchronization does not fabricate lifetime claims');

  console.log('✅ Check-in lineage regression passed — account/day uniqueness survives parallel presses and death races; cash, energy, streak, ledger, and referral lifetime cannot replay through heirs; legacy character claims sync at death');
} finally {
  Date.now = realNow;
  await app.close();
}
