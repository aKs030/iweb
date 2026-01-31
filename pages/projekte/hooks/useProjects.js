/**
 * Projects Data Loading Hook
 * @version 3.0.0
 */

import React from 'react';
import { createLogger } from '/content/core/logger.js';
import { updateLoader } from '/content/core/global-loader.js';
import { createProjectsData } from '../services/projects-data.service.js';

const log = createLogger('useProjects');

/**
 * Custom Hook for Loading Projects
 * @param {object} icons - Icon components
 * @returns {{
 *   projects: Array<any>,
 *   loading: boolean,
 *   error: string
 * }}
 */
export const useProjects = (icons) => {
  const [projects, setProjects] = React.useState(/** @type {any[]} */ ([]));
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const loadProjects = async () => {
      try {
        log.info('Loading projects from GitHub...');
        setLoading(true);

        const loadedProjects = await createProjectsData(icons);

        log.info(`Successfully loaded ${loadedProjects.length} projects`);

        setProjects(loadedProjects);

        // Final update
        setTimeout(() => {
          updateLoader(1, 'Bereit!');
        }, 100);
      } catch (err) {
        log.error('Failed to load projects:', err);
        const errorMessage =
          err instanceof Error ? err.message : 'Unbekannter Fehler';
        setError(`Projekte konnten nicht geladen werden: ${errorMessage}`);
        updateLoader(1, 'Fehler beim Laden');
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [icons]);

  return { projects, loading, error };
};
