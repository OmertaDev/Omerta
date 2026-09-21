import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const index = JSON.parse(fs.readFileSync(path.join(root, 'RC1-EVIDENCE-INDEX.json'), 'utf8'));
const failures = [];
let bytes = 0;
for (const entry of index.files) {
  const file = path.resolve(root, entry.path);
  const relative = path.relative(root, file);
  if (path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`)) {
    failures.push({ path: entry.path, error: 'outside evidence package' });
    continue;
  }
  try {
    const data = fs.readFileSync(file);
    const actual = crypto.createHash('sha256').update(data).digest('hex');
    if (data.length !== entry.bytes || actual !== entry.sha256)
      failures.push({ path: entry.path, error: 'byte count or SHA256 mismatch' });
    bytes += data.length;
  } catch (error) {
    failures.push({ path: entry.path, error: error.code || 'read failed' });
  }
}
console.log(JSON.stringify({ candidate: index.candidate, files: index.files.length, bytes,
  status: failures.length ? 'FAIL' : 'PASS', failures }, null, 2));
if (failures.length) process.exitCode = 1;
