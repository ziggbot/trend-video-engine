import { WordTiming } from '../../types/script.js';

export interface TtsRequest {
  text: string;
  voiceId: string;
  /** 1 = normal speed. */
  speed?: number;
  lang: string;
}

export interface TtsResult {
  audio: Buffer;
  format: 'mp3' | 'wav';
  /** Word-level timings measured from the start of this audio. */
  wordTimestamps: WordTiming[];
}

export interface TtsProvider {
  id: string;
  synthesize(req: TtsRequest): Promise<TtsResult>;
}
