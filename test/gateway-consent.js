// Regression for reusing human approval after a known command refusal.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { makeDb } from '../src/db.js';
import { createGatewaySecurity, object } from '../src/gateway/security.js';
import { createAgentGateway } from '../src/gateway/service.js';

assert(!process.env.DATABASE_URL, 'This focused consent regression requires isolated memory mode.');
const pool = await makeDb();
try {
  const accountId = crypto.randomUUID();
  await pool.query('INSERT INTO accounts (id,auth_provider,auth_subject) VALUES ($1,$2,$3)', [accountId, 'consent-test', accountId]);
  let clock = Date.now();
  const security = createGatewaySecurity({ pool, now: () => clock });
  const grant = await security.create(accountId, { provider: 'muse', label: 'Consent regression', scopes: ['omerta.actions.prepare'] });
  const principal = await security.authenticate('Bearer ' + grant.token);
  let cost = 1, statusCode = 429, dispatched = 0, visible = true, loseCommittedResponse = false;
  const receipts = new Map();
  const gateway = createAgentGateway({ pool, security, now: () => clock,
    capabilities: [{ name: 'prepare_crafting_operation', actionClass: 'PREPARE', scopes: ['omerta.actions.prepare'],
      inputSchema: object({ recipeId: { type: 'string' } }, ['recipeId']) }],
    context: { prepare: async () => {
      if (!visible) throw Object.assign(new Error('No longer visible'), { code: 'entity_unavailable' });
      return { available: true, action: 'craft', cost };
    } },
    resolveReceipt: async ({ idempotencyKey }) => receipts.get(idempotencyKey) || null,
    dispatch: async ({ idempotencyKey }) => {
      dispatched++;
      if (loseCommittedResponse) {
        loseCommittedResponse = false;
        receipts.set(idempotencyKey, { statusCode: 200 });
        throw new Error('Response lost after game commit');
      }
      return { statusCode };
    },
  });
  const prepare = async requestId => (await gateway.execute(principal, 'prepare_crafting_operation', { recipeId: 'fixture' }, { requestId })).data;
  const confirm = proposal => gateway.confirm(accountId, proposal.id, { nonce: proposal.nonce, digest: proposal.digest }, 'Bearer player-only');
  for (const refusal of [429, 409, 503]) {
    cost = 1; statusCode = refusal;
    const proposal = await gateway.preparation(accountId, (await prepare(`refusal-${refusal}`)).id);
    await confirm(proposal);
    const before = dispatched;
    cost = 2; statusCode = 200;
    await assert.rejects(() => confirm(proposal), error => ['stale_preparation', 'preparation_unavailable'].includes(error.code),
      `A known HTTP ${refusal} refusal cannot authorize changed terms on retry.`);
    assert.equal(dispatched, before, 'Changed terms never reach the game dispatcher with old approval.');
  }
  const proposal = await prepare('visibility');
  visible = false;
  await assert.rejects(() => prepare('visibility'), { code: 'entity_unavailable' },
    'A repeated request must revalidate current visibility before revealing a private preview.');
  assert(proposal.id);
  visible = true;
  const recovery = await gateway.preparation(accountId, (await prepare('expired-receipt')).id);
  loseCommittedResponse = true;
  await assert.rejects(() => confirm(recovery), /Response lost after game commit/);
  const before = dispatched;
  clock += 600001;
  cost++;
  const recovered = await confirm(recovery);
  assert.equal(recovered.state, 'completed', 'An expired executing proposal can retrieve a committed receipt.');
  assert.equal(dispatched, before, 'Receipt recovery does not execute another command or accept new costs.');
  console.log('gateway-consent: refused/uncertain retries require approved terms; current visibility and expired receipt recovery pass');
} finally { await pool.end(); }
