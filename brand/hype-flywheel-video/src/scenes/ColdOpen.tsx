import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { FilmVideo } from "../components/FilmVideo";
import { SceneChrome } from "../components/SceneChrome";
import { Headline } from "../components/Typography";
import { colors, displayFont, monoFont } from "../theme";

export const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <SceneChrome
      chapter="ECONOMIC SYSTEM // 01"
      accent={colors.gold}
      darken={0.14}
    >
      <FilmVideo
        src="art/hype/hero-backdrop.mp4"
        playbackRate={0.82}
        position="center 46%"
        brightness={0.7}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 73% 42%, rgba(213,170,75,0.11), transparent 34%), " +
            "linear-gradient(90deg, rgba(5,7,8,0.96) 0%, rgba(5,7,8,0.65) 43%, transparent 75%)",
        }}
      />

      <Headline
        eyebrow="THE BULLISH CASE IS THE GAME"
        title={
          <>
            THE GAME
            <br />
            IS THE <span style={{ color: colors.goldBright }}>ECONOMY.</span>
          </>
        }
        detail={
          <>
            HUMANS + AGENTS&nbsp;&nbsp;//&nbsp;&nbsp;ONE SERVER-AUTHORITATIVE
            CITY
          </>
        }
        top={208}
        maxWidth={1060}
        size={132}
      />

      <Interactive.Div
        name="No drip statement"
        style={{
          position: "absolute",
          left: 82,
          bottom: 92,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 12,
          opacity: interpolate(frame, [58, 78], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          color: colors.cream,
          fontFamily: displayFont,
          fontSize: 42,
          letterSpacing: 2.5,
          textTransform: "uppercase",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span
            style={{
              display: "inline-flex",
              width: 14,
              height: 14,
              borderRadius: 99,
              backgroundColor: colors.green,
              boxShadow: `0 0 24px ${colors.green}`,
            }}
          />
          NO TIME-BASED $OMR DRIP
        </span>
        <span
          style={{
            marginLeft: 32,
            color: colors.goldBright,
            fontFamily: monoFont,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 4,
          }}
        >
          VALUE STARTS WITH ACTION
        </span>
      </Interactive.Div>
    </SceneChrome>
  );
};
