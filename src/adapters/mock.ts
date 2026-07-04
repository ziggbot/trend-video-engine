import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LlmProvider, LlmJsonRequest } from './llm/types.js';
import { TtsProvider, TtsRequest, TtsResult } from './tts/types.js';
import { VisualsProvider, VisualCandidate, Orientation } from './visuals/types.js';
import { TrendsSource } from './trends/types.js';
import { TrendSnapshot } from '../types/trend.js';
import { parseTrendsRss } from './trends/google-trends-rss.js';
import { WordTiming } from '../types/script.js';

/** Mock trends: parses the committed fixture RSS instead of hitting Google. */
export class MockTrends implements TrendsSource {
  id = 'mock-trends';

  constructor(private fixturePath = join('test', 'fixtures', 'trends-rss.xml')) {}

  async fetch(region: 'SE' | 'US' | 'GLOBAL'): Promise<TrendSnapshot> {
    const xml = await readFile(this.fixturePath, 'utf8');
    return {
      source: `fixture:${this.fixturePath}`,
      region,
      regionLabel: region,
      fetchedAt: new Date().toISOString(),
      stale: false,
      trends: parseTrendsRss(xml, region)
    };
  }
}

/** Mock LLM: keys off the "TASK: <name>" header every prompt template starts with. */
export class MockLlm implements LlmProvider {
  id = 'mock-llm';

  async completeJson(req: LlmJsonRequest): Promise<string> {
    const task = req.prompt.match(/^TASK: ([\w-]+)/)?.[1] ?? 'unknown';
    switch (task) {
      case 'short-script':
        return JSON.stringify({
          hook: 'This story is everywhere right now',
          segments: [
            { text: 'A mock topic just exploded across the internet.', sceneKeywords: ['city night'], visualMood: 'dramatic' },
            { text: 'Here is what we actually know so far about it.', sceneKeywords: ['newspaper stack'], visualMood: 'neutral' },
            { text: 'And why everyone will be talking about it tomorrow.', sceneKeywords: ['crowd talking'], visualMood: 'upbeat' }
          ],
          cta: 'Follow for tomorrow’s update.',
          titleVariant: 'The mock story, explained'
        });
      case 'platform-metadata':
        return JSON.stringify({
          youtube_shorts: { title: 'Mock story explained #shorts', description: 'What happened, in 40 seconds.', hashtags: ['#shorts', '#news'] },
          youtube: { title: 'The mock story, explained', description: 'A deeper look at the mock story.', hashtags: ['#news'] },
          tiktok: { caption: 'The mock story explained — follow for more #news #fyp' },
          instagram_reels: { caption: 'The mock story, explained.', hashtags: ['#news', '#reels'] },
          instagram_feed: { caption: 'The mock story, explained.', hashtags: ['#news'] }
        });
      case 'ig-carousel':
        return JSON.stringify({
          cards: [
            { kind: 'hook', title: 'The mock story', body: 'Everyone is talking about it' },
            { kind: 'fact', title: 'Fact 1', body: 'Something surprising happened.' },
            { kind: 'fact', title: 'Fact 2', body: 'It got bigger overnight.' },
            { kind: 'cta', title: 'Follow for more', body: 'Daily updates on what’s trending' }
          ],
          caption: 'The mock story, in 4 slides.',
          hashtags: ['#trending', '#news']
        });
      case 'long-outline':
        return JSON.stringify({
          title: 'The mock story: the full picture',
          chapters: [
            { title: 'How it started', goal: 'Set the scene', sceneKeywords: ['sunrise city'] },
            { title: 'The turning point', goal: 'Explain the twist', sceneKeywords: ['storm clouds'] },
            { title: 'What happens next', goal: 'Wrap up with outlook', sceneKeywords: ['open road'] }
          ]
        });
      case 'long-chapter':
        return JSON.stringify({
          text: 'This chapter of the mock story covers the events in careful detail for testing purposes. It walks through what happened, who was involved, how the situation developed over the course of the day, and why all of it matters for what comes next in the story we are following.',
          scenes: [{ keywords: ['city timelapse'], mood: 'neutral' }]
        });
      default:
        throw new Error(`MockLlm: unknown task "${task}"`);
    }
  }
}

/** Generate a valid 16-bit PCM WAV containing a soft tone — playable, deterministic. */
export function generateWav(durationSec: number, sampleRate = 24_000): Buffer {
  const numSamples = Math.max(1, Math.round(durationSec * sampleRate));
  const data = Buffer.alloc(numSamples * 2);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const amp = 0.12 * Math.sin(2 * Math.PI * 220 * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.5 * t));
    data.writeInt16LE(Math.round(amp * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Mock TTS: tone WAV with evenly spaced word timings (~0.35s per word). */
export class MockTts implements TtsProvider {
  id = 'mock-tts';

  async synthesize(req: TtsRequest): Promise<TtsResult> {
    const words = req.text.split(/\s+/).filter(Boolean);
    const perWord = 0.35;
    const duration = Math.max(1, words.length * perWord);
    const wordTimestamps: WordTiming[] = words.map((word, i) => ({
      word,
      startSec: i * perWord,
      endSec: i * perWord + perWord * 0.85
    }));
    return { audio: generateWav(duration), format: 'wav', wordTimestamps };
  }
}

/** Mock visuals: returns no candidates so the solid-color fallback path is exercised. */
export class MockVisuals implements VisualsProvider {
  id = 'mock-visuals';

  async searchVideos(_q: string, _o: Orientation, _d: number): Promise<VisualCandidate[]> {
    return [];
  }

  async searchPhotos(_q: string, _o: Orientation): Promise<VisualCandidate[]> {
    return [];
  }
}
