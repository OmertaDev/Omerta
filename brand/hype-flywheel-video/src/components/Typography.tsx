import {
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, displayFont, monoFont } from "../theme";

export const Headline: React.FC<{
  eyebrow?: string;
  title: React.ReactNode;
  detail?: React.ReactNode;
  align?: "left" | "center" | "right";
  maxWidth?: number;
  top?: number;
  left?: number;
  right?: number;
  size?: number;
  accent?: string;
}> = ({
  eyebrow,
  title,
  detail,
  align = "left",
  maxWidth = 1320,
  top = 160,
  left = 80,
  right,
  size = 112,
  accent = colors.gold,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fadeOutStart = Math.max(24, durationInFrames - 18);

  return (
    <div
      style={{
        position: "absolute",
        top,
        left: align === "right" ? undefined : left,
        right: align === "right" ? (right ?? 80) : undefined,
        width: maxWidth,
        textAlign: align,
      }}
    >
      {eyebrow ? (
        <Interactive.Div
          name="Eyebrow"
          style={{
            opacity: interpolate(
              frame,
              [4, 18, fadeOutStart, durationInFrames],
              [0, 1, 1, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              },
            ),
            translate: `${interpolate(frame, [4, 20], [-30, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            })}px 0px`,
            marginBottom: 18,
            color: accent,
            fontFamily: monoFont,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 5,
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </Interactive.Div>
      ) : null}
      <Interactive.Div
        name="Headline"
        style={{
          opacity: interpolate(
            frame,
            [8, 24, fadeOutStart, durationInFrames],
            [0, 1, 1, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          ),
          translate: `${interpolate(frame, [8, 26], [-54, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          })}px 0px`,
          color: colors.cream,
          fontFamily: displayFont,
          fontSize: size,
          fontWeight: 700,
          lineHeight: 0.92,
          letterSpacing: 1,
          textTransform: "uppercase",
          textShadow: "0 5px 30px rgba(0,0,0,0.82)",
        }}
      >
        {title}
      </Interactive.Div>
      {detail ? (
        <Interactive.Div
          name="Supporting line"
          style={{
            opacity: interpolate(
              frame,
              [18, 34, fadeOutStart, durationInFrames],
              [0, 1, 1, 0],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              },
            ),
            translate: `${interpolate(frame, [18, 36], [-28, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            })}px 0px`,
            marginTop: 26,
            color: colors.paper,
            fontFamily: monoFont,
            fontSize: 28,
            lineHeight: 1.38,
            letterSpacing: 1.3,
            textShadow: "0 3px 18px rgba(0,0,0,0.9)",
          }}
        >
          {detail}
        </Interactive.Div>
      ) : null}
    </div>
  );
};

export const Pill: React.FC<{
  label: string;
  delay: number;
  accent?: string;
}> = ({ label, delay, accent = colors.gold }) => {
  const frame = useCurrentFrame();

  return (
    <Interactive.Div
      name="Mechanism label"
      style={{
        opacity: interpolate(frame, [delay, delay + 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
        scale: interpolate(frame, [delay, delay + 14], [0.86, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.spring({ damping: 200 }),
          output: "perceptual-scale",
        }),
        padding: "12px 20px 10px",
        border: `1px solid ${accent}`,
        borderRadius: 999,
        color: colors.cream,
        backgroundColor: "rgba(5,7,8,0.72)",
        boxShadow: `0 0 24px ${accent}28`,
        fontFamily: monoFont,
        fontSize: 26,
        fontWeight: 700,
        letterSpacing: 3,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Interactive.Div>
  );
};
