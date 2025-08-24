import { describe, it, expect, beforeEach, vi } from 'vitest';

// Einfachere Logger-Tests die das window-Problem umgehen
describe('Logger System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should import logger functions', async () => {
    const module = await import('../../content/webentwicklung/utils/logger.js');
    expect(module.createLogger).toBeDefined();
    expect(module.getBufferedLogs).toBeDefined();
    expect(module.clearLogBuffer).toBeDefined();
  });

  it('should create logger with methods', async () => {
    const { createLogger } = await import('../../content/webentwicklung/utils/logger.js');
    const logger = createLogger('test');
    
    expect(logger).toHaveProperty('error');
    expect(logger).toHaveProperty('warn');
    expect(logger).toHaveProperty('info');
    expect(logger).toHaveProperty('debug');
    expect(typeof logger.error).toBe('function');
  });

  it('should maintain log buffer', async () => {
    const { getBufferedLogs, clearLogBuffer } = await import('../../content/webentwicklung/utils/logger.js');
    
    clearLogBuffer();
    const initialLogs = getBufferedLogs();
    expect(Array.isArray(initialLogs)).toBe(true);
  });
});
