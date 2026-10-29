const factorialCache: number[] = [1];

export function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError('factorial expects a non-negative integer');
  }
  if (n > 170) return Number.POSITIVE_INFINITY;
  for (let i = factorialCache.length; i <= n; i += 1) {
    factorialCache[i] = factorialCache[i - 1] * i;
  }
  return factorialCache[n];
}

export function binomialCoefficient(n: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 0 || k < 0) {
    throw new RangeError('binomialCoefficient expects non-negative integers');
  }
  if (k > n) return 0;
  const m = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= m; i += 1) {
    result = (result * (n - m + i)) / i;
  }
  return Math.round(result);
}
