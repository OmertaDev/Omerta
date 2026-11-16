# Native garage: closed backend release

This candidate is based on `9cf7ced8beedd0950018a14bbab71b08b71a3d5b`. The exact source
bytes are pinned in [evidence/source-pins.json](evidence/source-pins.json). It ports only the
native garage/foundry interface, RPC facade and related presentation guards onto current main.
The original dirty workspace and its unrelated work are preserved. The preceding scoped methods,
authority traces and findings are retained in [LOCAL-REVIEW.md](LOCAL-REVIEW.md).

The 19 interface source pins and execution logs record that validation point in time.
Subsequent comparison-only admission adapters and exact CI/proof bytes are pinned by
[native-garage-source-data.js](../../../tools/native-garage-source-data.js) and its source controls;
they transfer no runtime or native results. Fresh hosted native PostgreSQL checks are
required at the final PR head.

The canonical character view explicitly returns `onchainCrafting: false`. This release does not
install a character migration bridge or change any schema, contract, token role, economic balance
or source character. Its future onchain-mode presentation is exercised through controlled browser
projections. Production controls remain closed unless an actual pinned deployment is configured.
No mainnet transaction or production character cutover is part of this backend release.

The facade accepts only an explicit validated wallet on configured board, plan and receipt reads.
It has no SQL dependency, signer or broadcast path. This removes the prototype's optional
`precision_tool_migrations` wallet lookup, which is unavailable on current main and would fail its
PostgreSQL PREPARE gate. Wallet selection reads that wallet's public chain state without changing
the linked game account. Selected-wallet context can change only through an explicit connection;
ordinary provider/account/network changes and expired authentication still invalidate a send.

The browser signs zero-value calls only after independently matching chain, profile, destination
and full ABI calldata. Exact OMR approval and hardening are separate actions. A pending record
persists across navigation/reload and uncertain broadcasts. It clears only after the matching
canonical receipt and a confirmed, caught-up ownership projection. No optimistic item credit or
automatic resend exists.

## Executed checks

- 14 facade groups, including missing-wallet validation and closed receipts with no SQL access.
- 21 wallet-controller groups, including explicit wallet context, session races, exact approval,
  calldata, receipt/projection/indexing barriers and persisted recovery.
- 10 browser groups against the actual current-main shell. The test decorates both `/v1/me` and
  main's `/v1/projections/player`; production projection logic is unchanged.
- Existing client mirror, route/preflight/site/current-copy/worldgraph checks; strategy, wallet
  and noir-shell browser regressions; source syntax and whitespace checks.
- Required repository gate: all nine new concurrent sites are classified as RPC-only by their
  actual closure; the facade exposes no PostgreSQL query handle. The three new suites are wired
  directly into the existing hosted workflow, preserving its other assertions and native cohorts.
- The original workspace's real browser/server/Anvil rehearsal passed four groups and 23 local
  wallet transactions, including four genuine archived drand proofs, earned junker salvage,
  actual restricted OMR approval/payment, unique tool crafting, assignment and transfer. Historical
  browser/server/chain clocks are explicit. This establishes compatibility, not live entropy.

Raw outcomes and screenshots are retained in [evidence](evidence/). The broad hosted npm,
economy and native PostgreSQL cohorts remain required before merging/releasing. Their status
is reported separately from the completed local checks; no new Solidity audit is claimed.

## Remaining mainnet constraints

The recorded live OMR rejects the restricted-policy interface required by this foundry. Actual
canonical OMR, house/operator bindings, the qualified immutable canary batch and exact deployment
receipts must exist first. The pinned BLS dependency remains experimental/unaudited, and future
beacon fairness still depends on a defended target-chain clock/sequencer model. Precompile
compatibility and historical proofs do not settle those assumptions. Source migration, production
indexing/operations and the complete game's activation are separate releases.

This review supports the scoped closed backend candidate at its source pins. It is not clearance
to activate native gameplay, launch the market or migrate existing players.

Source hashes use LF-normalized UTF-8 for portable checkout verification. Copied text evidence
is retained with LF line endings; original native tool outputs remain in the local task evidence.
