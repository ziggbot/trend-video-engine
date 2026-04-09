import fs from 'fs/promises';
import path from 'path';

const FEED_URL = 'https://trends.google.com/trending/rss?geo=SE';

function decodeXml(str = '') {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .trim();
}

function getTag(block, tag) {
  const safe = tag.replace(':', '\\:');
  const match = block.match(new RegExp(`<${safe}>([\\s\\S]*?)<\\/${safe}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function getNewsItems(block) {
  const matches = [...block.matchAll(/<ht:news_item>([\s\S]*?)<\/ht:news_item>/g)];
  return matches.map((m) => ({
    title: getTag(m[1], 'ht:news_item_title'),
    url: getTag(m[1], 'ht:news_item_url'),
    source: getTag(m[1], 'ht:news_item_source')
  }));
}

const response = await fetch(FEED_URL, {
  headers: {
    'User-Agent': 'OpenClaw-Zigg/1.0'
  }
});

if (!response.ok) {
  throw new Error(`Failed to fetch Google Trends RSS: ${response.status} ${response.statusText}`);
}

const xml = await response.text();
const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
  const block = m[1];
  const trafficText = getTag(block, 'ht:approx_traffic');
  const traffic = Number((trafficText.match(/\d+/) || ['0'])[0]);
  return {
    topic: getTag(block, 'title'),
    source: 'google-trends-rss',
    region: 'SE',
    trendScoreRaw: traffic,
    approxTraffic: trafficText,
    timestamp: new Date().toISOString(),
    publishedAt: getTag(block, 'pubDate'),
    picture: getTag(block, 'ht:picture'),
    pictureSource: getTag(block, 'ht:picture_source'),
    news: getNewsItems(block),
    whyNow: getNewsItems(block)[0]?.title || 'Trending on Google Sweden right now.'
  };
});

const trends = items.slice(0, 10);
const outDir = path.resolve('data/trends');
await fs.mkdir(outDir, { recursive: true });
const file = path.join(outDir, `trends-${Date.now()}.json`);
await fs.writeFile(file, JSON.stringify({ source: FEED_URL, fetchedAt: new Date().toISOString(), trends }, null, 2));
console.log(`Saved ${trends.length} Google Trends topics to ${file}`);
