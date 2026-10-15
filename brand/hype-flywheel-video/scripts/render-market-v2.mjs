import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {getCompositions, renderMedia, renderStill} from '@remotion/renderer';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(project, '../..');
const output = path.join(root, 'output/market-v2-film');
const stage = path.join(output, 'render-public');
const source = path.join(root, 'brand/market-v2-film/production-data.json');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/art/market-v2-film/manifest.json'), 'utf8'));
const production = JSON.parse(fs.readFileSync(source, 'utf8'));
const film = production.film;
const full = process.argv.includes('--full');
const allStills = process.argv.includes('--all-stills');
const stillsOnly = process.argv.includes('--stills') || allStills;
const concurrencyArg = process.argv.find(argument => argument.startsWith('--concurrency='))?.split('=')[1] || (process.argv.includes('--concurrency') ? process.argv[process.argv.indexOf('--concurrency') + 1] : undefined);
const concurrency = concurrencyArg === undefined ? 4 : Number(concurrencyArg);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) throw new Error('Use concurrency between 1 and 32');
const validPath = src => {
  if (typeof src !== 'string' || !src.startsWith('art/market-v2-film/') || src.includes(':') || src.split(/[\\/]/).includes('..')) throw new Error('Market V2 assets must remain in their dedicated folder');
  const absolute = path.resolve(root, 'public', src);
  if (!absolute.startsWith(path.resolve(root, 'public/art/market-v2-film') + path.sep) || !fs.existsSync(absolute)) throw new Error(`Missing or unsafe Market V2 asset: ${src}`);
  return absolute;
};
let end = 0;
for (const beat of film.beats) {
  if (Math.abs(beat.start - end) > 1 / 30 || beat.end <= beat.start) throw new Error(`Timeline gap/overlap: ${beat.id}`);
  end = beat.end;
  if ((beat.kind === 'hero' || beat.kind === 'capture') && !beat.screen) throw new Error(`Actual capture required: ${beat.id}`);
  if (beat.screen) {
    const capture = manifest.captures[beat.screen];
    if (!capture || !(capture.width > 0) || !(capture.height > 0) || capture.width > 32768 || capture.height > 32768) throw new Error(`Invalid actual capture: ${beat.screen}`);
    validPath(capture.src);
  }
}
if (Math.abs(end - film.duration) > 1 / 30) throw new Error('Market V2 timeline duration mismatch');
if (!stillsOnly && !manifest.audio?.src) throw new Error('A completed Market V2 mix is required before video rendering');
fs.mkdirSync(path.join(stage, 'art/market-v2-film'), {recursive: true});
const inputs = new Set(['art/market-v2-film/manifest.json', ...Object.values(manifest.captures).map(capture => capture.src), ...(manifest.audio?.src ? [manifest.audio.src] : [])]);
for (const src of inputs) {
  const target = path.join(stage, src);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.copyFileSync(validPath(src), target);
}
fs.copyFileSync(source, path.join(stage, 'art/market-v2-film/production-data.json'));
console.log(`Market V2: ${film.duration}s, ${film.beats.length} scenes, ${Object.keys(manifest.captures).length} actual captures.`);
const serveUrl = await bundle({entryPoint: path.join(project, 'src/market-v2-film/index.ts'), publicDir: stage, rspack: false});
const [composition] = await getCompositions(serveUrl);
const prefix = `Omerta-Market-V2-${full ? '1080' : 'draft'}`;
const samples = allStills ? film.beats : film.beats.filter((beat, index) => index === 0 || beat.kind === 'range' || beat.kind === 'allocation' || beat.state === 'recover' || beat.state === 'empty' || beat.state === 'checkpoint' || index === film.beats.length - 1);
const stills = [];
for (const beat of samples) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round((beat.start + (beat.end - beat.start) * 0.65) * 30));
  const name = `${prefix}-${beat.id}-${frame}.png`;
  await renderStill({serveUrl, composition, frame, output: path.join(output, name), imageFormat: 'png', scale: 0.5});
  stills.push({beat: beat.id, frame, file: name});
}
if (!stillsOnly) {
  let lastLog = 0;
  await renderMedia({serveUrl, composition, outputLocation: path.join(output, `${prefix}.mp4`), codec: 'h264', crf: full ? 18 : 22, scale: full ? 1 : 0.5, pixelFormat: 'yuv420p', audioBitrate: '256k', colorSpace: 'bt709', concurrency, overwrite: true, onProgress: ({progress}) => {
    if (Date.now() - lastLog > 15000) {console.log(`${prefix}: ${Math.round(progress * 100)}%`); lastLog = Date.now();}
  }});
  console.log(`${prefix}: ${composition.durationInFrames / composition.fps}s rendered`);
}
fs.writeFileSync(path.join(output, `render-report-${stillsOnly ? 'stills' : full ? '1080' : 'draft'}.json`), JSON.stringify({createdAt: new Date().toISOString(), duration: film.duration, width: full ? 1080 : 540, height: full ? 1920 : 960, fps: 30, concurrency, video: stillsOnly ? null : `${prefix}.mp4`, stills}, null, 2));
