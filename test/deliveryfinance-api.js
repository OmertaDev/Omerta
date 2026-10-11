import assert from 'node:assert/strict';
const postgres = process.argv.includes('--postgres');
if (postgres) {
  const value = process.env.DELIVERY_FINANCE_TEST_DATABASE_URL;
  if (!value) throw new Error('Set DELIVERY_FINANCE_TEST_DATABASE_URL to a fresh isolated API database.');
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1'
      || !/^\/delivery_finance_api_[a-z0-9_]+$/.test(url.pathname)
      || !((url.port === '35439' && url.username === 'pilot_runner') || (url.port === '5432' && url.username === 'postgres')))
    throw new Error('Invoice API proof requires a dedicated loopback delivery_finance_api_ database and test role.');
  const { Pool } = await import('pg'); const check = new Pool({ connectionString: value });
  try { assert.equal((await check.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0, 'native API database must be empty'); }
  finally { await check.end(); }
  process.env.DATABASE_URL = value;
} else if (process.env.DATABASE_URL) throw new Error('Memory proof refuses an existing DATABASE_URL.');
Object.assign(process.env, { RATE_LIMIT: 'off', JWT_SECRET: 'invoice-api-local-test-secret-no-production',
  MOD_KEY: 'invoice-api-local-test-mod-only', SOCIAL_VERIFY_MODE: 'off', DEPOT_PILOT: 'on', DELIVERY_CONTRACTS: 'on',
  MARKET_SEED: 'invoice-api-local-native-proof-only-seed' });
const { buildServer } = await import('../src/server.js');
const G = await import('../src/game.js');
const { loanOwed, loanVig } = await import('../src/rules.js');
const { runLedgerInvariants } = await import('../src/invariants.js');
const app = await buildServer();
let sequence = 0, fixture = 0;
const call = async (method, url, token, payload, key = `invoice-api-${++sequence}`) => {
  const response = await app.inject({ method, url, payload, headers: {
    ...(token ? { authorization: `Bearer ${token}` } : {}), 'idempotency-key': key,
  } });
  return { code: response.statusCode, body: response.json() };
};
const ok = response => { assert.equal(response.code, 200, JSON.stringify(response.body)); return response.body; };
async function actor(name) {
  const owner = ok(await call('POST', '/v1/auth/guest')).token;
  ok(await call('POST', '/v1/character', owner, { name }));
  const ch = ok(await call('GET', '/v1/me', owner)).character;
  const agent = ok(await call('POST', '/v1/auth/agent-key', owner)).token;
  const accountId = JSON.parse(Buffer.from(owner.split('.')[1], 'base64url').toString()).sub;
  await app.pool.query('UPDATE characters SET cash=50000.5,bank=0 WHERE id=$1', [ch.id]);
  await G.ledger(app.pool, { characterId: ch.id, currency: 'cash', amount: 50000.5 - Number(ch.cash) - Number(ch.bank), reason: 'crime:invoice-api-fixture' });
  return { id: ch.id, accountId, owner, agent, loc: ch.loc };
}
const cash = async id => Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [id])).rows[0].cash);
const requestRow = async id => (await app.pool.query('SELECT * FROM delivery_loan_requests WHERE id=$1', [id])).rows[0];
const loanRow = async id => (await app.pool.query('SELECT * FROM loans WHERE id=$1', [id])).rows[0];
const terms = f => ({ supplierId: f.supplier.id, lenderId: f.lender.id, commitmentId: f.commitmentId, principal: 5000, rate: 0.1, hours: 1 });
const request = (f, token = f.supplier.agent, key) => call('POST', '/v1/delivery-finance/requests', token, terms(f), key);
const offer = (f, token = f.lender.owner, key) => call('POST', `/v1/delivery-finance/${f.requestId}/offer`, token, {}, key);
const take = (f, token = f.supplier.agent, key) => call('POST', `/v1/delivery-finance/${f.requestId}/take`, token, {}, key);
const deliver = (f, token = f.supplier.agent, qty = 5, key) => call('POST', `/v1/deliveries/${f.commitmentId}/deliver`, token, { qty }, key);
const board = async token => ok(await call('GET', '/v1/delivery-finance', token));
async function setup() {
  const n = ++fixture, buyer = await actor(`Invoice Buyer ${n}`), supplier = await actor(`Invoice Supplier ${n}`), lender = await actor(`Invoice Lender ${n}`);
  const depotId = ok(await call('POST', '/v1/depot', buyer.owner,
    { salePrice: 2500, bidPrice: 2000, targetStock: 5, reorderAt: 0, restockBudget: 11000 })).id;
  ok(await call('POST', `/v1/depot/${depotId}/fund`, buyer.owner, { amount: 15000 }));
  const orderId = ok(await call('POST', `/v1/depot/${depotId}/restock`, buyer.owner)).id;
  const commitmentId = ok(await call('POST', `/v1/market/${orderId}/accept-delivery`, supplier.agent,
    { qty: 5, unitPrice: 2000, maxProcurementCash: 10000, deadlineSeconds: 1200 })).id;
  await app.pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [supplier.id, buyer.loc]);
  return { buyer, supplier, lender, depotId, orderId, commitmentId };
}
async function fund(f) {
  f.requestId = ok(await request(f)).request.id;
  f.loanId = ok(await offer(f)).request.loanId;
  return f;
}
const procure = async f => ok(await call('POST', '/v1/goods/buy', f.supplier.agent, { goodId: 'gin', qty: 5 }));
const count = async (who, reason) => Number((await app.pool.query('SELECT COUNT(*) n FROM transactions WHERE character_id=$1 AND reason=$2', [who, reason])).rows[0].n);
const kill = async p => {
  const response = await app.inject({ method: 'POST', url: '/v1/mod/kill', payload: { characterId: p.id }, headers: { 'x-mod-key': process.env.MOD_KEY } });
  assert.equal(response.statusCode, 200, response.body);
};
async function snapshot(f) {
  return { supplier: await cash(f.supplier.id), lender: await cash(f.lender.id),
    request: await requestRow(f.requestId), loan: await loanRow(f.loanId),
    order: (await app.pool.query('SELECT qty,filled_qty,status FROM market_listings WHERE id=$1', [f.orderId])).rows,
    commitment: (await app.pool.query('SELECT remaining,spent,status FROM delivery_commitments WHERE id=$1', [f.commitmentId])).rows,
    cargo: (await app.pool.query('SELECT good_id,qty FROM character_cargo WHERE character_id=$1 ORDER BY good_id', [f.supplier.id])).rows,
    transactions: Number((await app.pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n) };
}
try {
  const stranger = await actor('Invoice Stranger'), f = await setup();
  assert.equal((await call('GET', '/v1/delivery-finance')).code, 401);
  assert.equal((await request(f, null)).code, 401);
  assert.equal((await call('POST', '/v1/delivery-finance/requests', f.supplier.agent, { ...terms(f), permit: true })).body.error, 'delivery_finance');
  assert.equal((await request(f, stranger.owner)).body.error, 'delivery_finance');
  const first = ok(await request(f, f.supplier.agent, 'invoice-request-exact')).request; f.requestId = first.id;
  assert.equal(first.state, 'requested'); assert.equal(first.quoteIsBacking, false);
  assert.equal(ok(await request(f, f.supplier.owner, 'invoice-request-exact')).request.id, first.id);
  const mismatch = await call('POST', '/v1/delivery-finance/requests', f.supplier.agent, { ...terms(f), principal: 5001 }, 'invoice-request-exact');
  assert.equal(mismatch.code, 422); assert.equal(mismatch.body.error, 'idempotency_key_reuse');
  assert.deepEqual((await board(stranger.agent)).requests, []); assert.deepEqual((await board(f.buyer.owner)).requests, []);
  for (const token of [f.supplier.owner, f.lender.agent]) assert((await board(token)).requests.some(row => row.id === first.id));
  const disclosed = JSON.stringify((await board(f.lender.owner)).requests);
  for (const hidden of [f.supplier.accountId, f.lender.accountId, f.buyer.accountId, 'provider', 'maxProcurementCash']) assert(!disclosed.includes(hidden));
  assert.equal((await offer(f, stranger.agent)).body.error, 'delivery_finance');
  for (const action of ['offer', 'take', 'cancel'])
    assert.equal((await call('POST', `/v1/delivery-finance/${f.requestId}/${action}`, f.supplier.owner, { permit: true })).body.error, 'body');
  const lenderBefore = await cash(f.lender.id), supplierBefore = await cash(f.supplier.id);
  f.loanId = ok(await offer(f, f.lender.agent, 'invoice-offer-exact')).request.loanId;
  assert.equal(await cash(f.lender.id), lenderBefore - 5000); assert.equal(await cash(f.supplier.id), supplierBefore);
  assert.equal(ok(await offer(f, f.lender.owner)).request.loanId, f.loanId);
  assert.equal(await count(f.lender.id, 'loan:offer'), 1);
  process.env.DEPOT_PILOT = 'off';
  const accepted = ok(await call('POST', `/v1/loans/${f.loanId}/take`, f.supplier.agent, {}, 'invoice-legacy-take')).request;
  assert.equal(accepted.state, 'active'); assert.equal(await cash(f.supplier.id), supplierBefore + 5000);
  ok(await take(f, f.supplier.owner)); assert.equal(await count(f.supplier.id, 'loan:take'), 1);
  assert.equal((await request({ ...f, commitmentId: 'unknown' })).body.error, 'delivery_finance');
  process.env.DEPOT_PILOT = 'on'; await procure(f);
  const beforePartial = await snapshot(f);
  assert.equal((await call('POST', `/v1/market/${f.orderId}/fill`, f.supplier.agent,
    { qty: 5, commitmentId: f.commitmentId, permit: true })).body.error, 'qty', 'ordinary fill cannot claim the financed reservation with client-invented context');
  assert.deepEqual(await snapshot(f), beforePartial);
  assert.equal((await deliver(f, f.supplier.owner, 4)).body.error, 'delivery_finance');
  assert.deepEqual(await snapshot(f), beforePartial, 'partial financed delivery mutates neither cargo/order nor debt');
  if (postgres) {
    await app.pool.query("CREATE FUNCTION invoice_api_fail_repay() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason='loan:repay' THEN RAISE EXCEPTION 'invoice API repayment failure'; END IF; RETURN NEW; END $$");
    await app.pool.query('CREATE TRIGGER invoice_api_fail_repay BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION invoice_api_fail_repay()');
    try { assert.equal((await deliver(f, f.supplier.agent, 5, 'invoice-full-settle')).code, 500); }
    finally { await app.pool.query('DROP TRIGGER invoice_api_fail_repay ON transactions'); await app.pool.query('DROP FUNCTION invoice_api_fail_repay()'); }
    assert.deepEqual(await snapshot(f), beforePartial, 'repayment receipt failure rolls back prior canonical delivery and all cash/cargo/debt');
  }
  const supplierCash = await cash(f.supplier.id), lenderCash = await cash(f.lender.id);
  process.env.DEPOT_PILOT = 'off';
  const settled = ok(await deliver(f, f.supplier.agent, 5, 'invoice-full-settle'));
  assert.equal(settled.delivery.delivered, 5); assert.equal(settled.delivery.earned, 9800);
  assert.equal(settled.repayment.paid, loanOwed(5000, 0.1)); assert.equal(settled.repayment.vig, loanVig(settled.repayment.paid));
  assert(settled.repayment.paid <= settled.delivery.earned); assert.equal(settled.repayment.toLender, 5225);
  assert.equal(await cash(f.supplier.id), supplierCash + 9800 - 5500); assert.equal(await cash(f.lender.id), lenderCash + 5225);
  assert.equal((await cash(f.supplier.id)) % 1, 0.5, 'native automatic whole repayment preserves fractional game cash');
  assert.equal((await loanRow(f.loanId)).status, 'repaid'); assert.equal((await requestRow(f.requestId)).state, 'settled');
  const final = await snapshot(f);
  assert.deepEqual(ok(await deliver(f, f.supplier.agent, 5, 'invoice-full-settle')), settled);
  assert.deepEqual(await snapshot(f), final, 'same-key retry never repeats market or debt transfer');
  const bindingCheck = async () => {
    const check = (await runLedgerInvariants(app.pool, { alert: false })).checks.find(item => item.name === 'delivery finance bindings');
    assert(check, 'actual ledger sweep must include advance binding reconciliation'); return check;
  };
  const clean = async () => assert.equal((await bindingCheck()).ok, true, 'canonical advance bindings reconcile');
  await clean();
  const binding = await requestRow(f.requestId);
  const corrupt = async (write, restore) => {
    await write(); try { assert.equal((await bindingCheck()).ok, false, 'binding reconciliation must detect this corruption'); }
    finally { await restore(); } await clean();
  };
  await corrupt(() => app.pool.query('UPDATE delivery_loan_requests SET quote=$2 WHERE id=$1', [f.requestId, { ...binding.quote, fullSettlementNet: binding.quote.fullSettlementNet + 1 }]),
    () => app.pool.query('UPDATE delivery_loan_requests SET quote=$2 WHERE id=$1', [f.requestId, binding.quote]));
  await corrupt(() => app.pool.query('UPDATE loans SET principal=5001 WHERE id=$1', [f.loanId]),
    () => app.pool.query('UPDATE loans SET principal=5000 WHERE id=$1', [f.loanId]));
  await corrupt(() => app.pool.query('UPDATE delivery_loan_requests SET settlement=$2 WHERE id=$1', [f.requestId,
    { ...binding.settlement, delivery: { ...binding.settlement.delivery, earned: 10000 } }]),
    () => app.pool.query('UPDATE delivery_loan_requests SET settlement=$2 WHERE id=$1', [f.requestId, binding.settlement]));
  process.env.DEPOT_PILOT = 'on';

  const p = await fund(await setup()), paperBuyer = await actor('Invoice Paper Buyer');
  ok(await take(p, p.supplier.owner));
  ok(await call('POST', `/v1/loans/${p.loanId}/sell`, p.lender.owner, { price: 2000 }));
  ok(await call('POST', `/v1/loans/${p.loanId}/buy`, paperBuyer.agent, {}));
  assert.equal((await loanRow(p.loanId)).lender_character, paperBuyer.id);
  assert((await board(paperBuyer.owner)).requests.some(row => row.id === p.requestId && row.currentLenderId === paperBuyer.id));
  await procure(p); const newCreditorCash = await cash(paperBuyer.id), originalCash = await cash(p.lender.id);
  ok(await deliver(p, p.supplier.owner));
  assert.equal(await cash(paperBuyer.id), newCreditorCash + 5225); assert.equal(await cash(p.lender.id), originalCash, 'paper transfer preserves the current creditor rather than original lender payout');

  const h = await fund(await setup()); ok(await take(h)); await kill(h.lender);
  const heir = ok(await call('GET', '/v1/me', h.lender.owner)).character;
  assert.notEqual(heir.id, h.lender.id); assert.equal((await loanRow(h.loanId)).lender_character, heir.id);
  await procure(h); const heirCash = await cash(heir.id); ok(await deliver(h));
  assert.equal(await cash(heir.id), heirCash + 5225, 'canonical lender estate passes actual creditor rights to its real heir');

  const m = await fund(await setup()); ok(await take(m));
  ok(await call('POST', `/v1/loans/${m.loanId}/repay`, m.supplier.owner, {}));
  await procure(m); const manualLenderCash = await cash(m.lender.id); const ordinary = ok(await deliver(m));
  assert.equal(ordinary.delivered, 5); assert.equal(await cash(m.lender.id), manualLenderCash, 'manual repayment removes the sole encumbrance without a second lender claim');
  assert.equal((await requestRow(m.requestId)).state, 'closed');

  const dead = await fund(await setup()); ok(await take(dead)); await kill(dead.supplier);
  assert.equal(await loanRow(dead.loanId), undefined, 'canonical borrower estate may delete its loan without metadata FK obstruction');
  const deadHistory = (await board(dead.supplier.owner)).requests.find(row => row.id === dead.requestId);
  assert(deadHistory && deadHistory.loanId === dead.loanId && deadHistory.loanStatus === null);
  assert.equal(deadHistory.state, 'closed', 'history projects canonical borrower debt deletion without inventing a receivable');

  const a = await fund(await setup()); ok(await take(a)); await procure(a);
  const turn = ok(await call('GET', '/v1/agent/turn', a.supplier.agent));
  const action = turn.actions.find(item => item.id === `delivery:${a.commitmentId}:deliver` && item.kind === 'delivery_deliver');
  assert(action, 'actual issued delivery must remain executable through the current-creditor paired dispatch');
  const acted = ok(await call('POST', '/v1/agent/act', a.supplier.agent, { turnId: turn.turnId, actionId: action.id }));
  assert.equal(acted.result.delivery.delivered, 5); assert.equal(acted.result.repayment.paid, 5500);
  assert.equal((await requestRow(a.requestId)).state, 'settled');
  const cancelled = await setup(); cancelled.requestId = ok(await request(cancelled)).request.id;
  const cancelledCash = await cash(cancelled.supplier.id), unfundedLenderCash = await cash(cancelled.lender.id);
  process.env.DEPOT_PILOT = 'off';
  assert.equal(ok(await call('POST', `/v1/delivery-finance/${cancelled.requestId}/cancel`, cancelled.supplier.agent, {})).request.state, 'cancelled');
  assert.equal(ok(await call('POST', `/v1/delivery-finance/${cancelled.requestId}/cancel`, cancelled.supplier.owner, {})).request.state, 'cancelled');
  assert.equal(await cash(cancelled.supplier.id), cancelledCash); assert.equal(await cash(cancelled.lender.id), unfundedLenderCash);
  assert.equal((await requestRow(cancelled.requestId)).loan_id, null, 'metadata cancellation fabricates neither capital nor refund');
  process.env.DEPOT_PILOT = 'on';
  await clean();
  console.log(`invoice API ${postgres ? 'PostgreSQL' : 'memory'} PASS: actual auth/private request consensus, owner-agent parity, exact retries, bound legacy take, actual full market net/loan vig, partial refusal, disabled recovery, paper creditor/heir, manual release, borrower estate history and issued paired delivery${postgres ? '; native repayment trigger rollback' : ''}; no external financial activation`);
} finally { await app.close(); }
