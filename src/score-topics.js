import fs from 'fs/promises';
import path from 'path';

const dir = path.resolve('data/trends');
const files = (await fs.readdir(dir)).filter(f => f.endsWith('.json')).sort();
if (!files.length) throw new Error('No trend files found. Run fetch-trends first.');

const latest = JSON.parse(await fs.readFile(path.join(dir, files[files.length - 1]), 'utf8'));

function scoreTrend(item) {
  const novelty = Math.min(10, Math.round(item.trendScoreRaw / 10));
  const emotion = /viral|ai|kärnkraft|hälsa/i.test(item.topic) ? 8 : 6;
  const clarity = item.topic.length < 40 ? 9 : 7;
  const explainability = 8;
  const ctrPotential = Math.round((novelty + emotion + clarity + explainability) / 4);
  const total = novelty * 0.25 + emotion * 0.2 + clarity * 0.2 + explainability * 0.15 + ctrPotential * 0.2;
  return {
    ...item,
    scoring: { novelty, emotion, clarity, explainability, ctrPotential },
    totalScore: Number((total * 10).toFixed(1))
  };
}

const ranked = latest.trends.map(scoreTrend).sort((a, b) => b.totalScore - a.totalScore);
const out = { generatedAt: new Date().toISOString(), ranked };
const outFile = path.resolve('data/drafts', `ranked-topics-${Date.now()}.json`);
await fs.mkdir(path.dirname(outFile), { recursive: true });
await fs.writeFile(outFile, JSON.stringify(out, null, 2));
console.log(`Saved ranked topics to ${outFile}`);
