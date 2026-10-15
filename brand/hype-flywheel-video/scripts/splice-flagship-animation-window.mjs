import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(project, '../..');
const output = path.join(root, 'output/flagship-animation');
const work = path.join(output, 'patch-A57');
const binaries = path.join(project, 'node_modules/@remotion/compositor-win32-x64-msvc');
const ffmpeg = path.join(binaries, 'ffmpeg.exe');
const ffprobe = path.join(binaries, 'ffprobe.exe');
const fps = 24;
const first = 7222;
const after = 7425;
const total = 9360;
const end = after / fps;
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run = args => execFileSync(ffmpeg, ['-v', 'error', '-y', ...args], {maxBuffer: 4 * 1024 * 1024});
const probe = (file, args) => JSON.parse(execFileSync(ffprobe, ['-v', 'error', ...args, '-of', 'json', file], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024}));
const packets = (file, stream) => probe(file, ['-select_streams', stream, '-show_packets', '-show_data_hash', 'sha256', '-show_entries', 'packet=pts,dts,duration,flags,data_hash']).packets;
const videoInfo = file => probe(file, ['-select_streams', 'v:0', '-show_entries', 'stream=nb_frames,duration,avg_frame_rate,time_base,width,height']).streams[0];
const codecHeader = file => probe(file, ['-select_streams', 'v:0', '-show_streams', '-show_data_hash', 'sha256', '-show_entries', 'stream=extradata_hash']).streams[0].extradata_hash;
const ensure = (condition, message) => {if (!condition) throw new Error(message);};
const report = {createdAt: new Date().toISOString(), shot: 'A57', correction: 'Moved Funded Window label from y=291 to y=211, above the conversion arrow.', firstCorrectedFrame: first, afterLastCorrectedFrame: after, correctedSceneFrames: after - first, fps, method: 'Stream-copy video at existing keyframes; preserve original AAC packets. Clean replacement includes 172 preceding frames to reach its previous keyframe.', storySourceHash: hash(path.join(project, 'src/flagship-animation/StoryScene.tsx')), variants: []};
fs.mkdirSync(work, {recursive: true});

for (const variant of [{suffix: '', patch: 'OMERTA-Animated-A57-Fix', first: 7222}, {suffix: '-Clean', patch: 'OMERTA-Animated-A57-Fix-Clean', first: 7050}]) {
  const first = variant.first;
  const start = first / fps;
  const length = (after - first) / fps;
  const name = `OMERTA-Trust-Is-The-Game-Animated${variant.suffix}-1080`;
  const master = path.join(output, `${name}.mp4`);
  const patch = path.join(output, `${variant.patch}.mp4`);
  const directory = path.join(work, variant.suffix ? 'clean' : 'captioned');
  fs.mkdirSync(directory, {recursive: true});
  const original = path.join(directory, `${name}-original.mp4`);
  if (!fs.existsSync(original)) fs.copyFileSync(master, original);
  const originalInfo = videoInfo(original);
  const patchInfo = videoInfo(patch);
  ensure(Number(originalInfo.nb_frames) === total && originalInfo.avg_frame_rate === '24/1', `${name}: unexpected original format`);
  ensure(Number(patchInfo.nb_frames) === after - first && patchInfo.avg_frame_rate === '24/1', `${name}: replacement must contain exactly ${after - first} frames`);
  ensure(originalInfo.width === 1920 && originalInfo.height === 1080 && patchInfo.width === 1920 && patchInfo.height === 1080, `${name}: expected 1080p`);
  ensure(codecHeader(original) === codecHeader(patch), `${name}: codec headers must match for unchanged-packet concatenation`);
  const originalPackets = packets(original, 'v:0');
  const ticksPerFrame = Number(originalInfo.time_base.split('/')[1]) / fps;
  ensure(originalInfo.time_base.startsWith('1/'), `${name}: unexpected time base`);
  for (const boundary of [first, after]) ensure(originalPackets[boundary].flags.includes('K') && originalPackets[boundary].pts === boundary * ticksPerFrame, `${name}: splice boundary is not an exact keyframe`);
  const beforeFile = path.join(directory, 'before.mp4');
  const replacementFile = path.join(directory, 'replacement.mp4');
  const afterFile = path.join(directory, 'after.mp4');
  run(['-i', original, '-map', '0:v:0', '-c:v', 'copy', '-an', '-frames:v', String(first), beforeFile]);
  run(['-i', patch, '-map', '0:v:0', '-c:v', 'copy', '-an', replacementFile]);
  run(['-ss', String(end), '-i', original, '-map', '0:v:0', '-c:v', 'copy', '-an', afterFile]);
  const list = path.join(directory, 'segments.txt');
  fs.writeFileSync(list, `file 'before.mp4'\nduration ${start.toFixed(12)}\nfile 'replacement.mp4'\nduration ${length.toFixed(12)}\nfile 'after.mp4'\nduration ${((total - after) / fps).toFixed(12)}\n`);
  const candidate = path.join(directory, `${name}-patched.mp4`);
  run(['-f', 'concat', '-safe', '0', '-auto_convert', '0', '-i', list, '-i', original, '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', '-movflags', '+faststart', candidate]);
  const info = videoInfo(candidate);
  ensure(Number(info.nb_frames) === total && Math.abs(Number(info.duration) - 390) < 0.00001 && info.avg_frame_rate === '24/1', `${name}: patched timing mismatch`);
  const joinedPackets = packets(candidate, 'v:0');
  const replacementPackets = packets(replacementFile, 'v:0');
  ensure(joinedPackets.length === total && originalPackets.length === total, `${name}: packet count mismatch`);
  let unchanged = 0;
  for (let i = 0; i < total; i++) {
    if (i >= first && i < after) {
      ensure(joinedPackets[i].data_hash === replacementPackets[i - first].data_hash, `${name}: replacement packet mismatch at ${i}`);
    } else {
      ensure(joinedPackets[i].data_hash === originalPackets[i].data_hash && joinedPackets[i].pts === originalPackets[i].pts && joinedPackets[i].dts === originalPackets[i].dts, `${name}: unchanged video packet differs at ${i}`);
      unchanged++;
    }
  }
  const presentation = joinedPackets.map(packet => packet.pts).sort((a, b) => a - b);
  ensure(presentation.every((pts, i) => pts === i * ticksPerFrame), `${name}: presentation timestamps are not continuous`);
  const originalAudio = packets(original, 'a:0');
  const joinedAudio = packets(candidate, 'a:0');
  ensure(originalAudio.length === joinedAudio.length && originalAudio.every((packet, i) => packet.data_hash === joinedAudio[i].data_hash && packet.pts === joinedAudio[i].pts && packet.duration === joinedAudio[i].duration), `${name}: AAC packets changed`);
  for (const frame of [first - 1, first, after - 1, after]) run(['-ss', String(frame / fps), '-i', candidate, '-frames:v', '1', path.join(directory, `seam-${frame}.png`)]);
  const result = {name, firstReplacementFrame: first, afterLastReplacementFrame: after, originalFile: path.relative(output, original).replaceAll('\\', '/'), originalHash: hash(original), replacementHash: hash(patch), patchedHash: hash(candidate), videoFrames: Number(info.nb_frames), durationSeconds: Number(info.duration), width: info.width, height: info.height, unchangedVideoPackets: unchanged, replacementPackets: replacementPackets.length, allOutsideVideoHashesAndTimestampsMatch: true, audioPackets: joinedAudio.length, allAudioHashesAndTimestampsMatch: true, presentationTimestampsContinuous: true, seamFrames: [first - 1, first, after - 1, after]};
  fs.copyFileSync(candidate, master);
  report.variants.push(result);
  fs.writeFileSync(path.join(output, 'A57-splice-evidence.json'), JSON.stringify(report, null, 2));
  console.log(`${name}: ${total} frames, ${unchanged} original video packets unchanged, ${joinedAudio.length} AAC packets unchanged.`);
}
