// THE SQL SCANNER — one implementation of "what SQL does src/ actually send?"
//
// Two guards need the same answer to that question and must never disagree about it:
//   • tools/pgquery.js PREPAREs every static statement against real Postgres (the 2026-07-30
//     `uuid = text` outage: the statement failed to PARSE, so every authed request 500'd while all
//     61 pg-mem suites stayed green).
//   • test/gates.js THE INTERPOLATION LEDGER audits every `${...}` in those same templates, because
//     an interpolated query is the one shape pgquery structurally cannot check.
//
// A second copy of the walker is how the two would come to disagree about the corpus — the class
// this project paid for at sixty-nine private copies of three gate predicates, and again when
// test/client.js grew a third copy of describe()'s dependency list. So the walker lives here once
// and both guards import it.
//
// HAND-ROLLED, DELIBERATELY. The argument to `.query(` may be a template literal spanning many
// lines and containing quotes, braces and nested templates — the exact shape a regex reads wrong
// (test/client.js learned that twice, expensively). This walk is the one pgquery has run against
// the tree since it shipped; it is moved here byte-for-byte rather than improved, because changing
// what the scanner FINDS changes what both guards check and would silently re-baseline them.
import fs from 'node:fs';
import path from 'node:path';

// The first string literal following an index — or null when the argument is a variable, a call, or
// a bare identifier (SCHEMA and friends). `interpolated` says the literal was a template carrying at
// least one `${...}`; `parts` is the SOURCE TEXT of each of those expressions, which is what the
// ledger reasons about.
export function firstStringArg(src, from) {
  let i = from;
  while (i < src.length && /[\s\n]/.test(src[i])) i++;
  const q = src[i];
  if (q !== '`' && q !== "'" && q !== '"') return null;
  let out = '', depth = 0, interpolated = false;
  const parts = [];
  for (i++; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') { out += src[i + 1]; i++; continue; }
    if (q === '`' && c === '$' && src[i + 1] === '{') {
      interpolated = true; depth = 1; i++;
      // Capture the expression text with brace matching, so a nested object literal or a nested
      // template inside the interpolation does not end it early.
      let expr = '';
      for (let j = i + 1; j < src.length; j++) {
        const d = src[j];
        if (d === '{') depth++;
        else if (d === '}') { depth--; if (depth === 0) { parts.push(expr); i = j; break; } }
        expr += d;
      }
      continue;
    }
    if (depth > 0) continue;
    if (c === q) return { sql: out, interpolated, parts };
    out += c;
  }
  return null;
}

export function jsFilesUnder(dir) {
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) files.push(p);
    }
  })(dir);
  return files.sort();
}

const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

// Every `.query(` call site under `srcDir`, bucketed by what can be done with it.
//   readable    — a literal we can read (whether or not it is DML)
//   unreadable  — the argument is not a literal at all
// Callers apply their own DML filter; pgquery skips DDL because PREPARE cannot take it, while the
// ledger cares about every interpolation regardless of statement kind.
export function scanQueryCalls(srcDir, { root = srcDir } = {}) {
  const readable = [], unreadable = [];
  for (const file of jsFilesUnder(srcDir)) {
    const src = fs.readFileSync(file, 'utf8');
    const rel = path.relative(root, file).replaceAll('\\', '/');
    for (const m of src.matchAll(/\.query\(/g)) {
      const line = lineOf(src, m.index);
      const where = `${rel}:${line}`;
      const got = firstStringArg(src, m.index + m[0].length);
      if (!got) { unreadable.push({ where, file, rel, line }); continue; }
      readable.push({ where, file, rel, line, src, ...got });
    }
  }
  return { readable, unreadable };
}
