import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { disableModalTracking } from './walletconnect-privacy.mjs';
const appkitEntry = fileURLToPath(import.meta.resolve('@reown/appkit/core'));
await mkdir('public/vendor', { recursive: true });
const result = await build({
  stdin: { contents: "export { EthereumProvider } from '@walletconnect/ethereum-provider';", resolveDir: process.cwd() },
  outfile: 'public/vendor/walletconnect.js', bundle: true, format: 'esm', platform: 'browser',
  target: 'es2020', minify: true, legalComments: 'external', metafile: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  // EthereumProvider's modal adapter otherwise uses AppKit's default analytics.
  // Keep wallet pairing while explicitly disabling optional tracking and sales.
  plugins: [{ name: 'private-wallet-modal', setup(build) {
    build.onResolve({ filter: /^@reown\/appkit\/core$/ }, () => ({ path: 'private-appkit', namespace: 'private-appkit' }));
    build.onLoad({ filter: /.*/, namespace: 'private-appkit' }, () => ({
      contents: `import { createAppKit as original } from ${JSON.stringify(appkitEntry)};
export function createAppKit(options) { return original({ ...options, enableAnalytics: false,
  features: { ...options.features, analytics: false, swaps: false, onramp: false, email: false, socials: false } }); }`,
      loader: 'js', resolveDir: process.cwd(),
    }));
    build.onLoad({ filter: /[\\/]controllers[\\/]EventsController\.js$/ }, async ({ path: filename }) => {
      const source = await readFile(filename, 'utf8');
      const contents = disableModalTracking(source);
      return { contents, loader: 'js', resolveDir: path.dirname(filename) };
    });
  } }],
});
const packages = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  if (!input.includes('node_modules')) continue;
  let dir = path.dirname(path.resolve(input));
  while (dir.includes('node_modules')) {
    try {
      const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
      if (pkg.name && pkg.version) {
        packages.set(`${pkg.name}@${pkg.version}`, { name: pkg.name, version: pkg.version, license: pkg.license || 'See package license' });
        break;
      }
    } catch { /* Keep walking to the owning package. */ }
    dir = path.dirname(dir);
  }
}
await writeFile('public/vendor/walletconnect-manifest.json', JSON.stringify({
  script: '/vendor/walletconnect.js', analytics: false, telemetry: false, mandatoryModalEvents: false,
  packages: [...packages.values()].sort((a, b) => a.name.localeCompare(b.name)),
}, null, 2) + '\n');
