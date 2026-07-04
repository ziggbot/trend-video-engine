import { describe, it, expect } from 'vitest';
import { planContent } from '../../src/stages/plan-content';
import { ChannelSchema } from '../../src/types/channel';
import { sceneDurations } from '../../src/stages/produce';

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

  it('derives shorts from long-form chapters with the same topic rank', () => {
    const ch = ChannelSchema.parse({
      ...base,
      cadence: { short: { perRun: 1 }, image_post: { perRun: 0 }, long: { days: ['sat'], deriveShorts: 2 } }
    });
    const plan = planContent(ch, new Date('2026-07-04T05:00:00Z'));
    expect(plan).toHaveLength(4); // trend short + long + 2 derived shorts
    const long = plan.find((p) => p.kind === 'long')!;
    const derived = plan.filter((p) => p.derivedFromChapter !== undefined);
    expect(derived).toHaveLength(2);
    expect(derived.every((d) => d.kind === 'short' && d.topicRank === long.topicRank)).toBe(true);
    expect(derived.map((d) => d.derivedFromChapter)).toEqual([0, 1]);
    // long comes before its derived shorts so the script exists when they run
    expect(plan.indexOf(long)).toBeLessThan(plan.indexOf(derived[0]));
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
