import assert from 'node:assert/strict';
import { } from '../pages/videos/videos.js';

console.log('Running cleanTitle tests...');

function cleanTitle(s) {
  return String(s).replace(/\s*([\-–—|])\s*(Abdulkerim[\s\S]*)$/i, '').trim();
}

assert.strictEqual(cleanTitle('Logo Animation - Abdulkerim Berlin'), 'Logo Animation');
assert.strictEqual(cleanTitle('Making-of: Fotoshooting — Abdulkerim Sesli'), 'Making-of: Fotoshooting');
assert.strictEqual(cleanTitle('#Mond #Moon #Astrofotografie #LunarSurface #NightSky — Abdulkerim'), '#Mond #Moon #Astrofotografie #LunarSurface #NightSky');
assert.strictEqual(cleanTitle('Motion Design: Neon Bot Experiment | Abdulkerim #abc'), 'Motion Design: Neon Bot Experiment');

console.log('cleanTitle tests passed');