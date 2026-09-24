#!/usr/bin/env node
// Self-contained local review sheet; all samples are fictional, no account data is read.
import fs from 'node:fs';
import { portraitSvg, portraitStateOf } from '../src/portrait.js';
import { portraitArtwork } from '../src/nft-art.js';
import { deedPlateSvg } from '../src/deeds.js';
import { DISTRICTS } from '../src/rules.js';

const out = new URL('../output/nft-art/', import.meta.url);
fs.mkdirSync(out, { recursive: true });
const names = ['Sal Moretti', 'Elias Blackwell', 'Mei Belladonna', 'Victor Vale', 'Nora Saint', 'Luca Ferro', 'Ada Vesper', 'Jin Marlow', 'Rose Calder', 'Ravi Sterling', 'Nico Voss', 'Celia Knox'];
const cards = [];
for (let index = 0; index < names.length; index++) {
  let id;
  for (let n = 0; n < 10000; n++) {
    const candidate = `art-preview-${index}-${n}`;
    if (portraitArtwork(candidate)?.label === `Noir study ${String(index + 1).padStart(2, '0')}`) { id = candidate; break; }
  }
  const svg = portraitSvg(portraitStateOf({ id: id || `art-preview-${index}`, name: names[index],
    level: [8, 30, 62, 85][index % 4], generation: [1, 3, 8, 14][index % 4], dynasty: 'The Night Register' }), 600);
  fs.writeFileSync(new URL(`portrait-${index}.svg`, out), svg);
  cards.push(`<figure>${svg}<figcaption>Portrait ${String(index + 1).padStart(2, '0')}</figcaption></figure>`);
}
const streets = ['Mercy Wharf', 'Velvet Avenue', 'Iron Testament', 'Saints Row', 'Stillwater Lane', 'Vesper Heights'];
const deeds = DISTRICTS.map((d, i) => {
  const svg = deedPlateSvg({ name: streets[i], district: d.id, districtName: d.name, rank: 'A Street with a Story' });
  fs.writeFileSync(new URL(`deed-${d.id}.svg`, out), svg);
  return `<figure>${svg}<figcaption>${d.name}</figcaption></figure>`;
});
fs.writeFileSync(new URL('index.html', out), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OMERTÀ — The City Keeps Its Own</title>
<style>*{box-sizing:border-box}body{margin:0;background:#0b1010;color:#eee3d1;font:16px Georgia,serif;padding:52px 5vw}header{max-width:760px;margin-bottom:42px}h1{font-size:clamp(32px,4vw,58px);font-weight:normal;line-height:1.1;margin:16px 0}p{color:#b9b09e;line-height:1.6}.kicker,h2,figcaption{font:12px system-ui,sans-serif;letter-spacing:3px;text-transform:uppercase;color:#b59a6b}h2{margin:52px 0 22px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px}.deeds{grid-template-columns:repeat(3,minmax(0,1fr))}figure{margin:0}svg{display:block;width:100%;height:auto}figcaption{margin-top:14px;font-size:10px;letter-spacing:2px}@media(max-width:800px){.grid,.deeds{grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}body{padding:30px 4vw}}</style>
<header><div class="kicker">OMERTÀ / The collection</div><h1>The city keeps its own.</h1><p>Painted faces. Streets with a history. Brass, ink and bloodline.</p></header><h2>The bloodlines</h2><main class="grid">${cards.join('')}</main><h2>The street deeds</h2><section class="grid deeds">${deeds.join('')}</section></html>`);
console.log('Preview: output/nft-art/index.html');
