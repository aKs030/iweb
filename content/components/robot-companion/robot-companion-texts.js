// Text resources for the Robot Companion
// Exported as a constant module

export const robotCompanionTexts = {
  knowledgeBase: {
    start: {
      text: [
        'Hey! Ich bin Jules — dein proaktiver KI-Assistent. Frag mich was, lade ein Bild hoch oder lass mich die Seite für dich steuern! 🤖',
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
      text: 'Wohin soll ich dich bringen? Ich navigiere dich direkt dorthin! 🧭',
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
        { label: 'Witz erzählen', action: 'joke' },
        { label: 'Weltraum Fakt', action: 'fact' },
        { label: 'Mini-Games', action: 'games' },
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
    joke: {
      text: [
        'Was macht ein Pirat am Computer? Er drückt die Enter-Taste!',
        'Warum gehen Geister nicht in den Regen? Damit sie nicht nass werden... nein, damit sie nicht "ge-löscht" werden!',
        'Ein SQL Query kommt in eine Bar, geht zu zwei Tischen und fragt: "Darf ich mich joinen?"',
        'Wie nennt man einen Bumerang, der nicht zurückkommt? Stock.',
      ],
      options: [
        { label: 'Noch einer!', action: 'joke' },
        { label: 'Genug gelacht', action: 'start' },
      ],
    },
    fact: {
      text: [
        'Wusstest du? Ein Tag auf der Venus ist länger als ein Jahr auf der Venus.',
        'Der Weltraum ist völlig still. Es gibt keine Atmosphäre, die Schall überträgt.',
        'Neutronensterne sind so dicht, dass ein Teelöffel davon 6 Milliarden Tonnen wiegen würde!',
        'Es gibt mehr Sterne im Universum als Sandkörner an allen Stränden der Erde.',
      ],
      options: [
        { label: 'Wow, noch einer!', action: 'fact' },
        { label: 'Zurück', action: 'start' },
      ],
    },
    randomProject: {
      text: 'Ich suche etwas raus...',
      options: [],
    },
  },

  moodGreetings: {
    'night-owl': [
      'Noch wach um diese Uhrzeit? Ich auch!',
      'Nachtschicht? Ich bin für dich da!',
      'Die Nacht ist jung! Was kann ich tun?',
    ],
    sleepy: [
      '*gähn* Guten Morgen! Noch etwas müde...',
      "Morgens geht's langsam los... Wie kann ich helfen?",
      'Kaffee wäre jetzt nice... Aber ich bin wach genug für dich!',
    ],
    energetic: [
      'Volle Power! Was kann ich für dich tun?',
      "Let's go! Ich bin bereit!",
      'Energie-Level: Maximum! Lass uns loslegen!',
    ],
    relaxed: [
      'Schöner Abend! Wie kann ich helfen?',
      'Entspannt unterwegs... Was brauchst du?',
      'Feierabend-Vibes! Zeit zum Chillen!',
    ],
    enthusiastic: [
      'Wow, schon wieder hier! Du bist mein Lieblingsbesucher!',
      'Yeah! So viele Interaktionen - ich LIEBE es!',
      'Du bist ja Power-User! Respekt!',
    ],
    normal: [
      'Hey! Wie kann ich helfen?',
      'Hi! Was brauchst du?',
      'Hallo! Ready für Action!',
    ],
  },

  initialBubblePools: [
    ['Hey!', 'Hi!', 'Hallo!', 'Servus!'],
    [
      'Ich bin Cyber, dein Assistent.',
      'Brauchst du Hilfe?',
      'Fragen? Ich bin hier!',
    ],
    [
      'Toll, dass du vorbeischaust!',
      'Willkommen auf der Seite!',
      'Schön, dich zu sehen!',
    ],
    [
      'Soll ich dir was zeigen?',
      'Lust auf einen Rundgang?',
      'Projekte oder Galerie ansehen?',
    ],
    [
      'Klick auf mich für mehr!',
      'Ich helfe dir gern weiter!',
      'Lass uns loslegen!',
    ],
  ],

  contextGreetings: {
    home: [
      'Willkommen! Möchtest du einen Rundgang?',
      'Schön, dass du da bist! Soll ich dir die Highlights zeigen?',
      'Hey! Bereit, die Seite zu erkunden?',
    ],
    hero: [
      'Hey! Bereit für den Einstieg?',
      'Willkommen im Hero-Bereich! Soll ich dich rumführen?',
      'Los geht es! Was möchtest du sehen?',
    ],
    features: [
      'Features entdecken? Ich zeige dir gern die Highlights!',
      'Hier sind die Leistungen — brauchst du eine Übersicht?',
      'Wow, viele coole Features hier! Soll ich erklären?',
      'Alle Features auf einen Blick!',
      'Brauchst du eine Übersicht über die Features?',
      'Die Übersicht hier ist sehr übersichtlich — soll ich helfen?',
    ],
    about: [
      'Neugierig auf den Entwickler?',
      'Hier erfährst du mehr über den Creator!',
      'Die Story dahinter interessiert dich? Lass uns reden!',
    ],
    projects: [
      'Projekte erkunden? Ich zeige dir was Cooles!',
      'Lust auf ein zufälliges Projekt?',
      'So viele spannende Arbeiten! Wo soll ich anfangen?',
    ],
    gallery: [
      'Galerie-Zeit! Lass uns Bilder ansehen!',
      'Fotos durchstöbern? Ich zeige dir die Favoriten!',
      'Schöne Bilder hier! Magst du eine Tour?',
    ],

    footer: [
      'Kontakt oder Impressum gesucht?',
      'Im Footer findest du alle wichtigen Links!',
      'Ganz unten gibts die Infos! Soll ich scrollen?',
    ],
    default: [],
  },

  startMessageSuffix: {
    projects:
      'Du bist auf der Projektseite — willst du ein zufälliges Projekt sehen?',
    gallery: 'Auf der Galerie? Ich kann dir ein paar Favoriten zeigen!',
    about:
      'Auf der Über-Seite — ich kann dir die Bio und den Tech-Stack zeigen!',
    hero: 'Auf der Startseite? Ich kann dir die Highlights zeigen!',
    features:
      'Auf der Feature-Übersicht — interessiert an Details zu einem bestimmten Feature?',
    footer:
      'Im Footer findest du Kontakt & Impressum — soll ich dich dorthin bringen?',
  },

  initialBubbleSequenceConfig: {
    steps: 5,
    displayDuration: 6000, // ms - schnellerer Flow
    pausesAfter: [0, 8000, 10000, 8000, 0], // Variierte Pausen für natürlicheren Rhythmus
  },
};
