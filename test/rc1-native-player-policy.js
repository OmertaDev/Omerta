import assert from 'node:assert/strict';
import { activeQuietRoster, chooseAuthorizedCommand, choosePublicCrime, observedOpportunityTracker } from '../tools/rc1-native-player-policy.js';
const roster = Array.from({ length: 25 }, (_, i) => `actor-${i}`);
assert.equal(activeQuietRoster(roster, 'seed', 0).length, 2);
assert.deepEqual(activeQuietRoster(roster, 'seed', 0), activeQuietRoster([...roster].reverse(), 'seed', 0));
const command = { commandId: 'visible', availability: 'AVAILABLE', executionIdentity: { executionId: 'issued' } };
const request = { seed: 'seed', accountId: 'actor', day: 0, action: 0 };
assert.equal(chooseAuthorizedCommand({ commands: [command, { commandId: 'hidden', availability: 'LOCKED' }] }, request), command);
assert.equal(chooseAuthorizedCommand({ commands: [{ ...command, executionIdentity: null }] }, request), null);
assert.equal(choosePublicCrime({ level: 1, nerve: 3, jailSeconds: 0 }, [{ id: 'costly', lvl: 1, nerve: 4 }], request), null);
assert.equal(choosePublicCrime({ level: 1, nerve: 4, jailSeconds: 1 }, [{ id: 'eligible', lvl: 1, nerve: 4 }], request), null);
const opportunities = observedOpportunityTracker({ observationWindowMs: 100 });
opportunities.observe('actor', [{ opportunityId: 'a' }], 0);
opportunities.observe('actor', [{ opportunityId: 'a' }], 5);
assert.equal(opportunities.summarize(50).observationsOlderThanWindow, 0);
assert.equal(opportunities.summarize(100).observationsOlderThanWindow, 1);
assert.equal(opportunities.summarize(100).observedAcrossWindow, 0);
opportunities.observe('actor', [{ opportunityId: 'a' }], 100);
assert.equal(opportunities.summarize(100).observedAcrossWindow, 1);
assert.equal(opportunities.summarize(100).persistentOpportunities, null);
assert.equal(opportunities.summarize(100).ignoredOpportunities, 1);
const outcomes = observedOpportunityTracker({ observationWindowMs: 100 });
const cards = [{ opportunityId: 'accepted', commandIds: ['visible'] },
  { opportunityId: 'expired', commandIds: ['other'], expiresAt: new Date(50).toISOString() },
  { opportunityId: 'window', commandIds: [] }];
outcomes.observe('actor', cards, 0);
outcomes.observe('outsider', cards, 0);
const receipt = { executionId: 'issued', status: 'COMPLETED', replayed: false };
assert.throws(() => outcomes.accept('actor', command, { ...receipt, executionId: 'forged' }, 10));
assert.throws(() => outcomes.accept('actor', command, { ...receipt, status: 'FAILED' }, 10));
outcomes.accept('outsider', command, { ...receipt, replayed: true }, 10);
outcomes.accept('actor', command, receipt, 10);
outcomes.accept('actor', command, { ...receipt, replayed: true }, 20);
outcomes.observe('actor', [], 40); // Disappearance and another actor's action do not prove acceptance or expiry.
assert.equal(outcomes.summarize(49).acceptedOpportunities, 1);
assert.equal(outcomes.summarize(49).ignoredOpportunities, 0);
assert.equal(outcomes.summarize(50).ignoredOpportunities, 2);
assert.equal(outcomes.summarize(100).ignoredOpportunities, 5);
const state = outcomes.checkpoint(), resumed = observedOpportunityTracker({ observationWindowMs: 100 });
resumed.restore(state);
assert.deepEqual(resumed.summarize(100, ['inactive']), outcomes.summarize(100, ['inactive']));
assert.deepEqual(resumed.summarize(100, ['inactive']).perPlayer.find(row => row.accountId === 'inactive'),
  { accountId: 'inactive', generatedAuthorizedOpportunities: 0, acceptedOpportunities: 0, ignoredOpportunities: 0, pendingOpportunities: 0 });
const invalid = structuredClone(state); invalid.rows[0].acceptedAt = -1;
assert.throws(() => observedOpportunityTracker({ observationWindowMs: 100 }).restore(invalid));
console.log('PASS: deterministic authorized policy, exposure/receipt linkage, expiry/window classification, actor isolation and restart preservation');
