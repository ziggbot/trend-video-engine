import fs from 'fs/promises';
import path from 'path';

const trendsDir = path.resolve('data/trends');
const trendFiles = (await fs.readdir(trendsDir)).filter(f => f.endsWith('.json')).sort();
if (!trendFiles.length) throw new Error('No trend files found. Run fetch-trends first.');

const latestTrendFile = path.join(trendsDir, trendFiles[trendFiles.length - 1]);
const latestTrend = JSON.parse(await fs.readFile(latestTrendFile, 'utf8'));
const topics = (latestTrend.trends || []).slice(0, 10);

function fallbackTopicScript(topic, whyNow, regionLabel) {
  const lower = `${topic} ${whyNow}`.toLowerCase();

  if (/aktie|stock|börs|nasdaq|bitcoin|krypto|tesla|nvidia/.test(lower)) {
    return `Varför pratar alla om ${topic} just nu? Det verkar handla om mer än bara nyfikenhet, för när ett ämne som det här exploderar i sök brukar det betyda att marknaden reagerar snabbt. ${whyNow} Det folk försöker förstå nu är om det här bara är ett kort ryck, eller början på en större rörelse. Det är exakt därför ${topic} blivit ett så starkt video-case just nu.`;
  }

  if (/film|serie|trailer|netflix|marvel|punisher|tv/.test(lower)) {
    return `${topic} trendar inte bara för att något nytt har släppts, utan för att publiken reagerar direkt. ${whyNow} När fans börjar diskutera detaljer, teorier och vad det här betyder framåt, då får ett ämne snabbt eget momentum. Det är därför ${topic} känns så stort just nu, för det handlar lika mycket om publikens reaktion som om själva nyheten.`;
  }

  if (/död|kris|attack|skandal|avslöjar|kaos|mord|brott/.test(lower)) {
    return `${topic} trendar kraftigt i ${regionLabel} just nu eftersom ämnet har starkt nyhetsvärde och väcker direkt reaktion. ${whyNow} När folk känner att något stort eller allvarligt precis har hänt går sökningarna snabbt upp, både för att förstå läget och för att inte missa nya uppgifter. Det är precis den kombinationen som driver buzz runt ${topic} nu.`;
  }

  return `Varför trendar ${topic} just nu? Det finns en tydlig anledning till att folk pratar om det här överallt. ${whyNow} Det som driver uppmärksamheten är att många försöker förstå vad som faktiskt händer, varför ämnet plötsligt känns relevant och varför så många reagerar samtidigt. Det gör ${topic} till ett starkt YouTube Short-case, eftersom det går snabbt att förklara och känns aktuellt direkt.`;
}

async function generateWithOpenAI(item, regionLabel) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini',
      temperature: 0.9,
      messages: [
        {
          role: 'system',
          content: 'You write Swedish YouTube Shorts scripts that are highly clickable, specific to the topic, and clearly explain why a trend is buzzing right now. Make each topic feel distinct. Avoid generic repeated structure. Stay grounded in the supplied why-now context. Do not invent claims, plot points, negotiations, personal facts, or news events that are not supported by the provided context. If context is thin, be more general and frame it as public attention, reactions, or discussion. Output valid JSON only.'
        },
        {
          role: 'user',
          content: `Write a Swedish 30-second YouTube Shorts voice script for this trending topic.\n\nTopic: ${item.topic}\nRegion: ${regionLabel}\nWhy now: ${item.whyNow || 'Unknown'}\nApprox traffic: ${item.approxTraffic || 'Unknown'}\n\nRequirements:\n- Make it attractive for YouTube viewers\n- Explain why it is trending now\n- Explain what is causing the buzz\n- Make it sound natural for voiceover\n- Make this topic feel distinct from other topics\n- Stay tightly grounded in the supplied why-now context\n- Do not make up extra facts or specific claims beyond the provided context\n\nReturn JSON with keys: script, angle_type, buzz_driver, title.`
        }
      ],
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

const out = {
  region: latestTrend.region,
  regionLabel: latestTrend.regionLabel,
  generatedAt: new Date().toISOString(),
  sourceTrendFile: path.basename(latestTrendFile),
  items: []
};

for (const [index, item] of topics.entries()) {
  let generated;
  try {
    if (process.env.OPENAI_API_KEY) {
      generated = await generateWithOpenAI(item, latestTrend.regionLabel || latestTrend.region || 'unknown region');
    } else {
      generated = {
        script: fallbackTopicScript(item.topic, item.whyNow || '', latestTrend.regionLabel || latestTrend.region || 'this region'),
        angle_type: 'fallback',
        buzz_driver: item.whyNow || 'current public attention',
        title: `${item.topic} på 30 sekunder`
      };
    }
  } catch (error) {
    generated = {
      script: fallbackTopicScript(item.topic, item.whyNow || '', latestTrend.regionLabel || latestTrend.region || 'this region'),
      angle_type: 'fallback',
      buzz_driver: item.whyNow || 'current public attention',
      title: `${item.topic} på 30 sekunder`,
      error: String(error.message || error)
    };
  }

  out.items.push({
    rank: index + 1,
    topic: item.topic,
    whyNow: item.whyNow || '',
    approxTraffic: item.approxTraffic || '',
    script: generated.script,
    angleType: generated.angle_type || null,
    buzzDriver: generated.buzz_driver || item.whyNow || null,
    title: generated.title || `${item.topic} på 30 sekunder`
  });
}

const outDir = path.resolve('data/drafts');
await fs.mkdir(outDir, { recursive: true });
const outFile = path.join(outDir, `topic-scripts-${Date.now()}.json`);
await fs.writeFile(outFile, JSON.stringify(out, null, 2));
console.log(`Saved topic scripts to ${outFile}`);
