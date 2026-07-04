# Trend Video Engine

Faceless content ecosystem: turns the current Google Trends into ready-to-post
**short videos (9:16, TikTok / YouTube Shorts / Instagram Reels)**, **long-form
videos (16:9, YouTube)** and **Instagram carousel posts** — scripts, voiceover,
karaoke captions, visuals, thumbnails and per-platform titles/hashtags included.

Runs for **$0/month**: every component is free-tier or open source.

## How it works

```
Google Trends RSS ─► topic scoring ─► content plan (per channel)
        │
        ├─ short:  LLM script ─► Edge TTS (word timestamps) ─► Pexels footage
        │          ─► Remotion render (karaoke captions) ─► package
        ├─ long:   LLM outline + chapters ─► per-chapter TTS ─► ffmpeg 16:9
        │          render (ASS karaoke subs, music ducking) ─► package
        └─ image:  LLM carousel ─► Remotion stills (1080×1350) ─► package
                                                        │
             GitHub Release (zip per package) ◄─────────┘
             manifest committed, dashboard repo refreshed
```

Every run writes a **manifest** (`runs/<runId>/manifest.json`) that tracks each
stage; a killed or failed run can be resumed with `--resume <runId>` and skips
completed TTS/render work. One channel failing never kills the run.

A **package** is what you post: `output/<runId>/<channel>/<pkgId>/` with the
video/images, thumbnail, `captions.srt`, machine-readable `package.json` and a
`README.md` with copy-paste titles, descriptions and hashtags per platform.
Packages are zipped and uploaded as GitHub Release assets by the daily workflow.

## The free stack

| Component | Choice | Cost |
|---|---|---|
| Trend data | Google Trends RSS (`trends.google.com/trending/rss?geo=XX`) | free |
| Scripts/metadata | Gemini API free tier (`GEMINI_API_KEY`, no billing) | free |
| Voiceover | Microsoft Edge TTS (sv + en neural voices, native word timestamps) | free |
| Alt. voice (en) | Kokoro-82M via Kokoro-FastAPI Docker (`KOKORO_URL`) | free |
| Stock visuals | Pexels API (`PEXELS_API_KEY`) | free |
| Short renders | Remotion (free for individuals/≤3-person orgs — see licensing note) | free |
| Long renders | ffmpeg | free |
| Compute + storage | GitHub Actions cron + Releases (30-day pruning) | free |

Optional paid upgrades are wired but off by default: `LLM_PROVIDER=openai`
(OpenAI), and the Upload-Post publisher stub for future auto-posting.

## Setup

1. Get free API keys:
   - Gemini: https://aistudio.google.com/apikey
   - Pexels: https://www.pexels.com/api/
2. Add repo secrets: `GEMINI_API_KEY`, `PEXELS_API_KEY` (and keep the existing
   `DASHBOARD_REPO_TOKEN` for the dashboard repo push).
3. The **Daily Content Generation** workflow runs at 05:15 UTC (or trigger it
   manually via *Actions → Daily Content Generation → Run workflow*).
4. Download the zips from the run's GitHub Release and post — each zip's
   README contains everything to copy-paste.

### Local development

```bash
npm install
sudo apt-get install ffmpeg fonts-noto-core zip   # or brew equivalents

npm test              # unit tests (no network)
npm run test:smoke    # full pipeline in mock mode: real Remotion + ffmpeg renders
npm run run:mock      # same pipeline via the CLI, mock adapters
GEMINI_API_KEY=… PEXELS_API_KEY=… npm run run     # real run
```

If Remotion should use a preinstalled browser instead of downloading Chrome
Headless Shell, set `REMOTION_BROWSER_EXECUTABLE=/path/to/headless_shell`.

## Channels & monetization strategy

Everything is config: `config/channels.json` defines each channel's language
(sv/en), trend region (SE/US/GLOBAL), niche, tone, **content style**
(`evergreen`/`news`), platforms, voice preset (`config/voices.json`), visual
theme, cadence, approval policy and **affiliate links**. Prompts live in
`config/prompts/*.md` and can be edited without touching code.

The shipped channels implement the monetization strategy (see 2026 economics
in `docs/RESEARCH.md`):

- **`sv-ekonomi`** — Swedish personal finance/consumer explainers. Thin
  competition in Swedish, Tier-1 ad rates, and strong Nordic affiliate payouts
  (fill in real links from e.g. Adtraction — the `REPLACE_ME` entries).
- **`en-explainers`** — English documentary-style deep dives (tech, companies,
  money) for scale.

Key mechanics behind the strategy:

- **Long-form (16:9) is the revenue product** — YouTube long-form RPM is
  ~100–150× YouTube Shorts RPM. Shorts/TikTok/Reels are funnels.
- **`deriveShorts`**: on long-form days the pipeline auto-cuts N vertical
  shorts from the long video's chapters, each ending with a pointer to the
  full video.
- **`contentStyle: "evergreen"`**: the trend is used as a curiosity signal, not
  a news event — prompts force explainers that stay watchable for a year. This
  builds a compounding back-catalog and is much safer under YouTube's
  inauthentic-content policy than trend-recap churn.
- **Affiliate blocks** are appended to YouTube descriptions and package READMEs
  automatically — affiliate revenue has no subscriber threshold and is
  realistically the first money in.
- **Approval is manual for everything** by default: a human pass over each
  package is a YPP-compliance requirement in practice, not bureaucracy. Loosen
  per channel/kind in config once a format has a track record.

## Approval & publishing

- Shorts and image posts are **auto-approved** by policy; long-form videos are
  `pending_approval` until you approve them.
- Approve/reject via *Actions → Approve Content Package* (or locally:
  `npm run approve -- <runId> <pkgId> --approve`).
- Publishing is **manual for now** (you post the packages by hand). The
  `Publisher` interface (`src/adapters/publish/`) is ready for auto-posting:
  implement/enable the Upload-Post adapter and flip `"publisher"` in the
  channel config — no refactoring needed. See `docs/RESEARCH.md` for the
  platform-API landscape (audits, quotas) behind this decision.

## Content-policy guardrails

YouTube's 2025 "inauthentic content" policy punishes mass-templated output.
Mitigations built in: per-channel themes and voices, angle-variety prompt
instructions, a used-footage ledger (`data-ledger/`), repetition penalty on
recently covered topics, no canned fallback scripts, and grounding rules that
forbid claims not supported by the trend's news sources. Keep a human eye on
the output — that's what the release review surface is for.

## Notes

- **Remotion license**: free for individuals and companies of ≤3 people. If
  this ever runs inside a larger organization, a paid Remotion license is
  required — https://remotion.dev/license
- **Edge TTS** is an unofficial API. If it breaks, switch voices to the Kokoro
  provider (English) in `config/voices.json` — the interface is identical.
- `ARCHITECTURE.md` describes the pipeline internals; `docs/RESEARCH.md` is the
  full research (mid-2026) behind every component choice.
