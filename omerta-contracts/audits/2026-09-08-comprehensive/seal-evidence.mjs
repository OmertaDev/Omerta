// Run from repository root after the named jobs finish. Does not read keys or database data.
import fs from 'node:fs';
import crypto from 'node:crypto';
const dir='omerta-contracts/audits/2026-09-08-comprehensive', raw='output/comprehensive-audit';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const record=p=>{const b=fs.readFileSync(p);return {path:p,bytes:b.length,sha256:sha(b)};};
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const initial=read(dir+'/source-before.json'), final=read(dir+'/source-manifest.json');
const byPath=new Map(initial.files.map(f=>[f.path,f]));
const changed=final.files.filter(f=>byPath.has(f.path)&&byPath.get(f.path).sha256!==f.sha256)
  .map(f=>({path:f.path,before:byPath.get(f.path).sha256,after:f.sha256}));
fs.writeFileSync(dir+'/remediation-delta.json',JSON.stringify({initialSourceTree:initial.sourceTreeSha256,finalSourceTree:final.sourceTreeSha256,
  note:'Content delta between capture times, not a git diff attribution. Pre-existing dirty work is preserved. Newly inventoried files were not necessarily created by this review; some new proof files were already in the initial capture.',changed,
  newlyInventoried:final.files.filter(f=>!byPath.has(f.path)).map(f=>f.path),
  authoredProofs:['omerta-contracts/test/audit/ComprehensiveCoreAudit.t.sol','omerta-contracts/test/audit/ComprehensiveAcquisitionAudit.t.sol','omerta-contracts/test/audit/ComprehensiveMarketAudit.t.sol','test/audit/deed-reimport-order.js'],
  runtimeCorrections:[{path:'omerta-contracts/src/OmertaHook.sol',finding:'M-01',change:'Reject self in all four fee recipient positions before writes.'},{path:'src/chain.js',finding:'INT-DEED-01',change:'Retain confirmed burn pending while its matching extraction has not been indexed.'}],
  harnessCorrections:['omerta-contracts/test/AcquisitionVaultOperator.t.sol: CRLF source representation in artifact binding','tools/genesis-fork-rehearsal.js: use existing pg-mem schema compatibility registrar'],
  commentOnlySolidity:['omerta-contracts/src/Alchemist.sol','omerta-contracts/src/Denari.sol','omerta-contracts/src/Transmuter.sol']},null,2)+'\n');
const runs=[
  ['baseline','forge test -vv','forge-baseline.log','forge-baseline.exit.txt',null],
  ['supplementary-before','forge test --match-path test/audit/Comprehensive*.t.sol --fuzz-seed 0x20260908 -vv','supplementary-before.log','supplementary-before.exit.txt','0x20260908'],
  ['affected-after','forge test --match-contract (Comprehensive|OmertaHook|OmrV4TwapOracle|AcquisitionVaultOperator) --fuzz-seed 0x20260908 -vv','affected-retest.log','affected-retest.exit.txt','0x20260908'],
  ['sizes-initial','forge build --sizes --skip test --skip script','build-sizes.log','build-sizes.exit.txt',null],
  ['sizes-production','forge build --sizes --skip FuzzTester','build-sizes-production.log','build-sizes-production.exit.txt',null],
  ['stock-local-e2e','ANVIL_BIN=C:/Users/Jorge/.foundry/bin/anvil.exe node tools/stock-e2e.js','stock-e2e.log','stock-e2e.exit.txt',null],
  ['postgres-initial','DATABASE_URL=loopback scratch omerta_audit node tools/pgcheck.js','postgres-check.log','postgres-check.exit.txt',null],
  ['postgres-retest','DATABASE_URL=loopback scratch omerta_audit_retest node tools/pgcheck.js','postgres-retest.log','postgres-retest.exit.txt',null],
  ['fee-splits','node tools/validate-fee-splits.js','fee-splits-final.log','fee-splits-final.exit.txt',null]
].map(([id,command,log,exit,seed])=>{
  const s=fs.readFileSync(raw+'/'+log,'utf8');
  const invariantAssertions=[...s.matchAll(/^\[PASS\]\s+(invariant\S*)\s+\(runs: (\d+), calls: (\d+), reverts: (\d+)\)/gm)]
    .map(m=>({name:m[1],runs:Number(m[2]),calls:Number(m[3]),reverts:Number(m[4])}));
  const fuzzAssertions=[...s.matchAll(/^\[PASS\]\s+(testFuzz\S*)\s+\(runs: (\d+),/gm)].map(m=>({name:m[1],runs:Number(m[2])}));
  return {id,command,workingDirectory:id.startsWith('sizes')||['baseline','supplementary-before','affected-after'].includes(id)?'omerta-contracts':'.',exitCode:Number(fs.readFileSync(raw+'/'+exit,'utf8').trim()),seed,
    seedNote:seed?'Explicit fixed seed.':'No explicit seed; do not infer a reproducible randomized seed.',log:record(raw+'/'+log),exit:record(raw+'/'+exit),
    finalFoundrySummary:[...s.matchAll(/^Ran \d+ test suites.*$/gm)].at(-1)?.[0]??null,fuzzAssertions,invariantAssertions,
    invariantNote:'Assertions can share an underlying invariant campaign; counts are per reported assertion and must not be summed as independent campaigns.'};
});
const files=fs.readdirSync(raw,{withFileTypes:true}).filter(e=>e.isFile()&&/\.(json|log|txt|dot|ps1|mjs)$/.test(e.name)).map(e=>record(raw+'/'+e.name));
const forks=['2026-09-08T04-52-14-761Z','2026-09-08T04-53-37-129Z'].flatMap(id=>fs.readdirSync('.audit/genesis-fork-rehearsal/'+id).filter(n=>fs.statSync('.audit/genesis-fork-rehearsal/'+id+'/'+n).isFile()).map(n=>record('.audit/genesis-fork-rehearsal/'+id+'/'+n)));
const externalDirs=['output/comprehensive-audit/external/liquidity-launcher/src','output/comprehensive-audit/external/lbp-v3.1.1/src'];
const externalFiles=[];
function walk(p,accept){for(const e of fs.readdirSync(p,{withFileTypes:true})){const q=p+'/'+e.name;if(e.isDirectory())walk(q,accept);else if(accept(q))externalFiles.push(record(q));}}
for(const p of externalDirs)walk(p,p=>p.endsWith('.sol'));
fs.writeFileSync(dir+'/launcher-source-manifest.json',JSON.stringify({note:'Complete source content pins for the selected Launcher/LBP checkouts, not a claim that every unused file received independent full review.',launcherCommit:'41442a518de9aa2a60ce5db76046dc4c983dd35a',lbpCommit:'5ef0262b8e191360a212aac864a525dcf7a06605',files:externalFiles},null,2)+'\n');
fs.writeFileSync(dir+'/evidence-manifest.json',JSON.stringify({generatedAt:new Date().toISOString(),chainId:4663,sourceCommit:final.sourceCommit,sourceTreeSha256:final.sourceTreeSha256,
  tools:{forge:'1.7.1',solc:'0.8.26+commit.8a97fa7a',slither:'0.11.6',node:process.version,postgres:'18'},
  settings:{optimizerRuns:800,evm:'cancun',fuzzRuns:512,invariantRuns:512,invariantDepth:500,invariantFailOnRevert:false,canonicalProfiles:'omerta-contracts/foundry.toml'},
  runs,otherRunRecords:files.filter(f=>/-run\.json$|js-runs\.json$|slither-runs\.json$/.test(f.path)),files,forkEvidence:forks,
  boundary:'All mutations were local, including Anvil fork transactions and isolated PostgreSQL. No production database, key or chain mutation. Full baseline and later affected runs are separate source-time evidence, not a fictional single all-green full-suite run.'},null,2)+'\n');
console.log(JSON.stringify({changed:changed.map(x=>x.path),rawFiles:files.length,forkFiles:forks.length,launcherSourceFiles:externalFiles.length}));
