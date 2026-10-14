// Strict image-to-image layout guide. Keep world coordinates aligned with city-scene.js.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const WORLD_WIDTH = 960, WORLD_HEIGHT = 640;
const OUTPUT_WIDTH = 1536, OUTPUT_HEIGHT = 1024;
const pixels = Buffer.alloc(WORLD_WIDTH * WORLD_HEIGHT * 3);

function rectangle(x, y, width, height, color) {
  for (let row = Math.max(0, y); row < Math.min(WORLD_HEIGHT, y + height); row++) {
    for (let col = Math.max(0, x); col < Math.min(WORLD_WIDTH, x + width); col++) {
      const offset = (row * WORLD_WIDTH + col) * 3;
      pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2];
    }
  }
}

function ellipse(x, y, width, height, color) {
  for (let row = y; row < y + height; row++) for (let col = x; col < x + width; col++) {
    if (((col + 0.5 - x - width / 2) / (width / 2)) ** 2
      + ((row + 0.5 - y - height / 2) / (height / 2)) ** 2 <= 1) {
      rectangle(col, row, 1, 1, color);
    }
  }
}

rectangle(0, 0, WORLD_WIDTH, WORLD_HEIGHT, [190, 187, 173]);
rectangle(0, 250, WORLD_WIDTH, 70, [64, 68, 69]);
rectangle(332, 250, 144, 290, [64, 68, 69]);
rectangle(0, 540, WORLD_WIDTH, 6, [130, 130, 119]);
rectangle(0, 546, WORLD_WIDTH, 94, [40, 99, 103]);

const buildings = [
  { x: 48, y: 52, width: 192, height: 158, brick: [139, 91, 75] },
  { x: 286, y: 40, width: 206, height: 184, brick: [152, 126, 96] },
  { x: 690, y: 54, width: 222, height: 156, brick: [124, 85, 77] },
  { x: 64, y: 330, width: 240, height: 172, brick: [127, 101, 82] },
  { x: 510, y: 304, width: 168, height: 174, brick: [121, 112, 92] },
];
for (const { x, y, width, height, brick } of buildings) {
  // All roof, facade, and door pixels stay within the authoritative solid footprint.
  rectangle(x, y, width, height, brick.map(channel => Math.max(0, channel - 35)));
  rectangle(x + 2, y + 2, width - 4, height - 4, brick);
  rectangle(x + 7, y + 7, width - 14, height - 38, [104, 103, 95]);
  rectangle(x + 11, y + 11, width - 22, height - 46, [131, 128, 113]);
  rectangle(x + 7, y + height - 30, width - 14, 3, brick.map(channel => Math.max(0, channel - 20)));
  rectangle(x + Math.floor(width / 2) - 12, y + height - 24, 24, 24, [49, 44, 38]);
  rectangle(x + Math.floor(width / 2) - 9, y + height - 21, 18, 21, [80, 65, 47]);
}

for (const { x, y, width, height } of [
  { x: 16, y: 286, width: 26, height: 38 },
  { x: 864, y: 428, width: 48, height: 50 },
  { x: 832, y: 502, width: 32, height: 34 },
]) {
  // A simple canopy and trunk identify the fixed tree obstacles without changing their bounds.
  rectangle(x + Math.floor(width / 2) - 2, y + height - 13, 4, 13, [92, 73, 50]);
  ellipse(x, y, width, height - 7, [61, 78, 65]);
  ellipse(x + 2, y + 2, width - 5, height - 12, [86, 102, 75]);
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const payload = Buffer.concat([name, data]);
  let crc = 0xffffffff;
  for (const byte of payload) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  const size = Buffer.alloc(4), checksum = Buffer.alloc(4);
  size.writeUInt32BE(data.length); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([size, payload, checksum]);
}

// Nearest-neighbor scaling preserves the guide's 3:2 world geometry exactly.
const scanlines = Buffer.alloc(OUTPUT_HEIGHT * (OUTPUT_WIDTH * 3 + 1));
for (let y = 0; y < OUTPUT_HEIGHT; y++) {
  const worldY = Math.floor(y * WORLD_HEIGHT / OUTPUT_HEIGHT);
  const rowOffset = y * (OUTPUT_WIDTH * 3 + 1);
  for (let x = 0; x < OUTPUT_WIDTH; x++) {
    const worldX = Math.floor(x * WORLD_WIDTH / OUTPUT_WIDTH);
    const source = (worldY * WORLD_WIDTH + worldX) * 3;
    pixels.copy(scanlines, rowOffset + 1 + x * 3, source, source + 3);
  }
}
const header = Buffer.alloc(13);
header.writeUInt32BE(OUTPUT_WIDTH, 0); header.writeUInt32BE(OUTPUT_HEIGHT, 4);
header[8] = 8; header[9] = 2; // Eight-bit RGB; opaque guide, filter and interlace defaults are zero.
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
]);
const outputPath = fileURLToPath(new URL('../art/city/layout-guide.png', import.meta.url));
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, png);
console.log(JSON.stringify({ path: outputPath, width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT,
  bytes: png.length, sha256: createHash('sha256').update(png).digest('hex') }));
