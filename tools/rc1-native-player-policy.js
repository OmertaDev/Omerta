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
    checkpoint() { return { format: 2, observationWindowMs, rows: structuredClone([...rows.values()]) }; },
    restore(data) {
      assert.equal(rows.size, 0, 'Restore observations before adding new sightings');
      assert.equal(data.format, 2); assert.equal(data.observationWindowMs, observationWindowMs);
      assert(Array.isArray(data.rows));
      const retained = new Map();
      for (const row of data.rows) {
        assert.deepEqual(Object.keys(row).sort(), ['acceptedAt', 'accountId', 'commandIds', 'executionId', 'expiresAt', 'firstSeen', 'lastSeen', 'opportunityId']);
        assert.equal(typeof row.accountId, 'string'); assert.equal(typeof row.opportunityId, 'string');
        assert(Number.isSafeInteger(row.firstSeen) && Number.isSafeInteger(row.lastSeen) && row.lastSeen >= row.firstSeen);
        assert(Array.isArray(row.commandIds) && row.commandIds.every(id => typeof id === 'string'));
        assert.equal(new Set(row.commandIds).size, row.commandIds.length);
        assert(row.expiresAt === null || Number.isSafeInteger(row.expiresAt));
        assert(row.acceptedAt === null || Number.isSafeInteger(row.acceptedAt) && row.acceptedAt >= row.firstSeen);
        assert(row.acceptedAt === null ? row.executionId === null : typeof row.executionId === 'string');
        const key = JSON.stringify([row.accountId, row.opportunityId]); assert(!retained.has(key), 'Duplicate retained observation');
        retained.set(key, structuredClone(row));
      }
      for (const [key, row] of retained) rows.set(key, row);
    },
    observe(accountId, cards, logicalAt) {
      assert.equal(typeof accountId, 'string'); assert(Number.isSafeInteger(logicalAt));
      for (const card of cards) {
        assert.equal(typeof card.opportunityId, 'string');
        const commandIds = card.commandIds || [];
        assert(Array.isArray(commandIds) && commandIds.every(id => typeof id === 'string'));
        const expiresAt = card.expiresAt == null ? null : new Date(card.expiresAt).getTime();
        assert(expiresAt === null || Number.isSafeInteger(expiresAt));
        const key = JSON.stringify([accountId, card.opportunityId]);
        const existing = rows.get(key);
        if (existing) {
          assert(logicalAt >= existing.lastSeen, 'Opportunity observations must be chronological');
          existing.lastSeen = logicalAt; existing.commandIds = [...new Set(commandIds)]; existing.expiresAt = expiresAt;
        } else rows.set(key, { accountId, opportunityId: card.opportunityId, firstSeen: logicalAt, lastSeen: logicalAt,
          commandIds: [...new Set(commandIds)], expiresAt, acceptedAt: null, executionId: null });
      }
      return rows.size;
    },
    accept(accountId, command, response, logicalAt) {
      assert(Number.isSafeInteger(logicalAt)); assert.equal(command.availability, 'AVAILABLE');
      assert.equal(typeof command.executionIdentity?.executionId, 'string');
      assert.equal(response.executionId, command.executionIdentity.executionId);
      assert.equal(response.status, 'COMPLETED'); assert.equal(typeof response.replayed, 'boolean');
      // Replayed receipts prove no new action. A prior recorded acceptance is retained.
      if (response.replayed) return;
      for (const row of rows.values()) if (row.accountId === accountId && row.commandIds.includes(command.commandId)) {
        assert(logicalAt >= row.lastSeen, 'Acceptance precedes authorized observation');
        if (row.acceptedAt === null) { row.acceptedAt = logicalAt; row.executionId = response.executionId; }
      }
    },
    summarize(logicalAt, roster = []) {
      assert(Number.isSafeInteger(logicalAt));
      const observed = [...rows.values()];
      assert(observed.every(row => row.lastSeen <= logicalAt && (row.acceptedAt === null || row.acceptedAt <= logicalAt)),
        'Summarize the current checkpoint, not a time before retained observations');
      const empty = () => ({ generatedAuthorizedOpportunities: 0, acceptedOpportunities: 0, ignoredOpportunities: 0, pendingOpportunities: 0 });
      const totals = empty(), players = new Map(roster.map(accountId => [accountId, empty()]));
      for (const row of observed) {
        if (!players.has(row.accountId)) players.set(row.accountId, empty());
        const classification = row.acceptedAt !== null ? 'acceptedOpportunities'
          : logicalAt - row.firstSeen >= observationWindowMs || row.expiresAt !== null && logicalAt >= row.expiresAt
            ? 'ignoredOpportunities' : 'pendingOpportunities';
        for (const target of [totals, players.get(row.accountId)]) { target.generatedAuthorizedOpportunities++; target[classification]++; }
      }
      return { distinctAuthorizedActorOpportunities: observed.length,
        observationsOlderThanWindow: observed.filter((row) => logicalAt - row.firstSeen >= observationWindowMs).length,
        observedAcrossWindow: observed.filter((row) => row.lastSeen - row.firstSeen >= observationWindowMs).length,
        observationWindowMs,
        persistentOpportunities: null,
        ...totals,
        perPlayer: [...players].sort(([a], [b]) => a.localeCompare(b)).map(([accountId, counts]) => ({ accountId, ...counts })),
        note: 'Generated counts distinct authorized actor/opportunity exposures, never unseen world rows. Acceptance requires the issued linked command and a fresh completed receipt. Unaccepted exposure is ignored at canonical expiry or the declared observation window; disappearance alone is not expiry. Counts describe current classification and do not assert continuous persistence.' };
    },
  };
}
