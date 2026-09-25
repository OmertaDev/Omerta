// Native scoped pressure probes. No matrix credit and no production source edits.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { createResourcePressurePolicy, planResourcePressure, RESOURCE_PRESSURE_CONTRACT } from '../tools/rc1-resource-pressure-policy.js';
import { reconcilePressureResources, pressureConcentration } from '../tools/rc1-resource-pressure-journal.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { createWorkerSchedule, installWorkerInstrumentation, bootOriginalWorker, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';
assert(process.argv.includes('--postgres'));
const scenario = process.argv.find(a => a.startsWith('--scenario='))?.split('=')[1], plan = planResourcePressure(scenario);
const output = process.env.RC1_PRESSURE_OUTPUT, controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
assert(output && controlUrl); const source = await sourceIdentity();
const database = planOwnedWorldDatabase({ controlUrl, runId: scenario, sourceRevision: source.revision });
for (const key of ['SEASON_MOD', 'SEASON_PHASE', 'CHAIN_RPC_URL', 'LIQUIDITY_RPC_URL', 'LIQUIDITY_RPC_FALLBACK_URL', 'INVARIANT_WEBHOOK_URL', 'CITY_WIRE_WEBHOOK_URL']) assert(!process.env[key], key);
const epoch = Date.parse('2026-09-20T12:00:00.000Z'), expectedDormant = [{ label: 'RWA health', code: 'health_registry_unavailable' }];
const configuration = { scenario, plan, policy: RESOURCE_PRESSURE_CONTRACT, sourcePins: WORKER_SOURCE_PINS, database: database.descriptor,
  epoch: new Date(epoch).toISOString(), expectedDormant,
  scope: 'Three ordinary entrants. Scarcity is ordinary-entry proxy. Abundance changes only initial respect before baseline, then earns cash through canonical checkin. Ammo always starts25 or is bought with canonical cash. No resource grants.',
  observation: 'Exact stable-roster personal cash/bank/ammo/cb plus listing-linked ammo escrow journal at HTTP and original-worker callback boundaries. Not every commit. Shared observer limitations retained, never waived.',
  limits: { maximumWallMs: 900000, maximumLogicalMinutes: plan.maximumLogicalMinutes, maximumCrimeAttempts: plan.maximumCrimeAttempts },
  exclusions: ['Full scenario/matrix cell', 'All13 resource extremes', 'simultaneous database contention', 'natural level75 progression', 'full fresh-world replay', 'external chain/liquidity/RWA integrations', 'population spawning'] };
Object.assign(process.env, { DATABASE_URL: database.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on', COORDINATION_KNOWLEDGE: 'on', COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', COORDINATION_ACCOUNT_IDS: '', LIVING_WORLD_DIRECTOR: 'LIVE', DIRECTOR_ACCOUNT_IDS: '', RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on', SOCIAL_VERIFY_MODE: 'off', LIQUIDITY_AUTOMATION_ENABLED: 'off', JWT_SECRET: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex') });
const proof = await createProofRecorder({ directory: output, source, configuration, runId: scenario, seed: 'rc1-alpha', scenarioId: scenario, population: 3 });
const runtime = installSerialRuntime('rc1-alpha', configuration.epoch); let at = epoch; runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: value => { at = value; }, expectedDormant });
const namespace = 'rc1_worker_pressure_' + process.pid, base = new pg.Pool({ connectionString: database.url });
const seam = installWorkerInstrumentation(controller, { namespace });
const savedConsole = { log: console.log, warn: console.warn, error: console.error }, started = performance.now();
let app, result, sequence = 0, measured = false, invariantBoundaries = 0, replayChecks = 0, corruptionChecks = 0;
const actors = [], policies = new Map(), summaries = [], sharedLimitations = [], unsupported = [], fixtures = [], completions = new Map();
let requestSequence = 0, buyEvidence = null;
try {
  for (const level of Object.keys(savedConsole)) console[level] = (...args) => controller.log(level, args);
  await proof.record({ kind: 'database-created', ...await database.create() }); await base.query('CREATE SCHEMA ' + namespace);
  const bootstrap = new controller.Pool({ connectionString: database.url, options: '', max: 20 }); await seam.clock.initialize(bootstrap);
  const [{ buildServer }, { runLedgerInvariants }, { PACING }, observer] = await Promise.all([import('../src/server.js'), import('../src/invariants.js'), import('../src/rules.js'), import('../tools/rc1-world-resource-observer.js')]);
  app = await buildServer();
  app.addHook('onResponse', async req => { const key = req.headers['x-rc1-response-completion'], done = completions.get(key); assert(done, 'Missing terminal response completion'); completions.delete(key); done(); });
  const pool = app.pool, resources = () => observer.snapshotWorldResources(pool);
  function guard() { assert(performance.now() - started < configuration.limits.maximumWallMs, 'Wall guardrail exceeded'); assert(at - epoch <= plan.maximumLogicalMinutes * 60000, 'Logical guardrail exceeded'); }
  async function invariants(label) { const r = await runLedgerInvariants(pool, { alert: false }); assert(r.ok, JSON.stringify(r)); invariantBoundaries++; await proof.record({ kind: 'canonical-invariants', label, checks: r.checks }); }
  async function reconcile(before, after, label, command = null) {
    const id = sequence++; let journal;
    try { journal = reconcilePressureResources(before, after, { command }); }
    catch (error) { await proof.artifact('resource-failure-' + id + '.json', { label, command, before, after, message: error.message }); throw error; }
    let shared;
    try { shared = observer.reconcileWorldResources(before, after, { identity: { label }, includeRestrictedChanges: true }); unsupported.push(...shared.unsupported.map(r => ({ label, ...r }))); }
    catch (error) {
      const boundEscrow = journal.escrowChanges.inserted.length + journal.escrowChanges.removed.length;
      if (!boundEscrow || !error.message.startsWith('Unexplained ammo movement for character:')) throw error;
      shared = { status: 'UNSUPPORTED_ESCROW_BOUNDARY', message: error.message, scope: 'Shared observer lacks player ammo escrow attribution. It did not pass this boundary.' };
      sharedLimitations.push({ label, message: error.message });
    }
    await proof.artifact('resource-' + id + '.json', { label, command, before, after, journal, shared });
    summaries.push({ label, equations: journal.equations.length, ammoDelta: journal.ammoDelta, sharedStatus: shared.status });
    await proof.record({ kind: 'pressure-resource-boundary', ...summaries.at(-1) });
    if (command?.path.endsWith('/buy') && command.status === 200 && !command.replayed) buyEvidence = { before, after, command };
  }
  async function raw(actor, method, path, body, key, label) {
    guard(); const identity = { accountId: actor?.accountId || null, method, path, label, logicalAt: at, ...(body === undefined ? {} : { body }), ...(key ? { key } : {}) };
    return proof.invoke('ordinary-http', identity, async () => {
      const completeKey = String(++requestSequence); let timer;
      const completion = new Promise((resolve, reject) => { completions.set(completeKey, resolve); timer = setTimeout(() => reject(new Error('Terminal response hook timeout')), 60000); });
      try {
        const r = await app.inject({ method, url: path, headers: { 'x-rc1-response-completion': completeKey, ...(actor ? { authorization: 'Bearer ' + actor.token } : {}), ...(key ? { 'idempotency-key': key } : {}) }, ...(body === undefined ? {} : { payload: body }) });
        await completion; return { status: r.statusCode, replayed: r.headers['x-idempotent-replay'] === 'true', body: r.json() };
      } finally { clearTimeout(timer); completions.delete(completeKey); }
    });
  }
  async function invoke(actor, method, path, body, key, label, expected = 200) {
    const before = measured ? await resources() : null, r = await raw(actor, method, path, body, key, label);
    if (measured) await reconcile(before, await resources(), label, { actorId: actor?.characterId || null, method, path, body: body ?? null, status: r.status, replayed: r.replayed, response: r.body });
    if (expected !== null) assert.equal(r.status, expected, JSON.stringify(r));
    if (measured && method !== 'GET') await invariants(label); return r;
  }
  for (let index = 0; index < plan.population; index++) {
    const bootstrapSecret = crypto.randomBytes(32).toString('base64url'); await proof.artifact('entry-' + index + '-secret.json', { bootstrapSecret });
    const guest = await invoke(null, 'POST', '/v1/auth/guest', { bootstrapSecret }, undefined, 'entry-guest-' + index);
    const actor = { index, accountId: app.jwt.verify(guest.body.token).sub, token: guest.body.token };
    const created = await invoke(actor, 'POST', '/v1/character', { name: 'Pressure ' + index }, 'entry-' + index, 'entry-character-' + index);
    actor.characterId = created.body.id; actors.push(actor); await proof.artifact('entry-' + index + '-session.json', actor);
    policies.set(actor.accountId, createResourcePressurePolicy({ accountId: actor.accountId, seed: 'rc1-alpha', scenario }));
  }
  await proof.snapshot(pool, 'ordinary-entry');
  const entry = await resources();
  for (const ch of entry.tables.characters) for (const [key, value] of Object.entries(plan.initial).filter(([k]) => k !== 'omr')) assert.equal(Number(ch[key]), value);
  for (const account of entry.tables.account_persistent) assert.equal(Number(account.omr), 0);
  if (plan.progressionFixtureLevel) for (const actor of actors) {
    const change = { characterId: actor.characterId, field: 'respect', before: 0, after: PACING.LEVEL_DIVISOR * (plan.progressionFixtureLevel - 1) ** 2 };
    await proof.invoke('declared-initialization-only-progression', change, async () => { const r = await pool.query('UPDATE characters SET respect=$2 WHERE id=$1 AND respect=0', [actor.characterId, change.after]); assert.equal(r.rowCount, 1); return { rows: r.rowCount }; }); fixtures.push(change);
  }
  await proof.artifact('initialization.json', { plan, fixtures, directResourceGrants: 0 }); measured = true;
  await invariants('baseline'); await proof.snapshot(pool, 'baseline');
  await proof.artifact('baseline-concentration.json', pressureConcentration(await resources()));
  let beforeBoot = await resources(); await bootOriginalWorker(controller); await reconcile(beforeBoot, await resources(), 'original-worker-boot'); await invariants('original-worker-boot');
  const rules = (await invoke(actors[0], 'GET', '/v1/rules', undefined, undefined, 'public-rules')).body;
  async function view(actor, label) {
    return { accountId: actor.accountId,
      session: (await invoke(actor, 'GET', '/v1/session', undefined, undefined, label + '-session')).body,
      me: (await invoke(actor, 'GET', '/v1/me', undefined, undefined, label + '-me')).body,
      exchange: (await invoke(actor, 'GET', '/v1/exchange', undefined, undefined, label + '-exchange')).body, rules };
  }
  async function choose(actor, phase, label) {
    const projection = await view(actor, label), policy = policies.get(actor.accountId), choice = policy.choose(projection, { phase, logicalAt: at });
    await proof.artifact(label + '-choice.json', { projection, choice, checkpoint: policy.checkpoint() });
    if (choice.kind === 'command') { const restored = createResourcePressurePolicy({ accountId: actor.accountId, seed: 'rc1-alpha', scenario }).restore(policy.checkpoint()); assert.deepEqual(restored.choose(projection, { phase, logicalAt: at }), choice); policies.set(actor.accountId, restored); }
    return choice;
  }
  async function execute(actor, choice, label, expected = 200) {
    assert.equal(choice.kind, 'command'); const q = choice.request;
    const r = await invoke(actor, q.method, q.path, q.body, q.idempotencyKey, label, expected);
    assert([200, 400].includes(r.status), JSON.stringify(r)); policies.get(actor.accountId).settle({ idempotencyKey: q.idempotencyKey, status: r.status === 200 ? 'COMPLETED' : 'DENIED', replayed: r.replayed, response: r.body }); return r;
  }
  async function act(actor, phase, label) { const choice = await choose(actor, phase, label); return { choice, response: await execute(actor, choice, label) }; }
  async function advance(seconds) {
    await controller.advanceTo(at + seconds * 1000, async (logicalAt, label) => { guard(); const after = await resources(); await reconcile(last, after, 'worker:' + label); await invariants('worker:' + label); last = await resources(); });
  }
  let last;
  async function wait(seconds) { last = await resources(); await advance(seconds); await reconcile(last, await resources(), 'logical-wait-end'); }
  for (const actor of actors) { const paid = await act(actor, 'checkin', 'checkin-' + actor.index); assert.equal(paid.response.body.pay, plan.canonicalFirstCheckin); }
  await proof.artifact('funded-concentration.json', pressureConcentration(await resources()));
  if (scenario === 'resource_abundance') for (let round = 0; round < 3; round++) for (const actor of actors) await act(actor, 'replenish-ammo', 'initial-paid-ammo-' + round + '-' + actor.index);
  else {
    assert.equal((await choose(actors[0], 'replenish-ammo', 'scarce-armory-gate')).kind, 'wait');
    const refused = await invoke(actors[0], 'POST', '/v1/armory/ammo', {}, 'scarce-armory-negative', 'scarce-armory-native-refusal', 400); assert.equal(refused.body.error, 'cash');
  }
  const lot = await act(actors[0], 'list', 'contested-list');
  const decisions = []; // Choices deliberately share a still-live public lot; execution remains serial.
  decisions.push(await choose(actors[1], 'take', 'buyer-one-observation'), await choose(actors[2], 'take', 'buyer-two-observation'));
  assert.equal(decisions[0].request.path, decisions[1].request.path);
  const winner = await execute(actors[1], decisions[0], 'first-buyer-wins');
  const stale = await execute(actors[2], decisions[1], 'stale-buyer-loses', 400); assert.equal(stale.body.error, 'gone');
  const replayBefore = await proof.snapshot(pool, 'before-exact-buy-replay');
  const replay = await execute(actors[1], decisions[0], 'exact-buy-replay'); assert(replay.replayed); assert.deepEqual(replay.body, winner.body);
  assert.equal((await proof.snapshot(pool, 'after-exact-buy-replay')).stateSha256, replayBefore.stateSha256); replayChecks++;
  const ownLot = await act(actors[1], 'list', 'returnable-list');
  const foreign = await invoke(actors[2], 'DELETE', '/v1/exchange/' + ownLot.response.body.listingId, {}, 'foreign-cancel', 'foreign-cancel-refused', 400); assert.equal(foreign.body.error, 'no_listing');
  const cancelled = await act(actors[1], 'cancel', 'owner-cancel'); assert.equal(cancelled.response.body.qty, 25);
  const cancelBefore = await proof.snapshot(pool, 'before-cancel-replay');
  const cancelReplay = await execute(actors[1], cancelled.choice, 'exact-cancel-replay'); assert(cancelReplay.replayed);
  assert.equal((await proof.snapshot(pool, 'after-cancel-replay')).stateSha256, cancelBefore.stateSha256); replayChecks++;
  let crimeAttempts = 0;
  if (scenario === 'resource_scarcity') {
    const unaffordable = await act(actors[2], 'list', 'unaffordable-live-lot');
    assert.equal((await choose(actors[1], 'take', 'unaffordable-public-gate')).reason, 'no-affordable-public-ammo-lot');
    const denied = await invoke(actors[1], 'POST', '/v1/exchange/' + unaffordable.response.body.listingId + '/buy', {}, 'unaffordable-native', 'unaffordable-native-refusal', 400);
    assert.equal(denied.body.error, 'cash');
    await act(actors[2], 'cancel', 'unpaid-lot-owner-refund');
    while ((await view(actors[0], 'replenish-quote-' + crimeAttempts)).me.character.cash < 2000) {
      assert(crimeAttempts < plan.maximumCrimeAttempts, 'Canonical cash replenishment attempt bound');
      const choice = await choose(actors[0], 'progress', 'crime-' + crimeAttempts);
      if (choice.kind === 'wait') { await wait(60); continue; }
      await execute(actors[0], choice, 'crime-' + crimeAttempts++);
    }
    await act(actors[0], 'replenish-ammo', 'scarce-canonical-ammo-replenishment');
  } else {
    for (let i = 0; i < 2; i++) { await act(actors[0], 'list', 'abundant-list-' + i); await act(actors[1], 'take', 'abundant-concentrate-' + i); }
    for (const actor of actors) await act(actor, 'hoard', 'bank-hoard-' + actor.index);
  }
  if (at < epoch + plan.minimumLogicalMinutes * 60000) await wait((epoch + plan.minimumLogicalMinutes * 60000 - at) / 1000);
  const finalResource = await resources(); await proof.artifact('final-concentration.json', pressureConcentration(finalResource)); await invariants('final');
  const final = await proof.snapshot(pool, 'final-positive');
  assert(buyEvidence); const controls = [];
  for (const [name, mutate] of [
    ['foreign-owner-receipt', s => { s.tables.transactions.find(r => r.reason === 'exchange:sale').character_id = actors[2].characterId; }],
    ['duplicate-receipt', s => { s.tables.transactions.push(structuredClone(s.tables.transactions.find(r => r.reason === 'exchange:buy'))); }],
    ['balanced-wrong-custody', s => { const buyer = s.tables.characters.find(r => r.id === actors[1].characterId), other = s.tables.characters.find(r => r.id === actors[2].characterId); buyer.ammo = String(Number(buyer.ammo) - 1); other.ammo = String(Number(other.ammo) + 1); }],
    ['wrong-command-actor', null]
  ]) {
    const altered = structuredClone(buyEvidence.after), command = structuredClone(buyEvidence.command); if (mutate) mutate(altered); else command.actorId = actors[2].characterId;
    let rejected = null; try { reconcilePressureResources(buyEvidence.before, altered, { command }); } catch (e) { rejected = e.message; }
    assert(rejected, name + ' escaped'); controls.push({ name, rejected, provenance: 'Counterfactual alteration of exact retained native boundary' }); corruptionChecks++;
    await proof.artifact('negative-' + name + '.json', { before: buyEvidence.before, originalAfter: buyEvidence.after, alteredAfter: altered, command, rejected });
  }
  // Actual committed balanced corruption at the terminal boundary: retain it, detect it, then destroy the owned database. No repair or continuation.
  const corruptBefore = await resources();
  await proof.invoke('declared-terminal-native-corruption', { donor: actors[1].characterId, foreignRecipient: actors[2].characterId, ammo: 1 }, async () => {
    const client = await pool.connect(); try { await client.query('BEGIN'); await client.query('UPDATE characters SET ammo=ammo-1 WHERE id=$1', [actors[1].characterId]); await client.query('UPDATE characters SET ammo=ammo+1 WHERE id=$1', [actors[2].characterId]); await client.query('COMMIT'); return { committed: true }; } finally { client.release(); }
  });
  const corruptAfter = await resources(); let rejection;
  try { reconcilePressureResources(corruptBefore, corruptAfter); } catch (e) { rejection = e.message; }
  assert(rejection?.startsWith('Per-owner ammo parity:'), 'Balanced committed corruption escaped per-owner journal'); corruptionChecks++;
  await proof.artifact('terminal-native-corruption.json', { before: corruptBefore, after: corruptAfter, rejection }); await proof.snapshot(pool, 'terminal-corrupt-state');
  const trace = controller.diagnostic(); assert.equal(trace.failures.length, 0);
  await proof.artifact('worker-schedule.json', trace); await proof.artifact('random-tape.json', { draws: runtime.tape });
  await proof.artifact('policies.json', [...policies].map(([accountId, policy]) => ({ accountId, checkpoint: policy.checkpoint(), summary: policy.summary() })));
  await proof.artifact('resources-summary.json', { summaries, sharedLimitations, unsupported, controls, qualifyingFullResourcePass: false });
  result = { status: 'PASS_SCOPED', scenario, ordinaryEntrants: 3, activeActors: 3, directResourceGrants: 0, progressionFixtures: fixtures.length,
    freshPolicyActions: [...policies.values()].reduce((n, p) => n + p.summary().fresh, 0), crimeAttempts, staleLotDenials: 1, exactStateReplays: replayChecks,
    corruptionControls: corruptionChecks, logicalSeconds: (at - epoch) / 1000, resourceBoundaries: summaries.length, sharedObserverEscrowLimitations: sharedLimitations.length,
    unsupportedResourceClassifications: unsupported.length, invariantBoundaries, finalPositiveStateSha256: final.stateSha256,
    terminalState: 'Deliberately corrupted native custody retained after positive proof; no continuation or repair', matrixQualifying: false, qualifyingFullResourcePass: false };
} catch (error) {
  result = { status: 'FAIL', message: error.message, stack: error.stack, logicalAt: at }; process.exitCode = 1;
  await proof.record({ kind: 'first-failure', ...result }); await proof.artifact('failure-schedule.json', controller.diagnostic()); await proof.artifact('failure-random.json', { draws: runtime.tape });
  if (app) await proof.snapshot(app.pool, 'failure');
} finally {
  Object.assign(console, savedConsole);
  for (const close of [async () => { if (app) await app.close(); }, () => controller.close(), () => base.end(), async () => proof.record({ kind: 'database-cleanup', ...await database.close() })]) {
    try { await close(); } catch (error) { result.status = 'FAIL'; result.cleanupFailure = error.message; process.exitCode = 1; await proof.record({ kind: 'cleanup-failure', message: error.message }); }
  }
  seam.restore(); runtime.restore(); const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify(result));
