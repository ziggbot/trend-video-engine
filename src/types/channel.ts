import { z } from 'zod';

export const PlatformSchema = z.enum([
  'youtube_shorts',
  'youtube',
  'tiktok',
  'instagram_reels',
  'instagram_feed'
]);
export type Platform = z.infer<typeof PlatformSchema>;

export const ContentKindSchema = z.enum(['short', 'long', 'image_post']);
export type ContentKind = z.infer<typeof ContentKindSchema>;

export const ApprovalModeSchema = z.enum(['auto', 'manual']);

const WeekdaySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export type Weekday = z.infer<typeof WeekdaySchema>;

export const ChannelSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  enabled: z.boolean().default(true),
  language: z.enum(['sv', 'en']),
  region: z.enum(['SE', 'US', 'GLOBAL']),
  niche: z.string(),
  tone: z.string(),
  audience: z.string(),
  platforms: z.array(PlatformSchema).min(1),
  voice: z.string(),
  theme: z.string().default('midnight'),
  cadence: z.object({
    short: z.object({ perRun: z.number().int().min(0).max(3) }).default({ perRun: 1 }),
    image_post: z.object({ perRun: z.number().int().min(0).max(3) }).default({ perRun: 0 }),
    long: z.object({ days: z.array(WeekdaySchema) }).default({ days: [] })
  }),
  approval: z
    .object({
      short: ApprovalModeSchema.default('auto'),
      image_post: ApprovalModeSchema.default('auto'),
      long: ApprovalModeSchema.default('manual')
    })
    .default({ short: 'auto', image_post: 'auto', long: 'manual' }),
  publisher: z.string().default('manual'),
  forbiddenTopics: z.array(z.string()).default([])
});
export type Channel = z.infer<typeof ChannelSchema>;

export const ChannelsConfigSchema = z.object({
  channels: z.array(ChannelSchema)
});

export const VoicePresetSchema = z.object({
  provider: z.enum(['edge-tts', 'kokoro']),
  voiceId: z.string(),
  speed: z.number().min(0.5).max(2).default(1),
  lang: z.string()
});
export type VoicePreset = z.infer<typeof VoicePresetSchema>;

export const VoicesConfigSchema = z.record(z.string(), VoicePresetSchema);

export const ScoringConfigSchema = z.object({
  weights: z.object({
    novelty: z.number(),
    emotion: z.number(),
    clarity: z.number(),
    explainability: z.number(),
    regionRelevance: z.number(),
    sourceStrength: z.number(),
    ctrPotential: z.number()
  }),
  emotionKeywords: z.record(z.string(), z.array(z.string())),
  repetitionPenaltyFactor: z.number().default(0.3),
  repetitionLookbackDays: z.number().default(3)
});
export type ScoringConfig = z.infer<typeof ScoringConfigSchema>;
