import type { AppState, MissionAnswer, Preferences } from '../app/state';
import { isRoute, type Route } from '../app/routes';

export const PROGRESS_KEY = 'chanceworks.progress.v1';

export interface PersistedProgress {
  completed: string[];
  answers: Record<string, MissionAnswer>;
  lastLab: Route;
  currentMissionId: string | null;
  preferences: Preferences;
}

export function loadProgress(): Partial<PersistedProgress> | null {
  try {
    const raw = globalThis.localStorage?.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const data = parsed as Record<string, unknown>;

    const completed = Array.isArray(data.completed)
      ? data.completed.filter((id): id is string => typeof id === 'string')
      : [];
    const answers =
      typeof data.answers === 'object' && data.answers !== null
        ? (data.answers as Record<string, MissionAnswer>)
        : {};
    const lastLab =
      typeof data.lastLab === 'string' && isRoute(data.lastLab) ? data.lastLab : 'galton';
    const currentMissionId =
      typeof data.currentMissionId === 'string' ? data.currentMissionId : null;
    const preferences =
      typeof data.preferences === 'object' && data.preferences !== null
        ? (data.preferences as Partial<Preferences>)
        : {};

    return {
      completed,
      answers,
      lastLab,
      currentMissionId,
      preferences: {
        reducedMotion: Boolean(preferences.reducedMotion),
        showTheoretical: preferences.showTheoretical !== false,
        showNormalCurve: preferences.showNormalCurve !== false,
        showAnswers: Boolean(preferences.showAnswers),
      },
    };
  } catch {
    return null;
  }
}

export function saveProgress(state: AppState): void {
  try {
    const payload: PersistedProgress = {
      completed: [...state.mission.completed],
      answers: state.mission.answers,
      lastLab: state.route,
      currentMissionId: state.mission.currentId,
      preferences: { ...state.preferences },
    };
    globalThis.localStorage?.setItem(PROGRESS_KEY, JSON.stringify(payload));
  } catch {}
}

export function clearProgress(): void {
  try {
    globalThis.localStorage?.removeItem(PROGRESS_KEY);
  } catch {}
}
