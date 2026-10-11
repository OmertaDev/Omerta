// Actual AgentAct front spending. Native-only assertions prove rollback after a partial upkeep write.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { businessTierOf, energyCapOf, levelOf, nerveCapOf } from '../src/rules.js';
import { payBusinessUpkeep, upkeepOwed, upkeepPerHr } from '../src/business.js';
import { withCharacter } from '../src/game.js';

const postgres = process.argv.includes('--postgres');
const schema = `agent_business_${crypto.randomBytes(12).toString('hex')}`;
const owner = `agent-business-native:${crypto.randomUUID()}`;
let control, app, created = false;
for (const key of Object.keys(process.env)) if (/^(CHAIN_|VOUCHER_|PRIVY_|X_OAUTH|INVARIANT_WEBHOOK|DISCORD_|REDIS_URL)/.test(key)) delete process.env[key];
Object.assign(process.env, { SOCIAL_VERIFY_MODE: 'off', RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on' });
for (const key of ['JWT_SECRET', 'MOD_KEY', 'MARKET_SEED']) process.env[key] = crypto.randomBytes(32).toString('hex');

try {
  if (postgres) {
    const address = process.env.COORDINATION_TEST_DATABASE_URL;
    assert(address, 'An explicit disposable loopback PostgreSQL URL is required.');
    const endpoint = new URL(address);
    assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Refuse non-loopback PostgreSQL.');
    assert(/^agent_business_[0-9a-f]{24}$/.test(schema));
    const { Pool } = await import('pg');
    control = new Pool({ connectionString: endpoint.toString(), max: 1 });
    await control.query(`CREATE SCHEMA ${schema}`); created = true;
    await control.query(`COMMENT ON SCHEMA ${schema} IS '${owner}'`);
    endpoint.searchParams.set('options', `-c search_path=${schema} -c lock_timeout=8000 -c statement_timeout=20000`);
    process.env.DATABASE_URL = endpoint.toString();
  } else assert(!process.env.DATABASE_URL, 'Without --postgres, require disposable pg-mem.');

  const { buildServer } = await import('../src/server.js');
  app = await buildServer();
  if (postgres) {
    const native = (await app.pool.query('SELECT current_schema() AS schema,version() AS version')).rows[0];
    assert.equal(native.schema, schema, 'The actual application pool must use the owned disposable schema.');
    assert.match(native.version, /^PostgreSQL /, 'The actual application must execute against PostgreSQL.');
  }
  const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: {} });
  assert.equal(guest.statusCode, 200, guest.body);
  const keyReply = await app.inject({ method: 'POST', url: '/v1/auth/agent-key',
    headers: { authorization: `Bearer ${guest.json().token}` }, payload: {} });
  assert.equal(keyReply.statusCode, 200, keyReply.body);
  const token = keyReply.json().token, accountId = app.jwt.decode(token).sub;
  const headers = { authorization: `Bearer ${token}` };
  const birth = await app.inject({ method: 'POST', url: '/v1/character', headers,
    payload: { name: `Front ${crypto.randomBytes(4).toString('hex')}` } });
  assert.equal(birth.statusCode, 200, birth.body);
  const characterId = (await app.pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive', [accountId])).rows[0].id;
  const level = levelOf(10000000);
  // Freeze unrelated clock accrual; the business clocks remain real and independently backdated.
  await app.pool.query("UPDATE characters SET cash=$2,respect=$3,energy=$4,nerve=$5,last_accrued_at=now()+interval '1 day' WHERE id=$1",
    [characterId, 50000000, 10000000, energyCapOf(level), nerveCapOf(level)]);

  async function snapshot() {
    return {
      cash: (await app.pool.query('SELECT cash::text AS cash FROM characters WHERE id=$1', [characterId])).rows[0].cash,
      fronts: (await app.pool.query('SELECT * FROM businesses WHERE character_id=$1 ORDER BY id', [characterId])).rows,
      ledger: (await app.pool.query('SELECT * FROM transactions WHERE character_id=$1 ORDER BY id', [characterId])).rows,
      receipts: (await app.pool.query('SELECT * FROM idempotency WHERE account_id=$1 ORDER BY key', [accountId])).rows,
    };
  }
  async function turnAction(kind, path) {
    const response = await app.inject({ method: 'GET', url: '/v1/agent/turn', headers });
    assert.equal(response.statusCode, 200, response.body);
    const turn = response.json(), action = turn.actions.find(a => a.kind === kind && (!path || a.path === path));
    assert(action, `The current server must issue ${kind}${path ? ` at ${path}` : ''}.`);
    assert.equal(action.method, 'POST'); assert.deepEqual(action.body, {});
    return { turn, action };
  }
  async function actAndReplay(issued, check) {
    const idempotencyKey = crypto.randomUUID();
    const request = { method: 'POST', url: '/v1/agent/act', headers: { ...headers, 'idempotency-key': idempotencyKey },
      payload: { turnId: issued.turn.turnId, actionId: issued.action.id } };
    const before = await snapshot(), response = await app.inject(request);
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().actionId, issued.action.id);
    const after = await snapshot();
    check(response.json().result, before, after);
    const receipt = after.receipts.find(r => r.key === idempotencyKey);
    assert.equal(receipt?.status, 200); assert.equal(receipt.response, response.body);
    const replay = await app.inject(request);
    assert.equal(replay.statusCode, 200, replay.body);
    assert.equal(replay.headers['x-idempotent-replay'], 'true');
    assert.equal(replay.body, response.body, 'A completed exact key returns the identical historical reply.');
    assert.deepEqual(await snapshot(), after, 'Replay performs no second spend, ledger write, clock update or receipt mutation.');
    const changed = await app.inject({ ...request, payload: { ...request.payload, actionId: 'business:upkeep' === request.payload.actionId ? 'business:buy:invented' : 'business:upkeep' } });
    assert.equal(changed.statusCode, 422); assert.equal(changed.json().error, 'idempotency_key_reuse');
    assert.deepEqual(await snapshot(), after, 'Changed-body reuse has no financial effects.');
    return response.json().result;
  }
  function soleDebit(before, after, reason, amount) {
    assert.equal(Number(before.cash) - Number(after.cash), amount);
    const added = after.ledger.filter(row => !before.ledger.some(old => old.id === row.id));
    assert.equal(added.length, 1); assert.equal(added[0].currency, 'cash');
    assert.equal(added[0].reason, reason); assert.equal(Number(added[0].amount), -amount);
  }

  const buy = await turnAction('business_buy', '/v1/business/laundromat/buy');
  const front = await actAndReplay(buy, (result, before, after) => {
    assert.equal(result.kind, 'laundromat'); assert.equal(result.tier, 1);
    assert.equal(after.fronts.length, 1); assert.equal(after.fronts[0].id, result.id);
    soleDebit(before, after, 'business:buy', buy.action.cost.cash);
  });
  await app.pool.query("UPDATE businesses SET last_collect_at=now()+interval '1 day' WHERE id=$1", [front.id]);
  const upgrade = await turnAction('business_upgrade', `/v1/business/${front.id}/upgrade`);
  await actAndReplay(upgrade, (result, before, after) => {
    assert.equal(result.id, front.id); assert.equal(result.tier, 2); assert.equal(result.collected, 0);
    assert.equal(after.fronts.length, 1); assert.equal(after.fronts[0].tier, 2);
    soleDebit(before, after, 'business:upgrade', result.cost);
  });
  await app.pool.query("UPDATE businesses SET upkeep_at=now()-interval '2 hours',last_collect_at=now()+interval '1 day' WHERE id=$1", [front.id]);
  const upkeep = await turnAction('business_upkeep', '/v1/business/upkeep');
  await actAndReplay(upkeep, (result, before, after) => {
    assert(result.paid > 0 && result.paid <= upkeep.action.cost.cash);
    assert.equal(result.fronts.length, 1);
    assert(after.fronts[0].upkeep_at > before.fronts[0].upkeep_at);
    soleDebit(before, after, 'business:upkeep', result.paid);
  });
  // Establish both owned fronts through issued actions; no fabricated business ownership.
  const secondBuy = await turnAction('business_buy');
  await actAndReplay(secondBuy, (result, before, after) => {
    assert.notEqual(result.id, front.id); assert.equal(after.fronts.length, 2);
    soleDebit(before, after, 'business:buy', secondBuy.action.cost.cash);
  });

  if (postgres) {
    await app.pool.query("UPDATE businesses SET upkeep_at=now()-interval '2 hours',last_collect_at=now()+interval '1 day' WHERE character_id=$1", [characterId]);
    const before = await snapshot(), debts = before.fronts.map(row => upkeepOwed(row, 2));
    assert(debts.every(debt => debt > 1000));
    const total = debts.reduce((sum, debt) => sum + debt, 0);
    // Whichever unordered front comes first fits; only the second exceeds the aggregate allowance.
    const maxCash = total - Math.floor(Math.min(...debts) / 2);
    assert(debts.every(debt => debt < maxCash)); assert(maxCash < total);
    const observed = { clockWrites: 0, ledgerWrites: 0, visiblePartial: false };
    async function boundedUpkeep(limit, evidence) {
      return withCharacter(app.pool, accountId, async (ch, client, h) => {
        const watched = new Proxy(client, { get(target, property) {
          if (property === 'query') return async (sql, params) => {
            const result = await target.query(sql, params);
            if (String(sql).startsWith('UPDATE businesses SET upkeep_at=now()')) {
              assert.equal(result.rowCount, 1); evidence.clockWrites++;
            }
            if (String(sql).startsWith('INSERT INTO transactions') && params?.includes('business:upkeep')) {
              assert.equal(result.rowCount, 1); evidence.ledgerWrites++;
            }
            return result;
          };
          const value = target[property]; return typeof value === 'function' ? value.bind(target) : value;
        } });
        const hooks = { ...h, ledger: async (connection, entry) => {
          const result = await h.ledger(connection, entry);
          if (entry.reason === 'business:upkeep') {
            const clocks = (await connection.query('SELECT id,upkeep_at FROM businesses WHERE character_id=$1', [characterId])).rows;
            const rows = (await connection.query("SELECT id,amount FROM transactions WHERE character_id=$1 AND reason='business:upkeep'", [characterId])).rows;
            assert(clocks.some(row => row.upkeep_at > before.fronts.find(old => old.id === row.id).upkeep_at));
            assert(rows.some(row => !before.ledger.some(old => old.id === row.id) && Number(row.amount) === entry.amount));
            evidence.visiblePartial = true;
          }
          return result;
        } };
        return payBusinessUpkeep(ch, watched, hooks, { maxCash: limit, minimumReserve: 1000 });
      });
    }
    await assert.rejects(boundedUpkeep(maxCash, observed), error => error.code === 'business_budget');
    assert.deepEqual(observed, { clockWrites: 1, ledgerWrites: 1, visiblePartial: true },
      'The real transaction advances the first clock and inserts its debit before the second-front budget throw.');
    assert.deepEqual(await snapshot(), before, 'Native rollback restores exact cash, both fronts, ledger and HTTP receipts.');
    const retryEvidence = { clockWrites: 0, ledgerWrites: 0, visiblePartial: false };
    const buffer = before.fronts.reduce((sum, row) => sum + upkeepPerHr(businessTierOf(row.kind, row.tier), 2), 0);
    const retry = await boundedUpkeep(total + buffer, retryEvidence);
    assert.equal(retry.fronts.length, 2); assert(retry.paid >= total && retry.paid <= total + buffer);
    assert.deepEqual(retryEvidence, { clockWrites: 2, ledgerWrites: 2, visiblePartial: true });
    const after = await snapshot();
    assert.equal(Number(before.cash) - Number(after.cash), retry.paid);
    assert.deepEqual(after.receipts, before.receipts, 'Direct domain retry neither mints nor alters HTTP receipts.');
    const added = after.ledger.filter(row => !before.ledger.some(old => old.id === row.id));
    assert.equal(added.length, 2); assert(added.every(row => row.reason === 'business:upkeep' && row.currency === 'cash'));
    assert.equal(-added.reduce((sum, row) => sum + Number(row.amount), 0), retry.paid);
    for (const row of after.fronts) {
      const original = before.fronts.find(old => old.id === row.id);
      assert(row.upkeep_at > original.upkeep_at);
      assert.deepEqual({ ...row, upkeep_at: original.upkeep_at }, original);
    }
  }
  console.log('agent-business-transactions PASS: issued AgentAct buy/upgrade/upkeep, exact-key byte replay, changed-body refusal and canonical financial effects' +
    (postgres ? ', native two-front late-budget rollback and retry' : ' (pg-mem; native rollback not claimed)'));
} finally {
  if (app) { await app.close(); if (postgres) await app.pool.end(); }
  if (control) {
    try {
      if (created) {
        assert(/^agent_business_[0-9a-f]{24}$/.test(schema));
        const row = (await control.query("SELECT obj_description(oid,'pg_namespace') AS owner FROM pg_namespace WHERE nspname=$1", [schema])).rows[0];
        assert.equal(row?.owner, owner, 'Owned disposable schema identity changed; refusing cleanup.');
        await control.query(`DROP SCHEMA ${schema} CASCADE`);
      }
    } finally { await control.end(); }
  }
}
