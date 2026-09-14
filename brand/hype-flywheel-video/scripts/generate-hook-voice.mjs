import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(project, '../../public/art/hook-campaign');
const texts = [
  'Omerta. The city is connected. The Hook. The World Graph. The Coordination Engine.',
  'Every cut has a job. The canonical market design routes its nine percent base sell fee into four fixed buckets.',
  'The reserve has limits. Finite capacity, cooldowns, and market checks govern deployment. There is no bottomless vault.',
  'Capital has terms. Funded inventory bonds. Solver-funded arbitrage. Real liquidity commitments with prefunded campaigns.',
  'Hold Turf. Claim allocated fees. Families control future fee rights. The protocol keeps the liquidity principal.',
  'The World Graph connects sources, materials, recipes, evidence, and social gates. Every dependency has a place.',
  'The wreck is a beginning. Salvage consumes the car once. Crafting consumes its inputs. Quality stays in the ledger.',
  'Some doors take a crew. Evidence unlocks dependencies. Four distinct accounts contribute to a shared operation.',
  'The Docks needs the Foundry. Two investigators. Two original sources. The Split Ledger needs independent evidence.',
  'A copy is not a source. Discoveries keep their identity. Archives and assertions cannot manufacture independent evidence.',
  'Choose who knows what. Share with an account, Crew, or Family. Current permissions are checked when evidence is used.',
  'Every action. A connection. Explore Omerta, and follow the next chapter at omerta dot fun.',
];
const manifestPath = path.join(output, 'voice-manifest.json');
const model = 'fal-ai/minimax/speech-02-hd';
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {model, voice: 'Deep_Voice_Man', clips: {}};
const key = process.env.FAL_KEY?.trim();
if (!key) throw new Error('FAL_KEY required');
for (const [index, text] of texts.entries()) {
  const filename = `voice-${index}.mp3`;
  if (manifest.clips[index]?.status === 'downloaded' && fs.existsSync(path.join(output, filename))) continue;
  if (manifest.clips[index]?.status === 'submitting') throw new Error(`Clip ${index} has an ambiguous request; reconcile before retrying.`);
  manifest.clips[index] = {text, status: 'submitting'};
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  const response = await fetch(`https://fal.run/${model}`, {method: 'POST', headers: {Authorization: `Key ${key}`, 'Content-Type': 'application/json'}, body: JSON.stringify({text, voice_setting: {voice_id: 'Deep_Voice_Man', speed: 1.05, pitch: 0, vol: 1, english_normalization: false}, audio_setting: {sample_rate: 44100, bitrate: 256000, format: 'mp3', channel: 1}, output_format: 'url'}), signal: AbortSignal.timeout(120000)});
  if (!response.ok) {
    if (response.status === 422) {
      manifest.clips[index].status = 'rejected';
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }
    throw new Error(`TTS HTTP ${response.status}: ${(await response.text()).slice(0, 600)}`);
  }
  const result = await response.json();
  const url = result.audio?.url || result.audio_url || result.url;
  if (!url) throw new Error('No audio URL returned');
  manifest.clips[index].url = url;
  manifest.clips[index].status = 'generated';
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  const media = await fetch(url);
  if (!media.ok) throw new Error(`Audio download HTTP ${media.status}`);
  const bytes = Buffer.from(await media.arrayBuffer());
  const dest = path.join(output, filename);
  fs.writeFileSync(dest, bytes);
  const probe = path.join(project, 'node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe');
  const duration = Number(execFileSync(probe, ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',dest], {encoding: 'utf8'}).trim());
  manifest.clips[index] = {text, status: 'downloaded', duration, sha256: crypto.createHash('sha256').update(bytes).digest('hex')};
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Narration ${index + 1}/12: ${duration.toFixed(2)}s`);
  if (duration > 11) throw new Error(`Clip ${index} needs a shorter script before enabling.`);
}
const rates = texts.map((_, index) => Math.max(1, manifest.clips[index].duration / 6.9));
fs.writeFileSync(path.join(project, 'src/hook-campaign/voice.ts'), `export const voiceEnabled = true;\nexport const voiceRates = ${JSON.stringify(rates)};\n`);
