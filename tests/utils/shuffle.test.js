import { describe, it, expect } from 'vitest';
import * as utils from '../../content/webentwicklung/utils/common-utils.js';
const { shuffle } = utils;

describe('shuffle', () => {
  it('ändert nicht die Länge und enthält alle Elemente', () => {
    const input = [1,2,3,4,5];
    const out = shuffle(input);
    expect(out).toHaveLength(input.length);
    expect(out.sort()).toEqual(input.slice().sort());
  });

  it('erzeugt unterschiedliche Permutationen (zufallsbasiert)', () => {
    const input = [1,2,3,4,5];
    const seen = new Set();
    for (let i = 0; i < 8; i++) seen.add(shuffle(input).join(','));
    expect(seen.size).toBeGreaterThan(1);
  });
});
