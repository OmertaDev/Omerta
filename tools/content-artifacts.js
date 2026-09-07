import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { ContentCompileError } from '../src/content/corpus.js';

const MAX_PUBLISHED_ARTIFACT_BYTES = 64 * 1024 * 1024;
const MAX_PUBLISHED_OUTPUT_BYTES = 64 * 1024 * 1024;
const MAX_PUBLISHED_OUTPUTS = 2_049;
const STAGE_RANDOM_BYTES = 16;
const PUBLICATION_LOCK_NAME = '.corpus.publish.lock';
const PUBLICATION_LOCK_STAGE_PREFIX = '.corpus.publish.lock.staging-';
const PUBLICATION_LOCK_MAX_BYTES = 32;
const NO_FOLLOW = fs.constants.O_NOFOLLOW ?? 0;
const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  'byteLength',
).get;

function mismatch(message) {
  throw new ContentCompileError('content_artifact_mismatch', 'build', message);
}

function safeLstat(target, role, { optional = false } = {}) {
  try {
    return fs.lstatSync(target, { bigint: true });
  } catch (error) {
    if (optional && error?.code === 'ENOENT') return null;
    mismatch(`${role} cannot be inspected safely`);
  }
}

function normalizedPathForComparison(value) {
  const normalized = path.normalize(value);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function identityOf(status) {
  return { device: status.dev, inode: status.ino };
}

function sameIdentity(left, right) {
  return left.device === right.device && left.inode === right.inode;
}

function ensureRegularStatus(status, role, {
  expectedSize,
  expectedLinks,
  expectedIdentity,
} = {}) {
  if (!status.isFile() || status.isSymbolicLink()) {
    mismatch(`${role} is not a regular immutable file`);
  }
  if (expectedSize !== undefined && Number(status.size) !== expectedSize) {
    mismatch(`${role} size conflicts with its requested bytes`);
  }
  if (expectedLinks !== undefined && Number(status.nlink) !== expectedLinks) {
    mismatch(`${role} has an unsafe link count`);
  }
  if (expectedIdentity !== undefined && !sameIdentity(identityOf(status), expectedIdentity)) {
    mismatch(`${role} identity changed during publication`);
  }
  return status;
}

function assertOutputDirectory(directory) {
  const status = safeLstat(directory.resolved, 'immutable corpus output path');
  if (status.isSymbolicLink() || !status.isDirectory()
      || !sameIdentity(identityOf(status), directory.identity)) {
    mismatch('immutable corpus output identity changed during publication');
  }
  let real;
  try {
    real = fs.realpathSync.native(directory.resolved);
  } catch {
    mismatch('immutable corpus output cannot be resolved safely');
  }
  if (normalizedPathForComparison(real) !== normalizedPathForComparison(directory.resolved)) {
    mismatch('immutable corpus output resolves outside its declared path');
  }
}

function ensureRealDirectoryPath(outputPath) {
  const resolved = path.resolve(outputPath);
  const parsed = path.parse(resolved);
  const segments = path.relative(parsed.root, resolved).split(path.sep).filter(Boolean);
  let current = parsed.root;
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    if (!safeLstat(current, 'immutable corpus output path', { optional: true })) {
      try {
        fs.mkdirSync(current);
      } catch (error) {
        if (error?.code !== 'EEXIST') mismatch('immutable corpus output cannot be created safely');
      }
    }
    const status = safeLstat(current, 'immutable corpus output path');
    if (status.isSymbolicLink() || !status.isDirectory()) {
      mismatch(index === segments.length - 1
        ? 'immutable corpus output is not a real directory'
        : 'immutable corpus output has an unsafe path component');
    }
  }
  let real;
  try {
    real = fs.realpathSync.native(resolved);
  } catch {
    mismatch('immutable corpus output cannot be resolved safely');
  }
  if (normalizedPathForComparison(real) !== normalizedPathForComparison(resolved)) {
    mismatch('immutable corpus output resolves outside its declared path');
  }
  return { resolved, identity: identityOf(safeLstat(resolved, 'immutable corpus output path')) };
}

function validateArtifactName(name) {
  if (typeof name !== 'string' || name.length === 0 || path.basename(name) !== name
      || name === '.' || name === '..' || name === PUBLICATION_LOCK_NAME
      || name.startsWith(PUBLICATION_LOCK_STAGE_PREFIX)) {
    mismatch('immutable corpus artifact has an invalid filename');
  }
  // Publication names form a portable immutable namespace. Reject spellings
  // which Windows trims, aliases to a device, or interprets as an alternate
  // data stream before any output directory is created. This keeps the helper
  // contract safe even when a caller supplies names other than CLI hashes.
  if (/[. ]$/u.test(name) || /[<>:"/\\|?*\u0000-\u001f]/u.test(name)) {
    mismatch('immutable corpus artifact has an invalid filename');
  }
  const basename = name.split('.', 1)[0];
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/iu.test(basename)) {
    mismatch('immutable corpus artifact has an invalid filename');
  }
  for (let index = 0; index < name.length; index += 1) {
    const code = name.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = name.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) mismatch('immutable corpus artifact has an invalid filename');
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      mismatch('immutable corpus artifact has an invalid filename');
    }
  }
  return name;
}

function portableArtifactName(name) {
  return name.normalize('NFC').toUpperCase().toLowerCase();
}

function ownDataProperty(value, property, role) {
  let descriptor;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, property);
  } catch {
    mismatch(`${role} cannot be inspected safely`);
  }
  if (!descriptor || descriptor.get !== undefined || descriptor.set !== undefined) {
    mismatch(`${role} must be an own data property`);
  }
  return descriptor.value;
}

function safeViewByteLength(value, role) {
  try {
    return TYPED_ARRAY_BYTE_LENGTH.call(value);
  } catch {
    mismatch(`${role} byte length cannot be inspected safely`);
  }
}

function structurallySnapshotOutputs(outputs) {
  const structural = [];
  for (let index = 0; index < outputs.length; index += 1) {
    const output = ownDataProperty(outputs, String(index), 'immutable corpus output entry');
    if (output === null || typeof output !== 'object' || Array.isArray(output)) {
      mismatch('immutable corpus output entry is invalid');
    }
    let prototype;
    try { prototype = Object.getPrototypeOf(output); }
    catch { mismatch('immutable corpus output entry cannot be inspected safely'); }
    if (prototype !== Object.prototype && prototype !== null) {
      mismatch('immutable corpus output entry has an unsafe prototype');
    }
    structural.push({
      name: ownDataProperty(output, 'name', 'immutable corpus artifact name'),
      bytes: ownDataProperty(output, 'bytes', 'immutable corpus artifact bytes'),
    });
  }
  return structural;
}

function stagePrefix(name) {
  return `.${name}.staging-`;
}

function stageOwner(name, outputs) {
  for (const output of outputs) {
    const prefix = stagePrefix(output.name);
    if (name.startsWith(prefix) && /^[a-f0-9]{32}$/u.test(name.slice(prefix.length))) {
      return output;
    }
  }
  return null;
}

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function readDescriptorExactly(descriptor, size, role) {
  const bytes = Buffer.alloc(size);
  let offset = 0;
  while (offset < bytes.length) {
    let count;
    try {
      count = fs.readSync(descriptor, bytes, offset, bytes.length - offset, offset);
    } catch {
      mismatch(`${role} cannot be read safely`);
    }
    if (count === 0) mismatch(`${role} ended before its declared size`);
    offset += count;
  }
  return bytes;
}

function openAndVerifyArtifact(artifactPath, output, {
  expectedLinks = 1,
  expectedIdentity,
} = {}) {
  const role = `artifact ${output.name}`;
  const beforePath = ensureRegularStatus(safeLstat(artifactPath, role), role, {
    expectedSize: output.bytes.byteLength,
    expectedLinks,
    expectedIdentity,
  });
  let descriptor;
  try {
    descriptor = fs.openSync(artifactPath, fs.constants.O_RDONLY | NO_FOLLOW);
    const beforeHandle = ensureRegularStatus(fs.fstatSync(descriptor, { bigint: true }), role, {
      expectedSize: output.bytes.byteLength,
      expectedLinks,
      expectedIdentity: identityOf(beforePath),
    });
    const actual = readDescriptorExactly(descriptor, output.bytes.byteLength, role);
    const afterHandle = ensureRegularStatus(fs.fstatSync(descriptor, { bigint: true }), role, {
      expectedSize: output.bytes.byteLength,
      expectedLinks,
      expectedIdentity: identityOf(beforeHandle),
    });
    const afterPath = ensureRegularStatus(safeLstat(artifactPath, role), role, {
      expectedSize: output.bytes.byteLength,
      expectedLinks,
      expectedIdentity: identityOf(afterHandle),
    });
    if (!sameIdentity(identityOf(beforePath), identityOf(afterPath))
        || digest(actual) !== output.digest || !actual.equals(output.bytes)) {
      mismatch(`${role} conflicts with its requested bytes`);
    }
    return identityOf(afterPath);
  } catch (error) {
    if (error instanceof ContentCompileError) throw error;
    mismatch(`${role} cannot be opened safely`);
  } finally {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); }
      catch { mismatch(`${role} cannot be closed safely`); }
    }
  }
}

function removeRecoverableStage(directory, name, output) {
  const stagePath = path.join(directory.resolved, name);
  const role = `staging file for ${output.name}`;
  const status = ensureRegularStatus(safeLstat(stagePath, role), role);
  if (Number(status.size) > output.bytes.byteLength
      || Number(status.size) > MAX_PUBLISHED_ARTIFACT_BYTES) {
    mismatch(`${role} is not recoverable`);
  }
  const stageIdentity = identityOf(status);
  if (Number(status.nlink) === 2) {
    const artifactPath = path.join(directory.resolved, output.name);
    openAndVerifyArtifact(artifactPath, output, {
      expectedLinks: 2,
      expectedIdentity: stageIdentity,
    });
    assertOutputDirectory(directory);
    removeExactPath(stagePath, stageIdentity);
    openAndVerifyArtifact(artifactPath, output, {
      expectedLinks: 1,
      expectedIdentity: stageIdentity,
    });
    return;
  }
  if (Number(status.nlink) !== 1) mismatch(`${role} has an unsafe link count`);
  assertOutputDirectory(directory);
  try {
    fs.unlinkSync(stagePath);
  } catch {
    mismatch(`${role} cannot be recovered`);
  }
}

function verifyOpenStage(stage, output) {
  const role = `staging file for ${output.name}`;
  const beforeHandle = ensureRegularStatus(fs.fstatSync(stage.descriptor, { bigint: true }), role, {
    expectedSize: output.bytes.byteLength,
    expectedLinks: 1,
    expectedIdentity: stage.identity,
  });
  const actual = readDescriptorExactly(stage.descriptor, output.bytes.byteLength, role);
  const afterHandle = ensureRegularStatus(fs.fstatSync(stage.descriptor, { bigint: true }), role, {
    expectedSize: output.bytes.byteLength,
    expectedLinks: 1,
    expectedIdentity: identityOf(beforeHandle),
  });
  const pathStatus = ensureRegularStatus(safeLstat(stage.path, role), role, {
    expectedSize: output.bytes.byteLength,
    expectedLinks: 1,
    expectedIdentity: identityOf(afterHandle),
  });
  if (digest(actual) !== output.digest || !actual.equals(output.bytes)) {
    mismatch(`${role} bytes changed before publication`);
  }
  return identityOf(pathStatus);
}

function stageArtifact(directory, output, hooks) {
  assertOutputDirectory(directory);
  let descriptor;
  let stagingName;
  let stagingPath;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    stagingName = `${stagePrefix(output.name)}${crypto.randomBytes(STAGE_RANDOM_BYTES).toString('hex')}`;
    stagingPath = path.join(directory.resolved, stagingName);
    try {
      descriptor = fs.openSync(
        stagingPath,
        fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR | NO_FOLLOW,
        0o600,
      );
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST') mismatch(`artifact ${output.name} could not be staged safely`);
    }
  }
  if (descriptor === undefined) mismatch(`artifact ${output.name} could not reserve a unique stage`);
  const initial = ensureRegularStatus(fs.fstatSync(descriptor, { bigint: true }),
    `staging file for ${output.name}`, { expectedSize: 0, expectedLinks: 1 });
  const stage = {
    descriptor,
    name: stagingName,
    path: stagingPath,
    identity: identityOf(initial),
  };
  try {
    if (hooks?.writeStage) hooks.writeStage({ descriptor, name: output.name, bytes: output.bytes });
    else fs.writeFileSync(descriptor, output.bytes);
    fs.fsyncSync(descriptor);
    verifyOpenStage(stage, output);
    hooks?.afterStage?.({ name: output.name, stagingName });
    return stage;
  } catch (error) {
    try { fs.closeSync(descriptor); } catch { /* stable failure below */ }
    stage.descriptor = undefined;
    removeExactPath(stage.path, stage.identity);
    if (error instanceof ContentCompileError) throw error;
    mismatch(`artifact ${output.name} could not be staged completely`);
  }
}

function removeExactPath(target, identity) {
  const status = safeLstat(target, 'new immutable artifact', { optional: true });
  if (!status || !sameIdentity(identityOf(status), identity)) return;
  try { fs.unlinkSync(target); } catch { /* fail closed at the original mismatch */ }
}

function lockOwnerIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    return true;
  }
}

function inspectExistingPublicationLock(lockPath) {
  const role = 'immutable corpus publication lock';
  const pathStatus = ensureRegularStatus(safeLstat(lockPath, role), role, {
    expectedLinks: 1,
  });
  const size = Number(pathStatus.size);
  if (!Number.isSafeInteger(size) || size < 1 || size > PUBLICATION_LOCK_MAX_BYTES) {
    mismatch(`${role} is malformed`);
  }
  let descriptor;
  try {
    descriptor = fs.openSync(lockPath, fs.constants.O_RDONLY | NO_FOLLOW);
    const handleStatus = ensureRegularStatus(fs.fstatSync(descriptor, { bigint: true }), role, {
      expectedSize: size,
      expectedLinks: 1,
      expectedIdentity: identityOf(pathStatus),
    });
    const ownerText = readDescriptorExactly(descriptor, size, role).toString('ascii');
    const afterPath = ensureRegularStatus(safeLstat(lockPath, role), role, {
      expectedSize: size,
      expectedLinks: 1,
      expectedIdentity: identityOf(handleStatus),
    });
    if (!/^[1-9][0-9]{0,14}$/u.test(ownerText)) mismatch(`${role} is malformed`);
    const pid = Number(ownerText);
    if (!Number.isSafeInteger(pid)) mismatch(`${role} is malformed`);
    return { identity: identityOf(afterPath), pid };
  } catch (error) {
    if (error instanceof ContentCompileError) throw error;
    mismatch(`${role} cannot be opened safely`);
  } finally {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch { mismatch(`${role} cannot be closed safely`); }
    }
  }
}

function recoverPublicationLockStages(directory) {
  const role = 'immutable corpus publication lock staging file';
  let names;
  try { names = fs.readdirSync(directory.resolved); }
  catch { mismatch('immutable corpus publication lock directory cannot be listed safely'); }
  for (const name of names) {
    if (!name.startsWith(PUBLICATION_LOCK_STAGE_PREFIX)) continue;
    const match = /^([1-9][0-9]{0,14})-([a-f0-9]{32})$/u.exec(
      name.slice(PUBLICATION_LOCK_STAGE_PREFIX.length),
    );
    if (!match) mismatch(`${role} is malformed`);
    const pid = Number(match[1]);
    if (!Number.isSafeInteger(pid)) mismatch(`${role} is malformed`);
    const stagePath = path.join(directory.resolved, name);
    const status = ensureRegularStatus(safeLstat(stagePath, role), role);
    const size = Number(status.size);
    const links = Number(status.nlink);
    if (!Number.isSafeInteger(size) || size > PUBLICATION_LOCK_MAX_BYTES
        || (links !== 1 && links !== 2)) {
      mismatch(`${role} is malformed`);
    }
    if (lockOwnerIsAlive(pid)) mismatch('immutable corpus publication is already in progress');
    const stageIdentity = identityOf(status);
    let linkedLockIdentity;
    const lockPath = path.join(directory.resolved, PUBLICATION_LOCK_NAME);
    if (links === 2) {
      const lockStatus = ensureRegularStatus(safeLstat(lockPath, 'immutable corpus publication lock'),
        'immutable corpus publication lock', {
          expectedLinks: 2,
          expectedIdentity: stageIdentity,
        });
      linkedLockIdentity = identityOf(lockStatus);
    }
    assertOutputDirectory(directory);
    removeExactPath(stagePath, stageIdentity);
    if (safeLstat(stagePath, role, { optional: true })) {
      mismatch(`${role} could not be recovered`);
    }
    if (linkedLockIdentity) {
      removeExactPath(lockPath, linkedLockIdentity);
      if (safeLstat(lockPath, 'immutable corpus publication lock', { optional: true })) {
        mismatch('stale immutable corpus publication lock could not be recovered');
      }
    }
  }
}

function inspectConcurrentPublicationLockStage(directory, name, lock) {
  const role = 'concurrent immutable corpus publication lock staging file';
  const match = /^([1-9][0-9]{0,14})-([a-f0-9]{32})$/u.exec(
    name.slice(PUBLICATION_LOCK_STAGE_PREFIX.length),
  );
  if (!match || !Number.isSafeInteger(Number(match[1]))) mismatch(`${role} is malformed`);
  const ownerBytes = Buffer.from(match[1], 'ascii');
  const stagePath = path.join(directory.resolved, name);
  const assertHeldLock = () => {
    assertOutputDirectory(directory);
    const options = {
      expectedIdentity: lock.identity,
      expectedLinks: 1,
      expectedSize: Buffer.byteLength(String(process.pid)),
    };
    ensureRegularStatus(fs.fstatSync(lock.descriptor, { bigint: true }), 'held publication lock', options);
    ensureRegularStatus(safeLstat(lock.path, 'held publication lock'), 'held publication lock', options);
  };
  let descriptor;
  try {
    assertHeldLock();
    const initial = safeLstat(stagePath, role, { optional: true });
    if (!initial) return;
    ensureRegularStatus(initial, role, { expectedLinks: 1 });
    if (initial.size < 0n || initial.size > BigInt(ownerBytes.length)) mismatch(`${role} is malformed`);
    let ownerAlive = true;
    try { process.kill(Number(match[1]), 0); }
    catch (error) {
      if (error?.code === 'ESRCH') ownerAlive = false;
      else if (error?.code !== 'EPERM') mismatch(`${role} owner cannot be inspected safely`);
    }
    if (!ownerAlive) {
      if (!safeLstat(stagePath, role, { optional: true })) return;
      mismatch(`${role} has no valid live owner`);
    }
    try { descriptor = fs.openSync(stagePath, fs.constants.O_RDONLY | NO_FOLLOW); }
    catch (error) {
      if (error?.code === 'ENOENT' && !safeLstat(stagePath, role, { optional: true })) return;
      mismatch(`${role} cannot be opened safely`);
    }
    const stageIdentity = identityOf(initial);
    const currentSize = (minimum) => {
      const status = fs.fstatSync(descriptor, { bigint: true });
      const pathStatus = safeLstat(stagePath, role, { optional: true });
      // A contender may unlink its own stage after our open. An absent path
      // grants no cleanup authority and does not authorize a replacement inode.
      if (!pathStatus) {
        ensureRegularStatus(fs.fstatSync(descriptor, { bigint: true }), role, {
          expectedIdentity: stageIdentity,
          expectedLinks: 0,
        });
        return null;
      }
      for (const entry of [status, pathStatus]) {
        ensureRegularStatus(entry, role, { expectedIdentity: stageIdentity, expectedLinks: 1 });
        if (entry.size < BigInt(minimum) || entry.size > BigInt(ownerBytes.length)) {
          mismatch(`${role} is malformed`);
        }
      }
      return Math.max(Number(status.size), Number(pathStatus.size));
    };
    let size = currentSize(Number(initial.size));
    // Creation precedes the PID write. Admit only an empty file or exact PID
    // prefix; revisit strictly growing prefixes at most once per possible byte.
    // These bytes never become artifact input or authorize deletion/publication.
    for (let growth = 0; growth <= ownerBytes.length; growth++) {
      if (size === null) return;
      if (!readDescriptorExactly(descriptor, size, role).equals(ownerBytes.subarray(0, size))) {
        mismatch(`${role} owner bytes conflict with its filename`);
      }
      const afterSize = currentSize(size);
      if (afterSize === null || afterSize === size) return;
      size = afterSize;
    }
    mismatch(`${role} did not finish a bounded owner write`);
  } catch (error) {
    if (error instanceof ContentCompileError) throw error;
    mismatch(`${role} cannot be inspected safely`);
  } finally {
    if (descriptor !== undefined) {
      try { fs.closeSync(descriptor); } catch { mismatch(`${role} cannot be closed safely`); }
    }
    // Even the optional-disappearance paths are valid only under our exact lock.
    try { assertHeldLock(); }
    catch (error) {
      if (error instanceof ContentCompileError) throw error;
      mismatch('held publication lock cannot be inspected safely');
    }
  }
}

function createPublicationLockStage(directory, hooks) {
  const role = 'immutable corpus publication lock staging file';
  let descriptor;
  let stagePath;
  let identity;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const name = `${PUBLICATION_LOCK_STAGE_PREFIX}${process.pid}-${crypto.randomBytes(STAGE_RANDOM_BYTES).toString('hex')}`;
    stagePath = path.join(directory.resolved, name);
    try {
      descriptor = fs.openSync(
        stagePath,
        fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR | NO_FOLLOW,
        0o600,
      );
      const initial = ensureRegularStatus(fs.fstatSync(descriptor, { bigint: true }), role, {
        expectedSize: 0,
        expectedLinks: 1,
      });
      identity = identityOf(initial);
      hooks?.afterLockStageCreate?.();
      const bytes = Buffer.from(String(process.pid), 'ascii');
      fs.writeFileSync(descriptor, bytes);
      fs.fsyncSync(descriptor);
      const final = ensureRegularStatus(fs.fstatSync(descriptor, { bigint: true }), role, {
        expectedSize: bytes.byteLength,
        expectedLinks: 1,
        expectedIdentity: identity,
      });
      const pathStatus = ensureRegularStatus(safeLstat(stagePath, role), role, {
        expectedSize: bytes.byteLength,
        expectedLinks: 1,
        expectedIdentity: identityOf(final),
      });
      if (!readDescriptorExactly(descriptor, bytes.byteLength, role).equals(bytes)) {
        mismatch(`${role} owner changed during publication`);
      }
      return { descriptor, path: stagePath, identity: identityOf(pathStatus), bytes };
    } catch (error) {
      if (descriptor !== undefined) {
        try { fs.closeSync(descriptor); } catch { /* stable failure below */ }
      }
      if (identity) removeExactPath(stagePath, identity);
      if (error instanceof ContentCompileError) throw error;
      if (error?.code !== 'EEXIST') mismatch(`${role} cannot be created safely`);
      descriptor = undefined;
      identity = undefined;
    }
  }
  mismatch(`${role} cannot reserve a unique name`);
}

function acquirePublicationLock(directory, hooks) {
  const lockPath = path.join(directory.resolved, PUBLICATION_LOCK_NAME);
  recoverPublicationLockStages(directory);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    assertOutputDirectory(directory);
    const stage = createPublicationLockStage(directory, hooks);
    let linkedIdentity;
    try {
      fs.linkSync(stage.path, lockPath);
      const stageLinked = ensureRegularStatus(fs.fstatSync(stage.descriptor, { bigint: true }),
        'immutable corpus publication lock', {
          expectedSize: stage.bytes.byteLength,
          expectedLinks: 2,
          expectedIdentity: stage.identity,
        });
      const fixedLinked = ensureRegularStatus(safeLstat(lockPath, 'immutable corpus publication lock'),
        'immutable corpus publication lock', {
          expectedSize: stage.bytes.byteLength,
          expectedLinks: 2,
          expectedIdentity: identityOf(stageLinked),
        });
      linkedIdentity = identityOf(fixedLinked);
      removeExactPath(stage.path, stage.identity);
      if (safeLstat(stage.path, 'immutable corpus publication lock staging file', { optional: true })) {
        mismatch('immutable corpus publication lock staging file could not be finalized');
      }
      const final = ensureRegularStatus(safeLstat(lockPath, 'immutable corpus publication lock'),
        'immutable corpus publication lock', {
          expectedSize: stage.bytes.byteLength,
          expectedLinks: 1,
          expectedIdentity: linkedIdentity,
        });
      return { descriptor: stage.descriptor, identity: identityOf(final), path: lockPath };
    } catch (error) {
      try { fs.closeSync(stage.descriptor); } catch { /* stable failure below */ }
      if (linkedIdentity) removeExactPath(lockPath, linkedIdentity);
      removeExactPath(stage.path, stage.identity);
      if (error instanceof ContentCompileError) throw error;
      if (error?.code !== 'EEXIST') mismatch('immutable corpus publication lock cannot be acquired safely');
      const existing = inspectExistingPublicationLock(lockPath);
      if (lockOwnerIsAlive(existing.pid)) mismatch('immutable corpus publication is already in progress');
      assertOutputDirectory(directory);
      removeExactPath(lockPath, existing.identity);
      if (safeLstat(lockPath, 'immutable corpus publication lock', { optional: true })) {
        mismatch('stale immutable corpus publication lock could not be recovered');
      }
    }
  }
  mismatch('immutable corpus publication lock could not be acquired safely');
}

function releasePublicationLock(lock) {
  let closeFailed = false;
  try { fs.closeSync(lock.descriptor); } catch { closeFailed = true; }
  removeExactPath(lock.path, lock.identity);
  if (closeFailed) mismatch('immutable corpus publication lock could not be closed safely');
}

function publishStagedArtifact(directory, output, stage, hooks) {
  const artifactPath = path.join(directory.resolved, output.name);
  let created = false;
  let createdIdentity;
  let finalIdentity;
  try {
    assertOutputDirectory(directory);
    hooks?.beforePublish?.({ name: output.name, stagingName: stage.name });
    const stageIdentity = verifyOpenStage(stage, output);
    assertOutputDirectory(directory);
    try {
      if (hooks?.linkStage) {
        hooks.linkStage({
          name: output.name,
          stagingName: stage.name,
          stagePath: stage.path,
          artifactPath,
        });
      } else {
        fs.linkSync(stage.path, artifactPath);
      }
      created = true;
      // Capture the actual destination identity before enforcing that it is
      // the verified stage identity. If pathname resolution selected a
      // replacement inode, cleanup can unlink only the exact entry created by
      // this invocation instead of poisoning the immutable destination name.
      createdIdentity = identityOf(safeLstat(artifactPath, `artifact ${output.name}`));
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        mismatch(`artifact ${output.name} could not be published atomically`);
      }
      finalIdentity = openAndVerifyArtifact(artifactPath, output, { expectedLinks: 1 });
    }
    if (created) {
      finalIdentity = openAndVerifyArtifact(artifactPath, output, {
        expectedLinks: 2,
        expectedIdentity: stageIdentity,
      });
    }
    try {
      fs.unlinkSync(stage.path);
    } catch {
      mismatch(`staging file for ${output.name} could not be finalized`);
    }
    openAndVerifyArtifact(artifactPath, output, {
      expectedLinks: 1,
      expectedIdentity: finalIdentity,
    });
    return { created, identity: finalIdentity };
  } catch (error) {
    if (created && createdIdentity) removeExactPath(artifactPath, createdIdentity);
    if (error instanceof ContentCompileError) throw error;
    mismatch(`artifact ${output.name} could not be published safely`);
  } finally {
    if (stage.descriptor !== undefined) {
      try { fs.closeSync(stage.descriptor); }
      catch { mismatch(`staging file for ${output.name} could not be closed safely`); }
      stage.descriptor = undefined;
    }
    // A losing concurrent publisher can observe the winning final while it
    // still has two links. Always remove only this invocation's exact stage
    // inode so routine contention leaves no recoverable debris.
    removeExactPath(stage.path, stage.identity);
  }
}

export function publishImmutableCorpus({ outputPath, outputs, hooks } = {}) {
  if (!Array.isArray(outputs) || outputs.length === 0) {
    mismatch('immutable corpus output set is empty');
  }
  if (outputs.length > MAX_PUBLISHED_OUTPUTS) {
    mismatch('immutable corpus output set exceeds the publication count limit');
  }
  const structuralOutputs = structurallySnapshotOutputs(outputs);
  const admittedOutputs = [];
  const names = new Set();
  const portableNames = new Set();
  let aggregateBytes = 0;
  for (const output of structuralOutputs) {
    const name = validateArtifactName(output.name);
    const sourceBytes = output.bytes;
    let prototype;
    try { prototype = Object.getPrototypeOf(sourceBytes); }
    catch { mismatch(`artifact ${name} bytes cannot be inspected safely`); }
    if (prototype !== Uint8Array.prototype && prototype !== Buffer.prototype) {
      mismatch(`artifact ${name} bytes are invalid`);
    }
    const byteLength = safeViewByteLength(sourceBytes, `artifact ${name}`);
    if (byteLength > MAX_PUBLISHED_ARTIFACT_BYTES) {
      mismatch(`artifact ${name} exceeds the immutable publication limit`);
    }
    if (names.has(name)) mismatch('immutable corpus output contains duplicate filenames');
    names.add(name);
    const portableName = portableArtifactName(name);
    if (portableNames.has(portableName)) {
      mismatch('immutable corpus output contains portable filename aliases');
    }
    portableNames.add(portableName);
    aggregateBytes += byteLength;
    if (!Number.isSafeInteger(aggregateBytes) || aggregateBytes > MAX_PUBLISHED_OUTPUT_BYTES) {
      mismatch('immutable corpus output set exceeds the publication byte limit');
    }
    admittedOutputs.push({ name, sourceBytes, byteLength });
  }
  let snapshotAggregateBytes = 0;
  const normalizedOutputs = admittedOutputs.map((output) => {
    if (safeViewByteLength(output.sourceBytes, `artifact ${output.name}`) !== output.byteLength) {
      mismatch(`artifact ${output.name} byte length changed during admission`);
    }
    let bytes;
    try {
      bytes = Buffer.allocUnsafe(output.byteLength);
      Uint8Array.prototype.set.call(bytes, output.sourceBytes);
    } catch {
      mismatch(`artifact ${output.name} could not be snapshotted safely`);
    }
    if (safeViewByteLength(output.sourceBytes, `artifact ${output.name}`) !== output.byteLength
        || bytes.byteLength !== output.byteLength) {
      mismatch(`artifact ${output.name} changed while being snapshotted`);
    }
    snapshotAggregateBytes += bytes.byteLength;
    if (!Number.isSafeInteger(snapshotAggregateBytes)
        || snapshotAggregateBytes > MAX_PUBLISHED_OUTPUT_BYTES) {
      mismatch('immutable corpus output snapshots exceed the publication byte limit');
    }
    return { name: output.name, bytes, digest: digest(bytes) };
  });
  if (snapshotAggregateBytes !== aggregateBytes) {
    mismatch('immutable corpus output changed during admission');
  }
  const directory = ensureRealDirectoryPath(outputPath);
  const publicationLock = acquirePublicationLock(directory, hooks);
  try {
    let existingNames;
    try {
      existingNames = fs.readdirSync(directory.resolved);
    } catch {
      mismatch('immutable corpus output cannot be listed safely');
    }
    for (const name of existingNames) {
      if (name === PUBLICATION_LOCK_NAME || names.has(name)) continue;
      if (name.startsWith(PUBLICATION_LOCK_STAGE_PREFIX)) {
        inspectConcurrentPublicationLockStage(directory, name, publicationLock);
        continue;
      }
      const owner = stageOwner(name, normalizedOutputs);
      if (!owner) mismatch(`immutable corpus output contains unexpected artifact ${path.basename(name)}`);
      removeRecoverableStage(directory, name, owner);
    }

    for (const output of normalizedOutputs) {
      const artifactPath = path.join(directory.resolved, output.name);
      if (!safeLstat(artifactPath, `artifact ${output.name}`, { optional: true })) continue;
      openAndVerifyArtifact(artifactPath, output, { expectedLinks: 1 });
    }

    const ordered = [
      ...normalizedOutputs.filter((output) => output.name !== 'corpus.index.json'),
      ...normalizedOutputs.filter((output) => output.name === 'corpus.index.json'),
    ];
    const publicationByName = new Map();
    for (const output of ordered) {
      if (output.name === 'corpus.index.json') {
        hooks?.beforeIndex?.();
        for (const prior of ordered.filter((entry) => entry.name !== 'corpus.index.json')) {
          openAndVerifyArtifact(path.join(directory.resolved, prior.name), prior, { expectedLinks: 1 });
        }
      }
      const artifactPath = path.join(directory.resolved, output.name);
      if (safeLstat(artifactPath, `artifact ${output.name}`, { optional: true })) {
        publicationByName.set(output.name, {
          created: false,
          identity: openAndVerifyArtifact(artifactPath, output, { expectedLinks: 1 }),
        });
        continue;
      }
      const stage = stageArtifact(directory, output, hooks);
      publicationByName.set(output.name, publishStagedArtifact(directory, output, stage, hooks));
    }

    try {
      assertOutputDirectory(directory);
      for (const output of ordered) {
        const publication = publicationByName.get(output.name);
        openAndVerifyArtifact(path.join(directory.resolved, output.name), output, {
          expectedLinks: 1,
          expectedIdentity: publication.identity,
        });
      }
    } catch (error) {
      const index = publicationByName.get('corpus.index.json');
      if (index?.created) {
        removeExactPath(path.join(directory.resolved, 'corpus.index.json'), index.identity);
      }
      throw error;
    }
  } finally {
    releasePublicationLock(publicationLock);
  }
}
