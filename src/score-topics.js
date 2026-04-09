import fs from 'fs/promises';
import path from 'path';

const dir = path.resolve('data/trends');
const files = (await fs.readdir(dir)).filter(f => f.endsWith('.json')).sort();
if (!files.length) throw new Error('No trend files found. Run fetch-trends first.');

const latest = JSON.parse(await fs.readFile(path.join(dir, files[files.length - 1]), 'utf8'));

function scoreTrend(item) {
  const traffic = item.trendScoreRaw || 0;
  const novelty = Math.min(10, Math.max(3, Math.round(Math.log10(traffic + 1) * 3)));
  const emotion = /död|avslöjar|kris|viral|skandal|ai|krig|attack|kaos|musk/i.test(`${item.topic} ${item.whyNow}`) ? 9 : 6;
  const clarity = item.topic.length < 32 ? 9 : item.topic.length < 55 ? 7 : 5;
  const explainability = item.news?.length ? 8 : 6;
  const swedishRelevance = item.region === 'SE' ? 9 : 6;
  const sourceStrength = Math.min(10, 5 + (item.news?.length || 0));
  const ctrPotential = Math.round((novelty + emotion + clarity + explainability + swedishRelevance) / 5);

  const total = (
    novelty * 0.18 +
    emotion * 0.2 +
    clarity * 0.18 +
    explainability * 0.16 +
    swedishRelevance * 0.12 +
    sourceStrength * 0.06 +
    ctrPotential * 0.1
  );

  return {
    ...item,
    scoring: {
      novelty,
      emotion,
      clarity,
      explainability,
      swedishRelevance,
      sourceStrength,
      ctrPotential
    },
    sourceReferences: (item.news || []).slice(0, 3).map((n) => ({
      title: n.title,
      url: n.url,
      source: n.source
    })),
    totalScore: Number((total * 10).toFixed(1))
  };
}

const ranked = latest.trends.map(scoreTrend).sort((a, b) => b.totalScore - a.totalScore);
const out = {
  generatedAt: new Date().toISOString(),
  sourceFeed: latest.source,
  ranked
};
const outFile = path.resolve('data/drafts', `ranked-topics-${Date.now()}.json`);
await fs.mkdir(path.dirname(outFile), { recursive: true });
await fs.writeFile(outFile, JSON.stringify(out, null, 2));
console.log(`Saved ranked topics to ${outFile}`);
