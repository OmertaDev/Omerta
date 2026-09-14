import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { DashedRoute, FlowNode } from "../components/FlowPrimitives";
import { FilmVideo } from "../components/FilmVideo";
import { SceneChrome } from "../components/SceneChrome";
import { Headline } from "../components/Typography";
import { colors, monoFont } from "../theme";

export const DeskLoop: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <SceneChrome
      chapter="RETURN VELOCITY // 03"
      accent={colors.gold}
      darken={0.48}
    >
      <FilmVideo
        src="art/hype/mm-auction.mp4"
        playbackRate={0.76}
        position="center 52%"
        brightness={0.48}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 60%, rgba(213,170,75,0.12), transparent 38%), " +
            "linear-gradient(180deg, rgba(5,7,8,0.82), rgba(5,7,8,0.32) 56%, rgba(5,7,8,0.9))",
        }}
      />

      <Headline
        eyebrow="BOUNDED RETURN VELOCITY — NOT EVERY SINK"
        title={
          <>
            ELIGIBLE $OMR SINKS
            <br />→{" "}
            <span style={{ color: colors.goldBright }}>DESK INVENTORY.</span>
          </>
        }
        detail="THE SAME ELIGIBLE SUPPLY CAN CREATE UTILITY AGAIN."
        top={122}
        maxWidth={1140}
        size={80}
      />

      <svg
        width="1920"
        height="1080"
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0 }}
      >
        <DashedRoute
          path="M 370 714 C 470 510, 620 450, 800 502"
          delay={40}
          duration={34}
        />
        <DashedRoute
          path="M 1010 500 C 1190 450, 1380 515, 1480 700"
          delay={66}
          duration={34}
          color={colors.green}
        />
        <DashedRoute
          path="M 1450 810 C 1260 930, 740 930, 485 810"
          delay={92}
          duration={42}
          color={colors.cyan}
        />
        <circle
          cx={interpolate(frame, [46, 118], [370, 1475], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.45, 0, 0.55, 1),
          })}
          cy={interpolate(frame, [46, 82, 118], [714, 476, 700], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.45, 0, 0.55, 1),
          })}
          r="9"
          fill={colors.goldBright}
          opacity={interpolate(frame, [42, 48, 118, 126], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
          style={{ filter: `drop-shadow(0 0 14px ${colors.goldBright})` }}
        />
      </svg>

      <FlowNode
        x={194}
        y={636}
        width={280}
        height={160}
        label="SUPPORTED SINK"
        detail="ELIGIBLE $OMR SPEND"
        accent={colors.cyan}
        delay={30}
      />
      <FlowNode
        x={760}
        y={432}
        width={330}
        height={176}
        label="DESK SHELF"
        detail="BOUNDED INVENTORY"
        accent={colors.gold}
        delay={56}
      />
      <FlowNode
        x={1432}
        y={635}
        width={300}
        height={160}
        label="AUCTION"
        detail="CITY PRICES IT AGAIN"
        accent={colors.green}
        delay={82}
      />
      <FlowNode
        x={778}
        y={800}
        width={294}
        height={142}
        label="PLAYERS"
        detail="ELIGIBLE SUPPLY RETURNS"
        accent={colors.cyan}
        delay={108}
      />

      <div
        style={{
          position: "absolute",
          right: 86,
          top: 172,
          width: 570,
          padding: "18px 22px",
          borderLeft: `3px solid ${colors.gold}`,
          backgroundColor: "rgba(5,7,8,0.9)",
          opacity: interpolate(frame, [68, 90], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          color: colors.cream,
          fontFamily: monoFont,
          fontSize: 25,
          fontWeight: 700,
          lineHeight: 1.45,
          letterSpacing: 1.35,
        }}
      >
        ELIGIBLE $OMR SINK → DESK INVENTORY
        <br />
        <span style={{ color: colors.red }}>
          WITHDRAWN $OMR NEVER RETURNS TO THIS LOOP.
        </span>
      </div>
    </SceneChrome>
  );
};
