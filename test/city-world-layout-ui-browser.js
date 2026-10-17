// Shared-layout UI coverage uses public fixtures and no database or gameplay mutation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const executablePath = [process.env.CHROMIUM_PATH, chromium.executablePath(),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome']
  .find(file => file && fs.existsSync(file));
assert(executablePath, 'Set CHROMIUM_PATH to an installed Chromium executable.');
const browser = await chromium.launch({ executablePath, headless: true });
try {
  for (const viewport of [{ width: 320, height: 720 }, { width: 1366, height: 768 }]) {
    const context = await browser.newContext({ viewport, reducedMotion: 'reduce' }), page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><section class="omerta-city"></section>');
    await page.addStyleTag({ content: '.omerta-city{max-width:760px;margin:auto;color:#eadfc4;background:#182c2c;font-family:Arial}button{padding:8px;border:1px solid #85785c;background:#26352f;color:#efe4c6}' });
    await page.addStyleTag({ path: 'public/city-world-ui.css' });
    await page.addScriptTag({ path: 'public/city-world-layout.js' });
    await page.addScriptTag({ path: 'public/city-world-ui.js' });
    await page.evaluate(() => {
      const layout = window.CityWorldLayout, origin = layout.getDistrict('docks').origin;
      window.__character = { id: 'layout-viewer', generation: 1, loc: 'docks', cash: 1000 };
      window.__publicInspections = []; window.__travels = []; window.__homes = [];
      window.__ownHome = { key: 'fixture-street', street: 'Fixture Street', districtId: 'docks', buildingId: 'docks-0417', ownership: 'city', mine: true, owner: { name: 'Viewer', kind: 'player' } };
      window.__board = districtId => ({ viewer: { characterId: 'layout-viewer', generation: 1, district: 'docks' }, districtId,
        placement: 'illustrative', homes: districtId === 'docks' ? [window.__ownHome] : [], myHome: districtId === 'docks' ? window.__ownHome : null,
        total: districtId === 'docks' ? 1 : 0, nextCursor: null });
      window.__frame = { world: { ...layout.world, x: -origin.x, y: -origin.y, origin }, position: { x: 480, y: 256 }, homes: [], obstacles: [], roads: [] };
      window.__atlas = { districts: layout.districts.map(item => ({ id: item.id, name: item.name, deeds: item.capacity, neighbours: [] })) };
      window.__ui = window.OmertaCityWorldUI.mount(document.querySelector('.omerta-city'), {
        scopeKey: 'layout-session', character: window.__character, district: { id: 'docks', name: 'The Docks' },
        rules: { travelCost: 25, districts: window.__atlas.districts }, atlas: window.__atlas,
        homes: window.__board('docks'), getState: () => window.__frame,
        onRead: async (kind, input) => ({ code: 200, body: kind === 'atlas' ? window.__atlas : kind === 'homes' ? window.__board(input.districtId) : { categories: [] } }),
        onPlotInspect: plot => window.__publicInspections.push(plot), onTravel: district => { window.__travels.push(district); },
        onHomes: board => window.__homes.push(board)
      });
      window.__ui.openMapOverview('docks');
    });
    await page.locator('[data-city-world-atlas]').waitFor();
    assert.equal(await page.locator('[data-city-world-atlas]').getAttribute('data-city-world-plot-count'), '2500');
    assert.equal(await page.locator('.city-world__atlas-plots').evaluate(node => node.getAttribute('d').split('M').length - 1), 2500);
    assert(await page.locator('[data-city-world-atlas] *').count() < 40, 'All 2500 houses are batched instead of mounting a DOM control for every plot.');
    assert.equal(await page.locator('.city-world__atlas-owned').evaluate(node => node.getAttribute('d').split('M').length - 1), 1);
    assert.equal(await page.locator('[data-city-atlas-position]').getAttribute('cx'), '128');
    assert(Math.abs(Number(await page.locator('[data-city-atlas-position]').getAttribute('cy')) - 38.4) < 0.001);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    for (const height of [360, 240]) {
      const visible = await page.evaluate(height => {
        window.__ui.setHeight(height);
        const dock = document.querySelector('.city-world__dock'), bar = document.querySelector('.city-world__dock-bar');
        return { map: document.querySelector('[data-city-world-atlas]').getBoundingClientRect().height, available: dock.clientHeight - bar.getBoundingClientRect().height };
      }, height);
      assert(visible.map <= visible.available, 'The entire city fits beneath the sticky toolbar at dock height ' + height + ': ' + JSON.stringify(visible));
    }
    const plotTarget = await page.evaluate(() => {
      const svg = document.querySelector('[data-city-world-atlas]'), dock = svg.closest('.city-world__dock');
      const bar = dock.querySelector('.city-world__dock-bar');
      dock.scrollTop += svg.getBoundingClientRect().top - dock.getBoundingClientRect().top - bar.getBoundingClientRect().height - 4;
      const plot = window.CityWorldLayout.getPlot('docks-0002'), point = svg.createSVGPoint();
      point.x = (plot.building.x + plot.building.width / 2) / 10; point.y = (plot.building.y + plot.building.height / 2) / 10;
      const screen = point.matrixTransform(svg.getScreenCTM()); return { x: screen.x, y: screen.y };
    });
    await page.mouse.click(plotTarget.x, plotTarget.y);
    await page.locator('[data-city-plot-detail="docks-0002"]').waitFor();
    await page.evaluate(() => document.addEventListener('click', event => { window.__captionClick = { trusted: event.isTrusted, tag: event.target.tagName }; }, { once: true }));
    await page.locator('.city-world__atlas-diagram text').filter({ hasText: 'Cathedral Hill' }).click();
    assert.deepEqual(await page.evaluate(() => window.__captionClick), { trusted: true, tag: 'text' });
    assert.equal(await page.evaluate(() => window.__ui.getState().districtId), 'cathedral');

    await page.locator('[data-city-plot-district]').selectOption('brick');
    await page.locator('[data-city-plot-number]').fill('417');
    await page.locator('[data-city-plot-number]').press('Enter');
    await page.locator('[data-city-plot-detail="brick-0417"]').waitFor();
    assert.match(await page.locator('[data-city-plot-detail]').innerText(), /Ownership records for this plot are not loaded/);
    assert.equal(await page.locator('[data-city-plot-detail]').evaluate(node => document.activeElement === node), true);
    assert.equal(await page.locator('.city-world__atlas-focused').count(), 1);
    await page.locator('[data-city-atlas-zoom="district"]').click();
    assert.equal(await page.locator('[data-city-world-atlas]').getAttribute('viewBox'), '0 224 256 224');
    await page.locator('[data-city-atlas-zoom="city"]').click();
    assert.equal(await page.locator('[data-city-world-atlas]').getAttribute('viewBox'), '0 0 768 448');
    if (process.env.CITY_WORLD_UI_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.CITY_WORLD_UI_SCREENSHOT_DIR, { recursive: true });
      await page.locator('[data-city-world-atlas]').screenshot({ path: process.env.CITY_WORLD_UI_SCREENSHOT_DIR + '/world-' + viewport.width + '.png' });
    }
    assert.deepEqual(await page.evaluate(() => window.__travels), [], 'Finding a plot cannot travel or spend money.');
    await page.getByRole('button', { name: 'Open Deed building →' }).click();
    assert.deepEqual(await page.evaluate(() => window.__publicInspections), [{ buildingId: 'brick-0417', districtId: 'brick' }]);

    await page.evaluate(() => window.__ui.openMapOverview('docks'));
    await page.locator('[data-city-home="fixture-street"]').click();
    assert.equal(await page.locator('.city-world__atlas-focused').count(), 1, 'A loaded street focuses its permanent building, without deriving coordinates from its street name.');
    await page.evaluate(() => window.__ui.update({ homes: { ...window.__board('docks'), homes: [{ ...window.__ownHome, mine: false, owner: null, ownership: 'estate' }], myHome: null } }));
    assert.equal(await page.locator('.city-world__atlas-owned').getAttribute('d'), '', 'Fresh ownership loss clears the ownership highlight without moving the public plot.');

    await page.evaluate(() => {
      window.__frame.position = { x: 1700, y: 500 }; window.__ui.frame(window.__frame); window.__ui.open('map');
    });
    assert.equal(await page.locator('[data-city-minimap]').getAttribute('data-city-map-bounds'), '1220,180,960,640');
    const pixel = await page.locator('[data-city-minimap]').evaluate(node => Array.from(node.getContext('2d').getImageData(240, 160, 1, 1).data));
    assert.deepEqual(pixel, [255, 244, 191, 255], 'The player stays centered when local coordinates are far from the active district core.');
    await page.evaluate(() => {
      const plot = window.CityWorldLayout.getPlot('docks-0417'), origin = window.__frame.world.origin;
      const entrance = { x: plot.entrance.x - origin.x, y: plot.entrance.y - origin.y };
      window.__frame.position = { x: entrance.x - 100, y: entrance.y };
      window.__frame.homes = [{ key: window.__ownHome.key, mine: true, entrance }];
      window.__ui.frame(window.__frame); window.__ui.open('map');
    });
    const lostHome = await page.locator('[data-city-minimap]').evaluate(node => Array.from(node.getContext('2d').getImageData(290, 160, 1, 1).data));
    assert.deepEqual(lostHome, [176, 184, 167, 255], 'A stale renderer frame cannot restore ownership after the current directory publishes its loss.');
    await page.evaluate(() => window.__ui.update({ character: { id: 'next-viewer', generation: 1, loc: 'docks' } }));
    assert.equal(await page.locator('[data-city-world-atlas]').count(), 0, 'Identity changes clear private panels and stale highlights.');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('Continuous world map UI passed: stable 2500-plot overview, public selection, ownership refresh, global position, mobile and keyboard controls.');
} finally { await browser.close(); }
