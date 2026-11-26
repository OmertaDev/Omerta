import assert from 'node:assert/strict';
import fs from 'node:fs';
import {newDb} from 'pg-mem';
import {pgMemSchema} from '../src/db.js';

const schema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const transformed = pgMemSchema(schema);
const start = transformed.indexOf('CREATE TABLE IF NOT EXISTS street_deeds (');
const end = transformed.indexOf('CREATE TABLE IF NOT EXISTS street_deed_paid_intents (', start);
assert(start >= 0 && end > start);
const deedSchema = transformed.slice(start, end);
function database() {
  const db = newDb();
  db.public.none(deedSchema);
  return db;
}
const db = database();
for (const kind of ['gameplay', 'paid', 'partnership']) {
  db.public.none(`INSERT INTO street_deeds(account_id,name,name_lc,district,issuance_kind)
    VALUES('${kind}','${kind}','${kind}','docks','${kind}')`);
}
db.public.none("INSERT INTO street_deeds(account_id,name,name_lc,district) VALUES('legacy','Legacy','legacy','docks')");
assert.equal(db.public.many('SELECT * FROM street_deeds').length, 4);
assert.equal(db.public.one("SELECT issuance_kind FROM street_deeds WHERE account_id='legacy'").issuance_kind, null);
// A failed pg-mem insert is not a PostgreSQL rollback proof; isolate each negative control.
for (const kind of ['unknown', 'PAID', '']) {
  const rejected = database();
  assert.throws(() => rejected.public.none(`INSERT INTO street_deeds(account_id,name,name_lc,district,issuance_kind)
    VALUES('invalid','Invalid','invalid','docks','${kind}')`), /check constraint/i);
}
assert.throws(() => pgMemSchema('CREATE TABLE unrelated(id INT);'), /canonical deed issuance schema/);
console.log('deed-pgmem-schema: PASS (fresh bootstrap, three valid kinds, legacy null, three invalid kinds)');
