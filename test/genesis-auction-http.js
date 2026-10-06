import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import Fastify from 'fastify';
import { register, loadGenesisAuctionManifest } from '../src/routes/genesisauction.js';

assert.equal(loadGenesisAuctionManifest({}), null);
assert.throws(() => loadGenesisAuctionManifest({ GENESIS_AUCTION_MANIFEST_PATH: 'missing' }), /incomplete/);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-genesis-manifest-'));
const file = path.join(dir, 'public.json');
try {
  const bytes = Buffer.from(JSON.stringify({ chainId: 4663 }));
  fs.writeFileSync(file, bytes);
  const env = { GENESIS_AUCTION_MANIFEST_PATH: file,
    GENESIS_AUCTION_MANIFEST_SHA256: createHash('sha256').update(bytes).digest('hex') };
  assert.deepEqual(loadGenesisAuctionManifest(env), { chainId: 4663 });
  fs.writeFileSync(file, '{}');
  assert.throws(() => loadGenesisAuctionManifest(env), /differs/);
} finally {
  fs.unlinkSync(file); fs.rmdirSync(dir);
}
const app = Fastify();
register(app, { env: {}, auth: async (req, reply) => {
  if (req.headers.authorization !== 'Bearer fixture') return reply.code(401).send({ error: 'unauthorized' });
} });
for (const [method, url] of [['GET', '/v1/genesis-auction'], ['POST', '/v1/genesis-auction/tx']]) {
  const denied = await app.inject({ method, url }); assert.equal(denied.statusCode, 401);
  const waiting = await app.inject({ method, url, headers: { authorization: 'Bearer fixture' } });
  assert.equal(waiting.statusCode, 503); assert.equal(waiting.json().error, 'genesis_not_ready');
  assert.equal(waiting.headers['cache-control'], 'no-store');
}
await app.close();
const configured = Fastify();
register(configured, { manifest: { chainId: 4663 }, client: {} });
const malicious = await configured.inject({ method: 'POST', url: '/v1/genesis-auction/tx', payload: {
  account: '0x0000000000000000000000000000000000000001', action: 'bid',
  to: '0x0000000000000000000000000000000000000002', data: '0xdeadbeef', value: '1',
} });
assert.equal(malicious.statusCode, 400); assert.equal(malicious.json().error, 'invalid_genesis_input');
const malformed = await configured.inject('/v1/genesis-auction?account=bad'); assert.equal(malformed.statusCode, 400);
const noVerifiedDeployment = await configured.inject('/v1/genesis-auction?account=0x0000000000000000000000000000000000000001');
assert.equal(noVerifiedDeployment.statusCode, 503); assert.equal(noVerifiedDeployment.json().error, 'genesis_verification_failed');
await configured.close();
console.log('player genesis HTTP: authenticated perimeter, disabled payments, pinned manifest, fixed input allowlist PASS');
