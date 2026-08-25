import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(import.meta.dirname, '..');
const diagramsDir = path.join(root, 'docs', 'diagrams');
const artDir = path.join(root, 'public', 'art');
const template = path.join(root, 'tools', 'render-omr-excalidraw.html');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const requestedFormats = new Set((process.argv.find((arg) => arg.startsWith('--formats=')) || '')
  .replace('--formats=', '').split(',').filter(Boolean));
const files = (await fs.readdir(diagramsDir))
  .filter((file) => /^(?:(?:omr|gameplay)-\d{2}-.+|path-(?:gun|ledger|kitchen|wheel|shadow|ring)-(?:1200x630|1080x1350|1080x1920))\.excalidraw$/.test(file))
  .filter((file) => !requestedFormats.size || [...requestedFormats].some((format) => file.endsWith(`-${format}.excalidraw`)))
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
    const pathCardSize = file.match(/^path-.+-(\d+)x(\d+)\.excalidraw$/);
    const isPathCard = Boolean(pathCardSize);
    if (isPathCard) {
      const expectedWidth = Number(pathCardSize[1]);
      const expectedHeight = Number(pathCardSize[2]);
      if (Number(canvas.width) !== expectedWidth || Number(canvas.height) !== expectedHeight)
        throw new Error(`${file}: Path card canvas must be exactly ${expectedWidth}x${expectedHeight}`);
      // Excalidraw's SVG includes export padding and an internal 2× scale. That is useful for the
      // high-resolution research sheets but violates the Path cards' declared pixel contracts. Crop
      // to the explicit artboard and ask Playwright for CSS pixels: exact dimensions, no resample.
      await page.locator('#root svg').evaluate((svg, artboard) => {
        svg.setAttribute('viewBox', `${artboard.x} ${artboard.y} ${artboard.width} ${artboard.height}`);
        svg.setAttribute('width', String(artboard.width));
        svg.setAttribute('height', String(artboard.height));
        svg.style.width = `${artboard.width}px`;
        svg.style.height = `${artboard.height}px`;
      }, { x: Number(canvas.x), y: Number(canvas.y), width: Number(canvas.width), height: Number(canvas.height) });
    }
    await page.locator('#root svg').screenshot({ path: output, omitBackground: false, scale: isPathCard ? 'css' : 'device' });
    console.log(`${file} -> ${path.relative(root, output)} (${isPathCard ? `${pathCardSize[1]}x${pathCardSize[2]}` : `${result.width}x${result.height}`})`);
  }
} finally {
  await browser.close();
}
