// src/utils/log.js
//
// Tiny, dependency-free logger with level gating and a pluggable sink for
// shipping warn/error events to remote sinks (Sentry, bug-report buffer, etc).
//
// Reads thresholds from import.meta.env.VITE_LOG_LEVEL or falls back to
// 'info' in dev and 'warn' in prod. Each level wraps the native console
// equivalent so DevTools still attributes file:line correctly.

/**
 * @typedef {'debug'|'info'|'warn'|'error'} LogLevel
 * @typedef {(level: LogLevel, scope: string, args: unknown[]) => void} LogSink
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 }

const mode = (import.meta?.env?.MODE) || 'development'
const envLevel = (import.meta?.env?.VITE_LOG_LEVEL || '').toLowerCase()
const defaultLevel = mode === 'production' ? 'warn' : 'info'
const activeLevel = LEVELS[envLevel] ? envLevel : defaultLevel
const threshold = LEVELS[activeLevel]

/** @type {LogSink} */
let sink = () => {}

/**
 * Subscribe to log events. Replaces any previous sink.
 * @param {LogSink} fn
 */
export function setSink(fn) {
  sink = typeof fn === 'function' ? fn : () => {}
}

function emit(level, scope, args) {
  if (LEVELS[level] < threshold) return
  const prefix = scope ? `[${scope}]` : ''
  // eslint-disable-next-line no-console
  const c = console[level] || console.log
  if (prefix) c(prefix, ...args)
  else c(...args)
  try {
    sink(level, scope, args)
  } catch {
    // swallow sink errors so logging never breaks the caller
  }
}

/**
 * @typedef {Object} Logger
 * @property {(...args: unknown[]) => void} debug
 * @property {(...args: unknown[]) => void} info
 * @property {(...args: unknown[]) => void} warn
 * @property {(...args: unknown[]) => void} error
 */

/**
 * Create a scoped logger. Messages are prefixed with `[scope]`.
 * @param {string} [scope]
 * @returns {Logger}
 */
export function createLogger(scope = '') {
  return {
    debug: (...args) => emit('debug', scope, args),
    info:  (...args) => emit('info',  scope, args),
    warn:  (...args) => emit('warn',  scope, args),
    error: (...args) => emit('error', scope, args)
  }
}

/** Default unscoped logger instance. */
export const log = createLogger('')

export default log
