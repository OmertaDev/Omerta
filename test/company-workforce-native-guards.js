import assert from 'node:assert/strict';
import { middleFiveNativeEndpoint } from './lib/company-middle-five-native.js';
const prefix='company_middle_five_test_',database=prefix+'0123456789ab';
for(const value of ['postgresql://pilot_runner@127.0.0.1:35449/'+database,'postgres://postgres:pgcheck@127.0.0.1:5432/'+database])assert.equal(middleFiveNativeEndpoint(value,prefix).u.pathname,'/'+database);
for(const value of [
 'https://pilot_runner@127.0.0.1:35449/'+database,
 'postgres://pilot_runner@example.com:35449/'+database,
 'postgres://pilot_runner@localhost:35449/'+database,
 'postgres://pilot_runner@127.0.0.1:35449/postgres',
 'postgres://pilot_runner@127.0.0.1:35449/company_middle_five_test_existing',
 'postgres://pilot_runner@127.0.0.1:35449/'+database+'?options=-c%20search_path=other',
 'postgres://pilot_runner@127.0.0.1:35449/'+database+'#fragment',
 'postgres://pilot_runner:password@127.0.0.1:35449/'+database,
 'postgres://postgres:wrong@127.0.0.1:5432/'+database,
 'postgres://pilot_runner@127.0.0.1:5432/'+database,
 'postgres://pilot_runner@127.0.0.1:35459/'+database,
])assert.throws(()=>middleFiveNativeEndpoint(value,prefix),value);
assert.throws(()=>middleFiveNativeEndpoint('postgres://pilot_runner@127.0.0.1:35449/'+database,'arbitrary_'));
console.log('Workforce native endpoint guards PASS: only fresh owned or CI names; authority/host/protocol/port/query/credentials refused before connecting');
