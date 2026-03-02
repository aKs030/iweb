// Text resources for the Robot Companion
// v5: Statische Menüs + Konfiguration. Witze/Fakten werden über AI gestreamt.

export const robotCompanionTexts = {
  knowledgeBase: {
    start: {
      text: [
        'Hey! Ich bin Jules — dein KI-Assistent. Frag mich was, lade ein Bild hoch oder lass mich die Seite für dich steuern! 🤖',
        'Hi! Jules hier — ich kann navigieren, suchen, das Theme wechseln und mich an dich erinnern. Was soll ich tun?',
        'Servus! Ich bin Jules, mehr als nur ein Chatbot. Ich kann die Website aktiv für dich bedienen. Probier es aus!',
        'Hallo! Ich bin Jules — dein intelligenter Begleiter. Tippe etwas oder wähle eine Option! ✨',
      ],
      options: [
        { label: '🧭 Seite erkunden', action: 'explore' },
        { label: '📷 Bild analysieren', action: 'uploadImage' },
        { label: '🔍 Website durchsuchen', action: 'searchWebsite' },
        { label: '🎨 Theme wechseln', action: 'toggleTheme' },
        { label: '🎮 Fun & Extras', action: 'extras' },
      ],
    },
    explore: {
      text: 'Wohin soll ich dich bringen? 🧭',
      options: [
        { label: '🚀 Projekte', url: '/projekte/' },
        { label: '👤 Über Abdulkerim', url: '/about/' },
        { label: '📸 Galerie', url: '/gallery/' },
        { label: '📝 Blog', url: '/blog/' },
        { label: '🎬 Videos', url: '/videos/' },
        { label: '↩️ Zurück', action: 'start' },
      ],
    },
    extras: {
      text: 'Ein bisschen Spaß muss sein! Was möchtest du?',
      options: [
        { label: '😂 Witz erzählen', action: 'joke' },
        { label: '🌌 Weltraum Fakt', action: 'fact' },
        { label: '🎮 Mini-Games', action: 'games' },
        { label: '↩️ Zurück', action: 'start' },
      ],
    },
    games: {
      text: 'Welches Spiel möchtest du spielen?',
      options: [
        { label: 'Tic-Tac-Toe', action: 'playTicTacToe' },
        { label: 'Trivia Quiz', action: 'playTrivia' },
        { label: 'Zahlenraten', action: 'playGuessNumber' },
        { label: 'Zurück', action: 'extras' },
      ],
    },
  },

  moodGreetings: {
    'night-owl': [
      'Noch wach um diese Uhrzeit? Ich auch!',
      'Nachtschicht? Ich bin für dich da!',
    ],
    sleepy: [
      '*gähn* Guten Morgen! Noch etwas müde...',
      'Kaffee wäre jetzt nice... Aber ich bin wach!',
    ],
    energetic: [
      'Volle Power! Was kann ich für dich tun?',
      "Let's go! Ich bin bereit!",
    ],
    relaxed: [
      'Schöner Abend! Wie kann ich helfen?',
      'Entspannt unterwegs... Was brauchst du?',
    ],
    enthusiastic: [
      'Wow, schon wieder hier! Du bist mein Lieblingsbesucher!',
      'Du bist ja Power-User! Respekt!',
    ],
    normal: ['Hey! Wie kann ich helfen?', 'Hi! Was brauchst du?'],
  },

  initialBubblePools: [
    ['Hey!', 'Hi!', 'Hallo!', 'Servus!'],
    ['Brauchst du Hilfe?', 'Fragen? Ich bin hier!'],
    ['Willkommen auf der Seite!', 'Schön, dich zu sehen!'],
    ['Klick auf mich für mehr!', 'Lass uns loslegen!'],
  ],

  contextGreetings: {
    home: ['Willkommen! Möchtest du einen Rundgang?'],
    hero: ['Hey! Bereit für den Einstieg?'],
    about: ['Neugierig auf den Entwickler?'],
    projects: ['Projekte erkunden? Ich zeige dir was Cooles!'],
    gallery: ['Galerie-Zeit! Lass uns Bilder ansehen!'],
    footer: ['Kontakt oder Impressum gesucht?'],
    default: [],
  },

  startMessageSuffix: {
    projects: 'Du bist auf der Projektseite — willst du ein Projekt sehen?',
    gallery: 'Auf der Galerie? Ich kann dir Favoriten zeigen!',
    about: 'Auf der Über-Seite — Bio und Tech-Stack ansehen!',
    hero: 'Auf der Startseite? Ich zeige dir die Highlights!',
    footer: 'Im Footer findest du Kontakt & Impressum.',
  },

  initialBubbleSequenceConfig: {
    steps: 4,
    displayDuration: 6000,
    pausesAfter: [0, 8000, 10000, 0],
  },
};
