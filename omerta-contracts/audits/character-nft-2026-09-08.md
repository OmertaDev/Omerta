# Character NFT and mint-fee security review — 2026-09-08

This agent-led review covers `OmertaFees`, `DynastyNFT`, and the backend payment, voucher,
indexing and portrait paths needed for the first character NFT release. No unauthorized
contract mint, transfer or loss of forwarded fees was reproduced in this scope. Confirmed
backend defects were corrected and regression-tested. Public paid checkout is not ready:
the open items below remain part of the release work.

This is a review of the working tree based on commit
`e1d0e8476b6f1ebf590b13bd07c072d9d9d33aee`, including uncommitted changes. The accompanying
[evidence manifest](character-nft-2026-09-08.json) pins reviewed source and evidence hashes.
It does not clear the ten-contract core deployment, token issuance, bonds, liquidity,
RWA delivery, THE BANK or withdrawal rails. No public transaction was broadcast and no
production database, credential or service configuration was changed for this review.

## Method and system model

The [review policy](../SECURITY-REVIEW-POLICY.md) pins the three requested methodology
repositories. Applied methods were Pashov's attack-path and assumption review, Plamen's
NFT checklist and executed-impact proof discipline, and Trail of Bits' context building,
secure workflow, property-based testing and false-positive verification. Three bounded
parallel passes covered contracts, backend and periphery; the parent performed the backend
remediation and verification. Upstream installers and full orchestrators were not run.

The assets are paid ETH, account mint credits, signed mint authority, NFT ownership and
portrait attribution. `OmertaFees` forwards the full payment immediately, with a monotonic
nonce and exact floor-rounded split; successful event ingestion grants an account credit.
Spending the credit grants made status to the account. The backend signs one NFT authorization
per made account and its linked wallet. EIP-712 binds recipient, nonce and deadline to the
chain and NFT contract. `claim` consumes the nonce and cap before the ERC-721 callback.
NFT ownership never grants or moves the account entitlement.

The owner Safe controls contract parameters and signer rotation. The dedicated backend key
authorizes mint vouchers; compromise of that key is trusted-authority compromise, bounded
by the on-chain daily cap while unpaused. Fee recipients may be contracts and may reject
payments. The database and the configured RPC/indexed chain are trusted for off-chain state.
The two event streams must preserve mint provenance and canonical transfer order. No
historical portrait store exists to reconstruct account facts at a transfer block.

## Findings and disposition

Severity considers actual impact and required access. Operational and product findings are
kept separate from an unprivileged contract exploit. Fixed findings remain in this record.

| ID | Severity / class | Confirmed behavior and disposition |
| --- | --- | --- |
| C-01 | Medium, backend authorization | Before launch preparation, a voucher could name an arbitrary destination, mint attribution followed the wallet's later account, and a claim did not durably close its voucher. This could break attribution and allow a later second authorization. Fixed: linked recipient, originating voucher account, atomic claimed marker, and confirmed unused expiry proof. Regression covers reassignment, missed indexing, exact expiry and RPC failure. |
| C-02 | Medium, configuration / replay domain | Expiry replacement queried the current deployment without retaining the issuing domain. Fixed: persist complete EIP-712 domain, verify it before querying, and recheck the saved payload under the account lock. An unbound legacy or foreign-domain authorization remains pending. Tests reject both cases despite a supplied unused/expired proof. |
| C-03 | Medium, index integrity | A repeated older transfer could overwrite a newer owner; Transfer-first indexing could freeze the wrong account after wallet reassignment. Fixed: canonical block/log position, stale-event refusal and waiting for Minted provenance. A repaired legacy frozen row loses its unrelated snapshot instead of publishing false history. Tests cover same-block order, held cursor/retry and legacy repair. |
| C-04 | High, accounting under misconfiguration | Existing testnet forwards 25% to Vig, while an omitted backend setting defaults to 60%. A real local 0.01 ETH payment booked 0.006 ETH instead of 0.0025 ETH. Fixed rehearsal/config and added a real RPC adapter guard: fee and store ingestion refuse a mismatch before reading payments or advancing a cursor. Passing local payment proves correct booking; negative adapter tests prove refusal. Existing incorrectly booked deployments would need ledger reconciliation; this review did not change any live ledger. |
| C-05 | Medium, metadata limitation | A seller can change public portrait facts after transfer but before confirmation/indexing. A local real rename route reproduced a later name becoming frozen. Public metadata now accurately states observation-time capture. Exact transfer-time historical reconstruction remains unimplemented; no currency or account entitlement moved in the proof. |
| C-06 | Open, checkout / recovery blocker | Browser UI can link a wallet and request a voucher, but cannot submit the fee or NFT claim and cannot resume a saved claim. Its generic status view mislabels Dynasty as OMR. Domain persistence is now present; dedicated status, transaction submission and resume UI are still required. |
| C-07 | Open, wallet-proof hardening | Current custom EIP-191 message binds account and random nonce but lacks ERC-4361 origin/URI/chain fields and uses EOA verification. No signature forgery was demonstrated. A misleading third-party signing prompt could link a consenting, previously unlinked wallet to another account. Implement origin-bound wallet proof and explicit supported-wallet behavior before paid checkout. |
| C-08 | Open, deployment integrity | Fee nonces, token IDs and cursors share an unnamespaced database. Switching deployments can confuse distinct payments with the same nonce. Dedicated databases are documented; a durable chain/contract fingerprint that rejects configuration drift remains required for activation. |
| C-09 | Open, release evidence | Mainnet wrappers check a report-hash format and signer-scope boolean, not report content or source scope. Keep these as attestations until an artifact validator is added. This two-contract report must never be used to clear the ten-contract core scope. |

## Executed verification

Toolchain: Foundry **1.7.1**, Solidity **0.8.26**, optimizer **800**, Cancun, and local
OpenZeppelin **5.6.1**. These two contracts use the non-IR pipeline. New adversarial tests
are retained in `omerta-contracts/test/CharacterLaunchAudit.t.sol`; detailed contract
results and static outputs are linked by hash in the evidence manifest.

The new contract suite covers independent EIP-712 domain reconstruction, wrong chain and
contract, field tampering, malformed/high-s signatures, replay, deadlines, signer rotation,
daily caps, every administrative selector, transfer approvals and ownership transitions.
Malicious ERC-721 receivers attempt reentry, forward during callback, and reject after
forwarding. Fee recipients attempt reentry/rejection; tests check atomic rollback, exact
distribution, rounding across the basis-point range and forced ETH recovery. Independent
stateful models exercise NFT and fee behavior with handler failures treated as failures.
The final campaign passed 32 tests: 30 adversarial/example/fuzz tests (three properties at
512 cases each), plus two invariants at 256 runs × 128 calls each — 65,536 total stateful
handler calls with zero reverts or discards. The final seed was `0x4f4d455254412d4155444954`.

Backend evidence includes `test/chain.js`, `test/watcher.js`, `test/portrait.js`,
`test/preflight.js` and `test/gates.js`. The disposable local rehearsal compiles and deploys
only these two contracts on a fresh loopback Anvil chain, then executes wallet proof,
fee payment, decoding, exact revenue booking, one-time credit spend, signed NFT claim,
indexing, metadata and transfer. It passed **12 checks**. Public-chain transactions: **zero**.

The local proof uses pg-mem. It does not establish PostgreSQL row-lock concurrency,
persistence through service restart, live RPC finality, or browser-wallet completion.
These boundaries are explicit activation items, not implied by passing unit tests.

## Static-analysis triage

Slither **0.11.6** completed 102 detectors against each contract. It returned 16 diagnostics
for OmertaFees and 83 for DynastyNFT; detector exit code 1 reflects diagnostics, not a tool
failure. Structure/authorization/inheritance printers and the ERC-721 conformity checker
also ran; the latter passed its signature/event checks. None alone proves contract safety.

| Diagnostic group | Disposition |
| --- | --- |
| `incorrect-exp` (1), `divide-before-multiply` (9) | OpenZeppelin wide arithmetic and modular inverse implementations. The XOR is deliberate; replacing it with exponentiation would break the inverse seed. No reachable precision-loss exploit established. |
| `missing-zero-check` (1 per target) | `Ownable2Step.transferOwnership(0)` cancels a pending ownership proposal; it does not transfer control to zero. Renunciation is a separate owner action. |
| `timestamp` (1) | Explicit claim expiry and maximum remaining TTL. Boundary behavior is tested. Timestamp-based daily reset permits bursts across UTC day boundaries; it is not a sliding window. |
| `low-level-calls` (2 fees) | Intended ETH forwarding and owner sweep. Return values checked, guard active, payment state rollback tested on recipient rejection/reentry. |
| `assembly` (9 fees / 43 NFT) | Dependency implementations inspected in context; the presence of assembly is not a demonstrated vulnerability. Callback and arithmetic behavior covered by the targeted tests. |
| pragma/compiler (2 fees / 6 NFT) | Broad dependency pragmas are not the compiler actually used. Reviewed the pinned compiler and current advisory conditions below. No blanket dismissal of compiler risk. |
| dead code, naming, long constants, unindexed pause events | Informational dependency/style/event-indexing observations. No asset or authorization violation established. |

The official [Solidity bug list](https://docs.soliditylang.org/en/latest/bugs.html) was checked
on the review date. Older bugs named by the broad-pragma detector are fixed before 0.8.26.
The later mutual-recursion spill advisory requires the IR pipeline, which these builds do
not use. Storage-array wraparound requires an array crossing the end of storage; these
contracts have no custom layout placing arrays there. The pinned compiler is not described
as universally bug-free. A different compiler/profile reopens this disposition.

## Release boundary and next inputs

The Solidity review found no reproduced unprivileged exploit in the two reviewed contracts.
The fixes improve the backend boundary; the open paid-checkout, wallet-proof, database
binding and release-artifact items still prevent declaring the public release ready.
The [activation runbook](../CHARACTER-NFT-LAUNCH.md) also requires correct testnet metadata
routing and persistent database/restart evidence.

The fee split is fixed at construction. The existing testnet uses 75% developer / 25% Vig;
this is not an instruction to reuse those recipients or that split for a new release.
The owner must supply the two public EVM fee destination addresses and confirm the split
before the deployment configuration is finalized. Royalty recipient, cap, fee amount and
owner/signer roles are separate parameters in that concrete package.

Pausing DynastyNFT stops new claims but allows transfers. OmertaFees has no pause; keep
indexing and payment recovery available even when closing the checkout. Ownership
renunciation would remove administrative recovery and is not part of the launch ceremony.
