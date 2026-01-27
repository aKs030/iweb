#!/usr/bin/env node

/**
 * Script to update apps-config.json from GitHub API
 * Run this manually when you add new apps to keep the local config in sync
 */

const GITHUB_CONFIG = {
  owner: 'aKs030',
  repo: 'Webgame',
  branch: 'main',
  appsPath: 'apps',
  apiBase: 'https://api.github.com',
  rawBase: 'https://raw.githubusercontent.com',
};

async function fetchGitHubContents(path = '') {
  const url = `${GITHUB_CONFIG.apiBase}/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Apps-Config-Updater/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch GitHub contents:', error);
    return [];
  }
}

async function fetchProjectMetadata(projectPath) {
  const metadataUrl = `${GITHUB_CONFIG.rawBase}/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/${GITHUB_CONFIG.branch}/${projectPath}/package.json`;

  try {
    const response = await fetch(metadataUrl);
    if (response.ok) {
      const packageData = await response.json();
      return {
        name: projectPath.split('/').pop(),
        title: packageData.name || projectPath.split('/').pop(),
        description: packageData.description || 'Ein interaktives Web-Projekt',
        category: packageData.category || 'app',
        tags: packageData.keywords || ['JavaScript'],
        version: packageData.version || '1.0.0',
      };
    }
  } catch (error) {
    console.warn(`Could not fetch metadata for ${projectPath}:`, error);
  }

  // Default metadata
  return {
    name: projectPath.split('/').pop(),
    title: projectPath
      .split('/')
      .pop()
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase()),
    description: 'Ein interaktives Web-Projekt',
    category: 'app',
    tags: ['JavaScript'],
    version: '1.0.0',
  };
}

async function updateAppsConfig() {
  console.log('🚀 Updating apps config from GitHub...');

  try {
    const contents = await fetchGitHubContents(GITHUB_CONFIG.appsPath);
    const directories = contents.filter((item) => item.type === 'dir');

    console.log(`📁 Found ${directories.length} directories`);

    const apps = [];

    for (let i = 0; i < directories.length; i++) {
      const dir = directories[i];
      const projectPath = `${GITHUB_CONFIG.appsPath}/${dir.name}`;

      console.log(`🔄 Processing: ${dir.name}`);

      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const metadata = await fetchProjectMetadata(projectPath);
      apps.push(metadata);

      console.log(`✅ Added: ${metadata.title}`);
    }

    const config = {
      apps: apps,
      lastUpdated: new Date().toISOString(),
      source: 'github-api',
    };

    // In a real Node.js environment, you would write to file:
    // const fs = require('fs');
    // fs.writeFileSync('./apps-config.json', JSON.stringify(config, null, 2));

    console.log('📝 Updated config:');
    console.log(JSON.stringify(config, null, 2));

    console.log('🎉 Apps config updated successfully!');
    console.log('💡 Copy the JSON above to apps-config.json');
  } catch (error) {
    console.error('❌ Failed to update apps config:', error);
  }
}

// Run if called directly
if (typeof window === 'undefined') {
  updateAppsConfig();
}

export { updateAppsConfig };
