export const TOOL_DEFINITIONS = [
  {
    name: "navigate",
    description:
      "Navigiere zu einer Seite: home, projekte, about, gallery, blog, videos, kontakt, impressum, datenschutz.",
    parameters: {
      type: "object",
      properties: {
        page: {
          type: "string",
          enum: [
            "home",
            "projekte",
            "about",
            "gallery",
            "blog",
            "videos",
            "kontakt",
            "impressum",
            "datenschutz",
          ],
        },
      },
      required: ["page"],
    },
    minRole: "user",
    category: "navigation",
  },
  {
    name: "setTheme",
    description: "Wechsle das Farbschema (dark/light/toggle).",
    parameters: {
      type: "object",
      properties: {
        theme: { type: "string", enum: ["dark", "light", "toggle"] },
      },
      required: ["theme"],
    },
    minRole: "user",
    category: "ui",
  },
  {
    name: "searchBlog",
    description: "Suche nach Inhalten auf der Website.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Suchbegriff" },
      },
      required: ["query"],
    },
    minRole: "user",
    category: "search",
  },
  {
    name: "getSiteAnalytics",
    description:
      "Analysiere Seiteninformationen oder Statistiken (mocked/simuliert für Analytics-Demo).",
    parameters: {
      type: "object",
      properties: {
        metric: {
          type: "string",
          description: "Die angeforderte Metrik (z.B. views, performance)",
        },
      },
      required: ["metric"],
    },
    minRole: "trusted",
    category: "analytics",
  },
  {
    name: "toggleMenu",
    description: "Menü öffnen/schließen.",
    parameters: {
      type: "object",
      properties: {
        state: { type: "string", enum: ["open", "close", "toggle"] },
      },
      required: ["state"],
    },
    minRole: "user",
    category: "ui",
  },
  {
    name: "scrollToSection",
    description:
      "Scrolle zu einem Abschnitt (header, footer, contact, hero, projects, skills).",
    parameters: {
      type: "object",
      properties: {
        section: { type: "string" },
      },
      required: ["section"],
    },
    minRole: "user",
    category: "navigation",
  },
  {
    name: "openSearch",
    description: "Öffne die Website-Suche.",
    parameters: {
      type: "object",
      properties: {},
    },
    minRole: "user",
    category: "search",
  },
  {
    name: "closeSearch",
    description: "Schließe die Website-Suche.",
    parameters: {
      type: "object",
      properties: {},
    },
    minRole: "user",
    category: "search",
  },
  {
    name: "focusSearch",
    description:
      "Fokussiere die Suche. Optional kann ein Suchbegriff gesetzt werden.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
    },
    minRole: "user",
    category: "search",
  },
  {
    name: "scrollTop",
    description: "Scrolle zum Seitenanfang.",
    parameters: {
      type: "object",
      properties: {},
    },
    minRole: "user",
    category: "navigation",
  },
  {
    name: "copyCurrentUrl",
    description: "Kopiere den aktuellen Seitenlink.",
    parameters: {
      type: "object",
      properties: {},
    },
    minRole: "user",
    category: "utility",
  },
  {
    name: "openImageUpload",
    description: "Öffne den Bild-Upload im Chat.",
    parameters: {
      type: "object",
      properties: {},
    },
    minRole: "user",
    category: "chat",
  },
  {
    name: "clearChatHistory",
    description:
      "Lösche den lokalen Chatverlauf (nur auf Nutzerwunsch verwenden).",
    parameters: {
      type: "object",
      properties: {},
    },
    minRole: "user",
    category: "chat",
    requiresConfirm: true,
    confirmTitle: "Chat löschen",
    confirmMessage: "Soll der lokale Chatverlauf wirklich gelöscht werden?",
  },
  {
    name: "rememberUser",
    description:
      "Merke dir Infos über den Nutzer (Name, Interessen, Präferenzen, Ort, Beruf, Ziele usw.).",
    parameters: {
      type: "object",
      properties: {
        key: {
          type: "string",
          enum: [
            "name",
            "interest",
            "preference",
            "location",
            "occupation",
            "company",
            "language",
            "goal",
            "project",
            "skill",
            "birthday",
            "timezone",
            "availability",
            "dislike",
            "note",
          ],
        },
        value: { type: "string" },
      },
      required: ["key", "value"],
    },
    minRole: "user",
    category: "memory",
  },
  {
    name: "recallMemory",
    description:
      "Rufe gespeicherte Erinnerungen zum aktuellen Nutzer ab. Nicht für Fragen über Abdulkerim, die Website, Blogposts oder Projekte verwenden.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
    minRole: "user",
    category: "memory",
  },
  {
    name: "recommend",
    description: "Gib eine personalisierte Empfehlung.",
    parameters: {
      type: "object",
      properties: {
        topic: { type: "string" },
      },
      required: ["topic"],
    },
    minRole: "user",
    category: "assistant",
  },
  {
    name: "openExternalLink",
    description: "Öffne einen externen Link (http/https).",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Vollständige URL" },
        newTab: {
          type: "boolean",
          description: "Optional in neuem Tab öffnen (default: true)",
        },
      },
      required: ["url"],
    },
    minRole: "user",
    category: "integration",
    integration: "links",
    requiresConfirm: true,
    confirmTitle: "Externen Link öffnen",
  },
  {
    name: "openSocialProfile",
    description: "Öffne ein Social-Profil von Abdulkerim.",
    parameters: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          enum: ["github", "linkedin", "instagram", "youtube", "x"],
        },
      },
      required: ["platform"],
    },
    minRole: "user",
    category: "integration",
    integration: "social",
  },
  {
    name: "composeEmail",
    description: "Öffne den Mail-Client mit einem vorbefüllten Entwurf.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "string", description: "E-Mail-Empfänger" },
        subject: { type: "string" },
        body: { type: "string" },
      },
      required: ["to"],
    },
    minRole: "user",
    category: "integration",
    integration: "email",
    requiresConfirm: true,
    confirmTitle: "E-Mail-Entwurf öffnen",
  },
  {
    name: "createCalendarReminder",
    description:
      "Öffne eine Kalender-Erinnerung (Google Calendar) mit vorausgefüllten Daten.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        date: { type: "string", description: "Datum, z.B. 2026-03-10" },
        time: { type: "string", description: "Uhrzeit, z.B. 14:30" },
        details: { type: "string" },
        url: { type: "string" },
      },
      required: ["title", "date"],
    },
    minRole: "user",
    category: "integration",
    integration: "calendar",
    requiresConfirm: true,
    confirmTitle: "Kalender-Erinnerung erstellen",
  },
];
