#!/usr/bin/env node
// A finite, conservative Agent Turn client. Identity state is deliberately local and reports are
// deliberately lossy: the session owns the bearer token while telemetry owns no sensitive values.
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { lstat, mkdir, open, readFile, realpath, rename, stat, unlink } from 'node:fs/promises';
import { createServer } from 'node:net';
import { basename, dirname, join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const SESSION_VERSION = 1;
const MIN_INTERVAL_MS = 3100;
const POLICY = Object.freeze({
  cashReserve: 1000,
  minArbitrageProfit: 25,
  allowPvP: false,
  allowBorrowing: false,
});
const ALLOWED_KINDS = new Set([
  'onboard_claim', 'daily_claim', 'career_claim',
  'business_collect', 'territory_collect', 'kitchen_collect', 'convoy_collect',
  'convoy_travel', 'market_fill', 'arbitrage_buy', 'arbitrage_sell',
  'arbitrage_travel', 'loan_repay', 'crew_recruiting', 'crime',
]);

const defaultSleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
const execFileAsync = promisify(execFile);

const WINDOWS_ACL_CHECK = `
  $ErrorActionPreference = 'Stop'
  $target = $env:OMERTA_ALPHA_ACL_TARGET
  $kind = $env:OMERTA_ALPHA_ACL_KIND
  $userSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $sections = [System.Security.AccessControl.AccessControlSections]::Access -bor
    [System.Security.AccessControl.AccessControlSections]::Owner
  if ($kind -eq 'directory') {
    $item = New-Object System.IO.DirectoryInfo($target)
  } else {
    $item = New-Object System.IO.FileInfo($target)
  }
  if (-not $item.Exists) { exit 20 }
  $acl = $item.GetAccessControl($sections)
  $ownerSid = $acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value
  if ($ownerSid -ne $userSid) { exit 21 }
  if ($kind -eq 'directory' -and -not $acl.AreAccessRulesProtected) { exit 25 }
  # SYSTEM and Administrators are the Windows security boundary: administrators can take ownership
  # regardless of an ACE, while ordinary local users/groups must have no allow rule at all.
  $trusted = @($userSid, 'S-1-5-18', 'S-1-5-32-544')
  $ownerFullControl = $false
  $rules = $acl.GetAccessRules(
    $true,
    $true,
    [System.Security.Principal.SecurityIdentifier]
  )
  foreach ($rule in $rules) {
    $sid = $rule.IdentityReference.Value
    if ($rule.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow) {
      exit 22
    }
    if ($trusted -notcontains $sid) { exit 23 }
    if ($sid -eq $userSid) {
      $rights = [int64]$rule.FileSystemRights
      $full = [int64][System.Security.AccessControl.FileSystemRights]::FullControl
      if (($rights -band $full) -eq $full) { $ownerFullControl = $true }
    }
  }
  if (-not $ownerFullControl) { exit 24 }
`;

const WINDOWS_CREATE_PRIVATE_FILE = `
  $ErrorActionPreference = 'Stop'
  $target = $env:OMERTA_ALPHA_ACL_TARGET
  $user = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
  $system = New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')
  $admins = New-Object System.Security.Principal.SecurityIdentifier('S-1-5-32-544')
  $security = New-Object System.Security.AccessControl.FileSecurity
  $security.SetOwner($user)
  $security.SetAccessRuleProtection($true, $false)
  foreach ($sid in @($user, $system, $admins)) {
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
      $sid,
      [System.Security.AccessControl.FileSystemRights]::FullControl,
      [System.Security.AccessControl.AccessControlType]::Allow
    )
    [void]$security.AddAccessRule($rule)
  }
  $stream = New-Object System.IO.FileStream(
    $target,
    [System.IO.FileMode]::CreateNew,
    [System.Security.AccessControl.FileSystemRights]::FullControl,
    [System.IO.FileShare]::None,
    4096,
    [System.IO.FileOptions]::WriteThrough,
    $security
  )
  $stream.Dispose()
`;

function windowsPowerShell() {
  return process.env.SystemRoot
    ? join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    : 'powershell.exe';
}

async function runWindowsSecurityScript(script, path, kind) {
  await execFileAsync(windowsPowerShell(), [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script,
  ], {
    env: {
      ...process.env,
      OMERTA_ALPHA_ACL_TARGET: path,
      OMERTA_ALPHA_ACL_KIND: kind,
    },
    timeout: 10000,
    windowsHide: true,
    maxBuffer: 1024,
  });
}

async function assertWindowsPrivateAcl(path, kind) {
  try {
    await runWindowsSecurityScript(WINDOWS_ACL_CHECK, path, kind);
  } catch {
    throw new Error('Agent Alpha credential storage ACL is not user-private');
  }
}

async function createWindowsPrivateEmptyFile(path) {
  try {
    await runWindowsSecurityScript(WINDOWS_CREATE_PRIVATE_FILE, path, 'file');
  } catch {
    throw new Error('Agent Alpha could not create private credential storage');
  }
}

async function assertPrivateStateParent(sessionFile) {
  if (process.platform === 'win32') {
    await assertWindowsPrivateAcl(dirname(sessionFile), 'directory');
  }
}

function sameFileIdentity(left, right) {
  return left && right && BigInt(left.dev) === BigInt(right.dev) &&
    BigInt(left.ino) !== 0n && BigInt(left.ino) === BigInt(right.ino);
}

async function pathIdentity(path) {
  return lstat(path, { bigint: true });
}

async function assertPrivateStateHandle(handle, path) {
  const opened = await handle.stat({ bigint: true });
  if (!opened.isFile()) throw new Error('Agent Alpha credential state must be a regular file');
  if (opened.nlink !== 1n) throw new Error('Agent Alpha credential state must have one physical link');
  if (process.platform === 'win32') {
    await assertWindowsPrivateAcl(path, 'file');
  } else {
    if (typeof process.geteuid !== 'function' || opened.uid !== BigInt(process.geteuid())) {
      throw new Error('Agent Alpha credential state is owned by another principal');
    }
    if ((opened.mode & 0o77n) !== 0n) {
      throw new Error('Agent Alpha credential state permissions are not owner-private');
    }
  }
  const named = await pathIdentity(path);
  const after = await handle.stat({ bigint: true });
  if (!sameFileIdentity(opened, named) || !sameFileIdentity(opened, after)) {
    throw new Error('Agent Alpha credential state identity changed during verification');
  }
  return opened;
}

async function assertStableStateParent(stateParent) {
  const opened = await stateParent.handle.stat({ bigint: true });
  if (!opened.isDirectory() || !sameFileIdentity(opened, stateParent.identity)) {
    throw new Error('Agent Alpha credential parent identity is invalid');
  }
  const namedBefore = await pathIdentity(stateParent.path);
  if (!namedBefore.isDirectory() || !sameFileIdentity(opened, namedBefore)) {
    throw new Error('Agent Alpha credential parent was replaced');
  }
  if (process.platform === 'win32') {
    await assertWindowsPrivateAcl(stateParent.path, 'directory');
  } else {
    if (typeof process.geteuid !== 'function' || opened.uid !== BigInt(process.geteuid())) {
      throw new Error('Agent Alpha credential parent is owned by another principal');
    }
    if ((opened.mode & 0o22n) !== 0n) {
      throw new Error('Agent Alpha credential parent is writable by another principal');
    }
  }
  const namedAfter = await pathIdentity(stateParent.path);
  if (!sameFileIdentity(opened, namedAfter)) {
    throw new Error('Agent Alpha credential parent changed during verification');
  }
}

async function openStateParent(sessionFile) {
  const path = dirname(sessionFile);
  const handle = await open(path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0));
  try {
    const identity = await handle.stat({ bigint: true });
    const stateParent = { path, handle, identity };
    await assertStableStateParent(stateParent);
    return stateParent;
  } catch (error) {
    await handle.close().catch(() => {});
    throw error;
  }
}

async function waitForCadence(timing, intervalMs) {
  const startedAt = timing.now();
  let previous = startedAt;
  for (;;) {
    const elapsed = timing.now() - startedAt;
    if (elapsed >= intervalMs) return;
    await timing.sleep(intervalMs - elapsed);
    const current = timing.now();
    if (current < previous) throw new Error('Agent Alpha monotonic clock moved backwards');
    if (current === previous) throw new Error('Agent Alpha cadence clock did not advance');
    previous = current;
  }
}

function productionTiming(advisorySleep) {
  return {
    now: () => performance.now(),
    sleep: async (ms) => {
      const startedAt = performance.now();
      if (advisorySleep) await advisorySleep(ms);
      const remaining = ms - (performance.now() - startedAt);
      if (remaining > 0) await defaultSleep(remaining);
    },
  };
}

function originOf(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Agent Alpha base URL must be an HTTP(S) origin');
  }
  return url.origin;
}

async function pathExists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function atomicJsonWrite(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`;
  let handle;
  let renamed = false;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(`${JSON.stringify(value)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, path);
    renamed = true;
    await syncDirectory(dirname(path));
  } catch (error) {
    await handle?.close().catch(() => {});
    if (!renamed) await unlink(temporary).catch((cleanupError) => {
      if (cleanupError?.code !== 'ENOENT') throw cleanupError;
    });
    throw error;
  }
}

async function syncDirectory(directory) {
  let handle;
  try {
    handle = await open(directory, 'r');
    await handle.sync();
  } catch (error) {
    // Windows does not expose directory fsync through Node on every filesystem. The temp file is
    // still flushed before rename there; POSIX hosts fail closed unless the directory entry syncs.
    const windowsUnsupported = process.platform === 'win32' &&
      ['EBADF', 'EINVAL', 'EISDIR', 'ENOTSUP', 'EPERM'].includes(error?.code);
    if (!windowsUnsupported) throw error;
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function currentIdentity(path) {
  try { return await pathIdentity(path); }
  catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function assertReportAuthority(reportStore) {
  await assertStableStateParent(reportStore.parent);
  const reportIdentity = await assertPrivateStateHandle(reportStore.handle, reportStore.path);
  if (!sameFileIdentity(reportIdentity, reportStore.identity)) {
    throw new Error('Agent Alpha report file identity changed');
  }
  const sessionIdentity = await currentIdentity(reportStore.stateStore.path);
  if (sameFileIdentity(reportIdentity, sessionIdentity)) {
    throw new Error('Agent Alpha report aliases credential state');
  }
  const lockIdentity = await currentIdentity(reportStore.lock.path);
  if (!sameFileIdentity(lockIdentity, reportStore.lock.identity)) {
    throw new Error('Agent Alpha lock identity changed before report append');
  }
  if (sameFileIdentity(reportIdentity, lockIdentity) ||
      sameFileIdentity(reportIdentity, reportStore.stateStore.activeTempIdentity)) {
    throw new Error('Agent Alpha report aliases protected runner state');
  }
}

async function openReportStore(path, stateStore, lock) {
  const parent = await openStateParent(path);
  const appendFlags = fsConstants.O_WRONLY | fsConstants.O_APPEND |
    (fsConstants.O_NONBLOCK || 0) | (fsConstants.O_NOFOLLOW || 0);
  let handle;
  try {
    try {
      handle = await open(path, appendFlags);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      if (process.platform === 'win32') {
        await createWindowsPrivateEmptyFile(path);
        handle = await open(path, appendFlags);
      } else {
        handle = await open(path,
          fsConstants.O_WRONLY | fsConstants.O_APPEND | fsConstants.O_CREAT |
            fsConstants.O_EXCL | (fsConstants.O_NONBLOCK || 0) |
            (fsConstants.O_NOFOLLOW || 0),
          0o600);
      }
    }
    const identity = await assertPrivateStateHandle(handle, path);
    const reportStore = { path, parent, handle, identity, stateStore, lock };
    await assertReportAuthority(reportStore);
    return reportStore;
  } catch (error) {
    await handle?.close().catch(() => {});
    await parent.handle.close().catch(() => {});
    throw new Error(`Agent Alpha report target is unsafe: ${error?.message || 'invalid target'}`);
  }
}

async function appendReport(reportStore, event) {
  await assertReportAuthority(reportStore);
  await reportStore.handle.writeFile(`${JSON.stringify(event)}\n`, 'utf8');
  await reportStore.handle.sync();
  await assertReportAuthority(reportStore);
}

async function requestJson(fetchImpl, base, path, { token, method = 'GET', body, idempotencyKey } = {}) {
  const headers = {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
  };
  const response = await fetchImpl(`${base}${path}`, {
    method,
    headers,
    redirect: 'manual',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (response.redirected || (response.status >= 300 && response.status < 400)) {
    throw new Error('Agent Alpha API redirects are forbidden by origin binding');
  }
  if (response.url && originOf(response.url) !== base) {
    throw new Error('Agent Alpha response escaped its bound origin');
  }
  let payload = null;
  try { payload = await response.json(); }
  catch { throw new Error(`Agent Alpha received non-JSON response (${response.status})`); }
  if (!response.ok) {
    const error = new Error(`Agent Alpha request failed (${response.status})`);
    error.status = response.status;
    error.code = typeof payload?.error === 'string' ? payload.error : 'http_error';
    error.payload = payload;
    throw error;
  }
  return payload;
}

function validName(name) {
  return typeof name === 'string' && name.trim() === name &&
    name.length >= 2 && name.length <= 24 && /^[\w .,'&-]+$/.test(name);
}

async function safeRemovePrivateTemp(stateStore, temporary, identity) {
  try {
    await assertStableStateParent(stateStore.parent);
    const named = await pathIdentity(temporary);
    if (sameFileIdentity(named, identity)) await unlink(temporary);
  } catch { /* a missing/replaced name is not authority to unlink anything else */ }
}

async function atomicPrivateJsonWrite(stateStore, value) {
  const { path, parent } = stateStore;
  await assertStableStateParent(parent);
  await stateStore.credentialBoundary?.('before_temp_create');
  const temporary = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`;
  let handle;
  let tempIdentity;
  let published = false;
  try {
    if (process.platform === 'win32') {
      // FileSecurity is supplied to CreateNew, so even a directory swap cannot expose a permissively
      // inherited empty file long enough for another principal to retain a readable handle.
      await createWindowsPrivateEmptyFile(temporary);
      handle = await open(temporary, fsConstants.O_RDWR | (fsConstants.O_NOFOLLOW || 0));
    } else {
      handle = await open(temporary,
        fsConstants.O_RDWR | fsConstants.O_CREAT | fsConstants.O_EXCL |
          (fsConstants.O_NOFOLLOW || 0),
        0o600);
    }
    tempIdentity = await assertPrivateStateHandle(handle, temporary);
    stateStore.activeTempIdentity = tempIdentity;
    await stateStore.credentialBoundary?.('after_temp_verified');
    await assertStableStateParent(parent);

    // Secret bytes go only through the handle whose identity, owner, links and ACL were verified.
    await handle.writeFile(`${JSON.stringify(value)}\n`, 'utf8');
    await handle.sync();
    await stateStore.credentialBoundary?.('after_secret_fsync');
    await assertPrivateStateHandle(handle, temporary);
    await assertStableStateParent(parent);
    await handle.close();
    handle = null;

    const named = await pathIdentity(temporary);
    if (!sameFileIdentity(named, tempIdentity)) {
      throw new Error('Agent Alpha credential temporary identity changed before publish');
    }
    await assertStableStateParent(parent);
    await rename(temporary, path);
    published = true;
    await stateStore.credentialBoundary?.('after_publish');
    await assertStableStateParent(parent);
    await syncDirectory(parent.path);
    await assertStableStateParent(parent);

    const finalHandle = await open(path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0));
    try {
      const finalIdentity = await assertPrivateStateHandle(finalHandle, path);
      if (!sameFileIdentity(finalIdentity, tempIdentity)) {
        throw new Error('Agent Alpha credential publish changed file identity');
      }
    } finally {
      await finalHandle.close();
    }
  } catch (error) {
    await handle?.close().catch(() => {});
    if (!published && tempIdentity) await safeRemovePrivateTemp(stateStore, temporary, tempIdentity);
    throw error;
  } finally {
    if (sameFileIdentity(stateStore.activeTempIdentity, tempIdentity)) {
      stateStore.activeTempIdentity = null;
    }
  }
}

async function writeIdentityState(stateStore, value) {
  await atomicPrivateJsonWrite(stateStore, value);
}

function validBootstrapSecret(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) return false;
  const bytes = Buffer.from(value, 'base64url');
  return bytes.length === 32 && bytes.toString('base64url') === value;
}

function validInviteCode(value) {
  return value === null || (typeof value === 'string' && value.length > 0 && value.length <= 128);
}

async function readSession(stateStore) {
  await assertStableStateParent(stateStore.parent);
  let handle;
  let session;
  try {
    handle = await open(stateStore.path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0));
    await assertPrivateStateHandle(handle, stateStore.path);
    session = JSON.parse(await handle.readFile('utf8'));
    await assertPrivateStateHandle(handle, stateStore.path);
    await assertStableStateParent(stateStore.parent);
  } catch {
    throw new Error('Agent Alpha session is corrupt or credential storage changed');
  } finally {
    await handle?.close().catch(() => {});
  }
  const exactKeys = (value, keys) => value &&
    Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
  const pendingValid = session?.pending === null || (
    session?.pending &&
    exactKeys(session.pending, ['operationId', 'turnId', 'actionId', 'startedAt']) &&
    typeof session.pending.operationId === 'string' && session.pending.operationId &&
    typeof session.pending.turnId === 'string' && session.pending.turnId &&
    typeof session.pending.actionId === 'string' && session.pending.actionId &&
    typeof session.pending.startedAt === 'string' && session.pending.startedAt
  );
  const bootstrapValid = session?.phase === 'bootstrap' &&
    exactKeys(session, [
      'version', 'base', 'phase', 'bootstrapSecret', 'inviteCode', 'characterName', 'pending',
    ]) && validBootstrapSecret(session.bootstrapSecret) && validInviteCode(session.inviteCode) &&
    session.pending === null;
  const bearerValid = [
    'guest_bootstrap_ack_pending', 'guest', 'initial_character_pending', 'agent',
  ].includes(session?.phase) &&
    exactKeys(session, ['version', 'base', 'phase', 'token', 'characterName', 'pending']) &&
    typeof session.token === 'string' && !!session.token && pendingValid;
  if (!session || session.version !== SESSION_VERSION || typeof session.base !== 'string' ||
      !validName(session.characterName) || (!bootstrapValid && !bearerValid)) {
    throw new Error('Agent Alpha session is corrupt or missing required identity state');
  }
  return session;
}

function physicalPathKey(path) {
  return process.platform === 'win32' ? path.toLowerCase() : path;
}

async function canonicalTarget(path, { rejectLink = false } = {}) {
  const lexical = resolve(path);
  await mkdir(dirname(lexical), { recursive: true });
  const physicalParent = await realpath(dirname(lexical));
  const candidate = join(physicalParent, basename(lexical));
  let info;
  try {
    info = await lstat(candidate);
  } catch (error) {
    if (error?.code === 'ENOENT') return candidate;
    throw error;
  }
  if (info.nlink > 1) {
    throw new Error('Agent Alpha target has ambiguous hard-link identity');
  }
  if (info.isSymbolicLink()) {
    if (rejectLink) throw new Error('Agent Alpha lock target cannot be a link');
    const physical = await realpath(candidate);
    if ((await stat(physical)).nlink > 1) {
      throw new Error('Agent Alpha target has ambiguous hard-link identity');
    }
    return physical;
  }
  return realpath(candidate);
}

async function canonicalRunnerPaths(sessionFile, reportFile) {
  if (!reportFile) throw new Error('Agent Alpha requires a report file');
  const session = await canonicalTarget(sessionFile);
  const report = await canonicalTarget(reportFile, { rejectLink: true });
  const lock = await canonicalTarget(`${session}.lock`, { rejectLink: true });
  const keys = [session, report, lock].map(physicalPathKey);
  if (new Set(keys).size !== keys.length) {
    throw new Error('Agent Alpha session, report, and lock targets must be physically distinct');
  }
  if (keys[1].startsWith(`${keys[0]}.`) && keys[1].endsWith('.tmp')) {
    throw new Error('Agent Alpha report target aliases the credential temporary namespace');
  }
  await assertPrivateStateParent(session);
  const stateParent = await openStateParent(session);
  return {
    sessionFile: session,
    reportFile: report,
    lockFile: lock,
    stateStore: { path: session, parent: stateParent },
  };
}

function lockEndpoint(sessionFile) {
  const digest = crypto.createHash('sha256').update(physicalPathKey(sessionFile)).digest('hex');
  if (process.platform === 'win32') return `\\\\.\\pipe\\omerta-agent-alpha-${digest}`;
  if (process.platform === 'linux') return `\0omerta-agent-alpha-${digest}`;
  // A filesystem Unix socket can remain after SIGKILL, so unsupported hosts fail closed instead
  // of falling back to a lease that either strands the session or permits concurrent owners.
  throw new Error('Agent Alpha cannot provide a crash-releasing session lock on this platform');
}

async function listenForLock(server, endpoint) {
  await new Promise((resolveListen, rejectListen) => {
    const onError = (error) => {
      server.off('listening', onListening);
      rejectListen(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolveListen();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen({ path: endpoint, exclusive: true });
  });
}

async function closeLockServer(server) {
  if (!server.listening) return;
  await new Promise((resolveClose, rejectClose) => server.close((error) =>
    error ? rejectClose(error) : resolveClose()));
}

async function acquireLock(sessionFile, path, stateStore) {
  await mkdir(dirname(sessionFile), { recursive: true });
  const endpoint = lockEndpoint(sessionFile);
  const server = createServer((socket) => socket.destroy());
  server.unref();
  try {
    await listenForLock(server, endpoint);
  } catch (error) {
    if (error?.code === 'EADDRINUSE') {
      throw new Error('Agent Alpha session is locked by another live runner');
    }
    throw error;
  }

  try {
    const nonce = crypto.randomUUID();
    // The kernel-owned loopback lease is released on hard process death. Once it is acquired, any
    // leftover metadata is necessarily orphaned and can be replaced without PID-reuse/delete races.
    await atomicJsonWrite(path, {
      version: 1,
      sessionHash: crypto.createHash('sha256').update(physicalPathKey(sessionFile)).digest('hex'),
      lease: 'os-owned-session-endpoint',
      pid: process.pid,
      nonce,
    });
    await assertStableStateParent(stateStore.parent);
    await stateStore.lockBoundary?.('after_metadata_publish', { path });
    const identity = await pathIdentity(path);
    if (!identity.isFile() || identity.nlink !== 1n) {
      throw new Error('Agent Alpha lock metadata is not a single regular file');
    }
    return { path, nonce, server, identity, stateStore };
  } catch (error) {
    await closeLockServer(server).catch(() => {});
    throw error;
  }
}

async function releaseLock(lock) {
  let handle;
  try {
    await assertStableStateParent(lock.stateStore.parent);
    handle = await open(lock.path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0));
    const opened = await handle.stat({ bigint: true });
    const named = await pathIdentity(lock.path);
    if (!opened.isFile() || opened.nlink !== 1n || !sameFileIdentity(opened, lock.identity) ||
        !sameFileIdentity(opened, named)) {
      throw new Error('Agent Alpha lock identity changed before release');
    }
    const current = JSON.parse(await handle.readFile('utf8'));
    await handle.close();
    handle = null;
    if (current?.nonce === lock.nonce) {
      await assertStableStateParent(lock.stateStore.parent);
      if (!sameFileIdentity(await pathIdentity(lock.path), lock.identity)) {
        throw new Error('Agent Alpha lock identity changed before unlink');
      }
      await unlink(lock.path);
      await syncDirectory(dirname(lock.path));
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  } finally {
    await handle?.close().catch(() => {});
    await closeLockServer(lock.server);
  }
}

async function recoverGuestBootstrap({ base, stateStore, session, fetchImpl }) {
  const guest = await requestJson(fetchImpl, base, '/v1/auth/guest', {
    method: 'POST',
    body: {
      bootstrapSecret: session.bootstrapSecret,
      ...(session.inviteCode === null ? {} : { inviteCode: session.inviteCode }),
    },
  });
  if (typeof guest?.token !== 'string' || !guest.token) {
    throw new Error('Guest creation returned no token');
  }
  const bearerSession = {
    version: SESSION_VERSION,
    base,
    phase: 'guest_bootstrap_ack_pending',
    token: guest.token,
    characterName: session.characterName,
    pending: null,
  };
  await writeIdentityState(stateStore, bearerSession);
  return bearerSession;
}

async function acknowledgeGuestBootstrap({ base, stateStore, session, fetchImpl }) {
  await requestJson(fetchImpl, base, '/v1/auth/guest/bootstrap/ack', {
    method: 'POST', token: session.token,
  });
  const acknowledged = { ...session, phase: 'guest' };
  await writeIdentityState(stateStore, acknowledged);
  return acknowledged;
}

async function createIdentity({ base, stateStore, name, inviteCode, fetchImpl }) {
  if (!validName(name)) throw new Error('Explicit creation requires a valid 2-24 character name');
  const storedInvite = inviteCode ?? null;
  if (!validInviteCode(storedInvite)) {
    throw new Error('Agent Alpha invite code must be a non-empty string of at most 128 characters');
  }
  let session = {
    version: SESSION_VERSION,
    base,
    phase: 'bootstrap',
    bootstrapSecret: crypto.randomBytes(32).toString('base64url'),
    inviteCode: storedInvite,
    characterName: name,
    pending: null,
  };
  await writeIdentityState(stateStore, session);
  session = await recoverGuestBootstrap({ base, stateStore, session, fetchImpl });
  session = await acknowledgeGuestBootstrap({ base, stateStore, session, fetchImpl });

  const agent = await requestJson(fetchImpl, base, '/v1/auth/agent-key', {
    method: 'POST', token: session.token,
    idempotencyKey: operationKey(`agent-key\0${base}\0${session.token}`),
  });
  if (typeof agent?.token !== 'string' || !agent.token) {
    throw new Error('Agent-key creation returned no token');
  }
  session = { ...session, phase: 'initial_character_pending', token: agent.token };
  await writeIdentityState(stateStore, session);

  await requestJson(fetchImpl, base, '/v1/character', {
    method: 'POST', token: session.token, body: { name },
    idempotencyKey: operationKey(`character\0${base}\0${session.token}\0${name}`),
  });
  return session;
}

async function ensureIdentity({ base, fetchImpl, stateStore, session, requestedName }) {
  if (session.phase === 'bootstrap') {
    session = await recoverGuestBootstrap({ base, fetchImpl, stateStore, session });
  }
  if (session.phase === 'guest_bootstrap_ack_pending') {
    session = await acknowledgeGuestBootstrap({ base, fetchImpl, stateStore, session });
  }
  let probe = await requestJson(fetchImpl, base, '/v1/session', { token: session.token });
  if (!probe?.authed) throw new Error('Agent Alpha could not verify its bound session');

  if (session.phase === 'guest') {
    if (probe.hasCharacter) {
      throw new Error('Agent Alpha guest phase conflicts with an existing character');
    }
    const agent = await requestJson(fetchImpl, base, '/v1/auth/agent-key', {
      method: 'POST',
      token: session.token,
      idempotencyKey: operationKey(`agent-key\0${base}\0${session.token}`),
    });
    if (typeof agent?.token !== 'string' || !agent.token) {
      throw new Error('Agent-key creation returned no token');
    }
    session = { ...session, phase: 'initial_character_pending', token: agent.token };
    await writeIdentityState(stateStore, session);
    probe = { ...probe, agent: true, hasCharacter: false, character: null };
  }

  if (!probe.agent) throw new Error('Agent Alpha session is not flagged as an agent');
  if (session.phase === 'initial_character_pending') {
    if (probe.hasCharacter) {
      if (probe.character?.name !== session.characterName) {
        throw new Error('Initial character does not match its pending bound name');
      }
      session = { ...session, phase: 'agent' };
      await writeIdentityState(stateStore, session);
      return session;
    }
    if (requestedName !== undefined) {
      if (!validName(requestedName)) {
        throw new Error('Initial character name must use letters, numbers, and simple punctuation');
      }
      if (requestedName !== session.characterName) {
        session = { ...session, characterName: requestedName };
        await writeIdentityState(stateStore, session);
      }
    }
    await requestJson(fetchImpl, base, '/v1/character', {
      method: 'POST',
      token: session.token,
      idempotencyKey: operationKey(
        `character\0${base}\0${session.token}\0${session.characterName}`),
      body: { name: session.characterName },
    });
    const confirmed = await requestJson(fetchImpl, base, '/v1/session', { token: session.token });
    if (!confirmed?.authed || !confirmed.agent || !confirmed.hasCharacter ||
        confirmed.character?.name !== session.characterName) {
      throw new Error('Initial character could not be confirmed under its bound name');
    }
    session = { ...session, phase: 'agent' };
    await writeIdentityState(stateStore, session);
    return session;
  }

  if (!probe.hasCharacter) {
    throw new Error('Final agent has no living character; replacement is forbidden');
  }
  if (probe.character?.name !== session.characterName) {
    throw new Error('Agent Alpha session character does not match its bound identity');
  }
  return session;
}

function policyIsConservative(policy) {
  return policy && Object.entries(POLICY).every(([key, value]) => policy[key] === value);
}

function recommendationOf(turn) {
  if (!turn?.recommendedActionId) return { action: null, errorCode: null };
  const action = Array.isArray(turn.actions)
    ? turn.actions.find((candidate) => candidate?.id === turn.recommendedActionId)
    : null;
  if (!action || action.executable !== true || !ALLOWED_KINDS.has(action.kind)) {
    return { action: null, candidate: action, errorCode: 'unsafe_action' };
  }
  if (!policyIsConservative(turn.policy)) {
    return { action: null, candidate: action, errorCode: 'policy_mismatch' };
  }
  return { action, errorCode: null };
}

function operationKey(operationId) {
  return crypto.createHash('sha256').update(operationId).digest('hex');
}

async function settlePending({ base, fetchImpl, reportStore, stateStore, session, actionKind }) {
  const pending = session.pending;
  let result;
  try {
    result = await requestJson(fetchImpl, base, '/v1/agent/act', {
      method: 'POST',
      token: session.token,
      idempotencyKey: operationKey(pending.operationId),
      body: { turnId: pending.turnId, actionId: pending.actionId },
    });
  } catch (error) {
    if (error?.status !== 409 || error?.code !== 'stale_turn') throw error;
    session = { ...session, pending: null };
    await writeIdentityState(stateStore, session);
    await appendReport(reportStore, {
      timestamp: new Date().toISOString(),
      status: 'stale',
      errorCode: 'stale_turn',
      actionId: pending.actionId,
      ...(actionKind ? { actionKind } : {}),
    });
    return { session, status: 'stale', turn: error.payload?.turn || null };
  }

  session = { ...session, pending: null };
  await writeIdentityState(stateStore, session);
  await appendReport(reportStore, {
    timestamp: new Date().toISOString(),
    status: 'executed',
    actionId: pending.actionId,
    ...(actionKind ? { actionKind } : {}),
  });
  return { session, status: 'executed', turn: result?.turn || null };
}

async function runUnlocked(options, timing) {
  const base = originOf(options.baseUrl);
  const sessionFile = options.sessionFile;
  const reportStore = options.reportStore;
  const stateStore = options.stateStore;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const maxActions = options.maxActions ?? 1;
  const intervalMs = options.intervalMs ?? MIN_INTERVAL_MS;
  if (!Number.isInteger(maxActions) || maxActions < 1 || maxActions > 50) {
    throw new Error('Agent Alpha maxActions must be an integer from 1 to 50');
  }
  if (!Number.isFinite(intervalMs) || intervalMs < MIN_INTERVAL_MS) {
    throw new Error(`Agent Alpha production cadence must be at least ${MIN_INTERVAL_MS}ms`);
  }

  let session;
  if (await pathExists(sessionFile)) {
    session = await readSession(stateStore);
  } else {
    if (options.create !== true) {
      throw new Error('Agent Alpha session is missing; explicit --create is required');
    }
    session = await createIdentity({
      base, stateStore, name: options.name, inviteCode: options.inviteCode, fetchImpl,
    });
  }

  if (session.base !== base) throw new Error('Agent Alpha session belongs to a different origin');
  session = await ensureIdentity({
    base, fetchImpl, stateStore, session, requestedName: options.name,
  });

  let actions = 0;
  let attempts = 0;
  let currentTurn = null;
  if (session.pending) {
    await waitForCadence(timing, intervalMs);
    attempts += 1;
    const settled = await settlePending({
      base, fetchImpl, reportStore, stateStore, session,
    });
    session = settled.session;
    currentTurn = settled.turn;
    if (settled.status === 'executed') actions += 1;
    if (settled.status === 'stale' && attempts >= maxActions) {
      await appendReport(reportStore, {
        timestamp: new Date().toISOString(),
        status: 'attempt_limit',
        errorCode: 'max_attempts',
      });
      return { status: 'attempt_limit', actions };
    }
  }
  while (attempts < maxActions) {
    const turn = currentTurn || await requestJson(fetchImpl, base, '/v1/agent/turn', { token: session.token });
    currentTurn = null;
    const recommendation = recommendationOf(turn);
    const action = recommendation.action;
    if (!action) {
      if (recommendation.errorCode) {
        await appendReport(reportStore, {
          timestamp: new Date().toISOString(),
          status: 'refused',
          errorCode: recommendation.errorCode,
          ...(typeof recommendation.candidate?.kind === 'string'
            ? { actionKind: recommendation.candidate.kind } : {}),
          ...(typeof recommendation.candidate?.id === 'string'
            ? { actionId: recommendation.candidate.id } : {}),
        });
        return { status: 'refused', actions };
      }
      break;
    }
    await waitForCadence(timing, intervalMs);

    const operationId = crypto.randomUUID();
    session = {
      ...session,
      pending: {
        operationId,
        turnId: turn.turnId,
        actionId: action.id,
        startedAt: new Date().toISOString(),
      },
    };
    await writeIdentityState(stateStore, session);
    attempts += 1;
    const settled = await settlePending({
      base, fetchImpl, reportStore, stateStore, session, actionKind: action.kind,
    });
    session = settled.session;
    currentTurn = settled.turn;
    if (settled.status === 'executed') actions += 1;
    if (settled.status === 'stale' && attempts >= maxActions) {
      await appendReport(reportStore, {
        timestamp: new Date().toISOString(),
        status: 'attempt_limit',
        errorCode: 'max_attempts',
      });
      return { status: 'attempt_limit', actions };
    }
  }

  return { status: 'complete', actions };
}

async function runWithTiming(options, timing) {
  if (!options.sessionFile) throw new Error('Agent Alpha requires a session file');
  const paths = await canonicalRunnerPaths(options.sessionFile, options.reportFile);
  paths.stateStore.credentialBoundary = timing.credentialBoundary;
  paths.stateStore.lockBoundary = timing.lockBoundary;
  let lock;
  let reportStore;
  try {
    lock = await acquireLock(paths.sessionFile, paths.lockFile, paths.stateStore);
    reportStore = await openReportStore(paths.reportFile, paths.stateStore, lock);
    return await runUnlocked({ ...options, ...paths, reportStore }, timing);
  } finally {
    await reportStore?.handle.close().catch(() => {});
    await reportStore?.parent.handle.close().catch(() => {});
    try {
      if (lock) await releaseLock(lock);
    } finally {
      await paths.stateStore.parent.handle.close().catch(() => {});
    }
  }
}

export async function runAgentAlpha(options = {}) {
  return runWithTiming(options, productionTiming(options.sleep));
}

// This conspicuously named constructor is the only fast-clock seam. Production callers using
// runAgentAlpha always receive the monotonic elapsed-time backstop above, even with an advisory
// sleeper. Tests must opt into a clock whose sleep advances time rather than merely returning.
export function createAgentAlphaTestRunner({ now, sleep, credentialBoundary, lockBoundary }) {
  if (typeof now !== 'function' || typeof sleep !== 'function') {
    throw new Error('Agent Alpha test timing requires now and sleep functions');
  }
  if (credentialBoundary !== undefined && typeof credentialBoundary !== 'function') {
    throw new Error('Agent Alpha credential boundary test seam must be a function');
  }
  if (lockBoundary !== undefined && typeof lockBoundary !== 'function') {
    throw new Error('Agent Alpha lock boundary test seam must be a function');
  }
  return (options = {}) => runWithTiming(options, {
    now, sleep, credentialBoundary, lockBoundary,
  });
}

function cliOptions(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--create') options.create = true;
    else if (arg === '--name') options.name = argv[++index];
    else if (arg === '--max-actions') options.maxActions = Number(argv[++index]);
    else if (arg === '--session') options.sessionFile = argv[++index];
    else if (arg === '--report') options.reportFile = argv[++index];
    else throw new Error('Unknown Agent Alpha option');
  }
  return options;
}

async function main() {
  const options = cliOptions(process.argv.slice(2));
  options.baseUrl = process.env.OMERTA_BASE_URL || 'https://www.omerta.fun';
  options.sessionFile ||= process.env.OMERTA_ALPHA_SESSION;
  options.reportFile ||= process.env.OMERTA_ALPHA_REPORT;
  if (!options.sessionFile || !options.reportFile) {
    throw new Error('Agent Alpha requires --session and --report');
  }
  const summary = await runAgentAlpha(options);
  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    process.stderr.write('agent_alpha_error\n');
    process.exitCode = 1;
  });
}
