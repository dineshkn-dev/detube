/** FNV-1a 32-bit hash. Stable across runs and platforms. */
export function hashSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Deterministic PRNG — same seed always yields the same sequence. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Fisher–Yates shuffle using a supplied deterministic RNG. Mutates in place. */
export function shuffleInPlace<T>(items: T[], rng: () => number): T[] {
  for (let index = items.length - 1; index > 0; index--) {
    const swap = Math.floor(rng() * (index + 1));
    const temp = items[index] as T;
    items[index] = items[swap] as T;
    items[swap] = temp;
  }
  return items;
}

/** Stable per-key jitter in [0, magnitude). Independent of iteration order. */
export function keyedJitter(key: string, seed: number, magnitude = 0.15): number {
  return mulberry32((hashSeed(key) ^ seed) >>> 0)() * magnitude;
}
