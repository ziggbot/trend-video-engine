import fs from 'fs/promises';
import path from 'path';

const dir = path.resolve('data/drafts');
const files = (await fs.readdir(dir)).filter(f => f.startsWith('ranked-topics-')).sort();
if (!files.length) throw new Error('No ranked topics found. Run score-topics first.');

const latest = JSON.parse(await fs.readFile(path.join(dir, files[files.length - 1]), 'utf8'));
const top = latest.ranked[0];

const brief = {
  topic: top.topic,
  why_now: top.whyNow,
  audience_angle: 'Förklara snabbt varför folk pratar om detta och varför det spelar roll.',
  hook: `Alla pratar om ${top.topic.toLowerCase()} just nu, men här är varför det faktiskt betyder något.`,
  title: `${top.topic}, förklarat på 30 sekunder`,
  script_30s: '',
  voice_style: 'clear, energetic, credible',
  visual_direction: [
    'big hook text first 2 seconds',
    '3 fast explainer cards',
    'clean subtitle pacing',
    'end with a curiosity CTA'
  ],
  youtube: {
    title: `${top.topic} på 30 sekunder`,
    description: `Kort förklaring av varför ${top.topic.toLowerCase()} trendar just nu.`,
    tags: ['trending', 'nyheter', 'förklaring', 'shorts']
  },
  review: {
    status: 'draft',
    notes: ''
  }
};

const outFile = path.resolve('data/drafts', `content-brief-${Date.now()}.json`);
await fs.writeFile(outFile, JSON.stringify(brief, null, 2));
console.log(`Saved brief to ${outFile}`);
