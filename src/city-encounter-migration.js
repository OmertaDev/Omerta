// Runs under makeDb's existing boot advisory lock. Only the two literal reviewed
// scenario catalogues are accepted; an unknown or unvalidated predicate is refused.
function invalid(detail) {
  const error=new Error('City encounter catalogue migration refused: '+detail);
  error.code='city_encounter_catalogue_migration_invalid';return error;
}
export async function migrateCityEncounterCatalogue(q,{compatibility='postgres'}={}) {
  if(compatibility==='pg-mem')return Object.freeze({compatibility,verified:false,replaced:0});
  if(compatibility!=='postgres')throw invalid('unknown compatibility mode');
  await q.query('BEGIN');
  try {
    await q.query('LOCK TABLE city_encounters IN ACCESS EXCLUSIVE MODE');
    await q.query(`CREATE TEMP TABLE city_encounter_catalogue_reference (
      scenario_id TEXT,
      CONSTRAINT encounter_catalogue_old CHECK (scenario_id IN ('docks-patrol','neon-patrol','foundry-patrol','brick-patrol','canal-patrol','cathedral-patrol')),
      CONSTRAINT encounter_catalogue_current CHECK (scenario_id IN ('docks-patrol','neon-patrol','foundry-patrol','brick-patrol','canal-patrol','cathedral-patrol',
        'docks-mastery-v1','neon-mastery-v1','foundry-mastery-v1','brick-mastery-v1','canal-mastery-v1','cathedral-mastery-v1'))
    ) ON COMMIT DROP`);
    const references=(await q.query(`SELECT conname,pg_get_constraintdef(oid,true) AS definition FROM pg_constraint
      WHERE conrelid='pg_temp.city_encounter_catalogue_reference'::regclass`)).rows;
    const old=references.find(row=>row.conname==='encounter_catalogue_old')?.definition;
    const current=references.find(row=>row.conname==='encounter_catalogue_current')?.definition;
    const read=async()=>(await q.query(`SELECT contype::text,convalidated,pg_get_constraintdef(oid,true) AS definition FROM pg_constraint
      WHERE conrelid='city_encounters'::regclass AND conname='city_encounters_scenario_id_check'`)).rows;
    const rows=await read(),row=rows[0];
    if(!old||!current||rows.length!==1||row.contype!=='c'||row.convalidated!==true
      ||![old,current].includes(row.definition))throw invalid('unknown, missing or unvalidated scenario predicate');
    const replaced=Number(row.definition===old);
    if(replaced){
      await q.query('ALTER TABLE city_encounters DROP CONSTRAINT city_encounters_scenario_id_check');
      await q.query(`ALTER TABLE city_encounters ADD CONSTRAINT city_encounters_scenario_id_check CHECK (scenario_id IN
        ('docks-patrol','neon-patrol','foundry-patrol','brick-patrol','canal-patrol','cathedral-patrol',
         'docks-mastery-v1','neon-mastery-v1','foundry-mastery-v1','brick-mastery-v1','canal-mastery-v1','cathedral-mastery-v1')) NOT VALID`);
      await q.query('ALTER TABLE city_encounters VALIDATE CONSTRAINT city_encounters_scenario_id_check');
    }
    const verified=await read();
    if(verified.length!==1||verified[0].contype!=='c'||verified[0].convalidated!==true||verified[0].definition!==current)
      throw invalid('installed predicate did not match');
    await q.query('COMMIT');return Object.freeze({compatibility,verified:true,replaced});
  }catch(error){await q.query('ROLLBACK').catch(()=>{});throw error;}
}
