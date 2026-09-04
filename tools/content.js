#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { bundleSummary, compileContentPack } from '../src/content/compiler.js';
import { ContentDiscoveryError, discoverContentPackages } from '../src/content/discovery.js';
import { parseAuthoredJson } from '../src/content/json-source.js';

const [, , command, sourceArg, outputArg] = process.argv;
const DIAGNOSTIC_CONTROLS = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/gu;

function safeDiagnostic(value) {
  const escaped = String(value).replace(DIAGNOSTIC_CONTROLS, (character) => (
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  ));
  return escaped.length <= 4_096 ? escaped : `${escaped.slice(0, 4_093)}...`;
}

try {
  if (!['check', 'build', 'check-corpus'].includes(command)
      || !sourceArg
      || (command === 'build' && !outputArg)) {
    throw new Error(
      'usage: node tools/content.js <check pack.json | build pack.json bundle.json | check-corpus root>',
    );
  }
  const sourcePath = path.resolve(sourceArg);
  if (command === 'check-corpus') {
    const packages = discoverContentPackages({ rootDir: sourcePath })
      .filter(({ authorityProfile }) => authorityProfile === 'production');
    if (packages.length === 0) {
      throw new ContentDiscoveryError(
        'content_empty_corpus',
        'production corpus contains no manifests',
      );
    }
    for (const entry of packages) compileContentPack(parseAuthoredJson(entry.source));
    process.stdout.write(`${JSON.stringify({ ok: true, command, packageCount: packages.length })}\n`);
  } else {
    const bundle = compileContentPack(parseAuthoredJson(fs.readFileSync(sourcePath)));
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
  }
} catch (error) {
  process.stderr.write(`content: ${safeDiagnostic(error.message)}\n`);
  process.exitCode = 1;
}
