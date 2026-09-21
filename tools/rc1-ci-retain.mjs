// CI transport only. The authenticated archive is not a source attestation.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const required = name => { assert(process.env[name], `${name} is required`); return process.env[name]; };
const workspace = path.resolve(required('GITHUB_WORKSPACE'));
const temporary = path.resolve(required('RUNNER_TEMP'));
const envelopeScript = fileURLToPath(new URL('./rc1-ci-envelope.js', import.meta.url));
const retention = path.join(temporary, 'rc1-retention');
// This path is a new, private directory. A second invocation cannot overwrite it.
await fs.mkdir(retention, { mode: 0o700 });
const sourceRevision = (await execute('git', ['rev-parse', 'HEAD'], { cwd: workspace })).stdout.trim();
assert(/^[a-f0-9]{40}$/.test(sourceRevision), 'Expected exact source revision');
if (process.env.RC1_REPLAY_SOURCE) assert.equal(sourceRevision, process.env.RC1_REPLAY_SOURCE);
const postgres = required('RC1_CI_POSTGRES');
assert(['16', '18.4'].includes(postgres), 'Unexpected PostgreSQL lane');
const context = { sourceRevision, runId: required('GITHUB_RUN_ID'), jobId: `${required('GITHUB_JOB')}:pg${postgres}`,
  attemptId: required('GITHUB_RUN_ATTEMPT') };
const entries = [];
const roots = [...new Set([temporary, path.resolve(os.tmpdir()), path.join(workspace, 'tmp')])];
for (const root of roots) {
  const names = await fs.readdir(root).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  for (const name of names.sort()) {
    // Do not archive dependencies, checkout copies, or this archive itself.
    if (!/^rc1-[a-zA-Z0-9_.-]+$/.test(name) || ['rc1-retention','rc1-predecessor','rc1-retention-tools'].includes(name)) continue;
    const item = await fs.lstat(path.join(root, name));
    assert(!item.isSymbolicLink(), 'Refusing an evidence-root symlink');
    if (item.isDirectory() || item.isFile()) entries.push({ root, name });
  }
}
const metadata = { format: 1, context, workflowRevision: required('GITHUB_SHA'),
  workflowRef: required('GITHUB_WORKFLOW_REF'), createdAt: new Date().toISOString(),
  node: process.version, platform: process.platform, entries,
  envelopeToolSha256: sha256(await fs.readFile(envelopeScript)),
  collectorSha256: sha256(await fs.readFile(fileURLToPath(import.meta.url))),
  claim: 'Restricted retained files; independently verify exact source, complete artifact index and histories after authenticated decryption. No sender attestation or release clearance.',
  limitations: ['Runner cancellation or failure of archive/encryption/upload can prevent retention.',
    'Missing or incomplete run records remain failures; this index does not manufacture them.',
    'Archive symlinks are stored without following them. Decryption never extracts the archive.'] };
const contextFile = path.join(retention, 'context.json');
const publicKey = path.join(retention, 'recipient-public.pem');
await fs.writeFile(contextFile, JSON.stringify(context) + '\n', { flag: 'wx', mode: 0o600 });
await fs.writeFile(path.join(retention, 'retention-index.json'), JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
await fs.writeFile(publicKey, required('RC1_EVIDENCE_PUBLIC_KEY'), { flag: 'wx', mode: 0o600 });
const archive = path.join(retention, 'payload.tar.gz');
const tarArguments = ['-czf', archive, '-C', retention, 'retention-index.json'];
for (const { root, name } of entries) tarArguments.push('-C', root, name);
// No shell expansion, no --dereference, and only bounded fixed-prefix roots.
await execute('tar', tarArguments, { maxBuffer: 1024 * 1024 });
const output = path.join(retention, 'evidence.rc1enc');
await execute(process.execPath, [envelopeScript, 'encrypt', `--input=${archive}`, `--output=${output}`,
  `--context=${contextFile}`, `--public-key=${publicKey}`], { maxBuffer: 1024 * 1024 });
console.log(JSON.stringify({ status: 'ENCRYPTED_FOR_RETENTION', sourceRevision, workflowRevision: process.env.GITHUB_SHA,
  entries: entries.length, bytes: (await fs.stat(output)).size, context }));
