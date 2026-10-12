import { withCharacter, GameError } from './game.js';
import { dueCompanyOpportunitySubscriptions, refreshCompanyOpportunities } from './companyopportunities.js';

// Informational refreshes use the same account transaction as a player request.
// Failed accounts yield the finite queue without changing subscription consent.
export async function runCompanyOpportunities(pool, limit = 25) {
  const rows = await dueCompanyOpportunitySubscriptions(pool, limit), results = [];
  for (const row of rows) {
    const stamp = new Date(row.next_refresh_at).toISOString();
    const reschedule = client => client.query("UPDATE company_opportunity_subscriptions SET next_refresh_at=clock_timestamp()+interval '300 seconds' WHERE account_id=$1 AND revision=$2 AND enabled AND next_refresh_at<$3::timestamptz+interval '1 millisecond'",
      [row.account_id, row.revision, stamp]);
    try {
      const result = await withCharacter(pool, row.account_id, async (ch, client) => {
        const observed = await refreshCompanyOpportunities(ch, client);
        await reschedule(client);
        return observed;
      });
      results.push({ accountId: row.account_id, refreshed: result.refreshed === true });
    } catch (error) {
      await reschedule(pool);
      if (!(error instanceof GameError)) throw error;
      results.push({ accountId: row.account_id, skipped: error.code });
    }
  }
  return { candidates: rows.length, results };
}
