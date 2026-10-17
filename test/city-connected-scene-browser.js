// Real renderer/input regression. This fixture serves public assets and never opens a database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const publicRoot = path.resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const preview = process.argv.includes('--serve');
const fixture = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/city-scene.css"><link rel="stylesheet" href="/city-world-ui.css">
<style>html,body{margin:0;background:#102420;color:#eddfc4;font-family:Arial}#fixture{max-width:1100px;margin:auto}button{font:inherit}#preview-tools{padding:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}#preview-tools button,#preview-tools select{background:#244136;color:#eddfc4;border:1px solid #8b916b;padding:10px;font:inherit}#preview-tools output{flex-basis:100%}</style>
</head><body>${preview ? '<nav id="preview-tools" aria-label="Local fixture views"><strong>Local visual fixture</strong><label>District <select id="preview-district"></select></label><button data-preview-view="core">Service core</button><button data-preview-view="suburb">Residential streets</button><button data-preview-view="border">District boundary</button><button id="preview-map">Full city map</button><output id="preview-note">Fixture records only. No live actions or database.</output></nav>' : ''}<main id="fixture"></main><script>
window.__games=[];let engine;Object.defineProperty(window,'Phaser',{configurable:true,get:()=>engine,set:value=>{
engine=value;const Game=value.Game;value.Game=new Proxy(Game,{construct(target,args){const game=Reflect.construct(target,args);window.__games.push(game);return game;}});}});
</script><script src="/vendor/phaser.js"></script><script src="/city-world-layout.js"></script>${preview ? '<script src="/city-world-ui.js"></script>' : ''}<script src="/city-scene.js"></script>
<script>
window.__character={id:'connected-viewer',generation:1,name:'City Explorer',district:'docks',alive:true,
  level:1,cash:5000,hp:100,maxHp:100,stamina:100,maxStamina:100,stats:{muscle:5,cunning:5,speed:5}};
window.__travel=[];window.__inspect=[];window.__positions=[];
window.__home=(number,district='docks')=>({key:'street-'+number,buildingId:district+'-'+String(number).padStart(4,'0'),
  street:'Confirmed Street '+number,districtId:district,ownership:'city',mine:number===1,owner:{name:'Steward '+number,kind:'player'}});
window.__board=(numbers,district='docks')=>({placement:'illustrative',districtId:district,total:417,
  viewer:{characterId:window.__character.id,generation:window.__character.generation,district},
  homes:numbers.map(number=>window.__home(number,district)),nextCursor:null});
window.__mount=(patch={})=>{
  window.__scene?.destroy();document.querySelector('#fixture').replaceChildren();
  window.__options={character:{...window.__character},district:{id:'docks',name:'The Docks',deeds:417},
    reducedMotion:true,worldScopeKey:'fixture-a',position:{x:430,y:366},actors:[],
    rules:{travelCost:250,districts:CityWorldLayout.districts.map(d=>({id:d.id,name:d.name}))},
    worldHomes:window.__board([1,2,3]),onNavigate:()=>{},onPositionChange:p=>window.__positions.push(p),
    onPlotInspect:p=>window.__inspect.push(p),onWorldTravel:(district,guards)=>new Promise(resolve=>window.__travel.push({district,guards,resolve})),...patch};
  window.__scene=OmertaCityScene.mount(document.querySelector('#fixture'),window.__options);
};${preview ? '' : 'window.__mount();'}
${preview ? `
window.__preview=(districtId,view='core')=>{
  const district=CityWorldLayout.getDistrict(districtId),plot=CityWorldLayout.getPlot(districtId+'-0001');
  const global=view==='suburb'?plot.entrance:view==='border'?{x:district.bounds.x+district.bounds.width-2,y:district.bounds.y+196}:null;
  const atlas={districts:CityWorldLayout.districts.map(d=>({id:d.id,name:d.name,deeds:d.capacity,neighbours:[]}))};
  const position=global?{x:global.x-district.origin.x,y:global.y-district.origin.y}:{x:430,y:366};
  window.__mount({district:{id:district.id,name:district.name,deeds:district.capacity},character:{...window.__character,loc:district.id},position,
    worldHomes:window.__board([1,2,3],district.id),worldAtlas:atlas,worldCollection:{categories:[]},
    onWorldRead:async(kind,input)=>{const board=window.__board([1,2,3],input?.districtId||district.id);board.viewer.district=district.id;
      return {code:200,body:kind==='atlas'?atlas:kind==='homes'?board:kind==='collection'?{categories:[]}:{}};},
    onPlotInspect:p=>{window.__inspect.push(p);document.querySelector('#preview-note').textContent='Inspected permanent plot '+p.buildingId+' in '+p.districtId+'.';}});
  document.querySelector('#preview-note').textContent=district.name+' · '+view+' · local visual fixture; no live actions.';
};
const select=document.querySelector('#preview-district');
for(const district of CityWorldLayout.districts){const option=document.createElement('option');option.value=district.id;option.textContent=district.name;select.append(option);}
select.addEventListener('change',()=>window.__preview(select.value));
for(const button of document.querySelectorAll('[data-preview-view]'))button.addEventListener('click',()=>window.__preview(select.value,button.dataset.previewView));
document.querySelector('#preview-map').addEventListener('click',()=>window.__scene.showWorldMap());
window.__preview('docks');` : ''}
</script></body></html>`;
const server = http.createServer((request, reply) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/') { reply.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); reply.end(fixture); return; }
  const target = path.resolve(publicRoot, '.' + decodeURIComponent(url.pathname));
  if (!target.startsWith(publicRoot + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
    reply.writeHead(404); reply.end(); return;
  }
  const contentType = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' }[path.extname(target)] || 'application/octet-stream';
  reply.writeHead(200, { 'content-type': contentType }); fs.createReadStream(target).pipe(reply);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
if (preview) {
  console.log('Connected city renderer preview: ' + base);
} else {
  const executablePath = [process.env.CHROMIUM_PATH, chromium.executablePath(),
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/chromium', '/usr/bin/google-chrome'].find(file => file && fs.existsSync(file));
  assert(executablePath, 'Set CHROMIUM_PATH to an installed Chromium executable.');
  let browser;
  try {
    browser = await chromium.launch({ executablePath, headless: true });
    for (const viewport of [{ width: 1366, height: 900 }, { width: 375, height: 812 }]) {
      const mobile = viewport.width < 680;
      const context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base);
      const state = () => page.evaluate(() => window.__scene.getState());
      const ready = () => page.waitForFunction(() => window.__scene?.getState().ready);
      const frames = count => page.evaluate(count => new Promise(resolve => {
        let left = count; const game = window.__games.at(-1);
        const frame = () => { if (--left <= 0) { game.events.off('poststep', frame); resolve(); } };
        game.events.on('poststep', frame);
      }), count);
      const remount = async patch => { await page.evaluate(patch => window.__mount(patch), patch); await ready(); await frames(3); };
      const canvas = page.locator('.omerta-city__canvas canvas');
      const hold = async (key, axis, delta) => {
        await canvas.focus(); const start = (await state()).player[axis];
        await page.keyboard.down(key);
        try { await page.waitForFunction(({ axis, start, delta }) => (window.__scene.getState().player[axis] - start) * Math.sign(delta) >= Math.abs(delta), { axis, start, delta }, { timeout: 8000 }); }
        finally { await page.keyboard.up(key); }
        await frames(2);
      };
      const clickPoint = async (point, touch = mobile) => {
        const current = await state(), box = await canvas.boundingBox();
        const position = { x: (point.x - current.camera.x) * current.camera.zoom * box.width / current.camera.width,
          y: (point.y - current.camera.y) * current.camera.zoom * box.height / current.camera.height };
        assert(position.x > 0 && position.y > 0 && position.x < box.width && position.y < box.height, 'Pointer target is inside the actual canvas');
        if (touch) await canvas.tap({ position }); else await canvas.click({ position });
      };
      await ready(); await frames(3);
      let initial = await state();
      assert.equal(initial.connected, true);
      assert.equal(initial.plotCount, 2500);
      assert.deepEqual(initial.world.origin, { x: 800, y: 128 });
      assert.deepEqual({ x: initial.world.x, y: initial.world.y, width: initial.world.width, height: initial.world.height },
        { x: -800, y: -128, width: 7680, height: 4480 });
      assert(initial.visiblePlots > 0 && initial.visiblePlots < 700, 'Detailed art is culled to nearby blocks');
      assert.equal(initial.homes.length, 3, 'Unloaded plots do not invent confirmed owners');
      const stable = initial.homes.find(home => home.key === 'street-1');
      assert.deepEqual(stable.building, { x: -672, y: 0, width: 72, height: 54 });
      await page.evaluate(() => window.__scene.update({ worldHomes: window.__board(Array.from({ length: 90 }, (_, index) => index + 2)) }));
      let paged = await state();
      assert.equal(paged.homes.length, 64, 'Confirmed labels remain capped across large directory windows');
      assert.equal(paged.homes.some(home => home.key === 'street-1'), false);
      assert.equal(paged.plotCount, 2500, 'Paging the directory never removes physical plots');
      await page.evaluate(() => {
        const board = window.__board([3,1,2]);
        board.homes.push({ ...window.__home(4), buildingId: null }, { ...window.__home(5), buildingId: 'neon-0005' },
          { ...window.__home(6), ownership: 'invented' });
        window.__scene.update({ worldHomes: board });
      });
      paged = await state();
      assert.equal(paged.homes.length, 3, 'Invalid or mismatched property identities never gain a rendered assignment');
      assert.deepEqual(paged.homes.find(home => home.key === 'street-1'), stable, 'The same building survives directory reordering unchanged');
      assert.deepEqual(paged.position, initial.position, 'Directory replacement never relocates the player');

      await hold('ArrowDown', 'y', 32);
      const beforeClick = (await state()).player;
      await clickPoint({ x: beforeClick.x, y: beforeClick.y + 48 });
      await page.waitForFunction(y => window.__scene.getState().player.y > y + 30, beforeClick.y);
      await page.waitForFunction(() => window.__scene.getState().pathLength === 0);
      if (mobile) {
        const beforeTouch = (await state()).player.x;
        const button = page.locator('[data-city-move="right"]'), box = await button.boundingBox();
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
        try { await page.waitForFunction(x => window.__scene.getState().player.x > x + 20, beforeTouch); }
        finally { await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
        await frames(3);
        assert((await state()).player.x > beforeTouch + 20, 'The real touch direction control moves in the connected city');
      }

      await remount({ position: { x: -636, y: 68 } });
      const residential = await state();
      assert(residential.camera.x < 0, 'The camera follows into the negative local-coordinate suburbs');
      assert(residential.camera.x >= residential.world.x && residential.camera.y >= residential.world.y, 'Camera bounds include the full global city');
      assert(residential.visiblePlots > 0 && residential.visiblePlots < 700);
      await canvas.focus(); await page.keyboard.press('e');
      assert.equal((await state()).selectedHome, 'street-1', 'Keyboard interaction uses the canonical house entrance');
      await page.evaluate(() => window.__scene.closePanels());
      await page.evaluate(() => window.__scene.update({ worldHomes: null }));
      await canvas.focus(); await page.keyboard.press('e');
      assert.deepEqual(await page.evaluate(() => window.__inspect.at(-1)), { buildingId: 'docks-0001', districtId: 'docks' },
        'An unloaded ownership record opens the canonical neutral plot');
      assert.equal((await state()).homes.length, 0);

      await remount({ position: { x: 1758, y: 68 }, actors: [{ id: 'old-neighbor', name: 'Old Neighbor', kind: 'player', district: 'docks', generation: 1 }] });
      await canvas.focus(); await page.keyboard.down('ArrowRight');
      await page.waitForFunction(() => window.__travel.length === 1);
      const crossing = await state();
      assert.equal(crossing.crossingPending, true);
      assert.equal(crossing.player.x, 1758, 'The source position is frozen before a district fare is confirmed');
      for (let i = 0; i < 3; i++) { await page.keyboard.down('ArrowRight'); await frames(2); }
      assert.equal(await page.evaluate(() => window.__travel.length), 1, 'Held and repeated movement cannot dispatch duplicate pending travel');
      assert.deepEqual((await state()).player, crossing.player);
      assert.equal(await page.evaluate(() => window.__travel[0].district), 'canal');
      assert(await page.evaluate(() => window.__travel[0].guards.worldPosition.x >= 2560 && window.__travel[0].guards.isCurrent()));
      await page.evaluate(() => window.__travel[0].resolve({ ignored: true }));
      await page.waitForFunction(() => !window.__scene.getState().crossingPending);
      await page.keyboard.down('ArrowRight'); await frames(5);
      assert.equal(await page.evaluate(() => window.__travel.length), 1, 'A declined crossing cannot retrigger from the same held key');
      assert.deepEqual((await state()).player, crossing.player);
      await page.keyboard.up('ArrowRight');
      await page.keyboard.down('ArrowRight');
      await page.waitForFunction(() => window.__travel.length === 2);
      await page.keyboard.up('ArrowRight');
      await page.evaluate(() => window.__scene.update({ worldScopeKey: 'fixture-b' }));
      const retired = await state();
      assert.equal(retired.crossingPending, false, 'Scope retirement releases the stale pending crossing');
      assert.equal(retired.homes.length, 0, 'Private ownership labels retire with their scope');
      assert.equal(retired.actorMarkers.length, 0, 'Stale district people retire with their scope');
      assert.equal(await page.evaluate(() => window.__travel[1].guards.isCurrent()), false);
      await page.evaluate(() => window.__travel[1].resolve({ code: 200 })); await frames(3);
      assert.deepEqual((await state()).player, crossing.player, 'A late retired confirmation cannot relocate a new scope');
      await canvas.focus(); await page.keyboard.down('ArrowRight');
      await page.waitForFunction(() => window.__travel.length === 3);
      await page.keyboard.up('ArrowRight');
      const target = await page.evaluate(() => {
        const entry = window.__travel[2], district = CityWorldLayout.getDistrict(entry.district), p = entry.guards.worldPosition;
        entry.resolve({ code: 200 });
        return { district: { id: district.id, name: district.name, deeds: district.capacity },
          position: { x: p.x - district.origin.x, y: p.y - district.origin.y }, worldHomes: null, actors: [], worldScopeKey: 'confirmed-canal' };
      });
      await remount(target);
      const confirmed = await state();
      assert.equal(confirmed.region.id, 'canal');
      assert(confirmed.position.x + confirmed.world.origin.x >= 2560, 'Confirmed travel resumes in the same continuous world near the seam');
      assert.equal(confirmed.homes.length, 0);
      assert.equal(confirmed.actorMarkers.length, 0);
      assert.equal(confirmed.plotCount, 2500);
      assert.deepEqual(errors, [], 'The renderer emits no browser exceptions');
      console.log(JSON.stringify({ viewport: viewport.width, result: 'PASS', permanentPlots: confirmed.plotCount,
        visiblePlots: confirmed.visiblePlots, crossingRequests: await page.evaluate(() => window.__travel.length) }));
      await context.close();
    }
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
