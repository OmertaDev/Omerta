import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8','.csv':'text/csv; charset=utf-8'};
http.createServer((req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return}res.setHeader('Content-Type',mime[path.extname(file)]??'application/octet-stream');res.setHeader('Cache-Control','no-store');fs.createReadStream(file).pipe(res)}catch{res.writeHead(400);res.end('Bad request')}}).listen(8814,'127.0.0.1',()=>console.log('Campaign preview: http://127.0.0.1:8814'));
