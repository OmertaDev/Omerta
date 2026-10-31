// Literal source-only bridge for the already-authored age-21 policy commit.
// Runtime and native capture always inspect the actual current files.
const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const AGE21_SOURCE = freeze({
  "version": 1,
  "status": "SEALED",
  "revision": "837f0e45558be03d65b8a4584018c20ff7f69dbc",
  "tree": "d04cdfe7a5bddcce93c95fcb3a8d08c56a269cf9",
  "predecessorRevision": "a24df18ea1a0b57f25df942675dd9fef7415f275",
  "predecessorTree": "71f63dbc85d6f53af047ab93739fa67bb28b4062",
  "phase": "exact-age21-source-transfer-only; no historical runtime, native, migration, financial, activation or deployment clearance",
  "files": {
    "docs/legal-security-setup.md": {
      "current": {
        "mode": "100644",
        "lf": {
          "sha256": "7f7ef866f4c66ab038de8aee878e72a0c9441c1561d07bad2776c09979dc0c0c",
          "blob": "2d3f4be88a6b8d28aa32c2d13a6cd29c62a10f49",
          "bytes": 3753
        },
        "crlf": {
          "sha256": "8ca9c8f010df49779efe1b539fd6ea2e587e41e0a19df2233e9282e205f36f1a",
          "blob": "bfbe0ddead0e0ae19f99fefba34ee8f21598741e",
          "bytes": 3808
        }
      },
      "baseline": {
        "mode": "100644",
        "lf": {
          "sha256": "1ee085c02ccfee108be1295fd05a9963cc5030efb86aaf53c224f008bf20b5ee",
          "blob": "fd4322cc8a9dc6019505295e28327383dba374e5",
          "bytes": 3732
        },
        "crlf": {
          "sha256": "8b3252ad115086759944fdf6d9d69db6163f725ab9b5ed875db6a988c1eda9f5",
          "blob": "6739818b553fd398a03720c5b699c59d2bcf76fe",
          "bytes": 3787
        }
      },
      "contextLines": 3,
      "inverses": [
        {
          "current": "\nNew human/operator account creation requires a neutral birth-date check; REST and MCP\nsignup instructions are in `omerta-mcp/README.md`. Dates are checked transiently, never\nsaved in account records. Visitors under 21, including children, are refused before account creation; the\nprivacy contact provides the path to investigate existing child data.\n\nRLS is enabled on every game-schema table during the PostgreSQL migration, with a\n",
          "baseline": "\nNew human/operator account creation requires a neutral birth-date check; REST and MCP\nsignup instructions are in `omerta-mcp/README.md`. Dates are checked transiently, never\nsaved in account records. Under-13 visitors are refused before account creation; the\nprivacy contact provides the path to investigate existing child data.\n\nRLS is enabled on every game-schema table during the PostgreSQL migration, with a\n"
        }
      ]
    },
    "omerta-mcp/README.md": {
      "current": {
        "mode": "100644",
        "lf": {
          "sha256": "829ab184402a42bf70926dd83520816f345f12ee17fdd13c4a5b26903754583b",
          "blob": "d59cf863e352ca503ca91785934a8c72c9c9a089",
          "bytes": 9225
        },
        "crlf": {
          "sha256": "db7f607dd25f227bb326f32cf86e5fe24d367b04bf453f757a2c7c8df2e3d5c2",
          "blob": "4b64b0e2bd34babc19964bd0abc732ae3938b7eb",
          "bytes": 9399
        }
      },
      "baseline": {
        "mode": "100644",
        "lf": {
          "sha256": "55b281cbbaa5c11b9ca43ba4714903ddb35ddb285503d1b976b802f7ab264a7f",
          "blob": "0864cdfe77fcde98c589cb0f4b6446ebfbf501a8",
          "bytes": 9208
        },
        "crlf": {
          "sha256": "de8399aee090c86596fa71917049a16232932e3daa4190013979300dc11454b2",
          "blob": "2c583d6f7bd37cba39fb61b495d96a9efbbfb13f",
          "bytes": 9382
        }
      },
      "contextLines": 3,
      "inverses": [
        {
          "current": "For a new account, provide your complete birth date to `omerta_start` as\n`birthDate: \"YYYY-MM-DD\"`. The agent must ask for it and never infer or invent it.\nThe server checks eligibility without saving the birth date. Account creation is\nunavailable to users under 21, including children; the privacy page provides help. Returning saved\nsessions do not need the date again.\n\nREST clients can send `birthDate` in a guest/provider signup body, or first POST\n",
          "baseline": "For a new account, provide your complete birth date to `omerta_start` as\n`birthDate: \"YYYY-MM-DD\"`. The agent must ask for it and never infer or invent it.\nThe server checks eligibility without saving the birth date. Account creation is\nunavailable to children under 13; the privacy page provides help. Returning saved\nsessions do not need the date again.\n\nREST clients can send `birthDate` in a guest/provider signup body, or first POST\n"
        },
        {
          "current": "with `--birth-date YYYY-MM-DD` alongside `--create`. The date is sent only for\nsignup eligibility and is never written to its session, bootstrap recovery file,\nor report. Existing committed accounts can recover without the date. Agents must\nask the operator rather than inventing a date; operators under 21 cannot sign up.\n\nThe config file lives at:\n\n",
          "baseline": "with `--birth-date YYYY-MM-DD` alongside `--create`. The date is sent only for\nsignup eligibility and is never written to its session, bootstrap recovery file,\nor report. Existing committed accounts can recover without the date. Agents must\nask the operator rather than inventing a date; operators under 13 cannot sign up.\n\nThe config file lives at:\n\n"
        }
      ]
    },
    "src/age.js": {
      "current": {
        "mode": "100644",
        "lf": {
          "sha256": "b3aea51a8cb6b537fdb45ec2fa44aebeb1a0af39bc248c4e2afaee57eb9cf3dd",
          "blob": "94a8b0e92dbb559e79e4d169ac238eaddafca663",
          "bytes": 2076
        },
        "crlf": {
          "sha256": "f53875b207bb73248c62e933de48b1c76e17a70122931470929b5b3ba19f50b1",
          "blob": "a80989fd29324eec088787a952bcdab6f81d1145",
          "bytes": 2119
        }
      },
      "baseline": {
        "mode": "100644",
        "lf": {
          "sha256": "70aa08ad07eba867d8b4c0fd7ced892e7e1871869c03832295d60ee78331e0ff",
          "blob": "314806666a9f590e4755aa50707d40adcfbde0db",
          "bytes": 1810
        },
        "crlf": {
          "sha256": "ea106e9f0167c8b57e41022345b30f07f0a38f738ddc005cdfd052180e2fe1e6",
          "blob": "7871d07179011d2a54c53368a8953f28eef92d4f",
          "bytes": 1847
        }
      },
      "contextLines": 3,
      "inverses": [
        {
          "current": "// Birth dates are checked in memory and never persisted or included in tokens.\nimport { GameError } from './game.js';\n\nexport const MINIMUM_AGE = 21;\n\nexport function eligibleBirthDate(value, now = new Date()) {\n  if (typeof value !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value))\n    throw new GameError('birth_date', 'Enter a valid complete birth date.');\n",
          "baseline": "// Birth dates are checked in memory and never persisted or included in tokens.\nimport { GameError } from './game.js';\n\nexport function eligibleBirthDate(value, now = new Date()) {\n  if (typeof value !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value))\n    throw new GameError('birth_date', 'Enter a valid complete birth date.');\n"
        },
        {
          "current": "  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value ||\n      date > now || date.getUTCFullYear() < now.getUTCFullYear() - 120)\n    throw new GameError('birth_date', 'Enter a valid complete birth date.');\n  let years = now.getUTCFullYear() - date.getUTCFullYear();\n  if (now.getUTCMonth() < date.getUTCMonth() ||\n      (now.getUTCMonth() === date.getUTCMonth() && now.getUTCDate() < date.getUTCDate())) years--;\n  return years >= MINIMUM_AGE;\n}\n\nexport function ageCookie(token = '', maxAge = 900) {\n",
          "baseline": "  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value ||\n      date > now || date.getUTCFullYear() < now.getUTCFullYear() - 120)\n    throw new GameError('birth_date', 'Enter a valid complete birth date.');\n  const cutoff = new Date(Date.UTC(now.getUTCFullYear() - 13, now.getUTCMonth(), now.getUTCDate()));\n  return date <= cutoff;\n}\n\nexport function ageCookie(token = '', maxAge = 900) {\n"
        },
        {
          "current": "    .find((part) => part.startsWith('omerta_age='))?.slice(11);\n  try {\n    const claims = app.jwt.verify(value);\n    if (claims.purpose !== 'age-check') return null;\n    if (claims.eligible === false) return false;\n    return claims.eligible === true && claims.minimumAge === MINIMUM_AGE ? true : null;\n  } catch { return null; }\n}\n\n",
          "baseline": "    .find((part) => part.startsWith('omerta_age='))?.slice(11);\n  try {\n    const claims = app.jwt.verify(value);\n    return claims.purpose === 'age-check' ? claims.eligible : null;\n  } catch { return null; }\n}\n\n"
        }
      ]
    },
    "src/legal.js": {
      "current": {
        "mode": "100644",
        "lf": {
          "sha256": "a9d8138f0efe8deb268468af19c8c92e82b5401dc9975ab988ddae3a320b487c",
          "blob": "1f9241475697b532c572bdd1ca21e20e4e1f788a",
          "bytes": 13733
        },
        "crlf": {
          "sha256": "a21d130278744f1638fe281d5563adaa07adbe7aa0f8b6376872cac4813545c5",
          "blob": "f3ea71957fd81338e56c1ea63639b354b8653ee3",
          "bytes": 13789
        }
      },
      "baseline": {
        "mode": "100644",
        "lf": {
          "sha256": "5256b7000f23cf4790702157f61b9fbe6924a86e4e566af9db89678e99c077b9",
          "blob": "546de3723af508dd846cdcca1dcd08b167973009",
          "bytes": 13631
        },
        "crlf": {
          "sha256": "3245fbf291b465943f3aa34ca2c29c638289cc8e3e3b8ad6bb2e99d94a2354f3",
          "blob": "2d591ac3d4c1c9571cce804766b9e4c0b6d6d64d",
          "bytes": 13687
        }
      },
      "contextLines": 3,
      "inverses": [
        {
          "current": "  const title = { privacy: 'Privacy policy', terms: 'Payment terms', dmca: 'Copyright notices', resources: 'Scripts, fonts and service providers' }[kind];\n  if (!title) throw new Error('Unknown legal page');\n  const bodies = {\n    privacy: `<p><strong>Last updated: October 31, 2026.</strong> This policy explains what information OMERTÀ collects, how we use it, and the choices available to you when you use the game, website, API or connected-agent features.</p>\n${c.name ? `<p>Operator: ${esc(c.name)}.${c.address ? ` Postal address: ${esc(c.address)}.` : ''}</p>` : ''}\n<h2>Information we collect</h2><ul>\n<li><strong>Account and access information.</strong> Guest account identifiers, authentication-provider identifiers, sign-in records and IP addresses associated with account access. You can start as a guest without providing an email address.</li>\n",
          "baseline": "  const title = { privacy: 'Privacy policy', terms: 'Payment terms', dmca: 'Copyright notices', resources: 'Scripts, fonts and service providers' }[kind];\n  if (!title) throw new Error('Unknown legal page');\n  const bodies = {\n    privacy: `<p><strong>Last updated: October 30, 2026.</strong> This policy explains what information OMERTÀ collects, how we use it, and the choices available to you when you use the game, website, API or connected-agent features.</p>\n${c.name ? `<p>Operator: ${esc(c.name)}.${c.address ? ` Postal address: ${esc(c.address)}.` : ''}</p>` : ''}\n<h2>Information we collect</h2><ul>\n<li><strong>Account and access information.</strong> Guest account identifiers, authentication-provider identifiers, sign-in records and IP addresses associated with account access. You can start as a guest without providing an email address.</li>\n"
        },
        {
          "current": "<h2>When information is shared</h2><p>Hosting and database providers process data needed to run the service. X or Privy handles sign-in when selected. Resend, or the configured email provider, delivers requested emails; your browser's push provider delivers notifications you enable. WalletConnect and blockchain RPC providers support wallet features. See the <a href=\"/resources\">scripts, fonts and service-provider inventory</a>.</p><p>Public game content is shared with its intended audience. Information sent to a third-party AI, identity, wallet or notification provider is also subject to that provider's privacy practices. Providers may process information in a country different from yours. We may disclose information to comply with legal obligations or protect players, investigate misuse and secure the service.</p>\n<h2>How long we keep information</h2><p>We keep information for as long as needed to provide the features you use, maintain game and transaction records, resolve disputes, prevent misuse and meet applicable legal obligations. Retention depends on the type of information and why it is needed. Messages and routine operational records are subject to periodic cleanup; some account, accounting and service-integrity records are retained longer. Provider logs and backups may follow separate retention periods, and backups may retain deleted information until they expire. Public blockchain records remain available independently of OMERTÀ.</p>\n<h2>Your choices and requests</h2><p>You can unsubscribe from a digest using the link in the email or turn it off in Profile. Transaction confirmations are separate from marketing preferences and are emailed where a verified address is available. Disable push notifications in the app or browser and revoke connected-agent access in Consigliere.</p><p>Depending on where you live, you may have rights to request access, correction or deletion of personal information, or to object to certain processing. We may need to verify that a request relates to your account. Some accounting, security or legally required records may need to be retained; deleting an account cannot erase blockchain history.</p>\n<h2>Age eligibility and children</h2><p>OMERTÀ is intended only for users aged 21 and older. We do not accept users under 21, including children. If you provide a birth date for an eligibility check, we use it for that check without retaining the birth date in your account. If you believe someone under 21 has provided personal information, report it through the privacy contact below when available so the operator can investigate, restrict access and handle deletion as appropriate.</p>\n<h2>Privacy contact</h2>${contact ? `<p>For privacy questions, account-data requests or reports involving users under 21, email ${contact}. Do not send account credentials or wallet private keys.</p>` : '<p>A dedicated privacy contact has not yet been published. Operator contact details will appear here when available. Do not post account credentials or sensitive personal information in public chat.</p>'}\n<h2>Changes to this policy</h2><p>We will update this page and its date when our practices change, and provide additional notice or request consent when required.</p>`,\n    terms: `<p>Operator: ${esc(c.name)} · ${esc(c.address)} · ${contact}.</p><section id=\"payments\"><h2>Passes, watches and confirmation</h2><p>Made Man gives you 30 days of access for the displayed $OMR price. Street Wire gives you the displayed tier and duration. Both are prepaid game passes. Buying again extends access, and neither renews automatically. Benefits end when the pass expires unless you buy again.</p><p>Standing Watches automatically spend the displayed $OMR tap price each cycle while the watch is enrolled and eligible. The Wire screen shows the price and interval before enrollment. Select “drop the watch” online to stop future renewals; the tap you already paid for lasts until expiry. You can cancel each watch in the app or with DELETE /v1/wire/watch/:targetId.</p><p>The app confirms purchases immediately. If you have a verified email address, we also queue a transaction confirmation email regardless of your marketing preferences. Keep the confirmation and check your ledger. Wallet transactions and on-chain purchases may have network fees and their own published price. Review each transaction before signing.</p><h2>Refunds and cancellation</h2><p>${esc(c.refunds)}</p><p>Contact ${contact} with the transaction identifier for payment questions or a refund request. These terms do not limit rights provided by applicable law. Cancelling a watch stops future renewals; it does not reverse a cycle you already paid for.</p></section>`,\n    dmca: `<p>${esc(c.name)} hosts player text and other game contributions. Report copyright concerns to the designated agent: ${esc(c.agent)}, ${esc(c.agentAddress)}, telephone ${esc(c.agentPhone)}, <a href=\"mailto:${esc(c.agentEmail)}\">${esc(c.agentEmail)}</a>. Agent registration is available in the <a href=\"https://www.copyright.gov/dmca-directory/\">U.S. Copyright Office directory</a>.</p><h2>Notice of claimed infringement</h2><p>Provide your physical or electronic signature; identify the copyrighted work (or a representative list); identify the allegedly infringing material and its precise location; provide your address, telephone number and email; state your good-faith belief that use is not authorized by the owner, its agent or law; and state that the information is accurate and, under penalty of perjury, that you are authorized to act for the owner.</p><h2>Counter-notice</h2><p>A counter-notice must contain your signature, identify the removed material and its former location, state under penalty of perjury a good-faith belief that removal resulted from mistake or misidentification, and provide your name, address and telephone number. Include consent to the jurisdiction of the federal district court for your address (or, outside the United States, a district where the provider may be found) and acceptance of service from the complainant or its agent.</p><p>The operator reviews notices, handles removal and counter-notices under applicable law, and may terminate access for repeat infringers in appropriate circumstances. Send notices to the agent rather than posting them in public chat.</p>`,\n",
          "baseline": "<h2>When information is shared</h2><p>Hosting and database providers process data needed to run the service. X or Privy handles sign-in when selected. Resend, or the configured email provider, delivers requested emails; your browser's push provider delivers notifications you enable. WalletConnect and blockchain RPC providers support wallet features. See the <a href=\"/resources\">scripts, fonts and service-provider inventory</a>.</p><p>Public game content is shared with its intended audience. Information sent to a third-party AI, identity, wallet or notification provider is also subject to that provider's privacy practices. Providers may process information in a country different from yours. We may disclose information to comply with legal obligations or protect players, investigate misuse and secure the service.</p>\n<h2>How long we keep information</h2><p>We keep information for as long as needed to provide the features you use, maintain game and transaction records, resolve disputes, prevent misuse and meet applicable legal obligations. Retention depends on the type of information and why it is needed. Messages and routine operational records are subject to periodic cleanup; some account, accounting and service-integrity records are retained longer. Provider logs and backups may follow separate retention periods, and backups may retain deleted information until they expire. Public blockchain records remain available independently of OMERTÀ.</p>\n<h2>Your choices and requests</h2><p>You can unsubscribe from a digest using the link in the email or turn it off in Profile. Transaction confirmations are separate from marketing preferences and are emailed where a verified address is available. Disable push notifications in the app or browser and revoke connected-agent access in Consigliere.</p><p>Depending on where you live, you may have rights to request access, correction or deletion of personal information, or to object to certain processing. We may need to verify that a request relates to your account. Some accounting, security or legally required records may need to be retained; deleting an account cannot erase blockchain history.</p>\n<h2>Children</h2><p>OMERTÀ does not accept users under 13. If you provide a birth date for an eligibility check, we use it for that check without retaining the birth date in your account. If you believe a child has provided personal information, report it through the privacy contact below when available so the operator can investigate, restrict access and handle deletion as appropriate.</p>\n<h2>Privacy contact</h2>${contact ? `<p>For privacy questions, account-data requests or reports involving children, email ${contact}. Do not send account credentials or wallet private keys.</p>` : '<p>A dedicated privacy contact has not yet been published. Operator contact details will appear here when available. Do not post account credentials or sensitive personal information in public chat.</p>'}\n<h2>Changes to this policy</h2><p>We will update this page and its date when our practices change, and provide additional notice or request consent when required.</p>`,\n    terms: `<p>Operator: ${esc(c.name)} · ${esc(c.address)} · ${contact}.</p><section id=\"payments\"><h2>Passes, watches and confirmation</h2><p>Made Man gives you 30 days of access for the displayed $OMR price. Street Wire gives you the displayed tier and duration. Both are prepaid game passes. Buying again extends access, and neither renews automatically. Benefits end when the pass expires unless you buy again.</p><p>Standing Watches automatically spend the displayed $OMR tap price each cycle while the watch is enrolled and eligible. The Wire screen shows the price and interval before enrollment. Select “drop the watch” online to stop future renewals; the tap you already paid for lasts until expiry. You can cancel each watch in the app or with DELETE /v1/wire/watch/:targetId.</p><p>The app confirms purchases immediately. If you have a verified email address, we also queue a transaction confirmation email regardless of your marketing preferences. Keep the confirmation and check your ledger. Wallet transactions and on-chain purchases may have network fees and their own published price. Review each transaction before signing.</p><h2>Refunds and cancellation</h2><p>${esc(c.refunds)}</p><p>Contact ${contact} with the transaction identifier for payment questions or a refund request. These terms do not limit rights provided by applicable law. Cancelling a watch stops future renewals; it does not reverse a cycle you already paid for.</p></section>`,\n    dmca: `<p>${esc(c.name)} hosts player text and other game contributions. Report copyright concerns to the designated agent: ${esc(c.agent)}, ${esc(c.agentAddress)}, telephone ${esc(c.agentPhone)}, <a href=\"mailto:${esc(c.agentEmail)}\">${esc(c.agentEmail)}</a>. Agent registration is available in the <a href=\"https://www.copyright.gov/dmca-directory/\">U.S. Copyright Office directory</a>.</p><h2>Notice of claimed infringement</h2><p>Provide your physical or electronic signature; identify the copyrighted work (or a representative list); identify the allegedly infringing material and its precise location; provide your address, telephone number and email; state your good-faith belief that use is not authorized by the owner, its agent or law; and state that the information is accurate and, under penalty of perjury, that you are authorized to act for the owner.</p><h2>Counter-notice</h2><p>A counter-notice must contain your signature, identify the removed material and its former location, state under penalty of perjury a good-faith belief that removal resulted from mistake or misidentification, and provide your name, address and telephone number. Include consent to the jurisdiction of the federal district court for your address (or, outside the United States, a district where the provider may be found) and acceptance of service from the complainant or its agent.</p><p>The operator reviews notices, handles removal and counter-notices under applicable law, and may terminate access for repeat infringers in appropriate circumstances. Send notices to the agent rather than posting them in public chat.</p>`,\n"
        }
      ]
    },
    "src/server.js": {
      "current": {
        "mode": "100644",
        "lf": {
          "sha256": "eae571fecd106622365194b2fd862f54635a9488ea9784d660defa292da28b5a",
          "blob": "9ac86b5b025e3a40f0142f8adf855471e8a21e77",
          "bytes": 303757
        },
        "crlf": {
          "sha256": "4f18eb64548eb03849c77c5ab2379d444f7ce14a7f4c46d653a52f1c05bdfdc1",
          "blob": "0dc001b23d37018517d4467e34f2a3e019a828a6",
          "bytes": 307764
        }
      },
      "baseline": {
        "mode": "100644",
        "lf": {
          "sha256": "f0fba7a89de112aa2c85e61955cd2b36eb6387605f46696ef1290d442d14615e",
          "blob": "98be176eb2d676e3eaa1992da787c76cb15acb00",
          "bytes": 303719
        },
        "crlf": {
          "sha256": "3107103e1e87d5e6dd49403bc21d6863ceb04785d1445a8c98c91608bbeeb7d3",
          "blob": "657c26c0b9cc801fbf7891c12f54924e3454f9ef",
          "bytes": 307726
        }
      },
      "contextLines": 3,
      "inverses": [
        {
          "current": "import crypto from 'node:crypto';\nimport { rescueQuote } from './rescue-quote.js';\nimport { clientIpContextForRequest } from './client-ip.js';\nimport { MINIMUM_AGE, eligibleBirthDate, ageCookie, ageStatus, requireAge } from './age.js';\nimport zlib from 'node:zlib';\nimport { makeDb } from './db.js';\nimport { createCityActivityRegistry, readCityActivityActor, cityOwnerActivityCategory } from './city-activity.js';\n",
          "baseline": "import crypto from 'node:crypto';\nimport { rescueQuote } from './rescue-quote.js';\nimport { clientIpContextForRequest } from './client-ip.js';\nimport { eligibleBirthDate, ageCookie, ageStatus, requireAge } from './age.js';\nimport zlib from 'node:zlib';\nimport { makeDb } from './db.js';\nimport { createCityActivityRegistry, readCityActivityActor, cityOwnerActivityCategory } from './city-activity.js';\n"
        },
        {
          "current": "  app.post('/v1/age-check', async (req, reply) => {\n    reply.header('Cache-Control', 'no-store');\n    const eligible = ageStatus(app, req) === false ? false : eligibleBirthDate(req.body?.birthDate);\n    const cookie = app.jwt.sign({ purpose: 'age-check', minimumAge: MINIMUM_AGE, eligible }, { expiresIn: '15m' });\n    reply.header('Set-Cookie', ageCookie(cookie));\n    if (!eligible) return reply.code(403).send({ error: 'age_ineligible', message: 'Account creation is unavailable. See /privacy for help.' });\n    return { ok: true };\n",
          "baseline": "  app.post('/v1/age-check', async (req, reply) => {\n    reply.header('Cache-Control', 'no-store');\n    const eligible = ageStatus(app, req) === false ? false : eligibleBirthDate(req.body?.birthDate);\n    const cookie = app.jwt.sign({ purpose: 'age-check', eligible }, { expiresIn: '15m' });\n    reply.header('Set-Cookie', ageCookie(cookie));\n    if (!eligible) return reply.code(403).send({ error: 'age_ineligible', message: 'Account creation is unavailable. See /privacy for help.' });\n    return { ok: true };\n"
        }
      ]
    },
    "test/age.js": {
      "current": {
        "mode": "100644",
        "lf": {
          "sha256": "873861db9dd9a5635563450b4f9412472b3a169b8072707ff6f276634b6bf8c9",
          "blob": "940ebd966a457aabce419889892311761b4340b0",
          "bytes": 5005
        },
        "crlf": {
          "sha256": "7181412da86be1b416a3b6beef67cc2a97a0e1679b96581bcbb7f4bee91102a4",
          "blob": "84bc4a46377b7bb95e7d5cddaa01ecab8b6e1279",
          "bytes": 5071
        }
      },
      "baseline": {
        "mode": "100644",
        "lf": {
          "sha256": "8beca43fd783eefd6b6c36968c755af44866a6d9aff8da0801131d3ef0ea5f22",
          "blob": "02917a07183bc74167c3afae4ad491832068f9f2",
          "bytes": 4054
        },
        "crlf": {
          "sha256": "28d3240d16a02dc1cb2cdf3737bf4291d8d90ed9b4711700d75d1aeaa52e027d",
          "blob": "6fb9e0e41c8e57fbac8b1ccbb3502960ee55eb2b",
          "bytes": 4109
        }
      },
      "contextLines": 3,
      "inverses": [
        {
          "current": "import assert from 'node:assert/strict';\nimport { MINIMUM_AGE, eligibleBirthDate } from '../src/age.js';\nimport { buildServer } from '../src/server.js';\n\nconst now = new Date('2026-10-31T12:00:00Z');\nassert.equal(MINIMUM_AGE, 21);\nassert.equal(eligibleBirthDate('2005-10-31', now), true);\nassert.equal(eligibleBirthDate('2005-11-01', now), false);\nassert.throws(() => eligibleBirthDate('2005-02-30', now));\nassert.equal(eligibleBirthDate('2006-01-01', now), false, 'a 20-year-old is ineligible');\nassert.equal(eligibleBirthDate('2007-03-01', new Date('2028-02-29T12:00:00Z')), false, 'leap day does not admit a birthday early');\nassert.equal(eligibleBirthDate('2004-02-29', new Date('2025-02-28T12:00:00Z')), false);\nassert.equal(eligibleBirthDate('2004-02-29', new Date('2025-03-01T12:00:00Z')), true);\nassert.throws(() => eligibleBirthDate('2027-01-01', now));\nconst app = await buildServer();\ntry {\n  const count = async () => Number((await app.pool.query('SELECT count(*) AS n FROM accounts')).rows[0].n);\n  const before = await count();\n  for (const birthDate of [undefined, '2020-01-01', '2007-01-01']) {\n    const response = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: birthDate ? { birthDate } : {} });\n    assert.ok(response.statusCode >= 400);\n  }\n",
          "baseline": "import assert from 'node:assert/strict';\nimport { eligibleBirthDate } from '../src/age.js';\nimport { buildServer } from '../src/server.js';\n\nconst now = new Date('2026-10-08T12:00:00Z');\nassert.equal(eligibleBirthDate('2013-10-08', now), true);\nassert.equal(eligibleBirthDate('2013-10-09', now), false);\nassert.throws(() => eligibleBirthDate('2013-02-30', now));\nassert.throws(() => eligibleBirthDate('2027-01-01', now));\nconst app = await buildServer();\ntry {\n  const count = async () => Number((await app.pool.query('SELECT count(*) AS n FROM accounts')).rows[0].n);\n  const before = await count();\n  for (const birthDate of [undefined, '2020-01-01']) {\n    const response = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: birthDate ? { birthDate } : {} });\n    assert.ok(response.statusCode >= 400);\n  }\n"
        },
        {
          "current": "  assert.equal(approved.statusCode, 200);\n  const token = approved.headers['set-cookie'].split(';')[0].slice('omerta_age='.length);\n  assert.equal(app.jwt.verify(token).purpose, 'age-check');\n  assert.equal(app.jwt.verify(token).minimumAge, 21);\n  for (const claim of [{ purpose: 'age-check', eligible: true }, { purpose: 'age-check', eligible: true, minimumAge: 13 }]) {\n    const old = app.jwt.sign(claim, { expiresIn: '15m' });\n    const denied = await app.inject({ method: 'POST', url: '/v1/auth/guest', headers: { cookie: 'omerta_age=' + old }, payload: {} });\n    assert.equal(denied.json().error, 'age_required', 'a proof from the earlier policy cannot authorize new signup');\n  }\n  assert.equal(JSON.stringify(app.jwt.verify(token)).includes('1990'), false);\n  const explicitChild = await app.inject({ method: 'POST', url: '/v1/auth/guest',\n    headers: { cookie: approved.headers['set-cookie'].split(';')[0] }, payload: { birthDate: '2020-01-01' } });\n",
          "baseline": "  assert.equal(approved.statusCode, 200);\n  const token = approved.headers['set-cookie'].split(';')[0].slice('omerta_age='.length);\n  assert.equal(app.jwt.verify(token).purpose, 'age-check');\n  assert.equal(JSON.stringify(app.jwt.verify(token)).includes('1990'), false);\n  const explicitChild = await app.inject({ method: 'POST', url: '/v1/auth/guest',\n    headers: { cookie: approved.headers['set-cookie'].split(';')[0] }, payload: { birthDate: '2020-01-01' } });\n"
        }
      ]
    },
    "test/legal-security.js": {
      "current": {
        "mode": "100644",
        "lf": {
          "sha256": "2545b8012ba8a1fe0100d58cdaac65459a4bee7a5c12446b886b7a224d1dab54",
          "blob": "8f1e2a8e66f6a68b655cafe4a76b31eb72d52a7a",
          "bytes": 8086
        },
        "crlf": {
          "sha256": "c3e36bc0309f9ba51e8126681c64ad4e0dfb887ae1768da7b4b6ba60eb192d81",
          "blob": "fde8fdcf31e9132f6bcadb71de4c80aab2381b61",
          "bytes": 8192
        }
      },
      "baseline": {
        "mode": "100644",
        "lf": {
          "sha256": "aef6909797943e1ff9228025c5b0fd9e9f5880d6037566ffba5a980fb5fe6b14",
          "blob": "d92eb94a6e3e81884f971fca6d4452df9783cdbc",
          "bytes": 7985
        },
        "crlf": {
          "sha256": "6e1729f69ea349045a5243d837e2bb21c66c7020a7f5e65dee098e47ea1e1409",
          "blob": "2437e6c1a5ce98f25c0fd2eb59fe433dc3341ea8",
          "bytes": 8089
        }
      },
      "contextLines": 3,
      "inverses": [
        {
          "current": "  for (const key of Object.keys(profile)) delete process.env[key];\n  const defaultPrivacy = await app.inject('/privacy');\n  assert.equal(defaultPrivacy.statusCode, 200, 'default privacy policy is public without operator configuration');\n  assert(defaultPrivacy.body.includes('October 31, 2026'));\n  assert(defaultPrivacy.body.includes('A dedicated privacy contact has not yet been published'));\n  assert(!/\\b(?:null|undefined)\\b/.test(defaultPrivacy.body), 'default policy has no missing-value placeholders');\n  assert(!/180 days|seven days|thirty days|\\/v1\\/|background worker|BYPASSRLS|JWT_SECRET|end-to-end encrypted|token records/.test(defaultPrivacy.body), 'public notice omits security internals and cleanup timings');\n",
          "baseline": "  for (const key of Object.keys(profile)) delete process.env[key];\n  const defaultPrivacy = await app.inject('/privacy');\n  assert.equal(defaultPrivacy.statusCode, 200, 'default privacy policy is public without operator configuration');\n  assert(defaultPrivacy.body.includes('October 30, 2026'));\n  assert(defaultPrivacy.body.includes('A dedicated privacy contact has not yet been published'));\n  assert(!/\\b(?:null|undefined)\\b/.test(defaultPrivacy.body), 'default policy has no missing-value placeholders');\n  assert(!/180 days|seven days|thirty days|\\/v1\\/|background worker|BYPASSRLS|JWT_SECRET|end-to-end encrypted|token records/.test(defaultPrivacy.body), 'public notice omits security internals and cleanup timings');\n"
        },
        {
          "current": "    assert(page.body.includes('href=\"/privacy\"'), 'legal navigation is available');\n  }\n  const privacy = (await app.inject('/privacy')).body;\n  assert(privacy.includes('under 21, including children'));\n  assert(!privacy.includes('under 13'));\n  for (const description of ['IP addresses', 'Wallet addresses', 'Messages', 'Notification-delivery', 'Delegated-agent', 'Retention depends', 'without retaining', 'Technical diagnostics']) assert(privacy.includes(description));\n  delete process.env.DMCA_AGENT_REGISTERED;\n  assert.equal((await app.inject('/dmca')).statusCode, 503, 'unverified registration is not presented as registered');\n",
          "baseline": "    assert(page.body.includes('href=\"/privacy\"'), 'legal navigation is available');\n  }\n  const privacy = (await app.inject('/privacy')).body;\n  for (const description of ['IP addresses', 'Wallet addresses', 'Messages', 'Notification-delivery', 'Delegated-agent', 'Retention depends', 'without retaining', 'Technical diagnostics']) assert(privacy.includes(description));\n  delete process.env.DMCA_AGENT_REGISTERED;\n  assert.equal((await app.inject('/dmca')).statusCode, 503, 'unverified registration is not presented as registered');\n"
        }
      ]
    }
  }
});
export const AGE21_SOURCE_SHA256 = "38ac95eef28d5615b1bdbeec05cd4499b98fef7c67192cdd58d86a72400b353a";
