// PHASE 2A CONTENT DISCOVERY — deterministic, bounded, and authority-safe.
//
// Breaks caught: a hand-maintained package list, filesystem-order dependence, nested package
// shadowing, authored fixture promotion, duplicate/poisoned JSON members, and path escapes.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertDiscoveredContentPackage,
  discoverContentPackages,
  isDiscoveredContentPackage,
} from '../src/content/discovery.js';
import { parseAuthoredJson } from '../src/content/json-source.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_SOURCE = path.join(ROOT, 'test', 'fixtures', 'phase2', 'discovery');
const LEGACY_FIXTURE = path.join(ROOT, 'test', 'fixtures', 'content', 'valid-minimal.json');

const temporaryRoots = [];
function temporaryRoot(prefix = 'omerta-phase2-discovery-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

function copyFixtureRoot() {
  const root = temporaryRoot();
  fs.cpSync(FIXTURE_SOURCE, root, { recursive: true });
  return root;
}

function writeManifest(root, relativeDir, source) {
  const directory = path.join(root, ...relativeDir.split('/'));
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'pack.json'), source, 'utf8');
}

function relativeManifests(root, found) {
  return found.map(({ manifestPath }) => path.relative(root, manifestPath).replaceAll('\\', '/'));
}

function assertDiscoveryRejects(source, expected) {
  const root = temporaryRoot();
  writeManifest(root, 'candidate', source);
  assert.throws(() => discoverContentPackages({ rootDir: root }), expected);
}

function legacyManifest(overrides = {}) {
  return JSON.stringify({
    ...JSON.parse(fs.readFileSync(LEGACY_FIXTURE, 'utf8')),
    ...overrides,
  });
}

function canCreateDirectoryLink(root, target) {
  const probe = path.join(root, 'directory-link-probe');
  try {
    fs.symlinkSync(target, probe, process.platform === 'win32' ? 'junction' : 'dir');
    fs.unlinkSync(probe);
    return true;
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) return false;
    throw error;
  }
}

function restoreSwappedDirectory(directory, backup, swapped) {
  if (!swapped) return;
  fs.unlinkSync(directory);
  fs.renameSync(backup, directory);
}

const reviewFailures = [];
function reviewRegression(name, run) {
  try {
    run();
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    reviewFailures.push(error);
  }
}

try {
  {
    const fixtureRoot = copyFixtureRoot();
    const found = discoverContentPackages({
      rootDir: fixtureRoot,
      fixtureRoots: [path.join(fixtureRoot, 'fixtures')],
    });

    assert.deepEqual(found.map(({ manifestPath, authorityProfile }) => ({
      manifestPath: path.relative(fixtureRoot, manifestPath).replaceAll('\\', '/'),
      authorityProfile,
    })), [
      { manifestPath: 'fixtures/adversarial/pack.json', authorityProfile: 'fixture' },
      { manifestPath: 'valid-experience/pack.json', authorityProfile: 'production' },
      { manifestPath: 'valid-library/pack.json', authorityProfile: 'production' },
    ]);
    assert(found.every(({ source }) => Buffer.isBuffer(source)), 'discovery retains exact source bytes');
    assert.deepEqual(
      found[0].source,
      fs.readFileSync(found[0].manifestPath),
      'the descriptor preserves every authored source byte exactly',
    );
    assert(found.every(isDiscoveredContentPackage), 'walker results carry unforgeable provenance');
    const lookalike = { ...found[0] };
    assert.equal(isDiscoveredContentPackage(lookalike), false);
    assert.throws(
      () => assertDiscoveredContentPackage(lookalike),
      /not issued by content discovery/,
      'copying fixture fields cannot forge walker provenance',
    );
    assert.equal(assertDiscoveredContentPackage(found[0]), found[0]);
    const originalSource = found[0].source;
    const expectedFirstByte = originalSource[0];
    originalSource[0] = expectedFirstByte ^ 0xff;
    assert.equal(
      found[0].source[0],
      expectedFirstByte,
      'callers cannot mutate the walker-owned raw-byte snapshot',
    );
    assert(Object.isFrozen(found[0]), 'authority metadata cannot be rewritten after discovery');
    assert.equal(
      parseAuthoredJson(found[0].source).authorityProfile,
      'production',
      'authored authority remains data and cannot elevate a fixture-root package',
    );
    assert.equal(
      parseAuthoredJson(found[2].source).authorityProfile,
      'fixture',
      'authored authority cannot demote a production-root package',
    );
  }
  console.log('✓ package discovery is canonically ordered and fixture authority is server-owned');

  {
    const root = copyFixtureRoot();
    writeManifest(root, 'z-new-production-package', JSON.stringify({
      packageId: 'omerta.phase2.fixture.new-production',
      version: 1,
      kind: 'library',
      profile: 'phase2_economy',
    }));
    writeManifest(root, 'nested-owner', JSON.stringify({
      packageId: 'omerta.phase2.fixture.nested-owner',
      version: 1,
    }));
    writeManifest(root, 'nested-owner/child', JSON.stringify({
      packageId: 'omerta.phase2.fixture.nested-child',
      version: 1,
    }));

    const found = discoverContentPackages({
      rootDir: root,
      fixtureRoots: [path.join(root, 'fixtures')],
    });
    assert.deepEqual(relativeManifests(root, found), [
      'fixtures/adversarial/pack.json',
      'nested-owner/child/pack.json',
      'nested-owner/pack.json',
      'valid-experience/pack.json',
      'valid-library/pack.json',
      'z-new-production-package/pack.json',
    ]);
  }
  console.log('✓ new and nested production packages cannot be omitted or shadowed');

  reviewRegression('cross-version package ownership is unique', () => {
    const root = temporaryRoot();
    writeManifest(root, 'first', '{"packageId":"omerta.phase2.one-owner","version":1}');
    writeManifest(root, 'second', '{"packageId":"omerta.phase2.one-owner","version":2}');
    assert.throws(
      () => discoverContentPackages({ rootDir: root }),
      /duplicate package identity omerta\.phase2\.one-owner/,
    );
  });

  reviewRegression('legacy namespace wins over extraneous packageId aliases', () => {
    const root = temporaryRoot();
    writeManifest(root, 'first', legacyManifest({ packageId: 'alias.first' }));
    writeManifest(root, 'second', legacyManifest({ packageId: 'alias.second' }));
    assert.throws(
      () => discoverContentPackages({ rootDir: root }),
      /duplicate package identity test\.minimal/,
    );
  });

  reviewRegression('new packageId collides with the effective legacy namespace', () => {
    const root = temporaryRoot();
    writeManifest(root, 'legacy', legacyManifest());
    writeManifest(root, 'new', '{"packageId":"test.minimal","version":2,"kind":"library"}');
    assert.throws(
      () => discoverContentPackages({ rootDir: root }),
      /duplicate package identity test\.minimal/,
    );
  });

  reviewRegression('distinct legacy namespace versions preserve compiler compatibility', () => {
    const root = temporaryRoot();
    writeManifest(root, 'v1', legacyManifest({ version: 1 }));
    writeManifest(root, 'v2', legacyManifest({ version: 2 }));
    assert.equal(discoverContentPackages({ rootDir: root }).length, 2);
  });

  reviewRegression('unsafe legacy versions fail before identity comparison', () => {
    const root = temporaryRoot();
    writeManifest(root, 'first', legacyManifest({ version: 9007199254740992 }));
    writeManifest(root, 'second', legacyManifest({ version: 9007199254740992 }));
    assert.throws(
      () => discoverContentPackages({ rootDir: root }),
      (error) => error?.code === 'content_version_unsafe',
    );
  });

  reviewRegression('NFC-equivalent paths cannot share one canonical manifest identity', () => {
    const root = temporaryRoot();
    const composed = 'caf\u00e9';
    const decomposed = 'cafe\u0301';
    writeManifest(root, composed, '{"packageId":"omerta.phase2.path.composed","version":1}');
    writeManifest(root, decomposed, '{"packageId":"omerta.phase2.path.decomposed","version":1}');
    const spellings = new Set(fs.readdirSync(root));
    if (spellings.has(composed) && spellings.has(decomposed)) {
      assert.throws(
        () => discoverContentPackages({ rootDir: root }),
        /normalized manifest path collision/,
      );
    }
  });

  reviewRegression('package limit stops before later poison is traversed', () => {
    const root = temporaryRoot();
    writeManifest(root, 'a-first', '{"packageId":"omerta.phase2.limit.first","version":1}');
    writeManifest(root, 'b-second', '{"packageId":"omerta.phase2.limit.second","version":1}');
    fs.mkdirSync(path.join(root, 'z-poison'));
    fs.writeFileSync(path.join(root, 'z-poison', 'pack.yaml'), 'must not be reached', 'utf8');
    assert.throws(
      () => discoverContentPackages({ rootDir: root, limits: { maxPackages: 1 } }),
      /content package limit 1 exceeded/,
    );
  });

  reviewRegression('directory count is bounded during traversal', () => {
    const root = temporaryRoot();
    fs.mkdirSync(path.join(root, 'a', 'b'), { recursive: true });
    assert.throws(
      () => discoverContentPackages({ rootDir: root, limits: { maxDirectories: 1 } }),
      /content directory limit 1 exceeded/,
    );
  });

  reviewRegression('no-manifest directory entries are bounded during traversal', () => {
    const root = temporaryRoot();
    for (const name of ['a.json', 'b.json', 'c.json']) {
      fs.writeFileSync(path.join(root, name), '{}', 'utf8');
    }
    assert.throws(
      () => discoverContentPackages({ rootDir: root, limits: { maxDirectoryEntries: 2 } }),
      /content directory-entry limit 2 exceeded/,
    );
  });

  reviewRegression('total corpus bytes are bounded independently of each manifest', () => {
    const root = temporaryRoot();
    writeManifest(root, 'first', '{"packageId":"omerta.phase2.bytes.first","version":1}');
    writeManifest(root, 'second', '{"packageId":"omerta.phase2.bytes.second","version":1}');
    assert.throws(
      () => discoverContentPackages({ rootDir: root, limits: { maxCorpusBytes: 64 } }),
      /corpus byte limit 64 exceeded/,
    );
  });

  reviewRegression('manifest bytes stay bound to the checked in-root file', () => {
    const root = temporaryRoot();
    const outside = temporaryRoot('omerta-phase2-swap-outside-');
    writeManifest(root, 'candidate', '{"packageId":"omerta.phase2.swap.inside","version":1}');
    writeManifest(outside, 'candidate', '{"packageId":"omerta.phase2.swap.outside","version":1}');
    if (!canCreateDirectoryLink(root, path.join(outside, 'candidate'))) return;

    const directory = path.join(root, 'candidate');
    const backup = path.join(root, 'candidate-original');
    const manifest = path.join(directory, 'pack.json');
    const originalStatSync = fs.statSync;
    const originalOpenSync = fs.openSync;
    let swapped = false;
    const swap = () => {
      if (swapped) return;
      fs.renameSync(directory, backup);
      fs.symlinkSync(
        path.join(outside, 'candidate'),
        directory,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
      swapped = true;
    };
    fs.statSync = function injectedStat(target, ...args) {
      const result = originalStatSync.call(this, target, ...args);
      if (!swapped && path.resolve(String(target)) === path.resolve(manifest)) swap();
      return result;
    };
    fs.openSync = function injectedOpen(target, ...args) {
      const descriptor = originalOpenSync.call(this, target, ...args);
      if (!swapped && path.resolve(String(target)) === path.resolve(manifest)) swap();
      return descriptor;
    };
    try {
      assert.throws(
        () => discoverContentPackages({ rootDir: root }),
        (error) => error?.code === 'content_manifest_changed',
      );
    } finally {
      fs.statSync = originalStatSync;
      fs.openSync = originalOpenSync;
      restoreSwappedDirectory(directory, backup, swapped);
    }
  });

  reviewRegression('directory enumeration is bound to one canonical directory', () => {
    const root = temporaryRoot();
    const outside = temporaryRoot('omerta-phase2-directory-swap-');
    writeManifest(root, 'candidate', '{"packageId":"omerta.phase2.directory.inside","version":1}');
    writeManifest(outside, 'candidate', '{"packageId":"omerta.phase2.directory.outside","version":1}');
    if (!canCreateDirectoryLink(root, path.join(outside, 'candidate'))) return;

    const directory = path.join(root, 'candidate');
    const backup = path.join(root, 'candidate-original');
    const originalReaddirSync = fs.readdirSync;
    const originalOpendirSync = fs.opendirSync;
    let swapped = false;
    const swap = () => {
      if (swapped) return;
      fs.renameSync(directory, backup);
      fs.symlinkSync(
        path.join(outside, 'candidate'),
        directory,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
      swapped = true;
    };
    fs.readdirSync = function injectedReaddir(target, ...args) {
      const entries = originalReaddirSync.call(this, target, ...args);
      if (!swapped && path.resolve(String(target)) === path.resolve(directory)) swap();
      return entries;
    };
    fs.opendirSync = function injectedOpendir(target, ...args) {
      const handle = originalOpendirSync.call(this, target, ...args);
      if (path.resolve(String(target)) === path.resolve(directory)) {
        const originalReadSync = handle.readSync.bind(handle);
        handle.readSync = () => {
          const entry = originalReadSync();
          if (entry === null && !swapped) swap();
          return entry;
        };
      }
      return handle;
    };
    try {
      assert.throws(
        () => discoverContentPackages({ rootDir: root }),
        (error) => error?.code === 'content_directory_changed',
      );
    } finally {
      fs.readdirSync = originalReaddirSync;
      fs.opendirSync = originalOpendirSync;
      restoreSwappedDirectory(directory, backup, swapped);
    }
  });

  reviewRegression('literal unpaired UTF-16 input is rejected', () => {
    const source = `"${String.fromCharCode(0xd800)}"`;
    assert.throws(
      () => parseAuthoredJson(source),
      (error) => error?.code === 'json_utf16',
    );
    assert.equal(parseAuthoredJson('"\\ud800"'), String.fromCharCode(0xd800));
  });

  reviewRegression('oversized string input is rejected before Buffer allocation', () => {
    const originalBufferFrom = Buffer.from;
    let stringConversionReached = false;
    Buffer.from = function instrumentedBufferFrom(value, ...args) {
      if (typeof value === 'string') stringConversionReached = true;
      return Reflect.apply(originalBufferFrom, Buffer, [value, ...args]);
    };
    try {
      assert.throws(
        () => parseAuthoredJson('123456789', { maxBytes: 1 }),
        (error) => error?.code === 'json_byte_limit',
      );
      assert.equal(stringConversionReached, false);
    } finally {
      Buffer.from = originalBufferFrom;
    }
  });

  reviewRegression('oversized string scanning stops at the byte limit', () => {
    const unpairedHighSurrogate = String.fromCharCode(0xd800);
    const lateSurrogate = `${'x'.repeat(9_999)}${unpairedHighSurrogate}`;
    assert.equal(lateSurrogate.length, 10_000);
    assert.throws(
      () => parseAuthoredJson(lateSurrogate, { maxBytes: 1 }),
      (error) => error?.code === 'json_byte_limit',
    );
    assert.throws(
      () => parseAuthoredJson(`${unpairedHighSurrogate}${'x'.repeat(9_999)}`, { maxBytes: 1 }),
      (error) => error?.code === 'json_utf16',
    );
    assert.equal(parseAuthoredJson('"\ud83d\udca3"', { maxBytes: 6 }), '\ud83d\udca3');
    assert.throws(
      () => parseAuthoredJson('"\ud83d\udca3"', { maxBytes: 5 }),
      (error) => error?.code === 'json_byte_limit',
    );
  });

  reviewRegression('control-bearing package identity has a stable discovery error', () => {
    const root = temporaryRoot();
    writeManifest(root, 'candidate', JSON.stringify({
      packageId: 'omerta.phase2.control\n\u001b',
      version: 1,
    }));
    assert.throws(
      () => discoverContentPackages({ rootDir: root }),
      (error) => error?.code === 'content_identity_control',
    );
  });

  reviewRegression('CLI diagnostics escape authored controls onto one line', () => {
    const root = temporaryRoot();
    writeManifest(root, 'candidate', '{"\\nFORGED":1,"\\nFORGED":2}');
    const run = spawnSync(process.execPath, ['tools/content.js', 'check-corpus', root], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.equal(run.status, 1);
    assert.equal(run.stderr.trimEnd().split(/\r?\n/).length, 1, run.stderr);
    assert.match(run.stderr, /\\nFORGED/);
  });

  reviewRegression('CLI diagnostics escape Unicode line and bidi controls', () => {
    const root = temporaryRoot();
    const forgedKey = '\\u2028FORGED\\u2029\\u061c\\u200e\\u200f'
      + '\\u202a\\u202b\\u202c\\u202d\\u202e\\u2066\\u2067\\u2068\\u2069';
    writeManifest(root, 'candidate', `{"${forgedKey}":1,"${forgedKey}":2}`);
    const run = spawnSync(process.execPath, ['tools/content.js', 'check-corpus', root], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.equal(run.status, 1);
    assert.equal(run.stderr.trimEnd().split(/\r\n|[\n\r\u2028\u2029]/u).length, 1, run.stderr);
    assert.doesNotMatch(
      run.stderr,
      /[\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/u,
    );
    assert.match(run.stderr, /\\u2028FORGED\\u2029\\u061c/);
  });

  reviewRegression('empty production corpus fails closed', () => {
    const root = temporaryRoot();
    const run = spawnSync(process.execPath, ['tools/content.js', 'check-corpus', root], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.equal(run.status, 1, run.stdout);
    assert.equal(run.stdout, '');
    assert.match(run.stderr, /content: production corpus contains no manifests/);
  });

  if (reviewFailures.length > 0) {
    throw new AggregateError(reviewFailures, 'Task 1 review regressions failed');
  }
  console.log('✓ review-requested identity, path, race, bound, UTF, diagnostic, and empty-corpus gates pass');

  {
    const root = temporaryRoot();
    writeManifest(root, 'first', '{"packageId":"omerta.phase2.duplicate","version":1}');
    writeManifest(root, 'second', '{"packageId":"omerta.phase2.duplicate","version":1}');
    assert.throws(
      () => discoverContentPackages({ rootDir: root }),
      /duplicate package identity omerta\.phase2\.duplicate/,
    );
  }
  {
    const root = temporaryRoot();
    writeManifest(root, 'first', '{"packageId":"Omerta.Phase2.Case","version":1}');
    writeManifest(root, 'second', '{"packageId":"omerta.phase2.case","version":1}');
    assert.throws(
      () => discoverContentPackages({ rootDir: root }),
      /case-normalized package identity collision/,
    );
  }
  console.log('✓ duplicate and case-normalized package identities fail closed');

  assertDiscoveryRejects('{"packageId":"broken",', /malformed authored JSON/);
  assertDiscoveryRejects(
    '{"packageId":"root.duplicate","version":1,"profile":"first","pro\\u0066ile":"second"}',
    /duplicate object member "profile"/,
  );
  assertDiscoveryRejects(
    '{"packageId":"nested.adapter","version":1,"node":{"adapter":"first","adapter":"second"}}',
    /duplicate object member "adapter"/,
  );
  assertDiscoveryRejects(
    '{"packageId":"nested.identity","version":1,"node":{"identity":{},"identity":{}}}',
    /duplicate object member "identity"/,
  );
  for (const dangerousKey of ['__proto__', 'prototype', 'constructor']) {
    assert.throws(
      () => parseAuthoredJson(`{"${dangerousKey}":true}`),
      new RegExp(`dangerous object member "${dangerousKey}"`),
    );
    assertDiscoveryRejects(
      `{"packageId":"dangerous.${dangerousKey}","version":1,"nested":{"${dangerousKey}":true}}`,
      new RegExp(`dangerous object member "${dangerousKey}"`),
    );
  }
  console.log('✓ malformed, duplicate, and prototype-dangerous JSON fails before materialization');

  {
    const parsed = parseAuthoredJson(Buffer.from(
      '{"safe":{"value":1},"array":[true,false,null,"ok"]}',
    ));
    assert.equal(Object.getPrototypeOf(parsed), Object.prototype);
    assert.equal(Object.getPrototypeOf(parsed.safe), Object.prototype);
    assert.deepEqual(parsed.array, [true, false, null, 'ok']);
  }
  assert.throws(
    () => parseAuthoredJson(Buffer.from('{"value":"12345"}'), { maxBytes: 10 }),
    /byte limit 10/,
  );
  assert.throws(
    () => parseAuthoredJson(Buffer.from('{"a":{"b":1}}'), { maxDepth: 1 }),
    /depth limit 1/,
  );
  assert.throws(
    () => parseAuthoredJson(Buffer.from('{"value":"12345"}'), { maxStringBytes: 4 }),
    /string byte limit 4/,
  );
  assert.throws(
    () => parseAuthoredJson(Buffer.from('{"a":1,"b":2}'), { maxObjectMembers: 1 }),
    /object member limit 1/,
  );
  assert.throws(
    () => parseAuthoredJson(Buffer.from('[1,2]'), { maxArrayItems: 1 }),
    /array item limit 1/,
  );
  assert.throws(
    () => parseAuthoredJson(Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0xff, 0x7d])),
    /invalid UTF-8/,
  );
  console.log('✓ authored JSON byte, depth, string, and container bounds are enforced');

  {
    const root = temporaryRoot();
    fs.writeFileSync(path.join(root, 'pack.yaml'), 'packageId: unsupported', 'utf8');
    assert.throws(
      () => discoverContentPackages({ rootDir: root }),
      /unsupported manifest path pack\.yaml/,
    );
  }
  {
    const root = temporaryRoot();
    writeManifest(root, 'oversized', JSON.stringify({
      packageId: 'omerta.phase2.oversized',
      version: 1,
      padding: 'x'.repeat((1024 * 1024) + 1),
    }));
    assert.throws(
      () => discoverContentPackages({ rootDir: root }),
      /byte limit 1048576/,
    );
  }
  console.log('✓ unsupported manifests and oversized authored files are rejected');

  {
    const root = temporaryRoot();
    const outside = temporaryRoot('omerta-phase2-outside-');
    writeManifest(outside, 'escaped', '{"packageId":"omerta.phase2.escaped","version":1}');
    const link = path.join(root, 'escape');
    let symlinkSupported = true;
    try {
      fs.symlinkSync(path.join(outside, 'escaped'), link, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) symlinkSupported = false;
      else throw error;
    }
    if (symlinkSupported) {
      assert.throws(
        () => discoverContentPackages({ rootDir: root }),
        /symbolic link escapes content root/,
      );
    }
  }
  console.log('✓ symbolic-link escapes are rejected where the platform supports links');

  {
    const root = temporaryRoot();
    const newPackage = path.join(root, 'newly-copied');
    fs.mkdirSync(newPackage, { recursive: true });
    fs.copyFileSync(LEGACY_FIXTURE, path.join(newPackage, 'pack.json'));
    const run = spawnSync(process.execPath, ['tools/content.js', 'check-corpus', root], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, `corpus check failed:\n${run.stdout}\n${run.stderr}`);
    assert.deepEqual(JSON.parse(run.stdout), {
      ok: true,
      command: 'check-corpus',
      packageCount: 1,
    });
  }
  console.log('✓ corpus CLI discovers a newly copied production package without script edits');
} finally {
  for (const root of temporaryRoots) {
    const resolved = path.resolve(root);
    assert(resolved.startsWith(path.resolve(os.tmpdir())), `refusing to remove non-temporary path ${resolved}`);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

console.log('phase2 discovery tests passed');
