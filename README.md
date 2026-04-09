# Trend Video Engine

Semi-automatisk pipeline för korta trendvideos till YouTube.

## MVP-flöde

1. Hämta trendande ämnen
2. Välj ett ämne med publikpotential
3. Generera titel, hook och 30-sekunders manus
4. Generera voiceover
5. Skapa enkel short-video med text + bakgrund + captions
6. Presentera utkast för mänskligt godkännande
7. Publicera till YouTube först efter approve

## Varför semi-auto först

- minskar risken för felaktigheter
- minskar risken för lågkvalitativ spam
- ger bättre känsla för tonalitet och publikrespons
- enklare att debugga pipeline steg för steg

## Tänkbar stack

- Trends: Google Trends eller annan trendkälla
- LLM: manus, titel, hook, beskrivning
- TTS: voiceover
- ffmpeg / Remotion / enkel HTML-rendering för video
- YouTube Data API för upload
- Scheduler senare

## Första versionen bör kunna

- skapa ett content brief
- skapa manusutkast
- skapa metadatautkast
- spara allt lokalt i JSON/Markdown
- senare exportera till video-jobb
