// Explicit operational limits for long scoped runs. Exceeding a limit fails the
// evidence run; it never advances time, drops work, or reduces retained state.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

async function measureStorage(directory) {
  const files = await fs.readdir(directory, { withFileTypes: true });
  let outputBytes = 0;
  for (const entry of files) {
    assert(entry.isFile() && !entry.isSymbolicLink(), 'Guarded proof output must contain only regular artifact files');
    outputBytes += (await fs.stat(path.join(directory, entry.name))).size;
  }
  const volume = await fs.statfs(directory, { bigint: true });
  const freeBytes = Number(volume.bavail * volume.bsize);
  assert(Number.isSafeInteger(outputBytes) && Number.isSafeInteger(freeBytes));
  return { outputBytes, freeBytes, files: files.length };
}
export function createRunGuardrails({ directory, maximumWallMs, maximumOutputBytes, minimumFreeBytes,
  now = () => performance.now(), storage = measureStorage }) {
  for (const value of [maximumWallMs, maximumOutputBytes, minimumFreeBytes]) assert(Number.isSafeInteger(value) && value > 0);
  const started = now(); let checks = 0, last = null, failure = null;
  function reject(message, state) {
    failure = { message, ...state }; const error = Error(message); error.code = 'RC1_RUN_GUARDRAIL'; throw error;
  }
  function time(label) {
    const wallMs = now() - started;
    if (wallMs > maximumWallMs) reject('Declared run wall-time limit exceeded', { label, wallMs, maximumWallMs });
    return wallMs;
  }
  return {
    time,
    async check(label) {
      time(label); const measured = await storage(directory);
      last = { label, wallMs: time(label), ...measured }; checks++;
      if (measured.outputBytes > maximumOutputBytes) reject('Declared run output limit exceeded', { ...last, maximumOutputBytes });
      if (measured.freeBytes < minimumFreeBytes) reject('Declared free-space reserve reached', { ...last, minimumFreeBytes });
      return last;
    },
    diagnostic() { return { checks, last, failure }; },
  };
}
