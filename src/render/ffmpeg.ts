import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

export async function runFfmpeg(args: string[], opts: { timeoutMs?: number } = {}): Promise<void> {
  try {
    await execFileAsync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      timeout: opts.timeoutMs ?? 20 * 60_000,
      maxBuffer: 32 * 1024 * 1024
    });
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    throw new Error(`ffmpeg failed: ${(e.stderr || e.message || '').slice(-2000)}`);
  }
}

export interface MediaInfo {
  durationSec: number;
  width?: number;
  height?: number;
  hasAudio: boolean;
  hasVideo: boolean;
}

export async function ffprobe(path: string): Promise<MediaInfo> {
  const { stdout } = await execFileAsync(
    FFPROBE,
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path],
    { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 }
  );
  const info = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{ codec_type?: string; width?: number; height?: number; duration?: string }>;
  };
  const video = info.streams?.find((s) => s.codec_type === 'video');
  const audio = info.streams?.find((s) => s.codec_type === 'audio');
  const durationSec = Number(info.format?.duration ?? video?.duration ?? audio?.duration ?? 0);
  return {
    durationSec,
    width: video?.width,
    height: video?.height,
    hasAudio: Boolean(audio),
    hasVideo: Boolean(video)
  };
}

/** Render a solid-gradient fallback clip for scenes with no usable stock footage. */
export async function renderGradientClip(opts: {
  outPath: string;
  width: number;
  height: number;
  durationSec: number;
  seed: number;
}): Promise<void> {
  const palettes = [
    ['0x1a1a2e', '0x16213e'],
    ['0x0f3460', '0x533483'],
    ['0x2c003e', '0x512b58'],
    ['0x1b262c', '0x0f4c75']
  ];
  const [c1, c2] = palettes[opts.seed % palettes.length];
  await runFfmpeg([
    '-f', 'lavfi',
    '-i', `gradients=s=${opts.width}x${opts.height}:c0=${c1}:c1=${c2}:d=${opts.durationSec.toFixed(2)}:speed=0.02`,
    '-r', '30',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-t', opts.durationSec.toFixed(2),
    opts.outPath
  ]);
}

/** Concatenate audio files with a silence gap between each, re-encoded to one file. */
export async function concatAudioWithGaps(files: string[], outPath: string, gapSec = 0.4): Promise<void> {
  if (files.length === 1) {
    await runFfmpeg(['-i', files[0], outPath]);
    return;
  }
  const inputs = files.flatMap((f) => ['-i', f]);
  const gapDefs = files
    .slice(0, -1)
    .map((_, i) => `aevalsrc=0:d=${gapSec}:s=24000[g${i}]`)
    .join(';');
  const seq = files.map((_, i) => `[${i}:a]` + (i < files.length - 1 ? `[g${i}]` : '')).join('');
  const n = files.length * 2 - 1;
  const filter = `${gapDefs};${seq}concat=n=${n}:v=0:a=1[out]`;
  await runFfmpeg([...inputs, '-filter_complex', filter, '-map', '[out]', outPath]);
}
