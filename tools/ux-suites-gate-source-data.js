// Exact suites-gate bound source envelope; source-only, no native/runtime/deployment clearance.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const UX_SUITES_GATE_SOURCE = freeze({
  "version": 1,
  "status": "SEALED",
  "phase": "EXACT_UX_SUITES_GATE_SOURCE_ONLY",
  "revision": "e3fac975f358543c57dda5109dddcf585602e56d",
  "tree": "f7359d3fc4eef3f5dd525ce25585db7a9dd38cdb",
  "targetRevision": "9b20b7d48cfc2969b0c79b9317deee1d4f422e97",
  "targetTree": "4d3eafd6cdc8d78ad94cf291835f1b0d1c9921c2",
  "contextLines": 3,
  "files": [
    {
      "file": "test/gates.js",
      "mode": "100644",
      "targetMode": "100644",
      "currentBlob": "e3a16fdf23d923becc9e3ef4a4c594c044f966c9",
      "currentSha256": "a541717ec9b9665ec08c3799d563e392e5422513906f4c2fd0f9b0d3bd3cba12",
      "currentRawSha256": {
        "lf": "a541717ec9b9665ec08c3799d563e392e5422513906f4c2fd0f9b0d3bd3cba12",
        "crlf": "1ff25cf7cce33acfbedc8e85d3631b945550e56fa99567fac0f6aaaff1e778e8"
      },
      "currentBytes": 457725,
      "targetBlob": "3a76aed7487fc168e7d6f9ac579f9be5c7a05473",
      "targetSha256": "20a17b79adf48b91059d572ef9c9dae670134a2f16f3634ed2b8f2d3f1fcdbea",
      "targetBytes": 457708,
      "inverses": [
        {
          "current": "\n  const timeouts = (block) => [...block.matchAll(/^    timeout-minutes:\\s*(\\d+)\\s*$/gm)]\n    .map((m) => Number(m[1]));\n  assert.deepEqual(timeouts(suites), [150],\n    'the `suites` job must retain exactly one finite 150-minute HANG bound after the observed120m full-lifecycle timeout');\n  for(const invalid of ['0','60','75','90','120','121','151','${{ inputs.suites_timeout }}','unbounded']) {\n    assert.throws(() => assert.deepEqual(timeouts(suites.replace('timeout-minutes: 150','timeout-minutes: '+invalid)),[150]),'Unknown suites wall bound must reject');\n  }\n  assert.throws(() => assert.deepEqual(timeouts(suites.replace(/^    timeout-minutes: 150\\r?\\n/m,'')),[150]),'Missing suites wall bound must reject');\n  assert.throws(() => assert.deepEqual(timeouts(suites.replace('timeout-minutes: 150','timeout-minutes: 150\\n    timeout-minutes: 150')),[150]),'Duplicate suites wall bound must reject');\n  assert.deepEqual(timeouts(browser), [25],\n    'the `browser` job must have exactly one 25-minute HANG bound');\n  assert.deepEqual(timeouts(uxBrowser), [20], 'The additional complete UX browser job has its own finite 20-minute bound');\n",
          "baseline": "\n  const timeouts = (block) => [...block.matchAll(/^    timeout-minutes:\\s*(\\d+)\\s*$/gm)]\n    .map((m) => Number(m[1]));\n  assert.deepEqual(timeouts(suites), [120],\n    'the `suites` job must retain exactly one finite 120-minute HANG bound after the observed75m commercial timeout');\n  for(const invalid of ['0','60','75','90','121','${{ inputs.suites_timeout }}','unbounded']) {\n    assert.throws(() => assert.deepEqual(timeouts(suites.replace('timeout-minutes: 120','timeout-minutes: '+invalid)),[120]),'Unknown suites wall bound must reject');\n  }\n  assert.throws(() => assert.deepEqual(timeouts(suites.replace(/^    timeout-minutes: 120\\r?\\n/m,'')),[120]),'Missing suites wall bound must reject');\n  assert.throws(() => assert.deepEqual(timeouts(suites.replace('timeout-minutes: 120','timeout-minutes: 120\\n    timeout-minutes: 120')),[120]),'Duplicate suites wall bound must reject');\n  assert.deepEqual(timeouts(browser), [25],\n    'the `browser` job must have exactly one 25-minute HANG bound');\n  assert.deepEqual(timeouts(uxBrowser), [20], 'The additional complete UX browser job has its own finite 20-minute bound');\n"
        }
      ]
    }
  ]
});
export const UX_SUITES_GATE_SOURCE_SHA256 = "3ba353485754a6a266f02575c79c8b271e8869b94a34e00847c5546c819af6ce";
