// Test actor policy: inputs are authorized player projections and public rules.
// No pool, hidden state, balance setter, or administrative interface is accepted.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const rank = (...parts) => crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex');
export function activeQuietRoster(roster, seed, day) {
  assert(roster.length >= 10); assert.equal(new Set(roster).size, roster.length);
  // A population of 25 cannot have 2.5 active accounts. Choose the lower legal
  // integer extreme (2), declared before execution rather than calling 3 ten percent.
  const count = Math.floor(roster.length / 10);
  return [...roster].sort((a, b) => rank(seed, day, a).localeCompare(rank(seed, day, b))).slice(0, count);
}

export function chooseAuthorizedCommand(view, { seed, accountId, day, action }) {
  assert(Array.isArray(view.commands));
  const candidates = view.commands.filter((command) => command.availability === 'AVAILABLE'
    && typeof command.executionIdentity?.executionId === 'string');
  return [...candidates].sort((a, b) => rank(seed, accountId, day, action, a.commandId)
    .localeCompare(rank(seed, accountId, day, action, b.commandId)))[0] || null;
}

export function choosePublicCrime(character, publicCrimes, { seed, accountId, day }) {
  if (character.jailSeconds > 0) return null;
  const candidates = publicCrimes.filter((crime) => crime.lvl <= character.level && crime.nerve <= character.nerve);
  return [...candidates].sort((a, b) => rank(seed, accountId, day, a.id)
    .localeCompare(rank(seed, accountId, day, b.id)))[0] || null;
}

export function observedOpportunityTracker({ observationWindowMs = 86400000 } = {}) {
  assert(Number.isSafeInteger(observationWindowMs) && observationWindowMs > 0);
  const rows = new Map();
  return {
    observe(accountId, cards, logicalAt) {
      for (const card of cards) {
        assert.equal(typeof card.opportunityId, 'string');
        const key = JSON.stringify([accountId, card.opportunityId]);
        const existing = rows.get(key);
        if (existing) existing.lastSeen = logicalAt;
        else rows.set(key, { accountId, opportunityId: card.opportunityId, firstSeen: logicalAt, lastSeen: logicalAt });
      }
    },
    summarize(logicalAt) {
      const observed = [...rows.values()];
      return { distinctAuthorizedActorOpportunities: observed.length,
        observationsOlderThanWindow: observed.filter((row) => logicalAt - row.firstSeen >= observationWindowMs).length,
        observedAcrossWindow: observed.filter((row) => row.lastSeen - row.firstSeen >= observationWindowMs).length,
        observationWindowMs,
        persistentOpportunities: null,
        ignoredOpportunities: null,
        note: 'Age and separated observations do not prove continuous persistence; ignored/accepted classification requires authoritative command-opportunity linkage.' };
    },
  };
}
