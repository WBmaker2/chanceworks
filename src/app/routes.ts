export const ROUTES = [
  'galton',
  'dice',
  'coin',
  'spinner',
  'expected',
  'missions',
  'teacher',
] as const;

export type Route = (typeof ROUTES)[number];

export interface RouteMeta {
  id: Route;
  label: string;
  shortLabel: string;
  eyebrow: string;
  title: string;
  description: string;
}

export const ROUTE_META: Record<Route, RouteMeta> = {
  galton: {
    id: 'galton',
    label: '갈튼 보드',
    shortLabel: '갈튼',
    eyebrow: 'LAB 01 · BINOMIAL',
    title: '갈튼 보드',
    description:
      '공을 떨어뜨려 이항분포가 어떻게 만들어지는지 확인합니다. 결과는 시드로 미리 정해지고, 애니메이션은 그 결과를 보여주는 시각 효과입니다.',
  },
  dice: {
    id: 'dice',
    label: '주사위',
    shortLabel: '주사위',
    eyebrow: 'LAB 02 · TWO DICE',
    title: '두 주사위의 합',
    description:
      '두 공정한 주사위를 굴려 합의 분포를 관찰합니다. 이론값은 36개의 순서 있는 결과를 모두 세어 구합니다.',
  },
  coin: {
    id: 'coin',
    label: '동전',
    shortLabel: '동전',
    eyebrow: 'LAB 03 · BERNOULLI',
    title: '동전 던지기',
    description:
      '앞면이 나올 비율이 0.5에 가까워지는 과정을 봅니다. 앞면이 여러 번 나와도 다음 던지기의 확률은 여전히 0.5입니다.',
  },
  spinner: {
    id: 'spinner',
    label: '돌림판',
    shortLabel: '돌림판',
    eyebrow: 'LAB 04 · WEIGHTED',
    title: '가중 돌림판',
    description:
      '칸마다 다른 가중치를 주고 돌립니다. 관찰된 빈도가 가중치에 비례하는지, 표본이 늘수록 가까워지는지 확인합니다.',
  },
  expected: {
    id: 'expected',
    label: '기대값',
    shortLabel: '기대값',
    eyebrow: 'LAB 05 · EXPECTED VALUE',
    title: '기대값 연구소',
    description:
      '상금과 확률, 참가 비용으로 게임의 기대값을 계산합니다. 이것은 수학 연습이며, 어떤 게임도 추천하지 않습니다.',
  },
  missions: {
    id: 'missions',
    label: '미션',
    shortLabel: '미션',
    eyebrow: 'MISSIONS · 6 STEPS',
    title: '확률 미션',
    description:
      '예측하고, 실험하고, 근거를 설명합니다. 정답보다 “왜 그런가”를 확인하는 것이 목표입니다.',
  },
  teacher: {
    id: 'teacher',
    label: '교사 모드',
    shortLabel: '교사',
    eyebrow: 'CLASSROOM · TEACHER',
    title: '교사 모드',
    description: '미션 정답과 해설을 확인하고, 진행 상황을 초기화하고, 빈칸 워크시트를 인쇄합니다.',
  },
};

export function isRoute(value: string): value is Route {
  return (ROUTES as readonly string[]).includes(value);
}

export function routeFromHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '').split('?')[0];
  return isRoute(raw) ? raw : 'galton';
}

export function hashForRoute(route: Route): string {
  return `#/${route}`;
}
