const randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const GREETINGS = {
  de: {
    morning: [
      "Guten Morgen",
      "Schön, dass du da bist",
      "Früher Blick ins Portfolio",
      "Willkommen in meiner Welt",
      "Start in die Build Notes",
    ],
    day: [
      "Willkommen im Portfolio",
      "Schön, dass du da bist",
      "Lass uns etwas erschaffen",
      "Willkommen in meiner Welt",
      "Öffentliches Arbeitsfeld",
      "Build Notes & Experimente",
    ],
    evening: [
      "Guten Abend",
      "Abendliche Build Notes",
      "Willkommen in meiner Welt",
      "Schön, dass du da bist",
      "Portfolio in Bewegung",
    ],
    night: [
      "Späte Session",
      "Nachtschicht im Portfolio",
      "Schön, dass du da bist",
      "Willkommen in meiner Welt",
      "Build Notes bei Nacht",
    ],
  },
  en: {
    morning: [
      "Good morning",
      "Glad you're here",
      "Early look into the portfolio",
      "Welcome to my world",
      "Starting the build notes",
    ],
    day: [
      "Welcome to the portfolio",
      "Glad you're here",
      "Let's build something",
      "Welcome to my world",
      "Public work in progress",
      "Build notes & experiments",
    ],
    evening: [
      "Good evening",
      "Evening build notes",
      "Welcome to my world",
      "Glad you're here",
      "Portfolio in motion",
    ],
    night: [
      "Late session",
      "Night shift in the portfolio",
      "Welcome to my world",
      "Glad you're here",
      "Build notes after dark",
    ],
  },
};

const TITLES = {
  de: [
    "Hier atmet jedes Interface.",
    "Ein Raum für kühne Web-Momente.",
    "Pixel, Poesie und Performance.",
    "Gestaltete Neugier im Browser.",
    "Wo Code zum Erlebnis wird.",
    "Digitale Szenen mit Charakter.",
  ],
  en: [
    "Where every interface breathes.",
    "A space for bold web moments.",
    "Pixels, poetry and performance.",
    "Curiosity designed for the browser.",
    "Where code becomes an experience.",
    "Digital scenes with character.",
  ],
};

const LEDES = {
  de: [
    "Ein Portfolio als Kaleidoskop aus Interfaces, Experimenten, Motion und Build Notes.",
    "Ich erzähle via Web, Video und Code von Formen, Räumen und Körpern in Bewegung.",
    "Design, Technik und visuelle Narrative treffen hier aufeinander – intensiv und offen.",
    "Labor für digitale Ästhetik: atmosphärisch, präzise und immer in Bewegung.",
  ],
  en: [
    "A portfolio as a kaleidoscope of interfaces, experiments, motion and build notes.",
    "I tell stories through web, video and code about forms, spaces and movement.",
    "Design, tech and visual narrative meet here – intense, precise and alive.",
    "A lab for digital aesthetics: atmospheric, exact, and always evolving.",
  ],
};

const META_SETS = {
  de: [
    ["JavaScript ES2023+", "Three.js / WebGL", "AI Search & Chat", "Photo / Motion"],
    ["WebGL Art", "Modern Frontend", "Performance Ops", "Creative Coding"],
    ["Interactive Design", "Full-Stack Dev", "Technical SEO", "Digital Journal"],
  ],
  en: [
    ["JavaScript ES2023+", "Three.js / WebGL", "AI Search & Chat", "Photo / Motion"],
    ["WebGL Art", "Modern Frontend", "Performance Ops", "Creative Coding"],
    ["Interactive Design", "Full-Stack Dev", "Technical SEO", "Digital Journal"],
  ],
};

const BUTTONS = {
  de: {
    primary: ["Selected Work", "Projekte entdecken", "Zum Portfolio", "Cases ansehen"],
    secondary: ["Profil", "Über mich", "Hintergrund", "Background"],
  },
  en: {
    primary: ["Selected Work", "Explore Projects", "View Portfolio", "See Cases"],
    secondary: ["Profile", "About Me", "Background", "Bio"],
  },
};

const getGreetingSet = (date = new Date(), lang = "de") => {
  const hour = date.getHours();
  const localizedGreetings = GREETINGS[lang] || GREETINGS["de"];

  if (hour >= 5 && hour < 11) return localizedGreetings.morning;
  if (hour >= 11 && hour < 17) return localizedGreetings.day;
  if (hour >= 17 && hour < 22) return localizedGreetings.evening;
  return localizedGreetings.night;
};

const pickGreeting = (lastValue = null, set = null) => {
  const greetingSet = set == null ? getGreetingSet() : set;
  if (!Array.isArray(greetingSet) || greetingSet.length === 0) return "";
  const candidates =
    greetingSet.length > 1 ? greetingSet.filter(greeting => greeting !== lastValue) : greetingSet;
  return candidates[randomInt(0, candidates.length - 1)];
};

const getRandomItem = (obj, lang = "de") => {
  const set = obj[lang] || obj["de"];
  return set[randomInt(0, set.length - 1)];
};

const getHeroContent = (lang = "de") => {
  const btns = BUTTONS[lang] || BUTTONS["de"];
  return {
    title: getRandomItem(TITLES, lang),
    lede: getRandomItem(LEDES, lang),
    meta: getRandomItem(META_SETS, lang),
    primaryBtn: btns.primary[randomInt(0, btns.primary.length - 1)],
    secondaryBtn: btns.secondary[randomInt(0, btns.secondary.length - 1)],
  };
};

export { getGreetingSet, pickGreeting, getHeroContent };
