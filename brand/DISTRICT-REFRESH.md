# District aesthetic pass — 14 September 2026

Integrated into the actual `public/index.html`: an editorial three-scene district atlas, ivory hero wordmark, optimized existing hero film, and updated Foundry/Docks/Neon City-tab artwork mappings. The other three district mappings remain available. Neon uses a nightlife interior, not a new district or new game feature. Belladonna is a content package and was not presented as a district.

Art direction: architectural noir, wet stone, brick industry, sea mist, burgundy velvet, brass and restrained teal. Copy and mechanics remain HTML. The gallery uses responsive WebP sources, lazy loading, explicit image dimensions and descriptive alternatives. Mobile stacks the three scenes. Hover motion respects reduced motion; existing hero controls and still fallback remain in place. New district cards do not request mismatched older motion clips.

Five fal.ai FLUX Schnell requests at 1280×720: Foundry, Docks, two rejected Neon street drafts with unwanted invented lettering, and the approved Neon lounge. Estimated generation cost is $0.015 at the checked $0.003 per rounded megapixel rate. This is a rate-based estimate, not an account billing read. No video generation was purchased. Prompts and attempt provenance are in `public/art/district-refresh/manifest.json`; no credentials are stored.

Approved delivery assets use flat `/art/district-v2-*` paths compatible with the existing server's asset allowlist. Hero footage is derived from the existing `hype/hero-poster.mp4`: 5.04 seconds, 1280×548, 346,321 bytes versus 1,489,497 bytes originally. Original footage and stills remain available.

Verified: inline JS syntax; new asset HTTP responses; full optimized-video decode; actual homepage image loading; desktop layout and 390px mobile stacking without horizontal overflow. City-tab mapping was checked in source; authenticated gameplay was not exercised. The local preview uses pg-mem and does not represent a production deployment.

`apply-district-refresh.mjs` applies the narrow HTML changes once and retains a before snapshot in ignored `output/`. Production delivery assets are the flat files; nested generation artifacts preserve review history. `generate-district-refresh.mjs` is resumable for the initial batch and does not automatically repeat paid requests. Later Neon revisions are recorded separately in the manifest.
