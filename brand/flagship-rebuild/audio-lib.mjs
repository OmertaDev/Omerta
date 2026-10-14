/** Zero-cost Windows SAPI scratch. Not the final Voice A performance. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const audioDir=path.join(root,'public/art/flagship-rebuild/audio');
const binDir=path.join(root,'brand/hype-flywheel-video/node_modules/@remotion/compositor-win32-x64-msvc');
const ffmpeg=path.join(binDir,'ffmpeg.exe'),ffprobe=path.join(binDir,'ffprobe.exe');
const RATE=48000,TARGET_LUFS=-15,TARGET_TP=-2;
const amp=v=>10**(v/20),db=v=>20*Math.log10(Math.max(v,1e-12));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),round=(v,p=6)=>Number(v.toFixed(p));
const samples=t=>Math.round(t*RATE),seconds=n=>n/RATE;
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const relative=p=>path.relative(root,p).replaceAll('\\','/');
const floatBuffer=d=>Buffer.from(d.buffer,d.byteOffset,d.byteLength);
const rawInput=channels=>['-f','f32le','-ar',String(RATE),'-ac',String(channels),'-i','pipe:0'];
function run(exe, args, input) {
  const result = spawnSync(exe, args, {input, maxBuffer: 384 * 1024 * 1024, windowsHide: true});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(exe)} exited ${result.status}: ${result.stderr.toString().slice(-5000)}`);
  return result;
}
const ff = (args, input) => run(ffmpeg, ['-hide_banner', '-nostdin', ...args], input);

function wavFloats(buffer, expectedChannels = 1) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Invalid PCM WAV.');
  let bits = 0, channels = 0;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const begin = offset + 8;
    if (id === 'fmt ') {channels = buffer.readUInt16LE(begin + 2); bits = buffer.readUInt16LE(begin + 14);}
    if (id === 'data') {
      if (bits !== 24 || channels !== expectedChannels) throw new Error('Unexpected PCM24 channel count.');
      const count = Math.floor(Math.min(size, buffer.length - begin) / 3);
      const result = new Float32Array(count);
      for (let i = 0; i < count; i++) result[i] = buffer.readIntLE(begin + i * 3, 3) / 8388608;
      return result;
    }
    offset = begin + size + (size % 2);
  }
  throw new Error('Missing PCM data.');
}

function probe(file) {
  return JSON.parse(run(ffprobe, ['-v', 'error', '-select_streams', 'a:0', '-show_entries',
    'stream=codec_name,sample_rate,channels,duration:format=duration', '-of', 'json', file]).stdout.toString());
}

function decode(file, channels = 1) {
  return wavFloats(ff(['-v', 'error', '-i', file, '-map', '0:a:0', '-ac', String(channels), '-ar', String(RATE),
    '-c:a', 'pcm_s24le', '-f', 'wav', 'pipe:1']).stdout, channels);
}

function stats(data) {
  let peak = 0, square = 0;
  for (const value of data) {
    if (!Number.isFinite(value)) throw new Error('Non-finite audio sample.');
    peak = Math.max(peak, Math.abs(value)); square += value * value;
  }
  const rms = Math.sqrt(square / Math.max(1, data.length));
  return {samplePeakDbfs: round(db(peak), 3), rmsDbfs: round(db(rms), 3), peak, rms};
}

function biquad(data, frequency, highpass = false) {
  const w = 2 * Math.PI * frequency / RATE, c = Math.cos(w), a = Math.sin(w) / (2 * Math.SQRT1_2), a0 = 1 + a;
  const b0 = (highpass ? 1 + c : 1 - c) / 2 / a0, b1 = (highpass ? -(1 + c) : 1 - c) / a0, b2 = b0;
  const a1 = -2 * c / a0, a2 = (1 - a) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i], y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    data[i] = y; x2 = x1; x1 = x; y2 = y1; y1 = y;
  }
}

function loudness(stderr) {
  const blocks = [...stderr.matchAll(/\{\s*"input_i"[\s\S]*?\}/g)];
  if (!blocks.length) throw new Error(`Missing loudnorm measurements: ${stderr.slice(-1500)}`);
  const result = JSON.parse(blocks.at(-1)[0]);
  for (const name of ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset']) {
    if (!Number.isFinite(Number(result[name]))) throw new Error(`Invalid loudness ${name}.`);
  }
  return result;
}

function writeStem(file, data) {
  ff(['-v','error','-y', ...rawInput(2), '-c:a','pcm_s24le', file], floatBuffer(data));
}

function master(file, data, duration) {
  const measured = loudness(ff([...rawInput(2), '-af', `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=9:print_format=json`, '-f','null','-'], floatBuffer(data)).stderr.toString());
  const norm = `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=9:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true:print_format=json`;
  const result = ff(['-y', ...rawInput(2), '-af', `${norm},aresample=${RATE},apad=whole_len=${samples(duration)},atrim=end_sample=${samples(duration)}`, '-ar',String(RATE),'-ac','2','-c:a','pcm_s24le',file],floatBuffer(data));
  const secondPass = loudness(result.stderr.toString());
  const final = loudness(ff(['-i',file,'-af',`loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=9:print_format=json`,'-f','null','-']).stderr.toString());
  const info = probe(file), stream = info.streams[0], actual = Number(stream.duration ?? info.format.duration);
  return {file: relative(file), durationSeconds: actual, integratedLufs: Number(final.input_i), truePeakDbtp: Number(final.input_tp), loudnessRangeLu: Number(final.input_lra),
    sampleRate: Number(stream.sample_rate), channels: stream.channels, codec: stream.codec_name, normalizationType: secondPass.normalization_type,
    valid: Math.abs(actual-duration)<0.5/RATE && Number(stream.sample_rate)===RATE && stream.channels===2 && Number(final.input_tp)<=-1.5 && Number(final.input_i)>=-16 && Number(final.input_i)<=-14,
    preNormalization: measured, secondPass, finalMeasurement: final};
}


export { fs,path,here,root,audioDir,RATE,amp,db,clamp,round,samples,seconds,hash,relative,run,ff,probe,decode,stats,biquad,writeStem,master };
