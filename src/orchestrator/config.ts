import { join } from 'node:path';
import {
  Channel,
  ChannelsConfigSchema,
  ScoringConfigSchema,
  VoicesConfigSchema
} from '../types/channel';
import { readJson } from '../lib/files';
import { AppConfig } from './context';
import { Logger } from './logger';

/**
 * Load and validate config. An invalid channel disables itself with a warning;
 * invalid voices.json/scoring.json are fatal (they are shared by all channels).
 */
export async function loadConfig(rootDir: string, log: Logger): Promise<AppConfig> {
  const rawChannels = await readJson<{ channels: unknown[] }>(join(rootDir, 'config/channels.json'));
  const channels: Channel[] = [];
  for (const raw of rawChannels.channels ?? []) {
    const parsed = ChannelsConfigSchema.shape.channels.element.safeParse(raw);
    if (parsed.success) {
      channels.push(parsed.data);
    } else {
      const id = (raw as { id?: string })?.id ?? '<unknown>';
      log.warn(`config: channel "${id}" is invalid and was disabled: ${parsed.error.issues[0]?.message}`);
    }
  }

  const voices = VoicesConfigSchema.parse(await readJson(join(rootDir, 'config/voices.json')));
  const scoring = ScoringConfigSchema.parse(await readJson(join(rootDir, 'config/scoring.json')));

  for (const ch of channels) {
    if (!voices[ch.voice]) {
      log.warn(`config: channel "${ch.id}" references unknown voice "${ch.voice}" and was disabled`);
      ch.enabled = false;
    }
  }

  return { channels, voices, scoring };
}
