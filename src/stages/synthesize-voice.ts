import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { ChannelCtx } from '../orchestrator/context.js';
import { ensureDir, writeJson } from '../lib/files.js';
import { WordTiming } from '../types/script.js';
import { ffprobe, concatAudioWithGaps } from '../render/ffmpeg.js';
import { VoicePreset } from '../types/channel.js';

export interface VoiceResult {
  audioPath: string;
  timestampsPath: string;
  durationSec: number;
  words: WordTiming[];
  provider: string;
}

function voicePreset(ctx: ChannelCtx): VoicePreset {
  const preset = ctx.config.voices[ctx.channel.voice];
  if (!preset) throw new Error(`Unknown voice preset: ${ctx.channel.voice}`);
  return preset;
}

/** Synthesize one narration text into audio + word timings. */
export async function synthesizeVoice(ctx: ChannelCtx, workDir: string, text: string): Promise<VoiceResult> {
  const preset = voicePreset(ctx);
  const provider = ctx.services.tts(preset);
  const result = await provider.synthesize({
    text,
    voiceId: preset.voiceId,
    speed: preset.speed,
    lang: preset.lang
  });
  await ensureDir(workDir);
  const audioPath = join(workDir, `vo.${result.format}`);
  await writeFile(audioPath, result.audio);
  const info = await ffprobe(audioPath);
  if (!info.hasAudio || info.durationSec < 0.5) {
    throw new Error(`TTS produced unusable audio (duration ${info.durationSec}s)`);
  }
  if (!result.wordTimestamps.length) {
    throw new Error(`TTS provider ${provider.id} returned no word timestamps`);
  }
  const timestampsPath = join(workDir, 'timestamps.json');
  await writeJson(timestampsPath, result.wordTimestamps);
  return {
    audioPath,
    timestampsPath,
    durationSec: info.durationSec,
    words: result.wordTimestamps,
    provider: provider.id
  };
}

/**
 * Long-form: synthesize per chapter (keeps requests small), then concatenate with
 * gaps and shift each chapter's word timings by its cumulative offset.
 */
export async function synthesizeChapters(
  ctx: ChannelCtx,
  workDir: string,
  chapters: Array<{ title: string; text: string }>,
  gapSec = 0.4
): Promise<VoiceResult & { chapterOffsets: number[] }> {
  const preset = voicePreset(ctx);
  const provider = ctx.services.tts(preset);
  await ensureDir(workDir);

  const chapterFiles: string[] = [];
  const chapterWords: WordTiming[][] = [];
  const chapterDurations: number[] = [];
  for (let i = 0; i < chapters.length; i++) {
    const res = await provider.synthesize({
      text: chapters[i].text,
      voiceId: preset.voiceId,
      speed: preset.speed,
      lang: preset.lang
    });
    const file = join(workDir, `chapter-${String(i).padStart(2, '0')}.${res.format}`);
    await writeFile(file, res.audio);
    const info = await ffprobe(file);
    chapterFiles.push(file);
    chapterWords.push(res.wordTimestamps);
    chapterDurations.push(info.durationSec);
  }

  const audioPath = join(workDir, 'vo.mp3');
  await concatAudioWithGaps(chapterFiles, audioPath, gapSec);
  const info = await ffprobe(audioPath);

  const words: WordTiming[] = [];
  const chapterOffsets: number[] = [];
  let offset = 0;
  for (let i = 0; i < chapters.length; i++) {
    chapterOffsets.push(offset);
    for (const w of chapterWords[i]) {
      words.push({ word: w.word, startSec: w.startSec + offset, endSec: w.endSec + offset });
    }
    offset += chapterDurations[i] + gapSec;
  }

  const timestampsPath = join(workDir, 'timestamps.json');
  await writeJson(timestampsPath, words);
  return { audioPath, timestampsPath, durationSec: info.durationSec, words, provider: provider.id, chapterOffsets };
}
