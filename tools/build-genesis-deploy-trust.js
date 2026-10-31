#!/usr/bin/env node
// Offline compiler/source-bound creation template and exact local audited Keccak dependency.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { loadGenesisAuctionArtifact } from './genesis-auction-deployment-plan.js';
import { compilerSourceSha256, trustedAssetDifference } from './genesis-deploy-trust-checks.js';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const publicRoot = path.join(root, 'public');
const vendorRoot = path.join(publicRoot, 'genesis-deploy-vendor');
const checkOnly = process.argv.slice(2).includes('--check');
if (process.argv.slice(2).some(arg => arg !== '--check')) throw Error('Usage: node tools/build-genesis-deploy-trust.js [--check]');
const sha = value => createHash('sha256').update(value).digest('hex');
const sourceHashes = evidence => Object.fromEntries(Object.entries(evidence.sources).map(([file, pin]) =>
  [file, compilerSourceSha256(fs.readFileSync(path.join(root, 'omerta-contracts', file)), pin.compilerInputKeccak256)]));
const artifact = loadGenesisAuctionArtifact('OmertaHookV2');
const constructor = artifact.abi.find(entry => entry.type === 'constructor');
const schema = constructor?.inputs.map(input => input.type);
if (JSON.stringify(schema) !== JSON.stringify(['address', 'address', 'address', 'uint24', 'int24', 'address[5]', 'tuple', 'uint24', 'uint32', 'address'])
  || JSON.stringify(constructor.inputs[6].components.map(input => input.type)) !== JSON.stringify(['uint16', 'uint16', 'uint128']))
  throw Error('Trusted hook constructor is not the pinned 10-argument, 16-word static schema.');
const primarySourceHash = (a, source) => compilerSourceSha256(fs.readFileSync(path.join(root, 'omerta-contracts', source)), a.evidence.sources[source].compilerInputKeccak256);
const hookSource = primarySourceHash(artifact, 'src/market-v2/OmertaHookV2.sol');
if (hookSource !== '8153d2456a191e05bee3c7eca106d66cc8408b698a7372b68f54be47321c5e96')
  throw Error('Hook source differs from the pinned fixed-policy release candidate; review before updating this builder pin.');
const packageRoot = path.dirname(require.resolve('@noble/hashes/sha3'));
const metadata = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json')));
if (metadata.version !== '1.8.0') throw Error('Only reviewed @noble/hashes 1.8.0 may be shipped.');
const outputs = new Map(), provenance = { package: '@noble/hashes', version: metadata.version,
  license: 'MIT', modification: 'utils.js only: one import path @noble/hashes/crypto replaced by ./crypto.js; no algorithm changes.', files: {} };
for (const file of ['sha3.js', '_u64.js', 'utils.js', 'crypto.js']) {
  const original = fs.readFileSync(path.join(packageRoot, 'esm', file));
  let shipped = original;
  if (file === 'utils.js') {
    const text = original.toString('utf8'), match = "from '@noble/hashes/crypto'";
    if (text.split(match).length !== 2) throw Error('Audited utils import does not match the exact reviewed one-line rewrite.');
    shipped = Buffer.from(text.replace(match, "from './crypto.js'"));
  }
  outputs.set(path.join(vendorRoot, file), shipped);
  provenance.files[file] = { originalSha256: sha(original), shippedSha256: sha(shipped) };
}
const license = fs.readFileSync(path.join(packageRoot, 'LICENSE'));
outputs.set(path.join(vendorRoot, 'LICENSE'), license);
provenance.files.LICENSE = { originalSha256: sha(license), shippedSha256: sha(license) };
outputs.set(path.join(vendorRoot, 'provenance.json'), Buffer.from(JSON.stringify(provenance, null, 2) + '\n'));
const trusted = { schemaVersion: 1, contract: 'OmertaHookV2', constructorSchema: schema,
  openingSchema: ['uint16', 'uint16', 'uint128'], constructorWords: 16,
  compiler: artifact.evidence.compiler, optimizerRuns: 800, viaIR: true, evmVersion: 'cancun',
  sourceHashEncoding: 'compiler-verified UTF-8 LF', sourceHashes: sourceHashes(artifact.evidence),
  abiSha256: artifact.evidence.abiSha256, creationBytecode: artifact.bytecode,
  creationBytecodeKeccak256: artifact.evidence.creationBytecodeKeccak256,
  creationBytecodeSha256: sha(Buffer.from(artifact.bytecode.slice(2), 'hex')),
  creationBytecodeBytes: (artifact.bytecode.length - 2) / 2 };
const creationDefinitions = {}, reviewed = {
  OmertaReserveFundingV2: { source: 'src/market-v2/OmertaReserveFundingV2.sol', sha256: '38970157400b3537c529a70a5e9450d57ed02e9e13ef630037437c7cb713ed11',
    schema: ['address', 'address', 'uint8'] },
  OmertaAuctionCoordinatorV2: { source: 'src/market-v2/OmertaAuctionCoordinatorV2.sol', sha256: 'df0f46a144b885217248dcfb37a26d0fe7116ec05e5bc4ca14dc5454926f69eb',
    schema: ['address', 'address', 'address', 'address', 'address', 'uint24', 'int24', 'uint128', 'address', 'address'] },
  OmertaCharacterGuardedAuction: { source: 'src/genesis-auction/OmertaCharacterGuardedAuction.sol', sha256: '419d9102c1c518a89a204be30a7b59fefc4b6217dcdb85a4d3480d875a60b4c1',
    schema: ['address', 'uint128', 'tuple', 'address', 'address'] },
};
for (const [name, pin] of Object.entries(reviewed)) {
  const a = loadGenesisAuctionArtifact(name), ctor = a.abi.find(entry => entry.type === 'constructor');
  if (primarySourceHash(a, pin.source) !== pin.sha256 || JSON.stringify(ctor?.inputs.map(input => input.type)) !== JSON.stringify(pin.schema))
    throw Error(`${name}: reviewed source or constructor schema differs.`);
  if (name === 'OmertaCharacterGuardedAuction' && JSON.stringify(ctor.inputs[2].components.map(input => input.type))
    !== JSON.stringify(['address', 'address', 'address', 'uint64', 'uint64', 'uint64', 'uint256', 'address', 'uint256', 'uint128', 'bytes']))
    throw Error('Guarded auction dynamic tuple does not match the reviewed canonical schema.');
  creationDefinitions[name] = { contract: name, constructorAbi: ctor, compiler: a.evidence.compiler,
    sourceHashEncoding: 'compiler-verified UTF-8 LF', sourceHashes: sourceHashes(a.evidence),
    creationBytecode: a.bytecode, creationBytecodeKeccak256: a.evidence.creationBytecodeKeccak256,
    creationBytecodeSha256: sha(Buffer.from(a.bytecode.slice(2), 'hex')), creationBytecodeBytes: (a.bytecode.length - 2) / 2 };
}
outputs.set(path.join(publicRoot, 'genesis-deploy-artifact.js'), Buffer.from(
  '// Generated offline from reviewed compiler metadata and every imported source; do not hand edit.\n'
  + 'export const TRUSTED_HOOK = Object.freeze(' + JSON.stringify(trusted, null, 2) + ');\n'
  + 'export const TRUSTED_CREATIONS = Object.freeze(' + JSON.stringify(creationDefinitions, null, 2) + ');\n'));
for (const [file, content] of outputs) {
  if (checkOnly) {
    if (!fs.existsSync(file)) throw Error(`Trusted deployment asset is missing: ${path.relative(root, file)}`);
    const actual = fs.readFileSync(file);
    if (!actual.equals(content)) {
      const detail = file.endsWith('genesis-deploy-artifact.js') ? trustedAssetDifference(actual, content)
        : `stored SHA256=${sha(actual)} expected SHA256=${sha(content)}`;
      throw Error(`Trusted deployment asset is stale: ${path.relative(root, file)}; ${detail}`);
    }
  } else { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); }
}
console.log(`Trusted hook/compiler/source/constructor and local noble assets ${checkOnly ? 'CHECK PASS' : 'GENERATED'}; no RPC/signing.`);
