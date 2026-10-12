import crypto from 'node:crypto';
import { withCharacter, GameError } from './game.js';
import { dueCompanyOperators, runCompanyOperator } from './companyoperators.js';

// Each cycle owns its canonical character transaction. A refused/idle actor is
// rescheduled only after that transaction rolls back, so one idle business cannot
// retain the head of the finite candidate queue or commit a partial operation.
export async function runCompanyOperators(pool, limit = 20) {
  const rows = await dueCompanyOperators(pool, limit);
  const results = [];
  for (const row of rows) {
    const stamp = new Date(row.next_run_at).toISOString();
    const requestKey = `operator:${crypto.createHash('sha256').update(JSON.stringify([row.depot_id, row.revision, stamp])).digest('hex')}`;
    try {
      const result = await withCharacter(pool, row.owner_account, (ch, client, h) =>
        runCompanyOperator(ch, { depotId: row.depot_id, requestKey }, client, h));
      results.push({ depotId: row.depot_id, action: result.action });
    } catch (error) {
      // The one-millisecond upper bound preserves the PG timestamp's sub-ms tail.
      // A concurrent successful cycle moves at least 60s ahead; a policy edit
      // changes revision. Neither can be overwritten by this failed snapshot.
      await pool.query("UPDATE company_operators SET next_run_at=clock_timestamp()+interval '60 seconds' WHERE depot_id=$1 AND owner_account=$2 AND revision=$3 AND next_run_at<$4::timestamptz+interval '1 millisecond'",
        [row.depot_id, row.owner_account, row.revision, stamp]);
      if (!(error instanceof GameError)) throw error;
      results.push({ depotId: row.depot_id, skipped: error.code });
    }
  }
  return { candidates: rows.length, results };
}
