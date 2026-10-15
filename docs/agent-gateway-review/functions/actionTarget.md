## `actionTarget` in src/gateway/actions.js (L5-L41)

**Purpose:** Restricts game mutation targets to existing supported commands.

**Inputs & Assumptions:** Capability/arguments were schema-validated on initial preparation; confirmation uses stored arguments. Identifier encoding is applied on every URL segment (`L4,L7-L35`).

**Outputs & Effects:** Returns an internal URL and small fixed-shape body, or refuses unavailable/invalid action. No network/database writes.

**Block-by-Block:**

```js
// L17-L22
case 'prepare_coordination_request': return {
  url: `/v1/coordination/${id(args.graphId)}/instances`, body: { expectedContentHash: args.expectedContentHash },
};
```

Switch cases define crafting/salvage, open operation, contribution, coordination create/act, and specific mystery actions. Each uses encoded identifiers and a selected body shape. Mystery branches validate action-specific required combinations; unknown targets fail closed (`L24-L39`).

**Cross-Function Dependencies:** Calls only fail and encodeURIComponent. Routes use existing actor ownership, idempotency, revision/content-hash and game-rule checks (`routes/worldgraph.js:L475-L607`; `routes/coordination.js:L113-L119`).

**Open Questions:** All underlying target routes' production concurrency guarantees require inherited-service evidence and the new composition's integration tests; this pure mapper does not establish those guarantees.
