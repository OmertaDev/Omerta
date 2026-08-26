// ContextPlus dependency preflight. Keeps the MCP server from starting with
// semantic tools that cannot reach their required Ollama models.

const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434';
const DEFAULT_EMBED_MODEL = 'nomic-embed-text';
const DEFAULT_CHAT_MODEL = 'llama3.2:1b';
const DEFAULT_TIMEOUT_MS = 5_000;

function timeoutMs(value) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function tagsUrl(host) {
  return `${host.replace(/\/+$/, '')}/api/tags`;
}

function availableNames(payload) {
  if (!Array.isArray(payload?.models)) return [];
  return payload.models.flatMap((entry) => [entry?.name, entry?.model]).filter(Boolean);
}

function hasModel(available, required) {
  if (required.includes(':')) return available.includes(required);
  return available.some((candidate) => candidate === required || candidate.startsWith(`${required}:`));
}

async function main() {
  const quiet = process.argv.includes('--quiet');
  const host = process.env.OLLAMA_HOST || DEFAULT_OLLAMA_HOST;
  const required = [
    process.env.OLLAMA_EMBED_MODEL || DEFAULT_EMBED_MODEL,
    process.env.OLLAMA_CHAT_MODEL || DEFAULT_CHAT_MODEL,
  ];

  let payload;
  try {
    const response = await fetch(tagsUrl(host), {
      signal: AbortSignal.timeout(timeoutMs(process.env.CONTEXTPLUS_PREFLIGHT_TIMEOUT_MS)),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    payload = await response.json();
  } catch (error) {
    console.error(`ContextPlus semantic tools unavailable: cannot reach Ollama at ${host}.`);
    console.error('Set OLLAMA_HOST to a working Ollama endpoint or run tools/setup-contextplus.ps1.');
    console.error(`Provider error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
    return;
  }

  const available = availableNames(payload);
  const missing = required.filter((model) => !hasModel(available, model));
  if (missing.length > 0) {
    console.error(`Missing Ollama models: ${missing.join(', ')}`);
    console.error(`Install them with: ${missing.map((model) => `ollama pull ${model}`).join(' && ')}`);
    process.exitCode = 3;
    return;
  }

  if (!quiet) console.log(`ContextPlus semantic runtime ready at ${host}.`);
}

await main();
