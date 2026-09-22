// The already-observed read boundary pins the original deterministic selection.
// No SQL, RNG draw, authority decision or player state is added.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canonicalJson, sha256 } from './rc1-native-proof.js';
import { dayOf } from '../src/rules.js';

export const DUEL_SELECTION_SQL = `SELECT id FROM characters WHERE alive AND season < $1 AND duel_limit IS NOT NULL
      ORDER BY duel_elo DESC, id ASC LIMIT 1`;
const source = () => fs.readFileSync(new URL('../src/worker.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
export function captureDuelSelection(identity, before, after) {
  if (identity.sqlSha256 !== sha256(DUEL_SELECTION_SQL)) return null;
  assert.equal(identity.context?.authority, 'original-worker');
  assert.equal(identity.outcome, 'AUTOCOMMITTED'); assert.equal(identity.command, 'SELECT');
  assert.equal(canonicalJson(before.tables), canonicalJson(after.tables), 'Duel selection changed state');
  const text = source();
  assert.equal(text.split(DUEL_SELECTION_SQL).length, 2, 'Original duel selection site changed');
  assert(text.includes('const current = opts.season ?? Math.floor(dayOf() / 28);'));
  const current = Math.floor(dayOf(identity.context.logicalAt) / 28);
  const candidates = before.tables.characters.filter(row => row.alive && row.season < current && row.duel_limit !== null);
  // UUID identities have the same ordering in the supported database collations.
  for (const row of candidates) { assert(/^[0-9a-f-]{36}$/.test(row.id), 'Unproved duel identity collation'); assert(Number.isSafeInteger(row.duel_elo)); }
  const ordered = [...candidates].sort((a, b) => b.duel_elo - a.duel_elo || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { format: 1, sourceSha256: sha256(text), boundary: structuredClone(identity), current,
    candidates: structuredClone(candidates), selected: ordered[0]?.id || null };
}

export function verifyDuelAward(before, after, prior, finalAccount, account, current, identity, witness) {
  assert(witness && witness.format === 1, 'Duel title lacks original selection boundary');
  assert.equal(witness.sourceSha256, sha256(source()), 'Duel selection source changed');
  assert.equal(witness.boundary.sqlSha256, sha256(DUEL_SELECTION_SQL));
  assert.equal(witness.current, current); assert.equal(witness.selected, prior.id);
  assert(witness.boundary.sequence < identity.sequence, 'Duel selection is not before its award');
  assert.equal(witness.boundary.context.logicalAt, identity.context.logicalAt, 'Duel selection belongs to another worker time');
  assert.equal(identity.context.authority, 'original-worker'); assert.equal(identity.outcome, 'COMMITTED');
  const candidates = [...witness.candidates].sort((a, b) => b.duel_elo - a.duel_elo || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  assert.equal(candidates[0]?.id, prior.id, 'Duel award differs from canonical winner');
  assert.equal(candidates[0].duel_elo, prior.duel_elo, 'Duel rating changed after selection');
  assert.equal(candidates[0].account_id, prior.account_id);
  assert.equal(finalAccount.duel_titles, account.duel_titles + 1, 'Duel title delta differs');
  const old = new Map(before.tables.notifications.map(row => [row.id, row]));
  const added = after.tables.notifications.filter(row => !old.has(row.id));
  assert.equal(added.length, 1, 'Duel award needs exactly one fresh notification');
  assert.equal(after.tables.notifications.length, old.size + 1);
  for (const row of after.tables.notifications) if (old.has(row.id)) assert.deepEqual(row, old.get(row.id));
  const notice = added[0];
  assert.equal(notice.character_id, prior.id); assert.equal(notice.type, 'duel_champion');
  assert.equal(notice.payload, JSON.stringify({ season: current, elo: Number(prior.duel_elo) }));
  assert.equal(notice.delivered, false); assert.equal(notice.pushed, false);
  assert.equal(Date.parse(notice.created_at), identity.context.logicalAt);
  return notice.id;
}
