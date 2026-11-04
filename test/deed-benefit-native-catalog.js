import assert from 'node:assert/strict';
import { assertDeedBenefitNativeMigration, deedBenefitNativeExpectedMetadata,
  deedBenefitNativeProjection } from '../tools/deed-benefit-native-catalog.js';

let positives = 0, refusals = 0;
const rejects = action => { assert.throws(action, error => error?.code === 'ERR_ASSERTION'); refusals++; };
const fields = ['relations', 'columns', 'constraints', 'indexes'];
const altered = value => typeof value === 'boolean' ? !value : typeof value === 'number' ? value + 1
  : Array.isArray(value) ? [...value, 'unknown'] : value === null ? 'unknown' : value + '__changed';
await assertDeedBenefitNativeMigration(); positives++;
for (const version of [160000, 180004]) {
  const reference = deedBenefitNativeExpectedMetadata(version), mutable = structuredClone(reference);
  const projection = deedBenefitNativeProjection(mutable, version);
  mutable.columns[0].type = 'mutated-after-capture';
  const predecessor = Object.fromEntries(fields.map(field => [field, [{ historical: field }]]));
  const current = projection.extendReference(predecessor);
  assert.deepEqual(projection.projectMetadata(current), predecessor); positives++;
  assert.deepEqual(projection.reference, reference); positives++;
  assert.throws(() => projection.reference.columns.push({}), TypeError); positives++;
  rejects(() => projection.extendReference(current));
  for (const field of fields) for (let at = 0; at < reference[field].length; at++) {
    const row = reference[field][at];
    for (const candidate of [
      { ...current, [field]: current[field].filter((_, index) => index !== at + 1) },
      { ...current, [field]: [...current[field], { ...row }] },
    ]) rejects(() => projection.projectMetadata(candidate));
    for (const property of Object.keys(row)) {
      const change = { ...row, [property]: altered(row[property]) };
      rejects(() => projection.projectMetadata({ ...current,
        [field]: current[field].map((candidate, index) => index === at + 1 ? change : candidate) }));
      rejects(() => deedBenefitNativeProjection({ ...reference,
        [field]: reference[field].map((candidate, index) => index === at ? change : candidate) }, version));
    }
    const changedReference = { ...reference, [field]: [...reference[field], { ...row }] };
    rejects(() => deedBenefitNativeProjection(changedReference, version));
  }
  for (const includeNotNull of [false, true]) {
    const marker = reference.constraints.filter(row => includeNotNull || row.type !== 'n')
      .map(({ table_name, name, definition }) => ({ table_name, name, definition }));
    const old = [{ table_name: 'old_table', name: 'old_key', definition: 'PRIMARY KEY (id)' }];
    const rows = [...old, ...marker];
    assert.deepEqual(projection.projectConstraints(rows, includeNotNull), old); positives++;
    for (let at = 0; at < marker.length; at++) {
      rejects(() => projection.projectConstraints(rows.filter((_, index) => index !== at + 1), includeNotNull));
      rejects(() => projection.projectConstraints([...rows, { ...marker[at] }], includeNotNull));
      for (const property of Object.keys(marker[at])) rejects(() => projection.projectConstraints(
        rows.map((row, index) => index === at + 1 ? { ...row, [property]: altered(row[property]) } : row), includeNotNull));
    }
  }
  const fullCurrentOracle = metadata => assert.deepEqual(projection.projectMetadata(metadata), predecessor);
  for (const field of fields) rejects(() => fullCurrentOracle({ ...current,
    [field]: [...current[field], { unknown: 'extra-unmodeled-object' }] }));
  rejects(() => projection.projectConstraints([], 'true'));
  rejects(() => projection.projectMetadata({ ...current, unknown: [] }));
  rejects(() => projection.projectMetadata(Object.fromEntries(Object.entries(current).filter(([field]) => field !== 'indexes'))));
  rejects(() => deedBenefitNativeProjection({ ...reference, unknown: [] }, version));
}
for (const version of [0, 159999, 170000, 179999, 190000, '180004', null]) {
  rejects(() => deedBenefitNativeExpectedMetadata(version));
}
console.log(`deed-benefit-native-catalog: ${positives} source/metadata controls, ${refusals} refusals; no native admission or PostgreSQL execution claimed`);
