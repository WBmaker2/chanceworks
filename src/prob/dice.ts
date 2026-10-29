import { mulberry32, randomInt, type RandomSource } from './rng';

export const DICE_SUM_COUNTS: readonly number[] = [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];
export const DICE_OUTCOME_TOTAL = 36;

export interface DiceOutcome {
  d1: number;
  d2: number;
  sum: number;
}

export interface DiceSimulation {
  counts: number[];
  outcomes: DiceOutcome[];
  total: number;
  seed: number;
}

export function diceSumProbabilities(): number[] {
  return DICE_SUM_COUNTS.map((count) => count / DICE_OUTCOME_TOTAL);
}

export function diceSumCount(count: number): number {
  if (count < 2 || count > 12) return 0;
  return 6 - Math.abs(count - 7);
}

export function rollDie(rng: RandomSource): number {
  return randomInt(rng, 6) + 1;
}

export function simulateDice(
  rolls: number,
  seed: number,
  rng: RandomSource = mulberry32(seed),
): DiceSimulation {
  const counts = new Array<number>(11).fill(0);
  const outcomes = new Array<DiceOutcome>(rolls);

  for (let i = 0; i < rolls; i += 1) {
    const d1 = rollDie(rng);
    const d2 = rollDie(rng);
    const sum = d1 + d2;
    counts[sum - 2] += 1;
    outcomes[i] = { d1, d2, sum };
  }

  return { counts, outcomes, total: rolls, seed };
}

export function observedDiceMode(counts: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < counts.length; i += 1) {
    if (counts[i] > counts[best]) best = i;
  }
  return best + 2;
}
