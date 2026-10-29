import { CHART_POINT_LIMIT } from '../prob/constants';
import { formatPercent } from '../prob/stats';
import { CHART_COLORS, prepareCanvas } from './canvas';

export class RunningProportion {
  private readonly canvas: HTMLCanvasElement;
  private readonly observer: ResizeObserver;
  private values: number[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.observer = new ResizeObserver(() => this.draw());
    this.observer.observe(canvas);
    this.draw();
  }

  setData(values: readonly number[]): void {
    this.values = [...values];
    if (values.length > 0) {
      this.canvas.setAttribute(
        'aria-label',
        `동전 앞면 비율 그래프. ${values.length}번 중 마지막 비율은 ${formatPercent(
          values[values.length - 1],
        )}입니다. 자세한 수치는 아래 표에서 확인할 수 있습니다.`,
      );
    } else {
      this.canvas.setAttribute('aria-label', '아직 동전을 던지지 않았습니다.');
    }
    this.draw();
  }

  destroy(): void {
    this.observer.disconnect();
  }

  private draw(): void {
    const { ctx, width, height } = prepareCanvas(this.canvas);
    const padding = { left: 44, right: 16, top: 24, bottom: 30 };
    const plotWidth = Math.max(10, width - padding.left - padding.right);
    const plotHeight = Math.max(10, height - padding.top - padding.bottom);
    const baseY = padding.top + plotHeight;
    const yFor = (value: number) => baseY - value * plotHeight;

    ctx.font =
      '11px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    ctx.textBaseline = 'middle';

    for (const value of [0, 0.25, 0.5, 0.75, 1]) {
      const y = yFor(value);
      ctx.strokeStyle = value === 0.5 ? 'rgba(255, 179, 71, 0.38)' : CHART_COLORS.grid;
      ctx.lineWidth = 1;
      ctx.setLineDash(value === 0.5 ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(padding.left, y + 0.5);
      ctx.lineTo(padding.left + plotWidth, y + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = value === 0.5 ? CHART_COLORS.normal : CHART_COLORS.text;
      ctx.textAlign = 'right';
      ctx.fillText(formatPercent(value, 0), padding.left - 8, y);
    }

    if (this.values.length === 0) {
      ctx.fillStyle = 'rgba(238, 242, 250, 0.52)';
      ctx.textAlign = 'center';
      ctx.font =
        '12px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
      ctx.fillText('동전을 던지면 앞면 비율이 그려집니다', width / 2, padding.top + plotHeight / 2);
      return;
    }

    const values = this.values;
    const count = Math.min(values.length, CHART_POINT_LIMIT);
    const step = values.length <= 1 ? 1 : (values.length - 1) / Math.max(1, count - 1);
    const points: { x: number; y: number; n: number }[] = [];
    for (let i = 0; i < count; i += 1) {
      const index = Math.min(values.length - 1, Math.round(i * step));
      points.push({
        x: padding.left + (values.length <= 1 ? 0 : (index / (values.length - 1)) * plotWidth),
        y: yFor(values[index]),
        n: index + 1,
      });
    }

    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = CHART_COLORS.observed;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();

    const last = points[points.length - 1];
    ctx.fillStyle = CHART_COLORS.observed;
    ctx.beginPath();
    ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(184, 241, 74, 0.16)';
    ctx.beginPath();
    ctx.arc(last.x, last.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const labelColor = CHART_COLORS.text;
    ctx.fillStyle = labelColor;
    ctx.textAlign = 'left';
    ctx.fillText('1', padding.left, baseY + 16);
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(values.length / 2)}`, padding.left + plotWidth / 2, baseY + 16);
    ctx.textAlign = 'right';
    ctx.fillText(`${values.length}`, padding.left + plotWidth, baseY + 16);

    ctx.fillStyle = CHART_COLORS.observed;
    ctx.textAlign = 'left';
    ctx.font =
      '600 12px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    const label = formatPercent(values[values.length - 1], 1);
    const labelX = Math.min(padding.left + plotWidth - 48, last.x + 10);
    const labelY = Math.max(padding.top + 8, last.y - 10);
    ctx.fillText(label, labelX, labelY);
  }
}
