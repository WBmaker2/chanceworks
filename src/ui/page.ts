import type { RouteMeta } from '../app/routes';
import { escapeHtml } from './dom';

export function pageHeader(meta: RouteMeta, badges: readonly string[] = []): string {
  return `<header class="page-head">
    <p class="eyebrow">${escapeHtml(meta.eyebrow)}</p>
    <h1 class="page-title">${escapeHtml(meta.title)}</h1>
    <p class="page-desc">${escapeHtml(meta.description)}</p>
    ${
      badges.length > 0
        ? `<div class="badge-row">${badges
            .map((badge) => `<span class="badge">${escapeHtml(badge)}</span>`)
            .join('')}</div>`
        : ''
    }
  </header>`;
}

export function modelNotice(): string {
  return `<p class="model-notice"><span class="model-notice__dot" aria-hidden="true"></span>
    애니메이션은 결과를 꾸미는 시각 효과입니다. 모든 결과는 시드로 미리 정해진 모의실험이며, 실제 사건을 예측하지 않습니다.
  </p>`;
}
