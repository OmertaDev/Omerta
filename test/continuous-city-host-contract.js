// Execute the shipped host callbacks with controlled receipt/refresh boundaries.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const layoutSource = fs.readFileSync(new URL('../public/city-world-layout.js', import.meta.url), 'utf8');
const source = (start, end) => {
  const from = html.indexOf(start), to = html.indexOf(end, from + start.length);
  assert(from >= 0 && to > from, 'The exercised production callback must exist: ' + start);
  return html.slice(from, to);
};
const hostSource = [
  source('  function cityIdentity(', '  function cityProgress('),
  source('  function cityActorScope(', '  function queueCityHomeEntry('),
  source('  function currentCityWorldOperation(', '  function renderCityCrew('),
  source('  function travelTo(', '  function openTravel('),
  source('  async function travelFromCity(', '  function acquireCityDeed('),
  source('  async function retryCityWorld(', '  function savedCityPosition('),
  source('  function inspectCityPlot(', '  async function mountCityNeighborhood('),
  source('  function loadCityAssets(', '  function citySceneFallback('),
].join('\n');

function fixture() {
  const storage = new Map(), calls = [], renders = [], entries = [], navigations = [];
  let revision = 1, confirmed = true, dispatch = null, retired = 0;
  const scope = {
    window: {}, Number, Promise, JSON, Object, Array, String,
    me: { id: 'actor-a', generation: 3, loc: 'docks', cash: 1000, jailSeconds: 0 },
    _cityScene: {}, _citySceneKey: 'actor-a:3:docks', currentTab: 'map', _mapMode: 'walk',
    _cityWorldPending: false, _cityWorldReceipt: null, _cityQuestReceipt: null, _citySceneAssets: null,
    navigationRevision: 2, acting: false,
    rules: { districts: ['docks', 'canal', 'neon', 'brick', 'foundry', 'cathedral'], travelCost: 250 },
    projections: { snapshot: () => revision, current: stamp => stamp === revision },
    sessionStorage: { setItem: (key, value) => storage.set(key, value) },
    cityWorldOptions: () => ({ worldRecovery: scope._cityWorldReceipt?.receipt.state === 'error' }),
    ask: async () => typeof confirmed === 'function' ? confirmed() : confirmed,
    fmt: value => String(value), publishCityWorld: () => {}, readCityWorld: async () => {},
    queueCityHomeEntry: entry => entries.push(entry),
    destroyCityScene: () => { retired++; scope._cityScene = null; scope._citySceneKey = null; },
    renderActive: () => renders.push({ location: scope.me.loc, saved: storage.get('omerta_city_pose:' + scope.cityIdentity()) }),
    deedPropertyActor: null, deedPropertyFocus: null, deedPropertyNames: new Map([['old-name', 'Old Street']]),
    navigateFromCity: (tab, context) => navigations.push({ tab, context, focus: { ...scope.deedPropertyFocus } }),
  };
  scope.act = async (method, path, body, options) => {
    if (!options.beforeDispatch()) return { ignored: true, code: 499, body: {} };
    calls.push({ method, path, body, options });
    if (dispatch) return dispatch(options);
    scope.me.loc = path.split('/').at(-1);
    options.onReceipt({ id: calls.length, state: 'success' });
    scope.renderActive();
    return { code: 200, body: { ok: true, loc: scope.me.loc } };
  };
  vm.createContext(scope); vm.runInContext(layoutSource + '\n' + hostSource, scope);
  const arrival = { ...scope.window.CityWorldLayout.getPlot('canal-0001').entrance, facing: 'right' };
  const key = 'omerta_city_pose:actor-a:3:canal';
  return { scope, storage, calls, renders, entries, navigations, arrival, key,
    confirm: value => { confirmed = value; }, dispatch: value => { dispatch = value; },
    expire: () => { revision++; }, retired: () => retired };
}

{
  const f = fixture(), position = { ...f.arrival };
  const result = await f.scope.travelFromCity('canal', { worldPosition: position, homeKey: 'my street', isCurrent: () => true });
  assert.equal(result.code, 200); assert.equal(f.calls.length, 1);
  assert.deepEqual({ ...f.calls[0].body }, {}, 'The cosmetic pose never enters the travel mutation body.');
  const origin = f.scope.window.CityWorldLayout.getDistrict('canal').origin;
  const expected = { x: position.x - origin.x, y: position.y - origin.y, facing: 'right' };
  assert.deepEqual(JSON.parse(f.storage.get(f.key)), expected);
  assert(f.renders.every(render => JSON.parse(render.saved).x === expected.x), 'Every post-success render sees the saved target pose.');
  assert.equal(f.scope._cityWorldReceipt.worldPosition.x, position.x);
  position.x = 0;
  assert.notEqual(f.scope._cityWorldReceipt.worldPosition.x, position.x, 'The pending receipt holds a validated copy.');
  assert.equal(f.entries[0].key, 'my street', 'Existing home-arrival intent survives.');
  assert.equal(f.retired(), 0, 'The normal source scene is retired by the existing render lifecycle.');
}
for (const scenario of ['declined', 'stale-opening', 'stale-confirmation', 'unaffordable', 'jailed', 'failed', 'noauth', 'new-generation']) {
  const f = fixture();
  f.storage.set(f.key, 'existing target pose');
  const context = { worldPosition: f.arrival, isCurrent: () => scenario !== 'stale-opening' };
  if (scenario === 'declined') f.confirm(false);
  if (scenario === 'stale-confirmation') f.confirm(() => { f.scope.navigationRevision++; return true; });
  if (scenario === 'unaffordable') f.scope.me.cash = 1;
  if (scenario === 'jailed') f.scope.me.jailSeconds = 60;
  if (['failed', 'noauth', 'new-generation'].includes(scenario)) f.dispatch(async options => {
    if (scenario === 'noauth') f.expire();
    if (scenario === 'new-generation') f.scope.me.generation++;
    if (scenario !== 'failed') f.scope.me.loc = 'canal';
    options.onReceipt({ id: 1, state: scenario === 'failed' ? 'error' : 'success' });
    return { code: scenario === 'failed' ? 403 : 499, body: {} };
  });
  await f.scope.travelFromCity('canal', context);
  assert.equal(f.storage.get(f.key), 'existing target pose', scenario + ' leaves the saved arrival untouched.');
  assert.equal(f.storage.size, 1, scenario + ' cannot write a pose for another actor scope.');
  assert.equal(f.retired(), 0, scenario + ' never retires a scene for cosmetic travel.');
  if (!['failed', 'noauth', 'new-generation'].includes(scenario)) assert.equal(f.calls.length, 0);
}
{
  const f = fixture(), layout = f.scope.window.CityWorldLayout;
  for (const position of [null, { x: NaN, y: 10 }, { x: Infinity, y: 20 }, { x: '1', y: 1 },
    layout.getPlot('docks-0001').entrance, layout.getPlot('canal-0001').building]) {
    assert.equal(f.scope.cityWorldArrival('canal', position), null, 'Only finite, walkable target-district positions qualify.');
  }
  f.storage.set(f.key, 'existing target pose');
  await f.scope.travelFromCity('canal', { worldPosition: layout.getPlot('docks-0001').entrance });
  assert.equal(f.storage.get(f.key), 'existing target pose', 'An invalid cosmetic point cannot replace a stored pose after valid server travel.');
  f.scope.me.loc = 'docks';
  f.scope.rememberCityArrival('canal', f.arrival);
  assert.equal(f.storage.get(f.key), 'existing target pose', 'Coordinates cannot override server location.');
}
{
  const f = fixture(); let onReceipt;
  f.dispatch(async options => {
    onReceipt = options.onReceipt;
    f.scope.me.loc = 'canal';
    options.onReceipt({ id: 1, state: 'error', recovery: { sameKey: true, run: async () => {
      onReceipt({ id: 2, state: 'success' });
      f.scope.renderActive();
      return { code: 200, body: { ok: true, loc: 'canal' } };
    } } });
    return { code: 503, body: { error: 'offline' } };
  });
  await f.scope.travelFromCity('canal', { worldPosition: f.arrival, homeKey: 'my street' });
  assert.equal(f.storage.size, 0, 'A lost reply does not apply the pose even if refresh discovers the new district.');
  f.scope._citySceneKey = 'actor-a:3:canal';
  await f.scope.retryCityWorld();
  assert.equal(f.retired(), 1, 'Recovery retires a target scene mounted before the success receipt.');
  assert(f.renders.every(render => render.saved), 'Recovery saves before any replacement render.');
  assert.equal(JSON.parse(f.storage.get(f.key)).facing, 'right');
  assert.equal(f.entries[0].key, 'my street');
  assert.equal(f.calls.length, 1, 'The host delegates to the retained recovery instead of starting fresh travel.');
}
{
  const f = fixture();
  assert.equal(f.scope.inspectCityPlot({ buildingId: 'canal-0001', districtId: 'docks' }), false);
  assert.equal(f.scope.inspectCityPlot({ buildingId: 'canal-9999', districtId: 'canal' }), false);
  assert.equal(f.scope.inspectCityPlot({ buildingId: 'canal-0001', districtId: 'canal' }), true);
  assert.deepEqual(f.navigations[0].focus, { district: 'canal', buildingId: 'canal-0001' });
  assert.equal(f.navigations[0].tab, 'deeds');
  assert.equal(f.scope.deedPropertyActor, 'actor-a', 'First navigation does not discard exact property focus during actor initialization.');
  assert.equal(f.scope.deedPropertyNames.size, 0, 'Another actor’s property-name draft is cleared.');
  f.scope.currentTab = 'deeds';
  assert.equal(f.scope.inspectCityPlot({ buildingId: 'canal-0002', districtId: 'canal' }), false);
}
{
  const f = fixture(); let failLayout = true; const loads = [];
  f.scope.window.OmertaCityScene = { mount() {} };
  f.scope.loadCityScript = async path => {
    loads.push(path);
    if (failLayout && path.startsWith('/city-world-layout.js')) throw Error('layout unavailable');
  };
  await assert.rejects(f.scope.loadCityAssets(), /layout unavailable/);
  assert.equal(f.scope._citySceneAssets, null, 'Required-layout failure releases the loader for the existing accessible retry.');
  failLayout = false;
  assert.equal(await f.scope.loadCityAssets(), f.scope.window.OmertaCityScene);
  assert.equal(loads.filter(path => path.startsWith('/city-world-layout.js')).length, 2);
  assert(html.includes('onPlotInspect: plot => key === cityIdentity() && epoch === _citySceneEpoch'), 'Mounted plot callbacks retain their scene identity guard.');
}
console.log('continuous-city-host-contract PASS: required-layout retry, exact Deed focus, confirmed local arrival before render, failure/staleness guards, and retained-receipt recovery.');
