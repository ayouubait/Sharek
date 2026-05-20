// =====================================================================
// logger - DEV-only console output. In production, errors go to Sentry
// (or any sink you wire into `reportError`).
// =====================================================================
//
// Usage:
//   import { logger } from '@/lib/logger';
//   logger.error('Avatar upload failed', err);
//   logger.warn('Stale session');
//   logger.info('Resource published');

const isDev = import.meta.env.DEV;

type Level = 'debug' | 'info' | 'warn' | 'error';

function reportError(_err: unknown, _ctx?: Record<string, unknown>): void {
  // Wire to Sentry / your error tracker here.
  // Example:
  //   if (window.Sentry) window.Sentry.captureException(_err, { extra: _ctx });
}

function emit(level: Level, args: unknown[]): void {
  if (isDev) {
    // eslint-disable-next-line no-console
    (console[level] ?? console.log).apply(console, args);
  }
  if (level === 'error') {
    const [first, ...rest] = args;
    reportError(first, rest.length ? { extra: rest } : undefined);
  }
}

export const logger = {
  debug: (...args: unknown[]) => emit('debug', args),
  info:  (...args: unknown[]) => emit('info', args),
  warn:  (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => emit('error', args),
};
