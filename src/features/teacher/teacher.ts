import type { Store } from '../../app/state';
import { hashForRoute, ROUTE_META } from '../../app/routes';
import missionsData from '../../data/missions.json';
import { clearProgress } from '../../storage/progress';
import { announce, escapeHtml, fromHtml, qs, qsa } from '../../ui/dom';
import { pageHeader } from '../../ui/page';
import type { Mission } from '../missions/types';

export interface LabView {
  element: HTMLElement;
  destroy: () => void;
}

const MISSIONS = missionsData as Mission[];

export function createTeacherView(store: Store): LabView {
  const meta = ROUTE_META.teacher;
  const root = fromHtml(`<section class="lab-page teacher-page">
    ${pageHeader(meta, ['정답과 해설', '진행 초기화', '워크시트 인쇄'])}
    <div class="teacher-toolbar">
      <div class="teacher-stats">
        <div class="stat-card"><span>완료한 미션</span><strong data-role="completed">0 / 6</strong></div>
        <div class="stat-card"><span>정답 표시</span><strong data-role="answer-state">숨김</strong></div>
        <div class="stat-card"><span>데이터 저장</span><strong>이 기기만</strong></div>
      </div>
      <div class="teacher-actions">
        <label class="switch switch--panel"><input type="checkbox" data-role="show-answers" /> <span>정답 보기</span></label>
        <label class="switch switch--panel"><input type="checkbox" data-role="reduced-motion" /> <span>동작 줄이기</span></label>
        <button type="button" class="btn btn-secondary" data-role="print">워크시트 인쇄</button>
        <button type="button" class="btn btn-danger" data-role="reset-progress">진행 초기화</button>
      </div>
    </div>

    <div class="teacher-grid">
      <section class="panel teacher-presets" aria-labelledby="teacher-presets-title">
        <div class="panel-heading"><h2 id="teacher-presets-title">수업 시나리오</h2><span class="panel-kicker">PRESETS</span></div>
        <p class="teacher-panel-copy">버튼을 누르면 해당 설정으로 실험실이 열립니다.</p>
        <div class="preset-list">
          <button type="button" class="preset-card" data-preset-action="bias">
            <strong>치우친 못</strong><span>갈튼 보드 · 10줄 · 오른쪽 0.7 · 1000개</span>
          </button>
          <button type="button" class="preset-card" data-preset-action="sample-small">
            <strong>표본 10개</strong><span>갈튼 보드 · 공정한 못 · 표본이 적을 때</span>
          </button>
          <button type="button" class="preset-card" data-preset-action="sample-large">
            <strong>표본 1000개</strong><span>갈튼 보드 · 공정한 못 · 수렴 확인</span>
          </button>
          <button type="button" class="preset-card" data-preset-action="dice">
            <strong>주사위 1000번</strong><span>두 주사위 합의 분포 확인</span>
          </button>
          <button type="button" class="preset-card" data-preset-action="unfair">
            <strong>불공정 게임</strong><span>기대값 · 상금 10점 · 확률 10% · 참가비 2점</span>
          </button>
          <button type="button" class="preset-card" data-preset-action="fair">
            <strong>공정 게임</strong><span>기대값 · 상금 20점 · 확률 10% · 참가비 2점</span>
          </button>
        </div>
      </section>

      <section class="teacher-missions" aria-labelledby="teacher-missions-title">
        <div class="teacher-missions__head">
          <h2 id="teacher-missions-title">미션 정답과 해설</h2>
          <span class="badge">정답 보기 토글로 화면에서 가릴 수 있습니다</span>
        </div>
        <div class="answer-hidden-note">정답이 가려져 있습니다. 위의 <strong>정답 보기</strong>를 켜면 수업용 해설이 나타납니다.</div>
        <div class="teacher-mission-list">
          ${MISSIONS.map(missionAnswerCard).join('')}
        </div>
      </section>
    </div>

    <section class="worksheet" aria-hidden="true">
      <header class="worksheet__head">
        <div><p>CHANCEWORKS · 확률 실험실</p><h1>확률 미션 워크시트</h1></div>
        <div class="worksheet__name"><span>이름</span><span class="blank-line"></span><span>날짜</span><span class="blank-line"></span></div>
      </header>
      <p class="worksheet__intro">예측을 먼저 적고, 실험 결과를 기록한 뒤, 왜 그런지 설명해 보세요. 실험실의 시드와 설정도 함께 적으면 같은 실험을 다시 재현할 수 있습니다.</p>
      ${worksheetSections()}
      <footer class="worksheet__footer">ChanceWorks · 시드 기반 확률 모의실험 · 실제 사건을 예측하지 않습니다.</footer>
    </section>
  </section>`);

  const completedOut = qs(root, '[data-role="completed"]');
  const answerState = qs(root, '[data-role="answer-state"]');
  const showAnswers = qs<HTMLInputElement>(root, '[data-role="show-answers"]');
  const reducedMotion = qs<HTMLInputElement>(root, '[data-role="reduced-motion"]');
  const printButton = qs<HTMLButtonElement>(root, '[data-role="print"]');
  const resetButton = qs<HTMLButtonElement>(root, '[data-role="reset-progress"]');

  function updateUI(): void {
    const done = store.get().mission.completed.length;
    completedOut.textContent = `${done} / ${MISSIONS.length}`;
    showAnswers.checked = store.get().preferences.showAnswers;
    reducedMotion.checked =
      store.get().preferences.reducedMotion ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.classList.toggle('answers-hidden', !showAnswers.checked);
    answerState.textContent = showAnswers.checked ? '표시' : '숨김';
  }

  showAnswers.addEventListener('change', () => {
    store.update((state) => {
      state.preferences.showAnswers = showAnswers.checked;
    });
    updateUI();
  });

  reducedMotion.addEventListener('change', () => {
    store.update((state) => {
      state.preferences.reducedMotion = reducedMotion.checked;
    });
    updateUI();
  });

  printButton.addEventListener('click', () => {
    window.print();
  });

  resetButton.addEventListener('click', () => {
    const confirmed = window.confirm(
      '모든 미션의 예측, 완료 기록, 진행 상황을 초기화할까요? 이 작업은 되돌릴 수 없습니다.',
    );
    if (!confirmed) return;
    clearProgress();
    store.update((state) => {
      state.mission = { currentId: null, answers: {}, completed: [] };
    });
    updateUI();
    announce('모든 미션 진행 상황을 초기화했습니다.');
  });

  qsa<HTMLButtonElement>(root, '[data-preset-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.presetAction;
      if (action === 'bias') {
        store.update((state) => {
          state.galton.rows = 10;
          state.galton.bias = 0.7;
          state.galton.ballCount = 1000;
          state.galton.seed = 20261029;
        });
        location.hash = hashForRoute('galton');
      } else if (action === 'sample-small') {
        store.update((state) => {
          state.galton.rows = 10;
          state.galton.bias = 0.5;
          state.galton.ballCount = 10;
          state.galton.seed = 20261028;
        });
        location.hash = hashForRoute('galton');
      } else if (action === 'sample-large') {
        store.update((state) => {
          state.galton.rows = 10;
          state.galton.bias = 0.5;
          state.galton.ballCount = 1000;
          state.galton.seed = 20261028;
        });
        location.hash = hashForRoute('galton');
      } else if (action === 'dice') {
        store.update((state) => {
          state.dice.rolls = 1000;
          state.dice.seed = 20261028;
        });
        location.hash = hashForRoute('dice');
      } else if (action === 'unfair') {
        store.update((state) => {
          state.expected.payoffs = [10, 0];
          state.expected.probabilities = [0.1, 0.9];
          state.expected.cost = 2;
        });
        location.hash = hashForRoute('expected');
      } else if (action === 'fair') {
        store.update((state) => {
          state.expected.payoffs = [20, 0];
          state.expected.probabilities = [0.1, 0.9];
          state.expected.cost = 2;
        });
        location.hash = hashForRoute('expected');
      }
    });
  });

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion.checked = store.get().preferences.reducedMotion || motionQuery.matches;
  updateUI();

  return {
    element: root,
    destroy: () => {},
  };
}

function missionAnswerCard(mission: Mission): string {
  return `<article class="teacher-mission">
    <header class="teacher-mission__head">
      <span class="teacher-mission__number">${String(mission.number).padStart(2, '0')}</span>
      <div>
        <h3>${escapeHtml(mission.titleKo)}</h3>
        <p>${escapeHtml(mission.conceptLabel)} · 난이도 ${mission.difficulty}</p>
      </div>
      <span class="teacher-mission__lab">${labLabel(mission.setup.lab)}</span>
    </header>
    <p class="teacher-mission__prompt">${escapeHtml(mission.promptKo)}</p>
    <div class="answer-block">
      <div class="answer-row"><span>예측 정답</span><strong>${escapeHtml(mission.predictionAnswer)}</strong></div>
      <div class="answer-row"><span>설명 정답</span><strong>${escapeHtml(mission.explanationAnswer)}</strong></div>
      <p class="teacher-explanation">${escapeHtml(mission.explanationKo)}</p>
      <div class="takeaway-box"><span class="takeaway-box__label">한 줄 정리</span><p>${escapeHtml(mission.takeawayKo)}</p></div>
      <p class="teacher-hint">힌트 · ${escapeHtml(mission.hintKo)}</p>
    </div>
  </article>`;
}

function labLabel(lab: Mission['setup']['lab']): string {
  return { galton: '갈튼 보드', dice: '주사위', coin: '동전', expected: '기대값' }[lab];
}

function blankRows(count: number, label: (index: number) => string): string {
  return Array.from(
    { length: count },
    (_, index) => `<tr><td>${label(index)}</td><td></td><td></td></tr>`,
  ).join('');
}

function worksheetSections(): string {
  return `<section class="worksheet-block">
    <h2>미션 1 · 가장 가능성 높은 칸</h2>
    <p>예측: 가장 많이 쌓일 칸은? ____________________</p>
    <p>설정: 줄 수 ______ · 오른쪽 확률 ______ · 공 개수 ______ · 시드 ______</p>
    <table class="worksheet-table"><thead><tr><th>칸</th><th>관찰 횟수</th><th>관찰 비율</th></tr></thead><tbody>${blankRows(11, (index) => `${index}번`)}</tbody></table>
    <p>설명: ________________________________________________________________________________</p>
  </section>
  <section class="worksheet-block">
    <h2>미션 2 · 표본이 많아지면</h2>
    <p>예측: 10개와 1000개 중 이론값에 더 가까운 쪽은? ____________________</p>
    <table class="worksheet-table"><thead><tr><th>표본 수</th><th>관찰 최빈 칸</th><th>이론과의 차이(TV)</th></tr></thead><tbody><tr><td>10개</td><td></td><td></td></tr><tr><td>1000개</td><td></td><td></td></tr></tbody></table>
    <p>설명: 수렴 미터의 값이 어떻게 달라졌나요? __________________________________________</p>
  </section>
  <section class="worksheet-block">
    <h2>미션 3 · 치우친 못</h2>
    <p>예측: 오른쪽 확률이 0.7일 때 분포는 어느 쪽으로 치우칠까? ____________________</p>
    <table class="worksheet-table"><thead><tr><th>칸</th><th>관찰 횟수</th><th>이론 확률</th></tr></thead><tbody>${blankRows(11, (index) => `${index}번`)}</tbody></table>
    <p>설명: 평균 μ = n × p = ______ 이므로 가장 가능성 높은 칸은 ______번입니다.</p>
  </section>
  <section class="worksheet-block">
    <h2>미션 4 · 두 주사위의 합</h2>
    <p>예측: 가장 자주 나오는 합은? ______</p>
    <p>36가지 결과표에서 각 합이 나오는 경우의 수를 세어 보세요.</p>
    <table class="worksheet-table"><thead><tr><th>합</th><th>경우의 수</th><th>관찰 횟수</th></tr></thead><tbody>${blankRows(11, (index) => String(index + 2))}</tbody></table>
    <p>설명: 합이 7인 경우의 수가 가장 많은 까닭은? ________________________________________</p>
  </section>
  <section class="worksheet-block">
    <h2>미션 5 · 앞면 5번 후</h2>
    <p>예측: 앞면 5연속 뒤 다음 던지기에서 앞면과 뒷면의 확률은? ____________________</p>
    <div class="worksheet-flips">${Array.from({ length: 10 }, () => '<span></span>').join('')}</div>
    <p>설명: 각 던지기가 독립이라는 말은 무슨 뜻인가요? __________________________________</p>
  </section>
  <section class="worksheet-block">
    <h2>미션 6 · 공정한 게임</h2>
    <p>게임: 당첨 상금 ______점 · 당첨 확률 ______% · 참가비 ______점</p>
    <table class="worksheet-table"><thead><tr><th>결과</th><th>확률</th><th>상금</th><th>기대 기여</th></tr></thead><tbody><tr><td>당첨</td><td></td><td></td><td></td></tr><tr><td>꽝</td><td></td><td></td><td></td></tr><tr><td>참가비</td><td></td><td></td><td></td></tr><tr><td>합계(EV)</td><td></td><td></td><td></td></tr></tbody></table>
    <p>설명: EV = 0이 되게 하려면 상금을 얼마로 바꿔야 하나요? ____________________</p>
  </section>`;
}
