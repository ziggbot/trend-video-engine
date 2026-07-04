import { Services } from './orchestrator/context.js';
import { Logger } from './orchestrator/logger.js';
import { GoogleTrendsRss } from './adapters/trends/google-trends-rss.js';
import { GeminiProvider } from './adapters/llm/gemini.js';
import { OpenAiProvider } from './adapters/llm/openai.js';
import { EdgeTtsProvider } from './adapters/tts/edge-tts.js';
import { KokoroProvider } from './adapters/tts/kokoro-fastapi.js';
import { PexelsProvider } from './adapters/visuals/pexels.js';
import { ManualPublisher } from './adapters/publish/manual.js';
import { UploadPostPublisher } from './adapters/publish/upload-post.js';
import { MockLlm, MockTrends, MockTts, MockVisuals } from './adapters/mock.js';
import { VoicePreset } from './types/channel.js';
import { TtsProvider } from './adapters/tts/types.js';

export function createServices(mock: boolean, log: Logger): Services {
  if (mock) {
    const mockTts = new MockTts();
    return {
      llm: new MockLlm(),
      tts: () => mockTts,
      visuals: new MockVisuals(),
      trends: new MockTrends(),
      publishers: { manual: new ManualPublisher() }
    };
  }

  const llmProvider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
  let llm;
  if (llmProvider === 'openai') {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('LLM_PROVIDER=openai but OPENAI_API_KEY is not set');
    log.warn('Using OpenAI (paid) as LLM provider — set LLM_PROVIDER=gemini for the free stack');
    llm = new OpenAiProvider(key);
  } else {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error(
        'GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey (no billing needed).'
      );
    }
    llm = new GeminiProvider(key);
  }

  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!pexelsKey) {
    throw new Error('PEXELS_API_KEY is not set. Get a free key at https://www.pexels.com/api/');
  }

  const edge = new EdgeTtsProvider();
  const kokoro = new KokoroProvider();
  const tts = (preset: VoicePreset): TtsProvider => (preset.provider === 'kokoro' ? kokoro : edge);

  return {
    llm,
    tts,
    visuals: new PexelsProvider(pexelsKey),
    trends: new GoogleTrendsRss(),
    publishers: { manual: new ManualPublisher(), 'upload-post': new UploadPostPublisher() }
  };
}
