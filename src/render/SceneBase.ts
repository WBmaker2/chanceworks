import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface SceneBaseOptions {
  fov?: number;
  cameraPosition?: THREE.Vector3;
  controls?: boolean;
  minDistance?: number;
  maxDistance?: number;
  maxPolarAngle?: number;
}

export abstract class SceneBase {
  readonly canvas: HTMLCanvasElement;
  protected readonly renderer: THREE.WebGLRenderer;
  protected readonly scene: THREE.Scene;
  protected readonly camera: THREE.PerspectiveCamera;
  protected readonly controls: OrbitControls | null = null;
  protected reducedMotion = false;

  private readonly resizeObserver: ResizeObserver;
  private raf = 0;
  private disposed = false;
  private lastTime = 0;

  constructor(canvas: HTMLCanvasElement, options: SceneBaseOptions = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0d1220, 0.025);

    this.camera = new THREE.PerspectiveCamera(options.fov ?? 42, 1, 0.1, 200);
    this.camera.position.copy(options.cameraPosition ?? new THREE.Vector3(0, 1.2, 12));

    if (options.controls) {
      this.controls = new OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.enablePan = false;
      this.controls.minDistance = options.minDistance ?? 5;
      this.controls.maxDistance = options.maxDistance ?? 30;
      this.controls.maxPolarAngle = options.maxPolarAngle ?? Math.PI * 0.66;
    }

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.start();
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  protected resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.onResize(width, height);
    this.renderOnce();
  }

  protected onResize(_width: number, _height: number): void {}

  protected update(_delta: number): void {}

  protected onDispose(): void {}

  renderOnce(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private start(): void {
    this.lastTime = performance.now();
    const frame = (now: number) => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(frame);
      if (document.hidden) {
        this.lastTime = now;
        return;
      }
      const delta = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;
      this.update(delta);
      this.controls?.update();
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(frame);
  }

  protected clearGroup(group: THREE.Group): void {
    for (const child of [...group.children]) {
      group.remove(child);
      child.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((item) => disposeMaterial(item));
        else if (material) disposeMaterial(material);
      });
    }
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.controls?.dispose();
    this.onDispose();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((item) => disposeMaterial(item));
      else if (material) disposeMaterial(material);
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

function disposeMaterial(material: THREE.Material): void {
  const maybeTextured = material as THREE.Material & {
    map?: THREE.Texture | null;
    alphaMap?: THREE.Texture | null;
  };
  maybeTextured.map?.dispose();
  maybeTextured.alphaMap?.dispose();
  material.dispose();
}

export function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable');
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
