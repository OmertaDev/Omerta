import assert from 'node:assert/strict';
export async function ensureComponentDDL(pool, ddl, tables) {
  const rows = (await pool.query("SELECT table_name FROM information_schema.columns WHERE table_schema='public'")).rows;
  const present = new Set(rows.map(row => row.table_name).filter(name => tables.includes(name)));
  assert(present.size === 0 || present.size === tables.length, 'Partial canonical component schema');
  if (!present.size) await pool.query(ddl);
}
