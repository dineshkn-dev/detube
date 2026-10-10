import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatRelativeTime,
  formatViews,
  parseIsoDuration,
} from '../src/shared/duration';

describe('parseIsoDuration', () => {
  it('parses hours, minutes and seconds', () => {
    expect(parseIsoDuration('PT1H2M3S')).toBe(3_723);
    expect(parseIsoDuration('PT45S')).toBe(45);
    expect(parseIsoDuration('PT10M')).toBe(600);
    expect(parseIsoDuration('P1DT1H')).toBe(90_000);
  });

  it('returns null for malformed or empty input', () => {
    expect(parseIsoDuration('')).toBeNull();
    expect(parseIsoDuration('P')).toBeNull();
    expect(parseIsoDuration('T1M')).toBeNull();
    expect(parseIsoDuration('nonsense')).toBeNull();
    expect(parseIsoDuration(undefined)).toBeNull();
    expect(parseIsoDuration(null)).toBeNull();
    expect(parseIsoDuration(42)).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formats under an hour as m:ss', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(9)).toBe('0:09');
  });

  it('formats over an hour as h:mm:ss', () => {
    expect(formatDuration(3_723)).toBe('1:02:03');
  });

  it('returns empty string for invalid values', () => {
    expect(formatDuration(null)).toBe('');
    expect(formatDuration(-1)).toBe('');
  });
});

describe('formatViews', () => {
  it('formats magnitudes', () => {
    expect(formatViews(999)).toBe('999 views');
    expect(formatViews(1_500)).toBe('1.5K views');
    expect(formatViews(2_400_000)).toBe('2.4M views');
    expect(formatViews(15_000_000)).toBe('15M views');
  });

  it('returns empty string for null', () => {
    expect(formatViews(null)).toBe('');
  });
});

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-06-01T12:00:00.000Z');

  it('formats recent ages', () => {
    expect(formatRelativeTime('2026-06-01T11:59:30.000Z', now)).toBe('just now');
    expect(formatRelativeTime('2026-06-01T11:00:00.000Z', now)).toBe('1 hour ago');
    expect(formatRelativeTime('2026-05-29T12:00:00.000Z', now)).toBe('3 days ago');
  });

  it('returns empty string for invalid input', () => {
    expect(formatRelativeTime('not-a-date', now)).toBe('');
  });
});
