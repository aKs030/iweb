#!/usr/bin/env node

/**
 * Script to update apps-config.json from GitHub API
 * Run this manually when you add new apps to keep the local config in sync
 */

import { createLogger } from '../../content/core/logger.js';
import { GITHUB_CONFIG } from './github-config.js';
import { fetchGitHubContents, fetchProjectMetadata } from './project-utils.js';
import { fileURLToPath } from 'url';

const log = createLogger('UpdateAppsConfig');

const updateAppsConfig = async () => {
  log.info('Updating apps config from GitHub...');

  try {
    const contents = await fetchGitHubContents(GITHUB_CONFIG.appsPath);
    if (!contents || !Array.isArray(contents)) {
      throw new Error('Invalid contents received from GitHub');
    }

    const directories = contents.filter((item) => item.type === 'dir');

    console.log(`📁 Found ${directories.length} directories`);

    const apps = [];

    for (const [i, dir] of directories.entries()) {
      const projectPath = `${GITHUB_CONFIG.appsPath}/${dir.name}`;

      console.log(`🔄 Processing: ${dir.name}`);

      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const metadata = await fetchProjectMetadata(projectPath);

      // We add 'name' as the directory name, which is required for local config fallback
      apps.push({
        name: dir.name,
        ...metadata,
      });

      log.info(`Added: ${metadata.title}`);
    }

    // Clean up 'raw' property if it exists, as we don't need it in the config file
    // eslint-disable-next-line no-unused-vars
    const cleanApps = apps.map(({ raw, ...app }) => app);

    const now = new Date(); // ✅ Create once
    const config = {
      apps: cleanApps,
      lastUpdated: now.toISOString(),
      source: 'github-api',
    };

    // In a real Node.js environment, you would write to file:
    // const fs = await import('fs');
    // fs.writeFileSync('./pages/projekte/apps-config.json', JSON.stringify(config, null, 2));

    log.info('Updated config:');
    log.info(JSON.stringify(config, null, 2));

    log.info('Apps config updated successfully!');
    log.info('Copy the JSON above to pages/projekte/apps-config.json');
  } catch (error) {
    log.error('Failed to update apps config:', error);
  }
};

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  updateAppsConfig();
}

export { updateAppsConfig };
