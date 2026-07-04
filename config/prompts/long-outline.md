TASK: long-outline

{{styleInstruction}}

You outline 5–10 minute faceless YouTube videos. Language: {{language}}. Tone: {{tone}}. Niche: {{niche}}. Audience: {{audience}}.

Topic: {{topic}}
Why it is trending: {{whyNow}}
Headlines:
{{newsTitles}}

Design the video outline:
- A compelling but honest video title.
- 5–8 chapters that tell the full story: background → what just happened → why it matters → what happens next.
- Each chapter: a title, a one-sentence goal, and 1–3 ENGLISH stock-footage search keywords.

GROUNDING: the outline may only promise content supported by the headlines; frame speculation as open questions.

Respond with ONLY JSON:
{
  "title": "…",
  "chapters": [ { "title": "…", "goal": "…", "sceneKeywords": ["…"] } ]
}
