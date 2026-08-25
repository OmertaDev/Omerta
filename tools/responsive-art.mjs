#!/usr/bin/env node
// Build the landing page's responsive WebP derivatives from the committed source art.
// The originals remain the no-JS/legacy fallback and the full-resolution download target.
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

const ART_DIR = new URL('../public/art/', import.meta.url);
const PHOTO_QUALITY = 0.82;
const DIAGRAM_QUALITY = 0.9;
const JOBS = [
  { source: 'hero-poster.jpg', widths: [640, 960, 1440, 1920], quality: PHOTO_QUALITY },
  { source: 'landing-break.jpg', widths: [640, 960, 1440], quality: PHOTO_QUALITY },
  { source: 'district-cathedral.jpg', widths: [480, 960], quality: PHOTO_QUALITY },
  { source: 'pill-legacy.jpg', widths: [480, 960], quality: PHOTO_QUALITY },
  { source: 'district-foundry.jpg', widths: [480, 960], quality: PHOTO_QUALITY },
  { source: 'interior-kitchen.jpg', widths: [480, 960], quality: PHOTO_QUALITY },
  { source: 'interior-scores.jpg', widths: [640, 1024], quality: PHOTO_QUALITY },
  { source: 'hype-money-poster.jpg', widths: [640, 960], quality: PHOTO_QUALITY },
  { source: 'gameplay-01-choose-your-path.png', widths: [640, 1080, 1600], quality: DIAGRAM_QUALITY },
  { source: 'omr-03-money-router.png', widths: [640, 1080, 1600], quality: DIAGRAM_QUALITY },
];

function resolveBrowser() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  for (const path of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ]) if (existsSync(path)) return path;
  return null;
}

const executablePath = resolveBrowser();
if (!executablePath) {
  console.error('Set CHROMIUM_PATH to a Chromium/Chrome binary before generating responsive art.');
  process.exit(1);
}

const mimeOf = (file) => extname(file).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
const outputName = (source, width) => `${basename(source, extname(source))}-${width}.webp`;
const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage();

try {
  for (const job of JOBS) {
    const sourceUrl = new URL(job.source, ART_DIR);
    const sourceBytes = await readFile(sourceUrl);
    const dataUrl = `data:${mimeOf(job.source)};base64,${sourceBytes.toString('base64')}`;

    for (const width of job.widths) {
      const encoded = await page.evaluate(async ({ dataUrl: input, width: targetWidth, quality }) => {
        const image = new Image();
        image.decoding = 'async';
        image.src = input;
        await image.decode();
        const width = Math.min(targetWidth, image.naturalWidth);
        const height = Math.round(image.naturalHeight * width / image.naturalWidth);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { alpha: false });
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, width, height);
        const blob = await new Promise((resolve, reject) => canvas.toBlob(
          (value) => value ? resolve(value) : reject(new Error('WebP encoding failed')),
          'image/webp',
          quality,
        ));
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        const chunk = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunk)
          binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
        return { base64: btoa(binary), width, height, size: bytes.length };
      }, { dataUrl, width, quality: job.quality });

      const name = outputName(job.source, width);
      await writeFile(new URL(name, ART_DIR), Buffer.from(encoded.base64, 'base64'));
      console.log(`${job.source} -> ${name} (${encoded.width}x${encoded.height}, ${Math.round(encoded.size / 1024)} KB)`);
    }
  }
} finally {
  await browser.close();
}
