import { join } from 'node:path';
import { RunCtx, ChannelCtx } from './context';
import { createLogger, serializeError } from './logger';
import { createManifest, loadManifest, saveManifest, loadRecentManifests } from './manifest';
import { loadConfig } from './config';
import { makeRunId } from '../lib/ids';
import { createServices } from '../services';
import { fetchTrends } from '../stages/fetch-trends';
import { scoreTopics, collectRecentTopics } from '../stages/score-topics';
import { planContent } from '../stages/plan-content';
import { produceShort, produceImagePost, produceLong } from '../stages/produce';
import { buildPackage } from '../stages/build-packages';
import { publishApproved } from '../stages/publish';
import { runStage } from './stage';
import { writeJson, readJson, atomicWriteFile, ensureDir } from '../lib/files';
import { TrendSnapshotSchema, ScoredTopic } from '../types/trend';
import { LongScriptSchema } from '../types/script';

export interface RunOptions {
  rootDir?: string;
  channels?: string[];
  resume?: string;
  mock?: boolean;
}

export interface RunOutcome {
  runId: string;
  status: string;
  packages: number;
  failures: string[];
}

export async function runPipeline(opts: RunOptions = {}): Promise<RunOutcome> {
  const rootDir = opts.rootDir ?? '.';
  const mock = opts.mock ?? false;
  const runId = opts.resume ?? makeRunId();
  const runDir = join(rootDir, 'runs', runId);
  const outputDir = join(rootDir, 'output', runId);
  const log = createLogger(join(runDir, 'run.log.jsonl'));

  log.info(`run ${runId} starting${mock ? ' (mock mode)' : ''}${opts.resume ? ' (resume)' : ''}`);
  const config = await loadConfig(rootDir, log);
  const services = createServices(mock, log);
  const manifest = opts.resume ? await loadManifest(runId, rootDir) : createManifest(runId, mock);
  await ensureDir(outputDir);
  await saveManifest(manifest, rootDir);

  const ctx: RunCtx = { runId, rootDir, runDir, outputDir, config, manifest, log, mock, services };

  let channels = config.channels.filter((c) => c.enabled);
  if (opts.channels?.length) {
    channels = channels.filter((c) => opts.channels!.includes(c.id));
    if (!channels.length) throw new Error(`No enabled channels match: ${opts.channels.join(', ')}`);
  }

  // 1. Trends, once per unique region
  const regions = [...new Set(channels.map((c) => c.region))];
  await fetchTrends(ctx, regions);

  // 2. Channels, isolated: one failure never kills the run
  const recentManifests = await loadRecentManifests({ rootDir, excludeRunId: runId, limit: 15 });
  const failures: string[] = [];
  for (const channel of channels) {
    manifest.channels[channel.id] ??= { status: 'pending', plan: [], stages: {} };
    const channelRun = manifest.channels[channel.id];
    if (channelRun.status === 'done') {
      log.info(`channel ${channel.id}: already done (resume)`);
      continue;
    }
    channelRun.status = 'running';
    await saveManifest(manifest, rootDir);
    const chCtx: ChannelCtx = { ...ctx, channel, channelDir: join(runDir, channel.id) };
    try {
      await runChannel(chCtx, recentManifests);
      channelRun.status = 'done';
      log.info(`channel ${channel.id}: done`);
    } catch (err) {
      channelRun.status = 'failed';
      channelRun.error = serializeError(err);
      failures.push(`${channel.id}: ${channelRun.error.split('\n')[0]}`);
      log.error(`channel ${channel.id}: failed — ${serializeError(err)}`);
    }
    await saveManifest(manifest, rootDir);
  }

  // 3. Publish approved packages (ManualPublisher by default)
  await publishApproved(ctx);

  // 4. Finalize + summary
  const packageCount = Object.keys(manifest.packages).length;
  manifest.status = failures.length === 0 ? 'completed' : packageCount > 0 ? 'completed_with_errors' : 'failed';
  manifest.finishedAt = new Date().toISOString();
  await saveManifest(manifest, rootDir);
  await atomicWriteFile(join(runDir, 'summary.md'), buildSummary(ctx, failures));

  log.info(`run ${runId} ${manifest.status}: ${packageCount} package(s), ${failures.length} channel failure(s)`);
  return { runId, status: manifest.status, packages: packageCount, failures };
}

async function runChannel(ctx: ChannelCtx, recentManifests: Awaited<ReturnType<typeof loadRecentManifests>>): Promise<void> {
  const { channel, manifest } = ctx;
  const channelRun = manifest.channels[channel.id];
  const log = ctx.log.child(channel.id);

  const trendEntry = manifest.trends[channel.region];
  if (trendEntry?.status !== 'done' || !trendEntry.file) {
    throw new Error(`No trend data for region ${channel.region}`);
  }
  const snapshot = TrendSnapshotSchema.parse(await readJson(trendEntry.file));

  // Score topics for this channel
  const rankedPath = join(ctx.channelDir, 'ranked.json');
  await runStage(ctx, channelRun.stages, 'score', log, async () => {
    const recentTopics = collectRecentTopics(recentManifests, channel.id, ctx.config.scoring.repetitionLookbackDays);
    const ranked = scoreTopics({ trends: snapshot.trends, channel, scoring: ctx.config.scoring, recentTopics });
    if (!ranked.length) throw new Error('No topics survived scoring/filtering');
    await writeJson(rankedPath, ranked);
    return { outputs: [rankedPath], meta: { count: ranked.length, top: ranked[0].topic } };
  });
  const ranked = (await readJson(rankedPath)) as ScoredTopic[];
  channelRun.topic = {
    title: ranked[0].topic,
    score: ranked[0].totalScore,
    whyNow: ranked[0].whyNow,
    sources: ranked[0].sourceReferences
  };

  // Plan what to make today
  if (!channelRun.plan.length) {
    channelRun.plan = planContent(channel);
  }
  if (!channelRun.plan.length) {
    log.info('cadence produced an empty plan for today');
    return;
  }
  await saveManifest(manifest, ctx.rootDir);

  // Produce + package each planned item (long-form runs before its derived shorts
  // because planContent orders it first)
  for (let i = 0; i < channelRun.plan.length; i++) {
    const item = channelRun.plan[i];
    if (item.pkgId && manifest.packages[item.pkgId]) continue; // resume: already packaged
    let content;
    if (item.kind === 'short' && item.derivedFromChapter !== undefined) {
      const fromChapter = await loadChapterSource(ctx, channelRun.plan, item.topicRank, item.derivedFromChapter);
      if (!fromChapter) {
        log.warn(`plan item ${i}: long-form script unavailable, skipping derived short`);
        continue;
      }
      content = await produceShort(ctx, i, ranked, item.topicRank, { fromChapter });
    } else if (item.kind === 'short') {
      content = await produceShort(ctx, i, ranked, item.topicRank);
    } else if (item.kind === 'image_post') {
      content = await produceImagePost(ctx, i, ranked, item.topicRank);
    } else {
      content = await produceLong(ctx, i, ranked, item.topicRank);
    }
    const pkg = await buildPackage(ctx, content);
    item.pkgId = pkg.pkgId;
    await saveManifest(manifest, ctx.rootDir);
  }
}

/** Find the long-form script produced earlier in this run and pull one chapter from it. */
async function loadChapterSource(
  ctx: ChannelCtx,
  plan: { kind: string; topicRank: number }[],
  topicRank: number,
  chapterIdx: number
): Promise<{ videoTitle: string; chapterTitle: string; chapterText: string } | null> {
  const longIdx = plan.findIndex((p) => p.kind === 'long' && p.topicRank === topicRank);
  if (longIdx === -1) return null;
  const stage = ctx.manifest.channels[ctx.channel.id].stages[`p${longIdx}:script`];
  const scriptFile = stage?.outputs?.[0];
  if (stage?.status !== 'done' || !scriptFile) return null;
  try {
    const script = LongScriptSchema.parse(await readJson(scriptFile));
    const chapter = script.chapters[Math.min(chapterIdx, script.chapters.length - 1)];
    return { videoTitle: script.title, chapterTitle: chapter.title, chapterText: chapter.text };
  } catch {
    return null;
  }
}

function buildSummary(ctx: RunCtx, failures: string[]): string {
  const m = ctx.manifest;
  const lines = [
    `# Run ${m.runId}`,
    '',
    `- Status: **${m.status ?? 'running'}**`,
    `- Started: ${m.startedAt}`,
    `- Mode: ${m.mock ? 'mock' : 'live'}`,
    '',
    '## Packages',
    ''
  ];
  const pkgs = Object.values(m.packages);
  if (!pkgs.length) lines.push('_none_');
  for (const p of pkgs) {
    lines.push(`- **${p.pkgId}** (${p.kind}, ${p.status}) → ${p.platforms.join(', ') || 'no platforms'}`);
    if (p.status === 'approved' || p.status === 'published') {
      lines.push(`  - Post manually from \`${p.zip ?? p.dir}\` (see the package README for copy-paste titles/captions).`);
    }
    if (p.status === 'pending_approval') {
      lines.push(`  - Awaiting approval: \`npm run approve -- ${m.runId} ${p.pkgId} --approve\``);
    }
  }
  if (failures.length) {
    lines.push('', '## Failures', '', ...failures.map((f) => `- ${f}`));
  }
  return lines.join('\n') + '\n';
}
