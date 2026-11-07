#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUEST_SAGA_PACKS } from '../src/content/quest-saga.js';
import { compileContentPack, validateActivatableContentPack } from '../src/content/compiler.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const command = process.argv[2] || 'check';
if (!['write', 'check', 'build'].includes(command)) throw new Error('usage: questing-content.js write|check|build');
for (const pack of QUEST_SAGA_PACKS) {
  const directory = path.join(root, 'content', 'packs', `quest-${pack.runtime.experienceId}`);
  const target = path.join(directory, 'pack.json');
  const source = JSON.stringify(pack, null, 2) + '\n';
  if (command === 'write') {
    fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(target, source);
  } else if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8').replaceAll('\r\n', '\n') !== source) {
    throw new Error(`Authored source differs from ${path.relative(root, target)}; run write after reviewing the source.`);
  }
  if (command !== 'write') {
    const compiled = compileContentPack(pack);
    validateActivatableContentPack(compiled);
    if (command === 'build') {
      const destination = path.join(root, 'content', 'dist', `quest-${pack.runtime.experienceId}-v${pack.version}.json`);
      const bytes = JSON.stringify(compiled, null, 2) + '\n';
      if (fs.existsSync(destination) && fs.readFileSync(destination, 'utf8') !== bytes) throw new Error(`Refusing to overwrite immutable ${destination}`);
      fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, bytes);
    }
    console.log(`${pack.namespace} ${compiled.contentHash}`);
  }
}
