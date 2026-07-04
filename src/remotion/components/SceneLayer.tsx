import React from 'react';
import { AbsoluteFill, Img, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { SceneProp } from '../props.js';
import { Theme } from '../themes.js';

const FADE_FRAMES = 6;

export const SceneLayer: React.FC<{
  scene: SceneProp;
  sceneIndex: number;
  durationInFrames: number;
  theme: Theme;
}> = ({ scene, sceneIndex, durationInFrames, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(
    frame,
    [0, FADE_FRAMES, Math.max(FADE_FRAMES + 1, durationInFrames - FADE_FRAMES), durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  if (scene.type === 'image') {
    // Ken Burns: slow zoom + alternating pan direction per scene
    const progress = frame / Math.max(1, durationInFrames);
    const scale = 1.05 + progress * 0.12;
    const direction = sceneIndex % 2 === 0 ? 1 : -1;
    const translateX = direction * progress * 3;
    return (
      <AbsoluteFill style={{ opacity, backgroundColor: theme.background, overflow: 'hidden' }}>
        <Img
          src={scene.url}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${scale}) translateX(${translateX}%)`
          }}
        />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ opacity, backgroundColor: theme.background }}>
      <OffthreadVideo
        src={scene.url}
        muted
        startFrom={0}
        endAt={Math.ceil(scene.durationSec * fps) + FADE_FRAMES * 2}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </AbsoluteFill>
  );
};
