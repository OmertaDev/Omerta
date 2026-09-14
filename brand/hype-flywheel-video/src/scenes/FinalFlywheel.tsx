import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { FlowNode } from "../components/FlowPrimitives";
import { FilmVideo } from "../components/FilmVideo";
import { SceneChrome } from "../components/SceneChrome";
import { colors, displayFont, monoFont } from "../theme";

const AnimatedArc: React.FC<{
  path: string;
  color: string;
  marker: string;
  delay: number;
}> = ({ path, color, marker, delay }) => {
  const frame = useCurrentFrame();

  return (
    <>
      <path
        d={path}
        fill="none"
        stroke="rgba(244,239,230,0.10)"
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={interpolate(frame, [delay, delay + 22], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })}
        markerEnd={`url(#${marker})`}
        opacity={interpolate(frame, [delay, delay + 9], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}
        style={{ filter: `drop-shadow(0 0 10px ${color})` }}
      />
    </>
  );
};

export const FinalFlywheel: React.FC = () => {
  const frame = useCurrentFrame();
  const orbit = (Math.max(0, frame - 70) % 120) / 120;
  const orbitAngle = orbit * Math.PI * 2 - Math.PI / 2;
  const secondOrbitAngle = orbitAngle + Math.PI;

  return (
    <SceneChrome
      chapter="THE FLYWHEEL // 09"
      accent={colors.goldBright}
      darken={0.56}
    >
      <FilmVideo
        src="art/hype/flywheel-v3-loop.mp4"
        playbackRate={0.74}
        position="center 50%"
        brightness={0.38}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 52%, rgba(213,170,75,0.13), transparent 31%), " +
            "linear-gradient(180deg, rgba(5,7,8,0.78), rgba(5,7,8,0.28) 50%, rgba(5,7,8,0.94))",
        }}
      />

      <AbsoluteFill
        style={{
          opacity: interpolate(frame, [0, 15, 132, 158], [0, 1, 1, 0.1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          scale: interpolate(frame, [0, 20, 132, 162], [0.92, 1, 1, 0.88], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            output: "perceptual-scale",
          }),
        }}
      >
        <svg
          width="1920"
          height="1080"
          viewBox="0 0 1920 1080"
          style={{ position: "absolute", inset: 0 }}
        >
          <defs>
            <marker
              id="arrow-cyan"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={colors.cyan} />
            </marker>
            <marker
              id="arrow-gold"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={colors.goldBright} />
            </marker>
            <marker
              id="arrow-green"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={colors.green} />
            </marker>
          </defs>

          <ellipse
            cx="960"
            cy="555"
            rx="505"
            ry="342"
            fill="none"
            stroke="rgba(244,239,230,0.11)"
            strokeWidth="2"
            strokeDasharray="7 13"
            strokeDashoffset={interpolate(frame, [0, 180], [0, -84], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}
          />
          <AnimatedArc
            path="M 1070 246 C 1172 260, 1248 310, 1312 386"
            color={colors.cyan}
            marker="arrow-cyan"
            delay={26}
          />
          <AnimatedArc
            path="M 1462 472 C 1512 570, 1450 702, 1334 766"
            color={colors.goldBright}
            marker="arrow-gold"
            delay={45}
          />
          <AnimatedArc
            path="M 1210 854 C 1098 934, 824 934, 710 854"
            color={colors.goldBright}
            marker="arrow-gold"
            delay={64}
          />
          <AnimatedArc
            path="M 518 766 C 408 692, 394 524, 474 440"
            color={colors.green}
            marker="arrow-green"
            delay={83}
          />
          <AnimatedArc
            path="M 532 360 C 622 270, 752 226, 850 216"
            color={colors.cyan}
            marker="arrow-cyan"
            delay={102}
          />

          <circle
            cx={960 + Math.cos(orbitAngle) * 505}
            cy={555 + Math.sin(orbitAngle) * 342}
            r="9"
            fill={colors.goldBright}
            opacity={interpolate(frame, [66, 76, 132, 148], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}
            style={{ filter: `drop-shadow(0 0 15px ${colors.goldBright})` }}
          />
          <circle
            cx={960 + Math.cos(secondOrbitAngle) * 505}
            cy={555 + Math.sin(secondOrbitAngle) * 342}
            r="6"
            fill={colors.cyan}
            opacity={interpolate(
              frame,
              [98, 108, 132, 148],
              [0, 0.85, 0.85, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            )}
            style={{ filter: `drop-shadow(0 0 12px ${colors.cyan})` }}
          />
        </svg>

        <FlowNode
          x={832}
          y={144}
          width={256}
          height={136}
          label="PLAY"
          detail="ACTION CREATES STAKES"
          accent={colors.cyan}
          delay={12}
        />
        <FlowNode
          x={1262}
          y={356}
          width={270}
          height={144}
          label="SPEND"
          detail="$OMR HAS UTILITY"
          accent={colors.gold}
          delay={31}
        />
        <FlowNode
          x={1194}
          y={750}
          width={300}
          height={148}
          label="RECYCLE"
          detail="SINKS → DESK INVENTORY"
          accent={colors.goldBright}
          delay={50}
        />
        <FlowNode
          x={438}
          y={750}
          width={340}
          height={148}
          label="BUYBACK"
          detail="DORMANT · THEN REVENUE-CAPPED"
          accent={colors.green}
          delay={69}
        />
        <FlowNode
          x={386}
          y={356}
          width={330}
          height={144}
          label="REWARD"
          detail="RETURN TO PLAY"
          accent={colors.cyan}
          delay={88}
        />

        <Interactive.Div
          name="Flywheel center"
          style={{
            position: "absolute",
            left: 748,
            top: 357,
            width: 424,
            height: 390,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: `2px solid ${colors.gold}`,
            borderRadius: 999,
            background:
              "radial-gradient(circle, rgba(26,27,25,0.98) 0%, rgba(5,7,8,0.96) 72%)",
            boxShadow: `0 0 78px ${colors.gold}2b, inset 0 0 52px ${colors.gold}14`,
            opacity: interpolate(frame, [8, 28], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            scale: interpolate(frame, [8, 30], [0.72, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.spring({ damping: 200 }),
              output: "perceptual-scale",
            }),
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: colors.goldBright,
              fontFamily: monoFont,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 5,
              textTransform: "uppercase",
            }}
          >
            THE DEMAND ENGINE
          </div>
          <div
            style={{
              marginTop: 16,
              color: colors.cream,
              fontFamily: displayFont,
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 0.88,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            ACTION
            <br />
            CREATES
            <br />
            DEMAND
          </div>
          <div
            style={{
              marginTop: 20,
              color: colors.paper,
              fontFamily: monoFont,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            NO PASSIVE $OMR DRIP
          </div>
        </Interactive.Div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 50% 42%, rgba(213,170,75,0.12), transparent 27%), " +
            "rgba(5,7,8,0.94)",
          opacity: interpolate(frame, [132, 160], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
        }}
      >
        <Img
          name="OMERTA crest"
          src={staticFile("art/crest.jpg")}
          style={{
            position: "absolute",
            top: 145,
            width: 288,
            height: 288,
            objectFit: "cover",
            borderRadius: 999,
            mixBlendMode: "screen",
            filter: "saturate(0.86) contrast(1.18)",
            opacity: interpolate(frame, [143, 164], [0, 0.88], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            scale: interpolate(frame, [143, 168], [0.74, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.spring({ damping: 200 }),
              output: "perceptual-scale",
            }),
          }}
        />

        <Interactive.Div
          name="Final OMERTA title"
          style={{
            position: "absolute",
            top: 430,
            color: colors.cream,
            fontFamily: displayFont,
            fontSize: 164,
            fontWeight: 700,
            lineHeight: 0.88,
            letterSpacing: 10,
            textTransform: "uppercase",
            textShadow: `0 0 42px ${colors.gold}38, 0 8px 32px rgba(0,0,0,0.9)`,
            opacity: interpolate(frame, [151, 174], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
            translate: `0px ${interpolate(frame, [151, 176], [30, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            })}px`,
          }}
        >
          OMERTÀ
        </Interactive.Div>

        <Interactive.Div
          name="Final brand line"
          style={{
            position: "absolute",
            top: 602,
            color: colors.goldBright,
            fontFamily: monoFont,
            fontSize: 29,
            fontWeight: 700,
            letterSpacing: 7,
            textTransform: "uppercase",
            opacity: interpolate(frame, [164, 184], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          PLAY MAKES THE MARKET
        </Interactive.Div>

        <Interactive.Div
          name="Mechanism disclaimer"
          style={{
            position: "absolute",
            bottom: 112,
            minWidth: 720,
            padding: "18px 34px 16px",
            borderTop: `2px solid ${colors.red}`,
            borderBottom: `2px solid ${colors.red}`,
            color: colors.cream,
            backgroundColor: "rgba(5,7,8,0.9)",
            fontFamily: monoFont,
            fontSize: 30,
            fontWeight: 800,
            letterSpacing: 5,
            textAlign: "center",
            textTransform: "uppercase",
            textShadow: "0 2px 14px rgba(0,0,0,0.95)",
            boxShadow: `0 0 36px ${colors.red}2e`,
            opacity: interpolate(frame, [158, 176], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          MECHANISM, NOT A PRICE PROMISE.
        </Interactive.Div>
      </AbsoluteFill>
    </SceneChrome>
  );
};
