import type { Store } from '../../app/state';
import { ROUTE_META } from '../../app/routes';
import { ConvergenceMeter } from '../../charts/ConvergenceMeter';
import { Histogram } from '../../charts/Histogram';
import { binomialPmf, binomialSummary, simulateGalton } from '../../prob/binomial';
import {
  MAX_BALLS,
  MAX_BIAS,
  MAX_ROWS,
  MAX_VISIBLE_BALLS,
  MIN_BIAS,
  MIN_ROWS,
} from '../../prob/constants';
import { totalVariationDistance } from '../../prob/convergence';
import { randomSeed } from '../../prob/rng';
import { formatPercent } from '../../prob/stats';
import { GaltonScene } from '../../render/GaltonScene';
import { announce, dataTable, formatInt, fromHtml, qs, qsa } from '../../ui/dom';
import { modelNotice, pageHeader } from '../../ui/page';

export interface LabView {
  element: HTMLElement;
  destroy: () => void;
}

export function createGaltonLab(store: Store): LabView {
  const state = store.get().galton;
  const meta = ROUTE_META.galton;

  const root = fromHtml(`<section class="lab-page">
    ${pageHeader(meta, ['시드 기반 모의실험', '3D 시각화', '큰 수의 법칙'])}
    <div class="lab-grid">
      <aside class="panel lab-controls" aria-labelledby="galton-controls-title">
        <div class="panel-heading">
          <h2 id="galton-controls-title">실험 설정</h2>
          <span class="panel-kicker">CONFIG</span>
        </div>

        <div class="field">
          <div class="field__label"><label for="galton-rows">줄 수</label><output for="galton-rows" data-role="rows-out">10줄</output></div>
          <input id="galton-rows" data-role="rows" type="range" min="${MIN_ROWS}" max="${MAX_ROWS}" step="1" value="${state.rows}" />
          <div class="field__scale"><span>${MIN_ROWS}</span><span>${MAX_ROWS}</span></div>
        </div>

        <div class="field">
          <div class="field__label"><label for="galton-bias">오른쪽으로 갈 확률</label><output for="galton-bias" data-role="bias-out">50%</output></div>
          <input id="galton-bias" data-role="bias" type="range" min="${MIN_BIAS}" max="${MAX_BIAS}" step="0.05" value="${state.bias}" />
          <div class="field__scale"><span>${Math.round(MIN_BIAS * 100)}%</span><span>${Math.round(MAX_BIAS * 100)}%</span></div>
        </div>

        <div class="field">
          <div class="field__label"><label for="galton-balls">공 개수</label><output for="galton-balls" data-role="balls-out">100개</output></div>
          <input id="galton-balls" data-role="balls" type="range" min="1" max="${MAX_BALLS}" step="1" value="${state.ballCount}" />
          <div class="chip-row" role="group" aria-label="공 개수 빠른 선택">
            <button class="chip" type="button" data-count="10">10</button>
            <button class="chip" type="button" data-count="100">100</button>
            <button class="chip" type="button" data-count="1000">1000</button>
          </div>
        </div>

        <div class="field">
          <div class="field__label"><label for="galton-speed">속도</label><output for="galton-speed" data-role="speed-out">1.0×</output></div>
          <input id="galton-speed" data-role="speed" type="range" min="0.5" max="4" step="0.1" value="${state.speed}" />
        </div>

        <div class="field">
          <span class="field__label">모드</span>
          <div class="segmented" role="group" aria-label="실험 모드">
            <button type="button" class="segmented__btn" data-mode="batch">일괄</button>
            <button type="button" class="segmented__btn" data-mode="slow">한 개씩</button>
          </div>
          <p class="field__hint" data-role="mode-hint">한 번에 여러 공을 떨어뜨립니다.</p>
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
        <p class="keyboard-hint">Space 실행 · S 모드 전환 · R 초기화</p>
      </aside>

      <section class="panel viewport-panel" aria-labelledby="galton-view-title">
        <div class="viewport-head">
          <h2 id="galton-view-title">3D 갈튼 보드</h2>
          <span class="tag">모델 · 시각화</span>
        </div>
        <div class="scene-wrap">
          <canvas data-role="scene" class="scene-canvas" aria-label="갈튼 보드 3D 장면. 공이 못을 지나 아래 칸으로 떨어집니다."></canvas>
          <p class="scene-hint">드래그로 회전 · 휠/핀치로 확대</p>
        </div>
        <p class="scene-readout" data-role="readout" role="status" aria-live="polite">
          아직 공을 떨어뜨리지 않았습니다. 실험 시작을 누르세요.
        </p>
        <div class="scene-stats">
          <div><span class="stat-label">표본 수</span><strong data-role="total">0</strong></div>
          <div><span class="stat-label">애니메이션 표본</span><strong data-role="animated">—</strong></div>
          <div><span class="stat-label">관찰 최빈 칸</span><strong data-role="observed-mode">—</strong></div>
          <div><span class="stat-label">이론 최빈 칸</span><strong data-role="theory-mode">—</strong></div>
        </div>
        ${modelNotice()}
      </section>

      <section class="panel chart-panel" aria-labelledby="galton-chart-title">
        <div class="panel-heading">
          <h2 id="galton-chart-title">분포 비교</h2>
          <span class="panel-kicker">FREQUENCY</span>
        </div>
        <div class="toggle-row">
          <label class="switch"><input type="checkbox" data-role="show-theory" /> <span>이론 막대</span></label>
          <label class="switch"><input type="checkbox" data-role="show-normal" /> <span>정규분포 근사</span></label>
        </div>
        <p class="chart-note" data-role="normal-note" hidden>정규분포 근사는 8줄 이상에서만 표시됩니다. 참고용입니다.</p>
        <canvas class="chart-canvas" data-role="histogram" aria-label="갈튼 보드 관찰 및 이론 분포 막대그래프"></canvas>
        <div data-role="table"></div>
      </section>
    </div>

    <div class="lab-bottom">
      <section class="panel convergence-panel" aria-labelledby="galton-convergence-title">
        <div class="panel-heading">
          <h2 id="galton-convergence-title">수렴 측정</h2>
          <span class="panel-kicker">TOTAL VARIATION</span>
        </div>
        <div data-role="convergence"></div>
        <p class="convergence-note">표본이 늘수록 차이는 대체로 줄어들지만, 매 시행마다 반드시 줄어드는 것은 아닙니다.</p>
      </section>
      <section class="panel formula-panel" aria-labelledby="galton-formula-title">
        <div class="panel-heading">
          <h2 id="galton-formula-title">이론 모델</h2>
          <span class="panel-kicker">BINOMIAL</span>
        </div>
        <p class="formula">P(k) = <span class="formula__accent">C(n, k)</span> · p<sup>k</sup> · (1−p)<sup>n−k</sup></p>
        <div class="formula-grid">
          <div><span>n</span><strong data-role="formula-n">10</strong><small>줄 수</small></div>
          <div><span>p</span><strong data-role="formula-p">0.50</strong><small>오른쪽 확률</small></div>
          <div><span>μ</span><strong data-role="formula-mean">5.0</strong><small>평균 칸</small></div>
          <div><span>σ</span><strong data-role="formula-sd">1.58</strong><small>표준편차</small></div>
        </div>
      </section>
    </div>
  </section>`);

  const rowsInput = qs<HTMLInputElement>(root, '[data-role="rows"]');
  const biasInput = qs<HTMLInputElement>(root, '[data-role="bias"]');
  const ballsInput = qs<HTMLInputElement>(root, '[data-role="balls"]');
  const speedInput = qs<HTMLInputElement>(root, '[data-role="speed"]');
  const rowsOut = qs(root, '[data-role="rows-out"]');
  const biasOut = qs(root, '[data-role="bias-out"]');
  const ballsOut = qs(root, '[data-role="balls-out"]');
  const speedOut = qs(root, '[data-role="speed-out"]');
  const seedOut = qs(root, '[data-role="seed"]');
  const modeHint = qs(root, '[data-role="mode-hint"]');
  const runButton = qs<HTMLButtonElement>(root, '[data-role="run"]');
  const resetButton = qs<HTMLButtonElement>(root, '[data-role="reset"]');
  const newSeedButton = qs<HTMLButtonElement>(root, '[data-role="new-seed"]');
  const sameRunButton = qs<HTMLButtonElement>(root, '[data-role="same-run"]');
  const showTheory = qs<HTMLInputElement>(root, '[data-role="show-theory"]');
  const showNormal = qs<HTMLInputElement>(root, '[data-role="show-normal"]');
  const normalNote = qs(root, '[data-role="normal-note"]');
  const readout = qs(root, '[data-role="readout"]');
  const totalOut = qs(root, '[data-role="total"]');
  const animatedOut = qs(root, '[data-role="animated"]');
  const observedModeOut = qs(root, '[data-role="observed-mode"]');
  const theoryModeOut = qs(root, '[data-role="theory-mode"]');
  const formulaN = qs(root, '[data-role="formula-n"]');
  const formulaP = qs(root, '[data-role="formula-p"]');
  const formulaMean = qs(root, '[data-role="formula-mean"]');
  const formulaSd = qs(root, '[data-role="formula-sd"]');
  const tableHost = qs(root, '[data-role="table"]');
  const sceneCanvas = qs<HTMLCanvasElement>(root, '[data-role="scene"]');

  const convergence = new ConvergenceMeter();
  qs(root, '[data-role="convergence"]').append(convergence.element);
  const histogram = new Histogram(qs<HTMLCanvasElement>(root, '[data-role="histogram"]'), {
    showTheoretical: store.get().preferences.showTheoretical,
    showNormal: store.get().preferences.showNormalCurve,
  });
  const scene = new GaltonScene(sceneCanvas);
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  let counts = new Array<number>(state.rows + 1).fill(0);
  let total = 0;
  let running = false;
  let lastAnimationCount = 0;
  let animationToken = 0;

  const reducedMotion = () => store.get().preferences.reducedMotion || motionQuery.matches;

  scene.setReducedMotion(reducedMotion());
  scene.setConfig(state.rows, state.seed);

  function labels(rows: number): string[] {
    return Array.from({ length: rows + 1 }, (_, index) => String(index));
  }

  function theoreticalModeIndices(rows: number, bias: number): number[] {
    const pmf = binomialPmf(rows, bias);
    const best = Math.max(...pmf);
    return pmf
      .map((probability, index) => ({ probability, index }))
      .filter((entry) => Math.abs(entry.probability - best) < 1e-9)
      .map((entry) => entry.index);
  }

  function modeLabel(indices: number[]): string {
    if (indices.length === 0) return '—';
    if (indices.length === 1) return `${indices[0]}번 칸`;
    if (indices.length === 2) return `${indices[0]}·${indices[1]}번 칸`;
    return `${indices[0]}번 외 ${indices.length - 1}칸`;
  }

  function transform(rows: number, bias: number) {
    const pmf = binomialPmf(rows, bias);
    const summary = binomialSummary(rows, bias);
    return { pmf, summary };
  }

  function updateChart(): void {
    const { rows, bias } = store.get().galton;
    const { pmf, summary } = transform(rows, bias);
    const showNormalCurve = showNormal.checked && rows >= 8;
    normalNote.hidden = !(showNormal.checked && rows < 8);
    histogram.setOptions({
      showTheoretical: showTheory.checked,
      showNormal: showNormalCurve,
    });
    histogram.setData({
      labels: labels(rows),
      counts,
      total,
      theoretical: pmf,
      normal: showNormalCurve
        ? { mean: summary.mean, sd: summary.sd, label: '정규분포 근사' }
        : null,
    });
  }

  function updateStats(): void {
    const { rows, bias } = store.get().galton;
    const { pmf, summary } = transform(rows, bias);
    const theoryMode = theoreticalModeIndices(rows, bias);

    formulaN.textContent = String(rows);
    formulaP.textContent = bias.toFixed(2);
    formulaMean.textContent = summary.mean.toFixed(1);
    formulaSd.textContent = summary.sd.toFixed(2);
    theoryModeOut.textContent = modeLabel(theoryMode);
    totalOut.textContent = formatInt(total);
    animatedOut.textContent =
      total <= 0
        ? '—'
        : store.get().galton.mode === 'slow'
          ? '1개'
          : `${formatInt(Math.min(MAX_VISIBLE_BALLS, lastAnimationCount || total))}개`;

    if (total > 0) {
      const observed = counts.map((count, index) => ({ count, index }));
      const best = Math.max(...counts);
      const modes = observed.filter((entry) => entry.count === best).map((entry) => entry.index);
      observedModeOut.textContent = modeLabel(modes);
      const mainIndex = modes[0];
      const tv = totalVariationDistance(counts, total, pmf);
      readout.textContent = `${rows}줄, 오른쪽 확률 ${formatPercent(bias, 0)}, ${formatInt(total)}개 중 ${mainIndex}번 칸이 ${formatInt(counts[mainIndex])}개(${formatPercent(counts[mainIndex] / total)})로 가장 많았습니다. 이 칸의 이론 확률은 ${formatPercent(pmf[mainIndex])}이고, 이론과의 차이는 ${formatPercent(tv)}입니다.`;
      convergence.update(tv, total);
    } else {
      observedModeOut.textContent = '—';
      readout.textContent = '아직 공을 떨어뜨리지 않았습니다. 실험 시작을 누르세요.';
      convergence.update(null, 0);
    }

    const rowsForTable = [];
    for (let k = 0; k <= rows; k += 1) {
      const frequency = total > 0 ? counts[k] / total : 0;
      rowsForTable.push([
        `${k}번`,
        formatInt(counts[k]),
        formatPercent(frequency),
        formatPercent(pmf[k]),
      ]);
    }
    tableHost.innerHTML = dataTable(
      '갈튼 보드 칸별 관찰 횟수와 이론 확률',
      ['칸', '관찰 횟수', '관찰 비율', '이론 확률'],
      rowsForTable,
    );
  }

  function updateControls(): void {
    const { rows, bias, ballCount, speed, seed, mode } = store.get().galton;
    rowsInput.value = String(rows);
    biasInput.value = String(bias);
    ballsInput.value = String(ballCount);
    speedInput.value = String(speed);
    seedOut.textContent = String(seed);
    rowsOut.textContent = `${rows}줄`;
    biasOut.textContent = formatPercent(bias, 0);
    ballsOut.textContent = `${formatInt(ballCount)}개`;
    speedOut.textContent = `${speed.toFixed(1)}×`;
    qsa(root, '.segmented__btn').forEach((button) => {
      const isActive = (button as HTMLElement).dataset.mode === mode;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
    qsa(root, '.chip[data-count]').forEach((button) => {
      button.classList.toggle(
        'is-active',
        Number((button as HTMLElement).dataset.count) === ballCount,
      );
    });
    modeHint.textContent =
      mode === 'slow'
        ? '한 번에 공 하나씩 천천히 떨어뜨립니다.'
        : '한 번에 여러 공을 떨어뜨립니다. 결과는 즉시 집계됩니다.';
    runButton.textContent = running
      ? '실행 중…'
      : mode === 'slow'
        ? '한 개 떨어뜨리기'
        : '실험 시작';
    runButton.disabled = running;
    resetButton.disabled = running;
  }

  function updateAll(): void {
    updateChart();
    updateStats();
    updateControls();
  }

  function resetExperiment(): void {
    animationToken += 1;
    const { rows, seed } = store.get().galton;
    counts = new Array<number>(rows + 1).fill(0);
    total = 0;
    lastAnimationCount = 0;
    running = false;
    scene.clear();
    scene.setConfig(rows, seed);
    updateAll();
  }

  function setRunning(value: boolean): void {
    running = value;
    store.update((current) => {
      current.galton.running = value;
    });
    updateControls();
  }

  function applyOutcome(outcome: number): void {
    counts[outcome] += 1;
    total += 1;
    updateChart();
    updateStats();
  }

  function announceResult(): void {
    const { rows } = store.get().galton;
    if (total === 0) return;
    const best = Math.max(...counts);
    const mode = counts.indexOf(best);
    announce(
      `갈튼 보드 실험 완료. ${rows}줄, 표본 ${formatInt(total)}개. 가장 많은 칸은 ${mode}번으로 ${formatInt(best)}개입니다.`,
    );
  }

  function runBatch(): void {
    if (running) return;
    const { rows, bias, ballCount, seed, speed } = store.get().galton;
    const simulation = simulateGalton(rows, bias, ballCount, seed);
    counts = [...simulation.counts];
    total = simulation.total;
    lastAnimationCount = Math.min(MAX_VISIBLE_BALLS, ballCount);
    scene.setConfig(rows, seed);
    updateAll();

    if (reducedMotion()) {
      scene.clear();
      announceResult();
      return;
    }

    setRunning(true);
    const token = ++animationToken;
    scene.launch(simulation.decisions, simulation.outcomes, {
      animateCount: lastAnimationCount,
      speed,
      onComplete: () => {
        if (token !== animationToken) return;
        setRunning(false);
        announceResult();
      },
    });
  }

  function runSlow(): void {
    if (running) return;
    const { rows, bias, seed, speed } = store.get().galton;
    const simulation = simulateGalton(rows, bias, 1, seed + total * 7919);
    const outcome = simulation.outcomes[0];

    if (reducedMotion()) {
      applyOutcome(outcome);
      announceResult();
      return;
    }

    setRunning(true);
    const token = ++animationToken;
    scene.launch(simulation.decisions, simulation.outcomes, {
      animateCount: 1,
      speed: Math.max(0.5, speed * 0.65),
      slow: true,
      append: true,
      onLand: () => {
        if (token !== animationToken) return;
        applyOutcome(outcome);
      },
      onComplete: () => {
        if (token !== animationToken) return;
        setRunning(false);
        announceResult();
      },
    });
  }

  function run(): void {
    if (store.get().galton.mode === 'slow') runSlow();
    else runBatch();
  }

  function reset(): void {
    resetExperiment();
    announce('갈튼 보드를 초기화했습니다.');
  }

  rowsInput.addEventListener('input', () => {
    const rows = Number(rowsInput.value);
    store.update((current) => {
      current.galton.rows = rows;
    });
    resetExperiment();
  });

  biasInput.addEventListener('input', () => {
    const bias = Number(biasInput.value);
    store.update((current) => {
      current.galton.bias = bias;
    });
    resetExperiment();
  });

  ballsInput.addEventListener('input', () => {
    const ballCount = Number(ballsInput.value);
    store.update((current) => {
      current.galton.ballCount = ballCount;
    });
    updateControls();
  });

  speedInput.addEventListener('input', () => {
    const speed = Number(speedInput.value);
    store.update((current) => {
      current.galton.speed = speed;
    });
    updateControls();
  });

  qsa<HTMLButtonElement>(root, '.chip[data-count]').forEach((button) => {
    button.addEventListener('click', () => {
      const ballCount = Number(button.dataset.count);
      store.update((current) => {
        current.galton.ballCount = ballCount;
      });
      updateControls();
    });
  });

  qsa<HTMLButtonElement>(root, '.segmented__btn[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.mode === 'slow' ? 'slow' : 'batch';
      store.update((current) => {
        current.galton.mode = mode;
      });
      updateControls();
    });
  });

  showTheory.addEventListener('change', () => {
    store.update((current) => {
      current.preferences.showTheoretical = showTheory.checked;
    });
    updateChart();
  });

  showNormal.addEventListener('change', () => {
    store.update((current) => {
      current.preferences.showNormalCurve = showNormal.checked;
    });
    updateChart();
  });

  runButton.addEventListener('click', run);
  resetButton.addEventListener('click', reset);

  newSeedButton.addEventListener('click', () => {
    const seed = randomSeed();
    store.update((current) => {
      current.galton.seed = seed;
    });
    resetExperiment();
    announce(`새 시드 ${seed}로 초기화했습니다.`);
  });

  sameRunButton.addEventListener('click', () => {
    resetExperiment();
    run();
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
      if (!running) run();
    } else if (event.key.toLowerCase() === 'r') {
      reset();
    } else if (event.key.toLowerCase() === 's') {
      const next = store.get().galton.mode === 'slow' ? 'batch' : 'slow';
      store.update((current) => {
        current.galton.mode = next;
      });
      updateControls();
    }
  };
  window.addEventListener('keydown', onKeydown);

  showTheory.checked = store.get().preferences.showTheoretical;
  showNormal.checked = store.get().preferences.showNormalCurve;
  updateAll();

  return {
    element: root,
    destroy: () => {
      window.removeEventListener('keydown', onKeydown);
      histogram.destroy();
      scene.dispose();
    },
  };
}
