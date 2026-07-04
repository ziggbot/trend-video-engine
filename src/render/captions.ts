import { WordTiming } from '../types/script';

export interface CaptionPage {
  text: string;
  startMs: number;
  endMs: number;
  words: Array<{ word: string; startMs: number; endMs: number }>;
}

/**
 * Group word timings into caption pages (max words / max duration per page).
 * Used by both the Remotion karaoke overlay and the ASS/SRT exporters.
 */
export function paginateWords(
  words: WordTiming[],
  opts: { maxWords?: number; maxDurationSec?: number } = {}
): CaptionPage[] {
  const maxWords = opts.maxWords ?? 4;
  const maxDurationMs = (opts.maxDurationSec ?? 1.6) * 1000;
  const pages: CaptionPage[] = [];
  let current: CaptionPage | null = null;

  for (const w of words) {
    const startMs = Math.round(w.startSec * 1000);
    const endMs = Math.round(w.endSec * 1000);
    const wordEntry = { word: w.word, startMs, endMs };
    const overflows =
      current && (current.words.length >= maxWords || endMs - current.startMs > maxDurationMs);
    if (!current || overflows) {
      if (current) pages.push(current);
      current = { text: w.word, startMs, endMs, words: [wordEntry] };
    } else {
      current.text += ` ${w.word}`;
      current.endMs = endMs;
      current.words.push(wordEntry);
    }
  }
  if (current) pages.push(current);

  // Extend each page to the start of the next so captions don't flicker off.
  for (let i = 0; i < pages.length - 1; i++) {
    pages[i].endMs = Math.max(pages[i].endMs, pages[i + 1].startMs);
  }
  return pages;
}

function assTime(ms: number): string {
  const cs = Math.round(ms / 10);
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

/** ASS subtitles with \kf karaoke highlighting. UTF-8, needs a font with åäö. */
export function toAss(
  pages: CaptionPage[],
  opts: { fontName?: string; fontSize?: number; playResX?: number; playResY?: number; marginV?: number } = {}
): string {
  const fontName = opts.fontName ?? 'Inter';
  const fontSize = opts.fontSize ?? 72;
  const resX = opts.playResX ?? 1920;
  const resY = opts.playResY ?? 1080;
  const marginV = opts.marginV ?? 90;

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${resX}
PlayResY: ${resY}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Karaoke,${fontName},${fontSize},&H00FFFFFF,&H0000D7FF,&H00101010,&H80000000,-1,0,0,0,100,100,0,0,1,4,1,2,60,60,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = pages
    .map((page) => {
      const parts = page.words
        .map((w, i) => {
          const durMs = Math.max(1, (i < page.words.length - 1 ? page.words[i + 1].startMs : page.endMs) - w.startMs);
          return `{\\kf${Math.round(durMs / 10)}}${escapeAss(w.word)}`;
        })
        .join(' ');
      return `Dialogue: 0,${assTime(page.startMs)},${assTime(page.endMs)},Karaoke,,0,0,0,,${parts}`;
    })
    .join('\n');

  return header + events + '\n';
}

function escapeAss(s: string): string {
  return s.replace(/[{}]/g, '').replace(/\\/g, '');
}

function srtTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(milli).padStart(3, '0')}`;
}

/** Plain SRT (for platform-native caption upload). Sentence-ish lines via pages. */
export function toSrt(pages: CaptionPage[]): string {
  return pages
    .map((p, i) => `${i + 1}\n${srtTime(p.startMs)} --> ${srtTime(p.endMs)}\n${p.text}\n`)
    .join('\n');
}
