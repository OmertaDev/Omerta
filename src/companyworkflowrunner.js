import { withCharacter, GameError } from './game.js';
import { companyWorkflowDueCandidates, advanceCompanyWorkflowDue } from './companyworkflows.js';

// Each bounded candidate owns a canonical transaction. Waiting proof chains
// yield the due queue so they cannot starve later completed work.
export async function runCompanyWorkflows(pool, limit = 20) {
  const rows = await companyWorkflowDueCandidates(pool, limit), results = [];
  for (const row of rows) {
    const stamp = new Date(row.next_run_at).toISOString();
    const reschedule = client => client.query("UPDATE company_workflows SET next_run_at=clock_timestamp()+interval '60 seconds' WHERE id=$1 AND account_id=$2 AND original_character=$3 AND status='active' AND next_run_at<$4::timestamptz+interval '1 millisecond'",
      [row.id, row.account_id, row.original_character, stamp]);
    try {
      const result = await withCharacter(pool, row.account_id, async (ch, client, h) => {
        const observed = await advanceCompanyWorkflowDue(ch, row.id, client, h);
        await reschedule(client);
        return observed;
      });
      results.push({ workflowId: row.id, pending: result.pending === true, status: result.workflow?.status });
    } catch (error) {
      // Only dispatch metadata changes after rollback. The timestamp comparison
      // preserves successful concurrent cycles and terminal/replaced owners.
      await reschedule(pool);
      if (!(error instanceof GameError)) throw error;
      results.push({ workflowId: row.id, skipped: error.code });
    }
  }
  return { candidates: rows.length, results };
}
