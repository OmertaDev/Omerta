import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=process.cwd(),out=path.join(root,'output/cinematic-r4'),bin=path.join(root,'brand/hype-flywheel-video/node_modules/@remotion/compositor-win32-x64-msvc');
const source=JSON.parse(fs.readFileSync(path.join(root,'brand/cinematic-video-system/production-data.json'),'utf8'));
const wanted=process.argv.find(s=>s.startsWith('--film='))?.split('=')[1];
const previous=path.join(out,'delivery-verification.json');const report=fs.existsSync(previous)?JSON.parse(fs.readFileSync(previous,'utf8')):{films:[]};
for(const film of source.films.filter(f=>!wanted||wanted===f.id)){
 const file=path.join(out,`Omerta-Cinematic-${film.id}-1080.mp4`);
 const probe=JSON.parse(execFileSync(path.join(bin,'ffprobe.exe'),['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8',maxBuffer:1024*1024}));
 const video=probe.streams.find(s=>s.codec_type==='video'),audio=probe.streams.find(s=>s.codec_type==='audio');
 const checks={resolution:video.width===1080&&video.height===1920,frameRate:video.avg_frame_rate==='30/1',duration:Math.abs(Number(probe.format.duration)-film.duration)<0.1,videoCodec:video.codec_name==='h264',audioCodec:audio?.codec_name==='aac',stereo:audio?.channels===2,frames:Number(video.nb_frames)===film.duration*30,captions:film.captions?.length>0&&film.captions.every(c=>c.startMs>=0&&c.endMs<=film.duration*1000&&c.startMs<c.endMs)};
 if(Object.values(checks).some(v=>!v))throw Error('Delivery failure '+film.id+': '+JSON.stringify(checks));
 execFileSync(path.join(bin,'ffmpeg.exe'),['-v','error','-threads','2','-i',file,'-c:v','rawvideo','-c:a','pcm_s16le','-f','null','-'],{encoding:'utf8',maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});
 const record={id:film.id,file:path.relative(root,file).replaceAll('\\','/'),bytes:fs.statSync(file).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),durationSeconds:Number(probe.format.duration),width:video.width,height:video.height,fps:30,frames:Number(video.nb_frames),audioSampleRate:Number(audio.sample_rate),captionPages:film.captions.length,checks,fullDecode:'passed'};
 report.films=report.films.filter(f=>f.id!==film.id);report.films.push(record);report.films.sort((a,b)=>a.id.localeCompare(b.id));
 report.verifiedAt=new Date().toISOString();report.limitations=['Visual stills reviewed; browser media loading/playback checked separately.','Audio fit and loudness measured; no claim of an independent human listening review.','Actual local preview UI plus labeled full-release editorial diagrams; production activation is not established.'];
 fs.writeFileSync(previous,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({id:film.id,checksPassed:true,fullDecode:'passed',sizeMB:(record.bytes/1e6).toFixed(1)}));
}
