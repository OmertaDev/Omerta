// Exact authored sale-page successor. Source-only; no runtime/native/deployment clearance.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const SALE_SOURCE = freeze({
  "version": 1,
  "status": "SEALED",
  "phase": "EXACT_SALE_PAGE_SOURCE_ONLY",
  "revision": "edaaed2b9d8913039c7cee61d7a46af7ce0657c5",
  "tree": "e0318bd70c79ca49ec6e456262cd4c0d07a74787",
  "targetRevision": "442409ae3f70677c0bd475d99f018bec29849e5b",
  "targetTree": "e4093abbcfeab39688e2a69483110b7a4478f71a",
  "contextLines": 3,
  "files": [
    {
      "file": "package.json",
      "mode": "100644",
      "targetMode": "100644",
      "currentBlob": "0e635f60415aeb09c9a44d3f2853f6ee1fabc1ad",
      "currentSha256": "d9a46c5c518c9747f74ff7f18509278b1118d162c38618347fbe52c6439c735f",
      "currentRawSha256": {
        "lf": "d9a46c5c518c9747f74ff7f18509278b1118d162c38618347fbe52c6439c735f",
        "crlf": "66f0632d54ac3484f28e24a3f378908fae5a4bcc88a803f1669e25d19689e9ef"
      },
      "currentBytes": 59553,
      "targetBlob": "6fce6849666016eb938e5ab8a439a59e66558b4e",
      "targetSha256": "cafb28084700a384839d2466316d077780de0ed3510398129a6275ae1aa7fa78",
      "targetBytes": 59511,
      "inverses": [
        {
          "current": "    \"test:ux\": \"npm run test:ux:source && node test/ux-feedback.js && node test/circle-highlights.js && node test/ux-workspace.js && node test/ux-tactics.js && node test/ux-investigation-api.js && node test/ux-coordination.js && node test/ux-identity.js && node test/ux-story.js && node test/ux-community.js && node test/ux-tools.js\",\n    \"test:ux:browser\": \"node test/ux-progression-browser.js && node test/ux-navigation-browser.js && node test/ux-social-browser.js && node test/ux-experience-browser.js && node test/ux-workspace-browser.js && node test/ux-tactics-browser.js && node test/ux-investigation-browser.js && node test/ux-coordination-browser.js && node test/ux-expanded-browser.js && node test/ux-feel-browser.js && node test/ux-tools-browser.js && node test/ux-identity-browser.js && node test/ux-story-browser.js && node test/ux-community-browser.js && node test/ux-personality-browser.js\",\n    \"test:ux:postgres\": \"node test/ux-postgres.js && node test/ux-postgres-rls.js\",\n    \"test:ux:source\": \"node test/sale-source-compatibility.js && node test/ux-source-compatibility.js\"\n  },\n  \"dependencies\": {\n    \"@fastify/jwt\": \"^10.2.0\",\n",
          "baseline": "    \"test:ux\": \"npm run test:ux:source && node test/ux-feedback.js && node test/circle-highlights.js && node test/ux-workspace.js && node test/ux-tactics.js && node test/ux-investigation-api.js && node test/ux-coordination.js && node test/ux-identity.js && node test/ux-story.js && node test/ux-community.js && node test/ux-tools.js\",\n    \"test:ux:browser\": \"node test/ux-progression-browser.js && node test/ux-navigation-browser.js && node test/ux-social-browser.js && node test/ux-experience-browser.js && node test/ux-workspace-browser.js && node test/ux-tactics-browser.js && node test/ux-investigation-browser.js && node test/ux-coordination-browser.js && node test/ux-expanded-browser.js && node test/ux-feel-browser.js && node test/ux-tools-browser.js && node test/ux-identity-browser.js && node test/ux-story-browser.js && node test/ux-community-browser.js && node test/ux-personality-browser.js\",\n    \"test:ux:postgres\": \"node test/ux-postgres.js && node test/ux-postgres-rls.js\",\n    \"test:ux:source\": \"node test/ux-source-compatibility.js\"\n  },\n  \"dependencies\": {\n    \"@fastify/jwt\": \"^10.2.0\",\n"
        }
      ]
    },
    {
      "file": "public/index.html",
      "mode": "100644",
      "targetMode": "100644",
      "currentBlob": "0824ae7d34b214276ba550a697d6fa7430204373",
      "currentSha256": "5e87a775b3efc213680d0b401c302b2bdd21a5146a5417b1d72359aa8260deee",
      "currentRawSha256": {
        "lf": "5e87a775b3efc213680d0b401c302b2bdd21a5146a5417b1d72359aa8260deee",
        "crlf": "da57e20b5c2e658f9806d8675c2d59d0f6e9aed7dd59023056c2dd24d6e1cd11"
      },
      "currentBytes": 1396716,
      "targetBlob": "ff09ad99c2f3dd5d9b5f7c1deafc18eee5415004",
      "targetSha256": "639de67a76fe48103966fe71c95c4a0e449fcba4b12f79e57ea60a8c16b05b1f",
      "targetBytes": 1396512,
      "inverses": [
        {
          "current": "\n<div id=\"screen-auth\" class=\"landing hidden\">\n  <a class=\"skip-link\" href=\"#landing-main\">Skip to the city</a>\n  <a class=\"public-sale-banner\" href=\"/sale\"><span>$OMR AUCTION · STREET DEEDS</span><strong>Explore the launch <span aria-hidden=\"true\">↗</span></strong></a>\n  <nav class=\"public-nav\" aria-label=\"Primary\">\n    <a class=\"public-nav__brand\" href=\"/\" aria-current=\"page\">OMERTÀ</a>\n    <details class=\"public-nav__menu\"><summary>Explore</summary><div class=\"public-nav__menu-list\">\n      <a href=\"/\" aria-current=\"page\">The city</a><a href=\"#city-guide\">Explore the gameplay</a><a href=\"/path\">Find your Path</a><a href=\"/wiki\">The Codex</a><a href=\"/arena\">The Arena</a><a href=\"/play\">Connect an AI</a><a href=\"/sale\">Token sale &amp; Deeds</a><a href=\"#omr-economy\">Understand $OMR</a>\n    </div></details>\n    <div class=\"public-nav__links\">\n      <a href=\"/wiki\">Codex</a>\n",
          "baseline": "\n<div id=\"screen-auth\" class=\"landing hidden\">\n  <a class=\"skip-link\" href=\"#landing-main\">Skip to the city</a>\n  <nav class=\"public-nav\" aria-label=\"Primary\">\n    <a class=\"public-nav__brand\" href=\"/\" aria-current=\"page\">OMERTÀ</a>\n    <details class=\"public-nav__menu\"><summary>Explore</summary><div class=\"public-nav__menu-list\">\n      <a href=\"/\" aria-current=\"page\">The city</a><a href=\"#city-guide\">Explore the gameplay</a><a href=\"/path\">Find your Path</a><a href=\"/wiki\">The Codex</a><a href=\"/arena\">The Arena</a><a href=\"/play\">Connect an AI</a><a href=\"#omr-economy\">Understand $OMR</a>\n    </div></details>\n    <div class=\"public-nav__links\">\n      <a href=\"/wiki\">Codex</a>\n"
        }
      ]
    },
    {
      "file": "src/server.js",
      "mode": "100644",
      "targetMode": "100644",
      "currentBlob": "c96a418f09c21ab7a0d09208f8205c60b20b0138",
      "currentSha256": "0a4ef19403806a4f0a8de534b66b361455e44d7afe8f2083ccf1f025eaa5ff17",
      "currentRawSha256": {
        "lf": "0a4ef19403806a4f0a8de534b66b361455e44d7afe8f2083ccf1f025eaa5ff17",
        "crlf": "32ead52f483540e079f94b8a69b3b3d5b44b8d5432cbe592ca63ddd6a6f8d9ee"
      },
      "currentBytes": 303220,
      "targetBlob": "0ffc003cce114fb2d032952728950432084fc429",
      "targetSha256": "fbf47e354861cadc40d9081dfb507e1b955c0ad969a52a272eccfceb896b72f9",
      "targetBytes": 302199,
      "inverses": [
        {
          "current": "  let playHtml = '<!doctype html><title>Play OMERTA with Claude</title><p>Walkthrough file missing (public/play.html).</p>';\n  try { playHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'play.html'), 'utf8'); } catch { /* headless */ }\n  app.get('/play', servePage(playHtml));\n  // Public token sale; auction figures remain unavailable until the auction is connected.\n  let saleHtml = '<!doctype html><title>$OMR token sale | OMERTÀ</title><p>Token sale page unavailable.</p>';\n  try { saleHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sale.html'), 'utf8'); } catch { /* headless */ }\n  app.get('/sale', servePage(saleHtml));\n  for (const [url, kind] of Object.entries({ '/privacy': 'privacy', '/terms': 'terms', '/dmca': 'dmca', '/resources': 'resources' })) {\n    app.get(url, async (req, reply) => {\n      const page = legalPage(kind);\n",
          "baseline": "  let playHtml = '<!doctype html><title>Play OMERTA with Claude</title><p>Walkthrough file missing (public/play.html).</p>';\n  try { playHtml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'play.html'), 'utf8'); } catch { /* headless */ }\n  app.get('/play', servePage(playHtml));\n  for (const [url, kind] of Object.entries({ '/privacy': 'privacy', '/terms': 'terms', '/dmca': 'dmca', '/resources': 'resources' })) {\n    app.get(url, async (req, reply) => {\n      const page = legalPage(kind);\n"
        },
        {
          "current": "    for (const name of readdirSync(hypeDir))\n      if (mediaType(name)) ART_VIDEOS.set('hype/' + name, { path: join(hypeDir, name), size: statSync(join(hypeDir, name)).size, type: mediaType(name) });\n  } catch { /* no motion shipped — the still plates stand in */ }\n  // Public district previews; commissioned NFT plates are not part of this allowlist.\n  for (const district of ['docks', 'neon', 'foundry', 'brick', 'canal', 'cathedral']) {\n    const name = `nft/deed-${district}.jpg`;\n    try { ART_FILES.set(name, { body: readFileSync(join(artDir, name)), type: 'image/jpeg' }); } catch { /* optional preview */ }\n  }\n  // RANGE support is not optional for <video>: Chromium's media stack refuses a source it cannot seek\n  // (a chunked stream with no Content-Length/Accept-Ranges fires the element's error event and the\n  // client's fail-safe removes the clip) — found live by the motion probe, not by reading specs.\n",
          "baseline": "    for (const name of readdirSync(hypeDir))\n      if (mediaType(name)) ART_VIDEOS.set('hype/' + name, { path: join(hypeDir, name), size: statSync(join(hypeDir, name)).size, type: mediaType(name) });\n  } catch { /* no motion shipped — the still plates stand in */ }\n  // RANGE support is not optional for <video>: Chromium's media stack refuses a source it cannot seek\n  // (a chunked stream with no Content-Length/Accept-Ranges fires the element's error event and the\n  // client's fail-safe removes the clip) — found live by the motion probe, not by reading specs.\n"
        },
        {
          "current": "    return reply.code(404).send({ error: 'not_found' });\n  });\n  app.get('/art/hype/:file', async (req, reply) => sendVideo('hype/' + req.params.file, req, reply));\n  app.get('/art/nft/:file', async (req, reply) => {\n    const hit = ART_FILES.get('nft/' + req.params.file);\n    if (!hit) return reply.code(404).send({ error: 'not_found' });\n    return reply.type(hit.type).header('cache-control', 'public, max-age=604800').send(hit.body);\n  });\n  // THE MOTION MANIFEST — the client asks which plates have a living clip (and which ambient beds\n  // shipped) instead of hardcoding a list that would drift from the directory. Derived from the SAME\n  // boot allowlist the serving route reads, so manifest and server can never disagree.\n",
          "baseline": "    return reply.code(404).send({ error: 'not_found' });\n  });\n  app.get('/art/hype/:file', async (req, reply) => sendVideo('hype/' + req.params.file, req, reply));\n  // THE MOTION MANIFEST — the client asks which plates have a living clip (and which ambient beds\n  // shipped) instead of hardcoding a list that would drift from the directory. Derived from the SAME\n  // boot allowlist the serving route reads, so manifest and server can never disagree.\n"
        }
      ]
    }
  ]
});
export const SALE_SOURCE_SHA256 = "36b294aabd710cbf53be8d4877dca1ac83859e76d0e3eed616ea7d5996ee3a5f";
