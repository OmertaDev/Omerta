// Exact age-removal historical comparison only; no execution or deployment results transferred.
const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const AGE_REMOVAL_SOURCE = freeze({
  "status": "SEALED",
  "phase": "EXACT_AGE_REMOVAL_SOURCE_COMPARISON_ONLY",
  "revision": "9389bc9c2f73b612cd7b3f8a3646a5f2465259e4",
  "tree": "bb2f545e368c7a762b50d758cd54ef2542975e32",
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
    "public/index.html": {
      "current": {
        "mode": "100644",
        "blob": "35f4b4cb896a391577442eeb1c13b72d002b9b18",
        "sha256": "4fbfdd47d960348528697d8dc4c51adddaa4c2d257044ddea17cde90056ca8cb",
        "bytes": 1405992
      },
      "baseline": {
        "mode": "100644",
        "blob": "87001f9c2f12ca5357dad2beec721c143a9db391",
        "sha256": "bff35121e60ff9e88c8cda3b9ee326a858aca60c54b04a21b246f0c7b3f7b9a6",
        "bytes": 1408520
      },
      "inverses": [
        {
          "at": 584226,
          "current": "    if (h.get('token') || h.get('claimed') || h.get('autherr')) history.replaceState(null, '', location.pathname);\n  })();\n  const startXOAuth = async () => {\n    const inviteCode = $('#invite-code')?.value?.trim();\n    const r = await api('POST', '/v1/auth/x/start', inviteCode ? { inviteCode } : {});\n    if (r.body?.url) location.href = r.body.url;\n",
          "baseline": "    if (h.get('token') || h.get('claimed') || h.get('autherr')) history.replaceState(null, '', location.pathname);\n  })();\n  const startXOAuth = async () => {\n    if (!token && !await verifyAge()) return;\n    const inviteCode = $('#invite-code')?.value?.trim();\n    const r = await api('POST', '/v1/auth/x/start', inviteCode ? { inviteCode } : {});\n    if (r.body?.url) location.href = r.body.url;\n"
        },
        {
          "at": 589166,
          "current": "    else toast(r.body?.message || r.body?.error || 'no dice', true);\n    return false;\n  };\n  let guestPending = false;\n  const enterAsGhost = async () => {\n    if (guestPending) return;\n",
          "baseline": "    else toast(r.body?.message || r.body?.error || 'no dice', true);\n    return false;\n  };\n  let ageChecked = 0;\n  async function verifyAge() {\n    if (ageChecked > Date.now()) return true;\n    if (sessionStorage.getItem('omerta_age_blocked')) {\n      toast('Account creation is unavailable. See the privacy page for help.', true);\n      return false;\n    }\n    return new Promise((resolve) => {\n      const dialog = document.createElement('dialog');\n      dialog.className = 'modal';\n      dialog.setAttribute('aria-labelledby', 'age-title');\n      dialog.innerHTML = `<h2 id=\"age-title\">Your birth date</h2><p>Enter your complete birth date to continue. We check it without saving it.</p><form><label for=\"age-date\">Birth date</label><input id=\"age-date\" name=\"birthDate\" type=\"date\" required min=\"${new Date().getFullYear() - 120}-01-01\" max=\"${new Date().toISOString().slice(0, 10)}\"><p id=\"age-error\" role=\"alert\"></p><p><a href=\"/privacy\">Privacy policy and help</a></p><button class=\"act\" type=\"submit\">Continue</button><button class=\"act\" type=\"button\" id=\"age-cancel\">Cancel</button></form>`;\n      document.body.append(dialog);\n      const finish = (ok) => { dialog.close(); dialog.remove(); resolve(ok); };\n      dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(false); });\n      dialog.querySelector('#age-cancel').onclick = () => finish(false);\n      dialog.querySelector('form').onsubmit = async (event) => {\n        event.preventDefault();\n        const input = dialog.querySelector('input');\n        const birthDate = input.value;\n        input.value = '';\n        const result = await api('POST', '/v1/age-check', { birthDate });\n        if (result.code < 400) { ageChecked = Date.now() + 14 * 60 * 1000; finish(true); }\n        else if (result.body?.error === 'age_ineligible') {\n          sessionStorage.setItem('omerta_age_blocked', '1');\n          dialog.querySelector('form').innerHTML = '<p role=\"alert\">Account creation is unavailable. No birth date was saved.</p><p><a href=\"/privacy\">Privacy policy and help</a></p><button type=\"button\" class=\"act\">Close</button>';\n          dialog.querySelector('button').onclick = () => finish(false);\n        } else dialog.querySelector('#age-error').textContent = result.body?.message || 'Please try again.';\n      };\n      dialog.showModal();\n      dialog.querySelector('input').focus();\n    });\n  }\n  let guestPending = false;\n  const enterAsGhost = async () => {\n    if (guestPending) return;\n"
        },
        {
          "at": 589378,
          "current": "    const controls = ['#btn-guest', '#btn-guest2'].map(selector => $(selector)).filter(Boolean);\n    const labels = controls.map(button => button.textContent);\n    const status = $('#guest-status');\n    status.hidden = false; status.textContent = 'Opening your street…';\n    controls.forEach(button => { button.disabled = true; button.setAttribute('aria-busy', 'true'); button.textContent = 'Entering the city…'; });\n    try {\n      const inviteCode = undefined;\n      const result = await api('POST', '/v1/auth/guest', inviteCode ? { inviteCode } : {});\n      globalThis.OmertaSiteAnalytics?.signupResult?.(result);\n",
          "baseline": "    const controls = ['#btn-guest', '#btn-guest2'].map(selector => $(selector)).filter(Boolean);\n    const labels = controls.map(button => button.textContent);\n    const status = $('#guest-status');\n    status.hidden = false; status.textContent = 'Checking eligibility…';\n    controls.forEach(button => { button.disabled = true; button.setAttribute('aria-busy', 'true'); button.textContent = 'Entering the city…'; });\n    try {\n      if (!await verifyAge()) { status.textContent = ''; status.hidden = true; return; }\n      status.textContent = 'Opening your street…';\n      const inviteCode = undefined;\n      const result = await api('POST', '/v1/auth/guest', inviteCode ? { inviteCode } : {});\n      globalThis.OmertaSiteAnalytics?.signupResult?.(result);\n"
        },
        {
          "at": 593327,
          "current": "  $('#btn-provider').onclick = async () => {\n    const provider = $('#auth-provider').value, tok = $('#auth-token').value.trim();\n    if (!tok) return toast('paste a provider token first', true);\n    const inviteCode = undefined;\n    landToken(await api(`POST`, `/v1/auth/${provider}`, { token: tok, ...(inviteCode ? { inviteCode } : {}) }));\n  };\n",
          "baseline": "  $('#btn-provider').onclick = async () => {\n    const provider = $('#auth-provider').value, tok = $('#auth-token').value.trim();\n    if (!tok) return toast('paste a provider token first', true);\n    if (!await verifyAge()) return;\n    const inviteCode = undefined;\n    landToken(await api(`POST`, `/v1/auth/${provider}`, { token: tok, ...(inviteCode ? { inviteCode } : {}) }));\n  };\n"
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
        "blob": "b0b56b02ca70ecb6a786e1aaa047a026e3fe1201",
        "sha256": "a1b592caef89da5800f6f62d68b27e000de4c5fbe5fc44846c8a264b44e0eed4",
        "bytes": 310774
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
          "at": 112441,
          "current": "    return { ok: true };\n  });\n\n  const guestLogin = async (req) => {\n    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) &&\n        Object.prototype.hasOwnProperty.call(req.body, 'bootstrapSecret')) {\n      const { accountId, tokenVersion } = await A.accountForGuestBootstrap(\n        pool, req.body.bootstrapSecret, req.clientIp, req.body.inviteCode,\n        req.clientIpAuthority,\n      );\n      return { token: await signFor(accountId, {}, '30d', tokenVersion) };\n    }\n    const id = await A.createGuestAccount(pool, req.clientIp, req.body?.inviteCode, req.clientIpAuthority);\n    return { token: await signFor(id, {}, '30d', 0) };\n  };\n  app.post('/v1/auth/guest', guestLogin);\n  app.post('/v1/auth/agent', async (req) => {\n    const { accountId, tokenVersion } = await A.accountForAgentBootstrap(\n      pool, req.body?.bootstrapSecret, req.clientIp, req.body?.inviteCode, req.clientIpAuthority,\n    );\n",
          "baseline": "    return { ok: true };\n  });\n\n  app.post('/v1/age-check', async (req, reply) => {\n    reply.header('Cache-Control', 'no-store');\n    const eligible = ageStatus(app, req) === false ? false : eligibleBirthDate(req.body?.birthDate);\n    const cookie = app.jwt.sign({ purpose: 'age-check', minimumAge: MINIMUM_AGE, eligible }, { expiresIn: '15m' });\n    reply.header('Set-Cookie', ageCookie(cookie));\n    if (!eligible) return reply.code(403).send({ error: 'age_ineligible', message: 'Account creation is unavailable. See /privacy for help.' });\n    return { ok: true };\n  });\n  const guestLogin = async (req) => {\n    // Recovery authority does not override a known-ineligible browser or an\n    // explicitly supplied birth date. Existing eligible recovery needs no DOB.\n    if (ageStatus(app, req) === false || req.body?.birthDate !== undefined) requireAge(app, req);\n    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body) &&\n        Object.prototype.hasOwnProperty.call(req.body, 'bootstrapSecret')) {\n      const { accountId, tokenVersion } = await A.accountForGuestBootstrap(\n        pool, req.body.bootstrapSecret, req.clientIp, req.body.inviteCode, () => requireAge(app, req),\n        req.clientIpAuthority,\n      );\n      return { token: await signFor(accountId, {}, '30d', tokenVersion) };\n    }\n    requireAge(app, req);\n    const id = await A.createGuestAccount(pool, req.clientIp, req.body?.inviteCode, req.clientIpAuthority);\n    return { token: await signFor(id, {}, '30d', 0) };\n  };\n  app.post('/v1/auth/guest', guestLogin);\n  app.post('/v1/auth/agent', async (req) => {\n    requireAge(app, req, { agent: true });\n    const { accountId, tokenVersion } = await A.accountForAgentBootstrap(\n      pool, req.body?.bootstrapSecret, req.clientIp, req.body?.inviteCode, req.clientIpAuthority,\n    );\n"
        },
        {
          "at": 114889,
          "current": "  app.post('/v1/auth/guest/bootstrap/ack', { preHandler: auth }, async (req) =>\n    A.acknowledgeGuestBootstrap(pool, req.user.sub));\n  const providerLogin = (verify) => async (req) => {\n    const identity = await verify(req.body?.token);\n    // (B2) the invite is consumed ATOMICALLY inside accountForIdentity's create txn — one invite per\n    // new account, gate held even under a concurrent same-identity race (no separate pre-consume).\n",
          "baseline": "  app.post('/v1/auth/guest/bootstrap/ack', { preHandler: auth }, async (req) =>\n    A.acknowledgeGuestBootstrap(pool, req.user.sub));\n  const providerLogin = (verify) => async (req) => {\n    requireAge(app, req);\n    const identity = await verify(req.body?.token);\n    // (B2) the invite is consumed ATOMICALLY inside accountForIdentity's create txn — one invite per\n    // new account, gate held even under a concurrent same-identity race (no separate pre-consume).\n"
        },
        {
          "at": 118108,
          "current": "      const revoked = req.user.tv !== undefined && Number(req.user.tv) !== Number(a?.token_version);\n      if (!a || a.status === 'banned' || revoked) accountId = null;\n    }\n    const { url, state } = await A.xOAuthStart(pool, { accountId, invite: req.body?.inviteCode });\n    // BROWSER-BIND the state (anti account-linking CSRF): the callback must present the same cookie,\n    // so an attacker who leaks their authorize URL can't have a victim's X identity bound to the\n",
          "baseline": "      const revoked = req.user.tv !== undefined && Number(req.user.tv) !== Number(a?.token_version);\n      if (!a || a.status === 'banned' || revoked) accountId = null;\n    }\n    if (!accountId) requireAge(app, req);\n    const { url, state } = await A.xOAuthStart(pool, { accountId, invite: req.body?.inviteCode });\n    // BROWSER-BIND the state (anti account-linking CSRF): the callback must present the same cookie,\n    // so an attacker who leaks their authorize URL can't have a victim's X identity bound to the\n"
        },
        {
          "at": 119717,
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
        "blob": "0ab53dfeee2caf84cb736b2dd7d931e424bdeb59",
        "sha256": "26cab4d9b8454acfaa2944714fec7fcc43cc1fc4cc62577b34ea6458b292377e",
        "bytes": 81647
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
          "at": 51756,
          "current": "\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Restart Probe');\n  await page.click('#btn-create');\n",
          "baseline": "\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#age-date');\n  await page.fill('#age-date', '1990-01-01');\n  await page.locator('#age-date').evaluate((input) => input.form.requestSubmit());\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Restart Probe');\n  await page.click('#btn-create');\n"
        },
        {
          "at": 58831,
          "current": "  const vp = { w: 375, h: 667 };\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Cooldown Probe');\n  await page.click('#btn-create');\n",
          "baseline": "  const vp = { w: 375, h: 667 };\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#age-date');\n  await page.fill('#age-date', '1990-01-01');\n  await page.locator('#age-date').evaluate((input) => input.form.requestSubmit());\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Cooldown Probe');\n  await page.click('#btn-create');\n"
        },
        {
          "at": 65344,
          "current": "  });\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Deep City Probe');\n  await page.click('#btn-create');\n",
          "baseline": "  });\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#age-date');\n  await page.fill('#age-date', '1990-01-01');\n  await page.locator('#age-date').evaluate((input) => input.form.requestSubmit());\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Deep City Probe');\n  await page.click('#btn-create');\n"
        },
        {
          "at": 69440,
          "current": "  const vp = { w: 375, h: 667 };\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Lockup Probe');\n  await page.click('#btn-create');\n",
          "baseline": "  const vp = { w: 375, h: 667 };\n  await page.goto(BASE, { waitUntil: 'domcontentloaded' });\n  await page.click('#btn-guest');\n  await page.waitForSelector('#age-date');\n  await page.fill('#age-date', '1990-01-01');\n  await page.locator('#age-date').evaluate((input) => input.form.requestSubmit());\n  await page.waitForSelector('#screen-create:not(.hidden)', { timeout: 20000 });\n  await page.fill('#new-name', 'Lockup Probe');\n  await page.click('#btn-create');\n"
        },
        {
          "at": 74870,
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
    "test/lib/age-removal-source-transfer-proof.js": {
      "mode": "100644",
      "blob": "3d176bc83cba85a7db640131b4a6bb330ad03ff6",
      "sha256": "e3714b14188fee764747c868152798985c4083e15f5e919866c7067c5f6cacaa",
      "bytes": 7390
    },
    "tools/age-removal-source-seal.js": {
      "mode": "100644",
      "blob": "90397b15f94d0855550c0bb660cf02842542dcfe",
      "sha256": "b1e51a444d3dbff66c0b71265021383888cc91e54a9c455accbeeb4114fa3ae3",
      "bytes": 4883
    },
    "tools/age-removal-source-transfer.js": {
      "mode": "100644",
      "blob": "ea8ecc58f2c9bab35e5c51285df405e89fbfb06c",
      "sha256": "c75fb314eb878ab06faf50e09029f233e6f6a0357f7f8d251bd3e0200f07acce",
      "bytes": 6002
    }
  }
});
export const AGE_REMOVAL_SOURCE_SHA256 = 'f16ca7c20a323884e6604b85dc34e5c9a30c73807a101412d6d9842d3b0ce6aa';
