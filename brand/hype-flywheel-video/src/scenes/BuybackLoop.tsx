import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { DashedRoute, FlowNode } from "../components/FlowPrimitives";
import { FilmVideo } from "../components/FilmVideo";
import { SceneChrome } from "../components/SceneChrome";
import { Headline } from "../components/Typography";
import { colors, displayFont, monoFont } from "../theme";

export const BuybackLoop: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <SceneChrome
      chapter="REVENUE ENGINE // 04"
      accent={colors.green}
      darken={0.52}
    >
      <FilmVideo
        src="art/hype/crime-ticker.mp4"
        playbackRate={0.7}
        position="center 50%"
        brightness={0.42}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 66% 56%, rgba(112,188,141,0.13), transparent 36%), " +
            "linear-gradient(180deg, rgba(5,7,8,0.86), rgba(5,7,8,0.34) 54%, rgba(5,7,8,0.93))",
        }}
      />

      <Headline
        eyebrow="SEPARATE, SOURCE-CAPPED — NOT LIVE IN PRODUCTION"
        title={
          <>
            BUYBACK ENGINE
            <br />
            <span style={{ color: colors.red }}>DORMANT</span> UNTIL ARMED.
          </>
        }
        detail="WHEN ARMED — BUYBACK SPEND ≤ ARRIVED REVENUE"
        top={112}
        maxWidth={1120}
        size={84}
        accent={colors.red}
      />

      <div
        style={{
          position: "absolute",
          right: 86,
          top: 150,
          width: 570,
          padding: "20px 24px 18px",
          border: `2px solid ${colors.red}`,
          borderRadius: 14,
          backgroundColor: "rgba(12,7,7,0.94)",
          boxShadow: `0 0 44px ${colors.red}32`,
          opacity: interpolate(frame, [30, 48], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          textAlign: "center",
        }}
      >
        <div
          style={{
            color: colors.cream,
            fontFamily: displayFont,
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          BUYBACK ENGINE
        </div>
        <div
          style={{
            marginTop: 6,
            color: colors.red,
            fontFamily: displayFont,
            fontSize: 44,
            fontWeight: 700,
            lineHeight: 0.95,
            letterSpacing: 2.5,
            textTransform: "uppercase",
            textShadow: `0 0 22px ${colors.red}70`,
          }}
        >
          DORMANT UNTIL ARMED
        </div>
        <div
          style={{
            marginTop: 12,
            color: colors.green,
            fontFamily: monoFont,
            fontSize: 23,
            fontWeight: 700,
            letterSpacing: 2.4,
            textTransform: "uppercase",
          }}
        >
          WHEN ARMED — REVENUE-CAPPED
        </div>
      </div>

      <svg
        width="1920"
        height="1080"
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0 }}
      >
        <DashedRoute
          path="M 474 700 L 745 700"
          delay={52}
          duration={30}
          color={colors.green}
        />
        <DashedRoute
          path="M 1080 700 C 1220 700, 1240 590, 1370 570"
          delay={88}
          duration={34}
          color={colors.green}
        />
        <DashedRoute
          path="M 1080 700 C 1220 700, 1240 810, 1370 830"
          delay={100}
          duration={34}
          color={colors.gold}
        />
        <circle
          cx={interpolate(frame, [58, 112], [470, 1370], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.45, 0, 0.55, 1),
          })}
          cy={interpolate(frame, [58, 88, 112], [700, 700, 570], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
          r="10"
          fill={colors.green}
          opacity={interpolate(frame, [54, 62, 110, 120], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}
          style={{ filter: `drop-shadow(0 0 14px ${colors.green})` }}
        />
      </svg>

      <FlowNode
        x={150}
        y={618}
        width={324}
        height={166}
        label="ELIGIBLE REVENUE"
        detail="ARRIVED SOURCE · CAPPED"
        accent={colors.cyan}
        delay={38}
      />
      <FlowNode
        x={742}
        y={610}
        width={340}
        height={182}
        label="VIG BUYBACK"
        detail="DORMANT · BUYS EXISTING $OMR"
        accent={colors.green}
        delay={70}
      />
      <FlowNode
        x={1370}
        y={488}
        width={360}
        height={158}
        label="FUTURE RESERVE"
        detail="LIVE-GATED EXIT CAPACITY"
        accent={colors.green}
        delay={104}
      />
      <FlowNode
        x={1370}
        y={754}
        width={360}
        height={158}
        label="PRIZES"
        detail="FUTURE SPLIT · WHEN ARMED"
        accent={colors.gold}
        delay={116}
      />
    </SceneChrome>
  );
};
