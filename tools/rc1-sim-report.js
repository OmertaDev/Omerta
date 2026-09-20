import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const folder = 'docs/release/evidence/simulation';
const native = JSON.parse(await fs.readFile(`${folder}/native/summary.json`, 'utf8'));
const model = JSON.parse(await fs.readFile(`${folder}/model/matrix.json`, 'utf8'));
const originalResults = native.results;
let environmentalRetest = null;
try { environmentalRetest = JSON.parse(await fs.readFile(`${folder}/retest/1000-rc1-alpha-1.json`, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (environmentalRetest) {
  assert.equal(environmentalRetest.revision, native.revision);
  assert.equal(environmentalRetest.harnessSha256, native.harnessSha256);
  assert.equal(environmentalRetest.status, 'PASS_SCOPED');
  const original = originalResults.find((row) => row.population === environmentalRetest.population
    && row.seed === environmentalRetest.seed && row.replicate === environmentalRetest.replicate);
  assert.equal(original?.error?.code, '53200');
  assert(original.error.stack.includes('cleanup'));
  native.results = originalResults.map((row) => row === original ? environmentalRetest : row);
}
const rows = native.results.filter((row) => row.status === 'PASS_SCOPED');
const sum = (values) => values.reduce((a, b) => a + Number(b || 0), 0);
const metric = (name) => sum(rows.map((r) => r.metrics[name]));
const actual = (name) => sum(rows.map((r) => r.authoritative[name]));
const totalStatus = (type, status) => sum(rows.map((r) => r.authoritative[type][status] || 0));
const table = [25, 100, 500, 1000].map((population) => {
  const run = rows.filter((r) => r.population === population);
  if (!run.length) return `| ${population} | 0/4 | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN |`;
  return `| ${population} | ${run.length}/4 | ${sum(run.map((r) => r.metrics.commandsExecuted))} | ${sum(run.map((r) => r.metrics.knowledgeShares))} | ${sum(run.map((r) => r.authoritative.worldChanges))} | ${sum(run.map((r) => r.durationMs / 1000)).toFixed(1)} |`;
}).join('\n');
const failures = native.results.filter((row) => row.status !== 'PASS_SCOPED');
const full = rows.length === 16 && !failures.length;
const catalog = model.directorCatalog.flatMap((r) => r.results);
const doc = `# RC1 multiplayer simulation evidence

**Decision: supplementary simulation checks ${full ? 'PASS' : 'INCOMPLETE'}; Phase 4 remains INCOMPLETE.** The measured native workload has ${rows.length}/16 passing runs. It does not prove every required long-term or adversarial population behavior. Do not substitute model invariants or missing measurements for zero failures.

${environmentalRetest ? 'The original batch passed 15/16 runs. The remaining 1,000-player run failed during schema cleanup with PostgreSQL 53200 (lock-table exhaustion while concurrent release harnesses shared the disposable cluster). Its complete isolated rerun passed all 55 invariants on the same frozen source and harness, with the default max_locks_per_transaction=64. Original failure and summary remain unchanged in native/; retest evidence is in [retest/1000-rc1-alpha-1.json](evidence/simulation/retest/1000-rc1-alpha-1.json). The table below uses that successful rerun. Classification: ENVIRONMENTAL, reproduced workload retested successfully; no production setting or assertion was relaxed.' : ''}

## Tested source and environment

- Frozen application revision: \`${native.revision}\`.
- Native harness SHA-256 (UTF-8 JSON string representation): \`${native.harnessSha256}\`; the individual run files retain the same identity.
- Windows host, Node.js ${process.version}, PostgreSQL 18, isolated fresh schema per run. Each fixture loads the complete schema and drops its own schema on completion.
- Two policy seeds (\`rc1-alpha\`, \`rc1-beta\`), two independent replicates each, four population sizes; ${sum(rows.map((r) => r.population))} account participations across completed runs. Five designated actors in each run establish the initial world and execute campaign operations. Other accounts execute their own issued commands.
- The roster uses all 13 requested archetypes. Activity, acquisition, sharing, stale/foreign attempts, hoarding and disappearance policies differ. Social actors form real Crews and Families through domain services. Independent population campaigns are not yet simulated.
- Explicit fixture starting wealth is $100,000 and 10,000 respect per actor. Initial character-cash drift is exactly population × $99,500; that same drift must remain unchanged. All other 54 production ledger/provenance checks must pass without a baseline exception. No inventory, world state, claim, operation outcome or OMR balance is seeded or rewritten.
- Acquisition uses the existing deterministic successful boost/salvage fixture. Native operation resolution retains cryptographic production randomness; operation IDs and resolution seeds are saved. Policy seeds reproduce the workload recipe, not UUIDs, exact schedules or every random operation outcome.

## Reproduction

Use a disposable local PostgreSQL database and installed lockfile dependencies:

\`\`\`powershell
$env:COORDINATION_TEST_DATABASE_URL='postgres://postgres@127.0.0.1:55439/rc1_check'
node test/rc1-simulation.js
node tools/rc1-sim.js --postgres --populations=25,100,500,1000 --seeds=rc1-alpha,rc1-beta --replicates=2 --rounds=2 --output=docs/release/evidence/simulation/native
node tools/rc1-sim-model.js
node tools/rc1-sim-report.js
\`\`\`

The harness calls production command issuance/execution, Knowledge authorization, Crew/Family membership, crafting, salvage, operation escrow, World Kernel and Director services. It does not use HTTP, browsers or player credentials. PostgreSQL enforces the actual transactional boundaries. Population actions are scheduled sequentially; each run additionally issues a simultaneous pair of identical operation execution requests, then retries the receipt.

## Native results

| Population | Passed runs | Executed commands | Knowledge shares | Canonical world changes | Total run seconds |
| --- | ---: | ---: | ---: | ---: | ---: |
${table}

Durations include fixture creation, setup, service work, invariants and local competing test activity. They are not production latency or capacity measurements.

| Requested measurement | Observed native result |
| --- | --- |
| Opportunities generated | ${actual('situationsGenerated')} Director situations; ${metric('opportunityCardsShown')} card impressions and ${metric('opportunityCardsUniquePerActor')} distinct actor/card pairs |
| Opportunities completed | ${actual('situationsWithCanonicalResolution')} situations have canonical resolution; ${metric('completedOpportunityCommandLinks')} successful command/card links; these are different units |
| Opportunities abandoned | NOT_MEASURED as an opportunity lifecycle; ${metric('disappearedBeforeCommand')} visits stop before issuing a command |
| Campaigns started/completed/abandoned | ${actual('campaignsStarted')} / ${totalStatus('campaignStatuses', 'completed')} / ${totalStatus('campaignStatuses', 'abandoned')}; canonical campaign schema uses abandoned, not failed |
| Campaign failure | NOT_MEASURED beyond operation failures below |
| Cross-campaign propagation | Retained world action sequences and Director states in each run; no aggregate causal propagation counter |
| Operations created/completed/failed/expired | ${actual('operationsCreated')} / ${totalStatus('operationStatuses', 'completed')} / ${totalStatus('operationStatuses', 'failed')} / ${totalStatus('operationStatuses', 'expired')} |
| Coordination participation | ${actual('uniqueOperationParticipants')} run-local distinct participant counts, restricted to designated fixture actors |
| Knowledge propagation | ${actual('knowledgeClaims')} claims, ${actual('knowledgeGrants')} grants; ${metric('authorizedKnowledgeReads')} authorized group reads checked |
| Resource consumption | ${actual('stackUnitsConsumed')} stack debit units and ${actual('stackUnitsCreated')} credit units. These include escrow transfers/refunds; net manufacture/sink totals NOT_MEASURED separately |
| Item creation/destruction | ${actual('itemsCreated')} unique items created; ${actual('itemsConsumed')} consumed |
| World state changes | ${actual('worldChanges')} canonical events |
| Player commands executed | ${metric('commandsExecuted')} distinct completions; ${metric('commandReplays')} replay responses |
| Stale command rejection | ${metric('staleCommandProbes')} stale probes; ${sum(rows.map((r) => r.metrics.rejectedCommands.command_stale))} stale rejections |
| Replay rejection/suppression | ${metric('replayStateChecks')} unchanged-history checks; ${metric('concurrentOperationExecuteBursts')} duplicate bursts; safe in-flight contention then durable replay is accepted |
| Dead ends and Director starvation | NOT_MEASURED over a sustained native horizon |
| Opportunity starvation | ${metric('visitsWithoutAvailableOpportunity')} sampled visits have no AVAILABLE command; this does not prove practical resource acquisition paths |
| Opportunity flooding | Maximum ${Math.max(0, ...rows.map((r) => r.metrics.maximumCardsPerVisit))} cards in a sampled board; ${metric('truncatedOpportunityVisits')} truncated boards. No player-tested flood threshold |
| Campaign repetition | NOT_MEASURED over a sustained native horizon |
| World object contention | Duplicate operation execution exercised; distinct competing commands and a concurrent 1,000-player workload NOT_MEASURED |

## Integrity evidence and limits

- ${rows.length * 55} final production invariant evaluations passed in completed runs, including material conservation, unique custody/provenance, World Kernel history and operation capital/custody/history. Harness tests verify that a missing invariant, new OMR drift, cash drift or custody failure makes the run fail.
- ${metric('knowledgePrivacyProbes')} unrelated-reader probes found ${metric('unauthorizedKnowledgeDisclosures')} private claim identity disclosures. These inspect specific undisclosed claims and shared grants; they are not an exhaustive noninterference proof.
- ${metric('foreignCommandProbes')} account-bound command attempts were refused and left canonical histories unchanged.
- ${actual('negativeInventoryRows')} negative inventory rows and ${actual('duplicateCanonicalConsequences')} duplicate object/revision consequences observed.
- ${metric('abandonedOperationsRecovered')} committed operations expired through the authoritative recovery command; inventory custody was re-audited. Test time crosses the stored deadline; no canonical deadline row is edited.
- All measured OMR conservation checks passed, with ${actual('omrTransactions')} OMR transaction rows. OMR-moving or reward-bearing gameplay is not exercised by this content slice; this cannot replace economic/contract gates.
- Each Director was recreated and the same tick replayed without adding canonical history. Process termination and database interruption belong to separate release gates.

## Supplementary selection models

The existing frozen 13-scenario Director catalog ran at 1, 7 and 30 days for each seed/replicate: ${catalog.length} model snapshots. The existing Campaign Network model also ran all 16 requested population/seed/replicate combinations. The immutable admitted-scenario guard remains intact. See [model matrix](evidence/simulation/model/matrix.json).

These models call production compilation, eligibility, pressure and selection functions. Synthetic custody, knowledge distributions and modeled operation outcomes do **not** execute PostgreSQL or authorize real Player Commands. Their zero balance/dead-end counters are model properties only. Population labels alone are not evidence of native load or human engagement.

## Failures and outstanding release evidence

${failures.length ? failures.map((f) => `- **RELEASE BLOCKER pending triage:** ${f.population}/${f.seed}/${f.replicate}: ${f.error.message}. Re-run the matrix with --populations=${f.population} --seeds=${f.seed} --replicates=${f.replicate + 1}.`).join('\n') : '- No observed production integrity regression in the completed native runs.'}
- **NEW REGRESSION (validation harness, corrected):** the second 25-player development pilot expected both simultaneous requests to fulfill. The production issuance lock correctly rejected one with \`contention\`. The final harness accepts only one new completion plus either that refusal or a replay, then demands a successful receipt retry and unchanged canonical counts. The failed pilot is retained at [pilot2](evidence/simulation/pilot2/25-rc1-alpha-0.json).
- **NEW REGRESSION (validation harness integration, corrected):** an initial model invocation supplied custom scenarios to the frozen-catalog Dock simulator and failed its \`Choose an admitted scenario\` assertion. The final tool retains that assertion, uses the admitted catalog for Dock horizon evidence and the existing configurable Campaign Network model for population scenarios. Synthetic discovery-source counts match the production cap of 32.
- **RELEASE BLOCKER — incomplete Phase 4 coverage:** execute sustained native campaign populations with distinct commands contending for the same objects, independent Crew/Family campaigns, repeated operation failure, long-term starvation/repetition/dead-end detection and correlated player dropout. Reproduce current short horizon with the command above; the explicit \`notMeasured\` arrays document the missing observations.
- **Required cross-gate evidence:** evaluate reward-bearing and nonzero OMR paths in the economic suites if those features are admitted to the cohort. This simulation cannot stand in for those checks; disabled economic features do not become a demand to enable or expand them.
- A maximum card count is an internal UX finding. Decide pacing changes only after the first-session/mobile audit demonstrates a severe player failure.

SIMULATION_GATE=INCOMPLETE
`;
await fs.writeFile('docs/release/RC1-SIMULATION-REPORT.md', doc);
console.log(JSON.stringify({ generated: 'docs/release/RC1-SIMULATION-REPORT.md', completedRuns: rows.length, expectedRuns: 16, full }));
