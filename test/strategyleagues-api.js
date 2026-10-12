import assert from 'node:assert/strict';

const native = process.argv.includes('--postgres');
if (native) {
  const url = new URL(process.env.STRATEGY_LEAGUE_API_TEST_DATABASE_URL || 'http://missing');
  assert(url.protocol === 'postgresql:' && url.hostname === '127.0.0.1'
    && /^\/strategy_league_api_[a-z0-9_]+$/.test(url.pathname) && !url.search && !url.hash
    && ((url.port === '35439' && url.username === 'pilot_runner' && !url.password)
      || (url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck')),
  'Use an empty isolated local strategy_league_api_ PostgreSQL database');
  const { default: pg } = await import('pg');
  const preflight = new pg.Pool({ connectionString: url.href });
  try { assert.equal((await preflight.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0); }
  finally { await preflight.end(); }
  process.env.DATABASE_URL = url.href; process.env.MARKET_SEED = 'strategy-league-api-local-test-seed';
} else assert(!process.env.DATABASE_URL, 'Memory proof refuses ambient DATABASE_URL');
process.env.RATE_LIMIT = 'off'; process.env.SOCIAL_VERIFY_MODE = 'off'; process.env.DEPOT_PILOT = 'on';
process.env.RESOURCE_ECONOMY = 'off'; process.env.JWT_SECRET = 'strategy-league-api-local-test-secret';
process.env.MOD_KEY = 'strategy-league-api-local-test-mod';
// Execution awaits the coordinator's finalized module commit. Fixture source
// never supplies private strategy rules, outcomes or target clocks to league APIs.
const { buildServer } = await import('../src/server.js');
const { ledger } = await import('../src/game.js');
const { priceBlock } = await import('../src/rules.js');
const app = await buildServer();
let sequence = 0;
const call = async (method, url, player, body, key = `league-api-${++sequence}`) => {
  const response = await app.inject({ method, url, payload: body,
    headers: { ...(player ? { authorization: `Bearer ${player.token}` } : {}),
      ...(key === null ? {} : { 'idempotency-key': key }) } });
  return { code: response.statusCode, body: response.json() };
};
const player = async () => {
  const ownerToken = (await call('POST', '/v1/auth/guest')).body.token;
  const token = (await call('POST', '/v1/auth/agent-key', { token: ownerToken })).body.token;
  const p = { token, ownerToken };
  assert.equal((await call('POST', '/v1/character', p, { name: `League Player ${++sequence}` })).code, 200);
  const ch = (await call('GET', '/v1/me', p)).body.character;
  p.id = ch.id; p.account = JSON.parse(Buffer.from(ownerToken.split('.')[1], 'base64url').toString()).sub;
  await app.pool.query('UPDATE characters SET cash=10000.5,last_accrued_at=$2 WHERE id=$1', [ch.id, new Date(Date.now()+3600000)]);
  await ledger(app.pool, { characterId: ch.id, currency: 'cash', amount: 10000.5 - Number(ch.cash), reason: 'crime:league-api-fixture' });
  return p;
};
const balance = async p => Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [p.id])).rows[0].cash);
const publish = async p => {
  const result = await call('POST', '/v1/strategies', p, { title: 'League Private Threshold',
    rule: { kind: 'gin_availability_v1', districtId: 'docks', minimumStock: 3, triggerStock: 7 }, feeCash: 50 });
  assert.equal(result.code, 200, JSON.stringify(result)); return result.body.strategy.id;
};
const action = (id, name, player, body = {}, key) => call('POST', `/v1/strategy-leagues/${id}/${name}`, player, body, key);
try {
  // Publish/start reserve a real future five-minute interval in one market block.
  // Near rollover, wait for the actual boundary; never fabricate the server clock.
  while ((priceBlock() + 1) * 14400000 - Date.now() <= 330000) {
    const remaining = (priceBlock() + 1) * 14400000 - Date.now();
    console.log(`Waiting for actual market rollover (${remaining}ms remaining)`);
    await new Promise(resolve => setTimeout(resolve, Math.min(30000, remaining + 100)));
  }
  assert.equal((await call('GET', '/v1/strategy-leagues')).code, 200);
  assert.equal((await call('GET', '/v1/strategy-leagues/own')).code, 401);
  assert.equal((await call('POST', '/v1/strategy-leagues', null, { districtId: 'docks', minimumStock: 3 })).code, 401);
  const creator = await player(), member = await player(), stranger = await player();
  const version = await publish(creator), unrelated = await publish(stranger);
  const body = { districtId: 'docks', minimumStock: 3 };
  for (const extra of ['entryFeeCash','prizeCash','externalAsset','rule','creatorAccountId','targetAt']) {
    const rejected = await call('POST', '/v1/strategy-leagues', creator, { ...body, [extra]: extra === 'prizeCash' ? 100 : 'forged' });
    assert(rejected.code >= 400 && rejected.code < 500);
  }
  assert((await call('POST', '/v1/strategy-leagues', creator, body, null)).code >= 400);
  const created = await call('POST', '/v1/strategy-leagues', { ...creator, token: creator.ownerToken }, body, 'league-create-exact');
  assert.equal(created.code, 200, JSON.stringify(created));
  const id = created.body.league.id;
  assert.deepEqual(await call('POST', '/v1/strategy-leagues', creator, body, 'league-create-exact'), created);
  assert((await call('POST', '/v1/strategy-leagues', creator, { ...body, minimumStock: 4 }, 'league-create-exact')).code >= 400);
  assert((await action(id, 'join', member, { versionId: version })).code >= 400, 'Private rule requires an existing paid license or original publisher consent');
  assert((await action(id, 'join', creator, { versionId: version, accountId: stranger.account })).code >= 400);
  assert((await action(id, 'join', creator, { versionId: version, predictsAvailable: true })).code >= 400);
  const ownJoin = await action(id, 'join', { ...creator, token: creator.ownerToken }, { versionId: version });
  assert.equal(ownJoin.code, 200, JSON.stringify(ownJoin));
  assert((await action(id, 'start', creator)).code >= 400, 'One account cannot start a shared cohort');
  const bought = await call('POST', `/v1/strategies/${version}/buy`, member, {}, 'league-license');
  assert.equal(bought.code, 200, JSON.stringify(bought));
  const beforeCreator = await balance(creator), beforeMember = await balance(member);
  const memberJoin = await action(id, 'join', member, { versionId: version });
  assert.equal(memberJoin.code, 200, JSON.stringify(memberJoin));
  assert.equal(memberJoin.body.league.ownEntry.licenseId, bought.body.license.id);
  assert.equal((await action(id, 'join', member, { versionId: version })).code, 200);
  assert((await action(id, 'join', member, { versionId: unrelated })).code >= 400, 'Original-account entry cannot change version on replay');
  const publicBoard = (await call('GET', '/v1/strategy-leagues')).body.leagues;
  const publicLeague = publicBoard.find(league => league.id === id);
  assert(publicLeague); assert.equal(publicLeague.ownEntry, undefined);
  for (const privateField of ['rule','ruleHash','versionId','licenseId','predictsAvailable'])
    assert(!JSON.stringify(publicBoard).includes(`"${privateField}"`), 'Public standings omit private strategy content');
  const ownBoard = (await call('GET', '/v1/strategy-leagues/own', member)).body.leagues;
  assert.equal(ownBoard.length, 1); assert.equal(ownBoard[0].ownEntry.versionId, version);
  assert.equal(ownBoard[0].ownEntry.rule.triggerStock, 7);
  assert.deepEqual((await call('GET', '/v1/strategy-leagues/own', stranger)).body.leagues, []);
  assert((await action(id, 'start', member)).code >= 400, 'Only original creator account starts');
  assert((await action(id, 'start', creator, { targetAt: new Date().toISOString() })).code >= 400);
  const started = await action(id, 'start', creator);
  assert.equal(started.code, 200, JSON.stringify(started));
  assert.equal(started.body.league.state, 'running');
  assert.equal(Date.parse(started.body.league.targetAt)-Date.parse(started.body.league.observedAt),300000);
  assert.equal(started.body.league.denominators.attempted, 2);
  assert.equal(started.body.league.prizesEnabled, false); assert.equal(started.body.league.entryFeeCash, 0);
  assert.equal(started.body.league.cashRewards, 0); assert.equal(started.body.league.profitVerified, false);
  process.env.DEPOT_PILOT = 'off';
  assert.equal((await action(id, 'start', creator)).code, 200, 'Committed start remains replayable OFF');
  assert.equal((await action(id, 'join', member, { versionId: version })).code, 200, 'Committed private consent replays OFF');
  const pending = await action(id, 'resolve', member);
  assert.equal(pending.code, 200); assert.equal(pending.body.pending, true);
  assert.equal(pending.body.league.state, 'running');
  assert((await action(id, 'resolve', stranger)).code >= 400);
  assert((await action(id, 'resolve', member, { outcome: 'correct' })).code >= 400);
  assert((await action(id, 'join', stranger, { versionId: unrelated })).code >= 400);
  assert.equal(await balance(creator), beforeCreator); assert.equal(await balance(member), beforeMember);
  assert.equal((await app.pool.query("SELECT id FROM transactions WHERE reason LIKE 'league:%'")).rows.length, 0);
  const spec = (await call('GET', '/openapi.json')).body;
  assert(!spec.paths['/v1/strategy-leagues'].get.security?.length);
  assert(spec.paths['/v1/strategy-leagues/own'].get.security.length);
  const { strategyLeagueFaults } = await import('../src/strategyleagueinvariants.js');
  assert.equal(await strategyLeagueFaults(app.pool), 0, 'Actual consent and prospective cohort reconcile');
  const ownEntry = (await app.pool.query('SELECT * FROM strategy_league_entries WHERE league_id=$1 AND account_id=$2', [id, creator.account])).rows[0];
  await app.pool.query('UPDATE strategy_league_entries SET rule_hash=$2 WHERE id=$1', [ownEntry.id, '0'.repeat(64)]);
  assert(await strategyLeagueFaults(app.pool) > 0, 'Changed private immutable hash is detected');
  await app.pool.query('UPDATE strategy_league_entries SET rule_hash=$2 WHERE id=$1', [ownEntry.id, ownEntry.rule_hash]);
  assert.equal(await strategyLeagueFaults(app.pool), 0);
  await app.pool.query('UPDATE strategy_league_entries SET account_id=$2 WHERE id=$1', [ownEntry.id, stranger.account]);
  assert(await strategyLeagueFaults(app.pool) > 0, 'Membership is bound to the original consenting account');
  await app.pool.query('UPDATE strategy_league_entries SET account_id=$2 WHERE id=$1', [ownEntry.id, ownEntry.account_id]);
  assert.equal(await strategyLeagueFaults(app.pool), 0);
  const storedLeague = (await app.pool.query('SELECT * FROM strategy_leagues WHERE id=$1', [id])).rows[0];
  // Deliberate isolated corruption control: a fabricated premature grade must
  // fail reconciliation. This is not a resolution or a simulated clock proof.
  const premature = new Date();
  await app.pool.query("UPDATE strategy_league_entries SET outcome='correct' WHERE league_id=$1", [id]);
  await app.pool.query("UPDATE strategy_leagues SET state='resolved',result_kind='graded',sample=$2,sample_started_at=$3,resolved_at=$3 WHERE id=$1",
    [id, { ...storedLeague.observation, observedAt: premature.toISOString() }, premature]);
  assert(await strategyLeagueFaults(app.pool) > 0, 'A grade before the actual prospective target is rejected');
  await app.pool.query('UPDATE strategy_league_entries SET outcome=NULL WHERE league_id=$1', [id]);
  await app.pool.query("UPDATE strategy_leagues SET state='running',result_kind=NULL,sample=NULL,sample_started_at=NULL,resolved_at=NULL WHERE id=$1", [id]);
  assert.equal(await strategyLeagueFaults(app.pool), 0);
  await app.pool.query("UPDATE strategy_league_entries SET outcome='unknown' WHERE league_id=$1", [id]);
  await app.pool.query("UPDATE strategy_leagues SET state='resolved',result_kind='unknown',resolved_at=$2 WHERE id=$1", [id,new Date(Date.parse(storedLeague.observation.observedAt)+1)]);
  assert(await strategyLeagueFaults(app.pool) > 0, 'An unknown outcome cannot bypass the prospective target');
  await app.pool.query('UPDATE strategy_league_entries SET outcome=NULL WHERE league_id=$1', [id]);
  await app.pool.query("UPDATE strategy_leagues SET state='running',result_kind=NULL,resolved_at=NULL WHERE id=$1", [id]);
  assert.equal(await strategyLeagueFaults(app.pool), 0);
  console.log(`strategy league API ${native ? 'PostgreSQL' : 'memory'} tests passed; actual consent, licenses, privacy and prospective pending recovery; no prize or profit claim`);
} finally { process.env.DEPOT_PILOT = 'on'; await app.close(); }
