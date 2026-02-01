const randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const GREETINGS = {
  de: {
    morning: [
      'Guten Morgen und willkommen auf meiner Website!',
      'Schön, dass du früh vorbeischaust!',
      'Moin! Entdecke meine Projekte.',
      'Einen erfolgreichen Start in den Tag!',
    ],
    day: [
      'Herzlich willkommen auf meiner Website!',
      'Schön, dass du hier bist!',
      'Willkommen – viel Spaß beim Stöbern!',
      'Entdecke meine Arbeiten und Projekte!',
    ],
    evening: [
      'Guten Abend und willkommen auf meiner Website!',
      'Schön, dass du abends reinschaust!',
      'Genieße den Abend und viel Spaß auf meiner Seite!',
      'Einen entspannten Abend wünsche ich dir!',
    ],
    night: [
      'Schön, dass du nachts hier bist – willkommen!',
      'Gute Nacht und viel Spaß beim Stöbern!',
      'Späte Besucher sind die besten Besucher!',
      'Willkommen zu später Stunde auf meiner Website!',
    ],
  },
  en: {
    morning: [
      'Good morning and welcome to my website!',
      'Nice to see you early!',
      'Hi! Discover my projects.',
      'Have a successful start to the day!',
    ],
    day: [
      'Welcome to my website!',
      'Nice to have you here!',
      'Welcome – enjoy browsing!',
      'Discover my work and projects!',
    ],
    evening: [
      'Good evening and welcome!',
      'Nice to see you this evening!',
      'Enjoy the evening and my site!',
      'Wishing you a relaxing evening!',
    ],
    night: [
      'Nice to see you here at night – welcome!',
      'Good night and enjoy browsing!',
      'Late visitors are the best visitors!',
      'Welcome at this late hour!',
    ],
  },
};

export const getGreetingSet = (date = new Date(), lang = 'de') => {
  const hour = date.getHours();
  // Fallback to 'de' if lang not found
  const localizedGreetings = GREETINGS[lang] || GREETINGS['de'];

  if (hour >= 5 && hour < 11) return localizedGreetings.morning;
  if (hour >= 11 && hour < 17) return localizedGreetings.day;
  if (hour >= 17 && hour < 22) return localizedGreetings.evening;
  return localizedGreetings.night;
};

export const pickGreeting = (lastValue = null, set = null) => {
  // Note: set is passed from outside, so it should already be localized
  const greetingSet = set;
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
