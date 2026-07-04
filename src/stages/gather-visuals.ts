import { join } from 'node:path';
import { ChannelCtx } from '../orchestrator/context.js';
import { ensureDir, writeJson, readJson, fileExists } from '../lib/files.js';
import { downloadFile } from '../lib/http.js';
import { renderGradientClip } from '../render/ffmpeg.js';
import { Orientation } from '../adapters/visuals/types.js';
import { mapLimit } from '../lib/retry.js';

export interface SceneRequest {
  keywords: string[];
  durationSec: number;
}

export interface SceneAsset {
  index: number;
  type: 'video' | 'image' | 'gradient';
  file: string;
  sourceId?: string;
  durationSec: number;
}

const USED_LEDGER_PATH = join('data-ledger', 'visuals-used.json');
const LEDGER_CAP = 500;
const TOTAL_DOWNLOAD_BUDGET_BYTES = 1.5 * 1024 * 1024 * 1024;

async function loadLedger(rootDir: string): Promise<string[]> {
  const p = join(rootDir, USED_LEDGER_PATH);
  if (!(await fileExists(p))) return [];
  try {
    return await readJson<string[]>(p);
  } catch {
    return [];
  }
}

async function saveLedger(rootDir: string, ids: string[]): Promise<void> {
  await writeJson(join(rootDir, USED_LEDGER_PATH), ids.slice(-LEDGER_CAP));
}

/**
 * Resolve each scene to a local media file. Fallback chain per scene:
 * stock video -> stock photo (Ken Burns at render) -> generated gradient clip.
 * A scene never fails the render.
 */
export async function gatherVisuals(
  ctx: ChannelCtx,
  workDir: string,
  scenes: SceneRequest[],
  orientation: Orientation
): Promise<SceneAsset[]> {
  const mediaDir = join(workDir, 'media');
  await ensureDir(mediaDir);
  const ledger = await loadLedger(ctx.rootDir);
  const used = new Set(ledger);
  const dims = orientation === 'portrait' ? { w: 1080, h: 1920 } : { w: 1920, h: 1080 };
  let downloadedBytes = 0;

  const assets = await mapLimit(scenes, 4, async (scene, index): Promise<SceneAsset> => {
    const query = scene.keywords.join(' ');
    try {
      const videos = (await ctx.services.visuals.searchVideos(query, orientation, scene.durationSec)).filter(
        (c) => !used.has(c.id)
      );
      if (videos.length && downloadedBytes < TOTAL_DOWNLOAD_BUDGET_BYTES) {
        const pick = videos[index % videos.length];
        const file = join(mediaDir, `scene-${index}.mp4`);
        downloadedBytes += await downloadFile(pick.url, file, 120_000);
        used.add(pick.id);
        return { index, type: 'video', file, sourceId: pick.id, durationSec: scene.durationSec };
      }
      const photos = (await ctx.services.visuals.searchPhotos(query, orientation)).filter((c) => !used.has(c.id));
      if (photos.length && downloadedBytes < TOTAL_DOWNLOAD_BUDGET_BYTES) {
        const pick = photos[index % photos.length];
        const file = join(mediaDir, `scene-${index}.jpg`);
        downloadedBytes += await downloadFile(pick.url, file, 60_000);
        used.add(pick.id);
        return { index, type: 'image', file, sourceId: pick.id, durationSec: scene.durationSec };
      }
    } catch (err) {
      ctx.log.warn(`visuals: scene ${index} ("${query}") lookup failed, using gradient fallback`);
    }
    const file = join(mediaDir, `scene-${index}-gradient.mp4`);
    await renderGradientClip({ outPath: file, width: dims.w, height: dims.h, durationSec: scene.durationSec, seed: index });
    return { index, type: 'gradient', file, durationSec: scene.durationSec };
  });

  await saveLedger(ctx.rootDir, [...used]);
  const scenesPath = join(workDir, 'scenes.json');
  await writeJson(scenesPath, assets);
  return assets;
}
