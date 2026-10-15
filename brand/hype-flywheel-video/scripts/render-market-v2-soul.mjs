import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {getCompositions, renderMedia, renderStill} from '@remotion/renderer';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(project, '../..');
const output = path.join(root, 'output/market-v2-soul');
const stage = path.join(output, 'render-public');
const source = path.join(root, 'brand/market-v2-soul/production-data.json');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/art/market-v2-soul/manifest.json'), 'utf8'));
const production = JSON.parse(fs.readFileSync(source, 'utf8'));
const film = production.film;
const full = process.argv.includes('--full');
const allStills = process.argv.includes('--all-stills');
const motionQa = process.argv.includes('--motion-qa');
const stillsOnly = process.argv.includes('--stills') || allStills;
const requestedBeats = process.argv.find(argument => argument.startsWith('--beats='))?.slice(8).split(',');
const concurrencyArg = process.argv.find(argument => argument.startsWith('--concurrency='))?.split('=')[1] || (process.argv.includes('--concurrency') ? process.argv[process.argv.indexOf('--concurrency') + 1] : undefined);
const concurrency = concurrencyArg === undefined ? 4 : Number(concurrencyArg);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) throw new Error('Use concurrency between 1 and 32');
const assetPath = src => {
  if (typeof src !== 'string' || !src.startsWith('art/market-v2-soul/') || src.includes(':') || src.split(/[\\/]/).includes('..')) throw new Error('Soul media must stay in its own directory');
  const absolute = path.resolve(root, 'public', src);
  if (!absolute.startsWith(path.resolve(root, 'public/art/market-v2-soul') + path.sep) || !fs.existsSync(absolute)) throw new Error(`Soul media is not ready: ${src}`);
  return absolute;
};
let end = 0;
const media = new Set(['art/market-v2-soul/manifest.json']);
for (const beat of film.beats) {
  if (Math.abs(beat.start - end) > 1 / 30 || beat.end <= beat.start) throw new Error(`Soul timeline gap or overlap: ${beat.id}`);
  end = beat.end;
  for (const id of [beat.plate, beat.secondPlate].filter(Boolean)) {
    const plate = manifest.plates?.[id];
    if (!plate) throw new Error(`Missing cinema plate mapping: ${id}`);
    if (plate.type === 'video' && !(plate.duration > 0)) {
      const probe = JSON.parse(execFileSync(path.join(project, 'node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', assetPath(plate.src)], {encoding: 'utf8'}));
      plate.duration = Number(probe.format?.duration);
      if (!(plate.duration > 0.1)) throw new Error(`Invalid motion plate duration: ${id}`);
    }
    media.add(plate.src);
  }
  if (!beat.plate) throw new Error(`Every Soul scene needs an atmosphere plate: ${beat.id}`);
  if (beat.layout === 'capture' && !beat.screen) throw new Error(`Actual UI close-up needs a capture: ${beat.id}`);
  if (beat.screen) {
    const capture = manifest.captures?.[beat.screen];
    if (!capture || !(capture.width > 0) || !(capture.height > 0) || capture.width > 32768 || capture.height > 32768) throw new Error(`Invalid actual capture: ${beat.screen}`);
    media.add(capture.src);
  }
  if (beat.captureInsert) {
    const capture = manifest.captures?.[beat.captureInsert.screen];
    if (!capture) throw new Error(`Missing actual UI insert: ${beat.captureInsert.screen}`);
    if (!(beat.captureInsert.startFraction > 0 && beat.captureInsert.startFraction < 1)) throw new Error(`Invalid UI insert timing: ${beat.id}`);
    media.add(capture.src);
  }
}
if (Math.abs(end - film.duration) > 1 / 30) throw new Error('Soul timeline duration mismatch');
if (!stillsOnly && !motionQa && !manifest.audio?.src) throw new Error('Soul full video needs its selected voice mix first');
if (manifest.audio?.src) media.add(manifest.audio.src);
fs.mkdirSync(path.join(stage, 'art/market-v2-soul'), {recursive: true});
for (const src of media) {
  const target = path.join(stage, src);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.copyFileSync(assetPath(src), target);
}
fs.writeFileSync(path.join(stage, 'art/market-v2-soul/manifest.json'), JSON.stringify(manifest, null, 2));
fs.copyFileSync(source, path.join(stage, 'art/market-v2-soul/production-data.json'));
console.log(`Soul direction: ${film.duration}s, ${film.beats.length} scenes; ${media.size} isolated inputs.`);
const serveUrl = await bundle({entryPoint: path.join(project, 'src/market-v2-soul/index.ts'), publicDir: stage, rspack: false});
const [composition] = await getCompositions(serveUrl);
const prefix = `Omerta-Market-V2-Soul-${full ? '1080' : 'draft'}`;
const defaults = [film.beats[0]?.id, film.beats.find(beat => beat.kind === 'range' && beat.state === 'selling')?.id, film.beats.find(beat => beat.layout === 'capture')?.id].filter(Boolean);
const samples = allStills ? film.beats : film.beats.filter(beat => (requestedBeats || defaults).includes(beat.id));
const stills = [];
for (const beat of samples) {
  const fractions = beat.captureInsert ? [0.35, 0.85] : [0.65];
  for (const fraction of fractions) {
    const frame = Math.min(composition.durationInFrames - 1, Math.round((beat.start + (beat.end - beat.start) * fraction) * 30));
    const name = `${prefix}-${beat.id}-${frame}.png`;
    await renderStill({serveUrl, composition, frame, output: path.join(output, name), imageFormat: 'png', scale: 0.5});
    stills.push({beat: beat.id, frame, file: name});
  }
}
const motionClips = [];
if (motionQa) {
  for (const beat of samples) {
    const name = `${prefix}-${beat.id}-motion-qa.mp4`;
    const frameRange = [Math.round(beat.start * 30), Math.round(beat.end * 30) - 1];
    await renderMedia({serveUrl, composition, outputLocation: path.join(output, name), frameRange, muted: true, codec: 'h264', crf: 23, scale: 0.5, pixelFormat: 'yuv420p', colorSpace: 'bt709', concurrency, overwrite: true});
    motionClips.push({beat: beat.id, file: name, frameRange});
  }
} else if (!stillsOnly) {
  let lastLog = 0;
  await renderMedia({serveUrl, composition, outputLocation: path.join(output, `${prefix}.mp4`), codec: 'h264', crf: full ? 18 : 22, scale: full ? 1 : 0.5, pixelFormat: 'yuv420p', audioBitrate: '256k', colorSpace: 'bt709', concurrency, overwrite: true, onProgress: ({progress}) => {
    if (Date.now() - lastLog > 15000) {console.log(`${prefix}: ${Math.round(progress * 100)}%`); lastLog = Date.now();}
  }});
}
fs.writeFileSync(path.join(output, `render-report-${motionQa ? 'motion-qa' : stillsOnly ? 'stills' : full ? '1080' : 'draft'}.json`), JSON.stringify({createdAt: new Date().toISOString(), duration: film.duration, width: full ? 1080 : 540, height: full ? 1920 : 960, fps: 30, concurrency, video: stillsOnly || motionQa ? null : `${prefix}.mp4`, stills, motionClips}, null, 2));
