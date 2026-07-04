import { join, basename } from 'node:path';
import { copyFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ChannelCtx } from '../orchestrator/context.js';
import { ensureDir, writeJson, atomicWriteFile } from '../lib/files.js';
import { makePkgId } from '../lib/ids.js';
import { ffprobe } from '../render/ffmpeg.js';
import { ProducedContent } from './produce.js';
import { PackageEntry } from '../types/manifest.js';
import { transitionPackage } from '../orchestrator/manifest.js';
import { Platform } from '../types/channel.js';

const execFileAsync = promisify(execFile);

/**
 * Assemble the ready-to-post package for a produced piece of content, verify the
 * media with ffprobe, zip it, and apply the channel's approval policy.
 */
export async function buildPackage(ctx: ChannelCtx, content: ProducedContent): Promise<PackageEntry> {
  const pkgId = makePkgId(ctx.channel.id, content.kind);
  const dir = join(ctx.outputDir, ctx.channel.id, pkgId);
  await ensureDir(dir);

  const files: Record<string, string> = {};

  if (content.videoPath) {
    const name = content.kind === 'short' ? 'short.mp4' : 'long.mp4';
    await copyFile(content.videoPath, join(dir, name));
    files.video = name;
    const info = await ffprobe(join(dir, name));
    if (!info.hasVideo || !info.hasAudio) throw new Error(`package ${pkgId}: video is missing a stream`);
    const expected = content.durationSec ?? 0;
    if (expected > 0 && Math.abs(info.durationSec - expected) > Math.max(3, expected * 0.25)) {
      throw new Error(`package ${pkgId}: video duration ${info.durationSec}s far from expected ${expected}s`);
    }
    const wantPortrait = content.kind === 'short';
    const isPortrait = (info.height ?? 0) > (info.width ?? 0);
    if (wantPortrait !== isPortrait) throw new Error(`package ${pkgId}: wrong orientation`);
  }

  if (content.imagePaths?.length) {
    await ensureDir(join(dir, 'images'));
    for (const img of content.imagePaths) {
      await copyFile(img, join(dir, 'images', basename(img)));
    }
    files.images = 'images/';
  }

  if (content.thumbnailPath) {
    await copyFile(content.thumbnailPath, join(dir, 'thumbnail.jpg'));
    files.thumbnail = 'thumbnail.jpg';
  }
  if (content.srtPath) {
    await copyFile(content.srtPath, join(dir, 'captions.srt'));
    files.captions = 'captions.srt';
  }

  const platforms = relevantPlatforms(ctx, content);
  const pkgJson = {
    pkgId,
    runId: ctx.runId,
    channelId: ctx.channel.id,
    kind: content.kind,
    language: ctx.channel.language,
    topic: content.topic.topic,
    durationSec: content.durationSec,
    media: files,
    platforms: Object.fromEntries(
      platforms.map((pl) => [pl, (content.metadata as Record<string, unknown>)[pl] ?? fallbackMeta(content)])
    ),
    provenance: { ...content.provenance, generatedAt: new Date().toISOString() }
  };
  await writeJson(join(dir, 'package.json'), pkgJson);
  await atomicWriteFile(join(dir, 'README.md'), packageReadme(ctx, pkgId, content, platforms));

  const zipName = `${pkgId}.zip`;
  const zipPath = join(ctx.outputDir, zipName);
  await zipDir(dir, zipPath);

  const approvalMode = ctx.channel.approval[content.kind];
  const entry: PackageEntry = {
    pkgId,
    channelId: ctx.channel.id,
    kind: content.kind,
    platforms,
    status: 'rendered',
    dir,
    zip: zipPath,
    publish: { publisher: ctx.channel.publisher, results: {} }
  };
  transitionPackage(entry, 'packaged');
  if (approvalMode === 'auto') {
    transitionPackage(entry, 'approved');
    entry.approval = { mode: 'auto', by: `policy:${content.kind}-auto`, at: new Date().toISOString() };
  } else {
    transitionPackage(entry, 'pending_approval');
  }

  ctx.manifest.packages[pkgId] = entry;
  return entry;
}

function relevantPlatforms(ctx: ChannelCtx, content: ProducedContent): Platform[] {
  const byKind: Record<string, Platform[]> = {
    short: ['youtube_shorts', 'tiktok', 'instagram_reels'],
    long: ['youtube'],
    image_post: ['instagram_feed']
  };
  return ctx.channel.platforms.filter((p) => byKind[content.kind].includes(p));
}

function fallbackMeta(content: ProducedContent): Record<string, unknown> {
  return { caption: content.caption ?? content.topic.topic, hashtags: content.hashtags ?? [] };
}

function packageReadme(ctx: ChannelCtx, pkgId: string, content: ProducedContent, platforms: Platform[]): string {
  const lines: string[] = [
    `# ${pkgId}`,
    '',
    `- **Channel:** ${ctx.channel.id} (${ctx.channel.language}, ${ctx.channel.region})`,
    `- **Kind:** ${content.kind}`,
    `- **Topic:** ${content.topic.topic}`,
    `- **Why now:** ${content.topic.whyNow}`,
    content.durationSec ? `- **Duration:** ${Math.round(content.durationSec)}s` : '',
    '',
    '## Sources',
    ...content.topic.sourceReferences.map((s) => `- [${s.title}](${s.url}) — ${s.source}`),
    '',
    '## How to post',
    ''
  ].filter(Boolean) as string[];

  for (const pl of platforms) {
    const meta = (content.metadata as Record<string, any>)[pl];
    lines.push(`### ${pl}`, '');
    if (meta?.title) lines.push('**Title:**', '```', meta.title, '```', '');
    if (meta?.description) lines.push('**Description:**', '```', meta.description, '```', '');
    if (meta?.caption) lines.push('**Caption:**', '```', meta.caption, '```', '');
    if (meta?.hashtags?.length) lines.push('**Hashtags:**', '```', meta.hashtags.join(' '), '```', '');
  }
  lines.push('---', `Generated by trend-video-engine run ${ctx.runId}. Review before posting.`);
  return lines.join('\n');
}

async function zipDir(dir: string, zipPath: string): Promise<void> {
  try {
    await execFileAsync('zip', ['-r', '-q', zipPath, '.'], { cwd: dir, timeout: 120_000 });
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ENOENT') {
      // zip not installed — fall back to tar.gz (always present on Linux runners)
      const tarPath = zipPath.replace(/\.zip$/, '.tar.gz');
      await execFileAsync('tar', ['-czf', tarPath, '-C', dir, '.'], { timeout: 120_000 });
      return;
    }
    throw err;
  }
}
