import * as THREE from 'three';
import { SceneBase, canvasTexture } from './SceneBase';

export const SECTOR_COLORS = [
  '#b8f14a',
  '#5eead4',
  '#7c8cff',
  '#ffb347',
  '#ff7a9c',
  '#a78bfa',
  '#f6e05e',
  '#63b3ed',
];

interface SpinAnimation {
  start: number;
  from: number;
  to: number;
  onComplete?: () => void;
}

export class SpinnerScene extends SceneBase {
  private readonly wheel = new THREE.Group();
  private weights: number[] = [];
  private animation: SpinAnimation | null = null;
  private sectorCenters: number[] = [];

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, {
      fov: 38,
      cameraPosition: new THREE.Vector3(0, 4.9, 6.1),
      controls: false,
    });
    this.camera.lookAt(0, 0, 0);
    this.scene.add(this.wheel);

    const ambient = new THREE.AmbientLight(0xbfd3ff, 0.95);
    this.scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(4, 8, 6);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x5eead4, 13, 18, 2);
    rim.position.set(-5, 3, -3);
    this.scene.add(rim);
    const warm = new THREE.PointLight(0xffb347, 9, 18, 2);
    warm.position.set(5, 2, 4);
    this.scene.add(warm);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.8, 0.16, 64),
      new THREE.MeshStandardMaterial({ color: 0x151e33, metalness: 0.5, roughness: 0.4 }),
    );
    base.position.y = -0.18;
    this.scene.add(base);

    this.buildWheel([1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6]);

    const pointer = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.62, 4),
      new THREE.MeshStandardMaterial({
        color: 0xffb347,
        emissive: 0x8a4c0a,
        emissiveIntensity: 0.55,
        metalness: 0.35,
        roughness: 0.3,
      }),
    );
    pointer.rotation.x = Math.PI / 2 - 0.32;
    pointer.position.set(0, 0.43, -2.42);
    this.scene.add(pointer);
  }

  setWeights(weights: readonly number[]): void {
    const same =
      weights.length === this.weights.length &&
      weights.every((weight, index) => Math.abs(weight - this.weights[index]) < 1e-9);
    if (same) return;
    this.buildWheel([...weights]);
    this.wheel.rotation.y = 0;
    this.animation = null;
  }

  private buildWheel(weights: number[]): void {
    this.clearGroup(this.wheel);
    this.weights = weights;
    this.sectorCenters = [];
    const total = weights.reduce((acc, weight) => acc + weight, 0) || 1;
    let start = Math.PI / 2;

    for (let i = 0; i < weights.length; i += 1) {
      const length = (Math.PI * 2 * weights[i]) / total;
      const color = new THREE.Color(SECTOR_COLORS[i % SECTOR_COLORS.length]);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.46, 2.08, 64, 1, start, length),
        new THREE.MeshStandardMaterial({
          color,
          side: THREE.DoubleSide,
          metalness: 0.15,
          roughness: 0.48,
          emissive: color.clone().multiplyScalar(0.09),
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;
      this.wheel.add(ring);

      const center = start + length / 2;
      this.sectorCenters.push(center);

      const label = this.createSectorLabel(i + 1, color);
      label.position.set(Math.cos(center) * 1.42, 0.17, -Math.sin(center) * 1.42);
      label.scale.set(0.42, 0.42, 1);
      this.wheel.add(label);

      const divider = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.06, 1.62),
        new THREE.MeshBasicMaterial({ color: 0x0d1220, transparent: true, opacity: 0.5 }),
      );
      divider.position.set(Math.cos(start) * 1.27, 0.1, -Math.sin(start) * 1.27);
      divider.rotation.y = start + Math.PI / 2;
      this.wheel.add(divider);

      start += length;
    }

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.46, 0.22, 40),
      new THREE.MeshStandardMaterial({
        color: 0x0d1220,
        metalness: 0.65,
        roughness: 0.3,
        emissive: 0x11203a,
      }),
    );
    hub.position.y = 0.16;
    this.wheel.add(hub);

    const hubRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.44, 0.025, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0xb8f14a }),
    );
    hubRing.rotation.x = Math.PI / 2;
    hubRing.position.y = 0.28;
    this.wheel.add(hubRing);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(2.1, 0.035, 8, 96),
      new THREE.MeshStandardMaterial({
        color: 0x8ea3c9,
        metalness: 0.7,
        roughness: 0.3,
      }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.09;
    this.wheel.add(rim);
    this.renderOnce();
  }

  private createSectorLabel(index: number, color: THREE.Color): THREE.Sprite {
    const text = String(index);
    const texture = canvasTexture(128, 128, (ctx) => {
      ctx.beginPath();
      ctx.arc(64, 64, 46, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(13, 18, 32, 0.72)';
      ctx.fill();
      ctx.strokeStyle = `#${color.getHexString()}`;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 58px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 68);
    });
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    return new THREE.Sprite(material);
  }

  spinTo(index: number, onComplete?: () => void): void {
    const center = this.sectorCenters[index];
    if (center === undefined) return;

    if (this.reducedMotion) {
      this.wheel.rotation.y = Math.PI / 2 - center;
      this.animation = null;
      onComplete?.();
      this.renderOnce();
      return;
    }

    const from = this.wheel.rotation.y;
    const desired = Math.PI / 2 - center;
    const turns = Math.PI * 2 * 4;
    this.animation = {
      start: performance.now() / 1000,
      from,
      to: from + turns + ((((desired - from) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)),
      onComplete,
    };
  }

  setResult(index: number): void {
    const center = this.sectorCenters[index];
    if (center === undefined) return;
    this.wheel.rotation.y = Math.PI / 2 - center;
    this.animation = null;
    this.renderOnce();
  }

  protected update(): void {
    if (!this.animation) return;
    const now = performance.now() / 1000;
    const t = Math.min(1, (now - this.animation.start) / 1.75);
    const eased = 1 - Math.pow(1 - t, 3.2);
    this.wheel.rotation.y = this.animation.from + (this.animation.to - this.animation.from) * eased;
    if (t >= 1) {
      const completion = this.animation.onComplete;
      this.wheel.rotation.y %= Math.PI * 2;
      this.animation = null;
      completion?.();
    }
  }
}
