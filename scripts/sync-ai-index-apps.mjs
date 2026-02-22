import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT_DIR = process.cwd();
const AI_INDEX_PATH = path.join(ROOT_DIR, 'ai-index.json');
const APPS_CONFIG_PATH = path.join(ROOT_DIR, 'pages/projekte/apps-config.json');
const CHECK_MODE = process.argv.includes('--check');

const PRIORITY_BY_CATEGORY = Object.freeze({
  utility: 0.54,
  web: 0.54,
  productivity: 0.52,
  game: 0.5,
  ui: 0.5,
});

function normalizeText(value) {
  return String(value || '').trim();
}

function humanizeSlug(value, fallback = 'Projekt App') {
  const raw = normalizeText(value);
  if (!raw) return fallback;

  const words = raw
    .replace(/[_+]/g, '-')
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

  return words.length > 0 ? words.join(' ') : fallback;
}

function toKeywords(name, title, tags, category) {
  const tokens = new Set();
  const add = (value) => {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) return;
    tokens.add(normalized);
  };

  add(name);
  for (const part of String(name || '').split(/[-_]/)) {
    add(part);
  }

  for (const part of String(title || '').split(/\s+/)) {
    add(part);
  }

  add(category);

  for (const tag of Array.isArray(tags) ? tags : []) {
    add(tag);
  }

  return [...tokens];
}

function toProjectAppPage(app, siteUrl) {
  const name = normalizeText(app?.name);
  if (!name) return null;

  const title = humanizeSlug(app?.title || name);
  const category = normalizeText(app?.category).toLowerCase();
  const description =
    normalizeText(app?.description) ||
    `${title} - Interaktive Projekt-App mit eigenem Funktionsumfang`;
  const keywords = toKeywords(name, title, app?.tags, category);

  return {
    url: `${siteUrl}/projekte/?app=${encodeURIComponent(name)}`,
    title,
    description,
    type: 'project-app',
    keywords,
    priority: PRIORITY_BY_CATEGORY[category] ?? 0.5,
  };
}

function syncProjectAppPages(aiIndex, appsConfig) {
  if (!aiIndex.content || typeof aiIndex.content !== 'object') {
    aiIndex.content = {};
  }

  const pages = Array.isArray(aiIndex.content.pages)
    ? aiIndex.content.pages
    : [];
  const apps = Array.isArray(appsConfig?.apps) ? appsConfig.apps : [];
  const siteUrl =
    normalizeText(aiIndex?.site?.url) || 'https://www.abdulkerimsesli.de';

  const staticPages = pages.filter((page) => page?.type !== 'project-app');
  const appPages = apps
    .map((app) => toProjectAppPage(app, siteUrl))
    .filter(Boolean);

  aiIndex.content.pages = [...staticPages, ...appPages];
}

async function main() {
  const [aiRaw, appsRaw] = await Promise.all([
    fs.readFile(AI_INDEX_PATH, 'utf8'),
    fs.readFile(APPS_CONFIG_PATH, 'utf8'),
  ]);

  const aiIndex = JSON.parse(aiRaw);
  const appsConfig = JSON.parse(appsRaw);

  const before = JSON.stringify(aiIndex);
  const beforePages = JSON.stringify(aiIndex?.content?.pages || []);
  syncProjectAppPages(aiIndex, appsConfig);
  const afterPages = JSON.stringify(aiIndex?.content?.pages || []);
  const pagesChanged = beforePages !== afterPages;

  if (pagesChanged) {
    aiIndex.lastUpdated = new Date().toISOString().split('T')[0];
  }

  const nextContent = `${JSON.stringify(aiIndex, null, 2)}\n`;
  const after = JSON.stringify(aiIndex);
  const changed = before !== after;

  if (CHECK_MODE) {
    if (changed) {
      console.error('ai-index app sync required');
      process.exit(1);
    }
    console.log('ai-index app sync OK');
    return;
  }

  if (!changed) {
    console.log('ai-index app entries already up to date');
    return;
  }

  await fs.writeFile(AI_INDEX_PATH, nextContent, 'utf8');
  console.log('ai-index app entries synced');
}

main().catch((error) => {
  console.error('sync-ai-index-apps failed');
  console.error(error);
  process.exit(1);
});
