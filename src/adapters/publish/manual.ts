import { Platform, ContentKind } from '../../types/channel';
import { PackageEntry } from '../../types/manifest';
import { Publisher, PublishResult } from './types';

/**
 * Default publisher: does not post anywhere. It marks the package as handled so the
 * whole approve→publish state machine runs from day one; the run summary tells the
 * user what to post by hand. Swapping in a real publisher is a config change.
 */
export class ManualPublisher implements Publisher {
  id = 'manual';

  supports(_platform: Platform, _kind: ContentKind): boolean {
    return true;
  }

  async publish(_pkg: PackageEntry, _platform: Platform): Promise<PublishResult> {
    return { ok: true, publishedAt: new Date().toISOString() };
  }
}
