import { z } from 'zod';

export const NewsItemSchema = z.object({
  title: z.string(),
  url: z.string(),
  source: z.string()
});
export type NewsItem = z.infer<typeof NewsItemSchema>;

export const TrendItemSchema = z.object({
  topic: z.string(),
  source: z.string().default('google-trends-rss'),
  region: z.string(),
  regionLabel: z.string(),
  trendScoreRaw: z.number(),
  approxTraffic: z.string(),
  publishedAt: z.string(),
  picture: z.string().optional(),
  pictureSource: z.string().optional(),
  news: z.array(NewsItemSchema),
  whyNow: z.string(),
  stale: z.boolean().optional()
});
export type TrendItem = z.infer<typeof TrendItemSchema>;

export const TrendSnapshotSchema = z.object({
  source: z.string(),
  region: z.string(),
  regionLabel: z.string(),
  fetchedAt: z.string(),
  stale: z.boolean().default(false),
  trends: z.array(TrendItemSchema)
});
export type TrendSnapshot = z.infer<typeof TrendSnapshotSchema>;

export const ScoredTopicSchema = TrendItemSchema.extend({
  scoring: z.object({
    novelty: z.number(),
    emotion: z.number(),
    clarity: z.number(),
    explainability: z.number(),
    regionRelevance: z.number(),
    sourceStrength: z.number(),
    ctrPotential: z.number(),
    repetitionPenalty: z.number().default(0)
  }),
  sourceReferences: z.array(NewsItemSchema),
  totalScore: z.number()
});
export type ScoredTopic = z.infer<typeof ScoredTopicSchema>;
