import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const dir = 'omerta-contracts/audits/2026-09-08-comprehensive';
const rawDir = 'output/comprehensive-audit';
const logPath = `${rawDir}/build-sizes-production.log`;
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const pin = path => ({path, sha256: hash(fs.readFileSync(path))});
const log = fs.readFileSync(logPath, 'utf8');
const blocks = log.split(/(?=warning\[)/).filter(block => block.startsWith('warning['));
const scopeFor = path => path.startsWith('src/') ? 'production' : path.startsWith('script/') ? 'operator-script' : path.startsWith('test/') ? 'test-fixture' : 'dependency';
const castDecisions = {
  'src/OmertaHook.sol:548': {
    status: 'bounded-by-runtime-fee-invariant',
    rationale: 'afterSwap -> _fee chooses one int128 BalanceDelta component. On every successful _fee path, its branch-derived magnitude is <= int128.max: the int128.min negative case fails checked negation before conversion. The active sell/surge/opening rate is <= 1000 under the three fee setters; therefore total=floor(base*rate/10000) <= floor(int128.max/10), fitting both uint128 and positive int128. The two nested conversions cannot truncate or change sign on a successful path.',
    sourceTrace: ['src/OmertaHook.sol:305 setSellTax', 'src/OmertaHook.sol:355 setAntiSnipe', 'src/OmertaHook.sol:379 setSurge', 'src/OmertaHook.sol:532 afterSwap', 'src/OmertaHook.sol:594 _fee', 'src/OmertaHook.sol:635 _sellRate', 'src/OmertaHook.sol:661 _openingBuyRate'],
  },
  'src/OmertaHook.sol:625': {
    status: 'sign-separated-conversion',
    rationale: 'The ternary converts -swapperDelta only when swapperDelta<0 and converts swapperDelta only otherwise. Successful checked negation produces [1,int128.max]; the other branch produces [0,int128.max]. int128.min reverts during unary negation, not by silent cast truncation. Conversion to uint128 then widening to uint256 preserves each successful magnitude. This records the existing extreme-value revert instead of claiming the int128.min path succeeds.',
    sourceTrace: ['src/OmertaHook.sol:594 _fee', 'lib/v4-core/src/types/BalanceDelta.sol:61 amount0', 'lib/v4-core/src/types/BalanceDelta.sol:67 amount1'],
  },
  'src/OmrV4TwapOracle.sol:171': {
    status: 'bounded-under-pinned-observation-source-invariant',
    rationale: 'For the intended OmertaHook source, afterInitialize seeds an int24 tick; _writeTickAccumulator integrates the previous int24 tick then loads the next int24 from PoolManager slot0, and currentTickCumulative adds the idle interval. With actual elapsed time <2^32 seconds, the integral magnitude is at most 2^23*(2^32-1)<2^55, so modular int56 subtraction recovers the interval delta even across wrap. Division by the nonzero elapsed interval, with negative-floor correction, remains in the int24 tick range. Hence narrowing the weighted mean preserves it. The constructor checks source interface/code, not bytecode identity: an arbitrary malicious source can violate the invariant, and this disposition explicitly depends on deploying with the verified source. It is not an unconditional cast guard against arbitrary IOmrV4ObservationSource implementations.',
    sourceTrace: ['src/OmrV4TwapOracle.sol:81 constructor', 'src/OmrV4TwapOracle.sol:139 _update', 'src/OmertaHook.sol:454 afterInitialize', 'src/OmertaHook.sol:555 currentTickCumulative', 'src/OmertaHook.sol:575 _writeTickAccumulator'],
  },
  'src/PreVoteBudgetBook.sol:259': {
    status: 'explicit-bound-check',
    rationale: '_deadline rejects ballotDay==uint256.max, checks multiplication/addition headroom before computing (day+1)*1 days+2 hours, and rejects value>uint64.max immediately before uint64(value). No discarded high bit reaches the returned deadline.',
    sourceTrace: ['src/PreVoteBudgetBook.sol:253 _deadline'],
  },
  'src/AcquisitionAuthority.sol:1134': {
    status: 'intentional-abi-selector-extraction',
    rationale: '_validateSignature executes the bounded ERC1271 staticcall, then requires success, exactly 32 returned bytes, post-call gas reserve and the leading bytes4 equal ERC1271 magic. bytes4(result) intentionally selects the ABI bytes4 prefix; the remaining word padding is not an amount, identity, or authorization value discarded by an unsafe numeric cast.',
    sourceTrace: ['src/AcquisitionAuthority.sol:1110 ERC1271 branch', 'src/AcquisitionAuthority.sol:1134 exact success/length/magic check'],
  },
  'src/AcquisitionConstellationFactory.sol:330': {
    status: 'explicit-high-bit-check',
    rationale: '_coreSnapshotAddress rejects word>>160 != 0 before the short-circuited uint160/address comparison. It also binds the canonical decoded address to the exact expected child/core/registry identity. A noncanonical high-bit word cannot pass via truncation.',
    sourceTrace: ['src/AcquisitionConstellationFactory.sol:329 _coreSnapshotAddress'],
  },
  'src/AcquisitionConstellationFactory.sol:344': {
    status: 'explicit-high-bit-check',
    rationale: '_snapshotAddress rejects word>>160 != 0 before the short-circuited uint160/address comparison, then requires the exact expected peer identity. It cannot accept a noncanonical high-bit address word by truncating it.',
    sourceTrace: ['src/AcquisitionConstellationFactory.sol:343 _snapshotAddress'],
  },
  'src/AcquisitionVault.sol:821': {
    status: 'explicit-bound-check',
    rationale: '_checkedTimestamp accepts a uint256 only after rejecting timestamp>uint64.max. The next statement converts the checked value to uint64; callers cannot bypass this helper to reach this conversion.',
    sourceTrace: ['src/AcquisitionVault.sol:819 _checkedTimestamp'],
  },
  'src/AcquisitionVault.sol:939': {
    status: 'intentional-abi-selector-extraction',
    rationale: '_validateSignature checks bounded ERC1271 call success, exact returndata length 32, and the first four bytes of the returned word against ERC1271 magic, with gas checks. bytes4(result) is deliberate extraction of a bytes4 return prefix, not truncation of an economic or address value.',
    sourceTrace: ['src/AcquisitionVault.sol:923 ERC1271 branch', 'src/AcquisitionVault.sol:939 exact success/length/magic check'],
  },
  'script/DeployTwapOracle.s.sol:22': {
    status: 'explicit-operator-input-bound',
    rationale: 'run reads TWAP_PERIOD_SECONDS as uint256 and requires period<=uint32.max at line 19 before startBroadcast and the uint32 constructor argument. Oracle constructor applies its separate minimum-period policy.',
    sourceTrace: ['script/DeployTwapOracle.s.sol:19 period bound'],
  },
  'script/DeployTestnetTwap.s.sol:37': {
    status: 'exact-testnet-constant-bound',
    rationale: 'run requires expectedChainId==46630, the actual matching chain, and period==600 at line 25 before broadcasts and conversion. 600 fits uint32. These virtual testnet dependencies are not approved production price sources.',
    sourceTrace: ['script/DeployTestnetTwap.s.sol:23-25 chain and period checks'],
  },
  'script/DeployV4TwapOracle.s.sol:51': {
    status: 'explicit-operator-input-bound',
    rationale: 'run requires period<=uint32.max at line 30 before startBroadcast and conversion. It binds the reported PoolManager and initialized canonical pool and later compares oracle.PERIOD() to the original uint256. Concrete observation-source code identity remains an activation requirement.',
    sourceTrace: ['script/DeployV4TwapOracle.s.sol:30 period bound', 'script/DeployV4TwapOracle.s.sol:58 period postcheck'],
  },
};
const timestampByPath = {
  'src/RwaStockBuyer.sol': 'Quote timestamps must be nonzero, not in the future, and no older than maxQuoteAge.',
  'src/OmertaBond.sol': 'Oracle freshness and signed-quote expiry/maximum lifetime use the chain clock.',
  'src/AcquisitionAuthority.sol': 'Proposal valid-after/expiry, checked uint64 time headroom, and signed authorization windows are deliberate transition gates.',
  'src/DynastyNFT.sol': 'Signed voucher deadline and maximum voucher lifetime are intentional mint-authorization time bounds.',
  'src/SettlementGasPool.sol': 'Proposal projections distinguish WAITING and EXPIRED by the declared executable/expiry timestamps.',
  'src/FlashGuard.sol': 'Elapsed day windows reset the daily flow accounting boundary.',
  'src/StockTokenRegistry.sol': 'Ballot publication requires a completed UTC day.',
  'src/GenesisOracle.sol': 'A nonzero publication must expire in the future; an expired consult returns the unavailable sentinel.',
  'src/StockTokenRegistryV2.sol': 'Closed ballot days, purchase windows and exact approval-validity intervals are intentional registry transition gates.',
  'src/PreVoteBudgetBook.sol': 'The source explicitly bounds uint64 time and rejects already closed budget days.',
  'src/StockVault.sol': 'A signed allocation must remain within its authorization deadline.',
  'src/StreetDeed.sol': 'Signed voucher deadline and maximum lifetime are deliberate mint-authorization time bounds.',
  'src/RwaHealthOverlay.sol': 'Clearance is valid only after approvedAt and strictly before clearanceDeadline.',
  'src/VoucherClaim.sol': 'Signed withdrawal claim expiry and maximum lifetime use the chain clock.',
  'src/AcquisitionVault.sol': 'Checked proposal-deadline arithmetic, expiry transitions and signed authorization windows require deterministic chain time.',
  'src/AcquisitionVaultCore.sol': 'Explicitly rejecting block.timestamp>uint64.max prevents time truncation.',
  'script/Deploy.s.sol': 'Operator preflight rejects an already closed genesis price window before deployment.',
  'script/UpdateTestnetTwap.s.sol': 'Testnet-only postcondition requires the update just performed to publish the current block timestamp; this is a deployment/rehearsal assertion.',
};
function decide(record) {
  const {scope, rule, path, line} = record;
  if (scope === 'test-fixture') {
    if (rule === 'unchecked-call') return {status: 'excluded-test-fixture', rationale: 'test_task2IngressLastProposalTimestampAndIndependentHashPreimages in AcquisitionAuthorityTask2.t.sol omits the Boolean from a staticcall to its locally constructed authoritySnapshot while deriving an expected hash. It is a test helper, not production authorization logic. The warning remains visible; this pass does not claim every fixture is formally correct.'};
    if (rule === 'erc20-unchecked-transfer') return {status: 'excluded-test-fixture', rationale: 'The unchecked transfer occurs in the retained test/fixture source at this exact location, including setup funding, mock loss/donation simulation or a direct token-behavior test. It is not a production entry point or operator deployment action. No unchecked-production-transfer finding is inferred, and no claim is made that fixture warnings are irrelevant to test quality.'};
    return {status: 'excluded-test-fixture', rationale: 'Test/fixture-only timestamp, rounding or cast diagnostic. It remains individually recorded by source position and rule but is excluded from production finding counts. No production arithmetic-safety conclusion is inferred from a test warning.'};
  }
  if (rule === 'unsafe-typecast') {
    const result = castDecisions[`${path}:${line}`];
    assert(result, `Untriaged production/script cast ${path}:${line}`);
    return result;
  }
  if (rule === 'block-timestamp') {
    const detail = timestampByPath[path];
    assert(detail, `Untriaged timestamp path ${path}`);
    return {status: 'intentional-chain-time-boundary', rationale: `${detail} No randomness is derived by the flagged comparison. These dispositions retain the chain timestamp/sequencer availability assumption rather than asserting an independent wall clock.`};
  }
  if (rule === 'divide-before-multiply' && path === 'src/OmrTwapOracle.sol') return {
    status: 'intentional-fixed-point-accumulation',
    rationale: '_currentCumulativePrices obtains uint112 reserves, rejects zero reserves, and first computes a UQ112 reserve ratio by integer division, then multiplies by uint32 elapsed seconds in wrapping cumulative arithmetic. A ratio is <2^224; the intermediate time product is <2^256. The per-second discarded fraction is less than one UQ112 unit; the formula intentionally matches the V2 cumulative convention rather than dividing a token balance prematurely.',
    sourceTrace: ['src/OmrTwapOracle.sol:201 _currentCumulativePrices', 'src/OmrTwapOracle.sol:212 nonzero-reserve check', 'src/OmrTwapOracle.sol:214-218 wrapping accrual'],
  };
  throw Error(`Unhandled production/script lint ${rule} ${path}:${line}`);
}
const warnings = blocks.map((rawText, ordinal) => {
  const rule = rawText.match(/^warning\[([^\]]+)\]/)?.[1];
  const location = rawText.match(/[╭├]▸ ([^\r\n]+):(\d+):(\d+)/);
  assert(rule && location, `Cannot parse warning ${ordinal}`);
  const path = location[1].replaceAll('\\', '/');
  const record = {id: `FORGE-LINT-${String(ordinal + 1).padStart(3, '0')}`, ordinal, rule, path,
    line: Number(location[2]), column: Number(location[3]), scope: scopeFor(path), rawText};
  return {...record, disposition: decide(record)};
});
const expectedCounts = {'block-timestamp': 51, 'divide-before-multiply': 9, 'erc20-unchecked-transfer': 27, 'unchecked-call': 1, 'unsafe-typecast': 145};
const countsByRule = {};
const countsByScope = {};
const grouping = new Map();
for (const d of warnings) {
  countsByRule[d.rule] = (countsByRule[d.rule] ?? 0) + 1;
  countsByScope[d.scope] ??= {total: 0, rules: {}};
  countsByScope[d.scope].total++;
  countsByScope[d.scope].rules[d.rule] = (countsByScope[d.scope].rules[d.rule] ?? 0) + 1;
  const key = `${d.rule}:${d.path}`;
  if (!grouping.has(key)) grouping.set(key, {rule: d.rule, path: d.path, scope: d.scope, warnings: []});
  grouping.get(key).warnings.push({id: d.id, line: d.line, column: d.column, status: d.disposition.status});
}
for (const [rule, count] of Object.entries(expectedCounts)) assert.equal(countsByRule[rule], count, `Count drift ${rule}`);
assert.equal(warnings.length, 233);
assert.equal(warnings.filter(w => w.scope !== 'test-fixture' && ['unchecked-call', 'erc20-unchecked-transfer'].includes(w.rule)).length, 0);
const tableRows = text => text.split(/\r?\n/).flatMap(line => {
  const m = line.match(/^\|\s+([^|]+?)\s*\|\s*([\d,]+)\s*\|\s*([\d,]+)\s*\|\s*(-?[\d,]+)\s*\|\s*(-?[\d,]+)\s*\|/);
  return m ? [{contractLabel: m[1].trim(), runtimeBytes: Number(m[2].replaceAll(',', '')), initcodeBytes: Number(m[3].replaceAll(',', '')), runtimeMargin: Number(m[4].replaceAll(',', '')), initcodeMargin: Number(m[5].replaceAll(',', ''))}] : [];
});
const initialSizePath = `${rawDir}/build-sizes.log`;
const initialSizeRows = tableRows(fs.readFileSync(initialSizePath, 'utf8'));
const passedSizeRows = tableRows(log);
const oversizeInitial = initialSizeRows.filter(row => row.runtimeMargin < 0 || row.initcodeMargin < 0);
assert.equal(oversizeInitial.length, 1);
assert.equal(oversizeInitial[0].contractLabel, 'FuzzTester');
assert.equal(passedSizeRows.filter(row => row.runtimeMargin < 0 || row.initcodeMargin < 0).length, 0);
const selected = JSON.parse(fs.readFileSync(`${dir}/static-run-selection.json`));
const zeroBytecodeSourceUnits = [];
const compiledTemplateSizes = selected.flatMap(({name}) => {
  const artifactPath = `omerta-contracts/out/${name}.sol/${name}.json`;
  const artifact = JSON.parse(fs.readFileSync(artifactPath));
  assert.equal(artifact.metadata.settings.compilationTarget[`src/${name}.sol`], name);
  const creation = artifact.bytecode.object.replace(/^0x/, '');
  const runtime = artifact.deployedBytecode.object.replace(/^0x/, '');
  assert(/^[0-9a-fA-F]*$/.test(creation) && /^[0-9a-fA-F]*$/.test(runtime), `Unlinked template ${name}`);
  if (runtime.length === 0 && creation.length === 0) {
    zeroBytecodeSourceUnits.push({contract: name, source: `src/${name}.sol`, artifact: pin(artifactPath), disposition: 'Abstract/interface compilation unit with no deployable bytecode; not a size-table omission of a deployed contract.'});
    return [];
  }
  const row = passedSizeRows.find(row => row.contractLabel === name || row.contractLabel.startsWith(`${name} (`));
  assert(row, `Missing production size row ${name}`);
  assert.equal(runtime.length / 2, row.runtimeBytes, `Runtime artifact/log size mismatch ${name}`);
  assert.equal(creation.length / 2, row.initcodeBytes, `Initcode artifact/log size mismatch ${name}`);
  return [{contract: name, source: `src/${name}.sol`, artifact: pin(artifactPath), runtimeBytes: runtime.length / 2,
    creationBytesWithoutConstructorArguments: creation.length / 2, runtimeMargin: row.runtimeMargin,
    initcodeMarginBeforeConstructorArguments: row.initcodeMargin,
    runtimeTemplateSha256: hash(Buffer.from(runtime, 'hex')), creationTemplateSha256: hash(Buffer.from(creation, 'hex')),
    compiler: artifact.metadata.compiler.version, optimizer: artifact.metadata.settings.optimizer,
    evmVersion: artifact.metadata.settings.evmVersion, viaIR: artifact.metadata.settings.viaIR ?? false,
    immutableReferenceCount: Object.keys(artifact.deployedBytecode.immutableReferences ?? {}).length,
  }];
});
const fixtureArtifactPath = 'omerta-contracts/out/FuzzTester.sol/FuzzTester.json';
const fixtureArtifact = JSON.parse(fs.readFileSync(fixtureArtifactPath));
assert.equal(fixtureArtifact.metadata.settings.compilationTarget['test/fizz/FuzzTester.sol'], 'FuzzTester');
const actualFixtureSizes = {runtimeBytes: fixtureArtifact.deployedBytecode.object.replace(/^0x/, '').length / 2,
  initcodeBytes: fixtureArtifact.bytecode.object.replace(/^0x/, '').length / 2};
assert.equal(actualFixtureSizes.runtimeBytes, oversizeInitial[0].runtimeBytes);
assert.equal(actualFixtureSizes.initcodeBytes, oversizeInitial[0].initcodeBytes);
const initialExit = Number(fs.readFileSync(`${rawDir}/build-sizes.exit.txt`, 'utf8').trim());
const correctedExit = Number(fs.readFileSync(`${rawDir}/build-sizes-production.exit.txt`, 'utf8').trim());
assert.equal(initialExit, 1);
assert.equal(correctedExit, 0);
const result = {
  date: '2026-09-08', command: 'node omerta-contracts/audits/2026-09-08-comprehensive/triage-forge-lint.mjs', node: process.version,
  scope: 'Every Forge lint warning retained in build-sizes-production.log, grouped by rule and source path. A separate method/output family from the 1,616 baseline Slither diagnostics.',
  inputs: [pin(logPath), pin(initialSizePath), pin(`${rawDir}/build-sizes.exit.txt`), pin(`${rawDir}/build-sizes-production.exit.txt`)],
  sourcePinsAtTriage: [...new Set(warnings.map(w => `omerta-contracts/${w.path}`))].sort().map(pin),
  counts: {total: warnings.length, byRule: countsByRule, byScope: countsByScope, unassigned: 0, nonTestUncheckedTransfers: 0, nonTestUncheckedCalls: 0},
  rulePathGroups: [...grouping.values()],
  boundsNotes: {
    hookFeeOutput: `floor(int128.max/10)=${((1n << 127n) - 1n) / 10n}; smaller than int128.max and uint128.max.`,
    meanTickIntegral: `2^23*(2^32-1)=${(1n << 23n) * ((1n << 32n) - 1n)} < 2^55=${1n << 55n}; valid for the bound-preserving intended observation source and actual intervals under 2^32 seconds.`,
    tokenCallScope: 'All 27 unchecked ERC20 transfer diagnostics and the single unchecked-call diagnostic are under test/. There is no production call site in this log to dismiss or remediate under those rules. Absence of such a warning is not an independent proof that every production transfer is safe; shared-static-triage.json and contract reviews retain the separate production call-path analysis.',
  },
  sizeCheck: {
    initialExit, correctedExit, initialOversizeRows: oversizeInitial,
    excludedFixture: {source: pin('omerta-contracts/test/fizz/FuzzTester.sol'), artifact: pin(fixtureArtifactPath),
      compilationTarget: fixtureArtifact.metadata.settings.compilationTarget, ...actualFixtureSizes,
      disposition: 'Local test/fizz/FuzzTester.sol inherits the fuzz handler suite and runs setup in its constructor. It is not a production deployment contract. The artifact explicitly identifies this local test source; it is not an imported lib/v4-core FuzzTester.',
    },
    correctedCommandScope: 'The owner/root retained the successful forge build --sizes run with --skip FuzzTester. The log confirms compiler success, no remaining negative size margins and exit 0. This triage did not rerun the compiler.',
    unchangedWarningVisibility: 'The successful size check still emitted these 233 lint warnings; size success is not presented as a warning-free security scan.',
    productionTemplateCount: compiledTemplateSizes.length,
    zeroBytecodeSourceUnits,
    allListedProductionTemplatesWithinRuntimeLimit: compiledTemplateSizes.every(row => row.runtimeMargin >= 0),
    templates: compiledTemplateSizes,
    limits: 'These are local compiler bytecode-template sizes, not verified deployed-code hashes. Runtime immutable values may be substituted at deployment. Creation template size excludes ABI constructor arguments and actual deployment checks must account for the complete initcode. No production deployment or network activation is authorized by this size check.',
  },
  warnings,
};
fs.writeFileSync(`${dir}/forge-lint-triage.json`, JSON.stringify(result, null, 2) + '\n');
const sizeSorted = [...compiledTemplateSizes].sort((a,b) => b.runtimeBytes-a.runtimeBytes);
const productionCastRows = [...new Set(warnings.filter(w=>w.scope==='production'&&w.rule==='unsafe-typecast').map(w=>`${w.path}:${w.line}`))]
  .map(key => `| ${key} | ${castDecisions[key].status} | ${castDecisions[key].rationale} |`).join('\n');
const pathRows = result.rulePathGroups.map(g => `| ${g.scope} | ${g.rule} | ${g.path} | ${g.warnings.length} |`).join('\n');
const md = `# Forge lint and size evidence — 2026-09-08

The retained successful size-build log contains **233 lint warnings**. All are accounted for by exact
rule, file, line and column in [forge-lint-triage.json](forge-lint-triage.json): **61 production warnings,
5 operator-script warnings, and 167 test/fixture warnings**, with zero unassigned records. These are
Forge lint diagnostics, separate from the retained Slither baseline, and are not additional confirmed
vulnerabilities.

| Rule | Production | Operator scripts | Tests/fixtures | Total |
| --- | ---: | ---: | ---: | ---: |
| block-timestamp | 46 | 2 | 3 | 51 |
| unsafe-typecast | 13 | 3 | 129 | 145 |
| divide-before-multiply | 2 | 0 | 7 | 9 |
| erc20-unchecked-transfer | 0 | 0 | 27 | 27 |
| unchecked-call | 0 | 0 | 1 | 1 |

**Every unchecked transfer/call warning is in a test file.** The 27 transfer warnings cover fixture
funding, mock loss/donation paths and token-behavior tests. The single unchecked call is
test/AcquisitionAuthorityTask2.t.sol:1362, where a test discards the Boolean from a staticcall to its
locally deployed authoritySnapshot while deriving an expected hash. None is a production or deployment
script entry point. They remain visible as test-quality observations; this does not establish that
all production transfers are safe merely because the linter did not flag them. The direct contract
and shared dependency reviews retain that separate call-path analysis.

Every production cast site was followed through its runtime bounds. The table groups repeated nested
casts on the same source line; the JSON still preserves all 13 individual warning positions.

| Source | Disposition | Bound or exact runtime path |
| --- | --- | --- |
${productionCastRows}

The v4 mean-tick result is therefore **conditional on the intended observation source**, not validated
against an arbitrary malicious implementation merely because it advertises the interface. This source
binding remains an activation requirement. Its modular-time convention also assumes the real interval
is under 2^32 seconds. The Hook's int128.min negation path reverts before any truncating cast; this pass
does not claim that extreme input succeeds.

The three operator-script casts have explicit preconditions: DeployTwapOracle and DeployV4TwapOracle
check period<=uint32.max before broadcasting; DeployTestnetTwap requires the testnet chain and
period==600. The 48 production/script timestamp warnings implement freshness, signed expiry,
proposal/UTC transitions, overflow guards or deployment postconditions. None of the flagged
comparisons is used as randomness, and chain timestamp/sequencer availability remains an assumption.

The two production divide-before-multiply warnings are the V2 oracle's UQ112 cumulative prices.
Nonzero uint112 reserves bound the ratio below 2^224, and the uint32 elapsed-time product fits uint256.
It intentionally truncates the fixed-point ratio before the wrapping cumulative accrual to match the
V2 convention; the discarded fraction is less than one UQ112 unit per second.

The initial size run exited **1** because **FuzzTester alone** exceeded the listed limits:
**27,614 runtime bytes and 110,798 creation-template bytes**. Its retained artifact identifies
**test/fizz/FuzzTester.sol**, a local fuzz harness that inherits the handler suite and calls setup in
its constructor. It is not an imported v4 production contract. The corrected size check excluded this
fixture with --skip FuzzTester and exited **0**; every remaining table entry has nonnegative margins.
The original failed log and the successful log are both pinned in the JSON, preserving the exclusion.

The existing compiled JSON artifacts for all **${compiledTemplateSizes.length} deployable selected local production contracts** match
their successful-build size rows. The selected FlashGuard abstract source has zero bytecode and is
recorded separately rather than treated as a deployed contract. The largest local runtime templates are:

| Contract | Runtime bytes | Runtime margin | Creation-template bytes |
| --- | ---: | ---: | ---: |
${sizeSorted.slice(0, 8).map(row=>`| ${row.contract} | ${row.runtimeBytes.toLocaleString('en-US')} | ${row.runtimeMargin.toLocaleString('en-US')} | ${row.creationBytesWithoutConstructorArguments.toLocaleString('en-US')} |`).join('\n')}

These are compiler templates, not live deployment verification. The JSON records source targets,
artifact/template hashes, compiler/optimizer/EVM settings and immutable-reference counts. Constructor
arguments must still be included in an actual initcode-limit check; runtime-template hashes must not
be represented as observed deployed-code hashes.

Reproduce this evidence-only reconciliation with
\`node omerta-contracts/audits/2026-09-08-comprehensive/triage-forge-lint.mjs\`.
It asserts all 233 warnings, exact expected rule counts, an explicit disposition for every non-test
cast, zero non-test unchecked-call/transfer warnings, the fixture provenance, the two exit codes,
and equality between all ${compiledTemplateSizes.length} deployable local production artifact sizes and the successful log. It completed
under Node ${process.version} with exit 0. No compiler was rerun and no production/test/out/cache file
was modified by this subtask.

## Rule and path inventory

| Scope | Rule | Path | Warnings |
| --- | --- | --- | ---: |
${pathRows}
`;
fs.writeFileSync(`${dir}/forge-lint-triage.md`, md);
console.log(JSON.stringify({output: `${dir}/forge-lint-triage.json`, counts: result.counts, sizeTemplates: compiledTemplateSizes.length, excludedFixture: result.sizeCheck.excludedFixture.compilationTarget, largestProductionTemplates: sizeSorted.slice(0,3).map(({contract,runtimeBytes})=>({contract,runtimeBytes}))}));
