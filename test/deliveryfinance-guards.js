import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=fileURLToPath(new URL('..',import.meta.url));
let source=fs.readFileSync(new URL('./deliveryfinance.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
function replaceOnce(before,after) { if(source.split(before).length!==2)throw Error('Guard fixture seam changed: '+before.slice(0,60));source=source.replace(before,after); }
source=source.replace("const Loans = await import('../src/loans.js');","const Loans = await import('../src/loans.js');\nconst Market = await import('../src/market.js');");
const beforeTake="  await assert.rejects(single(supplier,(ch,client)=>Finance.assertDeliveryFinanceLoanTake(client,{...ch,invoicePermit:true},funded.loanId)),e=>e.code==='delivery_finance');";
replaceOnce(beforeTake,`  const nakedTakeBefore=await snapshot(c);\n${beforeTake}\n  await assert.rejects(single(supplier,(ch,client,h)=>Loans.takeLoan(ch,funded.loanId,{invoicePermit:true,requestId:r.id},client,h)),e=>e.code==='delivery_finance');\n  assert.deepEqual(await snapshot(c),nakedTakeBefore,'Actual canonical solo take cannot spend bound loan escrow without opaque validated context');`);
replaceOnce("late=wait.then(()=>Finance.assertDeliveryFinanceLoanTake(proxy,ch,funded.loanId));late.catch(()=>{});",`late=wait.then(async()=>{\n          await assert.rejects(Finance.assertDeliveryFinanceLoanTake(proxy,ch,funded.loanId),e=>e.code==='delivery_finance');\n          await assert.rejects(Loans.takeLoan(ch,funded.loanId,{invoicePermit:true},proxy,h),e=>e.code==='gone');\n          await assert.rejects(Delivery.deliverCommitment(ch,c.id,5,proxy,h),e=>e.code==='delivery_finance');\n          await assert.rejects(Market.fillOrder(ch,c.order,5,proxy,h,{commitmentId:c.id,requestId:r.id,financePermit:true}),e=>e.code==='delivery_finance');\n        });late.catch(()=>{});`);
replaceOnce("    await assert.rejects(late,e=>e.code==='delivery_finance');return result;","    await late;return result;");
const afterCargo="  await procurement(supplier,c);\n  const before=await snapshot(c),cashBefore=await cash(supplier);";
replaceOnce(afterCargo,`  await procurement(supplier,c);\n  const cargoGuardBefore=await snapshot(c);\n  await assert.rejects(single(supplier,(ch,client,h)=>Delivery.deliverCommitment(ch,c.id,5,client,{...h,financePermit:true})),e=>e.code==='delivery_finance');\n  await assert.rejects(single(supplier,(ch,client,h)=>Market.fillOrder(ch,c.order,5,client,h,{commitmentId:c.id,requestId:r.id,financePermit:true})),e=>e.code==='delivery_finance');\n  await assert.rejects(single(supplier,(ch,client,h)=>Market.fillOrder(ch,c.order,5,client,h)),e=>e.code==='qty');\n  assert.deepEqual(await snapshot(c),cargoGuardBefore,'Actual five held crates/order escrow/cash/loan remain unchanged on all unscoped lower calls');\n  const before=await snapshot(c),cashBefore=await cash(supplier);`);
source=source.replace("Legacy take/delivery interception and full estate proofs require root shared hooks.","Actual canonical loan/delivery/lower-market guards exercised; no full HTTP or runEstate qualification.");
const output=new URL('../output/delivery-finance-guards-fixture.mjs',import.meta.url);
fs.mkdirSync(new URL('../output/',import.meta.url),{recursive:true});fs.writeFileSync(output,source);
const child=spawnSync(process.execPath,[fileURLToPath(output),...process.argv.slice(2)],{cwd:root,env:process.env,stdio:'inherit'});
if(child.error)throw child.error;process.exit(child.status??1);
