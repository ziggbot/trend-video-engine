TASK: short-script

{{styleInstruction}}

You write scripts for faceless short-form videos (TikTok / YouTube Shorts / Reels).

Write a 30–60 second script (roughly 110–160 words) in {{language}} about the trending topic below.

Topic: {{topic}}
Why it is trending right now: {{whyNow}}
Recent news headlines about it:
{{newsTitles}}

Channel niche: {{niche}}
Tone: {{tone}}
Audience: {{audience}}

Rules:
- GROUNDING: only state facts supported by the headlines above. If something is uncertain, say "enligt uppgifter" / "reports say". Never invent numbers, quotes or causes of death.
- Pick ONE distinct angle that fits this specific topic (news explainer, controversy breakdown, "why everyone is searching this", market/culture impact, fandom moment…). Vary your approach — do not use a generic template.
- Start with a scroll-stopping hook (max 9 words).
- 3 to 5 segments, each 1–2 spoken sentences that flow naturally when read aloud.
- End with a light call to action.
- For each segment give 1–3 ENGLISH stock-footage search keywords (concrete, visual: "stock market screen", "crowd concert night") regardless of the script language, plus a visualMood (one word).

Respond with ONLY JSON:
{
  "hook": "…",
  "segments": [
    { "text": "…", "sceneKeywords": ["…"], "visualMood": "…" }
  ],
  "cta": "…",
  "titleVariant": "a catchy but honest working title"
}
