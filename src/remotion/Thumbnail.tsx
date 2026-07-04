import React from 'react';
import { AbsoluteFill, Img } from 'remotion';
import { ThumbnailProps } from './props';
import { getTheme } from './themes';

/** 1280x720 long-form video thumbnail. */
export const Thumbnail: React.FC<ThumbnailProps> = ({ title, backgroundUrl, channelName, themeName }) => {
  const theme = getTheme(themeName);
  return (
    <AbsoluteFill style={{ backgroundColor: theme.background, fontFamily: theme.fontFamily }}>
      {backgroundUrl ? (
        <Img
          src={backgroundUrl}
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.55) saturate(1.2)' }}
        />
      ) : (
        <AbsoluteFill style={{ background: `linear-gradient(140deg, ${theme.background}, ${theme.backgroundAlt})` }} />
      )}
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: 60 }}>
        <div
          style={{
            fontSize: 84,
            fontWeight: 900,
            lineHeight: 1.08,
            color: theme.text,
            textShadow: '0 4px 24px rgba(0,0,0,0.9)',
            maxWidth: '85%'
          }}
        >
          {title}
        </div>
        <div style={{ marginTop: 24, fontSize: 36, fontWeight: 700, color: theme.accent, letterSpacing: 2, textTransform: 'uppercase' }}>
          {channelName}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
