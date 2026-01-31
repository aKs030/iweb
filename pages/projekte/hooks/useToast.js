/**
 * Toast Notification Hook
 * @version 1.0.0
 */

import React from 'react';
import { TOAST_DURATION } from '../config/constants.js';

/**
 * Custom Hook for Toast Notifications
 * @returns {{ message: string, show: (msg: string, duration?: number) => void }}
 */
export const useToast = () => {
  const [message, setMessage] = React.useState('');
  const timerRef = React.useRef(
    /** @type {ReturnType<typeof setTimeout> | null} */ (null),
  );

  const show = React.useCallback(
    /**
     * @param {string} msg - Toast message
     * @param {number} [duration] - Display duration in ms
     */
    (msg, duration = TOAST_DURATION) => {
      setMessage(msg);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setMessage(''), duration);
    },
    [],
  );

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { message, show };
};
