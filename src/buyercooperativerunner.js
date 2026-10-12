import { withCharacter, GameError } from './game.js';
import { buyerCooperativeDueCandidates, settleBuyerCooperative } from './buyercooperatives.js';

// Expiry only closes the frozen funding window and allocates original members'
// recovery rights. Each claimant still uses the canonical claim transaction.
export async function expireBuyerCooperativeFunding(pool, limit = 20) {
  const rows = await buyerCooperativeDueCandidates(pool, limit), results = [];
  for (const row of rows) {
    try {
      const result = await withCharacter(pool, row.organizer_account, (ch, client, h) =>
        settleBuyerCooperative(ch, row.id, { cancel: false }, `coop:funding-expiry:${row.id}`, client, h));
      results.push({ cooperativeId: row.id, cancelled: result.cancelled === true });
    } catch (error) {
      if (!(error instanceof GameError)) throw error;
      results.push({ cooperativeId: row.id, skipped: error.code });
    }
  }
  return { candidates: rows.length, results };
}
