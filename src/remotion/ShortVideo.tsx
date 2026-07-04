import React from 'react';
import { AbsoluteFill, Audio, Series } from 'remotion';
import { ShortVideoProps } from './props.js';
import { getTheme } from './themes.js';
import { SceneLayer } from './components/SceneLayer.js';
import { KaraokeCaptions } from './components/KaraokeCaptions.js';
import { HookTitle } from './components/HookTitle.js';

export const FPS = 30;
export const TAIL_SEC = 0.5;

export const ShortVideo: React.FC<ShortVideoProps> = ({ audioUrl, scenes, captions, hook, themeName, durationSec }) => {
  const theme = getTheme(themeName);
  const totalFrames = Math.round((durationSec + TAIL_SEC) * FPS);
  // Scale scene durations so they exactly cover the video
  const sceneTotal = scenes.reduce((acc, s) => acc + s.durationSec, 0);
  const factor = sceneTotal > 0 ? totalFrames / Math.round(sceneTotal * FPS) : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      <Series>
        {scenes.map((scene, i) => {
          const frames = Math.max(FPS, Math.round(scene.durationSec * FPS * factor));
          return (
            <Series.Sequence key={i} durationInFrames={frames}>
              <SceneLayer scene={scene} sceneIndex={i} durationInFrames={frames} theme={theme} />
            </Series.Sequence>
          );
        })}
      </Series>
      <KaraokeCaptions pages={captions} theme={theme} />
      <HookTitle hook={hook} theme={theme} />
      <Audio src={audioUrl} />
    </AbsoluteFill>
  );
};
