// Normalize accepted fal artwork into the scene's logical world and transparent sprite cells.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let PNG;
try { ({ PNG } = require('pngjs')); }
catch { ({ PNG } = createRequire(path.resolve(path.dirname(process.execPath), '../node_modules/package.json'))('pngjs')); }
const directory = path.resolve('public/art');
const ledgerPath = path.resolve('art/city/generation-manifest.json');
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
const manifest = { provider: 'fal.ai', version: 1, world: { width: 960, height: 640 },
  sprite: { width: 38, height: 60, footX: 19, footY: 58 }, assets: [] };
function save(name, png, source, extra = {}) {
  const bytes = PNG.sync.write(png, { colorType: 6, inputColorType: 6, deflateLevel: 9 });
  fs.writeFileSync(path.join(directory, name), bytes);
  manifest.assets.push({ file: name, source, model: ledger.jobs[source].model,
    requestId: ledger.jobs[source].request_id, sourceSha256: ledger.jobs[source].sha256,
    width: png.width, height: png.height, bytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'), ...extra });
}
function resize(source, width, height) {
  const output = new PNG({ width, height });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sourceOffset = (Math.min(source.height - 1, Math.floor(y * source.height / height)) * source.width
      + Math.min(source.width - 1, Math.floor(x * source.width / width))) * 4;
    source.data.copy(output.data, (y * width + x) * 4, sourceOffset, sourceOffset + 4);
  }
  return output;
}
const background = PNG.sync.read(fs.readFileSync('art/city/neighborhood-v1.png'));
save('city-neighborhood-v1.png', resize(background, 960, 640), 'neighborhood-v1');
const sheet = PNG.sync.read(fs.readFileSync('art/city/characters-v1.png'));
const names = ['player-down', 'player-up', 'player-left', 'player-right', 'fixer', 'worker', 'neighbor', 'player-step'];
const cellWidth = sheet.width / 4, cellHeight = sheet.height / 2;
if (!Number.isInteger(cellWidth) || !Number.isInteger(cellHeight)) throw new Error('Unexpected character sheet grid');
for (let index = 0; index < names.length; index++) {
  const left = index % 4 * cellWidth, top = Math.floor(index / 4) * cellHeight;
  let minX = cellWidth, minY = cellHeight, maxX = -1, maxY = -1;
  let transparent = 0;
  for (let y = 0; y < cellHeight; y++) for (let x = 0; x < cellWidth; x++) {
    const alpha = sheet.data[((top + y) * sheet.width + left + x) * 4 + 3];
    if (alpha < 8) transparent++;
    if (alpha >= 128) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  }
  if (maxX < 0 || transparent < cellWidth * cellHeight * 0.1) throw new Error(names[index] + ': missing sprite or real alpha');
  const crop = new PNG({ width: maxX - minX + 1, height: maxY - minY + 1 });
  PNG.bitblt(sheet, crop, left + minX, top + minY, crop.width, crop.height, 0, 0);
  const scale = Math.min(34 / crop.width, 54 / crop.height);
  const sprite = resize(crop, Math.max(1, Math.round(crop.width * scale)), Math.max(1, Math.round(crop.height * scale)));
  // Native alpha includes a faint matte. Hard edges keep the delivered pixel sprites crisp.
  for (let offset = 3; offset < sprite.data.length; offset += 4) {
    sprite.data[offset] = sprite.data[offset] >= 128 ? 255 : 0;
    if (!sprite.data[offset]) sprite.data.fill(0, offset - 3, offset);
  }
  const output = new PNG({ width: 38, height: 60 });
  output.data.fill(0);
  PNG.bitblt(sprite, output, 0, 0, sprite.width, sprite.height, Math.floor((38 - sprite.width) / 2), 58 - sprite.height);
  save('city-' + names[index] + '-v1.png', output, 'characters-v1',
    { cell: index, sourceBounds: { left: left + minX, top: top + minY, width: crop.width, height: crop.height } });
}
fs.writeFileSync(path.resolve('art/city/delivery-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Built ' + manifest.assets.length + ' city assets from fal artwork');
