// Local, self-contained NFT artwork. fal is used when commissioning the plates, never on reads.
// The starter paintings are a finite library; each collectible adds its own SHA-256 cipher seal,
// crop, lighting and public game state. An individually commissioned painting takes precedence.
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { esc } from './cards.js';

const ART_ROOT = new URL('../public/art/nft/', import.meta.url);
const PORTRAIT_COUNT = 12; // Pin this count: adding a plate must not reshuffle existing faces.
const DISTRICTS = ['docks', 'neon', 'foundry', 'brick', 'canal', 'cathedral'];
const CACHE_LIMIT = 64;
const MAX_PLATE_BYTES = 2 * 1024 * 1024;
const assetCache = new Map();
const sha256 = (value) => createHash('sha256').update(String(value), 'utf8').digest('hex');
const clamp = (value, length) => {
  const chars = Array.from(String(value || ''));
  return chars.length > length ? chars.slice(0, length - 1).join('') + '…' : chars.join('');
};

export const canonicalDeedName = (name) => String(name || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
export const portraitArtFilename = (seed) => `portrait-${sha256(String(seed ?? ''))}.jpg`;
export const deedArtFilename = (name) => `deed-${sha256(canonicalDeedName(name))}.jpg`;

// The only filenames accepted are fixed library plates or a computed digest. No caller path, URL,
// network request, secret, or game-private field can reach this loader. Cache misses expire so a
// commissioned file becomes visible without a restart; positive entries are immutable for a run.
function localPlate(filename) {
  if (!/^(?:portrait-(?:0[0-9]|1[01]|[a-f0-9]{64})|deed-(?:docks|neon|foundry|brick|canal|cathedral|[a-f0-9]{64}))\.jpg$/.test(filename)) return null;
  const cached = assetCache.get(filename);
  if (cached && (cached.image || cached.until > Date.now())) {
    assetCache.delete(filename);
    assetCache.set(filename, cached);
    return cached.image;
  }
  let image = null;
  try {
    const path = new URL(filename, ART_ROOT);
    const stat = statSync(path);
    if (stat.isFile() && stat.size > 3 && stat.size <= MAX_PLATE_BYTES) {
      const bytes = readFileSync(path);
      if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
        image = 'data:image/jpeg;base64,' + bytes.toString('base64');
    }
  } catch { /* Missing/unreadable art keeps the procedural fallback available. */ }
  assetCache.delete(filename);
  assetCache.set(filename, { image, until: Date.now() + 30_000 });
  while (assetCache.size > CACHE_LIMIT) assetCache.delete(assetCache.keys().next().value);
  return image;
}

export function portraitArtwork(seed) {
  const digest = sha256(`omerta:identity:v1:${String(seed ?? '')}`);
  const commissioned = localPlate(portraitArtFilename(seed));
  const plate = parseInt(digest.slice(0, 8), 16) % PORTRAIT_COUNT;
  const image = commissioned || localPlate(`portrait-${String(plate).padStart(2, '0')}.jpg`);
  return image ? { image, digest, label: commissioned ? 'Commissioned portrait' : `Noir study ${String(plate + 1).padStart(2, '0')}` } : null;
}

function deedArtwork(name, district) {
  const digest = sha256(`omerta:deed:v1:${canonicalDeedName(name)}`);
  const image = localPlate(deedArtFilename(name))
    || (DISTRICTS.includes(district) ? localPlate(`deed-${district}.jpg`) : null);
  return image ? { image, digest } : null;
}

// All 256 digest bits appear in the cipher: the repeated paintings never imply a repeated seal.
// This is an identity ornament, not a rarity score or a representation of the game's city map.
function cipherSeal(digest, x, y, size, ink) {
  const step = size / 20;
  const marks = [];
  for (let i = 0; i < 256; i++) {
    const bit = (parseInt(digest[Math.floor(i / 4)], 16) >> (3 - i % 4)) & 1;
    if (bit) marks.push(`<rect x="${(x + (i % 16 + 2) * step).toFixed(2)}" y="${(y + (Math.floor(i / 16) + 2) * step).toFixed(2)}" width="${(step * 0.72).toFixed(2)}" height="${(step * 0.72).toFixed(2)}"/>`);
  }
  return `<g fill="${ink}" data-identity-seal="${digest}"><title>Identity cipher ${digest}</title>`
    + `<path d="M${x} ${y + size * 0.3}V${y}H${x + size * 0.3} M${x + size * 0.7} ${y}H${x + size}V${y + size * 0.3} M${x + size} ${y + size * 0.7}V${y + size}H${x + size * 0.7} M${x + size * 0.3} ${y + size}H${x}V${y + size * 0.7}" fill="none" stroke="${ink}" stroke-width="1"/>`
    + marks.join('') + '</g>';
}

function decoCorners(width, height, ink, depth = 1) {
  const corner = Array.from({ length: depth }, (_, i) => {
    const n = 14 + i * 5, reach = 45 + i * 8;
    return `<path d="M${n} ${reach}V${n}H${reach}"/>`;
  }).join('');
  return `<g fill="none" stroke="${ink}" stroke-width="1.5">${corner}`
    + `<g transform="translate(${width} 0) scale(-1 1)">${corner}</g>`
    + `<g transform="translate(0 ${height}) scale(1 -1)">${corner}</g>`
    + `<g transform="translate(${width} ${height}) scale(-1 -1)">${corner}</g></g>`;
}

export function paintedPortraitSvg(s, px = 300) {
  const art = portraitArtwork(s.seed);
  if (!art) return null;
  const { image, digest } = art;
  const uid = 'p' + digest.slice(0, 20);
  const tone = ['#d5b17b', '#9cb9b3', '#c69385', '#adabbc'][parseInt(digest.slice(8, 10), 16) % 4];
  const zoom = 1.02 + parseInt(digest.slice(10, 12), 16) / 255 * 0.06;
  const pan = (parseInt(digest.slice(12, 14), 16) / 255 - 0.5) * 2 * Math.min(7, (544 * zoom - 544) / 2);
  const depth = Math.min(4, 1 + Math.floor(Math.log2(Math.max(1, s.generation))));
  const rankDepth = Math.max(1, Math.min(10, s.rankIdx + 1));
  const roman = s.generation <= 10 ? ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][s.generation] : String(s.generation);
  const lineage = clamp([s.dynasty, s.tag ? `[${s.tag}]` : null].filter(Boolean).join(' · '), 38);
  const rankMarks = Array.from({ length: rankDepth }, (_, i) => `<path d="M${39 + i * 12} 740l4 -4 4 4 -4 4Z"/>`).join('');
  const colors = s.colors ? `<g transform="translate(114 295) scale(3)"><title>${esc(s.colors.name)}</title><circle cx="36" cy="79" r="2.4" fill="${s.colors.color}"/><circle cx="36" cy="79" r="3.8" fill="none" stroke="${s.colors.color}" stroke-width="0.7"/></g>` : '';
  // Reputation overlays follow provenance so no birthmark can conceal a public status.
  const effects = (s.hitman ? `<g fill="${tone}"><path d="M535 100l5 12 12 5 -12 5 -5 12 -5 -12 -12 -5 12 -5Z"/><text x="510" y="160" text-anchor="middle" font-family="Georgia,serif" font-size="12" letter-spacing="2">ASSASSIN</text></g>` : '')
    + (s.wanted ? `<g transform="rotate(-9 300 156)"><rect x="156" y="127" width="288" height="53" fill="#1b1110" fill-opacity="0.6" stroke="#cd7060" stroke-width="2"/><text x="300" y="164" text-anchor="middle" font-family="Georgia,serif" font-size="31" letter-spacing="10" fill="#e1967d">WANTED</text></g>` : '')
    + (s.welsher ? `<path d="M61 577L539 91" stroke="#9c3e34" stroke-width="9" opacity="0.8"/><text x="300" y="588" text-anchor="middle" font-family="Georgia,serif" font-size="22" letter-spacing="7" fill="#e29982">WELSHER</text>` : '')
    + (!s.alive ? `<rect x="28" y="70" width="544" height="552" fill="#090c0d" opacity="0.52"/><path d="M48 91l44 44m-44 -44v44m0 -44h44" stroke="#d7c8a8" stroke-width="5" fill="none"/><text x="300" y="600" text-anchor="middle" font-family="Georgia,serif" font-size="20" letter-spacing="8" fill="#ded1b8">IN MEMORIAM</text>` : '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${Math.round(px * 4 / 3)}" viewBox="0 0 600 800" role="img" aria-label="Noir portrait of ${esc(s.name)}, ${esc(s.rank)}, generation ${s.generation}">`
    + `<title>${esc(s.name)} — OMERTÀ bloodline</title><desc>Painted noir collectible with a deterministic identity cipher. ${esc(art.label)}; a library painting may appear on more than one identity.</desc>`
    + `<defs><clipPath id="w${uid}"><rect x="28" y="70" width="544" height="552"/></clipPath><linearGradient id="v${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1010" stop-opacity="0.07"/><stop offset="0.58" stop-color="#0c1010" stop-opacity="0"/><stop offset="1" stop-color="#0c1010" stop-opacity="0.9"/></linearGradient><linearGradient id="l${uid}"><stop stop-color="${tone}" stop-opacity="0.16"/><stop offset="0.7" stop-color="${tone}" stop-opacity="0"/></linearGradient></defs>`
    + `<rect width="600" height="800" fill="${s.frame.wood}"/><rect x="7" y="7" width="586" height="786" fill="#0c1010" stroke="${s.frame.trim}" stroke-width="2"/><rect x="23" y="23" width="554" height="754" fill="none" stroke="${s.frame.trim}" stroke-opacity="0.75"/>`
    + `<text x="300" y="51" text-anchor="middle" font-family="Georgia,serif" font-size="20" letter-spacing="9" fill="#d4bb8c">OMERTÀ</text>`
    + `<g clip-path="url(#w${uid})"><image href="${image}" x="${(28 - (544 * zoom - 544) / 2 + pan).toFixed(2)}" y="${(70 - (552 * zoom - 552) / 2).toFixed(2)}" width="${(544 * zoom).toFixed(2)}" height="${(552 * zoom).toFixed(2)}" preserveAspectRatio="xMidYMid slice"/><rect x="28" y="70" width="544" height="552" fill="url(#l${uid})"/><rect x="28" y="70" width="544" height="552" fill="url(#v${uid})"/>${colors}${effects}</g>`
    + `<path d="M40 628H560" stroke="${s.frame.trim}"/><text x="40" y="655" font-family="Georgia,serif" font-size="13" letter-spacing="3" fill="${tone}">${esc(s.rank)}</text>`
    + `<text x="39" y="696" font-family="Georgia,serif" font-size="${Array.from(String(s.name)).length > 20 ? 28 : 35}" fill="#f0e7d6">${esc(clamp(s.name, 27))}</text>`
    + (lineage ? `<text x="40" y="719" font-family="Georgia,serif" font-size="13" letter-spacing="1" fill="#b6ac98">${esc(lineage)}</text>` : '')
    + `<g fill="${tone}">${rankMarks}</g><text x="40" y="763" font-family="Georgia,serif" font-size="12" letter-spacing="2" fill="#b5a486">BLOODLINE · GEN ${roman}</text>`
    + cipherSeal(digest, 499, 693, 57, '#a98d5d')
    + `<text x="556" y="763" text-anchor="end" font-family="monospace" font-size="10" letter-spacing="1" fill="#a98d5d">${digest.slice(0, 8).toUpperCase()}</text>`
    + decoCorners(600, 800, s.frame.trim, depth) + '</svg>';
}

export function paintedDeedSvg({ name, district, districtName, rank } = {}) {
  const art = deedArtwork(name, district);
  if (!art) return null;
  const { image, digest } = art;
  const uid = 'd' + digest.slice(0, 20);
  const tone = { docks: '#95b6b3', neon: '#c49b89', foundry: '#d5a177', brick: '#c9a888', canal: '#9fb4a9', cathedral: '#b8afc5' }[district] || '#c8b08a';
  // A shallow, top-aligned crop preserves architectural rooflines and keeps every pan inside the
  // image. District paintings use 4:3 framing; square commissioned art loses more foreground.
  const zoom = 1.015 + parseInt(digest.slice(10, 12), 16) / 255 * 0.035;
  const pan = (parseInt(digest.slice(8, 10), 16) / 255 - 0.5) * 2 * Math.min(18, (930 * zoom - 930) / 2);
  const title = String(name || 'A Street of the City');
  const letters = Array.from(title).length;
  const titleSize = letters > 23 ? 46 : letters > 17 ? 55 : 67;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000" role="img" aria-label="${esc(title)}, ${esc(districtName || district || '')}, Street Deed">`
    + `<title>${esc(title)} — OMERTÀ Street Deed</title><desc>Painted district architecture with a name-derived identity cipher. District paintings may be shared by multiple deeds; the cipher and composition identify this street.</desc>`
    + `<defs><clipPath id="w${uid}"><rect x="35" y="155" width="930" height="600"/></clipPath><linearGradient id="v${uid}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#0b1111" stop-opacity="0"/><stop offset="0.63" stop-color="#0b1111" stop-opacity="0"/><stop offset="1" stop-color="#0b1111"/></linearGradient><linearGradient id="l${uid}"><stop stop-color="${tone}" stop-opacity="0.1"/><stop offset="0.75" stop-color="${tone}" stop-opacity="0"/></linearGradient></defs>`
    + `<rect width="1000" height="1000" fill="#0b1111"/><rect x="12" y="12" width="976" height="976" fill="none" stroke="#92794e" stroke-width="2"/><rect x="29" y="29" width="942" height="942" fill="none" stroke="#92794e" stroke-opacity="0.55"/>`
    + `<text x="500" y="85" text-anchor="middle" font-family="Georgia,serif" font-size="39" letter-spacing="16" fill="#e1ccb0">OMERTÀ</text><path d="M300 110H390M610 110H700" stroke="#977f53"/><text x="500" y="116" text-anchor="middle" font-family="Georgia,serif" font-size="16" letter-spacing="4" fill="#ae9874">STREET DEED</text>`
    + `<g clip-path="url(#w${uid})"><image href="${image}" x="${(35 - (930 * zoom - 930) / 2 + pan).toFixed(2)}" y="155" width="${(930 * zoom).toFixed(2)}" height="${(600 * zoom).toFixed(2)}" preserveAspectRatio="xMidYMin slice"/><rect x="35" y="155" width="930" height="600" fill="url(#l${uid})"/><rect x="35" y="155" width="930" height="600" fill="url(#v${uid})"/></g>`
    + `<text x="63" y="723" font-family="Georgia,serif" font-size="21" letter-spacing="5" fill="${tone}">${esc(clamp(districtName || district || 'The City', 32).toUpperCase())}</text>`
    + `<text x="60" y="799" font-family="Georgia,serif" font-size="${titleSize}" fill="#f1e6d3">${esc(clamp(title, 30))}</text><path d="M63 828H936" stroke="#92794e" stroke-opacity="0.65"/>`
    + `<text x="63" y="872" font-family="Georgia,serif" font-size="25" font-style="italic" fill="#cdb68e">${esc(clamp(rank || 'A Nameless Block', 40))}</text>`
    + `<text x="63" y="927" font-family="Georgia,serif" font-size="16" letter-spacing="4" fill="#9a8e77">THE CITY REMEMBERS.</text>`
    + cipherSeal(digest, 868, 852, 68, '#ae9468')
    + `<text x="936" y="940" text-anchor="end" font-family="monospace" font-size="12" letter-spacing="2" fill="#ae9468">${digest.slice(0, 12).toUpperCase()}</text>`
    + decoCorners(1000, 1000, '#ad9060', 3) + '</svg>';
}
