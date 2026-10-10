import { DAILY_SEARCH_LIMIT, DAILY_UNIT_LIMIT, type QuotaUsage } from '../shared/types';
import type { KeyValueStore } from '../storage/keyValue';

const QUOTA_KEY = 'quota';

function todayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export interface QuotaTracker {
  read(): Promise<QuotaUsage>;
  add(units: number, searchCalls: number): Promise<QuotaUsage>;
  canSpendSearch(): Promise<boolean>;
  isUnitBudgetLow(): Promise<boolean>;
}

/**
 * Tracks approximate daily quota consumption locally so the UI can warn before
 * Google starts returning 403s. Counters reset when the local date changes.
 */
export function createQuotaTracker(store: KeyValueStore): QuotaTracker {
  async function read(): Promise<QuotaUsage> {
    const raw = (await store.get([QUOTA_KEY]))[QUOTA_KEY] as Partial<QuotaUsage> | undefined;
    if (!raw || raw.date !== todayKey()) {
      return { date: todayKey(), units: 0, searchCalls: 0 };
    }
    return {
      date: raw.date,
      units: Number(raw.units) || 0,
      searchCalls: Number(raw.searchCalls) || 0,
    };
  }

  return {
    read,
    async add(units: number, searchCalls: number): Promise<QuotaUsage> {
      const usage = await read();
      const next: QuotaUsage = {
        date: usage.date,
        units: usage.units + Math.max(0, units),
        searchCalls: usage.searchCalls + Math.max(0, searchCalls),
      };
      await store.set({ [QUOTA_KEY]: next });
      return next;
    },
    async canSpendSearch(): Promise<boolean> {
      const usage = await read();
      return usage.searchCalls < DAILY_SEARCH_LIMIT;
    },
    async isUnitBudgetLow(): Promise<boolean> {
      const usage = await read();
      return usage.units >= DAILY_UNIT_LIMIT * 0.9;
    },
  };
}
