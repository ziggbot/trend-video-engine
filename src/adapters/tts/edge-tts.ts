import { Communicate } from 'edge-tts-universal';
import { TtsProvider, TtsRequest, TtsResult } from './types.js';
import { WordTiming } from '../../types/script.js';
import { withRetry } from '../../lib/retry.js';

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

  private async synthesizeOnce(req: TtsRequest): Promise<TtsResult> {
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
