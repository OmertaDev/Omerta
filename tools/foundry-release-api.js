// Exact official Foundry v1.7.1 API transport with cryptographic verification before Linux CI publication.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const POLICY = freeze({
  version: 'v1.7.1', repo: 'foundry-rs/foundry', repoId: '404320053', ownerId: '99892494',
  ref: 'refs/tags/v1.7.1', commit: '4072e48705af9d93e3c0f6e29e93b5e9a40caed8',
  identity: 'https://github.com/foundry-rs/foundry/.github/workflows/release.yml@refs/tags/v1.7.1',
  issuer: 'https://token.actions.githubusercontent.com', predicate: 'https://slsa.dev/provenance/v1',
  invocation: 'https://github.com/foundry-rs/foundry/actions/runs/25543860392/attempts/1',
  archive: { id: 415095756, name: 'foundry_v1.7.1_linux_amd64.tar.gz', bytes: 98596412,
    sha256: 'cf7e688ed0c4c48adffca788b496076e31060b67ac5afe1e43dbb5499c20c88b' },
  pointer: { id: 415095753, name: 'foundry_v1.7.1_linux_amd64.attestation.txt', bytes: 60,
    sha256: 'c02be634804dc59dd1e2d27bb0be89dbe65e60a41e00598621db60f64819d052',
    url: 'https://github.com/foundry-rs/foundry/attestations/26850510' },
  expandedBytes: 233564160,
  binaries: {
    forge: { bytes: 84666760, sha256: '4f77da0810de94325734855d0ad58d70640aa8a5b2a837608ddf8c26da34355c' },
    cast: { bytes: 62663216, sha256: 'ccd95a4607ca3ebfcb88bb90e7235cdb7f0564f5f1afa17478d5fccabbb222cb' },
    anvil: { bytes: 44330832, sha256: '10c1c727d6c1de973aeb160e59875b9a9a23464d6e74149ee8abb30b3500311b' },
    chisel: { bytes: 41893784, sha256: 'a338965386e29b0f76122053031340128a6aca4ef1bbc1ed764b82d2b2ea269d' },
  },
});
export const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const requireThat = (value, code) => { if (!value) throw Object.assign(new Error(code), { safeCode: code }); };
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
export function assertBytes(bytes, expected) {
  requireThat(Buffer.isBuffer(bytes) && bytes.length === expected.bytes && sha(bytes) === expected.sha256, 'integrity_mismatch');
}
export function verificationArgs(file, bundle) {
  // --cert-identity and --signer-workflow are mutually exclusive in gh. The exact SAN binds both workflow and tag.
  return ['attestation', 'verify', file, '--hostname', 'github.com', '--repo', POLICY.repo, '--bundle', bundle,
    '--cert-identity', POLICY.identity, '--cert-oidc-issuer', POLICY.issuer,
    '--predicate-type', POLICY.predicate, '--source-ref', POLICY.ref,
    '--source-digest', POLICY.commit, '--signer-digest', POLICY.commit, '--format', 'json'];
}
export function assertSubjects(statement) {
  requireThat(statement?.predicateType === POLICY.predicate && Array.isArray(statement.subject), 'predicate_mismatch');
  const expected = { ...POLICY.binaries, [POLICY.archive.name]: POLICY.archive };
  requireThat(statement.subject.length === 5 && new Set(statement.subject.map(row => row.name)).size === 5, 'subject_set_mismatch');
  for (const subject of statement.subject) requireThat(Object.hasOwn(expected, subject.name)
    && equal(Object.keys(subject.digest || {}), ['sha256']) && subject.digest.sha256 === expected[subject.name].sha256, 'subject_digest_mismatch');
}
export function selectBundle(api) {
  requireThat(Array.isArray(api?.attestations) && api.attestations.length <= 30, 'attestation_response_malformed');
  const selected = api.attestations.filter(row => {
    try { const statement = JSON.parse(Buffer.from(row.bundle.dsseEnvelope.payload, 'base64').toString('utf8'));
      if (statement.predicateType !== POLICY.predicate) return false;
      assertSubjects(statement); return true;
    } catch { return false; }
  });
  requireThat(selected.length === 1, 'attestation_missing_or_ambiguous');
  requireThat(String(selected[0].repository_id) === POLICY.repoId, 'attestation_origin_mismatch');
  // bundle_url is an opaque, expiring transport locator. It is neither followed nor used as identity.
  // These API fields select a candidate only. Nothing is trusted until real gh cryptographic verification below.
  return selected[0].bundle;
}
export function assertVerification(rows, subjectName) {
  requireThat(Array.isArray(rows) && rows.length === 1, 'verified_result_ambiguous');
  const result = rows[0]?.verificationResult, cert = result?.signature?.certificate;
  const claims = {
    subjectAlternativeName: POLICY.identity, issuer: POLICY.issuer,
    buildSignerURI: POLICY.identity, buildSignerDigest: POLICY.commit,
    sourceRepositoryURI: 'https://github.com/' + POLICY.repo, sourceRepositoryDigest: POLICY.commit,
    sourceRepositoryRef: POLICY.ref, sourceRepositoryIdentifier: POLICY.repoId,
    sourceRepositoryOwnerURI: 'https://github.com/foundry-rs', sourceRepositoryOwnerIdentifier: POLICY.ownerId,
    buildConfigURI: POLICY.identity, buildConfigDigest: POLICY.commit,
    githubWorkflowRepository: POLICY.repo, githubWorkflowSHA: POLICY.commit, githubWorkflowRef: POLICY.ref,
    runInvocationURI: POLICY.invocation, runnerEnvironment: 'self-hosted',
  };
  for (const [key, value] of Object.entries(claims)) requireThat(cert?.[key] === value, 'verified_certificate_claim_mismatch');
  requireThat(result.verifiedTimestamps?.some(row => row.type === 'Tlog' && row.uri === 'https://rekor.sigstore.dev'), 'verified_transparency_time_missing');
  assertSubjects(result.statement);
  requireThat(result.statement.subject.some(row => row.name === subjectName), 'verified_subject_missing');
  // Do not require a currently unexpired leaf: gh verifies validity at the trusted signing timestamp.
  return true;
}
let deadline = Infinity;
function gh(args, { maxBytes, timeout = 60000 }) {
  const remaining = Math.min(timeout, deadline - Date.now()); requireThat(remaining > 0, 'bootstrap_deadline');
  const child = spawnSync('gh', args, { windowsHide: true, timeout: remaining, maxBuffer: maxBytes,
    stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, GH_DEBUG: '', GH_PROMPT_DISABLED: '1' } });
  requireThat(!child.error && child.status === 0 && child.stdout?.length <= maxBytes, 'github_cli_failed');
  return child.stdout;
}
function api(endpoint, { maxBytes = 1024 * 1024, binary = false, timeout } = {}) {
  requireThat(/^repos\/foundry-rs\/foundry(?:\/|$)/.test(endpoint) && !/[\r\n\0]/.test(endpoint), 'api_endpoint_denied');
  return gh(['api', '--hostname', 'github.com', '-H', 'Accept: ' + (binary ? 'application/octet-stream' : 'application/vnd.github+json'),
    '-H', 'X-GitHub-Api-Version: 2022-11-28', endpoint], { maxBytes, timeout });
}
export function verifyArtifact(file, bundleFile, subjectName) {
  const expected = subjectName === POLICY.archive.name ? POLICY.archive : POLICY.binaries[subjectName];
  requireThat(expected, 'artifact_subject_denied');
  const stat = fs.lstatSync(file); requireThat(stat.isFile() && !stat.isSymbolicLink() && stat.size === expected.bytes, 'artifact_not_regular');
  const bundleStat = fs.lstatSync(bundleFile); requireThat(bundleStat.isFile() && !bundleStat.isSymbolicLink()
    && bundleStat.size > 0 && bundleStat.size <= 128 * 1024, 'bundle_not_regular_or_bounded');
  assertBytes(fs.readFileSync(file), expected);
  const output = gh(verificationArgs(file, bundleFile), { maxBytes: 2 * 1024 * 1024, timeout: 90000 });
  const verified = JSON.parse(output); assertVerification(verified, subjectName);
  return verified;
}

// Generic pure parser for small adversarial fixtures; the bootstrap always supplies the frozen real POLICY.
export function parseTar(tar, members = POLICY.binaries) {
  requireThat(Buffer.isBuffer(tar) && tar.length % 512 === 0 && tar.length <= POLICY.expandedBytes, 'tar_size_malformed');
  const result = new Map(); let offset = 0, ended = false;
  const octal = buffer => {
    requireThat(buffer.every(byte => byte === 0 || byte === 32 || (byte >= 48 && byte <= 55)), 'tar_number_malformed');
    const nul = buffer.indexOf(0); if (nul >= 0) requireThat(buffer.subarray(nul).every(byte => byte === 0 || byte === 32), 'tar_number_malformed');
    const text = buffer.toString('ascii').replace(/\0.*$/, '').trim();
    requireThat(/^[0-7]+$/.test(text), 'tar_number_malformed'); const n = parseInt(text, 8); requireThat(Number.isSafeInteger(n), 'tar_number_overflow'); return n; };
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) {
      requireThat(offset + 1024 <= tar.length && tar.subarray(offset).every(byte => byte === 0), 'tar_end_malformed'); ended = true; break;
    }
    const check = octal(header.subarray(148, 156)); let checksum = 0;
    for (let i = 0; i < 512; i++) checksum += i >= 148 && i < 156 ? 32 : header[i];
    requireThat(checksum === check, 'tar_checksum_mismatch');
    const nameField = header.subarray(0, 100), nul = nameField.indexOf(0);
    requireThat(nul > 0 && nameField.subarray(nul).every(byte => byte === 0), 'tar_name_malformed');
    requireThat(nameField.subarray(0, nul).every(byte => byte >= 97 && byte <= 122), 'tar_name_denied');
    const name = nameField.subarray(0, nul).toString('ascii');
    requireThat(Object.hasOwn(members, name) && /^[a-z]+$/.test(name) && !result.has(name), 'tar_name_denied');
    requireThat(header[156] === 48 || header[156] === 0, 'tar_type_denied');
    requireThat(header.subarray(157, 257).every(byte => byte === 0) && header.subarray(345, 500).every(byte => byte === 0), 'tar_link_or_prefix_denied');
    requireThat([Buffer.from('ustar\0'), Buffer.from('ustar ')].some(magic => header.subarray(257, 263).equals(magic)), 'tar_format_denied');
    requireThat((octal(header.subarray(100, 108)) & 0o7000) === 0, 'tar_special_permissions_denied');
    const size = octal(header.subarray(124, 136)); requireThat(size === members[name].bytes, 'tar_member_size_mismatch');
    const start = offset + 512, end = start + size; requireThat(end <= tar.length, 'tar_truncated');
    const next = start + Math.ceil(size / 512) * 512;
    requireThat(next <= tar.length && tar.subarray(end, next).every(byte => byte === 0), 'tar_member_padding_malformed');
    result.set(name, tar.subarray(start, end)); offset = next;
  }
  requireThat(ended && result.size === 4 && Object.keys(members).every(name => result.has(name)), 'tar_member_set_mismatch');
  return result;
}
export function assertElf(bytes) {
  requireThat(bytes.length >= 64 && bytes.subarray(0, 4).equals(Buffer.from([127, 69, 76, 70]))
    && bytes[4] === 2 && bytes[5] === 1 && bytes[6] === 1 && [0, 3].includes(bytes[7]) && bytes.readUInt16LE(18) === 62
    && [2, 3].includes(bytes.readUInt16LE(16)), 'elf_linux_amd64_required');
}
export function assertCI(platform = process.platform, arch = process.arch, env = process.env) {
  requireThat(platform === 'linux' && arch === 'x64' && env.GITHUB_ACTIONS === 'true'
    && env.RUNNER_OS === 'Linux' && env.RUNNER_ARCH === 'X64', 'linux_github_ci_only');
}
export function validateMetadata(repo, tag, release) {
  requireThat(String(repo.id) === POLICY.repoId && repo.full_name === POLICY.repo && String(repo.owner?.id) === POLICY.ownerId, 'repository_identity_mismatch');
  requireThat(tag.ref === POLICY.ref && tag.object?.type === 'commit' && tag.object.sha === POLICY.commit, 'tag_commit_mismatch');
  requireThat(release.tag_name === POLICY.version && release.immutable === true && release.draft === false && release.prerelease === false, 'release_identity_mismatch');
  for (const expected of [POLICY.archive, POLICY.pointer]) {
    const asset = release.assets?.filter(row => row.id === expected.id);
    requireThat(asset?.length === 1 && asset[0].name === expected.name && asset[0].size === expected.bytes
      && asset[0].digest === 'sha256:' + expected.sha256, 'release_asset_mismatch');
  }
}
const receipts = new WeakMap();
export function prepareVerifiedToolchain(staging, archiveFile, bundleFile) {
  const stageStat = fs.lstatSync(staging);
  requireThat(stageStat.isDirectory() && !stageStat.isSymbolicLink(), 'quarantine_directory_unsafe');
  const bin = path.join(fs.realpathSync(staging), 'bin'); requireThat(!fs.existsSync(bin), 'quarantine_directory_not_fresh');
  const archiveProof = verifyArtifact(archiveFile, bundleFile, POLICY.archive.name); // Signature verification precedes decompression/extraction.
  const archive = fs.readFileSync(archiveFile); assertBytes(archive, POLICY.archive);
  const tar = zlib.gunzipSync(archive, { maxOutputLength: POLICY.expandedBytes });
  requireThat(tar.length === POLICY.expandedBytes, 'expanded_archive_mismatch');
  const entries = parseTar(tar); fs.mkdirSync(bin, { mode: 0o700 });
  for (const [name, bytes] of entries) {
    assertBytes(bytes, POLICY.binaries[name]); assertElf(bytes);
    fs.writeFileSync(path.join(bin, name), bytes, { flag: 'wx', mode: 0o600 }); // No archive owner/mode metadata is restored.
  }
  const verifications = [], evidence = [{ subjectName: POLICY.archive.name, rows: archiveProof }];
  for (const name of Object.keys(POLICY.binaries)) {
    const rows = verifyArtifact(path.join(bin, name), bundleFile, name); verifications.push(name); evidence.push({ subjectName: name, rows });
  }
  const records = Object.fromEntries(Object.keys(POLICY.binaries).map(name => [name, fs.lstatSync(path.join(bin, name), { bigint: true })]));
  const receipt = Object.freeze({ bin, version: POLICY.version, verifiedNames: Object.freeze(verifications), evidence: freeze(evidence) });
  receipts.set(receipt, { records, directory: fs.lstatSync(bin, { bigint: true }), realPath: fs.realpathSync(bin) });
  assertPublicationReady(receipt); return receipt;
}
export function assertPublicationReady(receipt) {
  const proof = receipts.get(receipt); requireThat(proof, 'fresh_verification_receipt_required');
  requireThat(equal(fs.readdirSync(receipt.bin).sort(), Object.keys(POLICY.binaries).sort()), 'published_member_set_mismatch');
  const directory = fs.lstatSync(receipt.bin, { bigint: true });
  requireThat(directory.isDirectory() && !directory.isSymbolicLink() && directory.dev === proof.directory.dev
    && directory.ino === proof.directory.ino && fs.realpathSync(receipt.bin) === proof.realPath, 'quarantine_directory_changed');
  for (const name of Object.keys(POLICY.binaries)) {
    const file = path.join(receipt.bin, name), stat = fs.lstatSync(file, { bigint: true }), before = proof.records[name];
    requireThat(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1n && stat.dev === before.dev && stat.ino === before.ino
      && stat.size === BigInt(POLICY.binaries[name].bytes), 'verified_file_identity_changed');
    assertBytes(fs.readFileSync(file), POLICY.binaries[name]);
  }
  return receipt.bin;
}
export function publishToolchain(receipt) {
  assertCI(); // This cannot be bypassed with an input/environment platform field on Windows.
  const bin = assertPublicationReady(receipt), proof = receipts.get(receipt);
  const temporaryRoot = fs.realpathSync(process.env.RUNNER_TEMP || '');
  const githubPath = process.env.GITHUB_PATH;
  requireThat(typeof githubPath === 'string' && path.isAbsolute(githubPath) && !/[\r\n\0]/.test(githubPath), 'github_path_missing');
  const pathStat = fs.lstatSync(githubPath, { bigint: true });
  requireThat(pathStat.isFile() && !pathStat.isSymbolicLink() && pathStat.uid === BigInt(process.getuid())
    && (Number(pathStat.mode) & 0o022) === 0 && fs.realpathSync(githubPath).startsWith(temporaryRoot + path.sep), 'github_path_unsafe');
  const files = [], flags = fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW;
  const command = fs.openSync(githubPath, fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_NOFOLLOW);
  try {
    const current = fs.fstatSync(command, { bigint: true });
    requireThat(current.isFile() && current.dev === pathStat.dev && current.ino === pathStat.ino, 'github_path_changed');
    for (const name of Object.keys(POLICY.binaries)) {
      const fd = fs.openSync(path.join(bin, name), flags); files.push({ name, fd });
      const stat = fs.fstatSync(fd, { bigint: true }), before = proof.records[name];
      requireThat(stat.isFile() && stat.nlink === 1n && stat.uid === BigInt(process.getuid()) && stat.size === BigInt(POLICY.binaries[name].bytes)
        && stat.dev === before.dev && stat.ino === before.ino, 'verified_file_identity_changed');
      assertBytes(fs.readFileSync(fd), POLICY.binaries[name]);
    }
    for (const { fd } of files) fs.fchmodSync(fd, 0o555);
    assertPublicationReady(receipt); // Recheck path identities and exact bytes before publication.
    fs.chmodSync(bin, 0o555);
    requireThat(Date.now() < deadline, 'bootstrap_deadline');
    const line = Buffer.from(bin + '\n');
    requireThat(fs.writeSync(command, line, 0, line.length) === line.length, 'github_path_short_write');
    receipts.delete(receipt);
  } finally { for (const { fd } of files) fs.closeSync(fd); fs.closeSync(command); }
}
export function bootstrap() {
  assertCI();
  deadline = Date.now() + 10 * 60 * 1000;
  const noControls = value => typeof value === 'string' && !/[\r\n\0]/.test(value);
  requireThat(noControls(process.env.RUNNER_TEMP) && path.isAbsolute(process.env.RUNNER_TEMP), 'runner_temp_missing');
  const temporaryRoot = fs.realpathSync(process.env.RUNNER_TEMP), tempStat = fs.lstatSync(process.env.RUNNER_TEMP);
  requireThat(tempStat.isDirectory() && !tempStat.isSymbolicLink() && temporaryRoot !== '/'
    && tempStat.uid === process.getuid() && (tempStat.mode & 0o022) === 0, 'runner_temp_unsafe');
  const githubPath = process.env.GITHUB_PATH;
  requireThat(noControls(githubPath) && path.isAbsolute(githubPath), 'github_path_missing');
  const pathStat = fs.lstatSync(githubPath), realPath = fs.realpathSync(githubPath);
  requireThat(pathStat.isFile() && !pathStat.isSymbolicLink() && pathStat.uid === process.getuid() && (pathStat.mode & 0o022) === 0
    && realPath.startsWith(temporaryRoot + path.sep), 'github_path_unsafe');
  const staging = fs.mkdtempSync(path.join(temporaryRoot, 'omerta-foundry-v1.7.1-')); fs.chmodSync(staging, 0o700);
  const repo = JSON.parse(api('repos/' + POLICY.repo).toString('utf8'));
  const tag = JSON.parse(api('repos/' + POLICY.repo + '/git/ref/tags/v1.7.1').toString('utf8'));
  const release = JSON.parse(api('repos/' + POLICY.repo + '/releases/tags/v1.7.1').toString('utf8'));
  validateMetadata(repo, tag, release);
  const pointer = api('repos/' + POLICY.repo + '/releases/assets/' + POLICY.pointer.id, { binary: true, maxBytes: 1024 });
  assertBytes(pointer, POLICY.pointer); requireThat(pointer.toString('utf8').trim() === POLICY.pointer.url, 'attestation_pointer_mismatch');
  const archive = api('repos/' + POLICY.repo + '/releases/assets/' + POLICY.archive.id,
    { binary: true, maxBytes: POLICY.archive.bytes + 1, timeout: 180000 }); assertBytes(archive, POLICY.archive);
  const archiveFile = path.join(staging, 'archive.tar.gz'); fs.writeFileSync(archiveFile, archive, { flag: 'wx', mode: 0o600 });
  const attestations = JSON.parse(api('repos/' + POLICY.repo + '/attestations/sha256:' + POLICY.archive.sha256,
    { maxBytes: 16 * 1024 * 1024 }).toString('utf8'));
  const bundleFile = path.join(staging, 'slsa.json'); fs.writeFileSync(bundleFile, JSON.stringify(selectBundle(attestations)), { flag: 'wx', mode: 0o600 });
  const receipt = prepareVerifiedToolchain(staging, archiveFile, bundleFile); publishToolchain(receipt);
  // No Foundry binary is executed by this bootstrap; the existing next CI version/build steps remain authoritative.
  console.log(JSON.stringify({ version: POLICY.version, sourceCommit: POLICY.commit, verifiedBinaries: 4, pathPublished: true }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { requireThat(process.argv.length === 3 && process.argv[2] === 'bootstrap', 'bootstrap_command_required'); bootstrap(); }
  catch (error) { console.error('Foundry API bootstrap failed closed: ' + (error.safeCode || 'bootstrap_failed')); process.exitCode = 1; }
}
