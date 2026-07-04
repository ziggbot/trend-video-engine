import React from 'react';
import { Composition, Still } from 'remotion';
import { ShortVideo, FPS, TAIL_SEC } from './ShortVideo.js';
import { IgCard } from './IgCard.js';
import { Thumbnail } from './Thumbnail.js';
import { ShortVideoProps, IgCardProps, ThumbnailProps } from './props.js';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ShortVideo"
        component={ShortVideo}
        width={1080}
        height={1920}
        fps={FPS}
        durationInFrames={30 * FPS}
        defaultProps={
          {
            audioUrl: '',
            durationSec: 30,
            scenes: [],
            captions: [],
            hook: '',
            themeName: 'midnight'
          } satisfies ShortVideoProps
        }
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(FPS, Math.round(((props.durationSec as number) + TAIL_SEC) * FPS))
        })}
      />
      <Still
        id="IgCard"
        component={IgCard}
        width={1080}
        height={1350}
        defaultProps={
          {
            kind: 'hook',
            title: '',
            body: '',
            index: 0,
            total: 1,
            channelName: '',
            themeName: 'midnight'
          } satisfies IgCardProps
        }
      />
      <Still
        id="Thumbnail"
        component={Thumbnail}
        width={1280}
        height={720}
        defaultProps={
          { title: '', channelName: '', themeName: 'midnight' } satisfies ThumbnailProps
        }
      />
    </>
  );
};
