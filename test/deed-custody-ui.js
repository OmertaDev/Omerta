// Exercise the actual Deed panel with deterministic chain and wallet boundaries.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { chromium } from 'playwright-core';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (/\bsrc=|application\/ld\+json|type="module"/.test(match[1])) continue;
  new vm.Script(match[2]);
}
const start = html.indexOf('  async function renderDeeds(');
const end = html.indexOf('  // ── THE ROLODEX', start);
assert(start > 0 && end > start);
const render = html.slice(start, end);
const esc = html.split(/\r?\n/).find(line => /^  const esc = /.test(line));
const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH,
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'ms-playwright'),
  process.env.HOME && join(process.env.HOME, '.cache', 'ms-playwright')].filter(Boolean);
const candidates = [process.env.CHROMIUM_PATH];
for (const root of roots) {
  if (!existsSync(root)) continue;
  for (const name of readdirSync(root).filter(name => name.startsWith('chromium')).sort().reverse())
    for (const binary of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome',
      'chrome-headless-shell-win64/headless_shell.exe', 'chrome-linux/headless_shell'])
      candidates.push(join(root, name, binary));
}
candidates.push('/usr/bin/chromium', '/usr/bin/google-chrome');
const executablePath = candidates.find(path => path && existsSync(path));
assert(executablePath, 'Set CHROMIUM_PATH to run the Deed custody browser proof.');
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<div id="tab-deeds"></div>');
  await page.addScriptTag({ content: `
    const $=selector=>document.querySelector(selector);
    ${esc}
    let me={id:'character-a',generation:1,loc:'brick'};
    let navigationRevision=1,currentTab='deeds',deedPropertyFocus=null,deedPropertyRender=0,deedPropertyActor=null,_cityDeedEntry=null;
    const deedPropertyNames=new Map(),deedCustodyPending=new Set();
    const cityActorScope=()=>{const id=me.id,generation=me.generation;return()=>me.id===id&&me.generation===generation;};
    window.initialClock=Date.now();window.clock=initialClock;Date.now=()=>window.clock;
    window.fixture={enabled:false};window.calls=[];window.walletCalls=[];window.notices=[];window.reviews=[];
    const custodyAddress='0x'+'11'.repeat(20),deedAddress='0x'+'22'.repeat(20),omrAddress='0x'+'33'.repeat(20),ownerWallet='0x'+'44'.repeat(20),lifeHash='0x'+'55'.repeat(32);
    const requestTypes=[['lifeId','bytes32'],['deedId','uint256'],['days_','uint256'],['priceDay','uint256'],['maxBurn','uint256'],['nonce','uint256'],['issuedAt','uint256'],['deadline','uint256']].map(([name,type])=>({name,type}));
    const toast=message=>notices.push(message),describe=(body,code)=>body.message||('Response '+code);
    const ask=async(title,body)=>{reviews.push({title,body});return !fixture.decline;};
    async function api(method,path,body){
      calls.push({method,path,body});
      if(path==='/v1/deeds')return{code:200,body:{deed:null,market:{},ranks:[],districts:[],custodyEnabled:fixture.enabled,custody:{safeHouse:{enabled:!fixture.noPurchase},exits:fixture.exit?[{deed_token_id:'7',status:'pending',available_at:new Date(clock-1000).toISOString()}]:[],safeHouseIntents:fixture.pending?[{deed_token_id:'7',status:'pending'}]:[],equipment:[{deed_token_id:'7',safeUntil:fixture.safeUntil||null,protected:!!fixture.protected,coverageStatus:fixture.protected?'confirmed':'unprotected'}]}}};
      if(path.startsWith('/v1/deeds/safe-house-intent/')){
        if(fixture.unavailable)return{code:503,body:{message:'A complete UTC volume day is not available. Existing coverage keeps its expiry.'}};
        const days=Number(new URL('http://test'+path).searchParams.get('days')),daily=5n*10n**18n,cost=daily*BigInt(days),priceDay=fixture.priceDay??Math.floor(clock/86400000),now=Math.floor(clock/1000);
        const typedData={domain:{name:'OmertaDeedCustody',version:'1',chainId:4663,verifyingContract:custodyAddress},types:{SafeHouseRequest:requestTypes},primaryType:'SafeHouseRequest',message:{lifeId:lifeHash,deedId:'7',days_:String(days),priceDay:String(priceDay),maxBurn:String(cost),nonce:'3',issuedAt:String(now),deadline:String(now+300)}};
        if(fixture.badTyped)typedData.types.SafeHouseRequest=[...requestTypes,{name:'extra',type:'address'}];
        return{code:200,body:{ready:true,chainId:4663,ownerWallet,custodyAddress,deedAddress,omrAddress,lifeHash,tokenId:'7',days,priceDay:String(priceDay),previousDayVolumeAtomic:String(100000n*10n**18n),dailyBurnAtomic:String(daily),maxBurnAtomic:String(cost),costOmr:String(days*5),dailyBurnOmr:'5',protects:'deed_and_all_assets',steps:[{kind:'approve',to:omrAddress,data:'0x095ea7b3'+custodyAddress.slice(2).padStart(64,'0')+(fixture.badApproval?cost+1n:cost).toString(16).padStart(64,'0'),value:'0'}],typedData}};
      }
      if(path==='/v1/deeds/safe-house'){fixture.pending=true;return{code:200,body:{pending:true,protected:false}};}
      if(path==='/v1/deeds/equip')return{code:200,body:{ready:true,chainId:4663,ownerWallet,custodyAddress,deedAddress,steps:[{to:deedAddress,data:'0x1234',value:'0'},{to:deedAddress,data:'0x1235',value:'0'},{to:custodyAddress,data:'0x1236',value:'0'}]}};
      if(path==='/v1/deeds/exit-intent/7')return{code:200,body:{ownerWallet,chainId:4663,custodyAddress,domain:{name:'OmertaDeedCustody',version:'1',chainId:4663,verifyingContract:custodyAddress},primaryType:'ExitRequest',types:{ExitRequest:[{name:'lifeId',type:'bytes32'},{name:'deedId',type:'uint256'},{name:'nonce',type:'uint256'},{name:'issuedAt',type:'uint256'},{name:'deadline',type:'uint256'}]},message:{lifeId:lifeHash,deedId:'7',nonce:'4',issuedAt:String(Math.floor(clock/1000)),deadline:String(Math.floor(clock/1000)+300)}}};
      if(path==='/v1/deeds/exit'||path==='/v1/deeds/exit/cancel')return{code:200,body:{pending:true}};
      throw Error('Unexpected API '+path);
    }
    const provider={request:async request=>{
      walletCalls.push(request);
      if(request.method==='eth_requestAccounts'||request.method==='eth_accounts')return[ownerWallet];
      if(request.method==='eth_chainId')return fixture.wrongChain?'0x1':'0x1237';
      if(request.method==='wallet_switchEthereumChain')return null;
      if(request.method==='eth_sendTransaction'){
        if(fixture.switchActor)me={id:'character-b',generation:1,loc:'brick'};
        if(fixture.switchDistrict)me.loc='neon';
        if(fixture.rollover){fixture.priceDay=Math.floor(clock/86400000);clock=(fixture.priceDay+1)*86400000;}
        if(fixture.changeChain)fixture.wrongChain=true;
        return '0x'+'66'.repeat(32);
      }
      if(request.method==='eth_getTransactionReceipt')return{status:'0x1'};
      if(request.method==='eth_signTypedData_v4')return '0x'+'77'.repeat(65);
      throw Error('Unexpected wallet method '+request.method);
    }};
    const pickProvider=async()=>provider;
    const switchCharacterChain=async(p,chainId)=>{await p.request({method:'wallet_switchEthereumChain',params:[{chainId}]});};
    const act=(method,path,body)=>api(method,path,body);
    ${render}
    window.renderDeeds=renderDeeds;
    window.reset=async changes=>{fixture={enabled:true,...changes};calls=[];walletCalls=[];notices=[];reviews=[];me={id:'character-a',generation:1,loc:'brick'};clock=initialClock;await renderDeeds();};
  ` });
  await page.evaluate(() => renderDeeds());
  assert.match(await page.locator('#tab-deeds').textContent(), /not active/);
  assert.equal(await page.locator('#deed-equip,[data-deed-safe-house]').count(), 0);
  assert.equal(await page.evaluate(() => walletCalls.length), 0);

  const reset = changes => page.evaluate(changes => window.reset(changes), changes);
  const buy = async () => { await page.locator('[data-deed-safe-house]').click(); await page.waitForFunction(() => deedCustodyPending.size === 0); };
  const signed = () => page.evaluate(() => walletCalls.filter(call => call.method === 'eth_signTypedData_v4').length);
  const posted = () => page.evaluate(() => calls.filter(call => call.path === '/v1/deeds/safe-house'));
  await reset({});
  await page.locator('#deed-equip-token').fill('7');
  await page.locator('#deed-equip').click();
  await page.waitForFunction(() => deedCustodyPending.size === 0);
  assert.deepEqual(await page.evaluate(() => walletCalls.filter(call => call.method === 'eth_sendTransaction').map(call => call.params[0].to)),
    ['0x'+'22'.repeat(20),'0x'+'22'.repeat(20),'0x'+'11'.repeat(20)], 'Equipment follows unlock, approval and custody steps in order.');
  await reset({ exit: true });
  await page.locator('[data-deed-release]').click();
  await page.waitForFunction(() => deedCustodyPending.size === 0);
  assert.equal(await signed(), 1);
  assert.equal(await page.evaluate(() => calls.filter(call => call.path === '/v1/deeds/exit' && call.method === 'POST').length), 1);
  assert.match(await page.locator('#deed-custody-status').textContent(), /Assets stay locked/);
  await reset({ unavailable: true }); await buy();
  assert.match(await page.locator('#deed-custody-status').textContent(), /complete UTC volume day/);
  assert.equal(await page.evaluate(() => walletCalls.length), 0, 'Unavailable daily volume never opens a wallet.');
  await reset({ decline: true }); await buy();
  assert.equal(await page.evaluate(() => walletCalls.length), 0, 'Declining the burn review never requests approval.');
  assert.match(await page.evaluate(() => reviews[0].body), /Total permanent burn: 5 OMR/);
  assert.match(await page.evaluate(() => reviews[0].body), /100000 OMR traded/);
  for (const changes of [{ badApproval: true }, { badTyped: true }]) {
    await reset(changes); await buy();
    assert.equal(await page.evaluate(() => walletCalls.length), 0, 'Tampered allowance or typed fields stop before wallet access.');
  }
  await reset({}); await page.locator('#deed-safe-days-7').selectOption('3'); await buy();
  assert.equal(await signed(), 1);
  const submitted = await posted();
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].body.days, 3);
  assert.equal(submitted[0].body.maxBurn, '15000000000000000000');
  assert.match(await page.locator('#deed-custody-status').textContent(), /pending until the on-chain burn confirms/);
  assert.match(await page.locator('[data-deed-coverage]').textContent(), /Exposed/);
  await page.evaluate(() => renderDeeds());
  assert.equal(await page.locator('[data-deed-safe-house]').isDisabled(), true, 'An outstanding burn request cannot be purchased again.');
  assert.match(await page.locator('[data-deed-coverage]').textContent(), /not confirmed protection/);

  for (const changes of [{ rollover: true }, { switchActor: true }, { switchDistrict: true }, { changeChain: true }]) {
    await reset(changes); await buy();
    assert.equal(await signed(), 0, 'UTC rollover, a new character or a changed network stops the burn signature.');
    assert.equal((await posted()).length, 0);
  }
  const activeUntil = await page.evaluate(() => new Date(initialClock + 86400000).toISOString());
  const expiredUntil = await page.evaluate(() => new Date(initialClock - 1000).toISOString());
  await reset({ protected: true, safeUntil: activeUntil, noPurchase: true });
  assert.match(await page.locator('[data-deed-coverage]').textContent(), /Safe House confirmed until/);
  assert.match(await page.locator('#tab-deeds').textContent(), /Existing confirmed coverage keeps its paid expiry/);
  assert.equal(await page.locator('[data-deed-safe-house]').count(), 0);
  await reset({ protected: true, safeUntil: expiredUntil });
  assert.match(await page.locator('[data-deed-coverage]').textContent(), /Exposed/, 'An expired timestamp is never displayed as current protection.');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('[data-deed-safe-house]').count(), 1);
  assert.deepEqual(errors, []);
  console.log('✓ Deed custody UI: inactive gate, dynamic volume price, exact approval and typed request, pending versus confirmed coverage, expiry, UTC rollover, actor and network races.');
} finally { await browser.close(); }
