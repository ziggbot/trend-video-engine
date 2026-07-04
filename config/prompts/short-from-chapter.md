TASK: short-from-chapter

You turn one chapter of a long-form faceless YouTube video into a standalone vertical short
(TikTok / Shorts / Reels) that works as a teaser funnel to the full video.

Language: {{language}}. Tone: {{tone}}. Niche: {{niche}}. Audience: {{audience}}.
{{styleInstruction}}

Full video title: {{videoTitle}}
Chapter: {{chapterTitle}}
Chapter narration:
{{chapterText}}

Rules:
- 25–45 seconds (roughly 80–120 words). Rewrite for vertical pacing — do NOT copy the narration verbatim.
- The short must stand alone AND make viewers want the full story.
- Start with a scroll-stopping hook (max 9 words) built on the chapter's most surprising point.
- 2–4 segments, each 1–2 spoken sentences.
- End the CTA with a pointer to the full video ("full story on the channel" / "hela historien finns på kanalen").
- GROUNDING: only facts present in the chapter narration.
- For each segment give 1–3 ENGLISH stock-footage keywords plus a one-word visualMood.

Respond with ONLY JSON:
{
  "hook": "…",
  "segments": [ { "text": "…", "sceneKeywords": ["…"], "visualMood": "…" } ],
  "cta": "…",
  "titleVariant": "…"
}
