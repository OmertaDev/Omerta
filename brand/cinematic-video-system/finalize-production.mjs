import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();const base=path.join(root,'public/art/cinematic-r4');
const dataPath=path.join(root,'brand/cinematic-video-system/production-data.json');
const data=JSON.parse(fs.readFileSync(dataPath,'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8'));
const selection=process.argv.find(v=>v.startsWith('--film='))?.split('=')[1];
const stamp=s=>{const ms=Math.round(s*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;};
for(const film of data.films){
 if(selection&&film.id!==selection)continue;
 const caption=JSON.parse(fs.readFileSync(path.join(base,'audio',`${film.id}-captions.json`),'utf8'));
 film.captions=caption.lines.map(c=>({text:c.text,startMs:c.start*1000,endMs:c.end*1000,timestampMs:null,confidence:null}));
 film.captionTiming=caption.timing;
 const mix=`art/cinematic-r4/audio/${film.id}-mix.wav`;if(!fs.existsSync(path.join(root,'public',mix)))throw Error('Missing verified mix '+film.id);
 manifest.audio[film.id]={src:mix};
 fs.mkdirSync(path.join(root,'output/cinematic-r4'),{recursive:true});
 fs.writeFileSync(path.join(root,'output/cinematic-r4',`${film.id}-captions.vtt`),'WEBVTT\n\n'+caption.lines.map(c=>`${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n'));
}
data.films[2].beats[9].focus={x:0.34,y:0.52,scale:1.04};
fs.writeFileSync(dataPath,JSON.stringify(data,null,2)+'\n');fs.writeFileSync(path.join(base,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({captioned:data.films.filter(f=>f.captions?.length).map(f=>f.id),audio:Object.keys(manifest.audio)}));
