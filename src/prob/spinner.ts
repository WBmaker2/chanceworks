import { mulberry32, type RandomSource } from './rng';

export interface SpinnerSimulation {
  counts: number[];
  outcomes: number[];
  total: number;
  weights: number[];
  seed: number;
}

export function normalizeWeights(weights: readonly number[]): number[] {
  const safe = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 0));
  const sum = safe.reduce((acc, weight) => acc + weight, 0);
  if (sum <= 0) {
    return safe.map(() => (safe.length > 0 ? 1 / safe.length : 0));
  }
  return safe.map((weight) => weight / sum);
}

export function selectWeighted(weights: readonly number[], rng: RandomSource): number {
  const normalized = normalizeWeights(weights);
  const u = rng();
  let cumulative = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    cumulative += normalized[i];
    if (u < cumulative) return i;
  }
  return Math.max(0, normalized.length - 1);
}

export function simulateSpinner(
  weights: readonly number[],
  spins: number,
  seed: number,
  rng: RandomSource = mulberry32(seed),
): SpinnerSimulation {
  const normalized = normalizeWeights(weights);
  const counts = new Array<number>(normalized.length).fill(0);
  const outcomes = new Array<number>(spins);

  for (let i = 0; i < spins; i += 1) {
    const selected = selectWeighted(normalized, rng);
    counts[selected] += 1;
    outcomes[i] = selected;
  }

  return { counts, outcomes, total: spins, weights: normalized, seed };
}
