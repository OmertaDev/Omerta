#!/usr/bin/env node
import crypto from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recommendationOf, runAgentAlpha } from './agent-alpha.js';

function originOf(baseUrl) {
  const url = new URL(baseUrl);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Resource agent requires a plain HTTP origin');
  }
  return url.origin;
}

function validateOptions(providerId, maxOutputTokens, role) {
  if (typeof providerId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(providerId)) throw new Error('Invalid provider');
  if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > 16384) throw new Error('Invalid output limit');
  recommendationOf({}, role);
}

function safeCandidate(turn, candidate, role) {
  if (!candidate || typeof candidate.id !== 'string' || candidate.id.length > 256 || !candidate.id
      || typeof candidate.kind !== 'string' || candidate.kind.length > 64) return false;
  return recommendationOf({ ...turn, recommendedActionId: candidate.id, actions: [candidate] }, role).action === candidate;
}

export function createResourceAgentFetch({ baseUrl, fetchImpl = fetch, providerId, maxOutputTokens,
  minExpectedGameCashGain = 100, role = 'general', requestIdFactory = crypto.randomUUID, onObservation = () => {} }) {
  const origin = originOf(baseUrl);
  validateOptions(providerId, maxOutputTokens, role);
  if (!Number.isFinite(minExpectedGameCashGain) || minExpectedGameCashGain < 0) throw new Error('Invalid gain threshold');
  const attempted = new Set();
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

export async function runResourceAgent(options) {
  return runAgentAlpha({ ...options, fetchImpl: createResourceAgentFetch(options) });
}

export async function runPaidWork({ baseUrl, token, jobId, providerId, maxOutputTokens, fetchImpl = fetch }) {
  const origin = originOf(baseUrl);
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
    '--provider': 'providerId', '--max-output-tokens': 'maxOutputTokens', '--max-actions': 'maxActions' };
  try {
    for (let i = 2; i < process.argv.length; i++) {
      const key = flags[process.argv[i]];
      if (!key || !process.argv[i + 1]) throw new Error('Invalid option');
      options[key] = ['maxOutputTokens', 'maxActions'].includes(key) ? Number(process.argv[++i]) : process.argv[++i];
    }
    runResourceAgent(options).then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
      .catch(() => { process.stderr.write('resource_agent_error\n'); process.exitCode = 1; });
  } catch { process.stderr.write('resource_agent_error\n'); process.exitCode = 1; }
}
