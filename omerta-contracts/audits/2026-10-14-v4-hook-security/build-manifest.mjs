import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Run from omerta-contracts after the scoped checks; hashes describe local evidence.
const root = process.cwd();
const evidence = 'audits/2026-10-14-v4-hook-security';
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const hashFile = file => ({ path: file, sha256: sha256(fs.readFileSync(path.join(root, file))) });
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const targets = [
  'OmertaHook', 'OmertaHookV2', 'OmertaSwapRouterV2', 'OmertaPoolManagerV2',
  'OmertaGenesisCoordinatorV2', 'HookExploitRegressionV2Test', 'GraduationSettlementRegressionV2Test',
];
const reviewedSources = new Set([
  'src/OmertaHook.sol', 'src/market-v2/OmertaHookV2.sol',
  'src/market-v2/OmertaSwapRouterV2.sol', 'src/market-v2/core/OmertaPoolManagerV2.sol',
  'src/market-v2/OmertaGenesisCoordinatorV2.sol', 'src/market-v2/OmertaRestrictedOMRV2.sol',
  'src/GenesisPlayerSale.sol', 'src/market-v2/OmertaMarketStateV2.sol',
  'src/market-v2/OmertaInventoryBondV2.sol', 'src/market-v2/OmertaStabilityControllerV2.sol',
  'test/market-v2/HookExploitRegressionV2.t.sol',
  'test/market-v2/GraduationSettlementRegressionV2.t.sol',
  'test/market-v2/OmertaHookV2.t.sol', 'test/market-v2/GenesisCoordinatorV2.t.sol',
  'test/market-v2/RestrictedPoolManagerV2.t.sol', 'test/market-v2/RestrictedRevenueBoundariesV2.t.sol',
  'test/market-v2/RestrictedMarketIntegrationV2.t.sol', 'test/market-v2/PlayerGenesisIntegrationV2.t.sol',
  'test/market-v2/MarketStateV2.t.sol', 'test/market-v2/LPRevenueEnforcementV2.t.sol',
  'test/OmertaHook.t.sol', 'test/audit/OmertaHookObserverDoS.t.sol', 'foundry.toml',
]);
const artifacts = [];
for (const target of targets) {
  const source = target === 'HookExploitRegressionV2Test' ? 'HookExploitRegressionV2.t.sol'
    : target === 'GraduationSettlementRegressionV2Test' ? 'GraduationSettlementRegressionV2.t.sol'
      : `${target}.sol`;
  const file = `out/${source}/${target}.json`;
  const artifact = readJson(file);
  const metadata = typeof artifact.metadata === 'string' ? JSON.parse(artifact.metadata) : artifact.metadata;
  const sourceHashes = Object.entries(metadata.sources).map(([sourcePath, item]) => {
    if (fs.existsSync(path.join(root, sourcePath))) reviewedSources.add(sourcePath);
    return { path: sourcePath, compilerKeccak256: item.keccak256 };
  });
  artifacts.push({
    contract: target,
    ...hashFile(file),
    compiler: metadata.compiler,
    settings: metadata.settings,
    creationTemplateSha256: sha256(Buffer.from(artifact.bytecode.object.replace(/^0x/, ''), 'hex')),
    runtimeTemplateSha256: sha256(Buffer.from(artifact.deployedBytecode.object.replace(/^0x/, ''), 'hex')),
    immutableReferences: artifact.deployedBytecode.immutableReferences,
    sources: sourceHashes,
  });
}
function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const file = `${dir}/${entry.name}`;
    return entry.isDirectory() ? walk(file) : [file];
  });
}
const manifest = {
  generatedAt: new Date().toISOString(),
  sourceCommit: 'e56cf576065c5f1bbb9bb55115f5961267f7d654',
  sourceState: 'dirty; existing production edits preserved; only tests and review evidence added',
  phase: 'local source and regression review; no deployment or target-chain verification',
  chain: { target: null, addresses: [], fixtureChain: 31337 },
  fuzz: { runs: 512, seed: '0x2109737503393554544' },
  methods: {
    pashov: 'c577eb7799c349de0acb187ba00ca98e14e436fd',
    plamen: '795962b96e254f2e423a2635fe7f8cb8ea1e6d69',
    trailofbits: 'd3323cefbcf645678b8dc481de204b02ad3d02dc',
  },
  dependencies: {
    v4Core: readJson('lib/v4-core/package.json').version,
    openzeppelin: readJson('lib/openzeppelin-contracts/contracts/package.json').version,
    v4Periphery: 'ad04c9f24a170accf5ea1b2836bbafd514537ca6',
    permit2: 'cc56ad0f3439c502c246fc5cfcc3db92bb8b7219',
    forgeStd: 'unmanaged local copy; source SHA256 and compiler Keccak256 retained below',
  },
  note: 'Artifact hashes are local files and compiler bytecode templates with immutable placeholders, not deployed runtime attestations. Dependency closure hashes do not imply manual review of every dependency.',
  files: [...reviewedSources].sort().map(hashFile),
  artifacts,
  report: hashFile(`${evidence}/README.md`),
  evidence: walk(evidence).filter(file => !file.endsWith('/manifest.json')).sort().map(hashFile),
};
fs.writeFileSync(path.join(root, evidence, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Pinned ${manifest.files.length} source/configuration files, ${artifacts.length} artifacts, and ${manifest.evidence.length} evidence files.`);
