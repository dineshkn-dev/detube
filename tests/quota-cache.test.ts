import { describe, expect, it } from 'vitest';
import { cached, createTtlCache } from '../src/api/cache';
import { createQuotaTracker } from '../src/api/QuotaTracker';
import { memoryKeyValueStore } from '../src/storage/keyValue';

describe('QuotaTracker', () => {
  it('accumulates units and search calls', async () => {
    const tracker = createQuotaTracker(memoryKeyValueStore());
    await tracker.add(3, 0);
    await tracker.add(2, 1);
    const usage = await tracker.read();
    expect(usage.units).toBe(5);
    expect(usage.searchCalls).toBe(1);
  });

  it('resets when the stored date is not today', async () => {
    const tracker = createQuotaTracker(
      memoryKeyValueStore({ quota: { date: '2000-01-01', units: 500, searchCalls: 90 } }),
    );
    const usage = await tracker.read();
    expect(usage.units).toBe(0);
    expect(usage.searchCalls).toBe(0);
  });

  it('reports when the search bucket is exhausted', async () => {
    const tracker = createQuotaTracker(memoryKeyValueStore());
    expect(await tracker.canSpendSearch()).toBe(true);
    await tracker.add(0, 100);
    expect(await tracker.canSpendSearch()).toBe(false);
  });
});

describe('TtlCache', () => {
  it('expires entries after their TTL', () => {
    let now = 1_000;
    const cache = createTtlCache(() => now);
    cache.set('key', 'value', 100);
    expect(cache.get('key')).toBe('value');
    now += 101;
    expect(cache.get('key')).toBeUndefined();
  });

  it('runs the producer only once while cached', async () => {
    const cache = createTtlCache();
    let calls = 0;
    const producer = async () => {
      calls += 1;
      return 'result';
    };
    expect(await cached(cache, 'k', 1_000, producer)).toBe('result');
    expect(await cached(cache, 'k', 1_000, producer)).toBe('result');
    expect(calls).toBe(1);
  });
});
