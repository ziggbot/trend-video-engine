import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ChannelsConfigSchema, VoicesConfigSchema, ScoringConfigSchema, ChannelSchema } from '../../src/types/channel.js';

describe('shipped config', () => {
  it('channels.json validates and voices resolve', () => {
    const channels = ChannelsConfigSchema.parse(JSON.parse(readFileSync('config/channels.json', 'utf8')));
    const voices = VoicesConfigSchema.parse(JSON.parse(readFileSync('config/voices.json', 'utf8')));
    expect(channels.channels.length).toBeGreaterThan(0);
    for (const ch of channels.channels) {
      expect(voices[ch.voice], `voice ${ch.voice} for channel ${ch.id}`).toBeDefined();
    }
  });

  it('scoring.json validates with weights for both languages', () => {
    const scoring = ScoringConfigSchema.parse(JSON.parse(readFileSync('config/scoring.json', 'utf8')));
    expect(scoring.emotionKeywords.sv.length).toBeGreaterThan(0);
    expect(scoring.emotionKeywords.en.length).toBeGreaterThan(0);
  });

  it('rejects an invalid channel', () => {
    expect(() => ChannelSchema.parse({ id: 'BAD ID!', language: 'de' })).toThrow();
  });
});
