import { join } from 'node:path';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { Logger } from '../orchestrator/logger.js';

let bundlePromise: Promise<string> | null = null;

/** Bundle the Remotion project once per process; reused by all renders in a run. */
export function getBundle(rootDir: string, log: Logger): Promise<string> {
  if (!bundlePromise) {
    bundlePromise = (async () => {
      await ensureBrowser();
      log.info('remotion: bundling compositions…');
      const serveUrl = await bundle({
        entryPoint: join(rootDir, 'src', 'remotion', 'index.ts'),
        onProgress: () => undefined
      });
      log.info('remotion: bundle ready');
      return serveUrl;
    })();
  }
  return bundlePromise;
}

export async function renderComposition(opts: {
  rootDir: string;
  log: Logger;
  compositionId: string;
  inputProps: Record<string, unknown>;
  outPath: string;
}): Promise<void> {
  const serveUrl = await getBundle(opts.rootDir, opts.log);
  const composition = await selectComposition({
    serveUrl,
    id: opts.compositionId,
    inputProps: opts.inputProps
  });
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    crf: 20,
    outputLocation: opts.outPath,
    inputProps: opts.inputProps,
    timeoutInMilliseconds: 120_000,
    chromiumOptions: { gl: 'swangle' }
  });
}

export async function renderStillImage(opts: {
  rootDir: string;
  log: Logger;
  compositionId: string;
  inputProps: Record<string, unknown>;
  outPath: string;
  frame?: number;
}): Promise<void> {
  const serveUrl = await getBundle(opts.rootDir, opts.log);
  const composition = await selectComposition({
    serveUrl,
    id: opts.compositionId,
    inputProps: opts.inputProps
  });
  await renderStill({
    composition,
    serveUrl,
    output: opts.outPath,
    inputProps: opts.inputProps,
    frame: opts.frame ?? 0,
    timeoutInMilliseconds: 120_000,
    chromiumOptions: { gl: 'swangle' }
  });
}
