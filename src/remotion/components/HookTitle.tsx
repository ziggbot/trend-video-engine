import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Theme } from '../themes.js';

/** Big hook text overlay for the first ~2.2 seconds. */
export const HookTitle: React.FC<{ hook: string; theme: Theme }> = ({ hook, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const visibleFrames = Math.round(2.2 * fps);
  if (frame > visibleFrames) return null;

  const enter = spring({ frame, fps, config: { damping: 14 }, durationInFrames: 12 });
  const exit = interpolate(frame, [visibleFrames - 8, visibleFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp'
  });

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', opacity: exit }}>
      <div
        style={{
          marginTop: '18%',
          maxWidth: '88%',
          padding: '0.5em 0.8em',
          backgroundColor: theme.accent,
          color: theme.background,
          borderRadius: 24,
          fontFamily: theme.fontFamily,
          fontWeight: 900,
          fontSize: 64,
          lineHeight: 1.15,
          textAlign: 'center',
          transform: `scale(${0.8 + enter * 0.2}) rotate(-2deg)`,
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
        }}
      >
        {hook}
      </div>
    </AbsoluteFill>
  );
};
