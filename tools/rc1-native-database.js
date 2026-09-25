// Separate databases are required: PostgreSQL advisory locks ignore schemas.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { canonicalJson } from './rc1-native-proof.js';

const nativeRandomBytes = crypto.randomBytes.bind(crypto);
const literal = (value) => `'${value.replace(/'/g, "''")}'`;

export function planOwnedWorldDatabase({ controlUrl, runId, sourceRevision }) {
  const parsed = new URL(controlUrl);
  assert(['postgres:', 'postgresql:'].includes(parsed.protocol));
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname), 'Disposable local PostgreSQL only');
  assert(/^[a-zA-Z0-9._-]+$/.test(runId)); assert(/^[a-f0-9]{40}$/.test(sourceRevision));
  const nonce = nativeRandomBytes(12).toString('hex'), name = `rc1_world_${nonce}`;
  assert.notEqual(decodeURIComponent(parsed.pathname.slice(1)), name);
  const ownerMarker = canonicalJson({ tool: 'rc1-native-world', format: 1, nonce, runId, sourceRevision });
  const target = new URL(parsed); target.pathname = `/${name}`;
  let created = false, closed = false, oid = null;
  const descriptor = Object.freeze({ name, ownerMarker,
    isolation: 'New exclusively owned database per world; schema isolation alone does not isolate advisory locks.',
    cleanup: 'Exact name/OID/ownership comment required; DROP DATABASE without FORCE; foreign backends are never terminated.' });
  async function control(work) {
    const client = new pg.Client({ connectionString: controlUrl });
    try { await client.connect(); return await work(client); } finally { await client.end(); }
  }
  return {
    url: target.toString(), descriptor,
    async create() {
      assert(!created && !closed, 'World database lease already used');
      return control(async (client) => {
        await client.query(`CREATE DATABASE "${name}" TEMPLATE template0`); created = true;
        oid = (await client.query('SELECT oid FROM pg_database WHERE datname=$1', [name])).rows[0].oid;
        await client.query(`COMMENT ON DATABASE "${name}" IS ${literal(ownerMarker)}`);
        return { ...descriptor, oid, created: true };
      });
    },
    async close() {
      if (!created || closed) return { created, closed };
      return control(async (client) => {
        assert(/^rc1_world_[a-f0-9]{24}$/.test(name));
        const row = (await client.query("SELECT oid, shobj_description(oid,'pg_database') AS owner FROM pg_database WHERE datname=$1", [name])).rows[0];
        assert(row && Number(row.oid) === Number(oid), 'World database identity changed; refusing cleanup');
        assert.equal(row.owner, ownerMarker, 'World database ownership marker changed; refusing cleanup');
        await client.query(`DROP DATABASE "${name}"`); closed = true;
        return { name, oid, closed: true };
      });
    },
  };
}
