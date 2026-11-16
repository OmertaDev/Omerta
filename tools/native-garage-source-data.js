// Exact native garage historical comparison only; no execution or deployment results transferred.
const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const NATIVE_GARAGE_SOURCE = freeze({
  "status": "SEALED",
  "phase": "EXACT_NATIVE_GARAGE_SOURCE_COMPARISON_ONLY",
  "revision": "80378162d2ef17970376e4afb7fb020deeb3a600",
  "tree": "9484a7ca1369aaa206b8337512fcf589d2d92f23",
  "predecessor": "9cf7ced8beedd0950018a14bbab71b08b71a3d5b",
  "predecessorTree": "9477c277cca6b47b3a3ce20901e85a451243642f",
  "files": {
    ".github/workflows/ci.yml": {
      "current": {
        "mode": "100644",
        "blob": "7934f3b0ae841464c99fc515c50e41b262e02011",
        "sha256": "ff24c7851ddfe8768a7e0c28cfdd03ea6d341878731e6f1ddb1c84a95a53fb98",
        "bytes": 84679
      },
      "baseline": {
        "mode": "100644",
        "blob": "f44ec29d6d170b1c43e69b8f48a5098cbd7e3d46",
        "sha256": "0705cb89a23235c5a8316331c734eb19bfe85fa4777ea3ee8a69b5466799a681",
        "bytes": 84274
      },
      "inverses": [
        {
          "at": 2832,
          "current": "          cache: npm\n      - run: npm ci\n\n      - name: Native garage RPC facade and wallet transaction controller\n        run: |\n          node test/native-garage-source-transfer.js\n          node test/native-garage-enterprise-source.js\n          node test/nativegarage.js\n          node test/nativegarage-client.js\n\n      - name: Install isolated MCP client dependencies\n        run: npm install --prefix omerta-mcp --ignore-scripts --package-lock=false\n      - name: MCP identity, recovery and shared-session regressions\n",
          "baseline": "          cache: npm\n      - run: npm ci\n\n      - name: Install isolated MCP client dependencies\n        run: npm install --prefix omerta-mcp --ignore-scripts --package-lock=false\n      - name: MCP identity, recovery and shared-session regressions\n"
        },
        {
          "at": 11801,
          "current": "      - name: install chromium for the client harness\n        run: npx playwright-core install --with-deps chromium\n\n      - name: Native garage wallet flow and confirmed projections in the browser\n        run: node test/nativegarage-browser.js\n\n      - name: Invite gate and Crew invitation controls in the browser\n        run: npm run test:invites:browser\n\n",
          "baseline": "      - name: install chromium for the client harness\n        run: npx playwright-core install --with-deps chromium\n\n      - name: Invite gate and Crew invitation controls in the browser\n        run: npm run test:invites:browser\n\n"
        }
      ]
    },
    "public/index.html": {
      "current": {
        "mode": "100644",
        "blob": "090fcf97c06430a16875bc5de8cdbf800584fcdb",
        "sha256": "fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba",
        "bytes": 1404985
      },
      "baseline": {
        "mode": "100644",
        "blob": "fe80e058bf517ca60ae0af3dee0d53630e994cd1",
        "sha256": "08c3ccd59f719b11f9609c463a9bb979a1c0678ec1ab3b63fc121e6a8c00d662",
        "bytes": 1401349
      },
      "inverses": [
        {
          "at": 761,
          "current": "<meta name=\"apple-mobile-web-app-title\" content=\"OMERTÀ\">\n<link rel=\"apple-touch-icon\" href=\"/apple-touch-icon.png\">\n<link rel=\"preload\" href=\"/art/display.woff2\" as=\"font\" type=\"font/woff2\" crossorigin>\n<link rel=\"stylesheet\" href=\"/nativegarage.css\">\n<title>OMERTÀ | Multiplayer mafia browser game</title>\n<meta name=\"description\" content=\"Play a free multiplayer mafia browser game alongside people and AI agents. Run jobs, build a family, and survive the city. On-chain features are not active in production.\">\n<link rel=\"canonical\" href=\"https://www.omerta.fun/\">\n",
          "baseline": "<meta name=\"apple-mobile-web-app-title\" content=\"OMERTÀ\">\n<link rel=\"apple-touch-icon\" href=\"/apple-touch-icon.png\">\n<link rel=\"preload\" href=\"/art/display.woff2\" as=\"font\" type=\"font/woff2\" crossorigin>\n<title>OMERTÀ | Multiplayer mafia browser game</title>\n<meta name=\"description\" content=\"Play a free multiplayer mafia browser game alongside people and AI agents. Run jobs, build a family, and survive the city. On-chain features are not active in production.\">\n<link rel=\"canonical\" href=\"https://www.omerta.fun/\">\n"
        },
        {
          "at": 640209,
          "current": "  }\n  function renderSheet() {\n    if (!me) return;\n    document.body.classList.toggle('native-source-character', !!me.onchainCrafting);\n    renderActionReadiness();\n    // (C5) the FAMILY chat room only works in a family — hide the tab for the family-less (was a\n    // silent dead-end: clicking it 400'd no_gang into a blank pane). Fall back to the live feed.\n",
          "baseline": "  }\n  function renderSheet() {\n    if (!me) return;\n    renderActionReadiness();\n    // (C5) the FAMILY chat room only works in a family — hide the tab for the family-less (was a\n    // silent dead-end: clicking it 400'd no_gang into a blank pane). Fall back to the live feed.\n"
        },
        {
          "at": 640621,
          "current": "      fam.classList.toggle('hidden', !me.gang);\n      if (!me.gang && wtab === 'family') { $('[data-wtab=\"feed\"]')?.click(); }\n    }\n    $('#whoami').innerHTML = `<b>${esc(me.name)}</b> · gen ${me.generation} · lvl ${me.level} · ${me.onchainCrafting ? esc(me.loc) + ' · onchain character' : `<button id=\"go-travel\" title=\"travel\">${esc(me.loc)} ⇄</button>`}` +\n      (me.gang ? ` · <span style=\"color:${me.gang.color || 'var(--dim)'}\">${esc(me.gang.tag)}</span>` : '');\n    const capitalBalance = $('#capital-balance');\n    const walletEntry = $('#btn-wallet');\n",
          "baseline": "      fam.classList.toggle('hidden', !me.gang);\n      if (!me.gang && wtab === 'family') { $('[data-wtab=\"feed\"]')?.click(); }\n    }\n    $('#whoami').innerHTML = `<b>${esc(me.name)}</b> · gen ${me.generation} · lvl ${me.level} · <button id=\"go-travel\" title=\"travel\">${esc(me.loc)} ⇄</button>` +\n      (me.gang ? ` · <span style=\"color:${me.gang.color || 'var(--dim)'}\">${esc(me.gang.tag)}</span>` : '');\n    const capitalBalance = $('#capital-balance');\n    const walletEntry = $('#btn-wallet');\n"
        },
        {
          "at": 641389,
          "current": "      sessionStorage.removeItem('omerta-wallet-onboarding');\n      toast('Welcome. Use Connect wallet above to link your address, then Mint your character NFT.');\n    }\n    if (capitalBalance) capitalBalance.textContent = me.onchainCrafting ? '—' : fmt(Math.floor(Number(me.omr) || 0));\n    const gt = $('#go-travel'); if (gt) gt.onclick = openTravel;   // move from ANY screen\n    const chips = [];\n    // LIVE countdowns (mins() ticks in place) — a short jail reads \"0:08\" and drains, not a static, wrong \"1m\"\n",
          "baseline": "      sessionStorage.removeItem('omerta-wallet-onboarding');\n      toast('Welcome. Use Connect wallet above to link your address, then Mint your character NFT.');\n    }\n    if (capitalBalance) capitalBalance.textContent = fmt(Math.floor(Number(me.omr) || 0));\n    const gt = $('#go-travel'); if (gt) gt.onclick = openTravel;   // move from ANY screen\n    const chips = [];\n    // LIVE countdowns (mins() ticks in place) — a short jail reads \"0:08\" and drains, not a static, wrong \"1m\"\n"
        },
        {
          "at": 642642,
          "current": "    // YOUR TURN. The coach remains the server-authoritative decision; the desk makes its status,\n    // current resources, destination, result receipts, and recovery paths one coherent surface.\n    {\n      const plan = me.onchainCrafting ? [] : me.coachPlan || [];\n      const order = me.onchainCrafting ? { label: 'Open your onchain garage',\n        hint: 'Your live energy, cars, materials and tools are read from chain.', tab: 'garage' } : me.coach || { label: 'No urgent order',\n        hint: 'The city has no emergency for you. Keep working the operation in front of you, or open Start Here for the live board.',\n        tab: currentTab || 'start' };\n      let readiness = { tone: 'ready', label: 'READY', detail: 'Costs and risk are shown beside each operation.' };\n",
          "baseline": "    // YOUR TURN. The coach remains the server-authoritative decision; the desk makes its status,\n    // current resources, destination, result receipts, and recovery paths one coherent surface.\n    {\n      const plan = me.coachPlan || [];\n      const order = me.coach || { label: 'No urgent order',\n        hint: 'The city has no emergency for you. Keep working the operation in front of you, or open Start Here for the live board.',\n        tab: currentTab || 'start' };\n      let readiness = { tone: 'ready', label: 'READY', detail: 'Costs and risk are shown beside each operation.' };\n"
        },
        {
          "at": 644209,
          "current": "      else if (Number(me.nerve) < 2) readiness = { tone: 'caution', label: 'LOW NERVE', detail: 'Crime waits on nerve. Training and collections use other resources.' };\n      // THE ROAD TO LEVEL 5 — presentational only (the same published divisor the sheet's level bar\n      // uses): a literal progress bar toward the Path unlock, so \"get to level 5\" has a visible dial.\n      if (me.onchainCrafting) readiness = { tone: 'ready', label: 'ONCHAIN', detail: 'City statistics are a frozen snapshot. Open Garage for live onchain state.' };\n      let road5 = '';\n      const D5 = rules?.pacing?.levelDivisor;\n      if (D5 && me.level < 5) {\n",
          "baseline": "      else if (Number(me.nerve) < 2) readiness = { tone: 'caution', label: 'LOW NERVE', detail: 'Crime waits on nerve. Training and collections use other resources.' };\n      // THE ROAD TO LEVEL 5 — presentational only (the same published divisor the sheet's level bar\n      // uses): a literal progress bar toward the Path unlock, so \"get to level 5\" has a visible dial.\n      let road5 = '';\n      const D5 = rules?.pacing?.levelDivisor;\n      if (D5 && me.level < 5) {\n"
        },
        {
          "at": 647929,
          "current": "    // even when the banner has scrolled away. Cleared first (the coach moves as you progress), and\n    // never lit while you're already standing on the target tab.\n    document.querySelectorAll('.coachhint').forEach((b) => b.classList.remove('coachhint'));\n    if (!me.onchainCrafting && me.coach && me.coach.tab && currentTab !== me.coach.tab) {\n      const grp = groupOf(me.coach.tab);\n      for (const sel of [`#tabs [data-tab=\"${me.coach.tab}\"]`, `[data-group=\"${grp}\"]`, `#bnav [data-go=\"${me.coach.tab}\"]`, `#bnav [data-go=\"${grp}\"]`]) {\n        const b = document.querySelector(sel); if (b) b.classList.add('coachhint');\n",
          "baseline": "    // even when the banner has scrolled away. Cleared first (the coach moves as you progress), and\n    // never lit while you're already standing on the target tab.\n    document.querySelectorAll('.coachhint').forEach((b) => b.classList.remove('coachhint'));\n    if (me.coach && me.coach.tab && currentTab !== me.coach.tab) {\n      const grp = groupOf(me.coach.tab);\n      for (const sel of [`#tabs [data-tab=\"${me.coach.tab}\"]`, `[data-group=\"${grp}\"]`, `#bnav [data-go=\"${me.coach.tab}\"]`, `#bnav [data-go=\"${grp}\"]`]) {\n        const b = document.querySelector(sel); if (b) b.classList.add('coachhint');\n"
        },
        {
          "at": 654019,
          "current": "        document.body.classList.toggle('sheetopen', open === '1');\n        sm.textContent = open === '1' ? 'less ▴' : 'the full sheet ▾'; }; }\n    document.body.classList.toggle('sheetopen', localStorage.getItem('omerta_sheet_open') === '1');\n    if (me.onchainCrafting) {\n      const label = document.createElement('p'); label.className = 'ng-snapshot-label';\n      label.textContent = 'City snapshot · open Garage for live onchain energy, inventory and materials.';\n      $('#sheet-body').prepend(label);\n      $('#vitals').textContent = 'Onchain mode · live inventory in Garage';\n    }\n    // money tick — a brief up/down flash + a smooth count-up when the pocket changes (with the toast haptic)\n    { const prev = renderSheet._cash; renderSheet._cash = me.cash;\n      if (prev !== undefined && prev !== me.cash) { const m = $('#sheet .money');\n",
          "baseline": "        document.body.classList.toggle('sheetopen', open === '1');\n        sm.textContent = open === '1' ? 'less ▴' : 'the full sheet ▾'; }; }\n    document.body.classList.toggle('sheetopen', localStorage.getItem('omerta_sheet_open') === '1');\n    // money tick — a brief up/down flash + a smooth count-up when the pocket changes (with the toast haptic)\n    { const prev = renderSheet._cash; renderSheet._cash = me.cash;\n      if (prev !== undefined && prev !== me.cash) { const m = $('#sheet .money');\n"
        },
        {
          "at": 656703,
          "current": "    // there. Here it is the in-session TRANSITION only, so it must not fire before the panels exist:\n    // renderSheet() runs first at boot, and a setTab('pen') at that moment threw on a null panel and\n    // spent the latch. `$('#tab-pen')` is the honest test for \"has the app been built yet\".\n    { const was = renderSheet._jailed; const isJ = !me.onchainCrafting && Number(me.jailSeconds) > 0; renderSheet._jailed = isJ;\n      if (isJ && was === false) sfx('jail');\n      if (isJ && was === false && currentTab !== 'pen' && $('#tab-pen')) {\n        setTab('pen');\n",
          "baseline": "    // there. Here it is the in-session TRANSITION only, so it must not fire before the panels exist:\n    // renderSheet() runs first at boot, and a setTab('pen') at that moment threw on a null panel and\n    // spent the latch. `$('#tab-pen')` is the honest test for \"has the app been built yet\".\n    { const was = renderSheet._jailed; const isJ = Number(me.jailSeconds) > 0; renderSheet._jailed = isJ;\n      if (isJ && was === false) sfx('jail');\n      if (isJ && was === false && currentTab !== 'pen' && $('#tab-pen')) {\n        setTab('pen');\n"
        },
        {
          "at": 662600,
          "current": "        + (ci.next ? `, and tomorrow it's <b>$${fmt(ci.next)}</b>` : `, the top of the ladder`));\n      terms.innerHTML = lines.join('<br>');\n    }\n    if (!me.onchainCrafting) checkTips(me);\n  }\n\n  // ── MILESTONE TIPS — one-time explainers for the first time something happens TO you.\n",
          "baseline": "        + (ci.next ? `, and tomorrow it's <b>$${fmt(ci.next)}</b>` : `, the top of the ladder`));\n      terms.innerHTML = lines.join('<br>');\n    }\n    checkTips(me);\n  }\n\n  // ── MILESTONE TIPS — one-time explainers for the first time something happens TO you.\n"
        },
        {
          "at": 682147,
          "current": "    // every other reason to land somewhere — being in a cell is the strongest thing the game can say\n    // about what you should be doing next.\n    const jailed = Number(me?.jailSeconds) > 0;\n    setTab(me?.onchainCrafting ? 'garage' : jailed ? 'pen' : 'streets');\n    // THE LOGIN HOOK — where a returning player lands. The Morning Paper (while-you-were-gone) and\n    // THE SITUATION (your people/threats) are the returning-player hook, and they live on Home — so a\n    // player with anything to see there should LAND there, not a tab away:\n",
          "baseline": "    // every other reason to land somewhere — being in a cell is the strongest thing the game can say\n    // about what you should be doing next.\n    const jailed = Number(me?.jailSeconds) > 0;\n    setTab(jailed ? 'pen' : 'streets');\n    // THE LOGIN HOOK — where a returning player lands. The Morning Paper (while-you-were-gone) and\n    // THE SITUATION (your people/threats) are the returning-player hook, and they live on Home — so a\n    // player with anything to see there should LAND there, not a tab away:\n"
        },
        {
          "at": 682917,
          "current": "    //   • an active same-session player with nothing new → Streets (their bread and butter)\n    // A jailed player is none of these — the digest keeps until they're out.\n    const landingRevision = navigationRevision;\n    if (!jailed && !me?.onchainCrafting) Promise.all([api('GET', '/v1/onboard'), api('GET', '/v1/paper')]).then(([o, p]) => {\n      if (navigationRevision === landingRevision && ((o.body && !o.body.allDone) || (p.body && p.body.fresh))) setTab('start');\n    }).catch(() => { /* the current screen remains usable if optional landing data is unavailable */ });\n  }\n",
          "baseline": "    //   • an active same-session player with nothing new → Streets (their bread and butter)\n    // A jailed player is none of these — the digest keeps until they're out.\n    const landingRevision = navigationRevision;\n    if (!jailed) Promise.all([api('GET', '/v1/onboard'), api('GET', '/v1/paper')]).then(([o, p]) => {\n      if (navigationRevision === landingRevision && ((o.body && !o.body.allDone) || (p.body && p.body.fresh))) setTab('start');\n    }).catch(() => { /* the current screen remains usable if optional landing data is unavailable */ });\n  }\n"
        },
        {
          "at": 1113345,
          "current": "        <div style=\"flex:1;min-width:200px\"><div class=\"d\"><b>PATRON FAMILIES</b></div>${(b.families || []).slice(0, 8).map((g) => `<div class=\"d\">#${g.rank} ${esc(g.name)}${g.tag ? ` [${esc(g.tag)}]` : ''} — Ξ${g.spentEth} (${g.patrons})</div>`).join('') || '<div class=\"d\">none yet</div>'}</div></div>`; }; }\n  }\n\n  let nativeGarageView, nativeGarageSession, nativeGarageRevision = 0;\n  async function mountNativeGarage(element) {\n    const revision = ++nativeGarageRevision, expectedToken = token;\n    try {\n      const { createNativeGarageView } = await import('/nativegarage.js');\n      if (revision !== nativeGarageRevision || expectedToken !== token || !element.isConnected) return;\n      if (!nativeGarageView || nativeGarageSession !== expectedToken) {\n        nativeGarageView?.dispose();\n        nativeGarageSession = expectedToken;\n        nativeGarageView = createNativeGarageView({\n          api: async (method, path, body) => {\n            if (token !== expectedToken) throw new Error('Your session changed. Reopen the garage.');\n            const response = await api(method, path, body);\n            if (response.code >= 400) throw Object.assign(new Error(response.body?.message || response.body?.error || 'The onchain garage is unavailable. Try again.'), { code: response.body?.error });\n            return response.body;\n          },\n          pickProvider: async (pickerOptions) => {\n            if (token !== expectedToken) throw new Error('Your session changed. Reopen the garage.');\n            const provider = await pickProvider(pickerOptions);\n            if (provider) connectedProvider = provider;\n            return provider;\n          },\n          getExpectedWallet: () => {\n            if (token !== expectedToken) throw new Error('Your session changed. Reopen the garage.');\n            const board = nativeGarageView?.client.getState().board;\n            return board?.profile?.wallet || board?.wallet || me?.wallet || null;\n          },\n          storage: sessionStorage,\n        });\n      }\n      await nativeGarageView.mount(element);\n    } catch (error) {\n      if (expectedToken === token && element.isConnected) {\n        element.innerHTML = `<h2>Onchain Garage</h2><p role=\"alert\">${esc(error?.message || 'Unable to load wallet controls. Reopen the garage to retry.')}</p>`;\n      }\n    }\n  }\n\n  // ── THE GARAGE: your iron + the armory ──\n  async function renderGarage() {\n    const t = $('#tab-garage');\n    await refresh();\n    if (me?.onchainCrafting) {\n      t.innerHTML = '<section id=\"native-garage\" class=\"native-garage\" aria-label=\"Onchain garage and foundry\"><h2>Onchain Garage</h2><p role=\"status\">Reading confirmed chain state…</p></section>';\n      await mountNativeGarage(t.querySelector('#native-garage'));\n      return;\n    }\n    const ownedGuns = new Set(me.guns || []);\n    // THE COLLECTION — rarity + the on-chain rail. Bound the covered way (GETBIND) so the\n    // mirror guard actually checks these reads.\n",
          "baseline": "        <div style=\"flex:1;min-width:200px\"><div class=\"d\"><b>PATRON FAMILIES</b></div>${(b.families || []).slice(0, 8).map((g) => `<div class=\"d\">#${g.rank} ${esc(g.name)}${g.tag ? ` [${esc(g.tag)}]` : ''} — Ξ${g.spentEth} (${g.patrons})</div>`).join('') || '<div class=\"d\">none yet</div>'}</div></div>`; }; }\n  }\n\n  // ── THE GARAGE: your iron + the armory ──\n  async function renderGarage() {\n    const t = $('#tab-garage');\n    await refresh();\n    const ownedGuns = new Set(me.guns || []);\n    // THE COLLECTION — rarity + the on-chain rail. Bound the covered way (GETBIND) so the\n    // mirror guard actually checks these reads.\n"
        },
        {
          "at": 1116574,
          "current": "    // guard checks every read.\n    const exch = (await api('GET', '/v1/exchange')).body || {};\n    t.innerHTML = `\n      <section id=\"native-garage\" class=\"native-garage\" aria-label=\"Onchain garage and foundry\"><h2>Onchain Garage</h2><p role=\"status\">Reading confirmed chain state…</p></section>\n      ${!(me.cars || []).length && !(me.guns || []).length ? coachCard('Your garage &amp; armory', 'Boost cars to fence for cash or melt into ammo. Buy a gun and a vest below before fighting or taking a contract.') : ''}\n      <h2>The Fleet (${(me.cars || []).length}) <button class=\"act\" data-do=\"POST /v1/garage/boost\" style=\"margin-left:8px\">boost a car (GTA)</button></h2>\n      ${(me.cars || []).length ? `<div class=\"grid\">${me.cars.map((c) => `\n",
          "baseline": "    // guard checks every read.\n    const exch = (await api('GET', '/v1/exchange')).body || {};\n    t.innerHTML = `\n      ${!(me.cars || []).length && !(me.guns || []).length ? coachCard('Your garage &amp; armory', 'Boost cars to fence for cash or melt into ammo. Buy a gun and a vest below before fighting or taking a contract.') : ''}\n      <h2>The Fleet (${(me.cars || []).length}) <button class=\"act\" data-do=\"POST /v1/garage/boost\" style=\"margin-left:8px\">boost a car (GTA)</button></h2>\n      ${(me.cars || []).length ? `<div class=\"grid\">${me.cars.map((c) => `\n"
        },
        {
          "at": 1125277,
          "current": "          ${c.desc ? `<div class=\"d\" style=\"color:var(--dim);font-size:11px\">${esc(c.desc)}</div>` : ''}\n          <button class=\"act\" data-craft=\"${c.id}\">craft</button>${(me.items && me.items[c.id]) ? ` <button class=\"act\" data-useitem=\"${c.id}\">use it</button>` : ''}</div>`).join('')}</div>\n      <div style=\"margin-top:8px\"><button class=\"act\" id=\"craft-ammo\">roll 30 rounds (1 crate + $400)</button></div>`;\n    await mountNativeGarage(t.querySelector('#native-garage'));\n    t.querySelectorAll('[data-craft]').forEach((b) => b.onclick = () =>\n      act('POST', `/v1/workshop/craft/${b.dataset.craft}`, {}).then(() => renderGarage()));\n    t.querySelectorAll('[data-useitem]').forEach((b) => b.onclick = () =>\n",
          "baseline": "          ${c.desc ? `<div class=\"d\" style=\"color:var(--dim);font-size:11px\">${esc(c.desc)}</div>` : ''}\n          <button class=\"act\" data-craft=\"${c.id}\">craft</button>${(me.items && me.items[c.id]) ? ` <button class=\"act\" data-useitem=\"${c.id}\">use it</button>` : ''}</div>`).join('')}</div>\n      <div style=\"margin-top:8px\"><button class=\"act\" id=\"craft-ammo\">roll 30 rounds (1 crate + $400)</button></div>`;\n    t.querySelectorAll('[data-craft]').forEach((b) => b.onclick = () =>\n      act('POST', `/v1/workshop/craft/${b.dataset.craft}`, {}).then(() => renderGarage()));\n    t.querySelectorAll('[data-useitem]').forEach((b) => b.onclick = () =>\n"
        }
      ]
    },
    "public/noir-shell.js": {
      "current": {
        "mode": "100644",
        "blob": "cbc4dcf3ffb16bfbfa443097e9669593d9d008d6",
        "sha256": "0f3b685abf89b56cbf61fe74166232e32157d0894e4f16aa14e89325fb53ffdd",
        "bytes": 18852
      },
      "baseline": {
        "mode": "100644",
        "blob": "4f63dddb0260a05ff4f293dbaa520d17bd0e8e26",
        "sha256": "c9d32b26477ece7ae4dc9171519c6b0efc3bc910a370fe84fdc4429b0875caff",
        "bytes": 18763
      },
      "inverses": [
        {
          "at": 8289,
          "current": "      text(card.querySelector('.noir-player-location'), words(me.loc));\n      for (const [key, max] of [['health', 'maxHealth'], ['energy', 'maxEnergy'], ['nerve', 'maxNerve']]) {\n        const row = card.querySelector(`[data-noir-stat=\"${key}\"]`), current = number(me[key]), limit = number(me[max]);\n        row.hidden = !!me.onchainCrafting || !current;\n        text(row.querySelector('dd'), current + (limit ? ` / ${limit}` : ''));\n      }\n      text(card.querySelector('.noir-player-status'), me.onchainCrafting ? 'Onchain mode · live balances in Garage' : number(me.heat) ? `Heat ${number(me.heat)}` : '');\n    }\n\n    function renderHeading() {\n",
          "baseline": "      text(card.querySelector('.noir-player-location'), words(me.loc));\n      for (const [key, max] of [['health', 'maxHealth'], ['energy', 'maxEnergy'], ['nerve', 'maxNerve']]) {\n        const row = card.querySelector(`[data-noir-stat=\"${key}\"]`), current = number(me[key]), limit = number(me[max]);\n        row.hidden = !current;\n        text(row.querySelector('dd'), current + (limit ? ` / ${limit}` : ''));\n      }\n      text(card.querySelector('.noir-player-status'), number(me.heat) ? `Heat ${number(me.heat)}` : '');\n    }\n\n    function renderHeading() {\n"
        }
      ]
    },
    "public/strategy-command.js": {
      "current": {
        "mode": "100644",
        "blob": "c8e1d38e84fd4ce03114ec2674e6744c60cd1e9b",
        "sha256": "dc63d2437d7342dd1ec0c5a3774f25667518baae2fbed1ce3a341e5b8a9dddbc",
        "bytes": 25304
      },
      "baseline": {
        "mode": "100644",
        "blob": "5fa70acf1069f5702e3ddd253c46d34794509e09",
        "sha256": "a63f9217e539b6978db803f566db43328fd9da31f0cd25f3bd894e8c6aca5fe5",
        "bytes": 24976
      },
      "inverses": [
        {
          "at": 15380,
          "current": "        root?.remove(); root = createStage(desktop);\n      } else if (panel !== currentPanel || stage !== root) disposeRenderer();\n      panel = currentPanel; stage = root;\n      if (state().me?.onchainCrafting) panel.querySelectorAll('.start-first-week').forEach(node => node.remove());\n      const firstWeek = panel.querySelector('.start-first-week'), orders = stage.querySelector('.strategy-orders');\n      orders.hidden = !desktop;\n      if (desktop) {\n",
          "baseline": "        root?.remove(); root = createStage(desktop);\n      } else if (panel !== currentPanel || stage !== root) disposeRenderer();\n      panel = currentPanel; stage = root;\n      const firstWeek = panel.querySelector('.start-first-week'), orders = stage.querySelector('.strategy-orders');\n      orders.hidden = !desktop;\n      if (desktop) {\n"
        },
        {
          "at": 16348,
          "current": "\n    function paintOrders(orders) {\n      const { me, tabs } = state(), coach = me?.coach;\n      const migrated = !!me?.onchainCrafting;\n      const title = migrated ? 'Open your onchain garage' : coach?.label || 'Choose your next move';\n      const hint = migrated ? 'Read current cars, materials and action status from the chain in your garage.' : coach?.hint || 'Review the work available on the streets and choose an opportunity.';\n      let content = orders.querySelector('.strategy-current-order');\n      if (!content) {\n        content = document.createElement('section'); content.className = 'strategy-current-order'; content.innerHTML = '<p class=\"strategy-order-kicker\">YOUR NEXT ORDER</p><h3></h3><p class=\"strategy-order-hint\"></p><button type=\"button\"></button>'; orders.replaceChildren(content);\n      }\n      text(content.querySelector('h3'), title); text(content.querySelector('.strategy-order-hint'), hint);\n      const target = migrated ? 'garage' : coach?.tab && tabs?.[coach.tab] ? coach.tab : 'streets', button = content.querySelector('button');\n      text(button, `Open ${tabs?.[target] || 'Streets'}`); button.onclick = () => navigate(target);\n    }\n\n",
          "baseline": "\n    function paintOrders(orders) {\n      const { me, tabs } = state(), coach = me?.coach;\n      const title = coach?.label || 'Choose your next move', hint = coach?.hint || 'Review the work available on the streets and choose an opportunity.';\n      let content = orders.querySelector('.strategy-current-order');\n      if (!content) {\n        content = document.createElement('section'); content.className = 'strategy-current-order'; content.innerHTML = '<p class=\"strategy-order-kicker\">YOUR NEXT ORDER</p><h3></h3><p class=\"strategy-order-hint\"></p><button type=\"button\"></button>'; orders.replaceChildren(content);\n      }\n      text(content.querySelector('h3'), title); text(content.querySelector('.strategy-order-hint'), hint);\n      const target = coach?.tab && tabs?.[coach.tab] ? coach.tab : 'streets', button = content.querySelector('button');\n      text(button, `Open ${tabs?.[target] || 'Streets'}`); button.onclick = () => navigate(target);\n    }\n\n"
        }
      ]
    },
    "public/ux-identity.js": {
      "current": {
        "mode": "100644",
        "blob": "72fb3d569a053d5fbe2f796a0612ed28f6d9125e",
        "sha256": "af427ef5776bfbe4f671bb8a59bed865b758b814154554b025ba13bbed3675a9",
        "bytes": 21494
      },
      "baseline": {
        "mode": "100644",
        "blob": "86fece90a1c9af09ae766193033cef678ecd988b",
        "sha256": "6c95d5de538d710b5d506dbe1ad42baf5d55edb91bd42688c402ce5bd4cb644a",
        "bytes": 21336
      },
      "inverses": [
        {
          "at": 18183,
          "current": "      if (!scope()) return; codeBesideChoices();\n      const tab = state().currentTab; if (!['profile', 'estate', 'garage', 'port', 'life'].includes(tab)) return;\n      const parent = document.getElementById(`tab-${tab}`); if (!parent) return;\n      if (tab === 'garage' && state().me?.onchainCrafting) {\n        parent.querySelector(':scope > .ux-identity')?.remove(); signature = ''; return;\n      }\n      let host = parent.querySelector(':scope > .ux-identity');\n      const data = value(), next = JSON.stringify([tab, character, data, state().me.cars, state().me.trades, boards, pending]);\n      if (host && next === signature) return;\n",
          "baseline": "      if (!scope()) return; codeBesideChoices();\n      const tab = state().currentTab; if (!['profile', 'estate', 'garage', 'port', 'life'].includes(tab)) return;\n      const parent = document.getElementById(`tab-${tab}`); if (!parent) return;\n      let host = parent.querySelector(':scope > .ux-identity');\n      const data = value(), next = JSON.stringify([tab, character, data, state().me.cars, state().me.trades, boards, pending]);\n      if (host && next === signature) return;\n"
        }
      ]
    },
    "public/ux-navigation.js": {
      "current": {
        "mode": "100644",
        "blob": "09a3e234eb4071931bee0f05f23416ec7f3809a4",
        "sha256": "baf682a3ec4de922bc446b1e94eaed9a66f8f10ac5fc49645bbcb88cbb354b40",
        "bytes": 35678
      },
      "baseline": {
        "mode": "100644",
        "blob": "26bc7966bdef16f99ae12cf1286e94736c08d8f2",
        "sha256": "1295c1e3bed266ec992726815fe3eae194535cb428904e7b1b993ad2b6af3293",
        "bytes": 35488
      },
      "inverses": [
        {
          "at": 24416,
          "current": "      }\n    }\n    function contextualRules(panel) {\n      if (!panel) return;\n      if (state().currentTab === 'garage' && state().me?.onchainCrafting) {\n        panel.querySelectorAll('[data-ux-rules]').forEach(node => node.remove()); return;\n      }\n      if (panel.querySelector('[data-ux-rules]')) return;\n      const entry = RULES[state().currentTab];\n      if (!entry) return;\n      const details = document.createElement('details'); details.className = 'ux-context-rules'; details.dataset.uxRules = '';\n",
          "baseline": "      }\n    }\n    function contextualRules(panel) {\n      if (!panel || panel.querySelector('[data-ux-rules]')) return;\n      const entry = RULES[state().currentTab];\n      if (!entry) return;\n      const details = document.createElement('details'); details.className = 'ux-context-rules'; details.dataset.uxRules = '';\n"
        }
      ]
    },
    "public/ux-progression.js": {
      "current": {
        "mode": "100644",
        "blob": "cdc3c2b78894987b5887f38180535616e4545bd3",
        "sha256": "24baf2e3d04f27d4b0d81de41bb3075c6eaa7d4edc336d9073eac4e72c5d0ea6",
        "bytes": 50783
      },
      "baseline": {
        "mode": "100644",
        "blob": "3edc29b7a3ffad2aa721f50cf9725212c04a1e30",
        "sha256": "afa7aea0a043975ec7c8f55639a089196e8abe054d6324aa5bd5ed1654062ec6",
        "bytes": 50629
      },
      "inverses": [
        {
          "at": 47520,
          "current": "      if (['start', 'streets', 'empire'].includes(tab) && data.openingHidden !== character\n        && (data.opening?.actor === character || tab === 'start' && number(me.level) <= 5)) mount(active, 'opening', openingPanel);\n      else document.querySelectorAll('[data-ux-progression=\"opening\"]').forEach(host => host.remove());\n      if (tab === 'garage' && me.onchainCrafting) active?.querySelectorAll('[data-ux-progression=\"context-trades\"]').forEach(node => node.remove());\n      else if (tabTracks[tab]?.length) mount(active, 'context-trades', contextualTracks);\n      // Life's renderer already reads its four progression boards. Reuse observe() instead of\n      // racing those reads from refresh(). Extra archives load on entry, never on sheet polls.\n      const needs = tab === 'profile' ? ['skills', 'seasons', 'collection', 'content']\n",
          "baseline": "      if (['start', 'streets', 'empire'].includes(tab) && data.openingHidden !== character\n        && (data.opening?.actor === character || tab === 'start' && number(me.level) <= 5)) mount(active, 'opening', openingPanel);\n      else document.querySelectorAll('[data-ux-progression=\"opening\"]').forEach(host => host.remove());\n      if (tabTracks[tab]?.length) mount(active, 'context-trades', contextualTracks);\n      // Life's renderer already reads its four progression boards. Reuse observe() instead of\n      // racing those reads from refresh(). Extra archives load on entry, never on sheet polls.\n      const needs = tab === 'profile' ? ['skills', 'seasons', 'collection', 'content']\n"
        }
      ]
    },
    "src/game.js": {
      "current": {
        "mode": "100644",
        "blob": "959554f2d0ff7d2b795a3306556b7249105b996a",
        "sha256": "8587a22f47ba3b5dfb1c5b99e0e968cf6e18d9f30fe4989cc79fd7e6b1a2d533",
        "bytes": 231863
      },
      "baseline": {
        "mode": "100644",
        "blob": "c833190107a3f378e3513718d92ea02dbc04b347",
        "sha256": "f027bfa3c314c9d045a2446e9fef755fe8e4b67ac7ba49ceb0661302bac78654",
        "bytes": 231839
      },
      "inverses": [
        {
          "at": 149596,
          "current": "  const eff = (s) => effStat(ch[s], s, assets, gear);\n  const checkinState = checkinStateOf(ch, acct);\n  const checkinQuote = checkinQuoteOf(ch, acct, dayOf(), !!owned.checkinClaimed);\n  return { id: ch.id, name: ch.name, generation: ch.generation, level: lvl, onchainCrafting: false,\n    respect: Number(ch.respect), energy: Math.floor(Number(ch.energy)), nerve: Math.floor(Number(ch.nerve)),\n    health: Math.floor(Number(ch.health)), cash: Math.floor(Number(ch.cash)), bank: Math.floor(Number(ch.bank)),\n    omr: Number(acct.omr || 0), staked: Number(acct.staked || 0), rewards: Number(acct.rewards || 0),\n",
          "baseline": "  const eff = (s) => effStat(ch[s], s, assets, gear);\n  const checkinState = checkinStateOf(ch, acct);\n  const checkinQuote = checkinQuoteOf(ch, acct, dayOf(), !!owned.checkinClaimed);\n  return { id: ch.id, name: ch.name, generation: ch.generation, level: lvl,\n    respect: Number(ch.respect), energy: Math.floor(Number(ch.energy)), nerve: Math.floor(Number(ch.nerve)),\n    health: Math.floor(Number(ch.health)), cash: Math.floor(Number(ch.cash)), bank: Math.floor(Number(ch.bank)),\n    omr: Number(acct.omr || 0), staked: Number(acct.staked || 0), rewards: Number(acct.rewards || 0),\n"
        }
      ]
    },
    "src/server.js": {
      "current": {
        "mode": "100644",
        "blob": "e77f4de48b7ccb5b8f951363c02036003bcb9cd4",
        "sha256": "f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5",
        "bytes": 314279
      },
      "baseline": {
        "mode": "100644",
        "blob": "c0b381e05fd9e6029394a8cdd7449c7d30e2a8ef",
        "sha256": "248f866dd1269e350f92a5aeb2e5c7978741b9b42994f9e2b1a1268a37b7ffdc",
        "bytes": 313687
      },
      "inverses": [
        {
          "at": 14149,
          "current": "import { register as registerUxCoordination } from './ux-coordination.js';\nimport { register as registerUxInvestigation } from './ux-investigation.js';\nimport { registerTacticsRoutes, crimeWithDecisionContext } from './ux-tactics.js';\nimport { registerNativeGarageRoutes } from './nativegarage.js';\nimport { jobTaskPuzzle, missionPuzzle, crimePuzzle } from './task-puzzle-jobs.js';\nimport * as Duels from './duels.js';\nimport * as Clues from './clues.js';\n",
          "baseline": "import { register as registerUxCoordination } from './ux-coordination.js';\nimport { register as registerUxInvestigation } from './ux-investigation.js';\nimport { registerTacticsRoutes, crimeWithDecisionContext } from './ux-tactics.js';\nimport { jobTaskPuzzle, missionPuzzle, crimePuzzle } from './task-puzzle-jobs.js';\nimport * as Duels from './duels.js';\nimport * as Clues from './clues.js';\n"
        },
        {
          "at": 23273,
          "current": "  return { timer, check };\n}\n\nexport async function buildServer({ nativeGarageService } = {}) {\n  // ── PREFLIGHT (src/preflight.js) ────────────────────────────────────────────────────────────\n  // Every deploy check lives there as DATA, because the guards were never the weak part — the LIST\n  // was. It sat inline here, so each drop that added a test-only knob had to remember to come update\n",
          "baseline": "  return { timer, check };\n}\n\nexport async function buildServer() {\n  // ── PREFLIGHT (src/preflight.js) ────────────────────────────────────────────────────────────\n  // Every deploy check lives there as DATA, because the guards were never the weak part — the LIST\n  // was. It sat inline here, so each drop that added a test-only knob had to remember to come update\n"
        },
        {
          "at": 45887,
          "current": "      return reply.code(page.ready ? 200 : 503).header('Cache-Control', 'no-store').type('text/html; charset=utf-8').send(html);\n    });\n  }\n  for (const [file, contentType] of [['nativegarage.js', 'application/javascript'],\n    ['nativegarage-client.js', 'application/javascript'], ['nativegarage.css', 'text/css']]) {\n    app.get(`/${file}`, async (_req, reply) => reply.type(`${contentType}; charset=utf-8`)\n      .header('Cache-Control', 'public, max-age=300')\n      .send(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', file))));\n  }\n  app.get('/vendor/walletconnect.js', async (req, reply) => reply.type('application/javascript; charset=utf-8')\n    .header('Cache-Control', 'public, max-age=3600').send(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public/vendor/walletconnect.js'))));\n  app.get('/vendor/walletconnect-manifest.json', async (req, reply) => reply.type('application/json; charset=utf-8')\n",
          "baseline": "      return reply.code(page.ready ? 200 : 503).header('Cache-Control', 'no-store').type('text/html; charset=utf-8').send(html);\n    });\n  }\n  app.get('/vendor/walletconnect.js', async (req, reply) => reply.type('application/javascript; charset=utf-8')\n    .header('Cache-Control', 'public, max-age=3600').send(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public/vendor/walletconnect.js'))));\n  app.get('/vendor/walletconnect-manifest.json', async (req, reply) => reply.type('application/json; charset=utf-8')\n"
        },
        {
          "at": 186193,
          "current": "  registerUxCoordination(app, { pool, auth });\n  registerUxInvestigation(app, { pool, auth });\n  registerTacticsRoutes(app, { pool, auth, readCharacter: G.readCharacter });\n  registerNativeGarageRoutes(app, { auth, service: nativeGarageService });\n  registerCity(app, { pool, auth, onlineIds: () => [...wsClients.keys()],\n    activityRegistry: cityActivity, ownerActivityRegistry: cityOwnerActivity });\n  registerCityHomes(app, { pool, auth });\n",
          "baseline": "  registerUxCoordination(app, { pool, auth });\n  registerUxInvestigation(app, { pool, auth });\n  registerTacticsRoutes(app, { pool, auth, readCharacter: G.readCharacter });\n  registerCity(app, { pool, auth, onlineIds: () => [...wsClients.keys()],\n    activityRegistry: cityActivity, ownerActivityRegistry: cityOwnerActivity });\n  registerCityHomes(app, { pool, auth });\n"
        }
      ]
    },
    "test/gates.js": {
      "current": {
        "mode": "100644",
        "blob": "70271681f96baf24dbbbe37d66287c262ad5ed83",
        "sha256": "7efa56501608f71173a7a3ae54fd948850aaa981c7790835164b51b78ee0197f",
        "bytes": 511385
      },
      "baseline": {
        "mode": "100644",
        "blob": "5e8a574a5af9d8022b984cc4a248cdce21c42199",
        "sha256": "1915d2d8afbc62a16d012827ee750f014e43ea08ebf3392b7b5982a6294739a2",
        "bytes": 509091
      },
      "inverses": [
        {
          "at": 120179,
          "current": "  // (the stale-waiver assert below), so a mark that stops matching fails loudly instead of leaving\n  // a real pg site quietly waived.\n  const SAFE_CONCURRENT_SITES = [\n    { file: 'src/nativegarage.js', mark: \"client.getChainId(), client.getBlock({ blockTag: 'latest' })\",\n      why: 'viem RPC only; chain and latest block reads establish the chain context; this facade has no PostgreSQL handle or query' },\n    { file: 'src/nativegarage.js', mark: 'Object.entries(config.contracts).map(async ([name, pin]) => {',\n      why: 'viem RPC only; the five pinned contract runtimes are read at the same canonical block; no PostgreSQL handle or query' },\n    { file: 'src/nativegarage.js', mark: 'pins.map(async ([kind, name, expected]) => {',\n      why: 'viem RPC only; closed deployment binding getters are read at the same canonical block; no PostgreSQL handle or query' },\n    { file: 'src/nativegarage.js', mark: \"read('engine', 'profile', [id], ctx.number)\",\n      why: 'viem RPC only; profile, eligibility, energy, request and materials use the same canonical block; no PostgreSQL handle or query' },\n    { file: 'src/nativegarage.js', mark: \"read('drand', 'requests', [requestId], ctx.number)\",\n      why: 'viem RPC only; the beacon request and acquisition action are read at one canonical block before their binding is checked; no PostgreSQL handle or query' },\n    { file: 'src/nativegarage.js', mark: \"read('omr', 'balanceOf', [wallet], ctx.number)\",\n      why: 'viem RPC only; token balance, exact allowance and restricted payment policy are read at one canonical block; no PostgreSQL handle or query' },\n    { file: 'src/nativegarage.js', mark: \"read('module', 'provenance', [id], ctx.number)\",\n      why: 'viem RPC only; owned tool provenance and assignment are read at the same canonical block; no PostgreSQL handle or query' },\n    { file: 'src/nativegarage.js', mark: 'projection.cars.map(async tokenId => {',\n      why: 'viem RPC only; bounded indexed token IDs are checked against canonical ownership and provenance at one block; no PostgreSQL handle or query' },\n    { file: 'src/nativegarage.js', mark: 'projection.tools.map(async tokenId => {',\n      why: 'viem RPC only; bounded indexed token IDs are checked against canonical tool ownership and assignment at one block; no PostgreSQL handle or query' },\n    { file: 'src/genesisauction.js', mark: 'Object.values(c).map(async pin => {',\n      why: 'viem RPC only; configuration closes c to exactly five reviewed contract pins, getCode reads use the same block.number, and unchanged() rechecks that canonical block/chain before releasing status or calldata; no PostgreSQL handle or query' },\n    { file: 'src/genesisauction.js', mark: 'bindings.map(async ([name, fn, expected]) => {',\n",
          "baseline": "  // (the stale-waiver assert below), so a mark that stops matching fails loudly instead of leaving\n  // a real pg site quietly waived.\n  const SAFE_CONCURRENT_SITES = [\n    { file: 'src/genesisauction.js', mark: 'Object.values(c).map(async pin => {',\n      why: 'viem RPC only; configuration closes c to exactly five reviewed contract pins, getCode reads use the same block.number, and unchanged() rechecks that canonical block/chain before releasing status or calldata; no PostgreSQL handle or query' },\n    { file: 'src/genesisauction.js', mark: 'bindings.map(async ([name, fn, expected]) => {',\n"
        },
        {
          "at": 421825,
          "current": "    '      - run: npm ci',\n    '      - name: install chromium for the client harness',\n    '        run: npx playwright-core install --with-deps chromium',\n    '      - name: Native garage wallet flow and confirmed projections in the browser',\n    '        run: node test/nativegarage-browser.js',\n    '      - name: Invite gate and Crew invitation controls in the browser',\n    '        run: npm run test:invites:browser',\n    '      - name: Discovery-based player intel in the browser',\n",
          "baseline": "    '      - run: npm ci',\n    '      - name: install chromium for the client harness',\n    '        run: npx playwright-core install --with-deps chromium',\n    '      - name: Invite gate and Crew invitation controls in the browser',\n    '        run: npm run test:invites:browser',\n    '      - name: Discovery-based player intel in the browser',\n"
        }
      ]
    },
    "test/grand-strategy-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "1ea1ca6db425a398c252bcf4d3a61c18fd04442e",
        "sha256": "7126a06aa14fbc1ef22982a98220b9fb9cbee077a413ec6efce022dca129e817",
        "bytes": 15990
      },
      "baseline": {
        "mode": "100644",
        "blob": "041f7230763c34d61920f7f3906573c5166de303",
        "sha256": "f165807e0061115875f89e33f4a99c2bb638e9106898f056537feebccd4f2340",
        "bytes": 15675
      },
      "inverses": [
        {
          "at": 215,
          "current": "import { createHash } from 'node:crypto';\nimport { execFileSync, spawnSync } from 'node:child_process';\nimport { AGE_REMOVAL_SOURCE, ageRemovalHistoricalRecord } from '../tools/age-removal-source-transfer.js';\nimport { NATIVE_GARAGE_PREDECESSOR, assertNativeGarageCurrentSource, nativeGarageActual,\n  nativeGarageHistoricalInput, nativeGarageHistoricalEntry } from '../tools/native-garage-source-transfer.js';\nimport { GRAND_STRATEGY_SOURCE as source, GRAND_STRATEGY_PREDECESSOR, GRAND_STRATEGY_SCOPE,\n  GRAND_STRATEGY_GENERATED_FILES, GRAND_STRATEGY_RELEASE_FILES, grandStrategySourceDataBytes,\n  grandStrategyActual, qualifyGrandStrategySource, grandStrategyHistoricalInput,\n",
          "baseline": "import { createHash } from 'node:crypto';\nimport { execFileSync, spawnSync } from 'node:child_process';\nimport { AGE_REMOVAL_SOURCE, ageRemovalHistoricalRecord } from '../tools/age-removal-source-transfer.js';\nimport { GRAND_STRATEGY_SOURCE as source, GRAND_STRATEGY_PREDECESSOR, GRAND_STRATEGY_SCOPE,\n  GRAND_STRATEGY_GENERATED_FILES, GRAND_STRATEGY_RELEASE_FILES, grandStrategySourceDataBytes,\n  grandStrategyActual, qualifyGrandStrategySource, grandStrategyHistoricalInput,\n"
        },
        {
          "at": 2566,
          "current": "assert.deepEqual([...Object.keys(source.files), ...Object.keys(source.additions)].sort(),\n  GRAND_STRATEGY_SCOPE.filter(file => !excluded.has(file)), 'Every authored runtime, test, helper and binary asset has one exact pin');\nfor (const file of excluded) assert(!Object.hasOwn(source.files, file) && !Object.hasOwn(source.additions, file));\nassertNativeGarageCurrentSource();\nconst postCandidate = git('diff', '--name-only', '--no-renames', '-z', source.revision, NATIVE_GARAGE_PREDECESSOR).split('\\0').filter(Boolean);\nassert(postCandidate.every(file => excluded.has(file)), 'Only the fixed independently generated domains may follow the reviewed candidate');\nassert.equal(fs.readFileSync('tools/grand-strategy-source-data.js', 'utf8').replaceAll('\\r\\n', '\\n'), grandStrategySourceDataBytes(source),\n  'The sole generated self-reference contains exact data and no executable additions');\n",
          "baseline": "assert.deepEqual([...Object.keys(source.files), ...Object.keys(source.additions)].sort(),\n  GRAND_STRATEGY_SCOPE.filter(file => !excluded.has(file)), 'Every authored runtime, test, helper and binary asset has one exact pin');\nfor (const file of excluded) assert(!Object.hasOwn(source.files, file) && !Object.hasOwn(source.additions, file));\nconst postCandidate = git('diff', '--name-only', '--no-renames', '-z', source.revision, 'HEAD').split('\\0').filter(Boolean);\nassert(postCandidate.every(file => excluded.has(file)), 'Only the fixed independently generated domains may follow the reviewed candidate');\nassert.equal(fs.readFileSync('tools/grand-strategy-source-data.js', 'utf8').replaceAll('\\r\\n', '\\n'), grandStrategySourceDataBytes(source),\n  'The sole generated self-reference contains exact data and no executable additions');\n"
        },
        {
          "at": 4069,
          "current": "const heads = rows(git('ls-tree', '-z', 'HEAD', '--', ...names));\nconst indexes = rows(git('ls-files', '--stage', '-z', '--', ...names));\nfor (const [file, pin] of Object.entries(pins)) {\n  assert.equal(nativeGarageHistoricalEntry(file, heads.get(file), 'tree'), entry(file, pin, 'tree'), 'Whole genuine HEAD identity: ' + file);\n  assert.equal(nativeGarageHistoricalEntry(file, indexes.get(file), 'index'), entry(file, pin, 'index'), 'Whole genuine stage-zero identity: ' + file);\n  const stat = fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink());\n  const physical = nativeGarageHistoricalInput(file, fs.readFileSync(file));\n  let canonical = physical;\n  if (pin.text) {\n    const raw = physical.toString('utf8'); assert(Buffer.from(raw).equals(physical));\n",
          "baseline": "const heads = rows(git('ls-tree', '-z', 'HEAD', '--', ...names));\nconst indexes = rows(git('ls-files', '--stage', '-z', '--', ...names));\nfor (const [file, pin] of Object.entries(pins)) {\n  assert.equal(heads.get(file), entry(file, pin, 'tree'), 'Whole genuine HEAD identity: ' + file);\n  assert.equal(indexes.get(file), entry(file, pin, 'index'), 'Whole genuine stage-zero identity: ' + file);\n  const stat = fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink());\n  const physical = fs.readFileSync(file);\n  let canonical = physical;\n  if (pin.text) {\n    const raw = physical.toString('utf8'); assert(Buffer.from(raw).equals(physical));\n"
        },
        {
          "at": 7744,
          "current": "  assert.throws(() => grandStrategyHistoricalInput(file, invalid), /Lossless UTF-8/); refusals += 2;\n}\nconst observedFile = 'public/index.html', observed = grandStrategyActual(observedFile);\nconst currentObserved = nativeGarageActual(observedFile);\nconst priorObserved = grandStrategyHistoricalRecord(observedFile, observed);\nfor (const file of ['public/index.html', 'public/sw.js', 'src/server.js']) {\n  const actual = grandStrategyActual(file), pin = AGE_REMOVAL_SOURCE.files[file].baseline;\n",
          "baseline": "  assert.throws(() => grandStrategyHistoricalInput(file, invalid), /Lossless UTF-8/); refusals += 2;\n}\nconst observedFile = 'public/index.html', observed = grandStrategyActual(observedFile);\nconst priorObserved = grandStrategyHistoricalRecord(observedFile, observed);\nfor (const file of ['public/index.html', 'public/sw.js', 'src/server.js']) {\n  const actual = grandStrategyActual(file), pin = AGE_REMOVAL_SOURCE.files[file].baseline;\n"
        },
        {
          "at": 10919,
          "current": "  const environment = { ...process.env, GIT_DIR: git('rev-parse', '--absolute-git-dir').trim(),\n    GIT_WORK_TREE: temporary, GIT_INDEX_FILE: path.join(temporary, 'reviewed-index') };\n  execFileSync('git', ['--no-replace-objects', 'read-tree', 'HEAD'], { cwd: temporary, env: environment, windowsHide: true });\n  fs.mkdirSync(path.join(temporary, 'public')); fs.writeFileSync(path.join(temporary, observedFile), currentObserved.physical);\n  const script = 'import { grandStrategyActual } from ' + JSON.stringify(new URL('../tools/grand-strategy-source-transfer.js', import.meta.url).href)\n    + '; grandStrategyActual(' + JSON.stringify(observedFile) + ');';\n  const child = (env, code = script) => spawnSync(process.execPath, ['--input-type=module', '-e', code], {\n",
          "baseline": "  const environment = { ...process.env, GIT_DIR: git('rev-parse', '--absolute-git-dir').trim(),\n    GIT_WORK_TREE: temporary, GIT_INDEX_FILE: path.join(temporary, 'reviewed-index') };\n  execFileSync('git', ['--no-replace-objects', 'read-tree', 'HEAD'], { cwd: temporary, env: environment, windowsHide: true });\n  fs.mkdirSync(path.join(temporary, 'public')); fs.writeFileSync(path.join(temporary, observedFile), observed.physical);\n  const script = 'import { grandStrategyActual } from ' + JSON.stringify(new URL('../tools/grand-strategy-source-transfer.js', import.meta.url).href)\n    + '; grandStrategyActual(' + JSON.stringify(observedFile) + ');';\n  const child = (env, code = script) => spawnSync(process.execPath, ['--input-type=module', '-e', code], {\n"
        },
        {
          "at": 12066,
          "current": "    + '; const pin = source.files[file].baseline; const bytes = execFileSync(\"git\", [\"--no-replace-objects\", \"show\", source.predecessor + \":\" + file], { maxBuffer: 64 * 1024 * 1024, windowsHide: true });'\n    + ' grandStrategyHistoricalRecord(file, { head: { mode: pin.mode, blob: pin.blob }, index: pin.mode + \" \" + pin.blob + \" 0\\\\t\" + file,'\n    + ' committed: bytes, physical: bytes, regular: true, symbolic: false });';\n  const currentRecordScript = ending => 'import { nativeGarageActual, nativeGarageHistoricalRecord } from '\n    + JSON.stringify(new URL('../tools/native-garage-source-transfer.js', import.meta.url).href)\n    + '; import { grandStrategyHistoricalRecord } from ' + JSON.stringify(new URL('../tools/grand-strategy-source-transfer.js', import.meta.url).href)\n    + '; import { ageRemovalHistoricalRecord } from ' + JSON.stringify(new URL('../tools/age-removal-source-transfer.js', import.meta.url).href)\n    + '; const file = ' + JSON.stringify(observedFile) + '; const actual = nativeGarageHistoricalRecord(file, nativeGarageActual(file));'\n    + ' actual.physical = ' + (ending === 'LF' ? 'actual.committed' : 'Buffer.from(actual.committed.toString(\"utf8\").replaceAll(\"\\\\n\", \"\\\\r\\\\n\"))') + ';'\n    + ' for (const qualify of [grandStrategyHistoricalRecord, ageRemovalHistoricalRecord]) qualify(file, actual);';\n  assert.equal(child(environment).status, 0, 'Genuine closed source succeeds in an isolated checkout');\n  assert.equal(child(environment, historicalScript).status, 0, 'Historical tuples are idempotent only after genuine current admission');\n  for (const physical of [currentObserved.committed, Buffer.from(currentObserved.committed.toString('utf8').replaceAll('\\n', '\\r\\n'))]) {\n    fs.writeFileSync(path.join(temporary, observedFile), physical);\n    for (const ending of ['LF', 'CRLF']) {\n      assert.equal(child(environment, currentRecordScript(ending)).status, 0,\n        'Genuine LF/CRLF disk bytes admit either whole supplied representation through the historical chain'); positives += 2;\n    }\n  }\n  fs.writeFileSync(path.join(temporary, observedFile), currentObserved.physical);\n  fs.appendFileSync(path.join(temporary, observedFile), 'x');\n  const changed = child(environment); assert.notEqual(changed.status, 0); assert.match(changed.stderr, /Physical source/); refusals++;\n  const forgedPrior = child(environment, historicalScript); assert.notEqual(forgedPrior.status, 0);\n  assert.match(forgedPrior.stderr, /Physical source/); refusals++;\n  const forgedCurrent = child(environment, currentRecordScript('LF')); assert.notEqual(forgedCurrent.status, 0);\n  assert.match(forgedCurrent.stderr, /Physical source/); refusals++;\n  fs.writeFileSync(path.join(temporary, observedFile), currentObserved.physical);\n  const changedIndex = child({ ...environment, GIT_INDEX_FILE: path.join(temporary, 'empty-index') });\n  assert.notEqual(changedIndex.status, 0); assert.match(changedIndex.stderr, /stage-zero index/); refusals++;\n  const forgedIndex = child({ ...environment, GIT_INDEX_FILE: path.join(temporary, 'empty-index') }, historicalScript);\n",
          "baseline": "    + '; const pin = source.files[file].baseline; const bytes = execFileSync(\"git\", [\"--no-replace-objects\", \"show\", source.predecessor + \":\" + file], { maxBuffer: 64 * 1024 * 1024, windowsHide: true });'\n    + ' grandStrategyHistoricalRecord(file, { head: { mode: pin.mode, blob: pin.blob }, index: pin.mode + \" \" + pin.blob + \" 0\\\\t\" + file,'\n    + ' committed: bytes, physical: bytes, regular: true, symbolic: false });';\n  const currentRecordScript = ending => 'import { execFileSync } from \"node:child_process\"; import { GRAND_STRATEGY_SOURCE as source, grandStrategyHistoricalRecord } from '\n    + JSON.stringify(new URL('../tools/grand-strategy-source-transfer.js', import.meta.url).href)\n    + '; import { ageRemovalHistoricalRecord } from ' + JSON.stringify(new URL('../tools/age-removal-source-transfer.js', import.meta.url).href)\n    + '; const file = ' + JSON.stringify(observedFile)\n    + '; const pin = source.files[file].current; const bytes = execFileSync(\"git\", [\"--no-replace-objects\", \"show\", \"HEAD:\" + file], { maxBuffer: 64 * 1024 * 1024, windowsHide: true });'\n    + ' const physical = ' + (ending === 'LF' ? 'bytes' : 'Buffer.from(bytes.toString(\"utf8\").replaceAll(\"\\\\n\", \"\\\\r\\\\n\"))') + ';'\n    + ' for (const qualify of [grandStrategyHistoricalRecord, ageRemovalHistoricalRecord]) qualify(file, { head: { mode: pin.mode, blob: pin.blob }, index: pin.mode + \" \" + pin.blob + \" 0\\\\t\" + file,'\n    + ' committed: bytes, physical, regular: true, symbolic: false });';\n  assert.equal(child(environment).status, 0, 'Genuine closed source succeeds in an isolated checkout');\n  assert.equal(child(environment, historicalScript).status, 0, 'Historical tuples are idempotent only after genuine current admission');\n  for (const physical of [observed.committed, Buffer.from(observed.committed.toString('utf8').replaceAll('\\n', '\\r\\n'))]) {\n    fs.writeFileSync(path.join(temporary, observedFile), physical);\n    for (const ending of ['LF', 'CRLF']) {\n      assert.equal(child(environment, currentRecordScript(ending)).status, 0,\n        'Genuine LF/CRLF disk bytes admit either whole supplied representation through the historical chain'); positives += 2;\n    }\n  }\n  fs.writeFileSync(path.join(temporary, observedFile), observed.physical);\n  fs.appendFileSync(path.join(temporary, observedFile), 'x');\n  const changed = child(environment); assert.notEqual(changed.status, 0); assert.match(changed.stderr, /Physical source/); refusals++;\n  const forgedPrior = child(environment, historicalScript); assert.notEqual(forgedPrior.status, 0);\n  assert.match(forgedPrior.stderr, /Physical source/); refusals++;\n  const forgedCurrent = child(environment, currentRecordScript('LF')); assert.notEqual(forgedCurrent.status, 0);\n  assert.match(forgedCurrent.stderr, /Physical source/); refusals++;\n  fs.writeFileSync(path.join(temporary, observedFile), observed.physical);\n  const changedIndex = child({ ...environment, GIT_INDEX_FILE: path.join(temporary, 'empty-index') });\n  assert.notEqual(changedIndex.status, 0); assert.match(changedIndex.stderr, /stage-zero index/); refusals++;\n  const forgedIndex = child({ ...environment, GIT_INDEX_FILE: path.join(temporary, 'empty-index') }, historicalScript);\n"
        }
      ]
    },
    "test/task-puzzle-native-integration-guard.js": {
      "current": {
        "mode": "100644",
        "blob": "2f74f1e1445b07e29dda1a73e4a20cbd0084026c",
        "sha256": "18bd1d6e41566dbb346124ea23751dc48c453c80122bc997c22516056edd2418",
        "bytes": 75711
      },
      "baseline": {
        "mode": "100644",
        "blob": "6740b98c8498de90102519ac97d86a777cfaa287",
        "sha256": "43aa717a602f60fb3cf1f81c0c0457fae2b46f9f0785e862c1e2e1f6cf331ba4",
        "bytes": 75588
      },
      "inverses": [
        {
          "at": 282,
          "current": "import { parse } from 'acorn';\nimport { commerceCurrentDeedSources } from '../tools/commerce-deed-release-phase2-native-catalog.js';\nimport { ageRemovalHistoricalInput } from '../tools/age-removal-source-transfer.js';\nimport { nativeGarageHistoricalInput } from '../tools/native-garage-source-transfer.js';\nimport { deedQuestSourceBaseline } from '../tools/deed-quest-source-transfer.js';\nimport { questingCatalogSource } from '../tools/questing-enterprise-catalog.js';\nimport { ENTERPRISE_NATIVE_UX_INPUTS as immutablePredecessor, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as immutablePredecessorHash } from '../tools/enterprise-native-contract-release-inputs.js';\n",
          "baseline": "import { parse } from 'acorn';\nimport { commerceCurrentDeedSources } from '../tools/commerce-deed-release-phase2-native-catalog.js';\nimport { ageRemovalHistoricalInput } from '../tools/age-removal-source-transfer.js';\nimport { deedQuestSourceBaseline } from '../tools/deed-quest-source-transfer.js';\nimport { questingCatalogSource } from '../tools/questing-enterprise-catalog.js';\nimport { ENTERPRISE_NATIVE_UX_INPUTS as immutablePredecessor, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as immutablePredecessorHash } from '../tools/enterprise-native-contract-release-inputs.js';\n"
        },
        {
          "at": 49955,
          "current": "      assert.deepEqual(trace,['source','admit','initial-live','initial-literal','positive-references','live47','projection','retained-live','profile','final-live','stable','prior-verify']);\n    }\n    for(const file of ['tools/task-puzzle-enterprise-catalog.js','test/enterprise-release-phase2-migration-catalog.js','test/phase2-postgres.js','test/director-migration.js','tools/enterprise-native-questing.js','schema.sql']){\n      assert.equal(nativeGarageHistoricalInput(file,fs.readFileSync(file,'utf8')).replaceAll('\\r\\n','\\n'),execFileSync('git',['--no-replace-objects','show','0a3b4aba5b0940bcbc70ef79ddabae53cb4a07c7:'+file],{encoding:'utf8',windowsHide:true,maxBuffer:32e6}),'Exact caller, Enterprise inventory/order/budgets and schema: '+file);\n    }\n    const enterpriseText=fs.readFileSync('test/enterprise-release-phase2-migration-catalog.js','utf8').replaceAll('\\r\\n','\\n');\n    const first=enterpriseText.indexOf('      assert.equal(result.actualTables,586);'),end=enterpriseText.indexOf('      console.log(JSON.stringify({phase:result.phase',first);assert(first>0&&end>first);\n",
          "baseline": "      assert.deepEqual(trace,['source','admit','initial-live','initial-literal','positive-references','live47','projection','retained-live','profile','final-live','stable','prior-verify']);\n    }\n    for(const file of ['tools/task-puzzle-enterprise-catalog.js','test/enterprise-release-phase2-migration-catalog.js','test/phase2-postgres.js','test/director-migration.js','tools/enterprise-native-questing.js','schema.sql']){\n      assert.equal(fs.readFileSync(file,'utf8').replaceAll('\\r\\n','\\n'),execFileSync('git',['--no-replace-objects','show','0a3b4aba5b0940bcbc70ef79ddabae53cb4a07c7:'+file],{encoding:'utf8',windowsHide:true,maxBuffer:32e6}),'Exact caller, Enterprise inventory/order/budgets and schema: '+file);\n    }\n    const enterpriseText=fs.readFileSync('test/enterprise-release-phase2-migration-catalog.js','utf8').replaceAll('\\r\\n','\\n');\n    const first=enterpriseText.indexOf('      assert.equal(result.actualTables,586);'),end=enterpriseText.indexOf('      console.log(JSON.stringify({phase:result.phase',first);assert(first>0&&end>first);\n"
        }
      ]
    },
    "tools/enterprise-native-questing.js": {
      "current": {
        "mode": "100644",
        "blob": "9c96e4e7edacd78cddf9c7f7b1c179e038f43185",
        "sha256": "8c54c69eecd9ba81fef7a9d9d1402904d3067c14d59c85875de1e828775592f2",
        "bytes": 27732
      },
      "baseline": {
        "mode": "100644",
        "blob": "ed54afe500d395be798cef44490dcc3f0610c8a9",
        "sha256": "18f9542d5fb438c37f2fa4d3768ee010b2124289a2f689d113d8ac464a97762e",
        "bytes": 26688
      },
      "inverses": [
        {
          "at": 750,
          "current": "import { enterpriseUxImports, enterpriseUxMetadataBytes } from './enterprise-native-ux.js';\nimport { ENTERPRISE_NATIVE_UX_INPUTS as predecessor, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as predecessorHash } from './enterprise-native-contract-release-inputs.js';\nimport { QUESTING_ENTERPRISE_NATIVE_INPUTS as declaration, QUESTING_ENTERPRISE_NATIVE_INPUTS_SHA256 as declarationHash } from './enterprise-native-questing-inputs.js';\nimport {\n  nativeGarageEnterprisePredecessor, assertNativeGarageEnterpriseClosure,\n  nativeGarageEnterpriseScope, nativeGarageEnterpriseHistoricalInput, nativeGarageEnterpriseBinary,\n} from './native-garage-enterprise-source.js';\n\nexport const QUESTING_NATIVE_METADATA = 'tools/enterprise-native-questing-inputs.js';\nexport const QUESTING_NATIVE_PREDECESSOR_METADATA = 'tools/enterprise-native-contract-release-inputs.js';\n",
          "baseline": "import { enterpriseUxImports, enterpriseUxMetadataBytes } from './enterprise-native-ux.js';\nimport { ENTERPRISE_NATIVE_UX_INPUTS as predecessor, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as predecessorHash } from './enterprise-native-contract-release-inputs.js';\nimport { QUESTING_ENTERPRISE_NATIVE_INPUTS as declaration, QUESTING_ENTERPRISE_NATIVE_INPUTS_SHA256 as declarationHash } from './enterprise-native-questing-inputs.js';\n\nexport const QUESTING_NATIVE_METADATA = 'tools/enterprise-native-questing-inputs.js';\nexport const QUESTING_NATIVE_PREDECESSOR_METADATA = 'tools/enterprise-native-contract-release-inputs.js';\n"
        },
        {
          "at": 9857,
          "current": "function assertQuestingTrackedPin(file, current, authored, bytes, expected) {\n  assert.ok(expected, `No undeclared actual-current native input: ${file}`);\n  assert.ok(Buffer.isBuffer(bytes) && current && authored);\n  ({ current, bytes } = nativeGarageEnterprisePredecessor(file, current, bytes, expected));\n  assert.equal(current.type, 'blob'); assert.equal(authored.type, 'blob');\n  assert.equal(current.mode, expected.mode); assert.equal(authored.mode, expected.mode);\n  assert.equal(current.blob, expected.blob, 'Actual HEAD input differs from its new native pin');\n",
          "baseline": "function assertQuestingTrackedPin(file, current, authored, bytes, expected) {\n  assert.ok(expected, `No undeclared actual-current native input: ${file}`);\n  assert.ok(Buffer.isBuffer(bytes) && current && authored);\n  assert.equal(current.type, 'blob'); assert.equal(authored.type, 'blob');\n  assert.equal(current.mode, expected.mode); assert.equal(authored.mode, expected.mode);\n  assert.equal(current.blob, expected.blob, 'Actual HEAD input differs from its new native pin');\n"
        },
        {
          "at": 12613,
          "current": "    assert.ok(stat.isFile() && !stat.isSymbolicLink(), `Physical regular input: ${file}`);\n    const raw = fs.readFileSync(full); assert.equal(stat.size, raw.length);\n    const canonical = blob(raw) === row.blob ? raw : Buffer.from(raw.toString('utf8').replaceAll('\\r\\n', '\\n'));\n    assertEnterpriseNativeTrackedBytes(raw, canonical, nativeGarageEnterpriseBinary(file, binary.has(file)));\n    assert.equal(blob(canonical), row.blob, `Physical input equals actual Git bytes: ${file}`);\n    const result = { canonical, raw, pin: Object.freeze({ file, mode: row.mode, blob: row.blob, sha256: sha(canonical) }) };\n    cache.set(file, result); return result;\n",
          "baseline": "    assert.ok(stat.isFile() && !stat.isSymbolicLink(), `Physical regular input: ${file}`);\n    const raw = fs.readFileSync(full); assert.equal(stat.size, raw.length);\n    const canonical = blob(raw) === row.blob ? raw : Buffer.from(raw.toString('utf8').replaceAll('\\r\\n', '\\n'));\n    assertEnterpriseNativeTrackedBytes(raw, canonical, binary.has(file));\n    assert.equal(blob(canonical), row.blob, `Physical input equals actual Git bytes: ${file}`);\n    const result = { canonical, raw, pin: Object.freeze({ file, mode: row.mode, blob: row.blob, sha256: sha(canonical) }) };\n    cache.set(file, result); return result;\n"
        },
        {
          "at": 15291,
          "current": "  const records = tree(revision), current = new Map(records.map(row => [row.file, row]));\n  const authored = new Map(tree(declaration.authoredRevision).map(row => [row.file, row]));\n  const read = actualReader(records), files = {};\n  const actualClosure = questingNativeClosure(file => read(file).canonical);\n  const historicalClosure = questingNativeClosure(file => nativeGarageEnterpriseHistoricalInput(file, read(file).canonical));\n  assertNativeGarageEnterpriseClosure(actualClosure, historicalClosure, declaration.files.map(row => row.file));\n  for (const expected of declaration.files) {\n    const actual = read(expected.file);\n    const original = authored.get(expected.file);\n    assertQuestingTrackedPin(expected.file, current.get(expected.file), original, actual.canonical, expected);\n    files[expected.file] = { sha256: sha(actual.raw), gitSha256: actual.pin.sha256, blob: actual.pin.blob, binary: nativeGarageEnterpriseBinary(expected.file, binary.has(expected.file)), bytes: actual.raw.length };\n  }\n  // Fresh native proofs exercise the real successor. Keep every scoped byte in\n  // their stability receipt, including browser assets outside the JS traversal.\n  for (const file of new Set([...actualClosure, ...nativeGarageEnterpriseScope()])) {\n    if (Object.hasOwn(files, file)) continue;\n    const actual = read(file);\n    files[file] = { sha256: sha(actual.raw), gitSha256: actual.pin.sha256, blob: actual.pin.blob,\n      binary: nativeGarageEnterpriseBinary(file, binary.has(file)), bytes: actual.raw.length };\n  }\n  const metadata = read(QUESTING_NATIVE_METADATA), originalMetadata = authored.get(QUESTING_NATIVE_METADATA);\n  assert.ok(originalMetadata && originalMetadata.type === 'blob'); assert.equal(metadata.pin.mode, originalMetadata.mode);\n",
          "baseline": "  const records = tree(revision), current = new Map(records.map(row => [row.file, row]));\n  const authored = new Map(tree(declaration.authoredRevision).map(row => [row.file, row]));\n  const read = actualReader(records), files = {};\n  assert.deepEqual(questingNativeClosure(file => read(file).canonical), declaration.files.map(row => row.file), 'Complete actual current import/asset closure');\n  for (const expected of declaration.files) {\n    const actual = read(expected.file); assert.deepEqual(actual.pin, expected);\n    const original = authored.get(expected.file);\n    assertQuestingTrackedPin(expected.file, current.get(expected.file), original, actual.canonical, expected);\n    files[expected.file] = { sha256: sha(actual.raw), gitSha256: expected.sha256, blob: expected.blob, binary: binary.has(expected.file), bytes: actual.raw.length };\n  }\n  const metadata = read(QUESTING_NATIVE_METADATA), originalMetadata = authored.get(QUESTING_NATIVE_METADATA);\n  assert.ok(originalMetadata && originalMetadata.type === 'blob'); assert.equal(metadata.pin.mode, originalMetadata.mode);\n"
        }
      ]
    },
    "tools/grand-strategy-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "1bcfaee1198cbb44c78ca98628b3e70312e89d7d",
        "sha256": "ea37a1b91ba65ffe360577b57f668cf49e0f01876dca5f840f129eb24d6e75ec",
        "bytes": 16189
      },
      "baseline": {
        "mode": "100644",
        "blob": "fa3e2181dd25e67015363a007110018747a34568",
        "sha256": "0a76d88ec53c23e48045a3702f647da8164d841e42a12f1236f66c1482ccf1dd",
        "bytes": 15556
      },
      "inverses": [
        {
          "at": 141,
          "current": "import { createHash } from 'node:crypto';\nimport { execFileSync } from 'node:child_process';\nimport { GRAND_STRATEGY_SOURCE, GRAND_STRATEGY_SOURCE_SHA256 } from './grand-strategy-source-data.js';\nimport { nativeGarageHistoricalInput, nativeGarageHistoricalEntry, nativeGarageHistoricalRecord } from './native-garage-source-transfer.js';\n\nexport { GRAND_STRATEGY_SOURCE };\nexport const GRAND_STRATEGY_PREDECESSOR = '7d52e1f08dc9540b182553b70dedfce4fecfac22';\n",
          "baseline": "import { createHash } from 'node:crypto';\nimport { execFileSync } from 'node:child_process';\nimport { GRAND_STRATEGY_SOURCE, GRAND_STRATEGY_SOURCE_SHA256 } from './grand-strategy-source-data.js';\n\nexport { GRAND_STRATEGY_SOURCE };\nexport const GRAND_STRATEGY_PREDECESSOR = '7d52e1f08dc9540b182553b70dedfce4fecfac22';\n"
        },
        {
          "at": 10779,
          "current": "  assert(pin, 'Only a finite reviewed successor domain');\n  const headEntry = git('ls-tree', 'HEAD', '--', file).trim();\n  const index = git('ls-files', '--stage', '--', file).trim();\n  const stat = fs.lstatSync(file), physical = fs.readFileSync(file);\n  assert(stat.isFile() && !stat.isSymbolicLink(), 'Regular physical reviewed source required');\n  const raw = execFileSync('git', ['--no-replace-objects', 'show', 'HEAD:' + file], {\n    windowsHide: true, maxBuffer: 64 * 1024 * 1024,\n  });\n  const head = headEntry.match(/^(100644|100755) blob ([a-f0-9]{40})\\t/);\n  assert(head, 'Regular genuine HEAD blob required');\n  const actual = nativeGarageHistoricalRecord(file, { head: { mode: head[1], blob: head[2] }, index,\n    committed: raw, physical, regular: stat.isFile(), symbolic: stat.isSymbolicLink() });\n  assert.equal(entry(file, actual.head, 'tree'), entry(file, pin, 'tree'), 'Genuine current HEAD must equal reviewed successor');\n  assert.equal(actual.index, entry(file, pin, 'index'), 'Genuine stage-zero index must equal reviewed successor');\n  const committed = actual.committed;\n  fingerprint(committed, pin);\n  if (source.files[file] || pin.text) {\n    const current = canonical(committed);\n    assert(current && !committed.includes(13), 'Canonical committed LF UTF-8 source');\n    assert(actual.physical.equals(committed) || actual.physical.equals(Buffer.from(current.lf.replaceAll('\\n', '\\r\\n'))),\n      'Physical source must equal whole current HEAD in LF or uniform CRLF');\n  } else assert(actual.physical.equals(committed), 'Binary source is admitted only byte-for-byte');\n  return actual;\n}\nfunction baselineText(file, input) {\n  const current = canonical(input); assert(current, 'Uniform complete LF/CRLF source required');\n",
          "baseline": "  assert(pin, 'Only a finite reviewed successor domain');\n  const headEntry = git('ls-tree', 'HEAD', '--', file).trim();\n  const index = git('ls-files', '--stage', '--', file).trim();\n  assert.equal(headEntry, entry(file, pin, 'tree'), 'Genuine current HEAD must equal reviewed successor');\n  assert.equal(index, entry(file, pin, 'index'), 'Genuine stage-zero index must equal reviewed successor');\n  const stat = fs.lstatSync(file), physical = fs.readFileSync(file);\n  assert(stat.isFile() && !stat.isSymbolicLink(), 'Regular physical reviewed source required');\n  const committed = execFileSync('git', ['--no-replace-objects', 'show', 'HEAD:' + file], {\n    windowsHide: true, maxBuffer: 64 * 1024 * 1024,\n  });\n  fingerprint(committed, pin);\n  if (source.files[file] || pin.text) {\n    const current = canonical(committed);\n    assert(current && !committed.includes(13), 'Canonical committed LF UTF-8 source');\n    assert(physical.equals(committed) || physical.equals(Buffer.from(current.lf.replaceAll('\\n', '\\r\\n'))),\n      'Physical source must equal whole current HEAD in LF or uniform CRLF');\n  } else assert(physical.equals(committed), 'Binary source is admitted only byte-for-byte');\n  return { head: { mode: pin.mode, blob: pin.blob }, index, committed, physical,\n    regular: stat.isFile(), symbolic: stat.isSymbolicLink() };\n}\nfunction baselineText(file, input) {\n  const current = canonical(input); assert(current, 'Uniform complete LF/CRLF source required');\n"
        },
        {
          "at": 13099,
          "current": "  return { current, restored };\n}\nexport function qualifyGrandStrategySource(file, input) {\n  input = nativeGarageHistoricalInput(file, input);\n  assert.equal(arguments.length, 2); definition(); assert(known(file), 'No predecessor reconstruction for added or unknown source');\n  const result = baselineText(file, input);\n  grandStrategyActual(file);\n",
          "baseline": "  return { current, restored };\n}\nexport function qualifyGrandStrategySource(file, input) {\n  assert.equal(arguments.length, 2); definition(); assert(known(file), 'No predecessor reconstruction for added or unknown source');\n  const result = baselineText(file, input);\n  grandStrategyActual(file);\n"
        },
        {
          "at": 13602,
          "current": "}\n// Unknown input passes unchanged to the original refusing historical qualifier.\nexport function grandStrategyHistoricalInput(file, input) {\n  input = nativeGarageHistoricalInput(file, input);\n  if (!known(file)) return input;\n  const current = canonical(input);\n  if (!current || sha(current.lf) !== source.files[file].current.sha256) return input;\n",
          "baseline": "}\n// Unknown input passes unchanged to the original refusing historical qualifier.\nexport function grandStrategyHistoricalInput(file, input) {\n  if (!known(file)) return input;\n  const current = canonical(input);\n  if (!current || sha(current.lf) !== source.files[file].current.sha256) return input;\n"
        },
        {
          "at": 14091,
          "current": "}\nexport function grandStrategyHistoricalEntry(file, input, kind) {\n  assert(kind === 'tree' || kind === 'index');\n  input = nativeGarageHistoricalEntry(file, input, kind);\n  if (!known(file)) return input;\n  const row = source.files[file], expected = entry(file, row.current, kind);\n  if (input !== expected && input !== expected + '\\n') return input;\n",
          "baseline": "}\nexport function grandStrategyHistoricalEntry(file, input, kind) {\n  assert(kind === 'tree' || kind === 'index');\n  if (!known(file)) return input;\n  const row = source.files[file], expected = entry(file, row.current, kind);\n  if (input !== expected && input !== expected + '\\n') return input;\n"
        },
        {
          "at": 14552,
          "current": "}\nexport function grandStrategyHistoricalRecord(file, actual) {\n  assert.equal(arguments.length, 2);\n  actual = nativeGarageHistoricalRecord(file, actual);\n  if (!known(file)) return actual;\n  definition(); shape(actual);\n  const row = source.files[file];\n",
          "baseline": "}\nexport function grandStrategyHistoricalRecord(file, actual) {\n  assert.equal(arguments.length, 2);\n  if (!known(file)) return actual;\n  definition(); shape(actual);\n  const row = source.files[file];\n"
        }
      ]
    }
  },
  "additions": {
    "docs/reviews/2026-11-15-native-garage-ui/LOCAL-REVIEW.md": {
      "mode": "100644",
      "blob": "0e52b256172146c2b263b662049c114a3ef98987",
      "sha256": "bc90671d8bea23d9ba96286a350c89c225ce9adca9b63a34a9ad32377f367765",
      "bytes": 10860,
      "text": true
    },
    "docs/reviews/2026-11-15-native-garage-ui/MANIFEST.json": {
      "mode": "100644",
      "blob": "f9a2d97c9a332961cb95f2d88979749dd369f928",
      "sha256": "69a72b83f8230187023142270b75ccdd9c9dc6b578fbcbb855c7304b7c61de72",
      "bytes": 2575,
      "text": true
    },
    "docs/reviews/2026-11-15-native-garage-ui/MANIFEST.sha256": {
      "mode": "100644",
      "blob": "00e52702b2a31a3c13793550c65b469851a246ba",
      "sha256": "825182fca80f96b793357d3f672b82bfd108682be61b888686cfcc1af24a30ce",
      "bytes": 80,
      "text": true
    },
    "docs/reviews/2026-11-15-native-garage-ui/REVIEW.md": {
      "mode": "100644",
      "blob": "98561dee174928297992aef7f7bc9b8db1406ef7",
      "sha256": "c290db57817d5867de412c2ac4813ff4d66c527e3eddac25e33892fb13831597",
      "bytes": 4883,
      "text": true
    },
    "docs/reviews/2026-11-15-native-garage-ui/evidence/checks-summary.json": {
      "mode": "100644",
      "blob": "4ba54c92fb67a48af0861694926ba39bc8d27414",
      "sha256": "cf5139c7fa4672d73b590a631d6094d04164523a1025196380fe49bcc6e3436e",
      "bytes": 1124,
      "text": true
    },
    "docs/reviews/2026-11-15-native-garage-ui/evidence/client.log": {
      "mode": "100644",
      "blob": "9ae2f3559dab7ce644d7789fd8ec632c197161cf",
      "sha256": "5374adadf53f42fc955474b8b10603e1d440b685a3104584c396a9e7d72e1f4f",
      "bytes": 10793,
      "text": true
    },
    "docs/reviews/2026-11-15-native-garage-ui/evidence/current-copy.log": {
      "mode": "100644",
      "blob": "d1b5f43d8fda788064e065ff499ac337ab5837d1",
      "sha256": "75c3c90cfaf403dcd3444a62e349dd144fffda3db2f439036989bbc77d274ea6",
      "bytes": 106,
      "text": true
    },
    "docs/reviews/2026-11-15-native-garage-ui/evidence/desktop.png": {
      "mode": "100644",
      "blob": "513c3e7ffc2619cc9acd1adf89cb1d1380d47bca",
      "sha256": "29904c9dd9aab78e0949f578952e3d6e1ccaf771a0e80a838abe3db6d89b4833",
      "bytes": 272164,
      "text": false
    },
    "docs/reviews/2026-11-15-native-garage-ui/evidence/gates.log": {
      "mode": "100644",
      "blob": "ce3e351daf9f72853062ce910c3bb4418249c626",
      "sha256": "d62cacfef36a0bf9111e42338838546bc1ca1b3448c86d89f1269e14eaac0973",
      "bytes": 4640,
      "text": true
    },
    "docs/reviews/2026-11-15-native-garage-ui/evidence/mobile.png": {
      "mode": "100644",
      "blob": "b6ab03d9b074fc1efcd93cb316fcf8ed7485601e",
      "sha256": "6ffad094a939a6d7daba7252db3c2626540b21e985586909985f27a9ec24e78f",
      "bytes": 136600,
      "text": false
    },
    "docs/reviews/2026-11-15-native-garage-ui/evidence/nativegarage-browser.log": {
      "mode": "100644",
      "blob": "dd29564a6d4e89824625f4bd03ced882eb232516",
      "sha256": "3044f288714c02137423191975c1d90c7e41287af966987dacf99a1576ec6d10",
      "bytes": 6174,
      "text": true
    },
    "docs/reviews/2026-11-15-native-garage-ui/evidence/nativegarage-client.log": {
      "mode": "100644",
      "blob": "a3b4e86fd32392119f22ab35ca2a8e8676383dbc",
      "sha256": "08ddcce1e87d5b80cc14f9d252a35c3c5f9747bbea4bd70f56bcac436334aeb2",
      "bytes": 1889,
      "text": true
    },
    "docs/reviews/2026-11-15-native-garage-ui/evidence/nativegarage.log": {
      "mode": "100644",
      "blob": "1a4c2b547cd58aa0365291af88e48c395f53acdc",
      "sha256": "05e92fb9f9bc3aaec409fd8f0dfdd7175692a499f086bff2713bc7639c7d5ea5",
      "bytes": 1088,
      "text": true
    },
    "docs/reviews/2026-11-15-native-garage-ui/evidence/original-source-pins.json": {
      "mode": "100644",
      "blob": "c7de421425d8986a0aa11515ba2afda62bcf2037",
      "sha256": "d3175ded612602a91388d7b11165b41ec20973550d117b1d3dc804ac04514b2a",
      "bytes": 2932,
      "text": true
    },
    "docs/reviews/2026-11-15-native-garage-ui/evidence/preflight.log": {
      "mode": "100644",
      "blob": "4d9a055467913df125b3432b31fde5846aaff43e",
      "sha256": "f01d16f1cfd4bf7d09fb73db1b2b716c4a7b6f21fc08541ac4482e7ce740d503",
      "bytes": 348,
      "text": true
    },
    "docs/reviews/2026-11-15-native-garage-ui/evidence/real-chain-browser.exit": {
      "mode": "100644",
      "blob": "573541ac9702dd3969c9bc859d2b91ec1f7e6e56",
      "sha256": "9a271f2a916b0b6ee6cecb2426f0b3206ef074578be55d9bc94f6f3fe3ab86aa",
      "bytes": 2,
      "text": true
    },
    "docs/reviews/2026-11-15-native-garage-ui/evidence/real-chain-browser.json": {
      "mode": "100644",
      "blob": "1d6e72a9ef9ec9e8189e598ec39a7d625e425e05",
      "sha256": "70ab5b009ed8af3e0867f2cec04734cad326fa001eb88e3462fd23ba0a7beed8",
      "bytes": 6920,
      "text": true
    },
    "docs/reviews/2026-11-15-native-garage-ui/evidence/real-chain-browser.log": {
      "mode": "100644",
      "blob": "5702eb6a94a5264ac9ccacf88f1267814ca3bed8",
      "sha256": "6271a1886429c5651d67801c3596b41b671d6971634b8b08d53afe719e1b1ee2",
      "bytes": 515,
      "text": true
    },
    "docs/reviews/2026-11-15-native-garage-ui/evidence/routes.log": {
      "mode": "100644",
      "blob": "4a790c4db88e8ed5eaebe6ea4c8ad1c41b97c4cb",
      "sha256": "1936079b571f723d296582499cf94d9b73ab5ac2c7eff6ab2254a316d1c42f47",
      "bytes": 1581,
      "text": true
    },
    "docs/reviews/2026-11-15-native-garage-ui/evidence/security-xss.png": {
      "mode": "100644",
      "blob": "95369da80fd98d97129b7e684772119406ce55ef",
      "sha256": "8f9a849d350675ba1d744499b2cb38b6f60f62ccbd50b8efb1d55ef296e734f9",
      "bytes": 150126,
      "text": false
    },
    "docs/reviews/2026-11-15-native-garage-ui/evidence/site-basics.log": {
      "mode": "100644",
      "blob": "8cbac99154c2ce4699ae4a3fefd95a2e7fd1b6bd",
      "sha256": "712a712f6bb5f5184a9b656791a4449019a5908811f4ba4a7cf233cd4dfd5ce8",
      "bytes": 158,
      "text": true
    },
    "docs/reviews/2026-11-15-native-garage-ui/evidence/source-pins.json": {
      "mode": "100644",
      "blob": "58442bfeb349040755aa5853b7ca7c1dbc0e224a",
      "sha256": "d536339c93c5c578382f271faf9077f100b9575e16b309f71ebe31c8f924cea4",
      "bytes": 2207,
      "text": true
    },
    "docs/reviews/2026-11-15-native-garage-ui/evidence/sql-scope.json": {
      "mode": "100644",
      "blob": "6bb32fb1eae35ffe59c9f32d028a1c3f4b956521",
      "sha256": "9563285fdf5b52e2a61c0de2f8d2bc04af774fc995b3062f292dc67fc08066d7",
      "bytes": 273,
      "text": true
    },
    "docs/reviews/2026-11-15-native-garage-ui/evidence/worldgraph.log": {
      "mode": "100644",
      "blob": "1a52d68ae4b6c76d1e9f7f7cb32dfe3188e26b92",
      "sha256": "29bf515e6fe5acbaa3557f396f4af7fc7da8296dbdb0c132636274599c4808a0",
      "bytes": 2531,
      "text": true
    },
    "public/nativegarage-client.js": {
      "mode": "100644",
      "blob": "2347006855a172aea8e243a12cb7981fdeee3c6b",
      "sha256": "a9a06fe88b54ba780a4cdf8f116b03e4db72ee62b2165c83b2ea0d51e17a8b51",
      "bytes": 28778,
      "text": true
    },
    "public/nativegarage.css": {
      "mode": "100644",
      "blob": "ea22705fcf5d9010eb781d14822d8ea57bf28cca",
      "sha256": "68a5596862b56d4db1217c9152654d55da108b3a719dee5cb882ddf7c20866e9",
      "bytes": 5997,
      "text": true
    },
    "public/nativegarage.js": {
      "mode": "100644",
      "blob": "80b306214e39bb224b705ab04ac71620280f36a1",
      "sha256": "df0a645e348d5dc4362da49831b0cc60c242976d228426125480d9af4903e703",
      "bytes": 16426,
      "text": true
    },
    "src/nativegarage.js": {
      "mode": "100644",
      "blob": "46442e16d6086b036301df53dd3f90a7a1687bc0",
      "sha256": "d056b2e3c6244678721f49d37dbf3d7d6f25692d0d44cf71baca032a60c92868",
      "bytes": 36955,
      "text": true
    },
    "test/native-garage-enterprise-source.js": {
      "mode": "100644",
      "blob": "7b772874e0a56ca4f5c3864cb418ca3dfb6fb23c",
      "sha256": "7306ea85dc794cd0a4bca5c8f74d4db7f21248a5065f56906bc76578b4517d60",
      "bytes": 4431,
      "text": true
    },
    "test/native-garage-source-transfer.js": {
      "mode": "100644",
      "blob": "499d874281859e77001f631364a801c34a3302bf",
      "sha256": "3a892c54e4722d577cfc5be09bd82a8ac146a04ba51e17b7237fe0c90cd7a783",
      "bytes": 7826,
      "text": true
    },
    "test/nativegarage-browser.js": {
      "mode": "100644",
      "blob": "66b07e5090e99167096f676cfa06d27000e1eabe",
      "sha256": "bf8e5903fa71810c344b843e0ee5578bab0adafccd78a571f7cf0379fb584b7b",
      "bytes": 21857,
      "text": true
    },
    "test/nativegarage-client.js": {
      "mode": "100644",
      "blob": "75f6d6cbba3f012d86bc4900ee824956d22b094e",
      "sha256": "8bdad9d0a2ef7552cc25ed3379eae0a1bbbd0932016fbe0904cdfe70eb162d6a",
      "bytes": 21454,
      "text": true
    },
    "test/nativegarage.js": {
      "mode": "100644",
      "blob": "3d570e55ca03da589d2ddf3e7760005c3c7873bd",
      "sha256": "8c3467e419c0c0d0e9cf8d53f72c9fd89a780bda00d494781632fbdcf0c9b8d3",
      "bytes": 21397,
      "text": true
    },
    "tools/native-garage-enterprise-source.js": {
      "mode": "100644",
      "blob": "ad95d4efb8551f60fcc3a1ff18663202bcf2eea4",
      "sha256": "f56586cc88c39644bb8405db7eb16356373ab10a255a31830248bfea58409c17",
      "bytes": 3167,
      "text": true
    },
    "tools/native-garage-source-seal.js": {
      "mode": "100644",
      "blob": "23af588e18a63c53f4fa92b5320933f9fca3371e",
      "sha256": "9e7f0db4aea24c733f45c8041d79767db692d2308663ba2f3dc8b9188b10c40c",
      "bytes": 4729,
      "text": true
    },
    "tools/native-garage-source-transfer.js": {
      "mode": "100644",
      "blob": "1108f70ce42e0781ffc49788e9bb9a86391c906e",
      "sha256": "bca5ce52b9aa4b8af4d85d2ae8d34798652c65c1de64d7daf7f43b3bee3e53f2",
      "bytes": 13109,
      "text": true
    }
  }
});
export const NATIVE_GARAGE_SOURCE_SHA256 = 'ee20027ce2df81ac6fdc7a78e96aac1ee01022d6ba444192691334fd4c09b0c6';
