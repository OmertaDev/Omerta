// Execute the actual renderer body; this controlled projection is not gameplay evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const start = html.indexOf('  function paintWorld() {'), end = html.indexOf('    const contextual =', start);
assert(start > 0 && end > start);
const renderer = html.slice(html.indexOf('    const name =', start), end);
const context = { board: null, moves: [], worldBusy: false, worldRetry: null,
  esc: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;') };
const render = vm.runInNewContext(`(() => { ${renderer}; return commandCard; })()`, context);
const base = { label: 'Open archive', availability: 'LOCKED', blockers: [], costs: [], committedResources: [], risk: [] };
const known = { kind: 'known', description: 'Current Family leadership is required.' };
const hidden = { kind: 'undiscovered', description: 'PRIVATE REQUIREMENT CANARY' };
const cases = [
  { name: 'known-only', blockers: [known], shown: [known.description], absent: ['No further details', 'remaining requirements'] },
  { name: 'mixed-known-hidden', blockers: [known, hidden], shown: [known.description, 'remaining requirements'], absent: [hidden.description] },
  { name: 'hidden-only', blockers: [hidden], shown: ['No further details are known'], absent: [hidden.description] },
  { name: 'untyped-fails-closed', blockers: ['UNTYPED CANARY', { description: 'UNCLASSIFIED CANARY' }], shown: ['No further details are known'], absent: ['UNTYPED CANARY', 'UNCLASSIFIED CANARY'] },
  { name: 'empty-stays-generic', blockers: [], shown: ['No further details are known'], absent: [known.description] },
];
for (const entry of cases) {
  const rendered = render({ ...base, blockers: entry.blockers });
  for (const text of entry.shown) assert(rendered.includes(text), `${entry.name}: missing authorized detail`);
  for (const text of entry.absent) assert(!rendered.includes(text), `${entry.name}: unexpected detail`);
  assert.match(rendered, /<button[^>]* disabled>/, 'Copy must not make a locked command executable');
}
assert(render({ ...base, availability: 'BLOCKED', blockers: [known] }).includes(known.description));
console.log('PASS: actual command renderer shows known blockers, hides unknown/untyped details and preserves locked controls');
