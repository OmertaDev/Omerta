import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fixture } from './shoppingbasket-fixture.js';
const f = await fixture();
try {
  const sourceURL = new URL('../src/shoppingbasket.js', import.meta.url), source = fs.readFileSync(sourceURL, 'utf8'), anchor = "import * as C from './consignments.js';";
  assert.equal(source.split(anchor).length, 2); const lines = await f.pair(), body = f.quoteBody(lines);
  for (const missing of ['consignmentEconomyListing', 'consignmentEconomySaleWitness', 'buyConsignmentWithBasketContext', 'assertFreshConsignmentBasketProof']) {
    let negative = source.replace(anchor, `import * as CanonicalC from '${new URL('../src/consignments.js', import.meta.url).href}'; const C=Object.freeze(Object.fromEntries(Object.entries(CanonicalC).filter(([name])=>name!=='${missing}')));`);
    for (const file of ['./game.js', './items.js']) negative = negative.replace(`'${file}'`, `'${new URL(file, sourceURL).href}'`);
    const absent = await import('data:text/javascript;base64,' + Buffer.from(negative).toString('base64')), before = await f.state();
    await assert.rejects(f.tx(c => absent.shoppingBasketAction(c, 'buyer', 'quote', body, 'missing-' + missing)), /integration_required/);
    assert.deepEqual(await f.state(), before, 'Missing genuine fixed capability cannot create quote/cash/UID effects');
  }
  let queries = 0;
  await assert.rejects(f.B.shoppingBasketAction({ query: async () => { queries++; return { rows: [] }; } }, 'buyer', 'quote', body, 'fake-client'), /active withItemTransaction/); assert.equal(queries, 0);
  console.log('Shopping basket4 missing fixed capabilities and fake query-client refusal PASS: genuine canonical imports/DB/Items remain; negative-only import filtering supplies no purchase callback or authority.');
} finally { await f.pool.end(); }
