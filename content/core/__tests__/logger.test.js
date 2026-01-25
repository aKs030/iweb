/**
 * Tests for logger.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLogger, LOG_LEVELS } from '../logger.js';

describe('Logger', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = {
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    };
  });

  it('should create logger with category', () => {
    const logger = createLogger('TestCategory');
    expect(logger.category).toBe('TestCategory');
    expect(logger.prefix).toBe('[TestCategory]');
  });

  it('should log error messages', () => {
    const logger = createLogger('Test', { level: LOG_LEVELS.error });
    logger.error('Test error', { code: 500 });

    expect(consoleSpy.error).toHaveBeenCalledWith('[Test]', 'Test error', {
      code: 500,
    });
  });

  it('should respect log level', () => {
    const logger = createLogger('Test', { level: LOG_LEVELS.error });

    logger.error('Error message');
    logger.warn('Warning message');
    logger.info('Info message');

    expect(consoleSpy.error).toHaveBeenCalled();
    expect(consoleSpy.warn).not.toHaveBeenCalled();
    expect(consoleSpy.info).not.toHaveBeenCalled();
  });

  it('should support performance timing', () => {
    const logger = createLogger('Test', {
      level: LOG_LEVELS.debug,
      performance: true,
    });

    const timeSpy = vi.spyOn(console, 'time').mockImplementation(() => {});
    const timeEndSpy = vi
      .spyOn(console, 'timeEnd')
      .mockImplementation(() => {});

    logger.time('operation');
    logger.timeEnd('operation');

    expect(timeSpy).toHaveBeenCalledWith('[Test] operation');
    expect(timeEndSpy).toHaveBeenCalledWith('[Test] operation');
  });

  it('should support grouping', () => {
    const logger = createLogger('Test', { level: LOG_LEVELS.debug });

    const groupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    const groupEndSpy = vi
      .spyOn(console, 'groupEnd')
      .mockImplementation(() => {});

    logger.group('Test Group');
    logger.info('Inside group');
    logger.groupEnd();

    expect(groupSpy).toHaveBeenCalledWith('[Test] Test Group');
    expect(groupEndSpy).toHaveBeenCalled();
  });
});
