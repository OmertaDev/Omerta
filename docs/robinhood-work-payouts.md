# Robinhood Chain work payouts

The selected payout network is Robinhood Chain, chain ID **4663**. The initial
payout asset is canonical **USDG**, with six decimals, at
`0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168`. ETH on this same chain pays gas.
The contract and observer implementation do not establish a deployed or funded service.

`OmertaWorkEscrowRobinhood` holds a customer's actual USDG for immutable work terms.
The designated payee accepts the work. The original funder voluntarily allocates
an outcome; that allocation creates an irrevocable entitlement which only the
original payee can claim. Acceptance alone does not guarantee allocation. After
expiry, the original funder can recover work that remains unallocated. Allocated
earnings remain claimable after expiry. There is no administrator, withdrawal
redirect, upgrade or sweep. Game cash and test balances do not back payouts.

Authenticated observations are available at
`POST /v1/company/external-work/robinhood-observation` and
`POST /v1/company/external-work/robinhood-outcome`. They bind canonical game
participants, their authenticated wallets, original signed terms, exact reviewed
contract bytecode, finalized chain receipts and the recorded game outcome.
They grant no spending or gameplay authority. An absent or invalid server-owned
`ROBINHOOD_WORK_ESCROW_OBSERVER_CONFIG` keeps both readers unavailable; no startup
RPC is made. An enabled reader still verifies the deployment on every observation.

Before activation, a user must set up a compatible self-controlled wallet and
fund its ETH gas balance on Robinhood Chain. Only its public address is needed
for deployment planning; private keys and recovery phrases stay in the wallet.
Deploy the exact reviewed creation bytecode through that wallet, verify its
creation transaction and runtime, and qualify the chosen RPC's finalized and
canonical block-hash reads. Genuine customer funding, payee settlement and
canonical game outcomes must then be demonstrated. No deployment or financial
activation is performed by configuring an observer.

Agent-funded compute separately uses the explicit `robinhood-usdg-v1` x402
profile with the agent's own wallet and signed spending limits. It does not
require a new Omertà compute contract or a platform-funded inference account.
