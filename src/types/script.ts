import { z } from 'zod';

export const SceneSchema = z.object({
  text: z.string(),
  sceneKeywords: z.array(z.string()).min(1),
  visualMood: z.string().default('neutral')
});
export type Scene = z.infer<typeof SceneSchema>;

export const ShortScriptSchema = z.object({
  hook: z.string(),
  segments: z.array(SceneSchema).min(2),
  cta: z.string(),
  titleVariant: z.string()
});
export type ShortScript = z.infer<typeof ShortScriptSchema>;

export const LongChapterSchema = z.object({
  title: z.string(),
  text: z.string(),
  scenes: z.array(z.object({ keywords: z.array(z.string()).min(1), mood: z.string().default('neutral') })).min(1)
});
export type LongChapter = z.infer<typeof LongChapterSchema>;

export const LongScriptSchema = z.object({
  title: z.string(),
  chapters: z.array(LongChapterSchema).min(3)
});
export type LongScript = z.infer<typeof LongScriptSchema>;

export const LongOutlineSchema = z.object({
  title: z.string(),
  chapters: z
    .array(
      z.object({
        title: z.string(),
        goal: z.string(),
        sceneKeywords: z.array(z.string()).min(1)
      })
    )
    .min(3)
    .max(9)
});
export type LongOutline = z.infer<typeof LongOutlineSchema>;

export const WordTimingSchema = z.object({
  word: z.string(),
  startSec: z.number(),
  endSec: z.number()
});
export type WordTiming = z.infer<typeof WordTimingSchema>;

export const PlatformMetadataSchema = z.object({
  youtube_shorts: z
    .object({ title: z.string(), description: z.string(), hashtags: z.array(z.string()) })
    .optional(),
  youtube: z
    .object({ title: z.string(), description: z.string(), hashtags: z.array(z.string()) })
    .optional(),
  tiktok: z.object({ caption: z.string() }).optional(),
  instagram_reels: z.object({ caption: z.string(), hashtags: z.array(z.string()) }).optional(),
  instagram_feed: z.object({ caption: z.string(), hashtags: z.array(z.string()) }).optional()
});
export type PlatformMetadata = z.infer<typeof PlatformMetadataSchema>;

export const CarouselSchema = z.object({
  cards: z
    .array(
      z.object({
        kind: z.enum(['hook', 'fact', 'cta']),
        title: z.string(),
        body: z.string().default('')
      })
    )
    .min(1)
    .max(8),
  caption: z.string(),
  hashtags: z.array(z.string())
});
export type Carousel = z.infer<typeof CarouselSchema>;
