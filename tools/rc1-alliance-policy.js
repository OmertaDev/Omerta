// Bounded three-Family information cooperation; pacts never imply Knowledge authority.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const copy = (v) => structuredClone(v);
const hash = (v) => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const receiptHash = (v) => { const { replayed: _replayed, ...body } = v; return hash(body); };
const id = (v) => typeof v === 'string' && /^[a-zA-Z0-9_.-]+$/.test(v);
export const ALLIANCE_POLICY_CONTRACT = Object.freeze({ version: 1,
  authority: 'Verified account, own session/me, public Family directory and diplomacy board; ordinary Coordination catalog, own instance, visible Knowledge and owner-issued target board. No private observer inputs.',
  semantics: 'Three-Family diplomacy pacts are social relationships only. Cross-Family evidence uses explicit owner-to-account grants. Readers cannot reshare. Current ACLs and independently discovered complementary sources govern the no-reward Split Ledger conclusion.',
  unsupported: ['Alliance-wide ACL inheritance', 'cross-Family operation execution (requires uniform same-Family Crew)', 'anti-hegemon coalition warfare', 'cash/item operation contributions', '90-day/25-actor/three-seed matrix'],
  replay: 'Persist the exact selected request, revision, opaque target and action identity before dispatch. A lost response retains pending identity. An unknown completed replay is retained and blocks further selections; known replay receipts must match apart from the authored replay flag.' });
const freshState = (configuration) => ({ version: 1, configuration, characterId: null, instanceId: null, pending: null,
  choices: 0, waits: 0, fresh: 0, denied: 0, knownReplays: 0, receipts: [], unresolved: [], byType: {} });
function validate(s, c) {
  assert.equal(s.version, 1); assert.deepEqual(s.configuration, c);
  for (const field of ['choices', 'waits', 'fresh', 'denied', 'knownReplays']) assert(Number.isSafeInteger(s[field]) && s[field] >= 0);
  assert.equal(s.choices, s.fresh + s.denied + s.unresolved.length + Number(!!s.pending));
  assert.equal(s.receipts.length, s.fresh + s.denied);
  assert.equal(new Set(s.receipts.map((r) => r.key)).size, s.receipts.length);
  assert.equal(Object.values(s.byType).reduce((a, b) => a + b, 0), s.fresh);
  for (const r of s.unresolved) assert.equal(r.responseHash, receiptHash(r.response));
}
export function createAlliancePolicy(configuration) {
  assert.deepEqual(Object.keys(configuration).sort(), ['accountId', 'seed']); assert(id(configuration.accountId));
  assert(typeof configuration.seed === 'string' && configuration.seed); configuration = copy(configuration);
  let state = freshState(configuration);
  return {
    choose(view, { logicalAt, phase, targetFamilyId = null, targetLabel = null, nodeId = null, claimId = null, districtId = null } = {}) {
      assert(Number.isSafeInteger(logicalAt) && logicalAt >= 0);
      assert(['pact', 'travel', 'create', 'act', 'share', 'revoke', 'archive', 'link'].includes(phase));
      assert(Object.keys(view).every((k) => ['accountId', 'session', 'me', 'directory', 'diplomacy', 'rules', 'catalog', 'instance', 'knowledge', 'targets'].includes(k)), 'Unapproved policy input');
      assert.equal(view.accountId, configuration.accountId, 'Foreign account context');
      const own = view.me?.character;
      assert(view.session?.authed === true && id(own?.id) && view.session.character?.id === own.id, 'Wrong own-character view');
      assert(state.characterId === null || own.id === state.characterId, 'Replacement requires a new explicit policy cursor');
      if (state.pending) return copy(state.pending);
      assert.equal(state.unresolved.length, 0, 'Unresolved completed replay'); state.characterId = own.id;
      const wait = (reason) => { state.waits++; return { kind: 'wait', phase, reason, scope: 'This bounded selection only' }; };
      const seeded = (a, b) => hash([configuration, state.choices, a.id]).localeCompare(hash([configuration, state.choices, b.id]));
      let type, path, body;
      if (phase === 'pact') {
        if (!own.gang || !['boss', 'underboss'].includes(own.gang.role)) return wait('not-family-officer');
        const target = view.directory?.gangs?.find((g) => g.id === targetFamilyId && g.id !== own.gang.id && !g.npc);
        if (!target) return wait('target-not-public');
        assert(Array.isArray(view.diplomacy?.relations));
        const r = view.diplomacy.relations.find((v) => v.withId === target.id);
        if (r?.active) return wait('pact-already-active');
        if (r?.pending && r.mine) return wait('offer-already-pending');
        if (view.diplomacy.oathbreaker) return wait('oathbreaker');
        const accept = r?.pending && !r.mine;
        type = accept ? 'pact.accept' : 'pact.propose'; path = '/v1/diplomacy/pact/' + target.id + (accept ? '/accept' : ''); body = {};
      } else if (phase === 'travel') {
        if (own.loc === districtId) return wait('already-at-district');
        if (!view.rules?.districts?.some((d) => d.id === districtId)) return wait('district-not-public');
        if (own.cash < view.rules.travelCost || own.jailSeconds > 0) return wait('travel-not-eligible');
        type = 'travel'; path = '/v1/travel/' + districtId; body = {};
      } else if (phase === 'create') {
        if (state.instanceId) return wait('instance-already-recorded');
        const graph = view.catalog?.graphs?.find((g) => g.id === 'omerta.coordination.split-ledger');
        if (!graph) return wait('graph-not-issued');
        assert(/^[a-f0-9]{64}$/.test(graph.contentHash)); type = 'coordination.create';
        path = '/v1/coordination/' + graph.id + '/instances'; body = { expectedContentHash: graph.contentHash };
      } else if (phase === 'act') {
        const instance = view.instance; assert(state.instanceId && instance?.id === state.instanceId, 'Wrong instance cursor');
        assert(Number.isSafeInteger(instance.revision) && Array.isArray(instance.actions));
        if (instance.status !== 'active') return wait('instance-terminal');
        const actions = instance.actions.filter((a) => !nodeId || a.nodeId === nodeId).sort(seeded);
        if (!actions.length) return wait('no-currently-issued-action');
        type = 'coordination.act'; path = '/v1/coordination/instances/' + instance.id + '/act';
        body = { expectedRevision: instance.revision, actionId: actions[0].id };
      } else {
        assert(Array.isArray(view.knowledge?.claims));
        const claims = view.knowledge.claims.filter((c) => !claimId || c.id === claimId).sort(seeded);
        if (phase === 'share' || phase === 'revoke') {
          const claim = claims.find((c) => c.owned === true && Number.isSafeInteger(c.aclRevision));
          if (!claim) return wait('no-owned-current-claim');
          if (phase === 'share') {
            if (claim.grants.some((g) => g.kind === 'account' && g.label === targetLabel)) return wait('grant-already-active');
            if (!(Date.parse(view.targets?.expiresAt) > logicalAt)) return wait('target-board-expired');
            const target = view.targets?.targets?.find((t) => t.kind === 'account' && t.label === targetLabel);
            if (!target) return wait('target-not-issued');
            type = 'knowledge.share'; body = { targetId: target.id, expectedAclRevision: claim.aclRevision };
          } else {
            const grant = claim.grants.find((g) => g.kind === 'account' && g.label === targetLabel);
            if (!grant) return wait('no-owned-active-grant');
            type = 'knowledge.revoke'; body = { grantId: grant.id, expectedAclRevision: claim.aclRevision };
          }
          path = '/v1/coordination/knowledge/' + claim.id + '/' + phase;
        } else if (phase === 'archive') {
          if (!claims.length) return wait('claim-not-visible');
          type = 'knowledge.archive'; path = '/v1/coordination/knowledge/archive'; body = { claimId: claims[0].id };
        } else {
          const owned = claims.find((c) => c.owned), other = claims.find((c) => !c.owned && owned && c.domain === owned.domain
            && c.proposition === owned.proposition && c.contentHash === owned.contentHash);
          if (!owned || !other) return wait('no-visible-compatible-claims');
          type = 'knowledge.link'; path = '/v1/coordination/knowledge/links';
          body = { fromClaimId: owned.id, toClaimId: other.id, relation: 'corroborates' };
        }
      }
      const request = { method: 'POST', path, body };
      request.idempotencyKey = 'rc1-alliance-' + hash([configuration, state.choices, own.id, request]);
      state.pending = { kind: 'command', phase, type, characterId: own.id, logicalAt, request }; state.choices++;
      validate(state, configuration); return copy(state.pending);
    },
    settle({ idempotencyKey, status, replayed, response }) {
      assert(['COMPLETED', 'DENIED'].includes(status)); assert.equal(typeof replayed, 'boolean');
      const known = state.receipts.find((r) => r.key === idempotencyKey);
      if (known) { assert(replayed && known.status === status && known.responseHash === receiptHash(response), 'Conflicting replay'); state.knownReplays++; return this.summary(); }
      assert(state.pending?.request.idempotencyKey === idempotencyKey, 'Wrong completion identity'); const choice = state.pending;
      if (status === 'COMPLETED' && replayed) state.unresolved.push({ decision: copy(choice), response: copy(response), responseHash: receiptHash(response) });
      else {
        if (status === 'COMPLETED') {
          if (choice.type.startsWith('pact.') || choice.type === 'travel') assert(response.ok === true);
          if (choice.type.startsWith('coordination.')) {
            assert(id(response.instance?.id));
            if (choice.type === 'coordination.create') state.instanceId = response.instance.id;
            else assert.equal(response.instance.id, state.instanceId);
          }
          if (['knowledge.share', 'knowledge.revoke'].includes(choice.type)) assert.equal(response.claim?.id, choice.request.path.split('/')[4]);
          if (choice.type === 'knowledge.archive') assert(id(response.archive?.id));
          if (choice.type === 'knowledge.link') assert(id(response.link?.id));
          state.fresh++; state.byType[choice.type] = (state.byType[choice.type] || 0) + 1;
        } else { assert(typeof response.error === 'string'); state.denied++; }
        state.receipts.push({ key: idempotencyKey, status, responseHash: receiptHash(response) });
      }
      state.pending = null; validate(state, configuration); return this.summary();
    },
    checkpoint() { validate(state, configuration); const payload = copy(state); return { payload, sha256: hash(payload) }; },
    restore(checkpoint) { assert.equal(checkpoint.sha256, hash(checkpoint.payload), 'Checkpoint checksum mismatch'); validate(checkpoint.payload, configuration); state = copy(checkpoint.payload); return this; },
    summary() { validate(state, configuration); return { choices: state.choices, waits: state.waits, fresh: state.fresh, denied: state.denied,
      knownReplays: state.knownReplays, unresolvedReplays: state.unresolved.length, byType: copy(state.byType), instanceId: state.instanceId, matrixQualifying: false }; },
  };
}
