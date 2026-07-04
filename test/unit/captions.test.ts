import { describe, it, expect } from 'vitest';
import { paginateWords, toAss, toSrt } from '../../src/render/captions';
import { WordTiming } from '../../src/types/script';

function words(list: Array<[string, number, number]>): WordTiming[] {
  return list.map(([word, startSec, endSec]) => ({ word, startSec, endSec }));
}

describe('paginateWords', () => {
  it('groups words into pages of maxWords', () => {
    const w = words([
      ['ett', 0, 0.3],
      ['två', 0.3, 0.6],
      ['tre', 0.6, 0.9],
      ['fyra', 0.9, 1.2],
      ['fem', 1.2, 1.5]
    ]);
    const pages = paginateWords(w, { maxWords: 2, maxDurationSec: 10 });
    expect(pages).toHaveLength(3);
    expect(pages[0].text).toBe('ett två');
    expect(pages[2].text).toBe('fem');
  });

  it('splits on max duration', () => {
    const w = words([
      ['slow', 0, 2],
      ['words', 2, 4],
      ['here', 4, 6]
    ]);
    const pages = paginateWords(w, { maxWords: 10, maxDurationSec: 2.5 });
    expect(pages.length).toBeGreaterThan(1);
  });

  it('extends pages to the next page start (no flicker gaps)', () => {
    const w = words([
      ['a', 0, 0.2],
      ['b', 1.0, 1.2]
    ]);
    const pages = paginateWords(w, { maxWords: 1 });
    expect(pages[0].endMs).toBe(pages[1].startMs);
  });
});

describe('toAss', () => {
  it('produces karaoke \\kf tags whose durations span the words', () => {
    const pages = paginateWords(
      words([
        ['hej', 0, 0.5],
        ['världen', 0.5, 1.0]
      ]),
      { maxWords: 4 }
    );
    const ass = toAss(pages);
    expect(ass).toContain('[Script Info]');
    expect(ass).toContain('\\kf50'); // 0.5s = 50 centiseconds
    expect(ass).toContain('världen'); // UTF-8 preserved
    expect(ass).toContain('Dialogue: 0,0:00:00.00');
  });
});

describe('toSrt', () => {
  it('renders valid SRT with comma milliseconds', () => {
    const pages = paginateWords(words([['hello', 0, 1.5]]));
    const srt = toSrt(pages);
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:01,500\nhello');
  });
});
