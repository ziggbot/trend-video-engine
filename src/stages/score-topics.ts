import { Channel, ScoringConfig } from '../types/channel.js';
import { ScoredTopic, TrendItem } from '../types/trend.js';
import { Manifest } from '../types/manifest.js';

/**
 * Heuristic topic scoring (ported from the original MVP, made config- and
 * language-driven). Pure function — unit-testable.
 */
export function scoreTopics(opts: {
  trends: TrendItem[];
  channel: Channel;
  scoring: ScoringConfig;
  /** Topic titles used by this channel in recent runs (for the repetition penalty). */
  recentTopics: string[];
}): ScoredTopic[] {
  const { trends, channel, scoring, recentTopics } = opts;
  const keywords = scoring.emotionKeywords[channel.language] ?? [];
  const emotionRegex = keywords.length ? new RegExp(keywords.join('|'), 'i') : null;
  const recent = new Set(recentTopics.map((t) => t.toLowerCase()));

  const scored = trends
    .filter((item) => !isForbidden(item, channel.forbiddenTopics))
    .map((item) => {
      const traffic = item.trendScoreRaw || 0;
      const novelty = Math.min(10, Math.max(3, Math.round(Math.log10(traffic + 1) * 3)));
      const emotion = emotionRegex?.test(`${item.topic} ${item.whyNow}`) ? 9 : 6;
      const clarity = item.topic.length < 32 ? 9 : item.topic.length < 55 ? 7 : 5;
      const explainability = item.news?.length ? 8 : 6;
      const regionRelevance = item.region === channel.region ? 9 : 6;
      const sourceStrength = Math.min(10, 5 + (item.news?.length || 0));
      const ctrPotential = Math.round((novelty + emotion + clarity + explainability + regionRelevance) / 5);

      const w = scoring.weights;
      let total =
        (novelty * w.novelty +
          emotion * w.emotion +
          clarity * w.clarity +
          explainability * w.explainability +
          regionRelevance * w.regionRelevance +
          sourceStrength * w.sourceStrength +
          ctrPotential * w.ctrPotential) *
        10;

      let repetitionPenalty = 0;
      if (recent.has(item.topic.toLowerCase())) {
        repetitionPenalty = scoring.repetitionPenaltyFactor;
        total *= 1 - repetitionPenalty;
      }
      if (item.stale) total *= 0.85;

      return {
        ...item,
        scoring: { novelty, emotion, clarity, explainability, regionRelevance, sourceStrength, ctrPotential, repetitionPenalty },
        sourceReferences: (item.news || []).slice(0, 3),
        totalScore: Number(total.toFixed(1))
      };
    });

  return scored.sort((a, b) => b.totalScore - a.totalScore);
}

function isForbidden(item: TrendItem, forbiddenTopics: string[]): boolean {
  if (!forbiddenTopics.length) return false;
  const haystack = `${item.topic} ${item.whyNow} ${(item.news ?? []).map((n) => n.title).join(' ')}`.toLowerCase();
  return forbiddenTopics.some((t) => haystack.includes(t.toLowerCase()));
}

/** Topic titles this channel used in manifests from the last N days. */
export function collectRecentTopics(manifests: Manifest[], channelId: string, lookbackDays: number): string[] {
  const cutoff = Date.now() - lookbackDays * 24 * 3600 * 1000;
  const topics: string[] = [];
  for (const m of manifests) {
    if (new Date(m.startedAt).getTime() < cutoff) continue;
    const topic = m.channels[channelId]?.topic?.title;
    if (topic) topics.push(topic);
  }
  return topics;
}
