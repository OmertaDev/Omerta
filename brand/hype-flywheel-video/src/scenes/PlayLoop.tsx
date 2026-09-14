import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { FilmVideo } from "../components/FilmVideo";
import { SceneChrome } from "../components/SceneChrome";
import { Headline, Pill } from "../components/Typography";
import { colors } from "../theme";

const ClipLayer: React.FC<{
  src: string;
  duration: number;
  brightness?: number;
  position?: string;
}> = ({ src, duration, brightness = 0.72, position = "center" }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        opacity: interpolate(
          frame,
          [0, 12, duration - 14, duration],
          [0, 1, 1, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          },
        ),
      }}
    >
      <FilmVideo
        src={src}
        brightness={brightness}
        position={position}
        playbackRate={0.92}
      />
    </AbsoluteFill>
  );
};

export const PlayLoop: React.FC = () => {
  return (
    <SceneChrome
      chapter="UTILITY LOOP // 02"
      accent={colors.cyan}
      darken={0.18}
    >
      <Sequence durationInFrames={84} premountFor={30}>
        <ClipLayer
          src="art/hype/mm-chase.mp4"
          duration={84}
          brightness={0.66}
        />
      </Sequence>
      <Sequence from={70} durationInFrames={84} premountFor={30}>
        <ClipLayer
          src="art/hype/interior-market.mp4"
          duration={84}
          brightness={0.73}
          position="center 58%"
        />
      </Sequence>
      <Sequence from={140} durationInFrames={70} premountFor={30}>
        <ClipLayer src="art/hype/mm-crew.mp4" duration={70} brightness={0.68} />
      </Sequence>

      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, rgba(5,7,8,0.96) 0%, rgba(5,7,8,0.7) 46%, rgba(5,7,8,0.12) 78%)",
        }}
      />
      <Headline
        eyebrow="DEMAND COMES FROM PLAY"
        title={
          <>
            VALUE STARTS
            <br />
            WHEN PLAYERS <span style={{ color: colors.cyan }}>ACT.</span>
          </>
        }
        detail="STAKES BECOME MARKETS. COORDINATION BECOMES TERRITORY."
        top={184}
        maxWidth={1120}
        size={106}
        accent={colors.cyan}
      />

      <div
        style={{
          position: "absolute",
          left: 82,
          bottom: 112,
          display: "flex",
          gap: 14,
        }}
      >
        <Pill label="CRIME" delay={34} accent={colors.red} />
        <Pill label="TRADE" delay={47} accent={colors.gold} />
        <Pill label="ORGANIZE" delay={60} accent={colors.cyan} />
      </div>
    </SceneChrome>
  );
};
