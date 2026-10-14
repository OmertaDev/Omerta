import type {AssetWindow, Film, Manifest, PlannedBeat, ProductionData} from './types';

export const FPS = 30;

export const planTimeline = (
  film: Film,
  manifest: Manifest,
  assetWindows?: ProductionData['assetWindows'],
): PlannedBeat[] => {
  const occurrences: Record<string, number> = {};
  const consumedFrames: Record<string, number> = {};
  return film.timeline.map((beat, index) => {
    const startFrame = Math.round(beat.start * FPS);
    const durationFrames = Math.max(1, Math.round(beat.end * FPS) - startFrame);
    const asset = manifest.assets[beat.asset];
    const capture = manifest.assets[beat.captureAsset ?? `R3-V${Number(film.id)}-B${String(index + 1).padStart(2, '0')}-CAPTURE`];
    const captureRequired = beat.captureRequired ?? (
      !/-END$|-PRINCIPAL$/.test(beat.asset) && (
        /\b(actual|captur(?:e|ed|es)|genuine|real|same-account)\b/i.test(`${beat.primary} ${beat.tertiary}`) ||
        /^EDIT-(V1-EVIDENCE|V2-SWAP|V3-PRIOR|V3-EVIDENCE|V3-APPROVAL|V3-HISTORY)$/.test(beat.asset)
      )
    );
    const totalSourceFrames = Math.max(1, Math.floor((asset?.duration ?? 5) * FPS));
    const occurrence = occurrences[beat.asset] ?? 0;
    const configured = film.assetWindows?.[beat.asset] ?? assetWindows?.[beat.asset];
    const window: AssetWindow | undefined = beat.assetWindow ??
      (Array.isArray(configured) ? configured[occurrence] : configured);
    const fallbackStart = (consumedFrames[beat.asset] ?? 0) % totalSourceFrames;
    const sourceStartFrame = Math.min(
      totalSourceFrames - 1,
      Math.max(0, window ? Math.round(window.start * FPS) : fallbackStart),
    );
    const sourceEndFrame = Math.min(
      totalSourceFrames,
      window?.end === undefined ? totalSourceFrames : Math.round(window.end * FPS),
    );
    occurrences[beat.asset] = occurrence + 1;
    consumedFrames[beat.asset] = (consumedFrames[beat.asset] ?? 0) + durationFrames;
    return {
      beat,
      index,
      startFrame,
      durationFrames,
      asset,
      capture,
      captureRequired,
      sourceStartFrame,
      sourceDurationFrames: Math.max(1, Math.min(durationFrames, sourceEndFrame - sourceStartFrame)),
    };
  });
};
