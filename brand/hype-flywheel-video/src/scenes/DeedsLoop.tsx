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

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const ProvenanceLine: React.FC<{
  label: string;
  detail: string;
  delay: number;
}> = ({ label, detail, delay }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "18px 128px 1fr",
        alignItems: "center",
        gap: 12,
        minHeight: 48,
        opacity: interpolate(frame, [delay, delay + 14], [0, 1], {
          ...clamp,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
        translate: `${interpolate(frame, [delay, delay + 16], [-24, 0], {
          ...clamp,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })}px 0px`,
      }}
    >
      <span
        style={{
          width: 11,
          height: 11,
          borderRadius: 99,
          backgroundColor: colors.goldBright,
          boxShadow: `0 0 15px ${colors.goldBright}`,
        }}
      />
      <span
        style={{
          color: colors.goldBright,
          fontFamily: monoFont,
          fontSize: 19,
          fontWeight: 700,
          letterSpacing: 2.5,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: colors.cream,
          fontFamily: monoFont,
          fontSize: 21,
          letterSpacing: 1.1,
          textTransform: "uppercase",
        }}
      >
        {detail}
      </span>
    </div>
  );
};

export const DeedsLoop: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const endFade = Math.max(36, durationInFrames - 18);

  return (
    <SceneChrome
      chapter="STREET DEEDS // 06"
      accent={colors.goldBright}
      darken={0.54}
    >
      <FilmVideo
        src="art/hype/flywheel-v3-deeds.mp4"
        playbackRate={0.9}
        position="center 50%"
        brightness={0.42}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 27% 66%, rgba(213,170,75,0.17), transparent 36%), " +
            "radial-gradient(circle at 77% 69%, rgba(120,181,208,0.12), transparent 34%), " +
            "linear-gradient(180deg, rgba(5,7,8,0.91), rgba(5,7,8,0.48) 56%, rgba(5,7,8,0.96))",
        }}
      />

      <Headline
        eyebrow="THE MAP BECOMES PROPERTY"
        title={
          <>
            OWN THE STREET.
            <br />
            <span style={{ color: colors.cyan }}>FIGHT FOR CONTROL.</span>
          </>
        }
        detail="THE DEED KEEPS ITS NAME + LEGEND. THE CORNER STILL HAS TO BE HELD."
        top={112}
        maxWidth={1240}
        size={86}
        accent={colors.goldBright}
      />

      <Interactive.Div
        name="One deed per account"
        style={{
          position: "absolute",
          right: 80,
          top: 150,
          width: 450,
          padding: "20px 24px 18px",
          border: `2px solid ${colors.goldBright}`,
          borderRadius: 14,
          backgroundColor: "rgba(5,7,8,0.9)",
          boxShadow: `0 0 42px ${colors.gold}28`,
          opacity: interpolate(
            frame,
            [30, 48, endFade, durationInFrames],
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
            color: colors.goldBright,
            fontFamily: monoFont,
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: 3.2,
            textTransform: "uppercase",
          }}
        >
          Account-level property
        </div>
        <div
          style={{
            marginTop: 8,
            color: colors.cream,
            fontFamily: displayFont,
            fontSize: 46,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          ONE DEED / ACCOUNT
        </div>
      </Interactive.Div>

      <Interactive.Div
        name="Street deed certificate"
        style={{
          position: "absolute",
          left: 80,
          top: 494,
          width: 850,
          height: 430,
          padding: "27px 34px",
          border: `2px solid ${colors.goldBright}`,
          borderRadius: 18,
          background:
            "linear-gradient(145deg, rgba(30,25,15,0.95), rgba(5,7,8,0.96) 72%)",
          boxShadow: `0 0 70px ${colors.gold}22, inset 0 0 48px rgba(213,170,75,0.06)`,
          opacity: interpolate(
            frame,
            [42, 62, endFade, durationInFrames],
            [0, 1, 1, 0],
            {
              ...clamp,
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          ),
          translate: `${interpolate(frame, [42, 66], [-54, 0], {
            ...clamp,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          })}px 0px`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            borderBottom: `1px solid ${colors.gold}66`,
            paddingBottom: 21,
          }}
        >
          <div>
            <div
              style={{
                color: colors.goldBright,
                fontFamily: monoFont,
                fontSize: 19,
                fontWeight: 700,
                letterSpacing: 4,
                textTransform: "uppercase",
              }}
            >
              The deed to
            </div>
            <div
              style={{
                marginTop: 8,
                color: colors.cream,
                fontFamily: displayFont,
                fontSize: 62,
                fontWeight: 700,
                lineHeight: 0.92,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              A NAMED STREET
            </div>
          </div>
          <div
            style={{
              width: 104,
              height: 104,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `2px solid ${colors.goldBright}`,
              borderRadius: 999,
              color: colors.goldBright,
              fontFamily: displayFont,
              fontSize: 35,
              fontWeight: 700,
              rotate: `${interpolate(frame, [44, 72], [-20, -7], {
                ...clamp,
                easing: Easing.spring({ damping: 180 }),
              })}deg`,
              boxShadow: `0 0 28px ${colors.gold}30`,
            }}
          >
            1 / 1
          </div>
        </div>

        <div style={{ marginTop: 21 }}>
          <ProvenanceLine
            label="MAPPED"
            detail="ONE OF SIX DISTRICTS"
            delay={66}
          />
          <ProvenanceLine
            label="LEGEND"
            detail="BLOOD · EMPIRE · LINEAGE"
            delay={84}
          />
          <ProvenanceLine
            label="DURABLE"
            detail="SURVIVES CHARACTER DEATH"
            delay={102}
          />
        </div>

        <div
          style={{
            position: "absolute",
            left: 34,
            right: 34,
            bottom: 24,
            color: colors.paper,
            fontFamily: monoFont,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 2.2,
            textAlign: "center",
            textTransform: "uppercase",
          }}
        >
          PAPER + PROVENANCE TRAVEL TOGETHER
        </div>
      </Interactive.Div>

      <div
        style={{
          position: "absolute",
          left: 958,
          top: 500,
          width: 5,
          height: 410,
          borderRadius: 99,
          background: `linear-gradient(${colors.cyan}, ${colors.red})`,
          boxShadow: `0 0 18px ${colors.cyan}66`,
          scale: `1 ${interpolate(frame, [62, 94], [0, 1], {
            ...clamp,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          })}`,
          transformOrigin: "top",
        }}
      />

      <Interactive.Div
        name="Control is contestable"
        style={{
          position: "absolute",
          left: 1012,
          top: 494,
          width: 828,
          height: 430,
          padding: "27px 32px",
          border: `2px solid ${colors.cyan}`,
          borderRadius: 18,
          background:
            "linear-gradient(145deg, rgba(8,22,29,0.95), rgba(5,7,8,0.96) 72%)",
          boxShadow: `0 0 70px ${colors.cyan}1d, inset 0 0 48px rgba(120,181,208,0.05)`,
          opacity: interpolate(
            frame,
            [70, 90, endFade, durationInFrames],
            [0, 1, 1, 0],
            {
              ...clamp,
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          ),
          translate: `${interpolate(frame, [70, 94], [54, 0], {
            ...clamp,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          })}px 0px`,
        }}
      >
        <div
          style={{
            color: colors.cyan,
            fontFamily: monoFont,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          The controller's layer
        </div>
        <div
          style={{
            marginTop: 10,
            color: colors.cream,
            fontFamily: displayFont,
            fontSize: 67,
            fontWeight: 700,
            lineHeight: 0.92,
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          CONTROL IS
          <br />
          <span style={{ color: colors.red }}>CONTESTED.</span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginTop: 28,
          }}
        >
          {[
            ["CORNER TAKE", "CASH · HARD-CAPPED"],
            ["DISTRICT PERKS", "FOLLOW CONTROL"],
          ].map(([label, detail], index) => (
            <div
              key={label}
              style={{
                minHeight: 112,
                padding: "18px 20px",
                border: `1px solid ${index === 0 ? colors.gold : colors.cyan}`,
                borderRadius: 12,
                backgroundColor: "rgba(5,7,8,0.72)",
                opacity: interpolate(
                  frame,
                  [110 + index * 16, 126 + index * 16],
                  [0, 1],
                  clamp,
                ),
              }}
            >
              <div
                style={{
                  color: colors.cream,
                  fontFamily: displayFont,
                  fontSize: 36,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                {label}
              </div>
              <div
                style={{
                  marginTop: 8,
                  color: index === 0 ? colors.goldBright : colors.cyan,
                  fontFamily: monoFont,
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                {detail}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 20,
            padding: "12px 15px 10px",
            borderLeft: `4px solid ${colors.red}`,
            backgroundColor: "rgba(223,101,89,0.08)",
            color: colors.cream,
            fontFamily: monoFont,
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          OWNERSHIP ≠ CONTROL · DEFEND THE BLOCK
        </div>
      </Interactive.Div>

      <Interactive.Div
        name="Street Deed chain status"
        style={{
          position: "absolute",
          left: 615,
          top: 943,
          width: 690,
          padding: "11px 18px 10px",
          border: `1px solid ${colors.red}`,
          borderRadius: 999,
          backgroundColor: "rgba(5,7,8,0.9)",
          color: colors.cream,
          fontFamily: monoFont,
          fontSize: 19,
          fontWeight: 700,
          letterSpacing: 2.6,
          textAlign: "center",
          textTransform: "uppercase",
          opacity: interpolate(
            frame,
            [146, 164, endFade, durationInFrames],
            [0, 1, 1, 0],
            clamp,
          ),
        }}
      >
        ON-CHAIN EXPORT BUILT · PRODUCTION CHAIN DORMANT
      </Interactive.Div>
    </SceneChrome>
  );
};
