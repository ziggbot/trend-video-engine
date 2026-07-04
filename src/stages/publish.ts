import { RunCtx } from '../orchestrator/context.js';
import { transitionPackage, saveManifest } from '../orchestrator/manifest.js';
import { serializeError } from '../orchestrator/logger.js';

/**
 * Publish every approved package via its channel's configured publisher.
 * With the default ManualPublisher this records a "post by hand" result and
 * completes the state machine; a real publisher slots in via config.
 */
export async function publishApproved(ctx: RunCtx): Promise<void> {
  for (const pkg of Object.values(ctx.manifest.packages)) {
    if (pkg.status !== 'approved') continue;
    const publisher = ctx.services.publishers[pkg.publish.publisher];
    if (!publisher) {
      ctx.log.warn(`publish: unknown publisher "${pkg.publish.publisher}" for ${pkg.pkgId} — leaving approved`);
      continue;
    }
    let allOk = true;
    for (const platform of pkg.platforms) {
      if (pkg.publish.results[platform]?.ok) continue;
      if (!publisher.supports(platform, pkg.kind)) {
        pkg.publish.results[platform] = { ok: false, error: `publisher ${publisher.id} does not support ${platform}` };
        allOk = false;
        continue;
      }
      try {
        const result = await publisher.publish(pkg, platform);
        pkg.publish.results[platform] = result.ok
          ? { ok: true, remoteId: result.remoteId, remoteUrl: result.remoteUrl, publishedAt: result.publishedAt }
          : { ok: false, error: result.error };
        if (!result.ok) allOk = false;
      } catch (err) {
        pkg.publish.results[platform] = { ok: false, error: serializeError(err) };
        allOk = false;
      }
    }
    if (allOk && pkg.platforms.length) {
      transitionPackage(pkg, 'published');
    }
    await saveManifest(ctx.manifest, ctx.rootDir);
  }
}
