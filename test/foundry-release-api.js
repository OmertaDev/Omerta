// Offline policy/parser controls only. Unsigned mock claims are not cryptographic evidence.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { POLICY, parseTar, assertElf, assertBytes, assertCI, assertSubjects, selectBundle,
  assertVerification, verificationArgs, validateMetadata, assertPublicationReady } from '../tools/foundry-release-api.js';
const bootstrapFile = fileURLToPath(new URL('../tools/foundry-release-api.js', import.meta.url));
assert.equal(POLICY.version, 'v1.7.1');
assert.equal(POLICY.commit, '4072e48705af9d93e3c0f6e29e93b5e9a40caed8');
assert.equal(POLICY.archive.id, 415095756);
assert.equal(POLICY.archive.sha256, 'cf7e688ed0c4c48adffca788b496076e31060b67ac5afe1e43dbb5499c20c88b');
assert.equal(POLICY.pointer.sha256, 'c02be634804dc59dd1e2d27bb0be89dbe65e60a41e00598621db60f64819d052');
assert.deepEqual(Object.fromEntries(Object.entries(POLICY.binaries).map(([name,row])=>[name,row.sha256])), {
 forge:'4f77da0810de94325734855d0ad58d70640aa8a5b2a837608ddf8c26da34355c',
 cast:'ccd95a4607ca3ebfcb88bb90e7235cdb7f0564f5f1afa17478d5fccabbb222cb',
 anvil:'10c1c727d6c1de973aeb160e59875b9a9a23464d6e74149ee8abb30b3500311b',
 chisel:'a338965386e29b0f76122053031340128a6aca4ef1bbc1ed764b82d2b2ea269d',
});
// Deliberately unsigned fixtures exercise policy parsing only. Production calls real gh before trusting this shape.
const mockStatement = { predicateType:POLICY.predicate, subject:[...Object.entries(POLICY.binaries).map(([name,row])=>({name,digest:{sha256:row.sha256}})),{name:POLICY.archive.name,digest:{sha256:POLICY.archive.sha256}}] };
const mockBundle = { dsseEnvelope:{payload:Buffer.from(JSON.stringify(mockStatement)).toString('base64'),signatures:[]} };
const mockCertificate = {
 subjectAlternativeName:POLICY.identity,issuer:POLICY.issuer,buildSignerURI:POLICY.identity,buildSignerDigest:POLICY.commit,
 sourceRepositoryURI:'https://github.com/'+POLICY.repo,sourceRepositoryDigest:POLICY.commit,sourceRepositoryRef:POLICY.ref,
 sourceRepositoryIdentifier:POLICY.repoId,sourceRepositoryOwnerURI:'https://github.com/foundry-rs',sourceRepositoryOwnerIdentifier:POLICY.ownerId,
 buildConfigURI:POLICY.identity,buildConfigDigest:POLICY.commit,githubWorkflowRepository:POLICY.repo,
 githubWorkflowSHA:POLICY.commit,githubWorkflowRef:POLICY.ref,runInvocationURI:POLICY.invocation,runnerEnvironment:'self-hosted',
};
const fixtures = {
 'archive-attestations-api.json':{attestations:[
  {repository_id:Number(POLICY.repoId),bundle:{dsseEnvelope:{payload:Buffer.from(JSON.stringify({predicateType:'https://in-toto.io/attestation/release/v0.2'})).toString('base64')}}},
  {repository_id:Number(POLICY.repoId),bundle:{dsseEnvelope:{payload:Buffer.from(JSON.stringify({predicateType:'https://spdx.dev/Document/v2.3'})).toString('base64')}}},
  {repository_id:Number(POLICY.repoId),bundle_url:'https://opaque.invalid/expiring',bundle:mockBundle},
 ]},
 'archive-verified.json':[{verificationResult:{signature:{certificate:mockCertificate},verifiedTimestamps:[{type:'Tlog',uri:'https://rekor.sigstore.dev',timestamp:'2026-05-08T08:00:14Z'}],statement:mockStatement}}],
 'repository-identity.json':{id:Number(POLICY.repoId),full_name:POLICY.repo,owner:{id:Number(POLICY.ownerId)}},
 'tag-ref.json':{ref:POLICY.ref,object:{type:'commit',sha:POLICY.commit}},
 'release-metadata.json':{tag_name:POLICY.version,immutable:true,draft:false,prerelease:false,assets:[POLICY.archive,POLICY.pointer].map(row=>({id:row.id,name:row.name,size:row.bytes,digest:'sha256:'+row.sha256}))},
};
const json = name => { assert(Object.hasOwn(fixtures,name));return structuredClone(fixtures[name]); };
const payloads = { forge: Buffer.from('forge'), cast: Buffer.from('cast'), anvil: Buffer.from('anvil'), chisel: Buffer.from('chisel') };
const small = Object.fromEntries(Object.entries(payloads).map(([name, bytes]) => [name, { bytes: bytes.length }]));
function checksum(header) { header.fill(32, 148, 156); const sum = header.reduce((total, byte) => total + byte, 0);
  header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii'); }
function entry(name, bytes) {
  const header = Buffer.alloc(512); header.write(name, 0, 'ascii');
  for (const [offset, length, number] of [[100, 8, 0o755], [108, 8, 0], [116, 8, 0], [124, 12, bytes.length], [136, 12, 0]])
    header.write(number.toString(8).padStart(length - 1, '0') + '\0', offset, 'ascii');
  header[156] = 48; header.write('ustar\0', 257, 'ascii'); header.write('00', 263, 'ascii'); checksum(header);
  return Buffer.concat([header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512)]);
}
const tiny = Buffer.concat([...Object.entries(payloads).map(([name, data]) => entry(name, data)), Buffer.alloc(1024)]);
assert.deepEqual([...parseTar(tiny, small).keys()], Object.keys(payloads));
for (const [name, bytes] of parseTar(tiny, small)) assert(bytes.equals(payloads[name]));
let tarRefusals = 0;
const deniedTar = bytes => { assert.throws(() => parseTar(bytes, small), error => error.safeCode?.startsWith('tar_')); tarRefusals++; };
const changeHeader = (change, recalculate = true) => { const bytes = Buffer.from(tiny), header = bytes.subarray(0, 512); change(header);
  if (recalculate) checksum(header); return bytes; };
for (const name of ['../forge', '/forge', './forge', 'bin/forge', 'forge\\bad', 'forge/', 'C:forge', 'bash'])
  deniedTar(changeHeader(header => { header.fill(0, 0, 100); header.write(name, 0, 'ascii'); }));
for (const type of ['1', '2', '3', '4', '5', '6', '7', 'x', 'g', 'L', 'K', 'S']) deniedTar(changeHeader(header => { header[156] = type.charCodeAt(0); }));
deniedTar(Buffer.concat([entry('forge', payloads.forge), entry('forge', payloads.forge), entry('anvil', payloads.anvil), entry('chisel', payloads.chisel), Buffer.alloc(1024)]));
deniedTar(Buffer.concat([entry('forge', payloads.forge), entry('cast', payloads.cast), entry('anvil', payloads.anvil), Buffer.alloc(1024)]));
deniedTar(changeHeader(header => { header[0] |= 128; }));
deniedTar(changeHeader(header => { header[257] |= 128; }));
deniedTar(changeHeader(header => { header[124] |= 128; }));
deniedTar(changeHeader(header => { header[124] = 128; }));
deniedTar(changeHeader(header => { header[6] = 120; })); // Nonzero bytes after the name terminator.
deniedTar(changeHeader(header => { header.write('00007\0 5', 100, 'ascii'); }));
deniedTar(changeHeader(header => { header.write('0004755\0', 100, 'ascii'); }));
deniedTar(changeHeader(header => { header[345] = 46; }));
deniedTar(changeHeader(header => { header[157] = 47; }));
deniedTar(changeHeader(header => { header.write('00000000006\0', 124, 'ascii'); }));
deniedTar(changeHeader(header => { header[0] = 120; }, false));
deniedTar(changeHeader(header => { header.write('other\0', 257, 'ascii'); }));
deniedTar(tiny.subarray(0, tiny.length - 512));
deniedTar(tiny.subarray(0, tiny.length - 1));
const trailer = Buffer.concat([tiny, Buffer.alloc(512)]); trailer[trailer.length - 1] = 1; deniedTar(trailer);
const padding = Buffer.from(tiny); padding[512 + payloads.forge.length] = 1; deniedTar(padding);
const elf = Buffer.alloc(64); Buffer.from([127, 69, 76, 70, 2, 1, 1, 0]).copy(elf); elf.writeUInt16LE(3, 16); elf.writeUInt16LE(62, 18); assertElf(elf);
let elfRefusals = 0;
for (const [offset, value] of [[0, 0], [4, 1], [5, 2], [6, 0], [7, 9], [16, 1], [18, 183]]) {
  const changed = Buffer.from(elf); changed[offset] = value; assert.throws(() => assertElf(changed)); elfRefusals++;
}
assert.throws(() => assertElf(Buffer.alloc(32))); elfRefusals++;
assert.throws(() => assertBytes(Buffer.from('not an archive'), POLICY.archive));

const api = json('archive-attestations-api.json'), bundle = selectBundle(api);
const statement = JSON.parse(Buffer.from(bundle.dsseEnvelope.payload, 'base64').toString('utf8'));
assertSubjects(statement);
const slsa = api.attestations.find(row => row.bundle === bundle);
assert.equal(selectBundle({ attestations: [slsa, ...api.attestations.filter(row => row !== slsa)] }), bundle, 'Selection is independent of API array position.');
const opaque = structuredClone(slsa); opaque.bundle_url = 'https://opaque.invalid/expiring-locator'; assert(selectBundle({ attestations: [opaque] }));
let policyRefusals = 0;
for (const bad of [{ attestations: [] }, { attestations: [slsa, structuredClone(slsa)] },
  { attestations: [{ ...slsa, repository_id: '1' }] }, { attestations: [{ bundle: {} }] }]) {
  assert.throws(() => selectBundle(bad)); policyRefusals++;
}
const verified = json('archive-verified.json'); assertVerification(verified, POLICY.archive.name);
for (const key of ['subjectAlternativeName', 'issuer', 'buildSignerURI', 'buildSignerDigest', 'sourceRepositoryURI',
  'sourceRepositoryDigest', 'sourceRepositoryRef', 'sourceRepositoryIdentifier', 'sourceRepositoryOwnerURI',
  'sourceRepositoryOwnerIdentifier', 'buildConfigURI', 'buildConfigDigest', 'githubWorkflowRepository',
  'githubWorkflowSHA', 'githubWorkflowRef', 'runInvocationURI', 'runnerEnvironment']) {
  const changed = structuredClone(verified); changed[0].verificationResult.signature.certificate[key] = 'unreviewed';
  assert.throws(() => assertVerification(changed, POLICY.archive.name)); policyRefusals++;
}
for (const mutate of [result => { result.verifiedTimestamps = []; },
  result => { result.verifiedTimestamps[0].uri = 'https://untrusted.invalid'; },
  result => { result.statement.predicateType = 'https://spdx.dev/Document/v2.3'; },
  result => { result.statement.subject[0].digest.sha256 = '0'.repeat(64); },
  result => { result.statement.subject.push(result.statement.subject[0]); }]) {
  const changed = structuredClone(verified); mutate(changed[0].verificationResult);
  assert.throws(() => assertVerification(changed, POLICY.archive.name)); policyRefusals++;
}
assert.throws(() => assertVerification([...verified, ...verified], POLICY.archive.name)); policyRefusals++;
const repository = json('repository-identity.json'), tag = json('tag-ref.json'), release = json('release-metadata.json');
validateMetadata(repository, tag, release);
for (const [kind, mutate] of [
  ['repository', row => { row.id = 1; }], ['repository', row => { row.owner.id = 1; }],
  ['tag', row => { row.ref = 'refs/tags/nightly'; }], ['tag', row => { row.object.sha = '0'.repeat(40); }],
  ['release', row => { row.immutable = false; }], ['release', row => { row.prerelease = true; }],
  ['release', row => { row.assets.find(asset => asset.id === POLICY.archive.id).digest = 'sha256:' + '0'.repeat(64); }],
  ['release', row => { row.assets.find(asset => asset.id === POLICY.archive.id).size++; }],
]) {
  const values = { repository: structuredClone(repository), tag: structuredClone(tag), release: structuredClone(release) }; mutate(values[kind]);
  assert.throws(() => validateMetadata(values.repository, values.tag, values.release)); policyRefusals++;
}
const args = verificationArgs('artifact', 'bundle');
for (const flag of ['--hostname', '--repo', '--bundle', '--cert-identity', '--cert-oidc-issuer', '--predicate-type', '--source-ref', '--source-digest', '--signer-digest']) assert(args.includes(flag));
assert(!args.includes('--signer-workflow') && !args.includes('--cert-identity-regex') && !args.includes('--deny-self-hosted-runners'));
let environmentRefusals = 0;
const env = { GITHUB_ACTIONS: 'true', RUNNER_OS: 'Linux', RUNNER_ARCH: 'X64' };
assertCI('linux', 'x64', env);
for (const [platform, arch, context] of [['win32', 'x64', env], ['darwin', 'x64', env], ['linux', 'arm64', env], ['linux', 'x64', {}], ['linux', 'x64', { ...env, RUNNER_OS: 'Windows' }]]) {
  assert.throws(() => assertCI(platform, arch, context)); environmentRefusals++;
}
assert.throws(() => assertPublicationReady({ bin: '/invented', verifiedNames: Object.keys(POLICY.binaries) })); policyRefusals++;
const childEnv = { ...process.env, GH_TOKEN: 'DO_NOT_LOG_THIS_SENTINEL', GH_DEBUG: '' };
const invalidCommand = spawnSync(process.execPath, [bootstrapFile, 'bootstrap', '--skip-verification'], { encoding: 'utf8', env: childEnv });
assert.equal(invalidCommand.status, 1); assert(!String(invalidCommand.stderr).includes(childEnv.GH_TOKEN)); environmentRefusals++;
{
  const windows = spawnSync(process.execPath, [bootstrapFile, 'bootstrap'], { encoding: 'utf8', env: { ...childEnv, GITHUB_ACTIONS: 'false' } });
  assert.equal(windows.status, 1); assert(windows.stderr.includes('linux_github_ci_only')); assert(!windows.stderr.includes(childEnv.GH_TOKEN)); environmentRefusals++;
}
console.log(JSON.stringify({ phase: 'FOUNDRY_RELEASE_API_OFFLINE_CONTROLS', tarRefusals, elfRefusals, policyRefusals,
  environmentRefusals, cryptographicVerificationPerformed: false, networkUsed: false, installed: false, pathPublished: false }));
