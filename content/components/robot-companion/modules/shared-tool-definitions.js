import { ROBOT_MEMORY_KEY_ENUM } from '../../../core/robot-memory-schema.js';

export const SHARED_ROBOT_TOOL_DEFINITIONS = Object.freeze([
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
  },
  {
    name: 'openSearch',
    description: 'Öffne die Website-Suche.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'closeSearch',
    description: 'Schließe die Website-Suche.',
    parameters: {
      type: 'object',
      properties: {},
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
  },
  {
    name: 'scrollTop',
    description: 'Scrolle zum Seitenanfang.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'copyCurrentUrl',
    description: 'Kopiere den aktuellen Seitenlink.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'openImageUpload',
    description: 'Öffne den Bild-Upload im Chat.',
    parameters: {
      type: 'object',
      properties: {},
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
          enum: ROBOT_MEMORY_KEY_ENUM,
        },
        value: { type: 'string' },
      },
      required: ['key', 'value'],
    },
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
  },
]);

export const SHARED_ROBOT_TOOL_DEFINITION_BY_NAME = new Map(
  SHARED_ROBOT_TOOL_DEFINITIONS.map((tool) => [tool.name, tool]),
);

export function getSharedToolDefinition(name) {
  return SHARED_ROBOT_TOOL_DEFINITION_BY_NAME.get(String(name || '').trim());
}
