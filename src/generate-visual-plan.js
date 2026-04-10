import fs from 'fs/promises';
import path from 'path';

const dir = path.resolve('data/drafts');
const files = (await fs.readdir(dir)).filter(f => f.startsWith('content-brief-')).sort();
if (!files.length) throw new Error('No content brief found. Run generate-brief first.');

const file = path.join(dir, files[files.length - 1]);
const brief = JSON.parse(await fs.readFile(file, 'utf8'));

const topic = brief.topic;
const whyNow = brief.why_now || '';
const angleType = brief.angle_type || 'why_now';
const buzzDriver = brief.buzz_driver || 'current public attention';
const lower = `${topic} ${whyNow} ${angleType} ${buzzDriver}`.toLowerCase();

function buildScenes() {
  if (/aktie|stock|börs|nasdaq|bitcoin|krypto|tesla|nvidia/.test(lower)) {
    return [
      {
        scene: 1,
        purpose: 'hook',
        visualPrompt: `Vertical cinematic finance visual about ${topic}, glowing market screens, sharp price movement, dramatic blue and green light, realistic newsroom-finance aesthetic, high contrast, no text`,
        caption: `Varför trendar ${topic}?`
      },
      {
        scene: 2,
        purpose: 'explain why now',
        visualPrompt: `AI-generated scene showing investor tension around ${topic}, traders watching screens, volatility, urgency, modern financial atmosphere, realistic, vertical 9:16, no text`,
        caption: whyNow || 'Det finns en tydlig marknadsreaktion just nu.'
      },
      {
        scene: 3,
        purpose: 'reason to care',
        visualPrompt: `Realistic symbolic finance scene for ${topic}, attention spike, public curiosity, momentum, elegant editorial illustration style, vertical, no text`,
        caption: `Buzz driver: ${buzzDriver}`
      }
    ];
  }

  if (/film|serie|trailer|netflix|marvel|punisher|tv/.test(lower)) {
    return [
      {
        scene: 1,
        purpose: 'hook',
        visualPrompt: `Vertical cinematic entertainment visual inspired by ${topic}, dark dramatic lighting, intense character silhouette, premium teaser poster look, realistic but original, no copyrighted characters, no text`,
        caption: `Varför pratar alla om ${topic}?`
      },
      {
        scene: 2,
        purpose: 'explain why now',
        visualPrompt: `AI-generated dramatic pop culture scene about ${topic}, fandom reaction, trailer-drop energy, moody red and black palette, vertical 9:16, editorial style, no text`,
        caption: whyNow || 'Något nytt har triggat stark publikreaktion.'
      },
      {
        scene: 3,
        purpose: 'reason to care',
        visualPrompt: `Cinematic original visual representing the buzz around ${topic}, online discussion, hype, emotion, modern entertainment commentary aesthetic, vertical, no text`,
        caption: `Buzz driver: ${buzzDriver}`
      }
    ];
  }

  if (/död|kris|attack|skandal|avslöjar|kaos|mord|brott/.test(lower)) {
    return [
      {
        scene: 1,
        purpose: 'hook',
        visualPrompt: `Breaking-news style vertical visual about ${topic}, urgent newsroom atmosphere, dramatic lighting, serious tone, modern broadcast aesthetic, no text`,
        caption: `${topic} trendar hårt nu`
      },
      {
        scene: 2,
        purpose: 'explain why now',
        visualPrompt: `AI-generated serious editorial scene representing ${topic}, public concern, news alert energy, clean realistic style, vertical 9:16, no text`,
        caption: whyNow || 'Det finns ett starkt nyhetsvärde just nu.'
      },
      {
        scene: 3,
        purpose: 'reason to care',
        visualPrompt: `Realistic editorial visual showing why people are reacting to ${topic}, urgency, emotional tension, news explainer style, vertical, no text`,
        caption: `Det här driver buzz just nu`
      }
    ];
  }

  return [
    {
      scene: 1,
      purpose: 'hook',
      visualPrompt: `Vertical editorial AI image about ${topic}, high-attention social trend moment, strong composition, modern digital culture style, no text`,
      caption: `Varför trendar ${topic}?`
    },
    {
      scene: 2,
      purpose: 'explain why now',
      visualPrompt: `AI-generated realistic editorial visual explaining why ${topic} is trending now, current buzz, audience curiosity, vertical 9:16, no text`,
      caption: whyNow || 'Det finns en tydlig anledning till intresset just nu.'
    },
    {
      scene: 3,
      purpose: 'reason to care',
      visualPrompt: `Stylized but realistic visual of public attention around ${topic}, momentum, discussion, relevance, clean modern social-news aesthetic, vertical, no text`,
      caption: `Buzz driver: ${buzzDriver}`
    }
  ];
}

const visualPlan = {
  createdAt: new Date().toISOString(),
  topic,
  angleType,
  buzzDriver,
  style: 'vertical short-form ai visual scenes',
  scenes: buildScenes()
};

const outDir = path.resolve('data/visuals');
await fs.mkdir(outDir, { recursive: true });
const outFile = path.join(outDir, `visual-plan-${Date.now()}.json`);
await fs.writeFile(outFile, JSON.stringify(visualPlan, null, 2));
console.log(`Saved visual plan to ${outFile}`);
