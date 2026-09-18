import assert from 'node:assert/strict';
import { runDirectorSimulation, simulateDirectorScenario, DIRECTOR_SIMULATION_SCENARIOS } from '../tools/director-sim.js';

const report = runDirectorSimulation();
assert.equal(report.results.length, 36);
assert.equal(report.summary.maximumStartsPerTick, 4, 'High activity exercises the real start budget');
assert(report.summary.maximumActive <= 32);
assert.equal(report.summary.maximumRepetitionWithinWindow, 2, 'Ignored pressures exercise the repetition boundary');
assert.equal(report.summary.wireBalanceErrors, 0);
assert.equal(report.summary.directorMinted, 0);
assert.equal(report.summary.deadEnds, 0);
for (const row of report.results) {
  assert.equal(row.generated, row.completed + row.ignored + row.activeSituations);
  assert.equal(row.campaignsStarted, row.campaignsCompleted + row.campaignsAbandoned + row.activeCampaigns);
  assert.equal(row.operationVolume, row.completed);
  assert.equal(row.resourceEffects.omrDelta, 0);
  assert.equal(row.resourceEffects.initialFixtureWire, row.resourceEffects.remainingWire + row.resourceEffects.wireConsumed);
  assert.equal(row.resourceEffects.initialFixtureSeals, row.resourceEffects.remainingSeals + row.resourceEffects.sealsConsumed);
  assert(row.maxActivePerFamily <= 6);
  assert(row.familyConcentration >= 0 && row.familyConcentration <= 1);
  assert.equal(row.deadEndRate, 0);
}
const longest = report.results.filter((row) => row.days === 180);
assert(longest.some((row) => row.campaignsCompleted > 0));
assert(longest.some((row) => row.campaignsAbandoned > 0));
assert(longest.some((row) => row.recoveryUse > 0));
assert(longest.some((row) => row.seasonRecoveries > 0));
assert(longest.some((row) => row.escalated > 0));
assert(longest.some((row) => row.playerBudgetDeferrals > 0));
assert(longest.some((row) => row.rejectionReasons.family_budget > 0));
assert(longest.some((row) => row.outcomes.protect > 0));
assert(longest.some((row) => row.outcomes.intercept > 0));
assert(longest.some((row) => row.outcomes.alternate > 0));
assert(longest.some((row) => row.unfundedResponseScopes > 0), 'Finite stock exhaustion is visible instead of hidden by minted resources');
const quiet = longest.find((row) => row.scenario === 'quiet_world');
assert.equal(quiet.generated, 0, 'A quiet canonical world does not acquire fabricated conflicts');
assert.equal(quiet.operationVolume, 0);
assert.equal(longest.find((row) => row.scenario === 'medium_population').campaignsCompleted, 24,
  'Retained-outcome recovery completes all four funded fixture scopes across six seasons');
const medium = DIRECTOR_SIMULATION_SCENARIOS.find((scenario) => scenario.id === 'medium_population');
assert.deepEqual(simulateDirectorScenario(medium, { periods: [1, 7, 30] }),
  report.results.filter((row) => row.scenario === medium.id && row.days <= 30), 'Full receipts and measured metrics reproduce exactly');
console.log(JSON.stringify({ ok: true, ...report.summary, results180Days: longest.map(({ scenario, generated, completed, ignored,
  campaignsCompleted, campaignsAbandoned, recoveryUse, playerOpportunityVolume, unfundedResponseScopes }) => ({ scenario, generated,
  completed, ignored, campaignsCompleted, campaignsAbandoned, recoveryUse, playerOpportunityVolume, unfundedResponseScopes })) }));
