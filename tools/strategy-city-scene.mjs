/* Original illustrative command-map geometry. District ownership comes only from the API. */
import * as THREE from 'three';

const DISTRICTS = [
  { id: 'foundry', x: -20, z: -10, bounds: [-28, -13, -20, 0], tint: '#8c8068' },
  { id: 'cathedral', x: -7, z: -11, bounds: [-13, 1.5, -20, 0], tint: '#aaa58b' },
  { id: 'neon', x: 18, z: -10, bounds: [9, 28, -20, 0], tint: '#797f76' },
  { id: 'brick', x: -20, z: 10, bounds: [-28, -13, 0, 20], tint: '#93806b' },
  { id: 'canal', x: -7, z: 10, bounds: [-13, 1.5, 0, 20], tint: '#8e9680' },
  { id: 'docks', x: 18, z: 10, bounds: [9, 28, 0, 20], tint: '#818777' },
];
const riverX = z => 5.15 + Math.sin(z * .125) * 1.7;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function random(seed = 17487) {
  return () => { seed = Math.imul(seed ^ seed >>> 15, 1 | seed); seed ^= seed + Math.imul(seed ^ seed >>> 7, 61 | seed); return ((seed ^ seed >>> 14) >>> 0) / 4294967296; };
}

function paintTexture(kind, emissive = false) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const rng = random(kind === 'wall' ? 91 : 47);
  ctx.fillStyle = emissive ? '#000000' : kind === 'wall' ? '#c4c0ac' : '#8e927c';
  ctx.fillRect(0, 0, 256, 256);
  if (kind === 'wall') {
    for (let y = 5; y < 256; y += 8) {
      if (!emissive) { ctx.fillStyle = '#8e917b44'; ctx.fillRect(0, y, 256, 1); }
    }
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      const x = 18 + col * 60, y = 14 + row * 62, lit = rng() > .5;
      if (!emissive) {
        ctx.fillStyle = '#70715f'; ctx.fillRect(x - 4, y - 4, 33, 43);
        ctx.fillStyle = lit ? '#b8a477' : '#343e37'; ctx.fillRect(x, y, 25, 34);
        ctx.fillStyle = '#d0c9ae'; ctx.fillRect(x - 5, y + 37, 35, 4);
        ctx.fillStyle = '#626a58'; ctx.fillRect(x + 11, y, 2, 34); ctx.fillRect(x, y + 15, 25, 2);
      } else if (lit) {
        ctx.fillStyle = '#dcb67b'; ctx.fillRect(x, y, 25, 34);
        ctx.fillStyle = '#111b16'; ctx.fillRect(x + 11, y, 2, 34); ctx.fillRect(x, y + 15, 25, 2);
      }
    }
  } else {
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = `rgba(${rng() > .5 ? '230,222,188' : '28,38,29'},${.04 + rng() * .14})`;
      ctx.fillRect(rng() * 256, rng() * 256, 1 + rng() * 3, 1 + rng() * 3);
    }
    ctx.strokeStyle = '#69735c44'; ctx.lineWidth = 1;
    for (let p = 0; p < 256; p += 16) { ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 256); ctx.stroke(); }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function riverStrip(leftOffset, rightOffset, zStart = -90, zEnd = 90, segments = 180) {
  const vertices = [], uv = [], indices = [];
  for (let index = 0; index <= segments; index++) {
    const z = zStart + (zEnd - zStart) * index / segments, x = riverX(z);
    vertices.push(x + leftOffset, 0, z, x + rightOffset, 0, z);
    uv.push(0, index / segments * 16, 1, index / segments * 16);
    if (index < segments) { const at = index * 2; indices.push(at, at + 2, at + 1, at + 1, at + 2, at + 3); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

function ownershipColor(record) {
  if (!record || record.state === 'unknown') return '#898e79';
  if (record.state === 'contested') return '#b28b6c';
  if (record.holder?.mine || record.state === 'mine') return '#c6b47d';
  if (record.occupier || record.state === 'occupied') return '#96786a';
  if (record.holder) {
    const key = String(record.holder.gangId || record.holder.tag || record.holder.name || '');
    const hash = [...key].reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0, 0);
    return ['#839a89', '#9a937f', '#929baf', '#aa8f7b'][hash % 4];
  }
  return '#909c80';
}

export async function createStrategyMap(host, { districts = [], selected = 'docks', onSelect, onLabels } = {}) {
  if (!host?.appendChild) throw new TypeError('The city renderer needs a host element.');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'strategy-city-canvas'; canvas.dataset.strategyRenderer = 'three'; canvas.dataset.threeRevision = THREE.REVISION;
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%', touchAction: 'pan-y', cursor: 'grab' });

  const scene = new THREE.Scene(); scene.background = new THREE.Color('#171f20');
  scene.fog = new THREE.FogExp2('#263131', .009);
  const camera = new THREE.OrthographicCamera(-35, 35, 24, -24, .1, 300);
  const target = new THREE.Vector3(0, 0, 0), cameraOffset = new THREE.Vector3(-47, 55, 58);
  const geometries = new Set(), materials = new Set(), textures = new Set(), districtSurfaces = [], districtBorders = [], selections = [];
  const buildings = [], roofs = [], pitchedRoofs = [], trims = [], details = [], lamps = [], leaves = [], trunks = [], streetSegments = [];
  const rng = random();
  const box = new THREE.BoxGeometry(1, 1, 1); geometries.add(box);
  const material = options => { const value = new THREE.MeshStandardMaterial(options); materials.add(value); return value; };
  const masonry = material({ color: '#8e917a', roughness: .96, metalness: .05 });
  const stone = material({ color: '#b5af91', roughness: .88 });
  const darkStone = material({ color: '#545e4b', roughness: .9 });
  const roofMaterial = material({ color: '#64705a', roughness: .86, metalness: .15 });
  const roadMaterial = material({ color: '#817858', roughness: .92 });
  const brass = material({ color: '#a28d5f', metalness: .55, roughness: .68 });
  const lampMaterial = material({ color: '#f0d6a2', emissive: '#f0be70', emissiveIntensity: 1.9, roughness: .6 });
  const roofTexture = paintTexture('roof'); textures.add(roofTexture); roofMaterial.map = roofTexture;
  const wallTexture = paintTexture('wall'), litTexture = paintTexture('wall', true); textures.add(wallTexture); textures.add(litTexture);
  const wallMaterial = material({ color: '#d6c8a5', map: wallTexture, emissiveMap: litTexture, emissive: '#dcb783', emissiveIntensity: .68, roughness: .92 });
  const facadeMaterials = [wallMaterial, wallMaterial, roofMaterial, masonry, wallMaterial, wallMaterial];
  const city = new THREE.Group(); scene.add(city);
  const mesh = (geometry, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const value = new THREE.Mesh(geometry, mat); value.position.set(x, y, z); value.scale.set(sx, sy, sz); value.castShadow = true; value.receiveShadow = true; city.add(value); return value;
  };
  const block = (mat, x, y, z, sx, sy, sz) => mesh(box, mat, x, y, z, sx, sy, sz);
  const groundGeometry = new THREE.PlaneGeometry(220, 220); geometries.add(groundGeometry);
  const groundTexture = paintTexture('ground'); textures.add(groundTexture); groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping; groundTexture.repeat.set(65, 65);
  const ground = mesh(groundGeometry, material({ color: '#414a43', map: groundTexture, roughness: 1 }), 0, -.18, 0);
  ground.rotation.x = -Math.PI / 2; ground.castShadow = false;

  const riverMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uTrade: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vWorld; void main(){vUv=uv; vWorld=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv; varying vec3 vWorld; uniform float uTime; uniform float uTrade;
      void main(){
        float wave=sin(vWorld.z*3.1+vWorld.x*5.8-uTime*.46)*.5+.5;
        float fine=pow(max(0.,sin(vWorld.z*2.2+sin(vWorld.x*3.+uTime*.2))*sin(vWorld.z*9.+vWorld.x*4.4-uTime*.45)),8.);
        float edge=smoothstep(.02,.2,vUv.x)*smoothstep(.02,.2,1.-vUv.x);
        vec3 deep=mix(vec3(.012,.033,.036),vec3(.034,.074,.072),wave*.32);
        deep+=vec3(.08,.095,.075)*fine*.18; deep+=vec3(.05,.07,.06)*(1.-edge)*.2;
        gl_FragColor=vec4(deep+vec3(.006,.012,.011)*uTrade,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide,
  });
  materials.add(riverMaterial);
  const riverGeometry = riverStrip(-2.35, 2.35); geometries.add(riverGeometry);
  const river = mesh(riverGeometry, riverMaterial, 0, -.08, 0); river.castShadow = river.receiveShadow = false;
  for (const side of [-1, 1]) {
    const quayGeometry = riverStrip(side < 0 ? -2.7 : 2.35, side < 0 ? -2.35 : 2.7); geometries.add(quayGeometry);
    const quay = mesh(quayGeometry, stone, 0, -.025, 0); quay.castShadow = false;
  }

  const districtFor = (x, z) => x < -13 ? z < 0 ? 'foundry' : 'brick' : x < riverX(z) ? z < 0 ? 'cathedral' : 'canal' : z < 0 ? 'neon' : 'docks';
  const districtColors = Object.fromEntries(DISTRICTS.map(item => [item.id, new THREE.Color(item.tint)]));
  const nearLandmark = (x, z) => [[-6, -10, 3.2], [-21, -11, 3], [18, -10, 2.8], [-7, 9, 2.8]].some(([cx, cz, radius]) => Math.hypot(x - cx, z - cz) < radius);
  for (let row = 0; row < 12; row++) for (let column = 0; column < 17; column++) {
    const x = -25.6 + column * 3.2, z = -17.6 + row * 3.2;
    if (Math.abs(x - riverX(z)) < 4.0) continue;
    const district = districtFor(x, z), tint = districtColors[district];
    if (nearLandmark(x, z)) continue;
    trims.push({ x, y: -.04, z, sx: 2.85, sy: .16, sz: 2.85, color: '#7a7f66' });
    for (const offset of [-.64, .64]) {
      const bx = x + offset, bz = z + (rng() - .5) * .25;
      const height = district === 'neon' ? 1.7 + rng() * 4.5 : district === 'docks' || district === 'foundry' ? 1.05 + rng() * 1.8 : 1.5 + rng() * 2.3;
      const sx = 1.01 + rng() * .17, sz = 1.95 + rng() * .4;
      const color = tint.clone().multiplyScalar(.88 + rng() * .3);
      buildings.push({ x: bx, y: height / 2, z: bz, sx, sy: height, sz, color, district });
      const pitched = district !== 'neon' && district !== 'foundry' && rng() > .66;
      roofs.push({ x: bx, y: height + .085, z: bz, sx: sx + .12, sy: .17, sz: sz + .12, color: new THREE.Color('#69725e').multiplyScalar(.75 + rng() * .4) });
      if (pitched) pitchedRoofs.push({ x: bx, y: height + .42, z: bz, sx: (sx + .14) / Math.sqrt(2), sy: .72, sz: (sz + .14) / Math.sqrt(2), angle: Math.PI / 4, color: new THREE.Color('#697063').multiplyScalar(.72 + rng() * .4) });
      if (rng() > .3) details.push({ x: bx + (rng() - .5) * .5, y: height + .34, z: bz, sx: .45 + rng() * .2, sy: .35, sz: .55, color: '#6e7560' });
      if (rng() > .43) details.push({ x: bx + .25, y: height + .48, z: bz + .45, sx: .16, sy: .8, sz: .18, color: '#595e4c' });
      if (district !== 'docks' && rng() > .64) {
        const corniceHeight = height * .78;
        trims.push({ x: bx, y: corniceHeight, z: bz, sx: sx + .055, sy: .065, sz: sz + .055, color: '#aaa389' });
      }
    }
    if ((row + column) % 3 === 0) {
      lamps.push({ x: x - 1.45, y: 1.06, z: z + 1.44, sx: .065, sy: 2.1, sz: .065 });
      details.push({ x: x - 1.45, y: .13, z: z + 1.44, sx: .23, sy: .24, sz: .23, color: '#4a5142' });
    }
  }
  // Streets form continuous blocks instead of disconnected display plinths.
  for (let row = 0; row <= 12; row++) {
    const z = -19.2 + row * 3.2, edge = riverX(z);
    streetSegments.push({ x: (-28 + edge - 2.8) / 2, y: -.025, z, sx: edge + 25.2, sy: .035, sz: row % 3 === 0 ? .45 : .29 });
    streetSegments.push({ x: (edge + 2.8 + 28) / 2, y: -.025, z, sx: 25.2 - edge, sy: .035, sz: row % 3 === 0 ? .45 : .29 });
  }
  for (let column = 0; column <= 17; column++) {
    const x = -27.2 + column * 3.2;
    if (x > 1 && x < 10) continue;
    streetSegments.push({ x, y: -.02, z: 0, sx: column % 4 === 0 ? .46 : .28, sy: .04, sz: 40 });
  }

  const dummy = new THREE.Object3D();
  function instances(items, geometry, mat, shadows = true) {
    const value = new THREE.InstancedMesh(geometry, mat, items.length);
    items.forEach((item, index) => {
      dummy.position.set(item.x, item.y, item.z); dummy.rotation.set(0, item.angle || 0, 0); dummy.scale.set(item.sx, item.sy, item.sz); dummy.updateMatrix();
      value.setMatrixAt(index, dummy.matrix);
      if (item.color) value.setColorAt(index, new THREE.Color(item.color));
    });
    value.instanceMatrix.needsUpdate = true;
    if (value.instanceColor) value.instanceColor.needsUpdate = true;
    value.castShadow = shadows; value.receiveShadow = true; city.add(value); return value;
  }
  instances(streetSegments, box, roadMaterial, false);
  instances(trims, box, masonry);
  const buildingMesh = instances(buildings, box, facadeMaterials);
  instances(roofs, box, roofMaterial); instances(details, box, darkStone);
  const pitchedGeometry = new THREE.ConeGeometry(1, 1, 4); geometries.add(pitchedGeometry);
  instances(pitchedRoofs, pitchedGeometry, roofMaterial);
  instances(lamps, box, brass);
  instances(lamps.map(item => ({ ...item, y: 2.16, sx: .19, sy: .22, sz: .19 })), box, lampMaterial, false);

  function bridge(z, width) {
    const x = riverX(z), half = 3.45;
    block(stone, x, .81, z, half * 2 + .65, .24, width);
    block(darkStone, x, .96, z, half * 2 + .7, .07, width - .2);
    for (const side of [-1, 1]) {
      block(stone, x, 1.21, z + side * width / 2, half * 2 + .7, .6, .14);
      for (let index = 0; index < 16; index++) block(darkStone, x - half + index * (half * 2 / 15), 1.25, z + side * width / 2, .09, .27, .17);
      const arch = new THREE.Shape();
      arch.moveTo(-half, .68); arch.lineTo(half, .68); arch.lineTo(half, -.1); arch.lineTo(2.5, -.1);
      for (let i = 0; i <= 20; i++) { const t = i / 20 * Math.PI; arch.lineTo(Math.cos(t) * 2.5, -.1 + Math.sin(t) * .63); }
      arch.lineTo(-half, -.1); arch.closePath();
      const geometry = new THREE.ExtrudeGeometry(arch, { depth: .22, bevelEnabled: false }); geometries.add(geometry);
      mesh(geometry, masonry, x, 0, z + side * (width / 2 - .05));
    }
  }
  bridge(-11.2, 1.35); bridge(1.6, 1.65); bridge(14.4, 1.3);

  // Cathedral: an actual nave, buttresses and paired towers, with the spire above the ward.
  const coneGeometry = new THREE.ConeGeometry(1, 1, 4); geometries.add(coneGeometry);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 12); geometries.add(cylinderGeometry);
  block(stone, -6, 1.55, -10, 2.5, 3.1, 4.9);
  const naveRoof = mesh(coneGeometry, roofMaterial, -6, 3.7, -10, 1.88, 1.8, 3.55); naveRoof.rotation.y = Math.PI / 4;
  for (const x of [-7.35, -4.65]) {
    block(stone, x, 2.3, -7.65, .9, 4.6, .95);
    mesh(coneGeometry, roofMaterial, x, 5.5, -7.65, .8, 2.3, .8);
    for (let z = -11.8; z < -7; z += 1.2) block(stone, x, 1.2, z, .32, 2.4, .42);
  }
  block(stone, -6, 3.8, -11.5, 1.05, 4.5, 1.05);
  mesh(coneGeometry, brass, -6, 7.2, -11.5, 1.1, 2.8, 1.1);
  block(brass, -6, 8.9, -11.5, .09, .8, .09); block(brass, -6, 9, -11.5, .48, .07, .07);

  // Foundry yards have lower sheds, brick chimneys, roof vents, and a furnace glow.
  block(darkStone, -21, 1.0, -11, 4.1, 2, 3.8);
  for (let index = 0; index < 3; index++) {
    const x = -22.4 + index * 1.4;
    const roof = mesh(coneGeometry, roofMaterial, x, 2.4, -11, 1.05, 1.1, 2.8); roof.rotation.y = Math.PI / 4;
    mesh(cylinderGeometry, masonry, x, 3.4 + index * .1, -12.1, .3, 6.7 + index * .2, .3);
    mesh(cylinderGeometry, darkStone, x, 6.85 + index * .2, -12.1, .4, .22, .4);
    block(lampMaterial, x, .8, -9.05, .55, .9, .03);
  }
  // Art-deco setbacks keep the downtown skyline recognizably urban.
  block(masonry, 18, 2.9, -10, 3.1, 5.8, 3.4);
  block(stone, 18, 6.6, -10, 2.3, 1.7, 2.6);
  block(roofMaterial, 18, 7.8, -10, 1.5, .7, 1.8);
  block(brass, 18, 8.7, -10, .12, 1.2, .12);
  for (let level = 1; level < 6; level++) for (let col = -1; col <= 1; col++) block(lampMaterial, 18 + col * .75, level * .8, -8.285, .25, .4, .035);

  // Canal gardens soften the density; these are scene architecture, never gameplay assets.
  block(darkStone, -7, .02, 9, 4.3, .12, 4.3);
  const fountain = mesh(cylinderGeometry, stone, -7, .18, 9, 1.12, .3, 1.12);
  mesh(cylinderGeometry, brass, -7, .69, 9, .12, .95, .12);
  const leafGeometry = new THREE.SphereGeometry(1, 6, 5); geometries.add(leafGeometry);
  for (const [x, z] of [[-8.7, 7.3], [-5.3, 7.3], [-8.7, 10.7], [-5.3, 10.7], [-24, 17], [-15, -17], [23, -16], [14, 17]]) {
    trunks.push({ x, y: .65, z, sx: .15, sy: 1.3, sz: .15 });
    leaves.push({ x, y: 1.5, z, sx: .65, sy: 1.05, sz: .65, color: new THREE.Color('#626f48').multiplyScalar(.85 + rng() * .3) });
  }
  instances(trunks, box, darkStone); instances(leaves, leafGeometry, material({ color: '#8a9363', roughness: 1 }));

  // Waterfront piers and barges follow the river, without implying transport or trade volume.
  for (const z of [6.5, 10, 17]) {
    const edge = riverX(z) + 2.6;
    block(darkStone, edge - .9, .03, z, 2.3, .24, .7);
    for (const dx of [-1.7, -.5]) for (const dz of [-.25, .25]) block(masonry, edge + dx, -.05, z + dz, .12, .8, .12);
    block(masonry, edge + 1.2, .3, z + .7, .55, .55, .55);
  }
  for (const [z, side] of [[-3, -1], [8, 1], [18, -.6]]) {
    const x = riverX(z) + side * .65;
    block(darkStone, x, .16, z, .65, .32, 2.3); block(masonry, x, .45, z + .65, .5, .45, .65);
    block(brass, x, .45, z - .45, .42, .3, .85);
  }

  const borderY = .145, records = new Map(districts.map(item => [item.id, item]));
  for (const definition of DISTRICTS) {
    const [left, right, top, bottom] = definition.bounds;
    const shape = new THREE.Shape(); shape.moveTo(left, top); shape.lineTo(right, top); shape.lineTo(right, bottom); shape.lineTo(left, bottom); shape.closePath();
    const fillGeometry = new THREE.ShapeGeometry(shape); fillGeometry.rotateX(-Math.PI / 2); geometries.add(fillGeometry);
    const fillMaterial = new THREE.MeshBasicMaterial({ color: ownershipColor(records.get(definition.id)), transparent: true, opacity: .055, depthWrite: false, side: THREE.DoubleSide }); materials.add(fillMaterial);
    const surface = mesh(fillGeometry, fillMaterial, 0, .04, 0); surface.castShadow = surface.receiveShadow = false; surface.userData.district = definition.id; districtSurfaces.push(surface); selections.push(surface);
    // ShapeGeometry uses the shape's y as negative z after rotation; keep the world bounds literal.
    surface.scale.z = -1;
    const points = [[left, top], [right, top], [right, bottom], [left, bottom], [left, top]].map(([x, z]) => new THREE.Vector3(x, borderY, z));
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points); geometries.add(lineGeometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: '#b7ad84', transparent: true, opacity: .35 }); materials.add(lineMaterial);
    const line = new THREE.Line(lineGeometry, lineMaterial); line.userData.district = definition.id; city.add(line); districtBorders.push(line);
  }

  const hemisphere = new THREE.HemisphereLight('#ccd6d3', '#2e3b35', 2.3); scene.add(hemisphere);
  const sun = new THREE.DirectionalLight('#ffe2b4', 3.1); sun.position.set(-26, 45, -12); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 110; sun.shadow.bias = -.0003; sun.shadow.normalBias = .08; sun.shadow.radius = 2;
  scene.add(sun, new THREE.AmbientLight('#a3b2a8', .4));

  let destroyed = false, contextLost = false, labelsDirty = true, mode = 'districts', zoom = 1, width = 1, height = 1, dragging = null, frame = 0, visible = true, lastTime = 0;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = new THREE.Vector2(), raycaster = new THREE.Raycaster();
  const cameraRight = new THREE.Vector3(.777, 0, .63), cameraUpGround = new THREE.Vector3(-.63, 0, .777);

  function reportLabels() {
    if (!labelsDirty || typeof onLabels !== 'function') return;
    labelsDirty = false;
    onLabels(DISTRICTS.map(item => {
      const value = new THREE.Vector3(item.x, 2.5, item.z).project(camera);
      return { id: item.id, x: (value.x + 1) * 50, y: (1 - value.y) * 50 };
    }));
  }
  function render() {
    if (destroyed || contextLost) return;
    camera.position.copy(target).add(cameraOffset); camera.lookAt(target); camera.updateMatrixWorld(); renderer.render(scene, camera); reportLabels();
  }
  function updateEmphasis() {
    for (const surface of districtSurfaces) {
      const id = surface.userData.district, record = records.get(id);
      surface.material.color.set(ownershipColor(record));
      surface.material.opacity = id === selected ? mode === 'influence' ? .25 : .14 : mode === 'influence' ? .17 : .035;
    }
    for (const line of districtBorders) {
      const id = line.userData.district;
      line.material.color.set(id === selected ? '#ead3a0' : mode === 'influence' ? ownershipColor(records.get(id)) : '#a8a17e');
      line.material.opacity = id === selected ? .95 : mode === 'influence' ? .7 : .25;
    }
    roadMaterial.color.set(mode === 'trade' ? '#b69e66' : '#817858');
    riverMaterial.uniforms.uTrade.value = mode === 'trade' ? 1 : 0;
    render();
  }
  function resize() {
    if (destroyed) return;
    const rect = host.getBoundingClientRect(); width = Math.max(1, Math.round(rect.width)); height = Math.max(1, Math.round(rect.height));
    const aspect = width / height, viewHeight = Math.max(48, 66 / aspect);
    camera.left = -viewHeight * aspect / 2; camera.right = viewHeight * aspect / 2; camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2; camera.zoom = zoom; camera.updateProjectionMatrix();
    renderer.setSize(width, height, false); labelsDirty = true; render();
  }
  function stopAnimation() { if (frame) cancelAnimationFrame(frame); frame = 0; }
  function animate(time) {
    frame = 0;
    if (destroyed || contextLost || !visible || document.hidden || reduceMotion.matches) return;
    if (time - lastTime > 80) { riverMaterial.uniforms.uTime.value = time / 1000; render(); lastTime = time; }
    frame = requestAnimationFrame(animate);
  }
  function syncAnimation() {
    stopAnimation(); if (!destroyed && !contextLost && visible && !document.hidden && !reduceMotion.matches) frame = requestAnimationFrame(animate);
  }
  function zoomBy(amount) { zoom = clamp(zoom + Number(amount || 0), .7, 1.8); resize(); }
  function reset() { zoom = 1; target.set(0, 0, 0); resize(); }
  function select(id) { if (!DISTRICTS.some(item => item.id === id)) return; selected = id; updateEmphasis(); }
  function setMode(next) { mode = ['districts', 'influence', 'trade'].includes(String(next).toLowerCase()) ? String(next).toLowerCase() : 'districts'; canvas.dataset.mapMode = mode; updateEmphasis(); }

  const onPointerDown = event => {
    if (event.button !== 0) return;
    dragging = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false, pointer: event.pointerId };
    canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing';
  };
  const onPointerMove = event => {
    if (!dragging || dragging.pointer !== event.pointerId) return;
    const dx = event.clientX - dragging.lastX, dy = event.clientY - dragging.lastY;
    if (Math.hypot(event.clientX - dragging.x, event.clientY - dragging.y) > 5) dragging.moved = true;
    if (dragging.moved) {
      const scale = (camera.right - camera.left) / width / zoom;
      target.addScaledVector(cameraRight, -dx * scale).addScaledVector(cameraUpGround, dy * scale * 1.25);
      target.x = clamp(target.x, -14, 14); target.z = clamp(target.z, -12, 12); labelsDirty = true; render();
    }
    dragging.lastX = event.clientX; dragging.lastY = event.clientY;
  };
  const onPointerUp = event => {
    if (!dragging || dragging.pointer !== event.pointerId) return;
    if (!dragging.moved) {
      const rect = canvas.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const building = raycaster.intersectObject(buildingMesh)[0];
      let id = building?.instanceId !== undefined ? buildings[building.instanceId]?.district : null;
      if (!id) id = raycaster.intersectObjects(selections)[0]?.object.userData.district;
      if (id) { select(id); onSelect?.(id); }
    }
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    dragging = null; canvas.style.cursor = 'grab';
  };
  const onPointerCancel = () => { dragging = null; canvas.style.cursor = 'grab'; };
  const onWheel = event => { if (event.ctrlKey || event.metaKey) return; event.preventDefault(); zoomBy(-Math.sign(event.deltaY) * .08); };
  const onContextLost = event => { event.preventDefault(); contextLost = true; stopAnimation(); host.dataset.strategyRenderer = 'lost'; canvas.style.visibility = 'hidden'; };
  const onContextRestored = () => { if (destroyed) return; contextLost = false; canvas.style.visibility = ''; host.dataset.strategyRenderer = 'ready'; resize(); syncAnimation(); };
  canvas.addEventListener('pointerdown', onPointerDown); canvas.addEventListener('pointermove', onPointerMove); canvas.addEventListener('pointerup', onPointerUp); canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('wheel', onWheel, { passive: false }); canvas.addEventListener('webglcontextlost', onContextLost); canvas.addEventListener('webglcontextrestored', onContextRestored);
  document.addEventListener('visibilitychange', syncAnimation); reduceMotion.addEventListener('change', syncAnimation);
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const intersectionObserver = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting !== false; syncAnimation(); }, { threshold: .01 }); intersectionObserver.observe(host);
  function destroy() {
    if (destroyed) return; destroyed = true; stopAnimation(); resizeObserver.disconnect(); intersectionObserver.disconnect();
    document.removeEventListener('visibilitychange', syncAnimation); reduceMotion.removeEventListener('change', syncAnimation);
    canvas.removeEventListener('pointerdown', onPointerDown); canvas.removeEventListener('pointermove', onPointerMove); canvas.removeEventListener('pointerup', onPointerUp); canvas.removeEventListener('pointercancel', onPointerCancel);
    canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('webglcontextlost', onContextLost); canvas.removeEventListener('webglcontextrestored', onContextRestored);
    for (const value of geometries) value.dispose(); for (const value of materials) value.dispose(); for (const value of textures) value.dispose();
    scene.traverse(value => { if (value.isInstancedMesh) value.dispose(); });
    renderer.renderLists.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); delete host.dataset.strategyRenderer;
  }
  try {
    host.append(canvas); host.dataset.strategyRenderer = 'ready'; canvas.dataset.buildings = String(buildings.length); canvas.dataset.mapMode = mode;
    updateEmphasis(); resize(); syncAnimation();
  } catch (error) { destroy(); throw error; }
  return { select, setMode, resize, zoom: zoomBy, reset, destroy };
}
