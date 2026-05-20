const randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const GREETINGS = {
  de: {
    morning: [
      "Ein neuer Tag, ein neuer Raum",
      "Erstes Licht im digitalen Garten",
      "Wenn Formen langsam erwachen",
      "Morgendämmerung im Browser",
      "Die Stille der frühen Stunden",
    ],
    day: [
      "Im Zentrum der Bewegung",
      "Ein Raum für weiche Kontraste",
      "Licht, Schatten und Struktur",
      "Wo Gedanken Gestalt annehmen",
      "Zwischen Form und Leere",
      "Fließende Augenblicke",
    ],
    evening: [
      "Wenn das Licht weicher wird",
      "Abendliche Reflexionen",
      "Die Dämmerung der Pixel",
      "Ruhige Stunden, klare Linien",
      "Sanftes Ausklingen der Formen",
    ],
    night: [
      "Wenn die Welt schläft, erwachen die Pixel",
      "Nächtliche Tiefen",
      "Im Schatten der digitalen Stille",
      "Verborgenes Leuchten",
      "Ein Raum jenseits der Zeit",
    ],
  },
  en: {
    morning: [
      "A new day, a new space",
      "First light in the digital garden",
      "When shapes slowly awaken",
      "Dawn in the browser",
      "The silence of early hours",
    ],
    day: [
      "At the center of movement",
      "A space for soft contrasts",
      "Light, shadow and structure",
      "Where thoughts take shape",
      "Between form and void",
      "Flowing moments",
    ],
    evening: [
      "When the light softens",
      "Evening reflections",
      "The twilight of pixels",
      "Quiet hours, clear lines",
      "A gentle fading of forms",
    ],
    night: [
      "When the world sleeps, pixels awake",
      "Nocturnal depths",
      "In the shadow of digital silence",
      "Hidden luminescence",
      "A space beyond time",
    ],
  },
};

const TITLES = {
  de: [
    "Digitale Welten, die atmen.",
    "Wo Formen und Farben verschmelzen.",
    "Visuelle Poesie im Raum.",
    "Ein Echo in der digitalen Unendlichkeit.",
    "Fließende Strukturen, greifbar nah.",
    "Licht und Schatten im steten Wandel.",
  ],
  en: [
    "Digital worlds that breathe.",
    "Where forms and colors merge.",
    "Visual poetry in space.",
    "An echo in digital infinity.",
    "Flowing structures, close to the touch.",
    "Light and shadow in constant motion.",
  ],
};

const LEDES = {
  de: [
    "Ein Ort, an dem sich Momente entfalten und visuelle Erzählungen ihren eigenen Rhythmus finden.",
    "Ich gestalte Räume, die nicht nur betrachtet, sondern gefühlt werden – durch sanfte Bewegungen und leise Nuancen.",
    "Eine Sammlung von Augenblicken, festgehalten in einer Symphonie aus Licht, Struktur und Atmosphäre.",
    "Tauche ein in eine Welt, in der die Grenzen zwischen Realität und Vorstellung verschwimmen und Ästhetik lebendig wird.",
  ],
  en: [
    "A place where moments unfold and visual narratives find their own rhythm.",
    "I design spaces that are not just seen, but felt – through gentle movements and quiet nuances.",
    "A collection of moments, captured in a symphony of light, structure, and atmosphere.",
    "Immerse yourself in a world where the boundaries between reality and imagination blur and aesthetics come alive.",
  ],
};

const META_SETS = {
  de: [
    ["Räumliche Tiefe", "Bewegte Bilder", "Licht & Schatten", "Immersive Erlebnisse"],
    ["Sanfte Kontraste", "Fließende Formen", "Visuelle Ruhe", "Atmosphärisch"],
    ["Poesie", "Elegante Bewegung", "Strukturelle Harmonie", "Visueller Klang"],
  ],
  en: [
    ["Spatial Depth", "Moving Images", "Light & Shadow", "Immersive Experiences"],
    ["Soft Contrasts", "Flowing Forms", "Visual Calm", "Atmospheric"],
    ["Poetry", "Elegant Motion", "Structural Harmony", "Visual Sound"],
  ],
};

const BUTTONS = {
  de: {
    primary: ["Eintreten", "Die Reise beginnen", "Eintauchen", "Räume erkunden"],
    secondary: ["Reflexionen", "Gedanken", "Die Stille suchen", "Hinter den Kulissen"],
  },
  en: {
    primary: ["Enter", "Begin the Journey", "Dive In", "Explore Spaces"],
    secondary: ["Reflections", "Thoughts", "Seek the Silence", "Behind the Scenes"],
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
