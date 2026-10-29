export function totalVariationDistance(
  counts: readonly number[],
  total: number,
  theoretical: readonly number[],
): number {
  if (counts.length !== theoretical.length) {
    throw new RangeError('counts and theoretical probabilities must have the same length');
  }
  if (total <= 0) return 0;

  let sum = 0;
  for (let i = 0; i < counts.length; i += 1) {
    sum += Math.abs(counts[i] / total - theoretical[i]);
  }
  return Math.min(1, Math.max(0, 0.5 * sum));
}

export function empiricalFrequencies(counts: readonly number[], total: number): number[] {
  if (total <= 0) return counts.map(() => 0);
  return counts.map((count) => count / total);
}

export function describeConvergence(distance: number): string {
  if (distance < 0.01) return '이론값과 거의 일치합니다.';
  if (distance < 0.03) return '이론값에 매우 가깝습니다.';
  if (distance < 0.08) return '이론값에 가까워지고 있습니다.';
  if (distance < 0.15) return '아직 차이가 있지만 닮아가는 중입니다.';
  return '표본이 적어 이론값과 차이가 큽니다.';
}
