/* Stable walking coordinates for the permanent property atlas. Ownership stays server-owned. */
(function (root) {
  'use strict';

  const REGION_WIDTH = 2560, REGION_HEIGHT = 2240, RADIUS = 7, BUCKET = 128;
  const world = Object.freeze({ x: 0, y: 0, width: REGION_WIDTH * 3, height: REGION_HEIGHT * 2 });
  const definitions = [
    ['docks', 'The Docks', 417, 0, 0], ['canal', 'Canal Row', 416, 1, 0],
    ['neon', 'Neon Mile', 417, 2, 0], ['brick', 'Brick Yards', 417, 0, 1],
    ['foundry', 'The Foundry', 417, 1, 1], ['cathedral', 'Cathedral Hill', 416, 2, 1]
  ];
  const point = (x, y) => Object.freeze({ x, y });
  const rect = (x, y, width, height) => Object.freeze({ x, y, width, height });
  const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
  const validPoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const validRect = r => validPoint(r) && Number.isFinite(r.width) && Number.isFinite(r.height) &&
    r.width > 0 && r.height > 0;
  const districts = Object.freeze(definitions.map(([id, name, capacity, column, row]) => {
    const x = column * REGION_WIDTH, y = row * REGION_HEIGHT;
    return Object.freeze({ id, name, capacity, bounds: rect(x, y, REGION_WIDTH, REGION_HEIGHT),
      origin: point(x + 800, y + 128), core: rect(x + 800, y + 128, 960, 640),
      spawn: point(x + 1280, y + 384) });
  }));
  const districtById = new Map(districts.map(district => [district.id, district]));
  const plots = Object.freeze(districts.flatMap(district => {
    const result = [], coreMargin = rect(district.core.x - 24, district.core.y - 24, 1008, 688);
    for (let row = 0; row < 24 && result.length < district.capacity; row++) {
      for (let column = 0; column < 24 && result.length < district.capacity; column++) {
        const building = rect(district.bounds.x + 128 + column * 96, district.bounds.y + 128 + row * 80, 72, 54);
        if (overlaps(building, coreMargin)) continue;
        const number = result.length + 1, id = district.id + '-' + String(number).padStart(4, '0');
        result.push(Object.freeze({ id, key: id, buildingId: id, districtId: district.id, number,
          building, entrance: point(building.x + building.width / 2, building.y + 68) }));
      }
    }
    return result;
  }));
  const plotById = new Map(plots.map(plot => [plot.id, plot]));

  // Queries and collision checks only inspect intersecting spatial buckets.
  function spatialIndex(items, boundsFor) {
    const buckets = new Map();
    function visit(bounds, callback) {
      const left = Math.max(0, Math.floor(bounds.x / BUCKET));
      const right = Math.min(Math.floor(world.width / BUCKET), Math.floor((bounds.x + bounds.width) / BUCKET));
      const top = Math.max(0, Math.floor(bounds.y / BUCKET));
      const bottom = Math.min(Math.floor(world.height / BUCKET), Math.floor((bounds.y + bounds.height) / BUCKET));
      for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) callback(y + ':' + x);
    }
    items.forEach((item, index) => visit(boundsFor(item), key => {
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(index);
    }));
    return bounds => {
      const found = new Set();
      visit(bounds, key => { for (const index of buckets.get(key) || []) found.add(index); });
      return Array.from(found, index => items[index]);
    };
  }
  const plotIndex = spatialIndex(plots, plot => plot.building);
  function nearPlots(bounds) {
    if (!validRect(bounds)) return [];
    return plotIndex(bounds).filter(plot => overlaps(plot.building, bounds));
  }
  function regionAt(x, y) {
    if (typeof x === 'object' && x) { y = x.y; x = x.x; }
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= world.width || y >= world.height) return null;
    return districts[Math.floor(y / REGION_HEIGHT) * 3 + Math.floor(x / REGION_WIDTH)];
  }

  const axis = (count, size, offsets) => Object.freeze(Array.from(new Set([
    32, count * size - 32,
    ...Array.from({ length: count - 1 }, (_, i) => (i + 1) * size),
    ...Array.from({ length: count }, (_, i) => offsets.map(offset => i * size + offset)).flat()
  ])).sort((a, b) => a - b));
  const streetX = axis(3, REGION_WIDTH, Array.from({ length: 25 }, (_, i) => 116 + i * 96));
  const streetY = axis(2, REGION_HEIGHT, [112, ...Array.from({ length: 25 }, (_, i) => 196 + i * 80)]);
  const roads = Object.freeze([
    ...streetX.map(x => Object.freeze({ ...rect(x - 12, 20, 24, world.height - 40), direction: 'vertical' })),
    ...streetY.map(y => Object.freeze({ ...rect(20, y - 12, world.width - 40, 24), direction: 'horizontal' }))
  ]);

  function heap() {
    const entries = [];
    return {
      get length() { return entries.length; },
      push(entry) {
        let index = entries.length;
        entries.push(entry);
        while (index > 0) {
          const parent = (index - 1) >> 1;
          if (entries[parent].score <= entry.score) break;
          entries[index] = entries[parent]; index = parent;
        }
        entries[index] = entry;
      },
      pop() {
        const first = entries[0], last = entries.pop();
        if (entries.length) {
          let index = 0;
          while (index * 2 + 1 < entries.length) {
            let child = index * 2 + 1;
            if (child + 1 < entries.length && entries[child + 1].score < entries[child].score) child++;
            if (entries[child].score >= last.score) break;
            entries[index] = entries[child]; index = child;
          }
          entries[index] = last;
        }
        return first;
      }
    };
  }
  const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  function search(origin, goal, neighbors, position, limit, onVisit) {
    const frontier = heap(), cost = new Map([[origin, 0]]), previous = new Map([[origin, -1]]), closed = new Set();
    frontier.push({ id: origin, score: distance(position(origin), position(goal)) });
    while (frontier.length && closed.size < limit) {
      const current = frontier.pop().id;
      if (closed.has(current)) continue;
      closed.add(current); onVisit();
      if (current === goal) {
        const result = [];
        for (let step = goal; step !== -1; step = previous.get(step)) result.push(position(step));
        return result.reverse();
      }
      for (const next of neighbors(current)) {
        if (closed.has(next)) continue;
        const nextCost = cost.get(current) + distance(position(current), position(next));
        if (nextCost >= (cost.get(next) ?? Infinity)) continue;
        cost.set(next, nextCost); previous.set(next, current);
        frontier.push({ id: next, score: nextCost + distance(position(next), position(goal)) });
      }
    }
    return [];
  }
  function compact(path) {
    const result = [];
    for (const p of path) {
      if (result.length && distance(result[result.length - 1], p) < 0.001) continue;
      while (result.length > 1) {
        const a = result[result.length - 2], b = result[result.length - 1];
        if (!((a.x === b.x && b.x === p.x && (b.y - a.y) * (p.y - b.y) >= 0) ||
          (a.y === b.y && b.y === p.y && (b.x - a.x) * (p.x - b.x) >= 0))) break;
        result.pop();
      }
      result.push({ x: p.x, y: p.y });
    }
    return result;
  }

  // Service buildings and district landmarks are supplied in global coordinates by the scene.
  // The fixed home footprints are always present, including plots outside loaded directory pages.
  function createNavigator(options = {}) {
    const extra = (Array.isArray(options.obstacles) ? options.obstacles : []).filter(validRect)
      .map(r => rect(r.x, r.y, r.width, r.height));
    const obstacles = [...plots.map(plot => plot.building), ...extra];
    const obstacleIndex = spatialIndex(obstacles, r => r);
    let graph = null, lastStats = { graphNodes: 0, graphVisited: 0, localVisited: 0, collisionChecks: 0 };
    function isWalkable(x, y) {
      if (typeof x === 'object' && x) { y = x.y; x = x.x; }
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 12 || x > world.width - 12 || y < 20 || y > world.height - 20) return false;
      const body = { x: x - RADIUS, y: y - RADIUS, width: RADIUS * 2, height: RADIUS * 2 };
      return !obstacleIndex(body).some(obstacle => { lastStats.collisionChecks++; return overlaps(body, obstacle); });
    }
    function segmentWalkable(a, b) {
      if (!isWalkable(a) || !isWalkable(b)) return false;
      if (a.x !== b.x && a.y !== b.y) return false;
      const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x), top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y);
      const swept = { x: left - RADIUS, y: top - RADIUS, width: right - left + RADIUS * 2, height: bottom - top + RADIUS * 2 };
      return !obstacleIndex(swept).some(obstacle => { lastStats.collisionChecks++; return overlaps(swept, obstacle); });
    }
    function elbow(a, b) {
      for (const corner of [{ x: a.x, y: b.y }, { x: b.x, y: a.y }]) {
        if (segmentWalkable(a, corner) && segmentWalkable(corner, b)) return compact([a, corner, b]);
      }
      return [];
    }
    function nearestWalkable(p) {
      if (!validPoint(p) || !regionAt(p)) return null;
      if (isWalkable(p)) return { x: p.x, y: p.y };
      for (let radius = 8; radius <= 160; radius += 8) {
        const candidates = [];
        for (let delta = -radius; delta <= radius; delta += 8) {
          candidates.push({ x: p.x + delta, y: p.y - radius }, { x: p.x + delta, y: p.y + radius },
            { x: p.x - radius, y: p.y + delta }, { x: p.x + radius, y: p.y + delta });
        }
        candidates.sort((a, b) => distance(p, a) - distance(p, b));
        const available = candidates.find(q => isWalkable(q));
        if (available) return available;
      }
      return null;
    }
    function localRoute(a, b) {
      const direct = elbow(a, b);
      if (direct.length) return direct;
      const cell = 16, left = Math.max(0, Math.floor((Math.min(a.x, b.x) - 160) / cell));
      const top = Math.max(0, Math.floor((Math.min(a.y, b.y) - 160) / cell));
      const right = Math.min(world.width / cell - 1, Math.ceil((Math.max(a.x, b.x) + 160) / cell));
      const bottom = Math.min(world.height / cell - 1, Math.ceil((Math.max(a.y, b.y) + 160) / cell));
      const columns = right - left + 1, rows = bottom - top + 1;
      if (columns * rows > 4096) return [];
      const position = id => ({ x: (left + id % columns) * cell + cell / 2, y: (top + Math.floor(id / columns)) * cell + cell / 2 });
      const walkCache = new Map();
      const walk = id => {
        if (!walkCache.has(id)) walkCache.set(id, isWalkable(position(id)));
        return walkCache.get(id);
      };
      function anchor(p) {
        const column = Math.floor(p.x / cell) - left, row = Math.floor(p.y / cell) - top, candidates = [];
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const x = column + dx, y = row + dy;
          if (x >= 0 && x < columns && y >= 0 && y < rows) candidates.push(y * columns + x);
        }
        candidates.sort((a, b) => distance(p, position(a)) - distance(p, position(b)));
        for (const id of candidates) {
          if (!walk(id)) continue;
          const path = elbow(p, position(id));
          if (path.length) return { id, path };
        }
        return null;
      }
      const origin = anchor(a), goal = anchor(b);
      if (!origin || !goal) return [];
      const neighbors = id => {
        const x = id % columns, y = Math.floor(id / columns), candidates = [];
        if (x) candidates.push(id - 1);
        if (x < columns - 1) candidates.push(id + 1);
        if (y) candidates.push(id - columns);
        if (y < rows - 1) candidates.push(id + columns);
        return candidates.filter(next => walk(next) && segmentWalkable(position(id), position(next)));
      };
      const path = search(origin.id, goal.id, neighbors, position, 4096, () => { lastStats.localVisited++; });
      return path.length ? compact([...origin.path, ...path, ...goal.path.slice().reverse()]) : [];
    }
    function streetGraph() {
      if (graph) return graph;
      const columns = streetX.length, rows = streetY.length;
      const nodes = Array.from({ length: columns * rows }, (_, id) => ({ x: streetX[id % columns], y: streetY[Math.floor(id / columns)] }));
      const walkable = nodes.map(p => isWalkable(p)), edges = nodes.map(() => []);
      for (let id = 0; id < nodes.length; id++) {
        if (!walkable[id]) continue;
        const candidates = [];
        if (id % columns < columns - 1) candidates.push(id + 1);
        if (id + columns < nodes.length) candidates.push(id + columns);
        for (const next of candidates) if (walkable[next] && segmentWalkable(nodes[id], nodes[next])) {
          edges[id].push(next); edges[next].push(id);
        }
      }
      graph = { columns, rows, nodes, edges, walkable };
      return graph;
    }
    function closestAxis(values, value) {
      let low = 0, high = values.length;
      while (low < high) {
        const middle = (low + high) >> 1;
        if (values[middle] < value) low = middle + 1; else high = middle;
      }
      return low;
    }
    function connect(p, streets) {
      const x = closestAxis(streetX, p.x), y = closestAxis(streetY, p.y), candidates = [];
      for (let row = Math.max(0, y - 3); row <= Math.min(streets.rows - 1, y + 2); row++) {
        for (let column = Math.max(0, x - 3); column <= Math.min(streets.columns - 1, x + 2); column++) {
          const id = row * streets.columns + column;
          if (streets.walkable[id] && streets.edges[id].length) candidates.push(id);
        }
      }
      candidates.sort((a, b) => distance(p, streets.nodes[a]) - distance(p, streets.nodes[b]));
      // Try direct connectors first so unusual service corners do not trigger repeated searches.
      for (const id of candidates) {
        const path = elbow(p, streets.nodes[id]);
        if (path.length) return { id, path };
      }
      for (const id of candidates.slice(0, 8)) {
        const path = localRoute(p, streets.nodes[id]);
        if (path.length) return { id, path };
      }
      return null;
    }
    function route(start, end) {
      lastStats = { graphNodes: graph?.nodes.length || 0, graphVisited: 0, localVisited: 0, collisionChecks: 0 };
      const a = nearestWalkable(start), b = nearestWalkable(end);
      if (!a || !b) return [];
      if (distance(a, b) <= 320) {
        const local = localRoute(a, b);
        if (local.length) return local;
      }
      const streets = streetGraph();
      lastStats.graphNodes = streets.nodes.length;
      const origin = connect(a, streets), goal = connect(b, streets);
      if (!origin || !goal) return [];
      const path = search(origin.id, goal.id, id => streets.edges[id], id => streets.nodes[id], streets.nodes.length,
        () => { lastStats.graphVisited++; });
      return path.length ? compact([...origin.path, ...path, ...goal.path.slice().reverse()]) : [];
    }
    return Object.freeze({ isWalkable, segmentWalkable, route, stats: () => ({ ...lastStats }) });
  }
  const navigator = createNavigator();
  root.CityWorldLayout = Object.freeze({
    metadata: Object.freeze({ version: 'continuous-city-v1', total: 2500, playerRadius: RADIUS, coordinateSpace: 'walking-world' }),
    version: 'continuous-city-v1', world, districts, plots, roads,
    getPlot: id => plotById.get(String(id || '')) || null,
    getDistrict: id => districtById.get(String(id || '')) || null,
    nearPlots, regionAt, createNavigator, isWalkable: navigator.isWalkable, route: navigator.route,
    segmentWalkable: navigator.segmentWalkable, stats: navigator.stats
  });
})(typeof window !== 'undefined' ? window : globalThis);
