import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as acorn from 'acorn';
const html=fs.readFileSync('public/index.html','utf8');
const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('async function act('));
const tree=acorn.parse(script,{ecmaVersion:'latest',sourceType:'script'});
function find(node,name){if(node?.type==='FunctionDeclaration'&&node.id.name===name)return node;for(const val of Object.values(node||{})){if(Array.isArray(val)){for(const c of val){if(c&&typeof c==='object'){const n=find(c,name);if(n)return n;}}}else if(val&&typeof val==='object'){const n=find(val,name);if(n)return n;}}}
const source=name=>{const n=find(tree,name);assert(n,name);return script.slice(n.start,n.end);};
for (const stage of ['api','refresh','ignored','queued']) {
 const resp={textContent:''},receipts=[];let callback=0,sent=0;
 const c=vm.createContext({console,document:{body:{style:{}}},activatedControl:null,acting:false,operationPending:null,
 me:{id:'a',generation:1},currentTab:'market',operationName:()=> 'buy',uuid:()=> 'once',operationSnapshot:m=>m,
 projections:{snapshot:()=>1,current:()=>true},cityIdentity:()=> 'key',renderOperationPending(){},busy:{removeAttribute(){},setAttribute(){},classList:{add(){},remove(){}}},
 toast(){},describe:()=>'',shake(){},sfx(){},$:()=>resp,_operationResponseCurrent:null,
 recordOperation:r=>{receipts.push(r);return r;}});
 c.api=async(method,path,body,options)=>{if(stage==='queued'){c.me={id:'b',generation:1};if(options.beforeDispatch?.()===false)return {code:499,body:{},ignored:true};sent++;}if(stage==='api')c.me={id:'b',generation:1};return {code:400,body:{private:'old'},...(stage==='ignored'?{ignored:true}:{})};};
 c.refresh=async()=>{if(stage==='refresh')c.me={id:'b',generation:1};return {code:200};};
 vm.runInContext(source('act')+'; globalThis.act=act;',c);
 const r=await c.act('POST','/v1/market/lot/buy',{qty:1},{onResult(){callback++;}});
 assert.equal(r.ignored,true,stage+' must retire result');
 assert.equal(receipts.length,0,stage+' must not create receipt');
 if(stage==='queued')assert.equal(sent,0,'queued old-character action must not dispatch');
 if(stage!=='refresh')assert.equal(callback,0,stage+' callback');
 assert.equal(resp.textContent,'',stage+' raw reply cleared');
}
console.log('decision client: real act handler retires late and ignored results');

if(process.argv.includes('--browser')) {
 const {chromium}=await import('playwright-core');
 const {buildServer}=await import('./server-fixture.js');
 const {GOODS}=await import('../src/rules.js');
 const app=await buildServer();let browser;
 const call=async(method,url,token,payload)=>{const r=await app.inject({method,url,headers:token?{authorization:`Bearer ${token}`}:{},payload});return r.json();};
 const make=async name=>{const {token}=await call('POST','/v1/auth/guest');await call('POST','/v1/character',token,{name});return {token,id:(await call('GET','/v1/me',token)).character.id};};
 try {
  const buyer=await make('Browser Buyer'),seller=await make('Browser Seller'),good=GOODS[0].id;
  await app.pool.query("UPDATE characters SET cash=100000,loc='docks' WHERE id IN ($1,$2)",[buyer.id,seller.id]);
  await app.pool.query('INSERT INTO character_cargo(character_id,good_id,qty) VALUES ($1,$2,10)',[seller.id,good]);
  const listing=await call('POST','/v1/market',seller.token,{goodId:good,qty:8,price:101});assert(listing.id);
  await app.listen({host:'127.0.0.1',port:0});
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
  const page=await browser.newPage({viewport:{width:375,height:667},reducedMotion:'reduce'});
  await page.addInitScript(token=>{localStorage.setItem('omerta_token',token);localStorage.setItem('omerta_tip_bank','1');},buyer.token);
  await page.goto(`http://127.0.0.1:${app.server.address().port}`,{waitUntil:'networkidle'});
  if(await page.locator('#welcome:not(.hidden)').count()){await page.click('#tour-next');await page.click('#tour-next');}
  await page.keyboard.press('Escape');
  await page.locator('#tabs [data-tab="market"]').evaluate(b=>b.click());
  await page.keyboard.press('Escape');
  const input=page.locator(`[data-gqty="${listing.id}"]`),button=page.locator(`[data-gbuy="${listing.id}"]`);
  await input.waitFor();assert(await button.isDisabled());
  await input.fill('2');assert(!(await button.isDisabled()));assert.match(await page.locator(`#quote-${listing.id}`).innerText(),/Total debit \$202/);
  await input.fill('');assert(await button.isDisabled());
  await input.fill('1.5');assert(await button.isDisabled());
  await input.fill('2');await button.click();
  await page.waitForFunction(()=>document.querySelector('#operation-feed .operation-receipt--success'));
  const current=(await call('GET','/v1/me',buyer.token)).character;assert.equal(current.cargo[good],2);
  await page.locator('#market-direction').selectOption('sell');
  await page.getByText('No listings match these filters.',{exact:true}).waitFor();
  assert(await page.locator('#operation-feed .operation-receipt--success').count(),'market redraw preserves committed receipt');
  assert(!(await page.getByText('There are no listings right now',{exact:false}).count()));
  console.log('decision browser: real listing inputs, totals, invalid refusal, settlement and filters passed');
 } finally {await browser?.close();await app.close();await app.pool.end();}
}

for(const [actor,isCurrent,expected] of [['a',true,1],['b',true,0],['a',false,0]]) {
 let retries=0;const button={dataset:{operationRetry:'7'}};
 const c=vm.createContext({me:{id:actor,generation:1},operationReceipts:[{id:7,actor:'a:1',isCurrent:()=>isCurrent,recovery:{run(){retries++;}}}],document:{querySelectorAll:s=>s==='[data-operation-retry]'?[button]:[]}});
 vm.runInContext(source('bindOperationDesk')+'; bindOperationDesk();',c);button.onclick();assert.equal(retries,expected,'retry must belong to current actor and current scope');
}
{
 const c=vm.createContext({window:{},me:{id:'a',generation:1},currentTab:'market',operationReceipts:[{id:1,actor:'a:1',tab:'market'}],operationReceiptMarkup:r=>`receipt-${r.id}`});
 vm.runInContext(fs.readFileSync('public/player-experience.js','utf8'),c);c.PlayerExperience=c.window.PlayerExperience;
 vm.runInContext(source('operationFeedMarkup')+'; globalThis.markup=operationFeedMarkup;',c);
 assert.equal(c.markup().split('receipt-1').length-1,1,'each receipt has one visible or expandable instance');
}
