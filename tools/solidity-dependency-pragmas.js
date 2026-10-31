// Reviewed compiler migration overlay. Preserve every byte except exact Solidity version pins.
// Run after fetching the pinned dependencies; verification admits the exact overlay and Git CRLF conversion.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../omerta-contracts/', import.meta.url));
const FROM = '0.8.26', TO = '0.8.38';
const pin = /^([\t ]*pragma[\t ]+solidity[\t ]+)0\.8\.26([\t ]*;)/gm;
const migrate = bytes => Buffer.from(bytes.toString('utf8').replace(pin, (_match, prefix, suffix) => prefix + TO + suffix));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (root, target) => target === root || target.startsWith(root + path.sep);
const args = process.argv.slice(2);
if (args[0] === '--verify-repository') {
  if (args.length !== 2) throw Error('Expected one pinned dependency repository');
  const repository = fs.realpathSync(path.resolve(ROOT, args[1]));
  if (!inside(fs.realpathSync(path.join(ROOT, 'lib')), repository)) throw Error('Dependency outside lib');
  const gitRoot = execFileSync('git', ['-C', repository, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', windowsHide: true }).trim();
  if (fs.realpathSync(gitRoot) !== repository) throw Error('Pinned dependency Git repository unavailable; parent workspace is not dependency provenance');
  const changed = execFileSync('git', ['-C', repository, 'diff', '--name-only', 'HEAD', '--'], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/).filter(Boolean);
  for (const file of changed) {
    const target = path.resolve(repository, file);
    if (!file.endsWith('.sol') || !inside(repository, target) || !fs.statSync(target).isFile()) throw Error(`Unexpected dependency modification: ${file}`);
    const original = execFileSync('git', ['-C', repository, 'show', `HEAD:${file}`], { windowsHide: true });
    const normalizedOriginal = Buffer.from(original.toString('utf8').replace(/\r\n/g, '\n'));
    const normalizedCurrent = Buffer.from(fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n'));
    if (!migrate(normalizedOriginal).equals(normalizedCurrent)) throw Error(`Dependency differs beyond reviewed compiler pragma: ${file}`);
  }
  console.log(`Verified ${changed.length} exact compiler pragma overlays in ${args[1]}`);
} else {
  if (args.some(arg => !['--project', '--check'].includes(arg))) throw Error('Only --project and --check are accepted');
  const roots = args.includes('--project') ? ['src', 'test', 'script', 'lib'] : ['lib'];
  const changes = [];
  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (['.git', 'node_modules', 'out', 'cache'].includes(entry.name)) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && file.endsWith('.sol')) {
        const before = fs.readFileSync(file), after = migrate(before);
        if (before.equals(after)) continue;
        changes.push({ file: path.relative(ROOT, file).replaceAll('\\', '/'), beforeSha256: sha(before), afterSha256: sha(after) });
        if (!args.includes('--check')) {
          const temporary = `${file}.compiler-${process.pid}.tmp`;
          fs.writeFileSync(temporary, after);
          if (!fs.readFileSync(file).equals(before)) throw Error(`Concurrent source edit: ${file}`);
          fs.renameSync(temporary, file);
        }
      }
    }
  }
  for (const directory of roots) walk(path.join(ROOT, directory));
  console.log(JSON.stringify({ from: FROM, to: TO, mode: args.includes('--check') ? 'check' : 'apply', changes }, null, 2));
  if (args.includes('--check') && changes.length) process.exitCode = 1;
}
