// Direct database clients have no game-table access. The trusted backend still uses
// its table-owner/BYPASSRLS connection and enforces player authorization in routes.
// This is a boundary against direct SQL access, not per-player backend isolation.
export const INSTALL_DATABASE_RLS = `DO $rls$
DECLARE game_table record;
BEGIN
  FOR game_table IN
    SELECT c.relname, n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=current_schema() AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', game_table.nspname, game_table.relname);
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC', game_table.nspname, game_table.relname);
    EXECUTE format('DROP POLICY IF EXISTS omerta_direct_access_denied ON %I.%I', game_table.nspname, game_table.relname);
    EXECUTE format('CREATE POLICY omerta_direct_access_denied ON %I.%I AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false)', game_table.nspname, game_table.relname);
  END LOOP;
END
$rls$;`;

export async function enforceDatabaseRls(q, { compatibility = 'postgres' } = {}) {
  // pg-mem does not implement PostgreSQL roles, policies, or their enforcement.
  if (compatibility === 'pg-mem') return { verified: false, compatibility };
  await q.query(INSTALL_DATABASE_RLS);
  await q.query(`DO $rls$ BEGIN EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM PUBLIC',current_schema()); END $rls$`);
  const { rows } = await q.query(`SELECT c.relname,
    c.relrowsecurity AS enabled,
    EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid
      AND p.polname='omerta_direct_access_denied' AND NOT p.polpermissive
      AND p.polcmd='*' AND p.polroles=ARRAY[0::oid]
      AND pg_get_expr(p.polqual,p.polrelid)='false'
      AND pg_get_expr(p.polwithcheck,p.polrelid)='false') AS denied,
    (r.rolsuper OR r.rolbypassrls OR
      (pg_has_role(current_user,c.relowner,'USAGE') AND NOT c.relforcerowsecurity)) AS backend_access,
    NOT EXISTS (SELECT 1 FROM aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a
      WHERE a.grantee=0) AS public_revoked
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN pg_roles r
    WHERE n.nspname=current_schema() AND c.relkind IN ('r','p') AND r.rolname=current_user`);
  const invalid = rows.filter(row => !row.enabled || !row.denied || !row.public_revoked || !row.backend_access);
  if (!rows.length || invalid.length) {
    const error = new Error(`Database RLS verification failed; trusted backend must own/bypass every protected table: ${invalid.map(row => row.relname).join(', ') || 'no public tables'}`);
    error.code = 'database_rls_invalid';
    throw error;
  }
  return { verified: true, compatibility, tables: rows.length };
}
