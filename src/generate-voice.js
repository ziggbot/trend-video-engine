import fs from 'fs/promises';
import path from 'path';

const dir = path.resolve('data/drafts');
const files = (await fs.readdir(dir)).filter(f => f.startsWith('content-brief-')).sort();
if (!files.length) throw new Error('No content brief found. Run generate-brief first.');

const file = path.join(dir, files[files.length - 1]);
const brief = JSON.parse(await fs.readFile(file, 'utf8'));

const provider = process.env.TTS_PROVIDER || 'openai';
const voiceId = process.env.TTS_VOICE_ID || 'alloy';
const outDir = path.resolve('data/voice');
await fs.mkdir(outDir, { recursive: true });

const voiceJob = {
  createdAt: new Date().toISOString(),
  status: 'queued',
  provider,
  voiceId,
  script: brief.script_30s,
  scriptLength: brief.script_30s.length,
  note: '',
  nextAction: ''
};

if (!process.env.OPENAI_API_KEY) {
  voiceJob.status = 'queued';
  voiceJob.note = 'No OPENAI_API_KEY detected. Cannot generate real audio.';
  voiceJob.nextAction = 'Set OPENAI_API_KEY in environment.';
} else {
  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
        voice: voiceId,
        input: brief.script_30s,
        format: 'mp3'
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI TTS error ${response.status}: ${text}`);
    }

    const timestamp = Date.now();
    const audioFile = path.join(outDir, `voice-${timestamp}.mp3`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(audioFile, buffer);

    voiceJob.status = 'generated';
    voiceJob.audioFile = audioFile;
    voiceJob.audioFileName = path.basename(audioFile);
    voiceJob.audioBytes = buffer.length;
    voiceJob.note = 'Real audio generated with OpenAI TTS.';
    voiceJob.nextAction = 'Use this audio file in ffmpeg video rendering.';
  } catch (error) {
    voiceJob.status = 'failed';
    voiceJob.error = String(error.message || error);
    voiceJob.note = 'Voice generation failed.';
    voiceJob.nextAction = 'Inspect error and retry generation.';
  }
}

const outFile = path.resolve(outDir, `voice-job-${Date.now()}.json`);
await fs.writeFile(outFile, JSON.stringify(voiceJob, null, 2));
console.log(`Saved voice job to ${outFile} with status ${voiceJob.status}`);
