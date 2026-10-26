// Exact workflow-parent bound source envelope; source-only, no native/runtime/deployment clearance.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const UX_WORKFLOW_BOUND_SOURCE = freeze({
  "version": 1,
  "status": "SEALED",
  "phase": "EXACT_UX_WORKFLOW_PARENT_BOUND_SOURCE_ONLY",
  "revision": "e4fd869c2adeb2ad2cc5a2d741a5851965b88422",
  "tree": "9f132ffc24f90008bc39dd54dc16c15c9e927320",
  "targetRevision": "c727d652c11780c699164bca321c872abdb8852a",
  "targetTree": "b127346a70610a3efbb4db376bbaaa47d7080db2",
  "contextLines": 3,
  "files": [
    {
      "file": ".github/workflows/ci.yml",
      "mode": "100644",
      "targetMode": "100644",
      "currentBlob": "9f1bae4f4ce1d739c51a05a2c2e6cb0638760a28",
      "currentSha256": "b8b29988097753b81823f4855339a162b874c6a58f4f38896509350d26670e37",
      "currentRawSha256": {
        "lf": "b8b29988097753b81823f4855339a162b874c6a58f4f38896509350d26670e37",
        "crlf": "32441e2a454229db0bf72aa1121874866d5e945199359d3a6874ea40eb6b6e8c"
      },
      "currentBytes": 71308,
      "targetBlob": "4b16e30300463ed4b81bcf597620b3e9708d7f82",
      "targetSha256": "9047ad1d20147696714884dc5ccf0733a8bdbbae0bcf967879bddcce27289b30",
      "targetBytes": 71308,
      "inverses": [
        {
          "current": "    # commercial memory proofs; all commands below remain required. Give the\n    # expanded lifecycle a finite120m hang bound; this is not a measured duration.\n    # Browser and native PostgreSQL bounds and all proof assertions are unchanged.\n    timeout-minutes: 150\n    steps:\n      # The knowledge-plane gate inventories the full Git lineage (800+ commits) and\n      # compares generated artifacts at their recorded source revision. A shallow\n",
          "baseline": "    # commercial memory proofs; all commands below remain required. Give the\n    # expanded lifecycle a finite120m hang bound; this is not a measured duration.\n    # Browser and native PostgreSQL bounds and all proof assertions are unchanged.\n    timeout-minutes: 120\n    steps:\n      # The knowledge-plane gate inventories the full Git lineage (800+ commits) and\n      # compares generated artifacts at their recorded source revision. A shallow\n"
        }
      ]
    }
  ]
});
export const UX_WORKFLOW_BOUND_SOURCE_SHA256 = "2d822a1aacc5de9f5021d20040162de1fab68a88ade4b73006ca9f53971f1b60";
