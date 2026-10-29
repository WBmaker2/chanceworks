import * as THREE from 'three';
import { SceneBase, canvasTexture } from './SceneBase';

interface CoinAnimation {
  start: number;
  startAngle: number;
  endAngle: number;
  baseY: number;
}

export class CoinScene extends SceneBase {
  private readonly coin: THREE.Mesh;
  private readonly baseY = 0;
  private animation: CoinAnimation | null = null;
  private resultHeads = true;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, {
      fov: 38,
      cameraPosition: new THREE.Vector3(0, 3.1, 5.6),
      controls: false,
    });
    this.camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xbfd3ff, 0.85);
    this.scene.add(ambient);
    const key = new THREE.DirectionalLight(0xfff4de, 2.6);
    key.position.set(4, 7, 5);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x5eead4, 12, 16, 2);
    rim.position.set(-4, 2, -2);
    this.scene.add(rim);

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(2.25, 2.55, 0.22, 64),
      new THREE.MeshStandardMaterial({
        color: 0x151e33,
        metalness: 0.45,
        roughness: 0.4,
      }),
    );
    pedestal.position.y = -1.05;
    this.scene.add(pedestal);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.95, 0.018, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0xb8f14a, transparent: true, opacity: 0.45 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.92;
    this.scene.add(ring);

    const side = new THREE.MeshStandardMaterial({
      color: 0xd9b45c,
      metalness: 0.85,
      roughness: 0.28,
    });
    const top = new THREE.MeshStandardMaterial({
      map: createCoinFace('앞', 'HEADS', '#b8f14a'),
      metalness: 0.35,
      roughness: 0.32,
    });
    const bottom = new THREE.MeshStandardMaterial({
      map: createCoinFace('뒤', 'TAILS', '#5eead4'),
      metalness: 0.35,
      roughness: 0.32,
    });

    this.coin = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.18, 64), [
      side,
      top,
      bottom,
    ]);
    this.coin.position.y = this.baseY;
    this.scene.add(this.coin);
  }

  flip(heads: boolean, animate = true): void {
    this.resultHeads = heads;
    const target = heads ? 0 : Math.PI;

    if (!animate || this.reducedMotion) {
      this.coin.rotation.x = target;
      this.coin.position.y = this.baseY;
      this.animation = null;
      return;
    }

    const current = this.coin.rotation.x;
    const normalizedTarget = target + Math.round((current - target) / (Math.PI * 2)) * Math.PI * 2;
    this.animation = {
      start: performance.now() / 1000,
      startAngle: current,
      endAngle: normalizedTarget + Math.PI * 2 * 4,
      baseY: this.baseY,
    };
  }

  setResult(heads: boolean): void {
    this.resultHeads = heads;
    this.coin.rotation.x = heads ? 0 : Math.PI;
    this.coin.position.y = this.baseY;
    this.animation = null;
  }

  get currentResult(): boolean {
    return this.resultHeads;
  }

  protected update(): void {
    if (!this.animation) return;
    const now = performance.now() / 1000;
    const t = Math.min(1, (now - this.animation.start) / 0.9);
    const eased = 1 - Math.pow(1 - t, 2.4);
    this.coin.rotation.x =
      this.animation.startAngle + (this.animation.endAngle - this.animation.startAngle) * eased;
    this.coin.position.y = this.animation.baseY + Math.sin(Math.PI * t) * 1.35;
    if (t >= 1) {
      this.coin.position.y = this.animation.baseY;
      this.coin.rotation.x = this.resultHeads ? 0 : Math.PI;
      this.animation = null;
    }
  }
}

function createCoinFace(main: string, sub: string, accent: string): THREE.CanvasTexture {
  return canvasTexture(512, 512, (ctx) => {
    const gradient = ctx.createRadialGradient(190, 170, 30, 256, 256, 250);
    gradient.addColorStop(0, '#fff8dc');
    gradient.addColorStop(0.6, '#f2dfa0');
    gradient.addColorStop(1, '#c6a24d');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(256, 256, 248, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(106, 78, 22, 0.65)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(256, 256, 220, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(256, 256, 190, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#3d2d0b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 148px -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif';
    ctx.fillText(main, 256, 240);
    ctx.font = '600 34px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
    ctx.letterSpacing = '8px';
    ctx.fillText(sub, 256, 350);
    ctx.letterSpacing = '0px';
  });
}
