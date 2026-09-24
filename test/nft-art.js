// Art identity, public-state boundaries and embedded-asset integrity.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { portraitArtwork, portraitArtFilename, deedArtFilename, paintedDeedSvg } from '../src/nft-art.js';
import { portraitSvg, portraitStateOf, portraitTraits } from '../src/portrait.js';
import { deedPlateSvg, deedPage } from '../src/deeds.js';
import { NFT_ART_JOBS, NFT_MODEL, NFT_PORTRAIT_MODEL, nftArtCost } from '../tools/nft-art-prompts.js';

assert.equal(NFT_PORTRAIT_MODEL, 'fal-ai/flux-2/klein/4b');
assert.equal(NFT_MODEL, 'fal-ai/flux-2-pro');
assert.equal(nftArtCost(NFT_PORTRAIT_MODEL, { width: 1024, height: 1024 }), 0.005);
assert.equal(nftArtCost(NFT_MODEL, { width: 1024, height: 768 }), 0.03);
assert.equal(nftArtCost(NFT_PORTRAIT_MODEL, { width: 2048, height: 1024 }), 0.01);
assert.equal(nftArtCost(NFT_MODEL, { width: 2048, height: 1024 }), 0.045);
assert.throws(() => nftArtCost('unknown', { width: 1024, height: 1024 }));
for (const recipe of NFT_ART_JOBS)
  assert.equal(recipe.model, recipe.id.startsWith('portrait-') ? NFT_PORTRAIT_MODEL : NFT_MODEL);

const root = new URL('../public/art/nft/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', root), 'utf8'));
for (const recipe of NFT_ART_JOBS) {
  const entry = manifest.jobs[recipe.id];
  assert.equal(entry?.status, 'downloaded', `missing generated plate ${recipe.id}`);
  const image = fs.readFileSync(new URL(recipe.id + '.jpg', root));
  assert.equal(createHash('sha256').update(image).digest('hex'), entry.sha256, 'committed art matches its provenance');
  assert.ok(image.length <= 2 * 1024 * 1024, 'each image fits the renderer bound');
}

const state = portraitStateOf({ id: 'nft-art-test', name: 'The Night Clerk', generation: 3, level: 30 });
const art = portraitArtwork(state.seed);
assert.ok(art?.image.startsWith('data:image/jpeg;base64,'));
assert.equal(portraitSvg(state), portraitSvg(state), 'the same identity is stable');
const impressions = new Set();
const seals = new Set();
for (let i = 0; i < 1000; i++) {
  const s = portraitStateOf({ id: `nft-identity-${i}`, name: 'Same Name' });
  const svg = portraitSvg(s);
  seals.add(svg.match(/data-identity-seal="([a-f0-9]{64})"/)[1]);
  // Crop geometry and illumination vary even when names and source paintings repeat.
  impressions.add(createHash('sha256').update(svg.match(/<image[^>]+>/)[0]
    + svg.match(/<linearGradient id="l[^>]+>[\s\S]*?<\/linearGradient>/)[0].replace(/id="[^"]+"/, '')).digest('hex'));
}
assert.equal(seals.size, 1000, 'each sampled character carries its own full identity seal');
assert.ok(impressions.size > 980, 'visual variation goes beyond changing a caption');
const traits = portraitTraits(state);
assert.ok(traits.some((t) => t.trait_type === 'Art Plate' && t.value === art.label));
assert.ok(!traits.some((t) => ['Corner', 'Bearing'].includes(t.trait_type)), 'painted art does not claim procedural traits');
assert.equal(portraitSvg(portraitStateOf({ ...state, id: state.seed, loc: 'neon', rat: true, cash: 999999, muscle: 999 })),
  portraitSvg(portraitStateOf({ ...state, id: state.seed })), 'private state does not affect public art');
const notorious = portraitSvg(portraitStateOf({ id: 'flags', name: '<script>bad</script>', wanted: true, welsher: true, alive: false }));
assert.ok(notorious.includes('WANTED') && notorious.includes('WELSHER') && notorious.includes('IN MEMORIAM'));
assert.ok(!notorious.includes('<script>'));
assert.ok(!/<(?:script|foreignObject)|href="https?:/i.test(notorious), 'SVG is inert and self-contained');

const d = { name: 'Mercy Wharf', district: 'docks', districtName: 'The Docks', rank: 'Storied' };
const deed = deedPlateSvg(d);
assert.ok(deed.includes('data:image/jpeg;base64,'));
assert.equal(deed, deedPlateSvg(d));
assert.notEqual(deed, deedPlateSvg({ ...d, name: 'Midnight Wharf' }));
assert.notEqual(deed, deedPlateSvg({ ...d, rank: 'Legendary' }));
assert.equal(deedArtFilename('  MERCY   WHARF  '), deedArtFilename('Mercy Wharf'));
assert.match(portraitArtFilename('../../.env'), /^portrait-[a-f0-9]{64}\.jpg$/);
assert.match(deedArtFilename('../../.env'), /^deed-[a-f0-9]{64}\.jpg$/);
assert.equal(paintedDeedSvg({ name: 'No district', district: '../../.env' }), null, 'unknown/missing artwork falls back');
assert.ok(deedPlateSvg({ name: '<script>bad</script>' }).startsWith('<svg'), 'fallback remains an image');
assert.ok(!deedPlateSvg({ name: '<script>bad</script>', district: 'docks' }).includes('<script>'));
assert.ok(deedPage(d).includes('data:image/jpeg;base64,'), 'public deed page shows the collectible');

// Exercise the actual marketplace image and legend routes, not just the preview generator.
const { buildServer } = await import('../src/server.js');
const app = await buildServer();
try {
  await app.pool.query("INSERT INTO accounts (id, auth_provider, auth_subject) VALUES ('nft-art-account','guest','nft-art-subject')");
  await app.pool.query(`INSERT INTO street_deeds (account_id, name, name_lc, district, onchain_token_id)
    VALUES ('nft-art-account','Mercy Wharf','mercy wharf','docks','900001')`);
  const plate = await app.inject({ method: 'GET', url: '/v1/deeds/plate/900001.svg' });
  assert.equal(plate.statusCode, 200);
  assert.match(plate.headers['content-type'], /image\/svg\+xml/);
  assert.ok(plate.body.includes('data:image/jpeg;base64,') && plate.body.includes('Mercy Wharf'));
  const page = await app.inject({ method: 'GET', url: '/deed/900001' });
  assert.equal(page.statusCode, 200);
  assert.ok(page.body.includes('data:image/jpeg;base64,') && page.body.includes('name="viewport"'));
  const missing = await app.inject({ method: 'GET', url: '/v1/deeds/plate/999999.svg' });
  assert.equal(missing.statusCode, 200);
  assert.ok(missing.body.includes('A Street of the City'), 'missing tokens still show the house plate');
  assert.equal(Number((await app.pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n), 0);
} finally { await app.close(); }
console.log('NFT art: 18 provenance-checked plates; stable visual identity, privacy, safe SVG, marketplace routes and fallbacks pass.');
