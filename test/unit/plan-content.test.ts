import { describe, it, expect } from 'vitest';
import { planContent } from '../../src/stages/plan-content.js';
import { ChannelSchema } from '../../src/types/channel.js';
import { sceneDurations } from '../../src/stages/produce.js';

const base = {
  id: 'test',
  language: 'en' as const,
  region: 'US' as const,
  niche: 'n',
  tone: 't',
  audience: 'a',
  platforms: ['tiktok' as const],
  voice: 'v'
};

describe('planContent', () => {
  it('plans shorts and image posts per cadence with distinct topic ranks', () => {
    const ch = ChannelSchema.parse({
      ...base,
      cadence: { short: { perRun: 2 }, image_post: { perRun: 1 }, long: { days: [] } }
    });
    const plan = planContent(ch, new Date('2026-07-04T05:00:00Z'));
    expect(plan).toHaveLength(3);
    expect(new Set(plan.map((p) => p.topicRank)).size).toBe(3);
  });

  it('adds long-form only on configured weekdays', () => {
    const ch = ChannelSchema.parse({
      ...base,
      cadence: { short: { perRun: 0 }, image_post: { perRun: 0 }, long: { days: ['sat'] } }
    });
    // 2026-07-04 is a Saturday
    expect(planContent(ch, new Date('2026-07-04T05:00:00Z'))).toHaveLength(1);
    expect(planContent(ch, new Date('2026-07-05T05:00:00Z'))).toHaveLength(0);
  });
});

describe('sceneDurations', () => {
  it('splits total duration proportional to word counts with a floor', () => {
    const durations = sceneDurations([{ text: 'one two three four' }, { text: 'five' }], 20);
    expect(durations[0]).toBeGreaterThan(durations[1]);
    expect(durations.reduce((a, b) => a + b, 0)).toBeCloseTo(20, 0);
    const floored = sceneDurations([{ text: 'a' }, { text: 'b '.repeat(100) }], 10);
    expect(floored[0]).toBeGreaterThanOrEqual(2);
  });
});
