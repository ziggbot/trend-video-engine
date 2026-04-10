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

async function latestFile(dir, prefix) {
  const files = (await fs.readdir(dir)).filter(f => f.startsWith(prefix)).sort();
  if (!files.length) throw new Error(`No files found for prefix ${prefix} in ${dir}`);
  return path.join(dir, files[files.length - 1]);
}

async function latestRegionTrend(region) {
  const dir = path.resolve(engineRoot, 'data/trends');
  const files = (await fs.readdir(dir)).filter(f => f.startsWith(`trends-${region}-`) && f.endsWith('.json')).sort();
  if (!files.length) throw new Error(`No trend files found for region ${region}`);
  return path.join(dir, files[files.length - 1]);
}

await fs.mkdir(dashboardDir, { recursive: true });

for (const region of ['SE', 'US', 'GLOBAL']) {
  const src = await latestRegionTrend(region);
  const dest = path.join(dashboardDir, `trends-${region}.json`);
  await fs.copyFile(src, dest);
}

const latestBrief = await latestFile(path.resolve(engineRoot, 'data/drafts'), 'content-brief-');
const latestRanked = await latestFile(path.resolve(engineRoot, 'data/drafts'), 'ranked-topics-');
const latestVoice = await latestFile(path.resolve(engineRoot, 'data/voice'), 'voice-job-');

await fs.copyFile(latestBrief, path.join(dashboardDir, 'latest-content-brief.json'));
await fs.copyFile(latestRanked, path.join(dashboardDir, 'latest-ranked-topics.json'));
await fs.copyFile(latestVoice, path.join(dashboardDir, 'latest-voice-job.json'));

const defaults = {
  'review-status.json': JSON.stringify({ items: [] }, null, 2) + '\n',
  'production-queue.json': JSON.stringify({ queue: [] }, null, 2) + '\n',
  'video-status.json': JSON.stringify({ region: 'SE', items: [] }, null, 2) + '\n',
  'publish-log.json': JSON.stringify({ region: 'SE', items: [] }, null, 2) + '\n'
};

for (const [name, content] of Object.entries(defaults)) {
  const target = path.join(dashboardDir, name);
  if (!(await exists(target))) {
    await fs.writeFile(target, content);
  }
}

console.log(`Exported latest dashboard data to ${dashboardDir}`);
