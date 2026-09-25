// Observer-only metrics from the canonical paginated Knowledge interface.
// Never pass this cross-player result to an actor policy.
import assert from 'node:assert/strict';
import { exactConcentration } from './rc1-world-diagnostics.js';

export async function collectKnowledgeDiagnostics({ roster, readPage, serialBoundary,
  pageSize = 50, maximumPagesPerActor = 10000 }) {
  assert(Array.isArray(roster) && new Set(roster).size === roster.length);
  assert(roster.every((id) => typeof id === 'string' && id.length > 0));
  assert.equal(typeof readPage, 'function');
  assert(typeof serialBoundary === 'string' && serialBoundary.length > 0,
    'Collect only while the isolated world scheduler and actors are quiescent');
  assert(Number.isSafeInteger(pageSize) && pageSize >= 1 && pageSize <= 50);
  assert(Number.isSafeInteger(maximumPagesPerActor) && maximumPagesPerActor > 0);
  const perPlayer = [], readers = new Map();
  for (const accountId of roster) {
    const claims = [], ids = new Set(), cursors = new Set();
    let cursor, pages = 0;
    do {
      assert(pages < maximumPagesPerActor, 'Knowledge pagination bound reached before completion');
      const page = await readPage(accountId, { limit: pageSize, ...(cursor === undefined ? {} : { cursor }) });
      pages++;
      assert(Array.isArray(page.claims) && page.claims.length <= pageSize, 'Malformed canonical Knowledge page');
      assert(page.nextCursor === null || typeof page.nextCursor === 'string' && page.nextCursor.length > 0,
        'Missing or malformed Knowledge continuation');
      for (const claim of page.claims) {
        assert(typeof claim.id === 'string' && claim.id.length > 0 && !ids.has(claim.id),
          'Repeated or invalid Knowledge claim across pages');
        assert.equal(typeof claim.owned, 'boolean');
        assert.equal(typeof claim.domain, 'string');
        assert.equal(typeof claim.contentHash, 'string');
        assert.equal(typeof claim.source?.root, 'string');
        ids.add(claim.id);
        // Count authorized access without retaining claim values, target tokens,
        // grant principals or owner-only ACL details in this metric.
        claims.push({ id: claim.id, owned: claim.owned, domain: claim.domain,
          contentHash: claim.contentHash, sourceRoot: claim.source.root });
        const accounts = readers.get(claim.id) || [];
        accounts.push(accountId); readers.set(claim.id, accounts);
      }
      cursor = page.nextCursor;
      if (cursor !== null) {
        assert(page.claims.length > 0, 'Empty Knowledge page cannot assert continuation');
        assert(!cursors.has(cursor), 'Repeated Knowledge pagination cursor');
        cursors.add(cursor);
      }
    } while (cursor !== null);
    perPlayer.push({ accountId, pages, complete: true, accessibleClaims: claims.length,
      ownedClaims: claims.filter((claim) => claim.owned).length,
      sharedClaims: claims.filter((claim) => !claim.owned).length, claims });
  }
  return { format: 1, serialBoundary, complete: true, pageSize, maximumPagesPerActor,
    consistency: 'Sequential canonical pages at a caller-held isolated serial checkpoint; no concurrent snapshot claim',
    perPlayer, distinctAccessibleClaims: readers.size,
    perClaim: [...readers].sort(([a], [b]) => a.localeCompare(b))
      .map(([claimId, accounts]) => ({ claimId, authorizedDeclaredReaders: accounts.length })),
    accessConcentration: exactConcentration(perPlayer.map((row) => ({ quantity: row.accessibleClaims }))),
    limitations: ['Current authorized claims only; not prerequisite satisfaction or future acquisition reachability',
      'Owned and shared counts overlap claim identities across actors and must not be summed as created Knowledge',
      'Restricted synthetic actor/claim identifiers; observer output must never feed actor choices'] };
}
