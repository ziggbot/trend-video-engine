import fs from 'fs/promises';
import path from 'path';

const dir = path.resolve('data/drafts');
const files = (await fs.readdir(dir)).filter(f => f.startsWith('content-brief-')).sort();
if (!files.length) throw new Error('No content brief found. Run generate-brief first.');

const file = path.join(dir, files[files.length - 1]);
const brief = JSON.parse(await fs.readFile(file, 'utf8'));

const hook = brief.hook;
const whyNow = brief.why_now;
const topic = brief.topic;
const angle = brief.audience_angle;

brief.script_30s = [
  hook,
  `${topic} trendar just nu, och det handlar inte bara om att många söker, utan om att ämnet träffar något som folk redan känner eller oroar sig för.`,
  `${whyNow} ${angle}`,
  'Det här är exakt typen av ämne som exploderar i kortformat när det paketeras tydligt och snabbt.',
  'Vill du ha fler snabba förklaringar av det som trendar just nu, följ för nästa video.'
].join(' ');

brief.caption_chunks = [
  hook,
  `${topic} trendar just nu`,
  whyNow,
  'Det här exploderar i kortformat',
  'Följ för nästa trend'
];

brief.review.notes = 'Script generated automatically, needs human check for factual accuracy, nuance, and tone before publishing.';

await fs.writeFile(file, JSON.stringify(brief, null, 2));
console.log(`Updated script in ${file}`);
