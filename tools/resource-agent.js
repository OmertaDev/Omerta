#!/usr/bin/env node
import crypto from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { recommendationOf, runAgentAlpha } from './agent-alpha.js';

const REQUEST_INTERVAL_MS = 3100;
const transportCache = new WeakMap();
const productionClock = { now: () => performance.now(), sleep: ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms)) };

function pacedTransport(origin, fetchImpl, clock = productionClock, cache = true) {
  let origins = transportCache.get(fetchImpl);
  if (cache && origins?.has(origin)) return origins.get(origin);
  const identities = new Map();
  const transport = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    const signal = init.signal || (input instanceof Request ? input.signal : null);
    const authorization = headers.get('authorization');
    if (authorization && url.origin !== origin) throw new Error('Credential origin mismatch');
    if (!authorization) return fetchImpl(input, { ...init, redirect: 'error' });
    let identity = identities.get(authorization);
    if (!identity) { identity = { tail: Promise.resolve(), started: -Infinity }; identities.set(authorization, identity); }
    const dispatch = identity.tail.then(async () => {
      while (clock.now() - identity.started < REQUEST_INTERVAL_MS) {
        if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');
        await clock.sleep(REQUEST_INTERVAL_MS - (clock.now() - identity.started));
      }
      if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');
      identity.started = clock.now();
      return fetchImpl(input, { ...init, redirect: 'error' });
    });
    identity.tail = dispatch.then(() => {}, () => {});
    return dispatch;
  };
  if (cache) {
    if (!origins) { origins = new Map(); transportCache.set(fetchImpl, origins); }
    origins.set(origin, transport);
  }
  return transport;
}

function originOf(baseUrl) {
  const url = new URL(baseUrl);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Resource agent requires a plain HTTP origin');
  }
  return url.origin;
}

function validateOptions(providerId, maxOutputTokens, role) {
  if (typeof providerId !== 'string' || !/^[A-Za-z0-9:_.-]{1,128}$/.test(providerId)) throw new Error('Invalid provider');
  if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 16384) throw new Error('Invalid output limit');
  recommendationOf({}, role);
}

function safeCandidate(turn, candidate, role) {
  if (!candidate || typeof candidate.id !== 'string' || candidate.id.length > 256 || !candidate.id
      || typeof candidate.kind !== 'string' || candidate.kind.length > 64) return false;
  return recommendationOf({ ...turn, recommendedActionId: candidate.id, actions: [candidate] }, role).action === candidate;
}

export function selectLaborBids(board, catalog, { providerId, maxOutputTokens, minimumWorkMarginUsdMicros = 10000, now = Date.now() }) {
  const service = board?.ownService;
  if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 16384
      || !Number.isSafeInteger(minimumWorkMarginUsdMicros) || minimumWorkMarginUsdMicros < 10000
      || minimumWorkMarginUsdMicros > 1_000_000_000_000 || !Number.isFinite(now)) return [];
  if (!service?.enabled || service.kind !== 'market_analysis' || !Number.isSafeInteger(service.revision) || service.revision < 1
      || !Number.isSafeInteger(service.priceUsdMicros) || service.priceUsdMicros < 10000
      || service.priceUsdMicros > 1_000_000_000_000 || service.priceUsdMicros % 10000 !== 0
      || !Number.isSafeInteger(board.availableUsdMicros) || board.availableUsdMicros < 0 || board.availableUsdMicros > 1_000_000_000_000
      || !Number.isSafeInteger(board.minimumReserveUsdMicros) || board.minimumReserveUsdMicros < 0 || board.minimumReserveUsdMicros > 1_000_000_000_000
      || !Number.isSafeInteger(board.sellerActiveJobs) || board.sellerActiveJobs < 0 || board.sellerActiveJobs >= 3
      || !Array.isArray(board.bounties) || board.bounties.length > 100 || !Array.isArray(catalog) || catalog.length > 32) return [];
  const provider = catalog.find(entry => entry?.id === providerId);
  if (!provider || ![provider.maxInputTokens, provider.maxOutputTokens, provider.inputUsdMicrosPerMillion,
    provider.outputUsdMicrosPerMillion].every(value => Number.isSafeInteger(value) && value > 0 && value <= 1_000_000_000_000)
      || provider.maxInputTokens > 1000000 || provider.maxOutputTokens > 100000 || maxOutputTokens > provider.maxOutputTokens) return [];
  const quote = (BigInt(provider.maxInputTokens) * BigInt(provider.inputUsdMicrosPerMillion)
    + BigInt(maxOutputTokens) * BigInt(provider.outputUsdMicrosPerMillion) + 999999n) / 1000000n;
  if (quote > BigInt(board.availableUsdMicros) - BigInt(board.minimumReserveUsdMicros)) return [];
  const minimum = quote + BigInt(minimumWorkMarginUsdMicros);
  if (minimum > 1_000_000_000_000n) return [];
  const priceUsdMicros = Math.max(service.priceUsdMicros, Number((minimum + 9999n) / 10000n * 10000n));
  const existing = new Set(Array.isArray(board.bids) ? board.bids.slice(0, 100).map(bid => bid.bountyId) : []);
  for (const bounty of Array.isArray(board.ownBounties) ? board.ownBounties.slice(0, 100) : []) existing.add(bounty.id);
  return board.bounties.filter(bounty => bounty?.state === 'open' && typeof bounty.id === 'string'
    && /^[A-Za-z0-9_-]{1,128}$/.test(bounty.id) && !existing.has(bounty.id)
    && Number.isSafeInteger(bounty.budgetUsdMicros) && bounty.budgetUsdMicros >= priceUsdMicros
    && bounty.budgetUsdMicros <= 1_000_000_000_000 && Number.isFinite(Date.parse(bounty.expiresAt))
    && Date.parse(bounty.expiresAt) - now >= 60000)
    .map(bounty => ({ bountyId: bounty.id, priceUsdMicros, expectedServiceRevision: service.revision,
      deliverySeconds: 3600,
      expectedMarginUsdMicros: priceUsdMicros - Number(quote), expiresAt: bounty.expiresAt }))
    .sort((a, b) => b.expectedMarginUsdMicros - a.expectedMarginUsdMicros
      || Date.parse(a.expiresAt) - Date.parse(b.expiresAt) || a.bountyId.localeCompare(b.bountyId))
    .slice(0, 3 - board.sellerActiveJobs);
}

function resourceAgentFetch({ baseUrl, fetchImpl = fetch, providerId, maxOutputTokens,
  minExpectedGameCashGain = 100, role = 'general', maxPaidJobs = 0,
  maxLaborBids = 0, minimumWorkMarginUsdMicros = 10000,
  requestIdFactory = crypto.randomUUID, onObservation = () => {} }, clock, cache) {
  const origin = originOf(baseUrl);
  fetchImpl = pacedTransport(origin, fetchImpl, clock, cache);
  validateOptions(providerId, maxOutputTokens, role);
  if (!Number.isFinite(minExpectedGameCashGain) || minExpectedGameCashGain < 0) throw new Error('Invalid gain threshold');
  if (!Number.isSafeInteger(maxPaidJobs) || maxPaidJobs < 0 || maxPaidJobs > 10) throw new Error('Invalid paid work limit');
  if (!Number.isSafeInteger(maxLaborBids) || maxLaborBids < 0 || maxLaborBids > 10) throw new Error('Invalid labor bid limit');
  if (!Number.isSafeInteger(minimumWorkMarginUsdMicros) || minimumWorkMarginUsdMicros < 10000 || minimumWorkMarginUsdMicros > 1_000_000_000_000) throw new Error('Invalid work margin');
  const attemptedBids = new Set();
  const laborPolledTurns = new Set();
  const attempted = new Set();
  const attemptedJobs = new Set();
  const polledTurns = new Set();
  const outcomes = [];
  const observe = event => { try { onObservation(event); } catch { /* Telemetry cannot change gameplay. */ } };
  return async (input, init = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    if (url.origin !== origin && headers.has('authorization')) throw new Error('Credential origin mismatch');
    const response = await fetchImpl(input, { ...init, redirect: 'error' });
    const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (url.origin !== origin || url.pathname !== '/v1/agent/turn' || url.search || method !== 'GET' || !response.ok) return response;
    let turn;
    try { turn = await response.clone().json(); } catch { return response; }
    const bearer = /^Bearer (.+)$/i.exec(headers.get('authorization') || '');
    if (bearer && typeof turn?.turnId === 'string' && !polledTurns.has(turn.turnId) && attemptedJobs.size < maxPaidJobs) {
      polledTurns.add(turn.turnId);
      if (polledTurns.size > 1000) polledTurns.delete(polledTurns.values().next().value);
      try {
        const queue = await fetchImpl(`${origin}/v1/resources/jobs`, { method: 'GET', redirect: 'error', headers: { authorization: headers.get('authorization') } });
        const queueBody = queue.ok ? await queue.json() : null;
        const jobs = queueBody?.assignedJobs ?? queueBody?.jobs;
        if (Array.isArray(jobs) && jobs.length <= 100) {
          for (const job of jobs) {
            if (attemptedJobs.size >= maxPaidJobs) break;
            if (job?.assignedToYou !== true || !['open', 'claimed'].includes(job.state)
                || job.fulfillment !== undefined && job.fulfillment !== 'compute'
                || typeof job.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(job.id) || attemptedJobs.has(job.id)) continue;
            attemptedJobs.add(job.id); // Unknown outcomes consume this run's quota and never retry.
            const result = await runPaidWork({ baseUrl: origin, token: bearer[1], jobId: job.id, providerId, maxOutputTokens, fetchImpl });
            observe({ kind: 'paid_work', jobId: job.id, stage: result.stage, status: result.status || null,
              pending: result.pending === true || result.result?.pending === true, retry: false });
          }
        }
      } catch { observe({ kind: 'paid_work_queue_unavailable', retry: false }); }
    }
    if (bearer && typeof turn?.turnId === 'string' && !laborPolledTurns.has(turn.turnId) && attemptedBids.size < maxLaborBids) {
      laborPolledTurns.add(turn.turnId);
      if (laborPolledTurns.size > 1000) laborPolledTurns.delete(laborPolledTurns.values().next().value);
      try {
        const authorization = headers.get('authorization');
        const boardResponse = await fetchImpl(`${origin}/v1/resources/labor`, { headers: { authorization } });
        const catalogResponse = await fetchImpl(`${origin}/v1/resources/catalog`, {});
        if (boardResponse.ok && catalogResponse.ok) {
          const board = await boardResponse.json();
          const catalog = await catalogResponse.json();
          for (const bid of selectLaborBids(board, catalog.capabilities, { providerId, maxOutputTokens, minimumWorkMarginUsdMicros })) {
            if (attemptedBids.size >= maxLaborBids) break;
            if (attemptedBids.has(bid.bountyId)) continue;
            attemptedBids.add(bid.bountyId); // Unknown outcomes consume quota; never resubmit blindly.
            let status = null;
            try {
              const result = await fetchImpl(`${origin}/v1/resources/bounties/${bid.bountyId}/bid`, {
                method: 'POST', headers: { authorization, 'content-type': 'application/json' },
                body: JSON.stringify({ priceUsdMicros: bid.priceUsdMicros, deliverySeconds: bid.deliverySeconds,
                  expectedServiceRevision: bid.expectedServiceRevision }) });
              status = result.status;
            } catch { /* Preserve unknown submission as an attempted bid. */ }
            observe({ kind: 'labor_bid', bountyId: bid.bountyId, priceUsdMicros: bid.priceUsdMicros,
              expectedMarginUsdMicros: bid.expectedMarginUsdMicros, status, retry: false });
          }
        }
      } catch { observe({ kind: 'labor_board_unavailable', retry: false }); }
    }
    const cash = turn?.state?.resources?.cash;
    for (let i = outcomes.length - 1; i >= 0; i--) {
      const pending = outcomes[i];
      if (typeof turn?.turnId !== 'string' || pending.seen.has(turn.turnId)) continue;
      pending.seen.add(turn.turnId);
      pending.rounds++;
      if (pending.rounds === 4) {
        observe({ kind: 'compute_outcome', callId: pending.callId, subsequentTurns: 4,
          gameCashChange: Number.isFinite(cash) && Number.isFinite(pending.cash) ? cash - pending.cash : null,
          costUsdMicros: pending.costUsdMicros, evidence: 'observational', causalEffect: null });
        outcomes.splice(i, 1);
      }
    }
    if (!headers.has('authorization') || typeof turn?.turnId !== 'string' || !turn.turnId || attempted.has(turn.turnId)
        || !Array.isArray(turn.actions) || turn.actions.length > 1000) return response;
    const candidates = turn.actions.filter(candidate => safeCandidate(turn, candidate, role));
    if (candidates.length < 2 || candidates.length > 32 || new Set(candidates.map(c => c.id)).size !== candidates.length
        || !Number.isFinite(candidates[0]?.ev?.cash) || candidates[0].ev.cash < minExpectedGameCashGain) return response;
    // Keep all unactionable descriptors, labels, bodies, and paths out of the model prompt.
    const descriptors = candidates.map(({ id, kind, ev }) => ({ id, kind,
      estimates: Object.fromEntries(['cash', 'treasury', 'inventory', 'liability', 'respect', 'confidence']
        .filter(key => Number.isFinite(ev?.[key])).map(key => [key, ev[key]])) }));
    const prompt = `Select one existing action for this game decision. Return only JSON {"actionId":"existing-id"}. Game cash is not external money. Candidates: ${JSON.stringify(descriptors)}`;
    attempted.add(turn.turnId);
    if (attempted.size > 1000) attempted.delete(attempted.values().next().value);
    try {
      const computed = await fetchImpl(`${origin}/v1/resources/compute`, {
        method: 'POST', redirect: 'error', headers: { authorization: headers.get('authorization'), 'content-type': 'application/json' },
        body: JSON.stringify({ requestId: requestIdFactory(), providerId, maxOutputTokens, prompt,
          purpose: { kind: 'game_decision', turnId: turn.turnId, baselineActionId: turn.recommendedActionId } }),
      });
      if (!computed.ok) { observe({ kind: 'compute_unavailable', status: computed.status }); return response; }
      const { call } = await computed.json();
      if (!call || typeof call.id !== 'string' || !Number.isSafeInteger(call.costUsdMicros) || call.costUsdMicros < 0) return response;
      observe({ kind: 'compute_call', callId: call.id, costUsdMicros: call.costUsdMicros });
      outcomes.push({ callId: call.id, costUsdMicros: call.costUsdMicros, cash, rounds: 0, seen: new Set([turn.turnId]) });
      let choice;
      try { choice = typeof call.output === 'string' ? JSON.parse(call.output) : null; } catch { return response; }
      if (!choice || Array.isArray(choice) || Object.keys(choice).length !== 1 || typeof choice.actionId !== 'string') return response;
      const chosen = candidates.find(candidate => candidate.id === choice.actionId);
      if (!chosen || !safeCandidate(turn, chosen, role)) return response;
      const modified = { ...turn, recommendedActionId: chosen.id, actions: [chosen, ...turn.actions.filter(c => c !== chosen)] };
      const responseHeaders = new Headers(response.headers);
      responseHeaders.delete('content-length');
      responseHeaders.delete('content-encoding');
      return new Response(JSON.stringify(modified), { status: response.status, statusText: response.statusText, headers: responseHeaders });
    } catch { observe({ kind: 'compute_unknown', retry: false }); return response; }
  };
}

export function createResourceAgentFetch(options) {
  return resourceAgentFetch(options, productionClock, true);
}

// Only this explicitly named test constructor accepts a fake monotonic clock.
export function createResourceAgentTestFetch(options, { now, sleep }) {
  if (typeof now !== 'function' || typeof sleep !== 'function') throw new Error('Resource test timing requires now and sleep');
  return resourceAgentFetch(options, { now, sleep }, false);
}

export async function runResourceAgent(options) {
  const resourceObservations = [];
  const onObservation = event => {
    if (resourceObservations.length >= 1000) resourceObservations.shift();
    resourceObservations.push(event);
    options.onObservation?.(event);
  };
  const result = await runAgentAlpha({ ...options, fetchImpl: createResourceAgentFetch({ ...options, onObservation }) });
  return { ...result, resourceObservations };
}

export async function runPaidWork({ baseUrl, token, jobId, providerId, maxOutputTokens, fetchImpl = fetch }) {
  const origin = originOf(baseUrl);
  if (fetchImpl === globalThis.fetch) fetchImpl = pacedTransport(origin, fetchImpl);
  validateOptions(providerId, maxOutputTokens, 'general');
  if (typeof token !== 'string' || !token || typeof jobId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(jobId)) throw new Error('Invalid work identity');
  const post = (path, body) => fetchImpl(`${origin}${path}`, { method: 'POST', redirect: 'error',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let stage = 'claim';
  try {
    const claim = await post(`/v1/resources/jobs/${jobId}/claim`, {});
    const claimed = await claim.json();
    if (!claim.ok) return { stage, status: claim.status, result: claimed, retry: false };
    if (claim.status === 202 || claimed?.pending === true || claimed?.job?.status === 'pending') {
      return { stage, status: claim.status, result: claimed, pending: true, retry: false };
    }
    stage = 'work';
    const work = await post(`/v1/resources/jobs/${jobId}/work`, { requestId: crypto.randomUUID(), providerId, maxOutputTokens });
    return { stage, status: work.status, result: await work.json(), retry: false };
  } catch { return { stage, pending: true, retry: false }; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = { baseUrl: process.env.OMERTA_BASE_URL || 'https://www.omerta.fun' };
  const flags = { '--base': 'baseUrl', '--session': 'sessionFile', '--report': 'reportFile', '--role': 'role',
    '--provider': 'providerId', '--max-output-tokens': 'maxOutputTokens', '--max-actions': 'maxActions', '--max-paid-jobs': 'maxPaidJobs',
    '--max-labor-bids': 'maxLaborBids', '--minimum-work-margin-usd-micros': 'minimumWorkMarginUsdMicros' };
  try {
    for (let i = 2; i < process.argv.length; i++) {
      const key = flags[process.argv[i]];
      if (!key || !process.argv[i + 1]) throw new Error('Invalid option');
      options[key] = ['maxOutputTokens', 'maxActions', 'maxPaidJobs', 'maxLaborBids', 'minimumWorkMarginUsdMicros'].includes(key) ? Number(process.argv[++i]) : process.argv[++i];
    }
    runResourceAgent(options).then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
      .catch(() => { process.stderr.write('resource_agent_error\n'); process.exitCode = 1; });
  } catch { process.stderr.write('resource_agent_error\n'); process.exitCode = 1; }
}
