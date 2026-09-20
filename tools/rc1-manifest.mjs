// Pin repository blobs, without reading a deployment's environment or secrets.
// Run from an unmodified checkout of the frozen source for compiled definitions.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createCampaignNetworkContent } from '../src/content/campaign-network.js';
import { createCampaignNetworkDefinitions } from '../src/director/campaign-network.js';
import { PHASE1_WORLD_GRAPH_PACKAGES } from '../src/content/phase1.js';
import { validatePhase1WorldGraph } from '../src/content/phase1-validation.js';

const revision = process.argv[2] || '626e61b9ab2b14a9dc45566983b70cdc65692839';
if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Use a full source commit SHA');
const git = (...args) => execFileSync('git', args, { maxBuffer: 32 * 1024 * 1024 });
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const files = git('ls-tree', '-r', '--name-only', revision).toString().trim().split('\n')
  .filter((file) => /^(src\/|content\/|omerta-contracts\/src\/|schema.sql$|package(-lock)?\.json$|render.yaml$|\.env.example$|\.github\/workflows\/|omerta-contracts\/foundry.toml$)/.test(file));
const source = files.map((file) => {
  const bytes = git('show', `${revision}:${file}`);
  // Imported definitions must be the frozen source; normalize checkout EOL only.
  if (file.startsWith('src/')) {
    const local = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    if (local !== bytes.toString().replace(/\r\n/g, '\n')) throw new Error(`Changed source: ${file}`);
  }
  return { path: file, sha256: hash(bytes), bytes: bytes.length };
});
const content = createCampaignNetworkContent();
const definitions = createCampaignNetworkDefinitions(content);
const packages = [...content.registry.byPackage.values()];
const snapshot = {
  phase1: PHASE1_WORLD_GRAPH_PACKAGES,
  worldGraph: content.worldDefinitions,
  operations: content.operationDefinitions,
  situations: definitions.situations,
  campaigns: definitions.campaigns,
  packages,
  recipes: [...content.registry.nodes.values()].filter((node) => node.type === 'recipe'),
  mysteryGraphIds: content.mysteryGraphIds,
  recipeIds: content.recipeIds,
  consequencePolicies: content.consequencePolicies,
};
const destination = 'docs/release/evidence/freeze';
fs.mkdirSync(destination, { recursive: true });
const snapshotBytes = JSON.stringify(snapshot, null, 2) + '\n';
fs.writeFileSync(path.join(destination, 'definitions.json'), snapshotBytes);
const schema = source.find((item) => item.path === 'schema.sql');
const manifest = {
  format: 1, revision, tree: git('rev-parse', `${revision}^{tree}`).toString().trim(),
  commitDate: git('show', '-s', '--format=%cI', revision).toString().trim(),
  hashEncoding: 'SHA-256 of exact Git blob bytes (not platform checkout line endings)',
  applicationVersion: JSON.parse(git('show', `${revision}:package.json`)).version,
  schema: { ...schema, schemaMetaStampForLfCheckout: schema.sha256.slice(0, 16), mechanism: 'schema_meta app_version and schema_sha; additive schema.sql plus src/db.js migrations' },
  phase1Validation: validatePhase1WorldGraph(),
  definitionSnapshot: { path: `${destination}/definitions.json`, sha256: hash(snapshotBytes) },
  situations: definitions.situations.map(({ id, version, contentHash }) => ({ id, version, contentHash })),
  campaigns: definitions.campaigns.map(({ id, version, contentHash }) => ({ id, version, contentHash })),
  source,
};
fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ revision, schema, sourceFiles: source.length, situations: manifest.situations.length, campaigns: manifest.campaigns.length, snapshotSha256: hash(snapshotBytes) }, null, 2));
