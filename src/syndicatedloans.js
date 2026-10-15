import crypto from 'node:crypto';
import * as G from './game.js';
import * as Loans from './loans.js';
import * as Rental from './equipmentrentals.js';
import { LOAN, loanOwed, loanVig } from './rules.js';
import { assertItemTransaction, registerItemTransactionUndo, poisonItemTransaction, withItemRead } from './items.js';
import { assertEstateResolutionScope } from './social/estate.js';

export const SYNDICATED_LOAN = Object.freeze({ lenders:2, maximumFacilityPrincipal:LOAN.MAX, maximumActiveFacilitiesPerAccount:1, maximumProposalSeconds:3600, defaultRecovery:'canonical_individual_legs_not_proportional' });
const scopes=new WeakMap(),fail=reason=>{throw new G.GameError('syndicated_loan',reason);};
const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0)):v);
const hash=x=>crypto.createHash('sha256').update(stable(x)).digest('hex');
const id=x=>{if(typeof x!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(x))fail('terms');return x;};
const integer=(x,a,b)=>Number.isSafeInteger(x)&&x>=a&&x<=b;
const exact=(b,keys)=>b&&typeof b==='object'&&!Array.isArray(b)&&Object.keys(b).sort().join(',')===keys.split(',').sort().join(',');
const observed=async c=>new Date((await c.query('SELECT clock_timestamp() AS at')).rows[0].at);
const unavailable=()=>Object.assign(new G.GameError('syndicated_loan_unavailable','Canonical enrolled-loan guard and genuine three-original persistence capability required.'),{statusCode:503});
export const syndicatedLoanDDL=`
CREATE TABLE IF NOT EXISTS syndicated_loan_facilities (
 id TEXT PRIMARY KEY,borrower_account TEXT NOT NULL REFERENCES accounts(id),borrower_character TEXT NOT NULL REFERENCES characters(id),
 terms JSONB NOT NULL,terms_hash TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('funding','funded','active','repaid','cancelled','retired')),
 created_at TIMESTAMPTZ NOT NULL,expires_at TIMESTAMPTZ NOT NULL,CHECK(expires_at>created_at));
CREATE TABLE IF NOT EXISTS syndicated_loan_legs (
 facility_id TEXT NOT NULL REFERENCES syndicated_loan_facilities(id),lender_account TEXT NOT NULL REFERENCES accounts(id),lender_character TEXT NOT NULL REFERENCES characters(id),
 loan_id TEXT NOT NULL UNIQUE,principal INT NOT NULL CHECK(principal>0),funded_at TIMESTAMPTZ NOT NULL,source_hash TEXT NOT NULL,
 fund_transaction TEXT NOT NULL UNIQUE REFERENCES transactions(id),canonical_receipt JSONB NOT NULL,
 PRIMARY KEY(facility_id,lender_account));
CREATE TABLE IF NOT EXISTS syndicated_loan_members (
 account_id TEXT PRIMARY KEY REFERENCES accounts(id),character_id TEXT NOT NULL REFERENCES characters(id),facility_id TEXT NOT NULL REFERENCES syndicated_loan_facilities(id));
CREATE TABLE IF NOT EXISTS syndicated_loan_requests (
 account_id TEXT NOT NULL REFERENCES accounts(id),key_hash TEXT NOT NULL,body_hash TEXT NOT NULL,receipt JSONB NOT NULL,
 original_character TEXT NOT NULL REFERENCES characters(id),facility_id TEXT NOT NULL REFERENCES syndicated_loan_facilities(id),
 action TEXT NOT NULL CHECK(action IN ('propose','fund','take','repay','cancel')),request_json JSONB NOT NULL,PRIMARY KEY(account_id,key_hash));`;

export function syndicatedLoanTerms(action,b) {
  if(action==='propose') {
    if(!exact(b,'lenderCharacters,principalPerLender,rateBps,termHours,expiresInSeconds,consent')||b.consent!==true
      ||!Array.isArray(b.lenderCharacters)||b.lenderCharacters.length!==2||new Set(b.lenderCharacters).size!==2
      ||!integer(b.principalPerLender,LOAN.MIN,Math.floor(LOAN.MAX/2))||!integer(b.rateBps,1,Math.floor(LOAN.RATE_MAX*10000))
      ||!integer(b.termHours,LOAN.TERM_MIN_H,LOAN.TERM_MAX_H)||!integer(b.expiresInSeconds,60,SYNDICATED_LOAN.maximumProposalSeconds))fail('terms');
    b.lenderCharacters.forEach(id);if(b.lenderCharacters.join(',')!==[...b.lenderCharacters].sort().join(','))fail('party_order');
  } else {
    if(!['fund','take','repay','cancel'].includes(action)||!exact(b,'facilityId,termsHash,consent')||b.consent!==true)fail('terms');id(b.facilityId);
    if(typeof b.termsHash!=='string'||!/^[a-f0-9]{64}$/.test(b.termsHash))fail('terms');
  }
  return JSON.parse(stable(b));
}
const facilityHash=r=>hash(['syndicated-loan-v1',r.id,r.borrower_account,r.borrower_character,r.terms,+new Date(r.created_at),+new Date(r.expires_at)]);
const legHash=(r,x)=>hash(['syndicated-loan-leg-v1',r.id,r.terms_hash,x.lender_account,x.lender_character,x.loan_id,Number(x.principal),+new Date(x.funded_at),x.fund_transaction,x.canonical_receipt]);
const originalIds=r=>[r.borrower_character,...r.terms.lenders.map(x=>x.characterId)];
const originalAccounts=r=>[r.borrower_account,...r.terms.lenders.map(x=>x.accountId)];
function bound(r){if(!r||r.terms_hash!==facilityHash(r)||!Array.isArray(r.terms?.lenders)||r.terms.lenders.length!==2||new Set(originalIds(r)).size!==3||new Set(originalAccounts(r)).size!==3
  ||!integer(r.terms.principalPerLender,LOAN.MIN,Math.floor(LOAN.MAX/2))||!integer(r.terms.rateBps,1,LOAN.RATE_MAX*10000)||!integer(r.terms.termHours,LOAN.TERM_MIN_H,LOAN.TERM_MAX_H))fail('source');return r;}
async function facility(c,key,lock=false){const result=lock?await c.query('SELECT * FROM syndicated_loan_facilities WHERE id=$1 FOR UPDATE',[key]):await c.query('SELECT * FROM syndicated_loan_facilities WHERE id=$1',[key]);const r=bound(result.rows[0]);await originalProposal(c,r);return r;}
async function originalProposal(c,r){const rows=(await c.query("SELECT * FROM syndicated_loan_requests WHERE facility_id=$1 AND action='propose' LIMIT 2",[r.id])).rows;if(rows.length!==1)fail('proposal_receipt');const q=rows[0],input=syndicatedLoanTerms('propose',q.request_json);if(q.account_id!==r.borrower_account||q.original_character!==r.borrower_character||q.body_hash!==hash(['propose',input])||q.receipt?.facility?.id!==r.id||q.receipt.facility.termsHash!==r.terms_hash||stable(input.lenderCharacters)!==stable(r.terms.lenders.map(x=>x.characterId))||input.principalPerLender!==r.terms.principalPerLender||input.rateBps!==r.terms.rateBps||input.termHours!==r.terms.termHours||+new Date(r.expires_at)-+new Date(r.created_at)!==input.expiresInSeconds*1000)fail('proposal_receipt');}
async function legs(c,r,lock=false){const rows=(await c.query('SELECT * FROM syndicated_loan_legs WHERE facility_id=$1 ORDER BY loan_id',[r.id])).rows;if(rows.length>2)fail('source');const result=[];
  for(const row of rows){const source=(lock?await c.query('SELECT * FROM loans WHERE id=$1 FOR UPDATE',[row.loan_id]):await c.query('SELECT * FROM loans WHERE id=$1',[row.loan_id])).rows[0];const lender=r.terms.lenders.find(x=>x.accountId===row.lender_account&&x.characterId===row.lender_character);
    if(!lender||Number(row.principal)!==r.terms.principalPerLender||row.source_hash!==legHash(r,row))fail('source');
    const receipt={ok:true,id:row.loan_id,principal:r.terms.principalPerLender,owed:loanOwed(r.terms.principalPerLender,r.terms.rateBps/10000),hours:r.terms.termHours,directed:true,collateralMin:0,collateralOmr:0};if(stable(receipt)!==stable(row.canonical_receipt))fail('canonical_funding_receipt');const tx=(await c.query('SELECT * FROM transactions WHERE id=$1',[row.fund_transaction])).rows[0];if(!tx||tx.character_id!==row.lender_character||tx.account_id!==null||tx.currency!=='cash'||Number(tx.amount)!==-Number(row.principal)||tx.reason!=='loan:offer'||tx.counterparty!==null)fail('canonical_funding');
  if(source&&(Number(source.principal)!==r.terms.principalPerLender||Number(source.rate)!==r.terms.rateBps/10000||Number(source.hours)!==r.terms.termHours||source.offered_to!==r.borrower_character||Number(source.collateral_min)!==0||Number(source.collateral_omr)!==0||source.collateral_car))fail('canonical_terms');
    if(source&&['active','repaid','collected'].includes(source.status)&&source.borrower_character!==r.borrower_character)fail('canonical_borrower');
    result.push({row,source});}return result;
}
async function replay(c,account,key,identity){const r=(await c.query('SELECT body_hash,receipt,action,request_json FROM syndicated_loan_requests WHERE account_id=$1 AND key_hash=$2',[account,hash(key)])).rows[0];if(!r)return null;if(r.body_hash!==identity)fail('key_conflict');if(hash([r.action,syndicatedLoanTerms(r.action,r.request_json)])!==identity)fail('request_source');return {...r.receipt,replayed:true,executionAuthority:false};}
async function originalFunding(c,r,entries){for(const {row} of entries){const records=(await c.query("SELECT * FROM syndicated_loan_requests WHERE facility_id=$1 AND account_id=$2 AND action='fund' LIMIT 2",[r.id,row.lender_account])).rows;if(records.length!==1)fail('funding_consent');const q=records[0],input=syndicatedLoanTerms('fund',q.request_json),own=q.receipt?.facility?.legs?.filter(x=>x.loanId===row.loan_id);if(q.original_character!==row.lender_character||q.body_hash!==hash(['fund',input])||input.facilityId!==r.id||input.termsHash!==r.terms_hash||q.receipt?.facility?.id!==r.id||q.receipt.facility.termsHash!==r.terms_hash||own?.length!==1||own[0].originalLender!==row.lender_character||own[0].principal!==Number(row.principal)||own[0].status!=='open')fail('funding_consent');}}
async function save(c,account,key,identity,result,action,input,original){registerItemTransactionUndo(c,()=>c.query('DELETE FROM syndicated_loan_requests WHERE account_id=$1 AND key_hash=$2',[account,hash(key)]));await c.query('INSERT INTO syndicated_loan_requests(account_id,key_hash,body_hash,receipt,original_character,facility_id,action,request_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[account,hash(key),identity,JSON.stringify(result),original,result.facility.id,action,input]);return result;}
async function setState(c,r,state){const previous=r.state;registerItemTransactionUndo(c,()=>c.query('UPDATE syndicated_loan_facilities SET state=$2 WHERE id=$1',[r.id,previous]));await c.query('UPDATE syndicated_loan_facilities SET state=$2 WHERE id=$1',[r.id,state]);r.state=state;}
async function releaseMembers(c,r){const rows=(await c.query('SELECT * FROM syndicated_loan_members WHERE facility_id=$1',[r.id])).rows;registerItemTransactionUndo(c,async()=>{for(const x of rows)await c.query('INSERT INTO syndicated_loan_members(account_id,character_id,facility_id) VALUES($1,$2,$3)',[x.account_id,x.character_id,x.facility_id]);});await c.query('DELETE FROM syndicated_loan_members WHERE facility_id=$1',[r.id]);}
const view=(r,entries)=>({id:r.id,borrowerCharacter:r.borrower_character,lenderCharacters:r.terms.lenders.map(x=>x.characterId),principalPerLender:r.terms.principalPerLender,totalPrincipal:2*r.terms.principalPerLender,rateBps:r.terms.rateBps,termHours:r.terms.termHours,termsHash:r.terms_hash,state:r.state,expiresAt:new Date(r.expires_at).toISOString(),legs:entries.map(({row,source})=>({loanId:row.loan_id,originalLender:row.lender_character,currentLender:source?.lender_character||null,status:source?.status||'canonical_source_removed',principal:Number(row.principal)})),fullRepaymentOnly:true,defaultRecovery:SYNDICATED_LOAN.defaultRecovery,executionAuthority:false});

// Called by the canonical Loans module after its row lock, never by a JSON capability.
export async function assertSyndicatedLoanMutation(c,ch,loanId,action) {
  if(!['take','cancel','repay','collect','sellPaper','unsellPaper','buyPaper'].includes(action))fail('guard_action');
  const link=(await c.query('SELECT facility_id FROM syndicated_loan_legs WHERE loan_id=$1',[loanId])).rows[0];if(!link)return;
  assertItemTransaction(c);
  const r=await facility(c,link.facility_id),s=scopes.get(c),entries=await legs(c,r);await originalFunding(c,r,entries);
  if(s?.active&&s.facilityId===r.id&&s.loanIds.has(loanId)&&s.actions.has(action)&&s.originalIds.includes(ch.id)){const ctx=await G.assertSyndicatedLoanActionScope(c,s.account,s.action,s.input,s.key,s.token);if(ctx.parties.find(p=>p.id===ch.id)!==ch)fail('canonical_actor');await rememberCanonicalLoan(c,s,loanId);return;}
  // Collection remains the existing individually authorized default operation. No proportional recovery is promised.
  if(action==='collect'||action==='cancel')return;
  const recovery=['repaid','cancelled','retired'].includes(r.state)||entries.some(x=>!x.source||['cancelled','collected','repaid'].includes(x.source.status));
  if(recovery&&action!=='take')return;
  fail('enrolled_scope_required');
}
async function rememberCanonicalLoan(c,s,loanId){if(s.rememberedLoans.has(loanId))return;s.rememberedLoans.add(loanId);const row=(await c.query('SELECT * FROM loans WHERE id=$1',[loanId])).rows[0];registerItemTransactionUndo(c,async()=>{if(!row){await c.query('DELETE FROM loans WHERE id=$1',[loanId]);return;}const keys=Object.keys(row).filter(k=>k!=='id');await c.query('UPDATE loans SET '+keys.map((k,i)=>k+'=$'+(i+2)).join(',')+' WHERE id=$1',[loanId,...keys.map(k=>row[k])]);});}
export async function prepareSyndicatedLoanOffer(c,ch,loanId,body){const s=scopes.get(c);if(!s?.active)return;try{const ctx=await G.assertSyndicatedLoanActionScope(c,s.account,s.action,s.input,s.key,s.token),r=await facility(c,s.facilityId);if(s.action!=='fund'||ctx.actor!==ch||stable(body)!==stable({amount:r.terms.principalPerLender,rate:r.terms.rateBps/10000,hours:r.terms.termHours,to:r.borrower_character,collateral:0,collateralOmr:0}))fail('canonical_offer_scope');if((await c.query('SELECT id FROM loans WHERE id=$1',[loanId])).rows.length)fail('canonical_offer_scope');await rememberCanonicalLoan(c,s,loanId);}catch(e){poisonItemTransaction(c,e);throw e;}}
export async function finishSyndicatedLoanMutation(c,loanId,action){const link=(await c.query('SELECT facility_id FROM syndicated_loan_legs WHERE loan_id=$1',[loanId])).rows[0];if(!link)return;assertItemTransaction(c);try{const r=await facility(c,link.facility_id),entries=await legs(c,r);if(['cancel','collect'].includes(action)&&entries.some(x=>!x.source||['cancelled','collected'].includes(x.source.status))&&!['retired','cancelled','repaid'].includes(r.state)){await setState(c,r,'retired');await releaseMembers(c,r);}}catch(e){poisonItemTransaction(c,e);throw e;}}
// Canonical take may admit the second exact leg, never another facility or a larger total principal.
export async function permitsSyndicatedLoanTake(c,ch,loanId) {
  const s=scopes.get(c);if(!s?.active||s.action!=='take'||s.borrowerId!==ch.id||!s.loanIds.has(loanId))return false;
  const ctx=await G.assertSyndicatedLoanActionScope(c,s.account,s.action,s.input,s.key,s.token);if(ctx.actor!==ch)fail('canonical_actor');
  const r=await facility(c,s.facilityId),entries=await legs(c,r);await originalFunding(c,r,entries);if(entries.length!==2||!['funded','active'].includes(r.state)||2*r.terms.principalPerLender>LOAN.MAX)fail('facility_admission');
  const active=(await c.query("SELECT * FROM loans WHERE borrower_character=$1 AND status='active' ORDER BY id",[ch.id])).rows;
  if(active.some(x=>!s.loanIds.has(x.id))||active.length>1)fail('third_debt');
  for(const x of entries)if(!x.source||x.source.lender_character!==x.row.lender_character||!['open','active'].includes(x.source.status))fail('canonical_source');
  return true;
}

function canonicalReady(){return G.syndicatedLoanDispatch===executeSyndicatedLoanAction&&typeof G.runSyndicatedLoanAction==='function'&&typeof G.assertSyndicatedLoanActionScope==='function'&&Rental.syndicatedLoanSource===syndicatedLoanScopeSource&&typeof Rental.prelockSyndicatedLoanActors==='function'&&Loans.syndicatedLoanGuard===assertSyndicatedLoanMutation;}
export function createSyndicatedLoanRuntime({pool}={}){return{ready:async()=>canonicalReady(),async action(account,action,body,key){if(!canonicalReady())throw unavailable();id(account);id(key);const input=syndicatedLoanTerms(action,body),old=await replay(pool,account,key,hash([action,input]));if(old)return old;return G.runSyndicatedLoanAction(pool,account,action,input,key);}};}
export async function replaySyndicatedLoanRequest(c,account,action,body,key){id(account);id(key);const input=syndicatedLoanTerms(action,body);return replay(c,account,key,hash([action,input]));}
export async function assertSyndicatedLoanCompletion(c,account,action,input,key,token,result){const ctx=await G.assertSyndicatedLoanActionScope(c,account,action,input,key,token),r=await facility(c,result.facility.id),entries=await legs(c,r),entry=(await c.query('SELECT * FROM syndicated_loan_requests WHERE account_id=$1 AND key_hash=$2',[account,hash(key)])).rows[0];await originalFunding(c,r,entries);if(!entry||entry.original_character!==ctx.actor.id||entry.facility_id!==r.id||entry.action!==action||entry.body_hash!==hash([action,input])||stable(entry.request_json)!==stable(input)||stable(entry.receipt)!==stable(result)||stable(view(r,entries))!==stable(result.facility))fail('completed_source');if(['propose','fund','take'].includes(action)&&+await observed(c)>=+new Date(r.expires_at))fail('expired');return true;}
export async function syndicatedLoanScopeSource(c,account,action,body,key){id(account);id(key);const input=syndicatedLoanTerms(action,body);let parties;
 if(action==='propose'){const actor=(await c.query('SELECT id,account_id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2',[account])).rows;if(actor.length!==1)fail('original_parties');parties=[actor[0]];for(const character of input.lenderCharacters){const p=(await c.query('SELECT id,account_id FROM characters WHERE id=$1',[character])).rows[0];if(!p)fail('original_parties');parties.push(p);}}
 else{const r=await facility(c,input.facilityId);if(r.terms_hash!==input.termsHash||!originalAccounts(r).includes(account))fail('source');parties=[{id:r.borrower_character,account_id:r.borrower_account},...r.terms.lenders.map(x=>({id:x.characterId,account_id:x.accountId}))];}
 if(parties.length!==3||new Set(parties.map(p=>p.id)).size!==3||new Set(parties.map(p=>p.account_id)).size!==3)fail('original_parties');return{originals:parties.map(p=>p.id).sort(),parties,sourceHash:hash([account,action,input,key,parties])};}
export async function clearExpiredSyndicatedLoanMembership(c,account){assertItemTransaction(c);id(account);try{const member=(await c.query('SELECT facility_id FROM syndicated_loan_members WHERE account_id=$1',[account])).rows[0];if(!member)return false;const hint=await facility(c,member.facility_id);if(!['funding','funded'].includes(hint.state)||+await observed(c)<+new Date(hint.expires_at))return false;const entries=await legs(c,hint,true),r=await facility(c,hint.id,true);if(!['funding','funded'].includes(r.state)||+await observed(c)<+new Date(r.expires_at)||entries.some(x=>x.source?.status==='active'))return false;await setState(c,r,'retired');await releaseMembers(c,r);return true;}catch(e){poisonItemTransaction(c,e);throw e;}}
async function rememberSingleton(c,table){const row=(await c.query('SELECT * FROM '+table+' WHERE id=1 FOR UPDATE')).rows[0];if(!row)fail('canonical_singleton');registerItemTransactionUndo(c,()=>c.query('UPDATE '+table+' SET pool=$1 WHERE id=1',[row.pool]));}
export async function executeSyndicatedLoanAction(c,account,action,input,key,token){assertItemTransaction(c);const context=await G.assertSyndicatedLoanActionScope(c,account,action,input,key,token),{actor,parties,helpersFor}=context,identity=hash([action,input]);const fresh=await replay(c,account,key,identity);if(fresh)return fresh;const hint=action==='propose'?null:await facility(c,input.facilityId);
      try {
        let r,entries=[];
        if(action==='propose'){
          if(!input.lenderCharacters.every(x=>parties.some(p=>p.id===x))||input.lenderCharacters.includes(actor.id))fail('original_parties');
          if((await c.query('SELECT account_id FROM syndicated_loan_members WHERE account_id=$1',[actor.account_id])).rows.length)fail('active_facility');
          const at=await observed(c),facilityId=crypto.randomUUID(),terms={lenders:input.lenderCharacters.map(x=>{const p=parties.find(y=>y.id===x);return {accountId:p.account_id,characterId:p.id};}),principalPerLender:input.principalPerLender,rateBps:input.rateBps,termHours:input.termHours};
          r={id:facilityId,borrower_account:account,borrower_character:actor.id,terms,created_at:at,expires_at:new Date(+at+input.expiresInSeconds*1000),state:'funding'};r.terms_hash=facilityHash(r);
          registerItemTransactionUndo(c,()=>c.query('DELETE FROM syndicated_loan_facilities WHERE id=$1',[r.id]));await c.query("INSERT INTO syndicated_loan_facilities(id,borrower_account,borrower_character,terms,terms_hash,state,created_at,expires_at) VALUES($1,$2,$3,$4,$5,'funding',$6,$7)",[r.id,account,actor.id,JSON.stringify(terms),r.terms_hash,at,r.expires_at]);
          for(const p of [actor]){registerItemTransactionUndo(c,()=>c.query('DELETE FROM syndicated_loan_members WHERE account_id=$1',[p.account_id]));await c.query('INSERT INTO syndicated_loan_members(account_id,character_id,facility_id) VALUES($1,$2,$3)',[p.account_id,p.id,r.id]);}
        } else {
          // Canonical rows are locked BEFORE facility metadata, consistent with standalone Loans mutations.
          entries=await legs(c,hint,true);await originalFunding(c,hint,entries);r=await facility(c,input.facilityId,true);
          const expected=[{characterId:r.borrower_character,accountId:r.borrower_account},...r.terms.lenders];
          if(r.terms_hash!==input.termsHash||r.terms_hash!==hint.terms_hash||parties.some(p=>!expected.some(x=>x.characterId===p.id&&x.accountId===p.account_id)))fail('source');
          const expired=+await observed(c)>=+new Date(r.expires_at);
          if(['fund','take'].includes(action)&&expired)fail('expired');
          if(entries.some(x=>!x.source||x.source.lender_character!==x.row.lender_character))fail('original_holder');
          const s={active:true,token,input,key,account,rememberedLoans:new Set(),facilityId:r.id,action,borrowerId:r.borrower_character,originalIds:originalIds(r),loanIds:new Set(entries.map(x=>x.row.loan_id)),actions:new Set(action==='take'?['take']:action==='repay'?['repay']:action==='cancel'?['cancel']:[])};
          if(scopes.has(c))fail('scope');scopes.set(c,s);
          try {
            if(action==='fund'){
              if((await c.query('SELECT account_id FROM syndicated_loan_members WHERE account_id=$1',[account])).rows.length)fail('active_facility');if(r.state!=='funding'||actor.id===r.borrower_character||!r.terms.lenders.some(x=>x.characterId===actor.id&&x.accountId===account)||entries.some(x=>x.row.lender_account===account)||entries.some(x=>x.source.status!=='open'))fail('fund_consent');
              const before=Number(actor.cash),journalStart=context.journals.length,result=await Loans.offerLoan(actor,{amount:r.terms.principalPerLender,rate:r.terms.rateBps/10000,hours:r.terms.termHours,to:r.borrower_character,collateral:0,collateralOmr:0},c,helpersFor(actor.id));
              if(Number(actor.cash)!==before-r.terms.principalPerLender)fail('canonical_effect');
              const added=context.journals.slice(journalStart);if(added.length!==1)fail('canonical_funding');const fundedAt=await observed(c),link={lender_account:account,lender_character:actor.id,loan_id:result.id,principal:r.terms.principalPerLender,funded_at:fundedAt,fund_transaction:added[0],canonical_receipt:result};
              registerItemTransactionUndo(c,()=>c.query('DELETE FROM syndicated_loan_legs WHERE loan_id=$1',[result.id]));await c.query('INSERT INTO syndicated_loan_legs(facility_id,lender_account,lender_character,loan_id,principal,funded_at,source_hash,fund_transaction,canonical_receipt) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[r.id,account,actor.id,result.id,r.terms.principalPerLender,fundedAt,legHash(r,link),link.fund_transaction,result]);
              registerItemTransactionUndo(c,()=>c.query('DELETE FROM syndicated_loan_members WHERE account_id=$1',[account]));await c.query('INSERT INTO syndicated_loan_members(account_id,character_id,facility_id) VALUES($1,$2,$3)',[account,actor.id,r.id]);entries=await legs(c,r);if(entries.length===2)await setState(c,r,'funded');
            }else if(action==='take'){
              if(actor.id!==r.borrower_character||r.state!=='funded'||entries.length!==2||entries.some(x=>x.source.status!=='open'))fail('take_consent');
              if((await c.query("SELECT id FROM loans WHERE borrower_character=$1 AND status='active' LIMIT 1",[actor.id])).rows.length)fail('third_debt');const before=Number(actor.cash);for(const x of entries)await Loans.takeLoan(actor,x.row.loan_id,null,c,helpersFor(actor.id));if(Number(actor.cash)!==before+2*r.terms.principalPerLender)fail('canonical_effect');await setState(c,r,'active');
            }else if(action==='repay'){
              if(actor.id!==r.borrower_character||r.state!=='active'||entries.length!==2||entries.some(x=>x.source.status!=='active'||x.source.borrower_character!==actor.id))fail('full_repayment');
              const owed=loanOwed(r.terms.principalPerLender,r.terms.rateBps/10000),net=owed-loanVig(owed);if(Number(actor.cash)<2*owed)fail('cash');
              await rememberSingleton(c,'street_tax');await rememberSingleton(c,'loan_house');const beforeBorrower=Number(actor.cash);for(const x of entries){const lender=parties.find(p=>p.id===x.row.lender_character),before=Number(lender.cash);const paid=await Loans.repayLoan(actor,lender,x.row.loan_id,c,helpersFor(actor.id));if(paid.paid!==owed||paid.toLender!==net||Number(lender.cash)!==before+net)fail('canonical_effect');}if(Number(actor.cash)!==beforeBorrower-2*owed)fail('canonical_effect');await setState(c,r,'repaid');await releaseMembers(c,r);
            }else if(action==='cancel'){
              if(!['funding','funded'].includes(r.state)||entries.some(x=>x.source.status==='active'))fail('cancel_active');
              if(actor.id===r.borrower_character){if(entries.length)fail('lender_refund_authority');await setState(c,r,'cancelled');await releaseMembers(c,r);}
              else{const own=entries.find(x=>x.row.lender_account===account&&x.row.lender_character===actor.id);if(!own||own.source.status!=='open')fail('lender_refund_authority');await Loans.cancelLoan(actor,own.row.loan_id,c,helpersFor(actor.id));r=await facility(c,r.id);if(r.state!=='retired')fail('canonical_effect');}
            }
          }finally{s.active=false;scopes.delete(c);}
          entries=await legs(c,r);
        }
        await G.assertSyndicatedLoanActionScope(c,account,action,input,key,token);const result={ok:true,facility:view(r,entries),executionAuthority:false};const saved=await save(c,account,key,identity,result,action,input,actor.id);if(['propose','fund','take'].includes(action)&&+await observed(c)>=+new Date(r.expires_at))fail('expired');await G.assertSyndicatedLoanActionScope(c,account,action,input,key,token);return saved;
      }catch(error){poisonItemTransaction(c,error);throw error;}

}

export async function syndicatedLoanBoard(pool,account){id(account);return withItemRead(pool,async c=>{const rows=(await c.query("SELECT * FROM syndicated_loan_facilities WHERE borrower_account=$1 OR terms->'lenders'->0->>'accountId'=$1 OR terms->'lenders'->1->>'accountId'=$1 ORDER BY created_at DESC,id LIMIT 21",[account])).rows;const result=[];for(const r of rows.slice(0,20)){bound(r);await originalProposal(c,r);const entries=await legs(c,r);await originalFunding(c,r,entries);result.push(view(r,entries));}return {facilities:result,historyTruncated:rows.length>20,currency:'game_cash',executionAuthority:false};});}
// Metadata-only root estate hook AFTER canonical loan death resolution; it never changes money or current paper ownership.
export async function retireSyndicatedLoansAtDeath(c,character,h){assertItemTransaction(c);await assertEstateResolutionScope(c,id(character),h?.estateResolutionScope);const rows=(await c.query("SELECT f.* FROM syndicated_loan_facilities f JOIN syndicated_loan_members m ON m.facility_id=f.id WHERE m.character_id=$1 ORDER BY f.id FOR UPDATE",[character])).rows;if(rows.length>1)fail('active_facility');for(const r of rows){bound(r);await setState(c,r,'retired');await releaseMembers(c,r);}return rows.length;}

// Source provenance only: all money remains in the unchanged canonical Loans cash books.
export async function collectSyndicatedLoanIssues(pool){return withItemRead(pool,async c=>{const issues=[],rows=(await c.query('SELECT * FROM syndicated_loan_facilities ORDER BY id')).rows;for(const r of rows){try{bound(r);await originalProposal(c,r);const entries=await legs(c,r);await originalFunding(c,r,entries);const members=(await c.query('SELECT * FROM syndicated_loan_members WHERE facility_id=$1 ORDER BY account_id',[r.id])).rows,open=['funding','funded','active'].includes(r.state),expected=[{account_id:r.borrower_account,character_id:r.borrower_character},...entries.map(x=>({account_id:x.row.lender_account,character_id:x.row.lender_character}))];if(members.length!==(open?expected.length:0)||members.some(m=>!expected.some(p=>p.account_id===m.account_id&&p.character_id===m.character_id)))fail('membership_source');for(const p of expected){const ch=(await c.query('SELECT account_id FROM characters WHERE id=$1',[p.character_id])).rows[0];if(ch?.account_id!==p.account_id)fail('original_binding');}if(r.state==='active'){const active=(await c.query("SELECT id FROM loans WHERE borrower_character=$1 AND status='active' ORDER BY id",[r.borrower_character])).rows;if(entries.length!==2||active.length!==2||entries.some(x=>x.source?.status!=='active'||x.source.lender_character!==x.row.lender_character||!active.some(a=>a.id===x.row.loan_id)))fail('logical_facility');}if(r.state==='funded'&&entries.length!==2)fail('funded_source');}catch(e){if(e?.code!=='syndicated_loan')throw e;issues.push({facilityId:r.id,issue:e.message});}}const orphans=(await c.query('SELECT m.facility_id FROM syndicated_loan_members m LEFT JOIN syndicated_loan_facilities f ON f.id=m.facility_id WHERE f.id IS NULL')).rows;for(const x of orphans)issues.push({facilityId:x.facility_id,issue:'membership_facility'});return issues;});}
