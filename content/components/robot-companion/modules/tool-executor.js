/**
 * Tool Executor - Executes AI tool calls on the client side
 * Controls website behavior through UI state, DOM APIs, and events.
 * @version 2.0.0
 */

import { createLogger } from '#core/logger.js';
import { isClientToolAvailable } from './tool-availability.js';
import {
  executeOpenImageUpload,
  executeClearChatHistory,
} from './tool-handlers/chat-tools.js';
import {
  executeComposeEmail,
  executeCreateCalendarReminder,
  executeOpenExternalLink,
  executeOpenSocialProfile,
} from './tool-handlers/external-tools.js';
import {
  executeNavigate,
  executeCloseSearch,
  executeFocusSearch,
  executeOpenSearch,
  executeRecommend,
  executeScrollToSection,
  executeScrollTop,
  executeSearch,
  executeToggleMenu,
} from './tool-handlers/navigation-tools.js';
import {
  executeCopyCurrentUrl,
  executeSetTheme,
} from './tool-handlers/ui-tools.js';
import { buildToolResult } from './tool-result.js';
import { getToolDefinition } from './tool-registry.js';

const log = createLogger('ToolExecutor');
const DEFAULT_CONFIRM_TITLE = 'Aktion bestaetigen';

const TOOL_HANDLERS = {
  navigate: executeNavigate,
  setTheme: executeSetTheme,
  searchBlog: executeSearch,
  toggleMenu: executeToggleMenu,
  scrollToSection: executeScrollToSection,
  recommend: executeRecommend,
  openSearch: executeOpenSearch,
  closeSearch: executeCloseSearch,
  focusSearch: executeFocusSearch,
  scrollTop: executeScrollTop,
  copyCurrentUrl: executeCopyCurrentUrl,
  openImageUpload: executeOpenImageUpload,
  clearChatHistory: executeClearChatHistory,
  openExternalLink: executeOpenExternalLink,
  openSocialProfile: executeOpenSocialProfile,
  composeEmail: executeComposeEmail,
  createCalendarReminder: executeCreateCalendarReminder,
};

function shouldConfirmToolExecution(toolCall) {
  return !!toolCall?.meta?.requiresConfirm;
}

function confirmToolExecution(toolCall) {
  const title =
    String(toolCall?.meta?.confirmTitle || '').trim() || DEFAULT_CONFIRM_TITLE;
  const message =
    String(toolCall?.meta?.confirmMessage || '').trim() ||
    'Soll diese Aktion wirklich ausgefuehrt werden?';

  if (typeof window?.confirm !== 'function') return true;
  return window.confirm(`${title}\n\n${message}`);
}

/**
 * Execute a tool call from the AI agent
 * @param {Object} toolCall - { name: string, arguments: Object }
 * @returns {{ success: boolean, message: string, status?: string, icon?: string, title?: string, summary?: string, accent?: string, details?: Array<{label: string, value: string}>, cta?: {mode?: string, label?: string} | null, toolArgs?: object }}
 */
export function executeTool(toolCall) {
  const name = String(toolCall?.name || '').trim();
  const args = toolCall?.arguments || {};
  const toolDefinition = getToolDefinition(name);
  const handler = TOOL_HANDLERS[name];

  try {
    if (toolDefinition?.execution === 'server') {
      return buildToolResult(
        name,
        args,
        false,
        `Tool "${name}" wird serverseitig verarbeitet.`,
        {
          title: 'Server-Tool',
          summary: `Für "${name}" gibt es keine direkte Browser-Ausführung.`,
          accent: 'error',
          cta: false,
        },
      );
    }

    if (!handler) {
      log.warn(`Unknown tool: ${name}`);
      return buildToolResult(name, args, false, `Unbekanntes Tool: ${name}`, {
        title: 'Unbekanntes Tool',
        summary: `Für "${name}" gibt es keine lokale Ausführung.`,
        accent: 'error',
        cta: false,
      });
    }

    if (!isClientToolAvailable(name)) {
      return buildToolResult(
        name,
        args,
        false,
        'Tool aktuell nicht verfügbar.',
        {
          title: toolDefinition?.card?.title || toolDefinition?.name || name,
          summary: `Die Aktion "${name}" ist im aktuellen UI-Zustand nicht verfügbar.`,
          accent: 'error',
          cta: false,
        },
      );
    }

    if (
      shouldConfirmToolExecution(toolCall) &&
      !confirmToolExecution(toolCall)
    ) {
      return buildToolResult(name, args, false, 'Aktion abgebrochen.', {
        title: 'Bestätigung',
        summary: 'Die Aktion wurde nicht ausgeführt.',
        accent: 'error',
        cta: false,
      });
    }

    return handler(args);
  } catch (error) {
    const message =
      error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : String(error);
    log.error(`Tool execution failed: ${name}`, error);
    return buildToolResult(name, args, false, `Tool-Fehler: ${message}`, {
      title: 'Tool-Fehler',
      summary: message,
      accent: 'error',
      cta: false,
    });
  }
}
