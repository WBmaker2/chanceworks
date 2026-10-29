import { DEFAULT_SEED } from '../prob/constants';
import type { Route } from './routes';

export interface GaltonState {
  rows: number;
  bias: number;
  ballCount: number;
  speed: number;
  seed: number;
  mode: 'batch' | 'slow';
  running: boolean;
}

export interface DiceState {
  rolls: number;
  seed: number;
  running: boolean;
}

export interface CoinState {
  flips: number;
  seed: number;
  running: boolean;
}

export interface SpinnerState {
  weights: number[];
  spins: number;
  seed: number;
  running: boolean;
}

export interface ExpectedState {
  payoffs: number[];
  probabilities: number[];
  cost: number;
  seed: number;
}

export interface MissionAnswer {
  prediction?: string;
  explanation?: string;
  ran: boolean;
  completed: boolean;
}

export interface MissionState {
  currentId: string | null;
  answers: Record<string, MissionAnswer>;
  completed: string[];
}

export interface Preferences {
  reducedMotion: boolean;
  showTheoretical: boolean;
  showNormalCurve: boolean;
  showAnswers: boolean;
}

export interface AppState {
  route: Route;
  galton: GaltonState;
  dice: DiceState;
  coin: CoinState;
  spinner: SpinnerState;
  expected: ExpectedState;
  mission: MissionState;
  preferences: Preferences;
}

export function createDefaultState(): AppState {
  return {
    route: 'galton',
    galton: {
      rows: 10,
      bias: 0.5,
      ballCount: 100,
      speed: 1,
      seed: DEFAULT_SEED,
      mode: 'batch',
      running: false,
    },
    dice: {
      rolls: 100,
      seed: DEFAULT_SEED,
      running: false,
    },
    coin: {
      flips: 100,
      seed: DEFAULT_SEED,
      running: false,
    },
    spinner: {
      weights: [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6],
      spins: 100,
      seed: DEFAULT_SEED,
      running: false,
    },
    expected: {
      payoffs: [10, 0],
      probabilities: [0.1, 0.9],
      cost: 2,
      seed: DEFAULT_SEED,
    },
    mission: {
      currentId: null,
      answers: {},
      completed: [],
    },
    preferences: {
      reducedMotion: false,
      showTheoretical: true,
      showNormalCurve: true,
      showAnswers: false,
    },
  };
}

type Listener = (state: AppState) => void;

export class Store {
  private state: AppState;
  private listeners = new Set<Listener>();

  constructor(initial: AppState = createDefaultState()) {
    this.state = initial;
  }

  get(): AppState {
    return this.state;
  }

  update(mutator: (state: AppState) => void): void {
    mutator(this.state);
    for (const listener of this.listeners) listener(this.state);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
