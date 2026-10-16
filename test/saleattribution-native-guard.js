import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { assertSaleAttributionNativeBytes, assertSaleAttributionNativeMode, assertSaleAttributionNativeBackend, saleAttributionNativeEndpoint,
  SALE_ATTRIBUTION_NATIVE_SOURCES } from './saleattribution-native-fixture.js';
let controls = 0;
const reject = fn => { assert.throws(fn); controls++; };
const environment = { RESOURCE_ECONOMY: 'off', CHAIN_ENABLED: 'off' };
assertSaleAttributionNativeMode(['node', 'proof', '--postgres'], environment);
for (const argv of [[], ['node', 'proof'], ['node', 'proof', '--memory'], ['node', 'proof', '--postgres', '--partial']])
  reject(() => assertSaleAttributionNativeMode(argv, environment));
for (const key of ['DATABASE_URL', 'NODE_OPTIONS', 'node_options', 'NODE_PATH', 'RESOURCE_ECONOMY', 'CHAIN_ENABLED'])
  reject(() => assertSaleAttributionNativeMode(['node', 'proof', '--postgres'], { ...environment, [key]: key.includes('ENABLED') || key.includes('ECONOMY') ? 'on' : '' }));
for (const url of ['postgresql://pilot_runner@127.0.0.1:35439/consignment_test_012345abcdef',
  'postgresql://pilot_runner@127.0.0.1:35449/consignment_test_012345abcdef',
  'postgresql://postgres:pgcheck@127.0.0.1:5432/consignment_test_012345abcdef']) saleAttributionNativeEndpoint(url);
for (const url of ['postgresql://pilot_runner@localhost:35449/consignment_test_012345abcdef',
  'postgresql://pilot_runner@remote:35449/consignment_test_012345abcdef',
  'postgresql://pilot_runner:x@127.0.0.1:35449/consignment_test_012345abcdef',
  'postgresql://pilot_runner@127.0.0.1:35449/postgres',
  'postgresql://pilot_runner@127.0.0.1:35449/consignment_test_012345abcdef_extra',
  'postgresql://pilot_runner@127.0.0.1:35449/consignment_test_012345ABCDEF',
  'postgresql://pilot_runner@127.0.0.1:35448/consignment_test_012345abcdef',
  'postgresql://postgres:wrong@127.0.0.1:5432/consignment_test_012345abcdef',
  'postgresql://pilot_runner@127.0.0.1:35449/consignment_test_012345abcdef?options=x',
  'postgresql://pilot_runner@127.0.0.1:35449/consignment_test_012345abcdef#x']) reject(() => saleAttributionNativeEndpoint(url));
const source = 'literal original source\nsecond line\n', pin = crypto.createHash('sha256').update(source).digest('hex');
assertSaleAttributionNativeBytes(source, pin); assertSaleAttributionNativeBytes(source.replaceAll('\n', '\r\n'), pin);
for (const value of [source + '\n', '\ufeff' + source, source.replace('\n', '\r\n'), source.replace('original', 'unknown')])
  reject(() => assertSaleAttributionNativeBytes(value, pin));
assert.equal(Object.keys(SALE_ATTRIBUTION_NATIVE_SOURCES).length, 13); assert(Object.isFrozen(SALE_ATTRIBUTION_NATIVE_SOURCES));
const context = saleAttributionNativeEndpoint('postgresql://pilot_runner@127.0.0.1:35449/consignment_test_012345abcdef');
const backend = { role: 'pilot_runner', owner: 'pilot_runner', database: 'consignment_test_012345abcdef', version: '18.4', directory: 'C:/Users/Jorge/AppData/Local/Temp/omerta-employment-pg184-proof' };
assertSaleAttributionNativeBackend(backend, context);
for (const [key, value] of Object.entries({ role: 'postgres', owner: 'postgres', database: 'unknown', version: '18.3', directory: 'C:/unknown', unknown: true }))
  reject(() => assertSaleAttributionNativeBackend({ ...backend, [key]: value }, context));
console.log('N16 native original-phase guard PASS: ' + controls + ' rejecting controls; no database connection or native result claimed.');
