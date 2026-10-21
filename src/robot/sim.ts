import type { DoubleBuffer, MainModule, MjData, MjModel } from '@mujoco/mujoco';
import wasmUrl from '@mujoco/mujoco/mujoco.wasm?url';

export const ROBOT_BASE = '/robot/so101/';
export const JOINTS = [
  'shoulder_pan',
  'shoulder_lift',
  'elbow_flex',
  'wrist_flex',
  'wrist_roll',
  'gripper',
] as const;
export const JOINT_LABELS: Record<(typeof JOINTS)[number], string> = {
  shoulder_pan: 'Drehen (Basis)',
  shoulder_lift: 'Schulter heben',
  elbow_flex: 'Ellbogen',
  wrist_flex: 'Handgelenk kippen',
  wrist_roll: 'Handgelenk drehen',
  gripper: 'Greifer',
};
/** Bereitstellung wie lab.so101.HOME (Greifer zeigt nach unten), Greifer halb offen. */
export const HOME: number[] = [0, -0.5, 0.3, 1.4, 0, 0.6];
/** Ruhestellung wie lab.so101.REST: zusammengefaltet. */
export const REST: number[] = [0, -1.57, 1.57, 0.8, 0, 0];
export const GRIPPER_OPEN = 1.2;
export const GRIPPER_CLOSED = -0.1;

export type Vec3 = [number, number, number];
export type RGBA = [number, number, number, number];

export interface CubeSpec {
  pos: Vec3;
  size: number;
  rgba: RGBA;
}

/** Offene Schale: Boden und vier niedrige Wände, fest auf dem Boden. */
export interface TraySpec {
  pos: [number, number];
  size: [number, number];
  rgba: RGBA;
}

export interface SceneSpec {
  cubes?: CubeSpec[];
  tray?: TraySpec | null;
}

/** Vollständiger Simulationszustand – genug, um eine Aufnahme exakt nachzustellen. */
export interface SimState {
  time: number;
  qpos: number[];
  qvel: number[];
  ctrl: number[];
}

export const TRAY_WALL = 0.025;
const TRAY_THICKNESS = 0.004;

let mujocoPromise: Promise<MainModule> | null = null;
let filesPromise: Promise<Map<string, Uint8Array>> | null = null;

export function loadMujoco(): Promise<MainModule> {
  mujocoPromise ??= import('@mujoco/mujoco').then((m) =>
    m.default({ locateFile: (file: string) => (file.endsWith('.wasm') ? wasmUrl : file) }),
  );
  return mujocoPromise;
}

async function fetchBytes(path: string): Promise<Uint8Array> {
  const response = await fetch(ROBOT_BASE + path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

export function meshFiles(xml: string): string[] {
  return [...xml.matchAll(/<mesh[^>]*file="([^"]+)"/g)].map((m) => `assets/${m[1]}`);
}

function loadFiles(): Promise<Map<string, Uint8Array>> {
  filesPromise ??= (async () => {
    const xml = await fetchBytes('so101.xml');
    const files = new Map([['so101.xml', xml]]);
    await Promise.all(
      meshFiles(new TextDecoder().decode(xml)).map(async (mesh) =>
        files.set(mesh, await fetchBytes(mesh)),
      ),
    );
    return files;
  })();
  filesPromise.catch(() => (filesPromise = null));
  return filesPromise;
}

const f = (values: number[]) => values.map((v) => +v.toFixed(5)).join(' ');

function trayXml(tray: TraySpec): string {
  const [w, d] = [tray.size[0] / 2, tray.size[1] / 2];
  const t = TRAY_THICKNESS / 2;
  const h = TRAY_WALL / 2;
  const rgba = f(tray.rgba);
  const box = (pos: number[], size: number[]) =>
    `\n      <geom type="box" pos="${f(pos)}" size="${f(size)}" rgba="${rgba}" contype="1" conaffinity="2"/>`;
  return `
    <body name="tray" pos="${f([...tray.pos, 0])}">${box([0, 0, t], [w, d, t])}${box([w - t, 0, h], [t, d, h])}${box([-w + t, 0, h], [t, d, h])}${box([0, d - t, h], [w, t, h])}${box([0, -d + t, h], [w, t, h])}
    </body>`;
}

export function sceneXml(scene: SceneSpec): string {
  const cubes = (scene.cubes ?? [])
    .map(
      (c, i) => `
    <body name="cube${i}" pos="${f(c.pos)}">
      <freejoint/>
      <geom type="box" size="${f([c.size / 2, c.size / 2, c.size / 2])}" rgba="${f(c.rgba)}"
        mass="0.03" condim="4" friction="1.2 .03 .003" contype="2" conaffinity="1" solref="0.01 1"/>
    </body>`,
    )
    .join('');
  return `<mujoco model="robopy-so101">
  <include file="so101.xml"/>
  <worldbody>
    <light pos="0.3 -0.4 1.2" dir="-0.2 0.3 -1" directional="true"/>
    <geom name="floor" type="plane" size="0 0 0.05" rgba="0.5 0.55 0.6 1"/>${scene.tray ? trayXml(scene.tray) : ''}${cubes}
    <camera name="front" pos="0.62 0 0.42" xyaxes="0 1 0 -0.55 0 0.83" fovy="50"/>
  </worldbody>
</mujoco>`;
}

/** Ein simulierter SO-101. Die Servos sind Positionsregler: setTargets() gibt Sollwinkel vor wie beim echten Arm. */
export class Sim {
  readonly model: MjModel;
  readonly data: MjData;
  readonly scene: SceneSpec;
  private readonly ikData: MjData;
  private readonly jacp: DoubleBuffer;
  private readonly jacr: DoubleBuffer;
  private readonly qposAdr: number[];
  private readonly dofAdr: number[];
  private readonly cubeAdr: number[];
  private readonly toolSite: number;
  private pending = 0;

  private constructor(
    readonly mujoco: MainModule,
    files: Map<string, Uint8Array>,
    scene: SceneSpec,
  ) {
    this.scene = scene;
    const vfs = new mujoco.MjVFS();
    try {
      for (const [name, bytes] of files) vfs.addBuffer(name, bytes);
      vfs.addBuffer('scene.xml', new TextEncoder().encode(sceneXml(scene)));
      this.model = mujoco.MjModel.mj_loadXML('scene.xml', vfs);
    } finally {
      vfs.delete();
    }
    this.data = new mujoco.MjData(this.model);
    this.ikData = new mujoco.MjData(this.model);
    this.jacp = new mujoco.DoubleBuffer(3 * this.model.nv);
    this.jacr = new mujoco.DoubleBuffer(3 * this.model.nv);
    const joint = (name: string) =>
      mujoco.mj_name2id(this.model, mujoco.mjtObj.mjOBJ_JOINT.value, name);
    this.qposAdr = JOINTS.map((j) => this.model.jnt_qposadr[joint(j)] as number);
    this.dofAdr = JOINTS.map((j) => this.model.jnt_dofadr[joint(j)] as number);
    this.cubeAdr = (scene.cubes ?? []).map(
      (_, i) =>
        this.model.jnt_qposadr[
          this.model.body_jntadr[
            mujoco.mj_name2id(this.model, mujoco.mjtObj.mjOBJ_BODY.value, `cube${i}`)
          ] as number
        ] as number,
    );
    this.toolSite = mujoco.mj_name2id(this.model, mujoco.mjtObj.mjOBJ_SITE.value, 'gripperframe');
    this.reset();
  }

  static async create(scene: SceneSpec = {}): Promise<Sim> {
    const [mujoco, files] = await Promise.all([loadMujoco(), loadFiles()]);
    return new Sim(mujoco, files, scene);
  }

  /** Für Tests und Werkzeuge: Sim aus bereits geladenem MuJoCo und Modelldateien. */
  static fromFiles(mujoco: MainModule, files: Map<string, Uint8Array>, scene: SceneSpec = {}) {
    return new Sim(mujoco, files, scene);
  }

  get timestep(): number {
    return this.model.opt.timestep;
  }

  get time(): number {
    return this.data.time;
  }

  reset(q: number[] = HOME) {
    this.mujoco.mj_resetData(this.model, this.data);
    this.pending = 0;
    this.setJoints(q);
    this.setTargets(q);
    const qpos = this.data.qpos as Float64Array;
    (this.scene.cubes ?? []).forEach((cube, i) => {
      qpos.set([...cube.pos, 1, 0, 0, 0], this.cubeAdr[i]!);
    });
    this.mujoco.mj_forward(this.model, this.data);
  }

  /** Sollwinkel der sechs Servos (rad), begrenzt auf den erlaubten Bereich. */
  setTargets(q: number[]) {
    const ctrl = this.data.ctrl as Float64Array;
    for (let i = 0; i < JOINTS.length; i++) {
      const [lo, hi] = this.jointRange(i);
      ctrl[i] = Math.min(hi, Math.max(lo, q[i] ?? ctrl[i]!));
    }
  }

  targets(): number[] {
    return Array.from((this.data.ctrl as Float64Array).slice(0, JOINTS.length));
  }

  /** Gelenkwinkel direkt setzen (ohne Physik), z. B. für reine Kinematik-Animationen. */
  setJoints(q: number[]) {
    const qpos = this.data.qpos as Float64Array;
    q.forEach((value, i) => {
      if (i < JOINTS.length) qpos[this.qposAdr[i]!] = value;
    });
  }

  joints(): number[] {
    const qpos = this.data.qpos as Float64Array;
    return this.qposAdr.map((adr) => qpos[adr]!);
  }

  forward() {
    this.mujoco.mj_forward(this.model, this.data);
  }

  /** Simuliert `seconds` Sekunden; Reste kleiner als ein Zeitschritt werden mitgezählt. */
  step(seconds: number) {
    this.pending += seconds;
    const steps = Math.floor(this.pending / this.timestep + 1e-9);
    this.pending -= steps * this.timestep;
    for (let i = 0; i < steps; i++) this.mujoco.mj_step(this.model, this.data);
  }

  toolPosition(data: MjData = this.data): Vec3 {
    const xpos = data.site_xpos as Float64Array;
    const i = this.toolSite * 3;
    return [xpos[i]!, xpos[i + 1]!, xpos[i + 2]!];
  }

  /** Richtung, in die die Greiferfinger zeigen (x-Achse des Greifer-Koordinatensystems). */
  toolAxis(data: MjData = this.data): Vec3 {
    const xmat = data.site_xmat as Float64Array;
    const i = this.toolSite * 9;
    return [xmat[i]!, xmat[i + 3]!, xmat[i + 6]!];
  }

  cubePosition(index: number): Vec3 {
    const qpos = this.data.qpos as Float64Array;
    const adr = this.cubeAdr[index]!;
    return [qpos[adr]!, qpos[adr + 1]!, qpos[adr + 2]!];
  }

  jointRange(index: number): [number, number] {
    const range = this.model.actuator_ctrlrange as Float64Array;
    return [range[index * 2]!, range[index * 2 + 1]!];
  }

  /**
   * Inverse Kinematik (Damped Least Squares) auf einer Kopie der Kinematik – die Physik bleibt unberührt.
   * Löst für die ersten vier Gelenke; Handgelenk-Drehung und Greifer bleiben wie in q0.
   * down = true: Greiferfinger zeigen senkrecht nach unten (gut zum Greifen von oben).
   */
  ik(target: Vec3, q0: number[], down = true, iterations = 40): { q: number[]; error: number } {
    const first = this.solveIk(target, q0, down, iterations);
    if (first.error < 2e-3) return first;
    // Warmstart an einer Gelenkgrenze kann hängen bleiben: noch einmal aus der Bereitstellung.
    const second = this.solveIk(
      target,
      [...HOME.slice(0, 4), ...q0.slice(4)],
      down,
      iterations * 2,
    );
    return second.error < first.error ? second : first;
  }

  private solveIk(target: Vec3, q0: number[], down: boolean, iterations: number) {
    const m = this.mujoco;
    const q = [...q0];
    const qpos = this.ikData.qpos as Float64Array;
    const nv = this.model.nv;
    const used = [0, 1, 2, 3];
    let error = Infinity;
    for (let it = 0; it <= iterations; it++) {
      q.forEach((v, i) => (qpos[this.qposAdr[i]!] = v));
      m.mj_kinematics(this.model, this.ikData);
      m.mj_comPos(this.model, this.ikData);
      const p = this.toolPosition(this.ikData);
      const e = [target[0] - p[0], target[1] - p[1], target[2] - p[2]];
      error = Math.hypot(e[0]!, e[1]!, e[2]!);
      const rows: number[][] = [];
      m.mj_jacSite(this.model, this.ikData, this.jacp, this.jacr, this.toolSite);
      const jp = this.jacp.GetView() as Float64Array;
      const jr = this.jacr.GetView() as Float64Array;
      for (let r = 0; r < 3; r++) rows.push(used.map((j) => jp[r * nv + this.dofAdr[j]!]!));
      if (down) {
        // Drehfehler: Achse a soll auf (0, 0, -1) zeigen → Drehvektor a × d, gewichtet.
        const a = this.toolAxis(this.ikData);
        const w = 0.15;
        e.push(w * -a[1], w * a[0], 0);
        for (let r = 0; r < 3; r++) rows.push(used.map((j) => w * jr[r * nv + this.dofAdr[j]!]!));
      }
      if (error < 2e-4 && it > 0) break;
      if (it === iterations) break;
      const dq = dampedLeastSquares(rows, e, 0.01);
      used.forEach((j, k) => {
        const [lo, hi] = this.jointRange(j);
        q[j] = Math.min(hi, Math.max(lo, q[j]! + dq[k]!));
      });
    }
    return { q, error };
  }

  getState(): SimState {
    return {
      time: this.data.time,
      qpos: Array.from(this.data.qpos as Float64Array),
      qvel: Array.from(this.data.qvel as Float64Array),
      ctrl: Array.from(this.data.ctrl as Float64Array),
    };
  }

  setState(state: SimState) {
    this.data.time = state.time;
    (this.data.qpos as Float64Array).set(state.qpos);
    (this.data.qvel as Float64Array).set(state.qvel);
    (this.data.ctrl as Float64Array).set(state.ctrl);
    this.pending = 0;
    this.forward();
  }

  dispose() {
    this.jacp.delete();
    this.jacr.delete();
    this.ikData.delete();
    this.data.delete();
    this.model.delete();
  }
}

/** dq = Jᵀ (J Jᵀ + λ² I)⁻¹ e für kleine Matrizen (Gauß-Elimination). */
export function dampedLeastSquares(J: number[][], e: number[], lambda: number): number[] {
  const n = J.length;
  const cols = J[0]?.length ?? 0;
  const A = J.map((ri, i) =>
    J.map((rj, j) => ri.reduce((s, v, k) => s + v * rj[k]!, 0) + (i === j ? lambda * lambda : 0)),
  );
  const y = solve(A, [...e]);
  return Array.from({ length: cols }, (_, k) => J.reduce((s, row, i) => s + row[k]! * y[i]!, 0));
  function solve(M: number[][], b: number[]): number[] {
    for (let c = 0; c < n; c++) {
      let pivot = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[pivot]![c]!)) pivot = r;
      [M[c], M[pivot]] = [M[pivot]!, M[c]!];
      [b[c], b[pivot]] = [b[pivot]!, b[c]!];
      for (let r = c + 1; r < n; r++) {
        const factor = M[r]![c]! / M[c]![c]!;
        for (let k = c; k < n; k++) M[r]![k]! -= factor * M[c]![k]!;
        b[r]! -= factor * b[c]!;
      }
    }
    const x = new Array<number>(n).fill(0);
    for (let r = n - 1; r >= 0; r--) {
      let s = b[r]!;
      for (let k = r + 1; k < n; k++) s -= M[r]![k]! * x[k]!;
      x[r] = s / M[r]![r]!;
    }
    return x;
  }
}
