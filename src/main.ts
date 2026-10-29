import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { createDefaultState, Store } from './app/state';
import { isRoute } from './app/routes';
import { loadProgress, saveProgress } from './storage/progress';

const persisted = loadProgress();
const state = createDefaultState();

if (persisted) {
  state.mission.completed = persisted.completed ?? [];
  state.mission.answers = persisted.answers ?? {};
  state.mission.currentId = persisted.currentMissionId ?? null;
  state.route = persisted.lastLab && isRoute(persisted.lastLab) ? persisted.lastLab : 'galton';
  if (persisted.preferences) {
    state.preferences = { ...state.preferences, ...persisted.preferences };
  }
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
state.preferences.reducedMotion = state.preferences.reducedMotion || prefersReducedMotion;

const store = new Store(state);
store.subscribe((next) => saveProgress(next));
saveProgress(state);

history.scrollRestoration = 'manual';

const root = document.getElementById('app');
if (!root) throw new Error('App root element is missing');

new App(store, root).start();

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}
