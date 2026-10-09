#!/usr/bin/env node
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { open, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { evaluateBusiness, compareBusiness, normalizeBusinessPolicy } from '../src/businesspolicy.js';

const MAX_BODY = 1048576;
const clock = { now: () => performance.now(), sleep: ms => new Promise(done => setTimeout(done, ms)) };

function originOf(baseUrl) {
  const url = new URL(baseUrl);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid business origin');
  return url.origin;
}

async function readJson(response) {
  if (!response.ok || !response.body || Number(response.headers.get('content-length')) > MAX_BODY) throw new Error('Business snapshot unavailable');
  const reader = response.body.getReader(); const chunks = []; let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY) { await reader.cancel(); throw new Error('Business snapshot too large'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function boundedRecord(value, token, depth = 0) {
  if (depth > 8) throw new Error('Business record too deep');
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error('Invalid business number'); return value; }
  if (typeof value === 'string') {
    if (value.length > 256 || value.includes(token)) throw new Error('Unsafe business record');
    return value;
  }
  if (Array.isArray(value)) { if (value.length > 100) throw new Error('Business record too large'); return value.map(item => boundedRecord(item, token, depth + 1)); }
  if (!value || typeof value !== 'object') throw new Error('Invalid business record');
  const entries = Object.entries(value);
  if (entries.length > 64) throw new Error('Business record too large');
  const result = {};
  for (const [key, item] of entries) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) || /secret|authorization|question|report|prompt|password|email/i.test(key)
        || /token/i.test(key) && key !== 'maxOutputTokens') throw new Error('Unsafe business record');
    if (item !== undefined) result[key] = boundedRecord(item, token, depth + 1);
  }
  return result;
}

export async function readBusinessRecord(path) {
  const before = await lstat(path);
  if (!before.isFile() || before.isSymbolicLink() || before.size > MAX_BODY) throw new Error('Invalid previous business record');
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const stat = await handle.stat();
    const current = await lstat(path);
    if (!stat.isFile() || !current.isFile() || current.isSymbolicLink()
        || stat.dev !== before.dev || stat.ino !== before.ino || current.dev !== stat.dev || current.ino !== stat.ino
        || stat.size > MAX_BODY) throw new Error('Invalid previous business record');
    const buffer = Buffer.alloc(MAX_BODY + 1); let bytes = 0;
    while (bytes < buffer.length) {
      const read = await handle.read(buffer, bytes, buffer.length - bytes, null);
      if (!read.bytesRead) break;
      bytes += read.bytesRead;
    }
    if (bytes > MAX_BODY) throw new Error('Previous business record too large');
    const record = JSON.parse(buffer.subarray(0, bytes).toString('utf8'));
    if (record?.mode !== 'shadow' || record.financialRequests !== 0 || !Array.isArray(record.samples)
        || record.samples.length < 1 || record.samples.length > 20) throw new Error('Invalid previous business record');
    const evaluation = record.samples.at(-1)?.evaluation;
    if (evaluation?.version !== 1 || evaluation.mode !== 'shadow') throw new Error('Invalid previous business evaluation');
    return boundedRecord(evaluation, '\u0000');
  } finally { await handle.close(); }
}

function observer({ baseUrl = 'https://www.omerta.fun', samples = 1, token = process.env.OMERTA_BUSINESS_TOKEN,
  policy = {}, fetchImpl = fetch, previousEvaluation = null }, timing) {
  const origin = originOf(baseUrl);
  policy = normalizeBusinessPolicy(policy);
  if (!Number.isSafeInteger(samples) || samples < 1 || samples > 20) throw new Error('Invalid sample count');
  if (typeof token !== 'string' || token.length < 8 || token.length > 8192 || /[\s\x00-\x1f]/.test(token)) throw new Error('Business token required');
  let started = -Infinity;
  return async () => {
    const records = []; let previous = previousEvaluation;
    for (let index = 0; index < samples; index++) {
      while (timing.now() - started < 3100) await timing.sleep(3100 - (timing.now() - started));
      started = timing.now();
      const response = await fetchImpl(`${origin}/v1/resources/business`, {
        method: 'GET', redirect: 'error', headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
      if (response.url && new URL(response.url).origin !== origin) throw new Error('Business response origin mismatch');
      const snapshot = await readJson(response);
      const decision = evaluateBusiness(snapshot, policy);
      const comparison = previous ? compareBusiness(previous, snapshot) : null;
      const record = boundedRecord({ evaluation: decision, comparison }, token);
      if (Buffer.byteLength(JSON.stringify(record)) > 65536) throw new Error('Business record too large');
      records.push(record); previous = decision;
    }
    const result = { mode: 'shadow', financialRequests: 0, samples: records };
    if (Buffer.byteLength(JSON.stringify(result)) + 1 > MAX_BODY) throw new Error('Business record too large');
    return result;
  };
}

export const createBusinessObserver = options => observer(options, clock);
export function createBusinessObserverForTest(options, timing) {
  if (typeof timing?.now !== 'function' || typeof timing?.sleep !== 'function') throw new Error('Invalid test clock');
  return observer(options, timing);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = { policy: {} };
  const flags = { '--base': 'baseUrl', '--samples': 'samples', '--previous': 'previousFile', '--provider': 'providerId',
    '--max-output-tokens': 'maxOutputTokens', '--target-margin-bps': 'targetMarginBps',
    '--minimum-margin-usd-micros': 'minimumMarginUsdMicros', '--operating-cost-per-job-usd-micros': 'operatingCostPerJobUsdMicros',
    '--payment-fee-bps': 'paymentFeeBps', '--max-active-jobs': 'maxActiveJobs',
    '--minimum-reserve-usd-micros': 'minimumReserveUsdMicros', '--max-proposals': 'maxProposals', '--work-seconds-per-job':'workSecondsPerJob', '--planning-horizon-seconds':'planningHorizonSeconds',
    '--minimum-renewal-accepted-jobs': 'minimumRenewalAcceptedJobs' };
  try {
    for (let index = 2; index < process.argv.length; index++) {
      const key = flags[process.argv[index]]; const value = process.argv[++index];
      if (!key || !value) throw new Error('Invalid business option');
      if (key === 'baseUrl' || key === 'samples' || key === 'previousFile') options[key] = key === 'samples' ? Number(value) : value;
      else options.policy[key] = key === 'providerId' ? value : Number(value);
    }
    Promise.resolve(options.previousFile ? readBusinessRecord(options.previousFile) : null)
      .then(previousEvaluation => createBusinessObserver({ ...options, previousEvaluation })())
      .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
      .catch(() => { process.stderr.write('business_agent_error\n'); process.exitCode = 1; });
  } catch { process.stderr.write('business_agent_error\n'); process.exitCode = 1; }
}
