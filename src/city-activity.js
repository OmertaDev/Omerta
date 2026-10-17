import crypto from 'node:crypto';

// Public categories come only from the server's existing public action allowlist.
// Fixed descriptions never copy request bodies, targets or outcomes.
const DESCRIPTIONS = Object.freeze({
  crime: { kind: 'work', label: 'Working a job', venueId: 'fixer' },
  move: { kind: 'move', label: 'Arriving in the neighborhood', venueId: 'waterfront' },
  den: { kind: 'play', label: 'At the tables', venueId: 'clubhouse' },
  race: { kind: 'race', label: 'Racing', venueId: 'training' },
  fights: { kind: 'fight', label: 'At a bout', venueId: 'training' },
  market: { kind: 'trade', label: 'Trading', venueId: 'workshop' },
  flex: { kind: 'trade', label: 'Bidding', venueId: 'stories' },
  vice: { kind: 'social', label: 'Socializing', venueId: 'clubhouse' },
  world: { kind: 'work', label: 'On a group job', venueId: 'clubhouse' },
});
const OWNER_DESCRIPTIONS = Object.freeze({
  train: { kind: 'train', label: 'Training', venueId: 'training' },
  bank: { kind: 'trade', label: 'Banking', venueId: 'workshop' },
  rest: { kind: 'rest', label: 'Rest action completed', venueId: 'clubhouse' },
  fight: { kind: 'fight', label: 'Fight action completed', venueId: 'training' },
  craft: { kind: 'craft', label: 'Crafting action completed', venueId: 'workshop' },
  property: { kind: 'property', label: 'Property action completed', venueId: 'workshop' },
  social: { kind: 'social', label: 'Social action completed', venueId: 'clubhouse' },
  trade: { kind: 'trade', label: 'Trade action completed', venueId: 'workshop' },
  work: { kind: 'work', label: 'Action completed', venueId: 'fixer' },
});
export function cityOwnerActivityCategory(route) {
  // Called only after player auth, with Fastify's registered route template.
  // This private classification must never expand the public ACTIVITY_WIRE.
  const path = /^(?:POST|PUT|PATCH|DELETE) (\/v1\/[A-Za-z0-9_:/-]+)$/.exec(route)?.[1];
  if (!path || /^\/v1\/(?:auth|access|admin|mod|screens|age-check|path-quiz|push|gateway)(?:\/|$)/.test(path)
    || path === '/v1/commands/observations' || path === '/v1/broadcast/shared'
    || path === '/v1/company/forecast/:id' || path === '/v1/company/demand/:id/scenario'
    || /\/(?:preview|quote|preflight|estimate|simulate)$/.test(path)) return null;
  if (/^\/v1\/(?:train|regimen)(?:\/|$)/.test(path)) return 'train';
  if (/^\/v1\/bank(?:\/|$)/.test(path)) return 'bank';
  if (/^\/v1\/(?:heal|checkin)(?:\/|$)/.test(path)) return 'rest';
  if (/^\/v1\/(?:boxing|duels|attacks|wars)(?:\/|$)/.test(path)) return 'fight';
  if (/(?:^|\/)(?:workshop|craft|crafting|recipes)(?:\/|$)/.test(path)) return 'craft';
  if (/^\/v1\/(?:deeds|buildings|assets|rackets|city\/home)(?:\/|$)/.test(path)) return 'property';
  if (/^\/v1\/(?:crew|gangs|contacts|chat|friends|invites|city\/social)(?:\/|$)/.test(path)) return 'social';
  if (/^\/v1\/(?:market|auction|goods|shop|store|trade)(?:\/|$)/.test(path)) return 'trade';
  return 'work';
}

export async function readCityActivityActor(pool, accountId) {
  return (await pool.query(`SELECT id,account_id,generation,loc,alive FROM characters
    WHERE account_id=$1 AND alive ORDER BY created_at DESC,id LIMIT 1`, [accountId])).rows[0] || null;
}

const sameIdentity = (a, b) => a && b && a.id === b.id && a.account_id === b.account_id
  && Number(a.generation) === Number(b.generation);

export function createCityActivityRegistry({ now = Date.now, ttlMs = 60000, limit = 20000, ownerOnly = false } = {}) {
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1 || !Number.isSafeInteger(limit) || limit < 1) {
    throw new TypeError('City activity requires a positive TTL and capacity.');
  }
  // Per-server, best-effort presentation only. Restarting the process clears it.
  const entries = new Map();
  let lastRecordedAt = -Infinity;
  const prune = at => {
    // Records are inserted in timestamp order; discard the disposable cache if
    // the clock moves backward rather than retaining future-dated receipts.
    if (at < lastRecordedAt) entries.clear();
    lastRecordedAt = at;
    for (const [id, entry] of entries) {
      if (at - entry.at < ttlMs) break;
      entries.delete(id);
    }
  };
  return {
    record(before, after, category, destination, idempotencyKey) {
      const description = Object.hasOwn(DESCRIPTIONS, category) ? DESCRIPTIONS[category]
        : ownerOnly && Object.hasOwn(OWNER_DESCRIPTIONS, category) ? OWNER_DESCRIPTIONS[category] : null;
      if (!description || !before?.alive || !after?.alive || !sameIdentity(before, after)
        || !Number.isSafeInteger(Number(after.generation)) || Number(after.generation) < 1
        || (category === 'move' ? after.loc !== destination : before.loc !== after.loc)) return;
      const at = now();
      prune(at);
      const id = ownerOnly ? 'owner:' + (typeof idempotencyKey === 'string' && /^[\x21-\x7e]{1,128}$/.test(idempotencyKey)
        ? idempotencyKey : crypto.randomUUID()) : crypto.randomUUID();
      entries.delete(after.id);
      entries.set(after.id, { accountId: after.account_id, generation: Number(after.generation), district: after.loc, at,
        activity: { id, ...description, at: new Date(at).toISOString() } });
      while (entries.size > limit) entries.delete(entries.keys().next().value);
    },
    read(actor, viewer) {
      const at = now();
      const entry = entries.get(actor.id);
      if (entry && (at - entry.at >= ttlMs || at < entry.at)) {
        entries.delete(actor.id);
        return null;
      }
      if (!entry || actor.account_id !== entry.accountId || Number(actor.generation) !== entry.generation
        || actor.loc !== entry.district || viewer.district !== entry.district || actor.alive === false
        || (ownerOnly && (viewer.characterId !== actor.id || viewer.generation !== entry.generation))) return null;
      return { ...entry.activity };
    },
  };
}
