import { StageState } from '../types/manifest.js';
import { fileExists } from '../lib/files.js';
import { saveManifest } from './manifest.js';
import { serializeError, Logger } from './logger.js';
import { RunCtx } from './context.js';

export interface StageResult {
  outputs: string[];
  meta?: Record<string, unknown>;
}

/**
 * Run a stage with idempotency and manifest bookkeeping.
 * If the stage is already `done` and all its recorded outputs still exist, it is skipped
 * and the previous result returned — this is what makes `--resume` cheap.
 */
export async function runStage(
  ctx: RunCtx,
  stages: Record<string, StageState>,
  key: string,
  log: Logger,
  fn: () => Promise<StageResult>
): Promise<StageResult> {
  const prior = stages[key];
  if (prior?.status === 'done') {
    const allExist = (await Promise.all(prior.outputs.map(fileExists))).every(Boolean);
    if (allExist) {
      log.info(`stage ${key}: skipped (already done)`);
      return { outputs: prior.outputs, meta: prior.meta as Record<string, unknown> | undefined };
    }
  }

  stages[key] = { status: 'running', outputs: [], startedAt: new Date().toISOString() };
  await saveManifest(ctx.manifest, ctx.rootDir);
  log.info(`stage ${key}: started`);
  try {
    const result = await fn();
    stages[key] = {
      status: 'done',
      outputs: result.outputs,
      meta: result.meta,
      startedAt: stages[key].startedAt,
      finishedAt: new Date().toISOString()
    };
    await saveManifest(ctx.manifest, ctx.rootDir);
    log.info(`stage ${key}: done`, { outputs: result.outputs });
    return result;
  } catch (err) {
    stages[key] = {
      status: 'failed',
      outputs: [],
      startedAt: stages[key].startedAt,
      finishedAt: new Date().toISOString(),
      error: serializeError(err)
    };
    await saveManifest(ctx.manifest, ctx.rootDir);
    log.error(`stage ${key}: failed — ${serializeError(err)}`);
    throw err;
  }
}
