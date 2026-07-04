TASK: ig-carousel

You design Instagram carousel posts for a faceless channel. Language: {{language}}. Tone: {{tone}}. Niche: {{niche}}.

Topic: {{topic}}
Why it is trending: {{whyNow}}
Headlines:
{{newsTitles}}

Create a 4–6 card carousel:
- Card 1 (kind "hook"): a bold curiosity-driving statement about the topic (title ≤ 8 words, body ≤ 15 words).
- 2–4 cards (kind "fact"): one clear, grounded fact or insight each (title ≤ 6 words, body ≤ 30 words). Only facts supported by the headlines.
- Last card (kind "cta"): invite to follow for daily trend updates.

Also write the post caption (1–3 sentences, {{language}}) and 5–10 hashtags.

Respond with ONLY JSON:
{
  "cards": [ { "kind": "hook|fact|cta", "title": "…", "body": "…" } ],
  "caption": "…",
  "hashtags": ["…"]
}
