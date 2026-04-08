const randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const GREETINGS = {
  de: {
    morning: [
      'Guten Morgen',
      'Berlin · Digital Lab',
      'Früher Blick ins Portfolio',
      'Start in die Build Notes',
    ],
    day: [
      'Willkommen im Portfolio',
      'Berlin · Digital Lab',
      'Öffentliches Arbeitsfeld',
      'Build Notes & Experimente',
    ],
    evening: [
      'Guten Abend',
      'Abendliche Build Notes',
      'Berlin · Digital Lab',
      'Portfolio in Bewegung',
    ],
    night: [
      'Späte Session',
      'Nachtschicht im Portfolio',
      'Berlin · Digital Lab',
      'Build Notes bei Nacht',
    ],
  },
  en: {
    morning: [
      'Good morning',
      'Berlin · Digital Lab',
      'Early look into the portfolio',
      'Starting the build notes',
    ],
    day: [
      'Welcome to the portfolio',
      'Berlin · Digital Lab',
      'Public work in progress',
      'Build notes & experiments',
    ],
    evening: [
      'Good evening',
      'Evening build notes',
      'Berlin · Digital Lab',
      'Portfolio in motion',
    ],
    night: [
      'Late session',
      'Night shift in the portfolio',
      'Berlin · Digital Lab',
      'Build notes after dark',
    ],
  },
};

const getGreetingSet = (date = new Date(), lang = 'de') => {
  const hour = date.getHours();
  // Fallback to 'de' if lang not found
  const localizedGreetings = GREETINGS[lang] || GREETINGS['de'];

  if (hour >= 5 && hour < 11) return localizedGreetings.morning;
  if (hour >= 11 && hour < 17) return localizedGreetings.day;
  if (hour >= 17 && hour < 22) return localizedGreetings.evening;
  return localizedGreetings.night;
};

const pickGreeting = (lastValue = null, set = null) => {
  // Note: set is passed from outside, so it should already be localized
  const greetingSet = set == null ? getGreetingSet() : set;
  if (!Array.isArray(greetingSet) || greetingSet.length === 0) return '';
  if (greetingSet.length === 1) return greetingSet[0];

  let candidate = greetingSet[randomInt(0, greetingSet.length - 1)];

  if (lastValue && greetingSet.length > 1) {
    let attempts = 0;
    while (candidate === lastValue && attempts < 10) {
      candidate = greetingSet[randomInt(0, greetingSet.length - 1)];
      attempts++;
    }
  }

  return candidate;
};

/* Exported for tests but primarily used via global assignment in this file */
export { getGreetingSet, pickGreeting };
