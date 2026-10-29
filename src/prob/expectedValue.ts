import { mulberry32, type RandomSource } from './rng';
import { normalizeWeights } from './spinner';

export interface ExpectedGameResult {
  expectedValue: number;
  houseEdge: number;
  simulatedAverage: number;
  counts: number[];
  total: number;
}

export function expectedValue(
  payoffs: readonly number[],
  probabilities: readonly number[],
  cost: number,
): number {
  if (payoffs.length !== probabilities.length) {
    throw new RangeError('payoffs and probabilities must have the same length');
  }
  const normalized = normalizeWeights(probabilities);
  return payoffs.reduce((acc, payoff, index) => acc + payoff * normalized[index], 0) - cost;
}

export function isFairGame(value: number, epsilon = 1e-9): boolean {
  return Math.abs(value) <= epsilon;
}

export function fairPayoff(probability: number, cost: number): number {
  if (probability <= 0) return Number.POSITIVE_INFINITY;
  return cost / probability;
}

export function simulateExpectedGame(
  payoffs: readonly number[],
  probabilities: readonly number[],
  cost: number,
  plays: number,
  seed: number,
  rng: RandomSource = mulberry32(seed),
): ExpectedGameResult {
  if (payoffs.length !== probabilities.length) {
    throw new RangeError('payoffs and probabilities must have the same length');
  }
  const normalized = normalizeWeights(probabilities);
  const counts = new Array<number>(payoffs.length).fill(0);
  let totalPaid = 0;

  for (let i = 0; i < plays; i += 1) {
    const u = rng();
    let cumulative = 0;
    let selected = normalized.length - 1;
    for (let j = 0; j < normalized.length; j += 1) {
      cumulative += normalized[j];
      if (u < cumulative) {
        selected = j;
        break;
      }
    }
    counts[selected] += 1;
    totalPaid += payoffs[selected];
  }

  const averagePayoff = plays > 0 ? totalPaid / plays : 0;
  const value = expectedValue(payoffs, normalized, cost);

  return {
    expectedValue: value,
    houseEdge: value < 0 ? -value : 0,
    simulatedAverage: averagePayoff - cost,
    counts,
    total: plays,
  };
}
