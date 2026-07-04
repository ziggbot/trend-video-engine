import { randomBytes } from 'node:crypto';

export function randToken(len = 4): string {
  return randomBytes(8).toString('base64url').replace(/[^a-z0-9]/gi, '').slice(0, len).toLowerCase() || 'x0y1';
}

export function makeRunId(now = new Date()): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}-${p(now.getUTCHours())}${p(now.getUTCMinutes())}-${randToken(4)}`;
}

export function makePkgId(channelId: string, kind: string): string {
  return `${channelId}--${kind}--${randToken(4)}`;
}
