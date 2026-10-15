export type AssetWindow = {start: number; end?: number};

export type Beat = {
  start: number;
  end: number;
  speech: string;
  speaker: string;
  caption?: string;
  primary: string;
  tertiary: string;
  editorial?: string;
  tertiaryCaption?: string;
  asset: string;
  assetWindow?: AssetWindow;
  captureRequired?: boolean;
  captureAsset?: string;
};

export type Film = {
  id: string;
  title: string;
  duration: number;
  timeline: Beat[];
  assetWindows?: Record<string, AssetWindow | AssetWindow[]>;
};

export type ProductionData = {
  films: Film[];
  assetWindows?: Record<string, AssetWindow | AssetWindow[]>;
};

export type MediaAsset = {
  src: string;
  kind: 'video' | 'image';
  /** Source duration in seconds. Required for exact video trim/freeze behavior. */
  duration: number;
  muted: boolean;
};

export type Manifest = {
  assets: Record<string, MediaAsset>;
  audio: Record<string, string>;
};

export type PlannedBeat = {
  beat: Beat;
  index: number;
  startFrame: number;
  durationFrames: number;
  asset?: MediaAsset;
  captureRequired: boolean;
  capture?: MediaAsset;
  sourceStartFrame: number;
  sourceDurationFrames: number;
};
