import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { AbsoluteFill, Sequence, interpolate, staticFile } from "remotion";
import { BuybackLoop } from "./scenes/BuybackLoop";
import { ColdOpen } from "./scenes/ColdOpen";
import { DeskLoop } from "./scenes/DeskLoop";
import { DeedsLoop } from "./scenes/DeedsLoop";
import { FinalFlywheel } from "./scenes/FinalFlywheel";
import { NetworkLoop } from "./scenes/NetworkLoop";
import { PlayLoop } from "./scenes/PlayLoop";
import { ReserveGate } from "./scenes/ReserveGate";
import { RwaLoop } from "./scenes/RwaLoop";
import { colors } from "./theme";

export const FPS = 30;
export const TRANSITION_FRAMES = 12;
export const SCENE_DURATIONS = {
  coldOpen: 210,
  playLoop: 270,
  deskLoop: 255,
  buybackLoop: 310,
  networkLoop: 290,
  deedsLoop: 345,
  rwaLoop: 360,
  reserveGate: 255,
  finalFlywheel: 270,
} as const;

export const TOTAL_DURATION =
  Object.values(SCENE_DURATIONS).reduce((sum, duration) => sum + duration, 0) -
  TRANSITION_FRAMES * (Object.keys(SCENE_DURATIONS).length - 1);

const sceneStarts = {
  coldOpen: 0,
  playLoop: SCENE_DURATIONS.coldOpen - TRANSITION_FRAMES,
  deskLoop:
    SCENE_DURATIONS.coldOpen + SCENE_DURATIONS.playLoop - TRANSITION_FRAMES * 2,
  buybackLoop:
    SCENE_DURATIONS.coldOpen +
    SCENE_DURATIONS.playLoop +
    SCENE_DURATIONS.deskLoop -
    TRANSITION_FRAMES * 3,
  networkLoop:
    SCENE_DURATIONS.coldOpen +
    SCENE_DURATIONS.playLoop +
    SCENE_DURATIONS.deskLoop +
    SCENE_DURATIONS.buybackLoop -
    TRANSITION_FRAMES * 4,
  deedsLoop:
    SCENE_DURATIONS.coldOpen +
    SCENE_DURATIONS.playLoop +
    SCENE_DURATIONS.deskLoop +
    SCENE_DURATIONS.buybackLoop +
    SCENE_DURATIONS.networkLoop -
    TRANSITION_FRAMES * 5,
  rwaLoop:
    SCENE_DURATIONS.coldOpen +
    SCENE_DURATIONS.playLoop +
    SCENE_DURATIONS.deskLoop +
    SCENE_DURATIONS.buybackLoop +
    SCENE_DURATIONS.networkLoop +
    SCENE_DURATIONS.deedsLoop -
    TRANSITION_FRAMES * 6,
  reserveGate:
    SCENE_DURATIONS.coldOpen +
    SCENE_DURATIONS.playLoop +
    SCENE_DURATIONS.deskLoop +
    SCENE_DURATIONS.buybackLoop +
    SCENE_DURATIONS.networkLoop +
    SCENE_DURATIONS.deedsLoop +
    SCENE_DURATIONS.rwaLoop -
    TRANSITION_FRAMES * 7,
  finalFlywheel:
    SCENE_DURATIONS.coldOpen +
    SCENE_DURATIONS.playLoop +
    SCENE_DURATIONS.deskLoop +
    SCENE_DURATIONS.buybackLoop +
    SCENE_DURATIONS.networkLoop +
    SCENE_DURATIONS.deedsLoop +
    SCENE_DURATIONS.rwaLoop +
    SCENE_DURATIONS.reserveGate -
    TRANSITION_FRAMES * 8,
} as const;

const voiceCues = [
  { from: sceneStarts.coldOpen + 12, file: 0 },
  { from: sceneStarts.playLoop + 12, file: 1 },
  { from: sceneStarts.deskLoop + 12, file: 2 },
  { from: sceneStarts.buybackLoop + 12, file: 3 },
  { from: sceneStarts.networkLoop + 12, file: 4 },
  { from: sceneStarts.deedsLoop + 12, file: 7 },
  { from: sceneStarts.rwaLoop + 12, file: 8 },
  { from: sceneStarts.reserveGate + 12, file: 6 },
  { from: sceneStarts.finalFlywheel + 12, file: 5 },
] as const;

export const HypeFlywheelV3: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.ink }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.coldOpen}>
          <ColdOpen />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade({ shouldFadeOutExitingScene: true })}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.playLoop}>
          <PlayLoop />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade({ shouldFadeOutExitingScene: true })}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.deskLoop}>
          <DeskLoop />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade({ shouldFadeOutExitingScene: true })}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />
        <TransitionSeries.Sequence
          durationInFrames={SCENE_DURATIONS.buybackLoop}
        >
          <BuybackLoop />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade({ shouldFadeOutExitingScene: true })}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />
        <TransitionSeries.Sequence
          durationInFrames={SCENE_DURATIONS.networkLoop}
        >
          <NetworkLoop />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade({ shouldFadeOutExitingScene: true })}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.deedsLoop}>
          <DeedsLoop />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade({ shouldFadeOutExitingScene: true })}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.rwaLoop}>
          <RwaLoop />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade({ shouldFadeOutExitingScene: true })}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />
        <TransitionSeries.Sequence
          durationInFrames={SCENE_DURATIONS.reserveGate}
        >
          <ReserveGate />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade({ shouldFadeOutExitingScene: true })}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />
        <TransitionSeries.Sequence
          durationInFrames={SCENE_DURATIONS.finalFlywheel}
        >
          <FinalFlywheel />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      <Audio
        src={staticFile("art/hype/bed-legit.m4a")}
        volume={(frame) =>
          interpolate(
            frame,
            [0, 28, TOTAL_DURATION - 64, TOTAL_DURATION - 1],
            [0, 0.68, 0.68, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
      <Sequence from={sceneStarts.finalFlywheel - 8} layout="none">
        <Audio src={staticFile("art/hype/sting-win.m4a")} volume={0.22} />
      </Sequence>
      {voiceCues.map((cue) => (
        <Sequence key={cue.file} from={cue.from} layout="none">
          <Audio
            src={staticFile(`art/hype/vo-flywheel-v3-${cue.file}.mp3`)}
            volume={1.05}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
