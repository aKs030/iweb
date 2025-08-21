import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shuffle } from '../../content/webentwicklung/utils/common-utils.js';

// Mock für Math.random, um Aufrufe zu zählen und deterministische Werte zu setzen
beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(Math, 'random');
  Math.random.mockClear();
});

describe('shuffle', () => {
  it('ändert nicht die Länge und enthält alle Elemente', () => {
    const input = [1, 2, 3, 4, 5];
    const output = shuffle(input);
    expect(output).toHaveLength(input.length);
    expect(output.sort((a, b) => a - b)).toEqual(input.slice().sort((a, b) => a - b));
  });

  it('ruft Math.random mehrfach auf', () => {
    Math.random.mockReturnValue(0.1);
    shuffle([1, 2, 3, 4, 5]);
    expect(Math.random).toHaveBeenCalled();
    expect(Math.random).toHaveBeenCalledTimes(4); // n-1 Aufrufe
  });

  it('mutiert das Eingabe-Array nicht', () => {
    const input = [1, 2, 3, 4, 5];
    const inputCopy = [...input];
    shuffle(input);
    expect(input).toEqual(inputCopy);
  });

  it('gibt ein leeres Array für leere Eingabe zurück', () => {
    const output = shuffle([]);
    expect(output).toEqual([]);
    expect(Math.random).not.toHaveBeenCalled();
  });

  it('gibt Array mit einem Element unverändert zurück', () => {
    const input = [42];
    const output = shuffle(input);
    expect(output).toEqual([42]);
    expect(Math.random).not.toHaveBeenCalled();
  });

  it('liefert deterministische Reihenfolge bei festem Math.random', () => {
    Math.random.mockReturnValue(0.5);
    const input = [1, 2, 3, 4, 5];
    const output = shuffle(input);
    expect(output).toEqual([1, 4, 2, 5, 3]);
  });

  it('funktioniert mit verschiedenen Datentypen', () => {
    const input = [1, 'hello', { id: 1 }, null, undefined];
    const output = shuffle(input);
    expect(output).toHaveLength(input.length);
    expect(output.sort()).toEqual(input.slice().sort());
  });

  it('wirft Fehler bei ungültiger Eingabe', () => {
    expect(() => shuffle(null)).toThrow();
    expect(() => shuffle(undefined)).toThrow();
    expect(() => shuffle('not an array')).toThrow();
    expect(() => shuffle(123)).toThrow();
  });

  it('liefert unterschiedliche Reihenfolgen bei mehrfachen Aufrufen', () => {
    const input = [1, 2, 3, 4, 5];
    const outputs = new Set();
    for (let i = 0; i < 10; i++) {
      const output = shuffle([...input]).join(',');
      outputs.add(output);
    }
    expect(outputs.size).toBeGreaterThan(1);
  });
});

