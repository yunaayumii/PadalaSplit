import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLogEntries, getLogEntries, logError, logInfo, logsToText } from '../src/lib/logger';

beforeEach(() => {
  const storage = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key)
    }
  });
  clearLogEntries();
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  clearLogEntries();
  vi.restoreAllMocks();
});

describe('debug logger', () => {
  it('persists structured logs in newest-first order', () => {
    logInfo('test.first', 'First message.');
    logError('test.second', 'Second message.', new Error('boom'));

    const logs = getLogEntries();

    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({
      level: 'error',
      scope: 'test.second',
      message: 'Second message.'
    });
    expect(logs[0].error?.message).toBe('boom');
  });

  it('masks addresses and secret-like context values', () => {
    logInfo('test.context', 'Context message.', {
      publicKey: 'GA3E3MZTNAE4VT4Q3NVMZWGTG67DRTUQBVZWLH3TLRWI3ISU37QJLFAA',
      apiToken: 'super-secret-token-value'
    });

    const [entry] = getLogEntries();

    expect(entry.context?.publicKey).toBe('GA3E...LFAA');
    expect(entry.context?.apiToken).toBe('supe...alue');
  });

  it('formats logs for copyable bug reports', () => {
    logError('test.copy', 'Copy message.', new Error('copy failure'), { bucketId: 'bucket-1' });

    expect(logsToText(getLogEntries())).toContain('ERROR test.copy: Copy message.');
    expect(logsToText(getLogEntries())).toContain('bucket-1');
    expect(logsToText(getLogEntries())).toContain('copy failure');
  });
});
