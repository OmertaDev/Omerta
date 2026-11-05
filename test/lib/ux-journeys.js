import { BUSINESS_DESK_COMBINED_SOURCE, assertBusinessDeskCombinedSourceTransfer } from '../../tools/businessdesk-combined-source-transfer.js';
import assert from 'node:assert/strict';
import { readFileSync, lstatSync } from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { UX_AFTERWORD_SOURCE, UX_AFTERWORD_SOURCE_FILES, qualifyUxAfterwordSource, uxAfterwordHistoricalInput } from '../../tools/ux-afterword-source-compatibility.js';
import { classicInterfaceHistoricalInput } from '../../tools/commerce-current-enterprise-source-compatibility.js';
import { BUSINESS_DESK_DOMAINS, BUSINESS_DESK_PREDECESSOR, assertBusinessDeskSourceTransfer,
  businessDeskHistoricalInput } from '../../tools/businessdesk-source-transfer.js';
import { assertContractReleaseSourceDefinition, assertContractReleaseSourceTransfer,
  contractReleaseDeskInput } from '../../tools/contract-release-source-transfer.js';

export async function runJourneyModelProof() {
  runAfterwordSourceProof();
  const context = vm.createContext({ window: {} });
  vm.runInContext(readFileSync(new URL('../../public/ux-progression.js', import.meta.url), 'utf8'), context);
  const { openingUpgrades, openingReceipt } = context.window.OmertaProgressionModel;
  const asset = { id: 'beater', name: 'Beater Sedan', stat: 'speed', boost: 2,
    cost: { price: 5000, fee: 50, tax: 50, total: 5100 }, affordable: true };
  const actor = 'one:1', startedAt = '2026-10-30T18:00:00Z';
  const plan = { actor, asset, startedAt, seen: [] };
  const before = { id: 'one', generation: 1, cash: 5100, assets: [], eff: { speed: 5 } };
  const earned = { ...before, cash: 5300 };
  const receipt = { actor, feedbackId: 'job-1', feedbackState: 'confirmed', state: 'success', method: 'POST',
    path: '/v1/crimes/pickpocket', label: 'A street job', atIso: '2026-10-30T18:01:00Z', resourceCurrent: true };
  const result = { code: 200, body: { ok: true, success: true, take: 200, decisionContext: { crimeId: 'pickpocket', projectedAt: receipt.atIso } } };
  assert.equal(openingUpgrades(before, { openingUpgrades: [asset] }).length, 1);
  assert.equal(openingUpgrades({ ...before, assets: ['beater'] }, { openingUpgrades: [asset] }).length, 0);
  for (const bad of [{ ...asset, id: 'x"] [onclick]' }, { ...asset, cost: { total: 2 } }, { ...asset, stat: 'cash' },
    { ...asset, boost: NaN }, { ...asset, name: '<b>'.repeat(100) }]) {
    assert.equal(openingUpgrades(before, { openingUpgrades: [bad] }).length, 0);
  }
  const first = openingReceipt(plan, receipt, before, earned, result);
  assert.equal(first.job.take, 200);
  assert.equal(first.purchase, undefined);
  assert.equal(plan.job, undefined, 'Observation does not mutate the prior journey');
  assert.equal(openingReceipt(first, receipt, before, earned, result), first, 'Duplicate receipts do not advance progress');
  for (const change of [{ feedbackState: 'unknown' }, { resourceCurrent: false }, { state: 'error' },
    { actor: 'other:1' }, { method: 'GET' }, { isCurrent: () => false }]) {
    assert.equal(openingReceipt(plan, { ...receipt, ...change }, before, earned, result), plan);
  }
  for (const bad of [{ code: 500, body: result.body }, { code: 200, body: { ok: true, success: false, take: 200 } },
    { code: 200, body: { ok: true, success: true, take: 0 } }]) {
    assert.equal(openingReceipt(plan, receipt, before, earned, bad).job, undefined);
  }
  assert.equal(openingReceipt(plan, receipt, before, before, result).job, undefined, 'No cash increase means no confirmed earned step');
  assert.equal(openingReceipt(plan, receipt, before, { ...earned, generation: 2 }, result), plan);
  assert.equal(openingReceipt(plan, { ...receipt, atIso: '2026-10-29T18:00:00Z' }, before, earned, result), plan, 'Old receipts cannot advance a reset journey');
  assert.equal(openingReceipt(plan, receipt, before, earned, { code: 200, body: { ...result.body,
    decisionContext: { crimeId: 'pickpocket', projectedAt: '2026-10-29T18:00:00Z' } } }).job, undefined, 'A replayed pre-start decision cannot earn a fresh step');
  assert.equal(openingReceipt(plan, { ...receipt, resourceCurrent: () => false }, before, earned, result), plan);
  assert.equal(openingReceipt({ actor, startedAt, asset: null }, receipt, before, earned, result).job, undefined);
  const purchaseReceipt = { ...receipt, feedbackId: 'purchase-1', path: '/v1/assets/beater/buy' };
  const purchased = { ...earned, cash: 200, assets: ['beater'], eff: { speed: 7 } };
  const purchaseResult = { code: 200, body: { ok: true, asset: 'beater', spent: 5100 } };
  const complete = openingReceipt(first, purchaseReceipt, earned, purchased, purchaseResult);
  assert.equal(complete.purchase.spent, 5100);
  assert.equal(complete.gain.before, 5); assert.equal(complete.gain.after, 7);
  assert.equal(openingReceipt(plan, purchaseReceipt, earned, purchased, purchaseResult).purchase, undefined,
    'A purchase alone cannot substitute for the earned-job step');
  assert.equal(openingReceipt(first, purchaseReceipt, earned, { ...purchased, eff: earned.eff }, purchaseResult).gain, undefined,
    'A receipt without an observed capability increase does not complete the journey');
  assert.equal(openingReceipt(first, { ...purchaseReceipt, path: '/v1/assets/wasp/buy' }, earned, purchased, purchaseResult).purchase, undefined);
  assert.equal(openingReceipt(first, purchaseReceipt, earned, { ...purchased, assets: [] }, purchaseResult).purchase, undefined);
  console.log('UX journey model: real earnings, exact purchase identity, observed effective gain, duplicate/stale/foreign/unknown refusals and safe catalog passed.');
}

export function runAfterwordSourceProof() {
  const pin = UX_AFTERWORD_SOURCE, root = fileURLToPath(new URL('../../', import.meta.url));
  const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  const sha = text => crypto.createHash('sha256').update(text).digest('hex');
  const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
  const record = (revision, file) => {
    const match = git('ls-tree', '-z', revision, '--', file).match(/^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)\0$/);
    assert(match && match[3] === file, 'Exact regular committed content input'); return { mode: match[1], blob: match[2] };
  };
  const rootSource = assertContractReleaseSourceDefinition();
  const assertActualHeadInput = (file, raw, current, physical = current) => {
    const original = pin.files.find(row => row.file === file); assert(original, 'Closed actual Afterword source subject');
    const desk = rootSource.status === 'BOUND' && Object.hasOwn(rootSource.sourceViews, file)
      && Object.hasOwn(rootSource.sourceViews[file].targets, 'desk') ? rootSource.sourceViews[file] : null;
    const domain = Object.hasOwn(BUSINESS_DESK_DOMAINS, file) ? BUSINESS_DESK_DOMAINS[file] : original;
    const combined = BUSINESS_DESK_COMBINED_SOURCE.files.find(row => row.file === file);
    const expected = desk ? desk.current : combined ? combined.current : { mode: domain.mode, blob: domain.currentBlob,
      sha256: domain.currentSha256, bytes: domain.currentBytes };
    assert.deepEqual(raw, { mode: expected.mode, blob: expected.blob }, 'Actual raw HEAD must qualify before historical bookkeeping');
    assert.equal(typeof current, 'string'); assert.equal(sha(current), expected.sha256);
    assert.equal(blob(current), raw.blob); assert.equal(Buffer.byteLength(current), expected.bytes);
    assert.equal(typeof physical, 'string'); assert.equal(Buffer.from(physical).toString('utf8'), physical);
    assert(physical === current || physical === current.replaceAll('\n', '\r\n'),
      'Complete actual HEAD LF/CRLF physical bytes required before any historical projection');
    return desk;
  };
  // This historical reader first qualifies the complete actual Git postimage.
  // Current runtime and native inputs are never replaced by this source view.
  const rejectCombinedMutation = (file, source) => {
    for (const changed of [source + '\n', '\ufeff' + source, source + '\0', source.replace(/\S/, '?')])
      assert.throws(() => assertBusinessDeskCombinedSourceTransfer(file, changed, 'desk'));
  };
  const historicalHeadRecord = file => {
    let raw = record('HEAD', file);
    const committed = git('show', 'HEAD:' + file);
    const indexed = git('ls-files', '--stage', '--', file).trim();
    assert.equal(indexed, raw.mode + ' ' + raw.blob + ' 0\t' + file, 'Actual index must equal raw HEAD before any historical view');
    const physicalPath = new URL('../../' + file, import.meta.url), stat = lstatSync(physicalPath);
    assert(stat.isFile() && !stat.isSymbolicLink(), 'Actual physical comparison input is a regular file');
    const physical = readFileSync(physicalPath, 'utf8');
    assert(physical === committed || physical === committed.replaceAll('\n', '\r\n'), 'Whole actual physical LF/CRLF bytes match raw HEAD before historical bookkeeping');
    let source = committed;
    const rootDesk = rootSource.status === 'BOUND' && rootSource.sourceViews[file]?.targets.desk;
    if (rootDesk) {
      const outer = assertContractReleaseSourceTransfer(file, committed, 'desk');
      assert.deepEqual(raw, { mode: rootSource.sourceViews[file].current.mode, blob: rootSource.sourceViews[file].current.blob });
      assert.deepEqual([outer.sourceOnly, outer.runtime, outer.native], [true, false, false]);
      assert.equal(outer.sourceRevision, rootSource.sourceRevision);
      assert.equal(outer.predecessorRevision, rootDesk.revision);
      source = outer.baselineText;
      raw = record(outer.predecessorRevision, file);
      assert.deepEqual(raw, { mode: rootDesk.pin.mode, blob: rootDesk.pin.blob });
      assert.equal(source, git('show', outer.predecessorRevision + ':' + file));
    }
    const combined = BUSINESS_DESK_COMBINED_SOURCE.files.find(row => row.file === file && row.parents.desk);
    if (combined) {
      assert.deepEqual(raw, { mode: combined.current.mode, blob: combined.current.blob });
      const proof = assertBusinessDeskCombinedSourceTransfer(file, source, 'desk');
      assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native], [true, false, false]);
      source = proof.targetText;
      raw = { mode: combined.parents.desk.mode, blob: combined.parents.desk.blob };
      assert.deepEqual(raw, record(BUSINESS_DESK_COMBINED_SOURCE.profiles.desk.revision, file));
      assert.equal(source, git('show', BUSINESS_DESK_COMBINED_SOURCE.profiles.desk.revision + ':' + file));
      rejectCombinedMutation(file, rootDesk ? git('show', rootDesk.revision + ':' + file) : committed);
    }
    if (!Object.hasOwn(BUSINESS_DESK_DOMAINS, file)) return raw;
    const domain = BUSINESS_DESK_DOMAINS[file];
    assert.deepEqual(raw, { mode: domain.mode, blob: domain.currentBlob }, 'Actual raw HEAD must qualify before historical bookkeeping');
    const proof = assertBusinessDeskSourceTransfer(file, source);
    assert.deepEqual([proof.sourceOnly, proof.runtime, proof.native], [true, false, false]);
    const predecessor = record(BUSINESS_DESK_PREDECESSOR, file);
    assert.deepEqual(predecessor, { mode: domain.baselineMode, blob: domain.baselineBlob });
    assert.equal(proof.baselineText, git('show', BUSINESS_DESK_PREDECESSOR + ':' + file), 'Historical view remains exact committed predecessor bytes');
    return predecessor;
  };
  const gitInverses = file => {
    const diff = git('diff', '--no-ext-diff', '--no-textconv', '--unified=3', pin.targetRevision, pin.revision, '--', file);
    const hunks = []; let hunk = null;
    for (const line of diff.split('\n')) {
      if (line.startsWith('@@ ')) { hunk = { current: [], baseline: [] }; hunks.push(hunk); }
      else if (hunk && line.startsWith(' ')) { hunk.current.push(line.slice(1)); hunk.baseline.push(line.slice(1)); }
      else if (hunk && line.startsWith('+')) hunk.current.push(line.slice(1));
      else if (hunk && line.startsWith('-')) hunk.baseline.push(line.slice(1));
      else if (hunk && line.startsWith('\\')) assert.fail('Only actual complete newline-terminated Git inputs');
    }
    return hunks.map(row => ({ current: row.current.join('\n') + '\n', baseline: row.baseline.join('\n') + '\n' }));
  };
  assert.equal(pin.revision, '91173f29929b73df9398ba079eb0bbddb73883af');
  assert.equal(pin.targetRevision, 'b35dd222054f0c5f3ca814f228dd7d9a46c58ae9');
  assert.equal(git('rev-parse', pin.revision + '^{tree}').trim(), pin.tree);
  assert.equal(git('rev-parse', pin.targetRevision + '^{tree}').trim(), pin.targetTree);
  git('merge-base', '--is-ancestor', pin.targetRevision, pin.revision);
  let positives = 0, refusals = 0, rawCurrentPositives = 0, rawCurrentRefusals = 0;
  const reject = run => { assert.throws(run); refusals++; };
  const rejectRaw = run => { assert.throws(run); rawCurrentRefusals++; };
  for (const row of pin.files) {
    const current = git('show', pin.revision + ':' + row.file), baseline = git('show', pin.targetRevision + ':' + row.file);
    assert.deepEqual(record(pin.revision, row.file), { mode: row.mode, blob: row.currentBlob });
    assert.deepEqual(record(pin.targetRevision, row.file), { mode: row.targetMode, blob: row.targetBlob });
    assert.deepEqual(historicalHeadRecord(row.file), record(pin.revision, row.file), 'Actual checked-out content remains the authored successor');
    assert.deepEqual(row.inverses, gitInverses(row.file), 'Every ordered inverse is the actual context-three Git hunk');
    assert.equal(sha(current), row.currentSha256); assert.equal(blob(current), row.currentBlob); assert.equal(Buffer.byteLength(current), row.currentBytes);
    assert.equal(sha(baseline), row.targetSha256); assert.equal(blob(baseline), row.targetBlob); assert.equal(Buffer.byteLength(baseline), row.targetBytes);
    const composedBaseline = classicInterfaceHistoricalInput(row.file, baseline);
    if (row.file !== 'src/server.js') assert.equal(composedBaseline, baseline, 'The four existing reader inputs retain their exact B35 identity');
    const actualHead = git('show', 'HEAD:' + row.file), actualRecord = record('HEAD', row.file);
    const rawPhysical = readFileSync(new URL('../../' + row.file, import.meta.url), 'utf8');
    assertActualHeadInput(row.file, actualRecord, actualHead, rawPhysical);
    const physical = businessDeskHistoricalInput(row.file, contractReleaseDeskInput(row.file, rawPhysical));
    assert(physical === current || physical === current.replaceAll('\n', '\r\n'), 'Complete actual LF/CRLF content only');
    for (const input of [actualHead, actualHead.replaceAll('\n', '\r\n')]) {
      assertActualHeadInput(row.file, actualRecord, actualHead, input); rawCurrentPositives++;
    }
    rejectRaw(() => assertActualHeadInput(row.file, { ...actualRecord, mode: '100755' }, actualHead));
    rejectRaw(() => assertActualHeadInput(row.file, { ...actualRecord, blob: '0'.repeat(40) }, actualHead));
    rejectRaw(() => assertActualHeadInput(row.file, actualRecord, actualHead + '\n'));
    for (const input of [actualHead + '\n', actualHead.slice(1), '\ufeff' + actualHead, actualHead + '\0',
      actualHead.replace('\n', '\r\n'), actualHead.replace('\n', '\r'), baseline]) {
      rejectRaw(() => assertActualHeadInput(row.file, actualRecord, actualHead, input));
    }
    if (row.file === 'src/server.js') {
      for (const input of [git('show', rootSource.baseRevision + ':' + row.file), current]) {
        assert.notEqual(input, actualHead, 'The stale server fixture differs from actual HEAD');
        rejectRaw(() => assertActualHeadInput(row.file, actualRecord, actualHead, input));
      }
    }
    for (const input of [current, current.replaceAll('\n', '\r\n')]) {
      const proof = qualifyUxAfterwordSource(row.file, input);
      assert.equal(proof.baselineText, baseline); assert.equal(proof.sourceRevision, pin.revision); assert.equal(proof.targetRevision, pin.targetRevision);
      assert.equal(proof.sourceOnly, true); assert.equal(proof.native, false); assert.equal(proof.runtime, false);
      assert.equal(uxAfterwordHistoricalInput(row.file, input), baseline);
      assert.equal(classicInterfaceHistoricalInput(row.file, input), composedBaseline, 'Existing strict reader composition matches exact B35 composition');
      assert(uxAfterwordHistoricalInput(row.file, Buffer.from(input)).equals(Buffer.from(baseline))); positives += 2;
    }
    assert.equal(uxAfterwordHistoricalInput(row.file, baseline), baseline, 'Historical input remains unchanged');
    for (const input of [current + '\n', current.slice(1), '\ufeff' + current, current + '\0', current.replace('\n', '\r\n'), current.replace('\n', '\r'), Buffer.from(current), current.replace(/\S/, '?')]) {
      reject(() => qualifyUxAfterwordSource(row.file, input));
    }
    for (const inverse of row.inverses) for (const input of [current.replace(inverse.current, ''), current.replace(inverse.current, () => inverse.current + inverse.current), current.replace(inverse.current, () => inverse.baseline)]) {
      reject(() => qualifyUxAfterwordSource(row.file, input));
      assert.equal(uxAfterwordHistoricalInput(row.file, input), input, 'Partial/unknown sources cannot be projected into the historical namespace');
      if (input !== baseline) assert.notEqual(sha(classicInterfaceHistoricalInput(row.file, input)), sha(composedBaseline));
    }
    for (const input of [current + '\n// unreviewed\n', current.replace(/\S/, '?')]) {
      assert.equal(uxAfterwordHistoricalInput(row.file, input), input); assert.notEqual(sha(classicInterfaceHistoricalInput(row.file, input)), sha(composedBaseline));
    }
    reject(() => uxAfterwordHistoricalInput(row.file, Buffer.from([255])));
    reject(() => { row.currentSha256 = '0'.repeat(64); });
    reject(() => qualifyUxAfterwordSource(row.file, current, structuredClone(pin)));
  }
  for (const file of ['__proto__', 'constructor', '../src/content/phase1.js', 'src/content/neighborhood-afterword.js', 'src/unknown.js']) {
    rejectRaw(() => assertActualHeadInput(file, { mode: '100644', blob: '0'.repeat(40) }, 'unknown'));
    reject(() => qualifyUxAfterwordSource(file, 'unknown')); const buffer = Buffer.from('unknown');
    assert.equal(uxAfterwordHistoricalInput(file, buffer), buffer); assert.equal(uxAfterwordHistoricalInput(file, 'unknown'), 'unknown');
  }
  assert.deepEqual(pin.files.map(row => row.file), UX_AFTERWORD_SOURCE_FILES);
  assert.equal(pin.files.reduce((sum, row) => sum + row.inverses.length, 0), 9);
  console.log(JSON.stringify({ phase: 'EXACT_UX_AFTERWORD_SOURCE_ONLY', source: pin.revision, predecessor: pin.targetRevision,
    files: 5, afterwordContentFiles: 3, mergedPolicySourceInputs: 1, existingTestSourceInputs: 1, inverseHunks: 9, positives, refusals, actualGitModesBlobsTreesAndWholeInverse: true, unchangedOriginalReaderAssertions: true,
    rawCurrentPositives, rawCurrentRefusals, actualRawHeadAndPhysicalGate: true,
    runtime: false, native: false, releaseQualified: false }));
}
