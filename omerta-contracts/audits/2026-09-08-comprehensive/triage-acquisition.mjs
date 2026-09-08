import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const names = [
  'AcquisitionVault', 'AcquisitionAuthority', 'AcquisitionVaultCore',
  'AcquisitionConstellationFactory', 'AcquisitionIntentExecution',
  'AcquisitionReconciliation', 'PreVoteBudgetBook', 'RwaHealthOverlay',
  'SettlementGasPool', 'StockTokenRegistryV2',
];

const decisions = {
  'uninitialized-state': 'Intentional zero-initialized milestone state. Solidity defaults these scalar storage slots to zero. Ordinary reservations, reconciliation liability/backing and the relayed cancellation nonce have no implemented mutator in this phase. Snapshot/finalization prove zero; introducing the future transitions reopens review. See AQ-PHASE-01.',
  'locked-ether': 'Accurate reachability observation, retained as AQ-PHASE-01: native deposits exist and outflow/recovery does not. Normative acquisition Tasks 3-5 explicitly require an unfunded dormant milestone; this is not dismissed as a false positive and prevents funding/activation of this revision.',
  'incorrect-equality': 'Intentional sentinel, exact identity or boundary comparison. Zero IDs/generations identify absent records; zero credit/surplus selects evidence/status; exact reverse-head and snapshot hashes enforce identity; uint256.max detects exhausted counters. No manipulable nonzero external balance-equality gate is introduced.',
  'uninitialized-local': 'False positive: Solidity zero-initializes local counters; the deposit work struct is assigned before each field is read; all five Factory predicted-address elements are assigned in the bounded loop before use. No uninitialized memory pointer is consumed.',
  'unused-return': 'False positive: legacy-vault signature validation intentionally ignores only the ECDSA diagnostic error-argument bytes. It checks both RecoverError.NoError and the exact recovered successor address before mutation.',
  'shadowing-local': 'API naming observation: Core snapshot named return values do not write or read an accidental local; _coreSnapshotWords reads the actual storage fields and returns its exact 18-word array. The constructor cap parameter is explicitly assigned to immutable _globalCap.',
  'missing-zero-check': 'Intentional disabled publisher: address(0) makes onlyPublisher reject all calls. Constructor and owner-only setPublisher may disable publication; a zero value gains no capability.',
  'timestamp': 'Expected time-dependent windows, UTC epochs and exact inclusion deadlines; timestamps are not used as randomness. Some diagnostics propagate timestamp taint to identity checks, which do not depend on timestamp unpredictability. Timestamp bounds/truncation and deadline arithmetic were checked against the stated uint64/UTC domain; native chain timestamp availability remains an assumption.',
  'assembly': 'Reviewed explicit assembly: bounded fixed-output peer/signature calls, storage getter encoding, hash/event construction and terminal ABI returns; Factory CREATE/finalizer calls are fixed by the committed graph. Handwritten storage slots remain compiler/dependency-sensitive and are covered by frozen storage/getter tests. No generic delegatecall, arbitrary outflow or unchecked dynamic returndata copy was introduced.',
  'pragma': 'Informational dependency pragma differences. The canonical build selects Solidity 0.8.26, optimizer 800, Cancun and required per-file viaIR; compatible dependency ranges do not select an older compiler.',
  'solc-version': 'Compiler-range diagnostic: the actual toolchain is pinned to Solidity 0.8.26. Compatible library pragma ranges are not the compiler selection for this reviewed build.',
  'too-many-digits': 'Literal readability observation. Gas budgets and limits match the frozen specification; formatting a numeric literal does not alter the enforced cap.',
  'constable-states': 'Optimization suggestion on deliberately frozen zero storage reserved by the current milestone schema. Changing to a constant would change storage/snapshot conformance and is not required for security. See AQ-PHASE-01.',
  'cyclomatic-complexity': 'Maintainability observation. These functions enumerate explicit identity/encoding/accounting checks and failure boundaries. Each helper was read through, and the existing conformance suites exercise malformed peer responses and precedence. Complexity itself is not evidence of an exploitable path.',
  'low-level-calls': 'Expected self-only native credit payment. withdrawCredit zeros the caller credit and updates exact liabilities before the call, uses nonReentrant and checks success. A revert restores all state; new callback/donation and failed-recipient tests retain this evidence.',
  'naming-convention': 'Style-only diagnostic: SAFE and REGISTRY are immutable bindings deliberately exposed with uppercase getter names in the frozen interface.',
};

const result = {
  date: '2026-09-08',
  note: 'Every direct in-scope diagnostic from the successful per-contract static runs has an explicit disposition. Imported dependency-only diagnostics remain with the root shared-dependency review. Failed tool runs remain visible separately.',
  inputs: [],
  unavailable: [],
  diagnostics: [],
};

for (const name of names) {
  const ir = path.join('output/comprehensive-audit', `slither-${name}-ir.json`);
  const full = path.join('output/comprehensive-audit', `slither-${name}-full.json`);
  const input = fs.existsSync(ir) ? ir : full;
  if (!fs.existsSync(input)) {
    result.unavailable.push({name, reason: 'No successful result JSON retained yet; inspect the corresponding full/IR failure log.'});
    continue;
  }
  const raw = fs.readFileSync(input);
  const parsed = JSON.parse(raw);
  if (!parsed.success) throw new Error(`Unsuccessful static result: ${input}`);
  result.inputs.push({name, path: input, sha256: crypto.createHash('sha256').update(raw).digest('hex'), success: parsed.success});
  for (const diagnostic of parsed.results?.detectors ?? []) {
    const files = diagnostic.elements.map(e => e.source_mapping?.filename_relative?.replaceAll('\\', '/')).filter(Boolean);
    if (!files.includes(`src/${name}.sol`)) continue;
    const disposition = decisions[diagnostic.check];
    if (!disposition) throw new Error(`Untriaged direct diagnostic ${name}: ${diagnostic.check}`);
    result.diagnostics.push({
      sourceRun: name,
      rawFile: input,
      id: diagnostic.id,
      check: diagnostic.check,
      reportedImpact: diagnostic.impact,
      description: diagnostic.description,
      disposition,
    });
  }
}

result.countsByRule = {};
for (const diagnostic of result.diagnostics) {
  result.countsByRule[diagnostic.check] = (result.countsByRule[diagnostic.check] ?? 0) + 1;
}
const output = 'omerta-contracts/audits/2026-09-08-comprehensive/acquisition-static-triage.json';
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({output, inputCount: result.inputs.length, unavailable: result.unavailable, diagnostics: result.diagnostics.length, countsByRule: result.countsByRule}));
