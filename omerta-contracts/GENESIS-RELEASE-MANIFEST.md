# OMERTÀ Genesis production release manifest

This is the machine-verifiable final ceremony for `GENESIS-LAUNCH.md`. It turns the launch's remaining
human and external gates into one unsigned, hash-bound record. It does not replace an external audit,
prove that an auditor is who they claim to be, approve a recipient, sign a Safe transaction, or send a
transaction. Those remain human responsibilities; the tool proves that the evidence exists, is bound to
one clean commit and one exact calldata payload, and satisfies the reviewed release shape.

The release command fails closed unless all of these are simultaneously true:

- the Git tree is clean and the audit scope commit equals `HEAD`;
- every launch source/tool/runbook file and all three launch Foundry artifacts are present and hashed;
- the audit is marked passed, includes the shared signer and eight named launch surfaces, and has no open
  critical or high findings;
- the launch Safe is exactly 2-of-3 with distinct owners;
- recipient, treasury-allocation, zero-tax, and LP-custody decisions have evidence;
- a fresh chain-4663 cadence sample spans at least three minutes, includes finalized blocks, and derives
  the exact auction and claim block counts used by the launch builder;
- a second operator approved the derived timeline and finality/lead-block observations;
- the chain-4663 fork rehearsal is marked passed and declares its ArbSys shim and zero-production posture;
- the live preflight and Safe simulation passed before `startBlock`;
- at least two independent decoder records and the Safe approvals all bind the launch calldata digest
  printed by `genesis:config`.

## 1. Freeze and compile

Start from the exact candidate commit. Run the complete tests and force a clean Foundry build so the
artifact hashes correspond to that source:

```powershell
npm test
$env:FOUNDRY_PROFILE = 'default'
forge build --force --root .\omerta-contracts
forge test --root .\omerta-contracts
git status --short
```

The last command must print nothing. Keep the release-review JSON and audit/operator evidence outside
the repository; an untracked review file intentionally makes the release command refuse the tree.

After committing, print the deterministic auditor inventory:

```powershell
npm run genesis:inventory
```

It binds the full commit, every launch source/tool/runbook SHA-256, the Foundry configuration, and
creation/runtime bytecode Keccak hashes for `OmertaHook`, `GenesisProceedsSplitter`, and
`OmrV4TwapOracle`. Send this output with the source commit and audit packet; regenerate it after any
source, compiler configuration, artifact, Node version, or commit change.

## 2. Measure BlockNumberish, do not reuse an old constant

Immediately before choosing `startBlock`, sample the production RPC for at least three minutes:

```powershell
$env:CHAIN_RPC_URL = 'https://rpc.mainnet.chain.robinhood.com'
npm run genesis:cadence -- --duration-seconds 180 --interval-seconds 30 --rpc-class public
```

Capture stdout in the access-controlled launch evidence store. The sampler reads chain id, ArbSys
`arbBlockNumber()`, latest block, latest timestamp, and finalized block. It prints no RPC URL and never
signs, broadcasts, or writes. Its normalized evidence digest binds every sample.

Block counts use ceiling division so a measured cadence never deliberately shortens the approved
72-hour auction or 24-hour claim cliff. A second operator must independently reproduce those counts.
The sample is valid for the final manifest for one hour at most; a delayed ceremony requires a fresh run.

## 3. Assemble public release metadata outside the repository

The review file contains no secret. Never put a private key, mnemonic, keystore, password, RPC secret,
or Safe signing material in it. Evidence is referenced by path and reduced to SHA-256; the paths are not
included in the output. Every referenced item must be a regular non-symlink file that stays unchanged
while it is hashed.

The complete shape is:

```json
{
  "launch": {
    "token": "<OMR>",
    "launchOwner": "<2_OF_3_LAUNCH_SAFE>",
    "treasury": "<TREASURY_RECIPIENT>",
    "vigRecipient": "<VIG_RECIPIENT>",
    "founderRecipient": "<FOUNDER_RECIPIENT>",
    "proceedsSplitter": "<DEPLOYED_SPLITTER>",
    "positionRecipient": "<REVIEWED_LP_CUSTODY>",
    "hook": "<MINED_0x30cc_HOOK>",
    "salt": "<UNIQUE_32_BYTE_SALT>",
    "startBlock": "<APPROVED_FUTURE_BLOCK>",
    "auctionBlocks": "<CADENCE_DERIVED_72H_BLOCKS>",
    "prebidBlocks": "0",
    "claimDelayBlocks": "<CADENCE_DERIVED_24H_BLOCKS>",
    "permit2Expiration": "<REVIEWED_UNIX_SECONDS>",
    "requiredCurrencyRaised": "10000000000000000000"
  },
  "audit": {
    "status": "passed",
    "scopeCommit": "<40_CHARACTER_HEAD_COMMIT>",
    "reportPath": "<AUDIT_REPORT_FILE>",
    "reviewer": "<AUDIT_FIRM_OR_REVIEW_ID>",
    "unresolvedCritical": 0,
    "unresolvedHigh": 0,
    "signerIncluded": true,
    "scope": {
      "initializerHook": true,
      "tickAccumulator": true,
      "v4Oracle": true,
      "proceedsSplitter": true,
      "omrTransferBehavior": true,
      "lbpFailureBranch": true,
      "forkEvidence": true,
      "sharedSigner": true
    }
  },
  "governance": {
    "launchSafe": {
      "address": "<2_OF_3_LAUNCH_SAFE>",
      "owners": ["<OWNER_1>", "<OWNER_2>", "<OWNER_3>"],
      "threshold": 2
    },
    "recipientsApproved": true,
    "recipientDecisionPath": "<SIGNED_RECIPIENT_DECISION>",
    "treasuryAllocationApproved": true,
    "treasuryAllocationOmr": "6063750000000000000000000",
    "treasuryAllocationPath": "<SIGNED_TREASURY_ALLOCATION>",
    "taxesRemainZeroThroughFirstBond": true,
    "lpCustody": {
      "kind": "safe",
      "address": "<REVIEWED_LP_CUSTODY>",
      "owners": ["<LP_OWNER_1>", "<LP_OWNER_2>", "<LP_OWNER_3>"],
      "threshold": 2,
      "reviewPath": "<LP_CUSTODY_REVIEW>",
      "recoverySimulationPath": "<LP_RECOVERY_AND_FEE_SIMULATION>"
    }
  },
  "cadenceEvidencePath": "<FRESH_CADENCE_JSON>",
  "timingApproval": {
    "independentlyRecomputed": true,
    "finalityLagReviewed": true,
    "leadBlocksApproved": true,
    "startBlock": "<APPROVED_FUTURE_BLOCK>",
    "auctionBlocks": "<CADENCE_DERIVED_72H_BLOCKS>",
    "claimDelayBlocks": "<CADENCE_DERIVED_24H_BLOCKS>",
    "approvalPath": "<SECOND_OPERATOR_TIMING_APPROVAL>"
  },
  "forkRehearsal": {
    "chainId": 4663,
    "blockNumber": "47283811",
    "passed": true,
    "archivePath": "<HASH_MANIFESTED_FORK_ARCHIVE>",
    "noProductionBroadcasts": true,
    "noProductionKeysRead": true,
    "arbSysShimDeclared": true
  },
  "safeCeremony": {
    "safeAddress": "<2_OF_3_LAUNCH_SAFE>",
    "safeTransactionHash": "<32_BYTE_SAFE_TRANSACTION_HASH>",
    "preflight": {
      "status": "passed",
      "chainId": 4663,
      "blockNumber": "<PREFLIGHT_BLOCK>",
      "stackRuntimeHashesMatch": true,
      "readinessPassed": true,
      "launchCalldataKeccak256": "<GENESIS_CONFIG_LAUNCH_DIGEST>",
      "evidencePath": "<PREFLIGHT_JSON>"
    },
    "simulation": {
      "status": "passed",
      "chainId": 4663,
      "blockNumber": "<SIMULATION_BLOCK>",
      "launchCalldataKeccak256": "<GENESIS_CONFIG_LAUNCH_DIGEST>",
      "evidencePath": "<SAFE_SIMULATION_REPORT>"
    },
    "decoders": [
      {
        "operatorId": "operator-a",
        "launchCalldataKeccak256": "<GENESIS_CONFIG_LAUNCH_DIGEST>",
        "evidencePath": "<OPERATOR_A_DECODE>"
      },
      {
        "operatorId": "operator-b",
        "launchCalldataKeccak256": "<GENESIS_CONFIG_LAUNCH_DIGEST>",
        "evidencePath": "<OPERATOR_B_DECODE>"
      }
    ],
    "approvalsRecorded": true,
    "approvalsPath": "<SAFE_APPROVAL_RECORD>"
  }
}
```

For an audited LP lock, use `"kind": "audited_lock"` and omit `owners`/`threshold`; the review and
recovery/fee simulation remain mandatory. A Safe may differ from the launch Safe, but it must still be
an explicit 2-of-3 with three distinct owners.

## 4. Generate and independently sign the manifest digest

After preparation calls, live read-only preflight, independent decoding, simulation, and Safe approvals:

```powershell
npm run genesis:release -- C:\secure-launch-evidence\genesis-release-review.json
```

The output includes the full unsigned calls, source hashes, Foundry artifact hashes, creation/runtime
bytecode Keccak hashes, external-stack pins, cadence samples and derivation, evidence hashes, Safe
transaction hash, and one `manifestSha256`. Two operators compare the entire output and sign that final
digest through the approved evidence-signing process. Execute only the Safe transaction whose hash and
calldata digest appear in that signed manifest.

Any source, artifact, address, custody decision, timeline, calldata, preflight result, simulation,
approval, or evidence-file change invalidates the digest. Stop and regenerate instead of editing output.

## 5. What this deliberately cannot prove

- A SHA-256 digest proves file identity, not that the audit or governance decision is genuine. Operators
  must authenticate the external signer and approval channel independently.
- A Foundry artifact hash records compiled output but does not prove reproducible compilation by itself.
  The external reviewer must reproduce bytecode from the frozen commit and compiler configuration.
- A passed simulation is not execution. Chain state can change; rerun cadence and preflight if the ceremony
  moves, and stop if any read differs.
- The manifest never gains signing or broadcast authority. Safe owners remain the only execution boundary.
