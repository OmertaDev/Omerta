#!/usr/bin/env node
// OMERTA repository knowledge plane.
//
// This complements tools/graph.js. The existing graph is deliberately narrow and deep: it traces
// balance levers, ledger reasons, invariant checks and named precedents. This plane is broad: it
// inventories the whole repository and Git history, then connects artifacts, modules, routes,
// tables, contracts, tests, documentation, workflows, commits and GitHub pull requests.
//
// The output is deterministic for a given worktree + knowledge/github-snapshot.json. Every node
// carries provenance and a version, every edge resolves, and anything we cannot classify remains an
// Artifact instead of disappearing. Generated files are committed because they are the browsable
// knowledge base the team asked for; `node tools/knowledge.js check` detects drift.
//
// Usage:
//   node tools/knowledge.js build
//   node tools/knowledge.js check
//   node tools/knowledge.js stats
//   node tools/knowledge.js query <term>
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const OUT = path.join(ROOT, 'knowledge', 'generated');
const GENERATED = [
  'graph.json',
  'graph.mmd',
  'graph-summary.md',
  'inventory.md',
  'modules.md',
  'routes.md',
  'schema.md',
  'contracts.md',
  'documents.md',
  'github-history.md',
];
const IGNORE_PREFIXES = [
  '.git/', 'node_modules/', '.audit/', '.codex/', '.impeccable/', '.mcp_data/',
  'knowledge/generated/', 'omerta-contracts/lib/', 'omerta-contracts/out/',
  'omerta-contracts/cache/',
];
const TEXT_EXT = new Set([
  '', '.cjs', '.css', '.env', '.html', '.js', '.json', '.jsx', '.md', '.mjs', '.sh',
  '.sol', '.sql', '.svg', '.toml', '.txt', '.yaml', '.yml',
]);

const posix = (p) => p.replaceAll('\\', '/').replace(/^\.\//, '');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
const md = (s) => String(s ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const anchor = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const lineAt = (text, index) => text.slice(0, index).split('\n').length;
const uniq = (xs) => [...new Set(xs)];

function git(args, fallback = '') {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  } catch {
    return fallback;
  }
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8').replaceAll('\r\n', '\n');
}

function fileList() {
  return git(['ls-files', '-co', '--exclude-standard', '-z'])
    .split('\0').filter(Boolean).map(posix)
    .filter((f) => !IGNORE_PREFIXES.some((prefix) => f.startsWith(prefix)))
    .filter((f) => fs.existsSync(path.join(ROOT, f)))
    .sort();
}

function blobVersions() {
  const out = new Map();
  for (const line of git(['ls-files', '-s']).split(/\r?\n/)) {
    const m = line.match(/^\d+\s+([0-9a-f]+)\s+\d+\t(.+)$/);
    if (m) out.set(posix(m[2]), m[1].slice(0, 16));
  }
  return out;
}

function classify(rel) {
  const ext = path.extname(rel).toLowerCase();
  if (rel.startsWith('knowledge/')) return 'knowledge-base';
  if (rel === 'schema.sql') return 'data-schema';
  if (rel.startsWith('src/routes/')) return 'route-module';
  if (rel.startsWith('src/social/')) return 'backend-module';
  if (rel.startsWith('src/') && ext === '.js') return 'backend-module';
  if (rel.startsWith('test/') && ext === '.js') return 'test-suite';
  if (rel.startsWith('tools/')) return 'engineering-harness';
  if (rel.startsWith('omerta-contracts/src/')) return 'contract-source';
  if (rel.startsWith('omerta-contracts/test/')) return 'contract-test';
  if (rel.startsWith('omerta-contracts/')) return 'contract-project';
  if (rel.startsWith('omerta-mcp/')) return 'agent-interface';
  if (rel.startsWith('.github/workflows/')) return 'workflow';
  if (rel.startsWith('public/art/') || rel.startsWith('brand/') || rel.startsWith('art/')) return 'media-asset';
  if (rel.startsWith('public/')) return 'web-surface';
  if (/^AUDIT.*\.md$/i.test(rel) || rel === 'docs/AUDITS.md') return 'audit';
  if (/design\.md$/i.test(rel) || rel === 'DESIGN.md') return 'design';
  if (/^(DEPLOY|CHAIN-DEPLOY|DEPLOY-CHECKLIST|LAUNCH|LAUNCH-NIGHT|LAUNCH-READINESS)\.md$/.test(rel)
      || ['render.yaml', 'Procfile', '.env.example'].includes(rel) || rel.startsWith('deploy/')) return 'operations';
  if (ext === '.md') return 'documentation';
  if (['package.json', 'package-lock.json', '.nvmrc'].includes(rel)) return 'package-config';
  return 'artifact';
}

const SUBSYSTEMS = {
  backend: 'Fastify API, domain services, transaction spine and background worker',
  database: 'PostgreSQL schema, migrations, ledgers and persistence',
  web: 'Static browser console, admin, wiki, arena, play and public share surfaces',
  contracts: 'Foundry/Solidity protocol and its tests',
  agents: 'Agent onboarding, OpenAPI discovery and the omerta-mcp package',
  quality: 'Tests, audits, simulations, checks and engineering harnesses',
  operations: 'Render, CI/CD, deployment, monitoring, backup and launch controls',
  documentation: 'Specifications, designs, decisions, audits, research and this knowledge base',
};

const DOMAINS = {
  'platform-core': 'Auth, server, database, rules, transaction boundaries, rate limits and idempotency',
  'economy-ledger': 'Cash/$OMR movement, market, taxes, treasury, exchange, emissions and invariants',
  'social-combat': 'Characters, crews/families, streets, contracts, PvP, heists and relationships',
  'world-progression': 'Progression, skills, events, population, discovery, standing and world state',
  'enterprise-logistics': 'Businesses, rackets, territory, convoys, port, shipments, loans and assets',
  'vice-competition': 'Casino, ring poker, racing, boxing, speakeasy and competitive ladders',
  'law-intelligence': 'Law/RICO, the Pen, wire, secrets, dossiers and counter-intelligence',
  'chain-economy': 'Wallets, vouchers, fees, watcher, NFTs, deeds, bonds, DEX and bank protocol',
  'engagement-growth': 'Onboarding, coach, retention, community, referrals, push and public discovery',
  'client-experience': 'Browser console, public pages, art, accessibility and PWA surfaces',
  'agent-experience': 'MCP, OpenAPI, rules/opportunity surfaces and machine-player onboarding',
  'delivery-assurance': 'Tests, invariants, audits, CI, deployment, observability and recovery',
};

const DOMAIN_MODULES = {
  'platform-core': new Set(['auth','db','dbhealth','game','ratelimit','router','rules','rules.generated','rules.tail','server','sol','preflight','ops']),
  'economy-ledger': new Set(['economy','emission','exchange','fees','fairness','invariants','market','memo','router','tax','tokenhealth','treasury','vig','portfolio','stockdeliver','dexbot']),
  'social-combat': new Set(['crew','duels','firstblood','heists','honor','made','marriage','mentor','rivals','roster','soldiers','social','streets','vouch']),
  'world-progression': new Set(['citymap','citywide','day','discovery','events','explore','firsts','landmarks','mastery','notoriety','npcwar','population','season','skills','sov','standing','streak','underworld','world']),
  'enterprise-logistics': new Set(['convoy','deeds','estate','loans','market','megaproject','payroll','port','shipment','territory','business','garage']),
  'vice-competition': new Set(['casino','boxing','races','ring','speakeasy','stable']),
  'law-intelligence': new Set(['collection','law','pen','secrets','wire']),
  'chain-economy': new Set(['chain','deeds','dexbot','dynasty','fees','nft','stockdeliver','tokenhealth','treasury','vig','walletforge','watcher']),
  'engagement-growth': new Set(['activity','bulletin','career','circle','collision','community','contacts','dispatch','drop','engagement','favors','growth','home','opportunities','people','portrait','primetime','push','results','social','vanity']),
};

function moduleStem(rel) {
  return path.posix.basename(rel, path.posix.extname(rel));
}

function domainFor(rel) {
  if (rel.startsWith('public/')) return 'client-experience';
  if (rel.startsWith('omerta-mcp/') || rel === 'AGENTS.md') return 'agent-experience';
  if (rel.startsWith('omerta-contracts/')) return 'chain-economy';
  if (rel.startsWith('test/') || rel.startsWith('tools/') || rel.startsWith('.github/') || /^AUDIT/.test(rel)) return 'delivery-assurance';
  const stem = moduleStem(rel);
  for (const [domain, names] of Object.entries(DOMAIN_MODULES)) if (names.has(stem)) return domain;
  if (rel.startsWith('src/')) return 'platform-core';
  return null;
}

function subsystemFor(kind) {
  if (['backend-module','route-module'].includes(kind)) return 'backend';
  if (kind === 'data-schema') return 'database';
  if (['web-surface','media-asset'].includes(kind)) return 'web';
  if (kind.startsWith('contract')) return 'contracts';
  if (kind === 'agent-interface') return 'agents';
  if (['test-suite','engineering-harness','audit'].includes(kind)) return 'quality';
  if (['workflow','operations'].includes(kind)) return 'operations';
  return 'documentation';
}

function relativeImport(from, spec, files) {
  if (!spec.startsWith('.')) return null;
  const base = posix(path.posix.normalize(path.posix.join(path.posix.dirname(from), spec)));
  for (const candidate of [base, `${base}.js`, `${base}.json`, `${base}/index.js`]) {
    if (files.has(candidate)) return candidate;
  }
  return null;
}

function parseCommits(revision = 'HEAD') {
  const raw = git(['log', '--date=iso-strict', '--pretty=format:%x1e%H%x1f%ad%x1f%an%x1f%s', '--name-only', revision]);
  const commits = [];
  for (const chunk of raw.split('\x1e').filter(Boolean)) {
    const lines = chunk.replace(/^\r?\n/, '').split(/\r?\n/);
    const [hash, date, author, ...subjectParts] = (lines.shift() || '').split('\x1f');
    if (!hash) continue;
    commits.push({ hash, date, author, subject: subjectParts.join('\x1f'), files: lines.map(posix).filter(Boolean) });
  }
  return commits;
}

function build(options = {}) {
  const paths = fileList();
  const fileSet = new Set(paths);
  const blobs = blobVersions();
  const head = options.sourceRevision || git(['rev-parse', 'HEAD']).trim();
  const currentBranch = git(['branch', '--show-current']).trim() || '(detached)';
  const status = git(['status', '--porcelain=v1']).split(/\r?\n/).filter(Boolean);
  const worktreeDirty = typeof options.worktreeDirty === 'boolean' ? options.worktreeDirty : status.length > 0;
  const githubPath = 'knowledge/github-snapshot.json';
  const github = fileSet.has(githubPath) ? JSON.parse(read(githubPath)) : { repository: {}, issues: [], pullRequests: [] };
  const nodes = new Map();
  const edges = [];
  const edgeKeys = new Set();
  const textCache = new Map();
  const artifacts = [];

  const node = (type, id, props = {}, provenance = null) => {
    const key = `${type}:${id}`;
    if (!nodes.has(key)) nodes.set(key, { key, type, id, label: props.label || id, ...props, provenance: [] });
    const n = nodes.get(key);
    Object.assign(n, props);
    if (provenance && !n.provenance.some((p) => JSON.stringify(p) === JSON.stringify(provenance))) n.provenance.push(provenance);
    return n;
  };
  const edge = (type, from, to, provenance = null, props = {}) => {
    const key = `${type}\0${from}\0${to}\0${provenance?.file || ''}\0${provenance?.line || ''}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ type, from, to, ...props, ...(provenance ? { provenance } : {}) });
  };

  node('Repository', 'omerta', {
    label: github.repository?.fullName || 'OmertaDev/Omerta',
    revision: head,
    currentBranch,
    defaultBranch: github.repository?.defaultBranch || 'main',
    visibility: github.repository?.visibility || 'unknown',
    worktreeDirty,
    currentArtifactCount: paths.length,
  }, { file: 'README.md', line: 1 });
  for (const [id, description] of Object.entries(SUBSYSTEMS)) {
    node('Subsystem', id, { label: id.replaceAll('-', ' '), description }, { file: 'knowledge/README.md', line: 1 });
    edge('CONTAINS', 'Repository:omerta', `Subsystem:${id}`);
  }
  for (const [id, description] of Object.entries(DOMAINS)) {
    node('Domain', id, { label: id.replaceAll('-', ' '), description }, { file: 'knowledge/domains.md', line: 1 });
    const subsystem = id === 'client-experience' ? 'web' : id === 'agent-experience' ? 'agents'
      : id === 'delivery-assurance' ? 'quality' : id === 'chain-economy' ? 'contracts' : 'backend';
    edge('CONTAINS', `Subsystem:${subsystem}`, `Domain:${id}`);
  }

  for (const rel of paths) {
    const full = path.join(ROOT, rel);
    const stat = fs.statSync(full);
    if (!stat.isFile()) continue;
    const ext = path.extname(rel).toLowerCase();
    const isText = TEXT_EXT.has(ext) && stat.size < 20 * 1024 * 1024;
    let text = '';
    if (isText) {
      try { text = read(rel); textCache.set(rel, text); } catch { text = ''; }
    }
    const kind = classify(rel);
    const version = text ? sha(text) : (blobs.get(rel) || sha(`${rel}:${stat.size}`));
    const lines = text ? text.split('\n').length : null;
    const n = node('Artifact', rel, {
      label: path.posix.basename(rel), path: rel, kind, extension: ext || '(none)',
      bytes: text ? Buffer.byteLength(text, 'utf8') : stat.size, lines, version, text: !!text,
    }, { file: rel, line: 1, version });
    artifacts.push(n);
    edge('CONTAINS', `Subsystem:${subsystemFor(kind)}`, n.key, { file: rel, line: 1 });
    const domain = domainFor(rel);
    if (domain) edge('BELONGS_TO', n.key, `Domain:${domain}`, { file: rel, line: 1 });
    if (kind === 'backend-module' || kind === 'route-module') {
      node('Module', rel, { label: rel, lines, version }, { file: rel, line: 1, version });
      edge('REPRESENTS', `Module:${rel}`, n.key, { file: rel, line: 1 });
    }
    if (kind === 'test-suite' || kind === 'contract-test') {
      node('TestSuite', rel, { label: rel, lines, version }, { file: rel, line: 1, version });
      edge('REPRESENTS', `TestSuite:${rel}`, n.key, { file: rel, line: 1 });
    }
    if (kind === 'workflow') {
      node('Workflow', rel, { label: rel, lines, version }, { file: rel, line: 1, version });
      edge('REPRESENTS', `Workflow:${rel}`, n.key, { file: rel, line: 1 });
    }
    if (kind === 'design') {
      node('Document', rel, { label: rel, documentType: 'design', lines, version }, { file: rel, line: 1, version });
      edge('REPRESENTS', `Document:${rel}`, n.key, { file: rel, line: 1 });
    }
    if (kind === 'audit') {
      node('Document', rel, { label: rel, documentType: 'audit', lines, version }, { file: rel, line: 1, version });
      edge('REPRESENTS', `Document:${rel}`, n.key, { file: rel, line: 1 });
    }
    if (ext === '.md' && !['design','audit'].includes(kind)) {
      node('Document', rel, { label: rel, documentType: kind, lines, version }, { file: rel, line: 1, version });
      edge('REPRESENTS', `Document:${rel}`, n.key, { file: rel, line: 1 });
    }
  }

  // Module and package dependencies.
  const importers = new Map();
  const imports = new Map();
  for (const [rel, text] of textCache) {
    if (!['.js','.mjs','.cjs'].includes(path.extname(rel))) continue;
    const specs = [];
    for (const m of text.matchAll(/\b(?:import|export)\s+(?:[^'"\n]*?\s+from\s+)?['"]([^'"]+)['"]/g)) specs.push([m[1], m.index]);
    for (const m of text.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) specs.push([m[1], m.index]);
    for (const [spec, index] of specs) {
      const target = relativeImport(rel, spec, fileSet);
      if (target) {
        edge('IMPORTS', `Artifact:${rel}`, `Artifact:${target}`, { file: rel, line: lineAt(text, index) });
        (imports.get(rel) || imports.set(rel, new Set()).get(rel)).add(target);
        (importers.get(target) || importers.set(target, new Set()).get(target)).add(rel);
        if (rel.startsWith('test/') && target.startsWith('src/')) edge('TESTS', `Artifact:${rel}`, `Artifact:${target}`, { file: rel, line: lineAt(text, index) });
      } else if (!spec.startsWith('.') && !spec.startsWith('node:')) {
        node('ExternalDependency', spec, { label: spec }, { file: rel, line: lineAt(text, index) });
        edge('IMPORTS', `Artifact:${rel}`, `ExternalDependency:${spec}`, { file: rel, line: lineAt(text, index) });
      }
    }
  }

  // HTTP routes, their access mode and the first namespaced handler called from each registration.
  const routes = [];
  for (const [rel, text] of textCache) {
    if (!(rel === 'src/server.js' || rel.startsWith('src/routes/'))) continue;
    const aliases = new Map();
    for (const m of text.matchAll(/import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g)) {
      const target = relativeImport(rel, m[2], fileSet);
      if (target) aliases.set(m[1], target);
    }
    const matches = [...text.matchAll(/\bapp\.(get|post|put|patch|delete|options|head)\(\s*(['"])([^'"]+)\2/g)];
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i];
      const method = m[1].toUpperCase();
      const url = m[3];
      const line = lineAt(text, m.index);
      const end = matches[i + 1]?.index ?? Math.min(text.length, m.index + 2400);
      const snippet = text.slice(m.index, Math.min(end, m.index + 2400));
      const access = /preHandler:\s*modAuth/.test(snippet) ? 'moderator'
        : /preHandler:\s*auth/.test(snippet) ? 'authenticated'
        : /websocket:\s*true/.test(snippet) ? 'token-query'
        : 'public';
      const routeId = `${method} ${url}`;
      const handlerMatches = [...snippet.matchAll(/\b([A-Z][A-Za-z0-9_]*)\.([A-Za-z_$][\w$]*)\s*\(/g)];
      const handlerMatch = handlerMatches.find((x) => aliases.has(x[1]) && !/\/(?:game|rules)\.js$/.test(aliases.get(x[1])))
        || handlerMatches.find((x) => aliases.has(x[1])) || null;
      const handlerFile = handlerMatch ? aliases.get(handlerMatch[1]) : null;
      const domain = url.startsWith('/v1/auth') ? 'platform-core'
        : url.startsWith('/v1/wallet') || url.startsWith('/v1/withdraw') || url.startsWith('/v1/gear') ? 'chain-economy'
        : url.startsWith('/v1/casino') || url.startsWith('/v1/races') || url.startsWith('/v1/boxing') || url.startsWith('/v1/speakeasy') ? 'vice-competition'
        : url.startsWith('/v1/law') || url.startsWith('/v1/pen') || url.startsWith('/v1/wire') ? 'law-intelligence'
        : url.startsWith('/v1/opportunities') || url.startsWith('/v1/discovery') || url.startsWith('/v1/coach') ? 'engagement-growth'
        : url.startsWith('/v1') ? domainFor(handlerFile || rel) || 'platform-core' : 'client-experience';
      const handler = handlerMatch ? `${handlerMatch[1]}.${handlerMatch[2]}` : null;
      const n = node('Route', routeId, { label: routeId, method, url, access, domain, definitions: [] }, { file: rel, line });
      n.definitions.push({ file: rel, line });
      edge('DEFINED_IN', n.key, `Artifact:${rel}`, { file: rel, line });
      edge('BELONGS_TO', n.key, `Domain:${domain}`, { file: rel, line });
      if (handlerFile) edge('HANDLED_BY', n.key, `Artifact:${handlerFile}`, { file: rel, line }, { symbol: handler });
      routes.push({ method, url, access, domain, file: rel, line, handler });
    }
  }

  // Database tables and all source modules that name them in SQL or query construction.
  const tables = [];
  if (textCache.has('schema.sql')) {
    const schema = textCache.get('schema.sql');
    const tableById = new Map();
    for (const m of schema.matchAll(/^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gmi)) {
      const id = m[1].toLowerCase();
      const line = lineAt(schema, m.index);
      const table = node('Table', id, { label: id, definitions: [] }, { file: 'schema.sql', line });
      table.definitions.push({ file: 'schema.sql', line });
      edge('DEFINED_IN', `Table:${id}`, 'Artifact:schema.sql', { file: 'schema.sql', line });
      if (!tableById.has(id)) {
        const entry = { id, line, definitions: [], modules: [] };
        tableById.set(id, entry);
        tables.push(entry);
      }
      tableById.get(id).definitions.push(line);
    }
    const tableRe = new RegExp(`\\b(${tables.map((t) => esc(t.id)).sort((a,b)=>b.length-a.length).join('|')})\\b`, 'gi');
    for (const [rel, text] of textCache) {
      if (!rel.startsWith('src/') || !rel.endsWith('.js')) continue;
      const seen = new Set();
      for (const m of text.matchAll(tableRe)) {
        const id = m[1].toLowerCase();
        if (seen.has(id)) continue;
        seen.add(id);
        tableById.get(id)?.modules.push(rel);
        edge('USES_TABLE', `Artifact:${rel}`, `Table:${id}`, { file: rel, line: lineAt(text, m.index) });
      }
    }
  }

  // Solidity declarations, inheritance and imports.
  const contracts = [];
  for (const [rel, text] of textCache) {
    if (!rel.startsWith('omerta-contracts/src/') || !rel.endsWith('.sol')) continue;
    for (const m of text.matchAll(/^\s*(abstract\s+contract|contract|interface|library)\s+([A-Za-z_]\w*)(?:\s+is\s+([^\{]+))?/gm)) {
      const kind = m[1];
      const name = m[2];
      const bases = (m[3] || '').split(',').map((x) => x.trim().split(/\s+/)[0]).filter(Boolean);
      const line = lineAt(text, m.index);
      node('Contract', name, { label: name, contractKind: kind, file: rel, bases }, { file: rel, line });
      edge('DEFINED_IN', `Contract:${name}`, `Artifact:${rel}`, { file: rel, line });
      contracts.push({ name, kind, file: rel, line, bases });
    }
  }
  for (const c of contracts) for (const base of c.bases) if (nodes.has(`Contract:${base}`)) edge('INHERITS', `Contract:${c.name}`, `Contract:${base}`, { file: c.file, line: c.line });

  // Package scripts are executable entry points in the knowledge graph.
  if (textCache.has('package.json')) {
    const pkg = JSON.parse(textCache.get('package.json'));
    for (const [name, command] of Object.entries(pkg.scripts || {})) {
      node('Command', `npm:${name}`, { label: `npm run ${name}`, command }, { file: 'package.json', line: 1 });
      edge('DECLARES', 'Artifact:package.json', `Command:npm:${name}`, { file: 'package.json', line: 1 });
      for (const m of command.matchAll(/(?:node|bash)\s+([^\s"']+)/g)) {
        const target = posix(m[1]);
        if (fileSet.has(target)) edge('EXECUTES', `Command:npm:${name}`, `Artifact:${target}`, { file: 'package.json', line: 1 });
      }
    }
  }

  // Documentation links and backticked repository paths.
  for (const [rel, text] of textCache) {
    if (!rel.endsWith('.md')) continue;
    const refs = [];
    for (const m of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]+)?\)/g)) refs.push([m[1], m.index]);
    for (const m of text.matchAll(/`((?:src|test|tools|docs|public|omerta-contracts|omerta-mcp|knowledge|\.github)\/[^`\s]+)`/g)) refs.push([m[1].replace(/[.,;:]$/, ''), m.index]);
    for (const [raw, index] of refs) {
      if (/^[a-z]+:\/\//i.test(raw)) continue;
      const decoded = decodeURIComponent(raw).replace(/^\.\//, '');
      const local = posix(path.posix.normalize(path.posix.join(path.posix.dirname(rel), decoded)));
      const target = fileSet.has(local) ? local : fileSet.has(decoded) ? decoded : null;
      if (target) edge('REFERENCES', `Artifact:${rel}`, `Artifact:${target}`, { file: rel, line: lineAt(text, index) });
    }
  }

  // GitHub issues/PRs from the explicit connector snapshot.
  for (const issue of github.issues || []) {
    node('Issue', String(issue.number), { label: `#${issue.number} ${issue.title}`, ...issue }, { url: issue.url });
    edge('TRACKS', 'Repository:omerta', `Issue:${issue.number}`, { url: issue.url });
  }
  for (const pr of github.pullRequests || []) {
    node('PullRequest', String(pr.number), { label: `#${pr.number} ${pr.title}`, ...pr }, { url: pr.url });
    edge('TRACKS', 'Repository:omerta', `PullRequest:${pr.number}`, { url: pr.url });
  }

  // Full local commit history and current/historical artifact lineage.
  const commits = parseCommits(head);
  const lastChanged = new Map();
  for (const commit of commits) {
    const url = `https://github.com/OmertaDev/Omerta/commit/${commit.hash}`;
    node('Commit', commit.hash, { label: commit.subject, title: commit.subject, date: commit.date, author: commit.author, url }, { commit: commit.hash, url });
    edge('HAS_COMMIT', 'Repository:omerta', `Commit:${commit.hash}`, { commit: commit.hash });
    const prMatch = commit.subject.match(/(?:Merge pull request|Merge PR) #(\d+)|\(#(\d+)\)/i);
    const pr = prMatch ? (prMatch[1] || prMatch[2]) : null;
    if (pr && nodes.has(`PullRequest:${pr}`)) edge('IMPLEMENTS', `Commit:${commit.hash}`, `PullRequest:${pr}`, { commit: commit.hash });
    for (const changed of commit.files) {
      if (!lastChanged.has(changed)) lastChanged.set(changed, commit);
      let target = `Artifact:${changed}`;
      if (!nodes.has(target)) {
        node('HistoricalArtifact', changed, { label: changed, path: changed }, { commit: commit.hash });
        target = `HistoricalArtifact:${changed}`;
      }
      edge('CHANGED', `Commit:${commit.hash}`, target, { commit: commit.hash });
    }
  }
  for (const artifact of artifacts) {
    const last = lastChanged.get(artifact.path);
    if (last) {
      artifact.lastChangedAt = last.date;
      artifact.lastChangedBy = last.author;
      artifact.lastChangedCommit = last.hash;
    }
  }

  // Domain-to-domain dependencies are aggregated from file import edges.
  const artifactDomain = new Map();
  for (const e of edges.filter((x) => x.type === 'BELONGS_TO' && x.from.startsWith('Artifact:'))) artifactDomain.set(e.from, e.to);
  const domainDeps = new Map();
  for (const e of edges.filter((x) => x.type === 'IMPORTS' && x.to.startsWith('Artifact:'))) {
    const from = artifactDomain.get(e.from), to = artifactDomain.get(e.to);
    if (!from || !to || from === to) continue;
    const key = `${from}\0${to}`;
    domainDeps.set(key, (domainDeps.get(key) || 0) + 1);
  }
  for (const [key, weight] of domainDeps) {
    const [from, to] = key.split('\0');
    edge('DEPENDS_ON', from, to, null, { weight });
  }

  const sortedNodes = [...nodes.values()].map((n) => ({ ...n, provenance: n.provenance.sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) }))
    .sort((a,b) => a.key.localeCompare(b.key));
  const sortedEdges = edges.sort((a,b) => `${a.type}:${a.from}:${a.to}:${JSON.stringify(a.provenance||{})}`.localeCompare(`${b.type}:${b.from}:${b.to}:${JSON.stringify(b.provenance||{})}`));
  const byType = (items, key) => Object.fromEntries(Object.entries(items.reduce((a,x) => ((a[x[key]]=(a[x[key]]||0)+1),a),{})).sort());
  const graph = {
    schema: 'omerta.knowledge-graph.v1',
    sourceRevision: head,
    worktreeDirty,
    sourceSnapshot: github.fetchedAt || null,
    ontology: {
      nodeTypes: uniq(sortedNodes.map((n) => n.type)),
      edgeTypes: uniq(sortedEdges.map((e) => e.type)),
    },
    census: { nodes: sortedNodes.length, edges: sortedEdges.length, byNodeType: byType(sortedNodes, 'type'), byEdgeType: byType(sortedEdges, 'type') },
    nodes: sortedNodes,
    edges: sortedEdges,
  };

  return { graph, artifacts, imports, importers, routes, tables, contracts, commits, github, lastChanged, status };
}

function buildForCheck() {
  const graphFile = path.join(OUT, 'graph.json');
  if (!fs.existsSync(graphFile)) return build();
  try {
    const stored = JSON.parse(fs.readFileSync(graphFile, 'utf8'));
    if (!/^[0-9a-f]{40}$/.test(stored.sourceRevision || '')) return build();
    return build({ sourceRevision: stored.sourceRevision, worktreeDirty: stored.worktreeDirty === true });
  } catch {
    return build();
  }
}

function validate(model) {
  const { graph } = model;
  const problems = [];
  const keys = new Set(graph.nodes.map((n) => n.key));
  if (keys.size !== graph.nodes.length) problems.push('duplicate node keys');
  const dangling = graph.edges.filter((e) => !keys.has(e.from) || !keys.has(e.to));
  if (dangling.length) problems.push(`${dangling.length} dangling edges (first: ${dangling[0].from} -> ${dangling[0].to})`);
  const noProv = graph.nodes.filter((n) => !n.provenance?.length);
  if (noProv.length) problems.push(`${noProv.length} nodes have no provenance (first: ${noProv[0].key})`);
  const unversioned = graph.nodes.filter((n) => n.type === 'Artifact' && !n.version);
  if (unversioned.length) problems.push(`${unversioned.length} artifacts have no version`);
  if (!model.routes.length) problems.push('no HTTP routes extracted');
  if (!model.tables.length) problems.push('no database tables extracted');
  if (!model.contracts.length) problems.push('no Solidity contracts extracted');
  if (!model.commits.length) problems.push('no Git history extracted');
  if (!(model.github.pullRequests || []).length) problems.push('GitHub snapshot has no pull requests');
  return { ok: problems.length === 0, problems };
}

function render(model) {
  const { graph, artifacts, imports, importers, routes, tables, contracts, commits, github, lastChanged } = model;
  const byKind = Object.entries(artifacts.reduce((a,x)=>((a[x.kind]=(a[x.kind]||0)+1),a),{})).sort((a,b)=>b[1]-a[1]);
  const textArtifacts = artifacts.filter((a) => a.lines != null);
  const totalLines = textArtifacts.reduce((a,x)=>a+x.lines,0);
  const totalBytes = artifacts.reduce((a,x)=>a+x.bytes,0);
  const largest = [...textArtifacts].sort((a,b)=>b.lines-a.lines).slice(0,30);
  const media = artifacts.filter((a)=>a.kind==='media-asset');
  const mediaByExt = Object.entries(media.reduce((a,x)=>{const k=x.extension;(a[k]||={count:0,bytes:0});a[k].count++;a[k].bytes+=x.bytes;return a;},{})).sort((a,b)=>b[1].bytes-a[1].bytes);
  const head = graph.sourceRevision;
  const currentModules = artifacts.filter((a)=>['backend-module','route-module'].includes(a.kind)).sort((a,b)=>a.path.localeCompare(b.path));
  const testsByTarget = new Map();
  for (const e of graph.edges.filter((x)=>x.type==='TESTS')) (testsByTarget.get(e.to.slice(9)) || testsByTarget.set(e.to.slice(9),[]).get(e.to.slice(9))).push(e.from.slice(9));

  const inventory = `# Generated repository inventory\n\n> Source: worktree at \`${head.slice(0,12)}\`. Rebuild with \`npm run knowledge\`. Do not edit by hand.\n\n## Census\n\n| Measure | Count |\n|---|---:|\n| Current artifacts | ${artifacts.length.toLocaleString()} |\n| Text lines | ${totalLines.toLocaleString()} |\n| Repository bytes inventoried | ${totalBytes.toLocaleString()} |\n| Backend/route modules | ${currentModules.length.toLocaleString()} |\n| HTTP route registrations / unique routes | ${routes.length.toLocaleString()} / ${(graph.census.byNodeType.Route||0).toLocaleString()} |\n| Database tables | ${tables.length.toLocaleString()} |\n| Solidity declarations | ${contracts.length.toLocaleString()} |\n| Git commits | ${commits.length.toLocaleString()} |\n| GitHub pull requests in snapshot | ${(github.pullRequests||[]).length.toLocaleString()} |\n| GitHub issues in snapshot | ${(github.issues||[]).length.toLocaleString()} |\n| Graph nodes / edges | ${graph.census.nodes.toLocaleString()} / ${graph.census.edges.toLocaleString()} |\n\n## Artifact kinds\n\n| Kind | Files |\n|---|---:|\n${byKind.map(([k,v])=>`| ${k} | ${v.toLocaleString()} |`).join('\n')}\n\n## Largest text artifacts\n\n| File | Lines | Kind | Last change |\n|---|---:|---|---|\n${largest.map((x)=>`| [${md(x.path)}](../../${x.path}) | ${x.lines.toLocaleString()} | ${x.kind} | ${x.lastChangedAt?.slice(0,10)||'uncommitted'} |`).join('\n')}\n\n## Media estate\n\n| Extension | Files | Bytes |\n|---|---:|---:|\n${mediaByExt.map(([k,v])=>`| ${k} | ${v.count.toLocaleString()} | ${v.bytes.toLocaleString()} |`).join('\n')}\n`;

  const moduleRows = currentModules.map((m)=>{
    const ins = imports.get(m.path)?.size || 0;
    const outs = importers.get(m.path)?.size || 0;
    const domainEdge = graph.edges.find((e)=>e.type==='BELONGS_TO'&&e.from===`Artifact:${m.path}`);
    const ts = testsByTarget.get(m.path) || [];
    const routeCount = routes.filter((r)=>r.file===m.path || graph.edges.some((e)=>e.type==='HANDLED_BY'&&e.from===`Route:${r.method} ${r.url}`&&e.to===`Artifact:${m.path}`)).length;
    const tableCount = graph.edges.filter((e)=>e.type==='USES_TABLE'&&e.from===`Artifact:${m.path}`).length;
    return `| [${m.path}](../../${m.path}) | ${m.lines} | ${domainEdge?.to.slice(7)||'—'} | ${ins} / ${outs} | ${routeCount} | ${tableCount} | ${ts.length} |`;
  });
  const modulesMd = `# Generated backend module map\n\n> Import counts are outgoing / incoming. Route and table counts are structurally extracted leads, not runtime coverage claims.\n\n| Module | Lines | Domain | Imports | Routes | Tables | Direct test imports |\n|---|---:|---|---:|---:|---:|---:|\n${moduleRows.join('\n')}\n`;

  const routeGroups = Object.entries(routes.reduce((a,r)=>{const seg=r.url.startsWith('/v1/')?(r.url.split('/')[2]||'v1'):'web';(a[seg]||=[]).push(r);return a;},{})).sort((a,b)=>b[1].length-a[1].length);
  const routesMd = `# Generated HTTP route catalog\n\n> ${routes.length} literal registrations extracted from \`src/server.js\` and \`src/routes/\`. Runtime authority remains \`GET /openapi.json\`.\n\n## Route groups\n\n| Group | Routes |\n|---|---:|\n${routeGroups.map(([k,v])=>`| ${k} | ${v.length} |`).join('\n')}\n\n## Full catalog\n\n| Method | Path | Access | Domain | Definition | Handler |\n|---|---|---|---|---|---|\n${[...routes].sort((a,b)=>a.url.localeCompare(b.url)||a.method.localeCompare(b.method)).map((r)=>`| ${r.method} | \`${md(r.url)}\` | ${r.access} | ${r.domain} | [${r.file}:${r.line}](../../${r.file}#L${r.line}) | ${r.handler?`\`${r.handler}\``:'—'} |`).join('\n')}\n`;

  const schemaMd = `# Generated database catalog\n\n> ${tables.length} tables extracted from [schema.sql](../../schema.sql). “Used by” is an exact-name source scan; dynamic SQL may add relationships not visible here.\n\n| Table | Defined | Used by modules |\n|---|---:|---|\n${tables.sort((a,b)=>a.id.localeCompare(b.id)).map((t)=>`| \`${t.id}\` | [L${t.line}](../../schema.sql#L${t.line}) | ${t.modules.length ? t.modules.map((m)=>`[${m.replace(/^src\//,'')}](../../${m})`).join(', ') : '—'} |`).join('\n')}\n`;

  const contractsMd = `# Generated Solidity contract catalog\n\n> Declarations extracted from \`omerta-contracts/src\`. External inherited types remain names, not local graph nodes.\n\n| Declaration | Kind | Source | Inherits / implements |\n|---|---|---|---|\n${contracts.sort((a,b)=>a.name.localeCompare(b.name)).map((c)=>`| \`${c.name}\` | ${c.kind} | [${c.file}:${c.line}](../../${c.file}#L${c.line}) | ${c.bases.map((b)=>`\`${b}\``).join(', ')||'—'} |`).join('\n')}\n`;

  const docs = artifacts.filter((a)=>['knowledge-base','audit','design','documentation','operations'].includes(a.kind)&&a.extension==='.md').sort((a,b)=>a.path.localeCompare(b.path));
  const documentsMd = `# Generated document catalog\n\n> Read [../README.md](../README.md) for the source-priority rules. Audit and design documents are evidence and intent, not automatically current implementation truth.\n\n| Document | Type | Lines | Last changed |\n|---|---|---:|---|\n${docs.map((d)=>`| [${d.path}](../../${d.path}) | ${d.kind} | ${d.lines} | ${d.lastChangedAt?.slice(0,10)||'uncommitted'} |`).join('\n')}\n`;

  const authorCounts = Object.entries(commits.reduce((a,c)=>((a[c.author]=(a[c.author]||0)+1),a),{})).sort((a,b)=>b[1]-a[1]);
  const hotspotCounts = new Map();
  for (const c of commits) for (const f of c.files) hotspotCounts.set(f,(hotspotCounts.get(f)||0)+1);
  const hotspots = [...hotspotCounts].sort((a,b)=>b[1]-a[1]).slice(0,40);
  const merged = (github.pullRequests||[]).filter((p)=>p.merged).length;
  const open = (github.pullRequests||[]).filter((p)=>p.state==='open').length;
  const githubHistory = `# Generated GitHub and Git history\n\n> GitHub metadata snapshot: ${github.fetchedAt||'not available'}. Commit lineage is from the local clone at \`${head.slice(0,12)}\`.\n\n## Repository\n\n| Field | Value |\n|---|---|\n| Repository | [${github.repository?.fullName||'OmertaDev/Omerta'}](https://github.com/OmertaDev/Omerta) |\n| Visibility | ${github.repository?.visibility||'unknown'} |\n| Default branch | \`${github.repository?.defaultBranch||'main'}\` |\n| Commits in clone | ${commits.length} |\n| Pull requests | ${(github.pullRequests||[]).length} (${merged} merged, ${open} open) |\n| Issues returned | ${(github.issues||[]).length} |\n| First commit | ${commits.at(-1)?.date?.slice(0,10)||'—'} — ${md(commits.at(-1)?.subject||'—')} |\n| Latest commit | ${commits[0]?.date?.slice(0,10)||'—'} — ${md(commits[0]?.subject||'—')} |\n\n## Commit authors\n\n| Author identity | Commits |\n|---|---:|\n${authorCounts.map(([a,n])=>`| ${md(a)} | ${n} |`).join('\n')}\n\n## Historical hotspots\n\n| Path | Commits touching path | Current? |\n|---|---:|---|\n${hotspots.map(([f,n])=>`| ${model.artifacts.some((a)=>a.path===f)?`[${f}](../../${f})`:md(f)} | ${n} | ${model.artifacts.some((a)=>a.path===f)?'yes':'historical'} |`).join('\n')}\n\n## Pull requests\n\n| PR | State | Merged | Updated | Title |\n|---:|---|---|---|---|\n${(github.pullRequests||[]).map((p)=>`| [#${p.number}](${p.url}) | ${p.state} | ${p.merged?'yes':'no'} | ${p.updatedAt?.slice(0,10)||'—'} | ${md(p.title)} |`).join('\n')}\n`;

  const nodeRows = Object.entries(graph.census.byNodeType).map(([k,v])=>`| ${k} | ${v} |`).join('\n');
  const edgeRows = Object.entries(graph.census.byEdgeType).map(([k,v])=>`| ${k} | ${v} |`).join('\n');
  const graphSummary = `# Generated knowledge-graph summary\n\n> Machine-readable graph: [graph.json](graph.json). High-level diagram: [graph.mmd](graph.mmd). Specialized economy/precedent graph: [../../GRAPH.md](../../GRAPH.md).\n\n## Census\n\n${graph.census.nodes.toLocaleString()} nodes and ${graph.census.edges.toLocaleString()} edges at \`${head.slice(0,12)}\`.\n\n### Nodes\n\n| Type | Count |\n|---|---:|\n${nodeRows}\n\n### Edges\n\n| Type | Count |\n|---|---:|\n${edgeRows}\n\n## Provenance contract\n\n- Every node has at least one file, commit, or canonical URL source.\n- Every current artifact has a content or Git-blob version.\n- Every edge resolves to two present nodes.\n- Historical files remain addressable as \`HistoricalArtifact\` nodes.\n- The GitHub connector result is persisted in \`knowledge/github-snapshot.json\`; refresh it before rebuilding when GitHub state matters.\n`;

  const domainEdges = graph.edges.filter((e)=>e.type==='DEPENDS_ON').sort((a,b)=>(b.weight||0)-(a.weight||0));
  const graphMmd = `flowchart LR\n  repo["OMERTÀ repository"]\n${Object.keys(SUBSYSTEMS).map((s)=>`  sub_${anchor(s)}["${s}"]\n  repo --> sub_${anchor(s)}`).join('\n')}\n${Object.keys(DOMAINS).map((d)=>`  dom_${anchor(d)}["${d}"]`).join('\n')}\n${graph.edges.filter((e)=>e.type==='CONTAINS'&&e.from.startsWith('Subsystem:')&&e.to.startsWith('Domain:')).map((e)=>`  sub_${anchor(e.from.slice(10))} --> dom_${anchor(e.to.slice(7))}`).join('\n')}\n${domainEdges.map((e)=>`  dom_${anchor(e.from.slice(7))} -->|${e.weight}| dom_${anchor(e.to.slice(7))}`).join('\n')}\n`;

  return {
    'graph.json': `${JSON.stringify(graph, null, 2)}\n`,
    'graph.mmd': graphMmd,
    'graph-summary.md': graphSummary,
    'inventory.md': inventory,
    'modules.md': modulesMd,
    'routes.md': routesMd,
    'schema.md': schemaMd,
    'contracts.md': contractsMd,
    'documents.md': documentsMd,
    'github-history.md': githubHistory,
  };
}

function writeOutputs(outputs) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const name of GENERATED) fs.writeFileSync(path.join(OUT, name), outputs[name]);
}

function checkOutputs(outputs) {
  const drift = [];
  for (const name of GENERATED) {
    const file = path.join(OUT, name);
    const actual = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replaceAll('\r\n','\n') : null;
    if (actual !== outputs[name]) drift.push(name);
  }
  return drift;
}

function query(model, term) {
  const q = term.toLowerCase();
  const hits = model.graph.nodes.filter((n)=>`${n.key} ${n.label} ${n.path||''} ${n.title||''}`.toLowerCase().includes(q)).slice(0,50);
  for (const n of hits) {
    console.log(`\n${n.key} — ${n.label}`);
    for (const e of model.graph.edges.filter((x)=>x.from===n.key||x.to===n.key).slice(0,40)) console.log(`  ${e.from===n.key?'->':'<-'} ${e.type} ${e.from===n.key?e.to:e.from}`);
  }
  if (!hits.length) console.log(`no graph node matched '${term}'`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [command = 'build', ...args] = process.argv.slice(2);
  const model = command === 'check' ? buildForCheck() : build();
  const valid = validate(model);
  if (!valid.ok) {
    console.error('knowledge graph invalid');
    valid.problems.forEach((p)=>console.error(`  - ${p}`));
    process.exit(1);
  }
  const outputs = render(model);
  if (command === 'build') {
    writeOutputs(outputs);
    console.log(`knowledge base built — ${model.graph.census.nodes} nodes, ${model.graph.census.edges} edges`);
    console.log(`  ${model.artifacts.length} artifacts, ${model.routes.length} route registrations (${model.graph.census.byNodeType.Route} unique), ${model.tables.length} tables, ${model.contracts.length} Solidity declarations, ${model.commits.length} commits`);
  } else if (command === 'check') {
    const drift = checkOutputs(outputs);
    if (drift.length) {
      console.error(`knowledge base drift: ${drift.join(', ')}`);
      console.error('run: npm run knowledge');
      process.exit(1);
    }
    console.log(`knowledge base current — ${model.graph.census.nodes} nodes, ${model.graph.census.edges} edges; provenance and links valid`);
  } else if (command === 'stats') {
    console.log(JSON.stringify(model.graph.census, null, 2));
  } else if (command === 'query') {
    query(model, args.join(' '));
  } else {
    console.error('usage: knowledge.js build|check|stats|query <term>');
    process.exit(1);
  }
}

export { build, buildForCheck, validate, render };
