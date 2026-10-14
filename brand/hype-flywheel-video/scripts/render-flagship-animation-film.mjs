import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {bundle} from '@remotion/bundler';
import {getCompositions, renderMedia, renderStill} from '@remotion/renderer';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(project, '../..');
const publicRoot = path.join(root, 'public');
const artRoot = path.join(publicRoot, 'art/flagship-animation');
const output = path.join(root, 'output/flagship-animation');
const stage = path.join(output, 'render-public-film');
const stagedArt = path.join(stage, 'art/flagship-animation');
const args = process.argv.slice(2);
const option = name => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const full = args.includes('--full');
const from = option('from') === undefined ? undefined : Number(option('from'));
const to = option('to') === undefined ? undefined : Number(option('to'));
const motion = full || from !== undefined;
const stills = args.includes('--stills') || args.includes('--all-stills') || !motion;
const preview = args.includes('--preview');
const clean = args.includes('--clean');
const scale = Number(option('scale') || (preview && motion ? 0.5 : 1));
const concurrency = Number(option('concurrency') || 6);
const name = option('name') || `OMERTA-Animated-Noir-${full ? 'Film' : 'Excerpt'}${preview ? '-preview' : ''}${clean ? '-clean' : '-captioned'}`;
if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Output name must use letters, numbers, underscores, or hyphens.');
if (full && (from !== undefined || to !== undefined)) throw new Error('Choose the full film or an excerpt.');
if (!full && motion && (!Number.isFinite(from) || !Number.isFinite(to) || to <= from)) throw new Error('An excerpt needs valid --from and --to seconds.');
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 24) throw new Error('Concurrency must be 1–24.');
if (!(scale > 0 && scale <= 1)) throw new Error('Scale must be greater than zero and no more than 1.');
const rawFilm = fs.readFileSync(path.join(artRoot, 'film.json'), 'utf8');
const source = JSON.parse(rawFilm);
const sourceHash = createHash('sha256').update(rawFilm).digest('hex');
if (source.duration !== 390 || source.fps !== 24) throw new Error('The full film format is 390 seconds at 24 fps.');
if (!source.opening?.layers || !source.audio?.src || !source.shots?.length) throw new Error('The film needs the painted opening, audio, and story shots.');
const allowed = new Set(['opening', 'street', 'paths', 'drive', 'cargo', 'recruitment', 'approach', 'ambush', 'prison', 'loss', 'evidence', 'family', 'agent', 'balances', 'fees', 'bonds', 'liquidity', 'rwa', 'closing', 'end']);
const storyAssetPath = key => {
  if (typeof key !== 'string' || key.includes(':') || key.split(/[\\/]/).includes('..')) throw new Error(`Invalid story asset: ${key}`);
  return key.startsWith('art/flagship-animation/') ? key : `art/flagship-animation/${key}${/\.(png|jpe?g|webp|svg)$/i.test(key) ? '' : '.png'}`;
};
const ids = new Set(); let previous = source.shots[0].start === 15 ? 15 : 0;
for (const shot of source.shots) {
  if (!allowed.has(shot.scene)) throw new Error(`Unknown animated scene: ${shot.scene}`);
  if (!/^[a-zA-Z0-9_-]+$/.test(shot.id) || ids.has(shot.id)) throw new Error(`Invalid or duplicate shot ID: ${shot.id}`);
  ids.add(shot.id);
  if (Math.abs(shot.start - previous) > 0.00001 || !(shot.end > shot.start)) throw new Error(`Timeline gap or overlap: ${shot.id}`);
  previous = shot.end;
  if (shot.asset && /captures|screenshot/i.test(shot.asset)) throw new Error(`Story art must belong to the animation: ${shot.id}`);
  if (shot.asset && !fs.existsSync(path.resolve(publicRoot, storyAssetPath(shot.asset)))) throw new Error(`Missing painted story art: ${shot.asset}`);
}
if (previous !== source.duration && Math.abs(previous - 379) > 1 / source.fps) throw new Error('The film must finish at 390 seconds, or leave 379–390 for its end card.');
for (const cue of source.captions || []) if (!(cue.endMs > cue.startMs) || cue.startMs < 0 || cue.endMs > source.duration * 1000 + 1) throw new Error('Invalid global caption timing.');
const seconds = args.includes('--all-stills') ? source.shots.map(shot => (shot.start + shot.end) / 2) : (option('times') || '1.7,18,56,98,134,160,195,230,267,287,321,361,384').split(',').map(Number);
if (seconds.some(time => !Number.isFinite(time) || time < 0 || time >= source.duration)) throw new Error('A still time is outside the film.');
fs.mkdirSync(stagedArt, {recursive: true});
let artFiles = 0;
const stageArt = directory => {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const original = path.join(directory, entry.name);
    if (entry.isDirectory()) stageArt(original);
    else if (entry.isFile() && /\.(png|jpe?g|webp|svg)$/i.test(entry.name)) {
      const relative = path.relative(artRoot, original);
      const target = path.join(stagedArt, relative);
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.copyFileSync(original, target); artFiles++;
    }
  }
};
stageArt(artRoot);
const stageAudio = src => {
  if (typeof src !== 'string' || src.includes(':') || src.split(/[\\/]/).includes('..') || path.isAbsolute(src)) throw new Error(`Invalid audio path: ${src}`);
  if (!src.startsWith('art/flagship-animation/') && !src.startsWith('art/flagship-rebuild/audio/')) throw new Error('Use the approved animation or rebuild audio.');
  const original = path.resolve(publicRoot, src);
  if (!original.startsWith(publicRoot + path.sep) || !fs.existsSync(original)) throw new Error(`Missing film audio: ${src}`);
  const relative = `art/flagship-animation/audio/${path.basename(src)}`;
  fs.mkdirSync(path.dirname(path.join(stage, relative)), {recursive: true});
  fs.copyFileSync(original, path.join(stage, relative));
  return relative;
};
const audio = {...source.audio, src: stageAudio(source.audio.src)};
const opening = {...source.opening, audio: source.opening.audio ? {...source.opening.audio, src: stageAudio(source.opening.audio.src)} : audio};
const film = {...source, audio, opening};
fs.writeFileSync(path.join(stagedArt, 'film.json'), JSON.stringify(film, null, 2));
fs.writeFileSync(path.join(stagedArt, 'opening-scene.json'), JSON.stringify(opening, null, 2));
const timecode = value => {
  const ms = Math.round(value); const h = Math.floor(ms / 3600000); const m = Math.floor(ms / 60000) % 60; const s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
fs.writeFileSync(path.join(output, 'OMERTA-Animated-Noir.srt'), (source.captions || []).map((cue, i) => `${i + 1}\n${timecode(cue.startMs)} --> ${timecode(cue.endMs)}\n${cue.text.trim()}\n`).join('\n'));
fs.writeFileSync(path.join(output, 'OMERTA-Animated-Noir.vtt'), 'WEBVTT\n\n' + (source.captions || []).map(cue => `${timecode(cue.startMs).replace(',', '.')} --> ${timecode(cue.endMs).replace(',', '.')}\n${cue.text.trim()}\n`).join('\n'));
console.log(`Animated noir film: ${source.shots.length} shots, ${source.duration}s, ${artFiles} painted assets.`);
const serveUrl = await bundle({entryPoint: path.join(project, 'src/flagship-animation/index.ts'), publicDir: stage, rspack: false});
const inputProps = {clean, muteAudio: !motion || args.includes('--mute')};
const composition = (await getCompositions(serveUrl, {inputProps})).find(comp => comp.id === 'Omerta-Animated-Noir-Film');
if (!composition) throw new Error('The full animated film composition was not registered.');
const rendered = [];
if (stills) {
  const stillProps = {...inputProps, muteAudio: true};
  const stillComposition = inputProps.muteAudio ? composition : (await getCompositions(serveUrl, {inputProps: stillProps})).find(comp => comp.id === composition.id);
  for (const second of seconds) {
    const frame = Math.min(composition.durationInFrames - 1, Math.round(second * source.fps));
    const shot = source.shots.find(value => second >= value.start && second < value.end);
    const file = `film-${shot?.id || 'end'}-${second.toFixed(2).replace('.', 's')}${clean ? '-clean' : ''}.png`;
    await renderStill({serveUrl, composition: stillComposition, inputProps: stillProps, frame, output: path.join(output, file), imageFormat: 'png', scale});
    rendered.push({shot: shot?.id, second, frame, file}); console.log(`Still: ${file}`);
  }
}
let video = null; let frameRange;
if (motion) {
  frameRange = full ? [0, composition.durationInFrames - 1] : [Math.round(from * source.fps), Math.round(to * source.fps) - 1];
  if (frameRange[0] < 0 || frameRange[1] >= composition.durationInFrames || frameRange[1] < frameRange[0]) throw new Error('Excerpt range is outside the film.');
  const seconds = (frameRange[1] - frameRange[0] + 1) / source.fps;
  const previewKbps = Math.max(500, Math.min(5000, Math.round(5.5 * 1024 * 1024 * 8 / seconds / 1000 - 128)));
  video = `${name}.mp4`; let lastLog = 0;
  await renderMedia({serveUrl, composition, inputProps, outputLocation: path.join(output, video), codec: 'h264', ...(preview ? {videoBitrate: `${previewKbps}k`} : {crf: 19}), pixelFormat: 'yuv420p', colorSpace: 'bt709', audioBitrate: preview ? '128k' : '256k', concurrency, scale, frameRange, overwrite: true, onProgress: ({progress}) => {
    if (Date.now() - lastLog > 15000) {console.log(`Film render: ${Math.round(progress * 100)}%`); lastLog = Date.now();}
  }});
  console.log(`Video: ${video}`);
}
fs.writeFileSync(path.join(output, `${name}-report.json`), JSON.stringify({createdAt: new Date().toISOString(), sourceHash, technique: 'Layered animated noir with generated painted assets and frame-driven animation; no website screenshots.', duration: source.duration, fps: source.fps, outputSize: [1920 * scale, 1080 * scale], frameRange, artFiles, captions: clean ? 'sidecars' : 'burned-in + sidecars', video, stills: rendered}, null, 2));
