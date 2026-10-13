import { withCharacter, GameError } from './game.js';
import { dueBusinessSeasonEntries, observeBusinessSeason } from './businessseasons.js';

// Observation never executes trades or awards money. Each original account uses
// its canonical transaction; failed entries yield the finite observation queue.
export async function runBusinessSeasons(pool, limit = 25) {
  const rows = await dueBusinessSeasonEntries(pool, limit), results = [];
  for (const row of rows) {
    const stamp = new Date(row.next_observation_at).toISOString();
    const reschedule = client => client.query("UPDATE business_season_entries SET next_observation_at=clock_timestamp()+interval '30 seconds' WHERE season_id=$1 AND account_id=$2 AND original_character=$3 AND visibility_revision=$4 AND final_result IS NULL AND next_observation_at<$5::timestamptz+interval '1 millisecond'",
      [row.season_id, row.account_id, row.original_character, row.visibility_revision, stamp]);
    try {
      const result = await withCharacter(pool, row.account_id, async (ch, client) => {
        const observed = await observeBusinessSeason(ch, row.season_id, client);
        await reschedule(client);
        return observed;
      });
      results.push({ seasonId: row.season_id, phase: result.phase });
    } catch (error) {
      await reschedule(pool);
      if (!(error instanceof GameError)) throw error;
      results.push({ seasonId: row.season_id, skipped: error.code });
    }
  }
  return { candidates: rows.length, results };
}
