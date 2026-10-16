import assert from 'node:assert/strict';
import { nativeFixture, assertExactRollback } from './shoppingbasket-native-fixture.js';
import { runEstate } from '../src/social/estate.js';
const f = await nativeFixture(), races = [];
const run = async (name, calls) => {
  const results = await Promise.allSettled(calls.map(fn => fn()));
  for (const result of results) if (result.status === 'rejected') assert(result.reason?.code, 'Only a genuine typed canonical refusal is expected');
  races.push({ name, results: results.map(r => r.status === 'fulfilled' ? { status: r.status, receiptStatus: r.value?.status || null } : { status: r.status, code: r.reason.code, message: r.reason.message }) });
  return results;
};
try {
  let p = await f.prepare(), body = f.ref(p.quote);
  let results = await run('same original key/body', [() => f.act('buyer', 'checkout', body, 'native-same-key'), () => f.act('buyer', 'checkout', body, 'native-same-key')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 2); assert.deepEqual(results[0].value, results[1].value); await f.books();
  let stable = await f.snapshot(); assert.deepEqual(await f.act('buyer', 'checkout', body, 'native-same-key'), results[0].value); assertExactRollback(stable, await f.snapshot(), []);
  p = await f.prepare(); body = f.ref(p.quote);
  results = await run('different checkout keys', [() => f.act('buyer', 'checkout', body, 'native-different-a'), () => f.act('buyer', 'checkout', body, 'native-different-b')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); await f.books();
  p = await f.prepare(); body = f.ref(p.quote);
  results = await run('buyer metadata cancel versus checkout', [() => f.act('buyer', 'checkout', body, 'native-buy-cancel-race'), () => f.act('buyer', 'cancel', body, 'native-cancel-buy-race')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); await f.books();
  p = await f.prepare(); const second = await f.act('other', 'quote', f.quoteBody(p.lines), 'native-second-buyer');
  results = await run('two genuine buyers same actual UIDs', [() => f.act('buyer', 'checkout', f.ref(p.quote), 'native-buyer-one'), () => f.act('other', 'checkout', f.ref(second), 'native-buyer-two')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); await f.books();
  p = await f.prepare(); const retired = p.lines[0];
  results = await run('original seller cancellation versus checkout', [() => f.act('buyer', 'checkout', f.ref(p.quote), 'native-seller-cancel-buy'), () => f.tx(c => f.C.cancelConsignment(c, retired.seller, retired.body, 'native-seller-cancel'))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); await f.books();
  p = await f.prepare();
  results = await run('actual original seller estate versus checkout', [() => f.act('buyer', 'checkout', f.ref(p.quote), 'native-seller-death-buy'), () => f.G.withTwoCharacters(f.pool, 'host-two', 'seller-a-actor', (_actor, victim, c, h) => runEstate(c, h, victim, 'N18 ordinary estate race'), { meet: false })]);
  assert.equal(results[1].status, 'fulfilled');
  const sold = (await f.pool.query("SELECT id FROM consignments WHERE id=ANY($1::text[]) AND status='sold'", [p.lines.map(line => line.offer.consignmentId)])).rows;
  assert.equal(sold.length, results[0].status === 'fulfilled' ? 2 : 0); await f.books();
  console.log(JSON.stringify({ proof: 'N18 actual concurrent calls and original seller retirement/estate; no forced shared-preflight schedule claim', races, checks: await f.books() }));
} finally { await f.pool.end(); }
