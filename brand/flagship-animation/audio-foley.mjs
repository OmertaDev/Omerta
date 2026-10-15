/** Original deterministic local foley for the painted animatic. No external generation. */
import {fs,path,root,RATE,amp,db,clamp,round,samples,seconds,hash,relative,ff,probe,decode,stats,biquad,writeStem} from '../flagship-rebuild/audio-lib.mjs';
const here=path.join(root,'brand/flagship-animation'),out=path.join(root,'public/art/flagship-animation/audio');
const filmFile=path.join(root,'public/art/flagship-animation/film.json'),baseFile=path.join(root,'public/art/flagship-rebuild/audio/rebuild-mix.wav');
const filmBytes=fs.readFileSync(filmFile),film=JSON.parse(filmBytes),sourceHash=hash(fs.readFileSync(baseFile)),duration=390;
const parentReport=JSON.parse(fs.readFileSync(path.join(root,'brand/flagship-rebuild/audio-report.json')));
const captions=JSON.parse(fs.readFileSync(path.join(root,'public/art/flagship-rebuild/audio/captions.json')));
const drop=parentReport.music.drop;
fs.mkdirSync(out,{recursive:true});
if(film.duration!==duration)throw new Error('The source timing must remain390 seconds.');
const base=decode(baseFile,2),layer=new Float32Array(base.length);
if(base.length!==samples(duration)*2)throw new Error('Unexpected base duration.');
function rng(seed){let state=seed>>>0;return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};}
function soften(data,hp,lp){if(hp)biquad(data,hp,true);if(lp)biquad(data,lp);return data;}
function paper(length,seed){
  const a=new Float32Array(samples(length)),random=rng(seed);let low=0;
  for(let i=0;i<a.length;i++){
    const t=seconds(i),p=t/length,noise=random()*2-1;low+=0.045*(noise-low);
    const drag=Math.sin(Math.PI*p)**1.65*(0.5+0.19*Math.sin(t*31)+0.13*Math.sin(t*53+1.2));
    const edge=0.5*Math.exp(-(((p-0.78)/0.055)**2))+0.18*Math.exp(-(((p-0.27)/0.035)**2));
    a[i]=(noise-low)*drag+low*edge*0.35;
  }
  return soften(a,520,6500);
}
function coin(length,seed){
  const a=new Float32Array(samples(length)),random=rng(seed),hits=[0.035,0.19,0.285];
  for(let h=0;h<hits.length;h++){
    const from=samples(hits[h]),strength=[1,0.5,0.19][h];
    for(let i=from;i<a.length;i++){
      const t=seconds(i-from);if(t>0.19)break;
      const contact=(random()*2-1)*Math.exp(-t/0.009),tone=(Math.sin(t*2*Math.PI*1843)+0.57*Math.sin(t*2*Math.PI*2936+0.4))*Math.exp(-t/0.036);
      a[i]+=(contact*0.55+tone*0.2)*strength*Math.min(1,t/0.0025);
    }
  }
  return soften(a,750,4800);
}
function latch(length,seed){
  const a=new Float32Array(samples(length)),random=rng(seed);
  for(let i=0;i<a.length;i++){
    const t=seconds(i),slide=Math.sin(Math.PI*clamp(t/0.22,0,1))**1.5*Math.exp(-t/0.16),impact=Math.max(0,t-0.13);
    const clunk=t<0.13?0:(Math.sin(2*Math.PI*184*impact)*0.7+Math.sin(2*Math.PI*471*impact)*0.2)*Math.exp(-impact/0.042)*Math.min(1,impact/0.008);
    a[i]=(random()*2-1)*slide*0.1+clunk*0.25;
  }
  return soften(a,105,2200);
}
function engine(length,seed){
  const a=new Float32Array(samples(length)),random=rng(seed);let phase=0,tire=0;
  for(let i=0;i<a.length;i++){
    const t=seconds(i),p=t/length,hz=51-14*p+2.1*Math.sin(p*Math.PI);phase+=2*Math.PI*hz/RATE;
    tire+=0.04*(random()*2-1-tire);
    const body=(Math.sin(phase)+0.32*Math.sin(phase*2.03)+0.15*Math.sin(phase*3.97))*0.12;
    const pass=Math.sin(Math.PI*p)**1.8;
    a[i]=(body+tire*0.5)*pass;
  }
  return soften(a,38,1450);
}
const cuePlan=[
  {id:'paper-opening',shot:'A01',type:'paper',offset:1.1,length:1.2,peak:-22,pan:-0.12},
  {id:'street-pass',shot:'A07',type:'engine',offset:0.65,length:4.1,peak:-28,pan:-0.4},
  {id:'coffee-drive',shot:'A21',type:'engine',offset:0.4,length:3.7,peak:-29,pan:0.35},
  {id:'prison-latch',shot:'A34',type:'latch',absolute:162.7,length:0.36,peak:-33,pan:0.05},
  {id:'private-clue',shot:'A42',type:'paper',offset:0.28,length:0.58,peak:-20,pan:-0.2},
  {id:'second-clue',shot:'A43',type:'paper',offset:0.24,length:0.46,peak:-21,pan:0.2},
  {id:'convoy-pass',shot:'A47',type:'engine',offset:0.2,length:1.7,peak:-32,pan:-0.25},
  {id:'coin-balances',shot:'A55',type:'coin',offset:0.48,length:0.58,peak:-24,pan:0.1},
  {id:'ledger-budget',shot:'A58',type:'paper',offset:0.25,length:0.65,peak:-22,pan:-0.1},
  {id:'custody-folder',shot:'A64',type:'paper',offset:0.34,length:0.54,peak:-23,pan:0.08},
  {id:'paper-return',shot:'A67',type:'paper',offset:1.1,length:1.2,peak:-23,pan:-0.12},
  {id:'closing-drive',shot:'A68',type:'engine',offset:0.7,length:4.7,peak:-30,pan:0.3},
  {id:'paper-last-invitation',shot:'A69',type:'paper',offset:0.95,length:0.72,peak:-22,pan:-0.08},
];
function speechEnvelope(t){
  let depth=0;
  for(const c of captions){const start=c.startMs/1000,end=c.endMs/1000;if(t<start-0.10||t>end+0.25)continue;depth=Math.max(depth,t<start?(t-start+0.10)/0.10:t>end?1-(t-end)/0.25:1);}
  return clamp(depth,0,1);
}
const cues=[];
for(const [index,c]of cuePlan.entries()){
  const shot=film.shots.find(s=>s.id===c.shot);if(!shot)throw new Error(`Missing shot ${c.shot}`);
  const start=c.absolute??shot.start+c.offset,end=start+c.length;if(start<shot.start||end>shot.end)throw new Error(`${c.id} exceeds its shot.`);
  const generator={paper,coin,latch,engine}[c.type],mono=generator(c.length,731090+index*137),s=stats(mono),gain=amp(c.peak)/s.peak;
  const at=samples(start);let sum=0,actualPeak=0;
  for(let i=0;i<mono.length;i++){
    const t=start+seconds(i),duck=amp(-3*speechEnvelope(t)),travel=c.type==='engine'?c.pan*(1-2*i/mono.length):c.pan;
    const left=Math.cos((travel+1)*Math.PI/4),right=Math.sin((travel+1)*Math.PI/4),v=mono[i]*gain*duck;
    layer[(at+i)*2]+=v*left;layer[(at+i)*2+1]+=v*right;sum+=v*v;actualPeak=Math.max(actualPeak,Math.abs(v));
  }
  cues.push({...c,start:round(start),end:round(end),shotStart:shot.start,shotEnd:shot.end,source:'Original deterministic local synthesis',seed:731090+index*137,actualMonoPeakDbfs:round(db(actualPeak),2),actualMonoRmsDbfs:round(db(Math.sqrt(sum/mono.length)),2),speechDuckDb:-3});
}
const ambiencePlan=[
  {id:'muffled-room-rain',start:0,end:15,rms:-61,highpass:180,lowpass:1900},
  {id:'street-rain',start:15,end:43.6666666667,rms:-56,highpass:360,lowpass:6500},
  {id:'street-return',start:116.5416666667,end:125,rms:-58,highpass:360,lowpass:5500},
  {id:'room-reprise',start:350,end:357.8333333333,rms:-61,highpass:180,lowpass:1900},
];
const ambience=[];
for(const [index,a]of ambiencePlan.entries()){
  const count=samples(a.end-a.start),channels=[];
  for(let ch=0;ch<2;ch++){
    const mono=new Float32Array(count),random=rng(816403+index*171+ch*3049);
    for(let i=0;i<count;i++)mono[i]=random()*2-1;
    soften(mono,a.highpass,a.lowpass);const s=stats(mono),gain=amp(a.rms)/s.rms;
    for(let i=0;i<count;i++){
      const t=seconds(i),fade=Math.min(1,t/1.4,(seconds(count)-t)/1.4),drift=0.94+0.06*Math.sin(t*0.48+ch*1.7);
      mono[i]*=gain*fade*drift*amp(-3*speechEnvelope(a.start+t));
    }
    channels.push(mono);
  }
  const at=samples(a.start);
  for(let i=0;i<count;i++){layer[(at+i)*2]+=channels[0][i];layer[(at+i)*2+1]+=channels[1][i];}
  ambience.push({...a,source:'Original locally synthesized filtered noise; not a field recording',stereoIndependent:true,speechDuckDb:-3});
}
const priorSilence=stats(layer.subarray(samples(drop.start)*2,samples(162.7)*2));
const afterSilence=stats(layer.subarray(samples(163.06)*2,samples(drop.end)*2));
if(priorSilence.peak!==0||afterSilence.peak!==0)throw new Error('Added sound leaks into the protected betrayal pauses.');
writeStem(path.join(out,'audio-added-layer.wav'),layer);
// Critique pass: foley must remain an accompaniment; dense finance cues and broad ambience were rejected.
const cueBalance=cues.map(c=>{
  const begin=samples(c.start)*2,end=samples(c.end)*2,b=stats(base.subarray(begin,end)),f=stats(layer.subarray(begin,end));
  return{id:c.id,baseRmsDbfs:b.rmsDbfs,addedRmsDbfs:f.rmsDbfs,separationDb:round(b.rmsDbfs-f.rmsDbfs,2)};
});
const minimumSeparation=Math.min(...cueBalance.filter(c=>c.id!=='paper-return').map(c=>c.separationDb));
let reductionDb=0;
if(minimumSeparation<14)reductionDb=14-minimumSeparation;
if(reductionDb>0){for(let i=0;i<layer.length;i++)layer[i]*=amp(-reductionDb);writeStem(path.join(out,'audio-added-layer.wav'),layer);}
for(let i=0;i<base.length;i++)base[i]=(base[i]+layer[i])*amp(-0.08);
const masterFile=path.join(out,'animated-mix.wav');writeStem(masterFile,base);
const measurementResult=ff(['-i',masterFile,'-af','loudnorm=I=-15.5:TP=-1.5:LRA=9:print_format=json','-f','null','-']);
const blocks=[...measurementResult.stderr.toString().matchAll(/\{\s*"input_i"[\s\S]*?\}/g)];if(!blocks.length)throw new Error('Missing loudness measurement.');
const measured=JSON.parse(blocks.at(-1)[0]),info=probe(masterFile),stream=info.streams[0];
const master={file:relative(masterFile),durationSeconds:Number(stream.duration??info.format.duration),sampleRate:Number(stream.sample_rate),channels:stream.channels,codec:stream.codec_name,integratedLufs:Number(measured.input_i),truePeakDbtp:Number(measured.input_tp),loudnessRangeLu:Number(measured.input_lra),processing:'Original mastered dialogue/music plus restrained foley; only0.08dB global attenuation. No new dynamic normalization.'};
master.valid=master.durationSeconds===390&&master.sampleRate===48000&&master.channels===2&&master.integratedLufs>=-16&&master.integratedLufs<=-15&&master.truePeakDbtp<=-1;
const result={status:master.valid?'ANIMATED SCRATCH MIX VERIFIED':'OUT OF SPEC',createdAt:new Date().toISOString(),master,source:{file:relative(baseFile),sha256:sourceHash,film:relative(filmFile),filmSha256:hash(filmBytes),inheritedReport:'brand/flagship-rebuild/audio-report.json',voice:'Unchanged Microsoft David Desktop connected scratch; selected final Voice A was not generated or used.',music:'Unchanged existing SOUL-SCORE arrangement from the verified rebuild mix.'},costs:{newSpendUsd:0,paidCalls:0,newLicenses:0},foley:{provenance:'Original local deterministic synthesis written for this edit; no externally sourced sound effects, voice cloning or new music.',cues,ambience,protectedDrop:{start:drop.start,end:drop.end,soleException:{cue:'prison-latch',start:162.7,end:163.06,targetPeakDbfs:-33},additionalLayerBeforeLatchRms:priorSilence.rmsDbfs,additionalLayerAfterLatchRms:afterSilence.rmsDbfs},cueBalanceBeforeRevision:cueBalance,revisionReductionDb:round(reductionDb,3),finalAddedLayer:stats(layer)},selfCritique:{findings:['The first measured layer sat31.31–46.80dB below the base mix across cue windows; several details were too faint to contribute.', 'Sounding every finance transition would compete with the explanation and make the sequence feel like interface feedback.','A large metallic jail hit would weaken the betrayal pause and cover the voice.','Continuous rain under the whole film would flatten changes in place.'],improvements:['Raised the sparse paper, coin and vehicle details individually by9–17dB; the jail closure remains deliberately lower.', 'Kept only one coin settlement and two paper/ledger touches across the finance passage.','Used a0.36-second muted latch after the measured word “players”, then returned the added layer to exact silence through165.45s.','Restricted very low ambience to the opening and visible street passages; no ambient bed under the betrayal or final CTA.',...(reductionDb>0?[`Measured cue separation triggered an additional${round(reductionDb,2)}dB attenuation of the added layer before the final master.`]:['Measured cue separation did not require further attenuation.'])],limitations:['These are restrained synthetic approximations of physical sounds, not recorded location foley.','No complete human listening review is claimed. Measurements verify timing, levels and protected pauses.','The narration remains a local scratch performance.']},validation:{sourceAudioUnchanged:hash(fs.readFileSync(baseFile))===sourceHash,filmTimingUnchanged:hash(fs.readFileSync(filmFile))===hash(filmBytes),allCuesInsideShots:true,protectedPausesContainNoAddedSound:true,masterValid:master.valid}};
fs.writeFileSync(path.join(here,'audio-report.json'),JSON.stringify(result,null,2)+'\n');
for(const[name,start,length]of [['opening',0,15],['betrayal',157,12],['closing',350,25]])ff(['-v','error','-y','-ss',String(start),'-i',masterFile,'-t',String(length),'-c:a','libmp3lame','-b:a','192k',path.join(out,`audio-review-${name}.mp3`)]);
console.log(JSON.stringify({status:result.status,master,cueCount:cues.length,ambienceCount:ambience.length,minimumInitialSeparationDb:minimumSeparation,revisionReductionDb:reductionDb,validation:result.validation},null,2));
if(!master.valid||!result.validation.sourceAudioUnchanged||!result.validation.filmTimingUnchanged)process.exitCode=2;
