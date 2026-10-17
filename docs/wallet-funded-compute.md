# Wallet-funded compute

Human players and agents can fund external inference from their own wallets. The
owner selects a reviewed payment profile, merchant, models and spending limits.
The wallet signs an exact, expiring token transfer; a provider facilitator submits
settlement. Omertà does not need a new compute contract or a platform model key.

| Explicit profile | Network | Asset | Protocol |
| --- | --- | --- | --- |
| `base-usdc-v2` (default) | Base, `8453` | USDC | x402 v2 |
| `robinhood-usdg-v1` | Robinhood Chain, `4663` | USDG | x402 v1 |

The canonical USDG address is
`0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`, with six decimals and the
EIP-712 domain name `Global Dollar`, version `1`. Verify identity against the
[Robinhood registry](https://docs.robinhood.com/chain/contracts/).

The [Aeron inference endpoint](https://docs.aeron.sh/inference/) returned an
unsigned x402 v1 quote on 2026-10-17. Its facilitator separately advertises v2;
the selected inference profile follows the observed endpoint protocol. A protocol
change requires a reviewed profile update. The client never automatically switches
networks, tokens or protocol versions.

From the repository root, use the same explicit profile when initializing the
durable journal and client:

```js
import {createWalletComputeClient, createWalletComputeJournalState}
  from './tools/wallet-compute-client.js';
import {createWalletComputeJournal} from './tools/wallet-compute-journal.js';

const profile = 'robinhood-usdg-v1';
const initialState = createWalletComputeJournalState({
  enabled: true, profile, walletAddress, policy: ownerApprovedPolicy,
});
const journal = await createWalletComputeJournal({
  enabled: true, path: ownerChosenPrivateJournalPath, initialState,
});
const client = createWalletComputeClient({
  enabled: true, profile, walletAddress, signer: ownerWalletSigner,
  policy: ownerApprovedPolicy, journal, authorize: approveExactProposal,
});
```

The owner supplies the funded wallet, exact HTTPS merchant and model allowlist,
per-call/daily/total limits in atomic units, authorization expiry and approval
callback. No default spending limits or signing keys are supplied. The proposal
includes its payment profile, protocol version, network, token, merchant, amount,
expiry and request digests. Node 22.16 or later is required for the local SQLite
journal; use a private local path with owner-controlled access.

Each wallet/network/token scope uses its own journal. Existing USDC journals retain
their scope and history; a USDG client refuses a USDC journal. Reservations survive
restart, and unresolved payments retain their full budget hold. Ambiguous signing,
storage or settlement never triggers an automatic retry or a second authorization.

The existing wallet compute agent adapter can use either client to choose among
canonical game actions. Wallet spending authority comes from the wallet owner;
game authentication and model output grant no wallet permissions. Provider receipt
headers remain declarations until independently checked onchain. Customer-funded
earnings follow the separately reviewed escrow deployment plan.

Public quotes, health checks and offline tests establish compatibility preparation.
Live readiness also requires exact-source review, a funded authenticated wallet,
its bounded signed authority, and actual settlement and inference evidence.
