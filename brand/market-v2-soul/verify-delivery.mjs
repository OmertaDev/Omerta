import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root = process.cwd();
const out = path.join(root, 'output/market-v2-soul');
const bin = path.join(root, 'brand/hype-flywheel-video/node_modules/@remotion/compositor-win32-x64-msvc');
const data = JSON.parse(fs.readFileSync(path.join(root, 'brand/market-v2-soul/production-data.json'), 'utf8'));
const audioReport = JSON.parse(fs.readFileSync(path.join(root, 'public/art/market-v2-soul/audio/audio-report.json'), 'utf8'));
const {film, captions} = data;
const file = path.join(out, 'Omerta-Market-V2-Soul-1080.mp4');
const probe = JSON.parse(execFileSync(path.join(bin, 'ffprobe.exe'), ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], {encoding: 'utf8', maxBuffer: 1024 * 1024}));
const video = probe.streams.find(stream => stream.codec_type === 'video');
const audio = probe.streams.find(stream => stream.codec_type === 'audio');
const checks = {
  selectedVoice: data.voiceChoice === 'A',
  resolution: video.width === 1080 && video.height === 1920,
  frameRate: video.avg_frame_rate === '30/1',
  duration: Math.abs(Number(probe.format.duration) - film.duration) < 0.1,
  videoCodec: video.codec_name === 'h264',
  audioCodec: audio?.codec_name === 'aac',
  stereo: audio?.channels === 2,
  frames: Number(video.nb_frames) === Math.round(film.duration * 30),
  captions: captions.length === 69 && captions.every(caption => caption.startMs >= 0 && caption.endMs <= film.duration * 1000 && caption.startMs < caption.endMs),
  nativeVoiceSpeed: audioReport.nativePlaybackSpeed === 1,
  audioMixVerified: audioReport.status === 'mixed-verified' && audioReport.blockingIssues.length === 0,
};
if (Object.values(checks).some(value => !value)) throw Error('Delivery failure: ' + JSON.stringify(checks));
execFileSync(path.join(bin, 'ffmpeg.exe'), ['-v', 'error', '-threads', '2', '-i', file, '-c:v', 'rawvideo', '-c:a', 'pcm_s16le', '-f', 'null', '-'], {encoding: 'utf8', maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']});
const report = {
  verifiedAt: new Date().toISOString(),
  file: path.relative(root, file).replaceAll('\\', '/'),
  bytes: fs.statSync(file).size,
  sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
  durationSeconds: Number(probe.format.duration),
  width: video.width,
  height: video.height,
  fps: 30,
  frames: Number(video.nb_frames),
  audioSampleRate: Number(audio.sample_rate),
  captionPages: captions.length,
  checks,
  fullDecode: 'passed',
  limitations: ['Technical audio measurements do not substitute for an independent listening review.', 'Future-release setting; audited source does not establish production activation.'],
};
fs.writeFileSync(path.join(out, 'delivery-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({checksPassed: true, duration: report.durationSeconds, fullDecode: 'passed', sizeMB: (report.bytes / 1e6).toFixed(1)}));
