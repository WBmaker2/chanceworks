import { mulberry32, type RandomSource } from './rng';

const EPSILON = 1e-12;

export interface GaltonSimulation {
  counts: number[];
  outcomes: number[];
  decisions: boolean[][];
  total: number;
  seed: number;
}

export interface BinomialSummary {
  mean: number;
  variance: number;
  sd: number;
}

export function clampBias(p: number): number {
  if (!Number.isFinite(p)) return 0.5;
  return Math.min(1 - EPSILON, Math.max(EPSILON, p));
}

export function binomialPmf(n: number, p: number): number[] {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError('rows must be a non-negative integer');
  }
  if (n === 0) return [1];
  if (p <= 0) return [1, ...new Array<number>(n).fill(0)];
  if (p >= 1) return [...new Array<number>(n).fill(0), 1];

  const q = clampBias(p);
  const pmf = new Array<number>(n + 1);
  pmf[0] = Math.pow(1 - q, n);

  for (let k = 0; k < n; k += 1) {
    const next = (pmf[k] * (n - k) * q) / ((k + 1) * (1 - q));
    pmf[k + 1] = Math.max(0, next);
  }

  const sum = pmf.reduce((acc, value) => acc + value, 0);
  if (sum > 0) {
    for (let k = 0; k <= n; k += 1) pmf[k] /= sum;
  }
  return pmf;
}

export function binomialSummary(n: number, p: number): BinomialSummary {
  const mean = n * p;
  const variance = n * p * (1 - p);
  return { mean, variance, sd: Math.sqrt(variance) };
}

export function binomialMeanFromPmf(pmf: readonly number[]): number {
  return pmf.reduce((acc, probability, k) => acc + k * probability, 0);
}

export function binomialVarianceFromPmf(pmf: readonly number[]): number {
  const average = binomialMeanFromPmf(pmf);
  return pmf.reduce((acc, probability, k) => acc + (k - average) ** 2 * probability, 0);
}

export function normalPdf(x: number, mean: number, sd: number): number {
  if (sd <= 0 || !Number.isFinite(sd)) return 0;
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

export function simulateGalton(
  rows: number,
  bias: number,
  ballCount: number,
  seed: number,
  rng: RandomSource = mulberry32(seed),
): GaltonSimulation {
  const p = clampBias(bias);
  const counts = new Array<number>(rows + 1).fill(0);
  const outcomes = new Array<number>(ballCount);
  const decisions = new Array<boolean[]>(ballCount);

  for (let i = 0; i < ballCount; i += 1) {
    let rights = 0;
    const path = new Array<boolean>(rows);
    for (let row = 0; row < rows; row += 1) {
      const right = rng() < p;
      path[row] = right;
      if (right) rights += 1;
    }
    decisions[i] = path;
    outcomes[i] = rights;
    counts[rights] += 1;
  }

  return { counts, outcomes, decisions, total: ballCount, seed };
}

export function theoreticalMostLikelyBin(n: number, p: number): number {
  const pmf = binomialPmf(n, p);
  let bestIndex = 0;
  for (let i = 1; i < pmf.length; i += 1) {
    if (pmf[i] > pmf[bestIndex]) bestIndex = i;
  }
  return bestIndex;
}
