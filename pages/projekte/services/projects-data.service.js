import React from 'react';
import { createLogger } from '#core/logger.js';
import { AppLoadManager } from '#core/load-manager.js';
import { i18n } from '#core/i18n.js';
import { normalizeText } from '#core/text-utils.js';
import { resolveProjectPreviewUrl } from '#config/media-urls.js';
import { DEFAULT_OG_IMAGE, THEME_COLORS } from '../config/constants.js';
import { PROJECT_CATEGORIES } from '../config/project-categories.js';

const log = createLogger('ProjectsDataService');

let localAppsConfig = null;
let localConfigPromise = null;

const TECH_STACK_RULES = Object.freeze([
  {
    label: 'Cloudflare',
    keywords: ['cloudflare'],
  },
  {
    label: 'Canvas API',
    keywords: ['canvas', 'drawing', 'paint'],
  },
  {
    label: 'Fetch API',
    keywords: ['api', 'fetch', 'weather', 'network', 'http', 'ip', 'geo'],
  },
  {
    label: 'Web Crypto',
    keywords: ['security', 'password', 'crypto', 'encryption'],
  },
  {
    label: 'CSS UI',
    keywords: ['css', 'theme', 'gradient', 'color', 'design', 'ui'],
  },
  {
    label: 'Game Logic',
    keywords: [
      'game',
      'spiel',
      'puzzle',
      'quiz',
      'memory',
      'snake',
      'pong',
      'tic',
    ],
  },
  {
    label: 'Local Storage',
    keywords: ['todo', 'history', 'storage', 'highscore'],
  },
  {
    label: 'Expression Engine',
    keywords: ['calculator', 'scientific', 'math'],
  },
]);

const CATEGORY_STACK_HINTS = Object.freeze({
  game: ['Game Logic'],
  puzzle: ['Game Logic'],
  ui: ['CSS UI'],
  productivity: ['Local Storage'],
  web: ['Fetch API'],
  utility: ['Browser APIs'],
});

function normalizeDateStamp(value) {
  const normalized = normalizeText(value);
  const match = normalized.match(/\b\d{4}-\d{2}-\d{2}\b/);
  return match ? match[0] : '';
}

function normalizeList(values) {
  const input = Array.isArray(values)
    ? values
    : String(values || '')
        .split(',')
        .map((value) => value.trim());

  return [
    ...new Set(input.map((value) => normalizeText(value)).filter(Boolean)),
  ];
}

function mapCaseStudy(caseStudy) {
  if (!caseStudy || typeof caseStudy !== 'object') return null;

  const problem = normalizeText(caseStudy.problem);
  const solution = normalizeText(caseStudy.solution);
  const results = normalizeText(caseStudy.results);
  const techStack = normalizeList(caseStudy.techStack);

  if (!problem && !solution && !results && techStack.length === 0) {
    return null;
  }

  return {
    problem,
    solution,
    results,
    techStack,
  };
}

function deriveTechStack(project, caseStudy, tags) {
  const derived = normalizeList(caseStudy?.techStack || []);
  const category = normalizeText(project?.category).toLowerCase();
  const corpus = [
    normalizeText(project?.title),
    normalizeText(project?.description),
    normalizeText(project?.category),
    ...normalizeList(tags),
  ]
    .join(' ')
    .toLowerCase();

  for (const hint of CATEGORY_STACK_HINTS[category] || []) {
    derived.push(hint);
  }

  for (const rule of TECH_STACK_RULES) {
    if (rule.keywords.some((keyword) => corpus.includes(keyword))) {
      derived.push(rule.label);
    }
  }

  if (derived.length === 0) {
    derived.push('Vanilla JS');
  }

  return normalizeList(derived).slice(0, 4);
}

function findSharedLabel(sourceValues, candidateValues) {
  const lookup = new Map(
    normalizeList(sourceValues).map((entry) => [entry.toLowerCase(), entry]),
  );

  for (const entry of normalizeList(candidateValues)) {
    const match = lookup.get(entry.toLowerCase());
    if (match) return match;
  }

  return '';
}

function getRelatedMatch(sourceProject, candidateProject) {
  const sharedStack = findSharedLabel(
    sourceProject?.techStack,
    candidateProject?.techStack,
  );
  if (sharedStack) {
    return { type: 'stack', label: sharedStack };
  }

  const sharedTag = findSharedLabel(
    sourceProject?.tags,
    candidateProject?.tags,
  );
  if (sharedTag) {
    return { type: 'tag', label: sharedTag };
  }

  if (
    sourceProject?.category &&
    candidateProject?.category &&
    sourceProject.category === candidateProject.category
  ) {
    return {
      type: 'category',
      label: sourceProject.category,
    };
  }

  return { type: '', label: '' };
}

async function loadLocalConfig() {
  if (localAppsConfig) return localAppsConfig;
  if (localConfigPromise) return localConfigPromise;

  localConfigPromise = (async () => {
    try {
      const response = await fetch('/pages/projekte/apps-config.json');
      if (!response.ok) {
        throw new Error(`apps-config.json returned ${response.status}`);
      }
      localAppsConfig = await response.json();
    } catch (error) {
      log.warn('Failed to load apps-config.json:', error);
      localAppsConfig = { apps: [] };
    }

    return localAppsConfig;
  })().finally(() => {
    localConfigPromise = null;
  });

  return localConfigPromise;
}

function getProjectIconAndTheme(project, icons) {
  const title = normalizeText(project?.title).toLowerCase();
  const tags = Array.isArray(project?.tags)
    ? project.tags.map((tag) => normalizeText(tag).toLowerCase())
    : [];
  const category = normalizeText(project?.category).toLowerCase();
  const description = normalizeText(project?.description).toLowerCase();
  const allText = `${title} ${tags.join(' ')} ${category} ${description}`;

  /** @type {{ icon: string, theme: string, keywords: string[] }} */
  let bestMatch = PROJECT_CATEGORIES.default;
  let maxMatches = 0;

  for (const [categoryKey, categoryData] of Object.entries(
    PROJECT_CATEGORIES,
  )) {
    if (categoryKey === 'default') continue;

    const matches = categoryData.keywords.filter((keyword) =>
      allText.includes(keyword),
    ).length;

    if (matches > maxMatches) {
      maxMatches = matches;
      bestMatch = categoryData;
    }
  }

  const IconComponent = icons[bestMatch.icon] || icons.Code;
  const theme = THEME_COLORS[bestMatch.theme] || THEME_COLORS.indigo;

  return {
    icon: React.createElement(IconComponent, {
      className: `project-category-icon project-category-icon--${bestMatch.theme}`,
    }),
    theme,
  };
}

function mapProjectRecord(project, index, icons, fallbackDate) {
  const dirName = normalizeText(project?.name || project?.dirName);
  const { icon, theme } = getProjectIconAndTheme(project, icons);
  const previewUrl = resolveProjectPreviewUrl(project);
  const previewAlt = normalizeText(project?.previewAlt);
  const tags = normalizeList(project?.tags).filter((tag) => {
    const lowered = tag.toLowerCase();
    return lowered !== 'abdulkerim' && lowered !== 'sesli';
  });
  const caseStudy = mapCaseStudy(project?.caseStudy);
  const techStack = deriveTechStack(project, caseStudy, tags);

  return {
    id: index + 1,
    name: dirName,
    dirName,
    title: normalizeText(project?.title || dirName),
    description: normalizeText(project?.description),
    tags,
    category: normalizeText(project?.category),
    version: normalizeText(project?.version),
    datePublished: normalizeDateStamp(project?.lastUpdated) || fallbackDate,
    image: previewUrl || DEFAULT_OG_IMAGE,
    appPath: normalizeText(project?.appPath),
    githubPath: normalizeText(project?.githubPath),
    previewUrl,
    previewAlt,
    caseStudy,
    techStack,
    hasCaseStudy: Boolean(caseStudy),
    hasLivePreview: Boolean(normalizeText(project?.appPath)),
    hasSource: Boolean(normalizeText(project?.githubPath)),
    icon,
    previewContent: React.createElement('div', null, icon),
  };
}

function scoreRelatedProject(sourceProject, candidateProject) {
  if (!sourceProject || !candidateProject) return 0;
  if (sourceProject.name === candidateProject.name) return 0;

  let score = 0;
  if (
    sourceProject.category &&
    candidateProject.category &&
    sourceProject.category === candidateProject.category
  ) {
    score += 4;
  }

  const sourceTags = new Set(
    normalizeList(sourceProject.tags).map((tag) => tag.toLowerCase()),
  );
  for (const tag of normalizeList(candidateProject.tags)) {
    if (sourceTags.has(tag.toLowerCase())) {
      score += 3;
    }
  }

  const sourceStack = new Set(
    normalizeList(sourceProject.techStack).map((entry) => entry.toLowerCase()),
  );
  for (const entry of normalizeList(candidateProject.techStack)) {
    if (sourceStack.has(entry.toLowerCase())) {
      score += 2;
    }
  }

  return score;
}

function enrichProjects(projects) {
  return projects.map((project) => {
    const relatedProjects = projects
      .map((candidate) => ({
        ...candidate,
        relatedScore: scoreRelatedProject(project, candidate),
        relatedMatch: getRelatedMatch(project, candidate),
      }))
      .filter((candidate) => candidate.relatedScore > 0)
      .sort(
        (a, b) =>
          b.relatedScore - a.relatedScore || a.title.localeCompare(b.title),
      )
      .slice(0, 3)
      .map(({ relatedScore: _relatedScore, relatedMatch, ...candidate }) => ({
        name: candidate.name,
        title: candidate.title,
        category: candidate.category,
        previewUrl: candidate.previewUrl,
        matchType: relatedMatch?.type || '',
        matchLabel: relatedMatch?.label || '',
      }));

    return {
      ...project,
      relatedProjects,
    };
  });
}

export async function createProjectsData(icons) {
  log.info('Starting createProjectsData...');
  AppLoadManager.updateLoader(0.5, i18n.t('loader.fallback_local'));

  const config = await loadLocalConfig();
  const apps = Array.isArray(config?.apps) ? config.apps : [];

  AppLoadManager.updateLoader(0.85, i18n.t('loader.processing'));

  const fallbackDate =
    normalizeDateStamp(config?.lastUpdated) ||
    new Date().toISOString().split('T')[0];
  const mappedProjects = apps.map((project, index) =>
    mapProjectRecord(project, index, icons, fallbackDate),
  );
  const projects = enrichProjects(mappedProjects);

  log.info(`Loaded ${projects.length} projects (Source: apps-config.json)`);
  AppLoadManager.updateLoader(
    1,
    i18n.t('loader.projects_ready', { count: projects.length }),
  );

  return projects;
}
