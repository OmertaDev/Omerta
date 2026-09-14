import { Easing, interpolate, useCurrentFrame } from "remotion";
import { colors, displayFont, monoFont } from "../theme";

export const FlowNode: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  detail?: string;
  accent?: string;
  delay?: number;
}> = ({
  x,
  y,
  width,
  height,
  label,
  detail,
  accent = colors.gold,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 22,
        border: `2px solid ${accent}`,
        borderRadius: 18,
        background:
          "linear-gradient(145deg, rgba(17,20,21,0.96), rgba(5,7,8,0.84))",
        boxShadow: `0 0 42px ${accent}20, inset 0 0 40px rgba(255,255,255,0.018)`,
        opacity: interpolate(frame, [delay, delay + 14], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
        scale: interpolate(frame, [delay, delay + 16], [0.78, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.spring({ damping: 200 }),
          output: "perceptual-scale",
        }),
      }}
    >
      <div
        style={{
          color: colors.cream,
          fontFamily: displayFont,
          fontSize: 40,
          fontWeight: 700,
          letterSpacing: 2,
          textAlign: "center",
          textTransform: "uppercase",
          lineHeight: 1,
        }}
      >
        {label}
      </div>
      {detail ? (
        <div
          style={{
            marginTop: 9,
            color: colors.cream,
            fontFamily: monoFont,
            fontSize: detail.length > 24 ? 20 : 22,
            fontWeight: 700,
            lineHeight: 1.16,
            letterSpacing: 1.1,
            textAlign: "center",
            textTransform: "uppercase",
            textShadow: `0 0 14px ${accent}66`,
          }}
        >
          {detail}
        </div>
      ) : null}
    </div>
  );
};

export const DashedRoute: React.FC<{
  path: string;
  color?: string;
  delay?: number;
  duration?: number;
  width?: number;
}> = ({ path, color = colors.gold, delay = 0, duration = 32, width = 4 }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <>
      <path
        d={path}
        fill="none"
        stroke="rgba(244,239,230,0.12)"
        strokeWidth={width}
      />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={1 - progress}
        style={{ filter: `drop-shadow(0 0 9px ${color})` }}
      />
    </>
  );
};
