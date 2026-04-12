import { createLogger } from '../../../content/core/logger.js';

const log = createLogger('[[path]]');
/**
 * YouTube Data API v3 Proxy (hardened)
 * - Allows only required endpoints/params for the videos page
 * - Enforces basic input validation and channel scoping
 * - Keeps responses crawl-safe (API noindex) and cache-friendly
 */

import { getCorsHeaders } from '../_cors.js';
import { jsonResponse } from '../_response.js';
import {
  ACCEPT_JSON_HEADERS,
  CACHE_CONTROL_NO_STORE,
  mergeHeaders,
} from '../../_shared/http-headers.js';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const ALLOWED_ENDPOINTS = new Set([
  'channels',
  'playlistItems',
  'search',
  'videos',
]);
const DEFAULT_MAX_RESULTS = 24;
const MAX_RESULTS = 50;
const CHANNEL_ID_PATTERN = /^[A-Za-z0-9_-]{12,40}$/;
const PLAYLIST_ID_PATTERN = /^[A-Za-z0-9_-]{12,80}$/;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;
const PAGE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;

function getSecurityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Robots-Tag': 'noindex, nofollow',
    Vary: 'Origin, Accept, Accept-Encoding',
  };
}

function buildResponseHeaders(request, env, extraHeaders = {}) {
  return mergeHeaders(
    getSecurityHeaders(),
    getCorsHeaders(request, env),
    extraHeaders,
  );
}

function buildJsonResponse(
  request,
  env,
  payload,
  status = 200,
  extraHeaders = {},
) {
  return jsonResponse(payload, {
    status,
    headers: buildResponseHeaders(request, env, extraHeaders),
  });
}

/**
 * @param {URL} url
 * @returns {boolean}
 */
function isLocalDevRequest(url) {
  const hostname = url.hostname.toLowerCase();
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  );
}

function normalizeMaxResults(rawValue, fallback = DEFAULT_MAX_RESULTS) {
  const parsed = Number.parseInt(String(rawValue ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(MAX_RESULTS, parsed));
}

function normalizePathEndpoint(pathname) {
  const match = pathname.match(/^\/api\/youtube\/([^/?#]+)\/?$/);
  return match?.[1] ? String(match[1]).trim() : '';
}

function buildUploadsPlaylistId(channelId) {
  if (!String(channelId || '').startsWith('UC')) return '';
  return `UU${channelId.slice(2)}`;
}

function parseVideoIdList(rawValue) {
  const seen = new Set();
  return String(rawValue || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => VIDEO_ID_PATTERN.test(value))
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    })
    .slice(0, MAX_RESULTS);
}

function sanitizeYouTubeParams(endpoint, searchParams, env) {
  const expectedChannelId = String(env?.YOUTUBE_CHANNEL_ID || '').trim();
  const params = new URLSearchParams();
  const pageToken = String(searchParams.get('pageToken') || '').trim();

  if (pageToken && PAGE_TOKEN_PATTERN.test(pageToken)) {
    params.set('pageToken', pageToken);
  }

  if (endpoint === 'channels') {
    const channelId = String(
      searchParams.get('id') || expectedChannelId || '',
    ).trim();
    if (!CHANNEL_ID_PATTERN.test(channelId)) {
      return { error: 'Invalid channel id.' };
    }
    if (expectedChannelId && channelId !== expectedChannelId) {
      return { error: 'Channel id is not allowed.' };
    }

    params.set('part', 'contentDetails');
    params.set('id', channelId);
    params.set('maxResults', '1');
    params.set('fields', 'items/contentDetails/relatedPlaylists/uploads');
    return { params };
  }

  if (endpoint === 'playlistItems') {
    const playlistId = String(searchParams.get('playlistId') || '').trim();
    if (!PLAYLIST_ID_PATTERN.test(playlistId)) {
      return { error: 'Invalid playlist id.' };
    }

    if (expectedChannelId) {
      const expectedUploads = buildUploadsPlaylistId(expectedChannelId);
      if (expectedUploads && playlistId !== expectedUploads) {
        return { error: 'Playlist is not allowed.' };
      }
    }

    params.set('part', 'snippet');
    params.set(
      'maxResults',
      String(normalizeMaxResults(searchParams.get('maxResults'))),
    );
    params.set('playlistId', playlistId);
    return { params };
  }

  if (endpoint === 'search') {
    const channelId = String(
      searchParams.get('channelId') || expectedChannelId || '',
    ).trim();
    if (!CHANNEL_ID_PATTERN.test(channelId)) {
      return { error: 'Invalid channel id.' };
    }
    if (expectedChannelId && channelId !== expectedChannelId) {
      return { error: 'Channel id is not allowed.' };
    }

    params.set('part', 'snippet');
    params.set('channelId', channelId);
    params.set('type', 'video');
    params.set('order', 'date');
    params.set(
      'maxResults',
      String(normalizeMaxResults(searchParams.get('maxResults'))),
    );
    return { params };
  }

  if (endpoint === 'videos') {
    const ids = parseVideoIdList(searchParams.get('id'));
    if (ids.length === 0) {
      return { error: 'Invalid video id list.' };
    }

    params.set('part', 'snippet,contentDetails,statistics');
    params.set('id', ids.join(','));
    params.set('maxResults', String(Math.min(ids.length, MAX_RESULTS)));
    return { params };
  }

  return { error: 'Unsupported endpoint.' };
}

export async function onRequestOptions({ request, env }) {
  return new Response(null, {
    status: 204,
    headers: buildResponseHeaders(request, env, {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }),
  });
}

/**
 * Handle GET requests to YouTube API
 * @param {Object} context
 * @returns {Promise<Response>}
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const endpoint = normalizePathEndpoint(url.pathname);

  if (!endpoint || !ALLOWED_ENDPOINTS.has(endpoint)) {
    return buildJsonResponse(
      request,
      env,
      { error: 'Invalid YouTube API endpoint.' },
      400,
      { 'Cache-Control': CACHE_CONTROL_NO_STORE },
    );
  }

  const apiKey = String(env?.YOUTUBE_API_KEY || '').trim();
  if (!apiKey) {
    const isLocalDev = isLocalDevRequest(url);
    return buildJsonResponse(
      request,
      env,
      {
        error: 'YouTube API key not configured',
        hint: 'Set YOUTUBE_API_KEY in Cloudflare Pages settings',
        items: [],
        localFallback: isLocalDev,
      },
      isLocalDev ? 200 : 503,
      { 'Cache-Control': CACHE_CONTROL_NO_STORE },
    );
  }

  const sanitized = sanitizeYouTubeParams(endpoint, url.searchParams, env);
  if (sanitized.error) {
    return buildJsonResponse(request, env, { error: sanitized.error }, 400, {
      'Cache-Control': CACHE_CONTROL_NO_STORE,
    });
  }

  try {
    const youtubeUrl = new URL(`${YOUTUBE_API_BASE}/${endpoint}`);
    sanitized.params.forEach((value, key) => {
      youtubeUrl.searchParams.set(key, value);
    });
    youtubeUrl.searchParams.set('key', apiKey);

    const upstream = await fetch(youtubeUrl.toString(), {
      method: 'GET',
      headers: ACCEPT_JSON_HEADERS,
    });

    const responseText = await upstream.text();
    let data = {};
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = {
        error: 'Upstream response was not valid JSON.',
      };
    }

    const isSuccess = upstream.ok;
    return buildJsonResponse(request, env, data, upstream.status, {
      'Cache-Control': isSuccess
        ? 'public, max-age=300, stale-while-revalidate=900'
        : CACHE_CONTROL_NO_STORE,
    });
  } catch (error) {
    log.error('YouTube API proxy error:', error);
    return buildJsonResponse(
      request,
      env,
      { error: 'YouTube API request failed' },
      502,
      { 'Cache-Control': CACHE_CONTROL_NO_STORE },
    );
  }
}
