import { describeConvergence } from '../prob/convergence';
import { formatPercent } from '../prob/stats';
import { fromHtml, qs } from '../ui/dom';

export class ConvergenceMeter {
  readonly element: HTMLElement;
  private readonly fill: HTMLElement;
  private readonly value: HTMLElement;
  private readonly description: HTMLElement;
  private readonly meter: HTMLElement;

  constructor(label = '이론과의 차이', hint = '작을수록 이론값에 가깝습니다') {
    this.element = fromHtml(`<div class="convergence">
      <div class="convergence__head">
        <span class="convergence__label">${label}</span>
        <span class="convergence__value" data-role="value">—</span>
      </div>
      <div class="convergence__track" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="${label}">
        <span class="convergence__fill" data-role="fill"></span>
      </div>
      <p class="convergence__hint">${hint}</p>
      <p class="convergence__description" data-role="description" aria-live="polite"></p>
    </div>`);
    this.fill = qs(this.element, '[data-role="fill"]');
    this.value = qs(this.element, '[data-role="value"]');
    this.description = qs(this.element, '[data-role="description"]');
    this.meter = qs(this.element, '[role="meter"]');
  }

  update(distance: number | null, total: number): void {
    if (distance === null || total <= 0) {
      this.value.textContent = '—';
      this.fill.style.width = '0%';
      this.description.textContent = '실험을 실행하면 관찰값과 이론값의 차이를 계산합니다.';
      this.meter.setAttribute('aria-valuenow', '0');
      this.meter.setAttribute('aria-valuetext', '아직 결과가 없습니다');
      this.element.dataset.level = 'empty';
      return;
    }

    const percent = Math.min(100, Math.max(0, distance * 100));
    this.value.textContent = formatPercent(distance, 1);
    this.fill.style.width = `${Math.max(1.5, percent)}%`;
    this.description.textContent = describeConvergence(distance);
    this.meter.setAttribute('aria-valuenow', percent.toFixed(2));
    this.meter.setAttribute(
      'aria-valuetext',
      `이론과의 차이 ${formatPercent(distance, 1)}. ${describeConvergence(distance)}`,
    );
    this.element.dataset.level = distance < 0.03 ? 'good' : distance < 0.08 ? 'close' : 'far';
  }

  destroy(): void {
    this.element.remove();
  }
}
