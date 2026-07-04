import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseTrendsRss, feedUrl } from '../../src/adapters/trends/google-trends-rss.js';

const xml = readFileSync('test/fixtures/trends-rss.xml', 'utf8');

describe('parseTrendsRss', () => {
  it('parses items with traffic, news and picture', () => {
    const items = parseTrendsRss(xml, 'SE');
    expect(items).toHaveLength(4);
    const first = items[0];
    expect(first.topic).toBe('Mock Solar Eclipse');
    expect(first.trendScoreRaw).toBe(500);
    expect(first.approxTraffic).toBe('500K+');
    expect(first.news).toHaveLength(2);
    expect(first.whyNow).toContain('solar eclipse');
    expect(first.picture).toBe('https://example.com/eclipse.jpg');
    expect(first.region).toBe('SE');
  });

  it('decodes XML entities', () => {
    const items = parseTrendsRss(xml, 'SE');
    expect(items[0].news[0].title).toBe('Rare solar eclipse stuns "millions" of viewers');
    expect(items[0].news[1].title).toContain('&');
  });

  it('handles items without news', () => {
    const items = parseTrendsRss(xml, 'SE');
    const noNews = items.find((i) => i.topic.startsWith('Mock Sports'));
    expect(noNews?.news).toHaveLength(0);
    expect(noNews?.whyNow).toContain('Trending on Google');
    expect(noNews?.topic).toContain('åäö');
  });

  it('handles an empty feed', () => {
    expect(parseTrendsRss('<rss><channel></channel></rss>', 'US')).toHaveLength(0);
  });

  it('maps GLOBAL to the US feed', () => {
    expect(feedUrl('GLOBAL')).toContain('geo=US');
    expect(feedUrl('SE')).toContain('geo=SE');
  });
});
