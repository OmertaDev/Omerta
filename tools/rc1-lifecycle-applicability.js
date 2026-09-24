// Existing duration gate applicability, not an execution/duration extractor.
import assert from 'node:assert/strict';
import { canonicalJson, sha256 } from './rc1-native-proof.js';
import { verifyWorldRecoverySources, WORLD_DURATION_CANDIDATES } from './rc1-world-qualification.js';
import { STAKE_LOCKS } from '../src/rules.js';

const hash = value => sha256(canonicalJson(value));
const pins = {
  'src/made.js': 'f871cf72aa3f4f65488c77ad16b257100569d40e3cf9b96dd4877e6c22be0e02', 'src/brokers.js': '75c5b13315ed220dd22cbb16c22e8bc1f245da75e392fbb0e940c5df73e8516f',
  'src/routes/estate.js': 'e72723bad80d851d7cd70e1b55109414fbb263099f4e0c241cbc4a47382d4e4e', 'src/player-commands.js': '79ead5d111f072b3e957ea4a5d0d154589f2677a8f22cfc6d2d95d2d7ad4aff6',
};
export const LIFECYCLE_APPLICABILITY_REVIEW = Object.freeze({ version: 1, pins,
  openingWriters: { 'made-membership': 'src/made.js payDues -> setMadeUntil; POST /v1/made',
    'broker-activation': 'src/brokers.js activate; POST /v1/brokers/activate',
    'stake-lock': 'src/economy.js lockStake; POST /v1/stake/lock' },
  closure: 'Original local worker callbacks and PlayerCommand domain dispatch do not invoke these dedicated activation writers. Canonical HTTP dispatch opens them only through the listed mounted routes. GET /v1/me and readCharacter accrue original state, but do not open these paid activations/locks. The complete measured invocation inventory must include every actor, preparation after baseline, retry, pending replay and HTTP/direct dispatch. Other direct domain callbacks are UNKNOWN.',
  scope: 'NOT_APPLICABLE means no initialized active timer and no possible opening invocation in this exact measured workload. Mounted routes remain available; no claim about final production flags, future user actions or deployment activation is made.',
  shorterHorizons: 'Original broker allocation/Family week and workload loan/shipment/operation/Law/turf/market timers are at most7 days, below the28-day season. Their due original workers still require execution receipts. Historical wallet-age eligibility and telemetry retention are not gameplay lifecycles.',
});
export async function verifyLifecycleSources(input) {
  const source = await verifyWorldRecoverySources(input);
  for (const [file, expected] of Object.entries(pins)) assert.equal(sha256(String(await input.readFile(file)).replace(/\r\n/g, '\n')), expected, 'Lifecycle source changed: ' + file);
  return { ...source, lifecycleReviewSha256: hash(LIFECYCLE_APPLICABILITY_REVIEW), lifecycleSourcePins: { ...pins } };
}
const reference = value => assert(value?.path && /^[a-f0-9]{64}$/.test(value.sha256), 'Retain byte-verified applicability evidence');
const commands = new Set(['mystery.start', 'mystery.inspect', 'mystery.discover', 'mystery.complete', 'mystery.choice',
  'discovery.start', 'discovery.act', 'knowledge.share', 'knowledge.revoke', 'recipe.craft', 'item.salvage', 'world.execute', 'situation.act',
  ...['create', 'publish', 'join', 'leave', 'assign', 'commit', 'contribute', 'approve', 'execute', 'cancel', 'expire'].map(action => 'operation.' + action)]);

export function reviewWorkloadLifecycleApplicability({ source, configurationSha256, startAt, endAt, initialSnapshot,
  finalSnapshot, workload, configurationEvidence, reviewEvidence }) {
  assert.equal(source.lifecycleReviewSha256, hash(LIFECYCLE_APPLICABILITY_REVIEW)); assert.deepEqual(source.lifecycleSourcePins, pins);
  assert(Number.isSafeInteger(startAt) && Number.isSafeInteger(endAt) && endAt >= startAt);
  assert(/^[a-f0-9]{64}$/.test(configurationSha256)); reference(reviewEvidence); reference(workload.evidence); reference(configurationEvidence.evidence);
  const binding = { sourceRevision: source.sourceRevision, configurationSha256 };
  const tables = snapshot => {
    assert.equal(snapshot.stateSha256, hash({ tables: snapshot.tables, sequences: snapshot.sequences }), 'Native snapshot changed');
    return Object.fromEntries(Object.entries(snapshot.tables).map(([table, rows]) => [table, rows.map(row => typeof row === 'string' ? JSON.parse(row) : row)]));
  };
  const initial = tables(initialSnapshot), final = tables(finalSnapshot);
  assert.deepEqual(workload.binding, { ...binding, initialStateSha256: initialSnapshot.stateSha256, finalStateSha256: finalSnapshot.stateSha256,
    fromLogicalAt: startAt, throughLogicalAt: endAt });
  assert.deepEqual(configurationEvidence.binding, binding);
  for (const state of [initial, final]) for (const name of ['characters', 'account_persistent', 'broker_activations']) assert(Array.isArray(state[name]), 'Missing lifecycle table ' + name);
  assert(Array.isArray(workload.calls));
  const opened = new Set(), unknownCalls = [];
  for (const call of workload.calls) {
    if (call.kind === 'player-command' && commands.has(call.commandType)
      || call.kind === 'canonical-crime' && call.handler === 'game.doCrime'
      || call.kind === 'canonical-read' && ['game.readCharacter', 'player.snapshot'].includes(call.handler)) continue;
    if (call.kind !== 'http' || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(call.method)
      || typeof call.path !== 'string' || !/^\/v1\/[A-Za-z0-9_:/?.=&-]+$/.test(call.path)) { unknownCalls.push(call); continue; }
    const pathname = call.path.split('?')[0].replace(/\/$/, '');
    if (call.method !== 'POST') continue;
    if (pathname === '/v1/made') opened.add('made-membership');
    if (pathname === '/v1/brokers/activate') opened.add('broker-activation');
    if (pathname === '/v1/stake/lock') {
      const tier = STAKE_LOCKS.TIERS.find(row => row.id === call.body?.tier);
      // Unknown/variable tier can open any original tier; do not waive90 days.
      for (const row of tier ? [tier] : STAKE_LOCKS.TIERS) opened.add('stake-lock-' + row.id);
    }
  }
  const active = (value, at) => value != null && Number.isFinite(new Date(value).getTime()) && new Date(value).getTime() > at;
  const initialized = new Set(), malformed = [];
  for (const [state, at] of [[initial, startAt], [final, endAt]]) {
    for (const row of state.account_persistent) {
      for (const field of ['made_until', 'stake_lock_until']) if (row[field] != null && !Number.isFinite(new Date(row[field]).getTime())) malformed.push({ accountId: row.account_id, field });
      if (active(row.made_until, at)) initialized.add('made-membership');
      if (active(row.stake_lock_until, at)) {
        const tier = STAKE_LOCKS.TIERS.find(candidate => candidate.mult === Number(row.stake_lock_mult));
        for (const candidate of tier ? [tier] : STAKE_LOCKS.TIERS) initialized.add('stake-lock-' + candidate.id);
      }
    }
    for (const row of state.broker_activations) {
      if (active(row.until, at)) initialized.add('broker-activation');
      else if (row.until == null || !Number.isFinite(new Date(row.until).getTime())) malformed.push({ accountId: row.account_id, field: 'broker.until' });
    }
  }
  const closed = workload.complete === true && workload.canonicalDispatchOnly === true && workload.originalWorkersOnly === true
    && !unknownCalls.length && !malformed.length;
  const population = initial.characters.some(row => row.alive && !row.is_npc) || final.characters.some(row => row.alive && !row.is_npc);
  const lifecycles = WORLD_DURATION_CANDIDATES.map(candidate => {
    const applies = candidate.id === 'season' ? population : initialized.has(candidate.id) || opened.has(candidate.id);
    return { ...candidate, applicability: applies ? 'APPLICABLE' : candidate.id === 'season' || !closed ? 'UNKNOWN' : 'NOT_APPLICABLE',
      reason: applies ? candidate.id === 'season' ? 'Living local population uses original28-day rollover.'
        : 'An active initialized timer or an opening invocation belongs to this exact measured workload.'
        : closed ? 'No active initialized timer; the complete canonical invocation inventory and original workers contain no activation/lock opener.'
          : 'Invocation/source/snapshot coverage is incomplete; absence of current timer rows alone proves no exclusion.',
      applicabilityEvidence: reviewEvidence };
  });
  const external = configurationEvidence.external;
  const localExternalScope = external?.chainWatcher === 'DORMANT_UNCONFIGURED'
    && external?.liquidityAutomation === 'DISABLED_LOCAL_CONFIG' && external?.rwaRegistry === 'UNAVAILABLE_LOCAL_CONFIG';
  return { binding, evidence: reviewEvidence, sourceReviewSha256: source.lifecycleReviewSha256,
    complete: closed && localExternalScope && lifecycles.every(row => row.applicability !== 'UNKNOWN'),
    stabilizationWindowLifecycleId: 'season', lifecycles, workloadBinding: workload.binding,
    invocationEvidence: workload.evidence, configurationEvidence: configurationEvidence.evidence,
    initialized: [...initialized], openingInvocations: [...opened], unknownCalls, malformed,
    externalScope: { status: localExternalScope ? 'SCOPED_LOCAL_ONLY' : 'UNKNOWN', values: external || null },
    scope: LIFECYCLE_APPLICABILITY_REVIEW.scope, shorterHorizons: LIFECYCLE_APPLICABILITY_REVIEW.shorterHorizons,
    matrixQualifying: false };
}
