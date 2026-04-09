import fs from 'fs/promises';
import path from 'path';

const trends = [
  {
    topic: 'Ny AI-funktion i sociala medier',
    source: 'mock-google-trends',
    region: 'SE',
    trendScoreRaw: 94,
    timestamp: new Date().toISOString(),
    whyNow: 'Många pratar om hur AI ändrar vardagsappar just nu.'
  },
  {
    topic: 'Svenska bolag satsar på kärnkraft igen',
    source: 'mock-google-trends',
    region: 'SE',
    trendScoreRaw: 88,
    timestamp: new Date().toISOString(),
    whyNow: 'Energifrågan driver stark opinion och delningar.'
  },
  {
    topic: 'Ny viral hälsotrend på TikTok',
    source: 'mock-google-trends',
    region: 'SE',
    trendScoreRaw: 86,
    timestamp: new Date().toISOString(),
    whyNow: 'Kortformat + hälsa brukar dra publik snabbt.'
  }
];

const outDir = path.resolve('data/trends');
await fs.mkdir(outDir, { recursive: true });
const file = path.join(outDir, `trends-${Date.now()}.json`);
await fs.writeFile(file, JSON.stringify({ trends }, null, 2));
console.log(`Saved trends to ${file}`);
