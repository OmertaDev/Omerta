// Exact Phase2 upgrade-child bound source envelope; source-only, no native/runtime/deployment clearance.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const UX_PHASE2_UPGRADE_BOUND_SOURCE = freeze({
  "version": 1,
  "status": "SEALED",
  "phase": "EXACT_UX_PHASE2_UPGRADE_BOUND_SOURCE_ONLY",
  "revision": "2ce8bfeb648b61ec73ac55c4ef17d75b654aaeca",
  "tree": "dffa82d9e8cae1c4cbfdda6a44f14622b6ac084b",
  "targetRevision": "ae8f8688960d5165b94a5de1c29d6306ad9f0c9c",
  "targetTree": "776ba24a3a23b336f479ddc03af7af743e56a328",
  "contextLines": 3,
  "files": [
    {
      "file": "test/phase2-postgres.js",
      "mode": "100644",
      "targetMode": "100644",
      "currentBlob": "f88c965ff50cb99e32212e8c860ae711125e0e3b",
      "currentSha256": "631ba1633d6b6ddc9b04f4588feee49247767e8d268ae688cf6b4e6301abdd72",
      "currentRawSha256": {
        "lf": "631ba1633d6b6ddc9b04f4588feee49247767e8d268ae688cf6b4e6301abdd72",
        "crlf": "ca6daf2b23de6a1fa9c60b9d5e68e2ba3707b55316c7f5e54d208e7a1177be44"
      },
      "currentBytes": 89199,
      "targetBlob": "58fe29eee731e0365bcc6f777b6186c24ae58358",
      "targetSha256": "5303524eb71d9b8918d1af3a40b22cb7122c4fb1099f4a5f4615f31d9e6a6a91",
      "targetBytes": 89169,
      "inverses": [
        {
          "current": "        const result = spawnSync(process.execPath,[fileURLToPath(import.meta.url),process.argv[2]], {\n          env: { ...process.env, TEST_DATABASE_URL: childUrl.toString(), DATABASE_URL: childUrl.toString(),\n            P2_TEST_SCHEMA: name, P2_TEST_CHILD: mode, INVARIANT_WEBHOOK_URL: '', PG_POOL_MAX: '12' },\n          encoding: 'utf8', timeout: mode === 'upgrade' ? 600000 : 240000, maxBuffer: 8*1024*1024, windowsHide: true,\n        });\n        process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');\n        if (result.error || result.signal) console.error('phase2-postgres: isolated child termination ' + JSON.stringify({ mode, status: result.status, signal: result.signal, code: result.error?.code }));\n",
          "baseline": "        const result = spawnSync(process.execPath,[fileURLToPath(import.meta.url),process.argv[2]], {\n          env: { ...process.env, TEST_DATABASE_URL: childUrl.toString(), DATABASE_URL: childUrl.toString(),\n            P2_TEST_SCHEMA: name, P2_TEST_CHILD: mode, INVARIANT_WEBHOOK_URL: '', PG_POOL_MAX: '12' },\n          encoding: 'utf8', timeout: 240000, maxBuffer: 8*1024*1024, windowsHide: true,\n        });\n        process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');\n        if (result.error || result.signal) console.error('phase2-postgres: isolated child termination ' + JSON.stringify({ mode, status: result.status, signal: result.signal, code: result.error?.code }));\n"
        }
      ]
    }
  ]
});
export const UX_PHASE2_UPGRADE_BOUND_SOURCE_SHA256 = "2eecadd779dadeebc9f561dd557955fd4e66943fb388f4e5e380f3bb942f101f";
