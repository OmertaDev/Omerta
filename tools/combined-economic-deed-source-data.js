// Generated from exact reviewed combined and Deed trees. Native records contain original byte identities only.
export const combinedEconomicDeedSource = {
  "source": "c220834210928560f303795086ee1098d0a65509",
  "sourceTree": "efd4b0e4a441c65bdd5955b4dfbd760e527b74e8",
  "predecessor": "4e5f7fdb1cc4d2055ac613d2d4cb562a8007c364",
  "predecessorTree": "916df76fb589bb506040879b904af02275fb109d",
  "files": {
    "AGENTS.md": {
      "current": {
        "mode": "100644",
        "blob": "627700e8c897578951ef5ee94f4938fe41800cbc",
        "sha256": "f5d101cba3010c710cd0d64246fb4b0c080e9632bc7496b582cca8e05dec55b8",
        "bytes": 49646
      },
      "baseline": {
        "mode": "100644",
        "blob": "40a764e3fc39a7c93d2c0d8797913f6f9e9d4444",
        "sha256": "ffd42e51acb2b06b12b4ac7132f5fd4c4ae2f29f63720b9e7d3931d3fe7b79b4",
        "bytes": 49584
      },
      "inverses": [
        {
          "at": 36775,
          "current": "character mint. Use the current\n   ETH fee quoted by `OmertaFees` or an earned mission credit, then call `POST",
          "baseline": "mint. Pay the mint\n   fee on-chain (the `OmertaFees` tollbooth) and call `POST\n  "
        },
        {
          "at": 37106,
          "current": "The server signs only within its recorded reserve capacity. A withdrawal can queue for capacity.\n   The wallet receives the net amount after the configured withdrawal toll and age-based surcharge when the voucher is redeemed",
          "baseline": "Withdrawals\n   are full-reserve backed (extraction ≤ inflow, by construction), so a large\n   withdrawal may queue until the reserve funds"
        },
        {
          "at": 42869,
          "current": "the account has minted its character",
          "baseline": "paid the identity mint fee, currently 0.01 ETH, wave 1 of the published tranche schedule"
        }
      ]
    },
    "docs/WIKI.md": {
      "current": {
        "mode": "100644",
        "blob": "77f183bed1d20cf69a9f9add4c427b3acdd3f78c",
        "sha256": "4d51fa2fd535f8a9cdc6dc79b800aecab4b8f3474dbee68ebebfe4f073b6f300",
        "bytes": 227918
      },
      "baseline": {
        "mode": "100644",
        "blob": "807b9ff9d051d411ba422d14a73246b8017fa989",
        "sha256": "accc5f5c64d6794faa605a90ce8c2d06a5c4322f33985e340b91a5df69106af5",
        "bytes": 227903
      },
      "inverses": [
        {
          "at": 15630,
          "current": "verified auction contract’s opening and closing blocks determine when bids are accepted. Check the published auction status for timing",
          "baseline": "target is around noon New York on October 9–14, 2026. Verified native block boundaries determine the window; exact wall-clock timing is not guaranteed"
        },
        {
          "at": 171797,
          "current": "The Store quotes PLEX prices from the market rate, subject to each package’s price floor",
          "baseline": "Across the mission ladder, $OMR rewards sum to 1,320 and the daily contract bonus adds 3 per day, compared\nwith 4,118 for the cheapest PLEX package"
        },
        {
          "at": 185416,
          "current": "recorded receipts and allocations. Verifying the treasury’s actual wallet balance requires a separate on-chain check",
          "baseline": "funding and allocation records"
        }
      ]
    },
    "package.json": {
      "current": {
        "mode": "100644",
        "blob": "d88a33d6eaa1e4b9e6adc3490ecb0c9e1bd96afc",
        "sha256": "82107889e119e262579663e239f09b4abbe1c068ff63c582764ddcb2e5ce32fa",
        "bytes": 60022
      },
      "baseline": {
        "mode": "100644",
        "blob": "02a624dc1659581ee688c22e5442712552ca9170",
        "sha256": "44a450b15010487b9c2916c9d0a29a583dfe95f9c9b12033afbb25620560ab56",
        "bytes": 59904
      },
      "inverses": [
        {
          "at": 14725,
          "current": "inventory-bond-checkout.js && node test/",
          "baseline": ""
        },
        {
          "at": 58549,
          "current": "shell-browser.js && node test/ux-",
          "baseline": ""
        },
        {
          "at": 59233,
          "current": "noir-ui-source-compatibility.js && node test/",
          "baseline": ""
        }
      ]
    },
    "public/index.html": {
      "current": {
        "mode": "100644",
        "blob": "d356290eff68f6ac8521ed0d63c257712b3cb214",
        "sha256": "9c520c523d8d79be1a3608f49580a62112e0b7adb695a5e2876b8fb144538468",
        "bytes": 1400474
      },
      "baseline": {
        "mode": "100644",
        "blob": "96b2921c67993953909847604016491481e64919",
        "sha256": "ff1924deb41952c9be01a1064f0696d18eb21948e762a60144050c74b7d81344",
        "bytes": 1400315
      },
      "inverses": [
        {
          "at": 103747,
          "current": "1105-noir-release",
          "baseline": "0829-content-desk"
        },
        {
          "at": 139627,
          "current": "header id=\"top\">\n    <h1>OMERTÀ</h1><span class=\"sub\">the city is yours to take",
          "baseline": "div id=\"top\">\n    <h1>OMERTÀ</h1><span class=\"sub\">the city breathes"
        },
        {
          "at": 139744,
          "current": "    <div class=\"game-header-actions\">\n      <button class=\"act\" id=\"btn-jump\" aria-label=\"Jump to a screen\" title=\"Find an operation (press /)\"><svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-glass\"/></svg><span>Find</span></button>\n      <button class=\"act\" id=\"btn-phone\" aria-label=\"Open phone and messages\" title=\"Your phone and messages\" style=\"position:relative\"><svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-phone\"/></svg><span id=\"phone-badge\" class=\"hidden\"></span></button>\n      <button class=\"act\" id=\"city-feed-toggle\" type=\"button\" aria-expanded=\"false\" aria-controls=\"wirepanel\">The wire</button>\n      <details id=\"game-menu\">\n        <summary>Menu</summary>\n        <div id=\"game-menu-content\">\n          <span class=\"game-menu-label\">Account &amp; preferences</span>\n",
          "baseline": ""
        },
        {
          "at": 140794,
          "current": "      <button class=\"act capital-trigger\" id=\"btn-capital\" type=\"button\" aria-label=\"Open the $OMR finance dashboard\" title=\"The capital desk\"><span class=\"capital-trigger__mark\">$OMR</span><span class=\"capital-trigger__label\">finance</span><span class=\"capital-trigger__balance\" id=\"capital-balance\">—</span></button>\n          <a href=\"/wiki\" target=\"_blank\" class=\"act\" title=\"Every system explained\">The Codex ↗</a>\n          <button class=\"act hidden\" id=\"btn-alerts\" aria-label=\"Enable notifications\" title=\"Get an alert while you are away\"><svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-bell\"/></svg> Notifications</button>\n          <button class=\"act\" id=\"btn-sfx\" aria-label=\"Toggle sound effects\" title=\"Toggle sound effects\"></button>\n          <button class=\"act help\" id=\"btn-help\" type=\"button\" aria-label=\"Open help and glossary\">Help &amp; glossary</button>\n          <a href=\"/privacy\" class=\"act\">Privacy</a><a href=\"/terms\" class=\"act\">Terms</a><a href=\"/resources\" class=\"act\">Resources</a>\n          <button class=\"act\" id=\"btn-logout\" title=\"Sign out of this account\">Sign out</button>\n        </div>\n      </details>\n    </div>\n  </header>\n  <div id=\"status-strips\"><div id=\"vitals\" aria-label=\"Current resources\"></div>",
          "baseline": "<button class=\"act capital-trigger\" id=\"btn-capital\" type=\"button\" aria-label=\"Open the $OMR finance dashboard\" title=\"the capital desk — launch, staking, bonds, the Desk and the on-chain rail\">\n      <span class=\"capital-trigger__mark\">$OMR</span><span class=\"capital-trigger__label\">finance</span><span class=\"capital-trigger__balance\" id=\"capital-balance\">—</span>\n    </button>\n    <a href=\"/wiki\" target=\"_blank\" class=\"act\" style=\"text-decoration:none\" title=\"the codex — every system explained\">CODEX</a>\n    <button class=\"act\" id=\"btn-jump\" aria-label=\"Jump to a screen\" title=\"jump to any screen (press /)\"><svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-glass\"/></svg></button>\n    <button class=\"act\" id=\"btn-phone\" aria-label=\"Open phone and messages\" title=\"the cell — your inbox + messages\" style=\"position:relative\"><svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-phone\"/></svg><span id=\"phone-badge\" class=\"hidden\"></span></button>\n    <button class=\"act hidden\" id=\"btn-alerts\" aria-label=\"Enable notifications\" title=\"get a phone alert when something happens to you while you're away\"><svg class=\"ic\" aria-hidden=\"true\"><use href=\"#i-bell\"/></svg></button>\n    <button class=\"act\" id=\"btn-sfx\" aria-label=\"Toggle sound effects\" title=\"the soundtrack — clicks, the register, the stings. Tap to mute.\"></button>\n    <button class=\"help\" id=\"btn-help\" type=\"button\" aria-label=\"Open help and glossary\" title=\"what does all this mean?\">?</button>\n    <a href=\"/privacy\" class=\"act\">Privacy</a><a href=\"/terms\" class=\"act\">Terms</a><a href=\"/resources\" class=\"act\">Resources</a>\n    <button class=\"act\" id=\"btn-logout\" title=\"sign out of this account\">sign out</button>\n  </div>\n  <!-- the coach + a compact vitals strip live ABOVE the layout: on a phone the sheet is a long column,\n       so the one line telling you what to do next must not be buried inside it. -->\n  <div id=\"coachwrap\"></div>\n  <div id=\"status-strips\">\n    <div id=\"vitals\"></div>\n    <nav id=\"action-readiness\" class=\"hidden\" aria-label=\"Activity timers and options\"></nav>\n  "
        },
        {
          "at": 142067,
          "current": "    <aside id=\"city-sidebar\" aria-label=\"City navigation and character\">\n      <details id=\"city-directory\" open>\n        <summary>Explore the city</summary>\n        <div class=\"city-directory-body\">\n          <div class=\"city-nav-label\">THE CITY</div>\n          <nav id=\"grouprail\" aria-label=\"City districts\"></nav>\n          <div id=\"tabs\" role=\"tablist\" aria-label=\"Operations\" aria-orientation=\"vertical\"></div>\n          <div id=\"leftcol\">\n            <details id=\"character-sheet\"><summary>Character &amp; inventory</summary",
          "baseline": "\n    <div id=\"leftcol\""
        },
        {
          "at": 143416,
          "current": "        </details>\n          </div>\n        </div>\n      </details>\n    </aside",
          "baseline": "</div"
        },
        {
          "at": 143536,
          "current": "",
          "baseline": "      <nav id=\"grouprail\" aria-label=\"City districts\"></nav>\n      <div id=\"tabs\" role=\"tablist\" aria-label=\"Operations\"></div>\n"
        },
        {
          "at": 143594,
          "current": "      <div id=\"coachwrap\"></div>\n      <details id=\"ux-screen-tools\" class=\"ux-screen-tools\"><summary>Screen tools <span>Shortcuts, reading &amp; workspace</span></summary><div id=\"screen-tool-content\" class=\"ux-screen-tools-body\"><nav id=\"action-readiness\" class=\"hidden\" aria-label=\"Activity timers and options\"></nav></div></details>\n",
          "baseline": ""
        },
        {
          "at": 144367,
          "current": " hidden>\n      <button class=\"act\" type=\"button\" id=\"wire-close\" aria-label=\"Close the wire\">Close ×</button",
          "baseline": ""
        },
        {
          "at": 156164,
          "current": "105-noir-release",
          "baseline": "024"
        },
        {
          "at": 156333,
          "current": "105-noir-release",
          "baseline": "024"
        },
        {
          "at": 156448,
          "current": "105-noir-release",
          "baseline": "024-2"
        },
        {
          "at": 156767,
          "current": "105-noir-release",
          "baseline": "024-2"
        },
        {
          "at": 447501,
          "current": "intent?.minimumOmr && body.noteId)\n      bits.push(`Pay ${body.intent.principalEth} ETH for at least ${body.intent.minimumOmr} OMR base units, vesting over ${minsTxt(body.vestingSeconds)}. Review the wallet transaction in Portfolio before the quote expires.",
          "baseline": "bond === 'quote')\n      bits.push(`\\u{1F4DD} quote signed — ${fmt(body.payoutOmr)} $OMR at ${body.discountBps / 100}% off the market price, vesting over ${\n        minsTxt(body.vestSeconds)} · submit bond(quote, signature) with your wallet within ${untilTxt(body.deadline)} or it lapses"
        },
        {
          "at": 459094,
          "current": "recorded a treasury allocation of ${body.eth} ETH",
          "baseline": "claimed ${body.eth} ETH into the vault"
        },
        {
          "at": 548334,
          "current": "async function inventoryBondWallet(",
          "baseline": "// submit a signed bond quote on-chain with the connected wallet. The server ABI-encodes bond(quote, sig)\n  // (viem — the zero-dep client never hand-rolls ABI); the wallet switches to the right chain, shows the tx\n  // (to / value / data), and the player approves. Mainnet-dormant until the bond chain is configured.\n  async function submitBondOnChain(nonce"
        },
        {
          "at": 548435,
          "current": "throw Error('A wallet is required.');\n    await provider.request({method:'eth_requestAccounts'});\n    await switchCharacterChain(provider, '0x1237');\n    return provider;\n  }\n\n  function bondOmr(units) {\n    const whole = units / 10n**18n, fraction = (units % 10n**18n).toString().padStart(18,'0').replace(/0+$/, '');\n    return String(whole) + (fraction ? '.'+fraction : '');",
          "baseline": "return; // picker closed — it already showed what is available / how to get one\n    try {\n      const cd = await api('POST', '/v1/bond/calldata', { nonce });\n      if (cd.code !== 200) { toast(describe(cd.body, cd.code), true); return; }\n      if (cd.body.deadline && cd.body.deadline * 1000 < Date.now()) { toast('that quote expired — request a fresh one', true); return; }\n      const [from] = await provider.request({ method: 'eth_requestAccounts' });\n      connectedProvider = provider;\n      try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: cd.body.chainIdHex }] }); }\n      catch (sw) { if (sw?.code !== 4902) throw sw; toast('add the OMERTÀ chain to your wallet first', true); return; }\n      const txHash = await provider.request({ method: 'eth_sendTransaction',\n        params: [{ from, to: cd.body.to, value: cd.body.value, data: cd.body.data }] });\n      toast('bond submitted on-chain — tx ' + String(txHash).slice(0, 12) + '…');\n    } catch (e) { toast(e?.message ? 'bond: ' + e.message : 'bond submit cancelled', true); }"
        },
        {
          "at": 585386,
          "current": "The first-week task teaches through play. The illustrated tour stays available in Help.\n",
          "baseline": "first session: the illustrated tour. Keyed on its own flag (not omerta_welcomed) ON PURPOSE —\n    // existing testers who saw the old one-wall-of-text welcome get the expanded tour exactly once too.\n    if (!localStorage.getItem('omerta_tour2')) openTour();"
        },
        {
          "at": 606836,
          "current": "true; // An optional tour returns to the operation that opened it.",
          "baseline": "!!localStorage.getItem('omerta_tour2');"
        },
        {
          "at": 644652,
          "current": "      $('#coachwrap').classList.toggle('is-current', order.tab === currentTab);\n",
          "baseline": ""
        },
        {
          "at": 645100,
          "current": "NEXT",
          "baseline": "TURN · CITY-RANKED"
        },
        {
          "at": 645757,
          "current": "",
          "baseline": "          ${road5}\n"
        },
        {
          "at": 645937,
          "current": " aria-expanded=\"false\">Your plan<i>+${planRows ? plan.slice(1, 5).length : 0} more ▾</i></button>${road5}",
          "baseline": ">UP NEXT:<i>+${planRows ? plan.slice(1, 5).length : 0} more ▾</i></button>"
        },
        {
          "at": 646849,
          "current": "{ const open = tg.parentElement.classList.toggle('open'); tg.setAttribute('aria-expanded', String(open)); }",
          "baseline": "tg.parentElement.classList.toggle('open')"
        },
        {
          "at": 664438,
          "current": "$('#welcome').classList.contains('hidden')) return; // let an optional tour finish",
          "baseline": "localStorage.getItem('omerta_tour2')) return;   // the tour goes"
        },
        {
          "at": 679302,
          "current": "ArrowUp', 'ArrowDown', '",
          "baseline": ""
        },
        {
          "at": 679698,
          "current": "['ArrowRight', 'ArrowDown'].includes(e.key)",
          "baseline": "e.key === 'ArrowRight'"
        },
        {
          "at": 687099,
          "current": "reasury allocations",
          "baseline": "he backed Vault"
        },
        {
          "at": 687470,
          "current": "Free players can compete on the boards. Each item lists its price and benefit",
          "baseline": "A skilled free player still tops every board; spending here funds the prize pool"
        },
        {
          "at": 690934,
          "current": "    $('#coachwrap').classList.toggle('is-current', (me?.coach?.tab || id) === id);\n",
          "baseline": ""
        },
        {
          "at": 832796,
          "current": "iControl && deed && c.canCollect === false)\n        parts.push(`<div class=\"d\">Your character can start earning corner income at level ${c.cornerMinLvl}",
          "baseline": "collectable > 0 && c.canCollect === false)\n        parts.push(`<div class=\"t\">The take is building — $${(c.collectable).toLocaleString()} banked. Working a corner takes level ${c.cornerMinLvl}; the street stays yours until then"
        },
        {
          "at": 833185,
          "current": " && !deed.onChain && c.canCollect !== false",
          "baseline": ""
        },
        {
          "at": 843635,
          "current": "level 25 on your current character, however you acquired the property",
          "baseline": "Level 25 for either public allocation"
        },
        {
          "at": 889963,
          "current": "",
          "baseline": "  "
        },
        {
          "at": 916146,
          "current": "const shareDrafts = Object.fromEntries([...t.querySelectorAll('.sw-proof[data-for]')].map((input) => [input.dataset.for, input.value]));\n    const onboardTask = (x, primary = false) => `\n        <article class=\"card${primary ? ' start-next-card' : ''}\" ${!x.claimed && x.ready ? 'style=\"border-color:var(--neon)\"' : ''}>\n          <h3 class=\"t\">${x.claimed ? '✓ ' : ''}${esc(x.name)}</h3>\n          ${x.claimed ? '<span class=\"chip good\">claimed</span>' : x.ready ? '<span class=\"chip good\">reward ready</span>' : ''}\n          <div class=\"d\">${esc(x.desc)} · pays ${reward(x.reward)}</div>\n          ${x.claimed ? ''\n            : x.social ? `<a class=\"act\" href=\"${x.social}\" target=\"_blank\" rel=\"noopener noreferrer\">open</a> <button class=\"act\" data-obclaim=\"${x.id}\">claim</button>`\n            : x.ready ? `<button class=\"act prime\" data-obclaim=\"${x.id}\">claim reward</button>`\n            : `<button class=\"act${primary ? ' prime' : ''}\" data-obgo=\"${x.id}\">${(go[x.id] || [, 'do it'])[1]} →</button>`}\n        </article>`;\n    const outreachMarkup = `",
          "baseline": "t.innerHTML = `\n      ${recovery.length ? `<section class=\"card\" aria-label=\"Recovery options\"><span class=\"t\">Return to play</span>\n        ${recovery.map(step=>`<div class=\"row\"><span>${esc(step.label)} · ${mins(step.seconds)}</span><button class=\"act\" data-go-tab=\"${step.tab}\">Review options</button></div>`).join('')}</section>` : ''}\n      ${nextCrime ? `<p class=\"d\">Next crime unlock at level ${nextCrime.level}: ${nextCrime.names.map(esc).join(', ')}. <button class=\"act\" data-go-tab=\"streets\">Work toward this unlock</button></p>` : ''}\n      ${waiting.clocks.length ? `<details class=\"card\"><summary>While you wait</summary>\n        <p class=\"d\">${waiting.clocks.map(c=>`${esc(c.label)}: ${mins(c.seconds)}`).join(' · ')}</p>\n        <p class=\"d\">These screens have other options to review. Each action checks your current resources and status.</p>\n        ${waiting.destinations.map(d=>`<button class=\"act\" data-go-tab=\"${d.tab}\">${esc(d.label)}</button>`).join('')}</details>` : ''}"
        },
        {
          "at": 919283,
          "current": "value=\"${esc(shareDrafts[s.id] || '')}\" ",
          "baseline": ""
        },
        {
          "at": 920094,
          "current": "      <h2 style=\"margin-top:14px\">The Recruiters <span class=\"d\" style=\"font-size:11px\">— the hall of fame for bringing in made men. Every recruit who sticks earns you referral rewards (in-game cash) + milestone bonuses</span></h2>\n      <div id=\"recruit-lb\" class=\"d\" style=\"color:var(--dim);font-size:12.5px\">loading…</div>\n\n`;\n    const mintMarkup = `\n",
          "baseline": ""
        },
        {
          "at": 921754,
          "current": "`;\n    const careerMarkup = `",
          "baseline": "      ${streakCard}\n      ${dayCard}\n      ${payrollCard}\n      ${primeCard}\n      ${bulletinBanner}\n      ${eventStrip}\n      ${resultsStrip}\n      ${ob.allDone ? situation : ''}\n      <!-- The City Standing led this screen — so the FIRST thing a brand-new player saw was six bars\n           at 0% and a leaderboard of strangers, with the checklist (the actual point) pushed below.\n           It leads only once the checklist is behind you; before that it's one honest line. -->\n      ${ob.allDone ? `<h2>The City Standing <span class=\"d\" style=\"font-size:11px\">(your combined score across Blood, Empire, Power, Legit, Hustle, and Honor)</span></h2>\n      <div id=\"city-standing\" class=\"d\" style=\"color:var(--dim);font-size:12.5px;margin-bottom:12px\">loading…</div>` : ''}\n      ${ob.allDone ? '' : `\n      <h2>Make Your Bones <span class=\"d\" style=\"font-size:12.5px\">(${ob.claimed}/${ob.total} done — the first week pays cash to learn the ropes)</span></h2>\n      ${next ? `<div class=\"coachbox\"><div class=\"cl\">▸ DO THIS NEXT: ${esc(next.name)}</div><div class=\"ch\">${next.ready ? 'The reward\\'s waiting — claim it below.' : esc(next.desc)}</div>\n        ${next.ready ? `<button class=\"act prime\" data-obclaim=\"${next.id}\" style=\"padding:5px 12px;font-size:12.5px\">claim ${reward(next.reward)}</button>` : `<button class=\"act\" data-obgo=\"${next.id}\" style=\"padding:5px 12px;font-size:12.5px\">${(go[next.id] || [, 'go do it'])[1]} →</button>`}</div>` : ''}\n      <div class=\"d\" style=\"color:var(--dim);font-size:13.5px;margin-bottom:6px\">Work down the list. Green means the reward is waiting — claim it. Grey means do the thing first; tap it to jump there.</div>\n      <div class=\"grid\">${[...(ob.tasks || [])].sort((a,b)=>Number(!b.claimed && b.ready && !b.social)-Number(!a.claimed && a.ready && !a.social)).map((x) => `\n        <div class=\"card\" ${!x.claimed && x.ready ? 'style=\"border-color:var(--neon)\"' : ''}>\n          <span class=\"t\">${x.claimed ? '✓ ' : ''}${esc(x.name)}</span>\n          ${x.claimed ? '<span class=\"chip good\">claimed</span>' : x.ready ? '<span class=\"chip good\">reward ready</span>' : ''}\n          <div class=\"d\">${esc(x.desc)} · pays ${reward(x.reward)}</div>\n          ${x.claimed ? ''\n            : x.social ? `<a class=\"act\" href=\"${x.social}\" target=\"_blank\" rel=\"noopener noreferrer\">open</a> <button class=\"act\" data-obclaim=\"${x.id}\">claim</button>`\n            : x.ready ? `<button class=\"act prime\" data-obclaim=\"${x.id}\">claim reward</button>`\n            : `<button class=\"act\" data-obgo=\"${x.id}\">${(go[x.id] || [, 'do it'])[1]} →</button>`}\n        </div>`).join('')}</div>\n      <div class=\"d\" style=\"color:var(--dim);font-size:12.5px;margin-top:10px\">Finish all of it for a capstone bonus (${reward(ob.capstone || {})}). Stuck? The other tabs across the top are the whole city — Streets is your bread and butter.</div>`}\n      ${!ob.allDone ? situation : ''}"
        },
        {
          "at": 923969,
          "current": "`;\n    const missionsMarkup = `",
          "baseline": "      ${ob.allDone ? deepCityMarkup(ex) : ''}\n      ${sect('howto', 'How the city works', 'the six things worth knowing — 60 seconds', `\n        <div class=\"grid\">\n          <div class=\"card\"><img class=\"ico wide\" loading=\"lazy\" alt=\"\" src=\"/art/interior-streets.jpg\"><span class=\"t\">The Streets</span>\n            <div class=\"d\">Crime runs on <b>nerve</b>; the gym on <b>energy</b>. Every job: case it (quiet), do it, or go loud (bigger, hotter).</div></div>\n          <div class=\"card\"><img class=\"ico wide\" loading=\"lazy\" alt=\"\" src=\"/art/interior-legit.jpg\"><span class=\"t\">Your Money</span>\n            <div class=\"d\">Pocket cash gets jumped — <b>bank it</b> (deposits clear after exactly two hours). $OMR is the token; staking it cuts what a killer takes (20% staked vs 50% loose), but never makes it safe.</div></div>\n          <div class=\"card\"><img class=\"ico wide\" loading=\"lazy\" alt=\"\" src=\"/art/interior-trade.jpg\"><span class=\"t\">The Freight Game</span>\n            <div class=\"d\">Every district posts its own goods prices daily. <b>Buy cheap, haul, sell rich</b> — the Trade Goods drawer on the Streets shows each good's spread; convoys and boats move it in bulk.</div></div>\n          <div class=\"card\"><img class=\"ico wide\" loading=\"lazy\" alt=\"\" src=\"/art/card-whacked.jpg\"><span class=\"t\">Death Is Real</span>\n            <div class=\"d\">Your street can be killed for good. Your <b>account</b> — prestige, $OMR, the estate — survives to your heir.</div></div>\n          <div class=\"card\"><img class=\"ico wide\" loading=\"lazy\" alt=\"\" src=\"/art/interior-family.jpg\"><span class=\"t\">The Family</span>\n            <div class=\"d\">Families share turf and a treasury, fight wars, and vote in the Commission. Rival bloodlines can swear vendettas.</div></div>\n          <div class=\"card\"><img class=\"ico wide\" loading=\"lazy\" alt=\"\" src=\"/art/interior-law.jpg\"><span class=\"t\">The Law</span>\n            <div class=\"d\">Heat feeds a RICO case. Lay low, pay the right people, or face the courtroom — and the Pen behind it.</div></div>\n          <div class=\"card\"><img class=\"ico wide\" loading=\"lazy\" alt=\"\" src=\"/art/interior-start.jpg\"><span class=\"t\">Follow the Coach</span>\n            <div class=\"d\">The ▸ coach line on your sheet names the next move; the glowing nav button shows where. <a href=\"#\" id=\"howto-tour\">replay the full tour →</a></div></div>\n        </div>`)}\n\n\n      ${!ob.allDone ? `<h2 style=\"margin-top:14px\">The City Standing <span class=\"d\" style=\"font-size:11px\">— where you'll sit once you've made your bones</span></h2>\n      <div id=\"city-standing\" class=\"d\" style=\"color:var(--dim);font-size:12.5px;margin-bottom:12px\">loading…</div>` : ''}\n\n      <h2 style=\"margin-top:14px\">The Recruiters <span class=\"d\" style=\"font-size:11px\">— the hall of fame for bringing in made men. Every recruit who sticks earns you referral rewards (in-game cash) + milestone bonuses</span></h2>\n      <div id=\"recruit-lb\" class=\"d\" style=\"color:var(--dim);font-size:12.5px\">loading…</div>\n"
        },
        {
          "at": 926290,
          "current": "    const remainingTasks = obTasks.filter((x) => x !== next);\n    t.innerHTML = `\n      ${recovery.length ? `<section class=\"card\" aria-label=\"Recovery options\"><span class=\"t\">Return to play</span>\n        ${recovery.map(step=>`<div class=\"row\"><span>${esc(step.label)} · ${mins(step.seconds)}</span><button class=\"act\" data-go-tab=\"${step.tab}\">Review options</button></div>`).join('')}</section>` : ''}\n\n      ${!ob.allDone && obTasks.length ? `<section class=\"start-first-week\" aria-labelledby=\"start-week-title\">\n        <div class=\"start-week-heading\"><div><p class=\"start-eyebrow\">YOUR FIRST WEEK</p><h2 id=\"start-week-title\">Make Your Bones</h2></div>\n          <span class=\"chip\">${ob.claimed || 0} / ${ob.total || obTasks.length} complete</span></div>\n        <progress class=\"start-week-progress\" max=\"${ob.total || obTasks.length}\" value=\"${ob.claimed || 0}\" aria-label=\"First-week progress\"></progress>\n        ${next ? onboardTask(next, true) : ''}\n        ${remainingTasks.length ? sect('start-week', 'Your first-week milestones', `${remainingTasks.length} more · complete the week for ${reward(ob.capstone || {})}`, `<div class=\"grid\">${remainingTasks.map((x) => onboardTask(x)).join('')}</div>`) : ''}\n      </section>` : ''}\n      ${nextCrime ? `<p class=\"d\">Next crime unlock at level ${nextCrime.level}: ${nextCrime.names.map(esc).join(', ')}. <button class=\"act\" data-go-tab=\"streets\">Work toward this unlock</button></p>` : ''}\n      ${waiting.clocks.length ? `<details class=\"card\"><summary>While you wait</summary>\n        <p class=\"d\">${waiting.clocks.map(c=>`${esc(c.label)}: ${mins(c.seconds)}`).join(' · ')}</p>\n        <p class=\"d\">These screens have other options to review. Each action checks your current resources and status.</p>\n        ${waiting.destinations.map(d=>`<button class=\"act\" data-go-tab=\"${d.tab}\">${esc(d.label)}</button>`).join('')}</details>` : ''}\n      ${ob.allDone ? situation : ''}\n      <details class=\"start-tour\"><summary>Find your path through the city</summary><div id=\"start-tour-content\"></div></details>\n      <div class=\"start-daily\">${streakCard}${dayCard}${payrollCard}</div>\n      ${sect('start-missions', 'Family missions', 'Story jobs, requirements, and rewards', missionsMarkup, !!ob.allDone)}\n      ${sect('start-city', 'Around the city', 'Events, the weekly bulletin, and your people', `${primeCard}${bulletinBanner}${eventStrip}${resultsStrip}${!ob.allDone ? situation : ''}`)}\n      ${careerMarkup.trim() ? sect('start-career', 'The Career', 'Your permanent climb through five ranks', careerMarkup) : ''}\n      ${sect('start-mint', 'Your character &amp; deed', 'Wallet, character mint, and deed requirements', mintMarkup)}\n      ${sect('start-outreach', 'Your crew starts with a name', `Referral links, sharing, and the recruiters${ob.referral?.canClaim ? ' · name who sent you' : ''}`, outreachMarkup)}\n      ${sect('start-standing', 'The City Standing', 'Your standing and the city leaderboard', '<div id=\"city-standing\" class=\"d\">loading…</div>')}\n      ${ob.allDone ? deepCityMarkup(ex) : ''}\n      ${sect('howto', 'How the city works', 'the six things worth knowing — 60 seconds', `\n        <div class=\"grid\">\n          <div class=\"card\"><img class=\"ico wide\" loading=\"lazy\" alt=\"\" src=\"/art/interior-streets.jpg\"><span class=\"t\">The Streets</span>\n            <div class=\"d\">Crime runs on <b>nerve</b>; the gym on <b>energy</b>. Every job: case it (quiet), do it, or go loud (bigger, hotter).</div></div>\n          <div class=\"card\"><img class=\"ico wide\" loading=\"lazy\" alt=\"\" src=\"/art/interior-legit.jpg\"><span class=\"t\">Your Money</span>\n            <div class=\"d\">Pocket cash gets jumped — <b>bank it</b> (deposits clear after exactly two hours). $OMR is the token; staking it cuts what a killer takes (20% staked vs 50% loose), but never makes it safe.</div></div>\n          <div class=\"card\"><img class=\"ico wide\" loading=\"lazy\" alt=\"\" src=\"/art/interior-trade.jpg\"><span class=\"t\">The Freight Game</span>\n            <div class=\"d\">Every district posts its own goods prices daily. <b>Buy cheap, haul, sell rich</b> — the Trade Goods drawer on the Streets shows each good's spread; convoys and boats move it in bulk.</div></div>\n          <div class=\"card\"><img class=\"ico wide\" loading=\"lazy\" alt=\"\" src=\"/art/card-whacked.jpg\"><span class=\"t\">Death Is Real</span>\n            <div class=\"d\">Your street can be killed for good. Your <b>account</b> — prestige, $OMR, the estate — survives to your heir.</div></div>\n          <div class=\"card\"><img class=\"ico wide\" loading=\"lazy\" alt=\"\" src=\"/art/interior-family.jpg\"><span class=\"t\">The Family</span>\n            <div class=\"d\">Families share turf and a treasury, fight wars, and vote in the Commission. Rival bloodlines can swear vendettas.</div></div>\n          <div class=\"card\"><img class=\"ico wide\" loading=\"lazy\" alt=\"\" src=\"/art/interior-law.jpg\"><span class=\"t\">The Law</span>\n            <div class=\"d\">Heat feeds a RICO case. Lay low, pay the right people, or face the courtroom — and the Pen behind it.</div></div>\n          <div class=\"card\"><img class=\"ico wide\" loading=\"lazy\" alt=\"\" src=\"/art/interior-start.jpg\"><span class=\"t\">Follow the Coach</span>\n            <div class=\"d\">Your next move appears beside the operation. Open your plan to see the steps ahead. <a href=\"#\" id=\"howto-tour\">replay the full tour →</a></div></div>\n        </div>`)}\n\n\n`;\n",
          "baseline": ""
        },
        {
          "at": 968781,
          "current": "      <h2 style=\"margin-top:14px\">Crimes <span class=\"d\" style=\"color:var(--dim);font-size:12.5px\">— your best jobs at level ${lvl}</span></h2>\n      ${streetActionClock()}\n      <div class=\"grid\">${crimes || restCrimes && '<span class=\"d\" style=\"color:var(--dim)\">no jobs at your level yet — open the full book below</span>' || ''}</div>\n      ${rest.length ? sect('crimes-all', 'The Full Book', `every job in the city (${allCrimes.length})`, `<div class=\"grid\">${restCrimes}</div>`) : ''}\n\n",
          "baseline": ""
        },
        {
          "at": 974033,
          "current": "",
          "baseline": "      <h2 style=\"margin-top:14px\">Crimes <span class=\"d\" style=\"color:var(--dim);font-size:12.5px\">— your best jobs at level ${lvl}</span></h2>\n      ${streetActionClock()}\n      <div class=\"grid\">${crimes || restCrimes && '<span class=\"d\" style=\"color:var(--dim)\">no jobs at your level yet — open the full book below</span>' || ''}</div>\n      ${rest.length ? sect('crimes-all', 'The Full Book', `every job in the city (${allCrimes.length})`, `<div class=\"grid\">${restCrimes}</div>`) : ''}\n"
        },
        {
          "at": 1041694,
          "current": "'1'",
          "baseline": "1"
        },
        {
          "at": 1106599,
          "current": "\n        <div style=\"margin-top:6px\">Use in-game $OMR for items showing a PLEX price. The ETH checkout requires activation",
          "baseline": " Spending funds token buybacks and backed prize pools.\n        <div style=\"margin-top:6px\">Pay in ETH or with in-game $OMR through PLEX for the same goods"
        },
        {
          "at": 1110231,
          "current": "ETH package fees through the payment router: developer ${S.split.founder / 100}% · Vig prize funding ${S.split.buyback / 100}% · treasury ${S.split.rwa / 100}% · community ${S.split.community / 100}%. PLEX spends game $OMR",
          "baseline": "Revenue split — founder ${S.split.founder / 100}% · token buyback ${S.split.buyback / 100}% · treasury ${S.split.rwa / 100}%"
        },
        {
          "at": 1229632,
          "current": "",
          "baseline": "bd.genesis || "
        },
        {
          "at": 1231872,
          "current": "ChecksAvailable = bd.purchase?.verificationAvailable === true",
          "baseline": "Daily = bd.daily || null;\n    const bondUnlimited = bondDaily?.unlimited === true;\n    const bondUnlimitedReady = bd.liquidity?.bondReady === true && bd.genesis?.bondQuotesOpen === true && !!bd.quote;\n    const bondOffered = Number(bondDaily?.offeredOmr || 0);\n    const bondRemaining = Number(bondDaily?.remainingOmr || 0);\n    const bondTranche = Number(bd.reserve?.remainingOmr || 0);\n    const bondCapacityKnown = bd.reserve?.remainingOmr != null && Number.isFinite(bondTranche);\n    const bondBuyable = bondUnlimited ? (bondUnlimitedReady && bondCapacityKnown ? Math.max(0, bondTranche) : 0)\n      : Math.max(0, Math.min(bondRemaining, bondTranche));\n    const bondFilledPct = bondOffered > 0 ? Math.max(0, Math.min(100, ((bondOffered - bondRemaining) / bondOffered) * 100)) : 0"
        },
        {
          "at": 1238578,
          "current": "Inventory bonds</span>\n            <span class=\"capital-market__body\">Funded OMR vests over the bond contract’s published term. Check the current quote before sending ETH.</span>\n            <span class=\"capital-market__value ${bondChecksAvailable ? '' : 'is-closed'}\">${bondChecksAvailable ? 'verify terms' : 'purchases unavailable",
          "baseline": "Bond account records</span>\n            <span class=\"capital-market__body\">${bondUnlimited ? `No daily account quota · ${bondCapacityKnown ? `${fmt(Math.max(0, bondTranche))} $OMR of reported quote capacity` : 'quote capacity is not reported'}` : bondDaily ? `${fmt(bondBuyable)} $OMR of reported quote capacity within today’s account limit` : 'No account bond offering has been posted.'}</span>\n            <span class=\"capital-market__value ${bondBuyable > 0 ? 'is-live' : 'is-closed'}\">${bondUnlimited ? (bondBuyable > 0 ? 'open' : 'quotes unavailable') : bondDaily ? `${Math.round(bondFilledPct)}% filled` : 'closed"
        },
        {
          "at": 1239291,
          "current": "accounting?.oracle ? 'is-live' : 'is-closed'}\">${bd.accounting?.oracle ? `${fmt(bd.accounting?",
          "baseline": "oracle ? 'is-live' : 'is-closed'}\">${bd.oracle ? `${fmt(bd"
        },
        {
          "at": 1239827,
          "current": "accounting?.reserve?.polEth || 0)} ETH · RWA ${fmt(bd.accounting?",
          "baseline": "reserve?.polEth || 0)} ETH · RWA ${fmt(bd"
        },
        {
          "at": 1243976,
          "current": "ransfers, loot, and funded distributions can move existing $OMR between accounts",
          "baseline": "he rest of the city's $OMR comes from purchases made with real money"
        },
        {
          "at": 1264507,
          "current": "Inventory bonds</h2>\n      <div class=\"card\"><span class=\"t\">Buy a vested OMR note</span>\n        <div class=\"d\">When open, the market bond reserves existing OMR for your wallet. It vests linearly. Your quote shows the ETH payment, minimum OMR, vesting term and expiry. Network gas applies.</div>\n        ${bondChecksAvailable ? `<div style=\"margin-top:6px\"><input id=\"bond-eth\" inputmode=\"decimal\" maxlength=\"60\" aria-label=\"ETH to pay\" placeholder=\"ETH\" size=\"8\"> <button class=\"act\" id=\"bond-quote\">Check purchase terms</button>\n          <button class=\"act\" id=\"bond-submit\" hidden>Review purchase in wallet</button>\n          <pre id=\"bond-quote-out\" style=\"white-space:pre-wrap;overflow-wrap:anywhere\" aria-live=\"polite\"></pre></div>` : '<p class=\"d\">New purchases are awaiting verified deployment, activation and funding.</p>'",
          "baseline": "Bond account quotes <span class=\"d\" style=\"font-size:11px\">(reported account terms — verify the settlement contract, funded inventory and current market availability before paying)</span></h2>\n      ${(() => {\n        const dl = bd.daily, off = bd.offering || {};\n        const unlimited = dl?.unlimited === true;\n        // Unlimited daily policy does not imply readiness or available quote capacity.\n        const tranche = Number(bd.reserve?.remainingOmr || 0);\n        const capacityKnown = bd.reserve?.remainingOmr != null && Number.isFinite(tranche);\n        const posted = dl ? Number(dl.remainingOmr || 0) : 0;\n        const left = unlimited ? (capacityKnown ? Math.max(0, tranche) : 0) : Math.min(posted, tranche);\n        const ready = !unlimited || (bd.liquidity?.bondReady === true && bd.genesis?.bondQuotesOpen === true && !!bd.quote);\n        const open = !!dl && left > 0 && ready;\n        const pct = dl && Number(dl.offeredOmr) > 0 ? Math.round((posted / Number(dl.offeredOmr)) * 100) : 0;\n        return `\n      <div class=\"card\" style=\"border-color:${open ? 'var(--neon)' : 'rgba(255,255,255,.12)'}\">\n        <span class=\"t\" style=\"color:${open ? 'var(--neon)' : 'var(--dim)'}\">${unlimited ? 'No daily purchase limit' : open ? \"TODAY'S WINDOW — OPEN\" : 'THE WINDOW IS SHUT TODAY'}</span>\n        ${unlimited ? `<div class=\"d\">${capacityKnown ? `<b>${fmt(left)}</b> $OMR available for new quotes.` : 'Available supply is not reported.'}</div>\n          ${Number(bd.reserve?.reservedQuotesOmr) > 0 ? `<div class=\"d\">${fmt(bd.reserve.reservedQuotesOmr)} $OMR is reserved for outstanding signed quotes.</div>` : ''}\n          <div class=\"d\" style=\"font-size:11.5px;color:var(--dim);margin-top:4px\">${open ? 'Choose your purchase amount. The quote checks the available supply and current price.' : !ready ? 'New bond purchases are temporarily unavailable while the desk is paused or waiting for launch, liquidity and a current price.' : !capacityKnown ? 'Purchases are unavailable until the available supply is confirmed.' : 'There is no available supply for a new quote. Purchases resume when supply becomes available.'}</div>`\n        : open ? `<div class=\"d\"><b>${fmt(left)}</b> $OMR still on offer${posted > left ? ` <span class=\"chip cold\">the tranche behind the desk is the tighter of the two</span>` : ` of ${fmt(dl.offeredOmr)} posted`}</div>\n          <div class=\"bar\" style=\"margin-top:4px\"><i style=\"width:${pct}%\"></i></div>\n          <div class=\"d\" style=\"font-size:11.5px;color:var(--dim);margin-top:4px\">When it's gone it's gone until the house posts the next one. There is no queue and no reservation.</div>`\n        : (dl\n          ? `<div class=\"d\">An account offering was posted for today, but its quote budget has no remaining capacity. No new quote is available.</div>`\n          : `<div class=\"d\">No offering was posted. The house opens the window day by day and it is shut until it does — nothing is bought or sold here today.</div>`)"
        },
        {
          "at": 1265404,
          "current": "Inventory bond receipts</span>\n        <p class=\"d\">Find your note ID in the Purchased event of your confirmed wallet transaction. On Robinhood Chain, read claimable(bytes32) on the contract that emitted the event. Send claim(bytes32) with that note ID and zero ETH to collect vested OMR. The recorded beneficiary receives the tokens.</p>\n        ${bd.purchase?.deployment && me.wallet ? `<div class=\"d\">Bond contract: ${esc(bd.purchase.deployment.address)}</div>\n          <label>Receipt ID <input id=\"bond-note-id\" size=\"24\" list=\"bond-saved\" placeholder=\"0x…\" maxlength=\"66\"></label><datalist id=\"bond-saved\"></datalist>\n          <button class=\"act\" id=\"bond-note-read\">Check receipt</button><button class=\"act\" id=\"bond-note-claim\" hidden>Claim vested OMR in wallet</button>\n          <pre id=\"bond-note-out\" aria-live=\"polite\" style=\"white-space:pre-wrap;overflow-wrap:anywhere\"></pre>` : ''}",
          "baseline": "The Terms</span>\n        <table>\n          <tr><th>what you pay</th><td>ETH, on-chain, minimum ${off.minEth ?? '—'}</td></tr>\n          <tr><th>what you get</th><td>$OMR at <b>${off.discountBps != null ? (off.discountBps / 100) + '%' : '—'}</b> below the market price${bd.quote ? ` — about <b>${fmt(bd.quote.payoutOmr)}</b> per ETH right now` : ''}</td></tr>\n          <tr><th>when</th><td>released steadily over <b>${off.vestHours ?? '—'}h</b>, not all at once</td></tr>\n          <tr><th>settlement terms</th><td>verify the exact contract and recipient before paying. Canonical-market inventory bonds reserve already funded OMR and route proceeds to the configured War Chest.</td></tr>\n        </table>\n        <div class=\"d\" style=\"font-size:11.5px;color:var(--dim);margin-top:4px\">${unlimited ? `${bd.quote ? '' : 'A quote is unavailable while the desk is closed. '}${capacityKnown ? `${fmt(left)} $OMR remains available after accounting for outstanding signed quotes.` : 'Available supply is not reported.'}` : `${bd.quote ? '' : 'No market price has printed yet, so no quote can be signed. '}${tranche > 0\n          ? `The account service reports ${fmt(tranche)} $OMR of remaining quote capacity. This figure alone does not prove on-chain inventory or purchase availability.`\n          : 'The account quote budget has no remaining capacity.'}`}</div>"
        },
        {
          "at": 1266365,
          "current": "Your historical bond records</span>\n        <div class=\"d\">For an older on-chain purchase, find the numeric bondId in its Bonded event. Use the original contract’s claim(uint256) from the owner wallet. The claim button below updates your game record.</div",
          "baseline": "Take the Deal</span>\n        <div class=\"d\">This form reads the account quote service. Check its contract and terms before authorizing ETH; a returned quote does not establish canonical-market activation. Canonical-market inventory bonds use prefunded inventory, bounded purchases and linear vesting.</div>\n        <div style=\"margin-top:6px\"><input id=\"bond-eth\" placeholder=\"ETH\" size=\"6\"> <button class=\"act\" id=\"bond-quote\"${open ? '' : ' disabled'}>${open ? 'request a signed quote' : unlimited ? 'quotes unavailable' : 'the window is shut'}</button>\n          <button class=\"act\" id=\"bond-submit\" style=\"display:none;border-color:var(--neon)\">submit on-chain with wallet</button>\n          <div class=\"d\" style=\"font-size:11px;color:var(--dim)\">${me.wallet ? '' : '<b>Link your wallet above first</b> — a quote is bound to a proven address. '}${unlimited ? (open ? 'The desk is ready for on-chain purchases.' : 'New on-chain purchases are currently unavailable.') : 'The on-chain desk is <b>dormant until launch</b>.'}</div>\n          <pre id=\"bond-quote-out\" style=\"display:none;white-space:pre-wrap;font-size:11px;background:#111;padding:6px;border-radius:4px;margin-top:4px;overflow-x:auto\"></pre></div>\n      </div>\n      <div class=\"card\">\n        <span class=\"t\">Your Bonds</span"
        },
        {
          "at": 1267571,
          "current": "",
          "baseline": "`; })()}"
        },
        {
          "at": 1269379,
          "current": "reasury Allocation <span class=\"d\" style=\"font-size:11px\">(spend game $OMR to record an allocation denominated in ETH",
          "baseline": "he Vault <span class=\"d\" style=\"font-size:11px\">(spend game $OMR to record a bounded internal ETH allocation; no blockchain token burn, ETH payout or redemption is implemented"
        },
        {
          "at": 1269558,
          "current": "This records an allocation on your account. No ETH is sent to your wallet. Minimum spend: ${vault.claimMin ?? 150} $OMR. Rolling daily limit: ${fmt(vault.claimDailyOmr ?? 12000)} $OMR per account.</div>\n        ${vault.open ? `\n        <div class=\"d\" style=\"margin-top:6px\"><b>${vault.availableEth} ETH</b> available to allocate from ${vault.heldEth} ETH in recorded revenue · ${fmt(vault.omrPerEth)} $OMR per ETH\n          <input id=\"vault-amt\" placeholder=\"$OMR\" size=\"7\"> <button class=\"act\" id=\"vault-claim\"${groundOff('The vault')}>record allocation",
          "baseline": "the house never owes ETH it doesn't hold · claims ${vault.claimMin ?? 150}–${fmt(vault.claimDailyOmr ?? 12000)} $OMR/day per house · big moves draw the Bureau's eye</div>\n        ${vault.availableEth > 0 ? `\n        <div class=\"d\" style=\"margin-top:6px\"><b>${vault.availableEth} ETH</b> unclaimed of ${vault.heldEth} held · ${fmt(vault.omrPerEth)} $OMR per ETH\n          <input id=\"vault-amt\" placeholder=\"$OMR\" size=\"7\"> <button class=\"act\" id=\"vault-claim\"${groundOff('The vault')}>claim"
        },
        {
          "at": 1270420,
          "current": "`<div class=\"d\" style=\"color:var(--dim)\">${vaultR.code !== 200 ? 'The allocation ledger is unavailable.' : vault.priceStale ? 'A current $OMR price is required before an allocation can be recorded.' : 'No recorded revenue is available for an allocation.'}</div>`}\n        ${vault.mine?.eth > 0 ? `<div class=\"d\" style=\"margin-top:6px\">Your recorded allocation: <b>${vault.mine.eth} ETH</b> (${fmt(vault.mine.costOmr)} game $OMR spent).</div>` : ''}\n        ${vault.funding ? `<div class=\"d\" style=\"font-size:11px;margin-top:6px\">Recorded revenue by source ·",
          "baseline": "'<div class=\"d\" style=\"color:var(--dim)\">the vault is fully claimed — the next revenue refills it (the ETH streams are accumulating)</div>'}\n        ${vault.mine?.eth > 0 ? `<div class=\"d\" style=\"margin-top:6px\">your vault: <b>${vault.mine.eth} ETH</b> (${fmt(vault.mine.costOmr)} $OMR burned) <span class=\"chip good\">BACKED</span></div>` : ''}\n        ${vault.funding ? `<div class=\"d\" style=\"font-size:11px;margin-top:6px\">WHAT'S BEHIND IT —"
        },
        {
          "at": 1276182,
          "current": "\n      const input = $('#bond-eth'), out = $('#bond-quote-out'), buy = $('#bond-submit');\n      let quote = null;\n      input.oninput = () => { quote = null; out.textContent = ''; buy.hidden = true; }",
          "baseline": " let lastNonce = null"
        },
        {
          "at": 1276425,
          "current": "quote = null; buy.hidden = true; bq.disabled = true;\n        try {\n          const principalEth = input.value.trim();\n          const reply = await api('POST','/v1/bond/quote',{principalEth});\n          if (reply.code !== 200) throw Error(describe(reply.body,reply.code) || 'Quote unavailable.');\n          const intent = reply.body.intent;\n          const client = await import('/inventory-bond-client.js');\n          if (input.value.trim() !== principalEth) return;\n          client.validateBondQuote(reply.body,bd.purchase.deployment,me.wallet,principalEth);\n          const minDisplay = bondOmr(BigInt(intent.minimumOmr));\n          out.textContent = 'Pay '+principalEth+' ETH for at least '+minDisplay+' OMR. Vesting: '+reply.body.vestingSeconds+' seconds.'\n            +'\\nExpires: '+new Date(intent.deadline*1000).toLocaleTimeString()+'\\nBond: '+intent.to+'\\nYour wallet: '+intent.buyer+'\\nNote ID: '+reply.body.noteId;\n          quote = reply.body; buy.hidden = false;\n        } catch(error) {out.textContent=error?.message || 'Quote unavailable.';}\n        finally { bq.disabled = false; }\n      };\n      buy.onclick = async () => {\n        if (!quote || buy.disabled) return;\n        buy.disabled = true; bq.disabled = true; input.disabled = true;\n        try {\n          const provider = await inventoryBondWallet();\n          const reply = await api('POST','/v1/bond/calldata',quote.intent);\n          if (reply.code !== 200) throw Error(describe(reply.body,reply.code) || 'Request a fresh quote.');\n          const client = await import('/inventory-bond-client.js');\n          const hash = await client.submitPurchase(provider,bd.purchase.deployment,quote,reply.body,me.wallet,localStorage);\n          out.textContent += '\\nSubmitted: '+hash+'. Check the receipt after confirmation.';\n          $('#bond-note-id').value = quote.noteId;\n        } catch (error) { out.textContent += '\\n'+(error?.message || 'Purchase unavailable.'); }\n        finally { quote=null; buy.hidden=true; buy.disabled=false; bq.disabled=false; input.disabled=false; }\n      };\n    } }\n    { const input = $('#bond-note-id'); if (input) {\n      const read = $('#bond-note-read'), claim = $('#bond-note-claim'), out = $('#bond-note-out'), pin = bd.purchase.deployment;\n      const client = await import('/inventory-bond-client.js');\n      try {\n        const ids = client.savedBondIds(localStorage,pin,me.wallet);\n        $('#bond-saved').replaceChildren(...ids.map(id => new Option(id,id)));\n        input.value = ids.at(-1) || '';\n      } catch { out.textContent = 'Paste the note ID from your wallet receipt.'; }\n      input.oninput = () => { claim.hidden = true; out.textContent = ''; };\n      const handle = async sending => {\n        read.disabled = claim.disabled = input.disabled = true; claim.hidden = true;\n        try {\n          const id = input.value.trim(), provider = await inventoryBondWallet();\n          if (sending) out.textContent = 'Claim submitted: '+await client.submitClaim(provider,pin,me.wallet,id)+'. Check the receipt after confirmation.';\n          else {\n            const note = await client.readBondNote(provider,pin,me.wallet,id);\n            out.textContent = 'Amount: '+bondOmr(note.amount)+' OMR. Claimed: '+bondOmr(note.claimed)+' OMR. Available: '\n              +bondOmr(note.claimable)+' OMR. Fully vested: '+new Date(note.end*1000).toLocaleString()+'.';\n            claim.hidden = !note.claimable;\n          }\n        } catch(error) { out.textContent = error?.message || 'Unable to verify this receipt.'; }\n        finally { read.disabled = claim.disabled = input.disabled = false",
          "baseline": "const r = await api('POST', '/v1/bond/quote', { principalEth: Number($('#bond-eth').value) });\n        const out = $('#bond-quote-out'); const bs = $('#bond-submit');\n        if (r.code === 200) { lastNonce = r.body.nonce; out.style.display = 'block'; if (bs) bs.style.display = 'inline-block';\n          out.textContent = `${fmt(r.body.payoutOmr)} $OMR at ${r.body.discountBps / 100}% off · nonce ${r.body.nonce}\\nsubmit bond(quote, signature) on-chain (or use the button):\\n` + JSON.stringify({ quote: r.body.quote, signature: r.body.signature }, null, 2);\n          toast('quote signed — submit it with your wallet'); }\n        else { out.style.display = 'none'; if (bs) bs.style.display = 'none'; toast(describe(r.body) || 'quote failed')"
        },
        {
          "at": 1280050,
          "current": "read.onclick = () => handle(false); claim.onclick = () => handle(true)",
          "baseline": "const bs = $('#bond-submit'); if (bs) bs.onclick = () => { if (lastNonce != null) submitBondOnChain(lastNonce); else toast('request a quote first', true); }"
        },
        {
          "at": 1384925,
          "current": "  // The shell reveals optional controls without replacing their original action handlers.\n  const gameMenu = $('#game-menu'), cityDirectory = $('#city-directory');\n  const wideNavigation = matchMedia('(min-width: 1001px)');\n  const syncDirectory = () => { cityDirectory.open = wideNavigation.matches; };\n  syncDirectory(); wideNavigation.addEventListener('change', syncDirectory);\n  function closeGameMenu(focus = false) {\n    if (!gameMenu.open) return;\n    gameMenu.open = false;\n    if (focus) gameMenu.querySelector('summary').focus();\n  }\n  function toggleWire(open, focus = false) {\n    const wire = $('#wirepanel');\n    wire.hidden = !open;\n    $('#city-feed-toggle').setAttribute('aria-expanded', String(open));\n    if (open) $('#wire-close').focus();\n    else if (focus) $('#city-feed-toggle').focus();\n  }\n  $('#city-feed-toggle').onclick = () => toggleWire($('#wirepanel').hidden);\n  $('#wire-close').onclick = () => toggleWire(false, true);\n  gameMenu.addEventListener('toggle', () => { if (gameMenu.open) toggleWire(false); });\n  document.addEventListener('click', event => {\n    if (!gameMenu.contains(event.target)) closeGameMenu();\n    if (!wideNavigation.matches && event.target.closest('#city-sidebar [data-tab], #city-sidebar [data-group]')) cityDirectory.open = false;\n  });\n  document.addEventListener('keydown', event => {\n    if (event.key !== 'Escape') return;\n    if (gameMenu.open) { event.preventDefault(); closeGameMenu(true); }\n    else if (!$('#wirepanel').hidden && !document.querySelector('.modal-bg:not(.hidden), dialog[open]')) { event.preventDefault(); toggleWire(false, true); }\n  });\n\n",
          "baseline": ""
        },
        {
          "at": 1386603,
          "current": "game-menu-content'); // console preferences live in the account menu",
          "baseline": "top');           // the console picker (persists; reload re-renders everything)"
        }
      ]
    },
    "public/sale.html": {
      "current": {
        "mode": "100644",
        "blob": "09cc60309bdee3674415625c1371aa6eb7e4d9d2",
        "sha256": "77f4ae77545f7cc107af791db0020024db48625b429d712f9c5a68743ae55a2b",
        "bytes": 29932
      },
      "baseline": {
        "mode": "100644",
        "blob": "6e24725980377c963619bc00c813da0819e564e8",
        "sha256": "639d41062a3f6b0744ae6553b4b6ae03cd31d7c9625204841cd51ac8993378ce",
        "bytes": 29713
      },
      "inverses": [
        {
          "at": 14951,
          "current": "One five-day auction offers 40 million OMR from the 100 million supply. The graduation minimum is 10 ETH. Check the verified opening and closing blocks before bidding.</p></li>\n      <li><span class=\"sale-step__number\" aria-hidden=\"true\">02</span><h3>Enter the auction</h3><p>When bidding opens, use a wallet that holds a character NFT. Paid and free-credit character mints both qualify. Review the bid before signing.</p></li>\n      <li><span class=\"sale-step__number\" aria-hidden=\"true\">03</span><h3>Follow the settlement</h3><p>After a successful close, exit the bid and claim its filled OMR. Unused bid ETH is refundable. If graduation fails, bidders can reclaim their deposited ETH",
          "baseline": "Review the allocation, bidding window and auction rules once launch details are published.</p></li>\n      <li><span class=\"sale-step__number\" aria-hidden=\"true\">02</span><h3>Enter the auction</h3><p>When bidding opens, follow the auction link to connect your wallet and review your bid.</p></li>\n      <li><span class=\"sale-step__number\" aria-hidden=\"true\">03</span><h3>Follow the settlement</h3><p>Check the auction outcome and follow its instructions for claiming tokens or refunds"
        },
        {
          "at": 18172,
          "current": "The city has 2,500 permanent Street Deeds across six districts. Players can earn 1,000 through gameplay from level 25. Another 1,000 are reserved for paid minting and 500 for partnerships",
          "baseline": "2,500 permanent Street Deed identities across six districts: 1,000 earned through gameplay from Level 25, 1,000 allocated to paid minting, and 500 reserved for partnerships. Earn a gameplay property through its investigation or a qualifying quest. NFT minting is not available yet"
        },
        {
          "at": 19045,
          "current": "Paid mint price</dt><dd",
          "baseline": "Mint cost</dt><dd id=\"deed-cost\""
        },
        {
          "at": 19709,
          "current": "",
          "baseline": ", cost"
        },
        {
          "at": 20778,
          "current": "From level 25, investigate an available gameplay property or complete its qualifying quest. Each account can claim one gameplay Deed in its lifetime. You can also buy an existing Deed from another player. Operating benefits begin at level 25 for any Deed you control.</p><p>When extraction opens, an account that has minted its character can take an unlisted Deed it owns on-chain with a verified wallet and eligibility attestation. The signed extraction claim costs 0 ETH plus network gas. The separate character mint terms still apply",
          "baseline": "Street Deeds are discovered through gameplay or earned through eligible quests. NFT minting requires a deed you own, an eligible account and a linked wallet. Review the requirements in the city before minting"
        },
        {
          "at": 26878,
          "current": " and wallet steps will appear here when connected.'],\n    scheduled: ['Opening soon', 'Deed mint not open yet', 'Review your account and Deed eligibility",
          "baseline": ", cost and wallet steps will appear here when connected.'],\n    scheduled: ['Opening soon', 'Deed mint not open yet', 'Review deed eligibility and published mint terms"
        },
        {
          "at": 27667,
          "current": "opensAt is an ISO timestamp and",
          "baseline": "mintCostEth is in display units; opensAt is an ISO timestamp;"
        },
        {
          "at": 28107,
          "current": "",
          "baseline": "    const cost = amount(data.mintCostEth);\n"
        },
        {
          "at": 28833,
          "current": "",
          "baseline": "    byId('deed-cost').textContent = cost === null ? 'To be announced' : `${number.format(cost)} ETH + network fees`;\n"
        }
      ]
    },
    "public/ux-navigation.js": {
      "current": {
        "mode": "100644",
        "blob": "26bc7966bdef16f99ae12cf1286e94736c08d8f2",
        "sha256": "1295c1e3bed266ec992726815fe3eae194535cb428904e7b1b993ad2b6af3293",
        "bytes": 35488
      },
      "baseline": {
        "mode": "100644",
        "blob": "4799cee8f4224ca54fd6a7353ac9524d3fae4c31",
        "sha256": "dc3bb19447298cfce5dd2ad471e14cce708df163be0fe4d85dc1d0a76fee748c",
        "bytes": 34945
      },
      "inverses": [
        {
          "at": 6595,
          "current": ", mountedTools = new WeakSet()",
          "baseline": ""
        },
        {
          "at": 8987,
          "current": "",
          "baseline": "        tools.querySelector('.ux-screen-tools-close').onclick = () => { tools.open = false; tools.querySelector(':scope > summary').focus(); };\n        tools.addEventListener('keydown', event => { if (event.key === 'Escape' && mobile.matches) { tools.open = false; tools.querySelector(':scope > summary').focus(); } });\n"
        },
        {
          "at": 9023,
          "current": "      if (!mountedTools.has(tools)) {\n        const body = tools.querySelector('.ux-screen-tools-body');\n        let close = body.querySelector('.ux-screen-tools-close');\n        if (!close) {\n          close = document.createElement('button'); close.type = 'button'; close.className = 'act ux-screen-tools-close'; close.textContent = 'Close screen tools'; body.prepend(close);\n        }\n        close.onclick = () => { tools.open = false; tools.querySelector(':scope > summary').focus(); };\n        tools.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); tools.open = false; tools.querySelector(':scope > summary').focus(); } });\n        mountedTools.add(tools);\n      }\n",
          "baseline": ""
        },
        {
          "at": 28831,
          "current": "const tourContent = panel.querySelector('#start-tour-content');\n      if (tourContent) tourContent.append(host); else ",
          "baseline": ""
        }
      ]
    },
    "public/ux-tactics.js": {
      "current": {
        "mode": "100644",
        "blob": "d68342da70d384a9ce077527c9260a0096f50082",
        "sha256": "a9d9c24792f17dd4e733a238c9b18d0bd83d052975f18e9ec029fcaa1e148bc5",
        "bytes": 41949
      },
      "baseline": {
        "mode": "100644",
        "blob": "518d03651cbfa63105dfed2698c1c11d493d8c5d",
        "sha256": "23ee8040bd87b1e1a101d1a5d44193b1486307afbbaa8ff76f04609d9d7683c9",
        "bytes": 41886
      },
      "inverses": [
        {
          "at": 12017,
          "current": "if (state().currentTab === 'start') current.append(host); else ",
          "baseline": ""
        }
      ]
    },
    "src/server.js": {
      "current": {
        "mode": "100644",
        "blob": "0dba5620f244faa9123f077291b2f0abf615cac8",
        "sha256": "0448712a4923d2d0c7b1b62e4ef1c15afa6017995bfce315f5f9b29210e1fb7e",
        "bytes": 304880
      },
      "baseline": {
        "mode": "100644",
        "blob": "9ac86b5b025e3a40f0142f8adf855471e8a21e77",
        "sha256": "eae571fecd106622365194b2fd862f54635a9488ea9784d660defa292da28b5a",
        "bytes": 303757
      },
      "inverses": [
        {
          "at": 11453,
          "current": "import { loadInventoryBondCheckout, inventoryBondTransaction } from './inventorybond.js';\n",
          "baseline": ""
        },
        {
          "at": 47956,
          "current": "  app.get('/inventory-bond-client.js', reviewedModule('inventory-bond-client.js'));\n",
          "baseline": ""
        },
        {
          "at": 280017,
          "current": "const inventoryCheckout = loadInventoryBondCheckout();\n  app.get('/v1/bonds', { preHandler: auth }, async (req, reply) => {\n    reply.header('cache-control','no-store');\n    const { yours, isBacker, yourStanding, catalogs, oracle, reserve } = await Bonds.bondBoard(pool, req.user.sub);\n    return { yours, isBacker, yourStanding, catalogs, accounting: { oracle, reserve },\n      purchase: { verificationAvailable: Boolean(inventoryCheckout), deployment: inventoryCheckout?.manifest.contracts.bond ?? null },\n      note: 'Account records are historical. Request current purchase terms from POST /v1/bond/quote.' };\n  }",
          "baseline": "app.get('/v1/bonds', { preHandler: auth }, async (req) => Bonds.bondBoard(pool, req.user.sub)"
        },
        {
          "at": 281328,
          "current": "const bondPurchase = async (req, reply, prepare) => {\n    reply.header('cache-control', 'no-store');\n    if (!inventoryCheckout) return reply.code(503).send({ error: 'bond_unavailable',\n      message: 'Inventory bond purchases are awaiting verified deployment, activation and funding.' });\n    if (typeof req.body?.principalEth !== 'string') throw new G.GameError('bond_input', 'Enter the ETH amount as an exact decimal string.');\n    const wallet = (await pool.query('SELECT wallet_address FROM account_persistent WHERE account_id=$1',\n      [req.user.sub])).rows[0]?.wallet_address;\n    return inventoryBondTransaction(inventoryCheckout, wallet, req.body, { prepare });\n  };\n  app.post('/v1/bond/quote', { preHandler: auth }, async (req, reply) => bondPurchase(req, reply, false));\n  app.post('/v1/bond/calldata', { preHandler: auth }, async (req, reply) => bondPurchase(req, reply, tru",
          "baseline": "app.post('/v1/bond/quote', { preHandler: auth }, async (req) => Chain.quoteBond(pool, req.user.sub, req.body?.principalEth));\n  // server-encode the bond() submission so an injected browser wallet (MetaMask / Robinhood Wallet / etc.)\n  // can `eth_sendTransaction` it without the zero-dep client hand-rolling ABI (viem does it server-side).\n  app.post('/v1/bond/calldata', { preHandler: auth }, async (req) => Chain.bondCalldata(pool, req.user.sub, req.body?.nonc"
        }
      ]
    },
    "test/client.js": {
      "current": {
        "mode": "100644",
        "blob": "9ac4f48a71d559a64bd520aed4cf70f3c2ec1cd5",
        "sha256": "250b5003130d72494a43eeb4c977a14eee43e05ce9b50db3812d77b379ec7894",
        "bytes": 757517
      },
      "baseline": {
        "mode": "100644",
        "blob": "b712b8bc0fa7e26c2188b5f214e6fc5e42117213",
        "sha256": "62496859ad98d2bc6b82d77754141dac93eadabb3cdefae3432e5527294501a1",
        "bytes": 758653
      },
      "inverses": [
        {
          "at": 43126,
          "current": "  if (field === 'principalEth') {\n    assert.match(value, /^(?:0|[1-9]\\d*)(?:\\.\\d{1,18})?$/, 'inventory bond principal is an exact decimal ETH string');\n    assert.ok(/[1-9]/.test(value), 'inventory bond principal is positive');\n    continue;\n  }\n",
          "baseline": ""
        },
        {
          "at": 671677,
          "current": "const closedQuote = await inj8('POST','/v1/bond/quote',tC,{principalEth:'1'});\n  assert.equal(closedQuote.code,503);\n  assert.equal(closedQuote.body.error,'bond_unavailable'",
          "baseline": "// ── THE BOND QUOTE. The curated card renders its own panel through the silent api() and is NOT\n  // defective; the raw deck presses this same route through act() and read \"done.\" over a signed\n  // quote carrying a payout, a discount, a vest window and a deadline.\n  await app8.pool.query(\n    `INSERT INTO vig_buyback (id, eth_spent, omr_bought, price_omr_per_eth, to_reserve, to_prize, real, created_at)\n       VALUES ('w73-vb', 1, 3000, 3000, 0, 0, true, now())`);\n  await app8.pool.query('UPDATE bond_reserve SET capacity_omr = 1000000 WHERE id=1');\n  await app8.pool.query('INSERT INTO bond_offerings (day, offered_omr, quoted_omr) VALUES ($1, 500000, 0)',\n    [Math.floor(Date.now() / 86400000)]);\n  const bq = await driveC('/v1/bond/quote', tC, { principalEth: 1 }, 'the bond quote');\n  assert.equal(bq.r.body.bond, 'quote', 'WAVE 73 (chain): the quote must NAME its system');\n  assert.ok(bq.r.body.payoutOmr > 0 && bq.r.body.discountBps > 0 && bq.r.body.vestSeconds > 0 && bq.r.body.deadline > 0,\n    'WAVE 73 (chain): the quote must SEND the payout, the discount, the vest window and the deadline — none is derivable client-side');\n  assert.ok(bq.line.includes(fmtC(bq.r.body.payoutOmr)), `WAVE 73 (chain): the quote must name what it pays — got ${bq.line}`);\n  assert.ok(bq.line.includes(String(bq.r.body.discountBps / 100)), `WAVE 73 (chain): the quote must name the discount it was signed at — got ${bq.line}`);\n  assert.match(bq.line, /vesting over/, `WAVE 73 (chain): the quote must state that the payout vests — got ${bq.line}`"
        }
      ]
    },
    "test/economy-hardening-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "172a91b93c21de3ffabb05b422090ad25da7952c",
        "sha256": "ab7f074cfd609a09472184f13039807cea4a00904c81c3fa9caa69ca376c4023",
        "bytes": 88143
      },
      "baseline": {
        "mode": "100644",
        "blob": "33e8a00549129dde4fd23b40a9d020679bfd2428",
        "sha256": "136ec510491f7fc6fce130209b3728add5fc3cb1e2ab1d9e18c9eefdf45ad7fc",
        "bytes": 88042
      },
      "inverses": [
        {
          "at": 3644,
          "current": "import { currentEconomicTermsBaseline } from '../tools/current-economic-terms-source-transfer.js';\n",
          "baseline": ""
        },
        {
          "at": 10146,
          "current": "reviewedPhysicalSource = file => currentEconomicTermsBaseline(file,\n  deedAllocationHistoricalInput(file, fs.readFileSync(file, 'utf8')",
          "baseline": "deedAllocationPhysicalSource = file => deedAllocationHistoricalInput(file, fs.readFileSync(file, 'utf8'"
        },
        {
          "at": 10409,
          "current": "reviewed",
          "baseline": "deedAllocation"
        },
        {
          "at": 24231,
          "current": "reviewed",
          "baseline": "deedAllocation"
        },
        {
          "at": 29957,
          "current": "reviewed",
          "baseline": "deedAllocation"
        },
        {
          "at": 36266,
          "current": "reviewed",
          "baseline": "deedAllocation"
        },
        {
          "at": 41665,
          "current": "reviewed",
          "baseline": "deedAllocation"
        }
      ]
    },
    "test/lib/enterprise-ux-native-guard.js": {
      "current": {
        "mode": "100644",
        "blob": "ce0f7326ef43de3c7d3042fa148c9d760b3d234c",
        "sha256": "1ecf820ac012655c9e358ba4946c810815a8d0cce3f4731e559fcb7e0ffc2e36",
        "bytes": 17357
      },
      "baseline": {
        "mode": "100644",
        "blob": "dca55c5abc1c733552c9177b3dfc9c17c3d55887",
        "sha256": "82c978c98c833a44dd5250f64e0d3fe09992c9806690e14f812a229992ce2b97",
        "bytes": 15325
      },
      "inverses": [
        {
          "at": 277,
          "current": "import { combinedEconomicDeedPin } from '../../tools/combined-economic-deed-source-transfer.js';\n",
          "baseline": ""
        },
        {
          "at": 1332,
          "current": " const nativeEntry = 'tools/enterprise-native.js';\n assert.equal(JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts['test:agent-economy-enterprise:postgres'], 'node ' + nativeEntry);\n for (const profile of ['ci', 'local']) {\n  for (const key of ['INVENTORY_BOND_MANIFEST_PATH', 'inventory_bond_manifest_sha256']) {\n   assert.throws(() => execFileSync(process.execPath, [nativeEntry], {\n    env: { ...process.env, ENTERPRISE_NATIVE_PROFILE: profile, [key]: 'forbidden' }, stdio: 'pipe', windowsHide: true,\n   }), error => error.status === 1 && String(error.stderr).includes('Inventory bond manifest forbidden during native qualification: ' + key));\n   negatives++;\n  }\n }\n",
          "baseline": ""
        },
        {
          "at": 6986,
          "current": "4); assert.equal(pin.phase, 'ACTUAL_ENTERPRISE_ECONOMIC",
          "baseline": "3); assert.equal(pin.phase, 'ACTUAL_ENTERPRISE"
        },
        {
          "at": 7708,
          "current": "economic-inputs.js', 'Only the fresh successor manifest is self-referential');\n  for (const file of ['tools/enterprise-native-deed-inputs.js', 'public/inventory-bond-client.js', 'src/inventorybond.js',\n   'test/inventory-bond-checkout.js', 'test/economy-ux-merge-source-compatibility.js',\n   'tools/generate-current-economic-terms-source-transfer.js', 'tools/generate-combined-economic-deed-source-transfer.js']) {\n   assert(pin.files.some(row => row.file === file), 'Missing current native support: ' + file);\n  }",
          "baseline": "deed-inputs.js', 'Only the fresh successor manifest is self-referential');"
        },
        {
          "at": 10458,
          "current": "  for (const file of Object.keys(combinedEconomicDeedPin.nativeFiles)) {\n   const actual = pin.files.find(row => row.file === file);\n   const record = { type: 'blob', mode: actual.mode, blob: actual.blob };\n   const bytes = git('show', pin.authoredRevision + ':' + file);\n   const transition = assertEnterpriseUxTrackedInput(file, record, record, bytes);\n   assert.equal(transition.relation, 'exact-reviewed-economic-deed-source-provenance-only');\n   assert.equal(transition.nativeAdmission, false);\n   assert.equal(transition.priorResultsTransferred, false);\n   assert.notEqual(transition.predecessor.blob, actual.blob, 'The combined source differs from the Deed input');\n   reject(() => assertEnterpriseUxTrackedInput(file, record, record, git('show', transition.predecessorRevision + ':' + file)));\n  }\n",
          "baseline": ""
        }
      ]
    },
    "test/sale-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "22f1d430cbfba314aab830a33219825d56819645",
        "sha256": "525e737bad922ba0a982b3f6b5dd88867392f0c040e7014d250f4ebcd932bfc2",
        "bytes": 10491
      },
      "baseline": {
        "mode": "100644",
        "blob": "b0f0c53d6d15d95ac3a2c27966c8aa23c5fc466a",
        "sha256": "30ab4aeee8d601dc44928d80321b7f9b757b94e4674e35342d6e2f44aa030eed",
        "bytes": 10170
      },
      "inverses": [
        {
          "at": 718,
          "current": "import { currentEconomicTermsBaseline } from '../tools/current-economic-terms-source-transfer.js';\n",
          "baseline": ""
        },
        {
          "at": 2622,
          "current": "historical = raw => economySocialProofCutoverHistoricalInput(row.file,\n    uxAfterwordHistoricalInput(row.file, currentEconomicTermsBaseline(row.file, deedAllocationHistoricalInput(row.file, raw))));\n  const physical = historical(fs.readFileSync(row.file, 'utf8'));\n  const committed = historical(git('show', 'HEAD:' + row.file",
          "baseline": "physical = economySocialProofCutoverHistoricalInput(row.file, uxAfterwordHistoricalInput(row.file, deedAllocationHistoricalInput(row.file, fs.readFileSync(row.file, 'utf8'))));\n  const committed = economySocialProofCutoverHistoricalInput(row.file, uxAfterwordHistoricalInput(row.file, deedAllocationHistoricalInput(row.file, git('show', 'HEAD:' + row.file))"
        },
        {
          "at": 8557,
          "current": "fs.readFileSync('tools/economy-ux-merge-source-compatibility.js', 'utf8'",
          "baseline": "deedAllocationHistoricalInput('tools/economy-ux-merge-source-compatibility.js', fs.readFileSync('tools/economy-ux-merge-source-compatibility.js', 'utf8')"
        },
        {
          "at": 8820,
          "current": "  [\"import { deedAllocationHistoricalInput } from './deed-allocation-source-transfer.js';\\n\", 1],\n  ['  input = deedAllocationHistoricalInput(file, input);\\n', 2],\n  [\"import { currentEconomicTermsBaseline } from './current-economic-terms-source-transfer.js';\\n\", 1],\n  ['  input = currentEconomicTermsBaseline(file, input);\\n', 2],\n",
          "baseline": ""
        }
      ]
    },
    "tools/economy-ux-merge-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "d14c68de5a401c250cd54fea2267cc3dc6bb26d2",
        "sha256": "597e4aa6b686042ff7a2987bfe8cce892ca3a8641259e78ed75a006a5808e5ff",
        "bytes": 7773
      },
      "baseline": {
        "mode": "100644",
        "blob": "7121c48da85276b7cec7534e88a88b7e5d0fc9da",
        "sha256": "3b9f788b377d16559ca39884e3c4bedd4fe110d3de3711a0181dba255d37065b",
        "bytes": 7575
      },
      "inverses": [
        {
          "at": 368,
          "current": "import { currentEconomicTermsBaseline } from './current-economic-terms-source-transfer.js';\n",
          "baseline": ""
        },
        {
          "at": 6839,
          "current": "  input = currentEconomicTermsBaseline(file, input);\n",
          "baseline": ""
        },
        {
          "at": 7368,
          "current": "  input = currentEconomicTermsBaseline(file, input);\n",
          "baseline": ""
        }
      ]
    },
    "tools/enterprise-native-ux-seal.js": {
      "current": {
        "mode": "100644",
        "blob": "8972b325c738cd1b313ed72914a1849c321f9401",
        "sha256": "0dfc250fd22cae0936b67e16c1e6d0b1c2bf498edbbe89e9bba27b3ddc9698fc",
        "bytes": 4960
      },
      "baseline": {
        "mode": "100644",
        "blob": "e92bc4c2f7b57a28be315e760ef5ec199b9172ef",
        "sha256": "2a96e83125ce88e884165ef6672d9d175b6e8e092c41a078a6a256776b959b4b",
        "bytes": 4529
      },
      "inverses": [
        {
          "at": 575,
          "current": "ENTERPRISE_DEED_METADATA, ENTERPRISE_DEED_METADATA_SHA256, ",
          "baseline": ""
        },
        {
          "at": 857,
          "current": "import { combinedEconomicDeedPin } from './combined-economic-deed-source-transfer.js';\n",
          "baseline": ""
        },
        {
          "at": 3503,
          "current": "assert.equal(sha(read(ENTERPRISE_DEED_METADATA)), ENTERPRISE_DEED_METADATA_SHA256, 'Never reseal a rewritten Deed manifest');\nconst value = { version: 4, status: 'SEALED', phase: 'ACTUAL_ENTERPRISE_ECONOMIC",
          "baseline": "const value = { version: 3, status: 'SEALED', phase: 'ACTUAL_ENTERPRISE"
        },
        {
          "at": 4025,
          "current": " deedNativeMetadataSha256: sha(read(ENTERPRISE_DEED_METADATA)), economicNativeSourceSha256: sha(JSON.stringify(combinedEconomicDeedPin.nativeFiles)),\n",
          "baseline": ""
        }
      ]
    },
    "tools/enterprise-native-ux.js": {
      "current": {
        "mode": "100644",
        "blob": "6ca43f3bb5a7bb29502d679c29c889cbc4ee97e6",
        "sha256": "ff288ada71159928285072e8814b1cc92e8f4e035f1a386b546d8159eea1d36f",
        "bytes": 18432
      },
      "baseline": {
        "mode": "100644",
        "blob": "cfc8df57c2f6afe1dde3b02a5ec63191baea469a",
        "sha256": "ac538474d4fa502d69f5abd3a202deef1ae13b7f435082deda514b7f0fd5cd49",
        "bytes": 15631
      },
      "inverses": [
        {
          "at": 218,
          "current": "import { fileURLToPath } from 'node:url';\n",
          "baseline": ""
        },
        {
          "at": 392,
          "current": "economic-inputs.js';\nimport { ENTERPRISE_NATIVE_UX_INPUTS as DEED_NATIVE_INPUTS } from './enterprise-native-deed-inputs.js';\nimport { combinedEconomicDeedPin } from './combined-economic-deed-source-transfer",
          "baseline": "deed-inputs"
        },
        {
          "at": 877,
          "current": "// Refuse ambient checkout manifests before a native parent can connect or launch any of its sixteen children.\nif (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(new URL('./enterprise-native.js', import.meta.url))) {\n  for (const key of Object.keys(process.env)) {\n    assert(!/^INVENTORY_BOND_MANIFEST_(?:PATH|SHA256)$/i.test(key), 'Inventory bond manifest forbidden during native qualification: ' + key);\n  }\n}\n",
          "baseline": ""
        },
        {
          "at": 1413,
          "current": "economic-inputs.js';\nexport const ENTERPRISE_DEED_METADATA = 'tools/enterprise-native-deed-inputs.js';\nexport const ENTERPRISE_DEED_METADATA_SHA256 = '7dab84d91912e78448797e70dcf0fca4af19027a482d780c8557ae6a2293d311",
          "baseline": "deed-inputs.js"
        },
        {
          "at": 2183,
          "current": "ENTERPRISE_DEED_METADATA, 'tools/enterprise-native-ux.js', 'tools/enterprise-native-ux-seal.js', 'test/lib/enterprise-ux-native-guard.js', 'test/ux-source-compatibility.js', 'test/lib/ux-native-reader-source-compatibility.js', 'tools/ux-director-reader-source-seal.js', 'tools/ux-workflow-bound-source-seal.js', 'tools/ux-phase2-upgrade-bound-source-seal.js', 'tools/ux-suites-gate-source-seal.js', 'tools/sale-source-seal.js', 'test/sale-source-compatibility.js', 'tools/generate-economy-social-proof-receipt-source-transfer.js', 'tools/generate-economy-social-proof-receipt-safety-source-transfer.js', 'tools/generate-economy-social-proof-cutover-source-transfer.js', 'tools/generate-economy-bank-interest-source-transfer.js', 'tools/generate-current-economic-terms-source-transfer.js', 'tools/generate-combined-economic-deed-source-transfer.js', 'test/economy-ux-merge-source-compatibility.js', 'test/inventory-bond-checkout",
          "baseline": "'tools/enterprise-native-ux.js', 'tools/enterprise-native-ux-seal.js', 'test/lib/enterprise-ux-native-guard.js', 'test/ux-source-compatibility.js', 'test/lib/ux-native-reader-source-compatibility.js', 'tools/ux-director-reader-source-seal.js', 'tools/ux-workflow-bound-source-seal.js', 'tools/ux-phase2-upgrade-bound-source-seal.js', 'tools/ux-suites-gate-source-seal.js', 'tools/sale-source-seal.js', 'test/sale-source-compatibility.js', 'tools/generate-economy-social-proof-receipt-source-transfer.js', 'tools/generate-economy-social-proof-receipt-safety-source-transfer.js', 'tools/generate-economy-social-proof-cutover-source-transfer.js', 'tools/generate-economy-bank-interest-source-transfer"
        },
        {
          "at": 3564,
          "current": " 'public/inventory-bond-client.js',",
          "baseline": ""
        },
        {
          "at": 10845,
          "current": "deedNativeMetadataSha256', 'economicNativeSourceSha256', 'files', 'replacements', 'legacyAdditionReplacements', 'additions']);\n assert.equal(declaration.version, 4); assert.equal(declaration.phase, 'ACTUAL_ENTERPRISE_ECONOMIC_DEED_NATIVE_INPUTS');\n assert.equal(declaration.deedNativeMetadataSha256, ENTERPRISE_DEED_METADATA_SHA256);\n assert.equal(declaration.economicNativeSourceSha256, digest(JSON.stringify(combinedEconomicDeedPin.nativeFiles))",
          "baseline": "files', 'replacements', 'legacyAdditionReplacements', 'additions']);\n assert.equal(declaration.version, 3); assert.equal(declaration.phase, 'ACTUAL_ENTERPRISE_DEED_NATIVE_INPUTS'"
        },
        {
          "at": 13485,
          "current": " assert.equal(current.get(ENTERPRISE_DEED_METADATA)?.sha256, ENTERPRISE_DEED_METADATA_SHA256, 'Preserve the qualified Deed native manifest');\n const changedFromDeed = DEED_NATIVE_INPUTS.files.filter(row => {\n  const actual = current.get(row.file); assert(actual, 'Missing existing Deed native input: ' + row.file);\n  return changedPin(row, actual);\n }).map(row => row.file).sort();\n assert.deepEqual(Object.keys(combinedEconomicDeedPin.nativeFiles).sort(), changedFromDeed, 'Reviewed transitions must cover exactly the changed Deed inputs');\n",
          "baseline": ""
        },
        {
          "at": 16720,
          "current": "const deed = DEED_NATIVE_INPUTS.files.find(row => row.file === file);\n assert(!previous || deed, 'Existing B35 native input is missing from Deed admission: ' + file);\n let deedProvenance = null;\n if (previous && deed && changedPin(previous, deed)) {\n  const sourcePin = DEED_ALLOCATION_SOURCE_DOMAINS[file];\n  assert(sourcePin, 'No unreviewed Deed change to an existing native input: ' + file);\n  assert.equal(deed.mode, sourcePin.currentMode); assert.equal(deed.blob, sourcePin.currentBlob);\n  assert.equal(deed.sha256, sourcePin.currentSha256);\n  assert.equal(previous.mode, sourcePin.baselineMode); assert.equal(previous.blob, sourcePin.baselineBlob);\n  assert.equal(previous.sha256, sourcePin.baselineSha256);\n  deedProvenance = Object.freeze({ file, current: deed, predecessor: previous,\n   predecessorRevision: PREDECESSOR_NATIVE_INPUTS.authoredRevision, relation: 'exact-reviewed-deed-source-provenance-only',\n   nativeAdmission: false, priorResultsTransferred: false });\n }\n if (!deed || !changedPin(deed, expected)) return deedProvenance;\n const transition = combinedEconomicDeedPin.nativeFiles[file];\n assert(transition, 'No unreviewed economic change to an existing Deed native input: ' + file);\n for (const key of ['mode', 'blob', 'sha256']) {\n  assert.equal(transition.baseline[key], deed[key], 'Economic native predecessor: ' + file);\n  assert.equal(transition.current[key], expected[key], 'Economic native input: ' + file);\n }\n return Object.freeze({ file, current: expected, predecessor: deed, predecessorRevision: DEED_NATIVE_INPUTS.authoredRevision,\n  relation: 'exact-reviewed-economic-deed-source-provenance-only', deedProvenance",
          "baseline": "if (!previous || !changedPin(previous, expected)) return null;\n const sourcePin = DEED_ALLOCATION_SOURCE_DOMAINS[file];\n assert(sourcePin, 'No unreviewed change to an existing native input: ' + file);\n assert.equal(expected.mode, sourcePin.currentMode); assert.equal(expected.blob, sourcePin.currentBlob);\n assert.equal(expected.sha256, sourcePin.currentSha256);\n assert.equal(previous.mode, sourcePin.baselineMode); assert.equal(previous.blob, sourcePin.baselineBlob);\n assert.equal(previous.sha256, sourcePin.baselineSha256);\n return Object.freeze({ file, current: Object.freeze({ mode: current.mode, blob: current.blob, sha256: digest(bytes) }),\n  predecessor: previous, predecessorRevision: PREDECESSOR_NATIVE_INPUTS.authoredRevision,\n  relation: 'exact-reviewed-deed-source-provenance-only'"
        }
      ]
    },
    "tools/ux-release-phase2-native-catalog.js": {
      "current": {
        "mode": "100644",
        "blob": "14beaa6ac20acf452d911791b9cc45552e4fadf5",
        "sha256": "ebfc9dc7e4f990415a8f9795e151d9c8234f7deac3559c8df961c1f1b44b4c5e",
        "bytes": 30199
      },
      "baseline": {
        "mode": "100644",
        "blob": "d600b17bdcc244abc64312194a85ce29d7bfda2b",
        "sha256": "bfc7ce695934b6d14fb2d414b9f7ce237d9b54fcb62bbea860fd2b98b6821d3a",
        "bytes": 25482
      },
      "inverses": [
        {
          "at": 1284,
          "current": "const storeRevenueTable = 'store_payments', storeRevenueColumn = 'revenue_split';\nconst isStoreRevenueColumn = row => row.table_name === storeRevenueTable && row.column_name === storeRevenueColumn;\nconst storeTrailingColumns = ['account_id', 'granted', 'created_at'];\n",
          "baseline": ""
        },
        {
          "at": 9069,
          "current": ", storeRevenue",
          "baseline": ""
        },
        {
          "at": 9339,
          "current": "storeRevenue.projectMetadata(metadata)",
          "baseline": "metadata"
        },
        {
          "at": 11130,
          "current": "const rows = result.rows.filter(row => !names.has(tableOf(field, row)) && !isSocialBridgeRow(field, row)\n      && tableOf(field, row) !== DEED_BENEFIT_NATIVE_TABLE);\n    return { ...result, rows: field === 'columns' ? storeRevenue.projectColumns(rows) : rows",
          "baseline": "return { ...result, rows: result.rows.filter(row => !names.has(tableOf(field, row)) && !isSocialBridgeRow(field, row)\n      && tableOf(field, row) !== DEED_BENEFIT_NATIVE_TABLE)"
        },
        {
          "at": 12909,
          "current": ", profile) {\n  assert(['fresh', 'phase2', 'director'].includes(profile));",
          "baseline": ") {"
        },
        {
          "at": 14069,
          "current": "const storeDdl = `CREATE TABLE store_payments (\n      nonce BIGINT PRIMARY KEY, sku TEXT NOT NULL, payer_address TEXT NOT NULL,\n      amount_wei TEXT NOT NULL, tx_hash TEXT, ${profile === 'fresh' ? 'revenue_split JSONB,' : ''}\n      account_id TEXT, granted BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now()\n    );` + (profile === 'fresh' ? '' : '\\nALTER TABLE store_payments ADD COLUMN revenue_split JSONB;');\n    await client.query('CREATE TABLE characters (id TEXT PRIMARY KEY);\\n' + DEED_BENEFIT_NATIVE_DDL + ';\\n' + socialBridgeDdl + '\\n' + stor",
          "baseline": "await client.query('CREATE TABLE characters (id TEXT PRIMARY KEY);\\n' + DEED_BENEFIT_NATIVE_DDL + ';\\n' + socialBridg"
        },
        {
          "at": 14846,
          "current": "storeRevenueTable, DEED_BENEFIT_NATIVE_TABLE, ...UX_NATIVE_TABLES],\n      'Independent DDL creates exactly the FK target, current marker, social bridge and Store fixtures",
          "baseline": "DEED_BENEFIT_NATIVE_TABLE, ...UX_NATIVE_TABLES],\n      'Independent immutable DDL creates exactly the FK target, current marker, social bridge fixture"
        },
        {
          "at": 17143,
          "current": "const storeRevenue = storeRevenueNativeProjection(reference.columns.filter(isStoreRevenueColumn), profile);\n    return freeze({ ux, socialBridge, benefitNative, storeRevenu",
          "baseline": "return freeze({ ux, socialBridge, benefitNativ"
        },
        {
          "at": 17607,
          "current": "function storeRevenueNativeProjection(reference, profile) {\n  const fresh = profile === 'fresh';\n  assert.deepEqual(reference, [{ table_name: storeRevenueTable, column_name: storeRevenueColumn,\n    ordinal: fresh ? 6 : 9, type: 'jsonb', typmod: -1, default_expression: null, not_null: false,\n    identity: '', generated: '', collation_schema: null, collation_name: null }],\n  'Independent Store DDL yields exactly the nullable JSONB receipt column at its fresh or upgrade ordinal');\n  reference = freeze(structuredClone(reference));\n  const projectColumns = columns => {\n    assert.deepEqual(columns.filter(isStoreRevenueColumn), reference, 'The complete Store receipt column remains exact before historical projection');\n    let shifted = 0;\n    const projected = columns.filter(row => !isStoreRevenueColumn(row)).map(row => {\n      const index = row.table_name === storeRevenueTable ? storeTrailingColumns.indexOf(row.column_name) : -1;\n      if (!fresh || index < 0) return row;\n      assert.equal(row.ordinal, index + 7, 'Only the three exact fresh Store columns follow the new receipt column');\n      shifted++; return { ...row, ordinal: row.ordinal - 1 };\n    });\n    assert.equal(shifted, fresh ? 3 : 0);\n    return projected;\n  };\n  const projectMetadata = metadata => ({ ...metadata, columns: projectColumns(metadata.columns) });\n  const extendReference = base => {\n    assert.deepEqual(base.columns.filter(row => row.table_name === storeRevenueTable).map(row => [row.column_name, row.ordinal]),\n      ['nonce', 'sku', 'payer_address', 'amount_wei', 'tx_hash', ...storeTrailingColumns].map((name, index) => [name, index + 1]),\n      'The unchanged historical oracle has exactly the eight original Store columns');\n    const columns = base.columns.map(row => fresh && row.table_name === storeRevenueTable && storeTrailingColumns.includes(row.column_name)\n      ? { ...row, ordinal: row.ordinal + 1 } : row);\n    const at = columns.findIndex(row => row.table_name === storeRevenueTable && row.column_name === (fresh ? 'tx_hash' : 'created_at'));\n    assert(at >= 0); columns.splice(at + 1, 0, ...reference);\n    return freeze({ ...base, columns });\n  };\n  return Object.freeze({ reference, projectColumns, projectMetadata, extendReference });\n}\n",
          "baseline": ""
        },
        {
          "at": 22401,
          "current": "storeRevenue, ",
          "baseline": ""
        },
        {
          "at": 22683,
          "current": "storeRevenue.projectMetadata(metadata)))),\n    base = branches ? prior.current : prior.reference, reference = storeRevenue.extendReference(benefitNative.extendReference(merge(base, socialBridge, ux)",
          "baseline": "metadata))),\n    base = branches ? prior.current : prior.reference, reference = benefitNative.extendReference(merge(base, socialBridge, ux"
        },
        {
          "at": 26556,
          "current": "  let storeRevenueCausal = 0;\n  const receipt = storeRevenue.reference[0], at = reference.columns.indexOf(receipt);\n  assert(at >= 0);\n  const rejectStore = columns => { assert.throws(() => verifyMetadata({ ...reference, columns }), error => error?.code === 'ERR_ASSERTION'); storeRevenueCausal++; };\n  rejectStore(reference.columns.filter((_, index) => index !== at));\n  rejectStore([...reference.columns, { ...receipt }]);\n  for (const key of Object.keys(receipt)) {\n    const value = receipt[key], changed = { ...receipt, [key]: typeof value === 'boolean' ? !value\n      : typeof value === 'number' ? value + 1 : value === null ? 'unknown' : value + '__unknown' };\n    rejectStore(reference.columns.map((row, index) => index === at ? changed : row));\n  }\n  for (const column of storeTrailingColumns) rejectStore(reference.columns.map(row =>\n    row.table_name === storeRevenueTable && row.column_name === column ? { ...row, ordinal: row.ordinal + 1 } : row));\n  assert.equal(storeRevenueCausal, Object.keys(receipt).length + 5, 'Store receipt missing, duplicate, every field and all three adjacent ordinal mutations are refused');\n",
          "baseline": ""
        },
        {
          "at": 28023,
          "current": ",\n    storeRevenueReference: storeRevenue.reference, storeRevenueCausal",
          "baseline": ""
        },
        {
          "at": 29215,
          "current": ", storeRevenue } = await compileCurrentExtensionReference(pool, endpoint, options.legacyProfile",
          "baseline": " } = await compileCurrentExtensionReference(pool, endpoint"
        },
        {
          "at": 29452,
          "current": ", storeRevenue), endpoint, candidate, options);\n  return extendCatalog(prior, ux, socialBridge, benefitNative, storeRevenu",
          "baseline": "), endpoint, candidate, options);\n  return extendCatalog(prior, ux, socialBridge, benefitNativ"
        },
        {
          "at": 29866,
          "current": ", storeRevenue } = await compileCurrentExtensionReference(pool, endpoint, 'fresh'",
          "baseline": " } = await compileCurrentExtensionReference(pool, endpoint"
        },
        {
          "at": 30074,
          "current": ", storeRevenue), endpoint, candidate);\n  return extendCatalog(prior, ux, socialBridge, benefitNative, storeRevenu",
          "baseline": "), endpoint, candidate);\n  return extendCatalog(prior, ux, socialBridge, benefitNativ"
        }
      ]
    }
  },
  "economicFiles": {
    "public/wiki.html": {
      "current": {
        "mode": "100644",
        "blob": "f01de86e75c5be43a7f9ff0ef9ff2a3d03aae4b5",
        "sha256": "a738f2be4719fc9a2414e9fae546e33b1186bfa8fad3608fd288e6d5d763ce0b",
        "bytes": 245588
      },
      "baseline": {
        "mode": "100644",
        "blob": "ea7614150f73b9cce28e8d7a8b3330ed922ecf2f",
        "sha256": "9499045fd0c275b439445598b5c009c33fc69a6bbff1a3a5d0f4fea4f2d8890b",
        "bytes": 245116
      },
      "inverses": [
        {
          "at": 37376,
          "current": "verified auction contract’s opening and closing blocks determine when bids are accepted. Check the published auction status for timing",
          "baseline": "target is around noon New York on Friday, October 9 through Wednesday, October 14, 2026. Verified native block boundaries determine the window; exact wall-clock timing is not guaranteed"
        },
        {
          "at": 43898,
          "current": "depends on the previous day’s returned inventory and the available shelf. Its daily float cap starts at 1% and can rise to 3% during a surge, with a 6,000 OMR minimum for the ca",
          "baseline": "is what came home yesterday, capped at 1% of all the $OMR in player hands so a big\n      spending day can't become a dum"
        },
        {
          "at": 44777,
          "current": "starts a new 48-hour surcharge window</b>. The extra withdrawal charge falls linearly from 50% at receipt to zero after 48 hours",
          "baseline": "is FRESH</b> — full early-exit toll for its first 48 hours, like any other"
        },
        {
          "at": 95259,
          "current": "Of the city’s 2,500 permanent properties, 1,000 are available through gameplay from level 25, 1,000 are reserved for paid minting and 500 for partnerships. Select a gameplay property on the district map, then inspect its site, verify the registry record, question its witness and return to secure its title. Each of the four objectives costs 5 energy and names its required district. Alternatively, follow <b>A House With a Past</b> in the quest journal, collecting evidence and committing to its story choices",
          "baseline": "All 2,500 permanent houses and buildings are discoverable from the first release. Select a building on the district property map, then inspect its site, verify the registry record, question its witness and return to secure its title. Each of the four objectives costs 5 energy and names its required district. Alternatively, follow <b>A House With a Past</b> in the quest journal, collecting evidence and committing to its story choices. Discovery requires level 15"
        },
        {
          "at": 96199,
          "current": "Once your current character reaches level 25, active streets you control can start earning the capped cash <b>corner take</b>. The same level requirement applies however you acquired the property",
          "baseline": "At level 8, collect the capped cash <b>corner take</b> from streets you control"
        },
        {
          "at": 96997,
          "current": ",actionId",
          "baseline": ""
        },
        {
          "at": 118853,
          "current": "Under the configured payment router, 50% of ETH package revenue goes to the developer, 25% to the Vig, 10% to Treasury and 15% to the community. Character mint payments go entirely to the developer",
          "baseline": "Revenue divides 40% founder / 40% buyback / 20%\n      treasury (the Vault's ETH)"
        },
        {
          "at": 119335,
          "current": "The Store quotes PLEX prices from the market rate, subject to each package’s price floor",
          "baseline": "Across the mission ladder, $OMR rewards sum to 1,320 and the daily bonus adds 3,\n      compared with 4,118 for the cheapest PLEX package"
        },
        {
          "at": 120493,
          "current": "requires launch approval and confirmed reserve capacity.</b> The Treasury board records an ETH allocation when you spend game OMR. The allocation stays on the game ledger. It sends no ETH to your walle",
          "baseline": "and backed ETH claims remain gated</b>; they become available only after production launch requirements clear and actual backing is presen"
        },
        {
          "at": 186954,
          "current": "gameplay qualification, optional deed upgrades",
          "baseline": "activity, activation"
        },
        {
          "at": 214246,
          "current": "receipts and allocations. Verifying the treasury’s actual wallet balance requires a separate on-chain check",
          "baseline": "funding and\n      allocations"
        },
        {
          "at": 216000,
          "current": "ithdrawals depend on reserve capacity.</b> The game checks its recorded reserve before signing a voucher for the net amount after withdrawal charges. Requests can queue. On-chain redemption also depends on the claim contract’s actual OMR balance and available capacity",
          "baseline": "hat you can take out is bounded by code, not by arithmetic.</b> The withdrawal rail signs nothing the\n        reserve cannot back, and the reserve is filled by real revenue — so \"you can only take out what somebody put\n        in\" is a rule the rail enforces on every withdrawal, whatever the supply does. That is the guarantee worth\n        having, and the one that holds even with the mission tap open"
        },
        {
          "at": 219257,
          "current": "qualifies the account for extraction after launch. Pay",
          "baseline": "makes a trial character permanent for"
        },
        {
          "at": 219637,
          "current": "ntract reserves the complete entitlement from existing inventory at purchase. Each offer has a fixed discount of at most 10% and a linear vest of 1 to 365 days",
          "baseline": "mplete payout is reserved from existing inventory at purchase"
        },
        {
          "at": 220030,
          "current": " The offer requires verified deployment, funding and activation.",
          "baseline": ""
        },
        {
          "at": 220287,
          "current": "",
          "baseline": " · GET /v1/bonds [public] · /bonds/:id/claim"
        }
      ]
    }
  },
  "fixtureFiles": {
    "test/lib/rc1-historical-source-fixture.js": {
      "current": {
        "mode": "100644",
        "blob": "05b015e5e73922216d5a98aa746baaee373fbc66",
        "sha256": "fb724f2bddeb67bc14273f53781c5b74b42f51889d5688a31c7dfee2373ed3f5",
        "bytes": 47402
      },
      "baseline": {
        "mode": "100644",
        "blob": "0773ce2a68874504490d6301f896c2b908f14656",
        "sha256": "0c7d1202e9b1eb86ec144451cdf28e81ebc8784648c0ab27aa43513d1625d989",
        "bytes": 44705
      },
      "inverses": [
        {
          "at": 455,
          "current": "import {combinedEconomicDeedPin} from '../../tools/combined-economic-deed-source-transfer.js';\n",
          "baseline": ""
        },
        {
          "at": 7369,
          "current": "const economicReceiptHistoricalFiles = Object.freeze(['src/store.js', 'src/router.js', 'src/treasury.js', 'src/watcher.js']);\n",
          "baseline": ""
        },
        {
          "at": 14244,
          "current": "function economicReceiptHistoricalInput(file, input, expected) {\n  if (!economicReceiptHistoricalFiles.includes(file)) return input;\n  const raw = uniformHistoricalInput(file, input), current = canonical(raw);\n  const row = combinedEconomicDeedPin.nativeFiles[file];\n  // This table binds source identities only. The frozen fixture independently selects its body.\n  assert(row, 'Reviewed economic receipt identities required: ' + file);\n  assert.equal(row.baseline.sha256, sha256(expected), 'Economic receipt predecessor differs from frozen release: ' + file);\n  assert.equal(row.baseline.blob, blobHash(expected), 'Economic receipt predecessor blob changed: ' + file);\n  if (sha256(current) !== row.current.sha256) return raw;\n  assert.equal(blobHash(Buffer.from(current)), row.current.blob, 'Economic receipt current blob changed: ' + file);\n  assert.equal(Buffer.byteLength(current), row.current.bytes);\n  for (const [revision, pin] of [[combinedEconomicDeedPin.source, row.current], [combinedEconomicDeedPin.predecessor, row.baseline]]) {\n    assert.equal(String(git(['ls-tree', revision, '--', file])).trim(), pin.mode + ' blob ' + pin.blob + '\\t' + file,\n      'Economic receipt revision identity changed: ' + file);\n  }\n  assert.equal(current, String(git(['cat-file', 'blob', row.current.blob])), 'Complete economic receipt authored source changed: ' + file);\n  return String(expected);\n}\n",
          "baseline": ""
        },
        {
          "at": 18311,
          "current": "receipts = economicReceiptHistoricalInput(file, input, expected);\n  const combined = enterpriseCombinedHistoricalInput(file, receipts",
          "baseline": "combined = enterpriseCombinedHistoricalInput(file, input"
        },
        {
          "at": 35422,
          "current": "  for (const file of economicReceiptHistoricalFiles) {\n    const current = canonical(originalRead(path.join(root, file))), frozen = String(blob(file, release));\n    const expected = blob(file, history);\n    assert.notEqual(current, frozen, 'Receipt fixture control exercises the reviewed successor: ' + file);\n    for (const source of [current, frozen]) {\n      for (const supplied of [source, source.replaceAll('\\n', '\\r\\n')]) {\n        assert.deepEqual(currentHistoricalApplicationSource(file, supplied), expected);\n        positives++;\n      }\n      for (const supplied of [source + '\\n// unreviewed\\n', source.slice(1), source.replace(/\\S/, '?'),\n        '\\ufeff' + source, source.replace('\\n', '\\r\\n'), source.replace('\\n', '\\r')]) {\n        assert.throws(() => currentHistoricalApplicationSource(file, supplied));\n        refusals++;\n      }\n    }\n  }\n  assert.throws(() => currentHistoricalApplicationSource('src/store.js', String(originalRead(path.join(root, 'src/router.js')))));\n  refusals++;\n",
          "baseline": ""
        }
      ]
    }
  },
  "nativeFiles": {
    "AGENTS.md": {
      "current": {
        "mode": "100644",
        "blob": "627700e8c897578951ef5ee94f4938fe41800cbc",
        "sha256": "f5d101cba3010c710cd0d64246fb4b0c080e9632bc7496b582cca8e05dec55b8",
        "bytes": 49646
      },
      "baseline": {
        "mode": "100644",
        "blob": "40a764e3fc39a7c93d2c0d8797913f6f9e9d4444",
        "sha256": "ffd42e51acb2b06b12b4ac7132f5fd4c4ae2f29f63720b9e7d3931d3fe7b79b4",
        "bytes": 49584
      }
    },
    "package.json": {
      "current": {
        "mode": "100644",
        "blob": "d88a33d6eaa1e4b9e6adc3490ecb0c9e1bd96afc",
        "sha256": "82107889e119e262579663e239f09b4abbe1c068ff63c582764ddcb2e5ce32fa",
        "bytes": 60022
      },
      "baseline": {
        "mode": "100644",
        "blob": "02a624dc1659581ee688c22e5442712552ca9170",
        "sha256": "44a450b15010487b9c2916c9d0a29a583dfe95f9c9b12033afbb25620560ab56",
        "bytes": 59904
      }
    },
    "public/admin.html": {
      "current": {
        "mode": "100644",
        "blob": "e3941b7cdbd15fd45e58f3c9bf07ef71b38b0752",
        "sha256": "c8df61887195c23e7f9513bb723ce28bec14fd4e34874533304b9c8d5d97960b",
        "bytes": 100281
      },
      "baseline": {
        "mode": "100644",
        "blob": "eb007603283dd7f45685d317ead3b1e7abb97893",
        "sha256": "32a03fd7f9af4485e872ff1405d02d55ba96a5957d7d16c6ff54580410f874fe",
        "bytes": 100152
      }
    },
    "public/defi.html": {
      "current": {
        "mode": "100644",
        "blob": "51c890f6becf7ec6e2d36849921f24f6c9ad6e10",
        "sha256": "4b42f4dacb233506a6076e56e39d6de79003c5b072655821e8b10da2c8cf8286",
        "bytes": 83681
      },
      "baseline": {
        "mode": "100644",
        "blob": "778524260321323fa8850802d063361873927fb4",
        "sha256": "26a2d48e515fb0f4db8700c2406a12c0da3224907bcb0049734a7f5df815807a",
        "bytes": 83381
      }
    },
    "public/fee-flows.html": {
      "current": {
        "mode": "100644",
        "blob": "ebafb352b60cd1c26cb86b9196068729b7f27a53",
        "sha256": "7ce73cf02d1685e1fa6f6112dbdc0785d3c89fe32843e09e1068526a6d838ca2",
        "bytes": 38122
      },
      "baseline": {
        "mode": "100644",
        "blob": "2ad9da841ee8aa1b2d09417ab96e80ad1663e280",
        "sha256": "f2eecafe177b5bbf0e97c4e650b36870751f31aaae6579ea82d624adb8be0498",
        "bytes": 37960
      }
    },
    "public/index.html": {
      "current": {
        "mode": "100644",
        "blob": "d356290eff68f6ac8521ed0d63c257712b3cb214",
        "sha256": "9c520c523d8d79be1a3608f49580a62112e0b7adb695a5e2876b8fb144538468",
        "bytes": 1400474
      },
      "baseline": {
        "mode": "100644",
        "blob": "96b2921c67993953909847604016491481e64919",
        "sha256": "ff1924deb41952c9be01a1064f0696d18eb21948e762a60144050c74b7d81344",
        "bytes": 1400315
      }
    },
    "public/omerta-ui.css": {
      "current": {
        "mode": "100644",
        "blob": "f394406e1edb1f5571f67676266c291e1aea1c96",
        "sha256": "c19546a18cde7f354e97c7c631fc5dee0401c466da7cf91eaa4318d6ada8a66c",
        "bytes": 94859
      },
      "baseline": {
        "mode": "100644",
        "blob": "83b5fc76ec9ffd151192e7f3a619c4fe5a9e3578",
        "sha256": "0c706ab6e86876c34afdf78392aaa42bd7122f7b38fb4485265e059ed01c809a",
        "bytes": 78645
      }
    },
    "public/sale.html": {
      "current": {
        "mode": "100644",
        "blob": "09cc60309bdee3674415625c1371aa6eb7e4d9d2",
        "sha256": "77f4ae77545f7cc107af791db0020024db48625b429d712f9c5a68743ae55a2b",
        "bytes": 29932
      },
      "baseline": {
        "mode": "100644",
        "blob": "6e24725980377c963619bc00c813da0819e564e8",
        "sha256": "639d41062a3f6b0744ae6553b4b6ae03cd31d7c9625204841cd51ac8993378ce",
        "bytes": 29713
      }
    },
    "public/ux-feedback.js": {
      "current": {
        "mode": "100644",
        "blob": "c134ad6c311a4b7c0b6ec0fed4ff10e460385023",
        "sha256": "1098d0997cdc81da460a50cae2574918400bc27f8a8b3002bd6b59ef311d1c9c",
        "bytes": 13365
      },
      "baseline": {
        "mode": "100644",
        "blob": "edd1a6bcfaa690852bf753349fff1046da3a36de",
        "sha256": "002d872bc67a440a512bd1903418ae6acd28940e84b0499af42eba3a34700b97",
        "bytes": 13315
      }
    },
    "public/ux-navigation.js": {
      "current": {
        "mode": "100644",
        "blob": "26bc7966bdef16f99ae12cf1286e94736c08d8f2",
        "sha256": "1295c1e3bed266ec992726815fe3eae194535cb428904e7b1b993ad2b6af3293",
        "bytes": 35488
      },
      "baseline": {
        "mode": "100644",
        "blob": "4799cee8f4224ca54fd6a7353ac9524d3fae4c31",
        "sha256": "dc3bb19447298cfce5dd2ad471e14cce708df163be0fe4d85dc1d0a76fee748c",
        "bytes": 34945
      }
    },
    "public/ux-tactics.js": {
      "current": {
        "mode": "100644",
        "blob": "d68342da70d384a9ce077527c9260a0096f50082",
        "sha256": "a9d9c24792f17dd4e733a238c9b18d0bd83d052975f18e9ec029fcaa1e148bc5",
        "bytes": 41949
      },
      "baseline": {
        "mode": "100644",
        "blob": "518d03651cbfa63105dfed2698c1c11d493d8c5d",
        "sha256": "23ee8040bd87b1e1a101d1a5d44193b1486307afbbaa8ff76f04609d9d7683c9",
        "bytes": 41886
      }
    },
    "public/ux-world.js": {
      "current": {
        "mode": "100644",
        "blob": "cf716e138b196940649fc47a67b73093766246d9",
        "sha256": "e7cd7674ecbf91bfbb7ea012aa59d6b733757de0ad4541276a022b2dbca107ff",
        "bytes": 24001
      },
      "baseline": {
        "mode": "100644",
        "blob": "b028b333c2a027d371c2126620c00b9664e1cb9d",
        "sha256": "fd3b021e1c8a0e8edb4148a59fc876526eed876922ce22984e1702f6546bb3ee",
        "bytes": 23951
      }
    },
    "public/wiki.html": {
      "current": {
        "mode": "100644",
        "blob": "f01de86e75c5be43a7f9ff0ef9ff2a3d03aae4b5",
        "sha256": "a738f2be4719fc9a2414e9fae546e33b1186bfa8fad3608fd288e6d5d763ce0b",
        "bytes": 245588
      },
      "baseline": {
        "mode": "100644",
        "blob": "ea7614150f73b9cce28e8d7a8b3330ed922ecf2f",
        "sha256": "9499045fd0c275b439445598b5c009c33fc69a6bbff1a3a5d0f4fea4f2d8890b",
        "bytes": 245116
      }
    },
    "schema.sql": {
      "current": {
        "mode": "100755",
        "blob": "92f7dec47d2b012437c9253d87ff796f68d29c18",
        "sha256": "019ecc952bc9ae81b99c2a1a2bb713af6ad1971fd0b803a564d54ca4115dbf1e",
        "bytes": 624018
      },
      "baseline": {
        "mode": "100755",
        "blob": "9a2605d3d4c6fdcb382184ccc1e1ce12180c3a42",
        "sha256": "b2a337dfaddd06f670774c9bbf2ddebb09c5857a769be598aa54376ea29fa5f7",
        "bytes": 623900
      }
    },
    "src/agentgateway.js": {
      "current": {
        "mode": "100644",
        "blob": "aaf10d3531f5158f76bf9482f536bba7dd3d7ed6",
        "sha256": "fd889fb402a434d95744260a5da48b6b4d0e9f61a0088146f4b4b366d412f43a",
        "bytes": 155683
      },
      "baseline": {
        "mode": "100644",
        "blob": "e0185998ed68e0604062aca2e23dfefdb1d79ea1",
        "sha256": "337a77e151c17e55ea4055280d192d353cdd067d6069b4d001ce7bfbf9be4071",
        "bytes": 155543
      }
    },
    "src/chain.js": {
      "current": {
        "mode": "100644",
        "blob": "48b695827e44993257c2afb7de0b5d109fda48b5",
        "sha256": "3d902aec853e3f3df5dfeed3bace7df97c021f2060b1e198018918928fe88b35",
        "bytes": 131574
      },
      "baseline": {
        "mode": "100644",
        "blob": "dc022999473e6f659caa828cf664ca113a9ab1ec",
        "sha256": "ce07b1723a4657326ea37ab40010843b711aa04834b14950ffc0e2568eb15110",
        "bytes": 131508
      }
    },
    "src/preflight.js": {
      "current": {
        "mode": "100644",
        "blob": "ff4cac0d92091afa51fb31a5aa29e0769d9df19d",
        "sha256": "64b78df31d2c6df6cbeb4854be51c36ba72b8c9d7ba7c650325caf55d783e071",
        "bytes": 40051
      },
      "baseline": {
        "mode": "100644",
        "blob": "ac3ba92249dbcebe7cfde910d2276373b15eb845",
        "sha256": "4901dca23d457a6c0dc56c6ca72371162200235de7287ec449363584f74286ea",
        "bytes": 40073
      }
    },
    "src/router.js": {
      "current": {
        "mode": "100644",
        "blob": "d2808370c74e83e02504179af20e59278cc3309a",
        "sha256": "916fad627d1795fc72e6a3e890806fc14990013d42a8f0d6c97e6b7c8afb06ab",
        "bytes": 28054
      },
      "baseline": {
        "mode": "100644",
        "blob": "85eb417788f563c3cad674082172327fa95a9f33",
        "sha256": "c72b9aeac7fa8247d73944dff15bb2b4aa8ee400c8080f3ac31d78c0ac894d94",
        "bytes": 27811
      }
    },
    "src/routes/leaderboards.js": {
      "current": {
        "mode": "100644",
        "blob": "54c157415d35f2941cef76f8d15e2e6014eec4f6",
        "sha256": "2c8586e985078263e92d21717230438537c4f636e8fef57f785609fd3d12b922",
        "bytes": 9917
      },
      "baseline": {
        "mode": "100644",
        "blob": "477ea58a32d7ec16085abe3d566a8715bc712e20",
        "sha256": "c80f796b2da8f525aeead3e5b9f7d066d57aec3f11b007996da696aeba79530f",
        "bytes": 10254
      }
    },
    "src/routes/modtools.js": {
      "current": {
        "mode": "100644",
        "blob": "c141604882574c7fee44e667f4281c05b9b157c3",
        "sha256": "117ef38c68e1d801c66b25310b7ff0928aa839a4d6609c1fcba1a2f8acfea845",
        "bytes": 35444
      },
      "baseline": {
        "mode": "100644",
        "blob": "ef47f2fbadb3119cf9ffb7cbecaabccb23b11f58",
        "sha256": "0c168552617be43d7a6800c3f2ff33dce0d6186f3d9cd9bcdd76b3ca82d330dc",
        "bytes": 35633
      }
    },
    "src/rules.tail.js": {
      "current": {
        "mode": "100644",
        "blob": "a17a1e6ef6f4607d9ef765e9b44bc98258386f32",
        "sha256": "bc034017234bc42fccb38a63d00beb8c6bfc73ea950f055e75ef5b79bc0c4991",
        "bytes": 495218
      },
      "baseline": {
        "mode": "100644",
        "blob": "ab3906403df571350d7057fd8a01de53d23116be",
        "sha256": "5d255c106c3d10d9f813fda71be75bff2c80b3d3559cdeda48da18b379563845",
        "bytes": 496801
      }
    },
    "src/server.js": {
      "current": {
        "mode": "100644",
        "blob": "0dba5620f244faa9123f077291b2f0abf615cac8",
        "sha256": "0448712a4923d2d0c7b1b62e4ef1c15afa6017995bfce315f5f9b29210e1fb7e",
        "bytes": 304880
      },
      "baseline": {
        "mode": "100644",
        "blob": "9ac86b5b025e3a40f0142f8adf855471e8a21e77",
        "sha256": "eae571fecd106622365194b2fd862f54635a9488ea9784d660defa292da28b5a",
        "bytes": 303757
      }
    },
    "src/store.js": {
      "current": {
        "mode": "100644",
        "blob": "3ca89eea130ed2f89687e1468dc2e437d33765cc",
        "sha256": "d7622ce97eb3cacb2dbd07f1b6b37ac88fc98cf00d9fe8fbf371217f65327f72",
        "bytes": 30206
      },
      "baseline": {
        "mode": "100644",
        "blob": "321d4046301eacf214925c397768cb8f189468e1",
        "sha256": "514ad59c728d126e101cc1c495d7073fcea288c6d70754ba07bff73b520f0bc0",
        "bytes": 32685
      }
    },
    "src/treasury.js": {
      "current": {
        "mode": "100644",
        "blob": "0340c8a804af2a04451d75e473f421c236b6a888",
        "sha256": "4d3154e054d325f48469864bddb587ac17e4ce4decd8b92ffc43aaf535c194d0",
        "bytes": 52294
      },
      "baseline": {
        "mode": "100644",
        "blob": "9f6119fb3561479126ab9d32b67a66303506a6fa",
        "sha256": "0e6d636f5d26d2ea89d0e75371dc21fe6de459ce026c6cb4f03f43bc84444d20",
        "bytes": 52264
      }
    },
    "src/watcher.js": {
      "current": {
        "mode": "100644",
        "blob": "79d9d308ebaf46323bd4b576a0c3877dfc65a4a2",
        "sha256": "4aeccc2eaf7cbb2ec4e72635765186629ec86b9418c35868ab99c80fc8b5189e",
        "bytes": 35755
      },
      "baseline": {
        "mode": "100644",
        "blob": "bb39bd3482c13b1448a36d23a9fed0f489c36b9d",
        "sha256": "408e90bd12f137b551ec29974bb1acfa9ea2545fbe7d3ab0de842fa5d3d90099",
        "bytes": 33728
      }
    },
    "test/client.js": {
      "current": {
        "mode": "100644",
        "blob": "9ac4f48a71d559a64bd520aed4cf70f3c2ec1cd5",
        "sha256": "250b5003130d72494a43eeb4c977a14eee43e05ce9b50db3812d77b379ec7894",
        "bytes": 757517
      },
      "baseline": {
        "mode": "100644",
        "blob": "b712b8bc0fa7e26c2188b5f214e6fc5e42117213",
        "sha256": "62496859ad98d2bc6b82d77754141dac93eadabb3cdefae3432e5527294501a1",
        "bytes": 758653
      }
    },
    "test/gates.js": {
      "current": {
        "mode": "100644",
        "blob": "fe95ef10b9a17f81e4852c96c64253b9a768f954",
        "sha256": "47a484c6c419e7606cac33bfb4bbaa0e7906d2604090d0940b356c61280282df",
        "bytes": 461839
      },
      "baseline": {
        "mode": "100644",
        "blob": "238e7a38313f54fd09d82df4dedb9a574f04243d",
        "sha256": "727b8cfba27ab2b1a69dedaa43aa5d289a09d91aeb27be5f66e87d744f1f4a12",
        "bytes": 461461
      }
    },
    "test/lib/enterprise-ux-native-guard.js": {
      "current": {
        "mode": "100644",
        "blob": "ce0f7326ef43de3c7d3042fa148c9d760b3d234c",
        "sha256": "1ecf820ac012655c9e358ba4946c810815a8d0cce3f4731e559fcb7e0ffc2e36",
        "bytes": 17357
      },
      "baseline": {
        "mode": "100644",
        "blob": "dca55c5abc1c733552c9177b3dfc9c17c3d55887",
        "sha256": "82c978c98c833a44dd5250f64e0d3fe09992c9806690e14f812a229992ce2b97",
        "bytes": 15325
      }
    },
    "test/lib/rc1-historical-source-fixture.js": {
      "current": {
        "mode": "100644",
        "blob": "05b015e5e73922216d5a98aa746baaee373fbc66",
        "sha256": "fb724f2bddeb67bc14273f53781c5b74b42f51889d5688a31c7dfee2373ed3f5",
        "bytes": 47402
      },
      "baseline": {
        "mode": "100644",
        "blob": "0773ce2a68874504490d6301f896c2b908f14656",
        "sha256": "0c7d1202e9b1eb86ec144451cdf28e81ebc8784648c0ab27aa43513d1625d989",
        "bytes": 44705
      }
    },
    "test/sale-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "22f1d430cbfba314aab830a33219825d56819645",
        "sha256": "525e737bad922ba0a982b3f6b5dd88867392f0c040e7014d250f4ebcd932bfc2",
        "bytes": 10491
      },
      "baseline": {
        "mode": "100644",
        "blob": "b0f0c53d6d15d95ac3a2c27966c8aa23c5fc466a",
        "sha256": "30ab4aeee8d601dc44928d80321b7f9b757b94e4674e35342d6e2f44aa030eed",
        "bytes": 10170
      }
    },
    "tools/deed-allocation-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "0c5408a7206141d5b57c5189585cf37ecc358207",
        "sha256": "f200ba9d3bb5dd0302888465ffcf13725f3c15443cceb6d149ac1b6503227733",
        "bytes": 3882
      },
      "baseline": {
        "mode": "100644",
        "blob": "f968d8a48b3a579b9861b80bdfde34d15f637b8a",
        "sha256": "a9879727915e895cf3bc0f65457ab87255c0f109dbe01aa9b0ea28f0abffbfbd",
        "bytes": 3627
      }
    },
    "tools/economy-ux-merge-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "d14c68de5a401c250cd54fea2267cc3dc6bb26d2",
        "sha256": "597e4aa6b686042ff7a2987bfe8cce892ca3a8641259e78ed75a006a5808e5ff",
        "bytes": 7773
      },
      "baseline": {
        "mode": "100644",
        "blob": "7121c48da85276b7cec7534e88a88b7e5d0fc9da",
        "sha256": "3b9f788b377d16559ca39884e3c4bedd4fe110d3de3711a0181dba255d37065b",
        "bytes": 7575
      }
    },
    "tools/enterprise-native-ux-seal.js": {
      "current": {
        "mode": "100644",
        "blob": "8972b325c738cd1b313ed72914a1849c321f9401",
        "sha256": "0dfc250fd22cae0936b67e16c1e6d0b1c2bf498edbbe89e9bba27b3ddc9698fc",
        "bytes": 4960
      },
      "baseline": {
        "mode": "100644",
        "blob": "e92bc4c2f7b57a28be315e760ef5ec199b9172ef",
        "sha256": "2a96e83125ce88e884165ef6672d9d175b6e8e092c41a078a6a256776b959b4b",
        "bytes": 4529
      }
    },
    "tools/enterprise-native-ux.js": {
      "current": {
        "mode": "100644",
        "blob": "6ca43f3bb5a7bb29502d679c29c889cbc4ee97e6",
        "sha256": "ff288ada71159928285072e8814b1cc92e8f4e035f1a386b546d8159eea1d36f",
        "bytes": 18432
      },
      "baseline": {
        "mode": "100644",
        "blob": "cfc8df57c2f6afe1dde3b02a5ec63191baea469a",
        "sha256": "ac538474d4fa502d69f5abd3a202deef1ae13b7f435082deda514b7f0fd5cd49",
        "bytes": 15631
      }
    },
    "tools/ux-release-phase2-native-catalog.js": {
      "current": {
        "mode": "100644",
        "blob": "14beaa6ac20acf452d911791b9cc45552e4fadf5",
        "sha256": "ebfc9dc7e4f990415a8f9795e151d9c8234f7deac3559c8df961c1f1b44b4c5e",
        "bytes": 30199
      },
      "baseline": {
        "mode": "100644",
        "blob": "d600b17bdcc244abc64312194a85ce29d7bfda2b",
        "sha256": "bfc7ce695934b6d14fb2d414b9f7ce237d9b54fcb62bbea860fd2b98b6821d3a",
        "bytes": 25482
      }
    }
  },
  "noirSource": "42d9df7628a30653ff7c8bac203b7bd317dee597",
  "noirFiles": {
    "package.json": {
      "current": {
        "mode": "100644",
        "blob": "d88a33d6eaa1e4b9e6adc3490ecb0c9e1bd96afc",
        "sha256": "82107889e119e262579663e239f09b4abbe1c068ff63c582764ddcb2e5ce32fa",
        "bytes": 60022
      },
      "baseline": {
        "mode": "100644",
        "blob": "d374512314ba44dd523014b50debfadfd314c87e",
        "sha256": "581ce4e8744d266c01f083863adcd1f0c5849b7fb32ce40628da707124e0059c",
        "bytes": 59982
      },
      "inverses": [
        {
          "at": 14725,
          "current": "inventory-bond-checkout.js && node test/",
          "baseline": ""
        }
      ]
    },
    "public/index.html": {
      "current": {
        "mode": "100644",
        "blob": "d356290eff68f6ac8521ed0d63c257712b3cb214",
        "sha256": "9c520c523d8d79be1a3608f49580a62112e0b7adb695a5e2876b8fb144538468",
        "bytes": 1400474
      },
      "baseline": {
        "mode": "100644",
        "blob": "36d900d027a7ffbfe598036adb1b2635a32fe1ea",
        "sha256": "13c2cc9b99b9fbde817718741e05e3a1f2f8615107ce1de98d1c7fdd4c04fb28",
        "bytes": 1402998
      },
      "inverses": [
        {
          "at": 447501,
          "current": "intent?.minimumOmr && body.noteId)\n      bits.push(`Pay ${body.intent.principalEth} ETH for at least ${body.intent.minimumOmr} OMR base units, vesting over ${minsTxt(body.vestingSeconds)}. Review the wallet transaction in Portfolio before the quote expires.",
          "baseline": "bond === 'quote')\n      bits.push(`\\u{1F4DD} quote signed — ${fmt(body.payoutOmr)} $OMR at ${body.discountBps / 100}% off the market price, vesting over ${\n        minsTxt(body.vestSeconds)} · submit bond(quote, signature) with your wallet within ${untilTxt(body.deadline)} or it lapses"
        },
        {
          "at": 459094,
          "current": "recorded a treasury allocation of ${body.eth} ETH",
          "baseline": "claimed ${body.eth} ETH into the vault"
        },
        {
          "at": 548334,
          "current": "async function inventoryBondWallet(",
          "baseline": "// submit a signed bond quote on-chain with the connected wallet. The server ABI-encodes bond(quote, sig)\n  // (viem — the zero-dep client never hand-rolls ABI); the wallet switches to the right chain, shows the tx\n  // (to / value / data), and the player approves. Mainnet-dormant until the bond chain is configured.\n  async function submitBondOnChain(nonce"
        },
        {
          "at": 548435,
          "current": "throw Error('A wallet is required.');\n    await provider.request({method:'eth_requestAccounts'});\n    await switchCharacterChain(provider, '0x1237');\n    return provider;\n  }\n\n  function bondOmr(units) {\n    const whole = units / 10n**18n, fraction = (units % 10n**18n).toString().padStart(18,'0').replace(/0+$/, '');\n    return String(whole) + (fraction ? '.'+fraction : '');",
          "baseline": "return; // picker closed — it already showed what is available / how to get one\n    try {\n      const cd = await api('POST', '/v1/bond/calldata', { nonce });\n      if (cd.code !== 200) { toast(describe(cd.body, cd.code), true); return; }\n      if (cd.body.deadline && cd.body.deadline * 1000 < Date.now()) { toast('that quote expired — request a fresh one', true); return; }\n      const [from] = await provider.request({ method: 'eth_requestAccounts' });\n      connectedProvider = provider;\n      try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: cd.body.chainIdHex }] }); }\n      catch (sw) { if (sw?.code !== 4902) throw sw; toast('add the OMERTÀ chain to your wallet first', true); return; }\n      const txHash = await provider.request({ method: 'eth_sendTransaction',\n        params: [{ from, to: cd.body.to, value: cd.body.value, data: cd.body.data }] });\n      toast('bond submitted on-chain — tx ' + String(txHash).slice(0, 12) + '…');\n    } catch (e) { toast(e?.message ? 'bond: ' + e.message : 'bond submit cancelled', true); }"
        },
        {
          "at": 687099,
          "current": "reasury allocations",
          "baseline": "he backed Vault"
        },
        {
          "at": 687470,
          "current": "Free players can compete on the boards. Each item lists its price and benefit",
          "baseline": "A skilled free player still tops every board; spending here funds the prize pool"
        },
        {
          "at": 832796,
          "current": "iControl && deed && c.canCollect === false)\n        parts.push(`<div class=\"d\">Your character can start earning corner income at level ${c.cornerMinLvl}",
          "baseline": "collectable > 0 && c.canCollect === false)\n        parts.push(`<div class=\"t\">The take is building — $${(c.collectable).toLocaleString()} banked. Working a corner takes level ${c.cornerMinLvl}; the street stays yours until then"
        },
        {
          "at": 833185,
          "current": " && !deed.onChain && c.canCollect !== false",
          "baseline": ""
        },
        {
          "at": 843635,
          "current": "level 25 on your current character, however you acquired the property",
          "baseline": "Level 25 for either public allocation"
        },
        {
          "at": 1041694,
          "current": "'1'",
          "baseline": "1"
        },
        {
          "at": 1106599,
          "current": "\n        <div style=\"margin-top:6px\">Use in-game $OMR for items showing a PLEX price. The ETH checkout requires activation",
          "baseline": " Spending funds token buybacks and backed prize pools.\n        <div style=\"margin-top:6px\">Pay in ETH or with in-game $OMR through PLEX for the same goods"
        },
        {
          "at": 1110231,
          "current": "ETH package fees through the payment router: developer ${S.split.founder / 100}% · Vig prize funding ${S.split.buyback / 100}% · treasury ${S.split.rwa / 100}% · community ${S.split.community / 100}%. PLEX spends game $OMR",
          "baseline": "Revenue split — founder ${S.split.founder / 100}% · token buyback ${S.split.buyback / 100}% · treasury ${S.split.rwa / 100}%"
        },
        {
          "at": 1229632,
          "current": "",
          "baseline": "bd.genesis || "
        },
        {
          "at": 1231872,
          "current": "ChecksAvailable = bd.purchase?.verificationAvailable === true",
          "baseline": "Daily = bd.daily || null;\n    const bondUnlimited = bondDaily?.unlimited === true;\n    const bondUnlimitedReady = bd.liquidity?.bondReady === true && bd.genesis?.bondQuotesOpen === true && !!bd.quote;\n    const bondOffered = Number(bondDaily?.offeredOmr || 0);\n    const bondRemaining = Number(bondDaily?.remainingOmr || 0);\n    const bondTranche = Number(bd.reserve?.remainingOmr || 0);\n    const bondCapacityKnown = bd.reserve?.remainingOmr != null && Number.isFinite(bondTranche);\n    const bondBuyable = bondUnlimited ? (bondUnlimitedReady && bondCapacityKnown ? Math.max(0, bondTranche) : 0)\n      : Math.max(0, Math.min(bondRemaining, bondTranche));\n    const bondFilledPct = bondOffered > 0 ? Math.max(0, Math.min(100, ((bondOffered - bondRemaining) / bondOffered) * 100)) : 0"
        },
        {
          "at": 1238578,
          "current": "Inventory bonds</span>\n            <span class=\"capital-market__body\">Funded OMR vests over the bond contract’s published term. Check the current quote before sending ETH.</span>\n            <span class=\"capital-market__value ${bondChecksAvailable ? '' : 'is-closed'}\">${bondChecksAvailable ? 'verify terms' : 'purchases unavailable",
          "baseline": "Bond account records</span>\n            <span class=\"capital-market__body\">${bondUnlimited ? `No daily account quota · ${bondCapacityKnown ? `${fmt(Math.max(0, bondTranche))} $OMR of reported quote capacity` : 'quote capacity is not reported'}` : bondDaily ? `${fmt(bondBuyable)} $OMR of reported quote capacity within today’s account limit` : 'No account bond offering has been posted.'}</span>\n            <span class=\"capital-market__value ${bondBuyable > 0 ? 'is-live' : 'is-closed'}\">${bondUnlimited ? (bondBuyable > 0 ? 'open' : 'quotes unavailable') : bondDaily ? `${Math.round(bondFilledPct)}% filled` : 'closed"
        },
        {
          "at": 1239291,
          "current": "accounting?.oracle ? 'is-live' : 'is-closed'}\">${bd.accounting?.oracle ? `${fmt(bd.accounting?",
          "baseline": "oracle ? 'is-live' : 'is-closed'}\">${bd.oracle ? `${fmt(bd"
        },
        {
          "at": 1239827,
          "current": "accounting?.reserve?.polEth || 0)} ETH · RWA ${fmt(bd.accounting?",
          "baseline": "reserve?.polEth || 0)} ETH · RWA ${fmt(bd"
        },
        {
          "at": 1243976,
          "current": "ransfers, loot, and funded distributions can move existing $OMR between accounts",
          "baseline": "he rest of the city's $OMR comes from purchases made with real money"
        },
        {
          "at": 1264507,
          "current": "Inventory bonds</h2>\n      <div class=\"card\"><span class=\"t\">Buy a vested OMR note</span>\n        <div class=\"d\">When open, the market bond reserves existing OMR for your wallet. It vests linearly. Your quote shows the ETH payment, minimum OMR, vesting term and expiry. Network gas applies.</div>\n        ${bondChecksAvailable ? `<div style=\"margin-top:6px\"><input id=\"bond-eth\" inputmode=\"decimal\" maxlength=\"60\" aria-label=\"ETH to pay\" placeholder=\"ETH\" size=\"8\"> <button class=\"act\" id=\"bond-quote\">Check purchase terms</button>\n          <button class=\"act\" id=\"bond-submit\" hidden>Review purchase in wallet</button>\n          <pre id=\"bond-quote-out\" style=\"white-space:pre-wrap;overflow-wrap:anywhere\" aria-live=\"polite\"></pre></div>` : '<p class=\"d\">New purchases are awaiting verified deployment, activation and funding.</p>'}",
          "baseline": "Bond account quotes <span class=\"d\" style=\"font-size:11px\">(reported account terms — verify the settlement contract, funded inventory and current market availability before paying)</span></h2>\n      ${(() => {\n        const dl = bd.daily, off = bd.offering || {};\n        const unlimited = dl?.unlimited === true;\n        // Unlimited daily policy does not imply readiness or available quote capacity.\n        const tranche = Number(bd.reserve?.remainingOmr || 0);\n        const capacityKnown = bd.reserve?.remainingOmr != null && Number.isFinite(tranche);\n        const posted = dl ? Number(dl.remainingOmr || 0) : 0;\n        const left = unlimited ? (capacityKnown ? Math.max(0, tranche) : 0) : Math.min(posted, tranche);\n        const ready = !unlimited || (bd.liquidity?.bondReady === true && bd.genesis?.bondQuotesOpen === true && !!bd.quote);\n        const open = !!dl && left > 0 && ready;\n        const pct = dl && Number(dl.offeredOmr) > 0 ? Math.round((posted / Number(dl.offeredOmr)) * 100) : 0;\n        return `\n      <div class=\"card\" style=\"border-color:${open ? 'var(--neon)' : 'rgba(255,255,255,.12)'}\">\n        <span class=\"t\" style=\"color:${open ? 'var(--neon)' : 'var(--dim)'}\">${unlimited ? 'No daily purchase limit' : open ? \"TODAY'S WINDOW — OPEN\" : 'THE WINDOW IS SHUT TODAY'}</span>\n        ${unlimited ? `<div class=\"d\">${capacityKnown ? `<b>${fmt(left)}</b> $OMR available for new quotes.` : 'Available supply is not reported.'}</div>\n          ${Number(bd.reserve?.reservedQuotesOmr) > 0 ? `<div class=\"d\">${fmt(bd.reserve.reservedQuotesOmr)} $OMR is reserved for outstanding signed quotes.</div>` : ''}\n          <div class=\"d\" style=\"font-size:11.5px;color:var(--dim);margin-top:4px\">${open ? 'Choose your purchase amount. The quote checks the available supply and current price.' : !ready ? 'New bond purchases are temporarily unavailable while the desk is paused or waiting for launch, liquidity and a current price.' : !capacityKnown ? 'Purchases are unavailable until the available supply is confirmed.' : 'There is no available supply for a new quote. Purchases resume when supply becomes available.'}</div>`\n        : open ? `<div class=\"d\"><b>${fmt(left)}</b> $OMR still on offer${posted > left ? ` <span class=\"chip cold\">the tranche behind the desk is the tighter of the two</span>` : ` of ${fmt(dl.offeredOmr)} posted`}</div>\n          <div class=\"bar\" style=\"margin-top:4px\"><i style=\"width:${pct}%\"></i></div>\n          <div class=\"d\" style=\"font-size:11.5px;color:var(--dim);margin-top:4px\">When it's gone it's gone until the house posts the next one. There is no queue and no reservation.</div>`\n        : (dl\n          ? `<div class=\"d\">An account offering was posted for today, but its quote budget has no remaining capacity. No new quote is available.</div>`\n          : `<div class=\"d\">No offering was posted. The house opens the window day by day and it is shut until it does — nothing is bought or sold here today.</div>`)}\n      </div>\n      <div class=\"card\">\n        <span class=\"t\">The Terms</span>\n        <table>\n          <tr><th>what you pay</th><td>ETH, on-chain, minimum ${off.minEth ?? '—'}</td></tr>\n          <tr><th>what you get</th><td>$OMR at <b>${off.discountBps != null ? (off.discountBps / 100) + '%' : '—'}</b> below the market price${bd.quote ? ` — about <b>${fmt(bd.quote.payoutOmr)}</b> per ETH right now` : ''}</td></tr>\n          <tr><th>when</th><td>released steadily over <b>${off.vestHours ?? '—'}h</b>, not all at once</td></tr>\n          <tr><th>settlement terms</th><td>verify the exact contract and recipient before paying. Canonical-market inventory bonds reserve already funded OMR and route proceeds to the configured War Chest.</td></tr>\n        </table>\n        <div class=\"d\" style=\"font-size:11.5px;color:var(--dim);margin-top:4px\">${unlimited ? `${bd.quote ? '' : 'A quote is unavailable while the desk is closed. '}${capacityKnown ? `${fmt(left)} $OMR remains available after accounting for outstanding signed quotes.` : 'Available supply is not reported.'}` : `${bd.quote ? '' : 'No market price has printed yet, so no quote can be signed. '}${tranche > 0\n          ? `The account service reports ${fmt(tranche)} $OMR of remaining quote capacity. This figure alone does not prove on-chain inventory or purchase availability.`\n          : 'The account quote budget has no remaining capacity.'}`}</div>"
        },
        {
          "at": 1265404,
          "current": "Inventory bond receipts</span>\n        <p class=\"d\">Find your note ID in the Purchased event of your confirmed wallet transaction. On Robinhood Chain, read claimable(bytes32) on the contract that emitted the event. Send claim(bytes32) with that note ID and zero ETH to collect vested OMR. The recorded beneficiary receives the tokens.</p>\n        ${bd.purchase?.deployment && me.wallet ? `<div class=\"d\">Bond contract: ${esc(bd.purchase.deployment.address)}</div>\n          <label>Receipt ID <input id=\"bond-note-id\" size=\"24\" list=\"bond-saved\" placeholder=\"0x…\" maxlength=\"66\"></label><datalist id=\"bond-saved\"></datalist>\n          <button class=\"act\" id=\"bond-note-read\">Check receipt</button><button class=\"act\" id=\"bond-note-claim\" hidden>Claim vested OMR in wallet</button>\n          <pre id=\"bond-note-out\" aria-live=\"polite\" style=\"white-space:pre-wrap;overflow-wrap:anywhere\"></pre>` : ''}",
          "baseline": "Take the Deal</span>\n        <div class=\"d\">This form reads the account quote service. Check its contract and terms before authorizing ETH; a returned quote does not establish canonical-market activation. Canonical-market inventory bonds use prefunded inventory, bounded purchases and linear vesting.</div>\n        <div style=\"margin-top:6px\"><input id=\"bond-eth\" placeholder=\"ETH\" size=\"6\"> <button class=\"act\" id=\"bond-quote\"${open ? '' : ' disabled'}>${open ? 'request a signed quote' : unlimited ? 'quotes unavailable' : 'the window is shut'}</button>\n          <button class=\"act\" id=\"bond-submit\" style=\"display:none;border-color:var(--neon)\">submit on-chain with wallet</button>\n          <div class=\"d\" style=\"font-size:11px;color:var(--dim)\">${me.wallet ? '' : '<b>Link your wallet above first</b> — a quote is bound to a proven address. '}${unlimited ? (open ? 'The desk is ready for on-chain purchases.' : 'New on-chain purchases are currently unavailable.') : 'The on-chain desk is <b>dormant until launch</b>.'}</div>\n          <pre id=\"bond-quote-out\" style=\"display:none;white-space:pre-wrap;font-size:11px;background:#111;padding:6px;border-radius:4px;margin-top:4px;overflow-x:auto\"></pre></div>"
        },
        {
          "at": 1266370,
          "current": "historical bond records</span>\n        <div class=\"d\">For an older on-chain purchase, find the numeric bondId in its Bonded event. Use the original contract’s claim(uint256) from the owner wallet. The claim button below updates your game record.</div",
          "baseline": "Bonds</span"
        },
        {
          "at": 1267571,
          "current": "",
          "baseline": "`; })()}"
        },
        {
          "at": 1269379,
          "current": "reasury Allocation <span class=\"d\" style=\"font-size:11px\">(spend game $OMR to record an allocation denominated in ETH",
          "baseline": "he Vault <span class=\"d\" style=\"font-size:11px\">(spend game $OMR to record a bounded internal ETH allocation; no blockchain token burn, ETH payout or redemption is implemented"
        },
        {
          "at": 1269558,
          "current": "This records an allocation on your account. No ETH is sent to your wallet. Minimum spend: ${vault.claimMin ?? 150} $OMR. Rolling daily limit: ${fmt(vault.claimDailyOmr ?? 12000)} $OMR per account.</div>\n        ${vault.open ? `\n        <div class=\"d\" style=\"margin-top:6px\"><b>${vault.availableEth} ETH</b> available to allocate from ${vault.heldEth} ETH in recorded revenue · ${fmt(vault.omrPerEth)} $OMR per ETH\n          <input id=\"vault-amt\" placeholder=\"$OMR\" size=\"7\"> <button class=\"act\" id=\"vault-claim\"${groundOff('The vault')}>record allocation",
          "baseline": "the house never owes ETH it doesn't hold · claims ${vault.claimMin ?? 150}–${fmt(vault.claimDailyOmr ?? 12000)} $OMR/day per house · big moves draw the Bureau's eye</div>\n        ${vault.availableEth > 0 ? `\n        <div class=\"d\" style=\"margin-top:6px\"><b>${vault.availableEth} ETH</b> unclaimed of ${vault.heldEth} held · ${fmt(vault.omrPerEth)} $OMR per ETH\n          <input id=\"vault-amt\" placeholder=\"$OMR\" size=\"7\"> <button class=\"act\" id=\"vault-claim\"${groundOff('The vault')}>claim"
        },
        {
          "at": 1270420,
          "current": "`<div class=\"d\" style=\"color:var(--dim)\">${vaultR.code !== 200 ? 'The allocation ledger is unavailable.' : vault.priceStale ? 'A current $OMR price is required before an allocation can be recorded.' : 'No recorded revenue is available for an allocation.'}</div>`}\n        ${vault.mine?.eth > 0 ? `<div class=\"d\" style=\"margin-top:6px\">Your recorded allocation: <b>${vault.mine.eth} ETH</b> (${fmt(vault.mine.costOmr)} game $OMR spent).</div>` : ''}\n        ${vault.funding ? `<div class=\"d\" style=\"font-size:11px;margin-top:6px\">Recorded revenue by source ·",
          "baseline": "'<div class=\"d\" style=\"color:var(--dim)\">the vault is fully claimed — the next revenue refills it (the ETH streams are accumulating)</div>'}\n        ${vault.mine?.eth > 0 ? `<div class=\"d\" style=\"margin-top:6px\">your vault: <b>${vault.mine.eth} ETH</b> (${fmt(vault.mine.costOmr)} $OMR burned) <span class=\"chip good\">BACKED</span></div>` : ''}\n        ${vault.funding ? `<div class=\"d\" style=\"font-size:11px;margin-top:6px\">WHAT'S BEHIND IT —"
        },
        {
          "at": 1276182,
          "current": "\n      const input = $('#bond-eth'), out = $('#bond-quote-out'), buy = $('#bond-submit');\n      let quote = null;\n      input.oninput = () => { quote = null; out.textContent = ''; buy.hidden = true; }",
          "baseline": " let lastNonce = null"
        },
        {
          "at": 1276425,
          "current": "quote = null; buy.hidden = true; bq.disabled = true;\n        try {\n          const principalEth = input.value.trim();\n          const reply = await api('POST','/v1/bond/quote',{principalEth});\n          if (reply.code !== 200) throw Error(describe(reply.body,reply.code) || 'Quote unavailable.');\n          const intent = reply.body.intent;\n          const client = await import('/inventory-bond-client.js');\n          if (input.value.trim() !== principalEth) return;\n          client.validateBondQuote(reply.body,bd.purchase.deployment,me.wallet,principalEth);\n          const minDisplay = bondOmr(BigInt(intent.minimumOmr));\n          out.textContent = 'Pay '+principalEth+' ETH for at least '+minDisplay+' OMR. Vesting: '+reply.body.vestingSeconds+' seconds.'\n            +'\\nExpires: '+new Date(intent.deadline*1000).toLocaleTimeString()+'\\nBond: '+intent.to+'\\nYour wallet: '+intent.buyer+'\\nNote ID: '+reply.body.noteId;\n          quote = reply.body; buy.hidden = false;\n        } catch(error) {out.textContent=error?.message || 'Quote unavailable.';}\n        finally { bq.disabled = false; }\n      };\n      buy.onclick = async () => {\n        if (!quote || buy.disabled) return;\n        buy.disabled = true; bq.disabled = true; input.disabled = true;\n        try {\n          const provider = await inventoryBondWallet();\n          const reply = await api('POST','/v1/bond/calldata',quote.intent);\n          if (reply.code !== 200) throw Error(describe(reply.body,reply.code) || 'Request a fresh quote.');\n          const client = await import('/inventory-bond-client.js');\n          const hash = await client.submitPurchase(provider,bd.purchase.deployment,quote,reply.body,me.wallet,localStorage);\n          out.textContent += '\\nSubmitted: '+hash+'. Check the receipt after confirmation.';\n          $('#bond-note-id').value = quote.noteId;\n        } catch (error) { out.textContent += '\\n'+(error?.message || 'Purchase unavailable.'); }\n        finally { quote=null; buy.hidden=true; buy.disabled=false; bq.disabled=false; input.disabled=false; }\n      };\n    } }\n    { const input = $('#bond-note-id'); if (input) {\n      const read = $('#bond-note-read'), claim = $('#bond-note-claim'), out = $('#bond-note-out'), pin = bd.purchase.deployment;\n      const client = await import('/inventory-bond-client.js');\n      try {\n        const ids = client.savedBondIds(localStorage,pin,me.wallet);\n        $('#bond-saved').replaceChildren(...ids.map(id => new Option(id,id)));\n        input.value = ids.at(-1) || '';\n      } catch { out.textContent = 'Paste the note ID from your wallet receipt.'; }\n      input.oninput = () => { claim.hidden = true; out.textContent = ''; };\n      const handle = async sending => {\n        read.disabled = claim.disabled = input.disabled = true; claim.hidden = true;\n        try {\n          const id = input.value.trim(), provider = await inventoryBondWallet();\n          if (sending) out.textContent = 'Claim submitted: '+await client.submitClaim(provider,pin,me.wallet,id)+'. Check the receipt after confirmation.';\n          else {\n            const note = await client.readBondNote(provider,pin,me.wallet,id);\n            out.textContent = 'Amount: '+bondOmr(note.amount)+' OMR. Claimed: '+bondOmr(note.claimed)+' OMR. Available: '\n              +bondOmr(note.claimable)+' OMR. Fully vested: '+new Date(note.end*1000).toLocaleString()+'.';\n            claim.hidden = !note.claimable;\n          }\n        } catch(error) { out.textContent = error?.message || 'Unable to verify this receipt.'; }\n        finally { read.disabled = claim.disabled = input.disabled = false",
          "baseline": "const r = await api('POST', '/v1/bond/quote', { principalEth: Number($('#bond-eth').value) });\n        const out = $('#bond-quote-out'); const bs = $('#bond-submit');\n        if (r.code === 200) { lastNonce = r.body.nonce; out.style.display = 'block'; if (bs) bs.style.display = 'inline-block';\n          out.textContent = `${fmt(r.body.payoutOmr)} $OMR at ${r.body.discountBps / 100}% off · nonce ${r.body.nonce}\\nsubmit bond(quote, signature) on-chain (or use the button):\\n` + JSON.stringify({ quote: r.body.quote, signature: r.body.signature }, null, 2);\n          toast('quote signed — submit it with your wallet'); }\n        else { out.style.display = 'none'; if (bs) bs.style.display = 'none'; toast(describe(r.body) || 'quote failed')"
        },
        {
          "at": 1280050,
          "current": "read.onclick = () => handle(false); claim.onclick = () => handle(true)",
          "baseline": "const bs = $('#bond-submit'); if (bs) bs.onclick = () => { if (lastNonce != null) submitBondOnChain(lastNonce); else toast('request a quote first', true); }"
        }
      ]
    },
    "test/ux-community-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "4985b962d60f67d3fbbf59cd58fe914a82f4e366",
        "sha256": "968afcda607bb725fd520b16993a87fcfcfe1e4e61e57346dcdcd0afc7b0e9b3",
        "bytes": 27965
      },
      "baseline": {
        "mode": "100644",
        "blob": "1a427c92e286f4785a3e1950dc1877d025cc34b6",
        "sha256": "53c0e15a42e774d78e678248a1708b30525699782ae8ec2232a3a2130b568e92",
        "bytes": 27685
      },
      "inverses": [
        {
          "at": 16923,
          "current": "const acceptedAvatars = verified.participants.filter((p) => p.status === 'accepted' && p.characterId)\n  .map((p) => `/v1/avatar/${encodeURIComponent(p.characterId)}`).sort();\n assert.equal(acceptedAvatars.length, 2, 'the actual crew read verifies both explicit current consents');\n const renderedAvatars = await bossPage.waitForFunction(({ id, count }) => {\n  const portrait = document.querySelector(`[data-community-download=\"${id}\"]:enabled`)?.closest('.ux-community-portrait');\n  const images = portrait?.querySelectorAll('img');\n  return images?.length === count && Array.from(images, (img) => img.getAttribute('src')).sort();\n }, { id: portraitId, count: acceptedAvatars.length });\n assert.deepEqual(await renderedAvatars.jsonValue(), acceptedAvatars, 'only the two explicitly accepted avatars appear in the enabled portrait",
          "baseline": "assert.equal(verified.participants.filter((p) => p.status === 'accepted' && p.characterId).length, 2, 'the actual crew read verifies both explicit current consents');\n await bossPortrait.locator('[data-community-download]:enabled').waitFor({ state: 'attached' });\n await bossPage.waitForFunction((id) => document.querySelector(`[data-community-download=\"${id}\"]`)?.closest('.ux-community-portrait')?.querySelectorAll('img').length === 2, portraitId);\n assert.equal(await bossPortrait.locator('img').count(), 2, 'only explicit accepted avatars appear"
        }
      ]
    }
  }
};
