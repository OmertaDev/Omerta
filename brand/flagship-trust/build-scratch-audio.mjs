/** Zero-cost Windows SAPI scratch. Not the final Voice A performance. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chapters} from './story-source.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const audioDir=path.join(root,'public/art/flagship-trust/audio');
const binDir=path.join(root,'brand/hype-flywheel-video/node_modules/@remotion/compositor-win32-x64-msvc');
const ffmpeg=path.join(binDir,'ffmpeg.exe'),ffprobe=path.join(binDir,'ffprobe.exe');
const RATE=48000,TARGET_LUFS=-14,TARGET_TP=-1.8;
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
    valid: Math.abs(actual-duration)<0.5/RATE && Number(stream.sample_rate)===RATE && stream.channels===2 && Number(final.input_tp)<=-1 && Math.abs(Number(final.input_i)-TARGET_LUFS)<=0.7,
    preNormalization: measured, secondPass, finalMeasurement: final};
}

function groups(text){
  const sentences=[...new Intl.Segmenter('en-US',{granularity:'sentence'}).segment(text)].map(s=>s.segment.trim()).filter(Boolean);
  return sentences.flatMap(sentence=>{
    const parts=[];let remaining=sentence;
    while(remaining.length>112){
      const candidates=[...remaining.matchAll(/[,:;]\s+|\s+(?:and|but|with|rather|because|while)\s+/g)]
        .map(m=>m.index+(/^[,:;]/.test(m[0])?1:0)).filter(n=>n>=42&&n<=100);
      let split=candidates.at(-1)??remaining.lastIndexOf(' ',100);
      if(split<20)split=remaining.indexOf(' ',100);
      if(split<0)break;
      parts.push(remaining.slice(0,split).trim());remaining=remaining.slice(split).trim();
    }
    parts.push(remaining);
    return parts.map((text,index)=>({text,sentenceFinal:index===parts.length-1}));
  });
}

function spoken(text){
  return text.replace(/omerta\.fun/gi,'oh mare tah dot fun').replace(/OMERTÀ/g,'oh mare tah')
    .replace(/\bOMR\b/g,'O M R').replace(/\bNPCs\b/g,'N P Cs').replace(/\bNPC\b/g,'N P C')
    .replace(/\bRWA\b/g,'R W A').replace(/\bRPG\b/g,'R P G');
}

function trimSilence(data){
  const s=stats(data),threshold=Math.max(amp(-60),s.peak*amp(-48));
  let first=0,last=data.length-1;
  while(first<data.length&&Math.abs(data[first])<threshold)first++;
  while(last>=first&&Math.abs(data[last])<threshold)last--;
  if(first>=last)throw new Error('Empty synthesized utterance.');
  const begin=Math.max(0,first-samples(0.06)),end=Math.min(data.length,last+1+samples(0.06));
  return{data:data.slice(begin,end),first,last,begin,end,thresholdDbfs:round(db(threshold),2)};
}

function srtTime(ms){
  const n=Math.max(0,Math.round(ms)),hours=Math.floor(n/3600000),minutes=Math.floor(n/60000)%60,seconds=Math.floor(n/1000)%60;
  return`${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')},${String(n%1000).padStart(3,'0')}`;
}

function wrap(text){
  if(text.length<58)return text;
  const words=text.split(/\s+/);let best=1,difference=Infinity;
  for(let i=1;i<words.length;i++){
    const d=Math.abs(words.slice(0,i).join(' ').length-words.slice(i).join(' ').length);
    if(d<difference){difference=d;best=i;}
  }
  return words.slice(0,best).join(' ')+'\n'+words.slice(best).join(' ');
}

function main(){
  fs.mkdirSync(audioDir,{recursive:true});fs.mkdirSync(path.join(audioDir,'utterances'),{recursive:true});
  const story=fs.readFileSync(path.join(here,'story-source.mjs'));
  const duration=chapters.at(-1).end;
  if(duration!==390||chapters.length!==10)throw new Error('Expected ten source chapters spanning390s.');
  const utterances=chapters.flatMap(chapter=>groups(chapter.text).map((group,index)=>{
    const id=`${chapter.id}-U${String(index+1).padStart(2,'0')}`;
    return{id,chapter:chapter.id,...group,spokenText:spoken(group.text),rate:-2,file:path.join(audioDir,'utterances',`${id}.wav`)};
  }));
  // Verify grouping changes neither the story words nor their order.
  for(const chapter of chapters){
    const joined=utterances.filter(u=>u.chapter===chapter.id).map(u=>u.text).join(' ').replace(/\s+/g,' ');
    if(joined!==chapter.text.trim().replace(/\s+/g,' '))throw new Error(`Grouping changed ${chapter.id}.`);
  }
  const planFile=path.join(here,'scratch-audio-plan.json'),plan={status:'SCRATCH / ANIMATIC ONLY',voice:'Microsoft David Desktop',finalVoice:'Selected Voice A remains reserved for paid final narration',utterances};
  const savePlan=()=>fs.writeFileSync(planFile,JSON.stringify(plan,null,2)+'\n');savePlan();
  run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(here,'synthesize-scratch.ps1'),'-Plan',planFile]);
  const dialogue=new Float32Array(samples(duration)),captions=[],chapterReports=[];
  for(const chapter of chapters){
    const rows=utterances.filter(u=>u.chapter===chapter.id),lead=chapter.id==='C01'?0.05:0.12,minimumTail=chapter.id==='C10'?1.8:0.35;
    let analyzed,rate=-2,tries=0;
    const minimumGaps=rows.slice(0,-1).map(row=>row.sentenceFinal?0.19:0.08);
    const available=chapter.end-chapter.start-lead-minimumTail;
    while(true){
      analyzed=rows.map(row=>{const raw=decode(row.file);return{row,raw,...trimSilence(raw)};});
      const required=analyzed.reduce((n,u)=>n+seconds(u.data.length),0)+minimumGaps.reduce((a,b)=>a+b,0);
      if(required<=available)break;
      if(rate>=1)throw new Error(`${chapter.id} cannot fit comfortably; requires ${required.toFixed(2)}s but has ${available.toFixed(2)}s.`);
      rate++;tries++;rows.forEach(row=>{row.rate=rate;});savePlan();
      run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(here,'synthesize-scratch.ps1'),'-Plan',planFile,'-Chapter',chapter.id]);
    }
    const speechSeconds=analyzed.reduce((n,u)=>n+seconds(u.data.length),0),gaps=[...minimumGaps];
    let extra=available-speechSeconds-gaps.reduce((a,b)=>a+b,0);
    // Redistribute spare time into modest sentence pauses, then leave the last image room to land.
    for(let pass=0;pass<2&&extra>0.001;pass++){
      const candidates=gaps.map((gap,index)=>({index,capacity:(rows[index].sentenceFinal?0.70:0.30)-gap})).filter(x=>x.capacity>0.001);
      const capacity=candidates.reduce((n,c)=>n+c.capacity,0),fraction=Math.min(1,extra/Math.max(capacity,0.001));
      for(const c of candidates){const amount=c.capacity*fraction;gaps[c.index]+=amount;extra-=amount;}
    }
    let position=chapter.start+lead;
    const details=[];
    for(const [index,u]of analyzed.entries()){
      const at=samples(position);dialogue.set(u.data,at);
      const actualStart=seconds(at)+seconds(u.first-u.begin),actualEnd=seconds(at)+seconds(u.last+1-u.begin);
      captions.push({startMs:round(actualStart*1000,3),endMs:round(actualEnd*1000,3),text:u.row.text,timestampMs:null,confidence:null});
      details.push({id:u.row.id,text:u.row.text,spokenText:u.row.spokenText,source:relative(u.row.file),sourceSha256:hash(fs.readFileSync(u.row.file)),sapiRate:rate,sourceDuration:seconds(u.raw.length),retainedDuration:seconds(u.data.length),leadingSilenceRemoved:seconds(u.begin),trailingSilenceRemoved:seconds(u.raw.length-u.end),edgeGuardSeconds:0.06,position:seconds(at),audibleStart:actualStart,audibleEnd:actualEnd,gapAfter:index<gaps.length?round(gaps[index]):null});
      position=seconds(at)+seconds(u.data.length)+(gaps[index]??0);
    }
    const words=chapter.text.trim().split(/\s+/).length,spokenWords=rows.map(r=>r.spokenText).join(' ').split(/\s+/).length;
    chapterReports.push({id:chapter.id,title:chapter.title,start:chapter.start,end:chapter.end,words,spokenWords,sapiRate:rate,localGenerationPasses:tries+1,speechSeconds:round(speechSeconds),chapterWordsPerMinute:round(words/(chapter.end-chapter.start)*60,2),phrasingWordsPerMinute:round(spokenWords/(position-chapter.start-lead)*60,2),endHoldSeconds:round(chapter.end-position),utterances:details});
    console.log(`${chapter.id}: ${words}words / ${rows.length}groups; David rate${rate}; ${speechSeconds.toFixed(2)}s speech buffers; ${(chapter.end-position).toFixed(2)}s final hold.`);
  }
  if(captions.some((caption,index)=>caption.endMs<=caption.startMs||(index>0&&caption.startMs<captions[index-1].endMs)))throw new Error('Caption overlap or invalid range.');
  const report={status:'SCRATCH / ANIMATIC ONLY',finalVoice:'User-selected original paid Voice A is preserved as the final performance choice; not used here.',createdAt:new Date().toISOString(),source:'brand/flagship-trust/story-source.mjs',sourceSha256:hash(story),duration,voice:{provider:'Local Windows System.Speech / SAPI',name:'Microsoft David Desktop',paidCalls:0,cloudCalls:0,localTempoProcessing:0,ratePolicy:'SAPI rate−2 initially; individual chapters regenerated at rate−1 or0 only when complete speech and minimum pauses did not fit.'},costs:{currency:'USD',newGenerationSpend:0,paidApiCalls:0,newAssetPurchases:0},music:{included:false,reason:'The available three-minute score is not an appropriate complete390-second dramatic arc; omitted to keep scratch timing review clear.'},captions:{method:'Separate synthesized sentence/clause WAVs; audible edges measured at a conservative amplitude threshold with60ms retained guards. No word-level forced alignment.',count:captions.length,allStoryTextPreserved:true,noOverlap:true},chapters:chapterReports,limitations:['Offline David Desktop is a clearly labeled timing placeholder, not the selected Voice A and not a final performance.','Sentence/clause synthesis has less connected phrasing and emotional variation than a full human or final Voice A read.','The pronunciation aliases for OMERTÀ, OMR, RWA, NPC and RPG are practical scratch approximations; final pronunciation needs listening review.','Caption timing is accurate to measured small utterances, not individual spoken words.','No music or environmental sound is included in this scratch pass.','Automated timing, waveform and loudness checks do not replace listening review.']};
  fs.writeFileSync(path.join(audioDir,'captions.json'),JSON.stringify(captions,null,2)+'\n');
  fs.writeFileSync(path.join(audioDir,'captions.srt'),captions.map((caption,index)=>`${index+1}\n${srtTime(caption.startMs)} --> ${srtTime(caption.endMs)}\n${wrap(caption.text)}\n`).join('\n'));
  // One gentle global filter/gain; no word cutting or audio time compression.
  biquad(dialogue,55,true);biquad(dialogue,13500);
  const s=stats(dialogue),gain=Math.min(amp(-20)/s.rms,amp(-3)/s.peak),stereo=new Float32Array(dialogue.length*2);
  for(let i=0;i<dialogue.length;i++){stereo[i*2]=dialogue[i]*gain;stereo[i*2+1]=dialogue[i]*gain;}
  report.master=master(path.join(audioDir,'animatic-mix.wav'),stereo,duration);
  report.validation={allChaptersInsideAssignedWindows:chapterReports.every(c=>c.endHoldSeconds>=0),allUtterancesRetained:true,noCaptionOverlap:true,captionCount:captions.length,finalMasterValid:report.master.valid,storySourceUnchanged:hash(fs.readFileSync(path.join(here,'story-source.mjs')))===hash(story)};
  fs.writeFileSync(path.join(here,'scratch-audio-report.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(audioDir,'SCRATCH-ONLY.txt'),'ANIMATIC SCRATCH ONLY\nLocal Microsoft David Desktop narration. New spend: $0.\nThis is not Voice A or a publication-ready performance.\nSee brand/flagship-trust/scratch-audio-report.json.\n');
  console.log(JSON.stringify({status:report.master.valid?'scratch-audio-complete':'out-of-spec',duration,lufs:report.master.integratedLufs,truePeak:report.master.truePeakDbtp,captionCount:captions.length,costUsd:0,sourceUnchanged:report.validation.storySourceUnchanged}));
  if(!report.master.valid||!report.validation.storySourceUnchanged)process.exitCode=2;
}
main();
