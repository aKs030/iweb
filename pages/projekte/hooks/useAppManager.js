/**
 * App Manager Hook
 * @version 1.0.0
 * @description Manages app opening/closing and iframe states
 */

import React from 'react';
import { createLogger } from '/content/core/logger.js';

const log = createLogger('useAppManager');

/**
 * Custom Hook for App Management
 * @returns {{
 *   openApps: Set<string>,
 *   toggleApp: (project: any) => void,
 *   closeApp: (projectId: string) => void,
 *   isAppOpen: (projectId: string) => boolean,
 *   openAppCount: number
 * }}
 */
export const useAppManager = () => {
  const [openApps, setOpenApps] = React.useState(new Set());

  const toggleApp = React.useCallback((project) => {
    const projectId = project.id;

    setOpenApps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
        log.debug(`Closed app: ${project.title}`);
      } else {
        // Limit to 3 open apps at once for performance
        if (newSet.size >= 3) {
          const firstApp = newSet.values().next().value;
          newSet.delete(firstApp);
          log.debug(
            `Auto-closed oldest app to make room for: ${project.title}`,
          );
        }
        newSet.add(projectId);
        log.debug(`Opened app: ${project.title}`);
      }
      return newSet;
    });
  }, []);

  const closeApp = React.useCallback((projectId) => {
    setOpenApps((prev) => {
      const newSet = new Set(prev);
      newSet.delete(projectId);
      return newSet;
    });
  }, []);

  const isAppOpen = React.useCallback(
    (projectId) => {
      return openApps.has(projectId);
    },
    [openApps],
  );

  const openAppCount = openApps.size;

  return {
    openApps,
    toggleApp,
    closeApp,
    isAppOpen,
    openAppCount,
  };
};
