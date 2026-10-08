import assert from 'node:assert/strict';

for (const key of ['SELL_TAX_BPS', 'SELL_TAX_DEV_BPS', 'SELL_TAX_RWA_BPS', 'SELL_TAX_LP_BPS', 'SELL_TAX_COMMUNITY_BPS'])
  process.env[key] = '0';
const { waterfall } = await import('../src/router.js');
const { recordSellTax } = await import('../src/treasury.js');
const { alertDrift, webhookText } = await import('../src/invariants.js');
const { chainParity, __setChainParamsReader } = await import('../src/vig.js');

const tax = waterfall().find((row) => row.id === 'tax');
assert.equal(tax.totalBps, 0);
assert.deepEqual(tax.splits, []);
for (const row of waterfall())
  assert.equal(row.splits.reduce((sum, split) => sum + split.bps, 0), row.totalBps);
await assert.rejects(recordSellTax({ query: () => assert.fail('disabled tax must not write revenue') },
  { ref: 'disabled-tax', omrTaxed: 1, priceOmrPerEth: 1, txHash: '0x1', bootstrap: true }),
  (error) => error.code === 'tax_disabled');
__setChainParamsReader(async () => ({ state: 'ok', omrSellTaxBps: 0, omrTaxDevBps: 0,
  omrTaxRwaBps: 0, omrTaxCommunityBps: 0, hookSellTaxBps: 0, hookTaxDevBps: 0,
  hookTaxRwaBps: 0, hookTaxCommunityBps: 0 }));
assert.equal((await chainParity()).state, 'ok');
__setChainParamsReader(null);

const failed = [{ name: 'chain parity', mismatches: [
  { what: 'OMR.sellTaxBps', onchain: 0, backend: 900 },
  { what: 'OmertaFees.mintFee', onchain: '5000000000000000', backend: '3000000000000000' },
  { what: 'OmertaFees.mintDevBps', onchain: null, backend: 10000 },
], note: 'Check active configuration.' }];
let payload;
const realFetch = globalThis.fetch;
process.env.INVARIANT_WEBHOOK_URL = 'https://example.invalid';
globalThis.fetch = async (_url, opts) => { payload = JSON.parse(opts.body); return { ok: true }; };
try {
  await alertDrift({ query: async () => ({ rows: [] }) }, failed, 'split', []);
} finally {
  globalThis.fetch = realFetch;
  delete process.env.INVARIANT_WEBHOOK_URL;
}
assert.match(payload.content, /OMR.sellTaxBps: on-chain 0 vs backend 900/);
assert.match(payload.content, /5000000000000000 vs backend 3000000000000000/);
assert.match(payload.content, /on-chain null vs backend 10000/);
assert.match(payload.content, /Check active configuration/);
assert(!payload.content.includes('[object Object]'));
assert.equal(payload.text, payload.content);
assert.deepEqual(payload.failed, failed);
assert(webhookText('split', Array.from({ length: 100 }, () => failed[0])).length < 2000);
assert.match(webhookText('backup', [{ name: 'nested', detail: { archive: 'off' } }]),
  /detail={"archive":"off"}/);
console.log('✅ split alerts and disabled sell-tax regressions passed');
