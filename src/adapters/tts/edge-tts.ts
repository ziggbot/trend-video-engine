import { Communicate } from 'edge-tts-universal';
import { TtsProvider, TtsRequest, TtsResult } from './types';
import { WordTiming } from '../../types/script';
import { withRetry } from '../../lib/retry';

const TICKS_PER_SEC = 10_000_000; // Edge TTS reports offsets in 100-ns ticks

function speedToRate(speed = 1): string {
  const pct = Math.round((speed - 1) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

/**
 * Microsoft Edge read-aloud TTS. Free, no API key, includes Swedish and English
 * neural voices, and streams WordBoundary events we use for karaoke captions.
 * Unofficial — if it ever breaks, swap the provider in config/voices.json.
 */
export class EdgeTtsProvider implements TtsProvider {
  id = 'edge-tts';

  async synthesize(req: TtsRequest): Promise<TtsResult> {
    return withRetry(() => this.synthesizeOnce(req), { attempts: 3, baseDelayMs: 3000 });
  }

  /**
   * Watchdog: the underlying WebSocket can die without erroring, which would
   * otherwise drain the event loop and end the process mid-run. A referenced
   * timer keeps the loop alive and converts silence into a retryable error.
   */
  private async synthesizeOnce(req: TtsRequest): Promise<TtsResult> {
    let watchdog: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      watchdog = setTimeout(() => reject(new Error('Edge TTS timed out after 120s')), 120_000);
    });
    try {
      return await Promise.race([this.streamAll(req), timeout]);
    } finally {
      clearTimeout(watchdog);
    }
  }

  private async streamAll(req: TtsRequest): Promise<TtsResult> {
    const communicate = new Communicate(req.text, {
      voice: req.voiceId,
      rate: speedToRate(req.speed),
      connectionTimeout: 30_000,
      ...(process.env.HTTPS_PROXY ? { proxy: process.env.HTTPS_PROXY } : {})
    });

    const audioParts: Buffer[] = [];
    const words: WordTiming[] = [];
    for await (const chunk of communicate.stream()) {
      if (chunk.type === 'audio' && chunk.data) {
        audioParts.push(chunk.data);
      } else if (chunk.type === 'WordBoundary' && chunk.text) {
        const start = (chunk.offset ?? 0) / TICKS_PER_SEC;
        const dur = (chunk.duration ?? 0) / TICKS_PER_SEC;
        words.push({ word: chunk.text, startSec: start, endSec: start + dur });
      }
    }
    if (!audioParts.length) throw new Error('Edge TTS returned no audio');
    return { audio: Buffer.concat(audioParts), format: 'mp3', wordTimestamps: words };
  }
}
