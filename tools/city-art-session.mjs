// fal credentials are read once from stdin and retained only in this process.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';

const root = process.cwd();
const directory = path.join(root, 'art/city');
fs.mkdirSync(directory, { recursive: true });
const ledgerPath = path.join(directory, 'generation-manifest.json');
const ledger = fs.existsSync(ledgerPath) ? JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
  : { provider: 'fal.ai', budgetUsd: 3, jobs: {} };
const save = () => fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
let credential;
function apiUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['queue.fal.run', 'fal.run', 'api.fal.ai'].includes(url.hostname))
    throw new Error('Unexpected fal API host');
  return url.href;
}
async function api(url, method = 'GET', body) {
  const response = await fetch(apiUrl(url), { method,
    headers: { Authorization: 'Key ' + credential, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(45000) });
  const text = await response.text();
  if (!response.ok) throw new Error('fal HTTP ' + response.status + ': ' + text.slice(0, 900).replaceAll(credential, '[redacted]'));
  return JSON.parse(text);
}
async function command(message) {
  if (message.cmd === 'submit') {
    if (!/^[a-z0-9-]+$/.test(message.id)) throw new Error('Invalid asset ID');
    if (ledger.jobs[message.id]) throw new Error('Existing request must be reconciled before another paid submission');
    const reserved = Object.values(ledger.jobs).reduce((sum, job) => sum + job.reserveUsd, 0);
    if (!(message.reserveUsd > 0) || reserved + message.reserveUsd > ledger.budgetUsd) throw new Error('Generation budget exceeded');
    const spec = JSON.parse(fs.readFileSync(path.resolve(root, message.inputFile), 'utf8'));
    const input = { ...spec.input };
    if (spec.referenceFile) input.image_urls = ['data:image/png;base64,' + fs.readFileSync(path.resolve(root, spec.referenceFile)).toString('base64')];
    const job = ledger.jobs[message.id] = { model: spec.model, inputFile: message.inputFile,
      reserveUsd: message.reserveUsd, status: 'submitting', submittedAt: new Date().toISOString() };
    save();
    const queued = await api('https://queue.fal.run/' + spec.model, 'POST', input);
    Object.assign(job, queued, { status: 'queued' }); save();
    console.log(JSON.stringify({ id: message.id, status: job.status, requestId: job.request_id }));
  } else if (message.cmd === 'collect') {
    for (const [id, job] of Object.entries(ledger.jobs)) {
      if (!job.status_url || job.status === 'downloaded') continue;
      const status = await api(job.status_url);
      if (status.status !== 'COMPLETED') { console.log(JSON.stringify({ id, status: status.status })); continue; }
      const result = await api(job.response_url);
      const mediaUrl = result.images?.[0]?.url;
      if (!mediaUrl) { job.status = 'failed'; job.result = result; save(); throw new Error(id + ': no image returned'); }
      const url = new URL(mediaUrl);
      if (url.protocol !== 'https:' || !(url.hostname === 'fal.media' || url.hostname.endsWith('.fal.media') || url.hostname.endsWith('.fal.ai')))
        throw new Error('Unexpected generated media host');
      job.status = 'generated'; job.result = result; save();
      const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error('Generated media retrieval failed: ' + response.status);
      const bytes = Buffer.from(await response.arrayBuffer());
      const file = path.join(directory, id + '.png');
      fs.writeFileSync(file, bytes);
      Object.assign(job, { status: 'downloaded', file: path.relative(root, file).replaceAll('\\', '/'),
        bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }); save();
      console.log(JSON.stringify({ id, status: job.status, file: job.file, bytes: job.bytes }));
    }
  } else if (message.cmd === 'billing') {
    const ids = Object.values(ledger.jobs).map(job => job.request_id).filter(Boolean);
    const query = new URLSearchParams({ request_id: ids.join(','), limit: '100' });
    const result = await api('https://api.fal.ai/v1/models/billing-events?' + query);
    ledger.billing = result; save(); console.log(JSON.stringify({ billing: result }));
  } else throw new Error('Unknown command');
}
if (process.stdin.isTTY) process.stdin.setRawMode(true);
console.log('Awaiting process-only fal credential on stdin');
const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  if (!line.trim()) continue;
  if (!credential) { credential = line.trim(); console.log('fal session ready'); continue; }
  try { await command(JSON.parse(line)); }
  catch (error) { console.log('STOP: ' + error.message.replaceAll(credential, '[redacted]')); }
  console.log('READY');
}
credential = null;
