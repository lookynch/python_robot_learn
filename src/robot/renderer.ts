import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Sim } from './sim';

const GEOM = { plane: 0, sphere: 2, capsule: 3, ellipsoid: 4, cylinder: 5, box: 6, mesh: 7 };
// Gruppen 0–2 sind sichtbar, 3–4 sind Kollisionskörper.
const VISIBLE_GROUPS = new Set([0, 1, 2]);
const LOOK_AT = new THREE.Vector3(0.15, 0, 0.1);

function geometryFor(sim: Sim, geom: number): THREE.BufferGeometry | null {
  const m = sim.model;
  const type = m.geom_type[geom] as number;
  const size = (m.geom_size as Float64Array).slice(geom * 3, geom * 3 + 3);
  switch (type) {
    case GEOM.box:
      return new THREE.BoxGeometry(size[0]! * 2, size[1]! * 2, size[2]! * 2);
    case GEOM.sphere:
      return new THREE.SphereGeometry(size[0]!, 20, 14);
    case GEOM.ellipsoid:
      return new THREE.SphereGeometry(1, 20, 14).scale(size[0]!, size[1]!, size[2]!);
    case GEOM.cylinder:
      return new THREE.CylinderGeometry(size[0]!, size[0]!, size[1]! * 2, 24).rotateX(Math.PI / 2);
    case GEOM.capsule:
      return new THREE.CapsuleGeometry(size[0]!, size[1]! * 2, 6, 16).rotateX(Math.PI / 2);
    case GEOM.mesh: {
      const mesh = m.geom_dataid[geom] as number;
      const vertAdr = m.mesh_vertadr[mesh] as number;
      const vertNum = m.mesh_vertnum[mesh] as number;
      const faceAdr = m.mesh_faceadr[mesh] as number;
      const faceNum = m.mesh_facenum[mesh] as number;
      const positions = (m.mesh_vert as Float32Array).slice(vertAdr * 3, (vertAdr + vertNum) * 3);
      const faces = (m.mesh_face as Int32Array).slice(faceAdr * 3, (faceAdr + faceNum) * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(faces), 1));
      geometry.computeVertexNormals();
      return geometry;
    }
    default:
      return null;
  }
}

function colorFor(sim: Sim, geom: number): THREE.Color {
  const m = sim.model;
  const mat = m.geom_matid[geom] as number;
  const rgba =
    mat >= 0
      ? (m.mat_rgba as Float32Array).slice(mat * 4, mat * 4 + 3)
      : (m.geom_rgba as Float32Array).slice(geom * 4, geom * 4 + 3);
  return new THREE.Color().setRGB(rgba[0]!, rgba[1]!, rgba[2]!, THREE.SRGBColorSpace);
}

export interface ViewTheme {
  background: string;
  floor: string;
  grid: string;
  target: string;
}

/** three.js-Ansicht einer Sim: Körper aus den MuJoCo-Modelldaten, Posen jeden Frame aus data.geom_x*. */
export class RobotRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.01, 20);
  readonly controls: OrbitControls;
  private bodies: { geom: number; mesh: THREE.Mesh }[] = [];
  private floor: THREE.Group | null = null;
  readonly target: THREE.Mesh;

  constructor(
    canvas: HTMLCanvasElement,
    private sim: Sim,
    theme: ViewTheme,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Schatten nur für das Hauptbild neu berechnen; Kamerabilder nutzen sie mit.
    this.renderer.shadowMap.autoUpdate = false;

    this.camera.up.set(0, 0, 1);
    this.camera.position.set(0.5, -0.42, 0.34);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(LOOK_AT);
    this.controls.enableDamping = true;
    this.controls.minDistance = 0.15;
    this.controls.maxDistance = 2.5;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.update();

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(0.4, -0.6, 1.2);
    sun.target.position.copy(LOOK_AT);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -0.6,
      right: 0.6,
      top: 0.6,
      bottom: -0.6,
      near: 0.1,
      far: 3,
    });
    this.scene.add(sun, sun.target);

    this.target = new THREE.Mesh(
      new THREE.SphereGeometry(0.009, 20, 14),
      new THREE.MeshStandardMaterial({
        color: theme.target,
        emissive: theme.target,
        emissiveIntensity: 0.4,
      }),
    );
    this.target.visible = false;
    this.scene.add(this.target);

    this.setTheme(theme);
    this.build();
  }

  setTheme(theme: ViewTheme) {
    this.scene.background = new THREE.Color(theme.background);
    if (this.floor) this.scene.remove(this.floor);
    const floor = new THREE.Group();
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 3),
      new THREE.MeshStandardMaterial({ color: theme.floor, roughness: 0.95 }),
    );
    plane.receiveShadow = true;
    const grid = new THREE.GridHelper(1.2, 24, theme.grid, theme.grid);
    grid.rotateX(Math.PI / 2);
    grid.position.z = 0.0005;
    floor.add(plane, grid);
    this.floor = floor;
    this.scene.add(floor);
    (this.target.material as THREE.MeshStandardMaterial).color.set(theme.target);
  }

  private build() {
    const m = this.sim.model;
    for (let g = 0; g < m.ngeom; g++) {
      if (!VISIBLE_GROUPS.has(m.geom_group[g] as number)) continue;
      if ((m.geom_type[g] as number) === GEOM.plane) continue;
      const geometry = geometryFor(this.sim, g);
      if (!geometry) continue;
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: colorFor(this.sim, g),
          roughness: 0.55,
          metalness: 0.05,
        }),
      );
      mesh.matrixAutoUpdate = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.bodies.push({ geom: g, mesh });
    }
  }

  setTarget(pos: [number, number, number] | null) {
    this.target.visible = pos !== null;
    if (pos) this.target.position.set(...pos);
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  /** Posen aller Körper aus der Simulation übernehmen. */
  sync() {
    const xpos = this.sim.data.geom_xpos as Float64Array;
    const xmat = this.sim.data.geom_xmat as Float64Array;
    for (const { geom, mesh } of this.bodies) {
      const p = geom * 3;
      const r = geom * 9;
      // prettier-ignore
      mesh.matrix.set(
        xmat[r]!, xmat[r + 1]!, xmat[r + 2]!, xpos[p]!,
        xmat[r + 3]!, xmat[r + 4]!, xmat[r + 5]!, xpos[p + 1]!,
        xmat[r + 6]!, xmat[r + 7]!, xmat[r + 8]!, xpos[p + 2]!,
        0, 0, 0, 1,
      );
    }
  }

  render() {
    this.sync();
    this.controls.update();
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.controls.dispose();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        (object.material as THREE.Material).dispose();
      }
    });
    this.renderer.dispose();
  }
}
