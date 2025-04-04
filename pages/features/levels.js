// levels.js - Enthält die Daten für die Spielllevels

const gameLevels = [
    // Level 1: Beispiel basiert auf dem vorherigen Hochformat-Layout
    {
        levelId: 1,
        playerStartRel: { x: 0.1667, y: 0.8750 },
        platformsRel: [
            { x: 0.4000, y: 0.9500, w: 0.1667, h: 20 }, // Breite: 50px
            { x: 0.5333, y: 0.9000, w: 0.1667, h: 20 }, // Breite: 50px
            { x: 0.6667, y: 0.8500, w: 0.1667, h: 20 }, // Breite: 50px
            { x: 0.8000, y: 0.8000, w: 0.2000, h: 20 }, // Breite: 60px
        ],
        coinsRel: [
            { x: 0.9333, y: 0.7250, r: 0.0267 },
        ],
        enemiesRel: [
        ]
    }, // Ende Level 1
    // Füge dieses Objekt zum 'gameLevels' Array in 'levels.js' hinzu.
    // Hinweis: Patrouillenbereich für Gegner muss im Spiel gesetzt werden.
    
    // Level 2: Platzhalter - Erstelle dieses Level mit dem Editor!
    {
      levelId: 2,
      playerStartRel: { x: 0.5, y: 0.9 }, // Start mittig auf Boden
      platformsRel: [
        // { x: 0.0000, y: 0.9500, w: 1.0000, h: 20 }, // Boden
        { x: 0.1, y: 0.8, w: 0.2, h: 20 },
        { x: 0.7, y: 0.7, w: 0.2, h: 20 },
        { x: 0.4, y: 0.55, w: 0.2, h: 20 },
        { x: 0.1, y: 0.4, w: 0.2, h: 20 },
        { x: 0.7, y: 0.3, w: 0.2, h: 20 },
      ],
      coinsRel: [
         { x: 0.15, y: 0.75, r: 0.03 },
         { x: 0.75, y: 0.65, r: 0.03 },
         { x: 0.45, y: 0.50, r: 0.03 },
         { x: 0.15, y: 0.35, r: 0.03 },
         { x: 0.75, y: 0.25, r: 0.03 },
      ],
      enemiesRel: [
         { x: 0.45, y: 0.50, speedFactor: 1.1 }, // Gegner auf mittlerer Plattform
      ]
    }
  
    // Füge hier weitere Level-Objekte hinzu...
   



  ];
  