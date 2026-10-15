import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {getCompositions, renderMedia, renderStill} from '@remotion/renderer';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(project, '../..');
const output = path.join(root, 'output/cinematic-r4');
const stage = path.join(output, 'render-public');
const manifestFile = path.join(root, 'public/art/cinematic-r4/manifest.json');
const productionFile = path.join(root, 'brand/cinematic-video-system/production-data.json');
const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
const data = JSON.parse(fs.readFileSync(productionFile, 'utf8'));
const selected = process.argv.find(argument => argument.startsWith('--id='))?.slice(5);
const full = process.argv.includes('--full');
const stillsOnly = process.argv.includes('--stills');
const concurrency = Math.max(1, Math.min(8, Number(process.argv.find(argument => argument.startsWith('--concurrency='))?.split('=')[1]) || 4));
const scale = full ? 1 : 0.5;
const selectedFilms = data.films.filter(film => !selected || `Omerta-Cinematic-${film.id}` === selected);
if (!selectedFilms.length) throw new Error(`No cinematic composition matches ${selected}`);

const resolveLocal = src => {
  if (typeof src !== 'string' || !src.startsWith('art/cinematic-r4/') || src.includes(':') || src.split(/[\\/]/).includes('..')) {
    throw new Error('Unexpected cinematic asset path');
  }
  const absolute = path.resolve(root, 'public', src);
  if (!absolute.startsWith(path.resolve(root, 'public/art/cinematic-r4') + path.sep)) throw new Error('Asset outside cinematic directory');
  if (!fs.existsSync(absolute)) throw new Error(`Missing cinematic production asset: ${src}`);
  return absolute;
};

for (const film of selectedFilms) {
  if (!Number.isFinite(film.duration) || film.duration <= 0) throw new Error(`Invalid film duration: ${film.id}`);
  let previous = 0;
  for (const beat of film.beats) {
    if (Math.abs(beat.start - previous) > 1 / 30 || beat.end <= beat.start) throw new Error(`Timeline gap or overlap: ${film.id}/${beat.id}`);
    const screenIds = beat.screens?.length ? beat.screens : beat.screen ? [beat.screen] : [];
    if ((!beat.kind || beat.kind === 'capture') && !screenIds.length) throw new Error(`Missing screenshot mapping: ${film.id}/${beat.id}`);
    for (const screenId of screenIds) {
      const capture = manifest.captures?.[screenId];
      if (!capture) throw new Error(`Missing screenshot mapping: ${film.id}/${screenId}`);
      if (!(capture.width > 0) || !(capture.height > 0) || capture.width > 32768 || capture.height > 32768) throw new Error(`Invalid screenshot dimensions: ${screenId}`);
      resolveLocal(capture.src);
    }
    previous = beat.end;
  }
  if (Math.abs(previous - film.duration) > 1 / 30) throw new Error(`Film ${film.id} timeline does not match its duration`);
  if (!stillsOnly && !manifest.audio?.[film.id]) throw new Error(`Film ${film.id} needs its completed audio mix before video rendering`);
}

fs.mkdirSync(path.join(stage, 'art/cinematic-r4'), {recursive: true});
const inputs = new Set([
  'art/cinematic-r4/manifest.json',
  ...Object.values(manifest.captures || {}).map(capture => capture.src),
  ...Object.values(manifest.audio || {}).map(track => typeof track === 'string' ? track : track.src),
]);
for (const src of inputs) {
  const source = resolveLocal(src);
  const target = path.join(stage, src);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.copyFileSync(source, target);
}
fs.copyFileSync(productionFile, path.join(stage, 'art/cinematic-r4/production-data.json'));
console.log(`Staged ${Object.keys(manifest.captures || {}).length} real captures and ${Object.keys(manifest.audio || {}).length} audio mixes.`);
const serveUrl = await bundle({entryPoint: path.join(project, 'src/cinematic-r4/index.ts'), publicDir: stage, rspack: false});
const compositions = await getCompositions(serveUrl);
const results = [];
for (const composition of compositions.filter(item => !selected || item.id === selected)) {
  const film = data.films.find(item => `Omerta-Cinematic-${item.id}` === composition.id);
  const prefix = `${composition.id}${full ? '-1080' : '-draft'}`;
  const indexSamples = [0, Math.floor(film.beats.length * 0.25), Math.floor(film.beats.length * 0.5), Math.floor(film.beats.length * 0.75), ...film.beats.flatMap((beat, index) => beat.flowMode === 'allocation' ? [index] : []), film.beats.length - 1];
  const frames = [...new Set(indexSamples.map(index => Math.min(composition.durationInFrames - 1, Math.round((film.beats[index].start + Math.min(1.2, (film.beats[index].end - film.beats[index].start) / 2)) * composition.fps))))];
  for (const frame of frames) {
    await renderStill({serveUrl, composition, frame, output: path.join(output, `${prefix}-${frame}.png`), imageFormat: 'png', scale: 0.5});
  }
  if (!stillsOnly) {
    let last = 0;
    await renderMedia({serveUrl, composition, outputLocation: path.join(output, `${prefix}.mp4`), codec: 'h264', crf: full ? 18 : 22, scale, pixelFormat: 'yuv420p', audioBitrate: '256k', colorSpace: 'bt709', concurrency, overwrite: true, onProgress: ({progress}) => {
      if (Date.now() - last > 15000) {console.log(`${prefix}: ${Math.round(progress * 100)}%`); last = Date.now();}
    }});
    console.log(`${prefix}: rendered ${composition.durationInFrames / composition.fps}s`);
  }
  results.push({id: composition.id, duration: composition.durationInFrames / composition.fps, width: composition.width * scale, height: composition.height * scale, fps: composition.fps, video: stillsOnly ? null : `${prefix}.mp4`, stillFrames: frames});
}
fs.writeFileSync(path.join(output, `render-report${stillsOnly ? '-stills' : full ? '-1080' : '-draft'}.json`), JSON.stringify({createdAt: new Date().toISOString(), productionFile: 'brand/cinematic-video-system/production-data.json', films: results}, null, 2));
