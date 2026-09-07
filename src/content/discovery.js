import fs from 'node:fs';
import path from 'node:path';

import { DEFAULT_AUTHORED_JSON_LIMITS, parseAuthoredJson } from './json-source.js';

const DISCOVERY_LIMIT_KEYS = new Set([
  'maxPackages',
  'maxManifestBytes',
  'maxCorpusBytes',
  'maxDirectories',
  'maxDirectoryEntries',
]);
const DISCOVERED_PACKAGES = new WeakSet();
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/u;
const DIAGNOSTIC_CONTROLS = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/gu;

export const DEFAULT_CONTENT_DISCOVERY_LIMITS = Object.freeze({
  maxPackages: 2_048,
  maxManifestBytes: DEFAULT_AUTHORED_JSON_LIMITS.maxBytes,
  maxCorpusBytes: 64 * 1024 * 1024,
  maxDirectories: 16_384,
  maxDirectoryEntries: 2_048 * 128,
});

export class ContentDiscoveryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ContentDiscoveryError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ContentDiscoveryError(code, message);
}

function safeText(value, maximum = 512) {
  const escaped = String(value).replace(DIAGNOSTIC_CONTROLS, (character) => (
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  ));
  return escaped.length <= maximum ? escaped : `${escaped.slice(0, maximum - 3)}...`;
}

function normalizedLimits(overrides) {
  if (overrides === undefined) return DEFAULT_CONTENT_DISCOVERY_LIMITS;
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new TypeError('content discovery limits must be an object');
  }
  for (const key of Object.keys(overrides)) {
    if (!DISCOVERY_LIMIT_KEYS.has(key)) throw new TypeError(`unknown content discovery limit ${key}`);
  }
  const limits = { ...DEFAULT_CONTENT_DISCOVERY_LIMITS, ...overrides };
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new TypeError(`content discovery limit ${key} must be a non-negative safe integer`);
    }
  }
  return limits;
}

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..'
    && !path.isAbsolute(relative));
}

function relativePosixRaw(root, candidate) {
  const relative = path.relative(root, candidate);
  if (!isWithin(root, candidate) || relative === '') {
    fail('content_path_escape', `content path is outside its root: ${safeText(candidate)}`);
  }
  return relative.split(path.sep).join('/');
}

function canonicalCompare(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function entryCompare(left, right) {
  const normalized = canonicalCompare(left.name.normalize('NFC'), right.name.normalize('NFC'));
  return normalized || canonicalCompare(left.name, right.name);
}

function sameIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function sameFileState(left, right) {
  return sameIdentity(left, right)
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function effectivePackageIdentity(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  const legacy = source.schemaVersion === 1;
  if ((legacy && !Number.isSafeInteger(source.version))
      || (Number.isInteger(source.version) && !Number.isSafeInteger(source.version))) {
    fail('content_version_unsafe', 'manifest version must be a safe integer');
  }
  let identity = null;
  if (legacy) {
    if (typeof source.namespace === 'string' && source.namespace.length > 0) {
      identity = source.namespace;
    }
  } else {
    const packageId = typeof source.packageId === 'string' && source.packageId.length > 0
      ? source.packageId
      : null;
    const namespace = typeof source.namespace === 'string' && source.namespace.length > 0
      ? source.namespace
      : null;
    if (packageId && namespace && packageId !== namespace) {
      fail(
        'content_identity_ambiguous',
        `ambiguous package identity ${safeText(packageId)} versus ${safeText(namespace)}`,
      );
    }
    identity = packageId || namespace;
  }
  if (identity !== null && CONTROL_CHARACTERS.test(identity)) {
    fail('content_identity_control', 'package identity contains control characters');
  }
  if (identity === null) return null;
  return { identity, family: legacy ? 'legacy' : 'package', version: source.version };
}

function manifestLikeUnsupported(name) {
  const parsed = path.parse(name);
  return parsed.name.toLowerCase() === 'pack' && name !== 'pack.json';
}

function discoveredPackageDescriptor({ manifestPath, source, authorityProfile }) {
  const rawSource = Buffer.from(source);
  const descriptor = {
    manifestPath,
    packageDir: path.dirname(manifestPath),
    get source() { return Buffer.from(rawSource); },
    authorityProfile,
  };
  Object.freeze(descriptor);
  DISCOVERED_PACKAGES.add(descriptor);
  return descriptor;
}

export function isDiscoveredContentPackage(value) {
  return Boolean(value && typeof value === 'object' && DISCOVERED_PACKAGES.has(value));
}

export function assertDiscoveredContentPackage(value) {
  if (!isDiscoveredContentPackage(value)) {
    throw new TypeError('content package descriptor was not issued by content discovery');
  }
  return value;
}

function readDirectoryEntries(directory, root, traversal) {
  let beforePath;
  let beforeState;
  try {
    beforePath = fs.realpathSync(directory);
    beforeState = fs.lstatSync(directory, { bigint: true });
  } catch {
    fail('content_directory_changed', `content directory changed during discovery: ${safeText(directory)}`);
  }
  if (!isWithin(root, beforePath)) {
    fail('content_symlink_escape', `symbolic link escapes content root: ${safeText(directory)}`);
  }
  if (!beforeState.isDirectory() || beforeState.isSymbolicLink()) {
    fail('content_directory_changed', `content directory changed during discovery: ${safeText(directory)}`);
  }

  const entries = [];
  const handle = fs.opendirSync(directory);
  try {
    while (true) {
      const entry = handle.readSync();
      if (entry === null) break;
      traversal.directoryEntries += 1;
      if (traversal.directoryEntries > traversal.limits.maxDirectoryEntries) {
        fail(
          'content_directory_entry_limit',
          `content directory-entry limit ${traversal.limits.maxDirectoryEntries} exceeded`,
        );
      }
      entries.push(entry);
    }
  } finally {
    handle.closeSync();
  }

  let afterPath;
  let afterState;
  try {
    afterPath = fs.realpathSync(directory);
    afterState = fs.lstatSync(directory, { bigint: true });
  } catch {
    fail('content_directory_changed', `content directory changed during discovery: ${safeText(directory)}`);
  }
  if (afterPath !== beforePath || !isWithin(root, afterPath)
      || !afterState.isDirectory() || afterState.isSymbolicLink()
      || !sameIdentity(beforeState, afterState)) {
    fail('content_directory_changed', `content directory changed during discovery: ${safeText(directory)}`);
  }
  return entries.sort(entryCompare);
}

function boundedRead(descriptor, maximumBytes, relativePath) {
  const chunks = [];
  const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, maximumBytes + 1) || 1);
  let total = 0;
  while (true) {
    const requested = Math.min(buffer.length, (maximumBytes - total) + 1);
    const count = fs.readSync(descriptor, buffer, 0, requested, null);
    if (count === 0) break;
    total += count;
    if (total > maximumBytes) {
      fail(
        'content_manifest_byte_limit',
        `manifest ${safeText(relativePath)} exceeds byte limit ${maximumBytes}`,
      );
    }
    chunks.push(Buffer.from(buffer.subarray(0, count)));
  }
  return Buffer.concat(chunks, total);
}

function readStableManifest(candidatePath, root, relativePath, maximumBytes) {
  let beforePath;
  let beforeState;
  try {
    beforeState = fs.lstatSync(candidatePath, { bigint: true });
    beforePath = fs.realpathSync(candidatePath);
  } catch {
    fail('content_manifest_changed', `manifest changed during discovery: ${safeText(relativePath)}`);
  }
  if (beforeState.isSymbolicLink()) {
    fail('content_manifest_symlink', `symbolic-link manifest files are unsupported: ${safeText(relativePath)}`);
  }
  if (!beforeState.isFile()) {
    fail('content_manifest_type', `manifest is not a regular file: ${safeText(relativePath)}`);
  }
  if (!isWithin(root, beforePath)) {
    fail('content_symlink_escape', `manifest escapes content root: ${safeText(relativePath)}`);
  }
  if (beforeState.size > BigInt(maximumBytes)) {
    fail(
      'content_manifest_byte_limit',
      `manifest ${safeText(relativePath)} exceeds byte limit ${maximumBytes}`,
    );
  }

  const noFollow = Number.isInteger(fs.constants.O_NOFOLLOW) ? fs.constants.O_NOFOLLOW : 0;
  let descriptor;
  let openedState;
  let finalHandleState;
  let source;
  try {
    descriptor = fs.openSync(candidatePath, fs.constants.O_RDONLY | noFollow);
    openedState = fs.fstatSync(descriptor, { bigint: true });
    if (!openedState.isFile() || !sameIdentity(beforeState, openedState)) {
      fail('content_manifest_changed', `manifest changed during discovery: ${safeText(relativePath)}`);
    }
    if (openedState.size > BigInt(maximumBytes)) {
      fail(
        'content_manifest_byte_limit',
        `manifest ${safeText(relativePath)} exceeds byte limit ${maximumBytes}`,
      );
    }
    source = boundedRead(descriptor, maximumBytes, relativePath);
    finalHandleState = fs.fstatSync(descriptor, { bigint: true });
  } catch (error) {
    if (error instanceof ContentDiscoveryError) throw error;
    fail('content_manifest_changed', `manifest changed during discovery: ${safeText(relativePath)}`);
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
  if (!sameFileState(openedState, finalHandleState)) {
    fail('content_manifest_changed', `manifest changed during discovery: ${safeText(relativePath)}`);
  }

  let afterPath;
  let afterState;
  try {
    afterState = fs.lstatSync(candidatePath, { bigint: true });
    afterPath = fs.realpathSync(candidatePath);
  } catch {
    fail('content_manifest_changed', `manifest changed during discovery: ${safeText(relativePath)}`);
  }
  if (afterState.isSymbolicLink() || !afterState.isFile()
      || afterPath !== beforePath || !isWithin(root, afterPath)
      || !sameFileState(beforeState, afterState)
      || !sameIdentity(finalHandleState, afterState)) {
    fail('content_manifest_changed', `manifest changed during discovery: ${safeText(relativePath)}`);
  }
  return { manifestPath: beforePath, source };
}

export function discoverContentPackages({
  rootDir,
  fixtureRoots = [],
  limits: limitOverrides,
} = {}) {
  if (typeof rootDir !== 'string' || rootDir.length === 0) {
    throw new TypeError('content discovery requires rootDir');
  }
  if (!Array.isArray(fixtureRoots) || fixtureRoots.some((entry) => typeof entry !== 'string')) {
    throw new TypeError('fixtureRoots must be an array of paths');
  }
  const limits = normalizedLimits(limitOverrides);
  const root = fs.realpathSync(rootDir);
  if (!fs.lstatSync(root).isDirectory()) {
    fail('content_root_type', `content root is not a directory: ${safeText(root)}`);
  }

  const fixtures = fixtureRoots.map((fixtureRoot) => {
    const resolved = fs.realpathSync(fixtureRoot);
    if (!isWithin(root, resolved)) {
      fail('content_fixture_escape', `fixture root escapes content root: ${safeText(fixtureRoot)}`);
    }
    if (!fs.lstatSync(resolved).isDirectory()) {
      fail('content_fixture_type', `fixture root is not a directory: ${safeText(fixtureRoot)}`);
    }
    return resolved;
  });

  const pendingDirectories = [root];
  const visitedDirectories = new Set();
  const manifests = [];
  const canonicalManifestPaths = new Map();
  const traversal = { directoryEntries: 0, limits };
  while (pendingDirectories.length > 0) {
    const pending = pendingDirectories.pop();
    const directory = fs.realpathSync(pending);
    if (!isWithin(root, directory)) {
      fail('content_symlink_escape', `symbolic link escapes content root: ${safeText(pending)}`);
    }
    if (visitedDirectories.has(directory)) continue;
    if (visitedDirectories.size >= limits.maxDirectories) {
      fail('content_directory_limit', `content directory limit ${limits.maxDirectories} exceeded`);
    }
    visitedDirectories.add(directory);

    const entries = readDirectoryEntries(directory, root, traversal);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      const entryPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        const target = fs.realpathSync(entryPath);
        if (!isWithin(root, target)) {
          fail('content_symlink_escape', `symbolic link escapes content root: ${safeText(entryPath)}`);
        }
        if (entry.name === 'pack.json') {
          fail(
            'content_manifest_symlink',
            `symbolic-link manifest files are unsupported: ${safeText(entryPath)}`,
          );
        }
        const targetState = fs.lstatSync(target, { bigint: true });
        if (targetState.isDirectory()) pendingDirectories.push(target);
        else if (manifestLikeUnsupported(entry.name)) {
          fail(
            'content_manifest_extension',
            `unsupported manifest path ${safeText(relativePosixRaw(root, entryPath))}`,
          );
        }
        continue;
      }
      if (entry.isDirectory()) {
        pendingDirectories.push(entryPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const relativePath = relativePosixRaw(root, entryPath);
      if (manifestLikeUnsupported(entry.name)) {
        fail('content_manifest_extension', `unsupported manifest path ${safeText(relativePath)}`);
      }
      if (entry.name !== 'pack.json') continue;

      const canonicalPath = relativePath.normalize('NFC').toLowerCase();
      const priorPath = canonicalManifestPaths.get(canonicalPath);
      if (priorPath !== undefined && priorPath !== relativePath) {
        fail(
          'content_manifest_path_collision',
          `normalized manifest path collision: ${safeText(priorPath)} and ${safeText(relativePath)}`,
        );
      }
      canonicalManifestPaths.set(canonicalPath, relativePath);
      if (manifests.length >= limits.maxPackages) {
        fail('content_package_limit', `content package limit ${limits.maxPackages} exceeded`);
      }
      manifests.push({
        candidatePath: entryPath,
        relativePath,
        normalizedRelativePath: relativePath.normalize('NFC'),
      });
    }
  }

  manifests.sort((left, right) => (
    canonicalCompare(left.normalizedRelativePath, right.normalizedRelativePath)
      || canonicalCompare(left.relativePath, right.relativePath)
  ));

  const seenIdentityBases = new Map();
  const seenLegacyIdentities = new Map();
  let corpusBytes = 0;
  const discovered = [];
  for (const { candidatePath, relativePath } of manifests) {
    const { manifestPath, source } = readStableManifest(
      candidatePath,
      root,
      relativePath,
      limits.maxManifestBytes,
    );
    corpusBytes += source.byteLength;
    if (corpusBytes > limits.maxCorpusBytes) {
      fail('content_corpus_byte_limit', `corpus byte limit ${limits.maxCorpusBytes} exceeded`);
    }
    const parsed = parseAuthoredJson(source, { maxBytes: limits.maxManifestBytes });
    const claim = effectivePackageIdentity(parsed);
    if (claim !== null) {
      const normalizedIdentity = claim.identity.normalize('NFC').toLowerCase();
      const priorBase = seenIdentityBases.get(normalizedIdentity);
      if (priorBase && priorBase.identity !== claim.identity) {
        fail(
          'content_package_case_collision',
          `case-normalized package identity collision: ${safeText(priorBase.identity)} and ${safeText(claim.identity)}`,
        );
      }
      if (claim.family === 'package') {
        if (priorBase) {
          fail(
            'content_package_duplicate',
            `duplicate package identity ${safeText(claim.identity)}: ${safeText(priorBase.path)} and ${safeText(relativePath)}`,
          );
        }
        seenIdentityBases.set(normalizedIdentity, {
          family: claim.family,
          identity: claim.identity,
          path: relativePath,
        });
      } else {
        if (priorBase?.family === 'package') {
          fail(
            'content_package_duplicate',
            `duplicate package identity ${safeText(claim.identity)}: ${safeText(priorBase.path)} and ${safeText(relativePath)}`,
          );
        }
        const legacyIdentity = `${normalizedIdentity}\u0000${claim.version}`;
        const priorLegacy = seenLegacyIdentities.get(legacyIdentity);
        if (priorLegacy) {
          fail(
            'content_package_duplicate',
            `duplicate package identity ${safeText(claim.identity)}: ${safeText(priorLegacy.path)} and ${safeText(relativePath)}`,
          );
        }
        seenLegacyIdentities.set(legacyIdentity, {
          identity: claim.identity,
          path: relativePath,
        });
        if (!priorBase) {
          seenIdentityBases.set(normalizedIdentity, {
            family: claim.family,
            identity: claim.identity,
            path: relativePath,
          });
        }
      }
    }
    discovered.push(discoveredPackageDescriptor({
      manifestPath,
      source,
      authorityProfile: fixtures.some((fixtureRoot) => isWithin(fixtureRoot, manifestPath))
        ? 'fixture'
        : 'production',
    }));
  }
  return discovered;
}
