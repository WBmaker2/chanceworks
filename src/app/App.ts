import { createCoinLab } from '../features/coin/coin';
import { createDiceLab } from '../features/dice/dice';
import { createExpectedLab } from '../features/expectedValue/expectedValue';
import { createGaltonLab } from '../features/galton/galton';
import { createMissionsView } from '../features/missions/missions';
import { createSpinnerLab } from '../features/spinner/spinner';
import { createTeacherView } from '../features/teacher/teacher';
import { fromHtml, qs, qsa } from '../ui/dom';
import { hashForRoute, ROUTE_META, ROUTES, routeFromHash, type Route } from './routes';
import type { Store } from './state';

interface View {
  element: HTMLElement;
  destroy: () => void;
}

export class App {
  private readonly store: Store;
  private readonly root: HTMLElement;
  private readonly main: HTMLElement;
  private readonly viewHost: HTMLElement;
  private activeView: View | null = null;

  constructor(store: Store, root: HTMLElement) {
    this.store = store;
    this.root = root;
    this.root.innerHTML = '';
    const shell = fromHtml(`<div class="app-shell">
      <header class="app-header">
        <a class="brand" href="#/galton">
          <span class="brand__mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" role="presentation">
              <path d="M4 35h40" />
              <path d="M7 33c6 0 7-1 10-7s5-13 9-13 6 7 9 13 4 7 10 7" />
              <circle cx="26" cy="13" r="2.4" />
              <circle cx="11" cy="28" r="1.6" />
              <circle cx="39" cy="28" r="1.6" />
            </svg>
          </span>
          <span class="brand__text"><strong>ChanceWorks</strong><small>확률 실험실</small></span>
        </a>
        <nav class="app-nav" aria-label="실험실 메뉴">
          ${ROUTES.map(
            (route) => `<a href="#/${route}" data-nav="${route}">${ROUTE_META[route].label}</a>`,
          ).join('')}
        </nav>
        <div class="header-status"><span class="status-dot" aria-hidden="true"></span><span>서버 없이 실행</span></div>
      </header>
      <main id="main" tabindex="-1"><div class="view-host"></div></main>
      <footer class="app-footer">
        <p>ChanceWorks는 교실용 확률 모델입니다. 모든 결과는 시드 기반 모의실험이며 실제 사건을 예측하지 않습니다.</p>
        <p>확률·통계 학습용 · 오프라인 사용 가능 · 개인정보 수집 없음</p>
      </footer>
      <div id="sr-announcer" class="sr-only" aria-live="polite" aria-atomic="true"></div>
    </div>`);

    this.main = qs(shell, '#main');
    this.viewHost = qs(shell, '.view-host');
    this.root.append(shell);
  }

  start(): void {
    const initialHash = location.hash;
    const initialRoute = initialHash ? routeFromHash(initialHash) : this.store.get().route;
    if (!initialHash) {
      history.replaceState(null, '', hashForRoute(initialRoute));
    }
    this.render(initialRoute);
    window.addEventListener('hashchange', () => {
      this.render(routeFromHash(location.hash), true);
    });
  }

  private render(route: Route, focus = false): void {
    const html = document.documentElement;
    const previousBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    html.style.scrollBehavior = previousBehavior;
    this.activeView?.destroy();
    this.activeView = null;
    this.viewHost.innerHTML = '';
    this.store.update((state) => {
      state.route = route;
    });

    const view = this.createView(route);
    this.activeView = view;
    this.viewHost.append(view.element);

    for (const link of qsa<HTMLAnchorElement>(this.root, '[data-nav]')) {
      const active = link.dataset.nav === route;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }

    document.title = `${ROUTE_META[route].title} — ChanceWorks`;
    if (focus) {
      this.main.focus({ preventScroll: true });
    }
  }

  private createView(route: Route): View {
    switch (route) {
      case 'galton':
        return createGaltonLab(this.store);
      case 'dice':
        return createDiceLab(this.store);
      case 'coin':
        return createCoinLab(this.store);
      case 'spinner':
        return createSpinnerLab(this.store);
      case 'expected':
        return createExpectedLab(this.store);
      case 'missions':
        return createMissionsView(this.store);
      case 'teacher':
        return createTeacherView(this.store);
    }
  }
}
