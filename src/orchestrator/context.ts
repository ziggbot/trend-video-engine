import { Channel, ScoringConfig, VoicePreset } from '../types/channel.js';
import { Manifest } from '../types/manifest.js';
import { Logger } from './logger.js';
import type { LlmProvider } from '../adapters/llm/types.js';
import type { TtsProvider } from '../adapters/tts/types.js';
import type { VisualsProvider } from '../adapters/visuals/types.js';
import type { TrendsSource } from '../adapters/trends/types.js';
import type { Publisher } from '../adapters/publish/types.js';

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
