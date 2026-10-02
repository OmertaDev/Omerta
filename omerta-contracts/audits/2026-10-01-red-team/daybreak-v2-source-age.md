No concrete arithmetic or fail-closed defect remains in the scoped remediation.

- At [OmrTwapOracle.sol:167](/C:/Users/Jorge/Documents/Omerta/omerta-contracts/src/OmrTwapOracle.sol:167), the regression reaches `baselinePairElapsed + fullElapsed = 2^32 + 1700`, so the ambiguous accumulator is discarded before subtraction. State is cleared, re-baselined, and the following 1,800-second window recovers correctly.
- The constructor bound prevents overflow of `PERIOD * MAX_WINDOW_MULT`.
- Existing constructor, function, getter, and event signatures are preserved. Strict ABI JSON is not identical because `PeriodTooLong()` is a new additive custom-error entry.

Uncertainty: retained `v2-source-wrap-after.txt` reports all 27 tests passing, including the regression, but lacks a source hash. My focused rerun could not execute because Forge crashed detecting its home directory. Current source hash: `1D3CCB…A5A941F`; test hash: `BDA554…9807AA2`; HEAD `e56cf57`, dirty. Deployment/activation was not reviewed.