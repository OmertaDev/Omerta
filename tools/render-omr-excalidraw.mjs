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
  .filter((file) => /^omr-\d{2}-.+\.excalidraw$/.test(file))
  .sort();

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
    const result = await page.evaluate((diagram) => window.renderDiagram(diagram), data);
    if (!result.success) throw new Error(`${file}: ${result.error}`);
    await page.locator('#root svg').screenshot({ path: output, omitBackground: false });
    console.log(`${file} -> ${path.relative(root, output)} (${result.width}x${result.height})`);
  }
} finally {
  await browser.close();
}
