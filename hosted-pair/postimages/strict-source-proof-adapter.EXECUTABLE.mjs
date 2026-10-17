

// The caller owns service admission, the unchanged canonical command, its
// process result, and observed closure. No service operation is implemented here.
export async function createStrictHostedProofAdapter(input) {
  const [fs, path, crypto, assertModule, url] = await Promise.all([
    import('node:fs'), import('node:path'), import('node:crypto'), import('node:assert/strict'), import('node:url'),
  ]);
  const assert = assertModule.default;
  const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  function regular(file) {
    assert(path.isAbsolute(file) && path.resolve(file) === file);
    const stat = fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink());
    assert.equal(fs.realpathSync(file), file); return fs.readFileSync(file);
  }
  function bytesRef(ref) {
    assert(ref && Number.isSafeInteger(ref.bytes) && /^[0-9a-f]{64}$/.test(ref.sha256));
    const bytes = regular(ref.path); assert.equal(bytes.length, ref.bytes); assert.equal(sha(bytes), ref.sha256); return bytes;
  }
  const readRef = ref => JSON.parse(bytesRef(ref));
  const P = { fs, path, assert, sha, regular, readRef };
  const initialInput = structuredClone(input), binding = readRef(input.binding), contract = readRef(input.proofContract);
  assert.equal(binding.schema, 'omerta.hosted-source-pair-binding.v1');
  assert.equal(contract.candidate, binding.sides.candidate.source, 'Proof contract must bind the actual candidate');
  assert.equal(contract.additiveStatusesAllowed, false);
  const sourceBytes = bytesRef(input.sourceModule), proofBytes = bytesRef(input.proofModule);
  assert(sourceBytes.length > 0 && proofBytes.length > 0);
  // Prepared reference modules still throw on import. Only independently reviewed,
  // explicitly bound executable successors can ever reach these calls.
  function moduleUrl(ref) {
    const value = url.pathToFileURL(ref.path); value.searchParams.set('sha256', ref.sha256); return value.href;
  }
  const source = await import(moduleUrl(input.sourceModule));
  const proof = await import(moduleUrl(input.proofModule));
  assert.equal(typeof source.captureHostedSourcePair, 'function');
  assert.equal(typeof source.verifyHostedSourcePairCapture, 'function');
  assert.equal(typeof source.verifyStrictSameSchema, 'function');
  assert.equal(typeof proof.validateHostedProof, 'function');
  assert.notEqual(input.beforeOutputDirectory, input.afterOutputDirectory);
  let beforeState = null, afterStarted = false;

  function pinnedInputs() {
    assert.deepEqual(input, initialInput);
    assert.deepEqual(readRef(input.binding), binding);
    assert.deepEqual(readRef(input.proofContract), contract);
    assert.deepEqual(bytesRef(input.sourceModule), sourceBytes);
    assert.deepEqual(bytesRef(input.proofModule), proofBytes);
    // The descriptors are fixed by the input binding. Recheck the evidence bytes
    // before and after; an observation is never substituted for an expectation.
    readRef(binding.independentApproval.receipt);
    for (const side of Object.values(binding.sides)) readRef(side.expectedDependencies);
  }
  async function boundary(outputDirectory) {
    pinnedInputs();
    const capture = await source.captureHostedSourcePair({ binding: input.binding, outputDirectory });
    assert.equal(capture.complete, true); assert.equal(capture.phase, 'SOURCE_ONLY_UNAPPROVED_COMPLETE');
    assert.deepEqual(capture.binding, input.binding);
    const receipt = source.verifyStrictSameSchema(await source.verifyHostedSourcePairCapture(capture));
    assert.equal(receipt.strictSameSchema, true); assert.equal(receipt.strictSameLock, true); assert.equal(receipt.strictSameAppVersion, true);
    pinnedInputs(); return { capture, receipt, expectations: {
      approval: structuredClone(binding.independentApproval),
      candidate: { schema: structuredClone(binding.sides.candidate.expectedSchema), dependencies: structuredClone(binding.sides.candidate.expectedDependencies) },
      predecessor: { schema: structuredClone(binding.sides.predecessor.expectedSchema), dependencies: structuredClone(binding.sides.predecessor.expectedDependencies) },
    } };
  }
  function comparison(left, right) {
    assert.deepEqual(left.capture.binding, right.capture.binding);
    assert.deepEqual(left.expectations, right.expectations, 'Exact independent expected descriptors across canonical interval');
    assert.deepEqual(left.receipt.independentApproval, right.receipt.independentApproval);
    assert.deepEqual(left.receipt.runtime, right.receipt.runtime, 'Exact Node/Git/npm runtime equality across canonical interval');
    const beforeResult = readRef(left.capture), afterResult = readRef(right.capture);
    assert.deepEqual(beforeResult.binding, afterResult.binding);
    assert.deepEqual(beforeResult.runtime, afterResult.runtime);
    for (const name of ['candidate', 'predecessor']) {
      const before = left.receipt[name], after = right.receipt[name], side = binding.sides[name];
      for (const key of ['source', 'tree', 'schema', 'lock', 'appVersion']) assert.deepEqual(before[key], after[key]);
      assert.equal(before.source, side.source); assert.equal(before.tree, side.tree);
      for (const key of ['fullBefore', 'fullAfter', 'depsBefore', 'depsAfter']) {
        const a = beforeResult.sides[name][key], b = afterResult.sides[name][key];
        assert.equal(a.bytes, b.bytes); assert.equal(a.sha256, b.sha256);
        assert.deepEqual(readRef(a), readRef(b), 'Exact ' + name + ' ' + key + ' equality across canonical interval');
      }
      // Dependency objects include hidden-lock hashes, package metadata and JSON
      // hashes, exact embedded bundles, bin identities AND observed target hashes.
      // Paths of capture artifacts differ by design; their contents must not.
      assert.deepEqual(beforeResult.sides[name].npmLs.command, afterResult.sides[name].npmLs.command);
      assert.deepEqual(beforeResult.sides[name].npmLs.arguments, afterResult.sides[name].npmLs.arguments);
      assert.deepEqual(beforeResult.sides[name].npmLs.result, afterResult.sides[name].npmLs.result);
    }
  }
  function proofInputs(firstSource) {
    const B = {};
    for (const name of ['candidate', 'predecessor']) {
      const side = binding.sides[name], verified = firstSource[name];
      B[name] = { source: side.source, tree: side.tree, directory: side.directory, fullCapture: verified.fullCapture };
    }
    const full = readRef(B.candidate.fullCapture);
    const cli = full.records.find(row => row.file === contract.canonicalCli.file); assert(cli);
    assert.equal(cli.blob, contract.canonicalCli.blob);
    assert.equal(cli.gitSHA256, contract.canonicalCli.gitSha256);
    assert.equal(cli.rawSHA256, cli.gitSHA256, 'Linux canonical CLI raw bytes must equal Git');
    return { B, firstSource, P };
  }
  return {
    async before() {
      assert.equal(beforeState, null, 'Exactly one before capture per adapter');
      beforeState = await boundary(input.beforeOutputDirectory);
      return structuredClone(beforeState);
    },
    async afterAndValidate(before) {
      assert(beforeState && !afterStarted, 'A single before/after sequence is required');
      assert.deepEqual(before, beforeState, 'The exact before state is required'); afterStarted = true;
      // Coordinator inserts its separately authorized service/native interval
      // between before() and this call. Nothing here grants or executes it.
      const after = await boundary(input.afterOutputDirectory);
      comparison(beforeState, after);
      const { B, firstSource, P } = proofInputs(beforeState.receipt);
      const proofReceipt = proof.validateHostedProof(input.proofDirectory, B, contract, firstSource, P);
      pinnedInputs();
      return { phase: 'STRICT_SOURCE_AND_PROOF_CHECKS_ONLY', before: beforeState, after, proof: proofReceipt,
        strictSameSchema: true, strictSameLock: true, strictSameAppVersion: true,
        exactSourceDependencyRuntimeBeforeAfterEqual: true,
        serviceAdmission: 'NOT_PROVIDED_BY_THIS_ADAPTER', canonicalCommandResult: 'CALLER_MUST_VERIFY',
        observedServiceClosure: 'CALLER_MUST_VERIFY', executionApproval: 'NOT_CREATED' };
    },
  };
}
