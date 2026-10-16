// Original commercial_campaign_v1 history. Read-only provenance never grants execution authority.
import crypto from 'node:crypto';

const ROLES=Object.freeze(['owner','scout','manufacturer','guard','first_carrier','second_carrier']);
const STAGES=Object.freeze(['scout','manufacture','guard','courier']);
const ACTIONS=Object.freeze(['create','consent','withdraw','cancel','expire','scout-fund','scout-report','manufacture-fund','manufacture-accept','manufacture-complete','guard-hire','courier-publish','courier-consent','courier-dispatch','courier-travel','courier-handoff','courier-arrive']);
const CREATE=Object.freeze(['partnershipId','relationshipHash','teamRevision','businessId','manufacturerAccountId','guardAccountId','firstCarrierAccountId','secondCarrierAccountId','origin','handoff','destination','scoutFeeCash','minimumStock','scoutTargetAt','manufacturingFeeCash','guardPriceCash','firstFeeCash','secondFeeCash','lifetimeSeconds','consent']);
const stable=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0)):v);
const hash=value=>crypto.createHash('sha256').update(stable(value)).digest('hex');
class HistoryError extends Error{}
const requireHistory=(ok,reason)=>{if(!ok)throw new HistoryError(reason);};
const exact=(v,keys)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const identity=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const whole=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const iso=value=>{requireHistory(value instanceof Date||typeof value==='string','timestamp');const d=new Date(value);requireHistory(Number.isFinite(+d),'timestamp');return d.toISOString();};
const equal=(a,b)=>stable(a)===stable(b);
const rolesOf=row=>Object.fromEntries(ROLES.map(role=>[role,{account:row[role+'_account'],character:row[role+'_character']} ]));
const view=(row,state=row.state,stage=row.stage)=>({campaignId:row.id,sourceHash:row.source_hash,partnershipId:row.partnership_id,businessId:row.business_id,state,stage,terms:row.source_json.terms,roles:ROLES.map(role=>({role,accountId:row[role+'_account'],originalCharacterId:row[role+'_character']})),expiresAt:iso(row.expires_at),executionAuthority:false,guardEvidence:'purchased_bodyguard_coverage',stageFeesFundedSeparately:true,gameCashOnly:true});
function createTerms(t){
 requireHistory(exact(t,CREATE)&&t.consent===true,'terms');
 for(const key of['partnershipId','businessId','manufacturerAccountId','guardAccountId','firstCarrierAccountId','secondCarrierAccountId'])requireHistory(identity(t[key]),'terms_identity');
 requireHistory(digest(t.relationshipHash)&&whole(t.teamRevision,1,2147483647),'terms_source');
 const districts=['docks','neon','foundry','brick','canal','cathedral'];for(const key of['origin','handoff','destination'])requireHistory(districts.includes(t[key]),'terms_district');
 requireHistory(new Set([t.origin,t.handoff,t.destination]).size===3&&new Set([t.manufacturerAccountId,t.guardAccountId,t.firstCarrierAccountId,t.secondCarrierAccountId]).size===4,'terms_distinct');
 for(const[key,min,max]of[['scoutFeeCash',50,5000],['minimumStock',1,40],['manufacturingFeeCash',1,100000],['guardPriceCash',10000,100000],['firstFeeCash',1,1000],['secondFeeCash',1,1000],['lifetimeSeconds',60,3600]])requireHistory(whole(t[key],min,max),'terms_range');
 requireHistory(typeof t.scoutTargetAt==='string'&&iso(t.scoutTargetAt)===t.scoutTargetAt,'terms_timestamp');
 return t;
}
function actionRoles(action){
 if(['create','cancel','scout-fund','manufacture-fund','guard-hire','courier-publish','courier-dispatch'].includes(action))return['owner'];
 if(action==='consent'||action==='withdraw')return ROLES.slice(1);
 if(action==='expire')return ROLES;
 if(action==='scout-report')return['scout'];
 if(action.startsWith('manufacture-'))return['manufacturer'];
 return action==='courier-consent'?['first_carrier','second_carrier']:action==='courier-arrive'?['second_carrier']:action==='courier-handoff'?['first_carrier']:['first_carrier','second_carrier'];
}
function requestBody(row,request){
 if(request.action==='create')return row.source_json.terms;
 const body={campaignId:row.id,sourceHash:row.source_hash,consent:true};
 if(request.action==='scout-report'){requireHistory(typeof request.receipt?.source?.predictsAvailable==='boolean','scout_request');body.predictsAvailable=request.receipt.source.predictsAvailable;}
 return body;
}
const scopedReader=c=>async(sql,args)=>{requireHistory(typeof sql==='string'&&sql.startsWith('SELECT ')&&!/\bFOR\s+(?:UPDATE|SHARE)|;|--/i.test(sql),'readonly_query');return(await c.query(sql,args)).rows;};
async function journal(read,id,expected){const rows=await read('SELECT * FROM transactions WHERE id=$1',[id]);requireHistory(rows.length===1,'journal_missing');const row=rows[0];for(const[key,value]of Object.entries(expected))requireHistory(key==='amount'?Number(row[key])===value:row[key]===value,'journal_source');return row;}
async function snapshotJournals(read,entries,allowed){
 requireHistory(Array.isArray(entries)&&new Set(entries.map(e=>e.id)).size===entries.length,'journal_snapshot');
 for(const entry of entries){const actual=(await read('SELECT * FROM transactions WHERE id=$1',[entry.id]))[0];requireHistory(actual&&actual.currency==='cash'&&actual.account_id==null&&allowed(actual),'journal_binding');for(const[key,value]of Object.entries(entry)){const field=key==='originalCharacter'?'character_id':key;requireHistory(field==='amount'?Number(actual[field])===Number(value):equal(actual[field],value),'journal_snapshot_changed');}}
}
async function canonicalReceipt(read,table,account,key,actor,sourceId){
 const row=(await read(table==='commissioned_crafting_requests'?'SELECT * FROM commissioned_crafting_requests WHERE account_id=$1 AND key_hash=$2':'SELECT * FROM multi_hop_courier_requests WHERE account_id=$1 AND request_key=$2',[account,table==='commissioned_crafting_requests'?hash([account,key]):key]))[0];
 requireHistory(row&&row.original_character===actor&&row.receipt&&digest(row.body_hash),'canonical_ack');
 requireHistory(table==='commissioned_crafting_requests'?row.account_ref===account&&row.receipt.commissionId===sourceId:row.network_id===sourceId&&row.receipt.networkId===sourceId,'canonical_ack_source');
 return row;
}
function durationHash(saved,base){let matches=0;for(let lifetimeSeconds=60;lifetimeSeconds<=3600;lifetimeSeconds++)if(hash({...base,lifetimeSeconds})===saved)matches++;return matches===1;}
function courierDurationHash(saved,base){let matches=0;for(let expiresInSeconds=60;expiresInSeconds<=3600;expiresInSeconds++)if(hash({...base,expiresInSeconds})===saved)matches++;return matches===1;}
function receiptShape(request){
 const r=request.receipt,a=request.action;
 if(['create','consent'].includes(a))return exact(r,['ok','campaign','consentedRole']);
 if(['cancel','withdraw','expire'].includes(a))return exact(r,['ok','campaign','retiredMetadataOnly'])&&r.retiredMetadataOnly===true;
 if(!exact(r,['ok','campaign','source']))return false;
 const keys=a.startsWith('scout-')?['kind','sourceId','state','feeCash','paidFeeCash','targetAt','reportedAt','predictsAvailable','observedStock']:a.startsWith('manufacture-')?['kind','sourceId','sourceHash','state','recipeId','feeCash','paidFeeCash','outputItemId']:a==='guard-hire'?['kind','state','evidence','priceCash','paidGuardCash','canonicalFeeCash','streetTaxCash','until','payerJournal','guardJournal']:['kind','sourceId','sourceHash','state','itemId','firstConsent','secondConsent','reservedCash','paidFirstCash','paidSecondCash','firstTravel','secondTravel'];
 return exact(r.source,keys);
}
function phaseView(request){
 const a=request.action,v=request.receipt.campaign;
 if(['create','consent'].includes(a))return v.stage==='scout'&&(a==='create'?v.state==='offered':['offered','active'].includes(v.state));
 if(['cancel','withdraw','expire'].includes(a))return v.state===({cancel:'cancelled',withdraw:'suspended',expire:'expired'})[a];
 const stage=a==='scout-fund'?'scout':a==='scout-report'||['manufacture-fund','manufacture-accept'].includes(a)?'manufacture':a==='manufacture-complete'?'guard':a==='courier-arrive'?'complete':'courier';
 return v.stage===stage&&v.state===(a==='courier-arrive'?'completed':'active');
}
function campaignRequest(requests,action,account){const found=requests.filter(r=>r.action===action&&r.account_id===account);requireHistory(found.length===1,'stage_ack_census');return found[0];}
function campaignSource(request,expected){requireHistory(equal(request.receipt.source,expected),'stage_ack_source');}
async function paidHistory(read,row,stage,requests){
 const t=row.source_json.terms,p=stage.proof_json;
 if(equal(p,{})){requireHistory(!requests.some(r=>stage.kind==='guard'?r.action==='guard-hire':r.action.startsWith(stage.kind+'-')),'empty_stage_ack');requireHistory(['pending','retired'].includes(stage.state)&&stage.started_at==null&&stage.completed_at==null&&['scout_job_id','commission_id','output_item_id','courier_network_id','guard_payer_journal','guard_payee_journal','guard_until'].every(k=>stage[k]==null),'empty_stage');return;}
 requireHistory(stage.started_at!=null&&+new Date(iso(stage.started_at))>=+new Date(row.created_at)&&+new Date(stage.started_at)<+new Date(row.expires_at),'stage_time');
 if(stage.completed_at!=null)requireHistory(+new Date(iso(stage.completed_at))>=+new Date(stage.started_at)&&+new Date(stage.completed_at)<+new Date(row.expires_at),'stage_complete_time');
 if(stage.kind==='scout'){
  requireHistory(exact(p,['source','sourceHash','journals','report'])&&stage.scout_job_id===p.source?.jobId&&hash(p.source)===p.sourceHash,'scout_snapshot');
  const job=(await read('SELECT * FROM intel_forecast_jobs WHERE id=$1',[stage.scout_job_id]))[0];
  requireHistory(job&&job.buyer_character===row.owner_character&&job.reporter_character===row.scout_character&&job.request_key==='commercial:'+row.id+':scout'&&job.district_id===t.origin&&Number(job.minimum_stock)===t.minimumStock&&Number(job.fee_cash)===t.scoutFeeCash&&iso(job.target_at)===t.scoutTargetAt,'scout_source');
  const source={jobId:job.id,buyerOriginal:job.buyer_character,reporterOriginal:job.reporter_character,requestKey:job.request_key,districtId:job.district_id,minimumStock:Number(job.minimum_stock),feeCash:Number(job.fee_cash),priceBlock:Number(job.price_block),createdAt:iso(job.created_at),targetAt:iso(job.target_at)};requireHistory(equal(p.source,source),'scout_immutable');
  await snapshotJournals(read,p.journals,j=>j.counterparty===job.id&&((j.reason==='intel_job:post'&&j.character_id===row.owner_character&&Number(j.amount)===-t.scoutFeeCash)||(j.reason==='intel_job:pay'&&j.character_id===row.scout_character&&Number(j.amount)===t.scoutFeeCash)));
  requireHistory(p.journals.length===(p.report?2:1)&&p.journals.filter(j=>j.reason==='intel_job:post').length===1&&p.journals.filter(j=>j.reason==='intel_job:pay').length===(p.report?1:0),'scout_snapshot_budget');
  requireHistory(stage.state===(p.report?'completed':'funded')||stage.state==='retired','scout_stage_state');
  requireHistory(requests.filter(r=>r.action.startsWith('scout-')).length===(p.report?2:1),'scout_ack_census');
  const scoutDTO=reported=>({kind:'scout',sourceId:job.id,state:reported?'completed':'funded',feeCash:Number(job.fee_cash),paidFeeCash:reported?Number(job.fee_cash):0,targetAt:iso(job.target_at),reportedAt:reported?p.report.reportedAt:null,predictsAvailable:reported?p.report.predictsAvailable:null,observedStock:reported?Number(p.report.observation.stock):null});
  campaignSource(campaignRequest(requests,'scout-fund',row.owner_account),scoutDTO(false));
  if(p.report)requireHistory(equal(p.report,{predictsAvailable:job.predicts_available,reportedAt:job.reported_at?iso(job.reported_at):null,observation:job.observation})&&typeof p.report.predictsAvailable==='boolean'&&p.report.observation?.observedAt===p.report.reportedAt&&whole(Number(p.report.observation.stock),0,Number.MAX_SAFE_INTEGER),'scout_report_ack');
  if(p.report)campaignSource(campaignRequest(requests,'scout-report',row.scout_account),scoutDTO(true));
 }else if(stage.kind==='manufacture'){
  requireHistory(exact(p,['source','sourceHash','journals','production','settlement'])&&p.source?.id===stage.commission_id&&hash(p.source)===p.sourceHash,'commission_snapshot');
  const q=(await read('SELECT * FROM commissioned_crafting_contracts WHERE id=$1',[stage.commission_id]))[0];
  const source=q&&{id:q.id,businessId:q.business_id,customerAccount:q.customer_account,customerCharacter:q.customer_character,makerAccount:q.maker_account,makerCharacter:q.maker_character,feeCash:Number(q.fee_total),expiresAt:iso(q.expires_at),recipePin:q.source_pin};
  requireHistory(q&&equal(source,p.source)&&q.source_hash===p.sourceHash&&q.business_id===row.business_id&&q.customer_account===row.owner_account&&q.customer_character===row.owner_character&&q.maker_account===row.manufacturer_account&&q.maker_character===row.manufacturer_character&&Number(q.fee_total)===t.manufacturingFeeCash&&+new Date(q.expires_at)<=+new Date(row.expires_at),'commission_source');
  requireHistory(q.source_pin?.recipeId==='recipe:precision_lock_tool'&&q.source_pin.outputTemplate==='item:precision_lock_tool'&&q.source_pin.cashCost===0&&equal(q.source_pin.inputs,[{templateId:'mat:hardened_steel',quantity:1,quality:'standard'},{templateId:'mat:salvage_parts',quantity:2,quality:'standard'}]),'commission_recipe');
  await snapshotJournals(read,p.journals,j=>j.counterparty===q.id&&((j.reason==='commissioned_crafting:reserve'&&j.id===q.reserve_transaction&&j.character_id===row.owner_character&&Number(j.amount)===-t.manufacturingFeeCash)||(j.reason==='commissioned_crafting:fee'&&j.character_id===row.manufacturer_character&&Number(j.amount)===t.manufacturingFeeCash)));
  requireHistory(p.journals.filter(j=>j.reason==='commissioned_crafting:reserve').length===1&&p.journals.length===(p.settlement?2:1),'commission_snapshot_budget');
  const accepted=requests.some(r=>r.action==='manufacture-accept');requireHistory(stage.state===(p.settlement?'completed':accepted?'accepted':'funded')||stage.state==='retired','commission_stage_state');
  requireHistory(requests.filter(r=>r.action.startsWith('manufacture-')).length===(p.settlement?3:accepted?2:1)&&(!p.settlement||accepted),'commission_ack_census');
  let completion;
  for(const phase of['fund',...(accepted?['accept']:[]),...(p.settlement?['complete']:[])]){
   const account=phase==='fund'?row.owner_account:row.manufacturer_account,actor=phase==='fund'?row.owner_character:row.manufacturer_character,ack=await canonicalReceipt(read,'commissioned_crafting_requests',account,'commercial:'+row.id+':manufacture:'+phase,actor,q.id),state=({fund:'funded',accept:'accepted',complete:'completed'})[phase];
   requireHistory(phase==='fund'?durationHash(ack.body_hash,{action:'fund',businessId:row.business_id,feeCash:t.manufacturingFeeCash,consent:true}):ack.body_hash===hash({action:phase,commissionId:q.id,sourceHash:q.source_hash,consent:true}),'commission_body');
   const expected={ok:true,commissionId:q.id,sourceHash:q.source_hash,status:state,recipeId:q.source_pin.recipeId,feeCash:Number(q.fee_total),expiresAt:iso(q.expires_at)};
   if(phase==='fund')Object.assign(expected,{reserveTransaction:q.reserve_transaction,inputs:q.source_pin.inputs});
   if(phase==='complete'){const p0=p.settlement;Object.assign(expected,{outputItemId:p0.outputItemId,paidFee:Number(q.fee_total),feeTransaction:p0.feeTransaction,production:{originalCharacterId:row.manufacturer_character,businessId:row.business_id,recipeId:q.source_pin.recipeId,totalCrafts:1,totalCashCost:0,outputItemId:p0.outputItemId},transferredInputs:q.source_pin.inputs});completion=ack;}
   requireHistory(equal(ack.receipt,expected),'commission_canonical_dto');
   campaignSource(campaignRequest(requests,'manufacture-'+phase,account),{kind:'manufacture',sourceId:q.id,sourceHash:q.source_hash,state,recipeId:q.source_pin.recipeId,feeCash:Number(q.fee_total),paidFeeCash:phase==='complete'?Number(q.fee_total):0,outputItemId:phase==='complete'?p.settlement.outputItemId:null});
  }
  if(p.settlement){
   requireHistory(equal(p.settlement,q.settlement)&&stage.output_item_id===p.settlement.outputItemId&&equal(p.production,p.settlement.production)&&p.settlement.paidFee===t.manufacturingFeeCash&&p.journals.some(j=>j.id===p.settlement.feeTransaction&&j.reason==='commissioned_crafting:fee')&&identity(completion.run_id)&&p.settlement.outputGuard==='commission:'+completion.run_id+':output'&&p.settlement.inputGuard==='commission:'+completion.run_id+':maker-inputs'&&p.settlement.productionKey==='commission:'+q.id+':production','commission_output');
   const stored=(await read('SELECT original_character,business_id,receipt FROM company_production_receipts WHERE account_id=$1 AND request_key=$2 AND receipt IS NOT NULL',[row.manufacturer_account,'commission:'+q.id+':production']))[0];let production;try{production=typeof stored?.receipt==='string'?JSON.parse(stored.receipt):stored?.receipt;}catch{requireHistory(false,'commission_production_json');}
   requireHistory(stored?.original_character===row.manufacturer_character&&stored.business_id===row.business_id&&equal(production,p.production)&&production?.originalCharacter===row.manufacturer_character&&production.businessId===row.business_id&&production.totalCrafts===1&&production.totalCashCost===0&&production.crafts?.length===1&&production.crafts[0]?.receipt?.outputs?.length===1&&production.crafts[0].receipt.outputs[0]?.id===stage.output_item_id&&equal(production.sourcePin?.code,q.source_pin.code)&&equal(production.sourcePin?.recipes,[{recipeId:q.source_pin.recipeId,definitionHash:q.source_pin.definitionHash}]),'commission_production_history');
   const events=await read('SELECT * FROM item_events WHERE idempotency_key=$1 ORDER BY sequence',[p.settlement.outputGuard]);requireHistory(events.length===1&&events[0].event_kind==='transferred'&&events[0].item_id===stage.output_item_id&&events[0].from_owner_scope==='account'&&events[0].from_owner_id===row.manufacturer_account&&events[0].to_owner_scope==='account'&&events[0].to_owner_id===row.owner_account,'commission_handover_history');
  }
 }else if(stage.kind==='guard'){
  requireHistory(exact(p,['family','evidence','payer','payerAccount','guard','guardAccount','price','net','fee','tax','payerJournal','guardJournal','until','payerCash','guardCash','taxPool'])&&p.family==='guard'&&p.evidence==='purchased_bodyguard_coverage'&&p.payer===row.owner_character&&p.payerAccount===row.owner_account&&p.guard===row.guard_character&&p.guardAccount===row.guard_account&&p.price===t.guardPriceCash&&p.fee===Math.ceil(p.price*.01)&&p.tax===Math.ceil(p.price*.01)&&p.net===p.price-p.fee-p.tax&&stage.guard_payer_journal===p.payerJournal&&stage.guard_payee_journal===p.guardJournal&&iso(stage.guard_until)===p.until&&[p.payerCash,p.guardCash,p.taxPool].every(n=>whole(n,0,Number.MAX_SAFE_INTEGER)),'guard_snapshot');
  requireHistory(stage.state==='completed'&&stage.completed_at!=null,'guard_stage_state');
  await journal(read,p.payerJournal,{character_id:row.owner_character,account_id:null,currency:'cash',amount:-p.price,reason:'bodyguard:hire',counterparty:row.guard_character});await journal(read,p.guardJournal,{character_id:row.guard_character,account_id:null,currency:'cash',amount:p.net,reason:'bodyguard:hire',counterparty:row.owner_character});requireHistory(requests.filter(r=>r.action==='guard-hire').length===1,'guard_ack_census');campaignSource(campaignRequest(requests,'guard-hire',row.owner_account),{kind:'guard',state:'completed',evidence:p.evidence,priceCash:p.price,paidGuardCash:p.net,canonicalFeeCash:p.fee,streetTaxCash:p.tax,until:p.until,payerJournal:p.payerJournal,guardJournal:p.guardJournal});
 }else{
  requireHistory(exact(p,['source','sourceHash','journals','firstTravel','secondTravel','firstConsent','secondConsent','reservedCash','earnedFirst','earnedSecond'])&&p.source?.id===stage.courier_network_id&&p.source.itemId===stage.output_item_id&&hash(p.source)===p.sourceHash,'courier_snapshot');
  const n=(await read('SELECT * FROM multi_hop_couriers WHERE id=$1',[stage.courier_network_id]))[0],source=n&&{id:n.id,itemId:n.item_id,ownerAccount:n.owner_account,owner:n.owner_character,firstAccount:n.first_account,first:n.first_character,secondAccount:n.second_account,second:n.second_character,origin:n.origin,handoff:n.handoff,destination:n.destination,firstFee:Number(n.first_fee),secondFee:Number(n.second_fee),expiresAt:iso(n.expires_at)};
  requireHistory(n&&equal(source,p.source)&&n.source_hash===p.sourceHash&&source.ownerAccount===row.owner_account&&source.owner===row.owner_character&&source.firstAccount===row.first_carrier_account&&source.first===row.first_carrier_character&&source.secondAccount===row.second_carrier_account&&source.second===row.second_carrier_character&&source.origin===t.origin&&source.handoff===t.handoff&&source.destination===t.destination&&source.firstFee===t.firstFeeCash&&source.secondFee===t.secondFeeCash&&+new Date(n.expires_at)<=+new Date(row.expires_at),'courier_source');
  await snapshotJournals(read,p.journals,j=>j.counterparty===n.id&&((j.reason==='multi_hop_courier:reserve'&&j.character_id===row.owner_character&&Number(j.amount)===-t.firstFeeCash-t.secondFeeCash)||(j.reason==='multi_hop_courier:fee'&&((j.character_id===row.first_carrier_character&&Number(j.amount)===t.firstFeeCash)||(j.character_id===row.second_carrier_character&&Number(j.amount)===t.secondFeeCash)))));
  requireHistory(whole(p.reservedCash,0,2000)&&whole(p.earnedFirst,0,1000)&&whole(p.earnedSecond,0,1000),'courier_snapshot_budget');
  const snapshotState=p.earnedSecond?'completed':p.earnedFirst?'accepted':p.reservedCash?'funded':'prepared';requireHistory(stage.state===snapshotState||stage.state==='retired','courier_stage_state');requireHistory([0,t.firstFeeCash].includes(p.earnedFirst)&&[0,t.secondFeeCash].includes(p.earnedSecond)&&(!p.earnedSecond||p.earnedFirst===t.firstFeeCash)&&p.reservedCash===(snapshotState==='funded'?t.firstFeeCash+t.secondFeeCash:snapshotState==='accepted'?t.secondFeeCash:0)&&p.journals.length===(snapshotState==='prepared'?0:snapshotState==='funded'?1:snapshotState==='accepted'?2:3),'courier_budget');
  requireHistory(typeof p.firstConsent==='boolean'&&typeof p.secondConsent==='boolean'&&(snapshotState==='prepared'||(p.firstConsent&&p.secondConsent))&&p.journals.filter(j=>j.reason==='multi_hop_courier:reserve').length===(snapshotState==='prepared'?0:1)&&p.journals.filter(j=>j.reason==='multi_hop_courier:fee'&&j.character_id===row.first_carrier_character).length===(p.earnedFirst?1:0)&&p.journals.filter(j=>j.reason==='multi_hop_courier:fee'&&j.character_id===row.second_carrier_character).length===(p.earnedSecond?1:0),'courier_snapshot_legs');
  requireHistory((snapshotState==='prepared'?p.firstTravel==null&&p.secondTravel==null:snapshotState==='funded'?p.secondTravel==null:true)&&(!p.earnedFirst||p.firstTravel!=null)&&(!p.earnedSecond||p.secondTravel!=null),'courier_travel_phase');
  for(const[witness,original,from,to,retained]of[[p.firstTravel,row.first_carrier_character,t.origin,t.handoff,n.first_travel],[p.secondTravel,row.second_carrier_character,t.handoff,t.destination,n.second_travel]])if(witness){requireHistory(exact(witness,['from','to','original','transaction','cost','observedAt'])&&witness.original===original&&witness.from===from&&witness.to===to&&identity(witness.transaction)&&whole(witness.cost,0,Number.MAX_SAFE_INTEGER)&&+new Date(iso(witness.observedAt))>=+new Date(stage.started_at)&&+new Date(witness.observedAt)<+new Date(n.expires_at)&&equal(witness,retained),'courier_travel');await journal(read,witness.transaction,{character_id:original,account_id:null,currency:'cash',amount:-witness.cost,reason:'travel'});}
  const expected=[['publish',row.owner_account]];
  if(p.firstConsent)expected.push(['consent',row.first_carrier_account]);if(p.secondConsent)expected.push(['consent',row.second_carrier_account]);
  if(snapshotState!=='prepared')expected.push(['dispatch',row.owner_account]);
  if(p.firstTravel)expected.push(['travel',row.first_carrier_account]);if(p.secondTravel)expected.push(['travel',row.second_carrier_account]);
  if(p.earnedFirst)expected.push(['handoff',row.first_carrier_account]);if(p.earnedSecond)expected.push(['arrive',row.second_carrier_account]);
  const saved=requests.filter(r=>r.action.startsWith('courier-'));requireHistory(saved.length===expected.length&&saved.every(r=>expected.some(([phase,account])=>r.action==='courier-'+phase&&r.account_id===account)),'courier_ack_census');
  const consentStates=[];
  for(const[phase,account]of expected){
   const request=campaignRequest(requests,'courier-'+phase,account),actor=account===row.owner_account?row.owner_character:account===row.first_carrier_account?row.first_carrier_character:row.second_carrier_character,canonical=await canonicalReceipt(read,'multi_hop_courier_requests',account,'commercial:'+row.id+':courier:'+phase+':'+account,actor,n.id);
   requireHistory(request.original_character===actor,'courier_ack_original');
   const body={action:'publish',itemId:n.item_id,firstCarrier:n.first_account,secondCarrier:n.second_account,origin:n.origin,handoff:n.handoff,destination:n.destination,firstFee:Number(n.first_fee),secondFee:Number(n.second_fee),consent:true};requireHistory(phase==='publish'?courierDurationHash(canonical.body_hash,body):canonical.body_hash===hash({action:phase,networkId:n.id,sourceHash:n.source_hash,consent:true}),'courier_body');
   const first=phase==='publish'?false:phase==='consent'?canonical.receipt.firstConsent:true,second=phase==='publish'?false:phase==='consent'?canonical.receipt.secondConsent:true;
   requireHistory(typeof first==='boolean'&&typeof second==='boolean'&&(!first||p.firstConsent)&&(!second||p.secondConsent)&&(phase!=='consent'||(account===row.first_carrier_account?first:second)),'courier_consent_history');
   const status=phase==='publish'?'offered':phase==='consent'?(first&&second?'ready':'offered'):phase==='dispatch'||(phase==='travel'&&account===row.first_carrier_account)?'first_leg':phase==='arrive'?'completed':'second_leg';
   if(phase==='consent')consentStates.push(status);
   const firstTravel=['handoff','arrive'].includes(phase)||phase==='travel'?p.firstTravel:null,secondTravel=phase==='arrive'||(phase==='travel'&&account===row.second_carrier_account)?p.secondTravel:null;
   const receipt={ok:true,networkId:n.id,sourceHash:n.source_hash,itemId:n.item_id,ownerOriginal:row.owner_character,firstOriginal:row.first_carrier_character,secondOriginal:row.second_carrier_character,origin:t.origin,handoff:t.handoff,destination:t.destination,firstFee:t.firstFeeCash,secondFee:t.secondFeeCash,firstConsent:first,secondConsent:second,status,expiresAt:iso(n.expires_at)};
   if(phase==='consent')receipt.acceptedBy=actor;
   if(phase==='dispatch')receipt.reserveTransaction=p.journals.find(j=>j.reason==='multi_hop_courier:reserve').id;
   if(phase==='travel'){const witness=account===row.first_carrier_account?p.firstTravel:p.secondTravel;receipt.travel={ok:true,loc:witness.to,cost:witness.cost};receipt.travelTransaction=witness.transaction;}
   if(phase==='handoff'||phase==='arrive')receipt.feeTransaction=p.journals.find(j=>j.reason==='multi_hop_courier:fee'&&j.character_id===actor).id;
   requireHistory(equal(canonical.receipt,receipt),'courier_canonical_dto');
   campaignSource(request,{kind:'courier',sourceId:n.id,sourceHash:n.source_hash,state:status,itemId:n.item_id,firstConsent:first,secondConsent:second,reservedCash:status==='first_leg'?t.firstFeeCash+t.secondFeeCash:status==='second_leg'?t.secondFeeCash:0,paidFirstCash:['second_leg','completed'].includes(status)?t.firstFeeCash:0,paidSecondCash:status==='completed'?t.secondFeeCash:0,firstTravel,secondTravel});
  }
  requireHistory(consentStates.filter(s=>s==='ready').length===(p.firstConsent&&p.secondConsent?1:0)&&consentStates.filter(s=>s==='offered').length===(p.firstConsent||p.secondConsent?1:0),'courier_consent_order');
  if(snapshotState!=='prepared'){requireHistory(n.deposit_guard==='courier:'+n.id+':deposit','courier_deposit_guard');const e=await read('SELECT * FROM item_events WHERE idempotency_key=$1 ORDER BY sequence',[n.deposit_guard]);requireHistory(e.length===1&&e[0].event_kind==='escrowed'&&e[0].item_id===n.item_id&&e[0].from_owner_scope==='account'&&e[0].from_owner_id===row.owner_account&&e[0].to_owner_scope==='operation'&&e[0].to_owner_id===n.id+':first','courier_deposit_history');}
  if(p.earnedFirst>0){const e=await read('SELECT * FROM item_events WHERE idempotency_key=$1 ORDER BY sequence',['courier:'+n.id+':handoff']);requireHistory(e.length===2&&e[0].event_kind==='released'&&e[1].event_kind==='escrowed'&&e.every(x=>x.item_id===n.item_id)&&e[0].from_owner_scope==='operation'&&e[0].from_owner_id===n.id+':first'&&e[0].to_owner_scope==='account'&&e[0].to_owner_id===row.owner_account&&e[1].from_owner_scope==='account'&&e[1].from_owner_id===row.owner_account&&e[1].to_owner_scope==='operation'&&e[1].to_owner_id===n.id+':second','courier_handoff_history');}
  if(p.earnedSecond>0){const e=await read('SELECT * FROM item_events WHERE idempotency_key=$1 ORDER BY sequence',['courier:'+n.id+':arrival']);requireHistory(e.length===1&&e[0].event_kind==='released'&&e[0].item_id===n.item_id&&e[0].from_owner_scope==='operation'&&e[0].from_owner_id===n.id+':second'&&e[0].to_owner_scope==='account'&&e[0].to_owner_id===row.owner_account,'courier_arrival_history');}
 }
}

// This function issues only literal SELECTs. It deliberately does not import the live runtime,
// current owner/team/character checks, readiness gates or fresh private completion witnesses.
export async function inspectCommercialCampaignBusinessHistory(c,businessId){
 requireHistory(identity(businessId),'business_identity');const read=scopedReader(c),rows=await read('SELECT * FROM commercial_campaigns WHERE business_id=$1 ORDER BY id',[businessId]),issues=[],activeCampaigns=[];
 for(const row of rows)try{
  const t=createTerms(row.source_json?.terms),originals=rolesOf(row),created=iso(row.created_at),expires=iso(row.expires_at);
  requireHistory(identity(row.id)&&identity(row.partnership_id)&&digest(row.source_hash)&&digest(row.relationship_hash)&&exact(row.source_json,['terms','roles'])&&equal(row.source_json.roles,originals),'immutable_source');
  requireHistory(t.partnershipId===row.partnership_id&&t.relationshipHash===row.relationship_hash&&t.teamRevision===Number(row.team_revision)&&t.businessId===row.business_id&&t.manufacturerAccountId===row.manufacturer_account&&t.guardAccountId===row.guard_account&&t.firstCarrierAccountId===row.first_carrier_account&&t.secondCarrierAccountId===row.second_carrier_account&&+new Date(expires)-+new Date(created)===t.lifetimeSeconds*1000,'immutable_terms');
  requireHistory(Object.values(originals).every(r=>identity(r.account)&&identity(r.character))&&new Set(Object.values(originals).map(r=>r.account)).size===6&&new Set(Object.values(originals).map(r=>r.character)).size===6,'original_distinct');
  requireHistory(hash(['commercial-campaign-v1',row.id,row.partnership_id,row.relationship_hash,Number(row.team_revision),row.business_id,originals,row.source_json,created,expires])===row.source_hash,'source_hash');
  const characters={};for(const r of Object.values(originals)){const found=(await read('SELECT account_id,alive FROM characters WHERE id=$1',[r.character]))[0];requireHistory(found?.account_id===r.account,'historical_original');characters[r.character]=found;}
  const roles=await read('SELECT * FROM commercial_campaign_roles WHERE campaign_id=$1 ORDER BY role',[row.id]),requests=await read('SELECT * FROM commercial_campaign_requests WHERE campaign_id=$1 ORDER BY account_id,key_hash',[row.id]),stages=await read('SELECT * FROM commercial_campaign_stages WHERE campaign_id=$1 ORDER BY kind',[row.id]);
  requireHistory(roles.length===6&&new Set(roles.map(r=>r.role)).size===6&&stages.length===4&&new Set(stages.map(s=>s.kind)).size===4,'closed_census');
  requireHistory(['offered','active','completed','cancelled','expired','suspended'].includes(row.state)&&[...STAGES,'complete'].includes(row.stage),'campaign_state');
  const terminal=!['offered','active'].includes(row.state),signed=[];
  for(const r of roles){requireHistory(ROLES.includes(r.role)&&r.campaign_id===row.id&&r.account_id===originals[r.role].account&&r.original_character===originals[r.role].character&&['invited','consented','active','retired'].includes(r.state),'role_source');
   requireHistory(terminal?r.state==='retired':row.state==='active'?r.state==='active':['invited','consented'].includes(r.state),'role_state');
   if(r.consent_key_hash==null){requireHistory(r.consent_terms_hash==null&&r.consented_at==null&&['invited','retired'].includes(r.state)&&r.role!=='owner','unsigned_role');continue;}
   requireHistory(digest(r.consent_key_hash)&&r.consent_terms_hash===row.source_hash&&+new Date(iso(r.consented_at))>=+new Date(created)&&+new Date(r.consented_at)<+new Date(expires),'consent_source');
   const action=r.role==='owner'?'create':'consent',saved=requests.find(q=>q.account_id===r.account_id&&q.key_hash===r.consent_key_hash),body=action==='create'?t:{campaignId:row.id,sourceHash:row.source_hash,consent:true};requireHistory(saved?.action===action&&saved.original_character===r.original_character&&saved.body_hash===hash([action,body])&&saved.receipt?.consentedRole===r.role&&equal(saved.receipt,{ok:true,campaign:view(row,saved.receipt.campaign?.state,'scout'),consentedRole:r.role})&&(action==='create'?saved.receipt.campaign.state==='offered':['offered','active'].includes(saved.receipt.campaign.state)),'consent_ack');signed.push(r);}
  requireHistory(roles.find(r=>r.role==='owner')?.consent_key_hash,'owner_ack');
  requireHistory(requests.filter(r=>r.action==='create').length===1,'create_census');
  for(const request of requests){const role=ROLES.find(r=>originals[r].account===request.account_id&&originals[r].character===request.original_character);requireHistory(role&&ACTIONS.includes(request.action)&&actionRoles(request.action).includes(role)&&digest(request.key_hash)&&request.campaign_id===row.id&&request.body_hash===hash([request.action,requestBody(row,request)]),'request_source');const receipt=request.receipt;requireHistory(receiptShape(request)&&phaseView(request)&&receipt.ok===true&&equal(receipt.campaign,view(row,receipt.campaign?.state,receipt.campaign?.stage))&&['offered','active','completed','cancelled','expired','suspended'].includes(receipt.campaign.state)&&[...STAGES,'complete'].includes(receipt.campaign.stage),'request_view');requireHistory(+new Date(iso(request.acknowledged_at))>=+new Date(created),'request_time');if(['create','consent'].includes(request.action))requireHistory(roles.find(r=>r.role===role).consent_key_hash===request.key_hash,'consent_request_census');}
  if(row.state==='offered')requireHistory(row.activated_at==null&&row.stage==='scout'&&signed.length<6,'offered_source');
  if(row.activated_at!=null)requireHistory(signed.length===6&&+new Date(iso(row.activated_at))>=Math.max(...signed.map(r=>+new Date(r.consented_at)))&&+new Date(row.activated_at)<+new Date(expires)&&requests.filter(q=>q.action==='consent'&&q.receipt.campaign.state==='active').length===1,'activation_history');
  if(row.state==='active')requireHistory(row.activated_at!=null,'active_source');
  if(!terminal)requireHistory(row.closed_at==null&&row.closure_reason==null&&row.closure_original==null,'open_closure');else{
   requireHistory(+new Date(iso(row.closed_at))>=+new Date(created)&&Object.values(originals).some(r=>r.character===row.closure_original),'closure_source');
   const reason=row.closure_reason,own=ROLES.find(r=>originals[r].character===row.closure_original);
   if(reason==='owner_cancel')requireHistory(row.state==='cancelled'&&own==='owner'&&requests.some(r=>r.action==='cancel'&&r.original_character===row.closure_original&&r.receipt.campaign.state==='cancelled'),'cancel_ack');
   else if(reason==='provider_withdraw')requireHistory(row.state==='suspended'&&own!=='owner'&&signed.some(r=>r.role===own)&&requests.some(r=>r.action==='withdraw'&&r.original_character===row.closure_original&&r.receipt.campaign.state==='suspended'),'withdraw_ack');
   else if(reason==='source_expiry')requireHistory(row.state==='expired'&&+new Date(row.closed_at)>=+new Date(expires),'expiry_history');
   else if(['original_dead','estate_scope'].includes(reason))requireHistory(row.state==='suspended'&&characters[row.closure_original].alive===false,'estate_history');
   else if(reason==='completed')requireHistory(row.state==='completed'&&row.stage==='complete'&&own==='second_carrier'&&requests.some(r=>r.action==='courier-arrive'&&r.receipt.campaign.state==='completed'),'completion_ack');else requireHistory(false,'closure_reason');
  }
  const currentStage=row.stage==='complete'?4:STAGES.indexOf(row.stage);
  for(const stage of stages){requireHistory(STAGES.includes(stage.kind)&&stage.campaign_id===row.id&&['pending','prepared','funded','accepted','completed','retired'].includes(stage.state),'stage_state');if(terminal)requireHistory(['completed','retired'].includes(stage.state),'terminal_stage');if(STAGES.indexOf(stage.kind)<currentStage)requireHistory(stage.state==='completed','prior_stage');if(STAGES.indexOf(stage.kind)>currentStage)requireHistory(['pending','retired'].includes(stage.state)&&equal(stage.proof_json,{}),'future_stage');if(row.state==='completed')requireHistory(stage.state==='completed','complete_stages');await paidHistory(read,row,stage,requests);}
  if(row.state==='active')activeCampaigns.push(row.id);
 }catch(error){if(!(error instanceof HistoryError))throw error;issues.push({campaignId:row.id,reason:error.message});}
 return{issues,activeCampaigns,campaignCount:rows.length,historyVersion:'commercial_campaign_v1',executionAuthority:false};
}
