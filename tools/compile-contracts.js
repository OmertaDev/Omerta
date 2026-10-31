// Compile the omerta-contracts suite with solc-js — the no-Foundry path (Foundry binaries are
// GitHub-release downloads, blocked in some build environments; the npm registry usually isn't).
// Produces omerta-contracts/out-js/artifacts.json ({ [name]: { abi, bytecode } }) for
// tools/chain-e2e.js and any viem deploy script.
//
// Deps are AD HOC (never project dependencies — the deploy story stays zero-build):
//   npm i --no-save solc@0.8.38 @openzeppelin/contracts@5.6.1
// or point CONTRACT_DEPS at any directory whose node_modules holds them.
//
// Compiler/optimizer follow foundry.toml: solc 0.8.38, optimizer 800 runs.
// This dev-node fallback retains Shanghai. Canonical release verification uses Foundry's Cancun profiles.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..', 'omerta-contracts', 'src');
const OUT = path.join(here, '..', 'omerta-contracts', 'out-js');
const depsDir = process.env.CONTRACT_DEPS || path.join(here, '..');
const req = createRequire(path.join(depsDir, 'noop.js'));

let solc;
try { solc = req('solc'); } catch {
  console.error('solc not found. Run: npm i --no-save solc@0.8.38 @openzeppelin/contracts@5.6.1');
  console.error('(or set CONTRACT_DEPS to a dir whose node_modules has them)');
  process.exit(1);
}
if (!String(solc.version()).startsWith('0.8.38+commit.1835d247'))
  console.warn(`warning: solc ${solc.version()} != 0.8.38+commit.1835d247 (foundry.toml pin)`);

const sources = {};
for (const f of fs.readdirSync(SRC).filter((x) => x.endsWith('.sol')))
  sources[f] = { content: fs.readFileSync(path.join(SRC, f), 'utf8') };

const findImports = (p) => {
  try {
    if (p.startsWith('@openzeppelin/'))
      return { contents: fs.readFileSync(path.join(depsDir, 'node_modules', p), 'utf8') };
    return { contents: fs.readFileSync(path.join(SRC, p), 'utf8') };
  } catch { return { error: 'not found: ' + p }; }
};

const out = JSON.parse(solc.compile(JSON.stringify({
  language: 'Solidity',
  sources,
  settings: {
    optimizer: { enabled: true, runs: 800 },
    evmVersion: 'shanghai',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
}), { import: findImports }));

const errors = (out.errors || []).filter((e) => e.severity === 'error');
if (errors.length) { for (const e of errors) console.error(e.formattedMessage || e.message); process.exit(1); }
const warnings = (out.errors || []).filter((e) => e.severity === 'warning');

const artifacts = {};
for (const contracts of Object.values(out.contracts))
  for (const [name, c] of Object.entries(contracts))
    if (c.evm.bytecode.object) artifacts[name] = { abi: c.abi, bytecode: '0x' + c.evm.bytecode.object };

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'artifacts.json'), JSON.stringify(artifacts, null, 1));
const suite = ['OMR', 'VoucherClaim', 'GearVault', 'OMRStaking', 'OmertaFees', 'OmertaBond'];
const missing = suite.filter((n) => !artifacts[n]);
if (missing.length) { console.error('missing contracts:', missing.join(', ')); process.exit(1); }
console.log(`compiled ${suite.join(', ')} → omerta-contracts/out-js/artifacts.json (${warnings.length} warnings)`);
