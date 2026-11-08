import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { checkRateLimit } from '../src/ratelimit.js';

const accountId = randomUUID();
const read = { accountId, agent: true, path: '/v1/agent/turn', turnObservation: true };
const act = { accountId, agent: true, path: '/v1/agent/act' };
assert.equal(await checkRateLimit(read), null, 'one compact observation is available');
assert.equal(await checkRateLimit(act), null, 'the observation leaves one immediate mutation slot');
assert.ok((await checkRateLimit(read))?.retryAfter > 0, 'repeated observations are still throttled');
assert.ok((await checkRateLimit(act))?.retryAfter > 0, 'repeated mutations retain the hard cadence');
assert.ok((await checkRateLimit({ accountId, agent: true, path: '/v1/me' }))?.retryAfter > 0,
  'other reads remain in the action bucket');
console.log('Agent Turn observation/action quotas are independently bounded; mutation and other-read limits remain enforced.');
