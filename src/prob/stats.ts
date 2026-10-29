export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

export function variance(values: readonly number[], sample = false): number {
  if (values.length === 0) return 0;
  if (sample && values.length < 2) return 0;
  const average = mean(values);
  const squared = values.reduce((acc, value) => acc + (value - average) ** 2, 0);
  return squared / (sample ? values.length - 1 : values.length);
}

export function downsample<T>(values: readonly T[], limit: number): T[] {
  if (values.length <= limit || limit <= 0) return [...values];
  const step = values.length / limit;
  const result = new Array<T>(limit);
  for (let i = 0; i < limit; i += 1) {
    result[i] = values[Math.min(values.length - 1, Math.floor(i * step))];
  }
  result[limit - 1] = values[values.length - 1];
  return result;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatNumber(value: number, digits = 1): string {
  return value.toFixed(digits);
}

export function modeOfCounts(counts: readonly number[]): number {
  let best = 0;
  for (let i = 1; i < counts.length; i += 1) {
    if (counts[i] > counts[best]) best = i;
  }
  return best;
}
