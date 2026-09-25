# OMERTÀ — economy

The authoritative rules are exported by `src/rules.js`. [The game wiki](docs/WIKI.md) describes player-facing behavior, while [the market design](omerta-contracts/docs/market/DESIGN.md) and [chain runbook](CHAIN-DEPLOY.md) describe contract capabilities and activation requirements.

## Cash and OMR

Cash supports the in-game economy: jobs, crimes, goods, businesses, and other actions use the rules and prices returned by the server. Cash cannot be converted into OMR through an internal swap or laundering faucet.

The Window (`GET /v1/window`, `POST /v1/window/redeem`) runs the other way: players spend OMR for cash from a funded till, subject to their rolling account limit. A short till refuses and takes nothing. The OMR funds family yield and the Desk; redemption does not destroy token supply. `src/exchange.js` and the live board publish the rate, opening state, available till and account headroom.

OMR balances represent accounted game value. Every transfer, deposit, withdrawal, escrow movement, and sink must reconcile through `src/invariants.js`. Historical ledger reasons remain recognizable so existing balances and records can still reconcile. Their presence does not authorize new emission.

The Street Wage and individual staking-yield claim routes reject new claims. Current acquisition, resource grants, settlement, and custody must follow their own explicit authorities and budgets; none is permission to restore an unrestricted reward faucet.

## Stakes and loss

OMR committed in the current game is still exposed to gameplay loss. A fire-kill can take 50% of loose OMR or 20% of committed OMR under the applicable rules. Unstaking has a six-hour unbonding delay. Do not promise that principal always returns whole.

The approved contract custody replacement and its activation conditions are recorded in [the stock-machine specification](omerta-rwa-stock-machine-design.md). Existing database stake or a deployed contract must not be represented as satisfying a replacement that has not been implemented and activated.

## Canonical market

The ETH/OMR market uses a Uniswap v4 hook with separate contracts for measured market state, stability reserves, protocol liquidity, inventory bonds, family Turf, player liquidity commitments, and solver-funded arbitrage. Inventory bonds sell funded OMR inventory; they do not grant mint authority. Reserves and rewards have finite funding and do not guarantee a price floor or personal yield.

The current market implementation and deployment plan retain exact technical identifiers for ABI, configuration, and tool compatibility. These identifiers are not names for separate editions of the game. See [the market runbook](omerta-contracts/docs/market/RUNBOOK.md) for deployment, funding, checks, and wiring.

## Stocks and the bank

The in-game Portfolio is retired: its investment, dividend and board routes reject new activity in `src/portfolio.js`. Tokenized stock custody, acquisition authority and the Bank are separate systems; their presence does not restore that stock book. [Brokers](omerta-brokers-design.md) and [the stock machine](omerta-rwa-stock-machine-design.md) describe their current permissions and gates. A contract, catalog entry, or approved design alone does not prove that stock acquisition or delivery is enabled.

## Verification and changes

Keep value transfers inside the established transaction and custody boundaries. Run the relevant economy tests, `npm run sim`, and the required release checks before changing economic behavior. Balance and sign-off records are dated evidence; reconcile an older decision with current rules before using it to make a change.
