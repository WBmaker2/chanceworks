# ChanceWorks — Implementation Plan

**Project name:** ChanceWorks
**Folder:** `/Volumes/ External Drive 256G/Dev2/opencode/chanceworks`
**Type:** Static educational SPA/PWA
**Runtime AI:** None. No LLM/API calls after build. All probability runs in the browser.
**Target learners:** Grades 5–11 (Korean 초5~고2)
**Subject:** Mathematics — probability, distributions, expected value, law of large numbers
**MVP duration:** 3–4 weeks

---

## 0. One-page summary

ChanceWorks is a 3D probability laboratory built around a single question: **why does a random experiment become predictable when you repeat it many times?**

Students drop balls through a 3D Galton board and watch the histogram grow into a binomial distribution. They roll dice, flip coins, and spin a wheel, comparing experimental frequencies with theoretical probabilities. A convergence meter shows the gap shrinking as the number of trials grows. A small expected-value lab lets them decide whether a game is fair.

The app is **not** an AI tutor. Every outcome comes from a seeded pseudo-random generator, and every theoretical value comes from exact combinatorics. There are no generated explanations, no network calls, and no claims that the simulation can predict a real random event.

**Why this is a strong build**

- High visual payoff: thousands of instanced balls, a 3D Galton board, tumbling dice, a spinning wheel, and live charts.
- Real, testable mathematics: binomial coefficients, distributions, expected value, and convergence all have exact expected results.
- Clear misconceptions to target: "the most likely outcome is the average", "after five heads, tails is due", "more trials make the pattern less clear", "a fair game means you always break even".
- The hard part is making randomness visible and statistically honest at the same time. That is a good fit for a coding model that can separate simulation, rendering, and tests.

**MVP shape**

- 3D Galton board with 5–12 rows, adjustable bias, and 1–1000 balls.
- Dice, coin, and spinner labs.
- Expected-value mini-lab.
- Live histogram, theoretical bars, normal overlay, and convergence meter.
- Six missions, local progress, teacher mode, PWA.

---

## 1. Product definition

### 1.1 Learning problem

Probability is counterintuitive. Students see a 50/50 coin and expect five flips to produce five heads and five tails, or they believe a tail is "due" after a run of heads. They can calculate a probability from a formula but cannot connect it to long-run frequency. Static textbook examples do not let them run 10, 100, and 1000 trials and watch the distribution change.

### 1.2 Learning goals

By the end of the core missions, a student should be able to:

- Distinguish experimental frequency from theoretical probability.
- Explain the law of large numbers in their own words.
- Predict the shape of a binomial distribution for a fair Galton board.
- Explain how bias changes the distribution.
- Find the most likely sum when rolling two fair dice and justify it by counting outcomes.
- Explain why "tails is due" is a fallacy.
- Compute an expected value and use it to judge whether a game is fair.
- Read a histogram and a convergence meter without confusing them with a guarantee.

### 1.3 Core learning loop

1. **Predict** — the mission asks for the most likely outcome or the shape of the distribution.
2. **Run** — the student drops balls, rolls dice, flips coins, or spins the wheel.
3. **Compare** — the observed histogram and the theoretical distribution are shown together.
4. **Explain** — the student answers a short question using the observed and theoretical evidence.
5. **Connect** — a one-sentence takeaway links the experiment to a real decision.

### 1.4 Success criteria

- A student can explain why the Galton board produces a bell shape.
- A student can compare 10, 100, and 1000 trials and describe the convergence.
- A student can predict the effect of a biased peg.
- A student can find the most likely sum of two dice and verify it experimentally.
- A student can explain the gambler's fallacy after seeing a coin run.
- A student can calculate an expected value and identify an unfair game.
- A teacher can reset progress, reveal answers, and print a worksheet without code changes.

---

## 2. Scope

### MVP (must ship)

- 3D Galton board with 5–12 rows, adjustable left/right bias, and 1–1000 balls.
- Ball animation with a "single ball slow motion" mode.
- Live histogram with observed counts.
- Theoretical binomial bars and a normal approximation overlay.
- Convergence meter (total variation distance).
- Dice lab: two fair six-sided dice, sum distribution, 1–1000 rolls.
- Coin lab: fair coin, 1–1000 flips, running proportion.
- Spinner lab: 4–8 weighted sectors.
- Expected-value lab: a simple prize game with editable payoffs.
- Six missions with prediction gates and explanations.
- Local progress, teacher reset, printable worksheet.
- Responsive layout, keyboard alternative, reduced motion.
- PWA install and offline cache.

### Later (do not build in the first pass)

- Conditional probability and Bayes trees.
- Birthday paradox.
- Buffon's needle.
- Random walks and diffusion.
- Sampling distributions and the central limit theorem.
- Regression and correlation.
- Hypothesis tests and p-values.
- Loaded dice and biased coins as a separate fairness lab.
- Classroom accounts or teacher dashboards.

### Out of scope

- Gambling, betting, or lottery advice.
- Claims that a seeded simulation proves a real-world probability.
- Financial or risk advice.
- Any server, database, login, or analytics.
- Any runtime AI or generated explanations.
- Predictions of real random events.

---

## 3. Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Build | Vite + TypeScript | Static output, fast iteration |
| 3D | Three.js with `InstancedMesh` | Thousands of balls and dice with low draw calls |
| Charts | Canvas 2D | Fast, crisp histograms and line overlays |
| Math | Pure TypeScript modules | Exact combinatorics and seeded RNG |
| Math tests | Vitest | Deterministic counts and distribution tests |
| Browser tests | Playwright | Experiments, missions, accessibility |
| PWA | `vite-plugin-pwa` | Offline classroom use |
| Hosting | GitHub Pages / Cloudflare Pages | No server |

**Constraints**

- Node.js 20+.
- No backend, no API keys, no runtime network calls.
- No external textures or model files. Use procedural materials and system fonts.
- Target 60 fps on a mid-range laptop and ≥ 30 fps on a school tablet.
- Initial gzip bundle under 800 KB.
- All probability and statistics calculations must run without a DOM.

---

## 4. Architecture

### 4.1 Module map

```text
src/
  main.ts
  app/
    App.ts
    state.ts
    routes.ts
  prob/
    rng.ts               seeded PRNG
    combinations.ts      binomial coefficients and factorials
    binomial.ts          PMF, mean, variance, normal approximation
    dice.ts              two-dice sum distribution
    coin.ts              Bernoulli trials and running proportion
    spinner.ts           weighted sectors
    expectedValue.ts     payoff tables and EV
    convergence.ts       total variation distance
    stats.ts             mean, variance, histogram helpers
  render/
    GaltonScene.ts
    PegField.ts
    BallField.ts
    DiceScene.ts
    CoinScene.ts
    SpinnerScene.ts
    CameraRig.ts
  charts/
    Histogram.ts
    RunningProportion.ts
    ConvergenceMeter.ts
  features/
    galton/
    dice/
    coin/
    spinner/
    expectedValue/
    missions/
    teacher/
  data/
    missions.json
    payoffs.json
  ui/
    components/
    styles/
  storage/
    progress.ts
  tests/
    unit/
    e2e/
```

### 4.2 Coordinate frames and units

- The Galton board is a 3D scene: rows are vertical, bins are horizontal, and balls fall along `-Y`.
- One peg spacing is 1 scene unit; the board is centered at the origin.
- Charts are 2D canvas elements with CSS-pixel coordinates and DPR scaling.
- Counts are integers; probabilities are floats in `[0, 1]`.
- Never mix scene coordinates into the probability functions.

### 4.3 State

```ts
interface AppState {
  route: 'galton' | 'dice' | 'coin' | 'spinner' | 'expected' | 'missions' | 'teacher';
  galton: {
    rows: number;            // 5..12
    bias: number;            // P(right), 0.1..0.9
    ballCount: number;       // 1..1000
    speed: number;           // 0.5..4
    seed: number;
    mode: 'batch' | 'slow';
    running: boolean;
  };
  dice: {
    rolls: number;
    seed: number;
    running: boolean;
  };
  coin: {
    flips: number;
    seed: number;
    running: boolean;
  };
  spinner: {
    weights: number[];       // normalized
    spins: number;
    seed: number;
    running: boolean;
  };
  expected: {
    payoffs: number[];
    probabilities: number[];
    cost: number;
  };
  mission: {
    currentId: string | null;
    prediction: string | null;
    completed: string[];
  };
  preferences: {
    reducedMotion: boolean;
    showTheoretical: boolean;
    showNormalCurve: boolean;
  };
}
```

### 4.4 Persistence

- `localStorage` key: `chanceworks.progress.v1`.
- Store completed missions, answers, last lab, and view preferences.
- Do not store individual outcomes; regenerate from the seed when reproducibility is needed.
- Teacher reset clears progress after confirmation.
- No personal data.

---

## 5. Data model

### 5.1 Galton configuration

```ts
interface GaltonConfig {
  rows: number;        // number of peg rows
  bias: number;        // P(right) at each peg
  ballCount: number;
  seed: number;
}

interface GaltonResult {
  counts: number[];          // length rows + 1
  total: number;
  probabilities: number[];   // theoretical binomial PMF
  mean: number;
  variance: number;
  convergence: number;       // total variation distance
}
```

### 5.2 Dice result

```ts
interface DiceResult {
  counts: number[];          // index 2..12
  total: number;
  probabilities: number[];   // 36-outcome distribution
}
```

### 5.3 Coin result

```ts
interface CoinResult {
  heads: number;
  tails: number;
  total: number;
  runningHeads: number[];    // proportion after each flip
}
```

### 5.4 Mission

```ts
interface Mission {
  id: string;
  titleKo: string;
  concept: 'binomial' | 'convergence' | 'bias' | 'dice' | 'fallacy' | 'expected-value';
  promptKo: string;
  setup: {
    lab: 'galton' | 'dice' | 'coin' | 'spinner' | 'expected';
    rows?: number;
    bias?: number;
    ballCount?: number;
    rolls?: number;
    flips?: number;
  };
  options: string[];
  answer: string;
  explanationKo: string;
  takeawayKo: string;
  difficulty: 1 | 2 | 3;
}
```

### 5.5 Constants

```ts
const MIN_ROWS = 5;
const MAX_ROWS = 12;
const MAX_BALLS = 1000;
const MAX_ROLLS = 1000;
const MAX_FLIPS = 1000;
const MAX_VISIBLE_BALLS = 400;
const BALL_FALL_SECONDS = 1.2;
const DICE_SUM_BINS = 11;     // sums 2..12 for two d6
const CONVERGENCE_EPSILON = 1e-9;
const DEFAULT_SEED = 20261028;
```

Keep these in one file with comments. Do not scatter magic numbers.

---

### 5.6 Mission content

The six missions are stored in `missions.json`. Each has a prediction gate and an explanation gate, and each presets a lab configuration.

1. `galton-mode` — **가장 가능성 높은 칸**: set 10 rows and a fair peg. Predict the most likely bin before running; compare with the observed mode.
2. `galton-more` — **표본이 많아지면**: run 10 and 1000 balls. Predict how the histogram changes; use the convergence meter as evidence.
3. `galton-bias` — **치우친 못**: set the peg bias to 0.7. Predict the direction of the skew and the new mode.
4. `dice-sum` — **두 주사위의 합**: predict the most likely sum before rolling; verify with 1000 rolls and the 36-outcome table.
5. `coin-fallacy` — **앞면 5번 후**: after a run of heads, predict the next flip. Explain why the probability is still 0.5.
6. `fair-game` — **공정한 게임**: compute the expected value of a prize game and decide whether it is fair. Change one payoff to make it fair.

---

## 6. Core algorithms

### 6.1 Seeded random number generator

Use a small, well-tested PRNG such as mulberry32:

```ts
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- Every experiment receives its own seeded stream.
- The same seed and configuration must produce the same outcomes on every device.
- The UI shows the seed and a "다시 실행" button.
- A "new seed" button changes the seed and clears the current results.

### 6.2 Binomial distribution

For `n = rows` and `p = bias`:

```text
P(k) = C(n, k) × p^k × (1 - p)^(n - k)
mean = n × p
variance = n × p × (1 - p)
```

Compute the PMF with a stable recurrence:

```text
P(0) = (1 - p)^n
P(k + 1) = P(k) × (n - k) / (k + 1) × p / (1 - p)
```

Clamp `p` away from 0 and 1 to avoid division by zero. For `p = 0.5`, the distribution is symmetric.

The normal approximation overlay uses:

```text
μ = n p
σ = sqrt(n p (1 - p))
f(x) = exp(-(x - μ)² / (2σ²)) / (σ sqrt(2π))
```

Normalize the curve so its area matches the histogram. Label it "정규분포 근사" and note that it is an approximation. Show the overlay only when `rows >= 8`; for smaller boards it is too rough and should be hidden or marked "참고용".

### 6.3 Galton path and outcome

Each ball makes `rows` independent left/right decisions. If `k` is the number of right moves, the ball lands in bin `k`.

For the 3D animation:

1. Precompute the sequence of peg positions for each ball from its outcome path.
2. Add a small horizontal jitter to avoid identical paths; seed the jitter from the ball index.
3. Animate the ball along the path with a smooth vertical fall and a small bounce at each peg.
4. The animation is cosmetic; the outcome is already determined by the RNG.
5. For batch mode, simulate all outcomes immediately, update the histogram in chunks, and animate at most `MAX_VISIBLE_BALLS` balls. Show "표본 수" separately from "애니메이션 표본".

**Important:** the ball path must not use collision physics that could change the outcome. The path is a visualization of a precomputed binomial draw.

### 6.4 Histogram and convergence

- Observed counts: integer counts per bin.
- Observed frequencies: `count / total`.
- Theoretical probabilities: binomial PMF.
- Convergence metric: total variation distance:

```text
TV = 0.5 × Σ |observedFrequency(k) - theoreticalProbability(k)|
```

- Display TV as a percentage with a label "이론과의 차이".
- As `total` grows, TV should trend toward 0, but it is not monotonic. The UI must not claim that every new trial improves the match.

### 6.5 Dice lab

Two fair six-sided dice have 36 equally likely ordered outcomes. The sum distribution:

```text
P(sum = s) = count(s) / 36
count(s) = 6 - |s - 7|
```

for `s = 2..12`. Counts: 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1.

- Outcomes come from two independent RNG draws.
- The 3D dice tumble is cosmetic; after the animation, the dice snap to the drawn faces.
- Show observed bars and theoretical bars side by side.
- A "run 100" and "run 1000" button makes convergence visible.

### 6.6 Coin lab

- Each flip is a Bernoulli draw with `p = 0.5`.
- Track the running proportion of heads.
- Plot the running proportion over the number of flips with a horizontal 0.5 reference line.
- Show the count of heads and tails.
- A "five heads in a row" detector can trigger a mission prompt; it must not imply that tails is due.
- For the gambler's fallacy mission, show the next-flip probability is still 0.5.

### 6.7 Spinner lab

- Sectors have weights that sum to 1.
- Draw `u ∈ [0, 1)`, walk the cumulative weights, and select the sector.
- The 3D wheel rotates to the selected sector with an ease-out animation.
- The animation is cosmetic; the selected sector is determined before the spin.
- Allow 4–8 sectors with editable weights; normalize on edit.

### 6.8 Expected value lab

Define a simple game:

```text
EV = Σ p_i × payoff_i - cost
```

- The student edits payoffs and probabilities (or chooses a preset).
- Show the EV, the house edge (if negative), and a simulated average over 1000 plays.
- A game is fair when `EV = 0`.
- Do not give gambling advice; frame it as a math exercise.

### 6.9 Statistics helpers

- Mean: `Σ x / n`.
- Variance: `Σ (x - mean)² / n` (population) or `n - 1` (sample); label which one is used.
- Histogram binning for the Galton board is exact (integer bins), so no bin-width ambiguity.
- For the running proportion, downsample the line to at most 500 points for rendering.

### 6.10 Determinism and reproducibility

- All randomness uses the seeded PRNG.
- The same seed and configuration produce the same counts, histogram, and screenshots.
- Tests assert exact counts for a fixed seed.
- The UI displays the seed and offers "같은 조건 다시 실행".
- Do not call `Math.random()` anywhere in the experiment logic.

---

## 7. Screens and UX

### 7.1 Galton lab

- **Center:** 3D Galton board with pegs, falling balls, and bins.
- **Right:** histogram with observed bars, theoretical bars, and the normal overlay.
- **Left:** rows, bias, ball count, speed, seed, and run/reset controls.
- **Bottom:** convergence meter and a one-line interpretation.
- **Slow motion:** a single highlighted ball follows its path while the bin counts update.

### 7.2 Dice lab

- **Center:** two 3D dice and a roll button.
- **Right:** sum histogram with observed and theoretical bars.
- **Left:** number of rolls, speed, seed, and run/reset.
- **Bottom:** most likely sum, observed mode, and total rolls.

### 7.3 Coin lab

- **Center:** a 3D coin and a flip button.
- **Right:** running proportion chart with a 0.5 reference line.
- **Left:** number of flips, speed, seed, and run/reset.
- **Bottom:** heads/tails counts and the current proportion.

### 7.4 Spinner lab

- **Center:** a 3D wheel with colored sectors.
- **Right:** sector frequency bars.
- **Left:** sector count, weights, spins, seed, and run/reset.
- **Bottom:** selected sector and cumulative counts.

### 7.5 Expected-value lab

- **Center:** a payoff table and a simple game board.
- **Right:** EV calculation, house edge, and simulated average.
- **Left:** presets (fair game, unfair game, lottery-like) and reset.
- **Bottom:** a "fair or unfair?" verdict after the student commits.

### 7.6 Mission screen

- Prediction card with a question and 3–4 options.
- The lab is set to the mission scenario.
- The student runs the experiment, then answers the explanation question.
- On success: explanation, takeaway, and a "next mission" button.
- On failure: a hint that points to the distribution or the convergence meter, not the answer.

### 7.7 Teacher mode

- Mission list with concepts, answers, and explanations.
- Preset scenarios for bias, sample size, dice sums, and expected value.
- Reset progress.
- Print a worksheet with blank tables and prediction prompts.
- Toggle answer visibility for classroom projection.

### 7.8 Responsive layout

**Desktop (≥ 1024 px)**

- Three columns: controls, 3D viewport, charts.

**Tablet (768–1023 px)**

- Viewport with collapsible drawers; charts below.

**Phone (< 768 px)**

- Viewport at the top; bottom sheet tabs: Run | Chart | Mission.
- Large touch targets for run/reset.
- Pinch to zoom; two-finger orbit.
- Charts switch to a compact mode with fewer labels.

### 7.9 Accessibility

- Keyboard: `Tab` through controls, `Space` run/pause, `R` reset, `S` slow motion, arrow keys adjust the focused slider.
- Every experiment has a text summary: configuration, total trials, most likely outcome, observed mode, convergence.
- Provide a data table alternative for every chart.
- Respect `prefers-reduced-motion`: skip ball/dice/coin animations and update the histogram directly.
- Do not encode outcomes by color alone; label bars and sectors.
- Ensure the convergence meter has a numeric value and a text description.
- Screen reader announcements for run completion and mission feedback.

---

## 8. Implementation milestones

### M0 — Setup (0.5 day)

- Scaffold Vite + TypeScript + Three.js.
- Add Vitest, Playwright, ESLint, Prettier, PWA plugin.
- Create the module map and a blank scene.
- **Verify:** dev server, build, and tests run.

### M1 — Probability core (2–3 days)

- Implement the seeded RNG, binomial PMF, dice distribution, coin model, spinner model, and expected value.
- Write unit tests for exact distributions and determinism.
- **Verify:** all math tests pass without a DOM.

### M2 — Galton board (3–4 days)

- Build the peg field, bin geometry, and instanced ball field.
- Implement path precomputation and animation.
- Add the histogram, theoretical bars, normal overlay, and convergence meter.
- **Verify:** counts match the precomputed outcomes; 1000 balls run smoothly.

### M3 — Dice, coin, and spinner labs (3 days)

- Build the 3D dice, coin, and wheel.
- Add outcome-driven animations and frequency charts.
- **Verify:** dice distribution matches the 36-outcome table; coin proportion converges.

### M4 — Expected-value lab (1–2 days)

- Build the payoff table, EV calculation, and simulation.
- Add fair/unfair presets.
- **Verify:** EV matches hand calculations; fair game has EV 0.

### M5 — Missions and teacher mode (2–3 days)

- Author six missions with prediction and explanation gates.
- Add progress persistence, teacher reset, and the printable worksheet.
- **Verify:** each mission can be completed from a fresh state.

### M6 — Responsive, accessibility, PWA (2 days)

- Implement the layouts.
- Add keyboard controls, data tables, reduced motion.
- Configure offline caching.
- **Verify:** keyboard-only completion; offline reload.

### M7 — QA and pilot (2 days)

- Run all tests and screenshot checks.
- Test on a low-end tablet.
- Ask 3–5 students to try the Galton and dice missions.
- Fix the top usability issues.
- Deploy.
- **Verify:** acceptance criteria below are met.

---

## 9. Testing and verification

### Unit tests (Vitest)

- Binomial PMF sums to 1 for `n = 5..12` and `p = 0.1..0.9`.
- Symmetry of the PMF at `p = 0.5`.
- Mean and variance match `np` and `np(1-p)`.
- Recurrence does not produce negative probabilities.
- Two-dice distribution matches the 36-outcome table.
- Expected value for a known game.
- Spinner selection respects cumulative weights.
- Coin running proportion is bounded and ends at `heads / flips`.
- Seeded RNG produces the same sequence for the same seed.
- Same seed and configuration produce the same Galton counts.
- Histogram counts sum to the number of balls.
- Convergence metric is 0 for identical distributions and 1 for disjoint distributions.
- Normal approximation is normalized to the histogram area.

### Interaction tests (Playwright)

- Run the Galton board with 10 and 1000 balls; confirm the histogram updates.
- Change the bias and confirm the distribution skews.
- Run the dice lab and confirm the sum-7 bar is highest.
- Flip the coin and confirm the running proportion updates.
- Spin the wheel and confirm the selected sector matches the highlighted bar.
- Change the expected-value payoff and confirm the verdict.
- Complete a mission correctly and incorrectly.
- Reset progress in teacher mode.
- Keyboard-only path through the Galton mission.

### Visual tests

- Screenshot the Galton board with 10, 100, and 1000 balls.
- Screenshot the dice, coin, spinner, and expected-value labs.
- Run at 1440×900, 1024×768, and 390×844.
- Check that the "cosmetic animation" and "model" labels are visible.

### Accessibility checks

- `axe-core` scan with no critical issues.
- Keyboard reaches every control.
- Reduced motion skips animations and updates charts directly.
- Every chart has an accessible data table.
- Text summary matches the current experiment.
- Outcomes are not conveyed by color alone.

### Performance budget

- 60 fps on a mid-range laptop; ≥ 30 fps on a school tablet.
- 1000 balls in batch mode update in < 100 ms.
- Cap visible animated balls at 400; use instancing.
- No per-frame object creation.
- Pause rendering when the tab is hidden.
- DPR clamp to 2.
- Initial load < 2.5 s on simulated 4G.

---

## 10. Acceptance criteria / Go-No-Go

- [ ] The Galton board produces the correct binomial distribution.
- [ ] The observed and theoretical histograms are shown together.
- [ ] The convergence meter decreases overall as the sample size grows.
- [ ] Bias changes the distribution in the expected direction.
- [ ] Two dice produce the correct sum distribution with 7 most likely.
- [ ] The coin running proportion converges toward 0.5.
- [ ] The spinner respects its weights.
- [ ] Expected value matches hand calculations and identifies a fair game.
- [ ] Six missions are playable, scored, and saved locally.
- [ ] Teacher reset works.
- [ ] Keyboard-only mission completion works.
- [ ] Reduced motion is respected.
- [ ] The app works offline after the first load.
- [ ] No runtime network calls to an AI service or backend.
- [ ] No gambling or betting advice anywhere in the UI.
- [ ] The "animation is cosmetic; the outcome is a seeded draw" notice is visible.

If the binomial or dice tests fail, stop and fix the math before adding missions.

---

## 11. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Students think a simulation proves a real-world probability | False confidence | Label every experiment as a model; show the seed and assumptions |
| The 3D ball path is mistaken for real physics | Misconception | State that the path visualizes a precomputed draw; no collision physics |
| Convergence is oversold as monotonic | Wrong statistics | Describe it as a trend, not a guarantee; show the TV distance over time |
| The gambler's fallacy is reinforced by a "due" animation | Harmful misconception | Explicit mission; keep the next-flip probability at 0.5 |
| 1000 balls stutter on a tablet | Poor classroom performance | Batch simulation, instancing, cap visible balls at 400 |
| Dice/coin animations imply physical fairness | Misconception | Outcomes come from the RNG; animations are cosmetic and labeled |
| Charts are inaccessible | Some students cannot read results | Data tables, text summaries, and color-blind-safe bars |
| Expected-value lab looks like gambling advice | Ethical concern | Frame as a math exercise; no betting or lottery recommendations |
| A seeded RNG is mistaken for true randomness | Conceptual confusion | Explain that the seed makes the experiment reproducible, not predictable in reality |

---

## 12. AI build guide

Use the AI coding agent for scaffolding, the probability core, instanced rendering, charts, tests, and screenshot-driven fixes. Randomness and statistics are easy to make plausible but wrong, so tests and teacher review are mandatory.

### Recommended build order

1. Scaffold Vite + TypeScript + Three.js with tests.
2. Implement the seeded RNG and exact distributions; write unit tests.
3. Build the 3D Galton board and batch simulation.
4. Add the histogram, theoretical bars, normal overlay, and convergence meter.
5. Add the dice, coin, and spinner labs.
6. Add the expected-value lab.
7. Add missions and teacher mode.
8. Do responsive/accessibility passes.
9. Use screenshots at three viewports and fix visual regressions.

### Prompt rules

- State the constraint: “No backend, no runtime AI, no network calls.”
- Require a test for every distribution and expected value.
- Ask the agent to explain the seeded RNG and the batch/animation split before coding.
- Use exact expected counts in tests.
- Never let the app claim to predict real random events or give gambling advice.
- Provide screenshots when fixing charts or 3D layout.

### What not to delegate

- The decision that the probability model is pedagogically acceptable.
- The final review of the convergence and gambler's-fallacy explanations.
- Accessibility judgment.
- Classroom pilot feedback.

### Definition of done

- All probability and interaction tests pass.
- The acceptance checklist is complete.
- A teacher can run the six missions without developer help.
- The model's simplifications are visible in the UI.

---

## 13. Future extensions

- Conditional probability and Bayes trees.
- Birthday paradox.
- Buffon's needle.
- Random walks and diffusion.
- Sampling distributions and the central limit theorem.
- Regression and correlation.
- Hypothesis tests and p-values.
- Loaded dice and fairness testing.
- Classroom worksheet generator.
- Localization.

---

## 14. References

- Khan Academy — Probability and statistics: https://www.khanacademy.org/math/statistics-probability
- OpenStax Introductory Statistics: https://openstax.org/details/books/introductory-statistics
- NIST/SEMATECH e-Handbook of Statistical Methods: https://www.itl.nist.gov/div898/handbook/
- Three.js documentation: https://threejs.org/docs/
- MDN Web APIs: https://developer.mozilla.org/en-US/docs/Web/API
- WCAG 2.2 quick reference: https://www.w3.org/WAI/WCAG22/quickref/

---

**Plan version:** 1.0
**Created:** 2026-10-28
**Next step:** scaffold the project, then implement M1 (seeded RNG + distributions + tests) before building the 3D Galton board.
