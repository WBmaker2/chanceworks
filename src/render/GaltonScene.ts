import * as THREE from 'three';
import { BALL_FALL_SECONDS, MAX_VISIBLE_BALLS } from '../prob/constants';
import { SceneBase, canvasTexture } from './SceneBase';

interface PathPoint {
  x: number;
  y: number;
}

interface ActiveBall {
  path: PathPoint[];
  start: number;
  duration: number;
  color: THREE.Color;
  done: boolean;
  onLand?: () => void;
}

export interface GaltonLaunchOptions {
  animateCount: number;
  speed: number;
  slow?: boolean;
  append?: boolean;
  onLand?: (index: number) => void;
  onComplete?: () => void;
}

const ROW_GAP = 0.62;

export class GaltonScene extends SceneBase {
  private readonly board = new THREE.Group();
  private readonly dummy = new THREE.Object3D();
  private readonly balls: THREE.InstancedMesh;
  private readonly active: ActiveBall[] = [];
  private binSlots: number[] = new Array<number>(11).fill(0);
  private rows = 10;
  private seed = 1;
  private boardWidth = 11;
  private boardHeight = 8;
  private topRow = 2.79;
  private floorY = -3.64;
  private onComplete: (() => void) | undefined = undefined;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, {
      fov: 42,
      cameraPosition: new THREE.Vector3(0, 0.4, 16),
      controls: true,
      minDistance: 5,
      maxDistance: 38,
      maxPolarAngle: Math.PI * 0.62,
    });

    this.scene.add(this.board);

    const ambient = new THREE.AmbientLight(0xbfd3ff, 0.75);
    this.scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(5, 9, 12);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x5eead4, 16, 30, 2);
    rim.position.set(-7, 3, 6);
    this.scene.add(rim);
    const accent = new THREE.PointLight(0xb8f14a, 12, 26, 2);
    accent.position.set(7, -2, 6);
    this.scene.add(accent);

    const ballGeometry = new THREE.SphereGeometry(0.068, 10, 8);
    const ballMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.25,
      roughness: 0.28,
      emissive: 0x122008,
      emissiveIntensity: 0.8,
    });
    this.balls = new THREE.InstancedMesh(ballGeometry, ballMaterial, MAX_VISIBLE_BALLS);
    this.balls.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.balls.frustumCulled = false;
    this.balls.count = 0;
    this.scene.add(this.balls);

    this.rebuild(10, 1);
  }

  setReducedMotion(reduced: boolean): void {
    super.setReducedMotion(reduced);
    if (reduced) this.clearBalls();
  }

  setConfig(rows: number, seed: number): void {
    const changed = rows !== this.rows;
    this.seed = seed;
    if (changed) this.rebuild(rows, seed);
  }

  private rebuild(rows: number, seed: number): void {
    this.rows = rows;
    this.seed = seed;
    this.clearBalls();
    this.clearGroup(this.board);

    const width = rows + 1;
    this.boardWidth = width;
    this.topRow = ((rows - 1) * ROW_GAP) / 2 + 0.7;
    this.floorY = -this.topRow - 0.55;
    this.boardHeight = this.topRow - this.floorY + 2.4;

    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 1.3, this.boardHeight + 0.8),
      new THREE.MeshBasicMaterial({
        color: 0x10182a,
        transparent: true,
        opacity: 0.62,
      }),
    );
    panel.position.set(0, (this.topRow + this.floorY) / 2 + 0.1, -0.85);
    this.board.add(panel);

    const pegCount = (rows * (rows + 1)) / 2;
    const pegGeometry = new THREE.SphereGeometry(0.108, 12, 10);
    const pegMaterial = new THREE.MeshStandardMaterial({
      color: 0x9db2d6,
      metalness: 0.72,
      roughness: 0.24,
      emissive: 0x111b2c,
      emissiveIntensity: 0.8,
    });
    const pegs = new THREE.InstancedMesh(pegGeometry, pegMaterial, pegCount);
    let pegIndex = 0;
    for (let row = 0; row < rows; row += 1) {
      const y = this.rowY(row);
      for (let j = 0; j <= row; j += 1) {
        this.dummy.position.set(j - row / 2, y, 0);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.updateMatrix();
        pegs.setMatrixAt(pegIndex, this.dummy.matrix);
        pegIndex += 1;
      }
    }
    pegs.instanceMatrix.needsUpdate = true;
    this.board.add(pegs);

    const floorGeometry = new THREE.BoxGeometry(1, 0.1, 1.55);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x24304b,
      metalness: 0.3,
      roughness: 0.65,
    });
    const floors = new THREE.InstancedMesh(floorGeometry, floorMaterial, rows + 1);
    for (let k = 0; k <= rows; k += 1) {
      this.dummy.position.set(k - rows / 2, this.floorY, 0);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      floors.setMatrixAt(k, this.dummy.matrix);
    }
    floors.instanceMatrix.needsUpdate = true;
    this.board.add(floors);

    const wallGeometry = new THREE.BoxGeometry(0.035, 0.8, 1.55);
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x3e4e72,
      metalness: 0.2,
      roughness: 0.5,
      transparent: true,
      opacity: 0.9,
    });
    const walls = new THREE.InstancedMesh(wallGeometry, wallMaterial, rows + 2);
    for (let k = 0; k <= rows + 1; k += 1) {
      this.dummy.position.set(k - rows / 2 - 0.5, this.floorY + 0.4, 0);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      walls.setMatrixAt(k, this.dummy.matrix);
    }
    walls.instanceMatrix.needsUpdate = true;
    this.board.add(walls);

    const railGeometry = new THREE.BoxGeometry(width + 0.12, 0.035, 1.58);
    const railMaterial = new THREE.MeshStandardMaterial({
      color: 0x5eead4,
      emissive: 0x1d6b61,
      emissiveIntensity: 0.6,
      metalness: 0.4,
      roughness: 0.35,
    });
    const rail = new THREE.Mesh(railGeometry, railMaterial);
    rail.position.set(0, this.floorY + 0.81, 0);
    this.board.add(rail);

    for (let k = 0; k <= rows; k += 1) {
      const label = this.makeBinLabel(String(k));
      label.position.set(k - rows / 2, this.floorY - 0.8, 0.7);
      label.scale.set(0.48, 0.32, 1);
      this.board.add(label);
    }

    this.fitCamera();
  }

  private makeBinLabel(text: string): THREE.Sprite {
    const texture = canvasTexture(96, 64, (ctx) => {
      ctx.clearRect(0, 0, 96, 64);
      ctx.fillStyle = '#aab6d0';
      ctx.font = '600 34px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 48, 33);
    });
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    return new THREE.Sprite(material);
  }

  private fitCamera(): void {
    const aspect = Math.max(0.45, this.camera.aspect);
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const distanceForHeight = (this.boardHeight * 0.5) / Math.tan(vFov / 2);
    const distanceForWidth = (this.boardWidth * 0.5 + 0.8) / Math.tan(hFov / 2);
    const distance = Math.max(distanceForHeight, distanceForWidth) * 1.14;
    this.camera.position.set(0, 0.35, distance);
    this.camera.lookAt(0, 0, 0);
    if (this.controls) {
      this.controls.target.set(0, 0, 0);
      this.controls.minDistance = Math.max(4, distance * 0.55);
      this.controls.maxDistance = distance * 1.8;
      this.controls.update();
    }
    this.renderOnce();
  }

  protected onResize(): void {
    this.fitCamera();
  }

  private rowY(row: number): number {
    return this.topRow - row * ROW_GAP;
  }

  launch(decisions: boolean[][], outcomes: number[], options: GaltonLaunchOptions): void {
    if (!options.append) {
      this.clearBalls();
      this.binSlots = new Array<number>(this.rows + 1).fill(0);
    }
    this.onComplete = options.onComplete;
    if (options.animateCount <= 0) return;

    const count = Math.min(options.animateCount, outcomes.length, MAX_VISIBLE_BALLS);
    const now = performance.now() / 1000;
    const stagger = options.slow ? 0 : Math.min(0.026, 1.5 / Math.max(1, count));
    const duration = (options.slow ? 2.1 : BALL_FALL_SECONDS) / Math.max(0.5, options.speed);

    while (this.active.length + count > MAX_VISIBLE_BALLS) {
      const firstDone = this.active.findIndex((ball) => ball.done);
      if (firstDone >= 0) this.active.splice(firstDone, 1);
      else break;
    }

    for (let i = 0; i < count; i += 1) {
      const outcome = outcomes[i];
      const path = this.buildPath(decisions[i], outcome, i);
      const slot = this.binSlots[outcome] ?? 0;
      this.binSlots[outcome] = slot + 1;
      const column = slot % 12;
      const layer = Math.floor(slot / 12);
      path[path.length - 1] = {
        x: outcome - this.rows / 2 + (column - 5.5) * 0.074,
        y: this.floorY + 0.1 + layer * 0.115,
      };
      this.active.push({
        path,
        start: now + i * stagger,
        duration,
        color: options.slow
          ? new THREE.Color(0xffb347)
          : new THREE.Color(i % 7 === 0 ? 0x5eead4 : 0xb8f14a),
        done: false,
        onLand: options.slow ? () => options.onLand?.(i) : undefined,
      });
    }
    this.balls.count = 0;
  }

  private buildPath(
    decisions: readonly boolean[],
    outcome: number,
    ballIndex: number,
  ): PathPoint[] {
    const points: PathPoint[] = [];
    const startY = this.topRow + 0.9;
    points.push({ x: this.jitter(ballIndex, -1) * 0.25, y: startY });
    let rights = 0;

    for (let row = 0; row < this.rows; row += 1) {
      const x = rights - row / 2;
      points.push({
        x: x + this.jitter(ballIndex, row),
        y: this.rowY(row),
      });
      if (decisions[row]) rights += 1;
    }

    points.push({
      x: outcome - this.rows / 2 + this.jitter(ballIndex, this.rows) * 0.4,
      y: this.floorY + 0.12,
    });
    return points;
  }

  private jitter(ballIndex: number, row: number): number {
    const raw =
      Math.sin((ballIndex + 1) * 12.9898 + (row + 2) * 78.233 + this.seed * 0.001) * 43758.5453;
    return (raw - Math.floor(raw) - 0.5) * 0.1;
  }

  clear(): void {
    this.clearBalls();
  }

  private clearBalls(): void {
    this.active.length = 0;
    this.binSlots = new Array<number>(this.rows + 1).fill(0);
    this.balls.count = 0;
    this.onComplete = undefined;
  }

  protected update(): void {
    if (this.active.length === 0) {
      if (this.balls.count !== 0) {
        this.balls.count = 0;
        this.renderOnce();
      }
      return;
    }

    const now = performance.now() / 1000;
    let visible = 0;

    for (const ball of this.active) {
      if (ball.done) {
        const last = ball.path[ball.path.length - 1];
        this.drawBall(visible, last.x, last.y, ball.color, 0);
        visible += 1;
        continue;
      }
      const elapsed = now - ball.start;
      if (elapsed < 0) continue;

      const progress = Math.min(1, elapsed / ball.duration);
      const segments = ball.path.length - 1;
      const scaled = progress * segments;
      const segment = Math.min(segments - 1, Math.floor(scaled));
      const local = progress >= 1 ? 1 : scaled - segment;
      const from = ball.path[segment];
      const to = ball.path[segment + 1] ?? ball.path[segment];
      const eased = local * local * (3 - 2 * local);
      const x = from.x + (to.x - from.x) * eased;
      let y = from.y + (to.y - from.y) * eased;
      if (progress < 1) y += Math.sin(Math.PI * local) * 0.035;

      this.drawBall(visible, x, y, ball.color, progress < 1 ? 0.05 : 0);
      visible += 1;

      if (progress >= 1) {
        ball.done = true;
        ball.onLand?.();
      }
    }

    this.balls.count = visible;
    this.balls.instanceMatrix.needsUpdate = true;
    if (this.balls.instanceColor) this.balls.instanceColor.needsUpdate = true;

    if (this.active.length > 0 && this.active.every((ball) => ball.done) && this.onComplete) {
      const completion = this.onComplete;
      this.onComplete = undefined;
      completion();
    }
  }

  private drawBall(index: number, x: number, y: number, color: THREE.Color, zOffset: number): void {
    this.dummy.position.set(x, y, 0.05 + zOffset);
    this.dummy.rotation.set(0, 0, 0);
    this.dummy.scale.setScalar(1);
    this.dummy.updateMatrix();
    this.balls.setMatrixAt(index, this.dummy.matrix);
    this.balls.setColorAt(index, color);
  }
}
