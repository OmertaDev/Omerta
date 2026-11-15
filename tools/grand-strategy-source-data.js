// Exact grand-strategy historical comparison only; no execution or deployment results transferred.
const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const GRAND_STRATEGY_SOURCE = freeze({
  "status": "SEALED",
  "phase": "EXACT_GRAND_STRATEGY_SOURCE_COMPARISON_ONLY",
  "revision": "d720a71606a56e4eec141a8fc91ce0f562ac1017",
  "tree": "c42d26e7a1d0424deaaca28a750f7861cfe5b1a3",
  "predecessor": "7d52e1f08dc9540b182553b70dedfce4fecfac22",
  "predecessorTree": "674744d5f1d1ee448a5473738b2a8ee8657094f8",
  "files": {
    "public/index.html": {
      "current": {
        "mode": "100644",
        "blob": "fe80e058bf517ca60ae0af3dee0d53630e994cd1",
        "sha256": "08c3ccd59f719b11f9609c463a9bb979a1c0678ec1ab3b63fc121e6a8c00d662",
        "bytes": 1401349
      },
      "baseline": {
        "mode": "100644",
        "blob": "f98d4d5ea621922af28ba4de0c39e8383d460a3a",
        "sha256": "376b65ecc98f7daaec1aa1117cba9c01990fe280e39f09c89d2283d8ba143c78",
        "bytes": 1401180
      },
      "inverses": [
        {
          "at": 106103,
          "current": "<link rel=\"stylesheet\" href=\"/ux-coordination.css?v=20261024-2\">\n<link rel=\"stylesheet\" href=\"/noir-ui.css?v=20261112-copy-trim\">\n<link rel=\"stylesheet\" href=\"/noir-landing.css?v=20261108-1\">\n<link rel=\"stylesheet\" href=\"/strategy-command.css?v=20261115-1\">\n<link rel=\"stylesheet\" href=\"/strategy-atmosphere.css?v=20261115-1\">\n</head>\n<body>\n<svg style=\"display:none\" aria-hidden=\"true\"><defs>\n",
          "baseline": "<link rel=\"stylesheet\" href=\"/ux-coordination.css?v=20261024-2\">\n<link rel=\"stylesheet\" href=\"/noir-ui.css?v=20261112-copy-trim\">\n<link rel=\"stylesheet\" href=\"/noir-landing.css?v=20261108-1\">\n<link rel=\"stylesheet\" href=\"/strategy-command.css?v=20261108-1\">\n</head>\n<body>\n<svg style=\"display:none\" aria-hidden=\"true\"><defs>\n"
        },
        {
          "at": 157002,
          "current": "<script src=\"/ux-investigation.js?v=20261024-2\"></script>\n<script src=\"/ux-coordination.js?v=20261024-2\"></script>\n<script src=\"/noir-shell.js?v=20261112-copy-trim\"></script>\n<script src=\"/strategy-command.js?v=20261115-1\"></script>\n<script src=\"/strategy-atmosphere.js?v=20261115-1\"></script>\n<script>\n(() => {\n  // Optional guidance must not stop core play if its separate script cannot load.\n",
          "baseline": "<script src=\"/ux-investigation.js?v=20261024-2\"></script>\n<script src=\"/ux-coordination.js?v=20261024-2\"></script>\n<script src=\"/noir-shell.js?v=20261112-copy-trim\"></script>\n<script src=\"/strategy-command.js?v=20261108-1\"></script>\n<script>\n(() => {\n  // Optional guidance must not stop core play if its separate script cannot load.\n"
        },
        {
          "at": 1384845,
          "current": "  if (workspaceUX) uxModules.push(workspaceUX);\n  for (const factory of [window.createOmertaFeedback, window.createOmertaProgression, window.createOmertaSocial, window.createOmertaNavigation,\n    window.createOmertaInvestigation, window.createOmertaCoordination,\n    window.createOmertaFeel, window.createOmertaTools, window.createOmertaIdentity, window.createOmertaStory, window.createOmertaQuests, window.createOmertaCommunity, window.createOmertaWorld, window.createOmertaNoirShell, window.createOmertaStrategyCommand, window.createOmertaStrategyAtmosphere]) {\n    if (!factory) continue;\n    try { const module = factory(uxContext); uxModules.push(module); if (factory === window.createOmertaFeedback) feedbackUX = module; }\n    catch (error) { console.warn('UI enhancement unavailable', error); }\n",
          "baseline": "  if (workspaceUX) uxModules.push(workspaceUX);\n  for (const factory of [window.createOmertaFeedback, window.createOmertaProgression, window.createOmertaSocial, window.createOmertaNavigation,\n    window.createOmertaInvestigation, window.createOmertaCoordination,\n    window.createOmertaFeel, window.createOmertaTools, window.createOmertaIdentity, window.createOmertaStory, window.createOmertaQuests, window.createOmertaCommunity, window.createOmertaWorld, window.createOmertaNoirShell, window.createOmertaStrategyCommand]) {\n    if (!factory) continue;\n    try { const module = factory(uxContext); uxModules.push(module); if (factory === window.createOmertaFeedback) feedbackUX = module; }\n    catch (error) { console.warn('UI enhancement unavailable', error); }\n"
        }
      ]
    },
    "public/strategy-command.css": {
      "current": {
        "mode": "100644",
        "blob": "319da4c45b132854240b32ef5eb954c374cdb599",
        "sha256": "5df99cbb495cf7403f2de5032b7becd12c280b7a1b78781478f665942adb1299",
        "bytes": 21451
      },
      "baseline": {
        "mode": "100644",
        "blob": "23eb225a4b5d4da932e7ca2f0bd215589d932bde",
        "sha256": "0bce7f13719a83a6a4a363a7ec16b6af089272ff277664a0543784d94fdeb0d4",
        "bytes": 13723
      },
      "inverses": [
        {
          "at": 922,
          "current": "\n.strategy-command {\n  position: relative; display: grid; grid-template-columns: minmax(0,1fr) 300px;\n  grid-template-rows: 58px 50px minmax(0,1fr) 154px; height: 668px; min-width: 0;\n  --strategy-gold: #c5a66a; --strategy-paper: #eadfc8; --strategy-muted: #aeb9aa;\n  border: 1px solid #bfa16b80; border-radius: 2px; overflow: hidden;\n  background: #121e1a; margin: 0 0 28px; box-shadow: 0 12px 60px #0005, inset 0 0 0 3px #0c1411;\n  font-family: var(--om-font-body);\n}\n.strategy-command::before, .strategy-command::after { content: ''; position: absolute; z-index: 6; pointer-events: none; width: 22px; height: 22px; border-color: #d8ba7d; border-style: solid; }\n.strategy-command::before { top: 4px; left: 4px; border-width: 1px 0 0 1px; }\n.strategy-command::after { bottom: 4px; right: 4px; border-width: 0 1px 1px 0; }\n.strategy-resource-ribbon { grid-column: 1 / -1; grid-row: 1; display: grid; grid-template-columns: repeat(6,minmax(0,1fr)); min-width: 0; margin: 0; background: #111b17; border-bottom: 1px solid #c5a66a55; box-shadow: inset 0 1px #e8ce9630; }\n.strategy-resource { min-width: 0; display: grid; grid-template-columns: 28px minmax(0,1fr); grid-template-rows: auto auto; align-content: center; column-gap: 8px; padding: 9px 14px; border-right: 1px solid #bca06c26; }\n.strategy-resource:last-child { border-right: 0; }\n.strategy-resource-icon { grid-row: 1 / span 2; display: grid; place-items: center; width: 26px; height: 30px; color: #d5b573; font: 22px/1 var(--serif); text-shadow: 0 1px #000; }\n.strategy-command .strategy-resource dt { min-width: 0; color: #a7b29e; font: 9px/1.35 var(--om-font-body); letter-spacing: .09em; text-transform: uppercase; }\n.strategy-command .strategy-resource dd { min-width: 0; margin: 0; line-height: 1.35; }\n.strategy-resource strong { min-width: 0; color: #ede0bd; font: 600 15px/1.35 var(--om-font-body); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }\n.strategy-resource[data-tone=\"caution\"] strong, .strategy-resource[data-tone=\"caution\"] .strategy-resource-icon { color: #e0a282; }\n.strategy-overview { grid-column: 1 / -1; grid-row: 2; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 18px; background: #1c2921; border-bottom: 1px solid #bca06c55; }\n.strategy-overview > div:first-child { display: flex; align-items: baseline; gap: 12px; min-width: 0; }\n.strategy-overview-kicker { margin: 0; color: #c6ab77; font: 9px/1.4 var(--om-font-body); text-transform: uppercase; letter-spacing: .13em; }\n#screen-main #tabbodies .strategy-overview h2 { margin: 0; border: 0; padding: 0; color: #e5d8b6; font: 21px/1.15 var(--serif); letter-spacing: .015em; }\n.strategy-overview-stats { display: flex; align-items: center; gap: 22px; margin: 0; }\n.strategy-overview-item { display: flex; gap: 7px; align-items: baseline; color: #b4bda9; font: 10px/1.4 var(--om-font-body); }\n.strategy-command .strategy-overview-item :is(dt,dd) { margin: 0; }\n.strategy-overview-item strong { color: #daca9e; font-weight: 500; }\n.strategy-map { grid-column: 1; grid-row: 3; position: relative; min-width: 0; min-height: 0; overflow: hidden; isolation: isolate; background: #1a2829 url('/art/citymap.jpg') center / cover; }\n.strategy-map::after { content: ''; position: absolute; z-index: 1; inset: 0; pointer-events: none; box-shadow: inset 0 0 85px #07100d70; }\n.strategy-canvas { position: absolute; inset: 0; z-index: 0; }\n.strategy-canvas canvas { width: 100%; height: 100%; display: block; touch-action: none; }\n.strategy-canvas[data-renderer=\"fallback\"] { background: linear-gradient(0deg,#0c141877,#1c2c2a22), url('/art/citymap.jpg') center / cover; }\n.strategy-canvas[data-renderer=\"loading\"]::after { content: 'Preparing the city…'; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); font: 12px var(--om-font-body); color: #d5c8ac; background: #101817d9; padding: 10px 18px; border: 1px solid #ab8b5055; }\n.strategy-map-toolbar {\n  display: flex; align-items: center; justify-content: space-between; gap: 12px;\n  position: absolute; inset: 0 0 auto; z-index: 4; min-height: 53px; padding: 10px 17px;\n  border-bottom: 1px solid #c4a46c44; background: linear-gradient(180deg,#1c2821fa,#152019ed);\n}\n.strategy-map-title { color: #ddcea8; font: 11px/1.6 var(--om-font-body); letter-spacing: .13em; text-transform: uppercase; }\n.strategy-map-title::before { content: ''; display: inline-block; width: 30px; height: 30px; margin-right: 10px; border-radius: 50%; vertical-align: middle; background: url('/art/grand-strategy/city-seal.webp') center / cover; }\n.strategy-map-title .strategy-map-kicker { display: none; }\n#screen-main #tabbodies .strategy-map-title h2 { display: inline; margin: 0; padding: 0; border: 0; font: 17px/1.4 var(--serif); letter-spacing: .01em; color: #e7d8b5; }\n.strategy-map-modes { display: flex; gap: 2px; padding: 3px; border: 1px solid #b79b6950; border-radius: 1px; background: #0d1713b3; }\n#screen-main .strategy-map-modes button { min-height: 30px; padding: 5px 12px; border: 1px solid transparent; border-radius: 1px; background: transparent; color: #b4bdaa; font: 10px/1.5 var(--om-font-body); letter-spacing: .04em; cursor: pointer; }\n#screen-main .strategy-map-modes button[aria-pressed=\"true\"] { color: #f0dfb6; border-color: #c6a76b80; background: #c5a66a21; box-shadow: inset 0 1px #f7dfaa16; }\n#screen-main .strategy-map-modes button:hover { color: var(--ink); background: #c8aa7820; }\n.strategy-map-guide { position: absolute; z-index: 3; top: 53px; left: 0; right: 0; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 17px; background: linear-gradient(#0e1b14d6,#0e1b1400); pointer-events: none; }\n.strategy-mode-description { margin: 0; color: #d3d3b8; font: 10px/1.4 var(--om-font-body); text-shadow: 0 1px 3px #000; max-width: 59%; }\n.strategy-map-legend { display: flex; flex-wrap: wrap; justify-content: end; gap: 5px 10px; }\n.strategy-map-legend span { display: inline-flex; align-items: center; gap: 5px; color: #d0d4bc; font: 8px/1.4 var(--om-font-body); letter-spacing: .02em; text-shadow: 0 1px 3px #000; }\n.strategy-map-legend span::before { content: ''; width: 5px; height: 5px; background: #a4ab8d; transform: rotate(45deg); }\n.strategy-map-legend [data-state=\"mine\"]::before { background: #e0c281; }\n.strategy-map-legend [data-state=\"occupied\"]::before { background: #bd8b73; }\n.strategy-map-legend [data-state=\"held\"]::before { background: #8fada0; }\n.strategy-map-legend [data-state=\"contested\"]::before { background: #dfae6c; }\n.strategy-district-labels { position: absolute; inset: 0; z-index: 2; pointer-events: none; }\n#screen-main .strategy-district-labels button {\n  pointer-events: auto; position: absolute; transform: translate(-50%,-50%); display: flex; flex-direction: column; align-items: center;\n  gap: 4px; padding: 8px 13px 7px; min-height: 47px; max-width: 29%; border: 1px solid #ad946057; border-radius: 1px;\n  color: #e9dfc2; background: linear-gradient(#14251eee,#0d1b16e8); font: 15px/1.2 var(--serif); letter-spacing: .025em; text-shadow: 0 2px 3px #000a; cursor: pointer;\n  box-shadow: 0 2px 15px #0005, inset 0 1px #d5b77516; transition: border-color 120ms, background 120ms, box-shadow 120ms;\n}\n#screen-main .strategy-district-labels button::before { content: '◆'; position: absolute; left: 50%; top: -7px; transform: translateX(-50%); color: #baa476; font: 10px/1 var(--om-font-body); text-shadow: 0 0 10px #e6c68780; }\n#screen-main .strategy-district-labels button[aria-pressed=\"true\"] { border-color: #e1c88b; background: linear-gradient(#3c4430f5,#263323f5); color: #fff1c7; box-shadow: 0 0 0 2px #141e1c99, 0 0 0 3px #c9ae6455, 0 4px 20px #0008; }\n#screen-main .strategy-district-labels button[aria-pressed=\"true\"]::before { color: #f1d596; }\n#screen-main .strategy-district-labels button[data-state=\"occupied\"] { border-bottom-color: #bd8b738c; }\n#screen-main .strategy-district-labels button[data-state=\"contested\"] { border-bottom-color: #dfae6c; }\n#screen-main .strategy-district-labels button:hover { background: #29332bea; border-color: #c3ad7d99; }\n#screen-main .strategy-district-labels button.ux-feel-pressed { transform: translate(-50%,-50%) scale(.985) !important; }\n.strategy-district-labels button small { font: 9px/1.4 var(--om-font-body); text-transform: uppercase; letter-spacing: .08em; color: #d6ba81; }\n.strategy-map-footer { position: absolute; bottom: 0; left: 0; right: 0; z-index: 3; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 5px 12px; min-height: 32px; padding: 7px 16px; background: #101c15ed; border-top: 1px solid #ae945a55; color: #b4b9a8; font: 9px/1.5 var(--om-font-body); }\n.strategy-map-status { color: #d4bd91; }\n.strategy-map-controls { position: absolute; z-index: 4; right: 12px; bottom: 46px; display: flex; flex-direction: column; border: 1px solid #bca06c80; border-radius: 1px; padding: 3px; background: #14211aed; box-shadow: 0 3px 15px #0005; }\n#screen-main .strategy-map-controls button { width: 34px; min-height: 34px; border: 0; border-radius: 2px; background: transparent; color: #e2cfaa; font: 20px/1 var(--om-font-body); cursor: pointer; }\n#screen-main .strategy-map-controls button:hover { background: #c8aa7825; }\n#screen-main .strategy-map-controls button:disabled { opacity: .4; cursor: default; }\n.strategy-compass { position: absolute; z-index: 2; bottom: 49px; left: 16px; width: 40px; height: 40px; color: #d4bb82; opacity: .65; pointer-events: none; }\n.strategy-compass svg { width: 100%; height: 100%; }\n\n.strategy-inspector { grid-column: 1; grid-row: 4; display: flex; align-items: stretch; min-width: 0; padding: 14px; gap: 16px; background: linear-gradient(120deg,#243127,#16241b); border-top: 1px solid #b99a6480; box-shadow: inset 0 1px #ead19a15; }\n.strategy-district-art { flex: 0 0 124px; width: 124px; min-width: 0; height: 124px; border: 1px solid #b99a6477; border-radius: 1px; object-fit: cover; filter: saturate(.65) sepia(.12); box-shadow: 0 0 0 3px #101c15, 0 0 0 4px #b99a6429; }\n.strategy-inspector-body { min-width: 0; flex: 1; position: relative; padding-right: 180px; }\n.strategy-inspector-kicker { color: #c3aa78; font: 9px/1.4 var(--om-font-body); letter-spacing: .13em; text-transform: uppercase; }\n#screen-main .strategy-inspector h3 { font: 25px/1.1 var(--serif); letter-spacing: -.015em; margin: 4px 0 9px; color: #efe1bf; }\n.strategy-district-facts { display: flex; flex-wrap: wrap; gap: 4px 24px; margin: 0; font-size: 11px; line-height: 1.5; }\n.strategy-district-facts div { min-width: 0; }\n.strategy-district-facts dt { display: inline; color: #adb9a4; margin-right: 7px; }\n.strategy-district-facts dd { display: inline; margin: 0; color: #e1d6bc; }\n.strategy-district-facts div:last-child { flex-basis: 100%; }\n.strategy-district-actions { position: absolute; right: 0; top: 0; bottom: 0; width: 166px; display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); align-content: center; gap: 5px; }\n#screen-main .strategy-district-actions button { min-height: 40px; min-width: 0; border: 1px solid #aa935f55; border-radius: 1px; padding: 6px 7px; background: #c8aa780b; color: #dbcfb2; font: 10px/1.4 var(--om-font-body); text-align: left; cursor: pointer; }\n#screen-main .strategy-district-actions button:hover { background: #c8aa7825; border-color: #c8aa78; }\n\n.strategy-orders { grid-column: 2; grid-row: 3 / span 2; padding: 20px; min-width: 0; overflow-y: auto; border-left: 1px solid #ba9e6977; background: linear-gradient(100deg,#202e23,#16231a); scrollbar-width: thin; scrollbar-color: #a68d5b55 transparent; }\n.strategy-orders::before { content: 'YOUR OPERATIONS'; display: block; font: 9px/1.5 var(--om-font-body); letter-spacing: .18em; color: #c4aa77; margin-bottom: 15px; padding-bottom: 11px; border-bottom: 1px solid #aa91534d; }\n#screen-main .strategy-orders .start-first-week { margin: 0; }\n#screen-main .strategy-orders .start-week-heading { margin: 0 0 14px; display: block; }\n#screen-main .strategy-orders .start-eyebrow { display: none; }\n#screen-main .strategy-orders .start-week-heading h2 { font-size: 24px; line-height: 1.2; color: #e9dfc8; margin: 0 0 10px; }\n#screen-main .strategy-orders .start-week-heading .chip { display: inline-block; font-size: 10px; }\n#screen-main .strategy-orders .start-week-progress { margin-bottom: 18px; height: 3px; }\n#screen-main .strategy-orders .start-next-card { border: 0; border-top: 1px solid #b59a6455; border-radius: 0; padding: 15px 0 18px; background: transparent; }\n#screen-main .strategy-orders .start-next-card h3.t { font: 23px/1.25 var(--serif); color: #e9dfc8; margin: 0 0 9px; }\n#screen-main .strategy-orders .start-next-card .d { font: 12px/1.65 var(--om-font-body); color: #b8b9ab; }\n#screen-main .strategy-orders .start-next-card .act { display: block; width: 100%; min-height: 44px; margin-top: 17px; padding: 11px 12px; border-radius: 1px; background: linear-gradient(#d8bd83,#b89a61); border-color: #e2cb94; color: #17221a; font: 600 12px/1.5 var(--om-font-body); box-shadow: inset 0 1px #ffffff35,0 3px 8px #0004; }\n#screen-main .strategy-orders .sect { margin-top: 10px; border-top: 1px solid #a78f5644; }\n#screen-main .strategy-orders .sect > summary { padding: 12px 0; background: transparent; display: block; }\n#screen-main .strategy-orders .sect > summary h2 { font: 14px/1.5 var(--serif); color: #d8c6a1; }\n#screen-main .strategy-orders .sect > summary .d { font-size: 10px; }\n#screen-main .strategy-orders > :is(h3,h2) { font: 24px/1.3 var(--serif); color: #e9dfc8; }\n#screen-main .strategy-orders > p { color: #b8b9ab; font-size: 12px; }\n.strategy-powers { margin-top: 23px; padding-top: 15px; border-top: 1px solid #b49a5d55; }\n#screen-main .strategy-powers h3 { margin: 0 0 11px; color: #d5c49e; font: 17px/1.2 var(--serif); }\n.strategy-power-list { padding: 0; margin: 0; list-style: none; }\n.strategy-power-row { display: grid; grid-template-columns: 18px minmax(0,1fr) auto; align-items: baseline; gap: 7px; padding: 9px 0; border-bottom: 1px solid #b39a5d24; font: 10px/1.45 var(--om-font-body); color: #b3bda9; }\n.strategy-power-row > span:first-child { color: #c4a96e; font-variant-numeric: tabular-nums; }\n.strategy-power-row strong { color: #e1d6b6; font-weight: 500; overflow-wrap: anywhere; }\n.strategy-power-row[data-mine=\"true\"] strong { color: #ecd094; }\n.strategy-power-empty { color: #adb9a4; font: 11px/1.6 var(--om-font-body); }\n#screen-main .strategy-powers button { width: 100%; margin-top: 12px; min-height: 36px; padding: 8px 10px; border: 1px solid #ad945d66; border-radius: 1px; background: #c2a66a0c; color: #d9ca9e; text-align: left; font: 11px/1.4 var(--om-font-body); cursor: pointer; }\n#screen-main .strategy-powers button:hover { background: #c2a66a1e; border-color: #c4a96e; }\n#screen-main .strategy-command :focus-visible { outline: 2px solid #ead29d; outline-offset: 3px; }\n\n@media (min-width: 1700px) {\n  .strategy-command { height: 748px; grid-template-columns: minmax(0,1fr) 320px; }\n  .strategy-inspector { padding: 14px 20px; }\n}\n@media (min-width: 1001px) {\n",
          "baseline": "\n.strategy-command {\n  position: relative; display: grid; grid-template-columns: minmax(0,1fr) 300px;\n  grid-template-rows: minmax(0,1fr) 142px; height: 560px; min-width: 0;\n  border: 1px solid #bfa16b75; border-radius: 3px; overflow: hidden;\n  background: #172022; margin: 0 0 28px; box-shadow: 0 12px 60px #0004, inset 0 0 0 3px #0c1111;\n  font-family: var(--om-font-body);\n}\n.strategy-command::before, .strategy-command::after { content: ''; position: absolute; z-index: 6; pointer-events: none; width: 22px; height: 22px; border-color: #d8ba7d; border-style: solid; }\n.strategy-command::before { top: 4px; left: 4px; border-width: 1px 0 0 1px; }\n.strategy-command::after { bottom: 4px; right: 4px; border-width: 0 1px 1px 0; }\n.strategy-map { grid-column: 1; grid-row: 1; position: relative; min-width: 0; min-height: 0; overflow: hidden; isolation: isolate; background: #1a2829 url('/art/citymap.jpg') center / cover; }\n.strategy-canvas { position: absolute; inset: 0; z-index: 0; }\n.strategy-canvas canvas { width: 100%; height: 100%; display: block; touch-action: none; }\n.strategy-canvas[data-renderer=\"fallback\"] { background: linear-gradient(0deg,#0c141877,#1c2c2a22), url('/art/citymap.jpg') center / cover; }\n.strategy-canvas[data-renderer=\"loading\"]::after { content: 'Preparing the city…'; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); font: 12px var(--om-font-body); color: #d5c8ac; background: #101817d9; padding: 10px 18px; border: 1px solid #ab8b5055; }\n.strategy-map-toolbar {\n  display: flex; align-items: center; justify-content: space-between; gap: 12px;\n  position: absolute; inset: 0 0 auto; z-index: 4; min-height: 52px; padding: 11px 17px;\n  border-bottom: 1px solid #c4a46c44; background: linear-gradient(180deg,#1c2423fa,#151e1ce8);\n}\n.strategy-map-title { color: #ddcea8; font: 11px/1.6 var(--om-font-body); letter-spacing: .13em; text-transform: uppercase; }\n.strategy-map-title::before { content: '◇'; color: #d6b679; margin-right: 10px; }\n.strategy-map-title .strategy-map-kicker { display: none; }\n#screen-main #tabbodies .strategy-map-title h2 { display: inline; margin: 0; padding: 0; border: 0; font: 17px/1.4 var(--serif); letter-spacing: .01em; color: #e7d8b5; }\n.strategy-map-modes { display: flex; gap: 2px; padding: 3px; border: 1px solid #b79b6940; border-radius: 3px; background: #0d161699; }\n#screen-main .strategy-map-modes button { min-height: 30px; padding: 5px 10px; border: 1px solid transparent; border-radius: 2px; background: transparent; color: #aab3a8; font: 11px/1.5 var(--om-font-body); cursor: pointer; }\n#screen-main .strategy-map-modes button[aria-pressed=\"true\"] { color: #e8d3a8; border-color: #bca06c50; background: #bca06c18; }\n#screen-main .strategy-map-modes button:hover { color: var(--ink); background: #c8aa7820; }\n.strategy-district-labels { position: absolute; inset: 0; z-index: 2; pointer-events: none; }\n#screen-main .strategy-district-labels button {\n  pointer-events: auto; position: absolute; transform: translate(-50%,-50%); display: flex; flex-direction: column; align-items: center;\n  gap: 3px; padding: 6px 11px; min-height: 42px; max-width: 30%; border: 1px solid transparent; border-radius: 3px;\n  color: #e4dbbf; background: #101a18b8; font: 14px/1.2 var(--serif); text-shadow: 0 2px 3px #000a; cursor: pointer;\n  box-shadow: 0 2px 12px #0002; transition: border-color 120ms, background 120ms;\n}\n#screen-main .strategy-district-labels button::before { content: '◆'; color: #baa476; font: 9px/1 var(--om-font-body); text-shadow: 0 0 10px #e6c68780; }\n#screen-main .strategy-district-labels button[aria-pressed=\"true\"] { border-color: #d3b479a6; background: #222c24ee; color: #f0dfb5; box-shadow: 0 0 0 2px #141e1c88, 0 3px 14px #0006; }\n#screen-main .strategy-district-labels button:hover { background: #29332bea; border-color: #c3ad7d99; }\n#screen-main .strategy-district-labels button.ux-feel-pressed { transform: translate(-50%,-50%) scale(.985) !important; }\n.strategy-district-labels button small { font: 9px/1.4 var(--om-font-body); text-transform: uppercase; letter-spacing: .08em; color: #d6ba81; }\n.strategy-map-footer { position: absolute; bottom: 0; left: 0; right: 0; z-index: 3; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 5px 12px; min-height: 33px; padding: 7px 16px; background: #101a18e8; border-top: 1px solid #ae945a40; color: #b4b9a8; font: 10px/1.5 var(--om-font-body); }\n.strategy-map-status { color: #d4bd91; }\n.strategy-map-controls { position: absolute; z-index: 4; right: 12px; bottom: 46px; display: flex; flex-direction: column; border: 1px solid #bca06c66; border-radius: 3px; padding: 3px; background: #18221fea; }\n#screen-main .strategy-map-controls button { width: 34px; min-height: 34px; border: 0; border-radius: 2px; background: transparent; color: #e2cfaa; font: 20px/1 var(--om-font-body); cursor: pointer; }\n#screen-main .strategy-map-controls button:hover { background: #c8aa7825; }\n#screen-main .strategy-map-controls button:disabled { opacity: .4; cursor: default; }\n.strategy-compass { position: absolute; z-index: 2; bottom: 49px; left: 16px; width: 40px; height: 40px; color: #d4bb82; opacity: .65; pointer-events: none; }\n.strategy-compass svg { width: 100%; height: 100%; }\n\n.strategy-inspector { grid-column: 1; grid-row: 2; display: flex; align-items: stretch; min-width: 0; padding: 14px; gap: 15px; background: linear-gradient(135deg,#222a27,#171e1d); border-top: 1px solid #b99a644d; }\n.strategy-district-art { flex: 0 0 112px; width: 112px; min-width: 0; height: 112px; border: 1px solid #b99a6455; border-radius: 2px; object-fit: cover; filter: saturate(.65); }\n.strategy-inspector-body { min-width: 0; flex: 1; position: relative; padding-right: 148px; }\n.strategy-inspector-kicker { color: #c3aa78; font: 9px/1.4 var(--om-font-body); letter-spacing: .13em; text-transform: uppercase; }\n#screen-main .strategy-inspector h3 { font: 23px/1.1 var(--serif); letter-spacing: -.03em; margin: 4px 0 9px; color: #e9dfc9; }\n.strategy-district-facts { display: flex; flex-wrap: wrap; gap: 4px 24px; margin: 0; font-size: 11px; line-height: 1.5; }\n.strategy-district-facts div { min-width: 0; }\n.strategy-district-facts dt { display: inline; color: #a3ad9f; margin-right: 7px; }\n.strategy-district-facts dd { display: inline; margin: 0; color: #e1d6bc; }\n.strategy-district-facts div:last-child { flex-basis: 100%; }\n.strategy-district-actions { position: absolute; right: 0; top: 0; bottom: 0; width: 136px; display: flex; flex-direction: column; justify-content: center; gap: 5px; }\n#screen-main .strategy-district-actions button { min-height: 31px; border: 1px solid #aa935f55; border-radius: 2px; padding: 5px 9px; background: #c8aa780b; color: #dbcfb2; font: 11px/1.4 var(--om-font-body); text-align: left; cursor: pointer; }\n#screen-main .strategy-district-actions button:hover { background: #c8aa7825; border-color: #c8aa78; }\n\n.strategy-orders { grid-column: 2; grid-row: 1 / span 2; padding: 22px 20px; min-width: 0; overflow-y: auto; border-left: 1px solid #ba9e6966; background: linear-gradient(100deg,#202623,#181e1c); scrollbar-width: thin; scrollbar-color: #a68d5b55 transparent; }\n.strategy-orders::before { content: 'YOUR OPERATIONS'; display: block; font: 10px/1.5 var(--om-font-body); letter-spacing: .16em; color: #c4aa77; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #aa915341; }\n#screen-main .strategy-orders .start-first-week { margin: 0; }\n#screen-main .strategy-orders .start-week-heading { margin: 0 0 14px; display: block; }\n#screen-main .strategy-orders .start-eyebrow { display: none; }\n#screen-main .strategy-orders .start-week-heading h2 { font-size: 25px; line-height: 1.2; color: #e9dfc8; margin: 0 0 12px; }\n#screen-main .strategy-orders .start-week-heading .chip { display: inline-block; font-size: 10px; }\n#screen-main .strategy-orders .start-week-progress { margin-bottom: 18px; height: 3px; }\n#screen-main .strategy-orders .start-next-card { border: 0; border-top: 1px solid #b59a6455; border-radius: 0; padding: 18px 0 20px; background: transparent; }\n#screen-main .strategy-orders .start-next-card h3.t { font: 24px/1.25 var(--serif); color: #e9dfc8; margin: 0 0 10px; }\n#screen-main .strategy-orders .start-next-card .d { font: 12px/1.65 var(--om-font-body); color: #b8b9ab; }\n#screen-main .strategy-orders .start-next-card .act { display: block; width: 100%; min-height: 44px; margin-top: 20px; padding: 11px 12px; border-radius: 2px; background: linear-gradient(#d0b47f,#b79b67); border-color: #dbc493; color: #1b211d; font: 600 12px/1.5 var(--om-font-body); box-shadow: inset 0 1px #ffffff20,0 2px 4px #0004; }\n#screen-main .strategy-orders .sect { margin-top: 10px; border-top: 1px solid #a78f5644; }\n#screen-main .strategy-orders .sect > summary { padding: 12px 0; background: transparent; display: block; }\n#screen-main .strategy-orders .sect > summary h2 { font: 14px/1.5 var(--serif); color: #d8c6a1; }\n#screen-main .strategy-orders .sect > summary .d { font-size: 10px; }\n#screen-main .strategy-orders > :is(h3,h2) { font: 24px/1.3 var(--serif); color: #e9dfc8; }\n#screen-main .strategy-orders > p { color: #b8b9ab; font-size: 12px; }\n#screen-main .strategy-command :focus-visible { outline: 2px solid #ead29d; outline-offset: 3px; }\n\n@media (min-width: 1700px) {\n  .strategy-command { height: 640px; grid-template-columns: minmax(0,1fr) 320px; }\n  .strategy-inspector { padding: 14px 20px; }\n}\n@media (min-width: 1001px) {\n"
        },
        {
          "at": 16141,
          "current": "  #screen-main #tabpanel:has(#tab-start.on #strategy-command) .noir-screen-kicker { margin: 0; }\n  #screen-main #tabpanel:has(#tab-start.on #strategy-command) .noir-heading-row,\n  #screen-main #tabpanel:has(#tab-start.on #strategy-command) .noir-screen-description { display: none; }\n  .strategy-command { height: calc(100dvh - 214px); min-height: 610px; max-height: 850px; }\n}\n@media (min-width: 1001px) and (max-width: 1300px) {\n  .strategy-command { grid-template-columns: minmax(0,1fr) 250px; grid-template-rows: 56px 48px minmax(0,1fr) 186px; height: calc(100dvh - 214px); min-height: 610px; }\n  .strategy-resource { padding: 8px 9px; column-gap: 5px; grid-template-columns: 22px minmax(0,1fr); }\n  .strategy-resource-icon { width: 22px; font-size: 19px; }\n  .strategy-resource strong { font-size: 13px; }\n  .strategy-overview { padding-inline: 14px; }\n  .strategy-overview-stats { gap: 12px; }\n  .strategy-overview-kicker { display: none; }\n  .strategy-orders { padding: 18px 14px; }\n  .strategy-inspector { padding: 12px; gap: 12px; }\n  .strategy-district-art { width: 78px; flex-basis: 78px; height: 126px; }\n  .strategy-inspector-body { padding-right: 0; }\n  .strategy-district-actions { position: static; display: flex; width: 100%; flex-direction: row; flex-wrap: wrap; justify-content: start; margin-top: 8px; }\n  #screen-main .strategy-district-actions button { flex: 1 1 40%; font-size: 10px; min-height: 29px; }\n  .strategy-map-toolbar { padding: 10px 12px; gap: 7px; }\n  .strategy-map-title { font-size: 10px; }\n  #screen-main .strategy-map-modes button { padding-inline: 8px; }\n  .strategy-map-guide { padding-inline: 12px; }\n  .strategy-map-legend { display: none; }\n  .strategy-mode-description { max-width: 100%; }\n}\n@media (max-width: 1000px) {\n  details.strategy-command { display: block; height: auto; margin: 20px 0; border-color: #8d78564d; background: #181f1d; }\n  details.strategy-command > summary { min-height: 48px; padding: 14px 16px; color: #d0b988; font: 13px/1.5 var(--serif); cursor: pointer; }\n  details.strategy-command:not([open]) > :not(summary) { display: none; }\n  .strategy-resource-ribbon { grid-template-columns: repeat(3,minmax(0,1fr)); }\n  .strategy-resource { min-height: 56px; padding: 8px 10px; gap: 3px 5px; grid-template-columns: 22px minmax(0,1fr); border-bottom: 1px solid #bca06c20; }\n  .strategy-resource-icon { width: 22px; font-size: 19px; }\n  .strategy-command .strategy-resource dt { font-size: 8px; letter-spacing: .04em; }\n  .strategy-resource strong { font-size: 13px; }\n  .strategy-overview { padding: 12px; align-items: start; gap: 8px; }\n  .strategy-overview > div:first-child { display: block; }\n  #screen-main #tabbodies .strategy-overview h2 { font-size: 20px; margin-top: 3px; }\n  .strategy-overview-kicker { font-size: 8px; }\n  .strategy-overview-stats { flex-wrap: wrap; justify-content: end; gap: 4px 9px; max-width: 45%; }\n  .strategy-overview-item { font-size: 9px; gap: 4px; }\n  details.strategy-command[open] .strategy-map { height: 370px; }\n  .strategy-map-toolbar { padding: 10px 12px; }\n  .strategy-map-title { font-size: 9px; letter-spacing: .08em; }\n  .strategy-map-modes { gap: 0; padding: 2px; }\n  #screen-main .strategy-map-modes button { min-height: 36px; padding: 5px 8px; font-size: 10px; }\n  .strategy-map-guide { top: 59px; padding: 7px 12px; }\n  .strategy-mode-description { font-size: 9px; max-width: 100%; }\n  .strategy-map-legend { display: none; }\n  .strategy-map-controls, .strategy-compass { display: none; }\n  .strategy-district-labels { inset: 72px 0 38px; }\n  .strategy-inspector { padding: 16px; gap: 14px; }\n  .strategy-inspector-body { padding-right: 0; }\n  .strategy-district-art { width: 82px; flex-basis: 82px; height: 116px; }\n  .strategy-district-actions { position: static; display: flex; width: 100%; flex-direction: row; flex-wrap: wrap; margin-top: 14px; }\n  #screen-main .strategy-district-actions button { flex: 1 1 110px; min-height: 44px; padding: 9px; }\n  .strategy-district-facts { display: block; }\n  .strategy-district-facts div { margin-top: 5px; }\n  #screen-main .strategy-district-labels button { min-height: 44px; padding: 6px 8px; font-size: 12px; max-width: 32%; }\n  .strategy-district-labels button small { font-size: 8px; letter-spacing: .02em; }\n  .strategy-map-footer { font-size: 9px; padding: 8px 12px; }\n  .strategy-orders { display: none; }\n  #screen-main #tabpanel:has(#tab-start.on #strategy-command) .noir-heading-row h2 { font-size: 34px; }\n",
          "baseline": "  #screen-main #tabpanel:has(#tab-start.on #strategy-command) .noir-screen-kicker { margin: 0; }\n  #screen-main #tabpanel:has(#tab-start.on #strategy-command) .noir-heading-row,\n  #screen-main #tabpanel:has(#tab-start.on #strategy-command) .noir-screen-description { display: none; }\n  .strategy-command { height: calc(100dvh - 214px); min-height: 560px; max-height: 850px; }\n}\n@media (min-width: 1001px) and (max-width: 1300px) {\n  .strategy-command { grid-template-columns: minmax(0,1fr) 260px; grid-template-rows: minmax(0,1fr) 164px; height: 570px; }\n  .strategy-orders { padding: 20px 16px; }\n  .strategy-inspector { padding: 12px; gap: 12px; }\n  .strategy-district-art { width: 66px; flex-basis: 66px; height: 80px; }\n  .strategy-inspector-body { padding-right: 0; }\n  .strategy-district-actions { position: static; width: 100%; flex-direction: row; justify-content: start; margin-top: 8px; }\n  #screen-main .strategy-district-actions button { flex: 1; font-size: 10px; }\n  .strategy-map-toolbar { align-items: start; flex-direction: column; padding: 10px 12px; gap: 7px; }\n  .strategy-map-title { font-size: 10px; }\n}\n@media (max-width: 1000px) {\n  details.strategy-command { display: block; height: auto; margin: 20px 0; border-color: #8d78564d; background: #181f1d; }\n  details.strategy-command > summary { min-height: 48px; padding: 14px 16px; color: #d0b988; font: 13px/1.5 var(--serif); cursor: pointer; }\n  details.strategy-command:not([open]) > :not(summary) { display: none; }\n  details.strategy-command[open] .strategy-map { height: 340px; }\n  .strategy-map-toolbar { padding: 10px 12px; }\n  .strategy-map-title { font-size: 9px; letter-spacing: .08em; }\n  .strategy-map-modes { gap: 0; padding: 2px; }\n  #screen-main .strategy-map-modes button { min-height: 36px; padding: 5px 8px; font-size: 10px; }\n  .strategy-map-controls, .strategy-compass { display: none; }\n  .strategy-inspector { padding: 16px; gap: 14px; }\n  .strategy-inspector-body { padding-right: 0; }\n  .strategy-district-art { width: 82px; flex-basis: 82px; height: 108px; }\n  .strategy-district-actions { position: static; width: 100%; flex-direction: row; flex-wrap: wrap; margin-top: 14px; }\n  #screen-main .strategy-district-actions button { flex: 1 1 110px; min-height: 44px; padding: 9px; }\n  .strategy-district-facts { display: block; }\n  .strategy-district-facts div { margin-top: 5px; }\n  #screen-main .strategy-district-labels button { min-height: 44px; padding: 6px 8px; font-size: 12px; }\n  .strategy-map-footer { font-size: 9px; padding: 8px 12px; }\n  .strategy-orders { display: none; }\n  #screen-main #tabpanel:has(#tab-start.on #strategy-command) .noir-heading-row h2 { font-size: 34px; }\n"
        },
        {
          "at": 20621,
          "current": "@media (max-width: 400px) {\n  .strategy-map-toolbar { display: block; }\n  .strategy-map-modes { width: fit-content; margin-top: 6px; }\n  .strategy-map-guide { top: 91px; }\n  .strategy-district-labels { inset: 104px 0 38px; }\n  .strategy-mode-description { max-width: 100%; }\n  .strategy-overview-stats { display: block; }\n  .strategy-overview-item { display: block; text-align: right; }\n  .strategy-overview-item strong { margin-left: 5px; }\n  .strategy-resource { padding-inline: 8px; }\n  .strategy-inspector { display: block; }\n  .strategy-district-art { float: left; width: 68px; height: 80px; margin: 0 12px 10px 0; }\n  .strategy-district-actions { clear: both; }\n}\n@media (prefers-reduced-motion: reduce) {\n",
          "baseline": "@media (max-width: 400px) {\n  .strategy-map-toolbar { display: block; }\n  .strategy-map-modes { width: fit-content; margin-top: 6px; }\n  .strategy-inspector { display: block; }\n  .strategy-district-art { float: left; width: 68px; height: 68px; margin: 0 12px 10px 0; }\n  .strategy-district-actions { clear: both; }\n}\n@media (prefers-reduced-motion: reduce) {\n"
        }
      ]
    },
    "public/strategy-command.js": {
      "current": {
        "mode": "100644",
        "blob": "5fa70acf1069f5702e3ddd253c46d34794509e09",
        "sha256": "a63f9217e539b6978db803f566db43328fd9da31f0cd25f3bd894e8c6aca5fe5",
        "bytes": 24976
      },
      "baseline": {
        "mode": "100644",
        "blob": "45361252ffe5ff884809979cfc6d98ed921ada6b",
        "sha256": "c78e8e2cd8d5ee8e566efb0b26452624384b8d41c30f21a4354cdb822325c500",
        "bytes": 17672
      },
      "inverses": [
        {
          "at": 99,
          "current": "  'use strict';\n  const points = { foundry: [19, 52], cathedral: [32, 41], neon: [61, 22], brick: [37, 71], canal: [51, 61], docks: [79, 41] };\n  const modes = [['districts', 'Districts'], ['influence', 'Influence'], ['trade', 'Trade']];\n  const descriptions = {\n    districts: 'Read the city. Select a district to inspect its control and local advantage.',\n    influence: 'Follow the balance of power: family control, garrisons, and active contests.',\n    trade: 'Trace the local economy: territory rackets and recorded street deeds.',\n  };\n  const titles = { open: 'Open territory', occupied: 'Occupied', mine: 'Your family', held: 'Family controlled', contested: 'Contested', unknown: 'Current records unavailable' };\n  const text = (node, value) => { const next = String(value ?? ''); if (node && node.textContent !== next) node.textContent = next; };\n  const list = value => Array.isArray(value) ? value : [];\n",
          "baseline": "  'use strict';\n  const points = { foundry: [19, 52], cathedral: [32, 41], neon: [61, 22], brick: [37, 71], canal: [51, 61], docks: [79, 41] };\n  const modes = [['districts', 'Districts'], ['influence', 'Influence'], ['trade', 'Trade']];\n  const titles = { open: 'Open territory', occupied: 'Occupied', mine: 'Your family', held: 'Family controlled', contested: 'Contested', unknown: 'Current records unavailable' };\n  const text = (node, value) => { const next = String(value ?? ''); if (node && node.textContent !== next) node.textContent = next; };\n  const list = value => Array.isArray(value) ? value : [];\n"
        },
        {
          "at": 4733,
          "current": "          if (root.open) { readMap(); paint(); }\n        });\n      }\n      const resources = document.createElement('dl'); resources.className = 'strategy-resource-ribbon'; resources.setAttribute('aria-label', 'Your resources');\n      for (const [id, label, icon, hint] of [\n        ['cash', 'Cash', '$', 'Cash available to your character'], ['omr', '$OMR', '◈', 'Your liquid $OMR balance'],\n        ['respect', 'Respect', '✦', 'Respect earned by your character'], ['energy', 'Energy', 'ϟ', 'Physical work uses energy'],\n        ['nerve', 'Nerve', '◇', 'Street crimes use nerve'], ['heat', 'Heat', '♨', 'The attention you have drawn from the law'],\n      ]) {\n        const item = document.createElement('div'); item.className = 'strategy-resource'; item.dataset.strategyResource = id; item.title = hint;\n        item.innerHTML = '<span class=\"strategy-resource-icon\" aria-hidden=\"true\"></span><dt></dt><dd><strong></strong></dd>';\n        text(item.querySelector('.strategy-resource-icon'), icon); text(item.querySelector('dt'), label); resources.append(item);\n      }\n      const overview = document.createElement('header'); overview.className = 'strategy-overview';\n      overview.innerHTML = '<div class=\"strategy-overview-identity\"><p class=\"strategy-overview-kicker\"></p><h2>The balance of power</h2></div><dl class=\"strategy-overview-stats\"></dl>';\n      for (const [id, label] of [['family', 'Your family'], ['open', 'Open districts'], ['contests', 'Contests']]) {\n        const item = document.createElement('div'); item.className = 'strategy-overview-item'; item.dataset.strategyOverview = id;\n        item.innerHTML = '<dt></dt><dd><strong></strong></dd>'; text(item.querySelector('dt'), label); overview.querySelector('dl').append(item);\n      }\n      const map = document.createElement('section'); map.className = 'strategy-map'; map.setAttribute('aria-label', 'Strategic city view');\n      map.innerHTML = '<header class=\"strategy-map-toolbar\"><div class=\"strategy-map-title\"><span class=\"strategy-map-kicker\">CITY COMMAND</span><h2>The city</h2></div><div class=\"strategy-map-modes\" role=\"group\" aria-label=\"Map view\"></div></header><div class=\"strategy-canvas\" aria-hidden=\"true\"></div><div class=\"strategy-map-controls\" role=\"group\" aria-label=\"Map camera\"></div><div class=\"strategy-compass\" aria-hidden=\"true\"><svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1\"><path d=\"m16 3 8 13-8 13-8-13Z\"/><path d=\"M16 3v26M3 16h26\"/><circle cx=\"16\" cy=\"16\" r=\"3\"/></svg></div><div class=\"strategy-district-labels\" role=\"group\" aria-label=\"Inspect a district\"></div><footer class=\"strategy-map-footer\"><span class=\"strategy-map-status\" role=\"status\" aria-live=\"polite\"></span><span class=\"strategy-map-context\"></span></footer>';\n      map.querySelector('.strategy-canvas').style.backgroundImage = 'url(\"/art/grand-strategy/city-atlas.webp\")';\n      const guide = document.createElement('div'); guide.className = 'strategy-map-guide';\n      guide.innerHTML = '<p class=\"strategy-mode-description\"></p><div class=\"strategy-map-legend\" aria-label=\"Territory control legend\"></div>';\n      for (const [id, label] of [['mine', 'Your family'], ['held', 'Other family'], ['occupied', 'Occupied'], ['open', 'Open'], ['contested', 'Contested']]) {\n        const item = document.createElement('span'); item.dataset.state = id; item.textContent = label; guide.querySelector('.strategy-map-legend').append(item);\n      }\n      map.querySelector('.strategy-map-toolbar').after(guide);\n      map.querySelector('.strategy-map-modes').addEventListener('keydown', event => {\n        if (!event.target.matches('[data-strategy-mode]')) return;\n        const buttons = [...map.querySelectorAll('[data-strategy-mode]')], index = buttons.indexOf(event.target);\n        const next = keyboardIndex(event.key, index, buttons.length);\n        if (next == null) return;\n        event.preventDefault(); buttons[next].focus(); buttons[next].click();\n      });\n      map.querySelector('.strategy-district-labels').addEventListener('keydown', event => {\n        if (!event.target.matches('[data-strategy-district]')) return;\n        const buttons = [...map.querySelectorAll('[data-strategy-district]')], index = buttons.indexOf(event.target);\n        const next = keyboardIndex(event.key, index, buttons.length);\n        if (next == null) return;\n        event.preventDefault(); buttons[next].focus(); buttons[next].click();\n      });\n      for (const [id, label, mark] of [['zoomin', 'Zoom in', '+'], ['zoomout', 'Zoom out', '−'], ['reset', 'Reset map view', '⟲']]) {\n        const button = document.createElement('button'); button.type = 'button'; button.dataset.strategyCamera = id;\n        button.setAttribute('aria-label', label); button.title = label; button.textContent = mark; button.disabled = true;\n",
          "baseline": "          if (root.open) { readMap(); paint(); }\n        });\n      }\n      const map = document.createElement('section'); map.className = 'strategy-map'; map.setAttribute('aria-label', 'Strategic city view');\n      map.innerHTML = '<header class=\"strategy-map-toolbar\"><div class=\"strategy-map-title\"><span class=\"strategy-map-kicker\">CITY COMMAND</span><h2>The city</h2></div><div class=\"strategy-map-modes\" role=\"group\" aria-label=\"Map view\"></div></header><div class=\"strategy-canvas\" aria-hidden=\"true\"></div><div class=\"strategy-map-controls\" role=\"group\" aria-label=\"Map camera\"></div><div class=\"strategy-compass\" aria-hidden=\"true\"><svg viewBox=\"0 0 32 32\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1\"><path d=\"m16 3 8 13-8 13-8-13Z\"/><path d=\"M16 3v26M3 16h26\"/><circle cx=\"16\" cy=\"16\" r=\"3\"/></svg></div><div class=\"strategy-district-labels\" role=\"group\" aria-label=\"Inspect a district\"></div><footer class=\"strategy-map-footer\"><span class=\"strategy-map-status\" role=\"status\" aria-live=\"polite\"></span><span class=\"strategy-map-context\"></span></footer>';\n      map.querySelector('.strategy-canvas').style.backgroundImage = 'url(\"/art/citymap.jpg\")';\n      for (const [id, label, mark] of [['zoomin', 'Zoom in', '+'], ['zoomout', 'Zoom out', '−'], ['reset', 'Reset map view', '⟲']]) {\n        const button = document.createElement('button'); button.type = 'button'; button.dataset.strategyCamera = id;\n        button.setAttribute('aria-label', label); button.title = label; button.textContent = mark; button.disabled = true;\n"
        },
        {
          "at": 10107,
          "current": "      const inspector = document.createElement('aside'); inspector.className = 'strategy-inspector'; inspector.setAttribute('aria-label', 'Selected district');\n      inspector.innerHTML = '<img class=\"strategy-district-art\" alt=\"\"><div class=\"strategy-inspector-body\"><p class=\"strategy-inspector-kicker\"></p><h3></h3><dl class=\"strategy-district-facts\"></dl><div class=\"strategy-district-actions\"></div></div>';\n      const image = inspector.querySelector('img'); image.loading = 'lazy'; image.onerror = () => { image.onerror = null; image.src = '/art/citymap.jpg'; };\n      for (const [tab, label] of [['map', 'Explore neighborhood'], ['city', 'Market ledger'], ['streets', 'Street operations'], ['family', 'Family council']]) {\n        const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.dataset.strategyNavigate = tab; button.onclick = () => navigate(tab); inspector.querySelector('.strategy-district-actions').append(button);\n      }\n      const orders = document.createElement('aside'); orders.className = 'strategy-orders'; orders.setAttribute('aria-label', 'Your next order');\n      root.append(resources, overview, map, inspector, orders);\n      return root;\n    }\n\n    function keyboardIndex(key, index, length) {\n      if (!length) return null;\n      if (key === 'Home') return 0;\n      if (key === 'End') return length - 1;\n      if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % length;\n      if (key === 'ArrowLeft' || key === 'ArrowUp') return (index + length - 1) % length;\n      return null;\n    }\n\n    function paintDashboard(values) {\n      const me = state().me || {};\n      for (const item of stage.querySelectorAll('[data-strategy-resource]')) {\n        const key = item.dataset.strategyResource;\n        const maximum = key === 'energy' ? me.maxEnergy : key === 'nerve' ? me.maxNerve : null;\n        const value = count(me[key]);\n        text(item.querySelector('strong'), maximum != null ? `${value} / ${count(maximum)}` : value);\n        item.dataset.tone = key === 'heat' && Number(me.heat) >= 60 ? 'caution' : 'normal';\n      }\n      const district = values.find(value => value.id === me.loc);\n      text(stage.querySelector('.strategy-overview-kicker'), [board?.season?.name || 'City command', district?.name].filter(Boolean).join(' · '));\n      const overview = { family: board ? `${count(board.mine?.districts)} / ${count(board.total ?? values.length)}` : '—', open: board ? count(values.filter(value => value.state === 'open').length) : '—', contests: board ? count(values.filter(value => value.state === 'contested').length) : '—' };\n      for (const item of stage.querySelectorAll('[data-strategy-overview]')) text(item.querySelector('strong'), overview[item.dataset.strategyOverview]);\n      text(stage.querySelector('.strategy-mode-description'), descriptions[mode]);\n    }\n\n    function paintPowers() {\n      const orders = stage.querySelector('.strategy-orders');\n      let powers = orders.querySelector('.strategy-powers');\n      if (!powers) {\n        powers = document.createElement('section'); powers.className = 'strategy-powers'; powers.setAttribute('aria-label', 'Family balance of power');\n        powers.innerHTML = '<h3>Families of the city</h3><ol class=\"strategy-power-list\"></ol><p class=\"strategy-power-empty\"></p><button type=\"button\" data-strategy-navigate=\"family\">Open family council</button>';\n        powers.querySelector('button').onclick = () => navigate('family'); orders.append(powers);\n      }\n      const values = list(board?.powers), host = powers.querySelector('ol'), signature = JSON.stringify(values);\n      if (host.dataset.signature !== signature) {\n        host.replaceChildren();\n        values.forEach((family, index) => {\n          const row = document.createElement('li'); row.className = 'strategy-power-row'; row.dataset.mine = String(!!family.mine);\n          row.innerHTML = '<span class=\"strategy-power-rank\" aria-hidden=\"true\"></span><strong></strong><span class=\"strategy-power-territory\"></span>';\n          text(row.querySelector('.strategy-power-rank'), String(index + 1).padStart(2, '0'));\n          text(row.querySelector('strong'), [family.tag, family.name].filter(Boolean).join(' · '));\n          text(row.querySelector('.strategy-power-territory'), `${count(family.districts)} ${Number(family.districts) === 1 ? 'district' : 'districts'}`);\n          if (family.mine) row.querySelector('strong').append(document.createTextNode(' · You'));\n          host.append(row);\n        });\n        host.dataset.signature = signature;\n      }\n      const empty = powers.querySelector('.strategy-power-empty'); empty.hidden = values.length > 0;\n      text(empty, board ? 'No family currently holds a district.' : 'Family standings appear with city records.');\n    }\n\n    function mount() {\n      const currentPanel = document.getElementById('tab-start');\n      if (!currentPanel) return false;\n",
          "baseline": "      const inspector = document.createElement('aside'); inspector.className = 'strategy-inspector'; inspector.setAttribute('aria-label', 'Selected district');\n      inspector.innerHTML = '<img class=\"strategy-district-art\" alt=\"\"><div class=\"strategy-inspector-body\"><p class=\"strategy-inspector-kicker\"></p><h3></h3><dl class=\"strategy-district-facts\"></dl><div class=\"strategy-district-actions\"></div></div>';\n      const image = inspector.querySelector('img'); image.loading = 'lazy'; image.onerror = () => { image.onerror = null; image.src = '/art/citymap.jpg'; };\n      for (const [tab, label] of [['map', 'Explore neighborhood'], ['city', 'Market ledger'], ['streets', 'Street operations']]) {\n        const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.dataset.strategyNavigate = tab; button.onclick = () => navigate(tab); inspector.querySelector('.strategy-district-actions').append(button);\n      }\n      const orders = document.createElement('aside'); orders.className = 'strategy-orders'; orders.setAttribute('aria-label', 'Your next order');\n      root.append(map, inspector, orders);\n      return root;\n    }\n\n    function mount() {\n      const currentPanel = document.getElementById('tab-start');\n      if (!currentPanel) return false;\n"
        },
        {
          "at": 18985,
          "current": "    function paintInspector(district) {\n      const inspector = stage.querySelector('.strategy-inspector'); inspector.hidden = !district;\n      if (!district) return;\n      const image = inspector.querySelector('img'), source = points[district.id] ? `/art/grand-strategy/district-${district.id}.webp` : '/art/grand-strategy/city-atlas.webp';\n      if (image.getAttribute('src') !== source) image.src = source;\n      text(inspector.querySelector('.strategy-inspector-kicker'), district.id === state().me?.loc ? 'YOUR CURRENT DISTRICT' : 'DISTRICT INTELLIGENCE');\n      text(inspector.querySelector('h3'), district.name || district.id);\n",
          "baseline": "    function paintInspector(district) {\n      const inspector = stage.querySelector('.strategy-inspector'); inspector.hidden = !district;\n      if (!district) return;\n      const image = inspector.querySelector('img'), source = points[district.id] ? `/art/district-${district.id}.jpg` : '/art/citymap.jpg';\n      if (image.getAttribute('src') !== source) image.src = source;\n      text(inspector.querySelector('.strategy-inspector-kicker'), district.id === state().me?.loc ? 'YOUR CURRENT DISTRICT' : 'DISTRICT INTELLIGENCE');\n      text(inspector.querySelector('h3'), district.name || district.id);\n"
        },
        {
          "at": 21345,
          "current": "      if (!values.some(district => district.id === selected)) selected = values.find(district => district.id === state().me?.loc)?.id || values[0]?.id || '';\n      stage.dataset.mode = mode;\n      for (const button of stage.querySelectorAll('[data-strategy-mode]')) button.setAttribute('aria-pressed', String(button.dataset.strategyMode === mode));\n      paintLabels(values); paintInspector(values.find(district => district.id === selected)); paintDashboard(values); paintPowers();\n      paintCameraControls();\n      const records = error || (pending ? 'Reading city records…' : lastRead ? 'Current city records' : 'District descriptions · live control not loaded');\n      text(stage.querySelector('.strategy-map-status'), rendererFailed ? `City map illustration · ${records}` : records);\n",
          "baseline": "      if (!values.some(district => district.id === selected)) selected = values.find(district => district.id === state().me?.loc)?.id || values[0]?.id || '';\n      stage.dataset.mode = mode;\n      for (const button of stage.querySelectorAll('[data-strategy-mode]')) button.setAttribute('aria-pressed', String(button.dataset.strategyMode === mode));\n      paintLabels(values); paintInspector(values.find(district => district.id === selected));\n      paintCameraControls();\n      const records = error || (pending ? 'Reading city records…' : lastRead ? 'Current city records' : 'District descriptions · live control not loaded');\n      text(stage.querySelector('.strategy-map-status'), rendererFailed ? `City map illustration · ${records}` : records);\n"
        }
      ]
    },
    "public/sw.js": {
      "current": {
        "mode": "100644",
        "blob": "c4c935ca3f3d3e84be8e17a10a40bcfd52078147",
        "sha256": "8ef62d933242c6b03bbc84a230e9637ade26e3616ba3d1a26694037dcc10ec6f",
        "bytes": 5021
      },
      "baseline": {
        "mode": "100644",
        "blob": "ce01893c73ab21a7f2186e0325246aa99993d916",
        "sha256": "d1cf7d3bc7ed9433aaa27652d9a29327e6d26ce4aa646ebffe989150def25427",
        "bytes": 4886
      },
      "inverses": [
        {
          "at": 365,
          "current": "   (you always get the latest client online; cached pages are only offline fallbacks). The shared stylesheet\n   also follows the network so installed players receive visual fixes. Icons and art are cache-first.\n   The API (/v1/*, the websocket) is NEVER cached. */\nconst CACHE = 'omerta-shell-v9';\n// Never precache the private console: cache.addAll ignores its no-store response header.\nconst SHELL = ['/omerta-ui.css', '/noir-ui.css', '/noir-landing.css', '/noir-shell.js', '/strategy-command.css', '/strategy-command.js', '/strategy-atmosphere.css', '/strategy-atmosphere.js', '/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];\nconst cacheable = (res) => res && res.status === 200 && !res.redirected\n  && (res.type === 'basic' || res.type === 'default')\n  && !/(?:^|,)\\s*(?:no-store|private)(?:\\s|,|=|$)/i.test(res.headers.get('cache-control') || '');\n",
          "baseline": "   (you always get the latest client online; cached pages are only offline fallbacks). The shared stylesheet\n   also follows the network so installed players receive visual fixes. Icons and art are cache-first.\n   The API (/v1/*, the websocket) is NEVER cached. */\nconst CACHE = 'omerta-shell-v8';\n// Never precache the private console: cache.addAll ignores its no-store response header.\nconst SHELL = ['/omerta-ui.css', '/noir-ui.css', '/noir-landing.css', '/noir-shell.js', '/strategy-command.css', '/strategy-command.js', '/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];\nconst cacheable = (res) => res && res.status === 200 && !res.redirected\n  && (res.type === 'basic' || res.type === 'default')\n  && !/(?:^|,)\\s*(?:no-store|private)(?:\\s|,|=|$)/i.test(res.headers.get('cache-control') || '');\n"
        },
        {
          "at": 2206,
          "current": "  const isNav = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');\n  if (isNav || url.pathname === '/omerta-ui.css'\n    || /^\\/noir-(?:ui|landing|shell)\\.(?:js|css)$/.test(url.pathname)\n    || /^\\/strategy-(?:command|atmosphere)\\.(?:js|css)$/.test(url.pathname) || url.pathname === '/vendor/strategy-city-renderer.js'\n    || url.pathname === '/art/grand-strategy/scene-library.json'\n    || /^\\/ux-(?:feedback|progression|social|navigation|workspace|world|tactics|investigation|coordination|feel|tools|identity|story|community)\\.(?:js|css)$/.test(url.pathname)\n    || ['/player-experience.js', '/city-scene.js', '/city-scene.css', '/world-fieldwork.js', '/world-fieldwork.css', '/vendor/phaser.js'].includes(url.pathname)) {\n    // NETWORK-FIRST: a Codex visit belongs to its own URL, never the root game's offline slot.\n",
          "baseline": "  const isNav = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');\n  if (isNav || url.pathname === '/omerta-ui.css'\n    || /^\\/noir-(?:ui|landing|shell)\\.(?:js|css)$/.test(url.pathname)\n    || /^\\/strategy-command\\.(?:js|css)$/.test(url.pathname) || url.pathname === '/vendor/strategy-city-renderer.js'\n    || /^\\/ux-(?:feedback|progression|social|navigation|workspace|world|tactics|investigation|coordination|feel|tools|identity|story|community)\\.(?:js|css)$/.test(url.pathname)\n    || ['/player-experience.js', '/city-scene.js', '/city-scene.css', '/world-fieldwork.js', '/world-fieldwork.css', '/vendor/phaser.js'].includes(url.pathname)) {\n    // NETWORK-FIRST: a Codex visit belongs to its own URL, never the root game's offline slot.\n"
        }
      ]
    },
    "src/server.js": {
      "current": {
        "mode": "100644",
        "blob": "c0b381e05fd9e6029394a8cdd7449c7d30e2a8ef",
        "sha256": "248f866dd1269e350f92a5aeb2e5c7978741b9b42994f9e2b1a1268a37b7ffdc",
        "bytes": 313687
      },
      "baseline": {
        "mode": "100644",
        "blob": "0cc69dcc0d6e46ff54c699e3b6091eea4c088020",
        "sha256": "0eec1fe0dc4797c823f07460c2da2e2de9c4f47d56dbc7fbcdc5067ac1736048",
        "bytes": 311862
      },
      "inverses": [
        {
          "at": 48147,
          "current": "  for (const [file, type] of [\n    ['noir-ui.css', 'text/css'], ['noir-landing.css', 'text/css'], ['noir-shell.js', 'application/javascript'],\n    ['strategy-command.css', 'text/css'], ['strategy-command.js', 'application/javascript'],\n    ['strategy-atmosphere.css', 'text/css'], ['strategy-atmosphere.js', 'application/javascript'],\n    ['vendor/strategy-city-renderer.js', 'application/javascript'], ['vendor/strategy-city-renderer.js.LEGAL.txt', 'text/plain'],\n    ['vendor/strategy-city-renderer.LICENSE.txt', 'text/plain'],\n    ['site-analytics.js', 'application/javascript'],\n",
          "baseline": "  for (const [file, type] of [\n    ['noir-ui.css', 'text/css'], ['noir-landing.css', 'text/css'], ['noir-shell.js', 'application/javascript'],\n    ['strategy-command.css', 'text/css'], ['strategy-command.js', 'application/javascript'],\n    ['vendor/strategy-city-renderer.js', 'application/javascript'], ['vendor/strategy-city-renderer.js.LEGAL.txt', 'text/plain'],\n    ['vendor/strategy-city-renderer.LICENSE.txt', 'text/plain'],\n    ['site-analytics.js', 'application/javascript'],\n"
        },
        {
          "at": 58904,
          "current": "    }\n    return reply.type(hit.type || 'video/mp4').header('content-length', String(hit.size)).send(createReadStream(hit.path));\n  };\n  const strategyArtDir = join(artDir, 'grand-strategy');\n  const strategyScenes = ['city-atlas', 'council-chamber', ...['foundry', 'cathedral', 'neon', 'brick', 'canal', 'docks'].map(id => `district-${id}`)];\n  const strategyVariants = ['ambient', 'h3', 'rain', 'mist', 'night', 'dawn', 'streetlife', 'cinematic', 'snow', 'cinematic-take2'];\n  const strategyFiles = new Map();\n  for (const name of ['scene-library.json', 'city-seal.webp', ...strategyScenes.map(id => `${id}.webp`),\n    ...strategyScenes.map(id => `${id}.mp4`), ...strategyScenes.flatMap(id => strategyVariants.map(variant => `motion/${id}-${variant}.mp4`))]) {\n    try {\n      const path = join(strategyArtDir, name), stat = statSync(path);\n      if (!stat.isFile()) continue;\n      if (name.endsWith('.mp4')) ART_VIDEOS.set('grand-strategy/' + name, { path, size: stat.size, type: 'video/mp4', cacheControl: 'no-cache' });\n      else strategyFiles.set(name, { path, size: stat.size, type: name.endsWith('.webp') ? 'image/webp' : 'application/json; charset=utf-8' });\n    } catch { /* The still view remains available while optional atmosphere exports are absent. */ }\n  }\n  app.get('/art/grand-strategy/:file', async (req, reply) => {\n    const key = 'grand-strategy/' + req.params.file;\n    if (ART_VIDEOS.has(key)) return sendVideo(key, req, reply);\n    const hit = strategyFiles.get(req.params.file);\n    if (!hit) return reply.code(404).send({ error: 'not_found' });\n    return reply.type(hit.type).header('cache-control', 'no-cache').header('content-length', String(hit.size)).send(createReadStream(hit.path));\n  });\n  app.get('/art/grand-strategy/motion/:file', async (req, reply) => sendVideo('grand-strategy/motion/' + req.params.file, req, reply));\n  app.get('/art/:file', async (req, reply) => {\n    const hit = ART_FILES.get(req.params.file);\n    if (hit) return reply.type(hit.type).header('cache-control', 'public, max-age=604800, immutable').send(hit.body);\n",
          "baseline": "    }\n    return reply.type(hit.type || 'video/mp4').header('content-length', String(hit.size)).send(createReadStream(hit.path));\n  };\n  app.get('/art/:file', async (req, reply) => {\n    const hit = ART_FILES.get(req.params.file);\n    if (hit) return reply.type(hit.type).header('cache-control', 'public, max-age=604800, immutable').send(hit.body);\n"
        }
      ]
    },
    "test/strategy-command-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "60330b0e29807fe14a5033fd1aec0449886dae7d",
        "sha256": "5fa9e4281d12e1fa14593692afe0f7954c5b94cb352213ab02372c622dc133ae",
        "bytes": 29268
      },
      "baseline": {
        "mode": "100644",
        "blob": "d7019399a540e555c73e970ebd5489bd618b23bc",
        "sha256": "20628b023bc0ba02069c6e46cc685fc0d3497d54ee3f74c9b4400948ab88c7c7",
        "bytes": 16507
      },
      "inverses": [
        {
          "at": 3541,
          "current": "  for (const button of await buttons.all())\n    assert.equal(await button.isDisabled(), true, 'camera controls are disabled without an active 3D renderer');\n}\nasync function assertDashboard(page, me, board) {\n  const number = value => Number(value).toLocaleString('en-US');\n  for (const key of ['cash', 'omr', 'respect', 'energy', 'nerve', 'heat']) {\n    const maximum = key === 'energy' ? me.maxEnergy : key === 'nerve' ? me.maxNerve : null;\n    const expected = maximum == null ? number(me[key]) : `${number(me[key])} / ${number(maximum)}`;\n    assert.equal(await page.locator(`[data-strategy-resource=\"${key}\"] dd`).innerText(), expected, `${key} reflects the character response`);\n  }\n  const overview = {\n    family: `${number(board.mine.districts)} / ${number(board.total)}`,\n    open: number(board.districts.filter(district => district.state === 'open').length),\n    contests: number(board.districts.filter(district => district.state === 'contested').length),\n  };\n  for (const [key, expected] of Object.entries(overview))\n    assert.equal(await page.locator(`[data-strategy-overview=\"${key}\"] dd`).innerText(), expected, `${key} overview reflects city records`);\n  const powers = page.locator('.strategy-power-row');\n  assert.equal(await powers.count(), board.powers.length, 'family standings contain only recorded district holders');\n  for (const [index, family] of board.powers.entries()) {\n    assert.ok((await powers.nth(index).innerText()).includes(family.name), 'family standings retain the recorded family name');\n    assert.ok((await powers.nth(index).innerText()).includes(number(family.districts)), 'family standings retain the recorded territory count');\n  }\n}\nasync function assertGalleryFit(page, label) {\n  const size = await page.locator('dialog.strategy-art-dialog').evaluate(dialog => {\n    const rect = dialog.getBoundingClientRect();\n    return { left: rect.left, right: rect.right, viewport: innerWidth, width: dialog.clientWidth, scroll: dialog.scrollWidth };\n  });\n  assert.ok(size.left >= 0 && size.right <= size.viewport + 1 && size.scroll <= size.width + 1, `${label} gallery overflows: ${JSON.stringify(size)}`);\n  await noOverflow(page, `${label} gallery`);\n}\nasync function assertGallery(page, requests, { allScenes = false, label = 'desktop' } = {}) {\n  const opener = page.getByRole('button', { name: 'View district', exact: true });\n  const ambientRequests = () => requests.filter(request => request.path.startsWith('/art/grand-strategy/') && request.path.endsWith('.mp4')).length;\n  const videosBefore = ambientRequests();\n  const libraryReply = page.waitForResponse(response => new URL(response.url()).pathname === '/art/grand-strategy/scene-library.json').then(async response => response.ok() ? response.json() : null);\n  await opener.click();\n  const dialog = page.getByRole('dialog');\n  await dialog.waitFor();\n  const library = await libraryReply;\n  const scenes = dialog.locator('[data-strategy-scene]');\n  assert.equal(await scenes.count(), 8, 'the gallery exposes six districts, the city atlas, and the council chamber');\n  assert.equal(await dialog.locator('video[src]').count(), 0, 'opening the gallery never starts video');\n  assert.equal(await dialog.locator('video').getAttribute('preload'), 'none', 'ambient video does not preload');\n  const sceneIds = await scenes.evaluateAll(buttons => buttons.map(button => button.dataset.strategyScene));\n  assert.deepEqual(new Set(sceneIds), new Set(['foundry', 'cathedral', 'neon', 'brick', 'canal', 'docks', 'city-atlas', 'council-chamber']));\n  for (const id of allScenes ? sceneIds : [sceneIds[0], sceneIds.at(-1)]) {\n    const button = dialog.locator(`[data-strategy-scene=\"${id}\"]`);\n    await button.click();\n    assert.equal(await button.getAttribute('aria-pressed'), 'true', `${id} can be selected`);\n    assert.equal(await dialog.locator('[data-strategy-scene][aria-pressed=\"true\"]').count(), 1, 'only one illustration is selected');\n    assert.equal(await dialog.locator('h2').innerText(), await button.innerText(), 'the selected illustration has the matching title');\n    await page.waitForFunction(() => {\n      const image = document.querySelector('dialog[open] .strategy-art-image');\n      return image?.complete && image.naturalWidth > 0;\n    });\n    assert.ok((await dialog.locator('.strategy-art-image').getAttribute('src')).endsWith(`${id.startsWith('city-') || id === 'council-chamber' ? id : `district-${id}`}.webp`), 'the chosen illustration loads its own artwork');\n    assert.equal(await dialog.locator('video[src]').count(), 0, 'scene selection leaves ambience opt-in');\n  }\n  assert.equal(ambientRequests(), videosBefore, 'browsing illustrations makes no video requests');\n  if (allScenes) {\n    // Exercise an actual generated video when present; still-image review works during generation.\n    const localMotion = motion => fs.existsSync(new URL(`../public${motion.src}`, import.meta.url));\n    const recordedMotion = (library?.scenes || []).filter(scene => scene.motion?.length && scene.motion.every(localMotion));\n    const motionScene = recordedMotion.find(scene => scene.id === 'neon' && scene.motion.length > 1)\n      || recordedMotion.find(scene => scene.motion.length > 1) || recordedMotion[0];\n    const videoScene = motionScene?.id || (!library && sceneIds.find(id => fs.existsSync(new URL(`../public/art/grand-strategy/${id.startsWith('city-') || id === 'council-chamber' ? id : `district-${id}`}.mp4`, import.meta.url))));\n    if (videoScene) {\n      await dialog.locator(`[data-strategy-scene=\"${videoScene}\"]`).click();\n      const atmosphere = dialog.getByRole('combobox', { name: 'Atmosphere', exact: true });\n      if (motionScene) {\n        await page.waitForFunction(length => document.querySelector('dialog[open] [data-strategy-atmosphere]')?.options.length === length, motionScene.motion.length);\n        assert.deepEqual(await atmosphere.locator('option').evaluateAll(options => options.map(option => option.value)), motionScene.motion.map(motion => motion.id), 'available atmospheres reflect the selected scene library');\n      }\n      await dialog.getByRole('button', { name: 'Play ambience', exact: true }).click();\n      await page.waitForFunction(() => {\n        const video = document.querySelector('dialog[open] video');\n        return video?.readyState >= 2 && !video.paused && video.muted;\n      }, null, { timeout: 20000 });\n      assert.equal(await dialog.locator('video').isVisible(), true, 'explicit opt-in plays muted ambience');\n      if (motionScene) {\n        const current = await atmosphere.inputValue();\n        assert.equal(await dialog.locator('video').getAttribute('src'), motionScene.motion.find(motion => motion.id === current).src, 'playback uses the selected scene library source');\n        const alternative = motionScene.motion.find(motion => motion.id !== current);\n        if (alternative) {\n          const priorRequests = requests.filter(request => request.path === alternative.src).length;\n          await atmosphere.selectOption(alternative.id);\n          assert.equal(await dialog.locator('video[src]').count(), 0, 'changing atmosphere clears the playing source');\n          assert.equal(await dialog.locator('video').evaluate(video => video.paused), true, 'changing atmosphere pauses playback');\n          assert.equal(await dialog.getByRole('button', { name: 'Play ambience', exact: true }).getAttribute('aria-pressed'), 'false', 'a changed atmosphere requires another playback request');\n          await page.waitForTimeout(100);\n          assert.equal(requests.filter(request => request.path === alternative.src).length, priorRequests, 'changing atmosphere never requests its video before opt-in');\n          await dialog.getByRole('button', { name: 'Play ambience', exact: true }).click();\n          await page.waitForFunction(source => {\n            const video = document.querySelector('dialog[open] video');\n            return video?.getAttribute('src') === source && video.readyState >= 2 && !video.paused && video.muted;\n          }, alternative.src, { timeout: 20000 });\n          assert.equal(await dialog.locator('video').getAttribute('src'), alternative.src, 'explicit playback uses the newly chosen atmosphere');\n        }\n      }\n      await dialog.locator(`[data-strategy-scene=\"${sceneIds.find(id => id !== videoScene)}\"]`).click();\n      assert.equal(await dialog.locator('video[src]').count(), 0, 'changing illustration clears the previous video source');\n      assert.equal(await dialog.locator('video').evaluate(video => video.paused), true, 'changing illustration stops video playback');\n    }\n    await scenes.first().focus();\n    await page.keyboard.press('ArrowLeft');\n    assert.equal(await scenes.last().getAttribute('aria-pressed'), 'true', 'gallery keyboard navigation wraps between scenes');\n    assert.equal(await scenes.last().evaluate(button => button === document.activeElement), true, 'gallery keyboard selection retains focus');\n    await dialog.locator('[data-strategy-scene=\"city-atlas\"]').click();\n    await page.waitForFunction(() => {\n      const image = document.querySelector('dialog[open] .strategy-art-image');\n      return image?.complete && image.naturalWidth > 0;\n    });\n    assert.equal(await dialog.locator('video[src]').count(), 0, 'city atlas proof shows the illustration without starting motion');\n    await page.screenshot({ path: path.join(artifacts, 'strategy-gallery.png') });\n  }\n  await assertGalleryFit(page, label);\n  await page.keyboard.press('Escape');\n  await dialog.waitFor({ state: 'hidden' });\n  assert.equal(await dialog.locator('video[src]').count(), 0, 'closing the gallery releases its video source');\n  assert.equal(await opener.evaluate(button => button === document.activeElement), true, 'Escape restores focus to the district view button');\n}\n\ntry {\n  const { token } = await call('POST', '/v1/auth/guest');\n  await call('POST', '/v1/character', token, { name: 'Strategy Command Player' });\n  await app.pool.query('UPDATE characters SET cash=$1 WHERE name=$2', [1234, 'Strategy Command Player']);\n  // Different control states make stale or hardcoded inspector records observable.\n  await app.pool.query(\"UPDATE districts SET npc_holder=NULL, holder_gang=NULL, garrison=4321 WHERE id='canal'\");\n  const board = await call('GET', '/v1/map', token);\n  assert.equal(board.districts.length, 6, 'the fixture exposes the six authoritative city districts');\n  const illustration = await app.inject({ method: 'GET', url: '/art/grand-strategy/district-foundry.webp' });\n  assert.equal(illustration.statusCode, 200, 'finished strategy illustrations are served');\n  assert.match(illustration.headers['content-type'], /^image\\/webp/);\n  const productionLedger = await app.inject({ method: 'GET', url: '/art/grand-strategy/generation-ledger.json' });\n  assert.equal(productionLedger.statusCode, 404, 'the production generation ledger remains private');\n  if (fs.existsSync(new URL('../public/art/grand-strategy/district-foundry.mp4', import.meta.url))) {\n    const clipRange = await app.inject({ method: 'GET', url: '/art/grand-strategy/district-foundry.mp4', headers: { range: 'bytes=0-15' } });\n    assert.equal(clipRange.statusCode, 206, 'strategy ambience supports browser byte ranges');\n    assert.equal(clipRange.headers['content-length'], '16');\n    assert.match(clipRange.headers['content-range'], /^bytes 0-15\\/\\d+$/);\n    assert.match(clipRange.headers['content-type'], /^video\\/mp4/);\n  }\n  await app.listen({ port: 0, host: '127.0.0.1' });\n  const base = `http://127.0.0.1:${app.server.address().port}`;\n  browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader'] });\n",
          "baseline": "  for (const button of await buttons.all())\n    assert.equal(await button.isDisabled(), true, 'camera controls are disabled without an active 3D renderer');\n}\n\ntry {\n  const { token } = await call('POST', '/v1/auth/guest');\n  await call('POST', '/v1/character', token, { name: 'Strategy Command Player' });\n  // Different control states make stale or hardcoded inspector records observable.\n  await app.pool.query(\"UPDATE districts SET npc_holder=NULL, holder_gang=NULL, garrison=4321 WHERE id='canal'\");\n  const board = await call('GET', '/v1/map', token);\n  assert.equal(board.districts.length, 6, 'the fixture exposes the six authoritative city districts');\n  await app.listen({ port: 0, host: '127.0.0.1' });\n  const base = `http://127.0.0.1:${app.server.address().port}`;\n  browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader'] });\n"
        },
        {
          "at": 16412,
          "current": "    page.on('pageerror', error => faults.push(error.message));\n    page.on('request', request => requests.push({ method: request.method(), path: new URL(request.url()).pathname, at: Date.now() }));\n    if (blockRenderer) await page.route('**/vendor/strategy-city-renderer.js*', route => route.abort('failed'));\n    const characterReply = page.waitForResponse(response => new URL(response.url()).pathname === '/v1/projections/player' && response.status() === 200).then(response => response.json());\n    await page.goto(base, { waitUntil: 'domcontentloaded' });\n    await page.locator('#tab-start.on .start-next-card').waitFor();\n    await page.locator('#strategy-command').waitFor();\n    await page.locator('#tab-start [data-feel-loading]').waitFor({ state: 'hidden' });\n    const character = await characterReply;\n    return { page, context, requests, me: character.player?.character || character.player };\n  }\n\n  const desktop = await open({ width: 1440, height: 900 });\n",
          "baseline": "    page.on('pageerror', error => faults.push(error.message));\n    page.on('request', request => requests.push({ method: request.method(), path: new URL(request.url()).pathname, at: Date.now() }));\n    if (blockRenderer) await page.route('**/vendor/strategy-city-renderer.js*', route => route.abort('failed'));\n    await page.goto(base, { waitUntil: 'domcontentloaded' });\n    await page.locator('#tab-start.on .start-next-card').waitFor();\n    await page.locator('#strategy-command').waitFor();\n    await page.locator('#tab-start [data-feel-loading]').waitFor({ state: 'hidden' });\n    return { page, context, requests };\n  }\n\n  const desktop = await open({ width: 1440, height: 900 });\n"
        },
        {
          "at": 17512,
          "current": "  assert.equal(await page.locator('.strategy-orders > .start-first-week').count(), 1, 'the original first-week panel lives beside the desktop map');\n  await aboveFold(page, '.strategy-orders .start-next-card .act', 'desktop original first-week action');\n  assert.equal(await page.locator('[data-strategy-district]').count(), 6);\n  await assertDashboard(page, desktop.me, board);\n  assert.equal(await page.locator('#strategy-command video[src], .strategy-art-dialog video[src]').count(), 0, 'the command table never loads ambient video automatically');\n  const initialReads = desktop.requests.filter(request => request.method === 'GET' && request.path === '/v1/map');\n  assert.ok(initialReads.length >= 1 && initialReads.length <= 2, 'initial map loading uses a bounded read');\n  const inspectedAt = Date.now(), initialWrites = desktop.requests.filter(request => request.method === 'POST').length;\n",
          "baseline": "  assert.equal(await page.locator('.strategy-orders > .start-first-week').count(), 1, 'the original first-week panel lives beside the desktop map');\n  await aboveFold(page, '.strategy-orders .start-next-card .act', 'desktop original first-week action');\n  assert.equal(await page.locator('[data-strategy-district]').count(), 6);\n  const initialReads = desktop.requests.filter(request => request.method === 'GET' && request.path === '/v1/map');\n  assert.ok(initialReads.length >= 1 && initialReads.length <= 2, 'initial map loading uses a bounded read');\n  const inspectedAt = Date.now(), initialWrites = desktop.requests.filter(request => request.method === 'POST').length;\n"
        },
        {
          "at": 20072,
          "current": "  await page.keyboard.press('Enter');\n  await assertDistrict(page, chosen);\n  assert.equal(await keyboardDistrict.evaluate(element => element === document.activeElement), true, 'district selection retains keyboard focus');\n  await page.keyboard.press('ArrowRight');\n  const nextDistrict = board.districts[(board.districts.findIndex(district => district.id === chosen.id) + 1) % board.districts.length];\n  await assertDistrict(page, nextDistrict);\n  assert.equal(await page.locator(`[data-strategy-district=\"${nextDistrict.id}\"]`).evaluate(element => element === document.activeElement), true, 'arrow district selection moves keyboard focus');\n  await page.keyboard.press('Home');\n  await assertDistrict(page, board.districts[0]);\n  await page.keyboard.press('End');\n  await assertDistrict(page, board.districts.at(-1));\n  await keyboardDistrict.click();\n  await page.locator('[data-strategy-mode=\"districts\"]').focus();\n  await page.keyboard.press('ArrowRight');\n  assert.equal(await page.locator('[data-strategy-mode=\"influence\"]').getAttribute('aria-pressed'), 'true', 'arrow navigation changes map mode');\n  assert.match(await page.locator('.strategy-mode-description').innerText(), /garrison/i, 'influence mode explains its intelligence');\n  await page.keyboard.press('Home');\n  assert.equal(await page.locator('[data-strategy-mode=\"districts\"]').getAttribute('aria-pressed'), 'true', 'Home returns to the first map mode');\n  for (const mode of ['influence', 'trade', 'districts']) {\n    const button = page.locator(`[data-strategy-mode=\"${mode}\"]`);\n    await button.focus();\n",
          "baseline": "  await page.keyboard.press('Enter');\n  await assertDistrict(page, chosen);\n  assert.equal(await keyboardDistrict.evaluate(element => element === document.activeElement), true, 'district selection retains keyboard focus');\n  for (const mode of ['influence', 'trade', 'districts']) {\n    const button = page.locator(`[data-strategy-mode=\"${mode}\"]`);\n    await button.focus();\n"
        },
        {
          "at": 24499,
          "current": "  await noOverflow(page, 'desktop city command');\n  await page.evaluate(() => scrollTo(0, 0));\n  await page.screenshot({ path: path.join(artifacts, 'strategy-desktop.png') });\n  await assertGallery(page, desktop.requests, { allScenes: true });\n  await desktop.context.close();\n\n  for (const width of [390, 320]) {\n",
          "baseline": "  await noOverflow(page, 'desktop city command');\n  await page.evaluate(() => scrollTo(0, 0));\n  await page.screenshot({ path: path.join(artifacts, 'strategy-desktop.png') });\n  await desktop.context.close();\n\n  for (const width of [390, 320]) {\n"
        },
        {
          "at": 26285,
          "current": "    const button = mobile.page.locator('[data-strategy-district=\"canal\"]');\n    await button.click();\n    await assertDistrict(mobile.page, chosen);\n    await assertDashboard(mobile.page, mobile.me, board);\n    await assertCameraDisabled(mobile.page);\n    await noOverflow(mobile.page, `${width}px expanded command map`);\n    if (width === 390) await stage.screenshot({ path: path.join(artifacts, 'strategy-mobile-expanded.png') });\n    await assertGallery(mobile.page, mobile.requests, { label: `${width}px mobile` });\n    assert.ok(mobile.requests.filter(request => request.method === 'GET' && request.path === '/v1/map').length <= 1, 'expanding the mobile map uses a single read');\n    await mobile.context.close();\n  }\n",
          "baseline": "    const button = mobile.page.locator('[data-strategy-district=\"canal\"]');\n    await button.click();\n    await assertDistrict(mobile.page, chosen);\n    await assertCameraDisabled(mobile.page);\n    await noOverflow(mobile.page, `${width}px expanded command map`);\n    if (width === 390) await stage.screenshot({ path: path.join(artifacts, 'strategy-mobile-expanded.png') });\n    assert.ok(mobile.requests.filter(request => request.method === 'GET' && request.path === '/v1/map').length <= 1, 'expanding the mobile map uses a single read');\n    await mobile.context.close();\n  }\n"
        },
        {
          "at": 28006,
          "current": "  await noOverflow(fallback.page, 'renderer failure fallback');\n  await fallback.context.close();\n  assert.deepEqual(faults, [], 'map rendering and fallback introduce no unhandled browser errors');\n  console.log('strategy-command-browser: PASS (live resources and districts, tactile clicks, map/gallery keyboard navigation, opt-in ambience, bounded reads, desktop orders, 320/390px disclosures and galleries, Three.js camera controls and bundle-failure fallback)');\n  console.log(`Screenshots: ${artifacts}`);\n} catch (error) {\n  if (activePage && !activePage.isClosed()) {\n",
          "baseline": "  await noOverflow(fallback.page, 'renderer failure fallback');\n  await fallback.context.close();\n  assert.deepEqual(faults, [], 'map rendering and fallback introduce no unhandled browser errors');\n  console.log('strategy-command-browser: PASS (live districts, tactile clicks, modes, keyboard focus, bounded reads, desktop orders, 320/390px disclosures, Three.js camera controls and bundle-failure fallback)');\n  console.log(`Screenshots: ${artifacts}`);\n} catch (error) {\n  if (activePage && !activePage.isClosed()) {\n"
        }
      ]
    },
    "test/ui-trim-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "facf8403080eec2811d64e3f39c69a50b81d2e08",
        "sha256": "18294434af12ca337c139e3248e86b7ccec3ddfdb7f5eeebc55dcd2a5fe75498",
        "bytes": 11740
      },
      "baseline": {
        "mode": "100644",
        "blob": "550e5118db78a7884d7560e9289c45076cf73c79",
        "sha256": "95f63b4dc5263e92bf29d4751f25b10420dfb8ae92a68d18bc7899ccd09b1460",
        "bytes": 10877
      },
      "inverses": [
        {
          "at": 0,
          "current": "// Whole current source qualifies before the immutable historical comparison is reconstructed.\nimport './grand-strategy-source-transfer.js';\nimport { grandStrategyHistoricalRecord } from '../tools/grand-strategy-source-transfer.js';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport { createHash } from 'node:crypto';\n",
          "baseline": "// Whole current source qualifies before the immutable historical comparison is reconstructed.\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport { createHash } from 'node:crypto';\n"
        },
        {
          "at": 4365,
          "current": "for (const file of generated) assert(!Object.hasOwn(source.files, file) && !Object.hasOwn(source.additions, file),\n  'Generated metadata cannot inherit a historical source proof');\nfunction actual(file, pin) {\n  let committed = Buffer.from(git('show', 'HEAD:' + file));\n  const authored = Buffer.from(git('show', source.revision + ':' + file));\n  const stat = fs.lstatSync(file); let physical = fs.readFileSync(file);\n  let headEntry = git('ls-tree', 'HEAD', '--', file).trim();\n  let index = git('ls-files', '--stage', '--', file).trim();\n  const match = headEntry.match(/^(100644|100755) blob ([a-f0-9]{40})\\t(.+)$/);\n  assert(match && match[3] === file);\n  assert.equal(blob(committed), match[2]);\n  assert.equal(index, match[1] + ' ' + match[2] + ' 0\\t' + file);\n  assert(stat.isFile() && !stat.isSymbolicLink());\n  assert(physical.equals(committed) || physical.equals(Buffer.from(committed.toString('utf8').replaceAll('\\n', '\\r\\n'))));\n  const historical = grandStrategyHistoricalRecord(file, { head: { mode: match[1], blob: match[2] }, index, committed, physical,\n    regular: stat.isFile(), symbolic: stat.isSymbolicLink() });\n  ({ committed, physical, index } = historical);\n  headEntry = historical.head.mode + ' blob ' + historical.head.blob + '\\t' + file;\n  assert(headEntry === `${pin.mode} blob ${pin.blob}\\t${file}` && index === `${pin.mode} ${pin.blob} 0\\t${file}`,\n    'Complete current HEAD and stage-zero identities: ' + file);\n  assert(committed.equals(authored), 'Actual source remains the exact reviewed authored source: ' + file);\n",
          "baseline": "for (const file of generated) assert(!Object.hasOwn(source.files, file) && !Object.hasOwn(source.additions, file),\n  'Generated metadata cannot inherit a historical source proof');\nfunction actual(file, pin) {\n  const committed = Buffer.from(git('show', 'HEAD:' + file));\n  const authored = Buffer.from(git('show', source.revision + ':' + file));\n  const stat = fs.lstatSync(file), physical = fs.readFileSync(file);\n  const headEntry = git('ls-tree', 'HEAD', '--', file).trim();\n  const index = git('ls-files', '--stage', '--', file).trim();\n  assert(headEntry === `${pin.mode} blob ${pin.blob}\\t${file}` && index === `${pin.mode} ${pin.blob} 0\\t${file}`,\n    'Complete current HEAD and stage-zero identities: ' + file);\n  assert(committed.equals(authored), 'Actual source remains the exact reviewed authored source: ' + file);\n"
        }
      ]
    },
    "tools/ui-trim-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "a814a76a020f76e01fff3091db58a43041206199",
        "sha256": "90d0ef945722b81c3faa5136d82f36c6f1cd45d8fd314c9eeb0bf0b25a9e07cc",
        "bytes": 6183
      },
      "baseline": {
        "mode": "100644",
        "blob": "9c945ce955466a74c77d75129db74d050117400d",
        "sha256": "546b1b133304d2e211ff46f27c23ea0724f073292ef5dd0ef43a545a31e26abe",
        "bytes": 5870
      },
      "inverses": [
        {
          "at": 93,
          "current": "import assert from 'node:assert/strict';\nimport { createHash } from 'node:crypto';\nimport { UI_TRIM_SOURCE, UI_TRIM_SOURCE_SHA256 } from './ui-trim-source-data.js';\nimport { grandStrategyHistoricalInput, grandStrategyHistoricalEntry, grandStrategyHistoricalRecord } from './grand-strategy-source-transfer.js';\n\nexport { UI_TRIM_SOURCE };\nconst sha = input => createHash('sha256').update(input).digest('hex');\n",
          "baseline": "import assert from 'node:assert/strict';\nimport { createHash } from 'node:crypto';\nimport { UI_TRIM_SOURCE, UI_TRIM_SOURCE_SHA256 } from './ui-trim-source-data.js';\n\nexport { UI_TRIM_SOURCE };\nconst sha = input => createHash('sha256').update(input).digest('hex');\n"
        },
        {
          "at": 3706,
          "current": "}\n// Unknown bytes pass unchanged to the original rejecting qualifier.\nexport function uiTrimHistoricalInput(file, input) {\n  input = grandStrategyHistoricalInput(file, input);\n  if (!known(file)) return input;\n  const current = canonical(input);\n  if (!current || sha(current.lf) !== UI_TRIM_SOURCE.files[file].current.sha256) return input;\n",
          "baseline": "}\n// Unknown bytes pass unchanged to the original rejecting qualifier.\nexport function uiTrimHistoricalInput(file, input) {\n  if (!known(file)) return input;\n  const current = canonical(input);\n  if (!current || sha(current.lf) !== UI_TRIM_SOURCE.files[file].current.sha256) return input;\n"
        },
        {
          "at": 4114,
          "current": "  return current.buffer ? Buffer.from(baseline) : baseline;\n}\nexport function uiTrimHistoricalEntry(file, input, kind) {\n  input = grandStrategyHistoricalEntry(file, input, kind);\n  assert(kind === 'tree' || kind === 'index');\n  if (!known(file)) return input;\n  const row = UI_TRIM_SOURCE.files[file], expected = entry(file, row.current, kind);\n",
          "baseline": "  return current.buffer ? Buffer.from(baseline) : baseline;\n}\nexport function uiTrimHistoricalEntry(file, input, kind) {\n  assert(kind === 'tree' || kind === 'index');\n  if (!known(file)) return input;\n  const row = UI_TRIM_SOURCE.files[file], expected = entry(file, row.current, kind);\n"
        },
        {
          "at": 4712,
          "current": "// No runtime loader or actual-current native capture imports this record view.\nexport function uiTrimHistoricalRecord(file, actual) {\n  assert.equal(arguments.length, 2);\n  actual = grandStrategyHistoricalRecord(file, actual);\n  if (!known(file)) return actual;\n  definition();\n  assert.deepEqual(Object.keys(actual).sort(), ['head', 'index', 'committed', 'physical', 'regular', 'symbolic'].sort());\n",
          "baseline": "// No runtime loader or actual-current native capture imports this record view.\nexport function uiTrimHistoricalRecord(file, actual) {\n  assert.equal(arguments.length, 2);\n  if (!known(file)) return actual;\n  definition();\n  assert.deepEqual(Object.keys(actual).sort(), ['head', 'index', 'committed', 'physical', 'regular', 'symbolic'].sort());\n"
        }
      ]
    }
  },
  "additions": {
    "public/art/grand-strategy/city-atlas.mp4": {
      "mode": "100644",
      "blob": "a34a9b6a619234f67e9edf3e09b75b29e48850af",
      "sha256": "3640d9ea35f9feb69c3b42e4580e013ac71e238a79fb97157e15ca6bd415869c",
      "bytes": 4157071,
      "text": false
    },
    "public/art/grand-strategy/city-atlas.webp": {
      "mode": "100644",
      "blob": "86e9c12a4abc995d53de638db7c0086fec1c43f9",
      "sha256": "67a2809222905519ae8dc049298b6c3ccd36839517e652115dc15fd3a9a6f4b0",
      "bytes": 360106,
      "text": false
    },
    "public/art/grand-strategy/city-seal.webp": {
      "mode": "100644",
      "blob": "9a3ac1b8eb2aabfa85d858056a4087bd77cfd817",
      "sha256": "bc26a1ce29e79ca8d00b1141f0a7f24c6a26c1beca416dba21cb8d3d665bfb31",
      "bytes": 14422,
      "text": false
    },
    "public/art/grand-strategy/council-chamber.mp4": {
      "mode": "100644",
      "blob": "1463211a32596a5e63d4bab113d36d6211e8b16a",
      "sha256": "f2a792e567ea4202e1a54066cd6b891daf32424712141b2b4e57f9ae28d2a03d",
      "bytes": 6083558,
      "text": false
    },
    "public/art/grand-strategy/council-chamber.webp": {
      "mode": "100644",
      "blob": "bc16acc1bb313ecd284f73bd8202918d60cbe385",
      "sha256": "d276da87aaea8688af16129ae26dc562151a11942d730dedf5b261cf0583023e",
      "bytes": 391170,
      "text": false
    },
    "public/art/grand-strategy/district-brick.mp4": {
      "mode": "100644",
      "blob": "e5532b38a3ba236e258f3c48bc9e0876a0279c28",
      "sha256": "a7b7e95a6f417497b3d7dba664903a89f60c247050eb90b04c018656060d0e03",
      "bytes": 4454634,
      "text": false
    },
    "public/art/grand-strategy/district-brick.webp": {
      "mode": "100644",
      "blob": "b21b47aefa880caf7ca092e7f8b4a68f4fc3fb22",
      "sha256": "35f2e473dca367a9e6c36ed1cabefb36dece72d8c2c9255fb5768c6bc05040db",
      "bytes": 403112,
      "text": false
    },
    "public/art/grand-strategy/district-canal.mp4": {
      "mode": "100644",
      "blob": "042581a314aa160b29f29a3a52df4cad4ec72de7",
      "sha256": "db9721e8021ac425761c4bc22468b3a528a09d157e17631fbdeeb4d17bfcc9df",
      "bytes": 4271654,
      "text": false
    },
    "public/art/grand-strategy/district-canal.webp": {
      "mode": "100644",
      "blob": "9946e4fdffefb76f9942202dd0861123d0eed3d9",
      "sha256": "c9feb9c14cf8862e63c349a086503c6a30353611a1d4e82d6f34e33bcf052973",
      "bytes": 385794,
      "text": false
    },
    "public/art/grand-strategy/district-cathedral.mp4": {
      "mode": "100644",
      "blob": "d5a9c6f308ca9eff0dd2b186600a99223e58473a",
      "sha256": "466731def4c20fb53ccd0eabaeb5632267b73154387070c575be9477725771db",
      "bytes": 4033045,
      "text": false
    },
    "public/art/grand-strategy/district-cathedral.webp": {
      "mode": "100644",
      "blob": "b10f10491aad52d2da26bc1438e599039bbe52aa",
      "sha256": "083d00650dbb6827f538e69aee1793473611b549152eaa26045676ef5e11563a",
      "bytes": 352760,
      "text": false
    },
    "public/art/grand-strategy/district-docks.mp4": {
      "mode": "100644",
      "blob": "21be30bd6d34ab96f8d9d5ebfb9cc7d982643ee2",
      "sha256": "961beff3a5daff61749f41356e60de1ce248a039e85ec89138408920687d3dad",
      "bytes": 5086122,
      "text": false
    },
    "public/art/grand-strategy/district-docks.webp": {
      "mode": "100644",
      "blob": "a1d04dbd13a0dd88ffbcd8d3e542d88db1f5164d",
      "sha256": "686e79e738ae3510f0c5480eb3c7fb49020ad9f4708cf92f04910a5e0bc1b7b6",
      "bytes": 395538,
      "text": false
    },
    "public/art/grand-strategy/district-foundry.mp4": {
      "mode": "100644",
      "blob": "452da98c7e964369ca1e3840085d920de87c7508",
      "sha256": "72ea8035645e2f1af27e93cd2c299e47e6cf8e4a11b663728f841c06c1d76959",
      "bytes": 2729442,
      "text": false
    },
    "public/art/grand-strategy/district-foundry.webp": {
      "mode": "100644",
      "blob": "1a0ab01e2e86bb109b050d8fa3499997e203deed",
      "sha256": "7f9b51dbc9e24849bead58c4ba1ac9d9b50e56acd28282b88920e9bafffb1a89",
      "bytes": 393250,
      "text": false
    },
    "public/art/grand-strategy/district-neon.mp4": {
      "mode": "100644",
      "blob": "dae2eb5da84bbd9007799667ec0eca98ddf659e2",
      "sha256": "81ac80612679e9ac02efd56a51ba04ea24bec3d1067ab581871e2ba36512768d",
      "bytes": 2927060,
      "text": false
    },
    "public/art/grand-strategy/district-neon.webp": {
      "mode": "100644",
      "blob": "8fe5d1bf7db3215cd9369abf9ba89e8ebef878cf",
      "sha256": "ab031ba8505037734194e44d720238c67aef504d158e74c21380aa353c293cdd",
      "bytes": 280456,
      "text": false
    },
    "public/art/grand-strategy/motion/city-atlas-ambient.mp4": {
      "mode": "100644",
      "blob": "a34a9b6a619234f67e9edf3e09b75b29e48850af",
      "sha256": "3640d9ea35f9feb69c3b42e4580e013ac71e238a79fb97157e15ca6bd415869c",
      "bytes": 4157071,
      "text": false
    },
    "public/art/grand-strategy/motion/city-atlas-cinematic-take2.mp4": {
      "mode": "100644",
      "blob": "6976a26bf61d961a39cdac4ec82b060e141213d2",
      "sha256": "99952a55ae2487db6f547e032f6ed3d79a577b52e4b594ce037e606eba6eaf67",
      "bytes": 3697744,
      "text": false
    },
    "public/art/grand-strategy/motion/city-atlas-cinematic.mp4": {
      "mode": "100644",
      "blob": "aa07bfdafb98387ce8a9e0667af2da499ba6bdbd",
      "sha256": "d586b07c6ead5d5def0e0efe4b6d110ec73eb6a48cd17f65cbceadf8543beb99",
      "bytes": 3084158,
      "text": false
    },
    "public/art/grand-strategy/motion/city-atlas-dawn.mp4": {
      "mode": "100644",
      "blob": "7a08943d4da0fe5679b62cf89546f93285e72980",
      "sha256": "8414983451ae58f61c418de71661d9368af450c9e57661f02fb303f1a2335a3e",
      "bytes": 4594870,
      "text": false
    },
    "public/art/grand-strategy/motion/city-atlas-h3.mp4": {
      "mode": "100644",
      "blob": "b862a50fb0b6b4603ccb690acc25612f80124145",
      "sha256": "2afa991322ba04402d6d2c0da15eddad588038f5bdccfabaac506747817dc4bb",
      "bytes": 3764651,
      "text": false
    },
    "public/art/grand-strategy/motion/city-atlas-mist.mp4": {
      "mode": "100644",
      "blob": "3f52cc7cf6f2272991ca5fe57177dda1eff359dd",
      "sha256": "bd4ce867f6fa12a413fa3e67b0c294ae1e3b0d97a5befb234129c7b83c162f17",
      "bytes": 3631620,
      "text": false
    },
    "public/art/grand-strategy/motion/city-atlas-night.mp4": {
      "mode": "100644",
      "blob": "c15f24e8be2a3bbb68b6df94c364a019d0110433",
      "sha256": "ac82cba6e5b6e7a93045817eb720f99b1546a14c9576c5260708ec01ad0142c8",
      "bytes": 3396265,
      "text": false
    },
    "public/art/grand-strategy/motion/city-atlas-rain.mp4": {
      "mode": "100644",
      "blob": "4953cb9e4e6f8f5f69add9ef2f730ee45b11e67d",
      "sha256": "1c8ec8dc21a0703bed8331b9066824107d65966b60ea51983d4ad70d15685c05",
      "bytes": 4568383,
      "text": false
    },
    "public/art/grand-strategy/motion/city-atlas-snow.mp4": {
      "mode": "100644",
      "blob": "388a9d0b8874a82621d48bc55743f4ae45da4609",
      "sha256": "f2499a1c15f49e102b992b8f05aead44c5e9bd08617e606d9afe81471187efc8",
      "bytes": 7464915,
      "text": false
    },
    "public/art/grand-strategy/motion/city-atlas-streetlife.mp4": {
      "mode": "100644",
      "blob": "573d3600035278dc028bcce67a528f4ea9e78746",
      "sha256": "81c22d6bb6ae4f9cee81f30563ecd82d787081bbe6a5f1566a291e9df5f2cb6e",
      "bytes": 4214134,
      "text": false
    },
    "public/art/grand-strategy/motion/council-chamber-ambient.mp4": {
      "mode": "100644",
      "blob": "1463211a32596a5e63d4bab113d36d6211e8b16a",
      "sha256": "f2a792e567ea4202e1a54066cd6b891daf32424712141b2b4e57f9ae28d2a03d",
      "bytes": 6083558,
      "text": false
    },
    "public/art/grand-strategy/motion/council-chamber-cinematic.mp4": {
      "mode": "100644",
      "blob": "4ec4dc789a36b4c0dc6f9a6a04f1447144f31007",
      "sha256": "821ed3fb3f55c4df5bd4d6b5e3a0d936346924dbc765843910004345bb554432",
      "bytes": 4110812,
      "text": false
    },
    "public/art/grand-strategy/motion/council-chamber-dawn.mp4": {
      "mode": "100644",
      "blob": "0140bc1e2308e7d3903e399cf249368e6f175c04",
      "sha256": "1b2680e800b50ba71cf02bdb19782784a8f91f200cd55f4928b0361972b6325c",
      "bytes": 4322046,
      "text": false
    },
    "public/art/grand-strategy/motion/council-chamber-h3.mp4": {
      "mode": "100644",
      "blob": "e00f6a7d4e676655d84b83362e2d3ca7d49d1363",
      "sha256": "a97a1729b224cdeb3e4a70eff0b15e407e2a17fed7f1e9d3fd9eed7c2ae7a900",
      "bytes": 3673349,
      "text": false
    },
    "public/art/grand-strategy/motion/council-chamber-mist.mp4": {
      "mode": "100644",
      "blob": "8a82e4f29da096f33da5834c57988e5da568032a",
      "sha256": "ee4485f36652e8a2e49fd5e3e45086e3c8747cea4cfd81dcea6e50d6f328244b",
      "bytes": 4522516,
      "text": false
    },
    "public/art/grand-strategy/motion/council-chamber-night.mp4": {
      "mode": "100644",
      "blob": "74c114e170c53b12160c7be2750a077be8a3b860",
      "sha256": "85cec0f624663a816f9ab1dcbc129dc1635f3a384ef3b0868c19c95471d1f107",
      "bytes": 3917300,
      "text": false
    },
    "public/art/grand-strategy/motion/council-chamber-rain.mp4": {
      "mode": "100644",
      "blob": "8f91adb3ea447221201a4a018d36954b5de77c00",
      "sha256": "d4e0df6fa4ff4303c2b1f91ddee916b3b06fc257a43d1fae9c1bc999b556f1e0",
      "bytes": 5007709,
      "text": false
    },
    "public/art/grand-strategy/motion/council-chamber-snow.mp4": {
      "mode": "100644",
      "blob": "979afbaed26454bb31de76f39faa7434da8c3b98",
      "sha256": "c3306a27c2543ee5e0703336a446bdf8949eaa8c7642e1f06d8358aaa3290db8",
      "bytes": 6282556,
      "text": false
    },
    "public/art/grand-strategy/motion/council-chamber-streetlife.mp4": {
      "mode": "100644",
      "blob": "98aa6906dc4c85964cf68d2bb26355d470c74afa",
      "sha256": "8f64896d2764b1188b03fa2f8131204fc2734d45ba62c5f8e1297c846526f4fb",
      "bytes": 4208565,
      "text": false
    },
    "public/art/grand-strategy/motion/district-brick-ambient.mp4": {
      "mode": "100644",
      "blob": "e5532b38a3ba236e258f3c48bc9e0876a0279c28",
      "sha256": "a7b7e95a6f417497b3d7dba664903a89f60c247050eb90b04c018656060d0e03",
      "bytes": 4454634,
      "text": false
    },
    "public/art/grand-strategy/motion/district-brick-cinematic.mp4": {
      "mode": "100644",
      "blob": "9e63f673893b01089e89fe8383b7ae58d01ab934",
      "sha256": "51df345822a8cb46a59fc67147f48557031d870bb170a07ff0d9fed36a75242f",
      "bytes": 5551173,
      "text": false
    },
    "public/art/grand-strategy/motion/district-brick-dawn.mp4": {
      "mode": "100644",
      "blob": "b2085a4a018519f2a26a39aa5ceac8faf6379406",
      "sha256": "950b76bac105d424659e5b4ad89083b8541d79a869c006596fdeaab6f1dd9b18",
      "bytes": 5088730,
      "text": false
    },
    "public/art/grand-strategy/motion/district-brick-h3.mp4": {
      "mode": "100644",
      "blob": "e2ef8902b79a26a854a3d30fbd87c9b92f5c9d6d",
      "sha256": "d16a3c9b52cca1a8f5069db571cc8f549ada3ad78004875bcccb10206050c44b",
      "bytes": 3894830,
      "text": false
    },
    "public/art/grand-strategy/motion/district-brick-mist.mp4": {
      "mode": "100644",
      "blob": "59c11341047d74f78440ec250d6bba5875bfdae3",
      "sha256": "d10e8862c644a1f26c00520eae94ff47753221edb177a03e3d65f91339677af6",
      "bytes": 4476198,
      "text": false
    },
    "public/art/grand-strategy/motion/district-brick-night.mp4": {
      "mode": "100644",
      "blob": "19cdafd26aca1ab7b7dde910ee0ffc01ce1df69e",
      "sha256": "13357cd00fcdbbedbbafc7f7bc010437e7e3a6f3e9a36f579460978dc815e61e",
      "bytes": 4312450,
      "text": false
    },
    "public/art/grand-strategy/motion/district-brick-rain.mp4": {
      "mode": "100644",
      "blob": "bc839bd88663a77c5b2c72c67c6b55b31c2eceb3",
      "sha256": "d81591f2ff74eb95b26233209a442a5f170bb63a793356b720b0b0506bc23930",
      "bytes": 4794123,
      "text": false
    },
    "public/art/grand-strategy/motion/district-brick-snow.mp4": {
      "mode": "100644",
      "blob": "eabbb0858e7de9c533c0861e8fddefd4eccf55ee",
      "sha256": "35ae92c2b868b40317c39ad6ac9ad8de7a98fa848054f4c68d284afbcf5b66fb",
      "bytes": 5310186,
      "text": false
    },
    "public/art/grand-strategy/motion/district-brick-streetlife.mp4": {
      "mode": "100644",
      "blob": "975a016d0d2ca76dbc5980d4949fa2f309c62f56",
      "sha256": "52fcc55bd84bbe2beb1545e2563fe2970eb5404558817de8ea286c681c73a11a",
      "bytes": 4730679,
      "text": false
    },
    "public/art/grand-strategy/motion/district-canal-ambient.mp4": {
      "mode": "100644",
      "blob": "042581a314aa160b29f29a3a52df4cad4ec72de7",
      "sha256": "db9721e8021ac425761c4bc22468b3a528a09d157e17631fbdeeb4d17bfcc9df",
      "bytes": 4271654,
      "text": false
    },
    "public/art/grand-strategy/motion/district-canal-cinematic.mp4": {
      "mode": "100644",
      "blob": "1b2330221fcd16e93fc02f795172881d9b7495d8",
      "sha256": "58c7b603012d8cc7f51854fb119166fa057ae09b323d7a2930520f8a34914c1b",
      "bytes": 5753691,
      "text": false
    },
    "public/art/grand-strategy/motion/district-canal-dawn.mp4": {
      "mode": "100644",
      "blob": "d398d22d5de047c3ad1d710f2ae6fd5ba071cf2c",
      "sha256": "c99c7511abed5eaa0b55c808ad078a18508f2e7a6491b61a51543139e0de2240",
      "bytes": 5429923,
      "text": false
    },
    "public/art/grand-strategy/motion/district-canal-h3.mp4": {
      "mode": "100644",
      "blob": "7abca75144e346c56f6bd879fb23ba744c8ffb03",
      "sha256": "101b6e4319c823185ecedc45d7f3e7374ce0af09e40142e815cfe9afed54a3a3",
      "bytes": 4304543,
      "text": false
    },
    "public/art/grand-strategy/motion/district-canal-mist.mp4": {
      "mode": "100644",
      "blob": "3aa29f7ec96e06943fa1acb9d5960d07fee37e03",
      "sha256": "9f2e241a5da78e4bdbec891668c9ab2c0fa9cb985067a7e729d8c4d7cf731af1",
      "bytes": 4537555,
      "text": false
    },
    "public/art/grand-strategy/motion/district-canal-night.mp4": {
      "mode": "100644",
      "blob": "f42caaa93ee78de28e281d65388e8f52f0cfc750",
      "sha256": "9911ab4348a7eacbf2b34746ca646157a971a595e9ab981d13f783311e779d11",
      "bytes": 4494131,
      "text": false
    },
    "public/art/grand-strategy/motion/district-canal-rain.mp4": {
      "mode": "100644",
      "blob": "2db2684791475597190cff5d3712a38a7880b4a1",
      "sha256": "44769683bed5e88067964792ddceceef420ff09935e71092e6db0651db97c6b6",
      "bytes": 4993681,
      "text": false
    },
    "public/art/grand-strategy/motion/district-canal-snow.mp4": {
      "mode": "100644",
      "blob": "105c55db5b5803f752ea15680b1754fd2802529e",
      "sha256": "6ff8b61b029aba77946d60142c2f450f5217047019c0b71a315b36635f69715b",
      "bytes": 6541468,
      "text": false
    },
    "public/art/grand-strategy/motion/district-canal-streetlife.mp4": {
      "mode": "100644",
      "blob": "4d489521c004dd700f3c890c38691944feb368fe",
      "sha256": "1c6ebe96cc3e95b19e580c7cb3f9a40774c2918e3f1d3042161bafbf4fa89c75",
      "bytes": 4294784,
      "text": false
    },
    "public/art/grand-strategy/motion/district-cathedral-ambient.mp4": {
      "mode": "100644",
      "blob": "d5a9c6f308ca9eff0dd2b186600a99223e58473a",
      "sha256": "466731def4c20fb53ccd0eabaeb5632267b73154387070c575be9477725771db",
      "bytes": 4033045,
      "text": false
    },
    "public/art/grand-strategy/motion/district-cathedral-cinematic.mp4": {
      "mode": "100644",
      "blob": "ec11e66e3da6378de6c74582757b2c6aababb5f6",
      "sha256": "d56bc19b1daf9257a9b5eecb3c797c1baf48409485f90736e1996ed83bdaf741",
      "bytes": 3958264,
      "text": false
    },
    "public/art/grand-strategy/motion/district-cathedral-dawn.mp4": {
      "mode": "100644",
      "blob": "d58c9b52c2d9b530344d22087e788c724f2de888",
      "sha256": "c45477101bb5d69332448ae361f90a45ddb6c0933ec35448e0fa1090aa3f22b3",
      "bytes": 3554639,
      "text": false
    },
    "public/art/grand-strategy/motion/district-cathedral-h3.mp4": {
      "mode": "100644",
      "blob": "9ced237dee6b2f12c209e5dc6bd1fcb544d53a0f",
      "sha256": "aa0efb73b9d5d3b03168ca4babc301cbf44e9a1791afc3d57ce5a8b0cb8b5b03",
      "bytes": 3904832,
      "text": false
    },
    "public/art/grand-strategy/motion/district-cathedral-mist.mp4": {
      "mode": "100644",
      "blob": "fee47dadef69c398bac3265b3ac5cfe553f2e316",
      "sha256": "87d2961301dc3c798848a09edb54e6985900a5097ac6d1adc054add12cfb08d7",
      "bytes": 3921074,
      "text": false
    },
    "public/art/grand-strategy/motion/district-cathedral-night.mp4": {
      "mode": "100644",
      "blob": "e3a6c1eb7121b7e8915744dfb0ca9024465c3e18",
      "sha256": "bf0c42c80cd7736452b4415fb3d82d4052681389d87913bb6e95d2372a3305e0",
      "bytes": 3382334,
      "text": false
    },
    "public/art/grand-strategy/motion/district-cathedral-rain.mp4": {
      "mode": "100644",
      "blob": "205b91fe5feebf5c9040dcd837324e2ebb581526",
      "sha256": "884010f2fbc997dcbd4a87feaaa3c0b21f96cc74785b5a435068f18ac5931b41",
      "bytes": 3881113,
      "text": false
    },
    "public/art/grand-strategy/motion/district-cathedral-snow.mp4": {
      "mode": "100644",
      "blob": "3353bf94014a3fda95af13e4e820ad4bd708be11",
      "sha256": "cfa36909422d25cecb9fc825a7f5c1f5ebd20660f78fe4a43d1360715f38fb1f",
      "bytes": 5173853,
      "text": false
    },
    "public/art/grand-strategy/motion/district-cathedral-streetlife.mp4": {
      "mode": "100644",
      "blob": "83424e5bd6d67034bf2884d8bea910344ce29c88",
      "sha256": "efd6967f94507f12cc3e064af02d4d4a1acd89f00ff8225838faeb3f1551d276",
      "bytes": 2868759,
      "text": false
    },
    "public/art/grand-strategy/motion/district-docks-ambient.mp4": {
      "mode": "100644",
      "blob": "21be30bd6d34ab96f8d9d5ebfb9cc7d982643ee2",
      "sha256": "961beff3a5daff61749f41356e60de1ce248a039e85ec89138408920687d3dad",
      "bytes": 5086122,
      "text": false
    },
    "public/art/grand-strategy/motion/district-docks-cinematic.mp4": {
      "mode": "100644",
      "blob": "ac01d603860527ff3205e1e1b62e2b19f706382c",
      "sha256": "76e53b0a7d3d49c689de4516f31aedbb565ac3029d5b9c76907ada9731de5252",
      "bytes": 4802836,
      "text": false
    },
    "public/art/grand-strategy/motion/district-docks-dawn.mp4": {
      "mode": "100644",
      "blob": "af9323b898b6abed3866df31cf3c5cc2b86689d6",
      "sha256": "1c39cd7a3e59f84ff3254660e6afe9b486f956d506015d0b8959abc4c146270f",
      "bytes": 6796940,
      "text": false
    },
    "public/art/grand-strategy/motion/district-docks-h3.mp4": {
      "mode": "100644",
      "blob": "3420a8fa828efb863d931d8bf896b79203173697",
      "sha256": "e3e5ce5753042eb19959b9528d5bc7db0d146ccfa802673ebcd7b72b4ed5eccb",
      "bytes": 5105361,
      "text": false
    },
    "public/art/grand-strategy/motion/district-docks-mist.mp4": {
      "mode": "100644",
      "blob": "cc4ec4f11e4f0752b73cf03de98c575d1db6c172",
      "sha256": "b3814848346b7a0f91f85fdae9d08d62b332c8ea22c7c3582a46b04b188bc6e2",
      "bytes": 5222371,
      "text": false
    },
    "public/art/grand-strategy/motion/district-docks-night.mp4": {
      "mode": "100644",
      "blob": "9152d582a1db552762ce03a32871c39675026390",
      "sha256": "fe792f69a05d5d81992f56cc2b3bf72075867b5dc85f2052d583ea9c3912ea0b",
      "bytes": 4589070,
      "text": false
    },
    "public/art/grand-strategy/motion/district-docks-rain.mp4": {
      "mode": "100644",
      "blob": "0cd51da5888e28a3ffaf10c9c8060386166e5660",
      "sha256": "0d064a47773ab6acada35a2b1fb384378ac4d78b1e29619200b6a2f0b30398aa",
      "bytes": 6213101,
      "text": false
    },
    "public/art/grand-strategy/motion/district-docks-snow.mp4": {
      "mode": "100644",
      "blob": "21376397143298a23705be214aaec2ba9e4b098d",
      "sha256": "90da673498abac607721184dd645acc2265bcb4adbb601035de201a2c03d86d5",
      "bytes": 9264562,
      "text": false
    },
    "public/art/grand-strategy/motion/district-docks-streetlife.mp4": {
      "mode": "100644",
      "blob": "2754452b6afbdaa4ac414bb1eddefca4d6577c85",
      "sha256": "18ed42ab353dc3fd27c17c0dd290264e0b4b7927f1ba4259b0129dfad1e7147c",
      "bytes": 4856095,
      "text": false
    },
    "public/art/grand-strategy/motion/district-foundry-ambient.mp4": {
      "mode": "100644",
      "blob": "452da98c7e964369ca1e3840085d920de87c7508",
      "sha256": "72ea8035645e2f1af27e93cd2c299e47e6cf8e4a11b663728f841c06c1d76959",
      "bytes": 2729442,
      "text": false
    },
    "public/art/grand-strategy/motion/district-foundry-cinematic.mp4": {
      "mode": "100644",
      "blob": "36808c6a4946a7202de158bb7498eaac3d834fc7",
      "sha256": "07913d1005dd9023af5093d4c3320ebc449c6199f00974095544f3bd0c2e19d7",
      "bytes": 4429453,
      "text": false
    },
    "public/art/grand-strategy/motion/district-foundry-dawn.mp4": {
      "mode": "100644",
      "blob": "8c8a5277eada3e13090ae9753f300a2730ea9ac2",
      "sha256": "08e630d3e4843220d1c11ab918775db6cfaea7348eb2bcdc415a83372b310066",
      "bytes": 5205663,
      "text": false
    },
    "public/art/grand-strategy/motion/district-foundry-h3.mp4": {
      "mode": "100644",
      "blob": "300d528897f5bd02376ee1550085f3434a16c831",
      "sha256": "2b48ff2db1fdab5ff7a9877b7d1e4478a24b69ab556af55a9b8e1086f20b8603",
      "bytes": 3661889,
      "text": false
    },
    "public/art/grand-strategy/motion/district-foundry-mist.mp4": {
      "mode": "100644",
      "blob": "c9ae158c50f13f06f2a1e978e66cbd918e61f79f",
      "sha256": "7d3311ba81982775eb3c686593a6d89f15bf84003921081bada8f8d8a9c5d295",
      "bytes": 3707104,
      "text": false
    },
    "public/art/grand-strategy/motion/district-foundry-night.mp4": {
      "mode": "100644",
      "blob": "1a7ad0742c9fcc093cb65ae9a0a57ac20c1507bf",
      "sha256": "d4983393618d607b3c7d9631ab47ff08eb6e004c0b1f3a3429e6da2dd0d146bf",
      "bytes": 4299332,
      "text": false
    },
    "public/art/grand-strategy/motion/district-foundry-rain.mp4": {
      "mode": "100644",
      "blob": "28627ba760a03ba4533da63519ea30f766b90c07",
      "sha256": "a72195ca4dfd9ce626bcbc2280bd9deef5b4a5b3779bd0bf37162f7ae3628efe",
      "bytes": 3763926,
      "text": false
    },
    "public/art/grand-strategy/motion/district-foundry-snow.mp4": {
      "mode": "100644",
      "blob": "fbd3144772c0ef9aff5ef03e0ec4db690bc94da6",
      "sha256": "741107649862c1e764579b889f01dca717cbe9532c000f189dd0774959dd8a1d",
      "bytes": 9571602,
      "text": false
    },
    "public/art/grand-strategy/motion/district-foundry-streetlife.mp4": {
      "mode": "100644",
      "blob": "e8ed07cf4579318d7015897b635005f8a021d5cc",
      "sha256": "b318acff2054c8f88d18cd15fcef2551c7704142fa01c1dd794820f7f3bc4103",
      "bytes": 5029747,
      "text": false
    },
    "public/art/grand-strategy/motion/district-neon-ambient.mp4": {
      "mode": "100644",
      "blob": "dae2eb5da84bbd9007799667ec0eca98ddf659e2",
      "sha256": "81ac80612679e9ac02efd56a51ba04ea24bec3d1067ab581871e2ba36512768d",
      "bytes": 2927060,
      "text": false
    },
    "public/art/grand-strategy/motion/district-neon-cinematic.mp4": {
      "mode": "100644",
      "blob": "bcea5af208b5a4692fc586a468de8ea7c959fb27",
      "sha256": "0f76fa7df7cc3b0a11d3508c6b1f55d9267c238185f9b7526b42b1960acc8409",
      "bytes": 3267134,
      "text": false
    },
    "public/art/grand-strategy/motion/district-neon-dawn.mp4": {
      "mode": "100644",
      "blob": "e9f7c0f59f7cf0f78f8f446bcbee87c13336845f",
      "sha256": "e4753e89dae975838235148cf6b655168355e8e95d79692b1dd50179c516979e",
      "bytes": 3183687,
      "text": false
    },
    "public/art/grand-strategy/motion/district-neon-h3.mp4": {
      "mode": "100644",
      "blob": "2b9d36ddae063bd72a18162d06313a2b7417a82b",
      "sha256": "fbef70e96d0f77381bbad8da6702c5c550037f49235c58e3c523c3b3ef560ce2",
      "bytes": 2764847,
      "text": false
    },
    "public/art/grand-strategy/motion/district-neon-mist.mp4": {
      "mode": "100644",
      "blob": "4c1b1adcacfb3e39e2e91e44fc651ebee0ebae26",
      "sha256": "3a4544410e3eb048ef7d4ff9a35e80e839195bfd0103b8b8295b589dfdea8fad",
      "bytes": 3088027,
      "text": false
    },
    "public/art/grand-strategy/motion/district-neon-night.mp4": {
      "mode": "100644",
      "blob": "7af06d04053860d645436a97130cdb4c1ed0fd85",
      "sha256": "37e2c926d3785ce89ab2d8cad32024ffdc3667b0d1c65f0aad569f2a2dd5efb0",
      "bytes": 2969896,
      "text": false
    },
    "public/art/grand-strategy/motion/district-neon-rain.mp4": {
      "mode": "100644",
      "blob": "fbe40d98996fca60cd90ff34a9a3b608de8276ad",
      "sha256": "acadae1cf742de938923d7c84f84918215d2ab5960b0dbb81afa5c0320bc4b21",
      "bytes": 2585295,
      "text": false
    },
    "public/art/grand-strategy/motion/district-neon-snow.mp4": {
      "mode": "100644",
      "blob": "564159dec3f7b627af71113c06e27480d64dab03",
      "sha256": "018fb06c2db3bef73b699b2be94df07489bf4c7cc70309ed06190ff1427bb4b0",
      "bytes": 6654002,
      "text": false
    },
    "public/art/grand-strategy/motion/district-neon-streetlife.mp4": {
      "mode": "100644",
      "blob": "9989fbd213d94ca8521646c28e4b343f339b85eb",
      "sha256": "6ebb7cbfd8f4e3b8fc95e3bac9388394aaa2a637280d155f8a823f47462fe797",
      "bytes": 2910758,
      "text": false
    },
    "public/art/grand-strategy/scene-library.json": {
      "mode": "100644",
      "blob": "a61279a4967678f842bb65cf6e42612249c62e38",
      "sha256": "551e96966c658dd7ddb36b542a3b1d389f9d12437aeca465ef0021628fc0b588",
      "bytes": 12005,
      "text": true
    },
    "public/strategy-atmosphere.css": {
      "mode": "100644",
      "blob": "018487b66dc82292e28c7aaef13b790bccef222b",
      "sha256": "24925293b16ae719b2c6559a8d697f18e631d279b561e18b2ba4fada0df6095e",
      "bytes": 5220,
      "text": true
    },
    "public/strategy-atmosphere.js": {
      "mode": "100644",
      "blob": "bf6ecd8a77a8e727f0ea1b2f06440ab44052571e",
      "sha256": "8f5c90865f8cd5ec6868f99f63b46071ad2e7c1d8d352fcf178849fa530f483c",
      "bytes": 10957,
      "text": true
    },
    "test/grand-strategy-source-transfer.js": {
      "mode": "100644",
      "blob": "e9dde3aeef0b44d2385d6d93d64121753fab8801",
      "sha256": "c026467571bb8218dc2db089786ef6962d2b9c56ffff23f7b93f1e6728febad8",
      "bytes": 11898,
      "text": true
    },
    "tools/grand-strategy-source-seal.js": {
      "mode": "100644",
      "blob": "c38fdd4aece97bfedd13782337a6da605dc775bc",
      "sha256": "bbb7e0398545cb1d92865ec8196039d54adb26baf2ed8bfa12091436965fa07d",
      "bytes": 4722,
      "text": true
    },
    "tools/grand-strategy-source-transfer.js": {
      "mode": "100644",
      "blob": "be2f992e6c2bbe38f688201605c06882315dad02",
      "sha256": "a0d2a9cc069d8a93e3bfb0eb9635c67c26d6a9d73bdc72873b75832603dcf42c",
      "bytes": 15257,
      "text": true
    }
  }
});
export const GRAND_STRATEGY_SOURCE_SHA256 = '1bc73878c1ffa0e8eac58bab54aff9b3d635bcf10ac97e2641f80a927dc6391f';
