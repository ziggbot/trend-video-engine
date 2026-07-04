import { join, basename, resolve } from 'node:path';
import { copyFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ChannelCtx } from '../orchestrator/context';
import { ensureDir, writeJson, atomicWriteFile } from '../lib/files';
import { makePkgId } from '../lib/ids';
import { ffprobe } from '../render/ffmpeg';
import { ProducedContent } from './produce';
import { PackageEntry } from '../types/manifest';
import { transitionPackage } from '../orchestrator/manifest';
import { Platform } from '../types/channel';

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
  const platformMeta = Object.fromEntries(
    platforms.map((pl) => [pl, { ...((content.metadata as Record<string, any>)[pl] ?? fallbackMeta(content)) }])
  );
  injectAffiliate(ctx, platformMeta);
  const pkgJson = {
    pkgId,
    runId: ctx.runId,
    channelId: ctx.channel.id,
    kind: content.kind,
    language: ctx.channel.language,
    topic: content.topic.topic,
    durationSec: content.durationSec,
    media: files,
    platforms: platformMeta,
    provenance: { ...content.provenance, generatedAt: new Date().toISOString() }
  };
  await writeJson(join(dir, 'package.json'), pkgJson);
  await atomicWriteFile(join(dir, 'README.md'), packageReadme(ctx, pkgId, content, platforms, platformMeta));

  const zipPath = await zipDir(dir, join(ctx.outputDir, `${pkgId}.zip`));

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

/**
 * Append the channel's affiliate block to YouTube descriptions (clickable links);
 * link-hostile surfaces (TikTok/Instagram captions) get a "link in bio" nudge instead.
 * Affiliate revenue needs no monetization threshold — it starts from video #1.
 */
function injectAffiliate(ctx: ChannelCtx, platformMeta: Record<string, any>): void {
  const aff = ctx.channel.affiliate;
  if (!aff) return;
  const linkBlock = `${aff.blurb}\n${aff.links.map((l) => `${l.label}: ${l.url}`).join('\n')}`;
  const bioNudge = ctx.channel.language === 'sv' ? '🔗 Länkar i bion' : '🔗 Links in bio';
  for (const [platform, meta] of Object.entries(platformMeta)) {
    if (platform === 'youtube' || platform === 'youtube_shorts') {
      if (typeof meta.description === 'string') meta.description = `${meta.description}\n\n${linkBlock}`;
    } else if (typeof meta.caption === 'string' && !meta.caption.includes(bioNudge)) {
      meta.caption = `${meta.caption}\n${bioNudge}`;
    }
  }
}

function packageReadme(
  ctx: ChannelCtx,
  pkgId: string,
  content: ProducedContent,
  platforms: Platform[],
  platformMeta: Record<string, any>
): string {
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
    const meta = platformMeta[pl];
    lines.push(`### ${pl}`, '');
    if (meta?.title) lines.push('**Title:**', '```', meta.title, '```', '');
    if (meta?.description) lines.push('**Description:**', '```', meta.description, '```', '');
    if (meta?.caption) lines.push('**Caption:**', '```', meta.caption, '```', '');
    if (meta?.hashtags?.length) lines.push('**Hashtags:**', '```', meta.hashtags.join(' '), '```', '');
  }
  if (ctx.channel.affiliate) {
    lines.push(
      '## Affiliate links',
      '',
      'Already appended to the YouTube description above. Also keep these in the channel bio / link-in-bio page:',
      '',
      ...ctx.channel.affiliate.links.map((l) => `- ${l.label}: ${l.url}`),
      ''
    );
  }
  lines.push('---', `Generated by trend-video-engine run ${ctx.runId}. Review before posting.`);
  return lines.join('\n');
}

/** Zip the package dir; returns the archive path (tar.gz fallback when zip is missing). */
async function zipDir(dir: string, zipPath: string): Promise<string> {
  const absZip = resolve(zipPath);
  try {
    await execFileAsync('zip', ['-r', '-q', absZip, '.'], { cwd: dir, timeout: 120_000 });
    return zipPath;
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { message?: string };
    const zipMissing = e.code === 'ENOENT' || /not found|ENOENT/i.test(e.message ?? '');
    if (zipMissing) {
      const tarPath = zipPath.replace(/\.zip$/, '.tar.gz');
      await execFileAsync('tar', ['-czf', resolve(tarPath), '-C', dir, '.'], { timeout: 120_000 });
      return tarPath;
    }
    throw err;
  }
}
