import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const base=path.resolve('output/flagship-trust');
http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);const file=path.resolve(base,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
 const size=fs.statSync(file).size,type={'.html':'text/html; charset=utf-8','.mp4':'video/mp4','.png':'image/png','.vtt':'text/vtt; charset=utf-8','.json':'application/json'}[path.extname(file)]||'application/octet-stream';
 const match=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);let start=0,end=size-1;
 if(match){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):end;if(start>=size||end<start){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}}
 res.writeHead(match?206:200,{'Content-Type':type,'Content-Length':end-start+1,'Accept-Ranges':'bytes','Cache-Control':'no-cache',...(match?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});
 if(req.method==='HEAD'){res.end();return;}fs.createReadStream(file,{start,end}).pipe(res);
}).listen(8773,'127.0.0.1',()=>console.log('Flagship animatic review: http://127.0.0.1:8773'));

