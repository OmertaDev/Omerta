#!/usr/bin/env node
import { open, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_TEXT = 65536;
const MAX_RESPONSE = 1048576;
const clock = { now: () => performance.now(), wallNow: () => Date.now(), sleep: ms => new Promise(done => setTimeout(done, ms)) };

export async function readAuthoredText(path) {
  const before = await lstat(path);
  if (!before.isFile() || before.isSymbolicLink() || before.size > MAX_TEXT) throw new Error('Invalid deliverable file');
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const stat = await handle.stat(); const current = await lstat(path);
    if (!stat.isFile() || !current.isFile() || current.isSymbolicLink() || stat.size > MAX_TEXT
        || stat.dev !== before.dev || stat.ino !== before.ino || current.dev !== stat.dev || current.ino !== stat.ino
        || stat.size !== before.size || current.size !== stat.size) throw new Error('Invalid deliverable file');
    const buffer = Buffer.alloc(MAX_TEXT + 1); let bytes = 0;
    while (bytes < buffer.length) {
      const result = await handle.read(buffer, bytes, buffer.length - bytes, null);
      if (!result.bytesRead) break;
      bytes += result.bytesRead;
    }
    const after = await handle.stat();
    if (bytes > MAX_TEXT || bytes !== stat.size || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs) throw new Error('Invalid deliverable file');
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer.subarray(0, bytes));
    if (!text.trim()) throw new Error('Invalid deliverable file');
    return text;
  } finally { await handle.close(); }
}

function runner({ baseUrl, jobId, file, token = process.env.OMERTA_RESOURCE_TOKEN, fetchImpl = fetch }, timing) {
  const url = new URL(baseUrl);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Invalid delivery origin');
  if (typeof jobId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(jobId)) throw new Error('Invalid job');
  if (typeof token !== 'string' || token.length < 8 || token.length > 8192 || /[\s\x00-\x1f]/.test(token)) throw new Error('Resource token required');
  if (jobId.includes(token)) throw new Error('Invalid job');
  let started = -Infinity; let used = false;
  return async () => {
    let stage = 'file'; let status = null; let state = null; let mutationDispatched = false; let confirmed = false;
    const receipt = pending => ({ jobId, state, stage, status, confirmed, pending, retry: false });
    if (used) return receipt(false);
    used = true;
    const request = async (path, body, beforeDispatch = () => {}) => {
      mutationDispatched = false;
      const target = new URL(path, url.origin);
      if (target.origin !== url.origin) throw new Error('Invalid origin');
      while (timing.now() - started < 3100) await timing.sleep(3100 - (timing.now() - started));
      beforeDispatch();
      started = timing.now();
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        mutationDispatched = body !== undefined;
        const response = await fetchImpl(target.href, { method: body === undefined ? 'GET' : 'POST', redirect: 'error',
          headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal });
        status = response.status;
        if (!response.ok || response.redirected || response.url && new URL(response.url).origin !== url.origin) throw new Error('Request rejected');
        if (!response.body || Number(response.headers.get('content-length')) > MAX_RESPONSE) throw new Error('Invalid response');
        const reader = response.body.getReader(); const chunks = []; let bytes = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read(); if (done) break;
            bytes += value.byteLength;
            if (bytes > MAX_RESPONSE) { await reader.cancel(); throw new Error('Invalid response'); }
            chunks.push(Buffer.from(value));
          }
        } finally { reader.releaseLock(); }
        return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
      } finally { clearTimeout(timeout); }
    };
    const valid = job => job?.id === jobId && job.assignedToYou === true && job.fulfillment === 'authored';
    const active = job => valid(job) && ['open', 'claimed'].includes(job.state)
      && Number.isFinite(Date.parse(job.expiresAt)) && Date.parse(job.expiresAt) > timing.wallNow();
    try {
      const text = await readAuthoredText(file);
      stage = 'read';
      const current = await request(`/v1/resources/jobs/${jobId}`);
      let job = current?.job;
      if (!valid(job)) return receipt(false);
      state = ['open', 'claimed', 'submitted', 'accepted', 'disputed', 'refunded', 'expired'].includes(job.state) ? job.state : null;
      if (['submitted', 'accepted'].includes(job.state)) {
        stage = 'reconcile';
        if (job.report?.source === 'account_authored' && job.report.text === text && job.report.costUsdMicros === null && !job.callId) { confirmed = true; return receipt(false); }
        stage = 'conflict'; return receipt(false);
      }
      if (!active(job)) { stage = 'refused'; return receipt(false); }
      if (job.state === 'open') {
        stage = 'claim'; status = null;
        const claimed = await request(`/v1/resources/jobs/${jobId}/claim`, {}, () => { if (!active(job)) throw new Error('Expired job'); });
        job = claimed?.job;
        if (!active(job) || job.state !== 'claimed') throw new Error('Invalid claim');
        state = 'claimed';
      }
      stage = 'submit'; status = null;
      const result = await request(`/v1/resources/jobs/${jobId}/submit`, { text }, () => { if (!active(job)) throw new Error('Expired job'); });
      job = result?.job;
      if (!valid(job) || !['submitted', 'accepted'].includes(job.state) || job.report?.source !== 'account_authored'
          || job.report.text !== text || job.report.costUsdMicros !== null || job.callId) throw new Error('Invalid submission');
      state = job.state; confirmed = true; return receipt(false);
    } catch { return receipt(mutationDispatched && (status === null || status >= 500 || status >= 200 && status < 300)); }
  };
}

export function createResourceDelivery(options) { return runner(options, clock); }
export function createResourceDeliveryTestRunner(options, timing) { return runner(options, timing); }
export async function runAuthoredDelivery(options) { return createResourceDelivery(options)(); }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2); const options = {};
    if (args.length !== 6) throw new Error('Invalid arguments');
    for (let i = 0; i < args.length; i += 2) {
      const key = { '--base': 'baseUrl', '--job': 'jobId', '--file': 'file' }[args[i]];
      if (!key || options[key] !== undefined || !args[i + 1]) throw new Error('Invalid arguments');
      options[key] = args[i + 1];
    }
    const result = await runAuthoredDelivery(options);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!result.confirmed || result.pending) process.exitCode = 1;
  } catch { process.stderr.write('Authored delivery unavailable\n'); process.exitCode = 1; }
}
