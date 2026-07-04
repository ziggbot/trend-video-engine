import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTrendsRss } from '../../src/adapters/trends/google-trends-rss';
import { scoreTopics } from '../../src/stages/score-topics';
import { ChannelSchema, ScoringConfigSchema } from '../../src/types/channel';

const xml = readFileSync('test/fixtures/trends-rss.xml', 'utf8');
const scoring = ScoringConfigSchema.parse(JSON.parse(readFileSync('config/scoring.json', 'utf8')));

const channel = ChannelSchema.parse({
  id: 'test-channel',
  language: 'en',
  region: 'SE',
  niche: 'test',
  tone: 'test',
  audience: 'test',
  platforms: ['tiktok'],
  voice: 'v',
  cadence: { short: { perRun: 1 }, image_post: { perRun: 0 }, long: { days: [] } },
  forbiddenTopics: ['graphic violence']
});

describe('scoreTopics', () => {
  it('ranks deterministically — emotional keywords beat raw traffic at these weights', () => {
    const trends = parseTrendsRss(xml, 'SE');
    const ranked = scoreTopics({ trends, channel, scoring, recentTopics: [] });
    expect(ranked[0].topic).toBe('Mock AI Scandal'); // "ai"+"crisis" keywords → emotion 9
    expect(ranked.map((t) => t.topic)).toContain('Mock Solar Eclipse');
    expect(ranked[0].totalScore).toBeGreaterThan(ranked[ranked.length - 1].totalScore);
    expect(ranked[0].scoring.regionRelevance).toBe(9);
  });

  it('hard-excludes forbidden topics', () => {
    const trends = parseTrendsRss(xml, 'SE');
    const ranked = scoreTopics({ trends, channel, scoring, recentTopics: [] });
    expect(ranked.some((t) => t.topic.includes('Graphic violence'))).toBe(false);
  });

  it('applies the repetition penalty', () => {
    const trends = parseTrendsRss(xml, 'SE');
    const fresh = scoreTopics({ trends, channel, scoring, recentTopics: [] });
    const repeated = scoreTopics({ trends, channel, scoring, recentTopics: ['Mock Solar Eclipse'] });
    const freshScore = fresh.find((t) => t.topic === 'Mock Solar Eclipse')!.totalScore;
    const repeatedScore = repeated.find((t) => t.topic === 'Mock Solar Eclipse')!.totalScore;
    expect(repeatedScore).toBeLessThan(freshScore);
    expect(repeatedScore).toBeCloseTo(freshScore * 0.7, 0);
  });

  it('detects emotion keywords per language', () => {
    const trends = parseTrendsRss(xml, 'SE');
    const ranked = scoreTopics({ trends, channel, scoring, recentTopics: [] });
    const ai = ranked.find((t) => t.topic === 'Mock AI Scandal');
    expect(ai?.scoring.emotion).toBe(9);
  });
});
