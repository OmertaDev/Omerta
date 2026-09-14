import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DashedRoute, FlowNode } from "../components/FlowPrimitives";
import { FilmVideo } from "../components/FilmVideo";
import { SceneChrome } from "../components/SceneChrome";
import { Headline } from "../components/Typography";
import { colors, displayFont, monoFont } from "../theme";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

export const RwaLoop: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const endFade = Math.max(36, durationInFrames - 18);

  return (
    <SceneChrome
      chapter="THE RWA ARC // 07"
      accent={colors.green}
      darken={0.58}
    >
      <FilmVideo
        src="art/hype/flywheel-v3-rwa.mp4"
        playbackRate={0.92}
        position="center 50%"
        brightness={0.38}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 45% 68%, rgba(112,188,141,0.16), transparent 40%), " +
            "radial-gradient(circle at 82% 56%, rgba(120,181,208,0.12), transparent 30%), " +
            "linear-gradient(180deg, rgba(5,7,8,0.92), rgba(5,7,8,0.49) 56%, rgba(5,7,8,0.97))",
        }}
      />

      <Headline
        eyebrow="FUTURE RAIL — NOT LIVE IN PRODUCTION"
        title={
          <>
            THE CITY
            <br />
            <span style={{ color: colors.green }}>GOES LEGIT.</span>
          </>
        }
        detail="VOTE THE ASSET · BUY WHAT ARRIVED · WEIGHT THE PLAY · DELIVER THE UNITS"
        top={104}
        maxWidth={1130}
        size={92}
        accent={colors.red}
      />

      <Interactive.Div
        name="RWA production gate"
        style={{
          position: "absolute",
          right: 80,
          top: 142,
          width: 530,
          padding: "20px 24px 18px",
          border: `2px solid ${colors.red}`,
          borderRadius: 14,
          backgroundColor: "rgba(13,7,7,0.94)",
          boxShadow: `0 0 46px ${colors.red}2b`,
          opacity: interpolate(
            frame,
            [28, 48, endFade, durationInFrames],
            [0, 1, 1, 0],
            {
              ...clamp,
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          ),
          textAlign: "center",
        }}
      >
        <div
          style={{
            color: colors.red,
            fontFamily: displayFont,
            fontSize: 49,
            fontWeight: 700,
            lineHeight: 0.95,
            letterSpacing: 2.5,
            textTransform: "uppercase",
          }}
        >
          WHEN ARMED
        </div>
        <div
          style={{
            marginTop: 10,
            color: colors.cream,
            fontFamily: monoFont,
            fontSize: 19,
            fontWeight: 700,
            lineHeight: 1.35,
            letterSpacing: 2.3,
            textTransform: "uppercase",
          }}
        >
          AUDIT · LEGAL / ELIGIBILITY
          <br />
          VENUE · SAFE · LAUNCH GATES
        </div>
      </Interactive.Div>

      <div
        style={{
          position: "absolute",
          left: 80,
          top: 474,
          display: "flex",
          gap: 16,
          opacity: interpolate(
            frame,
            [44, 62, endFade, durationInFrames],
            [0, 1, 1, 0],
            clamp,
          ),
        }}
      >
        <Interactive.Div
          name="Active play weighting"
          style={{
            padding: "15px 20px 13px",
            borderLeft: `4px solid ${colors.green}`,
            backgroundColor: "rgba(5,7,8,0.86)",
            color: colors.cream,
            fontFamily: monoFont,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 2.2,
            textTransform: "uppercase",
          }}
        >
          ACTIVATION × <span style={{ color: colors.green }}>ACTIVE PLAY</span>{" "}
          = WEIGHT
        </Interactive.Div>
        <Interactive.Div
          name="Idle players receive zero"
          style={{
            padding: "15px 20px 13px",
            borderLeft: `4px solid ${colors.red}`,
            backgroundColor: "rgba(5,7,8,0.86)",
            color: colors.red,
            fontFamily: monoFont,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 2.2,
            textTransform: "uppercase",
          }}
        >
          IDLE = ZERO
        </Interactive.Div>
      </div>

      <svg
        width="1920"
        height="1080"
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0 }}
      >
        <DashedRoute
          path="M 400 738 L 495 738"
          delay={62}
          duration={20}
          color={colors.gold}
        />
        <DashedRoute
          path="M 835 738 L 930 738"
          delay={82}
          duration={20}
          color={colors.green}
        />
        <DashedRoute
          path="M 1270 738 L 1365 738"
          delay={102}
          duration={20}
          color={colors.cyan}
        />

        <g
          fill={colors.cream}
          opacity={interpolate(frame, [70, 84], [0, 0.88], clamp)}
          style={{ filter: "drop-shadow(0 0 9px rgba(244,239,230,0.65))" }}
        >
          <path d="M 481 727 L 497 738 L 481 749 Z" />
          <path d="M 916 727 L 932 738 L 916 749 Z" />
          <path d="M 1351 727 L 1367 738 L 1351 749 Z" />
        </g>

        <circle
          cx={interpolate(
            frame,
            [70, 90, 110, 130, 150, 170],
            [400, 495, 835, 930, 1270, 1365],
            { ...clamp, easing: Easing.bezier(0.45, 0, 0.55, 1) },
          )}
          cy="738"
          r="10"
          fill={colors.goldBright}
          opacity={interpolate(frame, [66, 74, 172, 182], [0, 1, 1, 0], clamp)}
          style={{ filter: `drop-shadow(0 0 16px ${colors.goldBright})` }}
        />
      </svg>

      <FlowNode
        x={80}
        y={646}
        width={320}
        height={184}
        label="FAMILIES VOTE"
        detail="ONE APPROVED TICKER"
        accent={colors.gold}
        delay={48}
      />
      <FlowNode
        x={495}
        y={646}
        width={340}
        height={184}
        label="WALLED BUY"
        detail="SPEND ≤ ARRIVED TREASURY ETH"
        accent={colors.green}
        delay={68}
      />
      <FlowNode
        x={930}
        y={646}
        width={340}
        height={184}
        label="STOCK VAULT"
        detail="ALLOCATED UNITS ≤ HELD"
        accent={colors.cyan}
        delay={88}
      />
      <FlowNode
        x={1365}
        y={646}
        width={450}
        height={184}
        label="DEED VAULT"
        detail="EXTRACTED ERC-6551 ACCOUNT"
        accent={colors.goldBright}
        delay={108}
      />

      <Interactive.Div
        name="RWA mechanism summary"
        style={{
          position: "absolute",
          left: 202,
          top: 858,
          width: 1516,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 18,
          opacity: interpolate(
            frame,
            [130, 150, endFade, durationInFrames],
            [0, 1, 1, 0],
            {
              ...clamp,
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          ),
        }}
      >
        {[
          ["DETERMINISTIC", "NO RANDOM DROPS", colors.green],
          ["PLAY-WEIGHTED", "ACTIVE PLAY EARNS SHARE", colors.cyan],
          ["AUTO-DELIVERED", "NO MANUAL CLAIM", colors.goldBright],
        ].map(([title, detail, accent]) => (
          <div
            key={title}
            style={{
              padding: "15px 18px 13px",
              borderTop: `3px solid ${accent}`,
              backgroundColor: "rgba(5,7,8,0.84)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                color: accent,
                fontFamily: displayFont,
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              {title}
            </div>
            <div
              style={{
                marginTop: 5,
                color: colors.cream,
                fontFamily: monoFont,
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: 1.8,
                textTransform: "uppercase",
              }}
            >
              {detail}
            </div>
          </div>
        ))}
      </Interactive.Div>
    </SceneChrome>
  );
};
