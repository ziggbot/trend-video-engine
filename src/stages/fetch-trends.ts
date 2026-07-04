import { join } from 'node:path';
import { RunCtx } from '../orchestrator/context.js';
import { writeJson, readJson, fileExists } from '../lib/files.js';
import { saveManifest, loadRecentManifests } from '../orchestrator/manifest.js';
import { serializeError } from '../orchestrator/logger.js';
import { TrendSnapshot, TrendSnapshotSchema } from '../types/trend.js';

/**
 * Fetch Google Trends for every region used by an enabled channel (deduped).
 * On failure, degrade to the newest previous run's snapshot for that region,
 * marked stale so scoring can penalize it.
 */
export async function fetchTrends(ctx: RunCtx, regions: string[]): Promise<void> {
  for (const region of regions) {
    const existing = ctx.manifest.trends[region];
    if (existing?.status === 'done' && existing.file && (await fileExists(existing.file))) {
      ctx.log.info(`trends ${region}: already fetched (resume)`);
      continue;
    }
    const file = join(ctx.runDir, `trends-${region}.json`);
    try {
      const snapshot = await ctx.services.trends.fetch(region as 'SE' | 'US' | 'GLOBAL');
      await writeJson(file, snapshot);
      ctx.manifest.trends[region] = { status: 'done', file, count: snapshot.trends.length, stale: false };
      ctx.log.info(`trends ${region}: fetched ${snapshot.trends.length} topics`);
    } catch (err) {
      ctx.log.warn(`trends ${region}: fetch failed (${serializeError(err)}), trying last good snapshot`);
      const fallback = await findLastGoodSnapshot(ctx, region);
      if (fallback) {
        const stale: TrendSnapshot = { ...fallback, stale: true, trends: fallback.trends.map((t) => ({ ...t, stale: true })) };
        await writeJson(file, stale);
        ctx.manifest.trends[region] = { status: 'done', file, count: stale.trends.length, stale: true };
        ctx.log.warn(`trends ${region}: using stale snapshot from ${fallback.fetchedAt}`);
      } else {
        ctx.manifest.trends[region] = { status: 'failed', error: serializeError(err) };
        ctx.log.error(`trends ${region}: no fallback available — channels in this region will fail`);
      }
    }
    await saveManifest(ctx.manifest, ctx.rootDir);
  }
}

async function findLastGoodSnapshot(ctx: RunCtx, region: string): Promise<TrendSnapshot | null> {
  const manifests = await loadRecentManifests({ rootDir: ctx.rootDir, excludeRunId: ctx.runId, limit: 10 });
  for (const m of manifests) {
    const entry = m.trends[region];
    if (entry?.status === 'done' && entry.file && !entry.stale && (await fileExists(entry.file))) {
      try {
        return TrendSnapshotSchema.parse(await readJson(entry.file));
      } catch {
        // keep looking
      }
    }
  }
  return null;
}
