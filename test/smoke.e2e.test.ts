import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, cpSync, readFileSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { rm } from 'node:fs/promises';
import { runPipeline } from '../src/orchestrator/run';
import { ManifestSchema } from '../src/types/manifest';
import { ffprobe } from '../src/render/ffmpeg';

/**
 * Full pipeline smoke test in mock mode: no network, no API keys.
 * Exercises the real orchestrator, manifest, captions, an actual Remotion render
 * and actual ffmpeg work, then proves resume idempotency.
 */

const repoRoot = resolve('.');
let workRoot: string;

beforeAll(() => {
  // Isolated working copy so runs/ and output/ don't pollute the repo.
  workRoot = mkdtempSync(join(tmpdir(), 'tve-smoke-'));
  for (const dir of ['config', 'test']) {
    cpSync(join(repoRoot, dir), join(workRoot, dir), { recursive: true });
  }
  cpSync(join(repoRoot, 'src'), join(workRoot, 'src'), { recursive: true });
  cpSync(join(repoRoot, 'package.json'), join(workRoot, 'package.json'));
  cpSync(join(repoRoot, 'tsconfig.json'), join(workRoot, 'tsconfig.json'));
  symlinkSync(join(repoRoot, 'node_modules'), join(workRoot, 'node_modules'));
});

afterAll(async () => {
  if (workRoot) await rm(workRoot, { recursive: true, force: true });
});

describe('mock end-to-end run', () => {
  let runId: string;

  it('produces a posting-ready short-video package', async () => {
    const outcome = await runPipeline({
      rootDir: workRoot,
      mock: true,
      channels: ['sv-shorts-news']
    });
    runId = outcome.runId;
    expect(outcome.failures).toEqual([]);
    expect(outcome.status).toBe('completed');
    expect(outcome.packages).toBeGreaterThanOrEqual(2); // short + image post

    const manifest = ManifestSchema.parse(
      JSON.parse(readFileSync(join(workRoot, 'runs', runId, 'manifest.json'), 'utf8'))
    );
    expect(manifest.status).toBe('completed');

    const packages = Object.values(manifest.packages);
    const short = packages.find((p) => p.kind === 'short');
    expect(short).toBeDefined();
    // Auto-approval policy: shorts go straight to published (manual publisher)
    expect(short!.status).toBe('published');

    // Video sanity: streams, duration, orientation
    const videoPath = join(short!.dir, 'short.mp4');
    expect(existsSync(videoPath)).toBe(true);
    const info = await ffprobe(videoPath);
    expect(info.hasVideo).toBe(true);
    expect(info.hasAudio).toBe(true);
    expect(info.width).toBe(1080);
    expect(info.height).toBe(1920);
    expect(info.durationSec).toBeGreaterThan(4);

    // Package contents
    const pkgJson = JSON.parse(readFileSync(join(short!.dir, 'package.json'), 'utf8'));
    expect(pkgJson.platforms.tiktok).toBeDefined();
    expect(pkgJson.platforms.youtube_shorts.title).toBeTruthy();
    expect(existsSync(join(short!.dir, 'README.md'))).toBe(true);
    expect(existsSync(join(short!.dir, 'captions.srt'))).toBe(true);
    expect(existsSync(join(short!.dir, 'thumbnail.jpg'))).toBe(true);

    // Image post package
    const imagePost = packages.find((p) => p.kind === 'image_post');
    expect(imagePost).toBeDefined();
    expect(existsSync(join(imagePost!.dir, 'images', '01.png'))).toBe(true);
  }, 600_000);

  it('resume skips completed render stages (idempotency)', async () => {
    const before = readFileSync(join(workRoot, 'runs', runId, 'manifest.json'), 'utf8');
    const manifestBefore = ManifestSchema.parse(JSON.parse(before));
    const renderStage = Object.entries(manifestBefore.channels['sv-shorts-news'].stages).find(([k]) =>
      k.endsWith(':render')
    );
    const finishedAtBefore = renderStage?.[1].finishedAt;

    const outcome = await runPipeline({ rootDir: workRoot, mock: true, channels: ['sv-shorts-news'], resume: runId });
    expect(outcome.status).toBe('completed');

    const manifestAfter = ManifestSchema.parse(
      JSON.parse(readFileSync(join(workRoot, 'runs', runId, 'manifest.json'), 'utf8'))
    );
    const renderAfter = manifestAfter.channels['sv-shorts-news'].stages[renderStage![0]];
    // untouched: the stage was skipped, not re-run
    expect(renderAfter.finishedAt).toBe(finishedAtBefore);
  }, 120_000);
});
