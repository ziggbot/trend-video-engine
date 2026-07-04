import { join } from 'node:path';
import { ChannelCtx } from '../orchestrator/context';
import { runStage } from '../orchestrator/stage';
import { readJson, writeJson, ensureDir } from '../lib/files';
import { ScoredTopic, ScoredTopicSchema } from '../types/trend';
import {
  Carousel,
  CarouselSchema,
  LongScript,
  LongScriptSchema,
  PlatformMetadata,
  PlatformMetadataSchema,
  ShortScript,
  ShortScriptSchema,
  WordTiming
} from '../types/script';
import {
  generateCarousel,
  generateLongScript,
  generatePlatformMetadata,
  generateShortScript
} from './generate-script';
import { synthesizeChapters, synthesizeVoice } from './synthesize-voice';
import { paginateWords, toAss, toSrt, CaptionPage } from '../render/captions';
import { atomicWriteFile } from '../lib/files';
import { gatherVisuals, SceneAsset, SceneRequest } from './gather-visuals';
import { AssetServer } from '../render/asset-server';
import { renderComposition, renderStillImage } from '../render/remotion';
import { renderLongform, extractFrame } from '../render/longform';
import { ffprobe } from '../render/ffmpeg';
import { z } from 'zod';

export interface ProducedContent {
  kind: 'short' | 'long' | 'image_post';
  topic: ScoredTopic;
  videoPath?: string;
  imagePaths?: string[];
  thumbnailPath?: string;
  srtPath?: string;
  durationSec?: number;
  metadata: PlatformMetadata;
  caption?: string;
  hashtags?: string[];
  provenance: Record<string, unknown>;
}

function stageKeyPrefix(planIdx: number): string {
  return `p${planIdx}`;
}

function pickTopic(ranked: ScoredTopic[], topicRank: number): ScoredTopic {
  const topic = ranked[Math.min(topicRank, ranked.length - 1)];
  if (!topic) throw new Error('No scorable topics available for this channel');
  return topic;
}

/** Split the narration duration across segments proportional to their word counts. */
export function sceneDurations(segments: Array<{ text: string }>, totalSec: number): number[] {
  const counts = segments.map((s) => Math.max(1, s.text.split(/\s+/).filter(Boolean).length));
  const total = counts.reduce((a, b) => a + b, 0);
  return counts.map((c) => Math.max(2, (c / total) * totalSec));
}

export async function produceShort(
  ctx: ChannelCtx,
  planIdx: number,
  ranked: ScoredTopic[],
  topicRank: number
): Promise<ProducedContent> {
  const p = stageKeyPrefix(planIdx);
  const stages = ctx.manifest.channels[ctx.channel.id].stages;
  const log = ctx.log.child(`${ctx.channel.id}:${p}:short`);
  const workDir = join(ctx.channelDir, `${p}-short`);
  const topic = pickTopic(ranked, topicRank);

  // 1. Script
  const scriptPath = join(workDir, 'script.json');
  await runStage(ctx, stages, `${p}:script`, log, async () => {
    const script = await generateShortScript(ctx, topic);
    await writeJson(scriptPath, script);
    return { outputs: [scriptPath] };
  });
  const script = ShortScriptSchema.parse(await readJson(scriptPath));
  const narration = [script.hook, ...script.segments.map((s) => s.text), script.cta].join(' ');

  // 2. Voice
  const voiceDir = join(workDir, 'voice');
  const voiceStage = await runStage(ctx, stages, `${p}:voice`, log, async () => {
    const res = await synthesizeVoice(ctx, voiceDir, narration);
    return {
      outputs: [res.audioPath, res.timestampsPath],
      meta: { durationSec: res.durationSec, provider: res.provider }
    };
  });
  const [audioPath, timestampsPath] = voiceStage.outputs;
  const durationSec = (voiceStage.meta?.durationSec as number) ?? (await ffprobe(audioPath)).durationSec;
  const words = z.array(z.object({ word: z.string(), startSec: z.number(), endSec: z.number() })).parse(
    await readJson(timestampsPath)
  ) as WordTiming[];

  // 3. Captions
  const captionsJsonPath = join(workDir, 'captions.json');
  const srtPath = join(workDir, 'captions.srt');
  await runStage(ctx, stages, `${p}:captions`, log, async () => {
    const pages = paginateWords(words, { maxWords: 4, maxDurationSec: 1.6 });
    await writeJson(captionsJsonPath, pages);
    await atomicWriteFile(srtPath, toSrt(pages));
    return { outputs: [captionsJsonPath, srtPath] };
  });
  const pages = (await readJson(captionsJsonPath)) as CaptionPage[];

  // 4. Visuals
  const visualsDir = join(workDir, 'visuals');
  const durations = sceneDurations(script.segments, durationSec);
  const sceneRequests: SceneRequest[] = script.segments.map((s, i) => ({
    keywords: s.sceneKeywords,
    durationSec: durations[i]
  }));
  const scenesPath = join(visualsDir, 'scenes.json');
  await runStage(ctx, stages, `${p}:visuals`, log, async () => {
    const assets = await gatherVisuals(ctx, visualsDir, sceneRequests, 'portrait');
    return { outputs: [scenesPath], meta: { sources: assets.map((a) => a.sourceId).filter(Boolean) } };
  });
  const scenes = (await readJson(scenesPath)) as SceneAsset[];

  // 5. Render (Remotion) + cover still
  const renderDir = join(workDir, 'render');
  const videoPath = join(renderDir, 'short.mp4');
  const thumbnailPath = join(renderDir, 'cover.jpg');
  await runStage(ctx, stages, `${p}:render`, log, async () => {
    await ensureDir(renderDir);
    const server = new AssetServer(ctx.rootDir);
    await server.start();
    try {
      const inputProps = {
        audioUrl: server.urlFor(audioPath),
        durationSec,
        scenes: scenes.map((s) => ({
          type: s.type === 'gradient' ? 'video' : s.type,
          url: server.urlFor(s.file),
          durationSec: s.durationSec
        })),
        captions: pages,
        hook: script.hook,
        themeName: ctx.channel.theme
      };
      await renderComposition({ rootDir: ctx.rootDir, log, compositionId: 'ShortVideo', inputProps, outPath: videoPath });
      await renderStillImage({
        rootDir: ctx.rootDir,
        log,
        compositionId: 'ShortVideo',
        inputProps,
        outPath: thumbnailPath,
        frame: 30
      });
    } finally {
      await server.stop();
    }
    return { outputs: [videoPath, thumbnailPath] };
  });

  // 6. Platform metadata
  const metadataPath = join(workDir, 'metadata.json');
  await runStage(ctx, stages, `${p}:metadata`, log, async () => {
    const metadata = await generatePlatformMetadata(ctx, topic, `${script.titleVariant}: ${narration.slice(0, 400)}`);
    await writeJson(metadataPath, metadata);
    return { outputs: [metadataPath] };
  });
  const metadata = PlatformMetadataSchema.parse(await readJson(metadataPath));

  return {
    kind: 'short',
    topic,
    videoPath,
    thumbnailPath,
    srtPath,
    durationSec,
    metadata,
    provenance: {
      trendSources: topic.sourceReferences,
      llm: ctx.services.llm.id,
      tts: voiceStage.meta?.provider,
      visualSources: scenes.map((s) => s.sourceId).filter(Boolean)
    }
  };
}

export async function produceImagePost(
  ctx: ChannelCtx,
  planIdx: number,
  ranked: ScoredTopic[],
  topicRank: number
): Promise<ProducedContent> {
  const p = stageKeyPrefix(planIdx);
  const stages = ctx.manifest.channels[ctx.channel.id].stages;
  const log = ctx.log.child(`${ctx.channel.id}:${p}:image`);
  const workDir = join(ctx.channelDir, `${p}-image`);
  const topic = pickTopic(ranked, topicRank);

  const carouselPath = join(workDir, 'carousel.json');
  await runStage(ctx, stages, `${p}:carousel`, log, async () => {
    const carousel = await generateCarousel(ctx, topic);
    await writeJson(carouselPath, carousel);
    return { outputs: [carouselPath] };
  });
  const carousel: Carousel = CarouselSchema.parse(await readJson(carouselPath));

  const renderDir = join(workDir, 'render');
  const imagePaths = carousel.cards.map((_, i) => join(renderDir, `images/${String(i + 1).padStart(2, '0')}.png`));
  await runStage(ctx, stages, `${p}:render`, log, async () => {
    await ensureDir(join(renderDir, 'images'));
    for (let i = 0; i < carousel.cards.length; i++) {
      const card = carousel.cards[i];
      await renderStillImage({
        rootDir: ctx.rootDir,
        log,
        compositionId: 'IgCard',
        inputProps: {
          kind: card.kind,
          title: card.title,
          body: card.body,
          index: i,
          total: carousel.cards.length,
          channelName: ctx.channel.niche,
          themeName: ctx.channel.theme
        },
        outPath: imagePaths[i]
      });
    }
    return { outputs: imagePaths };
  });

  const metadata: PlatformMetadata = {
    instagram_feed: { caption: carousel.caption, hashtags: carousel.hashtags }
  };

  return {
    kind: 'image_post',
    topic,
    imagePaths,
    metadata,
    caption: carousel.caption,
    hashtags: carousel.hashtags,
    provenance: { trendSources: topic.sourceReferences, llm: ctx.services.llm.id }
  };
}

export async function produceLong(
  ctx: ChannelCtx,
  planIdx: number,
  ranked: ScoredTopic[],
  topicRank: number
): Promise<ProducedContent> {
  const p = stageKeyPrefix(planIdx);
  const stages = ctx.manifest.channels[ctx.channel.id].stages;
  const log = ctx.log.child(`${ctx.channel.id}:${p}:long`);
  const workDir = join(ctx.channelDir, `${p}-long`);
  const topic = pickTopic(ranked, topicRank);

  // 1. Hierarchical script
  const scriptPath = join(workDir, 'script.json');
  await runStage(ctx, stages, `${p}:script`, log, async () => {
    const script = await generateLongScript(ctx, topic);
    await writeJson(scriptPath, script);
    return { outputs: [scriptPath] };
  });
  const script: LongScript = LongScriptSchema.parse(await readJson(scriptPath));

  // 2. Voice (per chapter, concatenated)
  const voiceDir = join(workDir, 'voice');
  const voiceStage = await runStage(ctx, stages, `${p}:voice`, log, async () => {
    const res = await synthesizeChapters(ctx, voiceDir, script.chapters);
    return {
      outputs: [res.audioPath, res.timestampsPath],
      meta: { durationSec: res.durationSec, provider: res.provider }
    };
  });
  const [audioPath, timestampsPath] = voiceStage.outputs;
  const durationSec = (voiceStage.meta?.durationSec as number) ?? (await ffprobe(audioPath)).durationSec;
  const words = (await readJson(timestampsPath)) as WordTiming[];

  // 3. Captions (sentence-level lines for long-form)
  const assPath = join(workDir, 'captions.ass');
  const srtPath = join(workDir, 'captions.srt');
  await runStage(ctx, stages, `${p}:captions`, log, async () => {
    const pages = paginateWords(words, { maxWords: 7, maxDurationSec: 3.5 });
    await atomicWriteFile(assPath, toAss(pages, { fontName: 'Noto Sans', fontSize: 56, marginV: 70 }));
    await atomicWriteFile(srtPath, toSrt(pages));
    return { outputs: [assPath, srtPath] };
  });

  // 4. Visuals: ~2 assets per chapter, landscape
  const visualsDir = join(workDir, 'visuals');
  const scenesPath = join(visualsDir, 'scenes.json');
  const chapterSec = durationSec / script.chapters.length;
  const sceneRequests: SceneRequest[] = script.chapters.flatMap((ch) => {
    const perScene = chapterSec / ch.scenes.length;
    return ch.scenes.map((s) => ({ keywords: s.keywords, durationSec: Math.max(4, perScene) }));
  });
  await runStage(ctx, stages, `${p}:visuals`, log, async () => {
    const assets = await gatherVisuals(ctx, visualsDir, sceneRequests, 'landscape');
    return { outputs: [scenesPath], meta: { sources: assets.map((a) => a.sourceId).filter(Boolean) } };
  });
  const scenes = (await readJson(scenesPath)) as SceneAsset[];

  // 5. Render (ffmpeg two-pass)
  const renderDir = join(workDir, 'render');
  const videoPath = join(renderDir, 'long.mp4');
  await runStage(ctx, stages, `${p}:render`, log, async () => {
    await ensureDir(renderDir);
    await renderLongform({
      workDir: renderDir,
      scenes,
      voPath: audioPath,
      voDurationSec: durationSec,
      assPath,
      musicDir: join(ctx.rootDir, 'assets', 'music'),
      outPath: videoPath,
      log
    });
    return { outputs: [videoPath] };
  });

  // 6. Thumbnail
  const thumbnailPath = join(renderDir, 'thumbnail.jpg');
  await runStage(ctx, stages, `${p}:thumbnail`, log, async () => {
    const framePath = join(renderDir, 'thumb-frame.jpg');
    await extractFrame(videoPath, Math.min(5, durationSec / 3), framePath);
    const server = new AssetServer(ctx.rootDir);
    await server.start();
    try {
      await renderStillImage({
        rootDir: ctx.rootDir,
        log,
        compositionId: 'Thumbnail',
        inputProps: {
          title: script.title,
          backgroundUrl: server.urlFor(framePath),
          channelName: ctx.channel.niche,
          themeName: ctx.channel.theme
        },
        outPath: thumbnailPath
      });
    } finally {
      await server.stop();
    }
    return { outputs: [thumbnailPath] };
  });

  // 7. Metadata
  const metadataPath = join(workDir, 'metadata.json');
  await runStage(ctx, stages, `${p}:metadata`, log, async () => {
    const summary = `${script.title}. ${script.chapters.map((c) => c.title).join('; ')}`;
    const metadata = await generatePlatformMetadata(ctx, topic, summary);
    await writeJson(metadataPath, metadata);
    return { outputs: [metadataPath] };
  });
  const metadata = PlatformMetadataSchema.parse(await readJson(metadataPath));

  return {
    kind: 'long',
    topic,
    videoPath,
    thumbnailPath,
    srtPath,
    durationSec,
    metadata,
    provenance: {
      trendSources: topic.sourceReferences,
      llm: ctx.services.llm.id,
      tts: voiceStage.meta?.provider,
      visualSources: scenes.map((s) => s.sourceId).filter(Boolean)
    }
  };
}

export { ScoredTopicSchema };
