import crypto from 'node:crypto';
import { GameError, train } from './game.js';
import { guardDelegatedControl } from './operatingpolicy.js';
import { assertOrganizationTraining } from './employmentorganizations.js';

export const WORKER_TRAINING = Object.freeze({ maximumSessions: 8, maximumOffers: 3, maximumWage: 10000, minimumSeconds: 600, maximumSeconds: 86400 });
export const workerTrainingDDL = `CREATE TABLE IF NOT EXISTS worker_training_courses (
 id TEXT PRIMARY KEY, depot_id TEXT NOT NULL REFERENCES business_depots(id), employer_account TEXT NOT NULL REFERENCES accounts(id),
 employer_character TEXT NOT NULL REFERENCES characters(id), stat TEXT NOT NULL CHECK(stat IN ('muscle','cunning','speed')),
 sessions INT NOT NULL CHECK(sessions BETWEEN 1 AND 8), wage_cash INT NOT NULL CHECK(wage_cash BETWEEN 1 AND 10000),
 total_cash INT NOT NULL CHECK(total_cash=sessions*wage_cash), escrow_cash INT NOT NULL CHECK(escrow_cash>=0),
 paid_cash INT NOT NULL DEFAULT 0 CHECK(paid_cash>=0), refunded_cash INT NOT NULL DEFAULT 0 CHECK(refunded_cash>=0), burned_cash INT NOT NULL DEFAULT 0 CHECK(burned_cash>=0),
 completed_sessions INT NOT NULL DEFAULT 0 CHECK(completed_sessions BETWEEN 0 AND sessions),
 apprentice_account TEXT REFERENCES accounts(id), apprentice_character TEXT REFERENCES characters(id),
 expires_at TIMESTAMPTZ NOT NULL, state TEXT NOT NULL CHECK(state IN ('offered','active','completed','recoverable','closed')),
 reserve_transaction TEXT NOT NULL UNIQUE REFERENCES transactions(id),
 CHECK(total_cash=escrow_cash+paid_cash+refunded_cash+burned_cash), CHECK(paid_cash=completed_sessions*wage_cash),
 CHECK((apprentice_account IS NULL AND apprentice_character IS NULL) OR (apprentice_account IS NOT NULL AND apprentice_character IS NOT NULL AND apprentice_account<>employer_account)),
 CHECK((state='offered' AND apprentice_character IS NULL) OR state<>'offered'),
 CHECK(state<>'active' OR apprentice_character IS NOT NULL), CHECK(state NOT IN ('completed','closed') OR escrow_cash=0));
CREATE TABLE IF NOT EXISTS worker_training_requests (
 account_id TEXT NOT NULL REFERENCES accounts(id), action TEXT NOT NULL CHECK(action IN ('create','accept','train','close')),
 request_key TEXT NOT NULL CHECK(char_length(request_key) BETWEEN 1 AND 128), original_character TEXT NOT NULL REFERENCES characters(id),
 terms JSONB NOT NULL, receipt JSONB NOT NULL, PRIMARY KEY(account_id,action,request_key));
CREATE TABLE IF NOT EXISTS worker_training_sessions (
 course_id TEXT NOT NULL REFERENCES worker_training_courses(id), ordinal INT NOT NULL CHECK(ordinal BETWEEN 1 AND 8),
 apprentice_character TEXT NOT NULL REFERENCES characters(id), stat TEXT NOT NULL CHECK(stat IN ('muscle','cunning','speed')),
 stat_before INT NOT NULL, stat_after INT NOT NULL CHECK(stat_after>stat_before), energy_before INT NOT NULL, energy_after INT NOT NULL CHECK(energy_after<energy_before),
 trained_at TIMESTAMPTZ NOT NULL, next_train_at TIMESTAMPTZ NOT NULL, wage_transaction TEXT NOT NULL UNIQUE REFERENCES transactions(id),
 canonical_result JSONB NOT NULL, PRIMARY KEY(course_id,ordinal));`;
const fail = reason => { throw new GameError('worker_training', reason); };
const id = value => { if (typeof value !== 'string' || !/^[!-~]{1,128}$/.test(value)) fail('identity'); return value; };
const exact = (value, keys) => value && typeof value==='object' && !Array.isArray(value) && Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const integer = (value,min,max) => Number.isSafeInteger(value)&&value>=min&&value<=max;
const person = ch => { if(!ch?.alive||ch.is_npc||!ch.account_id) fail('actor'); };
const clock = async client => new Date((await client.query('SELECT clock_timestamp() AS observed')).rows[0].observed);
const canonical = value => JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
function termsFor(action,body){
  if(action==='create') { if(!exact(body,['depotId','stat','sessions','wageCash','durationSeconds'])||!['muscle','cunning','speed'].includes(body.stat)||!integer(body.sessions,1,8)||!integer(body.wageCash,1,10000)||!integer(body.durationSeconds,600,86400))fail('terms');return {depotId:id(body.depotId),stat:body.stat,sessions:body.sessions,wageCash:body.wageCash,durationSeconds:body.durationSeconds}; }
  if(action==='accept'){if(!exact(body,['courseId','consent'])||body.consent!==true)fail('terms');return {courseId:id(body.courseId),consent:true};}
  if(!['train','close'].includes(action)||!exact(body,['courseId']))fail('terms');return {courseId:id(body.courseId)};
}
export async function replayWorkerTraining(accountId,action,body,key,client){
  id(accountId);id(key);const terms=termsFor(action,body),row=(await client.query('SELECT terms,receipt FROM worker_training_requests WHERE account_id=$1 AND action=$2 AND request_key=$3',[accountId,action,key])).rows[0];
  if(!row)return null;if(canonical(row.terms)!==canonical(terms))fail('request_conflict');return row.receipt;
}
async function receipt(ch,action,body,key,result,client){await client.query('INSERT INTO worker_training_requests(account_id,action,request_key,original_character,terms,receipt) VALUES($1,$2,$3,$4,$5,$6)',[ch.account_id,action,key,ch.id,termsFor(action,body),result]);return result;}
async function money(ch,amount,client,h,reason,courseId){person(ch);const next=Number(ch.cash)+amount;if(!Number.isSafeInteger(next)||next<0)fail('cash');const ledgerId=await h.ledger(client,{characterId:ch.id,currency:'cash',amount,reason,counterparty:courseId});ch.cash=next;return ledgerId;}
async function lockedCourse(client,courseId){const hint=(await client.query('SELECT depot_id FROM worker_training_courses WHERE id=$1',[id(courseId)])).rows[0];if(!hint)fail('course');const depot=(await client.query('SELECT id,owner_character,status FROM business_depots WHERE id=$1 FOR UPDATE',[hint.depot_id])).rows[0];const course=(await client.query('SELECT * FROM worker_training_courses WHERE id=$1 FOR UPDATE',[courseId])).rows[0];return {course,depot};}
function currentEmployer(employer,course,depot){person(employer);if(employer.id!==course.employer_character||employer.account_id!==course.employer_account||depot?.owner_character!==employer.id||depot.status!=='open')fail('source_changed');}
export async function createWorkerTraining(ch,body,key,client,h,{agent=false}={}){
  const terms=termsFor('create',body),prior=await replayWorkerTraining(ch.account_id,'create',body,key,client);if(prior)return prior;person(ch);
  const depot=(await client.query('SELECT id,owner_character,status FROM business_depots WHERE id=$1 FOR UPDATE',[terms.depotId])).rows[0];if(!depot||depot.owner_character!==ch.id||depot.status!=='open')fail('business');
  await guardDelegatedControl(client,depot.id,agent);
  const active=(await client.query("SELECT id FROM worker_training_courses WHERE employer_account=$1 AND state IN ('offered','active','recoverable') ORDER BY id LIMIT 3",[ch.account_id])).rows;if(active.length>=3)fail('offer_limit');
  const now=await clock(client),courseId=crypto.randomUUID(),total=terms.sessions*terms.wageCash,expires=new Date(+now+terms.durationSeconds*1000);
  const source=await money(ch,-total,client,h,'worker_training:reserve',courseId);
  await client.query("INSERT INTO worker_training_courses(id,depot_id,employer_account,employer_character,stat,sessions,wage_cash,total_cash,escrow_cash,expires_at,state,reserve_transaction) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,'offered',$10)",[courseId,depot.id,ch.account_id,ch.id,terms.stat,terms.sessions,terms.wageCash,total,expires,source]);
  return receipt(ch,'create',body,key,{ok:true,courseId,reservedCash:total,reserveTransaction:source,expiresAt:expires.toISOString(),canonicalTrainingCashCost:0},client);
}
export async function acceptWorkerTraining(ch,employer,body,key,client,h){const terms=termsFor('accept',body),prior=await replayWorkerTraining(ch.account_id,'accept',body,key,client);if(prior)return prior;person(ch);await assertOrganizationTraining(client,{courseId:terms.courseId,characterId:ch.id,accountId:ch.account_id,action:'accept'});const{course,depot}=await lockedCourse(client,terms.courseId);currentEmployer(employer,course,depot);const now=await clock(client);
  if(ch.account_id===employer.account_id||course.state!=='offered'||+now>=+new Date(course.expires_at))fail('eligibility');
  if((await client.query("SELECT id FROM worker_training_courses WHERE apprentice_account=$1 AND state='active' LIMIT 1",[ch.account_id])).rows.length)fail('apprenticeship_limit');
  await client.query("UPDATE worker_training_courses SET apprentice_account=$2,apprentice_character=$3,state='active' WHERE id=$1",[course.id,ch.account_id,ch.id]);
  return receipt(ch,'accept',body,key,{ok:true,courseId:course.id,stat:course.stat,sessions:course.sessions,wageCash:course.wage_cash,expiresAt:new Date(course.expires_at).toISOString()},client);
}
export async function trainWorker(ch,employer,body,key,client,h){const terms=termsFor('train',body),prior=await replayWorkerTraining(ch.account_id,'train',body,key,client);if(prior)return prior;person(ch);await assertOrganizationTraining(client,{courseId:terms.courseId,characterId:ch.id,accountId:ch.account_id,action:'train'});const{course,depot}=await lockedCourse(client,terms.courseId);currentEmployer(employer,course,depot);const now=await clock(client);
  if(course.state!=='active'||course.apprentice_character!==ch.id||course.apprentice_account!==ch.account_id||+now>=+new Date(course.expires_at)||Number(course.escrow_cash)<Number(course.wage_cash)||Number(course.completed_sessions)>=Number(course.sessions))fail('training');
  const statBefore=Number(ch[course.stat]),energyBefore=Number(ch.energy),result=await train(ch,course.stat,client,h),after=await clock(client);if(+after>=+new Date(course.expires_at))fail('expired');
  const ordinal=Number(course.completed_sessions)+1,wage=Number(course.wage_cash),transaction=await money(ch,wage,client,h,'worker_training:wage',course.id),state=ordinal===Number(course.sessions)?'completed':'active';
  await client.query('INSERT INTO worker_training_sessions(course_id,ordinal,apprentice_character,stat,stat_before,stat_after,energy_before,energy_after,trained_at,next_train_at,wage_transaction,canonical_result) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[course.id,ordinal,ch.id,course.stat,statBefore,Number(ch[course.stat]),energyBefore,Number(ch.energy),after,ch.train_at,transaction,result]);
  await client.query('UPDATE worker_training_courses SET completed_sessions=$2,paid_cash=$3,escrow_cash=$4,state=$5 WHERE id=$1',[course.id,ordinal,Number(course.paid_cash)+wage,Number(course.escrow_cash)-wage,state]);
  return receipt(ch,'train',body,key,{ok:true,courseId:course.id,ordinal,canonicalTrain:result,statBefore,statAfter:Number(ch[course.stat]),energyBefore,energyAfter:Number(ch.energy),wageCash:wage,wageTransaction:transaction,state},client);
}
export async function closeWorkerTraining(ch,body,key,client,h){const terms=termsFor('close',body),prior=await replayWorkerTraining(ch.account_id,'close',body,key,client);if(prior)return prior;person(ch);const{course}=await lockedCourse(client,terms.courseId);if(course.employer_character!==ch.id||course.employer_account!==ch.account_id||course.state==='closed'||course.state==='completed')fail('owner');const now=await clock(client);
  if(course.state==='active'&&+now<+new Date(course.expires_at))fail('active_apprenticeship');const refund=Number(course.escrow_cash);const transaction=refund?await money(ch,refund,client,h,'worker_training:refund',course.id):null;
  await client.query("UPDATE worker_training_courses SET state='closed',escrow_cash=0,refunded_cash=refunded_cash+$2 WHERE id=$1",[course.id,refund]);return receipt(ch,'close',body,key,{ok:true,courseId:course.id,refundedCash:refund,refundTransaction:transaction},client);
}
export async function workerTrainingCounterparts(client,characterId){const rows=(await client.query("SELECT employer_character,apprentice_character FROM worker_training_courses WHERE state IN ('offered','active','recoverable') AND (employer_character=$1 OR apprentice_character=$1) ORDER BY id LIMIT 5",[id(characterId)])).rows;if(rows.length>4)fail('death_limit');return [...new Set(rows.flatMap(r=>[r.employer_character,r.apprentice_character]).filter(v=>v&&v!==characterId))].sort();}
export async function voidWorkerTrainingAtDeath(client,h,victim){if(!victim||victim.alive!==false||victim.is_npc)fail('death_required');const original=(await client.query('SELECT id,account_id,alive FROM characters WHERE id=$1',[id(victim.id)])).rows[0];if(!original||original.account_id!==victim.account_id||original.alive)fail('death_required');const rows=(await client.query("SELECT * FROM worker_training_courses WHERE state IN ('offered','active','recoverable') AND (employer_character=$1 OR apprentice_character=$1) ORDER BY id LIMIT 5 FOR UPDATE",[victim.id])).rows;if(rows.length>4)fail('death_limit');let burned=0;
  for(const course of rows){if(course.employer_character===victim.id){const amount=Number(course.escrow_cash);await client.query("UPDATE worker_training_courses SET state='closed',escrow_cash=0,burned_cash=burned_cash+$2 WHERE id=$1",[course.id,amount]);if(amount)await h.ledger(client,{currency:'cash',amount:-amount,reason:'death:worker_training',counterparty:course.id});burned+=amount;}else await client.query("UPDATE worker_training_courses SET state='recoverable' WHERE id=$1",[course.id]);}
  return {closedCourses:rows.length,burnedCash:burned};
}
export async function workerTrainingBoard(client,accountId){id(accountId);const courses=(await client.query('SELECT id,depot_id,employer_character,apprentice_character,stat,sessions,completed_sessions,wage_cash,escrow_cash,expires_at,state FROM worker_training_courses WHERE employer_account=$1 OR apprentice_account=$1 ORDER BY id LIMIT 20',[accountId])).rows;
  const offers=(await client.query("SELECT t.id,t.stat,t.sessions,t.wage_cash,t.expires_at FROM worker_training_courses t JOIN business_depots d ON d.id=t.depot_id JOIN characters c ON c.id=t.employer_character LEFT JOIN employment_organization_courses l ON l.course_id=t.id WHERE t.state='offered' AND t.expires_at>clock_timestamp() AND d.status='open' AND d.owner_character=t.employer_character AND c.alive=true AND l.course_id IS NULL ORDER BY t.id LIMIT 20")).rows;return {courses,offers,canonicalTrainingCashCost:0};}
export async function collectWorkerTrainingIssues(client){const rows=(await client.query('SELECT id,total_cash,escrow_cash,paid_cash,refunded_cash,burned_cash,completed_sessions,wage_cash,reserve_transaction,employer_character,apprentice_character,stat FROM worker_training_courses ORDER BY id LIMIT 1001')).rows;const issues=[];if(rows.length>1000)issues.push({reason:'check_limit'});
  for(const c of rows.slice(0,1000)){const tx=(await client.query("SELECT id,character_id,currency,amount,reason FROM transactions WHERE counterparty=$1 AND reason IN ('worker_training:reserve','worker_training:wage','worker_training:refund','death:worker_training') ORDER BY id LIMIT 12",[c.id])).rows;const amounts=Object.fromEntries(['worker_training:reserve','worker_training:wage','worker_training:refund','death:worker_training'].map(reason=>[reason,tx.filter(r=>r.reason===reason).reduce((s,r)=>s+Number(r.amount),0)]));const sessions=(await client.query('SELECT ordinal,wage_transaction,canonical_result,stat,apprentice_character,stat_before,stat_after,energy_before,energy_after FROM worker_training_sessions WHERE course_id=$1 ORDER BY ordinal LIMIT 9',[c.id])).rows;
    if(Number(c.total_cash)!==-amounts['worker_training:reserve']||Number(c.paid_cash)!==amounts['worker_training:wage']||Number(c.refunded_cash)!==amounts['worker_training:refund']||Number(c.burned_cash)!==-amounts['death:worker_training']||Number(c.escrow_cash)!==Number(c.total_cash)-Number(c.paid_cash)-Number(c.refunded_cash)-Number(c.burned_cash))issues.push({reason:'budget',courseId:c.id});
    if(tx.length>11||sessions.length!==Number(c.completed_sessions)||!tx.some(r=>r.id===c.reserve_transaction&&r.reason==='worker_training:reserve'&&r.character_id===c.employer_character&&r.currency==='cash'&&Number(r.amount)===-Number(c.total_cash)))issues.push({reason:'source_count',courseId:c.id});
    for(const session of sessions){const wage=tx.find(r=>r.id===session.wage_transaction);if(!wage||wage.currency!=='cash'||wage.character_id!==c.apprentice_character||session.apprentice_character!==c.apprentice_character||session.stat!==c.stat||wage.reason!=='worker_training:wage'||Number(wage.amount)!==Number(c.wage_cash)||!session.canonical_result?.ok||Number(session.canonical_result.gain)!==Number(session.stat_after)-Number(session.stat_before)||Number(session.energy_after)>=Number(session.energy_before))issues.push({reason:'canonical_session',courseId:c.id,ordinal:session.ordinal});}
  }return issues;
}
