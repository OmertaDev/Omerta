// Reproducible content manifest. Run from the repository root; never reads secret configuration.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root = process.cwd();
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const files = [];
function walk(dir, accept) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, accept);
    else if (accept(p)) files.push(p);
  }
}
for (const dir of ['src', 'script', 'test', 'reference', 'lib'])
  walk(`omerta-contracts/${dir}`, p => /\.(sol|ps1)$/.test(p));
walk('omerta-contracts/deployments', p => p.endsWith('.json'));
walk('docs/superpowers/plans', p => /(?:acquisition|stock-token-registry|rwa-health-h2|settlement-gas-pool).*\.md$/.test(p.replaceAll('\\', '/')));
walk('test/audit', p => p.endsWith('.js'));
for (const file of ['omerta-contracts/foundry.toml', 'omerta-contracts/SECURITY-REVIEW-POLICY.md',
  'omerta-contracts/DEPLOYMENT.md', 'omerta-contracts/README.md', 'omerta-contracts/GENESIS-LAUNCH.md',
  'src/chain.js', 'src/watcher.js', 'src/worker.js', 'src/stockdeliver.js', 'src/fees.js',
  'src/store.js', 'src/bonds.js', 'src/genesiscca.js', 'src/genesisrelease.js', 'src/genesislaunch.js',
  'src/treasury.js', 'src/chainparams.js', 'src/vig.js', 'src/community.js', 'src/router.js',
  'src/rules.tail.js', 'src/db.js', 'src/v4oraclekeeper.js', 'CHAIN-DEPLOY.md', 'omerta-bank-protocol-design.md', 'omerta-v4-hook-design.md',
  'tools/genesis-fork-rehearsal.js', 'tools/stock-e2e.js', 'tools/validate-fee-splits.js',
  'test/chain.js', 'test/watcher.js', 'test/deeds.js', 'test/stockdeliver.js', 'test/reimport.js',
  'test/genesiscca.js', 'test/genesislaunch.js', 'test/genesisrelease.js', 'test/v4oraclekeeper.js',
  'test/chainparams.js', 'test/tokenomics.js', 'test/bank.js', 'test/nft.js',
  'schema.sql', 'deploy/fee-splits.json',
  'deploy/fee-splits.env', 'package-lock.json', 'package.json']) if (fs.existsSync(file)) files.push(file);
const records = [...new Set(files)].sort().map(file => {
  const b = fs.readFileSync(file);
  return { path: file.replaceAll('\\', '/'), bytes: b.length, sha256: sha(b) };
});
const source = records.filter(x => x.path.startsWith('omerta-contracts/src/'));
const manifest = {
  generatedAt: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim(),
  workingTreeStatus: execFileSync('git', ['status', '--short'], {encoding:'utf8'}).trim(),
  compiler: 'Solidity 0.8.26; optimizer 800; Cancun; canonical per-file via-IR restrictions in foundry.toml',
  sourceFileCount: source.length, sourceTreeSha256: sha(JSON.stringify(source)), files: records,
  note: 'Content inventory, not a claim that every dependency file received independent full review. Consult coverage.md and report.md.'
};
const dest = process.argv[2] || 'omerta-contracts/audits/2026-09-08-comprehensive/source-manifest.json';
fs.writeFileSync(dest, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({dest, files: records.length, sourceFiles: source.length, sourceTreeSha256: manifest.sourceTreeSha256}));
