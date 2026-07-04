import React from 'react';
import { AbsoluteFill } from 'remotion';
import { IgCardProps } from './props.js';
import { getTheme } from './themes.js';

/** 1080x1350 (4:5) Instagram carousel card. */
export const IgCard: React.FC<IgCardProps> = ({ kind, title, body, index, total, channelName, themeName }) => {
  const theme = getTheme(themeName);
  const isHook = kind === 'hook';
  const isCta = kind === 'cta';

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${theme.background} 0%, ${theme.backgroundAlt} 100%)`,
        fontFamily: theme.fontFamily,
        color: theme.text,
        padding: 90,
        justifyContent: 'space-between'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 34, fontWeight: 700, opacity: 0.85, letterSpacing: 2, textTransform: 'uppercase' }}>
          {channelName}
        </div>
        <div style={{ fontSize: 34, fontWeight: 700, opacity: 0.6 }}>
          {index + 1}/{total}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
        {!isHook && (
          <div style={{ width: 120, height: 12, backgroundColor: theme.accent, borderRadius: 6 }} />
        )}
        <div
          style={{
            fontSize: isHook ? 96 : 72,
            fontWeight: 900,
            lineHeight: 1.12,
            color: isHook || isCta ? theme.accent : theme.text
          }}
        >
          {title}
        </div>
        {body ? (
          <div style={{ fontSize: 46, lineHeight: 1.4, opacity: 0.92 }}>{body}</div>
        ) : null}
      </div>

      <div style={{ fontSize: 32, opacity: 0.55 }}>
        {isCta ? '' : total > 1 && index < total - 1 ? '→ swipe' : ''}
      </div>
    </AbsoluteFill>
  );
};
