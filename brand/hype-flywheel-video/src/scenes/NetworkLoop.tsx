import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { DashedRoute, FlowNode } from "../components/FlowPrimitives";
import { FilmVideo } from "../components/FilmVideo";
import { SceneChrome } from "../components/SceneChrome";
import { Headline } from "../components/Typography";
import { colors, monoFont } from "../theme";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

export const NetworkLoop: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <SceneChrome
      chapter="NETWORK EFFECT // 05"
      accent={colors.cyan}
      darken={0.52}
    >
      <FilmVideo
        src="art/hype/interior-market.mp4"
        playbackRate={0.76}
        position="center 48%"
        brightness={0.42}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 69%, rgba(120,181,208,0.14), transparent 42%), " +
            "linear-gradient(180deg, rgba(5,7,8,0.9) 0%, rgba(5,7,8,0.4) 56%, rgba(5,7,8,0.94) 100%)",
        }}
      />

      <Headline
        eyebrow="THE SOCIAL FLYWHEEL"
        title={
          <>
            MORE PLAYERS.
            <br />
            MORE <span style={{ color: colors.cyan }}>GAME.</span>
          </>
        }
        detail="ACTIVE PARTICIPANTS ADD MORE SIDES TO TRADE, COMPETE, AND COORDINATE."
        top={128}
        maxWidth={1120}
        size={96}
        accent={colors.cyan}
      />

      <Interactive.Div
        name="Network effect statement"
        style={{
          position: "absolute",
          right: 82,
          top: 176,
          width: 560,
          padding: "18px 22px 16px",
          borderLeft: `3px solid ${colors.green}`,
          backgroundColor: "rgba(5,7,8,0.76)",
          opacity: interpolate(frame, [40, 58], [0, 1], {
            ...clamp,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          translate: `${interpolate(frame, [40, 60], [30, 0], {
            ...clamp,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          })}px 0px`,
          color: colors.paper,
          fontFamily: monoFont,
          fontSize: 24,
          fontWeight: 700,
          lineHeight: 1.42,
          letterSpacing: 1.4,
          textTransform: "uppercase",
        }}
      >
        More liquidity. More competition. More coordination.
        <br />
        <span style={{ color: colors.green }}>More reasons to come back.</span>
      </Interactive.Div>

      <svg
        width="1920"
        height="1080"
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0 }}
      >
        <DashedRoute
          path="M 330 704 L 395 704"
          delay={44}
          duration={18}
          color={colors.gold}
        />
        <DashedRoute
          path="M 725 704 L 790 704"
          delay={62}
          duration={18}
          color={colors.cyan}
        />
        <DashedRoute
          path="M 1120 704 L 1185 704"
          delay={80}
          duration={18}
          color={colors.green}
        />
        <DashedRoute
          path="M 1515 704 L 1580 704"
          delay={98}
          duration={18}
          color={colors.gold}
        />
        <DashedRoute
          path="M 1705 786 C 1705 914, 210 914, 210 786"
          delay={116}
          duration={42}
          color={colors.cyan}
        />

        <g
          fill={colors.cream}
          opacity={interpolate(frame, [52, 66], [0, 0.78], clamp)}
          style={{ filter: "drop-shadow(0 0 8px rgba(244,239,230,0.65))" }}
        >
          <path d="M 381 694 L 395 704 L 381 714 Z" />
          <path d="M 776 694 L 790 704 L 776 714 Z" />
          <path d="M 1171 694 L 1185 704 L 1171 714 Z" />
          <path d="M 1566 694 L 1580 704 L 1566 714 Z" />
        </g>
        <path
          d="M 198 802 L 210 786 L 222 802 Z"
          fill={colors.cyan}
          opacity={interpolate(frame, [142, 156], [0, 0.9], clamp)}
          style={{ filter: `drop-shadow(0 0 9px ${colors.cyan})` }}
        />

        <circle
          cx={interpolate(
            frame,
            [48, 58, 68, 78, 88, 98, 108, 118],
            [330, 395, 725, 790, 1120, 1185, 1515, 1580],
            { ...clamp, easing: Easing.bezier(0.45, 0, 0.55, 1) },
          )}
          cy="704"
          r="9"
          fill={colors.goldBright}
          opacity={interpolate(frame, [44, 50, 116, 122], [0, 1, 1, 0], clamp)}
          style={{ filter: `drop-shadow(0 0 15px ${colors.goldBright})` }}
        />
        <circle
          cx={interpolate(frame, [120, 134, 154, 168], [1705, 1705, 210, 210], {
            ...clamp,
            easing: Easing.bezier(0.45, 0, 0.55, 1),
          })}
          cy={interpolate(frame, [120, 134, 154, 168], [786, 914, 914, 786], {
            ...clamp,
            easing: Easing.bezier(0.45, 0, 0.55, 1),
          })}
          r="10"
          fill={colors.cyan}
          opacity={interpolate(
            frame,
            [116, 124, 166, 174],
            [0, 1, 1, 0],
            clamp,
          )}
          style={{ filter: `drop-shadow(0 0 16px ${colors.cyan})` }}
        />
      </svg>

      <FlowNode
        x={80}
        y={622}
        width={250}
        height={164}
        label="PLAYERS"
        detail="HUMANS + AGENTS"
        accent={colors.gold}
        delay={28}
      />
      <FlowNode
        x={395}
        y={622}
        width={330}
        height={164}
        label="COUNTERPARTIES"
        detail="BUY · SELL · LEND"
        accent={colors.cyan}
        delay={48}
      />
      <FlowNode
        x={790}
        y={622}
        width={330}
        height={164}
        label="OPPORTUNITIES"
        detail="TRADES · CONTRACTS · RIVALS"
        accent={colors.green}
        delay={68}
      />
      <FlowNode
        x={1185}
        y={622}
        width={330}
        height={164}
        label="ORGANIZATIONS"
        detail="CREWS · FAMILIES · TURF"
        accent={colors.gold}
        delay={88}
      />
      <FlowNode
        x={1580}
        y={622}
        width={260}
        height={164}
        label="RETURN PLAY"
        detail="THE LOOP DEEPENS"
        accent={colors.cyan}
        delay={108}
      />

      <Interactive.Div
        name="Return route label"
        style={{
          position: "absolute",
          left: 686,
          top: 852,
          width: 548,
          padding: "10px 18px 9px",
          border: `1px solid ${colors.cyan}`,
          borderRadius: 999,
          backgroundColor: "rgba(5,7,8,0.84)",
          boxShadow: `0 0 24px ${colors.cyan}20`,
          opacity: interpolate(frame, [126, 144], [0, 1], {
            ...clamp,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          color: colors.cream,
          fontFamily: monoFont,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 3,
          textAlign: "center",
          textTransform: "uppercase",
        }}
      >
        EACH RETURN CREATES THE NEXT COUNTERPARTY
      </Interactive.Div>
    </SceneChrome>
  );
};
