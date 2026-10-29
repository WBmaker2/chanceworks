import type { MissionAnswer, Store } from '../../app/state';
import { ROUTE_META } from '../../app/routes';
import { Histogram } from '../../charts/Histogram';
import missionsData from '../../data/missions.json';
import { binomialPmf, binomialSummary, simulateGalton } from '../../prob/binomial';
import { findHeadsRun } from '../../prob/coin';
import { totalVariationDistance } from '../../prob/convergence';
import { diceSumProbabilities, observedDiceMode, simulateDice } from '../../prob/dice';
import { expectedValue } from '../../prob/expectedValue';
import { formatPercent } from '../../prob/stats';
import {
  announce,
  dataTable,
  escapeHtml,
  formatInt,
  formatPoints,
  fromHtml,
  qs,
} from '../../ui/dom';
import { pageHeader } from '../../ui/page';
import type { Mission } from './types';

export interface LabView {
  element: HTMLElement;
  destroy: () => void;
}

const MISSIONS = missionsData as Mission[];
const DIFFICULTY_LABEL = { 1: '기초', 2: '보통', 3: '도전' } as const;
const LAB_LABEL = {
  galton: '갈튼 보드',
  dice: '주사위',
  coin: '동전',
  expected: '기대값',
} as const;

interface GaltonRunSummary {
  rows: number;
  bias: number;
  counts: number[];
  total: number;
  theoretical: number[];
  tv: number;
}

type RunState =
  | { kind: 'galton'; run: GaltonRunSummary }
  | { kind: 'galton-compare'; small: GaltonRunSummary; large: GaltonRunSummary }
  | {
      kind: 'dice';
      counts: number[];
      total: number;
      theoretical: number[];
      tv: number;
      mode: number;
    }
  | { kind: 'coin'; flips: boolean[]; runEnd: number; runLength: number }
  | { kind: 'expected'; prize: number; value: number };

export function createMissionsView(store: Store): LabView {
  const meta = ROUTE_META.missions;
  const root = fromHtml(`<section class="lab-page">
    ${pageHeader(meta, ['예측 → 실험 → 설명', '진행 상황 저장', '교사 모드 연동'])}
    <div class="mission-layout">
      <aside class="panel mission-sidebar" aria-labelledby="mission-list-title">
        <div class="panel-heading"><h2 id="mission-list-title">미션 목록</h2><span class="panel-kicker" data-role="progress-label">0/6</span></div>
        <div class="mission-progress"><span data-role="progress-bar"></span></div>
        <ol class="mission-list" data-role="mission-list"></ol>
        <p class="mission-sidebar__note">완료한 미션은 이 기기에 저장됩니다. 교사 모드에서 초기화할 수 있습니다.</p>
      </aside>
      <div class="mission-detail" data-role="detail"></div>
    </div>
  </section>`);

  const listHost = qs(root, '[data-role="mission-list"]');
  const progressLabel = qs(root, '[data-role="progress-label"]');
  const progressBar = qs(root, '[data-role="progress-bar"]');
  const detailHost = qs(root, '[data-role="detail"]');

  let currentId =
    store.get().mission.currentId && MISSIONS.some((m) => m.id === store.get().mission.currentId)
      ? (store.get().mission.currentId as string)
      : (MISSIONS.find((mission) => !store.get().mission.completed.includes(mission.id))?.id ??
        MISSIONS[0].id);
  let predictionChoice: string | null = null;
  let explanationChoice: string | null = null;
  let feedback: 'correct' | 'incorrect' | null = null;
  let runState: RunState | null = null;
  let charts: Histogram[] = [];
  let evPrize = 10;

  if (store.get().mission.currentId !== currentId) {
    store.update((state) => {
      state.mission.currentId = currentId;
    });
  }

  function mission(): Mission {
    return MISSIONS.find((item) => item.id === currentId) ?? MISSIONS[0];
  }

  function answerFor(id: string): MissionAnswer {
    return store.get().mission.answers[id] ?? { ran: false, completed: false };
  }

  function isCompleted(id: string): boolean {
    return (
      store.get().mission.completed.includes(id) ||
      Boolean(store.get().mission.answers[id]?.completed)
    );
  }

  function completedCount(): number {
    return MISSIONS.filter((item) => isCompleted(item.id)).length;
  }

  function selectMission(id: string): void {
    if (!MISSIONS.some((item) => item.id === id)) return;
    currentId = id;
    predictionChoice = null;
    explanationChoice = null;
    feedback = null;
    runState = null;
    const selected = mission();
    evPrize = selected.setup.payoffs?.[0] ?? 10;
    store.update((state) => {
      state.mission.currentId = id;
    });
    render();
    detailHost.focus({ preventScroll: true });
  }

  function updateAnswer(id: string, patch: Partial<MissionAnswer>): void {
    store.update((state) => {
      const previous = state.mission.answers[id] ?? { ran: false, completed: false };
      state.mission.answers[id] = { ...previous, ...patch };
    });
  }

  function markCompleted(id: string): void {
    store.update((state) => {
      if (!state.mission.completed.includes(id)) state.mission.completed.push(id);
      const previous = state.mission.answers[id] ?? { ran: false, completed: false };
      state.mission.answers[id] = { ...previous, completed: true };
    });
  }

  function runGalton(mission: Mission, count: number): GaltonRunSummary {
    const rows = mission.setup.rows ?? 10;
    const bias = mission.setup.bias ?? 0.5;
    const seed = mission.setup.seed ?? 20261028;
    const simulation = simulateGalton(rows, bias, count, seed);
    const theoretical = binomialPmf(rows, bias);
    return {
      rows,
      bias,
      counts: [...simulation.counts],
      total: simulation.total,
      theoretical,
      tv: totalVariationDistance(simulation.counts, simulation.total, theoretical),
    };
  }

  function runExperiment(): void {
    const selected = mission();
    const answer = answerFor(selected.id);
    if (!answer.prediction) return;

    if (selected.setup.lab === 'galton') {
      if (selected.setup.compareBallCounts) {
        const [smallCount, largeCount] = selected.setup.compareBallCounts;
        runState = {
          kind: 'galton-compare',
          small: runGalton(selected, smallCount),
          large: runGalton(selected, largeCount),
        };
      } else {
        runState = {
          kind: 'galton',
          run: runGalton(selected, selected.setup.ballCount ?? 1000),
        };
      }
    } else if (selected.setup.lab === 'dice') {
      const rolls = selected.setup.rolls ?? 1000;
      const seed = selected.setup.seed ?? 20261028;
      const simulation = simulateDice(rolls, seed);
      const theoretical = diceSumProbabilities();
      runState = {
        kind: 'dice',
        counts: [...simulation.counts],
        total: simulation.total,
        theoretical,
        tv: totalVariationDistance(simulation.counts, simulation.total, theoretical),
        mode: observedDiceMode(simulation.counts),
      };
    } else if (selected.setup.lab === 'coin') {
      const seed = selected.setup.seed ?? 20261030;
      const runLength = selected.setup.runLength ?? 5;
      const found = findHeadsRun(runLength, seed);
      runState = { kind: 'coin', flips: found.flips, runEnd: found.runEnd, runLength };
    } else {
      const payoffs = [evPrize, 0];
      const probabilities = selected.setup.probabilities ?? [0.1, 0.9];
      const cost = selected.setup.cost ?? 2;
      runState = {
        kind: 'expected',
        prize: evPrize,
        value: expectedValue(payoffs, probabilities, cost),
      };
    }

    updateAnswer(selected.id, { ran: true });
    feedback = null;
    explanationChoice = null;
    render();
    announce('실험을 완료했습니다. 이제 설명 질문에 답할 수 있습니다.');
    const explanation = detailHost.querySelector<HTMLElement>('[data-step="explanation"]');
    explanation?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function submitPrediction(): void {
    if (!predictionChoice) return;
    const selected = mission();
    updateAnswer(selected.id, { prediction: predictionChoice });
    predictionChoice = null;
    render();
    announce('예측을 저장했습니다. 이제 실험을 실행하세요.');
    const experiment = detailHost.querySelector<HTMLElement>('[data-step="experiment"]');
    experiment?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function submitExplanation(): void {
    if (!explanationChoice) return;
    const selected = mission();
    const correct = explanationChoice === selected.explanationAnswer;
    updateAnswer(selected.id, { explanation: explanationChoice });
    if (correct) {
      markCompleted(selected.id);
      feedback = 'correct';
      announce(`정답입니다. ${selected.takeawayKo}`);
    } else {
      feedback = 'incorrect';
      announce('아직 정답이 아닙니다. 힌트를 보고 다시 생각해 보세요.');
    }
    explanationChoice = null;
    render();
  }

  function resetMission(): void {
    const selected = mission();
    predictionChoice = null;
    explanationChoice = null;
    feedback = null;
    runState = null;
    store.update((state) => {
      delete state.mission.answers[selected.id];
      state.mission.completed = state.mission.completed.filter((id) => id !== selected.id);
      state.mission.currentId = selected.id;
    });
    render();
    announce('이 미션을 처음부터 다시 시작합니다.');
  }

  function goNext(): void {
    const index = MISSIONS.findIndex((item) => item.id === currentId);
    const next =
      MISSIONS[index + 1] ?? MISSIONS.find((item) => !isCompleted(item.id)) ?? MISSIONS[0];
    selectMission(next.id);
  }

  function renderSidebar(): void {
    const completed = completedCount();
    progressLabel.textContent = `${completed}/${MISSIONS.length}`;
    progressBar.style.width = `${(completed / MISSIONS.length) * 100}%`;
    listHost.innerHTML = MISSIONS.map((item) => {
      const done = isCompleted(item.id);
      const active = item.id === currentId;
      const answer = answerFor(item.id);
      const inProgress = !done && Boolean(answer.prediction || answer.ran);
      return `<li>
        <button type="button" class="mission-list__item ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}" data-action="select-mission" data-mission-id="${item.id}" ${active ? 'aria-current="step"' : ''}>
          <span class="mission-list__number">${String(item.number).padStart(2, '0')}</span>
          <span class="mission-list__copy">
            <strong>${escapeHtml(item.titleKo)}</strong>
            <small>${escapeHtml(item.conceptLabel)} · ${DIFFICULTY_LABEL[item.difficulty]}</small>
          </span>
          <span class="mission-list__state">${done ? '완료' : inProgress ? '진행 중' : '시작 전'}</span>
        </button>
      </li>`;
    }).join('');
  }

  function stepState(index: number, done: boolean, active: boolean): string {
    return `<li class="${done ? 'is-done' : ''} ${active ? 'is-active' : ''}">
      <span class="mission-step__num">${done ? '✓' : index}</span>
      <span>${['예측', '실험', '설명'][index - 1]}</span>
    </li>`;
  }

  function buildSuccess(selected: Mission, answer: MissionAnswer): string {
    const predictionCorrect = answer.prediction === selected.predictionAnswer;
    const nextIndex = MISSIONS.findIndex((item) => item.id === selected.id);
    const hasNext = nextIndex < MISSIONS.length - 1 || completedCount() < MISSIONS.length;
    return `<article class="mission-card mission-success" tabindex="-1">
      <div class="success-mark" aria-hidden="true">✓</div>
      <p class="eyebrow">MISSION ${String(selected.number).padStart(2, '0')} COMPLETE</p>
      <h2>${escapeHtml(selected.titleKo)} 완료</h2>
      <div class="prediction-review ${predictionCorrect ? 'is-correct' : 'is-missed'}">
        <span>내 예측</span>
        <strong>${escapeHtml(answer.prediction ?? '—')}</strong>
        <span>${predictionCorrect ? '예측도 맞았습니다.' : `정답: ${escapeHtml(selected.predictionAnswer)}`}</span>
      </div>
      <div class="success-explanation">
        <h3>왜 그럴까요?</h3>
        <p>${escapeHtml(selected.explanationKo)}</p>
        <div class="takeaway-box">
          <span class="takeaway-box__label">한 줄 정리</span>
          <p>${escapeHtml(selected.takeawayKo)}</p>
        </div>
      </div>
      <div class="mission-actions">
        ${hasNext ? '<button type="button" class="btn btn-primary btn-pulse" data-action="next-mission">다음 미션</button>' : ''}
        <button type="button" class="btn btn-secondary" data-action="reset-mission">처음부터 다시</button>
      </div>
    </article>`;
  }

  function buildPrediction(selected: Mission, answer: MissionAnswer): string {
    if (answer.prediction) {
      return `<section class="mission-card mission-step" data-step="prediction">
        <div class="mission-card__head">
          <span class="mission-card__badge">01</span>
          <div><p class="eyebrow">PREDICT</p><h2>예측</h2></div>
          <span class="step-status is-done">저장됨</span>
        </div>
        <p class="mission-question">${escapeHtml(selected.promptKo)}</p>
        <div class="locked-answer">
          <span>내 예측</span>
          <strong>${escapeHtml(answer.prediction)}</strong>
        </div>
        <p class="field__hint">예측은 실험 전에 고정됩니다. 실험 결과와 비교해 보세요.</p>
      </section>`;
    }

    return `<section class="mission-card mission-step" data-step="prediction">
      <div class="mission-card__head">
        <span class="mission-card__badge">01</span>
        <div><p class="eyebrow">PREDICT</p><h2>먼저 예측하세요</h2></div>
      </div>
      <p class="mission-question">${escapeHtml(selected.promptKo)}</p>
      <div class="option-list" role="radiogroup" aria-label="예측 선택">
        ${selected.predictionOptions
          .map(
            (option) => `<label class="option">
              <input type="radio" name="prediction-${selected.id}" value="${escapeHtml(option)}" data-prediction-option />
              <span class="option__mark" aria-hidden="true"></span>
              <span>${escapeHtml(option)}</span>
            </label>`,
          )
          .join('')}
      </div>
      <div class="mission-actions">
        <button type="button" class="btn btn-primary btn-pulse" data-action="submit-prediction" disabled>예측 제출</button>
      </div>
    </section>`;
  }

  function buildLockedStep(number: string, title: string, message: string, step: string): string {
    return `<section class="mission-card mission-step is-locked" data-step="${step}">
      <div class="mission-card__head">
        <span class="mission-card__badge">${number}</span>
        <div><p class="eyebrow">LOCKED</p><h2>${escapeHtml(title)}</h2></div>
      </div>
      <p class="locked-message">${escapeHtml(message)}</p>
    </section>`;
  }

  function buildExperiment(selected: Mission, answer: MissionAnswer): string {
    if (!answer.prediction) {
      return buildLockedStep(
        '02',
        '실험',
        '예측을 먼저 제출하면 실험을 실행할 수 있습니다.',
        'experiment',
      );
    }
    return `<section class="mission-card mission-step" data-step="experiment">
      <div class="mission-card__head">
        <span class="mission-card__badge">02</span>
        <div><p class="eyebrow">RUN · ${escapeHtml(LAB_LABEL[selected.setup.lab])}</p><h2>실험으로 확인하세요</h2></div>
        ${answer.ran ? '<span class="step-status is-done">실행 완료</span>' : ''}
      </div>
      ${answer.ran && runState ? buildRunResult(selected) : ''}
      ${answer.ran && !runState ? '<p class="result-note">이전에 이 미션의 실험을 완료했습니다. 필요하면 다시 실행해 관찰하세요.</p>' : ''}
      <div class="mission-actions">
        <button type="button" class="btn ${answer.ran ? 'btn-secondary' : 'btn-primary'} ${answer.ran ? '' : 'btn-pulse'}" data-action="run-experiment">${answer.ran ? '다시 실행' : escapeHtml(selected.runLabel)}</button>
      </div>
    </section>`;
  }

  function buildRunResult(selected: Mission): string {
    if (!runState) return '';
    if (runState.kind === 'galton') {
      const { run } = runState;
      const mode = run.counts.indexOf(Math.max(...run.counts));
      return `<div class="mission-run" data-run-kind="galton">
        <div class="mini-stat-grid">
          <div><span>표본 수</span><strong>${formatInt(run.total)}</strong></div>
          <div><span>관찰 최빈 칸</span><strong>${mode}번</strong></div>
          <div><span>이론 최빈 칸</span><strong>${binomialPmf(run.rows, run.bias).indexOf(Math.max(...run.theoretical))}번</strong></div>
          <div><span>이론과의 차이</span><strong>${formatPercent(run.tv)}</strong></div>
        </div>
        <canvas class="chart-canvas chart-canvas--mission" data-mission-chart="galton" aria-label="미션 갈튼 보드 분포"></canvas>
        ${galtonTable(run)}
      </div>`;
    }
    if (runState.kind === 'galton-compare') {
      return `<div class="mission-run" data-run-kind="galton-compare">
        <div class="compare-grid">
          ${compareCard('10개', runState.small)}
          ${compareCard('1000개', runState.large)}
        </div>
        <div class="compare-charts">
          <div><span class="compare-chart__label">10개</span><canvas class="chart-canvas chart-canvas--small" data-mission-chart="galton-small" aria-label="10개 표본의 갈튼 보드 분포"></canvas></div>
          <div><span class="compare-chart__label">1000개</span><canvas class="chart-canvas chart-canvas--small" data-mission-chart="galton-large" aria-label="1000개 표본의 갈튼 보드 분포"></canvas></div>
        </div>
        <p class="result-note">표본이 늘어도 ‘이론과의 차이’가 매번 반드시 줄어드는 것은 아닙니다. 여러 번 실행해 경향을 확인하세요.</p>
      </div>`;
    }
    if (runState.kind === 'dice') {
      const diceState = runState;
      return `<div class="mission-run" data-run-kind="dice">
        <div class="mini-stat-grid">
          <div><span>표본 수</span><strong>${formatInt(diceState.total)}</strong></div>
          <div><span>관찰 최빈 합</span><strong>${diceState.mode}</strong></div>
          <div><span>이론 최빈 합</span><strong>7</strong></div>
          <div><span>이론과의 차이</span><strong>${formatPercent(diceState.tv)}</strong></div>
        </div>
        <canvas class="chart-canvas chart-canvas--mission" data-mission-chart="dice" aria-label="미션 두 주사위 합의 분포"></canvas>
        ${dataTable(
          '미션 주사위 합 관찰값',
          ['합', '관찰 횟수', '관찰 비율', '이론 확률'],
          Array.from({ length: 11 }, (_, index) => [
            String(index + 2),
            formatInt(diceState.counts[index]),
            formatPercent(diceState.counts[index] / diceState.total),
            formatPercent(diceState.theoretical[index]),
          ]),
        )}
      </div>`;
    }
    if (runState.kind === 'coin') {
      const coinState = runState;
      const runEnd = coinState.runEnd;
      const start = Math.max(0, runEnd - 11);
      const visible = coinState.flips.slice(start, runEnd + 1);
      const runStart = runEnd - coinState.runLength + 1;
      return `<div class="mission-run" data-run-kind="coin">
        <div class="coin-sequence" aria-label="동전 던지기 표본. 마지막 다섯 번이 앞면입니다.">
          ${visible
            .map((isHeads, index) => {
              const absolute = start + index;
              const inRun = absolute >= runStart && absolute <= runEnd;
              return `<span class="coin-chip ${isHeads ? 'is-heads' : 'is-tails'} ${inRun ? 'is-run' : ''}">${isHeads ? '앞' : '뒤'}</span>`;
            })
            .join('')}
        </div>
        <p class="result-note">표본에서 앞면 ${coinState.runLength}연속 장면을 찾았습니다. 이것은 한 번의 표본이며, 다음 결과를 미리 정하지 않습니다.</p>
        <div class="next-flip-box">
          <span>다음 던지기의 이론 확률</span>
          <strong>앞면 50% · 뒷면 50%</strong>
        </div>
      </div>`;
    }
    const probabilities = selected.setup.probabilities ?? [0.1, 0.9];
    const cost = selected.setup.cost ?? 2;
    return `<div class="mission-run" data-run-kind="expected">
      <div class="mission-ev-editor">
        <div class="field__label"><label for="mission-ev-slider">당첨 상금</label><output data-role="ev-prize">${formatInt(runState.prize)}점</output></div>
        <input id="mission-ev-slider" data-ev-slider type="range" min="0" max="50" step="1" value="${runState.prize}" />
        <div class="mission-ev-value" data-role="ev-live">
          <span>EV</span>
          <strong>${runState.value.toFixed(1)}점</strong>
          <span class="verdict ${Math.abs(runState.value) < 1e-9 ? 'is-fair' : ''}">${Math.abs(runState.value) < 1e-9 ? '공정' : runState.value < 0 ? '불공정' : '기대값 양수'}</span>
        </div>
        <p class="field__hint">당첨 확률 ${formatPercent(probabilities[0], 1)} · 참가비 ${formatPoints(cost)}점. 상금을 바꾸며 EV가 0이 되는 값을 찾아보세요.</p>
      </div>
    </div>`;
  }

  function compareCard(label: string, run: GaltonRunSummary): string {
    const mode = run.counts.indexOf(Math.max(...run.counts));
    return `<div class="compare-card">
      <span class="compare-card__label">${label}</span>
      <strong>관찰 최빈 칸 ${mode}번</strong>
      <span>TV ${formatPercent(run.tv)}</span>
      <small>${formatInt(run.total)}개 표본</small>
    </div>`;
  }

  function galtonTable(run: GaltonRunSummary): string {
    return dataTable(
      '미션 갈튼 보드 칸별 관찰값',
      ['칸', '관찰 횟수', '관찰 비율', '이론 확률'],
      Array.from({ length: run.rows + 1 }, (_, index) => [
        `${index}번`,
        formatInt(run.counts[index]),
        formatPercent(run.total > 0 ? run.counts[index] / run.total : 0),
        formatPercent(run.theoretical[index]),
      ]),
    );
  }

  function buildExplanation(selected: Mission, answer: MissionAnswer): string {
    if (!answer.prediction) {
      return buildLockedStep(
        '03',
        '설명',
        '예측을 제출하고 실험을 실행하면 설명 질문이 열립니다.',
        'explanation',
      );
    }
    if (!answer.ran) {
      return buildLockedStep(
        '03',
        '설명',
        '실험을 먼저 실행하면 설명 질문이 열립니다.',
        'explanation',
      );
    }
    if (feedback === 'incorrect') {
      return `<section class="mission-card mission-step" data-step="explanation">
        <div class="mission-card__head">
          <span class="mission-card__badge">03</span>
          <div><p class="eyebrow">EXPLAIN</p><h2>한 번 더 생각해 보세요</h2></div>
        </div>
        <div class="feedback feedback--hint">
          <strong>아직 정답이 아닙니다.</strong>
          <p>${escapeHtml(selected.hintKo)}</p>
        </div>
        <p class="mission-question">${escapeHtml(selected.explanationPromptKo)}</p>
        <div class="option-list" role="radiogroup" aria-label="설명 선택">
          ${selected.explanationOptions
            .map(
              (option) => `<label class="option">
                <input type="radio" name="explanation-${selected.id}" value="${escapeHtml(option)}" data-explanation-option />
                <span class="option__mark" aria-hidden="true"></span>
                <span>${escapeHtml(option)}</span>
              </label>`,
            )
            .join('')}
        </div>
        <div class="mission-actions">
          <button type="button" class="btn btn-primary" data-action="submit-explanation" disabled>다시 제출</button>
        </div>
      </section>`;
    }

    return `<section class="mission-card mission-step" data-step="explanation">
      <div class="mission-card__head">
        <span class="mission-card__badge">03</span>
        <div><p class="eyebrow">EXPLAIN</p><h2>근거를 설명하세요</h2></div>
      </div>
      <p class="mission-question">${escapeHtml(selected.explanationPromptKo)}</p>
      <div class="option-list" role="radiogroup" aria-label="설명 선택">
        ${selected.explanationOptions
          .map(
            (option) => `<label class="option">
              <input type="radio" name="explanation-${selected.id}" value="${escapeHtml(option)}" data-explanation-option />
              <span class="option__mark" aria-hidden="true"></span>
              <span>${escapeHtml(option)}</span>
            </label>`,
          )
          .join('')}
      </div>
      <div class="mission-actions">
        <button type="button" class="btn btn-primary btn-pulse" data-action="submit-explanation" disabled>설명 제출</button>
      </div>
    </section>`;
  }

  function buildDetail(): string {
    const selected = mission();
    const answer = answerFor(selected.id);
    const completed = isCompleted(selected.id);
    const allCompleted = completedCount() === MISSIONS.length;
    const activeStep = completed ? 4 : !answer.prediction ? 1 : !answer.ran ? 2 : 3;

    if (completed) {
      return `<div class="mission-detail__top">
        <span class="mission-detail__tag">MISSION ${String(selected.number).padStart(2, '0')} / ${MISSIONS.length}</span>
        <span class="difficulty">난이도 ${'●'.repeat(selected.difficulty)}${'○'.repeat(3 - selected.difficulty)}</span>
      </div>
      ${buildSuccess(selected, answer)}
      ${allCompleted ? '<p class="all-complete-note">모든 미션을 완료했습니다. 교사 모드에서 워크시트를 인쇄하거나 진행을 초기화할 수 있습니다.</p>' : ''}`;
    }

    return `<div class="mission-detail__top">
      <span class="mission-detail__tag">MISSION ${String(selected.number).padStart(2, '0')} / ${MISSIONS.length} · ${escapeHtml(selected.conceptLabel)}</span>
      <span class="difficulty">난이도 ${'●'.repeat(selected.difficulty)}${'○'.repeat(3 - selected.difficulty)}</span>
    </div>
    <header class="mission-detail__header">
      <h2>${escapeHtml(selected.titleKo)}</h2>
      <p>${escapeHtml(selected.promptKo)}</p>
    </header>
    <ol class="mission-steps" aria-label="미션 진행 단계">
      ${stepState(1, Boolean(answer.prediction), activeStep === 1)}
      ${stepState(2, Boolean(answer.ran), activeStep === 2)}
      ${stepState(3, completed, activeStep === 3)}
    </ol>
    <div class="mission-flow">
      ${buildPrediction(selected, answer)}
      ${buildExperiment(selected, answer)}
      ${buildExplanation(selected, answer)}
    </div>
    <div class="mission-detail__footer">
      <button type="button" class="btn btn-ghost" data-action="reset-mission">미션 처음부터</button>
      <p>실험 결과는 시드로 정해진 모의실험이며 실제 사건을 예측하지 않습니다. 예측과 완료 여부만 이 기기에 저장됩니다.</p>
    </div>`;
  }

  function mountCharts(): void {
    charts = [];
    if (!runState) return;
    if (runState.kind === 'galton') {
      const canvas = detailHost.querySelector<HTMLCanvasElement>('[data-mission-chart="galton"]');
      if (!canvas) return;
      const { run } = runState;
      const normal = binomialSummary(run.rows, run.bias);
      const chart = new Histogram(canvas, {
        showTheoretical: true,
        showNormal: run.rows >= 8 && store.get().preferences.showNormalCurve,
      });
      chart.setData({
        labels: Array.from({ length: run.rows + 1 }, (_, index) => String(index)),
        counts: run.counts,
        total: run.total,
        theoretical: run.theoretical,
        normal:
          run.rows >= 8 && store.get().preferences.showNormalCurve
            ? { mean: normal.mean, sd: normal.sd, label: '정규분포 근사' }
            : null,
      });
      charts.push(chart);
    } else if (runState.kind === 'galton-compare') {
      for (const key of ['small', 'large'] as const) {
        const canvas = detailHost.querySelector<HTMLCanvasElement>(
          `[data-mission-chart="galton-${key}"]`,
        );
        if (!canvas) continue;
        const run = runState[key];
        const chart = new Histogram(canvas, {
          showTheoretical: true,
          showNormal: false,
          emptyMessage: '',
        });
        chart.setData({
          labels: Array.from({ length: run.rows + 1 }, (_, index) => String(index)),
          counts: run.counts,
          total: run.total,
          theoretical: run.theoretical,
          normal: null,
        });
        charts.push(chart);
      }
    } else if (runState.kind === 'dice') {
      const canvas = detailHost.querySelector<HTMLCanvasElement>('[data-mission-chart="dice"]');
      if (!canvas) return;
      const chart = new Histogram(canvas, { showTheoretical: true, showNormal: false });
      chart.setData({
        labels: Array.from({ length: 11 }, (_, index) => String(index + 2)),
        counts: runState.counts,
        total: runState.total,
        theoretical: runState.theoretical,
        normal: null,
      });
      charts.push(chart);
    }
  }

  function render(): void {
    for (const chart of charts) chart.destroy();
    charts = [];
    renderSidebar();
    detailHost.innerHTML = buildDetail();
    mountCharts();
    const focusable = detailHost.querySelector<HTMLElement>('.mission-detail__header h2');
    if (focusable) focusable.setAttribute('tabindex', '-1');
  }

  function updateLiveEv(slider: HTMLInputElement): void {
    evPrize = Number(slider.value);
    const selected = mission();
    const probabilities = selected.setup.probabilities ?? [0.1, 0.9];
    const cost = selected.setup.cost ?? 2;
    const value = expectedValue([evPrize, 0], probabilities, cost);
    const output = detailHost.querySelector('[data-role="ev-prize"]');
    if (output) output.textContent = `${formatInt(evPrize)}점`;
    const live = detailHost.querySelector('[data-role="ev-live"]');
    if (live) {
      const fair = Math.abs(value) < 1e-9;
      live.innerHTML = `<span>EV</span><strong>${value.toFixed(1)}점</strong><span class="verdict ${fair ? 'is-fair' : ''}">${fair ? '공정' : value < 0 ? '불공정' : '기대값 양수'}</span>`;
    }
  }

  root.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'select-mission') selectMission(target.dataset.missionId ?? '');
    else if (action === 'submit-prediction') submitPrediction();
    else if (action === 'run-experiment') runExperiment();
    else if (action === 'submit-explanation') submitExplanation();
    else if (action === 'next-mission') goNext();
    else if (action === 'reset-mission') resetMission();
  });

  root.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    if (input.matches('[data-prediction-option]')) {
      predictionChoice = input.value;
      const button = detailHost.querySelector<HTMLButtonElement>(
        '[data-action="submit-prediction"]',
      );
      if (button) button.disabled = false;
    } else if (input.matches('[data-explanation-option]')) {
      explanationChoice = input.value;
      const button = detailHost.querySelector<HTMLButtonElement>(
        '[data-action="submit-explanation"]',
      );
      if (button) button.disabled = false;
    }
  });

  root.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    if (target.matches('[data-ev-slider]')) updateLiveEv(target);
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
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const index = MISSIONS.findIndex((item) => item.id === currentId);
      const nextIndex = Math.min(
        MISSIONS.length - 1,
        Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)),
      );
      if (nextIndex !== index) {
        event.preventDefault();
        selectMission(MISSIONS[nextIndex].id);
      }
    }
  };
  window.addEventListener('keydown', onKeydown);

  detailHost.setAttribute('tabindex', '-1');
  render();

  return {
    element: root,
    destroy: () => {
      for (const chart of charts) chart.destroy();
      window.removeEventListener('keydown', onKeydown);
    },
  };
}
