import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const here='brand/market-v2-soul',assets='public/art/market-v2-soul';
const narrative=JSON.parse(fs.readFileSync(`${here}/narrative-map.json`));
const data=JSON.parse(fs.readFileSync(`${here}/production-data.json`));
const ffprobe=path.resolve('brand/hype-flywheel-video/node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe');
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const speak=t=>t.replaceAll('OMERTÀ','Oh-MAIR-tah').replaceAll('OMR','O M R').replaceAll('RWA','R W A').replaceAll('NFTs','N F Tees');
const frame=t=>Math.round(t*30)/30;
const captionPages=[];const chapters=[];let cursor=.1;
for(const ch of narrative.chapters){
 const sourceId=ch.sourceId||ch.id,src=`${assets}/audio/${sourceId}.mp3`;
 const duration=Number(execFileSync(ffprobe,['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',src],{encoding:'utf8'}));
 const alignment=JSON.parse(fs.readFileSync(`${assets}/alignment/${ch.id}-ALIGN-v2.json`));
 let charCursor=0;
 const words=alignment.words.filter(w=>norm(w.text)).map(w=>{const n=norm(w.text);const result={text:w.text,start:Number(w.start??w.start_time),end:Number(w.end??w.end_time),from:charCursor,to:charCursor+n.length};charCursor+=n.length;return result;});
 if(words.some(w=>!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.end<w.start||w.end>duration+.15))throw Error('Invalid alignment times '+ch.id);
 const expected=norm(ch.beats.map(b=>b.spoken).join(' ')),actual=words.map(w=>norm(w.text)).join('');
 if(expected!==actual)throw Error(`Alignment transcript mismatch ${ch.id}: expected ${expected.length}, actual ${actual.length}`);
 const placed=frame(cursor),chapter={id:ch.id,sourceId,src,start:placed,end:placed+duration,duration,words:words.map(({text,start,end})=>({text,start,end})),beats:[],alignmentLoss:alignment.loss};
 let offset=0;
 for(const b of ch.beats){
  const display=[];const beatFrom=offset;
  for(const text of b.text.split(/\s+/)){
   const count=norm(speak(text)).length;const relevant=words.filter(w=>w.to>offset&&w.from<offset+count);
   if(!relevant.length)throw Error('Unaligned word '+text);
   display.push({text,start:placed+relevant[0].start,end:placed+relevant.at(-1).end});offset+=count;
  }
  if(offset-beatFrom!==norm(b.spoken).length)throw Error('Spoken/display mismatch '+b.id);
  chapter.beats.push({id:b.id,narration:b.text,speechStart:display[0].start,speechEnd:display.at(-1).end});
  let page=[];
  const flush=()=>{if(!page.length)return;captionPages.push({text:page.map(w=>w.text).join(' '),startMs:Math.max(0,(page[0].start-.025)*1000),endMs:(page.at(-1).end+.085)*1000,timestampMs:null,confidence:null,beatId:b.id});page=[];};
  for(const w of display){const nextLength=page.map(x=>x.text).join(' ').length+(page.length?1:0)+w.text.length;if(page.length&&nextLength>46)flush();page.push(w);if(/[.!?;:]$/.test(w.text)&&page.map(x=>x.text).join(' ').length>=20)flush();}
  flush();
 }
 chapters.push(chapter);cursor=chapter.end+.25;
}
const duration=Math.ceil((chapters.at(-1).end+1.25)*30)/30;
if(duration>180||duration<120)throw Error('Native-paced film outside2–3minutes: '+duration);
const cues=chapters.flatMap(c=>c.beats);
for(let i=0;i<cues.length;i++){
 const cue=cues[i],beat=data.film.beats.find(b=>b.id===cue.id);if(!beat)throw Error('Missing scene '+cue.id);
 beat.start=i===0?0:frame((cues[i-1].speechEnd+cue.speechStart)/2);
 beat.end=i===cues.length-1?duration:frame((cue.speechEnd+cues[i+1].speechStart)/2);
 beat.narration=cue.narration;beat.speechStart=cue.speechStart;beat.speechEnd=cue.speechEnd;
}
for(let i=0;i<captionPages.length-1;i++)captionPages[i].endMs=Math.min(captionPages[i].endMs,captionPages[i+1].startMs);
data.film.duration=duration;data.film.beats[0].headline='Control\ncosts.';data.film.beats.at(-1).headline='Control costs.';
data.film.beats.find(b=>b.id==='M04-B32').headline='What happens\nnext?';
data.captions=captionPages;delete data.film.captions;data.captionTiming='ElevenLabs forced alignment to selected native-speed chapter audio; phrase pages derived from aligned words, with25ms lead and85ms maximum tail.';
data.revision='Soul final narrative / voice A / connected chapters';data.voiceChoice='A';
fs.writeFileSync(`${here}/production-data.json`,JSON.stringify(data,null,2)+'\n');
fs.writeFileSync(`${here}/chapter-timing.json`,JSON.stringify({version:1,voiceChoice:'A',duration,ratePolicy:'Native speed; preserve full decoded chapters and internal pauses.',chapters},null,2)+'\n');
fs.writeFileSync(`${here}/screenplay.md`,'# OMERTÀ — Control costs\n\nVoice A. Connected chapter performance; timing follows the recording. Future fully-live creative setting.\n\n'+data.film.beats.map(b=>`## ${b.start.toFixed(3)}–${b.end.toFixed(3)} · ${b.id}\n\n${b.narration}\n\nVisual: ${b.layout}, ${b.plate}; ${b.headline.replaceAll('\n',' ')}\n`).join('\n'));
console.log(JSON.stringify({duration,chapters:chapters.length,scenes:cues.length,captionPages:captionPages.length,shortestScene:Math.min(...data.film.beats.map(b=>b.end-b.start)),nativeSpeed:true}));
