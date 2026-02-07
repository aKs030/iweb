/**
 * Console Filter Utility
 * Filters out specific annoying warnings in development.
 * @module ConsoleFilter
 */

export function initConsoleFilter() {
  if (!import.meta.env?.DEV) return;

  const originalWarn = console.warn;
  const originalError = console.error;

  const shouldFilter = (message) => {
    const msg = String(message || '');
    return (
      msg.includes('touchstart') ||
      msg.includes('touchmove') ||
      msg.includes('non-passive event listener')
    );
  };

  console.warn = (...args) => {
    if (shouldFilter(args[0])) return;
    originalWarn.apply(console, args);
  };

  console.error = (...args) => {
    if (shouldFilter(args[0])) return;
    originalError.apply(console, args);
  };
}
