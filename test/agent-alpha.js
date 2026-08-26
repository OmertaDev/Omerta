// Finite Agent Alpha runner regressions. These tests use a real local Fastify listener and
// temporary on-disk sessions so lifecycle and recovery assertions exercise actual HTTP and I/O.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import {
  chmod, chown, link, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import Fastify from 'fastify';

import { buildServer } from '../src/server.js';
import {
  createAgentAlphaTestRunner,
  runAgentAlpha as runAgentAlphaProduction,
} from '../tools/agent-alpha.js';

let testNow = 0;
const runAgentAlpha = createAgentAlphaTestRunner({
  now: () => testNow,
  sleep: async (ms) => { testNow += ms; },
});

const POLICY = {
  cashReserve: 1000,
  minArbitrageProfit: 25,
  allowPvP: false,
  allowBorrowing: false,
};

const execFileAsync = promisify(execFile);

async function runWindowsAclScript(script, target) {
  await execFileAsync('powershell.exe', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script,
  ], {
    env: { ...process.env, OMERTA_ALPHA_TEST_ACL_TARGET: target },
    timeout: 10000,
    windowsHide: true,
  });
}

async function secureWindowsDirectory(directory) {
  if (process.platform !== 'win32') return;
  await runWindowsAclScript(`
    $ErrorActionPreference = 'Stop'
    $target = $env:OMERTA_ALPHA_TEST_ACL_TARGET
    $user = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    $system = New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')
    $admins = New-Object System.Security.Principal.SecurityIdentifier('S-1-5-32-544')
    $acl = New-Object System.Security.AccessControl.DirectorySecurity
    $acl.SetOwner($user)
    $acl.SetAccessRuleProtection($true, $false)
    $inherit = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
      [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
    foreach ($sid in @($user, $system, $admins)) {
      $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $sid,
        [System.Security.AccessControl.FileSystemRights]::FullControl,
        $inherit,
        [System.Security.AccessControl.PropagationFlags]::None,
        [System.Security.AccessControl.AccessControlType]::Allow
      )
      [void]$acl.AddAccessRule($rule)
    }
    $directory = New-Object System.IO.DirectoryInfo($target)
    $directory.SetAccessControl($acl)
  `, directory);
}

async function grantWindowsRead(file) {
  await runWindowsAclScript(`
    $ErrorActionPreference = 'Stop'
    $target = $env:OMERTA_ALPHA_TEST_ACL_TARGET
    $file = New-Object System.IO.FileInfo($target)
    $acl = $file.GetAccessControl()
    $everyone = New-Object System.Security.Principal.SecurityIdentifier('S-1-1-0')
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
      $everyone,
      [System.Security.AccessControl.FileSystemRights]::Read,
      [System.Security.AccessControl.AccessControlType]::Allow
    )
    [void]$acl.AddAccessRule($rule)
    $file.SetAccessControl($acl)
  `, file);
}

async function grantWindowsDirectoryRead(directory) {
  await runWindowsAclScript(`
    $ErrorActionPreference = 'Stop'
    $target = $env:OMERTA_ALPHA_TEST_ACL_TARGET
    $item = New-Object System.IO.DirectoryInfo($target)
    $acl = $item.GetAccessControl()
    $everyone = New-Object System.Security.Principal.SecurityIdentifier('S-1-1-0')
    $inherit = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
      [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
      $everyone,
      [System.Security.AccessControl.FileSystemRights]::ReadAndExecute,
      $inherit,
      [System.Security.AccessControl.PropagationFlags]::None,
      [System.Security.AccessControl.AccessControlType]::Allow
    )
    [void]$acl.AddAccessRule($rule)
    $item.SetAccessControl($acl)
  `, directory);
}

async function grantWindowsDirectoryFullControl(directory) {
  if (process.platform !== 'win32') return;
  await runWindowsAclScript(`
    $ErrorActionPreference = 'Stop'
    $target = $env:OMERTA_ALPHA_TEST_ACL_TARGET
    $item = New-Object System.IO.DirectoryInfo($target)
    $acl = $item.GetAccessControl()
    $everyone = New-Object System.Security.Principal.SecurityIdentifier('S-1-1-0')
    $inherit = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
      [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
      $everyone,
      [System.Security.AccessControl.FileSystemRights]::FullControl,
      $inherit,
      [System.Security.AccessControl.PropagationFlags]::None,
      [System.Security.AccessControl.AccessControlType]::Allow
    )
    [void]$acl.AddAccessRule($rule)
    $item.SetAccessControl($acl)
  `, directory);
}

async function privateTempDir(prefix) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  await secureWindowsDirectory(directory);
  return directory;
}

async function writePrivateSession(file, contents) {
  await writeFile(file, contents, { encoding: 'utf8', mode: 0o600 });
  if (process.platform !== 'win32') await chmod(file, 0o600);
}

async function guestBootstrapServerRecoveryTest() {
  const priorInviteMode = process.env.INVITE_MODE;
  process.env.INVITE_MODE = 'on';
  const app = await buildServer();
  const inviteCode = `bootstrap-${crypto.randomUUID()}`;
  const bootstrapSecret = crypto.randomBytes(32).toString('base64url');
  try {
    await app.pool.query(
      'INSERT INTO invite_codes (code, uses_left) VALUES ($1, 1)',
      [inviteCode],
    );

    const replies = await Promise.all(Array.from({ length: 5 }, () => app.inject({
      method: 'POST',
      url: '/v1/auth/guest',
      payload: { bootstrapSecret, inviteCode },
    })));
    assert.equal(replies.every((reply) => reply.statusCode === 200 ||
      (reply.statusCode === 400 && reply.json().error === 'bootstrap_contention')), true,
    'a concurrent retry either recovers the account or fails closed while its creator commits');
    const successful = replies.filter((reply) => reply.statusCode === 200);
    assert.equal(successful.length >= 1, true,
      'one concurrent bootstrap request completes the account transaction');

    const subjects = new Set(successful.map((reply) => app.jwt.verify(reply.json().token).sub));
    assert.equal(subjects.size, 1,
      'concurrent bootstrap retries receive credentials for exactly one account');
    assert.equal(Number((await app.pool.query(
      "SELECT COUNT(*) n FROM accounts WHERE auth_provider='guest'",
    )).rows[0].n), 1, 'one bootstrap secret creates exactly one guest account');
    assert.equal(Number((await app.pool.query(
      'SELECT uses_left FROM invite_codes WHERE code=$1', [inviteCode],
    )).rows[0].uses_left), 0, 'the closed-alpha invite is consumed exactly once');

    const replay = await app.inject({
      method: 'POST',
      url: '/v1/auth/guest',
      payload: { bootstrapSecret },
    });
    assert.equal(replay.statusCode, 200,
      'the recovery credential reissues authentication after the invite has been consumed');
    assert.equal(app.jwt.verify(replay.json().token).sub === [...subjects][0], true,
      'post-commit recovery reissues a token for the original account');

    const stored = (await app.pool.query(
      'SELECT auth_subject, guest_bootstrap_hash FROM accounts',
    )).rows[0];
    assert.equal(Object.values(stored).includes(bootstrapSecret), false,
      'the server never stores the raw bootstrap recovery secret');

    const unrelated = await app.inject({
      method: 'POST',
      url: '/v1/auth/guest',
      payload: { bootstrapSecret: crypto.randomBytes(32).toString('base64url') },
    });
    assert.equal(unrelated.statusCode, 400,
      'a different bootstrap identity cannot bypass a consumed closed-alpha invite');
    assert.equal(unrelated.json().error, 'invite',
      'closed-invite refusal keeps the existing stable error code');
    assert.equal(Number((await app.pool.query(
      "SELECT COUNT(*) n FROM accounts WHERE auth_provider='guest'",
    )).rows[0].n), 1, 'a refused bootstrap attempt leaves the single-account invariant intact');
  } finally {
    if (priorInviteMode === undefined) delete process.env.INVITE_MODE;
    else process.env.INVITE_MODE = priorInviteMode;
    await app.close();
    await app.pool.end?.();
  }
}

async function initialGuestCrashRecoveryTest() {
  const priorInviteMode = process.env.INVITE_MODE;
  process.env.INVITE_MODE = 'on';
  const app = await buildServer();
  const dir = await privateTempDir('omerta-agent-alpha-bootstrap-crash-');
  const sessionFile = join(dir, 'session.json');
  const reportFile = join(dir, 'report.jsonl');
  const inviteCode = `bootstrap-crash-${crypto.randomUUID()}`;
  let child;
  try {
    await app.pool.query(
      'INSERT INTO invite_codes (code, uses_left) VALUES ($1, 1)',
      [inviteCode],
    );
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const runnerUrl = pathToFileURL(
      fileURLToPath(new URL('../tools/agent-alpha.js', import.meta.url)),
    ).href;
    const childCode = `
      import { createAgentAlphaTestRunner } from ${JSON.stringify(runnerUrl)};
      let now = 0;
      const runAgentAlpha = createAgentAlphaTestRunner({
        now: () => now,
        sleep: async (ms) => { now += ms; },
      });
      const heldFetch = async (...args) => {
        const response = await fetch(...args);
        if (new URL(args[0]).pathname === '/v1/auth/guest') {
          process.send?.({ type: 'guest_committed' });
          await new Promise(() => {});
        }
        return response;
      };
      await runAgentAlpha({
        baseUrl: process.env.TEST_BASE,
        sessionFile: process.env.TEST_SESSION,
        reportFile: process.env.TEST_REPORT,
        create: true,
        name: 'Bootstrap Alpha',
        inviteCode: process.env.TEST_INVITE,
        maxActions: 1,
        intervalMs: 3100,
        fetchImpl: heldFetch,
      });
    `;
    let responseHeld;
    const heldResponse = new Promise((resolveHeld) => { responseHeld = resolveHeld; });
    child = spawn(process.execPath, ['--input-type=module', '--eval', childCode], {
      env: {
        ...process.env,
        TEST_BASE: baseUrl,
        TEST_SESSION: sessionFile,
        TEST_REPORT: reportFile,
        TEST_INVITE: inviteCode,
      },
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });
    let childError = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { childError += chunk; });
    child.on('message', (message) => {
      if (message?.type === 'guest_committed') responseHeld();
    });

    await waitFor(heldResponse, 'committed guest response');
    let bootstrapState = null;
    try { bootstrapState = JSON.parse(await readFile(sessionFile, 'utf8')); } catch { /* asserted below */ }
    assert.equal(bootstrapState?.phase, 'bootstrap',
      'the recovery identity is durable before the first guest request can return');
    assert.equal(typeof bootstrapState?.bootstrapSecret === 'string' &&
      bootstrapState.bootstrapSecret.length === 43, true,
    'the durable bootstrap identity is a high-entropy 256-bit base64url credential');
    assert.equal(Object.prototype.hasOwnProperty.call(bootstrapState || {}, 'token'), false,
      'the pre-response bootstrap state cannot pretend a bearer was received');
    assert.equal(Number((await app.pool.query(
      "SELECT COUNT(*) n FROM accounts WHERE auth_provider='guest'",
    )).rows[0].n), 1, 'the server committed exactly one guest before the client hard crash');
    assert.equal(Number((await app.pool.query(
      'SELECT uses_left FROM invite_codes WHERE code=$1', [inviteCode],
    )).rows[0].uses_left), 0, 'the guest commit consumed the closed-alpha invite once');

    child.kill();
    await waitFor(new Promise((resolveExit) => child.once('exit', resolveExit)),
      'bootstrap child hard exit');
    assert.notEqual(child.exitCode, 0,
      'the first runner dies before its normal response/session persistence path');

    const summary = await runAgentAlpha({
      baseUrl,
      sessionFile,
      reportFile,
      maxActions: 1,
      intervalMs: 3100,
      fetchImpl: async (url, options) => {
        if (new URL(url).pathname === '/v1/agent/turn') {
          return new Response(JSON.stringify({
            turnId: 'bootstrap-idle', recommendedActionId: null, policy: POLICY, actions: [],
          }), { status: 200, headers: { 'content-type': 'application/json' } });
        }
        return fetch(url, options);
      },
    });
    assert.deepEqual(summary, { status: 'complete', actions: 0 },
      'restart recovers the committed identity and reaches a bounded idle turn');
    const recovered = JSON.parse(await readFile(sessionFile, 'utf8'));
    assert.equal(recovered.phase, 'agent', 'recovery completes the original agent identity');
    assert.equal(typeof recovered.token === 'string' && recovered.token.length > 0, true,
      'recovery stores the reissued agent token only after receiving it');
    assert.equal(Object.prototype.hasOwnProperty.call(recovered, 'bootstrapSecret'), false,
      'the recovery credential is erased once the bearer session is durable');
    assert.equal(Object.prototype.hasOwnProperty.call(recovered, 'inviteCode'), false,
      'the consumed invite is erased with the completed bootstrap phase');
    const account = (await app.pool.query(
      "SELECT id FROM accounts WHERE auth_provider='guest'",
    )).rows[0];
    assert.equal(app.jwt.verify(recovered.token).sub === account.id, true,
      'the recovered bearer authenticates the one pre-crash account');
    assert.equal(Number((await app.pool.query(
      "SELECT COUNT(*) n FROM accounts WHERE auth_provider='guest'",
    )).rows[0].n), 1, 'restart and reissuance leave the guest-account count exactly one');
    assert.equal(childError.includes(inviteCode), false,
      'the crashed child never prints the bootstrap invite');
    assert.equal(childError.includes(bootstrapState.bootstrapSecret), false,
      'the crashed child never prints the bootstrap recovery secret');
  } finally {
    if (child && child.exitCode == null && child.signalCode == null) {
      child.kill();
      await new Promise((resolveExit) => child.once('exit', resolveExit));
    }
    if (priorInviteMode === undefined) delete process.env.INVITE_MODE;
    else process.env.INVITE_MODE = priorInviteMode;
    await app.close();
    await app.pool.end?.();
    await rm(dir, { recursive: true, force: true });
  }
}

async function credentialStorageConfidentialityTest() {
  if (process.platform === 'win32') {
    {
      const api = await probeApi();
      const dir = await privateTempDir('omerta-agent-alpha-file-acl-');
      const sessionFile = join(dir, 'session.json');
      const reportFile = join(dir, 'report.jsonl');
      try {
        await writePrivateSession(sessionFile, JSON.stringify(sessionFor(api.baseUrl)));
        await grantWindowsRead(sessionFile);
        await assert.rejects(
          runAgentAlpha({ baseUrl: api.baseUrl, sessionFile, reportFile, maxActions: 1 }),
          /ACL|private|credential|session/i,
          'a Windows session file readable by another principal fails closed',
        );
        assert.equal(api.state.sessionCalls, 0,
          'an exposed Windows file is rejected before its bearer can reach the network');
      } finally {
        await api.close();
        await rm(dir, { recursive: true, force: true });
      }
    }

    {
      const api = await probeApi();
      const dir = await mkdtemp(join(tmpdir(), 'omerta-agent-alpha-parent-acl-'));
      const sessionFile = join(dir, 'session.json');
      const reportFile = join(dir, 'report.jsonl');
      try {
        await grantWindowsDirectoryRead(dir);
        await writePrivateSession(sessionFile, JSON.stringify(sessionFor(api.baseUrl)));
        await assert.rejects(
          runAgentAlpha({ baseUrl: api.baseUrl, sessionFile, reportFile, maxActions: 1 }),
          /ACL|private|credential|session/i,
          'a Windows session under an inheritance-exposed parent fails closed',
        );
        assert.equal(api.state.sessionCalls, 0,
          'an insecure Windows parent is rejected before the credential is read or used');
      } finally {
        await api.close();
        await rm(dir, { recursive: true, force: true });
      }
    }
    return;
  }

  {
    const api = await probeApi();
    const dir = await privateTempDir('omerta-agent-alpha-mode-');
    const sessionFile = join(dir, 'session.json');
    const reportFile = join(dir, 'report.jsonl');
    try {
      await writeFile(sessionFile, JSON.stringify(sessionFor(api.baseUrl)), { mode: 0o644 });
      await chmod(sessionFile, 0o644);
      await assert.rejects(
        runAgentAlpha({ baseUrl: api.baseUrl, sessionFile, reportFile, maxActions: 1 }),
        /permission|private|mode|session/i,
        'a POSIX 0644 bearer session fails closed',
      );
      assert.equal(api.state.sessionCalls, 0,
        'a permissive POSIX session is rejected before network use');
    } finally {
      await api.close();
      await rm(dir, { recursive: true, force: true });
    }
  }

  if (typeof process.geteuid === 'function' && process.geteuid() === 0) {
    const api = await probeApi();
    const dir = await privateTempDir('omerta-agent-alpha-owner-');
    const sessionFile = join(dir, 'session.json');
    const reportFile = join(dir, 'report.jsonl');
    try {
      await writeFile(sessionFile, JSON.stringify(sessionFor(api.baseUrl)), { mode: 0o600 });
      await chown(sessionFile, 65534, 65534);
      await assert.rejects(
        runAgentAlpha({ baseUrl: api.baseUrl, sessionFile, reportFile, maxActions: 1 }),
        /owner|private|session/i,
        'a POSIX session owned by a different principal fails closed',
      );
      assert.equal(api.state.sessionCalls, 0,
        'a wrong-owner POSIX session is rejected before network use');
    } finally {
      await api.close();
      await rm(dir, { recursive: true, force: true });
    }
  }
}

async function credentialParentReplacementTest() {
  const root = await privateTempDir('omerta-agent-alpha-parent-swap-');
  const stateDir = join(root, 'state');
  const reportDir = join(root, 'reports');
  const displacedDir = join(root, 'state-before-swap');
  await mkdir(stateDir);
  await mkdir(reportDir);
  await secureWindowsDirectory(stateDir);
  await secureWindowsDirectory(reportDir);
  if (process.platform !== 'win32') {
    await chmod(stateDir, 0o700);
    await chmod(reportDir, 0o700);
  }
  const sessionFile = join(stateDir, 'session.json');
  const reportFile = join(reportDir, 'report.jsonl');
  const api = await phaseRecoveryApi({ initialPhase: 'guest' });
  try {
    await writePrivateSession(sessionFile, JSON.stringify(sessionFor(api.baseUrl, {
      phase: 'guest', token: 'guest-token-secret',
    })));
    let swapped = false;
    const swappingFetch = async (url, options) => {
      const response = await fetch(url, options);
      if (!swapped && new URL(url).pathname === '/v1/session') {
        await rename(stateDir, displacedDir);
        await mkdir(stateDir);
        if (process.platform === 'win32') await grantWindowsDirectoryFullControl(stateDir);
        else await chmod(stateDir, 0o777);
        swapped = true;
      }
      return response;
    };
    let replacementError = null;
    try {
      await runAgentAlpha({
        baseUrl: api.baseUrl,
        sessionFile,
        reportFile,
        maxActions: 1,
        intervalMs: 3100,
        fetchImpl: swappingFetch,
      });
    } catch (error) { replacementError = error; }
    assert.match(replacementError?.message || '', /parent|replaced|storage|private|identity/i,
      'a state directory replaced after authorization fails closed at the next credential write',
    );
    assert.equal(swapped, true,
      `the deterministic network boundary replaced the approved directory (${replacementError?.message})`);
    let replacementPayload = '';
    for (const name of await readdir(stateDir)) {
      try { replacementPayload += await readFile(join(stateDir, name), 'utf8'); } catch { /* directory */ }
    }
    assert.equal(replacementPayload.includes('agent-token-secret'), false,
      'the new credential is never written into the untrusted replacement before rejection');
  } finally {
    await api.close();
    await rm(root, { recursive: true, force: true });
  }
}

async function credentialWriteBoundaryReplacementTest() {
  const boundaries = [
    'before_temp_create',
    'after_temp_verified',
    'after_secret_fsync',
    'after_publish',
  ];
  const outcomes = {};
  for (const boundary of boundaries) {
    const root = await privateTempDir(`omerta-agent-alpha-${boundary}-`);
    const stateDir = join(root, 'state');
    const reportDir = join(root, 'reports');
    const displacedDir = join(root, 'state-before-swap');
    await mkdir(stateDir);
    await mkdir(reportDir);
    await secureWindowsDirectory(stateDir);
    await secureWindowsDirectory(reportDir);
    if (process.platform !== 'win32') {
      await chmod(stateDir, 0o700);
      await chmod(reportDir, 0o700);
    }
    const sessionFile = join(stateDir, 'session.json');
    const reportFile = join(reportDir, 'report.jsonl');
    const api = await phaseRecoveryApi({ initialPhase: 'guest' });
    try {
      await writePrivateSession(sessionFile, JSON.stringify(sessionFor(api.baseUrl, {
        phase: 'guest', token: 'guest-token-secret',
      })));
      let swapped = false;
      let swapAttempted = false;
      const boundaryRunner = createAgentAlphaTestRunner({
        now: () => testNow,
        sleep: async (ms) => { testNow += ms; },
        credentialBoundary: async (reached) => {
          if (swapped || reached !== boundary) return;
          swapAttempted = true;
          await rename(stateDir, displacedDir);
          await mkdir(stateDir);
          if (process.platform === 'win32') await grantWindowsDirectoryFullControl(stateDir);
          else await chmod(stateDir, 0o777);
          swapped = true;
        },
      });
      let error = null;
      try {
        await boundaryRunner({
          baseUrl: api.baseUrl,
          sessionFile,
          reportFile,
          maxActions: 1,
          intervalMs: 3100,
        });
      } catch (caught) { error = caught; }
      let replacementPayload = '';
      for (const name of await readdir(stateDir)) {
        try { replacementPayload += await readFile(join(stateDir, name), 'utf8'); }
        catch { /* directory or an attacker-controlled non-file */ }
      }
      outcomes[boundary] = {
        swapAttempted,
        swapped,
        rejected: /parent|replaced|storage|private|identity|EPERM|EBUSY|access denied/i
          .test(error?.message || ''),
        replacementHasSecret: replacementPayload.includes('agent-token-secret'),
      };
    } finally {
      await api.close();
      await rm(root, { recursive: true, force: true });
    }
  }
  assert.deepEqual(outcomes, Object.fromEntries(boundaries.map((boundary) => {
    const windowsOpenHandleBoundary = process.platform === 'win32' &&
      ['after_temp_verified', 'after_secret_fsync'].includes(boundary);
    return [boundary, {
      swapAttempted: true,
      swapped: !windowsOpenHandleBoundary,
      rejected: true,
      replacementHasSecret: false,
    }];
  })), 'every credential-write boundary rejects a parent swap without exposing the new bearer');
}

async function localApi() {
  const app = Fastify({ logger: false });
  const requests = [];
  const state = {
    guestCalls: 0,
    bootstrapAckCalls: 0,
    agentKeyCalls: 0,
    characterCalls: 0,
    actCalls: 0,
    hasCharacter: false,
    agent: false,
    characterName: null,
  };

  app.addHook('onRequest', async (req) => {
    requests.push({
      method: req.method,
      path: req.url,
      authorization: req.headers.authorization,
      idempotencyKey: req.headers['idempotency-key'],
    });
  });
  app.post('/v1/auth/guest', async () => {
    state.guestCalls += 1;
    return { token: 'guest-token-secret' };
  });
  app.get('/v1/session', async (req, reply) => {
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    if (!['guest-token-secret', 'agent-token-secret'].includes(token)) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    return {
      authed: true,
      hasCharacter: state.hasCharacter,
      agent: state.agent,
      character: state.hasCharacter
        ? { id: 'character-id-secret', name: state.characterName, generation: 1 }
        : null,
      wallet: 'wallet-secret',
    };
  });
  app.post('/v1/auth/guest/bootstrap/ack', async (req) => {
    assert.equal(req.headers.authorization, 'Bearer guest-token-secret');
    state.bootstrapAckCalls += 1;
    return { ok: true };
  });
  app.post('/v1/auth/agent-key', async (req) => {
    assert.equal(req.headers.authorization, 'Bearer guest-token-secret');
    state.agentKeyCalls += 1;
    state.agent = true;
    return { token: 'agent-token-secret', agent: true };
  });
  app.post('/v1/character', async (req) => {
    assert.equal(req.headers.authorization, 'Bearer agent-token-secret');
    state.characterCalls += 1;
    state.characterName = req.body.name;
    state.hasCharacter = true;
    return { ok: true, id: 'character-id-secret' };
  });
  app.get('/v1/agent/turn', async () => ({
    turnId: `turn-secret-${state.actCalls + 1}`,
    recommendedActionId: `crime-secret-${state.actCalls + 1}`,
    policy: POLICY,
    actions: [{
      id: `crime-secret-${state.actCalls + 1}`,
      kind: 'crime',
      method: 'POST',
      path: '/v1/crimes/pick',
      body: { authoredPrompt: 'never report this body' },
      executable: true,
    }],
    blocked: [{ code: 'nerve', actionId: 'blocked-secret' }],
    exploration: { id: 'explore_crime', progress: { visited: 1, total: 40 } },
    state: {
      identity: { id: 'character-id-secret', name: state.characterName },
      resources: { cash: 1200, nerve: 9, energy: 8, heat: 1 },
    },
  }));
  app.post('/v1/agent/act', async (req) => {
    assert.equal(req.headers.authorization, 'Bearer agent-token-secret');
    state.actCalls += 1;
    return {
      actionId: req.body.actionId,
      result: { ok: true, accountId: 'account-id-secret' },
      turn: null,
      refreshRequired: true,
    };
  });

  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    state,
    close: () => app.close(),
  };
}

async function lifecycleTest() {
  const dir = await privateTempDir('omerta-agent-alpha-');
  const sessionFile = join(dir, 'session.json');
  const reportFile = join(dir, 'report.jsonl');
  const api = await localApi();
  try {
    await assert.rejects(
      runAgentAlpha({
        baseUrl: api.baseUrl,
        sessionFile,
        reportFile,
        maxActions: 1,
        intervalMs: 3100,
        sleep: async () => {},
      }),
      /explicit.*create|session.*missing/i,
      'a missing identity requires the explicit creation flag',
    );
    assert.equal(api.state.guestCalls, 0,
      'a resume attempt never creates a replacement guest identity');

    const first = await runAgentAlpha({
      baseUrl: api.baseUrl,
      sessionFile,
      reportFile,
      create: true,
      name: 'Alpha Machine',
      maxActions: 2,
      intervalMs: 3100,
      sleep: async () => {},
    });
    assert.equal(first.actions, 2,
      'the finite runner stops after the caller action budget');
    assert.deepEqual({
      guestCalls: api.state.guestCalls,
      bootstrapAckCalls: api.state.bootstrapAckCalls,
      agentKeyCalls: api.state.agentKeyCalls,
      characterCalls: api.state.characterCalls,
      actCalls: api.state.actCalls,
    }, {
      guestCalls: 1,
      bootstrapAckCalls: 1,
      agentKeyCalls: 1,
      characterCalls: 1,
      actCalls: 2,
    }, 'explicit creation produces one flagged account, one character, and no extra actions');

    const session = JSON.parse(await readFile(sessionFile, 'utf8'));
    assert.deepEqual(session, {
      version: 1,
      base: api.baseUrl,
      phase: 'agent',
      token: 'agent-token-secret',
      characterName: 'Alpha Machine',
      pending: null,
    }, 'the durable session retains only the origin-bound agent identity and cleared operation state');

    const second = await runAgentAlpha({
      baseUrl: api.baseUrl,
      sessionFile,
      reportFile,
      maxActions: 1,
      intervalMs: 3100,
      sleep: async () => {},
    });
    assert.equal(second.actions, 1, 'a resumed run receives its own finite action budget');
    assert.equal(api.state.guestCalls, 1,
      'a second run resumes the original identity without guest creation');
    assert.equal(api.state.bootstrapAckCalls, 1,
      'a second run does not acknowledge an already-retired bootstrap proof again');
    assert.equal(api.state.agentKeyCalls, 1,
      'a second run does not issue another agent key');
    assert.equal(api.state.characterCalls, 1,
      'a second run does not create another character');

    const lines = (await readFile(reportFile, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.ok(lines.length >= 3, 'each attempted action leaves a machine-readable JSONL record');
    const report = JSON.stringify(lines);
    for (const forbidden of [
      'guest-token-secret', 'agent-token-secret', 'Bearer', 'wallet-secret',
      'account-id-secret', 'character-id-secret', 'never report this body', 'Alpha Machine',
    ]) {
      assert.equal(report.includes(forbidden), false,
        `reports exclude forbidden identity/authored value: ${forbidden}`);
    }
  } finally {
    await api.close();
    await rm(dir, { recursive: true, force: true });
  }
}

async function probeApi({ sessionStatus = 200 } = {}) {
  const app = Fastify({ logger: false });
  const state = { guestCalls: 0, sessionCalls: 0, turnCalls: 0, actCalls: 0 };
  app.post('/v1/auth/guest', async () => {
    state.guestCalls += 1;
    return { token: 'replacement-token' };
  });
  app.get('/v1/session', async (_req, reply) => {
    state.sessionCalls += 1;
    if (sessionStatus !== 200) {
      return reply.code(sessionStatus).send({
        error: sessionStatus === 401 ? 'unauthorized' : 'temporarily_unavailable',
      });
    }
    return {
      authed: true,
      hasCharacter: true,
      agent: true,
      character: { id: 'character-id-secret', name: 'Alpha Machine', generation: 1 },
    };
  });
  app.get('/v1/agent/turn', async () => {
    state.turnCalls += 1;
    return { turnId: 'idle-turn', recommendedActionId: null, policy: POLICY, actions: [] };
  });
  app.post('/v1/agent/act', async () => {
    state.actCalls += 1;
    return { turn: null };
  });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    state,
    close: () => app.close(),
  };
}

function sessionFor(base, overrides = {}) {
  return {
    version: 1,
    base,
    phase: 'agent',
    token: 'agent-token-secret',
    characterName: 'Alpha Machine',
    pending: null,
    ...overrides,
  };
}

async function failClosedSessionTest() {
  const cases = [
    {
      name: 'corrupt JSON',
      prepare: async (file) => writePrivateSession(file, '{broken-json'),
      expected: /corrupt|session/i,
      sessionStatus: 200,
      expectedProbeCalls: 0,
    },
    {
      name: 'wrong origin',
      prepare: async (file) => writePrivateSession(file,
        JSON.stringify(sessionFor('https://wrong.example'))),
      expected: /origin/i,
      sessionStatus: 200,
      expectedProbeCalls: 0,
    },
    {
      name: 'missing token',
      prepare: async (file, base) => writePrivateSession(file,
        JSON.stringify(sessionFor(base, { token: undefined }))),
      expected: /token|session/i,
      sessionStatus: 200,
      expectedProbeCalls: 0,
    },
    {
      name: 'unexpected wallet field in session',
      prepare: async (file, base) => writePrivateSession(file,
        JSON.stringify(sessionFor(base, { wallet: 'wallet-secret' }))),
      expected: /corrupt|session/i,
      sessionStatus: 200,
      expectedProbeCalls: 0,
    },
    {
      name: 'action body smuggled into pending journal',
      prepare: async (file, base) => writePrivateSession(file, JSON.stringify(sessionFor(base, {
        pending: {
          operationId: 'operation-1',
          turnId: 'turn-1',
          actionId: 'action-1',
          startedAt: '2026-08-25T00:00:00.000Z',
          body: { prompt: 'authored-secret' },
        },
      }))),
      expected: /corrupt|session/i,
      sessionStatus: 200,
      expectedProbeCalls: 0,
    },
    {
      name: 'expired token',
      prepare: async (file, base) => writePrivateSession(file, JSON.stringify(sessionFor(base))),
      expected: /401|unauthorized|expired/i,
      sessionStatus: 401,
      expectedProbeCalls: 1,
    },
    {
      name: 'transient probe failure',
      prepare: async (file, base) => writePrivateSession(file, JSON.stringify(sessionFor(base))),
      expected: /503|unavailable|verify/i,
      sessionStatus: 503,
      expectedProbeCalls: 1,
    },
  ];

  for (const testCase of cases) {
    const dir = await privateTempDir('omerta-agent-alpha-session-');
    const sessionFile = join(dir, 'session.json');
    const reportFile = join(dir, 'report.jsonl');
    const api = await probeApi({ sessionStatus: testCase.sessionStatus });
    try {
      await testCase.prepare(sessionFile, api.baseUrl);
      await assert.rejects(
        runAgentAlpha({
          baseUrl: api.baseUrl,
          sessionFile,
          reportFile,
          create: true,
          name: 'Replacement Machine',
          maxActions: 1,
          intervalMs: 3100,
          sleep: async () => {},
        }),
        testCase.expected,
        `${testCase.name} fails closed instead of replacing the bound identity`,
      );
      assert.equal(api.state.guestCalls, 0,
        `${testCase.name} never creates a replacement guest`);
      assert.equal(api.state.sessionCalls, testCase.expectedProbeCalls,
        `${testCase.name} performs only the safe verification work expected`);
      assert.equal(api.state.turnCalls, 0,
        `${testCase.name} never reaches the autonomous loop`);
      assert.equal(api.state.actCalls, 0,
        `${testCase.name} never mutates game state`);
    } finally {
      await api.close();
      await rm(dir, { recursive: true, force: true });
    }
  }
}

async function orphanedLockMetadataTest() {
  const dir = await privateTempDir('omerta-agent-alpha-lock-');
  const sessionFile = join(dir, 'session.json');
  const reportFile = join(dir, 'report.jsonl');
  const api = await probeApi();
  try {
    await writePrivateSession(sessionFile, JSON.stringify(sessionFor(api.baseUrl)));
    await writeFile(`${sessionFile}.lock`, JSON.stringify({ pid: process.pid }), 'utf8');
    const summary = await runAgentAlpha({
      baseUrl: api.baseUrl,
      sessionFile,
      reportFile,
      maxActions: 1,
      intervalMs: 3100,
      sleep: async () => {},
    });
    assert.deepEqual(summary, { status: 'complete', actions: 0 },
      'orphaned file metadata is reclaimed when no OS owner is alive');
    assert.equal(api.state.sessionCalls, 1,
      'dead-owner reclamation proceeds with the original session identity');
    await assert.rejects(readFile(`${sessionFile}.lock`, 'utf8'), { code: 'ENOENT' },
      'the reclaimed owner removes its own lock metadata on clean exit');
  } finally {
    await api.close();
    await rm(dir, { recursive: true, force: true });
  }
}

const ALLOWED_KINDS = [
  'onboard_claim', 'daily_claim', 'career_claim',
  'business_collect', 'territory_collect', 'kitchen_collect', 'convoy_collect',
  'convoy_travel', 'market_fill', 'arbitrage_buy', 'arbitrage_sell',
  'arbitrage_travel', 'loan_repay', 'crew_recruiting', 'crime',
];

async function actionApi({ kinds = ['crime'], policy = POLICY } = {}) {
  const app = Fastify({ logger: false });
  const state = { turnCalls: 0, actCalls: 0, actKeys: [], actBodies: [] };
  app.get('/v1/session', async () => ({
    authed: true,
    hasCharacter: true,
    agent: true,
    character: { id: 'character-id-secret', name: 'Alpha Machine', generation: 1 },
  }));
  app.get('/v1/agent/turn', async () => {
    const index = state.actCalls;
    state.turnCalls += 1;
    if (index >= kinds.length) {
      return { turnId: `turn-${index}`, recommendedActionId: null, policy, actions: [] };
    }
    const kind = kinds[index];
    return {
      turnId: `turn-${index}`,
      recommendedActionId: `action-${index}`,
      policy,
      actions: [{
        id: `action-${index}`,
        kind,
        method: 'DELETE',
        path: '/v1/forbidden-direct-mutation',
        body: { prompt: 'never trust or report action bodies' },
        executable: true,
      }],
    };
  });
  app.post('/v1/agent/act', async (req) => {
    state.actKeys.push(req.headers['idempotency-key']);
    state.actBodies.push(req.body);
    state.actCalls += 1;
    return { actionId: req.body.actionId, result: { ok: true }, turn: null };
  });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    state,
    close: () => app.close(),
  };
}

async function withReadySession(api, prefix, callback) {
  const dir = await privateTempDir(prefix);
  const sessionFile = join(dir, 'session.json');
  const reportFile = join(dir, 'report.jsonl');
  await writePrivateSession(sessionFile, JSON.stringify(sessionFor(api.baseUrl)));
  try {
    return await callback({ sessionFile, reportFile });
  } finally {
    await api.close();
    await rm(dir, { recursive: true, force: true });
  }
}

async function exactAllowlistTest() {
  const api = await actionApi({ kinds: ALLOWED_KINDS });
  await withReadySession(api, 'omerta-agent-alpha-allowlist-', async ({ sessionFile, reportFile }) => {
    const delays = [];
    let now = 0;
    const runWithRecordedTime = createAgentAlphaTestRunner({
      now: () => now,
      sleep: async (ms) => { delays.push(ms); now += ms; },
    });
    const summary = await runWithRecordedTime({
      baseUrl: api.baseUrl,
      sessionFile,
      reportFile,
      maxActions: ALLOWED_KINDS.length,
    });
    assert.equal(summary.actions, ALLOWED_KINDS.length,
      'every and only the exact design allowlist can execute through Agent Turn');
    assert.equal(api.state.actCalls, ALLOWED_KINDS.length,
      'each allowlisted recommendation is sent to the authoritative /v1/agent/act seam');
    assert.deepEqual(api.state.actBodies,
      ALLOWED_KINDS.map((_, index) => ({ turnId: `turn-${index}`, actionId: `action-${index}` })),
      'the runner sends only server-issued turn/action identifiers, never descriptor method/path/body');
    assert.deepEqual(delays, Array(ALLOWED_KINDS.length).fill(3100),
      'every real mutation attempt observes the conservative 3100ms cadence, including process starts');
  });
}

async function safetyRefusalTest() {
  const cases = [
    {
      name: 'non-allowlisted PvP recommendation',
      kinds: ['pvp_attack'],
      policy: POLICY,
      errorCode: 'unsafe_action',
    },
    {
      name: 'allowPvP policy mismatch',
      kinds: ['crime'],
      policy: { ...POLICY, allowPvP: true },
      errorCode: 'policy_mismatch',
    },
    {
      name: 'allowBorrowing policy mismatch',
      kinds: ['crime'],
      policy: { ...POLICY, allowBorrowing: true },
      errorCode: 'policy_mismatch',
    },
    {
      name: 'cash reserve policy mismatch',
      kinds: ['crime'],
      policy: { ...POLICY, cashReserve: 999 },
      errorCode: 'policy_mismatch',
    },
  ];

  for (const testCase of cases) {
    const api = await actionApi(testCase);
    await withReadySession(api, 'omerta-agent-alpha-refusal-', async ({ sessionFile, reportFile }) => {
      const summary = await runAgentAlpha({
        baseUrl: api.baseUrl,
        sessionFile,
        reportFile,
        maxActions: 1,
        intervalMs: 3100,
        sleep: async () => {},
      });
      assert.equal(summary.actions, 0, `${testCase.name} exits without a mutation`);
      assert.equal(api.state.actCalls, 0, `${testCase.name} never reaches /v1/agent/act`);
      const records = (await readFile(reportFile, 'utf8')).trim().split('\n').map(JSON.parse);
      assert.equal(records.at(-1).status, 'refused', `${testCase.name} is recorded as a refusal`);
      assert.equal(records.at(-1).errorCode, testCase.errorCode,
        `${testCase.name} has a stable, non-sensitive refusal code`);
    });
  }
}

async function boundsTest() {
  for (const maxActions of [0, 51, 1.5, Number.NaN]) {
    const api = await actionApi();
    await withReadySession(api, 'omerta-agent-alpha-bounds-', async ({ sessionFile, reportFile }) => {
      await assert.rejects(
        runAgentAlpha({
          baseUrl: api.baseUrl,
          sessionFile,
          reportFile,
          maxActions,
          intervalMs: 3100,
          sleep: async () => {},
        }),
        /maxActions|1.*50|action budget/i,
        `the finite budget rejects ${String(maxActions)}`,
      );
      assert.equal(api.state.turnCalls, 0,
        'invalid action budgets fail before any autonomous observation');
    });
  }

  const api = await actionApi();
  await withReadySession(api, 'omerta-agent-alpha-cadence-', async ({ sessionFile, reportFile }) => {
    await assert.rejects(
      runAgentAlpha({
        baseUrl: api.baseUrl,
        sessionFile,
        reportFile,
        maxActions: 1,
        intervalMs: 3000,
      }),
      /3100|interval|cadence/i,
      'a real runner cannot lower the successful-mutation cadence below 3100ms',
    );
    assert.equal(api.state.turnCalls, 0,
      'an unsafe production cadence fails before an autonomous observation');
  });

  const injectedApi = await actionApi();
  await withReadySession(injectedApi, 'omerta-agent-alpha-injected-cadence-',
    async ({ sessionFile, reportFile }) => {
      await assert.rejects(
        runAgentAlpha({
          baseUrl: injectedApi.baseUrl,
          sessionFile,
          reportFile,
          maxActions: 1,
          intervalMs: 0,
          sleep: async () => {},
        }),
        /3100|interval|cadence/i,
        'an injected sleeper cannot lower the public seam cadence below 3100ms',
      );
      assert.equal(injectedApi.state.turnCalls, 0,
        'custom-sleeper cadence bypass fails before any autonomous observation');
    });
}

async function recoveryApi({ staleFirst = false, staleResponses = staleFirst ? 1 : 0 } = {}) {
  const app = Fastify({ logger: false });
  const state = { turnCalls: 0, actCalls: 0, actKeys: [], actBodies: [] };
  const turn = (index) => ({
    turnId: `recovery-turn-${index}`,
    recommendedActionId: `recovery-action-${index}`,
    policy: POLICY,
    actions: [{
      id: `recovery-action-${index}`,
      kind: index === 0 ? 'crime' : 'daily_claim',
      method: 'POST',
      path: '/ignored',
      body: { accountId: 'account-id-secret', prompt: 'authored-secret' },
      executable: true,
    }],
  });
  app.get('/v1/session', async () => ({
    authed: true,
    hasCharacter: true,
    agent: true,
    character: { id: 'character-id-secret', name: 'Alpha Machine', generation: 1 },
    wallet: 'wallet-secret',
  }));
  app.get('/v1/agent/turn', async () => {
    state.turnCalls += 1;
    return turn(0);
  });
  app.post('/v1/agent/act', async (req, reply) => {
    state.actCalls += 1;
    state.actKeys.push(req.headers['idempotency-key']);
    state.actBodies.push(req.body);
    if (state.actCalls <= staleResponses) {
      return reply.code(409).send({
        error: 'stale_turn',
        message: 'replacement available',
        turn: turn(state.actCalls),
      });
    }
    if (staleResponses === 0 && state.actCalls === 1) {
      reply.hijack();
      reply.raw.destroy();
      return;
    }
    return {
      actionId: req.body.actionId,
      result: { ok: true, characterId: 'character-id-secret' },
      turn: { turnId: 'idle', recommendedActionId: null, policy: POLICY, actions: [] },
    };
  });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    state,
    close: () => app.close(),
  };
}

async function ambiguousMutationRecoveryTest() {
  const api = await recoveryApi();
  await withReadySession(api, 'omerta-agent-alpha-ambiguous-', async ({ sessionFile, reportFile }) => {
    await assert.rejects(
      runAgentAlpha({
        baseUrl: api.baseUrl,
        sessionFile,
        reportFile,
        maxActions: 1,
        intervalMs: 3100,
        sleep: async () => {},
      }),
      /fetch|socket|other side|terminated/i,
      'an ambiguous connection loss is surfaced rather than guessed successful or failed',
    );
    const journaled = JSON.parse(await readFile(sessionFile, 'utf8'));
    assert.deepEqual(Object.keys(journaled.pending).sort(),
      ['actionId', 'operationId', 'startedAt', 'turnId'].sort(),
      'the durable pre-mutation journal contains only the logical operation replay fields');
    assert.equal(journaled.pending.turnId, 'recovery-turn-0',
      'the turn identifier is durable before the ambiguous POST');
    assert.equal(journaled.pending.actionId, 'recovery-action-0',
      'the action identifier is durable before the ambiguous POST');

    const resumed = await runAgentAlpha({
      baseUrl: api.baseUrl,
      sessionFile,
      reportFile,
      maxActions: 1,
      intervalMs: 3100,
      sleep: async () => {},
    });
    assert.equal(resumed.actions, 1,
      'a resumed ambiguous operation consumes one finite action after idempotent confirmation');
    assert.equal(api.state.turnCalls, 1,
      'restart retries the journaled operation before fetching or inventing a new turn');
    assert.equal(api.state.actCalls, 2,
      'the ambiguous logical operation is attempted exactly once per finite invocation');
    assert.equal(api.state.actKeys[0], api.state.actKeys[1],
      'an ambiguous retry reuses the exact same idempotency key');
    assert.deepEqual(api.state.actBodies[0], api.state.actBodies[1],
      'an ambiguous retry reuses the exact journaled turn/action pair');
    assert.equal(JSON.parse(await readFile(sessionFile, 'utf8')).pending, null,
      'the journal clears only after the retry receives an authoritative response');
    const report = await readFile(reportFile, 'utf8');
    for (const forbidden of [
      'agent-token-secret', 'wallet-secret', 'account-id-secret',
      'character-id-secret', 'authored-secret', 'authorization',
    ]) {
      assert.equal(report.includes(forbidden), false,
        `ambiguous recovery telemetry excludes ${forbidden}`);
    }
  });
}

async function staleAttemptBoundTest() {
  const api = await recoveryApi({ staleResponses: 3 });
  await withReadySession(api, 'omerta-agent-alpha-stale-bound-',
    async ({ sessionFile, reportFile }) => {
      const summary = await runAgentAlpha({
        baseUrl: api.baseUrl,
        sessionFile,
        reportFile,
        maxActions: 1,
        intervalMs: 3100,
        sleep: async () => {},
      });
      assert.deepEqual(summary, { status: 'attempt_limit', actions: 0 },
        'a stale chain stops with a finite redacted summary when its POST budget is exhausted');
      assert.equal(api.state.actCalls, 1,
        'maxActions bounds total /v1/agent/act attempts, not only successful mutations');
      assert.equal(JSON.parse(await readFile(sessionFile, 'utf8')).pending, null,
        'the authoritative stale rejection clears the exhausted non-mutation journal');
      const records = (await readFile(reportFile, 'utf8')).trim().split('\n').map(JSON.parse);
      assert.deepEqual(records.map(({ status, errorCode }) => ({ status, errorCode })), [
        { status: 'stale', errorCode: 'stale_turn' },
        { status: 'attempt_limit', errorCode: 'max_attempts' },
      ], 'stale exhaustion records only redacted stable statuses and codes');
    });
}

async function staleReplacementTest() {
  const api = await recoveryApi({ staleFirst: true });
  await withReadySession(api, 'omerta-agent-alpha-stale-', async ({ sessionFile, reportFile }) => {
    const summary = await runAgentAlpha({
      baseUrl: api.baseUrl,
      sessionFile,
      reportFile,
      maxActions: 2,
      intervalMs: 3100,
      sleep: async () => {},
    });
    assert.equal(summary.actions, 1,
      'a stale non-mutation does not consume the finite successful-action budget');
    assert.equal(api.state.turnCalls, 1,
      'the runner consumes the server-provided stale replacement without an extra turn read');
    assert.equal(api.state.actCalls, 2,
      'the replacement recommendation executes once after the stale refusal');
    assert.notEqual(api.state.actKeys[0], api.state.actKeys[1],
      'a replacement recommendation is a new logical operation with a fresh key');
    assert.deepEqual(api.state.actBodies, [
      { turnId: 'recovery-turn-0', actionId: 'recovery-action-0' },
      { turnId: 'recovery-turn-1', actionId: 'recovery-action-1' },
    ], 'the stale response cannot replay a sibling from the invalidated turn');
    const records = (await readFile(reportFile, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(records.map((record) => record.status), ['stale', 'executed'],
      'redacted telemetry distinguishes a stale non-mutation from the eventual success');
  });
}

async function phaseRecoveryApi({ initialPhase }) {
  const app = Fastify({ logger: false });
  const state = {
    agent: !['guest', 'guest_bootstrap_ack_pending'].includes(initialPhase),
    hasCharacter: false,
    bootstrapAckCalls: 0,
    agentKeyCalls: 0,
    characterCalls: 0,
  };
  app.get('/v1/session', async (req, reply) => {
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    if (!['guest-token-secret', 'agent-token-secret'].includes(token)) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
    return {
      authed: true,
      agent: state.agent,
      hasCharacter: state.hasCharacter,
      character: state.hasCharacter
        ? { id: 'character-id-secret', name: 'Alpha Machine', generation: 1 }
        : null,
    };
  });
  app.post('/v1/auth/guest/bootstrap/ack', async (req) => {
    assert.equal(req.headers.authorization, 'Bearer guest-token-secret');
    state.bootstrapAckCalls += 1;
    return { ok: true };
  });
  app.post('/v1/auth/agent-key', async (req) => {
    assert.equal(req.headers.authorization, 'Bearer guest-token-secret');
    state.agentKeyCalls += 1;
    state.agent = true;
    return { token: 'agent-token-secret', agent: true };
  });
  app.post('/v1/character', async (req) => {
    assert.equal(req.headers.authorization, 'Bearer agent-token-secret');
    assert.equal(req.body.name, 'Alpha Machine');
    state.characterCalls += 1;
    state.hasCharacter = true;
    return { ok: true, id: 'character-id-secret' };
  });
  app.get('/v1/agent/turn', async () => ({
    turnId: 'idle', recommendedActionId: null, policy: POLICY, actions: [],
  }));
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    state,
    close: () => app.close(),
  };
}

async function bootstrapAcknowledgementCrashWindowTest() {
  const api = await phaseRecoveryApi({ initialPhase: 'guest_bootstrap_ack_pending' });
  await withReadySession(api, 'omerta-agent-alpha-bootstrap-ack-',
    async ({ sessionFile, reportFile }) => {
      await writePrivateSession(sessionFile, JSON.stringify(sessionFor(api.baseUrl, {
        phase: 'guest_bootstrap_ack_pending',
        token: 'guest-token-secret',
      })));
      let dropAckResponse = true;
      const responseLossFetch = async (url, options) => {
        const response = await fetch(url, options);
        if (dropAckResponse && new URL(url).pathname === '/v1/auth/guest/bootstrap/ack') {
          dropAckResponse = false;
          throw new Error('simulated bootstrap acknowledgement response loss');
        }
        return response;
      };
      await assert.rejects(
        runAgentAlpha({
          baseUrl: api.baseUrl,
          sessionFile,
          reportFile,
          maxActions: 1,
          intervalMs: 3100,
          fetchImpl: responseLossFetch,
        }),
        /bootstrap acknowledgement response loss/i,
        'a lost ACK response leaves the durable acknowledgement-pending phase for retry',
      );
      assert.equal(api.state.bootstrapAckCalls, 1,
        'the server committed the first acknowledgement whose response was lost');
      assert.equal(JSON.parse(await readFile(sessionFile, 'utf8')).phase,
        'guest_bootstrap_ack_pending',
      'the client cannot advance to agent-key until ACK success is durably observed');

      const summary = await runAgentAlpha({
        baseUrl: api.baseUrl,
        sessionFile,
        reportFile,
        maxActions: 1,
        intervalMs: 3100,
      });
      assert.deepEqual(summary, { status: 'complete', actions: 0 },
        'restart retries the idempotent ACK before finishing the original identity');
      assert.equal(api.state.bootstrapAckCalls, 2,
        'restart replays the same account-scoped acknowledgement exactly once');
      assert.equal(api.state.agentKeyCalls, 1,
        'agent progression begins only after the acknowledgement retry succeeds');
      assert.equal(api.state.characterCalls, 1,
        'the one bound character is created after bootstrap retirement');
      assert.equal(JSON.parse(await readFile(sessionFile, 'utf8')).phase, 'agent',
        'the completed restart leaves no pending bootstrap lifecycle state');
    });
}

async function finalAgentWithoutCharacterTest() {
  const api = await phaseRecoveryApi({ initialPhase: 'agent' });
  await withReadySession(api, 'omerta-agent-alpha-dead-', async ({ sessionFile, reportFile }) => {
    await assert.rejects(
      runAgentAlpha({
        baseUrl: api.baseUrl,
        sessionFile,
        reportFile,
        name: 'Unapproved Heir',
        maxActions: 1,
        intervalMs: 3100,
        sleep: async () => {},
      }),
      /no living character|replacement|final agent/i,
      'a completed agent with no living character fails closed after death',
    );
    assert.equal(api.state.characterCalls, 0,
      'ordinary resume never creates an heir or replacement character');
    assert.equal(JSON.parse(await readFile(sessionFile, 'utf8')).phase, 'agent',
      'the final phase remains final when the living character is absent');
  });
}

async function initialNameApi() {
  const app = Fastify({ logger: false });
  const state = { guestCalls: 0, characterCalls: 0, names: [], hasCharacter: false };
  app.post('/v1/auth/guest', async () => {
    state.guestCalls += 1;
    return { token: 'guest-token-secret' };
  });
  app.get('/v1/session', async () => ({
    authed: true,
    agent: true,
    hasCharacter: state.hasCharacter,
    character: state.hasCharacter
      ? { id: 'character-id-secret', name: state.names.at(-1), generation: 1 }
      : null,
  }));
  app.post('/v1/character', async (req, reply) => {
    state.characterCalls += 1;
    state.names.push(req.body.name);
    if (req.body.name === 'Taken Name') {
      return reply.code(400).send({ error: 'name_taken', message: 'server-authored-secret' });
    }
    state.hasCharacter = true;
    return { ok: true, id: 'character-id-secret' };
  });
  app.get('/v1/agent/turn', async () => ({
    turnId: 'idle', recommendedActionId: null, policy: POLICY, actions: [],
  }));
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    state,
    close: () => app.close(),
  };
}

async function initialNameSafetyTest() {
  {
    const api = await localApi();
    const dir = await privateTempDir('omerta-agent-alpha-name-syntax-');
    const sessionFile = join(dir, 'session.json');
    const reportFile = join(dir, 'report.jsonl');
    try {
      await assert.rejects(
        runAgentAlpha({
          baseUrl: api.baseUrl,
          sessionFile,
          reportFile,
          create: true,
          name: 'Bad<Name',
          maxActions: 1,
          intervalMs: 3100,
          sleep: async () => {},
        }),
        /letters|punctuation|name/i,
        'deterministically invalid server syntax is rejected before guest creation',
      );
      assert.equal(api.state.guestCalls, 0,
        'invalid deterministic syntax cannot strand a newly created agent account');
    } finally {
      await api.close();
      await rm(dir, { recursive: true, force: true });
    }
  }

  {
    const api = await initialNameApi();
    await withReadySession(api, 'omerta-agent-alpha-name-correction-', async ({ sessionFile, reportFile }) => {
      await writePrivateSession(sessionFile, JSON.stringify(sessionFor(api.baseUrl, {
        phase: 'initial_character_pending',
        characterName: 'Taken Name',
      })));
      await assert.rejects(
        runAgentAlpha({
          baseUrl: api.baseUrl,
          sessionFile,
          reportFile,
          maxActions: 1,
          intervalMs: 3100,
          sleep: async () => {},
        }),
        /400|name_taken/i,
        'a server uniqueness rejection leaves the one initial identity pending for correction',
      );
      assert.equal(JSON.parse(await readFile(sessionFile, 'utf8')).phase,
        'initial_character_pending',
      'a rejected initial name cannot finalize or replace the identity');
      const summary = await runAgentAlpha({
        baseUrl: api.baseUrl,
        sessionFile,
        reportFile,
        name: 'Available Name',
        maxActions: 1,
        intervalMs: 3100,
        sleep: async () => {},
      });
      assert.equal(summary.actions, 0,
        'a pending initial character can resume after one explicit name correction');
      assert.deepEqual(api.state.names, ['Taken Name', 'Available Name'],
        'the corrected name is used after the one known rejected initial attempt');
      assert.equal(api.state.guestCalls, 0,
        'name correction reuses the one existing agent identity');
      const session = JSON.parse(await readFile(sessionFile, 'utf8'));
      assert.equal(session.phase, 'agent', 'successful initial creation finalizes the agent phase');
      assert.equal(session.characterName, 'Available Name',
        'the corrected initial name becomes the durable identity name');
    });
  }
}

async function phaseRecoveryTest() {
  for (const phase of ['guest', 'initial_character_pending']) {
    const api = await phaseRecoveryApi({ initialPhase: phase });
    await withReadySession(api, 'omerta-agent-alpha-phase-', async ({ sessionFile, reportFile }) => {
      await writePrivateSession(sessionFile, JSON.stringify(sessionFor(api.baseUrl, {
        phase,
        token: phase === 'guest' ? 'guest-token-secret' : 'agent-token-secret',
      })));
      const summary = await runAgentAlpha({
        baseUrl: api.baseUrl,
        sessionFile,
        reportFile,
        maxActions: 1,
        intervalMs: 3100,
        sleep: async () => {},
      });
      assert.equal(summary.actions, 0,
        `a durable ${phase} phase resumes setup and reaches an idle turn`);
      assert.equal(api.state.agentKeyCalls, phase === 'guest' ? 1 : 0,
        `a ${phase} phase performs only the unfinished agent-key transition`);
      assert.equal(api.state.characterCalls, 1,
        `a ${phase} phase finishes the one stored character creation`);
      assert.deepEqual(JSON.parse(await readFile(sessionFile, 'utf8')), {
        version: 1,
        base: api.baseUrl,
        phase: 'agent',
        token: 'agent-token-secret',
        characterName: 'Alpha Machine',
        pending: null,
      }, `a ${phase} recovery stores no response account/character identifiers`);
    });
  }
}

async function runCli(args, env) {
  const script = fileURLToPath(new URL('../tools/agent-alpha.js', import.meta.url));
  const child = spawn(process.execPath, [script, ...args], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const code = await new Promise((resolveExit) => child.once('exit', resolveExit));
  return { code, stdout, stderr };
}

async function waitFor(promise, label, timeoutMs = 8000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function hardCrashReplayTest() {
  const app = Fastify({ logger: false, forceCloseConnections: true });
  const sockets = new Set();
  app.server.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  const state = { sessionCalls: 0, turnCalls: 0, actKeys: [], actBodies: [] };
  let receivedFirst;
  const firstReceived = new Promise((resolveFirst) => { receivedFirst = resolveFirst; });
  let releaseFirst;
  const firstResponseGate = new Promise((resolveGate) => { releaseFirst = resolveGate; });
  let sessionFile;

  app.get('/v1/session', async () => {
    state.sessionCalls += 1;
    return {
      authed: true,
      agent: true,
      hasCharacter: true,
      character: { id: 'character-id-secret', name: 'Alpha Machine', generation: 1 },
    };
  });
  app.get('/v1/agent/turn', async () => {
    state.turnCalls += 1;
    return {
      turnId: 'hard-crash-turn',
      recommendedActionId: 'hard-crash-action',
      policy: POLICY,
      actions: [{
        id: 'hard-crash-action', kind: 'crime', method: 'POST', path: '/ignored',
        body: { prompt: 'never persist this' }, executable: true,
      }],
    };
  });
  app.post('/v1/agent/act', async (req, reply) => {
    state.actKeys.push(req.headers['idempotency-key']);
    state.actBodies.push(req.body);
    if (state.actKeys.length === 1) {
      const journal = JSON.parse(await readFile(sessionFile, 'utf8'));
      assert.equal(journal.pending?.turnId, 'hard-crash-turn',
        'the journal is durably visible before the remote mutation begins');
      assert.equal(journal.pending?.actionId, 'hard-crash-action',
        'the durable journal contains the exact server-issued action before POST');
      receivedFirst();
      await firstResponseGate;
    }
    return {
      actionId: req.body.actionId,
      result: { ok: true },
      turn: { turnId: 'idle', recommendedActionId: null, policy: POLICY, actions: [] },
    };
  });

  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const dir = await privateTempDir('omerta-agent-alpha-hard-crash-');
  sessionFile = join(dir, 'session.json');
  const reportFile = join(dir, 'report.jsonl');
  await writePrivateSession(sessionFile, JSON.stringify(sessionFor(baseUrl)));

  const runnerUrl = pathToFileURL(fileURLToPath(new URL('../tools/agent-alpha.js', import.meta.url))).href;
  const childCode = `
    import { createAgentAlphaTestRunner } from ${JSON.stringify(runnerUrl)};
    let now = 0;
    const runAgentAlpha = createAgentAlphaTestRunner({
      now: () => now,
      sleep: async (ms) => { now += ms; },
    });
    await runAgentAlpha({
      baseUrl: process.env.TEST_BASE,
      sessionFile: process.env.TEST_SESSION,
      reportFile: process.env.TEST_REPORT,
      maxActions: 1,
      intervalMs: 3100,
      sleep: async () => {},
    });
  `;
  const child = spawn(process.execPath, ['--input-type=module', '--eval', childCode], {
    env: {
      ...process.env,
      TEST_BASE: baseUrl,
      TEST_SESSION: sessionFile,
      TEST_REPORT: reportFile,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let childError = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { childError += chunk; });

  try {
    await waitFor(firstReceived, `child mutation (${childError})`);
    await assert.rejects(
      runAgentAlpha({
        baseUrl,
        sessionFile,
        reportFile,
        maxActions: 1,
        intervalMs: 3100,
        sleep: async () => {},
      }),
      /lock|already running|duplicate/i,
      'a live OS-owned lock refuses a concurrent runner',
    );
    assert.equal(state.actKeys.length, 1,
      'the refused concurrent process performs no remote action');

    child.kill();
    await waitFor(new Promise((resolveExit) => child.once('exit', resolveExit)), 'child hard exit');
    releaseFirst();
    assert.notEqual(child.exitCode, 0, 'the first runner terminates without its normal finally path');
    const crashed = JSON.parse(await readFile(sessionFile, 'utf8'));
    assert.equal(crashed.pending?.operationId?.length > 0, true,
      'the hard-crashed process leaves the durable pending operation for replay');

    const resumed = await runAgentAlpha({
      baseUrl,
      sessionFile,
      reportFile,
      maxActions: 1,
      intervalMs: 3100,
      sleep: async () => {},
    });
    assert.deepEqual(resumed, { status: 'complete', actions: 1 },
      'restart reclaims the dead owner and confirms the one pending logical action');
    assert.equal(state.turnCalls, 1,
      'hard-crash restart retries the journal before fetching a new turn');
    assert.equal(state.actKeys.length, 2,
      'hard-crash restart makes exactly one idempotent confirmation attempt');
    assert.equal(state.actKeys[0], state.actKeys[1],
      'hard-crash restart reuses the exact same idempotency key');
    assert.deepEqual(state.actBodies[0], state.actBodies[1],
      'hard-crash restart reuses the exact journaled turn/action body');
    assert.equal(JSON.parse(await readFile(sessionFile, 'utf8')).pending, null,
      'the replay journal clears only after authoritative confirmation');
  } finally {
    releaseFirst();
    if (child.exitCode == null && child.signalCode == null) {
      child.kill();
      await new Promise((resolveExit) => child.once('exit', resolveExit));
    }
    for (const socket of sockets) socket.destroy();
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
}

async function cliContractTest() {
  const api = await probeApi();
  await withReadySession(api, 'omerta-agent-alpha-cli-', async ({ sessionFile, reportFile }) => {
    const result = await runCli([
      '--session', sessionFile,
      '--report', reportFile,
      '--max-actions', '1',
    ], { OMERTA_BASE_URL: api.baseUrl });
    assert.equal(result.code, 0, `the finite CLI exits cleanly: ${result.stderr}`);
    assert.deepEqual(JSON.parse(result.stdout), { status: 'complete', actions: 0 },
      'the CLI exposes the finite runner summary as JSON');

    const reset = await runCli([
      '--session', sessionFile,
      '--report', reportFile,
      '--reset',
    ], { OMERTA_BASE_URL: api.baseUrl });
    assert.equal(reset.code, 1, 'the CLI exposes no identity-reset path');
    assert.equal(reset.stderr.trim(), 'agent_alpha_error',
      'CLI failures print only a stable non-sensitive code');
  });
}

async function redirectOriginTest() {
  const destination = Fastify({ logger: false });
  let redirectedRequests = 0;
  destination.get('/capture', async () => {
    redirectedRequests += 1;
    return {
      authed: true,
      agent: true,
      hasCharacter: true,
      character: { id: 'redirected-id-secret', name: 'Alpha Machine', generation: 1 },
    };
  });
  await destination.listen({ port: 0, host: '127.0.0.1' });
  const destinationAddress = destination.server.address();
  const destinationUrl = `http://127.0.0.1:${destinationAddress.port}/capture`;

  const origin = Fastify({ logger: false });
  origin.get('/v1/session', async (_req, reply) => reply.redirect(destinationUrl));
  origin.get('/v1/agent/turn', async () => ({
    turnId: 'idle', recommendedActionId: null, policy: POLICY, actions: [],
  }));
  await origin.listen({ port: 0, host: '127.0.0.1' });
  const originAddress = origin.server.address();
  const baseUrl = `http://127.0.0.1:${originAddress.port}`;

  const dir = await privateTempDir('omerta-agent-alpha-redirect-');
  const sessionFile = join(dir, 'session.json');
  const reportFile = join(dir, 'report.jsonl');
  await writePrivateSession(sessionFile, JSON.stringify(sessionFor(baseUrl)));
  try {
    await assert.rejects(
      runAgentAlpha({
        baseUrl,
        sessionFile,
        reportFile,
        maxActions: 1,
        intervalMs: 3100,
        sleep: async () => {},
      }),
      /redirect|origin/i,
      'an API redirect is rejected instead of escaping the session-bound origin',
    );
    assert.equal(redirectedRequests, 0,
      'the runner does not forward auth or request data to the redirect destination');
  } finally {
    await origin.close();
    await destination.close();
    await rm(dir, { recursive: true, force: true });
  }
}

async function physicalAliasLockTest() {
  const dir = await privateTempDir('omerta-agent-alpha-alias-lock-');
  const physicalDir = join(dir, 'physical');
  const aliasDir = join(dir, 'alias');
  await mkdir(physicalDir);
  await secureWindowsDirectory(physicalDir);
  await symlink(physicalDir, aliasDir, process.platform === 'win32' ? 'junction' : 'dir');
  const sessionFile = join(physicalDir, 'session.json');
  const aliasSessionFile = join(aliasDir, 'session.json');

  const app = Fastify({ logger: false });
  let sessionCalls = 0;
  let enterFirst;
  const firstEntered = new Promise((resolveEntered) => { enterFirst = resolveEntered; });
  let releaseFirst;
  const firstGate = new Promise((resolveGate) => { releaseFirst = resolveGate; });
  app.get('/v1/session', async () => {
    sessionCalls += 1;
    if (sessionCalls === 1) {
      enterFirst();
      await firstGate;
    }
    return {
      authed: true,
      agent: true,
      hasCharacter: true,
      character: { id: 'alias-secret', name: 'Alpha Machine', generation: 1 },
    };
  });
  app.get('/v1/agent/turn', async () => ({
    turnId: 'idle', recommendedActionId: null, policy: POLICY, actions: [],
  }));
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  await writePrivateSession(sessionFile, JSON.stringify(sessionFor(baseUrl)));

  let first;
  try {
    first = runAgentAlpha({
      baseUrl,
      sessionFile,
      reportFile: join(physicalDir, 'report.jsonl'),
      maxActions: 1,
      intervalMs: 3100,
    });
    await firstEntered;
    await assert.rejects(
      runAgentAlpha({
        baseUrl,
        sessionFile: aliasSessionFile,
        reportFile: join(aliasDir, 'report.jsonl'),
        maxActions: 1,
        intervalMs: 3100,
      }),
      /locked.*live runner/i,
      'a real directory alias cannot acquire a second lease for one physical session',
    );
    assert.equal(sessionCalls, 1,
      'exactly one alias-path runner reaches the protected session endpoint');
  } finally {
    releaseFirst();
    await first?.catch(() => {});
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
}

async function danglingSessionAliasCreateTest() {
  const dir = await privateTempDir('omerta-agent-alpha-dangling-session-');
  const sessionFile = join(dir, 'future-session.json');
  const aliasSessionFile = join(dir, 'dangling-session.json');
  await symlink(sessionFile, aliasSessionFile, 'file');
  let targetCalls = 0;
  let aliasCalls = 0;
  let targetEntered;
  const targetAtGuest = new Promise((resolveEntered) => { targetEntered = resolveEntered; });
  let releaseTarget;
  const targetGate = new Promise((resolveGate) => { releaseTarget = resolveGate; });
  const targetFetch = async () => {
    targetCalls += 1;
    targetEntered();
    await targetGate;
    throw new Error('stop-after-target-guest');
  };
  const aliasFetch = async () => {
    aliasCalls += 1;
    throw new Error('dangling alias reached network');
  };

  let targetRun;
  try {
    targetRun = runAgentAlpha({
      baseUrl: 'http://127.0.0.1:1',
      sessionFile,
      reportFile: join(dir, 'target-report.jsonl'),
      create: true,
      name: 'Target Alpha',
      fetchImpl: targetFetch,
    });
    await targetAtGuest;
    await assert.rejects(
      runAgentAlpha({
        baseUrl: 'http://127.0.0.1:1',
        sessionFile: aliasSessionFile,
        reportFile: join(dir, 'alias-report.jsonl'),
        create: true,
        name: 'Alias Alpha',
        fetchImpl: aliasFetch,
      }),
      /link|ENOENT|physical target|locked.*live runner/i,
      'a formerly dangling session alias fails closed on canonical identity or the live lock',
    );
    assert.equal(aliasCalls, 0,
      'the rejected dangling-alias invocation performs zero network work');
    assert.equal(targetCalls, 1,
      'only the explicitly targeted physical session reaches guest creation');
  } finally {
    releaseTarget();
    await targetRun?.catch(() => {});
    await rm(dir, { recursive: true, force: true });
  }
}

async function danglingReportToFutureLockTest() {
  const dir = await privateTempDir('omerta-agent-alpha-dangling-report-');
  const sessionFile = join(dir, 'session.json');
  const reportFile = join(dir, 'report.jsonl');
  const lockFile = `${sessionFile}.lock`;
  const baseUrl = 'http://127.0.0.1:1';
  await writePrivateSession(sessionFile, JSON.stringify(sessionFor(baseUrl)));
  await symlink(lockFile, reportFile, 'file');
  let networkCalls = 0;
  try {
    await assert.rejects(
      runAgentAlpha({
        baseUrl,
        sessionFile,
        reportFile,
        fetchImpl: async () => {
          networkCalls += 1;
          throw new Error('dangling report reached network');
        },
      }),
      /link|ENOENT|physical target/i,
      'a dangling report alias to the future lock target fails closed',
    );
    assert.equal(networkCalls, 0,
      'dangling report/lock alias rejection happens before any network work');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function reportTargetReplacementTest() {
  const outcomes = {};
  for (const kind of ['session-symlink', 'session-hardlink', 'lock-symlink']) {
    const api = await actionApi({ kinds: ['report_swap_is_not_an_action'] });
    await withReadySession(api, `omerta-agent-alpha-report-${kind}-`,
      async ({ sessionFile, reportFile }) => {
        let swapped = false;
        let targetBefore = '';
        let targetPath = '';
        const displacedReport = `${reportFile}.approved`;
        const swappingFetch = async (url, options) => {
          const response = await fetch(url, options);
          if (!swapped && new URL(url).pathname === '/v1/agent/turn') {
            targetPath = kind === 'lock-symlink' ? `${sessionFile}.lock` : sessionFile;
            targetBefore = await readFile(targetPath, 'utf8');
            await rename(reportFile, displacedReport).catch((error) => {
              if (error?.code !== 'ENOENT') throw error;
            });
            if (kind === 'session-hardlink') await link(targetPath, reportFile);
            else await symlink(targetPath, reportFile, 'file');
            swapped = true;
          }
          return response;
        };
        let error = null;
        try {
          await runAgentAlpha({
            baseUrl: api.baseUrl,
            sessionFile,
            reportFile,
            maxActions: 1,
            intervalMs: 3100,
            fetchImpl: swappingFetch,
          });
        } catch (caught) { error = caught; }
        let targetAfter = null;
        try { targetAfter = await readFile(targetPath, 'utf8'); }
        catch (readError) {
          if (readError?.code !== 'ENOENT') throw readError;
        }
        outcomes[kind] = {
          swapped,
          rejectedByReportAuthority: /report|telemetry|identity|link|regular/i.test(error?.message || ''),
          targetUnchangedOrSafelyReleased: targetAfter === null || targetAfter === targetBefore,
        };
      });
    await api.close();
  }
  assert.deepEqual(outcomes, {
    'session-symlink': {
      swapped: true, rejectedByReportAuthority: true, targetUnchangedOrSafelyReleased: true,
    },
    'session-hardlink': {
      swapped: true, rejectedByReportAuthority: true, targetUnchangedOrSafelyReleased: true,
    },
    'lock-symlink': {
      swapped: true, rejectedByReportAuthority: true, targetUnchangedOrSafelyReleased: true,
    },
  }, 'every post-preflight report replacement is rejected before session or lock bytes change');
}

async function nonRegularReportTargetTest() {
  if (process.platform === 'win32') return;
  for (const kind of ['fifo', 'device']) {
    const api = await probeApi();
    const dir = await privateTempDir(`omerta-agent-alpha-report-${kind}-`);
    const sessionFile = join(dir, 'session.json');
    const reportFile = kind === 'device' ? '/dev/null' : join(dir, 'report.fifo');
    try {
      await writePrivateSession(sessionFile, JSON.stringify(sessionFor(api.baseUrl)));
      if (kind === 'fifo') await execFileAsync('mkfifo', [reportFile]);
      await assert.rejects(
        runAgentAlpha({ baseUrl: api.baseUrl, sessionFile, reportFile, maxActions: 1 }),
        /report|regular|telemetry|device|fifo/i,
        `${kind} report targets fail closed instead of receiving an append`,
      );
      assert.equal(api.state.sessionCalls, 0,
        `${kind} report rejection happens before any credential-bearing network use`);
    } finally {
      await api.close();
      await rm(dir, { recursive: true, force: true });
    }
  }
}

async function distinctPhysicalTargetsTest() {
  const app = Fastify({ logger: false });
  let sessionCalls = 0;
  app.get('/v1/session', async () => {
    sessionCalls += 1;
    return {
      authed: true,
      agent: true,
      hasCharacter: true,
      character: { id: 'target-secret', name: 'Alpha Machine', generation: 1 },
    };
  });
  app.get('/v1/agent/turn', async () => ({
    turnId: 'idle', recommendedActionId: null, policy: POLICY, actions: [],
  }));
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const dir = await privateTempDir('omerta-agent-alpha-targets-');
  try {
    for (const kind of ['equal', 'hardlink', 'lock', 'orphan-temp']) {
      const sessionFile = join(dir, `${kind}-session.json`);
      await writePrivateSession(sessionFile, JSON.stringify(sessionFor(baseUrl)));
      let reportFile = join(dir, `${kind}-report.jsonl`);
      if (kind === 'equal') reportFile = sessionFile;
      if (kind === 'hardlink') await link(sessionFile, reportFile);
      if (kind === 'lock') reportFile = `${sessionFile}.lock`;
      if (kind === 'orphan-temp') {
        reportFile = `${sessionFile}.1234.${crypto.randomUUID()}.tmp`;
        await writePrivateSession(reportFile, 'orphaned-credential-secret');
      }
      await assert.rejects(
        runAgentAlpha({ baseUrl, sessionFile, reportFile, maxActions: 1, intervalMs: 3100 }),
        /session.*report.*lock|distinct|alias|target/i,
        `${kind} session/report/lock targets are rejected before any remote probe`,
      );
    }
    assert.equal(sessionCalls, 0,
      'invalid physical target layouts are rejected before network work');
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
}

async function unrelatedLegacyPortTest() {
  const app = Fastify({ logger: false });
  let sessionCalls = 0;
  app.get('/v1/session', async () => {
    sessionCalls += 1;
    return {
      authed: true,
      agent: true,
      hasCharacter: true,
      character: { id: 'port-secret', name: 'Alpha Machine', generation: 1 },
    };
  });
  app.get('/v1/agent/turn', async () => ({
    turnId: 'idle', recommendedActionId: null, policy: POLICY, actions: [],
  }));
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const dir = await privateTempDir('omerta-agent-alpha-port-');
  const sessionFile = join(dir, 'session.json');
  const reportFile = join(dir, 'report.jsonl');
  await writePrivateSession(sessionFile, JSON.stringify(sessionFor(baseUrl)));
  const identity = process.platform === 'win32'
    ? resolve(sessionFile).toLowerCase()
    : resolve(sessionFile);
  const digest = crypto.createHash('sha256').update(identity).digest();
  const occupiedPort = 20000 + (digest.readUInt32BE(0) % 20000);
  const unrelated = createServer((socket) => socket.destroy());
  await new Promise((resolveListen, rejectListen) => {
    unrelated.once('error', rejectListen);
    unrelated.listen({ host: '127.0.0.1', port: occupiedPort }, resolveListen);
  });
  try {
    const summary = await runAgentAlphaProduction({
      baseUrl, sessionFile, reportFile, maxActions: 1, intervalMs: 3100,
    });
    assert.deepEqual(summary, { status: 'complete', actions: 0 },
      'an unrelated listener in the old 20k port namespace cannot impersonate a session owner');
    assert.equal(sessionCalls, 1, 'the runner retains availability despite the unrelated listener');
  } finally {
    await new Promise((resolveClose) => unrelated.close(resolveClose));
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
}

async function realElapsedCadenceTest() {
  const api = await localApi();
  const dir = await privateTempDir('omerta-agent-alpha-real-cadence-');
  const sessionFile = join(dir, 'session.json');
  const reportFile = join(dir, 'report.jsonl');
  await writePrivateSession(sessionFile, JSON.stringify(sessionFor(api.baseUrl)));
  api.state.agent = true;
  api.state.hasCharacter = true;
  api.state.characterName = 'Alpha Machine';
  const acceptedAt = [];
  api.requests.length = 0;
  api.state.actCalls = 0;
  try {
    const originalFetch = globalThis.fetch;
    const recordingFetch = async (...args) => {
      const response = await originalFetch(...args);
      if (new URL(args[0]).pathname === '/v1/agent/act' && response.ok) {
        acceptedAt.push(performance.now());
      }
      return response;
    };
    const summary = await runAgentAlphaProduction({
      baseUrl: api.baseUrl,
      sessionFile,
      reportFile,
      maxActions: 2,
      intervalMs: 3100,
      fetchImpl: recordingFetch,
      sleep: async () => {},
    });
    assert.deepEqual(summary, { status: 'complete', actions: 2 });
    assert.equal(acceptedAt.length, 2);
    assert.ok(acceptedAt[1] - acceptedAt[0] >= 3100,
      `accepted mutations were only ${acceptedAt[1] - acceptedAt[0]}ms apart`);
  } finally {
    await api.close();
    await rm(dir, { recursive: true, force: true });
  }
}

await distinctPhysicalTargetsTest();
await guestBootstrapServerRecoveryTest();
await initialGuestCrashRecoveryTest();
await credentialStorageConfidentialityTest();
await credentialParentReplacementTest();
await credentialWriteBoundaryReplacementTest();
await reportTargetReplacementTest();
await nonRegularReportTargetTest();
await lifecycleTest();
await failClosedSessionTest();
await orphanedLockMetadataTest();
await exactAllowlistTest();
await safetyRefusalTest();
await boundsTest();
await ambiguousMutationRecoveryTest();
await staleReplacementTest();
await staleAttemptBoundTest();
await finalAgentWithoutCharacterTest();
await bootstrapAcknowledgementCrashWindowTest();
await phaseRecoveryTest();
await initialNameSafetyTest();
await cliContractTest();
await redirectOriginTest();
await hardCrashReplayTest();
await physicalAliasLockTest();
await danglingReportToFutureLockTest();
await danglingSessionAliasCreateTest();
await unrelatedLegacyPortTest();
await realElapsedCadenceTest();
console.log('agent-alpha tests passed');
