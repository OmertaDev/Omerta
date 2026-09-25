import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, lstat, mkdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { constants, createCipheriv, createDecipheriv, generateKeyPairSync, privateDecrypt, randomBytes } from 'node:crypto';
import {
  canonicalJson, decryptEnvelope, encryptEnvelope, MAX_HEADER_BYTES, MAX_PAYLOAD_BYTES,
  publicKeyFingerprint, runCli, transformPayload, validateContext,
} from '../tools/rc1-ci-envelope.js';

const root = await mkdtemp(join(tmpdir(), 'omerta-ci-envelope-'));
const context = { sourceRevision: '4b9db47901c143f94bd31d9d3159f33695d729c0', runId: '35586586182', jobId: 'pg18.4', attemptId: '1' };
const keys = generateKeyPairSync('rsa', { modulusLength: 3072 });
const other = generateKeyPairSync('rsa', { modulusLength: 3072 });
const weak = generateKeyPairSync('rsa', { modulusLength: 2048 });
const payload = randomBytes(4 * 1024 * 1024 + 37);
const input = join(root, 'input.bin');
const envelope = join(root, 'payload.envelope');
let sequence = 0, passed = 0;
const skipped = [];
function next(label) { return join(root, `${++sequence}-${label}`); }
async function exists(path) { try { await lstat(path); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } }
async function check(name, body) { await body(); passed++; console.log(JSON.stringify({ test: name, status: 'PASS' })); }
async function rejected(action, code) {
  let failure;
  try { await action(); } catch (error) { failure = error; }
  assert(failure, 'expected rejection');
  if (code) assert.equal(failure.code, code);
  return failure;
}
async function rejectDecrypt(bytes, code, expected = context, key = keys.privateKey) {
  const path = next('bad.envelope'), output = next('never-published.bin');
  await writeFile(path, bytes);
  const failure = await rejected(() => decryptEnvelope({ input: path, output, context: expected, privateKey: key }), code);
  assert.equal(await exists(output), false);
  if (failure.partialPath) {
    assert(failure.partialPath.endsWith('.unverified'));
    assert.equal(await exists(failure.partialPath), true, 'failure partial must remain available privately');
  }
  return failure;
}
function framing(bytes) {
  const length = bytes.readUInt32BE(8);
  return { length, offset: 12 + length, header: JSON.parse(bytes.subarray(12, 12 + length)) };
}
function replaceHeader(bytes, update, encode = canonicalJson) {
  const { offset, header } = framing(bytes);
  update(header);
  const encoded = Buffer.from(encode(header));
  const prefix = Buffer.from(bytes.subarray(0, 12));
  prefix.writeUInt32BE(encoded.length, 8);
  return Buffer.concat([prefix, encoded, bytes.subarray(offset)]);
}

try {
  await writeFile(input, payload);
  await check('multi-chunk round trip and independently decoded OAEP-SHA256/GCM framing', async () => {
    const result = await encryptEnvelope({ input, output: envelope, context, publicKey: keys.publicKey });
    assert.equal(result.status, 'ENCRYPTED');
    const bytes = await readFile(envelope), { header, offset } = framing(bytes);
    assert.equal(bytes.length, payload.length + offset + 16);
    assert.equal(header.keyFingerprint, publicKeyFingerprint(keys.publicKey));
    assert.equal(header.keyFingerprint, publicKeyFingerprint(keys.privateKey));
    const secret = privateDecrypt({ key: keys.privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(header.wrappedKey, 'base64'));
    assert.equal(secret.length, 32);
    assert.throws(() => privateDecrypt({ key: keys.privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' }, Buffer.from(header.wrappedKey, 'base64')));
    const cipher = createDecipheriv('aes-256-gcm', secret, Buffer.from(header.nonce, 'base64'), { authTagLength: 16 });
    cipher.setAAD(bytes.subarray(0, offset)); cipher.setAuthTag(bytes.subarray(-16));
    assert.deepEqual(Buffer.concat([cipher.update(bytes.subarray(offset, -16)), cipher.final()]), payload);
    secret.fill(0);
    const output = next('roundtrip.bin');
    assert.equal((await decryptEnvelope({ input: envelope, output, context, privateKey: keys.privateKey })).status, 'VERIFIED');
    assert.deepEqual(await readFile(output), payload);
    assert.equal((await readdir(root)).filter(name => name.endsWith('.unverified')).length, 0);
  });
  const bytes = await readFile(envelope), { offset } = framing(bytes);

  await check('fresh key and nonce for each envelope; exact configured byte limit', async () => {
    const fresh = next('fresh.envelope');
    await encryptEnvelope({ input, output: fresh, context, publicKey: keys.publicKey, maxPayloadBytes: payload.length });
    const left = framing(bytes).header, right = framing(await readFile(fresh)).header;
    assert.notEqual(left.nonce, right.nonce); assert.notEqual(left.wrappedKey, right.wrappedKey);
    const output = next('exact-limit.bin');
    await decryptEnvelope({ input: fresh, output, context, privateKey: keys.privateKey, maxPayloadBytes: payload.length });
    assert.deepEqual(await readFile(output), payload);
  });

  await check('bounded streaming awaits slow sink before asking for next chunk', async () => {
    const small = Buffer.from('streaming-backpressure-probe'), secret = randomBytes(32), nonce = randomBytes(12);
    let pending = false, reads = 0, writes = 0;
    const chunks = (async function* () {
      for (const byte of small) { assert.equal(pending, false); reads++; yield Buffer.from([byte]); }
    })();
    const parts = [], cipher = createCipheriv('aes-256-gcm', secret, nonce, { authTagLength: 16 });
    cipher.setAAD(Buffer.from('test-only-aad'));
    assert.equal(await transformPayload({ chunks, cipher, expectedBytes: small.length,
      write: async part => { assert.equal(pending, false); pending = true; await new Promise(resolve => setImmediate(resolve)); parts.push(part); writes++; pending = false; } }), small.length);
    assert.equal(reads, small.length); assert.equal(writes, small.length + 1);
    const decipher = createDecipheriv('aes-256-gcm', secret, nonce, { authTagLength: 16 });
    decipher.setAAD(Buffer.from('test-only-aad')); decipher.setAuthTag(cipher.getAuthTag());
    assert.deepEqual(Buffer.concat([decipher.update(Buffer.concat(parts)), decipher.final()]), small);
    secret.fill(0);
  });

  await check('empty plaintext is authenticated and published only after successful final', async () => {
    const empty = next('empty.bin'), encrypted = next('empty.envelope'), output = next('empty-out.bin');
    await writeFile(empty, Buffer.alloc(0));
    await encryptEnvelope({ input: empty, output: encrypted, context, publicKey: keys.publicKey, maxPayloadBytes: 0 });
    await decryptEnvelope({ input: encrypted, output, context, privateKey: keys.privateKey, maxPayloadBytes: 0 });
    assert.equal((await readFile(output)).length, 0);
    const bad = await readFile(encrypted); bad[bad.length - 1] ^= 1;
    await rejectDecrypt(bad, 'AUTHENTICATION_FAILED');
  });

  await check('ciphertext and tag tampering retain unpublished private partials', async () => {
    for (const index of [offset, offset + 1024 * 1024, bytes.length - 17, bytes.length - 1]) {
      const corrupt = Buffer.from(bytes); corrupt[index] ^= 1;
      const failure = await rejectDecrypt(corrupt, 'AUTHENTICATION_FAILED');
      assert(failure.partialPath);
      assert.equal((await lstat(failure.partialPath)).size, payload.length);
    }
  });

  await check('header context, nonce, wrap, fingerprint and framing are authenticated', async () => {
    const changedContext = { ...context, jobId: 'pg16' };
    await rejectDecrypt(replaceHeader(bytes, header => { header.context = changedContext; }), 'AUTHENTICATION_FAILED', changedContext);
    await rejectDecrypt(replaceHeader(bytes, header => { header.nonce = randomBytes(12).toString('base64'); }), 'AUTHENTICATION_FAILED');
    await rejectDecrypt(replaceHeader(bytes, header => { header.wrappedKey = randomBytes(384).toString('base64'); }), 'AUTHENTICATION_FAILED');
    await rejectDecrypt(replaceHeader(bytes, header => { header.keyFingerprint = '0'.repeat(64); }), 'RECIPIENT_MISMATCH');
    await rejectDecrypt(replaceHeader(bytes, header => { header.cipher = 'aes-128-gcm'; }), 'INVALID_FORMAT');
    const magic = Buffer.from(bytes); magic[0] ^= 1; await rejectDecrypt(magic, 'INVALID_FORMAT');
    await rejectDecrypt(replaceHeader(bytes, header => { header.plaintextBytes--; }), 'ENVELOPE_LENGTH');
  });

  await check('wrong recipient, forged recipient fingerprint, and expected context mismatch', async () => {
    await rejectDecrypt(bytes, 'RECIPIENT_MISMATCH', context, other.privateKey);
    await rejectDecrypt(replaceHeader(bytes, header => { header.keyFingerprint = publicKeyFingerprint(other.publicKey); }), 'AUTHENTICATION_FAILED', context, other.privateKey);
    for (const changed of [{ ...context, sourceRevision: 'a'.repeat(40) }, { ...context, runId: 'other' }, { ...context, jobId: 'other' }, { ...context, attemptId: '2' }]) {
      const failure = await rejectDecrypt(bytes, 'CONTEXT_MISMATCH', changed);
      assert.equal(failure.partialPath, undefined);
    }
  });

  await check('noncanonical, duplicate, unknown, invalid UTF8 and malformed headers rejected', async () => {
    await rejectDecrypt(replaceHeader(bytes, () => {}, header => JSON.stringify(header, null, 2)), 'NONCANONICAL_HEADER');
    await rejectDecrypt(replaceHeader(bytes, () => {}, header => canonicalJson(header).replace('{', '{"cipher":"aes-256-gcm",')), 'NONCANONICAL_HEADER');
    await rejectDecrypt(replaceHeader(bytes, header => { header.extra = 'unsupported'; }), 'INVALID_HEADER');
    await rejectDecrypt(replaceHeader(bytes, header => { header.nonce = `${header.nonce}=`; }), 'INVALID_HEADER');
    await rejectDecrypt(replaceHeader(bytes, header => { header.wrappedKey = ''; }), 'INVALID_HEADER');
    const invalid = Buffer.from(bytes); invalid[12] = 0xff; await rejectDecrypt(invalid, 'INVALID_HEADER');
    const huge = Buffer.from(bytes); huge.writeUInt32BE(MAX_HEADER_BYTES + 1, 8); await rejectDecrypt(huge, 'HEADER_LIMIT');
    const zero = Buffer.from(bytes); zero.writeUInt32BE(0, 8); await rejectDecrypt(zero, 'HEADER_LIMIT');
    const shortTag = Buffer.concat([bytes.subarray(0, -16), bytes.subarray(-15)]); await rejectDecrypt(shortTag, 'ENVELOPE_LENGTH');
  });

  await check('truncation at framing, header, payload and tag boundaries; appended bytes', async () => {
    for (const length of [0, 1, 8, 11, 12, offset - 1, offset, offset + 1, bytes.length - 16, bytes.length - 1]) {
      await rejectDecrypt(bytes.subarray(0, length));
    }
    await rejectDecrypt(Buffer.concat([bytes, Buffer.from([0])]), 'ENVELOPE_LENGTH');
  });

  await check('physical and declared size bounds cannot be raised above 32 GiB', async () => {
    assert.equal(MAX_PAYLOAD_BYTES, 34359738368);
    await rejected(() => encryptEnvelope({ input, output: next('small-cap'), context, publicKey: keys.publicKey, maxPayloadBytes: payload.length - 1 }), 'INPUT_LIMIT');
    await rejected(() => decryptEnvelope({ input: envelope, output: next('small-dec-cap'), context, privateKey: keys.privateKey, maxPayloadBytes: 1 }), 'INPUT_LIMIT');
    await rejected(() => encryptEnvelope({ input, output: next('over-cap'), context, publicKey: keys.publicKey, maxPayloadBytes: MAX_PAYLOAD_BYTES + 1 }), 'INVALID_LIMIT');
    await rejectDecrypt(replaceHeader(bytes, header => { header.plaintextBytes = MAX_PAYLOAD_BYTES + 1; }), 'PAYLOAD_LIMIT');
    await rejectDecrypt(replaceHeader(bytes, header => { header.plaintextBytes = 1.5; }, JSON.stringify));
    for (const [chunks, expectedBytes, code] of [[[Buffer.alloc(2)], 1, 'PAYLOAD_LIMIT'], [[Buffer.alloc(1)], 2, 'TRUNCATED']]) {
      const cipher = createCipheriv('aes-256-gcm', randomBytes(32), randomBytes(12), { authTagLength: 16 });
      await rejected(() => transformPayload({ chunks, expectedBytes, cipher, write: async () => {}, maxPayloadBytes: 2 }), code);
    }
  });

  await check('regular file and RSA3072 requirements; strict context schema', async () => {
    await rejected(() => encryptEnvelope({ input, output: next('weak-key'), context, publicKey: weak.publicKey }), 'INVALID_KEY');
    await rejected(() => encryptEnvelope({ input, output: next('private-as-public'), context, publicKey: keys.privateKey }), 'INVALID_KEY');
    const dir = next('input-directory'); await mkdir(dir);
    await rejected(() => encryptEnvelope({ input: dir, output: next('directory-out'), context, publicKey: keys.publicKey }), 'INPUT_NOT_REGULAR');
    await rejected(() => decryptEnvelope({ input: dir, output: next('directory-dec'), context, privateKey: keys.privateKey }), 'INPUT_NOT_REGULAR');
    for (const invalid of [null, [], { ...context, extra: 'unknown' }, { ...context, sourceRevision: 'A'.repeat(40) }, { ...context, runId: '' }, { ...context, jobId: 'x'.repeat(129) }, { ...context, jobId: 'newline\n' }]) {
      assert.throws(() => validateContext(invalid));
    }
    for (const invalid of [undefined, NaN, Infinity, -1, [], null]) assert.throws(() => canonicalJson(invalid));
  });

  await check('existing outputs never overwritten, including racing publishers', async () => {
    const occupied = next('occupied'); await writeFile(occupied, 'sentinel');
    await rejected(() => encryptEnvelope({ input, output: occupied, context, publicKey: keys.publicKey }), 'OUTPUT_EXISTS');
    await rejected(() => decryptEnvelope({ input: envelope, output: occupied, context, privateKey: keys.privateKey }), 'OUTPUT_EXISTS');
    assert.equal(await readFile(occupied, 'utf8'), 'sentinel');
    for (const mode of ['encrypt', 'decrypt']) {
      const output = next(`race-${mode}`);
      const run = () => mode === 'encrypt' ? encryptEnvelope({ input, output, context, publicKey: keys.publicKey })
        : decryptEnvelope({ input: envelope, output, context, privateKey: keys.privateKey });
      const result = await Promise.allSettled([run(), run()]);
      assert.equal(result.filter(item => item.status === 'fulfilled').length, 1);
      assert.equal(result.find(item => item.status === 'rejected').reason.code, 'OUTPUT_EXISTS');
      if (mode === 'decrypt') assert.deepEqual(await readFile(output), payload);
      else { const plain = next('race-verified'); await decryptEnvelope({ input: output, output: plain, context, privateKey: keys.privateKey }); assert.deepEqual(await readFile(plain), payload); }
    }
  });

  await check('symlink inputs and output links rejected when platform permits creation', async () => {
    const link = next('input-link');
    try { await symlink(input, link, 'file'); }
    catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) { skipped.push(`symlink creation unavailable: ${error.code}`); return; } throw error; }
    await rejected(() => encryptEnvelope({ input: link, output: next('link-out'), context, publicKey: keys.publicKey }), 'INPUT_NOT_REGULAR');
    const encryptedLink = next('encrypted-link'); await symlink(envelope, encryptedLink, 'file');
    await rejected(() => decryptEnvelope({ input: encryptedLink, output: next('link-dec'), context, privateKey: keys.privateKey }), 'INPUT_NOT_REGULAR');
    await rejected(() => decryptEnvelope({ input: envelope, output: link, context, privateKey: keys.privateKey }), 'OUTPUT_EXISTS');
    assert.deepEqual(await readFile(input), payload);
  });

  await check('CLI strict flags and public-key path encryption, without private-key files', async () => {
    const publicPath = next('public.pem'), contextPath = next('context.json'), output = next('cli.envelope');
    await writeFile(publicPath, keys.publicKey.export({ format: 'pem', type: 'spki' }));
    await writeFile(contextPath, JSON.stringify(context, null, 2));
    await runCli(['encrypt', `--input=${input}`, `--output=${output}`, `--context=${contextPath}`, `--public-key=${publicPath}`]);
    const plain = next('cli-verified'); await decryptEnvelope({ input: output, output: plain, context, privateKey: keys.privateKey });
    assert.deepEqual(await readFile(plain), payload);
    await rejected(() => runCli(['decrypt', '--input=x', '--output=y', '--context=z', '--private-key=k', '--unknown=z']), 'CLI_USAGE');
    await rejected(() => runCli(['encrypt', '--input=x', '--input=y']), 'CLI_USAGE');
    await rejected(() => runCli(['encrypt', '--input=x']), 'CLI_USAGE');
  });

  console.log(JSON.stringify({ status: 'PASS_SCOPED', tests: passed, skipped, runtime: process.version,
    scope: 'Node hybrid-envelope transport; no archive extraction, sender attestation, or fsync durability' }));
  await rm(root, { recursive: true, force: true });
} catch (error) {
  console.error(JSON.stringify({ status: 'FAILED', passed, retainedTestDirectory: root, code: error.code ?? error.name }));
  process.exitCode = 1;
}
