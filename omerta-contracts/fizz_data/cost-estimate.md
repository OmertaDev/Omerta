# Cost Estimate

Model: **opus** ($15.00/M input, $75.00/M output)
Mode: **automatic**
Selected contracts: **9**
Selected functions: **52** — scale 1.4x (large)

| Stage                              | Count | Input    | Output  | Cost     |
|------------------------------------|-------|----------|---------|----------|
| Protocol Analyzer (conditional)    |     1 |      70k |   11.2k |    $1.89 |
| Discovery agents                   |     5 |     560k |     84k |   $14.70 |
| Synthesizer                        |     1 |      70k |   16.8k |    $2.31 |
| Implementers                       |     2 |     168k |     42k |    $5.67 |
| Report Writer                      |     1 |      42k |   11.2k |    $1.47 |
| Orchestrator overhead              |     1 |     350k |     56k |    $9.45 |
| TOTAL                              |       |    1260k |  221.2k |   $35.49 |

**Estimated total: $35.49** — expected range $24.84 – $53.23

These numbers are Anthropic list-price estimates for the subagents and a rough orchestrator overhead share. Actual cost varies with: coverage-iteration cycles (Step 8), re-runs after compile errors, handler complexity, whether x-ray skipped the Protocol Analyzer, and prompt-cache hit rate. Treat this as a ballpark, not a commitment.
