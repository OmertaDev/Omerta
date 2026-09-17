// Exact native projection gate, against one explicit disposable loopback endpoint.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
assert(process.env.WORLD_KERNEL_TEST_DATABASE_URL, 'Explicit WORLD_KERNEL_TEST_DATABASE_URL required');
const endpoint = new URL(process.env.WORLD_KERNEL_TEST_DATABASE_URL);
assert(['postgres:', 'postgresql:'].includes(endpoint.protocol)
  && ['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only isolated loopback PostgreSQL is allowed');
const tests = ['test/world-projection-read.js', 'test/world-projection.js', 'test/projection-events.js'];
assert.deepEqual(process.argv.slice(2), tests, 'Pass every supported native projection test in order');
const env = { ...process.env, DATABASE_URL: '', WORLD_KERNEL_TEST_DATABASE_URL: endpoint.toString(), COORDINATION_TEST_DATABASE_URL: endpoint.toString() };
for (const test of tests) {
  const result = spawnSync(process.execPath, [test, '--postgres'], { stdio: 'inherit', env });
  if (result.error || result.signal || result.status !== 0) process.exit(result.status || 1);
}
