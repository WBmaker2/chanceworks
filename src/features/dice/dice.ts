import type { Store } from '../../app/state';
import { ROUTE_META } from '../../app/routes';
import { ConvergenceMeter } from '../../charts/ConvergenceMeter';
import { Histogram } from '../../charts/Histogram';
import { MAX_ROLLS } from '../../prob/constants';
import { totalVariationDistance } from '../../prob/convergence';
import {
  DICE_SUM_COUNTS,
  diceSumProbabilities,
  observedDiceMode,
  simulateDice,
  type DiceOutcome,
} from '../../prob/dice';
import { randomSeed } from '../../prob/rng';
import { formatPercent } from '../../prob/stats';
import { DiceScene } from '../../render/DiceScene';
import { announce, dataTable, formatInt, fromHtml, qs, qsa } from '../../ui/dom';
import { modelNotice, pageHeader } from '../../ui/page';

export interface LabView {
  element: HTMLElement;
  destroy: () => void;
}

const SUM_LABELS = Array.from({ length: 11 }, (_, index) => String(index + 2));

export function createDiceLab(store: Store): LabView {
  const state = store.get().dice;
  const meta = ROUTE_META.dice;
  const theoretical = diceSumProbabilities();

  const root = fromHtml(`<section class="lab-page">
    ${pageHeader(meta, ['36가지 결과', '합의 분포', '시드 기반'])}
    <div class="lab-grid">
      <aside class="panel lab-controls" aria-labelledby="dice-controls-title">
        <div class="panel-heading"><h2 id="dice-controls-title">실험 설정</h2><span class="panel-kicker">CONFIG</span></div>

        <div class="field">
          <div class="field__label"><label for="dice-rolls">굴리는 횟수</label><output for="dice-rolls" data-role="rolls-out">100회</output></div>
          <input id="dice-rolls" data-role="rolls" type="range" min="1" max="${MAX_ROLLS}" step="1" value="${state.rolls}" />
          <div class="chip-row" role="group" aria-label="주사위 빠른 실행">
            <button class="chip chip--action" type="button" data-run-rolls="100">100번 굴리기</button>
            <button class="chip chip--action" type="button" data-run-rolls="1000">1000번 굴리기</button>
          </div>
        </div>

        <div class="seed-box">
          <div><span class="seed-label">시드</span><code data-role="seed">${state.seed}</code></div>
          <div class="seed-actions">
            <button type="button" class="btn btn-ghost btn-small" data-role="new-seed">새 시드</button>
            <button type="button" class="btn btn-ghost btn-small" data-role="same-run">같은 조건 다시 실행</button>
          </div>
        </div>

        <div class="control-actions">
          <button type="button" class="btn btn-primary btn-pulse" data-role="run">실험 시작</button>
          <button type="button" class="btn btn-secondary" data-role="reset">초기화</button>
        </div>
        <p class="keyboard-hint">Space 실행 · R 초기화</p>
        <div class="dice-result-box">
          <span class="stat-label">마지막 결과</span>
          <p data-role="last-roll" aria-live="polite">—</p>
        </div>
      </aside>

      <section class="panel viewport-panel" aria-labelledby="dice-view-title">
        <div class="viewport-head"><h2 id="dice-view-title">두 주사위</h2><span class="tag">모델 · 시각화</span></div>
        <div class="scene-wrap scene-wrap--dice">
          <canvas data-role="scene" class="scene-canvas" aria-label="두 주사위 3D 장면"></canvas>
          <p class="scene-hint">결과가 정해진 뒤 주사위가 그 눈으로 놓입니다</p>
        </div>
        <p class="scene-readout" data-role="readout" role="status" aria-live="polite">아직 주사위를 굴리지 않았습니다.</p>
        <div class="scene-stats">
          <div><span class="stat-label">총 굴림</span><strong data-role="total">0</strong></div>
          <div><span class="stat-label">관찰 최빈 합</span><strong data-role="observed-mode">—</strong></div>
          <div><span class="stat-label">이론 최빈 합</span><strong>7</strong></div>
          <div><span class="stat-label">마지막 합</span><strong data-role="last-sum">—</strong></div>
        </div>
        ${modelNotice()}
      </section>

      <section class="panel chart-panel" aria-labelledby="dice-chart-title">
        <div class="panel-heading"><h2 id="dice-chart-title">합의 분포</h2><span class="panel-kicker">OBSERVED VS THEORY</span></div>
        <canvas class="chart-canvas" data-role="histogram" aria-label="두 주사위 합의 관찰 및 이론 분포"></canvas>
        <div data-role="table"></div>
      </section>
    </div>

    <div class="lab-bottom">
      <section class="panel convergence-panel" aria-labelledby="dice-convergence-title">
        <div class="panel-heading"><h2 id="dice-convergence-title">수렴 측정</h2><span class="panel-kicker">TOTAL VARIATION</span></div>
        <div data-role="convergence"></div>
        <p class="convergence-note">관찰된 합의 분포가 36가지 결과에서 계산한 이론값에 얼마나 가까운지 보여줍니다.</p>
      </section>
      <section class="panel formula-panel" aria-labelledby="dice-outcomes-title">
        <div class="panel-heading"><h2 id="dice-outcomes-title">36가지 결과표</h2><span class="panel-kicker">SAMPLE SPACE</span></div>
        <div class="outcome-grid" role="img" aria-label="두 주사위의 36가지 합. 7이 여섯 번으로 가장 많습니다.">
          ${Array.from({ length: 36 }, (_, index) => {
            const d1 = Math.floor(index / 6) + 1;
            const d2 = (index % 6) + 1;
            const sum = d1 + d2;
            return `<span class="${sum === 7 ? 'is-seven' : ''}">${sum}</span>`;
          }).join('')}
        </div>
        <p class="formula-note">합이 7이 되는 경우는 (1,6)부터 (6,1)까지 6가지입니다. 그래서 이론 확률은 6/36 = 16.7%입니다.</p>
      </section>
    </div>
  </section>`);

  const rollsInput = qs<HTMLInputElement>(root, '[data-role="rolls"]');
  const rollsOut = qs(root, '[data-role="rolls-out"]');
  const seedOut = qs(root, '[data-role="seed"]');
  const runButton = qs<HTMLButtonElement>(root, '[data-role="run"]');
  const resetButton = qs<HTMLButtonElement>(root, '[data-role="reset"]');
  const newSeedButton = qs<HTMLButtonElement>(root, '[data-role="new-seed"]');
  const sameRunButton = qs<HTMLButtonElement>(root, '[data-role="same-run"]');
  const readout = qs(root, '[data-role="readout"]');
  const lastRoll = qs(root, '[data-role="last-roll"]');
  const totalOut = qs(root, '[data-role="total"]');
  const observedModeOut = qs(root, '[data-role="observed-mode"]');
  const lastSumOut = qs(root, '[data-role="last-sum"]');
  const tableHost = qs(root, '[data-role="table"]');

  const convergence = new ConvergenceMeter();
  qs(root, '[data-role="convergence"]').append(convergence.element);
  const histogram = new Histogram(qs<HTMLCanvasElement>(root, '[data-role="histogram"]'), {
    showTheoretical: true,
    showNormal: false,
  });
  const scene = new DiceScene(qs<HTMLCanvasElement>(root, '[data-role="scene"]'));
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  let counts = new Array<number>(11).fill(0);
  let total = 0;
  let last: DiceOutcome | null = null;
  let running = false;
  let timeout = 0;

  const reducedMotion = () => store.get().preferences.reducedMotion || motionQuery.matches;
  scene.setReducedMotion(reducedMotion());

  function updateChart(): void {
    histogram.setData({
      labels: SUM_LABELS,
      counts,
      total,
      theoretical,
      normal: null,
    });
  }

  function updateStats(): void {
    totalOut.textContent = formatInt(total);
    lastSumOut.textContent = last ? String(last.sum) : '—';
    if (last) {
      lastRoll.textContent = `${last.d1} + ${last.d2} = ${last.sum}`;
    } else {
      lastRoll.textContent = '—';
    }

    if (total > 0) {
      const observed = observedDiceMode(counts);
      const count = counts[observed - 2];
      observedModeOut.textContent = `${observed} (${formatPercent(count / total)})`;
      const tv = totalVariationDistance(counts, total, theoretical);
      readout.textContent = `${formatInt(total)}번 굴린 결과, 합 ${observed}이(가) ${formatInt(count)}번(${formatPercent(count / total)})으로 가장 많았습니다. 이론 확률은 ${formatPercent(theoretical[observed - 2])}이며, 이론과의 차이는 ${formatPercent(tv)}입니다.`;
      convergence.update(tv, total);
    } else {
      observedModeOut.textContent = '—';
      readout.textContent = '아직 주사위를 굴리지 않았습니다. 실험 시작을 누르세요.';
      convergence.update(null, 0);
    }

    tableHost.innerHTML = dataTable(
      '두 주사위 합의 관찰 횟수와 이론 확률',
      ['합', '관찰 횟수', '관찰 비율', '이론 확률', '이론 횟수(36)'],
      SUM_LABELS.map((label, index) => [
        label,
        formatInt(counts[index]),
        formatPercent(total > 0 ? counts[index] / total : 0),
        formatPercent(theoretical[index]),
        String(DICE_SUM_COUNTS[index]),
      ]),
    );
  }

  function updateControls(): void {
    const { rolls, seed } = store.get().dice;
    rollsInput.value = String(rolls);
    rollsOut.textContent = `${formatInt(rolls)}회`;
    seedOut.textContent = String(seed);
    runButton.disabled = running;
    runButton.textContent = running ? '실행 중…' : '실험 시작';
    resetButton.disabled = running;
    qsa<HTMLButtonElement>(root, '[data-run-rolls]').forEach((button) => {
      button.disabled = running;
    });
  }

  function setRunning(value: boolean): void {
    running = value;
    store.update((current) => {
      current.dice.running = value;
    });
    updateControls();
  }

  function reset(): void {
    window.clearTimeout(timeout);
    counts = new Array<number>(11).fill(0);
    total = 0;
    last = null;
    scene.showFaces(1, 1, false);
    setRunning(false);
    updateChart();
    updateStats();
    updateControls();
    announce('주사위 실험을 초기화했습니다.');
  }

  function execute(rolls: number): void {
    if (running) return;
    const { seed } = store.get().dice;
    store.update((current) => {
      current.dice.rolls = rolls;
    });
    const simulation = simulateDice(rolls, seed);
    counts = [...simulation.counts];
    total = simulation.total;
    last = simulation.outcomes[simulation.outcomes.length - 1] ?? null;
    if (last) scene.showFaces(last.d1, last.d2, !reducedMotion());
    updateChart();
    updateStats();
    updateControls();

    if (last) {
      announce(
        `주사위 ${formatInt(total)}번 완료. 마지막 결과는 ${last.d1} 더하기 ${last.d2}, 합 ${last.sum}입니다.`,
      );
    }
    if (reducedMotion()) return;
    setRunning(true);
    timeout = window.setTimeout(() => setRunning(false), 820);
  }

  rollsInput.addEventListener('input', () => {
    const rolls = Number(rollsInput.value);
    store.update((current) => {
      current.dice.rolls = rolls;
    });
    updateControls();
  });

  qsa<HTMLButtonElement>(root, '[data-run-rolls]').forEach((button) => {
    button.addEventListener('click', () => {
      execute(Number(button.dataset.runRolls));
    });
  });

  runButton.addEventListener('click', () => execute(store.get().dice.rolls));
  resetButton.addEventListener('click', reset);

  newSeedButton.addEventListener('click', () => {
    const seed = randomSeed();
    store.update((current) => {
      current.dice.seed = seed;
    });
    reset();
    updateControls();
    announce(`새 시드 ${seed}로 초기화했습니다.`);
  });

  sameRunButton.addEventListener('click', () => {
    reset();
    execute(store.get().dice.rolls);
  });

  const onKeydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName) ||
        target.isContentEditable)
    ) {
      return;
    }
    if (event.code === 'Space') {
      event.preventDefault();
      if (!running) execute(store.get().dice.rolls);
    } else if (event.key.toLowerCase() === 'r') {
      reset();
    }
  };
  window.addEventListener('keydown', onKeydown);

  updateChart();
  updateStats();
  updateControls();

  return {
    element: root,
    destroy: () => {
      window.clearTimeout(timeout);
      window.removeEventListener('keydown', onKeydown);
      histogram.destroy();
      scene.dispose();
    },
  };
}
