# SYNTHESIS — Automated Faceless-Content Pipeline (decision document)

Synthesized 2026-07-04 from 11 web-research reports in this directory. All reports share one
caveat: the research sandbox's proxy blocked direct fetches of many official pricing/doc pages,
so prices were triangulated from search-indexed copies + multiple secondary sources. Load-bearing
prices are marked **[verify]** where the source reports flagged them.

---

## 1. Trend data

**Official Google Trends API: still alpha, gated.** Announced July 2025; as of mid-2026 access is
application-based to a small pilot group. Even if accepted, it provides interest-over-time only —
**no real-time "Trending Now"**. Apply (free), but do not build on it.

**Google Trends RSS feed: alive and the best free real-time signal.**
`https://trends.google.com/trending/rss?geo=XX` returns ~top-20 trending queries per country with
`ht:approx_traffic` (e.g. "200K+"), pubDate, picture, and linked news items (title/URL/source) —
enough to know *what's trending, how big, and why* (news context feeds script generation).
Unofficial, could change without notice, but it survived the 2024 Trending Now revamp and is
widely used (n8n templates, trendspyg).

**Scraping libraries:** pytrends is **dead** (archived April 2025; maintainer warned Google serves
*altered data* to detected bots). npm `google-trends-api` is dead (~6 years stale). trendspyg
(Python) is the maintained option, but its robust part is just an RSS wrapper.

**Paid options:** SerpApi Google Trends + Trending Now (free 250 searches/mo; $25/1k/mo);
SearchAPI.io (100 free, from ~$40/mo, cheaper at volume); Glimpse (absolute volumes, ~$99+/mo,
enterprise API — overkill); DataForSEO (cheap pay-as-you-go).

**Complementary free sources:**
- **YouTube trending**: Data API `videos.list?chart=mostPopular` — official, 1 quota unit/call, per-region/category. Free, trivial. Use it.
- **Reddit rising/hot**: official API, free non-commercial, 100 QPM OAuth. Use it.
- **Wikipedia pageviews**: Wikimedia REST API, free — underrated entity-spike corroboration.
- TikTok Creative Center: no official API; Apify scrapers a few $/1k results — optional.
- X/Twitter: skip (expensive, low priority).

**Recommendation:** Poll the Trends RSS per target geo every 30–60 min (a ~20-line XML parse in
Node — no library dependency), enrich with YouTube mostPopular + Reddit rising, cross-check
entity spikes with Wikipedia pageviews. Keep SerpApi's free tier as a structured backup. Apply
for the official alpha in parallel. Total cost: **$0/mo**.

## 2. Script generation

Trivial component: any frontier LLM (Claude, GPT, Gemini) via API. One nuance for long-form
(5–10 min ≈ 1,300–1,500 words): use **hierarchical expansion** — outline first, then generate
each chapter separately feeding a running summary forward — rather than one giant prompt.
Cost: cents/video; ~$1–5/mo at daily volume.

## 3. TTS

Rule of thumb: 60s short ≈ 1,250 chars; 1 min of speech ≈ ~1,250 chars at ~150 wpm.

| Option | ~$/1 min audio | Notes |
|---|---|---|
| **Kokoro-82M self-hosted** (default) | **$0** | Apache 2.0, ~330MB, 54 voices, faster-than-realtime on CPU; `kokoro-js` runs in-process in Node (but no timestamps in JS port); Kokoro-FastAPI (Python) gives **free word timestamps** via `/dev/captioned_speech` |
| Kokoro hosted (DeepInfra) | ~$0.001 | ~$0.65–0.80/1M chars, OpenAI-compatible |
| OpenAI gpt-4o-mini-tts | ~$0.015 | Best big-API quality-per-dollar; steerable via instructions; **no timestamps** |
| Google Chirp 3 HD | ~$0.0375 | $30/1M chars but **1M chars/mo free tier** ≈ 800 shorts free/mo |
| MiniMax Speech-02-HD | ~$0.06–0.125 | Arena-top quality, cloning |
| **ElevenLabs** (premium) | ~$0.11–0.28 | Flash v2.5 ≈ $0.11–0.14/min, Multilingual v2/v3 ≈ $0.23–0.28/min at Creator ($22/mo, 100k vs 121k credits — sources conflict [verify]). Killer feature: `/with-timestamps` returns character-level timing free with the call |

**Recommendation:** **Default: Kokoro** (self-hosted via Kokoro-FastAPI sidecar for free audio +
free word timestamps; or DeepInfra-hosted at ~$0.001/min). **Premium: ElevenLabs Flash v2.5 via
`with-timestamps`** when voice quality matters — it's the only major API with native timing.
Avoid F5-TTS/Fish/XTTS-v2 (non-commercial licenses).

## 4. Visuals

- **Stock (free):** **Pexels API** — free, 200 req/hr / 20k req/mo (unlimited on request with attribution), `orientation=portrait` on video search, clean commercial license. **Pixabay** fallback (100 req/60s, no attribution). Coverr third. $0/video, but footage is generic and shared with every other faceless channel.
- **AI images + Ken Burns (the sweet spot):** FLUX schnell ≈ $0.003/MP on fal.ai (~$0.006 per 9:16 image at 2MP); 10–15 images/short ≈ **$0.03–0.10/video**. Quality bump: Imagen 4 Fast $0.02 or FLUX dev $0.025/MP → still <$0.40/video. Unique visuals per script, deterministic, no licensing ambiguity.
- **AI video:** cheapest usable hosted clips are Seedance 1.0 Lite / Hailuo 02 Standard / Kling 2.5 Turbo Standard / Wan 2.2 at ~$0.04–0.05/sec → **$2–4.50 per fully-AI 60s short** ($60–135/mo daily) before retry waste (+30–100%). Veo 3.1 ($9–24/60s) and Sora 2 Pro are hero-clip-only. Wan 2.x is Apache-2.0 self-hostable if you own a GPU.

**Recommendation (daily, small budget):** Pexels portrait clips as primary; FLUX-schnell images
with Ken Burns pan/zoom when stock search confidence is low; optionally one budget AI clip
(~$0.20–0.35) for the hook. **≈ $0–1/video, $5–15/mo.** Skip full AI video for now. For long-form
documentaries, also mine Archive.org/NASA/Wikimedia public-domain footage (OpenMontage's approach).

## 5. Captions (word-level timestamps)

**Don't transcribe your own TTS output — take timestamps from the TTS step.** Zero cost, zero
latency, zero WER mismatch with the script, sample-accurate timing:
- ElevenLabs: `/with-timestamps` → aggregate chars→words (~15 lines of Node).
- Kokoro: Kokoro-FastAPI `/dev/captioned_speech` → word timestamps free.
- Cartesia: `add_timestamps: true` → word-level directly.

Fallbacks when audio isn't yours or TTS lacks timing (e.g. OpenAI TTS):
- **Cheapest ASR:** Groq whisper-large-v3-turbo, `timestamp_granularities:["word"]` — **$0.04/hr** (~$0.0007/min), OpenAI-SDK-compatible drop-in. Caveat: Whisper word timing drifts ±100–500 ms (attention-DTW, not true alignment) — fine for grouped caption pages, borderline for strict karaoke sweeps.
- **Most accurate:** WhisperX self-hosted (wav2vec2 forced alignment, <100 ms) via Python child process; or NVIDIA Parakeet TDT (CC-BY-4.0, native word timestamps, extremely fast). Managed: Deepgram Nova-3 $0.0043/min.
- OpenAI whisper-1 ($0.006/min) works but is 9x Groq's price for the same model family; gpt-4o-transcribe models do **not** support word granularity.

Rendering the captions: Remotion `@remotion/captions` + `createTikTokStyleCaptions()` (its
`Caption[]` format is exactly word-timestamp JSON), or ASS karaoke tags (`\k`/`\kf`) burned in
with ffmpeg's `subtitles=` filter for a zero-dependency path.

## 6. Rendering

**Remotion licensing verdict: free for you.** Source-available; free for individuals and
companies **≤3 people** including commercial output. The "Automators" license ($0.01/render,
$100/mo minimum) only bites at 4+ people. Local/server rendering costs $0; Remotion Lambda ≈
$0.017–0.021/render AWS cost if you want it. Cloud Run runner is alpha/stalled — use Lambda or
plain server render.

- **9:16 shorts:** **Remotion, rendered locally / in GitHub Actions.** Native TypeScript, best-in-class karaoke caption tooling, official TikTok template. $0.
- **5–10 min 16:9 long-form:** **plain ffmpeg** (concat demuxer + zoompan + `subtitles=file.ass` + `sidechaincompress` music ducking under VO — forgetting ducking is a recognizable AI-slop tell). No duration limits, near-real-time 1080p x264 on cheap CPU. Remotion also handles 10-min fine (Lambda ceiling ≈ 32 min FHD at default disk) if you want React polish. **Avoid fluent-ffmpeg — archived May 2025**; spawn ffmpeg directly (ffmpeg-static for the binary). editly and FFCreator are effectively unmaintained.
- **Hosted APIs (if you want zero render ops):** Shotstack $39/mo = 200 min ($0.20/min, "Rich Captions" word-level animations, built-in TTS); JSON2Video $49.95/mo = 200 min, 10-min max per video (built-in auto-subtitles + Azure TTS); Creatomate Essential $49/mo ≈ 2,000 credits (~14 credits/min @720p [verify 1080p rate]; nicest template editor, no TTS, 15-min cap/render). Long-form SaaS (Pictory API $49/mo, Fliki Premium $88/mo) not needed if you render yourself.

**Recommendation:** Remotion for shorts + ffmpeg for long-form, both free, both run in a
GitHub Actions job or $5–10 VPS. Hosted renderers are a fallback, not a need.

## 7. Publishing

**Per-platform reality (all three have an audit/review wall):**
- **YouTube Data API v3:** Quota is no longer the blocker — `videos.insert` dropped from 1,600 units to ~100 (Dec 2025), then moved to a dedicated bucket of ~100 uploads/day (June 2026) [verify in Cloud Console; one aggregator report still cited the obsolete ~6/day figure — the YouTube-specific report is more current]. **The real blocker: uploads from unaudited API projects are locked private** ("Private (locked)", no appeal) — policy since July 2020, still enforced. Fix: pass the free compliance audit (same form as quota extension; weeks–months; "uploading original content to your own channel" is an explicitly permitted use), or upload private and publish via Studio. Also: set the OAuth consent screen to "In Production" (verification optional for self-use) or refresh tokens die every 7 days. Shorts = normal `videos.insert`, vertical/square ≤3 min, no special flag; use the `googleapis` npm (resumable upload automatic).
- **TikTok Content Posting API:** **Unaudited clients can only post SELF_ONLY (private)**, max 5 posting users/24h, account must be private at post time. The audit requires a public website with privacy policy/ToS, domain verification, demo video, and a mandated pre-post UX (privacy selector with no default, toggles off by default, commercial-content disclosure) — rejections on UX details are the norm; TikTok is the strictest gate of the three. Post-audit: ~15 direct posts/day/creator, 6 req/min/token.
- **Instagram:** Professional (Business/Creator) account mandatory. **A solo dev CAN post to their own account with a dev-mode app, no App Review** (add yourself as tester); review (2–8 weeks, business verification) only needed for third-party accounts. Route B ("Instagram Login", `graph.instagram.com`, `instagram_business_content_publish`) avoids needing a Facebook Page; tokens last 60 days (cron-refresh ~every 50). Media must be at a public HTTPS URL (or resumable upload, Route A); Reels 9:16 MP4 H.264/AAC; 100 API posts/day/account. (One report claimed Creator accounts can't publish — official docs say both Business and Creator work; trust the docs.)

**Aggregators (they hold pre-audited platform apps — the entire point):**

| Service | Cheapest API tier w/ video | Reviews handled? | Catch |
|---|---|---|---|
| **Zernio** (ex-late.dev, rebranded) | **$0 for 2 accounts; 3 accounts ≈ $6/mo** | Yes | per-account pricing ($6/acct for 3–10) |
| **Upload-Post** | $0 (10 uploads/mo) / **~$16/mo annual** (5 profiles, unlimited uploads) | Yes | — |
| Post Bridge | ~$14/mo ($9 + $5 API add-on) | Yes | newer/less proven |
| **Blotato** | $29/mo | Yes | TikTok 3 accts/day on Starter; dominant in n8n faceless templates |
| Postiz cloud | $29/mo (400 posts/mo) | Yes | API rate limit 30 req/hour |
| Postiz self-hosted | Free (AGPL) | **No — you bring your own TikTok/Meta/Google apps + pass all audits yourself** | defeats the purpose for solo |
| Mixpost | $299 one-time | No — TikTok review effectively Enterprise-only ($1,199) | avoid |
| Ayrshare | $149/mo | Yes | most mature, priciest; free tier closed |
| Buffer API | — | — | closed to new developers |

**Recommendation for a solo dev posting daily to YT Shorts + TikTok + IG Reels:** use an
aggregator; do **not** fight three platform audits. **Upload-Post (~$16/mo, unlimited uploads,
one REST API for all platforms, official MCP + bundled n8n node)** is the primary pick;
**Zernio (~$6/mo for 3 accounts, 2 free to test)** is the budget alternative; Blotato ($29/mo)
if you want the most battle-tested automation ecosystem. Optional later optimization: pass the
YouTube compliance audit once and post to YouTube directly via `googleapis` for free (~100
uploads/day), keeping the aggregator for TikTok+IG only. Skip Playwright browser-uploaders
(ToS-violating, actively being broken by TikTok's 2026 bot detection).

## 8. MCP servers / existing tools

**MCP servers that actually exist and are maintained:**
- Trends in: **jmanek/google-news-trends-mcp** (verified active, v0.2.9 Mar 2026; `get_trending_keywords` + news — best RSS-pipeline fit); trendsmcp/Trends-MCP (multi-source, 100 free req/mo); claude-world/trend-pulse (20 free sources, zero auth).
- Posting out: **Upload-Post MCP** (most complete: video/photo/text to all major platforms); Ayrshare via n8n MCP Client Tool node (June 2026); Postiz has an MCP server. TikTok's own official MCP is **ads-only**, not organic posting. No good standalone YouTube-upload MCP.
- Video gen: HeyGen official MCP (avatars); **fal.ai hosted MCP** (1,000+ models, one billing — most useful single video-gen MCP); InVideo's official MCP (`mcp.invideo.io/sse`) for its up-to-30-min agent.
- **gyoridavid/short-video-maker** (MIT, TypeScript): Remotion 4 + whisper.cpp + Kokoro.js + Pexels + ffmpeg exposed as REST **and MCP** — the closest existing thing to this whole pipeline (~1 yr quiet; treat as blueprint).

**Open-source projects — reuse vs build:**
- **MoneyPrinterTurbo** (95.5k stars, pushed 2026-07-03, MIT): the dominant pipeline; Python, shorts-focused, **no publishing step**. Steal architecture, don't adopt (Python, dependency churn).
- **ShortGPT**: last push Feb 2025 — **abandoned**. Skip.
- **OpenMontage** (32.6k stars, new in 2026, AGPL): agentic long-form/documentary pipelines (Archive.org corpus + Remotion) — worth watching for long-form; AGPL matters if productizing.
- RedditVideoMakerBot (active) — niche format only. MoneyPrinter V2 is AGPL. editly/FFCreator/fluent-ffmpeg: stale/archived — avoid.
- **Verdict: build custom in Node.** No maintained project covers trend-ingest → render → publish end-to-end in Node; the moving parts (RSS poll, LLM, TTS, Remotion, aggregator REST call) are each thin. Use MoneyPrinterTurbo and short-video-maker as reference implementations.

## 9. Recommended stack

One Node.js/TypeScript repo, GitHub-Actions cron-driven, no servers required: poll the Google
Trends RSS (+ YouTube mostPopular / Reddit rising) → pick a topic and generate the script with
an LLM (hierarchical expansion for long-form) → synthesize voice with Kokoro (free, word
timestamps via Kokoro-FastAPI; ElevenLabs Flash `with-timestamps` as the premium switch) →
source visuals from Pexels, topping up with FLUX-schnell Ken-Burns images → render 9:16 shorts
in Remotion (free at solo scale, TikTok-caption template) and 16:9 long-form with plain ffmpeg
(ASS captions, sidechain music ducking) → publish everything through Upload-Post's single API
(pre-audited TikTok/IG/YouTube apps), later moving YouTube to the direct Data API after passing
the free compliance audit. Everything runs in a GHA job (CPU-only) at **≈ $20–30/mo all-in**.

| Component | Choice | Cost/mo (1–2 videos/day) |
|---|---|---|
| Trend data | Google Trends RSS + YouTube mostPopular + Reddit rising (+ SerpApi free tier) | $0 |
| Script LLM | Claude/Gemini/GPT API | $1–5 |
| TTS | Kokoro (self-hosted / DeepInfra); ElevenLabs Flash premium | $0–1 (premium: +$5–22) |
| Visuals | Pexels (free) + FLUX schnell images | $1–5 |
| Captions | Word timestamps from TTS; Groq Whisper fallback ($0.04/hr) | $0 |
| Render shorts | Remotion, local/GHA (free ≤3-person co.) | $0 |
| Render long-form | ffmpeg (spawned directly; not fluent-ffmpeg) | $0 |
| Publishing | Upload-Post (~$16/mo; Zernio $6/mo budget alt) | $6–16 |
| Orchestration | GitHub Actions cron | $0 |
| **Total** | | **≈ $10–30/mo** (~$50 with ElevenLabs) |

**Before hard-coding budgets, re-verify** (flagged unverifiable via sandbox proxy): YouTube's
Dec-2025/Jun-2026 quota numbers (check Cloud Console), ElevenLabs Creator credit count,
Shotstack/JSON2Video/Creatomate exact tiers, Veo 3.1 Lite pricing, Upload-Post upper tiers,
and the content policy note: YouTube's July 2025 "inauthentic content" policy demonetizes
mass-templated output — vary voices/visuals/structure per video and keep a human review pass.
