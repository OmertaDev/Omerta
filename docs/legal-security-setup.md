# Legal and security remediation setup

The 2026-10-08 fixes are local source changes, not a deployment or legal clearance.
Production preflight now requires these real operator-provided values in the shared
API/worker environment group:

- `LEGAL_OPERATOR_NAME` and `LEGAL_POSTAL_ADDRESS` (valid physical postal address).
- `PRIVACY_CONTACT_EMAIL` (monitored for privacy requests and reports involving children).
- `DMCA_AGENT_NAME`, `DMCA_AGENT_EMAIL`, `DMCA_AGENT_ADDRESS`, `DMCA_AGENT_PHONE`.
- `DMCA_AGENT_REGISTERED=true` only after the operator verifies its actual registration
  in the [U.S. Copyright Office directory](https://www.copyright.gov/dmca-directory/faq.html); this flag does not register an agent.
- `PAYMENT_REFUND_POLICY` (the actual approved refund policy, rendered as plain text).

The default privacy policy is public even before operator details are configured;
it identifies the missing privacy contact without inventing one. Payment and copyright
pages return 503 until their necessary details are present. Marketing remains disabled without a postal address. The resource inventory
is public without these details. Do not use test profile values for a deployment.

The operator must monitor the published contacts, process rights/child-data reports,
review copyright notices/counter-notices, and implement the published repeat-infringer
policy. Code cannot perform Copyright Office registration or verify a physical address.
Audience assessment and applicable jurisdictional obligations still need operator review.

New human/operator account creation requires a neutral birth-date check; REST and MCP
signup instructions are in `omerta-mcp/README.md`. Dates are checked transiently, never
saved in account records. Under-13 visitors are refused before account creation; the
privacy contact provides the path to investigate existing child data.

RLS is enabled on every game-schema table during the PostgreSQL migration, with a
restrictive deny policy for direct database clients, including clients with explicit
grants. The backend's table-owner/BYPASSRLS connection remains trusted and route
authorization still enforces player access. Do not expose that connection to clients.
This is not a per-player RLS retrofit. pg-mem does not enforce RLS.

Optional quiz-answer, screen and share analytics are disabled, so no analytics consent
banner is needed for those removed features. Operational gameplay/accounting and abuse
records remain necessary for the service and are disclosed in the privacy policy.

Made/Wire passes are manually renewed prepaid access. Standing watches disclose each
cycle's cost/interval and cancel online. Transactions queue confirmation emails only to
verified recipients, independently of marketing preference. Players without a verified
email receive the existing in-app confirmation; universal emailed receipts would require
a deliberate change to the guest/no-email product. Receipt emails require an email
provider and a running worker. Ambiguous deliveries older than the provider idempotency
window are retained for investigation instead of automatically resent.

WalletConnect 2.26.0 is locally bundled, with provider telemetry and modal analytics
disabled. Run `npm run build:walletconnect` after its dependency changes and retain
`public/vendor/walletconnect-manifest.json` and license notices. The display font is
self-hosted; remaining fonts use system fallbacks.

Focused verification: `npm run test:legal-security`, `node test/dispatch.js`,
`node test/path-funnel.js`, `node test/made.js`, `node test/wire.js`, and
`node tools/public-ui.js`. Real PostgreSQL denial evidence is retained in
`output/audits/legal-security-2026-10-08/rls-remediation-evidence.json`.
