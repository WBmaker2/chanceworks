import type { Store } from '../../app/state';
import { ROUTE_META } from '../../app/routes';
import { RunningProportion } from '../../charts/RunningProportion';
import { MAX_FLIPS } from '../../prob/constants';
import { longestHeadsStreak, simulateCoin } from '../../prob/coin';
import { randomSeed } from '../../prob/rng';
import { formatPercent } from '../../prob/stats';
import { CoinScene } from '../../render/CoinScene';
import { announce, dataTable, formatInt, fromHtml, qs, qsa } from '../../ui/dom';
import { modelNotice, pageHeader } from '../../ui/page';

export interface LabView {
  element: HTMLElement;
  destroy: () => void;
}

export function createCoinLab(store: Store): LabView {
  const state = store.get().coin;
  const meta = ROUTE_META.coin;

  const root = fromHtml(`<section class="lab-page">
    ${pageHeader(meta, ['베르누이 시행', '앞면 비율', '도박사의 오류'])}
    <div class="lab-grid">
      <aside class="panel lab-controls" aria-labelledby="coin-controls-title">
        <div class="panel-heading"><h2 id="coin-controls-title">실험 설정</h2><span class="panel-kicker">CONFIG</span></div>

        <div class="field">
          <div class="field__label"><label for="coin-flips">던지는 횟수</label><output for="coin-flips" data-role="flips-out">100회</output></div>
          <input id="coin-flips" data-role="flips" type="range" min="1" max="${MAX_FLIPS}" step="1" value="${state.flips}" />
          <div class="chip-row" role="group" aria-label="동전 던지기 빠른 선택">
            <button class="chip" type="button" data-flips="10">10</button>
            <button class="chip" type="button" data-flips="100">100</button>
            <button class="chip" type="button" data-flips="1000">1000</button>
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
          <button type="button" class="btn btn-ghost" data-role="one-flip">한 번만 던지기</button>
        </div>
        <p class="keyboard-hint">Space 실행 · R 초기화</p>
      </aside>

      <section class="panel viewport-panel" aria-labelledby="coin-view-title">
        <div class="viewport-head"><h2 id="coin-view-title">동전</h2><span class="tag">모델 · 시각화</span></div>
        <div class="scene-wrap scene-wrap--coin">
          <canvas data-role="scene" class="scene-canvas" aria-label="동전 3D 장면"></canvas>
          <p class="scene-hint">던지기 결과가 정해진 뒤 동전이 그 면으로 놓입니다</p>
        </div>
        <p class="scene-readout" data-role="readout" role="status" aria-live="polite">아직 동전을 던지지 않았습니다.</p>
        <div class="scene-stats">
          <div><span class="stat-label">총 던짐</span><strong data-role="total">0</strong></div>
          <div><span class="stat-label">앞면</span><strong data-role="heads">0</strong></div>
          <div><span class="stat-label">뒷면</span><strong data-role="tails">0</strong></div>
          <div><span class="stat-label">앞면 비율</span><strong data-role="proportion">—</strong></div>
        </div>
        ${modelNotice()}
      </section>

      <section class="panel chart-panel" aria-labelledby="coin-chart-title">
        <div class="panel-heading"><h2 id="coin-chart-title">앞면 비율의 변화</h2><span class="panel-kicker">RUNNING PROPORTION</span></div>
        <canvas class="chart-canvas" data-role="chart" aria-label="동전 앞면 비율 변화 그래프"></canvas>
        <div data-role="table"></div>
      </section>
    </div>

    <div class="lab-bottom">
      <section class="panel fallacy-panel" aria-labelledby="coin-fallacy-title">
        <div class="panel-heading"><h2 id="coin-fallacy-title">다음 던지기의 확률</h2><span class="panel-kicker">STILL FAIR</span></div>
        <div class="coin-split">
          <div class="coin-split__side"><span>앞면</span><strong>50%</strong></div>
          <div class="coin-split__divider" aria-hidden="true"></div>
          <div class="coin-split__side"><span>뒷면</span><strong>50%</strong></div>
        </div>
        <p class="fallacy-note" data-role="streak-note">앞면이 여러 번 연속으로 나와도 다음 던지기의 확률은 변하지 않습니다. 동전은 기억하지 않습니다.</p>
      </section>
      <section class="panel insight-panel" aria-labelledby="coin-insight-title">
        <div class="panel-heading"><h2 id="coin-insight-title">관찰 기록</h2><span class="panel-kicker">EVIDENCE</span></div>
        <div class="stat-grid stat-grid--two">
          <div class="stat-card"><span>가장 긴 앞면 연속</span><strong data-role="streak">—</strong></div>
          <div class="stat-card"><span>마지막 결과</span><strong data-role="last-flip">—</strong></div>
          <div class="stat-card"><span>0.5에 가장 가까웠던 비율</span><strong data-role="closest">—</strong></div>
          <div class="stat-card"><span>현재 앞면 비율</span><strong data-role="current">—</strong></div>
        </div>
        <p class="formula-note">앞면 5연속 뒤에도 다음 앞면 확률은 0.5입니다. “이제 뒷면이 나올 차례”라는 생각은 독립 시행을 착각한 것입니다.</p>
      </section>
    </div>
  </section>`);

  const flipsInput = qs<HTMLInputElement>(root, '[data-role="flips"]');
  const flipsOut = qs(root, '[data-role="flips-out"]');
  const seedOut = qs(root, '[data-role="seed"]');
  const runButton = qs<HTMLButtonElement>(root, '[data-role="run"]');
  const resetButton = qs<HTMLButtonElement>(root, '[data-role="reset"]');
  const oneFlipButton = qs<HTMLButtonElement>(root, '[data-role="one-flip"]');
  const newSeedButton = qs<HTMLButtonElement>(root, '[data-role="new-seed"]');
  const sameRunButton = qs<HTMLButtonElement>(root, '[data-role="same-run"]');
  const readout = qs(root, '[data-role="readout"]');
  const totalOut = qs(root, '[data-role="total"]');
  const headsOut = qs(root, '[data-role="heads"]');
  const tailsOut = qs(root, '[data-role="tails"]');
  const proportionOut = qs(root, '[data-role="proportion"]');
  const streakOut = qs(root, '[data-role="streak"]');
  const lastFlipOut = qs(root, '[data-role="last-flip"]');
  const closestOut = qs(root, '[data-role="closest"]');
  const currentOut = qs(root, '[data-role="current"]');
  const streakNote = qs(root, '[data-role="streak-note"]');
  const tableHost = qs(root, '[data-role="table"]');

  const chart = new RunningProportion(qs<HTMLCanvasElement>(root, '[data-role="chart"]'));
  const scene = new CoinScene(qs<HTMLCanvasElement>(root, '[data-role="scene"]'));
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  let heads = 0;
  let tails = 0;
  let total = 0;
  let runningHeads: number[] = [];
  let flips: boolean[] = [];
  let running = false;
  let timeout = 0;

  const reducedMotion = () => store.get().preferences.reducedMotion || motionQuery.matches;
  scene.setReducedMotion(reducedMotion());

  function updateChart(): void {
    chart.setData(runningHeads);
  }

  function updateStats(): void {
    totalOut.textContent = formatInt(total);
    headsOut.textContent = formatInt(heads);
    tailsOut.textContent = formatInt(tails);
    const proportion = total > 0 ? heads / total : 0;
    proportionOut.textContent = total > 0 ? formatPercent(proportion) : '—';
    currentOut.textContent = total > 0 ? formatPercent(proportion) : '—';

    if (total > 0) {
      const streak = longestHeadsStreak(flips);
      streakOut.textContent = `${streak}번`;
      lastFlipOut.textContent = flips[flips.length - 1] ? '앞면' : '뒷면';
      const closest = runningHeads.reduce(
        (best, value, index) =>
          Math.abs(value - 0.5) < Math.abs(runningHeads[best] - 0.5) ? index : best,
        0,
      );
      closestOut.textContent = `${formatPercent(runningHeads[closest])} (${formatInt(closest + 1)}번째)`;
      streakNote.textContent =
        streak >= 5
          ? `앞면이 ${streak}번 연속으로 나왔습니다. 그래도 다음 던지기의 앞면 확률은 50%입니다. 동전은 이전 결과를 기억하지 않습니다.`
          : '앞면이 여러 번 연속으로 나와도 다음 던지기의 확률은 변하지 않습니다. 동전은 기억하지 않습니다.';
      readout.textContent = `${formatInt(total)}번 중 앞면 ${formatInt(heads)}번(${formatPercent(proportion)}), 뒷면 ${formatInt(tails)}번입니다. 앞면 비율은 0.5를 기준으로 움직이며, 표본이 늘수록 대체로 0.5에 가까워집니다.`;
    } else {
      streakOut.textContent = '—';
      lastFlipOut.textContent = '—';
      closestOut.textContent = '—';
      streakNote.textContent =
        '앞면이 여러 번 연속으로 나와도 다음 던지기의 확률은 변하지 않습니다. 동전은 기억하지 않습니다.';
      readout.textContent = '아직 동전을 던지지 않았습니다. 실험 시작을 누르세요.';
    }
  }

  function updateTable(): void {
    if (total === 0) {
      tableHost.innerHTML = dataTable(
        '동전 던지기 앞면 비율 표본',
        ['던진 횟수', '앞면 횟수', '앞면 비율'],
        [['—', '—', '—']],
      );
      return;
    }
    const indices = new Set<number>();
    for (const value of [1, 5, 10, 50, 100, 500, 1000, 5000]) {
      if (value <= total) indices.add(value);
    }
    indices.add(total);
    const rows = [...indices]
      .sort((a, b) => a - b)
      .map((n) => {
        const ratio = runningHeads[n - 1];
        return [formatInt(n), formatInt(Math.round(ratio * n)), formatPercent(ratio)];
      });
    tableHost.innerHTML = dataTable(
      '동전 던지기 앞면 비율 표본',
      ['던진 횟수', '앞면 횟수', '앞면 비율'],
      rows,
    );
  }

  function updateControls(): void {
    const { flips: flipCount, seed } = store.get().coin;
    flipsInput.value = String(flipCount);
    flipsOut.textContent = `${formatInt(flipCount)}회`;
    seedOut.textContent = String(seed);
    runButton.disabled = running;
    runButton.textContent = running ? '실행 중…' : '실험 시작';
    resetButton.disabled = running;
    oneFlipButton.disabled = running;
    qsa<HTMLButtonElement>(root, '[data-flips]').forEach((button) => {
      button.classList.toggle('is-active', Number(button.dataset.flips) === flipCount);
    });
  }

  function setRunning(value: boolean): void {
    running = value;
    store.update((current) => {
      current.coin.running = value;
    });
    updateControls();
  }

  function reset(): void {
    window.clearTimeout(timeout);
    heads = 0;
    tails = 0;
    total = 0;
    runningHeads = [];
    flips = [];
    scene.setResult(true);
    setRunning(false);
    updateChart();
    updateStats();
    updateTable();
    updateControls();
    announce('동전 실험을 초기화했습니다.');
  }

  function finishAnimation(): void {
    if (reducedMotion()) return;
    setRunning(true);
    timeout = window.setTimeout(() => setRunning(false), 980);
  }

  function execute(count: number): void {
    if (running) return;
    const { seed } = store.get().coin;
    store.update((current) => {
      current.coin.flips = count;
    });
    const simulation = simulateCoin(count, seed);
    heads = simulation.heads;
    tails = simulation.tails;
    total = simulation.total;
    runningHeads = [...simulation.runningHeads];
    flips = [...simulation.flips];
    const last = flips[flips.length - 1] ?? true;
    scene.flip(last, !reducedMotion());
    updateChart();
    updateStats();
    updateTable();
    updateControls();
    if (total > 0) {
      announce(
        `동전 ${formatInt(total)}번 완료. 앞면 ${formatInt(heads)}번, 뒷면 ${formatInt(tails)}번, 앞면 비율 ${formatPercent(heads / total)}입니다.`,
      );
    }
    finishAnimation();
  }

  function executeOne(): void {
    if (running) return;
    const { seed } = store.get().coin;
    const simulation = simulateCoin(1, seed + total * 7919);
    const isHeads = simulation.flips[0];
    if (isHeads) heads += 1;
    else tails += 1;
    total += 1;
    flips.push(isHeads);
    runningHeads.push(heads / total);
    scene.flip(isHeads, !reducedMotion());
    updateChart();
    updateStats();
    updateTable();
    updateControls();
    announce(
      `${total}번째 결과는 ${isHeads ? '앞면' : '뒷면'}입니다. 현재 앞면 비율 ${formatPercent(heads / total)}.`,
    );
    finishAnimation();
  }

  flipsInput.addEventListener('input', () => {
    const count = Number(flipsInput.value);
    store.update((current) => {
      current.coin.flips = count;
    });
    updateControls();
  });

  qsa<HTMLButtonElement>(root, '[data-flips]').forEach((button) => {
    button.addEventListener('click', () => {
      const count = Number(button.dataset.flips);
      store.update((current) => {
        current.coin.flips = count;
      });
      updateControls();
    });
  });

  runButton.addEventListener('click', () => execute(store.get().coin.flips));
  oneFlipButton.addEventListener('click', executeOne);
  resetButton.addEventListener('click', reset);

  newSeedButton.addEventListener('click', () => {
    const seed = randomSeed();
    store.update((current) => {
      current.coin.seed = seed;
    });
    reset();
    updateControls();
    announce(`새 시드 ${seed}로 초기화했습니다.`);
  });

  sameRunButton.addEventListener('click', () => {
    reset();
    execute(store.get().coin.flips);
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
      if (!running) execute(store.get().coin.flips);
    } else if (event.key.toLowerCase() === 'r') {
      reset();
    }
  };
  window.addEventListener('keydown', onKeydown);

  updateChart();
  updateStats();
  updateTable();
  updateControls();

  return {
    element: root,
    destroy: () => {
      window.clearTimeout(timeout);
      window.removeEventListener('keydown', onKeydown);
      chart.destroy();
      scene.dispose();
    },
  };
}
