// Extends the EXISTING bounded Director model; never labels it database evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { simulateDirectorScenario, DIRECTOR_SIMULATION_SCENARIOS } from './director-sim.js';

const output = process.argv[2] || 'docs/release/evidence/simulation/director-population-matrix.json';
const report = {
  source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  schemaVersion: 1, model: 'Existing bounded Director observation model, NOT canonical PostgreSQL gameplay',
  populations: [25, 100, 250, 500, 1000], seeds: ['rc1-director-a', 'rc1-director-b'],
  periods: [1, 7, 30, 180], startedAt: new Date().toISOString(), results: [], failures: [],
  unsupportedArchetypes: ['high player churn', 'mostly veteran players', 'coordinated alliance',
    'low mystery participation', 'market stress'],
  limitations: ['Population is modeled actor observation data, not connected game accounts.',
    'Original fixture scopes, resources and responses remain synthetic.',
    'Quiet, abundance and Law labels do not invent canonical conflicts.',
    'Finite stock exhaustion is reported separately from lifecycle dead ends.',
    'No database, latency, custody, all-resource conservation or real-player metrics are claimed.'],
};
for (const seed of report.seeds) for (const population of report.populations) {
  for (const scenario of DIRECTOR_SIMULATION_SCENARIOS) {
    try {
      const results = simulateDirectorScenario(scenario, { seed, population, periods: report.periods });
      for (const row of results) {
        assert.equal(row.resourceEffects.wireBalanceError, 0);
        assert.equal(row.resourceEffects.unexplainedSeals, 0);
        assert.equal(row.resourceEffects.duplicateReceipts, 0);
      }
      report.results.push({ seed, population, scenario: scenario.id, results });
    } catch (error) {
      report.failures.push({ seed, population, scenario: scenario.id, message: error.message, stack: error.stack });
    }
  }
  await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ seed, population, completedScenarios: report.results.length, failures: report.failures.length }));
}
report.completedAt = new Date().toISOString();
report.ok = report.failures.length === 0;
await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
process.exitCode = report.ok ? 0 : 1;
