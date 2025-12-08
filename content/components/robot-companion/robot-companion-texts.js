// Text resources for the Robot Companion
// This file exports a single global `robotCompanionTexts` object on the window.

window.robotCompanionTexts = {
  knowledgeBase: {
    start: {
      text: [
        'Hallo! Ich bin Cyber, dein virtueller Assistent. 🤖 Wie kann ich dir heute helfen?',
        'Hi! Cyber hier — möchtest du Projekte anschauen oder etwas über den Entwickler erfahren?',
        'Grüß dich! Brauchst du Hilfe oder willst du einfach die Galerie durchstöbern?',
        'Servus! Ich kann dir Projekte, Skills und Kontaktinfos zeigen. Soll ich beginnen?',
        'Hey! Ich bin Cyber — tippe auf mich, um loszulegen! 👋',
      ],
      options: [
        { label: 'Was kannst du?', action: 'skills' },
        { label: 'Projekte zeigen', action: 'projects' },
        { label: 'Über den Dev', action: 'about' },
        { label: 'Fun & Extras', action: 'extras' },
      ],
    },
    skills: {
      text: 'Ich wurde mit HTML, CSS und reinem JavaScript gebaut! Mein Erschaffer beherrscht aber noch viel mehr: React, Node.js, Python und UI/UX Design. Möchtest du Details?',
      options: [
        { label: 'Tech Stack ansehen', url: '/pages/about/about.html#skills' },
        { label: 'Zurück', action: 'start' },
      ],
    },
    about: {
      text: 'Hinter dieser Seite steckt ein leidenschaftlicher Entwickler, der sauberen Code und modernes Design liebt. 👨‍💻',
      options: [
        { label: 'Zur Bio', url: '/pages/about/about.html' },
        { label: 'Kontakt aufnehmen', action: 'contact' },
        { label: 'Zurück', action: 'start' },
      ],
    },
    projects: {
      text: 'Wir haben einige spannende Projekte hier! Von Web-Apps bis zu Design-Experimenten. Wirf einen Blick in die Galerie.',
      options: [
        { label: 'Zur Galerie', url: '/pages/projekte/projekte.html' },
        { label: 'Ein Zufallsprojekt?', action: 'randomProject' },
        { label: 'Zurück', action: 'start' },
      ],
    },
    contact: {
      text: 'Du findest Kontaktmöglichkeiten im Footer der Seite oder im Impressum. Ich kann dich dorthin scrollen!',
      options: [
        { label: 'Zum Footer scrollen', action: 'scrollFooter' },
        { label: 'Social Media?', action: 'socials' },
        { label: 'Alles klar', action: 'start' },
      ],
    },
    socials: {
      text: 'Vernetze dich gerne! Hier sind die Profile:',
      options: [
        { label: 'GitHub', url: 'https://github.com', target: '_blank' },
        { label: 'LinkedIn', url: 'https://linkedin.com', target: '_blank' },
        { label: 'Zurück', action: 'contact' },
      ],
    },
    extras: {
      text: 'Ein bisschen Spaß muss sein! Was möchtest du?',
      options: [
        { label: 'Witz erzählen', action: 'joke' },
        { label: 'Weltraum Fakt', action: 'fact' },
        { label: 'Zurück', action: 'start' },
      ],
    },
    joke: {
      text: [
        'Was macht ein Pirat am Computer? Er drückt die Enter-Taste! 🏴‍☠️',
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
        'Wusstest du? Ein Tag auf der Venus ist länger als ein Jahr auf der Venus. 🪐',
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

  initialBubbleGreetings: [
    'Psst! Brauchst du Hilfe? 👋',
    'Hallo! Ich bin Cyber — möchtest du etwas sehen? 👀',
    'Hey! Hier, wenn du Fragen hast. 🤖',
    'Grüße! Benötigst du Hilfe oder einen Rundgang?',
    'Tippe auf mich, um die Galerie oder Projekte zu sehen!',
  ],

  initialBubblePools: [
    [
      'Hey!',
      'Hi!',
      'Hallo!',
      'Servus!',
    ],
    [
      'Hier, wenn du Fragen hast. 🤖',
      'Ich bin hier, falls du Hilfe brauchst.',
      'Sag Bescheid, wenn du etwas sehen willst.',
      'Klick mich an, um mehr zu erfahren.',
    ],
    [
      'Schön, dass du hier auf der Startseite bist!',
      'Toll, dass du vorbeischaust!',
      'Willkommen — schön, dich da zu haben.',
    ],
    [
      'Möchtest du einen Rundgang?',
      'Soll ich dir ein paar Highlights zeigen?',
      'Willst du die Projekte oder die Galerie sehen?',
    ],
  ],

  contextGreetings: {
    home: [
      'Schön, dass du hier auf der Startseite bist! Möchtest du einen Rundgang?',
      'Startseite-Check: Soll ich dir die Highlights zeigen?'
    ],
    projects: [
      'Neugierig auf Projekte? Ich kann dir ein zufälliges zeigen!',
      'Auf der Projektseite — soll ich ein Projekt hervorheben?'
    ],
    gallery: [
      'In der Galerie — ich zeige dir gern Bilder und Highlights!',
      'Galerie-Modus: Schön, lass uns ein paar Fotos ansehen.',
      'Fotos erkunden? Ich zeige gern Galerien und Highlights!',
    ],
    about: [
      'Hier geht es um den Entwickler — neugierig auf die Bio?',
      'Über-Seite: Möchtest du mehr über den Entwickler erfahren?'
    ],
    cards: [
      'Das Karten-Board zeigt kompakt alle Features — brauchst du eine Übersicht?',
      'Auf den Karten findest du Details zu den einzelnen Inhalten. Soll ich dir helfen?',
    ],
    hero: [
      'Willkommen auf der Startseite! Möchtest du die Highlights sehen?',
      'Schöner erster Eindruck! Soll ich dich rumführen?'
    ],
    features: [
      'Hier findest du die wichtigsten Features. Brauchst du eine kurze Übersicht?',
      'Kurz und knackig: Hier sind unsere Leistungen und Feature-Highlights.'
    ],
    footer: [
      'Im Footer findest du Kontakt, Impressum und Social Links — soll ich nach unten scrollen?',
      'Benötigst du Kontaktinfos oder rechtliche Hinweise? Ich helfe dir zum Footer.'
    ],
    default: [],
  },

  startMessageSuffix: {
    projects: 'Du bist auf der Projektseite — willst du ein zufälliges Projekt sehen?',
    gallery: 'Auf der Galerie? Ich kann dir ein paar Favoriten zeigen!',
    about: 'Auf der Über-Seite — ich kann dir die Bio und den Tech-Stack zeigen!',
    hero: 'Auf der Startseite? Ich kann dir die Highlights zeigen!',
    features: 'Auf der Feature-Übersicht — interessiert an Details zu einem bestimmten Feature?',
    footer: 'Im Footer findest du Kontakt & Impressum — soll ich dich dorthin bringen?',
    cards: 'Auf den Karten? Ich kann dir gern die Übersicht anzeigen!',
  },

  initialBubbleSequenceConfig: {
    steps: 4,
    displayDuration: 10000, // ms
    pausesAfter: [0, 20000, 20000, 0],
  },
};
