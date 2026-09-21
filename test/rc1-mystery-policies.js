import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createMysteryPolicy, classifyMysteryCommand, MYSTERY_POLICY_CONTRACT } from '../tools/rc1-mystery-policies.js';

const digest = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const at = Date.parse('2026-09-21T00:00:00Z');
const config = (scenarioId = 'high_mystery_participation', accountId = 'actor') => ({ scenarioId, accountId, seed: 'rc1-alpha' });
const command = (type, sequence) => ({ commandId: digest(`${type}:${sequence}`), commandType: type, availability: 'AVAILABLE',
  expiresAt: new Date(at + 60000).toISOString(), executionIdentity: { executionId: `${digest(sequence)}.${digest(`${type}:${sequence}`)}` }, parameters: {} });
const view = (sequence, types = ['mystery.start', 'recipe.craft']) => ({ player: { id: 'actor' }, commandSchemaVersion: 1,
  commands: types.map((type) => command(type, sequence)) });
const select = (policy, projection) => policy.choose(projection, { logicalAt: at });
const complete = (policy, decision, extra = {}) => policy.settle({ status: 'COMPLETED', replayed: false,
  executionId: decision.command.executionIdentity.executionId, ...extra });

for (const scenarioId of ['high_mystery_participation', 'low_mystery_participation']) {
  const policy = createMysteryPolicy(config(scenarioId));
  for (let index = 0; index < 1000; index++) {
    const decision = select(policy, view(index));
    assert.equal(decision.kind, 'command'); complete(policy, decision);
    const summary = policy.summary();
    assert.equal(summary.freshCompletions, index + 1);
    assert.equal(summary.freshInvestigation, scenarioId.startsWith('high') ? Math.floor((index + 1) * 7 / 10) : Math.floor((index + 1) / 20));
  }
  assert.equal(policy.summary().freshInvestigation, scenarioId.startsWith('high') ? 700 : 50);
}
const high = createMysteryPolicy(config());
for (let index = 0; index < 4; index++) complete(high, select(high, view(index, ['mystery.start'])));
assert.equal(high.summary().freshForcedInvestigation, 4);
assert.equal(high.summary().highMixedFraction, null);
assert.equal(high.summary().actualInvestigationFraction, 1, 'Forced choices must not be reported as 70% actual investigation');
for (let index = 4; index < 14; index++) complete(high, select(high, view(index)));
assert.equal(high.summary().freshMixedInvestigation, 7);
assert.equal(high.summary().freshInvestigation, 11);

const low = createMysteryPolicy(config('low_mystery_participation'));
for (let index = 0; index < 40; index++) assert.equal(select(low, view(index, ['discovery.act'])).reason, 'investigation_prefix_cap');
assert.equal(low.summary().freshCompletions, 0, 'Deliberate waits cannot dilute investigation fraction');
for (let index = 40; index < 59; index++) complete(low, select(low, view(index, ['knowledge.share'])));
const twentieth = select(low, view(59, ['discovery.act'])); complete(low, twentieth);
assert.equal(low.summary().freshInvestigation, 1);
assert.equal(select(low, view(60, ['discovery.act'])).reason, 'investigation_prefix_cap');
assert.equal(low.summary().completedByType['knowledge.share'], 19);

// Failed admission, locked/expired/not-issued commands and unknown future types.
const guarded = createMysteryPolicy(config());
assert.throws(() => select(guarded, { ...view(1), player: { id: 'foreign' } }), /another actor/);
assert.throws(() => createMysteryPolicy({ ...config(), pool: {} }));
const prohibited = view(1, ['mystery.start']);
prohibited.commands.push({ ...command('discovery.act', 2), availability: 'LOCKED' },
  { ...command('mystery.complete', 3), availability: 'BLOCKED' },
  { ...command('mystery.choice', 4), executionIdentity: null },
  { ...command('discovery.start', 5), executionIdentity: { executionId: 'not-issued' } },
  { ...command('discovery.start', 6), expiresAt: new Date(at).toISOString() });
Object.defineProperty(prohibited, 'hiddenDatabase', { get() { throw Error('Policy inspected hidden diagnostic state'); } });
assert.equal(select(guarded, prohibited).command.commandId, prohibited.commands[0].commandId);
assert.deepEqual(select(guarded, view(999)), select(guarded, prohibited), 'Pending identity must survive new snapshots');
assert.throws(() => guarded.settle({ executionId: 'foreign', status: 'COMPLETED', replayed: false }));
assert.throws(() => guarded.settle({ executionId: prohibited.commands[0].executionIdentity.executionId, status: 'UNKNOWN' }));
const guardedCheckpoint = guarded.checkpoint();
const restarted = createMysteryPolicy(config()).restore(guardedCheckpoint);
assert.deepEqual(restarted.checkpoint(), guardedCheckpoint);
assert.deepEqual(select(restarted, prohibited), select(guarded, prohibited));
complete(guarded, select(guarded, prohibited)); complete(restarted, select(restarted, prohibited));
assert.deepEqual(restarted.checkpoint(), guarded.checkpoint());
assert.throws(() => createMysteryPolicy(config('low_mystery_participation')).restore(guardedCheckpoint), /another seed/);
const tampered = structuredClone(guardedCheckpoint); tampered.payload.counters.freshCompletions++;
assert.throws(() => createMysteryPolicy(config()).restore(tampered), /checksum/);
const unknown = createMysteryPolicy(config());
assert.throws(() => select(unknown, view(1, ['mystery.fake'])), /Unreviewed/);
assert.throws(() => select(unknown, { ...view(1), commands: [command('recipe.craft', 1), command('recipe.craft', 1)] }), /Duplicate/);
assert.equal(unknown.summary().observations, 0);
assert.equal(classifyMysteryCommand('knowledge.share'), 'other');
assert.equal(classifyMysteryCommand('knowledge.revoke'), 'other');
assert.throws(() => classifyMysteryCommand('mystery.inspect'), /Unreviewed/, 'Read-only locked inspectors are never a counted choice');

// A denial does not spend the quota; a receipt replay does not create a completion.
const denied = createMysteryPolicy(config());
const rejected = select(denied, view(1));
denied.settle({ executionId: rejected.command.executionIdentity.executionId, status: 'DENIED' });
assert.equal(denied.summary().freshCompletions, 0);
const retried = select(denied, view(2)); assert.equal(retried.category, 'other');
complete(denied, retried, { replayed: true });
assert.equal(denied.summary().freshCompletions, 0); assert.equal(denied.summary().unresolvedReplayCompletions, 1);
assert.throws(() => select(denied, view(3)), /Resolve replay/);

// Restart, command order, and authorized auxiliary fields do not alter choices.
const original = createMysteryPolicy(config());
for (let index = 0; index < 23; index++) complete(original, select(original, view(index)));
const resumed = createMysteryPolicy(config()).restore(original.checkpoint());
for (let index = 23; index < 100; index++) {
  const projection = view(index, ['mystery.start', 'mystery.discover', 'recipe.craft', 'knowledge.share']);
  const a = select(original, projection), b = select(resumed, { ...projection, commands: [...projection.commands].reverse(), ignoredDiagnostic: 'never read' });
  assert.deepEqual(a, b); complete(original, a); complete(resumed, b);
}
assert.deepEqual(resumed.checkpoint(), original.checkpoint());
console.log('PASS: mystery quota prefixes, forced choices, deliberate waits, issued projections, denials/replays and deterministic policy restart');

if (process.argv.includes('--postgres')) await nativeExercise();

async function nativeExercise() {
  const [{ commandDatabase }, { coreProgressionContent }, { createPlayerCommandEngine }, { runLedgerInvariants }, proofTools] = await Promise.all([
    import('./lib/player-command-support.js'), import('../src/content/core-progression.js'), import('../src/player-commands.js'),
    import('../src/invariants.js'), import('../tools/rc1-native-proof.js')]);
  const output = process.env.RC1_MYSTERY_POLICY_OUTPUT;
  assert(output, 'Use a fresh restricted output directory');
  const source = await proofTools.sourceIdentity();
  const configuration = { policyContract: MYSTERY_POLICY_CONTRACT, fixture: 'Two default-birth accounts/characters in docks; no earned progression, resources or groups granted.',
    authority: 'In-process canonical PlayerCommand engine with real PostgreSQL; no HTTP token/session coverage',
    exclusions: ['90-day matrix', 'workers/lifecycles', 'legacy policy choices', 'all resource journals', 'Knowledge contention/propagation workload',
      'later entrants and neglected-dependency recovery', 'database restart', 'full-game seeded replay', 'production environment'] };
  const proof = await proofTools.createProofRecorder({ directory: output, source, configuration, runId: 'mystery-policy-native',
    seed: 'rc1-alpha', scenarioId: 'scoped-mystery-policy-authorized-commands', population: 2 });
  let db, result;
  try {
    db = await commandDatabase('mystery_policy');
    for (const account of ['mystery-high', 'mystery-low']) {
      await db.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [account]);
      await db.pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [account]);
      await db.pool.query('INSERT INTO characters(id,account_id,name,season,loc) VALUES($1,$2,$2,$3,$4)',
        [`${account}-character`, account, Math.floor(Date.now() / (28 * 86400000)), 'docks']);
    }
    const engine = createPlayerCommandEngine({ pool: db.pool, content: coreProgressionContent(), enabled: true,
      knowledgeEnabled: true, sharingEnabled: true, operationsEnabled: true, discoveryEnabled: true });
    const baseline = await runLedgerInvariants(db.pool, { alert: false }); assert(baseline.ok);
    await proof.record({ kind: 'measured-initialization', configuration, fixtureWritesAfterThisRecord: false });
    await proof.snapshot(db.pool, 'initial');
    const results = [];
    for (const [scenario, account] of [['high_mystery_participation', 'mystery-high'], ['low_mystery_participation', 'mystery-low']]) {
      let policy = createMysteryPolicy(config(scenario, account)); const options = {};
      for (let step = 0; step < 12; step++) {
        const projection = await proof.invoke('player.snapshot', { account, options }, () => engine.snapshot(account, options));
        const logicalAt = Date.now();
        const decision = policy.choose(projection, { logicalAt });
        if (step === 3) {
          const saved = policy.checkpoint(); await proof.artifact(`${scenario}-pending-checkpoint.json`, saved);
          const restored = createMysteryPolicy(config(scenario, account)).restore(saved);
          // Waits are observations, so compare only pending command recovery.
          if (decision.kind === 'command') assert.deepEqual(restored.choose(projection, { logicalAt }), decision);
          policy = restored;
        }
        await proof.record({ kind: 'policy-choice', account, step, decision, counters: policy.summary() });
        if (decision.kind === 'wait') {
          const before = await proof.snapshot(db.pool, `${account}-${step}-wait-before`);
          const after = await proof.snapshot(db.pool, `${account}-${step}-wait-after`);
          assert.equal(after.stateSha256, before.stateSha256); continue;
        }
        const executionId = decision.command.executionIdentity.executionId;
        if (step === 0) await assert.rejects(() => engine.execute('mystery-low', { executionId, confirmed: true }, executionId));
        const response = await proof.invoke('player.execute', { account, executionId }, () =>
          engine.execute(account, { executionId, confirmed: true }, executionId));
        assert.equal(response.status, 'COMPLETED'); assert.equal(response.replayed, false);
        policy.settle(response);
        if (decision.command.commandType === 'mystery.start') options.mysteryGraphId = decision.command.parameters.graphId;
        const invariants = await runLedgerInvariants(db.pool, { alert: false });
        await proof.record({ kind: 'canonical-invariants', account, step, checks: invariants.checks }); assert(invariants.ok);
      }
      const summary = policy.summary(); results.push(summary); await proof.artifact(`${scenario}-final-policy.json`, policy.checkpoint());
      assert(scenario.startsWith('high') ? summary.freshInvestigation > 0 : summary.freshInvestigation <= Math.floor(summary.freshCompletions / 20));
    }
    const final = await proof.snapshot(db.pool, 'final');
    result = { status: 'PASS_SCOPED', policyResults: results, invariantChecks: baseline.checks.length,
      postgres: (await db.pool.query('SELECT version() AS version')).rows[0].version,
      finalStateSha256: final.stateSha256, matrixQualifying: false, exclusions: configuration.exclusions };
  } catch (error) {
    result = { status: 'FAIL', message: error.message, stack: error.stack }; process.exitCode = 1;
    await proof.record({ kind: 'first-failure', ...result });
    if (db) await proof.snapshot(db.pool, 'failure');
  } finally {
    if (db) try { await db.cleanup(db.pool); }
    catch (error) { result.status = 'FAIL'; result.cleanupError = error.message; process.exitCode = 1; }
    const record = await proof.finish(result); await proofTools.verifyArtifactIndex(output, record);
  }
  console.log(JSON.stringify(result));
}
