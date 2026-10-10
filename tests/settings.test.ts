import { describe, expect, it } from 'vitest';
import { createSettingsStore, DEFAULT_SETTINGS, mergeSettings } from '../src/storage/SettingsStore';
import { memoryKeyValueStore } from '../src/storage/keyValue';

describe('mergeSettings', () => {
  it('fills in defaults for empty input', () => {
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings('garbage')).toEqual(DEFAULT_SETTINGS);
  });

  it('clamps out-of-range numeric fields', () => {
    const merged = mergeSettings({
      videosPerSection: 999,
      randomization: -50,
      maxSubscriptionChannels: 1,
      minDurationSec: -5,
    });
    expect(merged.videosPerSection).toBe(30);
    expect(merged.randomization).toBe(0);
    expect(merged.maxSubscriptionChannels).toBe(5);
    expect(merged.minDurationSec).toBe(0);
  });

  it('sanitizes and de-duplicates string lists', () => {
    const merged = mergeSettings({
      includeChannels: ['  @Alpha ', '', '@alpha', 42, 'Beta'] as unknown as string[],
    });
    expect(merged.includeChannels).toEqual(['@Alpha', 'Beta']);
  });

  it('normalizes invalid enum and region values', () => {
    const merged = mergeSettings({
      density: 'weird' as never,
      regionCode: 'usa',
      freshness: 'nope' as never,
    });
    expect(merged.density).toBe('comfortable');
    expect(merged.freshness).toBe('medium');
    expect(merged.regionCode).toBe('US');
  });

  it('coerces category maps', () => {
    const merged = mergeSettings({ categories: { technology: false } });
    expect(merged.categories.technology).toBe(false);
  });
});

describe('SettingsStore', () => {
  it('reads defaults and persists updates', async () => {
    const store = createSettingsStore(memoryKeyValueStore());
    expect((await store.get()).videosPerSection).toBe(DEFAULT_SETTINGS.videosPerSection);
    await store.update({ videosPerSection: 20 });
    expect((await store.get()).videosPerSection).toBe(20);
  });

  it('stores, trims and clears the API key', async () => {
    const store = createSettingsStore(memoryKeyValueStore());
    expect(await store.hasApiKey()).toBe(false);
    await store.setApiKey('  AIzaExampleKey  ');
    expect(await store.getApiKey()).toBe('AIzaExampleKey');
    expect(await store.hasApiKey()).toBe(true);
    await store.setApiKey('');
    expect(await store.hasApiKey()).toBe(false);
  });

  it('recovers from corrupted stored settings', async () => {
    const store = createSettingsStore(memoryKeyValueStore({ settings: 'not-an-object' }));
    expect((await store.get()).version).toBe(DEFAULT_SETTINGS.version);
  });

  it('persists a resample salt used for reshuffling', async () => {
    const store = createSettingsStore(memoryKeyValueStore());
    await store.update({ resampleSalt: 12345 });
    expect((await store.get()).resampleSalt).toBe(12345);
  });
});
