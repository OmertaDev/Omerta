# OMERTA Hype Flywheel v3

The 82.3-second hybrid film behind `/art/hype-flywheel-v3.mp4`.

- fal.ai Seedance 2.5 supplies three campaign-specific plates: the hero flywheel at 480p plus
  dedicated Street Deeds and future-RWA footage at 720p.
- fal.ai MiniMax supplies nine timed voiceover segments.
- Remotion supplies the exact diagrams, kinetic type, mix, and 1080p master.
- The repository's existing fal-generated 1940s noir motion library supplies the other six scene
  backgrounds, and the existing generated score is reused in the edit.

The copy is deliberately mechanism-specific. It separates Desk inventory recycling from the
source-revenue-capped Vig buyback, separates a Street Deed from contestable control, traces the
future play-weighted Stock Token path into an extracted Deed's vault, and labels the production
extraction and RWA rails as gated and chain-unconfigured.

## Build

From this directory:

```powershell
npm install
$env:FAL_KEY = '<fal API key>'
npm run assets
Remove-Item Env:FAL_KEY
npm run lint
npm run render:preview
npm run render
```

The default asset pass is capped at `$1.50` and requests only the six-second hero plate plus any
missing voice segments. A separately approved extension generated the two 720p Deeds/RWA plates.
The generator also retains five unused bespoke prompts; with a separately approved budget, pass
`--video-ids all` and an explicit higher `--cap` directly to the script. Queued request IDs are
persisted before polling, and read-side fal calls retry transient network failures, so an interrupted
poll never needs a duplicate paid submission.

The Remotion commands use the repository root `public/` directory directly; generated videos are not
duplicated inside this package. Generated fal assets and their provenance manifest live under
`public/art/hype/`.

## Review gates

Watch the rendered file end to end before publishing. Public release still requires founder approval
of the spoken wording and confirmation that the music bed is licensed for the intended distribution.
