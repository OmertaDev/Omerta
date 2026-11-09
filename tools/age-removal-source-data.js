// Exact age-removal historical comparison only; no execution or deployment results transferred.
const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const AGE_REMOVAL_SOURCE = freeze({
  "status": "SEALED",
  "phase": "EXACT_AGE_REMOVAL_SOURCE_COMPARISON_ONLY",
  "revision": "12436d6d31eab4427f2b93a35d4f7b740709774b",
  "tree": "2665bcbc0190b9a8710de110c17a29108d51dd01",
  "predecessor": "35913ec1b448275b227019ede2a2ef8047be55aa",
  "predecessorTree": "c74c606d97ee2f8ebb6c5201a4ddd2c2781d5db0",
  "files": {
    "AGENTS.md": {
      "current": {
        "mode": "100644",
        "blob": "2920f3703bfd0d8a000a98cedc692f01f857258f",
        "sha256": "212e84a6129c01927418d8b08d537fbdd1a04667b2ddf79028d9a3cdd8a6054e",
        "bytes": 49950
      },
      "baseline": {
        "mode": "100644",
        "blob": "a4e85493e8cf0c9218323bca2c1c47891d611a8c",
        "sha256": "38eb8602fec3af443a7125073adcc5c82e03930eff1a51b4e1c99ea23de3d987",
        "bytes": 50024
      },
      "inverses": [
        {
          "at": 5197,
          "current": "1. **Create an agent identity.** New agents call `POST /v1/auth/agent` with a\n   securely persisted, random 32-byte unpadded-base64url `bootstrapSecret`.\n   The account is permanently marked as an agent before its first 90-day bearer\n   is issued. Retry the same secret after an ambiguous response; save the bearer\n   before acknowledging bootstrap. Existing authenticated accounts can become\n   permanent agents through `POST /v1/auth/agent-key`.\n2. **Bring and link an EVM wallet.** Agent auth does not create a custodial\n",
          "baseline": "1. **Create an agent identity.** New agents call `POST /v1/auth/agent` with a\n   securely persisted, random 32-byte unpadded-base64url `bootstrapSecret`.\n   The account is permanently marked as an agent before its first 90-day bearer\n   is issued, so no birth date is needed. Human signup still requires its age\n   check. Retry the same secret after an ambiguous response; save the bearer\n   before acknowledging bootstrap. Existing authenticated accounts can become\n   permanent agents through `POST /v1/auth/agent-key`.\n2. **Bring and link an EVM wallet.** Agent auth does not create a custodial\n"
        }
      ]
    },
    "SPEC.md": {
      "current": {
        "mode": "100644",
        "blob": "b3da8fc5a6ae7254d9833c3f60674d3de874276b",
        "sha256": "027c2ef10f49088c8e18e3878f1e21fa26501f31c72bb4b55bbeffd77105eb5d",
        "bytes": 57294
      },
      "baseline": {
        "mode": "100644",
        "blob": "d6ec9b96046c622b0fd6230e5f8acacffc901364",
        "sha256": "2593831d2e445b5fef8e8a88128650af80dd3661339e726e3dd142d06394bbf4",
        "bytes": 57294
      },
      "inverses": [
        {
          "at": 603,
          "current": "| | |\n|---|---|\n| Backend modules | **618** files, **141073** lines (recursive source inventory) |\n| Test suites | **1036** files, **213491** lines (recursive source inventory) |\n| HTTP routes | **1386** registrations (**1386** unique; 1274 under `/v1`) |\n| Database tables | **585** (`schema.sql`, 9820 lines) |\n| Client | **14683** lines in `public/index.html`; tabbed game interface with locally served Fieldwork and player guidance modules |\n",
          "baseline": "| | |\n|---|---|\n| Backend modules | **618** files, **141073** lines (recursive source inventory) |\n| Test suites | **1032** files, **213491** lines (recursive source inventory) |\n| HTTP routes | **1386** registrations (**1386** unique; 1274 under `/v1`) |\n| Database tables | **585** (`schema.sql`, 9820 lines) |\n| Client | **14683** lines in `public/index.html`; tabbed game interface with locally served Fieldwork and player guidance modules |\n"
        }
      ]
    },
    "docs/legal-security-setup.md": {
      "current": {
        "mode": "100644",
        "blob": "533b4bdf49210b78f09aadfec35ede2c73068f4e",
        "sha256": "584092fc2dd746161ee3de74f00814b5c4b1983524904ee476b1cb745f7066c3",
        "bytes": 3589
      },
      "baseline": {
        "mode": "100644",
        "blob": "2d3f4be88a6b8d28aa32c2d13a6cd29c62a10f49",
        "sha256": "7f7ef866f4c66ab038de8aee878e72a0c9441c1561d07bad2776c09979dc0c0c",
        "bytes": 3753
      },
      "inverses": [
        {
          "at": 1366,
          "current": "policy. Code cannot perform Copyright Office registration or verify a physical address.\nAudience assessment and applicable jurisdictional obligations still need operator review.\n\nSignup does not request or require a birth date. The age-check prompt, API and\ncookie checks have been removed. The privacy contact provides the path to investigate existing child data.\n\nRLS is enabled on every game-schema table during the PostgreSQL migration, with a\nrestrictive deny policy for direct database clients, including clients with explicit\n",
          "baseline": "policy. Code cannot perform Copyright Office registration or verify a physical address.\nAudience assessment and applicable jurisdictional obligations still need operator review.\n\nNew human/operator account creation requires a neutral birth-date check; REST and MCP\nsignup instructions are in `omerta-mcp/README.md`. Dates are checked transiently, never\nsaved in account records. Visitors under 21, including children, are refused before account creation; the\nprivacy contact provides the path to investigate existing child data.\n\nRLS is enabled on every game-schema table during the PostgreSQL migration, with a\nrestrictive deny policy for direct database clients, including clients with explicit\n"
        }
      ]
    },
    "omerta-mcp/README.md": {
      "current": {
        "mode": "100644",
        "blob": "322cdb9f2e6e3dc38187a4cae8765fad0dbbef8a",
        "sha256": "f58e5a1ea66ae82027e5499e196017a3fba481f9090ce6d11bce92b1ff8263a2",
        "bytes": 8405
      },
      "baseline": {
        "mode": "100644",
        "blob": "57c4fc72568867e878f9118f2d0d58de1a39d007",
        "sha256": "6352d782b1ab6a39c1d07bccd0c773044e57b7d876be9b30ece583413e0b3725",
        "bytes": 9553
      },
      "inverses": [
        {
          "at": 948,
          "current": "\n> **\"Start playing OMERTÀ — make me a character called Machine Malone, then check the opportunities and act on the best one.\"**\n\nThe config file lives at:\n\n| OS | Path |\n",
          "baseline": "\n> **\"Start playing OMERTÀ — make me a character called Machine Malone, then check the opportunities and act on the best one.\"**\n\nFor a new account, provide your complete birth date to `omerta_start` as\n`birthDate: \"YYYY-MM-DD\"`. The agent must ask for it and never infer or invent it.\nThe server checks eligibility without saving the birth date. Account creation is\nunavailable to users under 21, including children; the privacy page provides help. Returning saved\nsessions do not need the date again.\n\nREST clients can send `birthDate` in a guest/provider signup body, or first POST\n`{ \"birthDate\": \"YYYY-MM-DD\" }` to `/v1/age-check` and retain its short-lived,\nHttpOnly eligibility cookie. Browser signup displays a birth-date check. Existing\nguest bootstrap recovery remains available without resubmitting the date.\n\nFor Agent Alpha CLI creation, supply the human operator's complete birth date\nwith `--birth-date YYYY-MM-DD` alongside `--create`. The date is sent only for\nsignup eligibility and is never written to its session, bootstrap recovery file,\nor report. Existing committed accounts can recover without the date. Agents must\nask the operator rather than inventing a date; operators under 21 cannot sign up.\n\nThe config file lives at:\n\n| OS | Path |\n"
        },
        {
          "at": 5466,
          "current": "session lifecycle described below. Production extraction remains dormant because\nno chain is configured.\n\nNew identities use `POST /v1/auth/agent` and are permanently classified as agents\nbefore their first bearer is issued. The MCP saves a shared recovery secret before signup, then saves the\nbearer before acknowledging bootstrap so a lost reply cannot create a new identity.\n\nThe 90-day agent token is persisted in an owner-only configuration file and reused after\n",
          "baseline": "session lifecycle described below. Production extraction remains dormant because\nno chain is configured.\n\nNew identities use `POST /v1/auth/agent` without a birth date and are permanently\nclassified as agents before their first bearer is issued. Human signup keeps its\nage check. The MCP saves a shared recovery secret before signup, then saves the\nbearer before acknowledging bootstrap so a lost reply cannot create a new identity.\n\nThe 90-day agent token is persisted in an owner-only configuration file and reused after\n"
        }
      ]
    },
    "omerta-mcp/index.js": {
      "current": {
        "mode": "100644",
        "blob": "158ea315f2c55b2ca0de89a06b9acbedf901e7d9",
        "sha256": "36a157860b794fdd4cfd70c06eeb170ea375f9534747bbdbce481d639dcc2a17",
        "bytes": 21734
      },
      "baseline": {
        "mode": "100644",
        "blob": "0df11f6c78dfc778e60ddc7a01145a4ef187a6e9",
        "sha256": "c1e27cfe859485d2ae69d5c6c7886aba26d9d14547ad5f533e38ea766244fd50",
        "bytes": 21991
      },
      "inverses": [
        {
          "at": 9616,
          "current": "      properties: {\n        name: { type: 'string', description: 'Character name to create (2–24 chars, unique among the living). Omit to only authenticate.' },\n        inviteCode: { type: 'string', description: 'Closed-alpha invite code, if required (else set OMERTA_INVITE).' },\n        referralCode: { type: 'string', description: \"The recruiter's character name, if you were referred.\" },\n        reset: { type: 'boolean', description: 'Explicitly discard an invalid/expired saved session and create a new agent account. Never use this to farm accounts.' },\n      },\n",
          "baseline": "      properties: {\n        name: { type: 'string', description: 'Character name to create (2–24 chars, unique among the living). Omit to only authenticate.' },\n        inviteCode: { type: 'string', description: 'Closed-alpha invite code, if required (else set OMERTA_INVITE).' },\n        birthDate: { type: 'string', description: 'Optional legacy date validation (YYYY-MM-DD). Agent signup is exempt; do not prompt for or infer a date. Human signup has a separate age check.' },\n        referralCode: { type: 'string', description: \"The recruiter's character name, if you were referred.\" },\n        reset: { type: 'boolean', description: 'Explicitly discard an invalid/expired saved session and create a new agent account. Never use this to farm accounts.' },\n      },\n"
        },
        {
          "at": 17942,
          "current": "      } catch (e) { return ok({ authed: false, error: 'session_write',\n        message: `The agent recovery credential could not be saved before signup: ${e?.message || e}` }); }\n      const admission = await api('POST', '/v1/auth/agent', { bootstrapSecret,\n        ...(invite ? { inviteCode: invite } : {}) });\n      if (admission.status !== 200 || !admission.body?.token) return ok({ step: 'agent_signup', ...admission });\n      try { writeBootstrapSession(admission.body.token, bootstrapSecret); }\n      catch (e) { return ok({ authed: true, agent: true, error: 'session_write',\n",
          "baseline": "      } catch (e) { return ok({ authed: false, error: 'session_write',\n        message: `The agent recovery credential could not be saved before signup: ${e?.message || e}` }); }\n      const admission = await api('POST', '/v1/auth/agent', { bootstrapSecret,\n        ...(invite ? { inviteCode: invite } : {}), ...(args.birthDate ? { birthDate: args.birthDate } : {}) });\n      if (admission.status !== 200 || !admission.body?.token) return ok({ step: 'agent_signup', ...admission });\n      try { writeBootstrapSession(admission.body.token, bootstrapSecret); }\n      catch (e) { return ok({ authed: true, agent: true, error: 'session_write',\n"
        }
      ]
    },
    "package-lock.json": {
      "current": {
        "mode": "100644",
        "blob": "056460af0e087109127061640cec1634fdc6e505",
        "sha256": "74c07666cfd58d378d34ab348a683b78b7fdae42b12504a09837d5f23dbc20dc",
        "bytes": 257391
      },
      "baseline": {
        "mode": "100644",
        "blob": "cb692ac8e9381b05a920612cadb51dc2275b85f7",
        "sha256": "20f8360cea8c6565ddf257e0e5846d009a672dd6fd2ef36df5ddff38fa3eaa7f",
        "bytes": 257066
      },
      "inverses": [
        {
          "at": 571,
          "current": "        \"acorn\": \"8.18.0\",\n        \"esbuild\": \"0.25.12\",\n        \"playwright-core\": \"^1.62.0\",\n        \"solhint\": \"6.2.4\",\n        \"three\": \"0.187.0\"\n      },\n      \"engines\": {\n        \"node\": \">=20\"\n",
          "baseline": "        \"acorn\": \"8.18.0\",\n        \"esbuild\": \"0.25.12\",\n        \"playwright-core\": \"^1.62.0\",\n        \"solhint\": \"6.2.4\"\n      },\n      \"engines\": {\n        \"node\": \">=20\"\n"
        },
        {
          "at": 243832,
          "current": "      \"integrity\": \"sha512-P4nbQYQfePJxRSmY+v/KINxVucm4NF3p3s7pJveMTtom52FR4YGltUQLB8idDXwDDWW+eYrWDFbuzUnjoWHF7g==\",\n      \"license\": \"MIT\"\n    },\n    \"node_modules/three\": {\n      \"version\": \"0.187.0\",\n      \"resolved\": \"https://registry.npmjs.org/three/-/three-0.187.0.tgz\",\n      \"integrity\": \"sha512-Qiu7R+Cmh8CstZsY1uJOSWnVlfo7ZtNLV7mF8Jltk3LB3AtDu9cRZlcnRKkAk8Y4z6KKw35z7Y7Urd7jWY8etA==\",\n      \"dev\": true,\n      \"license\": \"MIT\"\n    },\n    \"node_modules/toad-cache\": {\n      \"version\": \"3.7.4\",\n      \"resolved\": \"https://registry.npmjs.org/toad-cache/-/toad-cache-3.7.4.tgz\",\n",
          "baseline": "      \"integrity\": \"sha512-P4nbQYQfePJxRSmY+v/KINxVucm4NF3p3s7pJveMTtom52FR4YGltUQLB8idDXwDDWW+eYrWDFbuzUnjoWHF7g==\",\n      \"license\": \"MIT\"\n    },\n    \"node_modules/toad-cache\": {\n      \"version\": \"3.7.4\",\n      \"resolved\": \"https://registry.npmjs.org/toad-cache/-/toad-cache-3.7.4.tgz\",\n"
        }
      ]
    },
    "package.json": {
      "current": {
        "mode": "100644",
        "blob": "e4a9a5a209c08b6aaec459cb83ba5b3fb7553f84",
        "sha256": "89b79a5c581530f00bc3534d206bbb332eba8e47cbc237cf0980ee0d32ac9f7f",
        "bytes": 64298
      },
      "baseline": {
        "mode": "100644",
        "blob": "b4c01d90200efe8493d685c7ba56e4912ae7f36c",
        "sha256": "a64159184378adbf9387773776427f49445b40b178d7f6b0a787b40b9f21675b",
        "bytes": 64133
      },
      "inverses": [
        {
          "at": 51770,
          "current": "    \"test:gateway:postgres\": \"node test/gateway-postgres.js\",\n    \"test:gateway:browser\": \"node test/consigliere-recovery-browser.js\",\n    \"build:walletconnect\": \"node tools/build-walletconnect.mjs\",\n    \"build:strategy-city\": \"node tools/build-strategy-city.mjs\",\n    \"test:legal-security\": \"node test/age.js && node test/db-rls.js && node test/legal-security.js && node test/payment-receipts.js\",\n    \"release:media\": \"node tools/release-media.mjs unpack\",\n    \"postinstall\": \"node tools/release-media.mjs unpack\",\n",
          "baseline": "    \"test:gateway:postgres\": \"node test/gateway-postgres.js\",\n    \"test:gateway:browser\": \"node test/consigliere-recovery-browser.js\",\n    \"build:walletconnect\": \"node tools/build-walletconnect.mjs\",\n    \"test:legal-security\": \"node test/age.js && node test/db-rls.js && node test/legal-security.js && node test/payment-receipts.js\",\n    \"release:media\": \"node tools/release-media.mjs unpack\",\n    \"postinstall\": \"node tools/release-media.mjs unpack\",\n"
        },
        {
          "at": 59816,
          "current": "    \"test:city:layout\": \"node test/city-world-layout.js && node test/continuous-city-source-compatibility.js\",\n    \"test:decision-guide\": \"node test/decision-guide.js && node test/decision-guide-client.js && node test/decision-guide-api.js\",\n    \"test:ux\": \"npm run test:ux:source && node test/ux-feedback.js && node test/circle-highlights.js && node test/ux-workspace.js && node test/ux-tactics.js && node test/ux-investigation-api.js && node test/ux-coordination.js && node test/ux-identity.js && node test/ux-story.js && node test/ux-community.js && node test/ux-tools.js\",\n    \"test:ux:browser\": \"node test/strategy-command-browser.js && node test/noir-shell-browser.js && node test/ux-shell-browser.js && node test/ux-progression-browser.js && node test/ux-navigation-browser.js && node test/ux-social-browser.js && node test/ux-experience-browser.js && node test/ux-workspace-browser.js && node test/ux-tactics-browser.js && node test/ux-investigation-browser.js && node test/ux-coordination-browser.js && node test/ux-expanded-browser.js && node test/ux-feel-browser.js && node test/ux-tools-browser.js && node test/ux-identity-browser.js && node test/ux-story-browser.js && node test/ux-community-browser.js && node test/ux-personality-browser.js && npm run test:site && npm run test:site:browser\",\n    \"test:ux:postgres\": \"node test/ux-postgres.js && node test/ux-postgres-rls.js\",\n    \"test:ux:source\": \"node test/noir-ui-source-compatibility.js && node test/sale-source-compatibility.js && node test/ux-source-compatibility.js\",\n    \"test:economy-ux-source\": \"node test/contract-release-source-compatibility.js && node test/businessdesk-combined-source-compatibility.js && node test/businessdesk-combined-native-provenance.js && node test/economy-deed-merge-source-compatibility.js && node test/businessdesk-noir-source-compatibility.js && node test/businessdesk-source-compatibility.js && node test/deed-allocation-source-compatibility.js && node test/deed-benefit-native-catalog.js && node test/economy-ux-merge-source-compatibility.js\",\n",
          "baseline": "    \"test:city:layout\": \"node test/city-world-layout.js && node test/continuous-city-source-compatibility.js\",\n    \"test:decision-guide\": \"node test/decision-guide.js && node test/decision-guide-client.js && node test/decision-guide-api.js\",\n    \"test:ux\": \"npm run test:ux:source && node test/ux-feedback.js && node test/circle-highlights.js && node test/ux-workspace.js && node test/ux-tactics.js && node test/ux-investigation-api.js && node test/ux-coordination.js && node test/ux-identity.js && node test/ux-story.js && node test/ux-community.js && node test/ux-tools.js\",\n    \"test:ux:browser\": \"node test/ux-shell-browser.js && node test/ux-progression-browser.js && node test/ux-navigation-browser.js && node test/ux-social-browser.js && node test/ux-experience-browser.js && node test/ux-workspace-browser.js && node test/ux-tactics-browser.js && node test/ux-investigation-browser.js && node test/ux-coordination-browser.js && node test/ux-expanded-browser.js && node test/ux-feel-browser.js && node test/ux-tools-browser.js && node test/ux-identity-browser.js && node test/ux-story-browser.js && node test/ux-community-browser.js && node test/ux-personality-browser.js && npm run test:site && npm run test:site:browser\",\n    \"test:ux:postgres\": \"node test/ux-postgres.js && node test/ux-postgres-rls.js\",\n    \"test:ux:source\": \"node test/noir-ui-source-compatibility.js && node test/sale-source-compatibility.js && node test/ux-source-compatibility.js\",\n    \"test:economy-ux-source\": \"node test/contract-release-source-compatibility.js && node test/businessdesk-combined-source-compatibility.js && node test/businessdesk-combined-native-provenance.js && node test/economy-deed-merge-source-compatibility.js && node test/businessdesk-noir-source-compatibility.js && node test/businessdesk-source-compatibility.js && node test/deed-allocation-source-compatibility.js && node test/deed-benefit-native-catalog.js && node test/economy-ux-merge-source-compatibility.js\",\n"
        },
        {
          "at": 64162,
          "current": "    \"acorn\": \"8.18.0\",\n    \"playwright-core\": \"^1.62.0\",\n    \"solhint\": \"6.2.4\",\n    \"esbuild\": \"0.25.12\",\n    \"three\": \"0.187.0\"\n  }\n}\n",
          "baseline": "    \"acorn\": \"8.18.0\",\n    \"playwright-core\": \"^1.62.0\",\n    \"solhint\": \"6.2.4\",\n    \"esbuild\": \"0.25.12\"\n  }\n}\n"
        }
      ]
    },
    "public/index.html": {
      "current": {
        "mode": "100644",
        "blob": "d031f03f8050e0d07b2a195bf7bdb6af93e7e79f",
        "sha256": "3504a39e1a670166f093675e8c14e91ffec231eaea1cbcc95d60cd6b44268b3d",
        "bytes": 1406414
      },
      "baseline": {
        "mode": "100644",
        "blob": "87001f9c2f12ca5357dad2beec721c143a9db391",
        "sha256": "bff35121e60ff9e88c8cda3b9ee326a858aca60c54b04a21b246f0c7b3f7b9a6",
        "bytes": 1408520
      },
      "inverses": [
        {
          "at": 106946,
          "current": "<link rel=\"stylesheet\" href=\"/ux-tactics.css?v=20261024-2\">\n<link rel=\"stylesheet\" href=\"/ux-investigation.css?v=20261024-2\">\n<link rel=\"stylesheet\" href=\"/ux-coordination.css?v=20261024-2\">\n<link rel=\"stylesheet\" href=\"/noir-ui.css?v=20261108-1\">\n<link rel=\"stylesheet\" href=\"/noir-landing.css?v=20261108-1\">\n<link rel=\"stylesheet\" href=\"/strategy-command.css?v=20261108-1\">\n</head>\n<body>\n<svg style=\"display:none\" aria-hidden=\"true\"><defs>\n",
          "baseline": "<link rel=\"stylesheet\" href=\"/ux-tactics.css?v=20261024-2\">\n<link rel=\"stylesheet\" href=\"/ux-investigation.css?v=20261024-2\">\n<link rel=\"stylesheet\" href=\"/ux-coordination.css?v=20261024-2\">\n</head>\n<body>\n<svg style=\"display:none\" aria-hidden=\"true\"><defs>\n"
        },
        {
          "at": 143203,
          "current": "  <div id=\"status-strips\"><div id=\"vitals\" aria-label=\"Current resources\"></div></div>\n  <div id=\"layout\">\n    <aside id=\"city-sidebar\" aria-label=\"City navigation and character\">\n      <details id=\"city-directory\">\n        <summary>Explore the city</summary>\n        <div class=\"city-directory-body\">\n          <div class=\"city-nav-label\">THE CITY</div>\n",
          "baseline": "  <div id=\"status-strips\"><div id=\"vitals\" aria-label=\"Current resources\"></div></div>\n  <div id=\"layout\">\n    <aside id=\"city-sidebar\" aria-label=\"City navigation and character\">\n      <details id=\"city-directory\" open>\n        <summary>Explore the city</summary>\n        <div class=\"city-directory-body\">\n          <div class=\"city-nav-label\">THE CITY</div>\n"
        },
        {
          "at": 144774,
          "current": "      <div id=\"tabart\" class=\"hidden\"><span></span></div>\n      <div id=\"coachwrap\"></div>\n      <details id=\"ux-screen-tools\" class=\"ux-screen-tools\"><summary>Screen tools <span>Shortcuts, reading &amp; workspace</span></summary><div id=\"screen-tool-content\" class=\"ux-screen-tools-body\"><nav id=\"action-readiness\" class=\"hidden\" aria-label=\"Activity timers and options\"></nav></div></details>\n      <!-- #introwrap stays INSIDE #tabbodies but OUTSIDE the per-tab divs. The shell places\n           first-visit reference below the playable content; screen renderers cannot resurrect\n           a dismissed introduction when they refresh their own #tab-<id>. -->\n      <div id=\"tabbodies\"><div id=\"introwrap\"></div></div>\n    </div>\n\n",
          "baseline": "      <div id=\"tabart\" class=\"hidden\"><span></span></div>\n      <div id=\"coachwrap\"></div>\n      <details id=\"ux-screen-tools\" class=\"ux-screen-tools\"><summary>Screen tools <span>Shortcuts, reading &amp; workspace</span></summary><div id=\"screen-tool-content\" class=\"ux-screen-tools-body\"><nav id=\"action-readiness\" class=\"hidden\" aria-label=\"Activity timers and options\"></nav></div></details>\n      <!-- #introwrap lives INSIDE #tabbodies (first child) but OUTSIDE the per-tab divs: the\n           first-visit card counts as the screen's own content (it explains the screen you just\n           tapped), while renderers — which rewrite only their #tab-<id> — can never resurrect a\n           dismissed card mid-visit. -->\n      <div id=\"tabbodies\"><div id=\"introwrap\"></div></div>\n    </div>\n\n"
        },
        {
          "at": 158121,
          "current": "<script src=\"/ux-tactics.js?v=20261105-noir-release\"></script>\n<script src=\"/ux-investigation.js?v=20261024-2\"></script>\n<script src=\"/ux-coordination.js?v=20261024-2\"></script>\n<script src=\"/noir-shell.js?v=20261108-1\"></script>\n<script src=\"/strategy-command.js?v=20261108-1\"></script>\n<script>\n(() => {\n  // Optional guidance must not stop core play if its separate script cannot load.\n",
          "baseline": "<script src=\"/ux-tactics.js?v=20261105-noir-release\"></script>\n<script src=\"/ux-investigation.js?v=20261024-2\"></script>\n<script src=\"/ux-coordination.js?v=20261024-2\"></script>\n<script>\n(() => {\n  // Optional guidance must not stop core play if its separate script cannot load.\n"
        },
        {
          "at": 584455,
          "current": "    if (h.get('token') || h.get('claimed') || h.get('autherr')) history.replaceState(null, '', location.pathname);\n  })();\n  const startXOAuth = async () => {\n    const inviteCode = $('#invite-code')?.value?.trim();\n    const r = await api('POST', '/v1/auth/x/start', inviteCode ? { inviteCode } : {});\n    if (r.body?.url) location.href = r.body.url;\n",
          "baseline": "    if (h.get('token') || h.get('claimed') || h.get('autherr')) history.replaceState(null, '', location.pathname);\n  })();\n  const startXOAuth = async () => {\n    if (!token && !await verifyAge()) return;\n    const inviteCode = $('#invite-code')?.value?.trim();\n    const r = await api('POST', '/v1/auth/x/start', inviteCode ? { inviteCode } : {});\n    if (r.body?.url) location.href = r.body.url;\n"
        },
        {
          "at": 589395,
          "current": "    else toast(r.body?.message || r.body?.error || 'no dice', true);\n    return false;\n  };\n  let guestPending = false;\n  const enterAsGhost = async () => {\n    if (guestPending) return;\n",
          "baseline": "    else toast(r.body?.message || r.body?.error || 'no dice', true);\n    return false;\n  };\n  let ageChecked = 0;\n  async function verifyAge() {\n    if (ageChecked > Date.now()) return true;\n    if (sessionStorage.getItem('omerta_age_blocked')) {\n      toast('Account creation is unavailable. See the privacy page for help.', true);\n      return false;\n    }\n    return new Promise((resolve) => {\n      const dialog = document.createElement('dialog');\n      dialog.className = 'modal';\n      dialog.setAttribute('aria-labelledby', 'age-title');\n      dialog.innerHTML = `<h2 id=\"age-title\">Your birth date</h2><p>Enter your complete birth date to continue. We check it without saving it.</p><form><label for=\"age-date\">Birth date</label><input id=\"age-date\" name=\"birthDate\" type=\"date\" required min=\"${new Date().getFullYear() - 120}-01-01\" max=\"${new Date().toISOString().slice(0, 10)}\"><p id=\"age-error\" role=\"alert\"></p><p><a href=\"/privacy\">Privacy policy and help</a></p><button class=\"act\" type=\"submit\">Continue</button><button class=\"act\" type=\"button\" id=\"age-cancel\">Cancel</button></form>`;\n      document.body.append(dialog);\n      const finish = (ok) => { dialog.close(); dialog.remove(); resolve(ok); };\n      dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(false); });\n      dialog.querySelector('#age-cancel').onclick = () => finish(false);\n      dialog.querySelector('form').onsubmit = async (event) => {\n        event.preventDefault();\n        const input = dialog.querySelector('input');\n        const birthDate = input.value;\n        input.value = '';\n        const result = await api('POST', '/v1/age-check', { birthDate });\n        if (result.code < 400) { ageChecked = Date.now() + 14 * 60 * 1000; finish(true); }\n        else if (result.body?.error === 'age_ineligible') {\n          sessionStorage.setItem('omerta_age_blocked', '1');\n          dialog.querySelector('form').innerHTML = '<p role=\"alert\">Account creation is unavailable. No birth date was saved.</p><p><a href=\"/privacy\">Privacy policy and help</a></p><button type=\"button\" class=\"act\">Close</button>';\n          dialog.querySelector('button').onclick = () => finish(false);\n        } else dialog.querySelector('#age-error').textContent = result.body?.message || 'Please try again.';\n      };\n      dialog.showModal();\n      dialog.querySelector('input').focus();\n    });\n  }\n  let guestPending = false;\n  const enterAsGhost = async () => {\n    if (guestPending) return;\n"
        },
        {
          "at": 589607,
          "current": "    const controls = ['#btn-guest', '#btn-guest2'].map(selector => $(selector)).filter(Boolean);\n    const labels = controls.map(button => button.textContent);\n    const status = $('#guest-status');\n    status.hidden = false; status.textContent = 'Opening your street…';\n    controls.forEach(button => { button.disabled = true; button.setAttribute('aria-busy', 'true'); button.textContent = 'Entering the city…'; });\n    try {\n      const inviteCode = undefined;\n      const result = await api('POST', '/v1/auth/guest', inviteCode ? { inviteCode } : {});\n      globalThis.OmertaSiteAnalytics?.signupResult?.(result);\n",
          "baseline": "    const controls = ['#btn-guest', '#btn-guest2'].map(selector => $(selector)).filter(Boolean);\n    const labels = controls.map(button => button.textContent);\n    const status = $('#guest-status');\n    status.hidden = false; status.textContent = 'Checking eligibility…';\n    controls.forEach(button => { button.disabled = true; button.setAttribute('aria-busy', 'true'); button.textContent = 'Entering the city…'; });\n    try {\n      if (!await verifyAge()) { status.textContent = ''; status.hidden = true; return; }\n      status.textContent = 'Opening your street…';\n      const inviteCode = undefined;\n      const result = await api('POST', '/v1/auth/guest', inviteCode ? { inviteCode } : {});\n      globalThis.OmertaSiteAnalytics?.signupResult?.(result);\n"
        },
        {
          "at": 593556,
          "current": "  $('#btn-provider').onclick = async () => {\n    const provider = $('#auth-provider').value, tok = $('#auth-token').value.trim();\n    if (!tok) return toast('paste a provider token first', true);\n    const inviteCode = undefined;\n    landToken(await api(`POST`, `/v1/auth/${provider}`, { token: tok, ...(inviteCode ? { inviteCode } : {}) }));\n  };\n",
          "baseline": "  $('#btn-provider').onclick = async () => {\n    const provider = $('#auth-provider').value, tok = $('#auth-token').value.trim();\n    if (!tok) return toast('paste a provider token first', true);\n    if (!await verifyAge()) return;\n    const inviteCode = undefined;\n    landToken(await api(`POST`, `/v1/auth/${provider}`, { token: tok, ...(inviteCode ? { inviteCode } : {}) }));\n  };\n"
        },
        {
          "at": 958490,
          "current": "    // but draws law heat + a harder bust. Same cash EV — the choice is your risk appetite.\n    const crimeCard = (c) => {\n      const { terms, choices } = coreCrimeMarkup(c);\n      return `<article class=\"card noir-job-card\">${aart('crime', c.id)}<div class=\"noir-job-content\">\n        <div class=\"noir-job-eyebrow\">Street job · Level ${c.lvl}</div><span class=\"t\">${esc(c.name)}</span>\n        ${terms}<div class=\"verbrow\">${choices}</div></div></article>`;\n    };\n    const allCrimes = [...(rules?.crimes || [])].sort((a, b) => a.lvl - b.lvl);\n    const lvl = me?.level || 1;\n",
          "baseline": "    // but draws law heat + a harder bust. Same cash EV — the choice is your risk appetite.\n    const crimeCard = (c) => {\n      const { terms, choices } = coreCrimeMarkup(c);\n      return `<div class=\"card\">${aart('crime', c.id)}<span class=\"t\">${esc(c.name)}</span>${terms}<div class=\"verbrow\">${choices}</div></div>`;\n    };\n    const allCrimes = [...(rules?.crimes || [])].sort((a, b) => a.lvl - b.lvl);\n    const lvl = me?.level || 1;\n"
        },
        {
          "at": 973694,
          "current": "    // jobs + the bank/map lead the screen; everything else is a labeled drawer that stays how you\n    // left it. One glance = act; the depth is a click away, not a scroll away.\n    t.innerHTML = `\n      <div class=\"noir-jobs-heading\"><h2>Find your next score</h2><span>${best.length} available · Level ${lvl}</span></div>\n      ${streetActionClock()}\n      <div class=\"grid noir-job-grid\">${crimes || restCrimes && '<span class=\"d\" style=\"color:var(--dim)\">no jobs at your level yet — open the full book below</span>' || ''}</div>\n      ${rest.length ? sect('crimes-all', 'The Full Book', `every job in the city (${allCrimes.length})`, `<div class=\"grid noir-job-grid\">${restCrimes}</div>`) : ''}\n\n${decisionCard('Cash exposure', (()=>{const b=PlayerExperience.bank(me);return [`Pocket: ${guideMoney(b.pocket)}. Bank total: ${guideMoney(b.total)}.`, `Cleared: ${guideMoney(b.cleared)}. In transit: ${guideMoney(b.transit)}. Clearing: ${b.seconds == null ? 'unknown' : minsTxt(b.seconds)}.`, 'A killer can loot pocket cash and deposits in transit. Cleared cash avoids that cut. All bank cash is lost on death.'];})())}\n      <div class=\"card\" style=\"display:flex;flex-wrap:wrap;gap:8px;align-items:center\">\n",
          "baseline": "    // jobs + the bank/map lead the screen; everything else is a labeled drawer that stays how you\n    // left it. One glance = act; the depth is a click away, not a scroll away.\n    t.innerHTML = `\n      <h2 style=\"margin-top:14px\">Crimes <span class=\"d\" style=\"color:var(--dim);font-size:12.5px\">— your best jobs at level ${lvl}</span></h2>\n      ${streetActionClock()}\n      <div class=\"grid\">${crimes || restCrimes && '<span class=\"d\" style=\"color:var(--dim)\">no jobs at your level yet — open the full book below</span>' || ''}</div>\n      ${rest.length ? sect('crimes-all', 'The Full Book', `every job in the city (${allCrimes.length})`, `<div class=\"grid\">${restCrimes}</div>`) : ''}\n\n${decisionCard('Cash exposure', (()=>{const b=PlayerExperience.bank(me);return [`Pocket: ${guideMoney(b.pocket)}. Bank total: ${guideMoney(b.total)}.`, `Cleared: ${guideMoney(b.cleared)}. In transit: ${guideMoney(b.transit)}. Clearing: ${b.seconds == null ? 'unknown' : minsTxt(b.seconds)}.`, 'A killer can loot pocket cash and deposits in transit. Cleared cash avoids that cut. All bank cash is lost on death.'];})())}\n      <div class=\"card\" style=\"display:flex;flex-wrap:wrap;gap:8px;align-items:center\">\n"
        },
        {
          "at": 1389861,
          "current": "  if (workspaceUX) uxModules.push(workspaceUX);\n  for (const factory of [window.createOmertaFeedback, window.createOmertaProgression, window.createOmertaSocial, window.createOmertaNavigation,\n    window.createOmertaTactics, window.createOmertaInvestigation, window.createOmertaCoordination,\n    window.createOmertaFeel, window.createOmertaTools, window.createOmertaIdentity, window.createOmertaStory, window.createOmertaQuests, window.createOmertaCommunity, window.createOmertaWorld, window.createOmertaNoirShell, window.createOmertaStrategyCommand]) {\n    if (!factory) continue;\n    try { const module = factory(uxContext); uxModules.push(module); if (factory === window.createOmertaFeedback) feedbackUX = module; }\n    catch (error) { console.warn('UI enhancement unavailable', error); }\n",
          "baseline": "  if (workspaceUX) uxModules.push(workspaceUX);\n  for (const factory of [window.createOmertaFeedback, window.createOmertaProgression, window.createOmertaSocial, window.createOmertaNavigation,\n    window.createOmertaTactics, window.createOmertaInvestigation, window.createOmertaCoordination,\n    window.createOmertaFeel, window.createOmertaTools, window.createOmertaIdentity, window.createOmertaStory, window.createOmertaQuests, window.createOmertaCommunity, window.createOmertaWorld]) {\n    if (!factory) continue;\n    try { const module = factory(uxContext); uxModules.push(module); if (factory === window.createOmertaFeedback) feedbackUX = module; }\n    catch (error) { console.warn('UI enhancement unavailable', error); }\n"
        },
        {
          "at": 1390656,
          "current": "  // The shell reveals optional controls without replacing their original action handlers.\n  const gameMenu = $('#game-menu'), cityDirectory = $('#city-directory');\n  const wideNavigation = matchMedia('(min-width: 1001px)');\n  const syncDirectory = () => { cityDirectory.open = false; };\n  syncDirectory(); wideNavigation.addEventListener('change', syncDirectory);\n  function closeGameMenu(focus = false) {\n    if (!gameMenu.open) return;\n",
          "baseline": "  // The shell reveals optional controls without replacing their original action handlers.\n  const gameMenu = $('#game-menu'), cityDirectory = $('#city-directory');\n  const wideNavigation = matchMedia('(min-width: 1001px)');\n  const syncDirectory = () => { cityDirectory.open = wideNavigation.matches; };\n  syncDirectory(); wideNavigation.addEventListener('change', syncDirectory);\n  function closeGameMenu(focus = false) {\n    if (!gameMenu.open) return;\n"
        }
      ]
    },
    "public/invite.html": {
      "current": {
        "mode": "100644",
        "blob": "36b973e8b60de71a4512b3bfc32a9f29ca0eba22",
        "sha256": "51cb6c5c8bfcb89e3aada4ab88c4b4af43f0f9734da3551901265916de3ef70d",
        "bytes": 10523
      },
      "baseline": {
        "mode": "100644",
        "blob": "605d62403e3bab4eb94b53bb9b614d61cdbe896f",
        "sha256": "8fc7fc6de1afa7406199f65bac414516ea9f9ef8b41a3e8810466a1ec1faf6d8",
        "bytes": 12591
      },
      "inverses": [
        {
          "at": 5526,
          "current": "  </main>\n  <footer><span>LOYALTY IS EARNED. ENTRY IS INVITED.</span><span>OMERTÀ · LAUNCH ACCESS</span></footer>\n  <noscript><p style=\"padding:24px\">Enable JavaScript to redeem your invitation or sign in.</p></noscript>\n  <script>\n    const status = document.querySelector('#gate-status');\n    const codeInput = document.querySelector('#invite-code');\n    const pendingKey = 'omerta_launch_pending';\n",
          "baseline": "  </main>\n  <footer><span>LOYALTY IS EARNED. ENTRY IS INVITED.</span><span>OMERTÀ · LAUNCH ACCESS</span></footer>\n  <noscript><p style=\"padding:24px\">Enable JavaScript to redeem your invitation or sign in.</p></noscript>\n  <dialog id=\"age-dialog\" aria-labelledby=\"age-title\"><h2 id=\"age-title\">Your birth date</h2><p>Enter your complete birth date to continue. We check it without saving it.</p><form id=\"age-form\"><label for=\"age-date\">Birth date</label><input id=\"age-date\" type=\"date\" required><button type=\"submit\">Continue</button><button type=\"button\" id=\"age-cancel\">Cancel</button></form><p id=\"age-status\" role=\"alert\"></p><p><a href=\"/privacy\">Privacy policy and help</a></p></dialog>\n  <script>\n    let ageChecked = 0;\n    async function verifyAge() {\n      if (ageChecked > Date.now()) return;\n      if (sessionStorage.getItem('omerta_age_blocked')) throw new Error('Account creation is unavailable. See /privacy for help.');\n      await new Promise((resolve, reject) => {\n        const dialog = document.querySelector('#age-dialog');\n        const finish = (error) => { dialog.close(); error ? reject(error) : resolve(); };\n        document.querySelector('#age-cancel').onclick = () => finish(new Error('Birth date check cancelled.'));\n        dialog.oncancel = (event) => { event.preventDefault(); finish(new Error('Birth date check cancelled.')); };\n        document.querySelector('#age-form').onsubmit = async (event) => {\n          event.preventDefault();\n          const input = document.querySelector('#age-date');\n          const birthDate = input.value; input.value = '';\n          const response = await fetch('/v1/age-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ birthDate }) });\n          const result = await response.json();\n          if (response.ok) { ageChecked = Date.now() + 14 * 60 * 1000; finish(); }\n          else {\n            document.querySelector('#age-status').textContent = result.message || 'Please try again.';\n            if (result.error === 'age_ineligible') { sessionStorage.setItem('omerta_age_blocked', '1'); document.querySelector('#age-form').hidden = true; }\n          }\n        };\n        dialog.showModal();\n      });\n    }\n    const status = document.querySelector('#gate-status');\n    const codeInput = document.querySelector('#invite-code');\n    const pendingKey = 'omerta_launch_pending';\n"
        },
        {
          "at": 8408,
          "current": "      message('Checking your invitation…');\n      try {\n        const inviteCode = codeInput.value.trim();\n        let operation = pending();\n        if (!operation || operation.inviteCode !== inviteCode) {\n          operation = { inviteCode, bootstrapSecret: secret() };\n",
          "baseline": "      message('Checking your invitation…');\n      try {\n        const inviteCode = codeInput.value.trim();\n        await verifyAge();\n        let operation = pending();\n        if (!operation || operation.inviteCode !== inviteCode) {\n          operation = { inviteCode, bootstrapSecret: secret() };\n"
        },
        {
          "at": 9022,
          "current": "    };\n    document.querySelector('#return-x').onclick = async () => {\n      const button = document.querySelector('#return-x'); button.disabled = true; message('Connecting to X…');\n      try { location.assign((await request('/v1/auth/x/start', {})).url); }\n      catch (error) { message(error.message, true); button.disabled = false; }\n    };\n    document.querySelector('#token-form').onsubmit = async (event) => {\n",
          "baseline": "    };\n    document.querySelector('#return-x').onclick = async () => {\n      const button = document.querySelector('#return-x'); button.disabled = true; message('Connecting to X…');\n      try { await verifyAge(); location.assign((await request('/v1/auth/x/start', {})).url); }\n      catch (error) { message(error.message, true); button.disabled = false; }\n    };\n    document.querySelector('#token-form').onsubmit = async (event) => {\n"
        },
        {
          "at": 9503,
          "current": "      try {\n        let token = document.querySelector('#account-token').value.trim();\n        const provider = document.querySelector('#token-kind').value;\n        if (provider !== 'omerta') token = (await request('/v1/auth/' + provider, { token })).token;\n        await request('/v1/access/session', {}, token); await enter(token);\n      }\n      catch (error) { message(error.message, true); }\n",
          "baseline": "      try {\n        let token = document.querySelector('#account-token').value.trim();\n        const provider = document.querySelector('#token-kind').value;\n        if (provider !== 'omerta') { await verifyAge(); token = (await request('/v1/auth/' + provider, { token })).token; }\n        await request('/v1/access/session', {}, token); await enter(token);\n      }\n      catch (error) { message(error.message, true); }\n"
        }
      ]
    },
    "public/sw.js": {
      "current": {
        "mode": "100644",
        "blob": "ce01893c73ab21a7f2186e0325246aa99993d916",
        "sha256": "d1cf7d3bc7ed9433aaa27652d9a29327e6d26ce4aa646ebffe989150def25427",
        "bytes": 4886
      },
      "baseline": {
        "mode": "100644",
        "blob": "ebbe1d4dd9559ec29cce926863395d4901d146f5",
        "sha256": "eb6cacd1a4de75600ee019a8c5f7ed7f7ae42a4d8abddae604104cbd611b504b",
        "bytes": 4595
      },
      "inverses": [
        {
          "at": 365,
          "current": "   (you always get the latest client online; cached pages are only offline fallbacks). The shared stylesheet\n   also follows the network so installed players receive visual fixes. Icons and art are cache-first.\n   The API (/v1/*, the websocket) is NEVER cached. */\nconst CACHE = 'omerta-shell-v8';\n// Never precache the private console: cache.addAll ignores its no-store response header.\nconst SHELL = ['/omerta-ui.css', '/noir-ui.css', '/noir-landing.css', '/noir-shell.js', '/strategy-command.css', '/strategy-command.js', '/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];\nconst cacheable = (res) => res && res.status === 200 && !res.redirected\n  && (res.type === 'basic' || res.type === 'default')\n  && !/(?:^|,)\\s*(?:no-store|private)(?:\\s|,|=|$)/i.test(res.headers.get('cache-control') || '');\n",
          "baseline": "   (you always get the latest client online; cached pages are only offline fallbacks). The shared stylesheet\n   also follows the network so installed players receive visual fixes. Icons and art are cache-first.\n   The API (/v1/*, the websocket) is NEVER cached. */\nconst CACHE = 'omerta-shell-v7';\n// Never precache the private console: cache.addAll ignores its no-store response header.\nconst SHELL = ['/omerta-ui.css', '/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];\nconst cacheable = (res) => res && res.status === 200 && !res.redirected\n  && (res.type === 'basic' || res.type === 'default')\n  && !/(?:^|,)\\s*(?:no-store|private)(?:\\s|,|=|$)/i.test(res.headers.get('cache-control') || '');\n"
        },
        {
          "at": 2150,
          "current": "\n  const isNav = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');\n  if (isNav || url.pathname === '/omerta-ui.css'\n    || /^\\/noir-(?:ui|landing|shell)\\.(?:js|css)$/.test(url.pathname)\n    || /^\\/strategy-command\\.(?:js|css)$/.test(url.pathname) || url.pathname === '/vendor/strategy-city-renderer.js'\n    || /^\\/ux-(?:feedback|progression|social|navigation|workspace|world|tactics|investigation|coordination|feel|tools|identity|story|community)\\.(?:js|css)$/.test(url.pathname)\n    || ['/player-experience.js', '/city-scene.js', '/city-scene.css', '/world-fieldwork.js', '/world-fieldwork.css', '/vendor/phaser.js'].includes(url.pathname)) {\n    // NETWORK-FIRST: a Codex visit belongs to its own URL, never the root game's offline slot.\n",
          "baseline": "\n  const isNav = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');\n  if (isNav || url.pathname === '/omerta-ui.css'\n    || /^\\/ux-(?:feedback|progression|social|navigation|workspace|world|tactics|investigation|coordination|feel|tools|identity|story|community)\\.(?:js|css)$/.test(url.pathname)\n    || ['/player-experience.js', '/city-scene.js', '/city-scene.css', '/world-fieldwork.js', '/world-fieldwork.css', '/vendor/phaser.js'].includes(url.pathname)) {\n    // NETWORK-FIRST: a Codex visit belongs to its own URL, never the root game's offline slot.\n"
        }
      ]
    },
    "public/ux-quests.js": {
      "current": {
        "mode": "100644",
        "blob": "bb47e0b2aeda913a607a6b9a9981168b964ce902",
        "sha256": "8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205",
        "bytes": 48930
      },
      "baseline": {
        "mode": "100644",
        "blob": "61b4ec05c45408e3d992434b42d119652dcf702d",
        "sha256": "8b8aeb833b7704f9051099f421551b91dcd1c1670076dc825ac6f78699f5beeb",
        "bytes": 48243
      },
      "inverses": [
        {
          "at": 1729,
          "current": "    const districtTabs = new Set(['streets', 'city', 'map', 'fieldwork']);\n    const pending = new Map(), local = new Map(), openSections = new Set(), interactionDrafts = new Map();\n    const qualityButtonDisabled = new WeakMap();\n    const sectionStates = new WeakMap();\n    const state = () => getState() || {};\n    const qualityUX = window.createOmertaQuestQuality?.({ getState,\n      onOperation: (instance, payload, label) => mutate('/v1/content/instances/' + encode(instance.id) + '/quality', {\n",
          "baseline": "    const districtTabs = new Set(['streets', 'city', 'map', 'fieldwork']);\n    const pending = new Map(), local = new Map(), openSections = new Set(), interactionDrafts = new Map();\n    const qualityButtonDisabled = new WeakMap();\n    const state = () => getState() || {};\n    const qualityUX = window.createOmertaQuestQuality?.({ getState,\n      onOperation: (instance, payload, label) => mutate('/v1/content/instances/' + encode(instance.id) + '/quality', {\n"
        },
        {
          "at": 7011,
          "current": "    }\n    function section(id, title, content) {\n      const panel = disclosure(title); panel.dataset.questSection = id; panel.open = openSections.has(id);\n      sectionStates.set(panel, panel.open);\n      panel.addEventListener('toggle', () => {\n        if (!panel.isConnected) return;\n        sectionStates.set(panel, panel.open);\n        panel.open ? openSections.add(id) : openSections.delete(id);\n      });\n      panel.append(content); return panel;\n    }\n    function blockers(entries) {\n",
          "baseline": "    }\n    function section(id, title, content) {\n      const panel = disclosure(title); panel.dataset.questSection = id; panel.open = openSections.has(id);\n      panel.addEventListener('toggle', () => panel.open ? openSections.add(id) : openSections.delete(id));\n      panel.append(content); return panel;\n    }\n    function blockers(entries) {\n"
        },
        {
          "at": 43917,
          "current": "      updateQualityButtons();\n      if (active && !busy && (!force || !active.closest('.quest-quality,.quest-quality-proof'))) return;\n      const focused = force && active ? { label: active.getAttribute('aria-label'), start: active.selectionStart, end: active.selectionEnd } : force ? focusedEditor : null;\n      // Native toggle events are deferred. Preserve a user's latest disclosure choice before\n      // a refetch replaces the panel, without undoing an intentional programmatic opening.\n      root.querySelectorAll('details[data-quest-section]').forEach(panel => {\n        if (sectionStates.get(panel) === panel.open) return;\n        const id = panel.dataset.questSection;\n        panel.open ? openSections.add(id) : openSections.delete(id);\n        sectionStates.set(panel, panel.open);\n      });\n      const header = el('header', 'quest-heading'); header.append(el('span', 'quest-kicker', 'Bureau of unfinished business'), el('h2', '', 'Your case files'));\n      const controls = el('nav', 'quest-tabs'); controls.setAttribute('aria-label', 'Quest tools');\n      for (const [id, title] of [['cases', 'Case files'], ['community', 'Community mysteries'], ['legacy', 'Your history']]) { const tab = button(title, () => { view = id; error = ''; load(); }); tab.setAttribute('aria-pressed', String(view === id)); tab.disabled = busy || loading; controls.append(tab); }\n",
          "baseline": "      updateQualityButtons();\n      if (active && !busy && (!force || !active.closest('.quest-quality,.quest-quality-proof'))) return;\n      const focused = force && active ? { label: active.getAttribute('aria-label'), start: active.selectionStart, end: active.selectionEnd } : force ? focusedEditor : null;\n      const header = el('header', 'quest-heading'); header.append(el('span', 'quest-kicker', 'Bureau of unfinished business'), el('h2', '', 'Your case files'));\n      const controls = el('nav', 'quest-tabs'); controls.setAttribute('aria-label', 'Quest tools');\n      for (const [id, title] of [['cases', 'Case files'], ['community', 'Community mysteries'], ['legacy', 'Your history']]) { const tab = button(title, () => { view = id; error = ''; load(); }); tab.setAttribute('aria-pressed', String(view === id)); tab.disabled = busy || loading; controls.append(tab); }\n"
        }
      ]
    },
    "src/agentgateway.js": {
      "current": {
        "mode": "100644",
        "blob": "b453f64df26b4a4a42adaf8352e4a1e2a00556b3",
        "sha256": "1f17ee1bb1550ec60a0d862df77b029c5966d3a4447638dfe89a7e83bf461d50",
        "bytes": 160952
      },
      "baseline": {
        "mode": "100644",
        "blob": "caca6ad7f577bc3c6f426260f7a1649542446db9",
        "sha256": "a04f73bdc3d87962361c6626604edb5a1f607c67db38353a73331f349b4b6ae5",
        "bytes": 161702
      },
      "inverses": [
        {
          "at": 4418,
          "current": "  '/v1/rules', '/v1/catalog', '/v1/arena', '/v1/depots',\n  '/v1/resources/catalog', '/v1/resources/services', '/v1/resources/auctions', '/v1/resources/payments/webhook',\n  '/v1/auth/guest', '/v1/auth/agent', '/v1/auth/x', '/v1/auth/privy',\n  '/v1/access/redeem', '/v1/access/logout', '/privacy', '/terms', '/dmca', '/resources', '/vendor/walletconnect.js',\n]);\n\n// Human/asset routes we don't advertise in the machine API contract (they serve HTML/markdown).\n",
          "baseline": "  '/v1/rules', '/v1/catalog', '/v1/arena', '/v1/depots',\n  '/v1/resources/catalog', '/v1/resources/services', '/v1/resources/auctions', '/v1/resources/payments/webhook',\n  '/v1/auth/guest', '/v1/auth/agent', '/v1/auth/x', '/v1/auth/privy',\n  '/v1/access/redeem', '/v1/access/logout', '/v1/age-check', '/privacy', '/terms', '/dmca', '/resources', '/vendor/walletconnect.js',\n]);\n\n// Human/asset routes we don't advertise in the machine API contract (they serve HTML/markdown).\n"
        },
        {
          "at": 30621,
          "current": "    } },\n    responseSchema: { type: 'object', required: ['token', 'agent'], properties: {\n      token: { type: 'string', description: '90-day agent bearer.' },\n      agent: { const: true, description: 'Permanently classified at creation; excluded from human-only rewards.' },\n    } },\n  },\n  'POST /v1/access/redeem': {\n",
          "baseline": "    } },\n    responseSchema: { type: 'object', required: ['token', 'agent'], properties: {\n      token: { type: 'string', description: '90-day agent bearer.' },\n      agent: { const: true, description: 'Permanently classified at creation; excluded from human-only rewards. No birth date is needed.' },\n    } },\n  },\n  'POST /v1/access/redeem': {\n"
        },
        {
          "at": 30981,
          "current": "    requestSchema: { type: 'object', required: ['bootstrapSecret'], properties: {\n      inviteCode: { type: 'string', maxLength: 128, description: 'Unused launch invitation. Reuse the same bootstrapSecret after an ambiguous response.' },\n      bootstrapSecret: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$', description: 'Persist 32 cryptographically random bytes encoded as unpadded base64url before submitting.' },\n    } },\n  },\n  'POST /v1/access/session': { operationId: 'restoreBrowserAccess', requestSchema: { type: 'object' } },\n  'POST /v1/access/logout': { operationId: 'clearBrowserAccess', requestSchema: { type: 'object' } },\n  'GET /v1/invites': { operationId: 'getLaunchInvites' },\n",
          "baseline": "    requestSchema: { type: 'object', required: ['bootstrapSecret'], properties: {\n      inviteCode: { type: 'string', maxLength: 128, description: 'Unused launch invitation. Reuse the same bootstrapSecret after an ambiguous response.' },\n      bootstrapSecret: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$', description: 'Persist 32 cryptographically random bytes encoded as unpadded base64url before submitting.' },\n      birthDate: { type: 'string', format: 'date', description: 'Human/operator-supplied date for first account creation; omitted with a valid age-check cookie or existing bootstrap recovery. Never infer a date.' },\n    } },\n  },\n  'POST /v1/age-check': {\n    operationId: 'checkAgeEligibility',\n    requestSchema: { type: 'object', required: ['birthDate'], properties: {\n      birthDate: { type: 'string', format: 'date', description: 'Complete birth date, processed transiently and never saved in account records.' },\n    } },\n    extraResponses: { 403: { description: 'Account creation is unavailable; use the privacy contact for help.' } },\n  },\n  'POST /v1/access/session': { operationId: 'restoreBrowserAccess', requestSchema: { type: 'object' } },\n  'POST /v1/access/logout': { operationId: 'clearBrowserAccess', requestSchema: { type: 'object' } },\n  'GET /v1/invites': { operationId: 'getLaunchInvites' },\n"
        },
        {
          "at": 152578,
          "current": "      description: 'Autonomous agents are first-class players. New accounts need no invitation. '\n        + 'See /agents for the quickstart, '\n        + '/v1/rules for the machine rulebook, and /llms.txt for the discovery index. New agents use '\n        + 'POST /v1/auth/agent; existing accounts use POST /v1/auth/agent-key. Agents need a linked EVM wallet and a minted character '\n        + 'before on-chain extraction can open for them. Errors are stable string codes: { error, message }.',\n      contact: { url: baseUrl },\n    },\n",
          "baseline": "      description: 'Autonomous agents are first-class players. New accounts need no invitation. '\n        + 'See /agents for the quickstart, '\n        + '/v1/rules for the machine rulebook, and /llms.txt for the discovery index. New agents use '\n        + 'POST /v1/auth/agent without a birth date; existing accounts use POST /v1/auth/agent-key. Agents need a linked EVM wallet and a minted character '\n        + 'before on-chain extraction can open for them. Errors are stable string codes: { error, message }.',\n      contact: { url: baseUrl },\n    },\n"
        },
        {
          "at": 155512,
          "current": "- Execute a turn: POST ${baseUrl}/v1/agent/act with the latest \\`{turnId, actionId}\\`; success returns the post-action turn, while \\`409 stale_turn\\` returns a replacement snapshot without executing.\n- Agent Alpha is the owner-operated bounded runner in \\`tools/agent-alpha.js\\`: one durable identity, default one action, finite 1–50 attempts, at least 3100 ms between mutations, no reset, and no fleet, PvP, borrowing, human-faucet, wallet, mint, withdrawal, or replacement automation.\n- [OpenAPI 3.1 spec](${baseUrl}/openapi.json): every route, for your tool framework.\n- New agents: POST ${baseUrl}/v1/auth/agent with a durably saved random 32-byte base64url bootstrapSecret (permanent 🤖 flag, 90-day token). Save the bearer before acknowledging bootstrap; retry the same secret after an ambiguous response. Existing accounts use POST ${baseUrl}/v1/auth/agent-key.\n- Before extraction: link a wallet through POST ${baseUrl}/v1/wallet/challenge and POST ${baseUrl}/v1/wallet/verify, then mint the character through POST ${baseUrl}/v1/character/mint. Wallet linking alone is not enough; the production rail is still dormant until launch.\n\n## Machine rulebook\n",
          "baseline": "- Execute a turn: POST ${baseUrl}/v1/agent/act with the latest \\`{turnId, actionId}\\`; success returns the post-action turn, while \\`409 stale_turn\\` returns a replacement snapshot without executing.\n- Agent Alpha is the owner-operated bounded runner in \\`tools/agent-alpha.js\\`: one durable identity, default one action, finite 1–50 attempts, at least 3100 ms between mutations, no reset, and no fleet, PvP, borrowing, human-faucet, wallet, mint, withdrawal, or replacement automation.\n- [OpenAPI 3.1 spec](${baseUrl}/openapi.json): every route, for your tool framework.\n- New agents: POST ${baseUrl}/v1/auth/agent with a durably saved random 32-byte base64url bootstrapSecret (permanent 🤖 flag, no birth date, 90-day token). Save the bearer before acknowledging bootstrap; retry the same secret after an ambiguous response. Human signup requires an age check. Existing accounts use POST ${baseUrl}/v1/auth/agent-key.\n- Before extraction: link a wallet through POST ${baseUrl}/v1/wallet/challenge and POST ${baseUrl}/v1/wallet/verify, then mint the character through POST ${baseUrl}/v1/character/mint. Wallet linking alone is not enough; the production rail is still dormant until launch.\n\n## Machine rulebook\n"
        }
      ]
    },
    "src/auth.js": {
      "current": {
        "mode": "100644",
        "blob": "060f9e0f0d9c86498122343d9e997703be2752a5",
        "sha256": "7a7a89a68999220817766dff20d61aeb47e75bfdf8957a868bc8f5acf985800f",
        "bytes": 20803
      },
      "baseline": {
        "mode": "100644",
        "blob": "a147dd0eb8b48b2e3aded148d67fc8f84d546f78",
        "sha256": "e9aa8c63cf522b2287fdf4d0584e8d054312d225e95b88962e4a7e18d4acc17b",
        "bytes": 20893
      },
      "inverses": [
        {
          "at": 11822,
          "current": "}\n\nexport async function accountForGuestBootstrap(\n  pool, recoverySecret, ip, invite, createdIpAuthority = null,\n) {\n  return accountForBootstrap(pool, recoverySecret, ip, invite, false, createdIpAuthority);\n}\n\nexport async function accountForAgentBootstrap(pool, recoverySecret, ip, invite, createdIpAuthority = null) {\n  return accountForBootstrap(pool, recoverySecret, ip, invite, true, createdIpAuthority);\n}\n\nasync function accountForBootstrap(pool, recoverySecret, ip, invite, agent, createdIpAuthority) {\n  if (typeof recoverySecret !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(recoverySecret)) {\n    throw new GameError('bootstrap_credential', 'Invalid guest bootstrap credential.');\n  }\n",
          "baseline": "}\n\nexport async function accountForGuestBootstrap(\n  pool, recoverySecret, ip, invite, beforeCreate = () => {}, createdIpAuthority = null,\n) {\n  return accountForBootstrap(pool, recoverySecret, ip, invite, beforeCreate, false, createdIpAuthority);\n}\n\nexport async function accountForAgentBootstrap(pool, recoverySecret, ip, invite, createdIpAuthority = null) {\n  return accountForBootstrap(pool, recoverySecret, ip, invite, () => {}, true, createdIpAuthority);\n}\n\nasync function accountForBootstrap(pool, recoverySecret, ip, invite, beforeCreate, agent, createdIpAuthority) {\n  if (typeof recoverySecret !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(recoverySecret)) {\n    throw new GameError('bootstrap_credential', 'Invalid guest bootstrap credential.');\n  }\n"
        },
        {
          "at": 13016,
          "current": "    const existing = await recoverCommittedGuestBootstrap(pool, recoveryHash, ip, agent);\n    if (existing) return existing;\n\n    const id = crypto.randomUUID();\n    const tokenVersion = 0;\n    const client = await pool.connect();\n",
          "baseline": "    const existing = await recoverCommittedGuestBootstrap(pool, recoveryHash, ip, agent);\n    if (existing) return existing;\n\n    await beforeCreate();\n\n    const id = crypto.randomUUID();\n    const tokenVersion = 0;\n    const client = await pool.connect();\n"
        }
      ]
    },
    "src/client-shell.js": {
      "current": {
        "mode": "100644",
        "blob": "5f093004fa2a0431bb019f593abbcbf10944aa42",
        "sha256": "561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4",
        "bytes": 4509
      },
      "baseline": {
        "mode": "100644",
        "blob": "0248b3685944b46a23cdefedf39321acc7b0b47e",
        "sha256": "48e9ffc844ae08867e0923743dd94d3fcb859d00cdacdf433f82a7323184817c",
        "bytes": 4458
      },
      "inverses": [
        {
          "at": 756,
          "current": "  const revision = version(html);\n  const scripts = [...html.matchAll(/<script src=\"([^\"]+)\"[^>]*><\\/script>/g)].map(match => match[1]);\n  const styles = [...html.matchAll(/<link rel=\"stylesheet\" href=\"([^\"]+)\"[^>]*>/g)]\n    .map(match => match[1]).filter(url => !['/omerta-ui.css', '/noir-ui.css', '/noir-landing.css'].includes(url.split('?')[0]));\n  if (!scripts.length || [...scripts, ...styles].some(url => !/^\\/[a-z0-9][a-z0-9_./?=&-]*$/i.test(url) || url.split(/[/?]/).includes('..')))\n    throw new Error('Game dependencies must remain explicit local assets.');\n  const languageStart = runtime.indexOf('  const I18N = {');\n",
          "baseline": "  const revision = version(html);\n  const scripts = [...html.matchAll(/<script src=\"([^\"]+)\"[^>]*><\\/script>/g)].map(match => match[1]);\n  const styles = [...html.matchAll(/<link rel=\"stylesheet\" href=\"([^\"]+)\"[^>]*>/g)]\n    .map(match => match[1]).filter(url => !url.startsWith('/omerta-ui.css'));\n  if (!scripts.length || [...scripts, ...styles].some(url => !/^\\/[a-z0-9][a-z0-9_./?=&-]*$/i.test(url) || url.split(/[/?]/).includes('..')))\n    throw new Error('Game dependencies must remain explicit local assets.');\n  const languageStart = runtime.indexOf('  const I18N = {');\n"
        }
      ]
    },
    "src/legal.js": {
      "current": {
        "mode": "100644",
        "blob": "1c8fb3a1e47b976072c68347c3736ef6e09b23ca",
        "sha256": "eb30dddfa11e33846eb6bef1ca4cfc04c3766264c21d51380a492505dc015c0f",
        "bytes": 14783
      },
      "baseline": {
        "mode": "100644",
        "blob": "840534a3e339053d29518bba12b92766f87c1d8e",
        "sha256": "32cbb32c868d3c50b2e1ee529676ac87609f12b78377eb5208c264ebf73e28cf",
        "bytes": 14912
      },
      "inverses": [
        {
          "at": 1524,
          "current": "  const title = { privacy: 'Privacy policy', terms: 'Payment terms', dmca: 'Copyright notices', resources: 'Scripts, fonts and service providers' }[kind];\n  if (!title) throw new Error('Unknown legal page');\n  const bodies = {\n    privacy: `<p><strong>Last updated: November 9, 2026.</strong> This policy explains what information OMERTÀ collects, how we use it, and the choices available to you when you use the game, website, API or connected-agent features.</p>\n${c.name ? `<p>Operator: ${esc(c.name)}.${c.address ? ` Postal address: ${esc(c.address)}.` : ''}</p>` : ''}\n<h2>Information we collect</h2><ul>\n<li><strong>Account and access information.</strong> Guest account identifiers, authentication-provider identifiers, sign-in records and IP addresses associated with account access. You can start as a guest without providing an email address.</li>\n",
          "baseline": "  const title = { privacy: 'Privacy policy', terms: 'Payment terms', dmca: 'Copyright notices', resources: 'Scripts, fonts and service providers' }[kind];\n  if (!title) throw new Error('Unknown legal page');\n  const bodies = {\n    privacy: `<p><strong>Last updated: November 7, 2026.</strong> This policy explains what information OMERTÀ collects, how we use it, and the choices available to you when you use the game, website, API or connected-agent features.</p>\n${c.name ? `<p>Operator: ${esc(c.name)}.${c.address ? ` Postal address: ${esc(c.address)}.` : ''}</p>` : ''}\n<h2>Information we collect</h2><ul>\n<li><strong>Account and access information.</strong> Guest account identifiers, authentication-provider identifiers, sign-in records and IP addresses associated with account access. You can start as a guest without providing an email address.</li>\n"
        },
        {
          "at": 6005,
          "current": "<h2>When information is shared</h2><p>Hosting and database providers process data needed to run the service. X or Privy handles sign-in when selected. Resend, or the configured email provider, delivers requested emails; your browser's push provider delivers notifications you enable. WalletConnect and blockchain RPC providers support wallet features. See the <a href=\"/resources\">scripts, fonts and service-provider inventory</a>.</p><p>Public game content is shared with its intended audience. Information sent to a third-party AI, identity, wallet or notification provider is also subject to that provider's privacy practices. Providers may process information in a country different from yours. We may disclose information to comply with legal obligations or protect players, investigate misuse and secure the service.</p>\n<h2>How long we keep information</h2><p>We keep information for as long as needed to provide the features you use, maintain game and transaction records, resolve disputes, prevent misuse and meet applicable legal obligations. Retention depends on the type of information and why it is needed. Messages and routine operational records are subject to periodic cleanup; some account, accounting and service-integrity records are retained longer. Provider logs and backups may follow separate retention periods, and backups may retain deleted information until they expire. Public blockchain records remain available independently of OMERTÀ.</p>\n<h2>Your choices and requests</h2><p>You can unsubscribe from a digest using the link in the email or turn it off in Profile. Transaction confirmations are separate from marketing preferences and are emailed where a verified address is available. Disable push notifications in the app or browser and revoke connected-agent access in Consigliere.</p><p>Depending on where you live, you may have rights to request access, correction or deletion of personal information, or to object to certain processing. We may need to verify that a request relates to your account. Some accounting, security or legally required records may need to be retained; deleting an account cannot erase blockchain history.</p>\n<h2>Age eligibility and children</h2><p>OMERTÀ is intended only for users aged 21 and older. We do not accept users under 21, including children. If you believe someone under 21 has provided personal information, report it through the privacy contact below when available so the operator can investigate, restrict access and handle deletion as appropriate.</p>\n<h2>Privacy contact</h2>${contact ? `<p>For privacy questions, account-data requests or reports involving users under 21, email ${contact}. Do not send account credentials or wallet private keys.</p>` : '<p>A dedicated privacy contact has not yet been published. Operator contact details will appear here when available. Do not post account credentials or sensitive personal information in public chat.</p>'}\n<h2>Changes to this policy</h2><p>We will update this page and its date when our practices change, and provide additional notice or request consent when required.</p>`,\n    terms: `<p>Operator: ${esc(c.name)} · ${esc(c.address)} · ${contact}.</p><section id=\"payments\"><h2>Passes, watches and confirmation</h2><p>Made Man gives you 30 days of access for the displayed $OMR price. Street Wire gives you the displayed tier and duration. Both are prepaid game passes. Buying again extends access, and neither renews automatically. Benefits end when the pass expires unless you buy again.</p><p>Standing Watches automatically spend the displayed $OMR tap price each cycle while the watch is enrolled and eligible. The Wire screen shows the price and interval before enrollment. Select “drop the watch” online to stop future renewals; the tap you already paid for lasts until expiry. You can cancel each watch in the app or with DELETE /v1/wire/watch/:targetId.</p><p>The app confirms purchases immediately. If you have a verified email address, we also queue a transaction confirmation email regardless of your marketing preferences. Keep the confirmation and check your ledger. Wallet transactions and on-chain purchases may have network fees and their own published price. Review each transaction before signing.</p><h2>Refunds and cancellation</h2><p>${esc(c.refunds)}</p><p>Contact ${contact} with the transaction identifier for payment questions or a refund request. These terms do not limit rights provided by applicable law. Cancelling a watch stops future renewals; it does not reverse a cycle you already paid for.</p></section>`,\n",
          "baseline": "<h2>When information is shared</h2><p>Hosting and database providers process data needed to run the service. X or Privy handles sign-in when selected. Resend, or the configured email provider, delivers requested emails; your browser's push provider delivers notifications you enable. WalletConnect and blockchain RPC providers support wallet features. See the <a href=\"/resources\">scripts, fonts and service-provider inventory</a>.</p><p>Public game content is shared with its intended audience. Information sent to a third-party AI, identity, wallet or notification provider is also subject to that provider's privacy practices. Providers may process information in a country different from yours. We may disclose information to comply with legal obligations or protect players, investigate misuse and secure the service.</p>\n<h2>How long we keep information</h2><p>We keep information for as long as needed to provide the features you use, maintain game and transaction records, resolve disputes, prevent misuse and meet applicable legal obligations. Retention depends on the type of information and why it is needed. Messages and routine operational records are subject to periodic cleanup; some account, accounting and service-integrity records are retained longer. Provider logs and backups may follow separate retention periods, and backups may retain deleted information until they expire. Public blockchain records remain available independently of OMERTÀ.</p>\n<h2>Your choices and requests</h2><p>You can unsubscribe from a digest using the link in the email or turn it off in Profile. Transaction confirmations are separate from marketing preferences and are emailed where a verified address is available. Disable push notifications in the app or browser and revoke connected-agent access in Consigliere.</p><p>Depending on where you live, you may have rights to request access, correction or deletion of personal information, or to object to certain processing. We may need to verify that a request relates to your account. Some accounting, security or legally required records may need to be retained; deleting an account cannot erase blockchain history.</p>\n<h2>Age eligibility and children</h2><p>OMERTÀ is intended only for users aged 21 and older. We do not accept users under 21, including children. If you provide a birth date for an eligibility check, we use it for that check without retaining the birth date in your account. If you believe someone under 21 has provided personal information, report it through the privacy contact below when available so the operator can investigate, restrict access and handle deletion as appropriate.</p>\n<h2>Privacy contact</h2>${contact ? `<p>For privacy questions, account-data requests or reports involving users under 21, email ${contact}. Do not send account credentials or wallet private keys.</p>` : '<p>A dedicated privacy contact has not yet been published. Operator contact details will appear here when available. Do not post account credentials or sensitive personal information in public chat.</p>'}\n<h2>Changes to this policy</h2><p>We will update this page and its date when our practices change, and provide additional notice or request consent when required.</p>`,\n    terms: `<p>Operator: ${esc(c.name)} · ${esc(c.address)} · ${contact}.</p><section id=\"payments\"><h2>Passes, watches and confirmation</h2><p>Made Man gives you 30 days of access for the displayed $OMR price. Street Wire gives you the displayed tier and duration. Both are prepaid game passes. Buying again extends access, and neither renews automatically. Benefits end when the pass expires unless you buy again.</p><p>Standing Watches automatically spend the displayed $OMR tap price each cycle while the watch is enrolled and eligible. The Wire screen shows the price and interval before enrollment. Select “drop the watch” online to stop future renewals; the tap you already paid for lasts until expiry. You can cancel each watch in the app or with DELETE /v1/wire/watch/:targetId.</p><p>The app confirms purchases immediately. If you have a verified email address, we also queue a transaction confirmation email regardless of your marketing preferences. Keep the confirmation and check your ledger. Wallet transactions and on-chain purchases may have network fees and their own published price. Review each transaction before signing.</p><h2>Refunds and cancellation</h2><p>${esc(c.refunds)}</p><p>Contact ${contact} with the transaction identifier for payment questions or a refund request. These terms do not limit rights provided by applicable law. Cancelling a watch stops future renewals; it does not reverse a cycle you already paid for.</p></section>`,\n"
        }
      ]
    },
    "src/server.js": {
      "current": {
        "mode": "100644",
        "blob": "61e0b3528c278dda73efb796ff754756ed5256d9",
        "sha256": "ed760c9f8ba6337491c9758745edf82db5b80a17a8a18d2a09e84c56197bacc6",
        "bytes": 311174
      },
      "baseline": {
        "mode": "100644",
        "blob": "233d3d43977b23e29dd86db63d9956ad5279d38d",
        "sha256": "5103563b4519ab7f3876e997ca4935458178af96c373d025ce73f3de0c60a3b9",
        "bytes": 311858
      },
      "inverses": [
        {
          "at": 917,
          "current": "import crypto from 'node:crypto';\nimport { rescueQuote } from './rescue-quote.js';\nimport { clientIpContextForRequest } from './client-ip.js';\nimport zlib from 'node:zlib';\nimport { makeDb } from './db.js';\nimport { createCityActivityRegistry, readCityActivityActor, cityOwnerActivityCategory } from './city-activity.js';\n",
          "baseline": "import crypto from 'node:crypto';\nimport { rescueQuote } from './rescue-quote.js';\nimport { clientIpContextForRequest } from './client-ip.js';\nimport { MINIMUM_AGE, eligibleBirthDate, ageCookie, ageStatus, requireAge } from './age.js';\nimport zlib from 'node:zlib';\nimport { makeDb } from './db.js';\nimport { createCityActivityRegistry, readCityActivityActor, cityOwnerActivityCategory } from './city-activity.js';\n"
        },
        {
          "at": 47917,
          "current": "    .header('cache-control', 'no-cache').send(uiCss));\n  // City scenes are optional local assets; gameplay remains authoritative through the API.\n  for (const [file, type] of [\n    ['noir-ui.css', 'text/css'], ['noir-landing.css', 'text/css'], ['noir-shell.js', 'application/javascript'],\n    ['strategy-command.css', 'text/css'], ['strategy-command.js', 'application/javascript'],\n    ['vendor/strategy-city-renderer.js', 'application/javascript'], ['vendor/strategy-city-renderer.js.LEGAL.txt', 'text/plain'],\n    ['vendor/strategy-city-renderer.LICENSE.txt', 'text/plain'],\n    ['site-analytics.js', 'application/javascript'],\n    ['city-scene.js', 'application/javascript'], ['city-scene.css', 'text/css'], ['city-world-layout.js', 'application/javascript'],\n    ['city-world-ui.js', 'application/javascript'], ['city-world-ui.css', 'text/css'],\n",
          "baseline": "    .header('cache-control', 'no-cache').send(uiCss));\n  // City scenes are optional local assets; gameplay remains authoritative through the API.\n  for (const [file, type] of [\n    ['site-analytics.js', 'application/javascript'],\n    ['city-scene.js', 'application/javascript'], ['city-scene.css', 'text/css'], ['city-world-layout.js', 'application/javascript'],\n    ['city-world-ui.js', 'application/javascript'], ['city-world-ui.css', 'text/css'],\n"
        },
        {
          "at": 112841,
          "current": "    return { ok: true };\n  });\n\n  const guestLogin = async (req) => {\n    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) &&\n        Object.prototype.hasOwnProperty.call(req.body, 'bootstrapSecret')) {\n      const { accountId, tokenVersion } = await A.accountForGuestBootstrap(\n        pool, req.body.bootstrapSecret, req.clientIp, req.body.inviteCode,\n        req.clientIpAuthority,\n      );\n      return { token: await signFor(accountId, {}, '30d', tokenVersion) };\n    }\n    const id = await A.createGuestAccount(pool, req.clientIp, req.body?.inviteCode, req.clientIpAuthority);\n    return { token: await signFor(id, {}, '30d', 0) };\n  };\n  app.post('/v1/auth/guest', guestLogin);\n  app.post('/v1/auth/agent', async (req) => {\n    const { accountId, tokenVersion } = await A.accountForAgentBootstrap(\n      pool, req.body?.bootstrapSecret, req.clientIp, req.body?.inviteCode, req.clientIpAuthority,\n    );\n",
          "baseline": "    return { ok: true };\n  });\n\n  app.post('/v1/age-check', async (req, reply) => {\n    reply.header('Cache-Control', 'no-store');\n    const eligible = ageStatus(app, req) === false ? false : eligibleBirthDate(req.body?.birthDate);\n    const cookie = app.jwt.sign({ purpose: 'age-check', minimumAge: MINIMUM_AGE, eligible }, { expiresIn: '15m' });\n    reply.header('Set-Cookie', ageCookie(cookie));\n    if (!eligible) return reply.code(403).send({ error: 'age_ineligible', message: 'Account creation is unavailable. See /privacy for help.' });\n    return { ok: true };\n  });\n  const guestLogin = async (req) => {\n    // Recovery authority does not override a known-ineligible browser or an\n    // explicitly supplied birth date. Existing eligible recovery needs no DOB.\n    if (ageStatus(app, req) === false || req.body?.birthDate !== undefined) requireAge(app, req);\n    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) &&\n        Object.prototype.hasOwnProperty.call(req.body, 'bootstrapSecret')) {\n      const { accountId, tokenVersion } = await A.accountForGuestBootstrap(\n        pool, req.body.bootstrapSecret, req.clientIp, req.body.inviteCode, () => requireAge(app, req),\n        req.clientIpAuthority,\n      );\n      return { token: await signFor(accountId, {}, '30d', tokenVersion) };\n    }\n    requireAge(app, req);\n    const id = await A.createGuestAccount(pool, req.clientIp, req.body?.inviteCode, req.clientIpAuthority);\n    return { token: await signFor(id, {}, '30d', 0) };\n  };\n  app.post('/v1/auth/guest', guestLogin);\n  app.post('/v1/auth/agent', async (req) => {\n    requireAge(app, req, { agent: true });\n    const { accountId, tokenVersion } = await A.accountForAgentBootstrap(\n      pool, req.body?.bootstrapSecret, req.clientIp, req.body?.inviteCode, req.clientIpAuthority,\n    );\n"
        },
        {
          "at": 115289,
          "current": "  app.post('/v1/auth/guest/bootstrap/ack', { preHandler: auth }, async (req) =>\n    A.acknowledgeGuestBootstrap(pool, req.user.sub));\n  const providerLogin = (verify) => async (req) => {\n    const identity = await verify(req.body?.token);\n    // (B2) the invite is consumed ATOMICALLY inside accountForIdentity's create txn — one invite per\n    // new account, gate held even under a concurrent same-identity race (no separate pre-consume).\n",
          "baseline": "  app.post('/v1/auth/guest/bootstrap/ack', { preHandler: auth }, async (req) =>\n    A.acknowledgeGuestBootstrap(pool, req.user.sub));\n  const providerLogin = (verify) => async (req) => {\n    requireAge(app, req);\n    const identity = await verify(req.body?.token);\n    // (B2) the invite is consumed ATOMICALLY inside accountForIdentity's create txn — one invite per\n    // new account, gate held even under a concurrent same-identity race (no separate pre-consume).\n"
        },
        {
          "at": 118508,
          "current": "      const revoked = req.user.tv !== undefined && Number(req.user.tv) !== Number(a?.token_version);\n      if (!a || a.status === 'banned' || revoked) accountId = null;\n    }\n    const { url, state } = await A.xOAuthStart(pool, { accountId, invite: req.body?.inviteCode });\n    // BROWSER-BIND the state (anti account-linking CSRF): the callback must present the same cookie,\n    // so an attacker who leaks their authorize URL can't have a victim's X identity bound to the\n",
          "baseline": "      const revoked = req.user.tv !== undefined && Number(req.user.tv) !== Number(a?.token_version);\n      if (!a || a.status === 'banned' || revoked) accountId = null;\n    }\n    if (!accountId) requireAge(app, req);\n    const { url, state } = await A.xOAuthStart(pool, { accountId, invite: req.body?.inviteCode });\n    // BROWSER-BIND the state (anti account-linking CSRF): the callback must present the same cookie,\n    // so an attacker who leaks their authorize URL can't have a victim's X identity bound to the\n"
        },
        {
          "at": 120117,
          "current": "        return reply.redirect('/#claimed=x');\n      }\n      // (B2) invite consumed atomically inside accountForIdentity's create txn — gate held under races\n      const { accountId } = await A.accountForIdentity(\n        pool, r.identity, req.clientIp, r.invite, req.clientIpAuthority,\n      );\n",
          "baseline": "        return reply.redirect('/#claimed=x');\n      }\n      // (B2) invite consumed atomically inside accountForIdentity's create txn — gate held under races\n      requireAge(app, req);\n      const { accountId } = await A.accountForIdentity(\n        pool, r.identity, req.clientIp, r.invite, req.clientIpAuthority,\n      );\n"
        }
      ]
    },
    "test/age.js": {
      "current": {
        "mode": "100644",
        "blob": "3b84c560ccf3f4add4da4b4781c48cad9dd4f9dd",
        "sha256": "5cc55a24e2eff8166ec45643d2289079f688157301a8bc4c936aa098bbfe3c1e",
        "bytes": 4362
      },
      "baseline": {
        "mode": "100644",
        "blob": "940ebd966a457aabce419889892311761b4340b0",
        "sha256": "873861db9dd9a5635563450b4f9412472b3a169b8072707ff6f276634b6bf8c9",
        "bytes": 5005
      },
      "inverses": [
        {
          "at": 0,
          "current": "import assert from 'node:assert/strict';\nimport { buildServer } from '../src/server.js';\n\nif (process.env.DATABASE_URL) throw new Error('Account admission checks require a disposable database.');\nconst keys = ['PRIVY_APP_ID', 'X_CLIENT_ID', 'PUBLIC_URL', 'X_TRUST_USER_TOKEN'];\nconst previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));\nconst oldFetch = global.fetch;\nconst app = await buildServer();\ntry {\n  const count = async () => Number((await app.pool.query('SELECT count(*) AS n FROM accounts')).rows[0].n);\n  const call = (url, payload = {}, headers = {}) => app.inject({ method: 'POST', url, payload, headers });\n  const before = await count();\n  const guest = await call('/v1/auth/guest');\n  assert.equal(guest.statusCode, 200, guest.body);\n  assert.equal(guest.headers['set-cookie'], undefined, 'guest signup sets no age cookie');\n  assert.equal(await count(), before + 1, 'guest signup needs no birth date');\n\n  const deniedCookie = `omerta_age=${app.jwt.sign({ purpose: 'age-check', minimumAge: 21, eligible: false }, { expiresIn: '15m' })}`;\n  const headers = { cookie: deniedCookie };\n  const secret = Buffer.alloc(32, 7).toString('base64url');\n  const first = await call('/v1/auth/guest', { bootstrapSecret: secret }, headers);\n  assert.equal(first.statusCode, 200, 'a legacy denial cookie no longer blocks signup');\n  const recovered = await call('/v1/auth/guest', { bootstrapSecret: secret }, headers);\n  assert.equal(recovered.statusCode, 200, 'bootstrap recovery needs no age confirmation');\n  assert.equal(app.jwt.verify(first.json().token).sub, app.jwt.verify(recovered.json().token).sub);\n  const redeemed = await call('/v1/access/redeem', {\n    bootstrapSecret: Buffer.alloc(32, 8).toString('base64url'),\n  }, headers);\n  assert.equal(redeemed.statusCode, 200, redeemed.body);\n  assert(redeemed.headers['set-cookie'].startsWith('omerta_access='), 'browser admission still issues its access cookie');\n\n  process.env.PRIVY_APP_ID = 'admission-test-app';\n  const privy = await call('/v1/auth/privy', { token: 'malformed' }, headers);\n  assert.equal(privy.json().error, 'auth_failed', 'provider verification runs without age confirmation');\n\n  process.env.X_CLIENT_ID = 'admission-test-client';\n  process.env.PUBLIC_URL = 'https://omerta.example';\n  process.env.X_TRUST_USER_TOKEN = 'on';\n  global.fetch = async url => {\n    if (String(url) === 'https://api.x.com/2/oauth2/token')\n      return { ok: true, status: 200, json: async () => ({ access_token: 'test-provider-token' }) };\n    if (String(url) === 'https://api.x.com/2/users/me')\n      return { ok: true, status: 200, json: async () => ({ data: { id: 'admission-test-user' } }) };\n    throw new Error(`Unexpected provider request: ${url}`);\n  };\n  const provider = await call('/v1/auth/x', { token: 'test-provider-token' }, headers);\n  assert.equal(provider.statusCode, 200, provider.body);\n  const oauth = await call('/v1/auth/x/start', {}, headers);\n  assert.equal(oauth.statusCode, 200, oauth.body);\n  const state = new URL(oauth.json().url).searchParams.get('state');\n  const callback = await app.inject({\n    url: `/v1/auth/x/callback?code=test-code&state=${encodeURIComponent(state)}`,\n    headers: { cookie: `${deniedCookie}; ${oauth.headers['set-cookie'].split(';')[0]}` },\n  });\n  assert.equal(callback.statusCode, 302, callback.body);\n  assert(callback.headers.location.startsWith('/#token='), 'OAuth callback completes without age confirmation');\n  const oauthToken = decodeURIComponent(callback.headers.location.slice('/#token='.length));\n  assert.equal(app.jwt.verify(oauthToken).sub, app.jwt.verify(provider.json().token).sub);\n\n  assert.equal((await call('/v1/age-check', { birthDate: '1990-01-01' })).statusCode, 404, 'the age-check endpoint is removed');\n  const spec = (await app.inject('/openapi.json')).json();\n  assert.equal(spec.paths['/v1/age-check'], undefined);\n  assert.equal(spec.paths['/v1/access/redeem'].post.requestBody.content['application/json'].schema.properties.birthDate, undefined);\n  console.log('Account admission: guest signup, recovery, browser admission, provider login and OAuth work without age verification.');\n} finally {\n  global.fetch = oldFetch;\n  for (const [key, value] of Object.entries(previous)) {\n    if (value === undefined) delete process.env[key]; else process.env[key] = value;\n  }\n  await app.close();\n}\n",
          "baseline": "import assert from 'node:assert/strict';\nimport { MINIMUM_AGE, eligibleBirthDate } from '../src/age.js';\nimport { buildServer } from '../src/server.js';\n\nconst now = new Date('2026-10-31T12:00:00Z');\nassert.equal(MINIMUM_AGE, 21);\nassert.equal(eligibleBirthDate('2005-10-31', now), true);\nassert.equal(eligibleBirthDate('2005-11-01', now), false);\nassert.throws(() => eligibleBirthDate('2005-02-30', now));\nassert.equal(eligibleBirthDate('2006-01-01', now), false, 'a 20-year-old is ineligible');\nassert.equal(eligibleBirthDate('2007-03-01', new Date('2028-02-29T12:00:00Z')), false, 'leap day does not admit a birthday early');\nassert.equal(eligibleBirthDate('2004-02-29', new Date('2025-02-28T12:00:00Z')), false);\nassert.equal(eligibleBirthDate('2004-02-29', new Date('2025-03-01T12:00:00Z')), true);\nassert.throws(() => eligibleBirthDate('2027-01-01', now));\nconst app = await buildServer();\ntry {\n  const count = async () => Number((await app.pool.query('SELECT count(*) AS n FROM accounts')).rows[0].n);\n  const before = await count();\n  for (const birthDate of [undefined, '2020-01-01', '2007-01-01']) {\n    const response = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: birthDate ? { birthDate } : {} });\n    assert.ok(response.statusCode >= 400);\n  }\n  let fetched = false;\n  const oldFetch = global.fetch;\n  global.fetch = async () => { fetched = true; throw new Error('must not reach provider'); };\n  try {\n    const response = await app.inject({ method: 'POST', url: '/v1/auth/privy', payload: { token: 'hostile', birthDate: '2020-01-01' } });\n    assert.equal(response.json().error, 'age_ineligible');\n    assert.equal(fetched, false);\n  } finally { global.fetch = oldFetch; }\n  assert.equal(await count(), before, 'denied ages create no account or account IP');\n  const denied = await app.inject({ method: 'POST', url: '/v1/age-check', payload: { birthDate: '2020-01-01' } });\n  assert.equal(denied.statusCode, 403);\n  const blockedCookie = denied.headers['set-cookie'].split(';')[0];\n  const retry = await app.inject({ method: 'POST', url: '/v1/age-check', headers: { cookie: blockedCookie }, payload: { birthDate: '1990-01-01' } });\n  assert.equal(retry.statusCode, 403, 'denial cannot be corrected immediately using the same browser cookie');\n  const approved = await app.inject({ method: 'POST', url: '/v1/age-check', payload: { birthDate: '1990-01-01' } });\n  assert.equal(approved.statusCode, 200);\n  const token = approved.headers['set-cookie'].split(';')[0].slice('omerta_age='.length);\n  assert.equal(app.jwt.verify(token).purpose, 'age-check');\n  assert.equal(app.jwt.verify(token).minimumAge, 21);\n  for (const claim of [{ purpose: 'age-check', eligible: true }, { purpose: 'age-check', eligible: true, minimumAge: 13 }]) {\n    const old = app.jwt.sign(claim, { expiresIn: '15m' });\n    const denied = await app.inject({ method: 'POST', url: '/v1/auth/guest', headers: { cookie: 'omerta_age=' + old }, payload: {} });\n    assert.equal(denied.json().error, 'age_required', 'a proof from the earlier policy cannot authorize new signup');\n  }\n  assert.equal(JSON.stringify(app.jwt.verify(token)).includes('1990'), false);\n  const explicitChild = await app.inject({ method: 'POST', url: '/v1/auth/guest',\n    headers: { cookie: approved.headers['set-cookie'].split(';')[0] }, payload: { birthDate: '2020-01-01' } });\n  assert.equal(explicitChild.json().error, 'age_ineligible', 'earlier eligibility cannot override an explicit child birth date');\n  assert.equal(await count(), before);\n  const created = await app.inject({ method: 'POST', url: '/v1/auth/guest', headers: { cookie: approved.headers['set-cookie'].split(';')[0] }, payload: {} });\n  assert.equal(created.statusCode, 200, 'eligible cookie admits account creation');\n  const secret = Buffer.alloc(32, 7).toString('base64url');\n  const first = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { bootstrapSecret: secret, birthDate: '1990-01-01' } });\n  assert.equal(first.statusCode, 200);\n  const recovered = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { bootstrapSecret: secret } });\n  assert.equal(recovered.statusCode, 200, 'existing bootstrap recovery does not require birth date again');\n  assert.equal(app.jwt.verify(first.json().token).sub, app.jwt.verify(recovered.json().token).sub);\n  const blockedRecovery = await app.inject({ method: 'POST', url: '/v1/auth/guest',\n    headers: { cookie: blockedCookie }, payload: { bootstrapSecret: secret } });\n  assert.equal(blockedRecovery.json().error, 'age_ineligible', 'recovery does not bypass known-ineligible browser status');\n  const ageBearer = await app.inject({ url: '/v1/session', headers: { authorization: `Bearer ${token}` } });\n  assert.ok(ageBearer.statusCode >= 400, 'age eligibility token cannot authorize a player session');\n  console.log('Age gate: boundary, invalid dates, creation rejection, provider isolation, cookie denial and DOB minimization passed.');\n} finally { await app.close(); }\n"
        }
      ]
    },
    "test/agent-onboarding.js": {
      "current": {
        "mode": "100644",
        "blob": "50b91388461a04e4cae800c78e7af82b0bbb5599",
        "sha256": "d9de217c15dd1cb16c8151fd0552d198d78b521b84a500d00f6c10ae80a5a368",
        "bytes": 4063
      },
      "baseline": {
        "mode": "100644",
        "blob": "5a3974e0e4cfdab59a4e4de1b631cec4bf385775",
        "sha256": "2710afc43a0986f89d2e59bb0c0e0c62bdf7190a3fe8ecbbcd91135da1351398",
        "bytes": 5335
      },
      "inverses": [
        {
          "at": 455,
          "current": "const count = async () => Number((await app.pool.query('SELECT count(*) AS n FROM accounts')).rows[0].n);\ntry {\n  const before = await count();\n  for (const bootstrapSecret of [undefined, 'short', 'A'.repeat(42) + 'B']) {\n    const response = await call('/v1/auth/agent', { bootstrapSecret });\n    assert.equal(response.json().error, 'bootstrap_credential');\n",
          "baseline": "const count = async () => Number((await app.pool.query('SELECT count(*) AS n FROM accounts')).rows[0].n);\ntry {\n  const before = await count();\n  for (const url of ['/v1/auth/guest', '/v1/access/redeem', '/v1/auth/x', '/v1/auth/privy', '/v1/auth/x/start']) {\n    const response = await call(url, { bootstrapSecret: secret(), agent: true, token: 'not-a-provider-token' });\n    assert.equal(response.json().error, 'age_required', `${url} cannot opt out through an agent body flag`);\n  }\n  assert.equal(await count(), before);\n  for (const bootstrapSecret of [undefined, 'short', 'A'.repeat(42) + 'B']) {\n    const response = await call('/v1/auth/agent', { bootstrapSecret });\n    assert.equal(response.json().error, 'bootstrap_credential');\n"
        },
        {
          "at": 1991,
          "current": "  const rawAccount = (await app.pool.query('SELECT * FROM accounts WHERE id=$1', [accountId])).rows[0];\n  assert.equal(Object.keys({ ...rawAccount, ...persistent, ...claims[0] }).some(key => /birth|dob/i.test(key)), false);\n\n  await call('/v1/auth/guest/bootstrap/ack', {}, headers);\n  const retired = await call('/v1/auth/agent', { bootstrapSecret });\n  assert.equal(retired.json().error, 'bootstrap_retired', 'durably saved bearer retires bootstrap recovery');\n",
          "baseline": "  const rawAccount = (await app.pool.query('SELECT * FROM accounts WHERE id=$1', [accountId])).rows[0];\n  assert.equal(Object.keys({ ...rawAccount, ...persistent, ...claims[0] }).some(key => /birth|dob/i.test(key)), false);\n\n  const humanRoute = await call('/v1/auth/guest', { bootstrapSecret });\n  assert.equal(humanRoute.json().error, 'age_required', 'agent recovery proof does not admit a human account');\n  assert.equal(await count(), before + 1);\n  await call('/v1/auth/guest/bootstrap/ack', {}, headers);\n  const retired = await call('/v1/auth/agent', { bootstrapSecret });\n  assert.equal(retired.json().error, 'bootstrap_retired', 'durably saved bearer retires bootstrap recovery');\n"
        },
        {
          "at": 2896,
          "current": "  try {\n    process.env.SOCIAL_VERIFY_MODE = 'trust';\n    const social = await call('/v1/social/share/claim', {}, headers);\n    assert.equal(social.json().error, 'agent', 'the agent identity cannot claim human-only social cash');\n  } finally {\n    if (previousSocialMode === undefined) delete process.env.SOCIAL_VERIFY_MODE;\n    else process.env.SOCIAL_VERIFY_MODE = previousSocialMode;\n  }\n\n  const unackedSecret = secret();\n  const unacked = await call('/v1/auth/agent', { bootstrapSecret: unackedSecret });\n  const unackedHeaders = { authorization: `Bearer ${unacked.json().token}` };\n",
          "baseline": "  try {\n    process.env.SOCIAL_VERIFY_MODE = 'trust';\n    const social = await call('/v1/social/share/claim', {}, headers);\n    assert.equal(social.json().error, 'agent', 'the exempt identity cannot claim human-only social cash');\n  } finally {\n    if (previousSocialMode === undefined) delete process.env.SOCIAL_VERIFY_MODE;\n    else process.env.SOCIAL_VERIFY_MODE = previousSocialMode;\n  }\n\n  const denied = await call('/v1/age-check', { birthDate: '2020-01-01' });\n  const cookie = denied.headers['set-cookie'].split(';')[0];\n  const deniedCount = await count();\n  for (const payload of [{ bootstrapSecret: secret(), birthDate: '2020-01-01' }, { bootstrapSecret: secret(), birthDate: 'invalid' }]) {\n    assert.ok((await call('/v1/auth/agent', payload)).statusCode >= 400);\n  }\n  const blocked = await call('/v1/auth/agent', { bootstrapSecret: secret() }, { cookie });\n  assert.equal(blocked.json().error, 'age_ineligible', 'an agent declaration cannot override a known browser denial');\n  assert.equal(await count(), deniedCount);\n\n  const unackedSecret = secret();\n  const unacked = await call('/v1/auth/agent', { bootstrapSecret: unackedSecret });\n  const unackedHeaders = { authorization: `Bearer ${unacked.json().token}` };\n"
        },
        {
          "at": 3675,
          "current": "    'character creation closes unacknowledged recovery');\n  const spec = (await app.inject('/openapi.json')).json();\n  assert.deepEqual(spec.paths['/v1/auth/agent'].post.security, [], 'agent signup is advertised without bearer auth');\n  console.log('Agent onboarding: permanent classification, recovery, privacy and human-only reward isolation passed.');\n} finally { await app.close(); }\n",
          "baseline": "    'character creation closes unacknowledged recovery');\n  const spec = (await app.inject('/openapi.json')).json();\n  assert.deepEqual(spec.paths['/v1/auth/agent'].post.security, [], 'agent signup is advertised without bearer auth');\n  console.log('Agent-only age exemption: permanent classification, recovery, privacy, denial precedence and human-route isolation passed.');\n} finally { await app.close(); }\n"
        }
      ]
    },
    "test/auth-fixture.js": {
      "current": {
        "mode": "100644",
        "blob": "bd83d9da9d978388098e118e227b1a12f304ea5f",
        "sha256": "519c04238d24e230a18823235a27b3d57336125332359d78259d1cfdfb326cc7",
        "bytes": 149
      },
      "baseline": {
        "mode": "100644",
        "blob": "1d4dad44930dfcaea2ec5025bd46fae2bf111449",
        "sha256": "5563c246cc7e679a122d52624a1180523f668d6bb9d181585a8b34d89166b995",
        "bytes": 338
      },
      "inverses": [
        {
          "at": 0,
          "current": "// Preserve the shared auth-test request helper without adding personal data.\nexport function adultAuthFixture(method, url, body) {\n  return body;\n}\n",
          "baseline": "// Synthetic adult fixtures for unrelated auth tests; age.js tests the gate itself.\nexport function adultAuthFixture(method, url, body) {\n  if (method === 'POST' && ['/v1/auth/guest', '/v1/auth/x', '/v1/auth/privy', '/v1/auth/x/start', '/v1/access/redeem'].includes(url))\n    return { birthDate: '1990-01-01', ...body };\n  return body;\n}\n"
        }
      ]
    },
    "test/client-shell-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "b4496fd201b21c5e99536ccdfd6b684faaf9e58d",
        "sha256": "b08ab98426a7e73b497849e0c89dd91fcb5ad28e0d6b850d3f01d5e35d582a85",
        "bytes": 20463
      },
      "baseline": {
        "mode": "100644",
        "blob": "aa7fa2e9d0db94ca279923e39166a781d22ce030",
        "sha256": "c2260db113b4c2b535cdea269153547e7a29653f6b8bfae5b6dac0eb31d9d6fe",
        "bytes": 20927
      },
      "inverses": [
        {
          "at": 7273,
          "current": "  assert.equal(analytics.filter(event => event.event === 'completion').length, 0, 'Failed loading creates no signup completion.');\n  await page.getByRole('button', { name: 'Try loading again', exact: true }).click();\n  assert.equal(await page.locator('#btn-guest').isDisabled(), true);\n  const signup = page.waitForRequest(request => request.url().endsWith('/site-analytics/event') && request.postDataJSON().target === 'signup_success');\n  resume();\n  await signup; await page.locator('#screen-create:not(.hidden)').waitFor();\n  assert.equal(await page.locator('#age-date').count(), 0, 'Guest entry proceeds without age verification.');\n  assert.equal(analytics.filter(event => event.target === 'guest_start').length, 1, 'A delayed physical activation is counted once after replay.');\n  assert.equal(analytics.filter(event => event.target === 'signup_success').length, 1);\n  assert.equal(analytics.filter(event => event.target === 'guest_start').length, 1);\n  assert.equal(await page.locator('#landing-language-controls').count(), 0, 'Core entry removes the temporary picker before mounting its own.');\n",
          "baseline": "  assert.equal(analytics.filter(event => event.event === 'completion').length, 0, 'Failed loading creates no signup completion.');\n  await page.getByRole('button', { name: 'Try loading again', exact: true }).click();\n  assert.equal(await page.locator('#btn-guest').isDisabled(), true);\n  resume();\n  await page.locator('#age-date').waitFor();\n  assert.equal(analytics.filter(event => event.target === 'guest_start').length, 1, 'A delayed physical activation is counted once after replay.');\n  await page.locator('#age-date').fill('1990-01-01');\n  const signup = page.waitForRequest(request => request.url().endsWith('/site-analytics/event') && request.postDataJSON().target === 'signup_success');\n  await page.locator('dialog[open] button[type=\"submit\"]').click();\n  await signup; await page.locator('#screen-create:not(.hidden)').waitFor();\n  assert.equal(analytics.filter(event => event.target === 'signup_success').length, 1);\n  assert.equal(analytics.filter(event => event.target === 'guest_start').length, 1);\n  assert.equal(await page.locator('#landing-language-controls').count(), 0, 'Core entry removes the temporary picker before mounting its own.');\n"
        },
        {
          "at": 13956,
          "current": "  rejected.on('request', request => { if (request.url().endsWith('/site-analytics/event')) rejectedCounts.push(request.postDataJSON()); });\n  await rejected.route('**/v1/auth/guest', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Retry this signup.' }) }));\n  await rejected.goto(base); await rejected.locator('#btn-guest').click();\n  await rejected.waitForFunction(() => document.querySelector('#guest-status').textContent === 'Retry this signup.' && !document.querySelector('#btn-guest').disabled);\n  assert.equal(rejectedCounts.filter(event => event.event === 'completion').length, 0, 'A confirmed failed signup records no successful completion.');\n  await rejected.close();\n",
          "baseline": "  rejected.on('request', request => { if (request.url().endsWith('/site-analytics/event')) rejectedCounts.push(request.postDataJSON()); });\n  await rejected.route('**/v1/auth/guest', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Retry this signup.' }) }));\n  await rejected.goto(base); await rejected.locator('#btn-guest').click();\n  await rejected.locator('#age-date').fill('1990-01-01'); await rejected.locator('dialog[open] button[type=\"submit\"]').click();\n  await rejected.waitForFunction(() => document.querySelector('#guest-status').textContent === 'Retry this signup.' && !document.querySelector('#btn-guest').disabled);\n  assert.equal(rejectedCounts.filter(event => event.event === 'completion').length, 0, 'A confirmed failed signup records no successful completion.');\n  await rejected.close();\n"
        },
        {
          "at": 15545,
          "current": "  const signIn = await browser.newPage({ reducedMotion: 'reduce' });\n  await signIn.route('**/v1/auth/x/start', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: base + '/?oauth-return=1#token=' + encodeURIComponent(guest.token) }) }));\n  await signIn.goto(base); await signIn.locator('#xoauth-row:not(.hidden)').waitFor();\n  await signIn.locator('#btn-xoauth').click(); await signIn.locator('#screen-main:not(.hidden)').waitFor();\n  assert.equal(new URL(signIn.url()).hash, '', 'Configured X entry retains the existing callback flow.'); await signIn.close();\n  delete process.env.X_CLIENT_ID;\n\n",
          "baseline": "  const signIn = await browser.newPage({ reducedMotion: 'reduce' });\n  await signIn.route('**/v1/auth/x/start', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: base + '/?oauth-return=1#token=' + encodeURIComponent(guest.token) }) }));\n  await signIn.goto(base); await signIn.locator('#xoauth-row:not(.hidden)').waitFor();\n  await signIn.locator('#btn-xoauth').click(); await signIn.locator('#age-date').fill('1990-01-01');\n  await signIn.locator('dialog[open] button[type=\"submit\"]').click(); await signIn.locator('#screen-main:not(.hidden)').waitFor();\n  assert.equal(new URL(signIn.url()).hash, '', 'Configured X entry retains the existing callback flow.'); await signIn.close();\n  delete process.env.X_CLIENT_ID;\n\n"
        },
        {
          "at": 16281,
          "current": "  await provider.route('**/v1/auth/privy', route => { providerToken = route.request().postDataJSON().token; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: guest.token }) }); });\n  await provider.goto(base); await provider.locator('#token-signin > summary').click();\n  await provider.locator('#auth-provider').selectOption('privy'); await provider.locator('#auth-token').fill('synthetic-provider-token');\n  await provider.locator('#btn-provider').click(); await provider.locator('#screen-main:not(.hidden)').waitFor();\n  assert.equal(providerToken, 'synthetic-provider-token', 'Deferred initialization preserves an explicitly entered provider token.'); await provider.close();\n\n  const wallet = await browser.newPage({ reducedMotion: 'reduce' });\n  await wallet.goto(base); await wallet.locator('#btn-wallet-onboard').click(); await wallet.locator('#screen-create:not(.hidden)').waitFor();\n  assert.equal(await wallet.evaluate(() => sessionStorage.getItem('omerta-wallet-onboarding')), '1');\n  await wallet.close();\n\n  const broken = await browser.newPage({ reducedMotion: 'reduce' });\n  broken.on('pageerror', () => {}); let brokenLoads = 0;\n",
          "baseline": "  await provider.route('**/v1/auth/privy', route => { providerToken = route.request().postDataJSON().token; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: guest.token }) }); });\n  await provider.goto(base); await provider.locator('#token-signin > summary').click();\n  await provider.locator('#auth-provider').selectOption('privy'); await provider.locator('#auth-token').fill('synthetic-provider-token');\n  await provider.locator('#btn-provider').click(); await provider.locator('#age-date').fill('1990-01-01');\n  await provider.locator('dialog[open] button[type=\"submit\"]').click(); await provider.locator('#screen-main:not(.hidden)').waitFor();\n  assert.equal(providerToken, 'synthetic-provider-token', 'Deferred initialization preserves an explicitly entered provider token.'); await provider.close();\n\n  const wallet = await browser.newPage({ reducedMotion: 'reduce' });\n  await wallet.goto(base); await wallet.locator('#btn-wallet-onboard').click(); await wallet.locator('#age-date').waitFor();\n  assert.equal(await wallet.evaluate(() => sessionStorage.getItem('omerta-wallet-onboarding')), '1');\n  await wallet.locator('#age-cancel').click(); await wallet.close();\n\n  const broken = await browser.newPage({ reducedMotion: 'reduce' });\n  broken.on('pageerror', () => {}); let brokenLoads = 0;\n"
        }
      ]
    },
    "test/customerlayaway-integration.js": {
      "current": {
        "mode": "100644",
        "blob": "3adebc91ec245f02d9cb1defa4db206716646fbe",
        "sha256": "ab04a832f7cc8ab83a8e1dec533d1f3ef655f4df26d679eb030e33f86f490203",
        "bytes": 7125
      },
      "baseline": {
        "mode": "100644",
        "blob": "8b27939c13d0b56d82b5b65becf1ed186719ba9e",
        "sha256": "5bb691447d2b5e13b8fe94490bc3b0d30fe87ab5dcaa51f5da2abf30811d8175",
        "bytes": 7368
      },
      "inverses": [
        {
          "at": 95,
          "current": "import {runEstate} from '../src/social/estate.js';\nimport {runLedgerInvariants} from '../src/invariants.js';\nimport {canonicalDatabaseSnapshot} from '../tools/rc1-native-proof.js';\nconst f=await fixture(true),{app,pool,tx,I,L,G,native,tool,terms,ref,pay,invoke,state}=f;\nconst tokens=Object.fromEntries(['seller','buyer','other','third','fourth','fifth'].map(a=>[a,app.jwt.sign({sub:a,tv:0,agent:true})]));let serial=0;\nconst call=(a,url,body,key='shared-'+(++serial))=>app.inject({method:'POST',url,payload:body,headers:{authorization:'Bearer '+tokens[a],'idempotency-key':key}});\n",
          "baseline": "import {runEstate} from '../src/social/estate.js';\nimport {runLedgerInvariants} from '../src/invariants.js';\nimport {canonicalDatabaseSnapshot} from '../tools/rc1-native-proof.js';\nimport {adultAuthFixture} from './auth-fixture.js';\nconst f=await fixture(true),{app,pool,tx,I,L,G,native,tool,terms,ref,pay,invoke,state}=f;\nconst tokens=Object.fromEntries(['seller','buyer','other','third','fourth','fifth'].map(a=>[a,app.jwt.sign({sub:a,tv:0,agent:true})]));let serial=0;\nconst call=(a,url,body,key='shared-'+(++serial))=>app.inject({method:'POST',url,payload:body,headers:{authorization:'Bearer '+tokens[a],'idempotency-key':key}});\n"
        },
        {
          "at": 788,
          "current": "const offer=async(a='seller',b='buyer')=>invoke('offerCustomerLayaway',a,{...terms(await tool(a),b),lifetimeSeconds:600},'shared-offer-'+(++serial));\nconst books=async()=>{assert.deepEqual(await L.collectCustomerLayawayIssues(pool),[]);const r=await runLedgerInvariants(pool,{alert:false});assert.deepEqual(r.checks.filter(x=>!x.ok),[]);};\ntry{\n const guest=await app.inject({method:'POST',url:'/v1/auth/guest',payload:{}});assert.equal(guest.statusCode,200,guest.body);assert(guest.json().token);console.log('actual guest admission without a birth date PASS');\n if(native){const quote=await offer('fourth','fifth');let signal,resume,paused=false,entered=false,committed;const observed=new Promise(r=>signal=r),release=new Promise(r=>resume=r);\n const instrumented=new Proxy(pool,{get(t,k){if(k==='connect')return async()=>{const c=await t.connect();return new Proxy(c,{get(target,key){if(key==='query')return async(...args)=>{const result=await target.query(...args);if(!paused&&args[0]===\"SELECT seller_character,buyer_character FROM customer_layaways WHERE status='active' AND (seller_character=$1 OR buyer_character=$1) ORDER BY id LIMIT 5\"&&args[1]?.[0]==='fifth-actor'){paused=true;signal();await release;}return result;};const v=target[key];return typeof v==='function'?v.bind(target):v;}});};const v=t[k];return typeof v==='function'?v.bind(t):v;}});\n const pending=G.withTwoCharacters(instrumented,'other','fifth-actor',async()=>{entered=true;},{meet:false}),rejected=assert.rejects(pending,e=>e.code==='contention'&&/counterpart/i.test(e.message));await Promise.race([observed,new Promise((_,reject)=>setTimeout(()=>reject(Error('layaway preactor discovery not observed')),5000))]);try{await ok('fifth','/v1/customer/layaway/pay',pay(quote,1),'new-counterpart-pay');committed=await state();}finally{resume();}await rejected;assert(!entered);assert.deepEqual(await state(),committed);await ok('fifth','/v1/customer/layaway/cancel',ref(quote));console.log('native first installment introduces real new counterpart: complete preactor union recheck refuses before gameplay, unchanged committed source/cash/custody PASS');}\n",
          "baseline": "const offer=async(a='seller',b='buyer')=>invoke('offerCustomerLayaway',a,{...terms(await tool(a),b),lifetimeSeconds:600},'shared-offer-'+(++serial));\nconst books=async()=>{assert.deepEqual(await L.collectCustomerLayawayIssues(pool),[]);const r=await runLedgerInvariants(pool,{alert:false});assert.deepEqual(r.checks.filter(x=>!x.ok),[]);};\ntry{\n let r=await app.inject({method:'POST',url:'/v1/auth/guest',payload:{}});assert.equal(r.statusCode,400,r.body);assert.equal(r.json().error,'age_required');r=await app.inject({method:'POST',url:'/v1/auth/guest',payload:adultAuthFixture('POST','/v1/auth/guest',{})});assert.equal(r.statusCode,200,r.body);assert(r.json().token);console.log('actual adult fixture guest admission and missing-age refusal PASS');\n if(native){const quote=await offer('fourth','fifth');let signal,resume,paused=false,entered=false,committed;const observed=new Promise(r=>signal=r),release=new Promise(r=>resume=r);\n const instrumented=new Proxy(pool,{get(t,k){if(k==='connect')return async()=>{const c=await t.connect();return new Proxy(c,{get(target,key){if(key==='query')return async(...args)=>{const result=await target.query(...args);if(!paused&&args[0]===\"SELECT seller_character,buyer_character FROM customer_layaways WHERE status='active' AND (seller_character=$1 OR buyer_character=$1) ORDER BY id LIMIT 5\"&&args[1]?.[0]==='fifth-actor'){paused=true;signal();await release;}return result;};const v=target[key];return typeof v==='function'?v.bind(target):v;}});};const v=t[k];return typeof v==='function'?v.bind(t):v;}});\n const pending=G.withTwoCharacters(instrumented,'other','fifth-actor',async()=>{entered=true;},{meet:false}),rejected=assert.rejects(pending,e=>e.code==='contention'&&/counterpart/i.test(e.message));await Promise.race([observed,new Promise((_,reject)=>setTimeout(()=>reject(Error('layaway preactor discovery not observed')),5000))]);try{await ok('fifth','/v1/customer/layaway/pay',pay(quote,1),'new-counterpart-pay');committed=await state();}finally{resume();}await rejected;assert(!entered);assert.deepEqual(await state(),committed);await ok('fifth','/v1/customer/layaway/cancel',ref(quote));console.log('native first installment introduces real new counterpart: complete preactor union recheck refuses before gameplay, unchanged committed source/cash/custody PASS');}\n"
        }
      ]
    },
    "test/gates.js": {
      "current": {
        "mode": "100644",
        "blob": "3bb133e1baba86ccc5423060f90800d2427735ed",
        "sha256": "e6bcaf8a8df43c5f9feb12c9a16193f0cbe21d2810cf724c708706af21ddbf32",
        "bytes": 500935
      },
      "baseline": {
        "mode": "100644",
        "blob": "5c30eba9758ab52b94b86813346afa19a2c7cbbc",
        "sha256": "418c13af33c3f7e40cbe74a198f89f8ba3b3f0416412792f77bc4922d3e9b352",
        "bytes": 501050
      },
      "inverses": [
        {
          "at": 338640,
          "current": "    'test/economicintelligence-fixture.js': 'Import-only actual authenticated GIN/forecast fixture; economic intelligence and default autonomy DTO memory/native proofs execute its exported factory.',\n    'test/fundedexternalwork-fixture.js': 'Import-only actual F11 gameplay and explicitly simulated external-work fixture; required memory/native lifecycle suite executes it, public finance remains unavailable.',\n    'test/managementteams-fixture.js': 'Import-only actual original-party governance/management fixture; required memory/native team suite executes it, no standalone runner.',\n    'test/auth-fixture.js': 'Import-only shared auth request helper used by gameplay suites; it exports no standalone assertions.',\n    'test/server-fixture.js': 'Import-only wrapper around the real server for gameplay suites; it exports no standalone assertions.',\n    'test/economy-composition-restart.js': 'Fresh-process child probe executed by the required native economy-composition suite; it requires an owned disposable PostgreSQL schema and bounded synthetic stdin, so it cannot run standalone.',\n    'test/commercialnegotiation-fixture.js': 'Import-only real authenticated gameplay fixture executed by negotiation and equipment-contract memory/native suites; exports no standalone test runner.',\n    'test/equipmentinsurance-fixture.js': 'Import-only real physical wear and canonical repair fixture executed by insurance memory/native suites; no standalone runner.',\n",
          "baseline": "    'test/economicintelligence-fixture.js': 'Import-only actual authenticated GIN/forecast fixture; economic intelligence and default autonomy DTO memory/native proofs execute its exported factory.',\n    'test/fundedexternalwork-fixture.js': 'Import-only actual F11 gameplay and explicitly simulated external-work fixture; required memory/native lifecycle suite executes it, public finance remains unavailable.',\n    'test/managementteams-fixture.js': 'Import-only actual original-party governance/management fixture; required memory/native team suite executes it, no standalone runner.',\n    'test/auth-fixture.js': 'Import-only synthetic-adult request fixture used by gameplay suites; the independent age suite exercises missing and ineligible birth dates against the real server.',\n    'test/server-fixture.js': 'Import-only wrapper around the real server for unrelated gameplay suites; it supplies synthetic-adult auth bodies and exports no standalone assertions.',\n    'test/economy-composition-restart.js': 'Fresh-process child probe executed by the required native economy-composition suite; it requires an owned disposable PostgreSQL schema and bounded synthetic stdin, so it cannot run standalone.',\n    'test/commercialnegotiation-fixture.js': 'Import-only real authenticated gameplay fixture executed by negotiation and equipment-contract memory/native suites; exports no standalone test runner.',\n    'test/equipmentinsurance-fixture.js': 'Import-only real physical wear and canonical repair fixture executed by insurance memory/native suites; no standalone runner.',\n"
        }
      ]
    },
    "test/genesis-fee-readiness-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "43e565a31a2233a0143876f733d58b7a8e04e93c",
        "sha256": "001f238a5dd826b9962448e7779f950864c49415956956a60286870475cb79f8",
        "bytes": 25966
      },
      "baseline": {
        "mode": "100644",
        "blob": "2a03ab84b77650bf3ae59189fb6c8a604dd5a035",
        "sha256": "ecc3ffff4d2921da88d9326a133beff3b1bd6dfdca70ea0a189d3289adcf7945",
        "bytes": 24960
      },
      "inverses": [
        {
          "at": 412,
          "current": "import { QUESTING_SOURCE, qualifyQuestingSource, questingHistoricalInput,\n  questingHistoricalEntry } from '../tools/questing-source-transfer.js';\nimport { SITE_BASICS_SOURCE, qualifySiteBasicsSource } from '../tools/site-basics-source-transfer.js';\nimport { ageRemovalHistoricalRecord } from '../tools/age-removal-source-transfer.js';\nimport {\n  GENESIS_FEE_READINESS_BASE_REVISION, GENESIS_FEE_READINESS_REVIEWED_REVISION,\n  GENESIS_FEE_READINESS_DOMAINS, GENESIS_FEE_READINESS_SOURCE_TRANSFER,\n",
          "baseline": "import { QUESTING_SOURCE, qualifyQuestingSource, questingHistoricalInput,\n  questingHistoricalEntry } from '../tools/questing-source-transfer.js';\nimport { SITE_BASICS_SOURCE, qualifySiteBasicsSource } from '../tools/site-basics-source-transfer.js';\nimport {\n  GENESIS_FEE_READINESS_BASE_REVISION, GENESIS_FEE_READINESS_REVIEWED_REVISION,\n  GENESIS_FEE_READINESS_DOMAINS, GENESIS_FEE_READINESS_SOURCE_TRANSFER,\n"
        },
        {
          "at": 12912,
          "current": "  assert(Buffer.from(physical).equals(raw), 'Lossless actual fixture UTF-8 required');\n  assert(physical === head || physical === head.replaceAll('\\n', '\\r\\n'),\n    'Whole actual fixture LF/CRLF bytes qualify before projection');\n  const historical = ageRemovalHistoricalRecord(fixture, { head: { mode: actual[1], blob: actual[2] }, index: actualIndex,\n    committed: Buffer.from(head), physical: raw, regular: stat.isFile(), symbolic: stat.isSymbolicLink() });\n  assert.deepEqual({ mode: historical.head.mode, blob: historical.head.blob, sha256: sha(historical.committed), bytes: historical.committed.length },\n    SITE_BASICS_SOURCE.files[fixture].current, 'Independently admitted current fixture reconstructs its unchanged site pin');\n  function fixtureComparison(file, input, tree, index) {\n    assert.equal(arguments.length, 4, 'Only the closed fixture byte/tree/index comparison is accepted');\n    assert.equal(file, fixture, 'Only the exact Genesis historical fixture comparison');\n    assert(Buffer.isBuffer(input), 'Complete physical fixture Buffer required');\n    const actualTree = typeof tree === 'string' && tree.match(/^(100644|100755) blob ([a-f0-9]{40})\\t(.+)$/);\n    assert(actualTree && actualTree[0] === tree && actualTree[3] === file, 'Complete current fixture tree identity required');\n    const historical = ageRemovalHistoricalRecord(file, { head: { mode: actualTree[1], blob: actualTree[2] }, index,\n      committed: Buffer.from(lf(input.toString('utf8'))), physical: input, regular: stat.isFile(), symbolic: stat.isSymbolicLink() });\n    tree = historical.head.mode + ' blob ' + historical.head.blob + '\\t' + file;\n    index = historical.index;\n    const currentPin = SITE_BASICS_SOURCE.files[file].current;\n    assert.equal(tree, currentPin.mode + ' blob ' + currentPin.blob + '\\t' + file, 'Only the exact current site tree is admitted');\n    assert.equal(index, currentPin.mode + ' ' + currentPin.blob + ' 0\\t' + file, 'Only the exact current site index is admitted');\n    const siteProof = qualifySiteBasicsSource(file, historical.committed);\n    assert.deepEqual([siteProof.sourceOnly, siteProof.runtime, siteProof.native, siteProof.financial, siteProof.activation,\n      siteProof.deployment, siteProof.priorResultsTransferred], [true, false, false, false, false, false, false]);\n    const siteText = siteProof.baselineText;\n",
          "baseline": "  assert(Buffer.from(physical).equals(raw), 'Lossless actual fixture UTF-8 required');\n  assert(physical === head || physical === head.replaceAll('\\n', '\\r\\n'),\n    'Whole actual fixture LF/CRLF bytes qualify before projection');\n  assert.deepEqual({ mode: actual[1], blob: actual[2], sha256: sha(head), bytes: Buffer.byteLength(head) },\n    SITE_BASICS_SOURCE.files[fixture].current, 'The real current fixture independently matches its exact site pin');\n  function fixtureComparison(file, input, tree, index) {\n    assert.equal(arguments.length, 4, 'Only the closed fixture byte/tree/index comparison is accepted');\n    assert.equal(file, fixture, 'Only the exact Genesis historical fixture comparison');\n    assert(Buffer.isBuffer(input), 'Complete physical fixture Buffer required');\n    const currentPin = SITE_BASICS_SOURCE.files[file].current;\n    assert.equal(tree, currentPin.mode + ' blob ' + currentPin.blob + '\\t' + file, 'Only the exact current site tree is admitted');\n    assert.equal(index, currentPin.mode + ' ' + currentPin.blob + ' 0\\t' + file, 'Only the exact current site index is admitted');\n    const siteProof = qualifySiteBasicsSource(file, input);\n    assert.deepEqual([siteProof.sourceOnly, siteProof.runtime, siteProof.native, siteProof.financial, siteProof.activation,\n      siteProof.deployment, siteProof.priorResultsTransferred], [true, false, false, false, false, false, false]);\n    const siteText = siteProof.baselineText;\n"
        },
        {
          "at": 22784,
          "current": "  for (const supplied of [Buffer.from(head + '\\n// unrelated fixture edit\\n'), Buffer.from(head.slice(1)),\n    Buffer.from('\\ufeff' + head), Buffer.from(head + '\\0'), Buffer.from(head.replace('\\n', '\\r\\n')),\n    Buffer.from(head.replace('\\n', '\\r')), Buffer.from(head.replace(/\\S/, '?')), Buffer.from([255]),\n    comparison.source, historical.committed, head, null]) {\n    assert.throws(() => fixtureComparison(fixture, supplied, actualEntry, actualIndex)); currentRefusals++;\n  }\n  for (const kind of ['tree', 'index']) {\n",
          "baseline": "  for (const supplied of [Buffer.from(head + '\\n// unrelated fixture edit\\n'), Buffer.from(head.slice(1)),\n    Buffer.from('\\ufeff' + head), Buffer.from(head + '\\0'), Buffer.from(head.replace('\\n', '\\r\\n')),\n    Buffer.from(head.replace('\\n', '\\r')), Buffer.from(head.replace(/\\S/, '?')), Buffer.from([255]),\n    comparison.source, head, null]) {\n    assert.throws(() => fixtureComparison(fixture, supplied, actualEntry, actualIndex)); currentRefusals++;\n  }\n  for (const kind of ['tree', 'index']) {\n"
        },
        {
          "at": 23999,
          "current": "  assert.throws(() => fixtureComparison(fixture, raw, actualEntry)); currentRefusals++;\n  assert.throws(() => fixtureComparison(fixture, raw, actualEntry, actualIndex, {})); currentRefusals++;\n  assert.throws(() => { comparison.proof.native = true; }, TypeError); currentRefusals++;\n  assert.equal(currentPositives, 2); assert.equal(currentRefusals, 31);\n  let siteRefusals = 0;\n  const questCurrent = QUESTING_SOURCE.files[fixture].current;\n  const oldTree = questCurrent.mode + ' blob ' + questCurrent.blob + '\\t' + fixture;\n",
          "baseline": "  assert.throws(() => fixtureComparison(fixture, raw, actualEntry)); currentRefusals++;\n  assert.throws(() => fixtureComparison(fixture, raw, actualEntry, actualIndex, {})); currentRefusals++;\n  assert.throws(() => { comparison.proof.native = true; }, TypeError); currentRefusals++;\n  assert.equal(currentPositives, 2); assert.equal(currentRefusals, 30);\n  let siteRefusals = 0;\n  const questCurrent = QUESTING_SOURCE.files[fixture].current;\n  const oldTree = questCurrent.mode + ' blob ' + questCurrent.blob + '\\t' + fixture;\n"
        }
      ]
    },
    "test/hardening.js": {
      "current": {
        "mode": "100644",
        "blob": "c6dd6e3613d7cc4b3ab5dbd62041d1ece87ff0eb",
        "sha256": "cba4c8e4c4c5ab7936a32cb2642db4887b1c5e0cae139b51ef0f6b77b3028eeb",
        "bytes": 142355
      },
      "baseline": {
        "mode": "100644",
        "blob": "4b54f6b4b095c3dd482b2e55e1b302bd722e5fa9",
        "sha256": "989af49e0989f4697738c3ae395ae28ff15177c5cf237ce41a508a29f52e20eb",
        "bytes": 142579
      },
      "inverses": [
        {
          "at": 3345,
          "current": "  app.post(`/v1/__contention_${code}`, async () => { const e = new Error('boom'); e.code = code; throw e; });\napp.post('/v1/__genuine_bug', async () => { throw new Error('a real null-dereference'); });\nconst pool = app.pool;\nconst modH = { 'x-mod-key': 'test-mod-key' };\nconst call = async (method, url, { token, body, headers } = {}) => {\n  const res = await app.inject({ method, url, payload: headers?.['content-type'] === 'application/json' && body === undefined ? undefined : adultAuthFixture(method, url, body),\n",
          "baseline": "  app.post(`/v1/__contention_${code}`, async () => { const e = new Error('boom'); e.code = code; throw e; });\napp.post('/v1/__genuine_bug', async () => { throw new Error('a real null-dereference'); });\nconst pool = app.pool;\nconst ageCookie = (await app.inject({ method: 'POST', url: '/v1/age-check', payload: { birthDate: '1990-01-01' } })).headers['set-cookie'].split(';')[0];\nconst modH = { 'x-mod-key': 'test-mod-key' };\nconst call = async (method, url, { token, body, headers } = {}) => {\n  const res = await app.inject({ method, url, payload: headers?.['content-type'] === 'application/json' && body === undefined ? undefined : adultAuthFixture(method, url, body),\n"
        },
        {
          "at": 77348,
          "current": "    let r = await call('POST', '/v1/auth/x/start', { body: {} });\n    let state = new URL(r.body.url).searchParams.get('state');\n    let cb = await app.inject({ method: 'GET', url: `/v1/auth/x/callback?code=ok&state=${state}`,\n      headers: { cookie: `omerta_oauth=${state}` } });\n    assert(cb.headers.location.includes('#token='), 'a real exchange lands a signed session token');\n    const xToken = decodeURIComponent(cb.headers.location.split('#token=')[1]);\n    const sess = await call('GET', '/v1/session', { token: xToken });\n    assert.equal(sess.body.provider, 'x', 'the minted session is the X identity');\n    // REPLAY the same callback → the state was consumed (single-use, DELETE-returning)\n    cb = await app.inject({ method: 'GET', url: `/v1/auth/x/callback?code=ok&state=${state}`,\n      headers: { cookie: `omerta_oauth=${state}` } });\n    assert(cb.headers.location.includes('#autherr=oauth_state'), 'a replayed callback finds no state');\n    // (2) the guest UPGRADE: an authed start claims-in-place; the same X id can never claim twice\n    const claimer = await mk('Claim Kid');\n",
          "baseline": "    let r = await call('POST', '/v1/auth/x/start', { body: {} });\n    let state = new URL(r.body.url).searchParams.get('state');\n    let cb = await app.inject({ method: 'GET', url: `/v1/auth/x/callback?code=ok&state=${state}`,\n      headers: { cookie: `omerta_oauth=${state}; ${ageCookie}` } });\n    assert(cb.headers.location.includes('#token='), 'a real exchange lands a signed session token');\n    const xToken = decodeURIComponent(cb.headers.location.split('#token=')[1]);\n    const sess = await call('GET', '/v1/session', { token: xToken });\n    assert.equal(sess.body.provider, 'x', 'the minted session is the X identity');\n    // REPLAY the same callback → the state was consumed (single-use, DELETE-returning)\n    cb = await app.inject({ method: 'GET', url: `/v1/auth/x/callback?code=ok&state=${state}`,\n      headers: { cookie: `omerta_oauth=${state}; ${ageCookie}` } });\n    assert(cb.headers.location.includes('#autherr=oauth_state'), 'a replayed callback finds no state');\n    // (2) the guest UPGRADE: an authed start claims-in-place; the same X id can never claim twice\n    const claimer = await mk('Claim Kid');\n"
        },
        {
          "at": 78504,
          "current": "    r = await call('POST', '/v1/auth/x/start', { token: claimer.token, body: {} });\n    state = new URL(r.body.url).searchParams.get('state');\n    cb = await app.inject({ method: 'GET', url: `/v1/auth/x/callback?code=ok&state=${state}`,\n      headers: { cookie: `omerta_oauth=${state}` } });\n    assert(cb.headers.location.includes('#claimed=x'), 'the guest is upgraded in place');\n    assert.equal((await call('GET', '/v1/session', { token: claimer.token })).body.provider, 'x',\n      'same account row, now an X identity');\n",
          "baseline": "    r = await call('POST', '/v1/auth/x/start', { token: claimer.token, body: {} });\n    state = new URL(r.body.url).searchParams.get('state');\n    cb = await app.inject({ method: 'GET', url: `/v1/auth/x/callback?code=ok&state=${state}`,\n      headers: { cookie: `omerta_oauth=${state}; ${ageCookie}` } });\n    assert(cb.headers.location.includes('#claimed=x'), 'the guest is upgraded in place');\n    assert.equal((await call('GET', '/v1/session', { token: claimer.token })).body.provider, 'x',\n      'same account row, now an X identity');\n"
        },
        {
          "at": 79076,
          "current": "    r = await call('POST', '/v1/auth/x/start', { token: rival.token, body: {} });\n    state = new URL(r.body.url).searchParams.get('state');\n    cb = await app.inject({ method: 'GET', url: `/v1/auth/x/callback?code=ok&state=${state}`,\n      headers: { cookie: `omerta_oauth=${state}` } });\n    assert(cb.headers.location.includes('#autherr=linked_elsewhere'), 'one X account, one street — the collision is clean');\n    // (3) a transient X failure during the exchange is a clean retryable x_busy, never a 500\n    xmock.token = () => jres(500, {});\n    r = await call('POST', '/v1/auth/x/start', { body: {} });\n    state = new URL(r.body.url).searchParams.get('state');\n    cb = await app.inject({ method: 'GET', url: `/v1/auth/x/callback?code=ok&state=${state}`,\n      headers: { cookie: `omerta_oauth=${state}` } });\n    assert(cb.headers.location.includes('#autherr=x_busy'), 'an X outage mid-exchange reads as busy, not broken');\n    // (4) verifyPostUp semantics: transient ≠ definitive (an outage must NEVER read as \"post gone\")\n    process.env.SOCIAL_VERIFY_MODE = 'live';\n",
          "baseline": "    r = await call('POST', '/v1/auth/x/start', { token: rival.token, body: {} });\n    state = new URL(r.body.url).searchParams.get('state');\n    cb = await app.inject({ method: 'GET', url: `/v1/auth/x/callback?code=ok&state=${state}`,\n      headers: { cookie: `omerta_oauth=${state}; ${ageCookie}` } });\n    assert(cb.headers.location.includes('#autherr=linked_elsewhere'), 'one X account, one street — the collision is clean');\n    // (3) a transient X failure during the exchange is a clean retryable x_busy, never a 500\n    xmock.token = () => jres(500, {});\n    r = await call('POST', '/v1/auth/x/start', { body: {} });\n    state = new URL(r.body.url).searchParams.get('state');\n    cb = await app.inject({ method: 'GET', url: `/v1/auth/x/callback?code=ok&state=${state}`,\n      headers: { cookie: `omerta_oauth=${state}; ${ageCookie}` } });\n    assert(cb.headers.location.includes('#autherr=x_busy'), 'an X outage mid-exchange reads as busy, not broken');\n    // (4) verifyPostUp semantics: transient ≠ definitive (an outage must NEVER read as \"post gone\")\n    process.env.SOCIAL_VERIFY_MODE = 'live';\n"
        }
      ]
    },
    "test/launch-invites-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "b9b04ab4c130b1347796baa5c7c09ded8881d2b3",
        "sha256": "9cc27a79042cb52b81f80de26117bdef45f13080ea6707c2324b6dcf590f4074",
        "bytes": 4505
      },
      "baseline": {
        "mode": "100644",
        "blob": "20894bc21000e2efd395450e4c0726ccfa5cb38b",
        "sha256": "84eabf4fbf70639a1834c50eb11df6cdc411cc74dcb3f635bf7e635b76c8a3b2",
        "bytes": 4685
      },
      "inverses": [
        {
          "at": 1374,
          "current": "  await page.setViewportSize({ width: 390, height: 844 });\n  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no mobile overflow');\n  await page.locator('#btn-guest').click();\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 30000 });\n  const token = await page.evaluate(() => localStorage.getItem('omerta_token'));\n  assert(token, 'admission token saved durably before navigation');\n",
          "baseline": "  await page.setViewportSize({ width: 390, height: 844 });\n  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no mobile overflow');\n  await page.locator('#btn-guest').click();\n  await page.waitForSelector('#age-date');\n  await page.locator('#age-date').fill('1990-01-01');\n  await page.locator('#age-date').evaluate((input) => input.form.requestSubmit());\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 30000 });\n  const token = await page.evaluate(() => localStorage.getItem('omerta_token'));\n  assert(token, 'admission token saved durably before navigation');\n"
        }
      ]
    },
    "test/legal-security.js": {
      "current": {
        "mode": "100644",
        "blob": "6d222d5ee3659b246bf50a40a38de2643ce27d49",
        "sha256": "974b248b54c7326dfa3cb64fa000c92fb14e8fbe7e0380baa7e677990b98aa4c",
        "bytes": 8268
      },
      "baseline": {
        "mode": "100644",
        "blob": "47fdd3229a01db7f284081463158c72d3a4ae3fc",
        "sha256": "c163969347ca63c21662b070b99f51e70eb35620335a9b78534661b719e8f1da",
        "bytes": 8086
      },
      "inverses": [
        {
          "at": 1048,
          "current": "  for (const key of Object.keys(profile)) delete process.env[key];\n  const defaultPrivacy = await app.inject('/privacy');\n  assert.equal(defaultPrivacy.statusCode, 200, 'default privacy policy is public without operator configuration');\n  assert(defaultPrivacy.body.includes('November 9, 2026'));\n  assert(defaultPrivacy.body.includes('A dedicated privacy contact has not yet been published'));\n  assert(!/\\b(?:null|undefined)\\b/.test(defaultPrivacy.body), 'default policy has no missing-value placeholders');\n  assert(!/180 days|seven days|thirty days|\\/v1\\/|background worker|BYPASSRLS|JWT_SECRET|end-to-end encrypted|token records/.test(defaultPrivacy.body), 'public notice omits security internals and cleanup timings');\n",
          "baseline": "  for (const key of Object.keys(profile)) delete process.env[key];\n  const defaultPrivacy = await app.inject('/privacy');\n  assert.equal(defaultPrivacy.statusCode, 200, 'default privacy policy is public without operator configuration');\n  assert(defaultPrivacy.body.includes('November 7, 2026'));\n  assert(defaultPrivacy.body.includes('A dedicated privacy contact has not yet been published'));\n  assert(!/\\b(?:null|undefined)\\b/.test(defaultPrivacy.body), 'default policy has no missing-value placeholders');\n  assert(!/180 days|seven days|thirty days|\\/v1\\/|background worker|BYPASSRLS|JWT_SECRET|end-to-end encrypted|token records/.test(defaultPrivacy.body), 'public notice omits security internals and cleanup timings');\n"
        },
        {
          "at": 3277,
          "current": "  const privacy = (await app.inject('/privacy')).body;\n  assert(privacy.includes('under 21, including children'));\n  assert(!privacy.includes('under 13'));\n  for (const description of ['IP addresses', 'Wallet addresses', 'Messages', 'Notification-delivery', 'Delegated-agent', 'Retention depends', 'Technical diagnostics']) assert(privacy.includes(description));\n  assert(!/birth date|age check|age verification/i.test(privacy), 'privacy does not describe the removed birth-date flow');\n  delete process.env.DMCA_AGENT_REGISTERED;\n  assert.equal((await app.inject('/dmca')).statusCode, 503, 'unverified registration is not presented as registered');\n  process.env.DMCA_AGENT_REGISTERED = 'true';\n",
          "baseline": "  const privacy = (await app.inject('/privacy')).body;\n  assert(privacy.includes('under 21, including children'));\n  assert(!privacy.includes('under 13'));\n  for (const description of ['IP addresses', 'Wallet addresses', 'Messages', 'Notification-delivery', 'Delegated-agent', 'Retention depends', 'without retaining', 'Technical diagnostics']) assert(privacy.includes(description));\n  delete process.env.DMCA_AGENT_REGISTERED;\n  assert.equal((await app.inject('/dmca')).statusCode, 503, 'unverified registration is not presented as registered');\n  process.env.DMCA_AGENT_REGISTERED = 'true';\n"
        },
        {
          "at": 4991,
          "current": "  for (const payload of [{ event: 'start' }, { event: 'answer', question: PATH_QUIZ_QUESTIONS[0].id, option: PATH_QUIZ_QUESTIONS[0].options[0].id, step: 1 }, { event: 'share', path: 'gun', channel: 'clipboard' }]) {\n    assert.equal((await app.inject({ method: 'POST', url: '/v1/path-quiz', payload })).statusCode, 200);\n  }\n  const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: {} });\n  assert.equal(guest.statusCode, 200, 'human signup works without a birth date or optional analytics');\n  const headers = { authorization: `Bearer ${guest.json().token}` };\n  assert.equal((await app.inject({ method: 'POST', url: '/v1/screens', headers, payload: { screens: ['profile', 'wire'] } })).json().counted, 0);\n  assert.equal((await app.inject({ method: 'POST', url: '/v1/broadcast/shared', headers, payload: { kind: 'win' } })).statusCode, 200);\n",
          "baseline": "  for (const payload of [{ event: 'start' }, { event: 'answer', question: PATH_QUIZ_QUESTIONS[0].id, option: PATH_QUIZ_QUESTIONS[0].options[0].id, step: 1 }, { event: 'share', path: 'gun', channel: 'clipboard' }]) {\n    assert.equal((await app.inject({ method: 'POST', url: '/v1/path-quiz', payload })).statusCode, 200);\n  }\n  const guest = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { birthDate: '1990-01-01' } });\n  const headers = { authorization: `Bearer ${guest.json().token}` };\n  assert.equal((await app.inject({ method: 'POST', url: '/v1/screens', headers, payload: { screens: ['profile', 'wire'] } })).json().counted, 0);\n  assert.equal((await app.inject({ method: 'POST', url: '/v1/broadcast/shared', headers, payload: { kind: 'win' } })).statusCode, 200);\n"
        }
      ]
    },
    "test/lib/city-afterword-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "b4967b7b24a77e1f4a94ac04b0f61c6ee1b1daee",
        "sha256": "f55b3b18a60815b91b7fd7a635e157636812d15a214ad9f87edb9370a5742c1f",
        "bytes": 6132
      },
      "baseline": {
        "mode": "100644",
        "blob": "70b6c9c3612738d9441586f067e2c59e46d0238d",
        "sha256": "6a8e0fed01c44d65a56266ae9fe221b66b9cd2859326c0dff6190caa94b53d09",
        "bytes": 6035
      },
      "inverses": [
        {
          "at": 134,
          "current": "import fs from 'node:fs';\nimport { chromium } from 'playwright-core';\nimport { cityAfterwordFixture, afterwordGraph as graph, mysteryRoot } from './city-afterword-fixture.js';\nimport { revealOptional } from './ux-disclosure-browser.js';\n\nexport async function runCityAfterwordBrowserProof() {\n  const executablePath = [process.env.CHROMIUM_PATH, chromium.executablePath(),\n",
          "baseline": "import fs from 'node:fs';\nimport { chromium } from 'playwright-core';\nimport { cityAfterwordFixture, afterwordGraph as graph, mysteryRoot } from './city-afterword-fixture.js';\n\nexport async function runCityAfterwordBrowserProof() {\n  const executablePath = [process.env.CHROMIUM_PATH, chromium.executablePath(),\n"
        },
        {
          "at": 4798,
          "current": "      assert.equal((await board(owner)).status, 'completed');\n      await detail.getByRole('heading', { name: 'Case closed', exact: true }).waitFor();\n      const ending = page.locator('[data-ux-story=\"case\"] [data-story-section^=\"epilogue:\"]');\n      await revealOptional(ending);\n      await ending.waitFor();\n      if (!await ending.evaluate(element => element.open)) await ending.locator(':scope > summary').click();\n      assert.match(await ending.innerText(), branch === 'live' ? /The neighborhood knows whom to call/ : /The archive remembers another name/);\n",
          "baseline": "      assert.equal((await board(owner)).status, 'completed');\n      await detail.getByRole('heading', { name: 'Case closed', exact: true }).waitFor();\n      const ending = page.locator('[data-ux-story=\"case\"] [data-story-section^=\"epilogue:\"]');\n      await ending.waitFor();\n      if (!await ending.evaluate(element => element.open)) await ending.locator(':scope > summary').click();\n      assert.match(await ending.innerText(), branch === 'live' ? /The neighborhood knows whom to call/ : /The archive remembers another name/);\n"
        }
      ]
    },
    "test/lib/rc1-historical-source-fixture.js": {
      "current": {
        "mode": "100644",
        "blob": "37e933f657e337ce3f83e61fa868880f4045b79b",
        "sha256": "58289bf4ffd2365f5a9b78fe0c27fe9de54cdf4865f591b3002c9283442cffc9",
        "bytes": 65056
      },
      "baseline": {
        "mode": "100644",
        "blob": "2939b8d45cab84f02514631addaeadb65ddbc67b",
        "sha256": "f04494bf0c912b9c7e8ac6ec075270689ee7206d965f356b9026181088555c81",
        "bytes": 64861
      },
      "inverses": [
        {
          "at": 2245,
          "current": "import { economyHardeningSourceBaseline } from '../../tools/economy-hardening-source-transfer.js';\nimport { QUESTING_SOURCE, qualifyQuestingSource } from '../../tools/questing-source-transfer.js';\nimport { SITE_BASICS_SOURCE, qualifySiteBasicsSource } from '../../tools/site-basics-source-transfer.js';\nimport { ageRemovalHistoricalRecord } from '../../tools/age-removal-source-transfer.js';\n\nexport const HISTORICAL_SOURCE_FIXTURE_REVISION = 'fe4a75a8b21fc41fd3d3bc75cf7720612c581463';\nconst releaseRevision = 'b12c1cbcbcf88bd4510cc8316c5cd5ca08eb4e16';\n",
          "baseline": "import { economyHardeningSourceBaseline } from '../../tools/economy-hardening-source-transfer.js';\nimport { QUESTING_SOURCE, qualifyQuestingSource } from '../../tools/questing-source-transfer.js';\nimport { SITE_BASICS_SOURCE, qualifySiteBasicsSource } from '../../tools/site-basics-source-transfer.js';\n\nexport const HISTORICAL_SOURCE_FIXTURE_REVISION = 'fe4a75a8b21fc41fd3d3bc75cf7720612c581463';\nconst releaseRevision = 'b12c1cbcbcf88bd4510cc8316c5cd5ca08eb4e16';\n"
        },
        {
          "at": 18886,
          "current": "}\nfunction qualifyCurrentCombinedSite(file, actual) {\n  assert.equal(arguments.length, 2); assert(combinedSiteComparisonFiles.includes(file), 'Only the four declared current combined comparisons');\n  actual = ageRemovalHistoricalRecord(file, actual);\n  assert(Object.hasOwn(SITE_BASICS_SOURCE.files, file), 'Exact site comparison domain required');\n  assert.deepEqual(Object.keys(actual).sort(), ['head', 'index', 'committed', 'physical', 'regular', 'symbolic'].sort());\n  const pin = SITE_BASICS_SOURCE.files[file].current;\n",
          "baseline": "}\nfunction qualifyCurrentCombinedSite(file, actual) {\n  assert.equal(arguments.length, 2); assert(combinedSiteComparisonFiles.includes(file), 'Only the four declared current combined comparisons');\n  assert(Object.hasOwn(SITE_BASICS_SOURCE.files, file), 'Exact site comparison domain required');\n  assert.deepEqual(Object.keys(actual).sort(), ['head', 'index', 'committed', 'physical', 'regular', 'symbolic'].sort());\n  const pin = SITE_BASICS_SOURCE.files[file].current;\n"
        },
        {
          "at": 21342,
          "current": "  return qualifyCurrentHistoricalHelper(file, actual, SITE_BASICS_SOURCE.files[file].current, qualifySiteBasicsSource);\n}\nfunction qualifyCurrentHistoricalHelper(file, actual, pin, qualify) {\n  actual = ageRemovalHistoricalRecord(file, actual);\n  assert.deepEqual(Object.keys(actual).sort(), ['head', 'index', 'committed', 'physical', 'regular', 'symbolic'].sort());\n  assert.deepEqual(actual.head, { mode: pin.mode, blob: pin.blob }, 'Actual helper HEAD equals its current source pin');\n  assert.equal(actual.index, pin.mode + ' ' + pin.blob + ' 0\\t' + file, 'Actual helper index equals its complete HEAD identity');\n",
          "baseline": "  return qualifyCurrentHistoricalHelper(file, actual, SITE_BASICS_SOURCE.files[file].current, qualifySiteBasicsSource);\n}\nfunction qualifyCurrentHistoricalHelper(file, actual, pin, qualify) {\n  assert.deepEqual(Object.keys(actual).sort(), ['head', 'index', 'committed', 'physical', 'regular', 'symbolic'].sort());\n  assert.deepEqual(actual.head, { mode: pin.mode, blob: pin.blob }, 'Actual helper HEAD equals its current source pin');\n  assert.equal(actual.index, pin.mode + ' ' + pin.blob + ' 0\\t' + file, 'Actual helper index equals its complete HEAD identity');\n"
        }
      ]
    },
    "test/lib/ux-journeys.js": {
      "current": {
        "mode": "100644",
        "blob": "a226be9421c511b03c7a62b8264e14bb0d640f26",
        "sha256": "4df40879cee8d1e4317170688e737407d2c6f3ad9c7a6085cf03caf973426e37",
        "bytes": 23252
      },
      "baseline": {
        "mode": "100644",
        "blob": "d519371d05ae1075ae8e9ceafbad7262b2e0da77",
        "sha256": "f4edfb0d836f75fc688af169d938ebb577a5bd3606696f3902c7d84c7e6bfd88",
        "bytes": 22566
      },
      "inverses": [
        {
          "at": 98,
          "current": "import { QUESTING_SOURCE, questingHistoricalInput, questingHistoricalEntry } from '../../tools/questing-source-transfer.js';\nimport { QUEST_QUALITY_SOURCE, qualifyQuestQualitySource } from '../../tools/quest-quality-source-transfer.js';\nimport { SITE_BASICS_SOURCE, qualifySiteBasicsSource } from '../../tools/site-basics-source-transfer.js';\nimport { ageRemovalHistoricalRecord } from '../../tools/age-removal-source-transfer.js';\nimport { BUSINESS_DESK_COMBINED_SOURCE, assertBusinessDeskCombinedSourceTransfer } from '../../tools/businessdesk-combined-source-transfer.js';\nimport assert from 'node:assert/strict';\nimport { readFileSync, lstatSync } from 'node:fs';\n",
          "baseline": "import { QUESTING_SOURCE, questingHistoricalInput, questingHistoricalEntry } from '../../tools/questing-source-transfer.js';\nimport { QUEST_QUALITY_SOURCE, qualifyQuestQualitySource } from '../../tools/quest-quality-source-transfer.js';\nimport { SITE_BASICS_SOURCE, qualifySiteBasicsSource } from '../../tools/site-basics-source-transfer.js';\nimport { BUSINESS_DESK_COMBINED_SOURCE, assertBusinessDeskCombinedSourceTransfer } from '../../tools/businessdesk-combined-source-transfer.js';\nimport assert from 'node:assert/strict';\nimport { readFileSync, lstatSync } from 'node:fs';\n"
        },
        {
          "at": 7048,
          "current": "  const rootSource = assertContractReleaseSourceDefinition();\n  const assertActualHeadInput = (file, raw, current, physical = current) => {\n    const original = pin.files.find(row => row.file === file); assert(original, 'Closed actual Afterword source subject');\n    assert.equal(typeof current, 'string'); assert.equal(typeof physical, 'string');\n    const actualIndex = git('ls-files', '--stage', '--', file).trim();\n    const actualStat = lstatSync(new URL('../../' + file, import.meta.url));\n    const historical = ageRemovalHistoricalRecord(file, { head: raw,\n      index: actualIndex, committed: Buffer.from(current), physical: Buffer.from(physical),\n      regular: actualStat.isFile(), symbolic: actualStat.isSymbolicLink() });\n    raw = historical.head; current = historical.committed.toString('utf8'); physical = historical.physical.toString('utf8');\n    const desk = rootSource.status === 'BOUND' && Object.hasOwn(rootSource.sourceViews, file)\n      && Object.hasOwn(rootSource.sourceViews[file].targets, 'desk') ? rootSource.sourceViews[file] : null;\n    const domain = Object.hasOwn(BUSINESS_DESK_DOMAINS, file) ? BUSINESS_DESK_DOMAINS[file] : original;\n",
          "baseline": "  const rootSource = assertContractReleaseSourceDefinition();\n  const assertActualHeadInput = (file, raw, current, physical = current) => {\n    const original = pin.files.find(row => row.file === file); assert(original, 'Closed actual Afterword source subject');\n    const desk = rootSource.status === 'BOUND' && Object.hasOwn(rootSource.sourceViews, file)\n      && Object.hasOwn(rootSource.sourceViews[file].targets, 'desk') ? rootSource.sourceViews[file] : null;\n    const domain = Object.hasOwn(BUSINESS_DESK_DOMAINS, file) ? BUSINESS_DESK_DOMAINS[file] : original;\n"
        }
      ]
    },
    "test/lib/ux-opening-live-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "0f2c29f2c9c397626be67407b4f66abdfb7a4489",
        "sha256": "0397b2dbc14d0158be3794041570d42b585fc0c18feaf9f824c0c79a97db78a8",
        "bytes": 13189
      },
      "baseline": {
        "mode": "100644",
        "blob": "2373227d64c3d200d5d01fdc4e1704ff030dea1d",
        "sha256": "cadbff7891ae7c8a7e7f322066aa03ef8565a6262a8cb5b89f145a94cc32ce55",
        "bytes": 13039
      },
      "inverses": [
        {
          "at": 213,
          "current": "import path from 'node:path';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from '../server-fixture.js';\nimport { revealOptional } from './ux-disclosure-browser.js';\n\nexport async function runOpeningLiveBrowserProof() {\n  assert(!process.env.DATABASE_URL, 'Opening journey proof requires disposable pg-mem.');\n",
          "baseline": "import path from 'node:path';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from '../server-fixture.js';\n\nexport async function runOpeningLiveBrowserProof() {\n  assert(!process.env.DATABASE_URL, 'Opening journey proof requires disposable pg-mem.');\n"
        },
        {
          "at": 1832,
          "current": "    await page.locator(`#jump-list [data-jump=\"${tab}\"]`).first().click();\n    await page.locator(`#tab-${tab}.on`).waitFor();\n  };\n  const openDetails = async locator => {\n    await revealOptional(locator);\n    if (!await locator.evaluate(node => node.open)) await locator.locator(':scope > summary').click();\n  };\n  const opening = (page, tab) => page.locator(`#tab-${tab} [data-ux-progression=\"opening\"] .ux-opening`);\n  const economy = async id => ({\n    cash: Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [id])).rows[0].cash),\n",
          "baseline": "    await page.locator(`#jump-list [data-jump=\"${tab}\"]`).first().click();\n    await page.locator(`#tab-${tab}.on`).waitFor();\n  };\n  const openDetails = async locator => { if (!await locator.evaluate(node => node.open)) await locator.locator(':scope > summary').click(); };\n  const opening = (page, tab) => page.locator(`#tab-${tab} [data-ux-progression=\"opening\"] .ux-opening`);\n  const economy = async id => ({\n    cash: Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [id])).rows[0].cash),\n"
        },
        {
          "at": 8291,
          "current": "    assert.match(await opening(page, 'empire').locator('.ux-opening-complete').innerText(), /Journey complete/);\n    assert.deepEqual(mutations, ['/v1/crimes/pick', '/v1/assets/beater/buy']);\n    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'The real opening journey fits a 390px phone.');\n    await openDetails(opening(page, 'empire'));\n    await opening(page, 'empire').scrollIntoViewIfNeeded();\n    await page.screenshot({ path: path.join(artifacts, 'opening-complete-mobile.png'), fullPage: false });\n    await opening(page, 'empire').screenshot({ path: path.join(artifacts, 'opening-complete-panel.png') });\n",
          "baseline": "    assert.match(await opening(page, 'empire').locator('.ux-opening-complete').innerText(), /Journey complete/);\n    assert.deepEqual(mutations, ['/v1/crimes/pick', '/v1/assets/beater/buy']);\n    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'The real opening journey fits a 390px phone.');\n    await opening(page, 'empire').scrollIntoViewIfNeeded();\n    await page.screenshot({ path: path.join(artifacts, 'opening-complete-mobile.png'), fullPage: false });\n    await opening(page, 'empire').screenshot({ path: path.join(artifacts, 'opening-complete-panel.png') });\n"
        }
      ]
    },
    "test/player-intel-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "655d4ed46e5b0ef101a4a1b0e9d3ef7d09adca9e",
        "sha256": "24073ba6a79a28c148e84df670592db28916ae90066f28e635d1326fb7385f72",
        "bytes": 8820
      },
      "baseline": {
        "mode": "100644",
        "blob": "9f31fb5fccd1dc1a0bf099e073fc8e46793e99a2",
        "sha256": "d2afc0551a651f27bc00aad376c62ad08d1b62bb25a25802c6fe5bcb45d87077",
        "bytes": 8557
      },
      "inverses": [
        {
          "at": 3713,
          "current": "  return page;\n};\nconst wetWork = async (page) => {\n  const directory = page.locator('#city-directory');\n  if (!await directory.evaluate(node => node.open)) await directory.locator(':scope > summary').click();\n  await page.locator('#grouprail [data-group=\"blood\"]').click();\n  if (!await directory.evaluate(node => node.open)) await directory.locator(':scope > summary').click();\n  await page.locator('#tabs [data-tab=\"pvp\"]').click();\n  await page.locator('#tab-pvp h2').filter({ hasText: 'People you know' }).waitFor();\n};\n",
          "baseline": "  return page;\n};\nconst wetWork = async (page) => {\n  await page.locator('#grouprail [data-group=\"blood\"]').click();\n  await page.locator('#tabs [data-tab=\"pvp\"]').click();\n  await page.locator('#tab-pvp h2').filter({ hasText: 'People you know' }).waitFor();\n};\n"
        }
      ]
    },
    "test/quest-experience-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "0eaf437ea7bbb7cb2954e1e10910832cf7e4d64b",
        "sha256": "0cee33effbeb473a18960e4c5dcc72b896748fa6695968605de3453d5525f7cc",
        "bytes": 34736
      },
      "baseline": {
        "mode": "100644",
        "blob": "b72ec8946c2e0d54ed1616e53f93c1148e23d868",
        "sha256": "38453a9487242b44d8bf3e3d06f39f00fbc26520939afd85f7b12aa259f90110",
        "bytes": 32695
      },
      "inverses": [
        {
          "at": 10210,
          "current": "  }\n  await page.getByRole('button', { name: 'The family hiding below the pier', exact: true }).click();\n  await page.getByText('Case closed. Your decisions are on the record.', { exact: true }).waitFor();\n  await page.waitForFunction(() => document.querySelector('#ux-quests')?.getAttribute('aria-busy') === 'false');\n  // A refetch may repaint before the browser delivers a details element's deferred toggle event.\n  const disclosureRace = await page.evaluate(async () => {\n    const findTheory = () => [...document.querySelectorAll('#ux-quests details')].find(panel => panel.querySelector(':scope > summary')?.textContent === 'Your working theory');\n    const first = findTheory(), firstToggle = new Promise(resolve => first.addEventListener('toggle', resolve, { once: true }));\n    first.querySelector(':scope > summary').click();\n    questUx.render();\n    const stayedOpen = findTheory().open;\n    await firstToggle;\n    const second = findTheory(), secondToggle = new Promise(resolve => second.addEventListener('toggle', resolve, { once: true }));\n    second.querySelector(':scope > summary').click();\n    questUx.render();\n    const stayedClosed = !findTheory().open;\n    await secondToggle;\n    questUx.render();\n    const remainsClosed = !findTheory().open;\n    const cancelled = findTheory().querySelector(':scope > summary');\n    cancelled.addEventListener('click', event => event.preventDefault(), { once: true });\n    cancelled.click(); questUx.render();\n    return { stayedOpen, stayedClosed, remainsClosed, cancelledClickRemainsClosed: !findTheory().open };\n  });\n  assert.deepEqual(disclosureRace, { stayedOpen: true, stayedClosed: true, remainsClosed: true, cancelledClickRemainsClosed: true }, 'Private-note disclosures retain native open and close choices across a refetch repaint and late detached toggle events.');\n  const theories = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Your working theory' }) }); await disclosure(theories);\n  const theorySummary = theories.locator(':scope > summary');\n  await theorySummary.focus(); await theorySummary.press('Enter');\n  assert.equal(await theories.evaluate(panel => panel.open), false, 'Native keyboard activation closes the disclosure.');\n  await theorySummary.press('Space');\n  assert.equal(await theories.evaluate(panel => panel.open), true, 'Native keyboard activation reopens the disclosure.');\n  await page.getByLabel('Your private working theory', { exact: true }).fill('Only my account should see this <img id=\"quest-xss\">');\n  await page.getByRole('button', { name: 'Save private theory', exact: true }).click();\n  assert.equal(await page.locator('#quest-xss').count(), 0, 'private theories are text, never HTML');\n",
          "baseline": "  }\n  await page.getByRole('button', { name: 'The family hiding below the pier', exact: true }).click();\n  await page.getByText('Case closed. Your decisions are on the record.', { exact: true }).waitFor();\n  const theories = page.locator('details').filter({ has: page.locator('summary', { hasText: 'Your working theory' }) }); await disclosure(theories);\n  await page.getByLabel('Your private working theory', { exact: true }).fill('Only my account should see this <img id=\"quest-xss\">');\n  await page.getByRole('button', { name: 'Save private theory', exact: true }).click();\n  assert.equal(await page.locator('#quest-xss').count(), 0, 'private theories are text, never HTML');\n"
        }
      ]
    },
    "test/quest-quality-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "096674aa0ae82eeea20a447c360fe5b4e87ce2d3",
        "sha256": "509a9b85fc11bf8e2d93ccf0635e3ffd47384f7f79cfb646db558f32f21b5717",
        "bytes": 6642
      },
      "baseline": {
        "mode": "100644",
        "blob": "d58b2951c610f55eeb0581e3dc1e2d0d6aef1f2c",
        "sha256": "4e9f41ce0178a814afb2698fa16b13603e44620403783c2ec2b4d4f6b2da54f5",
        "bytes": 5773
      },
      "inverses": [
        {
          "at": 196,
          "current": "import { execFileSync } from 'node:child_process';\nimport { QUEST_QUALITY_SOURCE as source, qualifyQuestQualitySource,\n  questQualityHistoricalInput, questQualityHistoricalEntry, questQualitySourceDataBytes } from '../tools/quest-quality-source-transfer.js';\nimport { ageRemovalHistoricalRecord } from '../tools/age-removal-source-transfer.js';\n\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });\nconst sha = text => createHash('sha256').update(text).digest('hex');\n",
          "baseline": "import { execFileSync } from 'node:child_process';\nimport { QUEST_QUALITY_SOURCE as source, qualifyQuestQualitySource,\n  questQualityHistoricalInput, questQualityHistoricalEntry, questQualitySourceDataBytes } from '../tools/quest-quality-source-transfer.js';\n\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });\nconst sha = text => createHash('sha256').update(text).digest('hex');\n"
        },
        {
          "at": 2110,
          "current": "assert.deepEqual(Object.keys(source.additions), changed('A').filter(file => /\\.(?:js|json|html|css|sql)$/.test(file)));\nassert.equal(fs.readFileSync(new URL('../tools/quest-quality-source-data.js', import.meta.url), 'utf8').replaceAll('\\r\\n', '\\n'), questQualitySourceDataBytes(source));\nfunction actual(file, pin) {\n  const committed = git('show', 'HEAD:' + file), authored = git('show', source.revision + ':' + file);\n  const stat = fs.lstatSync(file), physical = fs.readFileSync(file); assert(stat.isFile() && !stat.isSymbolicLink());\n  const actualEntry = git('ls-tree', 'HEAD', '--', file).trim();\n  const match = actualEntry.match(/^(100644|100755) blob ([a-f0-9]{40})\\t(.+)$/);\n  assert(match && match[3] === file, 'Actual regular Git source qualifies first');\n  assert.equal(blob(committed), match[2], 'Complete actual source bytes equal the raw HEAD blob');\n  const index = git('ls-files', '--stage', '--', file).trim();\n  assert.equal(index, match[1] + ' ' + match[2] + ' 0\\t' + file);\n  assert(physical.equals(Buffer.from(committed)) || physical.equals(Buffer.from(committed.replaceAll('\\n', '\\r\\n'))));\n  const historical = ageRemovalHistoricalRecord(file, { head: { mode: match[1], blob: match[2] }, index,\n    committed: Buffer.from(committed), physical, regular: stat.isFile(), symbolic: stat.isSymbolicLink() });\n  const text = historical.committed.toString('utf8'), raw = historical.physical;\n  assert.equal(text, authored, 'Independently admitted current source reconstructs the unchanged quality source: ' + file);\n  assert.equal(sha(text), pin.sha256); assert.equal(blob(text), pin.blob); assert.equal(Buffer.byteLength(text), pin.bytes);\n  const entry = pin.mode + ' blob ' + pin.blob + '\\t' + file;\n  assert.deepEqual(historical.head, { mode: pin.mode, blob: pin.blob });\n  assert.equal(historical.index, pin.mode + ' ' + pin.blob + ' 0\\t' + file);\n  return { text, raw, entry };\n}\nlet positives = 0, refusals = 0, inverseControls = 0;\n",
          "baseline": "assert.deepEqual(Object.keys(source.additions), changed('A').filter(file => /\\.(?:js|json|html|css|sql)$/.test(file)));\nassert.equal(fs.readFileSync(new URL('../tools/quest-quality-source-data.js', import.meta.url), 'utf8').replaceAll('\\r\\n', '\\n'), questQualitySourceDataBytes(source));\nfunction actual(file, pin) {\n  const text = git('show', 'HEAD:' + file), authored = git('show', source.revision + ':' + file);\n  assert.equal(text, authored, 'Whole reviewed source remains the actual committed source: ' + file);\n  const stat = fs.lstatSync(file), raw = fs.readFileSync(file); assert(stat.isFile() && !stat.isSymbolicLink());\n  assert(raw.equals(Buffer.from(text)) || raw.equals(Buffer.from(text.replaceAll('\\n', '\\r\\n'))));\n  assert.equal(sha(text), pin.sha256); assert.equal(blob(text), pin.blob); assert.equal(Buffer.byteLength(text), pin.bytes);\n  const entry = pin.mode + ' blob ' + pin.blob + '\\t' + file;\n  assert.equal(git('ls-tree', 'HEAD', '--', file).trim(), entry);\n  assert.equal(git('ls-files', '--stage', '--', file).trim(), pin.mode + ' ' + pin.blob + ' 0\\t' + file);\n  return { text, raw, entry };\n}\nlet positives = 0, refusals = 0, inverseControls = 0;\n"
        }
      ]
    },
    "test/rc1-mobile-postgres.js": {
      "current": {
        "mode": "100644",
        "blob": "8e1560f8e29af439a5624862f8f8f2cbab5f3feb",
        "sha256": "66b47f6db39652750c2dcdab579b3ffd7edf9b632046b332122a79676d7a4901",
        "bytes": 10295
      },
      "baseline": {
        "mode": "100644",
        "blob": "4726e44bfcd9fd9328ff784dccec02a78122413d",
        "sha256": "824568d0670bc671349b6dbdea3c3c43054ba9aabf9e3060fa0c6dd35694df5c",
        "bytes": 10479
      },
      "inverses": [
        {
          "at": 2278,
          "current": "    const page = await context.newPage(); activePage = page; page.on('pageerror', (error) => errors.push(error.message));\n    await page.goto(origin, { waitUntil: 'networkidle' });\n    await page.locator('#btn-guest').click();\n    await page.locator('#screen-create:not(.hidden)').waitFor();\n    await page.locator('#new-name').fill(`RC1 Phone ${viewport.width}`);\n    await page.locator('#btn-create').click();\n",
          "baseline": "    const page = await context.newPage(); activePage = page; page.on('pageerror', (error) => errors.push(error.message));\n    await page.goto(origin, { waitUntil: 'networkidle' });\n    await page.locator('#btn-guest').click();\n    await page.locator('#age-date').fill('1990-01-01');\n    await page.getByRole('dialog', { name: 'Your birth date' }).getByRole('button', { name: 'Continue', exact: true }).click();\n    await page.locator('#screen-create:not(.hidden)').waitFor();\n    await page.locator('#new-name').fill(`RC1 Phone ${viewport.width}`);\n    await page.locator('#btn-create').click();\n"
        }
      ]
    },
    "test/routes.js": {
      "current": {
        "mode": "100644",
        "blob": "0bd8918339dcfec1d56922c7972b2e52d6c25a36",
        "sha256": "ccb596eafed44aae68bbf28bcdb2e17b33a32ab6f03c8034b60820fa07729d9d",
        "bytes": 43248
      },
      "baseline": {
        "mode": "100644",
        "blob": "159f3f7b79dbd45feb97344cbf8ac34befc662a0",
        "sha256": "eb2c69365c643c98f835a7dac1212fd06bc7e83638e949b0087ab34cf0f9b2a2",
        "bytes": 43346
      },
      "inverses": [
        {
          "at": 9258,
          "current": "  'GET /v1/deeds/plate/:tokenId': 'STREET DEEDS — the on-chain deed\\'s block-plate SVG, the ERC-721 tokenURI image a marketplace/crawler fetches with no token; the untrusted street name is escaped (the /v1/art precedent)',\n  'POST /v1/auth/guest': 'an auth entry point — there is no token to present yet',\n  'POST /v1/auth/agent': 'permanent agent admission issues the first bearer without a human age check',\n  'POST /v1/access/redeem': 'launch admission authenticates an unused invite and a durable bootstrap credential before creating or recovering an account',\n  'POST /v1/access/logout': 'clears only the caller browser view cookie and grants no account or gameplay authority',\n  'POST /v1/auth/privy': 'an auth entry point — there is no token to present yet',\n",
          "baseline": "  'GET /v1/deeds/plate/:tokenId': 'STREET DEEDS — the on-chain deed\\'s block-plate SVG, the ERC-721 tokenURI image a marketplace/crawler fetches with no token; the untrusted street name is escaped (the /v1/art precedent)',\n  'POST /v1/auth/guest': 'an auth entry point — there is no token to present yet',\n  'POST /v1/auth/agent': 'permanent agent admission issues the first bearer without a human age check',\n  'POST /v1/age-check': 'checks eligibility without saving a birth date before account creation',\n  'POST /v1/access/redeem': 'launch admission authenticates an unused invite and a durable bootstrap credential before creating or recovering an account',\n  'POST /v1/access/logout': 'clears only the caller browser view cookie and grants no account or gameplay authority',\n  'POST /v1/auth/privy': 'an auth entry point — there is no token to present yet',\n"
        }
      ]
    },
    "test/server-fixture.js": {
      "current": {
        "mode": "100644",
        "blob": "0baf22494f6a5138a7973e62de8cc98ebf4daac2",
        "sha256": "418c91a0b19abfb172be6f04f6a8295cea3186f122f3cf031c9fa32afdd7c7c5",
        "bytes": 150
      },
      "baseline": {
        "mode": "100644",
        "blob": "565a699bd4f67a3d248f420a04fe81d41473ae96",
        "sha256": "4d12bb8a43b460e89a93046c31368316e795659879455d9198b5f0b071c478cf",
        "bytes": 1476
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { buildServer as buildRealServer } from '../src/server.js';\n\nexport async function buildServer(...args) {\n  return buildRealServer(...args);\n}\n",
          "baseline": "import { buildServer as buildRealServer } from '../src/server.js';\nimport { adultAuthFixture } from './auth-fixture.js';\n\n// Legacy gameplay suites use synthetic adults. Gate-specific suites import the\n// real server directly, so missing-age and underage assertions remain strict.\nexport async function buildServer(...args) {\n  const app = await buildRealServer(...args);\n  const inject = app.inject.bind(app);\n  app.inject = (options, ...rest) => {\n    if (options && typeof options === 'object') {\n      const method = String(options.method || 'GET').toUpperCase();\n      const url = String(options.url || options.path || '').split('?')[0];\n      const headers = options.headers || {};\n      const emptyJson = options.payload === undefined && Object.entries(headers)\n        .some(([name, value]) => name.toLowerCase() === 'content-type' && String(value).includes('application/json'));\n      if (!emptyJson) {\n        let body = options.payload;\n        const json = typeof body === 'string';\n        let valid = true;\n        if (json) { try { body = JSON.parse(body); } catch { valid = false; } }\n        if (valid && (body === undefined || (body && typeof body === 'object' && !Array.isArray(body) && !Buffer.isBuffer(body)))) {\n          const next = adultAuthFixture(method, url, body);\n          if (next !== body) options = { ...options, payload: json ? JSON.stringify(next) : next };\n        }\n      }\n    }\n    return inject(options, ...rest);\n  };\n  return app;\n}\n"
        }
      ]
    },
    "test/site-basics-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "67b6a544479b7b8117b8dab8532c64171ff68260",
        "sha256": "7b669da70852054c0555441029812beb5d144b65e818f182280da7c0a136558b",
        "bytes": 7461
      },
      "baseline": {
        "mode": "100644",
        "blob": "b47a96027f09c62422eea3cf1bfd14b1c514f32f",
        "sha256": "c0fced0a06476990303e48bfd81777511dc30c5ed288405c276bb94e3ec54583",
        "bytes": 6978
      },
      "inverses": [
        {
          "at": 0,
          "current": "// Actual website Git/index/physical identities qualify before any historical comparison.\nimport './lib/age-removal-source-transfer-proof.js';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport { createHash } from 'node:crypto';\nimport { execFileSync } from 'node:child_process';\nimport { SITE_BASICS_SOURCE as source, qualifySiteBasicsSource,\n  siteBasicsHistoricalInput, siteBasicsHistoricalEntry, siteBasicsSourceDataBytes } from '../tools/site-basics-source-transfer.js';\nimport { ageRemovalHistoricalRecord } from '../tools/age-removal-source-transfer.js';\n\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {\n  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,\n",
          "baseline": "// Actual website Git/index/physical identities qualify before any historical comparison.\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport { createHash } from 'node:crypto';\nimport { execFileSync } from 'node:child_process';\nimport { SITE_BASICS_SOURCE as source, qualifySiteBasicsSource,\n  siteBasicsHistoricalInput, siteBasicsHistoricalEntry, siteBasicsSourceDataBytes } from '../tools/site-basics-source-transfer.js';\n\nconst git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {\n  encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,\n"
        },
        {
          "at": 2498,
          "current": "  siteBasicsSourceDataBytes(source), 'The only self-reference is complete generated data without executable additions');\nlet positives = 0, refusals = 0;\nfunction actual(file, pin) {\n  const actualCommitted = git('show', 'HEAD:' + file), authored = git('show', source.revision + ':' + file);\n  const stat = fs.lstatSync(file), physical = fs.readFileSync(file);\n  assert(stat.isFile() && !stat.isSymbolicLink());\n  assert(physical.equals(Buffer.from(actualCommitted)) || physical.equals(Buffer.from(actualCommitted.replaceAll('\\n', '\\r\\n'))),\n    'Actual whole committed and physical source qualify before historical comparison: ' + file);\n  const actualBlob = createHash('sha1').update('blob ' + Buffer.byteLength(actualCommitted) + '\\0').update(actualCommitted).digest('hex');\n  const actualMode = git('ls-tree', 'HEAD', '--', file).trim().split(' ')[0];\n  const actualIndex = git('ls-files', '--stage', '--', file).trim();\n  assert.equal(actualIndex, actualMode + ' ' + actualBlob + ' 0\\t' + file);\n  const historical = ageRemovalHistoricalRecord(file, { head: { mode: actualMode, blob: actualBlob }, index: actualIndex,\n    committed: Buffer.from(actualCommitted), physical, regular: stat.isFile(), symbolic: stat.isSymbolicLink() });\n  const committed = historical.committed.toString('utf8');\n  assert.equal(historical.head.mode, pin.mode); assert.equal(historical.head.blob, pin.blob);\n  const text = committed, raw = historical.physical;\n  assert.equal(text, authored, 'Whole authored source remains the actual committed source: ' + file);\n  assert.equal(sha(text), pin.sha256); assert.equal(Buffer.byteLength(text), pin.bytes);\n  const entry = pin.mode + ' blob ' + pin.blob + '\\t' + file;\n  assert.equal(historical.index, pin.mode + ' ' + pin.blob + ' 0\\t' + file);\n  assert(raw.equals(Buffer.from(text)) || raw.equals(Buffer.from(text.replaceAll('\\n', '\\r\\n'))),\n    'Complete physical UTF-8 source is uniformly LF/CRLF: ' + file);\n  return { text, raw, entry };\n",
          "baseline": "  siteBasicsSourceDataBytes(source), 'The only self-reference is complete generated data without executable additions');\nlet positives = 0, refusals = 0;\nfunction actual(file, pin) {\n  const committed = git('show', 'HEAD:' + file), authored = git('show', source.revision + ':' + file);\n  const stat = fs.lstatSync(file), physical = fs.readFileSync(file);\n  assert(stat.isFile() && !stat.isSymbolicLink());\n  assert(physical.equals(Buffer.from(committed)) || physical.equals(Buffer.from(committed.replaceAll('\\n', '\\r\\n'))),\n    'Actual whole committed and physical source qualify before historical comparison: ' + file);\n  const actualBlob = createHash('sha1').update('blob ' + Buffer.byteLength(committed) + '\\0').update(committed).digest('hex');\n  assert.equal(git('ls-tree', 'HEAD', '--', file).trim(), pin.mode + ' blob ' + actualBlob + '\\t' + file);\n  assert.equal(git('ls-files', '--stage', '--', file).trim(), pin.mode + ' ' + actualBlob + ' 0\\t' + file);\n  const text = committed, raw = physical;\n  assert.equal(text, authored, 'Whole authored source remains the actual committed source: ' + file);\n  assert.equal(sha(text), pin.sha256); assert.equal(Buffer.byteLength(text), pin.bytes);\n  const entry = pin.mode + ' blob ' + pin.blob + '\\t' + file;\n  assert.equal(git('ls-tree', 'HEAD', '--', file).trim(), entry);\n  assert.equal(git('ls-files', '--stage', '--', file).trim(), pin.mode + ' ' + pin.blob + ' 0\\t' + file);\n  assert(raw.equals(Buffer.from(text)) || raw.equals(Buffer.from(text.replaceAll('\\n', '\\r\\n'))),\n    'Complete physical UTF-8 source is uniformly LF/CRLF: ' + file);\n  return { text, raw, entry };\n"
        }
      ]
    },
    "test/site-entry-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "86d198f6e335f939136afd504a47f63877bd7425",
        "sha256": "fd27757c736bd2a4175a90a0842fd114771bb8aad9c8b2c256c33b6bb728045d",
        "bytes": 5789
      },
      "baseline": {
        "mode": "100644",
        "blob": "e6d5dccd8a4093fcc2e78fbd819c8d8477cf51cd",
        "sha256": "d6fd1af7aecd96a8eaded9e542cad5beec22501cda8a183f9de284e76bf542a6",
        "bytes": 6296
      },
      "inverses": [
        {
          "at": 2760,
          "current": "  }\n\n  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });\n  await page.addInitScript(() => sessionStorage.setItem('omerta_age_blocked', '1'));\n  await page.context().addCookies([{\n    name: 'omerta_age', value: app.jwt.sign({ purpose: 'age-check', eligible: false }),\n    url: base, httpOnly: true, sameSite: 'Lax',\n  }]);\n  const faults = [];\n  page.on('pageerror', error => faults.push(error.message));\n  let guestRequests = 0, releaseRequest;\n",
          "baseline": "  }\n\n  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });\n  const faults = [];\n  page.on('pageerror', error => faults.push(error.message));\n  let guestRequests = 0, releaseRequest;\n"
        },
        {
          "at": 3590,
          "current": "  await page.goto(base, { waitUntil: 'domcontentloaded' });\n  const primary = page.locator('#btn-guest');\n  await primary.click();\n  assert.equal(await page.locator('#age-date, input[name=\"birthDate\"]').count(), 0, 'Signup has no age-verification prompt.');\n  await page.waitForFunction(() => document.querySelector('#guest-status').textContent.includes('Opening your street'));\n  assert.equal(await primary.isDisabled(), true, 'The primary signup action stays disabled while waiting.');\n  assert.equal(await page.locator('#btn-guest2').isDisabled(), true, 'The secondary signup action shares the pending state.');\n",
          "baseline": "  await page.goto(base, { waitUntil: 'domcontentloaded' });\n  const primary = page.locator('#btn-guest');\n  await primary.click();\n  await page.locator('#age-date').waitFor();\n  assert.equal(await primary.isDisabled(), true, 'Eligibility checking shares the signup pending state.');\n  await page.evaluate(() => document.querySelector('#btn-guest2').dispatchEvent(new MouseEvent('click', { bubbles: true })));\n  assert.equal(await page.locator('dialog[open] #age-date').count(), 1, 'Repeated activations do not open duplicate eligibility dialogs.');\n  await page.locator('#age-cancel').click();\n  await page.waitForFunction(() => !document.querySelector('#btn-guest').disabled);\n  assert.equal(guestRequests, 0, 'Cancelling eligibility never attempts account creation.');\n  assert.equal(await page.locator('#guest-status').isHidden(), true, 'Cancelling eligibility clears progress feedback.');\n  await primary.click();\n  await page.locator('#age-date').fill('1990-01-01');\n  await page.locator('dialog[open] button[type=\"submit\"]').click();\n  await page.waitForFunction(() => document.querySelector('#guest-status').textContent.includes('Opening your street'));\n  assert.equal(await primary.isDisabled(), true, 'The primary signup action stays disabled while waiting.');\n  assert.equal(await page.locator('#btn-guest2').isDisabled(), true, 'The secondary signup action shares the pending state.');\n"
        },
        {
          "at": 5026,
          "current": "  await page.locator('#screen-create:not(.hidden)').waitFor();\n  await page.waitForFunction(() => !document.querySelector('#btn-guest').disabled);\n  assert.equal(await page.locator('#guest-status').isHidden(), true, 'A successful signup clears progress feedback.');\n  assert.ok(await page.evaluate(() => localStorage.getItem('omerta_token')), 'Signup ignores legacy age-denial state and preserves the session before character creation.');\n  assert.deepEqual(faults, [], 'Signup produces no browser exceptions.');\n  await page.close();\n  console.log('Site entry: desktop/mobile CTA visibility, image labels, direct signup, progress, duplicate prevention, failure recovery and successful signup passed.');\n} finally { await browser?.close(); await app.close(); }\n",
          "baseline": "  await page.locator('#screen-create:not(.hidden)').waitFor();\n  await page.waitForFunction(() => !document.querySelector('#btn-guest').disabled);\n  assert.equal(await page.locator('#guest-status').isHidden(), true, 'A successful signup clears progress feedback.');\n  assert.ok(await page.evaluate(() => localStorage.getItem('omerta_token')), 'Signup preserves the session before opening character creation.');\n  assert.deepEqual(faults, [], 'Signup produces no browser exceptions.');\n  await page.close();\n  console.log('Site entry: desktop/mobile CTA visibility, image labels, eligibility cancellation, signup progress, duplicate prevention, failure recovery and successful signup passed.');\n} finally { await browser?.close(); await app.close(); }\n"
        }
      ]
    },
    "test/ux-community-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "bc9285451b8c3ca9cb6e5a5a6136b41c6c4b2966",
        "sha256": "47a9419a3e51afc8ea8dedbb132ce8a200a32b02d4be5e89e8812ce8f6ce6674",
        "bytes": 29656
      },
      "baseline": {
        "mode": "100644",
        "blob": "d94ad5b89ae6f7ebc6857a8e07289d0cf5d73a59",
        "sha256": "b116725c5683eb044a1b51cc0d2cd33ac72fc656d197c19699e91a4470d91db7",
        "bytes": 29507
      },
      "inverses": [
        {
          "at": 93,
          "current": "import path from 'node:path';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\nimport { revealOptional } from './lib/ux-disclosure-browser.js';\nimport { MENTOR } from '../src/rules.js';\n\nif (process.env.DATABASE_URL) throw new Error('Community browser checks require disposable pg-mem.');\n",
          "baseline": "import path from 'node:path';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\nimport { MENTOR } from '../src/rules.js';\n\nif (process.env.DATABASE_URL) throw new Error('Community browser checks require disposable pg-mem.');\n"
        },
        {
          "at": 1172,
          "current": "const create = async (name) => { const { token } = await api('POST', '/v1/auth/guest'); await api('POST', '/v1/character', token, { name }); return { token, ch: (await pool.query('SELECT * FROM characters WHERE name=$1', [name])).rows[0] }; };\nconst ready = (page) => page.waitForFunction(() => !document.querySelector('#operation-desk[aria-busy=true]'));\nconst openTab = async (page, tab) => { await page.locator('#btn-jump').click(); await page.locator('#jump-q').fill(tab); await page.locator(`#jump-list [data-jump=\"${tab}\"]`).click(); await page.locator(`#tab-${tab}.on`).waitFor(); };\nconst openForm = async (page, type, subject = '') => { const f = page.locator(`form[data-community-form=\"${type}\"][data-subject=\"${subject}\"]`); await revealOptional(f); for (const parent of await f.locator('xpath=ancestor::details').all()) if (!await parent.evaluate((n) => n.open)) await parent.locator(':scope > summary').click(); return f; };\nconst submit = async (page, type, values, subject = '', expected = 200) => {\n const f = await openForm(page, type, subject);\n for (const [name, value] of Object.entries(values)) {\n",
          "baseline": "const create = async (name) => { const { token } = await api('POST', '/v1/auth/guest'); await api('POST', '/v1/character', token, { name }); return { token, ch: (await pool.query('SELECT * FROM characters WHERE name=$1', [name])).rows[0] }; };\nconst ready = (page) => page.waitForFunction(() => !document.querySelector('#operation-desk[aria-busy=true]'));\nconst openTab = async (page, tab) => { await page.locator('#btn-jump').click(); await page.locator('#jump-q').fill(tab); await page.locator(`#jump-list [data-jump=\"${tab}\"]`).click(); await page.locator(`#tab-${tab}.on`).waitFor(); };\nconst openForm = async (page, type, subject = '') => { const f = page.locator(`form[data-community-form=\"${type}\"][data-subject=\"${subject}\"]`); for (const parent of await f.locator('xpath=ancestor::details').all()) if (!await parent.evaluate((n) => n.open)) await parent.locator(':scope > summary').click(); return f; };\nconst submit = async (page, type, values, subject = '', expected = 200) => {\n const f = await openForm(page, type, subject);\n for (const [name, value] of Object.entries(values)) {\n"
        },
        {
          "at": 6359,
          "current": "  const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'warning' && /UI .*unavailable/.test(m.text())) errors.push(m.text()); });\n  await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor();\n  await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach((n) => n.classList.add('hidden')));\n  await openTab(page, 'crew'); await revealOptional(page.locator('#ux-community')); if (noCrew) await page.locator('#ux-community [data-community-empty]').waitFor(); else await page.locator('#crew-room').waitFor(); await page.locator('#ux-community h3').waitFor(); return page;\n };\n const newcomer = await create('Culture Newcomer'), newcomerPage = await authenticate(newcomer, true);\n const newcomerRead = newcomerPage.waitForResponse((r) => r.url().endsWith(route) && r.request().method() === 'GET'); await newcomerPage.locator('[data-community-refresh]').click();\n",
          "baseline": "  const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'warning' && /UI .*unavailable/.test(m.text())) errors.push(m.text()); });\n  await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor();\n  await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach((n) => n.classList.add('hidden')));\n  await openTab(page, 'crew'); if (noCrew) await page.locator('#ux-community [data-community-empty]').waitFor(); else await page.locator('#crew-room').waitFor(); await page.locator('#ux-community h3').waitFor(); return page;\n };\n const newcomer = await create('Culture Newcomer'), newcomerPage = await authenticate(newcomer, true);\n const newcomerRead = newcomerPage.waitForResponse((r) => r.url().endsWith(route) && r.request().method() === 'GET'); await newcomerPage.locator('[data-community-refresh]').click();\n"
        },
        {
          "at": 14395,
          "current": " await page.waitForFunction(() => document.querySelector('form[data-community-form=manual] [name=body0]')?.value === 'A newer revision from the crew.');\n await page.locator('#ux-community details').filter({ has: page.locator(':scope > summary', { hasText: 'Crew map planning pins' }) }).first().locator(':scope > summary').click();\n await submit(page, 'pin', { title: 'Meet by the public canal', destinationId: 'canal', note: 'A crew planning destination, not a player sighting.', spoiler: false });\n await page.locator('[data-community-map]').click(); await revealOptional(page.locator('#ux-community-pins'));\n assert.match(await page.locator('#ux-community-pins').innerText(), /Meet by the public canal/);\n await page.setViewportSize({ width: 390, height: 844 });\n assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));\n",
          "baseline": " await page.waitForFunction(() => document.querySelector('form[data-community-form=manual] [name=body0]')?.value === 'A newer revision from the crew.');\n await page.locator('#ux-community details').filter({ has: page.locator(':scope > summary', { hasText: 'Crew map planning pins' }) }).first().locator(':scope > summary').click();\n await submit(page, 'pin', { title: 'Meet by the public canal', destinationId: 'canal', note: 'A crew planning destination, not a player sighting.', spoiler: false });\n await page.locator('[data-community-map]').click(); await page.locator('#ux-community-pins').waitFor();\n assert.match(await page.locator('#ux-community-pins').innerText(), /Meet by the public canal/);\n await page.setViewportSize({ width: 390, height: 844 });\n assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));\n"
        }
      ]
    },
    "test/ux-coordination-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "6ddae0f717a85e3cf4db8745d0e97a7e9617f4ee",
        "sha256": "eb79dd4c1a991b63423a14a240ac89e44d3a2480b476519015130cb3f0e2e428",
        "bytes": 23285
      },
      "baseline": {
        "mode": "100644",
        "blob": "4cdf1530f4ef5dd7871358ee44c490f91ef4c167",
        "sha256": "dcd38c02c1f5e558acd11d09bea95f52ab0da7ee335fcbd7c3a06013261122d0",
        "bytes": 23164
      },
      "inverses": [
        {
          "at": 93,
          "current": "import path from 'node:path';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\nimport { revealOptional } from './lib/ux-disclosure-browser.js';\n\nif (process.env.DATABASE_URL) throw new Error('Crew planning browser tests require disposable pg-mem.');\nconst executablePath = process.env.CHROMIUM_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));\n",
          "baseline": "import path from 'node:path';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\n\nif (process.env.DATABASE_URL) throw new Error('Crew planning browser tests require disposable pg-mem.');\nconst executablePath = process.env.CHROMIUM_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));\n"
        },
        {
          "at": 1502,
          "current": "  const refreshed = member ? page.waitForResponse((response) => new URL(response.url()).pathname === '/v1/crew/chat' && response.request().method() === 'GET') : null;\n  await page.locator('#btn-jump').click(); await page.locator('#jump-q').fill('crew'); await page.locator('#jump-list [data-jump=\"crew\"]').click();\n  if (refreshed) await (await refreshed).finished();\n  await page.locator(member ? '#crew-room' : '#crew-form').waitFor(); await revealOptional(page.locator('#ux-coordination')); await page.locator(member ? '#ux-coordination [data-coord-scope]' : '#ux-coordination [data-coord-join]').waitFor();\n};\nconst ready = (page) => page.waitForFunction(() => !document.querySelector('#operation-desk[aria-busy=true]'));\nconst submit = async (page, type, values) => {\n",
          "baseline": "  const refreshed = member ? page.waitForResponse((response) => new URL(response.url()).pathname === '/v1/crew/chat' && response.request().method() === 'GET') : null;\n  await page.locator('#btn-jump').click(); await page.locator('#jump-q').fill('crew'); await page.locator('#jump-list [data-jump=\"crew\"]').click();\n  if (refreshed) await (await refreshed).finished();\n  await page.locator(member ? '#crew-room' : '#crew-form').waitFor(); await page.locator(member ? '#ux-coordination [data-coord-scope]' : '#ux-coordination [data-coord-join]').waitFor();\n};\nconst ready = (page) => page.waitForFunction(() => !document.querySelector('#operation-desk[aria-busy=true]'));\nconst submit = async (page, type, values) => {\n"
        }
      ]
    },
    "test/ux-expanded-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "1ca17c4caea63daee8c1817113f6ae87c6062491",
        "sha256": "41a2d2899fe5bae4bc5663407c7f542fb51535fb190ec60c9e0be987ed3c2040",
        "bytes": 24004
      },
      "baseline": {
        "mode": "100644",
        "blob": "8b2a02b7724aacad6c073a6828c17444a875be0e",
        "sha256": "89b2f4eca2d592e2c11349e5e331ca3d394913cada5d84f7d88fa077a81a8540",
        "bytes": 23367
      },
      "inverses": [
        {
          "at": 218,
          "current": "import { randomUUID } from 'node:crypto';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\nimport { revealOptional } from './lib/ux-disclosure-browser.js';\nimport { MEGAPROJECT } from '../src/rules.js';\nimport { recordEventResult } from '../src/events.js';\nassert(!process.env.DATABASE_URL, 'Expanded UX browser checks require disposable pg-mem.');\n",
          "baseline": "import { randomUUID } from 'node:crypto';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\nimport { MEGAPROJECT } from '../src/rules.js';\nimport { recordEventResult } from '../src/events.js';\nassert(!process.env.DATABASE_URL, 'Expanded UX browser checks require disposable pg-mem.');\n"
        },
        {
          "at": 8816,
          "current": "\n  await jump(page, 'fieldwork'); await page.locator('.world-fieldwork').waitFor();\n  await page.locator('[data-fieldwork-view=\"mysteries\"]').click();\n  await revealOptional(page.locator('.investigation-reading-desk'));\n  await page.locator('.investigation-workspace').waitFor(); await page.locator('.investigation-speaker').first().waitFor();\n  await page.getByLabel('Pin a found clue', { exact: true }).selectOption('evidence:neighborhood-timing');\n  await page.locator('.investigation-pin').waitFor();\n",
          "baseline": "\n  await jump(page, 'fieldwork'); await page.locator('.world-fieldwork').waitFor();\n  await page.locator('[data-fieldwork-view=\"mysteries\"]').click();\n  await page.locator('.investigation-workspace').waitFor(); await page.locator('.investigation-speaker').first().waitFor();\n  await page.getByLabel('Pin a found clue', { exact: true }).selectOption('evidence:neighborhood-timing');\n  await page.locator('.investigation-pin').waitFor();\n"
        },
        {
          "at": 9637,
          "current": "  await page.locator('dialog.investigation-inspector').getByRole('button', { name: 'Close inspection', exact: true }).click();\n  assert.deepEqual(gameWrites, [], 'opening and arranging the private case does not execute a game action');\n\n  await jump(page, 'crew'); await revealOptional(page.locator('#ux-coordination')); await page.locator('#ux-coordination [data-coord-scope]').waitFor();\n  assert.match(await page.locator('#ux-coordination').innerText(), /Expanded Planning Crew/);\n  const planForm = page.locator('#ux-coordination form[data-coord-form=\"plan\"]'); await disclosure(planForm.locator('..'));\n  await planForm.locator('[name=\"title\"]').fill('Expanded integration plan'); await planForm.locator('[name=\"nextStep\"]').fill('Review the journal together.');\n",
          "baseline": "  await page.locator('dialog.investigation-inspector').getByRole('button', { name: 'Close inspection', exact: true }).click();\n  assert.deepEqual(gameWrites, [], 'opening and arranging the private case does not execute a game action');\n\n  await jump(page, 'crew'); await page.locator('#ux-coordination [data-coord-scope]').waitFor();\n  assert.match(await page.locator('#ux-coordination').innerText(), /Expanded Planning Crew/);\n  const planForm = page.locator('#ux-coordination form[data-coord-form=\"plan\"]'); await disclosure(planForm.locator('..'));\n  await planForm.locator('[name=\"title\"]').fill('Expanded integration plan'); await planForm.locator('[name=\"nextStep\"]').fill('Review the journal together.');\n"
        },
        {
          "at": 10756,
          "current": "  assert.equal((await api('GET', '/v1/ux/crew-workspace', mate.token)).notes.some(note => note.data.title === 'Expanded integration plan'), true, 'the actual teammate sees the saved planning note');\n\n  await jump(page, 'start'); await page.locator('#tab-start .ux-world-panel').waitFor();\n  await jump(page, 'city'); await revealOptional(page.locator('#tab-city .ux-world-panel')); await page.locator('#tab-city .ux-turf-sign').filter({ hasText: 'EXPD' }).waitFor();\n  const liveMap = await api('GET', '/v1/map', player.token), docks = liveMap.districts.find(district => district.id === 'docks');\n  assert.equal(docks.holder.tag, 'EXPD');\n  assert.match(await page.locator('#tab-city .ux-district-scene').filter({ hasText: 'Turf held by EXPD' }).innerText(), /EXPD/);\n",
          "baseline": "  assert.equal((await api('GET', '/v1/ux/crew-workspace', mate.token)).notes.some(note => note.data.title === 'Expanded integration plan'), true, 'the actual teammate sees the saved planning note');\n\n  await jump(page, 'start'); await page.locator('#tab-start .ux-world-panel').waitFor();\n  await jump(page, 'city'); await page.locator('#tab-city .ux-turf-sign').filter({ hasText: 'EXPD' }).waitFor();\n  const liveMap = await api('GET', '/v1/map', player.token), docks = liveMap.districts.find(district => district.id === 'docks');\n  assert.equal(docks.holder.tag, 'EXPD');\n  assert.match(await page.locator('#tab-city .ux-district-scene').filter({ hasText: 'Turf held by EXPD' }).innerText(), /EXPD/);\n"
        },
        {
          "at": 12483,
          "current": "  await headline.locator('[data-world-go=\"boxing\"]').click(); await page.locator('#tab-boxing.on').waitFor();\n\n  await jump(page, 'life'); await page.locator('#tab-life [data-uwgift=\"doc\"]').waitFor();\n  await revealOptional(page.locator('#tab-life .ux-world-panel'));\n  const oldStanding = (await api('GET', '/v1/underworld', player.token)).npcs.find(npc => npc.id === 'doc').standing;\n  const giftResponse = page.waitForResponse(reply => reply.url().endsWith('/v1/underworld/doc/gift') && reply.request().method() === 'POST');\n  const giftBoardSettled = page.waitForResponse(reply => reply.url().endsWith('/v1/season/recap') && reply.status() === 200);\n",
          "baseline": "  await headline.locator('[data-world-go=\"boxing\"]').click(); await page.locator('#tab-boxing.on').waitFor();\n\n  await jump(page, 'life'); await page.locator('#tab-life [data-uwgift=\"doc\"]').waitFor();\n  const oldStanding = (await api('GET', '/v1/underworld', player.token)).npcs.find(npc => npc.id === 'doc').standing;\n  const giftResponse = page.waitForResponse(reply => reply.url().endsWith('/v1/underworld/doc/gift') && reply.request().method() === 'POST');\n  const giftBoardSettled = page.waitForResponse(reply => reply.url().endsWith('/v1/season/recap') && reply.status() === 200);\n"
        },
        {
          "at": 15703,
          "current": "  }, comfortableSize);\n  const largeSize = await largeFont.jsonValue(); await largeFont.dispose();\n  assert.ok(largeSize > comfortableSize, 'large reading mode changes visible typography');\n  await disclosure(page.locator('#city-directory'));\n  await page.locator('[data-ux-focus]').click(); assert.equal(await page.locator('#leftcol').isVisible(), false, 'focus mode visibly removes the side column');\n  assert.match(await page.locator('#ux-focus-vitals').innerText(), /Health.*nerve/);\n  await page.locator('[data-ux-focus]').click(); assert.equal(await page.locator('#leftcol').isVisible(), true);\n",
          "baseline": "  }, comfortableSize);\n  const largeSize = await largeFont.jsonValue(); await largeFont.dispose();\n  assert.ok(largeSize > comfortableSize, 'large reading mode changes visible typography');\n  await page.locator('[data-ux-focus]').click(); assert.equal(await page.locator('#leftcol').isVisible(), false, 'focus mode visibly removes the side column');\n  assert.match(await page.locator('#ux-focus-vitals').innerText(), /Health.*nerve/);\n  await page.locator('[data-ux-focus]').click(); assert.equal(await page.locator('#leftcol').isVisible(), true);\n"
        },
        {
          "at": 17089,
          "current": "  assert.notEqual(await page.evaluate(() => [...originalWorldParent.children].indexOf(originalWorldPanel)), await page.evaluate(() => worldIndex), 'keyboard Up visibly changes panel order');\n  await page.evaluate(() => { window.originalTacticsPanel = document.querySelector('#tab-life > [data-ux-tactics]'); window.originalGiftControl = document.querySelector('#tab-life [data-uwgift=\"doc\"]'); });\n  const orderOfPanels = () => page.evaluate(() => [...document.querySelector('#tab-life').children].filter(node => node.dataset.uxPanel).map(node => node.dataset.uxPanel));\n  await disclosure(page.locator('#tab-life > [data-ux-tactics]'));\n  const beforeDrag = await orderOfPanels();\n  const dragHandle = page.locator('#tab-life > .ux-world-panel > .ux-panel-handle'), targetHandle = page.locator('#tab-life > [data-ux-tactics] > .ux-panel-handle');\n  await dragHandle.dragTo(targetHandle);\n",
          "baseline": "  assert.notEqual(await page.evaluate(() => [...originalWorldParent.children].indexOf(originalWorldPanel)), await page.evaluate(() => worldIndex), 'keyboard Up visibly changes panel order');\n  await page.evaluate(() => { window.originalTacticsPanel = document.querySelector('#tab-life > [data-ux-tactics]'); window.originalGiftControl = document.querySelector('#tab-life [data-uwgift=\"doc\"]'); });\n  const orderOfPanels = () => page.evaluate(() => [...document.querySelector('#tab-life').children].filter(node => node.dataset.uxPanel).map(node => node.dataset.uxPanel));\n  const beforeDrag = await orderOfPanels();\n  const dragHandle = page.locator('#tab-life > .ux-world-panel > .ux-panel-handle'), targetHandle = page.locator('#tab-life > [data-ux-tactics] > .ux-panel-handle');\n  await dragHandle.dragTo(targetHandle);\n"
        },
        {
          "at": 21025,
          "current": "    await fresh.screenshot({ path: path.join(artifacts, 'expanded-fresh-device-failure.png'), fullPage: false }); throw error;\n  }\n  assert.equal(await fresh.locator('select[data-ux-density]').inputValue(), 'large', 'the visible preference control matches the hydrated typography');\n  await jump(fresh, 'fieldwork'); await fresh.locator('[data-fieldwork-view=\"mysteries\"]').click(); await revealOptional(fresh.locator('.investigation-reading-desk')); await fresh.locator('.investigation-pin').waitFor();\n  assert.match(await fresh.locator('.investigation-pin').first().innerText(), /Stopped Workshop Clock/, 'private workspace pins hydrate on a fresh device');\n  const otherPage = await authenticate(other); assert.equal(await otherPage.locator('body').getAttribute('data-ux-density'), 'comfortable');\n  await jump(otherPage, 'crew'); await otherPage.locator('#tab-crew.on').waitFor();\n",
          "baseline": "    await fresh.screenshot({ path: path.join(artifacts, 'expanded-fresh-device-failure.png'), fullPage: false }); throw error;\n  }\n  assert.equal(await fresh.locator('select[data-ux-density]').inputValue(), 'large', 'the visible preference control matches the hydrated typography');\n  await jump(fresh, 'fieldwork'); await fresh.locator('[data-fieldwork-view=\"mysteries\"]').click(); await fresh.locator('.investigation-pin').waitFor();\n  assert.match(await fresh.locator('.investigation-pin').first().innerText(), /Stopped Workshop Clock/, 'private workspace pins hydrate on a fresh device');\n  const otherPage = await authenticate(other); assert.equal(await otherPage.locator('body').getAttribute('data-ux-density'), 'comfortable');\n  await jump(otherPage, 'crew'); await otherPage.locator('#tab-crew.on').waitFor();\n"
        },
        {
          "at": 22078,
          "current": "  assert.equal((await api('GET', '/v1/ux/workspace', other.token)).values.investigation?.['neighborhood-initiation'], undefined, 'private deduction workspace is account-isolated');\n  const mobile = await authenticate(player, true); await mobile.waitForFunction(() => document.body.dataset.uxDensity === 'large');\n  assert.equal(await mobile.locator('select[data-ux-density]').inputValue(), 'large');\n  await jump(mobile, 'fieldwork'); await mobile.locator('[data-fieldwork-view=\"mysteries\"]').click(); await revealOptional(mobile.locator('.investigation-reading-desk')); await mobile.locator('.investigation-workspace').waitFor();\n  await noOverflow(mobile, 'mobile investigation'); await disclosure(mobile.locator('.investigation-scene')); await mobile.locator('.investigation-desk-object').first().click();\n  await mobile.locator('dialog.investigation-inspector[open]').waitFor(); await noOverflow(mobile, 'mobile document dialog');\n  await mobile.screenshot({ path: path.join(artifacts, 'expanded-investigation-mobile.png'), fullPage: false });\n  await mobile.locator('dialog.investigation-inspector').getByRole('button', { name: 'Close inspection', exact: true }).click();\n  await jump(mobile, 'crew'); await revealOptional(mobile.locator('#ux-coordination')); await mobile.locator('#ux-coordination [data-coord-scope]').waitFor(); await noOverflow(mobile, 'mobile crew coordination');\n  await mobile.locator('#ux-coordination').evaluate(node => node.scrollIntoView({ block: 'start' }));\n  await mobile.screenshot({ path: path.join(artifacts, 'expanded-coordination-mobile.png'), fullPage: false });\n  assert.deepEqual(faults, [], 'the actual page has no runtime errors or unavailable UX module warnings');\n",
          "baseline": "  assert.equal((await api('GET', '/v1/ux/workspace', other.token)).values.investigation?.['neighborhood-initiation'], undefined, 'private deduction workspace is account-isolated');\n  const mobile = await authenticate(player, true); await mobile.waitForFunction(() => document.body.dataset.uxDensity === 'large');\n  assert.equal(await mobile.locator('select[data-ux-density]').inputValue(), 'large');\n  await jump(mobile, 'fieldwork'); await mobile.locator('[data-fieldwork-view=\"mysteries\"]').click(); await mobile.locator('.investigation-workspace').waitFor();\n  await noOverflow(mobile, 'mobile investigation'); await disclosure(mobile.locator('.investigation-scene')); await mobile.locator('.investigation-desk-object').first().click();\n  await mobile.locator('dialog.investigation-inspector[open]').waitFor(); await noOverflow(mobile, 'mobile document dialog');\n  await mobile.screenshot({ path: path.join(artifacts, 'expanded-investigation-mobile.png'), fullPage: false });\n  await mobile.locator('dialog.investigation-inspector').getByRole('button', { name: 'Close inspection', exact: true }).click();\n  await jump(mobile, 'crew'); await mobile.locator('#ux-coordination [data-coord-scope]').waitFor(); await noOverflow(mobile, 'mobile crew coordination');\n  await mobile.locator('#ux-coordination').evaluate(node => node.scrollIntoView({ block: 'start' }));\n  await mobile.screenshot({ path: path.join(artifacts, 'expanded-coordination-mobile.png'), fullPage: false });\n  assert.deepEqual(faults, [], 'the actual page has no runtime errors or unavailable UX module warnings');\n"
        }
      ]
    },
    "test/ux-experience-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "9bbbb788912025a9ee869d2598f498633d7167ab",
        "sha256": "c45f3029c5c0493a487aee925fb49c71b1b87fa5a4d48b7e7e3b4d140b67f884",
        "bytes": 13205
      },
      "baseline": {
        "mode": "100644",
        "blob": "2fe0ffd4e38a04ab6100f89fa0dd51e4faa94911",
        "sha256": "b0d83eb587c4bed0f5e0d7b8d6c73657b3bec4ad37ceaa7555062798be6d0c5b",
        "bytes": 12984
      },
      "inverses": [
        {
          "at": 163,
          "current": "import path from 'node:path';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\nimport { revealOptional } from './lib/ux-disclosure-browser.js';\nimport { masteryXpFor } from '../src/rules.js';\n\nif (process.env.DATABASE_URL) throw new Error('UX browser integration requires the disposable in-memory database.');\n",
          "baseline": "import path from 'node:path';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\nimport { masteryXpFor } from '../src/rules.js';\n\nif (process.env.DATABASE_URL) throw new Error('UX browser integration requires the disposable in-memory database.');\n"
        },
        {
          "at": 5594,
          "current": "  await page.locator('[data-ux-search]').waitFor();\n  assert.equal(await page.evaluate(() => ['createOmertaFeedback', 'createOmertaProgression', 'createOmertaSocial', 'createOmertaNavigation'].every((name) => typeof window[name] === 'function')), true);\n  await openTab(page, 'life');\n  await revealOptional(page.locator('#tab-life [data-ux-progression=\"life\"]'));\n  const goal = page.locator('#tab-life select[aria-label=\"Choose your next achievement\"]');\n  await goal.waitFor(); await goal.selectOption('trade:larceny');\n  await openDisclosure(page, '#city-directory');\n  await openDisclosure(page, '#character-sheet');\n  await page.locator('#sheet-body .ux-goal-card strong').filter({ hasText: 'Larceny' }).waitFor();\n  await openTab(page, 'streets');\n",
          "baseline": "  await page.locator('[data-ux-search]').waitFor();\n  assert.equal(await page.evaluate(() => ['createOmertaFeedback', 'createOmertaProgression', 'createOmertaSocial', 'createOmertaNavigation'].every((name) => typeof window[name] === 'function')), true);\n  await openTab(page, 'life');\n  const goal = page.locator('#tab-life select[aria-label=\"Choose your next achievement\"]');\n  await goal.waitFor(); await goal.selectOption('trade:larceny');\n  await openDisclosure(page, '#character-sheet');\n  await page.locator('#sheet-body .ux-goal-card strong').filter({ hasText: 'Larceny' }).waitFor();\n  await openTab(page, 'streets');\n"
        },
        {
          "at": 11324,
          "current": "  });\n  const pocket = await pocketReady.jsonValue();\n  assert.equal(pocket.terms, 1); assert.equal(pocket.rows, 1); assert.equal(pocket.matchingTerms, 1, 'mobile reuses the original action and cost terms once');\n  assert.ok(pocket.bottom <= pocket.barTop + 2 && pocket.z < 20, `mobile action controls remain above bottom navigation and below dialogs: ${JSON.stringify(pocket)}`);\n  await noOverflow(page, 'mobile active operation');\n  await page.screenshot({ path: path.join(artifacts, 'ux-action-mobile.png'), fullPage: false });\n  // Change account in the same browser store: preferences keyed by account cannot carry over.\n",
          "baseline": "  });\n  const pocket = await pocketReady.jsonValue();\n  assert.equal(pocket.terms, 1); assert.equal(pocket.rows, 1); assert.equal(pocket.matchingTerms, 1, 'mobile reuses the original action and cost terms once');\n  assert.ok(pocket.bottom <= pocket.barTop + 2 && pocket.z < 20, 'mobile action controls remain above bottom navigation and below dialogs');\n  await noOverflow(page, 'mobile active operation');\n  await page.screenshot({ path: path.join(artifacts, 'ux-action-mobile.png'), fullPage: false });\n  // Change account in the same browser store: preferences keyed by account cannot carry over.\n"
        }
      ]
    },
    "test/ux-personality-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "7dd7bb0daa5a63b7f1526d46fecb9c2f3ef58b2a",
        "sha256": "4cce1a78c1880457cd8fd05e22c5b7fa6696f8b4bfec9bf3f19072fff8a3e336",
        "bytes": 24568
      },
      "baseline": {
        "mode": "100644",
        "blob": "21c37d24456ec66e11e29586526004e4f491af04",
        "sha256": "56b8971e26089ded94570a62923fe10d1ab824dceacd38e09fb555b027fb9850",
        "bytes": 24266
      },
      "inverses": [
        {
          "at": 220,
          "current": "import { randomUUID } from 'node:crypto';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\nimport { revealOptional } from './lib/ux-disclosure-browser.js';\nimport { masteryXpFor } from '../src/rules.js';\nimport { grantStack, withItemTransaction } from '../src/items.js';\n\n",
          "baseline": "import { randomUUID } from 'node:crypto';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\nimport { masteryXpFor } from '../src/rules.js';\nimport { grantStack, withItemTransaction } from '../src/items.js';\n\n"
        },
        {
          "at": 6930,
          "current": "  page.on('request', request => { if (!request.url().startsWith(base + '/v1/')) return; const url = new URL(request.url()); if (request.method() === 'GET') reads.add(url.pathname); else if (url.pathname !== '/v1/ux/workspace') writes.push(url.pathname); });\n  assert.equal(await page.evaluate(() => ['Workspace', 'Feedback', 'Progression', 'Social', 'Navigation', 'Tactics', 'Investigation', 'Coordination', 'Feel', 'Tools', 'Identity', 'Story', 'Community', 'World'].every(name => typeof window['createOmerta' + name] === 'function')), true, 'all fourteen factories load on the actual page');\n\n  await jump(page, 'profile'); const identity = page.locator('#tab-profile .ux-identity'); await revealOptional(identity);\n  const office = identity.locator('[data-identity-section=\"office\"]'); await disclosure(office); await office.locator('[data-office-add]').selectOption('plant');\n  await office.locator('[data-office-position=\"plant\"]').selectOption('0'); assert.equal(await office.locator('.ux-office-prop').first().getAttribute('data-office-prop'), 'plant');\n  const wardrobe = identity.locator('[data-identity-section=\"wardrobe\"]'); await disclosure(wardrobe); await wardrobe.locator('[data-identity-setting=\"coat\"]').selectOption('wine');\n",
          "baseline": "  page.on('request', request => { if (!request.url().startsWith(base + '/v1/')) return; const url = new URL(request.url()); if (request.method() === 'GET') reads.add(url.pathname); else if (url.pathname !== '/v1/ux/workspace') writes.push(url.pathname); });\n  assert.equal(await page.evaluate(() => ['Workspace', 'Feedback', 'Progression', 'Social', 'Navigation', 'Tactics', 'Investigation', 'Coordination', 'Feel', 'Tools', 'Identity', 'Story', 'Community', 'World'].every(name => typeof window['createOmerta' + name] === 'function')), true, 'all fourteen factories load on the actual page');\n\n  await jump(page, 'profile'); const identity = page.locator('#tab-profile .ux-identity'); await identity.waitFor();\n  const office = identity.locator('[data-identity-section=\"office\"]'); await disclosure(office); await office.locator('[data-office-add]').selectOption('plant');\n  await office.locator('[data-office-position=\"plant\"]').selectOption('0'); assert.equal(await office.locator('.ux-office-prop').first().getAttribute('data-office-prop'), 'plant');\n  const wardrobe = identity.locator('[data-identity-section=\"wardrobe\"]'); await disclosure(wardrobe); await wardrobe.locator('[data-identity-setting=\"coat\"]').selectOption('wine');\n"
        },
        {
          "at": 14037,
          "current": "  await eventuallySaved(alice, values => values.tools?.builds?.some(build => build.name === 'The Patient Reader') && values.tools?.tray?.length);\n\n  await jump(page, 'fieldwork'); await page.locator('[data-fieldwork-view=\"mysteries\"]').click(); await page.locator('[data-fieldwork-mystery=\"property-investigation\"]').click();\n  const story = page.locator('[data-ux-story=\"case\"]'); await revealOptional(story); await story.locator('.story-cold-open').waitFor();\n  assert.equal(await story.locator('[data-story-section^=\"epilogue:\"]').count(), 0, 'active case has no invented ending');\n  await disclosure(story.locator('[data-story-section=\"documents\"]'));\n  assert.equal(await story.locator('[data-story-transcript]').count(), 2, 'active case exposes exactly its two already revealed documents');\n",
          "baseline": "  await eventuallySaved(alice, values => values.tools?.builds?.some(build => build.name === 'The Patient Reader') && values.tools?.tray?.length);\n\n  await jump(page, 'fieldwork'); await page.locator('[data-fieldwork-view=\"mysteries\"]').click(); await page.locator('[data-fieldwork-mystery=\"property-investigation\"]').click();\n  const story = page.locator('[data-ux-story=\"case\"]'); await story.locator('.story-cold-open').waitFor();\n  assert.equal(await story.locator('[data-story-section^=\"epilogue:\"]').count(), 0, 'active case has no invented ending');\n  await disclosure(story.locator('[data-story-section=\"documents\"]'));\n  assert.equal(await story.locator('[data-story-transcript]').count(), 2, 'active case exposes exactly its two already revealed documents');\n"
        },
        {
          "at": 16865,
          "current": "  assert.deepEqual(writes, [], 'identity, Room, inventory planning, builds, history and story annotation execute no gameplay write');\n  assert.deepEqual(await snapshot(alice), gameBefore, 'integrated presentation leaves actual currency, materials, owned car and gameplay stats unchanged');\n\n  await jump(page, 'crew'); const community = page.locator('#ux-community'); await revealOptional(community); await community.locator('h3').waitFor();\n  const threadForm = community.locator('form[data-community-form=\"thread\"]'); await disclosure(threadForm.locator('..'));\n  await threadForm.locator('[name=\"anchor\"]').selectOption('question'); await threadForm.locator('[name=\"title\"]').fill('Compare the corrected dates');\n  await threadForm.locator('[name=\"body\"]').fill('The witness account agrees with the corrected registry.'); await threadForm.locator('[name=\"spoiler\"]').check();\n",
          "baseline": "  assert.deepEqual(writes, [], 'identity, Room, inventory planning, builds, history and story annotation execute no gameplay write');\n  assert.deepEqual(await snapshot(alice), gameBefore, 'integrated presentation leaves actual currency, materials, owned car and gameplay stats unchanged');\n\n  await jump(page, 'crew'); const community = page.locator('#ux-community'); await community.locator('h3').waitFor();\n  const threadForm = community.locator('form[data-community-form=\"thread\"]'); await disclosure(threadForm.locator('..'));\n  await threadForm.locator('[name=\"anchor\"]').selectOption('question'); await threadForm.locator('[name=\"title\"]').fill('Compare the corrected dates');\n  await threadForm.locator('[name=\"body\"]').fill('The witness account agrees with the corrected registry.'); await threadForm.locator('[name=\"spoiler\"]').check();\n"
        },
        {
          "at": 18515,
          "current": "  await pinForm.locator('[name=\"title\"]').fill('Read together by the canal'); await pinForm.locator('[name=\"destinationId\"]').selectOption('canal'); await pinForm.locator('[name=\"note\"]').fill('A public destination for later.');\n  const pinSaved = page.waitForResponse(reply => reply.url().endsWith('/v1/ux/community') && reply.request().method() === 'POST' && reply.status() === 200); await pinForm.locator('button[type=\"submit\"]').click(); await pinSaved;\n  const teammateBoard = await api('GET', '/v1/ux/community', mate); assert.ok(teammateBoard.entries.some(entry => entry.kind === 'thread' && entry.data.title === 'Compare the corrected dates'));\n  await jump(page, 'map'); await revealOptional(page.locator('#ux-community-pins')); assert.match(await page.locator('#ux-community-pins').innerText(), /Read together by the canal/);\n  assert.ok(writes.every(url => url === '/v1/ux/community'), 'only explicitly posted Crew writing leaves the private workspace');\n\n  const teammatePage = await open(mate); await jump(teammatePage, 'crew'); await revealOptional(teammatePage.locator('#ux-community')); const teammateThread = teammatePage.locator('.ux-community-thread').filter({ hasText: 'Compare the corrected dates' }); await teammateThread.waitFor();\n  assert.equal(await teammateThread.locator(':scope > .ux-community-spoiler').evaluate(element => element.open), false);\n  await teammateThread.locator(':scope > .ux-community-spoiler > summary').click(); assert.match(await teammateThread.innerText(), /witness account agrees/);\n\n  const mobile = await open(alice, true); await jump(mobile, 'profile'); const mobileIdentity = mobile.locator('#tab-profile .ux-identity'); await revealOptional(mobileIdentity);\n  const mobileOffice = mobileIdentity.locator('[data-identity-section=\"office\"]'); await disclosure(mobileOffice); await mobileOffice.locator('[data-office-position=\"plant\"]').waitFor();\n  assert.equal(await mobileOffice.locator('.ux-office-prop').first().getAttribute('data-office-prop'), 'plant', 'fresh device hydrates private office arrangement');\n  await disclosure(mobileIdentity.locator('[data-identity-section=\"wardrobe\"]')); assert.equal(await mobileIdentity.locator('[data-identity-setting=\"hat\"]').inputValue(), 'fedora');\n",
          "baseline": "  await pinForm.locator('[name=\"title\"]').fill('Read together by the canal'); await pinForm.locator('[name=\"destinationId\"]').selectOption('canal'); await pinForm.locator('[name=\"note\"]').fill('A public destination for later.');\n  const pinSaved = page.waitForResponse(reply => reply.url().endsWith('/v1/ux/community') && reply.request().method() === 'POST' && reply.status() === 200); await pinForm.locator('button[type=\"submit\"]').click(); await pinSaved;\n  const teammateBoard = await api('GET', '/v1/ux/community', mate); assert.ok(teammateBoard.entries.some(entry => entry.kind === 'thread' && entry.data.title === 'Compare the corrected dates'));\n  await jump(page, 'map'); await page.locator('#ux-community-pins').waitFor(); assert.match(await page.locator('#ux-community-pins').innerText(), /Read together by the canal/);\n  assert.ok(writes.every(url => url === '/v1/ux/community'), 'only explicitly posted Crew writing leaves the private workspace');\n\n  const teammatePage = await open(mate); await jump(teammatePage, 'crew'); const teammateThread = teammatePage.locator('.ux-community-thread').filter({ hasText: 'Compare the corrected dates' }); await teammateThread.waitFor();\n  assert.equal(await teammateThread.locator(':scope > .ux-community-spoiler').evaluate(element => element.open), false);\n  await teammateThread.locator(':scope > .ux-community-spoiler > summary').click(); assert.match(await teammateThread.innerText(), /witness account agrees/);\n\n  const mobile = await open(alice, true); await jump(mobile, 'profile'); const mobileIdentity = mobile.locator('#tab-profile .ux-identity'); await mobileIdentity.waitFor();\n  const mobileOffice = mobileIdentity.locator('[data-identity-section=\"office\"]'); await disclosure(mobileOffice); await mobileOffice.locator('[data-office-position=\"plant\"]').waitFor();\n  assert.equal(await mobileOffice.locator('.ux-office-prop').first().getAttribute('data-office-prop'), 'plant', 'fresh device hydrates private office arrangement');\n  await disclosure(mobileIdentity.locator('[data-identity-section=\"wardrobe\"]')); assert.equal(await mobileIdentity.locator('[data-identity-setting=\"hat\"]').inputValue(), 'fedora');\n"
        },
        {
          "at": 21575,
          "current": "  await mobile.screenshot({ path: path.join(artifacts, 'personality-desk-mobile.png'), fullPage: false }); await mobileDesk.locator('[data-tools-close]').click();\n  await mobile.locator('.ux-screen-tools-close').click();\n  await jump(mobile, 'fieldwork'); await mobile.locator('[data-fieldwork-view=\"mysteries\"]').click(); await mobile.locator('[data-fieldwork-mystery=\"property-investigation\"]').click();\n  const mobileStory = mobile.locator('[data-ux-story=\"case\"]'); await revealOptional(mobileStory); await mobileStory.locator('.story-cold-open').waitFor(); await disclosure(mobileStory.locator('[data-story-section=\"documents\"]'));\n  assert.match(await mobileStory.innerText(), /My private cross-reference/, 'fresh-device story highlights hydrate beside the revealed passage');\n  await mobileStory.getByRole('button', { name: 'Compare two found documents', exact: true }).click(); await noOverflow(mobile, 'mobile story dialog');\n  await mobile.getByRole('button', { name: 'Close story reading', exact: true }).click();\n  await jump(mobile, 'crew'); await revealOptional(mobile.locator('#ux-community')); await mobile.locator('#ux-community h3').waitFor(); await noOverflow(mobile, 'mobile Crew writing');\n  await mobile.screenshot({ path: path.join(artifacts, 'personality-crew-mobile.png'), fullPage: false });\n\n  const stranger = await open(other); await jump(stranger, 'profile'); const strangerIdentity = stranger.locator('#tab-profile .ux-identity'); await revealOptional(strangerIdentity);\n  assert.ok(!(await strangerIdentity.innerText()).includes('The Quiet Reader')); assert.equal(await strangerIdentity.locator('[data-identity-setting=\"hat\"]').inputValue(), 'none');\n  assert.equal((await api('GET', '/v1/ux/workspace', other)).values.identity, undefined); assert.equal((await api('GET', '/v1/ux/workspace', other)).values.story, undefined);\n  await stranger.locator('[data-tools-open]').click(); const strangerDesk = stranger.locator('dialog.ux-tools-dialog[open]'); await strangerDesk.locator('[data-tools-view=\"builds\"]').click(); assert.ok(!(await strangerDesk.innerText()).includes('The Patient Reader')); await strangerDesk.locator('[data-tools-close]').click();\n",
          "baseline": "  await mobile.screenshot({ path: path.join(artifacts, 'personality-desk-mobile.png'), fullPage: false }); await mobileDesk.locator('[data-tools-close]').click();\n  await mobile.locator('.ux-screen-tools-close').click();\n  await jump(mobile, 'fieldwork'); await mobile.locator('[data-fieldwork-view=\"mysteries\"]').click(); await mobile.locator('[data-fieldwork-mystery=\"property-investigation\"]').click();\n  const mobileStory = mobile.locator('[data-ux-story=\"case\"]'); await mobileStory.locator('.story-cold-open').waitFor(); await disclosure(mobileStory.locator('[data-story-section=\"documents\"]'));\n  assert.match(await mobileStory.innerText(), /My private cross-reference/, 'fresh-device story highlights hydrate beside the revealed passage');\n  await mobileStory.getByRole('button', { name: 'Compare two found documents', exact: true }).click(); await noOverflow(mobile, 'mobile story dialog');\n  await mobile.getByRole('button', { name: 'Close story reading', exact: true }).click();\n  await jump(mobile, 'crew'); await mobile.locator('#ux-community h3').waitFor(); await noOverflow(mobile, 'mobile Crew writing');\n  await mobile.screenshot({ path: path.join(artifacts, 'personality-crew-mobile.png'), fullPage: false });\n\n  const stranger = await open(other); await jump(stranger, 'profile'); const strangerIdentity = stranger.locator('#tab-profile .ux-identity'); await strangerIdentity.waitFor();\n  assert.ok(!(await strangerIdentity.innerText()).includes('The Quiet Reader')); assert.equal(await strangerIdentity.locator('[data-identity-setting=\"hat\"]').inputValue(), 'none');\n  assert.equal((await api('GET', '/v1/ux/workspace', other)).values.identity, undefined); assert.equal((await api('GET', '/v1/ux/workspace', other)).values.story, undefined);\n  await stranger.locator('[data-tools-open]').click(); const strangerDesk = stranger.locator('dialog.ux-tools-dialog[open]'); await strangerDesk.locator('[data-tools-view=\"builds\"]').click(); assert.ok(!(await strangerDesk.innerText()).includes('The Patient Reader')); await strangerDesk.locator('[data-tools-close]').click();\n"
        }
      ]
    },
    "test/ux-shell-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "236d6c0b536bcb2d103775a0e0a74e38f4e7d37f",
        "sha256": "408deccd8d2c6ccefd5589e2afcdc7b35ab3330303104f2b85a49d71f5255648",
        "bytes": 13698
      },
      "baseline": {
        "mode": "100644",
        "blob": "95f46d285a0f1ac69202ab7bb6f5f5db4395e8b9",
        "sha256": "4c4bcf0990d2c200d974bb01d9ff4a7254d9cc548a375bd8ddd0aa0105e2177e",
        "bytes": 13338
      },
      "inverses": [
        {
          "at": 1570,
          "current": "  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));\n  assert.ok(size.scroll <= size.width + 2, `${label} overflows: ${JSON.stringify(size)}`);\n}\nasync function openDirectory(page) {\n  if (await page.locator('#city-directory').getAttribute('open') === null)\n    await page.locator('#city-directory > summary').click();\n}\nasync function aboveFold(page, selector, label) {\n  const position = await page.locator(selector).evaluate(element => {\n    const rect = element.getBoundingClientRect();\n",
          "baseline": "  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));\n  assert.ok(size.scroll <= size.width + 2, `${label} overflows: ${JSON.stringify(size)}`);\n}\nasync function aboveFold(page, selector, label) {\n  const position = await page.locator(selector).evaluate(element => {\n    const rect = element.getBoundingClientRect();\n"
        },
        {
          "at": 4033,
          "current": "  assert.equal(await page.locator('#tabpanel #coachwrap').count(), 1, 'next action belongs beside the operation');\n  assert.equal(await page.locator('#game-menu[open]').count(), 0, 'secondary utilities start closed');\n  assert.equal(await page.locator('#ux-screen-tools[open]').count(), 0, 'workspace controls do not precede gameplay by default');\n  assert.equal(await page.locator('#city-directory[open]').count(), 0, 'the complete directory starts collapsed beside the five main destinations');\n  assert.equal(await page.locator('#game-menu #btn-logout').count(), 1, 'account controls remain available in the utility menu');\n  await aboveFold(page, '#tab-start .start-next-card .act', 'desktop first-week action');\n  const onboardingOrder = await page.evaluate(() => {\n",
          "baseline": "  assert.equal(await page.locator('#tabpanel #coachwrap').count(), 1, 'next action belongs beside the operation');\n  assert.equal(await page.locator('#game-menu[open]').count(), 0, 'secondary utilities start closed');\n  assert.equal(await page.locator('#ux-screen-tools[open]').count(), 0, 'workspace controls do not precede gameplay by default');\n  assert.equal(await page.locator('#city-directory[open]').count(), 1, 'desktop navigation remains visible');\n  assert.equal(await page.locator('#game-menu #btn-logout').count(), 1, 'account controls remain available in the utility menu');\n  await aboveFold(page, '#tab-start .start-next-card .act', 'desktop first-week action');\n  const onboardingOrder = await page.evaluate(() => {\n"
        },
        {
          "at": 5455,
          "current": "  await noOverflow(page, 'desktop Start Here');\n  await page.screenshot({ path: path.join(artifacts, 'shell-desktop.png') });\n\n  await openDirectory(page);\n  await page.locator('#city-sidebar #tabs [data-tab=\"start\"]').focus();\n  await page.keyboard.press('ArrowDown');\n  await page.locator('#tab-streets.on').waitFor();\n",
          "baseline": "  await noOverflow(page, 'desktop Start Here');\n  await page.screenshot({ path: path.join(artifacts, 'shell-desktop.png') });\n\n  await page.locator('#city-sidebar #tabs [data-tab=\"start\"]').focus();\n  await page.keyboard.press('ArrowDown');\n  await page.locator('#tab-streets.on').waitFor();\n"
        },
        {
          "at": 5917,
          "current": "    'vertical navigation follows ArrowDown and retains keyboard focus');\n  await openTab(page, 'start');\n  await page.locator('#tab-start .start-next-card').waitFor();\n  await page.locator('#city-directory > summary').click();\n\n  const menu = page.locator('#game-menu > summary');\n  await menu.click();\n",
          "baseline": "    'vertical navigation follows ArrowDown and retains keyboard focus');\n  await openTab(page, 'start');\n  await page.locator('#tab-start .start-next-card').waitFor();\n\n  const menu = page.locator('#game-menu > summary');\n  await menu.click();\n"
        },
        {
          "at": 7982,
          "current": "  // Secondary onboarding remains useful after a live server refresh.\n  await page.locator('#tab-start details[data-sect=\"start-outreach\"] > summary').click();\n  await page.locator('#ref-claim-name').fill('Unsent referral draft');\n  await openDirectory(page);\n  await page.locator('#character-sheet > summary').click();\n  const sheetRefreshed = page.waitForResponse(response => [`${base}/v1/me`, `${base}/v1/projections/player`].includes(response.url()) && response.status() === 200);\n  await page.locator('#btn-refresh').click();\n",
          "baseline": "  // Secondary onboarding remains useful after a live server refresh.\n  await page.locator('#tab-start details[data-sect=\"start-outreach\"] > summary').click();\n  await page.locator('#ref-claim-name').fill('Unsent referral draft');\n  await page.locator('#character-sheet > summary').click();\n  const sheetRefreshed = page.waitForResponse(response => [`${base}/v1/me`, `${base}/v1/projections/player`].includes(response.url()) && response.status() === 200);\n  await page.locator('#btn-refresh').click();\n"
        },
        {
          "at": 9454,
          "current": "  await aboveFold(page, `${standardCrime} >> nth=0`, 'desktop crime action');\n  await noOverflow(page, 'desktop Streets');\n  await page.screenshot({ path: path.join(artifacts, 'shell-streets-desktop.png') });\n  await openDirectory(page);\n  await page.locator('#tabs-more').click();\n  assert.ok(await page.locator('#grouprail [data-group]:visible').count() >= 8, 'the whole city exposes every navigation group');\n  await page.locator('#grouprail [data-group=\"earners\"]').click();\n",
          "baseline": "  await aboveFold(page, `${standardCrime} >> nth=0`, 'desktop crime action');\n  await noOverflow(page, 'desktop Streets');\n  await page.screenshot({ path: path.join(artifacts, 'shell-streets-desktop.png') });\n  await page.locator('#tabs-more').click();\n  assert.ok(await page.locator('#grouprail [data-group]:visible').count() >= 8, 'the whole city exposes every navigation group');\n  await page.locator('#grouprail [data-group=\"earners\"]').click();\n"
        }
      ]
    },
    "test/ux-story-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "c18a719544b330ca844201362117519e735d1a75",
        "sha256": "324fcbf9702af066fddf01854385e4a962e2416da29d5610a4cd6c302222ff4e",
        "bytes": 19014
      },
      "baseline": {
        "mode": "100644",
        "blob": "9ec07b399d2f5751b6b8fcd5e5c8bce775f27af4",
        "sha256": "713dd4e4196205c0c772a963d0919165165c43301672f0c8ec5c16a7469980d0",
        "bytes": 18835
      },
      "inverses": [
        {
          "at": 123,
          "current": "import { randomUUID } from 'node:crypto';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\nimport { revealOptional } from './lib/ux-disclosure-browser.js';\n\nassert(!process.env.DATABASE_URL, 'Story browser proof uses disposable pg-mem.');\nprocess.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off';\n",
          "baseline": "import { randomUUID } from 'node:crypto';\nimport { chromium } from 'playwright-core';\nimport { buildServer } from './server-fixture.js';\n\nassert(!process.env.DATABASE_URL, 'Story browser proof uses disposable pg-mem.');\nprocess.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off';\n"
        },
        {
          "at": 6087,
          "current": "  page.on('request', request => { if (request.url().startsWith(base + '/v1/') && !['GET', 'HEAD'].includes(request.method()) && !request.url().endsWith('/v1/ux/workspace')) writes.push(new URL(request.url()).pathname); });\n  assert.equal(await page.evaluate(() => typeof createOmertaStory), 'function');\n  await jump(page, 'fieldwork'); await page.locator('[data-fieldwork-view=\"mysteries\"]').click();\n  await page.locator('[data-fieldwork-mystery=\"property-investigation\"]').click(); await revealOptional(page.locator('[data-ux-story=\"case\"]')); await page.locator('[data-ux-story=\"case\"] .story-cold-open').waitFor();\n  const story = page.locator('[data-ux-story=\"case\"]');\n  assert.match(await story.innerText(), /An address on an old cover/);\n  await story.getByRole('button', { name: 'Skip this opening', exact: true }).click();\n  await story.getByRole('button', { name: 'Reread the opening vignette', exact: true }).waitFor();\n  assert.equal(await story.getByRole('heading', { name: 'An address on an old cover', exact: true }).count(), 0);\n  await story.getByRole('button', { name: 'Reread the opening vignette', exact: true }).click();\n  await story.getByRole('heading', { name: 'An address on an old cover', exact: true }).waitFor();\n  await disclosure(story.locator('[data-story-section=\"cast\"]'));\n  await story.locator('.story-cast-node').filter({ hasText: 'Irene Bell' }).click();\n  await page.locator('dialog.story-dialog[open]').waitFor(); assert.match(await page.locator('dialog.story-dialog').innerText(), /AUTHORED RESIDENT SCENE · NPC/);\n",
          "baseline": "  page.on('request', request => { if (request.url().startsWith(base + '/v1/') && !['GET', 'HEAD'].includes(request.method()) && !request.url().endsWith('/v1/ux/workspace')) writes.push(new URL(request.url()).pathname); });\n  assert.equal(await page.evaluate(() => typeof createOmertaStory), 'function');\n  await jump(page, 'fieldwork'); await page.locator('[data-fieldwork-view=\"mysteries\"]').click();\n  await page.locator('[data-fieldwork-mystery=\"property-investigation\"]').click(); await page.locator('[data-ux-story=\"case\"] .story-cold-open').waitFor();\n  const story = page.locator('[data-ux-story=\"case\"]');\n  assert.match(await story.innerText(), /An address on an old cover/);\n  await story.getByRole('button', { name: 'Skip this opening', exact: true }).click();\n  await story.getByRole('button', { name: 'Reread the opening vignette', exact: true }).waitFor();\n  assert.equal(await story.getByText('An address on an old cover', { exact: true }).count(), 0);\n  await story.getByRole('button', { name: 'Reread the opening vignette', exact: true }).click();\n  await story.getByText('An address on an old cover', { exact: true }).waitFor();\n  await disclosure(story.locator('[data-story-section=\"cast\"]'));\n  await story.locator('.story-cast-node').filter({ hasText: 'Irene Bell' }).click();\n  await page.locator('dialog.story-dialog[open]').waitFor(); assert.match(await page.locator('dialog.story-dialog').innerText(), /AUTHORED RESIDENT SCENE · NPC/);\n"
        },
        {
          "at": 10885,
          "current": "  assert.match(await dialog.locator('.story-annotation-note').first().innerText(), /Compare the dates/);\n  await page.screenshot({ path: path.join(artifacts, 'story-documents-desktop.png'), fullPage: false });\n  await page.getByRole('button', { name: 'Close story reading', exact: true }).click();\n  await jump(page, 'profile'); const overview = page.locator('#tab-profile [data-ux-story=\"overview\"]'); await revealOptional(overview);\n  await disclosure(overview.locator('[data-story-section=\"crossover\"]'));\n  assert.match(await overview.locator('[data-story-section=\"crossover\"]').innerText(), /Two files on one newsroom table/);\n  await disclosure(overview.locator('[data-story-section=\"letters\"]')); await disclosure(overview.locator('.story-letter').first());\n",
          "baseline": "  assert.match(await dialog.locator('.story-annotation-note').first().innerText(), /Compare the dates/);\n  await page.screenshot({ path: path.join(artifacts, 'story-documents-desktop.png'), fullPage: false });\n  await page.getByRole('button', { name: 'Close story reading', exact: true }).click();\n  await jump(page, 'profile'); const overview = page.locator('#tab-profile [data-ux-story=\"overview\"]'); await overview.waitFor();\n  await disclosure(overview.locator('[data-story-section=\"crossover\"]'));\n  assert.match(await overview.locator('[data-story-section=\"crossover\"]').innerText(), /Two files on one newsroom table/);\n  await disclosure(overview.locator('[data-story-section=\"letters\"]')); await disclosure(overview.locator('.story-letter').first());\n"
        },
        {
          "at": 12167,
          "current": "  assert.deepEqual(writes, [], 'story scenes, reading, variants, letters, highlights and zoom perform no gameplay write');\n  await page.screenshot({ path: path.join(artifacts, 'story-epilogues-desktop.png'), fullPage: false });\n  const mobile = await open(alice, true); await jump(mobile, 'fieldwork'); await mobile.locator('[data-fieldwork-view=\"mysteries\"]').click();\n  await mobile.locator('[data-fieldwork-mystery=\"property-investigation\"]').click(); const mobileStory = mobile.locator('[data-ux-story=\"case\"]'); await revealOptional(mobileStory);\n  await disclosure(mobileStory.locator('[data-story-section=\"documents\"]'));\n  await mobileStory.getByRole('button', { name: 'Compare two found documents', exact: true }).click(); const mobileDialog = mobile.locator('dialog.story-dialog[open]');\n  await mobileDialog.locator('.story-private-highlight').first().waitFor();\n",
          "baseline": "  assert.deepEqual(writes, [], 'story scenes, reading, variants, letters, highlights and zoom perform no gameplay write');\n  await page.screenshot({ path: path.join(artifacts, 'story-epilogues-desktop.png'), fullPage: false });\n  const mobile = await open(alice, true); await jump(mobile, 'fieldwork'); await mobile.locator('[data-fieldwork-view=\"mysteries\"]').click();\n  await mobile.locator('[data-fieldwork-mystery=\"property-investigation\"]').click(); const mobileStory = mobile.locator('[data-ux-story=\"case\"]'); await mobileStory.waitFor();\n  await disclosure(mobileStory.locator('[data-story-section=\"documents\"]'));\n  await mobileStory.getByRole('button', { name: 'Compare two found documents', exact: true }).click(); const mobileDialog = mobile.locator('dialog.story-dialog[open]');\n  await mobileDialog.locator('.story-private-highlight').first().waitFor();\n"
        },
        {
          "at": 13458,
          "current": "  const dialogRect = await mobileDialog.boundingBox(); assert.ok(dialogRect.x >= 0 && dialogRect.x + dialogRect.width <= 391);\n  await noOverflow(mobile); await mobile.screenshot({ path: path.join(artifacts, 'story-documents-mobile.png'), fullPage: false });\n  await mobile.getByRole('button', { name: 'Close story reading', exact: true }).click();\n  const other = await open(bob); await jump(other, 'profile'); const otherOverview = other.locator('#tab-profile [data-ux-story=\"overview\"]'); await revealOptional(otherOverview);\n  assert.equal(await otherOverview.locator('.story-letter,.story-cast-node,[data-story-section=\"crossover\"]').count(), 0, 'another account has no prior resident cast, milestone letters or crossover');\n  assert.ok(!(await otherOverview.innerText()).includes('Compare the dates'));\n\n",
          "baseline": "  const dialogRect = await mobileDialog.boundingBox(); assert.ok(dialogRect.x >= 0 && dialogRect.x + dialogRect.width <= 391);\n  await noOverflow(mobile); await mobile.screenshot({ path: path.join(artifacts, 'story-documents-mobile.png'), fullPage: false });\n  await mobile.getByRole('button', { name: 'Close story reading', exact: true }).click();\n  const other = await open(bob); await jump(other, 'profile'); const otherOverview = other.locator('#tab-profile [data-ux-story=\"overview\"]'); await otherOverview.waitFor();\n  assert.equal(await otherOverview.locator('.story-letter,.story-cast-node,[data-story-section=\"crossover\"]').count(), 0, 'another account has no prior resident cast, milestone letters or crossover');\n  assert.ok(!(await otherOverview.innerText()).includes('Compare the dates'));\n\n"
        }
      ]
    },
    "test/ux-tactics-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "72794e2eccce4ac43f66d105ba63309009fe8c21",
        "sha256": "85663c4f0dc02e4370d328a0ad5ba4a91e0b6ff668d51d0aa1d8c62241e15210",
        "bytes": 18331
      },
      "baseline": {
        "mode": "100644",
        "blob": "75b4d9f33e26a41dc42f1168678a558c0530d366",
        "sha256": "634e327105dd093cf5f3e657a12106296877f55564d45e5e03c68bc40dc22e59",
        "bytes": 18133
      },
      "inverses": [
        {
          "at": 10215,
          "current": "\n  await openTab(page, 'port');\n  const harbor = tactics(page, 'port');\n  if (!await harbor.evaluate(node => node.open)) await harbor.locator(':scope > summary').click();\n  await harbor.locator('.ux-tactics-view table tbody tr').first().waitFor();\n  assert.match(await harbor.locator('.ux-tactics-view').innerText(), /Clean proceeds/);\n  const costWithoutEscort = await harbor.locator('.ux-tactics-view table tbody tr').first().locator('td').nth(0).innerText();\n",
          "baseline": "\n  await openTab(page, 'port');\n  const harbor = tactics(page, 'port');\n  await harbor.locator('.ux-tactics-view table tbody tr').first().waitFor();\n  assert.match(await harbor.locator('.ux-tactics-view').innerText(), /Clean proceeds/);\n  const costWithoutEscort = await harbor.locator('.ux-tactics-view table tbody tr').first().locator('td').nth(0).innerText();\n"
        },
        {
          "at": 12868,
          "current": "    }\n    // The onboarding landing can visit Home during reload, selecting the default\n    // planning view. Reopen Trials before inspecting the persisted practice run.\n    if (!await table.evaluate(node => node.open)) await table.locator(':scope > summary').click();\n    await table.locator('[data-tactics-view=\"trials\"]').click();\n    await page.waitForFunction(() => document.querySelectorAll('#tab-streets [data-ux-tactics] [data-trial-card]').length === 3);\n  };\n",
          "baseline": "    }\n    // The onboarding landing can visit Home during reload, selecting the default\n    // planning view. Reopen Trials before inspecting the persisted practice run.\n    await table.locator('[data-tactics-view=\"trials\"]').click();\n    await page.waitForFunction(() => document.querySelectorAll('#tab-streets [data-ux-tactics] [data-trial-card]').length === 3);\n  };\n"
        }
      ]
    },
    "tools/agent-alpha.js": {
      "current": {
        "mode": "100644",
        "blob": "59a687d9b7725c6d945f520278b2ca37cd44a278",
        "sha256": "a501ecf510237c626bf1508e757027023e8fdb8cdda0483b9e05df8c71abbc03",
        "bytes": 50695
      },
      "baseline": {
        "mode": "100644",
        "blob": "8312f8ba957922bd22e482512e407fcb4fb80d1a",
        "sha256": "8fee824901abe08d13d61a721f51dab66926770d670926ee3c3d93153f7b6c26",
        "bytes": 50955
      },
      "inverses": [
        {
          "at": 30923,
          "current": "  }\n}\n\nasync function recoverGuestBootstrap({ base, stateStore, session, fetchImpl }) {\n  // Older bootstrap journals retain their original recovery domain and identity.\n  const route = session.bootstrapKind === 'agent' ? '/v1/auth/agent' : '/v1/auth/guest';\n  const guest = await requestJson(fetchImpl, base, route, {\n    method: 'POST',\n    body: {\n      bootstrapSecret: session.bootstrapSecret,\n      ...(session.inviteCode === null ? {} : { inviteCode: session.inviteCode }),\n    },\n  });\n",
          "baseline": "  }\n}\n\nasync function recoverGuestBootstrap({ base, stateStore, session, fetchImpl, birthDate }) {\n  // Older bootstrap journals retain their original recovery domain and identity.\n  const route = session.bootstrapKind === 'agent' ? '/v1/auth/agent' : '/v1/auth/guest';\n  const guest = await requestJson(fetchImpl, base, route, {\n    method: 'POST',\n    body: {\n      bootstrapSecret: session.bootstrapSecret,\n      ...(route === '/v1/auth/guest' && birthDate ? { birthDate } : {}),\n      ...(session.inviteCode === null ? {} : { inviteCode: session.inviteCode }),\n    },\n  });\n"
        },
        {
          "at": 32129,
          "current": "  return acknowledged;\n}\n\nasync function createIdentity({ base, stateStore, name, inviteCode, fetchImpl }) {\n  if (!validName(name)) throw new Error('Explicit creation requires a valid 2-24 character name');\n  const storedInvite = inviteCode ?? null;\n  if (!validInviteCode(storedInvite)) {\n",
          "baseline": "  return acknowledged;\n}\n\nasync function createIdentity({ base, stateStore, name, inviteCode, fetchImpl, birthDate }) {\n  if (!validName(name)) throw new Error('Explicit creation requires a valid 2-24 character name');\n  const storedInvite = inviteCode ?? null;\n  if (!validInviteCode(storedInvite)) {\n"
        },
        {
          "at": 32757,
          "current": "    pending: null,\n  };\n  await writeIdentityState(stateStore, session);\n  session = await recoverGuestBootstrap({ base, stateStore, session, fetchImpl });\n  session = await acknowledgeGuestBootstrap({ base, stateStore, session, fetchImpl });\n\n  const agent = await requestJson(fetchImpl, base, '/v1/auth/agent-key', {\n",
          "baseline": "    pending: null,\n  };\n  await writeIdentityState(stateStore, session);\n  session = await recoverGuestBootstrap({ base, stateStore, session, fetchImpl, birthDate });\n  session = await acknowledgeGuestBootstrap({ base, stateStore, session, fetchImpl });\n\n  const agent = await requestJson(fetchImpl, base, '/v1/auth/agent-key', {\n"
        },
        {
          "at": 33658,
          "current": "  return session;\n}\n\nasync function ensureIdentity({ base, fetchImpl, stateStore, session, requestedName }) {\n  if (session.phase === 'bootstrap') {\n    session = await recoverGuestBootstrap({ base, fetchImpl, stateStore, session });\n  }\n  if (session.phase === 'guest_bootstrap_ack_pending') {\n    session = await acknowledgeGuestBootstrap({ base, fetchImpl, stateStore, session });\n",
          "baseline": "  return session;\n}\n\nasync function ensureIdentity({ base, fetchImpl, stateStore, session, requestedName, birthDate }) {\n  if (session.phase === 'bootstrap') {\n    session = await recoverGuestBootstrap({ base, fetchImpl, stateStore, session, birthDate });\n  }\n  if (session.phase === 'guest_bootstrap_ack_pending') {\n    session = await acknowledgeGuestBootstrap({ base, fetchImpl, stateStore, session });\n"
        },
        {
          "at": 42940,
          "current": "      throw new Error('Agent Alpha session is missing; explicit --create is required');\n    }\n    session = await createIdentity({\n      base, stateStore, name: options.name, inviteCode: options.inviteCode, fetchImpl,\n    });\n  }\n\n",
          "baseline": "      throw new Error('Agent Alpha session is missing; explicit --create is required');\n    }\n    session = await createIdentity({\n      base, stateStore, name: options.name, inviteCode: options.inviteCode, fetchImpl, birthDate: options.birthDate,\n    });\n  }\n\n"
        },
        {
          "at": 43270,
          "current": "  if (session.pending && role !== 'general' && !session.pending.operationId.startsWith(`${role}:`))\n    throw new Error('Resolve the pending operation under its original role before switching to a restricted role');\n  session = await ensureIdentity({\n    base, fetchImpl, stateStore, session, requestedName: options.name,\n  });\n\n  let actions = 0;\n",
          "baseline": "  if (session.pending && role !== 'general' && !session.pending.operationId.startsWith(`${role}:`))\n    throw new Error('Resolve the pending operation under its original role before switching to a restricted role');\n  session = await ensureIdentity({\n    base, fetchImpl, stateStore, session, requestedName: options.name, birthDate: options.birthDate,\n  });\n\n  let actions = 0;\n"
        },
        {
          "at": 49409,
          "current": "    const arg = argv[index];\n    if (arg === '--create') options.create = true;\n    else if (arg === '--name') options.name = argv[++index];\n    else if (arg === '--max-actions') options.maxActions = Number(argv[++index]);\n    else if (arg === '--stop-at-level') options.stopAtLevel = Number(argv[++index]);\n    else if (arg === '--session') options.sessionFile = argv[++index];\n",
          "baseline": "    const arg = argv[index];\n    if (arg === '--create') options.create = true;\n    else if (arg === '--name') options.name = argv[++index];\n    else if (arg === '--birth-date') options.birthDate = argv[++index];\n    else if (arg === '--max-actions') options.maxActions = Number(argv[++index]);\n    else if (arg === '--stop-at-level') options.stopAtLevel = Number(argv[++index]);\n    else if (arg === '--session') options.sessionFile = argv[++index];\n"
        }
      ]
    },
    "tools/mobile.js": {
      "current": {
        "mode": "100644",
        "blob": "68949ad778b3caeb60e446748077dda5e7047acb",
        "sha256": "c4415f67194b74f14529f8ff3e82d389512e75b5e9e553d4e63d16b026d3dc06",
        "bytes": 81744
      },
      "baseline": {
        "mode": "100644",
        "blob": "9a8e31406748ff55f8b325a0b5ed6a3f1febe46e",
        "sha256": "f69783a4e0858f7cfeaba5eb581b59883808150a694bb6e57be93446a29423ab",
        "bytes": 82679
      },
      "inverses": [
        {
          "at": 21209,
          "current": "  await check(page, 'landing', vp);\n\n  await page.click('#btn-guest');\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 15000 });\n  await check(page, 'create', vp);\n\n",
          "baseline": "  await check(page, 'landing', vp);\n\n  await page.click('#btn-guest');\n  await page.waitForSelector('#age-date');\n  await page.fill('#age-date', '1990-01-01');\n  await page.locator('#age-date').evaluate((input) => input.form.requestSubmit());\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 15000 });\n  await check(page, 'create', vp);\n\n"
        },
        {
          "at": 22282,
          "current": "    await page.fill('#jump-q', 'garage');\n    await page.locator('#jump-list [data-jump=\"garage\"]').click();\n    await page.locator('#tab-garage.on').waitFor({ state: 'visible' });\n    // The generic ready coach is optional chrome; its mounted renderer still gates tour setup.\n    await page.locator('#coach').waitFor({ state: 'attached' });\n    await clickDisclosureControl(page, '#btn-help', true);\n    await page.click('#glossary-tour');\n  }\n",
          "baseline": "    await page.fill('#jump-q', 'garage');\n    await page.locator('#jump-list [data-jump=\"garage\"]').click();\n    await page.locator('#tab-garage.on').waitFor({ state: 'visible' });\n    await page.locator('#coach').waitFor({ state: 'visible' });\n    await clickDisclosureControl(page, '#btn-help', true);\n    await page.click('#glossary-tour');\n  }\n"
        },
        {
          "at": 51853,
          "current": "\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Restart Probe');\n  await page.click('#btn-create');\n",
          "baseline": "\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#age-date');\n  await page.fill('#age-date', '1990-01-01');\n  await page.locator('#age-date').evaluate((input) => input.form.requestSubmit());\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Restart Probe');\n  await page.click('#btn-create');\n"
        },
        {
          "at": 58928,
          "current": "  const vp = { w: 375, h: 667 };\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Cooldown Probe');\n  await page.click('#btn-create');\n",
          "baseline": "  const vp = { w: 375, h: 667 };\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#age-date');\n  await page.fill('#age-date', '1990-01-01');\n  await page.locator('#age-date').evaluate((input) => input.form.requestSubmit());\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Cooldown Probe');\n  await page.click('#btn-create');\n"
        },
        {
          "at": 65441,
          "current": "  });\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Deep City Probe');\n  await page.click('#btn-create');\n",
          "baseline": "  });\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#age-date');\n  await page.fill('#age-date', '1990-01-01');\n  await page.locator('#age-date').evaluate((input) => input.form.requestSubmit());\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Deep City Probe');\n  await page.click('#btn-create');\n"
        },
        {
          "at": 69537,
          "current": "  const vp = { w: 375, h: 667 };\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Lockup Probe');\n  await page.click('#btn-create');\n",
          "baseline": "  const vp = { w: 375, h: 667 };\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#age-date');\n  await page.fill('#age-date', '1990-01-01');\n  await page.locator('#age-date').evaluate((input) => input.form.requestSubmit());\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Lockup Probe');\n  await page.click('#btn-create');\n"
        },
        {
          "at": 74967,
          "current": "  page.on('pageerror', (e) => errs.push(String(e).split('\\n')[0]));\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Xss Probe');\n  await page.click('#btn-create');\n",
          "baseline": "  page.on('pageerror', (e) => errs.push(String(e).split('\\n')[0]));\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#age-date');\n  await page.fill('#age-date', '1990-01-01');\n  await page.locator('#age-date').evaluate((input) => input.form.requestSubmit());\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Xss Probe');\n  await page.click('#btn-create');\n"
        }
      ]
    },
    "tools/public-ui.js": {
      "current": {
        "mode": "100644",
        "blob": "a1c1c07219e290a7c7c2584e3e1c7bdb489c5a03",
        "sha256": "9714c29097eb6e7516f67baa00daef628f38e3c7960ff46a93e236a62c1573a6",
        "bytes": 47823
      },
      "baseline": {
        "mode": "100644",
        "blob": "bd71350152904f9520f481c68b656b2f04e10554",
        "sha256": "067ce0daaf80a618fc0d0cd3668f7354d3569f1e6281450a8af1e91102bcaf3b",
        "bytes": 48001
      },
      "inverses": [
        {
          "at": 28390,
          "current": "  reportStage('Guest onboarding and operation receipts');\n  await mobile.goto(BASE, { waitUntil: 'networkidle' });\n  await mobile.click('#btn-guest');\n  await mobile.waitForSelector('#screen-create:not(.hidden)');\n  await mobile.fill('#new-name', 'Intent ' + Math.random().toString(36).slice(2, 8));\n  await mobile.click('#btn-create');\n",
          "baseline": "  reportStage('Guest onboarding and operation receipts');\n  await mobile.goto(BASE, { waitUntil: 'networkidle' });\n  await mobile.click('#btn-guest');\n  await mobile.waitForSelector('#age-date');\n  await mobile.fill('#age-date', '1990-01-01');\n  await mobile.locator('#age-date').evaluate((input) => input.form.requestSubmit());\n  await mobile.waitForSelector('#screen-create:not(.hidden)');\n  await mobile.fill('#new-name', 'Intent ' + Math.random().toString(36).slice(2, 8));\n  await mobile.click('#btn-create');\n"
        }
      ]
    },
    "tools/quest-quality-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "feb72569e59b5d7b4716307a7fe876c4dd09d73f",
        "sha256": "9c3b0784a18eb890f86fd3413037e026936e87c65a7c3b77987ac59f68fd3630",
        "bytes": 4940
      },
      "baseline": {
        "mode": "100644",
        "blob": "72908f02e65daf65309af20a79bb2b978a8d9ff1",
        "sha256": "c056c3b8e2efe22e9ba465393c3a895bbca94929113ddd1ef0fbcad53f9f7fe9",
        "bytes": 4679
      },
      "inverses": [
        {
          "at": 102,
          "current": "import assert from 'node:assert/strict';\nimport { createHash } from 'node:crypto';\nimport { QUEST_QUALITY_SOURCE, QUEST_QUALITY_SOURCE_SHA256 } from './quest-quality-source-data.js';\nimport { ageRemovalHistoricalInput, ageRemovalHistoricalEntry } from './age-removal-source-transfer.js';\n\nexport { QUEST_QUALITY_SOURCE };\nconst sha = text => createHash('sha256').update(text).digest('hex');\n",
          "baseline": "import assert from 'node:assert/strict';\nimport { createHash } from 'node:crypto';\nimport { QUEST_QUALITY_SOURCE, QUEST_QUALITY_SOURCE_SHA256 } from './quest-quality-source-data.js';\n\nexport { QUEST_QUALITY_SOURCE };\nconst sha = text => createHash('sha256').update(text).digest('hex');\n"
        },
        {
          "at": 2384,
          "current": "}\nexport function qualifyQuestQualitySource(file, input) {\n  assert.equal(arguments.length, 2, 'Only the exact file and whole source are accepted');\n  input = ageRemovalHistoricalInput(file, input);\n  definition(); assert(known(file), 'Only explicitly sealed quest quality comparison domains');\n  const current = canonical(input); assert(current, 'Complete uniform LF/CRLF source required');\n  const row = QUEST_QUALITY_SOURCE.files[file]; fingerprint(current.lf, row.current);\n",
          "baseline": "}\nexport function qualifyQuestQualitySource(file, input) {\n  assert.equal(arguments.length, 2, 'Only the exact file and whole source are accepted');\n  definition(); assert(known(file), 'Only explicitly sealed quest quality comparison domains');\n  const current = canonical(input); assert(current, 'Complete uniform LF/CRLF source required');\n  const row = QUEST_QUALITY_SOURCE.files[file]; fingerprint(current.lf, row.current);\n"
        },
        {
          "at": 3855,
          "current": "}\n// Unknown or partial changes remain untouched so immutable downstream qualifiers reject them.\nexport function questQualityHistoricalInput(file, input) {\n  input = ageRemovalHistoricalInput(file, input);\n  if (!known(file)) return input;\n  const current = canonical(input), row = QUEST_QUALITY_SOURCE.files[file];\n  if (!current || sha(current.lf) !== row.current.sha256) return input;\n",
          "baseline": "}\n// Unknown or partial changes remain untouched so immutable downstream qualifiers reject them.\nexport function questQualityHistoricalInput(file, input) {\n  if (!known(file)) return input;\n  const current = canonical(input), row = QUEST_QUALITY_SOURCE.files[file];\n  if (!current || sha(current.lf) !== row.current.sha256) return input;\n"
        },
        {
          "at": 4375,
          "current": "}\nexport function questQualityHistoricalEntry(file, entry, kind) {\n  assert(kind === 'tree' || kind === 'index');\n  entry = ageRemovalHistoricalEntry(file, entry, kind);\n  if (!known(file)) return entry;\n  const row = QUEST_QUALITY_SOURCE.files[file];\n  const format = pin => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\\t' + file\n",
          "baseline": "}\nexport function questQualityHistoricalEntry(file, entry, kind) {\n  assert(kind === 'tree' || kind === 'index');\n  if (!known(file)) return entry;\n  const row = QUEST_QUALITY_SOURCE.files[file];\n  const format = pin => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\\t' + file\n"
        }
      ]
    },
    "tools/rc1-mobile-journeys.js": {
      "current": {
        "mode": "100644",
        "blob": "a91a767b5df6683a3d921a8f3ce86361b4b10ba1",
        "sha256": "82275c5f0af31769829cc33405fa9e30e7e2061891d3e55c55274b8d00fbb6ad",
        "bytes": 22296
      },
      "baseline": {
        "mode": "100644",
        "blob": "1a74b94450828e576dbf7899689a8177b0b0baf6",
        "sha256": "87c2974330be4144fdf8fa6fce3c9b27bd66679f4696b9711caeb6b22ff0822d",
        "bytes": 22484
      },
      "inverses": [
        {
          "at": 7889,
          "current": "    try {\n      await page.goto(origin, { waitUntil: 'networkidle' });\n      await page.locator('#btn-guest').click();\n      await page.waitForSelector('#screen-create:not(.hidden)');\n      await page.locator('#new-name').fill(`RC1 Mobile ${width}`);\n      await page.locator('#btn-create').click();\n",
          "baseline": "    try {\n      await page.goto(origin, { waitUntil: 'networkidle' });\n      await page.locator('#btn-guest').click();\n      await page.locator('#age-date').fill('1990-01-01');\n      await page.getByRole('dialog', { name: 'Your birth date' }).getByRole('button', { name: 'Continue', exact: true }).click();\n      await page.waitForSelector('#screen-create:not(.hidden)');\n      await page.locator('#new-name').fill(`RC1 Mobile ${width}`);\n      await page.locator('#btn-create').click();\n"
        }
      ]
    },
    "tools/site-basics-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "fe7b8a67d914387c751967eceef742e8a38e631d",
        "sha256": "2b870269bb7bd13fb85e7d8868370ae5a6d4295f0856ebb90c3d7bd0884a9ea4",
        "bytes": 4862
      },
      "baseline": {
        "mode": "100644",
        "blob": "abdf165711f425b7cda48479c6c816af1915cca4",
        "sha256": "1b881b6b57056436b0972621c534c611f93ad8ca20a8aae995da58a66283de1c",
        "bytes": 4601
      },
      "inverses": [
        {
          "at": 96,
          "current": "import assert from 'node:assert/strict';\nimport { createHash } from 'node:crypto';\nimport { SITE_BASICS_SOURCE, SITE_BASICS_SOURCE_SHA256 } from './site-basics-source-data.js';\nimport { ageRemovalHistoricalInput, ageRemovalHistoricalEntry } from './age-removal-source-transfer.js';\n\nexport { SITE_BASICS_SOURCE };\nconst sha = text => createHash('sha256').update(text).digest('hex');\n",
          "baseline": "import assert from 'node:assert/strict';\nimport { createHash } from 'node:crypto';\nimport { SITE_BASICS_SOURCE, SITE_BASICS_SOURCE_SHA256 } from './site-basics-source-data.js';\n\nexport { SITE_BASICS_SOURCE };\nconst sha = text => createHash('sha256').update(text).digest('hex');\n"
        },
        {
          "at": 2336,
          "current": "}\nexport function qualifySiteBasicsSource(file, input) {\n  assert.equal(arguments.length, 2, 'Only the exact file and whole source are accepted');\n  input = ageRemovalHistoricalInput(file, input);\n  definition(); assert(known(file), 'Only explicitly sealed website comparison domains');\n  const current = canonical(input); assert(current, 'Complete uniform LF/CRLF source required');\n  const row = SITE_BASICS_SOURCE.files[file]; fingerprint(current.lf, row.current);\n",
          "baseline": "}\nexport function qualifySiteBasicsSource(file, input) {\n  assert.equal(arguments.length, 2, 'Only the exact file and whole source are accepted');\n  definition(); assert(known(file), 'Only explicitly sealed website comparison domains');\n  const current = canonical(input); assert(current, 'Complete uniform LF/CRLF source required');\n  const row = SITE_BASICS_SOURCE.files[file]; fingerprint(current.lf, row.current);\n"
        },
        {
          "at": 3787,
          "current": "}\n// Unknown or partial changes remain untouched so immutable downstream qualifiers reject them.\nexport function siteBasicsHistoricalInput(file, input) {\n  input = ageRemovalHistoricalInput(file, input);\n  if (!known(file)) return input;\n  const current = canonical(input), row = SITE_BASICS_SOURCE.files[file];\n  if (!current || sha(current.lf) !== row.current.sha256) return input;\n",
          "baseline": "}\n// Unknown or partial changes remain untouched so immutable downstream qualifiers reject them.\nexport function siteBasicsHistoricalInput(file, input) {\n  if (!known(file)) return input;\n  const current = canonical(input), row = SITE_BASICS_SOURCE.files[file];\n  if (!current || sha(current.lf) !== row.current.sha256) return input;\n"
        },
        {
          "at": 4301,
          "current": "}\nexport function siteBasicsHistoricalEntry(file, entry, kind) {\n  assert(kind === 'tree' || kind === 'index');\n  entry = ageRemovalHistoricalEntry(file, entry, kind);\n  if (!known(file)) return entry;\n  const row = SITE_BASICS_SOURCE.files[file];\n  const format = pin => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\\t' + file\n",
          "baseline": "}\nexport function siteBasicsHistoricalEntry(file, entry, kind) {\n  assert(kind === 'tree' || kind === 'index');\n  if (!known(file)) return entry;\n  const row = SITE_BASICS_SOURCE.files[file];\n  const format = pin => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\\t' + file\n"
        }
      ]
    }
  },
  "additions": {
    "public/noir-landing.css": {
      "mode": "100644",
      "blob": "fb53d550d414a89528ffb901763d30a38a450d6b",
      "sha256": "36ed37fe7130a44f2695e03922a7dacd002582fb3a22e9caa985f4b74e00a5cd",
      "bytes": 20340
    },
    "public/noir-shell.js": {
      "mode": "100644",
      "blob": "bdacc6bac1d3600a0b31848c419f74bfd86b3c16",
      "sha256": "d4ec0e56299f9ec0bb0ebe8ffed33972ec01760a294bf50a3b1fe7bb31ed4920",
      "bytes": 21281
    },
    "public/noir-ui.css": {
      "mode": "100644",
      "blob": "3c8dcde2e0131ce3fdb8c16a1d8bba28ce0d410d",
      "sha256": "ae496d63542a71ea17dca2f2b316d8b90164b39947579b043e551c3e956d1d49",
      "bytes": 27974
    },
    "public/strategy-command.css": {
      "mode": "100644",
      "blob": "23eb225a4b5d4da932e7ca2f0bd215589d932bde",
      "sha256": "0bce7f13719a83a6a4a363a7ec16b6af089272ff277664a0543784d94fdeb0d4",
      "bytes": 13723
    },
    "public/strategy-command.js": {
      "mode": "100644",
      "blob": "45361252ffe5ff884809979cfc6d98ed921ada6b",
      "sha256": "c78e8e2cd8d5ee8e566efb0b26452624384b8d41c30f21a4354cdb822325c500",
      "bytes": 17672
    },
    "public/vendor/strategy-city-renderer.LICENSE.txt": {
      "mode": "100644",
      "blob": "eb5f126d7a44f8b8851cda126679fcc8991421ce",
      "sha256": "c5ad44f6298e4e1a4b11bbf05824f0925fcf4823e342ce3672fea5f7d1f3aba1",
      "bytes": 1099
    },
    "public/vendor/strategy-city-renderer.js": {
      "mode": "100644",
      "blob": "88320ee1723b52e5e2040c69e9788a8ab416eb4d",
      "sha256": "1ea0be67c40254d36d1c42822728d0c97419677532393485dee3812b21c3dc28",
      "bytes": 594159
    },
    "public/vendor/strategy-city-renderer.js.LEGAL.txt": {
      "mode": "100644",
      "blob": "de8389ba82f9776c641fd271300a4f135396163f",
      "sha256": "cc7cc7e2f53d5db0235ab2226e85fc6e91655161573b39813b41bb00e5919674",
      "bytes": 188
    },
    "test/lib/age-removal-source-transfer-proof.js": {
      "mode": "100644",
      "blob": "914db9dc5a5dd0d848a1da75f667786c30ec067c",
      "sha256": "eba04ba9ee8a53ae55d31cc394b7c88c66948e902ee736b65c82c09c99173d41",
      "bytes": 15106
    },
    "test/lib/ux-disclosure-browser.js": {
      "mode": "100644",
      "blob": "94b5798863ed248086e88370add10e5504f784cf",
      "sha256": "cfb1d45427b37f5bb99bbf3defc6370c9feb1818885d72966286603cbf10a5d4",
      "bytes": 768
    },
    "test/noir-shell-browser.js": {
      "mode": "100644",
      "blob": "841c94cc2dfc49367b64757e178f626ef8378c03",
      "sha256": "626cdced36ba412e492237d97adcac5e1fe5c0eca08342700a233556a666f027",
      "bytes": 8705
    },
    "test/strategy-command-browser.js": {
      "mode": "100644",
      "blob": "d7019399a540e555c73e970ebd5489bd618b23bc",
      "sha256": "20628b023bc0ba02069c6e46cc685fc0d3497d54ee3f74c9b4400948ab88c7c7",
      "bytes": 16507
    },
    "tools/age-removal-source-seal.js": {
      "mode": "100644",
      "blob": "e83d84df6bc6e80b580dc3eefb91e12c6d6b826f",
      "sha256": "bd6bfc74f8dfad3a042c3276076916880e19221895d6b082d38e6c5cedb5286a",
      "bytes": 13844
    },
    "tools/age-removal-source-transfer.js": {
      "mode": "100644",
      "blob": "ea8ecc58f2c9bab35e5c51285df405e89fbfb06c",
      "sha256": "c75fb314eb878ab06faf50e09029f233e6f6a0357f7f8d251bd3e0200f07acce",
      "bytes": 6002
    },
    "tools/build-strategy-city.mjs": {
      "mode": "100644",
      "blob": "1edca21fff85e8709cadb5d4213c37325d17a4bb",
      "sha256": "094f0e1acc75b89f0137ac05cbed376d2da605e9176e43da0f77f62323325749",
      "bytes": 1127
    },
    "tools/strategy-city-scene.mjs": {
      "mode": "100644",
      "blob": "00cefd5b28acbc9c06e174fcd456efe59034ab47",
      "sha256": "11e31e905979ae7d3318c1c23129e729b9c72bd8e22444c5ec152f71492c7863",
      "bytes": 27895
    }
  }
});
export const AGE_REMOVAL_SOURCE_SHA256 = '3ffa26cf8858536202250be4fad5153a48d88aa881f186350bef348fdea37562';
