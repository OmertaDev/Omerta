import assert from 'node:assert/strict';
import { createLawPolicy } from '../tools/rc1-law-policy.js';
const config = { accountId: 'own-account', seed: 'rc1-alpha' }, at = 1000;
const view = () => ({ accountId: 'own-account', session: { authed: true, character: { id: 'own-character' } },
  me: { character: { id: 'own-character', level: 1, nerve: 10, heat: 0, jailSeconds: 0 } },
  law: { indicted: false, exposure: 0, stage: 'clean', graceSeconds: 0, plea: null },
  rules: { crimes: [{ id: 'pick', lvl: 1, nerve: 2 }, { id: 'locked', lvl: 2, nerve: 1 }],
    crimeApproaches: [{ id: 'loud', heat: 6 }, { id: 'quiet', heat: 0 }], pacing: { nerveRegenPerMin: 6 } } });
const choose = (policy, v, phase = 'pressure') => policy.choose(v, { logicalAt: at, phase });
const p = createLawPolicy(config), first = choose(p, view());
assert.equal(first.request.path, '/v1/crimes/pick'); assert.deepEqual(first.request.body, { approach: 'loud' });
const restored = createLawPolicy(config).restore(p.checkpoint());
assert.deepEqual(choose(restored, view(), 'plea'), first, 'Pending identity survives changed requested phase');
const success = { ok: true, success: true, approach: 'loud', take: 80, rep: 2 };
assert.throws(() => restored.settle({ idempotencyKey: 'not-issued', status: 'COMPLETED', replayed: false, response: success }), /identity/);
restored.settle({ idempotencyKey: first.request.idempotencyKey, status: 'COMPLETED', replayed: false, response: success });
restored.settle({ idempotencyKey: first.request.idempotencyKey, status: 'COMPLETED', replayed: true, response: success });
assert.equal(restored.summary().fresh, 1); assert.equal(restored.summary().knownReplays, 1);
assert.throws(() => restored.settle({ idempotencyKey: first.request.idempotencyKey, status: 'COMPLETED', replayed: true,
  response: { ...success, take: 90 } }), /Conflicting/);
const hot = view(); hot.me.character.heat = 100;
assert.equal(choose(createLawPolicy(config), hot).reason, 'sustained-heat-observation-window');
const jailed = view(); jailed.me.character.jailSeconds = 239;
const wait = choose(createLawPolicy(config), jailed, 'recover'); assert.equal(wait.reason, 'original-detention'); assert.equal(wait.retryAfterSeconds, 239);
const depleted = view(); depleted.me.character.nerve = 0;
assert.equal(choose(createLawPolicy(config), depleted).retryAfterSeconds, 20);
assert.equal(choose(createLawPolicy(config), view(), 'plea').reason, 'no-issued-indictment');
const indicted = view(); Object.assign(indicted.law, { indicted: true, stage: 'indicted', exposure: 3001, graceSeconds: 21600,
  plea: { jailSeconds: 240, forfeitRate: 0.15 } });
assert.equal(choose(createLawPolicy(config), indicted, 'await-sweep').retryAfterSeconds, 21600);
assert.equal(choose(createLawPolicy(config), indicted, 'recover').reason, 'unresolved-indictment');
const pleaPolicy = createLawPolicy(config), plea = choose(pleaPolicy, indicted, 'plea');
pleaPolicy.settle({ idempotencyKey: plea.request.idempotencyKey, status: 'COMPLETED', replayed: false,
  response: { ok: true, forfeited: 75, jailSeconds: 240 } });
assert.equal(pleaPolicy.summary().pleaded, 1); assert.equal(pleaPolicy.summary().forfeited, 75);
const recovery = choose(pleaPolicy, view(), 'recover'); assert.equal(recovery.request.body.approach, 'quiet');
pleaPolicy.settle({ idempotencyKey: recovery.request.idempotencyKey, status: 'DENIED', replayed: false, response: { error: 'jailed' } });
assert.equal(pleaPolicy.summary().denials, 1); assert.equal(pleaPolicy.summary().fresh, 1);
const lostPolicy = createLawPolicy(config), lost = choose(lostPolicy, view());
lostPolicy.settle({ idempotencyKey: lost.request.idempotencyKey, status: 'COMPLETED', replayed: true, response: success });
const resumed = createLawPolicy(config).restore(lostPolicy.checkpoint());
assert.deepEqual(resumed.checkpoint().payload.unresolved[0].decision, lost);
assert.throws(() => choose(resumed, view()), /Unresolved/); assert.equal(resumed.summary().fresh, 0);
const foreign = view(); foreign.accountId = 'other'; assert.throws(() => choose(createLawPolicy(config), foreign), /Foreign/);
foreign.accountId = config.accountId; foreign.session.character.id = 'other'; assert.throws(() => choose(createLawPolicy(config), foreign), /Foreign/);
const hidden = view(); Object.defineProperty(hidden, 'database', { get() { throw Error('Hidden database used'); } });
Object.defineProperty(hidden.law, 'hiddenTarget', { get() { throw Error('Hidden target used'); } }); choose(createLawPolicy(config), hidden);
const bad = p.checkpoint(); bad.payload.counters.fresh++; assert.throws(() => createLawPolicy(config).restore(bad), /checksum/);
assert.throws(() => createLawPolicy({ ...config, pool: {} }));
console.log('PASS: Law public pressure gates, original detention waits, exact identities and unresolved restart state');
