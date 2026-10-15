import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {getCompositions, renderMedia, renderStill} from '@remotion/renderer';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(project, '../..');
const output = path.join(root, 'output/flagship-rebuild');
const publicRoot = path.join(root, 'public');
const stage = path.join(output, 'render-public');
const stagedArt = path.join(stage, 'art/flagship-rebuild');
const args = process.argv.slice(2);
const option = name => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const full = args.includes('--full');
const from = option('from') === undefined ? undefined : Number(option('from'));
const to = option('to') === undefined ? undefined : Number(option('to'));
const rawFrames = option('frames')?.split('-').map(Number);
const motion = full || from !== undefined || rawFrames !== undefined;
const stills = args.includes('--stills') || args.includes('--all-stills') || !motion;
const clean = args.includes('--clean');
const muteAudio = !motion || args.includes('--mute');
const requested = option('beats')?.split(',');
const moments = (option('moments') || '0.55').split(',').map(Number);
const scale = Number(option('scale') || 1);
const concurrency = Number(option('concurrency') || 4);
const name = option('name') || `OMERTA-Flagship-Rebuild-${full ? '1080' : 'motion-review'}${clean ? '-clean' : ''}`;
if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Output name must use letters, numbers, underscores, or hyphens.');
if (full && (from !== undefined || rawFrames)) throw new Error('Use --full or an excerpt range.');
if (from !== undefined && (to === undefined || !Number.isFinite(from) || !Number.isFinite(to) || to <= from)) throw new Error('An excerpt needs valid --from and --to seconds.');
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) throw new Error('Concurrency must be 1–32.');
if (!(scale > 0 && scale <= 1)) throw new Error('Scale must be greater than zero and no more than 1.');
if (moments.some(value => !Number.isFinite(value) || value < 0 || value >= 1)) throw new Error('Still moments must be between 0 and 1.');

const production = JSON.parse(fs.readFileSync(path.join(publicRoot, 'art/flagship-rebuild/production-data.json'), 'utf8'));
const sourceManifest = JSON.parse(fs.readFileSync(path.join(publicRoot, 'art/flagship-rebuild/manifest.json'), 'utf8'));
const manifest = {...sourceManifest, assets: {}};
const film = production.film; const fps = film.fps;
if (fps !== 24 || film.duration !== 390) throw new Error('The approved film format is 390 seconds at 24 fps.');
const ffprobe = path.join(project, 'node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe');
fs.mkdirSync(path.join(stagedArt, 'media'), {recursive: true});
const staged = new Map();
const stageFile = src => {
  if (typeof src !== 'string' || src.includes(':') || src.split(/[\\/]/).includes('..') || path.isAbsolute(src)) throw new Error(`Media must be a public-relative path: ${src}`);
  const absolute = path.resolve(publicRoot, src);
  if (!absolute.startsWith(publicRoot + path.sep) || !fs.existsSync(absolute)) throw new Error(`Missing referenced media: ${src}`);
  if (staged.has(absolute)) return staged.get(absolute);
  const relative = `art/flagship-rebuild/media/${String(staged.size + 1).padStart(3, '0')}-${path.basename(src)}`;
  fs.copyFileSync(absolute, path.join(stage, relative));
  staged.set(absolute, relative);
  return relative;
};
let end = 0; const ids = new Set();
for (const beat of film.beats) {
  if (ids.has(beat.id) || !/^[a-zA-Z0-9_-]+$/.test(beat.id)) throw new Error(`Invalid or duplicate shot ID: ${beat.id}`);
  ids.add(beat.id);
  if (Math.abs(beat.start - end) > 0.00001 || !(beat.end > beat.start)) throw new Error(`Timeline gap or overlap: ${beat.id}`);
  if (!['gameplay', 'cinema', 'type', 'flow', 'end'].includes(beat.kind)) throw new Error(`Unknown scene kind: ${beat.kind}`);
  end = beat.end;
  if (beat.camera?.length && beat.camera.some((key, i) => key.at < 0 || key.at > 1 || (i > 0 && key.at <= beat.camera[i - 1].at))) throw new Error(`Invalid camera keyframes: ${beat.id}`);
  for (const focus of [beat.focus, beat.endFocus, ...(beat.camera || [])].filter(Boolean)) {
    if (Object.values(focus).some(value => !Number.isFinite(value)) || (focus.scale !== undefined && focus.scale < 1)) throw new Error(`Invalid camera focus: ${beat.id}`);
  }
  for (const id of [beat.asset, beat.capture].filter(Boolean)) {
    const asset = sourceManifest.assets?.[id];
    if (!asset || !(asset.width > 0) || !(asset.height > 0) || asset.width > 32768 || asset.height > 32768) throw new Error(`Invalid media dimensions: ${id}`);
    if (manifest.assets[id]) continue;
    const copy = {...asset};
    if (asset.type === 'video' && !(asset.duration > 0)) {
      const probe = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', path.resolve(publicRoot, asset.src)], {encoding: 'utf8'}));
      copy.duration = Number(probe.format?.duration);
    }
    copy.src = stageFile(asset.src);
    manifest.assets[id] = copy;
  }
  if (beat.kind === 'gameplay' && !beat.capture) throw new Error(`Gameplay shot needs a genuine capture: ${beat.id}`);
  if (beat.kind === 'cinema' && !beat.asset) throw new Error(`Cinema shot needs media: ${beat.id}`);
  if (beat.kind === 'flow' && !beat.labels?.length) throw new Error(`Flow shot needs source-grounded labels: ${beat.id}`);
}
if (Math.abs(end - film.duration) > 0.00001) throw new Error('Final shot does not match film duration.');
if (requested?.some(id => !ids.has(id))) throw new Error('A requested still shot does not exist.');
if (sourceManifest.audio?.src) manifest.audio = {...sourceManifest.audio, src: stageFile(sourceManifest.audio.src)};
const logo = typeof sourceManifest.brandLogo === 'string' ? sourceManifest.brandLogo : sourceManifest.brandLogo?.src;
if (logo) manifest.brandLogo = stageFile(logo);
fs.writeFileSync(path.join(stagedArt, 'production-data.json'), JSON.stringify(production, null, 2));
fs.writeFileSync(path.join(stagedArt, 'manifest.json'), JSON.stringify(manifest, null, 2));
const subtitleTime = value => {
  const ms = Math.round(value); const h = Math.floor(ms / 3600000); const m = Math.floor(ms / 60000) % 60; const s = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
const cues = production.captions || [];
for (const cue of cues) if (!(cue.endMs > cue.startMs) || cue.startMs < 0 || cue.endMs > film.duration * 1000 + 1) throw new Error('Invalid caption timing.');
fs.writeFileSync(path.join(output, 'OMERTA-Flagship-Rebuild.srt'), cues.map((cue, i) => `${i + 1}\n${subtitleTime(cue.startMs)} --> ${subtitleTime(cue.endMs)}\n${cue.text.trim()}\n`).join('\n'));
fs.writeFileSync(path.join(output, 'OMERTA-Flagship-Rebuild.vtt'), 'WEBVTT\n\n' + cues.map(cue => `${subtitleTime(cue.startMs).replace(',', '.')} --> ${subtitleTime(cue.endMs).replace(',', '.')}\n${cue.text.trim()}\n`).join('\n'));
console.log(`Motion edit: ${film.beats.length} shots, ${film.duration} seconds, ${staged.size} referenced media files.`);
const serveUrl = await bundle({entryPoint: path.join(project, 'src/flagship-rebuild/index.ts'), publicDir: stage, rspack: false});
const inputProps = {clean, muteAudio};
const composition = (await getCompositions(serveUrl, {inputProps}))[0];
const defaultIds = [film.beats[0]?.id, film.beats.find(beat => beat.kind === 'gameplay')?.id, film.beats.find(beat => beat.kind === 'flow')?.id].filter(Boolean);
const samples = args.includes('--all-stills') ? film.beats : film.beats.filter(beat => (requested || defaultIds).includes(beat.id));
const renderedStills = [];
if (stills) for (const beat of samples) for (const moment of moments) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round((beat.start + (beat.end - beat.start) * moment) * fps));
  const file = `${beat.id}-${String(Math.round(moment * 100)).padStart(2, '0')}${clean ? '-clean' : ''}.png`;
  await renderStill({serveUrl, composition, inputProps: {...inputProps, muteAudio: true}, frame, output: path.join(output, file), imageFormat: 'png', scale});
  renderedStills.push({beat: beat.id, moment, frame, file});
  console.log(`Still: ${file}`);
}
let video = null; let frameRange;
if (motion) {
  frameRange = rawFrames || (full ? [0, composition.durationInFrames - 1] : [Math.round(from * fps), Math.round(to * fps) - 1]);
  if (frameRange.length !== 2 || frameRange.some(value => !Number.isInteger(value)) || frameRange[0] < 0 || frameRange[1] >= composition.durationInFrames || frameRange[1] < frameRange[0]) throw new Error('Excerpt frame range is outside the film.');
  video = `${name}.mp4`;
  let lastLog = 0;
  await renderMedia({serveUrl, composition, inputProps, outputLocation: path.join(output, video), codec: 'h264', crf: 19, pixelFormat: 'yuv420p', colorSpace: 'bt709', audioBitrate: '256k', concurrency, scale, frameRange, overwrite: true, onProgress: ({progress}) => {
    if (Date.now() - lastLog > 15000) {console.log(`Motion render: ${Math.round(progress * 100)}%`); lastLog = Date.now();}
  }});
  console.log(`Video: ${video}`);
}
const kindSeconds = film.beats.reduce((sum, beat) => ({...sum, [beat.kind]: (sum[beat.kind] || 0) + beat.end - beat.start}), {});
fs.writeFileSync(path.join(output, `render-report-${motion ? name : 'stills'}.json`), JSON.stringify({createdAt: new Date().toISOString(), title: film.title, duration: film.duration, fps, fullMotion: true, outputSize: [1920 * scale, 1080 * scale], sourceResolution: 'Mixed source dimensions; inspect manifest for native media sizes.', kindSeconds, captionMode: clean ? 'sidecars' : 'burned-in + sidecars', frameRange, video, stills: renderedStills}, null, 2));
