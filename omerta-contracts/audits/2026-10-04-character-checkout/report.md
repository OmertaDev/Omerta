# Character checkout and NFT wallet boundary review

Reviewed code revision: `788e672741e558210029683fed928a06934123f3`.
Phase: pre-release backend/UI review; production rollout and a real user mint remain separate gates.
The [manifest](manifest.json) records full hashes of reviewed source and retained evidence.
The later evidence and generated-knowledge commits do not change this reviewed implementation.

## Scope and authority

The new authenticated character readiness, ETH checkout and NFT claim-calldata routes, their
wallet and signup entry points, client payment recovery, and dedicated tests are in scope.
Existing fee credit, voucher issuance/reconciliation, confirmed event ingestion and portrait
payment authority were followed as dependencies. The campaign journey test clock correction
is included because its wall-clock boundary failure prevented the prior production rollout.
It changes the fixture clock and proves expiry rejection; production expiry checks are unchanged.

An invited account proves its wallet ownership. The current exact `payMintFee()` payment is
indexed before granting credit; existing authority consumes a credit for account-bound made
entitlement. A single account-bound EIP-712 voucher authorizes its DynastyNFT trophy. The token
does not convey gameplay entitlement. Free-credit/made accounts may claim without paying;
their sealed artwork has an explicit optional paid reveal using the existing fee receipt policy.
A confirmed paid portrait cannot pay again through either checkout purpose.

The API key remains in the service environment; no route returns it. Readiness derives its
public signer and compares the live NFT signer. Chain 4663, deployed contract code, fee policy,
positive fee, pause state, current RPC time, worker heartbeat and confirmed recent fee/NFT
cursors must pass before a fee is offered. The wallet reviews recipient, amount and chain;
its account/network and the server quote are checked again before broadcast.

Fee payment intents persist before broadcast. An acknowledged hash replaces the intent.
Unknown outcomes stay blocked; definitive wallet cancellation or a confirmed failed receipt
permits a new review. Browser-wide locks coordinate tabs, and an in-page guard coordinates
buttons. Paid checkout fails closed when browser locking/storage is unavailable. NFT claims
remain usable without that paid-checkout capability. Confirmed registry state shows token ID,
observed owner and portrait links and removes the claim action.

## Methods and findings

Methods follow the repository's pinned agent-led review policy: map entry points and authority;
trace adversarial execution/state transitions; validate reachable leads; retain regression and
retest evidence. This is an adapted manual review with independent agent cross-checks and
two actual `gpt-daybreak-blue-latest` CLI reviews, not a claim that upstream orchestration ran.
The CLI headers identify the actual model. A nested optional Daybreak wrapper in the initial
review was unavailable; that is distinct from the successful model invocation. Node 24.19.0
and Codex CLI 0.159.2 were used locally.

| ID | Finding | Disposition and evidence |
| --- | --- | --- |
| C1 | A broadcast followed by lost response/reload could allow another payment. | Fixed by pre-broadcast persisted intent, definitive-cancellation handling, receipt recovery and reload regression. |
| C2 | Matching global configuration and RPC on another chain could authorize checkout. | Fixed by an independent mainnet 4663 guard; both-configured-wrong-chain regression. |
| C3 | A former-signer expired voucher could fail before safe replacement. | Fixed by entering existing confirmed-expired-and-unused reconciliation before current-signature checks; live old vouchers still reject. |
| C4 | An expired saved voucher bypassed replacement authority. | Fixed by delegating to the existing reconciliation path and bounded reread. |
| C5 | Pending indexing, simultaneous buttons or tabs could allow repeat fees. | Fixed by persisted intent/hash, shared browser locks and in-page guard; concurrent contexts and reload tests. |
| C6 | Missing/stale indexers or a frozen RPC head could still advertise checkout. | Fixed by confirmed cursor freshness, heartbeat and RPC wall-time checks. |
| C7 | Network change during the last server quote could change transaction network. | Fixed by final account/network reads and explicit transaction chain ID; zero-send regression. |

The [Daybreak retest](character-checkout-daybreak-retest.txt) found no concrete remaining
findings for this revision. It ran the focused suite and syntax checks and reviewed PostgreSQL
assertions. Its note about generated knowledge files reflects the parent's concurrent normal
knowledge build; no scoped implementation file changed during that retest.

## Executed checks

- Module, wallet/client and authenticated HTTP tests pass. Cases include changing fees/accounts/
  chains, malformed previews, denied storage/locking, cancellation, unknown broadcast outcome,
  concurrency, optional reveal eligibility, confirmed NFT status, used nonces and signer rotation.
- [Real PostgreSQL 18.4 proof](identity-checkout-postgres-final-provenance.json) on the exact
  reviewed revision passes: four concurrent authenticated claims consume one credit and issue
  one voucher. It also covers confirmed NFT state, reclaim prevention and expiry/rotation cases.
  Only the owned loopback disposable cluster/database was used and stopped afterward.
- Public UI checks pass; mobile layout checks pass across 175 screens on three phone sizes.
  Current-copy and environment-perimeter checks pass. The clock-fixed campaign journey and
  player-command suites pass, including rejection exactly at command expiry.
- The dedicated PostgreSQL test is added to the existing PostgreSQL 16/18.4 CI matrix. Full
  required release CI must pass before merge; those future results are not claimed as local proof.

No Solidity source changed in this release. New Solidity fuzzing/static diagnostics are not
claimed here; the prior red-team package remains separate. JS syntax, actual inline-handler
tests, copy/perimeter checks and browser tests provide the applicable static/client checks.
All concrete leads above were checked against reachable paths and retested.

## Deployment observations and limits

[Mainnet observation](mainnet-read-only.json) records exact block/hash, fee and NFT runtime
matches against the recorded deployment, matching NFT creation bytecode, current metadata URL,
0.01 ETH fee, 100% developer mint allocation, intended developer recipient, 10/day NFT cap,
unpaused NFT and signer separation from the two-of-three owner Safe. The owner confirmed the
public fee recipient and signer-setting presence; production's derived signer must still pass
runtime readiness. The production pre-test snapshot had no payments, NFT vouchers/tokens or
chain cursors, avoiding old-deployment fee nonce/cursor collisions at first activation.

These observations do not activate any contract. The prepared activation enables only character
fee/NFT streams and keeps other contract/keeper routes inactive. Other contracts, issuance,
liquidity, auctions, bonds, stock delivery, borrowing and withdrawals are outside this release.
The NFT's existing daily cap and chain confirmation policy remain in place; availability is
not a reserved mint slot. Wallet/RPC mocks do not prove real broadcasts. Source review, passing
CI, live service rollout, live indexing and an actual user payment/claim/metadata verification
are separate evidence. This review makes no blanket assertion that no bugs or exploits remain.
