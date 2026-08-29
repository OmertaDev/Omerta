#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { bundleSummary, compileContentPack } from '../src/content/compiler.js';

const [, , command, sourceArg, outputArg] = process.argv;

try {
  if (!['check', 'build'].includes(command) || !sourceArg || (command === 'build' && !outputArg)) {
    throw new Error('usage: node tools/content.js <check pack.json | build pack.json bundle.json>');
  }
  const sourcePath = path.resolve(sourceArg);
  const input = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const bundle = compileContentPack(input);
  if (command === 'build') {
    const outputPath = path.resolve(outputArg);
    const bytes = `${JSON.stringify(bundle, null, 2)}\n`;
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    if (fs.existsSync(outputPath)) {
      const existing = fs.readFileSync(outputPath, 'utf8');
      if (existing !== bytes) throw new Error(`refusing to overwrite immutable bundle ${outputPath}`);
    } else {
      fs.writeFileSync(outputPath, bytes, { encoding: 'utf8', flag: 'wx' });
    }
  }
  process.stdout.write(`${JSON.stringify({ ...bundleSummary(bundle), command })}\n`);
} catch (error) {
  process.stderr.write(`content: ${error.message}\n`);
  process.exitCode = 1;
}
