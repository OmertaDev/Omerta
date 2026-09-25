import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {getCompositions, renderMedia, renderStill} from '@remotion/renderer';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(project, '../..');
const output = path.join(root, 'output/omerta-connected-city');
fs.mkdirSync(output, {recursive: true});
const serveUrl = await bundle({entryPoint: path.join(project, 'src/hook-campaign/index.tsx'), publicDir: path.join(root, 'public'), rspack: false});
const compositions = await getCompositions(serveUrl);
const previewOnly = process.argv.includes('--stills');
const selected = process.argv.find(a => a.startsWith('--id='))?.slice(5);
const voicePath = path.join(root, 'public/art/hook-campaign/voice-manifest.json');
if (fs.existsSync(voicePath)) {
  const voice = JSON.parse(fs.readFileSync(voicePath, 'utf8'));
  const stamp = seconds => new Date(Math.round(seconds * 1000)).toISOString().slice(11, 23);
  const cues = Object.entries(voice.clips).filter(([, clip]) => clip.status === 'downloaded').map(([index, clip]) => {
    const start = Number(index) * 230 / 30 + 0.4;
    return {start: stamp(start), end: stamp(start + Math.min(clip.duration, 6.9)), text: clip.text};
  });
  fs.writeFileSync(path.join(output, 'Omerta-ConnectedCity.vtt'), 'WEBVTT\n\n' + cues.map(c => `${c.start} --> ${c.end}\n${c.text}`).join('\n\n'));
  fs.writeFileSync(path.join(output, 'Omerta-ConnectedCity.srt'), cues.map((c, i) => `${i + 1}\n${c.start.replace('.', ',')} --> ${c.end.replace('.', ',')}\n${c.text}`).join('\n\n'));
}
const summary = [];
for (const composition of compositions.filter(c => !selected || c.id === selected)) {
  const film = composition.props.film;
  const outputLocation = path.join(output, `${composition.id}.mp4`);
  await renderStill({serveUrl, composition, frame: 100, output: path.join(output, `${composition.id}.png`), imageFormat: 'png'});
  // Storyboard evidence covers every shot at full reveal, not only the poster frame.
  for (let index = 0; index < film.shots.length; index++) {
    await renderStill({serveUrl, composition, frame: index * 230 + 100, output: path.join(output, `${composition.id}-${index + 1}.jpg`), imageFormat: 'jpeg', scale: 0.5});
  }
  if (!previewOnly) {
    console.log(`Rendering ${composition.id}`);
    let last = 0;
    await renderMedia({serveUrl, composition, codec: 'h264', outputLocation, crf: 20, pixelFormat: 'yuv420p', concurrency: 4, overwrite: true, onProgress: ({progress}) => {
      if (Date.now() - last > 15000) {console.log(`${composition.id}: ${Math.round(progress * 100)}%`); last = Date.now();}
    }});
  }
  summary.push({id: composition.id, title: film.title, durationSeconds: composition.durationInFrames / composition.fps, width: composition.width, height: composition.height, rendered: !previewOnly});
}
fs.writeFileSync(path.join(output, selected ? `manifest-${selected}.json` : 'manifest.json'), JSON.stringify(summary, null, 2));
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
fs.writeFileSync(path.join(output, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Omertà — The Connected City</title><style>body{margin:0;padding:48px;background:#090d0e;color:#f1e9d7;font:18px/1.5 Arial}header{max-width:850px;margin-bottom:40px}h1{font:60px Georgia;margin:0;color:#c7af79}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:28px}article{max-width:440px}video{width:100%;background:black}h2{font:28px Georgia}a{color:#c7af79}small{color:#bbb}p{max-width:800px}</style><header><h1>The city is connected.</h1><p>One overview and six feature films. Hook / Market · World Graph · Omerta Coordination Engine.</p><small>1080 × 1920 · 30 fps · Narrated overview; six silent chapters designed for sound-off viewing. Cinematic art is illustrative, not gameplay footage. System availability is marked within each film.</small></header><main>${compositions.map(c => `<article><video controls preload="none" poster="${escape(c.id)}.png" src="${escape(c.id)}.mp4"></video><h2>${escape(c.props.film.title)}</h2><a href="${escape(c.id)}.mp4" download>Download MP4</a> · ${(c.durationInFrames / c.fps).toFixed(1)}s</article>`).join('')}</main></html>`);
console.log(`Campaign ready: ${output}`);
