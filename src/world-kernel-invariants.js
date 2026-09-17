import { withItemRead } from './items.js';

// Audit only the current edge of each object, plus aggregate history continuity.
// Work is proportional to objects and SQL aggregates, without per-object queries.
export async function worldKernelInvariants(pool) {
  return withItemRead(pool, async (client) => {
    const counts = (await client.query(`SELECT object_id,COUNT(*) AS n,MAX(revision) AS revision
      FROM world_kernel_events GROUP BY object_id`)).rows;
    const byObject = new Map(counts.map((row) => [row.object_id, row]));
    const rows = (await client.query(`SELECT o.id,o.state,o.revision,o.definition_hash,
      e.id AS event_id,e.next_state,e.definition_hash AS event_hash,e.item_id,e.operation_id,
      g.result_json,g.mutation_kind,i.state AS item_state,op.status AS operation_status
      FROM world_kernel_objects o
      LEFT JOIN world_kernel_events e ON e.object_id=o.id AND e.revision=o.revision
      LEFT JOIN item_mutation_guards g ON g.mutation_id=e.mutation_id
      LEFT JOIN item_instances i ON i.id=e.item_id
      LEFT JOIN world_operations op ON op.id=e.operation_id`)).rows;
    const issues = [];
    for (const row of rows) {
      const count = byObject.get(row.id), revision = Number(row.revision);
      if (!Number.isSafeInteger(revision) || Number(count?.n || 0) !== revision
        || Number(count?.revision || 0) !== revision) issues.push(`${row.id}:history`);
      if (!revision) continue;
      let receipt = null;
      try { receipt = JSON.parse(row.result_json); } catch { /* invalid receipt fails closed below */ }
      const collective = row.operation_id !== null;
      const validRoot = collective
        ? row.mutation_kind === 'operation_action' && receipt?.operationId === row.operation_id
          && receipt?.status === 'completed' && row.operation_status === 'completed'
        : row.mutation_kind === 'world_action';
      if (collective) receipt = receipt?.world;
      if (!row.event_id || row.next_state !== row.state || row.event_hash !== row.definition_hash
        || !validRoot || row.item_state !== 'consumed'
        || receipt?.objectId !== row.id || receipt?.revision !== revision
        || receipt?.state !== row.state || receipt?.eventId !== row.event_id) issues.push(`${row.id}:transition`);
    }
    return { ok: issues.length === 0, issues };
  });
}
