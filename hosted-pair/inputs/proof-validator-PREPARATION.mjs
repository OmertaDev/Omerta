throw new Error('PREPARATION_ONLY_UNBOUND: hosted proof validator is not executable or an admission.');

export function proofShape(proof, B, contract, assert) {
  assert.deepEqual(contract.snapshotIndexesWithoutStatus, [0, 1, 2, 5, 7, 8, 11, 14]);
  assert.deepEqual(contract.strictEqualityIndexes, [3, 6, 9, 12, 15]);
  assert.deepEqual(contract.receiptReplayIndexes, [4, 10, 13]);
  assert.deepEqual(contract.receiptCounts, [1, 2, 2]);
  assert.deepEqual(contract.childLabels, ['1-predecessor', '2-candidate', '3-predecessor', '4-candidate']);
  assert.deepEqual(contract.assertionIds, ['fixture', 'predecessor-committed', 'upgraded',
    'upgrade preserves acknowledged state', 'predecessor receipt after upgrade', 'upgrade-replayed',
    'upgrade replay creates no new effect', 'candidate-committed', 'rolled-back',
    'rollback preserves acknowledged state', 'both receipts after rollback', 'rollback-replayed',
    'rollback replay creates no new effect', 'both receipts after second upgrade', 're-upgraded',
    'second upgrade preserves acknowledged state']);
  assert.equal(proof.status, 'PASS_SCOPED');
  assert.equal(proof.candidate, B.candidate.source); assert.equal(proof.predecessor, B.predecessor.source);
  assert.deepEqual(proof.assertions.map(row => row.id), contract.assertionIds);
  for (const [index, row] of proof.assertions.entries()) {
    if (contract.snapshotIndexesWithoutStatus.includes(index)) {
      assert.deepEqual(Object.keys(row).sort(), ['id', 'rawStateSha256', 'stateSha256']);
      assert.match(row.stateSha256, /^[a-f0-9]{64}$/); assert.match(row.rawStateSha256, /^[a-f0-9]{64}$/);
    } else if (contract.strictEqualityIndexes.includes(index)) {
      assert.deepEqual(row, { id: contract.assertionIds[index], status: 'PASS' });
    } else {
      const replay = contract.receiptReplayIndexes.indexOf(index); assert(replay >= 0);
      assert.deepEqual(row, { id: contract.assertionIds[index], receipts: contract.receiptCounts[replay], status: 'PASS' });
    }
  }
  assert.deepEqual(proof.children.map(row => row.label), contract.childLabels);
  assert.equal(proof.children.length, 4); assert.equal(new Set(proof.children.map(row => row.pid)).size, 4);
  for (const child of proof.children) {
    assert(Number.isSafeInteger(child.pid) && child.pid > 0);
    assert.equal(child.result?.code, 0); assert.equal(child.result.signal, null);
    assert.equal(child.result.error ?? null, null);
  }
  for (const key of ['failure', 'hardStop', 'shutdownFailures', 'failureStateCaptureError']) assert.equal(proof[key], undefined);
  assert.deepEqual(proof.normalization.excludedFields, ['schema_meta.applied_at']);
  // Pinned canonical stopSourcePairChild requires actual unforced IPC close before PASS.
  // Any PASS_ADDITIVE_BOOTSTRAP_ONLY or six-table exception fails the five strict comparisons above.
}

export function validateHostedProof(folder, B, contract, firstSource, P) {
  const { fs, path, assert, sha, regular, readRef } = P;
  function proofIndex(folder) {
    const index = JSON.parse(regular(path.join(folder, 'sha256-index.json'))), seen = new Set();
    assert.equal(index.length, 41);
    for (const row of index) {
      assert(typeof row.file === 'string' && !row.file.includes('/') && !row.file.includes('\\'));
      assert(!['.', '..', 'sha256-index.json'].includes(row.file) && !seen.has(row.file)); seen.add(row.file);
      assert.match(row.sha256, /^[a-f0-9]{64}$/); assert.equal(sha(regular(path.join(folder, row.file))), row.sha256);
    }
    assert.deepEqual(fs.readdirSync(folder).sort(), [...seen, 'sha256-index.json'].sort());
    return { indexed: 41, directoryFiles: 42, indexSHA256: sha(regular(path.join(folder, 'sha256-index.json'))) };
  }
  function proofSources(folder) {
    const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']'
      : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}'
        : JSON.stringify(value);
    for (const [name, side] of [['candidate', B.candidate], ['predecessor', B.predecessor]]) {
      const recorded = JSON.parse(regular(path.join(folder, name + '-source.json'))), capture = readRef(side.fullCapture);
      assert.equal(recorded.source, side.source); assert.equal(recorded.gitTree, side.tree);
      const inventory = capture.records.map(row => [row.file, row.rawSHA256]);
      assert.deepEqual(recorded.inventory, inventory); assert.equal(recorded.checkoutSha256, sha(canonical(inventory)));
      // Exact pinned sourceInventory selection. Its public rows omit mode; modes are
      // independently enforced against every tree/index/raw record by source-guard.
      const selected = capture.records.filter(row => /^(src\/|public\/|content\/|tools\/|test\/|\.github\/workflows\/|omerta-contracts\/(src\/|test\/|foundry.toml)|schema.sql$|package(-lock)?\.json$|render.yaml$)/.test(row.file)
        || row.file === 'docs/release/readiness-work/gate-registry.json').map(row => row.file).sort((a, b) => a.localeCompare(b));
      assert.deepEqual(recorded.sourceFiles.map(row => row.path), selected);
      for (const row of recorded.sourceFiles) {
        assert.deepEqual(Object.keys(row).sort(), ['accepted', 'blob', 'gitSha256', 'path', 'sha256']);
        const expected = capture.records.find(record => record.file === row.path); assert(expected);
        assert.equal(row.sha256, expected.rawSHA256); assert.equal(row.gitSha256, expected.gitSHA256);
        assert.equal(row.blob, expected.blob);
        const raw = regular(path.join(side.directory, row.path));
        const gitBytes = expected.representation === 'uniformCRLF'
          ? Buffer.from(raw.toString('utf8').replaceAll('\r\n', '\n')) : raw;
        assert.equal(sha(gitBytes), expected.gitSHA256);
        const accepted = new Set([sha(gitBytes)]), value = gitBytes.toString('utf8');
        if (!gitBytes.includes(0) && Buffer.from(value).equals(gitBytes)) {
          const lf = value.replaceAll('\r\n', '\n'); accepted.add(sha(lf)); accepted.add(sha(lf.replaceAll('\n', '\r\n')));
        }
        assert.deepEqual(row.accepted, [...accepted]);
      }
    }
    const schemas = JSON.parse(regular(path.join(folder, 'schema-comparison.json')));
    for (const [name, side] of [['candidate', B.candidate], ['predecessor', B.predecessor]]) {
      assert.equal(schemas[name].source, side.source);
      assert.equal(schemas[name].schemaSha256, firstSource[name].schema.rawSHA256);
      assert.equal(schemas[name].appVersion, firstSource[name].appVersion);
    }
    assert.equal(schemas.candidate.schemaSha256, schemas.predecessor.schemaSha256);
  }
  const proof = JSON.parse(regular(path.join(folder, 'result.json')));
  proofShape(proof, B, contract, assert);
  const index = proofIndex(folder); proofSources(folder);
  return { status: 'PASS_STRICT_PROOF_SHAPE_AND_SOURCE_INDEX_ONLY', index, proofSHA256: sha(regular(path.join(folder, 'result.json'))) };
}
