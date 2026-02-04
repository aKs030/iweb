import { useEffect, useRef } from 'react';
import { createLogger } from '/content/core/logger.js';

const log = createLogger('useRobotIntelligence');

export const useRobotIntelligence = (state, chat) => {
  const { isOpen, context, setBubble } = state;
  const timerRef = useRef(null);

  useEffect(() => {
    // Reset timer on context change or when chat is opened
    if (isOpen) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const triggerProactiveTip = async () => {
      try {
        // Lazy load service
        // @ts-ignore
        if (!window._geminiService) {
          const { GeminiService } = await import('/content/components/robot-companion/gemini-service.js');
          // @ts-ignore
          window._geminiService = new GeminiService();
        }

        const pageTitle = document.title;
        const h1 = document.querySelector('h1')?.textContent || '';
        const contentSnippet = (document.body.textContent || '').substring(0, 3000);

        const contextData = {
          title: pageTitle,
          headline: h1,
          url: window.location.pathname,
          contentSnippet: contentSnippet
        };

        // @ts-ignore
        const suggestion = await window._geminiService.getSuggestion(contextData);
        if (suggestion) {
          setBubble(suggestion, 12000); // Show for 12s
        }
      } catch (e) {
        log.warn('Proactive tip failed', e);
      }
    };

    // Trigger after 15s dwell time
    timerRef.current = setTimeout(triggerProactiveTip, 15000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [context, isOpen, setBubble]);
};
