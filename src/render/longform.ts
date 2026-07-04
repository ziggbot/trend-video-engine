import { join, resolve } from 'node:path';
import { readdir, writeFile } from 'node:fs/promises';
import { ensureDir, fileExists } from '../lib/files';
import { runFfmpeg, ffprobe } from './ffmpeg';
import { SceneAsset } from '../stages/gather-visuals';
import { Logger } from '../orchestrator/logger';

const W = 1920;
const H = 1080;
const FPS = 30;

/**
 * Two-pass 16:9 long-form assembly with plain spawned ffmpeg:
 *  1. normalize every scene into a uniform H.264 segment
 *  2. concat the segments, lay the voiceover (+ ducked music if any) underneath,
 *     and burn karaoke ASS subtitles.
 */
export async function renderLongform(opts: {
  workDir: string;
  scenes: SceneAsset[];
  voPath: string;
  voDurationSec: number;
  assPath: string;
  musicDir?: string;
  outPath: string;
  log: Logger;
}): Promise<void> {
  const segDir = join(opts.workDir, 'segments');
  await ensureDir(segDir);

  // Scale scene durations so the video exactly covers the narration (+ tail)
  const targetSec = opts.voDurationSec + 1;
  const sceneTotal = opts.scenes.reduce((a, s) => a + s.durationSec, 0) || 1;
  const factor = targetSec / sceneTotal;

  const segFiles: string[] = [];
  for (const scene of opts.scenes) {
    const dur = Math.max(2, scene.durationSec * factor);
    const seg = join(segDir, `seg-${String(scene.index).padStart(3, '0')}.mp4`);
    if (scene.type === 'image') {
      const frames = Math.round(dur * FPS);
      const panX = scene.index % 2 === 0 ? '(iw-ow)*on/${frames}' : '(iw-ow)*(1-on/${frames})';
      await runFfmpeg([
        '-loop', '1',
        '-i', scene.file,
        '-vf',
        `scale=${W * 1.2}:-2,zoompan=z='min(zoom+0.0008,1.25)':x='${panX.replace('${frames}', String(frames))}':y='(ih-oh)/2':d=${frames}:s=${W}x${H}:fps=${FPS}`,
        '-t', dur.toFixed(2),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-an',
        seg
      ]);
    } else {
      await runFfmpeg([
        '-stream_loop', '-1',
        '-i', scene.file,
        '-t', dur.toFixed(2),
        '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS}`,
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-an',
        seg
      ]);
    }
    segFiles.push(seg);
  }

  const listPath = join(segDir, 'list.txt');
  // concat demuxer resolves relative entries against the list file's dir — use absolute paths
  await writeFile(listPath, segFiles.map((f) => `file '${resolve(f).replace(/'/g, "'\\''")}'`).join('\n'));

  const music = await pickMusic(opts.musicDir);
  const assEscaped = opts.assPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
  const subFilter = `subtitles='${assEscaped}'`;

  if (music) {
    opts.log.info(`longform: mixing music ${music} (sidechain-ducked under narration)`);
    await runFfmpeg(
      [
        '-f', 'concat', '-safe', '0', '-i', listPath,
        '-i', opts.voPath,
        '-stream_loop', '-1', '-i', music,
        '-filter_complex',
        `[0:v]${subFilter}[v];` +
          `[2:a]volume=0.35[m];[m][1:a]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=400[duck];` +
          `[1:a][duck]amix=inputs=2:duration=first:dropout_transition=2[a]`,
        '-map', '[v]', '-map', '[a]',
        '-t', targetSec.toFixed(2),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '160k',
        opts.outPath
      ],
      { timeoutMs: 30 * 60_000 }
    );
  } else {
    await runFfmpeg(
      [
        '-f', 'concat', '-safe', '0', '-i', listPath,
        '-i', opts.voPath,
        '-filter_complex', `[0:v]${subFilter}[v]`,
        '-map', '[v]', '-map', '1:a',
        '-t', targetSec.toFixed(2),
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '160k',
        opts.outPath
      ],
      { timeoutMs: 30 * 60_000 }
    );
  }

  const info = await ffprobe(opts.outPath);
  if (!info.hasVideo || !info.hasAudio) throw new Error('longform render produced invalid output');
}

async function pickMusic(musicDir?: string): Promise<string | null> {
  if (!musicDir || !(await fileExists(musicDir))) return null;
  const files = (await readdir(musicDir)).filter((f) => f.endsWith('.mp3') || f.endsWith('.m4a'));
  if (!files.length) return null;
  return join(musicDir, files[Math.floor(Math.random() * files.length)]);
}

/** Extract a representative frame for the thumbnail background. */
export async function extractFrame(videoPath: string, atSec: number, outPath: string): Promise<void> {
  await runFfmpeg(['-ss', atSec.toFixed(2), '-i', videoPath, '-frames:v', '1', '-q:v', '2', outPath]);
}
