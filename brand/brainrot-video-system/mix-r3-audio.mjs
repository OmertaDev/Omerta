/**
 * Fresh R3 audio only. No network, API, credentials, libraries, or old campaign audio.
 *
 * node brand/brainrot-video-system/mix-r3-audio.mjs
 * node brand/brainrot-video-system/mix-r3-audio.mjs --film 1 --analyze-only
 * node brand/brainrot-video-system/mix-r3-audio.mjs --self-test
 *
 * Inputs: public/art/brainrot-r3/audio/R3-V{1,2,3}-L{01,...}[-vN].mp3
 * The highest numbered -vN take wins; unversioned originals are retained.
 * Outputs: R3-V*-{mix,dialogue,music,sfx,room}.wav, mix-r3-report.json.
 * Missing, silent, or too-long lines block that film, never substitute or cut words.
 * A tempo factor above 1.35 is a regeneration request except the explicitly approved,
 * source-pinned R3-V3-L07-v2 exception (ceiling 1.38, full original beat, complete speech).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const audioDir = path.join(root, 'public/art/brainrot-r3/audio');
const binDir = path.join(root, 'brand/hype-flywheel-video/node_modules/@remotion/compositor-win32-x64-msvc');
const ffmpeg = path.join(binDir, 'ffmpeg.exe');
const ffprobe = path.join(binDir, 'ffprobe.exe');
const RATE = 48000;
const MAX_TEMPO = 1.35;
const TEMPO_EXCEPTIONS = {
  'R3-V3-L07-v2': {
    maximum: 1.38,
    sourceSha256: '5fe14fd8b18b30b240ad915755487be6c27ffba07bed1744592da4ff703f276c',
    reason: 'Explicitly approved for this take only: use its full 1.5-second slot and retain all speech; a measured factor up to 1.38 is acceptable.',
  },
};
const LEAD = 0.010;
const EXIT = 0.020;
const EDGE_GUARD = 0.025;
const TARGET_LUFS = -14;
const TARGET_TP = -1.3; // Margin for rounding / downstream sample-rate conversion.
const db = (value) => 20 * Math.log10(Math.max(value, 1e-12));
const amp = (value) => 10 ** (value / 20);
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const round = (value, places = 6) => Number(value.toFixed(places));
const seconds = (length) => length / RATE;
const samples = (duration) => Math.round(duration * RATE);
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relative = (file) => path.relative(root, file).replaceAll('\\', '/');

function run(exe, args, input) {
  const result = spawnSync(exe, args, {input, maxBuffer: 96 * 1024 * 1024, windowsHide: true});
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${path.basename(exe)} exited ${result.status}: ${result.stderr.toString().slice(-5000)}`);
  }
  return result;
}

function ff(args, input) {
  return run(ffmpeg, ['-hide_banner', '-nostdin', ...args], input);
}

function floatBuffer(data) {
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}

function wavFloats(buffer) {
  // This compact FFmpeg build encodes PCM24 WAV, but does not include a raw-float muxer.
  // Pipe WAVs use an unknown data length; cap the chunk at the actual available bytes.
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Invalid PCM WAV output.');
  let bits = 0, channels = 0;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const begin = offset + 8;
    if (id === 'fmt ') {channels = buffer.readUInt16LE(begin + 2); bits = buffer.readUInt16LE(begin + 14);}
    if (id === 'data') {
      if (bits !== 24 || channels !== 1) throw new Error(`Expected mono PCM24, found ${channels} channels / ${bits} bits.`);
      const length = Math.min(size, buffer.length - begin);
      const result = new Float32Array(Math.floor(length / 3));
      for (let i = 0; i < result.length; i++) result[i] = buffer.readIntLE(begin + i * 3, 3) / 8388608;
      return result;
    }
    offset = begin + size + (size % 2);
  }
  throw new Error('Missing PCM WAV data chunk.');
}

const rawInput = (channels) => ['-f', 'f32le', '-ar', String(RATE), '-ac', String(channels), '-i', 'pipe:0'];

function probe(file) {
  return JSON.parse(run(ffprobe, ['-v', 'error', '-select_streams', 'a:0', '-show_entries',
    'stream=codec_name,sample_rate,channels,duration,duration_ts,time_base:format=duration', '-of', 'json', file]).stdout.toString());
}

function decode(file) {
  return wavFloats(ff(['-v', 'error', '-i', file, '-map', '0:a:0', '-ac', '1', '-ar', String(RATE),
    '-c:a', 'pcm_s24le', '-f', 'wav', 'pipe:1']).stdout);
}

function selectTake(lineId) {
  const pattern = new RegExp(`^${lineId}(?:-v([1-9]\\d*))?\\.mp3$`);
  const candidates = fs.readdirSync(audioDir).flatMap((name) => {
    const match = name.match(pattern);
    if (!match) return [];
    const version = match[1] ? Number(match[1]) : 0;
    if (!Number.isSafeInteger(version)) throw new Error(`Invalid take version: ${name}`);
    return [{file: path.join(audioDir, name), version, variant: match[1] ? `v${version}` : 'original'}];
  }).sort((a, b) => b.version - a.version);
  return {
    selected: candidates[0] ?? {file: path.join(audioDir, `${lineId}.mp3`), version: 0, variant: 'original'},
    provenance: candidates.map((take) => ({file: relative(take.file), variant: take.variant,
      sha256: hash(fs.readFileSync(take.file))})),
  };
}

function stats(data) {
  let peak = 0;
  let square = 0;
  for (const value of data) {
    if (!Number.isFinite(value)) throw new Error('Non-finite PCM sample.');
    peak = Math.max(peak, Math.abs(value));
    square += value * value;
  }
  const rms = Math.sqrt(square / Math.max(1, data.length));
  return {samplePeakDbfs: round(db(peak), 3), rmsDbfs: round(db(rms), 3), peak, rms};
}

// Only contiguous silence at either edge is removed. Interior pauses and breaths stay.
// The conservative relative threshold is -48 dB below the file's peak, with a -60 dBFS floor.
function trimEdges(data) {
  const measured = stats(data);
  const threshold = Math.max(amp(-60), measured.peak * amp(-48));
  let first = 0;
  let last = data.length - 1;
  while (first < data.length && Math.abs(data[first]) < threshold) first++;
  while (last >= first && Math.abs(data[last]) < threshold) last--;
  if (first >= data.length || measured.peak < amp(-55)) throw new Error('Silent or nearly silent voice file.');
  const start = Math.max(0, first - samples(EDGE_GUARD));
  const end = Math.min(data.length, last + 1 + samples(EDGE_GUARD));
  return {data: data.slice(start, end), first, last, start, end, thresholdDbfs: round(db(threshold), 2)};
}

function tempo(data, factor) {
  if (factor === 1) return data.slice();
  return wavFloats(ff(['-v', 'error', ...rawInput(1), '-af', `atempo=${factor.toFixed(8)}`,
    '-c:a', 'pcm_s24le', '-f', 'wav', 'pipe:1'], floatBuffer(data)).stdout);
}

// RBJ second-order filters implemented here because the bundled FFmpeg lacks EQ filters.
function biquad(data, frequency, highpass = false) {
  const w = 2 * Math.PI * frequency / RATE;
  const c = Math.cos(w);
  const a = Math.sin(w) / (2 * Math.SQRT1_2);
  const a0 = 1 + a;
  const b0 = (highpass ? 1 + c : 1 - c) / 2 / a0;
  const b1 = (highpass ? -(1 + c) : 1 - c) / a0;
  const b2 = b0;
  const a1 = -2 * c / a0;
  const a2 = (1 - a) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    data[i] = y;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
  }
}

function polishVoice(data, speaker) {
  const out = data.slice();
  biquad(out, speaker === 'Consigliere' ? 180 : 75, true);
  biquad(out, speaker === 'Consigliere' ? 5800 : 13500);
  const original = stats(out);
  const inputGain = Math.min(amp(12), amp(-18.5) / Math.max(original.rms, 1e-6));
  const attack = Math.exp(-1 / (RATE * 0.004));
  const release = Math.exp(-1 / (RATE * 0.070));
  let envelope = 0;
  for (let i = 0; i < out.length; i++) {
    const x = out[i] * inputGain;
    const coefficient = Math.abs(x) > envelope ? attack : release;
    envelope = coefficient * envelope + (1 - coefficient) * Math.abs(x);
    const reductionDb = Math.max(0, db(envelope) + 16) * (1 - 1 / 2.2);
    out[i] = x * amp(-reductionDb);
  }
  const compressed = stats(out);
  const gain = Math.min(amp(-18.5) / Math.max(compressed.rms, 1e-6), amp(-3) / compressed.peak);
  const fade = samples(0.002);
  for (let i = 0; i < out.length; i++) {
    out[i] *= gain * Math.min(1, i / fade, (out.length - 1 - i) / fade);
  }
  return {data: out, gainDb: round(db(inputGain * gain), 3), eq: speaker === 'Consigliere'
    ? '180 Hz high-pass / 5.8 kHz low-pass, dry telephone character'
    : '75 Hz high-pass / 13.5 kHz low-pass, dry center voice'};
}

function rng(seed) {
  let state = seed >>> 0;
  return () => {state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296;};
}

function effect(kind, duration, seed, frequency = 440) {
  const out = new Float32Array(samples(duration));
  const random = rng(seed);
  let phase = 0, lowNoise = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    const p = t / duration;
    const noise = random() * 2 - 1;
    lowNoise += 0.065 * (noise - lowNoise);
    const highNoise = noise - lowNoise;
    const end = Math.min(1, (duration - t) / 0.008);
    const attack = Math.min(1, t / 0.0015);
    let v = 0;
    if (kind === 'click' || kind === 'paper') {
      v = (highNoise * (kind === 'paper' ? 0.85 : 0.6) + 0.2 * Math.sin(2 * Math.PI * 1850 * t)) * Math.exp(-t * (kind === 'paper' ? 48 : 130));
    } else if (kind === 'metal' || kind === 'ping') {
      v = [1, 1.414, 2.173].reduce((sum, multiple, j) => sum + Math.sin(2 * Math.PI * frequency * multiple * t) * Math.exp(-t * (10 + j * 13)) / (j + 2), 0);
      v += highNoise * 0.2 * Math.exp(-t * 95);
    } else if (kind === 'scrape' || kind === 'shutter') {
      v = lowNoise * (0.9 + 0.5 * Math.sin(t * 158)) + highNoise * 0.12;
      v += 0.10 * Math.sin(2 * Math.PI * 173 * t) * Math.sin(2 * Math.PI * 47 * t);
      v *= Math.sin(Math.PI * p) ** 0.6;
      if (kind === 'shutter') v += 0.20 * Math.sin(t * 2 * Math.PI * 95) * Math.exp(-(t % 0.12) * 65);
    } else if (kind === 'thud' || kind === 'brand' || kind === 'kick') {
      const start = kind === 'brand' ? 180 : 140;
      phase += 2 * Math.PI * (48 + (start - 48) * Math.exp(-t * 27)) / RATE;
      v = Math.sin(phase) * Math.exp(-t * 15) + highNoise * 0.35 * Math.exp(-t * 130);
      v += 0.12 * Math.sin(t * 2 * Math.PI * 950) * Math.exp(-t * 85); // Phone-readable attack.
    } else if (kind === 'squeak' || kind === 'whistle') {
      phase += 2 * Math.PI * (frequency + 260 * Math.sin(Math.PI * p)) / RATE;
      v = Math.sin(phase) * Math.sin(Math.PI * p) * (0.5 + 0.2 * Math.sin(t * 83));
    } else if (kind === 'reverse') {
      v = (lowNoise * 1.8 + Math.sin(t * 2 * Math.PI * 420) * 0.09) * p ** 2;
    } else if (kind === 'stop') {
      phase += 2 * Math.PI * (320 * (1 - p) ** 2 + 35) / RATE;
      v = (Math.sin(phase) + 0.12 * highNoise) * (1 - p);
    } else if (kind === 'engine') {
      phase += 2 * Math.PI * (55 + p * 55) / RATE;
      v = (Math.sin(phase) + 0.3 * Math.sin(phase * 2) + lowNoise) * Math.sin(Math.PI * p) * 0.65;
    } else if (kind === 'splash') {
      v = (lowNoise * 2 + highNoise * 0.07) * Math.sin(Math.PI * p) * Math.exp(-t * 2);
      v += Math.sin(t * 2 * Math.PI * (210 + 45 * Math.sin(t * 11))) * 0.09 * Math.exp(-t * 8);
    } else if (kind === 'hat' || kind === 'snare') {
      v = highNoise * Math.exp(-t * (kind === 'hat' ? 100 : 32));
      if (kind === 'snare') v += 0.25 * Math.sin(t * 2 * Math.PI * 185) * Math.exp(-t * 42);
    } else if (kind === 'bass' || kind === 'key' || kind === 'bent') {
      phase += 2 * Math.PI * frequency * (kind === 'bent' ? 1 - p * 0.12 : 1) / RATE;
      v = (Math.sin(phase) + 0.24 * Math.sin(phase * 2.008) + 0.08 * Math.sin(phase * 3.003)) * Math.exp(-t * (kind === 'bass' ? 4 : 7));
    } else if (kind === 'error') {
      v = (Math.sin(t * 2 * Math.PI * 233) + 0.5 * Math.sin(t * 2 * Math.PI * 247)) * 0.5 * Math.exp(-t * 14);
    } else if (kind === 'pip') {
      v = Math.sin(t * 2 * Math.PI * frequency) * Math.exp(-t * 20);
    } else {
      throw new Error(`Unknown synthesized effect: ${kind}`);
    }
    out[i] = v * attack * end;
  }
  return out;
}

function add(stereo, mono, at, gain = 1, pan = 0) {
  const offset = samples(at);
  const left = Math.cos((clamp(pan, -1, 1) + 1) * Math.PI / 4);
  const right = Math.sin((clamp(pan, -1, 1) + 1) * Math.PI / 4);
  for (let i = 0; i < mono.length && i + offset < stereo.length / 2; i++) {
    if (i + offset < 0) continue;
    stereo[(i + offset) * 2] += mono[i] * gain * left;
    stereo[(i + offset) * 2 + 1] += mono[i] * gain * right;
  }
}

// The cue sheet is an explicit interpretation of f.audio and every b.sound row.
// Parameters: seconds, oscillator/noise recipe, duration, gain, pan, pitch.
const cue = (at, kind, duration = 0.09, gain = 0.15, pan = 0, frequency = 760) => ({at, kind, duration, gain, pan, frequency});
const clicks = (at, count, gap = 0.085, gain = 0.12, direction = 0) => Array.from({length: count}, (_, i) =>
  cue(at + i * gap, 'click', 0.055, gain, direction ? 0.5 - i / Math.max(1, count - 1) : (i % 2 ? 0.2 : -0.2)));

const PLANS = {
  1: {
    musicStart: 1.5, musicRestart: 21,
    musicOff: [[16.5, 18]], roomOff: [[16.5, 18]], fullyDry: [],
    controlTimes: [16.5],
    cues: [
      cue(0, 'scrape', 0.38, 0.23), cue(0, 'thud', 0.23, 0.23), cue(0.65, 'click', 0.06, 0.23),
      cue(1.5, 'bass', 0.2, 0.08, 0, 120), cue(3, 'pip', 0.09, 0.12, 0, 970), cue(3.10, 'pip', 0.09, 0.10, 0, 750), cue(3.85, 'click'),
      ...[4.5, 4.9, 5.25].map((at, i) => cue(at, 'metal', 0.16, 0.16, (i - 1) * 0.25, 590 + i * 117)),
      cue(6, 'thud', 0.23, 0.23), cue(6.85, 'pip', 0.1, 0.12, -0.1, 640), cue(6.97, 'pip', 0.1, 0.11, 0.1, 820),
      cue(7.5, 'reverse', 0.23, 0.17), cue(8.15, 'pip', 0.12, 0.12), cue(9, 'error', 0.12, 0.13),
      ...clicks(10.5, 4), cue(12, 'click'), ...clicks(13.5, 2, 0.19, 0.10), cue(15, 'click', 0.05, 0.15), cue(15.7, 'pip', 0.13, 0.11, 0, 620),
      cue(17.2, 'squeak', 0.13, 0.11, 0.2, 980), cue(18, 'shutter', 0.44, 0.22), cue(18, 'thud', 0.24, 0.24),
      cue(19.5, 'pip', 0.13, 0.12, 0, 810), ...clicks(21, 6, 0.055, 0.11), cue(21, 'metal', 0.18, 0.12, -0.3, 270),
      cue(22.5, 'shutter', 0.2, 0.20), cue(24, 'click', 0.06, 0.18), cue(24.12, 'paper', 0.13, 0.12),
      ...[285, 303, 449].map((f, i) => cue(25.5 + i * 0.11, 'key', 0.3, 0.10, (i - 1) * 0.15, f)),
      cue(27, 'brand', 0.31, 0.30), ...clicks(28.5, 4), ...[30, 30.08, 30.18].map((at, i) => cue(at, 'metal', 0.16, 0.13, 0.1, 1140 + i * 197)),
      cue(31.4, 'scrape', 0.20, 0.23),
    ],
  },
  2: {
    musicStart: 0, musicRestart: 12,
    musicOff: [[10.5, 12], [25.5, 28.5]], roomOff: [[10.5, 12]], fullyDry: [[11.15, 12]],
    controlTimes: [11.15, 25.5],
    cues: [
      cue(0, 'thud', 0.24, 0.26), cue(0.4, 'pip', 0.10, 0.14, 0, 930), cue(1.5, 'error', 0.11, 0.13), cue(1.69, 'click', 0.05, 0.13),
      cue(3, 'engine', 0.46, 0.15), cue(3.10, 'hat', 0.055, 0.10), cue(3.30, 'hat', 0.055, 0.09), cue(4.5, 'scrape', 0.25, 0.22),
      cue(6, 'engine', 0.35, 0.13), cue(6.4, 'pip', 0.10, 0.11, 0, 680), ...clicks(7.5, 6, 0.037, 0.12), cue(7.86, 'click', 0.055, 0.16),
      cue(9, 'thud', 0.2, 0.23), cue(10.5, 'stop', 0.30, 0.16), cue(12, 'paper', 0.35, 0.045), cue(13.7, 'click', 0.06, 0.17),
      ...clicks(15, 9, 0.045, 0.13, -1), cue(16.5, 'whistle', 0.14, 0.12, -0.15, 1150), cue(16.72, 'squeak', 0.13, 0.10, 0.2, 820),
      ...[18, 18.18, 18.37].map((at, i) => cue(at, 'thud', 0.20, 0.17 - i * 0.01)), cue(19.5, 'thud', 0.21, 0.18),
      cue(21, 'splash', 0.43, 0.25), cue(22.5, 'click', 0.06, 0.14), cue(24, 'pip', 0.10, 0.08, 0, 480),
      cue(27, 'click', 0.09, 0.12, 0, 180), cue(28.5, 'brand', 0.31, 0.30),
      ...[0, 0.085, 0.17].map((offset, i) => cue(30 + offset, 'pip', 0.075, 0.10, (i - 1) * 0.15, [600, 790, 600][i])),
      cue(31.5, 'paper', 0.085, 0.26), cue(32.92, 'thud', 0.16, 0.10),
    ],
  },
  3: {
    musicStart: 0, musicRestart: 16.5,
    musicOff: [[12, 13.5], [25.5, 27]], roomOff: [[12, 13.5], [25.5, 27]], fullyDry: [[25.5, 27]],
    controlTimes: [4.5, 25.5],
    cues: [
      cue(0, 'click', 0.05, 0.26), cue(0, 'thud', 0.21, 0.19), cue(1.5, 'click', 0.09, 0.19), cue(1.65, 'pip', 0.09, 0.10, 0, 660),
      cue(3, 'pip', 0.11, 0.10, 0, 515), cue(3.15, 'pip', 0.11, 0.10, 0, 485), cue(6, 'click', 0.07, 0.18), cue(6.85, 'click', 0.055, 0.12),
      cue(7.5, 'scrape', 0.25, 0.15), cue(7.82, 'paper', 0.13, 0.17), cue(9, 'click', 0.07, 0.14), cue(9.15, 'click', 0.07, 0.14), cue(9.40, 'error', 0.11, 0.08),
      cue(10.5, 'pip', 0.10, 0.12, -0.22, 590), cue(10.7, 'pip', 0.10, 0.12, 0.22, 810), cue(12, 'click', 0.045, 0.09),
      cue(13.5, 'ping', 0.13, 0.11, 0.1, 1190), cue(15, 'error', 0.21, 0.16), ...clicks(16.5, 2, 0.15, 0.12),
      cue(18, 'thud', 0.20, 0.20), cue(18.12, 'ping', 0.16, 0.10, 0.2, 1460), cue(19.5, 'click', 0.06, 0.15),
      cue(21.3, 'click', 0.055, 0.14), cue(21.95, 'pip', 0.11, 0.10, 0, 675), cue(22.65, 'click', 0.055, 0.15), cue(23.05, 'thud', 0.20, 0.16),
      cue(24, 'bent', 0.34, 0.10, 0, 278), cue(27.15, 'pip', 0.10, 0.10, 0, 610), cue(28.5, 'bass', 0.83, 0.075, 0, 98),
      cue(30, 'brand', 0.30, 0.27), cue(31.55, 'click', 0.055, 0.22),
    ],
  },
};

function silenceGain(t, windows) {
  let gain = 1;
  for (const [start, end] of windows) {
    if (t >= start && t < end) return 0;
    if (t >= start - 0.005 && t < start) gain = Math.min(gain, (start - t) / 0.005);
    if (t >= end && t < end + 0.005) gain = Math.min(gain, (t - end) / 0.005);
  }
  return gain;
}

function cueCoverage(film, plan) {
  const accounted = [...plan.cues.map((event) => event.at), ...plan.controlTimes];
  const unresolved = [];
  for (const beat of film.timeline) {
    for (const match of beat.sound.matchAll(/\b\d{1,2}\.\d{3}\b/g)) {
      const at = Number(match[0]);
      if (!accounted.some((value) => Math.abs(value - at) < 0.001)) unresolved.push({at, direction: beat.sound});
    }
  }
  if (unresolved.length) throw new Error(`Cue sheet needs updating for film ${film.id}: ${JSON.stringify(unresolved)}`);
}

function constructStems(film, dialogue) {
  const id = Number(film.id);
  const plan = PLANS[id];
  const length = samples(film.duration) * 2;
  const music = new Float32Array(length);
  const sfx = new Float32Array(length);
  const room = new Float32Array(length);
  const bpmMatch = film.audio.music.match(/(\d+) BPM/);
  if (!bpmMatch) throw new Error(`Missing BPM in film ${film.id}'s music direction.`);
  const bpm = Number(bpmMatch[1]);
  const beat = 60 / bpm;
  let serial = id * 1031;
  const note = (target, kind, at, duration, gain, pan = 0, frequency = 440) =>
    add(target, effect(kind, duration, ++serial, frequency), at, gain, pan);
  const sections = [plan.musicStart, plan.musicRestart, film.duration];
  for (let section = 0; section < 2; section++) {
    for (let step = 0, at = sections[section]; at < sections[section + 1]; step++, at = sections[section] + step * beat / 2) {
      const barStep = step % 8;
      if (id === 1) {
        if ([0, 3, 4, 7].includes(barStep)) note(music, 'kick', at, 0.17, barStep === 0 ? 0.30 : 0.22);
        if ([2, 6].includes(barStep)) note(music, 'snare', at, 0.11, 0.16, 0.1);
        note(music, 'hat', at + (step % 2 ? 0.012 : 0), 0.038, step % 2 ? 0.09 : 0.065, step % 2 ? -0.25 : 0.25);
        if ([0, 3, 6].includes(barStep)) note(music, 'bass', at, beat * 0.78, 0.15, 0, 73.416);
        if (barStep === 5) note(music, 'key', at, beat * 0.60, 0.043, -0.22, 293.8);
      } else if (id === 2) {
        if ([0, 3, 5].includes(barStep)) note(music, 'kick', at, 0.17, 0.26);
        if ([2, 6].includes(barStep)) note(music, 'snare', at, 0.08, 0.12, -0.1);
        note(music, 'click', at, 0.04, 0.12, step % 2 ? -0.3 : 0.3);
        if ([0, 3, 6].includes(barStep)) note(music, 'bass', at, beat * 0.65, 0.15, 0, 65.406);
        if (barStep === 7) note(music, 'key', at, 0.09, 0.038, 0.23, 261.9);
      } else {
        if ([0, 6].includes(barStep)) note(music, 'key', at, beat * 0.78, 0.068, barStep ? 0.15 : -0.15, barStep ? 207.8 : 196);
        if ([0, 5].includes(barStep)) note(music, 'paper', at, 0.09, 0.10, 0.25);
        if (barStep === 0) note(music, 'bass', at, 0.3, 0.10, 0, 49);
      }
    }
  }
  for (const event of plan.cues) note(sfx, event.kind, event.at, event.duration, event.gain, event.pan, event.frequency);
  const random = rng(92117 + id * 701);
  let left = 0, right = 0, voiceEnvelope = 0;
  const attack = Math.exp(-1 / (RATE * 0.008));
  const release = Math.exp(-1 / (RATE * 0.160));
  for (let frame = 0; frame < length / 2; frame++) {
    const t = frame / RATE;
    left += 0.025 * (random() * 2 - 1 - left);
    right += 0.025 * (random() * 2 - 1 - right);
    const pool = id === 2 && t >= 21 && t < 28.5;
    const roomGain = pool ? 0.045 : 0.010;
    const roomMute = silenceGain(t, plan.roomOff);
    const hum = Math.sin(t * Math.PI * 2 * (pool ? 120 : 60)) * (pool ? 0.0014 : 0.00045);
    // Exchange-room texture is filtered nonverbal noise, not extra words or a sampled crowd.
    const bustle = id === 2 && t >= 12 && t < 16.5 ? 1.7 + 0.6 * Math.sin(t * 15) : 1;
    room[frame * 2] = (left * roomGain * bustle + hum) * roomMute;
    room[frame * 2 + 1] = (right * roomGain * bustle + hum) * roomMute;
    const voice = Math.max(Math.abs(dialogue[frame * 2]), Math.abs(dialogue[frame * 2 + 1]));
    const coefficient = voice > voiceEnvelope ? attack : release;
    voiceEnvelope = voiceEnvelope * coefficient + voice * (1 - coefficient);
    const duck = 1 - clamp(voiceEnvelope / 0.025, 0, 1) * (1 - amp(-6));
    const extraDuck = id === 2 && t >= 4.5 && t < 6 ? amp(-5) : 1;
    const intro = t < plan.musicStart ? 0 : Math.min(1, (t - plan.musicStart) / 0.006);
    const tail = Math.min(1, (film.duration - t) / 0.080);
    const musicGain = silenceGain(t, plan.musicOff) * duck * extraDuck * intro * tail;
    music[frame * 2] *= musicGain;
    music[frame * 2 + 1] *= musicGain;
    const sfxGain = silenceGain(t, plan.fullyDry) * Math.min(1, (film.duration - t) / 0.003);
    sfx[frame * 2] *= sfxGain;
    sfx[frame * 2 + 1] *= sfxGain;
  }
  // Three video frames of room-tone crossfade; dialogue is never shortened for looping.
  const loopFrames = samples(3 / 30);
  for (let i = 0; i < loopFrames; i++) {
    const tailFrame = length / 2 - loopFrames + i;
    const blend = i / (loopFrames - 1);
    for (let channel = 0; channel < 2; channel++) {
      room[tailFrame * 2 + channel] = room[tailFrame * 2 + channel] * (1 - blend) + room[i * 2 + channel] * blend;
    }
  }
  // Smooth the final few room samples to the exact opening value as well.
  for (let i = 0; i < samples(0.004); i++) {
    const frame = length / 2 - samples(0.004) + i;
    const blend = i / (samples(0.004) - 1);
    for (let channel = 0; channel < 2; channel++) room[frame * 2 + channel] = room[frame * 2 + channel] * (1 - blend) + room[channel] * blend;
  }
  return {music, sfx, room, bpm, plan};
}

function wav(file, data, channels = 2, bits = 32) {
  // Float stems avoid any hidden clipping/normalization. Delivery masters are PCM24 via FFmpeg.
  assert.equal(bits, 32);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.byteLength, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(3, 20); header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(RATE, 24); header.writeUInt32LE(RATE * channels * 4, 28);
  header.writeUInt16LE(channels * 4, 32); header.writeUInt16LE(32, 34);
  header.write('data', 36); header.writeUInt32LE(data.byteLength, 40);
  const contents = Buffer.concat([header, floatBuffer(data)]);
  // Repeated analysis often runs while the editor is reading stems. Leave an identical
  // existing stem in place instead of reopening it for a needless Windows write.
  if (fs.existsSync(file) && fs.statSync(file).size === contents.length && fs.readFileSync(file).equals(contents)) return;
  fs.writeFileSync(file, contents);
}

function loudness(stderr) {
  const matches = [...stderr.matchAll(/\{\s*"input_i"[\s\S]*?\}/g)];
  if (!matches.length) throw new Error(`FFmpeg did not return loudnorm measurements: ${stderr.slice(-1500)}`);
  const value = JSON.parse(matches.at(-1)[0]);
  for (const key of ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset']) {
    if (!Number.isFinite(Number(value[key]))) throw new Error(`Invalid loudnorm ${key}: ${value[key]}`);
  }
  return value;
}

function measureRaw(data, channels = 2) {
  return loudness(ff([...rawInput(channels), '-af', `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=9:print_format=json`,
    '-f', 'null', '-'], floatBuffer(data)).stderr.toString());
}

function master(file, data, duration) {
  const measured = measureRaw(data);
  const norm = `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=9:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true:print_format=json`;
  const result = ff(['-y', ...rawInput(2), '-af', `${norm},aresample=${RATE},apad=whole_len=${samples(duration)},atrim=end_sample=${samples(duration)}`,
    '-ar', String(RATE), '-ac', '2', '-c:a', 'pcm_s24le', file], floatBuffer(data));
  const pass2 = loudness(result.stderr.toString());
  const measuredFinal = loudness(ff(['-i', file, '-af', `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TP}:LRA=9:print_format=json`, '-f', 'null', '-']).stderr.toString());
  const info = probe(file);
  const stream = info.streams[0];
  const deliveredDuration = Number(stream.duration ?? info.format.duration);
  const valid = Number(stream.sample_rate) === RATE && stream.channels === 2 &&
    Math.abs(deliveredDuration - duration) < 0.5 / RATE && Number(measuredFinal.input_tp) <= -1 &&
    Math.abs(Number(measuredFinal.input_i) - TARGET_LUFS) <= 0.7;
  return {
    file: relative(file), valid, durationSeconds: deliveredDuration,
    sampleRate: Number(stream.sample_rate), channels: stream.channels, codec: stream.codec_name,
    integratedLufs: Number(measuredFinal.input_i), truePeakDbtp: Number(measuredFinal.input_tp),
    loudnessRangeLu: Number(measuredFinal.input_lra), normalizationType: pass2.normalization_type,
    preNormalization: measured, secondPass: pass2, finalMeasurement: measuredFinal,
  };
}

async function processFilm(film, analyzeOnly) {
  const id = Number(film.id);
  const plan = PLANS[id];
  if (!plan) throw new Error(`No R3 sound plan for film ${film.id}.`);
  cueCoverage(film, plan);
  const report = {id: film.id, duration: film.duration, audioDirection: film.audio,
    directionSha256: hash(JSON.stringify({audio: film.audio, sounds: film.timeline.map((b) => b.sound)})),
    status: 'analyzing', lines: [], blockingIssues: [], sourcePolicy: 'New R3 dialogue inputs plus original deterministic oscillators/noise; no borrowed samples.',
    reviewRequired: 'Timing/EQ/level verification is automated; listen to all dialogue for pronunciation, complete words, voice identity, and natural comic timing.'};
  const dialogue = new Float32Array(samples(film.duration) * 2);
  for (let i = 0; i < film.timeline.length; i++) {
    const beat = film.timeline[i];
    const lineId = `R3-V${id}-L${String(i + 1).padStart(2, '0')}`;
    const take = selectTake(lineId);
    const file = take.selected.file;
    const line = {id: lineId, speaker: beat.speaker, text: beat.speech, start: beat.start, end: beat.end, soundDirection: beat.sound,
      source: relative(file), selectedVariant: take.selected.variant, selectedTakeVersion: take.selected.version, availableTakes: take.provenance};
    report.lines.push(line);
    try {
      if (!fs.existsSync(file)) {line.status = 'missing'; report.blockingIssues.push(`${lineId}: missing MP3`); continue;}
      const info = probe(file);
      const raw = decode(file);
      const edges = trimEdges(raw);
      Object.assign(line, {
        sourceSha256: hash(fs.readFileSync(file)), sourceMetadata: info,
        decodedDurationSeconds: round(seconds(raw.length)), trimmedDurationSeconds: round(seconds(edges.data.length)),
        leadingSilenceRemovedSeconds: round(seconds(edges.start)), trailingSilenceRemovedSeconds: round(seconds(raw.length - edges.end)),
        retainedEdgeGuardSeconds: EDGE_GUARD, trimThresholdDbfs: edges.thresholdDbfs,
        inputStats: stats(raw), sourceStartsOrEndsNearVoice: edges.first < samples(0.005) || raw.length - edges.last < samples(0.005),
      });
      let lineLead = LEAD;
      let lineExit = EXIT;
      let available = samples(beat.end - beat.start - lineLead - lineExit);
      let factor = Math.max(1, edges.data.length / available);
      line.initialRequiredTempo = round(factor);
      const exception = TEMPO_EXCEPTIONS[`${lineId}-${take.selected.variant}`];
      const applicableException = exception?.sourceSha256 === line.sourceSha256 ? exception : null;
      const maximumTempo = applicableException?.maximum ?? MAX_TEMPO;
      line.maximumAllowedTempo = maximumTempo;
      if (applicableException) line.approvedTempoException = applicableException;
      // A file with genuine retained silence on BOTH edges already has a safe gap.
      // Before requesting another take, allow that existing guard to replace the extra
      // 30 ms scheduling reserve. The entire buffer must still fit this same 1.5 s beat.
      const hasBothGuards = edges.first - edges.start >= samples(EDGE_GUARD) &&
        edges.end - edges.last - 1 >= samples(EDGE_GUARD);
      const wholeBeat = samples(beat.end - beat.start);
      if (factor > MAX_TEMPO && hasBothGuards && edges.data.length / wholeBeat <= maximumTempo) {
        lineLead = 0;
        lineExit = 0;
        available = wholeBeat;
        factor = Math.max(1, edges.data.length / available);
        line.timingNote = 'Existing 25 ms silence guards at both source edges replace the extra 30 ms scheduling reserve. No speech or buffer samples removed.';
      }
      line.requiredTempoWithinBeat = round(factor);
      line.schedulingLeadSeconds = lineLead;
      line.schedulingExitSeconds = lineExit;
      if (factor > maximumTempo) {
        line.status = 'regenerate-too-long';
        report.blockingIssues.push(`${lineId}: needs ${factor.toFixed(3)}x tempo; limit ${maximumTempo}x. Regenerate a faster complete reading.`);
        continue;
      }
      let fitted = tempo(edges.data, factor);
      let passes = 1;
      // atempo window/flush behavior varies; measure actual PCM output instead of assuming length/factor.
      while (fitted.length > available && passes < 4) {
        factor *= fitted.length / available * 1.002;
        if (factor > maximumTempo) break;
        fitted = tempo(edges.data, factor);
        passes++;
      }
      Object.assign(line, {appliedTempo: round(factor), tempoPasses: passes, fittedDurationSeconds: round(seconds(fitted.length))});
      if (factor > maximumTempo || fitted.length > available) {
        line.status = 'regenerate-too-long';
        report.blockingIssues.push(`${lineId}: measured tempo fitting cannot retain the full line below ${maximumTempo}x.`);
        continue;
      }
      const voice = polishVoice(fitted, beat.speaker);
      // Duplication (gain sqrt(2) with equal-power center pan) keeps identical mono dialogue in L/R.
      add(dialogue, voice.data, beat.start + lineLead, Math.SQRT2);
      Object.assign(line, {status: 'ready', placedAtSeconds: round(beat.start + lineLead),
        spokenBufferEndSeconds: round(beat.start + lineLead + seconds(voice.data.length)),
        remainingBeatSeconds: round(beat.end - beat.start - lineLead - seconds(voice.data.length)),
        processingGainDb: voice.gainDb, eq: voice.eq, outputStats: stats(voice.data)});
      console.log(`${lineId} [${line.selectedVariant}] ${line.trimmedDurationSeconds.toFixed(3)}s -> ${line.fittedDurationSeconds.toFixed(3)}s, tempo ${line.appliedTempo.toFixed(3)}x`);
    } catch (error) {
      line.status = 'error'; line.error = error.message;
      report.blockingIssues.push(`${lineId}: ${error.message}`);
    }
  }
  if (report.blockingIssues.length) {report.status = 'blocked'; return report;}
  const stems = constructStems(film, dialogue);
  report.bpm = stems.bpm;
  report.ducking = {musicUnderDialogueDb: -6, attackMs: 8, releaseMs: 160, ambushedExtraMusicDuckDb: id === 2 ? -5 : 0};
  report.musicSilenceChecks = plan.musicOff.map(([start, end]) => ({start, end,
    ...stats(stems.music.subarray(samples(start) * 2, samples(end) * 2)), exactZero: stems.music.subarray(samples(start) * 2, samples(end) * 2).every((v) => v === 0)}));
  report.fullyDryChecks = plan.fullyDry.map(([start, end]) => ({start, end, exactZero:
    ['music', 'sfx', 'room'].every((name) => stems[name].subarray(samples(start) * 2, samples(end) * 2).every((v) => v === 0))}));
  report.cues = plan.cues;
  report.loopRoomCrossfadeSeconds = 0.1;
  if (report.musicSilenceChecks.some((check) => !check.exactZero) || report.fullyDryChecks.some((check) => !check.exactZero)) {
    throw new Error(`Film ${film.id} failed a silence-window check.`);
  }
  if (analyzeOnly) {report.status = 'analyzed-ready'; return report;}
  const allStems = {dialogue, music: stems.music, sfx: stems.sfx, room: stems.room};
  const mixed = new Float32Array(dialogue.length);
  report.stems = {};
  for (const [name, data] of Object.entries(allStems)) {
    const file = path.join(audioDir, `R3-V${id}-${name}.wav`);
    wav(file, data);
    report.stems[name] = {file: relative(file), ...stats(data)};
    for (let i = 0; i < data.length; i++) mixed[i] += data[i];
  }
  report.rawMixStats = stats(mixed);
  report.master = master(path.join(audioDir, `R3-V${id}-mix.wav`), mixed, film.duration);
  report.status = report.master.valid ? 'mixed-verified' : 'master-out-of-spec';
  if (!report.master.valid) report.blockingIssues.push('Delivered master failed duration, stereo, sample-rate, integrated loudness, or true-peak check.');
  return report;
}

function selfTest(data) {
  const voice = new Float32Array(samples(1.9));
  const syllables = [[0.16, 0.35, 230], [0.49, 0.73, 260], [0.86, 1.21, 200], [1.35, 1.73, 245]];
  for (const [start, end, hz] of syllables) {
    for (let i = samples(start); i < samples(end); i++) voice[i] = 0.14 * Math.sin(i / RATE * 2 * Math.PI * hz) * Math.sin((i / RATE - start) / (end - start) * Math.PI);
  }
  const trimmed = trimEdges(voice);
  assert.ok(seconds(trimmed.start) > 0.10 && seconds(trimmed.start) < 0.17);
  assert.ok(trimmed.data.length > samples(1.55), 'Interior pauses must be retained.');
  const accelerated = tempo(trimmed.data, 1.2);
  assert.ok(accelerated.length < trimmed.data.length && accelerated.length > trimmed.data.length / 1.3);
  assert.ok(stats(accelerated.subarray(accelerated.length - samples(0.16))).peak > 0.02, 'The final synthetic syllable must survive tempo processing.');
  for (const film of data.films) {
    cueCoverage(film, PLANS[Number(film.id)]);
    const dialogue = new Float32Array(samples(film.duration) * 2);
    const stems = constructStems(film, dialogue);
    for (const [start, end] of stems.plan.musicOff) assert.ok(stems.music.subarray(samples(start) * 2, samples(end) * 2).every((v) => v === 0));
    for (const [start, end] of stems.plan.fullyDry) for (const key of ['music', 'sfx', 'room']) assert.ok(stems[key].subarray(samples(start) * 2, samples(end) * 2).every((v) => v === 0));
    assert.equal(stems.music.length, samples(film.duration) * 2);
    assert.ok(stats(stems.sfx).peak > 0.05);
  }
  const shortMix = new Float32Array(samples(3) * 2);
  add(shortMix, voice, 0.3, 1.4);
  add(shortMix, effect('bass', 3, 771, 73.4), 0, 0.16);
  const measured = measureRaw(shortMix);
  assert.ok(Number.isFinite(Number(measured.input_i)));
  fs.mkdirSync(audioDir, {recursive: true});
  const testFile = path.join(audioDir, `self-test-${process.pid}-${Date.now()}.wav`);
  let mastered;
  try {
    mastered = master(testFile, shortMix, 3);
    assert.ok(mastered.valid, `Synthetic delivery master failed: ${JSON.stringify(mastered)}`);
  } finally {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  }
  console.log(JSON.stringify({selfTest: 'passed', sampleRate: RATE, checked: ['edge trim keeps interior pauses', 'FFmpeg atempo retains final synthetic syllable', 'all cue timestamps covered', 'all three music/dry windows exact zero', 'exact stereo stem lengths', 'FFmpeg two-pass loudnorm + PCM24 master + independent peak/loudness/duration verification'], syntheticTrimSeconds: round(seconds(trimmed.data.length)), syntheticTempoSeconds: round(seconds(accelerated.length)), measuredLufs: measured.input_i, masterLufs: mastered.integratedLufs, masterTruePeak: mastered.truePeakDbtp}));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: node brand/brainrot-video-system/mix-r3-audio.mjs [--film 1|2|3] [--analyze-only] [--self-test]\nMissing / silent / >1.35x voice lines block only their film. Read public/art/brainrot-r3/audio/mix-r3-report.json.');
    return;
  }
  const allowed = new Set(['--film', '--analyze-only', '--self-test']);
  for (let i = 0; i < args.length; i++) {
    if (!allowed.has(args[i])) throw new Error(`Unknown argument: ${args[i]}`);
    if (args[i] === '--film') {if (!['1', '2', '3'].includes(args[++i])) throw new Error('--film must be 1, 2, or 3.');}
  }
  const source = fs.readFileSync(path.join(here, 'production-data.json'));
  const data = JSON.parse(source.toString());
  assert.equal(data.films.reduce((sum, film) => sum + film.timeline.length, 0), 65, 'Expected all 65 R3 beats.');
  for (const film of data.films) {
    assert.equal(film.timeline.length, Number(film.id) === 1 ? 21 : 22);
    assert.equal(film.duration, Number(film.id) === 1 ? 31.5 : 33);
    film.timeline.forEach((beat, i) => {assert.equal(beat.start, i * 1.5); assert.equal(beat.end, (i + 1) * 1.5);});
  }
  if (args.includes('--self-test')) {selfTest(data); return;}
  const selection = args.indexOf('--film');
  const films = selection < 0 ? data.films : data.films.filter((film) => Number(film.id) === Number(args[selection + 1]));
  const report = {version: 1, createdAt: new Date().toISOString(), source: 'brand/brainrot-video-system/production-data.json',
    productionDataSha256: hash(source), scriptSha256: hash(fs.readFileSync(fileURLToPath(import.meta.url))),
    targets: {sampleRate: RATE, channels: 2, masterCodec: 'pcm_s24le', integratedLufs: TARGET_LUFS,
      maximumTruePeakDbtp: -1, workingTruePeakDbtp: TARGET_TP, maximumTempo: MAX_TEMPO,
      approvedTempoExceptions: TEMPO_EXCEPTIONS, speechIsNeverHardTrimmedToFit: true},
    films: []};
  fs.mkdirSync(audioDir, {recursive: true});
  for (const film of films) {
    try {report.films.push(await processFilm(film, args.includes('--analyze-only')));}
    catch (error) {report.films.push({id: film.id, status: 'error', blockingIssues: [error.message]});}
    // Persist after every film so a later failure does not erase earlier measurements.
    fs.writeFileSync(path.join(audioDir, 'mix-r3-report.json'), JSON.stringify(report, null, 2) + '\n');
  }
  const failures = report.films.filter((film) => !['mixed-verified', 'analyzed-ready'].includes(film.status));
  console.log(JSON.stringify({films: report.films.map((film) => ({id: film.id, status: film.status, blockingIssues: film.blockingIssues, master: film.master && {file: film.master.file, duration: film.master.durationSeconds, lufs: film.master.integratedLufs, truePeak: film.master.truePeakDbtp}})), report: relative(path.join(audioDir, 'mix-r3-report.json'))}, null, 2));
  if (failures.length) process.exitCode = 2;
}

main().catch((error) => {console.error(error.stack ?? error.message); process.exitCode = 1;});
