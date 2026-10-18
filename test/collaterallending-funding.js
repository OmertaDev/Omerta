import assert from 'node:assert/strict';
import { fixture } from './collaterallending-fixture.js';
const f = await fixture();
try {
  const operator = await f.player(), customer = await f.player(), borrower = await f.player();
  const Depot = await import('../src/depot.js'), Vaults = await import('../src/customervaults.js');
  await f.pool.query("UPDATE characters SET loc='docks' WHERE id=$1", [operator.id]);
  const depot = await f.G.withCharacter(f.pool, operator.account, (ch, client, h) => Depot.openDepot(ch,
    { salePrice: 300, bidPrice: 100, targetStock: 8, reorderAt: 0, restockBudget: 5000 }, client, h));
  const service = (await f.ok(operator, 'POST', '/v1/company/vaults/open',
    { depotId: depot.id, feeCash: 0, lifetimeSeconds: 3600, consent: true })).service;
  const position = (await f.ok(customer, 'POST', '/v1/company/vaults/deposit',
    { serviceId: service.id, sourceHash: service.sourceHash, principal: 20000, maxFeeCash: 0, consent: true })).position;
  const cash = Number((await f.pool.query('SELECT cash FROM characters WHERE id=$1', [operator.id])).rows[0].cash);
  await f.pool.query('UPDATE characters SET cash=4999 WHERE id=$1', [operator.id]);
  await f.G.ledger(f.pool, { characterId: operator.id, currency: 'cash', amount: 4999 - cash, reason: 'crime:collateral_fixture_capital_control' });
  const prior = await f.state();
  await assert.rejects(f.offer(operator, borrower), /cash|pocket/i);
  assert.deepEqual(await f.state(), prior, 'Ordinary offer refuses before cash reservation when operator lacks own capital');
  assert.equal((await Vaults.customerVaultAccounting(f.pool)).reserve, 20000);
  await f.ok(customer, 'POST', '/v1/company/vaults/withdraw', { positionId: position.id, sourceHash: position.sourceHash, consent: true });
  assert.equal((await Vaults.customerVaultAccounting(f.pool)).reserve, 0);
  assert.equal(Number((await f.pool.query('SELECT cash FROM characters WHERE id=$1', [operator.id])).rows[0].cash), 4999);
  console.log('PASS actual customer principal remains reserved and cannot back the operator ordinary cash-loan offer');
} finally { await f.app.close(); }
