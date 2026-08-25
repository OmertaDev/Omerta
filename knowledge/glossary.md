# Glossary

| Term | Meaning |
|---|---|
| `$OMR` | OMERTÀ’s ledgered game currency and corresponding gated on-chain token rail. It is not interchangeable with cash through a general swap. |
| §10.4 | The project’s conservation-law discipline: value movements must reconcile against the transaction ledger and named system buckets. |
| Agent key | A long-lived bearer credential that permanently flags the account as an agent and applies agent policy/cadence. |
| Capo’s License | Capability tiers earned by qualifying human recruits; changes agent cadence/wire slots, not referral cash. |
| Character | A living street identity attached to an account; many progression states die or transfer on character death according to domain rules. |
| Coach | Server-authoritative next-step hint returned with player state. |
| Cold | A productive asset whose upkeep is sufficiently overdue to stop normal income/actions until paid. |
| Domain | A controlled navigation grouping in this knowledge base, not a separate deployed service. |
| Door 1 / 2 / 3 | Separate launch gates for the off-chain game, agent channel and chain rail. |
| Full reserve | Withdrawable $OMR cannot exceed the reserve bought/funded for extraction; vouchers do not create unbacked claim capacity. |
| Lazy accrual | State derived from timestamps when touched instead of through a global tick over every player. |
| Ledger reason | Stable string identifying why a transaction row moved value. Checks branch on the vocabulary. |
| MCP | Model Context Protocol; `omerta-mcp` exposes the JSON game API as agent tools. |
| Money router | `src/router.js` declaration/check layer for cross-source real-value inflow splits. It verifies; it does not itself move money. |
| Opportunity Board | `/v1/opportunities`, a ranked aggregation of open actions and standing economic niches for agents/players. |
| Pad / nut | Recurring upkeep/wage obligations on productive systems; specific rules vary by domain. |
| `pg-mem` | In-memory PostgreSQL emulator used for zero-setup tests. It cannot prove production PostgreSQL syntax, locking or failure behavior. |
| Precedent | A named engineering pattern cited in source comments and indexed by the specialized graph. |
| Route registry | Live collection of mounted Fastify routes used to derive `/openapi.json`. |
| SIWE | Sign-In with Ethereum challenge/verification used to link a wallet. |
| Specialized graph | `tools/graph.js`: levers, reasons, invariants, tests, design mentions and named precedents. |
| Standing | A non-currency status/progression measure used by several social, family and political systems. |
| Street | Context-dependent: a living character, the public player board or a tokenized street deed. Read the domain. |
| The Vig | Real-revenue/buyback/reserve system that backs extraction and prizes. |
| Till | Finite cash budget backing the one-way redemption window. A short till refuses without burning. |
| Transaction spine | Shared `withCharacter` / `withTwoCharacters` machinery that owns actor locks, accrual and commit boundaries. |
| Voucher | EIP-712 backend authorization claimed on-chain once; replay and tampering must fail. |
| Watcher | Persisted, confirmation-delayed chain event poller that backfills after downtime. |

