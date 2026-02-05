import { describe, it, expect, vi } from 'vitest';
import { debounce, sleep, getElementById } from './utils';

describe('Basis-Hilfsprogramme (Core Utilities)', () => {
  describe('debounce', () => {
    it('sollte Funktionsaufrufe entprellen (standardmäßig nur trailing)', () => {
      vi.useFakeTimers();
      const func = vi.fn();
      const debouncedFunc = debounce(func, 100);

      debouncedFunc();
      debouncedFunc();
      debouncedFunc();

      expect(func).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(func).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('sollte führende Ausführung (leading) behandeln', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01')); // Sicherstellen, dass now > 0 ist

      const func = vi.fn();
      const debouncedFunc = debounce(func, 100, {
        leading: true,
        trailing: false,
      });

      // Erster Aufruf: Zeit seit letztem Aufruf (riesig) > Verzögerung. Führt aus.
      debouncedFunc();
      expect(func).toHaveBeenCalledTimes(1);

      // Zweiter Aufruf sofort: Zeit seit letztem Aufruf (0) < Verzögerung. Ignoriert (trailing=false).
      debouncedFunc();
      expect(func).toHaveBeenCalledTimes(1);

      // Zeit über die Verzögerung hinaus vorstellen
      vi.advanceTimersByTime(101);

      // Dritter Aufruf: Zeit seit letztem Aufruf (101) > Verzögerung. Führt aus.
      debouncedFunc();
      expect(func).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe('sleep', () => {
    it('sollte die angegebene Zeit warten', async () => {
      vi.useFakeTimers();
      const promise = sleep(1000);

      vi.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();

      vi.useRealTimers();
    });
  });

  describe('DOM Hilfsprogramme', () => {
    it('getElementById sollte das Element zurückgeben, wenn es existiert', () => {
      const div = document.createElement('div');
      div.id = 'test-id';
      document.body.appendChild(div);

      expect(getElementById('test-id')).toBe(div);
      expect(getElementById('nicht-existent')).toBeNull();

      document.body.removeChild(div);
    });
  });
});
