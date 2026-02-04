import { useState, useEffect, useCallback, useRef } from 'react';
import { createLogger } from '/content/core/logger.js';

const log = createLogger('useRobotState');

export const useRobotState = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mood, setMood] = useState('normal');
  const [messages, setMessages] = useState([]);
  const [bubbleText, setBubbleText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [context, setContext] = useState('home');

  const analyticsRef = useRef({
    sessions: 0,
    interactions: 0,
    sectionsVisited: [],
    lastVisit: new Date().toISOString(),
  });

  useEffect(() => {
    try {
      const sessions =
        parseInt(localStorage.getItem('robot-sessions') || '0', 10) + 1;
      const interactions = parseInt(
        localStorage.getItem('robot-interactions') || '0',
        10,
      );
      const lastVisit =
        localStorage.getItem('robot-last-visit') || new Date().toISOString();

      analyticsRef.current = {
        sessions,
        interactions,
        sectionsVisited: [],
        lastVisit,
      };

      localStorage.setItem('robot-sessions', sessions.toString());
      localStorage.setItem('robot-last-visit', new Date().toISOString());

      calculateMood(sessions, interactions);

      // Load history
      const savedHistory = localStorage.getItem('robot-chat-history');
      if (savedHistory) {
        try {
          // Convert stored history to message format
          const historyItems = JSON.parse(savedHistory);
          // Only last 30
          const validItems = historyItems.slice(-30).map((item) => ({
            text: item.text,
            type: item.role === 'user' ? 'user' : 'bot',
            timestamp: Date.now(),
          }));
          setMessages(validItems);
        } catch {
          // ignore
        }
      }
    } catch (e) {
      log.warn('Analytics load error', e);
    }
  }, []);

  const calculateMood = (sessions, interactions) => {
    const hour = new Date().getHours();
    let newMood = 'normal';

    if (hour >= 0 && hour < 6) newMood = 'night-owl';
    else if (hour >= 6 && hour < 10) newMood = 'sleepy';
    else if (hour >= 10 && hour < 17) newMood = 'energetic';
    else if (hour >= 17 && hour < 22) newMood = 'relaxed';
    else if (hour >= 22) newMood = 'night-owl';

    if (sessions > 10 || interactions > 50) newMood = 'enthusiastic';

    setMood(newMood);
  };

  const trackInteraction = useCallback(() => {
    analyticsRef.current.interactions++;
    localStorage.setItem(
      'robot-interactions',
      analyticsRef.current.interactions.toString(),
    );
  }, []);

  const addMessage = useCallback(
    (text, type = 'bot', options = []) => {
      const msg = { text, type, options, timestamp: Date.now() };
      setMessages((prev) => {
        const next = [...prev, msg];
        // Persist
        try {
          const history = next
            .map((m) => ({
              role: m.type === 'user' ? 'user' : 'model',
              text: m.text,
            }))
            .slice(-30);
          localStorage.setItem('robot-chat-history', JSON.stringify(history));
        } catch {
          // ignore
        }
        return next;
      });
      if (type === 'user') trackInteraction();
    },
    [trackInteraction],
  );

  const setBubble = useCallback((text, duration = 0) => {
    setBubbleText(text);
    if (duration > 0) {
      setTimeout(() => setBubbleText(''), duration);
    }
  }, []);

  useEffect(() => {
    const checkContext = () => {
      const path = window.location.pathname;
      let ctx = 'home';
      if (path.includes('projekte')) ctx = 'projects';
      else if (path.includes('gallery')) ctx = 'gallery';
      else if (path.includes('blog')) ctx = 'blog';
      else if (path.includes('videos')) ctx = 'videos';
      else if (path.includes('about')) ctx = 'about';

      setContext(ctx);
    };

    checkContext();
    window.addEventListener('popstate', checkContext);
    return () => window.removeEventListener('popstate', checkContext);
  }, []);

  return {
    isOpen,
    setIsOpen,
    mood,
    messages,
    addMessage,
    bubbleText,
    setBubble,
    isTyping,
    setIsTyping,
    streamingText,
    setStreamingText,
    context,
    trackInteraction,
  };
};
