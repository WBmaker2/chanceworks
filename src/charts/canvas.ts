export const CHART_COLORS = {
  observed: '#b8f14a',
  observedSoft: 'rgba(184, 241, 74, 0.22)',
  theoretical: '#5eead4',
  theoreticalSoft: 'rgba(94, 234, 212, 0.12)',
  normal: '#ffb347',
  grid: 'rgba(255, 255, 255, 0.08)',
  axis: 'rgba(255, 255, 255, 0.22)',
  text: '#aab6d0',
  textStrong: '#eef2fa',
} as const;

export interface CanvasFrame {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
}

export function prepareCanvas(canvas: HTMLCanvasElement): CanvasFrame {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height, dpr };
}

export function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, width / 2, Math.abs(height)));
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
}

export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0.1;
  if (value <= 0.05) return 0.05;
  if (value <= 0.6) return Math.ceil(value / 0.1) * 0.1;
  if (value <= 1) return Math.ceil(value * 10) / 10;
  return Math.ceil(value * 10) / 10;
}
