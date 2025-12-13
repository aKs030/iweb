const greetings = {
  morning: [
    'Guten Morgen und willkommen auf meiner Website!',
    'Schön, dass du früh vorbeischaust!',
    'Moin! Entdecke meine Projekte.',
    'Einen erfolgreichen Start in den Tag!'
  ],
  day: [
    'Herzlich willkommen auf meiner Website!',
    'Schön, dass du hier bist!',
    'Willkommen – viel Spaß beim Stöbern!',
    'Entdecke meine Arbeiten und Projekte!'
  ],
  evening: [
    'Guten Abend und willkommen auf meiner Website!',
    'Schön, dass du abends reinschaust!',
    'Genieße den Abend und viel Spaß auf meiner Seite!',
    'Einen entspannten Abend wünsche ich dir!'
  ],
  night: [
    'Schön, dass du nachts hier bist – willkommen!',
    'Gute Nacht und viel Spaß beim Stöbern!',
    'Späte Besucher sind die besten Besucher!',
    'Willkommen zu später Stunde auf meiner Website!'
  ]
}

export function getGreetingSet(date = new Date()) {
  const hour = date.getHours()
  if (hour >= 5 && hour < 11) return greetings.morning
  if (hour >= 11 && hour < 17) return greetings.day
  if (hour >= 17 && hour < 22) return greetings.evening
  return greetings.night
}

import {randomInt} from '../../content/utils/shared-utilities.js'

export function pickGreeting(lastValue = null, set = getGreetingSet()) {
  if (!Array.isArray(set) || set.length === 0) return ''
  if (set.length === 1) return set[0]
  let candidate = set[randomInt(0, set.length - 1)]
  if (lastValue && set.length > 1) {
    let guard = 0
    while (candidate === lastValue && guard < 10) {
      candidate = set[randomInt(0, set.length - 1)]
      guard++
    }
  }
  return candidate
}
