# OMERTÀ: Trust Is the Game — animated review cut

One 6:30 film, rebuilt as an original painted noir story with 73 shots and no website screenshots. Nico and Mara recur through the invitation, preparation, heist, loss and next invitation. Public-launch wording and the Play now ending follow the user's direction.

## Deliverables

- `output/flagship-animation/OMERTA-Trust-Is-The-Game-Animated-1080.mp4`: captioned viewing export.
- `output/flagship-animation/OMERTA-Trust-Is-The-Game-Animated-Clean-1080.mp4`: clean export; explanatory titles remain, narration captions are absent.
- SRT/VTT subtitles, export verification, and the self-critique with applied improvements.
- Painted assets, generation provenance, script, shot list, source-linked claim records, source footage-free timeline, editable scene code and audio.

The complete narration is in `voiceover-script.md`; incremental costs are recorded in `actual-spend.json`.

The current technique is layered 2.5D animation: generated raster art, separately animated character/prop layers, rain, reflections, lighting, vehicles and explanatory objects. This is not AI-generated video or a full character-animation performance. The voice is clearly identified local review narration; selected Voice A remains reserved for the paid finishing pass.

## Edit and render

The existing project under `brand/hype-flywheel-video` uses Remotion 4.0.523, React 19.2.3 and TypeScript 5.9.3. Install its locked dependencies with `npm ci` if needed. No font binaries are packaged; Georgia and Arial must be available on the rendering workstation.

From the package root, build the film data with `node brand/flagship-animation/build-film.mjs`. From `brand/hype-flywheel-video`, run `node scripts/render-flagship-animation-film.mjs --full --name=OMERTA-Trust-Is-The-Game-Animated-1080`; add `--clean` and use the clean export name for its counterpart. The renderer stages only animation art and the existing mixed audio. It rejects screenshot sources.

Main editable files: `public/art/flagship-animation/film.json`, `brand/flagship-animation/build-film.mjs`, `brand/flagship-rebuild/story-source.mjs`, and `brand/hype-flywheel-video/src/flagship-animation/`.

For the visual timeline editor, run `npx remotion studio src/flagship-animation/index.ts --public-dir ../../public --no-open` from `brand/hype-flywheel-video`. The package's inherited default npm scripts target earlier films; use these explicit animation commands.

## Review and spend status

The self-critique covers the original narrated-slide limitation, the first animated pass, corrections and remaining limitations. The original source/claim records remain pinned to their reviewed game revision; public-launch framing is a creative premise, not new production-activation evidence.

No fal.ai calls were made for this rebuild. The proposed $50 maximum covers bounded video performance takes plus Voice A and timing. It requires explicit authorization, as directed by section 7 of the production brief. See `generation-plan.md` for the exact bounds. No publishing or advertising is authorized or performed.

The remaining finishing requirements are the spending ceiling for that generation pass, review of the generated performances, replacement of the temporary voice with Voice A and realignment of captions, and confirmation of the inherited score's account entitlement described in `media-rights.md`. The two included exports are the completed layered-animation review cut. Their 1080p delivery size does not imply every source painting was generated at native 1080p; the manifest records each source resolution.
