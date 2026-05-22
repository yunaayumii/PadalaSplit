export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = {
  id: string;
  timestamp: string;
  level: LogLevel;
  scope: string;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name?: string;
    message: string;
    stack?: string;
  };
};

const LOG_STORAGE_KEY = 'padalasplit.debugLogs';
const LOG_EVENT_NAME = 'padalasplit:debugLogs';
const MAX_LOGS = 120;
let memoryLogs: LogEntry[] = [];

export const getLogEntries = (): LogEntry[] => {
  const storage = getLocalStorage();
  if (!storage) return memoryLogs;

  try {
    const rawLogs = storage.getItem(LOG_STORAGE_KEY);
    if (!rawLogs) return [];
    const parsed = JSON.parse(rawLogs);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const clearLogEntries = () => {
  const storage = getLocalStorage();
  memoryLogs = [];
  if (storage) storage.removeItem(LOG_STORAGE_KEY);
  emitLogChange();
};

export const subscribeLogEntries = (listener: (logs: LogEntry[]) => void) => {
  if (typeof window === 'undefined') return () => {};

  const handleChange = () => listener(getLogEntries());
  window.addEventListener(LOG_EVENT_NAME, handleChange);
  window.addEventListener('storage', handleChange);

  return () => {
    window.removeEventListener(LOG_EVENT_NAME, handleChange);
    window.removeEventListener('storage', handleChange);
  };
};

export const logDebug = (scope: string, message: string, context?: Record<string, unknown>) =>
  writeLog('debug', scope, message, context);

export const logInfo = (scope: string, message: string, context?: Record<string, unknown>) =>
  writeLog('info', scope, message, context);

export const logWarn = (scope: string, message: string, context?: Record<string, unknown>, error?: unknown) =>
  writeLog('warn', scope, message, context, error);

export const logError = (scope: string, message: string, error?: unknown, context?: Record<string, unknown>) =>
  writeLog('error', scope, message, context, error);

export const logsToText = (logs: LogEntry[]) =>
  logs
    .map((entry) =>
      [
        `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.scope}: ${entry.message}`,
        entry.context ? `context=${JSON.stringify(entry.context)}` : '',
        entry.error ? `error=${entry.error.name ? `${entry.error.name}: ` : ''}${entry.error.message}` : '',
        entry.error?.stack ? `stack=${entry.error.stack}` : ''
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n\n');

const writeLog = (
  level: LogLevel,
  scope: string,
  message: string,
  context?: Record<string, unknown>,
  error?: unknown
) => {
  const entry: LogEntry = {
    id: createLogId(),
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    context: context ? sanitizeContext(context) : undefined,
    error: error ? serializeError(error) : undefined
  };

  writeToConsole(entry);

  const storage = getLocalStorage();
  if (!storage) {
    memoryLogs = [entry, ...memoryLogs].slice(0, MAX_LOGS);
    return entry;
  }

  try {
    const logs = [entry, ...getLogEntries()].slice(0, MAX_LOGS);
    memoryLogs = logs;
    storage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
    emitLogChange();
  } catch {
    memoryLogs = [entry, ...memoryLogs].slice(0, MAX_LOGS);
    // Keep console logging even when storage is unavailable.
  }

  return entry;
};

const getLocalStorage = () => {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage || null;
  } catch {
    return null;
  }
};

const emitLogChange = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LOG_EVENT_NAME));
};

const createLogId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `log-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const writeToConsole = (entry: LogEntry) => {
  const payload = {
    scope: entry.scope,
    context: entry.context,
    error: entry.error
  };
  const consoleMessage = `[PadalaSplit] ${entry.message}`;

  if (entry.level === 'error') {
    console.error(consoleMessage, payload);
  } else if (entry.level === 'warn') {
    console.warn(consoleMessage, payload);
  } else if (entry.level === 'info') {
    console.info(consoleMessage, payload);
  } else {
    console.debug(consoleMessage, payload);
  }
};

const serializeError = (error: unknown): LogEntry['error'] => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    message: typeof error === 'string' ? error : safeStringify(error)
  };
};

const sanitizeContext = (context: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(context).map(([key, value]) => [key, sanitizeValue(key, value)]));

const sanitizeValue = (key: string, value: unknown): unknown => {
  if (/secret|seed|token|key|password/i.test(key) && typeof value === 'string') {
    return maskLongString(value);
  }

  if (typeof value === 'string') {
    if (/^G[A-Z0-9]{55}$/.test(value) || /^C[A-Z0-9]{55}$/.test(value)) {
      return `${value.slice(0, 6)}...${value.slice(-4)}`;
    }
    return value.length > 600 ? `${value.slice(0, 600)}...` : value;
  }

  if (typeof value === 'bigint') return value.toString();

  if (Array.isArray(value)) return value.map((item) => sanitizeValue(key, item));

  if (value && typeof value === 'object') {
    return sanitizeContext(value as Record<string, unknown>);
  }

  return value;
};

const maskLongString = (value: string) =>
  value.length <= 10 ? '[redacted]' : `${value.slice(0, 4)}...${value.slice(-4)}`;

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};
