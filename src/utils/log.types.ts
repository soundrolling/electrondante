// Type-only companion for src/utils/log.js — imported by future TS callers.
// Kept separate so the JS implementation stays untouched during gradual migration.
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogSink = (level: LogLevel, scope: string, args: unknown[]) => void;
