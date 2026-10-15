import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {getCompositions, renderMedia, renderStill} from '@remotion/renderer';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(project, '../..');
const publicRoot = path.join(root, 'public');
const output = path.join(root, 'output/flagship-animation');
const stage = path.join(output, 'render-public');
const stagedArt = path.join(stage, 'art/flagship-animation');
const args = process.argv.slice(2);
const option = name => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const motion = args.includes('--motion');
const stills = args.includes('--stills') || !motion;
const clean = args.includes('--clean');
const concurrency = Number(option('concurrency') || 6);
const scale = Number(option('scale') || 1);
const name = option('name') || `OMERTA-Layered-Noir-Opening${clean ? '-clean' : ''}`;
const seconds = (option('times') || '0.4,1.7,3.5,6.5,12').split(',').map(Number);
if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Use letters, numbers, underscores, or hyphens in the output name.');
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 24) throw new Error('Concurrency must be 1–24.');
if (!(scale > 0 && scale <= 1)) throw new Error('Render scale must be greater than zero and no more than 1.');
const source = JSON.parse(fs.readFileSync(path.join(publicRoot, 'art/flagship-animation/opening-scene.json'), 'utf8'));
if (source.fps !== 24 || source.duration < 15 || source.duration > 25) throw new Error('The opening prototype must be 15–25 seconds at 24 fps.');
if (seconds.some(time => !Number.isFinite(time) || time < 0 || time >= source.duration)) throw new Error('A requested still is outside the opening scene.');
for (const name of ['background', 'nico', 'hand', 'envelope']) if (!source.layers?.[name]?.src) throw new Error(`Missing painted layer: ${name}`);
if (new Set(Object.values(source.layers).map(layer => layer.src)).size !== Object.values(source.layers).length) throw new Error('The physical scene needs separate, distinct painted layers.');
fs.mkdirSync(path.join(stagedArt, 'media'), {recursive: true});
let index = 0;
const stageFile = (src, audio = false) => {
  if (typeof src !== 'string' || src.includes(':') || src.split(/[\\/]/).includes('..') || path.isAbsolute(src)) throw new Error(`Invalid media path: ${src}`);
  if (!src.startsWith('art/flagship-animation/') && !(audio && src.startsWith('art/flagship-rebuild/audio/'))) throw new Error('Only animation art and the existing film audio are allowed in this composition.');
  if (!audio && /opening-reference|captures|screenshot/i.test(src)) throw new Error('The reference still and UI screenshots are not animated scene layers.');
  const original = path.resolve(publicRoot, src);
  if (!original.startsWith(publicRoot + path.sep) || !fs.existsSync(original)) throw new Error(`Missing animation asset: ${src}`);
  const destination = `art/flagship-animation/media/${String(++index).padStart(2, '0')}-${path.basename(src)}`;
  fs.copyFileSync(original, path.join(stage, destination));
  return destination;
};
const scene = {...source, layers: {}};
for (const [key, layer] of Object.entries(source.layers)) {
  if (layer.rect && (layer.rect.length !== 4 || layer.rect.some(value => !Number.isFinite(value)) || layer.rect[2] <= 0 || layer.rect[3] <= 0)) throw new Error(`Invalid geometry for ${key}.`);
  scene.layers[key] = {...layer, src: stageFile(layer.src)};
}
if (source.audio?.src) scene.audio = {...source.audio, src: stageFile(source.audio.src, true)};
fs.writeFileSync(path.join(stagedArt, 'opening-scene.json'), JSON.stringify(scene, null, 2));
console.log(`Layered 2.5D animation: ${source.duration}s, ${Object.keys(scene.layers).length} painted layers.`);
const serveUrl = await bundle({entryPoint: path.join(project, 'src/flagship-animation/index.ts'), publicDir: stage, rspack: false});
const inputProps = {clean, muteAudio: !motion || args.includes('--mute')};
const composition = (await getCompositions(serveUrl, {inputProps}))[0];
const rendered = [];
if (stills) {
  const stillProps = {...inputProps, muteAudio: true};
  const stillComposition = inputProps.muteAudio ? composition : (await getCompositions(serveUrl, {inputProps: stillProps}))[0];
  for (const second of seconds) {
    const frame = Math.round(second * source.fps);
    const file = `${name}-${second.toFixed(2).replace('.', 's')}.png`;
    await renderStill({serveUrl, composition: stillComposition, inputProps: stillProps, frame, output: path.join(output, file), imageFormat: 'png', scale});
    rendered.push({second, frame, file}); console.log(`Still: ${file}`);
  }
}
let video = null;
if (motion) {
  video = `${name}.mp4`; let lastLog = 0;
  await renderMedia({serveUrl, composition, inputProps, outputLocation: path.join(output, video), codec: 'h264', crf: 18, pixelFormat: 'yuv420p', colorSpace: 'bt709', audioBitrate: '256k', concurrency, scale, overwrite: true, onProgress: ({progress}) => {
    if (Date.now() - lastLog > 15000) {console.log(`Animation render: ${Math.round(progress * 100)}%`); lastLog = Date.now();}
  }});
  console.log(`Video: ${video}`);
}
fs.writeFileSync(path.join(output, `${name}-report.json`), JSON.stringify({createdAt: new Date().toISOString(), technique: 'Layered 2.5D animation with painted assets and frame-driven physical prop, character, rain, and lighting motion. Not generated video.', duration: source.duration, fps: source.fps, outputSize: [1920 * scale, 1080 * scale], layers: Object.keys(source.layers), video, stills: rendered}, null, 2));
