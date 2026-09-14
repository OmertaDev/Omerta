import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FilmVideo } from "../components/FilmVideo";
import { SceneChrome } from "../components/SceneChrome";
import { Headline } from "../components/Typography";
import { colors, displayFont, monoFont } from "../theme";

export const ReserveGate: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <SceneChrome
      chapter="FUTURE FULL-RESERVE EXIT // 08"
      accent={colors.red}
      darken={0.56}
    >
      <FilmVideo
        src="art/hype/heist-vault.mp4"
        playbackRate={0.78}
        position="center 48%"
        brightness={0.4}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 33% 60%, rgba(112,188,141,0.13), transparent 34%), " +
            "radial-gradient(circle at 82% 55%, rgba(223,101,89,0.16), transparent 31%), " +
            "linear-gradient(90deg, rgba(5,7,8,0.93) 0%, rgba(5,7,8,0.58) 58%, rgba(5,7,8,0.91) 100%)",
        }}
      />

      <Headline
        eyebrow="FUTURE EXIT LOGIC — LIVE-GATED"
        title={
          <>
            BACKED FIRST.
            <br />
            <span style={{ color: colors.green }}>SIGNED SECOND.</span>
          </>
        }
        detail="RAIL BUILT + DEVNET-PROVEN. PRODUCTION REMAINS CHAIN_UNCONFIGURED."
        top={126}
        maxWidth={1160}
        size={88}
        accent={colors.green}
      />

      <Interactive.Div
        name="Full reserve invariant"
        style={{
          position: "absolute",
          left: 80,
          top: 402,
          width: 1120,
          height: 430,
          padding: "28px 30px",
          border: `2px solid ${colors.green}`,
          borderRadius: 20,
          background:
            "linear-gradient(145deg, rgba(11,15,17,0.96), rgba(5,7,8,0.82))",
          boxShadow: `0 0 58px ${colors.green}20, inset 0 0 55px rgba(255,255,255,0.018)`,
          opacity: interpolate(
            frame,
            [12, 30, durationInFrames - 16, durationInFrames],
            [0, 1, 1, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          ),
          scale: interpolate(frame, [12, 34], [0.96, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 200 }),
            output: "perceptual-scale",
          }),
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: colors.paper,
            fontFamily: monoFont,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 3.6,
            textTransform: "uppercase",
          }}
        >
          <span>Future full-reserve invariant</span>
          <span style={{ color: colors.red }}>not active in production</span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "284px 54px 244px 78px 334px",
            alignItems: "center",
            gap: 14,
            marginTop: 32,
          }}
        >
          <Interactive.Div
            name="Committed amount"
            style={{
              height: 148,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${colors.cyan}`,
              borderRadius: 14,
              backgroundColor: "rgba(120,181,208,0.07)",
              opacity: interpolate(frame, [26, 42], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
              translate: `${interpolate(frame, [26, 44], [-24, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              })}px 0px`,
            }}
          >
            <div
              style={{
                color: colors.cyan,
                fontFamily: monoFont,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 2.4,
                textTransform: "uppercase",
              }}
            >
              Signed total · when live
            </div>
            <div
              style={{
                marginTop: 10,
                color: colors.cream,
                fontFamily: displayFont,
                fontSize: 43,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              $OMR
            </div>
          </Interactive.Div>

          <Interactive.Div
            name="Addition operator"
            style={{
              color: colors.paper,
              fontFamily: displayFont,
              fontSize: 58,
              textAlign: "center",
              opacity: interpolate(frame, [40, 52], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            +
          </Interactive.Div>

          <Interactive.Div
            name="New request"
            style={{
              height: 148,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${colors.gold}`,
              borderRadius: 14,
              backgroundColor: "rgba(213,170,75,0.08)",
              opacity: interpolate(frame, [42, 58], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
              translate: `${interpolate(frame, [42, 60], [0, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px ${interpolate(frame, [42, 60], [24, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              })}px`,
            }}
          >
            <div
              style={{
                color: colors.goldBright,
                fontFamily: monoFont,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 2.4,
                textTransform: "uppercase",
              }}
            >
              Future request
            </div>
            <div
              style={{
                marginTop: 10,
                color: colors.cream,
                fontFamily: displayFont,
                fontSize: 43,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              $OMR
            </div>
          </Interactive.Div>

          <Interactive.Div
            name="Reserve inequality"
            style={{
              color: colors.green,
              fontFamily: displayFont,
              fontSize: 72,
              fontWeight: 700,
              textAlign: "center",
              opacity: interpolate(frame, [58, 72], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              scale: interpolate(frame % 54, [0, 27, 53], [1, 1.08, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.45, 0, 0.55, 1),
                output: "perceptual-scale",
              }),
              textShadow: `0 0 24px ${colors.green}`,
            }}
          >
            ≤
          </Interactive.Div>

          <Interactive.Div
            name="Future reserve capacity"
            style={{
              height: 148,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              border: `2px solid ${colors.green}`,
              borderRadius: 14,
              backgroundColor: "rgba(112,188,141,0.1)",
              boxShadow: `0 0 34px ${colors.green}24`,
              opacity: interpolate(frame, [62, 80], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
              translate: `${interpolate(frame, [62, 82], [28, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              })}px 0px`,
            }}
          >
            <div
              style={{
                color: colors.green,
                fontFamily: monoFont,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 2.4,
                textTransform: "uppercase",
              }}
            >
              Available backing
            </div>
            <div
              style={{
                marginTop: 10,
                color: colors.cream,
                fontFamily: displayFont,
                fontSize: 43,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              $OMR
            </div>
          </Interactive.Div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 18,
            marginTop: 27,
          }}
        >
          <Interactive.Div
            name="Backed outcome"
            style={{
              padding: "16px 18px 14px",
              borderLeft: `4px solid ${colors.green}`,
              backgroundColor: "rgba(112,188,141,0.08)",
              color: colors.cream,
              fontFamily: monoFont,
              fontSize: 23,
              fontWeight: 700,
              letterSpacing: 2.1,
              textTransform: "uppercase",
              opacity: interpolate(frame, [82, 98], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            }}
          >
            <span style={{ color: colors.green }}>When live + true</span>
            &nbsp;→&nbsp; EIP-712 voucher
          </Interactive.Div>
          <Interactive.Div
            name="Queued outcome"
            style={{
              padding: "16px 18px 14px",
              borderLeft: `4px solid ${colors.gold}`,
              backgroundColor: "rgba(213,170,75,0.08)",
              color: colors.cream,
              fontFamily: monoFont,
              fontSize: 23,
              fontWeight: 700,
              letterSpacing: 2.1,
              textTransform: "uppercase",
              opacity: interpolate(frame, [94, 110], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            }}
          >
            <span style={{ color: colors.goldBright }}>When live + false</span>
            &nbsp;→&nbsp; FIFO queue
          </Interactive.Div>
        </div>

        <div
          style={{
            position: "absolute",
            left: interpolate(frame, [24, 126], [-220, 1180], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.45, 0, 0.55, 1),
            }),
            top: 0,
            width: 150,
            height: 430,
            opacity: interpolate(
              frame,
              [20, 34, 112, 132],
              [0, 0.23, 0.23, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            ),
            background:
              "linear-gradient(90deg, transparent, rgba(112,188,141,0.2), transparent)",
            rotate: "-8deg",
          }}
        />
      </Interactive.Div>

      <Interactive.Div
        name="Production rail status"
        style={{
          position: "absolute",
          right: 80,
          top: 360,
          width: 580,
          height: 505,
          padding: "29px 32px",
          border: `2px solid ${colors.red}`,
          borderRadius: 20,
          background:
            "linear-gradient(160deg, rgba(26,12,12,0.95), rgba(5,7,8,0.94) 66%)",
          boxShadow: `0 0 58px ${colors.red}22, inset 0 0 44px rgba(223,101,89,0.035)`,
          opacity: interpolate(
            frame,
            [70, 90, durationInFrames - 16, durationInFrames],
            [0, 1, 1, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          ),
          translate: `${interpolate(frame, [70, 94], [42, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          })}px 0px`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: colors.paper,
            fontFamily: monoFont,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 3.2,
            textTransform: "uppercase",
          }}
        >
          <span>Production rail</span>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 99,
              backgroundColor: colors.red,
              boxShadow: `0 0 20px ${colors.red}`,
              opacity: interpolate(frame % 36, [0, 18, 35], [0.4, 1, 0.4], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          />
        </div>

        <Interactive.Div
          name="Dormant status"
          style={{
            marginTop: 18,
            color: colors.red,
            fontFamily: displayFont,
            fontSize: 78,
            fontWeight: 700,
            lineHeight: 0.95,
            letterSpacing: 2,
            textTransform: "uppercase",
            rotate: interpolate(frame, [78, 96], ["-4deg", "-1.5deg"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.spring({ damping: 200 }),
            }),
            scale: interpolate(frame, [78, 96], [1.12, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.spring({ damping: 200 }),
              output: "perceptual-scale",
            }),
            transformOrigin: "left center",
            textShadow: `0 0 28px ${colors.red}70`,
          }}
        >
          Dormant
        </Interactive.Div>

        <div
          style={{
            marginTop: 16,
            padding: "13px 16px 11px",
            border: `1px solid ${colors.red}88`,
            borderRadius: 8,
            backgroundColor: "rgba(223,101,89,0.07)",
            color: colors.cream,
            fontFamily: monoFont,
            fontSize: 25,
            letterSpacing: 1.7,
          }}
        >
          chain_unconfigured
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginTop: 19,
            paddingBottom: 17,
            borderBottom: `1px solid ${colors.line}`,
            fontFamily: monoFont,
          }}
        >
          <span
            style={{
              color: colors.paper,
              fontSize: 24,
              letterSpacing: 2,
            }}
          >
            totalExtracted
          </span>
          <span
            style={{
              color: colors.red,
              fontFamily: displayFont,
              fontSize: 48,
              fontWeight: 700,
            }}
          >
            0
          </span>
        </div>

        <Interactive.Div
          name="Devnet proof"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 13,
            marginTop: 17,
            color: colors.cream,
            fontFamily: monoFont,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 2.1,
            textTransform: "uppercase",
            opacity: interpolate(frame, [108, 124], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 99,
              backgroundColor: colors.green,
              boxShadow: `0 0 16px ${colors.green}`,
            }}
          />
          Built + devnet-proven
        </Interactive.Div>

        <Interactive.Div
          name="Launch gates"
          style={{
            marginTop: 17,
            padding: "14px 16px 12px",
            borderLeft: `4px solid ${colors.gold}`,
            backgroundColor: "rgba(213,170,75,0.08)",
            color: colors.goldBright,
            fontFamily: monoFont,
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1.35,
            letterSpacing: 2.1,
            textTransform: "uppercase",
            opacity: interpolate(frame, [122, 140], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          Review + launch gates first
        </Interactive.Div>
      </Interactive.Div>
    </SceneChrome>
  );
};
