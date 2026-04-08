import { getResolvedTheme, setTheme, toggleTheme } from '#core/theme-state.js';
import { withViewTransition } from '#core/view-transitions.js';
import {
  VIEW_TRANSITION_ROOT_CLASSES,
  VIEW_TRANSITION_TYPES,
  VIEW_TRANSITION_TIMINGS_MS,
} from '#core/view-transition-constants.js';
import { buildToolResult, createDetail } from '../tool-result.js';

export function executeSetTheme(args) {
  const theme = String(args?.theme || 'toggle').toLowerCase();
  const currentTheme = getResolvedTheme();
  const nextTheme =
    theme === 'toggle'
      ? currentTheme === 'dark'
        ? 'light'
        : 'dark'
      : theme === 'light'
        ? 'light'
        : 'dark';

  let newTheme = nextTheme;

  void withViewTransition(
    () => {
      newTheme = theme === 'toggle' ? toggleTheme() : setTheme(nextTheme);
    },
    {
      types: [VIEW_TRANSITION_TYPES.THEME_CHANGE],
      rootClasses: [VIEW_TRANSITION_ROOT_CLASSES.THEME_CHANGE],
      timeoutMs: VIEW_TRANSITION_TIMINGS_MS.THEME_TIMEOUT,
    },
  );

  return buildToolResult(
    'setTheme',
    args,
    true,
    `Theme auf ${newTheme} gesetzt.`,
    {
      summary: `Das Erscheinungsbild wurde auf ${newTheme} umgestellt.`,
      details: [createDetail('Theme', newTheme)],
    },
  );
}

export function executeCopyCurrentUrl() {
  const url = globalThis.location?.href || '';
  if (!url) {
    return buildToolResult(
      'copyCurrentUrl',
      {},
      false,
      'URL nicht verfuegbar.',
      {
        summary: 'Der aktuelle Seitenlink konnte nicht gelesen werden.',
        accent: 'error',
        cta: false,
      },
    );
  }

  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(url).catch(() => {});
    return buildToolResult(
      'copyCurrentUrl',
      {},
      true,
      'Link in die Zwischenablage kopiert.',
      {
        summary: 'Der aktuelle Seitenlink wurde kopiert.',
        details: [createDetail('Link', url)],
      },
    );
  }

  return buildToolResult('copyCurrentUrl', {}, true, 'Aktueller Link bereit.', {
    summary:
      'Die Zwischenablage ist nicht verfuegbar, der Link wurde aber vorbereitet.',
    details: [createDetail('Link', url)],
  });
}
