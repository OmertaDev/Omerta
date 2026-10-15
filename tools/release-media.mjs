#!/usr/bin/env node
// Keep large source audio in ordinary Git blobs, then restore its original public paths.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGzip, createGunzip } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'deploy/media-manifest.json');
const maxChunkBytes = 90 * 1024 * 1024;
const sources = [
  'public/art/flagship-animation/audio/animated-mix.wav',
  'public/art/flagship-animation/audio/audio-added-layer.wav',
  'public/art/flagship-rebuild/audio/rebuild-dialogue.wav',
  'public/art/flagship-rebuild/audio/rebuild-mix.wav',
  'public/art/flagship-rebuild/audio/rebuild-music.wav',
  'public/art/flagship-trust/audio/animatic-mix.wav',
];
const sha256 = () => createHash('sha256');

async function bounded(relative, prefix) {
  if (typeof relative !== 'string' || !relative.startsWith(prefix)
    || !/^[a-zA-Z0-9._/-]+$/.test(relative)
    || relative.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Invalid release media path: ' + relative);
  }
  const resolved = path.resolve(root, relative);
  const within = path.relative(root, resolved);
  if (within.startsWith('..') || path.isAbsolute(within)) throw new Error('Media path leaves the workspace');
  // Reject links before reading or writing, including links in parent directories.
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error('Linked media path: ' + relative);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return resolved;
}

async function digestFile(file) {
  const hash = sha256();
  let bytes = 0;
  for await (const chunk of createReadStream(file)) { hash.update(chunk); bytes += chunk.length; }
  return { bytes, sha256: hash.digest('hex') };
}

async function pack() {
  const entries = [];
  for (const relative of sources) {
    const source = await bounded(relative, 'public/art/');
    const sourceHash = sha256();
    const stem = relative.split('/')[2] + '-' + path.basename(relative);
    const chunks = [];
    let bytes = 0, handle = null, chunkHash = null, chunkBytes = 0, chunkPath = '';
    const finishChunk = async () => {
      if (!handle) return;
      await handle.close(); handle = null;
      chunks.push({ path: chunkPath, bytes: chunkBytes, sha256: chunkHash.digest('hex') });
    };
    const writeChunk = async buffer => {
      let offset = 0;
      while (offset < buffer.length) {
        if (!handle) {
          chunkPath = 'deploy/media-chunks/' + stem + '.gz.' + String(chunks.length + 1).padStart(3, '0');
          const destination = await bounded(chunkPath, 'deploy/media-chunks/');
          await mkdir(path.dirname(destination), { recursive: true });
          handle = await open(destination, 'w'); chunkHash = sha256(); chunkBytes = 0;
        }
        const part = buffer.subarray(offset, offset + Math.min(maxChunkBytes - chunkBytes, buffer.length - offset));
        await handle.writeFile(part);
        chunkHash.update(part); chunkBytes += part.length; offset += part.length;
        if (chunkBytes === maxChunkBytes) await finishChunk();
      }
    };
    try {
      await pipeline(createReadStream(source), new Transform({
        transform(chunk, encoding, callback) { sourceHash.update(chunk); bytes += chunk.length; callback(null, chunk); },
      }), createGzip({ level: 6 }), new Writable({
        write(chunk, encoding, callback) { writeChunk(chunk).then(() => callback(), callback); },
      }));
      await finishChunk();
    } finally {
      if (handle) await handle.close();
    }
    entries.push({ path: relative, bytes, sha256: sourceHash.digest('hex'), chunks });
    console.log('Packed ' + relative + ' (' + chunks.length + ' chunks)');
  }
  await writeFile(manifestPath, JSON.stringify({ schema: 'omerta.release-media.v1', compression: 'gzip', maxChunkBytes, entries }, null, 2) + '\n');
}

async function loadManifest() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.schema !== 'omerta.release-media.v1' || manifest.compression !== 'gzip'
    || manifest.maxChunkBytes !== maxChunkBytes || !Array.isArray(manifest.entries)) throw new Error('Invalid release media manifest');
  const seen = new Set();
  for (const entry of manifest.entries) {
    await bounded(entry.path, 'public/art/');
    if (seen.has(entry.path) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 1
      || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Array.isArray(entry.chunks) || !entry.chunks.length) throw new Error('Invalid media entry');
    seen.add(entry.path);
    for (const chunk of entry.chunks) {
      await bounded(chunk.path, 'deploy/media-chunks/');
      if (!Number.isSafeInteger(chunk.bytes) || chunk.bytes < 1 || chunk.bytes > maxChunkBytes
        || !/^[a-f0-9]{64}$/.test(chunk.sha256)) throw new Error('Invalid media chunk');
    }
  }
  return manifest;
}

async function* compressed(entry) {
  for (const chunk of entry.chunks) {
    const file = await bounded(chunk.path, 'deploy/media-chunks/');
    if ((await stat(file)).size !== chunk.bytes) throw new Error('Media chunk size mismatch: ' + chunk.path);
    const hash = sha256();
    for await (const buffer of createReadStream(file)) { hash.update(buffer); yield buffer; }
    if (hash.digest('hex') !== chunk.sha256) throw new Error('Media chunk hash mismatch: ' + chunk.path);
  }
}

async function restore(verifyOnly) {
  const manifest = await loadManifest();
  for (const entry of manifest.entries) {
    const destination = await bounded(entry.path, 'public/art/');
    if (!verifyOnly) {
      try {
        const current = await digestFile(destination);
        if (current.bytes === entry.bytes && current.sha256 === entry.sha256) {
          console.log('Verified existing ' + entry.path); continue;
        }
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      await mkdir(path.dirname(destination), { recursive: true });
    }
    const temporaryRelative = entry.path + '.release-media-' + process.pid + '.tmp';
    const temporary = await bounded(temporaryRelative, 'public/art/');
    const hash = sha256();
    let bytes = 0, ownsTemporary = false;
    try {
      const output = verifyOnly ? new Writable({ write(chunk, encoding, callback) { callback(); } })
        : (await open(temporary, 'wx')).createWriteStream();
      ownsTemporary = !verifyOnly;
      await pipeline(Readable.from(compressed(entry)), createGunzip(), new Transform({
        transform(chunk, encoding, callback) {
          bytes += chunk.length;
          if (bytes > entry.bytes) { callback(new Error('Restored media exceeds expected size')); return; }
          hash.update(chunk); callback(null, chunk);
        },
      }), output);
      if (bytes !== entry.bytes || hash.digest('hex') !== entry.sha256) throw new Error('Restored media hash mismatch: ' + entry.path);
      if (!verifyOnly) await rename(temporary, destination);
    } finally {
      if (ownsTemporary) await rm(temporary, { force: true });
    }
    console.log((verifyOnly ? 'Verified archive ' : 'Restored ') + entry.path);
  }
}

const mode = process.argv[2] || 'unpack';
if (!['pack', 'unpack', 'verify'].includes(mode) || process.argv.length > 3) throw new Error('Usage: node tools/release-media.mjs [pack|unpack|verify]');
if (mode === 'pack') await pack();
else await restore(mode === 'verify');
