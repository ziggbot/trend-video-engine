import fs from 'fs/promises';
import path from 'path';

const dir = path.resolve('data/drafts');
const files = (await fs.readdir(dir)).filter(f => f.startsWith('content-brief-')).sort();
if (!files.length) throw new Error('No content brief found. Run generate-brief first.');

const file = path.join(dir, files[files.length - 1]);
const brief = JSON.parse(await fs.readFile(file, 'utf8'));

brief.script_30s = [
  brief.hook,
  `${brief.topic} trendar eftersom det kombinerar nyhet, känsla och tydliga konsekvenser som folk direkt förstår.`,
  'Det gör ämnet perfekt för kortvideo, eftersom man kan ge publikens hjärna en snabb aha-känsla på under 30 sekunder.',
  'Vill du att jag gör fler såna här snabba förklaringar, följ för nästa trend.'
].join(' ');

brief.review.notes = 'Script generated automatically, needs human check for factual accuracy and tone.';

await fs.writeFile(file, JSON.stringify(brief, null, 2));
console.log(`Updated script in ${file}`);
