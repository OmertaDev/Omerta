// Scoped PostgreSQL escrow proof. Canonical mutators own all post-baseline value.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { addedRows, equation, exactSum, negate, sha256 } from './rc1-resource-journal.js';
import { sourceInventory } from './rc1-qualification.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const development = process.argv.includes('--development');
const terminalFixtures = process.argv.includes('--terminal-fixtures');
const shortField = process.argv.includes('--short-field');
const longTerm = !terminalFixtures && !shortField;
const sourceBytes = () => Object.fromEntries(git('ls-files', '--', 'src', 'content', 'schema.sql', 'package.json', 'package-lock.json',
  'tools/rc1-resource-escrow.js', 'tools/rc1-resource-journal.js', 'tools/rc1-qualification.mjs').split(/\r?\n/).filter(Boolean).sort()
  .map((file) => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const source = { commit: git('rev-parse', 'HEAD'), clean: !git('status', '--porcelain'), hashes: sourceBytes() };
assert(source.clean || development, 'Commit source before a native evidence run');
const pinned = development ? [] : sourceInventory(source.commit).files;
function assertPinned() { for (const file of pinned) assert(file.accepted.includes(crypto.createHash('sha256').update(fs.readFileSync(file.path)).digest('hex')), `Unpinned source: ${file.path}`); }
assertPinned();
assert(process.env.RC1_RESOURCE_DATABASE_URL, 'Explicit isolated PostgreSQL administrative endpoint required');
const endpoint = new URL(process.env.RC1_RESOURCE_DATABASE_URL);
assert(['postgres:', 'postgresql:'].includes(endpoint.protocol) && ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname));
const runId = `resource-escrow-${source.commit.slice(0, 12)}-${crypto.randomBytes(5).toString('hex')}`;
const output = path.resolve(process.env.RC1_RESOURCE_OUTPUT || path.join(os.tmpdir(), 'omerta-rc1-resource-proof', runId));
assert(!fs.existsSync(path.join(output, 'result.json')), 'Never overwrite evidence'); fs.mkdirSync(output, { recursive: true });
const report = { schemaVersion: 1, runId, source, owner: 'Codex/resource_proof', gate: 'C02-ESCROW-DISPOSITIONS', outcome: 'FAIL',
  gateStatus: 'OPEN_REQUIRED_PROOF', evidenceClass: development ? 'DEVELOPMENT_DIAGNOSTIC' : 'NATIVE_FIXTURE_ASSISTED',
  startedAt: new Date().toISOString(), invocation: { command: 'node tools/rc1-resource-escrow.js', arguments: process.argv.slice(2), node: process.version, platform: process.platform },
  configuration: { terminalFixtures, shortField, longTerm, clocks: 'Unmodified application and PostgreSQL wall clocks', chain: 'unconfigured',
    timerMode: terminalFixtures ? 'Initial empty poker, GP and Stakes fixtures with 60-second deadlines' : 'Initial empty poker fixture with 60-second deadline; canonically materialized original 30-minute GP and Stakes',
    operatorConfiguration: 'Local fixture flags only; installed dependencies and deployed integrations are not attested; preflight remains enforced' },
  exclusions: ['Natural account progression and fixture vehicle acquisition', 'Poker original 24-hour lifetime and bracket format',
    'Natural combat-earned death; canonical estate runs with explicit terminal loot/nonloot modes', 'Loan open-offer 48-hour expiry and 24-hour collateral grace',
    'Full native resource simulation and deployment attestation', 'Crash/backup restore; only server reopening is tested',
    'Other market goods, casino, racing and animal-stakes variants outside the exact recorded branches'], scenarios: [] };
if (terminalFixtures) report.exclusions.push('Original GP and Stakes lifetimes');
if (!longTerm) report.exclusions.push('Original market one-hour expiry and loan one-hour collection');
const save = () => fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n'); save();
const database = `rc1_escrow_${crypto.randomBytes(8).toString('hex')}`, admin = new Pool({ connectionString: endpoint.toString() });
let app, baselineChecks, ordinal = 0;
const actors = {}, requests = [], entries = {}, events = {};
const character = (role) => `escrow-proof-${role}-character`, account = (role) => `escrow-proof-${role}-account`;
const car = (role) => `escrow-proof-${role}-car`, commandKey = (name) => `rc1-escrow-${name}`;
const eventTypes = { poker: { table: 'poker_tournaments', state: 'poker_state', entryTable: 'poker_entries', entryKey: 'tournament_id', reason: 'casino:tourney', route: '/v1/casino/tournament', body: () => ({}) },
  gp: { table: 'grand_prix', state: 'grand_prix_state', entryTable: 'grand_prix_entries', entryKey: 'gp_id', reason: 'race:gp', route: '/v1/races/gp', body: (role) => ({ car: car(role) }) },
  stakes: { table: 'stakes_races', state: 'stakes_state', entryTable: 'stakes_entries', entryKey: 'race_id', reason: 'stable:stakes', route: (role) => `/v1/stable/stakes/${actors[role].racer}`, body: () => ({}) } };
const queries = {
  characters: 'SELECT id,account_id,cash::text,bank::text,ammo,cb,alive FROM characters ORDER BY id',
  accounts: 'SELECT account_id,omr::text,staked::text,rewards::text,unbonding::text FROM account_persistent ORDER BY account_id',
  transactions: 'SELECT id,character_id,account_id,currency,amount::text,reason,counterparty FROM transactions ORDER BY id',
  desk: 'SELECT id,balance::text,lifetime_in::text FROM desk_inventory ORDER BY id',
  streetTax: 'SELECT id,pool::text FROM street_tax ORDER BY id', loanHouse: 'SELECT id,pool::text FROM loan_house ORDER BY id',
  market: 'SELECT * FROM market_listings ORDER BY id', loans: 'SELECT * FROM loans ORDER BY id',
  cars: 'SELECT * FROM cars ORDER BY id', racers: 'SELECT * FROM racers ORDER BY id',
};
for (const [type, spec] of Object.entries(eventTypes)) {
  queries[type] = `SELECT * FROM ${spec.table} ORDER BY id`;
  queries[`${type}Entries`] = `SELECT * FROM ${spec.entryTable} ORDER BY ${spec.entryKey},character_id`;
  queries[`${type}State`] = `SELECT * FROM ${spec.state} ORDER BY id`;
}
async function snapshot() {
  const client = await app.pool.connect();
  try { await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); const state = {};
    for (const [key, sql] of Object.entries(queries)) state[key] = (await client.query(sql)).rows;
    state.clock = (await client.query('SELECT clock_timestamp() AS now, pg_current_snapshot()::text AS snapshot')).rows[0];
    await client.query('COMMIT'); return state;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
const stable = ({ clock, ...state }) => state;
const unchanged = ({ before, after }) => assert.deepEqual(stable(after), stable(before), 'Replay/refusal/abort changed authoritative state');
const marketHeld = (state) => exactSum(state.market.filter((r) => r.status === 'live').map((r) => r.kind === 'order' ? String(BigInt(r.qty) * BigInt(r.price)) : r.bidder ? r.bid : 0));
const loanHeld = (state) => exactSum(state.loans.filter((r) => r.status === 'open').map((r) => r.principal));
const pledgeHeld = (state) => exactSum(state.loans.filter((r) => r.status === 'active').map((r) => r.collateral_omr));
const eventHeld = (state, type) => exactSum(state[type].filter((r) => r.status === 'open').map((r) => r.pool));
const cashHeld = (state) => exactSum([...state.characters.flatMap((r) => [r.cash, r.bank]), marketHeld(state), loanHeld(state),
  ...Object.keys(eventTypes).map((type) => eventHeld(state, type)), state.streetTax[0].pool, state.loanHouse[0].pool]);
async function invariants() {
  const { runLedgerInvariants } = await import('../src/invariants.js'); const result = await runLedgerInvariants(app.pool, { alert: false });
  baselineChecks ??= result.checks; assert.equal(result.checks.length, baselineChecks.length);
  for (const check of result.checks) { const initial = baselineChecks.find((row) => row.name === check.name); assert(initial);
    if (!initial.ok) assert(['character cash', '$OMR conservation', 'car conservation'].includes(initial.name), `Unexpected fixture drift: ${initial.name}`);
    assert.equal(exactSum([check.drift]), exactSum([initial.drift]), `Canonical invariant changed: ${check.name}`);
  }
  return result.checks.map((row) => ({ name: row.name, drift: row.drift, ok: row.ok, fixtureAdjustedPass: true }));
}
function reconcile(before, after) {
  const receipts = addedRows(before.transactions, after.transactions), equations = [];
  const authority = (rows) => rows.length ? rows.map((r) => ({ table: 'transactions', id: r.id, reason: r.reason })) : [{ rule: 'No receipt; custody unchanged' }];
  const sum = (rows, ...reasons) => exactSum(rows.filter((r) => reasons.includes(r.reason)).map((r) => r.amount));
  const cash = receipts.filter((r) => r.currency === 'cash');
  const personalBurns = ['market:list', 'stable:buy', 'death:estate'];
  const personalTransfers = ['market:bid', 'market:order', 'market:refund', 'market:sale', 'market:fill', 'loan:offer', 'loan:take', 'loan:refund', 'loan:repay', 'loan:paper', 'loan:collect', 'whack:loot',
    ...Object.values(eventTypes).flatMap((s) => ['buyin', 'refund', 'win'].map((suffix) => `${s.reason}:${suffix}`))];
  let bornCash = '0';
  for (const ch of after.characters) for (const resource of ['cash', 'ammo', 'cb']) {
    const prior = before.characters.find((r) => r.id === ch.id), rows = receipts.filter((r) => r.character_id === ch.id && r.currency === resource);
    const burns = rows.filter((r) => personalBurns.includes(r.reason)), creates = rows.filter((r) => r.reason === 'death:legacy');
    const transfers = rows.filter((r) => personalTransfers.includes(r.reason));
    assert.equal(rows.length, burns.length + creates.length + transfers.length, `Unclassified ${resource} movement`);
    const born = prior ? 0 : resource === 'cash' ? 500 : resource === 'ammo' ? 25 : 0;
    if (resource === 'cash') bornCash = exactSum([bornCash, born]);
    equations.push(equation({ resource, owner: ch.id, before: prior ? resource === 'cash' ? exactSum([prior.cash, prior.bank]) : prior[resource] : 0,
      after: resource === 'cash' ? exactSum([ch.cash, ch.bank]) : ch[resource], created: exactSum([born, ...creates.map((r) => r.amount)]),
      destroyed: negate(exactSum(burns.map((r) => r.amount))), transferredIn: exactSum(transfers.filter((r) => !String(r.amount).startsWith('-')).map((r) => r.amount)),
      transferredOut: negate(exactSum(transfers.filter((r) => String(r.amount).startsWith('-')).map((r) => r.amount))),
      authority: [...authority(rows), ...(!prior ? [{ rule: 'Canonical runEstate heir base cash500/ammo25; legacy has its own receipt' }] : [])] }));
  }
  for (const acct of after.accounts) {
    const prior = before.accounts.find((r) => r.account_id === acct.account_id); assert(prior);
    const rows = receipts.filter((r) => r.account_id === acct.account_id && r.currency === 'omr');
    assert(rows.every((r) => ['loan:pledge', 'loan:pledge:return', 'loan:seize:omr', 'loan:pledge:loot', 'death:duty'].includes(r.reason)));
    equations.push(equation({ resource: 'omr', owner: acct.account_id, before: exactSum([prior.omr, prior.staked, prior.unbonding, prior.rewards]),
      after: exactSum([acct.omr, acct.staked, acct.unbonding, acct.rewards]), transferredIn: exactSum(rows.filter((r) => !String(r.amount).startsWith('-')).map((r) => r.amount)),
      transferredOut: negate(exactSum(rows.filter((r) => String(r.amount).startsWith('-')).map((r) => r.amount))), authority: authority(rows) }));
  }
  const omr = receipts.filter((r) => r.currency === 'omr');
  equations.push(equation({ resource: 'omr', owner: 'loan-pledge-escrow', before: pledgeHeld(before), after: pledgeHeld(after),
    transferredIn: negate(sum(omr, 'loan:pledge')), transferredOut: sum(omr, 'loan:pledge:return', 'loan:seize:omr', 'loan:pledge:loot'), authority: authority(omr) }));
  equations.push(equation({ resource: 'omr', owner: 'desk_inventory', before: before.desk[0].balance, after: after.desk[0].balance,
    transferredIn: sum(omr, 'desk:recycle'), authority: authority(omr.filter((r) => r.reason === 'desk:recycle')) }));
  const halves = (rows) => exactSum(rows.map((r) => String((-BigInt(r.amount)) / 2n)));
  const marketTake = cash.filter((r) => r.reason === 'market:take'), marketTax = halves(marketTake);
  equations.push(equation({ resource: 'cash', owner: 'market-escrow', before: marketHeld(before), after: marketHeld(after),
    transferredIn: negate(sum(cash, 'market:bid', 'market:order')), transferredOut: exactSum([sum(cash, 'market:refund', 'market:sale', 'market:fill'), negate(sum(cash, 'market:loot')), marketTax]),
    destroyed: exactSum([negate(sum(cash, 'market:death', 'market:take')), negate(marketTax)]), authority: authority(cash.filter((r) => r.reason.startsWith('market:'))) }));
  equations.push(equation({ resource: 'cash', owner: 'loan-offer-escrow', before: loanHeld(before), after: loanHeld(after),
    transferredIn: negate(sum(cash, 'loan:offer')), transferredOut: exactSum([sum(cash, 'loan:take', 'loan:refund'), negate(sum(cash, 'loan:loot'))]),
    destroyed: negate(sum(cash, 'loan:death')), authority: authority(cash.filter((r) => r.reason.startsWith('loan:'))) }));
  const takes = [...marketTake];
  for (const [type, spec] of Object.entries(eventTypes)) {
    const rows = cash.filter((r) => r.reason.startsWith(`${spec.reason}:`)), fee = rows.filter((r) => r.reason === `${spec.reason}:take`), tax = halves(fee); takes.push(...fee);
    equations.push(equation({ resource: 'cash', owner: `${type}-escrow`, before: eventHeld(before, type), after: eventHeld(after, type),
      transferredIn: negate(sum(rows, `${spec.reason}:buyin`)), transferredOut: exactSum([sum(rows, `${spec.reason}:win`, `${spec.reason}:refund`), tax]),
      destroyed: exactSum([negate(sum(rows, `${spec.reason}:take`, `${spec.reason}:death`)), negate(tax)]), authority: authority(rows) }));
  }
  const nullCash = cash.filter((r) => !r.character_id);
  const taxes = exactSum([halves(takes), negate(sum(nullCash, 'loan:paper', 'loan:vig'))]);
  equations.push(equation({ resource: 'cash', owner: 'street_tax', before: before.streetTax[0].pool, after: after.streetTax[0].pool,
    transferredIn: taxes, authority: authority(nullCash) }));
  equations.push(equation({ resource: 'cash', owner: 'loan_house', before: before.loanHouse[0].pool, after: after.loanHouse[0].pool,
    transferredIn: sum(cash, 'loan:house:vig'), authority: authority(nullCash) }));
  const burned = exactSum([negate(sum(cash, ...personalBurns, 'market:death', 'loan:death', ...Object.values(eventTypes).map((s) => `${s.reason}:death`))),
    negate(exactSum(takes.map((r) => r.amount))), negate(halves(takes))]);
  equations.push(equation({ resource: 'cash', owner: 'all-observed-cash-custody', before: cashHeld(before), after: cashHeld(after),
    created: exactSum([bornCash, sum(cash, 'death:legacy')]), destroyed: burned, authority: [...authority(receipts), { rule: 'Paired transfers cancel globally; heir defaults are canonical creation' }] }));
  return { receipts, equations };
}
async function observe(name, action, validate = () => {}) {
  const before = await snapshot(), requestStart = requests.length; let after, result, journal;
  try { result = await action(); after = await snapshot(); journal = reconcile(before, after);
    await validate({ before, after, result, ...journal }); const checks = await invariants();
    const entry = { name, outcome: 'PASS', beforeHash: sha256(stable(before)), afterHash: sha256(stable(after)), boundaries: [before.clock, after.clock], requests: requests.slice(requestStart), ...journal, canonicalInvariants: checks };
    fs.appendFileSync(path.join(output, 'movements.ndjson'), JSON.stringify(entry) + '\n'); report.scenarios.push({ name, outcome: 'PASS', journalHash: sha256(entry), equations: journal.equations.length }); save(); return result;
  } catch (error) { let snapshotError; if (!after) try { after = await snapshot(); } catch (failure) { snapshotError = failure.message; }
    fs.writeFileSync(path.join(output, 'first-failed-boundary.json'), JSON.stringify({ name, before, after, result, journal, requests: requests.slice(requestStart), snapshotError, error: { code: error.code, message: error.message, stack: error.stack } }, null, 2) + '\n');
    report.scenarios.push({ name, outcome: 'FAIL' }); save(); throw error;
  }
}
async function call(role, url, key, body, expected = [200]) {
  const order = ++ordinal, response = await app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${actors[role].token}`, 'idempotency-key': commandKey(key) }, payload: body });
  const result = { status: response.statusCode, body: response.json(), replayed: response.headers['x-idempotent-replay'] === 'true' };
  requests.push({ order, completedOrder: requests.length + 1, role, url, key: commandKey(key), body, ...result });
  assert(expected.includes(result.status), `${url}: ${result.status} ${JSON.stringify(result.body)}`); return result;
}
const act = (name, role, url, body, validate) => observe(name, () => call(role, url, name, body), validate);
async function replay(name, role, url, key, body, prior) { return observe(name, async () => { const result = await call(role, url, key, body); assert(result.replayed); assert.deepEqual(result.body, prior.body); return result; }, unchanged); }
async function ledgerFailure(reason, currency = null) {
  assert(/^[a-z:]+$/.test(reason)); assert(currency === null || ['omr', 'cash', 'ammo'].includes(currency));
  await app.pool.query(`CREATE FUNCTION rc1_escrow_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason='${reason}' ${currency ? `AND NEW.currency='${currency}'` : ''} THEN RAISE EXCEPTION 'rc1 deliberate escrow failure'; END IF; RETURN NEW; END $$`);
  await app.pool.query('CREATE TRIGGER rc1_escrow_fail BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION rc1_escrow_fail()');
}
async function removeFailure() { await app.pool.query('DROP TRIGGER rc1_escrow_fail ON transactions'); await app.pool.query('DROP FUNCTION rc1_escrow_fail()'); }
async function rollbackCall(name, reason, role, url, key, body, currency = null) {
  await ledgerFailure(reason, currency); try { await observe(name, () => call(role, url, key, body, [500]), unchanged); } finally { await removeFailure(); }
}
async function waitUntil(deadline, stage) {
  while (Date.now() <= deadline) { console.log(JSON.stringify({ runId, stage, secondsRemaining: Math.ceil((deadline - Date.now()) / 1000) })); await new Promise((resolve) => setTimeout(resolve, Math.min(20000, deadline - Date.now() + 25))); }
  assert(new Date((await app.pool.query('SELECT clock_timestamp() AS now')).rows[0].now).getTime() >= deadline, 'Database deadline has not elapsed');
}
async function resolveEvent(type) {
  const { resolveTournament } = await import('../src/casino.js'), { resolveGrandPrix } = await import('../src/races.js'), { resolveStakes } = await import('../src/stable.js');
  const resolve = { poker: resolveTournament, gp: resolveGrandPrix, stakes: resolveStakes }[type], client = await app.pool.connect();
  try { await client.query('BEGIN'); const row = (await client.query(`SELECT resolves_at FROM ${eventTypes[type].table} WHERE id=$1`, [events[type]])).rows[0];
    assert(new Date(row.resolves_at) <= new Date(), 'No early direct resolver calls'); assert(new Date((await client.query('SELECT clock_timestamp() AS now')).rows[0].now) >= new Date(row.resolves_at));
    const result = await resolve(client, events[type]); await client.query('COMMIT'); return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
async function sweepEvent(type) {
  const { sweepTournaments } = await import('../src/casino.js'), { sweepGrandPrix } = await import('../src/races.js'), { sweepStakes } = await import('../src/stable.js');
  return { poker: sweepTournaments, gp: sweepGrandPrix, stakes: sweepStakes }[type](app.pool);
}

try {
  await admin.query(`CREATE DATABASE ${database}`); endpoint.pathname = `/${database}`; process.env.DATABASE_URL = endpoint.toString();
  process.env.JWT_SECRET = `rc1-escrow-${crypto.randomBytes(32).toString('hex')}`; process.env.MOD_KEY = `rc1-escrow-${crypto.randomBytes(32).toString('hex')}`;
  Object.assign(process.env, { MARKET_SEED: 'rc1-escrow-proof-fixed-market-fixture-v1', SOCIAL_VERIFY_MODE: 'off', RATE_LIMIT: 'off', INVITE_MODE: 'off' });
  for (const name of ['CHAIN_RPC_URL', 'CHAIN_SIGNER_PK', 'REDIS_URL', 'INVARIANT_WEBHOOK_URL', 'CITY_WIRE_WEBHOOK_URL']) delete process.env[name];
  const { buildServer } = await import('../src/server.js'), { CASINO, RACES, STABLE, M3, seasonModOf } = await import('../src/rules.js');
  const { withTwoCharacters } = await import('../src/game.js'), { runEstate } = await import('../src/social/estate.js');
  const { sweepMarket } = await import('../src/market.js'); app = await buildServer();
  report.database = { name: database, version: (await app.pool.query('SELECT version() AS version')).rows[0].version };
  report.productionTimers = { pokerMs: CASINO.TOURNEY.REGISTER_MS, gpMs: RACES.GP.REGISTER_MS, stakesMs: STABLE.STAKES.REGISTER_MS };
  for (const role of ['seller', 'buyer', 'rival', 'killer', 'victim', 'nonloot', 'default']) {
    await app.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [account(role)]);
    await app.pool.query('INSERT INTO account_persistent(account_id,omr) VALUES($1,2000)', [account(role)]);
    await app.pool.query("INSERT INTO characters(id,account_id,name,season,loc,respect,cash,speed) VALUES($1,$2,$1,1,'neon',10000,1000000,20)", [character(role), account(role)]);
    await app.pool.query("INSERT INTO cars(id,character_id,model_id,trim_id) VALUES($1,$2,'junker','stock')", [car(role), character(role)]);
    actors[role] = { token: app.jwt.sign({ sub: account(role), tv: 0 }) };
  }
  for (const suffix of ['reserve', 'expiry', 'reserve-expiry']) await app.pool.query("INSERT INTO cars(id,character_id,model_id,trim_id) VALUES($1,$2,'junker','stock')", [car(suffix), character('seller')]);
  const fixtureDeadline = new Date(Date.now() + 60000);
  for (const [type, spec] of Object.entries(eventTypes)) if (terminalFixtures || type === 'poker') {
    const id = `escrow-proof-empty-${type}`;
    await app.pool.query(`INSERT INTO ${spec.table}(id,status,resolves_at,pool) VALUES($1,'open',$2,0)`, [id, fixtureDeadline]);
    await app.pool.query(`UPDATE ${spec.state} SET current=$1 WHERE id=1`, [id]);
  }
  report.fixtureGrants = { accounts: 7, cashPerCharacter: '1000000', omrPerAccount: '2000', respectPerCharacter: 10000, location: 'neon', cars: 10,
    emptyEventFixtures: terminalFixtures ? ['poker', 'gp', 'stakes'] : ['poker'], initialEventPools: '0', racers: 'Acquired canonically after baseline' };
  fs.writeFileSync(path.join(output, 'initial-state.json'), JSON.stringify(await snapshot(), null, 2) + '\n'); await invariants();
  for (const role of shortField ? ['buyer'] : ['buyer', 'rival', 'killer', 'victim']) {
    const purchase = await act(`stakes:acquire-racer:${role}`, role, '/v1/stable/buy', { kind: 'dog', name: `Proof ${role}` }); actors[role].racer = purchase.body.id;
    for (const [type, spec] of Object.entries(eventTypes)) {
      const url = typeof spec.route === 'function' ? spec.route(role) : spec.route, body = spec.body(role), name = `${type}:entry${role === 'buyer' ? '-concurrent' : ''}:${role}`;
      const entry = role === 'buyer' ? (await observe(name, () => Promise.all([call(role, url, name, body, [200, 409]), call(role, url, name, body, [200, 409])]),
        ({ result, receipts }) => { assert(result.some((r) => r.status === 200)); assert.equal(receipts.filter((r) => r.reason === `${spec.reason}:buyin`).length, 1); })).find((r) => r.status === 200)
        : await act(name, role, url, body);
      entries[`${type}:${role}`] = { url, body, key: name, entry };
      events[type] = entry.body.tournament || entry.body.grandPrix || entry.body.stakes;
    }
  }
  for (const type of Object.keys(eventTypes)) {
    const entry = entries[`${type}:buyer`]; await replay(`${type}:entry-exact-replay`, 'buyer', entry.url, entry.key, entry.body, entry.entry);
    await observe(`${type}:entry-new-key-denied`, () => call('buyer', entry.url, `${type}-new-entry`, entry.body, [400]), unchanged);
  }
  let marketExpiry, reserveExpiry, orderExpiry, defaultLoan;
  if (longTerm) {
    marketExpiry = (await act('market:original-expiry-list', 'seller', '/v1/market', { carId: car('expiry'), minBid: 5000, hours: 1 })).body.id;
    await act('market:original-expiry-bid', 'buyer', `/v1/market/${marketExpiry}/bid`, { amount: 5000 });
    reserveExpiry = (await act('market:original-reserve-expiry-list', 'seller', '/v1/market', { carId: car('reserve-expiry'), minBid: 5000, reserve: 20000, hours: 1 })).body.id;
    await act('market:original-reserve-expiry-bid', 'rival', `/v1/market/${reserveExpiry}/bid`, { amount: 5000 });
    orderExpiry = (await act('market:original-order-expiry-post', 'default', '/v1/market/order', { goodId: 'gin', qty: 10, price: 500, hours: 1 })).body.id;
    defaultLoan = (await act('loan:original-default-offer', 'killer', '/v1/loans', { amount: 10000, rate: 0.1, hours: 1, collateral: 1, collateralOmr: 200, to: character('default') })).body.id;
    await act('loan:original-default-take', 'default', `/v1/loans/${defaultLoan}/take`, { carId: car('default') });
    await observe('loan:early-collect-denied', () => call('killer', `/v1/loans/${defaultLoan}/collect`, 'early-collect', undefined, [400]), unchanged);
  }
  // Complete immediate market sale/refund and loan-paper branches before the real clocks mature.
  const listed = await act('market:car-list', 'seller', '/v1/market', { carId: car('seller'), minBid: 1000, buyNow: 20000, hours: 1 });
  const listing = listed.body.id;
  await act('market:first-bid', 'rival', `/v1/market/${listing}/bid`, { amount: 5000 });
  await act('market:outbid-refund', 'buyer', `/v1/market/${listing}/bid`, { amount: 6000 }, ({ receipts }) => assert(receipts.some((r) => r.reason === 'market:refund' && r.amount === '5000')));
  await rollbackCall('market:sale-take-rollback', 'market:take', 'buyer', `/v1/market/${listing}/buy`, 'market-sale', undefined);
  const sale = await observe('market:concurrent-buy-now', () => Promise.all([call('buyer', `/v1/market/${listing}/buy`, 'market-sale', undefined, [200, 409]), call('buyer', `/v1/market/${listing}/buy`, 'market-sale', undefined, [200, 409])]),
    ({ after, result, receipts }) => { assert(result.some((r) => r.status === 200)); assert.equal(after.cars.find((r) => r.id === car('seller')).character_id, character('buyer')); assert.equal(receipts.filter((r) => r.reason === 'market:sale').length, 1); });
  await replay('market:sale-exact-replay', 'buyer', `/v1/market/${listing}/buy`, 'market-sale', undefined, sale.find((r) => r.status === 200));
  const reserved = (await act('market:reserve-list', 'seller', '/v1/market', { carId: car('reserve'), minBid: 1000, reserve: 20000, hours: 1 })).body.id;
  await act('market:under-reserve-bid', 'rival', `/v1/market/${reserved}/bid`, { amount: 3000 });
  await rollbackCall('market:reserve-refund-rollback', 'market:refund', 'seller', `/v1/market/${reserved}/cancel`, 'reserve-cancel', undefined);
  const reserveCancel = await observe('market:reserve-cancel-refund', () => call('seller', `/v1/market/${reserved}/cancel`, 'reserve-cancel'), ({ receipts }) => assert(receipts.some((r) => r.reason === 'market:refund' && r.amount === '3000')));
  await replay('market:reserve-cancel-replay', 'seller', `/v1/market/${reserved}/cancel`, 'reserve-cancel', undefined, reserveCancel);
  const order = (await act('market:order-post', 'rival', '/v1/market/order', { goodId: 'gin', qty: 20, price: 500 })).body.id;
  await act('market:order-cancel-refund', 'rival', `/v1/market/${order}/cancel`, undefined, ({ result }) => assert.equal(result.body.refunded, 10000));
  const loan = (await act('loan:paper-offer', 'seller', '/v1/loans', { amount: 20000, rate: 0.1, hours: 1, collateralOmr: 200, to: character('buyer') })).body.id;
  await act('loan:paper-take', 'buyer', `/v1/loans/${loan}/take`);
  await act('loan:paper-list', 'seller', `/v1/loans/${loan}/sell`, { price: 19000 });
  await observe('loan:borrower-paper-denied', () => call('buyer', `/v1/loans/${loan}/buy`, 'own-paper', undefined, [400]), unchanged);
  await rollbackCall('loan:paper-ledger-rollback', 'loan:paper', 'killer', `/v1/loans/${loan}/buy`, 'paper-buy', undefined);
  const paper = await observe('loan:paper-concurrent-purchase', () => Promise.all([call('killer', `/v1/loans/${loan}/buy`, 'paper-buy', undefined, [200, 409]), call('killer', `/v1/loans/${loan}/buy`, 'paper-buy', undefined, [200, 409])]),
    ({ after, receipts, result }) => { assert(result.some((r) => r.status === 200)); assert.equal(after.loans.find((r) => r.id === loan).lender_character, character('killer')); assert.equal(receipts.filter((r) => r.reason === 'loan:paper').length, 3); });
  await replay('loan:paper-exact-replay', 'killer', `/v1/loans/${loan}/buy`, 'paper-buy', undefined, paper.find((r) => r.status === 200));
  await act('loan:paper-new-owner-repayment', 'buyer', `/v1/loans/${loan}/repay`, undefined, ({ result }) => { assert.equal(result.body.pledgeReturned, 200); assert.equal(result.body.paid, 22000); });
  const canceled = (await act('loan:cancel-offer', 'seller', '/v1/loans', { amount: 5000, rate: 0.1, hours: 1 })).body.id;
  await rollbackCall('loan:cancel-refund-rollback', 'loan:refund', 'seller', `/v1/loans/${canceled}/cancel`, 'cancel-offer', undefined);
  await observe('loan:cancel-refund', () => call('seller', `/v1/loans/${canceled}/cancel`, 'cancel-offer'), ({ result }) => assert.equal(result.body.refunded, 5000));
  // The estate simultaneously closes held cash, a borrower pledge, a lender claim and event entrants.
  const victimOrder = (await act('estate:loot-order', 'victim', '/v1/market/order', { goodId: 'gin', qty: 20, price: 500 })).body.id;
  await act('estate:loot-open-loan', 'victim', '/v1/loans', { amount: 20000, rate: 0.1, hours: 1 });
  const victimListing = (await act('estate:victim-car-list', 'victim', '/v1/market', { carId: car('victim'), minBid: 1000 })).body.id;
  await act('estate:killer-standing-bid', 'killer', `/v1/market/${victimListing}/bid`, { amount: 2000 });
  const doomedBid = (await act('estate:dead-bid-list', 'nonloot', '/v1/market', { carId: car('nonloot'), minBid: 1000 })).body.id;
  await act('estate:doomed-standing-bid', 'victim', `/v1/market/${doomedBid}/bid`, { amount: 3000 });
  const pledge = (await act('estate:secured-offer', 'seller', '/v1/loans', { amount: 10000, rate: 0.1, hours: 1, collateralOmr: 200, to: character('victim') })).body.id;
  await act('estate:secured-take', 'victim', `/v1/loans/${pledge}/take`);
  const inherited = (await act('estate:inherited-claim-offer', 'victim', '/v1/loans', { amount: 5000, rate: 0.1, hours: 1, to: character('rival') })).body.id;
  await act('estate:inherited-claim-take', 'rival', `/v1/loans/${inherited}/take`);
  const estate = (role, loot) => withTwoCharacters(app.pool, account('killer'), character(role), (ch, victim, client, h) => runEstate(client, h, victim, 'RC1 escrow terminal proof', { loot, ...(loot ? { killerCh: ch } : {}) }), { meet: false });
  await ledgerFailure('loan:seize:omr', 'omr');
  try { await observe('estate:late-pledge-disposition-rollback', () => assert.rejects(() => estate('victim', true), { code: 'P0001' }), unchanged); } finally { await removeFailure(); }
  let heir;
  await observe('estate:canonical-loot-death-and-heir', () => estate('victim', true), ({ after, result, receipts }) => {
    heir = result.heirId; const rate = Math.min(0.5, M3.CASH_LOOT_RATE * (seasonModOf().lootMult || 1));
    const total = (reason, currency) => exactSum(receipts.filter((r) => r.reason === reason && r.currency === currency).map((r) => r.amount));
    assert.equal(total('market:loot', 'cash'), String(-Math.floor(10000 * rate))); assert.equal(total('loan:loot', 'cash'), String(-Math.floor(20000 * rate)));
    assert.equal(total('loan:pledge:loot', 'omr'), '100'); assert.equal(total('loan:seize:omr', 'omr'), '100');
    assert(!after.market.some((r) => r.id === victimOrder)); assert.equal(after.market.find((r) => r.id === doomedBid).bidder, null);
    assert.equal(after.loans.find((r) => r.id === inherited).lender_character, heir); assert(after.characters.find((r) => r.id === heir)?.alive);
  });
  await observe('estate:dead-identity-retry-denied', () => assert.rejects(() => estate('victim', true), { code: 'no_target' }), unchanged);
  await act('estate:inherited-claim-repaid-to-heir', 'rival', `/v1/loans/${inherited}/repay`, undefined, ({ after }) => assert(Number(after.characters.find((r) => r.id === heir).cash) > 500));
  await act('estate:nonloot-order', 'nonloot', '/v1/market/order', { goodId: 'gin', qty: 12, price: 500 });
  await act('estate:nonloot-open-loan', 'nonloot', '/v1/loans', { amount: 15000, rate: 0.1, hours: 1 });
  await observe('estate:canonical-nonloot-death', () => estate('nonloot', false), ({ receipts }) => {
    assert.equal(exactSum(receipts.filter((r) => r.reason === 'market:death').map((r) => r.amount)), '-6000');
    assert.equal(exactSum(receipts.filter((r) => r.reason === 'loan:death').map((r) => r.amount)), '-15000');
    assert(!receipts.some((r) => ['market:loot', 'loan:loot'].includes(r.reason)));
  });
  const waiting = await snapshot(); report.deadlines = Object.fromEntries(Object.keys(eventTypes).map((type) => [type, waiting[type].find((r) => r.id === events[type]).resolves_at])); save();
  for (const [type, spec] of Object.entries(eventTypes)) {
    await waitUntil(new Date(report.deadlines[type]).getTime(), `waiting-${type}`);
    await ledgerFailure(`${spec.reason}:${shortField ? 'refund' : 'take'}`);
    try { await observe(`${type}:settlement-worker-ledger-rollback`, () => sweepEvent(type), (boundary) => { assert.equal(boundary.result.resolved, 0); unchanged(boundary); }); } finally { await removeFailure(); }
    await observe(`${type}:concurrent-terminal-workers`, () => Promise.all([sweepEvent(type), sweepEvent(type)]), ({ result, after, receipts }) => {
      // Sweep counts describe selected work, not committed dispositions. The journal and
      // resource equations independently prove a single payout/refund from this pool.
      assert(result.some((r) => r.resolved === 1)); assert.equal(after[type].find((r) => r.id === events[type]).status, shortField ? 'refunded' : 'resolved');
      const has = (suffix) => receipts.some((r) => r.reason === `${spec.reason}:${suffix}` && r.amount !== '0');
      if (shortField) { assert(has('refund')); assert(!has('take')); assert(!has('win')); } else { assert(has('win')); assert(has('take')); assert(has('death')); }
      assert.equal(eventHeld(after, type), '0');
    });
    await observe(`${type}:terminal-replay`, () => resolveEvent(type), unchanged);
    await observe(`${type}:worker-terminal-replay`, () => sweepEvent(type), unchanged);
  }
  if (longTerm) {
    const state = await snapshot(); const deadline = Math.max(...[marketExpiry, reserveExpiry, orderExpiry].map((id) => new Date(state.market.find((r) => r.id === id).expires_at).getTime()), new Date(state.loans.find((r) => r.id === defaultLoan).due_at).getTime());
    report.originalLongDeadline = new Date(deadline).toISOString(); save(); await waitUntil(deadline, 'waiting-original-market-loan-hour');
    await ledgerFailure('market:refund');
    try { await observe('market:expiry-refund-worker-failure', () => sweepMarket(app.pool), ({ after }) => { assert.equal(after.market.find((r) => r.id === reserveExpiry).status, 'live'); assert.equal(after.market.find((r) => r.id === orderExpiry).status, 'live'); }); } finally { await removeFailure(); }
    await observe('market:original-expiry-worker-retry', () => Promise.all([sweepMarket(app.pool), sweepMarket(app.pool)]), ({ after }) => {
      assert.equal(after.market.find((r) => r.id === marketExpiry).status, 'sold'); assert.equal(after.cars.find((r) => r.id === car('expiry')).character_id, character('buyer'));
      assert.equal(after.market.find((r) => r.id === reserveExpiry).status, 'expired'); assert.equal(after.market.find((r) => r.id === orderExpiry).status, 'expired');
    });
    await observe('market:original-expiry-worker-replay', () => sweepMarket(app.pool), unchanged);
    await act('market:original-reserve-expiry-reclaim', 'seller', `/v1/market/${reserveExpiry}/cancel`, undefined,
      ({ after }) => assert.equal(after.cars.find((r) => r.id === car('reserve-expiry')).listed, false));
    await rollbackCall('loan:original-collect-pledge-rollback', 'loan:seize:omr', 'killer', `/v1/loans/${defaultLoan}/collect`, 'original-collect', undefined, 'omr');
    const collected = await observe('loan:original-concurrent-collect', () => Promise.all([call('killer', `/v1/loans/${defaultLoan}/collect`, 'original-collect', undefined, [200, 409]), call('killer', `/v1/loans/${defaultLoan}/collect`, 'original-collect', undefined, [200, 409])]),
      ({ after, result }) => { assert(result.some((r) => r.status === 200)); assert.equal(after.loans.find((r) => r.id === defaultLoan).status, 'collected'); assert.equal(after.cars.find((r) => r.id === car('default')).character_id, character('killer')); });
    await replay('loan:original-collect-replay', 'killer', `/v1/loans/${defaultLoan}/collect`, 'original-collect', undefined, collected.find((r) => r.status === 200));
  }
  const beforeRestart = await snapshot(); await app.close(); app = await buildServer(); assert.deepEqual(stable(await snapshot()), stable(beforeRestart));
  await replay('market:server-reopen-sale-replay', 'buyer', `/v1/market/${listing}/buy`, 'market-sale', undefined, sale.find((r) => r.status === 200));
  await replay('loan:server-reopen-paper-replay', 'killer', `/v1/loans/${loan}/buy`, 'paper-buy', undefined, paper.find((r) => r.status === 200));
  for (const type of Object.keys(eventTypes)) { await observe(`${type}:server-reopen-terminal-replay`, () => resolveEvent(type), unchanged);
    if (!shortField) { const entry = entries[`${type}:victim`]; await replay(`${type}:heir-stale-entry-replay`, 'victim', entry.url, entry.key, entry.body, entry.entry); }
  }
  const final = await snapshot(); assert.equal(marketHeld(final), '0'); assert.equal(loanHeld(final), '0'); assert.equal(pledgeHeld(final), '0');
  fs.writeFileSync(path.join(output, 'final-state.json'), JSON.stringify(final, null, 2) + '\n'); report.outcome = 'SCOPED_PASS';
} catch (error) { report.error = { code: error.code, message: error.message, stack: error.stack }; process.exitCode = 1; }
finally {
  if (app) await app.close(); await admin.end();
  try { assert.equal(git('rev-parse', 'HEAD'), source.commit); assert.deepEqual(sourceBytes(), source.hashes); assertPinned(); report.source.immutableDuringRun = true; }
  catch (error) { report.source.immutableDuringRun = false; report.source.error = error.message; report.outcome = 'FAIL'; process.exitCode = 1; }
  report.endedAt = new Date().toISOString(); fs.writeFileSync(path.join(output, 'requests.json'), JSON.stringify(requests, null, 2) + '\n');
  const coverage = { schemaVersion: 1, source: source.commit, outcome: report.outcome, gate: report.gate, gateStatus: report.gateStatus, fixtureAssisted: true,
    configuration: report.configuration, executedScenarios: report.scenarios.filter((r) => r.outcome === 'PASS').map((r) => r.name), failures: report.scenarios.filter((r) => r.outcome !== 'PASS').map((r) => r.name),
    exclusions: report.exclusions, owner: report.owner, rerun: report.invocation, privacy: 'No tokens, raw requests, actor identities or connection strings included' };
  fs.writeFileSync(path.join(output, 'coverage-summary.json'), JSON.stringify(coverage, null, 2) + '\n');
  report.artifacts = fs.readdirSync(output).filter((file) => file !== 'result.json').map((file) => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(output, file))).digest('hex') })); save();
  console.log(JSON.stringify({ runId, outcome: report.outcome, output, error: report.error?.message }));
}
