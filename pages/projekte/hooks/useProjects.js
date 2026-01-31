/**
 * Projects Data Loading Hook
 * @version 1.0.0
 */

import React from 'react';
import { createLogger } from '/content/core/logger.js';
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
      } catch (err) {
        log.error('Failed to load projects:', err);
        const errorMessage =
          err instanceof Error ? err.message : 'Unbekannter Fehler';
        setError(`Projekte konnten nicht geladen werden: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, [icons]);

  return { projects, loading, error };
};
