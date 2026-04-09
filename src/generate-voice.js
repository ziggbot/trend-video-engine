import fs from 'fs/promises';
import path from 'path';

const dir = path.resolve('data/drafts');
const files = (await fs.readdir(dir)).filter(f => f.startsWith('content-brief-')).sort();
if (!files.length) throw new Error('No content brief found. Run generate-brief first.');

const file = path.join(dir, files[files.length - 1]);
const brief = JSON.parse(await fs.readFile(file, 'utf8'));

const provider = process.env.TTS_PROVIDER || 'not-configured';
const voiceId = process.env.TTS_VOICE_ID || 'default';
const apiKeyPresent = Boolean(process.env.ELEVENLABS_API_KEY || process.env.OPENAI_API_KEY || process.env.TTS_API_KEY);

const voiceJob = {
  createdAt: new Date().toISOString(),
  status: apiKeyPresent ? 'provider-ready' : 'queued',
  provider,
  voiceId,
  script: brief.script_30s,
  scriptLength: brief.script_30s.length,
  note: apiKeyPresent
    ? 'TTS credentials detected. Ready to connect real provider call.'
    : 'No TTS credentials detected yet. This is a provider-ready scaffold.',
  nextAction: apiKeyPresent
    ? 'Implement provider-specific request and save returned audio file.'
    : 'Set TTS_PROVIDER and provider API key in environment.'
};

const outFile = path.resolve('data/voice', `voice-job-${Date.now()}.json`);
await fs.mkdir(path.dirname(outFile), { recursive: true });
await fs.writeFile(outFile, JSON.stringify(voiceJob, null, 2));
console.log(`Saved voice job to ${outFile}`);
