/** Seconds on the film timeline; StoryScene receives the local frame of its Sequence. */
export type StorySceneName =
  | 'street' | 'paths' | 'drive' | 'cargo' | 'recruitment' | 'approach'
  | 'ambush' | 'prison' | 'loss' | 'evidence' | 'family' | 'agent'
  | 'balances' | 'fees' | 'bonds' | 'liquidity' | 'rwa' | 'closing';

export type StoryShot = {
  id: string;
  start: number;
  end: number;
  scene: StorySceneName;
  /** An asset key (for example dock-background) or a local art/flagship-animation path. */
  asset?: string;
  accent?: string;
  headline?: string;
  labels?: string[];
  /** 0–5 selects a Path. Omit to move through all six. */
  focus?: number;
  /** Optional scene direction: empty, joined, training, banking, extraction, etc. */
  variant?: string;
  caption?: string;
};
