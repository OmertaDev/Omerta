import { createHash } from 'node:crypto';
import { keccak256, toHex } from 'viem';

// Hash the exact compiler input, not a platform checkout's CRLF representation. Compilation
// must already use LF: a different compiler input is rejected, never silently rewritten here.
export function compilerSourceSha256(rawBytes, compilerInputKeccak256) {
  const canonical = Buffer.from(rawBytes.toString('utf8').replace(/\r\n/g, '\n'));
  if (keccak256(toHex(canonical)) !== compilerInputKeccak256)
    throw Error('Compiler source input is not the verified canonical LF content; rebuild from canonical input.');
  return createHash('sha256').update(canonical).digest('hex');
}

export function firstDifference(actual, expected, path = '$') {
  if (Object.is(actual, expected)) return null;
  if (actual === null || expected === null || typeof actual !== 'object' || typeof expected !== 'object')
    return { path, actual, expected };
  const keys = [...new Set([...Object.keys(actual), ...Object.keys(expected)])].sort();
  for (const key of keys) {
    const diff = firstDifference(actual[key], expected[key], `${path}.${key}`);
    if (diff) return diff;
  }
  return null;
}
export function trustedModuleValues(bytes) {
  const text = bytes.toString('utf8'), values = {};
  for (const name of ['TRUSTED_HOOK', 'TRUSTED_CREATIONS']) {
    const match = new RegExp(`export const ${name} = Object\\.freeze\\(([\\s\\S]*?)\\);(?:\\r?\\n|$)`).exec(text);
    if (!match) throw Error(`Generated module export ${name} is missing or malformed.`);
    values[name] = JSON.parse(match[1]);
  }
  return values;
}
export function trustedAssetDifference(actualBytes, expectedBytes) {
  try {
    const diff = firstDifference(trustedModuleValues(actualBytes), trustedModuleValues(expectedBytes));
    if (!diff) return 'generated module text differs despite equal JSON values';
    const summary = value => {
      const json = JSON.stringify(value) ?? 'undefined';
      return json.length <= 180 ? json : `${json.slice(0, 100)}… (${json.length} chars)`;
    };
    if (typeof diff.actual === 'string' && typeof diff.expected === 'string'
      && /^0x(?:[\da-f]{2})+$/i.test(diff.actual) && /^0x(?:[\da-f]{2})+$/i.test(diff.expected)
      && diff.path.endsWith('.creationBytecode'))
      return `${diff.path}: ${bytecodeDifference(diff.actual, diff.expected)}`;
    return `${diff.path}: stored=${summary(diff.actual)} compiled=${summary(diff.expected)}`;
  } catch (error) { return `cannot parse trusted asset diagnostics: ${error.message}`; }
}
export function bytecodeDifference(storedHex, compiledHex) {
  const stored = Buffer.from(storedHex.slice(2), 'hex'), compiled = Buffer.from(compiledHex.slice(2), 'hex');
  let first = 0; while (first < Math.min(stored.length, compiled.length) && stored[first] === compiled[first]) first++;
  const sha = value => createHash('sha256').update(value).digest('hex');
  const metadata = code => {
    if (code.length < 3) return null;
    const length = code.readUInt16BE(code.length - 2), start = code.length - length - 2;
    if (length === 0 || start < 0 || code[start] < 0xa0 || code[start] > 0xbf) return null;
    return { start, bytes: code.slice(start).toString('hex'), sha256: sha(code.slice(start)) };
  };
  const a = metadata(stored), b = metadata(compiled);
  const hexByte = (code, offset) => offset < code.length ? code[offset].toString(16).padStart(2, '0') : '<end>';
  return JSON.stringify({ firstDiffByteOffset: first, storedByte: hexByte(stored, first), compiledByte: hexByte(compiled, first),
    storedBytes: stored.length, compiledBytes: compiled.length,
    storedKeccak256: keccak256(storedHex), compiledKeccak256: keccak256(compiledHex),
    storedSha256: sha(stored), compiledSha256: sha(compiled),
    bodyBeforeMetadataEqual: a && b ? stored.slice(0, a.start).equals(compiled.slice(0, b.start)) : null,
    storedMetadata: a, compiledMetadata: b });
}
