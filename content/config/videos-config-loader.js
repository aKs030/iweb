import { createLogger } from '../core/logger.js';
import { ENV } from './env.config.js';

const log = createLogger('VideosConfig');

function isLocalDevelopment() {
  return ENV.isDev;
}

// Set your YouTube API key here or via environment variable
// For production, use environment variables or a secure backend proxy
const API_KEY = import.meta.env?.VITE_YOUTUBE_API_KEY || '';

if (API_KEY) {
  window.YOUTUBE_API_KEY = API_KEY;
} else {
  log.warn('No YouTube API key configured');
}

// Default channel configuration
if (!window.YOUTUBE_CHANNEL_HANDLE) {
  window.YOUTUBE_CHANNEL_HANDLE = 'aks.030';
}

if (!window.YOUTUBE_CHANNEL_ID) {
  window.YOUTUBE_CHANNEL_ID = 'UCTGRherjM4iuIn86xxubuPg';
}

// Mock mode for development/testing
const forceMock = new URLSearchParams(location.search).has('mockVideos');

if (forceMock) {
  window.YOUTUBE_USE_MOCK = true;
  log.warn('Using mock data due to ?mockVideos=1 (forced).');
} else if (!window.YOUTUBE_API_KEY && isLocalDevelopment()) {
  window.YOUTUBE_USE_MOCK = true;
  log.warn('No API key found — using mock data for development/testing.');
} else {
  window.YOUTUBE_USE_MOCK = false;
}
