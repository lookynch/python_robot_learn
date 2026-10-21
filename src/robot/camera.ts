import * as THREE from 'three';
import type { RobotRenderer } from './renderer';
import type { Sim } from './sim';

export type CameraName = 'wrist_cam' | 'front';
export const CAMERA_LABELS: Record<CameraName, string> = {
  wrist_cam: 'Handgelenk',
  front: 'Vorne',
};
/** Alles, was weiter als MAX_DEPTH entfernt ist (oder nichts trifft), gilt als „weit weg“. */
export const MAX_DEPTH = 2;

/** Ein Kamerabild: RGB (je Pixel 3 Bytes, Zeile für Zeile von oben) und Tiefe in Metern entlang der Blickrichtung. */
export interface Frame {
  width: number;
  height: number;
  rgb: Uint8Array;
  depth: Float32Array;
}

// Lineare Tiefe (Abstand entlang der Blickrichtung) auf 24 Bit in RGB verteilt.
const depthMaterial = new THREE.ShaderMaterial({
  uniforms: { maxDepth: { value: MAX_DEPTH } },
  vertexShader: `
    varying float vDepth;
    void main() {
      vec4 view = modelViewMatrix * vec4(position, 1.0);
      vDepth = -view.z;
      gl_Position = projectionMatrix * view;
    }`,
  fragmentShader: `
    uniform float maxDepth;
    varying float vDepth;
    void main() {
      float d = clamp(vDepth / maxDepth, 0.0, 0.999999);
      vec3 enc = fract(d * vec3(1.0, 255.0, 65025.0));
      enc -= enc.yzz * vec3(1.0 / 255.0, 1.0 / 255.0, 0.0);
      gl_FragColor = vec4(enc, 1.0);
    }`,
});

/** Rendert Bilder aus den Kameras des Modells (wie eine echte Kamera am Roboter). */
export class CameraRig {
  private readonly cameras = new Map<CameraName, { id: number; camera: THREE.PerspectiveCamera }>();
  private targets = new Map<
    string,
    { color: THREE.WebGLRenderTarget; depth: THREE.WebGLRenderTarget }
  >();
  private readonly pixels = new Map<number, Uint8Array>();

  constructor(
    private readonly sim: Sim,
    private readonly view: RobotRenderer,
  ) {
    const m = sim.model;
    for (const name of ['wrist_cam', 'front'] as CameraName[]) {
      const id = sim.mujoco.mj_name2id(m, sim.mujoco.mjtObj.mjOBJ_CAMERA.value, name);
      if (id < 0) continue;
      const camera = new THREE.PerspectiveCamera(m.cam_fovy[id] as number, 4 / 3, 0.01, MAX_DEPTH);
      camera.matrixAutoUpdate = false;
      this.cameras.set(name, { id, camera });
    }
  }

  private target(width: number, height: number) {
    const key = `${width}x${height}`;
    let t = this.targets.get(key);
    if (!t) {
      const color = new THREE.WebGLRenderTarget(width, height);
      color.texture.colorSpace = THREE.SRGBColorSpace;
      t = { color, depth: new THREE.WebGLRenderTarget(width, height) };
      this.targets.set(key, t);
    }
    return t;
  }

  private buffer(size: number): Uint8Array {
    let b = this.pixels.get(size);
    if (!b) this.pixels.set(size, (b = new Uint8Array(size)));
    return b;
  }

  /** Bild aus Kamera `name` beim aktuellen Simulationszustand. */
  capture(name: CameraName, width: number, height: number): Frame {
    const entry = this.cameras.get(name);
    if (!entry) throw new Error(`Kamera ${name} gibt es im Modell nicht.`);
    const { id, camera } = entry;
    const pos = this.sim.data.cam_xpos as Float64Array;
    const mat = this.sim.data.cam_xmat as Float64Array;
    const p = id * 3;
    const r = id * 9;
    // MuJoCo-Kameras blicken wie three.js entlang −z, y zeigt nach oben.
    // prettier-ignore
    camera.matrix.set(
      mat[r]!, mat[r + 1]!, mat[r + 2]!, pos[p]!,
      mat[r + 3]!, mat[r + 4]!, mat[r + 5]!, pos[p + 1]!,
      mat[r + 6]!, mat[r + 7]!, mat[r + 8]!, pos[p + 2]!,
      0, 0, 0, 1,
    );
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    const { renderer, scene } = this.view;
    const markerVisible = this.view.target.visible;
    this.view.target.visible = false;
    this.view.sync();
    const t = this.target(width, height);
    const raw = this.buffer(width * height * 4);
    const previous = renderer.getRenderTarget();

    renderer.setRenderTarget(t.color);
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(t.color, 0, 0, width, height, raw);
    const rgb = new Uint8Array(width * height * 3);
    for (let y = 0; y < height; y++) {
      const src = (height - 1 - y) * width * 4;
      for (let x = 0; x < width; x++) {
        const i = src + x * 4;
        const o = (y * width + x) * 3;
        rgb[o] = raw[i]!;
        rgb[o + 1] = raw[i + 1]!;
        rgb[o + 2] = raw[i + 2]!;
      }
    }

    const background = scene.background;
    scene.background = new THREE.Color(1, 1, 1);
    scene.overrideMaterial = depthMaterial;
    renderer.setRenderTarget(t.depth);
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(t.depth, 0, 0, width, height, raw);
    scene.overrideMaterial = null;
    scene.background = background;
    renderer.setRenderTarget(previous);
    this.view.target.visible = markerVisible;

    const depth = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      const src = (height - 1 - y) * width * 4;
      for (let x = 0; x < width; x++) {
        const i = src + x * 4;
        const d = raw[i]! / 255 + raw[i + 1]! / 65025 + raw[i + 2]! / 16581375;
        depth[y * width + x] = d * MAX_DEPTH;
      }
    }
    return { width, height, rgb, depth };
  }

  dispose() {
    for (const t of this.targets.values()) {
      t.color.dispose();
      t.depth.dispose();
    }
  }
}

/** Zeichnet ein Kamerabild (RGB oder Tiefe als Farbskala) in ein Canvas. */
export function drawFrame(canvas: HTMLCanvasElement, frame: Frame, mode: 'rgb' | 'depth') {
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(frame.width, frame.height);
  const n = frame.width * frame.height;
  let near = Infinity;
  let far = 0;
  if (mode === 'depth')
    for (let i = 0; i < n; i++) {
      const d = frame.depth[i]!;
      if (d < MAX_DEPTH * 0.99) {
        near = Math.min(near, d);
        far = Math.max(far, d);
      }
    }
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (mode === 'rgb') {
      image.data[o] = frame.rgb[i * 3]!;
      image.data[o + 1] = frame.rgb[i * 3 + 1]!;
      image.data[o + 2] = frame.rgb[i * 3 + 2]!;
    } else {
      // Nah = hell/gelb, fern = dunkel/blau.
      const t = 1 - Math.min(1, Math.max(0, (frame.depth[i]! - near) / (far - near || 1)));
      image.data[o] = Math.round(255 * Math.min(1, t * 1.6));
      image.data[o + 1] = Math.round(255 * t * t);
      image.data[o + 2] = Math.round(255 * (0.35 + 0.4 * (1 - t)) * (1 - t * 0.6));
    }
    image.data[o + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}
