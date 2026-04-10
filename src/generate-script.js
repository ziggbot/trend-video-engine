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
          content: 'You write short, sharp, high-retention YouTube Shorts scripts in Swedish. Make each script feel tailored to the topic, not templated. Vary the angle between news explainer, controversy breakdown, why-now analysis, emotional reaction, market/context explanation, culture moment, or what-everyone-is-missing. Focus on why the topic is trending, what is driving the buzz, and why viewers should care right now. Keep it punchy, natural, non-cringe, and easy to narrate. Output valid JSON only.'
        },
        {
          role: 'user',
          content: `Create a 30-second Swedish short-video script for this topic.\n\nTopic: ${input.topic}\nWhy now: ${input.why_now}\nAudience angle: ${input.audience_angle}\nHook seed: ${input.hook}\n\nRequirements:\n- Make the angle feel specific to this topic\n- Explain why it is trending now\n- Identify what is causing the buzz, reaction, controversy, fandom, market move, or news spike\n- Avoid generic filler and repeated phrasing\n- Write for voiceover, natural spoken Swedish\n- 1 strong hook, 1 clear explanation, 1 reason-to-care payoff\n\nReturn JSON with keys: script_30s, caption_chunks, title_variant, angle_type, buzz_driver.`
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
  const topic = input.topic;
  const whyNow = input.why_now || 'Det finns ett tydligt nyhetsfönster runt ämnet just nu.';
  const lower = `${topic} ${whyNow}`.toLowerCase();

  let angleType = 'why_now';
  let buzzDriver = 'search spike';
  let script;
  let captions;

  if (/aktie|stock|börs|nasdaq|bitcoin|krypto|tesla|nvidia/.test(lower)) {
    angleType = 'market_move';
    buzzDriver = 'market reaction';
    script = `Varför pratar alla om ${topic} just nu? Det verkar inte bara handla om nyfikenhet, utan om att marknaden reagerar i realtid. ${whyNow} När ett ämne som det här börjar trendas brukar det betyda att folk försöker förstå om det här bara är brus, eller början på en större rörelse. Det är exakt därför ${topic} får så mycket uppmärksamhet just nu.`;
    captions = [`Varför trendar ${topic}?`, 'Marknaden reagerar', whyNow, 'Brus eller större rörelse?', 'Det är därför folk kollar nu'];
  } else if (/film|serie|trailer|netflix|marvel|punisher|tv/.test(lower)) {
    angleType = 'fandom_reaction';
    buzzDriver = 'trailer/fandom reaction';
    script = `${topic} trendar inte bara för att något har släppts, utan för att publiken reagerar direkt. ${whyNow} När fans börjar diskutera detaljer, spekulationer och vad det här betyder framåt, då sticker ett ämne upp snabbt. Det är därför ${topic} får så mycket buzz nu, det handlar lika mycket om reaktionen som om själva nyheten.`;
    captions = [`${topic} exploderar nu`, 'Publiken reagerar direkt', whyNow, 'Det handlar om reaktionen', 'Därför buzzar det'];
  } else if (/död|kris|attack|skandal|avslöjar|kaos|mord|brott/.test(lower)) {
    angleType = 'breaking_news';
    buzzDriver = 'shock and urgency';
    script = `${topic} trendar just nu eftersom det finns en stark känsla av chock eller akut nyhetsvärde runt ämnet. ${whyNow} När folk upplever att något stort precis har hänt ökar sökningarna snabbt, både för att förstå vad som hänt och för att hänga med i senaste uppdateringen. Det är precis det som driver uppmärksamheten här.`;
    captions = [`${topic} trendar hårt`, 'Starkt nyhetsvärde', whyNow, 'Folk vill förstå snabbt', 'Det driver uppmärksamheten'];
  } else {
    angleType = 'why_now';
    buzzDriver = 'public curiosity';
    script = `${input.hook} Det som driver intresset nu är att ${whyNow.toLowerCase()} När många samtidigt försöker förstå samma sak får ämnet snabbt fart i sök och sociala flöden. Så det här handlar inte bara om att ${topic} nämns mycket, utan om att det finns en konkret anledning till att folk bryr sig just nu.`;
    captions = [input.hook, `Varför trendar ${topic}?`, whyNow, 'Det finns en konkret anledning', 'Det är därför folk bryr sig nu'];
  }

  return {
    title_variant: `${topic} på 30 sekunder`,
    script_30s: script,
    caption_chunks: captions,
    angle_type: angleType,
    buzz_driver: buzzDriver
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
brief.angle_type = generated.angle_type || null;
brief.buzz_driver = generated.buzz_driver || null;
brief.youtube.title = generated.title_variant || brief.youtube.title;
brief.review.notes = brief.generationMode === 'openai'
  ? 'Script generated with OpenAI. Needs human check for factual accuracy and tone before publishing.'
  : 'Fallback script generated locally. Needs human check for factual accuracy and tone before publishing.';

await fs.writeFile(file, JSON.stringify(brief, null, 2));
console.log(`Updated script in ${file} using ${brief.generationMode}`);
