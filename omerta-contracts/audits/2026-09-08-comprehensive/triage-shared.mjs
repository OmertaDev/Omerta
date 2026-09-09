import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const directory = 'omerta-contracts/audits/2026-09-08-comprehensive';
const rawDirectory = 'output/comprehensive-audit';
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file));
const filePin = file => ({path: file.replaceAll('\\', '/'), sha256: sha256(fs.readFileSync(file))});
const normalize = file => file.replaceAll('\\', '/');
const selectionPath = `${directory}/static-run-selection.json`;
const selections = readJson(selectionPath);
const baselinePath = `${directory}/source-before.json`;
const baseline = readJson(baselinePath);
const groups = ['core', 'market', 'acquisition'];
const existing = new Map();
const inputs = [filePin(selectionPath), filePin(baselinePath), filePin(`${directory}/bitmath-model-result.json`)];
for (const group of groups) {
  const file = `${directory}/${group}-static-triage.json`;
  inputs.push(filePin(file));
  for (const [index, diagnostic] of readJson(file).diagnostics.entries()) {
    const key = `${diagnostic.sourceRun}:${diagnostic.id}`;
    existing.set(key, [...(existing.get(key) ?? []), {group, path: file, diagnosticIndex: index}]);
  }
}

function disposition(d) {
  const first = d.description.split('\n')[0];
  const match = (status, rationale, reviewDepth = 'Rule-specific source triage') => ({status, rationale, reviewDepth});
  switch (d.check) {
    case 'incorrect-exp':
      return first.startsWith('Base64.')
        ? match('false-positive', 'Base64._encode deliberately XORs the two alphabet suffix bytes with 0x0670 when URL-safe encoding is selected: ASCII +/ becomes -_. This is byte-table selection, not exponentiation.')
        : match('false-positive', 'The XOR is the intentional four-bit modular-inverse seed (3 * oddDenominator) ^ 2. Both mulDiv implementations first subtract the 512-bit remainder and factor powers of two, then use six Newton/Hensel steps. Replacing XOR with exponentiation would break the inverse.');
    case 'divide-before-multiply':
      if (/^(Math|FullMath)\.mulDiv/.test(first)) return match('false-positive', 'Full-precision mulDiv makes the 512-bit numerator exactly divisible by subtracting its remainder before factoring powers of two. Subsequent multiplication by the inverse of the odd denominator is modular division; it does not prematurely truncate an economic quantity. The denominator/high-word bound rejects overflow and zero division.');
      if (first.startsWith('Math.invMod')) return match('false-positive', 'The Euclidean algorithm intentionally calculates quotient = gcd / remainder and subtracts remainder * quotient to produce gcd % remainder. This is the integer remainder recurrence, not lossy token-rate arithmetic.');
      if (first.startsWith('Base64._encode')) return match('false-positive', 'The padded encoded allocation deliberately uses four bytes per complete or partial three-byte input group: 4 * ((length + 2) / 3).');
      if (first.startsWith('Base64._decode')) return match('false-positive', 'The decoder first counts complete four-character groups as (length / 4) * 3, then explicitly adjusts for padding or the final partial group. This is byte allocation arithmetic.');
      if (first.startsWith('CustomRevert.')) return match('false-positive', 'Yul mul(div(add(returndatasize(),31),32),32) rounds the reverted payload allocation up to an ABI word. The raw detector pretty-print obscures parentheses; the source intentionally performs that integer rounding.');
      if (/TickMath\.(min|max)UsableTick/.test(first)) return match('intentional-rounding', 'Division followed by multiplication selects the in-range tick multiple nearest the signed bound. It deliberately rounds toward zero. Valid positive tick spacing is a caller precondition; this pure helper is not a cash accounting calculation.');
      if (first.startsWith('TickMath.getSqrtPriceAtTick')) return match('intentional-rounding', 'The routine uses Q128.128 lookup products, reciprocates for positive ticks, then rounds upward when converting to Q64.96. This diagnostic identifies the defined fixed-point approximation, not an independently demonstrated loss. Tick range is checked before the lookup.');
      throw Error(`Unhandled divide-before-multiply: ${first}`);
    case 'incorrect-shift':
      return match('false-positive', 'The nested EVM shifts intentionally index a bit-lookup table; the operands are not reversed. The source and a literal 256-bit EVM-word model were checked against an independent bit-index reference on 2,813 boundary/deterministic inputs (5,626 comparisons). See bitmath-model-result.json; this is a model check, not compiled-bytecode execution.');
    case 'incorrect-modifier':
      return match('intentional-control-flow', 'Hooks.noSelfCall deliberately skips only the hook callback dispatcher when the hook itself initiated the PoolManager action. The surrounding PoolManager operation is not skipped. This is recursion suppression, not an authorization modifier promised to revert; this triage does not verify a deployed PoolManager address.');
    case 'uninitialized-local':
      return match('false-positive', 'BalanceDelta is an int256-backed value type. Solidity zero-initializes local hookDelta; when both returned fee/delta components are zero, afterSwap intentionally returns ZERO_DELTA. Nonzero components initialize hookDelta before subtracting it.');
    case 'unused-return':
      return match('false-positive', 'Hooks.callHook checks call success, response length >= 32, and equality of returned and requested selectors before returning bytes. These six void callback dispatchers need no further returned value. Delta-bearing hooks instead use exact-length validation and parse the requested delta.');
    case 'missing-zero-check':
      return match('intentional-disabled-pending-transfer', 'Ownable2Step.transferOwnership(0) cancels a pending transfer. It updates only _pendingOwner, leaving the current owner in place. acceptOwnership requires the caller to equal that pending address. This differs from inherited renounceOwnership, which is a separate owner-authorized action.');
    case 'timestamp':
      return match('intentional-deadline', 'ERC20Permit rejects permits after their signed deadline; timestamp is the documented expiry input, not a random value. Nonces and the EIP-712 domain enforce replay separation. Network timestamp/availability remains an external assumption.');
    case 'shadowing-local':
      return match('style-only', first.startsWith('IStockTokenRegistryV2.')
        ? 'Interface argument/return label catalogVersion shares a spelling with the catalogVersion() getter. The interface has no implementation or storage to accidentally overwrite; this does not change selector types or calldata binding.'
        : 'ERC20Permit constructor parameter name is explicitly forwarded to EIP712(name,"1"). It does not replace ERC20.name() or change its storage.');
    case 'naming-convention':
      return match('style-only', 'The diagnostic identifies a deliberate ABI name: uppercase constant-like interface getters or the established EIP712/ERC20Permit domain/name functions. Renaming would change an interface and is not a security correction.');
    case 'unindexed-event-address':
      return match('indexing-observation', 'Pausable.Paused/Unpaused carry the address in receipt data without an indexed topic. That limits address-topic filtering but neither hides the log nor changes pause authority.');
    case 'solc-version':
      return match('compiler-range-observation', 'This warning enumerates historical issues permitted by an imported source pragma range. The retained analysis and canonical build select native Solidity 0.8.26, not every version admitted by that range. This disposition does not assert that a compiler is bug-free; pinning and retesting the selected compiler remains necessary.');
    case 'dead-code':
      return match('unused-in-selected-compilation', 'The detector identifies an internal inherited/library helper unused by this selected per-contract compilation. It is not a new public entry point. Other selected contracts may use the same helper, so this is a local compilation observation and no shared dependency source is removed.');
    case 'too-many-digits':
      return match('literal-readability-observation', 'The reported constants encode bit masks, lookup tables, selectors, fee flags, fixed-point scale, or a sentinel. Their length is required by the representation; the detector provides no evidence of an incorrect economic value. The exact literal remains in the pinned source.');
    case 'cyclomatic-complexity':
      return match('maintainability-observation', 'TickMath.getSqrtPriceAtTick decomposes the checked tick magnitude into bits and multiplies one fixed Q128.128 constant per set bit. This produces many branches by design. No new exploit follows from the complexity count; independent whole-library mathematical verification is outside this triage.');
    case 'assembly': {
      let detail;
      if (first.startsWith('SafeERC20.')) detail = 'The three token-call wrappers were followed: call failure is propagated when requested, a returned true or empty returndata from a code-bearing token is required, and scratch/free-memory bookkeeping is restored. Supported token behavior remains a separate asset assumption.';
      else if (/^ERC(721|1155)Utils\./.test(first)) detail = 'These receiver-check helpers bubble nonempty revert data; GearVault receiver checks occur after balance/event updates and are skipped for burns to zero. Receiver acceptance failures revert the enclosing transaction.';
      else if (first.startsWith('ERC1155._asSingletonArrays')) detail = 'This helper allocates two singleton arrays, sets each length/value and advances the free-memory pointer. The inherited event and receiver paths were followed separately.';
      else if (/^(Math|FullMath)\.mulDiv/.test(first)) detail = 'The 512-bit remainder/factor/inverse algorithm is addressed by the separate incorrect-exp and divide-before-multiply dispositions.';
      else if (first.startsWith('Base64._encode')) detail = 'The encoding loop and its alphabet selection, byte allocation, padding and cached trailing-word restoration were followed for NFT metadata use.';
      else if (first.startsWith('Hooks.callHook')) detail = 'The hook call is checked for success, its ABI result is allocated/copied, and selector/length are validated. Arbitrary deployed hooks and PoolManager deployments are not proven by this local helper review.';
      else if (first.startsWith('CustomRevert.')) detail = 'This is terminal revert-data encoding/bubbling; it provides no successful asset-transfer path. Rounded allocation is covered in its arithmetic diagnostic.';
      else if (first.startsWith('BitMath.')) detail = 'The flagged bit-lookups have a separate 2,813-case EVM-word model cross-check retained with its limitations.';
      else detail = 'This row records the exact imported function and source span containing assembly. The presence detector specifies no unsafe input or violated invariant; no independent whole-function memory-safety proof is claimed for this helper.';
      return match('informational-assembly-inventory', detail, 'Presence diagnostic triage; only explicitly named call/algorithm paths received additional inspection. Not a whole-dependency audit.');
    }
    default: throw Error(`Untriaged shared rule: ${d.check}`);
  }
}

const shared = new Map();
const coverage = [];
const allById = new Map();
const sourceFiles = new Set();
for (const run of selections) {
  const file = `${rawDirectory}/${run.file}`;
  const parsed = readJson(file);
  assert.equal(parsed.success, true, `Unsuccessful selected run ${run.name}`);
  const detectors = parsed.results?.detectors ?? [];
  assert.equal(detectors.length, run.diagnostics, `Count drift for ${run.name}`);
  inputs.push({...filePin(file), sourceRun: run.name, diagnostics: detectors.length});
  for (const [diagnosticIndex, d] of detectors.entries()) {
    const occurrenceKey = `${run.name}:${diagnosticIndex}:${d.id}`;
    const prior = existing.get(`${run.name}:${d.id}`) ?? [];
    const files = [...new Set(d.elements.map(e => e.source_mapping?.filename_relative).filter(Boolean).map(normalize))];
    const occurrence = {occurrenceKey, sourceRun: run.name, rawFile: file, diagnosticIndex, id: d.id, check: d.check,
      assignments: prior.length ? prior : [{group: 'shared', path: `${directory}/shared-static-triage.json`, diagnosticId: d.id}]};
    coverage.push(occurrence);
    if (!allById.has(d.id)) allById.set(d.id, {id: d.id, check: d.check, description: d.description, occurrences: []});
    assert.equal(allById.get(d.id).description, d.description, `ID collision ${d.id}`);
    allById.get(d.id).occurrences.push(occurrence);
    if (prior.length) continue;
    for (const source of files) {
      assert(source.startsWith('lib/') || source.startsWith('src/interfaces/'), `Unassigned production diagnostic: ${source}`);
      sourceFiles.add(`omerta-contracts/${source}`);
    }
    if (!shared.has(d.id)) shared.set(d.id, {id: d.id, check: d.check, reportedImpact: d.impact, reportedConfidence: d.confidence,
      description: d.description, sourceFiles: files,
      elements: d.elements.map(e => ({type: e.type, name: e.name, source: e.source_mapping?.filename_relative ? normalize(e.source_mapping.filename_relative) : null, lines: e.source_mapping?.lines ?? []})),
      disposition: disposition(d), occurrences: []});
    shared.get(d.id).occurrences.push({occurrenceKey, sourceRun: run.name, rawFile: file, diagnosticIndex});
  }
}
for (const key of existing.keys()) assert(coverage.some(c => `${c.sourceRun}:${c.id}` === key), `Stale direct assignment ${key}`);
assert.equal(coverage.length, 1616, 'Unexpected raw selected diagnostic count');
assert.equal(coverage.filter(c => c.assignments.length === 0).length, 0);
const byRule = {};
for (const d of shared.values()) {
  byRule[d.check] ??= {uniqueDiagnosticIds: 0, rawOccurrences: 0};
  byRule[d.check].uniqueDiagnosticIds++;
  byRule[d.check].rawOccurrences += d.occurrences.length;
}
const duplicateGroups = [...allById.values()].filter(d => d.occurrences.length > 1).map(d => ({id: d.id, check: d.check,
  occurrenceCount: d.occurrences.length, sourceRuns: [...new Set(d.occurrences.map(o => o.sourceRun))],
  triageGroups: [...new Set(d.occurrences.flatMap(o => o.assignments.map(a => a.group)))]}));
const crossGroupOverlaps = [...allById.values()].map(d => ({id: d.id, check: d.check,
  groups: [...new Set(d.occurrences.flatMap(o => o.assignments.map(a => a.group)))]})).filter(d => d.groups.length > 1);
const multiAssignedOccurrences = coverage.filter(c => c.assignments.length > 1);
const extraPins = ['omerta-contracts/src/GearVault.sol', 'omerta-contracts/lib/openzeppelin-contracts/contracts/token/ERC1155/ERC1155.sol',
  'omerta-contracts/lib/openzeppelin-contracts/contracts/token/ERC1155/utils/ERC1155Utils.sol',
  'omerta-contracts/lib/v4-core/src/libraries/Hooks.sol', 'omerta-contracts/lib/v4-core/src/libraries/BitMath.sol'];
for (const file of extraPins) sourceFiles.add(file);
const sources = [...sourceFiles].sort().map(filePin);
const baselineHashes = new Map(baseline.files.map(file => [file.path, file.sha256]));
for (const source of sources) assert.equal(source.sha256, baselineHashes.get(source.path), `Shared source differs from retained baseline: ${source.path}`);
const summary = {
  selectedRuns: selections.length, rawDiagnosticOccurrences: coverage.length, uniqueDiagnosticIds: allById.size,
  duplicateOccurrencesBeyondFirstId: coverage.length - allById.size,
  directAssignedOccurrences: coverage.filter(c => c.assignments.some(a => a.group !== 'shared')).length,
  sharedAssignedOccurrences: coverage.filter(c => c.assignments.some(a => a.group === 'shared')).length,
  sharedUniqueDiagnosticIds: shared.size, duplicateIdGroups: duplicateGroups.length,
  multiAssignedOccurrenceCount: multiAssignedOccurrences.length, crossTriageGroupIdOverlapCount: crossGroupOverlaps.length,
  unassignedOccurrenceCount: 0,
};
const result = {
  date: '2026-09-08', scope: 'Diagnostic reconciliation of selected retained Slither runs, imported dependency and local-interface triage, plus inherited GearVault ERC event trace.',
  limit: 'Each diagnostic occurrence has a disposition or a direct-review reference. Unique diagnostic IDs are not confirmed findings. Informational assembly rows do not claim an independent audit or memory-safety proof of every imported helper. No production/test/compiler/cache files are modified by this pass.',
  sourceCommitAtBaseline: baseline.sourceCommit,
  baselineHashVerification: {comparedSourceFiles: sources.length, allMatched: true},
  dependencyProvenance: 'Vendored local source bytes, pinned individually below. git -C lib/... resolves the enclosing repository; no independent upstream commit or package-version pin is inferred.',
  command: 'node omerta-contracts/audits/2026-09-08-comprehensive/triage-shared.mjs', runtime: process.version,
  inputs, sources, summary, countsByRule: byRule, duplicateGroups, crossGroupOverlaps, multiAssignedOccurrences,
  diagnostics: [...shared.values()], coverage,
  separateErcCheck: {
    ...filePin(`${rawDirectory}/erc-GearVault.log`), findingText: 'safeBatchTransferFrom must emit TransferSingle or TransferBatch',
    disposition: 'False positive on inherited dispatch: GearVault does not override safeBatchTransferFrom, _safeBatchTransferFrom, _updateWithAcceptanceCheck or _update. ERC1155.safeBatchTransferFrom:105-114 calls _safeBatchTransferFrom:259-273, then six-argument _updateWithAcceptanceCheck:204-224 calls _update:137-171. _update emits TransferSingle for length 1 at 167 and TransferBatch otherwise at 169, including length 0; receiver checks follow and revert atomically on rejection.',
    optionalReceiverNotices: 'Missing onERC1155Received/onERC1155BatchReceived are optional recipient callbacks, not mandatory token-contract methods; GearVault need not receive its own assets.',
    dynamicValidation: 'Manual source trace only in this subtask; no ERC test/compiler command rerun. The separate raw ERC log is not included in the 1,616 Slither detector count.',
  },
};
const outputPath = `${directory}/shared-static-triage.json`;
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({outputPath, summary, countsByRule: byRule}));
