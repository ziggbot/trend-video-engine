import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { CaptionPage } from '../../render/captions';
import { Theme } from '../themes';

export const KaraokeCaptions: React.FC<{ pages: CaptionPage[]; theme: Theme }> = ({ pages, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = (frame / fps) * 1000;

  const page = pages.find((p) => nowMs >= p.startMs && nowMs < p.endMs);
  if (!page) return null;

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center' }}>
      <div
        style={{
          marginBottom: '30%',
          maxWidth: '86%',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '0.25em',
          fontFamily: theme.fontFamily,
          fontWeight: 800,
          fontSize: 72,
          lineHeight: 1.15,
          textAlign: 'center'
        }}
      >
        {page.words.map((w, i) => {
          const active = nowMs >= w.startMs;
          const activeFrame = Math.round((w.startMs / 1000) * fps);
          const pop = active
            ? spring({ frame: frame - activeFrame, fps, config: { damping: 12, mass: 0.4 }, durationInFrames: 8 })
            : 0;
          const scale = 1 + pop * 0.08;
          return (
            <span
              key={`${page.startMs}-${i}`}
              style={{
                color: active ? theme.captionActive : theme.text,
                transform: `scale(${scale})`,
                display: 'inline-block',
                textShadow: '0 3px 14px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.9)'
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
