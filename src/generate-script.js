import fs from 'fs/promises';
import path from 'path';

const dir = path.resolve('data/drafts');
const files = (await fs.readdir(dir)).filter(f => f.startsWith('content-brief-')).sort();
if (!files.length) throw new Error('No content brief found. Run generate-brief first.');

const file = path.join(dir, files[files.length - 1]);
const brief = JSON.parse(await fs.readFile(file, 'utf8'));

async function generateWithOpenAI(input) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
      temperature: 0.8,
      messages: [
        {
          role: 'system',
          content: 'You write short, sharp, high-retention YouTube Shorts scripts in Swedish. Keep them punchy, clear, non-cringe, and easy to narrate. Output valid JSON only.'
        },
        {
          role: 'user',
          content: `Create a 30-second Swedish short-video script for this topic.\n\nTopic: ${input.topic}\nWhy now: ${input.why_now}\nAudience angle: ${input.audience_angle}\nHook seed: ${input.hook}\n\nReturn JSON with keys: script_30s, caption_chunks, title_variant.`
        }
      ],
      response_format: {
        type: 'json_object'
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

function fallbackScript(input) {
  return {
    title_variant: `${input.topic} på 30 sekunder`,
    script_30s: [
      input.hook,
      `${input.topic} trendar just nu, och det handlar inte bara om att många söker, utan om att ämnet träffar något som folk redan känner eller oroar sig för.`,
      `${input.why_now} ${input.audience_angle}`,
      'Det här är exakt typen av ämne som exploderar i kortformat när det paketeras tydligt och snabbt.',
      'Vill du ha fler snabba förklaringar av det som trendar just nu, följ för nästa video.'
    ].join(' '),
    caption_chunks: [
      input.hook,
      `${input.topic} trendar just nu`,
      input.why_now,
      'Det här exploderar i kortformat',
      'Följ för nästa trend'
    ]
  };
}

let generated;
if (process.env.OPENAI_API_KEY) {
  try {
    generated = await generateWithOpenAI(brief);
    brief.generationMode = 'openai';
  } catch (error) {
    generated = fallbackScript(brief);
    brief.generationMode = 'fallback';
    brief.generationError = String(error.message || error);
  }
} else {
  generated = fallbackScript(brief);
  brief.generationMode = 'fallback';
}

brief.script_30s = generated.script_30s;
brief.caption_chunks = generated.caption_chunks;
brief.youtube.title = generated.title_variant || brief.youtube.title;
brief.review.notes = brief.generationMode === 'openai'
  ? 'Script generated with OpenAI. Needs human check for factual accuracy and tone before publishing.'
  : 'Fallback script generated locally. Needs human check for factual accuracy and tone before publishing.';

await fs.writeFile(file, JSON.stringify(brief, null, 2));
console.log(`Updated script in ${file} using ${brief.generationMode}`);
