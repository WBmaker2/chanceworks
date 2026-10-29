import type { Store } from '../../app/state';
import { ROUTE_META } from '../../app/routes';
import { ConvergenceMeter } from '../../charts/ConvergenceMeter';
import { MAX_SPINNER_SECTORS, MAX_SPINS, MIN_SPINNER_SECTORS } from '../../prob/constants';
import { totalVariationDistance } from '../../prob/convergence';
import { randomSeed } from '../../prob/rng';
import { normalizeWeights, simulateSpinner } from '../../prob/spinner';
import { formatPercent } from '../../prob/stats';
import { SECTOR_COLORS, SpinnerScene } from '../../render/SpinnerScene';
import { announce, dataTable, formatInt, fromHtml, qs, qsa } from '../../ui/dom';
import { modelNotice, pageHeader } from '../../ui/page';

export interface LabView {
  element: HTMLElement;
  destroy: () => void;
}

export function createSpinnerLab(store: Store): LabView {
  const state = store.get().spinner;
  const meta = ROUTE_META.spinner;
  const initialCount = state.weights.length;

  const root = fromHtml(`<section class="lab-page">
    ${pageHeader(meta, ['가중 확률', '관찰 빈도', '시드 기반'])}
    <div class="lab-grid">
      <aside class="panel lab-controls" aria-labelledby="spinner-controls-title">
        <div class="panel-heading"><h2 id="spinner-controls-title">실험 설정</h2><span class="panel-kicker">CONFIG</span></div>

        <div class="field">
          <div class="field__label"><label for="spinner-sectors">칸 수</label><output for="spinner-sectors" data-role="sectors-out">${initialCount}칸</output></div>
          <input id="spinner-sectors" data-role="sectors" type="range" min="${MIN_SPINNER_SECTORS}" max="${MAX_SPINNER_SECTORS}" step="1" value="${initialCount}" />
          <div class="field__scale"><span>${MIN_SPINNER_SECTORS}</span><span>${MAX_SPINNER_SECTORS}</span></div>
        </div>

        <fieldset class="weights-field">
          <legend>가중치</legend>
          <div class="weights-list" data-role="weights"></div>
          <p class="field__hint">각 칸의 상대 가중치입니다. 자동으로 합이 1이 되도록 정규화됩니다.</p>
        </fieldset>

        <div class="field">
          <div class="field__label"><label for="spinner-spins">돌리는 횟수</label><output for="spinner-spins" data-role="spins-out">100회</output></div>
          <input id="spinner-spins" data-role="spins" type="range" min="1" max="${MAX_SPINS}" step="1" value="${state.spins}" />
          <div class="chip-row" role="group" aria-label="돌림판 빠른 선택">
            <button class="chip" type="button" data-spins="10">10</button>
            <button class="chip" type="button" data-spins="100">100</button>
            <button class="chip" type="button" data-spins="1000">1000</button>
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
          <button type="button" class="btn btn-ghost" data-role="one-spin">한 번만 돌리기</button>
        </div>
        <p class="keyboard-hint">Space 실행 · R 초기화</p>
      </aside>

      <section class="panel viewport-panel" aria-labelledby="spinner-view-title">
        <div class="viewport-head"><h2 id="spinner-view-title">가중 돌림판</h2><span class="tag">모델 · 시각화</span></div>
        <div class="scene-wrap scene-wrap--spinner">
          <canvas data-role="scene" class="scene-canvas" aria-label="가중 돌림판 3D 장면"></canvas>
          <p class="scene-hint">결과가 정해진 뒤 바늘이 그 칸을 가리킵니다</p>
        </div>
        <p class="scene-readout" data-role="readout" role="status" aria-live="polite">아직 돌림판을 돌리지 않았습니다.</p>
        <div class="scene-stats">
          <div><span class="stat-label">총 돌림</span><strong data-role="total">0</strong></div>
          <div><span class="stat-label">마지막 칸</span><strong data-role="last">—</strong></div>
          <div><span class="stat-label">가장 많이 나온 칸</span><strong data-role="mode">—</strong></div>
          <div><span class="stat-label">이론과의 차이</span><strong data-role="tv">—</strong></div>
        </div>
        ${modelNotice()}
      </section>

      <section class="panel chart-panel" aria-labelledby="spinner-chart-title">
        <div class="panel-heading"><h2 id="spinner-chart-title">칸별 빈도</h2><span class="panel-kicker">OBSERVED VS WEIGHT</span></div>
        <div class="frequency-list" data-role="frequencies"></div>
        <div data-role="table"></div>
      </section>
    </div>

    <div class="lab-bottom">
      <section class="panel convergence-panel" aria-labelledby="spinner-convergence-title">
        <div class="panel-heading"><h2 id="spinner-convergence-title">수렴 측정</h2><span class="panel-kicker">TOTAL VARIATION</span></div>
        <div data-role="convergence"></div>
        <p class="convergence-note">관찰 빈도가 가중치에 비례하는지 확인합니다. 표본이 적을 때는 차이가 크게 흔들릴 수 있습니다.</p>
      </section>
      <section class="panel formula-panel" aria-labelledby="spinner-formula-title">
        <div class="panel-heading"><h2 id="spinner-formula-title">가중치 확인</h2><span class="panel-kicker">NORMALIZED</span></div>
        <div class="weight-summary" data-role="weight-summary"></div>
        <p class="formula-note">가중치는 합이 1이 되도록 정규화됩니다. 예: 가중치 1, 1, 2 → 25%, 25%, 50%.</p>
      </section>
    </div>
  </section>`);

  const sectorsInput = qs<HTMLInputElement>(root, '[data-role="sectors"]');
  const sectorsOut = qs(root, '[data-role="sectors-out"]');
  const weightsHost = qs(root, '[data-role="weights"]');
  const weightSummary = qs(root, '[data-role="weight-summary"]');
  const spinsInput = qs<HTMLInputElement>(root, '[data-role="spins"]');
  const spinsOut = qs(root, '[data-role="spins-out"]');
  const seedOut = qs(root, '[data-role="seed"]');
  const runButton = qs<HTMLButtonElement>(root, '[data-role="run"]');
  const resetButton = qs<HTMLButtonElement>(root, '[data-role="reset"]');
  const oneSpinButton = qs<HTMLButtonElement>(root, '[data-role="one-spin"]');
  const newSeedButton = qs<HTMLButtonElement>(root, '[data-role="new-seed"]');
  const sameRunButton = qs<HTMLButtonElement>(root, '[data-role="same-run"]');
  const readout = qs(root, '[data-role="readout"]');
  const totalOut = qs(root, '[data-role="total"]');
  const lastOut = qs(root, '[data-role="last"]');
  const modeOut = qs(root, '[data-role="mode"]');
  const tvOut = qs(root, '[data-role="tv"]');
  const frequencyHost = qs(root, '[data-role="frequencies"]');
  const tableHost = qs(root, '[data-role="table"]');

  const convergence = new ConvergenceMeter();
  qs(root, '[data-role="convergence"]').append(convergence.element);
  const scene = new SpinnerScene(qs<HTMLCanvasElement>(root, '[data-role="scene"]'));
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  let weights = normalizeWeights(state.weights);
  let rawWeights = state.weights.map((weight) => Math.round(weight * 100));
  let counts = new Array<number>(weights.length).fill(0);
  let total = 0;
  let last: number | null = null;
  let running = false;

  const reducedMotion = () => store.get().preferences.reducedMotion || motionQuery.matches;
  scene.setReducedMotion(reducedMotion());

  function syncStateWeights(): void {
    store.update((current) => {
      current.spinner.weights = [...weights];
    });
  }

  function renderWeightInputs(): void {
    weightsHost.innerHTML = weights
      .map(
        (
          weight,
          index,
        ) => `<div class="weight-row" style="--sector-color: ${SECTOR_COLORS[index % SECTOR_COLORS.length]}">
          <span class="weight-row__chip"><span aria-hidden="true"></span>${index + 1}번</span>
          <input type="range" min="0" max="100" step="1" value="${rawWeights[index]}" data-weight-index="${index}" aria-label="${index + 1}번 칸 가중치" />
          <output data-weight-out="${index}">${formatPercent(weight)}</output>
        </div>`,
      )
      .join('');
    weightSummary.innerHTML = weights
      .map(
        (weight, index) =>
          `<div><span class="swatch" style="--sector-color: ${SECTOR_COLORS[index % SECTOR_COLORS.length]}"></span>${index + 1}번 <strong>${formatPercent(weight)}</strong></div>`,
      )
      .join('');
  }

  function updateWeightOutputs(): void {
    weights.forEach((weight, index) => {
      const output = root.querySelector(`[data-weight-out="${index}"]`);
      if (output) output.textContent = formatPercent(weight);
    });
    weightSummary.innerHTML = weights
      .map(
        (weight, index) =>
          `<div><span class="swatch" style="--sector-color: ${SECTOR_COLORS[index % SECTOR_COLORS.length]}"></span>${index + 1}번 <strong>${formatPercent(weight)}</strong></div>`,
      )
      .join('');
  }

  function updateFrequencies(): void {
    const rowsHtml = weights
      .map((weight, index) => {
        const count = counts[index];
        const frequency = total > 0 ? count / total : 0;
        const observedWidth = total > 0 ? Math.max(1, frequency * 100) : 0;
        return `<div class="frequency-row ${last === index ? 'is-selected' : ''}" data-sector="${index}">
          <div class="frequency-row__label">
            <span class="swatch" style="--sector-color: ${SECTOR_COLORS[index % SECTOR_COLORS.length]}"></span>
            <span>${index + 1}번</span>
            <span class="frequency-row__weight">이론 ${formatPercent(weight)}</span>
          </div>
          <div class="frequency-row__track">
            <span class="frequency-row__bar" style="width: ${observedWidth}%; --sector-color: ${SECTOR_COLORS[index % SECTOR_COLORS.length]}"></span>
            <span class="frequency-row__theory" style="left: ${weight * 100}%"></span>
          </div>
          <div class="frequency-row__numbers">
            <span>${formatInt(count)}회</span>
            <strong>${total > 0 ? formatPercent(frequency) : '—'}</strong>
          </div>
        </div>`;
      })
      .join('');
    frequencyHost.innerHTML = rowsHtml;
  }

  function updateStats(): void {
    totalOut.textContent = formatInt(total);
    lastOut.textContent = last === null ? '—' : `${last + 1}번`;
    if (total > 0) {
      const best = Math.max(...counts);
      const mode = counts.indexOf(best);
      modeOut.textContent = `${mode + 1}번`;
      const tv = totalVariationDistance(counts, total, weights);
      tvOut.textContent = formatPercent(tv);
      convergence.update(tv, total);
      readout.textContent = `${formatInt(total)}번 돌린 결과, ${mode + 1}번 칸이 ${formatInt(best)}번(${formatPercent(best / total)})으로 가장 많았습니다. 이론 가중치는 ${formatPercent(weights[mode])}이며, 이론과의 차이는 ${formatPercent(tv)}입니다.`;
    } else {
      modeOut.textContent = '—';
      tvOut.textContent = '—';
      convergence.update(null, 0);
      readout.textContent = '아직 돌림판을 돌리지 않았습니다. 실험 시작을 누르세요.';
    }

    tableHost.innerHTML = dataTable(
      '돌림판 칸별 관찰 횟수와 이론 가중치',
      ['칸', '가중치', '관찰 횟수', '관찰 비율'],
      weights.map((weight, index) => [
        `${index + 1}번`,
        formatPercent(weight),
        formatInt(counts[index]),
        formatPercent(total > 0 ? counts[index] / total : 0),
      ]),
    );
  }

  function updateAll(): void {
    updateFrequencies();
    updateStats();
    updateControls();
  }

  function resetResults(announceReset = false): void {
    counts = new Array<number>(weights.length).fill(0);
    total = 0;
    last = null;
    scene.setResult(0);
    setRunning(false);
    updateAll();
    if (announceReset) announce('돌림판 실험을 초기화했습니다.');
  }

  function updateControls(): void {
    const { spins, seed } = store.get().spinner;
    sectorsInput.value = String(weights.length);
    sectorsOut.textContent = `${weights.length}칸`;
    spinsInput.value = String(spins);
    spinsOut.textContent = `${formatInt(spins)}회`;
    seedOut.textContent = String(seed);
    runButton.disabled = running;
    runButton.textContent = running ? '실행 중…' : '실험 시작';
    resetButton.disabled = running;
    oneSpinButton.disabled = running;
    qsa<HTMLButtonElement>(root, '[data-spins]').forEach((button) => {
      button.classList.toggle('is-active', Number(button.dataset.spins) === spins);
    });
  }

  function setRunning(value: boolean): void {
    running = value;
    store.update((current) => {
      current.spinner.running = value;
    });
    updateControls();
  }

  function spinTo(index: number, after?: () => void): void {
    if (reducedMotion()) {
      setRunning(false);
      scene.setResult(index);
      after?.();
      return;
    }
    setRunning(true);
    scene.spinTo(index, () => {
      setRunning(false);
      after?.();
    });
  }

  function execute(spins: number): void {
    if (running) return;
    const { seed } = store.get().spinner;
    store.update((current) => {
      current.spinner.spins = spins;
    });
    const simulation = simulateSpinner(weights, spins, seed);
    counts = [...simulation.counts];
    total = simulation.total;
    last = simulation.outcomes[simulation.outcomes.length - 1] ?? null;
    updateAll();
    if (last !== null) {
      const selected = last;
      spinTo(selected, () => {
        announce(`돌림판 ${formatInt(total)}번 완료. 마지막 칸은 ${selected + 1}번입니다.`);
      });
    }
  }

  function executeOne(): void {
    if (running) return;
    const { seed } = store.get().spinner;
    const simulation = simulateSpinner(weights, 1, seed + total * 7919);
    const index = simulation.outcomes[0];
    counts[index] += 1;
    total += 1;
    last = index;
    updateAll();
    spinTo(index, () => {
      announce(`${total}번째 결과는 ${index + 1}번 칸입니다.`);
    });
  }

  sectorsInput.addEventListener('input', () => {
    setRunning(false);
    const sectorCount = Number(sectorsInput.value);
    weights = new Array<number>(sectorCount).fill(1 / sectorCount);
    rawWeights = new Array<number>(sectorCount).fill(100);
    counts = new Array<number>(sectorCount).fill(0);
    total = 0;
    last = null;
    syncStateWeights();
    scene.setWeights(weights);
    renderWeightInputs();
    updateAll();
  });

  weightsHost.addEventListener('input', (event) => {
    setRunning(false);
    const input = event.target as HTMLInputElement;
    if (input.dataset.weightIndex === undefined) return;
    const index = Number(input.dataset.weightIndex);
    rawWeights[index] = Number(input.value);
    if (rawWeights.reduce((acc, value) => acc + value, 0) <= 0) {
      rawWeights = rawWeights.map(() => 1);
      qsa<HTMLInputElement>(weightsHost, 'input[type="range"]').forEach((range) => {
        range.value = '1';
      });
    }
    weights = normalizeWeights(rawWeights);
    counts = new Array<number>(weights.length).fill(0);
    total = 0;
    last = null;
    syncStateWeights();
    updateWeightOutputs();
    updateAll();
  });

  weightsHost.addEventListener('change', () => {
    scene.setWeights(weights);
  });

  spinsInput.addEventListener('input', () => {
    const spins = Number(spinsInput.value);
    store.update((current) => {
      current.spinner.spins = spins;
    });
    updateControls();
  });

  qsa<HTMLButtonElement>(root, '[data-spins]').forEach((button) => {
    button.addEventListener('click', () => {
      const spins = Number(button.dataset.spins);
      store.update((current) => {
        current.spinner.spins = spins;
      });
      updateControls();
    });
  });

  runButton.addEventListener('click', () => execute(store.get().spinner.spins));
  oneSpinButton.addEventListener('click', executeOne);
  resetButton.addEventListener('click', () => {
    resetResults(true);
    scene.setResult(0);
  });

  newSeedButton.addEventListener('click', () => {
    const seed = randomSeed();
    store.update((current) => {
      current.spinner.seed = seed;
    });
    resetResults();
    updateControls();
    announce(`새 시드 ${seed}로 초기화했습니다.`);
  });

  sameRunButton.addEventListener('click', () => {
    resetResults();
    execute(store.get().spinner.spins);
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
      if (!running) execute(store.get().spinner.spins);
    } else if (event.key.toLowerCase() === 'r') {
      resetResults(true);
    }
  };
  window.addEventListener('keydown', onKeydown);

  renderWeightInputs();
  scene.setWeights(weights);
  updateAll();

  return {
    element: root,
    destroy: () => {
      window.removeEventListener('keydown', onKeydown);
      scene.dispose();
    },
  };
}
