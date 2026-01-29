#!/usr/bin/env node

/**
 * Script to update apps-config.json from GitHub API
 * Run this manually when you add new apps to keep the local config in sync
 */

import { GITHUB_CONFIG } from './github-config.js';
import {
  fetchGitHubContents,
  fetchProjectMetadata,
} from './project-utils.js';
import { fileURLToPath } from 'url';

async function updateAppsConfig() {
  console.log('🚀 Updating apps config from GitHub...');

  try {
    const contents = await fetchGitHubContents(GITHUB_CONFIG.appsPath);
    if (!contents || !Array.isArray(contents)) {
      throw new Error('Invalid contents received from GitHub');
    }

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

      // We add 'name' as the directory name, which is required for local config fallback
      apps.push({
        name: dir.name,
        ...metadata,
      });

      console.log(`✅ Added: ${metadata.title}`);
    }

    // Clean up 'raw' property if it exists, as we don't need it in the config file
    const cleanApps = apps.map(({ raw, ...app }) => app);

    const config = {
      apps: cleanApps,
      lastUpdated: new Date().toISOString(),
      source: 'github-api',
    };

    // In a real Node.js environment, you would write to file:
    // const fs = await import('fs');
    // fs.writeFileSync('./pages/projekte/apps-config.json', JSON.stringify(config, null, 2));

    console.log('📝 Updated config:');
    console.log(JSON.stringify(config, null, 2));

    console.log('🎉 Apps config updated successfully!');
    console.log('💡 Copy the JSON above to pages/projekte/apps-config.json');
  } catch (error) {
    console.error('❌ Failed to update apps config:', error);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  updateAppsConfig();
}

export { updateAppsConfig };
