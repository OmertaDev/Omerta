import "./index.css";
import "./fonts";
import { Composition, Folder } from "remotion";
import {
  FPS,
  HypeFlywheelV3,
  SCENE_DURATIONS,
  TOTAL_DURATION,
} from "./Composition";
import { BuybackLoop } from "./scenes/BuybackLoop";
import { ColdOpen } from "./scenes/ColdOpen";
import { DeskLoop } from "./scenes/DeskLoop";
import { DeedsLoop } from "./scenes/DeedsLoop";
import { FinalFlywheel } from "./scenes/FinalFlywheel";
import { NetworkLoop } from "./scenes/NetworkLoop";
import { PlayLoop } from "./scenes/PlayLoop";
import { ReserveGate } from "./scenes/ReserveGate";
import { RwaLoop } from "./scenes/RwaLoop";

const dimensions = { fps: FPS, width: 1920, height: 1080 } as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="HypeFlywheelV3"
        component={HypeFlywheelV3}
        durationInFrames={TOTAL_DURATION}
        {...dimensions}
      />
      <Folder name="Scenes">
        <Composition
          id="S01-ColdOpen"
          component={ColdOpen}
          durationInFrames={SCENE_DURATIONS.coldOpen}
          {...dimensions}
        />
        <Composition
          id="S02-PlayLoop"
          component={PlayLoop}
          durationInFrames={SCENE_DURATIONS.playLoop}
          {...dimensions}
        />
        <Composition
          id="S03-DeskLoop"
          component={DeskLoop}
          durationInFrames={SCENE_DURATIONS.deskLoop}
          {...dimensions}
        />
        <Composition
          id="S04-BuybackLoop"
          component={BuybackLoop}
          durationInFrames={SCENE_DURATIONS.buybackLoop}
          {...dimensions}
        />
        <Composition
          id="S05-NetworkLoop"
          component={NetworkLoop}
          durationInFrames={SCENE_DURATIONS.networkLoop}
          {...dimensions}
        />
        <Composition
          id="S06-DeedsLoop"
          component={DeedsLoop}
          durationInFrames={SCENE_DURATIONS.deedsLoop}
          {...dimensions}
        />
        <Composition
          id="S07-RwaLoop"
          component={RwaLoop}
          durationInFrames={SCENE_DURATIONS.rwaLoop}
          {...dimensions}
        />
        <Composition
          id="S08-ReserveGate"
          component={ReserveGate}
          durationInFrames={SCENE_DURATIONS.reserveGate}
          {...dimensions}
        />
        <Composition
          id="S09-FinalFlywheel"
          component={FinalFlywheel}
          durationInFrames={SCENE_DURATIONS.finalFlywheel}
          {...dimensions}
        />
      </Folder>
    </>
  );
};
