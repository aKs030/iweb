import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  debounce,
  sleep,
  getElementById,
  throttle,
  onDOMReady,
  upsertHeadLink,
  upsertMeta,
  applyCanonicalLinks,
} from './utils';

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

  describe('throttle', () => {
    it('sollte Funktionsaufrufe drosseln (standardmäßig leading und trailing)', () => {
      vi.useFakeTimers();
      const func = vi.fn();
      const throttledFunc = throttle(func, 100);

      // Erster Aufruf: Führt sofort aus (leading)
      throttledFunc();
      expect(func).toHaveBeenCalledTimes(1);

      // Weitere Aufrufe während der Wartezeit
      throttledFunc();
      throttledFunc();
      expect(func).toHaveBeenCalledTimes(1);

      // Nach der Wartezeit: trailing Aufruf
      vi.advanceTimersByTime(100);
      expect(func).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('sollte nur trailing Ausführung unterstützen', () => {
      vi.useFakeTimers();
      const func = vi.fn();
      const throttledFunc = throttle(func, 100, {
        leading: false,
        trailing: true,
      });

      // Erster Aufruf: Kein leading, inThrottle wird true
      throttledFunc();
      expect(func).not.toHaveBeenCalled();

      // Zweiter Aufruf während throttle: speichert args für trailing
      throttledFunc();
      expect(func).not.toHaveBeenCalled();

      // Nach der Wartezeit: trailing Aufruf mit den zuletzt gespeicherten args
      vi.advanceTimersByTime(100);
      expect(func).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('sollte nur leading Ausführung unterstützen', () => {
      vi.useFakeTimers();
      const func = vi.fn();
      const throttledFunc = throttle(func, 100, {
        leading: true,
        trailing: false,
      });

      // Erster Aufruf: Führt sofort aus (leading)
      throttledFunc();
      expect(func).toHaveBeenCalledTimes(1);

      // Weitere Aufrufe während der Wartezeit
      throttledFunc();
      expect(func).toHaveBeenCalledTimes(1);

      // Nach der Wartezeit: Kein trailing Aufruf
      vi.advanceTimersByTime(100);
      expect(func).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('sollte mit cancel abgebrochen werden können', () => {
      vi.useFakeTimers();
      const func = vi.fn();
      const throttledFunc = throttle(func, 100);

      throttledFunc();
      throttledFunc.cancel();

      vi.advanceTimersByTime(100);
      // Nur der erste (leading) Aufruf sollte ausgeführt worden sein
      expect(func).toHaveBeenCalledTimes(1);

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

    it('getElementById sollte null zurückgeben, wenn id leer ist', () => {
      expect(getElementById('')).toBeNull();
      expect(getElementById(null)).toBeNull();
    });
  });

  describe('onDOMReady', () => {
    it('sollte Callback sofort ausführen, wenn DOM bereits geladen ist', () => {
      const callback = vi.fn();
      // readyState ist 'complete' in jsdom nach dem Laden
      onDOMReady(callback);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('sollte Callback bei DOMContentLoaded ausführen, wenn DOM lädt', () => {
      const callback = vi.fn();

      // readyState auf 'loading' setzen
      Object.defineProperty(document, 'readyState', {
        writable: true,
        value: 'loading',
      });

      onDOMReady(callback);
      expect(callback).not.toHaveBeenCalled();

      // DOMContentLoaded Event auslösen
      document.dispatchEvent(new Event('DOMContentLoaded'));
      expect(callback).toHaveBeenCalledTimes(1);

      // readyState zurücksetzen
      Object.defineProperty(document, 'readyState', {
        writable: true,
        value: 'complete',
      });
    });
  });

  describe('HEAD Manipulation', () => {
    beforeEach(() => {
      // Head vor jedem Test leeren
      document.head.innerHTML = '';
    });

    afterEach(() => {
      // Head nach jedem Test leeren
      document.head.innerHTML = '';
    });

    describe('upsertHeadLink', () => {
      it('sollte ein neues link Element erstellen', () => {
        const link = upsertHeadLink({
          rel: 'stylesheet',
          href: '/styles.css',
        });

        expect(link).not.toBeNull();
        expect(link?.rel).toBe('stylesheet');
        expect(link?.href).toContain('/styles.css');
        expect(document.head.contains(link)).toBe(true);
      });

      it('sollte existierendes link Element zurückgeben', () => {
        const link1 = upsertHeadLink({
          rel: 'stylesheet',
          href: '/styles.css',
        });
        const link2 = upsertHeadLink({
          rel: 'stylesheet',
          href: '/styles.css',
        });

        expect(link1).toBe(link2);
        expect(document.head.querySelectorAll('link').length).toBe(1);
      });

      it('sollte null zurückgeben, wenn href oder rel fehlt', () => {
        expect(upsertHeadLink({ rel: 'stylesheet' })).toBeNull();
        expect(upsertHeadLink({ href: '/styles.css' })).toBeNull();
        expect(upsertHeadLink({})).toBeNull();
      });

      it('sollte optionale Attribute unterstützen', () => {
        const link = upsertHeadLink({
          rel: 'preload',
          href: '/font.woff2',
          as: 'font',
          crossOrigin: 'anonymous',
          id: 'font-preload',
        });

        expect(link?.as).toBe('font');
        expect(link?.crossOrigin).toBe('anonymous');
        expect(link?.id).toBe('font-preload');
      });

      it('sollte dataset Attribute unterstützen', () => {
        const link = upsertHeadLink({
          rel: 'stylesheet',
          href: '/styles.css',
          dataset: { theme: 'dark', version: '1.0' },
        });

        expect(link?.dataset.theme).toBe('dark');
        expect(link?.dataset.version).toBe('1.0');
      });

      it('sollte zusätzliche Attribute unterstützen', () => {
        const link = upsertHeadLink({
          rel: 'stylesheet',
          href: '/styles.css',
          attrs: { media: 'print', type: 'text/css' },
        });

        expect(link?.getAttribute('media')).toBe('print');
        expect(link?.getAttribute('type')).toBe('text/css');
      });

      it('sollte onload Callback unterstützen', () => {
        const onloadCallback = vi.fn();
        const link = upsertHeadLink({
          rel: 'stylesheet',
          href: '/styles.css',
          onload: onloadCallback,
        });

        expect(link?.onload).toBe(onloadCallback);
      });
    });

    describe('upsertMeta', () => {
      it('sollte ein neues meta Element mit name erstellen', () => {
        const meta = upsertMeta('description', 'Test Beschreibung');

        expect(meta).not.toBeNull();
        expect(meta?.getAttribute('name')).toBe('description');
        expect(meta?.getAttribute('content')).toBe('Test Beschreibung');
        expect(document.head.contains(meta)).toBe(true);
      });

      it('sollte ein neues meta Element mit property erstellen', () => {
        const meta = upsertMeta('og:title', 'Test Titel', true);

        expect(meta).not.toBeNull();
        expect(meta?.getAttribute('property')).toBe('og:title');
        expect(meta?.getAttribute('content')).toBe('Test Titel');
      });

      it('sollte existierendes meta Element aktualisieren', () => {
        const meta1 = upsertMeta('description', 'Erste Beschreibung');
        const meta2 = upsertMeta('description', 'Zweite Beschreibung');

        expect(meta1).toBe(meta2);
        expect(meta1?.getAttribute('content')).toBe('Zweite Beschreibung');
        expect(
          document.head.querySelectorAll('meta[name="description"]').length,
        ).toBe(1);
      });

      it('sollte null zurückgeben, wenn content leer ist', () => {
        expect(upsertMeta('description', '')).toBeNull();
        expect(upsertMeta('description', null)).toBeNull();
      });
    });

    describe('applyCanonicalLinks', () => {
      it('sollte canonical Link erstellen', () => {
        applyCanonicalLinks(document, [], 'https://example.com/page');

        const canonical = document.head.querySelector('link[rel="canonical"]');
        expect(canonical).not.toBeNull();
        expect(canonical?.getAttribute('href')).toBe(
          'https://example.com/page',
        );
      });

      it('sollte canonical Link aktualisieren, wenn bereits vorhanden', () => {
        // Ersten canonical erstellen
        applyCanonicalLinks(document, [], 'https://example.com/page1');

        // Zweiten canonical mit neuer URL
        applyCanonicalLinks(document, [], 'https://example.com/page2');

        const canonicals = document.head.querySelectorAll(
          'link[rel="canonical"]',
        );
        expect(canonicals.length).toBe(1);
        expect(canonicals[0]?.getAttribute('href')).toBe(
          'https://example.com/page2',
        );
      });

      it('sollte alternate Links erstellen', () => {
        applyCanonicalLinks(
          document,
          [
            { lang: 'en', href: 'https://example.com/en' },
            { lang: 'de', href: 'https://example.com/de' },
          ],
          'https://example.com',
        );

        const alternates = document.head.querySelectorAll(
          'link[rel="alternate"]',
        );
        expect(alternates.length).toBe(2);

        const enLink = document.head.querySelector(
          'link[rel="alternate"][hreflang="en"]',
        );
        expect(enLink?.getAttribute('href')).toBe('https://example.com/en');

        const deLink = document.head.querySelector(
          'link[rel="alternate"][hreflang="de"]',
        );
        expect(deLink?.getAttribute('href')).toBe('https://example.com/de');
      });

      it('sollte alternate Links aktualisieren, wenn bereits vorhanden', () => {
        // Ersten alternate erstellen
        applyCanonicalLinks(
          document,
          [{ lang: 'en', href: 'https://example.com/en/page1' }],
          'https://example.com',
        );

        // Zweiten alternate mit neuer URL
        applyCanonicalLinks(
          document,
          [{ lang: 'en', href: 'https://example.com/en/page2' }],
          'https://example.com',
        );

        const alternates = document.head.querySelectorAll(
          'link[rel="alternate"][hreflang="en"]',
        );
        expect(alternates.length).toBe(1);
        expect(alternates[0]?.getAttribute('href')).toBe(
          'https://example.com/en/page2',
        );
      });

      it('sollte alternate Links ohne href ignorieren', () => {
        applyCanonicalLinks(
          document,
          [
            { lang: 'en', href: 'https://example.com/en' },
            { lang: 'de', href: '' },
          ],
          'https://example.com',
        );

        const alternates = document.head.querySelectorAll(
          'link[rel="alternate"]',
        );
        expect(alternates.length).toBe(1);
      });

      it('sollte nichts tun, wenn doc oder doc.head null ist', () => {
        applyCanonicalLinks(null, [], 'https://example.com');
        // Sollte keinen Fehler werfen
        expect(true).toBe(true);
      });
    });
  });
});
