// Every native progression proof uses a fresh schema on one explicit scratch DB.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

assert(process.env.WORLD_KERNEL_TEST_DATABASE_URL, 'Explicit WORLD_KERNEL_TEST_DATABASE_URL required');
const endpoint = new URL(process.env.WORLD_KERNEL_TEST_DATABASE_URL);
assert(['postgres:', 'postgresql:'].includes(endpoint.protocol)
  && ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only isolated loopback PostgreSQL is allowed');
const env = { ...process.env, DATABASE_URL: '', COORDINATION_TEST_DATABASE_URL: endpoint.toString() };
const tests = ['world-prerequisites', 'recipe-policy', 'furnace-ledger', 'core-progression-migration'].map((name) => `test/${name}.js`);
assert.deepEqual(process.argv.slice(2), tests, 'Pass every native progression test in order');
for (const test of tests) {
  const child = spawnSync(process.execPath, [test, '--postgres'], { stdio: 'inherit', env });
  if (child.error || child.signal || child.status !== 0) process.exit(child.status || 1);
}
