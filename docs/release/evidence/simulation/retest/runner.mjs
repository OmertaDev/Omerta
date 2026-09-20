import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
process.argv.push('--postgres');
const { runNativeSimulation } = await import('./rc1-sim.js');
const output = 'C:/Users/Jorge/Documents/Omerta-rc1/docs/release/evidence/simulation/retest/1000-rc1-alpha-1.json';
const result = await runNativeSimulation({ population: 1000, seed: 'rc1-alpha', replicate: 1, rounds: 2,
  progress: (data) => console.log(JSON.stringify(data)) });
result.revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
result.harnessSha256 = crypto.createHash('sha256').update(JSON.stringify(fs.readFileSync(new URL('./rc1-sim.js', import.meta.url), 'utf8'))).digest('hex');
result.retest = { reason: 'Original run failed during schema cleanup with PostgreSQL 53200 while other release harnesses shared the disposable cluster.', startedWithRestartedCluster: true, maxLocksPerTransaction: 64, concurrentHarnesses: 0 };
fs.writeFileSync(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ status: result.status, checks: result.invariantChecks.length, durationMs: result.durationMs }));
