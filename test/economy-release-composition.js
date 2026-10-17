import {hasFinalServicesCommerceSource,finalServicesOverCommerceSourceBaseline} from '../tools/finalservices-commerce-source-compatibility.js';
const selectFinalServicesCommerceTestSource=(file,input)=>hasFinalServicesCommerceSource(file)?finalServicesOverCommerceSourceBaseline(file,String(input)):input;
import {hasCommerceCurrentEnterpriseSource,commerceOverCurrentEnterpriseSourceBaseline} from "../tools/commerce-current-enterprise-source-compatibility.js";
import {nextFiveSourceBaseline} from '../tools/next-five-source-compatibility.js';
import { cityActivitySourceBaseline } from '../tools/rc1-city-activity-source-compatibility.js';
import {hasEnterpriseOverRootSource,enterpriseOverRootSourceBaseline} from '../tools/enterprise-current-source-compatibility.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { COMPOSITION_REVISION, COMPOSITION_PHASE, COMPOSITION_PROFILES,
  assertEconomyReleaseComposition, economyReleaseSource } from '../tools/economy-release-composition.js';
import { fourthBatchMigrationSchema, fourthBatchSourceBaseline } from '../tools/rc1-fourth-batch-source-compatibility.js';
import { fifthBatchMigrationSchema, fifthBatchSourceBaseline } from '../tools/rc1-fifth-batch-source-compatibility.js';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const lf = text => text.replaceAll('\r\n', '\n');
assert.match(COMPOSITION_REVISION, /^[a-f0-9]{40}$/);
assert.equal(COMPOSITION_PHASE, 'exact-source-transfer-only; no native, migration, financial or deployment clearance');
assert.deepEqual(Object.keys(COMPOSITION_PROFILES), ['commercial', 'main', 'autonomy', 'city']);
let domains = 0, negatives = 0;
for (const [profile, files] of Object.entries(COMPOSITION_PROFILES)) {
  for (const [file, pin] of Object.entries(files)) {
    const current = git('show', COMPOSITION_REVISION + ':' + file);
    const prior = git('cat-file', 'blob', pin.baselineBlob);
    assert.equal(nextFiveSourceBaseline(file, lf(cityActivitySourceBaseline(file, (hasEnterpriseOverRootSource(file)?enterpriseOverRootSourceBaseline(file,(hasCommerceCurrentEnterpriseSource(file)?commerceOverCurrentEnterpriseSourceBaseline(file,String(selectFinalServicesCommerceTestSource(file,fs.readFileSync(file, 'utf8')))):selectFinalServicesCommerceTestSource(file,fs.readFileSync(file, 'utf8')))):fs.readFileSync(file, 'utf8'))))), current, 'Complete actual source retains its reviewed composition');
    const actual = []; let hunk;
    for (const line of git('diff', '--no-ext-diff', '--unified=' + pin.contextLines, pin.baselineBlob, pin.currentBlob).split('\n')) {
      if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; actual.push(hunk); }
      else if (hunk && /^[ +\-]/.test(line)) {
        if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
        if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
      }
    }
    assert.deepEqual(pin.inverses, actual, 'Only actual immutable Git inverse hunks are admitted');
    for (const text of [current, current.replaceAll('\n', '\r\n')]) {
      assert.equal(assertEconomyReleaseComposition(profile, file, text).baselineText, prior);
      assert.equal(economyReleaseSource(profile, file, text), prior);
    }
    const reject = text => {
      assert.notEqual(text, current);
      assert.throws(() => assertEconomyReleaseComposition(profile, file, text));
      assert.equal(economyReleaseSource(profile, file, text), text, 'Unknown source remains unchanged for the original rejecting guard');
      negatives++;
    };
    for (const text of [current + '\n// drift\n', current.slice(1), '\ufeff' + current,
      current.replace(/\S/, '?'), current.replace('\n', '\r\n')]) reject(text);
    for (const inverse of pin.inverses) {
      reject(current.replace(inverse.current, ''));
      reject(current.replace(inverse.current, () => inverse.current + inverse.current));
      reject(current.replace(inverse.current, () => inverse.baseline));
      reject(current.replace(inverse.current, () => inverse.current.replace(/\S/, '?')));
    }
    domains++;
  }
}
for (const [profile, file] of [['unknown', 'schema.sql'], ['main', 'src/unknown.js'], ['commercial', '__proto__']]) {
  const text = 'unknown\r\nbytes\n';
  assert.throws(() => assertEconomyReleaseComposition(profile, file, text));
  assert.equal(economyReleaseSource(profile, file, text), text);
  negatives++;
}
console.log(`economy release composition: ${domains} complete source domains, ${negatives} rejecting controls; source only`);
const mergedSchema = git('show', COMPOSITION_REVISION + ':schema.sql');
for (const text of [mergedSchema, mergedSchema.replaceAll('\n', '\r\n')]) {
  assert.notEqual(fourthBatchSourceBaseline('schema.sql', text), text, 'Exact source reconstruction is available');
  assert.equal(fourthBatchMigrationSchema(text), text, 'Source reconstruction never grants historical native schema admission');
  assert.notEqual(fifthBatchSourceBaseline('schema.sql', text), text, 'Exact autonomy source reconstruction is available');
  assert.equal(fifthBatchMigrationSchema(text), text, 'Autonomy source reconstruction never grants historical native schema admission');
}
