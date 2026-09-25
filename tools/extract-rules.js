// Regenerate src/rules.generated.js from the current rule tables:
//   node tools/extract-rules.js
//
// Edit data/rules.js, then regenerate. This writes ONE file and never opens rules.tail.js, so a
// regeneration cannot destroy hand-written helpers. test/rules.js enforces the boundary: both table
// files contain only the declared exports and cannot import application logic.
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The table list is the contract between this script and test/rules.js, so it is exported as data and
// the extraction below runs only when this file is invoked as a script. Importing it must have no
// side effects — the test reads TABLES to assert the generated file exports exactly these and nothing
// else, and it should not have to regenerate rules to import the table names.
export const TABLES = ['CRIMES', 'MISSIONS', 'RACKETS', 'CITY_EVENTS', 'CARS', 'TRIMS', 'GUNS', 'VESTS',
  'CONSUMABLES', 'GOODS', 'ASSETS', 'MARKET', 'DAILY_POOL', 'FAMILY_TASKS', 'DRUGS', 'KITCHENS',
  'TRADE_RANKS', 'PATHS', 'RANKS', 'DISTRICTS', 'ONBOARD_TASKS', 'RECRUIT_MILESTONES'];

const header = `// AUTO-GENERATED — do not hand-edit. Regenerate with:
//   node tools/extract-rules.js
//
// Edit the current tables in data/rules.js. This file holds only their generated exports.
// Helpers, overrides and hand-authored constants live in rules.tail.js, which the extractor
// never touches. test/rules.js checks source parity, the data boundary and the combined exports.
`;

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const sourcePath = process.argv[2] || fileURLToPath(new URL('../data/rules.js', import.meta.url));
  const source = fs.readFileSync(sourcePath, 'utf8').replaceAll('\r\n', '\n');
  const grab = (n) => {
    const m = source.match(new RegExp('^export const ' + n + ' = (\\[[\\s\\S]*?\\n\\]);?$', 'm'));
    if (!m) throw new Error(`table not found in rule source: ${n}`);
    return m[1];
  };
  const out = header + TABLES.map((t) => `export const ${t} = ${grab(t)}\n`).join('\n');
  fs.writeFileSync(new URL('../src/rules.generated.js', import.meta.url), out);
  console.log(`src/rules.generated.js regenerated from ${sourcePath} — ${TABLES.length} tables, `
    + `${out.split('\n').length} lines. rules.tail.js was not touched.`);
}
