// Scoped market workload. Only canonical player views and retained own receipts are inputs.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const copy = (value) => structuredClone(value);
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const identity = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value);
export const MARKET_POLICY_CONTRACT = Object.freeze({ version: 1, scenarioId: 'market_stress',
  inputs: 'Verified bearer account context, ordinary /v1/session, /v1/me, /v1/market and public /v1/rules goods catalog. No other actor inventory, database diagnostics, hidden reserve or bidder identity.',
  scope: 'One-unit fixed-price goods post/buy, buy-order post/fill, own live listing cancellation and receipt-linked order claim. Auctions, car transfers and hidden market inventory remain excluded.',
  phases: 'Runner records post/take/cancel/claim/mixed phase before choosing. Seed ranks actual publicly plausible candidates; phase is workload scheduling, never evidence of canonical eligibility.',
  posting: 'One unit at the published minimum total ask, original one-hour expiry. A $10 fee floor and upper-bound base fee mirror reviewed src/market.js. Discounts can lower the charge; the server revalidates slots, cost and state.',
  admission: 'The public board has a 100-row window; absent rows do not prove absence. Candidate gates are conservative public plausibility, not omniscient admission. Races and limits remain canonical denials.',
  custody: 'Retain exact own posting receipts and identities. A warehouse claim requires a current public own order with fewer wanted units than the posted quantity minus already claimed units. Canonical authority revalidates unseen external-session changes.',
  replay: 'Persist pending identity before dispatch. A lost response never generates a new key. Known exact replay changes no fresh counter; an unknown completed replay remains unresolved and blocks further selection.',
  qualification: 'No 100-inflight soak, full resource taxonomy, all market branches, 90-day or matrix qualification.' });
const counters = () => ({ observations: 0, choices: 0, waits: 0, fresh: 0, denials: 0, knownReplays: 0, unresolvedReplays: 0 });
function validate(state, configuration) {
  assert.equal(state.version, 1); assert.deepEqual(state.configuration, configuration);
  assert.deepEqual(Object.keys(state.counters).sort(), Object.keys(counters()).sort());
  for (const value of Object.values(state.counters)) assert(Number.isSafeInteger(value) && value >= 0);
  const c = state.counters;
  assert.equal(c.observations, c.choices + c.waits);
  assert.equal(c.choices, c.fresh + c.denials + c.unresolvedReplays + Number(!!state.pending));
  assert.equal(state.settled.length, c.fresh + c.denials + c.unresolvedReplays);
  assert.equal(new Set(state.settled).size, state.settled.length);
  assert.equal(Object.values(state.completedByType).reduce((a, n) => a + n, 0), c.fresh);
}
export function createMarketPolicy(configuration) {
  assert.deepEqual(Object.keys(configuration).sort(), ['accountId', 'seed']);
  assert(identity(configuration.accountId)); assert(typeof configuration.seed === 'string' && configuration.seed.length > 0);
  configuration = copy(configuration);
  let state = { version: 1, configuration, counters: counters(), pending: null, settled: [], receipts: [], ownedPosts: [], completedByType: {} };
  return {
    choose(view, { logicalAt, phase = 'mixed' }) {
      assert(Number.isSafeInteger(logicalAt) && logicalAt >= 0);
      assert(['post', 'take', 'cancel', 'claim', 'mixed'].includes(phase));
      assert.equal(view.accountId, configuration.accountId, 'Foreign account context');
      const own = view.me?.character;
      assert(view.session?.authed === true && own && view.session.character?.id === own.id, 'Foreign own-character view');
      assert(identity(own.id)); assert(Array.isArray(view.market?.listings)); assert(Array.isArray(view.rules?.goods));
      if (state.pending) {
        assert.equal(own.id, state.pending.characterId, 'Resolve pending market request before selecting on a replacement');
        return copy(state.pending);
      }
      assert.equal(state.counters.unresolvedReplays, 0, 'Unresolved completion after replay');
      const candidates = [], seen = new Set(), cargo = own.cargo || {};
      const load = Object.values(cargo).reduce((n, value) => n + Number(value), 0), space = own.cargoCap - load;
      const add = (type, path, body, stableId, details = {}) => candidates.push({ type, request: { method: 'POST', path, body }, stableId, ...details });
      if (own.jailSeconds === 0) {
        for (const listing of view.market.listings) {
          assert(identity(listing.id) && identity(listing.sellerId), 'Invalid public listing identity');
          assert(!seen.has(listing.id), 'Duplicate public listing'); seen.add(listing.id);
          if (!(listing.expiresSeconds > 0) || !['good', 'order'].includes(listing.kind)) continue;
          const mine = listing.sellerId === own.id;
          if (mine && ['cancel', 'mixed'].includes(phase) && (listing.kind === 'order' || space >= listing.qty))
            add('market.cancel', '/v1/market/' + listing.id + '/cancel', {}, listing.id);
          const prior = state.ownedPosts.find((post) => post.id === listing.id && post.characterId === own.id);
          if (mine && prior && listing.kind === 'order' && ['claim', 'mixed'].includes(phase) && space > 0
            && listing.district === own.loc && prior.qty - listing.wanted - prior.claimed > 0)
            add('market.claim', '/v1/market/' + listing.id + '/claim', {}, listing.id);
          if (mine || listing.district !== own.loc || !['take', 'mixed'].includes(phase)) continue;
          if (listing.kind === 'good' && listing.qty >= 1 && listing.unitPrice > 0 && own.cash >= listing.unitPrice && space >= 1)
            add('market.buy', '/v1/market/' + listing.id + '/buy', { qty: 1 }, listing.id);
          if (listing.kind === 'order' && listing.wanted >= 1 && Number(cargo[listing.good] || 0) >= 1)
            add('market.fill', '/v1/market/' + listing.id + '/fill', { qty: 1 }, listing.id);
        }
        if (['post', 'mixed'].includes(phase)) {
          const price = view.market.levers?.minPrice, feeBps = view.market.levers?.listFeeBps;
          assert(Number.isSafeInteger(price) && price > 0 && Number.isSafeInteger(feeBps) && feeBps >= 0, 'Missing public posting terms');
          const maximumFee = Math.max(10, Math.ceil(price * feeBps / 10000));
          for (const good of view.rules.goods) {
            assert(identity(good.id), 'Invalid public good identity');
            if (Number(cargo[good.id] || 0) >= 1 && own.cash >= maximumFee)
              add('market.post-good', '/v1/market', { goodId: good.id, qty: 1, price, hours: 1 }, good.id);
            else if (own.safeSeconds === 0 && own.cash >= price + maximumFee)
              add('market.post-order', '/v1/market/order', { goodId: good.id, qty: 1, price, hours: 1 }, good.id,
                { publicReferencePrice: Number(good.base) });
          }
        }
      }
      state.counters.observations++;
      if (!candidates.length) { state.counters.waits++; return { kind: 'wait', phase,
        classification: 'No implemented publicly plausible market choice in this recorded phase; unseen board rows and other authorities remain unassessed.' }; }
      const priority = (c) => c.type === 'market.claim' ? 3 : c.type === 'market.post-good' ? 2 : c.type === 'market.cancel' ? 1 : 0;
      candidates.sort((a, b) => priority(b) - priority(a)
        || (a.type === 'market.post-order' && b.type === 'market.post-order' ? a.publicReferencePrice - b.publicReferencePrice : 0)
        || hash([configuration, state.counters.choices, a.type, a.stableId])
        .localeCompare(hash([configuration, state.counters.choices, b.type, b.stableId])));
      const chosen = copy(candidates[0]);
      chosen.request.idempotencyKey = 'rc1-market-' + hash([configuration, state.counters.choices, own.id, chosen.request]);
      state.pending = { kind: 'command', characterId: own.id, logicalAt, phase, observedCandidates: candidates.length, ...chosen };
      state.counters.choices++; validate(state, configuration); return copy(state.pending);
    },
    settle({ idempotencyKey, status, replayed, response }) {
      assert(['COMPLETED', 'DENIED'].includes(status));
      const known = state.receipts.find((receipt) => receipt.idempotencyKey === idempotencyKey);
      if (known) {
        assert(replayed === true && known.status === status && known.responseSha256 === hash(response), 'Conflicting replay receipt');
        state.counters.knownReplays++; return this.summary();
      }
      assert(state.pending && idempotencyKey === state.pending.request.idempotencyKey, 'Unexpected market completion identity');
      assert.equal(typeof replayed, 'boolean'); const choice = state.pending, c = state.counters;
      if (status === 'COMPLETED' && !replayed) {
        assert.equal(response?.ok, true);
        if (response.character) assert.equal(response.character.id, choice.characterId, 'Foreign response character');
        if (choice.type.startsWith('market.post-')) {
          assert(identity(response.id)); assert.equal(response.kind, choice.type === 'market.post-good' ? 'good' : 'order');
          assert.equal(response.good, choice.request.body.goodId); assert.equal(response.price, choice.request.body.price);
          assert.equal(response.kind === 'good' ? response.qty : response.wanted, 1);
          assert.equal(response.expiresSeconds, 3600);
          state.ownedPosts.push({ id: response.id, characterId: choice.characterId, kind: response.kind, good: response.good,
            qty: 1, claimed: 0, cancelled: false, originallyExpiresAt: choice.logicalAt + 3600000 });
        } else if (choice.type === 'market.cancel') {
          assert.equal(response.cancelled, choice.stableId);
          const own = state.ownedPosts.find((post) => post.id === choice.stableId); if (own) own.cancelled = true;
        } else if (choice.type === 'market.claim') {
          assert(response.claimed > 0); state.ownedPosts.find((post) => post.id === choice.stableId).claimed += response.claimed;
        } else if (choice.type === 'market.buy') assert(response.bought && response.qty > 0);
        else if (choice.type === 'market.fill') assert(response.delivered > 0);
        c.fresh++; state.completedByType[choice.type] = (state.completedByType[choice.type] || 0) + 1;
      } else if (status === 'DENIED') c.denials++;
      else c.unresolvedReplays++;
      if (!replayed || status === 'DENIED') state.receipts.push({ idempotencyKey, status, responseSha256: hash(response) });
      state.settled.push(idempotencyKey); state.pending = null; validate(state, configuration); return this.summary();
    },
    checkpoint() { validate(state, configuration); const payload = copy(state); return { payload, sha256: hash(payload) }; },
    restore(checkpoint) { assert.equal(checkpoint.sha256, hash(checkpoint.payload), 'Checkpoint checksum mismatch');
      validate(checkpoint.payload, configuration); state = copy(checkpoint.payload); return this; },
    summary() { validate(state, configuration); return { ...copy(state.counters), completedByType: copy(state.completedByType),
      retainedOwnPosts: copy(state.ownedPosts), matrixQualifying: false }; },
  };
}
