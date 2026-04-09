# Architecture

## Goal
Build a semi-automatic content engine that turns trending topics into short-form YouTube videos.

## MVP boundaries

Human approval is required before publishing.
No blind auto-posting.
No scraping or reuse of copyrighted video without a clear source policy.
No fabricated factual claims.

## Stages

### 1. Trend discovery
Inputs:
- Google Trends
- news/trending APIs later

Outputs:
- ranked topic list

### 2. Topic scoring
Heuristics:
- novelty
- emotional pull
- explainability in 30 seconds
- likely CTR
- relevance to chosen niche

### 3. Script generation
Outputs:
- title ideas
- 1-line hook
- 30-second script
- CTA

### 4. Voice generation
Outputs:
- audio file

### 5. Video assembly
Possible approaches:
- ffmpeg with caption cards
- HTML/CSS scene renderer + capture
- Remotion later

### 6. Review gate
Human checks:
- factual accuracy
- tone
- clarity
- not cringe
- safe to publish

### 7. Publish
- YouTube upload API
- thumbnail later
- scheduling later

## Practical next step
Build a script generator + content brief creator first.
Then add voice generation.
Then add video rendering.
Then add YouTube upload.
