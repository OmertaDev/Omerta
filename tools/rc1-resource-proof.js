// Native, fixture-assisted resource branch proof. This scoped pass cannot qualify
// the whole resource gate or substitute for the full-game simulation matrix.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { addedRows, equation, exactSum, negate, reconcileStacks, resourceSnapshot, sha256, stateWithoutBoundary } from './rc1-resource-journal.js';
import { resourceInventory } from './rc1-resource-inventory.js';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const development = process.argv.includes('--development');
const sourceFiles = () => git('ls-files', '--', 'src', 'content', 'schema.sql', 'package.json', 'package-lock.json',
  'tools/rc1-resource-proof.js', 'tools/rc1-resource-journal.js', 'tools/rc1-resource-inventory.js', 'test/rc1-resource-journal.js')
  .split(/\r?\n/).filter(Boolean).sort();
const sourceBytes = () => Object.fromEntries(sourceFiles().map((file) => [file,
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const source = { commit: git('rev-parse', 'HEAD'), clean: !git('status', '--porcelain'),
  relevantFileHashes: sourceBytes(),
  lockfileSha256: sha256(fs.readFileSync('package-lock.json', 'utf8')),
  schemaSha256: sha256(fs.readFileSync('schema.sql', 'utf8')) };
assert(development || source.clean, 'Commit source before an evidence campaign; --development only produces diagnostic evidence');
assert(process.env.RC1_RESOURCE_DATABASE_URL, 'Set RC1_RESOURCE_DATABASE_URL to an isolated loopback PostgreSQL administrative database');
const endpoint = new URL(process.env.RC1_RESOURCE_DATABASE_URL);
assert(['postgres:', 'postgresql:'].includes(endpoint.protocol));
assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only loopback PostgreSQL is allowed');
const runId = `resource-${source.commit.slice(0, 12)}-${crypto.randomBytes(5).toString('hex')}`;
const output = path.resolve(process.env.RC1_RESOURCE_OUTPUT || path.join(os.tmpdir(), 'omerta-rc1-resource-proof', runId));
assert(!fs.existsSync(path.join(output, 'result.json')), 'Never overwrite an evidence run');
fs.mkdirSync(output, { recursive: true });
const report = { schemaVersion: 1, runId, source, evidenceClass: development ? 'DEVELOPMENT_DIAGNOSTIC' : 'NATIVE_FIXTURE_ASSISTED',
  startedAt: new Date().toISOString(), outcome: 'FAIL', gateStatus: 'REQUIRED_TRANSITION_PROOF_MISSING',
  runtime: { node: process.version, platform: process.platform, architecture: process.arch, cpus: os.availableParallelism(), memoryBytes: os.totalmem() },
  population: 18, activeActors: 0, logicalDuration: { mode: 'real wall clock; no deadline or status rewrites after initialization' },
  scenarios: [], fixtureGrants: [], exclusions: ['Full simulation matrix and natural-entry progression',
    'OMR mint/burn/backing and deployed contract attestation', 'Operation capital lifecycle, all market/gambling/loan terminal dispositions',
    'Family war/turf/dissolution; NFT extraction/expiry/import', 'Shipment midnight boundary, looting and death',
    'Native process crash, operating-system restart and checkpoint restore; server reopen only',
    'Boost acquisition compound journal (salvage and hardening are individually journaled)',
    'Complete deployed operational flags, services, secret-source identities and integration attestation; configuration records selected local fixture settings only'] };
const save = () => fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
save();
const database = `rc1_resource_${crypto.randomBytes(8).toString('hex')}`;
const admin = new Pool({ connectionString: endpoint.toString() });
let app;
const actors = [];
let commandNumber = 0;
const key = (name) => `rc1-resource-${name}`;
const requests = [];

async function call(actor, url, commandKey, expected = [200], payload) {
  const order = ++commandNumber, startedAt = new Date().toISOString();
  const headers = { authorization: `Bearer ${actor.token}`, ...(commandKey ? { 'idempotency-key': commandKey } : {}) };
  const response = await app.inject({ method: 'POST', url, headers, payload });
  const body = response.json();
  requests.push({ order, completedOrder: requests.length + 1, actor: actor.id, url, commandKey, payload, startedAt,
    endedAt: new Date().toISOString(), status: response.statusCode, replayed: response.headers['x-idempotent-replay'] === 'true', body });
  assert(expected.includes(response.statusCode), `${url}: ${response.statusCode} ${JSON.stringify(body)}`);
  return { status: response.statusCode, body, replayed: response.headers['x-idempotent-replay'] === 'true' };
}
const cash = (snapshot, actor) => snapshot.characters.find((row) => row.id === actor.character).cash;
const material = (snapshot, actor) => snapshot.characters.find((row) => row.id === actor.character).shipment;
const summed = (snapshot, keyName) => exactSum(snapshot.characters.map((row) => row[keyName]));
let initialChecks;
async function invariantCheckpoint(name) {
  const { runLedgerInvariants } = await import('../src/invariants.js');
  const result = await runLedgerInvariants(app.pool, { alert: false });
  if (!initialChecks) initialChecks = result.checks;
  const baseline = new Map(initialChecks.map((row) => [row.name, row]));
  assert.equal(result.checks.length, baseline.size, 'All canonical checks retained');
  const checks = result.checks.map((row) => {
    const initial = baseline.get(row.name); assert(initial, row.name);
    // Declared initialization grants have known baseline drift. Nonzero drift is
    // never treated as a gameplay mint and cannot increase during measurement.
    assert.equal(exactSum([row.drift]), exactSum([initial.drift]), `${name}: ${row.name} drift changed`);
    if (!initial.ok) assert(['character cash', 'car conservation', '$OMR conservation'].includes(row.name), `${name}: unexplained fixture baseline ${row.name}`);
    return { name: row.name, baselineDrift: initial.drift, finalDrift: row.drift, ok: row.ok, fixtureAdjustedPass: true };
  });
  report.scenarios.push({ name: `invariants:${name}`, outcome: 'PASS', checks }); save();
}
async function observed(name, action, validate) {
  const before = await resourceSnapshot(app.pool), requestStart = requests.length;
  let after, result, receipts, movements;
  try {
    result = await action();
    after = await resourceSnapshot(app.pool);
    receipts = { transactions: addedRows(before.transactions, after.transactions), itemEvents: addedRows(before.itemEvents, after.itemEvents) };
    movements = reconcileStacks(before, after);
    await validate({ before, after, result, receipts, movements });
    await invariantCheckpoint(`after:${name}`);
    const entry = { name, outcome: 'PASS', databaseBoundaries: [before.databaseBoundary, after.databaseBoundary],
      beforeHash: sha256(stateWithoutBoundary(before)), afterHash: sha256(stateWithoutBoundary(after)),
      requests: requests.slice(requestStart), receipts, movements };
    fs.appendFileSync(path.join(output, 'movements.ndjson'), JSON.stringify(entry) + '\n');
    report.scenarios.push({ name, outcome: 'PASS', requests: entry.requests.length, movements: movements.length,
      journalSha256: sha256(entry) });
    report.activeActors = new Set(requests.map((row) => row.actor)).size;
    save();
    return result;
  } catch (error) {
    let snapshotError;
    if (!after) {
      try { after = await resourceSnapshot(app.pool); }
      catch (failedSnapshot) { snapshotError = { code: failedSnapshot.code, message: failedSnapshot.message }; }
    }
    const failed = { name, outcome: 'FAIL', before, after: after || null, result, receipts, movements,
      requests: requests.slice(requestStart), snapshotError, error: { code: error.code, message: error.message, stack: error.stack } };
    fs.writeFileSync(path.join(output, 'first-failed-boundary.json'), JSON.stringify(failed, null, 2) + '\n');
    report.scenarios.push({ name, outcome: 'FAIL', artifact: 'first-failed-boundary.json' });
    save();
    throw error;
  }
}
function unchanged({ before, after, receipts }) {
  assert.deepEqual(stateWithoutBoundary(after), stateWithoutBoundary(before), 'Rejected/replayed/aborted action left no committed resource or receipt change');
  assert.equal(receipts.transactions.length, 0); assert.equal(receipts.itemEvents.length, 0);
}
function cashMovement(proof, actor, amount, reason) {
  const rows = proof.receipts.transactions.filter((row) => row.character_id === actor.character && row.reason === reason);
  assert.equal(rows.length, 1, 'Exactly one authoritative cash receipt');
  assert.equal(exactSum(rows.map((row) => row.amount)), String(amount));
  proof.movements.push(equation({ resource: 'cash', owner: actor.character, before: cash(proof.before, actor), after: cash(proof.after, actor),
    ...(amount < 0 ? { destroyed: -amount } : { created: amount }), authority: rows.map((row) => ({ table: 'transactions', id: row.id, reason })) }));
  assert.equal(exactSum([summed(proof.after, 'cash'), negate(summed(proof.before, 'cash'))]), String(amount), 'Aggregate cash agrees with owner movement');
}

try {
  await admin.query(`CREATE DATABASE ${database}`);
  endpoint.pathname = `/${database}`;
  process.env.DATABASE_URL = endpoint.toString();
  process.env.JWT_SECRET = `rc1-isolated-fixture-${crypto.randomBytes(32).toString('hex')}`;
  process.env.MOD_KEY = `rc1-isolated-fixture-${crypto.randomBytes(32).toString('hex')}`;
  process.env.MARKET_SEED = 'rc1-resource-proof-fixed-seed-v1';
  process.env.SOCIAL_VERIFY_MODE = 'off';
  process.env.RATE_LIMIT = 'off';
  process.env.INVITE_MODE = 'off';
  for (const name of ['CHAIN_RPC_URL', 'CHAIN_SIGNER_PK', 'REDIS_URL', 'INVARIANT_WEBHOOK_URL', 'CITY_WIRE_WEBHOOK_URL']) delete process.env[name];
  const { buildServer } = await import('../src/server.js');
  const { SHIPMENT, shipmentDistrictOf, CAMPAIGNS, RARITY } = await import('../src/rules.js');
  app = await buildServer();
  report.configuration = { databaseIsolation: 'unique disposable database', rateLimit: 'off', inviteMode: 'off', chain: 'unconfigured',
    marketSeed: process.env.MARKET_SEED, fixtureAssisted: true, workers: 'not running',
    scope: 'Selected local fixture settings; not a complete deployed configuration attestation',
    inheritedFeatureFlags: Object.fromEntries(['CORE_PROGRESSION', 'WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE',
      'COORDINATION_KNOWLEDGE', 'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS', 'LIVING_WORLD_DIRECTOR']
      .map((name) => [name, process.env[name] ?? null])) };
  report.configurationSha256 = sha256(report.configuration);
  report.postgres = (await app.pool.query('SELECT version() AS version')).rows[0].version;
  report.extensions = (await app.pool.query('SELECT extname,extversion FROM pg_extension ORDER BY extname')).rows;
  for (let i = 0; i < report.population; i++) {
    const id = `resource-actor-${i}`, character = `${id}-character`;
    await app.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [id]);
    await app.pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [id]);
    await app.pool.query(`INSERT INTO characters(id,account_id,name,season,loc,respect,cash)
      VALUES($1,$2,$3,1,$4,10000,5000000)`, [character, id, `Resource Actor ${i}`, shipmentDistrictOf()]);
    actors.push({ id, character, token: app.jwt.sign({ sub: id, tv: 0 }) });
    report.fixtureGrants.push({ actor: id, character, cash: '5000000', respect: 10000, shipment: 0,
      location: shipmentDistrictOf(), socialMemberships: [], initializationOnly: true });
  }
  for (const actor of actors.slice(0, 2)) {
    await app.pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [actor.character, 'foundry']);
    await app.pool.query(`INSERT INTO cars(id,character_id,model_id,trim_id,dmg) VALUES($1,$2,'junker','stock',20)`, [`${actor.id}-car`, actor.character]);
    report.fixtureGrants.find((row) => row.actor === actor.id).car = { id: `${actor.id}-car`, model: 'junker', trim: 'stock', damage: 20 };
    report.fixtureGrants.find((row) => row.actor === actor.id).location = 'foundry';
  }
  for (const [i, branch] of ['save', 'walk'].entries()) {
    await app.pool.query(`INSERT INTO campaign_progress(character_id,campaign_id,step,done,branch,completed,claimed)
      VALUES($1,'doc_oath',3,0,$2,true,false)`, [actors[i].character, branch]);
    report.fixtureGrants.find((row) => row.actor === actors[i].id).campaign = { id: 'doc_oath', branch, completed: true, claimed: false };
  }
  for (const actor of actors.slice(2, 4)) {
    await app.pool.query('UPDATE account_persistent SET omr=2000 WHERE account_id=$1', [actor.id]);
    report.fixtureGrants.find((row) => row.actor === actor.id).omr = '2000';
  }
  await app.pool.query("INSERT INTO cars(id,character_id,model_id,trim_id,dmg) VALUES('resource-rarity-car',$1,'junker','stock',20)", [actors[2].character]);
  report.fixtureGrants[2].car = { id: 'resource-rarity-car', model: 'junker', trim: 'stock', damage: 20 };
  await app.pool.query("INSERT INTO gangs(id,name,tag) VALUES('resource-family','Resource Family','RC1')");
  await app.pool.query("INSERT INTO gang_members(gang_id,character_id,role) VALUES('resource-family',$1,'boss'),('resource-family',$2,'soldier')", [actors[2].character, actors[3].character]);
  report.fixtureGrants[2].socialMemberships.push({ family: 'resource-family', role: 'boss' });
  report.fixtureGrants[3].socialMemberships.push({ family: 'resource-family', role: 'soldier' });
  const baseline = await resourceSnapshot(app.pool);
  fs.writeFileSync(path.join(output, 'initial-state.json'), JSON.stringify(baseline, null, 2) + '\n');
  await invariantCheckpoint('fixture-baseline');
  // The controlled negative test is rolled back and never becomes game state.
  const { runLedgerInvariants } = await import('../src/invariants.js');
  const failureClient = await app.pool.connect();
  try {
    await failureClient.query('BEGIN');
    await failureClient.query('UPDATE characters SET cash=cash+1 WHERE id=$1', [actors[0].character]);
    // Hold the negative probe in our outer rollback transaction. The production
    // invariant still executes every real query on this connection; its usual
    // snapshot lifecycle cannot commit our intentionally corrupt test write.
    const rollbackProbe = { async connect() { return { release() {}, query(sql, params) {
      return /^(BEGIN|COMMIT|ROLLBACK)\b/.test(sql) ? Promise.resolve({ rows: [] }) : failureClient.query(sql, params);
    } }; } };
    const injected = await runLedgerInvariants(rollbackProbe, { alert: false });
    const before = initialChecks.find((row) => row.name === 'character cash').drift;
    const after = injected.checks.find((row) => row.name === 'character cash').drift;
    assert.equal(exactSum([after, negate(before)]), '1', 'Canonical invariant detects deliberately unreceipted cash');
    report.scenarios.push({ name: 'detector:unreceipted-cash-in-rollback', outcome: 'PASS', detectedDrift: '1', committed: false });
  } finally { await failureClient.query('ROLLBACK'); failureClient.release(); }
  assert.deepEqual(stateWithoutBoundary(await resourceSnapshot(app.pool)), stateWithoutBoundary(baseline));
  const rarityUrl = '/v1/nft/car/resource-rarity-car/upgrade', rarityKey = key('rarity');
  await observed('omr:rarity-recycles-to-desk', () => call(actors[2], rarityUrl, rarityKey), (proof) => {
    const amount = RARITY.UPGRADE_OMR[1];
    const account = (snapshot) => snapshot.accounts.find((row) => row.account_id === actors[2].id).omr;
    const shelf = (snapshot) => snapshot.desk.find((row) => row.id === 1).balance;
    const receipts = proof.receipts.transactions.filter((row) => row.currency === 'omr');
    assert.equal(exactSum(receipts.map((row) => row.amount)), '0', 'Player debit and desk recycle receipt net to zero');
    assert.equal(receipts.length, 2);
    const authority = receipts.map((row) => ({ table: 'transactions', id: row.id, reason: row.reason }));
    proof.movements.push(equation({ resource: 'OMR', owner: actors[2].id, before: account(proof.before), after: account(proof.after), transferredOut: amount, authority }));
    proof.movements.push(equation({ resource: 'OMR', owner: 'desk_inventory:1', before: shelf(proof.before), after: shelf(proof.after), transferredIn: amount, authority }));
    assert.equal(proof.after.cars.find((row) => row.id === 'resource-rarity-car').rarity, RARITY.TIERS[1].id);
  });
  await observed('omr:rarity-lost-response-retry', async () => { const response = await call(actors[2], rarityUrl, rarityKey); assert(response.replayed); return response; }, unchanged);
  await observed('omr:rarity-foreign-owner-denied', () => call(actors[3], rarityUrl, key('rarity-foreign'), [400]), unchanged);
  for (const [currency, amount, url] of [['cash', 1000, '/v1/gangs/tribute'], ['omr', 200, '/v1/gangs/tribute/omr']]) {
    const tributeKey = key(`tribute-${currency}`);
    await observed(`family:${currency}:tribute`, () => call(actors[2], url, tributeKey, [200], { amount }), (proof) => {
      const account = (snapshot) => currency === 'cash' ? cash(snapshot, actors[2]) : snapshot.accounts.find((row) => row.account_id === actors[2].id).omr;
      const family = (snapshot) => snapshot.families.find((row) => row.id === 'resource-family')[currency === 'cash' ? 'treasury' : 'omr_reserve'];
      const receipt = proof.receipts.transactions.filter((row) => row.reason === 'gang:tribute' && row.currency === currency);
      assert.equal(receipt.length, 1); assert.equal(receipt[0].amount, String(-amount));
      const authority = [{ table: 'transactions', id: receipt[0].id, reason: receipt[0].reason, destination: receipt[0].counterparty }];
      proof.movements.push(equation({ resource: currency, owner: actors[2].id, before: account(proof.before), after: account(proof.after), transferredOut: amount, authority }));
      proof.movements.push(equation({ resource: currency, owner: 'resource-family', before: family(proof.before), after: family(proof.after), transferredIn: amount, authority }));
    });
    await observed(`family:${currency}:tribute-replay`, async () => { const response = await call(actors[2], url, tributeKey, [200], { amount }); assert(response.replayed); return response; }, unchanged);
  }
  const lender = actors[2], borrower = actors[3], principal = 50000, pledge = 500;
  const cashEscrow = (snapshot) => exactSum(snapshot.loans.filter((row) => row.status === 'open').map((row) => row.principal));
  const omrEscrow = (snapshot) => exactSum(snapshot.loans.filter((row) => row.status === 'active').map((row) => row.collateral_omr));
  const omr = (snapshot, actor) => snapshot.accounts.find((row) => row.account_id === actor.id).omr;
  const loanAuthority = (proof) => proof.receipts.transactions.map((row) => ({ table: 'transactions', id: row.id, reason: row.reason }));
  const postLoan = (suffix) => observed(`loan:offer:${suffix}`, () => call(lender, '/v1/loans', key(`loan-offer-${suffix}`), [200],
    { amount: principal, rate: 0.1, hours: 24, collateralOmr: pledge, to: borrower.character }), (proof) => {
    const authority = loanAuthority(proof); assert.equal(proof.receipts.transactions.length, 1);
    assert.equal(proof.receipts.transactions[0].reason, 'loan:offer');
    assert.equal(proof.receipts.transactions[0].amount, String(-principal));
    proof.movements.push(equation({ resource: 'cash', owner: lender.character, before: cash(proof.before, lender), after: cash(proof.after, lender), transferredOut: principal, authority }));
    proof.movements.push(equation({ resource: 'cash', owner: 'loans:open', before: cashEscrow(proof.before), after: cashEscrow(proof.after), transferredIn: principal, authority }));
  });
  const cancelledLoan = (await postLoan('cancel')).body.id;
  await observed('loan:cancel-refund', () => call(lender, `/v1/loans/${cancelledLoan}/cancel`, key('loan-cancel')), (proof) => {
    const authority = loanAuthority(proof); assert.equal(proof.receipts.transactions.length, 1);
    assert.equal(proof.receipts.transactions[0].reason, 'loan:refund');
    assert.equal(proof.receipts.transactions[0].amount, String(principal));
    proof.movements.push(equation({ resource: 'cash', owner: lender.character, before: cash(proof.before, lender), after: cash(proof.after, lender), transferredIn: principal, authority }));
    proof.movements.push(equation({ resource: 'cash', owner: 'loans:open', before: cashEscrow(proof.before), after: cashEscrow(proof.after), transferredOut: principal, authority }));
  });
  await observed('loan:cancel-replay', async () => { const response = await call(lender, `/v1/loans/${cancelledLoan}/cancel`, key('loan-cancel')); assert(response.replayed); return response; }, unchanged);
  const activeLoan = (await postLoan('pledge')).body.id;
  await observed('loan:directed-take-denial', () => call(actors[4], `/v1/loans/${activeLoan}/take`, key('loan-foreign'), [400]), unchanged);
  await observed('loan:take-and-omr-pledge', () => call(borrower, `/v1/loans/${activeLoan}/take`, key('loan-take')), (proof) => {
    const authority = loanAuthority(proof); assert.equal(proof.result.body.pledgedOmr, pledge);
    assert.equal(proof.receipts.transactions.length, 2);
    proof.movements.push(equation({ resource: 'cash', owner: borrower.character, before: cash(proof.before, borrower), after: cash(proof.after, borrower), transferredIn: principal, authority }));
    proof.movements.push(equation({ resource: 'cash', owner: 'loans:open', before: cashEscrow(proof.before), after: cashEscrow(proof.after), transferredOut: principal, authority }));
    proof.movements.push(equation({ resource: 'OMR', owner: borrower.id, before: omr(proof.before, borrower), after: omr(proof.after, borrower), transferredOut: pledge, authority }));
    proof.movements.push(equation({ resource: 'OMR', owner: 'loans:active-collateral', before: omrEscrow(proof.before), after: omrEscrow(proof.after), transferredIn: pledge, authority }));
  });
  await observed('loan:take-replay', async () => { const response = await call(borrower, `/v1/loans/${activeLoan}/take`, key('loan-take')); assert(response.replayed); return response; }, unchanged);
  await observed('loan:repay-and-omr-refund', () => call(borrower, `/v1/loans/${activeLoan}/repay`, key('loan-repay')), (proof) => {
    const authority = loanAuthority(proof), result = proof.result.body;
    assert.equal(result.pledgeReturned, pledge);
    proof.movements.push(equation({ resource: 'OMR', owner: borrower.id, before: omr(proof.before, borrower), after: omr(proof.after, borrower), transferredIn: pledge, authority }));
    proof.movements.push(equation({ resource: 'OMR', owner: 'loans:active-collateral', before: omrEscrow(proof.before), after: omrEscrow(proof.after), transferredOut: pledge, authority }));
    proof.movements.push(equation({ resource: 'cash', owner: borrower.character, before: cash(proof.before, borrower), after: cash(proof.after, borrower), transferredOut: result.paid, authority }));
    proof.movements.push(equation({ resource: 'cash', owner: lender.character, before: cash(proof.before, lender), after: cash(proof.after, lender), transferredIn: result.toLender, authority }));
    let vig = '0';
    for (const [table, reason, sign] of [['streetTax', 'loan:vig', -1], ['loanHouse', 'loan:house:vig', 1]]) {
      const receipt = proof.receipts.transactions.find((row) => row.reason === reason); assert(receipt);
      const amount = sign === -1 ? negate(receipt.amount) : receipt.amount; vig = exactSum([vig, amount]);
      proof.movements.push(equation({ resource: 'cash', owner: `${table}:1`, before: proof.before[table][0].pool,
        after: proof.after[table][0].pool, transferredIn: amount, authority: [{ table: 'transactions', id: receipt.id, reason }] }));
    }
    assert.equal(vig, String(result.vig)); assert.equal(exactSum([result.toLender, vig]), String(result.paid), 'Repayment allocates every unit exactly once');
  });
  await observed('loan:repay-replay', async () => { const response = await call(borrower, `/v1/loans/${activeLoan}/repay`, key('loan-repay')); assert(response.replayed); return response; }, unchanged);
  // A finished story is an explicit prerequisite fixture, never claimed as earned
  // natural progression. Actual payout, authorization and durable retries are native.
  for (const [i, branch] of ['save', 'walk'].entries()) {
    const actor = actors[i], claimKey = key(`campaign-${i}`), url = '/v1/campaigns/doc_oath/claim';
    const catalog = CAMPAIGNS.find((row) => row.id === 'doc_oath');
    const amount = catalog.reward.cash + (catalog.steps.flatMap((row) => row.choice || []).find((row) => row.id === branch).cash || 0);
    const claimed = await observed(`campaign:${branch}:claim`, () => call(actor, url, claimKey), (proof) => {
      cashMovement(proof, actor, amount, 'campaign:reward');
      assert(proof.after.campaigns.find((row) => row.character_id === actor.character).claimed);
    });
    await observed(`campaign:${branch}:lost-response-retry`, async () => {
      const result = await call(actor, url, claimKey); assert(result.replayed); assert.deepEqual(result.body, claimed.body); return result;
    }, unchanged);
    await observed(`campaign:${branch}:new-key-denied`, () => call(actor, url, key(`campaign-again-${i}`), [400]), unchanged);
  }
  await observed('campaign:unauthorized-unfinished-actor', () => call(actors[2], '/v1/campaigns/doc_oath/claim', key('campaign-foreign'), [400]), unchanged);
  for (const actor of actors.slice(0, 2)) {
    await observed(`salvage:${actor.id}`, () => call(actor,
      `/v1/worldgraph/recipes/recipe%3Acar_salvage_basic/salvage/${actor.id}-car`, key(`salvage-${actor.id}`)), (proof) => {
      assert.equal(proof.before.cars.length - proof.after.cars.length, 1);
      assert.equal(proof.receipts.itemEvents.filter((row) => row.event_kind === 'stack_granted').length, 3);
      assert.equal(proof.receipts.transactions.length, 0);
      proof.movements.push(equation({ resource: 'car', owner: actor.character, before: 1, after: 0, destroyed: 1,
        authority: [{ table: 'item_mutation_guards', key: addedRows(proof.before.guards, proof.after.guards, 'idempotency_key')[0].idempotency_key,
          rule: 'recipe:car_salvage_basic consumes one owned car' }] }));
    });
  }
  const craftUrl = '/v1/worldgraph/recipes/recipe%3Ahardened_steel/craft';
  const craftKey = key('hardening-once');
  const hardening = await observed('hardening:concurrent-duplicate', () => Promise.all([
    call(actors[0], craftUrl, craftKey, [200, 409]), call(actors[0], craftUrl, craftKey, [200, 409]),
  ]), (proof) => {
    assert(proof.result.some((row) => row.status === 200)); cashMovement(proof, actors[0], -300, 'craft:recipe:hardened_steel');
    assert.equal(proof.receipts.itemEvents.filter((row) => row.template_id === 'mat:scrap_steel')[0].quantity_delta, -4);
    assert.equal(proof.receipts.itemEvents.filter((row) => row.template_id === 'mat:hardened_steel')[0].quantity_delta, 1);
  });
  await observed('hardening:lost-response-retry', async () => {
    const response = await call(actors[0], craftUrl, craftKey); assert(response.replayed);
    assert.deepEqual(response.body, hardening.find((row) => row.status === 200).body); return response;
  }, unchanged);
  await observed('hardening:insufficient-materials', () => call(actors[0], craftUrl, key('hardening-too-much'), [400]), unchanged);
  await app.pool.query(`CREATE FUNCTION rc1_fail_output() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.template_id='mat:hardened_steel' THEN RAISE EXCEPTION 'rc1 deliberate output failure'; END IF; RETURN NEW; END $$`);
  await app.pool.query('CREATE TRIGGER rc1_fail_output BEFORE INSERT OR UPDATE ON item_stacks FOR EACH ROW EXECUTE FUNCTION rc1_fail_output()');
  try {
    await observed('hardening:failure-between-debit-and-output', () => call(actors[1], craftUrl, key('hardening-rollback'), [500]), unchanged);
  } finally {
    await app.pool.query('DROP TRIGGER rc1_fail_output ON item_stacks');
    await app.pool.query('DROP FUNCTION rc1_fail_output()');
  }
  await observed('hardening:retry-after-rollback', () => call(actors[1], craftUrl, key('hardening-rollback')), (proof) => cashMovement(proof, actors[1], -300, 'craft:recipe:hardened_steel'));
  await invariantCheckpoint('campaign-and-hardening');
  let took = 0;
  for (const actor of actors.slice(2)) {
    await observed(`shipment:take:${actor.id}`, () => call(actor, '/v1/shipment/take', key(`take-${actor.id}`), [200, 400]), (proof) => {
      const granted = proof.result.status === 200 ? proof.result.body.took : 0;
      if (!granted) { assert.equal(proof.result.body.error, 'gone'); unchanged(proof); return; }
      took += granted;
      const take = proof.after.shipmentTakes.find((row) => row.character_id === actor.character);
      assert.equal(take.n, granted); assert(granted <= SHIPMENT.PER_PLAYER);
      proof.movements.push(equation({ resource: 'shipment-material', owner: actor.character, before: material(proof.before, actor),
        after: material(proof.after, actor), created: granted, authority: [{ table: 'shipment_takes', day: take.day, character: actor.character, n: take.n,
          rule: 'SHIPMENT.PER_PLAYER and stamped shipment_days.cap' }] }));
      const day = proof.after.shipmentDays[0]; assert(day.taken <= day.cap);
      assert.equal(proof.receipts.transactions.length, 0, 'Shipment material is not cash');
    });
  }
  const day = (await app.pool.query('SELECT * FROM shipment_days')).rows[0];
  assert.equal(took, day.cap, 'The actual daily city cap was exhausted');
  assert.equal(day.taken, day.cap);
  await observed('shipment:take-replay-after-city-exhaustion', async () => {
    const response = await call(actors[2], '/v1/shipment/take', key(`take-${actors[2].id}`)); assert(response.replayed); return response;
  }, unchanged);
  await observed('shipment:player-cap-new-key', () => call(actors[2], '/v1/shipment/take', key('take-again'), [400]), unchanged);
  const piece = SHIPMENT.COMMISSIONS.find((row) => row.id === 'case'), commissionKey = key('commission');
  const commission = await observed('shipment:concurrent-commission', () => Promise.all([
    call(actors[2], '/v1/shipment/commission/case', commissionKey, [200, 409]),
    call(actors[2], '/v1/shipment/commission/case', commissionKey, [200, 409]),
  ]), (proof) => {
    assert(proof.result.some((row) => row.status === 200)); cashMovement(proof, actors[2], -piece.cash, 'shipment:commission');
    assert.equal(proof.after.pieces.length - proof.before.pieces.length, 1);
    const created = proof.after.pieces.find((row) => row.account_id === actors[2].id); assert.equal(created.serial, 1);
    const authority = [{ table: 'bespoke_pieces', account: actors[2].id, commission: piece.id, serial: created.serial,
      rule: `SHIPMENT.COMMISSIONS.${piece.id}: ${piece.units} material + ${piece.cash} cash` }];
    proof.movements.push(equation({ resource: 'shipment-material', owner: actors[2].character,
      before: material(proof.before, actors[2]), after: material(proof.after, actors[2]), destroyed: piece.units, authority }));
    proof.movements.push(equation({ resource: `bespoke:${piece.id}`, owner: actors[2].id, before: 0, after: 1, created: 1, authority }));
  });
  await observed('shipment:commission-lost-response-retry', async () => {
    const response = await call(actors[2], '/v1/shipment/commission/case', commissionKey); assert(response.replayed);
    assert.deepEqual(response.body, commission.find((row) => row.status === 200).body); return response;
  }, unchanged);
  await invariantCheckpoint('all-resource-commands');
  const restartBefore = await resourceSnapshot(app.pool);
  await app.close(); await app.pool.end(); app = await buildServer();
  assert.deepEqual(stateWithoutBoundary(await resourceSnapshot(app.pool)), stateWithoutBoundary(restartBefore), 'Server reopen preserves resource state and receipts');
  await observed('campaign:server-reopen-replay', async () => {
    const response = await call(actors[0], '/v1/campaigns/doc_oath/claim', key('campaign-0')); assert(response.replayed); return response;
  }, unchanged);
  await observed('hardening:server-reopen-replay', async () => {
    const response = await call(actors[0], craftUrl, craftKey); assert(response.replayed); return response;
  }, unchanged);
  await observed('shipment:server-reopen-replay', async () => {
    const response = await call(actors[2], '/v1/shipment/commission/case', commissionKey); assert(response.replayed); return response;
  }, unchanged);
  await invariantCheckpoint('server-reopen');
  fs.writeFileSync(path.join(output, 'final-state.json'), JSON.stringify(await resourceSnapshot(app.pool), null, 2) + '\n');
  report.outcome = 'SCOPED_PASS';
} catch (error) {
  report.error = { name: error.name, code: error.code, message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  if (app) { await app.close(); await app.pool.end(); }
  await admin.end(); // Retain isolated database for reproduction; never drop it implicitly.
  try {
    const finalCommit = git('rev-parse', 'HEAD'), finalHashes = sourceBytes();
    assert.equal(finalCommit, source.commit, 'Source commit changed during resource proof');
    assert.deepEqual(finalHashes, source.relevantFileHashes, 'Relevant source bytes changed during resource proof');
    report.source.finalCommit = finalCommit;
    report.source.immutableDuringRun = true;
  } catch (error) {
    report.source.immutableDuringRun = false;
    report.source.immutabilityError = error.message;
    report.outcome = 'FAIL'; process.exitCode = 1;
  }
  report.databaseName = database;
  report.endedAt = new Date().toISOString();
  report.commands = { requests: requests.length, denials: requests.filter((row) => row.status >= 400).length,
    replays: requests.filter((row) => row.replayed).length };
  fs.writeFileSync(path.join(output, 'requests.json'), JSON.stringify(requests, null, 2) + '\n');
  fs.writeFileSync(path.join(output, 'coverage-inventory.json'), JSON.stringify(resourceInventory(report), null, 2) + '\n');
  report.artifacts = fs.readdirSync(output).filter((file) => file !== 'result.json').map((file) => ({ file,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(output, file))).digest('hex') }));
  save();
  console.log(JSON.stringify({ runId, outcome: report.outcome, gateStatus: report.gateStatus, output, error: report.error?.message }));
}
