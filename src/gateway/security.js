// Delegated credentials are opaque, revocable, scoped, and unusable as game JWTs.
import crypto from 'node:crypto';

export const SCOPES = Object.freeze([
  'omerta.player.read', 'omerta.inventory.read', 'omerta.world.read', 'omerta.social.read',
  'omerta.mysteries.read', 'omerta.economy.read', 'omerta.coordination.read',
  'omerta.coordination.prepare', 'omerta.actions.prepare', 'omerta.actions.commit',
]);
export const DEFAULT_SCOPES = Object.freeze(['omerta.player.read', 'omerta.world.read']);
export class GatewayError extends Error {
  constructor(code, statusCode = 400) { super(code); this.code = code; this.statusCode = statusCode; }
}
export const fail = (code, status = 400) => { throw new GatewayError(code, status); };
export const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}

// A deliberately small JSON-schema subset used by the capability registry. No coercion,
// removal of unknown fields, defaults, or caller-controlled schemas at this boundary.
export function validate(value, schema) {
  if (!schema) fail('invalid_arguments');
  if (schema.enum && !schema.enum.includes(value)) fail('invalid_arguments');
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('invalid_arguments');
    if ((schema.required || []).some((key) => !Object.hasOwn(value, key))) fail('invalid_arguments');
    for (const [key, entry] of Object.entries(value)) {
      if (!Object.hasOwn(schema.properties || {}, key)) fail('invalid_arguments');
      validate(entry, schema.properties[key]);
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length < (schema.minItems || 0)
        || value.length > (schema.maxItems ?? 100)) fail('invalid_arguments');
    if (schema.uniqueItems && new Set(value.map(canonical)).size !== value.length) fail('invalid_arguments');
    value.forEach((entry) => validate(entry, schema.items));
  } else if (schema.type === 'string') {
    if (typeof value !== 'string' || value.length < (schema.minLength || 0)
        || value.length > (schema.maxLength ?? 4096)
        || (schema.pattern && !new RegExp(schema.pattern).test(value))
        || (schema.format === 'date-time' && (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))))) fail('invalid_arguments');
  } else if (schema.type === 'integer' || schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)
        || (schema.type === 'integer' && !Number.isSafeInteger(value))
        || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity)) fail('invalid_arguments');
  } else if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') fail('invalid_arguments');
  } else fail('invalid_arguments');
  return value;
}
export const identifier = { type: 'string', minLength: 1, maxLength: 200, pattern: '^[!-~]+$' };
export const object = (properties = {}, required = []) => ({ type: 'object', additionalProperties: false, properties, required });
export const connectionInput = object({
  provider: { type: 'string', pattern: '^[a-z][a-z0-9_-]{0,39}$', maxLength: 40 },
  label: { type: 'string', minLength: 1, maxLength: 80, pattern: '^[^\\x00-\\x1f\\x7f]+$' },
  scopes: { type: 'array', minItems: 1, maxItems: SCOPES.length, uniqueItems: true, items: { type: 'string', enum: SCOPES } },
  expiresInSeconds: { type: 'integer', minimum: 300, maximum: 604800 },
}, ['provider', 'label', 'scopes']);

const connectionView = (row) => ({ id: row.id, provider: row.provider, label: row.label,
  scopes: JSON.parse(row.scopes_json), createdAt: row.created_at, expiresAt: row.expires_at,
  revokedAt: row.revoked_at });

export function createGatewaySecurity({ pool, now = Date.now }) {
  async function revalidate(principal) {
    if (!principal?.connectionId || !principal?.accountId) fail('invalid_token', 401);
    const row = (await pool.query(`SELECT c.*,a.status AS account_status,a.token_version AS current_version
      FROM agent_gateway_connections c JOIN accounts a ON a.id=c.account_id WHERE c.id=$1`,
    [principal.connectionId])).rows[0];
    if (!row || row.account_id !== principal.accountId || row.revoked_at || row.account_status !== 'active'
        || new Date(row.expires_at).getTime() <= now()
        || Number(row.token_version) !== Number(row.current_version)) fail('invalid_token', 401);
    return { accountId: row.account_id, connectionId: row.id, provider: row.provider,
      scopes: JSON.parse(row.scopes_json), tokenVersion: Number(row.token_version), expiresAt: row.expires_at };
  }
  async function authenticate(authorization, provider) {
    if (typeof authorization !== 'string' || !/^Bearer ogw_[A-Za-z0-9_-]{43}$/.test(authorization)) fail('invalid_token', 401);
    const digest = hash(authorization.slice(7));
    const row = (await pool.query('SELECT id,account_id FROM agent_gateway_connections WHERE token_hash=$1', [digest])).rows[0];
    const principal = await revalidate({ connectionId: row?.id, accountId: row?.account_id });
    if (provider && principal.provider !== provider) fail('provider_mismatch', 403);
    return principal;
  }
  async function create(accountId, input) {
    validate(input, connectionInput);
    const account = (await pool.query('SELECT status,token_version FROM accounts WHERE id=$1', [accountId])).rows[0];
    if (!account || account.status !== 'active') fail('account_unavailable', 403);
    const id = crypto.randomUUID(), token = 'ogw_' + crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(now() + (input.expiresInSeconds || 86400) * 1000).toISOString();
    const createdAt = new Date(now()).toISOString();
    await pool.query(`INSERT INTO agent_gateway_connections
      (id,account_id,provider,label,scopes_json,token_hash,token_version,created_at,expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, accountId, input.provider, input.label, JSON.stringify(input.scopes), hash(token), account.token_version, createdAt, expiresAt]);
    return { connection: { id, provider: input.provider, label: input.label, scopes: input.scopes, createdAt, expiresAt, revokedAt: null }, token };
  }
  async function list(accountId) {
    return { connections: (await pool.query(`SELECT * FROM agent_gateway_connections
      WHERE account_id=$1 ORDER BY created_at DESC,id LIMIT 100`, [accountId])).rows.map(connectionView) };
  }
  async function revoke(accountId, id) {
    validate(id, identifier);
    const result = await pool.query(`UPDATE agent_gateway_connections SET revoked_at=$1
      WHERE account_id=$2 AND id=$3 AND revoked_at IS NULL`, [new Date(now()).toISOString(), accountId, id]);
    return { revoked: result.rowCount > 0 };
  }
  // One bucket per player shared across tokens/processes; rotating credentials cannot amplify work.
  async function rateLimit(principal) {
    const window = Math.floor(now() / 60000);
    await pool.query(`INSERT INTO agent_gateway_rate_buckets (account_id,window_id,used)
      VALUES ($1,$2,0) ON CONFLICT (account_id) DO NOTHING`, [principal.accountId, window]);
    await pool.query(`UPDATE agent_gateway_rate_buckets SET window_id=$1,used=0
      WHERE account_id=$2 AND window_id<$1`, [window, principal.accountId]);
    const taken = await pool.query(`UPDATE agent_gateway_rate_buckets SET used=used+1
      WHERE account_id=$1 AND window_id=$2 AND used<60 RETURNING used`, [principal.accountId, window]);
    if (!taken.rows.length) fail('rate_limited', 429);
  }
  return { authenticate, revalidate, create, list, revoke, rateLimit };
}
