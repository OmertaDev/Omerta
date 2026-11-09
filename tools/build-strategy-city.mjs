import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const vendor = path.join(root, 'public', 'vendor');
const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.resolve('three'))));
const pkg = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
if (pkg.version !== '0.187.0') throw new Error(`Expected pinned three@0.187.0, found ${pkg.version}.`);
await mkdir(vendor, { recursive: true });
await build({
  entryPoints: [path.join(root, 'tools', 'strategy-city-scene.mjs')],
  outfile: path.join(vendor, 'strategy-city-renderer.js'),
  bundle: true, format: 'esm', platform: 'browser', target: 'es2020', minify: true,
  legalComments: 'external', logLevel: 'warning',
});
await writeFile(path.join(vendor, 'strategy-city-renderer.LICENSE.txt'), `Three.js ${pkg.version}\n\n${await readFile(path.join(packageRoot, 'LICENSE'), 'utf8')}`);
console.log(`Built strategy city renderer with three@${pkg.version}.`);
