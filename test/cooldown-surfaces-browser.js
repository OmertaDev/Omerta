import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The browser contract stays deliberately source-level here: the normal client suite parses the
// production script, while this focused check pins the absolute-deadline behavior that prevents a
// repaint from resetting a stale duration.
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
assert.match(html, /streetActionReadyAt = Date\.now\(\) \+ Math\.max\(0, Number\(me\?\.streetActionSeconds\) \|\| 0\) \* 1000/);
assert.match(html, /streetActionLeft = \(\) => Math\.max\(0, Math\.ceil\(\(streetActionReadyAt - Date\.now\(\)\) \/ 1000\)\)/);
assert.doesNotMatch(html, /streetActionLeft = \(\).*streetActionSeconds.*Date\.now/s,
  'repaints read an observed absolute deadline instead of rebuilding it from a stale duration');
console.log('Browser cooldown deadline contract passed.');
