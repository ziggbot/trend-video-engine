import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ChannelCtx } from '../orchestrator/context';
import { completeStructured } from '../adapters/llm/json';
import { renderTemplate } from '../lib/text';
import { ScoredTopic } from '../types/trend';
import {
  Carousel,
  CarouselSchema,
  LongOutlineSchema,
  LongScript,
  PlatformMetadata,
  PlatformMetadataSchema,
  ShortScript,
  ShortScriptSchema
} from '../types/script';
import { z } from 'zod';

async function loadPrompt(ctx: ChannelCtx, name: string): Promise<string> {
  return readFile(join(ctx.rootDir, 'config', 'prompts', `${name}.md`), 'utf8');
}

const STYLE_INSTRUCTIONS: Record<string, string> = {
  news: 'STYLE: This is timely content about something happening right now — it may reference current events directly.',
  evergreen:
    'STYLE: EVERGREEN. The trend below only proves people are curious about this subject right now. Do NOT recap the news. ' +
    'Explain the underlying subject — background, how it works, why it matters — so the video is still accurate and ' +
    'watchable a year from now. Avoid dates, "today", "just happened", "breaking" and other time-bound framing.'
};

function topicVars(ctx: ChannelCtx, topic: ScoredTopic): Record<string, string> {
  return {
    language: ctx.channel.language === 'sv' ? 'Swedish' : 'English',
    tone: ctx.channel.tone,
    niche: ctx.channel.niche,
    audience: ctx.channel.audience,
    styleInstruction: STYLE_INSTRUCTIONS[ctx.channel.contentStyle],
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

/** Cut a vertical short's script out of one long-form chapter (funnel content). */
export async function generateShortFromChapter(
  ctx: ChannelCtx,
  topic: ScoredTopic,
  source: { videoTitle: string; chapterTitle: string; chapterText: string }
): Promise<ShortScript> {
  const template = await loadPrompt(ctx, 'short-from-chapter');
  const prompt = renderTemplate(template, {
    ...topicVars(ctx, topic),
    videoTitle: source.videoTitle,
    chapterTitle: source.chapterTitle,
    chapterText: source.chapterText
  });
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
