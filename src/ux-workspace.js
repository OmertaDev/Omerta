// Player-owned presentation state. No game authority, currencies, inventory, or credentials.
const namespaces = new Set(['navigation', 'navigationTour', 'progression', 'social', 'investigation', 'tactics', 'world', 'layout', 'identity', 'feel', 'tools', 'story', 'community']);
const dangerous = /^(?:__proto__|prototype|constructor|token|authorization|password|secret|credential|privatekey|seedphrase)$/i;
export function validWorkspace(value, depth = 0) {
  if (depth > 10) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.length <= 8000;
  if (Array.isArray(value)) return value.length <= 300 && value.every(item => validWorkspace(item, depth + 1));
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.keys(value).length <= 300 && Object.entries(value).every(([key, item]) => key.length <= 120 && !dangerous.test(key) && validWorkspace(item, depth + 1));
}
const decode = row => {
  let values = {};
  try { values = JSON.parse(row?.payload || '{}'); } catch { /* Corrupt optional presentation cannot become authority. */ }
  return { ok: true, version: 1, revision: Number(row?.revision || 0), values, updatedAt: row?.updated_at || null };
};
export async function register(app, { pool, auth }) {
  app.get('/v1/ux/workspace', { preHandler: auth }, async req => {
    const row = (await pool.query('SELECT revision,payload,updated_at FROM ux_workspaces WHERE account_id=$1', [req.user.sub])).rows[0];
    return decode(row);
  });
  app.put('/v1/ux/workspace', { preHandler: auth }, async (req, reply) => {
    const body = req.body;
    if (!body || Object.keys(body).some(key => !['revision', 'changes'].includes(key)) || !Number.isSafeInteger(body.revision) || body.revision < 0
      || !body.changes || Array.isArray(body.changes) || !Object.keys(body.changes).length
      || Object.keys(body.changes).some(key => !namespaces.has(key)) || !validWorkspace(body.changes)
      || Buffer.byteLength(JSON.stringify(body.changes)) > 180000) return reply.code(400).send({ error: 'workspace_invalid' });
    const row = (await pool.query('SELECT revision,payload,updated_at FROM ux_workspaces WHERE account_id=$1', [req.user.sub])).rows[0];
    const current = decode(row);
    if (current.revision !== body.revision) return reply.code(409).send({ error: 'workspace_conflict', ...current });
    const payload = JSON.stringify({ ...current.values, ...body.changes });
    if (Buffer.byteLength(payload) > 240000) return reply.code(400).send({ error: 'workspace_too_large' });
    let updated;
    if (row) updated = await pool.query('UPDATE ux_workspaces SET payload=$2,revision=revision+1,updated_at=now() WHERE account_id=$1 AND revision=$3 RETURNING revision,payload,updated_at', [req.user.sub, payload, body.revision]);
    else updated = await pool.query('INSERT INTO ux_workspaces (account_id,payload,revision) VALUES ($1,$2,1) ON CONFLICT (account_id) DO NOTHING RETURNING revision,payload,updated_at', [req.user.sub, payload]);
    if (!updated.rowCount) {
      const latest = (await pool.query('SELECT revision,payload,updated_at FROM ux_workspaces WHERE account_id=$1', [req.user.sub])).rows[0];
      return reply.code(409).send({ error: 'workspace_conflict', ...decode(latest) });
    }
    return decode(updated.rows[0]);
  });
}
