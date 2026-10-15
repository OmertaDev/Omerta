# Agent Gateway events

The event gateway reads committed game records. Subscriptions persist in
`agent_gateway_subscriptions` and belong to one delegated connection and account.
Reading events never changes notification `delivered` or `pushed` flags.

## Coverage

| Topic | Required scope | Authority and visibility |
| --- | --- | --- |
| `crew.request.created` | `omerta.social.read` | Existing `crew_request` notification; current crew membership and leadership are required. This means a request to join a crew. |
| `mystery.clue.discovered` | `omerta.mysteries.read` | Existing personal `clue_found` notification for a legacy clue scroll. Only a discovery signal is returned. |
| `player.notification` | `omerta.player.read` | Personal combat and law notification signals from an explicit type allowlist. |
| `economy.notification` | `omerta.economy.read` | Personal market notification signals from an explicit type allowlist. |
| `coordination.created`, `coordination.node.discovered`, `coordination.node.completed`, `coordination.completed`, `coordination.cancelled` | `omerta.coordination.read` | Owned `coordination_events`, projected through the authoritative coordination service; historical characters and currently invisible nodes are excluded. |
| `world.event.resolved` | `omerta.world.read` | Public `event_results`; only the published kind, headline and winner are returned. |

`catalog` returns the caller's authorized topics and explains unavailable topics.
Family-operation availability, territory attacks/control changes, world-graph
mystery changes, crafting requirements, mission availability, operation readiness,
trade proposals, approaching season milestones, world-event starts, and resource
requests do not yet have an integrated durable transition source. The gateway
does not infer these events from current state or rename a different event.

Raw notification payloads, hidden graph nodes, discovery receipts, riddle salts,
solutions, private member inventories, and internal public-result details are
never returned. Further details should be fetched through a scoped capability.

## Service contract

```js
const events = createEventGateway({
  pool,
  bus: game.bus,
  authorize: security.revalidate,
  coordination,
});
const subscription = await events.subscribe(principal, {
  topics: ['crew.request.created', 'mystery.clue.discovered'],
});
const page = await events.read(principal, {
  subscriptionId: subscription.id, after: previousCursor, limit: 50,
});
```

`subscriptions(principal)` lists active subscriptions;
`unsubscribe(principal, id)` revokes one. Identical topic sets reuse the active
subscription. Each connection can have at most 20 active subscriptions. Scope
reduction fails reads of subscriptions that still require a removed scope; revoke
the old subscription and create one using the remaining authorized topics.

Cursor pages return `events`, `nextCursor`, and `hasMore`. Each event has `id`,
`topic`, `data`, `occurredAt`, `source`, and its own resumable `cursor`. The page
size is 1–100; one read examines at most 100 candidates and fetches at most 100
rows from each of the three source tables. An empty page can still have a next
page when records were filtered by current permissions. Cursors are bounded
positions bound to a subscription and connection; they are not credentials.

`stream(principal, { subscriptionId, after, onEvent, onHeartbeat, onClose })`
returns a handle with `close()`. The HTTP layer sends each cursor as the SSE `id`
and the topic as its `event`, and accepts `Last-Event-ID` for reconnection. Use
the Authorization header for the delegated bearer; credentials do not belong in
the URL. `onEvent` returning `false` closes a slow consumer. The route must close
the handle when the request disconnects. There are at most four live streams
per account **per gateway process**; multi-process deployments need an ingress
connection limit as well.

## Delivery and rollout limits

Subscriptions are durable; replay uses existing source retention and timestamp
cursors. It is not exactly-once delivery. Source timestamps describe occurrence
or transaction start, not commit order: an unusually late transaction can commit
behind an already-advanced cursor. A production guarantee against this gap
requires an authoritative transactional outbox or committed-change transport.
Events removed by the game's existing retention cannot be replayed. Consumers
must deduplicate event IDs and refresh authoritative context after reconnecting.

The existing in-process bus only wakes a database read. Its uncommitted payload
is never delivered, so rolled-back game writes cannot manufacture an event.
A 30-second heartbeat catches committed rows from workers/other processes and
sources without an emitter, and checks revocation even when no events arrive.
It also allows immediate local bus wake-ups without aggressive polling.

Connection validity, account status, token version, expiry, scopes, subscription
status, character identity, and relevant visibility are checked through fresh
authority reads. Revocation closes an idle stream at its next heartbeat and is
checked before every delivered event. Public world results do not bypass the
delegated connection's scope requirements.

`node test/gateway-events.js` exercises production subscription DDL in pg-mem:
cross-account and cross-connection isolation, discovery filtering, payload
redaction, cursor ties, persisted subscriptions, membership changes, scope loss,
revocation, rollback wake hints, backpressure, and per-process stream limits.
