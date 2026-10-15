import {useCurrentFrame, useVideoConfig} from 'remotion';
import {C, FONT, type Production} from './types';

export const Captions = ({production, clean = false}: {production: Production; clean?: boolean}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (clean) return null;
  const now = frame / fps * 1000;
  const caption = production.captions?.find(value => now >= value.startMs && now < value.endMs);
  if (!caption) return null;
  return <div style={{position: 'absolute', left: 170, top: 914, width: 1580, height: 75, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.body, color: C.bone, fontSize: 36, fontWeight: 400, lineHeight: 1.13, textAlign: 'center', whiteSpace: 'pre-line', textShadow: '0 2px 7px #000'}}>{caption.text.trim()}</div>;
};
