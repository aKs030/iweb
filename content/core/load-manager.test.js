import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppLoadManager } from './load-manager.js';
import { EVENTS, fire } from './events.js';

// Mock events
vi.mock('./events.js', () => ({
  EVENTS: { LOADING_UNBLOCKED: 'app:loadingUnblocked' },
  fire: vi.fn(),
}));

describe('AppLoadManager', () => {
  // Since it's a singleton, we need to clear it somehow or just test the state transitions carefully.
  // The current implementation uses a closure variable `pending` which is not exposed for resetting.
  // We have to rely on `unblock` to clear state.

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear any existing blocks
    const pending = AppLoadManager.getPending();
    pending.forEach(name => AppLoadManager.unblock(name));
  });

  it('should start unblocked', () => {
    expect(AppLoadManager.isBlocked()).toBe(false);
    expect(AppLoadManager.getPending()).toEqual([]);
  });

  it('should block and unblock', () => {
    AppLoadManager.block('test-component');
    expect(AppLoadManager.isBlocked()).toBe(true);
    expect(AppLoadManager.getPending()).toContain('test-component');

    AppLoadManager.unblock('test-component');
    expect(AppLoadManager.isBlocked()).toBe(false);
    expect(AppLoadManager.getPending()).toEqual([]);
  });

  it('should fire event when all blocks are removed', () => {
    AppLoadManager.block('A');
    AppLoadManager.block('B');

    expect(fire).not.toHaveBeenCalled();

    AppLoadManager.unblock('A');
    expect(fire).not.toHaveBeenCalled();

    AppLoadManager.unblock('B');
    expect(fire).toHaveBeenCalledWith(EVENTS.LOADING_UNBLOCKED);
  });

  it('should handle duplicate blocks correctly (Set behavior)', () => {
    AppLoadManager.block('A');
    AppLoadManager.block('A');
    expect(AppLoadManager.getPending().length).toBe(1);

    AppLoadManager.unblock('A');
    expect(AppLoadManager.isBlocked()).toBe(false);
  });
});
