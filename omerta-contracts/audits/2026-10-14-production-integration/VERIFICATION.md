# Production integration verification — 2026-10-14

The integrated Solidity sources passed the complete local Forge suite and the final production size gate. This package covers source commit **`b602dc0da8fd3922ae53b84d23e4e46b6e90439f`**, before any on-chain activation. It records merge integration verification, not a fresh full-protocol security review or a deployed-state attestation.

## Source and scope

The compiler inputs, checked-in tests, and Foundry configuration matched that source commit when verification completed. Later application-only commits do not broaden the Solidity conclusion. The observed repository HEAD was `750c07431ab157d8bf764ef1cb60d2cb4332c59b`.

| Scope | Git object |
| --- | --- |
| `omerta-contracts/src` | `3aac08b6c4d6a664f2c0489521e908c5f78f9cc3` |
| `omerta-contracts/test` | `7be7492f2c710e990b205fc6ef26c06ecb384413` |
| `omerta-contracts/foundry.toml` | `171c92f61c5e616c1d1d06a136934d053e97ff2a` |

[source-manifest.json](source-manifest.json) identifies all 103 production Solidity files by canonical Git blob and actual working-tree SHA256. It also records ten focused compiler artifact/creation/runtime-template hashes and content fingerprints for the five mounted dependency scopes. A null dependency revision means no independent dependency Git checkout was available; an ancestor application HEAD was not substituted. All recorded source, artifact, and dependency hashes were checked again after the final size command. No untracked source or test input was present.

The merge retains the restricted token/manager architecture, fixed 500 bps manager revenue split, capped 50 bps hook surcharge, exact-delta accounting, and immutable fee recipients. Obsolete governance tests were replaced with mutation rejection and funded-liability coverage. Upstream NFT eligibility and custody guards, constructor bindings, static remappings, and compiler restrictions were retained. The restricted manager uses the core-compatible non-IR profile; the applicable market contracts use the pinned IR profile.

## Executed checks

All commands ran from `omerta-contracts` with Forge 1.7.1 (`4072e48705af9d93e3c0f6e29e93b5e9a40caed8`), solc `0.8.26+commit.8a97fa7a`, optimizer 800, and Cancun EVM. The exact profile restrictions and remappings are pinned by the configuration blob above.

| Command | Exit | Result |
| --- | --- | --- |
| `forge build --offline` | 0 | Both configured compilation profiles succeeded. |
| `forge test -vvv --fuzz-runs 512 --fuzz-seed 0x2109737503393554544` | 0 | 104 suites; 1,486 passed, zero failed, two skipped; 2,365.27 seconds wall time. |
| `forge build --sizes --skip FuzzTester --offline` | 0 | Production runtime and initcode size gate passed. |

The full run completed all 29 reported stateful invariant properties at 512 runs and 256,000 calls each (observed depth 500). Per-property handler reverts are retained in the results; expected rejected handler operations are not invariant failures. The completed properties include hook funded liabilities, fixed-policy mutation attempts, restricted-manager revenue conservation, graduation settlement, and the stock registry model. The v4 adversarial regressions, exact-input/output and partial-fill accounting tests, and NFT eligibility/custody suites were included in the full run.

`AuctionGenesisRobinhoodForkTest` and `PlayerGenesisRobinhoodForkTest` skipped their setup because the opt-in `GENESIS_ROBINHOOD_FORK` flag was not enabled. This run therefore does not establish live Robinhood chain compatibility. `test/fizz/FuzzTester.sol` is a fuzz harness excluded from the size report only; no production contract was excluded from that gate.

`OmertaPoolManagerV2` has a 24,342-byte runtime, leaving **234 bytes** below the 24,576-byte runtime limit. Future manager changes must repeat the size gate. Compiler warnings and lints are retained in the build and size logs; exit zero is not a claim that no diagnostics were emitted.

## Retained evidence and limits

[commands-results.json](commands-results.json) contains exact commands, exit statuses, test summary, every observed invariant budget, skipped-suite details, and raw/compressed log SHA256 values. The complete outputs are retained as [forge-build.log.gz](forge-build.log.gz), [forge-full-tests.log.gz](forge-full-tests.log.gz), and [forge-size-gate.log.gz](forge-size-gate.log.gz). Package-local Git attributes retain LF text and binary compressed logs so the [package manifest](package-manifest.json) hashes survive checkout on Windows.

The [focused v4 security package](../2026-10-14-v4-hook-security/README.md) remains unchanged from snapshot `7e42b9955dea4858a20139c51f9f2660d8654669`. Its method passes, Slither findings, source pins, and conclusions retain their original scope. Static analysis was not rerun by this integration verification, and its historical findings are not silently reassigned to the merged source. The integration work used focused caller/constructor tracing, authorization/accounting comparison, and invariant/test retesting; it does not claim an additional full upstream audit orchestration.

No test failure required a production-source correction or a repeat full run. These results establish the recorded local integration checks for the pinned source and configuration. They do not establish a broadcast, contract funding, deployment, upgrade, Safe approval, chain configuration, or on-chain activation. Runtime hashes describe compiler templates containing immutable placeholders; any deployment still requires constructor, address, and deployed-bytecode verification under the repository deployment controls.
