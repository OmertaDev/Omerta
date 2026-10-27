// Exact authored sale-page successor. Source-only; no runtime/native/deployment clearance.
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const SALE_SOURCE = freeze({
  "version": 1,
  "status": "SEALED",
  "phase": "EXACT_SALE_PAGE_SOURCE_ONLY",
  "revision": "6f6f80e70bd880594ca63c54c7a2654a03277919",
  "tree": "93b056dea86071335361816d68c9393808804ed1",
  "targetRevision": "bb55398ccc135228353e890648bda18222e76a35",
  "targetTree": "85bbefdde7d91237537c7f1c356643236788dc7d",
  "contextLines": 3,
  "files": [
    {
      "file": "package.json",
      "mode": "100644",
      "targetMode": "100644",
      "currentBlob": "45d2870b08c789a3d1e8c12034f15d121fd72709",
      "currentSha256": "774f4fb21a1535704e3c9d818cc6ad8b09b7fb1bf05ace600ccbbc94ddc4ca39",
      "currentRawSha256": {
        "lf": "774f4fb21a1535704e3c9d818cc6ad8b09b7fb1bf05ace600ccbbc94ddc4ca39",
        "crlf": "2d71bfb9856b09513a2eae043370b9d75e058661dacc25f30f7314af58f2d86b"
      },
      "currentBytes": 59697,
      "targetBlob": "59396648eaaf33c7c424f6569c8e909f9d27d050",
      "targetSha256": "8229c3b94687dea00d531c1b1b4ef8884e56dbac3c03cfdc8ecdbf4b0e3985fd",
      "targetBytes": 59655,
      "inverses": [
        {
          "current": "    \"test:ux\": \"npm run test:ux:source && node test/ux-feedback.js && node test/circle-highlights.js && node test/ux-workspace.js && node test/ux-tactics.js && node test/ux-investigation-api.js && node test/ux-coordination.js && node test/ux-identity.js && node test/ux-story.js && node test/ux-community.js && node test/ux-tools.js\",\n    \"test:ux:browser\": \"node test/ux-progression-browser.js && node test/ux-navigation-browser.js && node test/ux-social-browser.js && node test/ux-experience-browser.js && node test/ux-workspace-browser.js && node test/ux-tactics-browser.js && node test/ux-investigation-browser.js && node test/ux-coordination-browser.js && node test/ux-expanded-browser.js && node test/ux-feel-browser.js && node test/ux-tools-browser.js && node test/ux-identity-browser.js && node test/ux-story-browser.js && node test/ux-community-browser.js && node test/ux-personality-browser.js\",\n    \"test:ux:postgres\": \"node test/ux-postgres.js && node test/ux-postgres-rls.js\",\n    \"test:ux:source\": \"node test/sale-source-compatibility.js && node test/ux-source-compatibility.js\",\n    \"test:economy-ux-source\": \"node test/economy-ux-merge-source-compatibility.js\"\n  },\n  \"dependencies\": {\n",
          "baseline": "    \"test:ux\": \"npm run test:ux:source && node test/ux-feedback.js && node test/circle-highlights.js && node test/ux-workspace.js && node test/ux-tactics.js && node test/ux-investigation-api.js && node test/ux-coordination.js && node test/ux-identity.js && node test/ux-story.js && node test/ux-community.js && node test/ux-tools.js\",\n    \"test:ux:browser\": \"node test/ux-progression-browser.js && node test/ux-navigation-browser.js && node test/ux-social-browser.js && node test/ux-experience-browser.js && node test/ux-workspace-browser.js && node test/ux-tactics-browser.js && node test/ux-investigation-browser.js && node test/ux-coordination-browser.js && node test/ux-expanded-browser.js && node test/ux-feel-browser.js && node test/ux-tools-browser.js && node test/ux-identity-browser.js && node test/ux-story-browser.js && node test/ux-community-browser.js && node test/ux-personality-browser.js\",\n    \"test:ux:postgres\": \"node test/ux-postgres.js && node test/ux-postgres-rls.js\",\n    \"test:ux:source\": \"node test/ux-source-compatibility.js\",\n    \"test:economy-ux-source\": \"node test/economy-ux-merge-source-compatibility.js\"\n  },\n  \"dependencies\": {\n"
        }
      ]
    },
    {
      "file": "public/index.html",
      "mode": "100644",
      "targetMode": "100644",
      "currentBlob": "24e8759f91aeae0a03bfd2c1d99b09820d62a13c",
      "currentSha256": "5a18ff07afe92bf52fae66ed066dff0e31f8848bef659e07efc8acb7e3eb5c3a",
      "currentRawSha256": {
        "lf": "5a18ff07afe92bf52fae66ed066dff0e31f8848bef659e07efc8acb7e3eb5c3a",
        "crlf": "dc193be35af3a26e200868f52d904c3f141f292ce963e2df33ee20de5c082eb3"
      },
      "currentBytes": 1398253,
      "targetBlob": "0caed5d7e8650d5f516e8cf0429a143213885c08",
      "targetSha256": "4b68e55569751bba2ad7f9748103dc507d1bcc43dccd2dc9b3bf32a443698786",
      "targetBytes": 1398049,
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
      "currentBlob": "98be176eb2d676e3eaa1992da787c76cb15acb00",
      "currentSha256": "f0fba7a89de112aa2c85e61955cd2b36eb6387605f46696ef1290d442d14615e",
      "currentRawSha256": {
        "lf": "f0fba7a89de112aa2c85e61955cd2b36eb6387605f46696ef1290d442d14615e",
        "crlf": "3107103e1e87d5e6dd49403bc21d6863ceb04785d1445a8c98c91608bbeeb7d3"
      },
      "currentBytes": 303719,
      "targetBlob": "fd9ad23bf69fee2cb31b6dcc4cdf2b0126b0250d",
      "targetSha256": "5cbd491362f8e34087bd783b5382ff265f9f1aa5946c446b5905c2118dcbcfff",
      "targetBytes": 302698,
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
export const SALE_SOURCE_SHA256 = "c76a88cd394fdb1723d595b3287f604591f9f6c9e8897f9c28968c2992b5f3d4";
