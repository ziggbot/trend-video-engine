# Architecture

## Goal

A fully automated faceless-content pipeline: Google Trends in, ready-to-post
short videos / long videos / Instagram posts out, on a daily GitHub Actions
cron, at $0/month, with a human approval gate where it matters.

## Principles

- **Manifest-driven, no implicit state.** Every run has a `runId`; all stage
  inputs/outputs are recorded in `runs/<runId>/manifest.json`. No stage ever
  globs for "the latest file".
- **Idempotent stages, resumable runs.** A stage that is `done` with all
  outputs still on disk is skipped. `--resume <runId>` re-enters a run and
  only re-executes missing work (renders and TTS are the expensive parts).
- **Channel isolation.** Channels run sequentially; a failure marks that
  channel failed and the run continues. Exit code is 0 if ≥1 package shipped.
- **Adapters behind interfaces.** LLM, TTS, visuals, trends and publishers are
  swappable (`src/adapters/`); `--mock` swaps all of them at the factory level
  (`src/services.ts`) so the full pipeline runs in CI with zero secrets.
- **Free by default.** Paid providers exist only as opt-in adapters.

## Pipeline stages (`src/stages/`)

| Stage | Input → Output | Notes |
|---|---|---|
| `fetch-trends` | regions → `trends-<REGION>.json` | RSS, retries, falls back to last committed snapshot marked `stale` |
| `score-topics` | trends + channel → `ranked.json` | config-driven heuristic; forbidden-topic exclusion; repetition penalty vs recent manifests |
| `plan-content` | channel cadence + weekday → plan items | distinct topics per kind |
| `generate-script` | topic → script JSON | Gemini free tier, JSON mode, zod-validated, one self-repair retry; grounding rules; long-form = outline → per-chapter calls |
| `synthesize-voice` | script → audio + word timestamps | Edge TTS (WordBoundary events) or Kokoro; long-form synthesized per chapter, concatenated with offset-shifted timings |
| `build-captions` | word timings → pages / `.ass` / `.srt` | one pagination feeds Remotion karaoke, ffmpeg ASS burn and platform SRT |
| `gather-visuals` | scene keywords → local media | Pexels video → photo (Ken Burns) → gradient clip; used-asset ledger; download budget |
| `render-short` | assets → `short.mp4` | Remotion 1080×1920@30, karaoke captions, hook overlay, per-channel theme; assets served over a local HTTP range server |
| `render-long` | assets → `long.mp4` | two-pass ffmpeg: normalized segments → concat + ASS subs + side-chain-ducked music (if `assets/music/` exists) |
| `render-images` | carousel → PNGs / thumbnail | Remotion `renderStill` (IgCard 1080×1350, Thumbnail 1280×720) |
| `build-packages` | content → `output/<runId>/…` + zip | ffprobe sanity checks (streams, duration, orientation); applies approval policy |
| `publish` | approved packages → publisher | `manual` publisher completes the state machine today; Upload-Post stub for later |

## Package state machine

```
rendered → packaged → approved ──────→ published
                    ↘ pending_approval ↗      (long-form goes through the gate)
                            ↘ rejected
```

Transitions are validated in `src/orchestrator/manifest.ts`; the approve CLI
(`src/cli.ts approve`) and the `approve.yml` workflow go through the same map.

## Workflows

- **daily-generate.yml** — cron 05:15 UTC: run pipeline → export + push
  dashboard data (legacy file contract preserved for
  `ziggbot/trend-video-engine-dashboard-pages`) → create a prerelease
  `run-<runId>` with the package zips → commit the manifest → prune releases
  older than 30 days.
- **approve.yml** — `workflow_dispatch(run_id, pkg_id, decision)` flips the
  package status and commits the manifest.
- **ci.yml** — typecheck, unit tests, and the mock smoke e2e (real Remotion +
  ffmpeg renders, no secrets).

## Storage decisions

- **Videos → GitHub Releases** (2 GB/asset, stable URLs, browsable review
  surface, free). Not git (repo bloat), not Actions artifacts (90-day cap,
  login-gated URLs).
- **Manifests + trend snapshots + used-asset ledger → committed to the repo.**
  Small JSON; committed trend snapshots double as the stale-fallback source
  when the RSS feed is down, since each CI run starts from a fresh checkout.

## Safety boundaries

- Human approval required for long-form; shorts auto-approve by policy that is
  per-channel configurable (tighten before enabling real auto-posting).
- No auto-posting until a real publisher is deliberately enabled in config.
- Scripts may only claim facts present in the trend's linked news headlines;
  uncertainty must be framed as such. No canned fallback scripts.
- Forbidden-topic lists hard-exclude sensitive subjects per channel.

## Future work (researched, deliberately deferred)

- **Auto-posting** via Upload-Post (aggregator, ~$16/mo when scaling) or direct
  platform APIs after their audits — see `docs/RESEARCH.md` §7.
- **Trend enrichment**: YouTube `mostPopular` (free quota), Reddit rising,
  Wikipedia pageviews as corroborating signals in scoring.
- **AI visuals**: FLUX-schnell images (~$0.006/image) behind a budget flag
  (`src/adapters/visuals/flux.ts` placeholder).
- **Official Google Trends API** (still gated alpha) as an RSS replacement.
