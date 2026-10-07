# Approved genesis deployment review evidence

Implementation revision: aca24128dd4205f78887c592e2155320721a2262. Phase: predeployment. Exact source hashes are in release-source-pins.json. Financial-contract source stayed unchanged during the final signing-page fix.

## Selected launch

One five-day NFT-gated ETH/OMR auction: 40M OMR sold, 20M paired using 50% of accepted ETH, 40M retained by the existing Safe for future bonds. All remaining accepted ETH accrues to that Safe's Family Yield treasury. Graduation is 10 ETH; claims require successful closure and bid exit, independently of LP migration. The funded opening LP price can differ from the final auction price. Bond operation and automatic ETH distribution/conversion remain separate.

Founder/operations is permanently 2% of gross sell value with the approved A87 recipient. The Safe alone queues/cancels/executes bounded other tax settings after 48 hours. This does not prove a Committee vote on chain. Launch LP fee is static 0.3%, opening restrictions off.

## Findings and retests

F01: OMR supply drift could bypass API admission. Fixed immutable validator supply/runtime checks on both bid overloads; exit/refund/claim recovery remains usable. F02: forced or LP-returned ETH could strand. Fixed Safe-only surplus recovery reserving all outstanding credits. Original review, retest and focused/full/fork evidence retained.

H01: planner allowed unapproved LP/opening settings. Production policy now rejects them. H02: hook creation data was not source-bound by the signing page. Fixed trusted compiled template, canonical constructor, CREATE2 and permission checks. H03: the other four creations were packet-trusted. Fixed trusted templates and exact complete canonical adapter/coordinator/auction constructor reconstruction, including independently derived issuance schedule. Daybreak's original findings and successive retests remain unchanged. Its final H03 retest resolves the finding at the implementation revision above.

An actual rehearsal exposed a mocked nonexistent auction getter; tickSpacing() is now used. Daybreak independently verified 70/70 backend target-selector pairs against actual compiled ABIs.

## Executed evidence

Governance: 29 focused tests with 512 fuzz runs and two 64x64 invariants; full warm suite 1,357 passing tests across 96 suites with fuzz128/invariants32x64. Two optional forks were skipped in that suite; earlier two explicit Robinhood fork runs are separately retained. Full test totals are point-in-time evidence, not guarantees.

Actual local dry-fork: five main plus two internal runtimes and 72 EVM getter results verified. The primary-chain preflight rechecked supply100M, Safe custody100M, threshold2, minter0/taxoff, dependencies, nonce and native clock. Original ArbSys code was preserved, but its return was mocked to the captured primary native block; this is not native-chain execution proof. Safe impersonation occurred only in local simulation and grants no live authority.

Node participant, HTTP, recovery, planner44negative, preflight, signing and trusted-asset checks passed. The real planner/rehearsal payloads also pass complete all-five constructor checks in an in-memory test; no signing-ready packet was saved or published.

## Limits and remaining release gates

Hosted checks, final fresh signing-packet verification, human wallet signatures, deployed-runtime verification, Safe funding, coordinator binding and production manifest activation remain separate. This package neither broadcasts nor certifies live activation. signingReady remains false in retained technical preflight. Existing OMR/NFT/fee contracts are reused after verification.

Optional static-tool/compiler limitations and initial failed fixtures remain visible in original evidence. No static-clean or zero-exploit guarantee is asserted. Runtime hash evidence remains authorized through the manually reviewed packet digest; the browser now independently binds all creation code and constructor data.

Evidence copies use UTF-8 LF. retention-pins.json maps original external-file hashes to retained hashes; original files remain in the parent output directory. reviewer-invocation.json records actual parent Daybreak invocations and clarifies the earlier report's failed nested invocation without altering its text. retained-package-pins.json verifies all retained files except itself.

## Hosted-check caller follow-up

The first hosted contract job caught a shared market planner still passing the old nine-argument hook constructor. Follow-up revision e5eaa1857dafa46e5fb00a5481a3e4414d2b16df derives argument ten from the existing Safe, adds exact-authority/override regression checks, and narrowly handles the existing Permit2 mount while retaining all imported source hash checks. The 15-check artifact-backed planner, keeper and solver suite passed. Financial contracts and the reviewed signing page are unchanged. Original hosted failure and follow-up source pins are retained; final hosted gates remain required.
