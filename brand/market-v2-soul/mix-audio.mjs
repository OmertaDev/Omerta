/** Native-speed chapter narration with a new organic noir music bed. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const audioDir=path.join(root,'public/art/market-v2-soul/audio');
const binDir=path.join(root,'brand/hype-flywheel-video/node_modules/@remotion/compositor-win32-x64-msvc');
const ffmpeg=path.join(binDir,'ffmpeg.exe'),ffprobe=path.join(binDir,'ffprobe.exe');
const RATE=48000,TARGET_LUFS=-14,TARGET_TP=-1.5;
const amp=v=>10**(v/20),db=v=>20*Math.log10(Math.max(v,1e-12));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),round=(v,p=6)=>Number(v.toFixed(p));
const samples=t=>Math.round(t*RATE),seconds=n=>n/RATE;
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const relative=p=>path.relative(root,p).replaceAll('\\','/');
const floatBuffer=d=>Buffer.from(d.buffer,d.byteOffset,d.byteLength);
const rawInput=channels=>['-f','f32le','-ar',String(RATE),'-ac',String(channels),'-i','pipe:0'];
function run(exe, args, input) {
  const result = spawnSync(exe, args, {input, maxBuffer: 128 * 1024 * 1024, windowsHide: true});
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

function rng(seed) {
  let state = seed >>> 0;
  return () => {state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296;};
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

function resolveAsset(src){
  if(!src)throw new Error('Missing local asset path.');
  if(/^https?:/i.test(src))throw new Error('Download chapter/music source locally before mixing.');
  if(path.isAbsolute(src))return src;
  const clean=src.replaceAll('\\','/').replace(/^\//,'');
  if(clean.startsWith('public/'))return path.join(root,clean);
  if(clean.startsWith('art/'))return path.join(root,'public',clean);
  if(clean.startsWith('audio/'))return path.join(audioDir,clean.slice(6));
  return path.join(audioDir,clean);
}

function polishNarration(data){
  const out=data.slice();biquad(out,48,true);biquad(out,14800);
  const before=stats(out),inputGain=Math.min(amp(8),amp(-20)/Math.max(before.rms,1e-9));
  const attack=Math.exp(-1/(RATE*0.025)),release=Math.exp(-1/(RATE*0.23));
  let envelope=0,maxReduction=0;
  for(let i=0;i<out.length;i++){
    const x=out[i]*inputGain,k=Math.abs(x)>envelope?attack:release;
    envelope=k*envelope+(1-k)*Math.abs(x);
    const over=db(envelope)+15,knee=6;
    const excess=over<-knee/2?0:over>knee/2?over:(over+knee/2)**2/(2*knee);
    const reduction=excess*(1-1/1.35);maxReduction=Math.max(maxReduction,reduction);
    out[i]=x*amp(-reduction);
  }
  const after=stats(out),gain=Math.min(amp(-20)/Math.max(after.rms,1e-9),amp(-3.0)/after.peak);
  for(let i=0;i<out.length;i++)out[i]*=gain;
  return{data:out,report:{globalGainDb:round(db(inputGain*gain),3),maximumCompressionDb:round(maxReduction,3),ratio:1.35,attackMs:25,releaseMs:230,highPassHz:48,lowPassHz:14800,normalization:'One gain curve over all chapters; no sentence-by-sentence leveling',tempo:1,pitchShift:0}};
}

function prepareNarration(film,timing){
  const raw=new Float32Array(samples(film.duration)),chapters=[],words=[],issues=[];
  let previousEnd=0;
  for(const [index,chapter]of timing.chapters.entries()){
    const id=chapter.id??`SOUL-CH${String(index+1).padStart(2,'0')}`,file=resolveAsset(chapter.src??`${id}.mp3`);
    const item={id,source:relative(file),start:chapter.start,end:chapter.end,tempo:1};chapters.push(item);
    try{
      if(!fs.existsSync(file))throw new Error('Chapter audio is missing.');
      if(!(chapter.start>=0&&chapter.end>chapter.start&&chapter.end<=film.duration+1/RATE))throw new Error('Invalid chapter placement.');
      if(chapter.start<previousEnd-1/RATE)throw new Error('Chapter overlaps the previous audio buffer.');
      const data=decode(file),inPoint=chapter.trimStart??0,outPoint=chapter.trimEnd??seconds(data.length);
      if(!(inPoint>=0&&outPoint>inPoint&&outPoint<=seconds(data.length)+1/RATE))throw new Error('Invalid explicit trimStart/trimEnd source coordinates.');
      const voice=data.slice(samples(inPoint),Math.min(data.length,samples(outPoint)));
      const at=samples(chapter.start),available=samples(chapter.end-chapter.start);
      Object.assign(item,{sourceSha256:hash(fs.readFileSync(file)),sourceDuration:round(seconds(data.length)),sourceMetadata:probe(file),trimStart:inPoint,trimEnd:outPoint,
        sourceSampleCount:data.length,placedSampleCount:voice.length,removedSampleCount:data.length-voice.length,
        explicitTrimRequested:chapter.trimStart!==undefined||chapter.trimEnd!==undefined,
        placedDuration:round(seconds(voice.length)),remainingWindow:round(seconds(available-voice.length))});
      if(voice.length>available)throw new Error(`Full native-speed clip exceeds chapter window by ${seconds(voice.length-available).toFixed(6)}s. Extend the scene placement; speech will not be cut or accelerated.`);
      if(at+voice.length>raw.length)throw new Error('Full chapter exceeds film duration.');
      if(!Array.isArray(chapter.words)||!chapter.words.length)throw new Error('Word alignment is required for accurate captions and breathing dynamics.');
      let previousWordStart=-1;
      for(const [wordIndex,word]of chapter.words.entries()){
        const text=String(word.text??'').trim();if(!text)continue;
        if(!(Number.isFinite(word.start)&&Number.isFinite(word.end)&&word.end>=word.start&&word.start>=inPoint-0.08&&word.end<=outPoint+0.08))throw new Error(`Invalid source word range ${wordIndex}: ${text}`);
        if(word.start<previousWordStart-0.03)throw new Error(`Word timing moves backwards at ${text}.`);
        previousWordStart=word.start;
        words.push({chapter:id,text,start:round(chapter.start+word.start-inPoint),end:round(chapter.start+word.end-inPoint),sourceStart:word.start,sourceEnd:word.end});
      }
      raw.set(voice,at);previousEnd=chapter.start+seconds(voice.length);
      Object.assign(item,{status:'ready',bufferEnd:round(previousEnd),wordCount:chapter.words.length,gapFromPriorChapter:index?round(chapter.start-chapters[index-1].bufferEnd):round(chapter.start)});
      console.log(`${id}: ${item.placedDuration.toFixed(3)}s at native speed; ${item.remainingWindow.toFixed(3)}s window margin.`);
    }catch(error){item.status='blocked';item.error=error.message;issues.push(`${id}: ${error.message}`);}
  }
  return{raw,chapters,words,issues};
}

function makeCaptionPages(words,provided,duration){
  let pages;
  if(provided?.length){
    pages=provided.map((p,i)=>({id:p.id??`SOUL-CAP-${String(i+1).padStart(3,'0')}`,text:p.text,
      start:p.start??p.startMs/1000,end:p.end??p.endMs/1000,...(p.beatId?{beatId:p.beatId}:{}),timing:'Root-provided forced-aligned caption timing'}));
  }else{
    pages=[];let group=[];
    const flush=()=>{if(!group.length)return;pages.push({id:`SOUL-CAP-${String(pages.length+1).padStart(3,'0')}`,text:group.map(w=>w.text).join(' '),start:group[0].start,end:group.at(-1).end,chapter:group[0].chapter,timing:'Word-aligned boundaries; no proportional timing'});group=[];};
    for(const word of words){
      const candidate=[...group,word].map(w=>w.text).join(' ');
      if(group.length&&(candidate.length>52||word.chapter!==group[0].chapter||word.start-group.at(-1).end>0.38||word.end-group[0].start>3.8))flush();
      group.push(word);
      if(/[.!?]$/.test(word.text)&&group.length>=3)flush();
    }
    flush();
  }
  pages.forEach((p,i)=>{
    if(typeof p.text!=='string'||!p.text.trim()||!(p.start>=-0.01&&p.end>p.start&&p.end<=duration+0.01))throw new Error(`Invalid caption ${i}.`);
    if(i&&p.start<pages[i-1].end-0.025)throw new Error(`Overlapping captions ${i-1}/${i}.`);
  });
  return pages;
}

function phraseWindows(words){
  const windows=[];
  for(const word of words){
    const last=windows.at(-1);
    if(last&&word.start-last.end<0.42)last.end=Math.max(last.end,word.end);
    else windows.push({start:word.start,end:word.end});
  }
  return windows;
}

function musicDuck(t,windows){
  let gain=1;
  for(const w of windows){
    const fadeIn=0.12,fadeOut=0.52;
    if(t<w.start-fadeIn||t>w.end+fadeOut)continue;
    let amount=1;
    if(t<w.start)amount=(1-Math.cos(Math.PI*(t-w.start+fadeIn)/fadeIn))/2;
    if(t>w.end)amount=(1+Math.cos(Math.PI*(t-w.end)/fadeOut))/2;
    gain=Math.min(gain,1-amount*(1-amp(-4.5)));
  }
  return gain;
}

function softSound(kind,duration,seed,hz=196,velocity=0.7){
  const data=new Float32Array(samples(duration)),random=rng(seed);let noise=0,slow=0;
  const phase=random()*Math.PI*2;
  for(let i=0;i<data.length;i++){
    const t=i/RATE,p=t/duration;
    const white=random()*2-1;noise+=0.035*(white-noise);slow+=0.006*(white-slow);
    let v=0;
    if(kind==='felt'){
      for(let h=1;h<=6;h++){
        const inharmonic=1+0.00015*h*h;
        v+=Math.sin(2*Math.PI*hz*h*inharmonic*t+phase*(h===1?0:0.03))*Math.exp(-t*(0.68+h*0.52))/(h**2.25);
      }
      v+=noise*0.1*Math.exp(-t*55);
      v*=Math.min(1,t/0.007)*(1-p)**0.4*velocity;
    }else if(kind==='bow'){
      const vibrato=0.0025*Math.sin(2*Math.PI*(4.5+seed%7/20)*t);
      v=(Math.sin(2*Math.PI*hz*t+vibrato)+0.15*Math.sin(2*Math.PI*hz*2.002*t+phase))*Math.sin(Math.PI*p)**1.25;
      v+=noise*0.065*Math.sin(Math.PI*p)**2;
    }else if(kind==='air')v=(noise-slow)*Math.sin(Math.PI*p)**2*1.2;
    else if(kind==='wood')v=(Math.sin(2*Math.PI*83*t)+noise*1.5)*Math.exp(-t*18)*(1-p);
    else throw new Error(`Unknown organic effect ${kind}.`);
    data[i]=v*Math.min(1,t/0.004,(duration-t)/0.06);
  }
  return data;
}

function fallbackScore(duration){
  const result=new Float32Array(samples(duration)*2),random=rng(481009),cues=[];
  const chords=[[73.416,110,174.614,220],[65.406,97.999,164.814,195.998],[58.270,87.307,146.832,174.614],[55,82.406,138.592,164.814]];
  let serial=9927,at=0;
  for(let phrase=0;at<duration;phrase++){
    const length=12.2+random()*2.1,chord=chords[phrase%4];
    chord.slice(0,2).forEach((hz,n)=>add(result,softSound('bow',length+1.8,++serial,hz),Math.max(0,at-0.7),n?0.026:0.043,n?0.2:-0.1));
    const offsets=[0.5,2.15,4.35,7.1,9.7];
    offsets.forEach((offset,n)=>{const start=at+offset+(random()-0.5)*0.09,hz=chord[[2,3,1,2,0][n]],velocity=0.58+random()*0.23;
      add(result,softSound('felt',4.6,++serial,hz,velocity),start,0.08+(n===0?0.01:0),(random()-0.5)*0.35);cues.push({at:round(start),kind:'felt',frequency:hz,velocity:round(velocity)});});
    at+=length;
  }
  return{data:result,source:'New local synthesis: warm felt harmonic model and restrained bowed tones',cues};
}

function buildBed(film,timing,words){
  const size=samples(film.duration)*2,music=new Float32Array(size),sfx=new Float32Array(size),room=new Float32Array(size);
  const musicFile=resolveAsset(timing.music?.src??'SOUL-SCORE.mp3'),musicStart=timing.music?.sourceStart??0;
  let metadata;
  if(fs.existsSync(musicFile)){
    const source=decode(musicFile,2),sourceDuration=source.length/(RATE*2),offset=samples(musicStart)*2;
    if(offset<0||offset>=source.length)throw new Error('Music in-point is outside the source.');
    if(source.length-offset<size-samples(3)*2)throw new Error(`Music is too short (${sourceDuration.toFixed(3)}s source) for ${film.duration}s film. No automatic looping.`);
    music.set(source.subarray(offset,Math.min(source.length,offset+size)));
    metadata={source:relative(musicFile),sourceSha256:hash(fs.readFileSync(musicFile)),sourceDuration,sourceStart:musicStart,mode:'New generated organic instrumental, stereo preserved',looped:false,timeStretched:false};
  }else{
    if(!process.argv.includes('--synth-score'))throw new Error('SOUL-SCORE.mp3 is pending. Use --synth-score only when choosing the original local fallback.');
    const fallback=fallbackScore(film.duration);music.set(fallback.data);metadata={mode:fallback.source,cues:fallback.cues,looped:false,timeStretched:false};
  }
  const inputStats=stats(music),musicGain=Math.min(amp(-28)/Math.max(inputStats.rms,1e-9),amp(-12)/inputStats.peak);
  const windows=phraseWindows(words),transitions=[];let serial=553019;
  // Only six chapter handoffs and the final cadence carry effects; no sentence-level metronome or UI beeps.
  for(const chapter of timing.chapters.slice(1)){
    const at=Math.max(0,chapter.start-0.17);add(sfx,softSound('air',0.72,++serial),at,0.085,-0.25,0.25);
    transitions.push({at:round(at),kind:'soft air handoff',duration:0.72,chapter:chapter.id});
  }
  const brandAt=film.beats?.at(-1)?.start??Math.max(0,film.duration-4);
  add(sfx,softSound('wood',0.40,++serial),brandAt,0.055,0);
  transitions.push({at:brandAt,kind:'restrained final table/wood impact',duration:0.40});
  const random=rng(851008);let left=0,right=0;
  for(let frame=0;frame<size/2;frame++){
    const t=frame/RATE,duck=musicDuck(t,windows),fade=Math.min(1,t/1.15,(film.duration-t)/2.7);
    left+=0.006*(random()*2-1-left);right+=0.006*(random()*2-1-right);
    const opening=0.80+0.20*clamp(t/9,0,1),ending=1+0.09*clamp((t-brandAt)/3,0,1);
    let restGain=1;
    for(const rest of timing.music?.rests??[]){if(t>=rest.start&&t<rest.end)restGain=Math.min(restGain,amp(rest.reductionDb??-5));}
    for(let ch=0;ch<2;ch++){
      music[frame*2+ch]*=musicGain*duck*fade*opening*ending*restGain;
      room[frame*2+ch]=(ch?right:left)*0.011*Math.min(1,t/0.6,(film.duration-t)/1.5);
      sfx[frame*2+ch]*=Math.min(1,(film.duration-t)/0.2);
    }
  }
  return{music,sfx,room,metadata:{...metadata,levelGainDb:round(db(musicGain),3),musicDuckingDb:-4.5,lookaheadMs:120,releaseMs:520,ducking:'Forced-aligned words merged into breathing phrases; no syllable pumping',fadeInSeconds:1.15,fadeOutSeconds:2.7},windows,transitions};
}

function writePlan(report){
  const clock=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${(t%60).toFixed(3).padStart(6,'0')}`;
  const sections=['# OMERTÀ — Control Costs · Soul audio',
    'Selected direction A: warm, low storyteller. Seven connected chapter performances remain at native speed. Full source audio is preserved unless the root timing file explicitly requests source trim coordinates; internal pauses and breaths are never removed.',
    'One gentle voice-processing curve spans all chapters. The score breathes across phrases and chapter changes; it is not restarted after every sentence. No constant clicks, UI beeps or synthetic metronome are added.',
    `Status: ${report.status}. Duration: ${report.duration}s.`,
    report.master?`Master: ${report.master.integratedLufs} LUFS integrated; ${report.master.truePeakDbtp} dBTP; 48 kHz stereo PCM24.`:'Master pending complete inputs.',
    '## Chapter placement','| Chapter | Placement | Source length | Native-speed window margin |','|---|---|---|---|'];
  for(const c of report.chapters??[])sections.push(`| ${c.id} | ${clock(c.start)}–${clock(c.end)} | ${c.sourceDuration??'pending'}s | ${c.remainingWindow??'pending'}s |`);
  sections.push('## Narration','48 Hz high-pass and 14.8 kHz low-pass preserve the low storyteller timbre. A gentle 1.35:1 soft-knee compressor has 25 ms attack and 230 ms release. Normalization is global, preserving relative chapter dynamics. There is no local time stretching or pitch shifting.',
    '## Music',report.music?.mode??'New organic instrumental pending.',
    'The score enters over 1.15s and leaves over 2.7s. Broad phrase-aware attenuation reaches −4.5 dB under narration, with 120ms anticipation and 520ms recovery. Chapter breaths allow a gentle lift. No automatic music looping or time stretching occurs.',
    '## Transitions');
  for(const c of report.transitions??[])sections.push(`- ${clock(c.at)} · ${c.kind} · ${c.duration}s${c.chapter?' · '+c.chapter:''}`);
  sections.push('## Captions','Caption timing comes from forced-aligned chapter words or the root-provided absolute captions. No proportional word timing is invented. See public/art/market-v2-soul/audio/soul-captions.json and soul-word-timing.json.',
    '## Review','Level, duration and true-peak checks are automated. Complete listening review is still required for pronunciation, emotional delivery and musical balance.');
  if(report.blockingIssues.length)sections.push('## Pending',...report.blockingIssues.map(x=>'- '+x));
  fs.writeFileSync(path.join(here,'audio-plan.md'),sections.join('\n\n').replace(/\|\n\n\|/g,'|\n|')+'\n');
}

function main(){
  const args=process.argv.slice(2),timingFile=path.join(here,'chapter-timing.json'),sourceFile=path.join(here,'production-data.json');
  fs.mkdirSync(audioDir,{recursive:true});
  if(args.includes('--inspect-score')){
    const file=path.join(audioDir,'SOUL-SCORE.mp3'),score=decode(file,2);
    console.log(JSON.stringify({source:relative(file),metadata:probe(file),decodedDuration:score.length/(RATE*2),decodedChannels:2,...stats(score)},null,2));return;
  }
  if(!fs.existsSync(timingFile)){console.log('Waiting for chapter-timing.json and seven aligned native-speed chapter clips. Mixer is ready.');return;}
  const source=fs.readFileSync(sourceFile),timingBytes=fs.readFileSync(timingFile),data=JSON.parse(source),timing=JSON.parse(timingBytes),film=data.film;
  if(!(film?.duration>=120&&film.duration<=180))throw new Error('Final soul film must remain 120–180 seconds at native narration speed.');
  if(timing.chapters?.length!==7)throw new Error('Expected seven connected chapter performances.');
  const narration=prepareNarration(film,timing),report={version:1,createdAt:new Date().toISOString(),duration:film.duration,status:'analyzing',productionDataSha256:hash(source),chapterTimingSha256:hash(timingBytes),scriptSha256:hash(fs.readFileSync(fileURLToPath(import.meta.url))),voiceDirection:'User-selected audition A — warm low male storyteller',sourcePolicy:'New seven-chapter narration and new organic score. Original film and earlier source takes remain unchanged.',chapters:narration.chapters,blockingIssues:narration.issues};
  const save=()=>{fs.writeFileSync(path.join(audioDir,'audio-report.json'),JSON.stringify(report,null,2)+'\n');writePlan(report);};
  try{
    if(report.blockingIssues.length){report.status='blocked';save();console.log(JSON.stringify({status:report.status,blockingIssues:report.blockingIssues},null,2));process.exitCode=2;return;}
    const pages=makeCaptionPages(narration.words,film.captions??data.captions,film.duration);
    fs.writeFileSync(path.join(audioDir,'soul-captions.json'),JSON.stringify({timing:'Forced-aligned chapter words at native playback speed; absolute film seconds',lines:pages},null,2)+'\n');
    fs.writeFileSync(path.join(audioDir,'soul-word-timing.json'),JSON.stringify({timing:'Chapter-relative forced alignment translated to absolute film seconds',words:narration.words},null,2)+'\n');
    Object.assign(report,{captionPages:pages.length,alignedWords:narration.words.length,noChapterOverlap:true,nativePlaybackSpeed:1,
      allSourceSamplesPreserved:narration.chapters.every(chapter=>chapter.removedSampleCount===0)});
    if(args.includes('--analyze-only')){report.status='analyzed-ready';save();console.log(JSON.stringify({status:report.status,chapters:report.chapters.length,captionPages:pages.length,duration:film.duration}));return;}
    const voice=polishNarration(narration.raw),dialogue=new Float32Array(samples(film.duration)*2);add(dialogue,voice.data,0,Math.SQRT2);
    const bed=buildBed(film,timing,narration.words);Object.assign(report,{voiceProcessing:voice.report,music:bed.metadata,phraseDuckingWindows:bed.windows,transitions:bed.transitions});
    const mixed=new Float32Array(dialogue.length);report.stems={};
    for(const[name,stem]of Object.entries({dialogue,music:bed.music,sfx:bed.sfx,room:bed.room})){
      const file=path.join(audioDir,`soul-${name}.wav`);writeStem(file,stem);report.stems[name]={file:relative(file),sampleRate:RATE,channels:2,codec:'pcm_s24le',...stats(stem)};
      for(let i=0;i<mixed.length;i++)mixed[i]+=stem[i];
    }
    report.master=master(path.join(audioDir,'soul-mix.wav'),mixed,film.duration);report.status=report.master.valid?'mixed-verified':'master-out-of-spec';
    if(!report.master.valid)report.blockingIssues.push('Master is outside measured delivery targets.');
    save();console.log(JSON.stringify({status:report.status,duration:film.duration,lufs:report.master.integratedLufs,truePeak:report.master.truePeakDbtp,captionPages:pages.length,blockingIssues:report.blockingIssues},null,2));
  }catch(error){report.status='blocked';report.blockingIssues.push(error.message);save();console.error(error.message);process.exitCode=2;}
}
main();
