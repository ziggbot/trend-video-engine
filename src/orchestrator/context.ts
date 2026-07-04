import { Channel, ScoringConfig, VoicePreset } from '../types/channel';
import { Manifest } from '../types/manifest';
import { Logger } from './logger';
import type { LlmProvider } from '../adapters/llm/types';
import type { TtsProvider } from '../adapters/tts/types';
import type { VisualsProvider } from '../adapters/visuals/types';
import type { TrendsSource } from '../adapters/trends/types';
import type { Publisher } from '../adapters/publish/types';

export interface AppConfig {
  channels: Channel[];
  voices: Record<string, VoicePreset>;
  scoring: ScoringConfig;
}

export interface Services {
  llm: LlmProvider;
  tts: (preset: VoicePreset) => TtsProvider;
  visuals: VisualsProvider;
  trends: TrendsSource;
  publishers: Record<string, Publisher>;
}

export interface RunCtx {
  runId: string;
  rootDir: string;
  runDir: string;
  outputDir: string;
  config: AppConfig;
  manifest: Manifest;
  log: Logger;
  mock: boolean;
  services: Services;
}

export interface ChannelCtx extends RunCtx {
  channel: Channel;
  channelDir: string;
}
