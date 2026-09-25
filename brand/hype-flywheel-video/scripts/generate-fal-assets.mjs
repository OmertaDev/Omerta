import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const outputDir = path.join(root, "public", "art", "hype");
const manifestPath = path.join(outputDir, "flywheel-v3-manifest.json");

const argValue = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 || !process.argv[index + 1]
    ? fallback
    : process.argv[index + 1];
};

const key = String(process.env.FAL_KEY || "").trim();
if (!key) {
  throw new Error(
    "FAL_KEY is required. The key is read from the process only and is never written to disk.",
  );
}

const videoModel =
  process.env.FAL_VIDEO_MODEL || "bytedance/seedance-2.5/text-to-video";
const videoResolution = process.env.FAL_RES || "480p";
const videoDuration = "6";
const ttsModel = process.env.FAL_TTS_MODEL || "fal-ai/minimax/speech-02-hd";
const ttsVoice = process.env.FAL_TTS_VOICE || "Deep_Voice_Man";
const perSecondEstimateUsd = videoResolution === "480p" ? 0.2205 : 0.473;
const videoEstimateUsd = perSecondEstimateUsd * Number(videoDuration);
const ttsEstimatePerThousandCharactersUsd = 0.1;
const capUsd = Number(argValue("--cap", "18.5"));
const headers = {
  Authorization: `Key ${key}`,
  "Content-Type": "application/json",
};
const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

const look = [
  "cinematic 1940s film noir",
  "premium prestige-game trailer",
  "moody amber and teal practical lighting",
  "wet black stone, brass, smoked glass, volumetric haze",
  "35mm texture, deep blacks, controlled highlights",
  "physically coherent motion, dynamic camera",
  "no readable text, no letters, no logos, no watermark",
].join(", ");

const videoCatalog = [
  {
    id: "flywheel-v3-city",
    prompt:
      `Night aerial dives into a rain-soaked harbor city alive with couriers, gamblers, market runners, ` +
      `shopkeepers, and discreet machine operators. Fine gold ledger pulses connect districts like a living ` +
      `circuit while warm windows ignite block by block. Accelerating crane move between rooftops into a ` +
      `street-level crowd, one continuous shot, ${look}.`,
  },
  {
    id: "flywheel-v3-desk",
    prompt:
      `Macro kinetic sequence at an art-deco auction desk. A gloved hand places a finite stack of embossed ` +
      `gold game tokens onto a bounded brass shelf, a gavel strikes, then the same tokens travel on a circular ` +
      `mechanism toward waiting bidders and return to circulation. Clearly reuse and inventory cycling, never ` +
      `burning and never multiplying. Fast orbiting camera, satisfying mechanical conservation, ${look}.`,
  },
  {
    id: "flywheel-v3-buyback",
    prompt:
      `A colossal art-deco financial engine operates inside an underground vault. Sealed glass pipes carry ` +
      `emerald light from a real-revenue ledger into a brass market mechanism. A mechanical arm purchases ` +
      `existing gold game tokens from an open exchange tray, then a precise splitter sends equal conserved ` +
      `stacks into a green reserve vault and an amber prize vault. Powerful lateral tracking shot, ${look}.`,
  },
  {
    id: "flywheel-v3-network",
    prompt:
      `A crowded living noir exchange at night: human buyers and sellers, couriers, bookmakers, lenders, ` +
      `family captains, and subtle retro-futurist machine operators exchange contracts, loan papers, crates, ` +
      `and bids. Thin gold connections multiply as new participants arrive; empty counters become active and ` +
      `the room gains energy. Camera races through the market then rises above the network, ${look}.`,
  },
  {
    id: "flywheel-v3-deeds",
    prompt:
      `A continuous cinematic move begins inches above an ornate brass property deed with an engraved blank ` +
      `street grid, then dives into the living rain-soaked city block represented on it. A permanent golden ` +
      `provenance thread stays bound to the deed while two rival noir crews contest the physical street corner ` +
      `and a cyan control beacon changes hands. The paper remains untouched as the active corner changes control. ` +
      `End on a high oblique view that clearly separates enduring property from contestable street control, ${look}.`,
  },
  {
    id: "flywheel-v3-rwa",
    prompt:
      `A ceremonial art-deco commission chamber visualizes a future gated asset rail without brands or readable ` +
      `labels. Six family silhouettes cast brass ballots toward one approved blank market medallion. The selected ` +
      `medallion passes through a sealed glass treasury machine that accepts only the emerald light already inside, ` +
      `then produces a conserved set of blue-green stock-token coins in a transparent custody vault. Precisely ` +
      `measured units travel along one locked rail into a brass street-deed vault. Deterministic machinery, no random ` +
      `drops, no charts, no price movement, no currency symbols, no financial-brand likenesses, ${look}.`,
  },
  {
    id: "flywheel-v3-vault",
    prompt:
      `A perfectly symmetrical steel bank vault contains a visibly funded green reserve behind glass. A fully ` +
      `constructed brass extraction rail leads to the vault but is stopped by a physical red audit gate; tokens ` +
      `queue safely before it and none cross. Ledger reflections show exact conservation. Slow ominous push-in ` +
      `followed by a hard rack focus from the reserve to the locked gate, ${look}.`,
  },
  {
    id: "flywheel-v3-loop",
    prompt:
      `Hero shot of an enormous art-deco mechanical flywheel with five icon stations: a player silhouette, a ` +
      `storefront, circular inventory arrows, a market gavel, and a trophy. Golden energy races clockwise around ` +
      `the ring; every completed turn lights more of the rain-soaked noir city behind it. The camera orbits the ` +
      `machine, then pulls back for a monumental centered finale, ${look}.`,
  },
];

const requestedVideoIds = argValue("--video-ids", "flywheel-v3-loop")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const videoAssets =
  requestedVideoIds.length === 1 && requestedVideoIds[0] === "all"
    ? videoCatalog
    : videoCatalog.filter((asset) => requestedVideoIds.includes(asset.id));
const unknownVideoIds = requestedVideoIds.filter(
  (id) => id !== "all" && !videoCatalog.some((asset) => asset.id === id),
);
if (unknownVideoIds.length > 0) {
  throw new Error(
    `Unknown --video-ids value(s): ${unknownVideoIds.join(", ")}`,
  );
}

export const narration = [
  "OMERTÀ does not pay O-M-R for waiting. Value starts when players act.",
  "Crimes create stakes. Markets create counterparties. Crews turn coordination into territory.",
  "Most supported house sinks recycle O-M-R to the Desk, where the city prices the same supply again.",
  "Separately, arrived revenue caps the Vig. When armed, it buys O-M-R from the market and splits it between the reserve and prizes.",
  "More players mean more trades, contracts, rivals, and families. More liquidity makes every loop stronger.",
  "Play. Spend. Recycle. Buy back. Reward. Repeat.",
  "The rail is built and devnet-proven. Production stays chain-unconfigured until the security gates clear.",
  "One account, one named Street Deed. The legend survives death, while corner cash and perks belong only to whoever controls the block.",
  "When armed, families vote an approved ticker. A walled treasury buys only what arrived; active play earns Stock Tokens delivered into an extracted Deed's vault.",
];

fs.mkdirSync(outputDir, { recursive: true });

let manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : {
      campaign: "OMERTA hype flywheel",
      sourceRevision: null,
      videoModel,
      ttsModel,
      ttsVoice,
      generatedAt: null,
      estimatedSpendUsd: 0,
      assets: [],
      voiceover: [],
    };

const currentRevision = () => {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
};

const saveManifest = () => {
  manifest.sourceRevision = currentRevision();
  manifest.videoModel = videoModel;
  manifest.ttsModel = ttsModel;
  manifest.ttsVoice = ttsVoice;
  manifest.generatedAt = new Date().toISOString();
  const temporary = `${manifestPath}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.renameSync(temporary, manifestPath);
};

const existingVideo = (asset) => {
  const destination = path.join(outputDir, `${asset.id}.mp4`);
  const record = manifest.assets.find((candidate) => candidate.id === asset.id);
  return Boolean(
    fs.existsSync(destination) &&
    record &&
    record.model === videoModel &&
    record.promptSha256 === hash(asset.prompt),
  );
};

const existingVoice = (text, index) => {
  const destination = path.join(outputDir, `vo-flywheel-v3-${index}.mp3`);
  const record = manifest.voiceover.find(
    (candidate) => candidate.index === index,
  );
  return Boolean(
    fs.existsSync(destination) &&
    record &&
    record.model === ttsModel &&
    record.voice === ttsVoice &&
    record.text === text,
  );
};

const missingVideos = videoAssets.filter((asset) => !existingVideo(asset));
const missingVoice = narration
  .map((text, index) => ({ text, index }))
  .filter(({ text, index }) => !existingVoice(text, index));
const voiceCharacters = missingVoice.reduce(
  (sum, item) => sum + item.text.length,
  0,
);
const estimatedPassSpend =
  missingVideos.length * videoEstimateUsd +
  (voiceCharacters / 1000) * ttsEstimatePerThousandCharactersUsd;

if (!Number.isFinite(capUsd) || capUsd <= 0) {
  throw new Error("--cap must be a positive dollar amount.");
}
if (estimatedPassSpend > capUsd + 0.0001) {
  throw new Error(
    `This pass is estimated at $${estimatedPassSpend.toFixed(2)}, above the $${capUsd.toFixed(2)} cap.`,
  );
}

console.log(
  `flywheel: ${missingVideos.length} video plate(s), ${missingVoice.length} voice segment(s) missing; ` +
    `estimated new spend $${estimatedPassSpend.toFixed(2)} / $${capUsd.toFixed(2)} cap`,
);

const responseSummary = async (response) => {
  const value = await response.json().catch(() => ({}));
  return { value, message: JSON.stringify(value).slice(0, 500) };
};

const fetchReadWithRetry = async (url, options, label) => {
  let lastError;
  for (let attempt = 0; attempt < 7; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(45000),
      });
      if (response.status < 500 && response.status !== 429) return response;
      lastError = new Error(`${label}: HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(Math.min(30000, 2500 * 2 ** attempt));
  }
  throw new Error(`${label}: retry budget exhausted`, { cause: lastError });
};

const submitVideo = async (asset) => {
  const endpoint = `https://queue.fal.run/${videoModel}`;
  const body = {
    prompt: asset.prompt,
    resolution: videoResolution,
    aspect_ratio: "16:9",
    duration: videoDuration,
    generate_audio: false,
  };
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const { value, message } = await responseSummary(response);
    if (response.ok && value.request_id) {
      const job = {
        asset,
        requestId: value.request_id,
        responseUrl:
          value.response_url ||
          `https://queue.fal.run/${videoModel}/requests/${value.request_id}`,
        statusUrl:
          value.status_url ||
          `https://queue.fal.run/${videoModel}/requests/${value.request_id}/status`,
      };
      manifest.pendingRequests = (manifest.pendingRequests || []).filter(
        (candidate) => candidate.assetId !== asset.id,
      );
      manifest.pendingRequests.push({
        assetId: asset.id,
        requestId: job.requestId,
        responseUrl: job.responseUrl,
        statusUrl: job.statusUrl,
        promptSha256: hash(asset.prompt),
        estimatedSpendUsd: videoEstimateUsd,
        queuedAt: new Date().toISOString(),
      });
      saveManifest();
      console.log(`  queued ${asset.id} (${job.requestId})`);
      return job;
    }
    if (response.status === 403 && attempt < 5) {
      const seconds = 8 + attempt * 7;
      console.log(
        `  ${asset.id}: balance reservation bounced; retrying in ${seconds}s`,
      );
      await sleep(seconds * 1000);
      continue;
    }
    throw new Error(
      `fal video submit ${asset.id}: HTTP ${response.status} ${message}`,
    );
  }
  throw new Error(`fal video submit ${asset.id}: retry budget exhausted`);
};

const waitForVideo = async (job) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20 * 60 * 1000) {
    const statusResponse = await fetchReadWithRetry(
      job.statusUrl,
      { headers },
      `fal video status ${job.asset.id}`,
    );
    const { value: status, message } = await responseSummary(statusResponse);
    if (!statusResponse.ok) {
      if (statusResponse.status >= 500) {
        await sleep(10000);
        continue;
      }
      throw new Error(
        `fal video status ${job.asset.id}: HTTP ${statusResponse.status} ${message}`,
      );
    }
    if (status.status === "COMPLETED") {
      const resultResponse = await fetchReadWithRetry(
        job.responseUrl,
        { headers },
        `fal video result ${job.asset.id}`,
      );
      const { value: result, message: resultMessage } =
        await responseSummary(resultResponse);
      const url = result?.video?.url || result?.videos?.[0]?.url;
      if (!resultResponse.ok || !url) {
        throw new Error(
          `fal video result ${job.asset.id}: HTTP ${resultResponse.status} ${resultMessage}`,
        );
      }
      const mediaResponse = await fetchReadWithRetry(
        url,
        {},
        `fal media download ${job.asset.id}`,
      );
      if (!mediaResponse.ok) {
        throw new Error(
          `fal media download ${job.asset.id}: HTTP ${mediaResponse.status}`,
        );
      }
      const destination = path.join(outputDir, `${job.asset.id}.mp4`);
      fs.writeFileSync(
        destination,
        Buffer.from(await mediaResponse.arrayBuffer()),
      );
      manifest.assets = manifest.assets.filter(
        (candidate) => candidate.id !== job.asset.id,
      );
      manifest.assets.push({
        id: job.asset.id,
        type: "video",
        model: videoModel,
        resolution: videoResolution,
        aspectRatio: "16:9",
        durationSeconds: Number(videoDuration),
        generatedAudio: false,
        prompt: job.asset.prompt,
        promptSha256: hash(job.asset.prompt),
        requestId: job.requestId,
        url,
        estimatedSpendUsd: videoEstimateUsd,
      });
      manifest.pendingRequests = (manifest.pendingRequests || []).filter(
        (candidate) => candidate.requestId !== job.requestId,
      );
      manifest.estimatedSpendUsd = Number(
        (Number(manifest.estimatedSpendUsd || 0) + videoEstimateUsd).toFixed(4),
      );
      saveManifest();
      console.log(`  landed ${job.asset.id}`);
      return;
    }
    if (status.status === "FAILED") {
      throw new Error(`fal video ${job.asset.id} failed: ${message}`);
    }
    await sleep(10000);
  }
  throw new Error(`fal video ${job.asset.id}: timed out after 20 minutes`);
};

const generateVoice = async ({ text, index }) => {
  const response = await fetch(`https://fal.run/${ttsModel}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      text,
      voice_setting: {
        voice_id: ttsVoice,
        speed: 0.92,
        pitch: 0,
        vol: 1,
        english_normalization: false,
      },
      audio_setting: {
        sample_rate: 44100,
        bitrate: 256000,
        format: "mp3",
        channel: 1,
      },
      output_format: "url",
    }),
  });
  const { value, message } = await responseSummary(response);
  const url = value?.audio?.url || value?.audio_url || value?.url;
  if (!response.ok || !url) {
    throw new Error(
      `fal TTS segment ${index}: HTTP ${response.status} ${message}`,
    );
  }
  const mediaResponse = await fetch(url);
  if (!mediaResponse.ok) {
    throw new Error(`fal TTS download ${index}: HTTP ${mediaResponse.status}`);
  }
  fs.writeFileSync(
    path.join(outputDir, `vo-flywheel-v3-${index}.mp3`),
    Buffer.from(await mediaResponse.arrayBuffer()),
  );
  manifest.voiceover = manifest.voiceover.filter(
    (candidate) => candidate.index !== index,
  );
  manifest.voiceover.push({
    index,
    text,
    type: "audio",
    model: ttsModel,
    voice: ttsVoice,
    url,
  });
  const estimate = (text.length / 1000) * ttsEstimatePerThousandCharactersUsd;
  manifest.estimatedSpendUsd = Number(
    (Number(manifest.estimatedSpendUsd || 0) + estimate).toFixed(4),
  );
  saveManifest();
  console.log(`  landed voice ${index}`);
};

for (const item of missingVoice) {
  await generateVoice(item);
}

const jobs = [];
for (let index = 0; index < missingVideos.length; index += 3) {
  const group = missingVideos.slice(index, index + 3);
  jobs.push(...(await Promise.all(group.map((asset) => submitVideo(asset)))));
}

await Promise.all(jobs.map((job) => waitForVideo(job)));
saveManifest();
console.log("flywheel fal assets are complete");
