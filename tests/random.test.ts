import { describe, expect, it } from 'vitest';
import { hashSeed, keyedJitter, mulberry32, shuffleInPlace } from '../src/background/feed/random';

describe('hashSeed', () => {
  it('is stable and input-sensitive', () => {
    expect(hashSeed('2026-06-01:1')).toBe(hashSeed('2026-06-01:1'));
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });
});

describe('mulberry32', () => {
  it('is deterministic and bounded', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const values = Array.from({ length: 10 }, () => a());
    expect(values).toEqual(Array.from({ length: 10 }, () => b()));
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('differs across seeds', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('keyedJitter', () => {
  it('is deterministic per key and independent of iteration order', () => {
    expect(keyedJitter('abc', 7)).toBe(keyedJitter('abc', 7));
    expect(keyedJitter('abc', 7)).not.toBe(keyedJitter('abc', 8));
    expect(keyedJitter('abc', 7)).not.toBe(keyedJitter('abd', 7));
    expect(keyedJitter('abc', 7)).toBeLessThan(0.15);
  });
});

describe('shuffleInPlace', () => {
  it('is a deterministic permutation', () => {
    const input = [1, 2, 3, 4, 5];
    const shuffled = shuffleInPlace([...input], mulberry32(3));
    expect([...shuffled].sort((x, y) => x - y)).toEqual(input);
    expect(shuffleInPlace([...input], mulberry32(3))).toEqual(shuffled);
  });
});
