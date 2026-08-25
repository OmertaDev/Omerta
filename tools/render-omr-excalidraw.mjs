import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(import.meta.dirname, '..');
const diagramsDir = path.join(root, 'docs', 'diagrams');
const artDir = path.join(root, 'public', 'art');
const template = path.join(root, 'tools', 'render-omr-excalidraw.html');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const files = (await fs.readdir(diagramsDir))
  .filter((file) => /^(?:(?:omr|gameplay)-\d{2}-.+|path-(?:gun|ledger|kitchen|wheel|shadow|ring)-1200x630)\.excalidraw$/.test(file))
  .sort();

if (process.argv.includes('--list')) {
  console.log(files.join('\n'));
  process.exit(0);
}

await fs.mkdir(artDir, { recursive: true });
const browser = await chromium.launch({ executablePath: chrome, headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: 2 });
  page.on('console', (message) => console.error(`browser console: ${message.text()}`));
  page.on('pageerror', (error) => console.error(`browser error: ${error.message}`));
  page.on('requestfailed', (request) => console.error(`request failed: ${request.url()} · ${request.failure()?.errorText}`));
  await page.goto(pathToFileURL(template).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__moduleReady === true, null, { timeout: 60_000 });

  for (const file of files) {
    const source = path.join(diagramsDir, file);
    const output = path.join(artDir, file.replace(/\.excalidraw$/, '.png'));
    const data = JSON.parse(await fs.readFile(source, 'utf8'));
    const canvas = data.elements.find((element) => element.id?.endsWith('-canvas'));
    if (!canvas) throw new Error(`${file}: missing explicit *-canvas artboard`);
    for (const element of data.elements) {
      if (element === canvas || element.isDeleted) continue;
      const right = Number(element.x) + Math.max(0, Number(element.width) || 0);
      const bottom = Number(element.y) + Math.max(0, Number(element.height) || 0);
      const inside = Number(element.x) >= Number(canvas.x)
        && Number(element.y) >= Number(canvas.y)
        && right <= Number(canvas.x) + Number(canvas.width)
        && bottom <= Number(canvas.y) + Number(canvas.height);
      if (!inside) throw new Error(`${file}: ${element.id} escapes the canvas (${element.x},${element.y},${right},${bottom})`);
    }
    const result = await page.evaluate((diagram) => window.renderDiagram(diagram), data);
    if (!result.success) throw new Error(`${file}: ${result.error}`);
    const isPathCard = /^path-.+-1200x630\.excalidraw$/.test(file);
    if (isPathCard) {
      if (Number(canvas.width) !== 1200 || Number(canvas.height) !== 630)
        throw new Error(`${file}: Path share-card canvas must be exactly 1200x630`);
      // Excalidraw's SVG includes export padding and an internal 2× scale. That is useful for the
      // high-resolution research sheets but violates OG's declared pixel contract. Crop the SVG's
      // viewBox to the explicit artboard and ask Playwright for CSS pixels: exact 1200×630, no resample.
      await page.locator('#root svg').evaluate((svg, artboard) => {
        svg.setAttribute('viewBox', `${artboard.x} ${artboard.y} ${artboard.width} ${artboard.height}`);
        svg.setAttribute('width', String(artboard.width));
        svg.setAttribute('height', String(artboard.height));
        svg.style.width = `${artboard.width}px`;
        svg.style.height = `${artboard.height}px`;
      }, { x: Number(canvas.x), y: Number(canvas.y), width: Number(canvas.width), height: Number(canvas.height) });
    }
    await page.locator('#root svg').screenshot({ path: output, omitBackground: false, scale: isPathCard ? 'css' : 'device' });
    console.log(`${file} -> ${path.relative(root, output)} (${isPathCard ? '1200x630' : `${result.width}x${result.height}`})`);
  }
} finally {
  await browser.close();
}
