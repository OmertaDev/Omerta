// Generated from immutable authored Git objects; no runtime or native admission.
export const recoverySource = {
  "status": "SEALED",
  "phase": "EXACT_CI_DEED_RECOVERY_COMPARISON_ONLY",
  "revision": "3707e8226ed5d66cc69798fdb153b8354ccfc531",
  "tree": "53f0292db8c95d897460a9d40a885897eddffb81",
  "predecessor": "0ce6ab96a34e6061232980ad60bfdbc94cf98fdb",
  "predecessorTree": "f28465d0caa595f199d0161d13039e52bac3de32",
  "files": {
    ".github/workflows/ci.yml": {
      "current": {
        "mode": "100644",
        "blob": "b3e1bba6a4064d39397cc1c6b54e425d08c4d49d",
        "sha256": "82d4545f3edde5a66e2eba38706ebd22b16c66a157709f1dc93fddcd24f9ffcb",
        "bytes": 72681
      },
      "baseline": {
        "mode": "100644",
        "blob": "c9de23a56b9e1334507d62a0657637e1a558c841",
        "sha256": "6e8485d145c7afa2d293c701cdc726010e88837c1a67a67a2a99e3e28ded4876",
        "bytes": 72492
      },
      "inverses": [
        {
          "at": 1965,
          "current": "Post-merge run 42131536154 passed\n    # the complete npm lifecycle in 134m45s, then reached this enclosing 150m bound\n    # while the additional worker harness was still passing. Retain this finite\n    # lifecycle bound and run every additional command in its own bounded job.\n    # Both browser jobs require both jobs; all native and browser bounds remain",
          "baseline": "The corrected full local npm lifecycle\n    # (pretest + test) completed in 2294.9825838s (38m14.983s) on Windows/Node 24.19.0,\n    # including the new 100-seed x 250-action property lane in 804.7s. The prior hosted\n    # Ubuntu/Node 22 suites job completed in 1295s before that lane existed; timing for the\n    # expanded suite on the hosted runtime is now measured at 45m45s (candidate748).\n    # Hosted run 38199373348 completed npm test in 55m11s, then hit the enclosing 60m\n    # bound before simulations. Run 38194172207 measured another 5m41s after npm test.\n    # Exact c66 pull-request run38757871584 reached75m while still passing the\n    # commercial memory proofs; all commands below remain required. Give the\n    # expanded lifecycle a finite120m hang bound; this is not a measured duration.\n    # Browser and native PostgreSQL bounds and all proof assertions are unchanged"
        },
        {
          "at": 5934,
          "current": "  suite_tail:\n    name: worker harness + economy simulations\n    needs: suites\n    runs-on: ubuntu-latest\n    # Preserve the complete post-lifecycle command order without spending the\n    # 150m lifecycle budget twice. This is a finite hang bound, not a speed target.\n    timeout-minutes: 45\n    steps:\n      - uses: actions/checkout@v7\n        with:\n          fetch-depth: 0\n      - uses: actions/setup-node@v7\n        with:\n          node-version: '22'\n          cache: npm\n      - run: npm ci\n      - uses: foundry-rs/foundry-toolchain@v1\n        with:\n          version: v1.7.1\n      - name: Compile original funded-work escrow artifact\n        run: npm run build:funded-work-artifact\n\n",
          "baseline": ""
        },
        {
          "at": 7859,
          "current": "[suites, suite_tail]",
          "baseline": "suites"
        },
        {
          "at": 10903,
          "current": "[suites, suite_tail]",
          "baseline": "suites"
        }
      ]
    },
    "package.json": {
      "current": {
        "mode": "100644",
        "blob": "a1b0d500f9376dace81fcec9e2d6d78fcfb265f3",
        "sha256": "0a897a337894320df10d31f67d64c49d8f810aa3f36bad9c3e4c0dde3f17c75c",
        "bytes": 61095
      },
      "baseline": {
        "mode": "100644",
        "blob": "2ba16a679f284ba94ca9957045607b4dd3bb4509",
        "sha256": "18794e721e0c6ac8797266a12e41fccb53c74df19af6b3634897d99e1260976d",
        "bytes": 61055
      },
      "inverses": [
        {
          "at": 11043,
          "current": " && node test/ci-deed-recovery-source.js",
          "baseline": ""
        }
      ]
    },
    "public/index.html": {
      "current": {
        "mode": "100644",
        "blob": "ec86b4cd66b34ceca1d9f0739cc8579a122d843f",
        "sha256": "54b01e88f6a2314a620e9e98cad60e55e562045dee2fdd9901d7f87858b21e91",
        "bytes": 1404226
      },
      "baseline": {
        "mode": "100644",
        "blob": "8bf91d981ed41b573b19b59ca61d9b0a2e95aa96",
        "sha256": "9e4a8c2889e7fef7f3d9ddda6e2737b17b8df4489c68171df082cfe9bb3ad226",
        "bytes": 1404170
      },
      "inverses": [
        {
          "at": 858363,
          "current": "${acting ? ' disabled' : ''}>travel to ${esc(districtName(requiredDistrict))} — $${Number(rules.travelCost).toLocaleString()}</button>` : ''}` : ''}\n          ${entry.canInvestigate && objective?.canAct && objective.actionId && !p.claimed && !entry.claimed && !discovery.primaryClaimed ? `<button class=\"act\" id=\"deed-investigate\"${acting ? ' disabled' : ''}",
          "baseline": ">travel to ${esc(districtName(requiredDistrict))} — $${Number(rules.travelCost).toLocaleString()}</button>` : ''}` : ''}\n          ${entry.canInvestigate && objective?.canAct && objective.actionId && !p.claimed && !entry.claimed && !discovery.primaryClaimed ? `<button class=\"act\" id=\"deed-investigate\""
        }
      ]
    },
    "test/deed-discovery-ui.js": {
      "current": {
        "mode": "100644",
        "blob": "ff4f07eddf62e76a5bc18cb5ce79ef89c947d9b7",
        "sha256": "ad23080d0e40f0fa9c404a34cbb183cc25f13c47d4af91b0b9e6af8bd5c1b19d",
        "bytes": 19895
      },
      "baseline": {
        "mode": "100644",
        "blob": "df11c698911449bf8f5f2a2cc8223f67c9dd574d",
        "sha256": "bb7dd6ac190f5f62ff18b9050a7e362c59dfd0ec0017475ac5d11e59bdec0bea",
        "bytes": 18685
      },
      "inverses": [
        {
          "at": 7077,
          "current": "  async function assertPendingControl(selector, actionPath) {\n    const writesBeforePending = await page.evaluate(path => calls.filter(call => call.method === 'POST' && call.path === path).length, actionPath);\n    await page.evaluate(async () => {acting=true;await renderDeeds({district:'brick',buildingId:'brick-0001'});});\n    assert.equal(await page.locator(selector).isDisabled(), true,\n      'A background render cannot publish an enabled ' + selector + ' while the prior action is pending.');\n    await page.locator(selector).evaluate(control => control.click());\n    assert.equal(await page.evaluate(path => calls.filter(call => call.method === 'POST' && call.path === path).length, actionPath), writesBeforePending,\n      'A pending action cannot dispatch another property action.');\n    await page.evaluate(async () => {acting=false;await renderDeeds({district:'brick',buildingId:'brick-0001'});});\n    assert.equal(await page.locator(selector).isEnabled(), true,\n      'The completed-action refresh restores the current property action.');\n  }\n  await assertPendingControl('#deed-investigate', '/v1/deeds/investigate');\n",
          "baseline": ""
        },
        {
          "at": 8840,
          "current": "  await assertPendingControl('#deed-objective-travel', '/v1/travel/cathedral');\n",
          "baseline": ""
        }
      ]
    },
    "test/gates.js": {
      "current": {
        "mode": "100644",
        "blob": "596804945d5f76204ba1162fc6dea2dc949cf083",
        "sha256": "d44e9b7989fc5d43cdd94794af87af075fa980408310535554dd5f0667e867ac",
        "bytes": 465450
      },
      "baseline": {
        "mode": "100644",
        "blob": "8a3170caa9f8274320e48fb1f8b5d6eb236cdc4a",
        "sha256": "c895928b8bae367cdf5deeab34bfb4fc8468f23ec92510577a40a2556d95697e",
        "bytes": 462256
      },
      "inverses": [
        {
          "at": 350326,
          "current": "suite_tail', 'browser', 'ux_browser', 'pgcheck_core', 'pgcheck_economy', 'pgcheck_enterprise', 'pgcheck_commerce', 'pgcheck'],\n    '.github/workflows/ci.yml must retain suites, its complete bounded tail",
          "baseline": "browser', 'ux_browser', 'pgcheck_core', 'pgcheck_economy', 'pgcheck_enterprise', 'pgcheck_commerce', 'pgcheck'],\n    '.github/workflows/ci.yml must retain suites"
        },
        {
          "at": 350812,
          "current": "  const suiteTail = jobs.get('suite_tail').replaceAll('\\r\\n', '\\n');\n",
          "baseline": ""
        },
        {
          "at": 374677,
          "current": "[suites, suite_tail]",
          "baseline": "suites"
        },
        {
          "at": 375644,
          "current": "[suites, suite_tail]', '    needs: suites'), expectedUxBrowser.replace('    steps:', '    if: false\\n    steps:",
          "baseline": "suites', '    needs: suites\\n    if: false"
        },
        {
          "at": 377003,
          "current": "expectedSuiteTail = \"  suite_tail:\\n    name: worker harness + economy simulations\\n    needs: suites\\n    runs-on: ubuntu-latest\\n    timeout-minutes: 45\\n    steps:\\n      - uses: actions/checkout@v7\\n        with:\\n          fetch-depth: 0\\n      - uses: actions/setup-node@v7\\n        with:\\n          node-version: '22'\\n          cache: npm\\n      - run: npm ci\\n      - uses: foundry-rs/foundry-toolchain@v1\\n        with:\\n          version: v1.7.1\\n      - name: Compile original funded-work escrow artifact\\n        run: npm run build:funded-work-artifact\\n      - name: Invite-only launch admission and Crew allowance\\n        run: npm run test:invites\\n      - name: RC1 telemetry isolation and complementary campaign regressions\\n        run: npm run test:rc1\\n      - name: RC1 private command diagnostics and passive confirmation regression\\n        run: npm run test:rc1:observability\\n      - name: RC1 original worker scheduling and diagnostic harness controls\\n        run: npm run test:rc1:harness\\n      - name: economy sim (§10.4 drift-0)\\n        run: npm run sim\\n      - name: scale (population-scale market reachability + §10.4)\\n        env:\\n          SCALE_PLAYERS: '18'\\n          SCALE_DAYS: '2'\\n        run: npm run scale\";\n  const requireSuiteTail = block => assert.equal(nativeShape(block), expectedSuiteTail,\n    'Every tail setup, prerequisite, complete command and scale value is unconditional and exact');\n  requireSuiteTail(suiteTail);\n  for (const changed of [suiteTail.replace('needs: suites', 'needs: []'),\n    suiteTail.replace('    steps:', '    if: false\\n    steps:'),\n    suiteTail.replace('    steps:', '    continue-on-error: true\\n    steps:'),\n    suiteTail.replace('timeout-minutes: 45', 'timeout-minutes: 0'),\n    suiteTail.replace('timeout-minutes: 45', 'timeout-minutes: 150'),\n    suiteTail.replace(\"SCALE_PLAYERS: '18'\", \"SCALE_PLAYERS: '1'\"),\n    suiteTail.replace('fetch-depth: 0', 'fetch-depth: 1'),\n    suiteTail.replace('run: npm run test:rc1:harness', 'if: false\\n        run: npm run test:rc1:harness')]) {\n    assert.notEqual(changed, suiteTail, 'Each negative tail control changes its target');\n    assert.throws(() => requireSuiteTail(changed), 'Skipped, partial, duplicate or unbounded tails reject');\n  }\n  const tailCommands = ['npm run test:invites', 'npm run test:rc1', 'npm run test:rc1:observability', 'npm run test:rc1:harness', 'npm run sim', 'npm run scale'];\n  for (const command of ['npm test', ...tailCommands]",
          "baseline": "suitesCommands = ['npm test', 'npm run sim', 'npm run scale'];\n  for (const command of suitesCommands"
        },
        {
          "at": 379570,
          "current": "const count = block => [...block.matchAll(new RegExp(`^\\\\s+run: ${escaped}\\\\s*$`, 'gm'))].length;\n    assert.equal(count(suites), command === 'npm test' ? 1 : 0,\n      `the lifecycle job owns only npm test; tail command \\`${command}\\` must not run twice`);\n    assert.equal(count(suiteTail), command === 'npm test' ? 0 : 1,\n      `the bounded tail must run \\`${command}\\` exactly once without repeating npm test`);\n  }\n  for (const command of tailCommands) {\n    for (const replacement of ['', command + ' -- --partial', command + '\\n        run: ' + command])\n      assert.throws(() => requireSuiteTail(suiteTail.replace('run: ' + command + '\\n', 'run: ' + replacement + '\\n')),\n        'Missing, partial or duplicated required tail commands reject'",
          "baseline": "assert.equal([...suites.matchAll(new RegExp(`^\\\\s+run: ${escaped}\\\\s*$`, 'gm'))].length, 1,\n      `the \\`suites\\` job must run \\`${command}\\` exactly once`"
        },
        {
          "at": 380875,
          "current": "[suites, suite_tail]",
          "baseline": "suites"
        }
      ]
    },
    "test/businessdesk-combined-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "a1f1f5fcfa8272c4c9b378960b44ee0e1048ab31",
        "sha256": "9ddcdb388c85a6dbc7a49e465354d1ac59d8bc8bfd06b18a00ed01c6970b4e4c",
        "bytes": 19530
      },
      "baseline": {
        "mode": "100644",
        "blob": "562eaecf214645f72b8863d5863dabfce4a9a621",
        "sha256": "49e8fca0a4228c49fff3aaa056feb648e6c32226de22ccb60be859c546894c53",
        "bytes": 19252
      },
      "inverses": [
        {
          "at": 267,
          "current": "import { ciDeedRecoveryHistoricalInput, ciDeedRecoveryHistoricalEntry, ciDeedRecoveryHistoricalRecord } from '../tools/ci-deed-recovery-source-transfer.js';\n",
          "baseline": ""
        },
        {
          "at": 7280,
          "current": "ciDeedRecoveryHistoricalRecord(file, record('HEAD', file)",
          "baseline": "record('HEAD', file"
        },
        {
          "at": 7595,
          "current": "ciDeedRecoveryHistoricalEntry(file, text('ls-files', '--stage', '--', file), 'index'",
          "baseline": "text('ls-files', '--stage', '--', file"
        },
        {
          "at": 7960,
          "current": "ciDeedRecoveryHistoricalInput(file, fs.readFileSync(file)",
          "baseline": "fs.readFileSync(file"
        }
      ]
    },
    "test/businessdesk-noir-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "f08929adbf3d345de1831556b437269d6b0b3f03",
        "sha256": "fe9c907d03c20612e436263c44845fb896971531dd52963544eb6cd64d30c600",
        "bytes": 20822
      },
      "baseline": {
        "mode": "100644",
        "blob": "3651323b637b6c0a22b752ec74394b9e90722df8",
        "sha256": "f0116326192e2a64bef522334dd4ae7f7f577e116d585f3226556b2af4f45cc7",
        "bytes": 20532
      },
      "inverses": [
        {
          "at": 470,
          "current": "import { ciDeedRecoveryHistoricalInput, ciDeedRecoveryHistoricalEntry } from '../tools/ci-deed-recovery-source-transfer.js';\n",
          "baseline": ""
        },
        {
          "at": 2677,
          "current": "ciDeedRecoveryHistoricalEntry(file, git('ls-tree', 'HEAD', '--', file), 'tree').trim(), authoredEntry, 'Actual HEAD mode/blob qualifies before projection');\n  assert.equal(ciDeedRecoveryHistoricalEntry(file, git('ls-files', '--stage', '--', file), 'index'",
          "baseline": "git('ls-tree', 'HEAD', '--', file).trim(), authoredEntry, 'Actual HEAD mode/blob qualifies before projection');\n  assert.equal(git('ls-files', '--stage', '--', file"
        },
        {
          "at": 3139,
          "current": "ciDeedRecoveryHistoricalInput(file, git('show', 'HEAD:' + file)",
          "baseline": "git('show', 'HEAD:' + file"
        },
        {
          "at": 3366,
          "current": "ciDeedRecoveryHistoricalInput(file, fs.readFileSync(file)",
          "baseline": "fs.readFileSync(file"
        }
      ]
    },
    "test/businessdesk-native-provenance.js": {
      "current": {
        "mode": "100644",
        "blob": "72a7b5ddb1ec96062de37949e0d3f60cb946ab68",
        "sha256": "b3f9ee47bde9fb52cd8741681fdef4c231e3b4c475bb51b43b72e0f63652893c",
        "bytes": 11685
      },
      "baseline": {
        "mode": "100644",
        "blob": "171b81eb8cce5fe10961c667ee8fe01598afa3fb",
        "sha256": "d7b64097e0c5a964339188aa1c5c200d57e8330886e9949219ab4b8b7a449b3f",
        "bytes": 11410
      },
      "inverses": [
        {
          "at": 4465,
          "current": "let successorRefusals = 0;\n",
          "baseline": ""
        },
        {
          "at": 9814,
          "current": "const successorBytesDiffer = activeRow.blob !== expected.blob;\nif (successorBytesDiffer) {\n  assert.throws(() => assertEnterpriseUxTrackedInput(file, current, authored, parentBytes));\n  successorRefusals++;\n}",
          "baseline": "if (activeRow.blob !== expected.blob) reject(() => assertEnterpriseUxTrackedInput(file, current, authored, parentBytes));"
        },
        {
          "at": 11133,
          "current": "assert.equal(successorRefusals, Number(successorBytesDiffer), 'Changed actual successor bytes additionally reject the frozen parent bytes.');\nconsole.log(JSON.stringify({ phase: 'BUSINESS_DESK_CURRENT_NATIVE_PROVENANCE_SOURCE_GUARDS', applicable, refusals, successorR",
          "baseline": "console.log(JSON.stringify({ phase: 'BUSINESS_DESK_CURRENT_NATIVE_PROVENANCE_SOURCE_GUARDS', applicable, r"
        }
      ]
    },
    "test/economy-deed-merge-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "cc912f83d1d6719cb1c720478e57d3d04242122c",
        "sha256": "861fc568140e637000828e375562894d5f42bb9c578f754d4a7d1a95b0c8b8ff",
        "bytes": 17330
      },
      "baseline": {
        "mode": "100644",
        "blob": "a0dd6bf3147cbf4f1fb4045ec545490d31b7f481",
        "sha256": "eb7e2842654d95b44e086cb627443678694a7c42f4d307a9da837997eeb0a636",
        "bytes": 17040
      },
      "inverses": [
        {
          "at": 463,
          "current": "import { ciDeedRecoveryHistoricalInput, ciDeedRecoveryHistoricalEntry } from '../tools/ci-deed-recovery-source-transfer.js';\n",
          "baseline": ""
        },
        {
          "at": 3968,
          "current": "ciDeedRecoveryHistoricalEntry(file, git('ls-tree', 'HEAD', '--', file), 'tree').trim(), authoredEntry, 'Actual HEAD mode/blob qualifies before projection');\n  assert.equal(ciDeedRecoveryHistoricalEntry(file, git('ls-files', '--stage', '--', file), 'index'",
          "baseline": "git('ls-tree', 'HEAD', '--', file).trim(), authoredEntry, 'Actual HEAD mode/blob qualifies before projection');\n  assert.equal(git('ls-files', '--stage', '--', file"
        },
        {
          "at": 4430,
          "current": "ciDeedRecoveryHistoricalInput(file, git('show', 'HEAD:' + file)",
          "baseline": "git('show', 'HEAD:' + file"
        },
        {
          "at": 4657,
          "current": "ciDeedRecoveryHistoricalInput(file, fs.readFileSync(file)",
          "baseline": "fs.readFileSync(file"
        }
      ]
    },
    "test/wiki-media-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "67c02ea9426635cbfd4f27fbceea930723e4b84d",
        "sha256": "c0813574c50432b1f8b9ba7136ddfe494933bdbd21b60abd40e391ec9778f34f",
        "bytes": 26397
      },
      "baseline": {
        "mode": "100644",
        "blob": "8f9e14b9c702db7ed5bc94ae335311fd06e0a688",
        "sha256": "c7d1bc79087cd7af810a1c2d68a7cfe1df6687253692ffe54d4a5788af365a21",
        "bytes": 26107
      },
      "inverses": [
        {
          "at": 479,
          "current": "import { ciDeedRecoveryHistoricalInput, ciDeedRecoveryHistoricalEntry } from '../tools/ci-deed-recovery-source-transfer.js';\n",
          "baseline": ""
        },
        {
          "at": 1864,
          "current": "ciDeedRecoveryHistoricalEntry(file, git('ls-tree', 'HEAD', '--', file), 'tree').trim(), authoredEntry, 'Actual HEAD mode/blob qualifies before projection');\n  assert.equal(ciDeedRecoveryHistoricalEntry(file, git('ls-files', '--stage', '--', file), 'index'",
          "baseline": "git('ls-tree', 'HEAD', '--', file).trim(), authoredEntry, 'Actual HEAD mode/blob qualifies before projection');\n  assert.equal(git('ls-files', '--stage', '--', file"
        },
        {
          "at": 2326,
          "current": "ciDeedRecoveryHistoricalInput(file, git('show', 'HEAD:' + file)",
          "baseline": "git('show', 'HEAD:' + file"
        },
        {
          "at": 2553,
          "current": "ciDeedRecoveryHistoricalInput(file, fs.readFileSync(file)",
          "baseline": "fs.readFileSync(file"
        }
      ]
    },
    "test/deed-allocation-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "ac5dbc7e3562d9c40a813734537e44a26e2097fc",
        "sha256": "877ec4794aab533ba1fab5d522ecedbc3b8209c7ad2950d5682802de80b2d96d",
        "bytes": 20643
      },
      "baseline": {
        "mode": "100644",
        "blob": "80947aa1a1d22b28f3bd499e71851a9e8672ac58",
        "sha256": "2c1301ea7deccb7935e9c69b18ae1d3659641c1035793853425efec02bb02583",
        "bytes": 20243
      },
      "inverses": [
        {
          "at": 407,
          "current": "import { ciDeedRecoveryHistoricalInput, ciDeedRecoveryHistoricalEntry } from '../tools/ci-deed-recovery-source-transfer.js';\n",
          "baseline": ""
        },
        {
          "at": 5782,
          "current": "ciDeedRecoveryHistoricalInput(file, rawPhysical)",
          "baseline": "rawPhysical"
        },
        {
          "at": 13979,
          "current": "ciDeedRecoveryHistoricalInput(file,fs.readFileSync(file,'utf8')), head=ciDeedRecoveryHistoricalInput(file,git('show','HEAD:'+file)",
          "baseline": "fs.readFileSync(file,'utf8'), head=git('show','HEAD:'+file"
        },
        {
          "at": 14240,
          "current": "ciDeedRecoveryHistoricalEntry(file,git('ls-tree','HEAD','--',file),'tree'",
          "baseline": "git('ls-tree','HEAD','--',file"
        },
        {
          "at": 18917,
          "current": "ciDeedRecoveryHistoricalEntry(file,git('ls-tree','HEAD','--',file),'tree').trim(),git('ls-tree',integration.revision,'--',file).trim());\n    assert.equal(ciDeedRecoveryHistoricalEntry(file,git('ls-files','--stage','--',file),'index'",
          "baseline": "git('ls-tree','HEAD','--',file).trim(),git('ls-tree',integration.revision,'--',file).trim());\n    assert.equal(git('ls-files','--stage','--',file"
        },
        {
          "at": 19310,
          "current": "ciDeedRecoveryHistoricalInput(file,fs.readFileSync(file)",
          "baseline": "fs.readFileSync(file"
        }
      ]
    },
    "test/economy-monitor-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "9c3267026cd672948a3bd09ce1bbb624c87c515b",
        "sha256": "1776b4995643464207c0c7db5e911808800ef7d66cd283cf6ed64ea8e6971812",
        "bytes": 17558
      },
      "baseline": {
        "mode": "100644",
        "blob": "fe5c7265715f57da19f70681775ba2bfab9e2181",
        "sha256": "311a9c3cf88d2e8d55db80a3c819f29cd1ffac28048a60966aaf58863c1c792e",
        "bytes": 17268
      },
      "inverses": [
        {
          "at": 289,
          "current": "import { ciDeedRecoveryHistoricalInput, ciDeedRecoveryHistoricalEntry } from '../tools/ci-deed-recovery-source-transfer.js';\n",
          "baseline": ""
        },
        {
          "at": 2443,
          "current": "ciDeedRecoveryHistoricalEntry(file, git('ls-tree', 'HEAD', '--', file), 'tree'",
          "baseline": "git('ls-tree', 'HEAD', '--', file"
        },
        {
          "at": 2769,
          "current": "ciDeedRecoveryHistoricalEntry(file, git('ls-files', '--stage', '--', file), 'index').trim(), entry.replace(' blob ', ' ').replace('\\t', ' 0\\t'));\n  const committed = ciDeedRecoveryHistoricalInput(file, git('show', 'HEAD:' + file)), raw = ciDeedRecoveryHistoricalInput(file, fs.readFileSync(file)",
          "baseline": "git('ls-files', '--stage', '--', file).trim(), entry.replace(' blob ', ' ').replace('\\t', ' 0\\t'));\n  const committed = git('show', 'HEAD:' + file), raw = fs.readFileSync(file"
        }
      ]
    },
    "tools/integrated-economic-parent-source.js": {
      "current": {
        "mode": "100644",
        "blob": "6d08dedb9e81cba3f15bcc4826784c113eeb59c2",
        "sha256": "937da67caaa21d76df90300eca5729f92530d8265ab907a4d2b88c4e90bfa504",
        "bytes": 2328
      },
      "baseline": {
        "mode": "100644",
        "blob": "b2e07313e80fc0957e33cf38337a6476d36124f4",
        "sha256": "e739f7cee4b829b234fbfaddf5a631cc704bfec7593cb59272e0ee3d1808c26f",
        "bytes": 2187
      },
      "inverses": [
        {
          "at": 281,
          "current": "import { ciDeedRecoveryHistoricalInput } from './ci-deed-recovery-source-transfer.js';\n",
          "baseline": ""
        },
        {
          "at": 1466,
          "current": "  input = ciDeedRecoveryHistoricalInput(file, input);\n",
          "baseline": ""
        }
      ]
    },
    "tools/combined-economic-deed-source-transfer.js": {
      "current": {
        "mode": "100644",
        "blob": "ca96b16bb666aac155adcc0748569dc8b8219aca",
        "sha256": "5145722699b84ca6cac80a19521c3c101b06d011312cd9259d632426d96f1d25",
        "bytes": 2635
      },
      "baseline": {
        "mode": "100644",
        "blob": "9703794ff3c40da58629805c3d72ce83a85154ef",
        "sha256": "9c023f08ee4ce43b32fd94552d8ba92594e99fc3181e2c587945e0c9650a8c09",
        "bytes": 2494
      },
      "inverses": [
        {
          "at": 344,
          "current": "import { ciDeedRecoveryHistoricalInput } from './ci-deed-recovery-source-transfer.js';\n",
          "baseline": ""
        },
        {
          "at": 1253,
          "current": "  input = ciDeedRecoveryHistoricalInput(file, input);\n",
          "baseline": ""
        }
      ]
    },
    "tools/enterprise-native-ux.js": {
      "current": {
        "mode": "100644",
        "blob": "0d7043216e99f6bb24fd820ed43ce52bd1a44106",
        "sha256": "607fee9bbd5ff8afaef5fc5af06e93c6ce28e261fd02ef242047c571d52eb200",
        "bytes": 21087
      },
      "baseline": {
        "mode": "100644",
        "blob": "a38cc7c689453a6fe050e210c5717c0bcf333292",
        "sha256": "97118ab64a10a710fd8715fca4183d34be1755dcc62ec0712129a12b08cd69fe",
        "bytes": 21005
      },
      "inverses": [
        {
          "at": 2888,
          "current": " \"test/ci-deed-recovery-source.js\",\n \"tools/generate-ci-deed-recovery-source.js\",\n",
          "baseline": ""
        }
      ]
    },
    "tools/economy-ux-merge-source-compatibility.js": {
      "current": {
        "mode": "100644",
        "blob": "cc89a78ef70738e57ab95492893e7e43919c1f6b",
        "sha256": "d4e9df92035a55b4c0915b530e8884e7d899bbc9615d4b0a719e6b826fb20510",
        "bytes": 48281
      },
      "baseline": {
        "mode": "100644",
        "blob": "32f2d4fa4df42b2865d7c75ed4a67df5263695a9",
        "sha256": "5b6bdb2df698198b5083e69e8a56f685a4f620e3405d36a7be320a046457324b",
        "bytes": 48000
      },
      "inverses": [
        {
          "at": 76,
          "current": "import { ciDeedRecoveryHistoricalInput } from './ci-deed-recovery-source-transfer.js';\n",
          "baseline": ""
        },
        {
          "at": 45508,
          "current": "  if (ECONOMY_UX_MERGE_FILES.includes(file)) input = ciDeedRecoveryHistoricalInput(file, input);\n",
          "baseline": ""
        },
        {
          "at": 46762,
          "current": "  if (ECONOMY_UX_MERGE_FILES.includes(file)) input = ciDeedRecoveryHistoricalInput(file, input);\n",
          "baseline": ""
        }
      ]
    },
    "SPEC.md": {
      "current": {
        "mode": "100644",
        "blob": "b6b2112baf264466eae5742e34d78fdb9cd151af",
        "sha256": "3bd0bf3ca7036743af5989fad714199b620de8b10ef207533df86c9b30e548b5",
        "bytes": 57077
      },
      "baseline": {
        "mode": "100644",
        "blob": "6848cba281d30a27dfedca01b7ac8f53f6e3fe9c",
        "sha256": "0591dcb9ae261fcabaf9be2c1cacbfdacbd834adadf2f2ecb7e41c21a5c0eecc",
        "bytes": 57077
      },
      "inverses": [
        {
          "at": 506,
          "current": "3** files, **205948",
          "baseline": "2** files, **205772"
        }
      ]
    },
    "MARKETING-POSTS.md": {
      "current": {
        "mode": "100644",
        "blob": "ea6d4ccdd2281531411af28c458c883bfa74fc85",
        "sha256": "87585d7c3ebc2c34131d38c40fa273ec4ce892db1c58998c4f7212326fb4bbe9",
        "bytes": 7062
      },
      "baseline": {
        "mode": "100644",
        "blob": "989796d7b5c64fe60a44c6448384fa760a5497fc",
        "sha256": "5ee66cb1aeb501cd3e6b0fa9c65059e26349b90ed23bb49ba0b59c9f42793dfb",
        "bytes": 7062
      },
      "inverses": [
        {
          "at": 2712,
          "current": "3",
          "baseline": "2"
        }
      ]
    }
  }
};
