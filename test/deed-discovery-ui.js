// Exercise the production property panel in Chromium with bounded, deterministic API fixtures.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { chromium } from 'playwright-core';
import { buildOpenApi } from '../src/agentgateway.js';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (/\bsrc=|application\/ld\+json|type="module"/.test(match[1])) continue;
  new vm.Script(match[2]);
}
const start = html.indexOf('  async function renderDeeds(');
const end = html.indexOf('  // ── THE ROLODEX', start);
assert(start > 0 && end > start);
const render = html.slice(start, end);
new vm.Script(render);
const esc = html.split(/\r?\n/).find(line => /^  const esc = /.test(line));
assert(esc);

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
assert(executablePath, 'Install Chromium or set CHROMIUM_PATH to run the property-panel proof.');
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<div id="tab-deeds"></div>');
  await page.addScriptTag({ content: `
    const $ = selector => document.querySelector(selector);
    ${esc}
    const me = {id:'character-a',loc:'brick'};
    const rules={travelCost:1000};
    const navigationRevision=1; const currentTab='deeds';
    let _cityDeedEntry=null;
    let acting=false;
    const cityActorScope=()=>{const id=me.id;return()=>me.id===id;};
    let deedPropertyFocus=null;
    let deedPropertyRender=0;
    let deedPropertyActor=null;
    const deedPropertyNames=new Map();
    window.calls=[]; window.notices=[];
    window.fixture={steps:0,qualified:false,claimed:false,primary:false,quest:false,remote:false,cooldown:false,fail:false};
    const lot={id:'brick-0001',district:'brick',kind:'row_house',x:32,y:448,width:10,height:9,claimed:false,street:null};
    const config={minimumLevel:25,stepsRequired:4,cooldownSeconds:0,energyPerStep:5,primaryClaimsPerAccount:1};
    const objectives=[['site','inspect-site','Inspect the property','brick'],['registry','verify-registry','Verify the registry record','cathedral'],['witness','question-witness','Question the title witness','neon'],['title','secure-title','Secure the property title','brick']];
    const toast=(message)=>notices.push(message);
    const describe=(body,code)=>body.message||('Response '+code);
    async function api(method,path,body) {
      calls.push({method,path,body});
      if(path==='/v1/deeds') {
        const result={code:200,body:{deed:fixture.deed||null,chain:fixture.chain||{},supply:fixture.supply,
          upgrades:fixture.upgrades||{},rewards:fixture.rewards||{},market:{},ranks:[],districts:['brick','cathedral','neon','docks'].map(id=>({id,name:id,deeds:0})),nameMax:28}};
        if(fixture.deferBoard) {fixture.deferBoard=false;await new Promise(resolve=>{window.releaseBoard=resolve;});}
        return result;
      }
      if(fixture.fail) return {code:503,body:{message:'Temporarily unavailable <script>bad</script>'}};
      const current={...lot,issuanceKind:fixture.issuanceKind||'gameplay',claimed:fixture.claimed,street:fixture.claimed?'<img src=x onerror="window.pwned=1">':null};
      if(path.startsWith('/v1/deeds/buildings?')) return {code:200,body:{width:1200,height:800,districts:[{id:'brick',name:'Brick Yards',x:0,y:400,width:400,height:400}],buildings:[{...current,claimed:fixture.claimed||fixture.atlasClaimed}]}};
      if(path.startsWith('/v1/deeds/discovery?')) {
        const location=fixture.remote?'docks':me.loc, next=objectives[fixture.steps];
        const blockedReason=fixture.energyBlocked?'energy':next&&location!==next[3]?'location':null;
        const canAct=!!next&&!blockedReason&&!fixture.primary&&!fixture.claimed&&!fixture.qualified&&!fixture.quest;
        const objective=next?{id:next[0],actionId:next[1],title:next[2],description:'Follow the recorded evidence for this exact building.',requiredDistrict:next[3],canAct,blockedReason}:null;
        return {code:200,body:{config,primaryClaimed:fixture.primary,claimedName:fixture.primary?'First Street':null,currentDistrict:location,questEligible:fixture.quest,actorEligible:true,reason:null,buildings:fixture.hideDiscovery?[]:[{...current,steps:fixture.steps,qualified:fixture.qualified||fixture.quest,source:fixture.quest?'quest':'exploration',nextInvestigateAt:null,objective,canInvestigate:canAct,canClaim:!fixture.primary&&!fixture.claimed&&location==='brick'&&(fixture.qualified||fixture.quest)}]}};
      }
      throw new Error('Unexpected API '+path);
    }
    async function act(method,path,body) {
      calls.push({method,path,body});
      if(path==='/v1/deeds/investigate') {fixture.steps++;fixture.qualified=fixture.steps>=4;}
      else if(path==='/v1/deeds/claim') {fixture.primary=true;fixture.claimed=true;}
      else if(path.startsWith('/v1/travel/')) me.loc=path.split('/').pop();
      else throw new Error('Unexpected write '+path);
      return {code:200,body:{ok:true}};
    }
    const travelTo=district=>act('POST','/v1/travel/'+district,{});
    const acquireCityDeed=(method,path,body)=>act(method,path,body);
    ${render}
    window.renderDeeds=renderDeeds;
  ` });
  await page.evaluate(() => window.renderDeeds());
  assert.equal((await page.evaluate(() => calls)).length, 1, 'The polled deed board does not download an atlas.');
  assert.equal(await page.locator('[data-claimdist]').count(), 0, 'Free district claims are absent.');
  await page.locator('#deed-atlas-open').click();
  await page.locator('[data-property="brick-0001"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#deed-investigate').waitFor();
  assert.equal(await page.locator('#deed-property-claim').count(), 0, 'Map inspection cannot unlock a claim.');
  const reads = await page.evaluate(() => calls.filter(call => call.method === 'GET').map(call => call.path));
  assert.deepEqual(reads, ['/v1/deeds', '/v1/deeds/buildings?district=brick', '/v1/deeds/discovery?district=brick']);
  await page.locator('#deed-investigate').click();
  await page.waitForFunction(() => document.querySelector('#deed-property-detail')?.textContent.includes('Investigation 1/4'));
  assert.deepEqual(await page.evaluate(() => calls.find(call => call.method === 'POST')),
    { method: 'POST', path: '/v1/deeds/investigate', body: { buildingId: 'brick-0001', actionId: 'inspect-site' } });
  assert.match(await page.locator('#deed-property-detail').textContent(), /Verify the registry record/);
  assert.equal(await page.locator('#deed-investigate').count(), 0, 'The next objective requires its destination, not another local click.');
  await page.locator('#deed-objective-travel').click();
  await page.locator('#deed-investigate').waitFor();
  await page.locator('#deed-investigate').click();
  await page.waitForFunction(() => document.querySelector('#deed-property-detail')?.textContent.includes('Investigation 2/4'));
  assert.deepEqual(await page.evaluate(() => calls.filter(call => call.path === '/v1/deeds/investigate').at(-1).body),
    {buildingId:'brick-0001',actionId:'verify-registry'});
  await page.evaluate(async () => {me.loc='brick';fixture.steps=4;fixture.qualified=true;await renderDeeds({district:'brick',buildingId:'brick-0001'});});
  // A completed investigation schedules a shared refresh. Hold that refresh in flight while the
  // player starts naming the property; its later response must not erase the pending input.
  await page.evaluate(() => {fixture.deferBoard=true;window.pendingRender=renderDeeds();});
  await page.waitForFunction(() => typeof window.releaseBoard === 'function');
  assert.equal(await page.locator('#deed-property-claim').isEnabled(), false,
    'An obsolete action is disabled while its replacement board is in flight.');
  await page.locator('#deed-property-name').fill('Earned Row');
  await page.evaluate(async () => {window.releaseBoard();await window.pendingRender;});
  assert.equal(await page.locator('#deed-property-name').inputValue(), 'Earned Row',
    'An in-flight shared refresh must preserve the property name typed after its request started.');
  await page.locator('#deed-property-claim').click();
  await page.waitForFunction(() => fixture.primary && !!document.querySelector('#deed-property-detail')?.textContent.includes('Already claimed'));
  assert.deepEqual(await page.evaluate(() => calls.filter(call => call.path === '/v1/deeds/claim')),
    [{ method: 'POST', path: '/v1/deeds/claim', body: { name: 'Earned Row', buildingId: 'brick-0001' } }]);
  assert.equal(await page.locator('#deed-property-detail img').count(), 0, 'Property records are escaped as text.');
  assert.equal(await page.locator('#deed-investigate, #deed-property-claim').count(), 0, 'Claimed property offers no second claim.');
  assert.equal(await page.evaluate(() => calls.some(call => /extract|equip/.test(call.path))), false,
    'Discovery and claim never mint, equip or initiate a wallet transaction.');

  await page.evaluate(async () => {fixture.claimed=false;fixture.primary=true;fixture.steps=0;fixture.qualified=false;await renderDeeds({district:'brick',buildingId:'brick-0001'});});
  assert.match(await page.locator('#deed-atlas').innerText(), /already used its lifetime discovery claim/);
  assert.equal(await page.locator('#deed-investigate, #deed-property-claim').count(), 0);
  await page.evaluate(async () => {fixture.primary=false;fixture.remote=true;await renderDeeds({district:'brick',buildingId:'brick-0001'});});
  assert.match(await page.locator('#deed-property-detail').innerText(), /Travel to brick/);
  assert.equal(await page.locator('#deed-investigate, #deed-property-claim').count(), 0);
  await page.evaluate(async () => {fixture.remote=false;fixture.energyBlocked=true;await renderDeeds({district:'brick',buildingId:'brick-0001'});});
  assert.match(await page.locator('#deed-property-detail').innerText(), /need 5 energy/);
  assert.equal(await page.locator('#deed-investigate').count(), 0);
  await page.evaluate(() => {fixture.energyBlocked=false;});
  await page.locator('#deed-property-refresh').click();
  await page.locator('#deed-investigate').waitFor();
  await page.evaluate(async () => {fixture.quest=true;await renderDeeds({district:'brick',buildingId:'brick-0001'});});
  await page.locator('#deed-property-claim').waitFor();
  assert.equal(await page.locator('#deed-investigate').count(), 0, 'Verified quest qualification avoids unnecessary energy spend.');
  const claimsBeforePending = await page.evaluate(() => calls.filter(call => call.method === 'POST' && call.path === '/v1/deeds/claim').length);
  await page.evaluate(async () => {acting=true;await renderDeeds({district:'brick',buildingId:'brick-0001'});});
  assert.equal(await page.locator('#deed-property-claim').isDisabled(), true,
    'A background render cannot publish an enabled claim while the prior action is pending.');
  await page.locator('#deed-property-claim').evaluate(control => control.click());
  assert.equal(await page.evaluate(() => calls.filter(call => call.method === 'POST' && call.path === '/v1/deeds/claim').length), claimsBeforePending,
    'A pending action cannot dispatch a second deed claim.');
  await page.evaluate(async () => {acting=false;await renderDeeds({district:'brick',buildingId:'brick-0001'});});
  assert.equal(await page.locator('#deed-property-claim').isEnabled(), true,
    'The existing completed-action refresh restores the currently earned claim.');

  await page.evaluate(async () => {fixture.atlasClaimed=true;await renderDeeds({district:'brick',buildingId:'brick-0001'});});
  assert.equal(await page.locator('#deed-property-claim').count(), 0,
    'A competing claim visible in either read suppresses a stale claim control.');
  await page.evaluate(async () => {fixture.atlasClaimed=false;await renderDeeds({district:'brick',buildingId:'brick-0001'});});
  await page.evaluate(() => {fixture.fail=true;});
  await page.locator('#deed-property-refresh').click();
  await page.waitForFunction(() => document.querySelector('#deed-atlas').textContent.includes('Temporarily unavailable'));
  assert.equal(await page.locator('#deed-atlas script').count(), 0, 'Server refusals render as text.');
  await page.evaluate(() => {fixture.fail=false;});
  await page.locator('[data-deed-district="brick"]').click();
  await page.locator('[data-property="brick-0001"]').waitFor();
  await page.locator('[data-property="brick-0001"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#deed-property-name').fill('Private draft');
  await page.evaluate(() => {fixture.deferBoard=true;window.pendingRender=renderDeeds();});
  await page.waitForFunction(() => typeof window.releaseBoard === 'function');
  await page.evaluate(() => {me.id='character-b';document.querySelector('#tab-deeds').textContent='Account switched';});
  await page.evaluate(async () => {window.releaseBoard();await window.pendingRender;});
  assert.equal(await page.locator('#tab-deeds').textContent(), 'Account switched',
    'An old character response cannot publish after authentication changes.');
  await page.evaluate(() => renderDeeds());
  assert.equal(await page.locator('#deed-property-name').count(), 0, 'Changing character clears the previous property selection.');
  await page.locator('#deed-atlas-open').click();
  await page.locator('[data-property="brick-0001"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#deed-property-name').inputValue(), '',
    'Property name drafts cannot cross character or account changes.');
  assert.deepEqual(errors, [], 'The actual production panel completes every scenario without browser errors.');

  const writesBeforeAllocation = await page.evaluate(() => calls.filter(call => call.method === 'POST').length);
  await page.evaluate(async () => {
    fixture.issuanceKind='paid';fixture.hideDiscovery=true;fixture.primary=false;fixture.quest=true;
    fixture.supply={gameplay:{maximum:1000,issued:1000,remaining:0},paid:{maximum:1000,issued:0,remaining:1000},
      partnership:{maximum:500,issued:0,remaining:500}};
    await renderDeeds({district:'brick',buildingId:'brick-0001'});
  });
  assert.match(await page.locator('#deed-supply').textContent(), /Gameplay: 0 of 1,000 remaining · fully claimed/);
  assert.match(await page.locator('#deed-supply').textContent(), /Paid allocation: 1,000 of 1,000 unissued · minting pending/);
  assert.match(await page.locator('#deed-property-detail').textContent(), /Paid NFT minting is not available yet/);
  assert.equal(await page.locator('#deed-investigate, #deed-property-claim, #deed-property-paid, #deed-property-name').count(), 0,
    'An unlaunched paid allocation offers no quest claim or fake checkout, even with a qualifying quest.');
  await page.evaluate(async () => {fixture.issuanceKind='partnership';await renderDeeds();});
  assert.match(await page.locator('#deed-property-detail').textContent(), /500-Deed partnership allocation/);
  assert.equal(await page.locator('#deed-investigate, #deed-property-claim, #deed-property-paid').count(), 0);
  assert.equal(await page.evaluate(() => calls.filter(call => call.method === 'POST').length), writesBeforeAllocation,
    'Inspecting a reserved allocation dispatches no gameplay or payment mutation.');
  await page.evaluate(async () => {
    fixture.issuanceKind='gameplay';fixture.hideDiscovery=false;
    fixture.deed={name:'Earned Row',issuanceKind:'gameplay',district:'brick',districtName:'Brick Yards'};
    fixture.chain={configured:true,canExtract:true,activationPending:true};
    fixture.upgrades={deedName:'Earned Row',level:2,maxLevel:5,effectiveBonusBps:1000,bonusBps:1000,next:null};
    fixture.rewards={configured:false,allocations:[{ticker:'ACME',allocated:3,pending:1,delivered:2}]};
    await renderDeeds();
  });
  assert.match(await page.locator('#deed-mint-pending').textContent(), /Deed NFT activation pending/);
  assert.equal(await page.locator('#deed-extract').count(), 0,
    'An environment address cannot expose minting while contract activation is pending.');
  assert.equal(await page.locator('#deed-upgrade-title').textContent(), 'Optional deed upgrades');
  assert.match(await page.locator('#tab-deeds').textContent(), /current reward-weight bonus \+10%/);
  assert.match(await page.locator('#tab-deeds').textContent(), /ACME/);
  assert.equal(await page.locator('#deed-reward-title').textContent(), 'Your RWA distributions');
  assert.deepEqual(errors, [], 'Allocation changes preserve the modern rewards, upgrades and rendering guards.');

  const spec = buildOpenApi([
    {method:'GET',url:'/v1/deeds/discovery',hasAuth:true},
    {method:'POST',url:'/v1/deeds/investigate',hasAuth:true},
    {method:'POST',url:'/v1/deeds/claim',hasAuth:true},
  ]);
  for (const path of ['/v1/deeds/investigate', '/v1/deeds/claim']) {
    const schema = spec.paths[path].post.requestBody.content['application/json'].schema;
    assert.equal(schema.additionalProperties, false);
    assert(schema.required.includes('buildingId'));
    assert.equal(Object.hasOwn(schema.properties, 'qualified'), false, 'Clients cannot assert qualification.');
  }
  assert.deepEqual(spec.paths['/v1/deeds/claim'].post.requestBody.content['application/json'].schema.required,
    ['name', 'buildingId']);
  assert.equal(spec.paths['/v1/deeds/discovery'].get.parameters[0].name, 'district');
  console.log('✓ Deed discovery UI: Level 25 gameplay allocation, pending paid mint, partnership exclusion, retained rewards/upgrades, actor/draft races, earned claims and OpenAPI boundaries.');
} finally { await browser.close(); }
