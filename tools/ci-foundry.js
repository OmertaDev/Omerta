// CI-only bootstrap from one immutable, independently checksum-pinned release asset.
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { constants, createWriteStream } from 'node:fs';
import { chmod, lstat, mkdir, mkdtemp, open, readdir, realpath } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

export const FOUNDRY_RELEASE = Object.freeze({
  version: '1.7.1',
  url: 'https://api.github.com/repos/foundry-rs/foundry/releases/assets/415095756',
  bytes: 98596412,
  sha256: 'cf7e688ed0c4c48adffca788b496076e31060b67ac5afe1e43dbb5499c20c88b',
});

class ArchiveIntegrityError extends Error {}

// Data records only: accessors cannot execute while validating an observed size/hash.
export function verifyFoundryArchive(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ArchiveIntegrityError('Foundry archive verification requires a size/hash record');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    throw new ArchiveIntegrityError('Foundry archive verification requires a plain data record');
  const fields = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(fields).length !== 2 || !Object.hasOwn(fields, 'bytes')
    || !Object.hasOwn(fields, 'sha256') || !Object.hasOwn(fields.bytes, 'value')
    || !Object.hasOwn(fields.sha256, 'value')
    || fields.bytes.value !== FOUNDRY_RELEASE.bytes || fields.sha256.value !== FOUNDRY_RELEASE.sha256)
    throw new ArchiveIntegrityError('Foundry archive size or SHA-256 does not match the pinned release');
  return true;
}

const run = promisify(execFile);
const binaries = Object.freeze(['anvil', 'cast', 'chisel', 'forge']);

function runnerPath(name) {
  const value = process.env[name];
  if (!value || !isAbsolute(value) || /[\r\n\0]/.test(value))
    throw new Error(`${name} must identify an absolute runner-owned path`);
  return value;
}

async function downloadAttempt(file) {
  const signal = AbortSignal.timeout(60_000);
  const response = await fetch(FOUNDRY_RELEASE.url, {
    signal,
    redirect: 'follow',
    headers: { Accept: 'application/octet-stream', 'Accept-Encoding': 'identity', 'User-Agent': 'omerta-ci-foundry' },
  });
  if (response.status !== 200 || !response.body) {
    await response.body?.cancel();
    throw new Error(`Foundry release download returned HTTP ${response.status}`);
  }
  const length = response.headers.get('content-length');
  if (length !== null && length !== String(FOUNDRY_RELEASE.bytes)) {
    await response.body.cancel().catch(() => {});
    throw new ArchiveIntegrityError('Foundry release Content-Length does not match the pinned size');
  }
  let bytes = 0;
  const hash = createHash('sha256');
  const checked = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      if (bytes > FOUNDRY_RELEASE.bytes)
        return callback(new ArchiveIntegrityError('Foundry release exceeded the pinned size'));
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(response.body), checked,
      createWriteStream(file, { flags: 'wx', mode: 0o600 }), { signal });
  } catch (error) {
    if (bytes > FOUNDRY_RELEASE.bytes)
      throw new ArchiveIntegrityError('Foundry release exceeded the pinned size');
    throw error;
  }
  verifyFoundryArchive({ bytes, sha256: hash.digest('hex') });
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== bytes || stat.uid !== process.getuid())
    throw new ArchiveIntegrityError('Verified Foundry archive is not an owned regular file');
}

async function downloadArchive(directory) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const file = join(directory, `release-${attempt}.tar.gz`);
    try {
      await downloadAttempt(file);
      return file;
    } catch (error) {
      // Corrupt, oversized or substituted bytes never become an accepted retry.
      if (error instanceof ArchiveIntegrityError) throw error;
      const reason = /^Foundry release download returned HTTP \d{3}$/.test(error.message) ? error.message : error.name;
      console.warn(`Foundry download attempt ${attempt}/3 failed (${reason})`);
      if (attempt === 3) throw new Error('Pinned Foundry download unavailable after three bounded attempts');
      await delay(attempt * 2000);
    }
  }
}

async function main() {
  if (process.argv.length !== 2 || process.platform !== 'linux' || process.arch !== 'x64')
    throw new Error('Pinned Foundry setup requires a bare Linux x64 CI invocation');
  const runnerTemp = runnerPath('RUNNER_TEMP'), githubPath = runnerPath('GITHUB_PATH');
  const tempStat = await lstat(runnerTemp), pathStat = await lstat(githubPath);
  if (!tempStat.isDirectory() || tempStat.isSymbolicLink() || !pathStat.isFile() || pathStat.isSymbolicLink())
    throw new Error('Runner paths must be a real directory and a regular PATH command file');
  const directory = await mkdtemp(join(await realpath(runnerTemp), 'omerta-foundry-'));
  await chmod(directory, 0o700);
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid())
    throw new Error('Foundry setup requires its own private temporary directory');
  const archive = await downloadArchive(directory), bin = join(directory, 'bin');
  await mkdir(bin, { mode: 0o700 });
  await run('tar', ['-xzf', archive, '-C', bin, '--no-same-owner', '--no-same-permissions', '--', ...binaries],
    { timeout: 45_000, maxBuffer: 64 * 1024 });
  const files = (await readdir(bin)).sort();
  if (files.join(',') !== binaries.join(',')) throw new Error('Unexpected extracted Foundry paths');
  for (const name of binaries) {
    const file = join(bin, name), item = await lstat(file);
    if (!item.isFile() || item.isSymbolicLink() || item.nlink !== 1 || item.uid !== process.getuid()
      || !item.size || !(item.mode & 0o100) || await realpath(file) !== file)
      throw new Error(`Foundry ${name} must be an owned regular executable`);
  }
  const { stdout } = await run(join(bin, 'forge'), ['--version'], { timeout: 10_000, maxBuffer: 16 * 1024 });
  if (!/^forge Version: 1\.7\.1(?:-stable)?$/.test(stdout.split(/\r?\n/, 1)[0]))
    throw new Error('Installed Forge does not report the exact pinned version');
  const pathFile = await open(githubPath, constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW);
  try {
    if (!(await pathFile.stat()).isFile()) throw new Error('PATH command target is not a regular file');
    await pathFile.writeFile(`${bin}\n`);
  } finally { await pathFile.close(); }
  console.log(`Foundry ${FOUNDRY_RELEASE.version} verified: ${FOUNDRY_RELEASE.sha256}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(`Pinned Foundry setup failed: ${error.message}`);
    process.exitCode = 1;
  });
}
