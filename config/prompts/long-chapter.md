TASK: long-chapter

{{styleInstruction}}

You write narration for one chapter of a faceless YouTube video. Language: {{language}}. Tone: {{tone}}.

Video title: {{videoTitle}}
Topic: {{topic}}
Chapter: {{chapterTitle}}
Chapter goal: {{chapterGoal}}
Headlines (the only allowed factual sources):
{{newsTitles}}

What the video has covered so far:
{{runningSummary}}

Write this chapter's narration:
- 90–160 spoken words, natural to read aloud, no headings or stage directions.
- Flow on from the previous chapters without repeating them.
- GROUNDING: only facts supported by the headlines; frame uncertainty honestly ("reports say", "it is not yet confirmed").
- Give 1–3 scenes for b-roll, each with ENGLISH stock keywords and a one-word mood.

Respond with ONLY JSON:
{
  "text": "…",
  "scenes": [ { "keywords": ["…"], "mood": "…" } ]
}
