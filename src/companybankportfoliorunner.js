import { withCharacter, GameError } from './game.js';
import { companyBankPortfolioDueCandidates, runCompanyBankPortfolioDue } from './companybankportfolios.js';

// An idle receipt must yield the finite queue and change its next due key.
// Canonical Loans remains the sole money/escrow owner.
export async function runCompanyBankPortfolios(pool, limit = 20) {
  const rows = await companyBankPortfolioDueCandidates(pool, limit), results = [];
  for (const row of rows) {
    const stamp = new Date(row.next_run_at).toISOString();
    const reschedule = client => client.query("UPDATE company_bank_portfolios SET next_run_at=clock_timestamp()+interval '60 seconds' WHERE account_id=$1 AND owner_character=$2 AND revision=$3 AND enabled=true AND next_run_at<$4::timestamptz+interval '1 millisecond'",
      [row.account_id, row.owner_character, row.revision, stamp]);
    try {
      const result = await withCharacter(pool, row.account_id, async (ch, client, h) => {
        const performed = await runCompanyBankPortfolioDue(ch, client, h);
        await reschedule(client);
        return performed;
      });
      results.push({ accountId: row.account_id, idle: result.idle === true, funded: result.funded });
    } catch (error) {
      // The action has rolled back; only guarded dispatch metadata advances.
      await reschedule(pool);
      if (!(error instanceof GameError)) throw error;
      results.push({ accountId: row.account_id, skipped: error.code });
    }
  }
  return { candidates: rows.length, results };
}
