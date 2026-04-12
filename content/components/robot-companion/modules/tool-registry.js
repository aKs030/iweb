import { getSharedToolDefinition } from './shared-tool-definitions.js';

const ALWAYS_AVAILABLE = 'always';
const SITE_MENU_AVAILABLE = 'site-menu';
const ROBOT_AVAILABLE = 'robot';
const ROBOT_CHAT_AVAILABLE = 'robot-chat';

function createToolDefinition(name, overrides = {}) {
  const baseDefinition = getSharedToolDefinition(name);
  if (!baseDefinition) {
    throw new Error(`Unknown shared tool definition: ${name}`);
  }

  return {
    ...baseDefinition,
    ...overrides,
  };
}

export const ROBOT_TOOL_DEFINITIONS = Object.freeze([
  createToolDefinition('navigate', {
    minRole: 'user',
    category: 'navigation',
    execution: 'client',
    availability: ALWAYS_AVAILABLE,
    card: {
      icon: '🧭',
      title: 'Navigation',
      accent: 'navigation',
      replayLabel: 'Erneut öffnen',
    },
  }),
  createToolDefinition('setTheme', {
    minRole: 'user',
    category: 'ui',
    execution: 'client',
    availability: ALWAYS_AVAILABLE,
    card: {
      icon: '🎨',
      title: 'Theme',
      accent: 'appearance',
      replayLabel: 'Erneut anwenden',
    },
  }),
  createToolDefinition('searchBlog', {
    minRole: 'user',
    category: 'search',
    execution: 'client',
    availability: SITE_MENU_AVAILABLE,
    card: {
      icon: '🔍',
      title: 'Website-Suche',
      accent: 'search',
      replayLabel: 'Erneut suchen',
    },
  }),
  createToolDefinition('toggleMenu', {
    minRole: 'user',
    category: 'ui',
    execution: 'client',
    availability: SITE_MENU_AVAILABLE,
    card: {
      icon: '📋',
      title: 'Menü',
      accent: 'navigation',
      replayLabel: 'Erneut ausführen',
    },
  }),
  createToolDefinition('scrollToSection', {
    minRole: 'user',
    category: 'navigation',
    execution: 'client',
    availability: ALWAYS_AVAILABLE,
    card: {
      icon: '📜',
      title: 'Bereich',
      accent: 'navigation',
      replayLabel: 'Erneut scrollen',
    },
  }),
  createToolDefinition('openSearch', {
    minRole: 'user',
    category: 'search',
    execution: 'client',
    availability: SITE_MENU_AVAILABLE,
    card: {
      icon: '🔎',
      title: 'Suche',
      accent: 'search',
      replayLabel: 'Suche öffnen',
    },
  }),
  createToolDefinition('closeSearch', {
    minRole: 'user',
    category: 'search',
    execution: 'client',
    availability: SITE_MENU_AVAILABLE,
    card: {
      icon: '❎',
      title: 'Suche',
      accent: 'search',
      replayLabel: 'Erneut schließen',
    },
  }),
  createToolDefinition('focusSearch', {
    minRole: 'user',
    category: 'search',
    execution: 'client',
    availability: SITE_MENU_AVAILABLE,
    card: {
      icon: '🎯',
      title: 'Suchfokus',
      accent: 'search',
      replayLabel: 'Erneut fokussieren',
    },
  }),
  createToolDefinition('scrollTop', {
    minRole: 'user',
    category: 'navigation',
    execution: 'client',
    availability: ALWAYS_AVAILABLE,
    card: {
      icon: '⬆️',
      title: 'Seitenanfang',
      accent: 'navigation',
      replayLabel: 'Erneut nach oben',
    },
  }),
  createToolDefinition('copyCurrentUrl', {
    minRole: 'user',
    category: 'utility',
    execution: 'client',
    availability: ALWAYS_AVAILABLE,
    card: {
      icon: '🔗',
      title: 'Link',
      accent: 'utility',
      replayLabel: 'Erneut kopieren',
    },
  }),
  createToolDefinition('openImageUpload', {
    minRole: 'user',
    category: 'chat',
    execution: 'client',
    availability: ROBOT_AVAILABLE,
    card: {
      icon: '📷',
      title: 'Bild-Upload',
      accent: 'utility',
      replayLabel: 'Upload öffnen',
    },
  }),
  createToolDefinition('clearChatHistory', {
    minRole: 'user',
    category: 'chat',
    execution: 'client',
    availability: ROBOT_CHAT_AVAILABLE,
    requiresConfirm: true,
    confirmTitle: 'Chat löschen',
    confirmMessage: 'Soll der lokale Chatverlauf wirklich gelöscht werden?',
    card: {
      icon: '🧹',
      title: 'Chat',
      accent: 'utility',
    },
  }),
  createToolDefinition('rememberUser', {
    minRole: 'user',
    category: 'memory',
    execution: 'server',
  }),
  createToolDefinition('recallMemory', {
    minRole: 'user',
    category: 'memory',
    execution: 'server',
  }),
  createToolDefinition('recommend', {
    minRole: 'user',
    category: 'assistant',
    execution: 'client',
    availability: SITE_MENU_AVAILABLE,
    card: {
      icon: '💡',
      title: 'Empfehlung',
      accent: 'search',
      replayLabel: 'Erneut anfragen',
    },
  }),
  {
    name: 'openExternalLink',
    description: 'Öffne einen externen Link (http/https).',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Vollständige URL' },
        newTab: {
          type: 'boolean',
          description: 'Optional in neuem Tab öffnen (default: true)',
        },
      },
      required: ['url'],
    },
    minRole: 'user',
    category: 'integration',
    integration: 'links',
    execution: 'client',
    availability: ALWAYS_AVAILABLE,
    requiresConfirm: true,
    confirmTitle: 'Externen Link öffnen',
    card: {
      icon: '🌐',
      title: 'Externer Link',
      accent: 'external',
      replayLabel: 'Erneut öffnen',
    },
  },
  {
    name: 'openSocialProfile',
    description: 'Öffne ein Social-Profil von Abdulkerim.',
    parameters: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['github', 'linkedin', 'instagram', 'youtube', 'x'],
        },
      },
      required: ['platform'],
    },
    minRole: 'user',
    category: 'integration',
    integration: 'social',
    execution: 'client',
    availability: ALWAYS_AVAILABLE,
    card: {
      icon: '👤',
      title: 'Social Profil',
      accent: 'external',
      replayLabel: 'Profil öffnen',
    },
  },
  {
    name: 'composeEmail',
    description: 'Öffne den Mail-Client mit einem vorbefüllten Entwurf.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'E-Mail-Empfänger' },
        subject: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['to'],
    },
    minRole: 'user',
    category: 'integration',
    integration: 'email',
    execution: 'client',
    availability: ALWAYS_AVAILABLE,
    requiresConfirm: true,
    confirmTitle: 'E-Mail-Entwurf öffnen',
    card: {
      icon: '✉️',
      title: 'E-Mail',
      accent: 'external',
      replayLabel: 'Entwurf öffnen',
    },
  },
  {
    name: 'createCalendarReminder',
    description:
      'Öffne eine Kalender-Erinnerung (Google Calendar) mit vorausgefüllten Daten.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        date: { type: 'string', description: 'Datum, z.B. 2026-03-10' },
        time: { type: 'string', description: 'Uhrzeit, z.B. 14:30' },
        details: { type: 'string' },
        url: { type: 'string' },
      },
      required: ['title', 'date'],
    },
    minRole: 'user',
    category: 'integration',
    integration: 'calendar',
    execution: 'client',
    availability: ALWAYS_AVAILABLE,
    requiresConfirm: true,
    confirmTitle: 'Kalender-Erinnerung erstellen',
    card: {
      icon: '📅',
      title: 'Kalender',
      accent: 'utility',
      replayLabel: 'Kalender öffnen',
    },
  },
]);

export const TOOL_DEFINITION_BY_NAME = new Map(
  ROBOT_TOOL_DEFINITIONS.map((tool) => [tool.name, tool]),
);

export const CLIENT_TOOL_DEFINITIONS = Object.freeze(
  ROBOT_TOOL_DEFINITIONS.filter((tool) => tool.execution === 'client'),
);

export const TOOL_CARD_CONFIG = Object.freeze(
  Object.fromEntries(
    ROBOT_TOOL_DEFINITIONS.filter((tool) => tool.card).map((tool) => [
      tool.name,
      Object.freeze({ ...tool.card }),
    ]),
  ),
);

export function getToolDefinition(name) {
  return TOOL_DEFINITION_BY_NAME.get(String(name || '').trim()) || null;
}
