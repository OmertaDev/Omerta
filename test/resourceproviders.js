import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { providerCatalog, quoteCompute, executeCompute, createPaymentSession,
  verifyPaymentWebhook, fetchComputeReceipt, ResourceProviderError } from '../src/resourceproviders.js';

const names = ['RESOURCE_COMPUTE_CATALOG', 'RESOURCE_OPENAI_API_KEY', 'RESOURCE_STRIPE_SECRET_KEY', 'RESOURCE_STRIPE_WEBHOOK_SECRET'];
const previous = names.map(name => process.env[name]);
const originalFetch = globalThis.fetch;
const entry = { id: 'test-small', provider: 'openai', model: 'test-model', storeResponses: true, inputUsdMicrosPerMillion: 1_000_001,
  outputUsdMicrosPerMillion: 2_000_003, maxInputTokens: 2048, maxOutputTokens: 64 };
const response = data => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
const compute = { id: 'resp_test', status: 'completed', model: 'test-model', metadata: { omertaResourceRequestId: 'job-1' }, usage: { input_tokens: 13, output_tokens: 7,
  input_tokens_details: { cached_tokens: 10 }, output_tokens_details: { reasoning_tokens: 4 } },
  output: [{ type: 'message', content: [{ type: 'output_text', text: 'Plan' }] }] };
const failed = (code, ambiguous) => error => error instanceof ResourceProviderError
  && error.code === code && (ambiguous === undefined || error.ambiguous === ambiguous);
try {
  delete process.env.RESOURCE_COMPUTE_CATALOG;
  assert.deepEqual(providerCatalog(), []);
  process.env.RESOURCE_COMPUTE_CATALOG = JSON.stringify([{ ...entry, key: 'never-public', url: 'https://evil.example' }]);
  assert.deepEqual(providerCatalog(), [entry]);
  for (const value of ['{}', '[null]', '[{"provider":"openai"}]', JSON.stringify([entry, entry]),
    JSON.stringify([{ ...entry, inputUsdMicrosPerMillion: 0 }]),
    JSON.stringify([{ ...entry, model: 'https://evil.example' }]),
    JSON.stringify([{ ...entry, maxInputTokens: 1.1 }])]) {
    process.env.RESOURCE_COMPUTE_CATALOG = value;
    assert.throws(providerCatalog, ResourceProviderError);
  }
  assert.equal(quoteCompute(entry, { inputTokens: 13, maxOutputTokens: 7 }), 28);
  assert.throws(() => quoteCompute(entry, { inputTokens: 2049, maxOutputTokens: 7 }), ResourceProviderError);
  assert.throws(() => quoteCompute(entry, { inputTokens: 13, maxOutputTokens: 65 }), ResourceProviderError);
  delete process.env.RESOURCE_OPENAI_API_KEY;
  await assert.rejects(executeCompute(entry, { prompt: 'hello', maxOutputTokens: 7, requestId: 'job-1' }), failed('provider_unconfigured', false));
  process.env.RESOURCE_OPENAI_API_KEY = 'test-only-not-a-real-key';
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++; assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers['X-Client-Request-Id'], 'job-1');
    assert.deepEqual(JSON.parse(options.body), { model: 'test-model', input: 'hello', max_output_tokens: 7, store: true, stream: false, metadata: { omertaResourceRequestId: 'job-1' } });
    return response(compute);
  };
  assert.deepEqual(await executeCompute(entry, { prompt: 'hello', maxOutputTokens: 7, requestId: 'job-1' }),
    { providerRequestId: 'resp_test', output: 'Plan', inputTokens: 13, outputTokens: 7, costUsdMicros: 28 });
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses/resp_test'); assert.equal(options.method, 'GET');
    return response(compute);
  };
  assert.equal((await fetchComputeReceipt(entry, { providerRequestId: 'resp_test', requestId: 'job-1', maxOutputTokens: 7 })).costUsdMicros, 28);
  for (const changed of [{ metadata: { omertaResourceRequestId: 'other' } }, { model: 'other-model' }, { id: 'resp_other' }]) {
    globalThis.fetch = async () => response({ ...compute, ...changed });
    await assert.rejects(fetchComputeReceipt(entry, { providerRequestId: 'resp_test', requestId: 'job-1', maxOutputTokens: 7 }), error => error.ambiguous);
  }
  globalThis.fetch = async () => new Response('{}', { status: 404 });
  await assert.rejects(fetchComputeReceipt(entry, { providerRequestId: 'resp_test', requestId: 'job-1' }), failed('provider_receipt', true));
  await assert.rejects(fetchComputeReceipt(entry, { providerRequestId: '../secret', requestId: 'job-1' }), failed('invalid_request', false));
  const before = calls;
  for (const request of [{ prompt: 'hello', maxOutputTokens: 7 }, { prompt: 'x'.repeat(2048), maxOutputTokens: 7, requestId: 'job-1' },
    { prompt: 'hello', maxOutputTokens: 65, requestId: 'job-1' }])
    await assert.rejects(executeCompute(entry, request), failed('invalid_request', false));
  const abort = new AbortController(); abort.abort();
  await assert.rejects(executeCompute(entry, { prompt: 'hello', maxOutputTokens: 7, requestId: 'job-1', signal: abort.signal }), failed('cancelled', false));
  assert.equal(calls, before);
  for (const [status, ambiguous] of [[400, false], [401, false], [429, false], [408, true], [409, true], [500, true]]) {
    globalThis.fetch = async () => { calls++; return new Response('{}', { status }); };
    await assert.rejects(executeCompute(entry, { prompt: 'hello', maxOutputTokens: 7, requestId: 'job-1' }), failed('provider_rejected', ambiguous));
  }
  globalThis.fetch = async () => { calls++; throw new Error('secret-bearing remote failure'); };
  const attempts = calls;
  await assert.rejects(executeCompute(entry, { prompt: 'hello', maxOutputTokens: 7, requestId: 'job-1' }), error =>
    failed('provider_unavailable', true)(error) && !error.message.includes('secret-bearing'));
  assert.equal(calls, attempts + 1, 'No automatic retry after ambiguous dispatch');
  for (const data of [{ ...compute, usage: null }, { ...compute, usage: { input_tokens: 2049, output_tokens: 1 } },
    { ...compute, usage: { input_tokens: 13, output_tokens: 8 } }, { ...compute, status: 'failed' }]) {
    globalThis.fetch = async () => response(data);
    await assert.rejects(executeCompute(entry, { prompt: 'hello', maxOutputTokens: 7, requestId: 'job-1' }), error =>
      failed('provider_usage', true)(error) && error.providerRequestId === 'resp_test');
  }
  globalThis.fetch = async () => response({ ...compute, metadata: { omertaResourceRequestId: 'other' } });
  await assert.rejects(executeCompute(entry, { prompt: 'hello', maxOutputTokens: 7, requestId: 'job-1' }), error =>
    error.ambiguous && error.providerRequestId === 'resp_test');
  assert.equal(new ResourceProviderError('test', 'test', { providerRequestId: 'https://evil.example/secret' }).providerRequestId, null);
  await assert.rejects(fetchComputeReceipt({ ...entry, storeResponses: false }, { providerRequestId: 'resp_test', requestId: 'job-1' }), failed('provider_receipt', true));
  globalThis.fetch = async () => new Response('not-json');
  await assert.rejects(executeCompute(entry, { prompt: 'hello', maxOutputTokens: 7, requestId: 'job-1' }), failed('provider_response', true));
  globalThis.fetch = async () => new Response('x'.repeat(1_048_577));
  await assert.rejects(executeCompute(entry, { prompt: 'hello', maxOutputTokens: 7, requestId: 'job-1' }), failed('provider_response', true));

  const payment = { id: 'job-1', amountUsdMicros: 50_000, successUrl: 'https://www.omerta.fun/success', cancelUrl: 'https://www.omerta.fun/cancel' };
  delete process.env.RESOURCE_STRIPE_SECRET_KEY;
  await assert.rejects(createPaymentSession(payment), failed('provider_unconfigured', false));
  process.env.RESOURCE_STRIPE_SECRET_KEY = 'test-only-not-a-real-key';
  const session = { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/test', client_reference_id: 'job-1',
    metadata: { resourcePaymentId: 'job-1' }, amount_total: 5, currency: 'usd' };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(options.headers['Idempotency-Key'], 'resource-job-job-1');
    const form = new URLSearchParams(options.body);
    assert.equal(form.get('metadata[resourcePaymentId]'), 'job-1');
    assert.equal(form.get('payment_intent_data[metadata][resourcePaymentId]'), 'job-1');
    assert.equal(form.get('line_items[0][price_data][unit_amount]'), '5');
    return response(session);
  };
  assert.equal((await createPaymentSession(payment)).sessionId, 'cs_test_1');
  for (const changed of [{ id: undefined }, { amountUsdMicros: 50_001 }, { successUrl: 'http://www.omerta.fun/' },
    { cancelUrl: 'https://user:password@evil.example/' }])
    await assert.rejects(createPaymentSession({ ...payment, ...changed }), failed('invalid_request', false));
  for (const changed of [{ metadata: { resourcePaymentId: 'other' } }, { amount_total: 6 }, { currency: 'eur' },
    { url: 'https://checkout.stripe.com.evil.example/' }, { client_reference_id: 'other' }]) {
    globalThis.fetch = async () => response({ ...session, ...changed });
    await assert.rejects(createPaymentSession(payment), failed('provider_response', true));
  }
  process.env.RESOURCE_STRIPE_WEBHOOK_SECRET = 'test-only-signature-secret';
  const event = { id: 'evt_test', type: 'checkout.session.completed', livemode: false, data: { object: session } };
  const raw = Buffer.from(JSON.stringify(event)); const now = 1_780_000_000_000;
  const signed = (body = raw, time = now / 1000) => `t=${time},v1=${createHmac('sha256', process.env.RESOURCE_STRIPE_WEBHOOK_SECRET).update(`${time}.`).update(body).digest('hex')}`;
  assert.deepEqual(verifyPaymentWebhook(raw, signed(), { now }), event);
  assert.deepEqual(verifyPaymentWebhook(raw, `${signed()},v1=${'0'.repeat(64)}`, { now }), event);
  for (const signature of ['', signed(raw, now / 1000 - 301), signed(raw, now / 1000 + 301),
    `${signed()},t=${now / 1000}`, `t=${now / 1000},v1=${'0'.repeat(64)}`])
    assert.throws(() => verifyPaymentWebhook(raw, signature, { now }), failed('invalid_webhook', false));
  assert.throws(() => verifyPaymentWebhook(Buffer.from(raw.toString() + ' '), signed(), { now }), failed('invalid_webhook', false));
  assert.throws(() => verifyPaymentWebhook(raw.toString(), signed(), { now }), failed('invalid_webhook', false));
  const malformed = Buffer.from('{}');
  assert.throws(() => verifyPaymentWebhook(malformed, signed(malformed), { now }), failed('invalid_webhook', false));
  console.log('resourceproviders: catalog, exact pricing, dispatch ambiguity, settlement binding, and webhook adversarial checks passed');
} finally {
  globalThis.fetch = originalFetch;
  names.forEach((name, index) => { if (previous[index] === undefined) delete process.env[name]; else process.env[name] = previous[index]; });
}
