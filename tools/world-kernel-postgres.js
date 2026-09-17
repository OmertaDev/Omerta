// One explicit disposable endpoint for the kernel's real PostgreSQL proofs.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

assert(process.env.WORLD_KERNEL_TEST_DATABASE_URL, 'Explicit WORLD_KERNEL_TEST_DATABASE_URL required');
const endpoint = new URL(process.env.WORLD_KERNEL_TEST_DATABASE_URL);
assert(['postgres:', 'postgresql:'].includes(endpoint.protocol)
  && ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only isolated loopback PostgreSQL is allowed');
const env = { ...process.env, DATABASE_URL: '', WORLD_KERNEL_QUERY_TEST_DATABASE_URL: endpoint.toString(),
  COORDINATION_TEST_DATABASE_URL: endpoint.toString() };
const tests = ['world-knowledge-crafting', 'world-kernel-query', 'world-kernel', 'world-kernel-migration']
  .map((name) => `test/${name}.js`);
// Keep the exact list visible to the repository's CI suite ledger. Refuse a
// shortened caller list so a nominal native gate cannot silently skip a lane.
assert.deepEqual(process.argv.slice(2), tests, 'Pass every supported native kernel test in order');
for (const test of tests) {
  const child = spawnSync(process.execPath, [test, '--postgres'], { stdio: 'inherit', env });
  if (child.error || child.signal || child.status !== 0) process.exit(child.status || 1);
}
