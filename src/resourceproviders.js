// External settlement boundaries. Pricing is operator supplied, never inferred from model names.
import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_MONEY = 1_000_000_000_000;
const MAX_BODY = 1_048_576;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/;
export class ResourceProviderError extends Error {
  constructor(code, message, { ambiguous = false, status = null, providerRequestId = null } = {}) {
    super(message); this.name = 'ResourceProviderError'; this.code = code;
    this.ambiguous = ambiguous; this.status = status;
    this.providerRequestId = typeof providerRequestId === 'string' && /^resp_[a-zA-Z0-9_-]{1,120}$/.test(providerRequestId) ? providerRequestId : null;
  }
}
function reject(code, message, options) { throw new ResourceProviderError(code, message, options); }
function integer(value, max, name) {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) reject('invalid_request', `Invalid ${name}.`);
  return value;
}
function entryValue(entry) {
  if (!entry || entry.provider !== 'openai' || typeof entry.id !== 'string' || typeof entry.model !== 'string' || !ID.test(entry.id) || !ID.test(entry.model))
    reject('invalid_catalog', 'Invalid compute provider entry.');
  if (entry.storeResponses !== undefined && typeof entry.storeResponses !== 'boolean') reject('invalid_catalog', 'Invalid response retention setting.');
  return Object.freeze({ id: entry.id, model: entry.model, provider: 'openai',
    storeResponses: entry.storeResponses === true,
    inputUsdMicrosPerMillion: integer(entry.inputUsdMicrosPerMillion, MAX_MONEY, 'input rate'),
    outputUsdMicrosPerMillion: integer(entry.outputUsdMicrosPerMillion, MAX_MONEY, 'output rate'),
    maxInputTokens: integer(entry.maxInputTokens, 1_000_000, 'input limit'),
    maxOutputTokens: integer(entry.maxOutputTokens, 100_000, 'output limit') });
}
export function providerCatalog() {
  const raw = process.env.RESOURCE_COMPUTE_CATALOG;
  if (!raw) return [];
  if (Buffer.byteLength(raw) > 32_768) reject('invalid_catalog', 'Compute catalog is too large.');
  let entries; try { entries = JSON.parse(raw); } catch { reject('invalid_catalog', 'Invalid compute catalog JSON.'); }
  if (!Array.isArray(entries) || entries.length > 32) reject('invalid_catalog', 'Invalid compute catalog.');
  const catalog = entries.map(entryValue);
  if (new Set(catalog.map(e => e.id)).size !== catalog.length) reject('invalid_catalog', 'Duplicate compute provider.');
  return catalog;
}
export function quoteCompute(entry, { inputTokens, maxOutputTokens }) {
  const e = entryValue(entry);
  integer(inputTokens, e.maxInputTokens, 'input tokens'); integer(maxOutputTokens, e.maxOutputTokens, 'output tokens');
  const numerator = BigInt(inputTokens) * BigInt(e.inputUsdMicrosPerMillion)
    + BigInt(maxOutputTokens) * BigInt(e.outputUsdMicrosPerMillion);
  const cost = (numerator + 999_999n) / 1_000_000n;
  if (cost > BigInt(MAX_MONEY)) reject('invalid_request', 'Compute cost exceeds the monetary limit.');
  return Number(cost);
}
async function remoteJson(url, options, signal) {
  if (signal?.aborted) reject('cancelled', 'Request cancelled before dispatch.');
  const deadline = AbortSignal.timeout(30_000);
  let response;
  try {
    response = await fetch(url, { ...options, redirect: 'error', signal: signal ? AbortSignal.any([signal, deadline]) : deadline });
    const length = Number(response.headers.get('content-length'));
    if (length > MAX_BODY) reject('provider_response', 'Provider response exceeds the limit.', { ambiguous: true });
    if (!response.body) reject('provider_response', 'Provider response is empty.', { ambiguous: true });
    const reader = response.body.getReader(); const chunks = []; let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_BODY) { await reader.cancel(); reject('provider_response', 'Provider response exceeds the limit.', { ambiguous: true }); }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
    // A server error can occur after a charge: never release a reservation automatically.
    if (!response.ok) reject('provider_rejected', 'External provider rejected the request.',
      { ambiguous: response.status >= 500 || response.status === 408 || response.status === 409, status: response.status });
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { reject('provider_response', 'Provider returned invalid JSON.', { ambiguous: true }); }
  } catch (error) {
    if (error instanceof ResourceProviderError) throw error;
    reject('provider_unavailable', 'Provider completion is unknown; reconcile before retrying.', { ambiguous: true });
  }
}
export async function executeCompute(entry, { prompt, maxOutputTokens, requestId, signal } = {}) {
  const e = entryValue(entry);
  if (typeof prompt !== 'string' || !prompt.trim() || Buffer.byteLength(prompt) + 1024 > e.maxInputTokens || typeof requestId !== 'string' || !ID.test(requestId))
    reject('invalid_request', 'Invalid compute prompt or request identity.');
  integer(maxOutputTokens, e.maxOutputTokens, 'output tokens');
  const key = process.env.RESOURCE_OPENAI_API_KEY;
  if (!key) reject('provider_unconfigured', 'Compute provider is not configured.');
  const data = await remoteJson('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Client-Request-Id': requestId },
    body: JSON.stringify({ model: e.model, input: prompt, max_output_tokens: maxOutputTokens, store: e.storeResponses, stream: false,
      metadata: { omertaResourceRequestId: requestId } })
  }, signal);
  return computeReceipt(e, data, { requestId, maxOutputTokens });
}
function computeReceipt(e, data, { requestId, maxOutputTokens }) {
  const usage = data?.usage;
  const providerRequestId = data?.id;
  if (typeof data?.id !== 'string' || !ID.test(data.id) || !usage
    || data.metadata?.omertaResourceRequestId !== requestId || typeof data.model !== 'string'
    || (data.model !== e.model && !data.model.startsWith(`${e.model}-`))
    || !Number.isSafeInteger(usage.input_tokens) || usage.input_tokens < 1 || usage.input_tokens > e.maxInputTokens
    || !Number.isSafeInteger(usage.output_tokens) || usage.output_tokens < 0 || usage.output_tokens > maxOutputTokens
    || !Array.isArray(data.output) || !['completed', 'incomplete'].includes(data.status))
    reject('provider_usage', 'Provider usage or completion requires reconciliation.', { ambiguous: true, providerRequestId });
  const output = data.output.flatMap(item => item.type === 'message' && Array.isArray(item.content)
    ? item.content.filter(part => part.type === 'output_text' && typeof part.text === 'string').map(part => part.text) : []).join('\n');
  // Charge all input tokens (including cached input) and reasoning/output tokens conservatively.
  const numerator = BigInt(usage.input_tokens) * BigInt(e.inputUsdMicrosPerMillion)
    + BigInt(usage.output_tokens) * BigInt(e.outputUsdMicrosPerMillion);
  const cost = (numerator + 999_999n) / 1_000_000n;
  if (cost > BigInt(MAX_MONEY)) reject('provider_usage', 'Provider cost requires reconciliation.', { ambiguous: true, providerRequestId });
  return { providerRequestId: data.id, output, inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens, costUsdMicros: Number(cost) };
}
export async function fetchComputeReceipt(entry, { providerRequestId, requestId, maxOutputTokens, signal } = {}) {
  const e = entryValue(entry);
  if (!e.storeResponses) reject('provider_receipt', 'Provider response retention is disabled; reconcile externally.', { ambiguous: true });
  if (typeof providerRequestId !== 'string' || !/^resp_[a-zA-Z0-9_-]{1,120}$/.test(providerRequestId)
    || typeof requestId !== 'string' || !ID.test(requestId)) reject('invalid_request', 'Invalid compute receipt identity.');
  const limit = maxOutputTokens === undefined ? e.maxOutputTokens : integer(maxOutputTokens, e.maxOutputTokens, 'output tokens');
  const key = process.env.RESOURCE_OPENAI_API_KEY;
  if (!key) reject('provider_unconfigured', 'Compute provider is not configured.');
  let data;
  try {
    data = await remoteJson(`https://api.openai.com/v1/responses/${encodeURIComponent(providerRequestId)}`, {
      method: 'GET', headers: { Authorization: `Bearer ${key}` }
    }, signal);
  } catch (error) {
    if (error instanceof ResourceProviderError && error.code !== 'provider_unconfigured' && error.code !== 'invalid_request')
      reject('provider_receipt', 'Compute receipt is unresolved; retain its reservation.', { ambiguous: true, status: error.status });
    throw error;
  }
  if (data.id !== providerRequestId) reject('provider_receipt', 'Compute receipt identity mismatch.', { ambiguous: true });
  return computeReceipt(e, data, { requestId, maxOutputTokens: limit });
}
function returnUrl(value) {
  if (typeof value !== 'string') reject('invalid_request', 'Invalid payment return URL.');
  let url; try { url = new URL(value); } catch { reject('invalid_request', 'Invalid payment return URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || value.length > 2048)
    reject('invalid_request', 'Payment return URL must use HTTPS.');
  return url.href;
}
export async function createPaymentSession({ id, amountUsdMicros, successUrl, cancelUrl } = {}) {
  if (typeof id !== 'string' || !ID.test(id)) reject('invalid_request', 'Invalid payment identity.');
  integer(amountUsdMicros, MAX_MONEY, 'payment amount');
  if (amountUsdMicros % 10_000 !== 0) reject('invalid_request', 'Payment amount must be exact USD cents.');
  const success = returnUrl(successUrl), cancel = returnUrl(cancelUrl);
  const key = process.env.RESOURCE_STRIPE_SECRET_KEY;
  if (!key) reject('provider_unconfigured', 'Payment provider is not configured.');
  const form = new URLSearchParams({ mode: 'payment', success_url: success, cancel_url: cancel,
    client_reference_id: id, 'metadata[resourcePaymentId]': id, 'payment_intent_data[metadata][resourcePaymentId]': id,
    'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(amountUsdMicros / 10_000),
    'line_items[0][price_data][product_data][name]': 'Omerta agent service' });
  const data = await remoteJson('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `resource-job-${id}` }, body: form.toString()
  });
  let checkout; try { checkout = new URL(data.url); } catch { /* fail below */ }
  if (typeof data.id !== 'string' || !/^cs_[a-zA-Z0-9_]+$/.test(data.id) || !checkout
    || checkout.protocol !== 'https:' || checkout.hostname !== 'checkout.stripe.com' || checkout.username || checkout.password
    || data.client_reference_id !== id || data.metadata?.resourcePaymentId !== id
    || data.amount_total !== amountUsdMicros / 10_000 || data.currency !== 'usd')
    reject('provider_response', 'Payment session binding requires reconciliation.', { ambiguous: true });
  return { sessionId: data.id, url: checkout.href, amountUsdMicros };
}
export function verifyPaymentWebhook(rawBuffer, signature, { now = Date.now() } = {}) {
  const secret = process.env.RESOURCE_STRIPE_WEBHOOK_SECRET;
  if (!secret) reject('provider_unconfigured', 'Webhook verifier is not configured.');
  if (!Buffer.isBuffer(rawBuffer) || !rawBuffer.length || rawBuffer.length > MAX_BODY
    || typeof signature !== 'string' || signature.length > 4096 || !Number.isFinite(now))
    reject('invalid_webhook', 'Invalid webhook body or signature.');
  const fields = signature.split(',').map(field => field.trim().split('='));
  const timestamps = fields.filter(([key]) => key === 't');
  if (timestamps.length !== 1 || !/^\d{1,12}$/.test(timestamps[0][1])) reject('invalid_webhook', 'Invalid webhook timestamp.');
  const timestamp = Number(timestamps[0][1]);
  if (Math.abs(now / 1000 - timestamp) > 300) reject('invalid_webhook', 'Webhook timestamp outside tolerance.');
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBuffer).digest();
  const valid = fields.some(([key, value]) => key === 'v1' && /^[a-fA-F0-9]{64}$/.test(value || '')
    && timingSafeEqual(expected, Buffer.from(value, 'hex')));
  if (!valid) reject('invalid_webhook', 'Invalid webhook signature.');
  let event; try { event = JSON.parse(rawBuffer.toString('utf8')); } catch { reject('invalid_webhook', 'Invalid webhook JSON.'); }
  if (!event || typeof event.id !== 'string' || !/^evt_[a-zA-Z0-9_]+$/.test(event.id)
    || typeof event.type !== 'string' || !event.data?.object || typeof event.livemode !== 'boolean')
    reject('invalid_webhook', 'Invalid webhook event.');
  return event;
}
