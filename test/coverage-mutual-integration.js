import assert from 'node:assert/strict';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { prepareCoverageMutualDatabase } from './coverage-mutual-native-env.js';
const native = await prepareCoverageMutualDatabase({ integration: true });
Object.assign(process.env, { DEPOT_PILOT: 'on', RATE_LIMIT: 'off', INVITE_MODE: 'off', SOCIAL_VERIFY_MODE: 'off', LEGAL_PROFILE_DEFER: 'on',
  RESOURCE_ECONOMY: 'off', JWT_SECRET: 'coverage-mutual-owned-fixture', MOD_KEY: 'coverage-mutual-owned-mod', MARKET_SEED: 'coverage-mutual-owned-seed' });
const { buildServer } = await import('../src/server.js'), { mutualFixture } = await import('./coverage-mutual-fixture.js');
const G = await import('../src/game.js'), { runEstate } = await import('../src/social/estate.js');
const { runLedgerInvariants } = await import('../src/invariants.js'), { coverageMutualAccounting } = await import('../src/coverage-mutual-invariants.js');
const { canonicalDatabaseSnapshot } = await import('../tools/rc1-native-proof.js');
const app = await buildServer(), pool = app.pool;
try {
  const tables = (await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).rows.map(x => x.table_name).filter(x => x.startsWith('coverage_mutual_')).sort();
  assert.deepEqual(tables, ['coverage_mutual_claims','coverage_mutual_enrollments','coverage_mutual_pools','coverage_mutual_positions','coverage_mutual_requests'], 'The five tables must come from the actual shared schema');
  const f = await mutualFixture(pool), tokens = Object.fromEntries(['insurer','partner','insured'].map(sub => [sub, app.jwt.sign({ sub, tv: 0, ...(sub === 'partner' ? { agent: true } : {}) })]));
  const spec = (await app.inject({ method: 'GET', url: '/openapi.json' })).json();
  const ajv = new Ajv({ strict: false, allErrors: true }); addFormats(ajv);
  const validate = name => ajv.compile({ $ref: '#/components/schemas/' + name, components: { schemas: spec.components.schemas } });
  const validators = Object.fromEntries(['CoverageMutualBoard','CoverageMutualPoolReceipt','CoverageMutualClaimReceipt','CoverageMutualCloseReceipt'].map(name => [name, validate(name)]));
  const path = '/v1/company/coverage-mutuals'; let serial = 0;
  const call = (account, method, url, payload, key = 'coverage-api-' + ++serial) => app.inject({ method, url, payload,
    headers: { ...(account ? { authorization: 'Bearer ' + tokens[account] } : {}), ...(key ? { 'idempotency-key': key } : {}) } });
  const ok = async (schema, ...args) => { const r = await call(...args); assert.equal(r.statusCode, 200, r.body); const b = r.json(); assert(validators[schema](b), JSON.stringify(validators[schema].errors)); return b; };
  const books = async () => { await f.books(); const all = await runLedgerInvariants(pool, { alert: false }); assert.deepEqual(all.checks.filter(x => !x.ok), []); return all; };
  assert.equal((await call(null, 'GET', path)).statusCode, 401);
  assert.equal((await call('insurer', 'GET', path + '?authority=true')).statusCode, 409);
  for (const suffix of ['', '/join', '/claim', '/close']) {
    assert(spec.paths[path + suffix].post.requestBody.content['application/json'].schema.additionalProperties === false);
    assert(spec.paths[path + suffix].post.parameters.some(x => x.name === 'Idempotency-Key' && x.required));
  }
  const policies = await f.offers(), body = f.openBody(policies);
  assert.equal((await call('insurer', 'POST', path, body, null)).statusCode, 409);
  const opened = await ok('CoverageMutualPoolReceipt', 'insurer', 'POST', path, body, 'real-open');
  assert.deepEqual(await ok('CoverageMutualPoolReceipt', 'insurer', 'POST', path, body, 'real-open'), opened, 'Shared HTTP idempotency returns the immutable original response');
  assert.equal((await call('partner', 'POST', path + '/join', { ...f.joinBody(opened), authority: true })).statusCode, 409);
  if (native) {
    let pause, release, observed = false, entered = false;
    const paused = new Promise(r => { pause = r; }), resume = new Promise(r => { release = r; });
    const instrumented = new Proxy(pool, { get(target, name) {
      if (name === 'connect') return async () => {
        const client = await target.connect(); return new Proxy(client, { get(c, key) {
          if (key === 'query') return async (...args) => {
            const result = await c.query(...args);
            if (!observed && args[0] === "SELECT * FROM coverage_mutual_positions WHERE original_character=$1 AND state='funded'" && args[1]?.[0] === 'partner-actor') {
              observed = true; assert.equal(result.rows.length, 0); pause(); await resume;
            }
            return result;
          };
          const value = c[key]; return typeof value === 'function' ? value.bind(c) : value;
        } });
      };
      const value = target[name]; return typeof value === 'function' ? value.bind(target) : value;
    } });
    const death = G.withTwoCharacters(instrumented, 'insured', 'partner-actor', async () => { entered = true; }, { meet: false });
    const refused = assert.rejects(death, error => error.code === 'contention' && /mutual counterpart/i.test(error.message));
    let admitted;
    try {
      await Promise.race([paused, new Promise((_, reject) => setTimeout(() => reject(Error('Actual mutual preactor discovery was not observed')), 5000))]);
      await ok('CoverageMutualPoolReceipt', 'partner', 'POST', path + '/join', f.joinBody(opened), 'real-agent-join'); admitted = await canonicalDatabaseSnapshot(pool);
    } finally { release(); }
    await refused; assert(!entered); assert.deepEqual((await canonicalDatabaseSnapshot(pool)).tables, admitted.tables);
    console.log('Native genuine second-consent/new-counterpart race refuses before gameplay with every canonical row unchanged.');
  } else await ok('CoverageMutualPoolReceipt', 'partner', 'POST', path + '/join', f.joinBody(opened), 'real-agent-join');
  assert.equal((await ok('CoverageMutualBoard', 'insured', 'GET', path)).pools.length, 0);
  assert.equal((await ok('CoverageMutualBoard', 'partner', 'GET', path)).pools[0].reserveCash, 200); await books();
  await f.actualLoss(policies.a.offerId); await books();
  if (native) {
    let before, attempted;
    await assert.rejects(G.withTwoCharacters(pool, 'partner', 'insurer-actor', async (actor, victim, c, h) => {
      const beforeEvents = Number((await c.query('SELECT COUNT(*)::int AS n FROM item_events')).rows[0].n);
      await runEstate(c, h, victim, 'coverage mutual actual late estate failure', { killerCh: actor });
      assert.equal(Number((await c.query('SELECT COUNT(*)::int AS n FROM coverage_mutual_claims')).rows[0].n), 1, 'Estate settled the previously unclaimed genuine loss');
      attempted = Number((await c.query('SELECT COUNT(*)::int AS n FROM item_events')).rows[0].n) - beforeEvents;
      throw Error('after genuine coverage mutual estate');
    }, { meet: false, withActionScope: async (_c, _a, execute) => { before = await canonicalDatabaseSnapshot(pool); return execute(); } }), /after genuine coverage mutual estate/);
    const after = await canonicalDatabaseSnapshot(pool); assert.deepEqual(after.tables, before.tables);
    assert.deepEqual(after.sequences.map(x => x.sequencename), before.sequences.map(x => x.sequencename));
    for (let i = 0; i < before.sequences.length; i++) if (before.sequences[i].sequencename === 'item_events_sequence_seq')
      assert.equal(BigInt(after.sequences[i].last_value) - BigInt(before.sequences[i].last_value), BigInt(attempted));
    else assert.deepEqual(after.sequences[i], before.sequences[i]);
    console.log('Native actual estate late failure restores every row, with only the measured attempted item-event sequence advancement.');
  }
  const paid = await ok('CoverageMutualClaimReceipt', 'insurer', 'POST', path + '/claim', f.claimBody(opened, policies.a.offerId), 'real-api-claim');
  assert.equal(paid.claim.payoutCash, 65);
  assert.deepEqual(await ok('CoverageMutualClaimReceipt', 'insurer', 'POST', path + '/claim', f.claimBody(opened, policies.a.offerId), 'real-api-claim'), paid);
  const originalCash = await f.cash('partner'); let dyingCash, estateScope;
  await G.withTwoCharacters(pool, 'partner', 'insurer-actor', async (actor, victim, c, h) => {
    dyingCash = Number(victim.cash) + Number(victim.bank); estateScope = h.rentalDeathScope;
    actor.cash -= 7; await h.ledger(c, { characterId: actor.id, currency: 'cash', amount: -7, reason: 'crime:coverage-mutual-fixture' });
    await runEstate(c, h, victim, 'coverage mutual genuine original death', { killerCh: actor });
  }, { meet: false });
  assert(estateScope); assert.equal((await pool.query("SELECT alive FROM characters WHERE id='insurer-actor'")).rows[0].alive, false);
  const p = (await pool.query('SELECT * FROM coverage_mutual_pools WHERE id=$1', [opened.pool.id])).rows[0];
  assert.equal(p.state, 'closed'); assert.equal(p.close_reason, 'member_death'); assert.equal(p.reserve_cash, 0); assert.equal(p.paid_cash, 65); assert.equal(p.refunded_cash, 135);
  const positions = (await pool.query('SELECT * FROM coverage_mutual_positions WHERE pool_id=$1', [opened.pool.id])).rows;
  assert.equal(positions.length, 2, JSON.stringify(positions));
  const ownPosition = positions.find(x => x.original_character === 'insurer-actor'), partnerPosition = positions.find(x => x.original_character === 'partner-actor');
  assert(ownPosition && partnerPosition, JSON.stringify(positions));
  const ownRefund = Number(ownPosition.refunded_cash), partnerRefund = Number(partnerPosition.refunded_cash);
  assert.equal(await f.cash('partner'), originalCash - 7 + partnerRefund, 'Exactly one surviving actor refund delta preserves its unpersisted gameplay cash');
  assert.equal(Number((await pool.query("SELECT amount FROM transactions WHERE character_id='insurer-actor' AND reason='death:estate' AND currency='cash'")).rows[0].amount), -(dyingCash + ownRefund));
  assert.equal((await coverageMutualAccounting(pool)).reserve, 0); const all = await books();
  assert.deepEqual(await ok('CoverageMutualPoolReceipt', 'insurer', 'POST', path, body, 'real-open'), opened, 'Original immutable HTTP ACK remains available after death');
  assert.equal((await call('insurer', 'POST', path + '/claim', f.claimBody(opened, policies.a.offerId), 'heir-no-fresh-claim')).statusCode, 409);
  // A real invitee death may close/burn its canonical policy, but cannot strand
  // another original's pending contribution or make the unsigned invite a lock.
  const E = await import('../src/equipmentinsurance.js'), R = await import('../src/equipmentrentals.js');
  const offerBody = { coverageSeconds: 3600, maximumCash: 100, offerSeconds: 3600, premiumCash: 10, published: true };
  const futureA = await f.tx(c => E.createEquipmentInsurance(c, 'partner', offerBody, 'pending-after-estate-a'));
  const futureB = await f.tx(c => E.createEquipmentInsurance(c, 'maintainer', offerBody, 'pending-after-estate-b'));
  const pending = await ok('CoverageMutualPoolReceipt', 'partner', 'POST', path, { partnerCharacterId: 'maintainer-actor', creatorPolicyId: futureA.offerId,
    partnerPolicyId: futureB.offerId, contributionCash: 100, deductibleCash: 5, consent: true }, 'pending-real-invitee-death');
  const savedSources = (await pool.query('SELECT policy_sources,source_hash FROM coverage_mutual_pools WHERE id=$1', [pending.pool.id])).rows[0];
  await G.withTwoCharacters(pool, 'insured', 'maintainer-actor', async (_actor, victim, c, h) => {
    const scope = await R.assertEquipmentRentalDeathScope(c, victim.id, h.rentalDeathScope);
    assert(!scope.ids.has('partner-actor'), 'Unsigned invitation never adds the depositor to the invitee death-lock union');
    await runEstate(c, h, victim, 'genuine unsigned mutual invitee death');
  }, { meet: false });
  assert.equal((await pool.query('SELECT state FROM equipment_insurance_policies WHERE id=$1', [futureB.offerId])).rows[0].state, 'closed');
  const beforeRecovery = await f.cash('partner');
  const recovered = await ok('CoverageMutualCloseReceipt', 'partner', 'POST', path + '/close', f.closeBody(pending), 'pending-original-only-recovery');
  assert.equal(recovered.refunds.length, 1); assert.equal(recovered.refunds[0].originalCharacter, 'partner-actor'); assert.equal(recovered.refunds[0].amount, 100);
  assert.equal(await f.cash('partner'), beforeRecovery + 100);
  assert.deepEqual((await pool.query('SELECT policy_sources,source_hash FROM coverage_mutual_pools WHERE id=$1', [pending.pool.id])).rows[0], savedSources, 'Recovery preserves both actual original source histories');
  await books();
  for (const [currency, reason] of [['cash','coverage_mutual:payout_extra'], ['gin','coverage_mutual:payout']]) {
    const one = await G.ledger(pool, { characterId: 'partner-actor', currency, amount: 1, reason, counterparty: 'negative-mutual-vocabulary' });
    const two = await G.ledger(pool, { characterId: 'partner-actor', currency, amount: -1, reason, counterparty: 'negative-mutual-vocabulary' });
    assert.equal((await runLedgerInvariants(pool, { alert: false })).checks.find(x => x.name === 'reason vocabulary').ok, false);
    await pool.query('DELETE FROM transactions WHERE id=$1 OR id=$2', [one, two]);
  }
  await books();
  console.log('Coverage mutual integrated ' + (native ? 'native' : 'memory') + ' PASS: actual server/JWT human+agent registration, strict OpenAPI requests/results, canonical benefit65 once, genuine sealed preactor/estate-start recovery135 before exact death sink, original survivor delta, no heir authority, and all ' + all.checks.length + ' global book checks with strict cash-only journal vocabulary.');
} finally { await app.close(); }
