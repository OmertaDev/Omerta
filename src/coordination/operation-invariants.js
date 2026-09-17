import { withItemRead } from '../items.js';

const TERMINAL = new Set(['completed', 'failed', 'canceled', 'expired']);
function groupBy(rows, field) {
  const groups = new Map();
  for (const row of rows) {
    let group = groups.get(row[field]);
    if (!group) { group = []; groups.set(row[field], group); }
    group.push(row);
  }
  return groups;
}
const requirementKey = (row) => JSON.stringify([row.role_id, row.requirement_id]);
export async function familyOperationInvariants(pool) {
  return withItemRead(pool, async (client) => {
    const operations = (await client.query("SELECT id,status,revision FROM world_operations WHERE coordination_mode='family'")).rows;
    const events = (await client.query(`SELECT operation_id,COUNT(DISTINCT revision) AS revisions,MAX(revision) AS latest
      FROM world_operation_events GROUP BY operation_id`)).rows;
    const edge = (await client.query(`SELECT e.operation_id,e.revision,g.mutation_kind,g.result_json FROM world_operation_events e
      JOIN world_operations o ON o.id=e.operation_id AND o.revision=e.revision
      LEFT JOIN item_mutation_guards g ON g.mutation_id=e.mutation_id WHERE e.ordinal=0`)).rows;
    const commitments = (await client.query('SELECT * FROM world_operation_commitments')).rows;
    const capital = (await client.query('SELECT * FROM world_operation_capital')).rows;
    const contributions = (await client.query(`SELECT c.* FROM world_operation_contributions c
      JOIN world_operations o ON o.id=c.operation_id WHERE o.coordination_mode='family'`)).rows;
    const escrow = (await client.query(`SELECT e.* FROM operation_escrow e
      JOIN world_operations o ON o.id=e.operation_id WHERE o.coordination_mode='family'`)).rows;
    const stacks = (await client.query(`SELECT s.* FROM item_stacks s JOIN world_operations o ON o.id=s.owner_id
      WHERE s.owner_scope='operation' AND o.coordination_mode='family'`)).rows;
    const ledger = (await client.query(`SELECT currency,reason,counterparty,character_id,account_id,SUM(amount) AS amount
      FROM transactions WHERE reason LIKE 'coordination:capital:%'
      GROUP BY currency,reason,counterparty,character_id,account_id`)).rows;
    const historyIssues = [], custodyIssues = [], capitalIssues = [];
    const byOperation = new Map(operations.map((o) => [o.id, o]));
    // Index each result once. Auditing another operation never rescans all other
    // operations' history/custody, including when corrupt data exceeds author bounds.
    const histories = new Map(events.map((r) => [r.operation_id, r]));
    const roots = new Map(edge.map((r) => [r.operation_id, r]));
    const promisesByOperation = groupBy(commitments, 'operation_id');
    const cashByOperation = groupBy(capital, 'operation_id');
    const contributionsByOperation = groupBy(contributions, 'operation_id');
    const escrowByOperation = groupBy(escrow, 'operation_id');
    const stacksByOperation = groupBy(stacks, 'owner_id');
    const balances = new Map();
    for (const row of ledger) {
      const reason = row.reason.slice('coordination:capital:'.length);
      if (row.currency !== 'cash' || !['deposit', 'refund', 'spend', 'forfeit'].includes(reason)
        || !byOperation.has(row.counterparty)) { capitalIssues.push(`${row.counterparty}:ledger`); continue; }
      let amount;
      try { amount = BigInt(row.amount); } catch { capitalIssues.push(`${row.counterparty}:amount`); continue; }
      const personal = ['deposit', 'refund'].includes(reason);
      if ((personal && (!row.character_id || !row.account_id)) || (!personal && (row.character_id || row.account_id))
        || (reason === 'refund' ? amount <= 0n : amount >= 0n)) capitalIssues.push(`${row.counterparty}:ledger-shape`);
      balances.set(row.counterparty, (balances.get(row.counterparty) || 0n) + (personal ? -amount : amount));
    }
    for (const operation of operations) {
      const history = histories.get(operation.id), root = roots.get(operation.id);
      let receipt;
      try { receipt = JSON.parse(root?.result_json); } catch { /* checked below */ }
      if (Number(history?.revisions) !== Number(operation.revision) || Number(history?.latest) !== Number(operation.revision)
        || root?.mutation_kind !== 'operation_action' || receipt?.operationId !== operation.id
        || receipt?.revision !== Number(operation.revision) || receipt?.status !== operation.status) historyIssues.push(`${operation.id}:history`);
      const promises = promisesByOperation.get(operation.id) || [];
      const heldCash = (cashByOperation.get(operation.id) || []).filter((r) => r.state === 'held');
      const promisesByRequirement = new Map(promises.map((r) => [requirementKey(r), r]));
      const actualContributions = new Map((contributionsByOperation.get(operation.id) || []).map((r) => [r.node_id, r]));
      const heldItems = escrowByOperation.get(operation.id) || [];
      const itemsById = new Map(heldItems.map((r) => [r.item_id, r]));
      const fulfilledItems = new Set();
      if (heldCash.reduce((sum, r) => sum + BigInt(r.amount), 0n) !== (balances.get(operation.id) || 0n)) capitalIssues.push(`${operation.id}:balance`);
      if (TERMINAL.has(operation.status) && (heldCash.length || promises.some((r) => ['promised', 'fulfilled'].includes(r.state)))) custodyIssues.push(`${operation.id}:terminal`);
      for (const row of heldCash) {
        const promise = promisesByRequirement.get(requirementKey(row));
        if (!promise || promise.kind !== 'capital' || promise.state !== 'fulfilled' || promise.account_id !== row.account_id
          || promise.character_id !== row.character_id || Number(promise.quantity) !== Number(row.amount)) capitalIssues.push(`${operation.id}:unbound`);
      }
      const expectedStacks = new Map();
      for (const promise of promises) {
        const contribution = actualContributions.get(`${promise.role_id}/${promise.requirement_id}`);
        if (['fulfilled', 'spent'].includes(promise.state)
          ? !contribution || contribution.account_id !== promise.account_id || contribution.character_id !== promise.character_id
          : !!contribution) custodyIssues.push(`${operation.id}:contribution`);
        if (promise.state !== 'fulfilled') continue;
        if (promise.kind === 'resource') expectedStacks.set(promise.template_id,
          (expectedStacks.get(promise.template_id) || 0) + Number(promise.quantity));
        if (promise.kind === 'item') {
          fulfilledItems.add(promise.item_id);
          const item = itemsById.get(promise.item_id);
          if (!item || item.depositor_scope !== 'account' || item.depositor_id !== promise.account_id) custodyIssues.push(`${operation.id}:item`);
        }
      }
      for (const row of stacksByOperation.get(operation.id) || []) {
        if (row.quality !== 'standard' || Number(row.quantity) !== (expectedStacks.get(row.template_id) || 0)) custodyIssues.push(`${operation.id}:materials`);
        expectedStacks.delete(row.template_id);
      }
      if ([...expectedStacks.values()].some((n) => n > 0)) custodyIssues.push(`${operation.id}:missing-materials`);
      for (const row of heldItems) if (!fulfilledItems.has(row.item_id)) custodyIssues.push(`${operation.id}:unbound-item`);
    }
    return { ok: !historyIssues.length && !custodyIssues.length && !capitalIssues.length,
      historyIssues: [...new Set(historyIssues)], custodyIssues: [...new Set(custodyIssues)], capitalIssues: [...new Set(capitalIssues)] };
  });
}
