import { useCallback } from 'react';
import { createLogger } from '/content/core/logger.js';
import { robotCompanionTexts } from '/content/components/robot-companion/robot-companion-texts.js';

const log = createLogger('useRobotChat');

export const useRobotChat = (state) => {
  const { addMessage, setIsTyping, setStreamingText, context, mood } = state;

  const getGeminiService = async () => {
    // @ts-ignore
    if (!window._geminiService) {
      const { GeminiService } = await import('/content/components/robot-companion/gemini-service.js');
      // @ts-ignore
      window._geminiService = new GeminiService();
    }
    // @ts-ignore
    return window._geminiService;
  };

  const processUserMessage = useCallback(async (text) => {
    addMessage(text, 'user');
    setIsTyping(true);

    try {
      // Check hardcoded knowledge base first (simple match)
      // This logic preserves some original behavior where local responses are instant
      const kb = robotCompanionTexts.knowledgeBase || {};
      const lowerText = text.toLowerCase();
      // TODO: Implement sophisticated local matching if needed.
      // For now we assume AI handles everything unless it's a specific command which is usually handled via options.

      const service = await getGeminiService();

      const systemInstruction = `Du bist Cyber, ein hilfreicher Roboter-Begleiter.
      Kontext: ${context}
      Laune: ${mood}
      Antworte immer auf DEUTSCH. Fasse dich kurz und prägnant.`;

      const responseText = await service.generateResponse(text, (chunk) => {
        setIsTyping(false);
        setStreamingText(chunk);
      }, systemInstruction);

      setStreamingText('');
      addMessage(responseText, 'bot');

    } catch (error) {
      log.error('Chat error', error);
      setStreamingText('');
      addMessage('Oh, mein Schaltkreis klemmt gerade etwas. Kannst du das wiederholen?', 'bot');
    } finally {
      setIsTyping(false);
    }
  }, [addMessage, setIsTyping, setStreamingText, context, mood]);

  const handleOptionClick = useCallback((option) => {
    if (option.action) {
      if (option.action.startsWith('nav:')) {
        const target = option.action.split(':')[1];
        window.location.href = target;
        return;
      }
    }
    processUserMessage(option.label || option.text);
  }, [processUserMessage]);

  return {
    processUserMessage,
    handleOptionClick
  };
};
