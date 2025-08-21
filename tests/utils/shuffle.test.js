import { describe, it, expect, vi } from 'vitest';
import { shuffle } from '../../content/webentwicklung/utils/common-utils.js';

describe('shuffle', () => {
  it('ändert nicht die Länge und enthält alle Elemente', () => {
    const input = [1,2,3,4,5];
    const out = shuffle(input);
    expect(out).toHaveLength(input.length);
    expect(out.sort()).toEqual(input.slice().sort());
  });

  it('ruft Math.random mehrfach auf', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    shuffle([1,2,3,4,5]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
