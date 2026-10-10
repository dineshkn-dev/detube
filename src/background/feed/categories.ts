import type { FeedCategory, Settings } from '../../shared/types';

/**
 * The category registry. Categories are data — adding one is a new entry here,
 * never a new branch in the pipeline. YouTube's taxonomy is coarse, so some
 * requested categories (Programming, Science) are search-backed rather than
 * chart-backed; see the feasibility analysis.
 */
export const DEFAULT_CATEGORIES: FeedCategory[] = [
  {
    id: 'trending',
    label: 'Trending',
    kind: 'chart',
    enabledByDefault: true,
    order: 0,
  },
  {
    id: 'technology',
    label: 'Technology',
    kind: 'chart',
    videoCategoryId: '28',
    enabledByDefault: true,
    order: 10,
  },
  {
    id: 'programming',
    label: 'Programming',
    kind: 'search',
    query: 'programming tutorial software development',
    enabledByDefault: true,
    order: 20,
  },
  {
    id: 'science',
    label: 'Science',
    kind: 'search',
    query: 'science explained documentary',
    enabledByDefault: true,
    order: 30,
  },
  {
    id: 'entertainment',
    label: 'Entertainment',
    kind: 'chart',
    videoCategoryId: '24',
    enabledByDefault: true,
    order: 40,
  },
  {
    id: 'gaming',
    label: 'Gaming',
    kind: 'chart',
    videoCategoryId: '20',
    enabledByDefault: false,
    order: 50,
  },
  {
    id: 'music',
    label: 'Music',
    kind: 'chart',
    videoCategoryId: '10',
    enabledByDefault: false,
    order: 60,
  },
  {
    id: 'news',
    label: 'News & Politics',
    kind: 'chart',
    videoCategoryId: '25',
    enabledByDefault: false,
    order: 70,
  },
  {
    id: 'sports',
    label: 'Sports',
    kind: 'chart',
    videoCategoryId: '17',
    enabledByDefault: false,
    order: 80,
  },
  {
    id: 'education',
    label: 'Education',
    kind: 'chart',
    videoCategoryId: '27',
    enabledByDefault: false,
    order: 90,
  },
  {
    id: 'film',
    label: 'Film & Animation',
    kind: 'chart',
    videoCategoryId: '1',
    enabledByDefault: false,
    order: 100,
  },
];

export function categoryEnabled(category: FeedCategory, settings: Settings): boolean {
  return settings.categories[category.id] ?? category.enabledByDefault;
}

export function enabledCategories(settings: Settings): FeedCategory[] {
  return DEFAULT_CATEGORIES.filter((category) => categoryEnabled(category, settings)).sort(
    (a, b) => a.order - b.order,
  );
}

/** User-defined topics are always search-backed and always enabled. */
export function customTopicCategories(settings: Settings): FeedCategory[] {
  return settings.customTopics.map((topic, index) => ({
    id: `custom:${topic.toLowerCase()}`,
    label: topic,
    kind: 'search',
    query: topic,
    enabledByDefault: true,
    order: 1_000 + index,
  }));
}

export function activeCategories(settings: Settings): FeedCategory[] {
  return [...enabledCategories(settings), ...customTopicCategories(settings)];
}

export function findCategory(id: string): FeedCategory | undefined {
  return DEFAULT_CATEGORIES.find((category) => category.id === id);
}
