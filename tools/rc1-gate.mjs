// RC1 evidence runner: preserve failures and record the exact source/diff for each run.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const [id, command, ...args] = process.argv.slice(2);
if (!id || !command || !/^[a-z0-9-]+$/.test(id)) throw new Error('Usage: node tools/rc1-gate.mjs <gate-id> <command> [args]');
const directory = path.resolve('docs/release/evidence/baseline');
fs.mkdirSync(directory, { recursive: true });
const prefix = path.join(directory, `${id}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const git = (...values) => execFileSync('git', values, { encoding: 'utf8' }).trim();
const diff = git('diff', 'HEAD', '--', 'src', 'test', 'tools', 'public', 'schema.sql', 'package.json', 'package-lock.json');
const record = {
  id, command: [command, ...args], source: git('rev-parse', 'HEAD'),
  trackedSourceDiffSha256: createHash('sha256').update(diff).digest('hex'),
  started: new Date().toISOString(), node: process.version, platform: process.platform,
  log: path.relative(process.cwd(), `${prefix}.log`).replaceAll('\\', '/'),
};
const log = fs.openSync(`${prefix}.log`, 'wx');
const child = spawn(command === 'node' ? process.execPath : command, args, { stdio: ['ignore', log, log], env: process.env });
child.on('error', (error) => { record.spawnError = error.message; });
child.on('close', (code, signal) => {
  fs.closeSync(log);
  Object.assign(record, { finished: new Date().toISOString(), exitCode: code, signal });
  fs.writeFileSync(`${prefix}.json`, JSON.stringify(record, null, 2) + '\n');
  console.log(JSON.stringify(record));
  const lines = fs.readFileSync(`${prefix}.log`, 'utf8').split(/\r?\n/);
  console.log(lines.slice(-18).join('\n'));
  process.exitCode = code === 0 ? 0 : 1;
});
