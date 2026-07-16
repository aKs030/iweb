const randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const GREETINGS = {
  de: {
    morning: ["Die Stille der frühen Stunden"],
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
    morning: ["The silence of early hours"],
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

const HERO_CONTENT = {
  de: {
    title: "Digitale Räume mit Charakter.",
    lede: "Ein Portfolio für interaktive Interfaces, räumliche Experimente und sorgfältig entwickelte Webprodukte.",
  },
  en: {
    title: "Digital spaces with character.",
    lede: "A portfolio of interactive interfaces, spatial experiments, and carefully built web products.",
  },
};

const BUTTONS = {
  de: {
    primary: "Arbeiten entdecken",
    secondary: "Über mich",
  },
  en: {
    primary: "Explore the work",
    secondary: "About me",
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

const getHeroContent = (lang = "de") => {
  const btns = BUTTONS[lang] || BUTTONS["de"];
  const content = HERO_CONTENT[lang] || HERO_CONTENT["de"];
  return {
    ...content,
    primaryBtn: btns.primary,
    secondaryBtn: btns.secondary,
  };
};

export { getGreetingSet, pickGreeting, getHeroContent };
