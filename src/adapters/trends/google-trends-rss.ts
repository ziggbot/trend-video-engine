import { TrendItem, TrendSnapshot } from '../../types/trend.js';
import { TrendsSource } from './types.js';
import { fetchText } from '../../lib/http.js';
import { withRetry } from '../../lib/retry.js';

const REGION_MAP: Record<string, { geo: string; label: string }> = {
  SE: { geo: 'SE', label: 'Sweden' },
  US: { geo: 'US', label: 'USA' },
  GLOBAL: { geo: 'US', label: 'Global proxy via US feed' }
};

export function feedUrl(region: string): string {
  const sel = REGION_MAP[region] ?? REGION_MAP.SE;
  return `https://trends.google.com/trending/rss?geo=${sel.geo}`;
}

function decodeXml(str = ''): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function getTag(block: string, tag: string): string {
  const safe = tag.replace(':', '\\:');
  const match = block.match(new RegExp(`<${safe}>([\\s\\S]*?)<\\/${safe}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function getNewsItems(block: string) {
  const matches = [...block.matchAll(/<ht:news_item>([\s\S]*?)<\/ht:news_item>/g)];
  return matches.map((m) => ({
    title: getTag(m[1], 'ht:news_item_title'),
    url: getTag(m[1], 'ht:news_item_url'),
    source: getTag(m[1], 'ht:news_item_source')
  }));
}

/** Parse a Google Trends "Trending Now" RSS feed into trend items. Pure — unit-testable. */
export function parseTrendsRss(xml: string, region: string, now = new Date()): TrendItem[] {
  const sel = REGION_MAP[region] ?? REGION_MAP.SE;
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const block = m[1];
    const trafficText = getTag(block, 'ht:approx_traffic');
    const traffic = Number((trafficText.match(/\d+/) || ['0'])[0]);
    const news = getNewsItems(block);
    return {
      topic: getTag(block, 'title'),
      source: 'google-trends-rss',
      region,
      regionLabel: sel.label,
      trendScoreRaw: traffic,
      approxTraffic: trafficText,
      publishedAt: getTag(block, 'pubDate') || now.toISOString(),
      picture: getTag(block, 'ht:picture') || undefined,
      pictureSource: getTag(block, 'ht:picture_source') || undefined,
      news,
      whyNow: news[0]?.title || `Trending on Google ${sel.label} right now.`
    };
  });
}

export class GoogleTrendsRss implements TrendsSource {
  id = 'google-trends-rss';

  async fetch(region: 'SE' | 'US' | 'GLOBAL'): Promise<TrendSnapshot> {
    const url = feedUrl(region);
    const xml = await withRetry(
      () => fetchText(url, { headers: { 'User-Agent': 'trend-video-engine/1.0' } }, 15_000),
      { attempts: 3, baseDelayMs: 2000 }
    );
    const sel = REGION_MAP[region] ?? REGION_MAP.SE;
    const trends = parseTrendsRss(xml, region).slice(0, 10);
    if (!trends.length) throw new Error(`Google Trends RSS for ${region} returned no items`);
    return {
      source: url,
      region,
      regionLabel: sel.label,
      fetchedAt: new Date().toISOString(),
      stale: false,
      trends
    };
  }
}
