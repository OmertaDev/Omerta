import assert from 'node:assert/strict';
import { fixture } from './collaterallending-fixture.js';

const f = await fixture({ nativeOnly: true });
try {
  const { runEstate } = await import('../src/social/estate.js');
  const lender = await f.player(), borrower = await f.player(), observer = await f.player();
  const item = await f.makeTool(borrower), loan = await f.offer(lender, borrower);
  const pledge = await f.pledge(borrower, loan, item, await f.quote(borrower, loan, item));
  await assert.rejects(f.tx(client => f.C.recoverCollateralLendingInEstate(client, borrower.id, {}, {})));
  const borrowerAccount = borrower.account;
  await f.G.withTwoCharacters(f.pool, observer.account, borrower.id, (_actor, victim, client, h) =>
    runEstate(client, h, victim, 'equipment collateral original borrower estate'), { meet: false });
  const released = (await f.pool.query('SELECT * FROM collateral_lending_pledges WHERE id=$1', [pledge.pledge.pledgeId])).rows[0];
  assert.equal(released.state, 'estate_released'); assert.equal(released.release_kind, 'borrower_estate');
  assert.equal((await f.pool.query('SELECT id FROM loans WHERE id=$1', [loan.id])).rows.length, 0);
  assert.equal((await f.pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [item])).rows[0].owner_id, borrowerAccount);
  assert.equal((await f.pool.query('SELECT item_id FROM operation_escrow WHERE item_id=$1', [item])).rows.length, 0);
  await assert.rejects(f.C.collateralLendingAction(f.pool, borrower.account, 'release', f.ref(pledge), f.key('heir-release')));
  await f.books();
  // Original lender estate passes the actual active cash claim to the canonical heir only.
  const lender2 = await f.player(), borrower2 = await f.player(), tool2 = await f.makeTool(borrower2), loan2 = await f.offer(lender2, borrower2);
  const pledge2 = await f.pledge(borrower2, loan2, tool2, await f.quote(borrower2, loan2, tool2));
  await f.G.withTwoCharacters(f.pool, observer.account, lender2.id, (_actor, victim, client, h) =>
    runEstate(client, h, victim, 'equipment collateral cash claim holder estate'), { meet: false });
  const heir = (await f.pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true', [lender2.account])).rows[0];
  assert.notEqual(heir.id, lender2.id);
  assert.equal((await f.pool.query('SELECT lender_character FROM loans WHERE id=$1', [loan2.id])).rows[0].lender_character, heir.id);
  assert.equal((await f.pool.query('SELECT state FROM collateral_lending_pledges WHERE id=$1', [pledge2.pledge.pledgeId])).rows[0].state, 'held');
  await f.C.collateralLendingAction(f.pool, borrower2.account, 'repay', f.ref(pledge2), f.key('repay-heir-holder'));
  assert.equal((await f.pool.query('SELECT holder_character FROM collateral_lending_terminals WHERE pledge_id=$1', [pledge2.pledge.pledgeId])).rows[0].holder_character, heir.id);
  assert.equal((await f.pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [tool2])).rows[0].owner_id, borrower2.account);
  await f.books();
  console.log('PASS native genuine borrower estate releases only original depositor; lender estate preserves active pledge and current canonical cash claim heir');
} finally { await f.app.close(); }
