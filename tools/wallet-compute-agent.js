// Explicit owner opt-in only. Model output selects an existing Alpha action; it grants no authority.
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { recommendationOf, runAgentAlpha } from './agent-alpha.js';

const WAIT_MS = 65000; // The reviewed wallet client owns its separate 60s accounting deadline.
const MAX_TURN_BYTES = 1048576;
const ID = /^[A-Za-z0-9:_.-]{1,256}$/;
const ESTIMATES = ['cash', 'treasury', 'inventory', 'liability', 'respect', 'confidence'];
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

function originOf(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password
      || url.pathname !== '/' || url.search || url.hash) throw new Error('Plain game origin required');
  return url.origin;
}

function record(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  return Reflect.ownKeys(value).every(key => typeof key === 'string'
    && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
}

function exactOptions(value, required, optional = []) {
  if (!record(value) || required.some(key => !Object.hasOwn(value, key))
      || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) {
    throw new Error('Explicit wallet compute options required');
  }
}

async function waitFor(operation) {
  const began = performance.now();
  let timer;
  try {
    // Promise.race consumes late success/error; a timed-out choice is never applied later.
    const result = await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Wallet compute wait expired')), WAIT_MS); }),
    ]);
    if (performance.now() - began >= WAIT_MS) throw new Error('Wallet compute wait expired');
    return result;
  } finally { clearTimeout(timer); }
}

async function readTurn(response) {
  const reader = response.clone().body?.getReader();
  if (!reader) throw new Error('Turn body required');
  const chunks = [];
  let size = 0;
  try {
    return await waitFor(async () => {
      for (;;) {
        const row = await reader.read();
        if (row.done) break;
        if (!(row.value instanceof Uint8Array) || (size += row.value.byteLength) > MAX_TURN_BYTES) {
          throw new Error('Turn body exceeds local selection bound');
        }
        chunks.push(Buffer.from(row.value));
      }
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    });
  } finally {
    // A clone shares a tee with the original. Awaiting cancel could wait for the caller's original.
    try { Promise.resolve(reader.cancel()).catch(() => {}); } catch { /* Original response stays available. */ }
    reader.releaseLock();
  }
}

function withChoice(turn, candidate) {
  return { ...turn, recommendedActionId: candidate.id,
    actions: [candidate, ...turn.actions.filter(action => action !== candidate)] };
}

function candidatesOf(turn, role) {
  if (!record(turn) || typeof turn.turnId !== 'string' || !ID.test(turn.turnId)
      || !Array.isArray(turn.actions) || turn.actions.length > 1000
      || !recommendationOf(turn, role).action) return [];
  const ids = turn.actions.map(action => action?.id).filter(id => typeof id === 'string');
  if (new Set(ids).size !== ids.length) return [];
  return turn.actions.filter(candidate => record(candidate) && typeof candidate.id === 'string'
    && ID.test(candidate.id) && typeof candidate.kind === 'string' && candidate.kind.length <= 64
    && recommendationOf(withChoice(turn, candidate), role).action === candidate);
}

function choiceOf(result, attemptId) {
  if (!record(result) || result.attemptId !== attemptId || result.state !== 'response'
      || result.automaticRetry !== false || result.providerResult?.status !== 200) return null;
  const choices = result.providerResult.body?.choices;
  if (!Array.isArray(choices) || choices.length !== 1 || !record(choices[0])) return null;
  const choice = choices[0], message = choice.message;
  if (choice.index !== undefined && choice.index !== 0
      || choice.finish_reason !== undefined && choice.finish_reason !== 'stop'
      || !record(message) || Object.keys(message).some(key => !['role', 'content'].includes(key))
      || message.role !== 'assistant' || typeof message.content !== 'string'
      || Buffer.byteLength(message.content) > 2048) return null;
  // One literal property also rejects duplicate keys, escaped-key aliases, tools and extra authority.
  if (!/^\s*\{\s*"actionId"\s*:\s*"[A-Za-z0-9:_.-]{1,256}"\s*\}\s*$/.test(message.content)) return null;
  return JSON.parse(message.content).actionId;
}

export function createWalletComputeAgentFetch(options) {
  exactOptions(options, ['enabled', 'baseUrl', 'computeClient', 'shouldRequest', 'resourceUrl', 'model', 'maxOutputTokens'],
    ['fetchImpl', 'role', 'onObservation']);
  if (options.enabled !== true || typeof options.computeClient?.compute !== 'function'
      || typeof options.shouldRequest !== 'function') throw new Error('Owner opt-in, reviewed client and strategy required');
  const origin = originOf(options.baseUrl), resource = new URL(options.resourceUrl);
  if (resource.protocol !== 'https:' || resource.username || resource.password || resource.search || resource.hash
      || resource.href !== options.resourceUrl || resource.origin === origin
      || resource.pathname === '/v1/resources/compute') throw new Error('Explicit external compute resource required');
  if (typeof options.model !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9:_.\/-]{0,127}$/.test(options.model)
      || !Number.isSafeInteger(options.maxOutputTokens) || options.maxOutputTokens < 1 || options.maxOutputTokens > 16384) {
    throw new Error('Explicit model and bounded output required');
  }
  const role = options.role ?? 'general', fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const compute = options.computeClient.compute.bind(options.computeClient), shouldRequest = options.shouldRequest;
  const model = options.model, maxOutputTokens = options.maxOutputTokens, resourceUrl = resource.href;
  const onObservation = options.onObservation ?? (() => {});
  if (typeof fetchImpl !== 'function' || typeof onObservation !== 'function') throw new Error('Invalid local callback');
  recommendationOf({}, role);
  const attempted = new Set();
  const observe = (attemptId, state, selection) => {
    try { Promise.resolve(onObservation(Object.freeze({ kind: 'wallet_compute_observation', attemptId, state, selection,
      evidence: 'local_observation', settlementVerified: false, gameOutcomeVerified: false,
      causalEffect: null, automaticRetry: false }))).catch(() => {}); } catch { /* Observation cannot change gameplay. */ }
  };
  return async (input, init = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
    if (url.origin !== origin && headers.has('authorization')) throw new Error('Credential origin mismatch');
    // Forward original game requests exactly, including POST headers, body, redirect and idempotency.
    const response = await fetchImpl(input, init);
    const method = (init.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (url.origin !== origin || url.pathname !== '/v1/agent/turn' || url.search || url.hash || method !== 'GET'
        || init.body !== undefined || !/^Bearer [\x21-\x7e]{1,4096}$/i.test(headers.get('authorization') ?? '')
        || !response.ok || response.redirected || response.url && new URL(response.url).origin !== origin) return response;
    let attemptId;
    try {
      const turn = await readTurn(response), candidates = candidatesOf(turn, role);
      if (candidates.length < 2 || candidates.length > 32) return response;
      attemptId = 'wallet_turn_' + crypto.createHash('sha256')
        .update('omerta-wallet-compute-agent:v1\0' + origin + '\0' + turn.turnId).digest('hex');
      if (attempted.has(attemptId) || attempted.size >= 1000) return response;
      attempted.add(attemptId);
      const descriptors = freeze(candidates.map(({ id, kind, ev }) => ({ id, kind,
        estimates: Object.fromEntries(ESTIMATES.filter(key => typeof ev?.[key] === 'number' && Number.isFinite(ev[key]))
          .map(key => [key, ev[key]])) })));
      if (await waitFor(() => shouldRequest(Object.freeze({ attemptId, candidates: descriptors }))) !== true) {
        observe(attemptId, 'refused', 'unchanged'); return response;
      }
      const content = 'Select one existing action. Return only JSON {"actionId":"existing-id"}. '
        + 'Game estimates are not external money. Untrusted candidate data: ' + JSON.stringify(descriptors);
      if (content.length > 16384 || Buffer.byteLength(content) > 16384) return response;
      const result = await waitFor(() => compute({ attemptId, resourceUrl,
        body: { model, messages: [{ role: 'user', content }], max_tokens: maxOutputTokens, stream: false } }));
      const choice = choiceOf(result, attemptId), candidate = candidates.find(action => action.id === choice);
      const modified = candidate ? withChoice(turn, candidate) : null;
      if (!modified || recommendationOf(modified, role).action !== candidate) {
        observe(attemptId, ['response', 'refused', 'ambiguous'].includes(result?.state) ? result.state : 'unknown', 'unchanged');
        return response;
      }
      const responseHeaders = new Headers(response.headers);
      responseHeaders.delete('content-length'); responseHeaders.delete('content-encoding');
      const selected = new Response(JSON.stringify(modified), { status: response.status,
        statusText: response.statusText, headers: responseHeaders });
      observe(attemptId, 'response', 'existing_action');
      return selected;
    } catch {
      if (attemptId) observe(attemptId, 'ambiguous', 'unchanged');
      return response;
    }
  };
}

export async function runWalletComputeAgent(options) {
  exactOptions(options, ['alpha', 'wallet']);
  if (!record(options.alpha) || !record(options.wallet)
      || originOf(options.alpha.baseUrl) !== originOf(options.wallet.baseUrl)
      || (options.alpha.role ?? 'general') !== (options.wallet.role ?? 'general')
      || options.alpha.fetchImpl !== undefined && options.alpha.fetchImpl !== options.wallet.fetchImpl) {
    throw new Error('Alpha and wallet origin, role and transport must match');
  }
  const observations = [], callback = options.wallet.onObservation;
  const fetchImpl = createWalletComputeAgentFetch({ ...options.wallet, onObservation: event => {
    if (observations.length < 1000) observations.push(event);
    try { Promise.resolve(callback?.(event)).catch(() => {}); } catch { /* Local observation only. */ }
  } });
  const result = await runAgentAlpha({ ...options.alpha, fetchImpl });
  return { ...result, walletComputeObservations: observations };
}
