# Agent Alpha and Deep City Design

## Outcome

Ship two gated increments in order:

1. **Agent Alpha** — one durable, honestly flagged production canary; a bounded conservative loop; public discovery that sends unauthenticated clients to the genuinely public Arena JSON; and Agent Turn v3 with a read-only exploration lane plus action/blocker/system activation evidence.
2. **Deep City** — replace the 19-card featured Explore grid with one canonical recommendation over the 40-system engagement vocabulary, chosen from systems this account has not used and can act on now.

## Binding constraints

- The server remains authoritative. Clients never supply action method, path, body, score, or reward.
- recommendedActionId and actions remain the EV lane. Exploration has no score/rank, cannot change queue ordering, and is never executable through POST /v1/agent/act.
- Preserve the exact conservative policy: cashReserve 1000, minArbitrageProfit 25, allowPvP false, allowBorrowing false.
- Agent Alpha drives only action kinds already issued by Agent Turn and allowlisted below. It never calls arbitrary mutations, PvP, borrowing, human faucets, wallet/mint/withdrawal, or replacement/reset flows.
- One origin-bound session file represents one identity. Corrupt, wrong-origin, missing-token, expired, or transiently unverifiable sessions fail closed and never create a replacement.
- The canary is finite: maxActions defaults to 1, is limited to 1–50, and successful mutations are separated by at least 3100 ms.
- Tokens, headers, wallets, prompts, action bodies, authored text, and account/character IDs never enter reports or telemetry props.
- Public surfaces link unauthenticated users to GET /v1/arena. Detailed GET /v1/leaderboard/agents stays authenticated.
- The coverage vocabulary is exactly Object.keys(src/engagement.js SYSTEMS); telemetry classification remains exhaustive and one-to-one.
- Existing coach emergency/progression behavior is unchanged. Deep City is lower-priority discovery, not a coach rung.
- GET /v1/explore, Home, Agent Turn exploration, and operator reporting use one resolver/catalog.
- Deep City returns exactly one next recommendation or null, never a choice grid.
- Explore remains a pure read and creates zero ledger rows.
- Human discovery continues to exclude agents/NPCs.
- Production extraction remains dormant.
- No new runtime dependency, service, queue, or table.

## Canonical coverage contract

src/explore.js exports:

~~~js
systemCoverage(db, ch, acct = {}, owned = {}, { onlineAccounts = [] } = {})
~~~

It returns:

~~~json
{
  "catalog": { "scope": "engagement_systems", "version": 1, "count": 40 },
  "progress": { "visited": 0, "eligible": 0, "remaining": 40 },
  "next": {
    "systemId": "business-empire",
    "system": "business empire",
    "name": "The Empire",
    "tab": "empire",
    "hook": "Buy a racket — passive income that pays while you sleep.",
    "at": 3,
    "mode": "solo",
    "reason": "earliest_overdue_unlock",
    "evidence": { "visited": false, "source": null }
  },
  "blocked": { "level": 0, "resource": 0, "status": 0, "social": 0, "policy": 0 }
}
~~~

next is null when no unvisited system is presently eligible. remaining is the full unvisited count, including blocked systems. eligible counts ready unvisited systems.

### Visit evidence

A system is visited when this account emitted one of its classified telemetry events, or a durable/current state signal already used by Explore proves use (ownership, mastery, or account legend). Account-level telemetry deliberately survives character death. Read it with one grouped account query backed by:

~~~sql
CREATE INDEX IF NOT EXISTS ix_telemetry_account_event ON telemetry (account_id, event);
~~~

### Eligibility and ordering

For unvisited systems:

1. Exclude entries above their level gate.
2. Exclude status-only entries unless their status applies.
3. Exclude organization entries without the required organization context.
4. Exclude social entries without a live/reachable counterparty.
5. Exclude unaffordable entries using live rule constants.
6. For agents, exclude PvP, borrowing, human-faucet/social-proof, and store/pass entries.
7. Order ready solo before organization/social, then Path/location relevance, lowest overdue unlock, then lexical systemId.

The canonical metadata table contains these exact rows. Existing 19-item Explore state predicates are preserved; contextual rows count toward coverage but become next only when their context is true.

| Engagement system | systemId | L | Tab | Eligibility |
|---|---|---:|---|---|
| streets / crime | streets-crime | 1 | streets | solo |
| the kitchen | kitchen | 8 | kitchen | solo; kitchen cost/ownership |
| wet work | wet-work | 22 | pvp | PvP/social; never agent-next |
| contracts | contracts | 22 | pvp | PvP/social; never agent-next |
| the dueling ladder | dueling-ladder | 22 | pvp | PvP/social; never agent-next |
| crew heists | crew-heists | 9 | scores | live crew/board |
| clue scrolls | clue-scrolls | 3 | streets | active clue |
| the family | family | 3 | family | reachable family |
| the commission | commission | 20 | family | family/seat |
| territory | territory | 15 | map | family |
| the world | world | 18 | family | family |
| the blood war | blood-war | 20 | family | family |
| business empire | business-empire | 3 | empire | racket/front affordability |
| convoys | convoys | 24 | scores | cargo/cash |
| the port | port | 16 | port | boat price |
| the black market | black-market | 7 | market | tradable inventory/order |
| loan sharking | loan-sharking | 10 | loans | agents lend/repay, never borrow |
| the casino | casino | 10 | den | minimum stake |
| the speakeasy | speakeasy | 26 | speakeasy | Made + free district + open cost |
| boxing | boxing | 12 | boxing | fighter signing cost |
| street races | street-races | 14 | races | usable car |
| the stable | stable | 25 | stable | cheapest racer cost |
| the law | law | 18 | law | wanted/indicted/investigation |
| the pen | pen | 1 | pen | jailed |
| the wire | wire | 18 | wire | PvP/intel + OMR; never agent-next |
| secrets | secrets | 18 | wire | live intel context; never agent-next |
| skills | skills | 4 | life | unspent point + unfinished tree |
| the underworld | underworld | 3 | life | known fixture/standing |
| the estate | estate | 30 | estate | tier-one OMR |
| the made man | made-man | 26 | portfolio | dues OMR |
| the auction house | auction-house | 30 | estate | eligible lot + resources |
| the collection | collection | 20 | estate | eligible car/gear |
| going legit | going-legit | 15 | portfolio | earned OMR/stake/mint credit |
| the megaproject | megaproject | 28 | city | contribution affordability |
| street life | street-life | 3 | streets | open corner/contact/favor |
| landmarks | landmarks | 12 | city | live opportunity/price |
| street deeds | street-deeds | 15 | deeds | claim/buy opportunity |
| vanity | vanity | 5 | profile | owned renameable context |
| the store / pass | store-pass | 1 | store | policy-blocked; never proactive |
| growth / social | growth-social | 3 | discover | human social; never agent-next |

## Agent Turn v3 and activation evidence

The turn adds required exploration with the canonical coverage payload. It stays outside the authority fingerprint because it grants no execution. Changing visit telemetry must change exploration without changing action IDs, ranks, scores, descriptors, or recommendedActionId.

Every successful POST /v1/agent/act writes one agent_turn_action telemetry event inside the character transaction:

~~~json
{
  "actionKind": "crime",
  "recommended": true,
  "explorationSystemId": "business-empire",
  "visited": 3,
  "remaining": 37,
  "blockerCodes": ["nerve"]
}
~~~

It is NON_ENGAGEMENT operational telemetry. Failed/stale/unknown actions write none. opsEngagement adds agent-only action-kind/blocker summaries and per-system agentAccounts/agentEvents without changing human retention/account semantics.

## Agent Alpha runner

tools/agent-alpha.js is dependency-free, importable, and has this seam:

~~~js
runAgentAlpha({
  baseUrl, sessionFile, reportFile, name, create,
  maxActions, intervalMs, fetchImpl, sleep
})
~~~

The origin-bound atomic session contains version, base, phase, token, characterName, and pending. Persist a guest before agent-key creation and the agent token before character creation. Creation requires create:true plus a valid name. No reset exists.

Before a mutation, journal operationId, turnId, actionId, and startedAt. Hash operationId into the idempotency key. A restart retries the same pending logical action/key. JSONL reports may contain timestamp, status/error code, action kind/id, blocker codes, exploration id/progress, and post-action resource bands—never forbidden values.

Allowed kinds are exactly:

~~~text
onboard_claim daily_claim career_claim
business_collect territory_collect kitchen_collect convoy_collect convoy_travel
market_fill arbitrage_buy arbitrage_sell arbitrage_travel
loan_repay crew_recruiting crime
~~~

Execute the recommendation only when allowlisted and the turn publishes allowPvP:false and allowBorrowing:false. Otherwise record a refusal and exit without mutation.

## Deep City presentation

Home renders one “New territory” card from explore.next, “X of 40 systems worked,” one destination button, and honest no-ready/all-worked states. No grid and no persistent skip/dismiss latch.

## Operational completion

After focused/full verification, run Agent Alpha against https://www.omerta.fun with one explicit create/resume session and finite budget. Verify /v1/arena shows exactly one qualifying agent and the redacted report shows no duplicate, forbidden action, or unresolved mutation. Keep session/report outside Git. Regenerate both knowledge graphs; runtime/tests/live evidence outrank structural graph inference.
