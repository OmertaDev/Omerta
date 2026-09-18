import assert from 'node:assert/strict';
import { runDirectorSimulation, simulateDirectorScenario, DIRECTOR_SIMULATION_SCENARIOS } from '../tools/director-sim.js';

const report = runDirectorSimulation();
assert.equal(report.results.length, DIRECTOR_SIMULATION_SCENARIOS.length * 4);
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
  assert.equal(row.resourceEffects.duplicateReceipts, 0);
  assert.equal(row.resourceEffects.unexplainedWire, 0);
  assert.equal(row.resourceEffects.unexplainedSeals, 0);
  assert.match(row.resourceEffects.provenanceHash, /^[a-f0-9]{64}$/);
  assert(row.pressureMemory.maximumSamples <= 28);
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
assert.equal(quiet.pressureMemory.peaks.law, 0);
assert.equal(longest.find((row) => row.scenario === 'high_law_pressure').pressureMemory.peaks.law, 0,
  'The unchanged Dock pilot has no authored violence labels; a scenario name must not invent them');
for (const scenario of ['resource_abundance', 'low_law_pressure']) {
  assert.equal(longest.find((row) => row.scenario === scenario).generated, 0,
    `${scenario}: the Director does not invent route disruption or scarcity`);
}
assert(DIRECTOR_SIMULATION_SCENARIOS.length >= 10);
assert.equal(longest.find((row) => row.scenario === 'medium_population').campaignsCompleted, 24,
  'Retained-outcome recovery completes all four funded fixture scopes across six seasons');
const medium = DIRECTOR_SIMULATION_SCENARIOS.find((scenario) => scenario.id === 'medium_population');
assert.deepEqual(simulateDirectorScenario(medium, { periods: [1, 7, 30] }),
  report.results.filter((row) => row.scenario === medium.id && row.days <= 30), 'Full receipts and measured metrics reproduce exactly');
const seeded = { periods: [1, 7], seed: 'campaign-network-replay-42' };
assert.deepEqual(simulateDirectorScenario(medium, seeded), simulateDirectorScenario(medium, seeded),
  'A caller-declared seed reproduces complete receipts and resource accounting');
assert.throws(() => simulateDirectorScenario(medium, { periods: [1], seed: '' }), /declared simulation seed/);
assert.equal(report.campaignNetwork.results.length, DIRECTOR_SIMULATION_SCENARIOS.length);
for (const row of report.campaignNetwork.results) {
  assert.equal(row.resources.balanceError, 0);
  assert.equal(row.resources.sealError, 0);
  assert(row.maximumHistorySamples <= 28);
}
const network = (scenario) => report.campaignNetwork.results.find((row) => row.scenario === scenario);
assert(network('high_population').crossCampaignChanges >= 2, 'Committed modeled states connect Shipment, Market and Informant');
assert.equal(network('quiet_world').observed.length, 0);
assert.equal(network('resource_abundance').observed.length, 0, 'Abundance without disruption cannot create a scarcity market');
assert(network('economic_shortage').unfunded > 0);
assert(network('economic_shortage').expired > 0, 'Unfunded work expires without restoring consumed supplies');
assert(network('high_law_pressure').pressurePeaks.law > 0,
  'The authored network derives Law pressure from committed world actions with admitted violence labels');
assert.equal(network('low_law_pressure').pressurePeaks.law, 0);
console.log(JSON.stringify({ ok: true, ...report.summary, results180Days: longest.map(({ scenario, generated, completed, ignored,
  campaignsCompleted, campaignsAbandoned, recoveryUse, playerOpportunityVolume, unfundedResponseScopes }) => ({ scenario, generated,
  completed, ignored, campaignsCompleted, campaignsAbandoned, recoveryUse, playerOpportunityVolume, unfundedResponseScopes })) }));
