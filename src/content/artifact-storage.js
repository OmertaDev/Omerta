import { types } from 'node:util';
import { GameError } from '../game.js';
import { canonicalBytes } from './canonical.js';
import { verifyStoredBundleBytes } from './corpus.js';
import { parseAuthoredJson } from './json-source.js';
import { PHASE2_LIMITS } from './economy-profile.js';
import { assertPhase2Client, phase2ContextIdentity } from './phase2-transactions.js';

// Verified artifacts are ephemeral capabilities tied to the exact active registry client.
const VERIFIED = new WeakMap();
const TYPED = Object.getPrototypeOf(Uint8Array.prototype);
const BUFFER_GET = Object.getOwnPropertyDescriptor(TYPED, 'buffer').get;
const OFFSET_GET = Object.getOwnPropertyDescriptor(TYPED, 'byteOffset').get;
const LENGTH_GET = Object.getOwnPropertyDescriptor(TYPED, 'byteLength').get;
const RESIZABLE_GET = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get;
const MAX_BYTES = 67108864;
const PARSE_LIMITS = Object.freeze({ maxBytes: MAX_BYTES, maxDepth: 64,
  maxStringBytes: 65536, maxObjectMembers: 100000, maxArrayItems: 100000 });
export const failRegistry = (code) => { throw new GameError(code, 'Phase 2 registry validation failed.'); };
export function ownRequest(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) failRegistry('bad_content_request');
  const actual = Reflect.ownKeys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) failRegistry('bad_content_request');
  const copy = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) failRegistry('bad_content_request');
    copy[key] = descriptor.value;
  }
  return copy;
}
export function validHash(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) failRegistry('bad_content_request');
  return value;
}
export function positiveVersion(value, code = 'bad_content_request') {
  if (!Number.isSafeInteger(value) || value < 1 || Object.is(value, -0)) failRegistry(code);
  return value;
}
export function storedNumber(value) {
  if (typeof value === 'string' && /^[1-9][0-9]{0,15}$/.test(value)) value = Number(value);
  return positiveVersion(value, 'content_registry_corrupt');
}
export function auditOperator(value) {
  if (typeof value !== 'string' || !value || value.length > 200 || value.trim() !== value
      || /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/u.test(value)) {
    failRegistry('bad_content_request');
  }
  return value;
}
export function snapshotIdentity(value) {
  const copy = ownRequest(value, ['packageId', 'packageVersion', 'authorityProfile', 'bundleHash', 'dependencyLockHash']);
  if (typeof copy.packageId !== 'string' || copy.packageId.length > 128
      || !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(copy.packageId)
      || !['production', 'fixture'].includes(copy.authorityProfile)) failRegistry('bad_content_request');
  positiveVersion(copy.packageVersion);
  validHash(copy.bundleHash); validHash(copy.dependencyLockHash);
  return Object.freeze(copy);
}
export function snapshotBytes(value) {
  if (typeof value === 'string') {
    if (Buffer.byteLength(value, 'utf8') > MAX_BYTES) failRegistry('content_input_limit');
    return Buffer.from(value, 'utf8');
  }
  if (!types.isUint8Array(value)) failRegistry('bad_content_request');
  for (const key of ['buffer', 'byteOffset', 'byteLength', 'length']) {
    let prototype = value;
    while (prototype && prototype !== TYPED) {
      if (Object.hasOwn(prototype, key)) failRegistry('bad_content_request');
      prototype = Object.getPrototypeOf(prototype);
    }
    if (prototype !== TYPED) failRegistry('bad_content_request');
  }
  try {
    const buffer = BUFFER_GET.call(value), offset = OFFSET_GET.call(value), length = LENGTH_GET.call(value);
    if (types.isSharedArrayBuffer(buffer) || RESIZABLE_GET?.call(buffer)) failRegistry('bad_content_request');
    if (length > MAX_BYTES) failRegistry('content_input_limit');
    return Buffer.from(new Uint8Array(buffer, offset, length));
  } catch (error) {
    if (error instanceof GameError) throw error;
    failRegistry('bad_content_request');
  }
}
export function freezeData(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeData(child);
    Object.freeze(value);
  }
  return value;
}
function artifactProjection(bundle) {
  return Object.freeze({ bundle_hash: bundle.hashes.bundleHash, namespace: bundle.package.id,
    bundle_version: bundle.package.version, artifact_format_version: bundle.formatVersion,
    compiler_version: bundle.compilerVersion, ir_version: bundle.ir.irVersion,
    authored_kind: bundle.package.authoredKind, package_kind: bundle.package.kind,
    profile: bundle.package.profile, authority_profile: bundle.package.authorityProfile,
    activatable: bundle.package.activatable, source_hash: bundle.hashes.sourceHash,
    secret_overlay_hash: bundle.hashes.secretOverlayHash, dependency_lock_hash: bundle.hashes.dependencyLockHash,
    ir_hash: bundle.hashes.irHash, public_manifest_hash: bundle.hashes.publicManifestHash,
    report_hashes_json: canonicalBytes(bundle.hashes.reportHashByName).toString('utf8'),
    definition_count: bundle.ir.nodes.filter((node) => node.nodeClass === 'definition').length });
}
function compareArtifact(row, projection, bytes) {
  for (const [key, expected] of Object.entries(projection)) {
    const actual = key === 'bundle_version' ? storedNumber(row[key]) : row[key];
    if (actual !== expected) failRegistry('content_registry_corrupt');
  }
  if (!types.isUint8Array(row.canonical_bytes) || !Buffer.from(row.canonical_bytes).equals(bytes)) {
    failRegistry('content_registry_corrupt');
  }
  try { auditOperator(row.registered_by); } catch { failRegistry('content_registry_corrupt'); }
  if (!row.registered_at || !Number.isFinite(new Date(row.registered_at).getTime())) failRegistry('content_registry_corrupt');
}
function hints(bundle) {
  for (const field of ['dependencies', 'directDependencies']) {
    if (Array.isArray(bundle?.lock?.[field]) && bundle.lock[field].length >= PHASE2_LIMITS.maxPackages) {
      failRegistry('content_input_limit');
    }
  }
  const dependencies = bundle?.lock?.dependencies;
  if (!Array.isArray(dependencies)) return [];
  if (dependencies.length >= PHASE2_LIMITS.maxPackages) failRegistry('content_input_limit');
  return dependencies.map((entry) => {
    let hint;
    try {
      hint = ownRequest(entry, ['packageId', 'version', 'bundleHash']);
      snapshotIdentity({ packageId: hint.packageId, packageVersion: hint.version,
        authorityProfile: 'production', bundleHash: hint.bundleHash, dependencyLockHash: hint.bundleHash });
    } catch { failRegistry('content_dependency_drift'); }
    return hint;
  });
}
function boundedParsed(bytes) { return parseAuthoredJson(bytes, PARSE_LIMITS); }

async function verifyClosure(client, rootBytes, identity, rootRow) {
  assertPhase2Client(client);
  const rootParsed = boundedParsed(rootBytes);
  const entries = new Map();
  const packageHashes = new Map();
  let bytesTotal = 0, nodes = 0, edges = 0, references = 0;
  function resources(parsed, bytes, root = false) {
    const ns = parsed?.ir?.nodes, es = parsed?.ir?.edges;
    // Byte and graph budgets are independent, even when a neighboring IR field is corrupt.
    if (!root) bytesTotal += bytes.length;
    if (Array.isArray(ns)) {
      nodes += ns.length;
      for (const node of ns) if (Array.isArray(node?.refs)) references += node.refs.length;
    }
    if (Array.isArray(es)) edges += es.length;
    if (!Number.isSafeInteger(references) || bytesTotal + rootBytes.length > PHASE2_LIMITS.maxCatalogBytes
        || nodes > PHASE2_LIMITS.maxCatalogNodes || edges > PHASE2_LIMITS.maxCatalogEdges
        || references > PHASE2_LIMITS.maxCatalogReferences) failRegistry('content_input_limit');
    // Reject corrupt dependencies before retention or fan-out; incoming roots keep verifier codes.
    if (!root && (!Array.isArray(ns) || !Array.isArray(es))) failRegistry('content_dependency_drift');
  }
  resources(rootParsed, rootBytes, true);
  const pending = [...hints(rootParsed)];
  for (let index = 0; index < pending.length; index++) {
    const hint = pending[index];
    if (hint.bundleHash === identity.bundleHash) failRegistry('content_dependency_drift');
    const key = `${hint.packageId}@${hint.version}`;
    if (packageHashes.has(key) && packageHashes.get(key) !== hint.bundleHash) failRegistry('content_dependency_drift');
    packageHashes.set(key, hint.bundleHash);
    if (entries.has(hint.bundleHash)) {
      const row = entries.get(hint.bundleHash).row;
      if (row.namespace !== hint.packageId || storedNumber(row.bundle_version) !== hint.version) failRegistry('content_dependency_drift');
      continue;
    }
    if (entries.size + 1 >= PHASE2_LIMITS.maxPackages) failRegistry('content_input_limit');
    const row = (await client.query('SELECT * FROM content_bundle_artifacts WHERE bundle_hash=$1', [hint.bundleHash])).rows[0];
    if (!row) failRegistry('content_dependency_unresolved');
    let bytes, parsed, next;
    try {
      bytes = snapshotBytes(row.canonical_bytes);
      if (row.namespace !== hint.packageId || storedNumber(row.bundle_version) !== hint.version) failRegistry('content_dependency_drift');
      parsed = boundedParsed(bytes); next = hints(parsed);
    } catch (error) {
      if (error.code === 'content_input_limit') throw error;
      failRegistry('content_dependency_drift');
    }
    resources(parsed, bytes);
    entries.set(hint.bundleHash, { row, bytes, parsed, next });
    // Queue only newly discovered hashes. Duplicate claims are checked above before lookup.
    pending.push(...next);
    if (pending.length > PHASE2_LIMITS.maxCatalogReferences) failRegistry('content_input_limit');
  }
  const verified = new Map();
  while (verified.size < entries.size) {
    let progress = false;
    for (const [hash, entry] of entries) {
      if (verified.has(hash) || entry.next.some((dep) => !verified.has(dep.bundleHash))) continue;
      try {
        const catalog = [...new Set(entry.next.map((dep) => dep.bundleHash))].map((dep) => verified.get(dep));
        const bundle = verifyStoredBundleBytes(entry.bytes, { bundleHash: hash,
          dependencyLockHash: entry.row.dependency_lock_hash }, {
          authorityProfile: entry.row.authority_profile, dependencyCatalog: { bundles: catalog },
        });
        compareArtifact(entry.row, artifactProjection(bundle), entry.bytes);
        verified.set(hash, { bundle, authorityProfile: entry.row.authority_profile,
          expectedHashes: { bundleHash: hash, dependencyLockHash: entry.row.dependency_lock_hash } });
      } catch (error) {
        if (error.code === 'content_input_limit') throw error;
        failRegistry('content_dependency_drift');
      }
      progress = true;
    }
    if (!progress) failRegistry('content_dependency_drift');
  }
  const dependencies = [...verified.values()];
  let bundle;
  try {
    bundle = verifyStoredBundleBytes(rootBytes, { bundleHash: identity.bundleHash,
      dependencyLockHash: identity.dependencyLockHash }, { authorityProfile: identity.authorityProfile,
      dependencyCatalog: { bundles: dependencies } });
  } catch (error) {
    if (rootRow && !['content_dependency_unresolved', 'content_dependency_drift', 'content_input_limit'].includes(error.code)) {
      failRegistry('content_registry_corrupt');
    }
    throw error;
  }
  if (bundle.package.id !== identity.packageId || bundle.package.version !== identity.packageVersion) {
    failRegistry(rootRow ? 'content_registry_corrupt' : 'content_artifact_conflict');
  }
  const row = artifactProjection(bundle);
  if (rootRow) compareArtifact(rootRow, row, rootBytes);
  const token = Object.freeze({});
  VERIFIED.set(token, { client, context: phase2ContextIdentity(client), bundle: freezeData(bundle), bytes: Buffer.from(rootBytes),
    row, dependencies: freezeData(dependencies) });
  return token;
}
export async function verifyIncomingArtifact(client, bytes, identity) {
  return verifyClosure(client, bytes, identity, null);
}
export async function loadVerifiedStoredArtifact(client, hash) {
  assertPhase2Client(client);
  const row = (await client.query('SELECT * FROM content_bundle_artifacts WHERE bundle_hash=$1', [hash])).rows[0];
  if (!row) failRegistry('content_artifact_not_found');
  let identity, bytes;
  try {
    identity = snapshotIdentity({ packageId: row.namespace, packageVersion: storedNumber(row.bundle_version),
      authorityProfile: row.authority_profile, bundleHash: row.bundle_hash, dependencyLockHash: row.dependency_lock_hash });
    bytes = snapshotBytes(row.canonical_bytes);
    boundedParsed(bytes);
  } catch { failRegistry('content_registry_corrupt'); }
  return verifyClosure(client, bytes, identity, row);
}
export function verifiedArtifactData(client, token) {
  assertPhase2Client(client);
  const data = VERIFIED.get(token);
  if (!data || data.client !== client || data.context !== phase2ContextIdentity(client)) failRegistry('content_transaction_required');
  return { bundle: data.bundle, row: data.row, bytes: Buffer.from(data.bytes), dependencies: data.dependencies };
}
export function verifyStoredArtifactRow(client, token, storedRow) {
  // Exact bytes inherit the current callback's completed root/closure verification. Independently
  // compare every immutable stored projection and audit field without fetching dependencies again.
  const verified = verifiedArtifactData(client, token);
  compareArtifact(storedRow, verified.row, verified.bytes);
}
