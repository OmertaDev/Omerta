// Exact crime-minigame historical comparison only; no execution or deployment results transferred.
const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const CRIME_MINIGAME_SOURCE = freeze({
  "status": "SEALED",
  "phase": "EXACT_CRIME_MINIGAME_SOURCE_COMPARISON_ONLY",
  "revision": "addba06178838091ed97747b57824461dfcdd4a3",
  "tree": "e0a5ecb685f9891354615bdfc6fe5754aa9f9ed4",
  "predecessor": "9cf7ced8beedd0950018a14bbab71b08b71a3d5b",
  "predecessorTree": "9477c277cca6b47b3a3ce20901e85a451243642f",
  "files": {
    "AGENTS.md": {
      "current": {
        "mode": "100644",
        "blob": "e2b9e3c8c1f12c36e48e088c2c97da9ed7f39fbd",
        "bytes": 53102,
        "sha256": "2eaf0e5cb5631659974f7fbfb857a4ca9aed6b287d7051d2c61a9646fbcbc31c"
      },
      "baseline": {
        "mode": "100644",
        "blob": "5f0f0fa5343c3de31679c1a43ee258d2074fdd66",
        "bytes": 52177,
        "sha256": "ca2361d56588728be04b1cf735789ffd125243cfa44ef26dd3c0d26a43f04ba3"
      },
      "inverses": [
        {
          "at": 8960,
          "current": "# 5. Complete the required lock minigame, then pull your first job.\n# Follow each issued signal in order; record every press, including mistakes.\nCHALLENGE=$(curl -fsS \"$BASE/v1/crimes/pick/challenge?approach=standard\" -H \"$AUTH\")\nBODY=$(printf '%s' \"$CHALLENGE\" | jq -c '{approach:\"standard\",minigame:{token:.minigame.token,moves:(.minigame.rounds|flatten)}}')\n",
          "baseline": "# 5. Pull your first job (the bread-and-butter cash+respect loop).\n"
        },
        {
          "at": 9372,
          "current": "  -H 'content-type: application/json' -H 'idempotency-key: '$(uuidgen) -d \"$BODY\"\n",
          "baseline": "  -H 'idempotency-key: '$(uuidgen)\n"
        },
        {
          "at": 10077,
          "current": "Every crime requires the interactive signal-lock minigame. Clean play preserves\nfull crime odds; each mistake reduces those odds by 15% of the baseline, and\nthree mistakes fail the crime. Puzzles are gameplay, not human verification.\n\nFor crime, read `GET /v1/crimes/:id/challenge?approach=standard` (or `quiet`/`loud`).\nRepeat its three signals and send `minigame:{token,moves}` with the crime body.\nThe server validates the complete press history; no client score is accepted.\nChallenges expire and bind to the character, crime, approach and current attempt.\nThe same field is required when executing a crime through Agent Act. Missing,\nincomplete and stale submissions do not spend nerve or start the street cooldown.\n",
          "baseline": "Crimes offer optional preparation with explanatory feedback only. Preparation\nnever raises rewards, XP, item drops, or success odds. Ordinary crime without\npreparation remains valid. Puzzles are gameplay, not human verification.\n"
        },
        {
          "at": 12184,
          "current": "The browser offers task puzzles in Start Here's Family missions and the Streets\nHustle check-in. Every crime approach opens the required lock minigame. Finishing\nor failing it executes the job; closing does not. After an interrupted request, check the receipt before an\n",
          "baseline": "The browser offers these in Start Here's Family missions and the Streets Hustle\ncheck-in, plus optional preparation on crime cards. Its solve buttons execute the\njob; closing does not. After an interrupted request, check the receipt before an\n"
        },
        {
          "at": 17589,
          "current": "| **Crime grind** | `GET /v1/crimes/:id/challenge` then `POST /v1/crimes/:id` | Complete the required lock minigame; mistakes reduce success odds. Watch heat + jail risk. |\n",
          "baseline": "| **Crime grind** | `POST /v1/crimes/:id` | Highest EV crime for your level/nerve; watch heat + jail risk. |\n"
        }
      ]
    },
    "MARKETING-POSTS.md": {
      "current": {
        "mode": "100644",
        "blob": "81816a99bcaad55414d77391c3466ea5779f0ebf",
        "bytes": 7262,
        "sha256": "68027d0e397e1daaa4f0ad3359faa8761d394a5a0ed3953a6d9ba1c794deb705"
      },
      "baseline": {
        "mode": "100644",
        "blob": "1aa4bcaa13fc03c72ad5ad7c76b0a4cb2b4831f1",
        "bytes": 7262,
        "sha256": "d401f7e47eaa820d5d23e9306f02a2b0536511c4f3d5396ee4041e8563463b94"
      },
      "inverses": [
        {
          "at": 1229,
          "current": "**1. The whole game is a JSON API, and agents are first-class players.** All 1408 routes\n",
          "baseline": "**1. The whole game is a JSON API, and agents are first-class players.** All 1401 routes\n"
        },
        {
          "at": 4306,
          "current": "> suggests the next move; a universal request tool reaches all 1408 routes (crimes, contracts,\n",
          "baseline": "> suggests the next move; a universal request tool reaches all 1401 routes (crimes, contracts,\n"
        }
      ]
    },
    "SPEC.md": {
      "current": {
        "mode": "100644",
        "blob": "91413927c5fe7ba9e52afb493fab44e94caae3b4",
        "bytes": 57365,
        "sha256": "773fac29fc8b82b902e6e0a88f7968ecbc21c7f7112d83a5b8605499b6d6e0f5"
      },
      "baseline": {
        "mode": "100644",
        "blob": "8fcbab71090af1e1f63f16ad4e281483feb1d9a4",
        "bytes": 57415,
        "sha256": "64ba76682f7338d063fb31e860e0ac3da17ce60408098e21465ed89654cac979"
      },
      "inverses": [
        {
          "at": 464,
          "current": "File counts include the required crime minigame as of 2026-11-15. Backend and test line totals were refreshed for this change; other line totals retain their recorded snapshots.\n",
          "baseline": "File counts include the combined playtest fixes, quest-quality additions and task puzzles as of 2026-11-10. Backend, test and schema line totals were refreshed for task puzzles; other line totals retain the 2026-11-07 snapshot.\n"
        },
        {
          "at": 659,
          "current": "| Backend modules | **623** files, **142551** lines (recursive source inventory) |\n| Test suites | **1052** files, **220452** lines (recursive source inventory; this row refreshed 2026-11-15) |\n| HTTP routes | **1408** registrations (**1408** unique; 1278 under `/v1`) |\n",
          "baseline": "| Backend modules | **622** files, **142384** lines (recursive source inventory) |\n| Test suites | **1048** files, **220052** lines (recursive source inventory; this row refreshed 2026-11-15) |\n| HTTP routes | **1401** registrations (**1401** unique; 1277 under `/v1`) |\n"
        }
      ]
    },
    "docs/TASK-PUZZLES.md": {
      "current": {
        "mode": "100644",
        "blob": "457783560f99d1bdfc05468c06901cba7b3e17ac",
        "bytes": 6133,
        "sha256": "e2b976ed655ae90eeceff27eedb5b6b6413ade47b2a960d2e6c7ec1b3fadd602"
      },
      "baseline": {
        "mode": "100644",
        "blob": "7090e5664f79742fc53e235d785f0fa66196c520",
        "bytes": 5393,
        "sha256": "d4fcac0a9957ec686b327aea3fe836dec74ec00032cfb1337025daffccadb6c4"
      },
      "inverses": [
        {
          "at": 493,
          "current": "Every crime approach opens **Crack the lock**, a required interactive minigame.\nMemorize each signal and repeat it on the four pins using touch or keys 1–4.\nClean play preserves full crime odds. Each mistake reduces them by 15% of the\nbaseline; three mistakes fail the crime. Finishing or failing the lock commits\nthe crime and spends the usual nerve and street cooldown. Backing out commits\nnothing. Other mission requirements remain unchanged.\n",
          "baseline": "Crime cards also offer **Prepare … (optional puzzle)**. Other missions and ordinary\ncrime controls continue to work without optional preparation.\n"
        },
        {
          "at": 2020,
          "current": "**Solve and attempt mission** and **Solve and check in**\n",
          "baseline": "**Solve and attempt mission**, **Solve and check in**, and **Solve and attempt crime**\n"
        },
        {
          "at": 2239,
          "current": "The crime lock directly affects success odds. Character stats and the selected\ncrime approach still determine the underlying odds, rewards and consequences.\n",
          "baseline": "Crime preparation gives explanatory feedback only: no improvement to success odds,\ncurrency, items, XP or any other reward. A prepared crime still spends the usual\nresources and can fail. Choose its approach before submitting.\n"
        },
        {
          "at": 3859,
          "current": "For a crime, first read `GET /v1/crimes/:id/challenge?approach=standard` (or the\nchosen `quiet`/`loud` approach). Repeat the issued signals, recording every press\nincluding mistakes, then send `{approach,minigame:{token,moves}}` to the existing\ncrime endpoint. The server grades the press history and refuses missing,\nincomplete, expired or reused challenges. Agent Act crime execution requires the\nsame `minigame` field. Legacy `puzzle:{id,answer}` crime preparation remains\nreadable through the API and cannot replace the required lock.\n\n",
          "baseline": ""
        }
      ]
    },
    "omerta-mcp/index.js": {
      "current": {
        "mode": "100644",
        "blob": "2d7e88b35bc87874b88a9ba42d2fca8e45b819ca",
        "bytes": 22398,
        "sha256": "c4cfce2081f84b5c3e8b8a9d1a90103f7b5bb45acf58f51ec8cfac2bfd3db11b"
      },
      "baseline": {
        "mode": "100644",
        "blob": "158ea315f2c55b2ca0de89a06b9acbedf901e7d9",
        "bytes": 21734,
        "sha256": "36a157860b794fdd4cfd70c06eeb170ea375f9534747bbdbce481d639dcc2a17"
      },
      "inverses": [
        {
          "at": 10685,
          "current": "  { name: 'omerta_act', description: 'Execute one structured action from the latest omerta_turn through the server-enforced turn endpoint. Omit actionId to use the recommendation. Crime actions require minigame: fetch the action\\'s minigame.challengePath with omerta_request GET, play the challenge, and supply its token and moves. A success installs the returned post-action turn. Reuse operationId and the identical minigame only when retrying the same ambiguous action.',\n",
          "baseline": "  { name: 'omerta_act', description: 'Execute one structured action from the latest omerta_turn through the server-enforced turn endpoint. Omit actionId to use the recommendation. A success installs the returned post-action turn. Reuse operationId only when retrying the same ambiguous action.',\n"
        },
        {
          "at": 11464,
          "current": "      minigame: { type: 'object', additionalProperties: false, required: ['token', 'moves'], properties: {\n        token: { type: 'string', maxLength: 2048 },\n        moves: { type: 'array', maxItems: 64, items: { type: 'integer', minimum: 0, maximum: 3 } },\n      }, description: 'Required for crime actions. Submit the issued token and your complete move sequence; preserve both unchanged for a retry.' },\n",
          "baseline": ""
        },
        {
          "at": 21092,
          "current": "      const result = await api('POST', '/v1/agent/act', { turnId, actionId,\n        ...(args.minigame === undefined ? {} : { minigame: args.minigame }) }, { operationId: args.operationId });\n",
          "baseline": "      const result = await api('POST', '/v1/agent/act', { turnId, actionId }, { operationId: args.operationId });\n"
        }
      ]
    },
    "package.json": {
      "current": {
        "mode": "100644",
        "blob": "8ac7958703164e5f5b7d2c13816cdd50fcf08e01",
        "bytes": 65055,
        "sha256": "9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454"
      },
      "baseline": {
        "mode": "100644",
        "blob": "2a2ff851bc658cc69b9b69cad1812ee65cea2851",
        "bytes": 64806,
        "sha256": "7cdd3916fb45488293efdc1a92e9634bb7157809c11ca50a34460acc650ef629"
      },
      "inverses": [
        {
          "at": 126,
          "current": "    \"test:task-puzzles\": \"node test/task-puzzle-engine.js && node test/task-puzzles.js && node test/task-puzzle-jobs.js && npm run test:crime-minigame\",\n    \"test:crime-minigame\": \"node test/crime-minigame.js\",\n    \"test:crime-minigame:browser\": \"node test/crime-minigame-browser.js\",\n",
          "baseline": "    \"test:task-puzzles\": \"node test/task-puzzle-engine.js && node test/task-puzzles.js && node test/task-puzzle-jobs.js\",\n"
        },
        {
          "at": 52790,
          "current": "    \"test:release-source-transfer\": \"node test/crime-minigame-source-transfer.js && node test/economy-release-composition.js && node test/release-source-transfer.js\",\n",
          "baseline": "    \"test:release-source-transfer\": \"node test/economy-release-composition.js && node test/release-source-transfer.js\",\n"
        },
        {
          "at": 64430,
          "current": "    \"test:task-puzzles:browser\": \"node test/task-puzzles-browser.js && npm run test:crime-minigame:browser\"\n",
          "baseline": "    \"test:task-puzzles:browser\": \"node test/task-puzzles-browser.js\"\n"
        }
      ]
    },
    "public/index.html": {
      "current": {
        "mode": "100644",
        "blob": "7966e0082ef1cdaf15efa0862b034246460a7122",
        "bytes": 1402828,
        "sha256": "39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e"
      },
      "baseline": {
        "mode": "100644",
        "blob": "fe80e058bf517ca60ae0af3dee0d53630e994cd1",
        "bytes": 1401349,
        "sha256": "08c3ccd59f719b11f9609c463a9bb979a1c0678ec1ab3b63fc121e6a8c00d662"
      },
      "inverses": [
        {
          "at": 105975,
          "current": "<link rel=\"stylesheet\" href=\"/ux-crime-minigame.css?v=20261115-1\">\n",
          "baseline": ""
        },
        {
          "at": 157015,
          "current": "<script src=\"/ux-crime-minigame.js?v=20261115-1\"></script>\n",
          "baseline": ""
        },
        {
          "at": 344331,
          "current": "    if (body.minigame?.kind === 'signal-lock')\n      bits.push(body.minigame.completed\n        ? `lock cracked · ${body.minigame.mistakes} alarm${body.minigame.mistakes === 1 ? '' : 's'} · ${Math.round((body.successChance || 0) * 100)}% final crime odds`\n        : 'three alarms · the lock failed and the crime was lost');\n",
          "baseline": ""
        },
        {
          "at": 531092,
          "current": "  let crimeMinigamePending = false;\n  const crimeMinigameAttempts = new Map();\n",
          "baseline": ""
        },
        {
          "at": 531228,
          "current": "    if (acting || crimeMinigamePending) { toast('easy — one move at a time', false); return { code: 429, body: {} }; }\n",
          "baseline": "    if (acting) { toast('easy — one move at a time', false); return { code: 429, body: {} }; }\n"
        },
        {
          "at": 531752,
          "current": "    const crimeAttemptKey = `${actor}:${path}:${idempotencyKey}`;\n    if (method === 'POST' && /^\\/v1\\/crimes\\/[a-z0-9_-]+$/.test(path) && !body?.minigame && crimeMinigameAttempts.has(crimeAttemptKey))\n      body = { ...body, minigame: crimeMinigameAttempts.get(crimeAttemptKey) };\n    if (method === 'POST' && /^\\/v1\\/crimes\\/[a-z0-9_-]+$/.test(path) && !body?.minigame) {\n      if (typeof window.playOmertaCrimeMinigame !== 'function') {\n        toast('The crime minigame could not load. Refresh and try again.', true);\n        return { code: 503, body: { error: 'crime_minigame_unavailable' } };\n      }\n      const current = () => actorCurrent() && (!options.isCurrent || options.isCurrent());\n      if (!current() || (options.beforeDispatch && !options.beforeDispatch())) return { code: 0, body: {}, ignored: true };\n      crimeMinigamePending = true;\n      let minigame;\n      try {\n        minigame = await window.playOmertaCrimeMinigame({ path, approach: body?.approach || 'standard',\n          request: (m, p) => api(m, p, undefined, { isCurrent: current, beforeDispatch: current }),\n          label, returnFocus: trigger, isCurrent: current });\n      } finally { crimeMinigamePending = false; }\n      if (!minigame || !current()) return { code: 0, body: { cancelled: true } };\n      body = { ...body, minigame };\n      crimeMinigameAttempts.set(crimeAttemptKey, minigame);\n      if (crimeMinigameAttempts.size > 32) crimeMinigameAttempts.delete(crimeMinigameAttempts.keys().next().value);\n    }\n",
          "baseline": ""
        },
        {
          "at": 814631,
          "current": "      <div class=\"d operation-choice-terms\">Required lock minigame: mistakes lower your crime odds; three alarms fail the job.</div>\n",
          "baseline": ""
        },
        {
          "at": 815624,
          "current": "    return { terms, choices, blocked };\n",
          "baseline": "    const preparation = crime.puzzle ? `<button type=\"button\" class=\"act\" data-task-crime=\"${crime.id}\"${blocked ? ' disabled' : ''}>Prepare ${esc(crime.name)} (optional puzzle)</button>` : '';\n    return { terms, choices: choices + preparation, blocked };\n"
        },
        {
          "at": 954356,
          "current": "        <div class=\"noir-job-eyebrow\">Street job · Level ${c.lvl} · Required lock minigame</div><span class=\"t\">${esc(c.name)}</span>\n",
          "baseline": "        <div class=\"noir-job-eyebrow\">Street job · Level ${c.lvl}</div><span class=\"t\">${esc(c.name)}</span>\n"
        },
        {
          "at": 1336534,
          "current": "",
          "baseline": "  document.addEventListener('click', event => {\n    const button = event.target?.closest?.('[data-task-crime]');\n    if (!button || button.disabled) return;\n    const crime = rules?.crimes?.find(c => c.id === button.dataset.taskCrime);\n    if (crime) openTaskPuzzle({ selector: { scope: 'crime', targetId: crime.id }, path: `/v1/crimes/${crime.id}`,\n      label: `Prepare ${crime.name}`, submitLabel: 'Solve and attempt crime', trigger: button, body: { approach: 'standard' }, approaches: rules?.crimeApproaches });\n  });\n\n"
        }
      ]
    },
    "public/ux-tactics.js": {
      "current": {
        "mode": "100644",
        "blob": "f99367f093270273af2d78dd41b40fd31ab4a627",
        "bytes": 41995,
        "sha256": "b8a66a6c6385d33eca4fcbdcee6665305cf575d32575ad8a8f2430df39ef8ad4"
      },
      "baseline": {
        "mode": "100644",
        "blob": "d68342da70d384a9ce077527c9260a0096f50082",
        "bytes": 41949,
        "sha256": "a9d9c24792f17dd4e733a238c9b18d0bd83d052975f18e9ec029fcaa1e148bc5"
      },
      "inverses": [
        {
          "at": 16079,
          "current": "          <p class=\"ux-tactics-note\">${esc(found.actual[0]?.minigame?.note || '')} Rewards exist only after a successful, server-recorded action. Failed attempts can still spend nerve, add heat and start cooldowns.</p><button class=\"act\" type=\"button\" data-tactics-view=\"formula\">Explain these odds</button> <button class=\"act\" type=\"button\" data-tactics-open=\"streets\">Review the live job controls →</button>`}`;\n",
          "baseline": "          <p class=\"ux-tactics-note\">Rewards exist only after a successful, server-recorded action. Failed attempts can still spend nerve, add heat and start cooldowns.</p><button class=\"act\" type=\"button\" data-tactics-view=\"formula\">Explain these odds</button> <button class=\"act\" type=\"button\" data-tactics-open=\"streets\">Review the live job controls →</button>`}`;\n"
        }
      ]
    },
    "src/agentgateway.js": {
      "current": {
        "mode": "100644",
        "blob": "b5519bcd202f7710d456b14823444bea02fba396",
        "bytes": 162422,
        "sha256": "43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed"
      },
      "baseline": {
        "mode": "100644",
        "blob": "a5587d593e9468e8b026de46c578bc3ad6cce516",
        "bytes": 161832,
        "sha256": "8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f"
      },
      "inverses": [
        {
          "at": 23652,
          "current": "const CRIME_MINIGAME_SUBMISSION = { type: 'object', additionalProperties: false, required: ['token', 'moves'], properties: {\n  token: { type: 'string', maxLength: 2048 },\n  moves: { type: 'array', maxItems: 64, items: { type: 'integer', minimum: 0, maximum: 3 } },\n} };\n\n",
          "baseline": ""
        },
        {
          "at": 63077,
          "current": "      minigame: CRIME_MINIGAME_SUBMISSION,\n",
          "baseline": ""
        },
        {
          "at": 64740,
          "current": "    requestSchema: { type: 'object', additionalProperties: false, required: ['minigame'], properties: {\n",
          "baseline": "    requestSchema: { type: 'object', additionalProperties: false, properties: {\n"
        },
        {
          "at": 64938,
          "current": "      minigame: CRIME_MINIGAME_SUBMISSION,\n      puzzle: { ...TASK_PUZZLE_SUBMISSION, deprecated: true, description: 'Legacy deduction preparation. Does not replace the required minigame or change its score. Any committed crime attempt invalidates previous preparations.' },\n",
          "baseline": "      puzzle: { ...TASK_PUZZLE_SUBMISSION, description: 'Optional preparation, feedback only. Issue/resume with scope crime and this crime ID. Any committed crime attempt invalidates previous preparations. Omit for ordinary crime; never changes odds or rewards.' },\n"
        },
        {
          "at": 65227,
          "current": "  'GET /v1/crimes/:id/challenge': { operationId: 'getCrimeMinigame',\n    requestParameters: [{ name: 'approach', in: 'query', required: false,\n      schema: { type: 'string', enum: ['quiet', 'standard', 'loud'], default: 'standard' } }],\n  },\n",
          "baseline": ""
        }
      ]
    },
    "src/agentturn.js": {
      "current": {
        "mode": "100644",
        "blob": "6ca94897eed45f4bc9f0bbdbd1dc3d8c99616613",
        "bytes": 46168,
        "sha256": "f40b295cfe1cf806f82c5dd1673cbdaec764b6242f03f3c1258d1a46842a303b"
      },
      "baseline": {
        "mode": "100644",
        "blob": "4eed3f888002a21d02c60800072b69912bc47636",
        "bytes": 45903,
        "sha256": "1c4fe6e61f94e71c953c9221f1302e67a3acf3d9349ddbe161835f19267ca881"
      },
      "inverses": [
        {
          "at": 3978,
          "current": "    minigame: { required: true, challengePath: `/v1/crimes/${crime.id}/challenge?approach=standard`,\n      kind: 'signal-lock', note: 'Fetch and play the challenge, then include {token,moves} as minigame when executing this action. Three mistakes fail the job.' },\n",
          "baseline": ""
        }
      ]
    },
    "src/game.js": {
      "current": {
        "mode": "100644",
        "blob": "92610bcb14f10e2fe0b673fc11240cae41eaf07b",
        "bytes": 231945,
        "sha256": "1ee4df5e9fe5209f3239d854fa0a4c587c36e24ffe634ae569abb7af06be60f8"
      },
      "baseline": {
        "mode": "100644",
        "blob": "c833190107a3f378e3513718d92ea02dbc04b347",
        "bytes": 231839,
        "sha256": "f027bfa3c314c9d045a2446e9fef755fe8e4b67ac7ba49ceb0661302bac78654"
      },
      "inverses": [
        {
          "at": 175863,
          "current": "export async function doCrime(ch, crimeId, client, h, approach, puzzle, minigame = null) {\n",
          "baseline": "export async function doCrime(ch, crimeId, client, h, approach, puzzle) {\n"
        },
        {
          "at": 178932,
          "current": "  // intended \"an unskilled crook fumbles the hard score\". Floor the chance at zero\n  // before applying minigame performance so the final probability stays valid.\n",
          "baseline": "  // intended \"an unskilled crook fumbles the hard score\"; the final chance is a probability, and\n  // Math.random() < (negative) is simply never true, so it needs no extra clamp.\n"
        },
        {
          "at": 179204,
          "current": "  const chance = Math.max(0, Math.min(0.97, (c.base + statEdge\n    + gangLevel * 0.02 + (held.includes('brick') ? 0.02 : 0) + (rIdx >= 9 ? 0.02 : 0)) * ap.successMult)) * (minigame?.multiplier ?? 1);\n",
          "baseline": "  const chance = Math.min(0.97, (c.base + statEdge\n    + gangLevel * 0.02 + (held.includes('brick') ? 0.02 : 0) + (rIdx >= 9 ? 0.02 : 0)) * ap.successMult);\n"
        },
        {
          "at": 189107,
          "current": "  return { ...outcome, ...(puzzleFeedback ? { puzzle: puzzleFeedback } : {}),\n    ...(minigame ? { minigame, successChance: chance } : {}) };\n",
          "baseline": "  return { ...outcome, ...(puzzleFeedback ? { puzzle: puzzleFeedback } : {}) };\n"
        }
      ]
    },
    "src/server.js": {
      "current": {
        "mode": "100644",
        "blob": "8cdaba2e08151ba01b537f2504a0332b7d322f93",
        "bytes": 314319,
        "sha256": "d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4"
      },
      "baseline": {
        "mode": "100644",
        "blob": "c0b381e05fd9e6029394a8cdd7449c7d30e2a8ef",
        "bytes": 313687,
        "sha256": "248f866dd1269e350f92a5aeb2e5c7978741b9b42994f9e2b1a1268a37b7ffdc"
      },
      "inverses": [
        {
          "at": 14384,
          "current": "import { crimeChallenge, verifyCrimeMinigame } from './crime-minigame.js';\n",
          "baseline": ""
        },
        {
          "at": 49660,
          "current": "    ...['feel', 'tools', 'identity', 'story', 'community', 'quests', 'clues', 'task-puzzles', 'crime-minigame'].flatMap(name => [[`ux-${name}.js`, 'application/javascript'], [`ux-${name}.css`, 'text/css']]),\n",
          "baseline": "    ...['feel', 'tools', 'identity', 'story', 'community', 'quests', 'clues', 'task-puzzles'].flatMap(name => [[`ux-${name}.js`, 'application/javascript'], [`ux-${name}.css`, 'text/css']]),\n"
        },
        {
          "at": 132204,
          "current": "  app.get('/v1/crimes/:id/challenge', { preHandler: auth }, async (req) =>\n    G.readCharacter(pool, req.user.sub, (ch) => crimeChallenge(ch, req.params.id, req.query?.approach)));\n",
          "baseline": ""
        },
        {
          "at": 132451,
          "current": "    G.withCharacter(pool, req.user.sub, (ch, client, h) => crimeWithDecisionContext(ch, req.params.id, client, h, req.body?.approach, req.body?.puzzle,\n      verifyCrimeMinigame(ch, req.params.id, req.body?.approach, req.body?.minigame))));\n",
          "baseline": "    G.withCharacter(pool, req.user.sub, (ch, client, h) => crimeWithDecisionContext(ch, req.params.id, client, h, req.body?.approach, req.body?.puzzle)));\n"
        },
        {
          "at": 221809,
          "current": "  const performAgentAction = async (action, ch, client, h, lender = null, policy = null, minigame) => {\n",
          "baseline": "  const performAgentAction = async (action, ch, client, h, lender = null, policy = null) => {\n"
        },
        {
          "at": 222043,
          "current": "      case 'crime': return crimeWithDecisionContext(ch, tail('/v1/crimes/'), client, h, action.body?.approach, action.body?.puzzle,\n        verifyCrimeMinigame(ch, tail('/v1/crimes/'), action.body?.approach, minigame));\n",
          "baseline": "      case 'crime': return G.doCrime(ch, tail('/v1/crimes/'), client, h, action.body?.approach, action.body?.puzzle);\n"
        },
        {
          "at": 226142,
          "current": "  const executeAgentAction = async (client, ch, h, turnId, actionId, lender = null, decisionCallId = null, minigame) => {\n",
          "baseline": "  const executeAgentAction = async (client, ch, h, turnId, actionId, lender = null, decisionCallId = null) => {\n"
        },
        {
          "at": 226591,
          "current": "    const result = await performAgentAction(action, ch, client, h, lender, current.policy, minigame);\n",
          "baseline": "    const result = await performAgentAction(action, ch, client, h, lender, current.policy);\n"
        },
        {
          "at": 229624,
          "current": "          (ch, lender, client, h) => executeAgentAction(client, ch, h, turnId, actionId, lender, decisionCallId, req.body?.minigame), { meet: false });\n",
          "baseline": "          (ch, lender, client, h) => executeAgentAction(client, ch, h, turnId, actionId, lender, decisionCallId), { meet: false });\n"
        },
        {
          "at": 229840,
          "current": "          (ch, client, h) => executeAgentAction(client, ch, h, turnId, actionId, null, decisionCallId, req.body?.minigame), agentActionLocks);\n",
          "baseline": "          (ch, client, h) => executeAgentAction(client, ch, h, turnId, actionId, null, decisionCallId), agentActionLocks);\n"
        },
        {
          "at": 230310,
          "current": "            executeAgentAction(client, ch, h, turnId, actionId, owner, decisionCallId, req.body?.minigame));\n",
          "baseline": "            executeAgentAction(client, ch, h, turnId, actionId, owner, decisionCallId));\n"
        },
        {
          "at": 230516,
          "current": "            executeAgentAction(client, ch, h, turnId, actionId, null, decisionCallId, req.body?.minigame), agentActionLocks);\n",
          "baseline": "            executeAgentAction(client, ch, h, turnId, actionId, null, decisionCallId), agentActionLocks);\n"
        },
        {
          "at": 231012,
          "current": "            return executeAgentAction(client, ch, h, turnId, actionId, lender, decisionCallId, req.body?.minigame);\n",
          "baseline": "            return executeAgentAction(client, ch, h, turnId, actionId, lender, decisionCallId);\n"
        },
        {
          "at": 231443,
          "current": "            return executeAgentAction(client, ch, h, turnId, actionId, null, decisionCallId, req.body?.minigame);\n",
          "baseline": "            return executeAgentAction(client, ch, h, turnId, actionId, null, decisionCallId);\n"
        },
        {
          "at": 231700,
          "current": "          return executeAgentAction(client, ch, h, turnId, actionId, null, decisionCallId, req.body?.minigame);\n",
          "baseline": "          return executeAgentAction(client, ch, h, turnId, actionId, null, decisionCallId);\n"
        }
      ]
    },
    "src/task-puzzle-jobs.js": {
      "current": {
        "mode": "100644",
        "blob": "4ae41be4c9534e484c5846ec6de74bd71ec8a4e7",
        "bytes": 2368,
        "sha256": "8fef430da9c27bfabe378a366093a39126597767ce1b0968715c90a34220d200"
      },
      "baseline": {
        "mode": "100644",
        "blob": "a17d1d71346691206d2e38a210469135f01b868c",
        "bytes": 2302,
        "sha256": "a500eeadb12330d8a7d364231526663851916fe897f3497e7e5049b4d6792551"
      },
      "inverses": [
        {
          "at": 557,
          "current": "export const crimePuzzle = id => ({ required: true, scope: 'crime', targetId: id, benefit: 'success_odds',\n  kind: 'signal-lock', challengePath: `/v1/crimes/${id}/challenge` });\n",
          "baseline": "export const crimePuzzle = id => ({ required: false, scope: 'crime', targetId: id, benefit: 'feedback_only' });\n"
        }
      ]
    },
    "src/ux-tactics.js": {
      "current": {
        "mode": "100644",
        "blob": "7dedc3b067c800e3322075f4f9ab4a365ad03e06",
        "bytes": 19964,
        "sha256": "78d283188d2ff846a8f5a37c00936b7de3b6d820f195c20b924a7ddb10b3322b"
      },
      "baseline": {
        "mode": "100644",
        "blob": "9e44659e39f2bacffaba47679053d6c12fbab64a",
        "bytes": 19004,
        "sha256": "7eb343cc77c970c9e71032c2bc25be9a02e80abc481c87773a40be403568b393"
      },
      "inverses": [
        {
          "at": 3231,
          "current": "export function quoteCrime(ch, h, crime, approach, second = null, minigame = null) {\n",
          "baseline": "export function quoteCrime(ch, h, crime, approach, second = null) {\n"
        },
        {
          "at": 3884,
          "current": "  const minigameMult = minigame?.multiplier ?? 1;\n  const threshold = Math.max(0, Math.min(0.97, (crime.base + stats.cunning * M3.CRIME_STAT.CUN + stats.speed * M3.CRIME_STAT.SPD - M3.CRIME_STAT.OFFSET + gang + turf + rankBonus) * ap.successMult)) * minigameMult;\n",
          "baseline": "  const threshold = Math.min(0.97, (crime.base + stats.cunning * M3.CRIME_STAT.CUN + stats.speed * M3.CRIME_STAT.SPD - M3.CRIME_STAT.OFFSET + gang + turf + rankBonus) * ap.successMult);\n"
        },
        {
          "at": 5386,
          "current": "    cost: { nerve: crime.nerve, energy: 0, cash: 0 }, probability: threshold, threshold,\n    minigame: { required: true, kind: 'signal-lock', maxMistakes: 3,\n      chanceMultipliers: [1, 0.85, 0.7, 0], challengePath: `/v1/crimes/${crime.id}/challenge?approach=${ap.id}`,\n      note: 'Shown odds require a perfect minigame. Each mistake reduces those odds by 15%; three mistakes fail the job.' },\n",
          "baseline": "    cost: { nerve: crime.nerve, energy: 0, cash: 0 }, probability: Math.max(0, threshold), threshold,\n"
        },
        {
          "at": 6159,
          "current": "    formula: { source: 'src/game.js · doCrime', inputs: { base: crime.base, cunning: stats.cunning, speed: stats.speed, gang, turf, rank: rankBonus, successMult: ap.successMult, minigameMult },\n      expression: { op: 'mul', args: [{ input: 'minigameMult' }, { op: 'max', args: [0, { op: 'min', args: [0.97, { op: 'mul', args: [{ op: 'add', args: [{ input: 'base' }, { op: 'mul', args: [{ input: 'cunning' }, M3.CRIME_STAT.CUN] }, { op: 'mul', args: [{ input: 'speed' }, M3.CRIME_STAT.SPD] }, -M3.CRIME_STAT.OFFSET, { input: 'gang' }, { input: 'turf' }, { input: 'rank' }] }, { input: 'successMult' }] }] }] }] },\n",
          "baseline": "    formula: { source: 'src/game.js · doCrime', inputs: { base: crime.base, cunning: stats.cunning, speed: stats.speed, gang, turf, rank: rankBonus, successMult: ap.successMult },\n      expression: { op: 'min', args: [0.97, { op: 'mul', args: [{ op: 'add', args: [{ input: 'base' }, { op: 'mul', args: [{ input: 'cunning' }, M3.CRIME_STAT.CUN] }, { op: 'mul', args: [{ input: 'speed' }, M3.CRIME_STAT.SPD] }, -M3.CRIME_STAT.OFFSET, { input: 'gang' }, { input: 'turf' }, { input: 'rank' }] }, { input: 'successMult' }] }] },\n"
        },
        {
          "at": 7548,
          "current": "      { label: 'Required minigame', value: minigameMult, effect: minigame\n        ? `${minigame.mistakes} mistakes; success odds multiplied by ${minigameMult} after the ceiling`\n        : 'Shown odds assume a perfect game; mistakes multiply odds by 0.85 or 0.7, and three mistakes fail the job' },\n",
          "baseline": ""
        },
        {
          "at": 18879,
          "current": "export async function crimeWithDecisionContext(ch, crimeId, client, h, approach, puzzle, minigame = null) {\n",
          "baseline": "export async function crimeWithDecisionContext(ch, crimeId, client, h, approach, puzzle) {\n"
        },
        {
          "at": 19121,
          "current": "  if (!crime) return doCrime(ch, crimeId, client, h, approach, puzzle, minigame);\n  const projection = quoteCrime(ch, h, crime, approach, await assignedSoldier(client, ch.id), minigame);\n",
          "baseline": "  if (!crime) return doCrime(ch, crimeId, client, h, approach, puzzle);\n  const projection = quoteCrime(ch, h, crime, approach, await assignedSoldier(client, ch.id));\n"
        },
        {
          "at": 19356,
          "current": "  const result = await doCrime(ch, crimeId, client, h, approach, puzzle, minigame);\n",
          "baseline": "  const result = await doCrime(ch, crimeId, client, h, approach, puzzle);\n"
        },
        {
          "at": 19702,
          "current": "    note: minigame && !minigame.completed ? 'The minigame failed; this attempt had no chance of success.'\n      : 'Projection immediately before this attempt, including minigame performance; a failed roll does not identify one modifier as its cause.' } };\n",
          "baseline": "    note: 'Projection immediately before this attempt; a failed roll does not identify one modifier as its cause.' } };\n"
        }
      ]
    },
    "test/action-cooldowns.js": {
      "current": {
        "mode": "100644",
        "blob": "e6dc173b4c628bfbf7a64a6b99114ffd97124076",
        "bytes": 9821,
        "sha256": "f3fa6a5f36cbf0d28dbe538b4e9f794219575e0d7803e2ef4efd9519c1a8b382"
      },
      "baseline": {
        "mode": "100644",
        "blob": "db3720d44d2de5e00dc26a2320b24a846597b259",
        "bytes": 9741,
        "sha256": "a295c8ef0477c8f2ce97faabb901b6c6fd38ac50e8884afc4c0fb38837c2c51c"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { injectWithCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 3434,
          "current": "  const res = await injectWithCrimeMinigame(app, { method, url, payload,\n",
          "baseline": "  const res = await app.inject({ method, url, payload,\n"
        }
      ]
    },
    "test/agent-alpha.js": {
      "current": {
        "mode": "100644",
        "blob": "25cedaf4337d4960e7753714589e21b0f60ff44e",
        "bytes": 117655,
        "sha256": "3dc7fe94479ce90984944da40136e6a3c093d1686ea1553762e1e451042c7ab3"
      },
      "baseline": {
        "mode": "100644",
        "blob": "84d219e4e07990795e1ae51870e9d0e2c513828e",
        "bytes": 111273,
        "sha256": "51b30a960a4edec2b7ecc01c3971bc5ca1c23b2c2379b751612d59e5f1728a45"
      },
      "inverses": [
        {
          "at": 109407,
          "current": "async function crimeMinigameApi({ dropFirst = false, staleFirst = false,\n  challengePath = '/v1/crimes/pick/challenge?approach=standard' } = {}) {\n  const app = Fastify({ logger: false }), receipts = new Map();\n  const state = { turnCalls: 0, challengeCalls: 0, actBodies: [], actKeys: [], mutations: 0 };\n  const rounds = [[0, 1, 2], [3, 0, 1, 2], [1, 2, 3, 0, 1]];\n  app.get('/v1/session', async () => ({ authed: true, hasCharacter: true, agent: true,\n    character: { id: 'crime-agent', name: 'Alpha Machine', generation: 1 } }));\n  app.get('/v1/agent/turn', async () => {\n    state.turnCalls++;\n    return { turnId: `crime-turn-${state.turnCalls}`, recommendedActionId: 'crime:pick:standard', policy: POLICY,\n      actions: [{ id: 'crime:pick:standard', kind: 'crime', method: 'POST', path: '/v1/crimes/pick',\n        body: { approach: 'standard', prompt: 'do not persist authored bodies' }, executable: true,\n        minigame: { required: true, kind: 'signal-lock', challengePath } }] };\n  });\n  app.get('/v1/crimes/pick/challenge', async () => {\n    state.challengeCalls++;\n    return { minigame: { kind: 'signal-lock', token: `signal-token-secret-${state.challengeCalls}`,\n      rounds, maxMistakes: 3, expiresAt: new Date(Date.now() + 300000).toISOString() } };\n  });\n  app.post('/v1/agent/act', async (req, reply) => {\n    state.actBodies.push(req.body); state.actKeys.push(req.headers['idempotency-key']);\n    if (!req.body.minigame) return reply.code(400).send({ error: 'crime_minigame_required' });\n    if (staleFirst && state.actBodies.length === 1) return reply.code(400).send({ error: 'stale_crime_minigame' });\n    assert.deepEqual(req.body.minigame.moves, rounds.flat(), 'the runner submits the complete public signal');\n    const key = req.headers['idempotency-key'];\n    if (!receipts.has(key)) {\n      state.mutations++;\n      receipts.set(key, { result: { ok: true }, turn: { turnId: 'idle', recommendedActionId: null, policy: POLICY, actions: [] } });\n    }\n    if (dropFirst && state.actBodies.length === 1) { reply.hijack(); reply.raw.destroy(); return; }\n    return receipts.get(key);\n  });\n  await app.listen({ port: 0, host: '127.0.0.1' });\n  return { baseUrl: `http://127.0.0.1:${app.server.address().port}`, state, rounds, close: () => app.close() };\n}\n\nasync function crimeMinigameRecoveryTest() {\n  const api = await crimeMinigameApi({ dropFirst: true });\n  await withReadySession(api, 'omerta-agent-alpha-crime-', async ({ sessionFile, reportFile }) => {\n    const inspectFetch = async (url, options) => {\n      if (new URL(url).pathname === '/v1/agent/act') {\n        const pending = JSON.parse(await readFile(sessionFile, 'utf8')).pending;\n        const body = JSON.parse(options.body);\n        assert.deepEqual(pending.minigame, body.minigame, 'the exact minigame is durable before every POST');\n        assert.deepEqual(Object.keys(pending).sort(), ['actionId', 'minigame', 'operationId', 'startedAt', 'turnId']);\n      }\n      return fetch(url, options);\n    };\n    await assert.rejects(runAgentAlpha({ baseUrl: api.baseUrl, sessionFile, reportFile, maxActions: 1,\n      fetchImpl: inspectFetch }), /fetch|socket|other side|terminated/i);\n    const pending = JSON.parse(await readFile(sessionFile, 'utf8')).pending;\n    assert.deepEqual(pending.minigame, { token: 'signal-token-secret-1', moves: api.rounds.flat() });\n    const resumed = await runAgentAlpha({ baseUrl: api.baseUrl, sessionFile, reportFile, maxActions: 1,\n      fetchImpl: inspectFetch });\n    assert.equal(resumed.actions, 1);\n    assert.equal(api.state.challengeCalls, 1, 'an ambiguous replay never fetches or substitutes another challenge');\n    assert.equal(api.state.turnCalls, 1, 'pending recovery uses its original turn');\n    assert.deepEqual(api.state.actBodies[0], api.state.actBodies[1]);\n    assert.equal(api.state.actKeys[0], api.state.actKeys[1]);\n    assert.equal(api.state.mutations, 1, 'the replay confirms exactly one committed crime');\n    assert.equal(JSON.parse(await readFile(sessionFile, 'utf8')).pending, null);\n    const report = await readFile(reportFile, 'utf8');\n    assert(!report.includes('signal-token-secret') && !report.includes('do not persist authored bodies'),\n      'minigame credentials and authored action bodies stay out of reports');\n  });\n}\n\nasync function crimeMinigameStaleTest() {\n  for (const legacy of [false, true]) {\n    const api = await crimeMinigameApi({ staleFirst: !legacy });\n    await withReadySession(api, 'omerta-agent-alpha-crime-stale-', async ({ sessionFile, reportFile }) => {\n      if (legacy) await writePrivateSession(sessionFile, JSON.stringify(sessionFor(api.baseUrl, {\n        pending: { operationId: 'old-crime-attempt', turnId: 'old-turn', actionId: 'crime:pick:standard', startedAt: new Date().toISOString() },\n      })));\n      const summary = await runAgentAlpha({ baseUrl: api.baseUrl, sessionFile, reportFile, maxActions: 2 });\n      assert.equal(summary.actions, 1, 'a definitive minigame refusal refreshes authority within the attempt budget');\n      assert.equal(api.state.mutations, 1);\n      assert.notEqual(api.state.actKeys[0], api.state.actKeys[1], 'a replacement challenge starts a new logical attempt');\n      assert.equal(api.state.challengeCalls, legacy ? 1 : 2);\n      assert.equal(JSON.parse(await readFile(sessionFile, 'utf8')).pending, null);\n      const report = await readFile(reportFile, 'utf8');\n      assert(report.includes(legacy ? 'crime_minigame_required' : 'stale_crime_minigame'));\n    });\n  }\n}\n\nasync function crimeMinigameOriginTest() {\n  const api = await crimeMinigameApi({ challengePath: '//attacker.invalid/collect' });\n  await withReadySession(api, 'omerta-agent-alpha-crime-origin-', async ({ sessionFile, reportFile }) => {\n    await assert.rejects(runAgentAlpha({ baseUrl: api.baseUrl, sessionFile, reportFile, maxActions: 1 }),\n      /unsupported crime minigame/);\n    assert.equal(api.state.challengeCalls, 0);\n    assert.equal(api.state.actBodies.length, 0, 'an invalid challenge path cannot cause a mutation');\n    assert.equal(JSON.parse(await readFile(sessionFile, 'utf8')).pending, null);\n  });\n}\n\nif (process.argv.includes('--crime-minigame')) {\n  await crimeMinigameRecoveryTest();\n  await crimeMinigameStaleTest();\n  await crimeMinigameOriginTest();\n} else if (process.argv.includes('--decision-recovery')) {\n",
          "baseline": "if (process.argv.includes('--decision-recovery')) {\n"
        },
        {
          "at": 117506,
          "current": "await crimeMinigameRecoveryTest();\nawait crimeMinigameStaleTest();\nawait crimeMinigameOriginTest();\n",
          "baseline": ""
        }
      ]
    },
    "test/brokers.js": {
      "current": {
        "mode": "100644",
        "blob": "cb59706ce2587a457f3d0b3d469a134abac0216b",
        "bytes": 18762,
        "sha256": "1ff322b0fbf29c0fcdec94cef31fd8f7e41d59a105f3de5d4e1e0ad3a2de2a9a"
      },
      "baseline": {
        "mode": "100644",
        "blob": "5719fd41a17d967d52e3e449672886b4e3348003",
        "bytes": 18682,
        "sha256": "51433a8c3e20c63f6beef3b0f883c5b05860b6f1dfacf9846efc1a19ad2611a6"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { injectWithCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 1276,
          "current": "  const res = await injectWithCrimeMinigame(app, { method, url,\n",
          "baseline": "  const res = await app.inject({ method, url,\n"
        }
      ]
    },
    "test/client-shell-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "a600c02de1027f7fa5500619abb739e9df4ba33b",
        "bytes": 20543,
        "sha256": "cca74541632f999d99dcfe4c449b424bfc52c2f72f4da7735adb1d0a92d3ee2b"
      },
      "baseline": {
        "mode": "100644",
        "blob": "b4496fd201b21c5e99536ccdfd6b684faaf9e58d",
        "bytes": 20463,
        "sha256": "b08ab98426a7e73b497849e0c89dd91fcb5ad28e0d6b850d3f01d5e35d582a85"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { injectWithCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 977,
          "current": "  const result = await injectWithCrimeMinigame(app, { method, url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });\n",
          "baseline": "  const result = await app.inject({ method, url, payload, headers: token ? { authorization: `Bearer ${token}` } : {} });\n"
        }
      ]
    },
    "test/client.js": {
      "current": {
        "mode": "100644",
        "blob": "0cbe72d6f43c4d33804e97edeb93b67f0dafa69f",
        "bytes": 765068,
        "sha256": "c9b53761b3d6da5fcfb220de2d461241b4a5889cecac5ad42625a0a7e42ca6ae"
      },
      "baseline": {
        "mode": "100644",
        "blob": "cde6049be9a07ccca511687546808b08aded515f",
        "bytes": 764783,
        "sha256": "52bbbba86aed3a9e759a588393273b62bd2c80252c18df7466be32a1b655cc64"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { injectWithCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 9139,
          "current": "      let acting = false, crimeMinigamePending = false, crimeMinigameAttempts = new Map(), activatedControl = null, operationPending = null, operationPhase = '', _operationResponseCurrent = null;\n",
          "baseline": "      let acting = false, activatedControl = null, operationPending = null, operationPhase = '', _operationResponseCurrent = null;\n"
        },
        {
          "at": 102596,
          "current": "  const res = await injectWithCrimeMinigame(app, { method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: adultAuthFixture(method, url, payload) });\n",
          "baseline": "  const res = await app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: adultAuthFixture(method, url, payload) });\n"
        },
        {
          "at": 516705,
          "current": "    ['verifyCrimeMinigame', 'an internal grade nested under minigame; the enclosing doCrime outcome supplies the success or bust receipt'],\n",
          "baseline": ""
        }
      ]
    },
    "test/clue-puzzles.js": {
      "current": {
        "mode": "100644",
        "blob": "7f04f76bc3080430c392dbc82fb111a9f87cae04",
        "bytes": 11017,
        "sha256": "3013dcf1ebf08a5d7429777b81f82b2986f013f76817837ae54eee6d1f08bd46"
      },
      "baseline": {
        "mode": "100644",
        "blob": "e25814544198f20de13985e51757887ad90e3759",
        "bytes": 10937,
        "sha256": "96cb003785242c0bc75f85d66c291af72fcf84fa08eb1738c3351ef07ff28b31"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { injectWithCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 4658,
          "current": "  const reply = await injectWithCrimeMinigame(app, { method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body });\n",
          "baseline": "  const reply = await app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body });\n"
        }
      ]
    },
    "test/clues.js": {
      "current": {
        "mode": "100644",
        "blob": "33cca6f6898cc36b7e0bf91b7cef6e200f3a03eb",
        "bytes": 13221,
        "sha256": "51a5b20f2254c60cfd9befb29969160007d9450450cf074f7f1553dddf2bdc29"
      },
      "baseline": {
        "mode": "100644",
        "blob": "094e0b28a82c577ef2bd8208663e344683c77c6d",
        "bytes": 13141,
        "sha256": "4e93cd53e67d90afdf635c94ca3c32c16c81940cb3b70ef1e5f1df38902e4059"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { injectWithCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 1605,
          "current": "  const res = await injectWithCrimeMinigame(app, { method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body });\n",
          "baseline": "  const res = await app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body });\n"
        }
      ]
    },
    "test/dynasty.js": {
      "current": {
        "mode": "100644",
        "blob": "ad1ca42d470c41bdd68578a7e041315cbd3774b1",
        "bytes": 20066,
        "sha256": "260501926fd9139457727ac6cc51405e7a7a310d52e685c3e68ae5740e3d4316"
      },
      "baseline": {
        "mode": "100644",
        "blob": "bb2214b3ae5e10ba74a57f9030ede60fabd11502",
        "bytes": 19986,
        "sha256": "c70449fa10b3b6ebc135418dc2b67d25f2396bdd44f10745e6b2dec753cb3d07"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { injectWithCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 1308,
          "current": "  const res = await injectWithCrimeMinigame(app, { method, url, headers, payload: body });\n",
          "baseline": "  const res = await app.inject({ method, url, headers, payload: body });\n"
        }
      ]
    },
    "test/economy.js": {
      "current": {
        "mode": "100644",
        "blob": "beb6030486db999348f8148836981232b5d4edd7",
        "bytes": 112646,
        "sha256": "cc1db8f77c07fd84bda1cfb119875a7464787ad026c2754618f6482e36120ec6"
      },
      "baseline": {
        "mode": "100644",
        "blob": "fe6b455fa80d0b7cc3f30965b5a85976aff697e4",
        "bytes": 112566,
        "sha256": "1824be54c098f232ba8942c34531c007a9e29bf510824dc4eb9bb3c01a3c3cf0"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { injectWithCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 4387,
          "current": "  const res = await injectWithCrimeMinigame(app, { method, url,\n",
          "baseline": "  const res = await app.inject({ method, url,\n"
        }
      ]
    },
    "test/engagement.js": {
      "current": {
        "mode": "100644",
        "blob": "4e26bdf28434f88f02b123de86daf340ead462fe",
        "bytes": 23153,
        "sha256": "2dd5df2ec10e126f5229c006dc5047b5710355944607fada3351e92e467aad83"
      },
      "baseline": {
        "mode": "100644",
        "blob": "d4cea9b00854cd96e0ff9f27ad1a64aca0fe3c44",
        "bytes": 23073,
        "sha256": "238198e8eddd60b0b4c5cc0c82fef82fe64040344d0674bba8f5d5a264808250"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { injectWithCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 4086,
          "current": "  const res = await injectWithCrimeMinigame(app, { method, url, headers, payload: body });\n",
          "baseline": "  const res = await app.inject({ method, url, headers, payload: body });\n"
        }
      ]
    },
    "test/explore.js": {
      "current": {
        "mode": "100644",
        "blob": "16cd09747da52fed94b111e69df7c6ba3f4c2263",
        "bytes": 93007,
        "sha256": "4ab2d2993084bc570cf01cab48c3c0a3f0e2951ae56ebd953acc0deaeb7e52b5"
      },
      "baseline": {
        "mode": "100644",
        "blob": "17509818749639adcf118f1214008a9f631d1f00",
        "bytes": 92835,
        "sha256": "3b315d4ed0d9cc2242c37ce983d21c50cbc22a2d4924926cedc37b08ad7bff5e"
      },
      "inverses": [
        {
          "at": 92003,
          "current": "    const lock = (await call('GET', strictCrime.minigame.challengePath, { token: strictAgent })).body.minigame;\n",
          "baseline": ""
        },
        {
          "at": 92252,
          "current": "      body: { turnId: strictTurn.turnId, actionId: strictCrime.id, minigame: { token: lock.token, moves: lock.rounds.flat() } },\n",
          "baseline": "      body: { turnId: strictTurn.turnId, actionId: strictCrime.id },\n"
        }
      ]
    },
    "test/firstblood.js": {
      "current": {
        "mode": "100644",
        "blob": "28a049dd8417b886e480925e4e39299f013e65a0",
        "bytes": 11231,
        "sha256": "b1812fa372b7bedbdcbe67324e20b297d6720309226c906d2f2bf656be741957"
      },
      "baseline": {
        "mode": "100644",
        "blob": "52a69ea9fe14f43b1b439e763081a9428d42dd67",
        "bytes": 11151,
        "sha256": "c463988f670107a294f999ff4e073e55ed8b75c1e36ea91050b7d4d8048e386d"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { injectWithCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 1255,
          "current": "  const res = await injectWithCrimeMinigame(app, { method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body });\n",
          "baseline": "  const res = await app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body });\n"
        }
      ]
    },
    "test/firsts.js": {
      "current": {
        "mode": "100644",
        "blob": "ceff368a17f1d71aee4740f4c95246530e959e68",
        "bytes": 13001,
        "sha256": "4228cfcd83680223e813efcfe51542e6442fc54fb492ca112aae3f0079953a84"
      },
      "baseline": {
        "mode": "100644",
        "blob": "9e45c0584a49d0256efb7eef837a8df372d701bc",
        "bytes": 12921,
        "sha256": "33507e2aaf2b5211bf03a5f1457b6343746674b4e5b864f6e6a090b336e0eeea"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { injectWithCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 1678,
          "current": "  const res = await injectWithCrimeMinigame(app, { method, url, headers, payload: body });\n",
          "baseline": "  const res = await app.inject({ method, url, headers, payload: body });\n"
        }
      ]
    },
    "test/gates.js": {
      "current": {
        "mode": "100644",
        "blob": "8009c375403bcbdce99a0c47cb3861e9837676a6",
        "bytes": 509296,
        "sha256": "d005accbb95eb56d3837c390ae81f83c2b8505db5738602da37d1465979822b1"
      },
      "baseline": {
        "mode": "100644",
        "blob": "5e8a574a5af9d8022b984cc4a248cdce21c42199",
        "bytes": 509091,
        "sha256": "1915d2d8afbc62a16d012827ee750f014e43ea08ebf3392b7b5982a6294739a2"
      },
      "inverses": [
        {
          "at": 346824,
          "current": "    'test/crime-fixture.js': 'Import-only explicit crime challenge and browser-play helpers; mandatory minigame and gameplay suites exercise them while raw protocol tests retain missing-answer coverage.',\n",
          "baseline": ""
        }
      ]
    },
    "test/grand-strategy-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "bbc5eeeabe6e17c4a31782d5530c57746ef9a6ff",
        "bytes": 16423,
        "sha256": "5e98f78f402eceacbab9daa4ce097d57277708ac1471886e904174388bf8c138"
      },
      "baseline": {
        "mode": "100644",
        "blob": "041f7230763c34d61920f7f3906573c5166de303",
        "bytes": 15675,
        "sha256": "f165807e0061115875f89e33f4a99c2bb638e9106898f056537feebccd4f2340"
      },
      "inverses": [
        {
          "at": 425,
          "current": "import { CRIME_MINIGAME_GENERATED_FILES, qualifyCrimeMinigameRelease, crimeMinigameActual,\n  crimeMinigameHistoricalInput, crimeMinigameHistoricalEntry } from '../tools/crime-minigame-source-compatibility.js';\n",
          "baseline": ""
        },
        {
          "at": 3042,
          "current": "const successor = qualifyCrimeMinigameRelease();\nassert(postCandidate.every(file => excluded.has(file) || CRIME_MINIGAME_GENERATED_FILES.includes(file) || successor.files.includes(file)),\n  'Only the exact sealed minigame successor and fixed generated domains may follow the reviewed candidate');\n",
          "baseline": "assert(postCandidate.every(file => excluded.has(file)), 'Only the fixed independently generated domains may follow the reviewed candidate');\n"
        },
        {
          "at": 4369,
          "current": "  assert.equal(crimeMinigameHistoricalEntry(file, heads.get(file), 'tree'), entry(file, pin, 'tree'), 'Whole genuine HEAD identity: ' + file);\n  assert.equal(crimeMinigameHistoricalEntry(file, indexes.get(file), 'index'), entry(file, pin, 'index'), 'Whole genuine stage-zero identity: ' + file);\n",
          "baseline": "  assert.equal(heads.get(file), entry(file, pin, 'tree'), 'Whole genuine HEAD identity: ' + file);\n  assert.equal(indexes.get(file), entry(file, pin, 'index'), 'Whole genuine stage-zero identity: ' + file);\n"
        },
        {
          "at": 4749,
          "current": "  const physical = crimeMinigameHistoricalInput(file, fs.readFileSync(file));\n",
          "baseline": "  const physical = fs.readFileSync(file);\n"
        },
        {
          "at": 8050,
          "current": "const currentObserved = crimeMinigameActual(observedFile);\n",
          "baseline": ""
        },
        {
          "at": 11346,
          "current": "  fs.mkdirSync(path.join(temporary, 'public')); fs.writeFileSync(path.join(temporary, observedFile), currentObserved.physical);\n",
          "baseline": "  fs.mkdirSync(path.join(temporary, 'public')); fs.writeFileSync(path.join(temporary, observedFile), observed.physical);\n"
        },
        {
          "at": 12878,
          "current": "    + '; import { CRIME_MINIGAME_SOURCE } from ' + JSON.stringify(new URL('../tools/crime-minigame-source-compatibility.js', import.meta.url).href)\n",
          "baseline": ""
        },
        {
          "at": 13226,
          "current": "    + '; const pin = CRIME_MINIGAME_SOURCE.files[file].current; const bytes = execFileSync(\"git\", [\"--no-replace-objects\", \"show\", \"HEAD:\" + file], { maxBuffer: 64 * 1024 * 1024, windowsHide: true });'\n",
          "baseline": "    + '; const pin = source.files[file].current; const bytes = execFileSync(\"git\", [\"--no-replace-objects\", \"show\", \"HEAD:\" + file], { maxBuffer: 64 * 1024 * 1024, windowsHide: true });'\n"
        },
        {
          "at": 14074,
          "current": "  for (const physical of [currentObserved.committed, Buffer.from(currentObserved.committed.toString('utf8').replaceAll('\\n', '\\r\\n'))]) {\n",
          "baseline": "  for (const physical of [observed.committed, Buffer.from(observed.committed.toString('utf8').replaceAll('\\n', '\\r\\n'))]) {\n"
        },
        {
          "at": 14538,
          "current": "  fs.writeFileSync(path.join(temporary, observedFile), currentObserved.physical);\n",
          "baseline": "  fs.writeFileSync(path.join(temporary, observedFile), observed.physical);\n"
        },
        {
          "at": 15166,
          "current": "  fs.writeFileSync(path.join(temporary, observedFile), currentObserved.physical);\n",
          "baseline": "  fs.writeFileSync(path.join(temporary, observedFile), observed.physical);\n"
        }
      ]
    },
    "test/growth.js": {
      "current": {
        "mode": "100644",
        "blob": "6126ff1b52c85c81937c15e6316690ddab8ef64e",
        "bytes": 219963,
        "sha256": "a9a46c206f8e255afa19d9bc14844e45e26ce81233038f8e7bfc0b40fa5c324b"
      },
      "baseline": {
        "mode": "100644",
        "blob": "0e1f99df1dd0f5adc07119534a3412ee5c9affa3",
        "bytes": 219883,
        "sha256": "e9f98498fc333845ed31c34c9ae1ad06e361dd858a4d163a8f3d59de308e6768"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { injectWithCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 1534,
          "current": "  const res = await injectWithCrimeMinigame(app, { method, url, payload: body,\n",
          "baseline": "  const res = await app.inject({ method, url, payload: body,\n"
        }
      ]
    },
    "test/hardening.js": {
      "current": {
        "mode": "100644",
        "blob": "cf843bcf3d0c5e4fc41c48144143e5ddf6fa75da",
        "bytes": 142435,
        "sha256": "48575d5fa8462f5b1b8dfce88e44b29f6d080fc4f1f27b13ad677c8a668cfb67"
      },
      "baseline": {
        "mode": "100644",
        "blob": "c6dd6e3613d7cc4b3ab5dbd62041d1ece87ff0eb",
        "bytes": 142355,
        "sha256": "cba4c8e4c4c5ab7936a32cb2642db4887b1c5e0cae139b51ef0f6b77b3028eeb"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { injectWithCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 3747,
          "current": "  const res = await injectWithCrimeMinigame(app, { method, url, payload: headers?.['content-type'] === 'application/json' && body === undefined ? undefined : adultAuthFixture(method, url, body),\n",
          "baseline": "  const res = await app.inject({ method, url, payload: headers?.['content-type'] === 'application/json' && body === undefined ? undefined : adultAuthFixture(method, url, body),\n"
        }
      ]
    },
    "test/intrigue.js": {
      "current": {
        "mode": "100644",
        "blob": "6bf11c775dd868355689a9fa1370c79eb451887a",
        "bytes": 17055,
        "sha256": "371eb406e5842666aafedabc1d1cd90ea54e5b07c956fc6521d7dc279126734a"
      },
      "baseline": {
        "mode": "100644",
        "blob": "c40d0014f69df76d70ac5297578d06c1dbe09514",
        "bytes": 16975,
        "sha256": "3de8dff5d24079f9948cb6f8c3fd6b1005a5dd748e543dc5c98ed5c9a54a67aa"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { injectWithCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 1503,
          "current": "  const res = await injectWithCrimeMinigame(app, { method, url, headers, payload: body });\n",
          "baseline": "  const res = await app.inject({ method, url, headers, payload: body });\n"
        }
      ]
    },
    "test/lib/ux-opening-live-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "71b3cba2b90ed08fd6a1da7d7eca77591f03181c",
        "bytes": 13285,
        "sha256": "d433f70d7528e381766ed097f7fb6c776821cb5e4140e34606dfd382ca37db57"
      },
      "baseline": {
        "mode": "100644",
        "blob": "0f2c29f2c9c397626be67407b4f66abdfb7a4489",
        "bytes": 13189,
        "sha256": "0397b2dbc14d0158be3794041570d42b585fc0c18feaf9f824c0c79a97db78a8"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { solveCrimeMinigame } from '../crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 6242,
          "current": "      await solveCrimeMinigame(page);\n",
          "baseline": ""
        }
      ]
    },
    "test/mastery.js": {
      "current": {
        "mode": "100644",
        "blob": "c4f78dbba1ef7d9186daf13dd917a59aa76ea7d5",
        "bytes": 28101,
        "sha256": "d4c7d78284132f06e76bed95a2472da00cac89d0579872f9d89f4cefea7028ea"
      },
      "baseline": {
        "mode": "100644",
        "blob": "d5250970a0656ae51317b5b60b5eda7fbb37c900",
        "bytes": 28021,
        "sha256": "91c5e7aa3bb6f3127cba0eb85bbbca5fd2257f5d229365770b707d307626cf3a"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { injectWithCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 928,
          "current": "  const res = await injectWithCrimeMinigame(app, { method, url,\n",
          "baseline": "  const res = await app.inject({ method, url,\n"
        }
      ]
    },
    "test/mcp.js": {
      "current": {
        "mode": "100644",
        "blob": "d3b307fab51b3db81cef7b50872642935fca1943",
        "bytes": 20115,
        "sha256": "d81fab76209f72075e669b2e0a16d0fe0176757d4cdcb7ace3d70828f94787fb"
      },
      "baseline": {
        "mode": "100644",
        "blob": "2701257c2f458af30e02e6d644e73a41d31d846d",
        "bytes": 16887,
        "sha256": "52ecbc53075bfa83ee0d107521de13bf654e627948bbf06cec8733ce7f1437ee"
      },
      "inverses": [
        {
          "at": 2792,
          "current": "        minigame: { required: true, kind: 'signal-lock', challengePath: '/v1/crimes/pick/challenge?approach=standard' },\n",
          "baseline": ""
        },
        {
          "at": 3084,
          "current": "    if (req.url === '/v1/crimes/pick/challenge?approach=standard') return res.end(JSON.stringify({\n      minigame: { token: 'issued-signal-token', rounds: [[0, 1, 2], [3, 0, 1, 2], [1, 2, 3, 0, 1]] },\n",
          "baseline": "    if (req.url === '/v1/agent/act') return res.end(JSON.stringify({\n      actionId: raw ? JSON.parse(raw).actionId : null,\n      result: { ok: true },\n      turn: { turnId: 'turn_next', recommendedActionId: null, actions: [] },\n"
        },
        {
          "at": 3294,
          "current": "    if (req.url === '/v1/agent/act') {\n      const action = raw ? JSON.parse(raw) : {};\n      if (action.actionId?.startsWith('crime:') && !action.minigame) {\n        res.statusCode = 400;\n        return res.end(JSON.stringify({ error: 'crime_minigame_required' }));\n      }\n      if (state.dropNextAgentAct) { state.dropNextAgentAct = false; res.destroy(); return; }\n      return res.end(JSON.stringify({ actionId: action.actionId, result: { ok: true },\n        turn: { turnId: 'turn_next', recommendedActionId: null, actions: [] } }));\n    }\n",
          "baseline": ""
        },
        {
          "at": 6297,
          "current": "    async listTools() { return (await request('tools/list', {})).result.tools; },\n",
          "baseline": ""
        },
        {
          "at": 9260,
          "current": "  const descriptor = turn.body.actions[0];\n  assert.equal(descriptor.minigame.required, true, 'crime descriptors expose the required challenge');\n  const actTool = (await mcp.listTools()).find(tool => tool.name === 'omerta_act');\n  assert.deepEqual(actTool.inputSchema.properties.minigame, {\n    type: 'object', additionalProperties: false, required: ['token', 'moves'], properties: {\n      token: { type: 'string', maxLength: 2048 },\n      moves: { type: 'array', maxItems: 64, items: { type: 'integer', minimum: 0, maximum: 3 } },\n    }, description: 'Required for crime actions. Submit the issued token and your complete move sequence; preserve both unchanged for a retry.',\n  }, 'the named tool advertises the same bounded submission as the game API');\n  const missingGame = await mcp.call('omerta_act', { operationId: 'turn-missing-game' });\n  assert.equal(missingGame.body.error, 'crime_minigame_required', 'the bridge leaves enforcement to the server without solving a game');\n  assert.equal(api.requests.some(request => request.path.includes('/challenge')), false, 'omerta_act never fetches or solves a challenge itself');\n  assert.deepEqual(api.requests.find(request => request.path === '/v1/agent/act').body,\n    { turnId: 'turn_current', actionId: descriptor.id }, 'omitted minigame remains omitted on the wire');\n  const issuedGame = (await mcp.call('omerta_request', { method: 'GET', path: descriptor.minigame.challengePath })).body.minigame;\n  const minigame = { token: issuedGame.token, moves: [1, ...issuedGame.rounds.flat()] };\n  api.state.dropNextAgentAct = true;\n  const ambiguous = await mcp.call('omerta_act', { minigame, operationId: 'turn-action-1' });\n  assert.equal(ambiguous.status, 0, 'a lost acknowledgement retains the current turn for an explicit retry');\n  const acted = await mcp.call('omerta_act', { minigame, operationId: ambiguous.operationId });\n",
          "baseline": "  const acted = await mcp.call('omerta_act', { operationId: 'turn-action-1' });\n"
        },
        {
          "at": 11265,
          "current": "  const turnAttempts = api.requests.filter(request => request.path === '/v1/agent/act').slice(-2);\n  const turnAction = turnAttempts[0];\n  assert.deepEqual(turnAction.body, { turnId: 'turn_current', actionId: descriptor.id, minigame },\n    'the MCP forwards the supplied token and every move, including mistakes, without fabricating a score');\n  assert.deepEqual(turnAttempts[1].body, turnAction.body, 'ambiguous retries preserve the exact minigame and turn body');\n  assert.equal(turnAttempts[1].headers['idempotency-key'], turnAction.headers['idempotency-key'],\n    'ambiguous turn retries retain the original idempotency key');\n",
          "baseline": "  const turnAction = api.requests.find((r) => r.path === '/v1/agent/act');\n  assert.deepEqual(turnAction.body, { turnId: 'turn_current', actionId: 'crime:pick:standard' },\n    'the MCP delegates execution to the server with the latest snapshot authority');\n"
        },
        {
          "at": 12243,
          "current": "  await mcp.call('omerta_turn');\n  await mcp.call('omerta_act', { actionId: 'crew:open', operationId: 'turn-noncrime-1' });\n  assert.deepEqual(api.requests.filter(request => request.path === '/v1/agent/act').at(-1).body,\n    { turnId: 'turn_current', actionId: 'crew:open' }, 'noncrime actions continue to omit the minigame field');\n",
          "baseline": ""
        }
      ]
    },
    "test/noir-shell-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "5eeeb02afd65952753d9397cff88b3fc2eaa9840",
        "bytes": 8800,
        "sha256": "d0bd0bc86c6e2c210a28711344be762f6cdbb3b1c23cefeaf6c48fc027411589"
      },
      "baseline": {
        "mode": "100644",
        "blob": "841c94cc2dfc49367b64757e178f626ef8378c03",
        "bytes": 8705,
        "sha256": "626cdced36ba412e492237d97adcac5e1fe5c0eca08342700a233556a666f027"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { solveCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 7533,
          "current": "      await solveCrimeMinigame(page);\n",
          "baseline": ""
        }
      ]
    },
    "test/rc1-aggression-heir.js": {
      "current": {
        "mode": "100644",
        "blob": "64fe96955cb1d5cf7e8d776c5b79755c76287495",
        "bytes": 19267,
        "sha256": "821f47a47595e270ebf94d7a875bee07ddcf2125c51181fa93c434d781011d5a"
      },
      "baseline": {
        "mode": "100644",
        "blob": "cbe7b88f88d79c9d6a3b5ce6e9a7655a8020320b",
        "bytes": 18906,
        "sha256": "f3101e19024f27600658bdbf290d4885f49773c6ea1efbce9e11544d51f0ccd8"
      },
      "inverses": [
        {
          "at": 8088,
          "current": "    if (method === 'POST' && /^\\/v1\\/crimes\\/[^/?]+$/.test(path) && !body?.minigame) {\n      const challenge = await invoke(accountId, 'GET', path + '/challenge?approach=' + encodeURIComponent(body?.approach || 'standard'));\n      const lock = challenge.body.minigame;\n      body = { ...body, minigame: { token: lock.token, moves: lock.rounds.flat() } };\n    }\n",
          "baseline": ""
        }
      ]
    },
    "test/rc1-alliance-response-barrier.js": {
      "current": {
        "mode": "100644",
        "blob": "ae28b5350605342ebebfb0d91a4a4d7c15f7d714",
        "bytes": 11780,
        "sha256": "b41fae2c04b45ab234838ad50c40937d29b59a675657893df058f8f69754f123"
      },
      "baseline": {
        "mode": "100644",
        "blob": "51bd9782b8d4cdd4b5cc84bb0e32f80032e2ff88",
        "bytes": 11377,
        "sha256": "54918bbe1a8778cb31bc1d76d24f6cf8397ee4a4907281d9cb05ca0430bf3543"
      },
      "inverses": [
        {
          "at": 7047,
          "current": "  let minigame;\n  if (!membership) {\n    const challenge = await app.inject({ method: 'GET', url: '/v1/crimes/' + crime.id + '/challenge?approach=standard',\n      headers: { authorization: 'Bearer ' + actor.token } });\n    assert.equal(challenge.statusCode, 200, challenge.body);\n    const lock = challenge.json().minigame;\n    minigame = { token: lock.token, moves: lock.rounds.flat() };\n  }\n",
          "baseline": ""
        },
        {
          "at": 8748,
          "current": "    payload: membership ? { name: 'Response Barrier Family', tag: 'RB' } : { approach: 'standard', minigame },\n",
          "baseline": "    payload: membership ? { name: 'Response Barrier Family', tag: 'RB' } : { approach: 'standard' },\n"
        }
      ]
    },
    "test/rc1-mobile-postgres.js": {
      "current": {
        "mode": "100644",
        "blob": "2d5fc7503bf600cc74fb2ef3edbf264672b43669",
        "bytes": 10384,
        "sha256": "3317d131030f30f8a2ccd8cd7be47349013961cab65cc1036663323b7467ae38"
      },
      "baseline": {
        "mode": "100644",
        "blob": "8e1560f8e29af439a5624862f8f8f2cbab5f3feb",
        "bytes": 10295,
        "sha256": "66b47f6db39652750c2dcdab579b3ffd7edf9b632046b332122a79676d7a4901"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { solveCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 4214,
          "current": "    await crime.click(); await solveCrimeMinigame(page); const first = await firstResponse;\n",
          "baseline": "    await crime.click(); const first = await firstResponse;\n"
        }
      ]
    },
    "test/security.js": {
      "current": {
        "mode": "100644",
        "blob": "bbae2d91ef7bc229ab08231e50f4bc36274d22f3",
        "bytes": 32971,
        "sha256": "ed0ef5c9ccc9462a0074d5a871e47bec4a82998eb9206a9af47697c9880ac404"
      },
      "baseline": {
        "mode": "100644",
        "blob": "e1ba2fabfd63b52ca291b964465fdf95a18c6024",
        "bytes": 32891,
        "sha256": "2652c41cae1b935f35099a8604913029bda18af6567c185a664e86e4b6ccd3ad"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { injectWithCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 814,
          "current": "  const res = await injectWithCrimeMinigame(app, { method, url, payload: adultAuthFixture(method, url, body),\n",
          "baseline": "  const res = await app.inject({ method, url, payload: adultAuthFixture(method, url, body),\n"
        }
      ]
    },
    "test/skills.js": {
      "current": {
        "mode": "100644",
        "blob": "c1a49c2129ff436bd5b9428210c2f12a9e2b5afc",
        "bytes": 18997,
        "sha256": "4e656fa44f5126a85ab712cfef4f5df0e70a9e95d88fb2be90762f2b210c6bf3"
      },
      "baseline": {
        "mode": "100644",
        "blob": "5c889f57836e097dcf994a6ee956de001a8ff962",
        "bytes": 18917,
        "sha256": "44e84dfea66931050c5953ee3d7415f65c684d531cb14d6c445c26cd144e0ea8"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { injectWithCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 1509,
          "current": "  const res = await injectWithCrimeMinigame(app, { method, url,\n",
          "baseline": "  const res = await app.inject({ method, url,\n"
        }
      ]
    },
    "test/smoke.js": {
      "current": {
        "mode": "100644",
        "blob": "bd43b2cfd8f2d7b2440bd815cb75df094e47043e",
        "bytes": 5077,
        "sha256": "30aea6921d5f3b5fe2b28a1535b259960d134326eb1322ea459ec5cd8d9d8397"
      },
      "baseline": {
        "mode": "100644",
        "blob": "157673c6b1adf241a66ff0a94c137fe2d3f909af",
        "bytes": 4997,
        "sha256": "0bba519cc5717a7db9829a7bb8ed77fb50891648f5f32be53f6652a9738db29f"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { injectWithCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 328,
          "current": "  const res = await injectWithCrimeMinigame(app, { method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body });\n",
          "baseline": "  const res = await app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body });\n"
        }
      ]
    },
    "test/task-puzzle-jobs.js": {
      "current": {
        "mode": "100644",
        "blob": "ccba3e3582e0aa4d37387d5e16a8389b20fcba0a",
        "bytes": 14729,
        "sha256": "4cd86b33b8d15208febea98ce76f342edfe94d2a6b8dc47268e86488b96298c6"
      },
      "baseline": {
        "mode": "100644",
        "blob": "8ee0b2fddb43cf33cfbf02396ba9c1ddcca9d7ee",
        "bytes": 14612,
        "sha256": "6b80ba7c3a1016daecb63e07b5c57dfa529ea4acf22c70293271c97ef12b0c4b"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { injectWithCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 908,
          "current": "  const res = await injectWithCrimeMinigame(app, { method, url, payload: body, headers: token ? { authorization: `Bearer ${token}` } : {} });\n",
          "baseline": "  const res = await app.inject({ method, url, payload: body, headers: token ? { authorization: `Bearer ${token}` } : {} });\n"
        },
        {
          "at": 12592,
          "current": "  assert(rules.crimes.every(crime => crime.puzzle?.scope === 'crime' && crime.puzzle.required === true && crime.puzzle.benefit === 'success_odds' && crime.puzzle.kind === 'signal-lock'));\n",
          "baseline": "  assert(rules.crimes.every(crime => crime.puzzle?.scope === 'crime' && crime.puzzle.required === false && crime.puzzle.benefit === 'feedback_only'));\n"
        }
      ]
    },
    "test/task-puzzles-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "662f2b98645006f8686b814b6066324727c205ac",
        "bytes": 15624,
        "sha256": "13b7c26e8dae6a7064c723280b7b994b0a560244003fb2ce712060f1c60b79bc"
      },
      "baseline": {
        "mode": "100644",
        "blob": "049a6f2c4a9503fa1b7d7751ad50b83a6954ee32",
        "bytes": 22734,
        "sha256": "0011fcfa2b5ece16526952cdefbdb2b7a4b4837fb11a634c15ff44cb766f1519"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { solveCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 14202,
          "current": "  // Crime preparation has become the mandatory interactive lock on every approach.\n",
          "baseline": "  await page.setViewportSize({ width: 1280, height: 1000 });\n"
        },
        {
          "at": 14545,
          "current": "  await crimeBook();\n  assert.equal(await page.locator('[data-task-crime]').count(), 0, 'The obsolete optional preparation entry is removed.');\n  const attempted = page.waitForResponse(r => r.url().endsWith('/v1/crimes/pick') && r.request().method() === 'POST');\n  await page.locator('[data-do=\"POST /v1/crimes/pick\"]').filter({ hasText: 'do it' }).first().click();\n  await solveCrimeMinigame(page);\n  const completed = await attempted;\n  assert.equal(completed.status(), 200);\n  assert.equal((await completed.json()).minigame.completed, true, 'The real crime control completes the required minigame.');\n",
          "baseline": "  await crimeBook(); await page.locator('[data-task-crime=\"pick\"]').click(); await dialog().getByRole('button', { name: 'Solve and attempt crime' }).waitFor();\n  assert.match(await dialog().innerText(), /feedback only.*no.*odds.*reward/i);\n  const cp = await puzzleOf('crime', 'pick', token); await choose(cp);\n  await page.screenshot({ path: `${artifacts}/desktop-crime-preparation.png` });\n  // A different committed attempt makes the open preparation stale. Never automatically reroll/resubmit.\n  await api('POST', '/v1/crimes/pick', token, {});\n  await app.pool.query('UPDATE characters SET street_action_at=NULL,jail_until=NULL,nerve=50 WHERE id=$1', [ch.id]);\n  const stale = page.waitForResponse(r => r.url().endsWith('/v1/crimes/pick') && r.request().method() === 'POST');\n  await dialog().getByRole('button', { name: 'Solve and attempt crime' }).click();\n  assert.equal((await (await stale).json()).error, 'stale_task_puzzle');\n  await dialog().getByRole('button', { name: 'Reopen current task' }).click();\n  await dialog().getByRole('button', { name: 'Solve and attempt crime' }).waitFor();\n  const current = await puzzleOf('crime', 'pick', token); assert.notEqual(current.id, cp.id); await choose(current);\n  await dialog().getByLabel('Crime approach').selectOption('quiet');\n  const revisionBefore = Number((await app.pool.query('SELECT crime_puzzle_revision FROM characters WHERE id=$1', [ch.id])).rows[0].crime_puzzle_revision);\n  await page.route('**/v1/crimes/pick', route => route.abort('failed'));\n  await dialog().getByRole('button', { name: 'Solve and attempt crime' }).click();\n  await dialog().getByRole('button', { name: 'Check task status' }).waitFor();\n  await page.unroute('**/v1/crimes/pick');\n  const originalAttempt = requests.filter(r => r.url === '/v1/crimes/pick').at(-1);\n  assert.equal(originalAttempt.body.approach, 'quiet', 'Optional preparation preserves the explicitly selected approach.');\n  // Reload while a submission has an unknown outcome. The same draft and exact request key survive.\n  await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor(); await navigate('streets'); await crimeBook();\n  await page.locator('[data-task-crime=\"pick\"]').click(); await dialog().getByRole('button', { name: 'Check task status' }).waitFor();\n  assert.equal((await puzzleOf('crime', 'pick', token)).id, current.id);\n  assert.equal(await dialog().getByLabel('Crime approach').inputValue(), 'quiet', 'Recovery displays the approach that will actually be retried.');\n  await page.route('**/v1/task-puzzles?*', route => route.abort('failed'));\n  await dialog().getByRole('button', { name: 'Check task status' }).click();\n  await dialog().getByRole('status').filter({ hasText: 'Status is unavailable' }).waitFor();\n  assert.equal(await dialog().getByRole('button', { name: 'Solve and attempt crime' }).isDisabled(), true);\n  await page.unroute('**/v1/task-puzzles?*');\n  await dialog().getByRole('button', { name: 'Check task status' }).click();\n  await dialog().getByRole('button', { name: 'Retry same submission' }).waitFor();\n  const prepared = page.waitForResponse(r => r.url().endsWith('/v1/crimes/pick') && r.request().method() === 'POST');\n  await dialog().getByRole('button', { name: 'Retry same submission' }).click();\n  assert.equal((await (await prepared).json()).puzzle.completed, true);\n  const retryAttempt = requests.filter(r => r.url === '/v1/crimes/pick').at(-1);\n  assert.deepEqual(retryAttempt, originalAttempt, 'Uncertain retry uses the exact original request key, answer and approach.');\n  await dialog().getByRole('status').filter({ hasText: 'recorded' }).waitFor(); await page.keyboard.press('Escape');\n  assert.equal(Number((await app.pool.query('SELECT crime_puzzle_revision FROM characters WHERE id=$1', [ch.id])).rows[0].crime_puzzle_revision), revisionBefore + 1, 'One committed prepared attempt after failed dispatch and reload.');\n  for (const recovery of ['dismissal', 'reload']) {\n    await app.pool.query('UPDATE characters SET street_action_at=NULL,jail_until=NULL,nerve=50 WHERE id=$1', [ch.id]);\n    await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor(); await navigate('streets'); await crimeBook();\n    await page.locator('[data-task-crime=\"pick\"]').click(); await dialog().getByRole('button', { name: 'Solve and attempt crime' }).waitFor();\n    const pendingPuzzle = await puzzleOf('crime', 'pick', token); await choose(pendingPuzzle);\n    const revision = Number((await app.pool.query('SELECT crime_puzzle_revision FROM characters WHERE id=$1', [ch.id])).rows[0].crime_puzzle_revision);\n    const crimeRequests = requests.filter(r => r.url === '/v1/crimes/pick').length;\n    await page.route('**/v1/crimes/pick', async route => {\n      const committed = await route.fetch();\n      assert.equal(committed.status(), 200); assert.equal((await committed.json()).puzzle.completed, true);\n      await route.abort('failed');\n    });\n    await dialog().getByRole('button', { name: 'Solve and attempt crime' }).click();\n    await dialog().getByRole('button', { name: 'Check task status' }).waitFor();\n    await page.unroute('**/v1/crimes/pick');\n    // Only readiness changes: the committed attempt's occurrence revision is deliberately retained.\n    await app.pool.query('UPDATE characters SET street_action_at=NULL,jail_until=NULL,nerve=50 WHERE id=$1', [ch.id]);\n    const issues = requests.filter(r => r.url === '/v1/task-puzzles').length;\n    if (recovery === 'reload') {\n      await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor(); await navigate('streets'); await crimeBook();\n    } else await page.keyboard.press('Escape');\n    await page.locator('[data-task-crime=\"pick\"]').click(); await dialog().waitFor(); await page.waitForLoadState('networkidle');\n    assert.equal(requests.filter(r => r.url === '/v1/task-puzzles').length, issues,\n      `${recovery}: unresolved committed crime is discovered by task selector before issuing any new puzzle.`);\n    await dialog().getByRole('status').filter({ hasText: 'occurrence changed' }).waitFor();\n    assert.equal(await dialog().getByRole('button', { name: 'Solve and attempt crime' }).isDisabled(), true);\n    assert.equal(await puzzleOf('crime', 'pick', token), null, 'Receipt reconciliation must not itself issue the new occurrence.');\n    assert.equal(requests.filter(r => r.url === '/v1/crimes/pick').length, crimeRequests + 1, 'Recovery never resends the committed crime.');\n    assert.equal(Number((await app.pool.query('SELECT crime_puzzle_revision FROM characters WHERE id=$1', [ch.id])).rows[0].crime_puzzle_revision), revision + 1);\n    await dialog().getByRole('button', { name: 'Reopen current task' }).click();\n    await dialog().getByRole('button', { name: 'Solve and attempt crime' }).waitFor();\n    assert.equal(await dialog().getByRole('button', { name: 'Solve and attempt crime' }).isDisabled(), false);\n    assert.notEqual((await puzzleOf('crime', 'pick', token)).id, pendingPuzzle.id, 'Only explicit reopening issues the next occurrence.');\n    await page.keyboard.press('Escape');\n  }\n  await app.pool.query('UPDATE characters SET street_action_at=NULL,jail_until=NULL,nerve=50 WHERE id=$1', [ch.id]);\n  await page.reload({ waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor(); await navigate('streets');\n  const ordinary = page.waitForResponse(r => r.url().endsWith('/v1/crimes/pick') && r.request().method() === 'POST');\n  await crimeBook(); await page.locator('[data-do=\"POST /v1/crimes/pick\"]').filter({ hasText: 'do it' }).first().click();\n  assert.equal((await ordinary).status(), 200, 'Ordinary crime still works with no preparation.');\n"
        },
        {
          "at": 15181,
          "current": "  console.log(`task puzzle browser: mission/Hustle entries, four mechanics, keyboard/touch, hints, wrong retry, drafts/reload/dismissal, pending/lost-response recovery, one reward, mobile fit and required crime minigame passed; screenshots ${artifacts}`);\n",
          "baseline": "  console.log(`task puzzle browser: real production mission/Hustle/crime entries, four mechanics, keyboard/touch, hints, wrong retry, drafts/reload/dismissal, pending/lost-response recovery, stale reopen, one reward and mobile fit passed; screenshots ${artifacts}`);\n"
        }
      ]
    },
    "test/ux-experience-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "3e3924a80ff0a8530a5111e0e5311a70db000212",
        "bytes": 13298,
        "sha256": "0577de571a10b7e801cd12b8b25be5baee1851cd9b640a2b6cbdba66577f58d4"
      },
      "baseline": {
        "mode": "100644",
        "blob": "9bbbb788912025a9ee869d2598f498633d7167ab",
        "bytes": 13205,
        "sha256": "c45f3029c5c0493a487aee925fb49c71b1b87fa5a4d48b7e7e3b4d140b67f884"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { solveCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 6936,
          "current": "    await solveCrimeMinigame(page);\n",
          "baseline": ""
        }
      ]
    },
    "test/ux-postgres-rls.js": {
      "current": {
        "mode": "100644",
        "blob": "d1eb2d2c1e27e5e8ec68eb4a475530c11ea1919a",
        "bytes": 14543,
        "sha256": "99bb002ccb9755a1caada09a7975a59c78f9ebc21d1ae59e50544768c14d39be"
      },
      "baseline": {
        "mode": "100644",
        "blob": "4b6040108b76f3aa1913cd4b0de951009d5391f1",
        "bytes": 14463,
        "sha256": "aad968219a2953852ecaff9805fbdb7a5ab2c97c3c50a19ec00febe29233c6ce"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { injectWithCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 2567,
          "current": "  const r = await injectWithCrimeMinigame(app, { method, url, payload, headers: { ...(player ? { authorization: 'Bearer ' + player.token } : {}), ...(!['GET', 'HEAD'].includes(method) ? { 'idempotency-key': randomUUID() } : {}) } });\n",
          "baseline": "  const r = await app.inject({ method, url, payload, headers: { ...(player ? { authorization: 'Bearer ' + player.token } : {}), ...(!['GET', 'HEAD'].includes(method) ? { 'idempotency-key': randomUUID() } : {}) } });\n"
        }
      ]
    },
    "test/ux-shell-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "ef1d7a8b6125914fb09087252c43ccf787227316",
        "bytes": 20459,
        "sha256": "4e1c70bbb574446a987c65ae917a5fa508ce19a5f75e98d86c3742877d86344a"
      },
      "baseline": {
        "mode": "100644",
        "blob": "aa1395f9163ffcccf49a4ff7bc8aa9e9a5558d49",
        "bytes": 20368,
        "sha256": "d46f6226abfdde44cee41da50406740fe911e457a532f2f86e403caf6f3c26b4"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { solveCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 19280,
          "current": "  await solveCrimeMinigame(page);\n",
          "baseline": ""
        }
      ]
    },
    "test/ux-tactics-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "9ee062e646dcb36ca5184c1383dc8631e0416e13",
        "bytes": 12791,
        "sha256": "0c19f6fd79c7a7073b7d40ba926f37ffe40b10fa0faf1930c52a44e933c99f6e"
      },
      "baseline": {
        "mode": "100644",
        "blob": "d6177f5bb6eadd36a612c1948562b34178c2aa17",
        "bytes": 12696,
        "sha256": "94a11845a2080cf824131ec51534d152626a7dcd96332b6a84b0dce1a00c6d68"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { solveCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 10150,
          "current": "      await solveCrimeMinigame(page);\n",
          "baseline": ""
        }
      ]
    },
    "tools/agent-alpha.js": {
      "current": {
        "mode": "100644",
        "blob": "d26be85ca40194e155cbefdcfd67ae82393c4e82",
        "bytes": 53055,
        "sha256": "8c9ee6b8107486c157c0cd441271617d16bf539db625b369c355ddf8670ede1e"
      },
      "baseline": {
        "mode": "100644",
        "blob": "59a687d9b7725c6d945f520278b2ca37cd44a278",
        "bytes": 50695,
        "sha256": "a501ecf510237c626bf1508e757027023e8fdb8cdda0483b9e05df8c71abbc03"
      },
      "inverses": [
        {
          "at": 23359,
          "current": "  const pendingKeys = ['operationId', 'turnId', 'actionId', 'startedAt',\n    ...(session?.pending?.decisionCallId !== undefined ? ['decisionCallId'] : []),\n    ...(session?.pending?.minigame !== undefined ? ['minigame'] : [])];\n",
          "baseline": ""
        },
        {
          "at": 23665,
          "current": "    exactKeys(session.pending, pendingKeys) &&\n    (session.pending.decisionCallId === undefined || (typeof session.pending.decisionCallId === 'string'\n      && /^[A-Za-z0-9_-]{1,128}$/.test(session.pending.decisionCallId))) &&\n    (session.pending.minigame === undefined || validCrimeMinigame(session.pending.minigame)) &&\n",
          "baseline": "    (exactKeys(session.pending, ['operationId', 'turnId', 'actionId', 'startedAt'])\n      || (exactKeys(session.pending, ['operationId', 'turnId', 'actionId', 'startedAt', 'decisionCallId'])\n        && typeof session.pending.decisionCallId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(session.pending.decisionCallId))) &&\n"
        },
        {
          "at": 40576,
          "current": "function validCrimeMinigame(value) {\n  return value && typeof value === 'object' && !Array.isArray(value)\n    && Object.keys(value).sort().join(',') === 'moves,token'\n    && typeof value.token === 'string' && value.token.length > 0 && value.token.length <= 2048\n    && Array.isArray(value.moves) && value.moves.length <= 64\n    && value.moves.every(move => Number.isInteger(move) && move >= 0 && move <= 3);\n}\n\nasync function prepareCrimeMinigame({ base, fetchImpl, session, action }) {\n  if (action.kind !== 'crime' || action.minigame?.required !== true) return null;\n  const path = action.minigame.challengePath;\n  if (action.minigame.kind !== 'signal-lock' || typeof path !== 'string'\n    || !/^\\/v1\\/crimes\\/[a-z0-9_-]+\\/challenge(?:\\?approach=(?:quiet|standard|loud))?$/.test(path))\n    throw new Error('Agent Alpha received an unsupported crime minigame');\n  const { minigame } = await requestJson(fetchImpl, base, path, { token: session.token });\n  if (minigame?.kind !== 'signal-lock' || minigame.maxMistakes !== 3\n    || !Array.isArray(minigame.rounds) || minigame.rounds.length !== 3\n    || !minigame.rounds.every((round, index) => Array.isArray(round) && round.length === index + 3)\n    || !Number.isFinite(Date.parse(minigame.expiresAt)) || Date.parse(minigame.expiresAt) <= Date.now())\n    throw new Error('Agent Alpha received an invalid crime minigame');\n  // The public signal is the agent's input. Persist its complete trace before\n  // executing the issued action, so a lost acknowledgement cannot reroll it.\n  const submission = { token: minigame.token, moves: minigame.rounds.flat() };\n  if (!validCrimeMinigame(submission)) throw new Error('Agent Alpha received an invalid crime minigame');\n  return submission;\n}\n\n",
          "baseline": ""
        },
        {
          "at": 42707,
          "current": "        ...(pending.decisionCallId !== undefined ? { decisionCallId: pending.decisionCallId } : {}),\n        ...(pending.minigame !== undefined ? { minigame: pending.minigame } : {}) },\n",
          "baseline": "        ...(pending.decisionCallId !== undefined ? { decisionCallId: pending.decisionCallId } : {}) },\n"
        },
        {
          "at": 42921,
          "current": "    const staleTurn = error?.status === 409 && error?.code === 'stale_turn';\n    const staleMinigame = error?.status === 400\n      && ['stale_crime_minigame', 'crime_minigame_required'].includes(error?.code);\n    if (!staleTurn && !staleMinigame) throw error;\n",
          "baseline": "    if (error?.status !== 409 || error?.code !== 'stale_turn') throw error;\n"
        },
        {
          "at": 43381,
          "current": "      errorCode: error.code,\n",
          "baseline": "      errorCode: 'stale_turn',\n"
        },
        {
          "at": 48038,
          "current": "    const minigame = await prepareCrimeMinigame({ base, fetchImpl, session, action });\n",
          "baseline": ""
        },
        {
          "at": 48503,
          "current": "        ...(minigame ? { minigame } : {}),\n",
          "baseline": ""
        }
      ]
    },
    "tools/arena.js": {
      "current": {
        "mode": "100644",
        "blob": "2764a881e9eb490c016b4cb4a365c30e0e7fff85",
        "bytes": 80532,
        "sha256": "f66387eae931a9d3c40516e882d7484844e00d3d95848285b5b7b15e36d7a79f"
      },
      "baseline": {
        "mode": "100644",
        "blob": "34e2ea8203fd17f7a4cc255c48f3082450a11be3",
        "bytes": 80221,
        "sha256": "0d075f944a253a9a55dd954334d57236fbfd12e03c996f5e2cd8b1b641d33f6a"
      },
      "inverses": [
        {
          "at": 4924,
          "current": "import { completeCrimeMinigame } from './crime-minigame-client.js';\n",
          "baseline": ""
        },
        {
          "at": 16913,
          "current": "const send = async (method, url, token, body) => {\n",
          "baseline": "const call = async (method, url, token, body) => {\n"
        },
        {
          "at": 17212,
          "current": "const call = (method, url, token, body) => method === 'POST' && /^\\/v1\\/crimes\\/[^/?]+$/.test(url)\n  ? completeCrimeMinigame((m, p, options) => send(m, p, options.token, options.body), url, { token, body })\n  : send(method, url, token, body);\n",
          "baseline": ""
        }
      ]
    },
    "tools/chaos.js": {
      "current": {
        "mode": "100644",
        "blob": "9ac6e2b19713016a3961a874af3ff85350d5a6cb",
        "bytes": 34318,
        "sha256": "54ecf3499d59237683dc8c00215f84908c0ad7fd4793f0210110355f5c76cb9e"
      },
      "baseline": {
        "mode": "100644",
        "blob": "6ceeb3e297a1adaf896c2b4beed2a43d521d5f3a",
        "bytes": 34075,
        "sha256": "ddf83350a73deb1ffd02e77bb49ada6d44fb0565d2e00c0c021f52ac73a8ced2"
      },
      "inverses": [
        {
          "at": 3055,
          "current": "import { completeCrimeMinigame } from './crime-minigame-client.js';\n",
          "baseline": ""
        },
        {
          "at": 5180,
          "current": "const send = async (method, path, { token, body } = {}) => {\n",
          "baseline": "const api = async (method, path, { token, body } = {}) => {\n"
        },
        {
          "at": 5735,
          "current": "const api = (method, path, options) => method === 'POST' && /^\\/v1\\/crimes\\/[^/?]+$/.test(path)\n  ? completeCrimeMinigame(send, path, options) : send(method, path, options);\n",
          "baseline": ""
        }
      ]
    },
    "tools/grand-strategy-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "604a64c119f8b1b414c91de8c1f1f7176af54a44",
        "bytes": 16493,
        "sha256": "2cd99ada525702f463c1796498e160e0913d441f95e9fd8b8b0f41c36701c7f2"
      },
      "baseline": {
        "mode": "100644",
        "blob": "fa3e2181dd25e67015363a007110018747a34568",
        "bytes": 15556,
        "sha256": "0a76d88ec53c23e48045a3702f647da8164d841e42a12f1236f66c1482ccf1dd"
      },
      "inverses": [
        {
          "at": 337,
          "current": "import { crimeMinigameHistoricalInput, crimeMinigameHistoricalEntry, crimeMinigameHistoricalRecord } from './crime-minigame-source-compatibility.js';\n\n// Actual-current checks must not consume a historical fixture's projected read.\nconst readActualPhysical = fs.readFileSync.bind(fs);\n",
          "baseline": ""
        },
        {
          "at": 10981,
          "current": "  const rawHead = git('ls-tree', 'HEAD', '--', file).trim();\n  const rawIndex = git('ls-files', '--stage', '--', file).trim();\n  const stat = fs.lstatSync(file), rawPhysical = readActualPhysical(file);\n  const rawCommitted = execFileSync('git', ['--no-replace-objects', 'show', 'HEAD:' + file], {\n    windowsHide: true, maxBuffer: 64 * 1024 * 1024,\n  });\n  const headMatch = rawHead.match(/^(100644|100755) blob ([a-f0-9]{40})\\t/);\n  assert(headMatch, 'Regular genuine current Git source required');\n  const actual = crimeMinigameHistoricalRecord(file, { head: { mode: headMatch[1], blob: headMatch[2] },\n    index: rawIndex, committed: rawCommitted, physical: rawPhysical, regular: stat.isFile(), symbolic: stat.isSymbolicLink() });\n  const headEntry = entry(file, actual.head, 'tree'), { index, committed, physical } = actual;\n",
          "baseline": "  const headEntry = git('ls-tree', 'HEAD', '--', file).trim();\n  const index = git('ls-files', '--stage', '--', file).trim();\n"
        },
        {
          "at": 12025,
          "current": "",
          "baseline": "  const stat = fs.lstatSync(file), physical = fs.readFileSync(file);\n"
        },
        {
          "at": 12121,
          "current": "",
          "baseline": "  const committed = execFileSync('git', ['--no-replace-objects', 'show', 'HEAD:' + file], {\n    windowsHide: true, maxBuffer: 64 * 1024 * 1024,\n  });\n"
        },
        {
          "at": 14046,
          "current": "  input = crimeMinigameHistoricalInput(file, input);\n",
          "baseline": ""
        },
        {
          "at": 14461,
          "current": "  input = crimeMinigameHistoricalEntry(file, input, kind);\n",
          "baseline": ""
        },
        {
          "at": 14956,
          "current": "  actual = crimeMinigameHistoricalRecord(file, actual);\n",
          "baseline": ""
        }
      ]
    },
    "tools/loadtest.js": {
      "current": {
        "mode": "100644",
        "blob": "be8cef5c1cd2bf5a6eb89c5b130aefe7fa4ddd4d",
        "bytes": 23462,
        "sha256": "4e182b466bfff359e0d8eaf8163d4137eabcec4c16d14abec30ede75e658bce2"
      },
      "baseline": {
        "mode": "100644",
        "blob": "89391d94a3d016e303c58f01ad1596d956f6372c",
        "bytes": 23271,
        "sha256": "085ea4b9c7f72248abc6289cad41df435d9e47e718b1396441c6adb5b4a0f27e"
      },
      "inverses": [
        {
          "at": 5050,
          "current": "import { completeCrimeMinigame } from './crime-minigame-client.js';\n",
          "baseline": ""
        },
        {
          "at": 16907,
          "current": "      await completeCrimeMinigame((method, path, options) =>\n        hit(method === 'GET' ? 'read:crime-challenge' : 'write:crime', method, path, options),\n      '/v1/crimes/pick', { token: me.token });\n",
          "baseline": "      await hit('write:crime', 'POST', '/v1/crimes/pick', { token: me.token });\n"
        }
      ]
    },
    "tools/mobile.js": {
      "current": {
        "mode": "100644",
        "blob": "a2f8b1af84f0a2b37640003d859f991be22440d5",
        "bytes": 81842,
        "sha256": "796c5aadf8ae79398309d0a62a8298c637dd3f4ae3eb0a93d6ee1744f5726c9c"
      },
      "baseline": {
        "mode": "100644",
        "blob": "68949ad778b3caeb60e446748077dda5e7047acb",
        "bytes": 81744,
        "sha256": "c4415f67194b74f14529f8ff3e82d389512e75b5e9e553d4e63d16b026d3dc06"
      },
      "inverses": [
        {
          "at": 2634,
          "current": "import { solveCrimeMinigame } from '../test/crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 26177,
          "current": "        await crime.tap();\n        await solveCrimeMinigame(page);\n        const response = await crimeResponse;\n",
          "baseline": "        const [, response] = await Promise.all([crime.tap(), crimeResponse]);\n"
        }
      ]
    },
    "tools/pgcheck.js": {
      "current": {
        "mode": "100644",
        "blob": "def416de52551dadd7d1952ea52a8f775ce05f00",
        "bytes": 143041,
        "sha256": "8c3971a5e971ed7c62577abb76bfa7c38b5f1587df088b6507ed3b3e40241de6"
      },
      "baseline": {
        "mode": "100644",
        "blob": "1fa9d0aae9d1c2fef9a2eb4b92ee4825b9058dca",
        "bytes": 142802,
        "sha256": "c18c34dcff950a67df914d4a2ff59b54299e89f966845d40a5d50f248403acb5"
      },
      "inverses": [
        {
          "at": 1434,
          "current": "import { completeCrimeMinigame } from './crime-minigame-client.js';\n",
          "baseline": ""
        },
        {
          "at": 3646,
          "current": "const send = async (method, url, { token, body } = {}) => {\n",
          "baseline": "const call = async (method, url, { token, body } = {}) => {\n"
        },
        {
          "at": 3992,
          "current": "const call = (method, url, options) => method === 'POST' && /^\\/v1\\/crimes\\/[^/?]+$/.test(url)\n  ? completeCrimeMinigame(send, url, options) : send(method, url, options);\n",
          "baseline": ""
        }
      ]
    },
    "tools/playthrough.js": {
      "current": {
        "mode": "100644",
        "blob": "878ad3238e792198a5dcb0a7447ac9073343f892",
        "bytes": 89106,
        "sha256": "1654ff8a518ae3a181468fd1763df2073cea05484e758f6670a09f9746874fdb"
      },
      "baseline": {
        "mode": "100644",
        "blob": "1ee60ba79a5f5ec4a28833ec1bcc21869b8a0c8d",
        "bytes": 88867,
        "sha256": "1a35da44cacf27e8868f453bfabf1c83ce17c9025b8278a131384d06d573002b"
      },
      "inverses": [
        {
          "at": 2233,
          "current": "import { completeCrimeMinigame } from './crime-minigame-client.js';\n",
          "baseline": ""
        },
        {
          "at": 4218,
          "current": "const send = async (method, url, { token, body } = {}) => {\n",
          "baseline": "const call = async (method, url, { token, body } = {}) => {\n"
        },
        {
          "at": 4531,
          "current": "const call = (method, url, options) => method === 'POST' && /^\\/v1\\/crimes\\/[^/?]+$/.test(url)\n  ? completeCrimeMinigame(send, url, options) : send(method, url, options);\n",
          "baseline": ""
        }
      ]
    },
    "tools/scale.js": {
      "current": {
        "mode": "100644",
        "blob": "fda125445e4c22a24b72d498d59eca3410bdeb55",
        "bytes": 52396,
        "sha256": "b0883051ff54a062443839666bd444ba0f879e734315b53cb48003b1ab249c8f"
      },
      "baseline": {
        "mode": "100644",
        "blob": "d68a79ebca0f30213fe29c9c92f7c45b4961e67b",
        "bytes": 52085,
        "sha256": "7e4936a0f2cc47f298f94bda522695520709bb8dfc77f39c03278c6edbe32e68"
      },
      "inverses": [
        {
          "at": 4358,
          "current": "import { completeCrimeMinigame } from './crime-minigame-client.js';\n",
          "baseline": ""
        },
        {
          "at": 6225,
          "current": "const send = async (method, url, token, body) => {\n",
          "baseline": "const call = async (method, url, token, body) => {\n"
        },
        {
          "at": 6595,
          "current": "const call = (method, url, token, body) => method === 'POST' && /^\\/v1\\/crimes\\/[^/?]+$/.test(url)\n  ? completeCrimeMinigame((m, p, options) => send(m, p, options.token, options.body), url, { token, body })\n  : send(method, url, token, body);\n",
          "baseline": ""
        }
      ]
    },
    "tools/sim.js": {
      "current": {
        "mode": "100644",
        "blob": "7fd41cc362486f3d58a317cafbda88961ddd107a",
        "bytes": 153938,
        "sha256": "284faea57dd38fb41b9a9e52964900afa2fab70b2e5242280fba07bf8f53cd9f"
      },
      "baseline": {
        "mode": "100644",
        "blob": "d675eecc4c6c6ab33e4ad9c0551ba313f65cac8f",
        "bytes": 153757,
        "sha256": "d7f1f1b1470cd205aeaf1a9015efcaf199172bd225a5736ae3d548d7548007db"
      },
      "inverses": [
        {
          "at": 1659,
          "current": "import { completeCrimeMinigame } from './crime-minigame-client.js';\n",
          "baseline": ""
        },
        {
          "at": 4370,
          "current": "  if (method === 'POST' && /^\\/v1\\/crimes\\/[^/?]+$/.test(url)) return completeCrimeMinigame(call, url, options);\n",
          "baseline": ""
        }
      ]
    }
  },
  "additions": {
    "public/ux-crime-minigame.css": {
      "mode": "100644",
      "blob": "10356210e87f95679e0208cda98b8d147a999ee6",
      "bytes": 3426,
      "sha256": "62e48060a7f0388161b2961a4420d85d88fb92bab3a7db863df3672eefb5a11f"
    },
    "public/ux-crime-minigame.js": {
      "mode": "100644",
      "blob": "0eccb0f3257e02d29df3432ca640e229b5b7ac68",
      "bytes": 8237,
      "sha256": "322bff5ac525c7f2eeb729cb1ad7f0e9b1280a3cd2cf82832b000a90c30bcc15"
    },
    "src/crime-minigame.js": {
      "mode": "100644",
      "blob": "58826d22de37e6f16bc0b3427c859e606705e0ed",
      "bytes": 4528,
      "sha256": "a83a80b55d755dcaa6771e5dee65f71cdf33b9cd83f9876bbea32dd7ddae8a86"
    },
    "test/crime-fixture.js": {
      "mode": "100644",
      "blob": "04c9482bbbcd416fbe7ed6566ddff96f5bd39902",
      "bytes": 1982,
      "sha256": "d97eb473fbd5f08f22426b91528cc158c185a91bfd4d160a2761a2c05193587e"
    },
    "test/crime-minigame-browser.js": {
      "mode": "100644",
      "blob": "520794b4c34b4447ae2a97e202ca8f82960fd49e",
      "bytes": 7846,
      "sha256": "164a5becbd40cfb3e3a152d20d681e0dd0f241b2c5e4c50ab0c0cc2ab4c46188"
    },
    "test/crime-minigame-source-transfer.js": {
      "mode": "100644",
      "blob": "18b4e38f2f25b85785280fbcb72e29ed5a0ee3b1",
      "bytes": 9921,
      "sha256": "fcd74cd43cef8ba85c1a96665a87a6fdc9e336b34214777551b1d0c6c40238ec"
    },
    "test/crime-minigame.js": {
      "mode": "100644",
      "blob": "7ce61200b14d4e2274734f257d6b027c65e44d7b",
      "bytes": 9969,
      "sha256": "afa9be4c1f8a0971eead163b1aeddc022fe7f9a726c48ae33ef18dd46df22859"
    },
    "tools/crime-minigame-client.js": {
      "mode": "100644",
      "blob": "15652a33847158fc6aa1217b4d817fee56c61297",
      "bytes": 943,
      "sha256": "a7a660f226d7367b11b4da9161a6f43bd71f641b406e330a5ff80804983af810"
    },
    "tools/crime-minigame-source-compatibility.js": {
      "mode": "100644",
      "blob": "a2cee69de2ea023736acf1ffd3ed441d3f30354d",
      "bytes": 10171,
      "sha256": "8efef1d7c115f8d2875648e61efdc2c1a34080c98451c2dae5ce422edff815e7"
    },
    "tools/seal-crime-minigame-source.js": {
      "mode": "100644",
      "blob": "6553304c8eb5f85c59d991e32788e824379d3de8",
      "bytes": 3913,
      "sha256": "616ff2f8be589da27e309f693eaa964e988fde92e7a6505f484d28b127cf1358"
    }
  }
});
export const CRIME_MINIGAME_SOURCE_SHA256 = 'a351bda03fd0c24a8c7f2dc96a83e2426eb9aea8d3bf2b9d8f59494808bb000d';
