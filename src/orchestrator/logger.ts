import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface Logger {
  info(msg: string, extra?: Record<string, unknown>): void;
  warn(msg: string, extra?: Record<string, unknown>): void;
  error(msg: string, extra?: Record<string, unknown>): void;
  child(scope: string): Logger;
}

export function createLogger(logFile: string, scope = 'run'): Logger {
  mkdirSync(dirname(logFile), { recursive: true });
  const write = (level: string, msg: string, extra?: Record<string, unknown>) => {
    const entry = { ts: new Date().toISOString(), level, scope, msg, ...extra };
    const line = JSON.stringify(entry);
    try {
      appendFileSync(logFile, line + '\n');
    } catch {
      // logging must never break the pipeline
    }
    const prefix = `[${scope}]`;
    if (level === 'error') console.error(prefix, msg);
    else if (level === 'warn') console.warn(prefix, msg);
    else console.log(prefix, msg);
  };
  return {
    info: (msg, extra) => write('info', msg, extra),
    warn: (msg, extra) => write('warn', msg, extra),
    error: (msg, extra) => write('error', msg, extra),
    child: (childScope: string) => createLogger(logFile, `${scope}:${childScope}`)
  };
}

export function serializeError(err: unknown): string {
  if (err instanceof Error) return `${err.message}${err.stack ? `\n${err.stack.split('\n').slice(1, 4).join('\n')}` : ''}`;
  return String(err);
}
