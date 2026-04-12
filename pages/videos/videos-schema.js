import { BASE_URL } from '#config/constants.js';
import { injectSchema } from '#core/schema.js';

const VIDEO_PAGE_BASE_URL = `${BASE_URL}/videos/`;
const VIDEOS_LIST_ID = `${VIDEO_PAGE_BASE_URL}#videos-list`;
const VIDEOS_SCHEMA_SCRIPT_ID = 'videos-feed-ldjson';

export function dedupeVideoSchemas(videoNodes) {
  const byKey = new Map();
  for (const node of videoNodes || []) {
    if (!node || typeof node !== 'object') continue;
    const key = node['@id'] || node.url || node.contentUrl || node.embedUrl;
    if (!key || byKey.has(key)) continue;
    byKey.set(key, node);
  }
  return Array.from(byKey.values());
}

export function upsertVideosSchema(videoNodes) {
  const existing = document.getElementById(VIDEOS_SCHEMA_SCRIPT_ID);
  if (!Array.isArray(videoNodes) || videoNodes.length === 0) {
    existing?.remove();
    return;
  }

  const itemListElement = videoNodes.map((videoNode, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    item: {
      '@id': videoNode['@id'] || `${VIDEO_PAGE_BASE_URL}#video-${index + 1}`,
      name: videoNode.name || `Video ${index + 1}`,
      url:
        videoNode.url ||
        videoNode.contentUrl ||
        videoNode.embedUrl ||
        VIDEO_PAGE_BASE_URL,
    },
  }));

  injectSchema(
    [
      {
        '@type': 'ItemList',
        '@id': VIDEOS_LIST_ID,
        name: 'Videos von Abdulkerim Sesli',
        numberOfItems: videoNodes.length,
        itemListElement,
      },
      ...videoNodes,
    ],
    { scriptId: VIDEOS_SCHEMA_SCRIPT_ID },
  );
}
