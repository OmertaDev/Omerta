# The City Keeps Its Own

New character portraits use fal.ai **FLUX.2 Klein 4B** ($0.005 per billable megapixel);
Street Deeds keep **FLUX.2 Pro** ($0.03 for the first megapixel). The existing starter
paintings remain Pro. Both use an engraved SVG frame. Ink black, petroleum teal, old brass and oxblood; visible
gouache texture, angular faces and readable city architecture. Lettering belongs
to the compositor, never the generated image.

The starter library is **12 portrait studies and six district paintings**. Paintings
are reused. Each character/street has deterministic framing, lighting and a full
SHA-256 identity ornament; these are cosmetic details, not rarity or gameplay bonuses.
Public rank, generation and reputation remain visible. No private character data is
sent to fal or encoded in the art.

`manifest.json` records prompts, model, original result URLs, file hashes and estimated
generation cost. Browser-generated seeds are null when not available. SVGs embed local
JPEGs, so there are no remote image dependencies or paid calls on NFT reads. Missing
paintings keep the procedural fallback.

Character artwork and its traits stay sealed until the confirmed fee watcher attributes
a positive on-chain `mint` payment to the character's account. Free mint credits,
`minted=true`, other fee types and QA grants without a transaction hash do not qualify.
The image and metadata routes both enforce this, including frozen token snapshots;
the original minter's payment applies, never the buyer's. Sealed responses are not cached.
An attributed payment reveals the art without waiting for the separate credit-spend action.

Generate the local review sheet with `node tools/nft-art-preview.js`.
Run the artwork regression checks with `node test/nft-art.js` and `node test/portrait.js`.
Before publication, `python tools/optimize-nft-art.py` (Pillow) prepares JPEG delivery
copies up to 1024px at quality 85. Original files remain in ignored
`output/nft-art/originals`; both hashes and the delivery settings remain in the manifest.

For a separately generated painting **before minting**, supply `FAL_KEY` or
`FAL_KEY_FILE` only in the operator environment, then run (portraits also require
`DATABASE_URL` for a read-only check of the character's confirmed creation payment):

```sh
node tools/nft-art.js --portrait CHARACTER_ID
node tools/nft-art.js --deed "Mercy Wharf" --district docks
```

The identity is hashed locally; the prompt contains only fictional visual traits.
The renderer prefers that identity's commissioned file. Publish the file with the game
before minting. Do not replace published files or add overrides for transferred/frozen
portraits: game-state freezing does not snapshot image binaries. The 12-way library
selection is pinned to avoid reshuffling faces when the collection grows.

`--generate` commissions missing library plates; `--list` is offline. The default
`NFT_ART_CAP_USD=0.75` caps cumulative estimated spend, reserving each request before
submission. Uncertain/failed attempts are never automatically resubmitted. Reconcile
those in fal before any deliberate retry. `--import-results FILE` saves completed
playground outputs without another generation charge.
New import entries must include their actual `model`; old manifest provenance is preserved.
This is still an operator commissioning tool. Signup does not yet enqueue automatic
generation; the durable worker and runtime fal credentials remain to be configured.
