// Geometry-only proof: no database, property ownership, or travel commands are changed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { DEED_BUILDINGS, DEED_BUILDING_TOTAL } from '../src/deedbuildings.js';

const source = fs.readFileSync(new URL('../public/city-world-layout.js', import.meta.url), 'utf8');
function load() {
  const context = {};
  vm.runInNewContext(source, context);
  return context.CityWorldLayout;
}
const layout = load(), canonicalBefore = JSON.stringify(DEED_BUILDINGS);
assert.equal(layout.metadata.version, 'continuous-city-v1');
assert.equal(layout.metadata.total, DEED_BUILDING_TOTAL);
assert.equal(layout.plots.length, 2500);
assert.equal(new Set(layout.plots.map(plot => plot.buildingId)).size, 2500);
assert.equal(layout.districts.length, 6);
assert.deepEqual(JSON.parse(JSON.stringify(layout.world)), { x: 0, y: 0, width: 7680, height: 4480 });
assert(Object.isFrozen(layout) && Object.isFrozen(layout.plots) && Object.isFrozen(layout.districts));
for (const building of DEED_BUILDINGS) {
  const plot = layout.getPlot(building.id);
  assert(plot, building.id + ' has a permanent world plot');
  assert.equal(plot.buildingId, building.id);
  assert.equal(plot.districtId, building.district);
  assert.equal(plot.number, building.number);
  assert(Object.isFrozen(plot) && Object.isFrozen(plot.building) && Object.isFrozen(plot.entrance));
  const district = layout.getDistrict(plot.districtId);
  assert.equal(layout.regionAt(plot.entrance).id, plot.districtId);
  assert.equal(district.origin.x, district.bounds.x + 800);
  assert.equal(district.origin.y, district.bounds.y + 128);
  assert.equal(district.core.width, 960);
  assert.equal(district.core.height, 640);
  assert(plot.building.x >= district.bounds.x && plot.building.x + plot.building.width <= district.bounds.x + district.bounds.width);
  assert(plot.building.y >= district.bounds.y && plot.building.y + plot.building.height <= district.bounds.y + district.bounds.height);
  assert.equal(layout.nearPlots(plot.building).length, 1, plot.id + ' has no overlapping footprint');
  assert.equal(layout.nearPlots(plot.building)[0].id, plot.id);
  assert.equal(layout.isWalkable(plot.building.x + plot.building.width / 2, plot.building.y + plot.building.height / 2), false);
  assert.equal(layout.isWalkable(plot.entrance), true, plot.id + ' has an accessible entrance');
}
for (const district of layout.districts) {
  assert.equal(layout.plots.filter(plot => plot.districtId === district.id).length, district.capacity);
  assert.equal(layout.nearPlots(district.core).length, 0, district.id + ' retains its service core');
  assert.equal(layout.regionAt(district.spawn).id, district.id);
}
assert.equal(layout.regionAt(2560, 384).id, 'canal');
assert.equal(layout.regionAt(100, 2240).id, 'brick');
for (const p of [{ x: -1, y: 0 }, { x: 7680, y: 0 }, { x: 0, y: 4480 }, { x: NaN, y: 0 }]) {
  assert.equal(layout.regionAt(p), null);
  assert.equal(layout.route(p, layout.districts[0].spawn).length, 0);
}
assert.equal(layout.getPlot('unknown'), null);
assert.equal(layout.getDistrict('unknown'), null);
assert.equal(layout.nearPlots({ x: 0, y: 0, width: Infinity, height: 1 }).length, 0);
assert.equal(layout.nearPlots(layout.world).length, 2500);
assert.equal(JSON.stringify(load().plots), JSON.stringify(layout.plots), 'Coordinates survive a fresh load unchanged');

// Use the actual service/landmark footprints, translated exactly as the scene does.
const sceneSource = fs.readFileSync(new URL('../public/city-scene.js', import.meta.url), 'utf8');
const geometry = { window: { CityWorldLayout: layout } };
vm.runInNewContext(sceneSource.slice(sceneSource.indexOf('  const WORLD ='), sceneSource.indexOf('  let instanceSequence =')) +
  '\nthis.obstacles = OBSTACLES; this.regions = REGIONS; this.venues = VENUES;', geometry);
const coreObstacles = layout.districts.flatMap(district => {
  const local = [...geometry.obstacles], landmark = geometry.regions[district.id]?.landmark;
  if (landmark) local.push(landmark);
  if (district.id === 'docks') local.push({ x: 0, y: 552, width: 960, height: 88 });
  return local.map(r => ({ x: district.origin.x + r.x, y: district.origin.y + r.y, width: r.width, height: r.height }));
});
const navigator = layout.createNavigator({ obstacles: coreObstacles });
let largestGraphVisit = 0, largestLocalVisit = 0;
function validRoute(start, finish, label) {
  const path = navigator.route(start, finish);
  assert(path.length, label + ' has a route');
  assert.equal(path[0].x, start.x, label + ' begins at the exact starting point');
  assert.equal(path[0].y, start.y);
  assert.equal(path.at(-1).x, finish.x, label + ' reaches the exact destination');
  assert.equal(path.at(-1).y, finish.y);
  assert(path.every(p => navigator.isWalkable(p)), label + ' has no blocked waypoints');
  for (let i = 1; i < path.length; i++) {
    assert(path[i - 1].x === path[i].x || path[i - 1].y === path[i].y, label + ' keeps cardinal segments');
    assert(navigator.segmentWalkable(path[i - 1], path[i]), label + ' does not cut any footprint corner');
  }
  const stats = navigator.stats();
  assert(stats.graphNodes < 6000, 'The street graph stays much smaller than the full walking grid');
  assert(stats.graphVisited <= stats.graphNodes, 'Graph A* visits each street intersection at most once');
  assert(stats.localVisited <= 4096 * 16, 'Fine routing is confined to bounded endpoint neighborhoods');
  largestGraphVisit = Math.max(largestGraphVisit, stats.graphVisited);
  largestLocalVisit = Math.max(largestLocalVisit, stats.localVisited);
}
for (const plot of layout.plots) validRoute(layout.getDistrict(plot.districtId).spawn, plot.entrance, plot.id);
for (const from of layout.districts) for (const to of layout.districts) {
  validRoute(from.spawn, to.spawn, from.id + ' → ' + to.id);
}
for (const district of layout.districts) for (const venue of geometry.venues) {
  validRoute(district.spawn, { x: district.origin.x + venue.x, y: district.origin.y + venue.y }, district.id + '/' + venue.id);
}
const first = layout.getPlot('docks-0001'), last = layout.getPlot('cathedral-0416');
validRoute(first.entrance, last.entrance, 'Opposite-corner house journey');
const detour = layout.createNavigator({ obstacles: [{ x: 3000, y: 2020, width: 40, height: 160 }] });
const aroundWall = detour.route({ x: 2960, y: 2100 }, { x: 3080, y: 2100 });
assert(aroundWall.length > 2, 'An added service wall requires a real local detour');
assert(detour.stats().localVisited > 0 && detour.stats().localVisited <= 4096,
  'The endpoint connector searches a bounded local grid when both direct elbows are blocked');
for (let i = 1; i < aroundWall.length; i++) assert(detour.segmentWalkable(aroundWall[i - 1], aroundWall[i]));
assert.equal(aroundWall.at(-1).x, 3080);
assert.equal(aroundWall.at(-1).y, 2100);
const sealed = layout.createNavigator({ obstacles: [{ x: 2000, y: 3000, width: 1000, height: 1000 }] });
assert.equal(sealed.route({ x: 2500, y: 3500 }, first.entrance).length, 0, 'An enclosed starting point cannot create a path through a wall');
assert.equal(JSON.stringify(DEED_BUILDINGS), canonicalBefore, 'Walking geometry never changes canonical atlas identity or coordinates');
assert.equal(JSON.stringify(layout.getPlot(first.id)), JSON.stringify(load().getPlot(first.id)), 'Directory order and navigation do not move a plot');
console.log(JSON.stringify({ result: 'PASS', permanentPlots: layout.plots.length, districts: layout.districts.length,
  crossDistrictJourneys: 36, largestGraphVisit, largestLocalVisit, localDetourVisited: detour.stats().localVisited,
  graphNodes: navigator.stats().graphNodes }));
