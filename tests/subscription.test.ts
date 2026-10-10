import { describe, expect, it } from 'vitest';
import { rotate } from '../src/background/sources/SubscriptionSource';

describe('rotate', () => {
  it('returns the whole list when it fits the window', () => {
    expect(rotate([1, 2, 3], 5, 0)).toEqual([1, 2, 3]);
  });

  it('takes a deterministic window that advances with rotation', () => {
    expect(rotate([1, 2, 3, 4, 5], 3, 0)).toEqual([1, 2, 3]);
    expect(rotate([1, 2, 3, 4, 5], 3, 1)).toEqual([2, 3, 4]);
    expect(rotate([1, 2, 3, 4, 5], 3, 4)).toEqual([5, 1, 2]);
  });

  it('wraps negative rotation values', () => {
    expect(rotate([1, 2, 3], 2, -1)).toEqual([3, 1]);
  });
});
