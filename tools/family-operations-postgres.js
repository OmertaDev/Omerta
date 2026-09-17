import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Explicit COORDINATION_TEST_DATABASE_URL required');
const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL);
assert(['postgres:', 'postgresql:'].includes(endpoint.protocol)
  && ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only isolated loopback PostgreSQL allowed');
const tests = ['coordination-capital', 'coordination-materials', 'coordination-knowledge-proof',
  'world-kernel-transaction', 'family-operations', 'family-operation-migration', 'family-operation-concurrency']
  .map((name) => `test/${name}.js`);
assert.deepEqual(process.argv.slice(2), tests, 'Pass every supported Family native test in order');
const env = { ...process.env, DATABASE_URL: '', COORDINATION_TEST_DATABASE_URL: endpoint.toString(),
  WORLD_KERNEL_TEST_DATABASE_URL: endpoint.toString() };
for (const test of tests) {
  const child = spawnSync(process.execPath, [test, '--postgres'], { stdio: 'inherit', env });
  if (child.error || child.signal || child.status !== 0) process.exit(child.status || 1);
}
