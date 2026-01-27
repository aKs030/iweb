/**
 * GitHub Project Fetcher
 * Dynamically loads project data from the repository
 */

const GITHUB_API_BASE =
  'https://api.github.com/repos/aKs030/Webgame/contents/apps';
const RAW_BASE = 'https://raw.githubusercontent.com/aKs030/Webgame/main/apps';
const CACHE_KEY = 'github_projects_cache';
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// Re-defining constants to match projects-data.js style
const ICON_SIZE = { width: '32px', height: '32px' };
const DEFAULT_OG_IMAGE =
  'https://www.abdulkerimsesli.de/content/assets/img/og/og-projekte-800.webp';

const THEME_COLORS = {
  purple: {
    icon: '#c084fc',
    preview: '#c084fc',
    gradient: ['rgba(99, 102, 241, 0.2)', 'rgba(168, 85, 247, 0.2)'],
    glow: '#5586f7ff',
  },
  green: {
    icon: '#34d399',
    preview: '#6ee7b7',
    gradient: ['rgba(34, 197, 94, 0.2)', 'rgba(16, 185, 129, 0.2)'],
    glow: '#10b981',
  },
  pink: {
    icon: '#f472b6',
    preview: '#f472b6',
    gradient: ['rgba(249, 115, 22, 0.2)', 'rgba(236, 72, 153, 0.2)'],
    glow: '#ec4899',
  },
  cyan: {
    icon: '#22d3ee',
    preview: '#22d3ee',
    gradient: ['rgba(59, 130, 246, 0.2)', 'rgba(6, 182, 212, 0.2)'],
    glow: '#06b6d4',
  },
};

const THEMES = Object.values(THEME_COLORS);

const createGradient = (colors) => ({
  background: `linear-gradient(to bottom right, ${colors[0]}, ${colors[1]})`,
});

/**
 * Parsing logic to extract Title and Description from HTML string
 */
function parseMetadata(htmlContent) {
  let title = 'Unbekanntes Projekt';
  let description = 'Ein weiteres spannendes Web-Projekt.';

  // Simple regex parsing
  const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    // Cleanup title (remove | Author etc)
    title = titleMatch[1].split('|')[0].trim();
  }

  const descMatch = htmlContent.match(
    /<meta\s+name=["']description["']\s+content=["'](.*?)["']/i,
  );
  if (descMatch && descMatch[1]) {
    description = descMatch[1].trim();
  }

  return { title, description };
}

/**
 * Heuristic to determine category and icon
 */
function categorizeProject(name, title, icons) {
  const lower = (name + ' ' + title).toLowerCase();
  const { Gamepad2, Binary, Palette, ListTodo } = icons;

  if (
    lower.includes('game') ||
    lower.includes('spiel') ||
    lower.includes('schere') ||
    lower.includes('quiz') ||
    lower.includes('raten')
  ) {
    return {
      category: 'Game',
      IconComponent: Gamepad2,
      tags: ['Game', 'Fun'],
    };
  }
  if (
    lower.includes('todo') ||
    lower.includes('list') ||
    lower.includes('note') ||
    lower.includes('aufgabe')
  ) {
    return {
      category: 'App',
      IconComponent: ListTodo,
      tags: ['Produktivität', 'Tools'],
    };
  }
  if (
    lower.includes('color') ||
    lower.includes('farb') ||
    lower.includes('design') ||
    lower.includes('ui')
  ) {
    return {
      category: 'UI',
      IconComponent: Palette,
      tags: ['Design', 'UI/UX'],
    };
  }

  // Default
  return {
    category: 'Experiment',
    IconComponent: Binary,
    tags: ['Code', 'Web'],
  };
}

/**
 * Deterministically pick a theme based on string hash
 */
function getTheme(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % THEMES.length;
  return THEMES[index];
}

/**
 * Main Fetch Function
 */
export async function fetchDynamicProjects(html, icons) {
  try {
    // 1. Check Cache
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { timestamp, data } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        console.log('[Projects] Loading from cache');
        return processProjects(data, html, icons);
      }
    }

    // 2. Fetch from GitHub
    console.log('[Projects] Fetching from GitHub API...');
    const response = await fetch(GITHUB_API_BASE);
    if (!response.ok) {
      if (response.status === 403) {
        console.warn(
          '[Projects] Rate limit exceeded. Using fallback/cache if available.',
        );
        // If we have stale cache, return it even if expired
        if (cached)
          return processProjects(JSON.parse(cached).data, html, icons);
        return [];
      }
      throw new Error('GitHub API Error: ' + response.status);
    }

    const items = await response.json();
    const directories = items.filter((item) => item.type === 'dir');

    // 3. Fetch details for each directory (Parallel)
    const projectsData = await Promise.all(
      directories.map(async (dir) => {
        try {
          const indexRes = await fetch(`${RAW_BASE}/${dir.name}/index.html`);
          if (!indexRes.ok) return null;

          const htmlText = await indexRes.text();
          const meta = parseMetadata(htmlText);

          return {
            id: dir.name, // temporary ID
            dirName: dir.name,
            title: meta.title,
            description: meta.description,
            githubPath: dir.html_url,
            appPath: `/projekte/apps/${dir.name}/`,
            rawUrl: `${RAW_BASE}/${dir.name}/index.html`, // Stored for checking later
          };
        } catch (e) {
          console.warn(`Failed to fetch details for ${dir.name}`, e);
          return null;
        }
      }),
    );

    const validProjects = projectsData.filter((p) => p !== null);

    // 4. Save to Cache
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        data: validProjects,
      }),
    );

    return processProjects(validProjects, html, icons);
  } catch (err) {
    console.error('[Projects] Error loading dynamic projects:', err);
    return [];
  }
}

/**
 * Convert raw data into UI components
 */
function processProjects(dataList, html, icons) {
  return dataList.map((data, index) => {
    // Generate UI props
    const { category, IconComponent, tags } = categorizeProject(
      data.dirName,
      data.title,
      icons,
    );
    const theme = getTheme(data.dirName);

    // We start IDs from 100 to avoid conflict with static ones if we mix them
    const id = 100 + index;

    return {
      id: id,
      title: data.title,
      description: data.description,
      tags: tags,
      category: category,
      datePublished: new Date().toISOString().split('T')[0], // Unknown date, use today
      image: DEFAULT_OG_IMAGE,
      appPath: data.appPath,
      githubPath: data.githubPath,
      bgStyle: createGradient(theme.gradient),
      glowColor: theme.glow,

      // Dynamic Icon
      icon: html`
        <${IconComponent} style=${{ color: theme.icon, ...ICON_SIZE }} />
      `,

      // Standardized Preview (uses the generic preview container or mockup logic in App)
      // We render a simple placeholder here, but the App will overlay the iframe mockup
      previewContent: html`
        <div className="preview-container">
          <${IconComponent}
            style=${{
              color: theme.preview,
              ...{ width: '4rem', height: '4rem' },
            }}
          />
        </div>
      `,
    };
  });
}
