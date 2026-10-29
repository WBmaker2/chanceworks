import type { Store } from '../../app/state';
import { ROUTE_META } from '../../app/routes';
import payoffsData from '../../data/payoffs.json';
import {
  expectedValue,
  isFairGame,
  simulateExpectedGame,
  type ExpectedGameResult,
} from '../../prob/expectedValue';
import { randomSeed } from '../../prob/rng';
import { formatPercent } from '../../prob/stats';
import { announce, dataTable, formatInt, formatPoints, fromHtml, qs, qsa } from '../../ui/dom';
import { modelNotice, pageHeader } from '../../ui/page';

export interface LabView {
  element: HTMLElement;
  destroy: () => void;
}

interface Preset {
  id: string;
  name: string;
  description: string;
  payoffs: number[];
  probabilities: number[];
  cost: number;
}

const PRESETS = payoffsData as Preset[];

export function createExpectedLab(store: Store): LabView {
  const state = store.get().expected;
  const meta = ROUTE_META.expected;
  const initialProbability = state.probabilities[0] ?? 0.1;

  const root = fromHtml(`<section class="lab-page">
    ${pageHeader(meta, ['기대값', '공정성 판정', '수학 연습'])}
    <div class="lab-grid">
      <aside class="panel lab-controls" aria-labelledby="ev-controls-title">
        <div class="panel-heading"><h2 id="ev-controls-title">게임 설정</h2><span class="panel-kicker">PRESETS</span></div>
        <div class="preset-list">
          ${PRESETS.map(
            (preset) =>
              `<button type="button" class="preset-card" data-preset="${preset.id}">
                <strong>${preset.name}</strong><span>${preset.description}</span>
              </button>`,
          ).join('')}
        </div>

        <div class="field">
          <label class="field__label" for="ev-payoff"><span>당첨 상금</span><output for="ev-payoff" data-role="payoff-out">10점</output></label>
          <input id="ev-payoff" data-role="payoff" class="number-input" type="number" min="0" max="100000" step="1" value="${state.payoffs[0]}" />
        </div>

        <div class="field">
          <div class="field__label"><label for="ev-probability">당첨 확률</label><output for="ev-probability" data-role="probability-out">10.0%</output></div>
          <input id="ev-probability" data-role="probability" type="range" min="0.1" max="99.9" step="0.1" value="${initialProbability * 100}" />
        </div>

        <div class="field">
          <label class="field__label" for="ev-cost"><span>참가비</span><output for="ev-cost" data-role="cost-out">2점</output></label>
          <input id="ev-cost" data-role="cost" class="number-input" type="number" min="0" max="10000" step="0.5" value="${state.cost}" />
        </div>

        <div class="seed-box">
          <div><span class="seed-label">모의실험 시드</span><code data-role="seed">${state.seed}</code></div>
          <div class="seed-actions">
            <button type="button" class="btn btn-ghost btn-small" data-role="new-seed">새 시드</button>
          </div>
        </div>

        <div class="control-actions">
          <button type="button" class="btn btn-primary btn-pulse" data-role="simulate">1000번 모의실험</button>
          <button type="button" class="btn btn-secondary" data-role="reset">초기화</button>
        </div>
        <p class="keyboard-hint">Space 모의실험 · R 초기화</p>
      </aside>

      <section class="panel game-panel" aria-labelledby="ev-game-title">
        <div class="viewport-head"><h2 id="ev-game-title">게임 보드</h2><span class="tag">수학 연습</span></div>
        <div class="game-card">
          <div class="game-card__prize">
            <span>당첨 상금</span>
            <strong data-role="prize">10<small>점</small></strong>
          </div>
          <div class="game-card__chance">
            <span class="probability-ring" data-role="ring">10%</span>
            <span>당첨 확률</span>
          </div>
          <div class="game-card__cost">
            <span>참가비</span>
            <strong data-role="cost">2<small>점</small></strong>
          </div>
          <div class="game-card__arrow" aria-hidden="true">→</div>
          <div class="game-card__expected">
            <span>기대 상금</span>
            <strong data-role="expected-prize">1.0<small>점</small></strong>
          </div>
        </div>

        <table class="payoff-table">
          <caption>결과별 확률과 상금</caption>
          <thead><tr><th scope="col">결과</th><th scope="col">확률</th><th scope="col">상금</th><th scope="col">기대 기여</th></tr></thead>
          <tbody>
            <tr><th scope="row">당첨</th><td data-role="table-p">10.0%</td><td data-role="table-win">10점</td><td data-role="table-win-ev">1.0점</td></tr>
            <tr><th scope="row">꽝</th><td data-role="table-lose-p">90.0%</td><td>0점</td><td>0.0점</td></tr>
          </tbody>
        </table>

        <div class="ev-formula">
          <span>EV</span>
          <strong>= Σ (확률 × 상금) − 참가비</strong>
        </div>
        ${modelNotice()}
      </section>

      <section class="panel ev-panel" aria-labelledby="ev-result-title">
        <div class="panel-heading"><h2 id="ev-result-title">기대값 계산</h2><span class="panel-kicker">EXPECTED VALUE</span></div>
        <div class="ev-number" data-level="unfair">
          <span class="ev-number__label">회당 기대값</span>
          <strong data-role="ev">−1.0<small>점</small></strong>
          <span class="verdict" data-role="verdict">불공정</span>
        </div>
        <div class="ev-breakdown">
          <div><span>기대 상금</span><strong data-role="expected-prize-2">1.0점</strong></div>
          <div><span>참가비</span><strong data-role="breakdown-cost">2.0점</strong></div>
          <div><span>기대값이 음수일 때 가장 큰 손실 폭</span><strong data-role="edge">1.0점</strong></div>
        </div>
        <div class="simulation-box" data-role="simulation-box">
          <div class="panel-heading"><h3>1000회 모의실험</h3><span class="panel-kicker">SAMPLE</span></div>
          <p class="simulation-empty" data-role="simulation-empty">아직 모의실험을 실행하지 않았습니다.</p>
          <div class="simulation-result" data-role="simulation-result" hidden>
            <div><span>표본 평균</span><strong data-role="simulated-average">—</strong></div>
            <div><span>당첨 횟수</span><strong data-role="simulated-wins">—</strong></div>
          </div>
        </div>
        <p class="formula-note">기대값이 0이면 공정, 0보다 작으면 반복할수록 평균적으로 손실이 커집니다. 한 번의 결과는 기대값과 다를 수 있습니다.</p>
      </section>
    </div>

    <div class="lab-bottom">
      <section class="panel verdict-panel" aria-labelledby="ev-verdict-title">
        <div class="panel-heading"><h2 id="ev-verdict-title">공정성 판정</h2><span class="panel-kicker">FAIR OR NOT</span></div>
        <div class="verdict-row">
          <span class="verdict verdict--large" data-role="verdict-large">불공정</span>
          <p data-role="verdict-copy">기대값이 음수입니다. 반복할수록 평균적으로 참가비를 잃습니다.</p>
        </div>
        <p class="formula-note">이 화면은 확률 계산 연습용입니다. 도박이나 구매를 권하지 않으며, 실제 의사결정에 사용해서는 안 됩니다.</p>
      </section>
      <section class="panel table-panel" aria-labelledby="ev-table-title">
        <div class="panel-heading"><h2 id="ev-table-title">계산표</h2><span class="panel-kicker">ACCESSIBLE DATA</span></div>
        <div data-role="table"></div>
      </section>
    </div>
  </section>`);

  const payoffInput = qs<HTMLInputElement>(root, '[data-role="payoff"]');
  const probabilityInput = qs<HTMLInputElement>(root, '[data-role="probability"]');
  const costInput = qs<HTMLInputElement>(root, '[data-role="cost"]');
  const payoffOut = qs(root, '[data-role="payoff-out"]');
  const probabilityOut = qs(root, '[data-role="probability-out"]');
  const costOut = qs(root, '[data-role="cost-out"]');
  const seedOut = qs(root, '[data-role="seed"]');
  const simulateButton = qs<HTMLButtonElement>(root, '[data-role="simulate"]');
  const resetButton = qs<HTMLButtonElement>(root, '[data-role="reset"]');
  const newSeedButton = qs<HTMLButtonElement>(root, '[data-role="new-seed"]');
  const simulationEmpty = qs(root, '[data-role="simulation-empty"]');
  const simulationResult = qs(root, '[data-role="simulation-result"]');
  const simulatedAverage = qs(root, '[data-role="simulated-average"]');
  const simulatedWins = qs(root, '[data-role="simulated-wins"]');
  const tableHost = qs(root, '[data-role="table"]');

  let simulation: ExpectedGameResult | null = null;

  function currentGame() {
    const { payoffs, probabilities, cost } = store.get().expected;
    const value = expectedValue(payoffs, probabilities, cost);
    return { payoffs, probabilities, cost, value };
  }

  function verdictFor(value: number): 'fair' | 'unfair' | 'positive' {
    if (isFairGame(value)) return 'fair';
    return value > 0 ? 'positive' : 'unfair';
  }

  function verdictLabel(value: number): string {
    if (isFairGame(value)) return '공정';
    return value > 0 ? '기대값 양수' : '불공정';
  }

  function verdictCopy(value: number): string {
    if (isFairGame(value)) {
      return '기대 상금과 참가비가 같습니다. 장기적으로 평균 0점에 가깝습니다.';
    }
    if (value > 0) {
      return `기대값이 0보다 큽니다. 이론적으로 1회당 약 ${value.toFixed(1)}점의 이득이지만, 실제 결과는 크게 흔들릴 수 있습니다.`;
    }
    return '기대값이 음수입니다. 반복할수록 평균적으로 참가비를 잃습니다.';
  }

  function updateUI(): void {
    const { payoffs, probabilities, cost, value } = currentGame();
    const p = probabilities[0] ?? 0;
    const prize = payoffs[0] ?? 0;
    const expectedPrize = p * prize;
    const level = verdictFor(value);

    payoffInput.value = String(prize);
    probabilityInput.value = String(p * 100);
    costInput.value = String(cost);
    payoffOut.textContent = `${formatInt(prize)}점`;
    probabilityOut.textContent = formatPercent(p, 1);
    costOut.textContent = `${formatPoints(cost)}점`;
    seedOut.textContent = String(store.get().expected.seed);

    qs(root, '[data-role="prize"]').innerHTML = `${formatInt(prize)}<small>점</small>`;
    qs(root, '[data-role="cost"]').innerHTML = `${formatPoints(cost)}<small>점</small>`;
    qs(root, '[data-role="expected-prize"]').innerHTML =
      `${expectedPrize.toFixed(1)}<small>점</small>`;
    qs(root, '[data-role="expected-prize-2"]').textContent = `${expectedPrize.toFixed(1)}점`;
    qs(root, '[data-role="breakdown-cost"]').textContent = `${formatPoints(cost)}점`;
    qs(root, '[data-role="edge"]').textContent = `${Math.max(0, -value).toFixed(1)}점`;
    qs(root, '[data-role="ring"]').textContent = formatPercent(p, p < 0.01 ? 2 : 1);
    qs(root, '[data-role="table-p"]').textContent = formatPercent(p, 1);
    qs(root, '[data-role="table-win"]').textContent = `${formatInt(prize)}점`;
    qs(root, '[data-role="table-win-ev"]').textContent = `${expectedPrize.toFixed(1)}점`;
    qs(root, '[data-role="table-lose-p"]').textContent = formatPercent(1 - p, 1);

    const evOut = qs(root, '[data-role="ev"]');
    evOut.innerHTML = `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}<small>점</small>`;
    qs(root, '[data-role="ev"]').parentElement?.setAttribute('data-level', level);
    qs(root, '[data-role="verdict"]').textContent = verdictLabel(value);
    qs(root, '[data-role="verdict-large"]').textContent = verdictLabel(value);
    qs(root, '[data-role="verdict-large"]').dataset.level = level;
    qs(root, '[data-role="verdict-copy"]').textContent = verdictCopy(value);

    tableHost.innerHTML = dataTable(
      '결과별 확률, 상금, 기대 기여',
      ['결과', '확률', '상금', '기대 기여'],
      [
        ['당첨', formatPercent(p, 1), `${formatInt(prize)}점`, `${expectedPrize.toFixed(1)}점`],
        ['꽝', formatPercent(1 - p, 1), '0점', '0.0점'],
        ['참가비', '100%', `−${formatPoints(cost)}점`, `${(-cost).toFixed(1)}점`],
        ['합계', '', '', `${value.toFixed(1)}점`],
      ],
      true,
    );

    if (simulation) {
      simulationEmpty.hidden = true;
      simulationResult.hidden = false;
      simulatedAverage.textContent = `${simulation.simulatedAverage >= 0 ? '+' : '−'}${Math.abs(simulation.simulatedAverage).toFixed(2)}점`;
      simulatedWins.textContent = `${formatInt(simulation.counts[0])}회`;
    } else {
      simulationEmpty.hidden = false;
      simulationResult.hidden = true;
    }
  }

  function clearSimulation(): void {
    simulation = null;
  }

  function applyPreset(preset: Preset): void {
    store.update((current) => {
      current.expected.payoffs = [...preset.payoffs];
      current.expected.probabilities = [...preset.probabilities];
      current.expected.cost = preset.cost;
    });
    clearSimulation();
    updateUI();
    announce(`${preset.name} 설정을 적용했습니다.`);
  }

  function simulate(): void {
    const { payoffs, probabilities, cost, seed } = store.get().expected;
    simulation = simulateExpectedGame(payoffs, probabilities, cost, 1000, seed);
    updateUI();
    announce(
      `1000회 모의실험 완료. 표본 평균 ${simulation.simulatedAverage.toFixed(2)}점, 당첨 ${simulation.counts[0]}회.`,
    );
  }

  qsa<HTMLButtonElement>(root, '[data-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      const preset = PRESETS.find((item) => item.id === button.dataset.preset);
      if (preset) applyPreset(preset);
    });
  });

  payoffInput.addEventListener('input', () => {
    const payoff = Math.max(0, payoffInput.valueAsNumber || 0);
    store.update((current) => {
      current.expected.payoffs[0] = payoff;
    });
    clearSimulation();
    updateUI();
  });

  probabilityInput.addEventListener('input', () => {
    const p = Math.min(0.999, Math.max(0.001, probabilityInput.valueAsNumber / 100));
    store.update((current) => {
      current.expected.probabilities = [p, 1 - p];
    });
    clearSimulation();
    updateUI();
  });

  costInput.addEventListener('input', () => {
    const cost = Math.max(0, costInput.valueAsNumber || 0);
    store.update((current) => {
      current.expected.cost = cost;
    });
    clearSimulation();
    updateUI();
  });

  simulateButton.addEventListener('click', simulate);

  resetButton.addEventListener('click', () => {
    store.update((current) => {
      current.expected.payoffs = [10, 0];
      current.expected.probabilities = [0.1, 0.9];
      current.expected.cost = 2;
    });
    clearSimulation();
    updateUI();
    announce('기대값 실험을 초기화했습니다.');
  });

  newSeedButton.addEventListener('click', () => {
    const seed = randomSeed();
    store.update((current) => {
      current.expected.seed = seed;
    });
    clearSimulation();
    updateUI();
    announce(`새 시드 ${seed}를 설정했습니다.`);
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
      simulate();
    } else if (event.key.toLowerCase() === 'r') {
      resetButton.click();
    }
  };
  window.addEventListener('keydown', onKeydown);

  updateUI();

  return {
    element: root,
    destroy: () => {
      window.removeEventListener('keydown', onKeydown);
    },
  };
}
