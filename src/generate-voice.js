import fs from 'fs/promises';
import path from 'path';

const dir = path.resolve('data/drafts');
const files = (await fs.readdir(dir)).filter(f => f.startsWith('content-brief-')).sort();
if (!files.length) throw new Error('No content brief found. Run generate-brief first.');

const file = path.join(dir, files[files.length - 1]);
const brief = JSON.parse(await fs.readFile(file, 'utf8'));

const voiceJob = {
  createdAt: new Date().toISOString(),
  status: 'queued',
  provider: process.env.TTS_PROVIDER || 'not-configured',
  voice: brief.voice_style,
  script: brief.script_30s,
  note: 'This is a scaffold. Connect a real TTS provider next.'
};

const outFile = path.resolve('data/voice', `voice-job-${Date.now()}.json`);
await fs.mkdir(path.dirname(outFile), { recursive: true });
await fs.writeFile(outFile, JSON.stringify(voiceJob, null, 2));
console.log(`Saved voice job to ${outFile}`);
