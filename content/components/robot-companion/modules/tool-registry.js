const ALWAYS_AVAILABLE = 'always';
const SITE_MENU_AVAILABLE = 'site-menu';
const ROBOT_AVAILABLE = 'robot';
const ROBOT_CHAT_AVAILABLE = 'robot-chat';

export const ROBOT_TOOL_DEFINITIONS = Object.freeze([
  {
    name: 'navigate',
    description:
      'Navigiere zu einer Seite: home, projekte, about, gallery, blog, videos, kontakt, impressum, datenschutz.',
    parameters: {
      type: 'object',
      properties: {
        page: {
          type: 'string',
          enum: [
            'home',
            'projekte',
            'about',
            'gallery',
            'blog',
            'videos',
            'kontakt',
            'impressum',
            'datenschutz',
          ],
        },
      },
      required: ['page'],
    },
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
  },
  {
    name: 'setTheme',
    description: 'Wechsle das Farbschema (dark/light/toggle).',
    parameters: {
      type: 'object',
      properties: {
        theme: { type: 'string', enum: ['dark', 'light', 'toggle'] },
      },
      required: ['theme'],
    },
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
  },
  {
    name: 'searchBlog',
    description: 'Suche nach Inhalten auf der Website.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Suchbegriff' },
      },
      required: ['query'],
    },
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
  },
  {
    name: 'getSiteAnalytics',
    description:
      'Analysiere Seiteninformationen oder Statistiken (mocked/simuliert für Analytics-Demo).',
    parameters: {
      type: 'object',
      properties: {
        metric: {
          type: 'string',
          description: 'Die angeforderte Metrik (z.B. views, performance)',
        },
      },
      required: ['metric'],
    },
    minRole: 'trusted',
    category: 'analytics',
    execution: 'server',
  },
  {
    name: 'toggleMenu',
    description: 'Menü öffnen/schließen.',
    parameters: {
      type: 'object',
      properties: {
        state: { type: 'string', enum: ['open', 'close', 'toggle'] },
      },
      required: ['state'],
    },
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
  },
  {
    name: 'scrollToSection',
    description:
      'Scrolle zu einem Abschnitt (header, footer, contact, hero, projects, skills).',
    parameters: {
      type: 'object',
      properties: {
        section: { type: 'string' },
      },
      required: ['section'],
    },
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
  },
  {
    name: 'openSearch',
    description: 'Öffne die Website-Suche.',
    parameters: {
      type: 'object',
      properties: {},
    },
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
  },
  {
    name: 'closeSearch',
    description: 'Schließe die Website-Suche.',
    parameters: {
      type: 'object',
      properties: {},
    },
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
  },
  {
    name: 'focusSearch',
    description:
      'Fokussiere die Suche. Optional kann ein Suchbegriff gesetzt werden.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
    },
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
  },
  {
    name: 'scrollTop',
    description: 'Scrolle zum Seitenanfang.',
    parameters: {
      type: 'object',
      properties: {},
    },
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
  },
  {
    name: 'copyCurrentUrl',
    description: 'Kopiere den aktuellen Seitenlink.',
    parameters: {
      type: 'object',
      properties: {},
    },
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
  },
  {
    name: 'openImageUpload',
    description: 'Öffne den Bild-Upload im Chat.',
    parameters: {
      type: 'object',
      properties: {},
    },
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
  },
  {
    name: 'clearChatHistory',
    description:
      'Lösche den lokalen Chatverlauf (nur auf Nutzerwunsch verwenden).',
    parameters: {
      type: 'object',
      properties: {},
    },
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
  },
  {
    name: 'rememberUser',
    description:
      'Merke dir Infos über den Nutzer (Name, Interessen, Präferenzen, Ort, Beruf, Ziele usw.).',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          enum: [
            'name',
            'interest',
            'preference',
            'location',
            'occupation',
            'company',
            'language',
            'goal',
            'project',
            'skill',
            'birthday',
            'timezone',
            'availability',
            'dislike',
            'note',
          ],
        },
        value: { type: 'string' },
      },
      required: ['key', 'value'],
    },
    minRole: 'user',
    category: 'memory',
    execution: 'server',
  },
  {
    name: 'recallMemory',
    description:
      'Rufe gespeicherte Erinnerungen zum aktuellen Nutzer ab. Nicht für Fragen über Abdulkerim, die Website, Blogposts oder Projekte verwenden.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
    minRole: 'user',
    category: 'memory',
    execution: 'server',
  },
  {
    name: 'recommend',
    description: 'Gib eine personalisierte Empfehlung.',
    parameters: {
      type: 'object',
      properties: {
        topic: { type: 'string' },
      },
      required: ['topic'],
    },
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
  },
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

export const CLIENT_TOOL_NAMES = new Set(
  CLIENT_TOOL_DEFINITIONS.map((tool) => tool.name),
);

export const SERVER_TOOL_NAMES = new Set(
  ROBOT_TOOL_DEFINITIONS.filter((tool) => tool.execution === 'server').map(
    (tool) => tool.name,
  ),
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
