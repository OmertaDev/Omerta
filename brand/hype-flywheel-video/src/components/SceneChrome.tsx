import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { colors, displayFont, monoFont } from "../theme";

export const SceneChrome: React.FC<{
  children: React.ReactNode;
  chapter: string;
  accent?: string;
  darken?: number;
}> = ({ children, chapter, accent = colors.gold, darken = 0.24 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: colors.ink, overflow: "hidden" }}>
      {children}
      <AbsoluteFill
        style={{
          background:
            `linear-gradient(180deg, rgba(5,7,8,0.26) 0%, rgba(5,7,8,${Math.min(
              0.34,
              darken * 0.7,
            )}) 28%, ` + "rgba(5,7,8,0.08) 58%, rgba(5,7,8,0.36) 100%)",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.16,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), " +
            "linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          translate: `${interpolate(frame, [0, durationInFrames], [0, -36], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}px ${interpolate(frame, [0, durationInFrames], [0, 18], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}px`,
          pointerEvents: "none",
        }}
      />
      <Interactive.Div
        name="Chapter label"
        style={{
          position: "absolute",
          top: 46,
          left: 80,
          display: "flex",
          alignItems: "center",
          gap: 16,
          opacity: interpolate(frame, [0, 14], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          fontFamily: monoFont,
          fontSize: 20,
          letterSpacing: 3.5,
          color: colors.cream,
          textTransform: "uppercase",
        }}
      >
        <span style={{ color: accent }}>OMERTÀ</span>
        <span style={{ opacity: 0.45 }}>{"//"}</span>
        <span>{chapter}</span>
      </Interactive.Div>

      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          top: 84,
          height: 1,
          background: `linear-gradient(90deg, ${accent}, rgba(244,239,230,0.16), transparent)`,
          opacity: interpolate(frame, [6, 26], [0, 0.65], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 80,
          bottom: 38,
          width: interpolate(frame, [0, durationInFrames - 1], [0, 1760], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          height: 2,
          backgroundColor: accent,
          opacity: 0.65,
          boxShadow: `0 0 18px ${accent}`,
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 22,
          backgroundColor: colors.ink,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 22,
          backgroundColor: colors.ink,
        }}
      />
      <div style={{ fontFamily: displayFont }}>{/* font preload anchor */}</div>
    </AbsoluteFill>
  );
};
