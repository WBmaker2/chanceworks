export function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function fromHtml<T extends HTMLElement = HTMLElement>(markup: string): T {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  const element = template.content.firstElementChild;
  if (!element) throw new Error('Expected markup to contain a root element');
  return element as T;
}

export function qs<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);
  return element;
}

export function qsa<T extends Element = HTMLElement>(root: ParentNode, selector: string): T[] {
  return [...root.querySelectorAll<T>(selector)];
}

export function formatInt(value: number): string {
  return new Intl.NumberFormat('ko-KR').format(value);
}

export function formatPoints(value: number): string {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(value);
}

export function setText(root: ParentNode, selector: string, value: string): void {
  const element = root.querySelector(selector);
  if (element) element.textContent = value;
}

export function announce(message: string): void {
  const region = document.getElementById('sr-announcer');
  if (!region) return;
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

export function dataTable(
  caption: string,
  headers: readonly string[],
  rows: readonly (readonly (string | number)[])[],
  open = false,
): string {
  const head = headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell, index) =>
            index === 0
              ? `<th scope="row">${escapeHtml(cell)}</th>`
              : `<td>${escapeHtml(cell)}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');
  return `<details class="data-table"${open ? ' open' : ''}>
    <summary>표로 보기</summary>
    <div class="data-table__scroll">
      <table>
        <caption>${escapeHtml(caption)}</caption>
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  </details>`;
}

export function debounce<T extends (...args: never[]) => void>(fn: T, wait = 120): T {
  let timer = 0;
  const wrapped = (...args: Parameters<T>) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
  return wrapped as T;
}
