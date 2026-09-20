import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const revision = '626e61b9ab2b14a9dc45566983b70cdc65692839';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
const source = (file) => execFileSync('git', ['show', `${revision}:${file}`], { maxBuffer: 32 * 1024 * 1024 });
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const files = git('ls-tree', '-r', '--name-only', revision).split('\n');
const scoped = files.filter((file) => /^(src\/|public\/|test\/|tools\/|content\/|omerta-contracts\/(src|test|deployments)\/|schema\.sql$|package(-lock)?\.json$|render\.yaml$|\.github\/workflows\/)/.test(file)
  && /\.(js|mjs|cjs|html|css|json|sql|sol|sh|yml|yaml|toml)$/.test(file));
const schemaHash = sha256(source('schema.sql'));
const packageJson = JSON.parse(source('package.json'));
const flags = new Set();
for (const file of files.filter((file) => file.startsWith('src/') && file.endsWith('.js'))) {
  for (const match of source(file).toString().matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) flags.add(match[1]);
}
const deploymentFiles = files.filter((file) => /^omerta-contracts\/deployments\/\d+\/manifest\.json$/.test(file));
const manifest = {
  name: 'OMERTA RC1 freeze', frozenAt: new Date().toISOString(), sourceBranch: 'origin/main', revision,
  sourceTree: git('rev-parse', `${revision}^{tree}`), packageVersion: packageJson.version,
  schema: { file: 'schema.sql', sha256: schemaHash, schemaMetaStamp: schemaHash.slice(0, 16),
    version: packageJson.version, migrationMechanism: 'src/db.js makeDb: boot schema, derived columns, named migrations, schema_meta stamp',
    productionAppliedState: 'UNVERIFIED; no live database queried', extensions: 'No CREATE EXTENSION declaration found in frozen schema/src; built-in gen_random_uuid requires supported PostgreSQL.' },
  environment: { nodeRequired: packageJson.engines.node, ciNode: '22', hostNode: process.version,
    ciPostgres: '16', localPostgres: '18 (separate evidence; not production-major parity)',
    required: ['DATABASE_URL', 'NODE_ENV=production', 'JWT_SECRET', 'MARKET_SEED', 'MOD_KEY', 'SOCIAL_VERIFY_MODE'],
    declaredVariableNames: [...flags].sort(), secretsCaptured: false, actualProductionValuesVerified: false },
  gameplay: { present: ['World Graph', 'Coordination Engine', 'Living World Director', 'Campaign Network', 'Mysteries', 'crafting', 'inventory', 'Player Commands', 'Opportunities', 'Knowledge', 'operation custody', 'Command Center', 'legacy economy/social/world systems'],
    runtimeEnablementVerified: false,
    cohortRequiredFlags: ['CORE_PROGRESSION=on','WORLD_GRAPH_KERNEL=on','COORDINATION_ENGINE=on','COORDINATION_KNOWLEDGE=on','COORDINATION_KNOWLEDGE_SHARING=on','COORDINATION_OPERATIONS=on','LIVING_WORLD_DIRECTOR=LIMITED_COHORT','INVITE_MODE=on'],
    cohortAccountLists: 'DIRECTOR_ACCOUNT_IDS and COORDINATION_ACCOUNT_IDS must be identical nonempty approved lists; values not selected',
    defaultDirectorMode: 'DIRECTOR_DISABLED' },
  contracts: deploymentFiles.map((file) => { const d = JSON.parse(source(file)); return { file, sha256: sha256(source(file)), declaredStatus: d.status ?? null, source: d.source ?? null, network: d.network ?? null, liveVerification: 'NOT PERFORMED; checked-in manifests are historical declarations' }; }),
  processes: { api: 'npm start (node src/server.js)', worker: 'npm run worker (node src/worker.js), one worker, same revision/database/seeds',
    background: ['director tick every 5 minutes when enabled', 'guarded hourly lazy sweeps/economy monitoring', 'season sweep', 'optional liquidity keeper every 30 seconds', 'optional chain polling (default 30 seconds)', 'scheduled verified backups and private alerting per DEPLOY.md'],
    infrastructure: ['PostgreSQL (CI major 16)', 'optional Redis where configured', 'optional RPC/signers only for explicitly enabled existing rails'] },
  startup: ['Provision isolated database and approved cohort/account flags.', 'Set production secrets and explicit SOCIAL_VERIFY_MODE; never carry test-only overrides.', 'Install locked dependencies: npm ci --omit=dev.', 'Run npm run preflight with deployment configuration.', 'Take and validate a pre-migration database backup.', 'Start API at frozen/repaired tested SHA; migrations run automatically; fail launch on migration error.', 'Start one worker at identical SHA/configuration.', 'Verify health, schema_meta, worker heartbeat, command receipt, and cohort admission before opening access.'],
  rollback: ['Stop cohort admission and drain writes.', 'Retain database backup and incident/correlation evidence.', 'Roll back API AND worker to the same last proven SHA via Render deploy rollback.', 'Do not assume rollback undoes data; prove schema compatibility on a restored scratch database first.', 'For corrupt writes use audited compensating operations; never fabricate balances or delete receipts.', 'Verify health, schema_meta, worker heartbeat, reconstruction, replay and economic assertions before readmission.'],
  changeControl: 'No unrelated features. Every repair must cite failed RC gate and preserve failure plus retest evidence. No RC tag unless all launch gates pass.',
  sourceHashes: Object.fromEntries(scoped.map((file) => [file, sha256(source(file))])),
};
const destination = 'docs/release/RC1-RELEASE-MANIFEST.json';
if (fs.existsSync(destination)) throw new Error('Freeze manifest already exists; preserve the original freeze.');
fs.mkdirSync('docs/release', { recursive: true });
fs.writeFileSync(destination, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ revision, schemaHash, files: scoped.length, path: destination }));
