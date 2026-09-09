// Run from repository root. Lexical entry inventory supplements the manual reviews; it is not a proof.
import fs from 'node:fs';
import crypto from 'node:crypto';
const dir = 'omerta-contracts/audits/2026-09-08-comprehensive';
const groups = {
  core: ['OMR','OMRStaking','OmertaFees','VoucherClaim','GearVault','StreetDeed','DynastyNFT','StockVault','GenesisOracle','OmertaBond','GenesisProceedsSplitter','IOmrOracle'],
  market: ['Alchemist','Denari','Transmuter','CollateralEscrow','FlashGuard','OmertaHook','OmrTwapOracle','OmrV4TwapOracle','StockTokenRegistry','RwaStockBuyer','IInitializerHook','IOmrV4ObservationSource'],
  acquisition: ['AcquisitionVault','AcquisitionAuthority','AcquisitionVaultCore','AcquisitionConstellationFactory','PreVoteBudgetBook','AcquisitionIntentExecution','AcquisitionReconciliation','StockTokenRegistryV2','RwaHealthOverlay','SettlementGasPool','IAcquisitionVaultV1','IAcquisitionAuthorityV2','IAcquisitionIntentExecutionV2','IStockTokenRegistryV2','IRwaHealthOverlay','ISettlementDataFeeSource']
};
const files = fs.readdirSync('omerta-contracts/src').filter(x=>x.endsWith('.sol')).map(x=>'src/'+x)
  .concat(fs.readdirSync('omerta-contracts/src/interfaces').filter(x=>x.endsWith('.sol')).map(x=>'src/interfaces/'+x)).sort();
const inventory = files.map(file=>{
  const raw=fs.readFileSync('omerta-contracts/'+file), s=raw.toString('utf8');
  const name=file.split('/').at(-1).slice(0,-4), group=Object.keys(groups).find(k=>groups[k].includes(name));
  if(!group)throw Error('Unassigned '+file);
  const entries=[...s.matchAll(/^\s*(function\s+(\w+)|constructor|receive|fallback|modifier\s+(\w+))\s*\(/gm)]
    .map(m=>({name:m[2]||m[3]||m[1],line:s.slice(0,m.index).split('\n').length}));
  return {path:file,group,sha256:crypto.createHash('sha256').update(raw).digest('hex'),bytes:raw.length,entries};
});
fs.writeFileSync(dir+'/entry-inventory.json',JSON.stringify({date:'2026-09-08',note:'Lexical declarations, including internal/private functions and inline interfaces. Inherited callees are described in the manual group and shared-dependency reviews.',files:inventory},null,2)+'\n');
const rows=inventory.map(f=>`| [${f.path}](../../${f.path}) | ${f.group} | ${f.entries.length} | [${f.group} review](${f.group}-review.md) |`).join('\n');
fs.writeFileSync(dir+'/coverage.md',`# Source and behavior coverage — 2026-09-08

All **40 local production Solidity files** are assigned below: 31 implementation-bearing files (including abstract FlashGuard) and nine interface-only files. This is not 40 deployable contracts. The entry inventory includes constructors, receive/fallback methods, modifiers, internal/private functions and inline interface declarations; inherited implementations were followed as recorded by each reviewer. Declarations and file counts alone do not establish behavior coverage.

| File | Group | Lexical entry declarations | Review |
| --- | --- | ---: | --- |
${rows}

## Dynamic evidence mapping

| Behavior boundary | Existing suites and added proof |
| --- | --- |
| Token issuance, tax, staking and paid fees | Omerta, OMRTax, CharacterLaunchAudit; ComprehensiveCoreAudit |
| Signed bridge, deed and identity issuance, callback burns/transfers, replay and caps | GearVault, StreetDeed, DynastyNFT, CharacterLaunchAudit; ComprehensiveCoreAudit; deed watcher/database regression identified by root report |
| Bond issuance, rate/oracle constraints, vesting, sweep surplus and recipient rollback | OmertaBond, GenesisOracle; ComprehensiveCoreAudit; local genesis fork |
| Genesis residual/failure custody and actual launcher migration | GenesisProceedsSplitter; ComprehensiveCoreAudit; mainnet fork and external LBP/CCA integration reviews |
| Stock held-balance distribution and authorization | StockVault; ComprehensiveCoreAudit; stock-e2e; chain/watcher/stockdeliver JavaScript suites |
| Bank collateral, debt, buffer, flow, donation, fees, withdrawal and hostile vault behavior | Bank, FlashGuard, AlchemistRedTeam, TransmuterFundingRedTeam; collateral/debt conservation properties in those suites |
| Real v4 swaps, tax, opening, surge, observation failure, TWAP windows and price conversion | OmertaHook, OmertaHookObserverDoS, OmrV4TwapOracle, OmrTwapOracle; ComprehensiveMarketAudit; local genesis fork |
| RWA catalog, bounded buyer, authority and realized output | RwaStockMachine, RwaStockMachineRedTeam; concrete live adapter/token dependencies remain open |
| Legacy and constellation authority, custody, factory commitments, staged intent identity and budget snapshots | AcquisitionVaultAccounting, AcquisitionVaultOperator, AcquisitionAuthorityTask2, AcquisitionAuthoritySnapshotTask2, AcquisitionConstellationTask1/Task3A/Task3B/Task4BudgetBook/Task5IntentIdentity/Crosswalk; ComprehensiveAcquisitionAudit |
| Registry version/reverse-head identity, expiry and closed-day history | StockTokenRegistryV2 and StockTokenRegistryV2Invariant; RwaHealthIdentityVectors |
| Health-overlay generation/authority/expiry | RwaHealthOverlay, RwaHealthOverlayFuzz, RwaHealthOverlayInvariant; ComprehensiveAcquisitionAudit |
| Settlement gas-pool liabilities, credit calculation, caller callbacks, delayed configuration and migration | SettlementGasPoolCore/Config/Migration/Invariant; ComprehensiveAcquisitionAudit |

Execution outcomes, budgets and raw logs are in the root report and evidence manifest. Interfaces do not receive independent stateful tests; they are exercised through their implementations and consumers. Deployment/test-only mocks are compiled and tested as fixtures but are not included in the production-contract count.

## External scope and limits

The content manifest includes the vendored OpenZeppelin and v4 files and test/reference dependencies. Shared dependency review follows actual access control, signature, token update, math, transfer and Hook call paths. It does not claim independent full review of every unused vendored function. The external integration report pins CCA, Safe and reference ERC-6551 source and used paths; the root report adds LBP/Launcher migration and mainnet runtime observations. Exact addresses, Safe state, an actual Bank vault/asset, RWA token/adapter/feed and production ERC-6551 implementation remain deployment-specific inputs.

The autonomous game API, all gameplay routes, browser UI, every infrastructure component, arbitrary upstream protocols and future acquisition/gas-pool integrations are not independently audited by this contract review. Signer, watcher, database and keeper code is included where it crosses the reviewed contract boundaries, with precisely named tests. No production transaction was broadcast.
`);
console.log(JSON.stringify({files:inventory.length,entries:inventory.reduce((n,f)=>n+f.entries.length,0)}));
