# City successor fixture ordering review

Date: 2026-10-11. Phase: browser fixture source review and local execution;
hosted checks and production deployment are separate gates.

## Pinned source and scope

Reviewed fixture revision: `1ee6b2397dd94edb68e59747e9db00bdec70e29d`,
parent `0f15a64abbbd4e615a011dcde31156c015be709d` (procurement #229).
Integrated supplier continuity #232 at
`a10398ea66c234aa4b5c0dab47115b7f31dbb7ea` in
`39c930cbd4bd8448a1294a19e4684d156917db76`.
The integration differs from #232 only in `test/city-world-host-browser.js`.
Fixture Git blob: `bdf22ee87e16146616b7b29863568b9d5e774ffa`.
Independent read-only review verified the diff and all four retained log hashes;
no findings remained for this fixture source and local execution phase.
Executed fixture SHA-256:
`3f849a3b2ed0922ea180b56566122251b7e458978ceb32ac76142f3446e9fe37`.
No runtime, schema, dependency, permission, workflow or monetary behavior changes.

## Finding and correction

The original fixture installed its successor response waiter and clicked the old
panel's close control after replacing the character. A pending real Style read
can return the replacement first. The runtime correctly retires the old identity
and controls, leaving the test waiting for a response it already missed and
trying to click a hidden control. The hosted failure was run `38128750723`,
City job `114447406568`, original waiter at line 689.

The fixture now closes the panel while it still belongs to the original actor
and registers the unchanged newer-character HTTP 200 predicate before replacement.
A side rejection observer prevents premature unhandled rejection; the original
promise remains awaited and failures still fail the test.
No retries, timeout increases, response injection or runtime modifications were
introduced. Successor identity, same realm, removed private DOM and refusal of
retired actions remain asserted.

## Retained execution evidence

Four full focused world-host runs used Node `v24.19.0`. Raw logs and
`output/successor-race-proof.json` are retained in the managed repair worktree;
they must be preserved separately before any archive because output is ignored.

1. First instrumented run passed; its pre-replacement read was already settled.
   This alone did not reproduce or explain the failure.
2. A controlled real-request gate held that read across replacement, then fetched
   the actual new-character response before the original late waiter. The runtime
   retired the old scene; the original ordering failed with a hidden close control.
3. The same real gated race passed with the minimal ordering correction.
4. All gates and diagnostics were removed; the final clean full focused test passed.

Log SHA-256 values, respectively:

- `2705bf30ce8d6429b35ca3496dceeb83b1e208c509a08427a7c40bd6cdfdf023`
- `48f61f0625a4e70695b35c0f395374008122502066c5de6f5bc3627c1f0ad7da`
- `d1e7863fb6386aa7e7148f16623558b890bb4626ef32a38a79bc108e206999ca`
- `25a3d4fe8f424fdf85bbb2348e3bbfb3e56cb44a80318d3360e3828e79143b3f`

These results qualify the pinned fixture bytes and local browser phase. They do
not claim execution of the composed revision on hosted runners, native PostgreSQL
or production. Existing parent reviews retain their original revision and scope.
Live payments, real compute purchases and financial activation remain disabled.
