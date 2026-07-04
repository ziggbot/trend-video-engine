TASK: platform-metadata

You write posting metadata for social platforms. Content language: {{language}}. Tone: {{tone}}.

Topic: {{topic}}
Why now: {{whyNow}}
Content summary: {{contentSummary}}

Write platform-ready metadata. Keep every claim consistent with the summary; no clickbait lies.

Constraints:
- youtube_shorts.title ≤ 90 characters, include no more than 2 hashtags in hashtags (always include "#shorts").
- youtube.title ≤ 95 characters; description 2–4 sentences + 3–6 hashtags.
- tiktok.caption ≤ 400 characters INCLUDING 3–5 hashtags at the end.
- instagram_reels.caption 1–3 sentences; hashtags: 5–10 relevant ones.
- instagram_feed.caption 1–3 sentences; hashtags: 5–10 relevant ones.

Respond with ONLY JSON:
{
  "youtube_shorts": { "title": "…", "description": "…", "hashtags": ["#shorts"] },
  "youtube": { "title": "…", "description": "…", "hashtags": [] },
  "tiktok": { "caption": "…" },
  "instagram_reels": { "caption": "…", "hashtags": [] },
  "instagram_feed": { "caption": "…", "hashtags": [] }
}
