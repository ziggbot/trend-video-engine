import { Platform, ContentKind } from '../../types/channel';
import { PackageEntry } from '../../types/manifest';
import { Publisher, PublishResult } from './types';

/**
 * Stub for the Upload-Post aggregator (https://www.upload-post.com) — one API that
 * posts to TikTok, Instagram Reels, YouTube Shorts and more without per-platform
 * app audits. Free tier: 10 uploads/month; paid from ~$16/month.
 *
 * Activation (Phase 5): set UPLOAD_POST_API_KEY, implement the upload call
 * (POST https://api.upload-post.com/api/upload with video + per-platform titles
 * from the package's platform metadata), and set `"publisher": "upload-post"`
 * on the channel in config/channels.json.
 */
export class UploadPostPublisher implements Publisher {
  id = 'upload-post';

  constructor(private apiKey = process.env.UPLOAD_POST_API_KEY ?? '') {}

  supports(platform: Platform, _kind: ContentKind): boolean {
    return ['tiktok', 'instagram_reels', 'instagram_feed', 'youtube_shorts', 'youtube'].includes(platform);
  }

  async publish(_pkg: PackageEntry, platform: Platform): Promise<PublishResult> {
    if (!this.apiKey) {
      return { ok: false, error: 'UPLOAD_POST_API_KEY not configured — upload-post publisher is a stub until Phase 5', retryable: false };
    }
    return { ok: false, error: `upload-post publisher not implemented yet (platform: ${platform})`, retryable: false };
  }
}
