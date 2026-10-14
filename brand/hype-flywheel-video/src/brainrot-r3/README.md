# OMERTÀ Brainrot R3 edit shell

Standalone entry: `src/brainrot-r3/index.ts`. It does not change the existing film entry.

The three compositions are `Omerta-R3-01` (945 frames), `Omerta-R3-02` (990 frames), and `Omerta-R3-03` (990 frames), at 1080×1920, 30fps. Durations and beats come from `brand/brainrot-video-system/production-data.json` at bundle time.

The local asset manifest is `public/art/brainrot-r3/manifest.json`, with this preferred shape:

```json
{
  "assets": {
    "R3-V1-G01": {
      "src": "art/brainrot-r3/clips/R3-V1-G01.mp4",
      "duration": 5,
      "muted": true
    }
  },
  "audio": {"01": "art/brainrot-r3/audio/01-master.wav"}
}
```

Flat asset-id mappings and string paths are also accepted. All media resolves inside the local public directory. Remote media and parent-relative paths are rejected. Missing or pending assets display an explicitly labeled internal timing animatic. Missing audio remains silent; no synthetic placeholder dialogue is added. Only set `muted: false` when the source audio is intentionally part of the mix. Supply actual measured video durations, in seconds, for accurate trimming.

Use `beat.assetWindow: {start: 0, end: 1.5}` for an explicit source window in seconds. Alternatively `film.assetWindows[assetId]` or top-level `assetWindows[assetId]` accepts one window or an array indexed by that asset's repeated occurrence. Otherwise repeated uses advance through source time, bounded by clip duration; short windows freeze their final frame. This prevents playback beyond the end of the asset.

`beat.tertiaryCaption` or `beat.editorial` supplies exact tertiary copy. Otherwise the direction in `beat.tertiary` is shortened and explicitly labeled editorial. The strip is abstract editorial context, not a fabricated captured game UI.

EDIT slots have original editorial typography/diagrams for brand, custody, permission and history. If a beat calls for actual capture, its internal draft explicitly reads `CAPTURE PENDING` until a capture is provided. Captures use manifest IDs such as `R3-V1-B03-CAPTURE` (film 1, one-based beat 3), or an optional `beat.captureAsset` override. `beat.captureRequired` can explicitly override the detection from the shot directions. Only put authenticated game captures in these slots; generated plates never satisfy this evidence layer. The shell does not fabricate transactions, private records or native gameplay UI.

Speech starts at y1040; the 44px editorial strip occupies y1340–1470, inside the essential rectangle ending at y1480. Caption entrance motion stays within its horizontal bounds. On the Consigliere's spoken beats, a 260px call-window-style portrait at y550 identifies `AI CONSIGLIERE / EDITORIAL PORTRAYAL`; it is not a real-call interface or fabricated agent transcript. Her reference asset is `art/brainrot-r3/refs/R3-C03-poly.png`. Actual captures narrow on these beats to avoid being obscured by her portrait.

Run from `brand/hype-flywheel-video`:

```powershell
npx tsc --project src/brainrot-r3/tsconfig.json
npx remotion studio src/brainrot-r3/index.ts --public-dir ../../public --no-open
npx remotion render src/brainrot-r3/index.ts Omerta-R3-01 ../../output/brainrot-r3-01-preview.mp4 --public-dir ../../public --scale 0.5 --codec h264 --crf 24
```

Use the corresponding `02` or `03` composition for the other films. Final delivery: omit `--scale`, use `--crf 18 --audio-bitrate 256k --color-space bt709`. Do not treat animatic output as a finished advertisement. Before final export, stabilize copy, resolve every media slot, add the approved voice/music/SFX mix, inspect the first and last frames of every trim, and verify captions remain clear within platform safe areas.
