throw new Error('PREPARATION ONLY: independently bind and review a separate executable successor before use');

// Builtins are imported only inside an exported function, after the barrier.
const DRIVER_SHA = 'f40e92b119b30b203542011bc16859762680cccd9f7ec138eed4f2c9e647e0ca';
const PHOSPHOR_SHA = '195b285bde26866e8cd20fbb0dbd88bd82ea41371376b3b55c31b37f1aff5e76';
const PINO_SHA = '719775f96ad413f00f7d0f2df9377b0c30ffbf3c5e55c2acb65f67383405ac85';

async function primitives() {
  const [fs, path, crypto, assertModule, cp, url] = await Promise.all([
    import('node:fs'), import('node:path'), import('node:crypto'),
    import('node:assert/strict'), import('node:child_process'), import('node:url'),
  ]);
  const assert = assertModule.default;
  const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  const blob = bytes => crypto.createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
  const samePath = (a, b) => path.resolve(a) === path.resolve(b);
  const outside = (root, file) => {
    const rel = path.relative(root, file);
    return rel === '..' || rel.startsWith('../') || path.isAbsolute(rel);
  };
  function canonical(file) {
    assert(path.isAbsolute(file) && path.resolve(file) === file);
    assert.equal(fs.realpathSync(file), file, 'Canonical physical path required: ' + file);
    return file;
  }
  function regular(file) {
    canonical(file); const stat = fs.lstatSync(file);
    assert(stat.isFile() && !stat.isSymbolicLink(), 'Ordinary file required: ' + file);
    return fs.readFileSync(file);
  }
  function relative(file) {
    assert(typeof file === 'string' && file.length > 0 && !path.isAbsolute(file) && !file.includes('\\'));
    assert(!file.split('/').some(p => ['', '.', '..'].includes(p)));
    return file;
  }
  function directory(file) {
    canonical(file); const stat = fs.lstatSync(file);
    assert(stat.isDirectory() && !stat.isSymbolicLink(), 'Ordinary directory required: ' + file);
    return file;
  }
  function insideRegular(root, file) {
    relative(file); directory(root); const parts = file.split('/'); let current = root;
    for (const [index, part] of parts.entries()) {
      current = path.join(current, part); const stat = fs.lstatSync(current);
      assert(!stat.isSymbolicLink(), 'Source/dependency link refused: ' + file);
      assert(index === parts.length - 1 ? stat.isFile() : stat.isDirectory());
    }
    canonical(current); assert(!outside(root, current) && current !== root); return current;
  }
  function descriptor(file) {
    const bytes = regular(file); return { path: file, bytes: bytes.length, sha256: sha(bytes) };
  }
  function readRef(ref) {
    assert(ref && /^[0-9a-f]{64}$/.test(ref.sha256) && Number.isSafeInteger(ref.bytes));
    const bytes = regular(ref.path); assert.equal(bytes.length, ref.bytes); assert.equal(sha(bytes), ref.sha256);
    return JSON.parse(bytes);
  }
  function put(folder, name, value) {
    relative(name); const file = path.join(folder, name);
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    return descriptor(file);
  }
  return { fs, path, crypto, assert, cp, sha, blob, samePath, outside, canonical,
    regular, relative, directory, insideRegular, descriptor, readRef, put,
    here: path.dirname(url.fileURLToPath(import.meta.url)) };
}

function references(P) {
  const { path, regular, sha, assert, here } = P;
  function get(name, digest) {
    const bytes = regular(path.join(here, name)); assert.equal(sha(bytes), digest); return JSON.parse(bytes);
  }
  const driver = get('driver-and-boot.reference.json', DRIVER_SHA);
  assert.equal(driver.packages.length, 14); assert.equal(driver.files.length, 139);
  const phosphor = get('phosphor-embedded.reference.json', PHOSPHOR_SHA);
  const pino = get('pino-embedded.reference.json', PINO_SHA);
  assert.equal(phosphor.packagePath, 'node_modules/@phosphor-icons/webcomponents');
  assert.equal(phosphor.bundlePath, phosphor.packagePath + '/dist/node_modules/.pnpm');
  assert.equal(phosphor.files.length, 6); assert.equal(phosphor.directories.length, 11);
  assert.equal(pino.packages.length, 2);
  const pinoPaths = ['node_modules/@walletconnect/logger/node_modules/pino', 'node_modules/pino'];
  assert.deepEqual(pino.packages.map(row => row.ownerPackagePath), pinoPaths);
  for (const row of pino.packages) {
    assert.equal(row.embeddedRoot, row.ownerPackagePath + '/test/fixtures/eval/node_modules');
    assert.equal(row.files.length, 16);
  }
  return { driver, bundles: [{ ...phosphor, referenceSHA256: PHOSPHOR_SHA }, ...pino.packages.map(row => ({
    ...row, packagePath: row.ownerPackagePath, bundlePath: row.embeddedRoot,
    directories: [], requiredOccurrenceCount: 1, referenceSHA256: PINO_SHA,
  }))] };
}

function runtime(B, P) {
  const { assert, regular, sha, path } = P;
  assert.equal(process.platform, 'linux'); assert.equal(B.platform, 'linux');
  assert.equal(process.arch, B.arch); assert.deepEqual(process.execArgv, []);
  assert.equal(process.execPath, B.runtime.node.path); assert.equal(process.version, B.runtime.node.version);
  const observed = {};
  for (const name of ['node', 'git', 'npmCli']) {
    const item = B.runtime[name], bytes = regular(item.path);
    assert.equal(sha(bytes), item.sha256, 'Bound runtime hash: ' + name);
    observed[name] = { path: item.path, bytes: bytes.length, sha256: sha(bytes) };
  }
  observed.node.version = process.version;
  observed.platform = process.platform; observed.arch = process.arch;
  assert.equal(B.runtime.path, [path.dirname(B.runtime.node.path), path.dirname(B.runtime.git.path), '/usr/bin', '/bin'].join(':'));
  return observed;
}

function childEnvironment(B, out, P) {
  const { path, fs } = P;
  const user = path.join(out, 'npm-userconfig.empty'), global = path.join(out, 'npm-globalconfig.empty');
  fs.writeFileSync(user, '', { flag: 'wx', mode: 0o600 }); fs.writeFileSync(global, '', { flag: 'wx', mode: 0o600 });
  return { PATH: B.runtime.path, HOME: out, TMPDIR: out, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8', TZ: 'UTC',
    CHAIN_ENABLED: 'off', RESOURCE_ECONOMY: 'off', SOCIAL_VERIFY_MODE: 'off',
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_OPTIONAL_LOCKS: '0',
    NPM_CONFIG_USERCONFIG: user, NPM_CONFIG_GLOBALCONFIG: global, NPM_CONFIG_CACHE: path.join(out, 'npm-cache') };
}

function sourceTools(B, side, env, P) {
  const { assert, cp, directory, regular, path, fs, insideRegular, blob, sha } = P;
  const root = side.directory;
  const gitBytes = (...args) => cp.execFileSync(B.runtime.git.path, ['--no-replace-objects', '--no-optional-locks', '-c', 'core.fsmonitor=false', ...args],
    { cwd: root, env, maxBuffer: 128 * 1024 * 1024, timeout: 120000 });
  const git = (...args) => gitBytes(...args).toString('utf8').trim();
  function identity() {
    directory(root); assert.equal(git('rev-parse', '--show-toplevel'), root);
    assert.equal(git('rev-parse', 'HEAD'), side.source); assert.equal(git('rev-parse', 'HEAD^{tree}'), side.tree);
    assert.equal(git('status', '--porcelain=v1', '--untracked-files=all'), '');
    assert(!fs.existsSync(path.join(root, '.npmrc')), 'Unreviewed project npm configuration refused');
    assert(/^[0-9a-f]{40}$/.test(side.source) && /^[0-9a-f]{40}$/.test(side.tree));
  }
  function members(relative, output = []) {
    const folder = directory(path.join(root, relative));
    for (const name of fs.readdirSync(folder).sort()) {
      const file = relative + '/' + name, stat = fs.lstatSync(path.join(root, file));
      assert(!stat.isSymbolicLink());
      if (stat.isDirectory()) members(file, output);
      else { assert(stat.isFile()); output.push(file); }
    }
    return output;
  }
  function capture(ref) {
    identity(); const records = []; let binaryExact = 0;
    const treeBytes = gitBytes('ls-tree', '-rz', '--full-tree', side.source), tree = treeBytes.toString('utf8');
    assert(Buffer.from(tree).equals(treeBytes), 'Git paths must be valid UTF-8');
    for (const row of tree.split('\0').filter(Boolean)) {
      const at = row.indexOf('\t'), [mode, type, oid] = row.slice(0, at).split(' '), file = row.slice(at + 1);
      assert(type === 'blob' && ['100644', '100755'].includes(mode));
      const full = insideRegular(root, file), stat = fs.lstatSync(full), raw = regular(full);
      assert.equal(blob(raw), oid, 'Linux source raw bytes must equal Git: ' + file);
      assert.equal(stat.mode, parseInt(mode, 8), 'Exact Linux source mode: ' + file);
      const text = Buffer.from(raw.toString('utf8')).equals(raw) && !raw.includes(0) && !raw.includes(13);
      if (!text) binaryExact++;
      records.push({ file, mode, blob: oid, gitBytes: raw.length, gitSHA256: sha(raw),
        rawBytes: raw.length, rawMode: stat.mode, rawSHA256: sha(raw), representation: text ? 'exactGit' : 'opaqueExactGit', text });
    }
    assert.equal(new Set(records.map(row => row.file)).size, records.length);
    assert.equal(gitBytes('ls-files', '--stage', '-z').toString('utf8'), records.map(row => row.mode + ' ' + row.blob + ' 0\t' + row.file + '\0').join(''));
    const indexFlags = gitBytes('ls-files', '-v', '-z').toString('utf8').split('\0').filter(Boolean);
    assert(indexFlags.every(row => row.startsWith('H ')));
    assert.deepEqual(indexFlags.map(row => row.slice(2)), records.map(row => row.file));
    const driver = [];
    for (const name of ref.driver.packages) for (const file of members('node_modules/' + name)) {
      const bytes = regular(insideRegular(root, file)); driver.push({ file, bytes: bytes.length, sha256: sha(bytes) });
    }
    driver.sort((a, b) => a.file.localeCompare(b.file));
    assert.equal(driver.length, 139); assert.deepEqual(driver, ref.driver.files);
    const server = regular(insideRegular(root, 'src/server.js')).toString('utf8');
    assert.equal(server.split(ref.driver.bootReader).length, 2);
    const allRootEntries = fs.readdirSync(directory(path.join(root, 'public/art'))).sort();
    const allHypeEntries = fs.readdirSync(directory(path.join(root, 'public/art/hype'))).sort();
    const still = name => ['.jpg', '.jpeg', '.png', '.webp', '.woff2'].includes(name.slice(name.lastIndexOf('.')).toLowerCase());
    const media = name => ['.mp4', '.m4a'].includes(name.slice(name.lastIndexOf('.')).toLowerCase());
    const bootMembership = { allRootEntries, allHypeEntries, rootStills: allRootEntries.filter(still),
      rootMedia: allRootEntries.filter(media), hypeMedia: allHypeEntries.filter(media) };
    for (const file of [...bootMembership.rootStills, ...bootMembership.rootMedia].map(name => 'public/art/' + name)
      .concat(bootMembership.hypeMedia.map(name => 'public/art/hype/' + name))) assert(records.some(row => row.file === file));
    identity();
    return { phase: 'SOURCE_ONLY_UNAPPROVED_FULL_CAPTURE', source: side.source, tree: side.tree, directory: root,
      nodeVersion: process.version, trackedCount: records.length, binaryExact, records, indexFlags,
      driverPackages: [...ref.driver.packages], driver, bootMembership,
      historicalReference: { path: path.join(P.here, 'driver-and-boot.reference.json'), sha256: DRIVER_SHA },
      historicalDriverEqual: true, historicalBootReaderEqual: true };
  }
  return { identity, capture };
}

function physicalPackages(root, lock, hidden, bundles, P) {
  const { assert, fs, path, regular, insideRegular, directory, relative, sha } = P;
  const locations = [], embeddedBundles = [], binLinks = [], binDirectories = [];
  const installed = Object.keys(hidden.packages).sort(), documents = new Map();
  for (const location of installed) {
    relative(location); assert(location.startsWith('node_modules/')); const locked = lock.packages[location]; assert(locked);
    const bytes = regular(insideRegular(root, location + '/package.json')), json = JSON.parse(bytes);
    assert.equal(json.version, locked.version);
    const bin = typeof json.bin === 'string' ? { [json.name.split('/').at(-1)]: json.bin } : json.bin ?? {};
    assert(bin && typeof bin === 'object' && !Array.isArray(bin));
    const normalized = {};
    for (const [name, file] of Object.entries(bin)) {
      assert(name !== '' && !name.includes('/') && !name.includes('\\') && !['.', '..'].includes(name));
      assert.equal(typeof file, 'string'); const target = file.replace(/^\.\//, ''); relative(target); normalized[name] = target;
    }
    const lockBin = typeof locked.bin === 'string' ? { [json.name.split('/').at(-1)]: locked.bin } : locked.bin ?? {};
    const normalizedLock = Object.fromEntries(Object.entries(lockBin).map(([key, file]) => [key, file.replace(/^\.\//, '')]));
    assert.deepEqual(normalized, normalizedLock, 'Installed bin definitions must match committed lock: ' + location);
    documents.set(location, { bytes, json, bin: normalized });
  }
  function embedded(bundle) {
    const relativeRoot = bundle.bundlePath, files = [], directories = [];
    for (const key of ['version', 'resolved', 'integrity']) assert.equal(lock.packages[bundle.packagePath]?.[key], bundle[key]);
    const ownerBytes = documents.get(bundle.packagePath)?.bytes; assert(ownerBytes);
    assert.equal(ownerBytes.length, bundle.packageJson.bytes); assert.equal(sha(ownerBytes), bundle.packageJson.sha256);
    function visit(suffix = '') {
      const full = directory(path.join(root, relativeRoot, suffix));
      for (const name of fs.readdirSync(full).sort()) {
        const entry = suffix ? suffix + '/' + name : name, child = relativeRoot + '/' + entry;
        const stat = fs.lstatSync(path.join(root, child)); assert(!stat.isSymbolicLink());
        if (stat.isDirectory()) { directories.push(entry); visit(entry); }
        else { assert(stat.isFile()); const bytes = regular(insideRegular(root, child)); files.push({ path: entry, bytes: bytes.length, sha256: sha(bytes) }); }
      }
    }
    visit(); directories.sort(); files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    assert.deepEqual(files, bundle.files); assert.deepEqual(directories, bundle.directories);
    embeddedBundles.push({ path: relativeRoot, referenceSHA256: bundle.referenceSHA256, packagePath: bundle.packagePath,
      packageJsonSHA256: sha(ownerBytes), version: bundle.version, resolved: bundle.resolved, integrity: bundle.integrity, directories, files });
  }
  function bins(folder) {
    binDirectories.push(folder);
    for (const name of fs.readdirSync(directory(path.join(root, folder))).sort()) {
      const file = folder + '/' + name, full = path.join(root, file), stat = fs.lstatSync(full);
      assert(stat.isSymbolicLink(), 'Linux .bin permits only validated package links: ' + file);
      const target = fs.readlinkSync(full); assert(!path.isAbsolute(target) && !target.includes('\\'));
      const resolved = path.resolve(path.dirname(full), target);
      assert.equal(target, path.relative(path.dirname(full), resolved), 'Canonical relative .bin link required');
      const packagePath = installed.filter(location => resolved.startsWith(path.join(root, location) + '/')).sort((a, b) => b.length - a.length)[0];
      assert(packagePath, 'Bin target must be inside an installed package');
      const packageFile = path.relative(path.join(root, packagePath), resolved), pkg = documents.get(packagePath);
      assert.equal(pkg.bin[name], packageFile, 'Bin target must match installed package and committed lock');
      assert.equal(insideRegular(root, packagePath + '/' + packageFile), resolved);
      assert.equal(fs.realpathSync(full), resolved); const bytes = regular(resolved);
      assert((fs.lstatSync(resolved).mode & 0o111) !== 0, 'Bin target must be executable');
      binLinks.push({ path: file, target, packagePath, packageFile, bytes: bytes.length, sha256: sha(bytes) });
    }
  }
  function contents(location) {
    for (const name of fs.readdirSync(directory(path.join(root, location))).sort()) {
      const child = location + '/' + name, stat = fs.lstatSync(path.join(root, child));
      assert(!stat.isSymbolicLink(), 'Dependency link outside .bin refused: ' + child);
      if (stat.isDirectory()) {
        if (name.toLowerCase() === 'node_modules') { assert.equal(name, 'node_modules'); modules(child); }
        else contents(child);
      } else assert(stat.isFile());
    }
  }
  function packageLocation(location) { assert(installed.includes(location)); locations.push(location); contents(location); }
  function modules(location) {
    const exact = bundles.find(bundle => bundle.bundlePath === location);
    if (exact) { embedded(exact); return; }
    for (const name of fs.readdirSync(directory(path.join(root, location))).sort()) {
      const child = location + '/' + name, stat = fs.lstatSync(path.join(root, child));
      assert(!stat.isSymbolicLink(), 'Dependency package link refused: ' + child);
      const bundle = bundles.find(row => row.bundlePath === child);
      if (bundle) { embedded(bundle); continue; }
      if (child === 'node_modules/.package-lock.json') { assert(stat.isFile()); continue; }
      if (name === '.bin') { bins(child); continue; }
      assert(stat.isDirectory() && !name.startsWith('.'), 'Unexpected modules entry: ' + child);
      if (name.startsWith('@')) {
        const scoped = fs.readdirSync(directory(path.join(root, child))).sort(); assert(scoped.length);
        for (const pkg of scoped) { assert(!pkg.startsWith('.') && !pkg.startsWith('@')); packageLocation(child + '/' + pkg); }
      } else packageLocation(child);
    }
  }
  modules('node_modules'); locations.sort(); binDirectories.sort(); binLinks.sort((a, b) => a.path.localeCompare(b.path));
  assert.equal(new Set(locations).size, locations.length); assert.deepEqual(locations, installed);
  assert.deepEqual(embeddedBundles.map(row => row.path).sort(), bundles.map(row => row.bundlePath).sort());
  return { locations, embeddedBundles, binDirectories, binLinks, documents };
}

function dependencies(B, side, capture, refs, P) {
  const { path, regular, sha, assert } = P, root = side.directory;
  const lockBytes = regular(path.join(root, 'package-lock.json')), hiddenBytes = regular(path.join(root, 'node_modules/.package-lock.json'));
  assert.equal(sha(lockBytes), capture.records.find(row => row.file === 'package-lock.json').rawSHA256);
  const lock = JSON.parse(lockBytes), hidden = JSON.parse(hiddenBytes);
  assert.equal(hidden.lockfileVersion, lock.lockfileVersion);
  const locked = Object.keys(lock.packages).filter(file => file.startsWith('node_modules/')).sort();
  const installed = Object.keys(hidden.packages).sort(); assert(installed.every(file => locked.includes(file)));
  const physical = physicalPackages(root, lock, hidden, refs.bundles, P);
  const packages = installed.map(location => {
    const expected = lock.packages[location], actual = hidden.packages[location], pkg = physical.documents.get(location);
    for (const key of ['version', 'resolved', 'integrity']) assert.equal(actual[key] ?? null, expected[key] ?? null, location + ':' + key);
    return { path: location, version: actual.version ?? null, resolved: actual.resolved ?? null, integrity: actual.integrity ?? null,
      packageJson: { bytes: pkg.bytes.length, sha256: sha(pkg.bytes) }, bin: pkg.bin };
  });
  const notInstalledLockedPackages = locked.filter(file => !installed.includes(file));
  const packageJson = JSON.parse(regular(path.join(root, 'package.json')));
  for (const kind of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    assert.deepEqual(packageJson[kind] ?? {}, lock.packages[''][kind] ?? {});
    for (const name of Object.keys(packageJson[kind] ?? {})) {
      if (kind === 'optionalDependencies' && notInstalledLockedPackages.includes('node_modules/' + name)) continue;
      assert(installed.includes('node_modules/' + name));
    }
  }
  return { phase: 'SOURCE_ONLY_UNAPPROVED_DEPENDENCY_CAPTURE', source: side.source, tree: side.tree, nodeVersion: process.version,
    platform: B.platform, arch: B.arch, nodeModulesRealPath: path.join(root, 'node_modules'), sourceLockSha256: sha(lockBytes),
    installedLockSha256: sha(hiddenBytes), installedLockBytes: hiddenBytes.length, physicalPackageLocations: physical.locations,
    packages, notInstalledLockedPackages, driver: capture.driver, embeddedBundles: physical.embeddedBundles,
    binDirectories: physical.binDirectories, binLinks: physical.binLinks,
    limitation: 'Membership, lock metadata, package.json, bin-link identity, 139 approved driver files and exact published embedded subtrees; observed bin hashes establish stability only, with no integrity claim for arbitrary dependency bytes.' };
}

export async function captureHostedSourcePair(input) {
  const P = await primitives(), { assert, fs, path, directory, outside, readRef, put, descriptor } = P;
  const B = readRef(input.binding); assert.equal(B.schema, 'omerta.hosted-source-pair-binding.v1');
  assert.deepEqual(Object.keys(B.sides).sort(), ['candidate', 'predecessor']);
  const observedRuntime = runtime(B, P), refs = references(P), out = input.outputDirectory;
  assert(path.isAbsolute(out) && path.resolve(out) === out && !fs.existsSync(out)); directory(path.dirname(out));
  assert(outside(P.here, out));
  for (const side of Object.values(B.sides)) { directory(side.directory); assert(outside(side.directory, out)); }
  assert(outside(B.sides.candidate.directory, B.sides.predecessor.directory));
  assert(outside(B.sides.predecessor.directory, B.sides.candidate.directory));
  fs.mkdirSync(out, { mode: 0o700 });
  const result = { phase: 'SOURCE_ONLY_UNAPPROVED_INCOMPLETE', binding: input.binding, outputDirectory: out,
    startedAt: new Date().toISOString(), runtime: observedRuntime, complete: false, checkpoints: [], sides: {} };
  function measure(phase, action) {
    const start = process.hrtime.bigint(); let outcome = 'THREW';
    result.checkpoints.push({ phase, event: 'START', at: new Date().toISOString() });
    try { const value = action(); outcome = 'RETURNED'; return value; }
    finally { result.checkpoints.push({ phase, event: 'END', at: new Date().toISOString(), outcome, durationMs: Number(process.hrtime.bigint() - start) / 1e6 }); }
  }
  try {
    for (const name of ['candidate', 'predecessor']) {
      const side = B.sides[name], folder = path.join(out, name); fs.mkdirSync(folder, { mode: 0o700 });
      const env = childEnvironment(B, folder, P), source = sourceTools(B, side, env, P);
      const before = measure(name + '.fullBefore', () => source.capture(refs));
      const beforeRef = put(folder, 'full-capture.raw.json', before);
      const depsBefore = measure(name + '.depsBefore', () => dependencies(B, side, before, refs, P));
      const depsBeforeRef = put(folder, 'dependencies-before.raw.json', depsBefore);
      const args = ['ls', '--all', '--json', '--offline', '--ignore-scripts'];
      const npm = measure(name + '.npm', () => P.cp.spawnSync(B.runtime.node.path, [B.runtime.npmCli.path, ...args],
        { cwd: side.directory, env, maxBuffer: 64 * 1024 * 1024, timeout: 120000 }));
      fs.writeFileSync(path.join(folder, 'npm-ls.stdout.json'), Buffer.from(npm.stdout ?? ''), { flag: 'wx', mode: 0o600 });
      fs.writeFileSync(path.join(folder, 'npm-ls.stderr.log'), Buffer.from(npm.stderr ?? ''), { flag: 'wx', mode: 0o600 });
      const npmLs = { command: [B.runtime.node.path, B.runtime.npmCli.path, ...args], arguments: args,
        result: { code: npm.status, signal: npm.signal, error: npm.error ? { code: npm.error.code ?? null, message: npm.error.message } : null },
        stdout: descriptor(path.join(folder, 'npm-ls.stdout.json')), stderr: descriptor(path.join(folder, 'npm-ls.stderr.log')) };
      put(folder, 'npm-ls.result.json', npmLs);
      const after = measure(name + '.fullAfter', () => source.capture(refs));
      const afterRef = put(folder, 'full-capture-after.raw.json', after);
      const depsAfter = measure(name + '.depsAfter', () => dependencies(B, side, after, refs, P));
      const depsAfterRef = put(folder, 'dependency-capture.raw.json', depsAfter);
      assert.deepEqual(after, before); assert.deepEqual(depsAfter, depsBefore);
      assert.equal(npm.status, 0); assert.equal(npm.signal, null); assert(!npm.error);
      assert.deepEqual(JSON.parse(npm.stdout).problems ?? [], []);
      result.sides[name] = { fullBefore: beforeRef, fullAfter: afterRef, depsBefore: depsBeforeRef, depsAfter: depsAfterRef, npmLs,
        schema: before.records.find(row => row.file === 'schema.sql'), lock: before.records.find(row => row.file === 'package-lock.json'),
        appVersion: JSON.parse(P.regular(path.join(side.directory, 'package.json'))).version };
    }
    assert.deepEqual(runtime(B, P), observedRuntime);
    result.phase = 'SOURCE_ONLY_UNAPPROVED_COMPLETE'; result.complete = true;
  } catch (error) { result.failure = { code: error.code ?? null, message: error.message }; }
  finally {
    result.finishedAt = new Date().toISOString(); put(out, 'collection-result.json', result);
    const files = [], directories = [];
    function inventory(folder, prefix = '') {
      for (const name of fs.readdirSync(directory(folder)).sort()) {
        const full = path.join(folder, name), stat = fs.lstatSync(full); assert(!stat.isSymbolicLink());
        if (stat.isDirectory()) { directories.push(prefix + name); inventory(full, prefix + name + '/'); }
        else { assert(stat.isFile()); const ref = descriptor(full); files.push({ file: prefix + name, bytes: ref.bytes, sha256: ref.sha256 }); }
      }
    }
    inventory(out); put(out, 'sha256-index.json', { phase: 'SOURCE_ONLY_UNAPPROVED_OUTPUT_INDEX', files, directories });
  }
  return { ...descriptor(path.join(out, 'collection-result.json')), index: descriptor(path.join(out, 'sha256-index.json')),
    binding: input.binding, complete: result.complete, phase: result.phase };
}

export async function verifyHostedSourcePairCapture(capture) {
  const P = await primitives(), { assert, readRef, sha, regular, path, fs, directory } = P;
  const result = readRef(capture), B = readRef(capture.binding), index = readRef(capture.index);
  assert.deepEqual(result.binding, capture.binding); assert.equal(result.outputDirectory, path.dirname(capture.path));
  assert.equal(capture.index.path, path.join(result.outputDirectory, 'sha256-index.json'));
  assert.equal(result.phase, 'SOURCE_ONLY_UNAPPROVED_COMPLETE'); assert.equal(result.complete, true);
  const actualFiles = [], actualDirectories = [];
  function inventory(folder, prefix = '') {
    for (const name of fs.readdirSync(directory(folder)).sort()) {
      const full = path.join(folder, name), stat = fs.lstatSync(full); assert(!stat.isSymbolicLink());
      if (stat.isDirectory()) { actualDirectories.push(prefix + name); inventory(full, prefix + name + '/'); }
      else { assert(stat.isFile()); if (full !== capture.index.path) { const bytes = regular(full); actualFiles.push({ file: prefix + name, bytes: bytes.length, sha256: sha(bytes) }); } }
    }
  }
  inventory(result.outputDirectory); assert.deepEqual(actualFiles, index.files); assert.deepEqual(actualDirectories, index.directories);
  assert.equal(B.schema, 'omerta.hosted-source-pair-binding.v1');
  assert(B.independentApproval && B.independentApproval.driverReferenceSHA256 === DRIVER_SHA);
  const approval = readRef(B.independentApproval.receipt);
  assert.equal(approval.phase, 'INDEPENDENTLY_REVIEWED_HOSTED_SOURCE_PAIR_INPUTS');
  assert.equal(approval.runtimeNodeSHA256, B.runtime.node.sha256);
  assert.equal(approval.driverReferenceSHA256, DRIVER_SHA);
  const receipt = { phase: 'VERIFIED_HOSTED_SOURCE_PAIR_CAPTURE', capture, runtime: result.runtime,
    independentApproval: B.independentApproval.receipt, limitation: 'Byte checks do not create review authority; approval provenance is the caller and coordinator responsibility.' };
  assert.deepEqual(result.runtime.node, { path: B.runtime.node.path, bytes: result.runtime.node.bytes, sha256: B.runtime.node.sha256, version: B.runtime.node.version });
  assert.equal(result.runtime.git.sha256, B.runtime.git.sha256); assert.equal(result.runtime.npmCli.sha256, B.runtime.npmCli.sha256);
  assert.equal(result.runtime.platform, B.platform); assert.equal(result.runtime.arch, B.arch);
  // Independently derive expected source records from pinned Git objects. The
  // observed checkout records never become their own expected raw-byte oracle.
  function gitExpected(side) {
    const env = { PATH: B.runtime.path, HOME: result.outputDirectory, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8',
      GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_OPTIONAL_LOCKS: '0' };
    assert.equal(sha(regular(B.runtime.git.path)), B.runtime.git.sha256);
    const run = (args, input) => P.cp.execFileSync(B.runtime.git.path, ['--no-replace-objects', '--no-optional-locks', '-c', 'core.fsmonitor=false', ...args],
      { cwd: side.directory, env, input, maxBuffer: 256 * 1024 * 1024, timeout: 120000 });
    assert.equal(run(['rev-parse', side.source + '^{tree}']).toString('utf8').trim(), side.tree);
    const treeBytes = run(['ls-tree', '-rz', '--full-tree', side.source]), treeText = treeBytes.toString('utf8');
    assert(Buffer.from(treeText).equals(treeBytes));
    const entries = treeText.split('\0').filter(Boolean).map(row => {
      const at = row.indexOf('\t'), [mode, type, blob] = row.slice(0, at).split(' '), file = row.slice(at + 1);
      assert(type === 'blob' && ['100644', '100755'].includes(mode)); P.relative(file); return { file, mode, blob };
    });
    const requests = entries.map(row => row.blob + '\n').join('');
    const sizes = run(['cat-file', '--batch-check'], requests).toString('ascii').trimEnd().split('\n');
    assert.equal(sizes.length, entries.length);
    const groups = []; let group = [], groupBytes = 0;
    for (const [index, row] of sizes.entries()) {
      const [oid, type, size] = row.split(' '), bytes = Number(size);
      assert.equal(oid, entries[index].blob); assert.equal(type, 'blob');
      assert(Number.isSafeInteger(bytes) && bytes >= 0 && bytes <= 128 * 1024 * 1024);
      if (group.length && groupBytes + bytes > 128 * 1024 * 1024) { groups.push(group); group = []; groupBytes = 0; }
      group.push({ ...entries[index], expectedBytes: bytes }); groupBytes += bytes;
    }
    if (group.length) groups.push(group);
    const records = [];
    for (const entries of groups) {
      const batch = run(['cat-file', '--batch'], entries.map(row => row.blob + '\n').join('')); let cursor = 0;
      for (const { expectedBytes, ...entry } of entries) {
      const newline = batch.indexOf(10, cursor); assert(newline >= cursor);
      const [oid, type, size] = batch.subarray(cursor, newline).toString('ascii').split(' '), bytes = Number(size);
      assert.equal(oid, entry.blob); assert.equal(type, 'blob'); assert(Number.isSafeInteger(bytes) && bytes >= 0);
      assert.equal(bytes, expectedBytes);
      cursor = newline + 1; const raw = batch.subarray(cursor, cursor + bytes); assert.equal(raw.length, bytes);
      cursor += bytes; assert.equal(batch[cursor++], 10); assert.equal(P.blob(raw), entry.blob);
      const text = Buffer.from(raw.toString('utf8')).equals(raw) && !raw.includes(0) && !raw.includes(13);
      records.push({ ...entry, gitBytes: bytes, gitSHA256: sha(raw), rawBytes: bytes,
        rawMode: parseInt(entry.mode, 8), rawSHA256: sha(raw), representation: text ? 'exactGit' : 'opaqueExactGit', text });
      }
      assert.equal(cursor, batch.length);
    }
    return records;
  }
  for (const name of ['candidate', 'predecessor']) {
    const side = B.sides[name], actual = result.sides[name]; assert(actual && side.expectedDependencies && side.expectedSchema);
    for (const [key, file] of [['fullBefore', 'full-capture.raw.json'], ['fullAfter', 'full-capture-after.raw.json'],
      ['depsBefore', 'dependencies-before.raw.json'], ['depsAfter', 'dependency-capture.raw.json']])
      assert.equal(actual[key].path, path.join(result.outputDirectory, name, file));
    assert.equal(actual.npmLs.stdout.path, path.join(result.outputDirectory, name, 'npm-ls.stdout.json'));
    assert.equal(actual.npmLs.stderr.path, path.join(result.outputDirectory, name, 'npm-ls.stderr.log'));
    assert.deepEqual(approval.sides[name], { source: side.source, tree: side.tree, schema: side.expectedSchema, expectedDependencies: side.expectedDependencies });
    const full = readRef(actual.fullBefore), after = readRef(actual.fullAfter), deps = readRef(actual.depsBefore), depsAfter = readRef(actual.depsAfter);
    assert.deepEqual(full, after); assert.deepEqual(deps, depsAfter);
    assert.equal(full.source, side.source); assert.equal(full.tree, side.tree); assert.equal(full.directory, side.directory);
    assert.equal(full.nodeVersion, B.runtime.node.version);
    assert.deepEqual(full.records, gitExpected(side), 'Capture must equal independent immutable Git object records');
    assert.deepEqual(full.indexFlags, full.records.map(row => 'H ' + row.file));
    assert.equal(full.binaryExact, full.records.filter(row => !row.text).length);
    assert.equal(full.trackedCount, full.records.length); assert.equal(full.driver.length, 139);
    assert.deepEqual(full.driver, references(P).driver.files);
    const schema = full.records.find(row => row.file === 'schema.sql');
    for (const key of ['blob', 'rawSHA256', 'rawBytes', 'mode']) assert.equal(schema[key], side.expectedSchema[key], 'Independently pinned side schema: ' + name + ':' + key);
    assert.deepEqual(actual.schema, schema); assert.deepEqual(actual.lock, full.records.find(row => row.file === 'package-lock.json'));
    const expected = readRef(side.expectedDependencies);
    assert.equal(expected.phase, 'INDEPENDENT_EXPECTED_DEPENDENCY_INVENTORY');
    assert.equal(expected.origin, 'COMMITTED_LOCK_AND_SRI_VERIFIED_PUBLISHED_TARBALLS');
    assert.equal(expected.sourceLockSha256, deps.sourceLockSha256);
    assert.equal(expected.platform, B.platform); assert.equal(expected.arch, B.arch); assert.equal(expected.nodeVersion, B.runtime.node.version);
    for (const key of ['physicalPackageLocations', 'packages', 'notInstalledLockedPackages', 'binDirectories'])
      assert.deepEqual(deps[key], expected[key], 'Independent dependency inventory: ' + name + ':' + key);
    assert.deepEqual(deps.binLinks.map(({ path, target, packagePath, packageFile }) => ({ path, target, packagePath, packageFile })),
      expected.binLinks, 'Independent bin-link identity inventory: ' + name);
    assert.equal(deps.sourceLockSha256, actual.lock.rawSHA256);
    assert.equal(actual.npmLs.result.code, 0); assert.equal(actual.npmLs.result.signal, null); assert.equal(actual.npmLs.result.error, null);
    assert.deepEqual(readRef(actual.npmLs.stdout).problems ?? [], []);
    const stderr = regular(actual.npmLs.stderr.path); assert.equal(stderr.length, actual.npmLs.stderr.bytes); assert.equal(sha(stderr), actual.npmLs.stderr.sha256);
    const expectedApp = full.records.find(row => row.file === 'package.json'); assert(expectedApp);
    const currentAppBytes = regular(P.insideRegular(side.directory, 'package.json'));
    assert.equal(sha(currentAppBytes), expectedApp.rawSHA256); assert.equal(actual.appVersion, JSON.parse(currentAppBytes).version);
    receipt[name] = { source: side.source, tree: side.tree, rawFilesVerified: full.trackedCount, driverFilesVerified: 139,
      dependencyPackagesVerified: deps.packages.length, fullCapture: actual.fullBefore, dependencyCapture: actual.depsBefore,
      schema: actual.schema, lock: actual.lock, appVersion: actual.appVersion };
  }
  receipt.checkedAt = new Date().toISOString(); return receipt;
}

export function verifyStrictSameSchema(receipt) {
  if (receipt?.phase !== 'VERIFIED_HOSTED_SOURCE_PAIR_CAPTURE') throw new Error('Verified source-pair receipt required');
  for (const field of ['schema', 'lock']) for (const key of ['blob', 'rawSHA256', 'gitSHA256']) {
    if (receipt.candidate[field][key] !== receipt.predecessor[field][key]) throw new Error('Strict GUI same-' + field + ' mismatch: ' + key);
  }
  if (receipt.candidate.appVersion !== receipt.predecessor.appVersion) throw new Error('Strict GUI appVersion mismatch');
  return { ...receipt, strictSameSchema: true, strictSameLock: true, strictSameAppVersion: true };
}
