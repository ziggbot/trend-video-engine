import { join } from 'node:path';
import { readdir } from 'node:fs/promises';
import {
  Manifest,
  ManifestSchema,
  PackageEntry,
  PackageStatus,
  PACKAGE_TRANSITIONS
} from '../types/manifest';
import { writeJson, readJson, fileExists } from '../lib/files';

export const RUNS_DIR = 'runs';

export function manifestPath(runId: string, rootDir = '.'): string {
  return join(rootDir, RUNS_DIR, runId, 'manifest.json');
}

export function createManifest(runId: string, mock: boolean): Manifest {
  return ManifestSchema.parse({
    schemaVersion: 1,
    runId,
    startedAt: new Date().toISOString(),
    status: 'running',
    mock,
    trends: {},
    channels: {},
    packages: {}
  });
}

export async function loadManifest(runId: string, rootDir = '.'): Promise<Manifest> {
  const raw = await readJson(manifestPath(runId, rootDir));
  return ManifestSchema.parse(raw);
}

export async function saveManifest(manifest: Manifest, rootDir = '.'): Promise<void> {
  await writeJson(manifestPath(manifest.runId, rootDir), manifest);
}

/** Validate and apply a package status transition. Throws on an illegal move. */
export function transitionPackage(pkg: PackageEntry, to: PackageStatus): void {
  const allowed = PACKAGE_TRANSITIONS[pkg.status] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Illegal package transition for ${pkg.pkgId}: ${pkg.status} -> ${to}`);
  }
  pkg.status = to;
}

/** List past run manifests, newest first (by runId, which sorts chronologically). */
export async function listRunIds(rootDir = '.'): Promise<string[]> {
  const dir = join(rootDir, RUNS_DIR);
  if (!(await fileExists(dir))) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const ids: string[] = [];
  for (const e of entries) {
    if (e.isDirectory() && (await fileExists(join(dir, e.name, 'manifest.json')))) ids.push(e.name);
  }
  return ids.sort().reverse();
}

/** Load the N most recent manifests (excluding the given run), tolerating unparsable ones. */
export async function loadRecentManifests(opts: {
  rootDir?: string;
  excludeRunId?: string;
  limit?: number;
}): Promise<Manifest[]> {
  const { rootDir = '.', excludeRunId, limit = 10 } = opts;
  const ids = (await listRunIds(rootDir)).filter((id) => id !== excludeRunId).slice(0, limit);
  const out: Manifest[] = [];
  for (const id of ids) {
    try {
      out.push(await loadManifest(id, rootDir));
    } catch {
      // ignore corrupt/legacy manifests
    }
  }
  return out;
}
