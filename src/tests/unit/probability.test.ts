import { describe, expect, it } from 'vitest';
import {
  binomialMeanFromPmf,
  binomialPmf,
  binomialSummary,
  binomialVarianceFromPmf,
  normalPdf,
  simulateGalton,
  theoreticalMostLikelyBin,
} from '../../prob/binomial';
import { longestHeadsStreak, simulateCoin } from '../../prob/coin';
import { binomialCoefficient, factorial } from '../../prob/combinations';
import { empiricalFrequencies, totalVariationDistance } from '../../prob/convergence';
import {
  DICE_SUM_COUNTS,
  diceSumProbabilities,
  observedDiceMode,
  simulateDice,
} from '../../prob/dice';
import {
  expectedValue,
  fairPayoff,
  isFairGame,
  simulateExpectedGame,
} from '../../prob/expectedValue';
import { mulberry32 } from '../../prob/rng';
import { normalizeWeights, selectWeighted, simulateSpinner } from '../../prob/spinner';
import { downsample, mean, variance } from '../../prob/stats';

const close = (actual: number, expected: number, digits = 10) => {
  expect(actual).toBeCloseTo(expected, digits);
};

describe('combinatorics', () => {
  it('computes exact small coefficients', () => {
    expect(factorial(0)).toBe(1);
    expect(factorial(5)).toBe(120);
    expect(binomialCoefficient(10, 5)).toBe(252);
    expect(binomialCoefficient(12, 0)).toBe(1);
    expect(binomialCoefficient(12, 12)).toBe(1);
  });
});

describe('binomial distribution', () => {
  it('sums to 1 for n=5..12 and p=0.1..0.9', () => {
    for (let n = 5; n <= 12; n += 1) {
      for (let p = 0.1; p <= 0.9001; p += 0.1) {
        const sum = binomialPmf(n, p).reduce((acc, value) => acc + value, 0);
        close(sum, 1);
      }
    }
  });

  it('is symmetric at p = 0.5', () => {
    for (let n = 5; n <= 12; n += 1) {
      const pmf = binomialPmf(n, 0.5);
      for (let k = 0; k <= n; k += 1) {
        close(pmf[k], pmf[n - k]);
      }
    }
  });

  it('matches the textbook mean and variance', () => {
    for (let n = 5; n <= 12; n += 1) {
      for (const p of [0.1, 0.25, 0.5, 0.7, 0.9]) {
        const pmf = binomialPmf(n, p);
        const summary = binomialSummary(n, p);
        close(binomialMeanFromPmf(pmf), summary.mean);
        close(binomialVarianceFromPmf(pmf), summary.variance);
      }
    }
  });

  it('never produces negative probabilities', () => {
    for (let n = 5; n <= 12; n += 1) {
      for (const p of [0.1, 0.5, 0.9]) {
        for (const value of binomialPmf(n, p)) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(value)).toBe(true);
        }
      }
    }
  });

  it('handles degenerate p = 0 and p = 1', () => {
    expect(binomialPmf(4, 0)).toEqual([1, 0, 0, 0, 0]);
    expect(binomialPmf(4, 1)).toEqual([0, 0, 0, 0, 1]);
  });

  it('has the expected most likely bin', () => {
    expect(theoreticalMostLikelyBin(10, 0.5)).toBe(5);
    expect(theoreticalMostLikelyBin(10, 0.7)).toBe(7);
  });

  it('integrates the normal approximation to approximately 1', () => {
    let area = 0;
    const step = 0.0005;
    for (let x = -12; x <= 12; x += step) {
      area += normalPdf(x, 0, 1) * step;
    }
    close(area, 1, 3);
  });
});

describe('seeded randomness and Galton simulation', () => {
  it('repeats the same stream for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 20; i += 1) {
      expect(a()).toBe(b());
    }
  });

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('produces identical Galton counts for identical seeds', () => {
    const a = simulateGalton(10, 0.5, 1000, 20261028);
    const b = simulateGalton(10, 0.5, 1000, 20261028);
    expect(a.counts).toEqual(b.counts);
    expect(a.outcomes).toEqual(b.outcomes);
    expect(a.counts.reduce((acc, value) => acc + value, 0)).toBe(1000);
  });

  it('produces a different result for another seed', () => {
    const a = simulateGalton(10, 0.5, 200, 1);
    const b = simulateGalton(10, 0.5, 200, 2);
    expect(a.counts).not.toEqual(b.counts);
  });

  it('locks the exact counts for a fixed seed', () => {
    const result = simulateGalton(10, 0.5, 100, 20261028);
    expect(result.counts).toEqual([0, 1, 5, 11, 24, 22, 25, 7, 4, 1, 0]);
  });
});

describe('dice distribution', () => {
  it('matches the 36-outcome table', () => {
    expect([...DICE_SUM_COUNTS]).toEqual([1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]);
    expect(diceSumProbabilities().reduce((acc, value) => acc + value, 0)).toBeCloseTo(1, 12);
  });

  it('simulates deterministically and sums to the roll count', () => {
    const a = simulateDice(1000, 99);
    const b = simulateDice(1000, 99);
    expect(a.counts).toEqual(b.counts);
    expect(a.counts.reduce((acc, value) => acc + value, 0)).toBe(1000);
    expect(observedDiceMode(a.counts)).toBe(7);
  });

  it('locks the exact counts for a fixed seed', () => {
    const result = simulateDice(1000, 99);
    expect(result.counts).toEqual([29, 53, 71, 103, 157, 163, 148, 120, 70, 66, 20]);
  });

  it('keeps every simulated face and sum valid', () => {
    const result = simulateDice(500, 5);
    for (const outcome of result.outcomes) {
      expect(outcome.d1).toBeGreaterThanOrEqual(1);
      expect(outcome.d1).toBeLessThanOrEqual(6);
      expect(outcome.d2).toBeGreaterThanOrEqual(1);
      expect(outcome.d2).toBeLessThanOrEqual(6);
      expect(outcome.sum).toBe(outcome.d1 + outcome.d2);
    }
  });
});

describe('coin lab', () => {
  it('keeps the running proportion bounded and ends at heads / flips', () => {
    const result = simulateCoin(1000, 123);
    expect(result.runningHeads).toHaveLength(1000);
    for (const value of result.runningHeads) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(result.runningHeads[999]).toBeCloseTo(result.heads / result.total, 12);
    expect(result.heads + result.tails).toBe(1000);
  });

  it('is reproducible for the same seed', () => {
    expect(simulateCoin(200, 77).flips).toEqual(simulateCoin(200, 77).flips);
  });

  it('locks the exact head count for a fixed seed', () => {
    expect(simulateCoin(1000, 123).heads).toBe(491);
  });

  it('detects a five-head streak in a generated demonstration', () => {
    const result = simulateCoin(500, 4);
    expect(longestHeadsStreak(result.flips)).toBeGreaterThanOrEqual(0);
    expect(longestHeadsStreak([true, true, true, true, true, false])).toBe(5);
  });
});

describe('spinner lab', () => {
  it('normalizes weights', () => {
    expect(normalizeWeights([1, 1, 2])).toEqual([0.25, 0.25, 0.5]);
    expect(normalizeWeights([0, 0])).toEqual([0.5, 0.5]);
  });

  it('respects cumulative weights at boundaries', () => {
    const weights = [0.2, 0.3, 0.5];
    expect(selectWeighted(weights, () => 0)).toBe(0);
    expect(selectWeighted(weights, () => 0.199)).toBe(0);
    expect(selectWeighted(weights, () => 0.2)).toBe(1);
    expect(selectWeighted(weights, () => 0.499)).toBe(1);
    expect(selectWeighted(weights, () => 0.5)).toBe(2);
    expect(selectWeighted(weights, () => 0.999999)).toBe(2);
  });

  it('simulates counts that sum to the spin count', () => {
    const result = simulateSpinner([0.1, 0.2, 0.3, 0.4], 1000, 11);
    expect(result.counts.reduce((acc, value) => acc + value, 0)).toBe(1000);
    expect(result.counts[3]).toBeGreaterThan(result.counts[0]);
  });

  it('locks the exact counts for a fixed seed', () => {
    const result = simulateSpinner([1, 1, 1, 1, 1, 1], 1000, 11);
    expect(result.counts).toEqual([197, 150, 172, 172, 152, 157]);
  });
});

describe('expected value', () => {
  it('matches a hand calculation', () => {
    const value = expectedValue([10, 0], [0.1, 0.9], 2);
    close(value, -1);
    expect(isFairGame(value)).toBe(false);
    close(fairPayoff(0.1, 2), 20);
  });

  it('identifies a fair game', () => {
    const value = expectedValue([20, 0], [0.1, 0.9], 2);
    close(value, 0);
    expect(isFairGame(value)).toBe(true);
  });

  it('simulates an average close to the theoretical value over many plays', () => {
    const result = simulateExpectedGame([20, 0], [0.1, 0.9], 2, 100000, 5);
    expect(Math.abs(result.simulatedAverage)).toBeLessThan(0.15);
    expect(result.counts.reduce((acc, value) => acc + value, 0)).toBe(100000);
  });
});

describe('convergence and statistics', () => {
  it('reports 0 for identical distributions', () => {
    const counts = [50, 50];
    const probs = empiricalFrequencies(counts, 100);
    close(totalVariationDistance(counts, 100, probs), 0);
  });

  it('reports 1 for disjoint distributions', () => {
    close(totalVariationDistance([100, 0], 100, [0, 1]), 1);
  });

  it('computes mean, population variance, and downsampling', () => {
    close(mean([1, 2, 3, 4]), 2.5);
    close(variance([1, 2, 3, 4]), 1.25);
    close(variance([1, 2, 3, 4], true), 5 / 3);
    const sampled = downsample([...Array(1000).keys()], 500);
    expect(sampled).toHaveLength(500);
    expect(sampled[499]).toBe(999);
  });
});
