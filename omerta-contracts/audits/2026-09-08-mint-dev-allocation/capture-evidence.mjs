import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { keccak256, toHex } from 'viem';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../../..');
const hash = (data) => createHash('sha256').update(data).digest('hex');
const entry = (file) => {
  const data = fs.readFileSync(path.join(root, file));
  return { path: file, bytes: data.length, sha256: hash(data) };
};
const sourcePaths = [
  'omerta-contracts/src/OmertaFees.sol', 'omerta-contracts/src/DynastyNFT.sol',
  'omerta-contracts/test/Omerta.t.sol', 'omerta-contracts/test/CharacterLaunchAudit.t.sol',
  'omerta-contracts/script/Deploy.s.sol', 'omerta-contracts/script/Deploy-MainnetCore.ps1',
  'omerta-contracts/script/Deploy-TestnetCore.ps1', 'omerta-contracts/foundry.toml',
  'schema.sql', 'src/db.js', 'src/fees.js', 'src/vig.js', 'src/router.js', 'src/chain.js', 'src/watcher.js',
  'test/audit/mint-dev-allocation.js', 'test/router.js', 'test/vig.js', 'test/community.js',
  'test/chain.js', 'test/watcher.js', 'test/chainparams.js', 'test/migrate.js',
  'test/character-mint-policy.js', 'tools/character-nft-preflight.js', 'tools/character-nft-rehearsal.js',
  'tools/validate-fee-splits.js', 'deploy/fee-splits.json', 'deploy/fee-splits.env',
  'public/fee-flows.html', 'omerta-contracts/README.md', 'omerta-contracts/DEPLOYMENT.md',
  'omerta-contracts/CHARACTER-NFT-LAUNCH.md', 'CHAIN-DEPLOY.md',
  'omerta-contracts/lib/openzeppelin-contracts/contracts/access/Ownable.sol',
  'omerta-contracts/lib/openzeppelin-contracts/contracts/access/Ownable2Step.sol',
  'omerta-contracts/lib/openzeppelin-contracts/contracts/utils/Context.sol',
  'omerta-contracts/lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol',
  'omerta-contracts/lib/openzeppelin-contracts/contracts/utils/StorageSlot.sol',
];
const before = JSON.parse(fs.readFileSync(path.join(dir, '../2026-09-08-comprehensive/source-manifest.json')));
const solidityDelta = before.files.filter((e) => /^omerta-contracts\/src\/.+\.sol$/.test(e.path))
  .map((e) => ({ path: e.path, before: e.sha256, after: entry(e.path).sha256 }))
  .filter((e) => e.before !== e.after);
const source = {
  capturedAt: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTree: 'dirty; hashes identify the reviewed amendment', target: 'Robinhood mainnet 4663, undeployed amendment',
  priorAuditSourceTreeSha256: before.sourceTreeSha256, solidityDeltaFromPriorAudit: solidityDelta,
  files: sourcePaths.map(entry),
};
fs.writeFileSync(path.join(dir, 'source-manifest.json'), JSON.stringify(source, null, 2) + '\n');

const artifactPath = 'omerta-contracts/out/OmertaFees.sol/OmertaFees.json';
const artifact = JSON.parse(fs.readFileSync(path.join(root, artifactPath)));
const metadata = typeof artifact.metadata === 'string' ? JSON.parse(artifact.metadata) : artifact.metadata;
const src = fs.readFileSync(path.join(root, 'omerta-contracts/src/OmertaFees.sol'), 'utf8');
const compiledHash = metadata.sources['src/OmertaFees.sol'].keccak256;
const srcMatch = keccak256(toHex(src)) === compiledHash ? 'exact'
  : keccak256(toHex(src.replace(/\r\n/g, '\n'))) === compiledHash ? 'CRLF-to-LF equivalent' : 'MISMATCH';
if (srcMatch === 'MISMATCH') throw new Error('Artifact source mismatch');
const artifactEvidence = { ...entry(artifactPath), compiler: metadata.compiler.version, settings: metadata.settings,
  compiledSourceKeccak256: compiledHash, sourceMatch: srcMatch,
  runtimeTemplateBytes: (artifact.deployedBytecode.object.length - 2) / 2,
  initcodeTemplateBytes: (artifact.bytecode.object.length - 2) / 2,
  runtimeTemplateKeccak256: keccak256(artifact.deployedBytecode.object),
  immutableReferences: artifact.deployedBytecode.immutableReferences,
  note: 'Templates require constructor arguments and immutable values for live runtime verification.' };
fs.writeFileSync(path.join(dir, 'artifact.json'), JSON.stringify(artifactEvidence, null, 2) + '\n');

const staticResult = JSON.parse(fs.readFileSync(path.join(root, 'output/mint-dev-allocation/slither.json')));
if (!staticResult.success) throw new Error('Slither unsuccessful');
const disposition = {
  'missing-zero-check': 'Ownable2Step permits zero to cancel the pending nomination. The active owner is unchanged; cancellation and privileged-selector tests cover this behavior.',
  assembly: 'OpenZeppelin StorageSlot helpers bind references to explicitly supplied slots. This inherited dependency was reviewed in the prior package and is unchanged; these assembly notices identify no new reachable fee mutation.',
  pragma: 'Dependency ^0.8.20 ranges intersect the application exact 0.8.26 pragma. Both native Forge and Slither compile with pinned 0.8.26.',
  'dead-code': 'Unused inherited Context helpers are excluded from reachable fee logic by compilation; no accounting or access-control effect.',
  'solc-version': 'Range-based dependency warning. Actual compiler is 0.8.26, not the older compiler releases named by these range diagnostics; no custom Yul optimizer sequence is configured.',
  'low-level-calls': 'Native-currency forwarding checks each call result and reverts the whole payment on failure. Every payment and owner-only sweep uses nonReentrant; mint has zero Vig leg. Malicious receiver, rejection, reentry and conservation proofs executed.',
};
const triage = staticResult.results.detectors.map((d) => {
  if (!disposition[d.check]) throw new Error('Untriaged detector ' + d.check);
  return { id: d.id, rule: d.check, impact: d.impact, confidence: d.confidence,
    description: d.description, disposition: disposition[d.check], confirmedDefect: false };
});
fs.writeFileSync(path.join(dir, 'static-triage.json'), JSON.stringify({ tool: 'Slither 0.11.6', diagnostics: triage.length, entries: triage }, null, 2) + '\n');

const evidencePaths = fs.readdirSync(path.join(root, 'output/mint-dev-allocation'))
  .filter((f) => fs.statSync(path.join(root, 'output/mint-dev-allocation', f)).isFile())
  .map((f) => 'output/mint-dev-allocation/' + f);
evidencePaths.push('output/character-nft/rehearsals/2026-09-08T06-02-45-458Z-mint-dev.json',
  'output/character-nft/preflight/2026-09-08T05-59-23-668Z.json');
for (const f of ['capture-evidence.mjs', 'report.md', 'source-manifest.json', 'artifact.json', 'static-triage.json'])
  evidencePaths.push(path.relative(root, path.join(dir, f)).replaceAll('\\', '/'));
const evidence = { capturedAt: new Date().toISOString(), files: evidencePaths.map(entry) };
fs.writeFileSync(path.join(dir, 'evidence-manifest.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ sourceFiles: source.files.length, solidityDelta, artifact: artifactEvidence,
  staticDiagnostics: triage.length, evidenceFiles: evidence.files.length }, null, 2));
