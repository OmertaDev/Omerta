// Exact quest quality source comparison only; no runtime/native/financial/deployment results transferred.
const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const QUEST_QUALITY_SOURCE = freeze({
  "status": "SEALED",
  "phase": "EXACT_QUEST_QUALITY_SOURCE_COMPARISON_ONLY",
  "revision": "65b948457e4a85f026a3d2e2f3c034a00fc578b9",
  "tree": "dce401e6e9d0e5e5b8269ce70f56b3a2681ae454",
  "predecessor": "f649df7d0def8c1a9af0ae0a88193626f9127fa1",
  "predecessorTree": "873d4c2985beb4199b6d23dfd55c2f3621604842",
  "files": {
    "package.json": {
      "current": {
        "mode": "100644",
        "blob": "f76f66479445d035a26b51abc5df79cff5f876ec",
        "sha256": "7e59174bee74d11e2f98bf4ccc178282116b2e894b61c88bf0efea1201fbf483",
        "bytes": 63150
      },
      "baseline": {
        "mode": "100644",
        "blob": "cecff6f862ba0e996ee0b3f6dfee7141864d0e67",
        "sha256": "f376d7557e2da7ad25864796f0fb6771f6d82be9326f901edee4a34fc75c0c2c",
        "bytes": 62448
      },
      "inverses": [
        {
          "at": 60980,
          "current": "    \"test:economy-security\": \"node test/economy-monitor.js && node test/economy-composition.js\",\n    \"test:eth-rewards\": \"node test/marketv2abi.js && node test/marketv2keeper-eth.js && node test/eth-rewards-readiness.js && node test/eth-rewards-upkeep.js && node test/ethrewardsworker.js && node test/eth-staking.js\",\n    \"test:eth-staking:browser\": \"node test/eth-staking.js --browser\",\n    \"test:questing\": \"node test/content-narrative.js && node test/content-narrative-security.js && node test/content-casework.js && node test/quest-saga.js && node test/quest-saga-social.js && node test/quest-specialist.js && node test/quest-workshop.js && node test/clue-puzzles.js && node test/content-api.js && npm run test:quest-quality\",\n    \"test:questing:browser\": \"node test/quest-experience-browser.js && node test/clue-puzzles-browser.js && node test/quest-quality-browser.js\",\n    \"questing:check\": \"node tools/questing-content.js check && node tools/questing-workgraph.js check && node tools/quest-quality-workgraph.js check\",\n    \"test:questing:postgres\": \"node test/questing-postgres.js && node test/quest-quality-postgres.js\",\n    \"test:quest-quality\": \"node test/quest-quality-source-transfer.js && node test/quest-quality-rules.js && node test/quest-quality-stateful.js && node test/quest-quality-api.js && node test/quest-quality-runtime.js && node test/quest-quality-social.js && node test/quest-quality-spoilers.js && node test/quest-quality-content.js && node test/quest-quality-studio.js && node test/quest-quality-study.js\",\n    \"quest-quality:verify\": \"node tools/quest-quality-workgraph.js verify\",\n    \"quest-quality:studio\": \"node tools/quest-quality-studio.js\"\n  },\n  \"dependencies\": {\n    \"@fastify/jwt\": \"^10.2.0\",\n",
          "baseline": "    \"test:economy-security\": \"node test/economy-monitor.js && node test/economy-composition.js\",\n    \"test:eth-rewards\": \"node test/marketv2abi.js && node test/marketv2keeper-eth.js && node test/eth-rewards-readiness.js && node test/eth-rewards-upkeep.js && node test/ethrewardsworker.js && node test/eth-staking.js\",\n    \"test:eth-staking:browser\": \"node test/eth-staking.js --browser\",\n    \"test:questing\": \"node test/content-narrative.js && node test/content-narrative-security.js && node test/content-casework.js && node test/quest-saga.js && node test/quest-saga-social.js && node test/quest-specialist.js && node test/quest-workshop.js && node test/clue-puzzles.js && node test/content-api.js\",\n    \"test:questing:browser\": \"node test/quest-experience-browser.js && node test/clue-puzzles-browser.js\",\n    \"questing:check\": \"node tools/questing-content.js check && node tools/questing-workgraph.js check\",\n    \"test:questing:postgres\": \"node test/questing-postgres.js\"\n  },\n  \"dependencies\": {\n    \"@fastify/jwt\": \"^10.2.0\",\n"
        }
      ]
    },
    "public/index.html": {
      "current": {
        "mode": "100644",
        "blob": "2b6fd09d5503448d5c5ab6ed27fe6bc6e84ef2f7",
        "sha256": "aff38ac73de6f940d26fdde7d8cd9955eaa04849b4ea230b96dbc256ba4f6709",
        "bytes": 1408328
      },
      "baseline": {
        "mode": "100644",
        "blob": "65c5d7e86d401b760bd98022bb5f522b089dd785",
        "sha256": "244ef05efe9be5f2e9081d569868b1551402e7239a51d2c37bbab1378dc7c8ec",
        "bytes": 1407392
      },
      "inverses": [
        {
          "at": 106582,
          "current": "<link rel=\"stylesheet\" href=\"/ux-identity.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-story.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-quests.css?v=20261106-1\">\n<link rel=\"stylesheet\" href=\"/ux-quest-quality.css?v=20261107-1\">\n<link rel=\"stylesheet\" href=\"/ux-clues.css?v=20261106-1\">\n<link rel=\"stylesheet\" href=\"/ux-community.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-tactics.css?v=20261024-2\">\n",
          "baseline": "<link rel=\"stylesheet\" href=\"/ux-identity.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-story.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-quests.css?v=20261106-1\">\n<link rel=\"stylesheet\" href=\"/ux-clues.css?v=20261106-1\">\n<link rel=\"stylesheet\" href=\"/ux-community.css?v=20261025-1\">\n<link rel=\"stylesheet\" href=\"/ux-tactics.css?v=20261024-2\">\n"
        },
        {
          "at": 157636,
          "current": "<script src=\"/ux-tools.js?v=20261025-1\"></script>\n<script src=\"/ux-identity.js?v=20261025-1\"></script>\n<script src=\"/ux-story.js?v=20261025-1\"></script>\n<script src=\"/ux-quest-quality.js?v=20261107-1\"></script>\n<script src=\"/ux-quests.js?v=20261107-1\"></script>\n<script src=\"/ux-clues.js?v=20261106-1\"></script>\n<script src=\"/ux-community.js?v=20261025-1\"></script>\n<script src=\"/ux-tactics.js?v=20261105-noir-release\"></script>\n",
          "baseline": "<script src=\"/ux-tools.js?v=20261025-1\"></script>\n<script src=\"/ux-identity.js?v=20261025-1\"></script>\n<script src=\"/ux-story.js?v=20261025-1\"></script>\n<script src=\"/ux-quests.js?v=20261106-1\"></script>\n<script src=\"/ux-clues.js?v=20261106-1\"></script>\n<script src=\"/ux-community.js?v=20261025-1\"></script>\n<script src=\"/ux-tactics.js?v=20261105-noir-release\"></script>\n"
        },
        {
          "at": 240396,
          "current": "    if (Array.isArray(body?.claimed) && body.instance)\n      return `case record claimed: ${body.claimed.map((item) => txt(item.title || item.kind)).join(', ') || 'filed'}`;\n    if (body?.instance?.namespace && body.instance?.title) {\n      if (body.instance.quality) return `case file updated: ${txt(body.instance.title)}. Review your recorded changes in the investigation workbench.`;\n      if (body.instance.status === 'completed') return `case closed: ${txt(body.instance.title)}. Your ending is on the permanent record.`;\n      if (body.instance.status === 'active') return `case advanced: ${txt(body.instance.title)}. The next issued move is on the Desk.`;\n      return `party file updated: ${txt(body.instance.title)}. ${body.instance.members?.length || 1} seat${body.instance.members?.length === 1 ? '' : 's'} filled.`;\n",
          "baseline": "    if (Array.isArray(body?.claimed) && body.instance)\n      return `case record claimed: ${body.claimed.map((item) => txt(item.title || item.kind)).join(', ') || 'filed'}`;\n    if (body?.instance?.namespace && body.instance?.title) {\n      if (body.instance.status === 'completed') return `case closed: ${txt(body.instance.title)}. Your ending is on the permanent record.`;\n      if (body.instance.status === 'active') return `case advanced: ${txt(body.instance.title)}. The next issued move is on the Desk.`;\n      return `party file updated: ${txt(body.instance.title)}. ${body.instance.members?.length || 1} seat${body.instance.members?.length === 1 ? '' : 's'} filled.`;\n"
        },
        {
          "at": 711055,
          "current": "    </li>`).join('')}</ol>`;\n  }\n  function deskIssuedActions(instance) {\n    if (instance.quality && instance.status !== 'forming') return `<section class=\"desk-prompt\"><span class=\"desk-kicker\">Investigation workbench</span><h3>Review your reasoning before committing.</h3><p>Your private drafts, evidence and decision previews are in the case file below.</p><button class=\"act prime\" type=\"button\" data-desk-quality-case=\"${esc(instance.id)}\">Open investigation workbench</button></section>`;\n    const actions = deskList(instance.actions);\n    if (!actions.length) return instance.status === 'active'\n      ? `<div class=\"desk-empty desk-empty--compact\"><b>No move is issued to you.</b><span>Another party role may need to act before this file advances.</span></div>` : '';\n",
          "baseline": "    </li>`).join('')}</ol>`;\n  }\n  function deskIssuedActions(instance) {\n    const actions = deskList(instance.actions);\n    if (!actions.length) return instance.status === 'active'\n      ? `<div class=\"desk-empty desk-empty--compact\"><b>No move is issued to you.</b><span>Another party role may need to act before this file advances.</span></div>` : '';\n"
        },
        {
          "at": 737736,
          "current": "    const board = deskState.board;\n    if (!panel) return;\n    panel.querySelectorAll('[data-desk-reload]').forEach((button) => { button.onclick = () => reloadContentDesk(); });\n    panel.querySelectorAll('[data-desk-quality-case]').forEach((button) => {\n      button.onclick = () => document.dispatchEvent(new CustomEvent('omerta:quality-case', { detail: { instanceId: button.dataset.deskQualityCase } }));\n    });\n    panel.querySelectorAll('[data-desk-view]').forEach((button) => {\n      button.onclick = () => { deskState.view = button.dataset.deskView; drawContentDesk(); };\n    });\n",
          "baseline": "    const board = deskState.board;\n    if (!panel) return;\n    panel.querySelectorAll('[data-desk-reload]').forEach((button) => { button.onclick = () => reloadContentDesk(); });\n    panel.querySelectorAll('[data-desk-view]').forEach((button) => {\n      button.onclick = () => { deskState.view = button.dataset.deskView; drawContentDesk(); };\n    });\n"
        }
      ]
    },
    "public/ux-quests.js": {
      "current": {
        "mode": "100644",
        "blob": "c6bc58ed0c39b25dca9a0432937239a877f107cd",
        "sha256": "c8b8939f62b8cec32b2379273117e2f2b9be1a3cfa6d2b3decbc2122eef70e83",
        "bytes": 47048
      },
      "baseline": {
        "mode": "100644",
        "blob": "01ddf9347e002ab8c949955500cc4f20a5329c57",
        "sha256": "eb862ea716c38d15eab4c5506e230eb0a2dbc7e06c07a5351c48843e80b6c777",
        "bytes": 44466
      },
      "inverses": [
        {
          "at": 1729,
          "current": "    const districtTabs = new Set(['streets', 'city', 'map', 'fieldwork']);\n    const pending = new Map(), local = new Map(), openSections = new Set(), interactionDrafts = new Map();\n    const state = () => getState() || {};\n    const qualityUX = window.createOmertaQuestQuality?.({ getState,\n      onOperation: (instance, payload, label) => mutate('/v1/content/instances/' + encode(instance.id) + '/quality', {\n        expectedRevision: instance.revision, expectedQualityRevision: instance.quality.revision, ...payload,\n      }, label), onSubmit: submitAction, repaint: focused => paint(true, focused) });\n    const identity = () => [String(state().session?.accountId || state().me?.accountId || ''), String(state().me?.id || '')];\n    const saved = () => workspace?.get('quests', {}) || local.get(owner) || {};\n    const save = patch => { const next = { ...saved(), ...patch }; local.set(owner, next); workspace?.set('quests', next); };\n",
          "baseline": "    const districtTabs = new Set(['streets', 'city', 'map', 'fieldwork']);\n    const pending = new Map(), local = new Map(), openSections = new Set(), interactionDrafts = new Map();\n    const state = () => getState() || {};\n    const identity = () => [String(state().session?.accountId || state().me?.accountId || ''), String(state().me?.id || '')];\n    const saved = () => workspace?.get('quests', {}) || local.get(owner) || {};\n    const save = patch => { const next = { ...saved(), ...patch }; local.set(owner, next); workspace?.set('quests', next); };\n"
        },
        {
          "at": 2735,
          "current": "      if (next !== owner || character !== actor) {\n        owner = next; actor = character; epoch++; board = workshop = legacy = mystery = null; selected = ''; view = 'cases';\n        loading = busy = false; error = ''; legacyReadAt = districtAttemptAt = 0; requestedCase = ''; pending.clear(); openSections.clear(); interactionDrafts.clear(); root?.remove(); root = null; districtRoot?.remove(); districtRoot = null;\n        qualityUX?.reset();\n      }\n      return !!owner && !!actor && !destroyed;\n    }\n",
          "baseline": "      if (next !== owner || character !== actor) {\n        owner = next; actor = character; epoch++; board = workshop = legacy = mystery = null; selected = ''; view = 'cases';\n        loading = busy = false; error = ''; legacyReadAt = districtAttemptAt = 0; requestedCase = ''; pending.clear(); openSections.clear(); interactionDrafts.clear(); root?.remove(); root = null; districtRoot?.remove(); districtRoot = null;\n      }\n      return !!owner && !!actor && !destroyed;\n    }\n"
        },
        {
          "at": 19558,
          "current": "    function runFile(instance) {\n      const root = el('div', 'quest-run'); root.dataset.questInstance = instance.id;\n      root.append(recap(instance));\n      if (instance.quality) { const workbench = qualityUX?.render(instance); if (workbench) root.append(workbench); }\n      if (instance.agenda?.prompt) { const agenda = el('aside', 'quest-private-agenda'); agenda.append(el('strong', '', 'Your private agenda'), el('p', '', instance.agenda.prompt), el('small', 'quest-muted', instance.agenda.completed ? 'Your objective is recorded as complete.' : 'This objective is private until the case debrief.')); root.append(agenda); }\n      if (instance.suspicion != null) {\n        const value = typeof instance.suspicion === 'object' ? instance.suspicion.value ?? instance.suspicion.current : instance.suspicion;\n",
          "baseline": "    function runFile(instance) {\n      const root = el('div', 'quest-run'); root.dataset.questInstance = instance.id;\n      root.append(recap(instance));\n      if (instance.agenda?.prompt) { const agenda = el('aside', 'quest-private-agenda'); agenda.append(el('strong', '', 'Your private agenda'), el('p', '', instance.agenda.prompt), el('small', 'quest-muted', instance.agenda.completed ? 'Your objective is recorded as complete.' : 'This objective is private until the case debrief.')); root.append(agenda); }\n      if (instance.suspicion != null) {\n        const value = typeof instance.suspicion === 'object' ? instance.suspicion.value ?? instance.suspicion.current : instance.suspicion;\n"
        },
        {
          "at": 20849,
          "current": "        root.append(el('p', 'quest-complete', 'Case closed. Your decisions are on the record.'));\n        for (const award of list(instance.awards?.mine)) root.append(el('p', '', (award.title || words(award.kind)) + ' · ' + words(award.state)));\n        if (list(instance.awards?.mine).some(award => award.state === 'pending')) root.append(button('Claim my case record', () => mutate('/v1/content/instances/' + encode(instance.id) + '/claim', { expectedRevision: instance.revision }, 'Claim case record')));\n        if (!instance.quality && list(instance.debrief).length) { const debrief = el('div'); for (const entry of instance.debrief) debrief.append(el('p', '', (entry.name || words(entry.roleId)) + ': ' + entry.prompt + ' · ' + (entry.completed ? 'Objective fulfilled' : 'Objective not fulfilled'))); root.append(section(instance.id + ':debrief', 'The party’s private perspectives', debrief)); }\n      } else {\n        for (const item of list(instance.actions)) root.append(issuedAction(instance, item));\n        if (!list(instance.actions).length) root.append(el('p', 'quest-muted', 'No move is issued to your role yet. Another contribution may be needed.'));\n",
          "baseline": "        root.append(el('p', 'quest-complete', 'Case closed. Your decisions are on the record.'));\n        for (const award of list(instance.awards?.mine)) root.append(el('p', '', (award.title || words(award.kind)) + ' · ' + words(award.state)));\n        if (list(instance.awards?.mine).some(award => award.state === 'pending')) root.append(button('Claim my case record', () => mutate('/v1/content/instances/' + encode(instance.id) + '/claim', { expectedRevision: instance.revision }, 'Claim case record')));\n        if (list(instance.debrief).length) { const debrief = el('div'); for (const entry of instance.debrief) debrief.append(el('p', '', (entry.name || words(entry.roleId)) + ': ' + entry.prompt + ' · ' + (entry.completed ? 'Objective fulfilled' : 'Objective not fulfilled'))); root.append(section(instance.id + ':debrief', 'The party’s private perspectives', debrief)); }\n      } else {\n        for (const item of list(instance.actions)) root.append(issuedAction(instance, item));\n        if (!list(instance.actions).length) root.append(el('p', 'quest-muted', 'No move is issued to your role yet. Another contribution may be needed.'));\n"
        },
        {
          "at": 23771,
          "current": "      return mutate('/v1/content/instances/' + encode(instance.id) + '/act', { expectedRevision: instance.revision, actionId: item.id, ...payload }, label || item.title || 'Continue case');\n    }\n    function issuedAction(instance, item) {\n      const root = el('section', 'quest-action'); root.dataset.questAction = item.id; if (item.nodeId) root.dataset.questNode = item.nodeId;\n      root.append(el('span', 'quest-kicker', item.interaction ? words(item.interaction.kind) : words(item.kind)), el('h4', '', item.title || 'Continue the case'));\n      if (instance.quality && item.spotlight?.title) root.append(el('p', 'quest-muted', item.spotlight.title + ' has the spotlight; any participant can volunteer.'));\n      if (item.prompt) root.append(el('p', 'quest-prompt', item.prompt));\n      if (item.feedback) { const feedback = el('p', 'quest-attempt-feedback', item.feedback); feedback.setAttribute('role', 'status'); root.append(feedback); }\n      if (item.kind === 'start_instance') root.append(button('Start the case', () => submitAction(instance, item, {}, 'Start the case')));\n      else if (item.kind === 'choose' && instance.quality && qualityUX) root.append(qualityUX.choice(instance, item));\n      else if (item.kind === 'choose') {\n        const choices = el('div', 'quest-choices');\n        for (const choice of list(item.options)) {\n",
          "baseline": "      return mutate('/v1/content/instances/' + encode(instance.id) + '/act', { expectedRevision: instance.revision, actionId: item.id, ...payload }, label || item.title || 'Continue case');\n    }\n    function issuedAction(instance, item) {\n      const root = el('section', 'quest-action'); root.dataset.questAction = item.id;\n      root.append(el('span', 'quest-kicker', item.interaction ? words(item.interaction.kind) : words(item.kind)), el('h4', '', item.title || 'Continue the case'));\n      if (item.prompt) root.append(el('p', 'quest-prompt', item.prompt));\n      if (item.feedback) { const feedback = el('p', 'quest-attempt-feedback', item.feedback); feedback.setAttribute('role', 'status'); root.append(feedback); }\n      if (item.kind === 'start_instance') root.append(button('Start the case', () => submitAction(instance, item, {}, 'Start the case')));\n      else if (item.kind === 'choose') {\n        const choices = el('div', 'quest-choices');\n        for (const choice of list(item.options)) {\n"
        },
        {
          "at": 25257,
          "current": "          pick.disabled = busy || choice.available === false; wrap.append(pick, blockers(choice.blockedBy)); choices.append(wrap);\n        }\n        root.append(choices);\n      } else if (item.submissionKind === 'proof_sets') {\n        if (instance.quality && qualityUX) root.append(qualityUX.interaction(instance, item));\n        else root.append(el('p', 'quest-muted', 'The evidence-backed deduction interface could not be opened. Refresh the case file.'));\n      } else if (item.interaction) root.append(interactionForm(instance, item));\n      else if (item.kind === 'solve') {\n        const form = el('form', 'quest-form'), answer = field('Your answer'); answer.input.required = true; answer.input.autocomplete = 'off'; answer.input.maxLength = 2000;\n",
          "baseline": "          pick.disabled = busy || choice.available === false; wrap.append(pick, blockers(choice.blockedBy)); choices.append(wrap);\n        }\n        root.append(choices);\n      } else if (item.interaction) root.append(interactionForm(instance, item));\n      else if (item.kind === 'solve') {\n        const form = el('form', 'quest-form'), answer = field('Your answer'); answer.input.required = true; answer.input.autocomplete = 'off'; answer.input.maxLength = 2000;\n"
        },
        {
          "at": 42508,
          "current": "      }\n      return root;\n    }\n    function paint(force = false, focusedEditor = null) {\n      if (!scope() || state().currentTab !== 'desk') return;\n      const host = document.getElementById('tab-desk'); if (!host) return;\n      if (!root || !root.isConnected || !host.contains(root)) { root?.remove(); root = el('section', 'ux-quests'); root.id = 'ux-quests'; root.dataset.uxPanel = 'quests'; host.append(root); }\n      const active = root.contains(document.activeElement) && document.activeElement.matches('input,textarea,select') ? document.activeElement : null;\n      root.setAttribute('aria-busy', String(loading || busy));\n      if (active && !busy && (!force || !active.closest('.quest-quality,.quest-quality-proof'))) return;\n      const focused = force && active ? { label: active.getAttribute('aria-label'), start: active.selectionStart, end: active.selectionEnd } : force ? focusedEditor : null;\n      const header = el('header', 'quest-heading'); header.append(el('span', 'quest-kicker', 'Bureau of unfinished business'), el('h2', '', 'Your case files'));\n      const controls = el('nav', 'quest-tabs'); controls.setAttribute('aria-label', 'Quest tools');\n      for (const [id, title] of [['cases', 'Case files'], ['community', 'Community mysteries'], ['legacy', 'Your history']]) { const tab = button(title, () => { view = id; error = ''; load(); }); tab.setAttribute('aria-pressed', String(view === id)); tab.disabled = busy || loading; controls.append(tab); }\n",
          "baseline": "      }\n      return root;\n    }\n    function paint() {\n      if (!scope() || state().currentTab !== 'desk') return;\n      const host = document.getElementById('tab-desk'); if (!host) return;\n      if (!root || !root.isConnected || !host.contains(root)) { root?.remove(); root = el('section', 'ux-quests'); root.id = 'ux-quests'; root.dataset.uxPanel = 'quests'; host.append(root); }\n      if (root.contains(document.activeElement) && document.activeElement.matches('input,textarea,select') && !busy) return;\n      const header = el('header', 'quest-heading'); header.append(el('span', 'quest-kicker', 'Bureau of unfinished business'), el('h2', '', 'Your case files'));\n      const controls = el('nav', 'quest-tabs'); controls.setAttribute('aria-label', 'Quest tools');\n      for (const [id, title] of [['cases', 'Case files'], ['community', 'Community mysteries'], ['legacy', 'Your history']]) { const tab = button(title, () => { view = id; error = ''; load(); }); tab.setAttribute('aria-pressed', String(view === id)); tab.disabled = busy || loading; controls.append(tab); }\n"
        },
        {
          "at": 44432,
          "current": "      else nodes.push(view === 'cases' ? caseFiles() : view === 'community' ? workshopPanel() : legacyPanel());\n      root.replaceChildren(...nodes); root.setAttribute('aria-busy', String(loading || busy));\n      document.dispatchEvent(new CustomEvent('omerta:ux-panels-changed'));\n      if (focused?.label) {\n        const target = [...root.querySelectorAll('input,textarea,select')].find(node => node.getAttribute('aria-label') === focused.label);\n        if (target) { target.focus({ preventScroll: true }); if (focused.start != null && typeof target.setSelectionRange === 'function') try { target.setSelectionRange(focused.start, focused.end); } catch { /* Non-text input. */ } }\n      }\n    }\n    function observe(path, body) {\n      if (!scope()) return;\n",
          "baseline": "      else nodes.push(view === 'cases' ? caseFiles() : view === 'community' ? workshopPanel() : legacyPanel());\n      root.replaceChildren(...nodes); root.setAttribute('aria-busy', String(loading || busy));\n      document.dispatchEvent(new CustomEvent('omerta:ux-panels-changed'));\n    }\n    function observe(path, body) {\n      if (!scope()) return;\n"
        },
        {
          "at": 46002,
          "current": "      if (state().currentTab !== 'desk') return;\n      paint(); if (!(view === 'cases' ? board : view === 'community' ? workshop : legacy) && !loading && !error) load();\n    }\n    const openQualityCase = event => {\n      if (!scope() || !list(board?.instances).some(instance => instance.id === event.detail?.instanceId && instance.quality)) return;\n      selected = 'run:' + event.detail.instanceId; view = 'cases'; paint();\n      const target = root?.querySelector('.quest-quality-heading h4');\n      if (target) { target.tabIndex = -1; target.focus(); target.scrollIntoView({ block: 'start' }); }\n    };\n    document.addEventListener('omerta:quality-case', openQualityCase);\n    return { render, observe, reloadWorkspace() { if (scope()) { paint(); paintDistrictAftermath(); } }, destroy() { destroyed = true; epoch++; pending.clear(); qualityUX?.reset(); document.removeEventListener('omerta:quality-case', openQualityCase); root?.remove(); root = null; districtRoot?.remove(); districtRoot = null; } };\n  };\n})();\n",
          "baseline": "      if (state().currentTab !== 'desk') return;\n      paint(); if (!(view === 'cases' ? board : view === 'community' ? workshop : legacy) && !loading && !error) load();\n    }\n    return { render, observe, reloadWorkspace() { if (scope()) { paint(); paintDistrictAftermath(); } }, destroy() { destroyed = true; epoch++; pending.clear(); root?.remove(); root = null; districtRoot?.remove(); districtRoot = null; } };\n  };\n})();\n"
        }
      ]
    },
    "src/agentgateway.js": {
      "current": {
        "mode": "100644",
        "blob": "a7ec8942ac9ca29e9fb5f4fc33bd68309cecc992",
        "sha256": "3fa8b354e53473ffe269c517d0c930bf995130d32a1dab97954c891727c54e95",
        "bytes": 160610
      },
      "baseline": {
        "mode": "100644",
        "blob": "79743e2e8fa0762ef9a2950e081a683045654b06",
        "sha256": "f6086a80c1d8bd2bb8dd9cad5f5d08f514a079a65a8c41361c44e83d85a08125",
        "bytes": 159768
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { SALE_ATTRIBUTION_CONTRACTS, SALE_ATTRIBUTION_SCHEMAS } from './saleattribution-contracts.js';\nimport { QUEST_QUALITY_BODY, QUEST_QUALITY_SCHEMA } from './quest-quality-contracts.js';\nimport { MERCHANT_LOYALTY_CONTRACTS, MERCHANT_LOYALTY_SCHEMAS } from './merchantloyalty-contracts.js';\nimport { SHOPPING_BASKET_CONTRACTS, SHOPPING_BASKET_SCHEMAS } from './shoppingbasket-contracts.js';\nimport { EVENT_MARKET_CONTRACTS, EVENT_MARKET_SCHEMAS } from './eventmarkets-contracts.js';\n",
          "baseline": "import { SALE_ATTRIBUTION_CONTRACTS, SALE_ATTRIBUTION_SCHEMAS } from './saleattribution-contracts.js';\nimport { MERCHANT_LOYALTY_CONTRACTS, MERCHANT_LOYALTY_SCHEMAS } from './merchantloyalty-contracts.js';\nimport { SHOPPING_BASKET_CONTRACTS, SHOPPING_BASKET_SCHEMAS } from './shoppingbasket-contracts.js';\nimport { EVENT_MARKET_CONTRACTS, EVENT_MARKET_SCHEMAS } from './eventmarkets-contracts.js';\n"
        },
        {
          "at": 71733,
          "current": "          properties: {\n            ids: { type: 'array', maxItems: 64, items: { type: 'string', minLength: 1, maxLength: 160 } },\n            assignments: { type: 'object', maxProperties: 64, additionalProperties: { type: 'string', minLength: 1, maxLength: 160 } },\n            conclusionId: { type: 'string', minLength: 1, maxLength: 160 },\n            evidenceIds: { type: 'array', minItems: 1, maxItems: 64, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 160 } },\n          },\n          oneOf: [{ required: ['ids'] }, { required: ['assignments'] }, { required: ['conclusionId', 'evidenceIds'] }],\n        },\n        hint: { type: 'boolean' },\n      }, not: { required: ['answer', 'choiceId'] } },\n    responseSchema: { $ref: '#/components/schemas/ContentReceipt' },\n    extraResponses: { 409: CONTENT_STALE_RESPONSE },\n  },\n  'POST /v1/content/instances/:instanceId/quality': {\n    operationId: 'actOnContentQuality', requestSchema: QUEST_QUALITY_BODY,\n    responseSchema: { $ref: '#/components/schemas/ContentReceipt' },\n    extraResponses: { 409: CONTENT_STALE_RESPONSE },\n  },\n  'POST /v1/content/instances/:instanceId/leave': {\n    operationId: 'leaveContentInstance',\n    requestSchema: { type: 'object', additionalProperties: false,\n",
          "baseline": "          properties: {\n            ids: { type: 'array', maxItems: 64, items: { type: 'string', minLength: 1, maxLength: 160 } },\n            assignments: { type: 'object', maxProperties: 64, additionalProperties: { type: 'string', minLength: 1, maxLength: 160 } },\n          },\n          oneOf: [{ required: ['ids'] }, { required: ['assignments'] }],\n        },\n        hint: { type: 'boolean' },\n      }, not: { required: ['answer', 'choiceId'] } },\n    responseSchema: { $ref: '#/components/schemas/ContentReceipt' },\n    extraResponses: { 409: CONTENT_STALE_RESPONSE },\n  },\n  'POST /v1/content/instances/:instanceId/leave': {\n    operationId: 'leaveContentInstance',\n    requestSchema: { type: 'object', additionalProperties: false,\n"
        },
        {
          "at": 86606,
          "current": "    properties: {\n      id: { type: 'string', minLength: 1 }, kind: { type: 'string' },\n      nodeId: { type: 'string' }, title: { type: 'string' }, prompt: { type: ['string', 'null'] },\n      submissionKind: { type: 'string', enum: ['normalized_exact', 'ordered_ids', 'unordered_ids', 'mapping', 'proof_sets'] },\n      interaction: { $ref: '#/components/schemas/ContentInteraction' },\n      spotlight: { type: 'object', additionalProperties: false, required: ['roleId', 'title'],\n        properties: { roleId: { type: 'string' }, title: { type: 'string' } } },\n      hints: { type: 'array', maxItems: 8, items: { type: 'string' } },\n      hintsRemaining: { type: 'integer', minimum: 0 }, canRequestHint: { type: 'boolean' },\n      attempts: { type: 'integer', minimum: 0 }, suspicion: { type: 'integer', minimum: 0 },\n",
          "baseline": "    properties: {\n      id: { type: 'string', minLength: 1 }, kind: { type: 'string' },\n      nodeId: { type: 'string' }, title: { type: 'string' }, prompt: { type: ['string', 'null'] },\n      submissionKind: { type: 'string', enum: ['normalized_exact', 'ordered_ids', 'unordered_ids', 'mapping'] },\n      interaction: { $ref: '#/components/schemas/ContentInteraction' },\n      hints: { type: 'array', maxItems: 8, items: { type: 'string' } },\n      hintsRemaining: { type: 'integer', minimum: 0 }, canRequestHint: { type: 'boolean' },\n      attempts: { type: 'integer', minimum: 0 }, suspicion: { type: 'integer', minimum: 0 },\n"
        },
        {
          "at": 92130,
          "current": "      expectations: { oneOf: [{ $ref: '#/components/schemas/ContentExpectations' }, { type: 'null' }] },\n      recap: { $ref: '#/components/schemas/ContentRecap' }, recapText: { type: 'string' },\n      suspicion: { type: 'integer', minimum: 0 },\n      quality: QUEST_QUALITY_SCHEMA,\n      awards: { type: 'object', additionalProperties: false,\n        required: ['pending', 'applied', 'mine'], properties: {\n          pending: { type: 'integer', minimum: 0 }, applied: { type: 'integer', minimum: 0 },\n",
          "baseline": "      expectations: { oneOf: [{ $ref: '#/components/schemas/ContentExpectations' }, { type: 'null' }] },\n      recap: { $ref: '#/components/schemas/ContentRecap' }, recapText: { type: 'string' },\n      suspicion: { type: 'integer', minimum: 0 },\n      awards: { type: 'object', additionalProperties: false,\n        required: ['pending', 'applied', 'mine'], properties: {\n          pending: { type: 'integer', minimum: 0 }, applied: { type: 'integer', minimum: 0 },\n"
        }
      ]
    },
    "src/content/compiler.js": {
      "current": {
        "mode": "100644",
        "blob": "10b5aab91c03d456cc41d3e52d83f5abcc795c98",
        "sha256": "20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641",
        "bytes": 69250
      },
      "baseline": {
        "mode": "100644",
        "blob": "fc324fbfd2139ffb6bb92dcaf706a51f37dfda4f",
        "sha256": "045a917a8f2eef1eb95e77b2dfa56e852eab8adcc9b335010c6ba47b638e4f77",
        "bytes": 69139
      },
      "inverses": [
        {
          "at": 0,
          "current": "import crypto from 'node:crypto';\nimport { HONOR, MASTERY, PATHS, REGIMEN, SEASON_PHASES, SKILLS, UNDERWORLD } from '../rules.js';\nimport { NARRATIVE_VERIFIERS, validateNarrativeAnswer, validateNarrativePuzzle } from './narrative.js';\nimport { assertQuestQuality } from './quality.js';\n\nexport const NODE_TYPES = Object.freeze([\n  'mystery', 'chapter', 'puzzle', 'choice', 'terminal', 'evidence', 'answer_spec',\n",
          "baseline": "import crypto from 'node:crypto';\nimport { HONOR, MASTERY, PATHS, REGIMEN, SEASON_PHASES, SKILLS, UNDERWORLD } from '../rules.js';\nimport { NARRATIVE_VERIFIERS, validateNarrativeAnswer, validateNarrativePuzzle } from './narrative.js';\n\nexport const NODE_TYPES = Object.freeze([\n  'mystery', 'chapter', 'puzzle', 'choice', 'terminal', 'evidence', 'answer_spec',\n"
        },
        {
          "at": 54538,
          "current": "    profiles += 1;\n  }\n  if (!profiles) throw new Error('activatable content requires a supported capability manifest');\n  assertQuestQuality(bundle);\n  return bundle;\n}\n\n",
          "baseline": "    profiles += 1;\n  }\n  if (!profiles) throw new Error('activatable content requires a supported capability manifest');\n  return bundle;\n}\n\n"
        },
        {
          "at": 68539,
          "current": "    }),\n  });\n  const canonicalJson = JSON.stringify(source);\n  assertQuestQuality(source);\n  return {\n    ...source,\n    contentHash: crypto.createHash('sha256').update(canonicalJson).digest('hex'),\n",
          "baseline": "    }),\n  });\n  const canonicalJson = JSON.stringify(source);\n  return {\n    ...source,\n    contentHash: crypto.createHash('sha256').update(canonicalJson).digest('hex'),\n"
        }
      ]
    },
    "src/content/narrative.js": {
      "current": {
        "mode": "100644",
        "blob": "790d08fb5f51bd7c5a58f6b41f8469e28194ed88",
        "sha256": "96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41",
        "bytes": 10972
      },
      "baseline": {
        "mode": "100644",
        "blob": "20a048aceae83f31b371511df6a4ab091bc7f805",
        "sha256": "5259245371f6786d8a530c0d6eb03528acceb3f0105d2c2031bbd75a25781b9d",
        "bytes": 7378
      },
      "inverses": [
        {
          "at": 0,
          "current": "import crypto from 'node:crypto';\n\nexport const NARRATIVE_VERIFIERS = Object.freeze(['ordered_ids', 'unordered_ids', 'mapping', 'proof_sets']);\nexport const INTERACTION_KINDS = Object.freeze([\n  'deduction', 'interrogation', 'timeline', 'scene', 'planning', 'stealth', 'inventory',\n]);\n",
          "baseline": "import crypto from 'node:crypto';\n\nexport const NARRATIVE_VERIFIERS = Object.freeze(['ordered_ids', 'unordered_ids', 'mapping']);\nexport const INTERACTION_KINDS = Object.freeze([\n  'deduction', 'interrogation', 'timeline', 'scene', 'planning', 'stealth', 'inventory',\n]);\n"
        },
        {
          "at": 595,
          "current": "const ids = (value) => Array.isArray(value) && value.length > 0 && value.length <= 64\n  && value.every(id) && new Set(value).size === value.length;\nconst text = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096;\nconst closed = (value, keys) => only(value, keys)\n  && [Object.prototype, null].includes(Object.getPrototypeOf(value))\n  && Reflect.ownKeys(value).every((key) => typeof key === 'string'\n    && Object.getOwnPropertyDescriptor(value, key)?.value !== undefined);\n\nexport function validateNarrativeAnswer(spec, owner) {\n  const payload = spec.payload || {};\n  if (!NARRATIVE_VERIFIERS.includes(payload.verifier)) return;\n  if (payload.verifier === 'proof_sets') {\n    if (!closed(payload, ['verifier', 'proofs']) || !Array.isArray(payload.proofs)\n      || payload.proofs.length < 1 || payload.proofs.length > 32) throw new Error(`${owner} requires 1-32 bounded proofs`);\n    const seen = new Set();\n    for (const proof of payload.proofs) {\n      if (!closed(proof, ['conclusionId', 'evidenceIds']) || !id(proof.conclusionId) || !ids(proof.evidenceIds)) {\n        throw new Error(`${owner} requires a conclusion and unique cited evidence IDs`);\n      }\n      const key = JSON.stringify([proof.conclusionId, [...proof.evidenceIds].sort()]);\n      if (seen.has(key)) throw new Error(`${owner} has duplicate sufficient proofs`);\n      seen.add(key);\n    }\n    return;\n  }\n  if (!only(payload, ['verifier', 'solution'])) throw new Error(`${owner} answer spec has unknown fields`);\n  if (payload.verifier === 'mapping') {\n    if (!record(payload.solution) || !ids(Object.keys(payload.solution))\n",
          "baseline": "const ids = (value) => Array.isArray(value) && value.length > 0 && value.length <= 64\n  && value.every(id) && new Set(value).size === value.length;\nconst text = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096;\n\nexport function validateNarrativeAnswer(spec, owner) {\n  const payload = spec.payload || {};\n  if (!NARRATIVE_VERIFIERS.includes(payload.verifier)) return;\n  if (!only(payload, ['verifier', 'solution'])) throw new Error(`${owner} answer spec has unknown fields`);\n  if (payload.verifier === 'mapping') {\n    if (!record(payload.solution) || !ids(Object.keys(payload.solution))\n"
        },
        {
          "at": 2452,
          "current": "}\n\nfunction validateInteraction(interaction, spec, owner) {\n  if (spec?.payload?.verifier === 'proof_sets') {\n    if (!closed(interaction, ['kind', 'items', 'conclusions']) || interaction.kind !== 'deduction'\n      || !Array.isArray(interaction.items) || !ids(interaction.items.map((item) => item?.id))\n      || interaction.items.some((item) => !closed(item, ['id', 'label', 'description', 'evidenceNodeId'])\n        || !text(item.label) || !id(item.evidenceNodeId)\n        || (item.description !== undefined && !text(item.description)))\n      || new Set(interaction.items.map((item) => item.evidenceNodeId)).size !== interaction.items.length\n      || !Array.isArray(interaction.conclusions) || !ids(interaction.conclusions.map((item) => item?.id))\n      || interaction.conclusions.some((item) => !closed(item, ['id', 'label', 'description'])\n        || !text(item.label) || (item.description !== undefined && !text(item.description)))) {\n      throw new Error(`${owner} requires bounded public conclusions and linked evidence items`);\n    }\n    const items = new Set(interaction.items.map((item) => item.id));\n    const conclusions = new Set(interaction.conclusions.map((item) => item.id));\n    if (spec.payload.proofs.some((proof) => !conclusions.has(proof.conclusionId)\n      || proof.evidenceIds.some((itemId) => !items.has(itemId)))) {\n      throw new Error(`${owner} proof references unknown public conclusions or evidence`);\n    }\n    return;\n  }\n  if (!only(interaction, ['kind', 'items', 'slots']) || !INTERACTION_KINDS.includes(interaction.kind)) {\n    throw new Error(`${owner} requires a supported narrative interaction`);\n  }\n",
          "baseline": "}\n\nfunction validateInteraction(interaction, spec, owner) {\n  if (!only(interaction, ['kind', 'items', 'slots']) || !INTERACTION_KINDS.includes(interaction.kind)) {\n    throw new Error(`${owner} requires a supported narrative interaction`);\n  }\n"
        },
        {
          "at": 5726,
          "current": "    if (NARRATIVE_VERIFIERS.includes(spec.payload?.verifier)) {\n      validateNarrativeAnswer(spec, owner);\n      validateInteraction(value.interaction, spec, owner);\n      if (spec.payload.verifier === 'proof_sets' && value.interaction.items.some((item) =>\n        !profileIds.has(item.evidenceNodeId) || nodeById.get(item.evidenceNodeId)?.type !== 'evidence')) {\n        throw new Error(`${owner} proof evidence must reference profiled evidence nodes`);\n      }\n    } else if (value.interaction !== undefined) validateInteraction(value.interaction, spec, owner);\n    if (value.hints !== undefined && (!Array.isArray(value.hints) || value.hints.length > 8\n      || value.hints.some((hint) => !text(hint)))) throw new Error(`${owner} hints must be bounded text`);\n",
          "baseline": "    if (NARRATIVE_VERIFIERS.includes(spec.payload?.verifier)) {\n      validateNarrativeAnswer(spec, owner);\n      validateInteraction(value.interaction, spec, owner);\n    } else if (value.interaction !== undefined) validateInteraction(value.interaction, spec, owner);\n    if (value.hints !== undefined && (!Array.isArray(value.hints) || value.hints.length > 8\n      || value.hints.some((hint) => !text(hint)))) throw new Error(`${owner} hints must be bounded text`);\n"
        },
        {
          "at": 8270,
          "current": "  return { ...node.payload, ...variants[hash.readUInt32BE(0) % variants.length] };\n}\n\nexport function verifyNarrativeSubmission(spec, interaction, submission, context) {\n  const verifier = spec.payload.verifier;\n  if (verifier === 'proof_sets') {\n    if (!closed(submission, ['conclusionId', 'evidenceIds']) || !id(submission.conclusionId)\n      || !ids(submission.evidenceIds) || !(context?.knownEvidenceNodeIds instanceof Set)\n      || !interaction.conclusions.some((entry) => entry.id === submission.conclusionId)) return { valid: false };\n    const evidence = new Map(interaction.items.map((item) => [item.id, item.evidenceNodeId]));\n    if (submission.evidenceIds.some((itemId) => !evidence.has(itemId)\n      || !context.knownEvidenceNodeIds.has(evidence.get(itemId)))) return { valid: false };\n    const cited = new Set(submission.evidenceIds);\n    return { valid: true, matched: spec.payload.proofs.some((proof) => proof.conclusionId === submission.conclusionId\n      && proof.evidenceIds.length === cited.size && proof.evidenceIds.every((itemId) => cited.has(itemId))) };\n  }\n  const items = new Set(interaction.items.map((entry) => entry.id));\n  if (verifier === 'mapping') {\n    if (!only(submission, ['assignments']) || !record(submission.assignments)) return { valid: false };\n",
          "baseline": "  return { ...node.payload, ...variants[hash.readUInt32BE(0) % variants.length] };\n}\n\nexport function verifyNarrativeSubmission(spec, interaction, submission) {\n  const verifier = spec.payload.verifier;\n  const items = new Set(interaction.items.map((entry) => entry.id));\n  if (verifier === 'mapping') {\n    if (!only(submission, ['assignments']) || !record(submission.assignments)) return { valid: false };\n"
        }
      ]
    },
    "src/content/runtime.js": {
      "current": {
        "mode": "100644",
        "blob": "1f5f3f0890f9a575f8a8f589e568fc5ecf9385d3",
        "sha256": "5525cba577dbea54b89618a394db6ca904b4e0e9b19842d642baa13fedc6abea",
        "bytes": 79500
      },
      "baseline": {
        "mode": "100644",
        "blob": "32fc3abc13d7c0f850ac7a390fa67f7b8be47b1a",
        "sha256": "a6e50a80acac7ee519c9a6a4fffc03058df8c35432b3af91bb3e4b027921ba2f",
        "bytes": 70154
      },
      "inverses": [
        {
          "at": 34,
          "current": "import { GameError } from '../game.js';\nimport { compileContentPack, validateActivatableContentPack } from './compiler.js';\nimport { NARRATIVE_VERIFIERS, narrativeBranchAllows, narrativeVariant, verifyNarrativeSubmission } from './narrative.js';\nimport { qualitySpoilerAllows } from './quality.js';\nimport {\n  applyQualityOperation, qualityActorKey, QUALITY_SHARED_KEY, qualityControlledEvidence, qualityDesign,\n  qualityMandateAllows, qualityMemberId, qualityRevelationAllowed, qualityStates, projectQualityRuntime,\n} from './quality-runtime.js';\nimport {\n  MASTERY, PATHS, REGIMEN, SEASON_PHASES, SKILLS, UNDERWORLD,\n  disciplineLvlOf, levelOf, masteryLvlOf, seasonIdxOf, seasonPhaseLeft, seasonPhaseOf,\n",
          "baseline": "import { GameError } from '../game.js';\nimport { compileContentPack, validateActivatableContentPack } from './compiler.js';\nimport { NARRATIVE_VERIFIERS, narrativeBranchAllows, narrativeVariant, verifyNarrativeSubmission } from './narrative.js';\nimport {\n  MASTERY, PATHS, REGIMEN, SEASON_PHASES, SKILLS, UNDERWORLD,\n  disciplineLvlOf, levelOf, masteryLvlOf, seasonIdxOf, seasonPhaseLeft, seasonPhaseOf,\n"
        },
        {
          "at": 26272,
          "current": "  const actions = [];\n  const quorum = Number(graph.quorum.payload?.minimumParticipants || graph.partyRoles.length);\n  const root = graph.nodeById.get(graph.runtime.entryNodeId);\n  const design = qualityDesign(graph);\n  const quality = qualityStates(facts, ch.account_id);\n  const completed = new Set(progress.filter(row => row.state === COMPLETE).map(row => row.node_id));\n  const authorizedNodes = new Set([...completed].filter(nodeId => {\n    const node = graph.nodeById.get(nodeId);\n    return !(node?.type === 'evidence' && node.payload?.shareScope === 'role_private' && node.payload.roleId !== mine.role_id)\n      && !(node?.payload?.gates || []).some(gate => gate.kind === 'party_role' && gate.role !== mine.role_id);\n  }));\n  const knownEvidence = new Set(progress.filter(row => row.state === COMPLETE).filter(row => {\n    const node = graph.nodeById.get(row.node_id);\n    return node?.type === 'evidence' && authorizedNodes.has(node.id)\n      && (!design || qualitySpoilerAllows(design, node.id, authorizedNodes));\n  }).map(row => row.node_id));\n  if (instance.status === FORMING && instance.created_by_account === ch.account_id\n    && members.length >= quorum\n    && blockedGates(ch, h, root?.payload?.gates, graph, mine.role_id).length === 0) {\n",
          "baseline": "  const actions = [];\n  const quorum = Number(graph.quorum.payload?.minimumParticipants || graph.partyRoles.length);\n  const root = graph.nodeById.get(graph.runtime.entryNodeId);\n  if (instance.status === FORMING && instance.created_by_account === ch.account_id\n    && members.length >= quorum\n    && blockedGates(ch, h, root?.payload?.gates, graph, mine.role_id).length === 0) {\n"
        },
        {
          "at": 27756,
          "current": "      const node = graph.nodeById.get(nodeId);\n      if (row?.state !== 'available'\n        || blockedGates(ch, h, node.payload?.gates, graph, mine.role_id).length) continue;\n      if (design && !qualityRevelationAllowed(design, nodeId, completed, quality.shared, graph.nodeById)) continue;\n      if (design && !qualitySpoilerAllows(design, nodeId, authorizedNodes)) continue;\n      const action = {\n        id: actionId(instance, node.type, nodeId), kind: node.type === 'choice' ? 'choose' : 'solve',\n        nodeId, title: node.payload?.title || nodeId, prompt: node.payload?.prompt || null,\n      };\n      const spotlight = design?.spotlights?.find(item => item.nodeId === nodeId);\n      if (spotlight) action.spotlight = { roleId: spotlight.roleId,\n        title: graph.nodeById.get(spotlight.roleId)?.payload?.title || spotlight.roleId };\n      if (node.type === 'puzzle') {\n        const payload = narrativeVariant(node, instance.id);\n        const spec = graph.nodeById.get(payload.answerSpecId);\n",
          "baseline": "      const node = graph.nodeById.get(nodeId);\n      if (row?.state !== 'available'\n        || blockedGates(ch, h, node.payload?.gates, graph, mine.role_id).length) continue;\n      const action = {\n        id: actionId(instance, node.type, nodeId), kind: node.type === 'choice' ? 'choose' : 'solve',\n        nodeId, title: node.payload?.title || nodeId, prompt: node.payload?.prompt || null,\n      };\n      if (node.type === 'puzzle') {\n        const payload = narrativeVariant(node, instance.id);\n        const spec = graph.nodeById.get(payload.answerSpecId);\n"
        },
        {
          "at": 28872,
          "current": "        action.prompt = payload.prompt || null;\n        action.submissionKind = spec.payload.verifier;\n        if (payload.interaction) action.interaction = { ...payload.interaction, mode: spec.payload.verifier };\n        if (spec.payload.verifier === 'proof_sets') action.interaction.items = payload.interaction.items\n          .filter(item => knownEvidence.has(item.evidenceNodeId));\n        action.hints = (payload.hints || []).slice(0, hintLevel);\n        action.canRequestHint = hintLevel < (payload.hints || []).length;\n        action.hintsRemaining = Math.max(0, (payload.hints || []).length - hintLevel);\n",
          "baseline": "        action.prompt = payload.prompt || null;\n        action.submissionKind = spec.payload.verifier;\n        if (payload.interaction) action.interaction = { ...payload.interaction, mode: spec.payload.verifier };\n        action.hints = (payload.hints || []).slice(0, hintLevel);\n        action.canRequestHint = hintLevel < (payload.hints || []).length;\n        action.hintsRemaining = Math.max(0, (payload.hints || []).length - hintLevel);\n"
        },
        {
          "at": 29685,
          "current": "        if (result.feedback) action.feedback = result.feedback;\n      }\n      if (node.type === 'choice') {\n        const procedure = design?.procedures?.find(item => item.nodeId === nodeId);\n        action.options = node.payload.options.filter(option => !procedure || option.id !== procedure.skipOptionId\n          || h.authoredStoryFlags.get(procedure.masteryFlag) === 'learned').map((option) => {\n          const blockedBy = blockedGates(ch, h, option.gates, graph, mine.role_id);\n          return {\n            id: option.id, label: option.label,\n",
          "baseline": "        if (result.feedback) action.feedback = result.feedback;\n      }\n      if (node.type === 'choice') {\n        action.options = node.payload.options.map((option) => {\n          const blockedBy = blockedGates(ch, h, option.gates, graph, mine.role_id);\n          return {\n            id: option.id, label: option.label,\n"
        },
        {
          "at": 30366,
          "current": "  const visibleNodes = progress.flatMap((row) => {\n    const node = graph.nodeById.get(row.node_id);\n    if (!node || node.type === 'answer_spec') return [];\n    if (design && !qualitySpoilerAllows(design, node.id, authorizedNodes)) return [];\n    if (design && !quality.actor.debriefOpened && row.state === COMPLETE\n      && (node.type === 'terminal' || (graph.outgoing.get(node.id) || [])\n        .some(edge => edge.type === 'UNLOCKS' && edge.to === graph.runtime.terminalNodeId))) return [];\n    if (node.type === 'evidence' && node.payload?.shareScope === 'role_private'\n      && node.payload.roleId !== mine.role_id) return [];\n    if (ACTION_TYPES.has(node.type) && (node.payload?.gates || []).some((gate) => (\n",
          "baseline": "  const visibleNodes = progress.flatMap((row) => {\n    const node = graph.nodeById.get(row.node_id);\n    if (!node || node.type === 'answer_spec') return [];\n    if (node.type === 'evidence' && node.payload?.shareScope === 'role_private'\n      && node.payload.roleId !== mine.role_id) return [];\n    if (ACTION_TYPES.has(node.type) && (node.payload?.gates || []).some((gate) => (\n"
        },
        {
          "at": 33158,
          "current": "    return { prompt: agenda.prompt, completed: objective?.state === COMPLETE\n      && (!agenda.choiceId || agenda.choiceId === result.choiceId) };\n  };\n  const projectedQuality = design ? projectQualityRuntime(design, {\n    instance, accountId: ch.account_id, members, visibleNodes, completed, actions, now: Date.now(),\n    debriefText: progress.filter(row => row.state === COMPLETE).map(row => ({\n      node: graph.nodeById.get(row.node_id), result: parseJson(row.result_json, {}),\n    })).filter(({ node, result }) => result.summary || node?.type === 'terminal')\n      .map(({ node, result }) => result.summary || node.payload.summary || '').filter(Boolean).join('\\n\\n').slice(0, 16000),\n  }, quality.actor, quality.shared, facts) : null;\n  return {\n    instance: {\n      id: instance.id, namespace: instance.namespace, version: Number(instance.version),\n",
          "baseline": "    return { prompt: agenda.prompt, completed: objective?.state === COMPLETE\n      && (!agenda.choiceId || agenda.choiceId === result.choiceId) };\n  };\n  return {\n    instance: {\n      id: instance.id, namespace: instance.namespace, version: Number(instance.version),\n"
        },
        {
          "at": 34359,
          "current": "      members: members.map((row) => projectedMember(row, graph, instance, ch.account_id)),\n      nodes: visibleNodes, facts: publicFacts, actions, notes,\n      agenda: agendaFor(mine.role_id),\n      debrief: instance.status === COMPLETE && (!design || quality.actor.debriefOpened) ? members.filter((member) => agendaFor(member.role_id)).map((member) => ({\n        name: member.name_snapshot, roleId: member.role_id, ...agendaFor(member.role_id),\n      })) : [],\n      canReleaseRole: instance.status === ACTIVE && graph.policy.payload.allowRoleReplacement === true,\n",
          "baseline": "      members: members.map((row) => projectedMember(row, graph, instance, ch.account_id)),\n      nodes: visibleNodes, facts: publicFacts, actions, notes,\n      agenda: agendaFor(mine.role_id),\n      debrief: instance.status === COMPLETE ? members.filter((member) => agendaFor(member.role_id)).map((member) => ({\n        name: member.name_snapshot, roleId: member.role_id, ...agendaFor(member.role_id),\n      })) : [],\n      canReleaseRole: instance.status === ACTIVE && graph.policy.payload.allowRoleReplacement === true,\n"
        },
        {
          "at": 35481,
          "current": "      awards: {\n        pending: effects.filter((effect) => effect.state === 'pending').length,\n        applied: effects.filter((effect) => effect.state === 'applied').length,\n        mine: design && !quality.actor.debriefOpened ? [] : ownEffects,\n      },\n      createdAt: instance.created_at, startedAt: instance.started_at,\n      completedAt: instance.completed_at, formingExpiresAt: instance.forming_expires_at || null,\n      ...(projectedQuality ? { quality: projectedQuality } : {}),\n    },\n  };\n}\n",
          "baseline": "      awards: {\n        pending: effects.filter((effect) => effect.state === 'pending').length,\n        applied: effects.filter((effect) => effect.state === 'applied').length,\n        mine: ownEffects,\n      },\n      createdAt: instance.created_at, startedAt: instance.started_at,\n      completedAt: instance.completed_at, formingExpiresAt: instance.forming_expires_at || null,\n    },\n  };\n}\n"
        },
        {
          "at": 54928,
          "current": "}\n\nasync function cascade(client, graph, instance, actor = null) {\n  const controlledEvidence = qualityControlledEvidence(qualityDesign(graph));\n  let changed = true;\n  while (changed) {\n    changed = false;\n",
          "baseline": "}\n\nasync function cascade(client, graph, instance, actor = null) {\n  let changed = true;\n  while (changed) {\n    changed = false;\n"
        },
        {
          "at": 55503,
          "current": "\n    for (const nodeId of [...graph.nodeById.keys()].sort()) {\n      if (completed.has(nodeId)) continue;\n      if (controlledEvidence.has(nodeId)) continue;\n      const node = graph.nodeById.get(nodeId);\n      if ((node.payload?.gates || []).length && nodeId !== graph.runtime.entryNodeId && !graph.actionIds.has(nodeId)) {\n        fail('unsupported_content_feature', 'This pinned bundle declares an unsupported passive-node gate.');\n",
          "baseline": "\n    for (const nodeId of [...graph.nodeById.keys()].sort()) {\n      if (completed.has(nodeId)) continue;\n      const node = graph.nodeById.get(nodeId);\n      if ((node.payload?.gates || []).length && nodeId !== graph.runtime.entryNodeId && !graph.actionIds.has(nodeId)) {\n        fail('unsupported_content_feature', 'This pinned bundle declares an unsupported passive-node gate.');\n"
        },
        {
          "at": 62489,
          "current": "    )).rows[0];\n    if (progress?.state !== 'available') fail('unknown_action', 'That node is not currently actionable.');\n    assertNodeGates(ch, h, selected, graph, member.role_id);\n    const design = qualityDesign(graph);\n    let qualityContext;\n    if (design || selected.payload?.interaction?.conclusions) {\n      const board = await projection(ch, instance, bundle, client, h);\n      const facts = (await client.query('SELECT fact_key, value_json FROM content_instance_facts WHERE instance_id=$1', [instanceId]))\n        .rows.map(row => ({ key: row.fact_key, value: parseJson(row.value_json) }));\n      const completed = new Set((await client.query(\"SELECT node_id FROM content_instance_nodes WHERE instance_id=$1 AND state='completed'\", [instanceId])).rows.map(row => row.node_id));\n      const states = qualityStates(facts, ch.account_id);\n      qualityContext = { board, completed, states, knownEvidence: new Set(board.instance.nodes\n        .filter(node => node.type === 'evidence' && node.state === COMPLETE).map(node => node.id)) };\n      const authorizedNodes = new Set(board.instance.nodes.filter(node => node.state === COMPLETE).map(node => node.id));\n      if (design && !qualitySpoilerAllows(design, selected.id, authorizedNodes)) {\n        fail('unknown_action', 'That scene has not been revealed to you.');\n      }\n      if (design && !qualityRevelationAllowed(design, selected.id, completed, states.shared, graph.nodeById)) {\n        fail('npc_knowledge', 'This conversation requires information the witness has not learned.');\n      }\n      if (design && selected.type === 'choice') {\n        const participants = (await memberRows(client, instanceId)).map(row => ({ id: qualityMemberId(instanceId, row.account_id) }));\n        if ((participants.length > 1 && !states.shared.delegations[selected.id])\n          || !qualityMandateAllows(states.shared, selected.id, qualityMemberId(instanceId, ch.account_id), participants)) {\n          fail('decision_acknowledgement', 'Agree on a scene delegate and acknowledge the decision before committing.');\n        }\n      }\n    }\n    let result;\n    if (selected.type === 'puzzle') {\n      const payload = narrativeVariant(selected, instance.id);\n",
          "baseline": "    )).rows[0];\n    if (progress?.state !== 'available') fail('unknown_action', 'That node is not currently actionable.');\n    assertNodeGates(ch, h, selected, graph, member.role_id);\n    let result;\n    if (selected.type === 'puzzle') {\n      const payload = narrativeVariant(selected, instance.id);\n"
        },
        {
          "at": 65427,
          "current": "        let matched;\n        if (NARRATIVE_VERIFIERS.includes(spec.payload.verifier)) {\n          if (submitted[0] !== 'submission') fail('bad_request', 'This investigation requires its issued structured submission.');\n          const checked = verifyNarrativeSubmission(spec, payload.interaction, opts.submission,\n            { knownEvidenceNodeIds: qualityContext?.knownEvidence || new Set() });\n          if (!checked.valid) fail('bad_request', 'The submission must use only the issued items and slots.');\n          matched = checked.matched;\n        } else {\n",
          "baseline": "        let matched;\n        if (NARRATIVE_VERIFIERS.includes(spec.payload.verifier)) {\n          if (submitted[0] !== 'submission') fail('bad_request', 'This investigation requires its issued structured submission.');\n          const checked = verifyNarrativeSubmission(spec, payload.interaction, opts.submission);\n          if (!checked.valid) fail('bad_request', 'The submission must use only the issued items and slots.');\n          matched = checked.matched;\n        } else {\n"
        },
        {
          "at": 66807,
          "current": "        result = { hintLevel: Number(previous.hintLevel || 0), attempts, suspicion, matched,\n          ...(matched ? { outcome: 'success', summary: payload.summary || null }\n            : complication ? { outcome: 'complication', summary: payload.failForward.summary }\n              : { feedback: spec.payload.verifier === 'proof_sets'\n                ? 'Your selected evidence does not establish the conclusion as a complete chain. Compare the stated assumptions with independent observations; selecting every clue does not make a proof.'\n                : 'The evidence does not support that reconstruction. Review your clues or request a hint.' }) };\n      }\n      if (!result.outcome) {\n        await client.query('UPDATE content_instance_nodes SET result_json=$3 WHERE instance_id=$1 AND node_id=$2',\n",
          "baseline": "        result = { hintLevel: Number(previous.hintLevel || 0), attempts, suspicion, matched,\n          ...(matched ? { outcome: 'success', summary: payload.summary || null }\n            : complication ? { outcome: 'complication', summary: payload.failForward.summary }\n              : { feedback: 'The evidence does not support that reconstruction. Review your clues or request a hint.' }) };\n      }\n      if (!result.outcome) {\n        await client.query('UPDATE content_instance_nodes SET result_json=$3 WHERE instance_id=$1 AND node_id=$2',\n"
        },
        {
          "at": 68175,
          "current": "      }\n      const choice = selected.payload.options.find((option) => option.id === opts?.choiceId);\n      if (!choice) fail('unknown_action', 'That choice was not offered.');\n      const procedure = design?.procedures?.find(item => item.nodeId === selected.id);\n      if (procedure && choice.id === procedure.skipOptionId && h.authoredStoryFlags.get(procedure.masteryFlag) !== 'learned') {\n        fail('procedure_unlearned', 'Complete this procedure once before using its shortcut.');\n      }\n      assertNodeGates(ch, h, { payload: { gates: choice.gates || [] } }, graph, member.role_id,\n        { option: true });\n      await recordStoryFlags(client, graph, instance, ch, selected, choice);\n",
          "baseline": "      }\n      const choice = selected.payload.options.find((option) => option.id === opts?.choiceId);\n      if (!choice) fail('unknown_action', 'That choice was not offered.');\n      assertNodeGates(ch, h, { payload: { gates: choice.gates || [] } }, graph, member.role_id,\n        { option: true });\n      await recordStoryFlags(client, graph, instance, ch, selected, choice);\n"
        },
        {
          "at": 68967,
          "current": "    } else fail('unknown_action', 'That node is not executable.');\n    await completeNode(client, instanceId, selected.id,\n      { accountId: ch.account_id, characterId: ch.id }, result);\n    const learned = design?.procedures?.find(item => item.learnNodeId === selected.id);\n    if (learned && result.matched === true) {\n      await client.query(\n        `INSERT INTO content_story_flags\n          (account_id,flag_key,flag_kind,flag_value,title,source_namespace,source_version,source_instance_id,source_node_id,source_choice_id)\n         VALUES ($1,$2,'case_evidence','learned',$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,\n        [ch.account_id, learned.masteryFlag, 'Practiced procedure', instance.namespace, instance.version,\n          instanceId, selected.id, learned.learnOptionId],\n      );\n    }\n    await cascade(client, graph, instance, { accountId: ch.account_id, characterId: ch.id });\n  }\n  await client.query('UPDATE content_instances SET revision=revision+1 WHERE id=$1', [instanceId]);\n",
          "baseline": "    } else fail('unknown_action', 'That node is not executable.');\n    await completeNode(client, instanceId, selected.id,\n      { accountId: ch.account_id, characterId: ch.id }, result);\n    await cascade(client, graph, instance, { accountId: ch.account_id, characterId: ch.id });\n  }\n  await client.query('UPDATE content_instances SET revision=revision+1 WHERE id=$1', [instanceId]);\n"
        },
        {
          "at": 70075,
          "current": "  return projection(ch, next, bundle, client, h);\n}\n\n// Private reasoning is stored separately from public progress. The instance lock serializes\n// disclosures/mandates across actors; the private revision catches a second tab's lost update.\nexport async function actOnContentQuality(ch, instanceId, opts, client, h) {\n  const instance = await lockedInstance(client, instanceId);\n  const bundle = await loadBundle(client, instance.namespace, Number(instance.version), instance.content_hash);\n  const graph = graphOf(bundle), design = qualityDesign(graph);\n  if (!design) fail('unsupported_content_feature', 'This case does not use the quality workbench.');\n  const board = await projection(ch, instance, bundle, client, h);\n  await assertRevision(ch, instance, opts?.expectedRevision, bundle, client, h);\n  const members = await memberRows(client, instanceId);\n  const facts = (await client.query('SELECT fact_key, value_json FROM content_instance_facts WHERE instance_id=$1', [instanceId]))\n    .rows.map(row => ({ key: row.fact_key, value: parseJson(row.value_json) }));\n  const states = qualityStates(facts, ch.account_id);\n  const completed = new Set((await client.query(\"SELECT node_id FROM content_instance_nodes WHERE instance_id=$1 AND state='completed'\", [instanceId])).rows.map(row => row.node_id));\n  let outcome;\n  try { outcome = applyQualityOperation(design, {\n    instance, accountId: ch.account_id, members, completed, nodeById: graph.nodeById,\n    actions: board.instance.actions, knownEvidence: new Set(board.instance.quality.evidence.map(item => item.id)), now: Date.now(),\n  }, states.actor, states.shared, opts); }\n  catch (error) { if (error.code === 'stale_quality') error.data = board; throw error; }\n  if (outcome.publicChange) await validateCurrentPartyAuthority(client, graph, instance);\n  const persist = (key, value) => client.query(\n    `INSERT INTO content_instance_facts (instance_id,fact_key,value_json,set_by_node_id)\n     VALUES ($1,$2,$3,'runtime') ON CONFLICT (instance_id,fact_key)\n     DO UPDATE SET value_json=EXCLUDED.value_json, set_at=now()`, [instanceId, key, JSON.stringify(value)],\n  );\n  await persist(qualityActorKey(ch.account_id), outcome.actor);\n  if (outcome.publicChange) {\n    await persist(QUALITY_SHARED_KEY, outcome.shared);\n    for (const nodeId of outcome.revealNodeIds) {\n      const node = graph.nodeById.get(nodeId);\n      if (node?.type !== 'evidence') fail('unsupported_content_feature', 'A quality operation may reveal only authored evidence.');\n      await completeNode(client, instanceId, nodeId, { accountId: ch.account_id, characterId: ch.id });\n    }\n    await cascade(client, graph, instance, { accountId: ch.account_id, characterId: ch.id });\n    await client.query('UPDATE content_instances SET revision=revision+1 WHERE id=$1', [instanceId]);\n  }\n  const next = (await client.query('SELECT * FROM content_instances WHERE id=$1', [instanceId])).rows[0];\n  return projection(ch, next, bundle, client, h);\n}\n\nexport async function leaveContentInstance(ch, instanceId, opts, client, h) {\n  const instance = await lockedInstance(client, instanceId);\n  const bundle = await loadBundle(client, instance.namespace, Number(instance.version), instance.content_hash);\n",
          "baseline": "  return projection(ch, next, bundle, client, h);\n}\n\nexport async function leaveContentInstance(ch, instanceId, opts, client, h) {\n  const instance = await lockedInstance(client, instanceId);\n  const bundle = await loadBundle(client, instance.namespace, Number(instance.version), instance.content_hash);\n"
        }
      ]
    },
    "src/questing-contract.js": {
      "current": {
        "mode": "100644",
        "blob": "1f55e3ba51943d96da89a3ff38b381e8ad65941b",
        "sha256": "15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71",
        "bytes": 7874
      },
      "baseline": {
        "mode": "100644",
        "blob": "07424135def851f11f7c90a6046f96ebee06c5a8",
        "sha256": "e9fb4d63be72493ccd5607139f785ab9e9f6940e8c6593ee7de46a994a928f71",
        "bytes": 7777
      },
      "inverses": [
        {
          "at": 1266,
          "current": "};\n\nexport const QUESTING_SCHEMAS = {\n  ContentInteractionItem: object({ id: string, label: string, description: string, evidenceNodeId: string }, ['id', 'label']),\n  ContentInteraction: object({\n    kind: { type: 'string', enum: ['deduction', 'interrogation', 'timeline', 'scene', 'planning', 'stealth', 'inventory'] },\n    mode: { type: 'string', enum: ['ordered_ids', 'unordered_ids', 'mapping', 'proof_sets'] },\n    items: array(ref('ContentInteractionItem'), 64), slots: array(ref('ContentInteractionItem'), 64),\n    conclusions: array(ref('ContentInteractionItem'), 64),\n  }, ['kind', 'mode', 'items']),\n  ContentExpectations: object({ durationMinutes: { type: 'integer', minimum: 1 }, difficulty: string,\n    summary: string, reasoning: string, combat: string, group: string, commitments: array(string) }, []),\n",
          "baseline": "};\n\nexport const QUESTING_SCHEMAS = {\n  ContentInteractionItem: object({ id: string, label: string, description: string }, ['id', 'label']),\n  ContentInteraction: object({\n    kind: { type: 'string', enum: ['deduction', 'interrogation', 'timeline', 'scene', 'planning', 'stealth', 'inventory'] },\n    mode: { type: 'string', enum: ['ordered_ids', 'unordered_ids', 'mapping'] },\n    items: array(ref('ContentInteractionItem'), 64), slots: array(ref('ContentInteractionItem'), 64),\n  }, ['kind', 'mode', 'items']),\n  ContentExpectations: object({ durationMinutes: { type: 'integer', minimum: 1 }, difficulty: string,\n    summary: string, reasoning: string, combat: string, group: string, commitments: array(string) }, []),\n"
        }
      ]
    },
    "src/routes/content.js": {
      "current": {
        "mode": "100644",
        "blob": "0a1372dd01583318f56df074a97b66378e034d83",
        "sha256": "12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e",
        "bytes": 15132
      },
      "baseline": {
        "mode": "100644",
        "blob": "0b22de016f9f781fe3f64aca3c772edee571f392",
        "sha256": "b84e686e218b5fcd6a78500780e05d3f73c7f8dfd70f1a2d5145664d8f594e4d",
        "bytes": 14366
      },
      "inverses": [
        {
          "at": 96,
          "current": "// Account, character, organization, participant kind, and effect authority are always derived by\n// the runtime; handlers copy only the caller choices defined by the public contract.\nimport * as G from '../game.js';\nimport { QUEST_QUALITY_BODY } from '../quest-quality-contracts.js';\nimport {\n  activateContentBundle,\n  contentBoard,\n",
          "baseline": "// Account, character, organization, participant kind, and effect authority are always derived by\n// the runtime; handlers copy only the caller choices defined by the public contract.\nimport * as G from '../game.js';\nimport {\n  activateContentBundle,\n  contentBoard,\n"
        },
        {
          "at": 480,
          "current": "  joinContentInstance,\n  setContentConsent,\n  actOnContentInstance,\n  actOnContentQuality,\n  leaveContentInstance,\n  claimContentRewards,\n  addContentCaseNote,\n",
          "baseline": "  joinContentInstance,\n  setContentConsent,\n  actOnContentInstance,\n  leaveContentInstance,\n  claimContentRewards,\n  addContentCaseNote,\n"
        },
        {
          "at": 2425,
          "current": "      properties: {\n        ids: { type: 'array', maxItems: 64, items: { type: 'string', minLength: 1, maxLength: 160 } },\n        assignments: { type: 'object', maxProperties: 64, additionalProperties: { type: 'string', minLength: 1, maxLength: 160 } },\n        conclusionId: { type: 'string', minLength: 1, maxLength: 160 },\n        evidenceIds: { type: 'array', minItems: 1, maxItems: 64, uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 160 } },\n      },\n      oneOf: [{ required: ['ids'] }, { required: ['assignments'] }, { required: ['conclusionId', 'evidenceIds'] }],\n    },\n    hint: { type: 'boolean' },\n  },\n",
          "baseline": "      properties: {\n        ids: { type: 'array', maxItems: 64, items: { type: 'string', minLength: 1, maxLength: 160 } },\n        assignments: { type: 'object', maxProperties: 64, additionalProperties: { type: 'string', minLength: 1, maxLength: 160 } },\n      },\n      oneOf: [{ required: ['ids'] }, { required: ['assignments'] }],\n    },\n    hint: { type: 'boolean' },\n  },\n"
        },
        {
          "at": 5305,
          "current": "    for (const [name, item] of Object.entries(value)) {\n      const child = Object.hasOwn(rule.properties || {}, name) ? rule.properties[name]\n        : typeof rule.additionalProperties === 'object' ? rule.additionalProperties : null;\n      if (!child && rule.additionalProperties === false) invalidBody(`Unexpected request field: ${key}.${name}.`);\n      if (child) strictValue(child, item, `${key}.${name}`);\n    }\n  }\n",
          "baseline": "    for (const [name, item] of Object.entries(value)) {\n      const child = Object.hasOwn(rule.properties || {}, name) ? rule.properties[name]\n        : typeof rule.additionalProperties === 'object' ? rule.additionalProperties : null;\n      if (child) strictValue(child, item, `${key}.${name}`);\n    }\n  }\n"
        },
        {
          "at": 6744,
          "current": "  try {\n    return await run();\n  } catch (error) {\n    if (!['stale_instance', 'stale_content', 'stale_quality'].includes(error?.code)) throw error;\n    return reply.code(409).send({\n      error: error.code,\n      message: error.message,\n",
          "baseline": "  try {\n    return await run();\n  } catch (error) {\n    if (!['stale_instance', 'stale_content'].includes(error?.code)) throw error;\n    return reply.code(409).send({\n      error: error.code,\n      message: error.message,\n"
        },
        {
          "at": 13244,
          "current": "        hint: req.body?.hint,\n      }, client, h))));\n\n  app.post('/v1/content/instances/:instanceId/quality', guarded(auth, QUEST_QUALITY_BODY), async (req, reply) =>\n    instanceMutation(reply, () => G.withCharacter(pool, req.user.sub, (ch, client, h) =>\n      actOnContentQuality(ch, req.params.instanceId, req.body, client, h))));\n\n  app.post('/v1/content/instances/:instanceId/leave', guarded(auth, revisionBody), async (req, reply) =>\n    instanceMutation(reply, () => G.withCharacter(pool, req.user.sub, (ch, client, h) =>\n      leaveContentInstance(ch, req.params.instanceId, {\n",
          "baseline": "        hint: req.body?.hint,\n      }, client, h))));\n\n  app.post('/v1/content/instances/:instanceId/leave', guarded(auth, revisionBody), async (req, reply) =>\n    instanceMutation(reply, () => G.withCharacter(pool, req.user.sub, (ch, client, h) =>\n      leaveContentInstance(ch, req.params.instanceId, {\n"
        }
      ]
    },
    "src/server.js": {
      "current": {
        "mode": "100644",
        "blob": "92440c32427833c38482d90aec227520b8884587",
        "sha256": "46ebb6c6eb7e17d316cff75aeaeb6579344452cbba9ed3b4d153e01ad07e96c0",
        "bytes": 309614
      },
      "baseline": {
        "mode": "100644",
        "blob": "06879f17622e4e8983483fc1087144518e941032",
        "sha256": "e69fef7e92cec791f0293a539ebf23f2c1740f61031bfe00197712954a47207d",
        "bytes": 309521
      },
      "inverses": [
        {
          "at": 47222,
          "current": "    ['ux-social.js', 'application/javascript'], ['ux-social.css', 'text/css'],\n    ['ux-navigation.js', 'application/javascript'], ['ux-navigation.css', 'text/css'],\n    ...['feel', 'tools', 'identity', 'story', 'community', 'quests', 'clues'].flatMap(name => [[`ux-${name}.js`, 'application/javascript'], [`ux-${name}.css`, 'text/css']]),\n    ['ux-quest-quality.js', 'application/javascript'], ['ux-quest-quality.css', 'text/css'],\n    ['ux-workspace.js', 'application/javascript'], ['ux-world.js', 'application/javascript'], ['ux-world.css', 'text/css'],\n    ['ux-tactics.js', 'application/javascript'], ['ux-tactics.css', 'text/css'],\n    ['ux-investigation.js', 'application/javascript'], ['ux-investigation.css', 'text/css'],\n",
          "baseline": "    ['ux-social.js', 'application/javascript'], ['ux-social.css', 'text/css'],\n    ['ux-navigation.js', 'application/javascript'], ['ux-navigation.css', 'text/css'],\n    ...['feel', 'tools', 'identity', 'story', 'community', 'quests', 'clues'].flatMap(name => [[`ux-${name}.js`, 'application/javascript'], [`ux-${name}.css`, 'text/css']]),\n    ['ux-workspace.js', 'application/javascript'], ['ux-world.js', 'application/javascript'], ['ux-world.css', 'text/css'],\n    ['ux-tactics.js', 'application/javascript'], ['ux-tactics.css', 'text/css'],\n    ['ux-investigation.js', 'application/javascript'], ['ux-investigation.css', 'text/css'],\n"
        }
      ]
    },
    "test/content-api.js": {
      "current": {
        "mode": "100644",
        "blob": "0eaf8caf9049234233f32de4b0793310e306391a",
        "sha256": "af8662191fd428d95072e82de96ab6d12fedda3d1207d040665cb32244dc33cb",
        "bytes": 22828
      },
      "baseline": {
        "mode": "100644",
        "blob": "a16f83efaa68c33809bede7f396e5a02048a552f",
        "sha256": "649db44938d8aa4ad3ec4fbcae4a626b86af08367fdee0a79e91be3bc56d09f6",
        "bytes": 22679
      },
      "inverses": [
        {
          "at": 2051,
          "current": "  { method: 'POST', url: '/v1/content/instances/:instanceId/join', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/consent', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/act', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/quality', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/leave', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/notes', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/release', hasAuth: true, isMod: false },\n",
          "baseline": "  { method: 'POST', url: '/v1/content/instances/:instanceId/join', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/consent', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/act', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/leave', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/notes', hasAuth: true, isMod: false },\n  { method: 'POST', url: '/v1/content/instances/:instanceId/release', hasAuth: true, isMod: false },\n"
        },
        {
          "at": 3560,
          "current": "  '/v1/content/instances/{instanceId}/join',\n  '/v1/content/instances/{instanceId}/consent',\n  '/v1/content/instances/{instanceId}/act',\n  '/v1/content/instances/{instanceId}/quality',\n  '/v1/content/instances/{instanceId}/leave',\n  '/v1/content/instances/{instanceId}/notes',\n  '/v1/content/instances/{instanceId}/release',\n",
          "baseline": "  '/v1/content/instances/{instanceId}/join',\n  '/v1/content/instances/{instanceId}/consent',\n  '/v1/content/instances/{instanceId}/act',\n  '/v1/content/instances/{instanceId}/leave',\n  '/v1/content/instances/{instanceId}/notes',\n  '/v1/content/instances/{instanceId}/release',\n"
        }
      ]
    },
    "test/site-basics-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "80288a2904df0a8f25a0b0afeb6eb940a6171d8c",
        "sha256": "6cadcc83aaad11244457b751efc38b660c3ec29e3fe9949bbb845ebeb7924cf2",
        "bytes": 6573
      },
      "baseline": {
        "mode": "100644",
        "blob": "506ec6f01c083992674222c2362884900160abee",
        "sha256": "3165ca32398a1e1c9a197ad11cdd3a71e5a510747acdf97c6adb94a4b3102e2f",
        "bytes": 5689
      },
      "inverses": [
        {
          "at": 131,
          "current": "import fs from 'node:fs';\nimport { createHash } from 'node:crypto';\nimport { execFileSync } from 'node:child_process';\nimport { questQualityHistoricalInput, questQualityHistoricalEntry } from '../tools/quest-quality-source-transfer.js';\nimport { SITE_BASICS_SOURCE as source, qualifySiteBasicsSource,\n  siteBasicsHistoricalInput, siteBasicsHistoricalEntry, siteBasicsSourceDataBytes } from '../tools/site-basics-source-transfer.js';\n\n",
          "baseline": "import fs from 'node:fs';\nimport { createHash } from 'node:crypto';\nimport { execFileSync } from 'node:child_process';\nimport { SITE_BASICS_SOURCE as source, qualifySiteBasicsSource,\n  siteBasicsHistoricalInput, siteBasicsHistoricalEntry, siteBasicsSourceDataBytes } from '../tools/site-basics-source-transfer.js';\n\n"
        },
        {
          "at": 2268,
          "current": "  siteBasicsSourceDataBytes(source), 'The only self-reference is complete generated data without executable additions');\nlet positives = 0, refusals = 0;\nfunction actual(file, pin) {\n  const committed = git('show', 'HEAD:' + file), authored = git('show', source.revision + ':' + file);\n  const stat = fs.lstatSync(file), physical = fs.readFileSync(file);\n  assert(stat.isFile() && !stat.isSymbolicLink());\n  assert(physical.equals(Buffer.from(committed)) || physical.equals(Buffer.from(committed.replaceAll('\\n', '\\r\\n'))),\n    'Actual whole committed and physical source qualify before historical comparison: ' + file);\n  const actualBlob = createHash('sha1').update('blob ' + Buffer.byteLength(committed) + '\\0').update(committed).digest('hex');\n  assert.equal(git('ls-tree', 'HEAD', '--', file).trim(), pin.mode + ' blob ' + actualBlob + '\\t' + file);\n  assert.equal(git('ls-files', '--stage', '--', file).trim(), pin.mode + ' ' + actualBlob + ' 0\\t' + file);\n  const text = questQualityHistoricalInput(file, committed), raw = questQualityHistoricalInput(file, physical);\n  assert.equal(text, authored, 'Whole authored source remains the actual committed source: ' + file);\n  assert.equal(sha(text), pin.sha256); assert.equal(Buffer.byteLength(text), pin.bytes);\n  const entry = pin.mode + ' blob ' + pin.blob + '\\t' + file;\n  assert.equal(questQualityHistoricalEntry(file, git('ls-tree', 'HEAD', '--', file).trim(), 'tree'), entry);\n  assert.equal(questQualityHistoricalEntry(file, git('ls-files', '--stage', '--', file).trim(), 'index'), pin.mode + ' ' + pin.blob + ' 0\\t' + file);\n  assert(raw.equals(Buffer.from(text)) || raw.equals(Buffer.from(text.replaceAll('\\n', '\\r\\n'))),\n    'Complete physical UTF-8 source is uniformly LF/CRLF: ' + file);\n  return { text, raw, entry };\n",
          "baseline": "  siteBasicsSourceDataBytes(source), 'The only self-reference is complete generated data without executable additions');\nlet positives = 0, refusals = 0;\nfunction actual(file, pin) {\n  const text = git('show', 'HEAD:' + file), authored = git('show', source.revision + ':' + file);\n  const stat = fs.lstatSync(file), raw = fs.readFileSync(file);\n  assert(stat.isFile() && !stat.isSymbolicLink());\n  assert.equal(text, authored, 'Whole authored source remains the actual committed source: ' + file);\n  assert.equal(sha(text), pin.sha256); assert.equal(Buffer.byteLength(text), pin.bytes);\n  const entry = pin.mode + ' blob ' + pin.blob + '\\t' + file;\n  assert.equal(git('ls-tree', 'HEAD', '--', file).trim(), entry);\n  assert.equal(git('ls-files', '--stage', '--', file).trim(), pin.mode + ' ' + pin.blob + ' 0\\t' + file);\n  assert(raw.equals(Buffer.from(text)) || raw.equals(Buffer.from(text.replaceAll('\\n', '\\r\\n'))),\n    'Complete physical UTF-8 source is uniformly LF/CRLF: ' + file);\n  return { text, raw, entry };\n"
        }
      ]
    },
    "tools/site-basics-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "db9ee342cc202e65fbe0e94fdc39f48326894300",
        "sha256": "db3d976269d94dd27d47f98534b72799b2887bb501e647e50a7fe6bca1f47d84",
        "bytes": 4797
      },
      "baseline": {
        "mode": "100644",
        "blob": "331bded367cd3b7b80862017913ecfcae307f47f",
        "sha256": "cd9cfbdf3d870d10524dfb82af54c862f008bf5e93b9c79bf7559363d40bc258",
        "bytes": 4576
      },
      "inverses": [
        {
          "at": 96,
          "current": "import assert from 'node:assert/strict';\nimport { createHash } from 'node:crypto';\nimport { SITE_BASICS_SOURCE, SITE_BASICS_SOURCE_SHA256 } from './site-basics-source-data.js';\nimport { questQualityHistoricalInput, questQualityHistoricalEntry } from './quest-quality-source-transfer.js';\n\nexport { SITE_BASICS_SOURCE };\nconst sha = text => createHash('sha256').update(text).digest('hex');\n",
          "baseline": "import assert from 'node:assert/strict';\nimport { createHash } from 'node:crypto';\nimport { SITE_BASICS_SOURCE, SITE_BASICS_SOURCE_SHA256 } from './site-basics-source-data.js';\n\nexport { SITE_BASICS_SOURCE };\nconst sha = text => createHash('sha256').update(text).digest('hex');\n"
        },
        {
          "at": 3718,
          "current": "}\n// Unknown or partial changes remain untouched so immutable downstream qualifiers reject them.\nexport function siteBasicsHistoricalInput(file, input) {\n  input = questQualityHistoricalInput(file, input);\n  if (!known(file)) return input;\n  const current = canonical(input), row = SITE_BASICS_SOURCE.files[file];\n  if (!current || sha(current.lf) !== row.current.sha256) return input;\n",
          "baseline": "}\n// Unknown or partial changes remain untouched so immutable downstream qualifiers reject them.\nexport function siteBasicsHistoricalInput(file, input) {\n  if (!known(file)) return input;\n  const current = canonical(input), row = SITE_BASICS_SOURCE.files[file];\n  if (!current || sha(current.lf) !== row.current.sha256) return input;\n"
        },
        {
          "at": 4234,
          "current": "}\nexport function siteBasicsHistoricalEntry(file, entry, kind) {\n  assert(kind === 'tree' || kind === 'index');\n  entry = questQualityHistoricalEntry(file, entry, kind);\n  if (!known(file)) return entry;\n  const row = SITE_BASICS_SOURCE.files[file];\n  const format = pin => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\\t' + file\n",
          "baseline": "}\nexport function siteBasicsHistoricalEntry(file, entry, kind) {\n  assert(kind === 'tree' || kind === 'index');\n  if (!known(file)) return entry;\n  const row = SITE_BASICS_SOURCE.files[file];\n  const format = pin => kind === 'tree' ? pin.mode + ' blob ' + pin.blob + '\\t' + file\n"
        }
      ]
    }
  },
  "additions": {
    "content/packs/quest-quality-favors/pack.json": {
      "mode": "100644",
      "blob": "93484b45f713ff5c60da70fd193f1a43b78fc99e",
      "sha256": "c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71",
      "bytes": 18533
    },
    "content/packs/quest-quality-field-notes/pack.json": {
      "mode": "100644",
      "blob": "698b9b3c219cd4f2f9b60d6177f9491c12637e05",
      "sha256": "c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a",
      "bytes": 18929
    },
    "content/packs/quest-quality-last-ferry/pack.json": {
      "mode": "100644",
      "blob": "8fbc96b5850458d199d078f68c9332c9e224fc00",
      "sha256": "ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881",
      "bytes": 17307
    },
    "content/packs/quest-quality-night-edition/pack.json": {
      "mode": "100644",
      "blob": "92933602c6681b6045ebad7d18821b3544b54ada",
      "sha256": "1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1",
      "bytes": 18722
    },
    "content/packs/quest-quality-open-office/pack.json": {
      "mode": "100644",
      "blob": "4649538d79145e9449b21cd4b2cbe4ad4a6d2e7d",
      "sha256": "97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff",
      "bytes": 25299
    },
    "content/packs/quest-quality-payday/pack.json": {
      "mode": "100644",
      "blob": "869bc45f4b54c1cbbd89784d223c12bb1ea8066f",
      "sha256": "855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed",
      "bytes": 19574
    },
    "content/packs/quest-quality-shared-meaning/pack.json": {
      "mode": "100644",
      "blob": "031b239d68905d67338cc97e424ff9cb7963cd76",
      "sha256": "cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072",
      "bytes": 14592
    },
    "content/packs/quest-quality-small-fire/pack.json": {
      "mode": "100644",
      "blob": "de555248801b2a66445b9e798b99c2946048f341",
      "sha256": "64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7",
      "bytes": 24604
    },
    "content/packs/quest-quality-truce/pack.json": {
      "mode": "100644",
      "blob": "f74fb25f22e7ff80c1716a3f1e7d4c2b01432115",
      "sha256": "2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08",
      "bytes": 18805
    },
    "content/packs/quest-three-witnesses-v2/pack.json": {
      "mode": "100644",
      "blob": "106a4aee8f37882bc65ca2a5b957752d91a71ef7",
      "sha256": "294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423",
      "bytes": 45669
    },
    "public/ux-quest-quality.css": {
      "mode": "100644",
      "blob": "48a87cff55328ae53ec017de6dbec0e77222f7c4",
      "sha256": "8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f",
      "bytes": 2401
    },
    "public/ux-quest-quality.js": {
      "mode": "100644",
      "blob": "4d2fa08eb0170d09678b912df450e46373a65c77",
      "sha256": "ebd0f32f0c43727b1176c5ef71afdf74ab5d7bd6d7afd60dce7aa6121ac4f2f7",
      "bytes": 34223
    },
    "src/content/quality-runtime.js": {
      "mode": "100644",
      "blob": "94ef1b0f38e07f8c7d3158256629cf6dc1f0e931",
      "sha256": "d20578c59bc3ed2765b34e89b828b47c9c4c791d249da07a9f9758580e1f7154",
      "bytes": 17323
    },
    "src/content/quality.js": {
      "mode": "100644",
      "blob": "f561fe2fd9f858979ece7cb971b1272511339e69",
      "sha256": "94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4",
      "bytes": 24924
    },
    "src/content/quest-quality-packs.js": {
      "mode": "100644",
      "blob": "77dc8b053325ceb554bee072e821c040a8a451e4",
      "sha256": "fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9",
      "bytes": 1804
    },
    "src/quest-quality-contracts.js": {
      "mode": "100644",
      "blob": "0e060732b49e13979687585f8cd7c15261d2ab03",
      "sha256": "b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395",
      "bytes": 5452
    },
    "test/lib/quest-quality-fixture.js": {
      "mode": "100644",
      "blob": "955a70522014eb26f28b73bbbcd5395f3c9c28c7",
      "sha256": "316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b",
      "bytes": 4103
    },
    "test/quest-quality-api.js": {
      "mode": "100644",
      "blob": "87f2648e6b6761ca82fc21f3127836f279e684cb",
      "sha256": "eb06739d7e08a8124b9a91371de7ea2b314339dd20f5a3451138efc08441bd8e",
      "bytes": 3896
    },
    "test/quest-quality-browser.js": {
      "mode": "100644",
      "blob": "084b4643e7794f973dc2da13d7e5a816dad5e14b",
      "sha256": "a11d2e23ce21ce24179fa44d641cb5621b58d8ec271ff6020bcb024068300722",
      "bytes": 35211
    },
    "test/quest-quality-content.js": {
      "mode": "100644",
      "blob": "12fcad9a55093fc31af2aca520fcd5fccdd1fa14",
      "sha256": "0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266",
      "bytes": 13832
    },
    "test/quest-quality-postgres.js": {
      "mode": "100644",
      "blob": "0732a4a84c885074e6c1d531df3a1f5f29d736e7",
      "sha256": "2db2c58279dc1eb0c9eb48960700ef9b60882fb31e43add707e78dcc7228d400",
      "bytes": 8361
    },
    "test/quest-quality-rules.js": {
      "mode": "100644",
      "blob": "cf7f60a14c4e437220de7beb7b2fcf0c91ac99b6",
      "sha256": "a826d549449bfff306a42553d5c218412d0b903d7acc0756791787cb19211b08",
      "bytes": 16410
    },
    "test/quest-quality-runtime.js": {
      "mode": "100644",
      "blob": "5cf9b917427f120ef8afae98b9148f2ef3c222d6",
      "sha256": "8aa0244b1c56403f9875fa4621150048d320899d9ce5bcbcbb9b6a9f051e3606",
      "bytes": 5665
    },
    "test/quest-quality-social.js": {
      "mode": "100644",
      "blob": "98f96d85f8a1575ea8fdbbba36369eb70437d95b",
      "sha256": "5258dc676258f660d2e88573af1d2a87eb1ba42f6fd43d783000cf767fc54cb8",
      "bytes": 6894
    },
    "test/quest-quality-source-transfer.js": {
      "mode": "100644",
      "blob": "36d6f0a122dcfc348d67d3e02024100cdbeb40ea",
      "sha256": "5a2caf105a177c9c3abf9da39d4e8e5e5ec7584820c18c53ed7806298afc17ab",
      "bytes": 5627
    },
    "test/quest-quality-spoilers.js": {
      "mode": "100644",
      "blob": "a57b861cb7bd81a4ead4a2117c85a8e09f8a4ef0",
      "sha256": "55fc0fc6512934fccfdf3628b5f178b95fe27722753aba704b1acc515d8876e4",
      "bytes": 3458
    },
    "test/quest-quality-stateful.js": {
      "mode": "100644",
      "blob": "10894777fbbc351a5b56d9cea6df5cc9e27def1d",
      "sha256": "25b514da3ba7440638639362b814c4145ade0f5050b0297a4c6b39d3bc3e51df",
      "bytes": 3525
    },
    "test/quest-quality-studio.js": {
      "mode": "100644",
      "blob": "c9a54a262f1463a52a200abc00ca6e2947307859",
      "sha256": "7312af34a011503deb2cd3a36ea4f9b667ddc9cc57c6de7e2ef384121ff944f6",
      "bytes": 8306
    },
    "test/quest-quality-study.js": {
      "mode": "100644",
      "blob": "9577ef10f7296a8a0c9b80cafb9ad87065bf75ef",
      "sha256": "6043fb8143c39ce3b1d418265670565faae908006e07d7760c0cef5f2c5a896b",
      "bytes": 2448
    },
    "tools/quest-quality-source-seal.js": {
      "mode": "100644",
      "blob": "30a430199938442455832833a636343760d38746",
      "sha256": "3f7be2d52270ebdd9e37948a876f60585206c3f01dc6a5424c99cc6ce4e7aeb9",
      "bytes": 4207
    },
    "tools/quest-quality-source-transfer.js": {
      "mode": "100644",
      "blob": "3d6d170776daa1d8db03f1be6d45eedd9f814210",
      "sha256": "03625e6a5ae0d753ebb8ee955149070e8b4373fc49c0b684fed3966763216940",
      "bytes": 4654
    },
    "tools/quest-quality-studio.js": {
      "mode": "100644",
      "blob": "91f99a49c57d14a997bc3d59f7b1b332171d8e77",
      "sha256": "997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52",
      "bytes": 19938
    },
    "tools/quest-quality-study.js": {
      "mode": "100644",
      "blob": "14c075150925d69bfe843dec555895d75a6d0328",
      "sha256": "856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01",
      "bytes": 4242
    },
    "tools/quest-quality-workgraph.js": {
      "mode": "100644",
      "blob": "f88a3252501ca70d01480192e288bcf43c9ca693",
      "sha256": "c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11",
      "bytes": 5711
    }
  }
});
export const QUEST_QUALITY_SOURCE_SHA256 = '6a052c0f088a4c87c12a6790cc8b8c351afb7ddf92a64cf07e4201604c391d54';
