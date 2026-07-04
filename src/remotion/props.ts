import { CaptionPage } from '../render/captions';

export interface SceneProp {
  type: 'video' | 'image' | 'gradient';
  url: string;
  durationSec: number;
}

export interface ShortVideoProps {
  audioUrl: string;
  durationSec: number;
  scenes: SceneProp[];
  captions: CaptionPage[];
  hook: string;
  themeName: string;
  [key: string]: unknown;
}

export interface IgCardProps {
  kind: 'hook' | 'fact' | 'cta';
  title: string;
  body: string;
  index: number;
  total: number;
  channelName: string;
  themeName: string;
  [key: string]: unknown;
}

export interface ThumbnailProps {
  title: string;
  backgroundUrl?: string;
  channelName: string;
  themeName: string;
  [key: string]: unknown;
}
