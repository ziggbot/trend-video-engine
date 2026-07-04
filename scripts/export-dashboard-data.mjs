// Export the newest run's data to the dashboard repo, preserving the legacy
// file contract (trends-{SE,US,GLOBAL}.json, latest-*.json, review-status.json,
// production-queue.json, video-status.json, publish-log.json) plus a new
// runs.json with recent run summaries.
import fs from 'fs/promises';
import path from 'path';

const engineRoot = process.cwd();
const dashboardDir = process.env.DASHBOARD_DIR || path.resolve(engineRoot, '../trend-video-engine-dashboard-pages');

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(p) {
  return JSON.parse(await fs.readFile(p, 'utf8'));
}

async function writeJson(p, value) {
  await fs.writeFile(p, JSON.stringify(value, null, 2) + '\n');
}

async function listManifests() {
  const runsDir = path.join(engineRoot, 'runs');
  if (!(await exists(runsDir))) return [];
  const ids = (await fs.readdir(runsDir)).sort().reverse();
  const manifests = [];
  for (const id of ids) {
    const p = path.join(runsDir, id, 'manifest.json');
    if (await exists(p)) {
      try {
        manifests.push(await readJson(p));
      } catch {
        // skip unreadable
      }
    }
  }
  return manifests;
}

const manifests = await listManifests();
if (!manifests.length) {
  console.error('No run manifests found — nothing to export');
  process.exit(1);
}
const latest = manifests[0];
await fs.mkdir(dashboardDir, { recursive: true });

// trends-<REGION>.json — same shape the old fetch stage wrote
for (const region of ['SE', 'US', 'GLOBAL']) {
  const entry = manifests.map((m) => m.trends?.[region]).find((e) => e?.status === 'done' && e.file);
  if (!entry) continue;
  const abs = path.isAbsolute(entry.file) ? entry.file : path.join(engineRoot, entry.file);
  if (await exists(abs)) {
    await fs.copyFile(abs, path.join(dashboardDir, `trends-${region}.json`));
  }
}

// latest-ranked-topics.json / latest-content-brief.json / latest-voice-job.json
const channels = Object.entries(latest.channels ?? {});
const firstDone = channels.find(([, c]) => c.status === 'done') ?? channels[0];
if (firstDone) {
  const [channelId, channelRun] = firstDone;
  const rankedOut = channelRun.stages?.score?.outputs?.[0];
  if (rankedOut && (await exists(path.join(engineRoot, rankedOut)))) {
    const ranked = await readJson(path.join(engineRoot, rankedOut));
    await writeJson(path.join(dashboardDir, 'latest-ranked-topics.json'), {
      generatedAt: latest.startedAt,
      channel: channelId,
      ranked
    });
  }
  if (channelRun.topic) {
    await writeJson(path.join(dashboardDir, 'latest-content-brief.json'), {
      generatedAt: latest.startedAt,
      channel: channelId,
      topic: channelRun.topic.title,
      whyNow: channelRun.topic.whyNow,
      score: channelRun.topic.score,
      sources: channelRun.topic.sources
    });
  }
  const voiceStage = Object.entries(channelRun.stages ?? {}).find(([k]) => k.endsWith(':voice'))?.[1];
  await writeJson(path.join(dashboardDir, 'latest-voice-job.json'), {
    generatedAt: latest.startedAt,
    channel: channelId,
    status: voiceStage?.status ?? 'none',
    durationSec: voiceStage?.meta?.durationSec ?? null,
    provider: voiceStage?.meta?.provider ?? null
  });
}

const packages = Object.values(latest.packages ?? {});

await writeJson(path.join(dashboardDir, 'review-status.json'), {
  generatedAt: new Date().toISOString(),
  items: packages
    .filter((p) => p.status === 'pending_approval')
    .map((p) => ({ pkgId: p.pkgId, runId: latest.runId, channel: p.channelId, kind: p.kind }))
});

await writeJson(path.join(dashboardDir, 'production-queue.json'), {
  generatedAt: new Date().toISOString(),
  queue: Object.entries(latest.channels ?? {}).flatMap(([channelId, c]) =>
    (c.plan ?? []).map((item) => ({ channel: channelId, kind: item.kind, pkgId: item.pkgId ?? null }))
  )
});

await writeJson(path.join(dashboardDir, 'video-status.json'), {
  generatedAt: new Date().toISOString(),
  items: packages.map((p) => ({
    pkgId: p.pkgId,
    channel: p.channelId,
    kind: p.kind,
    status: p.status,
    platforms: p.platforms
  }))
});

await writeJson(path.join(dashboardDir, 'publish-log.json'), {
  generatedAt: new Date().toISOString(),
  items: packages
    .filter((p) => p.status === 'published')
    .map((p) => ({ pkgId: p.pkgId, channel: p.channelId, publisher: p.publish?.publisher, results: p.publish?.results }))
});

// New: recent run summaries for future dashboard evolution
await writeJson(path.join(dashboardDir, 'runs.json'), {
  generatedAt: new Date().toISOString(),
  runs: manifests.slice(0, 30).map((m) => ({
    runId: m.runId,
    startedAt: m.startedAt,
    status: m.status,
    packages: Object.keys(m.packages ?? {}).length,
    channels: Object.fromEntries(Object.entries(m.channels ?? {}).map(([id, c]) => [id, c.status]))
  }))
});

console.log(`Exported dashboard data for run ${latest.runId} to ${dashboardDir}`);
