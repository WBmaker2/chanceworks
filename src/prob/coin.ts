import { mulberry32, type RandomSource } from './rng';

export interface CoinSimulation {
  heads: number;
  tails: number;
  total: number;
  runningHeads: number[];
  flips: boolean[];
  seed: number;
}

export function simulateCoin(
  flips: number,
  seed: number,
  pHeads = 0.5,
  rng: RandomSource = mulberry32(seed),
): CoinSimulation {
  const sequence = new Array<boolean>(flips);
  const runningHeads = new Array<number>(flips);
  let heads = 0;

  for (let i = 0; i < flips; i += 1) {
    const isHeads = rng() < pHeads;
    sequence[i] = isHeads;
    if (isHeads) heads += 1;
    runningHeads[i] = heads / (i + 1);
  }

  return {
    heads,
    tails: flips - heads,
    total: flips,
    runningHeads,
    flips: sequence,
    seed,
  };
}

export function longestHeadsStreak(flips: readonly boolean[]): number {
  let longest = 0;
  let current = 0;
  for (const isHeads of flips) {
    current = isHeads ? current + 1 : 0;
    if (current > longest) longest = current;
  }
  return longest;
}

export function findHeadsRun(
  runLength: number,
  seed: number,
  maxFlips = 20000,
): { flips: boolean[]; runEnd: number; seed: number } {
  const rng = mulberry32(seed);
  const flips: boolean[] = [];
  let streak = 0;

  for (let i = 0; i < maxFlips; i += 1) {
    const isHeads = rng() < 0.5;
    flips.push(isHeads);
    streak = isHeads ? streak + 1 : 0;
    if (streak >= runLength) {
      return { flips, runEnd: flips.length - 1, seed };
    }
  }

  return { flips, runEnd: flips.length - 1, seed };
}
