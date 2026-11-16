// Exact crime-minigame historical comparison only; no execution or deployment results transferred.
const freeze = value => { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const CRIME_MINIGAME_SOURCE = freeze({
  "status": "SEALED",
  "phase": "EXACT_CRIME_MINIGAME_SOURCE_COMPARISON_ONLY",
  "revision": "95196e4d50e0769355d57574e6ec3ab0d6126950",
  "tree": "ce634794f406666c309b05f31f85ed488e39140c",
  "predecessor": "8672b0147daced1d957ef772c9bb3fc07b327f81",
  "predecessorTree": "f0eabc99bc07a4a65d6bb2c527cdd84e102f5398",
  "files": {
    ".github/workflows/ui-trim-source.yml": {
      "current": {
        "mode": "100644",
        "blob": "1a0805b3002d5a9fe75980f57738ff263fe41841",
        "bytes": 1946,
        "sha256": "63b6e229d514c0a7cc15190006310651ef829f882a4eeeb66f44c393a6433208"
      },
      "baseline": {
        "mode": "100644",
        "blob": "d0c6611dee75982f8e91ac04d491438cd0850c12",
        "bytes": 838,
        "sha256": "1e85075d7a44a014f885cfc4b38bea456e857ddaa7ed7a3e1ed2c79f2313c8fb"
      },
      "inverses": [
        {
          "at": 838,
          "current": "\n  ui_browser:\n    name: Desktop and mobile browser checks\n    runs-on: ubuntu-latest\n    timeout-minutes: 20\n    env:\n      DATABASE_URL: ''\n      LEGAL_OPERATOR_NAME: CI Test Operator\n      LEGAL_POSTAL_ADDRESS: 123 Fixture Street, Test City\n      PRIVACY_CONTACT_EMAIL: privacy@example.test\n      DMCA_AGENT_NAME: CI Test Agent\n      DMCA_AGENT_EMAIL: copyright@example.test\n      DMCA_AGENT_ADDRESS: 123 Fixture Street, Test City\n      DMCA_AGENT_PHONE: '+1 202 555 0100'\n      DMCA_AGENT_REGISTERED: 'true'\n      PAYMENT_REFUND_POLICY: Test fixture policy; not a production policy.\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 0\n      - uses: actions/setup-node@v7\n        with:\n          node-version: '22'\n          cache: npm\n      - run: npm ci\n      - run: npx playwright-core install --with-deps chromium\n      - name: Full desktop and mobile UX suite\n        run: |\n          export CHROMIUM_PATH=\"$(node --input-type=module -e 'import { chromium } from \"playwright-core\"; process.stdout.write(chromium.executablePath());')\"\n          npm run test:ux:browser\n",
          "baseline": ""
        }
      ]
    },
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
        "blob": "eb42b8db7d0c9b7f32f9a1297ec3c6aa84387ccd",
        "bytes": 7262,
        "sha256": "2f4a15f4c16ded5ef44791b26f60078d0c3172688a20c64796242bef229dc493"
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
          "current": "**1. The whole game is a JSON API, and agents are first-class players.** All 1415 routes\n",
          "baseline": "**1. The whole game is a JSON API, and agents are first-class players.** All 1401 routes\n"
        },
        {
          "at": 4306,
          "current": "> suggests the next move; a universal request tool reaches all 1415 routes (crimes, contracts,\n",
          "baseline": "> suggests the next move; a universal request tool reaches all 1401 routes (crimes, contracts,\n"
        }
      ]
    },
    "SPEC.md": {
      "current": {
        "mode": "100644",
        "blob": "0a1765593ed2d21fa798ef9a26d89ecfb12b3d28",
        "bytes": 57451,
        "sha256": "c4de8e57284e42fb05a5ddf4a085ca2280e756db22f9207e03f90cf2499bca94"
      },
      "baseline": {
        "mode": "100644",
        "blob": "eeaad0a71e1534b7f6fecb2269a7beca060509f0",
        "bytes": 57552,
        "sha256": "dd934511625c501a238575141ea27916ccb7718eb6dcfac28639d494bf3fa64a"
      },
      "inverses": [
        {
          "at": 124,
          "current": "The census below records dated source inventory snapshots. Availability and activation are documented separately in the deployment guides.\n",
          "baseline": "The census below records the combined release source inventory measured on 2026-11-07. Availability and activation are documented separately in the deployment guides.\n"
        },
        {
          "at": 291,
          "current": "File counts and backend/test line totals were measured from the combined merge source on 2026-11-16. Other line totals retain their recorded snapshots; no count identifies a deployed revision.\n",
          "baseline": "Counts were measured for the combined release source on 2026-11-07, before generated release records; they do not identify a deployed revision.\n"
        },
        {
          "at": 485,
          "current": "The combined inventory includes the required crime minigame, closed native garage interface, quest-quality additions and task puzzles. The route row retains the required-minigame snapshot pending the combined route check.\n",
          "baseline": "File counts include the combined playtest fixes, quest-quality additions and task puzzles. Backend and markdown inventory rows were refreshed on 2026-11-15 for the closed native garage interface and exact source-comparison proofs; the test row was refreshed on 2026-11-16 for the finite generated-artifact controls. Other rows retain their earlier dated snapshots.\n"
        },
        {
          "at": 724,
          "current": "| Backend modules | **624** files, **143061** lines (recursive source inventory) |\n| Test suites | **1057** files, **221795** lines (recursive source inventory; this row refreshed 2026-11-16) |\n| HTTP routes | **1415** registrations (**1415** unique; 1282 under `/v1`; measured 2026-11-16) |\n",
          "baseline": "| Backend modules | **623** files, **142959** lines (recursive source inventory) |\n| Test suites | **1053** files, **221139** lines (recursive source inventory; this row refreshed 2026-11-16) |\n| HTTP routes | **1401** registrations (**1401** unique; 1277 under `/v1`) |\n"
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
    "docs/quest-quality-workgraph.json": {
      "current": {
        "mode": "100644",
        "blob": "008136abede8ddec04b335e2114ed5b24b361777",
        "bytes": 965388,
        "sha256": "0292db8a98a168d43ff0f4fdeab1bda5929eaadae3264267ff41cde0bdb042d6"
      },
      "baseline": {
        "mode": "100644",
        "blob": "0450afd87dc3092591808f0f60108e8e7422697a",
        "bytes": 869196,
        "sha256": "8a251038354c0852e7046c4fffb883057726e9723459aa23295fe1c3238b5c5f"
      },
      "inverses": [
        {
          "at": 1993,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5bcjj-quest-quality-rules\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio543p-quest-quality-rules\"\n"
        },
        {
          "at": 2618,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5bd9k-quest-quality-studio\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio54tx-quest-quality-studio\"\n"
        },
        {
          "at": 3430,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5beig-quest-quality-runtime\",\n        \"quality-mwj5bij3-quest-quality-api\",\n        \"quality-mwj5bm5g-quest-quality-browser\",\n        \"quality-mwj5c6sl-quest-quality-postgres\",\n        \"quality-mwj5cgcs-quest-quality-stateful\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio56a9-quest-quality-runtime\",\n        \"quality-mwio5b0q-quest-quality-api\",\n        \"quality-mwio5f4i-quest-quality-browser\",\n        \"quality-mwio7bhm-quest-quality-postgres\",\n        \"quality-mwio5z0w-quest-quality-stateful\"\n"
        },
        {
          "at": 4482,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5bcjj-quest-quality-rules\",\n        \"quality-mwj5beig-quest-quality-runtime\",\n        \"quality-mwj5bij3-quest-quality-api\",\n        \"quality-mwj5bm5g-quest-quality-browser\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio543p-quest-quality-rules\",\n        \"quality-mwio56a9-quest-quality-runtime\",\n        \"quality-mwio5b0q-quest-quality-api\",\n        \"quality-mwio5f4i-quest-quality-browser\"\n"
        },
        {
          "at": 5299,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5beig-quest-quality-runtime\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio56a9-quest-quality-runtime\"\n"
        },
        {
          "at": 5973,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5bcjj-quest-quality-rules\",\n        \"quality-mwj5bd9k-quest-quality-studio\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio543p-quest-quality-rules\",\n        \"quality-mwio54tx-quest-quality-studio\"\n"
        },
        {
          "at": 6683,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5bcjj-quest-quality-rules\",\n        \"quality-mwj5bd9k-quest-quality-studio\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio543p-quest-quality-rules\",\n        \"quality-mwio54tx-quest-quality-studio\"\n"
        },
        {
          "at": 7380,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5bcjj-quest-quality-rules\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio543p-quest-quality-rules\"\n"
        },
        {
          "at": 8109,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5beig-quest-quality-runtime\",\n        \"quality-mwj5bm5g-quest-quality-browser\",\n        \"quality-mwj5cgcs-quest-quality-stateful\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio56a9-quest-quality-runtime\",\n        \"quality-mwio5f4i-quest-quality-browser\",\n        \"quality-mwio5z0w-quest-quality-stateful\"\n"
        },
        {
          "at": 8870,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5bcjj-quest-quality-rules\",\n        \"quality-mwj5bd9k-quest-quality-studio\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio543p-quest-quality-rules\",\n        \"quality-mwio54tx-quest-quality-studio\"\n"
        },
        {
          "at": 9557,
          "current": "        \"quality-mwj5b59g-quest-quality-content\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\"\n"
        },
        {
          "at": 10145,
          "current": "        \"quality-mwj5b59g-quest-quality-content\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\"\n"
        },
        {
          "at": 10836,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5bcjj-quest-quality-rules\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio543p-quest-quality-rules\"\n"
        },
        {
          "at": 11400,
          "current": "        \"quality-mwj5b59g-quest-quality-content\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\"\n"
        },
        {
          "at": 11987,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5bd9k-quest-quality-studio\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio54tx-quest-quality-studio\"\n"
        },
        {
          "at": 12708,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5bcjj-quest-quality-rules\",\n        \"quality-mwj5bd9k-quest-quality-studio\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio543p-quest-quality-rules\",\n        \"quality-mwio54tx-quest-quality-studio\"\n"
        },
        {
          "at": 13347,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5bd9k-quest-quality-studio\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio54tx-quest-quality-studio\"\n"
        },
        {
          "at": 13908,
          "current": "        \"quality-mwj5b59g-quest-quality-content\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\"\n"
        },
        {
          "at": 14415,
          "current": "        \"quality-mwj5b59g-quest-quality-content\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\"\n"
        },
        {
          "at": 14999,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5bd9k-quest-quality-studio\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio54tx-quest-quality-studio\"\n"
        },
        {
          "at": 15606,
          "current": "        \"quality-mwj5b59g-quest-quality-content\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\"\n"
        },
        {
          "at": 16116,
          "current": "        \"quality-mwj5b59g-quest-quality-content\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\"\n"
        },
        {
          "at": 16746,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5bcjj-quest-quality-rules\",\n        \"quality-mwj5bd9k-quest-quality-studio\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio543p-quest-quality-rules\",\n        \"quality-mwio54tx-quest-quality-studio\"\n"
        },
        {
          "at": 17362,
          "current": "        \"quality-mwj5b59g-quest-quality-content\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\"\n"
        },
        {
          "at": 18032,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5chfh-quest-quality-social\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio60ey-quest-quality-social\"\n"
        },
        {
          "at": 18591,
          "current": "        \"quality-mwj5b59g-quest-quality-content\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\"\n"
        },
        {
          "at": 19130,
          "current": "        \"quality-mwj5b59g-quest-quality-content\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\"\n"
        },
        {
          "at": 19895,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5bij3-quest-quality-api\",\n        \"quality-mwj5chfh-quest-quality-social\",\n        \"quality-mwj5bm5g-quest-quality-browser\",\n        \"quality-mwj5cgcs-quest-quality-stateful\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio5b0q-quest-quality-api\",\n        \"quality-mwio60ey-quest-quality-social\",\n        \"quality-mwio5f4i-quest-quality-browser\",\n        \"quality-mwio5z0w-quest-quality-stateful\"\n"
        },
        {
          "at": 20629,
          "current": "        \"quality-mwj5b59g-quest-quality-content\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\"\n"
        },
        {
          "at": 21122,
          "current": "        \"quality-mwj5b59g-quest-quality-content\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\"\n"
        },
        {
          "at": 21683,
          "current": "        \"quality-mwj5clhn-quest-quality-spoilers\",\n        \"quality-mwj5bm5g-quest-quality-browser\"\n",
          "baseline": "        \"quality-mwio65ko-quest-quality-spoilers\",\n        \"quality-mwio5f4i-quest-quality-browser\"\n"
        },
        {
          "at": 22442,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5beig-quest-quality-runtime\",\n        \"quality-mwj5bm5g-quest-quality-browser\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio56a9-quest-quality-runtime\",\n        \"quality-mwio5f4i-quest-quality-browser\"\n"
        },
        {
          "at": 23198,
          "current": "        \"quality-mwj5beig-quest-quality-runtime\",\n        \"quality-mwj5clhn-quest-quality-spoilers\",\n        \"quality-mwj5bm5g-quest-quality-browser\"\n",
          "baseline": "        \"quality-mwio56a9-quest-quality-runtime\",\n        \"quality-mwio65ko-quest-quality-spoilers\",\n        \"quality-mwio5f4i-quest-quality-browser\"\n"
        },
        {
          "at": 23883,
          "current": "        \"quality-mwj5beig-quest-quality-runtime\",\n        \"quality-mwj5bm5g-quest-quality-browser\"\n",
          "baseline": "        \"quality-mwio56a9-quest-quality-runtime\",\n        \"quality-mwio5f4i-quest-quality-browser\"\n"
        },
        {
          "at": 24609,
          "current": "        \"quality-mwj5beig-quest-quality-runtime\",\n        \"quality-mwj5bij3-quest-quality-api\",\n        \"quality-mwj5bm5g-quest-quality-browser\",\n        \"quality-mwj5cgcs-quest-quality-stateful\"\n",
          "baseline": "        \"quality-mwio56a9-quest-quality-runtime\",\n        \"quality-mwio5b0q-quest-quality-api\",\n        \"quality-mwio5f4i-quest-quality-browser\",\n        \"quality-mwio5z0w-quest-quality-stateful\"\n"
        },
        {
          "at": 25367,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5bcjj-quest-quality-rules\",\n        \"quality-mwj5bm5g-quest-quality-browser\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio543p-quest-quality-rules\",\n        \"quality-mwio5f4i-quest-quality-browser\"\n"
        },
        {
          "at": 26196,
          "current": "        \"quality-mwj5beig-quest-quality-runtime\",\n        \"quality-mwj5chfh-quest-quality-social\",\n        \"quality-mwj5bm5g-quest-quality-browser\",\n        \"quality-mwj5c6sl-quest-quality-postgres\",\n        \"quality-mwj5cgcs-quest-quality-stateful\"\n",
          "baseline": "        \"quality-mwio56a9-quest-quality-runtime\",\n        \"quality-mwio60ey-quest-quality-social\",\n        \"quality-mwio5f4i-quest-quality-browser\",\n        \"quality-mwio7bhm-quest-quality-postgres\",\n        \"quality-mwio5z0w-quest-quality-stateful\"\n"
        },
        {
          "at": 27300,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5bcjj-quest-quality-rules\",\n        \"quality-mwj5bij3-quest-quality-api\",\n        \"quality-mwj5chfh-quest-quality-social\",\n        \"quality-mwj5bm5g-quest-quality-browser\",\n        \"quality-mwj5c6sl-quest-quality-postgres\",\n        \"quality-mwj5cgcs-quest-quality-stateful\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio543p-quest-quality-rules\",\n        \"quality-mwio5b0q-quest-quality-api\",\n        \"quality-mwio60ey-quest-quality-social\",\n        \"quality-mwio5f4i-quest-quality-browser\",\n        \"quality-mwio7bhm-quest-quality-postgres\",\n        \"quality-mwio5z0w-quest-quality-stateful\"\n"
        },
        {
          "at": 28391,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5bcjj-quest-quality-rules\",\n        \"quality-mwj5chfh-quest-quality-social\",\n        \"quality-mwj5bm5g-quest-quality-browser\",\n        \"quality-mwj5c6sl-quest-quality-postgres\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio543p-quest-quality-rules\",\n        \"quality-mwio60ey-quest-quality-social\",\n        \"quality-mwio5f4i-quest-quality-browser\",\n        \"quality-mwio7bhm-quest-quality-postgres\"\n"
        },
        {
          "at": 29472,
          "current": "        \"quality-mwj5beig-quest-quality-runtime\",\n        \"quality-mwj5bij3-quest-quality-api\",\n        \"quality-mwj5chfh-quest-quality-social\",\n        \"quality-mwj5clhn-quest-quality-spoilers\",\n        \"quality-mwj5bm5g-quest-quality-browser\",\n        \"quality-mwj5c6sl-quest-quality-postgres\",\n        \"quality-mwj5cgcs-quest-quality-stateful\"\n",
          "baseline": "        \"quality-mwio56a9-quest-quality-runtime\",\n        \"quality-mwio5b0q-quest-quality-api\",\n        \"quality-mwio60ey-quest-quality-social\",\n        \"quality-mwio65ko-quest-quality-spoilers\",\n        \"quality-mwio5f4i-quest-quality-browser\",\n        \"quality-mwio7bhm-quest-quality-postgres\",\n        \"quality-mwio5z0w-quest-quality-stateful\"\n"
        },
        {
          "at": 30515,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5bcjj-quest-quality-rules\",\n        \"quality-mwj5bd9k-quest-quality-studio\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio543p-quest-quality-rules\",\n        \"quality-mwio54tx-quest-quality-studio\"\n"
        },
        {
          "at": 31199,
          "current": "        \"quality-mwj5bcjj-quest-quality-rules\",\n        \"quality-mwj5bd9k-quest-quality-studio\"\n",
          "baseline": "        \"quality-mwio543p-quest-quality-rules\",\n        \"quality-mwio54tx-quest-quality-studio\"\n"
        },
        {
          "at": 31759,
          "current": "        \"quality-mwj5bd9k-quest-quality-studio\"\n",
          "baseline": "        \"quality-mwio54tx-quest-quality-studio\"\n"
        },
        {
          "at": 32358,
          "current": "        \"quality-mwj5bcjj-quest-quality-rules\",\n        \"quality-mwj5bd9k-quest-quality-studio\"\n",
          "baseline": "        \"quality-mwio543p-quest-quality-rules\",\n        \"quality-mwio54tx-quest-quality-studio\"\n"
        },
        {
          "at": 32951,
          "current": "        \"quality-mwj5bd9k-quest-quality-studio\"\n",
          "baseline": "        \"quality-mwio54tx-quest-quality-studio\"\n"
        },
        {
          "at": 33788,
          "current": "        \"quality-mwj5beig-quest-quality-runtime\",\n        \"quality-mwj5bij3-quest-quality-api\",\n        \"quality-mwj5bm5g-quest-quality-browser\",\n        \"quality-mwj5cosz-quest-quality-study\",\n        \"quality-mwj5cgcs-quest-quality-stateful\"\n",
          "baseline": "        \"quality-mwio56a9-quest-quality-runtime\",\n        \"quality-mwio5b0q-quest-quality-api\",\n        \"quality-mwio5f4i-quest-quality-browser\",\n        \"quality-mwio69bj-quest-quality-study\",\n        \"quality-mwio5z0w-quest-quality-stateful\"\n"
        },
        {
          "at": 34642,
          "current": "        \"quality-mwj5b59g-quest-quality-content\",\n        \"quality-mwj5bd9k-quest-quality-studio\"\n",
          "baseline": "        \"quality-mwio4w9o-quest-quality-content\",\n        \"quality-mwio54tx-quest-quality-studio\"\n"
        },
        {
          "at": 35345,
          "current": "        \"quality-mwj5bcjj-quest-quality-rules\",\n        \"quality-mwj5clhn-quest-quality-spoilers\",\n        \"quality-mwj5bd9k-quest-quality-studio\"\n",
          "baseline": "        \"quality-mwio543p-quest-quality-rules\",\n        \"quality-mwio65ko-quest-quality-spoilers\",\n        \"quality-mwio54tx-quest-quality-studio\"\n"
        },
        {
          "at": 36065,
          "current": "        \"quality-mwj5bcjj-quest-quality-rules\",\n        \"quality-mwj5bd9k-quest-quality-studio\"\n",
          "baseline": "        \"quality-mwio543p-quest-quality-rules\",\n        \"quality-mwio54tx-quest-quality-studio\"\n"
        },
        {
          "at": 36973,
          "current": "        \"quality-mwj5beig-quest-quality-runtime\",\n        \"quality-mwj5bij3-quest-quality-api\",\n        \"quality-mwj5bm5g-quest-quality-browser\",\n        \"quality-mwj5cosz-quest-quality-study\",\n        \"quality-mwj5cgcs-quest-quality-stateful\"\n",
          "baseline": "        \"quality-mwio56a9-quest-quality-runtime\",\n        \"quality-mwio5b0q-quest-quality-api\",\n        \"quality-mwio5f4i-quest-quality-browser\",\n        \"quality-mwio69bj-quest-quality-study\",\n        \"quality-mwio5z0w-quest-quality-stateful\"\n"
        },
        {
          "at": 819007,
          "current": "      \"id\": \"quality-mwii10x4-quest-quality-content\",\n",
          "baseline": "      \"id\": \"quality-mwio4w9o-quest-quality-content\",\n"
        },
        {
          "at": 820504,
          "current": "        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n",
          "baseline": "        \"package.json\": \"7cdd3916fb45488293efdc1a92e9634bb7157809c11ca50a34460acc650ef629\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n"
        },
        {
          "at": 821005,
          "current": "        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n",
          "baseline": "        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n"
        },
        {
          "at": 822054,
          "current": "        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n",
          "baseline": "        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n"
        },
        {
          "at": 822937,
          "current": "      \"startedAt\": \"2026-11-16T00:01:56.968Z\",\n      \"elapsedMs\": 9897,\n",
          "baseline": "      \"startedAt\": \"2026-11-16T02:52:55.260Z\",\n      \"elapsedMs\": 9256,\n"
        },
        {
          "at": 823030,
          "current": "      \"log\": \"output/quest-quality-verification/quality-mwii10x4-quest-quality-content.log\",\n",
          "baseline": "      \"log\": \"output/quest-quality-verification/quality-mwio4w9o-quest-quality-content.log\",\n"
        },
        {
          "at": 823191,
          "current": "      \"id\": \"quality-mwii19ji-quest-quality-rules\",\n",
          "baseline": "      \"id\": \"quality-mwio543p-quest-quality-rules\",\n"
        },
        {
          "at": 824684,
          "current": "        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n",
          "baseline": "        \"package.json\": \"7cdd3916fb45488293efdc1a92e9634bb7157809c11ca50a34460acc650ef629\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n"
        },
        {
          "at": 825185,
          "current": "        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n",
          "baseline": "        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n"
        },
        {
          "at": 826234,
          "current": "        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n",
          "baseline": "        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n"
        },
        {
          "at": 827117,
          "current": "      \"startedAt\": \"2026-11-16T00:02:08.142Z\",\n      \"elapsedMs\": 157,\n",
          "baseline": "      \"startedAt\": \"2026-11-16T02:53:05.413Z\",\n      \"elapsedMs\": 147,\n"
        },
        {
          "at": 827209,
          "current": "      \"log\": \"output/quest-quality-verification/quality-mwii19ji-quest-quality-rules.log\",\n",
          "baseline": "      \"log\": \"output/quest-quality-verification/quality-mwio543p-quest-quality-rules.log\",\n"
        },
        {
          "at": 827368,
          "current": "      \"id\": \"quality-mwii1agt-quest-quality-studio\",\n",
          "baseline": "      \"id\": \"quality-mwio54tx-quest-quality-studio\",\n"
        },
        {
          "at": 828863,
          "current": "        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n",
          "baseline": "        \"package.json\": \"7cdd3916fb45488293efdc1a92e9634bb7157809c11ca50a34460acc650ef629\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n"
        },
        {
          "at": 829364,
          "current": "        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n",
          "baseline": "        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n"
        },
        {
          "at": 830413,
          "current": "        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n",
          "baseline": "        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n"
        },
        {
          "at": 831296,
          "current": "      \"startedAt\": \"2026-11-16T00:02:09.341Z\",\n      \"elapsedMs\": 1290,\n",
          "baseline": "      \"startedAt\": \"2026-11-16T02:53:06.357Z\",\n      \"elapsedMs\": 1312,\n"
        },
        {
          "at": 831389,
          "current": "      \"log\": \"output/quest-quality-verification/quality-mwii1agt-quest-quality-studio.log\",\n",
          "baseline": "      \"log\": \"output/quest-quality-verification/quality-mwio54tx-quest-quality-studio.log\",\n"
        },
        {
          "at": 831549,
          "current": "      \"id\": \"quality-mwii1c3t-quest-quality-runtime\",\n",
          "baseline": "      \"id\": \"quality-mwio56a9-quest-quality-runtime\",\n"
        },
        {
          "at": 833046,
          "current": "        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n",
          "baseline": "        \"package.json\": \"7cdd3916fb45488293efdc1a92e9634bb7157809c11ca50a34460acc650ef629\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n"
        },
        {
          "at": 833547,
          "current": "        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n",
          "baseline": "        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n"
        },
        {
          "at": 834596,
          "current": "        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n",
          "baseline": "        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n"
        },
        {
          "at": 835479,
          "current": "      \"startedAt\": \"2026-11-16T00:02:11.465Z\",\n      \"elapsedMs\": 6024,\n",
          "baseline": "      \"startedAt\": \"2026-11-16T02:53:08.241Z\",\n      \"elapsedMs\": 5667,\n"
        },
        {
          "at": 835572,
          "current": "      \"log\": \"output/quest-quality-verification/quality-mwii1c3t-quest-quality-runtime.log\",\n",
          "baseline": "      \"log\": \"output/quest-quality-verification/quality-mwio56a9-quest-quality-runtime.log\",\n"
        },
        {
          "at": 835733,
          "current": "      \"id\": \"quality-mwii1h7m-quest-quality-api\",\n",
          "baseline": "      \"id\": \"quality-mwio5b0q-quest-quality-api\",\n"
        },
        {
          "at": 837222,
          "current": "        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n",
          "baseline": "        \"package.json\": \"7cdd3916fb45488293efdc1a92e9634bb7157809c11ca50a34460acc650ef629\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n"
        },
        {
          "at": 837723,
          "current": "        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n",
          "baseline": "        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n"
        },
        {
          "at": 838772,
          "current": "        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n",
          "baseline": "        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n"
        },
        {
          "at": 839655,
          "current": "      \"startedAt\": \"2026-11-16T00:02:18.082Z\",\n      \"elapsedMs\": 5092,\n",
          "baseline": "      \"startedAt\": \"2026-11-16T02:53:14.378Z\",\n      \"elapsedMs\": 4949,\n"
        },
        {
          "at": 839748,
          "current": "      \"log\": \"output/quest-quality-verification/quality-mwii1h7m-quest-quality-api.log\",\n",
          "baseline": "      \"log\": \"output/quest-quality-verification/quality-mwio5b0q-quest-quality-api.log\",\n"
        },
        {
          "at": 839905,
          "current": "      \"id\": \"quality-mwii1lpp-quest-quality-browser\",\n",
          "baseline": "      \"id\": \"quality-mwio5f4i-quest-quality-browser\",\n"
        },
        {
          "at": 841402,
          "current": "        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n",
          "baseline": "        \"package.json\": \"7cdd3916fb45488293efdc1a92e9634bb7157809c11ca50a34460acc650ef629\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n"
        },
        {
          "at": 841903,
          "current": "        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n",
          "baseline": "        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n"
        },
        {
          "at": 842952,
          "current": "        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n",
          "baseline": "        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n"
        },
        {
          "at": 843835,
          "current": "      \"startedAt\": \"2026-11-16T00:02:23.917Z\",\n      \"elapsedMs\": 30912,\n",
          "baseline": "      \"startedAt\": \"2026-11-16T02:53:19.698Z\",\n      \"elapsedMs\": 23567,\n"
        },
        {
          "at": 843929,
          "current": "      \"log\": \"output/quest-quality-verification/quality-mwii1lpp-quest-quality-browser.log\",\n",
          "baseline": "      \"log\": \"output/quest-quality-verification/quality-mwio5f4i-quest-quality-browser.log\",\n"
        },
        {
          "at": 844090,
          "current": "      \"id\": \"quality-mwii29xy-quest-quality-postgres\",\n",
          "baseline": "      \"id\": \"quality-mwio5xjr-quest-quality-postgres\",\n"
        },
        {
          "at": 845589,
          "current": "        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n",
          "baseline": "        \"package.json\": \"7cdd3916fb45488293efdc1a92e9634bb7157809c11ca50a34460acc650ef629\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n"
        },
        {
          "at": 846090,
          "current": "        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n",
          "baseline": "        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n"
        },
        {
          "at": 847139,
          "current": "        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n",
          "baseline": "        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n"
        },
        {
          "at": 848022,
          "current": "      \"startedAt\": \"2026-11-16T00:02:55.318Z\",\n      \"elapsedMs\": 11067,\n",
          "baseline": "      \"startedAt\": \"2026-11-16T02:53:43.575Z\",\n      \"elapsedMs\": 1607,\n"
        },
        {
          "at": 848116,
          "current": "      \"log\": \"output/quest-quality-verification/quality-mwii29xy-quest-quality-postgres.log\",\n",
          "baseline": "      \"log\": \"output/quest-quality-verification/quality-mwio5xjr-quest-quality-postgres.log\",\n"
        },
        {
          "at": 848278,
          "current": "      \"id\": \"quality-mwii2iui-quest-quality-stateful\",\n",
          "baseline": "      \"id\": \"quality-mwio5z0w-quest-quality-stateful\",\n"
        },
        {
          "at": 849777,
          "current": "        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n",
          "baseline": "        \"package.json\": \"7cdd3916fb45488293efdc1a92e9634bb7157809c11ca50a34460acc650ef629\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n"
        },
        {
          "at": 850278,
          "current": "        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n",
          "baseline": "        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n"
        },
        {
          "at": 851327,
          "current": "        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n",
          "baseline": "        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n"
        },
        {
          "at": 852210,
          "current": "      \"startedAt\": \"2026-11-16T00:03:06.858Z\",\n      \"elapsedMs\": 2338,\n",
          "baseline": "      \"startedAt\": \"2026-11-16T02:53:45.488Z\",\n      \"elapsedMs\": 1558,\n"
        },
        {
          "at": 852303,
          "current": "      \"log\": \"output/quest-quality-verification/quality-mwii2iui-quest-quality-stateful.log\",\n",
          "baseline": "      \"log\": \"output/quest-quality-verification/quality-mwio5z0w-quest-quality-stateful.log\",\n"
        },
        {
          "at": 852465,
          "current": "      \"id\": \"quality-mwii2kwt-quest-quality-social\",\n",
          "baseline": "      \"id\": \"quality-mwio60ey-quest-quality-social\",\n"
        },
        {
          "at": 852660,
          "current": "      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T00:03:09.533Z\",\n      \"elapsedMs\": 8350,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwii2kwt-quest-quality-social.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwii2rk1-quest-quality-spoilers\",\n      \"evaluator\": \"test/quest-quality-spoilers.js\",\n      \"evaluatorHash\": \"55fc0fc6512934fccfdf3628b5f178b95fe27722753aba704b1acc515d8876e4\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T00:03:18.145Z\",\n      \"elapsedMs\": 6884,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwii2rk1-quest-quality-spoilers.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwii2x0y-quest-quality-study\",\n      \"evaluator\": \"test/quest-quality-study.js\",\n      \"evaluatorHash\": \"6043fb8143c39ce3b1d418265670565faae908006e07d7760c0cef5f2c5a896b\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T00:03:25.234Z\",\n      \"elapsedMs\": 284,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwii2x0y-quest-quality-study.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwii3zu5-quest-quality-postgres\",\n      \"evaluator\": \"test/quest-quality-postgres.js\",\n      \"evaluatorHash\": \"f8b535feb91fc5ad23b2b61c56432eca948c5c3eb4e9a5b6962eea9abd905e7a\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T00:04:15.533Z\",\n      \"elapsedMs\": 21860,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwii3zu5-quest-quality-postgres.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwio4w9o-quest-quality-content\",\n      \"evaluator\": \"test/quest-quality-content.js\",\n      \"evaluatorHash\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n",
          "baseline": ""
        },
        {
          "at": 873128,
          "current": "      \"startedAt\": \"2026-11-16T02:52:55.260Z\",\n      \"elapsedMs\": 9256,\n",
          "baseline": "      \"startedAt\": \"2026-11-16T02:53:47.290Z\",\n      \"elapsedMs\": 6510,\n"
        },
        {
          "at": 873221,
          "current": "      \"log\": \"output/quest-quality-verification/quality-mwio4w9o-quest-quality-content.log\",\n",
          "baseline": "      \"log\": \"output/quest-quality-verification/quality-mwio60ey-quest-quality-social.log\",\n"
        },
        {
          "at": 873382,
          "current": "      \"id\": \"quality-mwio543p-quest-quality-rules\",\n      \"evaluator\": \"test/quest-quality-rules.js\",\n      \"evaluatorHash\": \"a826d549449bfff306a42553d5c218412d0b903d7acc0756791787cb19211b08\",\n",
          "baseline": "      \"id\": \"quality-mwio65ko-quest-quality-spoilers\",\n      \"evaluator\": \"test/quest-quality-spoilers.js\",\n      \"evaluatorHash\": \"55fc0fc6512934fccfdf3628b5f178b95fe27722753aba704b1acc515d8876e4\",\n"
        },
        {
          "at": 877308,
          "current": "      \"startedAt\": \"2026-11-16T02:53:05.413Z\",\n      \"elapsedMs\": 147,\n",
          "baseline": "      \"startedAt\": \"2026-11-16T02:53:53.976Z\",\n      \"elapsedMs\": 4707,\n"
        },
        {
          "at": 877400,
          "current": "      \"log\": \"output/quest-quality-verification/quality-mwio543p-quest-quality-rules.log\",\n",
          "baseline": "      \"log\": \"output/quest-quality-verification/quality-mwio65ko-quest-quality-spoilers.log\",\n"
        },
        {
          "at": 877559,
          "current": "      \"id\": \"quality-mwio54tx-quest-quality-studio\",\n      \"evaluator\": \"test/quest-quality-studio.js\",\n      \"evaluatorHash\": \"7312af34a011503deb2cd3a36ea4f9b667ddc9cc57c6de7e2ef384121ff944f6\",\n",
          "baseline": "      \"id\": \"quality-mwio69bj-quest-quality-study\",\n      \"evaluator\": \"test/quest-quality-study.js\",\n      \"evaluatorHash\": \"6043fb8143c39ce3b1d418265670565faae908006e07d7760c0cef5f2c5a896b\",\n"
        },
        {
          "at": 881487,
          "current": "      \"startedAt\": \"2026-11-16T02:53:06.357Z\",\n      \"elapsedMs\": 1312,\n",
          "baseline": "      \"startedAt\": \"2026-11-16T02:53:58.831Z\",\n      \"elapsedMs\": 222,\n"
        },
        {
          "at": 881580,
          "current": "      \"log\": \"output/quest-quality-verification/quality-mwio54tx-quest-quality-studio.log\",\n",
          "baseline": "      \"log\": \"output/quest-quality-verification/quality-mwio69bj-quest-quality-study.log\",\n"
        },
        {
          "at": 881740,
          "current": "      \"id\": \"quality-mwio56a9-quest-quality-runtime\",\n      \"evaluator\": \"test/quest-quality-runtime.js\",\n      \"evaluatorHash\": \"3f227f0b0b8158b97d6e1790fcab5f5cdb788320446bcf0ecc378513a903e6a6\",\n",
          "baseline": "      \"id\": \"quality-mwio7bhm-quest-quality-postgres\",\n      \"evaluator\": \"test/quest-quality-postgres.js\",\n      \"evaluatorHash\": \"f8b535feb91fc5ad23b2b61c56432eca948c5c3eb4e9a5b6962eea9abd905e7a\",\n"
        },
        {
          "at": 885670,
          "current": "      \"startedAt\": \"2026-11-16T02:53:08.241Z\",\n      \"elapsedMs\": 5667,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwio56a9-quest-quality-runtime.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwio5b0q-quest-quality-api\",\n      \"evaluator\": \"test/quest-quality-api.js\",\n      \"evaluatorHash\": \"eb06739d7e08a8124b9a91371de7ea2b314339dd20f5a3451138efc08441bd8e\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"7cdd3916fb45488293efdc1a92e9634bb7157809c11ca50a34460acc650ef629\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T02:53:14.378Z\",\n      \"elapsedMs\": 4949,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwio5b0q-quest-quality-api.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwio5f4i-quest-quality-browser\",\n      \"evaluator\": \"test/quest-quality-browser.js\",\n      \"evaluatorHash\": \"0c51ee92b5ed3e722813498a7f5657fcb6fc4fffb2cabadc2f122035c78184f7\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"7cdd3916fb45488293efdc1a92e9634bb7157809c11ca50a34460acc650ef629\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T02:53:19.698Z\",\n      \"elapsedMs\": 23567,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwio5f4i-quest-quality-browser.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwio5xjr-quest-quality-postgres\",\n      \"evaluator\": \"test/quest-quality-postgres.js\",\n      \"evaluatorHash\": \"f8b535feb91fc5ad23b2b61c56432eca948c5c3eb4e9a5b6962eea9abd905e7a\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"7cdd3916fb45488293efdc1a92e9634bb7157809c11ca50a34460acc650ef629\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T02:53:43.575Z\",\n      \"elapsedMs\": 1607,\n      \"exitCode\": 1,\n      \"log\": \"output/quest-quality-verification/quality-mwio5xjr-quest-quality-postgres.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwio5z0w-quest-quality-stateful\",\n      \"evaluator\": \"test/quest-quality-stateful.js\",\n      \"evaluatorHash\": \"25b514da3ba7440638639362b814c4145ade0f5050b0297a4c6b39d3bc3e51df\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"7cdd3916fb45488293efdc1a92e9634bb7157809c11ca50a34460acc650ef629\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T02:53:45.488Z\",\n      \"elapsedMs\": 1558,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwio5z0w-quest-quality-stateful.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwio60ey-quest-quality-social\",\n      \"evaluator\": \"test/quest-quality-social.js\",\n      \"evaluatorHash\": \"a4dfce14e220a79d78651ea113c33efbfb4361906882ab2ffe20079c730964a6\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"7cdd3916fb45488293efdc1a92e9634bb7157809c11ca50a34460acc650ef629\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T02:53:47.290Z\",\n      \"elapsedMs\": 6510,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwio60ey-quest-quality-social.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwio65ko-quest-quality-spoilers\",\n      \"evaluator\": \"test/quest-quality-spoilers.js\",\n      \"evaluatorHash\": \"55fc0fc6512934fccfdf3628b5f178b95fe27722753aba704b1acc515d8876e4\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"7cdd3916fb45488293efdc1a92e9634bb7157809c11ca50a34460acc650ef629\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T02:53:53.976Z\",\n      \"elapsedMs\": 4707,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwio65ko-quest-quality-spoilers.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwio69bj-quest-quality-study\",\n      \"evaluator\": \"test/quest-quality-study.js\",\n      \"evaluatorHash\": \"6043fb8143c39ce3b1d418265670565faae908006e07d7760c0cef5f2c5a896b\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"7cdd3916fb45488293efdc1a92e9634bb7157809c11ca50a34460acc650ef629\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T02:53:58.831Z\",\n      \"elapsedMs\": 222,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwio69bj-quest-quality-study.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwio7bhm-quest-quality-postgres\",\n      \"evaluator\": \"test/quest-quality-postgres.js\",\n      \"evaluatorHash\": \"f8b535feb91fc5ad23b2b61c56432eca948c5c3eb4e9a5b6962eea9abd905e7a\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"7cdd3916fb45488293efdc1a92e9634bb7157809c11ca50a34460acc650ef629\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T02:54:48.298Z\",\n",
          "baseline": "      \"startedAt\": \"2026-11-16T02:54:48.298Z\",\n"
        },
        {
          "at": 919226,
          "current": "      \"log\": \"output/quest-quality-verification/quality-mwio7bhm-quest-quality-postgres.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwj5b59g-quest-quality-content\",\n      \"evaluator\": \"test/quest-quality-content.js\",\n      \"evaluatorHash\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T10:53:40.324Z\",\n      \"elapsedMs\": 8294,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwj5b59g-quest-quality-content.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwj5bcjj-quest-quality-rules\",\n      \"evaluator\": \"test/quest-quality-rules.js\",\n      \"evaluatorHash\": \"a826d549449bfff306a42553d5c218412d0b903d7acc0756791787cb19211b08\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T10:53:49.759Z\",\n      \"elapsedMs\": 117,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwj5bcjj-quest-quality-rules.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwj5bd9k-quest-quality-studio\",\n      \"evaluator\": \"test/quest-quality-studio.js\",\n      \"evaluatorHash\": \"7312af34a011503deb2cd3a36ea4f9b667ddc9cc57c6de7e2ef384121ff944f6\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T10:53:50.696Z\",\n      \"elapsedMs\": 901,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwj5bd9k-quest-quality-studio.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwj5beig-quest-quality-runtime\",\n      \"evaluator\": \"test/quest-quality-runtime.js\",\n      \"evaluatorHash\": \"3f227f0b0b8158b97d6e1790fcab5f5cdb788320446bcf0ecc378513a903e6a6\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T10:53:52.312Z\",\n      \"elapsedMs\": 4574,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwj5beig-quest-quality-runtime.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwj5bij3-quest-quality-api\",\n      \"evaluator\": \"test/quest-quality-api.js\",\n      \"evaluatorHash\": \"eb06739d7e08a8124b9a91371de7ea2b314339dd20f5a3451138efc08441bd8e\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T10:53:57.519Z\",\n      \"elapsedMs\": 4108,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwj5bij3-quest-quality-api.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwj5bm5g-quest-quality-browser\",\n      \"evaluator\": \"test/quest-quality-browser.js\",\n      \"evaluatorHash\": \"0c51ee92b5ed3e722813498a7f5657fcb6fc4fffb2cabadc2f122035c78184f7\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T10:54:02.212Z\",\n      \"elapsedMs\": 26297,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwj5bm5g-quest-quality-browser.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwj5c6sl-quest-quality-postgres\",\n      \"evaluator\": \"test/quest-quality-postgres.js\",\n      \"evaluatorHash\": \"f8b535feb91fc5ad23b2b61c56432eca948c5c3eb4e9a5b6962eea9abd905e7a\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T10:54:28.965Z\",\n      \"elapsedMs\": 11701,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwj5c6sl-quest-quality-postgres.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwj5cgcs-quest-quality-stateful\",\n      \"evaluator\": \"test/quest-quality-stateful.js\",\n      \"evaluatorHash\": \"25b514da3ba7440638639362b814c4145ade0f5050b0297a4c6b39d3bc3e51df\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T10:54:41.356Z\",\n      \"elapsedMs\": 992,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwj5cgcs-quest-quality-stateful.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwj5chfh-quest-quality-social\",\n      \"evaluator\": \"test/quest-quality-social.js\",\n      \"evaluatorHash\": \"a4dfce14e220a79d78651ea113c33efbfb4361906882ab2ffe20079c730964a6\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T10:54:42.749Z\",\n      \"elapsedMs\": 4908,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwj5chfh-quest-quality-social.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwj5clhn-quest-quality-spoilers\",\n      \"evaluator\": \"test/quest-quality-spoilers.js\",\n      \"evaluatorHash\": \"55fc0fc6512934fccfdf3628b5f178b95fe27722753aba704b1acc515d8876e4\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T10:54:48.011Z\",\n      \"elapsedMs\": 3964,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwj5clhn-quest-quality-spoilers.log\",\n      \"evidenceType\": \"automated_implementation_check\"\n    },\n    {\n      \"id\": \"quality-mwj5cosz-quest-quality-study\",\n      \"evaluator\": \"test/quest-quality-study.js\",\n      \"evaluatorHash\": \"6043fb8143c39ce3b1d418265670565faae908006e07d7760c0cef5f2c5a896b\",\n      \"sourceHashes\": {\n        \"content/packs/quest-quality-favors/pack.json\": \"c827712dddc0470741b9c84d764ac95dbe22223767b36e501ab11a207cf80c71\",\n        \"content/packs/quest-quality-field-notes/pack.json\": \"c4b34bcaa557f6cf47b2cb6fd0256665256fa5aa71f89beaa36951f155763e5a\",\n        \"content/packs/quest-quality-last-ferry/pack.json\": \"ca48e286aa7e47bbb2552fb3e7bbb503026796006fba310d9fc67857e702b881\",\n        \"content/packs/quest-quality-night-edition/pack.json\": \"1d99b3a7369260b7e0303681628ed588b4e9f8faf654df722950b0526233c1c1\",\n        \"content/packs/quest-quality-open-office/pack.json\": \"97121605779dd3060510833f035b66a8cecec6b3c46be9f681edd3844b5506ff\",\n        \"content/packs/quest-quality-payday/pack.json\": \"855e6fd2f74784ed9f02ccb5a62ed13b3cb381e5d199c66b12ffdf668d7055ed\",\n        \"content/packs/quest-quality-shared-meaning/pack.json\": \"cfdc64e1ed5bce634eb10db8dbd5db95af35b016c89a13128e882ba2f9c1e072\",\n        \"content/packs/quest-quality-small-fire/pack.json\": \"64d240fe1aa97e6868a0190eac3130716eae8607c9b3881719b46a32d9b800d7\",\n        \"content/packs/quest-quality-truce/pack.json\": \"2bf1e67fe40d07e70bf2e51181fd870da979340a65d8ecb2e6f9a246d6bbfc08\",\n        \"content/packs/quest-three-witnesses-v2/pack.json\": \"294a307015a074ebd6340b1acd346fc798bcdc02ba13792506f077cc0f2c2423\",\n        \"package.json\": \"9e9b084efac7c9a0a24a839aceed84b23c1272ece8c93272a58642af93bbc454\",\n        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n        \"public/ux-quest-quality.css\": \"8b695b3d42e9f43586b0f82c0fcf713168c5e61834facc758ec6fff2f80e941f\",\n        \"public/ux-quest-quality.js\": \"e34b8b84be83f0c1d2af9149cba227225a830f371ee9e11f95b6b4f3c05c58f2\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quality-runtime.js\": \"609bab529eae343b33a2873a9da34668d63c3ee2f91bbcca77f85bcdb43e5d4e\",\n        \"src/content/quality.js\": \"94a0a31a4df250d4ed1d69a35f212414aaa1fe4603bee86e6b584d332ecd08a4\",\n        \"src/content/quest-quality-packs.js\": \"fcdbbd2a6269b445c8a4ded1624cd91482b5d454371e3b3a169ca1babcb0bae9\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/quest-quality-contracts.js\": \"b611d8dd4f174b8f5bb08ecf91a14d1c3833099052c518059d7a631dd3415395\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n        \"test/lib/quest-quality-fixture.js\": \"316f3bf09ce3788fc6997f7dc766af3b1cd057b058143f315106a37053c6a50b\",\n        \"test/quest-quality-content.js\": \"0ea2d6179a005d153c0e1c8f1c813c750c9525aa51fe9befefe14e48959dc266\",\n        \"tools/quest-quality-studio.js\": \"997b7cc34cec5c18875f3166b013c14f595a24549e79a9a57552a035a602aa52\",\n        \"tools/quest-quality-study.js\": \"856b8459dc9f38ca6ea7a131374897ea5c9b4d25922535515b5dc5822c17ce01\",\n        \"tools/quest-quality-workgraph.js\": \"c1228a648475f7caef08b98cc16488d5979a8a4db0666250feaac573c6bffd11\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\"\n      },\n      \"sourceStable\": true,\n      \"startedAt\": \"2026-11-16T10:54:52.307Z\",\n      \"elapsedMs\": 192,\n      \"exitCode\": 0,\n      \"log\": \"output/quest-quality-verification/quality-mwj5cosz-quest-quality-study.log\",\n",
          "baseline": "      \"log\": \"output/quest-quality-verification/quality-mwio7bhm-quest-quality-postgres.log\",\n"
        }
      ]
    },
    "docs/questing-workgraph.json": {
      "current": {
        "mode": "100644",
        "blob": "e8261e7359e1b1553db17cb880c704997af34347",
        "bytes": 1872814,
        "sha256": "b7434bda1f0a8a33dd8d431e67bce575f0688010a427811f28d0e1ffe520f63a"
      },
      "baseline": {
        "mode": "100644",
        "blob": "412c4ef9da38443ced0031b99617f4bfc19c9f8e",
        "bytes": 1763017,
        "sha256": "a96e1918dcd16bb49b3e534a2898ae8a48e67c23c04770ed5aad9b70115523a0"
      },
      "inverses": [
        {
          "at": 1085,
          "current": "        \"quest-mwj58ul7-quest-saga\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\"\n"
        },
        {
          "at": 1903,
          "current": "        \"quest-mwj58ul7-quest-saga\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\"\n"
        },
        {
          "at": 2683,
          "current": "        \"quest-mwj58ul7-quest-saga\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\"\n"
        },
        {
          "at": 3491,
          "current": "        \"quest-mwj58ul7-quest-saga\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\"\n"
        },
        {
          "at": 4275,
          "current": "        \"quest-mwj58ul7-quest-saga\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\"\n"
        },
        {
          "at": 5078,
          "current": "        \"quest-mwj58ul7-quest-saga\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\"\n"
        },
        {
          "at": 5899,
          "current": "        \"quest-mwj58ul7-quest-saga\",\n        \"quest-mwj59c71-content-narrative-security\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\",\n        \"quest-mwio0oxq-content-narrative-security\"\n"
        },
        {
          "at": 6734,
          "current": "        \"quest-mwj58ul7-quest-saga\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\"\n"
        },
        {
          "at": 7503,
          "current": "        \"quest-mwj58ul7-quest-saga\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\"\n"
        },
        {
          "at": 8288,
          "current": "        \"quest-mwj58ul7-quest-saga\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\"\n"
        },
        {
          "at": 9049,
          "current": "        \"quest-mwj58ul7-quest-saga\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\"\n"
        },
        {
          "at": 9871,
          "current": "        \"quest-mwj58ul7-quest-saga\",\n        \"quest-mwj59c71-content-narrative-security\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\",\n        \"quest-mwio0oxq-content-narrative-security\"\n"
        },
        {
          "at": 10699,
          "current": "        \"quest-mwj58ul7-quest-saga\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\"\n"
        },
        {
          "at": 11481,
          "current": "        \"quest-mwj58ul7-quest-saga\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\"\n"
        },
        {
          "at": 12279,
          "current": "        \"quest-mwj59e2m-quest-specialist\"\n",
          "baseline": "        \"quest-mwio0r1g-quest-specialist\"\n"
        },
        {
          "at": 13073,
          "current": "        \"quest-mwj58ul7-quest-saga\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\"\n"
        },
        {
          "at": 13859,
          "current": "        \"quest-mwj58ul7-quest-saga\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\"\n"
        },
        {
          "at": 14568,
          "current": "        \"quest-mwj59qnd-clue-puzzles\",\n        \"quest-mwj59vzo-clue-puzzles-browser\"\n",
          "baseline": "        \"quest-mwio0zat-clue-puzzles\",\n        \"quest-mwio15gv-clue-puzzles-browser\"\n"
        },
        {
          "at": 15394,
          "current": "        \"quest-mwj58ul7-quest-saga\",\n        \"quest-mwj5a7tt-content-narrative\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\",\n        \"quest-mwio1e4y-content-narrative\"\n"
        },
        {
          "at": 16280,
          "current": "        \"quest-mwj58ul7-quest-saga\",\n        \"quest-mwj5a7tt-content-narrative\",\n        \"quest-mwj59c71-content-narrative-security\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\",\n        \"quest-mwio1e4y-content-narrative\",\n        \"quest-mwio0oxq-content-narrative-security\"\n"
        },
        {
          "at": 17218,
          "current": "        \"quest-mwj58ul7-quest-saga\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\"\n"
        },
        {
          "at": 18069,
          "current": "        \"quest-mwj58ul7-quest-saga\",\n        \"quest-mwj5ac01-quest-experience-browser\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\",\n        \"quest-mwio1jak-quest-experience-browser\"\n"
        },
        {
          "at": 18910,
          "current": "        \"quest-mwj58ul7-quest-saga\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\"\n"
        },
        {
          "at": 19750,
          "current": "        \"quest-mwj58ul7-quest-saga\",\n        \"quest-mwj5a7tt-content-narrative\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\",\n        \"quest-mwio1e4y-content-narrative\"\n"
        },
        {
          "at": 20664,
          "current": "        \"quest-mwj58ul7-quest-saga\",\n        \"quest-mwj5ac01-quest-experience-browser\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\",\n        \"quest-mwio1jak-quest-experience-browser\"\n"
        },
        {
          "at": 21476,
          "current": "        \"quest-mwj58ul7-quest-saga\",\n        \"quest-mwj5ac01-quest-experience-browser\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\",\n        \"quest-mwio1jak-quest-experience-browser\"\n"
        },
        {
          "at": 22391,
          "current": "        \"quest-mwj58ul7-quest-saga\",\n        \"quest-mwj5a7tt-content-narrative\",\n        \"quest-mwj59c71-content-narrative-security\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\",\n        \"quest-mwio1e4y-content-narrative\",\n        \"quest-mwio0oxq-content-narrative-security\"\n"
        },
        {
          "at": 23211,
          "current": "        \"quest-mwj58ul7-quest-saga\",\n        \"quest-mwj5ac01-quest-experience-browser\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\",\n        \"quest-mwio1jak-quest-experience-browser\"\n"
        },
        {
          "at": 24004,
          "current": "        \"quest-mwj5a7tt-content-narrative\",\n        \"quest-mwj5ac01-quest-experience-browser\"\n",
          "baseline": "        \"quest-mwio1e4y-content-narrative\",\n        \"quest-mwio1jak-quest-experience-browser\"\n"
        },
        {
          "at": 24805,
          "current": "        \"quest-mwj58ul7-quest-saga\",\n        \"quest-mwj5ac01-quest-experience-browser\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\",\n        \"quest-mwio1jak-quest-experience-browser\"\n"
        },
        {
          "at": 25588,
          "current": "        \"quest-mwj5ascx-content-api\",\n        \"quest-mwj5ac01-quest-experience-browser\"\n",
          "baseline": "        \"quest-mwio20ph-content-api\",\n        \"quest-mwio1jak-quest-experience-browser\"\n"
        },
        {
          "at": 26548,
          "current": "        \"quest-mwj5aty9-quest-saga-social\",\n        \"quest-mwj5ayf2-content-casework\",\n        \"quest-mwj5ac01-quest-experience-browser\",\n        \"quest-mwj59c71-content-narrative-security\"\n",
          "baseline": "        \"quest-mwio22ow-quest-saga-social\",\n        \"quest-mwio27wm-content-casework\",\n        \"quest-mwio1jak-quest-experience-browser\",\n        \"quest-mwio0oxq-content-narrative-security\"\n"
        },
        {
          "at": 27653,
          "current": "        \"quest-mwj5aty9-quest-saga-social\",\n        \"quest-mwj5ayf2-content-casework\",\n        \"quest-mwj5ac01-quest-experience-browser\",\n        \"quest-mwj59c71-content-narrative-security\"\n",
          "baseline": "        \"quest-mwio22ow-quest-saga-social\",\n        \"quest-mwio27wm-content-casework\",\n        \"quest-mwio1jak-quest-experience-browser\",\n        \"quest-mwio0oxq-content-narrative-security\"\n"
        },
        {
          "at": 28749,
          "current": "        \"quest-mwj5aty9-quest-saga-social\",\n        \"quest-mwj5ayf2-content-casework\",\n        \"quest-mwj5ac01-quest-experience-browser\",\n        \"quest-mwj59c71-content-narrative-security\"\n",
          "baseline": "        \"quest-mwio22ow-quest-saga-social\",\n        \"quest-mwio27wm-content-casework\",\n        \"quest-mwio1jak-quest-experience-browser\",\n        \"quest-mwio0oxq-content-narrative-security\"\n"
        },
        {
          "at": 29857,
          "current": "        \"quest-mwj5aty9-quest-saga-social\",\n        \"quest-mwj5ayf2-content-casework\",\n        \"quest-mwj5ac01-quest-experience-browser\",\n        \"quest-mwj59c71-content-narrative-security\"\n",
          "baseline": "        \"quest-mwio22ow-quest-saga-social\",\n        \"quest-mwio27wm-content-casework\",\n        \"quest-mwio1jak-quest-experience-browser\",\n        \"quest-mwio0oxq-content-narrative-security\"\n"
        },
        {
          "at": 30805,
          "current": "        \"quest-mwj58ul7-quest-saga\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\"\n"
        },
        {
          "at": 31621,
          "current": "        \"quest-mwj58ul7-quest-saga\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\"\n"
        },
        {
          "at": 32410,
          "current": "        \"quest-mwj58ul7-quest-saga\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\"\n"
        },
        {
          "at": 33212,
          "current": "        \"quest-mwj58ul7-quest-saga\"\n",
          "baseline": "        \"quest-mwio0geb-quest-saga\"\n"
        },
        {
          "at": 33955,
          "current": "        \"quest-mwj5b23s-quest-workshop\",\n        \"quest-mwj5ac01-quest-experience-browser\"\n",
          "baseline": "        \"quest-mwio2c3c-quest-workshop\",\n        \"quest-mwio1jak-quest-experience-browser\"\n"
        },
        {
          "at": 1702613,
          "current": "      \"id\": \"quest-mwihzh9f-quest-saga\",\n",
          "baseline": "      \"id\": \"quest-mwio0geb-quest-saga\",\n"
        },
        {
          "at": 1702739,
          "current": "      \"startedAt\": \"2026-11-16T00:00:44.835Z\",\n      \"elapsedMs\": 9867,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"f1435602f0c038970f07ebfc6092b1461c83ec19752994a8c38cc499111178bc\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"1295c1e3bed266ec992726815fe3eae194535cb428904e7b1b993ad2b6af3293\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"1ee4df5e9fe5209f3239d854fa0a4c587c36e24ffe634ae569abb7af06be60f8\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwihzh9f-quest-saga.log\",\n      \"outputHash\": \"a6c577d2a2c66cca20b50b7cf4dae92c9efe2af0b8f02fb7f57fb00d5b797900\"\n    },\n    {\n      \"id\": \"quest-mwihzpos-content-narrative-security\",\n      \"evaluator\": \"test/content-narrative-security.js\",\n      \"command\": \"node test/content-narrative-security.js\",\n      \"startedAt\": \"2026-11-16T00:00:55.756Z\",\n      \"elapsedMs\": 1899,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"715f701a4b3054c445722fe71e1e9dabc95931384b52fc06119d99d880a1d0cc\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"1295c1e3bed266ec992726815fe3eae194535cb428904e7b1b993ad2b6af3293\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"1ee4df5e9fe5209f3239d854fa0a4c587c36e24ffe634ae569abb7af06be60f8\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwihzpos-content-narrative-security.log\",\n      \"outputHash\": \"bcb7d6c22007d7102728153116b5907914daaa83da0de40e56c0634b65777a18\"\n    },\n    {\n      \"id\": \"quest-mwihzrwp-quest-specialist\",\n      \"evaluator\": \"test/quest-specialist.js\",\n      \"command\": \"node test/quest-specialist.js\",\n      \"startedAt\": \"2026-11-16T00:00:58.633Z\",\n      \"elapsedMs\": 8787,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"44235e062bc9c16ba65a2dabb8914cdbecc2ce09da62662364762bfd6e03c186\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"1295c1e3bed266ec992726815fe3eae194535cb428904e7b1b993ad2b6af3293\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"1ee4df5e9fe5209f3239d854fa0a4c587c36e24ffe634ae569abb7af06be60f8\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwihzrwp-quest-specialist.log\",\n      \"outputHash\": \"e5d77e1bb22249a49c912341a5479a08ef2fed477a7d4018ad3368f4c9e9ae61\"\n    },\n    {\n      \"id\": \"quest-mwihzz6v-clue-puzzles\",\n      \"evaluator\": \"test/clue-puzzles.js\",\n      \"command\": \"node test/clue-puzzles.js\",\n      \"startedAt\": \"2026-11-16T00:01:08.071Z\",\n      \"elapsedMs\": 6966,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"3013dcf1ebf08a5d7429777b81f82b2986f013f76817837ae54eee6d1f08bd46\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"1295c1e3bed266ec992726815fe3eae194535cb428904e7b1b993ad2b6af3293\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"1ee4df5e9fe5209f3239d854fa0a4c587c36e24ffe634ae569abb7af06be60f8\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwihzz6v-clue-puzzles.log\",\n      \"outputHash\": \"f6360ef1255d7037a40128d4a3ea637de81d2b9b13e344f2c87ea6cd959ce4dd\"\n    },\n    {\n      \"id\": \"quest-mwii051d-clue-puzzles-browser\",\n      \"evaluator\": \"test/clue-puzzles-browser.js\",\n      \"command\": \"node test/clue-puzzles-browser.js\",\n      \"startedAt\": \"2026-11-16T00:01:15.649Z\",\n      \"elapsedMs\": 10302,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"4947877d555ac655b1b9c485c3299a386964a735af147100fdb650cd0b200783\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"1295c1e3bed266ec992726815fe3eae194535cb428904e7b1b993ad2b6af3293\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"1ee4df5e9fe5209f3239d854fa0a4c587c36e24ffe634ae569abb7af06be60f8\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwii051d-clue-puzzles-browser.log\",\n      \"outputHash\": \"ee6645fb15ada6ede837b8ae915ec628d2c25606c95e1f638f98f468371ad78f\"\n    },\n    {\n      \"id\": \"quest-mwii0dgu-content-narrative\",\n      \"evaluator\": \"test/content-narrative.js\",\n      \"command\": \"node test/content-narrative.js\",\n      \"startedAt\": \"2026-11-16T00:01:26.574Z\",\n      \"elapsedMs\": 5291,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"aead14e68b9161af4d0e2ffffcde716c739981c0a64273a4bfa625e602685189\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"1295c1e3bed266ec992726815fe3eae194535cb428904e7b1b993ad2b6af3293\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"1ee4df5e9fe5209f3239d854fa0a4c587c36e24ffe634ae569abb7af06be60f8\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwii0dgu-content-narrative.log\",\n      \"outputHash\": \"98e7883e95c0a31d4472bd460a28fa5b912a87eacece3a7942ebf52b5ec9d1ae\"\n    },\n    {\n      \"id\": \"quest-mwii0hye-quest-experience-browser\",\n      \"evaluator\": \"test/quest-experience-browser.js\",\n      \"command\": \"node test/quest-experience-browser.js\",\n      \"startedAt\": \"2026-11-16T00:01:32.390Z\",\n      \"elapsedMs\": 20486,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"0cee33effbeb473a18960e4c5dcc72b896748fa6695968605de3453d5525f7cc\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"1295c1e3bed266ec992726815fe3eae194535cb428904e7b1b993ad2b6af3293\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"1ee4df5e9fe5209f3239d854fa0a4c587c36e24ffe634ae569abb7af06be60f8\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwii0hye-quest-experience-browser.log\",\n      \"outputHash\": \"d1dc95cece4eea36f1ce2d8eb252e5e660f3bc2fd236a4aefacc57a3c49371b4\"\n    },\n    {\n      \"id\": \"quest-mwii0xz6-content-api\",\n      \"evaluator\": \"test/content-api.js\",\n      \"command\": \"node test/content-api.js\",\n      \"startedAt\": \"2026-11-16T00:01:53.154Z\",\n      \"elapsedMs\": 2098,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"af8662191fd428d95072e82de96ab6d12fedda3d1207d040665cb32244dc33cb\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"1295c1e3bed266ec992726815fe3eae194535cb428904e7b1b993ad2b6af3293\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"1ee4df5e9fe5209f3239d854fa0a4c587c36e24ffe634ae569abb7af06be60f8\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwii0xz6-content-api.log\",\n      \"outputHash\": \"457b58424f973c221ec169c5f9332abbfe73a7d3845035dbce8de5f7c12c7ab6\"\n    },\n    {\n      \"id\": \"quest-mwii0zs4-quest-saga-social\",\n      \"evaluator\": \"test/quest-saga-social.js\",\n      \"command\": \"node test/quest-saga-social.js\",\n      \"startedAt\": \"2026-11-16T00:01:55.492Z\",\n      \"elapsedMs\": 6421,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"c4a1e687277ca63c16e76c037d35cb2310bbc01e8efc3b153abf7fab6e596528\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"1295c1e3bed266ec992726815fe3eae194535cb428904e7b1b993ad2b6af3293\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"1ee4df5e9fe5209f3239d854fa0a4c587c36e24ffe634ae569abb7af06be60f8\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwii0zs4-quest-saga-social.log\",\n      \"outputHash\": \"048940451241d943b0eee2a9c69e23e27e1d88dd5029a42e9d447da390bf7db6\"\n    },\n    {\n      \"id\": \"quest-mwii14w7-content-casework\",\n      \"evaluator\": \"test/content-casework.js\",\n      \"command\": \"node test/content-casework.js\",\n      \"startedAt\": \"2026-11-16T00:02:02.119Z\",\n      \"elapsedMs\": 5766,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"a210eef7652bb668f2c03f69162e43e4f9a3a030f5fe67411751b90cafbb1f20\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"1295c1e3bed266ec992726815fe3eae194535cb428904e7b1b993ad2b6af3293\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"1ee4df5e9fe5209f3239d854fa0a4c587c36e24ffe634ae569abb7af06be60f8\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwii14w7-content-casework.log\",\n      \"outputHash\": \"27fc07288a559721e307f6dc1716811772844df47988c7668cf547af68fdd12e\"\n    },\n    {\n      \"id\": \"quest-mwii19g1-quest-workshop\",\n      \"evaluator\": \"test/quest-workshop.js\",\n      \"command\": \"node test/quest-workshop.js\",\n      \"startedAt\": \"2026-11-16T00:02:08.017Z\",\n      \"elapsedMs\": 5039,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"831a1962ea90477ba7cc2b80147d36c0e57e5cb6c3b50900a4682e284e19c956\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"39b36896c4e6a64f2aa7163de4d3312824c9b5bd6b16c57f8a87959db89bc98e\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"1295c1e3bed266ec992726815fe3eae194535cb428904e7b1b993ad2b6af3293\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"1ee4df5e9fe5209f3239d854fa0a4c587c36e24ffe634ae569abb7af06be60f8\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"d72f0ef99769d2097fb60368ae96f4faaad0e6c2a92bc8ec67b82abf975eedd4\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwii19g1-quest-workshop.log\",\n      \"outputHash\": \"07c3916bfa192238372f0e2be79bd41151aa515f4391289a9a0f31e7bd5559f4\"\n    },\n    {\n      \"id\": \"quest-mwio0geb-quest-saga\",\n      \"evaluator\": \"test/quest-saga.js\",\n      \"command\": \"node test/quest-saga.js\",\n      \"startedAt\": \"2026-11-16T02:49:28.067Z\",\n      \"elapsedMs\": 10179,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"f1435602f0c038970f07ebfc6092b1461c83ec19752994a8c38cc499111178bc\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"baf682a3ec4de922bc446b1e94eaed9a66f8f10ac5fc49645bbcb88cbb354b40\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"8587a22f47ba3b5dfb1c5b99e0e968cf6e18d9f30fe4989cc79fd7e6b1a2d533\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwio0geb-quest-saga.log\",\n      \"outputHash\": \"a6c577d2a2c66cca20b50b7cf4dae92c9efe2af0b8f02fb7f57fb00d5b797900\"\n    },\n    {\n      \"id\": \"quest-mwio0oxq-content-narrative-security\",\n      \"evaluator\": \"test/content-narrative-security.js\",\n      \"command\": \"node test/content-narrative-security.js\",\n      \"startedAt\": \"2026-11-16T02:49:39.134Z\",\n      \"elapsedMs\": 1992,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"715f701a4b3054c445722fe71e1e9dabc95931384b52fc06119d99d880a1d0cc\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"baf682a3ec4de922bc446b1e94eaed9a66f8f10ac5fc49645bbcb88cbb354b40\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"8587a22f47ba3b5dfb1c5b99e0e968cf6e18d9f30fe4989cc79fd7e6b1a2d533\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwio0oxq-content-narrative-security.log\",\n      \"outputHash\": \"bcb7d6c22007d7102728153116b5907914daaa83da0de40e56c0634b65777a18\"\n    },\n    {\n      \"id\": \"quest-mwio0r1g-quest-specialist\",\n      \"evaluator\": \"test/quest-specialist.js\",\n      \"command\": \"node test/quest-specialist.js\",\n      \"startedAt\": \"2026-11-16T02:49:41.860Z\",\n      \"elapsedMs\": 10050,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"44235e062bc9c16ba65a2dabb8914cdbecc2ce09da62662364762bfd6e03c186\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"baf682a3ec4de922bc446b1e94eaed9a66f8f10ac5fc49645bbcb88cbb354b40\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"8587a22f47ba3b5dfb1c5b99e0e968cf6e18d9f30fe4989cc79fd7e6b1a2d533\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwio0r1g-quest-specialist.log\",\n      \"outputHash\": \"e5d77e1bb22249a49c912341a5479a08ef2fed477a7d4018ad3368f4c9e9ae61\"\n    },\n    {\n      \"id\": \"quest-mwio0zat-clue-puzzles\",\n      \"evaluator\": \"test/clue-puzzles.js\",\n      \"command\": \"node test/clue-puzzles.js\",\n      \"startedAt\": \"2026-11-16T02:49:52.565Z\",\n      \"elapsedMs\": 7359,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"96cb003785242c0bc75f85d66c291af72fcf84fa08eb1738c3351ef07ff28b31\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"baf682a3ec4de922bc446b1e94eaed9a66f8f10ac5fc49645bbcb88cbb354b40\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"8587a22f47ba3b5dfb1c5b99e0e968cf6e18d9f30fe4989cc79fd7e6b1a2d533\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwio0zat-clue-puzzles.log\",\n      \"outputHash\": \"f6360ef1255d7037a40128d4a3ea637de81d2b9b13e344f2c87ea6cd959ce4dd\"\n    },\n    {\n      \"id\": \"quest-mwio15gv-clue-puzzles-browser\",\n      \"evaluator\": \"test/clue-puzzles-browser.js\",\n      \"command\": \"node test/clue-puzzles-browser.js\",\n      \"startedAt\": \"2026-11-16T02:50:00.559Z\",\n      \"elapsedMs\": 10506,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"4947877d555ac655b1b9c485c3299a386964a735af147100fdb650cd0b200783\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"baf682a3ec4de922bc446b1e94eaed9a66f8f10ac5fc49645bbcb88cbb354b40\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"8587a22f47ba3b5dfb1c5b99e0e968cf6e18d9f30fe4989cc79fd7e6b1a2d533\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwio15gv-clue-puzzles-browser.log\",\n      \"outputHash\": \"918f897657778d42f1fe8b1a872f04f2e3f11465b9a9a51a5be17ad49d8e604f\"\n    },\n    {\n      \"id\": \"quest-mwio1e4y-content-narrative\",\n      \"evaluator\": \"test/content-narrative.js\",\n      \"command\": \"node test/content-narrative.js\",\n      \"startedAt\": \"2026-11-16T02:50:11.794Z\",\n      \"elapsedMs\": 6143,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"aead14e68b9161af4d0e2ffffcde716c739981c0a64273a4bfa625e602685189\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"baf682a3ec4de922bc446b1e94eaed9a66f8f10ac5fc49645bbcb88cbb354b40\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"8587a22f47ba3b5dfb1c5b99e0e968cf6e18d9f30fe4989cc79fd7e6b1a2d533\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwio1e4y-content-narrative.log\",\n      \"outputHash\": \"98e7883e95c0a31d4472bd460a28fa5b912a87eacece3a7942ebf52b5ec9d1ae\"\n    },\n    {\n      \"id\": \"quest-mwio1jak-quest-experience-browser\",\n      \"evaluator\": \"test/quest-experience-browser.js\",\n      \"command\": \"node test/quest-experience-browser.js\",\n      \"startedAt\": \"2026-11-16T02:50:18.476Z\",\n      \"elapsedMs\": 22249,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"0cee33effbeb473a18960e4c5dcc72b896748fa6695968605de3453d5525f7cc\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"baf682a3ec4de922bc446b1e94eaed9a66f8f10ac5fc49645bbcb88cbb354b40\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"8587a22f47ba3b5dfb1c5b99e0e968cf6e18d9f30fe4989cc79fd7e6b1a2d533\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwio1jak-quest-experience-browser.log\",\n      \"outputHash\": \"758f3f87491bf8c6c61b438b27b06c7c035e74c03e75c1aed7ea4356e04761ec\"\n    },\n    {\n      \"id\": \"quest-mwio20ph-content-api\",\n      \"evaluator\": \"test/content-api.js\",\n      \"command\": \"node test/content-api.js\",\n      \"startedAt\": \"2026-11-16T02:50:41.045Z\",\n      \"elapsedMs\": 2304,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"af8662191fd428d95072e82de96ab6d12fedda3d1207d040665cb32244dc33cb\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"baf682a3ec4de922bc446b1e94eaed9a66f8f10ac5fc49645bbcb88cbb354b40\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"8587a22f47ba3b5dfb1c5b99e0e968cf6e18d9f30fe4989cc79fd7e6b1a2d533\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwio20ph-content-api.log\",\n      \"outputHash\": \"457b58424f973c221ec169c5f9332abbfe73a7d3845035dbce8de5f7c12c7ab6\"\n    },\n    {\n      \"id\": \"quest-mwio22ow-quest-saga-social\",\n      \"evaluator\": \"test/quest-saga-social.js\",\n      \"command\": \"node test/quest-saga-social.js\",\n      \"startedAt\": \"2026-11-16T02:50:43.616Z\",\n      \"elapsedMs\": 6578,\n",
          "baseline": "      \"startedAt\": \"2026-11-16T02:49:28.067Z\",\n      \"elapsedMs\": 10179,\n"
        },
        {
          "at": 1797761,
          "current": "      \"evaluatorHash\": \"c4a1e687277ca63c16e76c037d35cb2310bbc01e8efc3b153abf7fab6e596528\",\n",
          "baseline": "      \"evaluatorHash\": \"f1435602f0c038970f07ebfc6092b1461c83ec19752994a8c38cc499111178bc\",\n"
        },
        {
          "at": 1802254,
          "current": "      \"outputPath\": \"output/questing-verification/quest-mwio22ow-quest-saga-social.log\",\n      \"outputHash\": \"048940451241d943b0eee2a9c69e23e27e1d88dd5029a42e9d447da390bf7db6\"\n",
          "baseline": "      \"outputPath\": \"output/questing-verification/quest-mwio0geb-quest-saga.log\",\n      \"outputHash\": \"a6c577d2a2c66cca20b50b7cf4dae92c9efe2af0b8f02fb7f57fb00d5b797900\"\n"
        },
        {
          "at": 1802443,
          "current": "      \"id\": \"quest-mwio27wm-content-casework\",\n      \"evaluator\": \"test/content-casework.js\",\n      \"command\": \"node test/content-casework.js\",\n      \"startedAt\": \"2026-11-16T02:50:50.374Z\",\n      \"elapsedMs\": 5319,\n",
          "baseline": "      \"id\": \"quest-mwio0oxq-content-narrative-security\",\n      \"evaluator\": \"test/content-narrative-security.js\",\n      \"command\": \"node test/content-narrative-security.js\",\n      \"startedAt\": \"2026-11-16T02:49:39.134Z\",\n      \"elapsedMs\": 1992,\n"
        },
        {
          "at": 1802750,
          "current": "      \"evaluatorHash\": \"a210eef7652bb668f2c03f69162e43e4f9a3a030f5fe67411751b90cafbb1f20\",\n",
          "baseline": "      \"evaluatorHash\": \"715f701a4b3054c445722fe71e1e9dabc95931384b52fc06119d99d880a1d0cc\",\n"
        },
        {
          "at": 1807243,
          "current": "      \"outputPath\": \"output/questing-verification/quest-mwio27wm-content-casework.log\",\n      \"outputHash\": \"27fc07288a559721e307f6dc1716811772844df47988c7668cf547af68fdd12e\"\n",
          "baseline": "      \"outputPath\": \"output/questing-verification/quest-mwio0oxq-content-narrative-security.log\",\n      \"outputHash\": \"bcb7d6c22007d7102728153116b5907914daaa83da0de40e56c0634b65777a18\"\n"
        },
        {
          "at": 1807431,
          "current": "      \"id\": \"quest-mwio2c3c-quest-workshop\",\n      \"evaluator\": \"test/quest-workshop.js\",\n      \"command\": \"node test/quest-workshop.js\",\n      \"startedAt\": \"2026-11-16T02:50:55.800Z\",\n      \"elapsedMs\": 4654,\n",
          "baseline": "      \"id\": \"quest-mwio0r1g-quest-specialist\",\n      \"evaluator\": \"test/quest-specialist.js\",\n      \"command\": \"node test/quest-specialist.js\",\n      \"startedAt\": \"2026-11-16T02:49:41.860Z\",\n      \"elapsedMs\": 10050,\n"
        },
        {
          "at": 1807732,
          "current": "      \"evaluatorHash\": \"831a1962ea90477ba7cc2b80147d36c0e57e5cb6c3b50900a4682e284e19c956\",\n",
          "baseline": "      \"evaluatorHash\": \"44235e062bc9c16ba65a2dabb8914cdbecc2ce09da62662364762bfd6e03c186\",\n"
        },
        {
          "at": 1812225,
          "current": "      \"outputPath\": \"output/questing-verification/quest-mwio2c3c-quest-workshop.log\",\n      \"outputHash\": \"07c3916bfa192238372f0e2be79bd41151aa515f4391289a9a0f31e7bd5559f4\"\n    },\n    {\n      \"id\": \"quest-mwj58ul7-quest-saga\",\n      \"evaluator\": \"test/quest-saga.js\",\n      \"command\": \"node test/quest-saga.js\",\n      \"startedAt\": \"2026-11-16T10:51:53.179Z\",\n      \"elapsedMs\": 21200,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"f1435602f0c038970f07ebfc6092b1461c83ec19752994a8c38cc499111178bc\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"baf682a3ec4de922bc446b1e94eaed9a66f8f10ac5fc49645bbcb88cbb354b40\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"0fa11d22430186fcb3cccae0c92638c96faaf816faed7e5b62ab0c5e7bfe4731\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwj58ul7-quest-saga.log\",\n      \"outputHash\": \"a6c577d2a2c66cca20b50b7cf4dae92c9efe2af0b8f02fb7f57fb00d5b797900\"\n    },\n    {\n      \"id\": \"quest-mwj59c71-content-narrative-security\",\n      \"evaluator\": \"test/content-narrative-security.js\",\n      \"command\": \"node test/content-narrative-security.js\",\n      \"startedAt\": \"2026-11-16T10:52:15.997Z\",\n      \"elapsedMs\": 968,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"715f701a4b3054c445722fe71e1e9dabc95931384b52fc06119d99d880a1d0cc\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"baf682a3ec4de922bc446b1e94eaed9a66f8f10ac5fc49645bbcb88cbb354b40\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"0fa11d22430186fcb3cccae0c92638c96faaf816faed7e5b62ab0c5e7bfe4731\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwj59c71-content-narrative-security.log\",\n      \"outputHash\": \"bcb7d6c22007d7102728153116b5907914daaa83da0de40e56c0634b65777a18\"\n    },\n    {\n      \"id\": \"quest-mwj59e2m-quest-specialist\",\n      \"evaluator\": \"test/quest-specialist.js\",\n      \"command\": \"node test/quest-specialist.js\",\n      \"startedAt\": \"2026-11-16T10:52:18.430Z\",\n      \"elapsedMs\": 15114,\n      \"exitCode\": 0,\n      \"baselineRevision\": \"17fdf85fdd21fd3767463df8ba47614f7d1f6432\",\n      \"evaluatorHash\": \"44235e062bc9c16ba65a2dabb8914cdbecc2ce09da62662364762bfd6e03c186\",\n      \"sourceHashes\": {\n        \"content/packs/quest-archive-service/pack.json\": \"9ae8e2dff659efc6e387c04757291ef2dc979921c447fd4bb528bd99779b2b0e\",\n        \"content/packs/quest-early-obituary/pack.json\": \"300ea3d0019ca7b11055132be598515932a2f0236d52cf68ba629a0625bf16ba\",\n        \"content/packs/quest-family-dinner/pack.json\": \"1ea3be2ad823d1a7fcb7a5960607661d0ba4c696d3d47112602168f9c59a65f1\",\n        \"content/packs/quest-inherited-file/pack.json\": \"a4399ed7f5aa3c4a32469d69824d021b592f29a1ae93f17ce3c9213db371f34f\",\n        \"content/packs/quest-missing-name/pack.json\": \"529ef9964b07312f3298a068baf00724a1b7106a50b192acbdc401e90dc45f42\",\n        \"content/packs/quest-morning-after/pack.json\": \"ebfa0ad0cbb4a2e77791777ab307ff5c075c52de08ee40ac8afa4b224d3c68ac\",\n        \"content/packs/quest-quiet-wedding/pack.json\": \"623bbea98c196b252cb584f608067cce236d257fc640b78535c0761c3d265c9f\",\n        \"content/packs/quest-rival-accord/pack.json\": \"1a7df139c0f74af1e940dba4aedcd50c4230c5c3ea349fd606828a199ce993ed\",\n        \"content/packs/quest-sixth-envelope/pack.json\": \"ef8ee9c8a02d4d38092773e92cb9dade6ec1fbc4cfaedf57683d912d250f3226\",\n        \"content/packs/quest-three-witnesses/pack.json\": \"51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a\",\n        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n        \"public/landing-loader.js\": \"6bcc57c11389d69785c6e21f7f37aa2a8640b31cbd475b4f62d4891913f8000c\",\n        \"public/ux-clues.css\": \"c3d8290e9d11794e25b8d5b76365bd633a12032a2d03271fba30cc374a74c326\",\n        \"public/ux-clues.js\": \"9a492a6e54a45697978e6177e6c3f52083c51cf413a95b616b7e62c7b33bbe4d\",\n        \"public/ux-navigation.css\": \"712ebf19faf5303e45d82c55cfc9cda4b3d4156fc0ab759a115a849dbe2efbd6\",\n        \"public/ux-navigation.js\": \"baf682a3ec4de922bc446b1e94eaed9a66f8f10ac5fc49645bbcb88cbb354b40\",\n        \"public/ux-quests.css\": \"c65e7e95c966f14dd4996b8cbe99643874ab325d45c23d728216118afa27191f\",\n        \"public/ux-quests.js\": \"8997879a339d9123d7088f1166a2429d723782f732564942a03a0643aece5205\",\n        \"schema.sql\": \"b5c66d128de9b730bac19b135a8d13791f3bc70ba4a27818abec7de5141564de\",\n        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n        \"src/client-shell.js\": \"561ab86e4a826b6ef17b59049bd4139e2fc051fd519062abb21712c4902fbef4\",\n        \"src/clue-puzzles.js\": \"ee6cf76f6fab981356fd0c6068369218cd6fe1b9f8f968018e69bf4a146dd305\",\n        \"src/clues.js\": \"9d058e4a81268dfdfeb9295545fc72475b993caddc3ee6781f300103de0aee74\",\n        \"src/content/compiler.js\": \"20cd1a30a56389a653265c6ccac7871ca5bbb5a58cba5d312e93e96517a9d641\",\n        \"src/content/narrative.js\": \"96d4da7306be9f706887e3a0c95f3b899bf2ef6d4fc9c799e484e7bde15def41\",\n        \"src/content/quest-saga.js\": \"ecb7538abeee98a9a25ff42f69d1818a4485974b1fe072375dcdf0820e42f51f\",\n        \"src/content/runtime.js\": \"c1654cffc1dc95c7484cb3de77c3111f1d09c7c0be6e8f7b6a88e470c5814fd2\",\n        \"src/explore.js\": \"d0d87a39f7a12dccf98c97662bd69d68e0643894c5ed59b345f8c5790097ca88\",\n        \"src/game.js\": \"0fa11d22430186fcb3cccae0c92638c96faaf816faed7e5b62ab0c5e7bfe4731\",\n        \"src/gateway/context.js\": \"7516534f6b3e426efe6c92136aa1bc9d599925fce15a89f4ce57cace35be466f\",\n        \"src/quest-workshop-schema.js\": \"9bbf299a7ac7573c8d0770c140dd7841b2996c54a983278b71dbc768e381c70c\",\n        \"src/quest-workshop.js\": \"1a1549f014e735a2d94befc2c628ff34d5fdb7070bebd2bc0dca9bca3c261083\",\n        \"src/questing-contract.js\": \"15ee2dced0d0d0848aef0f6405439353aa4b9cd4c0eb4944a1c9b02fc6e35c71\",\n        \"src/questing.js\": \"11bf4829e5546042190e1da0c7134331de89a409df2c92da6d812ffbd30413f6\",\n        \"src/routes/content.js\": \"12744e0cd1a16f3bdea4c9775df7f80766a62949ae943d56d397adea29c3871e\",\n        \"src/routes/quest-workshop.js\": \"63f2afc0242759cbb288e144d2126268b2fc042f1dfecb1d1ebb7eb587e0081b\",\n        \"src/routes/questing.js\": \"27beabb502911baad8f7c3ddae6e4ded3ab9bbcb1ac1edfaa7f78dbb94974b82\",\n        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n        \"src/ux-workspace.js\": \"df2b039a96df5399fab6c1b3ffda9f6e4cc53c9e84f989da21610558c02b0870\",\n        \"tools/questing-content.js\": \"d08dd7fe90d5921f8bc731c218d18a44b5674b85ec944da60096e5a86fbab92f\",\n        \"tools/questing-workgraph.js\": \"bf0869441eb7a3f375773af0d051914d11dc4a68632423ffb1e296e32de50a8a\"\n      },\n      \"sourceStable\": true,\n      \"outputPath\": \"output/questing-verification/quest-mwj59e2m-quest-specialist.log\",\n",
          "baseline": "      \"outputPath\": \"output/questing-verification/quest-mwio0r1g-quest-specialist.log\",\n"
        },
        {
          "at": 1827392,
          "current": "      \"id\": \"quest-mwj59qnd-clue-puzzles\",\n",
          "baseline": "      \"id\": \"quest-mwio0zat-clue-puzzles\",\n"
        },
        {
          "at": 1827524,
          "current": "      \"startedAt\": \"2026-11-16T10:52:34.729Z\",\n      \"elapsedMs\": 5784,\n",
          "baseline": "      \"startedAt\": \"2026-11-16T02:49:52.565Z\",\n      \"elapsedMs\": 7359,\n"
        },
        {
          "at": 1827687,
          "current": "      \"evaluatorHash\": \"3013dcf1ebf08a5d7429777b81f82b2986f013f76817837ae54eee6d1f08bd46\",\n",
          "baseline": "      \"evaluatorHash\": \"96cb003785242c0bc75f85d66c291af72fcf84fa08eb1738c3351ef07ff28b31\",\n"
        },
        {
          "at": 1829037,
          "current": "        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n",
          "baseline": "        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n"
        },
        {
          "at": 1829931,
          "current": "        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n",
          "baseline": "        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n"
        },
        {
          "at": 1830828,
          "current": "        \"src/game.js\": \"0fa11d22430186fcb3cccae0c92638c96faaf816faed7e5b62ab0c5e7bfe4731\",\n",
          "baseline": "        \"src/game.js\": \"8587a22f47ba3b5dfb1c5b99e0e968cf6e18d9f30fe4989cc79fd7e6b1a2d533\",\n"
        },
        {
          "at": 1831740,
          "current": "        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n",
          "baseline": "        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n"
        },
        {
          "at": 1832180,
          "current": "      \"outputPath\": \"output/questing-verification/quest-mwj59qnd-clue-puzzles.log\",\n",
          "baseline": "      \"outputPath\": \"output/questing-verification/quest-mwio0zat-clue-puzzles.log\",\n"
        },
        {
          "at": 1832364,
          "current": "      \"id\": \"quest-mwj59vzo-clue-puzzles-browser\",\n",
          "baseline": "      \"id\": \"quest-mwio15gv-clue-puzzles-browser\",\n"
        },
        {
          "at": 1832520,
          "current": "      \"startedAt\": \"2026-11-16T10:52:41.652Z\",\n      \"elapsedMs\": 14198,\n",
          "baseline": "      \"startedAt\": \"2026-11-16T02:50:00.559Z\",\n      \"elapsedMs\": 10506,\n"
        },
        {
          "at": 1834034,
          "current": "        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n",
          "baseline": "        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n"
        },
        {
          "at": 1834928,
          "current": "        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n",
          "baseline": "        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n"
        },
        {
          "at": 1835825,
          "current": "        \"src/game.js\": \"0fa11d22430186fcb3cccae0c92638c96faaf816faed7e5b62ab0c5e7bfe4731\",\n",
          "baseline": "        \"src/game.js\": \"8587a22f47ba3b5dfb1c5b99e0e968cf6e18d9f30fe4989cc79fd7e6b1a2d533\",\n"
        },
        {
          "at": 1836737,
          "current": "        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n",
          "baseline": "        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n"
        },
        {
          "at": 1837177,
          "current": "      \"outputPath\": \"output/questing-verification/quest-mwj59vzo-clue-puzzles-browser.log\",\n      \"outputHash\": \"d00ac0bac439d3fd7026b62db2dc7e1746dc1ceb375e2710a4a8b8f849cf165c\"\n",
          "baseline": "      \"outputPath\": \"output/questing-verification/quest-mwio15gv-clue-puzzles-browser.log\",\n      \"outputHash\": \"918f897657778d42f1fe8b1a872f04f2e3f11465b9a9a51a5be17ad49d8e604f\"\n"
        },
        {
          "at": 1837369,
          "current": "      \"id\": \"quest-mwj5a7tt-content-narrative\",\n",
          "baseline": "      \"id\": \"quest-mwio1e4y-content-narrative\",\n"
        },
        {
          "at": 1837516,
          "current": "      \"startedAt\": \"2026-11-16T10:52:56.993Z\",\n      \"elapsedMs\": 4366,\n",
          "baseline": "      \"startedAt\": \"2026-11-16T02:50:11.794Z\",\n      \"elapsedMs\": 6143,\n"
        },
        {
          "at": 1839029,
          "current": "        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n",
          "baseline": "        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n"
        },
        {
          "at": 1839923,
          "current": "        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n",
          "baseline": "        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n"
        },
        {
          "at": 1840820,
          "current": "        \"src/game.js\": \"0fa11d22430186fcb3cccae0c92638c96faaf816faed7e5b62ab0c5e7bfe4731\",\n",
          "baseline": "        \"src/game.js\": \"8587a22f47ba3b5dfb1c5b99e0e968cf6e18d9f30fe4989cc79fd7e6b1a2d533\",\n"
        },
        {
          "at": 1841732,
          "current": "        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n",
          "baseline": "        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n"
        },
        {
          "at": 1842172,
          "current": "      \"outputPath\": \"output/questing-verification/quest-mwj5a7tt-content-narrative.log\",\n",
          "baseline": "      \"outputPath\": \"output/questing-verification/quest-mwio1e4y-content-narrative.log\",\n"
        },
        {
          "at": 1842361,
          "current": "      \"id\": \"quest-mwj5ac01-quest-experience-browser\",\n",
          "baseline": "      \"id\": \"quest-mwio1jak-quest-experience-browser\",\n"
        },
        {
          "at": 1842529,
          "current": "      \"startedAt\": \"2026-11-16T10:53:02.401Z\",\n      \"elapsedMs\": 20529,\n",
          "baseline": "      \"startedAt\": \"2026-11-16T02:50:18.476Z\",\n      \"elapsedMs\": 22249,\n"
        },
        {
          "at": 1844043,
          "current": "        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n",
          "baseline": "        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n"
        },
        {
          "at": 1844937,
          "current": "        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n",
          "baseline": "        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n"
        },
        {
          "at": 1845834,
          "current": "        \"src/game.js\": \"0fa11d22430186fcb3cccae0c92638c96faaf816faed7e5b62ab0c5e7bfe4731\",\n",
          "baseline": "        \"src/game.js\": \"8587a22f47ba3b5dfb1c5b99e0e968cf6e18d9f30fe4989cc79fd7e6b1a2d533\",\n"
        },
        {
          "at": 1846746,
          "current": "        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n",
          "baseline": "        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n"
        },
        {
          "at": 1847186,
          "current": "      \"outputPath\": \"output/questing-verification/quest-mwj5ac01-quest-experience-browser.log\",\n      \"outputHash\": \"c4775a25332ba8c1e9f39fb3eabf2fd919e2660287643a952c607995edc80b39\"\n",
          "baseline": "      \"outputPath\": \"output/questing-verification/quest-mwio1jak-quest-experience-browser.log\",\n      \"outputHash\": \"758f3f87491bf8c6c61b438b27b06c7c035e74c03e75c1aed7ea4356e04761ec\"\n"
        },
        {
          "at": 1847382,
          "current": "      \"id\": \"quest-mwj5ascx-content-api\",\n",
          "baseline": "      \"id\": \"quest-mwio20ph-content-api\",\n"
        },
        {
          "at": 1847511,
          "current": "      \"startedAt\": \"2026-11-16T10:53:23.601Z\",\n      \"elapsedMs\": 1390,\n",
          "baseline": "      \"startedAt\": \"2026-11-16T02:50:41.045Z\",\n      \"elapsedMs\": 2304,\n"
        },
        {
          "at": 1849024,
          "current": "        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n",
          "baseline": "        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n"
        },
        {
          "at": 1849918,
          "current": "        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n",
          "baseline": "        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n"
        },
        {
          "at": 1850815,
          "current": "        \"src/game.js\": \"0fa11d22430186fcb3cccae0c92638c96faaf816faed7e5b62ab0c5e7bfe4731\",\n",
          "baseline": "        \"src/game.js\": \"8587a22f47ba3b5dfb1c5b99e0e968cf6e18d9f30fe4989cc79fd7e6b1a2d533\",\n"
        },
        {
          "at": 1851727,
          "current": "        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n",
          "baseline": "        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n"
        },
        {
          "at": 1852167,
          "current": "      \"outputPath\": \"output/questing-verification/quest-mwj5ascx-content-api.log\",\n",
          "baseline": "      \"outputPath\": \"output/questing-verification/quest-mwio20ph-content-api.log\",\n"
        },
        {
          "at": 1852350,
          "current": "      \"id\": \"quest-mwj5aty9-quest-saga-social\",\n",
          "baseline": "      \"id\": \"quest-mwio22ow-quest-saga-social\",\n"
        },
        {
          "at": 1852497,
          "current": "      \"startedAt\": \"2026-11-16T10:53:25.665Z\",\n      \"elapsedMs\": 5282,\n",
          "baseline": "      \"startedAt\": \"2026-11-16T02:50:43.616Z\",\n      \"elapsedMs\": 6578,\n"
        },
        {
          "at": 1854010,
          "current": "        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n",
          "baseline": "        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n"
        },
        {
          "at": 1854904,
          "current": "        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n",
          "baseline": "        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n"
        },
        {
          "at": 1855801,
          "current": "        \"src/game.js\": \"0fa11d22430186fcb3cccae0c92638c96faaf816faed7e5b62ab0c5e7bfe4731\",\n",
          "baseline": "        \"src/game.js\": \"8587a22f47ba3b5dfb1c5b99e0e968cf6e18d9f30fe4989cc79fd7e6b1a2d533\",\n"
        },
        {
          "at": 1856713,
          "current": "        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n",
          "baseline": "        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n"
        },
        {
          "at": 1857153,
          "current": "      \"outputPath\": \"output/questing-verification/quest-mwj5aty9-quest-saga-social.log\",\n",
          "baseline": "      \"outputPath\": \"output/questing-verification/quest-mwio22ow-quest-saga-social.log\",\n"
        },
        {
          "at": 1857342,
          "current": "      \"id\": \"quest-mwj5ayf2-content-casework\",\n",
          "baseline": "      \"id\": \"quest-mwio27wm-content-casework\",\n"
        },
        {
          "at": 1857486,
          "current": "      \"startedAt\": \"2026-11-16T10:53:31.454Z\",\n      \"elapsedMs\": 4330,\n",
          "baseline": "      \"startedAt\": \"2026-11-16T02:50:50.374Z\",\n      \"elapsedMs\": 5319,\n"
        },
        {
          "at": 1858999,
          "current": "        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n",
          "baseline": "        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n"
        },
        {
          "at": 1859893,
          "current": "        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n",
          "baseline": "        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n"
        },
        {
          "at": 1860790,
          "current": "        \"src/game.js\": \"0fa11d22430186fcb3cccae0c92638c96faaf816faed7e5b62ab0c5e7bfe4731\",\n",
          "baseline": "        \"src/game.js\": \"8587a22f47ba3b5dfb1c5b99e0e968cf6e18d9f30fe4989cc79fd7e6b1a2d533\",\n"
        },
        {
          "at": 1861702,
          "current": "        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n",
          "baseline": "        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n"
        },
        {
          "at": 1862142,
          "current": "      \"outputPath\": \"output/questing-verification/quest-mwj5ayf2-content-casework.log\",\n",
          "baseline": "      \"outputPath\": \"output/questing-verification/quest-mwio27wm-content-casework.log\",\n"
        },
        {
          "at": 1862330,
          "current": "      \"id\": \"quest-mwj5b23s-quest-workshop\",\n",
          "baseline": "      \"id\": \"quest-mwio2c3c-quest-workshop\",\n"
        },
        {
          "at": 1862468,
          "current": "      \"startedAt\": \"2026-11-16T10:53:36.232Z\",\n      \"elapsedMs\": 3649,\n",
          "baseline": "      \"startedAt\": \"2026-11-16T02:50:55.800Z\",\n      \"elapsedMs\": 4654,\n"
        },
        {
          "at": 1863981,
          "current": "        \"public/index.html\": \"4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131\",\n",
          "baseline": "        \"public/index.html\": \"fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba\",\n"
        },
        {
          "at": 1864875,
          "current": "        \"src/agentgateway.js\": \"43ff02926ee5adb6bd7f2436bd8683b1abf82b7d52ad6c81c40d8c91e15f91ed\",\n",
          "baseline": "        \"src/agentgateway.js\": \"8361354dc6d1ba5ab7da51ca50561a9c3d2e4e132856b767245f10383dee4b3f\",\n"
        },
        {
          "at": 1865772,
          "current": "        \"src/game.js\": \"0fa11d22430186fcb3cccae0c92638c96faaf816faed7e5b62ab0c5e7bfe4731\",\n",
          "baseline": "        \"src/game.js\": \"8587a22f47ba3b5dfb1c5b99e0e968cf6e18d9f30fe4989cc79fd7e6b1a2d533\",\n"
        },
        {
          "at": 1866684,
          "current": "        \"src/server.js\": \"481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d\",\n",
          "baseline": "        \"src/server.js\": \"f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5\",\n"
        },
        {
          "at": 1867124,
          "current": "      \"outputPath\": \"output/questing-verification/quest-mwj5b23s-quest-workshop.log\",\n",
          "baseline": "      \"outputPath\": \"output/questing-verification/quest-mwio2c3c-quest-workshop.log\",\n"
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
        "blob": "840c0d9d97b60d3677f52c3d9da83505499f03f6",
        "bytes": 1406464,
        "sha256": "4660d277bf20f3685b2d3ba1351b63ef076f12e18f12d1a0a58b85efc10ff131"
      },
      "baseline": {
        "mode": "100644",
        "blob": "090fcf97c06430a16875bc5de8cdbf800584fcdb",
        "bytes": 1404985,
        "sha256": "fd77e400ea75e568e8e271b0f8dea2d207ded6e5bb8d0136a94b20b8207524ba"
      },
      "inverses": [
        {
          "at": 106024,
          "current": "<link rel=\"stylesheet\" href=\"/ux-crime-minigame.css?v=20261115-1\">\n",
          "baseline": ""
        },
        {
          "at": 157064,
          "current": "<script src=\"/ux-crime-minigame.js?v=20261115-1\"></script>\n",
          "baseline": ""
        },
        {
          "at": 344380,
          "current": "    if (body.minigame?.kind === 'signal-lock')\n      bits.push(body.minigame.completed\n        ? `lock cracked · ${body.minigame.mistakes} alarm${body.minigame.mistakes === 1 ? '' : 's'} · ${Math.round((body.successChance || 0) * 100)}% final crime odds`\n        : 'three alarms · the lock failed and the crime was lost');\n",
          "baseline": ""
        },
        {
          "at": 531141,
          "current": "  let crimeMinigamePending = false;\n  const crimeMinigameAttempts = new Map();\n",
          "baseline": ""
        },
        {
          "at": 531277,
          "current": "    if (acting || crimeMinigamePending) { toast('easy — one move at a time', false); return { code: 429, body: {} }; }\n",
          "baseline": "    if (acting) { toast('easy — one move at a time', false); return { code: 429, body: {} }; }\n"
        },
        {
          "at": 531801,
          "current": "    const crimeAttemptKey = `${actor}:${path}:${idempotencyKey}`;\n    if (method === 'POST' && /^\\/v1\\/crimes\\/[a-z0-9_-]+$/.test(path) && !body?.minigame && crimeMinigameAttempts.has(crimeAttemptKey))\n      body = { ...body, minigame: crimeMinigameAttempts.get(crimeAttemptKey) };\n    if (method === 'POST' && /^\\/v1\\/crimes\\/[a-z0-9_-]+$/.test(path) && !body?.minigame) {\n      if (typeof window.playOmertaCrimeMinigame !== 'function') {\n        toast('The crime minigame could not load. Refresh and try again.', true);\n        return { code: 503, body: { error: 'crime_minigame_unavailable' } };\n      }\n      const current = () => actorCurrent() && (!options.isCurrent || options.isCurrent());\n      if (!current() || (options.beforeDispatch && !options.beforeDispatch())) return { code: 0, body: {}, ignored: true };\n      crimeMinigamePending = true;\n      let minigame;\n      try {\n        minigame = await window.playOmertaCrimeMinigame({ path, approach: body?.approach || 'standard',\n          request: (m, p) => api(m, p, undefined, { isCurrent: current, beforeDispatch: current }),\n          label, returnFocus: trigger, isCurrent: current });\n      } finally { crimeMinigamePending = false; }\n      if (!minigame || !current()) return { code: 0, body: { cancelled: true } };\n      body = { ...body, minigame };\n      crimeMinigameAttempts.set(crimeAttemptKey, minigame);\n      if (crimeMinigameAttempts.size > 32) crimeMinigameAttempts.delete(crimeMinigameAttempts.keys().next().value);\n    }\n",
          "baseline": ""
        },
        {
          "at": 815680,
          "current": "      <div class=\"d operation-choice-terms\">Required lock minigame: mistakes lower your crime odds; three alarms fail the job.</div>\n",
          "baseline": ""
        },
        {
          "at": 816673,
          "current": "    return { terms, choices, blocked };\n",
          "baseline": "    const preparation = crime.puzzle ? `<button type=\"button\" class=\"act\" data-task-crime=\"${crime.id}\"${blocked ? ' disabled' : ''}>Prepare ${esc(crime.name)} (optional puzzle)</button>` : '';\n    return { terms, choices: choices + preparation, blocked };\n"
        },
        {
          "at": 955405,
          "current": "        <div class=\"noir-job-eyebrow\">Street job · Level ${c.lvl} · Required lock minigame</div><span class=\"t\">${esc(c.name)}</span>\n",
          "baseline": "        <div class=\"noir-job-eyebrow\">Street job · Level ${c.lvl}</div><span class=\"t\">${esc(c.name)}</span>\n"
        },
        {
          "at": 1340161,
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
        "blob": "442005a6881ffc329659f27afa5e5627e134fd78",
        "bytes": 231969,
        "sha256": "0fa11d22430186fcb3cccae0c92638c96faaf816faed7e5b62ab0c5e7bfe4731"
      },
      "baseline": {
        "mode": "100644",
        "blob": "959554f2d0ff7d2b795a3306556b7249105b996a",
        "bytes": 231863,
        "sha256": "8587a22f47ba3b5dfb1c5b99e0e968cf6e18d9f30fe4989cc79fd7e6b1a2d533"
      },
      "inverses": [
        {
          "at": 175887,
          "current": "export async function doCrime(ch, crimeId, client, h, approach, puzzle, minigame = null) {\n",
          "baseline": "export async function doCrime(ch, crimeId, client, h, approach, puzzle) {\n"
        },
        {
          "at": 178956,
          "current": "  // intended \"an unskilled crook fumbles the hard score\". Floor the chance at zero\n  // before applying minigame performance so the final probability stays valid.\n",
          "baseline": "  // intended \"an unskilled crook fumbles the hard score\"; the final chance is a probability, and\n  // Math.random() < (negative) is simply never true, so it needs no extra clamp.\n"
        },
        {
          "at": 179228,
          "current": "  const chance = Math.max(0, Math.min(0.97, (c.base + statEdge\n    + gangLevel * 0.02 + (held.includes('brick') ? 0.02 : 0) + (rIdx >= 9 ? 0.02 : 0)) * ap.successMult)) * (minigame?.multiplier ?? 1);\n",
          "baseline": "  const chance = Math.min(0.97, (c.base + statEdge\n    + gangLevel * 0.02 + (held.includes('brick') ? 0.02 : 0) + (rIdx >= 9 ? 0.02 : 0)) * ap.successMult);\n"
        },
        {
          "at": 189131,
          "current": "  return { ...outcome, ...(puzzleFeedback ? { puzzle: puzzleFeedback } : {}),\n    ...(minigame ? { minigame, successChance: chance } : {}) };\n",
          "baseline": "  return { ...outcome, ...(puzzleFeedback ? { puzzle: puzzleFeedback } : {}) };\n"
        }
      ]
    },
    "src/server.js": {
      "current": {
        "mode": "100644",
        "blob": "3267ca27efb276eb4d8077420a49c310a39942ae",
        "bytes": 314911,
        "sha256": "481545e4198c40ceff2614b404a40db1c1079458cda1cec6f1cde92f4d7fb15d"
      },
      "baseline": {
        "mode": "100644",
        "blob": "e77f4de48b7ccb5b8f951363c02036003bcb9cd4",
        "bytes": 314279,
        "sha256": "f97f8c0cfcc764a22fff150a0653cd93f6d16b101e40cee04a766805b76e08e5"
      },
      "inverses": [
        {
          "at": 14384,
          "current": "import { crimeChallenge, verifyCrimeMinigame } from './crime-minigame.js';\n",
          "baseline": ""
        },
        {
          "at": 50177,
          "current": "    ...['feel', 'tools', 'identity', 'story', 'community', 'quests', 'clues', 'task-puzzles', 'crime-minigame'].flatMap(name => [[`ux-${name}.js`, 'application/javascript'], [`ux-${name}.css`, 'text/css']]),\n",
          "baseline": "    ...['feel', 'tools', 'identity', 'story', 'community', 'quests', 'clues', 'task-puzzles'].flatMap(name => [[`ux-${name}.js`, 'application/javascript'], [`ux-${name}.css`, 'text/css']]),\n"
        },
        {
          "at": 132721,
          "current": "  app.get('/v1/crimes/:id/challenge', { preHandler: auth }, async (req) =>\n    G.readCharacter(pool, req.user.sub, (ch) => crimeChallenge(ch, req.params.id, req.query?.approach)));\n",
          "baseline": ""
        },
        {
          "at": 132968,
          "current": "    G.withCharacter(pool, req.user.sub, (ch, client, h) => crimeWithDecisionContext(ch, req.params.id, client, h, req.body?.approach, req.body?.puzzle,\n      verifyCrimeMinigame(ch, req.params.id, req.body?.approach, req.body?.minigame))));\n",
          "baseline": "    G.withCharacter(pool, req.user.sub, (ch, client, h) => crimeWithDecisionContext(ch, req.params.id, client, h, req.body?.approach, req.body?.puzzle)));\n"
        },
        {
          "at": 222401,
          "current": "  const performAgentAction = async (action, ch, client, h, lender = null, policy = null, minigame) => {\n",
          "baseline": "  const performAgentAction = async (action, ch, client, h, lender = null, policy = null) => {\n"
        },
        {
          "at": 222635,
          "current": "      case 'crime': return crimeWithDecisionContext(ch, tail('/v1/crimes/'), client, h, action.body?.approach, action.body?.puzzle,\n        verifyCrimeMinigame(ch, tail('/v1/crimes/'), action.body?.approach, minigame));\n",
          "baseline": "      case 'crime': return G.doCrime(ch, tail('/v1/crimes/'), client, h, action.body?.approach, action.body?.puzzle);\n"
        },
        {
          "at": 226734,
          "current": "  const executeAgentAction = async (client, ch, h, turnId, actionId, lender = null, decisionCallId = null, minigame) => {\n",
          "baseline": "  const executeAgentAction = async (client, ch, h, turnId, actionId, lender = null, decisionCallId = null) => {\n"
        },
        {
          "at": 227183,
          "current": "    const result = await performAgentAction(action, ch, client, h, lender, current.policy, minigame);\n",
          "baseline": "    const result = await performAgentAction(action, ch, client, h, lender, current.policy);\n"
        },
        {
          "at": 230216,
          "current": "          (ch, lender, client, h) => executeAgentAction(client, ch, h, turnId, actionId, lender, decisionCallId, req.body?.minigame), { meet: false });\n",
          "baseline": "          (ch, lender, client, h) => executeAgentAction(client, ch, h, turnId, actionId, lender, decisionCallId), { meet: false });\n"
        },
        {
          "at": 230432,
          "current": "          (ch, client, h) => executeAgentAction(client, ch, h, turnId, actionId, null, decisionCallId, req.body?.minigame), agentActionLocks);\n",
          "baseline": "          (ch, client, h) => executeAgentAction(client, ch, h, turnId, actionId, null, decisionCallId), agentActionLocks);\n"
        },
        {
          "at": 230902,
          "current": "            executeAgentAction(client, ch, h, turnId, actionId, owner, decisionCallId, req.body?.minigame));\n",
          "baseline": "            executeAgentAction(client, ch, h, turnId, actionId, owner, decisionCallId));\n"
        },
        {
          "at": 231108,
          "current": "            executeAgentAction(client, ch, h, turnId, actionId, null, decisionCallId, req.body?.minigame), agentActionLocks);\n",
          "baseline": "            executeAgentAction(client, ch, h, turnId, actionId, null, decisionCallId), agentActionLocks);\n"
        },
        {
          "at": 231604,
          "current": "            return executeAgentAction(client, ch, h, turnId, actionId, lender, decisionCallId, req.body?.minigame);\n",
          "baseline": "            return executeAgentAction(client, ch, h, turnId, actionId, lender, decisionCallId);\n"
        },
        {
          "at": 232035,
          "current": "            return executeAgentAction(client, ch, h, turnId, actionId, null, decisionCallId, req.body?.minigame);\n",
          "baseline": "            return executeAgentAction(client, ch, h, turnId, actionId, null, decisionCallId);\n"
        },
        {
          "at": 232292,
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
        "blob": "06a8bb7e9cc5f7227b6d28166e2143770015ff39",
        "bytes": 120987,
        "sha256": "aeb475d58f4ccfb0013e4b5613469ee6ac271e66a260448ca26dc343963a5431"
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
          "current": "async function crimeMinigameApi({ dropFirst = false, staleFirst = false,\n  challengePath = '/v1/crimes/pick/challenge?approach=standard', reviseTurn } = {}) {\n  const app = Fastify({ logger: false }), receipts = new Map();\n  const state = { turnCalls: 0, challengeCalls: 0, actBodies: [], actKeys: [], mutations: 0 };\n  const rounds = [[0, 1, 2], [3, 0, 1, 2], [1, 2, 3, 0, 1]];\n  app.get('/v1/session', async () => ({ authed: true, hasCharacter: true, agent: true,\n    character: { id: 'crime-agent', name: 'Alpha Machine', generation: 1 } }));\n  app.get('/v1/agent/turn', async () => {\n    state.turnCalls++;\n    const turn = { turnId: `crime-turn-${state.turnCalls}`, recommendedActionId: 'crime:pick:standard', policy: POLICY,\n      state: { identity: { id: 'crime-agent', generation: 1, level: 1 } },\n      actions: [{ id: 'crime:pick:standard', kind: 'crime', method: 'POST', path: '/v1/crimes/pick',\n        body: { approach: 'standard', prompt: 'do not persist authored bodies' }, executable: true,\n        minigame: { required: true, kind: 'signal-lock', challengePath } }] };\n    if (reviseTurn) reviseTurn(turn, state.turnCalls);\n    return turn;\n  });\n  app.get('/v1/crimes/pick/challenge', async () => {\n    state.challengeCalls++;\n    return { minigame: { kind: 'signal-lock', token: `signal-token-secret-${state.challengeCalls}`,\n      rounds, maxMistakes: 3, expiresAt: new Date(Date.now() + 300000).toISOString() } };\n  });\n  app.post('/v1/agent/act', async (req, reply) => {\n    state.actBodies.push(req.body); state.actKeys.push(req.headers['idempotency-key']);\n    if (!req.body.minigame) return reply.code(400).send({ error: 'crime_minigame_required' });\n    if (staleFirst && state.actBodies.length === 1) return reply.code(400).send({ error: 'stale_crime_minigame' });\n    assert.deepEqual(req.body.minigame.moves, rounds.flat(), 'the runner submits the complete public signal');\n    const key = req.headers['idempotency-key'];\n    if (!receipts.has(key)) {\n      state.mutations++;\n      receipts.set(key, { result: { ok: true }, turn: { turnId: 'idle', recommendedActionId: null, policy: POLICY, actions: [] } });\n    }\n    if (dropFirst && state.actBodies.length === 1) { reply.hijack(); reply.raw.destroy(); return; }\n    return receipts.get(key);\n  });\n  await app.listen({ port: 0, host: '127.0.0.1' });\n  return { baseUrl: `http://127.0.0.1:${app.server.address().port}`, state, rounds, close: () => app.close() };\n}\n\nasync function crimeMinigameRecoveryTest() {\n  const api = await crimeMinigameApi({ dropFirst: true });\n  await withReadySession(api, 'omerta-agent-alpha-crime-', async ({ sessionFile, reportFile }) => {\n    const inspectFetch = async (url, options) => {\n      if (new URL(url).pathname === '/v1/agent/act') {\n        const pending = JSON.parse(await readFile(sessionFile, 'utf8')).pending;\n        const body = JSON.parse(options.body);\n        assert.deepEqual(pending.minigame, body.minigame, 'the exact minigame is durable before every POST');\n        assert.deepEqual(Object.keys(pending).sort(), ['actionId', 'minigame', 'operationId', 'startedAt', 'turnId']);\n      }\n      return fetch(url, options);\n    };\n    await assert.rejects(runAgentAlpha({ baseUrl: api.baseUrl, sessionFile, reportFile, maxActions: 1,\n      fetchImpl: inspectFetch }), /fetch|socket|other side|terminated/i);\n    const pending = JSON.parse(await readFile(sessionFile, 'utf8')).pending;\n    assert.deepEqual(pending.minigame, { token: 'signal-token-secret-1', moves: api.rounds.flat() });\n    const resumed = await runAgentAlpha({ baseUrl: api.baseUrl, sessionFile, reportFile, maxActions: 1,\n      fetchImpl: inspectFetch });\n    assert.equal(resumed.actions, 1);\n    assert.equal(api.state.challengeCalls, 1, 'an ambiguous replay never fetches or substitutes another challenge');\n    assert.equal(api.state.turnCalls, 2, 'pending recovery uses the final observed turn without another observation');\n    assert.deepEqual(api.state.actBodies[0], api.state.actBodies[1]);\n    assert.equal(api.state.actKeys[0], api.state.actKeys[1]);\n    assert.equal(api.state.mutations, 1, 'the replay confirms exactly one committed crime');\n    assert.equal(JSON.parse(await readFile(sessionFile, 'utf8')).pending, null);\n    const report = await readFile(reportFile, 'utf8');\n    assert(!report.includes('signal-token-secret') && !report.includes('do not persist authored bodies'),\n      'minigame credentials and authored action bodies stay out of reports');\n  });\n}\n\nasync function crimeMinigameStaleTest() {\n  for (const legacy of [false, true]) {\n    const api = await crimeMinigameApi({ staleFirst: !legacy });\n    await withReadySession(api, 'omerta-agent-alpha-crime-stale-', async ({ sessionFile, reportFile }) => {\n      if (legacy) await writePrivateSession(sessionFile, JSON.stringify(sessionFor(api.baseUrl, {\n        pending: { operationId: 'old-crime-attempt', turnId: 'old-turn', actionId: 'crime:pick:standard', startedAt: new Date().toISOString() },\n      })));\n      const summary = await runAgentAlpha({ baseUrl: api.baseUrl, sessionFile, reportFile, maxActions: 2 });\n      assert.equal(summary.actions, 1, 'a definitive minigame refusal refreshes authority within the attempt budget');\n      assert.equal(api.state.mutations, 1);\n      assert.notEqual(api.state.actKeys[0], api.state.actKeys[1], 'a replacement challenge starts a new logical attempt');\n      assert.equal(api.state.challengeCalls, legacy ? 1 : 2);\n      assert.equal(JSON.parse(await readFile(sessionFile, 'utf8')).pending, null);\n      const report = await readFile(reportFile, 'utf8');\n      assert(report.includes(legacy ? 'crime_minigame_required' : 'stale_crime_minigame'));\n    });\n  }\n}\n\nasync function crimeMinigameOriginTest() {\n  const api = await crimeMinigameApi({ challengePath: '//attacker.invalid/collect' });\n  await withReadySession(api, 'omerta-agent-alpha-crime-origin-', async ({ sessionFile, reportFile }) => {\n    await assert.rejects(runAgentAlpha({ baseUrl: api.baseUrl, sessionFile, reportFile, maxActions: 1 }),\n      /unsupported crime minigame/);\n    assert.equal(api.state.challengeCalls, 0);\n    assert.equal(api.state.actBodies.length, 0, 'an invalid challenge path cannot cause a mutation');\n    assert.equal(JSON.parse(await readFile(sessionFile, 'utf8')).pending, null);\n  });\n}\n\nasync function crimeMinigameFreshTurnTest() {\n  const api = await crimeMinigameApi({ reviseTurn(turn, call) {\n    turn.state.resources = { energy: 50 + call, nerve: 9 + call };\n    turn.actions[0].decisionCall = { callId: `crime-decision-${call}`, turnId: turn.turnId, actionId: turn.actions[0].id };\n  } });\n  await withReadySession(api, 'omerta-agent-alpha-crime-fresh-', async ({ sessionFile, reportFile }) => {\n    let challengeAt, observedAt;\n    const checkingFetch = async (url, options) => {\n      const pathname = new URL(url).pathname;\n      if (pathname === '/v1/agent/turn' && api.state.challengeCalls) {\n        assert(testNow - challengeAt >= 3100, 'The shared cadence is paid before final authority is observed.');\n        assert.equal(JSON.parse(await readFile(sessionFile, 'utf8')).pending, null, 'An undispatched challenge is not yet a durable operation.');\n        observedAt = testNow;\n      }\n      if (pathname === '/v1/agent/act') {\n        const pending = JSON.parse(await readFile(sessionFile, 'utf8')).pending;\n        assert.equal(testNow, observedAt, 'No cadence delay ages the final observed turn.');\n        assert.equal(pending.turnId, 'crime-turn-2');\n        assert.equal(pending.decisionCallId, 'crime-decision-2', 'Only the final turn can supply the associated decision.');\n        assert.equal(JSON.parse(options.body).decisionCallId, pending.decisionCallId);\n      }\n      const response = await fetch(url, options);\n      if (pathname.endsWith('/challenge')) challengeAt = testNow;\n      return response;\n    };\n    const result = await runAgentAlpha({ baseUrl: api.baseUrl, sessionFile, reportFile, maxActions: 1, fetchImpl: checkingFetch });\n    assert.equal(result.actions, 1);\n    assert.equal(api.state.challengeCalls, 1);\n    assert.equal(api.state.turnCalls, 2);\n    assert.equal(api.state.mutations, 1);\n  });\n  for (const change of ['actor', 'actor_goal', 'body', 'minigame', 'policy', 'goal']) {\n    const changed = await crimeMinigameApi({ reviseTurn(turn, call) {\n      if (call < 2) return;\n      if (change === 'actor' || change === 'actor_goal') turn.state.identity.generation++;\n      if (change === 'body') turn.actions[0].body.approach = 'quiet';\n      if (change === 'minigame') turn.actions[0].minigame.challengePath = '/v1/crimes/other/challenge';\n      if (change === 'policy') turn.policy = { ...POLICY, allowPvP: true };\n      if (change === 'goal' || change === 'actor_goal') turn.state.identity.level = 100;\n    } });\n    await withReadySession(changed, `omerta-agent-alpha-crime-changed-${change}-`, async ({ sessionFile, reportFile }) => {\n      const result = await runAgentAlpha({ baseUrl: changed.baseUrl, sessionFile, reportFile, maxActions: 1, stopAtLevel: 100 });\n      assert.equal(result.status, change === 'goal' ? 'level_reached' : 'refused');\n      assert.equal(changed.state.actBodies.length, 0, 'A changed actor, action, policy or completed goal cannot spend the prepared trace.');\n      assert.equal(JSON.parse(await readFile(sessionFile, 'utf8')).pending, null);\n    });\n  }\n}\n\nif (process.argv.includes('--crime-minigame')) {\n  await crimeMinigameRecoveryTest();\n  await crimeMinigameStaleTest();\n  await crimeMinigameOriginTest();\n  await crimeMinigameFreshTurnTest();\n} else if (process.argv.includes('--decision-recovery')) {\n",
          "baseline": "if (process.argv.includes('--decision-recovery')) {\n"
        },
        {
          "at": 120802,
          "current": "await crimeMinigameRecoveryTest();\nawait crimeMinigameStaleTest();\nawait crimeMinigameOriginTest();\nawait crimeMinigameFreshTurnTest();\n",
          "baseline": ""
        }
      ]
    },
    "test/agent-cohort.js": {
      "current": {
        "mode": "100644",
        "blob": "71c1a292f140ec4c67efa9317405c563d00424b3",
        "bytes": 4459,
        "sha256": "af78d18ddf07ccf480832dccc230ce548d4ee2ef2f5963f4ceccc50503365a0b"
      },
      "baseline": {
        "mode": "100644",
        "blob": "a06c5b8876237802373b85d6902ca12466b9c50a",
        "bytes": 4256,
        "sha256": "a0a7b4cd31ba9162ff2cdacf407ed47b52a30f4748b99eb1cd8869a248d220c3"
      },
      "inverses": [
        {
          "at": 1515,
          "current": "    assert.equal(checkpoint.lastRun.events.find(event => event.path === '/v1/agent/act')?.status, 200, 'every cohort identity commits its one authorized action without a cadence or stale-turn refusal');\n",
          "baseline": ""
        }
      ]
    },
    "test/agentturn-jail-units.js": {
      "current": {
        "mode": "100644",
        "blob": "b2e64a64d0748cefe07e0ac8f115ac838666e2a5",
        "bytes": 4273,
        "sha256": "37b9620a6488c177882219038a380dac5ecef3799c3c7be24076254b7ce297e0"
      },
      "baseline": {
        "mode": "100644",
        "blob": "4fe31efb6a6b2a1138fb2bb7ed9947fc1ff7e1c0",
        "bytes": 4193,
        "sha256": "816f6bdc974be6caefa2e32fa62b0feedd6fc07a6006d724cc59824ba7c1e538"
      },
      "inverses": [
        {
          "at": 0,
          "current": "import { injectWithCrimeMinigame } from './crime-fixture.js';\n",
          "baseline": ""
        },
        {
          "at": 552,
          "current": "  const response = await injectWithCrimeMinigame(app, { method, url, payload,\n",
          "baseline": "  const response = await app.inject({ method, url, payload,\n"
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
    "test/coldstart.js": {
      "current": {
        "mode": "100644",
        "blob": "e0492568bcbb85db08d0563031271332fad1eb10",
        "bytes": 26933,
        "sha256": "d4f26ed32a2458db3b5c8ecde174c81824d3dce06d3b3890fcd3dd574393894c"
      },
      "baseline": {
        "mode": "100644",
        "blob": "2b54efdabdeef723df7fd041acde335adc0d8d03",
        "bytes": 26868,
        "sha256": "74bbfb0ff5606e842136645db49326488d92669f7c0edf5cad3dc0bfd04f2274"
      },
      "inverses": [
        {
          "at": 16972,
          "current": "assert.deepEqual(crimeSelector, { required: true, scope: 'crime', targetId: 'pick', benefit: 'success_odds',\n  kind: 'signal-lock', challengePath: '/v1/crimes/pick/challenge' });\n",
          "baseline": "assert.deepEqual(crimeSelector, { required: false, scope: 'crime', targetId: 'pick', benefit: 'feedback_only' });\n"
        }
      ]
    },
    "test/decision-guide-client.js": {
      "current": {
        "mode": "100644",
        "blob": "85a3ea953ab9d48f12a0715dcd35868409b81823",
        "bytes": 7665,
        "sha256": "cc5b845208995855f04c372d9ec02158095ee34468d6781b4b93ac8356bfeaff"
      },
      "baseline": {
        "mode": "100644",
        "blob": "ff17d0c8356b8b1420cb242b7e12d41288eb2078",
        "bytes": 7606,
        "sha256": "1ec84d7069f9a4a75971f1d6a1e609e003d1dbe53f7cabc1fa80f68ae6978285"
      },
      "inverses": [
        {
          "at": 970,
          "current": " const c=vm.createContext({console,OmertaSiteAnalytics:analytics,document:{body:{style:{}}},activatedControl:null,acting:false,crimeMinigamePending:false,crimeMinigameAttempts:new Map(),operationPending:null,\n",
          "baseline": " const c=vm.createContext({console,OmertaSiteAnalytics:analytics,document:{body:{style:{}}},activatedControl:null,acting:false,operationPending:null,\n"
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
        "blob": "429e154d0e9b1de88793ff958a0d535c2b89c5c1",
        "bytes": 511590,
        "sha256": "17d3d540991b68c6cf9302d69c17c409870461798051cca2f1939f302ef7bbe9"
      },
      "baseline": {
        "mode": "100644",
        "blob": "70271681f96baf24dbbbe37d66287c262ad5ed83",
        "bytes": 511385,
        "sha256": "7efa56501608f71173a7a3ae54fd948850aaa981c7790835164b51b78ee0197f"
      },
      "inverses": [
        {
          "at": 348976,
          "current": "    'test/crime-fixture.js': 'Import-only explicit crime challenge and browser-play helpers; mandatory minigame and gameplay suites exercise them while raw protocol tests retain missing-answer coverage.',\n",
          "baseline": ""
        }
      ]
    },
    "test/grand-strategy-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "2dc535d071ef91d76102fa3621d939168967f872",
        "bytes": 16020,
        "sha256": "ffb2c1407de2e7d6579f5f893b1ca6e3fa4eb22fe2f447be31825f65d4d0c3f6"
      },
      "baseline": {
        "mode": "100644",
        "blob": "1ea1ca6db425a398c252bcf4d3a61c18fd04442e",
        "bytes": 15990,
        "sha256": "7126a06aa14fbc1ef22982a98220b9fb9cbee077a413ec6efce022dca129e817"
      },
      "inverses": [
        {
          "at": 319,
          "current": "import { crimeMinigameActual } from '../tools/crime-minigame-source-compatibility.js';\n",
          "baseline": ""
        },
        {
          "at": 8022,
          "current": "const currentObserved = crimeMinigameActual(observedFile);\n",
          "baseline": "const currentObserved = nativeGarageActual(observedFile);\n"
        },
        {
          "at": 12579,
          "current": "  const currentRecordScript = ending => 'import { crimeMinigameActual } from '\n    + JSON.stringify(new URL('../tools/crime-minigame-source-compatibility.js', import.meta.url).href)\n",
          "baseline": "  const currentRecordScript = ending => 'import { nativeGarageActual, nativeGarageHistoricalRecord } from '\n    + JSON.stringify(new URL('../tools/native-garage-source-transfer.js', import.meta.url).href)\n"
        },
        {
          "at": 13057,
          "current": "    + '; const file = ' + JSON.stringify(observedFile) + '; const actual = crimeMinigameActual(file);'\n",
          "baseline": "    + '; const file = ' + JSON.stringify(observedFile) + '; const actual = nativeGarageHistoricalRecord(file, nativeGarageActual(file));'\n"
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
    "test/native-garage-enterprise-source.js": {
      "current": {
        "mode": "100644",
        "blob": "2a5e29a8fe66934fa4d39e52b3bdb0634143e739",
        "bytes": 4407,
        "sha256": "3c579a38f6f7e9827582b63e8230126a0af95020358396ec919344a3649f13e2"
      },
      "baseline": {
        "mode": "100644",
        "blob": "7b772874e0a56ca4f5c3864cb418ca3dfb6fb23c",
        "bytes": 4431,
        "sha256": "7306ea85dc794cd0a4bca5c8f74d4db7f21248a5065f56906bc76578b4517d60"
      },
      "inverses": [
        {
          "at": 955,
          "current": "const changed = Object.entries(NATIVE_GARAGE_SOURCE.files).map(([file, row]) => ({ file, ...row.baseline }));\n",
          "baseline": "const changed = declaration.files.filter(row => Object.hasOwn(NATIVE_GARAGE_SOURCE.files, row.file));\n"
        },
        {
          "at": 3001,
          "current": "const actual = [...new Set([...expectedNames, ...additions, NATIVE_GARAGE_SOURCE_METADATA])];\n",
          "baseline": "const actual = [...expectedNames, ...additions.filter(file => !expectedNames.includes(file)), NATIVE_GARAGE_SOURCE_METADATA];\n"
        }
      ]
    },
    "test/native-garage-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "d3ccb791645784a1309d348b87fd2b6df7e3c638",
        "bytes": 10306,
        "sha256": "f0996dcde14aecbec07e9639d0dec7d337cbf6b096a639e241a8c1a7f6593280"
      },
      "baseline": {
        "mode": "100644",
        "blob": "0dd5bd21d2694cd89afd14c65577229578c4f14b",
        "bytes": 9802,
        "sha256": "25e423b12d3f14520d64b53eb73f5ede80183ce0a0e11b786c0e103cd0ec8c88"
      },
      "inverses": [
        {
          "at": 284,
          "current": "import { crimeMinigameActual } from '../tools/crime-minigame-source-compatibility.js';\n",
          "baseline": ""
        },
        {
          "at": 4710,
          "current": "const currentObserved = crimeMinigameActual(observedFile);\n",
          "baseline": ""
        },
        {
          "at": 5268,
          "current": "  + ' import {crimeMinigameHistoricalInput} from ' + JSON.stringify(new URL('../tools/crime-minigame-source-compatibility.js', import.meta.url).href) + ';'\n",
          "baseline": ""
        },
        {
          "at": 5819,
          "current": "  + ' try {const actual=nativeGarageActual(file);assert(actual.physical.equals(crimeMinigameHistoricalInput(file,current)));assert.equal(calls,0);'\n",
          "baseline": "  + ' try {const actual=nativeGarageActual(file);assert(actual.physical.equals(current));assert.equal(calls,0);'\n"
        },
        {
          "at": 6825,
          "current": "  fs.writeFileSync(target, currentObserved.physical);\n",
          "baseline": "  fs.writeFileSync(target, observed.physical);\n"
        },
        {
          "at": 7170,
          "current": "  const genuineLf = child(environment);\n  assert.equal(genuineLf.status, 0, genuineLf.stderr || genuineLf.stdout); positives++;\n  fs.writeFileSync(target, Buffer.from(currentObserved.committed.toString('utf8').replaceAll('\\n', '\\r\\n')));\n  const genuineCrlf = child(environment);\n  assert.equal(genuineCrlf.status, 0, genuineCrlf.stderr || genuineCrlf.stdout); positives++;\n",
          "baseline": "  assert.equal(child(environment).status, 0); positives++;\n  fs.writeFileSync(target, Buffer.from(observed.committed.toString('utf8').replaceAll('\\n', '\\r\\n')));\n  assert.equal(child(environment).status, 0); positives++;\n"
        },
        {
          "at": 7713,
          "current": "  fs.writeFileSync(target, currentObserved.physical);\n",
          "baseline": "  fs.writeFileSync(target, observed.physical);\n"
        }
      ]
    },
    "test/nativegarage-browser.js": {
      "current": {
        "mode": "100644",
        "blob": "b1a5480e084b9c93fb10bfcec5fcc0a9dd2cb5ae",
        "bytes": 21945,
        "sha256": "4daa7dee8d4a5ade0cefa526d0917849d5a6f1ae3595aabca93c5f0a42e20788"
      },
      "baseline": {
        "mode": "100644",
        "blob": "66b07e5090e99167096f676cfa06d27000e1eabe",
        "bytes": 21857,
        "sha256": "bf8e5903fa71810c344b843e0ee5578bab0adafccd78a571f7cf0379fb584b7b"
      },
      "inverses": [
        {
          "at": 10564,
          "current": "  const submittedStored = page => page.waitForFunction(expectedHash => Object.keys(sessionStorage).some(key => {\n    if (!key.startsWith('omerta:native-garage:v1:')) return false;\n    try { const record = JSON.parse(sessionStorage.getItem(key)); return record.stage === 'submitted' && record.hash === expectedHash; }\n    catch { return false; }\n  }), hash);\n",
          "baseline": ""
        },
        {
          "at": 16790,
          "current": "  await submittedStored(salvage.page);\n",
          "baseline": "  await salvage.page.waitForFunction(() => Object.keys(sessionStorage).some(key => key.startsWith('omerta:native-garage:v1:')));\n"
        },
        {
          "at": 18298,
          "current": "  await submittedStored(approval.page);\n",
          "baseline": "  await approval.page.waitForFunction(() => Object.keys(sessionStorage).some(key => key.startsWith('omerta:native-garage:v1:')));\n"
        },
        {
          "at": 19015,
          "current": "  await submittedStored(recovery.page);\n",
          "baseline": "  await recovery.page.waitForFunction(() => Object.keys(sessionStorage).some(key => key.startsWith('omerta:native-garage:v1:')));\n"
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
    "test/playthrough-truth.js": {
      "current": {
        "mode": "100644",
        "blob": "a288743f6f14898d0034d9a5dc30326170dadd43",
        "bytes": 3607,
        "sha256": "20c6ee449b421086e76fecdb4bac5e5552ad0a9a15dd896e99d93a59cf46f84e"
      },
      "baseline": {
        "mode": "100644",
        "blob": "dc312070966cccc4bfd1a80e244805b32cf57c53",
        "bytes": 3019,
        "sha256": "f735e49b8a7f5c5e7f1a99863510eb0b17bbd6508f8074caee46a3cec30c97f8"
      },
      "inverses": [
        {
          "at": 1786,
          "current": "  import crypto from 'node:crypto';\n  import { syncBuiltinESMExports } from 'node:module';\n  import { mock } from 'node:test';\n  // Resident queries order by UUID; calendar time also selects their behavior.\n  // Control both inputs without changing combat or settlement outcomes.\n  let identity = 0;\n  crypto.randomUUID = () => '00000000-0000-4000-8000-' + (++identity).toString(16).padStart(12, '0');\n  syncBuiltinESMExports();\n  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-10T12:00:00Z') });\n",
          "baseline": ""
        },
        {
          "at": 3325,
          "current": "  'the actual current coach hint identifies the assigned rival and the harness clears First Blood'\n    + '\\nHarness report (last 12,000 characters):\\n' + stdout.slice(-12000));\n",
          "baseline": "  'the actual current coach hint identifies the assigned rival and the harness clears First Blood');\n"
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
        "blob": "bec46ac8dee7af67198ad46ce4985a6c03214214",
        "bytes": 16840,
        "sha256": "452fbf32c67fa12fef8dd6b5d603fb1fceb1534524265f161529121437f5e9ff"
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
          "at": 2887,
          "current": "  if (dimensions.scroll > dimensions.width + 2) {\n    try {\n      const diagnostic = await page.evaluate(() => {\n        const box = element => {\n          const rect = element.getBoundingClientRect(), style = getComputedStyle(element);\n          return {\n            node: element.tagName.toLowerCase(), id: element.id, classes: String(element.className).slice(0,160),\n            left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height,\n            clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,\n            display: style.display, position: style.position, visibility: style.visibility, opacity: style.opacity,\n            minWidth: style.minWidth, maxWidth: style.maxWidth, cssWidth: style.width, boxSizing: style.boxSizing,\n            overflowX: style.overflowX, overflowY: style.overflowY, flex: style.flex, grid: style.gridTemplateColumns,\n            whiteSpace: style.whiteSpace, overflowWrap: style.overflowWrap, transform: style.transform,\n          };\n        };\n        const ancestors = element => {\n          const parents = [];\n          for (let parent = element.parentElement; parent; parent = parent.parentElement) parents.push(parent);\n          return parents;\n        };\n        const offenders = [...document.querySelectorAll('body *')].map(element => {\n          const bounds = box(element);\n          if (!bounds.width || !bounds.height || bounds.right <= innerWidth + 2) return null;\n          const parents = ancestors(element);\n          const clipping = parents.filter(parent => /^(auto|scroll|hidden|clip)$/.test(getComputedStyle(parent).overflowX));\n          const visibleRight = Math.min(bounds.right, ...clipping.map(parent => {\n            const rect = parent.getBoundingClientRect(); return rect.left + parent.clientLeft + parent.clientWidth;\n          }));\n          return { ...bounds, text: element.textContent?.trim().slice(0,100), visibleRight,\n            clippingParents: clipping.slice(0,5).map(box), parents: parents.slice(0,5).map(box) };\n        }).filter(Boolean).sort((a,b) => b.visibleRight - a.visibleRight || b.right - a.right).slice(0,24);\n        const overlays = [...document.querySelectorAll('#toast,#toast>*,#brag,#wirepanel,#ux-screen-tools,#ux-screen-tools>.ux-screen-tools-body,dialog,.modal-bg,.ux-feel-arrival,.ux-reward-transfer')]\n          .map(element => ({ ...box(element), open: element.hasAttribute('open'), hidden: element.hasAttribute('hidden'),\n            text: element.textContent?.trim().slice(0,100) }));\n        return { width: innerWidth, height: innerHeight, root: box(document.documentElement), body: box(document.body),\n          fontStatus: document.fonts.status, fonts: [...document.fonts].slice(0,20).map(font => ({ family: font.family, status: font.status })),\n          focusView: document.body.classList.contains('ux-operation-focus'),\n          activeElement: document.activeElement ? box(document.activeElement) : null, offenders, overlays };\n      });\n      const record = { label, measured: dimensions, diagnostic };\n      console.log('UX_OVERFLOW_DIAGNOSTICS ' + JSON.stringify(record));\n      fs.writeFileSync(path.join(artifacts, `ux-overflow-${label.replace(/[^a-z0-9]+/gi,'-')}.json`), JSON.stringify(record,null,2));\n      await page.screenshot({ path: path.join(artifacts, 'ux-overflow-failure.png') });\n      console.log(`Overflow artifacts: ${artifacts}`);\n    } catch (error) { console.log('UX_OVERFLOW_DIAGNOSTIC_ERROR ' + String(error?.message || error)); }\n  }\n",
          "baseline": ""
        },
        {
          "at": 10478,
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
        "blob": "81e3d4980ebd23c121090f250b3e2effb82b64ea",
        "bytes": 21428,
        "sha256": "b25b37b511920cc737fabf37a3ab92ad1fe9a134451e7dcbeec03e001633ecd4"
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
          "at": 4260,
          "current": "        return { text: button.textContent, approach: JSON.parse(button.dataset.body).approach, ...rect,\n",
          "baseline": "        return { text: button.textContent, ...rect,\n"
        },
        {
          "at": 4607,
          "current": "  assert.equal(geometry.buttons.length, 3, `${label}: all three crime approaches remain available`);\n  assert.deepEqual(new Set(geometry.buttons.map(button => button.approach)), new Set(['quiet', 'standard', 'loud']),\n    `${label}: each crime approach has one reachable control`);\n",
          "baseline": "  assert.equal(geometry.buttons.length, 4, `${label}: all three approaches and optional preparation remain available`);\n"
        },
        {
          "at": 16023,
          "current": "      await page.locator('#ux-action-pocket [data-do^=\"POST /v1/crimes/\"][data-body*=standard]:enabled').waitFor();\n",
          "baseline": "      await page.locator('#ux-action-pocket [data-task-crime]').waitFor();\n"
        },
        {
          "at": 17047,
          "current": "      const action = page.locator('#ux-action-pocket [data-do^=\"POST /v1/crimes/\"][data-body*=standard]:enabled');\n      await action.focus();\n      assert.equal(await action.evaluate(element => element === document.activeElement), true, `${label}: keyboard focus reaches the crime`);\n",
          "baseline": "      const prepare = page.locator('#ux-action-pocket [data-task-crime]');\n      await prepare.focus();\n      assert.equal(await prepare.evaluate(element => element === document.activeElement), true, `${label}: keyboard focus reaches preparation`);\n"
        },
        {
          "at": 17374,
          "current": "      const minigame = page.getByRole('dialog', { name: 'Crack the lock' });\n      await minigame.getByRole('button', { name: 'Enter sequence' }).waitFor();\n      assert.equal(await minigame.getByText('REQUIRED · STREET JOB', { exact: true }).isVisible(), true,\n        `${label}: the crime opens its required minigame`);\n      assert.equal(await minigame.locator('[data-crime-pad]').count(), 4, `${label}: all four lock pins are available`);\n      assert.equal(crimeRequests.length, 0, 'A crime cannot submit before the required minigame ends');\n",
          "baseline": "      const puzzle = page.getByRole('dialog', { name: /Task puzzle/ });\n      await puzzle.getByRole('button', { name: 'Solve and attempt crime' }).waitFor();\n"
        },
        {
          "at": 17964,
          "current": "      await minigame.waitFor({ state: 'detached' });\n      assert.equal(await action.evaluate(element => element === document.activeElement), true, `${label}: cancellation restores crime focus`);\n      await reachableCrimePocket(page, `${label} after minigame cancellation`);\n      assert.equal(crimeRequests.length, 0, 'Cancelling the required minigame never attempts the crime');\n",
          "baseline": "      await puzzle.waitFor({ state: 'detached' });\n      assert.equal(await prepare.evaluate(element => element === document.activeElement), true, `${label}: closing restores preparation focus`);\n      await reachableCrimePocket(page, `${label} after puzzle dismissal`);\n      assert.equal(crimeRequests.length, 0, 'Opening and closing optional preparation never attempts the crime');\n"
        },
        {
          "at": 19572,
          "current": "  assert.equal(await primary.evaluate(element => element === document.activeElement), true, 'The ordinary crime remains keyboard reachable after repeated minigame cancellation and navigation');\n",
          "baseline": "  assert.equal(await primary.evaluate(element => element === document.activeElement), true, 'The ordinary crime remains keyboard reachable after repeated preparation and navigation');\n"
        },
        {
          "at": 19966,
          "current": "  await solveCrimeMinigame(page);\n  const completedAttempt = await ordinaryAttempt;\n  assert.equal(completedAttempt.status(), 200, 'Keyboard activation reaches the real ordinary crime endpoint');\n  const receipt = await completedAttempt.json();\n  assert.equal(receipt.minigame.completed, true, 'The actual crime requires a completed lock');\n  assert.equal(receipt.minigame.mistakes, 0);\n  assert.equal(receipt.minigame.multiplier, 1);\n",
          "baseline": "  assert.equal((await ordinaryAttempt).status(), 200, 'Keyboard activation reaches the real ordinary crime endpoint');\n"
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
        "blob": "f1dc100f0a8cee89da5e4ec593cfdb1bd2e7555f",
        "bytes": 54515,
        "sha256": "18f9a39027c38b64454d6fe3c3332396cee59184f46a795f2a0627edd9c85d38"
      },
      "baseline": {
        "mode": "100644",
        "blob": "59a687d9b7725c6d945f520278b2ca37cd44a278",
        "bytes": 50695,
        "sha256": "a501ecf510237c626bf1508e757027023e8fdb8cdda0483b9e05df8c71abbc03"
      },
      "inverses": [
        {
          "at": 700,
          "current": "import { isDeepStrictEqual, promisify } from 'node:util';\n",
          "baseline": "import { promisify } from 'node:util';\n"
        },
        {
          "at": 23378,
          "current": "  const pendingKeys = ['operationId', 'turnId', 'actionId', 'startedAt',\n    ...(session?.pending?.decisionCallId !== undefined ? ['decisionCallId'] : []),\n    ...(session?.pending?.minigame !== undefined ? ['minigame'] : [])];\n",
          "baseline": ""
        },
        {
          "at": 23684,
          "current": "    exactKeys(session.pending, pendingKeys) &&\n    (session.pending.decisionCallId === undefined || (typeof session.pending.decisionCallId === 'string'\n      && /^[A-Za-z0-9_-]{1,128}$/.test(session.pending.decisionCallId))) &&\n    (session.pending.minigame === undefined || validCrimeMinigame(session.pending.minigame)) &&\n",
          "baseline": "    (exactKeys(session.pending, ['operationId', 'turnId', 'actionId', 'startedAt'])\n      || (exactKeys(session.pending, ['operationId', 'turnId', 'actionId', 'startedAt', 'decisionCallId'])\n        && typeof session.pending.decisionCallId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(session.pending.decisionCallId))) &&\n"
        },
        {
          "at": 40595,
          "current": "function validCrimeMinigame(value) {\n  return value && typeof value === 'object' && !Array.isArray(value)\n    && Object.keys(value).sort().join(',') === 'moves,token'\n    && typeof value.token === 'string' && value.token.length > 0 && value.token.length <= 2048\n    && Array.isArray(value.moves) && value.moves.length <= 64\n    && value.moves.every(move => Number.isInteger(move) && move >= 0 && move <= 3);\n}\n\nasync function prepareCrimeMinigame({ base, fetchImpl, session, action }) {\n  if (action.kind !== 'crime' || action.minigame?.required !== true) return null;\n  const path = action.minigame.challengePath;\n  if (action.minigame.kind !== 'signal-lock' || typeof path !== 'string'\n    || !/^\\/v1\\/crimes\\/[a-z0-9_-]+\\/challenge(?:\\?approach=(?:quiet|standard|loud))?$/.test(path))\n    throw new Error('Agent Alpha received an unsupported crime minigame');\n  const { minigame } = await requestJson(fetchImpl, base, path, { token: session.token });\n  if (minigame?.kind !== 'signal-lock' || minigame.maxMistakes !== 3\n    || !Array.isArray(minigame.rounds) || minigame.rounds.length !== 3\n    || !minigame.rounds.every((round, index) => Array.isArray(round) && round.length === index + 3)\n    || !Number.isFinite(Date.parse(minigame.expiresAt)) || Date.parse(minigame.expiresAt) <= Date.now())\n    throw new Error('Agent Alpha received an invalid crime minigame');\n  // The public signal is the agent's input. Persist its complete trace before\n  // executing the issued action, so a lost acknowledgement cannot reroll it.\n  const submission = { token: minigame.token, moves: minigame.rounds.flat() };\n  if (!validCrimeMinigame(submission)) throw new Error('Agent Alpha received an invalid crime minigame');\n  return submission;\n}\n\n",
          "baseline": ""
        },
        {
          "at": 42726,
          "current": "        ...(pending.decisionCallId !== undefined ? { decisionCallId: pending.decisionCallId } : {}),\n        ...(pending.minigame !== undefined ? { minigame: pending.minigame } : {}) },\n",
          "baseline": "        ...(pending.decisionCallId !== undefined ? { decisionCallId: pending.decisionCallId } : {}) },\n"
        },
        {
          "at": 42940,
          "current": "    const staleTurn = error?.status === 409 && error?.code === 'stale_turn';\n    const staleMinigame = error?.status === 400\n      && ['stale_crime_minigame', 'crime_minigame_required'].includes(error?.code);\n    if (!staleTurn && !staleMinigame) throw error;\n",
          "baseline": "    if (error?.status !== 409 || error?.code !== 'stale_turn') throw error;\n"
        },
        {
          "at": 43400,
          "current": "      errorCode: error.code,\n",
          "baseline": "      errorCode: 'stale_turn',\n"
        },
        {
          "at": 47080,
          "current": "    let turn = await requestJson(fetchImpl, base, '/v1/agent/turn', { token: session.token });\n",
          "baseline": "    const turn = await requestJson(fetchImpl, base, '/v1/agent/turn', { token: session.token });\n"
        },
        {
          "at": 47447,
          "current": "    let action = recommendation.action;\n",
          "baseline": "    const action = recommendation.action;\n"
        },
        {
          "at": 48053,
          "current": "    const minigame = await prepareCrimeMinigame({ base, fetchImpl, session, action });\n    if (minigame) {\n      // The challenge shares the action's hard cadence. Observe final authority\n      // after that wait, before creating any durable or dispatched operation.\n      await waitForCadence(timing, intervalMs);\n      const fresh = await requestJson(fetchImpl, base, '/v1/agent/turn', { token: session.token });\n      const owner = turn.state?.identity, current = fresh.state?.identity;\n      const sameActor = typeof owner?.id === 'string' && owner.id.length > 0\n        && Number.isSafeInteger(owner.generation) && owner.generation >= 1\n        && owner.id === current?.id && owner.generation === current?.generation;\n      if (sameActor && stopAtLevel !== undefined && Number(current.level) >= stopAtLevel)\n        return { status: 'level_reached', actions, level: Number(current.level) };\n      const selected = recommendationOf(fresh, role), next = selected.action;\n      if (!sameActor || !next || !isDeepStrictEqual(\n        [action.id, action.kind, action.method, action.path, action.body, action.cost, action.minigame],\n        [next.id, next.kind, next.method, next.path, next.body, next.cost, next.minigame])) {\n        await appendReport(reportStore, { timestamp: new Date().toISOString(), status: 'refused',\n          errorCode: selected.errorCode || 'crime_action_changed', actionKind: 'crime', actionId: action.id });\n        return { status: 'refused', actions };\n      }\n      turn = fresh; action = next;\n    }\n",
          "baseline": ""
        },
        {
          "at": 49963,
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
    "tools/enterprise-native-questing.js": {
      "current": {
        "mode": "100644",
        "blob": "ec7279f399c0e18ac28b333cacd5b119237198c2",
        "bytes": 27973,
        "sha256": "1dfd95a9148b8348495e69927667375da9e568964e827fdc1ea9a459bbe850d0"
      },
      "baseline": {
        "mode": "100644",
        "blob": "9c96e4e7edacd78cddf9c7f7b1c179e038f43185",
        "bytes": 27732,
        "sha256": "8c54c69eecd9ba81fef7a9d9d1402904d3067c14d59c85875de1e828775592f2"
      },
      "inverses": [
        {
          "at": 15600,
          "current": "  const declaredClosure = declaration.files.map(row => row.file);\n  const exactCurrentClosure = actualClosure.length === declaredClosure.length\n    && actualClosure.every((file, index) => file === declaredClosure[index]);\n  const historicalClosure = exactCurrentClosure ? actualClosure\n    : questingNativeClosure(file => nativeGarageEnterpriseHistoricalInput(file, read(file).canonical));\n  assertNativeGarageEnterpriseClosure(actualClosure, historicalClosure, declaredClosure);\n",
          "baseline": "  const historicalClosure = questingNativeClosure(file => nativeGarageEnterpriseHistoricalInput(file, read(file).canonical));\n  assertNativeGarageEnterpriseClosure(actualClosure, historicalClosure, declaration.files.map(row => row.file));\n"
        }
      ]
    },
    "tools/grand-strategy-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "1d3c362fe5e21dde663b8bd476936d7069a01685",
        "bytes": 16446,
        "sha256": "cfe02ec6f62763980960b912ab6a422164e793d888e03c453fbeb2448a4937ef"
      },
      "baseline": {
        "mode": "100644",
        "blob": "b335f3225ca9e30bdc9c3d9a6f25fc905d76c54e",
        "bytes": 16304,
        "sha256": "144d04856c3986eea90a9f5c3c5ceb43aef9a80c7ea83a7a22343adac3a0fb7c"
      },
      "inverses": [
        {
          "at": 479,
          "current": "// Keep genuine physical admission independent of later historical read projections.\nconst readActualPhysical = fs.readFileSync.bind(fs);\n\n",
          "baseline": ""
        },
        {
          "at": 11294,
          "current": "  try { physical = readActualPhysical(descriptor); } finally { fs.closeSync(descriptor); }\n",
          "baseline": "  try { physical = fs.readFileSync(descriptor); } finally { fs.closeSync(descriptor); }\n"
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
    "tools/native-garage-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "25ac3e910e672cfb9d88cbd16fb93c7ee1202184",
        "bytes": 14654,
        "sha256": "10d488f480edfd0ed9ba990473e208cf8304847448cd8a9e1462932fe66c630c"
      },
      "baseline": {
        "mode": "100644",
        "blob": "c9e269d7b6a08952e9e133357a5d13c5ac6c8368",
        "bytes": 13474,
        "sha256": "52cecfd128ae9cc4a930723465fee9e238a9df22da56d1ec3914ee18cfb0d1e9"
      },
      "inverses": [
        {
          "at": 355,
          "current": "import { CRIME_MINIGAME_SOURCE, CRIME_MINIGAME_GENERATED_FILES, qualifyCrimeMinigameRelease,\n  crimeMinigameHistoricalInput, crimeMinigameHistoricalEntry, crimeMinigameHistoricalRecord } from './crime-minigame-source-compatibility.js';\n\n// Keep genuine physical admission independent of later historical read projections.\nconst readActualPhysical = fs.readFileSync.bind(fs);\n",
          "baseline": ""
        },
        {
          "at": 6705,
          "current": "  const head = git('ls-tree', 'HEAD', '--', file).trim(), rawIndex = git('ls-files', '--stage', '--', file).trim();\n",
          "baseline": "  const head = git('ls-tree', 'HEAD', '--', file).trim(), index = git('ls-files', '--stage', '--', file).trim();\n  assert.equal(head, entry(file, pin, 'tree'), 'Genuine current HEAD must equal reviewed native successor');\n  assert.equal(index, entry(file, pin, 'index'), 'Genuine stage-zero index must equal reviewed native successor');\n"
        },
        {
          "at": 7100,
          "current": "  let rawPhysical;\n  try { rawPhysical = readActualPhysical(descriptor); } finally { fs.closeSync(descriptor); }\n  const rawCommitted = execFileSync('git', ['--no-replace-objects', 'show', 'HEAD:' + file], {\n",
          "baseline": "  let physical;\n  try { physical = fs.readFileSync(descriptor); } finally { fs.closeSync(descriptor); }\n  const committed = execFileSync('git', ['--no-replace-objects', 'show', 'HEAD:' + file], {\n"
        },
        {
          "at": 7366,
          "current": "  const match = head.match(/^(100644|100755) blob ([a-f0-9]{40})\\t/);\n  assert(match, 'Regular genuine current native source required');\n  const actual = crimeMinigameHistoricalRecord(file, { head: { mode: match[1], blob: match[2] },\n    index: rawIndex, committed: rawCommitted, physical: rawPhysical, regular: true, symbolic: false });\n  const { index, committed, physical } = actual;\n  assert.equal(entry(file, actual.head, 'tree'), entry(file, pin, 'tree'), 'Genuine current HEAD must equal reviewed native successor');\n  assert.equal(index, entry(file, pin, 'index'), 'Genuine stage-zero index must equal reviewed native successor');\n",
          "baseline": ""
        },
        {
          "at": 8474,
          "current": "  return actual;\n",
          "baseline": "  return { head: { mode: pin.mode, blob: pin.blob }, index, committed, physical,\n    regular: true, symbolic: false };\n"
        },
        {
          "at": 9284,
          "current": "  input = crimeMinigameHistoricalInput(file, input);\n",
          "baseline": ""
        },
        {
          "at": 9749,
          "current": "  input = crimeMinigameHistoricalInput(file, input);\n",
          "baseline": ""
        },
        {
          "at": 10212,
          "current": "  input = crimeMinigameHistoricalEntry(file, input, kind);\n",
          "baseline": ""
        },
        {
          "at": 10661,
          "current": "  actual = crimeMinigameHistoricalRecord(file, actual);\n",
          "baseline": ""
        },
        {
          "at": 13545,
          "current": "  const successor = new Set([...Object.keys(CRIME_MINIGAME_SOURCE.files), ...Object.keys(CRIME_MINIGAME_SOURCE.additions),\n    ...CRIME_MINIGAME_GENERATED_FILES]);\n  assert(after.every(file => excluded.has(file) || successor.has(file)), 'Only fixed independently generated domains or the exact sealed crime successor may follow the native source candidate');\n  qualifyCrimeMinigameRelease();\n",
          "baseline": "  assert(after.every(file => excluded.has(file)), 'Only fixed independently generated domains may follow the native source candidate');\n"
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
    "tools/rc1-postgres-client.sh": {
      "current": {
        "mode": "100644",
        "blob": "d40451fd2cbf390c2aa53cdfb99d9667ccd7dda5",
        "bytes": 1467,
        "sha256": "fa562d1f99324f47ba75b4263dfce4ee50b0f267195c245efb58f0d8665132c1"
      },
      "baseline": {
        "mode": "100644",
        "blob": "443beb37131894a480062992d2344714203f559c",
        "bytes": 1375,
        "sha256": "b7ece65c49a874bdb7a0d724bf2f475eeb1cae2fecf3b21902e9a882eaf53e6b"
      },
      "inverses": [
        {
          "at": 620,
          "current": "    --connect-timeout 15 --max-time 120 --retry 3 --retry-all-errors --retry-max-time 180 \\\n",
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
      "blob": "f8881422b4c18aadcfc95c40b901be10adf26de1",
      "bytes": 4819,
      "sha256": "f7c1731e5fd612b93f903886693c041232b3707428cbba33fafe75c8ad8dfc4c"
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
      "blob": "43e51da3794610967b76c2ec59f9c40e5922b680",
      "bytes": 8495,
      "sha256": "710723a7e07d04671c16ad98c1f794c0fa264c1f1f22e0186798cf139e7d485d"
    },
    "test/crime-minigame-source-transfer.js": {
      "mode": "100644",
      "blob": "346942434315f4b096a171af5a70b452ee7f5f57",
      "bytes": 10754,
      "sha256": "f4cb006c8a728332b84716cf7dd37b5a20a982f62577a2a177b090bbde45cbb0"
    },
    "test/crime-minigame.js": {
      "mode": "100644",
      "blob": "ea5981b52ba9c012a2f47c19d7fb5f50855cc13b",
      "bytes": 10449,
      "sha256": "0c12adf8fdb67673e954b38478f5a069713a86f5d936f57df4624e5b64ffd62d"
    },
    "tools/crime-minigame-client.js": {
      "mode": "100644",
      "blob": "15652a33847158fc6aa1217b4d817fee56c61297",
      "bytes": 943,
      "sha256": "a7a660f226d7367b11b4da9161a6f43bd71f641b406e330a5ff80804983af810"
    },
    "tools/crime-minigame-source-compatibility.js": {
      "mode": "100644",
      "blob": "8da20d0ae4151ec497cb72d074c8c1197aac56e7",
      "bytes": 10137,
      "sha256": "66bb326130ac91b3e2681bfa1245ad69e0c2095d50cc15b74217ef839609904b"
    },
    "tools/seal-crime-minigame-source.js": {
      "mode": "100644",
      "blob": "6553304c8eb5f85c59d991e32788e824379d3de8",
      "bytes": 3913,
      "sha256": "616ff2f8be589da27e309f693eaa964e988fde92e7a6505f484d28b127cf1358"
    }
  }
});
export const CRIME_MINIGAME_SOURCE_SHA256 = 'a6684e6da7f2b47a0b0bc0344e2ef0b34d799490ae0a73fd388ee02f939c70e5';
