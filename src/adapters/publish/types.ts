import { Platform, ContentKind } from '../../types/channel.js';
import { PackageEntry } from '../../types/manifest.js';

export type PublishResult =
  | { ok: true; remoteId?: string; remoteUrl?: string; publishedAt: string }
  | { ok: false; error: string; retryable: boolean };

export interface Publisher {
  id: string;
  supports(platform: Platform, kind: ContentKind): boolean;
  publish(pkg: PackageEntry, platform: Platform): Promise<PublishResult>;
}
