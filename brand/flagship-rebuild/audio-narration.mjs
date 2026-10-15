/** Local connected scratch performance; original Voice A remains reserved for final narration. */
import {chapters} from './story-source.mjs';
import {fs,path,here,root,audioDir,RATE,amp,db,clamp,round,samples,seconds,hash,relative,run,ff,probe,decode,stats,biquad,writeStem} from './audio-lib.mjs';
const voice='Microsoft David Desktop';
const normalize=s=>s.replace(/\s+/g,' ').trim();
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const spoken=s=>s.replace(/omerta\.fun/gi,'oh mare tah dot fun').replace(/OMERTÀ/g,'oh mare tah').replace(/\bOMR\b/g,'O M R').replace(/\bNPCs\b/g,'N P Cs').replace(/\bNPC\b/g,'N P C').replace(/\bRWA\b/g,'R W A').replace(/\bRPG\b/g,'R P G');
function groups(text){
  const sentences=[...new Intl.Segmenter('en-US',{granularity:'sentence'}).segment(normalize(text))].map(s=>s.segment.trim()).filter(Boolean);
  return sentences.flatMap(sentence=>{
    const parts=[];let remaining=sentence;
    while(remaining.length>102){
      const candidates=[...remaining.matchAll(/[,:;]\s+|\s+(?:and|but|with|because|while)\s+/g)].map(m=>m.index+(/^[,:;]/.test(m[0])?1:0)).filter(n=>n>=36&&n<=96);
      const split=candidates.at(-1)??remaining.lastIndexOf(' ',96);
      if(split<20)break;
      parts.push(remaining.slice(0,split).trim());remaining=remaining.slice(split).trim();
    }
    parts.push(remaining);return parts.map((text,i)=>({text,sentenceFinal:i===parts.length-1}));
  });
}
function ssml(chapter){
  const body=chapter.groups.map((group,i)=>{
    const pre=group.text==='The law was waiting.'?'<break time="1400ms"/>':'';
    const post=group.text==='Somebody talked.'?'<break time="600ms"/>':group.text==='Both players go to jail.'?'<break time="1400ms"/>':'';
    return`${pre}<mark name="${group.id}"/>${xml(spoken(group.text))} <mark name="${group.id}-end"/>${post}`;
  }).join(' ');
  return`<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><prosody rate="${chapter.rate}%">${body}</prosody></speak>`;
}
function audibleRange(data,lo,hi){
  const begin=clamp(samples(lo),0,data.length-1),end=clamp(samples(hi),begin+1,data.length);let peak=0;
  for(let i=begin;i<end;i++)peak=Math.max(peak,Math.abs(data[i]));
  const threshold=Math.max(amp(-58),peak*amp(-46));let first=begin,last=end-1;
  while(first<end&&Math.abs(data[first])<threshold)first++;
  while(last>first&&Math.abs(data[last])<threshold)last--;
  if(first>=end)throw new Error(`Empty audible marker range ${lo}..${hi}`);
  return{start:seconds(first),end:seconds(last+1)};
}
const srtTime=ms=>{const n=Math.round(ms),h=Math.floor(n/3600000),m=Math.floor(n/60000)%60,s=Math.floor(n/1000)%60;return`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(n%1000).padStart(3,'0')}`;};
function main(){
  fs.mkdirSync(path.join(audioDir,'chapters'),{recursive:true});
  const source=fs.readFileSync(path.join(here,'story-source.mjs')),duration=chapters.at(-1).end;
  if(duration!==390||chapters.length!==10)throw new Error('Expected ten chapters and390s.');
  const plan={voice,status:'LOCAL SCRATCH ONLY',chapters:chapters.map(c=>({...c,rate:93,groups:groups(c.text).map((g,i)=>({...g,id:`${c.id}-U${String(i+1).padStart(2,'0')}`})),file:path.join(audioDir,'chapters',`${c.id}.wav`),timingFile:path.join(audioDir,'chapters',`${c.id}-events.json`)}))};
  const planFile=path.join(here,'audio-narration-plan.json');
  const save=()=>{for(const c of plan.chapters)c.ssml=ssml(c);fs.writeFileSync(planFile,JSON.stringify(plan,null,2)+'\n');};
  const synth=id=>run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(here,'audio-synthesize.ps1'),'-Plan',planFile,...(id?['-Chapter',id]:[])]);
  save();synth();
  const narration=new Float32Array(samples(duration)),captions=[],timings=[],wordTimings=[],chapterReports=[];
  for(const c of plan.chapters){
    if(normalize(c.groups.map(g=>g.text).join(' '))!==normalize(c.text))throw new Error(`${c.id}: grouping changed source.`);
    const lead=c.id==='C01'?0.08:0.25,tail=c.id==='C10'?6:0.4,available=c.end-c.start-lead-tail;
    let data,events,passes=0;
    while(true){
      data=decode(c.file);events=JSON.parse(fs.readFileSync(c.timingFile,'utf8').replace(/^\uFEFF/,''));
      const lastEvent=events.filter(e=>e.kind==='bookmark').at(-1)?.ms/1000;
      if(!lastEvent||lastEvent>seconds(data.length)+0.03||seconds(data.length)-lastEvent>0.75)throw new Error(`${c.id}: SAPI event clock mismatch.`);
      if(seconds(data.length)<=available)break;
      c.rate=Math.ceil(c.rate*seconds(data.length)/available)+1;
      if(c.rate>140||passes++>5)throw new Error(`${c.id} cannot fit at a practical scratch pace.`);
      save();synth(c.id);
    }
    let placement=c.start+lead;
    // Let the opening tableau breathe, then land the CTA six seconds before the end.
    if(c.id==='C10')placement=c.end-6-seconds(data.length);
    const offset=samples(placement);narration.set(data,offset);placement=seconds(offset);
    const details=[];
    for(const [groupIndex,g] of c.groups.entries()){
      const start=events.find(e=>e.kind==='bookmark'&&e.text===g.id)?.ms/1000;
      // SAPI coalesces consecutive bookmarks, so the next start also serves as the previous end.
      const end=(events.find(e=>e.kind==='bookmark'&&e.text===`${g.id}-end`)??events.find(e=>e.kind==='bookmark'&&e.text===c.groups[groupIndex+1]?.id))?.ms/1000;
      if(!(start>=0&&end>start))throw new Error(`Missing/invalid ${g.id} marker pair.`);
      const audible=audibleRange(data,start,end),absoluteStart=placement+audible.start,absoluteEnd=placement+audible.end;
      const item={id:g.id,chapter:c.id,text:g.text,spokenText:spoken(g.text),start:round(absoluteStart),end:round(absoluteEnd),bookmarkStart:round(placement+start),bookmarkEnd:round(placement+end),sentenceFinal:g.sentenceFinal};
      timings.push(item);details.push(item);captions.push({startMs:round(absoluteStart*1000,3),endMs:round(absoluteEnd*1000,3),text:g.text,timestampMs:null,confidence:null});
    }
    for(const e of events.filter(e=>e.kind==='word'))wordTimings.push({chapter:c.id,text:e.text,startMs:round((placement+e.ms/1000)*1000,3),method:'SAPI word-start event; no word-end inference'});
    const report={id:c.id,title:c.title,start:c.start,end:c.end,placement:round(placement),source:relative(c.file),sourceSha256:hash(fs.readFileSync(c.file)),words:normalize(c.text).split(' ').length,ssmlRatePercent:c.rate,fullReadDuration:round(seconds(data.length)),tailHold:round(c.end-placement-seconds(data.length)),sourceSampleRate:Number(probe(c.file).streams[0].sample_rate),connectedChapterRead:true,utteranceCount:details.length,utterances:details};chapterReports.push(report);
    console.log(`${c.id}: ${report.words} words, connected ${report.fullReadDuration}s @ ${c.rate}%, placement ${report.placement}s, hold ${report.tailHold}s`);
  }
  if(captions.some((c,i)=>c.endMs<=c.startMs||(i&&c.startMs<captions[i-1].endMs)))throw new Error('Caption overlap or invalid range.');
  biquad(narration,58,true);biquad(narration,7600);
  const s=stats(narration),gain=Math.min(amp(-21)/s.rms,amp(-6)/s.peak),stereo=new Float32Array(narration.length*2);
  for(let i=0;i<narration.length;i++)stereo[i*2]=stereo[i*2+1]=narration[i]*gain;
  writeStem(path.join(audioDir,'rebuild-dialogue.wav'),stereo);
  fs.writeFileSync(path.join(audioDir,'captions.json'),JSON.stringify(captions,null,2)+'\n');
  fs.writeFileSync(path.join(audioDir,'captions.srt'),captions.map((c,i)=>`${i+1}\n${srtTime(c.startMs)} --> ${srtTime(c.endMs)}\n${c.text}\n`).join('\n'));
  fs.writeFileSync(path.join(audioDir,'utterance-timing.json'),JSON.stringify(timings,null,2)+'\n');
  fs.writeFileSync(path.join(audioDir,'word-start-events.json'),JSON.stringify(wordTimings,null,2)+'\n');
  const betrayal=timings.find(t=>t.text==='The law was waiting.'),talked=timings.find(t=>t.text==='Somebody talked.'),jail=timings.find(t=>t.text==='Both players go to jail.'),cta=timings.at(-1);
  const report={status:'LOCAL CONNECTED SCRATCH ONLY',createdAt:new Date().toISOString(),source:relative(path.join(here,'story-source.mjs')),sourceSha256:hash(source),duration,voice:{name:voice,provider:'Local Windows System.Speech / SAPI',finalVoice:'Selected original Voice A remains reserved for a separately authorized final performance; Voice A was not used.',connectedChapterReads:10,cloudCalls:0,paidCalls:0,localTimeStretching:false,sourceFormat:'16 kHz mono PCM16; mixed at48 kHz stereo PCM24',timing:'SAPI bookmarks and word-start events at matching16 kHz; each caption tightened to audible waveform edges inside its bookmark span.'},costs:{newSpendUsd:0,paidApiCalls:0},chapters:chapterReports,captionCount:captions.length,words:chapterReports.reduce((n,c)=>n+c.words,0),cues:{betrayalDrop:betrayal.start,betrayalSpokenEnd:talked.end,jailResultStart:jail.start,jailResultEnd:jail.end,ctaStart:cta.start,ctaEnd:cta.end},validation:{allTextPreserved:true,noCaptionOverlap:true,allChaptersFit:true,sourceUnchanged:hash(fs.readFileSync(path.join(here,'story-source.mjs')))===hash(source)},limitations:['Local David Desktop remains a synthetic scratch voice, not a final dramatic performance.','Caption starts and ends are measured within speech-engine bookmark spans; word events only give starts.','Automated waveform and timing checks do not substitute for full listening review.']};
  fs.writeFileSync(path.join(here,'audio-narration-report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,words:report.words,captions:captions.length,cues:report.cues,validation:report.validation}));
}
main();
