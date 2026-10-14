# Omerta Agent Gateway and Consigliere

The Gateway is a provider-neutral intelligence boundary over the existing game services. It composes player state, discovered world relationships, organizations, inventory, crafting, investigations, operations, economic context, seasons, and coordination. It never treats an agent's claim about balances, ownership, completion, or eligibility as authoritative.

The existing `/v1/agent` autonomous gameplay interface is separate. A Gateway token cannot authenticate against ordinary game routes. The Consigliere helps a player discover, understand, prepare, and coordinate; consequential actions return to the player for approval.

## Components

| Component | Responsibility |
| --- | --- |
| `src/gateway/capabilities.js` | Canonical capability names, security classes, scopes, descriptions, and closed argument schemas. |
| `src/gateway/context.js` | Safe projections and deterministic opportunities from authoritative game services. |
| `src/gateway/security.js` | Opaque delegated tokens, current account checks, scope grants, revocation, and rate limits. |
| `src/gateway/service.js` | Request identity, orchestration, immutable preparations, player confirmation, and activity records. |
| `src/gateway/actions.js` | Explicit allowlist translating preparations into existing game commands. |
| `src/gateway/events.js` | Permission-aware subscriptions and projections of durable existing event records. |
| `src/integrations/muse/` | Adviser instructions, tool aliases, schemas, and response framing; no game rules or database access. |
| `/consigliere` | Player controls for delegated access, one-time token retrieval, revocation, proposal review, and recent activity. |

Capability discovery is the current contract. Unsupported game concepts return explicit availability information; neither the Gateway nor an agent should fabricate missing mechanics. Published recipes, visible investigation options, and operation readiness come from the game's services.

## Account linking and scopes

Open `/consigliere` while signed in to Omerta. Choose the information the adviser needs and create delegated access. The opaque token is shown once and expires after seven days in this UI. The server stores a hash, not the plaintext token. Revocation, account bans, account credential-version changes, and expiry invalidate access. A token grants no wallet signing authority.

The initial defaults are `omerta.player.read` and `omerta.world.read`. Additional reads are `omerta.inventory.read`, `omerta.social.read`, `omerta.mysteries.read`, `omerta.economy.read`, and `omerta.coordination.read`. Add `omerta.actions.prepare` or `omerta.coordination.prepare` only when proposals are needed. The UI does not request `omerta.actions.commit` during onboarding. A commit-class capability still requires the confirmation flow; a scope is never permission to bypass a human approval.

The current linking flow is equivalent delegated authorization through player-issued scoped credentials. It is **not an OAuth authorization-code server**. Keep player login credentials out of external platforms; save only the delegated token in the connector's secure credential settings. Tokens never belong in URL parameters or logs.

Do not send `Idempotency-Key` when creating a connection: issuance rejects it so the legacy response-replay store cannot retain the plaintext token. Gateway capability calls use their structured `requestId` instead.

Player-authenticated controls:

| Method and path | Purpose |
| --- | --- |
| `GET /v1/gateway/scopes` | Available scopes and onboarding defaults. |
| `GET /v1/gateway/connections` | This player's grants, without token secrets. |
| `POST /v1/gateway/connections` | Create `{provider,label,scopes,expiresInSeconds?}`; return `{connection,token}` once. |
| `DELETE /v1/gateway/connections/:id` | Revoke an owned connection. |
| `GET /v1/gateway/activity` | Inspect recent Gateway requests and confirmation outcomes. |
| `GET /v1/gateway/preparations/:id` | Read an owned immutable proposal and player-only confirmation nonce. |
| `POST /v1/gateway/preparations/:id/confirm` | Confirm the exact proposal with `{nonce,digest}` using player authentication. |

## Calling the provider-neutral API

Use `Authorization: Bearer <delegated token>`. Discover permitted capabilities with `GET /v1/gateway/capabilities`, then call `POST /v1/gateway/call`:

```json
{
  "capability": "get_player_context",
  "arguments": {},
  "requestId": "briefing_20260921_01"
}
```

Every capability has a security class:

| Class | Behavior |
| --- | --- |
| `READ` | Returns currently visible facts; no game mutation. |
| `ANALYZE` | Computes candidates or relationships from authoritative visible state. |
| `PREPARE` | Persists a proposal; does not execute the proposed game action. |
| `COMMIT` | Consequential intent; still enters preparation and player confirmation. |

Supply a unique `requestId` per logical request. Reusing it with different arguments is refused. Read retries recompute current visibility instead of replaying a stale private snapshot. Follow capability schemas exactly; argument objects cannot override the authenticated player.

Retrieve the smallest useful context, then expand relevant entities. For example, read the current Crew and its operation requirements before retrieving detailed crafting paths. Broad player and briefing context must include only sections permitted by the connection's actual scopes.

## Preparing and approving an action

1. The adviser calls an allowed preparation capability with a fresh request ID.
2. The Gateway reads current authoritative state and returns a stored proposal, digest, expiry, and official confirmation link. It does not expose the player-only nonce to the external agent.
3. The player opens `/consigliere?preparation=<id>`, reviews the exact action, and explicitly approves it.
4. The Gateway revalidates the current grant, ownership, expiry, digest, and authoritative preview. A changed preview refuses as stale.
5. The allowlisted existing game route executes with the same durable idempotency key on retries. Its own permission, eligibility, resource, and concurrency rules remain authoritative.

`pending`, `executing`, `completed`, and `refused` are distinct states. Known retryable refusals return to pending; an uncertain result is reconciled against the existing game receipt. Without a committed receipt, a retry must pass the current preview/digest check before execution. Committed receipts can be recovered after proposal expiry without executing another action. A proposal is never evidence that an item was crafted, a request was sent, or resources were spent.

Wallet signing remains in the official client and the player's wallet. Do not provide fabricated transaction calldata or bypass an unavailable transaction simulation/signing path. Transaction preparation is unavailable unless an authoritative supported transaction workflow supplies it.

Proposal links open the exact approval screen. Other responses link to the official game and access controls; the existing game client does not expose the example entity-specific routes from the integration brief, so the adapter does not invent those URLs.

## Muse adapter

The local adapter is functional over **Omerta's REST contract**:

| Method and path | Purpose |
| --- | --- |
| `GET /integrations/muse` | Omerta-owned integration manifest, instructions, starter prompts, and compatibility status. |
| `GET /integrations/muse/tools` | Scoped readable tool names and the canonical argument schemas. |
| `POST /integrations/muse/call` | Translate `{name,arguments,requestId}` into the canonical Gateway call. |

For example, `get_my_omerta_status` maps to `get_player_context`, `find_things_i_can_do` maps to `get_actionable_context`, and `find_crew_opportunities` maps to `get_coordination_opportunities`. Canonical capabilities without aliases retain their names. The adapter exposes read, analysis, and preparation tools; direct commit-class tools are omitted.

`createMuseAdapter({gateway,capabilities})` accepts the same Gateway service used by the neutral routes. Authentication and provider binding happen before dispatch. The adapter does not implement a second permission system or execute game logic.

Tool output is wrapped as `contentType: "untrusted_game_data"` with `gameData` containing the Gateway envelope. Trusted adviser instructions are static and separate. Crew names, descriptions, messages, puzzle text, and supplied URLs cannot become instruction text or trusted navigation. Confirmation links are reconstructed from Gateway preparation IDs. Other links use the verified Omerta home and Consigliere routes; speculative `/crew/:id` or `/mystery/:id` routes are not advertised.

### Native Muse deployment status

**Native Muse compatibility is not yet verified.** As checked on September 21, 2026, the primary [Muse Connector Platform page](https://muse.ai/platform) describes connector submission, review, testing, and directory approval, but does not provide the technical request/authentication/event protocol needed to assert native compatibility. The user brief identifies Muse without a vendor integration contract; unrelated Muse Code and MuseHub protocols are not interchangeable.

The manifest intentionally reports `nativeMuseVerified: false` and `provider_protocol_verification_required`. Before advertising or submitting a native connector, obtain the intended platform's current connector specification, confirm the authentication handoff and callback registration, implement and test the actual tool/event framing, and complete its review process. The existing REST adapter and delegated authorization do not by themselves establish directory availability or native installation support.

## Events and proactive briefings

Subscriptions belong to a delegated connection. The event catalog describes available topics, required scopes, coverage, and missing sources. Create a subscription for supported topics, then use the Gateway event replay endpoint or `/v1/gateway/events/stream?subscriptionId=<id>` with the bearer token in the header. Reconnect with the returned cursor through `after` or SSE `Last-Event-ID` as supported by the route. Request at most 100 records per replay page.

Delivery reads committed notification, coordination, and world-result records. Bus messages are wake-up hints; a periodic catch-up also finds missed notifications. Each delivery revalidates the grant, scopes, ownership, and relevant current membership/discovery visibility. Reading agent events does not mark the player's notification inbox read.

Current coverage includes Crew join requests visible to the current leader, personal clue-scroll discoveries, owned visible coordination lifecycle/node signals, personal combat/law and market notification metadata, and published world-event results. It does **not** fabricate `operation.ready`, `mission.available`, `crafting.requirements.met`, `territory.attacked`, or other transitions absent from authoritative durable sources. The event catalog names these gaps.

Replay follows timestamp cursors over existing source retention; it is not exactly-once delivery and cannot guarantee capture of a very late commit whose timestamp predates the cursor. Consumers should deduplicate event IDs and reread relevant scoped context. Production guarantees stronger than this require an authoritative transactional outbox and agreed retention policy.

Daily briefing context is structured data, not a prewritten model answer. An external platform may schedule a briefing or respond to supported events. This repository does not claim that a native Muse scheduler or push-delivery integration has been configured.

## Verification and release boundary

`node test/muse-gateway.js` verifies canonical alias completeness, scoped discovery, exclusion of commit tools, malformed request rejection, authorization refusal propagation, untrusted-content framing, registry immutability, and official confirmation-link construction.

The Consigliere UI was also exercised in Chromium with mocked Gateway responses: read-only onboarding defaults, absence of commit scope, one-time token clearing, hostile connection labels rendered as text, explicit nonce/digest confirmation, revocation, signed-out state, and mobile overflow. This is a UI behavior check, not proof of external Muse interoperability.

A second Chromium smoke used the actual mounted server and disposable pg-mem: Muse tool mapping produced a coordination proposal, the player approved it in `/consigliere`, and exactly one authoritative coordination instance was created. `node test/gateway-consent.js` covers changed terms after known/uncertain command failures, visibility changes on proposal replay, and receipt recovery after expiry. The bounded review record is [agent-gateway-review/adversarial.md](agent-gateway-review/adversarial.md).

Deployment must include the Gateway database schema and the repository's required backend/release checks. Native Muse interoperability, unsupported game/event sources, and any unavailable chain transaction workflow remain explicit release gaps; do not equate the REST adapter's passing tests with a completed external platform review.
