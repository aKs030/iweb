/**
 * Project Constants
 * @version 4.0.0
 */

// UI Constants
export const TOAST_DURATION = 2600;
export const URL_TEST_TIMEOUT = 2500;

// Cache Configuration
export const CACHE_PREFIX = 'github_contents_';
export const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Default OG Image
export const DEFAULT_OG_IMAGE =
  'https://www.abdulkerimsesli.de/content/assets/img/og/og-projekte-800.webp';

// Theme Colors for consistent design system
export const THEME_COLORS = {
  purple: {
    icon: '#c084fc',
    gradient: ['rgba(99, 102, 241, 0.2)', 'rgba(168, 85, 247, 0.2)'],
  },
  green: {
    icon: '#34d399',
    gradient: ['rgba(34, 197, 94, 0.2)', 'rgba(16, 185, 129, 0.2)'],
  },
  pink: {
    icon: '#f472b6',
    gradient: ['rgba(249, 115, 22, 0.2)', 'rgba(236, 72, 153, 0.2)'],
  },
  cyan: {
    icon: '#22d3ee',
    gradient: ['rgba(59, 130, 246, 0.2)', 'rgba(6, 182, 212, 0.2)'],
  },
  orange: {
    icon: '#fb923c',
    gradient: ['rgba(251, 146, 60, 0.2)', 'rgba(249, 115, 22, 0.2)'],
  },
  indigo: {
    icon: '#818cf8',
    gradient: ['rgba(129, 140, 248, 0.2)', 'rgba(99, 102, 241, 0.2)'],
  },
};
