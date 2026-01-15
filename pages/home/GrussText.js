import { randomInt } from '/content/utils/shared-utilities.js';

const GREETINGS = {
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
};

export function getGreetingSet(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return GREETINGS.morning;
  if (hour >= 11 && hour < 17) return GREETINGS.day;
  if (hour >= 17 && hour < 22) return GREETINGS.evening;
  return GREETINGS.night;
}

export function pickGreeting(lastValue = null, set = null) {
  const greetingSet = set ?? getGreetingSet();
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
}
