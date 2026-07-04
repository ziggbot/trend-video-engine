import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ChannelCtx } from '../orchestrator/context.js';
import { completeStructured } from '../adapters/llm/json.js';
import { renderTemplate } from '../lib/text.js';
import { ScoredTopic } from '../types/trend.js';
import {
  Carousel,
  CarouselSchema,
  LongOutlineSchema,
  LongScript,
  PlatformMetadata,
  PlatformMetadataSchema,
  ShortScript,
  ShortScriptSchema
} from '../types/script.js';
import { z } from 'zod';

async function loadPrompt(ctx: ChannelCtx, name: string): Promise<string> {
  return readFile(join(ctx.rootDir, 'config', 'prompts', `${name}.md`), 'utf8');
}

function topicVars(ctx: ChannelCtx, topic: ScoredTopic): Record<string, string> {
  return {
    language: ctx.channel.language === 'sv' ? 'Swedish' : 'English',
    tone: ctx.channel.tone,
    niche: ctx.channel.niche,
    audience: ctx.channel.audience,
    topic: topic.topic,
    whyNow: topic.whyNow,
    newsTitles: topic.sourceReferences.map((n) => `- ${n.title} (${n.source})`).join('\n') || '- (no news context)'
  };
}

export async function generateShortScript(ctx: ChannelCtx, topic: ScoredTopic): Promise<ShortScript> {
  const template = await loadPrompt(ctx, 'short-script');
  const prompt = renderTemplate(template, topicVars(ctx, topic));
  return completeStructured(ctx.services.llm, ShortScriptSchema, { prompt, temperature: 0.9 });
}

export async function generatePlatformMetadata(
  ctx: ChannelCtx,
  topic: ScoredTopic,
  contentSummary: string
): Promise<PlatformMetadata> {
  const template = await loadPrompt(ctx, 'platform-metadata');
  const prompt = renderTemplate(template, { ...topicVars(ctx, topic), contentSummary });
  return completeStructured(ctx.services.llm, PlatformMetadataSchema, { prompt, temperature: 0.7 });
}

export async function generateCarousel(ctx: ChannelCtx, topic: ScoredTopic): Promise<Carousel> {
  const template = await loadPrompt(ctx, 'ig-carousel');
  const prompt = renderTemplate(template, topicVars(ctx, topic));
  return completeStructured(ctx.services.llm, CarouselSchema, { prompt, temperature: 0.8 });
}

const LongChapterTextSchema = z.object({
  text: z.string().min(200),
  scenes: z.array(z.object({ keywords: z.array(z.string()).min(1), mood: z.string().default('neutral') })).min(1)
});

/** Hierarchical long-form script: outline first, then one call per chapter. */
export async function generateLongScript(ctx: ChannelCtx, topic: ScoredTopic): Promise<LongScript> {
  const outlineTemplate = await loadPrompt(ctx, 'long-outline');
  const outline = await completeStructured(ctx.services.llm, LongOutlineSchema, {
    prompt: renderTemplate(outlineTemplate, topicVars(ctx, topic)),
    temperature: 0.9
  });

  const chapterTemplate = await loadPrompt(ctx, 'long-chapter');
  const chapters = [];
  let runningSummary = '(start of video)';
  for (const ch of outline.chapters) {
    const result = await completeStructured(ctx.services.llm, LongChapterTextSchema, {
      prompt: renderTemplate(chapterTemplate, {
        ...topicVars(ctx, topic),
        videoTitle: outline.title,
        chapterTitle: ch.title,
        chapterGoal: ch.goal,
        runningSummary
      }),
      temperature: 0.85,
      maxOutputTokens: 2048
    });
    chapters.push({ title: ch.title, text: result.text, scenes: result.scenes });
    runningSummary = `${runningSummary}\nChapter "${ch.title}": ${result.text.slice(0, 200)}…`;
  }
  return { title: outline.title, chapters };
}
