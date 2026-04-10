import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function latestFile(dir, prefix) {
  const files = (await fs.readdir(dir)).filter(f => f.startsWith(prefix)).sort();
  if (!files.length) throw new Error(`No files found for prefix ${prefix}`);
  return path.join(dir, files[files.length - 1]);
}

const latestBriefFile = await latestFile(path.resolve('data/drafts'), 'content-brief-');
const latestVoiceJobFile = await latestFile(path.resolve('data/voice'), 'voice-job-');

const brief = JSON.parse(await fs.readFile(latestBriefFile, 'utf8'));
const voiceJob = JSON.parse(await fs.readFile(latestVoiceJobFile, 'utf8'));

if (!voiceJob.audioFile) {
  throw new Error('No generated audio file found in latest voice job. Run generate-voice first.');
}

const outDir = path.resolve('data/videos');
await fs.mkdir(outDir, { recursive: true });

const timestamp = Date.now();
const outputVideo = path.join(outDir, `video-${timestamp}.mp4`);
const renderJobFile = path.join(outDir, `render-job-${timestamp}.json`);

const title = (brief.youtube?.title || brief.title || brief.topic || 'Trend video').replace(/'/g, "’");
const subtitle = (brief.hook || brief.why_now || 'Trending now').replace(/'/g, "’");

const filter = [
  "color=c=#0b1020:s=1080x1920:d=30",
  "format=yuv420p",
  `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='${title}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=260:line_spacing=12`,
  `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='${subtitle}':fontcolor=white:fontsize=42:x=120:y=420:box=1:boxcolor=0x00000099:boxborderw=20`,
  `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='${(brief.script_30s || '').slice(0, 220).replace(/:/g, '\\:').replace(/'/g, "’")}':fontcolor=white:fontsize=34:x=90:y=1260:box=1:boxcolor=0x00000088:boxborderw=24`
].join(',');

await execFileAsync('ffmpeg', [
  '-y',
  '-i', voiceJob.audioFile,
  '-f', 'lavfi',
  '-i', filter,
  '-shortest',
  '-map', '1:v:0',
  '-map', '0:a:0',
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-crf', '23',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-pix_fmt', 'yuv420p',
  outputVideo
]);

const renderJob = {
  createdAt: new Date().toISOString(),
  status: 'rendered',
  format: 'youtube-short-9x16',
  sourceBrief: path.basename(latestBriefFile),
  sourceVoiceJob: path.basename(latestVoiceJobFile),
  outputVideo,
  outputVideoName: path.basename(outputVideo),
  title,
  subtitle,
  note: 'First real ffmpeg-based template video render.'
};

await fs.writeFile(renderJobFile, JSON.stringify(renderJob, null, 2));
console.log(`Saved rendered video to ${outputVideo}`);
console.log(`Saved render job to ${renderJobFile}`);
