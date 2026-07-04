import { Orientation, VisualCandidate, VisualsProvider } from './types';
import { fetchJson } from '../../lib/http';
import { withRetry } from '../../lib/retry';

interface PexelsVideoFile {
  id: number;
  quality: string;
  width: number;
  height: number;
  link: string;
}
interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  video_files: PexelsVideoFile[];
}
interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  src: { large2x: string; large: string; original: string };
}

/** Free stock media. https://www.pexels.com/api/ — 200 req/hour, attribution appreciated. */
export class PexelsProvider implements VisualsProvider {
  id = 'pexels';
  private cache = new Map<string, VisualCandidate[]>();

  constructor(private apiKey: string) {}

  private async get<T>(url: string): Promise<T> {
    return withRetry(
      () => fetchJson<T>(url, { headers: { Authorization: this.apiKey } }, 20_000),
      { attempts: 3, baseDelayMs: 2000 }
    );
  }

  async searchVideos(query: string, orientation: Orientation, minDurationSec: number): Promise<VisualCandidate[]> {
    const cacheKey = `v:${orientation}:${query}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=${orientation}&size=medium&per_page=10`;
    const res = await this.get<{ videos?: PexelsVideo[] }>(url);
    const minDim = orientation === 'portrait' ? 1080 : 1280;
    const candidates: VisualCandidate[] = [];
    for (const v of res.videos ?? []) {
      if (v.duration < minDurationSec) continue;
      // smallest file that still meets the target resolution
      const files = v.video_files
        .filter((f) => Math.min(f.width, f.height) >= Math.min(minDim, 720))
        .sort((a, b) => a.width * a.height - b.width * b.height);
      const file = files[0];
      if (!file) continue;
      candidates.push({
        id: `pexels-video-${v.id}`,
        type: 'video',
        url: file.link,
        width: file.width,
        height: file.height,
        durationSec: v.duration
      });
    }
    this.cache.set(cacheKey, candidates);
    return candidates;
  }

  async searchPhotos(query: string, orientation: Orientation): Promise<VisualCandidate[]> {
    const cacheKey = `p:${orientation}:${query}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=10`;
    const res = await this.get<{ photos?: PexelsPhoto[] }>(url);
    const candidates: VisualCandidate[] = (res.photos ?? []).map((p) => ({
      id: `pexels-photo-${p.id}`,
      type: 'image' as const,
      url: p.src.large2x || p.src.large || p.src.original,
      width: p.width,
      height: p.height
    }));
    this.cache.set(cacheKey, candidates);
    return candidates;
  }
}
