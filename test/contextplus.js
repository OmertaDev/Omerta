// ContextPlus launcher regressions. Exercises the real Ollama HTTP boundary so
// missing services and models fail before Codex advertises semantic tools.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const healthScript = join(root, 'tools', 'contextplus-health.js');
const launcherScript = join(root, '.codex', 'start-contextplus.ps1');

async function localOllama(models) {
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/api/tags') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ models: models.map((name) => ({ name, model: name })) }));
      return;
    }
    res.writeHead(404).end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  return {
    host: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function unusedLocalHost() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return `http://127.0.0.1:${port}`;
}

function runHealth(host) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [healthScript], {
      cwd: root,
      env: {
        ...process.env,
        OLLAMA_HOST: host,
        OLLAMA_EMBED_MODEL: 'nomic-embed-text',
        OLLAMA_CHAT_MODEL: 'llama3.2:1b',
        CONTEXTPLUS_PREFLIGHT_TIMEOUT_MS: '500',
      },
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function runLauncherPreflight(host) {
  const isolatedPath = await mkdtemp(join(tmpdir(), 'contextplus-node-'));
  await copyFile(process.execPath, join(isolatedPath, 'node.exe'));
  try {
    return await new Promise((resolve, reject) => {
      const powershell = join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      const child = spawn(powershell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', launcherScript, '-PreflightOnly'], {
        cwd: root,
        env: {
          ...process.env,
          PATH: isolatedPath,
          USERPROFILE: join(root, '.contextplus-test-profile'),
          OLLAMA_HOST: host,
          OLLAMA_EMBED_MODEL: 'nomic-embed-text',
          OLLAMA_CHAT_MODEL: 'llama3.2:1b',
          CONTEXTPLUS_PREFLIGHT_TIMEOUT_MS: '500',
        },
        windowsHide: true,
      });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
      child.once('error', reject);
      child.once('close', (code) => resolve({ code, stdout, stderr }));
    });
  } finally {
    await rm(isolatedPath, { recursive: true, force: true });
  }
}

test('reports an unavailable Ollama endpoint before ContextPlus starts', async () => {
  const result = await runHealth(await unusedLocalHost());
  assert.equal(result.code, 2);
  assert.match(result.stderr, /ContextPlus semantic tools unavailable/);
  assert.match(result.stderr, /OLLAMA_HOST/);
});

test('reports every model required by ContextPlus that is missing', async () => {
  const ollama = await localOllama(['nomic-embed-text:latest']);
  try {
    const result = await runHealth(ollama.host);
    assert.equal(result.code, 3);
    assert.match(result.stderr, /llama3\.2:1b/);
    assert.doesNotMatch(result.stderr, /Missing Ollama models:.*nomic-embed-text/);
  } finally { await ollama.close(); }
});

test('accepts tagged Ollama models and reports a ready semantic runtime', async () => {
  const ollama = await localOllama(['nomic-embed-text:latest', 'llama3.2:1b']);
  try {
    const result = await runHealth(ollama.host);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /ContextPlus semantic runtime ready/);
  } finally { await ollama.close(); }
});

test('the ContextPlus launcher keeps successful dependency preflight off MCP stdout', async () => {
  const ollama = await localOllama(['nomic-embed-text:latest', 'llama3.2:1b']);
  try {
    const result = await runLauncherPreflight(ollama.host);
    assert.equal(result.code, 0);
    assert.equal(result.stdout, '');
  } finally { await ollama.close(); }
});
