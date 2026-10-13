import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { equipmentEconomyMigrationSources, equipmentEconomyMigrationProjection,
  EQUIPMENT_EVENT_KIND_CURRENT, EQUIPMENT_EVENT_KIND_PREDECESSOR, EQUIPMENT_ECONOMY_MIGRATION_TABLES } from './lib/equipment-economy-migration-catalog.js';
const source=equipmentEconomyMigrationSources(),metadata={constraints:[{table_name:'item_events',name:'item_event_kind',type:'c',validated:true}]};
const current={table_name:'item_events',name:'item_event_kind',definition:EQUIPMENT_EVENT_KIND_CURRENT};
const projection=equipmentEconomyMigrationProjection(source.current,metadata);
assert.equal(equipmentEconomyMigrationProjection(source.current.replaceAll('\n','\r\n'),metadata).normalize([current])[0].definition,EQUIPMENT_EVENT_KIND_PREDECESSOR);
for(const changed of [source.current+'\n',source.current.replace('\n','\r\n'),source.current.replace("'escrow_relayed'","'unexpected_relay'"),source.current.replace('equipment_rental_leases','unreviewed_equipment_leases'),source.previous,'\ufeff'+source.current])
  assert.throws(()=>equipmentEconomyMigrationProjection(changed,metadata),error=>error.code==='ERR_ASSERTION');
for(const rows of [[],[current,current],[{...current,name:'renamed_kind'}],[{...current,definition:'CHECK (true)'}],
  [{...current,definition:EQUIPMENT_EVENT_KIND_PREDECESSOR}],[{...current,definition:EQUIPMENT_EVENT_KIND_CURRENT.replace('lot_granted','unknown_lot')}],
  [{...current,definition:EQUIPMENT_EVENT_KIND_CURRENT.replace("'stack_granted'::text, 'stack_consumed'::text", "'stack_consumed'::text, 'stack_granted'::text")}],
  [{...current,definition:EQUIPMENT_EVENT_KIND_CURRENT+' NOT VALID'}]])assert.throws(()=>projection.normalize(rows),error=>error.code==='ERR_ASSERTION');
for(const constraints of [[],[metadata.constraints[0],metadata.constraints[0]],[{...metadata.constraints[0],validated:false}],
  [{...metadata.constraints[0],type:'f'}],[{...metadata.constraints[0],name:'renamed_kind'}]])assert.throws(()=>projection.verifyMetadata({constraints}),error=>error.code==='ERR_ASSERTION');
const retained=EQUIPMENT_ECONOMY_MIGRATION_TABLES.map(table_name=>({table_name,name:'retention_witness',definition:'UNIQUE (id)'}));
const normalized=projection.normalize([current,...retained]);assert.equal(normalized.length,15);assert.deepEqual(normalized.slice(1),retained);
console.log('Equipment migration unit PASS: exact LF/CRLF whole-source pins, unknown-source/predicate/missing/duplicate/name/type/validation controls; all14 table rows preserved.');
if(process.argv.includes('--postgres')){
  assert(!process.env.DATABASE_URL,'Refuse ambient URL');const endpoint=new URL(process.env.EQUIPMENT_MIGRATION_TEST_DATABASE_URL);
  assert.equal(endpoint.hostname,'127.0.0.1');const local=['35439','35449'].includes(endpoint.port)&&endpoint.username==='pilot_runner'&&!endpoint.password,ci=endpoint.port==='5432'&&endpoint.username==='postgres'&&endpoint.password==='pgcheck';assert(local||ci);
  assert(['postgres:','postgresql:'].includes(endpoint.protocol));assert.match(endpoint.pathname,/^\/equipment_migration_test_[a-f0-9]{12}$/);assert(!endpoint.search&&!endpoint.hash);
  const client=new pg.Client({connectionString:endpoint.href});await client.connect();
  try{
    assert.match((await client.query('SHOW server_version')).rows[0].server_version,local?/^18\.4\b/:/^(?:16\b|18\.4\b)/);assert.equal((await client.query('SELECT current_user')).rows[0].current_user,local?'pilot_runner':'postgres');
    assert.equal((await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0);
    await client.query(source.current);
    const read=async()=>({constraints:(await client.query("SELECT t.relname::text table_name,c.conname::text name,c.contype::text type,c.convalidated validated FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid WHERE c.conrelid='item_events'::regclass AND c.conname='item_event_kind'")).rows});
    const rows=(await client.query("SELECT 'item_events'::text table_name,conname::text name,pg_get_constraintdef(oid,true) definition FROM pg_constraint WHERE conrelid='item_events'::regclass AND conname='item_event_kind'")).rows;
    assert.deepEqual(rows,[current]);equipmentEconomyMigrationProjection(source.current,await read()).normalize(rows);
    const previous='equipment_previous_'+crypto.randomBytes(6).toString('hex');assert.match(previous,/^equipment_previous_[a-f0-9]{12}$/);
    await client.query('CREATE SCHEMA '+previous);await client.query('SET search_path TO '+previous);
    await client.query(source.previous);
    const prior=(await client.query("SELECT pg_get_constraintdef(oid,true) definition FROM pg_constraint WHERE conrelid='item_events'::regclass AND conname='item_event_kind'")).rows;
    assert.equal(prior.length,1);assert.equal(prior[0].definition,EQUIPMENT_EVENT_KIND_PREDECESSOR);
    await client.query('SET search_path TO public');
    // An actual unvalidated constraint must refuse, even with unchanged predicate bytes.
    await client.query('BEGIN');
    try{await client.query('ALTER TABLE item_events DROP CONSTRAINT item_event_kind');
      await client.query("ALTER TABLE item_events ADD CONSTRAINT item_event_kind CHECK (event_branch='legacy' AND event_kind IN ('stack_granted','stack_consumed','created','transferred','consumed','escrowed','released','stored','retrieved','escrow_relayed') OR event_branch='lot' AND event_kind IN ('lot_granted','lot_consumed','lot_split_debit','lot_split_output','lot_escrowed','lot_released','lot_escrow_consumed') OR event_branch='unique' AND event_kind IN ('unique_granted','unique_escrowed','unique_released','unique_transferred','unique_consumed') OR event_branch='observation' AND event_kind='migration_origin') NOT VALID");
      assert.throws(()=>equipmentEconomyMigrationProjection(source.current,{constraints:[{...metadata.constraints[0],validated:false}]}),error=>error.code==='ERR_ASSERTION');
      const invalidMetadata=await read();assert.throws(()=>projection.verifyMetadata(invalidMetadata),error=>error.code==='ERR_ASSERTION');
    }finally{await client.query('ROLLBACK');}
    console.log('Equipment migration native18.4 PASS: independently compiled full current/predecessor schemas equal frozen predicates; real NOT VALID refusal.');
  }finally{await client.end();}
}
