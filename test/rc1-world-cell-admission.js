// Deterministic admission controls only; no native world or qualification claim.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { sha256 as resourceDigest } from '../tools/rc1-resource-journal.js';
import { reviewCellPolicy, reviewCellAuthority, reviewCellMarketConcurrency, cellAllianceControlsMatch, reviewWorldCellAdmission } from '../tools/rc1-world-cell-admission.js';
import { createMysteryPolicy } from '../tools/rc1-mystery-policies.js';
import { createAggressionPolicy } from '../tools/rc1-aggression-policy.js';

const hash = value => sha256(canonicalJson(value));
const manifest = JSON.parse(await fs.readFile('docs/release/readiness-work/scenario-manifest.json', 'utf8'));
const roster = Array.from({ length: 25 }, (_, i) => 'actor-' + i), seed = 'rc1-alpha';
function policy(scenarioId = 'quiet_world') {
  const full = !['quiet_world', 'high_mystery_participation', 'low_mystery_participation'].includes(scenarioId), selectedActors = full ? roster : roster.slice(0, 2);
  const days = [{ day: 0, logicalAt: 0, selectedActors }], metrics = { sessions: selectedActors.length };
  return { scenarioId, population: 25, seed, initial: { logicalAt: 0 },
    final: { logicalAt: 3600000, roster, days, metrics }, player: { days, metrics },
    activity: new Set(selectedActors.map(id => '0:' + id)) };
}
let input = policy(); assert.equal(reviewCellPolicy(input).status, 'SATISFIED');
assert.equal(reviewCellPolicy(input).observed.fraction, .08, 'Do not pretend two of25 is ten percent');
input.activity.clear(); assert.equal(reviewCellPolicy(input).status, 'UNKNOWN');
input = policy(); input.final.days[0].selectedActors.push('actor-2'); assert.equal(reviewCellPolicy(input).status, 'FAILED');
for (const scenarioId of ['high_mystery_participation', 'low_mystery_participation']) {
  input = policy(scenarioId);
  input.final.mysteryPolicies = Object.fromEntries(roster.map(accountId => [accountId,
    createMysteryPolicy({ scenarioId, accountId, seed }).checkpoint()]));
  let result = reviewCellPolicy(input); assert.equal(result.status, 'SATISFIED');
  assert.equal(result.observed.summaries[0].actualInvestigationFraction, null);
  input.final.mysteryPolicies[roster[0]].payload.counters.freshCompletions++;
  assert.throws(() => reviewCellPolicy(input), /checksum/i);
}
input = policy('high_aggression');
input.final.aggressionPolicies = Object.fromEntries(roster.map(accountId => [accountId,
  createAggressionPolicy({ accountId, seed, sustained: true }).checkpoint()]));
assert.equal(reviewCellPolicy(input).status, 'SATISFIED');
input = policy(); input.initial.lastDay = -1; input.final.epoch = 0; input.final.logicalAt = 86400000;
assert.throws(() => reviewCellPolicy(input), /daily session/);
for (const { id } of manifest.scenarios.filter(row => !['quiet_world', 'high_aggression', 'high_mystery_participation', 'low_mystery_participation'].includes(row.id))) {
  assert.equal(reviewCellPolicy(policy(id)).status, 'UNKNOWN', id);
}

// Shared source proof is reusable across cells, but neither a flag nor a changed
// canonical file can substitute for its existing reviewed source and raw bytes.
const source = 'a'.repeat(40), previous = 'b'.repeat(40), sourceBytes = 'original\n';
const evidence = Buffer.from('PASS original native proof\n');
const review = { status: 'SOURCE_PHASE_AUTHORITY_REVIEW_COMPLETE', cleanAtExecution: true, source: previous,
  sourceFiles: [{ path: 'src/game.js', sha256: sha256(sourceBytes) }],
  inputs: [], evidence: [{ path: 'native.log', sha256: sha256(evidence), bytes: evidence.length,
    requiredSuccessMarkers: ['PASS original native proof'] }],
  rawSourceAndDiagnosticMap: { path: 'map.json', sha256: sha256('{}'), bytes: 2 },
  backendConclusion: { status: 'SCOPED_BACKEND_AUTHORITY_REVIEW_COMPLETE', uncoveredRoutes: 0,
    uncoveredCommandFamilies: 0, unresolvedCriticalOrHigh: 0, roleCommandMatrixComplete: true, securityPolicyReviewComplete: true },
  routes: [{ status: 'SOURCE_AND_EXECUTED_EVIDENCE_MAPPED' }], counts: { routes: 1 },
  commandMatrix: [{ status: 'NOT_ISSUED_CURRENT_PROJECTION_DIRECT_API_REVIEWED' }] };
const authority = { sourceRevision: source,
  readSource: async (_revision, file) => file === 'src/game.js' ? sourceBytes : JSON.stringify(review),
  readExternal: async ref => ref.path === 'native.log' ? evidence : Buffer.from('{}') };
assert.equal((await reviewCellAuthority(authority)).status, 'SATISFIED');
assert.equal((await reviewCellAuthority({ ...authority, readSource: async (revision, file) => file === 'src/game.js'
  ? revision === source ? 'changed\n' : sourceBytes : JSON.stringify(review) })).status, 'UNKNOWN');
await assert.rejects(() => reviewCellAuthority({ ...authority, readExternal: async () => Buffer.from('forged') }), /proof bytes differ/);

// Actual request intervals and original expiry movements must accompany the
// selector's mixed-group labels. These are deterministic evidence controls.
function marketFixture() {
  const requests = ['sale', 'compete', 'compete', 'refund-cancel', 'fill'].map((phase, i) => ({ accountId: 'actor-' + i,
    request: { method: 'POST', path: phase === 'compete' ? '/v1/market/listing/buy' : '/v1/market/' + phase,
      body: { qty: 1 }, idempotencyKey: 'request-' + i } }));
  requests.push(structuredClone(requests[1]));
  const outcomes = requests.map((_, i) => ({ status: 'fulfilled', value: { status: i === 2 ? 400 : i === 5 ? 409 : 200,
    replayed: false, body: i === 5 ? { error: 'in_progress' } : { refunded: 50, delivered: 1, gross: 50 } } }));
  const trace = requests.map((_, requestIndex) => ({ phase: 'REQUEST_DISPATCH', requestIndex }));
  trace.push({ phase: 'COMPANION_DISPATCH', companionIndex: 0 }, { phase: 'COMPANION_RETURNED', companionIndex: 0 });
  trace.push(...requests.map((_, requestIndex) => ({ phase: 'REQUEST_RETURNED', requestIndex })));
  const before = { format: 1, tables: { market_listings: [{ id: 'listing', qty: 1 }] } }, after = { format: 1, tables: { market_listings: [] } };
  const companions = [{ kind: 'original-worker-job', label: 'market sweep', logicalAt: 0, sourceFile: 'src/worker.js',
    sourceSha256: sha256(sourceBytes), handlerSourceFile: 'src/market.js', handlerSourceSha256: sha256(sourceBytes) }];
  const companionOutcomes = [{ status: 'fulfilled', value: null }];
  const descriptor = { format: 2, beforeHash: resourceDigest(before), afterHash: resourceDigest(after), requestsSha256: hash(requests),
    outcomesSha256: hash(outcomes), traceSha256: hash(trace), companionsSha256: hash(companions), companionOutcomesSha256: hash(companionOutcomes) };
  const event = { context: { logicalAt: 0 }, caller: { kind: 'market-mixed-lifecycle', duplicateOf: 1,
    phases: ['sale', 'compete', 'compete', 'refund-cancel', 'fill'].map((phase, requestIndex) => ({ phase, requestIndex, accountId: requests[requestIndex].accountId })) },
  traceRoot: { ...descriptor, sha256: hash(descriptor) } };
  const journal = { quiescentGroupArtifact: 'group.json', orderExpiry: { movements: [{ listingId: 'expired' }] } };
  const evidence = { identity: event, requests, outcomes, trace, before, after, companions, companionOutcomes };
  return { groups: [{ event, journal }], evidence, options: { named: async () => evidence, readSource: async () => sourceBytes,
    sourceRevision: source, trace: { jobs: [{ label: 'market sweep', logicalAt: 0, status: 'RETURNED' }] } } };
}
let market = marketFixture(); assert.equal((await reviewCellMarketConcurrency(market.groups, market.options)).status, 'SATISFIED');
market.groups[0].journal.orderExpiry.movements = [];
assert.equal((await reviewCellMarketConcurrency(market.groups, market.options)).status, 'UNKNOWN', 'Due sweep alone is not expiry');
market = marketFixture(); market.evidence.outcomes[2].value.status = 200;
await assert.rejects(() => reviewCellMarketConcurrency(market.groups, market.options), /trace root differs/);
market = marketFixture(); market.options.trace.jobs = [];
assert.equal((await reviewCellMarketConcurrency(market.groups, market.options)).status, 'UNKNOWN', 'An unbound worker label is insufficient');
const resealMarket = fixture => {
  const event = fixture.groups[0].event, { sha256: omitted, ...root } = event.traceRoot;
  root.traceSha256 = hash(fixture.evidence.trace); root.outcomesSha256 = hash(fixture.evidence.outcomes);
  event.traceRoot = { ...root, sha256: hash(root) };
};
market = marketFixture();
[market.evidence.outcomes[1], market.evidence.outcomes[5]] = [market.evidence.outcomes[5], market.evidence.outcomes[1]];
resealMarket(market);
assert.equal((await reviewCellMarketConcurrency(market.groups, market.options)).status, 'SATISFIED', 'Either duplicate dispatch may win');
market = marketFixture();
market.evidence.trace = [0, 3, 4].flatMap(requestIndex => [{ phase: 'REQUEST_DISPATCH', requestIndex }, { phase: 'REQUEST_RETURNED', requestIndex }]);
market.evidence.trace.push(...[1, 2, 5].map(requestIndex => ({ phase: 'REQUEST_DISPATCH', requestIndex })),
  { phase: 'COMPANION_DISPATCH', companionIndex: 0 }, { phase: 'COMPANION_RETURNED', companionIndex: 0 },
  ...[1, 2, 5].map(requestIndex => ({ phase: 'REQUEST_RETURNED', requestIndex })));
resealMarket(market);
assert.equal((await reviewCellMarketConcurrency(market.groups, market.options)).status, 'UNKNOWN', 'Two overlapping buyers cannot qualify serial posting/refund/fill');
const controls = [{ accountId: 'delegate', path: '/v1/coordination/knowledge/claim', day: 2 }];
const controlDays = [{ day: 1, logicalAt: 86400000 }, { day: 2, logicalAt: 172800000 }];
const controlReads = [{ accountId: 'delegate', request: { path: controls[0].path, method: 'GET' },
  logicalAt: 172800000, status: 404, body: { error: 'coordination_unavailable' } }];
assert(cellAllianceControlsMatch(controls, controlDays, controlReads));
controlReads[0].logicalAt = 86400000;
assert(!cellAllianceControlsMatch(controls, controlDays, controlReads), 'An earlier refusal cannot establish denial after a later revocation');
controlReads[0].logicalAt = 172800000; controlReads[0].request.method = 'POST';
assert(!cellAllianceControlsMatch(controls, controlDays, controlReads), 'Unavailable control must be the original reader');

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rc1-cell-admission-control-'));
try {
  async function fixture({ gzip = false, resourceGap = false, historyGap = false, hours = 1 } = {}) {
    const directory = await fs.mkdtemp(path.join(root, 'case-')), artifacts = [];
    const put = async (name, value, raw = false) => {
      const bytes = raw ? value : Buffer.from(JSON.stringify(value, null, 2) + '\n');
      await fs.writeFile(path.join(directory, name), bytes); const ref = { path: name, sha256: sha256(bytes), bytes: bytes.length };
      artifacts.push(ref); return ref;
    };
    const start = 0, finish = hours * 3600000;
    const configuration = { scenario: 'quiet_world', population: 25, seed, start: new Date(start).toISOString(), finish: new Date(finish).toISOString() };
    const snapshot = at => ({ version: 'PostgreSQL 18.4 (CONTROL FIXTURE ONLY)', capturedAt: new Date(at).toISOString(),
      tables: {}, sequences: [], stateSha256: hash({ tables: {}, sequences: [] }) });
    const initial = snapshot(start), final = snapshot(finish);
    await put('initial.json', initial); await put('final.json', final);
    await put('checkpoint-series-points.json', { binding: { sourceRevision: source, configurationSha256: hash(configuration) },
      startAt: start, endAt: finish, points: [] });
    let previousHash = null, sequence = 0;
    const events = [], add = fields => {
      const event = { sequence: ++sequence, previousHash, ...fields }, digest = hash(event);
      events.push({ ...event, hash: digest }); previousHash = digest;
    };
    const event = { sequence: 1, outcome: 'COMMITTED' }, journal = { identity: event, beforeHash: hash('one'), afterHash: hash('two'),
      unsupported: resourceGap ? [{ kind: 'retained-gap' }] : [], checks: [{ drift: '0' }] };
    add({ kind: 'measured-initialization', logicalAt: 0 });
    add({ kind: 'canonical-invariants', logicalAt: 0, checks: [{ ok: true, name: 'test-only' }] });
    add({ kind: 'resource-commit-boundary', event, journal });
    if (historyGap) events[1].sequence++;
    const decoded = Buffer.from(events.map(row => JSON.stringify(row) + '\n').join(''));
    const storage = { encoding: 'gzip', framing: 'event-members-v1', maximumDecodedBytes: 1000000, maximumStoredBytes: 1000000,
      maximumLineBytes: 100000, maximumOutstandingInvocations: 100, maximumPendingRecords: 100 };
    const history = await put(gzip ? 'history.jsonl.gz' : 'history.jsonl', gzip ? gzipSync(decoded) : decoded, true);
    if (gzip) history.decoded = { path: 'history.jsonl', encoding: 'gzip', framing: 'event-members-v1', bytes: decoded.length, sha256: sha256(decoded) };
    await put('resource-observer.json', { boundaries: 1, unsupportedEntries: Number(resourceGap),
      diagnostic: { busy: false, openTransactions: [], failures: [] } });
    const run = { format: gzip ? 2 : 1, source: { revision: source }, population: 25, seed,
      scenarioId: 'native-world-component', configuration, configurationSha256: hash(configuration), artifacts,
      status: 'PASS_SCOPED', evidenceKind: 'native-postgresql-scoped-fixture', matrixQualifying: false,
      coverageExclusions: ['original scoped exclusions remain'],
      result: { status: 'PASS_SCOPED', initialStateSha256: initial.stateSha256, finalStateSha256: final.stateSha256,
        resourceJournalCount: 1, resourceJournalSha256: sha256(canonicalJson({ event, journal }) + '\n'), resourceObservationEnabled: true },
      ...(gzip ? { historyStorage: storage, historyStorageSha256: hash(storage),
        historyVerification: { semantics: 'sequential-invocations-v1', events: 3, invocations: 0, finalHash: previousHash } } : {}) };
    const bytes = Buffer.from(JSON.stringify(run, null, 2) + '\n'); await fs.writeFile(path.join(directory, 'run.json'), bytes);
    return { directory, runSha256: sha256(bytes), manifest, run, bytes };
  }
  let f = await fixture(), report = await reviewWorldCellAdmission(f);
  assert.equal(report.status, 'NOT_ADMITTED'); assert.equal(report.cellQualifying, false);
  assert.equal(report.predicates['logical-duration'].status, 'FAILED');
  assert.equal(report.predicates.resources.status, 'SATISFIED');
  assert.equal(report.predicates['native-database'].status, 'SATISFIED');
  assert.equal(report.predicates['authorization-and-replay'].status, 'UNKNOWN');
  assert.equal(report.originalEvidence.status, 'PASS_SCOPED');
  assert.deepEqual(await fs.readFile(path.join(f.directory, 'run.json')), f.bytes);
  f = await fixture({ gzip: true }); assert.equal((await reviewWorldCellAdmission(f)).status, 'NOT_ADMITTED');
  f = await fixture({ resourceGap: true }); assert.equal((await reviewWorldCellAdmission(f)).predicates.resources.status, 'FAILED');
  f = await fixture({ hours: 2160 }); report = await reviewWorldCellAdmission(f);
  assert.equal(report.predicates['logical-duration'].status, 'SATISFIED');
  assert.equal(report.cellQualifying, false, 'Ninety days and zero resource gaps alone cannot qualify');
  f = await fixture();
  const supplemental = { binding: { sourceRevision: source, configurationSha256: f.run.configurationSha256 },
    pointIndexSha256: f.run.artifacts.find(row => row.path === 'checkpoint-series-points.json').sha256 };
  let external = Buffer.from(JSON.stringify(supplemental));
  let ref = { path: 'external-stability.json', sha256: sha256(external) };
  assert.equal((await reviewWorldCellAdmission({ ...f, stabilizationReview: ref, readExternal: async () => external })).cellQualifying, false);
  supplemental.binding.sourceRevision = previous; external = Buffer.from(JSON.stringify(supplemental)); ref.sha256 = sha256(external);
  await assert.rejects(() => reviewWorldCellAdmission({ ...f, stabilizationReview: ref, readExternal: async () => external }), /binding differs/);
  f = await fixture({ historyGap: true }); await assert.rejects(() => reviewWorldCellAdmission(f), /sequence gap/);
  f = await fixture(); await assert.rejects(() => reviewWorldCellAdmission({ ...f, runSha256: '0'.repeat(64) }), /Sealed run bytes/);
  await fs.appendFile(path.join(f.directory, 'initial.json'), ' ');
  await assert.rejects(() => reviewWorldCellAdmission(f), /Artifact size mismatch/);
} finally { await fs.rm(root, { recursive: true, force: true }); }
console.log('PASS_SCOPED: cell predicate, integer-policy, shared authority applicability, sealed legacy/gzip bytes, resource gap and no-short-run-admission controls; no native qualification');
