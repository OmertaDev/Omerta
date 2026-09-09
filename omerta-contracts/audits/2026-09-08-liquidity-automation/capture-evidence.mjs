#!/usr/bin/env node
// Freeze public review inputs and exact artifacts. No RPC, database connection, signing or broadcast.
// --check reads only. --draft creates a new unsealed package. --seal is an explicit final action.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { keccak256, toHex } from 'viem';
import { loadReviewedArtifact } from '../../../tools/liquidity-deployment-plan.js';

const AUDIT = 'omerta-contracts/audits/2026-09-08-liquidity-automation';
const RAW = 'output/liquidity-automation';
const BASE = 'e1d0e8476b6f1ebf590b13bd07c072d9d9d33aee';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CONTRACTS = path.join(ROOT, 'omerta-contracts');
const TARGETS = ['FeeRevenueRouter', 'KeeperGasVault', 'OmertaFees', 'LiquidityBuybackExecutor',
  'ProtocolLiquidityVault', 'GenesisLifecycleController', 'BankBufferVault', 'OmertaBond',
  'OmertaHook', 'GenesisProceedsSplitter'];
const MANIFESTS = ['source-manifest.json', 'artifact-manifest.json', 'evidence-manifest.json', 'package-manifest.json'];
const sha = data => createHash('sha256').update(data).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const unix = value => value.replaceAll('\\', '/');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const within = (root, file) => { const r = path.relative(root, file); return r !== '..' && !r.startsWith(`..${path.sep}`) && !path.isAbsolute(r); };
const byPath = (a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
const treeHash = rows => sha(JSON.stringify(rows.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })).sort(byPath)));
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim();
const REQUIRED_SOURCE = [
  'src/keepertransactions.js', 'src/genesiskeeper.js', 'src/liquidityaccounting.js',
  'src/liquidityautomation.js', 'src/liquidityindexer.js', 'src/liquiditykeeper.js',
  'src/liquiditypolicy.js', 'src/liquidityqueue.js', 'src/liquiditystate.js',
  'src/bonds.js', 'src/chain.js', 'src/community.js', 'src/desk.js', 'src/dexbot.js',
  'src/fees.js', 'src/genesiscca.js', 'src/genesislaunch.js', 'src/genesisrelease.js',
  'src/preflight.js', 'src/router.js', 'src/server.js', 'src/vig.js', 'src/watcher.js',
  'src/worker.js', 'src/db.js', 'src/chainparams.js', 'src/v4oraclekeeper.js',
  'tools/liquidity-deployment-plan.js', 'tools/liquidity-e2e.js', 'tools/liquidity-keeper.js',
  'tools/liquidity-manifest-example.js', 'tools/genesis-launch-config.js',
  'tools/genesis-fork-rehearsal.js', 'tools/pgcheck.js', 'tools/pgquery.js',
  'tools/validate-fee-splits.js', 'tools/character-nft-preflight.js',
  'tools/character-nft-rehearsal.js', 'tools/knowledge.js', 'tools/knowledge-test.js',
  'test/keepertransactions.js', 'test/genesiskeeper.js', 'test/liquidityaccounting.js',
  'test/liquidityaccounting-review.js', 'test/liquidityindexer.js', 'test/liquiditykeeper.js',
  'test/liquiditypolicy.js', 'test/liquiditypolicy-review.js', 'test/liquidityqueue.js',
  'test/liquidityqueue-review.js', 'test/liquidityrpc.js', 'test/liquidity-deployment-plan.js',
  'test/character-mint-policy.js', 'test/chain.js', 'test/watcher.js', 'test/router.js',
  'test/vig.js', 'test/community.js', 'test/desk.js', 'test/bonds.js', 'test/genesiscca.js',
  'test/genesislaunch.js', 'test/genesisrelease.js', 'test/chainparams.js', 'test/gates.js',
  'test/docs.js', 'test/preflight.js', 'test/audit/mint-dev-allocation.js',
  'omerta-contracts/test/LiquidityRevenueAutomation.t.sol',
  'omerta-contracts/test/LiquidityBuybackExecutor.t.sol',
  'omerta-contracts/test/ProtocolLiquidityVault.t.sol',
  'omerta-contracts/test/GenesisLifecycleController.t.sol',
  'omerta-contracts/test/BondLiquidityHealth.t.sol',
  'omerta-contracts/test/BankBufferVault.t.sol', 'omerta-contracts/test/Bank.t.sol',
  'omerta-contracts/test/Omerta.t.sol', 'omerta-contracts/test/OmertaBond.t.sol',
  'omerta-contracts/test/GenesisProceedsSplitter.t.sol',
  'omerta-contracts/test/CharacterLaunchAudit.t.sol',
  'omerta-contracts/test/audit/ComprehensiveCoreAudit.t.sol',
  'omerta-contracts/script/Deploy.s.sol', 'omerta-contracts/script/Deploy-MainnetCore.ps1',
  'omerta-contracts/script/Deploy-TestnetCore.ps1', 'omerta-contracts/script/DeployGenesisSplitter.s.sol',
  'omerta-contracts/foundry.toml', 'omerta-contracts/run-forge-test.sh',
  'schema.sql', 'package.json', 'package-lock.json', 'render.yaml', '.env.example',
  '.github/workflows/ci.yml', '.github/workflows/forge.yml', '.github/workflows/liquidity-postgres.yml',
  'deploy/fee-splits.json', 'deploy/fee-splits.env',
  'omerta-contracts/LIQUIDITY-AUTOMATION.md', 'omerta-contracts/SECURITY-REVIEW-POLICY.md',
  'omerta-contracts/DEPLOYMENT.md', 'omerta-contracts/README.md',
  'omerta-contracts/GENESIS-LAUNCH.md', 'omerta-contracts/CHARACTER-NFT-LAUNCH.md',
  'CHAIN-DEPLOY.md', 'CHAIN-AUDIT-PACKET-O1.md', 'DEPLOY.md', 'LAUNCH-READINESS.md', 'SPEC.md', 'MARKETING-POSTS.md', 'public/fee-flows.html',
];
const SOLIDITY_REMAPS = {
  '@openzeppelin/': 'omerta-contracts/lib/openzeppelin-contracts/',
  'openzeppelin-contracts/': 'omerta-contracts/lib/openzeppelin-contracts/contracts/',
  'v4-core/': 'omerta-contracts/lib/v4-core/src/', '@uniswap/v4-core/': 'omerta-contracts/lib/v4-core/',
  'v4-periphery/': 'omerta-contracts/lib/v4-periphery/src/', 'permit2/': 'omerta-contracts/lib/permit2/',
  'forge-std/': 'omerta-contracts/lib/forge-std/src/', 'solmate/': 'omerta-contracts/lib/v4-core/lib/solmate/',
};
const KNOWN_EXCLUDED_DIR = /^(?:\.git|node_modules|pg[-_]?data|postgres[-_]?data|tmp(?:[-_].*)?|temp(?:[-_].*)?|snapshots?|review-package|packages?|captures?)(?:$|[-_])/i;
const ARCHIVE_EXTENSION = /\.(?:zip|tar|tgz|gz|7z)$/i;
const FINAL_EXIT_MARKERS = ['npm-test.exit.txt', 'forge-combined-final.exit.txt', 'forge-existing-regressions-final.exit.txt',
  'forge-sizes-final.exit.txt', 'final-pgcheck.exit.txt', 'final-pgquery.exit.txt', 'final-gates.exit.txt',
  'e2e-wrapper-run.exit.txt', 'deployment-plan-tests-final.exit.txt', 'accounting-postgres.exit.txt',
  'indexer-postgres-final.exit', 'queue-postgres-final.exit', 'policy-postgres.exit.txt',
  'accounting-review-final.exit', 'policy-review-final.exit', 'queue-precision-final.exit',
  'preflight-inventory-retest.exit.txt', 'docs-size-retest.exit.txt', 'knowledge-final.exit.txt'];

function safeFile(relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.split(/[\\/]/).some(p => p === '..')) throw Error(`Unsafe relative path: ${relative}`);
  const normalized = unix(relative);
  if (/(^|\/)\.git(?:\/|$)|(^|\/)node_modules(?:\/|$)/.test(normalized)
      || /(^|\/)\.env(?:$|\.)/.test(normalized) && normalized !== '.env.example') throw Error(`Private/excluded path: ${relative}`);
  const full = path.resolve(ROOT, normalized);
  if (!within(ROOT, full) || !within(ROOT, fs.realpathSync(full)) || !fs.statSync(full).isFile()) throw Error(`Unavailable/outside source: ${relative}`);
  return full;
}

function priorDelta(currentRows, priorPath) {
  const prior = readJson(safeFile(priorPath));
  const before = new Map(prior.files.filter(f => /^omerta-contracts\/src\/.+\.sol$/.test(f.path)).map(f => [f.path, f]));
  const current = currentRows.filter(f => /^omerta-contracts\/src\/.+\.sol$/.test(f.path));
  return { manifestPath: priorPath, manifestSha256: sha(fs.readFileSync(safeFile(priorPath))),
    priorSourceTreeSha256: prior.sourceTreeSha256 ?? null,
    comparison: 'Compare exact raw working-file bytes only where the previous manifest recorded that path. Unrecorded is not proof that a file was newly created; the mint manifest had a narrow scope.',
    changed: current.filter(f => before.has(f.path) && before.get(f.path).sha256 !== f.sha256)
      .map(f => ({ path: f.path, beforeSha256: before.get(f.path).sha256, afterSha256: f.sha256 })),
    unchanged: current.filter(f => before.get(f.path)?.sha256 === f.sha256).map(f => f.path),
    notRecordedInPriorSnapshot: current.filter(f => !before.has(f.path)).map(f => ({ path: f.path, sha256: f.sha256 })),
    priorSolidityOutsideCurrentScope: [...before.keys()].filter(p => !current.some(f => f.path === p)) };
}

function inspect(mode, confirmed) {
  const capturedAt = new Date().toISOString();
  if (git('rev-parse', 'HEAD') !== BASE) throw Error('Base revision changed; update the explicit review scope before capture.');
  const buffers = new Map(), kinds = new Map(), reasons = new Map(), exclusions = [];
  function add(relative, kind, reason) {
    relative = unix(relative);
    if (!buffers.has(relative)) buffers.set(relative, fs.readFileSync(safeFile(relative)));
    if (!kinds.has(relative)) kinds.set(relative, new Set());
    if (!reasons.has(relative)) reasons.set(relative, new Set());
    kinds.get(relative).add(kind); reasons.get(relative).add(reason);
  }
  const visited = new Set();
  function source(relative, reason) {
    relative = unix(relative); add(relative, 'source', reason);
    if (visited.has(relative)) return;
    visited.add(relative);
    const text = buffers.get(relative).toString('utf8');
    if (/\.[cm]?js$/.test(relative)) {
      const local = [...text.matchAll(/(?:^[ \t]*(?:import|export)\s+(?:[^;]*?\bfrom\s+)?|\bawait\s+import\s*\(\s*|\brequire\s*\(\s*)['"](\.[^'"\n]+)['"]/gm)];
      for (const match of local) {
        let resolved = unix(path.relative(ROOT, path.resolve(ROOT, path.dirname(relative), match[1])));
        if (!/\.(?:[cm]?js|json)$/.test(resolved)) continue;
        // Test fixtures also embed `node -e import('./src/...')` strings run with repository cwd.
        // Preserve that referenced source without treating the string as a module-relative import.
        if (!fs.existsSync(path.join(ROOT, resolved)) && match[1].startsWith('./')) {
          const fromRepository = unix(path.relative(ROOT, path.resolve(ROOT, match[1])));
          if (fs.existsSync(path.join(ROOT, fromRepository))) { source(fromRepository, `repository-relative embedded fixture import from ${relative}`); continue; }
        }
        if (!fs.existsSync(path.join(ROOT, resolved))) throw Error(`Unresolved literal import ${match[1]} in ${relative}`);
        source(resolved, `literal local import from ${relative}`);
      }
    } else if (relative.endsWith('.sol') && relative.startsWith('omerta-contracts/')) {
      for (const match of text.matchAll(/\bimport\s+(?:[\s\S]*?\sfrom\s+)?['"]([^'"]+)['"]\s*;/g)) {
        const name = match[1];
        const prefix = Object.keys(SOLIDITY_REMAPS).find(p => name.startsWith(p));
        const resolved = name.startsWith('.') ? unix(path.relative(ROOT, path.resolve(ROOT, path.dirname(relative), name)))
          : prefix ? SOLIDITY_REMAPS[prefix] + name.slice(prefix.length) : null;
        if (!resolved) throw Error(`Unmapped Solidity import ${name} in ${relative}`);
        source(resolved, `Solidity import from ${relative}`);
      }
    }
  }
  for (const file of REQUIRED_SOURCE) source(file, 'explicit scoped entry/test/tool/document/configuration');
  // Include all new matching slices, so a later in-scope helper cannot disappear from a frozen scope.
  for (const dir of ['src', 'test', 'tools']) for (const file of fs.readdirSync(path.join(ROOT, dir)))
    if (/^(?:liquidity|keepertransactions|genesiskeeper).*\.[cm]?js$/.test(file)) source(`${dir}/${file}`, 'scoped component family');

  const artifacts = [];
  for (const name of TARGETS) {
    const reviewed = loadReviewedArtifact(name, { contractsRoot: CONTRACTS });
    const relative = `omerta-contracts/out/${name}.sol/${name}.json`;
    add(relative, 'artifact', 'exact current compiler artifact for static review target');
    if (sha(buffers.get(relative)) !== reviewed.evidence.artifactSha256) throw Error(`Artifact changed while reading ${name}`);
    for (const [file, hashes] of Object.entries(reviewed.evidence.sources)) {
      const p = `omerta-contracts/${file}`; source(p, `validated compiler metadata closure for ${name}`);
      if (sha(buffers.get(p)) !== hashes.sha256) throw Error(`Compiler source changed while reading ${p}`);
    }
    artifacts.push({ path: relative, bytes: buffers.get(relative).length, sha256: sha(buffers.get(relative)),
      ...reviewed.evidence, bytecodeTemplateBytes: (reviewed.bytecode.length - 2) / 2,
      artifactSourceProof: 'Every metadata source matches exact bytes or documented CRLF-to-LF normalization; ABI matches compiler rawMetadata; bytecode is linked and compiler settings match reviewed profile.' });
  }

  // Preserve the actual bytecode artifacts used by the final local rehearsal as well as the 10 static targets.
  const rehearsal = readJson(safeFile(`${RAW}/e2e-report.json`));
  const rehearsalArtifacts = [];
  for (const [name, expected] of Object.entries(rehearsal.artifacts ?? {})) {
    const relative = `omerta-contracts/out/${name}.sol/${name}.json`;
    add(relative, 'artifact', 'exact artifact SHA256 recorded by final local EVM rehearsal');
    if (sha(buffers.get(relative)) !== expected) throw Error(`Rehearsal artifact unavailable or overwritten: ${name}`);
    const artifact = JSON.parse(buffers.get(relative));
    const metadata = typeof artifact.rawMetadata === 'string' ? JSON.parse(artifact.rawMetadata) : artifact.metadata;
    const compilerSources = {};
    for (const [file, entry] of Object.entries(metadata.sources)) {
      const p = `omerta-contracts/${file}`; source(p, `rehearsal artifact metadata closure for ${name}`);
      const bytes = buffers.get(p), raw = keccak256(toHex(bytes));
      const normalized = keccak256(toHex(bytes.toString('utf8').replace(/\r\n/g, '\n')));
      if (entry.keccak256 !== raw && entry.keccak256 !== normalized) throw Error(`Rehearsal compiler source mismatch ${p}`);
      compilerSources[file] = { sha256: sha(bytes), compilerInputKeccak256: entry.keccak256, rawKeccak256: raw, crlfNormalized: raw !== entry.keccak256 };
    }
    rehearsalArtifacts.push({ name, path: relative, bytes: buffers.get(relative).length, sha256: expected,
      compiler: metadata.compiler.version, settings: metadata.settings,
      creationBytecodeKeccak256: keccak256(artifact.bytecode.object), runtimeTemplateKeccak256: keccak256(artifact.deployedBytecode.object),
      immutableReferences: artifact.deployedBytecode.immutableReferences ?? {}, sources: compilerSources,
      classification: TARGETS.includes(name) ? 'also a static review target' : 'rehearsal implementation/fixture; not an additional standalone contract audit' });
  }

  // Freeze previously pinned CCA/LBP source callees without changing their old packages or scope claims.
  const oldDir = 'omerta-contracts/audits/2026-09-08-comprehensive';
  for (const [manifest, field] of [['launcher-source-manifest.json', 'files'], ['external-integration-source-hashes.json', 'entries']]) {
    const data = readJson(safeFile(`${oldDir}/${manifest}`));
    add(`${oldDir}/${manifest}`, 'evidence', 'unchanged historical source reference');
    for (const row of data[field]) {
      if (!/^output\/comprehensive-audit\/external\/(?:lbp-v3\.1\.1|continuous-clearing-auction)\//.test(row.path)) continue;
      add(row.path, 'source', 'pinned external Genesis callee source; inventory does not expand review scope');
      if (sha(buffers.get(row.path)) !== row.sha256) throw Error(`Historical external source drift ${row.path}`);
    }
  }
  add('output/comprehensive-audit/external/cca-BlockNumberish.sol', 'source', 'pinned CCA clock implementation');
  for (const old of ['2026-09-08-comprehensive', '2026-09-08-mint-dev-allocation'])
    for (const file of ['report.md', 'source-manifest.json', 'evidence-manifest.json'])
      add(`omerta-contracts/audits/${old}/${file}`, 'evidence', 'unchanged historical review reference; no nested historical package');

  for (const entry of fs.readdirSync(path.join(ROOT, AUDIT), { withFileTypes: true })) {
    if (!entry.isFile() || MANIFESTS.includes(entry.name)) continue;
    const p = `${AUDIT}/${entry.name}`;
    add(p, 'evidence', 'current review report, subreport or evidence script');
    if (/\.(?:mjs|ps1)$/.test(entry.name)) add(p, 'source', 'evidence acquisition/verification implementation');
  }
  function walkEvidence(relative) {
    for (const entry of fs.readdirSync(path.join(ROOT, relative), { withFileTypes: true })) {
      const p = `${relative}/${entry.name}`;
      if (entry.isSymbolicLink()) throw Error(`Evidence symlink refused: ${p}`);
      if (entry.isDirectory()) {
        if (KNOWN_EXCLUDED_DIR.test(entry.name)) { exclusions.push({ path: p, reason: 'live database, temporary data or nested snapshot/package directory' }); continue; }
        walkEvidence(p);
      } else if (entry.isFile()) {
        if (ARCHIVE_EXTENSION.test(entry.name) || MANIFESTS.includes(entry.name)) { exclusions.push({ path: p, reason: 'nested archive or generated manifest; canonical package retains it once' }); continue; }
        if (!/\.(?:json|log|txt|md|sol|mjs|js|exit|csv)$/i.test(entry.name)) throw Error(`Unexpected evidence type; classify explicitly: ${p}`);
        add(p, 'evidence', 'raw/current or retained failing liquidity review evidence');
      }
    }
  }
  walkEvidence(RAW);

  const scanRuns = readJson(safeFile(`${RAW}/static/slither-runs.json`));
  const triage = readJson(safeFile(`${RAW}/static/triage.json`));
  const ids = new Set(); let occurrences = 0;
  for (const name of TARGETS) {
    const run = scanRuns.find(r => r.contract === name), raw = readJson(safeFile(`${RAW}/static/slither-${name}.json`));
    if (!run?.success || !raw.success || !run.sourceUnchangedDuringRun || sha(buffers.get(`omerta-contracts/src/${name}.sol`)) !== run.sourceSHA256) throw Error(`Static evidence stale/incomplete ${name}`);
    if (raw.results.detectors.length !== run.diagnostics) throw Error(`Static count mismatch ${name}`);
    for (const d of raw.results.detectors) { ids.add(d.id); occurrences++; }
  }
  if (triage.untriaged !== 0 || triage.entries.length !== ids.size || triage.entries.some(d => !ids.has(d.id) || !d.disposition)) throw Error('Static triage coverage mismatch');
  for (const entry of triage.sourceInventory) if (sha(fs.readFileSync(safeFile(`omerta-contracts/${entry.path}`))) !== entry.sha256) throw Error(`Static dependency drift: ${entry.path}`);

  const npmExitPath = `${RAW}/npm-test.exit.txt`;
  const npmExit = fs.existsSync(path.join(ROOT, npmExitPath)) ? Number(fs.readFileSync(safeFile(npmExitPath), 'utf8').trim()) : null;
  const finalExitEvidence = FINAL_EXIT_MARKERS.map(name => {
    const p = `${RAW}/${name}`;
    return { path: p, exitCode: buffers.has(p) ? Number(buffers.get(p).toString('utf8').trim()) : null };
  });
  const report = buffers.get(`${AUDIT}/report.md`)?.toString('utf8');
  if (!report) throw Error('Main report is missing.');
  if (mode === 'seal') {
    if (!confirmed) throw Error('--seal requires --final-tests-confirmed after the coordinating reviewer confirms completion.');
    if (npmExit !== 0) throw Error('Final npm test exit evidence is not zero.');
    for (const result of finalExitEvidence) if (result.exitCode !== 0) throw Error(`Required final gate is not zero: ${result.path}`);
    if (/full-suite run pending|full-suite run finishes|final run must pass|source seal is not complete|final full-suite run pending/i.test(report)) throw Error('Main report still contains a pending final-test checkpoint.');
    if (!buffers.has(`${RAW}/npm-test.log`)) throw Error('Final npm-test.log must be retained for sealing.');
    for (const name of MANIFESTS) if (fs.existsSync(path.join(ROOT, AUDIT, name))) throw Error(`Refusing to overwrite existing canonical manifest ${name}`);
  }
  const rows = [...buffers].map(([p, b]) => ({ path: p, bytes: b.length, sha256: sha(b), categories: [...kinds.get(p)].sort(), reasons: [...reasons.get(p)].sort() })).sort(byPath);
  const sourceRows = rows.filter(r => r.categories.includes('source'));
  const solidityRows = sourceRows.filter(r => /^omerta-contracts\/src\/.+\.sol$/.test(r.path));
  const sourceManifest = { schemaVersion: 1, capturedAt, status: mode === 'seal' ? 'sealed-reviewed-source' : 'DRAFT-unsealed', sourceCommit: BASE,
    workingTreeStatus: git('status', '--short'), phase: 'local predeployment; no production transaction or activation',
    targetChain: { name: 'Robinhood mainnet', chainId: 4663, notDeployedByThisCapture: true },
    sourceTreeSha256: treeHash(sourceRows), soliditySourceTreeSha256: treeHash(solidityRows),
    treeHashAlgorithm: 'SHA256 of compact JSON sorted [{path,bytes,sha256}], preserving exact file bytes; timestamps/classification excluded from tree digest',
    scope: { explicitFiles: REQUIRED_SOURCE, staticContracts: TARGETS,
      expansion: 'Literal local JavaScript imports, scoped liquidity/keeper component families, Solidity test imports, validated compiler metadata closures and explicitly pinned external Genesis callees.',
      limits: 'Inventory includes supporting callees/fixtures and does not imply independent full review of every included dependency or every gameplay feature. Dynamic file reads and installed npm dependencies require the pinned package lock and normal setup.' },
    previousSnapshots: [priorDelta(sourceRows, `${oldDir}/source-manifest.json`), priorDelta(sourceRows, 'omerta-contracts/audits/2026-09-08-mint-dev-allocation/source-manifest.json')], files: sourceRows };
  const artifactManifest = { schemaVersion: 1, capturedAt, sourceTreeSha256: sourceManifest.sourceTreeSha256,
    note: 'Raw exact artifact JSON is archived at each listed path. Runtime and creation hashes are templates; live constructor arguments and immutable substitutions still require deployment verification. Ten current targets use loadReviewedArtifact; supplemental rehearsal artifacts match the SHA256 retained by the actual EVM run.',
    artifacts, rehearsalArtifacts };
  const generated = new Map([
    [`${AUDIT}/source-manifest.json`, Buffer.from(json(sourceManifest))],
    [`${AUDIT}/artifact-manifest.json`, Buffer.from(json(artifactManifest))],
  ]);
  const generatedRows = () => [...generated].map(([p,b]) => ({ path: p, bytes: b.length, sha256: sha(b) }));
  const evidenceRows = [...rows.filter(r => r.categories.includes('evidence')), ...generatedRows()].sort(byPath);
  const evidenceManifest = { schemaVersion: 1, capturedAt, status: sourceManifest.status,
    sourceTreeSha256: sourceManifest.sourceTreeSha256, reportPath: `${AUDIT}/report.md`, reportSha256: sha(buffers.get(`${AUDIT}/report.md`)),
    artifactManifestSha256: sha(generated.get(`${AUDIT}/artifact-manifest.json`)), evidenceTreeSha256: treeHash(evidenceRows),
    finalTests: { coordinatingReviewerConfirmed: mode === 'seal' && confirmed, npmExit, npmExitPath,
      note: 'A draft may observe an existing exit marker while a later run is active; only explicit final confirmation and a completed report permit sealing.' },
    finalExitEvidence,
    static: { successfulScans: TARGETS.length, diagnosticOccurrences: occurrences, uniqueDiagnostics: ids.size, untriaged: 0 },
    exclusions, note: 'Every raw liquidity output, including failures, is retained except classified live data/nested packages. This manifest excludes itself and the outer package manifest to avoid circular hashes. Source and artifact paths are copied only once into the mirrored package.', files: evidenceRows };
  generated.set(`${AUDIT}/evidence-manifest.json`, Buffer.from(json(evidenceManifest)));
  const packageRows = [...rows, ...generatedRows()].sort(byPath);
  const packageManifest = { schemaVersion: 1, capturedAt, status: sourceManifest.status, sourceCommit: BASE,
    sourceTreeSha256: sourceManifest.sourceTreeSha256, packageTreeSha256: treeHash(packageRows),
    sourceManifestPath: `${AUDIT}/source-manifest.json`, artifactManifestPath: `${AUDIT}/artifact-manifest.json`, evidenceManifestPath: `${AUDIT}/evidence-manifest.json`,
    reportPath: `${AUDIT}/report.md`, fileCount: packageRows.length, totalBytes: packageRows.reduce((sum,r) => sum + r.bytes, 0),
    note: 'Mirrored repository paths preserve report/source links. Each payload file appears once. This outer manifest excludes itself. No secret environment, database data directory, node_modules, native binary or compiler cache is included.', files: packageRows };
  generated.set('package-manifest.json', Buffer.from(json(packageManifest)));
  return { capturedAt, mode, buffers, generated, packageManifest, sourceManifest, artifactManifest, evidenceManifest };
}

function verify(packageDir) {
  const root = fs.realpathSync(packageDir), manifest = readJson(path.join(root, 'package-manifest.json'));
  const seen = new Set();
  for (const row of manifest.files) {
    if (seen.has(row.path)) throw Error(`Duplicate package path ${row.path}`);
    seen.add(row.path);
    const target = path.resolve(root, row.path);
    if (!within(root, target) || !within(root, fs.realpathSync(target))) throw Error(`Package path escape ${row.path}`);
    const data = fs.readFileSync(target);
    if (data.length !== row.bytes || sha(data) !== row.sha256) throw Error(`Package content mismatch ${row.path}`);
  }
  if (treeHash(manifest.files) !== manifest.packageTreeSha256) throw Error('Package tree digest mismatch');
  for (const field of ['sourceManifestPath', 'artifactManifestPath', 'evidenceManifestPath', 'reportPath']) if (!seen.has(manifest[field])) throw Error(`Missing ${field}`);
  const source = readJson(path.join(root, manifest.sourceManifestPath));
  const artifact = readJson(path.join(root, manifest.artifactManifestPath));
  const evidence = readJson(path.join(root, manifest.evidenceManifestPath));
  const indexed = new Map(manifest.files.map(row => [row.path, row]));
  for (const row of [...source.files, ...evidence.files]) {
    const parent = indexed.get(row.path);
    if (!parent || parent.sha256 !== row.sha256 || parent.bytes !== row.bytes) throw Error(`Inner manifest mismatch ${row.path}`);
  }
  if (treeHash(source.files) !== source.sourceTreeSha256 || source.sourceTreeSha256 !== manifest.sourceTreeSha256
      || treeHash(evidence.files) !== evidence.evidenceTreeSha256) throw Error('Inner tree digest mismatch');
  if (artifact.artifacts.length !== TARGETS.length) throw Error('Missing target artifact manifest');
  for (const record of artifact.artifacts) {
    const loaded = loadReviewedArtifact(record.contract, { contractsRoot: path.join(root, 'omerta-contracts') });
    if (loaded.evidence.artifactSha256 !== record.artifactSha256
        || loaded.evidence.runtimeTemplateKeccak256 !== record.runtimeTemplateKeccak256) throw Error(`Frozen artifact proof mismatch ${record.contract}`);
  }
  function allFiles(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name), p = unix(path.relative(root, target));
      if (entry.isSymbolicLink()) throw Error(`Uninventoried symlink ${p}`);
      if (entry.isDirectory()) allFiles(target);
      else if (entry.isFile() && p !== 'package-manifest.json' && !seen.has(p)) throw Error(`Uninventoried package file ${p}`);
    }
  }
  allFiles(root);
  return { verified: true, packageDir: root, status: manifest.status, files: seen.size, bytes: manifest.totalBytes, packageTreeSha256: manifest.packageTreeSha256, packageManifestSha256: sha(fs.readFileSync(path.join(root, 'package-manifest.json'))) };
}

function main(argv) {
  if (argv.includes('--help')) { console.log('Usage: node capture-evidence.mjs --check [--print-source-manifest] | --draft [--output NEW_DIR] | --seal --final-tests-confirmed [--output NEW_DIR] | --verify PACKAGE_DIR\n--check writes nothing. Draft never publishes canonical manifests. Seal requires confirmed final tests and refuses existing canonical manifests/packages.'); return; }
  let mode, output, confirmed = false, verifyDir, printSource = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (['--check', '--draft', '--seal'].includes(arg)) { if (mode) throw Error('Choose one capture mode'); mode = arg.slice(2); }
    else if (arg === '--final-tests-confirmed') confirmed = true;
    else if (arg === '--output') { output = argv[++i]; if (!output) throw Error('--output needs a new directory'); }
    else if (arg === '--print-source-manifest') printSource = true;
    else if (arg === '--verify') { verifyDir = argv[++i]; if (!verifyDir) throw Error('--verify needs a package directory'); }
    else throw Error(`Unknown argument ${arg}`);
  }
  if (verifyDir) { if (mode || output || confirmed || printSource) throw Error('--verify is independent of capture'); console.log(json(verify(path.resolve(verifyDir)))); return; }
  if (!mode || mode !== 'seal' && confirmed) throw Error('Use an explicit --check, --draft or --seal mode');
  if (mode === 'check' && output) throw Error('--check does not write a package');
  if (printSource && mode !== 'check') throw Error('--print-source-manifest is only a read-only check output');
  const capture = inspect(mode, confirmed);
  const summary = { mode, sourceFiles: capture.sourceManifest.files.length, staticTargetArtifacts: capture.artifactManifest.artifacts.length,
    rehearsalArtifactReferences: capture.artifactManifest.rehearsalArtifacts.length, evidenceFiles: capture.evidenceManifest.files.length,
    files: capture.packageManifest.fileCount, bytes: capture.packageManifest.totalBytes, sourceTreeSha256: capture.sourceManifest.sourceTreeSha256,
    packageTreeSha256: capture.packageManifest.packageTreeSha256, npmExitObserved: capture.evidenceManifest.finalTests.npmExit };
  if (mode === 'check') { console.log(json(printSource ? capture.sourceManifest : { ...summary, written: false })); return; }
  const stamp = capture.capturedAt.replace(/[:.]/g, '-');
  const destination = path.resolve(output || path.join(ROOT, 'output', `liquidity-automation-${mode}-${stamp}`));
  if (!within(path.join(ROOT, 'output'), destination) || within(path.join(ROOT, RAW), destination)) throw Error('Package must be a new output directory outside the raw evidence tree');
  if (fs.existsSync(destination)) throw Error(`Refusing to overwrite existing package ${destination}`);
  // Validate the collected source/evidence has not changed while the inventory was assembled.
  for (const [p, bytes] of capture.buffers) if (sha(fs.readFileSync(safeFile(p))) !== sha(bytes)) throw Error(`Input changed during capture: ${p}`);
  fs.mkdirSync(destination);
  for (const [p, bytes] of [...capture.buffers, ...capture.generated]) {
    const target = path.resolve(destination, p);
    if (!within(destination, target)) throw Error(`Destination escape ${p}`);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes, { flag: 'wx' });
  }
  const verified = verify(destination);
  if (mode === 'seal') for (const name of MANIFESTS) {
    const source = name === 'package-manifest.json' ? 'package-manifest.json' : `${AUDIT}/${name}`;
    fs.writeFileSync(path.join(ROOT, AUDIT, name), capture.generated.get(source), { flag: 'wx' });
  }
  console.log(json({ ...summary, written: true, ...verified, canonicalManifestsPublished: mode === 'seal' }));
}

try { main(process.argv.slice(2)); } catch (error) { console.error(`Evidence capture refused: ${error.message}`); process.exitCode = 1; }
