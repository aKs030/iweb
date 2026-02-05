import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RobotStateManager } from './RobotStateManager';
import { ROBOT_EVENTS } from '../constants/events';

describe('RobotStateManager', () => {
  let stateManager;

  beforeEach(() => {
    // Mock localStorage
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, value) => {
        store[key] = String(value);
      }),
      clear: vi.fn(() => {
        for (const key in store) delete store[key];
      }),
    });

    stateManager = new RobotStateManager();
  });

  it('sollte mit Standardwerten initialisiert werden', () => {
    const state = stateManager.getState();
    expect(state.mood).toBe('normal');
    expect(state.analytics.interactions).toBe(0);
  });

  it('sollte State-Updates verarbeiten und Events emitten', () => {
    const listener = vi.fn();
    stateManager.subscribe(ROBOT_EVENTS.STATE_CHANGED, listener);

    stateManager.setState({ mood: 'happy' });

    expect(stateManager.getState().mood).toBe('happy');
    expect(listener).toHaveBeenCalled();
  });

  it('sollte Interactions tracken und speichern', () => {
    stateManager.trackInteraction();

    expect(stateManager.getState().analytics.interactions).toBe(1);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'robot-interactions',
      '1',
    );
  });

  it('sollte Section Visits tracken (ohne Duplikate)', () => {
    stateManager.trackSectionVisit('hero');
    stateManager.trackSectionVisit('about');
    stateManager.trackSectionVisit('hero'); // Duplicate

    expect(stateManager.getState().analytics.sectionsVisited).toEqual([
      'hero',
      'about',
    ]);
  });
});
