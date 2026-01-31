/**
 * Modal State Management Hook
 * @version 1.0.0
 */

import React from 'react';

/**
 * Custom Hook for Modal State Management
 * @returns {{
 *   isOpen: boolean,
 *   url: string,
 *   title: string,
 *   isLoading: boolean,
 *   open: (url: string, title: string) => void,
 *   close: () => void,
 *   handleLoad: () => void
 * }}
 */
export const useModal = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [url, setUrl] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);

  const open = React.useCallback(
    /**
     * @param {string} modalUrl - URL to display in modal
     * @param {string} modalTitle - Modal title
     */
    (modalUrl, modalTitle) => {
      setTitle(modalTitle);
      setUrl(modalUrl);
      setIsLoading(true);
      setIsOpen(true);
      document.body.style.overflow = 'hidden';
    },
    [],
  );

  const close = React.useCallback(() => {
    setIsOpen(false);
    setUrl('');
    setTitle('');
    document.body.style.overflow = '';
  }, []);

  const handleLoad = React.useCallback(() => {
    setIsLoading(false);
  }, []);

  return { isOpen, url, title, isLoading, open, close, handleLoad };
};
