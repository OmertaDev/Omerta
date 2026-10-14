/**
 * R4 cinematic audio. Local deterministic synthesis only; no old score or samples.
 * node brand/cinematic-video-system/mix-audio.mjs [--film 01|02|03] [--analyze-only]
 * Selects the highest C{01..03}-L{01..18}[-vN].mp3 take without altering sources.
 * Speech is edge-silence-trimmed only. More than 1.12x tempo blocks the film.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const audioDir = path.join(root, 'public/art/cinematic-r4/audio');
const binDir = path.join(root, 'brand/hype-flywheel-video/node_modules/@remotion/compositor-win32-x64-msvc');
const ffmpeg = path.join(binDir, 'ffmpeg.exe');
const ffprobe = path.join(binDir, 'ffprobe.exe');
const RATE = 48000;
const MAX_TEMPO = 1.12;
const LEAD = 0.05;
const EXIT = 0.10;
const GUARD = 0.03;
const TARGET_LUFS = -14;
const TARGET_TP = -1.3;
const amp = (value) => 10 ** (value / 20);
const db = (value) => 20 * Math.log10(Math.max(value, 1e-12));
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const round = (value, places = 6) => Number(value.toFixed(places));
const seconds = (length) => length / RATE;
const samples = (duration) => Math.round(duration * RATE);
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relative = (file) => path.relative(root, file).replaceAll('\\', '/');
const floatBuffer = (data) => Buffer.from(data.buffer, data.byteOffset, data.byteLength);
const rawInput = (channels) => ['-f', 'f32le', '-ar', String(RATE), '-ac', String(channels), '-i', 'pipe:0'];

function run(exe, args, input) {
  const result = spawnSync(exe, args, {input, maxBuffer: 128 * 1024 * 1024, windowsHide: true});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(exe)} exited ${result.status}: ${result.stderr.toString().slice(-5000)}`);
  return result;
}
const ff = (args, input) => run(ffmpeg, ['-hide_banner', '-nostdin', ...args], input);

function wavFloats(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Invalid PCM WAV.');
  let bits = 0, channels = 0;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const begin = offset + 8;
    if (id === 'fmt ') {channels = buffer.readUInt16LE(begin + 2); bits = buffer.readUInt16LE(begin + 14);}
    if (id === 'data') {
      if (bits !== 24 || channels !== 1) throw new Error('Expected mono PCM24.');
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

function decode(file) {
  return wavFloats(ff(['-v', 'error', '-i', file, '-map', '0:a:0', '-ac', '1', '-ar', String(RATE),
    '-c:a', 'pcm_s24le', '-f', 'wav', 'pipe:1']).stdout);
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

function trimEdges(data) {
  const measured = stats(data);
  const threshold = Math.max(amp(-60), measured.peak * amp(-48));
  let first = 0, last = data.length - 1;
  while (first < data.length && Math.abs(data[first]) < threshold) first++;
  while (last >= first && Math.abs(data[last]) < threshold) last--;
  if (first >= data.length || measured.peak < amp(-55)) throw new Error('Silent voice file.');
  const start = Math.max(0, first - samples(GUARD));
  const end = Math.min(data.length, last + 1 + samples(GUARD));
  return {data: data.slice(start, end), start, end, first, last, thresholdDbfs: round(db(threshold), 2)};
}

function tempo(data, factor) {
  if (factor === 1) return data.slice();
  return wavFloats(ff(['-v', 'error', ...rawInput(1), '-af', `atempo=${factor.toFixed(9)}`,
    '-c:a', 'pcm_s24le', '-f', 'wav', 'pipe:1'], floatBuffer(data)).stdout);
}

function selectTake(lineId) {
  const pattern = new RegExp(`^${lineId}(?:-v([1-9]\\d*))?\\.mp3$`);
  const takes = fs.readdirSync(audioDir).flatMap((name) => {
    const match = name.match(pattern);
    return match ? [{file: path.join(audioDir, name), version: match[1] ? Number(match[1]) : 0}] : [];
  }).sort((a, b) => b.version - a.version);
  return {selected: takes[0], provenance: takes.map((t) => ({file: relative(t.file), version: t.version, sha256: hash(fs.readFileSync(t.file))}))};
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

function polishVoice(data) {
  const out = data.slice();
  biquad(out, 75, true); biquad(out, 12500);
  const before = stats(out), inputGain = Math.min(amp(10), amp(-18.0) / Math.max(before.rms, 1e-6));
  const attack = Math.exp(-1 / (RATE * 0.006)), release = Math.exp(-1 / (RATE * 0.100));
  let envelope = 0;
  for (let i = 0; i < out.length; i++) {
    const x = out[i] * inputGain, k = Math.abs(x) > envelope ? attack : release;
    envelope = k * envelope + (1 - k) * Math.abs(x);
    out[i] = x * amp(-Math.max(0, db(envelope) + 16) * (1 - 1 / 2));
  }
  const after = stats(out), gain = Math.min(amp(-18.0) / Math.max(after.rms, 1e-6), amp(-3) / after.peak);
  const fade = samples(0.002);
  for (let i = 0; i < out.length; i++) out[i] *= gain * Math.min(1, i / fade, (out.length - 1 - i) / fade);
  return {data: out, gainDb: round(db(inputGain * gain), 3)};
}

function rng(seed) {
  let state = seed >>> 0;
  return () => {state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296;};
}

function sound(kind, duration, seed, hz = 220) {
  const out = new Float32Array(samples(duration)), random = rng(seed);
  let phase = 0, noiseLow = 0, noiseVeryLow = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE, p = t / duration, noise = random() * 2 - 1;
    noiseLow += 0.045 * (noise - noiseLow); noiseVeryLow += 0.004 * (noise - noiseVeryLow);
    const band = noiseLow - noiseVeryLow;
    const edge = Math.min(1, t / 0.003, (duration - t) / 0.02);
    let value;
    if (kind === 'impact' || kind === 'brand' || kind === 'drum') {
      phase += 2 * Math.PI * (43 + (kind === 'drum' ? 75 : 120) * Math.exp(-t * 32)) / RATE;
      value = Math.sin(phase) * Math.exp(-t * (kind === 'brand' ? 3.2 : 9)) + band * 2.5 * Math.exp(-t * 32);
      value += Math.sin(2 * Math.PI * 820 * t) * 0.11 * Math.exp(-t * 50);
      if (kind === 'brand') value += 0.12 * Math.sin(2 * Math.PI * 146.832 * t) * Math.exp(-t * 3.2);
    } else if (kind === 'marker') {
      const q = t < 0.032 ? t : t - 0.046;
      value = q >= 0 && q < 0.032 ? (Math.sin(2 * Math.PI * 1470 * q) + 0.36 * Math.sin(2 * Math.PI * 2055 * q)) * Math.sin(Math.PI * q / 0.032) : 0;
    } else if (kind === 'whoosh') {
      value = band * 3.5 * Math.sin(Math.PI * p) ** 1.6 + 0.10 * Math.sin(2 * Math.PI * (430 * t - 125 * t * t)) * Math.sin(Math.PI * p) ** 3;
    } else if (kind === 'tick') {
      value = (noise - noiseLow) * Math.exp(-t * 220) * 0.45 + Math.sin(2 * Math.PI * hz * t) * Math.exp(-t * 160) * 0.35;
    } else if (kind === 'wood') {
      value = (Math.sin(2 * Math.PI * hz * t) + 0.4 * Math.sin(2 * Math.PI * hz * 1.517 * t)) * Math.exp(-t * 34) + band * Math.exp(-t * 60);
    } else if (kind === 'pluck') {
      value = (Math.sin(2 * Math.PI * hz * t) + 0.18 * Math.sin(2 * Math.PI * hz * 2.001 * t) + 0.05 * Math.sin(2 * Math.PI * hz * 3 * t)) * Math.exp(-t * 5.5);
    } else if (kind === 'pad') {
      value = (Math.sin(2 * Math.PI * hz * t) + 0.24 * Math.sin(2 * Math.PI * hz * 1.003 * t + 0.4) + 0.06 * Math.sin(2 * Math.PI * hz * 2 * t)) * Math.sin(Math.PI * p) ** 0.7;
      value *= 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.11 * t);
    } else if (kind === 'pulse') {
      value = (Math.sin(2 * Math.PI * hz * t) + 0.20 * Math.sin(2 * Math.PI * hz * 2 * t)) * Math.exp(-t * 4.5);
    } else throw new Error(`Unknown sound ${kind}`);
    out[i] = value * edge;
  }
  return out;
}

function add(stereo, mono, at, gain = 1, pan = 0, panEnd = pan) {
  const offset = samples(at);
  for (let i = 0; i < mono.length && i + offset < stereo.length / 2; i++) {
    if (i + offset < 0) continue;
    const position = clamp(pan + (panEnd - pan) * i / mono.length, -1, 1), a = (position + 1) * Math.PI / 4;
    stereo[(i + offset) * 2] += mono[i] * gain * Math.cos(a);
    stereo[(i + offset) * 2 + 1] += mono[i] * gain * Math.sin(a);
  }
}

function silenceGain(t, windows) {
  let gain = 1;
  for (const [start, end] of windows) {
    if (t >= start && t < end) return 0;
    if (t >= start - 0.025 && t < start) gain = Math.min(gain, (start - t) / 0.025);
    if (t >= end && t < end + 0.10) gain = Math.min(gain, (t - end) / 0.10);
  }
  return gain;
}

function score(film, dialogue) {
  const id = Number(film.id), size = samples(film.duration) * 2;
  const music = new Float32Array(size), sfx = new Float32Array(size), room = new Float32Array(size);
  const bpm = {1: 84, 2: 108, 3: 72}[id], quarter = 60 / bpm;
  const silenceBeat = {1: 14, 2: 11, 3: 12}[id];
  const importantAt = film.beats[silenceBeat - 1].start, brandAt = film.beats.at(-1).start;
  const silenceWindows = [[importantAt - 0.40, importantAt + 0.42], [brandAt - 0.32, brandAt]]
    .map((window) => window.map((at) => samples(at) / RATE));
  const cues = [];
  let serial = 4100 + id * 1103;
  function note(target, kind, at, duration, gain, pan = 0, hz = 220, panEnd = pan) {
    add(target, sound(kind, duration, ++serial, hz), at, gain, pan, panEnd);
    if (target === sfx) cues.push({at: round(at), kind, duration, gain, pan, panEnd, frequency: hz});
  }
  // Sustained original harmonic phrases: low minor power, precise clockwork, then unresolved knowledge.
  const progressions = {
    1: [[73.416,146.832,174.614,220],[65.406,130.812,174.614,220],[58.270,116.540,146.832,174.614],[69.296,138.592,164.814,220]],
    2: [[65.406,130.812,155.563,195.998],[77.782,155.563,184.997,233.082],[58.270,116.540,146.832,174.614],[65.406,130.812,155.563,195.998]],
    3: [[55,110,146.832,164.814],[58.270,116.540,146.832,164.814],[55,110,138.592,174.614],[51.913,103.826,146.832,164.814]],
  };
  const section = quarter * 16;
  for (let at = -1, bar = 0; at < brandAt; at += section, bar++) {
    const chord = progressions[id][bar % 4];
    chord.forEach((hz, n) => note(music, 'pad', at, section + 2.2, n === 0 ? 0.10 : 0.030, n === 0 ? 0 : (n - 2) * 0.40, hz));
  }
  for (let step = 0, at = 0; at < brandAt - 0.4; step++, at = step * quarter) {
    const growth = 0.68 + 0.32 * at / brandAt;
    const chord = progressions[id][Math.floor(at / section) % 4];
    if (id === 1) {
      if (step % 4 === 0) note(music, 'drum', at, 0.60, 0.14 * growth);
      if (step % 4 === 2 && at > 14) note(music, 'wood', at, 0.19, 0.065 * growth, 0.25, 172);
      if (step % 2 === 0) note(music, 'pulse', at + 0.06, 0.9, 0.065 * growth, 0, chord[0]);
      if (step % 8 === 6 && at > 24) note(music, 'pluck', at, 1.2, 0.022, -0.35, chord[2] * 2);
    } else if (id === 2) {
      note(music, 'tick', at, 0.055, 0.039 * growth, step % 2 ? -0.23 : 0.23, step % 2 ? 1090 : 1430);
      note(music, 'pluck', at + quarter / 2, 0.70, 0.037 * growth, step % 2 ? 0.3 : -0.3, chord[1 + step % 3]);
      if (step % 4 === 0) note(music, 'pulse', at, 1.0, 0.085 * growth, 0, chord[0]);
      if (step % 8 === 6 && at > 25) note(music, 'wood', at, 0.12, 0.032 * growth, 0.15, 315);
    } else {
      if (step % 4 === 0) note(music, 'pluck', at + 0.1, 1.8, 0.030 * growth, step % 8 ? 0.5 : -0.5, chord[2] * 2);
      if (step % 8 === 6) note(music, 'wood', at, 0.20, 0.028, -0.25, 228);
      if (step % 4 === 0 && at > 30) note(music, 'pulse', at, 1.0, 0.045 * growth, 0, chord[0]);
    }
  }
  // All MLG-like gestures are synthesized and sparse: scoped accents or brief rotational sweeps.
  for (let i = 0; i < film.beats.length; i++) {
    const beat = film.beats[i], at = beat.start;
    if (i === film.beats.length - 1) continue;
    if (beat.transition === 'spin') {
      note(sfx, 'whoosh', Math.max(0, at - 0.20), 0.42, 0.20, -0.8, 220, 0.8);
      note(sfx, 'impact', at + 0.02, 0.50, 0.23);
      note(sfx, 'marker', at + 0.055, 0.085, 0.055);
    } else if (beat.transition === 'scope') {
      note(sfx, 'whoosh', Math.max(0, at - 0.12), 0.24, 0.105, -0.2, 220, 0.2);
      note(sfx, 'impact', at, 0.34, i === 0 ? 0.25 : 0.15);
      note(sfx, 'marker', at + 0.018, 0.085, 0.050);
    } else if (beat.transition === 'snap') note(sfx, 'tick', at, 0.07, 0.075, 0, 1570);
  }
  note(sfx, 'brand', brandAt, 2.1, 0.25);
  // A low resolved brand chord leaves space for the final voice.
  [73.416,110,146.832].forEach((hz, i) => note(music, 'pad', brandAt + 0.08, film.duration - brandAt - 0.08, i === 0 ? 0.070 : 0.021, (i - 1) * 0.18, hz));
  const random = rng(1991 + id), attack = Math.exp(-1 / (RATE * 0.01)), release = Math.exp(-1 / (RATE * 0.22));
  let left = 0, right = 0, envelope = 0;
  for (let frame = 0; frame < size / 2; frame++) {
    const t = frame / RATE;
    left += 0.012 * (random() * 2 - 1 - left); right += 0.012 * (random() * 2 - 1 - right);
    const voice = Math.max(Math.abs(dialogue[frame * 2]), Math.abs(dialogue[frame * 2 + 1]));
    const k = voice > envelope ? attack : release; envelope = k * envelope + (1 - k) * voice;
    const duck = 1 - clamp(envelope / 0.03, 0, 1) * (1 - amp(-7));
    const mute = silenceGain(t, silenceWindows), fade = Math.min(1, t / 0.014, (film.duration - t) / 0.36);
    for (let ch = 0; ch < 2; ch++) {
      music[frame * 2 + ch] *= mute * fade * duck;
      sfx[frame * 2 + ch] *= mute * Math.min(1, (film.duration - t) / 0.04);
      const hum = Math.sin(2 * Math.PI * (id === 3 ? 41.203 : 55) * t) * (id === 3 ? 0.0014 : 0.0004);
      room[frame * 2 + ch] = ((ch ? right : left) * (id === 3 ? 0.018 : 0.009) + hum) * mute * fade;
    }
  }
  return {music, sfx, room, bpm, cues, silenceWindows,
    direction: {1: 'D minor low pulse, sparse heavy percussion, sustained tense chords',2: 'C minor clock pulse, muted alternating arpeggio, finite low-frequency movement',3: 'A suspended minor atmosphere, irregular high plucks, low room drone'}[id]};
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
    valid: Math.abs(actual-duration)<0.5/RATE && Number(stream.sample_rate)===RATE && stream.channels===2 && Number(final.input_tp)<=-1 && Math.abs(Number(final.input_i)-TARGET_LUFS)<=0.7,
    preNormalization: measured, secondPass, finalMeasurement: final};
}

function captionPages(text, start, end, lineId) {
  let pages=[text];
  if(text.length>54){
    const words=text.split(/\s+/);
    const choices=[];
    for(let split=1;split<words.length;split++){
      const left=words.slice(0,split).join(' '),right=words.slice(split).join(' ');
      if(left.length>54||right.length>54)continue;
      const punctuation=/[,.;:]$/.test(words[split-1])?8:0;
      const phrase=/^(and|while|with|through|because|then|your|the)$/i.test(words[split])?3:0;
      choices.push({left,right,score:Math.abs(left.length-right.length)-punctuation-phrase});
    }
    choices.sort((a,b)=>a.score-b.score);
    if(!choices.length)throw new Error(`${lineId}: caption requires more than two readable pages.`);
    pages=[choices[0].left,choices[0].right];
  }
  const weights=pages.map(page=>page.replace(/[^A-Za-zÀ-ÿ0-9]/g,'').length+page.split(/\s+/).length*1.5);
  const total=weights.reduce((a,b)=>a+b,0);let current=start;
  return pages.map((page,i)=>{const next=i===pages.length-1?end:current+(end-start)*weights[i]/total;const item={id:`${lineId}-P${i+1}`,lineId,text:page,fullText:text,start:round(current),end:round(next),timing:pages.length===1?'Measured audible sentence edges':'Sentence edges measured; intra-sentence page break estimated proportionally'};current=next;return item;});
}

function processFilm(film, analyzeOnly) {
  const report = {id:film.id,title:film.title,duration:film.duration,status:'analyzing',lines:[],blockingIssues:[],reviewRequired:'Manual listening for pronunciation, complete words, timbre, pacing and balance remains necessary. Captions are estimated line/chunk timing, not ASR word alignment.'};
  const dialogue = new Float32Array(samples(film.duration)*2), captions = [];
  for (let i=0;i<film.beats.length;i++) {
    const beat=film.beats[i], lineId=`C${film.id}-L${String(i+1).padStart(2,'0')}`, take=selectTake(lineId);
    const line={id:lineId,text:beat.narration,start:beat.start,end:beat.end,availableTakes:take.provenance}; report.lines.push(line);
    try {
      if (!take.selected) {line.status='missing'; report.blockingIssues.push(`${lineId}: missing MP3`); continue;}
      const file=take.selected.file, raw=decode(file), edges=trimEdges(raw), available=samples(beat.end-beat.start-LEAD-EXIT);
      Object.assign(line,{source:relative(file),selectedVersion:take.selected.version,sourceSha256:hash(fs.readFileSync(file)),decodedDurationSeconds:round(seconds(raw.length)),trimmedDurationSeconds:round(seconds(edges.data.length)),leadingSilenceRemovedSeconds:round(seconds(edges.start)),trailingSilenceRemovedSeconds:round(seconds(raw.length-edges.end)),retainedEdgeGuardSeconds:GUARD,trimThresholdDbfs:edges.thresholdDbfs});
      let factor=Math.max(1,edges.data.length/available);
      line.requiredTempo=round(factor);
      if(factor>MAX_TEMPO){line.status='regenerate-too-long';report.blockingIssues.push(`${lineId}: trimmed ${seconds(edges.data.length).toFixed(3)}s; slot ${seconds(available).toFixed(3)}s requires ${factor.toFixed(3)}x; limit 1.12x.`);continue;}
      let fitted=tempo(edges.data,factor),passes=1;
      while(fitted.length>available&&passes<5){factor*=fitted.length/available*1.001;if(factor>MAX_TEMPO)break;fitted=tempo(edges.data,factor);passes++;}
      Object.assign(line,{appliedTempo:round(factor),tempoPasses:passes,fittedDurationSeconds:round(seconds(fitted.length))});
      if(factor>MAX_TEMPO||fitted.length>available){line.status='regenerate-too-long';report.blockingIssues.push(`${lineId}: measured atempo output cannot fit full speech below 1.12x.`);continue;}
      const voice=polishVoice(fitted),at=beat.start+LEAD,end=at+seconds(voice.data.length),audible=trimEdges(voice.data);
      const speechStart=at+seconds(audible.first),speechEnd=at+seconds(audible.last+1);
      add(dialogue,voice.data,at,Math.SQRT2);
      Object.assign(line,{status:'ready',placedAtSeconds:round(at),spokenBufferEndSeconds:round(end),audibleSpeechStartSeconds:round(speechStart),audibleSpeechEndSeconds:round(speechEnd),remainingBeatSeconds:round(beat.end-end),processingGainDb:voice.gainDb,eq:'75 Hz high-pass; 12.5 kHz low-pass; gentle 2:1 compression; mono center',outputStats:stats(voice.data)});
      captions.push(...captionPages(beat.narration,speechStart,speechEnd,lineId));
      console.log(`${lineId} [v${take.selected.version}] ${line.trimmedDurationSeconds.toFixed(3)}s -> ${line.fittedDurationSeconds.toFixed(3)}s (${line.appliedTempo.toFixed(3)}x)`);
    }catch(error){line.status='error';line.error=error.message;report.blockingIssues.push(`${lineId}: ${error.message}`);}
  }
  report.noSpeechOverlap=report.lines.filter(l=>l.status==='ready').every((l,i,a)=>i===0||l.placedAtSeconds>=a[i-1].spokenBufferEndSeconds);
  fs.writeFileSync(path.join(audioDir,`${film.id}-captions.json`),JSON.stringify({film:film.id,timing:'Audible sentence edges measured after conservative edge trim, atempo and voice processing. Sentences longer than 54 characters have proportional phrase-page timing; not word-level ASR alignment.',lines:captions},null,2)+'\n');
  if(report.blockingIssues.length){report.status='blocked';return report;}
  if(analyzeOnly){report.status='analyzed-ready';return report;}
  const stems=score(film,dialogue);
  Object.assign(report,{bpm:stems.bpm,musicDirection:stems.direction,ducking:{musicUnderSpeechDb:-7,attackMs:10,releaseMs:220},cues:stems.cues});
  report.silenceChecks=stems.silenceWindows.map(([start,end])=>({start,end,exactZero:['music','sfx','room'].every(name=>stems[name].subarray(samples(start)*2,samples(end)*2).every(v=>v===0)),scope:'Music, SFX and room silence; narration retains all words.'}));
  if(report.silenceChecks.some(c=>!c.exactZero))throw new Error('Planned instrumental silence failed.');
  const mixed=new Float32Array(dialogue.length); report.stems={};
  for(const[name,data]of Object.entries({dialogue,music:stems.music,sfx:stems.sfx,room:stems.room})){
    const file=path.join(audioDir,`${film.id}-${name}.wav`);writeStem(file,data);report.stems[name]={file:relative(file),codec:'pcm_s24le',sampleRate:RATE,channels:2,...stats(data)};
    for(let i=0;i<mixed.length;i++)mixed[i]+=data[i];
  }
  report.rawMixStats=stats(mixed);report.master=master(path.join(audioDir,`${film.id}-mix.wav`),mixed,film.duration);
  report.status=report.master.valid?'mixed-verified':'master-out-of-spec';
  if(!report.master.valid)report.blockingIssues.push('Master failed measured technical delivery targets.');
  return report;
}

function writeAudioPlan(report) {
  const time=(n)=>`${String(Math.floor(n/60)).padStart(2,'0')}:${(n%60).toFixed(3).padStart(6,'0')}`;
  const esc=(text)=>String(text).replaceAll('|','/');
  const sections=report.films.map((film)=>{
    const lines=[`## ${film.id}. ${film.title ?? ''}`,`Duration: ${film.duration}s. State: ${film.status}.`,
      `Voice: fresh fal narration, using an original account-designed voice. All source takes are retained. Complete speech is preserved; only contiguous edge silence is removed. Scheduling reserves 50 ms before each buffer and 100 ms after it. Maximum allowed local tempo is 1.12×.`,
      `Score: ${film.musicDirection ?? 'See final mix report once rendered'}. ${film.bpm ?? 'Pending'} BPM. Original oscillators, filtered noise and percussion; no sampled commercial music or meme audio.`,
      'Voice stays centered. Music ducks by up to 7 dB under speech, with 10 ms attack and 220 ms release. Percussion supports section turns, not individual words. Synthesized 360 sweeps travel across stereo; the main impact and voice remain mono-compatible.',
      film.master?`Verified master: ${film.master.integratedLufs} LUFS integrated; ${film.master.truePeakDbtp} dBTP; ${film.master.sampleRate} Hz, stereo PCM24, exactly ${film.master.durationSeconds}s.`:'Final master pending.',
      `Caption file: public/art/cinematic-r4/audio/${film.id}-captions.json. Sentence start/end follows measured audible signal. Sentences over 54 characters are split into two phrase pages; the internal break is a proportional estimate, not forced word alignment.`,
      '### Dialogue placement','| Line | Audible window | Selected take | Local tempo | Spoken text |','|---|---|---|---|---|'];
    for(const line of film.lines??[])lines.push(`| ${line.id} | ${line.status==='ready'?`${time(line.audibleSpeechStartSeconds)}–${time(line.audibleSpeechEndSeconds)}`:'Pending'} | v${line.selectedVersion??'?'} | ${line.appliedTempo?.toFixed(3)??'—'}× | ${esc(line.text)} |`);
    lines.push('### Intentional silence','Silence applies to music, room and SFX. Narration continues intact, so the important statement lands dry.');
    for(const check of film.silenceChecks??[])lines.push(`- ${time(check.start)}–${time(check.end)}: ${check.exactZero?'verified exact instrumental silence':'verification pending'}.`);
    lines.push('### Exact effects cue sheet','Scope entries use a restrained impact and a two-part custom chirp. Spin entries use a short sweep, impact and chirp. Snap entries use one small tactile tick. Other pans stay quiet. Brand uses a longer low impact plus the concluding score chord.','| Time | Effect | Duration | Pan movement | Linear pre-master gain |','|---|---|---|---|---|');
    for(const cue of film.cues??[])lines.push(`| ${time(cue.at)} | ${cue.kind} | ${cue.duration.toFixed(3)}s | ${cue.pan} → ${cue.panEnd} | ${cue.gain} |`);
    lines.push('Effects inside the intentional silence windows are muted; cue entries describe their scheduled source events, while the silence rows describe the final audible result.',
      '### Score timing',
      `The ${film.bpm??'specified'} BPM grid begins at 00:00.000. A quarter is ${(60/(film.bpm??60)).toFixed(6)}s. For the exact formulas below, q is that quarter duration and n is a nonnegative integer. Rhythmic events stop before ${time((film.lines?.at(-1)?.start??film.duration-4)-0.4)}. Intentional silence and voice ducking still apply.`,
      { '01': 'Empire grid: drums at 4nq (0.600s); wood hits at (4n+2)q after 00:14.000 (0.190s); low pulses at 2nq+0.060 (0.900s); upper plucks at (8n+6)q after 00:24.000 (1.200s).',
        '02': 'Economy grid: clock ticks at nq (0.055s); alternating arpeggio notes at nq+q/2 (0.700s); bass pulses at 4nq (1.000s); wood accents at (8n+6)q after 00:25.000 (0.120s).',
        '03': 'Intelligence grid: suspended upper plucks at 4nq+0.100 (1.800s); sparse wood accents at (8n+6)q (0.200s); low pulses at 4nq after 00:30.000 (1.000s).'}[film.id],
      `Harmonic phrases start at −1.000 + 16nq, each lasting 16q+2.200s; the negative preroll is cropped to the delivered opening. Each phrase overlaps the next by 2.200s. New phrases stop at the brand entry, ${time(film.lines?.at(-1)?.start??film.duration-4)}. The brand impact begins exactly there; a D/A sustained chord enters 80ms later and lasts to the end. Music and room fade over ${time(film.duration-0.36)}–${time(film.duration)}.`,
      '### Files',
      ...['mix','dialogue','music','sfx','room'].map(name=>`- public/art/cinematic-r4/audio/${film.id}-${name}.wav`));
    return lines.join('\n\n').replace(/\|\n\n\|/g,'|\n|');
  });
  fs.writeFileSync(path.join(here,'audio-plan.md'),'# OMERTÀ cinematic campaign — audio plan\n\nAll three scores and effects are newly synthesized for this campaign. No third-party samples or previous-campaign audio are reused. The narration uses original account-designed voices with newly generated words. This plan records the actual local mix, not a proposed soundtrack.\n\nTechnical measurements do not replace listening review for pronunciation, delivery, music timbre or phone-speaker balance.\n\n'+sections.join('\n\n')+'\n');
}

function main(){
  const args=process.argv.slice(2),at=args.indexOf('--film'),selection=at<0?null:String(Number(args[at+1])).padStart(2,'0');
  if(selection&&!['01','02','03'].includes(selection))throw new Error('--film must be 01, 02 or 03');
  fs.mkdirSync(audioDir,{recursive:true});
  const source=fs.readFileSync(path.join(here,'production-data.json')),data=JSON.parse(source.toString());
  if(args.includes('--plan-only')){
    writeAudioPlan(JSON.parse(fs.readFileSync(path.join(audioDir,'audio-report.json'))));
    console.log('Updated readable audio plan from verified reports; no audio or production data changed.');return;
  }
  if(args.includes('--score-preview')){
    for(const film of data.films.filter(f=>!selection||f.id===selection)){
      const stems=score(film,new Float32Array(samples(film.duration)*2)),mix=new Float32Array(stems.music.length);
      for(let i=0;i<mix.length;i++)mix[i]=stems.music[i]+stems.sfx[i]+stems.room[i];
      const result=master(path.join(audioDir,`${film.id}-score-preview.wav`),mix,film.duration);
      const silence=stems.silenceWindows.every(([start,end])=>['music','sfx','room'].every(name=>stems[name].subarray(samples(start)*2,samples(end)*2).every(v=>v===0)));
      console.log(JSON.stringify({film:film.id,preview:'Score and effects only; no dialogue. This preview is louder than the score in the final mix.',valid:result.valid,silence,lufs:result.integratedLufs,truePeak:result.truePeakDbtp}));
      if(!result.valid||!silence)process.exitCode=2;
    }
    return;
  }
  const previousFile=path.join(audioDir,'audio-report.json'),previous=fs.existsSync(previousFile)?JSON.parse(fs.readFileSync(previousFile)):null;
  const report={version:1,createdAt:new Date().toISOString(),source:'brand/cinematic-video-system/production-data.json',productionDataSha256:hash(source),scriptSha256:hash(fs.readFileSync(fileURLToPath(import.meta.url))),sourcePolicy:'Fresh R4 fal narration plus original deterministic oscillators and noise; no third-party samples or previous campaign media.',targets:{sampleRate:RATE,channels:2,masterCodec:'pcm_s24le',integratedLufs:TARGET_LUFS,maximumTruePeakDbtp:-1,workingTruePeakDbtp:TARGET_TP,maximumTempo:MAX_TEMPO,speechIsNeverHardTrimmedToFit:true},films:selection?(previous?.films??[]).filter(f=>f.id!==selection):[]};
  for(const film of data.films.filter(f=>!selection||f.id===selection)){
    try{report.films.push(processFilm(film,args.includes('--analyze-only')));}catch(error){report.films.push({id:film.id,status:'error',blockingIssues:[error.message]});}
    report.films.sort((a,b)=>a.id.localeCompare(b.id));fs.writeFileSync(previousFile,JSON.stringify(report,null,2)+'\n');
  }
  const current=report.films.filter(f=>!selection||f.id===selection);
  writeAudioPlan(report);
  console.log(JSON.stringify(current.map(f=>({id:f.id,status:f.status,blockingIssues:f.blockingIssues,master:f.master&&{file:f.master.file,duration:f.master.durationSeconds,lufs:f.master.integratedLufs,truePeak:f.master.truePeakDbtp}})),null,2));
  if(current.some(f=>!['mixed-verified','analyzed-ready'].includes(f.status)))process.exitCode=2;
}
main();
