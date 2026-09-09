# Forge lint and size evidence — 2026-09-08

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
| src/OmertaHook.sol:548 | bounded-by-runtime-fee-invariant | afterSwap -> _fee chooses one int128 BalanceDelta component. On every successful _fee path, its branch-derived magnitude is <= int128.max: the int128.min negative case fails checked negation before conversion. The active sell/surge/opening rate is <= 1000 under the three fee setters; therefore total=floor(base*rate/10000) <= floor(int128.max/10), fitting both uint128 and positive int128. The two nested conversions cannot truncate or change sign on a successful path. |
| src/OmrV4TwapOracle.sol:171 | bounded-under-pinned-observation-source-invariant | For the intended OmertaHook source, afterInitialize seeds an int24 tick; _writeTickAccumulator integrates the previous int24 tick then loads the next int24 from PoolManager slot0, and currentTickCumulative adds the idle interval. With actual elapsed time <2^32 seconds, the integral magnitude is at most 2^23*(2^32-1)<2^55, so modular int56 subtraction recovers the interval delta even across wrap. Division by the nonzero elapsed interval, with negative-floor correction, remains in the int24 tick range. Hence narrowing the weighted mean preserves it. The constructor checks source interface/code, not bytecode identity: an arbitrary malicious source can violate the invariant, and this disposition explicitly depends on deploying with the verified source. It is not an unconditional cast guard against arbitrary IOmrV4ObservationSource implementations. |
| src/OmertaHook.sol:625 | sign-separated-conversion | The ternary converts -swapperDelta only when swapperDelta<0 and converts swapperDelta only otherwise. Successful checked negation produces [1,int128.max]; the other branch produces [0,int128.max]. int128.min reverts during unary negation, not by silent cast truncation. Conversion to uint128 then widening to uint256 preserves each successful magnitude. This records the existing extreme-value revert instead of claiming the int128.min path succeeds. |
| src/PreVoteBudgetBook.sol:259 | explicit-bound-check | _deadline rejects ballotDay==uint256.max, checks multiplication/addition headroom before computing (day+1)*1 days+2 hours, and rejects value>uint64.max immediately before uint64(value). No discarded high bit reaches the returned deadline. |
| src/AcquisitionAuthority.sol:1134 | intentional-abi-selector-extraction | _validateSignature executes the bounded ERC1271 staticcall, then requires success, exactly 32 returned bytes, post-call gas reserve and the leading bytes4 equal ERC1271 magic. bytes4(result) intentionally selects the ABI bytes4 prefix; the remaining word padding is not an amount, identity, or authorization value discarded by an unsafe numeric cast. |
| src/AcquisitionConstellationFactory.sol:330 | explicit-high-bit-check | _coreSnapshotAddress rejects word>>160 != 0 before the short-circuited uint160/address comparison. It also binds the canonical decoded address to the exact expected child/core/registry identity. A noncanonical high-bit word cannot pass via truncation. |
| src/AcquisitionConstellationFactory.sol:344 | explicit-high-bit-check | _snapshotAddress rejects word>>160 != 0 before the short-circuited uint160/address comparison, then requires the exact expected peer identity. It cannot accept a noncanonical high-bit address word by truncating it. |
| src/AcquisitionVault.sol:821 | explicit-bound-check | _checkedTimestamp accepts a uint256 only after rejecting timestamp>uint64.max. The next statement converts the checked value to uint64; callers cannot bypass this helper to reach this conversion. |
| src/AcquisitionVault.sol:939 | intentional-abi-selector-extraction | _validateSignature checks bounded ERC1271 call success, exact returndata length 32, and the first four bytes of the returned word against ERC1271 magic, with gas checks. bytes4(result) is deliberate extraction of a bytes4 return prefix, not truncation of an economic or address value. |

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

The existing compiled JSON artifacts for all **30 deployable selected local production contracts** match
their successful-build size rows. The selected FlashGuard abstract source has zero bytecode and is
recorded separately rather than treated as a deployed contract. The largest local runtime templates are:

| Contract | Runtime bytes | Runtime margin | Creation-template bytes |
| --- | ---: | ---: | ---: |
| AcquisitionVault | 23,212 | 1,364 | 25,120 |
| AcquisitionAuthority | 16,300 | 8,276 | 18,868 |
| SettlementGasPool | 14,458 | 10,118 | 15,574 |
| StreetDeed | 12,690 | 11,886 | 14,403 |
| Alchemist | 11,408 | 13,168 | 13,238 |
| OmertaHook | 11,061 | 13,515 | 11,692 |
| GearVault | 10,999 | 13,577 | 11,829 |
| AcquisitionVaultCore | 9,988 | 14,588 | 11,264 |

These are compiler templates, not live deployment verification. The JSON records source targets,
artifact/template hashes, compiler/optimizer/EVM settings and immutable-reference counts. Constructor
arguments must still be included in an actual initcode-limit check; runtime-template hashes must not
be represented as observed deployed-code hashes.

Reproduce this evidence-only reconciliation with
`node omerta-contracts/audits/2026-09-08-comprehensive/triage-forge-lint.mjs`.
It asserts all 233 warnings, exact expected rule counts, an explicit disposition for every non-test
cast, zero non-test unchecked-call/transfer warnings, the fixture provenance, the two exit codes,
and equality between all 30 deployable local production artifact sizes and the successful log. It completed
under Node v24.19.0 with exit 0. No compiler was rerun and no production/test/out/cache file
was modified by this subtask.

## Rule and path inventory

| Scope | Rule | Path | Warnings |
| --- | --- | --- | ---: |
| production | block-timestamp | src/RwaStockBuyer.sol | 2 |
| test-fixture | unsafe-typecast | test/fizz/handlers/TransmuterHandler.sol | 1 |
| production | block-timestamp | src/OmertaBond.sol | 3 |
| production | block-timestamp | src/AcquisitionAuthority.sol | 8 |
| test-fixture | unsafe-typecast | test/fizz/utils/DecimalPrinter.sol | 3 |
| production | block-timestamp | src/DynastyNFT.sol | 2 |
| test-fixture | block-timestamp | test/fizz/utils/MockERC20.sol | 1 |
| test-fixture | unsafe-typecast | test/RwaHealthOverlayInvariant.t.sol | 2 |
| test-fixture | unsafe-typecast | test/fizz/utils/StringUtils.sol | 3 |
| production | block-timestamp | src/SettlementGasPool.sol | 4 |
| test-fixture | block-timestamp | test/fizz/handlers/OmrTwapOracleHandler.sol | 1 |
| test-fixture | divide-before-multiply | test/fizz/utils/FuzzMocks.sol | 2 |
| production | divide-before-multiply | src/OmrTwapOracle.sol | 2 |
| production | block-timestamp | src/FlashGuard.sol | 1 |
| production | unsafe-typecast | src/OmertaHook.sol | 6 |
| production | block-timestamp | src/StockTokenRegistry.sol | 1 |
| production | block-timestamp | src/GenesisOracle.sol | 3 |
| production | unsafe-typecast | src/OmrV4TwapOracle.sol | 1 |
| test-fixture | unsafe-typecast | test/SettlementGasPoolInvariant.t.sol | 3 |
| test-fixture | erc20-unchecked-transfer | test/GenesisProceedsSplitter.t.sol | 1 |
| production | block-timestamp | src/StockTokenRegistryV2.sol | 4 |
| production | block-timestamp | src/PreVoteBudgetBook.sol | 2 |
| test-fixture | unsafe-typecast | test/SettlementGasPoolMigration.t.sol | 3 |
| production | block-timestamp | src/StockVault.sol | 1 |
| test-fixture | erc20-unchecked-transfer | test/Omerta.t.sol | 2 |
| production | unsafe-typecast | src/PreVoteBudgetBook.sol | 1 |
| production | block-timestamp | src/StreetDeed.sol | 2 |
| test-fixture | unsafe-typecast | test/AcquisitionVaultAccounting.t.sol | 8 |
| production | block-timestamp | src/RwaHealthOverlay.sol | 2 |
| operator-script | block-timestamp | script/Deploy.s.sol | 1 |
| test-fixture | divide-before-multiply | test/OmertaBond.t.sol | 1 |
| production | block-timestamp | src/VoucherClaim.sol | 2 |
| test-fixture | divide-before-multiply | test/StockTokenRegistryV2.t.sol | 1 |
| test-fixture | erc20-unchecked-transfer | test/OmertaBond.t.sol | 1 |
| test-fixture | unchecked-call | test/AcquisitionAuthorityTask2.t.sol | 1 |
| operator-script | unsafe-typecast | script/DeployTestnetTwap.s.sol | 1 |
| test-fixture | erc20-unchecked-transfer | test/Bank.t.sol | 2 |
| test-fixture | divide-before-multiply | test/audit/ComprehensiveCoreAudit.t.sol | 1 |
| production | unsafe-typecast | src/AcquisitionAuthority.sol | 1 |
| test-fixture | unsafe-typecast | test/AcquisitionAuthorityTask2.t.sol | 11 |
| test-fixture | block-timestamp | test/audit/ComprehensiveCoreAudit.t.sol | 1 |
| operator-script | unsafe-typecast | script/DeployTwapOracle.s.sol | 1 |
| test-fixture | erc20-unchecked-transfer | test/audit/ComprehensiveCoreAudit.t.sol | 3 |
| production | unsafe-typecast | src/AcquisitionConstellationFactory.sol | 2 |
| operator-script | unsafe-typecast | script/DeployV4TwapOracle.s.sol | 1 |
| test-fixture | erc20-unchecked-transfer | test/OmertaHook.t.sol | 2 |
| operator-script | block-timestamp | script/UpdateTestnetTwap.s.sol | 1 |
| test-fixture | unsafe-typecast | test/CharacterLaunchAudit.t.sol | 2 |
| test-fixture | erc20-unchecked-transfer | test/audit/ComprehensiveMarketAudit.t.sol | 1 |
| test-fixture | divide-before-multiply | test/OmrTwapOracle.t.sol | 2 |
| test-fixture | unsafe-typecast | test/audit/ComprehensiveMarketAudit.t.sol | 1 |
| test-fixture | erc20-unchecked-transfer | test/OMRTax.t.sol | 11 |
| production | block-timestamp | src/AcquisitionVault.sol | 8 |
| test-fixture | erc20-unchecked-transfer | test/audit/OmertaHookObserverDoS.t.sol | 2 |
| test-fixture | erc20-unchecked-transfer | test/fizz/Base.sol | 1 |
| test-fixture | unsafe-typecast | test/fizz/handlers/AlchemistHandler.sol | 2 |
| test-fixture | unsafe-typecast | test/OmertaHook.t.sol | 4 |
| test-fixture | unsafe-typecast | test/AcquisitionVaultOperator.t.sol | 43 |
| test-fixture | unsafe-typecast | test/audit/OmertaHookObserverDoS.t.sol | 1 |
| test-fixture | unsafe-typecast | test/AcquisitionConstellationCrosswalk.t.sol | 4 |
| test-fixture | erc20-unchecked-transfer | test/audit/AlchemistRedTeam.t.sol | 1 |
| production | unsafe-typecast | src/AcquisitionVault.sol | 2 |
| production | block-timestamp | src/AcquisitionVaultCore.sol | 1 |
| test-fixture | unsafe-typecast | test/AcquisitionConstellationTask4BudgetBook.t.sol | 7 |
| test-fixture | unsafe-typecast | test/AcquisitionConstellationTask3B.t.sol | 31 |
