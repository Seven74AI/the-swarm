import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLogger, log, LOG_BUFFER_SIZE, type LogLevel } from '../../src/utils/log';

function fakeConsole() {
  return { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
}

const LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug'];

describe('log', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    log.clear();
  });

  it('prefixes every printed entry with [scope]', () => {
    const out = fakeConsole();
    const logger = createLogger({ dev: true, debugParam: () => false, sink: out });

    for (const level of LEVELS) logger[level]('save', `${level} message`);

    for (const level of LEVELS) {
      expect(out[level]).toHaveBeenCalledTimes(1);
      expect(out[level].mock.calls[0][0]).toBe(`[save] ${level} message`);
    }
  });

  it('passes detail arguments through to the console', () => {
    const out = fakeConsole();
    const logger = createLogger({ dev: false, debugParam: () => false, sink: out });
    const err = new Error('boom');

    logger.error('bus', 'listener failed', err);

    expect(out.error.mock.calls[0]).toContain(err);
  });

  it('stores every level in the ring buffer, printed or not', () => {
    const out = fakeConsole();
    const logger = createLogger({ dev: false, debugParam: () => false, sink: out });

    for (const level of LEVELS) logger[level]('scope', level);

    const entries = logger.entries();
    expect(entries.map((e) => e.level)).toEqual(LEVELS);
    for (const e of entries) {
      expect(e.scope).toBe('scope');
      expect(e.message).toBe(e.level);
      expect(typeof e.time).toBe('number');
    }
  });

  it('keeps only the newest LOG_BUFFER_SIZE entries', () => {
    const logger = createLogger({ dev: false, debugParam: () => false, sink: fakeConsole() });
    const total = LOG_BUFFER_SIZE + 25;

    for (let i = 0; i < total; i++) logger.warn('ring', `m${i}`);

    const entries = logger.entries();
    expect(entries).toHaveLength(LOG_BUFFER_SIZE);
    expect(entries[0].message).toBe(`m${total - LOG_BUFFER_SIZE}`);
    expect(entries[entries.length - 1].message).toBe(`m${total - 1}`);
  });

  it('entries() returns a copy that callers cannot corrupt', () => {
    const logger = createLogger({ dev: false, debugParam: () => false, sink: fakeConsole() });
    logger.warn('a', 'one');

    const copy = logger.entries();
    copy.pop();

    expect(logger.entries()).toHaveLength(1);
  });

  it('production build: prints error and warn only', () => {
    const out = fakeConsole();
    const logger = createLogger({ dev: false, debugParam: () => false, sink: out });

    for (const level of LEVELS) logger[level]('p', level);

    expect(out.error).toHaveBeenCalled();
    expect(out.warn).toHaveBeenCalled();
    expect(out.info).not.toHaveBeenCalled();
    expect(out.debug).not.toHaveBeenCalled();
  });

  it('production build with ?debug=1: prints info but still not debug', () => {
    const out = fakeConsole();
    const logger = createLogger({ dev: false, debugParam: () => true, sink: out });

    logger.info('p', 'info');
    logger.debug('p', 'debug');

    expect(out.info).toHaveBeenCalled();
    expect(out.debug).not.toHaveBeenCalled();
  });

  it('dev build: prints every level', () => {
    const out = fakeConsole();
    const logger = createLogger({ dev: true, debugParam: () => false, sink: out });

    for (const level of LEVELS) logger[level]('d', level);

    for (const level of LEVELS) expect(out[level]).toHaveBeenCalled();
  });

  it('reads ?debug=1 from the page URL by default', () => {
    const out = fakeConsole();
    window.history.replaceState(null, '', '/?debug=1');
    try {
      const logger = createLogger({ dev: false, sink: out });
      logger.info('url', 'shown');
      expect(out.info).toHaveBeenCalled();
    } finally {
      window.history.replaceState(null, '', '/');
    }
    const logger = createLogger({ dev: false, sink: out });
    logger.info('url', 'hidden');
    expect(out.info).toHaveBeenCalledTimes(1);
  });

  it('the shared log instance writes to console', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    log.error('shared', 'reached console');

    expect(spy).toHaveBeenCalledWith('[shared] reached console');
    expect(log.entries().some((e) => e.scope === 'shared')).toBe(true);
  });
});
