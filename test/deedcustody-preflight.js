import assert from 'node:assert/strict';
import { preflight, CLASSIFIED } from '../src/preflight.js';

const env = { NODE_ENV: 'production' };
const custodyErrors = values => preflight({ ...env, ...values }).errors
  .filter(message => /[Dd]eed custody|CHARACTER_DEED|reviewed Deed/.test(message));
assert.deepEqual(custodyErrors({}), [], 'a dormant rail needs no custody credentials');
assert.deepEqual(custodyErrors({ CHARACTER_DEED_CUSTODY_ENABLED: 'false' }), []);
assert(custodyErrors({ CHARACTER_DEED_CUSTODY_ENABLED: 'on' }).length);
assert(custodyErrors({ CHARACTER_DEED_CUSTODY_ENABLED: 'true' }).length >= 7,
  'enabling custody without the exact deployment must fail startup');
const deployment = {
  CHARACTER_DEED_CUSTODY_ENABLED: 'true',
  CHARACTER_DEED_CUSTODY_ADDRESS: '0x' + '11'.repeat(20),
  STREET_DEED_ADDRESS: '0x' + '22'.repeat(20),
  DYNASTY_NFT_ADDRESS: '0x' + '33'.repeat(20),
  ERC6551_ACCOUNT_IMPL: '0x' + '44'.repeat(20),
  OMR_ADDRESS: '0x' + '66'.repeat(20),
  CHARACTER_DEED_CUSTODY_CODE_HASH: '0x' + '55'.repeat(32),
  CHARACTER_DEED_CUSTODY_START_BLOCK: '1', CHAIN_ID: '46630',
  CHAIN_RPC_URL: 'http://127.0.0.1:1',
};
assert.deepEqual(custodyErrors(deployment), []);
assert(custodyErrors({ ...deployment, CHARACTER_DEED_CUSTODY_CODE_HASH: '0x' + '00'.repeat(32) }).length);
assert(custodyErrors({ ...deployment, CHARACTER_DEED_CUSTODY_ADDRESS: '0x' + '00'.repeat(20) }).length);
for (const key of Object.keys(deployment)) assert(CLASSIFIED.has(key), `${key} is classified`);
assert(CLASSIFIED.has('CHARACTER_DEED_OPERATOR_PK'));
console.log('Deed custody preflight: dormant defaults and exact deployment gates pass');
