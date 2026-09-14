import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.');
const types = {'.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml','.html': 'text/html; charset=utf-8', '.mp4': 'video/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.vtt': 'text/vtt', '.srt': 'text/plain', '.json': 'application/json'};
http.createServer((req, res) => {
  let filename;
  try {filename = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1) || 'index.html';} catch {res.writeHead(400).end(); return;}
  const target = path.resolve(directory, filename);
  if (!target.startsWith(directory + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {res.writeHead(404).end(); return;}
  const size = fs.statSync(target).size;
  const headers = {'Content-Type': types[path.extname(target)] ?? 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache'};
  const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  const start = range ? Number(range[1]) : 0;
  const end = range && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
  if (start > end || start >= size) {res.writeHead(416, {'Content-Range': `bytes */${size}`}).end(); return;}
  if (range) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  headers['Content-Length'] = end - start + 1;
  res.writeHead(range ? 206 : 200, headers);
  if (req.method === 'HEAD') {res.end(); return;}
  fs.createReadStream(target, {start, end}).pipe(res);
}).listen(8817, '127.0.0.1', () => console.log('Campaign gallery: http://127.0.0.1:8817'));
