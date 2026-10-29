export type MissionLab = 'galton' | 'dice' | 'coin' | 'expected';
export type MissionConcept =
  'binomial' | 'convergence' | 'bias' | 'dice' | 'fallacy' | 'expected-value';

export interface MissionSetup {
  lab: MissionLab;
  rows?: number;
  bias?: number;
  ballCount?: number;
  compareBallCounts?: [number, number];
  rolls?: number;
  flips?: number;
  runLength?: number;
  seed?: number;
  payoffs?: number[];
  probabilities?: number[];
  cost?: number;
}

export interface Mission {
  id: string;
  number: number;
  titleKo: string;
  concept: MissionConcept;
  conceptLabel: string;
  difficulty: 1 | 2 | 3;
  setup: MissionSetup;
  promptKo: string;
  predictionOptions: string[];
  predictionAnswer: string;
  explanationPromptKo: string;
  explanationOptions: string[];
  explanationAnswer: string;
  explanationKo: string;
  takeawayKo: string;
  runLabel: string;
  hintKo: string;
}
