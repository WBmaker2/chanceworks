import * as THREE from 'three';
import { SceneBase, canvasTexture } from './SceneBase';

const FACE_VALUES = [1, 6, 2, 5, 3, 4];
const FACE_NORMALS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];

interface DieAnimation {
  start: number;
  startQuaternion: THREE.Quaternion;
  targetQuaternion: THREE.Quaternion;
  baseY: number;
}

interface Die {
  mesh: THREE.Mesh;
  animation: DieAnimation | null;
  baseY: number;
}

export class DiceScene extends SceneBase {
  private readonly dice: Die[] = [];
  private readonly cameraDirection = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, {
      fov: 40,
      cameraPosition: new THREE.Vector3(0, 1.8, 7.2),
      controls: false,
    });
    this.camera.lookAt(0, 0.15, 0);

    const ambient = new THREE.AmbientLight(0xbfd3ff, 0.9);
    this.scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(4, 8, 8);
    this.scene.add(key);
    const rim = new THREE.PointLight(0x5eead4, 14, 20, 2);
    rim.position.set(-6, 3, 3);
    this.scene.add(rim);
    const warm = new THREE.PointLight(0xffb347, 10, 20, 2);
    warm.position.set(5, 2, -3);
    this.scene.add(warm);

    const table = new THREE.Mesh(
      new THREE.CylinderGeometry(3.25, 3.4, 0.18, 64),
      new THREE.MeshStandardMaterial({
        color: 0x151e33,
        metalness: 0.5,
        roughness: 0.4,
      }),
    );
    table.position.y = -1.12;
    this.scene.add(table);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.015, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0.4 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -1.02;
    this.scene.add(ring);

    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5, 2, 2, 2);
    const materials = FACE_VALUES.map(
      (value) =>
        new THREE.MeshStandardMaterial({
          map: createPipTexture(value),
          roughness: 0.36,
          metalness: 0.04,
        }),
    );

    for (const x of [-1.28, 1.28]) {
      const mesh = new THREE.Mesh(geometry, materials);
      mesh.position.set(x, 0, 0);
      this.scene.add(mesh);
      this.dice.push({ mesh, animation: null, baseY: 0 });
    }

    this.showFaces(1, 1, false);
  }

  showFaces(d1: number, d2: number, animate = true): void {
    this.orientDie(this.dice[0], d1, animate);
    this.orientDie(this.dice[1], d2, animate);
  }

  private orientDie(die: Die, value: number, animate: boolean): void {
    const faceIndex = FACE_VALUES.indexOf(value);
    const normal = FACE_NORMALS[Math.max(0, faceIndex)];
    this.cameraDirection.copy(this.camera.position).sub(die.mesh.position).normalize();
    const target = new THREE.Quaternion().setFromUnitVectors(normal, this.cameraDirection);

    if (!animate || this.reducedMotion) {
      die.mesh.quaternion.copy(target);
      die.mesh.position.y = die.baseY;
      die.animation = null;
      return;
    }

    const start = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        Math.PI * (1.2 + (value % 3) * 0.35),
        Math.PI * (0.8 + ((value + 2) % 4) * 0.4),
        Math.PI * 0.3,
      ),
    );
    die.animation = {
      start: performance.now() / 1000,
      startQuaternion: start,
      targetQuaternion: target,
      baseY: die.baseY,
    };
  }

  protected update(): void {
    const now = performance.now() / 1000;
    for (const die of this.dice) {
      if (!die.animation) continue;
      const elapsed = now - die.animation.start;
      const t = Math.min(1, elapsed / 0.72);
      const eased = 1 - Math.pow(1 - t, 3);
      die.mesh.quaternion.slerpQuaternions(
        die.animation.startQuaternion,
        die.animation.targetQuaternion,
        eased,
      );
      die.mesh.position.y = die.animation.baseY + Math.sin(Math.PI * t) * 0.95;
      if (t >= 1) {
        die.mesh.position.y = die.animation.baseY;
        die.mesh.quaternion.copy(die.animation.targetQuaternion);
        die.animation = null;
      }
    }
  }
}

function createPipTexture(value: number): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 256, 256);
    gradient.addColorStop(0, '#fbf8ee');
    gradient.addColorStop(1, '#e8e1d0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = 'rgba(13, 18, 32, 0.22)';
    ctx.lineWidth = 18;
    ctx.strokeRect(9, 9, 238, 238);

    ctx.fillStyle = value === 1 ? '#c0392b' : '#182033';
    const positions: Record<number, [number, number][]> = {
      1: [[128, 128]],
      2: [
        [78, 78],
        [178, 178],
      ],
      3: [
        [74, 74],
        [128, 128],
        [182, 182],
      ],
      4: [
        [78, 78],
        [178, 78],
        [78, 178],
        [178, 178],
      ],
      5: [
        [74, 74],
        [182, 74],
        [128, 128],
        [74, 182],
        [182, 182],
      ],
      6: [
        [78, 68],
        [178, 68],
        [78, 128],
        [178, 128],
        [78, 188],
        [178, 188],
      ],
    };

    for (const [x, y] of positions[value]) {
      ctx.beginPath();
      ctx.arc(x, y, value === 1 ? 34 : 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(x - 7, y - 7, value === 1 ? 8 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = value === 1 ? '#c0392b' : '#182033';
    }
  });
}
