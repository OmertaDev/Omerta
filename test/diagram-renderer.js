import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

// Catches a production regression where the renderer's discovery filter silently drops a
// supported research-sheet family. --list exercises the real CLI without opening Chrome.
const result = spawnSync(process.execPath, ['tools/render-omr-excalidraw.mjs', '--list'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
  shell: false,
});

assert.equal(result.status, 0, result.stderr || 'diagram renderer --list should exit cleanly');
const files = result.stdout.trim().split(/\r?\n/).filter(Boolean);
assert.ok(files.includes('omr-01-severance.excalidraw'), 'the OMR research-sheet family remains discoverable');
assert.ok(files.includes('gameplay-01-choose-your-path.excalidraw'), 'the gameplay research-sheet family is discoverable');

console.log('✅ the diagram renderer discovers every supported research-sheet family');
