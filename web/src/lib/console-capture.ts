/**
 * Console Log Capture
 *
 * Captures console logs, warnings, and errors for debugging feedback
 */

export interface CapturedLog {
  type: 'log' | 'warn' | 'error' | 'info' | 'debug';
  args: any[];
  timestamp: number;
  stack?: string;
}

// Store logs in a circular buffer (keep last 100 logs)
const MAX_LOGS = 100;
const capturedLogs: CapturedLog[] = [];

export function setupConsoleCapture() {
  if (typeof window === 'undefined') return;

  // Expose captured logs globally
  (window as any).__consoleLogs = capturedLogs;

  // Save original console methods
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;
  const originalDebug = console.debug;

  // Helper to capture and store logs
  function captureLog(type: CapturedLog['type'], args: any[]) {
    const log: CapturedLog = {
      type,
      args: args.map(arg => {
        // Serialize complex objects
        try {
          if (typeof arg === 'object' && arg !== null) {
            return JSON.parse(JSON.stringify(arg));
          }
          return arg;
        } catch (e) {
          return String(arg);
        }
      }),
      timestamp: Date.now(),
    };

    // Add stack trace for errors
    if (type === 'error') {
      const error = new Error();
      log.stack = error.stack;
    }

    // Add to circular buffer
    capturedLogs.push(log);
    if (capturedLogs.length > MAX_LOGS) {
      capturedLogs.shift();
    }
  }

  // Override console methods
  console.log = function(...args: any[]) {
    captureLog('log', args);
    originalLog.apply(console, args);
  };

  console.warn = function(...args: any[]) {
    captureLog('warn', args);
    originalWarn.apply(console, args);
  };

  console.error = function(...args: any[]) {
    captureLog('error', args);
    originalError.apply(console, args);
  };

  console.info = function(...args: any[]) {
    captureLog('info', args);
    originalInfo.apply(console, args);
  };

  console.debug = function(...args: any[]) {
    captureLog('debug', args);
    originalDebug.apply(console, args);
  };

  // Also capture window errors
  window.addEventListener('error', (event) => {
    captureLog('error', [
      event.message,
      `at ${event.filename}:${event.lineno}:${event.colno}`,
    ]);
  });

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    captureLog('error', [
      'Unhandled Promise Rejection:',
      event.reason,
    ]);
  });
}

export function getCapturedLogs(): CapturedLog[] {
  return [...capturedLogs];
}

export function clearCapturedLogs() {
  capturedLogs.length = 0;
}
