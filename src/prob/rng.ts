export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type RandomSource = () => number;

export function randomInt(rng: RandomSource, maxExclusive: number): number {
  return Math.min(maxExclusive - 1, Math.floor(rng() * maxExclusive));
}

export function randomSeed(): number {
  const buffer = new Uint32Array(1);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(buffer);
    return buffer[0] % 1_000_000_000;
  }
  return Date.now() % 1_000_000_000;
}

export function normalizeSeed(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.abs(Math.trunc(value)) % 1_000_000_000;
}
