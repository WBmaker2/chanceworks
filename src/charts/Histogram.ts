import { normalPdf } from '../prob/binomial';
import { formatPercent } from '../prob/stats';
import { CHART_COLORS, niceMax, prepareCanvas, roundedRect } from './canvas';

export interface HistogramNormal {
  mean: number;
  sd: number;
  label: string;
}

export interface HistogramData {
  labels: string[];
  counts: number[];
  total: number;
  theoretical: number[];
  normal?: HistogramNormal | null;
}

export interface HistogramOptions {
  showTheoretical?: boolean;
  showNormal?: boolean;
  emptyMessage?: string;
}

export class Histogram {
  private readonly canvas: HTMLCanvasElement;
  private readonly observer: ResizeObserver;
  private data: HistogramData = {
    labels: [],
    counts: [],
    total: 0,
    theoretical: [],
  };
  private options: HistogramOptions;

  constructor(canvas: HTMLCanvasElement, options: HistogramOptions = {}) {
    this.canvas = canvas;
    this.options = { showTheoretical: true, showNormal: true, ...options };
    this.observer = new ResizeObserver(() => this.draw());
    this.observer.observe(canvas);
    this.draw();
  }

  setOptions(options: HistogramOptions): void {
    this.options = { ...this.options, ...options };
    this.draw();
  }

  setData(data: HistogramData): void {
    this.data = data;
    this.updateAriaLabel();
    this.draw();
  }

  destroy(): void {
    this.observer.disconnect();
  }

  private updateAriaLabel(): void {
    const { counts, total, labels } = this.data;
    if (total <= 0) {
      this.canvas.setAttribute('aria-label', '아직 실험 결과가 없습니다.');
      return;
    }
    let best = 0;
    for (let i = 1; i < counts.length; i += 1) if (counts[i] > counts[best]) best = i;
    this.canvas.setAttribute(
      'aria-label',
      `관찰 막대그래프. 총 ${total}회, 가장 많은 결과는 ${labels[best] ?? best}로 ${counts[best]}회(${formatPercent(
        counts[best] / total,
      )})입니다. 자세한 수치는 아래 표에서 확인할 수 있습니다.`,
    );
  }

  private draw(): void {
    const { ctx, width, height } = prepareCanvas(this.canvas);
    const { labels, counts, total, theoretical, normal } = this.data;
    if (labels.length === 0) return;

    const padding = { left: 44, right: 12, top: 34, bottom: 30 };
    const plotWidth = Math.max(10, width - padding.left - padding.right);
    const plotHeight = Math.max(10, height - padding.top - padding.bottom);
    const baseY = padding.top + plotHeight;

    let peak = 0;
    if (total > 0) {
      for (const count of counts) peak = Math.max(peak, count / total);
    }
    for (const probability of theoretical) peak = Math.max(peak, probability);

    const normalPoints: { x: number; y: number }[] = [];
    if (normal && this.options.showNormal) {
      const start = -0.6;
      const end = labels.length - 0.4;
      for (let x = start; x <= end; x += 1 / 12) {
        const y = normalPdf(x, normal.mean, normal.sd);
        normalPoints.push({ x, y });
        peak = Math.max(peak, y);
      }
    }

    const yMax = niceMax(peak * 1.12);
    const groupWidth = plotWidth / labels.length;
    const yFor = (value: number) => baseY - (value / yMax) * plotHeight;
    const xFor = (index: number) => padding.left + groupWidth * (index + 0.5);

    ctx.font =
      '11px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    ctx.textBaseline = 'middle';

    const tickStep = yMax <= 0.2 ? 0.05 : yMax <= 0.6 ? 0.1 : 0.2;
    for (let value = 0; value <= yMax + 1e-9; value += tickStep) {
      const y = yFor(value);
      ctx.strokeStyle = value === 0 ? CHART_COLORS.axis : CHART_COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding.left, y + 0.5);
      ctx.lineTo(padding.left + plotWidth, y + 0.5);
      ctx.stroke();
      ctx.fillStyle = CHART_COLORS.text;
      ctx.textAlign = 'right';
      ctx.fillText(formatPercent(value, 0), padding.left - 8, y);
    }

    if (this.options.showTheoretical) {
      for (let i = 0; i < labels.length; i += 1) {
        const probability = theoretical[i] ?? 0;
        const barHeight = Math.max(0, (probability / yMax) * plotHeight);
        const barWidth = Math.max(2, groupWidth * 0.3);
        const x = xFor(i) + groupWidth * 0.12;
        ctx.fillStyle = CHART_COLORS.theoreticalSoft;
        ctx.strokeStyle = 'rgba(94, 234, 212, 0.62)';
        ctx.lineWidth = 1;
        roundedRect(ctx, x, baseY - barHeight, barWidth, barHeight, 3);
        ctx.fill();
        ctx.stroke();
      }
    }

    if (total > 0) {
      for (let i = 0; i < labels.length; i += 1) {
        const frequency = counts[i] / total;
        const barHeight = Math.max(0, (frequency / yMax) * plotHeight);
        const barWidth = Math.max(3, groupWidth * 0.5);
        const x = xFor(i) - barWidth - groupWidth * 0.03;
        const gradient = ctx.createLinearGradient(0, baseY - barHeight, 0, baseY);
        gradient.addColorStop(0, CHART_COLORS.observed);
        gradient.addColorStop(1, 'rgba(184, 241, 74, 0.36)');
        ctx.fillStyle = gradient;
        roundedRect(ctx, x, baseY - barHeight, barWidth, barHeight, 3);
        ctx.fill();

        if (groupWidth >= 30 && counts[i] > 0) {
          ctx.fillStyle = CHART_COLORS.textStrong;
          ctx.textAlign = 'center';
          ctx.font =
            '10px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
          ctx.fillText(String(counts[i]), x + barWidth / 2, baseY - barHeight - 9);
        }
      }
    }

    if (normalPoints.length > 0) {
      ctx.save();
      ctx.strokeStyle = CHART_COLORS.normal;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      normalPoints.forEach((point, index) => {
        const x = padding.left + (point.x + 0.5) * groupWidth;
        const y = yFor(point.y);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    const labelStep = groupWidth < 22 ? 2 : 1;
    ctx.fillStyle = CHART_COLORS.text;
    ctx.textAlign = 'center';
    ctx.font =
      '11px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    for (let i = 0; i < labels.length; i += labelStep) {
      ctx.fillText(labels[i], xFor(i), baseY + 16);
    }

    const legend: { color: string; text: string; dashed?: boolean }[] = [];
    if (total > 0) legend.push({ color: CHART_COLORS.observed, text: '관찰' });
    if (this.options.showTheoretical)
      legend.push({ color: CHART_COLORS.theoretical, text: '이론' });
    if (normalPoints.length > 0 && normal)
      legend.push({ color: CHART_COLORS.normal, text: normal.label, dashed: true });

    let legendX = padding.left + plotWidth;
    ctx.textAlign = 'right';
    ctx.font =
      '10px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    for (let i = legend.length - 1; i >= 0; i -= 1) {
      const item = legend[i];
      ctx.fillStyle = CHART_COLORS.text;
      ctx.fillText(item.text, legendX, 17);
      const textWidth = ctx.measureText(item.text).width;
      const swatchX = legendX - textWidth - 14;
      if (item.dashed) {
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(swatchX, 17);
        ctx.lineTo(swatchX + 9, 17);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = item.color;
        ctx.fillRect(swatchX, 13, 9, 8);
      }
      legendX = swatchX - 12;
    }

    if (total <= 0 && !this.options.showTheoretical) {
      ctx.fillStyle = 'rgba(238, 242, 250, 0.52)';
      ctx.textAlign = 'center';
      ctx.font =
        '12px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
      ctx.fillText(
        this.options.emptyMessage ?? '실험을 실행하면 관찰값이 표시됩니다',
        width / 2,
        padding.top + plotHeight / 2,
      );
    }
  }
}
