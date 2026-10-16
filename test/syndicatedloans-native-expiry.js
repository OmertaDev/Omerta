import assert from 'node:assert/strict';
import { nativeFixture, observedPool } from './syndicatedloans-native-fixture.js';
const f = await nativeFixture();
try {
  const started = Date.now(), p = await f.propose({ seconds: 60, key: 'real-native-deadline' });
  await f.action('lenderA', 'fund', p, 'original-real-fund');
  const deadline = +new Date(p.facility.expiresAt), immutable = (await f.pool.query('SELECT created_at,expires_at,terms,terms_hash FROM syndicated_loan_facilities WHERE id=$1', [p.facility.id])).rows;
  let baseline, delayed = false, events = 0; const accounts = new Set(), observedClocks = [];
  const database = observedPool(f.pool, async (client, sql, values) => {
    if (/INSERT INTO item_events\b/.test(sql)) events++;
    if (baseline && sql.startsWith('UPDATE account_persistent SET ') && ['borrower', 'lenderA', 'lenderB'].includes(values?.[0])) {
      accounts.add(values[0]); if (accounts.size === 3 && !delayed) {
        delayed = true; assert(Date.now() < deadline, 'Original funding and all3 account ACKs precede the actual deadline');
        assert.equal((await client.query('SELECT * FROM loans')).rows.length, 2);
        assert.equal(Number((await client.query('SELECT cash FROM characters WHERE id=$1', [f.players.lenderB.id])).rows[0].cash), 95000);
        // Actual same-client read-only observations keep the existing idle policy;
        // neither the server clock nor the authored deadline is changed.
        while (Date.now() < deadline + 75) {
          observedClocks.push((await client.query('SELECT clock_timestamp() AS at')).rows[0].at);
          await new Promise(resolve => setTimeout(resolve, Math.min(5000, Math.max(1, deadline + 75 - Date.now()))));
        }
        const at = (await client.query('SELECT clock_timestamp() AS at')).rows[0].at; observedClocks.push(at); assert(+new Date(at) >= deadline);
      }
    }
  }, async (_client, sql) => { if (!baseline && sql.startsWith('INSERT INTO loans')) baseline = await f.snapshot('late-second-fund-admission'); });
  await assert.rejects(f.action('lenderB', 'fund', p, 'real-post-final-ACK-expiry', database), error => error.code === 'syndicated_loan' && error.message === 'expired');
  assert(baseline && delayed); assert.equal(events, 0); assert(Date.now() - started >= 60000);
  f.same(baseline, await f.snapshot('late-second-fund-undone')); assert.equal(await f.balance('lenderB'), 100000);
  assert.deepEqual((await f.pool.query('SELECT created_at,expires_at,terms,terms_hash FROM syndicated_loan_facilities WHERE id=$1', [p.facility.id])).rows, immutable);
  const originals = (await f.pool.query('SELECT * FROM loans ORDER BY id')).rows; assert.equal(originals.length, 1); assert.equal(originals[0].status, 'open');
  const replacement = await f.propose(); assert.notEqual(replacement.facility.id, p.facility.id);
  assert.equal((await f.pool.query('SELECT state FROM syndicated_loan_facilities WHERE id=$1', [p.facility.id])).rows[0].state, 'retired');
  assert.deepEqual((await f.pool.query('SELECT * FROM loans ORDER BY id')).rows, originals);
  await assert.rejects(f.single('borrower', (ch, c, h) => f.Loans.takeLoan(ch, originals[0].id, null, c, h)), /enrolled_scope_required/);
  await f.single('lenderA', (ch, c, h) => f.Loans.cancelLoan(ch, originals[0].id, c, h)); assert.equal(await f.balance('lenderA'), 100000);
  const beforeReplay = await f.snapshot('before-expired-original-receipt');
  assert.equal((await f.action('lenderA', 'fund', p, 'original-real-fund')).replayed, true);
  f.same(beforeReplay, await f.snapshot('after-expired-original-receipt'));
  await f.action('borrower', 'cancel', replacement); await f.books(); await f.snapshot('final-real-expiry-recovery');
  f.proof('actual-clocks', { startedAt: new Date(started).toISOString(), deadline: p.facility.expiresAt, elapsedMs: Date.now() - started,
    observedClocks, actualAll3AccountACKs: true, sameClientReadOnlyKeepalives: true, clockDeadlineOrServerSettingMutations: 0,
    itemEventsAtFault: events, actualOneHourDefaultMaturity: false, financialActivation: false });
  console.log('PASS native N22 actual60s expiry after all3 persisted accounts undoes real second offer/ledger/cash; unchanged clocks/settings, original escrow/refund/receipt and metadata-only replacement');
} finally { await f.close(); }
