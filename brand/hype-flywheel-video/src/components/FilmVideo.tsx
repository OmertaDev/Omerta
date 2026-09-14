import { Video } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const FilmVideo: React.FC<{
  src: string;
  startFrom?: number;
  playbackRate?: number;
  position?: string;
  brightness?: number;
  opacity?: number;
}> = ({
  src,
  startFrom = 0,
  playbackRate = 1,
  position = "center center",
  brightness = 0.72,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Video
        name="Cinematic background"
        src={staticFile(src)}
        muted
        loop
        playbackRate={playbackRate}
        trimBefore={startFrom * fps}
        objectFit="cover"
        style={{
          width: "100%",
          height: "100%",
          objectPosition: position,
          filter: `brightness(${brightness}) saturate(0.86) contrast(1.13)`,
          opacity,
          scale: interpolate(frame, [0, durationInFrames], [1.035, 1.11], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            output: "perceptual-scale",
          }),
        }}
      />
    </AbsoluteFill>
  );
};
