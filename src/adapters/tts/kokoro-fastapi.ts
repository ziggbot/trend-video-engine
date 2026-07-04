import { TtsProvider, TtsRequest, TtsResult } from './types.js';
import { WordTiming } from '../../types/script.js';
import { fetchJson } from '../../lib/http.js';
import { withRetry } from '../../lib/retry.js';

interface CaptionedSpeechResponse {
  audio: string; // base64
  audio_format: string;
  timestamps?: Array<{ word: string; start_time: number; end_time: number }>;
}

/**
 * Kokoro-82M via Kokoro-FastAPI (ghcr.io/remsky/kokoro-fastapi-cpu), running as a
 * local service (KOKORO_URL, default http://localhost:8880). English only —
 * an alternative free provider with native word timestamps. Apache-2.0 model.
 */
export class KokoroProvider implements TtsProvider {
  id = 'kokoro';

  constructor(private baseUrl = process.env.KOKORO_URL || 'http://localhost:8880') {}

  async synthesize(req: TtsRequest): Promise<TtsResult> {
    const res = await withRetry(
      () =>
        fetchJson<CaptionedSpeechResponse>(
          `${this.baseUrl}/dev/captioned_speech`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'kokoro',
              input: req.text,
              voice: req.voiceId,
              speed: req.speed ?? 1,
              response_format: 'mp3'
            })
          },
          300_000
        ),
      { attempts: 2, baseDelayMs: 5000 }
    );
    const words: WordTiming[] = (res.timestamps ?? []).map((t) => ({
      word: t.word,
      startSec: t.start_time,
      endSec: t.end_time
    }));
    return { audio: Buffer.from(res.audio, 'base64'), format: 'mp3', wordTimestamps: words };
  }
}
