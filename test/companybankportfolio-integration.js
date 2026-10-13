import assert from 'node:assert/strict';
const native=process.argv.includes('--postgres'); assert(!process.env.DATABASE_URL,'Refuse ambient database endpoints'); let nativeVersion;
if(native) {
  const url=new URL(process.env.COMPANY_BANK_PORTFOLIO_INTEGRATION_TEST_DATABASE_URL);
  assert(['postgres:','postgresql:'].includes(url.protocol)); assert.equal(url.hostname,'127.0.0.1');
  const pilot=url.username==='pilot_runner'&&['35439','35449'].includes(url.port), ci=['postgres','pgcheck'].includes(url.username)&&url.port==='5432';
  assert(pilot||ci); assert(/^\/company_bank_portfolio_[a-z0-9_]+$/.test(url.pathname)); assert(!url.search&&!url.hash);
  const { default:pg }=await import('pg'), p=new pg.Pool({ connectionString:url.href });
  try { const version=(await p.query('SHOW server_version')).rows[0].server_version; nativeVersion=version.split(' ')[0]; assert.match(version,pilot?/^18\.4(?:\D|$)/:/^(?:16(?:\D|$)|18\.4(?:\D|$))/); assert.equal((await p.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0); } finally { await p.end(); }
  process.env.DATABASE_URL=url.href;
}
Object.assign(process.env,{ DEPOT_PILOT:'on',RESOURCE_ECONOMY:'off',RATE_LIMIT:'off',SOCIAL_VERIFY_MODE:'off',JWT_SECRET:'portfolio-integration-local-test-secret',MARKET_SEED:'portfolio-integration-native-local-seed',MOD_KEY:'portfolio-integration-local-mod' });
const { buildServer }=await import('../src/server.js'), G=await import('../src/game.js');
const Portfolio=await import('../src/companybankportfolios.js'), { runCompanyBankPortfolios }=await import('../src/companybankportfoliorunner.js');
const { runLedgerInvariants }=await import('../src/invariants.js');
const app=await buildServer(); let serial=0;
assert(app.hasRoute({ method:'POST',url:'/v1/company/bank/policy' }),'Require actual coordinator server registration; no route seam');
async function call(p,method,url,payload,key=`portfolio-integrated-${++serial}`) {
  const r=await app.inject({ method,url,payload,headers:{ ...(p?{ authorization:`Bearer ${p.token}` }:{}),'idempotency-key':key } });
  return { code:r.statusCode,body:r.json(),text:r.body,headers:r.headers };
}
const ok=r=>{ assert.equal(r.code,200,r.text); return r.body; };
const single=(p,fn)=>G.withCharacter(app.pool,p.account,fn);
async function player(cash=100000,agent=false) {
  const ownerToken=ok(await call(null,'POST','/v1/auth/guest')).token;
  const token=agent?ok(await call({ token:ownerToken },'POST','/v1/auth/agent-key')).token:ownerToken;
  const p={ token,ownerToken }; ok(await call(p,'POST','/v1/character',{ name:`Portfolio Player ${++serial}` }));
  const ch=ok(await call(p,'GET','/v1/me')).character, row=(await app.pool.query('SELECT account_id,cash,bank FROM characters WHERE id=$1',[ch.id])).rows[0]; p.id=ch.id; p.account=row.account_id;
  await app.pool.query('UPDATE characters SET cash=$2,bank=0,last_accrued_at=$3 WHERE id=$1',[p.id,cash,new Date(Date.now()+3600000)]);
  await G.ledger(app.pool,{ characterId:p.id,currency:'cash',amount:cash-Number(row.cash)-Number(row.bank),reason:'crime:portfolio-integration-fixture' }); return p;
}
async function fixture(cash=100000) {
  const owner=await player(cash,true), borrower=await player(), other=await player(), foreign=await player();
  ok(await call({ ...owner,token:owner.ownerToken },'POST','/v1/resources/company',{ expectedRevision:0,name:`Private Portfolio ${serial}`,published:false,premises:null }));
  const terms={ expectedRevision:0,enabled:true,consent:true,borrowerIds:[borrower.id,other.id],principal:5000,rateBps:500,termHours:1,cashReserve:1000,maxExposure:10000,lifetimeBudget:15000,expiresInSeconds:3600 };
  return { owner,borrower,other,foreign,terms };
}
const ownerSession=p=>({ ...p,token:p.ownerToken });
const grant=async(f,terms=f.terms,key='policy')=>ok(await call(ownerSession(f.owner),'POST','/v1/company/bank/policy',terms,key));
const run=async(f,key='run',revision=1)=>ok(await call(f.owner,'POST','/v1/company/bank/run',{ expectedRevision:revision },key));
const board=async p=>ok(await call(p,'GET','/v1/company/bank'));
const balance=async p=>Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1',[p.id])).rows[0].cash);
async function due(p,age=1) { await app.pool.query('UPDATE company_bank_portfolios SET next_run_at=$2 WHERE account_id=$1',[p.account,new Date(Date.now()-age*3600000)]); }
const policyRow=async p=>(await app.pool.query('SELECT * FROM company_bank_portfolios WHERE account_id=$1',[p.account])).rows[0];
async function manualLoan(lender,borrower) { const loan=ok(await call(lender,'POST','/v1/loans',{ amount:5000,rate:0.05,hours:1,to:borrower.id })); ok(await call(borrower,'POST',`/v1/loans/${loan.id}/take`,{})); return loan.id; }
async function checks(label) { const res=await runLedgerInvariants(app.pool,{ alert:false }); assert.equal(res.ok,true,`${label}: ${JSON.stringify(res.checks.filter(check=>!check.ok))}`); assert(res.checks.some(check=>check.name.includes('company bank portfolio')&&check.ok),'Actual integrated portfolio invariant required'); }
try {
  const f=await fixture(); const rejected=await call(f.owner,'POST','/v1/company/bank/policy',f.terms,'agent-policy'); assert.equal(rejected.code,400); assert.equal(rejected.body.error,'owner_authority');
  await grant(f); const before=await balance(f.owner), first=await run(f); assert.equal(first.funded,5000); assert.equal(await balance(f.owner),before-5000);
  const replay=await call(f.owner,'POST','/v1/company/bank/run',{ expectedRevision:1 },'run'); ok(replay); assert.equal(replay.headers['x-idempotent-replay'],'true'); assert.equal(await balance(f.owner),before-5000);
  ok(await call(f.borrower,'POST',`/v1/loans/${first.loanId}/take`,{})); assert.equal((await board(f.owner)).exposure.activePrincipal,5000);
  ok(await call(f.borrower,'POST',`/v1/loans/${first.loanId}/repay`,{})); await due(f.owner); const second=await run(f,'second');
  ok(await call(f.owner,'POST',`/v1/loans/${second.loanId}/cancel`,{})); assert.equal((await board(f.owner)).policy.lifetimeSpent,10000);
  await due(f.owner); const third=await run(f,'third'); ok(await call(f.borrower,'POST',`/v1/loans/${third.loanId}/take`,{}));
  await app.pool.query('UPDATE loans SET due_at=$2 WHERE id=$1',[third.loanId,new Date(Date.now()-1000)]);
  const collected=ok(await call(f.owner,'POST',`/v1/loans/${third.loanId}/collect`,{})); assert.equal(collected.seized,5250); assert.equal((await board(f.owner)).policy.lifetimeSpent,15000);
  await due(f.owner); const budget=await call(f.owner,'POST','/v1/company/bank/run',{ expectedRevision:1 },'exhausted'); assert.equal(budget.code,400); assert(budget.body.message.includes('lifetime_budget'));
  const privateBoard=await board(f.foreign); assert.equal(privateBoard.policy,null); assert.equal(privateBoard.loans.length,0); await checks('canonical loan lifecycle and sticky budget');
  const reserve=await fixture(5999); const debt=await manualLoan(reserve.foreign,reserve.owner); await grant(reserve);
  assert.equal((await board(reserve.owner)).exposure.borrowerDebt,5250); assert(!(await board(reserve.owner)).loans.some(loan=>loan.loanId===debt));
  const reserveRun=await call(reserve.owner,'POST','/v1/company/bank/run',{ expectedRevision:1 },'debt-reserve'); assert.equal(reserveRun.code,400); assert(reserveRun.body.message.includes('reserve'));
  const inherited=await fixture(); await grant(inherited,{ ...inherited.terms,maxExposure:5000,lifetimeBudget:10000 }); const receivable=await run(inherited);
  ok(await call(inherited.borrower,'POST',`/v1/loans/${receivable.loanId}/take`,{}));
  const death=await app.inject({ method:'POST',url:'/v1/mod/kill',headers:{ 'x-mod-key':process.env.MOD_KEY },payload:{ characterId:inherited.owner.id } }); assert.equal(death.statusCode,200,death.body);
  const heirId=death.json().heirId; await app.pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1',[heirId,new Date(Date.now()+3600000)]);
  const heir={ ...inherited.owner,id:heirId }, history=await board(heir); assert.equal(history.policy.enabled,false); assert.equal(history.loans[0].currentLenderId,heirId); assert.equal(history.exposure.activePrincipal,5000); assert.equal(history.policy.lifetimeSpent,5000);
  const historical=await call(heir,'POST','/v1/company/bank/run',{ expectedRevision:1 },'run'); ok(historical); assert.equal(historical.headers['x-idempotent-replay'],'true');
  assert.equal((await call(heir,'POST','/v1/company/bank/run',{ expectedRevision:1 },'old-grant')).code,400);
  // Known QA cash faucet supplies new working capital, not inherited dead cash.
  const heirCash=await balance(heir); await app.pool.query('UPDATE characters SET cash=100000 WHERE id=$1',[heirId]); await G.ledger(app.pool,{ characterId:heirId,currency:'cash',amount:100000-heirCash,reason:'crime:portfolio-integration-heir-fixture' });
  const heirFixture={ ...inherited,owner:heir }; await grant(heirFixture,{ ...inherited.terms,expectedRevision:1,maxExposure:5000,lifetimeBudget:10000 },'new-heir-consent');
  const exposure=await call(heir,'POST','/v1/company/bank/run',{ expectedRevision:2 },'inherited-exposure'); assert.equal(exposure.code,400); assert(exposure.body.message.includes('exposure')); await checks('actual estate disables grant and retains account receivable exposure');
  const idle=await fixture(), eligible=await fixture(); await grant(idle,{ ...idle.terms,borrowerIds:[idle.borrower.id] }); await grant(eligible);
  const busyDebt=await manualLoan(idle.foreign,idle.borrower); await due(idle.owner,4); await due(eligible.owner,3);
  const beforeIdle=await balance(idle.owner), firstTick=await runCompanyBankPortfolios(app.pool,1);
  assert.equal(firstTick.results[0].accountId,idle.owner.account); assert.equal(firstTick.results[0].idle,true); assert.equal(firstTick.results[0].funded,0); assert.equal(await balance(idle.owner),beforeIdle); assert(+new Date((await policyRow(idle.owner)).next_run_at)>Date.now());
  const laterTick=await runCompanyBankPortfolios(app.pool,1); assert.equal(laterTick.results[0].accountId,eligible.owner.account); assert.equal((await board(eligible.owner)).policy.lifetimeSpent,5000);
  ok(await call(idle.borrower,'POST',`/v1/loans/${busyDebt}/repay`,{})); await due(idle.owner,5);
  await runCompanyBankPortfolios(app.pool,1); assert.equal(await balance(idle.owner),beforeIdle-5000); assert.equal((await board(idle.owner)).policy.lifetimeSpent,5000,'New due timestamp must escape cached idle receipt'); await checks('actual bounded worker idle fairness and new cadence key');
  const error=await fixture(5999), afterError=await fixture(); await grant(error); await grant(afterError); await due(error.owner,8); await due(afterError.owner,7);
  const beforeError=await balance(error.owner), skipped=await runCompanyBankPortfolios(app.pool,1);
  assert.equal(skipped.results[0].accountId,error.owner.account); assert.equal(skipped.results[0].skipped,'company_bank_portfolio'); assert.equal(await balance(error.owner),beforeError); assert(+new Date((await policyRow(error.owner)).next_run_at)>Date.now());
  const resumed=await runCompanyBankPortfolios(app.pool,1); assert.equal(resumed.results[0].accountId,afterError.owner.account); assert.equal(resumed.results[0].funded,5000); await checks('actual worker reserve error reschedule fairness');
  if(native) {
    const race=await fixture(); await grant(race,{ ...race.terms,lifetimeBudget:5000 });
    const outcomes=await Promise.all([call(race.owner,'POST','/v1/company/bank/run',{ expectedRevision:1 },'race-a'),call(race.owner,'POST','/v1/company/bank/run',{ expectedRevision:1 },'race-b')]); assert.equal(outcomes.filter(result=>result.code===200&&result.body.funded===5000).length,1); assert.equal(await balance(race.owner),95000);
    const rollback=await fixture(); await grant(rollback); const cash=await balance(rollback.owner), beforeLoans=Number((await app.pool.query('SELECT COUNT(*) n FROM loans')).rows[0].n);
    await assert.rejects(single(rollback.owner,async(ch,c,h)=>{ await Portfolio.runCompanyBankPortfolio(ch,{ expectedRevision:1 },'rollback',c,h); throw new Error('portfolio rollback'); }),/portfolio rollback/);
    assert.equal(await balance(rollback.owner),cash); assert.equal(Number((await app.pool.query('SELECT COUNT(*) n FROM loans')).rows[0].n),beforeLoans); assert.equal((await board(rollback.owner)).policy.lifetimeSpent,0);
    const delayed=await fixture(); const existing=ok(await call(delayed.owner,'POST','/v1/loans',{ amount:5000,rate:0.05,hours:1,to:delayed.borrower.id })); await grant(delayed);
    const holder=await app.pool.connect(); try {
      await holder.query('BEGIN'); await holder.query('SELECT id FROM loans WHERE id=$1 FOR UPDATE',[existing.id]);
      const pending=call(delayed.owner,'POST','/v1/company/bank/run',{ expectedRevision:1 },'source-wait');
      await app.pool.query('UPDATE company_bank_portfolios SET expires_at=clock_timestamp() WHERE account_id=$1',[delayed.owner.account]); await holder.query('COMMIT');
      const result=await pending; assert.equal(result.code,400); assert(result.body.message.includes('expired'));
    } finally { await holder.query('ROLLBACK'); holder.release(); }
    const changed=await fixture(); await grant(changed); await due(changed.owner,9); const future=new Date(Date.now()+300000); let interleaved=false;
    const proxy=new Proxy(app.pool,{ get(target,prop){ if(prop!=='query') return Reflect.get(target,prop,target); return async(sql,args)=>{
      const rows=await target.query(sql,args); if(!interleaved&&typeof sql==='string'&&sql.startsWith('SELECT account_id,owner_character,revision,next_run_at FROM company_bank_portfolios')) { interleaved=true; await app.pool.query('UPDATE company_bank_portfolios SET next_run_at=$2 WHERE account_id=$1',[changed.owner.account,future]); } return rows;
    }; } });
    await runCompanyBankPortfolios(proxy,1); assert.equal(+new Date((await policyRow(changed.owner)).next_run_at),+future,'Dispatcher CAS preserves concurrent future cadence');
    await due(changed.owner,9); interleaved=false;
    const policyProxy=new Proxy(app.pool,{ get(target,prop){ if(prop!=='query') return Reflect.get(target,prop,target); return async(sql,args)=>{
      const rows=await target.query(sql,args); if(!interleaved&&typeof sql==='string'&&sql.startsWith('SELECT account_id,owner_character,revision,next_run_at FROM company_bank_portfolios')) { interleaved=true; ok(await call(ownerSession(changed.owner),'POST','/v1/company/bank/policy',{ expectedRevision:1,enabled:false },'concurrent-disable')); } return rows;
    }; } });
    await runCompanyBankPortfolios(policyProxy,1); const disabled=await policyRow(changed.owner); assert.equal(disabled.enabled,false); assert.equal(disabled.revision,2);
    await checks('native contention rollback source expiry and dispatcher CAS');
  }
  console.log(`companybankportfolio-integration ${native?`PostgreSQL${nativeVersion}`:'memory'}: actual owner/agent consent, canonical loan lifecycle, budgets/exposure/heir authority, worker idle fairness and global invariants PASS`);
} finally { await app.close(); }
