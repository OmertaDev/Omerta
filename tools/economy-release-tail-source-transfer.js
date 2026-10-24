// Exact source-only tail for the post-seal Capo, SQL-source-pin, and historical-fixture repairs.
// It reconstructs the reviewed pre-tail candidate without inheriting runtime clearance.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const blob = (text) => crypto.createHash('sha1')
  .update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const normalize = (input) => {
  assert.equal(typeof input, 'string');
  const text = input.replaceAll('\r\n', '\n');
  assert(!text.includes('\r') && (input === text || input === text.replaceAll('\n', '\r\n')),
    'Only whole LF or uniform CRLF source');
  return text;
};

export const ECONOMY_RELEASE_TAIL_REVISION = 'e7eb07002b3e0fe228c08dc3a0629cf8dfa9fcef';
export const ECONOMY_RELEASE_TAIL_TREE = 'd01fa423d71d4cfb82928cf08aaa24f1c4d42d5f';
export const ECONOMY_RELEASE_TAIL_PREDECESSOR = 'f8de8b7ad0ec4ede750f6f94012494b1a9cdb1d5';
export const ECONOMY_RELEASE_TAIL_PREDECESSOR_TREE = 'e7d0258572f42959687c5e7ffb24446c43eccda6';
export const ECONOMY_RELEASE_TAIL_PHASE =
  'exact-economy-release-tail-source-transfer-only; no runtime, native, migration, financial, activation or deployment clearance';
export const ECONOMY_RELEASE_TAIL_DOMAINS = freeze({
  "src/growth.js": {
    "mode": "100644",
    "currentSha256": "8c1de1178b3d8a600298e0a6346ac09973b752fb90b82ffab30105d6eab7093a",
    "currentBlob": "18e793ca4550575e8c2dda227746e333f169e77b",
    "currentBytes": 81054,
    "baselineSha256": "f36c79803195e9e63eeade87c7f6b8e51f518af73eac3cbd2eecdab0c8b8cd52",
    "baselineBlob": "a6f39f7830fd306be78c0ca4137c1720b760daf3",
    "baselineBytes": 81056,
    "contextLines": 3,
    "inverses": [
      {
        "current": "    } catch (error) {\n      await client.query('ROLLBACK').catch(() => {});\n      throw error;\n    } finally { client.release(); }\n    updated += last.updated;\n    processed += last.processed;\n    if (!last.hasMore) { pages++; break; }\n",
        "baseline": "    } catch (error) {\n      await client.query('ROLLBACK').catch(() => {});\n      throw error;\n    } finally { client.release?.(); }\n    updated += last.updated;\n    processed += last.processed;\n    if (!last.hasMore) { pages++; break; }\n"
      }
    ]
  },
  "test/gates.js": {
    "mode": "100644",
    "currentSha256": "757ed0f0a379f0f66ec85688f419c909b5d43d90314a634042ddc1e74c8a72ec",
    "currentBlob": "26fc452d7fa405ea5df2dde3ef21a1fc28ac5fde",
    "currentBytes": 458207,
    "baselineSha256": "98f73f521bc429f49755b6d2dcdc946f791bee2a9b165dc90ef89d82f60eca53",
    "baselineBlob": "f085576b8f77cd01e788d91e3fadab7176923361",
    "baselineBytes": 455562,
    "contextLines": 3,
    "inverses": [
      {
        "current": "    if(normalized.includes('\\r')||(source!==normalized&&source!==normalized.replaceAll('\\n','\\r\\n')))return false;\n    const fields={\n  \"commercialcampaigns.js\": {\n    \"sha256\": \"aa9f3b47f939f6a2df00d923fd3eaede4bdad19fb7a3e20c92e3257ea13373ab\",\n    \"key\": \"kind\",\n    \"variable\": \"entry\",\n    \"member\": \"kind\",\n",
        "baseline": "    if(normalized.includes('\\r')||(source!==normalized&&source!==normalized.replaceAll('\\n','\\r\\n')))return false;\n    const fields={\n  \"commercialcampaigns.js\": {\n    \"sha256\": \"f2826c3c58539ae7c160c8302545d367e9d883e6ebf0e74a0f64957f0775511c\",\n    \"key\": \"kind\",\n    \"variable\": \"entry\",\n    \"member\": \"kind\",\n"
      },
      {
        "current": "    \"src/coordination/knowledge.js|keys.join(',')\": 'insert helper row keys are fixed source-owned object properties; values including player-authored text are separately bound, and rebuild rows come only from those same fixed event schemas',\n    'src/coordination/knowledge.js|key': \"insert undo predicate is only the literal 'id' or 'claim_id', chosen by own-property presence\",\n    'src/coordination/knowledge.js|MAX_EVIDENCE + 1': 'module-private constant MAX_EVIDENCE=256 plus one overflow sentinel; neither term comes from the request or mutable state',\n    'src/growth.js|pageSize + 1': 'boundedSweepOption returns a positive integer capped at the module-private 500-row maximum; only the LIMIT number enters SQL text',\n    'src/growth.js|qualificationJoins': 'boot-established dbCaps selects either an empty string or one fixed JOIN fragment; every identity remains a bound parameter',\n    'src/growth.js|qualificationExists': 'boot-established dbCaps selects either an empty string or one fixed EXISTS fragment; every identity remains a bound parameter',\n\n    // LOCALLY-BUILT PAGINATION FRAGMENTS. Each is a template containing only $n placeholders; the\n    // cursor VALUES are validated in pageOptions and pushed as bound parameters, never spliced.\n",
        "baseline": "    \"src/coordination/knowledge.js|keys.join(',')\": 'insert helper row keys are fixed source-owned object properties; values including player-authored text are separately bound, and rebuild rows come only from those same fixed event schemas',\n    'src/coordination/knowledge.js|key': \"insert undo predicate is only the literal 'id' or 'claim_id', chosen by own-property presence\",\n    'src/coordination/knowledge.js|MAX_EVIDENCE + 1': 'module-private constant MAX_EVIDENCE=256 plus one overflow sentinel; neither term comes from the request or mutable state',\n\n    // LOCALLY-BUILT PAGINATION FRAGMENTS. Each is a template containing only $n placeholders; the\n    // cursor VALUES are validated in pageOptions and pushed as bound parameters, never spliced.\n"
      },
      {
        "current": "    const normalized=source.replaceAll('\\r\\n','\\n');\n    return rel==='src/commercialcampaigns.js'&&!normalized.includes('\\r')\n      &&(source===normalized||source===normalized.replaceAll('\\n','\\r\\n'))\n      &&createHash('sha256').update(normalized).digest('hex')==='aa9f3b47f939f6a2df00d923fd3eaede4bdad19fb7a3e20c92e3257ea13373ab'\n      &&[\"columns.join(',')\",\"columns.map((_, i) => '$' + (i + 1)).join(',')\"].includes(expr);\n  };\n  const commercialInsertSource=fs.readFileSync(path.join(SRC,'commercialcampaigns.js'),'utf8');\n",
        "baseline": "    const normalized=source.replaceAll('\\r\\n','\\n');\n    return rel==='src/commercialcampaigns.js'&&!normalized.includes('\\r')\n      &&(source===normalized||source===normalized.replaceAll('\\n','\\r\\n'))\n      &&createHash('sha256').update(normalized).digest('hex')==='f2826c3c58539ae7c160c8302545d367e9d883e6ebf0e74a0f64957f0775511c'\n      &&[\"columns.join(',')\",\"columns.map((_, i) => '$' + (i + 1)).join(',')\"].includes(expr);\n  };\n  const commercialInsertSource=fs.readFileSync(path.join(SRC,'commercialcampaigns.js'),'utf8');\n"
      },
      {
        "current": "  // source rows, consent/actor revalidation and conditional SQL own cross-worker state.\n  const exactCommerceCompletionPosture = (key, source) => {\n    const seals={\n  \"commercialcampaigns.js:completions\": \"aa9f3b47f939f6a2df00d923fd3eaede4bdad19fb7a3e20c92e3257ea13373ab\",\n  \"merchantloyalty.js:purchaseContexts\": \"8cf4b3e14f7f5f2ef0a798cd1e435bac4fdf50ea96c25a546b30032faf4bf700\",\n  \"saleattribution.js:purchaseScopes\": \"6fe23fcc2ab1413eac75bf69776a0df1b7a6c7c27213f9758eadbb51839ccd13\",\n  \"shoppingbasket.js:purchaseScopes\": \"40a57a58f485354e31d5108252893aa122af6d97c73f3ae688f66f2bd0f903d6\"\n",
        "baseline": "  // source rows, consent/actor revalidation and conditional SQL own cross-worker state.\n  const exactCommerceCompletionPosture = (key, source) => {\n    const seals={\n  \"commercialcampaigns.js:completions\": \"f2826c3c58539ae7c160c8302545d367e9d883e6ebf0e74a0f64957f0775511c\",\n  \"merchantloyalty.js:purchaseContexts\": \"8cf4b3e14f7f5f2ef0a798cd1e435bac4fdf50ea96c25a546b30032faf4bf700\",\n  \"saleattribution.js:purchaseScopes\": \"6fe23fcc2ab1413eac75bf69776a0df1b7a6c7c27213f9758eadbb51839ccd13\",\n  \"shoppingbasket.js:purchaseScopes\": \"40a57a58f485354e31d5108252893aa122af6d97c73f3ae688f66f2bd0f903d6\"\n"
      },
      {
        "current": "    // Mask only this exact error token; variables/SQL columns are never masked.\n    return source.replace(original,original.replace(\"fail('already_used')\",'fail()'));\n  };\n  const socialProofConsumedConflict=(file,source)=>{\n    const original=\"new GameError('proof_used', 'That X post has already earned a social reward.')\";\n    const normalized=source.replaceAll('\\r\\n','\\n');\n    if(file!=='src/growth.js'||source.split(original).length!==4||normalized.includes('\\r')\n      ||(source!==normalized&&source!==normalized.replaceAll('\\n','\\r\\n'))\n      ||createHash('sha256').update(normalized).digest('hex')!=='8c1de1178b3d8a600298e0a6346ac09973b752fb90b82ffab30105d6eab7093a')return source;\n    // These three refusals read the permanent provider/post receipt, not a refillable allowance.\n    // Mask only the reviewed error token; a same-named counter or changed claim path remains visible.\n    return source.replaceAll(original,original.replace(\"'proof_used'\",\"'proof'\"));\n  };\n\n  const bucketSource = (file, source) => file === 'src/merchantloyalty.js' ? merchantConsumedConflict(file,source) : file === 'src/growth.js'\n    ? socialProofConsumedConflict(file,source) : file === 'src/companyworkflows.js'\n    ? source.replace(/\\bfail\\('(source_used|proof_used)'\\)/g, '')\n    : ['src/commercialnegotiation.js', 'src/territoryeconomics.js'].includes(file) ? source.replace(/\\bfail\\('source_used'\\)/g, '') : laboratorySourceConflict(file,source);\n  const bucketNames = (file, source) => [...bucketSource(file, source).matchAll(/\\b(\\w+)_used\\b/g)].map(m => `${m[1]}_used`);\n",
        "baseline": "    // Mask only this exact error token; variables/SQL columns are never masked.\n    return source.replace(original,original.replace(\"fail('already_used')\",'fail()'));\n  };\n\n  const bucketSource = (file, source) => file === 'src/merchantloyalty.js' ? merchantConsumedConflict(file,source) : file === 'src/companyworkflows.js'\n    ? source.replace(/\\bfail\\('(source_used|proof_used)'\\)/g, '')\n    : ['src/commercialnegotiation.js', 'src/territoryeconomics.js'].includes(file) ? source.replace(/\\bfail\\('source_used'\\)/g, '') : laboratorySourceConflict(file,source);\n  const bucketNames = (file, source) => [...bucketSource(file, source).matchAll(/\\b(\\w+)_used\\b/g)].map(m => `${m[1]}_used`);\n"
      },
      {
        "current": "  assert(bucketNames('src/merchantloyalty.js',\"const already_used=0; client.query('SELECT already_used FROM meters');\").includes('already_used'),'Real counters and columns remain in the corpus');\n  assert(bucketNames('src/merchantloyalty.js',merchantBucket+'\\nconst unknown_used=0;').includes('unknown_used'));\n\n  const socialProofBucket=fs.readFileSync('src/growth.js','utf8');\n  assert(!bucketNames('src/growth.js',socialProofBucket).includes('proof_used'),\n    'Only the three exact permanent social-proof receipt conflicts are classified');\n  assert(!bucketNames('src/growth.js',socialProofBucket.replaceAll('\\r\\n','\\n').replaceAll('\\n','\\r\\n')).includes('proof_used'));\n  for(const changed of [\n    socialProofBucket.replace(\"SOCIAL_PROOF_SCOPE, SOCIAL_PROOF_CLAIM\", \"'other-scope', SOCIAL_PROOF_CLAIM\"),\n    socialProofBucket.replace('socialProofWasUsed(client, normalized)', 'false'),\n    socialProofBucket+'\\nconst proof_used=0; const proof_at=Date.now();\\n',\n  ]){assert.notEqual(changed,socialProofBucket);assert(bucketNames('src/growth.js',changed).includes('proof_used'),\n    'Changed social receipt identity/read/refill source remains unclassified');}\n  assert(bucketNames('src/unknown.js',socialProofBucket).includes('proof_used'));\n  assert(bucketNames('src/growth.js',\"throw new GameError('proof_used', 'other');\").includes('proof_used'));\n  assert(bucketNames('src/growth.js',socialProofBucket+'\\nclient.query(\\'SELECT proof_used FROM meters\\');').includes('proof_used'),\n    'Actual proof counters cannot hide behind the immutable receipt conflict');\n\n  assert.deepEqual(bucketNames('src/companyworkflows.js', \"fail('source_used'); fail('proof_used');\"), []);\n  assert.deepEqual(bucketNames('src/commercialnegotiation.js', \"fail('source_used');\"), []);\n  assert.deepEqual(bucketNames('src/commercialnegotiation.js', 'const source_used = 0;'), ['source_used']);\n",
        "baseline": "  assert(bucketNames('src/merchantloyalty.js',\"const already_used=0; client.query('SELECT already_used FROM meters');\").includes('already_used'),'Real counters and columns remain in the corpus');\n  assert(bucketNames('src/merchantloyalty.js',merchantBucket+'\\nconst unknown_used=0;').includes('unknown_used'));\n\n  assert.deepEqual(bucketNames('src/companyworkflows.js', \"fail('source_used'); fail('proof_used');\"), []);\n  assert.deepEqual(bucketNames('src/commercialnegotiation.js', \"fail('source_used');\"), []);\n  assert.deepEqual(bucketNames('src/commercialnegotiation.js', 'const source_used = 0;'), ['source_used']);\n"
      }
    ]
  },
  "test/lib/rc1-historical-source-fixture.js": {
    "mode": "100644",
    "currentSha256": "cf908ead1783070271e6071ee5420959d557161c31ee91977f3dcc40be250083",
    "currentBlob": "c5e37721bfa33ab6f85e7b570e7d987793f936de",
    "currentBytes": 44876,
    "baselineSha256": "b3164b9d85e56a7da1b909b8678ea83262b144e210a425a2aedb8a5b2e0d7570",
    "baselineBlob": "a4bece17954393263f183e99deca72b094940739",
    "baselineBytes": 44640,
    "contextLines": 3,
    "inverses": [
      {
        "current": "  'src/cityhomes.js', 'src/corner.js', 'src/economy.js', 'src/goodsmarket.js', 'src/goodsquote.js',\n  'src/growth.js', 'src/heists.js', 'src/hustle.js', 'src/kitchen.js', 'src/opportunities.js',\n  'src/pen.js', 'src/population.js', 'src/races.js', 'src/routes/rwa.js',\n  'src/rules.tail.js', 'src/social/combat.js', 'src/stable.js', 'src/streets.js', 'src/verify.js',\n  'src/wire.js',\n]);\nconst npcEntries = new Set([\n  'test/rc1-npc-retirement-journal.js', 'test/rc1-car-melt-provenance.js',\n",
        "baseline": "  'src/cityhomes.js', 'src/corner.js', 'src/economy.js', 'src/goodsmarket.js', 'src/goodsquote.js',\n  'src/growth.js', 'src/heists.js', 'src/hustle.js', 'src/kitchen.js', 'src/opportunities.js',\n  'src/pen.js', 'src/population.js', 'src/races.js', 'src/routes/rwa.js',\n  'src/rules.tail.js', 'src/social/combat.js', 'src/stable.js', 'src/streets.js',\n]);\nconst npcEntries = new Set([\n  'test/rc1-npc-retirement-journal.js', 'test/rc1-car-melt-provenance.js',\n"
      },
      {
        "current": "  const combinedCurrents = new Map();\n  for (const combinedFile of enterpriseCombinedHistoricalFiles) {\n    const combinedRow = ENTERPRISE_NATIVE_RELEASE_INPUTS.replacements.find(row => row.file === combinedFile);\n    const physicalRaw = canonical(originalRead(path.join(root, combinedFile)));\n    const physicalDigest = sha256(physicalRaw);\n    const physicalCurrent = physicalDigest === combinedRow.after.sha256 || physicalDigest === combinedRow.before.sha256\n      ? physicalRaw\n      : canonical(continuousCityHistoricalInput(combinedFile, physicalRaw));\n    const combinedCurrent = String(git(['cat-file', 'blob', combinedRow.after.blob]));\n    const combinedFrozen = String(blob(combinedFile, release));\n    const combinedExpected = blob(combinedFile, history);\n",
        "baseline": "  const combinedCurrents = new Map();\n  for (const combinedFile of enterpriseCombinedHistoricalFiles) {\n    const combinedRow = ENTERPRISE_NATIVE_RELEASE_INPUTS.replacements.find(row => row.file === combinedFile);\n    const physicalCurrent = canonical(continuousCityHistoricalInput(combinedFile,\n      String(originalRead(path.join(root, combinedFile)))));\n    const combinedCurrent = String(git(['cat-file', 'blob', combinedRow.after.blob]));\n    const combinedFrozen = String(blob(combinedFile, release));\n    const combinedExpected = blob(combinedFile, history);\n"
      }
    ]
  },
  "tools/pgquery.js": {
    "mode": "100644",
    "currentSha256": "91ee0cc750d081ac530374310926ae356c801e8c8c854cd14e7a2e3ded58f3bf",
    "currentBlob": "e561c463b27fd8c447c64ea306deaba97697f00c",
    "currentBytes": 20651,
    "baselineSha256": "bef8b095d7d3939f860cdc0c1c47cce03a959883d5c357bc432cbc2a5eefeeea",
    "baselineBlob": "6f5f348115123e15f3cc3d18d0bb12334045ad10",
    "baselineBytes": 20651,
    "contextLines": 3,
    "inverses": [
      {
        "current": "// a separate guard over the unchanged scanner corpus.\nfunction assertReviewedCommerceQueries(sources, readable, unreadableSites) {\n  const pins = {\n    'src/commercialcampaigns.js': 'aa9f3b47f939f6a2df00d923fd3eaede4bdad19fb7a3e20c92e3257ea13373ab',\n    'src/commercialcampaignruntime.js': '74b5776f868528d0dd1617095613648dc7b4ad9823e6096b944b6101d51f5afb',\n  };\n  if (JSON.stringify(Object.keys(sources).sort()) !== JSON.stringify(Object.keys(pins).sort()))\n",
        "baseline": "// a separate guard over the unchanged scanner corpus.\nfunction assertReviewedCommerceQueries(sources, readable, unreadableSites) {\n  const pins = {\n    'src/commercialcampaigns.js': 'f2826c3c58539ae7c160c8302545d367e9d883e6ebf0e74a0f64957f0775511c',\n    'src/commercialcampaignruntime.js': '74b5776f868528d0dd1617095613648dc7b4ad9823e6096b944b6101d51f5afb',\n  };\n  if (JSON.stringify(Object.keys(sources).sort()) !== JSON.stringify(Object.keys(pins).sort()))\n"
      }
    ]
  }
});

export function assertEconomyReleaseTailTransfer(file, input) {
  assert(Object.hasOwn(ECONOMY_RELEASE_TAIL_DOMAINS, file), 'Unknown economy release-tail source domain');
  const pin = ECONOMY_RELEASE_TAIL_DOMAINS[file], current = normalize(input);
  assert.equal(sha256(current), pin.currentSha256, 'Complete economy release-tail source drift: ' + file);
  assert.equal(blob(current), pin.currentBlob, 'Complete economy release-tail blob drift: ' + file);
  assert.equal(Buffer.byteLength(current), pin.currentBytes);
  let baselineText = current;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1,
      'Missing or duplicate economy release-tail inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha256(baselineText), pin.baselineSha256,
    'Complete economy release-tail predecessor source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob,
    'Complete economy release-tail predecessor blob mismatch: ' + file);
  assert.equal(Buffer.byteLength(baselineText), pin.baselineBytes);
  return Object.freeze({ file, baselineText, sourceRevision: ECONOMY_RELEASE_TAIL_REVISION,
    predecessorRevision: ECONOMY_RELEASE_TAIL_PREDECESSOR, inverseChunks: pin.inverses.length,
    phase: ECONOMY_RELEASE_TAIL_PHASE, sourceOnly: true, runtime: false, native: false });
}

export function economyReleaseTailHistoricalInput(file, input) {
  if (!Object.hasOwn(ECONOMY_RELEASE_TAIL_DOMAINS, file) || typeof input !== 'string') return input;
  const text = input.replaceAll('\r\n', '\n');
  if (sha256(text) !== ECONOMY_RELEASE_TAIL_DOMAINS[file].currentSha256) return input;
  return assertEconomyReleaseTailTransfer(file, input).baselineText;
}
