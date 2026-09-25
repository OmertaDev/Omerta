# Shared observer: bounded player ammo escrow

Owner: Codex/resource_proof. Base source:
`96e5a3d855f133580f7e4b10b1da093b5fbd38d0`. This is a test/observer
repair, with no production gameplay or accounting change.

The retained scarcity/abundance component runs at
`f9a4c84d8847a18dd65603a0dc8972e9b0058a36` reported valid ammo-market
boundaries as `UNSUPPORTED_ESCROW_BOUNDARY`. Their shared observer compared
only personal ammo with ammo ledger entries. The authored exchange deliberately
writes no ammo receipt when listing, pulling or delivering a lot: rounds remain
in the personal or live-listing inventory bucket. The focused pressure journal
already retained exact ownership, command and receipt evidence. Those historical
shared-observer failures remain preserved in `harness-resource-pressure-results.json`.

The shared observer now checks both personal ammo and each owner's personal
ammo plus their live ammo escrow. A listing moves rounds from that seller into
their escrow; a pull returns them to the same seller. A purchase requires one
fresh buyer debit and seller credit, reciprocal character counterparties, exact
lot quantity/price and exact seller net. Each receipt can explain only one
consumed lot. A retained lot cannot change owner, amount, price or other fields.
Unknown owners, stale/repeated receipts and balanced transfers to a different
owner fail. Integer ammo and decimal cash quantities are never rounded by the
observer. The bounded purchase classifier requires a safe-integer gross price.

Where all cash receipts belong to those trades, the exact authored street-tax
credit and remaining sink are also checked. Other cash receipts keep compound
tax attribution explicitly unsupported. Non-ammo listings and unrelated
resource/Family/season/OMR gaps stay in the existing unsupported inventory.
Death/birth escrow terminals, ambiguous multi-lot matching and other listing
terminals do not gain coverage. The shared snapshots have no durable HTTP
request identity, so this is custody/receipt lineage; the separate pressure
journal supplies the native test's observed request/response binding.

`test/rc1-world-ammo-escrow.js` covers list, buy, pull, exact no-value replay and
the tiny one-dollar sale where the seller net is zero. Sixteen pure negative
controls include balanced wrong-owner movement, reciprocal-counterparty
corruption, stale/duplicate/reused receipts, missing tax and escrow rewrites.
The initial development fixture omitted `street_tax.fund`; the unchanged broad
OMR snapshot check rejected that incomplete fixture. Adding the explicit zero
field corrected the test input, not observer arithmetic.

With `--evidence=<fresh-native-pressure-directory>`, the test verifies the
source-bound artifact index/hash chain, requires zero shared-observer escrow
limitations, reruns every shared and focused resource boundary, and rejects
seven controls derived from actual native states. One is the existing native
runner's committed balanced terminal corruption; the others are retained
counterfactual copies. Outputs are restricted and never overwrite existing
evidence. The original pressure runner's catch for old observer limitations
cannot make this verification pass.

```powershell
$env:COORDINATION_TEST_DATABASE_URL='postgres://postgres@127.0.0.1:55438/postgres'
$env:RC1_PRESSURE_OUTPUT='<fresh restricted scarcity directory>'
node test/rc1-native-resource-pressure.js --postgres --scenario=resource_scarcity
node test/rc1-world-ammo-escrow.js --evidence=$env:RC1_PRESSURE_OUTPUT
# Repeat with a separate output and --scenario=resource_abundance.
```

Both native probes retain their original three-entrant initialization and
15-minute original callback scope. Scarcity is ordinary entry, not a global
minimum; abundance uses declared initial respect, then canonical check-in cash
and ammo purchases. No new grant or resource adjustment is introduced. The
native terminal corruption is followed only by evidence and owned-database
cleanup. These are serial HTTP/callback boundaries; concurrent transactions,
per-commit integration, the full matrix, natural progression and deployed or
external backing remain unproven.

The repository review policy is applied with the existing pinned Pashov
`c577eb7799c349de0acb187ba00ca98e14e436fd`, Plamen
`795962b96e254f2e423a2635fe7f8cb8ea1e6d69`, and Trail of Bits
`d3323cefbcf645678b8dc481de204b02ad3d02dc` methods: trace the actual
storage/receipt authority, attack owner attribution and one-use identities, and
retain counterexamples and native retests. These are manual JavaScript/SQL
accounting passes, not Solidity or upstream orchestration execution. Installed
dependencies are reused locally; source/lockfile binding is not an installed
dependency attestation. No full resource or release clearance is claimed.
