// Exact app-source proof only. Historical test text is reconstructed for comparison, never execution.
import { businessDeskCombinedHistoricalInput, BUSINESS_DESK_COMBINED_SOURCE_FILES } from '../tools/businessdesk-combined-source-transfer.js';
import assert from 'node:assert/strict';
import { integratedEconomicSource, integratedEconomicParentInput } from '../tools/integrated-economic-parent-source.js';
import { businessDeskHistoricalInput } from '../tools/businessdesk-source-transfer.js';
import { wikiMediaMergeHistoricalInput } from '../tools/wiki-media-source-transfer.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { currentEconomicTermsBaseline, currentEconomicTermsPin } from '../tools/current-economic-terms-source-transfer.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as deedNative } from '../tools/economic-deed-parent-native-inputs.js';
import { combinedEconomicDeedPin as combined, combinedEconomicDeedInput, combinedEconomicTermsInput, combinedEconomicFixtureInput } from '../tools/combined-economic-deed-source-transfer.js';
import { execFileSync } from 'node:child_process';
import { noirUiHistoricalInput } from '../tools/noir-ui-source-transfer.js';
import { DEED_ALLOCATION_SOURCE_PREDECESSOR, DEED_ALLOCATION_SOURCE_PREDECESSOR_TREE,
  DEED_ALLOCATION_SOURCE_PHASE, DEED_ALLOCATION_SOURCE_DOMAINS,
  assertDeedAllocationSourceTransfer, deedAllocationHistoricalInput } from '../tools/deed-allocation-source-transfer.js';
import { economyUxMergeCandidateHistoricalInput, economyUxMergeMainHistoricalInput }
  from '../tools/economy-ux-merge-source-compatibility.js';
import { economyDeedMergeHistoricalInput } from '../tools/economy-deed-merge-source-compatibility.js';
import { economyMonitorHistoricalInput } from '../tools/economy-monitor-source-transfer.js';

const lf = text => text.replaceAll('\r\n', '\n');
const sha256 = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const git = (...args) => lf(execFileSync('git', ['--no-replace-objects', ...args], {
  encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
}));
assert.deepEqual(process.argv.slice(2), [], 'Bare source-only entry point required');
assert.equal(DEED_ALLOCATION_SOURCE_PREDECESSOR, 'b35dd222054f0c5f3ca814f228dd7d9a46c58ae9');
assert.equal(git('rev-parse', `${DEED_ALLOCATION_SOURCE_PREDECESSOR}^{tree}`).trim(), DEED_ALLOCATION_SOURCE_PREDECESSOR_TREE);
git('merge-base', '--is-ancestor', DEED_ALLOCATION_SOURCE_PREDECESSOR, 'HEAD');
assert.equal(DEED_ALLOCATION_SOURCE_PHASE,
  'exact-deed-allocation-source-transfer-only; no historical runtime, native, migration, financial, genesis, activation or deployment clearance');
assert(Object.isFrozen(DEED_ALLOCATION_SOURCE_DOMAINS));
assert.deepEqual(Object.keys(DEED_ALLOCATION_SOURCE_DOMAINS), [
  'AGENTS.md', 'docs/WIKI.md', 'docs/character-deed-policy-2026-10-14.md', 'package.json',
  'public/index.html', 'public/sale.html', 'src/accrual.js', 'src/db.js', 'src/deedbuildings.js',
  'src/deeddiscovery.js', 'src/deeds.js', 'src/game.js', 'test/deed-discovery-ui.js', 'test/deeddiscovery.js',
  'test/economy-hardening-source-compatibility.js', 'tools/economy-ux-merge-source-compatibility.js',
  'tools/pgquery.js',
  'tools/commerce-current-native-guard.js', 'test/commerce-current-native-guard.js',
  'tools/enterprise-native-ux.js', 'tools/enterprise-native-ux-seal.js',
  'tools/enterprise-native.js', 'test/lib/enterprise-ux-native-guard.js',
  'test/companybankportfolios.js', 'test/companyworkflows.js',
  'test/family-operation-concurrency.js', 'test/family-operations.js',
  'test/furnace-ledger.js', 'test/recipe-policy.js', 'test/world-kernel.js',
  'test/world-projection.js', 'test/lib/player-command-support.js',
  'test/director-migration.js',
  'docs/legal-security-setup.md', 'src/legal.js', 'test/legal-security.js',
  'test/lib/phase2-definition-fixtures.js', 'tools/ux-release-phase2-native-catalog.js',
  'src/content/city-quest-presentation.js', 'src/content/phase1-policy.js', 'src/content/phase1.js',
  'test/worldgraph-validation.js',
  'public/ux-coordination.css', 'public/ux-coordination.js',
  'public/ux-navigation.css', 'public/ux-navigation.js',
  'public/ux-progression.css', 'public/ux-progression.js',
  'public/ux-tactics.css', 'public/ux-tactics.js',
  'src/ux-story.js', 'src/ux-tactics.js', 'tools/ux-source-compatibility.js',
  'src/worldgraph-ui.js',
  'src/age.js', 'src/server.js',
  'test/sale-source-compatibility.js', 'test/ux-source-compatibility.js',
  'test/lib/ux-native-reader-source-compatibility.js',
  'test/client.js',
], 'Only the closed reviewed Deed allocation domains receive a source alias');

let positives = 0, refusals = 0, hunks = 0;
for (const [file, pin] of Object.entries(DEED_ALLOCATION_SOURCE_DOMAINS)) {
  const rawPhysical = fs.readFileSync(file, 'utf8'), checkedOut = git('show', 'HEAD:' + file);
  const stat = fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink());
  assert(rawPhysical === checkedOut || rawPhysical === checkedOut.replaceAll('\n', '\r\n'),
    'Actual whole source must match HEAD before the comparison-only view: ' + file);
  const currentBlob = git('rev-parse', 'HEAD:' + file).trim();
  assert.equal(git('ls-tree', 'HEAD', '--', file).trim(), '100644 blob ' + currentBlob + '\t' + file);
  assert.equal(git('ls-files', '--stage', '--', file).trim(), '100644 ' + currentBlob + ' 0\t' + file);
  const deskPhysical = businessDeskCombinedHistoricalInput(file, integratedEconomicParentInput(file, rawPhysical, 'main'), 'desk');
  const physical = businessDeskHistoricalInput(file, noirUiHistoricalInput(file,
    wikiMediaMergeHistoricalInput(file, economyDeedMergeHistoricalInput(file, deskPhysical, 'deed')))), current = lf(physical);
  const baseline = git('show', `${DEED_ALLOCATION_SOURCE_PREDECESSOR}:${file}`);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.inverses) && Object.isFrozen(pin.currentRawSha256));
  assert.equal(pin.contextLines, 3); assert.equal(pin.currentMode, '100644'); assert.equal(pin.baselineMode, '100644');
  assert.equal(git('ls-tree', DEED_ALLOCATION_SOURCE_PREDECESSOR, '--', file).trim().split(/\s+/)[0], pin.baselineMode);
  assert.equal(git('ls-files', '--stage', '--', file).trim().split(/\s+/)[0], pin.currentMode);
  assert.equal(sha256(current), pin.currentSha256); assert.equal(blob(current), pin.currentBlob);
  assert.equal(current, git('cat-file', 'blob', pin.currentBlob));
  assert.equal(baseline, git('cat-file', 'blob', pin.baselineBlob));
  const actual = []; let hunk = null;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', pin.baselineBlob, pin.currentBlob).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; actual.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
    }
  }
  assert.deepEqual(pin.inverses, actual, 'Only complete actual Git inverse contexts are admitted');
  for (const raw of [physical, current, current.replaceAll('\n', '\r\n')]) {
    const proof = assertDeedAllocationSourceTransfer(file, raw);
    assert.equal(proof.baselineText, baseline); assert.equal(proof.sourceOnly, true);
    assert.equal(proof.runtime, false); assert.equal(proof.native, false);
    assert.equal(proof.inverseChunks, pin.inverses.length);
    assert.equal(deedAllocationHistoricalInput(file, raw), baseline);
    assert.deepEqual(deedAllocationHistoricalInput(file, Buffer.from(raw)), Buffer.from(baseline));
    for (const compose of [economyUxMergeCandidateHistoricalInput, economyUxMergeMainHistoricalInput])
      assert.deepEqual(compose(file, raw, 'deed'), compose(file, baseline, 'deed'), 'The explicit Deed profile preserves historical composition');
    positives++;
  }
  const reject = text => {
    assert.notEqual(text, current);
    assert.throws(() => assertDeedAllocationSourceTransfer(file, text));
    assert.equal(deedAllocationHistoricalInput(file, text), text, 'Unknown bytes retain their original rejecting form');
    assert.deepEqual(deedAllocationHistoricalInput(file, Buffer.from(text)), Buffer.from(text));
    refusals++;
  };
  for (const text of [current + '\n// unreviewed drift\n', current.slice(1), '\ufeff' + current,
    current.replace(/\S/, '?'), current.replace('\n', '\r\n'), current.replace('\n', '\r'), baseline]) reject(text);
  for (const inverse of pin.inverses) {
    assert(Object.isFrozen(inverse));
    reject(current.replace(inverse.current, ''));
    reject(current.replace(inverse.current, () => inverse.current + inverse.current));
    reject(current.replace(inverse.current, () => inverse.baseline));
    reject(current.replace(inverse.current, () => inverse.current.replace(/\S/, '?')));
    hunks++;
  }
  const invalid = Buffer.concat([Buffer.from(current), Buffer.from([0xff])]);
  assert.throws(() => deedAllocationHistoricalInput(file, invalid)); refusals++;
}
for (const file of ['__proto__', 'constructor', 'src/unknown.js', 'src/deedbenefits.js', 'schema.sql',
  'tools/enterprise-native-deed-inputs.js']) {
  const text = 'unknown\r\nbytes\n', invalid = Buffer.from([0xff]);
  assert.throws(() => assertDeedAllocationSourceTransfer(file, text));
  assert.equal(deedAllocationHistoricalInput(file, text), text);
  assert.strictEqual(deedAllocationHistoricalInput(file, invalid), invalid);
  refusals++;
}
for (const file of [null, { toString: () => 'package.json' }]) {
  const text = fs.readFileSync('package.json', 'utf8');
  assert.throws(() => assertDeedAllocationSourceTransfer(file, text));
  assert.equal(deedAllocationHistoricalInput(file, text), text); refusals++;
}
const actualSchema = lf(fs.readFileSync('schema.sql', 'utf8'));
assert.equal(deedAllocationHistoricalInput('schema.sql', actualSchema), actualSchema, 'Deed normalization excludes the native schema');
assert.equal(currentEconomicTermsBaseline('schema.sql', integratedEconomicParentInput('schema.sql', actualSchema, 'economic')), git('show', `${DEED_ALLOCATION_SOURCE_PREDECESSOR}:schema.sql`),
  'Only the independently reviewed economic schema can reconstruct its predecessor for source comparison');
assert.equal(lf(economyMonitorHistoricalInput('schema.sql', integratedEconomicParentInput('schema.sql', actualSchema, 'main'))),
  git('show', `${DEED_ALLOCATION_SOURCE_PREDECESSOR}:schema.sql`),
  'Deed source transfer grants no schema/native migration alias; only the separately pinned monitor index is reconstructed');
for (const file of ['tools/deed-quest-source-transfer.js', 'tools/economy-hardening-source-transfer.js',
  'tools/next-five-source-compatibility.js', 'tools/release-source-transfer.js', 'tools/continuous-city-source-data.js'])
  assert.equal(lf(fs.readFileSync(file, 'utf8')), git('show', `${DEED_ALLOCATION_SOURCE_PREDECESSOR}:${file}`),
    'Historical literal source pins remain unchanged: ' + file);
assert.equal(lf(fs.readFileSync('tools/enterprise-native-ux-b35-inputs.js', 'utf8')),
  git('show', `${DEED_ALLOCATION_SOURCE_PREDECESSOR}:tools/enterprise-native-ux-inputs.js`),
  'The archived B35 native manifest retains its exact historical Git bytes');
assert.equal(lf(fs.readFileSync('tools/enterprise-native-ux-inputs.js', 'utf8')),
  git('show', '845973dfc5b66e4105dea84e5967e74f1950af13:tools/enterprise-native-ux-inputs.js'),
  'The qualified UX manifest retains its exact authored Git bytes at the original path');
console.log(`Deed allocation exact source compatibility PASS: ${positives} positives, ${refusals} refusals, ${hunks} complete Git inverse hunks; source only`);

// The authored merge and the Deed release both stay independently identifiable after later proof commits.
assert.equal(combined.source,'c220834210928560f303795086ee1098d0a65509');
assert.equal(combined.predecessor,'4e5f7fdb1cc4d2055ac613d2d4cb562a8007c364');
git('merge-base','--is-ancestor',combined.predecessor,combined.source);
git('merge-base','--is-ancestor',combined.source,'HEAD');
for(const [revision,tree] of [[combined.source,combined.sourceTree],[combined.predecessor,combined.predecessorTree]])
  assert.equal(git('rev-parse',revision+'^{tree}').trim(),tree);
const changed=git('diff','--name-only','-z',combined.predecessor,combined.source).split('\0').filter(Boolean);
const deedNativeFiles=new Set(deedNative.files.map(row=>row.file));
assert.deepEqual(Object.keys(combined.files),changed.filter(file=>Object.hasOwn(DEED_ALLOCATION_SOURCE_DOMAINS,file)));
assert.deepEqual(Object.keys(combined.nativeFiles),changed.filter(file=>deedNativeFiles.has(file)));
assert.deepEqual(Object.keys(combined.economicFiles),['public/wiki.html']);
for(const file of new Set([...Object.keys(combined.files),...Object.keys(combined.economicFiles),...Object.keys(combined.nativeFiles)])) {
  const economicOnly=Object.hasOwn(combined.economicFiles,file);
  const inputFor=economicOnly ? combinedEconomicTermsInput : combinedEconomicDeedInput;
  const row=combined.files[file]??combined.economicFiles[file]??combined.nativeFiles[file];
  if(combined.nativeFiles[file]) {
    assert.deepEqual(combined.nativeFiles[file],{current:row.current,baseline:row.baseline});
    assert(!Object.hasOwn(combined.nativeFiles[file],'inverses'));
  }
  const current=git('show',combined.source+':'+file), prior=git('show',combined.predecessor+':'+file);
  for(const [rev,text,pin] of [[combined.source,current,row.current],[combined.predecessor,prior,row.baseline]]) {
    assert.equal(git('ls-tree',rev,'--',file).trim(),pin.mode+' blob '+pin.blob+'\t'+file);
    assert.equal(sha256(text),pin.sha256); assert.equal(Buffer.byteLength(text),pin.bytes);
  }
  const physical=fs.readFileSync(file,'utf8'), head=git('show','HEAD:'+file);
  assert(physical===head || physical===head.replaceAll('\n','\r\n'),'Exact physical integration source: '+file);
  assert.equal(git('ls-tree','HEAD','--',file).trim(),git('ls-tree',integratedEconomicSource.revision,'--',file).trim(),
    'Current mode and blob must match the reviewed integrated source: '+file);
  if(economicOnly || Object.hasOwn(combined.files,file)) {
    assert.equal(lf(integratedEconomicParentInput(file,physical,'economic')),current,'Exact economic merge parent: '+file);
  }
  if(economicOnly) {
    assert.strictEqual(combinedEconomicDeedInput(file,physical),physical);
    assert.equal(currentEconomicTermsBaseline(file,integratedEconomicParentInput(file,physical,'economic')),prior);
  }
  if(!economicOnly && !Object.hasOwn(combined.files,file)) {
    assert.strictEqual(combinedEconomicDeedInput(file,physical),physical,'Native-only inputs never receive historical substitutions');
    continue;
  }
  for(const text of [current,current.replaceAll('\n','\r\n')])
    assert.equal(inputFor(file,text),prior);
  assert.deepEqual(inputFor(file,Buffer.from(current)),Buffer.from(prior));
  for(const input of [prior,current.slice(1),current+'\n',current.replace('\n','\r\n'),current+'\0'])
    assert.strictEqual(inputFor(file,input),input);
  const invalid=Buffer.from([255]);
  assert.throws(()=>inputFor(file,invalid),/lossless/i);
}
console.log('Verified the merged economic and Deed source and its separate native input identities.');

assert.deepEqual(Object.keys(combined.fixtureFiles),['test/lib/rc1-historical-source-fixture.js']);
for(const [file,row] of Object.entries(combined.fixtureFiles)) {
  assert.deepEqual(combined.nativeFiles[file],{current:row.current,baseline:row.baseline});
  const current=git('show',combined.source+':'+file), prior=git('show',combined.predecessor+':'+file);
  for(const input of [current,current.replaceAll('\n','\r\n'),Buffer.from(current)]) {
    const restored=combinedEconomicFixtureInput(file,input);
    assert.equal(String(restored),prior);
    assert.equal(Buffer.isBuffer(restored),Buffer.isBuffer(input));
    assert.equal(String(currentEconomicTermsBaseline(file,input)),prior);
  }
  for(const input of [prior,current+'\n',current.slice(1),'\ufeff'+current,current+'\0',current.replace('\n','\r\n'),current.replace(/\S/,'?')])
    assert.strictEqual(combinedEconomicFixtureInput(file,input),input);
  for(const inverse of row.inverses) {
    const partial=current.slice(0,inverse.at)+inverse.baseline+current.slice(inverse.at+inverse.current.length);
    assert.strictEqual(combinedEconomicFixtureInput(file,partial),partial);
  }
  assert.throws(()=>combinedEconomicFixtureInput(file,Buffer.from([255])),/lossless/i);
}
for(const file of ['src/store.js','__proto__','../test/lib/rc1-historical-source-fixture.js'])
  assert.strictEqual(combinedEconomicFixtureInput(file,'unknown'),'unknown');
console.log('Verified the separate exact RC1 fixture source reconstruction and mutation refusals.');

// Seal only the changed paths in the two existing comparison domains. Execution always uses the checkout.
const integration = integratedEconomicSource;
assert.deepEqual(integration.parents, {
  economic:'3cf03ab3ebec43983b59ee07849594ed34f3dcae',
  main:'68a4d92d810ee17c192abb8a8c2a3fcbf87c4c52',
});
assert.equal(git('rev-parse',integration.revision+'^{tree}').trim(),integration.tree);
git('merge-base','--is-ancestor',integration.revision,'HEAD');
const economicDomain = new Set([currentEconomicTermsPin.files, combined.files, combined.noirFiles,
  combined.economicFiles, combined.fixtureFiles].flatMap(Object.keys));
const mainDomain = new Set([...BUSINESS_DESK_COMBINED_SOURCE_FILES, ...Object.keys(DEED_ALLOCATION_SOURCE_DOMAINS), ...economicDomain]);
for (const [profile,parent] of Object.entries(integration.parents)) {
  git('merge-base','--is-ancestor',parent,integration.revision);
  const domain = profile === 'main' ? mainDomain : economicDomain;
  const changed = git('diff','--name-only','--diff-filter=M','-z',parent,integration.revision).split('\0').filter(file=>domain.has(file));
  assert.deepEqual(Object.keys(integration.files).filter(file=>Object.hasOwn(integration.files[file].parents,profile)).sort(),changed.sort());
  for (const file of changed) {
    const row = integration.files[file], target = row.parents[profile];
    const current = git('show',integration.revision+':'+file), predecessor = git('show',parent+':'+file);
    for (const [rev,source,pin] of [[integration.revision,current,row.current],[parent,predecessor,target.pin]]) {
      assert.equal(git('ls-tree',rev,'--',file).trim(),pin.mode+' blob '+pin.blob+'\t'+file);
      assert.equal(sha256(source),pin.sha256); assert.equal(Buffer.byteLength(source),pin.bytes);
    }
    assert.equal(git('ls-tree','HEAD','--',file).trim(),git('ls-tree',integration.revision,'--',file).trim());
    assert.equal(git('ls-files','--stage','--',file).trim(),row.current.mode+' '+row.current.blob+' 0\t'+file);
    const stat=fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink());
    const raw = fs.readFileSync(file);
    assert(raw.equals(Buffer.from(current)) || raw.equals(Buffer.from(current.replaceAll('\n','\r\n'))));
    for (const input of [current,current.replaceAll('\n','\r\n'),raw]) {
      const result = integratedEconomicParentInput(file,input,profile);
      assert.equal(String(result),predecessor); assert.equal(Buffer.isBuffer(result),Buffer.isBuffer(input));
    }
    for (const input of [current+'\n', current.slice(1), current.replace('\n','\r\n'), '\ufeff'+current, current+'\0', predecessor]) {
      assert.strictEqual(integratedEconomicParentInput(file,input,profile),input);
    }
    for (const h of target.inverses) {
      const partial = current.slice(0,h.at)+h.baseline+current.slice(h.at+h.current.length);
      assert.notEqual(partial,current); assert.strictEqual(integratedEconomicParentInput(file,partial,profile),partial);
    }
    assert.throws(()=>integratedEconomicParentInput(file,Buffer.from([255]),profile),/lossless/i);
  }
}
for (const path of ['../package.json','__proto__','tools/enterprise-native-deed-inputs.js']) {
  const invalid=Buffer.from([255]);
  assert.strictEqual(integratedEconomicParentInput(path,invalid,'main'),invalid);
}
console.log('Verified complete comparison postimages for both reviewed economic integration parents.');
