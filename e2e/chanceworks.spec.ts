import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PROGRESS_KEY = 'chanceworks.progress.v1';

async function readTableCounts(
  page: Page,
  hostSelector = '[data-role="table"]',
): Promise<number[]> {
  const cells = await page.locator(`${hostSelector} tbody tr td:nth-child(2)`).allTextContents();
  return cells.map((value) => Number(value.replaceAll(',', '').trim()));
}

async function rangeValue(page: Page, selector: string, value: string): Promise<void> {
  await page.locator(selector).evaluate((element, nextValue) => {
    const input = element as HTMLInputElement;
    input.value = nextValue;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test.describe('Galton board', () => {
  test('runs 100 balls and updates the histogram, summary, and convergence meter', async ({
    page,
  }) => {
    await page.goto('/#/galton');
    await page.locator('button[data-count="100"]').click();
    await page.locator('[data-role="run"]').click();

    await expect(page.locator('[data-role="total"]')).toHaveText('100');
    await expect(page.locator('[data-role="animated"]')).toHaveText('100개');
    await expect(page.locator('[data-role="readout"]')).toContainText('100개 중');
    await expect(page.locator('[data-role="convergence"] [data-role="value"]')).not.toHaveText('—');

    const counts = await readTableCounts(page);
    expect(counts).toHaveLength(11);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(100);
    await expect(page.locator('[data-role="histogram"]')).toHaveAttribute(
      'aria-label',
      /관찰 막대그래프/,
    );
  });

  test('reduced motion skips the ball animation and completes immediately', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#/galton');
    await page.locator('[data-role="run"]').click();
    await expect(page.locator('[data-role="total"]')).toHaveText('100');
    await expect(page.locator('[data-role="run"]')).toBeEnabled();
    await expect(page.locator('.model-notice')).toContainText(
      '애니메이션은 결과를 꾸미는 시각 효과',
    );
  });

  test('a 0.7 bias shifts the observed distribution to the right', async ({ page }) => {
    await page.goto('/#/galton');
    await rangeValue(page, '[data-role="bias"]', '0.7');
    await page.locator('button[data-count="1000"]').click();
    await page.locator('[data-role="run"]').click();

    await expect(page.locator('[data-role="bias-out"]')).toHaveText('70%');
    await expect(page.locator('[data-role="theory-mode"]')).toHaveText('7번 칸');
    await expect(page.locator('[data-role="formula-mean"]')).toHaveText('7.0');

    const counts = await readTableCounts(page);
    const left = counts.slice(0, 5).reduce((sum, count) => sum + count, 0);
    const right = counts.slice(6).reduce((sum, count) => sum + count, 0);
    expect(right).toBeGreaterThan(left);
  });

  test('normal overlay is hidden for small boards and available at 8+ rows', async ({ page }) => {
    await page.goto('/#/galton');
    await rangeValue(page, '[data-role="rows"]', '6');
    await expect(page.locator('[data-role="normal-note"]')).toBeVisible();
    await rangeValue(page, '[data-role="rows"]', '8');
    await expect(page.locator('[data-role="normal-note"]')).toBeHidden();
  });
});

test.describe('Dice, coin, spinner, and expected value labs', () => {
  test('dice rolls 1000 times and sum 7 is the most frequent', async ({ page }) => {
    await page.goto('/#/dice');
    await page.locator('button[data-run-rolls="1000"]').click();

    await expect(page.locator('[data-role="total"]')).toHaveText('1,000');
    await expect(page.locator('[data-role="observed-mode"]')).toContainText('7');
    await expect(page.locator('[data-role="readout"]')).toContainText('합 7');

    const counts = await readTableCounts(page);
    expect(counts).toHaveLength(11);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(1000);
    const maxIndex = counts.indexOf(Math.max(...counts));
    expect(maxIndex + 2).toBe(7);
  });

  test('coin flips 1000 times and the running proportion stays bounded', async ({ page }) => {
    await page.goto('/#/coin');
    await page.locator('button[data-flips="1000"]').click();
    await page.locator('[data-role="run"]').click();

    await expect(page.locator('[data-role="total"]')).toHaveText('1,000');
    const heads = Number(
      (await page.locator('[data-role="heads"]').textContent())?.replaceAll(',', ''),
    );
    const tails = Number(
      (await page.locator('[data-role="tails"]').textContent())?.replaceAll(',', ''),
    );
    expect(heads + tails).toBe(1000);
    const proportion = await page.locator('[data-role="proportion"]').textContent();
    expect(proportion).toMatch(/%$/);
    await expect(page.locator('[data-role="chart"]')).toHaveAttribute(
      'aria-label',
      /동전 앞면 비율 그래프/,
    );
  });

  test('spinner highlights the sector that the seeded draw selected', async ({ page }) => {
    await page.goto('/#/spinner');
    await page.locator('[data-role="run"]').click();

    await expect(page.locator('[data-role="total"]')).toHaveText('100');
    const last = await page.locator('[data-role="last"]').textContent();
    const index = Number(last?.replace('번', '')) - 1;
    expect(index).toBeGreaterThanOrEqual(0);
    await expect(page.locator(`.frequency-row[data-sector="${index}"]`)).toHaveClass(/is-selected/);
    await expect(page.locator('.frequency-row')).toHaveCount(6);
  });

  test('expected value identifies a fair and an unfair game', async ({ page }) => {
    await page.goto('/#/expected');
    await page.locator('[data-role="payoff"]').fill('20');
    await expect(page.locator('[data-role="ev"]')).toContainText('+0.0');
    await expect(page.locator('[data-role="verdict-large"]')).toHaveText('공정');

    await page.locator('[data-role="payoff"]').fill('10');
    await expect(page.locator('[data-role="ev"]')).toContainText('−1.0');
    await expect(page.locator('[data-role="verdict-large"]')).toHaveText('불공정');

    await page.locator('[data-role="simulate"]').click();
    await expect(page.locator('[data-role="simulation-result"]')).toBeVisible();
    await expect(page.locator('[data-role="simulated-wins"]')).not.toHaveText('—');
  });
});

test.describe('Missions and teacher mode', () => {
  test('a mission supports an incorrect attempt, then completes and persists', async ({ page }) => {
    await page.goto('/#/missions');
    await page.locator('label.option', { hasText: '가운데 칸' }).click();
    await page.locator('[data-action="submit-prediction"]').click();
    await page.locator('[data-action="run-experiment"]').click();
    await expect(page.locator('canvas[data-mission-chart="galton"]')).toBeVisible();

    await page.locator('label.option', { hasText: '모든 칸의 확률이 정확히 같기 때문' }).click();
    await page.locator('[data-action="submit-explanation"]').click();
    await expect(page.locator('.feedback--hint')).toContainText('아직 정답이 아닙니다');

    await page.locator('label.option', { hasText: '오른쪽으로 가는 횟수가 0~10까지' }).click();
    await page.locator('[data-action="submit-explanation"]').click();
    await expect(page.locator('.mission-success')).toBeVisible();
    await expect(page.locator('.mission-success')).toContainText('가장 가능성 높은 칸 완료');

    const saved = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? '{}'),
      PROGRESS_KEY,
    );
    expect(saved.completed).toContain('galton-mode');

    await page.locator('[data-action="next-mission"]').click();
    await expect(page.locator('.mission-detail__header h2')).toHaveText('표본이 많아지면');
  });

  test('teacher reset clears saved mission progress after confirmation', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          completed: ['galton-mode'],
          answers: {
            'galton-mode': { prediction: '가운데 칸', ran: true, completed: true },
          },
          lastLab: 'teacher',
          currentMissionId: null,
          preferences: {
            reducedMotion: false,
            showTheoretical: true,
            showNormalCurve: true,
            showAnswers: false,
          },
        }),
      );
    }, PROGRESS_KEY);
    await page.goto('/#/teacher');
    await expect(page.locator('[data-role="completed"]')).toHaveText('1 / 6');

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('[data-role="reset-progress"]').click();
    await expect(page.locator('[data-role="completed"]')).toHaveText('0 / 6');

    const saved = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? '{}'),
      PROGRESS_KEY,
    );
    expect(saved.completed).toEqual([]);
  });

  test('a mission can be completed with keyboard activation', async ({ page }) => {
    await page.goto('/#/missions');
    await page.getByRole('radio', { name: '가운데 칸' }).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    await page.locator('[data-action="run-experiment"]').focus();
    await page.keyboard.press('Enter');

    await page
      .getByRole('radio', {
        name: '오른쪽으로 가는 횟수가 0~10까지 다양하지만, 5번 정도가 가장 흔하기 때문',
      })
      .focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');

    await expect(page.locator('.mission-success')).toBeVisible();
  });
});

test.describe('Quality checks', () => {
  test('has no serious axe accessibility violations across the labs', async ({ page }) => {
    for (const route of ['galton', 'dice', 'coin', 'spinner', 'expected', 'missions', 'teacher']) {
      await page.goto(`/#/${route}`);
      const results = await new AxeBuilder({ page }).analyze();
      const severe = results.violations.filter(
        (violation) => violation.impact === 'critical' || violation.impact === 'serious',
      );
      expect(severe, `${route}: ${JSON.stringify(severe, null, 2)}`).toEqual([]);
    }
  });

  test('does not overflow horizontally at tablet and phone widths', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    for (const route of ['missions', 'expected', 'teacher']) {
      await page.goto(`/#/${route}`);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, route).toBeLessThanOrEqual(1);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ['galton', 'dice', 'coin', 'spinner', 'expected', 'missions', 'teacher']) {
      await page.goto(`/#/${route}`);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, route).toBeLessThanOrEqual(1);
    }
  });

  test('works offline after the first production load', async ({ page }) => {
    await page.goto('/#/galton');
    await expect(page.getByRole('heading', { name: '갈튼 보드', level: 1 })).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await page.context().setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: '갈튼 보드', level: 1 })).toBeVisible();
    await page.context().setOffline(false);
  });
});
