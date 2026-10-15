import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {getCompositions, renderMedia, renderStill} from '@remotion/renderer';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(project, '../..');
const output = path.join(root, 'output/flagship-trust');
const publicRoot = path.join(root, 'public');
const stage = path.join(output, 'render-public');
const stagedArt = path.join(stage, 'art/flagship-trust');
const production = JSON.parse(fs.readFileSync(path.join(root, 'brand/flagship-trust/production-data.json'), 'utf8'));
const sourceManifest = JSON.parse(fs.readFileSync(path.join(publicRoot, 'art/flagship-trust/manifest.json'), 'utf8'));
const manifest = {...sourceManifest, assets: {}, fonts: []};
const film = production.film;
const fps = film.fps || 24;
const full = process.argv.includes('--full');
const animatic = process.argv.includes('--animatic');
const reuseStills = process.argv.includes('--reuse-stills');
const allStills = process.argv.includes('--all-stills') || animatic;
const fullStills = process.argv.includes('--full-stills') || animatic;
const clean = process.argv.includes('--clean') || animatic;
const requested = process.argv.find(value => value.startsWith('--beats='))?.slice(8).split(',');
const concurrency = Number(process.argv.find(value => value.startsWith('--concurrency='))?.split('=')[1] || 4);
const ffmpeg = path.join(project, 'node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe');
const ffprobe = path.join(project, 'node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe');
if (full && animatic) throw new Error('Choose either --full or --animatic.');
if (reuseStills && !animatic) throw new Error('--reuse-stills is only for an animatic encode retry.');
if (reuseStills && JSON.stringify(JSON.parse(fs.readFileSync(path.join(stagedArt, 'production-data.json'), 'utf8'))) !== JSON.stringify(production)) throw new Error('The timeline changed; render new stills before encoding.');
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) throw new Error('Concurrency must be between 1 and 32.');
if (fps !== 24) throw new Error('The flagship uses a 24 fps timeline.');
fs.mkdirSync(path.join(stagedArt, 'media'), {recursive: true});
const staged = new Map();
const stageFile = src => {
  if (typeof src !== 'string' || src.includes(':') || src.split(/[\\/]/).includes('..') || path.isAbsolute(src)) throw new Error(`Media must be a public-relative path: ${src}`);
  const absolute = path.resolve(publicRoot, src);
  if (!absolute.startsWith(publicRoot + path.sep) || !fs.existsSync(absolute)) throw new Error(`Missing authorized media: ${src}`);
  if (staged.has(absolute)) return staged.get(absolute);
  const relative = `art/flagship-trust/media/${String(staged.size + 1).padStart(3, '0')}-${path.basename(src)}`;
  fs.copyFileSync(absolute, path.join(stage, relative));
  staged.set(absolute, relative);
  return relative;
};
let end = 0;
for (const beat of film.beats) {
  if (Math.abs(beat.start - end) > 1 / fps || !(beat.end > beat.start)) throw new Error(`Timeline gap or overlap: ${beat.id}`);
  if (!['dossier', 'gameplay', 'diagram', 'end'].includes(beat.kind)) throw new Error(`Unknown scene kind: ${beat.kind}`);
  end = beat.end;
  for (const id of [beat.asset, beat.capture].filter(Boolean)) {
    const asset = sourceManifest.assets?.[id];
    if (!asset || !(asset.width > 0) || !(asset.height > 0) || asset.width > 32768 || asset.height > 32768) throw new Error(`Missing or invalid decoded asset dimensions: ${id}`);
    if (manifest.assets[id]) continue;
    const copy = {...asset};
    if (asset.type === 'video' && !(asset.duration > 0)) {
      const probe = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', path.resolve(publicRoot, asset.src)], {encoding: 'utf8'}));
      copy.duration = Number(probe.format?.duration);
    }
    copy.src = stageFile(asset.src);
    manifest.assets[id] = copy;
  }
  if (beat.kind === 'gameplay' && !beat.capture) throw new Error(`Gameplay requires a genuine UI capture key: ${beat.id}`);
  if (beat.kind === 'diagram' && !beat.labels?.length) throw new Error(`Diagram has no source-grounded labels: ${beat.id}`);
}
if (Math.abs(end - film.duration) > 1 / fps) throw new Error('Final scene does not match film duration.');
if (sourceManifest.audio?.src) manifest.audio = {...sourceManifest.audio, src: stageFile(sourceManifest.audio.src)};
const logo = typeof sourceManifest.brandLogo === 'string' ? sourceManifest.brandLogo : sourceManifest.brandLogo?.src;
if (logo) manifest.brandLogo = stageFile(logo);
for (const font of sourceManifest.fonts || []) manifest.fonts.push({...font, src: stageFile(font.src)});
fs.writeFileSync(path.join(stagedArt, 'production-data.json'), JSON.stringify(production, null, 2));
fs.writeFileSync(path.join(stagedArt, 'manifest.json'), JSON.stringify(manifest, null, 2));
const verifiedVisualSeconds = film.beats.filter(beat => beat.kind === 'diagram' || beat.capture).reduce((sum, beat) => sum + beat.end - beat.start, 0);
console.log(`Flagship animatic: ${film.duration}s, ${film.beats.length} modular scenes, ${staged.size} referenced media files. UI/graphic presence: ${(100 * verifiedVisualSeconds / film.duration).toFixed(1)}%.`);
const serveUrl = reuseStills ? null : await bundle({entryPoint: path.join(project, 'src/flagship-trust/index.ts'), publicDir: stage, rspack: false});
const inputProps = {clean, muteAudio: !full};
const composition = reuseStills ? {durationInFrames: Math.round(film.duration * fps)} : (await getCompositions(serveUrl, {inputProps}))[0];
const defaultIds = [film.beats[0]?.id, film.beats.find(beat => beat.kind === 'gameplay')?.id].filter(Boolean);
const samples = allStills ? film.beats : film.beats.filter(beat => (requested || defaultIds).includes(beat.id));
const stills = [];
for (const beat of samples) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round((beat.start + (beat.end - beat.start) * 0.55) * fps));
  const name = `${beat.id}${clean ? '-clean' : ''}.png`;
  if (reuseStills) {
    const png = fs.readFileSync(path.join(output, name));
    if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.readUInt32BE(16) !== 1920 || png.readUInt32BE(20) !== 1080) throw new Error(`A full-resolution clean still is missing: ${name}`);
  } else await renderStill({serveUrl, composition, inputProps, frame, output: path.join(output, name), imageFormat: 'png', scale: fullStills ? 1 : 0.5});
  stills.push({beat: beat.id, frame, file: name, start: beat.start, end: beat.end});
}
const subtitleTime = value => {
  const ms = Math.round(value); const hours = Math.floor(ms / 3600000); const minutes = Math.floor(ms / 60000) % 60; const seconds = Math.floor(ms / 1000) % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
const subtitleName = 'OMERTA-Trust-Is-The-Game.srt';
fs.writeFileSync(path.join(output, subtitleName), (production.captions || []).map((caption, index) => `${index + 1}\n${subtitleTime(caption.startMs)} --> ${subtitleTime(caption.endMs)}\n${caption.text.trim()}\n`).join('\n'));
fs.writeFileSync(path.join(output, 'OMERTA-Trust-Is-The-Game.vtt'), 'WEBVTT\n\n' + (production.captions || []).map(caption => `${subtitleTime(caption.startMs).replace(',', '.')} --> ${subtitleTime(caption.endMs).replace(',', '.')}\n${caption.text.trim()}\n`).join('\n'));
let video = null;
let embeddedSubtitles = false;
if (animatic) {
  video = 'OMERTA-Trust-Is-The-Game-ROUGH-ANIMATIC.mp4';
  const lastStill = stills[stills.length - 1];
  const lastFrames = Math.round(lastStill.end * fps) - Math.round(lastStill.start * fps);
  // Dense final-card packets prevent sparse-image EOF synchronization from shortening the video stream.
  const list = stills.slice(0, -1).map(still => `file '${still.file}'\noption framerate ${fps}\nduration ${(still.end - still.start).toFixed(9)}`).join('\n') + '\n' + Array.from({length: lastFrames}, () => `file '${lastStill.file}'\noption framerate ${fps}\nduration ${(1 / fps).toFixed(9)}`).join('\n') + '\n';
  fs.writeFileSync(path.join(output, 'animatic-inputs.txt'), list);
  const audio = manifest.audio?.src ? path.join(stage, manifest.audio.src) : null;
  const subtitleFormats = execFileSync(ffmpeg, ['-hide_banner', '-demuxers'], {encoding: 'utf8'});
  const subtitleEncoders = execFileSync(ffmpeg, ['-hide_banner', '-encoders'], {encoding: 'utf8'});
  const subtitles = (production.captions || []).length > 0 && /\bsrt\b/.test(subtitleFormats) && /\bmov_text\b/.test(subtitleEncoders);
  embeddedSubtitles = subtitles;
  if (!subtitles && production.captions?.length) console.log('Bundled FFmpeg has no subtitle support. Using the SRT/VTT sidecars; the browser review must load the VTT track.');
  execFileSync(ffmpeg, ['-v', 'warning', '-y', '-f', 'concat', '-safe', '0', '-i', 'animatic-inputs.txt', ...(audio ? ['-i', audio] : []), ...(subtitles ? ['-i', subtitleName] : []), '-map', '0:v:0', ...(audio ? ['-map', '1:a:0'] : []), ...(subtitles ? ['-map', `${audio ? 2 : 1}:0`] : []), '-t', String(film.duration), '-r', String(fps), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', ...(audio ? ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000'] : ['-an']), ...(subtitles ? ['-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng', '-metadata:s:s:0', 'title=English', '-disposition:s:0', 'default'] : []), '-movflags', '+faststart', video], {cwd: output, stdio: 'inherit'});
} else if (full) {
  video = `OMERTA-Trust-Is-The-Game-${clean ? 'clean' : 'captioned'}-1080.mp4`;
  let lastLog = 0;
  await renderMedia({serveUrl, composition, inputProps, outputLocation: path.join(output, video), codec: 'h264', crf: 18, pixelFormat: 'yuv420p', colorSpace: 'bt709', audioBitrate: '256k', concurrency, overwrite: true, onProgress: ({progress}) => {
    if (Date.now() - lastLog > 15000) {console.log(`${Math.round(progress * 100)}%`); lastLog = Date.now();}
  }});
}
fs.writeFileSync(path.join(output, `render-report-${animatic ? 'animatic' : full ? 'full' : 'stills'}.json`), JSON.stringify({createdAt: new Date().toISOString(), title: film.title, duration: film.duration, fps, roughAnimatic: true, stillBased: animatic, verifiedVisualSeconds, verifiedVisualPercent: 100 * verifiedVisualSeconds / film.duration, captionMode: animatic ? embeddedSubtitles ? 'mov_text + SRT + VTT' : 'SRT + VTT browser track' : clean ? 'clean' : 'burned-in', limitation: animatic && !embeddedSubtitles ? 'Bundled FFmpeg lacks subtitle decoding and mov_text encoding. This rough MP4 requires the VTT browser track or SRT sidecar for captions.' : null, video, stills}, null, 2));
