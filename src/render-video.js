import fs from 'fs/promises';
import path from 'path';

const dir = path.resolve('data/drafts');
const files = (await fs.readdir(dir)).filter(f => f.startsWith('content-brief-')).sort();
if (!files.length) throw new Error('No content brief found. Run generate-brief first.');

const latestBriefFile = path.join(dir, files[files.length - 1]);
const brief = JSON.parse(await fs.readFile(latestBriefFile, 'utf8'));

const renderJob = {
  createdAt: new Date().toISOString(),
  status: 'scaffolded',
  format: 'youtube-short-9x16',
  durationTargetSeconds: 30,
  sourceBrief: path.basename(latestBriefFile),
  scenes: [
    {
      type: 'hook-card',
      text: brief.caption_chunks?.[0] || brief.hook,
      durationSeconds: 4
    },
    {
      type: 'explainer-card',
      text: brief.caption_chunks?.[1] || brief.topic,
      durationSeconds: 7
    },
    {
      type: 'context-card',
      text: brief.caption_chunks?.[2] || brief.why_now,
      durationSeconds: 9
    },
    {
      type: 'cta-card',
      text: brief.caption_chunks?.[4] || 'Följ för nästa trend',
      durationSeconds: 4
    }
  ],
  assetsNeeded: {
    voiceover: true,
    captions: true,
    backgroundVisual: true
  },
  note: 'Next step is implementing actual rendering with ffmpeg, Remotion, or HTML capture.'
};

const outFile = path.resolve('data/videos', `render-job-${Date.now()}.json`);
await fs.mkdir(path.dirname(outFile), { recursive: true });
await fs.writeFile(outFile, JSON.stringify(renderJob, null, 2));
console.log(`Saved render job to ${outFile}`);
