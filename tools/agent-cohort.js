#!/usr/bin/env node
// Finite owner-operated QA cohort. Secrets stay in Alpha's private journals; reports are projections.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { runAgentAlpha } from './agent-alpha.js';

export const COHORT = Object.freeze([
  { id: 'lead', name: 'Codex Lead AI', role: 'progression', goal: 100 },
  { id: 'economy', name: 'Codex Trade AI', role: 'progression', economyAfterLevel: 55, goal: 100 },
  { id: 'investigator', name: 'Codex Intel AI', role: 'progression', goal: 100 },
]);
const MILESTONES = [1, 3, 5, 7, 8, 9, 10, 15, 18, 20, 22, 30, 35, 40, 44, 48, 50, 53, 55, 58, 64, 65, 70, 76, 80, 82, 90, 95, 98, 100];
const BOARDS = [
  [5, '/v1/content'], [5, '/v1/questing'], [5, '/v1/worldgraph/mysteries'],
  [5, '/v1/skills'], [5, '/v1/regimen'], [7, '/v1/market'], [7, '/v1/market/prices'],
  [8, '/v1/me'], [9, '/v1/crew'], [9, '/v1/worldgraph/operations'], [18, '/v1/law'], [20, '/v1/world'],
];
const ALLOWED_POSTS = new Set(['/v1/auth/agent', '/v1/auth/guest/bootstrap/ack', '/v1/auth/agent-key', '/v1/character', '/v1/agent/act']);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
async function exists(path) { try { await stat(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
async function load(path, fallback) { try { return JSON.parse(await readFile(path, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; } }
async function save(path, value) {
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
}
function snapshot(turn) {
  if (!turn?.state?.identity) return null;
  return { observedAt: turn.observedAt, state: turn.state, coach: turn.coach,
    exploration: turn.exploration, nextWakeAt: turn.nextWakeAt,
    actions: (turn.actions || []).map(({ id, kind, score, cost, reward, risk, executable }) => ({ id, kind, score, cost, reward, risk, executable })),
    blockedActions: (turn.blockedActions || []).map(({ id, kind, blockedBy }) => ({ id, kind, blockedBy })) };
}

async function prepareState(root) {
  if (await exists(root) && (await lstat(root)).isSymbolicLink()) throw new Error('Private state root cannot be a link');
  for (const entry of COHORT) {
    const path = join(root, entry.id);
    if (await exists(path) && (await lstat(path)).isSymbolicLink()) throw new Error('Private role directory cannot be a link');
    await mkdir(path, { recursive: true, mode: 0o700 });
  }
  if (process.platform !== 'win32') return;
  const script = `
    $ErrorActionPreference='Stop'
    $user=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
    foreach($name in @('lead','economy','investigator')) {
      $target=Join-Path $env:OMERTA_COHORT_STATE $name
      $acl=New-Object System.Security.AccessControl.DirectorySecurity
      $acl.SetOwner($user); $acl.SetAccessRuleProtection($true,$false)
      foreach($sid in @($user.Value,'S-1-5-18','S-1-5-32-544')) {
        $identity=New-Object System.Security.Principal.SecurityIdentifier($sid)
        $rule=New-Object System.Security.AccessControl.FileSystemAccessRule($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
        [void]$acl.AddAccessRule($rule)
      }
      $directory=New-Object System.IO.DirectoryInfo($target)
      if($directory.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw 'Private directory is a reparse point' }
      $directory.SetAccessControl($acl)
    }
  `;
  await promisify(execFile)('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
    windowsHide: true, env: { ...process.env, OMERTA_COHORT_STATE: root }, timeout: 10000,
  });
}

export async function acquireCohortLease(root) {
  const physical = (await realpath(root)).toLowerCase();
  const hash = createHash('sha256').update(physical).digest('hex').slice(0, 40);
  const endpoint = process.platform === 'win32' ? `\\\\.\\pipe\\omerta-cohort-${hash}` : `\0omerta-cohort-${hash}`;
  const server = createServer((socket) => socket.end());
  await new Promise((yes, no) => { server.once('error', no); server.listen(endpoint, yes); });
  return () => new Promise((done) => server.close(done));
}

export async function runCohort(options, { runAgent = runAgentAlpha, fetchImpl = fetch, sleepImpl = sleep } = {}) {
  const stateRoot = resolve(options.stateRoot || join(homedir(), '.omerta-level100', 'cohort'));
  const out = resolve(options.out || 'output/live-playtest-level100-2026-11-08');
  const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const normalizedState = stateRoot.replaceAll('\\', '/').toLowerCase();
  const normalizedSource = sourceRoot.replaceAll('\\', '/').toLowerCase();
  if (normalizedState.startsWith(`${normalizedSource}/`) || normalizedState === normalizedSource)
    throw new Error('Cohort credentials must be outside the repository');
  const budget = options.maxActions ?? 12, minutes = options.maxMinutes ?? 10;
  if (!Number.isInteger(budget) || budget < 1 || budget > 50 || !Number.isFinite(minutes) || minutes < 0.1 || minutes > 15)
    throw new Error('Use 1–50 actions per identity and 0.1–15 minutes per finite run');
  const base = new URL(options.baseUrl || 'https://www.omerta.fun');
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/')
    throw new Error('Expected a plain HTTP(S) origin');
  if (options.prepare) await prepareState(stateRoot);
  await mkdir(out, { recursive: true });
  if (!options.live) return { status: 'not_armed', roles: COHORT, stateRoot, out };
  const lead = await load(join(out, 'lead.json'), null);
  if (Number(lead?.last?.state?.identity?.level) >= 100)
    return { status: 'goal_reached', targetLevel: 100, level: lead.last.state.identity.level };
  if (lead?.status === 'level_reached') return { status: 'needs_attention', reason: 'completion_snapshot_missing' };
  const release = await acquireCohortLease(stateRoot);
  const deadline = Date.now() + minutes * 60000;
  try {
    const settled = await Promise.allSettled(COHORT.map(async (entry) => {
      const checkpointFile = join(out, `${entry.id}.json`);
      const checkpoint = await load(checkpointFile, { role: entry.id, milestones: [], boards: {} });
      const sessionFile = join(stateRoot, entry.id, 'session.json');
      const reportFile = join(stateRoot, entry.id, 'report.jsonl');
      if (checkpoint.identity && !await exists(sessionFile)) return { role: entry.id, status: 'identity_lost' };
      if (['dead', 'identity_changed', 'level_reached'].includes(checkpoint.status)) return { role: entry.id, status: checkpoint.status };
      let posts = 0, turn = null, headers = null, agentMarked = false;
      let lastActionResponseAt = null;
      const events = [];
      const observingFetch = async (url, request) => {
        const path = new URL(url).pathname;
        if (!['GET', 'HEAD'].includes(request.method || 'GET') && !ALLOWED_POSTS.has(path)) throw new Error('Cohort mutation outside its fixed allowlist');
        if (path === '/v1/agent/act') {
          if (!agentMarked || posts >= budget) throw new Error('Cohort agent marking or action budget violated');
          posts++;
        }
        const response = await fetchImpl(url, { ...request, signal: AbortSignal.timeout(30000) }), body = await response.clone().json();
        if (path === '/v1/agent/act') lastActionResponseAt = Date.now();
        if (request.headers?.authorization) headers = request.headers;
        if (path === '/v1/session' && body.agent) agentMarked = true;
        if (path === '/v1/session' && !body.hasCharacter && checkpoint.identity) checkpoint.status = 'dead';
        const next = snapshot(body.turn || body);
        if (next) {
          if (checkpoint.identity && checkpoint.identity !== next.state.identity.id) { checkpoint.status = 'identity_changed'; throw new Error('Cohort character identity changed'); }
          turn = next; checkpoint.identity = next.state.identity.id; checkpoint.last = next;
        }
        events.push({ at: new Date().toISOString(), path, status: response.status,
          error: typeof body.error === 'string' ? body.error : undefined,
          actionId: path === '/v1/agent/act' ? JSON.parse(request.body).actionId : undefined });
        return response;
      };
      try {
        for (let round = 0; round < 10 && posts < budget && Date.now() < deadline; round++) {
          const strategy = entry.economyAfterLevel && Number(checkpoint.last?.state?.identity?.level) >= entry.economyAfterLevel
            ? 'general' : entry.role;
          const result = await runAgent({ baseUrl: base.origin, sessionFile, reportFile,
            name: entry.name, role: strategy, stopAtLevel: entry.goal,
            create: options.create === true, maxActions: budget - posts, fetchImpl: observingFetch });
          checkpoint.status = result.status;
          checkpoint.strategy = strategy;
          checkpoint.updatedAt = new Date().toISOString();
          checkpoint.agentMarked = agentMarked;
          if (turn) {
            const crossed = MILESTONES.filter((level) => level <= turn.state.identity.level && !checkpoint.milestones.includes(level));
            if (crossed.length) {
              checkpoint.milestones.push(...crossed);
              await sleepImpl(Math.max(0, 3100 - (Date.now() - (lastActionResponseAt || Date.now()))));
              const response = await fetchImpl(`${base.origin}/v1/me`, { headers, redirect: 'manual', signal: AbortSignal.timeout(30000) });
              const body = await response.json(), me = body.character;
              checkpoint.milestoneSnapshots ||= [];
              checkpoint.milestoneSnapshots.push({ crossed, at: new Date().toISOString(), turn,
                own: me ? Object.fromEntries(['level', 'respect', 'maxEnergy', 'maxNerve', 'stats', 'eff', 'heat', 'jailSeconds'].map((key) => [key, me[key]])) : { status: response.status, error: body.error } });
            }
          }
          await save(checkpointFile, checkpoint);
          if (result.status !== 'complete' || !turn || posts >= budget) break;
          const crime = turn.blockedActions?.find((action) => action.kind === 'crime');
          const gates = crime?.blockedBy?.map((blocker) => Date.parse(blocker.availableAt)).filter(Number.isFinite) || [];
          const wake = gates.length ? Math.max(...gates) : Date.parse(turn.nextWakeAt);
          if (!Number.isFinite(wake)) break;
          const remaining = wake - Date.now();
          if (remaining > deadline - Date.now()) break;
          await sleepImpl(Math.min(60000, Math.max(3100, remaining)));
        }
        // Board snapshots are observations, not evidence that these systems were played.
        if (headers && turn && entry.id === 'investigator') {
          for (const [level, path] of BOARDS) {
            if (level > turn.state.identity.level || checkpoint.boards[path] || Date.now() >= deadline) continue;
            await sleepImpl(3100);
            const response = await fetchImpl(`${base.origin}${path}`, { headers, redirect: 'manual', signal: AbortSignal.timeout(30000) });
            const body = await response.json();
            checkpoint.boards[path] = { at: new Date().toISOString(), status: response.status,
              error: typeof body.error === 'string' ? body.error : undefined,
              keys: Object.keys(body), collections: Object.fromEntries(Object.entries(body).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length])) };
          }
        }
      } catch (error) {
        if (!['dead', 'identity_changed'].includes(checkpoint.status)) checkpoint.status = 'needs_attention';
        checkpoint.error = typeof error.code === 'string' ? error.code : 'runner_error';
      }
      checkpoint.updatedAt = new Date().toISOString();
      checkpoint.lastRun = { posts, events };
      await save(checkpointFile, checkpoint);
      return { role: entry.id, status: checkpoint.status, posts, level: turn?.state.identity.level || checkpoint.last?.state.identity.level,
        nextWakeAt: turn?.nextWakeAt || checkpoint.last?.nextWakeAt };
    }));
    const results = settled.map((result, index) => result.status === 'fulfilled' ? result.value
      : { role: COHORT[index].id, status: 'needs_attention', error: 'checkpoint_or_storage_error' });
    const summary = { at: new Date().toISOString(), targetLevel: 100, results };
    await save(join(out, 'cohort.json'), summary);
    return summary;
  } finally { await release(); }
}

async function main() {
  const options = {};
  for (let i = 2; i < process.argv.length; i++) {
    const flag = process.argv[i];
    if (['--live', '--create', '--prepare'].includes(flag)) options[flag.slice(2)] = true;
    else {
      const names = { '--state-root': 'stateRoot', '--out': 'out', '--base': 'baseUrl', '--max-actions': 'maxActions', '--max-minutes': 'maxMinutes' };
      if (!names[flag] || !process.argv[i + 1]) throw new Error('Unknown or incomplete cohort option');
      options[names[flag]] = flag.startsWith('--max-') ? Number(process.argv[++i]) : process.argv[++i];
    }
  }
  process.stdout.write(`${JSON.stringify(await runCohort(options))}\n`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => {
  process.stderr.write('cohort_error\n'); process.exitCode = 1;
});
